"""Agregačné pipelines pre ETL statistika.futbalsfz.sk.

Všetky pipelines pracujú nad kolekciou `matches` (DB `sutaze`) a dodržiavajú
záväzné pravidlá z docs/metodika.md:
- len zápasy closed:true,
- appSpace výhradne z overeného registra (etl/config/zvazy.json),
- veková kategória z teams[].ageCategory,
- nominations.teamId (string) sa páruje na teams._id (ObjectId) cez $toString,
- roly osôb výhradne z etl/config/roly.json.

Pipelines boli odladené a verifikované proti vzorkám ObFZ Nitra
(2024/2025, 2025/2026) dňa 12. 7. 2026 — 100 % zhoda.
"""


def _match_stage(
    app_spaces: list[str], season_variants: list[str], sport_sector: str = "futbal"
) -> dict:
    """Spoločný $match: zväz (1..n appSpace), uzavreté zápasy, varianty zápisu
    sezóny a športové odvetvie (systémová premenná, číselník etl/config/sporty.json)."""
    app = app_spaces[0] if len(app_spaces) == 1 else {"$in": app_spaces}
    return {
        "$match": {
            "appSpace": app,
            "closed": True,
            "season.name": {"$in": season_variants},
            "rules.sport_sector": sport_sector,
        }
    }


def _event_count(event_type: str) -> dict:
    """Počet udalostí daného typu v protocol.events (chýbajúci protokol = 0)."""
    return {
        "$size": {
            "$filter": {
                "input": {"$ifNull": ["$protocol.events", []]},
                "as": "e",
                "cond": {"$eq": ["$$e.eventType", event_type]},
            }
        }
    }


#: Stav zápasu: ISSF import (__issfMatchStatus) s fallbackom na natívne pole `state`.
_STATUS_EXPR = {"$ifNull": ["$__issfMatchStatus", "$state"]}

#: Príznak administratívne ukončeného zápasu BEZ reálneho zápisu o stretnutí:
#: kontumácia / odstúpené družstvo, ktoré sa fyzicky nehralo — žiadne udalosti
#: v protokole a žiadna zaznamenaná návštevnosť. Takéto zápasy sa NEZAPOČÍTAVAJÚ
#: do „odohraných“ (kpi.zapasy). Reálne odohrané kontumácie/odstúpenia (majú
#: protokol/divákov) ostávajú započítané. Definícia a validácia: docs/metodika.md.
_ADMIN_NEODOHRANY_EXPR = {
    "$and": [
        {"$in": [_STATUS_EXPR, ["KONTUMOVANY", "ODSTUPENE_DRUZSTVO"]]},
        {"$eq": [{"$size": {"$ifNull": ["$protocol.events", []]}}, 0]},
        {"$eq": [{"$convert": {"input": "$protocol.audience", "to": "double", "onError": 0, "onNull": 0}}, 0]},
        # žiadna uzavretá nominácia (zostava nebola podaná) — silný príznak, že sa nehralo
        {"$not": [{"$anyElementTrue": {"$map": {
            "input": {"$ifNull": ["$nominations", []]}, "as": "n",
            "in": {"$eq": ["$$n.closed", True]},
        }}}]},
    ]
}


def cat_fallback_expr(part_map: dict | None):
    """Fallback vekovej kategórie z časti súťaže (competitions.parts[].rules.category).

    `teams.ageCategory` je vyplnené len od sezóny 2024/2025 — pre historické
    sezóny sa kategória mapuje cez match.competitionPart._id → mapa
    partId→{cat, gender} (načítaná z kolekcie competitions v run.py).
    Vracia $switch výraz alebo None.
    """
    if not part_map:
        return None
    branches = [
        {
            "case": {"$eq": [{"$toString": "$competitionPart._id"}, pid]},
            "then": v["cat"],
        }
        for pid, v in part_map.items()
        if v.get("cat")
    ]
    if not branches:
        return None
    return {"$switch": {"branches": branches, "default": None}}


def gender_expr(part_map: dict | None):
    """Pohlavie zápasu z časti súťaže (competitions.parts[].rules.gender).

    Zápas pohlavie priamo nenesie — mapuje sa cez match.competitionPart._id
    rovnakým mechanizmom ako fallback kategórií. Len hodnoty „M“/„F“;
    prázdne/chýbajúce → None (v run.py sa vykáže ako skupina NEURCENE).
    """
    if not part_map:
        return None
    branches = [
        {
            "case": {"$eq": [{"$toString": "$competitionPart._id"}, pid]},
            "then": v["gender"],
        }
        for pid, v in part_map.items()
        if v.get("gender") in ("M", "F")
    ]
    if not branches:
        return None
    return {"$switch": {"branches": branches, "default": None}}


