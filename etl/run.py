#!/usr/bin/env python3
"""ETL statistika.futbalsfz.sk — generovanie profilu zväzu za sezónu.

Pre zadaný zväz (id z etl/config/zvazy.json) a sezónu vygeneruje
data/zvaz/{id}/{sezona}.json presne podľa schémy vzoriek a aktualizuje
data/index.json.

Použitie:
    export MONGODB_URI="mongodb://..."
    python etl/run.py --zvaz obfz-nitra --sezona 2025/2026
    python etl/run.py --zvaz obfz-nitra --all-sezony
    python etl/run.py --zvaz zsfz --sezona 2025/2026 --out data

Zdroj: MongoDB `sutaze`, kolekcia `matches`. Záväzné pravidlá: docs/metodika.md.
Pipelines verifikované proti vzorkám ObFZ Nitra 12. 7. 2026 (100 % zhoda).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"

sys.path.insert(0, str(REPO / "etl"))
import pipelines  # noqa: E402
import validate  # noqa: E402

log = logging.getLogger("etl")

MAX_TIME_MS = 120_000  # limit agregácie; po jednej sezóne (viac sezón naraz timeoutuje)
RETRIES = 1  # metodika: občasný timeout → 1 retry
FUTSAL_APP_SPACE = "futsalslovakia.sk"  # futsal patrí priamo pod SFZ (rozhodnutie 12. 7. 2026)


# ---------------------------------------------------------------- konfigurácia

def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def najdi_zvaz(zvazy: dict, zvaz_id: str) -> dict:
    """Nájde zväz v registri (sfz/rfz/obfz). appSpace sa NIKDY neháda."""
    for uroven in ("sfz", "rfz", "obfz"):
        for z in zvazy.get(uroven, []):
            if z["id"] == zvaz_id:
                return z
    raise SystemExit(f"Zväz {zvaz_id!r} nie je v registri etl/config/zvazy.json.")


def app_spaces(zvaz: dict) -> list[str]:
    """Zoznam appSpace zväzu (SFZ má dva: futbalsfz.sk + ulk.futbalnet.sk)."""
    return zvaz.get("appSpaces") or [zvaz["appSpace"]]


def sezona_varianty(sezony: dict, kanonicka: str) -> list[str]:
    """Kanonická sezóna + všetky známe varianty zápisu season.name."""
    if kanonicka not in sezony["kanonicke"]:
        raise SystemExit(f"Sezóna {kanonicka!r} nie je v kanonickom zozname etl/config/sezony.json.")
    return [kanonicka] + [v for v, k in sezony["varianty"].items() if k == kanonicka]


# ---------------------------------------------------------------- MongoDB

def pripoj_db(uri: str | None, db_name: str):
    from pymongo import MongoClient

    uri = uri or os.environ.get("MONGODB_URI")
    if not uri:
        raise SystemExit("Chýba connection string: nastav MONGODB_URI alebo použi --mongodb-uri.")
    return MongoClient(uri)[db_name]


def nacitaj_part_mapu(db, spaces: list[str], varianty: list[str]) -> dict:
    """Mapa partId(str) → {"cat": veková kategória, "gender": pohlavie} z competitions.parts[].rules.

    Kategória: fallback pre historické sezóny (teams.ageCategory je vyplnené len
    od 2024/2025; časti súťaží majú kategóriu od 2013/2014, 96,5–100 %).
    Pohlavie: zápas ho priamo nenesie — JEDINÝ zdroj je časť súťaže
    (rules.gender „M“/„F“; prázdne/chýbajúce → None → skupina NEURCENE).
    Zmiešané časti v riadnych súťažiach neexistujú (overené 12. 7. 2026).
    """
    app = spaces[0] if len(spaces) == 1 else {"$in": spaces}
    cur = db.competitions.find(
        {"appSpace": app, "season.name": {"$in": varianty}},
        {"parts._id": 1, "parts.rules.category": 1, "parts.rules.gender": 1},
    )
    mapa = {}
    for c in cur:
        for p in c.get("parts", []):
            rules = p.get("rules") or {}
            cat = rules.get("category")
            gender = rules.get("gender") or None  # "" → None (NEURCENE)
            # WUxx → Uxx: „W“ je len označenie ženskej súťaže v názve kategórie,
            # veková úroveň je Uxx a pohlavie nesie rules.gender (13. 7. 2026).
            if cat and cat.startswith("WU"):
                cat = cat[1:]
            if cat or gender:
                mapa[str(p["_id"])] = {"cat": cat, "gender": gender}
    return mapa


def agreguj(db, pipeline: list[dict], popis: str) -> list[dict]:
    """Agregácia s retry (MCP/Atlas občas timeoutne) a diskovým spillom."""
    for pokus in range(RETRIES + 1):
        try:
            return list(
                db.matches.aggregate(pipeline, allowDiskUse=True, maxTimeMS=MAX_TIME_MS)
            )
        except Exception as e:  # noqa: BLE001 — retry na akýkoľvek transport/timeout
            if pokus < RETRIES:
                log.warning("%s: pokus %d zlyhal (%s) — retry…", popis, pokus + 1, e)
            else:
                raise
    return []  # nedosiahnuteľné


# ---------------------------------------------------------------- skladanie výstupu

def _facet_osoby(vysledok: list[dict], rola_kluc: str | None = None) -> dict:
    """Prevod $facet výsledku (poKategorii + unikatni) na {unikatni, poKategorii}."""
    facet = vysledok[0] if vysledok else {"poKategorii": [], "unikatni": []}
    if rola_kluc is None:
        po_kat = {r["_id"]: r["n"] for r in facet["poKategorii"] if r["_id"]}
        unik = facet["unikatni"][0]["n"] if facet["unikatni"] else 0
        return {"unikatni": unik, "poKategorii": validate.zorad_kategorie(po_kat)}
    # rozhodcovia/delegáti/personál: facet obsahuje všetky roly naraz;
    # záznamy bez kategórie (null) sa do poKategorii nepočítajú, unikáty áno
    po_kat = {
        r["_id"]["cat"]: r["n"]
        for r in facet["poKategorii"]
        if r["_id"]["rola"] == rola_kluc and r["_id"].get("cat")
    }
    unik = next((r["n"] for r in facet["unikatni"] if r["_id"] == rola_kluc), 0)
    return {"unikatni": unik, "poKategorii": validate.zorad_kategorie(po_kat)}


def _gender_kluc(g) -> str:
    """Kľúč skupiny pohlavia vo výstupe: M/F, všetko ostatné (None/„“) → NEURCENE."""
    return g if g in ("M", "F") else "NEURCENE"


def _zloz_pohlavie(kat_g_raw: list[dict], druz_g_raw: list[dict]) -> dict:
    """Blok `pohlavie` — per pohlavie súhrn (ako KPI) + kategórie (rozhodnutie O6, 12. 7. 2026)."""
    druz = {
        (_gender_kluc(r["_id"].get("gender")), r["_id"].get("cat")): r["druzstva"]
        for r in druz_g_raw
    }
    bloky: dict[str, dict] = {}
    for r in kat_g_raw:
        g = _gender_kluc(r["_id"].get("gender"))
        cat = r["_id"].get("cat") or "NEZNAMA"
        blok = bloky.setdefault(g, {})
        blok[cat] = {
            "zapasy": r["zapasy"],
            "druzstva": druz.get((g, r["_id"].get("cat")), 0),
            "goly": r["goly"],
            "zlte": r["zlte"],
            "cervene": r["cervene"],
            "divaci": r["divaci"],
            "divaciPokrytych": r["divaciPokrytych"],
        }
    vysledok = {}
    for g in validate.POHLAVIE_PORADIE:
        if g not in bloky:
            continue
        kat = validate.zorad_kategorie(bloky[g])
        vysledok[g] = {
            "zapasy": sum(k["zapasy"] for k in kat.values()),
            "druzstva": sum(k["druzstva"] for k in kat.values()),
            "goly": sum(k["goly"] for k in kat.values()),
            "divaci": sum(k["divaci"] for k in kat.values()),
            "zlteKarty": sum(k["zlte"] for k in kat.values()),
            "cerveneKarty": sum(k["cervene"] for k in kat.values()),
            "kategorie": kat,
        }
    return vysledok


def vygeneruj(
    db, zvaz: dict, sezona: str, varianty: list[str], roly: dict, sport_sector: str = "futbal"
) -> dict | None:
    """Zloží výstupný dokument zväz+sezóna+odvetvie. None, ak nie sú uzavreté zápasy."""
    spaces = (
        [FUTSAL_APP_SPACE] if sport_sector == "futsal" else app_spaces(zvaz)
    )  # futsal patrí pod SFZ, ale žije na vlastnom appSpace
    part_map = nacitaj_part_mapu(db, spaces, varianty)

    kat_raw = agreguj(
        db, pipelines.kategorie(spaces, varianty, sport_sector, part_map), "kategorie"
    )
    if not kat_raw:
        return None
    druz_raw = agreguj(
        db, pipelines.druzstva(spaces, varianty, sport_sector, part_map), "druzstva"
    )
    hraci_raw = agreguj(db, pipelines.hraci(spaces, varianty, sport_sector, part_map), "hraci")
    treneri_raw = agreguj(
        db,
        pipelines.treneri(spaces, varianty, roly["treneriCrewPositions"], sport_sector, part_map),
        "treneri",
    )
    rd_raw = agreguj(
        db,
        pipelines.osoby_managers(
            spaces, varianty, roly["rozhodcovia"], roly["delegati"], roly["personal"],
            sport_sector, part_map,
        ),
        "osoby-managers",
    )
    kat_g_raw = agreguj(
        db,
        pipelines.kategorie_pohlavie(spaces, varianty, sport_sector, part_map),
        "kategorie-pohlavie",
    )
    druz_g_raw = agreguj(
        db,
        pipelines.druzstva_pohlavie(spaces, varianty, sport_sector, part_map),
        "druzstva-pohlavie",
    )

    druz = {r["_id"]: r["druzstva"] for r in druz_raw}
    kategorie = {}
    for r in kat_raw:
        cat = r["_id"] if r["_id"] else "NEZNAMA"
        kategorie[cat] = {
            "zapasy": r["zapasy"],
            "druzstva": druz.get(r["_id"], 0),
            "goly": r["goly"],
            "zlte": r["zlte"],
            "cervene": r["cervene"],
            "divaci": r["divaci"],
            "divaciPokrytych": r["divaciPokrytych"],
        }
    kategorie = validate.zorad_kategorie(kategorie)

    zapasy = sum(k["zapasy"] for k in kategorie.values())
    pokrytych = sum(k["divaciPokrytych"] for k in kategorie.values())

    doc = {
        "zvaz": zvaz["id"],
        "sezona": sezona,
        "sportSector": sport_sector,
        "generatedAt": datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds"),
        "methodologyFlags": {
            "zapasy": "len closed:true",
            "divaciPokrytie": round(pokrytych / zapasy, 3) if zapasy else 0.0,
            "osobyPoznamka": (
                "Súčet osôb po kategóriách prevyšuje počet unikátnych osôb "
                "(viacnásobné pôsobenie)."
            ),
            "pohlaviePoznamka": (
                "Pohlavie z competitions.parts[].rules.gender cez competitionPart._id; "
                "NEURCENE = časť bez vyplneného pohlavia. KPI a kategorie zostávajú "
                "súčtom všetkých pohlaví. Organizácia s mužským aj ženským družstvom "
                "sa v družstvách počíta v oboch pohlaviach."
            ),
        },
        "kpi": {
            "zapasy": zapasy,
            "druzstva": sum(k["druzstva"] for k in kategorie.values()),
            "goly": sum(k["goly"] for k in kategorie.values()),
            "divaci": sum(k["divaci"] for k in kategorie.values()),
            "zlteKarty": sum(k["zlte"] for k in kategorie.values()),
            "cerveneKarty": sum(k["cervene"] for k in kategorie.values()),
        },
        "kategorie": kategorie,
        "pohlavie": _zloz_pohlavie(kat_g_raw, druz_g_raw),
        "osoby": {
            "hraci": _facet_osoby(hraci_raw),
            "treneri": _facet_osoby(treneri_raw),
            "rozhodcovia": _facet_osoby(rd_raw, "rozhodcovia"),
            "delegati": _facet_osoby(rd_raw, "delegati"),
            "personal": _facet_osoby(rd_raw, "personal"),
        },
    }
    return doc


# ---------------------------------------------------------------- zápis + index

def zapis(doc: dict, out_dir: Path) -> Path:
    nazov = doc["sezona"].replace("/", "-")
    if doc.get("sportSector", "futbal") != "futbal":
        nazov += "-" + doc["sportSector"]  # napr. 2025-2026-futsal.json
    cesta = out_dir / "zvaz" / doc["zvaz"] / (nazov + ".json")
    cesta.parent.mkdir(parents=True, exist_ok=True)
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return cesta


def aktualizuj_index(out_dir: Path, zvaz: dict, zvazy: dict) -> None:
    """Upsert zväzu v data/index.json; sezóny podľa reálne existujúcich súborov."""
    index_path = out_dir / "index.json"
    index = load_json(index_path) if index_path.exists() else {"zvazy": []}

    import re

    # do zoznamu sezón idú len futbalové súbory (RRRR-RRRR.json); odvetvia
    # s príponou (napr. 2025-2026-futsal.json) sa evidujú samostatne neskôr
    subory = sorted((out_dir / "zvaz" / zvaz["id"]).glob("*.json"))
    sezony = [
        p.stem.replace("-", "/") for p in subory if re.fullmatch(r"\d{4}-\d{4}", p.stem)
    ]

    zaznam = {"id": zvaz["id"], "nazov": zvaz["nazov"], "uroven": zvaz.get("uroven", "ObFZ")}
    if zvaz.get("rfz"):
        rfz = next(r for r in zvazy["rfz"] if r["id"] == zvaz["rfz"])
        zaznam["rfz"] = rfz["appSpace"]  # zobrazovaná skratka: BFZ/ZsFZ/SsFZ/VsFZ
    zaznam["appSpace"] = ", ".join(app_spaces(zvaz))
    zaznam["sezony"] = sezony

    index["generatedAt"] = datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")
    index.pop("note", None)
    index["zvazy"] = [z for z in index["zvazy"] if z["id"] != zvaz["id"]] + [zaznam]
    index["zvazy"].sort(key=lambda z: z["id"])

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description="ETL profilu zväzu (statistika.futbalsfz.sk)")
    ap.add_argument("--zvaz", required=True, help="id zväzu z etl/config/zvazy.json (napr. obfz-nitra)")
    grp = ap.add_mutually_exclusive_group(required=True)
    grp.add_argument("--sezona", help="kanonická sezóna, napr. 2025/2026")
    grp.add_argument("--all-sezony", action="store_true", help="všetky kanonické sezóny s dátami")
    ap.add_argument(
        "--sport-sector",
        default="futbal",
        help="športové odvetvie (číselník etl/config/sporty.json; default: futbal)",
    )
    ap.add_argument("--mongodb-uri", help="connection string (default: env MONGODB_URI)")
    ap.add_argument("--db", default="sutaze", help="názov databázy (default: sutaze)")
    ap.add_argument("--out", default=str(REPO / "data"), help="výstupný priečinok (default: data/)")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    zvazy = load_json(CONFIG / "zvazy.json")
    sezony_cfg = load_json(CONFIG / "sezony.json")
    roly = load_json(CONFIG / "roly.json")
    sporty = load_json(CONFIG / "sporty.json")
    zvaz = najdi_zvaz(zvazy, args.zvaz)
    out_dir = Path(args.out)

    odvetvia = [o["value"] for o in sporty["odvetviaFutbalu"]]
    if args.sport_sector not in odvetvia:
        raise SystemExit(f"Odvetvie {args.sport_sector!r} nie je v číselníku {odvetvia}.")
    if args.sport_sector == "futsal" and zvaz["id"] != "sfz":
        raise SystemExit("Futsal patrí priamo pod SFZ — použi --zvaz sfz.")

    db = pripoj_db(args.mongodb_uri, args.db)

    sezony = sezony_cfg["kanonicke"] if args.all_sezony else [args.sezona]
    chyby = 0
    for sezona in sezony:
        varianty = sezona_varianty(sezony_cfg, sezona)
        log.info(
            "=== %s %s [%s] (appSpace: %s) ===",
            zvaz["nazov"], sezona, args.sport_sector,
            FUTSAL_APP_SPACE if args.sport_sector == "futsal" else ", ".join(app_spaces(zvaz)),
        )
        doc = vygeneruj(db, zvaz, sezona, varianty, roly, args.sport_sector)
        if doc is None:
            log.info("%s: žiadne uzavreté zápasy — preskakujem.", sezona)
            continue

        anomalie = validate.validuj(doc)
        for a in anomalie:
            log.warning("ANOMÁLIA %s/%s: %s", zvaz["id"], sezona, a)
        chyby += sum(1 for a in anomalie if "≠" in a or "neznáma" in a)

        cesta = zapis(doc, out_dir)
        log.info(
            "OK %s — zápasy %d, družstvá %d, góly %d, hráči %d",
            cesta.relative_to(REPO) if cesta.is_relative_to(REPO) else cesta,
            doc["kpi"]["zapasy"],
            doc["kpi"]["druzstva"],
            doc["kpi"]["goly"],
            doc["osoby"]["hraci"]["unikatni"],
        )

    if args.sport_sector == "futbal":
        aktualizuj_index(out_dir, zvaz, zvazy)
        log.info("index.json aktualizovaný.")
    else:
        log.info("index.json bez zmeny (odvetvie %s sa eviduje samostatne).", args.sport_sector)
    return 1 if chyby else 0


if __name__ == "__main__":
    sys.exit(main())
