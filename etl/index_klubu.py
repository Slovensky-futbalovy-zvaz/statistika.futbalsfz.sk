#!/usr/bin/env python3
"""ETL Index klubu — cislo 0-100 za sezonu, ktore meria mladeznicku zakladnu klubu.

Metodika a vsetky rozhodnutia: claude/metodika-index-klubu.md v projekte
(schvalil Jan Letko, 7. 8. 2026). Prahy su kalibrovane na skutocnom rozdeleni
1 450 klubov v sezone 2025/2026.

CO INDEX MERIA: mladeznicku zakladnu klubu a jej udrzatelnost.
CO NEMERIA: kvalitu trenerskej prace, zazemie, pristup k detom, sportovu uspesnost
ani financne zdravie. Index tiez systematicky zvyhodnuje velke kluby — klub s jednym
druzstvom pripravky nikdy nedosiahne skore mestskeho klubu so siestimi druzstvami.
Tieto obmedzenia sa zobrazuju priamo pri kazdom vyskyte indexu na webe.

PAT ZLOZIEK (spolu 100 bodov):
    A. Sirka mladeze          30  — kolko z troch skupin (Dorast/Ziaci/Pripravky)
    B. Deti v mladezi         25  — unikatni hraci v mladezi
    C. Pocet druzstiev mladeze 15 — vaha za viac druzstiev v tej istej kategorii
    D. Kontinuita             15  — kolko sezon po sebe ma klub mladez
    E. Prechod do dospelych   15  — podiel hracov do 21 rokov v druzstve dospelych

Zlozka E je jedina, ktora meri, ci vychova k niecomu vedie: klub moze mat pat
mladeznickych druzstiev, ale ak v A-muzstve nehra ani jeden vlastny dvadsatrocny,
nieco v prechode nefunguje.

TRENERI DO INDEXU NEVSTUPUJU. Median poctu mladeznickych trenerov na klub je 1
a dolny kvartil 0 — vyse stvrtiny klubov nema evidovaneho ani jedneho. To takmer
urcite nie je skutocnost, ale dosledok toho, ze trener sa pocita z realizacneho
timu v zapise a mnohe kluby ho nevyplnaju. Index by tak trestal kluby za
administrativnu nedoslednost, nie za stav mladeze.

Vstupy (ziadny pristup do DB — bezi nad uz vygenerovanymi JSON):
    data/vek-klub/{klub}.json   — zapocitane druzstva a vekove histogramy (etl/trendy.py)
    data/klub/{klub}/{sezona}.json — osoby.hraci.poKategorii (etl/kluby.py)

Vystup:
    data/index-klubu/{klub}.json — index a rozpad na zlozky po sezonach
    data/index-klubu.json        — celoslovensky prehlad pre tabulku na stranke Trendy

Pouzitie:
    python etl/index_klubu.py
"""
from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

log = logging.getLogger("index_klubu")

# Vekove skupiny mladeze. Musi sediet s GROUPS vo web/src/lib/palette.ts.
SKUPINY_MLADEZE = {
    "Dorast": {"U19", "U18", "U17", "U16"},
    "Ziaci": {"U15", "U14", "U13", "U12"},
    "Pripravky": {"U11", "U10", "U09", "U08", "U07", "U06"},
}
KAT_MLADEZ = set().union(*SKUPINY_MLADEZE.values())

# Prah, pod ktorym sa index nepocita (rovnaky ako pri vekovej statistike).
PRAH_ZAPISOV = 100

# Hranica "mlady hrac" pre zlozku E — vekova uroven osoby do 21 vratane.
HRANICA_MLADY = 21

METODIKA = (
    "Index klubu meria mladeznicku zakladnu klubu a jej udrzatelnost, nie kvalitu "
    "trenerskej prace, zazemie, pristup k detom ani sportovu uspesnost. Systematicky "
    "zvyhodnuje velke kluby. Zlozky: sirka mladeze 30 b., deti v mladezi 25 b., pocet "
    "druzstiev mladeze 15 b., kontinuita 15 b., prechod do dospelych 15 b. Treneri do "
    "indexu nevstupuju — udaj o nich je v datach slabo vyplneny a index by trestal "
    "administrativnu nedoslednost. Druzstvo sa zapocita, len ak odohralo viac nez "
    "polovicu medianu zapasov v tej istej casti sutaze."
)


