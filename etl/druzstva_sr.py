#!/usr/bin/env python3
"""ETL družstvá SR — UNIKÁTNE družstvá za celé Slovensko.

PROBLÉM. `kpi.druzstva` v data/sumar/{sezona}.json je súčet zväzových počtov, takže
družstvo klubu, ktoré hralo súťaže dvoch zväzov (typicky mládež v oblastnej aj
regionálnej súťaži), je v celoslovenskom čísle dvakrát. Je to tá istá chyba, akú mali
osoby — viď `etl/demografia.py --zvaz sr` a kapitolu OSOBY v docs/metodika.md.

RIEŠENIE. Všetky appSpace idú do JEDNEJ agregácie, takže dvojica
(veková kategória, klub) sa zjednotí cez celé Slovensko a je započítaná RAZ.
Družstvo = unikátna dvojica (veková kategória, organization.name) s aspoň jedným
uzavretým zápasom — rovnaká definícia ako v `pipelines.druzstva`, aby čísla sedeli
na zväzové profily.

Futbal a futsal sa počítajú ODDELENE: futsalové družstvo klubu je iné družstvo než
jeho futbalové, takže sa sčítavajú (rovnako ako na úvodnej stránke).

Výstup: data/sumar/druzstva.json — číta ho `etl/sumar.py` a prepíše ním `kpi.druzstva`
aj rozpad po vekových kategóriách; pôvodný súčet zostáva v `kpi.druzstvaSucetZvazov`.

Použitie:
    export MONGODB_URI="mongodb+srv://…"
    python etl/druzstva_sr.py --sezona 2025/2026
    python etl/druzstva_sr.py --all-sezony
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"
sys.path.insert(0, str(REPO / "etl"))

import pipelines  # noqa: E402
from run import (  # noqa: E402
    FUTSAL_APP_SPACE,
    MAX_TIME_MS,
    RETRIES,
    app_spaces,
    load_json,
    nacitaj_part_mapu,
    sezona_varianty,
)

log = logging.getLogger("druzstva-sr")
_MAXT = MAX_TIME_MS


def pripoj_klienta(uri: str | None):
    from pymongo import MongoClient

    uri = uri or os.environ.get("MONGODB_URI")
    if not uri:
        raise SystemExit("Chýba MONGODB_URI (env alebo --mongodb-uri).")
    return MongoClient(uri, serverSelectionTimeoutMS=20_000)


def agreguj(db, pipeline: list[dict], popis: str) -> list[dict]:
    """Agregácia s retry — Atlas pri celoslovenskom zábere občas timeoutne."""
    for pokus in range(RETRIES + 1):
        try:
            return list(db.matches.aggregate(pipeline, allowDiskUse=True, maxTimeMS=_MAXT))
        except Exception as e:  # noqa: BLE001
            if pokus < RETRIES:
                log.warning("%s: pokus %d zlyhal (%s) — retry…", popis, pokus + 1, e)
            else:
                raise
    return []


def pary_druzstiev(spaces: list[str], varianty: list[str], sport_sector: str, part_map: dict):
    """Unikátne dvojice (veková kategória, klub). Rovnaká logika ako pipelines.druzstva,
    len bez záverečného počítania — páry potrebujeme zjednotiť v Pythone."""
    return [
        pipelines._match_stage(spaces, varianty, sport_sector),
        {
            "$project": {
                "teams": 1,
                "catFb": pipelines.cat_fallback_expr(part_map) or {"$literal": None},
            }
        },
        {"$unwind": "$teams"},
        {
            "$group": {
                "_id": {
                    "cat": {"$ifNull": ["$teams.ageCategory", "$catFb"]},
                    "org": "$teams.organization.name",
                }
            }
        },
    ]


def sezona_sr(db, spaces: list[str], varianty: list[str], sport_sector: str) -> dict | None:
    part_map = nacitaj_part_mapu(db, spaces, varianty)
    pary: set[tuple[str | None, str | None]] = set()
    for r in agreguj(db, pary_druzstiev(spaces, varianty, sport_sector, part_map), f"druzstva [{sport_sector}]"):
        k = r["_id"] or {}
        if k.get("org"):
            pary.add((k.get("cat"), k["org"]))
    if not pary:
        return None
    po_kat: dict[str, int] = {}
    for cat, _org in pary:
        kluc = cat or "NEZNAMA"
        po_kat[kluc] = po_kat.get(kluc, 0) + 1
    return {"druzstva": len(pary), "poKategoriach": {k: po_kat[k] for k in sorted(po_kat)}}


def main() -> int:
    ap = argparse.ArgumentParser(description="Unikátne družstvá za SR (statistika.futbalsfz.sk)")
    grp = ap.add_mutually_exclusive_group(required=True)
    grp.add_argument("--sezona", help="kanonická sezóna, napr. 2025/2026")
    grp.add_argument("--all-sezony", action="store_true", help="všetky kanonické sezóny")
    ap.add_argument("--mongodb-uri", help="connection string (default: env MONGODB_URI)")
    ap.add_argument("--db", default="sutaze", help="DB zápasov (default: sutaze)")
    ap.add_argument("--out", default=str(REPO / "data"), help="výstupný priečinok (default: data/)")
    ap.add_argument("--max-time-ms", type=int, default=MAX_TIME_MS, help="limit agregácie v ms")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    global _MAXT
    _MAXT = args.max_time_ms

    zvazy = load_json(CONFIG / "zvazy.json")
    sezony_cfg = load_json(CONFIG / "sezony.json")

    futbal_spaces: list[str] = []
    for z in zvazy["sfz"] + zvazy["rfz"] + zvazy["obfz"]:
        for sp in app_spaces(z):
            if sp not in futbal_spaces:
                futbal_spaces.append(sp)
    log.info("SR: %d appSpace (futbal) + futsal", len(futbal_spaces))

    klient = pripoj_klienta(args.mongodb_uri)
    db = klient[args.db]

    sezony = sezony_cfg["kanonicke"] if args.all_sezony else [args.sezona]
    vysledky: dict[str, dict] = {}
    for sezona in sezony:
        varianty = sezona_varianty(sezony_cfg, sezona)
        log.info("=== družstvá SR %s ===", sezona)
        futbal = sezona_sr(db, futbal_spaces, varianty, "futbal")
        futsal = sezona_sr(db, [FUTSAL_APP_SPACE], varianty, "futsal")
        if not futbal and not futsal:
            log.info("%s: žiadne družstvá — preskakujem.", sezona)
            continue
        zapis = {}
        if futbal:
            zapis["futbal"] = futbal
        if futsal:
            zapis["futsal"] = futsal
        vysledky[sezona] = zapis
        log.info(
            "%s: futbal %s družstiev, futsal %s",
            sezona,
            futbal["druzstva"] if futbal else 0,
            futsal["druzstva"] if futsal else 0,
        )

    if not vysledky:
        log.info("Žiadne dáta — súbor sa negeneruje.")
        return 0

    cesta = Path(args.out) / "sumar" / "druzstva.json"
    if not args.all_sezony and cesta.exists():
        stare = load_json(cesta)
        zlucene = dict(stare.get("sezony", {}))
        zlucene.update(vysledky)
        vysledky = {s: zlucene[s] for s in sorted(zlucene)}
        log.info("Merge s existujúcim súborom (%d sezón spolu).", len(vysledky))

    doc = {
        "zvaz": "sr",
        "generatedAt": datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds"),
        "unikatne": True,
        "methodologyFlags": {
            "definicia": (
                "Družstvo = unikátna dvojica (veková kategória, klub) s aspoň jedným uzavretým "
                "zápasom; rovnaká definícia ako v pipelines.druzstva."
            ),
            "unikatne": (
                "UNIKÁTNE družstvá za celé Slovensko — družstvo hrajúce súťaže dvoch zväzov je "
                "započítané RAZ. NIE JE to súčet zväzových kpi.druzstva, ktorý takéto družstvo "
                "duplikuje. Futbal a futsal sa počítajú oddelene a sčítavajú sa."
            ),
        },
        "sezony": {s: vysledky[s] for s in sorted(vysledky)},
    }
    cesta.parent.mkdir(parents=True, exist_ok=True)
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
        f.write("\n")
    log.info("OK %s — sezón %d", cesta, len(vysledky))
    return 0


if __name__ == "__main__":
    sys.exit(main())
