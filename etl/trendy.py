#!/usr/bin/env python3
"""ETL Trendy — vekove zlozenie hracov v zapisoch o stretnuti, po sezonach.

Zadanie (pouzivatel portalu, postupil Jan Letko 7. 8. 2026): ako sa vyvija vek
hracov, ktori nastupuju v zapasoch DOSPELYCH — po kluboch, sutaziach a zvazoch,
naprieс vsetkymi sezonami. Metodika: claude/plan-trendy-vek.md v projekte.

ZAKLADNY KLUC (rozhodnutie Jan Letko, 7. 8. 2026) — dva rozne pojmy:

  * "vekova uroven OSOBY" sa ODVODZUJE z rocnika narodenia:
        vek = koncovy rok sezony - rok narodenia
    2025/2026, rocnik 2011 -> 2026-2011 = 15. Hranica dospelych je 20 a viac.
    Je to cele cislo, ROVNAKE pre celu sezonu — dvaja hraci toho isteho rocnika
    maju vzdy rovnaku hodnotu bez ohladu na mesiac narodenia.

  * "vekova uroven SUTAZE alebo DRUZSTVA" je EXAKTNE ZADANA pri sutazi/druzstve
    (teams.ageCategory, resp. competitions.parts[].rules.category).

Tento skript kombinuje oboje: rez "sutaze dospelych" berie podla vekovej urovne
SUTAZE (exaktnej), vek hraca podla vekovej urovne OSOBY (odvodenej). Sedemnastrocny
hrac za dospelych je teda v reze a jeho vek 17 sa do histogramu zapocita — prave to
je zaujimave.

CO SA MERIA: hraci UVEDENI V ZAPISE o stretnuti. Kto realne nastupil na ihrisko sa
z dat zistit NEDA — protocol.events obsahuje len goly a suvisiace typy, striedania
sa neeviduju vobec (overene 7. 8. 2026 v ObFZ Nitra aj v sutaziach SFZ), a priznak
additionalData.substitute je vyplneny len u 6,7 % hracov. Jednotka je teda jeden
ZAPIS hraca v jednom zapase; hrac s 25 zapismi vazi 25x (rozhodnutie Jan Letko).

POZOR na additionalData.age: v datach existuje a je vyplnene na 100 %, ale je to
PRESNY VEK V DEN ZAPASU (tomu istemu hracovi sa v priebehu sezony zmeni z 9 na 10).
Zamerne sa NEPOUZIVA — pracujeme vyhradne s vekovou urovnou osoby.

Vystup — histogramy {vek: pocet zapisov}, z ktorych si frontend dopocita median,
priemer, percentily aj podiely (odolne voci zmene metodiky bez noveho behu ETL):

    data/vek/{zvazId}.json      — rez po zvaze a po urovniach ligy
    data/vek-klub/{klubId}.json — rez po klube a po sutaziach + zapocitane druzstva

Obidva subory MERGUJU sezony (rovnaky princip ako demografia.py), takze opakovane
behy po sezonach sa kumuluju.

Klubovy subor nesie aj podklad pre Index klubu (etl/index_klubu.py): pocty
ZAPOCITANYCH druzstiev po vekovych urovniach sutaze. Druzstvo sa zapocita, len ak
odohralo VIAC NEZ POLOVICU medianu zapasov v tej istej casti sutaze (rozhodnutie
Jan Letko) — odfiltruje to druzstva, ktore sa prihlasili a po par zapasoch skoncili.
Empiricky median je pouzity zamerne namiesto teoretickeho poctu kol: pri pripravkach
sa hra turnajovo a "pocet moznych zapasov" sa z poctu timov vypocitat neda.

GDPR: vyhradne agregovane pocty, ziadne mena ani individualne veky.

Pouzitie:
    export MONGODB_URI="mongodb+srv://..."
    export SSL_CERT_FILE=$(python -c 'import certifi; print(certifi.where())')
    python etl/trendy.py --sezona 2025/2026
    python etl/trendy.py --vsetky
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

from bson import ObjectId
from bson.errors import InvalidId

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipelines  # noqa: E402  (uroven_kod — prevod competitions.level na kod skupiny)

log = logging.getLogger("trendy")

USERS_CHUNK = 5_000

# Vekova uroven SUTAZE, ktora nas zaujima. Dospeli su jedina kategoria, kde ma
# "priemerny vek" zmysel — v mladezi je vek dany pravidlami sutaze.
KAT_DOSPELI = "ADULTS"

METODIKA = (
    "Jednotka je jeden ZAPIS hraca v jednom zapase (hrac s 25 zapismi vazi 25x). "
    "Su to hraci uvedeni v zapise o stretnuti — kto realne nastupil na ihrisko sa "
    "z dat zistit neda, striedania sa v protokole neeviduju. Vek je VEKOVA UROVEN "
    "OSOBY = koncovy rok sezony minus rocnik narodenia (2025/2026, rocnik 2000 -> 26), "
    "nie presny vek v den zapasu. Rez zahrna len sutaze, ktorych vekova uroven SUTAZE "
    "je ADULTS; hraci v nich mozu byt akehokolvek veku. Druzstva sa zapocitavaju, len "
    "ak odohrali viac nez polovicu medianu zapasov v tej istej casti sutaze."
)


def load_json(p: Path) -> dict:
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def sezona_varianty(sezony: dict, kanon: str) -> list[str]:
    return [kanon] + [v for v, k in sezony["varianty"].items() if k == kanon]


def koncovy_rok(sezona: str) -> int:
    """'2025/2026' -> 2026. Referencia pre vekovu uroven osoby."""
    return int(sezona.split("/")[1])


def klub_id_slug(org_id: str) -> str:
    """issf_club_12858 -> klub-12858 (rovnaky slug ako etl/kluby.py)."""
    m = re.match(r"issf_club_(\d+)", org_id or "")
    return f"klub-{m.group(1)}" if m else re.sub(r"[^a-z0-9]+", "-", (org_id or "").lower()).strip("-")


def normalizuj_kat(cat: str | None) -> str | None:
    """WUxx -> Uxx ('W' je len oznacenie zenskej sutaze v nazve kategorie)."""
    if cat and cat.startswith("WU"):
        return cat[1:]
    return cat or None


def nacitaj_part_kategorie(db, varianty: list[str]) -> dict:
    """Mapa partId(str) -> vekova uroven SUTAZE z competitions.parts[].rules.category.

    Fallback pre historicke sezony: teams.ageCategory je vyplnene az od 2024/2025,
    casti sutazi maju kategoriu od 2013/2014 (96,5-100 %). Na rozdiel od
    run.nacitaj_part_mapu sa NEFILTRUJE podla appSpace — klub hrava naprieс zvazmi,
    takze potrebujeme mapu za cele Slovensko.
    """
    cur = db.competitions.find(
        {"season.name": {"$in": varianty}},
        {"parts._id": 1, "parts.rules.category": 1},
    )
    mapa: dict[str, str] = {}
    for c in cur:
        for p in c.get("parts", []):
            cat = normalizuj_kat((p.get("rules") or {}).get("category"))
            if cat:
                mapa[str(p["_id"])] = cat
    return mapa


def nacitaj_sutaze(db, varianty: list[str]) -> dict:
    """Mapa competitionId(str) -> {nazov, uroven, appSpace} pre rez po sutaziach."""
    cur = db.competitions.find(
        {"season.name": {"$in": varianty}}, {"name": 1, "level": 1, "appSpace": 1}
    )
    return {
        str(c["_id"]): {
            "nazov": c.get("name") or "",
            "uroven": pipelines.uroven_kod(c.get("level")),
            "appSpace": c.get("appSpace") or "",
        }
        for c in cur
    }


def zbieraj(db, varianty: list[str], sport_sector: str, part_kat: dict) -> dict:
    """Jeden prechod cez matches sezony.

    zapisy[(klub, competitionId, pohlavie)][pid] = pocet zapisov
    druzstvo[(castId, teamId)] = {"klub": org_id, "kat": vekova uroven sutaze}
    zapasy[(castId, teamId)] = pocet odohranych zapasov
    """
    cur = db.matches.find(
        {"closed": True, "season.name": {"$in": varianty}, "rules.sport_sector": sport_sector},
        {
            "teams._id": 1, "teams.organization._id": 1, "teams.ageCategory": 1,
            "teams.gender": 1, "teams.category": 1,
            "competition._id": 1, "competitionPart._id": 1,
            "nominations.teamId": 1, "nominations.athletes.sportnetUser._id": 1,
        },
        no_cursor_timeout=True,
    )

    zapisy: dict[tuple, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    druzstvo: dict[tuple, dict] = {}
    zapasy: dict[tuple, int] = defaultdict(int)
    spracovanych = 0

    for m in cur:
        spracovanych += 1
        comp_id = str((m.get("competition") or {}).get("_id") or "")
        cast_id = str((m.get("competitionPart") or {}).get("_id") or "")
        kat_casti = part_kat.get(cast_id)

        tmap: dict[str, dict] = {}
        for t in m.get("teams", []):
            oid = (t.get("organization") or {}).get("_id")
            if not oid:
                continue
            tid = str(t.get("_id"))
            # teams.ageCategory je vyplnene az od 2024/2025 -> fallback na cast sutaze
            kat = normalizuj_kat(t.get("ageCategory")) or kat_casti
            tmap[tid] = {"klub": oid, "kat": kat, "gender": t.get("gender") or "NEURCENE"}
            zapasy[(cast_id, tid)] += 1
            if kat:
                # `category` je oznacenie A/B druzstva klubu v danej vekovej urovni.
                # Sluzi na to, aby sa to iste fyzicke druzstvo nezapocitalo dvakrat,
                # ked hra ligu aj pohar (overene na FK Mocenok, 7. 8. 2026).
                druzstvo[(cast_id, tid)] = {
                    "klub": oid, "kat": kat, "cat": t.get("category") or "A",
                }

        for nom in m.get("nominations", []):
            tid = str(nom.get("teamId")) if nom.get("teamId") else None
            t = tmap.get(tid) if tid else None
            if not t or t["kat"] != KAT_DOSPELI:
                continue  # rez: len sutaze dospelych
            kluc = (t["klub"], comp_id, t["gender"])
            for a in (nom.get("athletes") or []):
                pid = (a.get("sportnetUser") or {}).get("_id")
                if pid:
                    zapisy[kluc][pid] += 1

    log.info("   prejdenych zapasov: %d", spracovanych)
    return {"zapisy": zapisy, "druzstvo": druzstvo, "zapasy": dict(zapasy)}


def zapocitane_druzstva(druzstvo: dict, zapasy: dict) -> dict:
    """Pocty druzstiev per klub a vekova uroven sutaze, po uplatneni prahu.

    Druzstvo sa zapocita, len ak odohralo VIAC NEZ POLOVICU medianu zapasov v tej
    istej casti sutaze (rozhodnutie Jan Letko). Overene na ObFZ Nitra 2025/2026:
    z 285 druzstiev v 22 castiach vyradi jedine.

    Druzstvo je unikatna dvojica (vekova uroven, category) v ramci klubu, nie
    zaznam v casti sutaze — to iste acko hrajuce ligu aj pohar je JEDNO druzstvo
    (overene na FK Mocenok: ADULTS/A v VII. lige aj v Pohari ObFZ Nitra).
    Mierne podhodnotenie je tu bezpecnejsie nez nadhodnotenie: klub by si inak
    vedel index nafuknut prihlasenim do pohara.
    """
    per_cast: dict[str, list] = defaultdict(list)
    for (cast_id, _tid), n in zapasy.items():
        per_cast[cast_id].append(n)
    median = {c: sorted(v)[len(v) // 2] for c, v in per_cast.items() if v}

    unikatne: dict[str, set] = defaultdict(set)
    for (cast_id, tid), d in druzstvo.items():
        n = zapasy.get((cast_id, tid), 0)
        if n * 2 <= median.get(cast_id, 0):
            continue
        unikatne[d["klub"]].add((d["kat"], d["cat"]))

    out: dict[str, dict[str, int]] = {}
    for klub, dvojice in unikatne.items():
        poc: dict[str, int] = defaultdict(int)
        for kat, _cat in dvojice:
            poc[kat] += 1
        out[klub] = dict(sorted(poc.items()))
    return out


def nacitaj_rocniky(users_col, pids: set) -> dict:
    """Mapa pid(str) -> rok narodenia (int). Zdroj: sportnet.users.birthdate."""
    oids = []
    for pid in pids:
        try:
            oids.append(ObjectId(pid))
        except (InvalidId, TypeError):
            continue
    mapa: dict[str, int] = {}
    for i in range(0, len(oids), USERS_CHUNK):
        cur = users_col.find({"_id": {"$in": oids[i : i + USERS_CHUNK]}}, {"birthdate": 1})
        for u in cur:
            if u.get("birthdate"):
                mapa[str(u["_id"])] = u["birthdate"].year
    return mapa


def zorad_hist(h: dict) -> dict:
    return dict(sorted(h.items(), key=lambda kv: int(kv[0])))


def merge_sezonu(cesta: Path, kluc_nazov: str, kluc_id: str, sezona: str,
                 sezona_doc: dict, sport_sector: str) -> None:
    """Merge jednej sezony do existujuceho suboru (princip ako demografia.py)."""
    stare: dict[str, dict] = {}
    if cesta.exists():
        try:
            d = load_json(cesta)
            if d.get("sportSector", "futbal") == sport_sector:
                stare = dict(d.get("sezony", {}))
        except Exception:
            pass
    stare[sezona] = sezona_doc
    cesta.parent.mkdir(parents=True, exist_ok=True)
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump({
            kluc_nazov: kluc_id,
            "sportSector": sport_sector,
            "generatedAt": teraz(),
            "methodologyFlags": {"metodika": METODIKA},
            "sezony": {s: stare[s] for s in sorted(stare)},
        }, f, ensure_ascii=False, separators=(",", ":"))


def main() -> int:
    ap = argparse.ArgumentParser(description="ETL Trendy — vekove zlozenie (statistika.futbalsfz.sk)")
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
    zvazy_cfg = load_json(CONFIG / "zvazy.json")

    # appSpace -> id zvazu (na priradenie sutaze k riadiacemu zvazu)
    space_zvaz: dict[str, str] = {}
    for uroven in ("sfz", "rfz", "obfz"):
        for z in zvazy_cfg.get(uroven, []):
            spaces = z.get("appSpaces") or ([z["appSpace"]] if z.get("appSpace") else [])
            for sp in spaces:
                space_zvaz[sp] = z["id"]

    if args.vsetky:
        zoznam = list(sezony_cfg["kanonicke"])
    elif args.sezony:
        zoznam = [s.strip() for s in args.sezony.split(",") if s.strip()]
    else:
        zoznam = [args.sezona]

    out = Path(args.out)

    for sez in zoznam:
        varianty = sezona_varianty(sezony_cfg, sez)
        ey = koncovy_rok(sez)
        log.info("=== trendy %s [%s] ===", sez, args.sport_sector)

        part_kat = nacitaj_part_kategorie(db, varianty)
        sutaze = nacitaj_sutaze(db, varianty)
        log.info("   casti sutazi s kategoriou: %d, sutazi: %d", len(part_kat), len(sutaze))

        z = zbieraj(db, varianty, args.sport_sector, part_kat)
        druzstva = zapocitane_druzstva(z["druzstvo"], z["zapasy"])
        if not z["zapisy"]:
            log.info("   %s: ziadne zapisy v sutaziach dospelych", sez)
            continue

        vsetky_pidy: set = set()
        for pids in z["zapisy"].values():
            vsetky_pidy.update(pids.keys())
        rocniky = nacitaj_rocniky(users_col, vsetky_pidy)
        log.info("   hracov v sutaziach dospelych: %d, z toho s rocnikom: %d",
                 len(vsetky_pidy), len(rocniky))

        hist_klub: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        hist_klub_sutaz: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        hist_zvaz: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        hist_zvaz_uroven: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
        nazvy_sutazi: dict[str, str] = {}
        bez_rocnika = 0

        for (klub, comp_id, gender), pids in z["zapisy"].items():
            s = sutaze.get(comp_id) or {}
            zvaz = space_zvaz.get(s.get("appSpace", ""), "")
            uroven = s.get("uroven", "NEURCENE")
            nazvy_sutazi[comp_id] = s.get("nazov", "")
            for pid, n in pids.items():
                rok = rocniky.get(pid)
                if rok is None:
                    bez_rocnika += n
                    continue
                vek = str(ey - rok)
                hist_klub[klub][gender][vek] += n
                hist_klub_sutaz[klub][f"{comp_id}|{gender}"][vek] += n
                if zvaz:
                    hist_zvaz[zvaz][gender][vek] += n
                    hist_zvaz_uroven[zvaz][f"{uroven}|{gender}"][vek] += n
        if bez_rocnika:
            log.warning("   zapisov bez rocnika narodenia: %d", bez_rocnika)

        for klub, per_gender in hist_klub.items():
            slug = klub_id_slug(klub)
            merge_sezonu(out / "vek-klub" / (slug + ".json"), "klub", slug, sez, {
                "vek": {g: zorad_hist(h) for g, h in per_gender.items()},
                "vekSutaz": {k: zorad_hist(h) for k, h in hist_klub_sutaz[klub].items()},
                "sutaze": {c: nazvy_sutazi.get(c, "") for c in
                           {k.split("|")[0] for k in hist_klub_sutaz[klub]}},
                "druzstva": druzstva.get(klub, {}),
            }, args.sport_sector)

        # kluby, ktore v sezone nemali dospelych, ale mali mladez — Index klubu ich
        # potrebuje (druzstva su jeho hlavnou zlozkou)
        for klub, d in druzstva.items():
            if klub in hist_klub:
                continue
            slug = klub_id_slug(klub)
            merge_sezonu(out / "vek-klub" / (slug + ".json"), "klub", slug, sez, {
                "vek": {}, "vekSutaz": {}, "sutaze": {}, "druzstva": d,
            }, args.sport_sector)

        for zvaz, per_gender in hist_zvaz.items():
            merge_sezonu(out / "vek" / (zvaz + ".json"), "zvaz", zvaz, sez, {
                "vek": {g: zorad_hist(h) for g, h in per_gender.items()},
                "vekUroven": {k: zorad_hist(h) for k, h in hist_zvaz_uroven[zvaz].items()},
            }, args.sport_sector)

        log.info("   %s: klubov s dospelymi %d, klubov spolu %d, zvazov %d",
                 sez, len(hist_klub), len(set(hist_klub) | set(druzstva)), len(hist_zvaz))

    log.info("OK - trendy hotove (spracovane: %s)", ", ".join(zoznam))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
