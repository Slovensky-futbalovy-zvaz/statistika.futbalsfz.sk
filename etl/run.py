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
import re
import sys
import unicodedata
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"

sys.path.insert(0, str(REPO / "etl"))
import pipelines  # noqa: E402
import validate  # noqa: E402
import kluby_zvazy  # noqa: E402  — blok „Počet klubov“ z artefaktu, bez DB

log = logging.getLogger("etl")

MAX_TIME_MS = 120_000  # limit agregácie; po jednej sezóne (viac sezón naraz timeoutuje)
RETRIES = 1  # metodika: občasný timeout → 1 retry
FUTSAL_APP_SPACE = "futsalslovakia.sk"  # futsal patrí priamo pod SFZ (rozhodnutie 12. 7. 2026)
HINT = None  # voliteľný index hint pre agregácie (--hint); dočasná pomôcka do vzniku
#             cieleného indexu (ADR-0004). Napr. appSpace-index obmedzí scan na daný zväz.


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


#: Normalizácia nekanonických hodnôt parts.rules.category (rozhodnutie 13. 7. 2026):
#: „Dospelí“ = ADULTS (futsal, Vysokoškolská liga), „U15 mix“ = U15 (školský
#: turnaj VsFZ; zmiešané pohlavie rieši dimenzia pohlavie ako NEURCENE).
KAT_NORMALIZACIA = {"Dospelí": "ADULTS", "U15 mix": "U15"}

#: Metodická poznámka k dimenzii úrovne súťaže (etapa 2, 6. 8. 2026). Konštanta,
#: aby bol text jediným zdrojom pravdy naprieč profilmi aj pri dávkových behoch.
UROVEN_POZNAMKA = (
    "Úroveň súťaže z competitions.level (nenastaviteľné pole kopírované z ISSF, "
    "nižší level = vyššia súťaž). Skupiny: 1.–9. liga, „10. liga a nižšie“, "
    "„Poháre a turnaje“ (level ≥ 90) a „Neurčená úroveň“ (level nevyplnený — "
    "2–4 % súťaží, takmer výlučne reprezentačné a školské turnaje). "
    "Základný kľúč: úroveň sa vždy vzťahuje ku konkrétnej vekovej úrovni, nie "
    "k vekovej kategórii — každá veková úroveň má vlastnú pyramídu a „1. liga“ "
    "dospelých, U19 a U13 sú tri rôzne súťaže, ktoré sa nesčítavajú. Hĺbka "
    "pyramídy sa líši podľa vekovej úrovne aj regiónu (štruktúra súťaží, nie "
    "chyba dát). Blok urovne je disjunktný (súťaž má práve jednu úroveň) a sedí "
    "na kpi.sutaze; blok sutazeUroven je rez úroveň × veková úroveň × pohlavie, "
    "kde súčet môže kpi.sutaze prevýšiť."
)


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
            cat = KAT_NORMALIZACIA.get(cat, cat)
            if cat or gender:
                mapa[str(p["_id"])] = {"cat": cat, "gender": gender}
    return mapa


# Vzory názvov NADSTAVBOVÝCH častí súťaže (bez diakritiky, malými písmenami).
# Doplnok k štruktúrnemu signálu v `nacitaj_skupina_mapu` — pozri jeho docstring.
NADSTAVBA_VZORY = [
    r"baraz", r"nadstavb", r"o udrzanie", r"o postup", r"o titul",
    r"o umiestnenie", r"play\s*-?\s*off", r"playoff",
    r"o majstra", r"majster okresu", r"kvalifikac",
    r"finale", r"finalov", r"semifinale", r"stvrtfinale", r"osemfinale",
    r"o \d+\s*[-–.]\s*\d+\s*miesto", r"o \d+\.? miesto",
    r"superpohar",
]
NADSTAVBA_RE = re.compile("|".join(NADSTAVBA_VZORY))


def _bez_diakritiky(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", (s or "").lower())
        if unicodedata.category(c) != "Mn"
    )


