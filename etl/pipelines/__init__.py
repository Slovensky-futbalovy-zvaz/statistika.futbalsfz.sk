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


def cat_fallback_expr(part_map: dict | None):
    """Fallback vekovej kategórie z časti súťaže (competitions.parts[].rules.category).

    `teams.ageCategory` je vyplnené len od sezóny 2024/2025 — pre historické
    sezóny sa kategória mapuje cez match.competitionPart._id → mapa partId→kategória
    (načítaná z kolekcie competitions v run.py). Vracia $switch výraz alebo None.
    """
    if not part_map:
        return None
    return {
        "$switch": {
            "branches": [
                {
                    "case": {"$eq": [{"$toString": "$competitionPart._id"}, pid]},
                    "then": cat,
                }
                for pid, cat in part_map.items()
            ],
            "default": None,
        }
    }


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


def kategorie(app_spaces, season_variants, sport_sector="futbal", part_map=None):
    """Zápasy, góly, karty a diváci po vekových kategóriách.

    divaciPokrytych = počet zápasov s vyplneným protocol.audience (vrátane 0);
    {$gt: [x, null]} je v BSON poradí typov true pre každú ne-null hodnotu.
    """
    return [
        _match_stage(app_spaces, season_variants, sport_sector),
        {
            "$project": {
                "cat": _cat_zapas(part_map),
                "goly": _event_count("goal"),
                "zlte": _event_count("yellow_card"),
                "cervene": _event_count("red_card"),
                "audience": "$protocol.audience",
            }
        },
        {
            "$group": {
                "_id": "$cat",
                "zapasy": {"$sum": 1},
                "goly": {"$sum": "$goly"},
                "zlte": {"$sum": "$zlte"},
                "cervene": {"$sum": "$cervene"},
                "divaci": {"$sum": {"$ifNull": ["$audience", 0]}},
                "divaciPokrytych": {"$sum": {"$cond": [{"$gt": ["$audience", None]}, 1, 0]}},
            }
        },
        {"$sort": {"_id": 1}},
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
