#!/usr/bin/env python3
"""ETL grassroots projekty (Dajme spolu gól, Disney, McDonald's krúžky).

Na rozdiel od súťaží NEmajú zápasy — podstatou je počet zapojených detí a škôl.
Dáta preto pochádzajú z `sutaze.competitions.parts[].teams[].squad.athletes[]`
(NIE z matches). Každé dieťa má v `additionalData` vek, pohlavie a názov školy.

Výstup: data/projekty/{projekt}.json + data/projekty/index.json.
Zdroj pravdy o projektoch: etl/config/zvazy.json → projekty.zoznam.

Metriky na projekt a sezónu:
- deti      — počet athletes v súpiskách,
- skoly     — počet unikátnych škôl (orgProfileName z detí; fallback teams.organization.name),
- timy      — počet družstiev/skupín (parts[].teams[]),
- pohlavie  — {M, F, N} počty detí,
- vek       — {vek: {M, F, N}} rozdelenie detí (na vekovú pyramídu).

Použitie:
    export MONGODB_URI="mongodb+srv://…"
    python etl/projekty.py                 # všetky projekty z configu
    python etl/projekty.py --projekt disney
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

log = logging.getLogger("projekty")


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def pripoj_db(uri: str | None, db_name: str = "sutaze"):
    from pymongo import MongoClient

    uri = uri or os.environ.get("MONGODB_URI")
    if not uri:
        raise SystemExit("Chýba MONGODB_URI.")
    return MongoClient(uri)[db_name]


def _gender(g) -> str:
    return g if g in ("M", "F") else "N"


def vygeneruj_projekt(db, proj: dict) -> dict:
    """Agregácia jedného projektu cez competitions (bez matchov)."""
    app = proj["appSpace"]
    vynechat = set(proj.get("vynechatSezony", []))
    cur = db.competitions.find(
        {"appSpace": app},
        {"season.name": 1, "parts.teams.organization.name": 1,
         "parts.teams.squad.athletes.additionalData": 1},
    )
    sezony: dict[str, dict] = {}
    for c in cur:
        sezona = (c.get("season") or {}).get("name")
        if not sezona or sezona in vynechat:
            continue
        s = sezony.setdefault(
            sezona,
            {"deti": 0, "timy": 0, "skoly": set(), "skolyTeam": set(),
             "pohlavie": {"M": 0, "F": 0, "N": 0}, "vek": {}},
        )
        for part in c.get("parts", []):
            for team in part.get("teams", []):
                s["timy"] += 1
                org = (team.get("organization") or {}).get("name")
                if org:
                    s["skolyTeam"].add(org)
                for a in (team.get("squad") or {}).get("athletes", []):
                    ad = a.get("additionalData") or {}
                    s["deti"] += 1
                    g = _gender(ad.get("gender"))
                    s["pohlavie"][g] += 1
                    if ad.get("orgProfileName"):
                        s["skoly"].add(ad["orgProfileName"])
                    vek = ad.get("age")
                    if isinstance(vek, int):
                        s["vek"].setdefault(str(vek), {"M": 0, "F": 0, "N": 0})[g] += 1

    out = {}
    for sezona, s in sezony.items():
        # školy: primárne z detí (orgProfileName), fallback na organizácie tímov
        skoly = len(s["skoly"]) or len(s["skolyTeam"])
        out[sezona] = {
            "deti": s["deti"],
            "skoly": skoly,
            "timy": s["timy"],
            "pohlavie": s["pohlavie"],
            "vek": {k: s["vek"][k] for k in sorted(s["vek"], key=lambda x: int(x))},
        }
    return {
        "projekt": proj["id"],
        "nazov": proj["nazov"],
        "popis": proj.get("popis", ""),
        "generatedAt": teraz(),
        "methodologyFlags": {
            "zdroj": "sutaze.competitions.parts[].teams[].squad.athletes[] (nie matches)",
            "poznamka": (
                "Deti = počet athletes v súpiskách; školy = unikátne školy (orgProfileName), "
                "fallback organizácie tímov; tímy = počet družstiev/skupín. Bez zápasov."
            ),
        },
        "sezony": {s: out[s] for s in sorted(out)},
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--projekt", help="id projektu (default: všetky z configu)")
    ap.add_argument("--mongodb-uri")
    ap.add_argument("--out", default=str(REPO / "data"))
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    zvazy = load_json(CONFIG / "zvazy.json")
    zoznam = zvazy["projekty"]["zoznam"]
    if args.projekt:
        zoznam = [p for p in zoznam if p["id"] == args.projekt]
        if not zoznam:
            raise SystemExit(f"Projekt {args.projekt!r} nie je v configu.")

    db = pripoj_db(args.mongodb_uri)
    out_dir = Path(args.out) / "projekty"
    out_dir.mkdir(parents=True, exist_ok=True)

    index = []
    for proj in zoznam:
        doc = vygeneruj_projekt(db, proj)
        # publikuj len projekty, ktoré majú aspoň jednu sezónu s dátami
        sezony_s_datami = [s for s, v in doc["sezony"].items() if v["deti"] or v["timy"]]
        if not sezony_s_datami:
            log.info("%s: žiadne dáta — preskakujem.", proj["id"])
            continue
        with open(out_dir / f"{proj['id']}.json", "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1)
        posledna = sorted(doc["sezony"])[-1]
        index.append({
            "id": proj["id"],
            "nazov": proj["nazov"],
            "popis": proj.get("popis", ""),
            "sezony": sorted(doc["sezony"]),
            "poslednaDeti": doc["sezony"][posledna]["deti"],
        })
        log.info("OK %s — %d sezón, posledná %s: %d detí",
                 proj["id"], len(doc["sezony"]), posledna, doc["sezony"][posledna]["deti"])

    with open(out_dir / "index.json", "w", encoding="utf-8") as f:
        json.dump({"generatedAt": teraz(), "projekty": index}, f, ensure_ascii=False, indent=1)
    log.info("OK index — %d projektov", len(index))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
