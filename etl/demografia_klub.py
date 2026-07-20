#!/usr/bin/env python3
"""ETL demografia klubu — rok narodenia x pohlavie x rola (hraci/treneri/realizacnyTim)
za KLUB a sezonu (#37 klubovy plan).

Analogia etl/demografia.py (zvaz), ale klub sa neurcuje cez appSpace/riadiaci zvaz —
klub hrava naprieс vsetkymi sutazami/zvazmi (rovnaky princip ako etl/kluby.py). Preto
sa robi jeden plny sken db.matches za sezonu (nie agregacna pipeline per appSpace) a
priebezne sa zbieraju pidy hracov/trenerov/realizacneho timu per klub (teams.organization._id).
Demografia (rok narodenia, pohlavie) sa dorata z sportnet.users v jednej davkovej faze
za VSETKY kluby danej sezony naraz (rovnaky pristup ako demografia.py).

Rozhodcovia/delegati/personal NIE su klubovi (rovnako ako v etl/kluby.py) — preto sa
tu nepocitaju.

GDPR: iba agregovane pocty (rok x pohlavie), ziadne menne zoznamy.

Vystup: data/demografia-klub/{klubId}.json — jeden subor per klub, sezony sa MERGUJU
(rovnaky princip ako etl/demografia.py), takze opakovane bеhy po sezonach sa kumuluju.

Pouzitie:
    export MONGODB_URI="mongodb+srv://..."
    export SSL_CERT_FILE=$(python -c 'import certifi; print(certifi.where())')
    python etl/demografia_klub.py --sezona 2025/2026
    python etl/demografia_klub.py --sezony 2021/2022,2022/2023,2023/2024,2024/2025,2025/2026,2026/2027
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

from bson import ObjectId
from bson.errors import InvalidId

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"

log = logging.getLogger("demografia_klub")

USERS_CHUNK = 5_000
ROLY_PORADIE = ["hraci", "treneri", "realizacnyTim"]


def load_json(p: Path) -> dict:
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def sezona_varianty(sezony: dict, kanon: str) -> list[str]:
    return [kanon] + [v for v, k in sezony["varianty"].items() if k == kanon]


def klub_id_slug(org_id: str) -> str:
    """issf_club_12858 -> klub-12858 (rovnaky slug ako etl/kluby.py)."""
    m = re.match(r"issf_club_(\d+)", org_id or "")
    return f"klub-{m.group(1)}" if m else re.sub(r"[^a-z0-9]+", "-", (org_id or "").lower()).strip("-")


def zbieraj_pidy(db, varianty: list[str], sport_sector: str, coach_positions: list[str]) -> dict[str, dict[str, set]]:
    """Jeden prechod cez matches danej sezony -> {org_id: {"hraci": set, "treneri": set, "realizacnyTim": set}}."""
    coach_set = set(coach_positions)
    cur = db.matches.find(
        {"closed": True, "season.name": {"$in": varianty}, "rules.sport_sector": sport_sector},
        {
            "teams._id": 1, "teams.organization._id": 1,
            "nominations.teamId": 1, "nominations.athletes.sportnetUser._id": 1,
            "nominations.crew.sportnetUser._id": 1, "nominations.crew.position": 1,
        },
        no_cursor_timeout=True,
    )
    kluby: dict[str, dict[str, set]] = {}
    for m in cur:
        tmap: dict[str, str] = {}
        for t in m.get("teams", []):
            org = (t.get("organization") or {})
            oid = org.get("_id")
            if not oid:
                continue
            tmap[str(t.get("_id"))] = oid
        for nom in m.get("nominations", []):
            tid = str(nom.get("teamId")) if nom.get("teamId") else None
            if not tid or tid not in tmap:
                continue
            oid = tmap[tid]
            k = kluby.setdefault(oid, {"hraci": set(), "treneri": set(), "realizacnyTim": set()})
            for a in (nom.get("athletes") or []):
                pid = ((a.get("sportnetUser") or {}).get("_id"))
                if pid:
                    k["hraci"].add(pid)
            for c in (nom.get("crew") or []):
                pid = ((c.get("sportnetUser") or {}).get("_id"))
                if not pid:
                    continue
                grp = "treneri" if c.get("position") in coach_set else "realizacnyTim"
                k[grp].add(pid)
    return kluby


def nacitaj_udaje_osob(users_col, pids: set) -> dict:
    """Mapa pid(str) -> {"rok": int|None, "sex": "M"/"F"/None} zo sportnet.users."""
    oids, mapa = [], {}
    for pid in pids:
        try:
            oids.append(ObjectId(pid))
        except (InvalidId, TypeError):
            continue
    oids = list(oids)
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


def agregat_role(pids: set, udaje: dict) -> dict:
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


def zapis_klub(klub_id: str, sport_sector: str, sezona_doc: dict, sezona: str, out_dir: Path) -> None:
    """Merge jednej sezony do data/demografia-klub/{klubId}.json (rovnaky princip ako demografia.py)."""
    cesta = out_dir / (klub_id + ".json")
    stare_sezony: dict[str, dict] = {}
    if cesta.exists():
        try:
            stare = load_json(cesta)
            if stare.get("sportSector", "futbal") == sport_sector:
                stare_sezony = dict(stare.get("sezony", {}))
        except Exception:
            pass
    stare_sezony[sezona] = sezona_doc
    doc = {
        "klub": klub_id,
        "sportSector": sport_sector,
        "generatedAt": teraz(),
        "methodologyFlags": {
            "zdroj": (
                "sportnet.users (birthdate, sex); osoby zo sutaze.matches "
                "(nominations, len closed:true, klub = teams.organization._id), "
                "roly z etl/config/roly.json"
            ),
            "poznamka": (
                "Vyhradne agregovane pocty (GDPR); bez prahu minimalnej velkosti. "
                "Rozhodcovia/delegati/personal nie su klubovi (rovnako ako KPI klubu). "
                "Osoba sa pocita raz na rolu a sezonu; tá istá osoba sa moze vyskytovat "
                "vo viacerych roliach aj sezonach. Kluc N = pohlavie nevyplnene."
            ),
        },
        "sezony": {s: stare_sezony[s] for s in sorted(stare_sezony)},
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    ap = argparse.ArgumentParser(description="ETL demografia klubu (statistika.futbalsfz.sk)")
    ap.add_argument("--sezona", default="2025/2026")
    ap.add_argument("--sezony", help="ciarkou oddeleny zoznam sezon")
    ap.add_argument("--vsetky", action="store_true", help="vsetky kanonicke sezony")
    ap.add_argument("--sport-sector", default="futbal")
    ap.add_argument("--mongodb-uri")
    ap.add_argument("--db", default="sutaze")
    ap.add_argument("--users-db", default="sportnet")
    ap.add_argument("--out", default=str(REPO / "data"))
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    from pymongo import MongoClient

    uri = args.mongodb_uri or os.environ.get("MONGODB_URI")
    client = MongoClient(uri)
    db = client[args.db]
    users_col = client[args.users_db]["users"]

    sezony_cfg = load_json(CONFIG / "sezony.json")
    roly = load_json(CONFIG / "roly.json")
    coach_positions = roly["treneriCrewPositions"]

    if args.vsetky:
        zoznam = list(sezony_cfg["kanonicke"])
    elif args.sezony:
        zoznam = [s.strip() for s in args.sezony.split(",") if s.strip()]
    else:
        zoznam = [args.sezona]

    out_dir = Path(args.out) / "demografia-klub"

    for sez in zoznam:
        varianty = sezona_varianty(sezony_cfg, sez)
        log.info("=== demografia klubov %s [%s] ===", sez, args.sport_sector)
        kluby_pidy = zbieraj_pidy(db, varianty, args.sport_sector, coach_positions)
        if not kluby_pidy:
            log.info("   %s: ziadne data", sez)
            continue
        vsetky_pidy: set = set()
        for k in kluby_pidy.values():
            for s in k.values():
                vsetky_pidy.update(s)
        udaje = nacitaj_udaje_osob(users_col, vsetky_pidy)
        zapisanych = 0
        for oid, role_sets in kluby_pidy.items():
            slug = klub_id_slug(oid)
            sezona_doc = {rola: agregat_role(role_sets[rola], udaje) for rola in ROLY_PORADIE if role_sets[rola]}
            if not sezona_doc:
                continue
            zapis_klub(slug, args.sport_sector, sezona_doc, sez, out_dir)
            zapisanych += 1
        log.info("   %s: %d klubov s demografiou (z %d celkovo najdenych)", sez, zapisanych, len(kluby_pidy))

    log.info("OK - demografia klubov hotova (spracovane: %s)", ", ".join(zoznam))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
