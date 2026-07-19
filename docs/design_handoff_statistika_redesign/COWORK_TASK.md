# Zadanie pre Claude Cowork — kompletná prerábka dizajnu (všetky stránky)

> Skopíruj celý tento súbor ako úlohu do Claude Cowork (pracuje nad klonom repozitára `statistika.futbalsfz.sk`).

---

## Úloha
Kompletne prerob vizuál a UX verejného portálu **statistika.futbalsfz.sk** podľa dizajnovej referencie v priečinku `design_handoff_statistika_redesign/`. Cieľom je, aby **všetky stránky** produkčného webu (`web/`, Astro) zodpovedali prototypu.

## Zdroje (čítaj v tomto poradí)
1. `design_handoff_statistika_redesign/README.md` — vizuálna špecifikácia (brand tokeny str. 31, typografia, rozmery, všetkých 5 obrazoviek, logika grafov, dátové kontrakty, dátové medzery).
2. `design_handoff_statistika_redesign/IMPLEMENTATION.md` — návod pre Astro + ECharts (štruktúra súborov, helpery, hotové ECharts recepty, poradie prác).
3. `design_handoff_statistika_redesign/theme.css` — hotové Tailwind v4 `@theme` brand tokeny.
4. `design_handoff_statistika_redesign/Statistika SFZ.dc.html` + `sfz-data.js` — interaktívny prototyp s reálnymi dátami (referencia vzhľadu aj logiky; čítaj zdroj pre presné hodnoty a správanie grafov).
5. `design_handoff_statistika_redesign/reference-data/` — `mapa.json` (SVG mapy SR) a `zvazy-register.json` (`geoName → id`).

## Rozsah — VŠETKY stránky
- **Prehľad** (`/`, index) — hero, KPI band (vrátane karty **Súťaže**), interaktívna choropleth mapa SR (SFZ/RFZ/ObFZ + metriky), rebríček, small-multiples osôb, **2× sunburst** (súťaže: odvetvie→RFZ→ObFZ; osoby: odvetvie→úroveň→rola→vek) so **sport (futbal/futsal, oba naraz)** a **pohlavie** filtrami, **veková pyramída SR**.
- **Profil zväzu** (`/zvaz/[id]/[sezona]`, futsal `/zvaz/[id]/[odvetvie]/[sezona]`) — header s **vyhľadávateľným výberom zväzu (ObFZ vnorené pod RFZ)**, KPI s medziročným porovnaním, **zápasy podľa kategórií s drill-down**, osoby, veková pyramída zväzu.
- **Porovnania** (`/porovnania/[uroven]/[sezona]`) — zoraditeľná tabuľka, **priame porovnanie 2–5 zväzov cez radar** (normalizované na max úrovne, skutočné hodnoty v tooltipe), **bump chart** poradia RFZ v čase.
- **Demografia** (`/demografia`, `/demografia/[id]`) — **multi-line** (jedna čiara na vybranú kategóriu/úroveň), rozpad aktuálnej sezóny, small-multiples rolí.
- **Projekty** (`/projekty`, `/projekty/[id]`) — deti/školy/tímy, trend, pohlavie, vek.

## Povinné pravidlá
- **Nemeniť dátové kontrakty** — čítaj existujúce `data/*.json` (schémy v `web/src/lib/data.ts` a README). Žiadne volania interných API (ADR-0001).
- **Brand tokeny** presne podľa `theme.css` (modrá `#1450df`, červená `#ec1c24`, sivá `#bbbdbf`, čierna `#070504` + odvodené neutrály, region/kategória farby). Fonty **Archivo** + **Archivo Expanded**.
- **Custom dropdowny** pre výber sezóny aj zväzu — **žiadny natívny `<select>`**.
- **Responzivita**: desktop inline nav + na mobile (< 760 px) **hamburger menu**; dvojstĺpce sa zvinú (< 820 px). Over, že sa desktop ovládače a mobilný hamburger **nezobrazujú súčasne**.
- **Interaktívne časti = Astro islands** (`client:load`/`client:visible`): mapa, sunbursty, radar, bump, pyramída, pickery, tabuľka, demografia lines. Grafy cez **ECharts** (tree-shake cez `echarts/core`), mapa cez **inline SVG** z `mapa.json`.
- Zachovať **SSG/SEO** (predgenerované profily × sezóna) a existujúci Astro routing/permalinky.
- **Beta badge** „BETA VERZIA" pod logom v hlavičke; **oficiálne kruhové logo SFZ**.
- Čísla vždy `tabular-nums` + slovenské formátovanie (`Intl.NumberFormat('sk-SK')`); medziročná delta zelená/červená, pre karty (karty žlté/červené) invertovaný „dobrý smer".

## Dátový doplnok (ETL) — jediná zmena mimo `web/`
Doplň ETL agregát **osoby per úroveň × rola × veková úroveň** do `data/sumar/*.json` (`sunburstOsoby` dnes má len rola→vek). **Úroveň SFZ = vrátane ULK / Niké liga** (rovnaké rozlíšenie ako pri súťažiach — rozhodnutie PO). Do dodania nechaj 4-prstencový sunburst osôb ako placeholder s viditeľnou poznámkou „ilustračné dáta" (viď IMPLEMENTATION.md).

## Akceptačné kritériá
- Každá z 5 stránok vizuálne zodpovedá prototypu (rozloženie, farby, typografia, komponenty, stavy).
- Všetky grafy sa vykresľujú (žiadne prázdne plochy), interakcie fungujú (prepínače úrovní/metrík/sezón, drill-down, sort, radar výber, filtre, pyramída, mobilné menu).
- Build prejde (`pnpm build`), žiadne chyby v konzole, mobil OK.
- Čísla sedia s `data/*.json` pre aktuálnu aj historické sezóny.

## Postup a odovzdanie
1. Prečítaj referencie, priprav `lib/format.ts`, `lib/palette.ts`, aktualizuj `styles/global.css` podľa `theme.css`.
2. Implementuj po stránkach v poradí z IMPLEMENTATION.md (Header → Prehľad → grafy → Profil → Porovnania → Demografia → Projekty → ETL doplnok).
3. Priebežne commituj po logických celkoch; nakoniec **commit + push do `main`** (Vercel nasadí automaticky).
4. Krátko zhrň, čo si zmenil a čo (ak niečo) zostáva na PO (napr. re-beh ETL histórie po pridaní úrovne osôb).