def je_nadstavbova_cast(nazov: str) -> bool:
    """Nadstavbová časť podľa NÁZVU časti (baráž, play-off, finále, o umiestnenie…).

    Zásada „názvom neveriť“ z metodiky sa týka NÁZVOV SÚŤAŽÍ — tie sa menia podľa
    partnerov ročníka. Názvy ČASTÍ sú štruktúrny popis („Baráž o postup“,
    „Nadstavba o 5.–8. miesto“, „ŠTVRŤFINÁLE“), nie marketing, a menia sa len
    výnimočne. Zmerané 8. 8. 2026 na 2025/2026: 12 preklasifikovaných častí,
    žiadna skutočná liga sa nestratila.
    """
    return bool(NADSTAVBA_RE.search(_bez_diakritiky(nazov)))


def nacitaj_skupina_mapu(db, spaces: list[str], varianty: list[str]) -> dict:
    """Mapa partId(str) → kľúč SKUPINY súťaže (str), alebo bez záznamu = do počtu nevstupuje.

    ZADANIE (Ján Letko, 8. 8. 2026): „súťaž = základná časť“. Súťaž môže obsahovať viac
    PARALELNÝCH základných skupín, ktoré sú fakticky samostatné súťaže — „III. liga U19
    HUMMEL ZsFZ“ 2025/2026 má skupinu JV a skupinu SZ (obe 14 družstiev, 26 kôl) — a k tomu
    NADSTAVBOVÉ časti (kvalifikácia, skupina o postup), ktoré samostatné súťaže nie sú.

    POZOR: databáza príznak typu časti NEMÁ. Stĺpec „Základná / Nadstavbová časť“ existuje
    len v ISSF. Overené 8. 8. 2026 — `competitions.parts[]` nesie iba: name, publicComment,
    type, format, signup, published, rules, settings, dateFrom, dateTo, __issfId, _id,
    rounds, teams, resultsTable. `type` je collective/race (druh športu), dátumy sú pri
    všetkých častiach rovnaké. Názov časti sa používa až ako DRUHÉ sito (nižšie) —
    zásada „názvom neveriť“ z metodiky sa týka názvov SÚŤAŽÍ, nie názvov ČASTÍ.

    Používa sa preto ŠTRUKTURÁLNY SIGNÁL: **nadstavba si družstvá vždy preberá zo
    základných častí, nikdy neprivedie nové.**

        Časť je ZÁKLADNÁ SKUPINA, ak obsahuje aspoň jedno družstvo, ktoré nie je
        v žiadnej inej časti tej istej súťaže.

    Identita družstva je `organization._id | category | ageCategory` — rovnaký kľúč ako pri
    Indexe klubu; bez `category` by sa to isté áčko hrajúce ligu aj pohár počítalo dvakrát.

    DRUHÉ SITO — NÁZOV ČASTI (`je_nadstavbova_cast`). Štruktúrny signál zlyháva tam, kde
    nadstavba priviesť nové družstvo naozaj môže — baráž o postup, kde súper prichádza
    z inej súťaže („Baráž o účasť v Niké lige“, „O Majstra regiónu III. ligy Východ“,
    „Finálový turnaj prípraviek“). Takéto časti sa vyraďujú podľa názvu. Zmerané
    8. 8. 2026 na 2025/2026: 549 → 537 skupín, 12 preklasifikovaných, žiadna skutočná
    liga sa nestratila (paralelné turnajové skupiny typu „O pohár predsedu … sk. A/B“
    ostali zachované — vzor „o pohar“ bol pre šírku vyradený).

    FALLBACK (rozhodnutie Ján Letko): ak sa v súťaži nedá rozlíšiť ani jedna základná
    skupina — všetky časti majú tých istých účastníkov (turnajové prípravky, rozdelenie na
    jesennú a jarnú časť) — celá súťaž sa započíta ako JEDNA skupina. Týka sa to 50
    zo 432 súťaží v 2025/2026 (12 %); konzervatívne, radšej podpočítať než nafukovať.

    Overené 8. 8. 2026: III. liga U19 ZsFZ → 2, IV. liga U19 ZsFZ → 6 (sk. A–F),
    Zimný pohár ObFZ Prešov → 4 skupiny (2 nadstavby vylúčené), VI. liga SsFZ → 4.
    """
    app = spaces[0] if len(spaces) == 1 else {"$in": spaces}
    cur = db.competitions.find(
        {"appSpace": app, "season.name": {"$in": varianty}},
        {
            "parts._id": 1,
            "parts.name": 1,
            "parts.teams.organization._id": 1,
            "parts.teams.category": 1,
            "parts.teams.ageCategory": 1,
        },
    )
    mapa: dict[str, str] = {}
    for c in cur:
        casti = c.get("parts") or []
        if not casti:
            continue
        # kľúče družstiev pre každú časť + v koľkých častiach sa ktoré družstvo vyskytuje
        kluce: list[set[str]] = []
        vyskyt: dict[str, int] = {}
        for p in casti:
            s = set()
            for t in p.get("teams") or []:
                org = ((t.get("organization") or {}).get("_id")) or ""
                s.add(f"{org}|{t.get('category') or '-'}|{t.get('ageCategory') or '-'}")
            kluce.append(s)
            for k in s:
                vyskyt[k] = vyskyt.get(k, 0) + 1
        zakladne = [i for i, s in enumerate(kluce) if any(vyskyt[k] == 1 for k in s)]
        # druhé sito — názov časti (baráž, play-off, finálový turnaj, o umiestnenie…)
        zakladne = [i for i in zakladne if not je_nadstavbova_cast(casti[i].get("name", ""))]
        if zakladne:
            for i in zakladne:
                mapa[str(casti[i]["_id"])] = str(casti[i]["_id"])
        else:
            # fallback — celá súťaž je jedna skupina
            for p in casti:
                mapa[str(p["_id"])] = str(c["_id"])
    return mapa