def load_json(p: Path):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def skupiny_mladeze(druzstva: dict) -> tuple[int, int]:
    """(pocet obsadenych skupin 0-3, pocet druzstiev mladeze)."""
    obsadene = 0
    for cats in SKUPINY_MLADEZE.values():
        if any(druzstva.get(c, 0) > 0 for c in cats):
            obsadene += 1
    druzstiev = sum(n for k, n in druzstva.items() if k in KAT_MLADEZ)
    return obsadene, druzstiev


def body_a(obsadene: int) -> int:
    """Sirka mladeze — 30 bodov. Klub, ktory ma len pripravku, dieta po jedenastke strati."""
    return {0: 0, 1: 10, 2: 20, 3: 30}[obsadene]


def body_b(deti: int) -> int:
    """Deti v mladezi — 25 bodov. Hranice = kvartily a deviaty decil vsetkych klubov."""
    if deti <= 0:
        return 0
    if deti <= 14:
        return 5
    if deti <= 36:
        return 12
    if deti <= 76:
        return 18
    if deti <= 130:
        return 22
    return 25


def body_c(druzstiev: int) -> int:
    """Pocet druzstiev mladeze — 15 bodov. Dve pripravky = viac deti sa dostane na hru."""
    if druzstiev <= 0:
        return 0
    if druzstiev == 1:
        return 4
    if druzstiev <= 3:
        return 8
    if druzstiev <= 6:
        return 12
    return 15


def body_d(sezon_po_sebe: int) -> int:
    """Kontinuita — 15 bodov. Odlisuje dlhodobu pracu od jednorazovej pripravky."""
    if sezon_po_sebe <= 0:
        return 0
    if sezon_po_sebe == 1:
        return 3
    if sezon_po_sebe == 2:
        return 6
    if sezon_po_sebe <= 4:
        return 10
    return 15


def body_e(podiel: float | None) -> int | None:
    """Prechod do dospelych — 15 bodov. None = klub nema druzstvo dospelych."""
    if podiel is None:
        return None
    if podiel <= 0:
        return 0
    if podiel < 0.10:
        return 5
    if podiel < 0.20:
        return 10
    return 15


def podiel_mladych(vek: dict) -> tuple[float | None, int]:
    """(podiel zapisov hracov do 21 rokov, pocet zapisov spolu) z histogramu dospelych."""
    spolu = 0
    mladi = 0
    for _g, hist in (vek or {}).items():
        for v, n in hist.items():
            spolu += n
            if int(v) <= HRANICA_MLADY:
                mladi += n
    if spolu == 0:
        return None, 0
    return mladi / spolu, spolu


