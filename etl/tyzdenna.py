#!/usr/bin/env python3
"""Tyzdenna aktualizacia statistik — prepocita aktualnu sezonu a sezony, ktore sa zmenili.

Historicke sezony sa NEgeneruju opakovane bez dovodu (plny beh celej historie trva
4 h 53 min). Orchestruje existujuce ETL skripty, ziadna vlastna DB logika. Negituje —
commit a push riesi deploy/synology/entrypoint.sh (na NAS) alebo CI workflow.

═══════════════════════════════════════════════════════════════════════════════════════
KTORE SEZONY SA PREPOCITAVAJU (rozhodnutia Jan Letko, 17. 8. 2026)

Poziadavka: vysledky sa casto uzatvaraju o tyzden aj dva neskor, ako je datum zapasu, a
rozhodnutim komisii sa mozu spatne opravovat aj starsie zapasy.

  1. AKTUALNA SEZONA — vzdy, CELA, odznova. ETL nie je inkrementalne, takze ziadne "okno
     poslednych X dni" neexistuje a netreba ho: neskoro uzavrety zapas aj spatna oprava
     komisie v aktualnej sezone sa chytia automaticky.

  2. PREKRYV JUL-SEPTEMBER — v mesiacoch 7, 8 a 9 sa prepocitava aj PREDCHADZAJUCA sezona.
     Sezona sa urcuje z datumu (1. 7. - 30. 6.), takze po 1. 7. by sa uz nikdy
     neprepocitala, hoci sa do nej stale dopisuju dohravky, baraze a rozhodnutia komisii.
     Je to lacna poistka na obdobie, kedy sa sezona realne dokoncuje; namerany rozdiel na
     pocte zapasov je maly (2025/2026: 63 943 k 22. 7. 2026 -> 63 945 k 17. 8. 2026), ale
     pocet zapasov je slaby ukazovatel — spatna oprava vysledku ho nemeni vobec.

  3. SEZONY SO ZMENENYM ODTLACKOM — etl/kontrola_sezon.py pred behom zmeri odtlacok kazdej
     sezony (pocet uzavretych zapasov, sucet skore, divakov, kontumacii) a porovna ho s
     poslednym uspesnym behom. Sezona, ktora sa pohla, sa prepocita — aj spred piatich
     rokov. Preto sa spatna oprava starsieho zapasu neda prehliadnut.

Ochrana proti utrhnutiu: --max-sezon (default 4). Ak sa zmeni viac sezon, prebehnu tie
najnovsie a ZVYSOK SA VYPISE do logu; nepotvrdene odtlacky zabezpecia, ze sa preskocene
sezony objavia v pláne aj pri najblizsom behu.

═══════════════════════════════════════════════════════════════════════════════════════
PORADIE KROKOV — zavislosti su tvrde, poradie sa nesmie prehodit

Per sezona (s pristupom do DB):
  1. beh.py --sezona S                     43 zvazov, futbal, jedno DB spojenie
  2. run.py --zvaz sfz --sport-sector futsal --sezona S
  3. demografia.py --zvaz <id> --sezona S  43x, zdroj sportnet.users
  4. kluby.py --sezony S                   futbal
  5. kluby.py --sezony S --sport-sector futsal
  6. trendy.py --sezona S                  vek hracov (data/vek, data/vek-klub)
  7. demografia_klub.py --sezona S         demografia klubov

Raz na konci, offline (bez DB):
  8. kluby_zvazy.py --doplnit              vklada blok "Pocet klubov" do profilov zvazov
                                           → MUSI byt po kroku 1 a 4
  9. index_klubu.py --sezona-prehladu K    cita data/vek-klub → MUSI byt po kroku 6
 10. zanikanie.py                          cita data/klub → po kroku 4
 11. porovnania.py, porovnania_kluby.py, sumar.py   citaju profily vratane bloku klubov
                                           → MUSIA byt po kroku 8
11b. odstupene_kluby.py                   odstupene kluby + rozbeh prebiehajucej sezony
                                           → MUSI byt po kroku 11 (cita data/sumar)
 12. projekty.py                            grassroots projekty (ma DB, ale je nezavisly)

K = posledna KOMPLETNA sezona, nie aktualna. Prebiehajuca sezona sa do celoslovenskeho
prehladu Indexu klubu nesmie brat — v 2026/2027 malo 423 z 565 klubov index 0, lebo
mladeznicke druzstva neboli prihlasene (viz claude/metodika-index-klubu.md).

Pouzitie:
    export MONGODB_URI="mongodb+srv://…"
    export SSL_CERT_FILE=$(python -c 'import certifi; print(certifi.where())')
    python etl/tyzdenna.py                        # aktualna sezona + prekryv + zmenene
    python etl/tyzdenna.py --sezona 2024/2025     # rucny prepocet konkretnej sezony
    python etl/tyzdenna.py --bez-kontroly         # bez strazcu odtlackov (rychlejsi plan)
    python etl/tyzdenna.py --plan-only            # len vypise, co by bezalo
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ETL = REPO / "etl"
CONFIG = ETL / "config"
PY = sys.executable

#: Mesiace, v ktorych sa prepocitava aj predchadzajuca sezona (rozhodnutie Jan Letko,
#: 17. 8. 2026): jul, august, september — obdobie dohravok a odvolani po konci sezony.
PREKRYV_MESIACE = (7, 8, 9)

#: Limit agregacie. ZsFZ 2021/2022 je najtazsia kombinacia a pri default hodnote
#: timeoutovala (namerane 6.-7. 8. 2026), preto sa tu zvysuje na 15 minut.
MAX_TIME_MS = 900_000


def aktualna_sezona(dnes: date | None = None) -> str:
    """Sutazna sezona 1.7.-30.6. → 'RRRR/RRRR+1'."""
    d = dnes or date.today()
    zac = d.year if d.month >= 7 else d.year - 1
    return f"{zac}/{zac + 1}"


def predchadzajuca_sezona(sez: str) -> str:
    zac = int(sez.split("/")[0]) - 1
    return f"{zac}/{zac + 1}"


def zvaz_ids() -> list[str]:
    z = json.loads((CONFIG / "zvazy.json").read_text(encoding="utf-8"))
    return [x["id"] for grp in ("sfz", "rfz", "obfz") for x in z.get(grp, [])]


def zmenene_sezony(out: Path) -> list[str]:
    """Sezony so zmenenym odtlackom (etl/kontrola_sezon.py --plan).

    Zlyhanie strazcu beh NEzastavi — prepocita sa aspon aktualna sezona a prekryv.
    """
    print("\n>>> strazca odtlackov: etl/kontrola_sezon.py --plan", flush=True)
    r = subprocess.run([PY, "etl/kontrola_sezon.py", "--plan", "--out", str(out)],
                       cwd=str(REPO), capture_output=True, text=True)
    sys.stderr.write(r.stderr or "")
    if r.returncode != 0:
        print("!!! strazca odtlackov zlyhal — pokracujem bez neho", flush=True)
        return []
    return [s.strip() for s in (r.stdout or "").splitlines() if s.strip()]


def plan_sezon(dnes: date, zmenene: list[str], max_sezon: int) -> tuple[list[str], list[str]]:
    """Zoznam sezon na prepocet (aktualna prva) + zoznam preskocenych nad limit."""
    akt = aktualna_sezona(dnes)
    poradie = [akt]
    if dnes.month in PREKRYV_MESIACE:
        poradie.append(predchadzajuca_sezona(akt))
    for s in sorted(set(zmenene), reverse=True):
        if s not in poradie:
            poradie.append(s)
    return poradie[:max_sezon], poradie[max_sezon:]


def spusti(args: list[str], nazov: str, chyby: list[str]) -> bool:
    """Spusti ETL krok; zlyhanie zaznamena, ale nezastavi cely beh."""
    print(f"\n>>> {nazov}: {' '.join(args)}", flush=True)
    r = subprocess.run([PY, *args], cwd=str(REPO))
    if r.returncode != 0:
        print(f"!!! ZLYHALO ({r.returncode}): {nazov}", flush=True)
        chyby.append(nazov)
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description="Tyzdenna aktualizacia statistik")
    ap.add_argument("--sezona", help="prepocitaj LEN tuto sezonu (rucny beh, bez strazcu)")
    ap.add_argument("--index-sezona",
                    help="sezona celoslovenskeho prehladu Indexu klubu "
                         "(default: posledna kompletna, teda predchadzajuca k aktualnej)")
    ap.add_argument("--max-sezon", type=int, default=4,
                    help="najviac kolko sezon prepocitat v jednom behu (default 4)")
    ap.add_argument("--bez-kontroly", action="store_true",
                    help="nespustat strazcu odtlackov (etl/kontrola_sezon.py)")
    ap.add_argument("--plan-only", action="store_true",
                    help="len vypis, ktore sezony a kroky by bezali; nic nespustat")
    ap.add_argument("--out", default=str(REPO / "data"), help="datovy priecinok (default data/)")
    args = ap.parse_args()

    out = Path(args.out)
    dnes = date.today()
    akt = aktualna_sezona(dnes)
    # Posledna KOMPLETNA sezona — prebiehajuca sa do prehladu Indexu klubu nesmie brat.
    idx_sez = args.index_sezona or predchadzajuca_sezona(akt)
    ids = zvaz_ids()
    chyby: list[str] = []

    if args.sezona:
        sezony, preskocene = [args.sezona], []
        print(f"=== Rucny prepocet — sezona {args.sezona} ===", flush=True)
    else:
        zmenene = [] if (args.bez_kontroly or args.plan_only) else zmenene_sezony(out)
        sezony, preskocene = plan_sezon(dnes, zmenene, args.max_sezon)
        print(f"\n=== Tyzdenna aktualizacia {dnes.isoformat()} ===", flush=True)
        print(f"    aktualna sezona: {akt}", flush=True)
        print(f"    prekryv (jul-sept): {'ano' if dnes.month in PREKRYV_MESIACE else 'nie'}", flush=True)
        print(f"    zmenene odtlacky: {', '.join(zmenene) or '-'}", flush=True)

    print(f"    na prepocet ({len(sezony)}): {', '.join(sezony)}", flush=True)
    if preskocene:
        # Nikdy nepreskakovat potichu — nepotvrdeny odtlacok zabezpeci opakovanie.
        print(f"    PRESKOCENE nad limit --max-sezon={args.max_sezon}: "
              f"{', '.join(preskocene)} (prepocitaju sa pri najblizsom behu)", flush=True)
    print(f"    sezona prehladu Indexu klubu: {idx_sez}", flush=True)
    print(f"    zvazov: {len(ids)}", flush=True)

    if args.plan_only:
        return 0

    hotove: list[str] = []
    for sez in sezony:
        print(f"\n########## SEZONA {sez} ##########", flush=True)
        pred = len(chyby)
        # 1) zvazy — futbal, jedno DB spojenie pre vsetkych 43 zvazov
        spusti(["etl/beh.py", "--sezona", sez, "--max-time-ms", str(MAX_TIME_MS)],
               f"beh zvazy {sez}", chyby)
        # 2) futsal (zije pod SFZ)
        spusti(["etl/run.py", "--zvaz", "sfz", "--sezona", sez, "--sport-sector", "futsal"],
               f"run sfz futsal {sez}", chyby)
        # 3) demografia zvazov — futbal
        for zid in ids:
            spusti(["etl/demografia.py", "--zvaz", zid, "--sezona", sez],
                   f"demografia {zid} {sez}", chyby)
        # 4) a 5) kluby — futbal a futsal
        spusti(["etl/kluby.py", "--sezony", sez, "--index-sezona", idx_sez],
               f"kluby {sez}", chyby)
        spusti(["etl/kluby.py", "--sezony", sez, "--index-sezona", idx_sez,
                "--sport-sector", "futsal"], f"kluby futsal {sez}", chyby)
        # 6) vek hracov (data/vek, data/vek-klub) — vstup pre Index klubu
        spusti(["etl/trendy.py", "--sezona", sez], f"trendy {sez}", chyby)
        # 7) demografia klubov
        spusti(["etl/demografia_klub.py", "--sezona", sez], f"demografia_klub {sez}", chyby)
        if len(chyby) == pred:
            hotove.append(sez)

    print("\n########## ODVODENE AGREGATY (offline) ##########", flush=True)
    # 8) blok "Pocet klubov" do profilov zvazov — po zvazoch aj kluboch
    spusti(["etl/kluby_zvazy.py", "--doplnit", "--out", str(out)], "kluby_zvazy", chyby)
    # 9) Index klubu — cita data/vek-klub
    spusti(["etl/index_klubu.py", "--data", str(out), "--sezona-prehladu", idx_sez],
           "index_klubu", chyby)
    # 10) zanikanie klubov
    spusti(["etl/zanikanie.py", "--out", str(out)], "zanikanie", chyby)
    # 11) porovnania a celoslovensky sumar — po kroku 8
    spusti(["etl/porovnania.py", "--out", str(out)], "porovnania", chyby)
    spusti(["etl/porovnania_kluby.py", "--out", str(out)], "porovnania_kluby", chyby)
    # 11a0) UNIKATNE druzstva za SR — musi byt pred sumar.py, ktory nim prepise kpi.druzstva
    for sez in (hotove or sezony):
        spusti(["etl/druzstva_sr.py", "--sezona", sez, "--out", str(out)],
               f"druzstva SR {sez}", chyby)
    # 11a) SR demografia — UNIKATNE osoby cez vsetky zvazy aj odvetvia; musi byt PRED
    #      sumar.py, ktory by inak zapisal zalohu zo suctu zvazovych suborov
    for sez in (hotove or sezony):
        spusti(["etl/demografia.py", "--zvaz", "sr", "--sezona", sez, "--out", str(out)],
               f"demografia SR {sez}", chyby)
    spusti(["etl/sumar.py", "--out", str(out)], "sumar", chyby)
    # 11b) odstupene kluby — cita data/klub a data/sumar (blok rozbeh) → po kroku 11
    spusti(["etl/odstupene_kluby.py", "--out", str(out)], "odstupene_kluby", chyby)
    # 12) grassroots projekty
    spusti(["etl/projekty.py", "--out", str(out)], "projekty", chyby)

    # Odtlacky sa potvrdia LEN pre sezony, ktore presli bez chyby. Sezona, ktora spadla,
    # zostane na starom odtlacku a pri najblizsom behu sa objavi znova.
    if not args.sezona and not args.bez_kontroly and hotove:
        spusti(["etl/kontrola_sezon.py", "--potvrd", "--out", str(out),
                "--sezony", ",".join(hotove)], "kontrola_sezon --potvrd", chyby)

    if chyby:
        print(f"\n=== DOKONCENE s {len(chyby)} chybami: {', '.join(chyby)} ===", flush=True)
        return 1
    print(f"\n=== DOKONCENE bez chyb — sezony: {', '.join(sezony)} ===", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
