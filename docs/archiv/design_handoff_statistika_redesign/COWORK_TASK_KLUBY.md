# Zadanie pre Claude Cowork — Klubové štatistiky (nová sekcia)

> Skopíruj celý tento súbor ako úlohu do Claude Cowork. Predpoklad: základný redizajn (`COWORK_TASK.md`) je hotový/nasadený. Táto úloha **pridáva novú sekciu „Kluby"** do webu `web/` (Astro + ECharts + Tailwind) konzistentne s dizajn systémom.

---

## Úloha
Pridaj **klubové štatistiky** — novú entitu „klub" so zoznamom, profilom, porovnaním a napojením na profil zväzu. Vizuál a UX **presne podľa** `design_handoff_statistika_redesign/DESIGN_SYSTEM.md` (kapitola 5 je návod krok-za-krokom) a existujúcich komponentov. Znovupoužívaj, nekresli nanovo.

## Zdroje (čítaj najprv)
1. `design_handoff_statistika_redesign/DESIGN_SYSTEM.md` — pravidlá + §5 „Ako pridať novú funkciu (kluby)".
2. `design_handoff_statistika_redesign/README.md` + `IMPLEMENTATION.md` — vizuál, Astro/ECharts recepty, helpery.
3. `design_handoff_statistika_redesign/theme.css` — tokeny.
4. Existujúci profil zväzu vo `web/` = **primárna šablóna** pre profil klubu.

## Dátové kontrakty (ETL → statické JSON, ADR-0001; NEmeniť existujúce)
Priprav nové súbory s **rovnakými kľúčmi** ako pri zväzoch (kvôli znovupoužitiu komponentov):
- `data/kluby/index.json` — `{ generatedAt, kluby[]{ id, nazov, zvaz(id ObFZ/RFZ pod ktorý patrí), uroven, mesto?, sezony[] } }` (na picker, routing, filtrovanie).
- `data/klub/{klubId}/{sezona}.json` — `{ klub, sezona, sportSector, generatedAt, methodologyFlags, kpi{ zapasy, druzstva, goly, divaci, zlteKarty, cerveneKarty }, kategorie{ <ageCategory>:{ zapasy, druzstva, goly, zlte, cervene, divaci, divaciPokrytych } }, pohlavie{…}, osoby{ <rola>:{ unikatni, poKategorii } } }`.
  - Klub môže mať viac družstiev/kategórií (mládež + dospelí) — `kategorie` a `druzstva` to pokrývajú rovnako ako zväz.
- `data/porovnania/kluby/{zvazId}/{sezona}.json` (voliteľné, pre rebríček klubov v rámci zväzu) — `{ uroven:'klub', zvaz, sezona, zvazy: kluby[]{ id, nazov, zapasy, druzstva, goly, divaci, zlteKarty, cerveneKarty, hraci, golyNaZapas, divaciNaZapas } }` (rovnaký tvar ako `porovnania/{uroven}/{sezona}.json`).
- Rozšír `web/src/lib/data.ts` o čítačky: `getKluby()`, `getKlub(id,sezona)`, `getKlubySezony(...)`, `getKlubyPorovnanie(zvaz,sezona)`.

## Stránky (SSG, predgeneruj z indexu)
- `/kluby` — **rozcestník/zoznam**: vyhľadávací picker (kluby **odsadené pod svojím zväzom/súťažou**, search bez diakritiky) + zoraditeľná tabuľka klubov (v rámci zvoleného zväzu/úrovne) s KPI stĺpcami. Klik → profil klubu.
- `/klub/[id]/[sezona]` — **profil klubu** = klon šablóny profilu zväzu: header (pill „Klub" + názov + „Zväz: …" odkaz), **vyhľadávací výber iného klubu**, KPI s medziročným porovnaním, **zápasy podľa kategórií s drill-down**, osoby (ak dostupné), veková pyramída klubu (ak existuje `data/demografia-klub/{id}.json` — inak vynechaj), metodická poznámka.
- (Voliteľne) `/klub/[id]/[odvetvie]/[sezona]` ak bude futsal aj na klube.
- **Prepojenia:** na profile zväzu pridaj sekciu/odkaz „Kluby v tomto zväze" → filtrovaný `/kluby`.

## Komponenty — znovupouži
`KpiCard`/`KpiBand`, `CategoryBars` (drill-down), `PorovnanieTable` (sort), `CompareRadar` (2–5 klubov), `AgePyramid`, custom `SeasonPicker`, hierarchický picker (uprav `ZvazPicker` na generický: zväz→klub). Žiadne nové farby mimo `theme.css`; ak treba akcent pre ligu/súťaž, pridaj token.

## Navigácia
Pridaj **„Kluby"** do hlavného menu (desktop nav aj mobilný hamburger) — poradie: Prehľad, Profil zväzu, Kluby, Porovnania, Demografia, Projekty.

## Pravidlá (rovnaké ako zvyšok portálu)
- Custom dropdowny (žiadny natívny `<select>`); čísla `tabular-nums` + `sk-SK`; delta so správnym „dobrým smerom" (karty invertované).
- Interaktívne časti = Astro islands + ECharts (tree-shake); mapa netreba (klub je bod, nie polygón) — ak chceš, malý lokátor cez mesto je voliteľný.
- Responzíva: hamburger < 760px, stĺpce sa zvinú < 820px, `overflow-x` na tabuľkách/grafoch.
- Prázdne/čiastočné metriky → „—" + metodická poznámka; SSG/SEO + permalink `/klub/[id]/[sezona]`.
- GDPR: len agregáty, žiadne menné zoznamy hráčov.

## Akceptačné kritériá
- `/kluby` a `/klub/[id]/[sezona]` vizuálne a UX zhodné so systémom (rovnaké komponenty, tokeny, stavy).
- Picker klub↔zväz funguje (hierarchia + search), tabuľka triedi, KPI YoY sedí, kategórie drill-down, radar porovnanie klubov.
- Build `pnpm build` bez chýb; mobil OK; čísla sedia s `data/klub/*`.
- Odkazy zväz ↔ kluby fungujú obojsmerne.

## Postup a odovzdanie
1. ETL: vygeneruj `data/kluby/index.json`, `data/klub/{id}/{sezona}.json` (+ voliteľné porovnania). 2. `data.ts` čítačky. 3. `/kluby` (picker + tabuľka). 4. `/klub/[id]/[sezona]` (klon profilu zväzu). 5. Nav + prepojenia zo zväzu. 6. Commit po celkoch → **push do `main`** (Vercel nasadí). 7. Krátke zhrnutie zmien + čo zostáva na PO (napr. rozsah sezón/športov pre kluby).