def nacitaj_comp_mapu(db, spaces: list[str], varianty: list[str]) -> dict:
    """Mapa competitionId(str) → kód úrovne súťaže z `competitions.level`.

    Analógia k `nacitaj_part_mapu`. Pole `level` je nenastaviteľné a kopírované
    z ISSF; jeho pokrytie bolo zmerané 6. 8. 2026 (96–100 % podľa sezóny, hodnota
    `null` sa nevyskytuje). Prevod čísla na kód skupiny robí `pipelines.uroven_kod`;
    súťaž bez `level` dostane kód NEURCENE.
    """
    app = spaces[0] if len(spaces) == 1 else {"$in": spaces}
    cur = db.competitions.find(
        {"appSpace": app, "season.name": {"$in": varianty}}, {"level": 1}
    )
    return {str(c["_id"]): pipelines.uroven_kod(c.get("level")) for c in cur}


def agreguj(db, pipeline: list[dict], popis: str) -> list[dict]:
    """Agregácia s retry (MCP/Atlas občas timeoutne) a diskovým spillom."""
    kwargs = {"allowDiskUse": True, "maxTimeMS": MAX_TIME_MS}
    if HINT:
        kwargs["hint"] = HINT  # dočasná pomôcka do vzniku cieleného indexu (ADR-0004)
    for pokus in range(RETRIES + 1):
        try:
            return list(db.matches.aggregate(pipeline, **kwargs))
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