def audience_expr(corrections: dict | None):
    """Diváci zápasu z protocol.audience s korekčnou vrstvou (etl/config/korekcie.json).

    Pre match _id uvedené v korekciách vráti opravenú hodnotu `audience`; pre
    ostatné zápasy pôvodný `protocol.audience`. Nemodifikuje zdrojovú DB —
    oprava sa aplikuje len počas agregácie (rozhodnutie PO 13. 7. 2026).
    """
    base = "$protocol.audience"
    matches = (corrections or {}).get("matches") or {}
    branches = [
        {"case": {"$eq": [{"$toString": "$_id"}, mid]}, "then": v["audience"]}
        for mid, v in matches.items()
        if "audience" in v
    ]
    if not branches:
        return base
    return {"$switch": {"branches": branches, "default": base}}


def _cat_zapas(part_map: dict | None):
    """Kategória zápasu: primárne teams[0].ageCategory, fallback z časti súťaže."""
    base = {"$arrayElemAt": ["$teams.ageCategory", 0]}
    fb = cat_fallback_expr(part_map)
    return {"$ifNull": [base, fb]} if fb else base


#: Mapovanie nominations.teamId (string) → teams[].ageCategory cez $toString.
_NOMINATION_CAT = {
    "$arrayElemAt": [
        {
            "$map": {
                "input": {
                    "$filter": {
                        "input": "$teams",
                        "as": "t",
                        "cond": {"$eq": [{"$toString": "$$t._id"}, "$nominations.teamId"]},
                    }
                },
                "as": "m",
                "in": "$$m.ageCategory",
            }
        },
        0,
    ]
}

#: Facet: unikátne osoby celkom + počty unikátnych osôb po kategóriách.
_PERSON_FACET = [
    {"$group": {"_id": {"pid": "$pid", "cat": "$cat"}}},
    {
        "$facet": {
            "poKategorii": [
                {"$group": {"_id": "$_id.cat", "n": {"$sum": 1}}},
                {"$sort": {"_id": 1}},
            ],
            "unikatni": [{"$group": {"_id": "$_id.pid"}}, {"$count": "n"}],
        }
    },
]


def kategorie(app_spaces, season_variants, sport_sector="futbal", part_map=None, corrections=None):
    """Zápasy, góly, karty a diváci po vekových kategóriách.

    zapasy = REÁLNE ODOHRANÉ = closed:true bez administratívnych kontumácií/
    odstúpení bez zápisu (viď _ADMIN_NEODOHRANY_EXPR, docs/metodika.md).
    uzatvorene = všetky closed:true (pôvodná báza, pre transparentnosť).
    administrativne = kontumácie/odstúpenia bez reálneho odohratia (odpočítané zo `zapasy`).
    kontumovane/odstupene = doplnkové kategórie (__issfMatchStatus) so split *Admin.
    divaciPokrytych = počet zápasov s vyplneným protocol.audience (vrátane 0).
    Diváci prechádzajú korekčnou vrstvou (audience_expr).
    """
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {
            "$project": {
                "cat": _cat_zapas(part_map),
                "status": _STATUS_EXPR,
                "admin": _ADMIN_NEODOHRANY_EXPR,
                "goly": _event_count("goal"),
                "zlte": _event_count("yellow_card"),
                "cervene": _event_count("red_card"),
                "audience": audience_expr(corrections),
            }
        },
        {
            "$group": {
                "_id": "$cat",
                "zapasy": {"$sum": {"$cond": ["$admin", 0, 1]}},
                "uzatvorene": {"$sum": 1},
                "administrativne": {"$sum": {"$cond": ["$admin", 1, 0]}},
                "kontumovane": {"$sum": {"$cond": [{"$eq": ["$status", "KONTUMOVANY"]}, 1, 0]}},
                "kontumovaneAdmin": {"$sum": {"$cond": [{"$and": [{"$eq": ["$status", "KONTUMOVANY"]}, "$admin"]}, 1, 0]}},
                "odstupene": {"$sum": {"$cond": [{"$eq": ["$status", "ODSTUPENE_DRUZSTVO"]}, 1, 0]}},
                "odstupeneAdmin": {"$sum": {"$cond": [{"$and": [{"$eq": ["$status", "ODSTUPENE_DRUZSTVO"]}, "$admin"]}, 1, 0]}},
                "goly": {"$sum": "$goly"},
                "zlte": {"$sum": "$zlte"},
                "cervene": {"$sum": "$cervene"},
                "divaci": {"$sum": {"$ifNull": ["$audience", 0]}},
                "divaciPokrytych": {"$sum": {"$cond": [{"$gt": ["$audience", None]}, 1, 0]}},
            }
        },
        {"$sort": {"_id": 1}},
    ]


