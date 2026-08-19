#!/usr/bin/env python3
"""Strazca odtlackov sezon — zisti, ktore sezony sa v databaze zmenili.

═══════════════════════════════════════════════════════════════════════════════════════
PROBLEM (otazka Jan Letko, 17. 8. 2026)

    Vysledky zapasov sa casto uzatvaraju o tyzden aj o dva neskor, ako je datum zapasu,
    a rozhodnutim komisii sa mozu spatne opravovat aj STARSIE zapasy.

Tyzdenna aktualizacia (etl/tyzdenna.py) prepocitava CELU aktualnu sezonu odznova, takze
neskoro uzavrety zapas ani spatna oprava v aktualnej sezone nemoze uniknut — ziadne "okno
poslednych X dni" neexistuje a netreba ho. Dve diery vsak zostavaju:

  1. PRELOM SEZON. Sezona sa urcuje z datumu (1. 7. - 30. 6.), takze po 1. 7. by sa
     predchadzajuca sezona uz nikdy neprepocitala — hoci sa do nej stale dopisuju dohravky,
     baraze a rozhodnutia komisii. Riesi to prekryv jul-september v etl/tyzdenna.py.
     Namerane 17. 8. 2026: sezona 2025/2026 (futbal, slovenske zvazy) mala 22. 7. 2026
     podla ADR-0008 63 943 uzavretych zapasov, 17. 8. 2026 ich ma 63 945 — teda +2 po
     skonceni sezony. Pocet zapasov je vsak slaby ukazovatel: spatna oprava VYSLEDKU
     komisiou pocet zapasov nemeni vobec. Prekryv je tu ako lacna poistka na obdobie, kedy
     sa sezona realne dokoncuje, nie na zaklade velkeho nameraneho rozdielu.

  2. STARSIE SEZONY. Rozhodnutie komisie o zapase spred dvoch rokov by nezachytil nikto,
     a prepocitavat tyzdenne vsetkych 15 sezon nejde (plny beh 4 h 53 min). Riesi to
     TENTO skript.

═══════════════════════════════════════════════════════════════════════════════════════
PRECO ODTLACKY A NIE DOTAZ "CO SA ZMENILO ZA X DNI"

Kolekcia matches NEMA pole s casom poslednej zmeny (overene 17. 8. 2026 — top-level kluce
su _id, competitionId, partId, sportGround, roundId, closed, startDate, appSpace,
competition, competitionPart, season, rules, settings, round, createdDate, nominations,
teams, protocol, timer, liveState, resultsTable, score…; protocol.lastUpdate je volitelne
a na vzorke chybalo). Dotaz "co sa zmenilo od minuleho tyzdna" sa teda spravit NEDA.

Namiesto toho sa pre kazdu sezonu spocita ODTLACOK — pocet uzavretych zapasov, sucet
skore, sucet divakov a pocet kontumacii — a porovna sa s odtlackom z posledneho uspesneho
behu. Ak sa odtlacok zmeni, sezona sa prepocita.

Overene 17. 8. 2026: agregacia nad ~700 000 uzavretymi zapasmi celej historie zbehne za
sekundy, takze sa moze spustat pred kazdou aktualizaciou.

OBMEDZENIE: zmena, ktora odtlacok nezmeni (napr. zapas znova otvoreny a uzavrety s tym
istym skore aj divakmi), sa nezachyti. Pre publikovane cisla je to bez dopadu — prave tie
tri veci odtlacok meri.

═══════════════════════════════════════════════════════════════════════════════════════
POUZITIE

    export MONGODB_URI="mongodb+srv://…"
    python etl/kontrola_sezon.py --plan      # zmeri, vypise zmenene sezony na stdout
    python etl/kontrola_sezon.py --potvrd    # po USPESNOM behu ETL ulozi novy odtlacok

Dvojfazovost je zamerna: ak beh ETL spadne, stary odtlacok zostane a sezona sa skusi znova
pri najblizsom behu. Bez toho by sa signal o zmene stratil.

Vystup --plan: kanonicke sezony so zmenenym odtlackom, jedna na riadok (stdout).
Subory: data/kontrola/odtlacky.json (potvrdeny stav), data/kontrola/_tmp_odtlacky.json
(namerany stav cakajuci na potvrdenie; je v .gitignore cez vzor _tmp_*).
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

log = logging.getLogger("kontrola_sezon")

#: Metriky odtlacku. Menit ich znamena znehodnotit ulozene odtlacky — po zmene prebehne
#: jednorazovo prepocet vsetkych sezon, co je 4 h 53 min. Preto opatrne.
METRIKY = ("zapasy", "skore", "divaci", "kontumovane")


def load_json(p: Path) -> dict:
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def kanonizuj(sezony_cfg: dict) -> dict:
    """Mapa nazov sezony v datach -> kanonicka sezona. Neznamе nazvy sa zahodia."""
    mapa = {s: s for s in sezony_cfg["kanonicke"]}
    mapa.update({v: k for v, k in sezony_cfg["varianty"].items()})
    return mapa


def appspace_zvazy(zvazy: dict) -> set:
    """Mnozina riadiacich appSpace slovenskych zvazov (zvazy.json) VRATANE futsalu.

    POZOR: futsal nie je v sfz/rfz/obfz — zije na vlastnom appSpace futsalslovakia.sk
    (zvazy.json -> futsal.appSpace, viz run.FUTSAL_APP_SPACE). Bez neho by odtlacok futsal
    ignoroval a spatna oprava futsaloveho zapasu by sa nezachytila (chyba najdena pri
    prvom merani 17. 8. 2026 — futsal 2025/2026 ma 246 uzavretych zapasov).
    """
    out: set = set()
    for uroven in ("sfz", "rfz", "obfz"):
        for z in zvazy.get(uroven, []):
            for a in (z.get("appSpaces") or ([z["appSpace"]] if z.get("appSpace") else [])):
                out.add(a)
    fut = (zvazy.get("futsal") or {}).get("appSpace")
    if fut:
        out.add(fut)
    return out


def zmeraj(db, spaces: set, kanon: dict) -> dict:
    """Odtlacok kazdej kanonickej sezony.

    Zoskupuje sa podla (appSpace, season.name), aby sa dali odfiltrovat zapasy mimo
    slovenskych zvazov — inak by zmena v zahranicnej alebo reprezentacnej sutazi vyvolala
    zbytocny prepocet. Sucty su cez vsetky sportove sektory (futbal + futsal): odtlacok
    je signal "nieco sa v tejto sezone pohlo", nie publikovane cislo.

    VYKON: appSpace je v $match zamerne (nie az v Pythone) — je prvym polom indexov na
    matches, takze sken sa obmedzi na slovenske zvazy. Bez neho islo o plny sken celej
    kolekcie a beh nedobehol ani za 5 minut (namerane 17. 8. 2026). Sucty skore, divakov
    a kontumacii vyzaduju precitanie dokumentov (v indexe tie polia nie su), takze uplne
    "zadarmo" to nebude nikdy — ale v ramci 1-2 hodinoveho behu ETL je to zanedbatelne.
    Pocet zapasov by stacilo citat z indexu, ale sam by nezachytil to podstatne: spatnu
    opravu vysledku komisiou, pri ktorej sa pocet zapasov nemeni.
    """
    pipeline = [
        {"$match": {"appSpace": {"$in": sorted(spaces)}, "closed": True}},
        {"$group": {
            "_id": {"aps": "$appSpace", "sez": "$season.name"},
            "zapasy": {"$sum": 1},
            "skore": {"$sum": {"$sum": {"$ifNull": ["$score", []]}}},
            "divaci": {"$sum": {"$ifNull": ["$protocol.audience", 0]}},
            # Stav zapasu nesie __issfMatchStatus, `state` je len fallback — presne ako
            # v etl/run.py a etl/kluby.py. Prve meranie 17. 8. 2026 s podmienkou len na
            # `state` vratilo vo VSETKYCH sezonach nulu, co chybu odhalilo. Pocitaju sa aj
            # odstupenia: rozhodnutie komisie sa casto prejavi prave zmenou stavu.
            "kontumovane": {"$sum": {"$cond": [
                {"$in": [{"$ifNull": ["$__issfMatchStatus", "$state"]},
                         ["KONTUMOVANY", "ODSTUPENE_DRUZSTVO"]]}, 1, 0]}},
        }},
    ]
    out: dict[str, dict] = {}
    riadkov = mimo = 0
    for r in db.matches.aggregate(pipeline, allowDiskUse=True):
        riadkov += 1
        kluc = r["_id"] or {}
        if kluc.get("aps") not in spaces:
            mimo += 1
            continue
        sez = kanon.get(kluc.get("sez"))
        if not sez:
            mimo += 1
            continue
        d = out.setdefault(sez, {m: 0 for m in METRIKY})
        for m in METRIKY:
            d[m] += int(r.get(m) or 0)
    log.info("skupin (appSpace x sezona): %d, z toho mimo slovenskych zvazov alebo "
             "nekanonickych sezon: %d; kanonickych sezon s datami: %d", riadkov, mimo, len(out))
    return {s: out[s] for s in sorted(out)}


def porovnaj(stare: dict, nove: dict) -> tuple[list, dict]:
    """Kanonicke sezony so zmenenym odtlackom + rozdiely na vypis."""
    zmenene, rozdiely = [], {}
    for sez, n in nove.items():
        s = (stare or {}).get(sez)
        if s is None:
            zmenene.append(sez)
            rozdiely[sez] = {"stav": "nova sezona v odtlackoch", **n}
            continue
        diff = {m: n[m] - int(s.get(m) or 0) for m in METRIKY if n[m] != int(s.get(m) or 0)}
        if diff:
            zmenene.append(sez)
            rozdiely[sez] = {"stav": "zmena", "rozdiel": diff}
    return zmenene, rozdiely


def main() -> int:
    ap = argparse.ArgumentParser(description="Strazca odtlackov sezon (statistika.futbalsfz.sk)")
    rez = ap.add_mutually_exclusive_group(required=True)
    rez.add_argument("--plan", action="store_true",
                     help="zmeri odtlacky a vypise kanonicke sezony so zmenou (stdout)")
    rez.add_argument("--potvrd", action="store_true",
                     help="po uspesnom behu ETL ulozi namerany odtlacok ako platny")
    ap.add_argument("--sezony",
                    help="pri --potvrd: ciarkou oddeleny zoznam sezon, ktore sa naozaj "
                         "prepocitali. Ostatne zostanu na starom odtlacku, aby sa "
                         "preskocena sezona skusila znova pri najblizsom behu. Bez tohto "
                         "argumentu (alebo pri prvom merani) sa potvrdia vsetky.")
    ap.add_argument("--mongodb-uri")
    ap.add_argument("--db", default="sutaze")
    ap.add_argument("--out", default=str(REPO / "data"))
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s", stream=sys.stderr)

    kdir = Path(args.out) / "kontrola"
    platny = kdir / "odtlacky.json"
    namerany = kdir / "_tmp_odtlacky.json"

    if args.potvrd:
        if not namerany.exists():
            log.warning("%s neexistuje — nie je co potvrdit (bezal vobec --plan?)", namerany)
            return 0
        doc = load_json(namerany)
        nove = doc.get("sezony") or {}
        stare = (load_json(platny).get("sezony") if platny.exists() else {}) or {}
        vybrane = [x.strip() for x in (args.sezony or "").split(",") if x.strip()]
        if stare and vybrane:
            # Potvrdi sa len to, co sa naozaj prepocitalo. Sezona, ktora sa preskocila
            # (limit --max-sezon, alebo chyba v jej kroku), zostane na starom odtlacku a
            # pri najblizsom behu sa objavi znova ako zmenena.
            vysledok = dict(stare)
            for sez in vybrane:
                if sez in nove:
                    vysledok[sez] = nove[sez]
            log.info("potvrdene sezony: %s", ", ".join(vybrane) or "-")
        else:
            vysledok = nove
            log.info("potvrdeny cely odtlacok (%s)",
                     "prve meranie" if not stare else "bez --sezony")
        doc["sezony"] = {k: vysledok[k] for k in sorted(vysledok)}
        doc["potvrdenyAt"] = teraz()
        kdir.mkdir(parents=True, exist_ok=True)
        with open(platny, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=1, sort_keys=False)
        namerany.unlink()
        log.info("odtlacky potvrdene: %s (%d sezon)", platny, len(doc["sezony"]))
        return 0

    from pymongo import MongoClient

    uri = args.mongodb_uri or os.environ.get("MONGODB_URI")
    if not uri:
        log.error("Chyba MONGODB_URI.")
        return 1
    db = MongoClient(uri)[args.db]

    sezony_cfg = load_json(CONFIG / "sezony.json")
    kanon = kanonizuj(sezony_cfg)
    spaces = appspace_zvazy(load_json(CONFIG / "zvazy.json"))

    nove = zmeraj(db, spaces, kanon)
    stare = (load_json(platny).get("sezony") if platny.exists() else {}) or {}
    zmenene, rozdiely = porovnaj(stare, nove)

    kdir.mkdir(parents=True, exist_ok=True)
    with open(namerany, "w", encoding="utf-8") as f:
        json.dump({
            "generatedAt": teraz(),
            "poznamka": (
                "Odtlacok sezony = pocet uzavretych zapasov, sucet skore, sucet divakov a "
                "pocet kontumacii, len za appSpace slovenskych zvazov. Sluzi na zistenie, "
                "ci sa v uz spracovanej sezone nieco spatne zmenilo — matches nema pole s "
                "casom poslednej zmeny. Viac v etl/kontrola_sezon.py a docs/metodika.md."
            ),
            "sezony": nove,
        }, f, ensure_ascii=False, indent=1, sort_keys=False)

    if not stare:
        log.info("ziadny predosly odtlacok — prve meranie, nic sa neprepocitava naviac")
    for sez in zmenene:
        log.info("ZMENA %s: %s", sez, json.dumps(rozdiely[sez], ensure_ascii=False))
    if stare and not zmenene:
        log.info("ziadna sezona sa nezmenila")

    # stdout je strojovy vystup pre etl/tyzdenna.py — pri prvom merani zamerne prazdny,
    # inak by prvy beh vyvolal prepocet celej historie.
    if stare:
        for sez in zmenene:
            print(sez)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
