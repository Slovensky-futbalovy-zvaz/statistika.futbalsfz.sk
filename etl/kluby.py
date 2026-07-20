#!/usr/bin/env python3
"""ETL klubové štatistiky — profil klubu za sezónu (COWORK_TASK_KLUBY).

Klub = teams[].organization._id (stabilné, napr. "issf_club_12858"). Agreguje
účinkovanie klubu naprieč všetkými súťažami (celé SR) v danej sezóne:
- zápasy, družstvá (jeho teams po kategóriách), góly/karty (protocol.events
  priradené teamu klubu), diváci (audience zápasov klubu),
- osoby: hráči (nominations.athletes klubu) a tréneri (crew klubu).
Zväz klubu = najčastejší riadiaci appSpace jeho zápasov (mapa z zvazy.json).

Rovnaké kľúče ako profil zväzu → znovupoužitie frontend komponentov.
GDPR: len agregáty (počty), žiadne menné zoznamy.

Použitie:
    export MONGODB_URI="mongodb+srv://…"
    export SSL_CERT_FILE=$(python -c 'import certifi; print(certifi.where())')
    python etl/kluby.py --sezona 2025/2026
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

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"
sys.path.insert(0, str(REPO / "etl"))
import validate  # noqa: E402

log = logging.getLogger("kluby")
GOAL, YELLOW, RED = "goal", "yellow_card", "red_card"


def load_json(p: Path) -> dict:
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def sezona_varianty(sezony: dict, kanon: str) -> list[str]:
    return [kanon] + [v for v, k in sezony["varianty"].items() if k == kanon]


def appspace_na_zvaz(zvazy: dict) -> dict:
    """Mapa riadiaci appSpace → {id, nazov, uroven}."""
    m = {}
    for uroven_key, uroven in (("sfz", "SFZ"), ("rfz", "RFZ"), ("obfz", "ObFZ")):
        for z in zvazy.get(uroven_key, []):
            for a in (z.get("appSpaces") or [z["appSpace"]]):
                m[a] = {"id": z["id"], "nazov": z["nazov"], "uroven": uroven}
    return m


def klub_id_slug(org_id: str) -> str:
    """issf_club_12858 → klub-12858 (pekný slug do URL)."""
    m = re.match(r"issf_club_(\d+)", org_id or "")
    return f"klub-{m.group(1)}" if m else re.sub(r"[^a-z0-9]+", "-", (org_id or "").lower()).strip("-")


def vygeneruj(db, sezona: str, varianty: list[str], sport_sector: str, zvazy: dict) -> tuple[dict, list]:
    as2z = appspace_na_zvaz(zvazy)
    cur = db.matches.find(
        {"closed": True, "season.name": {"$in": varianty}, "rules.sport_sector": sport_sector},
        {
            "appSpace": 1,
            "teams._id": 1, "teams.organization._id": 1, "teams.organization.name": 1, "teams.ageCategory": 1,
            "protocol.events.eventType": 1, "protocol.events.team": 1, "protocol.audience": 1,
            "nominations.teamId": 1, "nominations.athletes.sportnetUser._id": 1,
            "nominations.crew.sportnetUser._id": 1,
        },
        no_cursor_timeout=True,
    )

    # kluby[org_id] = akumulátor
    kluby: dict[str, dict] = {}

    def klub(org_id, nazov):
        k = kluby.get(org_id)
        if not k:
            k = kluby[org_id] = {
                "nazov": nazov, "appSpaceCount": {},
                "kat": {},  # cat → {zapasy,druzstva:set(teamId),goly,zlte,cervene,divaci,divaciPokrytych}
                "hraci": {"unik": set(), "kat": {}},   # cat → set(pid)
                "treneri": {"unik": set(), "kat": {}},
            }
        return k

    for m in cur:
        aps = m.get("appSpace")
        audience = (m.get("protocol") or {}).get("audience")
        # mapa teamId(str) → (org_id, nazov, cat)
        tmap = {}
        for t in m.get("teams", []):
            org = (t.get("organization") or {})
            oid = org.get("_id")
            if not oid:
                continue
            tid = str(t.get("_id"))
            cat = t.get("ageCategory") or "NEZNAMA"
            tmap[tid] = (oid, org.get("name"), cat)

        # zápas/družstvá/diváci per klub per kategória (klub v zápase raz per jeho team)
        klubTeamsInMatch: dict[str, set] = {}
        for tid, (oid, nazov, cat) in tmap.items():
            k = klub(oid, nazov)
            k["appSpaceCount"][aps] = k["appSpaceCount"].get(aps, 0) + 1
            kc = k["kat"].setdefault(cat, {"zapasy": 0, "druzstva": set(), "goly": 0, "zlte": 0, "cervene": 0, "divaci": 0, "divaciPokrytych": 0})
            kc["zapasy"] += 1
            kc["druzstva"].add(tid)
            if isinstance(audience, int) and 0 <= audience < 200000:
                kc["divaci"] += audience
                kc["divaciPokrytych"] += 1
            klubTeamsInMatch.setdefault(oid, set()).add(cat)

        # góly/karty z eventov priradené teamu
        for ev in ((m.get("protocol") or {}).get("events") or []):
            tid = str(ev.get("team")) if ev.get("team") else None
            if not tid or tid not in tmap:
                continue
            oid, _, cat = tmap[tid]
            kc = kluby[oid]["kat"][cat]
            et = ev.get("eventType")
            if et == GOAL:
                kc["goly"] += 1
            elif et == YELLOW:
                kc["zlte"] += 1
            elif et == RED:
                kc["cervene"] += 1

        # osoby: hráči + tréneri per klub per kategória
        for nom in m.get("nominations", []):
            tid = str(nom.get("teamId")) if nom.get("teamId") else None
            if not tid or tid not in tmap:
                continue
            oid, _, cat = tmap[tid]
            k = kluby[oid]
            for a in (nom.get("athletes") or []):
                pid = ((a.get("sportnetUser") or {}).get("_id"))
                if pid:
                    k["hraci"]["unik"].add(pid)
                    k["hraci"]["kat"].setdefault(cat, set()).add(pid)
            for c in (nom.get("crew") or []):
                pid = ((c.get("sportnetUser") or {}).get("_id"))
                if pid:
                    k["treneri"]["unik"].add(pid)
                    k["treneri"]["kat"].setdefault(cat, set()).add(pid)

    # zloženie výstupov
    index_kluby = []
    profily = {}
    for oid, k in kluby.items():
        slug = klub_id_slug(oid)
        primarny_aps = max(k["appSpaceCount"], key=k["appSpaceCount"].get)
        zv = as2z.get(primarny_aps, {"id": None, "nazov": "?", "uroven": "?"})

        kategorie = {}
        for cat, kc in k["kat"].items():
            kategorie[cat] = {
                "zapasy": kc["zapasy"], "druzstva": len(kc["druzstva"]), "goly": kc["goly"],
                "zlte": kc["zlte"], "cervene": kc["cervene"], "divaci": kc["divaci"], "divaciPokrytych": kc["divaciPokrytych"],
            }
        kategorie = validate.zorad_kategorie(kategorie)
        zapasy = sum(c["zapasy"] for c in kategorie.values())
        # zápas klubu sa v kpi.zapasy nesmie dvojiť medzi kategóriami toho istého zápasu je OK
        kpi = {
            "zapasy": zapasy,
            "druzstva": sum(c["druzstva"] for c in kategorie.values()),
            "goly": sum(c["goly"] for c in kategorie.values()),
            "divaci": sum(c["divaci"] for c in kategorie.values()),
            "zlteKarty": sum(c["zlte"] for c in kategorie.values()),
            "cerveneKarty": sum(c["cervene"] for c in kategorie.values()),
        }

        def osoba(o):
            return {"unikatni": len(o["unik"]), "poKategorii": validate.zorad_kategorie({c: len(s) for c, s in o["kat"].items()})}

        pokrytych = sum(c["divaciPokrytych"] for c in kategorie.values())
        profily[slug] = {
            "klub": slug, "orgId": oid, "nazov": k["nazov"], "sezona": sezona, "sportSector": sport_sector,
            "zvaz": zv["id"], "uroven": zv["uroven"],
            "generatedAt": teraz(),
            "methodologyFlags": {
                "zapasy": "len closed:true; klub = teams.organization._id",
                "divaciPokrytie": round(pokrytych / zapasy, 3) if zapasy else 0.0,
                "poznamka": "Góly/karty priradené tímu klubu z protocol.events; osoby = hráči (nominations) a tréneri (crew) klubu. Rozhodcovia/delegáti nie sú klubové.",
            },
            "kpi": kpi,
            "kategorie": kategorie,
            "osoby": {"hraci": osoba(k["hraci"]), "treneri": osoba(k["treneri"])},
        }
        index_kluby.append({
            "id": slug, "nazov": k["nazov"], "zvaz": zv["id"], "zvazNazov": zv["nazov"],
            "uroven": zv["uroven"], "sezony": [sezona],
            "zapasy": kpi["zapasy"], "hraci": profily[slug]["osoby"]["hraci"]["unikatni"],
        })

    index_kluby.sort(key=lambda x: -x["zapasy"])
    return profily, index_kluby


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sezona", default="2025/2026", help="jedna sezóna (ak nie je --vsetky/--sezony)")
    ap.add_argument("--sezony", help="čiarkou oddelený zoznam sezón, napr. 2024/2025,2025/2026")
    ap.add_argument("--vsetky", action="store_true", help="všetky kanonické sezóny zo sezony.json")
    ap.add_argument("--index-sezona", default="2025/2026",
                    help="referenčná sezóna pre rebríček v index.json (číselné hodnoty riadku); "
                         "pole 'sezony' obsahuje všetky dostupné sezóny klubu")
    ap.add_argument("--sport-sector", default="futbal")
    ap.add_argument("--mongodb-uri")
    ap.add_argument("--out", default=str(REPO / "data"))
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    from pymongo import MongoClient
    uri = args.mongodb_uri or os.environ.get("MONGODB_URI")
    db = MongoClient(uri)["sutaze"]

    zvazy = load_json(CONFIG / "zvazy.json")
    sezony = load_json(CONFIG / "sezony.json")

    if args.vsetky:
        zoznam = list(sezony["kanonicke"])
    elif args.sezony:
        zoznam = [s.strip() for s in args.sezony.split(",") if s.strip()]
    else:
        zoznam = [args.sezona]

    out = Path(args.out)
    # akumulátor pre zjednotený index naprieč sezónami
    riadky_podla_slug: dict[str, dict[str, dict]] = {}   # slug → {sezona → index_row}
    sezony_podla_slug: dict[str, set] = {}
    nazov_podla_slug: dict[str, str] = {}

    for sez in zoznam:
        varianty = sezona_varianty(sezony, sez)
        log.info("=== kluby %s [%s] ===", sez, args.sport_sector)
        profily, index_kluby = vygeneruj(db, sez, varianty, args.sport_sector, zvazy)

        slug_sez = sez.replace("/", "-")
        for kid, doc in profily.items():
            d = out / "klub" / kid
            d.mkdir(parents=True, exist_ok=True)
            with open(d / f"{slug_sez}.json", "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))

        for row in index_kluby:
            slug = row["id"]
            riadky_podla_slug.setdefault(slug, {})[sez] = row
            sezony_podla_slug.setdefault(slug, set()).add(sez)
            nazov_podla_slug[slug] = row["nazov"]
        log.info("   %s: %d klubov", sez, len(index_kluby))

    # zjednotený index: riadok z referenčnej sezóny (inak najnovšia dostupná), sezony = všetky
    index_kluby = []
    for slug, per_sez in riadky_podla_slug.items():
        sez_list = sorted(sezony_podla_slug[slug])
        ref = args.index_sezona if args.index_sezona in per_sez else sez_list[-1]
        row = dict(per_sez[ref])
        row["sezony"] = sez_list
        index_kluby.append(row)
    index_kluby.sort(key=lambda x: -x["zapasy"])

    (out / "kluby").mkdir(parents=True, exist_ok=True)
    with open(out / "kluby" / "index.json", "w", encoding="utf-8") as f:
        json.dump({"generatedAt": teraz(), "sezona": args.index_sezona,
                   "sezony": zoznam, "kluby": index_kluby}, f, ensure_ascii=False, indent=1)
    log.info("OK — %d klubov (index ref %s), sezóny: %s", len(index_kluby), args.index_sezona, ", ".join(zoznam))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