def kategorie_pohlavie(app_spaces, season_variants, sport_sector="futbal", part_map=None, corrections=None):
    """Zápasy, góly, karty a diváci po pohlaví × vekovej kategórii.

    zapasy = reálne odohrané (bez administratívnych kontumácií/odstúpení bez
    zápisu), rovnako ako v `kategorie` → súčty M+F+NEURCENE sedia na KPI.
    Pohlavie výhradne z časti súťaže (gender_expr). Diváci cez audience_expr.
    """
    g = gender_expr(part_map)
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {
            "$project": {
                "gender": g if g is not None else {"$literal": None},
                "cat": _cat_zapas(part_map),
                "admin": _ADMIN_NEODOHRANY_EXPR,
                "goly": _event_count("goal"),
                "zlte": _event_count("yellow_card"),
                "cervene": _event_count("red_card"),
                "audience": audience_expr(corrections),
            }
        },
        {
            "$group": {
                "_id": {"gender": "$gender", "cat": "$cat"},
                "zapasy": {"$sum": {"$cond": ["$admin", 0, 1]}},
                "goly": {"$sum": "$goly"},
                "zlte": {"$sum": "$zlte"},
                "cervene": {"$sum": "$cervene"},
                "divaci": {"$sum": {"$ifNull": ["$audience", 0]}},
                "divaciPokrytych": {"$sum": {"$cond": [{"$gt": ["$audience", None]}, 1, 0]}},
            }
        },
        {"$sort": {"_id.gender": 1, "_id.cat": 1}},
    ]


def druzstva_pohlavie(app_spaces, season_variants, sport_sector="futbal", part_map=None):
    """Unikátne družstvá (organization.name) po pohlaví × kategórii.

    POZOR: organizácia s mužským aj ženským družstvom v tej istej kategórii
    sa počíta v oboch pohlaviach → súčet po pohlaviach môže prevýšiť
    celkové KPI druzstva (analógia dvojitého pôsobenia osôb).
    """
    g = gender_expr(part_map)
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {
            "$project": {
                "teams": 1,
                "gender": g if g is not None else {"$literal": None},
                "catFb": cat_fallback_expr(part_map) or {"$literal": None},
            }
        },
        {"$unwind": "$teams"},
        {
            "$group": {
                "_id": {
                    "gender": "$gender",
                    "cat": {"$ifNull": ["$teams.ageCategory", "$catFb"]},
                    "org": "$teams.organization.name",
                }
            }
        },
        {
            "$group": {
                "_id": {"gender": "$_id.gender", "cat": "$_id.cat"},
                "druzstva": {"$sum": 1},
            }
        },
        {"$sort": {"_id.gender": 1, "_id.cat": 1}},
    ]


def pocet_sutazi(app_spaces, season_variants, sport_sector="futbal"):
    """Počet súťaží zväzu v sezóne = distinct competition._id s ≥1 uzavretým zápasom.

    Definícia „súťaž = distinct competition so zápasom“ (rozhodnutie PO 19. 7. 2026);
    zodpovedá číslu na infografike ZsFZ (21 súťaží 2025/26).
    """
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$group": {"_id": "$competition._id"}},
        {"$count": "sutaze"},
    ]