def _zloz_pohlavie(
    kat_g_raw: list[dict],
    druz_g_raw: list[dict],
    sut_g: dict | None = None,
    sut_gk: dict | None = None,
    skup_g: dict | None = None,
    skup_gk: dict | None = None,
) -> dict:
    """Blok `pohlavie` — per pohlavie súhrn (ako KPI) + kategórie (rozhodnutie O6, 12. 7. 2026).

    `sut_g` / `sut_gk` (doplnené 6. 8. 2026) nesú počty súťaží — distinct súťaž
    na pohlavie, resp. na pohlavie × vekovú kategóriu. Počet súťaží pohlavia sa
    NEROVNÁ súčtu po kategóriách (súťaž so zápasmi vo viacerých vekových
    úrovniach sa v kategóriách započíta v každej z nich), preto sa preberá
    priamo z agregácie a nesčítava.
    """
    druz = {
        (_gender_kluc(r["_id"].get("gender")), r["_id"].get("cat")): r["druzstva"]
        for r in druz_g_raw
    }
    sut_gk = sut_gk or {}
    sut_g = sut_g or {}
    skup_gk = skup_gk or {}
    skup_g = skup_g or {}
    bloky: dict[str, dict] = {}
    for r in kat_g_raw:
        g = _gender_kluc(r["_id"].get("gender"))
        cat = r["_id"].get("cat") or "NEZNAMA"
        blok = bloky.setdefault(g, {})
        blok[cat] = {
            "sutaze": sut_gk.get((g, r["_id"].get("cat")), 0),
            "skupiny": skup_gk.get((g, cat), 0),
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
            "sutaze": sut_g.get(g, 0),
            "zapasy": sum(k["zapasy"] for k in kat.values()),
            "druzstva": sum(k["druzstva"] for k in kat.values()),
            "goly": sum(k["goly"] for k in kat.values()),
            "divaci": sum(k["divaci"] for k in kat.values()),
            "zlteKarty": sum(k["zlte"] for k in kat.values()),
            "cerveneKarty": sum(k["cervene"] for k in kat.values()),
            "kategorie": kat,
        }
    return vysledok


def _skupiny_rezy(casti_raw: list[dict], skup_map: dict) -> dict:
    """Počty SÚŤAŽNÝCH SKUPÍN vo všetkých rezoch naraz.

    Súťažná skupina = základná časť súťaže (rozhodnutie Ján Letko, 8. 8. 2026).
    Jedna súťaž môže mať viac paralelných skupín — „IV. liga U19 HUMMEL ZsFZ“ ich má
    šesť (A–F) — a k tomu nadstavbové časti, ktoré sa do počtu NEZAPOČÍTAVAJÚ.

    Zmysel: dnešný počet súťaží nie je medzi zväzmi porovnateľný. ZsFZ má šesť skupín
    IV. ligy U19 ako JEDNU súťaž so šiestimi časťami, VsFZ má tú istú realitu zapísanú
    ako PÄŤ samostatných súťaží (sk. Š, Z, PT, KG, VD), každú s jednou časťou. Metrika
    skupín oba zápisy zrovnoprávňuje.

    Fallback: ak zo súťaže nemá záznam v mape žiadna časť so zápasom (všetky časti majú
    tých istých účastníkov — turnajové prípravky, jesenná a jarná časť), celá súťaž sa
    započíta ako JEDNA skupina.
    """
    def spocitaj(dvojice: list[tuple[str, str | None]]) -> int:
        """Počet distinct skupín v jednom reze. `dvojice` sú (súťaž, kľúčSkupiny|None).

        Fallback sa vyhodnocuje **v rámci rezu**, nie globálne. Keď má súťaž v tomto
        reze aspoň jednu základnú skupinu, nadstavbové časti sa vynechajú. Keď v ňom
        má iba nadstavbu (napr. kvalifikácia s neznámou vekovou kategóriou), započíta
        sa súťaž ako jedna skupina — inak by v tom reze vyšlo menej skupín než súťaží,
        čo je nezmysel (odhalila to kontrola 8. 8. 2026, 13 zo 604 profilov).
        """
        ma: dict[str, bool] = {}
        for comp, kluc in dvojice:
            ma[comp] = ma.get(comp, False) or bool(kluc)
        out = set()
        for comp, kluc in dvojice:
            if kluc:
                out.add(kluc)
            elif not ma[comp]:
                out.add(comp)
        return len(out)

    celok: list = []
    per_kat, per_g, per_gk, per_u, per_riadok = {}, {}, {}, {}, {}
    for r in casti_raw:
        k = r["_id"]
        comp = k.get("comp")
        dvojica = (comp, skup_map.get(k.get("part")))
        cat = k.get("cat") or "NEZNAMA"
        g = _gender_kluc(k.get("gender"))
        u = k.get("uroven") or pipelines.UROVEN_NEURCENE
        celok.append(dvojica)
        per_kat.setdefault(cat, []).append(dvojica)
        per_g.setdefault(g, []).append(dvojica)
        per_gk.setdefault((g, cat), []).append(dvojica)
        per_u.setdefault(u, []).append(dvojica)
        per_riadok.setdefault((u, cat, g), []).append(dvojica)

    poc = lambda d: {kk: spocitaj(vv) for kk, vv in d.items()}  # noqa: E731
    return {
        "celok": spocitaj(celok),
        "kat": poc(per_kat),
        "pohlavie": poc(per_g),
        "pohlavieKat": poc(per_gk),
        "uroven": poc(per_u),
        "riadky": poc(per_riadok),
    }


