# Prompt pre novú session — ETL skript (fáza F1)

Pracujeme na projekte **statistika.futbalsfz.sk** — verejný štatistický portál slovenského futbalu.

**Pripoj sa k priečinku** `~/Documents/GitHub/statistika.futbalsfz.sk` — je to lokálny klon repa `github.com/Slovensky-futbalovy-zvaz/statistika.futbalsfz.sk` (private). Všetko priebežne commituj a pushuj na `main` cez git nástroje.

**Najprv si prečítaj (v tomto poradí):**
1. `README.md` — prehľad projektu a fáz
2. `docs/metodika.md` — ZÁVÄZNÉ pravidlá práce s dátami (appSpace register, competitionGroupId, closed:true, vekové kategórie, osoby, GDPR)
3. `docs/report-kvality-dat.md` — výsledky dátového auditu F1 a zvyšné úlohy
4. `etl/config/zvazy.json` + `etl/config/sezony.json` — overený register 43 zväzov a normalizácia sezón
5. `data/zvaz/obfz-nitra/*.json` — cieľová JSON schéma (vzorky s reálnymi dátami)

**Úloha: prvá verzia ETL skriptu** (`etl/run.py` + moduly podľa `etl/README.md`):
- Python skript, ktorý pre zadaný zväz (id z registra) a sezónu vygeneruje `data/zvaz/{id}/{sezona}.json` presne podľa schémy vzoriek.
- Zdroj: MongoDB `sutaze` cez lokálny MCP server `sportnet-mcp-server` (počas vývoja v session cez MCP nástroje; skript píš tak, aby vedel bežať aj samostatne cez pymongo s connection stringom z env premennej).
- Agregácie prevziať z postupu, ktorý je odladený (viď metodika + hotové vzorky): KPI, kategórie/úrovne, osoby (hráči/tréneri/rozhodcovia/delegáti, unikáty + po kategóriách).
- Dôležité technické poznatky: `teams._id` je ObjectId, `nominations.teamId` string → porovnávať cez `$toString`; agregácie po JEDNEJ sezóne (viac sezón naraz timeoutuje); MCP občas timeoutne → 1 retry.
- Súťaže zlučovať cez `competitionGroupId`; pohlavie z `parts[].rules.gender`; veková úroveň primárne z `teams[].ageCategory` na zápase.
- Validácie výstupu: KPI = súčet kategórií; % pokrytia divákov; anomálie logovať.
- Otestovať na ObFZ Nitra (2024/2025, 2025/2026) — výsledok sa musí zhodovať s existujúcimi vzorkami v `data/` — a potom vygenerovať aspoň jeden ďalší zväz (napr. ZsFZ) na overenie všeobecnosti.

**Zvyšné úlohy F1 popri tom** (viď report, sekcia 5): pokrytie udalostí po kategóriách, distinct roly `managers.type.label` po zväzoch, overenie CRM API pre demografiu (O7).

**Pravidlá spolupráce:** komunikuj po slovensky; pred začatím práce polož doplňujúce otázky a počkaj na odpovede; všetko plánuj cez task list; nikdy nemaž súbory bez povolenia; rozhodnutia zapisuj do `docs/` a commituj.