def pocet_sutazi_kategorie(app_spaces, season_variants, sport_sector="futbal", part_map=None):
    """Počet súťaží po vekových kategóriách = distinct competition._id na kategóriu.
    Kategória zápasu cez _cat_zapas (rovnako ako v kategorie())."""
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$project": {"cat": _cat_zapas(part_map), "comp": "$competition._id"}},
        {"$group": {"_id": {"cat": "$cat", "comp": "$comp"}}},
        {"$group": {"_id": "$_id.cat", "sutaze": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]


def kontumovane_kategorie(app_spaces, season_variants, sport_sector="futbal", part_map=None):
    """Počet kontumovaných zápasov (contumation.isContumated) po vekových kategóriách."""
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$match": {"contumation.isContumated": True}},
        {"$project": {"cat": _cat_zapas(part_map)}},
        {"$group": {"_id": "$cat", "kontumovane": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]


def kontumovane_pocet(app_spaces, season_variants, sport_sector="futbal"):
    """Počet kontumovaných zápasov — doplnková KPI karta (#kontumácie), NEODPOČÍTAVA sa
    z celkového kpi.zapasy (closed:true ich už zahŕňa, kontumácia zápas štandardne
    uzatvára). POZOR: matches.state == 'KONTUMOVANY' sa v praxi takmer nikdy nenastavuje
    (overené 20. 7. 2026: SFZ 2025/2026, 8065 uzavretých zápasov — všetky state:null,
    napriek tomu 13 s contumation.isContumated:true). Skutočný a dokumentovaný príznak
    kontumácie je contumation.isContumated (viď Sportnet docs: match-scoring-and-contumation).
    """
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$match": {"contumation.isContumated": True}},
        {"$count": "kontumovane"},
    ]


def druzstva(app_spaces, season_variants, sport_sector="futbal", part_map=None):
    """Unikátne družstvá (organization.name) po kategóriách — len s ≥1 uzavretým zápasom."""
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$project": {"teams": 1}},
        {"$unwind": "$teams"},
        {"$group": {"_id": {"cat": {"$ifNull": ["$teams.ageCategory", cat_fallback_expr(part_map) or None]}, "org": "$teams.organization.name"}}},
        {"$group": {"_id": "$_id.cat", "druzstva": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]


def hraci(app_spaces, season_variants, sport_sector="futbal", part_map=None):
    """Hráči: unikáty celkom + unikáty po kategóriách (kategória cez teamId nominácie)."""
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$project": {"teams": 1, "nominations": 1}},
        {"$unwind": "$nominations"},
        {"$unwind": "$nominations.athletes"},
        {"$project": {"pid": "$nominations.athletes.sportnetUser._id", "cat": {"$ifNull": [_NOMINATION_CAT, cat_fallback_expr(part_map) or None]}}},
        *_PERSON_FACET,
    ]


def treneri(app_spaces, season_variants, coach_positions, sport_sector="futbal", part_map=None):
    """Tréneri z nominations.crew (pozície z roly.json; `manager` = vedúci družstva, NIE tréner)."""
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$project": {"teams": 1, "nominations": 1}},
        {"$unwind": "$nominations"},
        {"$unwind": "$nominations.crew"},
        {"$match": {"nominations.crew.position": {"$in": coach_positions}}},
        {"$project": {"pid": "$nominations.crew.sportnetUser._id", "cat": {"$ifNull": [_NOMINATION_CAT, cat_fallback_expr(part_map) or None]}}},
        *_PERSON_FACET,
    ]


def realizacny_tim(app_spaces, season_variants, coach_positions, sport_sector="futbal", part_map=None):
    """Realizačný tím z nominations.crew — pozície MIMO trénerských
    (vedúci družstva `manager`, lekár `doctor`, masér `masseur`, fyzioterapeut
    `physiotherapist`, zástupca klubu `club_representative`, usporiadateľ
    `security_manager` a pod.). Tréneri sa počítajú samostatne (funkcia `treneri`)."""
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$project": {"teams": 1, "nominations": 1}},
        {"$unwind": "$nominations"},
        {"$unwind": "$nominations.crew"},
        {"$match": {"nominations.crew.position": {"$nin": coach_positions, "$exists": True, "$ne": None}}},
        {"$project": {"pid": "$nominations.crew.sportnetUser._id", "cat": {"$ifNull": [_NOMINATION_CAT, cat_fallback_expr(part_map) or None]}}},
        *_PERSON_FACET,
    ]


def osoby_managers(app_spaces, season_variants, rozhodca_labels, delegat_labels, personal_labels, sport_sector="futbal", part_map=None):
    """Rozhodcovia, delegáti a personál z managers[] (roly z roly.json).

    Skupiny (rozhodnutie 12. 7. 2026): rozhodcovia vrátane VAR rolí;
    delegáti = Delegát stretnutia + Pozorovateľ rozhodcov; personál =
    usporiadateľ, hlásateľ, videotechnik.
    Kategória zápasu pre delegované osoby = teams[0].ageCategory.
    Vracia facet s rolami `rozhodcovia` / `delegati` / `personal`.
    """
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {"$project": {"managers": 1, "cat": _cat_zapas(part_map)}},
        {"$unwind": "$managers"},
        {
            "$match": {
                "managers.type.label": {
                    "$in": rozhodca_labels + delegat_labels + personal_labels
                }
            }
        },
        {
            "$project": {
                "pid": "$managers.user._id",
                "cat": 1,
                "rola": {
                    "$switch": {
                        "branches": [
                            {
                                "case": {"$in": ["$managers.type.label", delegat_labels]},
                                "then": "delegati",
                            },
                            {
                                "case": {"$in": ["$managers.type.label", personal_labels]},
                                "then": "personal",
                            },
                        ],
                        "default": "rozhodcovia",
                    }
                },
            }
        },
        {"$group": {"_id": {"rola": "$rola", "pid": "$pid", "cat": "$cat"}}},
        {
            "$facet": {
                "poKategorii": [
                    {"$group": {"_id": {"rola": "$_id.rola", "cat": "$_id.cat"}, "n": {"$sum": 1}}},
                    {"$sort": {"_id.rola": 1, "_id.cat": 1}},
                ],
                "unikatni": [
                    {"$group": {"_id": {"rola": "$_id.rola", "pid": "$_id.pid"}}},
                    {"$group": {"_id": "$_id.rola", "n": {"$sum": 1}}},
                ],
            }
        },
    ]
