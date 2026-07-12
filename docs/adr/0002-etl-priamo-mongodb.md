# ADR-0002: ETL číta priamo MongoDB (read-only), nie Sportnet API

**Stav:** rozhodnuté · **Dátum:** 12. 7. 2026 · **Rozhodol:** Ján Letko (PO) — uzatvára otázku O2 z projektového plánu a otvorený bod ADR-0001

## Kontext

ADR-0001 nechalo otvorené, či ETL číta priamo MongoDB `sutaze`, alebo Sportnet API (Súťaže v2, CRM). Počas F1 (dátový audit + prvá verzia ETL) sa celý overený postup — register 43 zväzov, normalizácia sezón, číselník rolí, agregácie KPI/kategórie/osoby, meranie pokrytia — realizoval agregačnými pipelines priamo nad MongoDB. API v2 agregácie tohto typu neposkytuje (vracia primárne entity) a CRM API nemá agregovaný demografický endpoint (overené 12. 7. 2026 — demografia sa rieši priamo z DB `sportnet.users`, viď metodika).

## Zvažované varianty

- **A — Sportnet API:** stabilný kontrakt, ale žiadne agregácie — ETL by sťahoval tisíce primárnych záznamov na zväz a sezónu a počítal lokálne; demografia cez CRM API by ťahala osobné záznamy.
- **B — priamo MongoDB (read-only):** odladené `$facet`/`$group` pipelines bežia v DB, prenášajú sa už len agregáty (žiadne osobné údaje mimo DB); riziko zmeny schémy.

## Rozhodnutie

**Variant B — priamy read-only prístup do MongoDB** (databázy `sutaze` + `sportnet` pre demografiu), s ETL účtom s minimálnymi právami.

## Dôsledky

**Pozitívne:** výkon (agregácie v DB, po jednej sezóne), z DB odchádzajú len agregáty — GDPR-friendly aj pre demografiu, žiadna závislosť od rozsahu API.

**Negatívne / mitigácia:** zmena schémy DB môže ETL rozbiť potichu → ETL má validácie výstupov (KPI = súčet kategórií, číselníky kategórií a rolí, prahy pokrytia, extrémy divákov) a anomálie loguje; kľúčové poznatky o schéme sú zapísané v docs/metodika.md (napr. `teams.ageCategory` len od 2024/2025, fallback cez `competitions.parts[].rules.category`).

**Nadväzuje:** dohodnúť so Sportnetom formálne read-only credentials pre produkčný ETL beh a notifikáciu o zmenách schémy.
