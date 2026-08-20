#!/usr/bin/env python3
"""ETL demografia — agregáty rok narodenia × pohlavie × rola za zväz a sezónu.

Pre zadaný zväz vygeneruje data/demografia/{id}.json: pre každú sezónu
a rolu (hráči, tréneri, rozhodcovia, delegáti, personál) počty osôb
podľa roku narodenia × pohlavia.

Zdroj osôb: sutaze.matches (nominations + managers; roly výhradne
z etl/config/roly.json). Zdroj demografie: sportnet.users — polia
`birthdate` a `sex`, `_id` = sportnetId (ObjectId); join zo string id
v zápasoch cez bson.ObjectId (metodika, O7).

GDPR: publikujú sa výhradne agregované počty; bez prahu minimálnej
veľkosti agregátu (O5 — publicistická licencia, rozhodnutie 12. 7. 2026).

Použitie:
    export MONGODB_URI="mongodb://..."
    python etl/demografia.py --zvaz obfz-nitra --all-sezony
    python etl/demografia.py --zvaz sfz --sezona 2025/2026
    python etl/demografia.py --zvaz sr --sezona 2025/2026   # cele SR, unikatne osoby
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from bson import ObjectId
from bson.errors import InvalidId

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
    najdi_zvaz,
    sezona_varianty,
)

log = logging.getLogger("demografia")

USERS_CHUNK = 5_000  # veľkosť $in dávky pri čítaní sportnet.users
ROLY_PORADIE = ["hraci", "treneri", "rozhodcovia", "delegati", "personal"]
SR_ID = "sr"  # --zvaz sr: celoslovensky beh, UNIKATNE osoby cez vsetky zvazy aj odvetvia

_MAXT = MAX_TIME_MS  # limit agregácie (prepísateľný cez --max-time-ms)
_HINT = None  # voliteľný index hint (--hint) — do vzniku cieleného indexu (ADR-0004)


# ---------------------------------------------------------------- MongoDB

def pripoj_klienta(uri: str | None):
    from pymongo import MongoClient

    uri = uri or os.environ.get("MONGODB_URI")
    if not uri:
        raise SystemExit("Chýba connection string: nastav MONGODB_URI alebo použi --mongodb-uri.")
    return MongoClient(uri)


def agreguj(db, pipeline: list[dict], popis: str) -> list[dict]:
    """Agregácia s retry (rovnaké pravidlá ako run.py: 1 retry, disk spill)."""
    kwargs = {"allowDiskUse": True, "maxTimeMS": _MAXT}
    if _HINT:
        kwargs["hint"] = _HINT
    for pokus in range(RETRIES + 1):
        try:
            return list(db.matches.aggregate(pipeline, **kwargs))
        except Exception as e:  # noqa: BLE001
            if pokus < RETRIES:
                log.warning("%s: pokus %d zlyhal (%s) — retry…", popis, pokus + 1, e)
            else:
                raise
    return []  # nedosiahnuteľné


# ---------------------------------------------------------------- pipelines pids

def pids_hraci(spaces, varianty, sport_sector):
    return [
        pipelines._match_stage(spaces, varianty, sport_sector),
        {"$project": {"nominations.athletes.sportnetUser._id": 1}},
        {"$unwind": "$nominations"},
        {"$unwind": "$nominations.athletes"},
        {"$group": {"_id": "$nominations.athletes.sportnetUser._id"}},
    ]


def pids_treneri(spaces, varianty, coach_positions, sport_sector):
    return [
        pipelines._match_stage(spaces, varianty, sport_sector),
        {"$project": {"nominations.crew": 1}},
        {"$unwind": "$nominations"},
        {"$unwind": "$nominations.crew"},
        {"$match": {"nominations.crew.position": {"$in": coach_positions}}},
        {"$group": {"_id": "$nominations.crew.sportnetUser._id"}},
    ]


def pids_managers(spaces, varianty, rozhodca_labels, delegat_labels, personal_labels, sport_sector):
    """Rozhodcovia/delegáti/personál: vracia {_id: {rola, pid}}."""
    return [
        pipelines._match_stage(spaces, varianty, sport_sector),
        {"$project": {"managers": 1}},
        {"$unwind": "$managers"},
        {"$match": {"managers.type.label": {"$in": rozhodca_labels + delegat_labels + personal_labels}}},
        {
            "$group": {
                "_id": {
                    "pid": "$managers.user._id",
                    "rola": {
                        "$switch": {
                            "branches": [
                                {"case": {"$in": ["$managers.type.label", delegat_labels]}, "then": "delegati"},
                                {"case": {"$in": ["$managers.type.label", personal_labels]}, "then": "personal"},
                            ],
                            "default": "rozhodcovia",
                        }
                    },
                }
            }
        },
    ]


# ---------------------------------------------------------------- demografia

def nacitaj_udaje_osob(users_col, pids: set[str]) -> dict:
    """Mapa pid(str) → {"rok": int|None, "sex": "M"/"F"/None} zo sportnet.users."""
    oids, mapa = [], {}
    for pid in pids:
        try:
            oids.append(ObjectId(pid))
        except (InvalidId, TypeError):
            continue  # neplatné id — osoba zostane bez údajov
    for i in range(0, len(oids), USERS_CHUNK):
        cur = users_col.find(
            {"_id": {"$in": oids[i : i + USERS_CHUNK]}},
            {"birthdate": 1, "sex": 1},
        )
        for u in cur:
            rok = u["birthdate"].year if u.get("birthdate") else None
            sex = u.get("sex") or None
            mapa[str(u["_id"])] = {"rok": rok, "sex": sex}
    return mapa


def agregat_role(pids: set[str], udaje: dict) -> dict:
    """Agregát jednej roly: {osoby, sUdajmi, bezUdajov, roky: {rok: {M/F/N: n}}}."""
    roky: dict[str, dict[str, int]] = {}
    s_udajmi = 0
    for pid in pids:
        u = udaje.get(pid)
        if not u or u["rok"] is None:
            continue
        s_udajmi += 1
        sex = u["sex"] if u["sex"] in ("M", "F") else "N"
        rok = str(u["rok"])
        roky.setdefault(rok, {})
        roky[rok][sex] = roky[rok].get(sex, 0) + 1
    return {
        "osoby": len(pids),
        "sUdajmi": s_udajmi,
        "bezUdajov": len(pids) - s_udajmi,
        "roky": {r: dict(sorted(roky[r].items())) for r in sorted(roky)},
    }


def vygeneruj_sezonu(
    db_sutaze, users_col, zvaz, sezona, varianty, roly, sport_sector, spaces_map=None
) -> dict | None:
    """Agregáty všetkých rolí za jednu sezónu. None, ak sezóna nemá osoby.

    spaces_map = {sektor: [appSpace, ...]} — celoslovenský beh (--zvaz sr) posiela všetky
    appSpace naraz, takže osoba pôsobiaca vo viacerých zväzoch (typicky rozhodca alebo
    mládežnícky hráč v dvoch súťažiach) sa v set() zjednotí a je započítaná RAZ. Bez tohto
    parametra sa berie appSpace jedného zväzu, ako doteraz.
    """
    if spaces_map is None:
        spaces_map = {
            sport_sector: [FUTSAL_APP_SPACE] if sport_sector == "futsal" else app_spaces(zvaz)
        }

    pids_podla_roly: dict[str, set[str]] = {r: set() for r in ROLY_PORADIE}
    for sektor, spaces in spaces_map.items():
        for r in agreguj(db_sutaze, pids_hraci(spaces, varianty, sektor), f"pids-hraci [{sektor}]"):
            if r["_id"]:
                pids_podla_roly["hraci"].add(r["_id"])
        for r in agreguj(
            db_sutaze,
            pids_treneri(spaces, varianty, roly["treneriCrewPositions"], sektor),
            f"pids-treneri [{sektor}]",
        ):
            if r["_id"]:
                pids_podla_roly["treneri"].add(r["_id"])
        for r in agreguj(
            db_sutaze,
            pids_managers(
                spaces, varianty, roly["rozhodcovia"], roly["delegati"], roly["personal"], sektor
            ),
            f"pids-managers [{sektor}]",
        ):
            pid, rola = r["_id"].get("pid"), r["_id"].get("rola")
            if pid and rola:
                pids_podla_roly[rola].add(pid)

    vsetky = set().union(*pids_podla_roly.values())
    if not vsetky:
        return None
    udaje = nacitaj_udaje_osob(users_col, vsetky)

    return {rola: agregat_role(pids, udaje) for rola, pids in pids_podla_roly.items() if pids}


def zapis(doc: dict, out_dir: Path, cesta: Path | None = None) -> Path:
    cesta = cesta or out_dir / "demografia" / (doc["zvaz"] + ".json")
    cesta.parent.mkdir(parents=True, exist_ok=True)
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return cesta


# ---------------------------------------------------------------- main

def main() -> int:
    ap = argparse.ArgumentParser(description="ETL demografia (statistika.futbalsfz.sk)")
    ap.add_argument("--zvaz", required=True, help="id zväzu z etl/config/zvazy.json")
    grp = ap.add_mutually_exclusive_group(required=True)
    grp.add_argument("--sezona", help="kanonická sezóna, napr. 2025/2026")
    grp.add_argument("--all-sezony", action="store_true", help="všetky kanonické sezóny s dátami")
    ap.add_argument("--sport-sector", default="futbal", help="športové odvetvie (default: futbal)")
    ap.add_argument("--mongodb-uri", help="connection string (default: env MONGODB_URI)")
    ap.add_argument("--db", default="sutaze", help="DB zápasov (default: sutaze)")
    ap.add_argument("--users-db", default="sportnet", help="DB osôb (default: sportnet)")
    ap.add_argument("--out", default=str(REPO / "data"), help="výstupný priečinok (default: data/)")
    ap.add_argument("--max-time-ms", type=int, default=MAX_TIME_MS, help=f"limit agregácie v ms (default: {MAX_TIME_MS})")
    ap.add_argument("--hint", default=None, help="názov vynúteného indexu (dočasná pomôcka, ADR-0004)")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    global _MAXT, _HINT
    _MAXT = args.max_time_ms
    _HINT = args.hint

    zvazy = load_json(CONFIG / "zvazy.json")
    sezony_cfg = load_json(CONFIG / "sezony.json")
    roly = load_json(CONFIG / "roly.json")
    je_sr = args.zvaz == SR_ID
    if je_sr:
        # Cele Slovensko naraz: futbalove appSpace vsetkych 43 zvazov + futsal.
        vsetky_zvazy = zvazy["sfz"] + zvazy["rfz"] + zvazy["obfz"]
        futbal_spaces: list[str] = []
        for z in vsetky_zvazy:
            for sp in app_spaces(z):
                if sp not in futbal_spaces:
                    futbal_spaces.append(sp)
        spaces_map = {"futbal": futbal_spaces, "futsal": [FUTSAL_APP_SPACE]}
        zvaz = {"id": SR_ID, "nazov": "Slovensko (vsetky zvazy)"}
        log.info("SR rezim: %d appSpace (futbal) + futsal", len(futbal_spaces))
    else:
        spaces_map = None
        zvaz = najdi_zvaz(zvazy, args.zvaz)

    klient = pripoj_klienta(args.mongodb_uri)
    db_sutaze = klient[args.db]
    users_col = klient[args.users_db].users

    sezony = sezony_cfg["kanonicke"] if args.all_sezony else [args.sezona]
    vysledky = {}
    for sezona in sezony:
        varianty = sezona_varianty(sezony_cfg, sezona)
        log.info("=== demografia %s %s [%s] ===", zvaz["nazov"], sezona, args.sport_sector)
        sez = vygeneruj_sezonu(
            db_sutaze, users_col, zvaz, sezona, varianty, roly, args.sport_sector, spaces_map
        )
        if sez is None:
            log.info("%s: žiadne osoby — preskakujem.", sezona)
            continue
        vysledky[sezona] = sez
        for rola in ROLY_PORADIE:
            if rola in sez and sez[rola]["osoby"]:
                podiel = sez[rola]["bezUdajov"] / sez[rola]["osoby"]
                if podiel > 0.20:
                    log.warning(
                        "ANOMÁLIA %s/%s %s: %.0f%% osôb bez birthdate v sportnet.users",
                        zvaz["id"], sezona, rola, podiel * 100,
                    )

    if not vysledky:
        log.info("Žiadne dáta — súbor sa negeneruje.")
        return 0

    # Merge s existujúcim súborom: pri behu jednej sezóny (napr. denný cron
    # aktuálnej sezóny) sa ostatné sezóny zachovajú; --all-sezony regeneruje celý
    # súbor. Nová generácia sezóny má prednosť pred uloženou.
    cesta_vystup = (
        Path(args.out) / "sumar" / "demografia.json"
        if je_sr
        else Path(args.out) / "demografia" / (zvaz["id"] + ".json")
    )
    cesta_stara = cesta_vystup
    if not args.all_sezony and cesta_stara.exists():
        stare = load_json(cesta_stara)
        if je_sr or stare.get("sportSector") == args.sport_sector:
            zlucene = dict(stare.get("sezony", {}))
            zlucene.update(vysledky)
            vysledky = {s: zlucene[s] for s in sorted(zlucene)}
            log.info("Merge s existujúcim súborom (%d sezón spolu).", len(vysledky))

    doc = {
        "zvaz": zvaz["id"],
        "sportSector": "futbal+futsal" if je_sr else args.sport_sector,
        "unikatne": bool(je_sr),
        "generatedAt": datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds"),
        "methodologyFlags": {
            "zdroj": (
                "sportnet.users (birthdate, sex); osoby zo sutaze.matches "
                "(nominations + managers, len closed:true), roly z etl/config/roly.json"
            ),
            "poznamka": (
                "Výhradne agregované počty (GDPR); bez prahu minimálnej veľkosti (O5). "
                "Osoba sa počíta raz na rolu a sezónu; tá istá osoba sa môže vyskytovať "
                "vo viacerých rolách aj sezónach. Kľúč N = pohlavie nevyplnené."
            ),
        },
        "sezony": vysledky,
    }
    if je_sr:
        doc["methodologyFlags"]["unikatne"] = (
            "UNIKATNE osoby za cele Slovensko. Osoba sa pocita RAZ bez ohladu na to, v kolkych "
            "zvazoch, kluboch, sutaziach a odvetviach (futbal aj futsal) v sezone posobila. "
            "NIE JE to sucet zvazovych suborov data/demografia/{id}.json — ten istu osobu "
            "duplikuje v kazdom zvaze. V roliach sa osoba pocita zvlast (hrajuci trener je "
            "v Hracoch aj v Treneroch)."
        )
    cesta = zapis(doc, Path(args.out), cesta_vystup)
    log.info(
        "OK %s — sezón %d",
        cesta.relative_to(REPO) if cesta.is_relative_to(REPO) else cesta,
        len(vysledky),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