def _zloz_urovne(rozpad: dict, skupiny: dict | None = None) -> tuple[dict, list[dict]]:
    """Blok `urovne` (súhrn na úroveň) + plochý zoznam `sutazeUroven`.

    `sutazeUroven` je rez úroveň súťaže × veková úroveň × pohlavie — táto trojica
    je jediný korektný spôsob, ako úroveň vykazovať: `level` sa vždy vzťahuje
    ku konkrétnej vekovej úrovni, nie k vekovej kategórii (rozhodnutie PO
    6. 8. 2026). Každá veková úroveň má vlastnú pyramídu — „1. liga“ dospelých,
    U19 a U13 sú tri rôzne súťaže a nesčítavajú sa.
    """
    poradie_kat = {k: i for i, k in enumerate(validate.KATEGORIE_PORADIE)}
    poradie_u = {k: i for i, k in enumerate(pipelines.UROVEN_PORADIE)}
    poradie_g = {g: i for i, g in enumerate(validate.POHLAVIE_PORADIE)}

    urovne = {}
    for r in rozpad.get("uroven", []):
        kod = r["_id"] or pipelines.UROVEN_NEURCENE
        urovne[kod] = {
            "nazov": pipelines.UROVEN_NAZOV.get(kod, kod),
            "sutaze": r["sutaze"],
            "skupiny": (skupiny or {}).get("uroven", {}).get(kod, 0),
            "zapasy": r.get("zapasy", 0),
        }
    urovne = {k: urovne[k] for k in pipelines.UROVEN_PORADIE if k in urovne}

    riadky = [
        {
            "uroven": (r["_id"].get("u") or pipelines.UROVEN_NEURCENE),
            "kat": (r["_id"].get("cat") or "NEZNAMA"),
            "pohlavie": _gender_kluc(r["_id"].get("g")),
            "sutaze": r["sutaze"],
            "skupiny": (skupiny or {}).get("riadky", {}).get(
                (
                    (r["_id"].get("u") or pipelines.UROVEN_NEURCENE),
                    (r["_id"].get("cat") or "NEZNAMA"),
                    _gender_kluc(r["_id"].get("g")),
                ),
                0,
            ),
            "zapasy": r.get("zapasy", 0),
        }
        for r in rozpad.get("riadky", [])
    ]
    riadky.sort(
        key=lambda x: (
            poradie_u.get(x["uroven"], 99),
            poradie_kat.get(x["kat"], 99),
            poradie_g.get(x["pohlavie"], 9),
        )
    )
    return urovne, riadky


