# Prompt pre novú session — dimenzia pohlavie v ETL (fáza F1)

Pracujeme na projekte **statistika.futbalsfz.sk** — verejný štatistický portál slovenského futbalu.

**Pripoj sa k priečinku** `~/Documents/GitHub/statistika.futbalsfz.sk` — lokálny klon repa `github.com/Slovensky-futbalovy-zvaz/statistika.futbalsfz.sk` (private). Všetko priebežne commituj a pushuj na `main` cez git nástroje.

**Najprv si prečítaj (v tomto poradí):**
1. `README.md` — stav projektu (F1 v plnom prúde, O1–O7 rozhodnuté)
2. `docs/metodika.md` — ZÁVÄZNÉ pravidlá (kategórie + historický fallback, roly, šport/odvetvie, demografia z sportnet.users, GDPR bez prahu)
3. `docs/report-kvality-dat.md` — najmä sekcie 6–7 (fallback kategórií, pokrytie udalostí, demografia)
4. `etl/run.py`, `etl/pipelines/__init__.py`, `etl/config/*.json` — aktuálny stav ETL
5. `data/zvaz/*/*.json` — aktuálna výstupná schéma (obsahuje `sportSector`, osoby vrát. `personal`)

**Úloha: pridať dimenziu pohlavie (mužské/ženské súťaže)** — rozhodnuté 12. 7. 2026 (O6):
- Zdroj: `competitions.parts[].rules.gender` („M“ / „F“ / prázdne). Zápas pohlavie priamo nenesie → mapovať cez `match.competitionPart._id`, rovnakým mechanizmom ako fallback kategórií (mapa partId→gender, `$switch`; viď `nacitaj_part_mapu` v run.py — rozšíriť o gender).
- **Pred implementáciou over v dátach:** distinct gender po sezónach (vyplnenosť, čo znamená prázdne — pravdepodobne muži/mix), počty ženských súťaží po zväzoch, či existujú zmiešané časti.
- **Polož doplňujúce otázky PO a počkaj na odpovede**, minimálne: (a) schéma výstupu — členenie vo vnútri súboru (`kategorie` → `pohlavie` úroveň? `osoby` po pohlaví?) vs samostatné súbory `{sezona}-zeny.json` vs pole `gender` v KPI; (b) ako zobrazovať súťaže bez vyplneného gender; (c) či KPI zväzu zostávajú súčtom (M+F+neurčené).
- Otestovať na zväze s nenulovým ženským futbalom (napr. SFZ alebo ZsFZ 2025/2026) a regresne overiť, že existujúce výstupy sa bez zapnutia dimenzie nemenia.

**Ďalšie úlohy v zásobníku (ak zvýši čas):**
- Demografia: prvá verzia `data/demografia/{id}.json` — agregáty rok narodenia × pohlavie × rola zo `sportnet.users` (join cez `$toObjectId`, viď metodika; bez prahu — O5).
- Produkčný beh: dohodnúť s Bart.sk read-only DB účet a cron (ADR-0002, ADR-0003); deploy pipeline GitHub → Cloudflare Pages.
- Chybný záznam divákov ObFZ Nitra 2019/2020 U13 (303 610) — nahlásiť Sportnetu / rozhodnúť o vylúčení extrémov.

**Dôležité technické poznatky:** agregácie po JEDNEJ sezóne (viac naraz timeoutuje; chunky ≤ 4–5 appSpace); MCP občas timeoutne → 1 retry; `teams._id` ObjectId vs `nominations.teamId` string → `$toString`; roly a kategórie výhradne z `etl/config/*.json`.

**Pravidlá spolupráce:** komunikuj po slovensky; pred začatím práce polož doplňujúce otázky a počkaj na odpovede; všetko plánuj cez task list; nikdy nemaž súbory bez povolenia; rozhodnutia zapisuj do `docs/` a commituj.
