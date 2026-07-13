# ADR-0004: Index kolekcie `matches` pre ETL agregácie

**Stav:** navrhnuté — cielený index čaká na DBA/PO; variant B (`--hint`) dočasne aplikovaný 13. 7. 2026 (zsfz doplnený, 43/43) · **Dátum:** 13. 7. 2026 · **Rozhoduje:** Ján Letko (PO) + Sportnet/DBA

## Kontext

Všetkých 7 agregácií ETL (`etl/pipelines`) začína rovnakým filtrom `$match`:

```
{ appSpace, closed: true, "rules.sport_sector", "season.name": { $in: varianty } }
```

Počas plného behu histórie (vlna 2, 13. 7. 2026) agregácia `kategorie` pre **ZsFZ 2021/2022** opakovane prekračovala časový limit (`MaxTimeMSExpired`) — pri 120 s aj pri 600 s; timeoutuje aj priamy dotaz cez MCP. Ostatné zväzy/sezóny prešli. Dôsledok: nevygenerované zsfz 2021/2022–2024/2025.

Diagnóza cez `explain` (queryPlanner, 13. 7. 2026): kolekcia `matches` má **44 indexov**, ale **žiadny nepokrýva kombináciu** `appSpace + closed + rules.sport_sector + season.name`. Optimalizátor zvolil `closed_1___issfMatchStatus_1_season.name_1` → IXSCAN vráti **všetky uzavreté zápasy danej sezóny naprieč celým Slovenskom**, `appSpace` a `rules.sport_sector` sa filtrujú až vo FETCH v pamäti (nákladné načítanie desiatok tisíc veľkých dokumentov). ZsFZ 2021/2022 je prvá plná posezóna po COVIDe (najviac zápasov v SR; staršie ZsFZ sezóny COVIDom skrátené) → najväčšia medzimnožina → prešvihne limit. Sekundárne: `optimizationTimeMillis ≈ 1,9 s` a `maxIndexedAndSolutionsReached: true` — 44 indexov spomaľuje aj samotné plánovanie a opakuje sa pri každej agregácii.

Príčinou teda nie je počet súťažných častí (30, max 2/súťaž) ani chyba v pipeline (0 KPI-nezhôd v celom behu).

## Zvažované varianty

- **A — cielený zložený index** `{ appSpace:1, closed:1, "rules.sport_sector":1, "season.name":1 }`. Filter sa zmení na tesný IXSCAN presne na cieľové zápasy; zrýchli všetkých 7 agregácií pre všetky zväzy a sezóny. Vyžaduje DDL na produkčnej DB (vlastní Sportnet).
- **B — ETL `--hint` na existujúci `appSpace`-index** (bez DDL). Vynúti scan obmedzený na `appSpace + closed` (len daný zväz), čím sa vyhne načítaniu dát iných zväzov. Menej účinné než A (season/sport sa stále filtrujú v pamäti), ale nevyžaduje zásah do DB.
- **C — vyšší `--max-time-ms`** (núdzovka). Nerieši príčinu; ťažké sezóny len dostanú viac času, beh je pomalý a krehký.

## Rozhodnutie

**Cieľový stav A** (cielený index) — jednorazová zmena s najväčším a najširším efektom; poradie polí podľa pravidla ESR (rovnostné `appSpace`/`closed`/`rules.sport_sector` najprv, `season.name` s `$in` posledné):

```js
db.matches.createIndex(
  { appSpace: 1, closed: 1, "rules.sport_sector": 1, "season.name": 1 },
  { name: "etl_appSpace_closed_sport_season" }
)
```

Kým index nevznikne, **dočasne B** (`--hint`) na dogenerovanie chýbajúcich zsfz sezón; **C** len ako fallback. ETL nemodifikuje produkčnú DB — index vytvára Sportnet/DBA po schválení.

## Dôsledky

**Pozitívne:** zrýchlenie celého ETL (nielen zsfz 2021/22), odstránenie timeoutov, kratšie budúce behy vlny „aktuálna sezóna“ aj historické re-behy.

**Negatívne / kompromisy:** ďalší index na už tak preindexovanej kolekcii (44) — mierne spomalí zápisy a zväčší úložisko; preto samostatne zvážiť **revíziu/odstránenie nepoužívaných indexov** (opatrne, mimo tohto ADR).

**Otvorené:** revízia 44 indexov `matches` (plánovací overhead); overenie efektu A cez `explain executionStats` po vytvorení; prípadné pridanie `season._id` variantu, ak sa v pipeline prejde na `season._id` namiesto `season.name`.