def vygeneruj(
    db, zvaz: dict, sezona: str, varianty: list[str], roly: dict,
    sport_sector: str = "futbal", corrections: dict | None = None,
) -> dict | None:
    """Zloží výstupný dokument zväz+sezóna+odvetvie. None, ak nie sú uzavreté zápasy.

    `corrections` (etl/config/korekcie.json) je korekčná vrstva divákov —
    aplikuje sa v pipelines.kategorie/kategorie_pohlavie cez audience_expr.
    """
    spaces = (
        [FUTSAL_APP_SPACE] if sport_sector == "futsal" else app_spaces(zvaz)
    )  # futsal patrí pod SFZ, ale žije na vlastnom appSpace
    part_map = nacitaj_part_mapu(db, spaces, varianty)
    comp_map = nacitaj_comp_mapu(db, spaces, varianty)
    skup_map = nacitaj_skupina_mapu(db, spaces, varianty)

    kat_raw = agreguj(
        db, pipelines.kategorie(spaces, varianty, sport_sector, part_map, corrections), "kategorie"
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
    realizacny_raw = agreguj(
        db,
        pipelines.realizacny_tim(spaces, varianty, roly["treneriCrewPositions"], sport_sector, part_map),
        "realizacnyTim",
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
        pipelines.kategorie_pohlavie(spaces, varianty, sport_sector, part_map, corrections),
        "kategorie-pohlavie",
    )
    druz_g_raw = agreguj(
        db,
        pipelines.druzstva_pohlavie(spaces, varianty, sport_sector, part_map),
        "druzstva-pohlavie",
    )

    sutaze_raw = agreguj(
        db, pipelines.pocet_sutazi(spaces, varianty, sport_sector), "pocet-sutazi"
    )
    pocet_sutazi = sutaze_raw[0]["sutaze"] if sutaze_raw else 0

    sutaze_kat_raw = agreguj(
        db, pipelines.pocet_sutazi_kategorie(spaces, varianty, sport_sector, part_map), "pocet-sutazi-kat"
    )
    sut_map = {(x["_id"] or "NEZNAMA"): x["sutaze"] for x in sutaze_kat_raw}

    # rozpad súťaží: pohlavie × veková kategória × úroveň súťaže (jediný prechod, $facet)
    rozpad_raw = agreguj(
        db,
        pipelines.pocet_sutazi_rozpad(spaces, varianty, sport_sector, part_map, comp_map),
        "pocet-sutazi-rozpad",
    )
    rozpad = rozpad_raw[0] if rozpad_raw else {}
    sut_g = {_gender_kluc(r["_id"]): r["sutaze"] for r in rozpad.get("pohlavie", [])}
    sut_gk = {
        (_gender_kluc(r["_id"].get("g")), r["_id"].get("cat")): r["sutaze"]
        for r in rozpad.get("pohlavieKategorie", [])
    }
    # súťažné skupiny — distinct základná časť so zápasom, vo všetkých rezoch naraz
    casti_raw = agreguj(
        db,
        pipelines.casti_so_zapasmi(spaces, varianty, sport_sector, part_map, comp_map),
        "casti-so-zapasmi",
    )
    skupiny = _skupiny_rezy(casti_raw, skup_map)

    urovne, sutaze_uroven = _zloz_urovne(rozpad, skupiny)

    druz = {r["_id"]: r["druzstva"] for r in druz_raw}
    kategorie = {}
    for r in kat_raw:
        cat = r["_id"] if r["_id"] else "NEZNAMA"
        kategorie[cat] = {
            "zapasy": r["zapasy"],                       # reálne odohrané (bez admin.)
            "uzatvorene": r.get("uzatvorene", r["zapasy"]),  # všetky closed:true
            "administrativne": r.get("administrativne", 0),  # kontum./odstúp. bez zápisu
            "druzstva": druz.get(r["_id"], 0),
            "goly": r["goly"],
            "zlte": r["zlte"],
            "cervene": r["cervene"],
            "divaci": r["divaci"],
            "divaciPokrytych": r["divaciPokrytych"],
            "sutaze": sut_map.get(cat, 0),
            "skupiny": skupiny["kat"].get(cat, 0),
            "kontumovane": r.get("kontumovane", 0),
            "kontumovaneAdmin": r.get("kontumovaneAdmin", 0),
            "odstupene": r.get("odstupene", 0),
            "odstupeneAdmin": r.get("odstupeneAdmin", 0),
        }
    kategorie = validate.zorad_kategorie(kategorie)

    zapasy = sum(k["zapasy"] for k in kategorie.values())
    uzatvorene = sum(k["uzatvorene"] for k in kategorie.values())
    administrativne = sum(k["administrativne"] for k in kategorie.values())
    kontumovane = sum(k["kontumovane"] for k in kategorie.values())
    kontumovaneAdmin = sum(k["kontumovaneAdmin"] for k in kategorie.values())
    odstupene = sum(k["odstupene"] for k in kategorie.values())
    odstupeneAdmin = sum(k["odstupeneAdmin"] for k in kategorie.values())
    pokrytych = sum(k["divaciPokrytych"] for k in kategorie.values())

    doc = {
        "zvaz": zvaz["id"],
        "sezona": sezona,
        "sportSector": sport_sector,
        "generatedAt": datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds"),
        "methodologyFlags": {
            "zapasy": "closed:true BEZ administratívnych kontumácií/odstúpení bez zápisu (reálne odohrané); uzatvorene = pôvodná báza všetkých closed:true",
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
            "kontumovanePoznamka": (
                "kpi.kontumovane = zápasy so statusom KONTUMOVANY (__issfMatchStatus, "
                "fallback state); kpi.odstupene = ODSTUPENE_DRUZSTVO. Ich administratívna "
                "časť (bez zápisu = bez udalostí a bez divákov) je v *Admin a JE odpočítaná "
                "z kpi.zapasy (reálne odohrané). kpi.uzatvorene = pôvodná báza closed:true."
            ),
            "urovenPoznamka": UROVEN_POZNAMKA,
            "administrativnePoznamka": (
                "administratívne ukončené = kontumácia/odstúpené družstvo bez reálneho "
                "odohratia (žiadne udalosti v protokole a žiadna návštevnosť). "
                "kpi.zapasy = kpi.uzatvorene − kpi.administrativne. Viď docs/metodika.md."
            ),
        },
        "kpi": {
            "sutaze": pocet_sutazi,
            # súťažné skupiny = základné časti súťaží (Ján Letko, 8. 8. 2026);
            # jedna súťaž môže mať viac paralelných skupín, nadstavby sa nerátajú
            "skupiny": skupiny["celok"],
            "zapasy": zapasy,
            "uzatvorene": uzatvorene,
            "administrativne": administrativne,
            "druzstva": sum(k["druzstva"] for k in kategorie.values()),
            "goly": sum(k["goly"] for k in kategorie.values()),
            "divaci": sum(k["divaci"] for k in kategorie.values()),
            "zlteKarty": sum(k["zlte"] for k in kategorie.values()),
            "cerveneKarty": sum(k["cervene"] for k in kategorie.values()),
            "kontumovane": kontumovane,
            "kontumovaneAdmin": kontumovaneAdmin,
            "kontumovaneOdohrane": kontumovane - kontumovaneAdmin,
            "odstupene": odstupene,
            "odstupeneAdmin": odstupeneAdmin,
            "odstupeneOdohrane": odstupene - odstupeneAdmin,
        },
        "kategorie": kategorie,
        "urovne": urovne,
        "sutazeUroven": sutaze_uroven,
        "pohlavie": _zloz_pohlavie(
            kat_g_raw, druz_g_raw, sut_g, sut_gk,
            skupiny["pohlavie"], skupiny["pohlavieKat"],
        ),
        "osoby": {
            "hraci": _facet_osoby(hraci_raw),
            "treneri": _facet_osoby(treneri_raw),
            "realizacnyTim": _facet_osoby(realizacny_raw),
            "rozhodcovia": _facet_osoby(rd_raw, "rozhodcovia"),
            "delegati": _facet_osoby(rd_raw, "delegati"),
            "personal": _facet_osoby(rd_raw, "personal"),
        },
    }

    # korekčná vrstva: zaeviduj do methodologyFlags, ktoré zápasy tohto
    # zväzu+sezóny mali opravený údaj (transparentnosť voči zdroju)
    aplikovane = [
        {"match": mid, "audience": v.get("audience"), "povodne": v.get("povodne"), "duvod": v.get("duvod")}
        for mid, v in (corrections or {}).get("matches", {}).items()
        if v.get("appSpace") in spaces and v.get("sezona") == sezona
    ]
    if aplikovane:
        doc["methodologyFlags"]["korekcie"] = aplikovane

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

    # futbalové súbory RRRR-RRRR.json → pole `sezony`; ostatné odvetvia
    # (RRRR-RRRR-{sektor}.json, napr. …-futsal.json) → mapa `odvetvia`
    subory = sorted((out_dir / "zvaz" / zvaz["id"]).glob("*.json"))
    sezony = [
        p.stem.replace("-", "/") for p in subory if re.fullmatch(r"\d{4}-\d{4}", p.stem)
    ]
    odvetvia: dict[str, list[str]] = {}
    for p in subory:
        m = re.fullmatch(r"(\d{4})-(\d{4})-(\w+)", p.stem)
        if m:
            odvetvia.setdefault(m.group(3), []).append(f"{m.group(1)}/{m.group(2)}")
    for sektor in odvetvia:
        odvetvia[sektor] = sorted(odvetvia[sektor])

    zaznam = {"id": zvaz["id"], "nazov": zvaz["nazov"], "uroven": zvaz.get("uroven", "ObFZ")}
    if zvaz.get("rfz"):
        rfz = next(r for r in zvazy["rfz"] if r["id"] == zvaz["rfz"])
        zaznam["rfz"] = rfz["appSpace"]  # zobrazovaná skratka: BFZ/ZsFZ/SsFZ/VsFZ
    zaznam["appSpace"] = ", ".join(app_spaces(zvaz))
    zaznam["sezony"] = sezony
    if odvetvia:
        zaznam["odvetvia"] = odvetvia  # napr. {"futsal": ["2014/2015", …]} (F2: samostatná sekcia)

    index["generatedAt"] = datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")
    index.pop("note", None)
    index["zvazy"] = [z for z in index["zvazy"] if z["id"] != zvaz["id"]] + [zaznam]
    index["zvazy"].sort(key=lambda z: z["id"])

    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------- main

def main() -> int:
    global MAX_TIME_MS, HINT
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
    ap.add_argument(
        "--max-time-ms", type=int, default=MAX_TIME_MS,
        help=f"limit agregácie v ms (default: {MAX_TIME_MS}); zvýš pre ťažké sezóny (napr. ZsFZ 2021/2022).",
    )
    ap.add_argument(
        "--hint", default=None,
        help="názov indexu vynúteného pre agregácie (dočasná pomôcka do vzniku cieleného indexu, ADR-0004). "
             "Napr. appSpace_1_closed_1_competition._id_1_competitionPart._id_1_round.dateFrom_-1_startDate_-1",
    )
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    MAX_TIME_MS = args.max_time_ms
    HINT = args.hint

    zvazy = load_json(CONFIG / "zvazy.json")
    sezony_cfg = load_json(CONFIG / "sezony.json")
    roly = load_json(CONFIG / "roly.json")
    sporty = load_json(CONFIG / "sporty.json")
    korekcie = load_json(CONFIG / "korekcie.json") if (CONFIG / "korekcie.json").exists() else {}
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
        doc = vygeneruj(db, zvaz, sezona, varianty, roly, args.sport_sector, korekcie)
        if doc is None:
            log.info("%s: žiadne uzavreté zápasy — preskakujem.", sezona)
            continue

        # blok „Počet klubov“ z data/kluby/{sezona}.json (vyrába etl/kluby.py) —
        # bez dotazu do databázy, aby prežil aj samostatný beh jedného zväzu
        kluby_zvazy.doplnit_do_profilu(doc, out_dir, zvaz["id"], sezona, args.sport_sector)
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
