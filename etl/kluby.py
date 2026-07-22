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


def vygeneruj(db, sezona: str, varianty: list[str], sport_sector: str, zvazy: dict, coach_positions: list[str]) -> tuple[dict, list]:
    as2z = appspace_na_zvaz(zvazy)
    coach_set = set(coach_positions)
    cur = db.matches.find(
        {"closed": True, "season.name": {"$in": varianty}, "rules.sport_sector": sport_sector},
        {
            "appSpace": 1,
            "teams._id": 1, "teams.organization._id": 1, "teams.organization.name": 1, "teams.ageCategory": 1,
            "protocol.events.eventType": 1, "protocol.events.team": 1, "protocol.audience": 1,
            "nominations.teamId": 1, "nominations.athletes.sportnetUser._id": 1,
            "nominations.crew.sportnetUser._id": 1, "nominations.crew.position": 1,
            "contumation.isContumated": 1,
            "__issfMatchStatus": 1, "state": 1,
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
                "realizacnyTim": {"unik": set(), "kat": {}},
                # doplnkové kategórie zápasov (__issfMatchStatus) so split administratívne (bez zápisu)
                "kontumovane": 0, "kontumovaneAdmin": 0,
                "odstupene": 0, "odstupeneAdmin": 0,
            }
        return k

    for m in cur:
        aps = m.get("appSpace")
        audience = (m.get("protocol") or {}).get("audience")
        # administratívne ukončený zápas BEZ reálneho odohratia (viď docs/metodika.md):
        # KONTUMOVANY/ODSTUPENE_DRUZSTVO + žiadne udalosti v protokole + žiadni diváci.
        _status = m.get("__issfMatchStatus") or m.get("state")
        _bez_udalosti = not ((m.get("protocol") or {}).get("events"))
        _bez_divakov = not (isinstance(audience, int) and audience > 0)
        _admin = _status in ("KONTUMOVANY", "ODSTUPENE_DRUZSTVO") and _bez_udalosti and _bez_divakov
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
            kc = k["kat"].setdefault(cat, {"zapasy": 0, "uzatvorene": 0, "administrativne": 0, "druzstva": set(), "goly": 0, "zlte": 0, "cervene": 0, "divaci": 0, "divaciPokrytych": 0})
            kc["uzatvorene"] += 1
            if _admin:
                kc["administrativne"] += 1
            else:
                kc["zapasy"] += 1  # reálne odohrané
            if _status == "KONTUMOVANY":
                k["kontumovane"] += 1
                if _admin:
                    k["kontumovaneAdmin"] += 1
            elif _status == "ODSTUPENE_DRUZSTVO":
                k["odstupene"] += 1
                if _admin:
                    k["odstupeneAdmin"] += 1
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
                if not pid:
                    continue
                grp = k["treneri"] if c.get("position") in coach_set else k["realizacnyTim"]
                grp["unik"].add(pid)
                grp["kat"].setdefault(cat, set()).add(pid)

    # zloženie výstupov
    index_kluby = []
    profily = {}
    for oid, k in kluby.items():
        slug = klub_id_slug(oid)
        primarny_aps = max(k["appSpaceCount"], key=k["appSpaceCount"].get)
        if sport_sector != "futbal":
            # Futsal (a dalsie odvetvia mimo futbalu) nemaju riadiaci appSpace podla
            # regionu - cele odvetvie zije priamo pod SFZ (zhodne s etl/run.py).
            sfz_cfg = next((zz for zz in zvazy.get("sfz", []) if zz["id"] == "sfz"), None)
            zv = {"id": "sfz", "nazov": sfz_cfg["nazov"] if sfz_cfg else "Slovensky futbalovy zvaz", "uroven": "SFZ"}
        else:
            zv = as2z.get(primarny_aps, {"id": None, "nazov": "?", "uroven": "?"})

        kategorie = {}
        for cat, kc in k["kat"].items():
            kategorie[cat] = {
                "zapasy": kc["zapasy"], "uzatvorene": kc["uzatvorene"], "administrativne": kc["administrativne"],
                "druzstva": len(kc["druzstva"]), "goly": kc["goly"],
                "zlte": kc["zlte"], "cervene": kc["cervene"], "divaci": kc["divaci"], "divaciPokrytych": kc["divaciPokrytych"],
            }
        kategorie = validate.zorad_kategorie(kategorie)
        zapasy = sum(c["zapasy"] for c in kategorie.values())
        uzatvorene = sum(c["uzatvorene"] for c in kategorie.values())
        administrativne = sum(c["administrativne"] for c in kategorie.values())
        kpi = {
            "zapasy": zapasy,
            "uzatvorene": uzatvorene,
            "administrativne": administrativne,
            "druzstva": sum(c["druzstva"] for c in kategorie.values()),
            "goly": sum(c["goly"] for c in kategorie.values()),
            "divaci": sum(c["divaci"] for c in kategorie.values()),
            "zlteKarty": sum(c["zlte"] for c in kategorie.values()),
            "cerveneKarty": sum(c["cervene"] for c in kategorie.values()),
            "kontumovane": k["kontumovane"],
            "kontumovaneAdmin": k["kontumovaneAdmin"],
            "kontumovaneOdohrane": k["kontumovane"] - k["kontumovaneAdmin"],
            "odstupene": k["odstupene"],
            "odstupeneAdmin": k["odstupeneAdmin"],
            "odstupeneOdohrane": k["odstupene"] - k["odstupeneAdmin"],
        }

        def osoba(o):
            return {"unikatni": len(o["unik"]), "poKategorii": validate.zorad_kategorie({c: len(s) for c, s in o["kat"].items()})}

        pokrytych = sum(c["divaciPokrytych"] for c in kategorie.values())
        profily[slug] = {
            "klub": slug, "orgId": oid, "nazov": k["nazov"], "sezona": sezona, "sportSector": sport_sector,
            "zvaz": zv["id"], "uroven": zv["uroven"],
            "generatedAt": teraz(),
            "methodologyFlags": {
                "zapasy": "reálne odohrané (closed:true bez administratívnych kontumácií/odstúpení bez zápisu); uzatvorene = všetky closed:true; klub = teams.organization._id",
                "divaciPokrytie": round(pokrytych / zapasy, 3) if zapasy else 0.0,
                "poznamka": "Góly/karty priradené tímu klubu z protocol.events; osoby = hráči (nominations) a tréneri (crew) klubu. Rozhodcovia/delegáti nie sú klubové.",
                "kontumovanePoznamka": "kpi.kontumovane = zápasy klubu so statusom KONTUMOVANY, kpi.odstupene = ODSTUPENE_DRUZSTVO. Ich administratívna časť (bez zápisu) je odpočítaná z kpi.zapasy; kpi.uzatvorene = všetky closed:true.",
            },
            "kpi": kpi,
            "kategorie": kategorie,
            "osoby": {"hraci": osoba(k["hraci"]), "treneri": osoba(k["treneri"]), "realizacnyTim": osoba(k["realizacnyTim"])},
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
    roly = load_json(CONFIG / "roly.json")
    coach_positions = roly["treneriCrewPositions"]

    if args.vsetky:
        zoznam = list(sezony["kanonicke"])
    elif args.sezony:
        zoznam = [s.strip() for s in args.sezony.split(",") if s.strip()]
    else:
        zoznam = [args.sezona]

    out = Path(args.out)

    # 1) prepočet profilov pre zadané sezóny (píše data/klub/{id}/{sezona}.json)
    odv_existing: dict[str, dict] = {}
    if args.sport_sector != "futbal":
        odv_index_path = out / "kluby" / f"{args.sport_sector}-index.json"
        if odv_index_path.exists():
            for row in load_json(odv_index_path).get("kluby", []):
                odv_existing[row["id"]] = row
    for sez in zoznam:
        varianty = sezona_varianty(sezony, sez)
        log.info("=== kluby %s [%s] ===", sez, args.sport_sector)
        profily, index_kluby = vygeneruj(db, sez, varianty, args.sport_sector, zvazy, coach_positions)
        slug_sez = sez.replace("/", "-")
        suffix = "" if args.sport_sector == "futbal" else f"-{args.sport_sector}"
        for kid, doc in profily.items():
            d = out / "klub" / kid
            d.mkdir(parents=True, exist_ok=True)
            with open(d / f"{slug_sez}{suffix}.json", "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
            if args.sport_sector != "futbal":
                row = odv_existing.setdefault(kid, {"id": kid, "nazov": doc["nazov"], "zvaz": doc["zvaz"], "uroven": doc["uroven"], "sezony": []})
                row["nazov"] = doc["nazov"]
                row["zvaz"] = doc["zvaz"]
                row["uroven"] = doc["uroven"]
                if sez not in row["sezony"]:
                    row["sezony"].append(sez)
                row["sezony"].sort()
        log.info("   %s: %d klubov", sez, len(index_kluby))
    if args.sport_sector != "futbal":
        (out / "kluby").mkdir(parents=True, exist_ok=True)
        with open(out / "kluby" / f"{args.sport_sector}-index.json", "w", encoding="utf-8") as f:
            json.dump({"generatedAt": teraz(), "sektor": args.sport_sector,
                       "kluby": sorted(odv_existing.values(), key=lambda r: r["id"])},
                      f, ensure_ascii=False, indent=1)
        log.info("OK - %s index: %d klubov (spracovane: %s)", args.sport_sector, len(odv_existing), ", ".join(zoznam))
        return 0

    # 2) index prestavaný SKENOM DISKU — robustné pre plný aj týždenný (current-season)
    #    beh: zoznam sezón klubu = všetky súbory na disku; riadok rebríčka = referenčná
    #    sezóna (inak najnovšia dostupná). Kluby neaktívne v spracovanej sezóne sa nestratia.
    zvaz_nazov: dict[str, str] = {}
    for grp in ("sfz", "rfz", "obfz"):
        for z in zvazy.get(grp, []):
            zvaz_nazov[z["id"]] = z["nazov"]

    index_kluby = []
    vsetky_sez: set[str] = set()
    klub_dir = out / "klub"
    for kid in (sorted(os.listdir(klub_dir)) if klub_dir.exists() else []):
        d = klub_dir / kid
        if not d.is_dir():
            continue
        subory = sorted(f[:-5] for f in os.listdir(d) if re.fullmatch(r"\d{4}-\d{4}\.json", f))
        if not subory:
            continue
        sez_list = [s.replace("-", "/") for s in subory]
        vsetky_sez.update(sez_list)
        ref_slug = args.index_sezona.replace("/", "-")
        if ref_slug not in subory:
            ref_slug = subory[-1]
        try:
            p = load_json(d / f"{ref_slug}.json")
        except Exception:
            continue
        index_kluby.append({
            "id": kid,
            "nazov": p.get("nazov", kid),
            "zvaz": p.get("zvaz"),
            "zvazNazov": zvaz_nazov.get(p.get("zvaz"), p.get("zvaz") or "?"),
            "uroven": p.get("uroven", "?"),
            "sezony": sez_list,
            "zapasy": p.get("kpi", {}).get("zapasy", 0),
            "hraci": p.get("osoby", {}).get("hraci", {}).get("unikatni", 0),
        })
    index_kluby.sort(key=lambda x: -x["zapasy"])

    (out / "kluby").mkdir(parents=True, exist_ok=True)
    with open(out / "kluby" / "index.json", "w", encoding="utf-8") as f:
        json.dump({"generatedAt": teraz(), "sezona": args.index_sezona,
                   "sezony": sorted(vsetky_sez), "kluby": index_kluby}, f, ensure_ascii=False, indent=1)
    log.info("OK — %d klubov (index ref %s, sken disku), spracované: %s",
             len(index_kluby), args.index_sezona, ", ".join(zoznam))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
