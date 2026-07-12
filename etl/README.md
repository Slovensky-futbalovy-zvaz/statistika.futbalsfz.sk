# ETL pipeline

Agregácie zo Sportnet DB (MongoDB `sutaze`, kolekcia `matches`) do publikovateľných JSON súborov. Prvá verzia hotová 12. 7. 2026 — pipelines verifikované proti vzorkám ObFZ Nitra (2024/2025, 2025/2026; 100 % zhoda) a všeobecnosť overená na ZsFZ 2025/2026.

## Štruktúra

```
etl/
├── config/
│   ├── zvazy.json          # register 43 zväzov (appSpace, úroveň, názov) — overený, nie hádaný
│   ├── sezony.json         # normalizačná mapa season.name → kanonická sezóna
│   ├── roly.json           # overený číselník rolí osôb (rozhodcovia, delegáti, personál, tréneri)
│   └── sporty.json         # číselník športu a odvetví futbalu (futbal/futsal/…) zo Sportnet API
├── pipelines/              # agregačné pipelines (kategórie, družstvá, hráči, tréneri, rozhodcovia+delegáti)
├── validate/               # validácie výstupov (KPI = súčet kategórií, pokrytie divákov, anomálie)
└── run.py                  # CLI beh: agregácia → validácia → zápis JSON → aktualizácia index.json
```

## Použitie

```bash
export MONGODB_URI="mongodb://…"          # prístup do DB sutaze (read-only postačuje)
python etl/run.py --zvaz obfz-nitra --sezona 2025/2026
python etl/run.py --zvaz obfz-nitra --all-sezony      # všetky kanonické sezóny s dátami
python etl/run.py --zvaz zsfz --sezona 2025/2026
python etl/run.py --zvaz sfz --sezona 2025/2026 --sport-sector futsal   # futsal patrí pod SFZ
```

Výstup: `data/zvaz/{id}/{sezona}.json` + aktualizovaný `data/index.json`. Anomálie sa logujú (WARNING); nenulový exit kód pri nezrovnalostiach počtov.

## Zásady (záväzné, viď docs/metodika.md)

- Len `closed: true` zápasy.
- appSpace vždy z overeného registra (`--zvaz` = id z `zvazy.json`; SFZ má dva appSpace).
- Súťaže sa zlučujú cez `competitionGroupId`; nikdy regex na názvy súťaží.
- Vekové kategórie z `teams[].ageCategory`; `nominations.teamId` (string) ↔ `teams._id` (ObjectId) cez `$toString`.
- Roly osôb výhradne z `config/roly.json` (texty identické vo všetkých 43 zväzoch, overené 12. 7. 2026).
- Osoby: publikovať unikáty aj súčty po kategóriách s poznámkou (dvojité pôsobenie).
- Diváci vždy s % pokrytia; nedostatočné pokrytie sa nezobrazí, neodhaduje.
- Agregácie po JEDNEJ sezóne (viac sezón naraz timeoutuje); 1 retry na transportný timeout.
