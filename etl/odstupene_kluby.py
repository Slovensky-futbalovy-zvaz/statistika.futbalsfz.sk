#!/usr/bin/env python3
"""Odstúpené kluby a úbytok družstiev po vekových kategóriách.

═══════════════════════════════════════════════════════════════════════════════════════
ZADANIE (Ján Letko, 16. 8. 2026)

Úloha prišla ako „štatistika odhlásených klubov“, ale **„odhlásený klub“ je zlá
definícia — odhlasujú sa DRUŽSTVÁ, nie kluby.** Klub zaniká až vtedy, keď dve sezóny
po sebe neprihlási do súťaže žiadne družstvo (pozri `etl/zanikanie.py`).

Správna logika, ktorú tento skript počíta:

A) ODSTÚPENÉ KLUBY — pojem zaviedol Ján Letko (16. 8. 2026):

       ODSTÚPENÝ KLUB = klub, ktorý prvú sezónu nemá v súťažiach žiadne družstvo
       (žiadny odohraný zápas), pričom v predchádzajúcej sezóne mal aspoň jedno.

   Je to stav po jednej tichej sezóne, nie zánik — zánik je až po druhej. Rozpad podľa
   toho, aké družstvá klub mal, keď naposledy hral, PLUS história: koľko družstiev
   v ktorej kategórii mala tá istá skupina klubov tri sezóny predtým. Z toho sa vidí, či
   klub odstúpil zrazu, alebo sa scvrkával postupne.

B) DRUŽSTVÁ PO KATEGÓRIÁCH — koľko družstiev v ktorej vekovej kategórii medziročne
   ubudlo a pribudlo, vrátane klubov, ktoré prišli len o časť družstiev a hrajú ďalej.
   Toto je bližšie realite odhlasovania než počet klubov.

Kategórie: Prípravka, Žiaci, Dorast, Dospelí.

Prebiehajúca sezóna sa NERIEŠI (rozhodnutie Ján Letko): mládežnícke súťaže sa rozbiehajú
neskôr než súťaže dospelých, takže klub, ktorý ešte len čaká na štart svojej súťaže, by
vyšiel ako odhlásený. V sezóne 2026/2027 je takých klubov 40 a väčšina z nich hrá.
═══════════════════════════════════════════════════════════════════════════════════════

DÔLEŽITÁ VÝHRADA, ktorá musí ísť s každým číslom: klub bez družstva v jednej sezóne
NIE JE zaniknutý klub. Po jednej vynechanej sezóne sa vracia 19,7 % klubov. Skript preto
vedľa počtu vykazuje aj to, koľko z nich sa vrátilo a koľko zaniklo podľa definície.

Preberá z `etl/zanikanie.py`: vyradenie sezón odohraných len v pohári (do pohára sa dostane
len klub aktívny v súťažiach) a spojenie právnych nástupcov (nový subjekt v ISSF nie je nový
klub) — bez toho by preregistrácia klubu vyšla ako strata všetkých družstiev.

Beží OFFLINE nad `data/klub/`, MongoDB netreba.

Použitie:
    python etl/odstupene_kluby.py
"""
from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path

import zanikanie as zn

REPO = Path(__file__).resolve().parents[1]
SEZ_RE = re.compile(r"^(\d{4})-(\d{4})\.json$")

# Koľko sezón dozadu sledovať históriu odstúpených klubov.
HISTORIA_SEZON = 3

# Vekové kategórie tak, ako ich zadal Ján Letko. Poradie je od najmladších.
GRUPY: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Prípravka", ("U11", "U10", "U09", "U08", "U07")),
    ("Žiaci", ("U15", "U14", "U13", "U12")),
    ("Dorast", ("U19", "U18", "U17", "U16")),
    ("Dospelí", ("ADULTS",)),
)
KAT_GRUPA = {k: g for g, kk in GRUPY for k in kk}
NAZVY_GRUP = [g for g, _ in GRUPY]


