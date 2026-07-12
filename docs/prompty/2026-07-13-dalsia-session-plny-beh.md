# Prompt pre novú session — plný dátový beh (všetky zväzy a sezóny)

Pracujeme na projekte **statistika.futbalsfz.sk** — verejný štatistický portál slovenského futbalu.

**Pripoj sa k priečinku** `~/Documents/GitHub/statistika.futbalsfz.sk` — lokálny klon repa `github.com/Slovensky-futbalovy-zvaz/statistika.futbalsfz.sk` (private). Všetko priebežne commituj a pushuj na `main` cez git nástroje.

**Prostredie na spúšťanie ETL:** MongoDB URI je v `.env.local` v koreni repa (gitignorované, read-only). Beh cez `.venv` (pymongo + certifi, `SSL_CERT_FILE` z certifi — viď etl/README.md). ETL sa spúšťa na Macu cez osascript (`do shell script`), dlhé behy na pozadí (`nohup … > /tmp/log 2>&1 < /dev/null &`) a poll logu; sandbox shell nemá prístup k DB. MCP server Sportnet slúži na overovacie dotazy (občas timeoutne → 1 retry).

**Najprv si prečítaj (v tomto poradí):**
1. `README.md` — stav projektu
2. `docs/metodika.md` — ZÁVÄZNÉ pravidlá (vrát. dimenzie pohlavie, normalizácie kategórií, demografie)
3. `docs/report-kvality-dat.md` — sekcie 6–7 (fallback kategórií, pohlavie 7d, demografia)
4. `etl/run.py`, `etl/demografia.py`, `etl/pipelines/__init__.py`, `etl/config/*.json`
5. `data/zvaz/sfz/2025-2026.json` a `data/demografia/obfz-nitra.json` — aktuálne výstupné schémy

**Stav po session 13. 7. 2026:** dimenzia pohlavie hotová (blok `pohlavie` M/F/NEURCENE vo všetkých 6 súboroch; KPI = súčet všetkých pohlaví), normalizácie WUxx→Uxx, Dospelí→ADULTS, U15 mix→U15, U21 v číselníku; demografia v1 (`etl/demografia.py`, ObFZ Nitra 13 sezón, 100 % pokrytie údajov). Podklady pre Bart.sk (`docs/podklady-bart-produkcny-beh.md`) a draft nahlásenia divákov (`docs/sportnet-nahlasenie-divaci.md`) čakajú na odoslanie PO.

**Hlavná úloha: plný dátový beh — všetkých 43 zväzov, všetky sezóny s dátami**
- Cieľ: kompletné `data/zvaz/{id}/{sezona}.json` ako podklad pre frontend (F2) a betu so zväzmi (F5).
- **Polož doplňujúce otázky PO a počkaj na odpovede**, minimálne: (a) rozsah sezón (všetky od 2013/2014 vs. len posledných N); (b) poradie (najprv RFZ, potom ObFZ?); (c) čo s anomáliami počas behu — zbierať a riešiť hromadne na konci?; (d) či rovno spustiť aj demografiu pre ďalšie zväzy.
- Technika: behy dávkovať (43 zväzov × ~12 sezón ≈ 500+ behov po ~30–60 s — počítaj s hodinami; zvarianty: len aktuálna sezóna všetkých zväzov ako rýchla prvá vlna). Log každého behu, anomálie zapísať do reportu kvality.
- Po behu: kontrola `data/index.json`, veľkosť repa, commit po rozumných dávkach (napr. po RFZ).

**Ďalšie úlohy v zásobníku (ak zvýši čas):**
- Demografia ďalších zväzov (SFZ, ZsFZ… — rovnaký vzor ako ObFZ Nitra).
- Kickoff frontendu (F2): štruktúra `web/`, SSG framework, načítanie `data/index.json` + profil zväzu.
- Overiť odoslanie podkladov Bart.sk a nahlásenia divákov (stav v príslušných docs).

**Dôležité technické poznatky:** agregácie po JEDNEJ sezóne; MCP občas timeoutne → 1 retry; `teams._id` ObjectId vs `nominations.teamId` string → `$toString`; roly a kategórie výhradne z `etl/config/*.json`; pohlavie výhradne z `competitions.parts[].rules.gender` cez part mapu; `season.name` normalizovať cez `etl/config/sezony.json`.

**Pravidlá spolupráce:** komunikuj po slovensky; pred začatím práce polož doplňujúce otázky a počkaj na odpovede; všetko plánuj cez task list; nikdy nemaž súbory bez povolenia; rozhodnutia zapisuj do `docs/` a commituj.