def kontinuita(sezony: list[str], data: dict, sezona: str) -> int:
    """Kolko sezon po sebe (vratane hodnotenej) mal klub aspon jedno mladeznicke druzstvo."""
    if sezona not in sezony:
        return 0
    i = sezony.index(sezona)
    n = 0
    while i >= 0:
        d = (data.get(sezony[i]) or {}).get("druzstva") or {}
        if any(d.get(c, 0) > 0 for c in KAT_MLADEZ):
            n += 1
            i -= 1
        else:
            break
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description="ETL Index klubu (statistika.futbalsfz.sk)")
    ap.add_argument("--data", default=str(REPO / "data"))
    ap.add_argument(
        "--sezona-prehladu", default="2025/2026",
        help="sezona, z ktorej sa berie celoslovensky prehlad (default posledna kompletna)",
    )
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    data = Path(args.data)
    vek_dir = data / "vek-klub"
    klub_dir = data / "klub"
    out_dir = data / "index-klubu"

    if not vek_dir.exists():
        log.error("chyba %s — najprv spusti etl/trendy.py", vek_dir)
        return 1

    prehlad = []
    spracovanych = 0

    for cesta in sorted(vek_dir.glob("*.json")):
        slug = cesta.stem
        try:
            vd = load_json(cesta)
        except Exception:
            continue
        sezony_data = vd.get("sezony") or {}
        sezony = sorted(sezony_data)
        if not sezony:
            continue

        nazov = ""
        vysledky: dict[str, dict] = {}

        for sez in sezony:
            s = sezony_data[sez] or {}
            druzstva = s.get("druzstva") or {}
            obsadene, druzstiev_ml = skupiny_mladeze(druzstva)

            # deti v mladezi z kluboveho profilu (osoby.hraci.poKategorii)
            deti = 0
            profil = klub_dir / slug / (sez.replace("/", "-") + ".json")
            if profil.exists():
                try:
                    p = load_json(profil)
                    nazov = p.get("nazov") or nazov
                    poKat = ((p.get("osoby") or {}).get("hraci") or {}).get("poKategorii") or {}
                    deti = sum(n for k, n in poKat.items() if k in KAT_MLADEZ)
                except Exception:
                    pass

            podiel, zapisov = podiel_mladych(s.get("vek") or {})
            ma_dospelych = druzstva.get("ADULTS", 0) > 0 or zapisov > 0

            # klub bez mladeze — index 0, zobrazi sa slovne ako "bez mladeze"
            if obsadene == 0:
                vysledky[sez] = {
                    "index": 0, "stav": "bez-mladeze",
                    "zlozky": {"A": 0, "B": 0, "C": 0, "D": 0, "E": None},
                    "detaily": {"skupiny": 0, "deti": deti, "druzstvaMladez": 0,
                                "sezonPoSebe": 0, "podielMladych": podiel,
                                "zapisovDospeli": zapisov},
                }
                continue

            a = body_a(obsadene)
            b = body_b(deti)
            c = body_c(druzstiev_ml)
            d = body_d(kontinuita(sezony, sezony_data, sez))
            e = body_e(podiel) if (ma_dospelych and zapisov >= PRAH_ZAPISOV) else None

            if e is None:
                # klub bez druzstva dospelych (alebo s malo zapismi) — prepocet na 100
                index = round((a + b + c + d) / 85 * 100)
                stav = "bez-dospelych"
            else:
                index = a + b + c + d + e
                stav = "ok"

            vysledky[sez] = {
                "index": index, "stav": stav,
                "zlozky": {"A": a, "B": b, "C": c, "D": d, "E": e},
                "detaily": {
                    "skupiny": obsadene, "deti": deti, "druzstvaMladez": druzstiev_ml,
                    "sezonPoSebe": kontinuita(sezony, sezony_data, sez),
                    "podielMladych": round(podiel, 4) if podiel is not None else None,
                    "zapisovDospeli": zapisov,
                },
            }

        if not vysledky:
            continue

        out_dir.mkdir(parents=True, exist_ok=True)
        with open(out_dir / (slug + ".json"), "w", encoding="utf-8") as f:
            json.dump({
                "klub": slug,
                "nazov": nazov,
                "generatedAt": teraz(),
                "methodologyFlags": {"metodika": METODIKA},
                "sezony": vysledky,
            }, f, ensure_ascii=False, separators=(",", ":"))
        spracovanych += 1

        # Do celoslovenskeho prehladu ide JEDNA konkretna sezona, nie posledna
        # dostupna pre dany klub — inak by tam zanikle kluby figurovali so svojou
        # poslednou (davno starou) sezonou a rozbehnuta sezona by ukazovala nuly,
        # lebo mladeznicke sutaze sa este nezacali (zistene pri plnom behu 7. 8. 2026:
        # dalo to 46 % klubov "bez mladeze" namiesto skutocnych ~18 %).
        v = vysledky.get(args.sezona_prehladu)
        if v:
            prehlad.append({
                "klub": slug, "nazov": nazov, "sezona": args.sezona_prehladu,
                "index": v["index"], "stav": v["stav"],
                "zlozky": v["zlozky"], "detaily": v["detaily"],
            })

    prehlad.sort(key=lambda r: (-r["index"], r["nazov"] or r["klub"]))
    with open(data / "index-klubu.json", "w", encoding="utf-8") as f:
        json.dump({
            "generatedAt": teraz(),
            "sezona": args.sezona_prehladu,
            "pocetKlubov": len(prehlad),
            "methodologyFlags": {"metodika": METODIKA},
            "kluby": prehlad,
        }, f, ensure_ascii=False, separators=(",", ":"))

    log.info("OK — index spocitany pre %d klubov", spracovanych)
    if prehlad:
        naj = prehlad[0]
        log.info("   najvyssi index: %s = %d", naj["nazov"] or naj["klub"], naj["index"])
        bez = sum(1 for r in prehlad if r["stav"] == "bez-mladeze")
        log.info("   klubov bez mladeze: %d (%.1f %%)", bez, 100 * bez / len(prehlad))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