def nacitaj_druzstva(out_dir: Path) -> tuple[dict, dict]:
    """({klub: {sezona: {grupa: počet družstiev}}}, {klub: {sezona: nazov}}).

    Kategória sa počíta len ak v nej klub REÁLNE ODOHRAL zápas — prihlásené a odhlásené
    družstvo bez jediného odohraného zápasu nie je hraný futbal.
    """
    druzstva: dict[str, dict[str, dict[str, int]]] = {}
    nazvy: dict[str, dict[str, str]] = {}
    nezname: collections.Counter = collections.Counter()
    for d in sorted((out_dir / "klub").iterdir()):
        if not d.is_dir():
            continue
        pre: dict[str, dict[str, int]] = {}
        pre_n: dict[str, str] = {}
        for f in sorted(d.iterdir()):
            m = SEZ_RE.match(f.name)
            if not m:
                continue
            with open(f, encoding="utf-8") as fh:
                j = json.load(fh)
            po_grupe: dict[str, int] = collections.Counter()
            for kat, v in (j.get("kategorie") or {}).items():
                if not v.get("zapasy"):
                    continue
                g = KAT_GRUPA.get(kat)
                if g is None:
                    nezname[kat] += 1
                    continue
                po_grupe[g] += v.get("druzstva", 0)
            if po_grupe:
                s = f"{m.group(1)}/{m.group(2)}"
                pre[s] = dict(po_grupe)
                pre_n[s] = j.get("nazov") or ""
        if pre:
            druzstva[d.name] = pre
            nazvy[d.name] = pre_n
    if nezname:
        print(f"pozn.: kategórie mimo zadaných skupín (nezapočítané): {dict(nezname)}")
    return druzstva, nazvy


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(REPO / "data"))
    args = ap.parse_args()
    out_dir = Path(args.out)

    druzstva, nazvy = nacitaj_druzstva(out_dir)
    urovne = zn.urovne_klubov(out_dir)

    # 1) POHÁRE PREČ — sezóna odohraná len v pohári nie je aktívna sezóna klubu
    vyhodenych = 0
    for k, v in list(druzstva.items()):
        for s in [x for x in v if (urovne.get(k, {}).get(x) or (None, False))[1]]:
            del v[s]
            vyhodenych += 1
        if not v:
            del druzstva[k]

    vsetky = sorted({s for v in druzstva.values() for s in v})
    sezony = [s for s in vsetky[:-1] if s not in zn.NABEH_ISSF]   # bez nábehu ISSF a bez prebiehajúcej
    prebiehajuca = vsetky[-1]

    # 2) PRÁVNI NÁSTUPCOVIA — preregistrácia nie je strata družstiev
    pre_zanik = {
        k: {s: (True, True, None, nazvy[k].get(s, "")) for s in v}
        for k, v in druzstva.items()
    }
    nastupca = zn.najdi_nastupcov(pre_zanik, urovne, sezony, zn.TICHO_SEZON)
    for nk, pk in zn.rucne_nastupcovia(REPO).items():
        if nk in druzstva and pk in druzstva:
            nastupca[nk] = pk

    def koren(k: str) -> str:
        videne = set()
        while k in nastupca and k not in videne:
            videne.add(k)
            k = nastupca[k]
        return k

    spojene: dict[str, dict[str, dict[str, int]]] = {}
    spojene_nazvy: dict[str, dict[str, str]] = {}
    for k, v in druzstva.items():
        c = koren(k)
        cieľ = spojene.setdefault(c, {})
        cieľ_n = spojene_nazvy.setdefault(c, {})
        for s, po_grupe in v.items():
            if s in cieľ:
                for g, n in po_grupe.items():
                    cieľ[s][g] = cieľ[s].get(g, 0) + n
            else:
                cieľ[s] = dict(po_grupe)
                cieľ_n[s] = nazvy[k].get(s, "")
    druzstva, nazvy = spojene, spojene_nazvy

    print(f"klubov: {len(druzstva)} | okno {sezony[0]} – {sezony[-1]}"
          f" | prebiehajúca {prebiehajuca} sa nerieši")
    print(f"sezón odohraných len v pohári (vyradené): {vyhodenych}"
          f" | spojených právnych nástupcov: {len(nastupca)}\n")

    idx = {s: i for i, s in enumerate(sezony)}
    aktivne = {k: {s for s in v if s in idx} for k, v in druzstva.items()}

    # ── A) KLUBY BEZ DRUŽSTVA ────────────────────────────────────────────────────────
    tab_a = {}
    detail = collections.defaultdict(list)
    for i, s in enumerate(sezony):
        if i == 0:
            continue
        pred = sezony[i - 1]
        bez = [k for k, akt in aktivne.items() if pred in akt and s not in akt]
        vratili, zanikli, nehodnotitelne = [], [], []
        for k in bez:
            neskor = [x for x in aktivne[k] if idx[x] > i]
            if neskor:
                vratili.append(k)
            elif i + 1 < len(sezony):
                zanikli.append(k)           # dve tiché sezóny → zánik podľa definície
            else:
                nehodnotitelne.append(k)
        po_grupe = collections.Counter()
        druzstiev_stratenych = collections.Counter()
        # HISTÓRIA KOHORTY: koľko družstiev mali tie isté kluby v predchádzajúcich sezónach
        historia: dict[str, dict[str, int]] = {}
        historia_klubov: dict[str, int] = {}
        for h in range(HISTORIA_SEZON, 0, -1):
            j = i - h
            if j < 0:
                continue
            hs = sezony[j]
            historia[hs] = {g: sum(druzstva[k].get(hs, {}).get(g, 0) for k in bez)
                            for g in NAZVY_GRUP}
            historia_klubov[hs] = sum(1 for k in bez if hs in aktivne[k])
        for k in bez:
            for g, n in druzstva[k][pred].items():
                po_grupe[g] += 1
                druzstiev_stratenych[g] += n
            detail[s].append({
                "klub": k,
                "nazov": nazvy[k].get(pred, ""),
                "poslednaSezona": pred,
                "druzstva": druzstva[k][pred],
                "sezonHral": len(aktivne[k]),
                "vratilSa": bool([x for x in aktivne[k] if idx[x] > i]),
            })
        tab_a[s] = {
            "klubovBezDruzstva": len(bez),
            "vratiliSa": len(vratili),
            "zaniklo": len(zanikli),
            "zatialNehodnotitelnych": len(nehodnotitelne),
            "klubovPodlaGrupy": {g: po_grupe.get(g, 0) for g in NAZVY_GRUP},
            "stratenychDruzstiev": {g: druzstiev_stratenych.get(g, 0) for g in NAZVY_GRUP},
            "historiaDruzstiev": historia,
            "historiaAktivnychKlubov": historia_klubov,
        }

    print("A) ODSTÚPENÉ KLUBY — prvú sezónu bez jediného družstva v súťažiach")
    print("   (predchádzajúcu sezónu mali aspoň jedno; nie je to zánik, ten je až po druhej)\n")
    hl = "".join(f"{g:>11}" for g in NAZVY_GRUP)
    print(f"{'sezóna':11}{'odstúpených':>12}{'vrátili sa':>12}{'zaniklo':>9}"
          f"   | klubov s družstvom v poslednej odohranej sezóne:{hl}")
    for s in sezony[1:]:
        r = tab_a[s]
        g = "".join(f"{r['klubovPodlaGrupy'][x]:>11}" for x in NAZVY_GRUP)
        n = f"{r['zaniklo']:>9}" if not r["zatialNehodnotitelnych"] else f"{'—':>9}"
        print(f"{s:11}{r['klubovBezDruzstva']:12}{r['vratiliSa']:12}{n}"
              f"   {'':47}{g}")

    poc = [tab_a[x]["klubovBezDruzstva"] for x in sezony[1:]]
    priemer = sum(poc) / len(poc)
    posledna = poc[-1]
    poradie = sorted(poc).index(posledna) + 1
    print(f"\n   priemer za {len(poc)} sezón: {priemer:.1f} odstúpených klubov"
          f" | posledná sezóna {sezony[-1]}: {posledna}"
          f" — {poradie}. najnižší počet z {len(poc)} sezón")

    print("\n   HISTÓRIA ODSTÚPENÝCH KLUBOV — koľko družstiev mala tá istá skupina klubov")
    print("   v predchádzajúcich sezónach. Klesajúci rad = klub sa scvrkával, nie náhla zmena.\n")
    for s in sezony[1:]:
        r = tab_a[s]
        if not r["klubovBezDruzstva"]:
            continue
        print(f"   odstúpení v {s} ({r['klubovBezDruzstva']} klubov)")
        print(f"     {'sezóna':11}{'hralo klubov':>13}{hl}")
        for hs, po in r["historiaDruzstiev"].items():
            g = "".join(f"{po[x]:>11}" for x in NAZVY_GRUP)
            print(f"     {hs:11}{r['historiaAktivnychKlubov'][hs]:13}{g}")
        print()

    # ── B) DRUŽSTVÁ A KLUBY PO KATEGÓRIÁCH ──────────────────────────────────────────
    tab_b = {}
    for i, s in enumerate(sezony):
        pred = sezony[i - 1] if i else None
        r = {}
        for g in NAZVY_GRUP:
            klubov = sum(1 for k, v in druzstva.items() if s in v and v[s].get(g))
            druz = sum(v[s].get(g, 0) for v in druzstva.values() if s in v)
            stratili = pridali = 0
            if pred:
                for k, v in druzstva.items():
                    mal = bool(v.get(pred, {}).get(g))
                    ma = bool(v.get(s, {}).get(g))
                    hra_dalej = s in aktivne.get(k, set())
                    if mal and not ma and hra_dalej:
                        stratili += 1
                    if not mal and ma and pred in aktivne.get(k, set()):
                        pridali += 1
            r[g] = {
                "klubov": klubov, "druzstiev": druz,
                "stratiliKategoriuAHrajuDalej": stratili,
                "pridaliKategoriu": pridali,
            }
        tab_b[s] = r

    print("\nB) DRUŽSTVÁ PO VEKOVÝCH KATEGÓRIÁCH — koľko ich je a kto o kategóriu prišiel")
    print("   („stratili“ = klub kategóriu už nemá, ale ĎALEJ HRÁ v inej)\n")
    for g in NAZVY_GRUP:
        print(f"  {g}")
        print(f"    {'sezóna':11}{'klubov':>8}{'družstiev':>11}{'stratili':>10}{'pridali':>9}")
        for s in sezony:
            r = tab_b[s][g]
            print(f"    {s:11}{r['klubov']:8}{r['druzstiev']:11}"
                  f"{r['stratiliKategoriuAHrajuDalej']:10}{r['pridaliKategoriu']:9}")
        print()

    cesta = out_dir / "odstupene-kluby.json"
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump({
            "generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(timespec="seconds"),
            "zadanie": (
                "„Odhlásený klub“ je zlá definícia — odhlasujú sa DRUŽSTVÁ. Blok A: ODSTÚPENÉ "
                "KLUBY (pojem Ján Letko, 16. 8. 2026) = klub, ktorý prvú sezónu nemá v súťažiach "
                "žiadne družstvo a predchádzajúcu mal aspoň jedno; vrátane histórie družstiev "
                "kohorty tri sezóny dozadu. Blok B: družstvá po vekových kategóriách. "
                "Prebiehajúca sezóna sa nerieši."
            ),
            "vyhrada": (
                "Odstúpený klub NIE JE zaniknutý klub — po jednej vynechanej sezóne sa vracia "
                "19,7 % klubov. Zánik je až dve tiché sezóny po sebe (etl/zanikanie.py)."
            ),
            "sezony": sezony,
            "suhrn": {
                "priemerOdstupenych": round(priemer, 1),
                "poslednaSezona": sezony[-1],
                "poslednaSezonaOdstupenych": posledna,
                "poradiePoslednejOdNajnizsieho": poradie,
                "sezonHodnotenych": len(poc),
            },
            "prebiehajuca": prebiehajuca,
            "grupy": NAZVY_GRUP,
            "odstupeneKluby": tab_a,
            "poKategoriach": tab_b,
            "detail": {s: detail[s] for s in sezony[1:]},
        }, f, ensure_ascii=False, indent=1)
    print(f"OK {cesta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
