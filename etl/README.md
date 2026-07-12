# ETL pipeline

Agregácie zo Sportnet DB (MongoDB `sutaze`) do publikovateľných JSON súborov. Implementácia vo fáze F1.

## Plánovaná štruktúra

```
etl/
├── config/
│   ├── zvazy.json          # register 43 zväzov (appSpace, úroveň, názov) — overený, nie hádaný
│   └── sezony.json         # normalizačná mapa season.name → kanonická sezóna
├── pipelines/              # agregačné pipelines (základ: skill sfz-sezonna-statistika)
├── validate/               # validácie výstupov (počty, povinné polia, anomálie)
└── run.py                  # denný beh: agregácia → validácia → publikácia
```

## Zásady (záväzné, viď docs/metodika.md)

- Len `closed: true` zápasy.
- appSpace vždy z overeného registra.
- Nikdy regex na názvy súťaží; premenované súťaže zlúčiť explicitne.
- Vekové kategórie z `teams[].ageCategory`.
- Osoby: publikovať unikáty aj súčty po kategóriách s poznámkou.
- Diváci vždy s % pokrytia.
