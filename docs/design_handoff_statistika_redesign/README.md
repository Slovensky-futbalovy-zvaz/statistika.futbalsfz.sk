# Handoff: statistika.futbalsfz.sk — vizuálny redizajn

## Overview
Kompletný vizuálny redizajn verejného štatistického portálu slovenského futbalu (SFZ → 4 RFZ → 38 ObFZ). Pokrýva: **Prehľad** (hero, národné KPI, interaktívna mapa SR na 3 úrovniach, rebríček, small-multiples osôb, 2× sunburst, veková pyramída SR), **Profil zväzu** (KPI s medziročným porovnaním, vekové kategórie s drill-down, osoby, veková pyramída, vyhľadávateľný výber zväzu), **Porovnania** (zoraditeľná tabuľka, priame porovnanie 2–5 zväzov cez radar, bump chart poradia RFZ v čase), **Demografia** (multi-line trend podľa vekových kategórií/úrovní, rozpad aktuálnej sezóny, small-multiples rolí), **Projekty** (grassroots — deti/školy/tímy, trend, pohlavie, vek).

## About the Design Files
Súbory v tomto balíku sú **dizajnová referencia vytvorená v HTML** (prototyp ukazujúci vzhľad a správanie) — **nie sú to produkčné súbory na priame nasadenie.** Úloha je **preklopiť tento dizajn do existujúceho stacku webu**: **Astro + TypeScript (SSG), Apache ECharts (islands), inline SVG choropleth, Tailwind CSS v4 s brand tokenmi SFZ** (viď `web/README.md`, ADR-0005). Väčšina obrazoviek už v produkcii existuje — tento balík definuje **cieľový vizuál, rozloženie, farby, typografiu a logiku grafov**, ktoré treba zjednotiť/doplniť.

Prototyp je postavený ako jeden „Design Component" (`Statistika SFZ.dc.html`) — celá logika je v JS triede, grafy sú kreslené ručne cez SVG. **V produkcii použite ECharts** (ako doteraz) pre sunburst/radar/line/bump a **inline SVG** pre choropleth mapu. Ručné SVG grafy z prototypu sú referencia rozmerov a vzhľadu, netreba ich kopírovať 1:1.

## Fidelity
**High-fidelity (hifi)** — finálne farby, typografia, rozostupy, rádiusy a interakcie. Recreate pixel-perfect s Tailwind + ECharts. Čísla v prototype sú **reálne dáta** z `data/` (stav ~19.7.2026), takže sedia s produkčnými JSON.

---

## Design Tokens

### Farby (brand manuál SFZ, str. 31 — overené hex)
| Token | Hex | Pantone | Použitie |
|---|---|---|---|
| SFZ modrá (primary) | `#1450df` | 2935 C | primárna, grafy, aktívne stavy, mapa |
| SFZ červená | `#ec1c24` | Warm Red C | badge Beta, negatívny trend, ženy, akcenty |
| SFZ sivá | `#bbbdbf` | Cool Grey 6 C | jemné oddeľovače/neutrál |
| SFZ čierna | `#070504` | Black 6 C | text (base) |

### UI neutrály (odvodené, tón do studena)
| Token | Hex | Použitie |
|---|---|---|
| ink | `#0b0a0a` | hlavný text |
| muted | `#6c7178` | sekundárny text, labely |
| line | `#e7e9ec` | orámovania, gridlines |
| bg | `#f4f5f7` | pozadie stránky |
| card | `#ffffff` | pozadie kariet |
| track | `#eceef1` | pozadie barov/track |
| good (rast) | `#12a06b` | pozitívny medziročný trend |

### Farby regiónov (RFZ) — konzistentne v mape, legendách, bump charte
| RFZ | id | Hex |
|---|---|---|
| Bratislavský FZ | `bfz` | `#1450df` |
| Západoslovenský FZ | `zsfz` | `#2f9bff` |
| Stredoslovenský FZ | `ssfz` | `#12a06b` |
| Východoslovenský FZ | `vsfz` | `#f0961b` |
| SFZ — vlastné súťaže (v sunburste) | — | `#7a44e0` |

### Farby vekových kategórií (skupín)
| Kategória | Úrovne (ageCategory) | Hex |
|---|---|---|
| Dospelí | ADULTS | `#1450df` |
| Dorast | U19, U18, U17, U16 | `#2f9bff` |
| Žiaci | U15, U14, U13, U12 | `#12a06b` |
| Prípravky | U11, U10, U09, U08, U07 | `#f0961b` |

### Typografia
- **Archivo** (Google Fonts, váhy 400–900) — text, UI, čísla (`font-variant-numeric: tabular-nums` na všetkých číslach).
- **Archivo Expanded** (600–900) — veľké nadpisy (hero H1, logo „ŠTATISTIKY").
- Kickery/labely: 11–12px, `font-weight:700`, `letter-spacing:.12–.18em`, `text-transform:uppercase`, farba muted alebo modrá.
- Nadpisy sekcií: `clamp(21px,2.4vw,28px)`, weight 800, `letter-spacing:-.01em`.
- Hero H1: `clamp(28px,4.6vw,52px)`, Archivo Expanded 800.
- KPI čísla: `clamp(24px,3vw,32px)`, weight 800.

### Rozmery
- Rádiusy: karty 16px, menšie prvky 8–11px, pills 16–22px.
- Tiene: karty `0 1px 2px rgba(11,10,10,.04)`; dropdowny/panely `0 16px 40px rgba(11,10,10,.16)`.
- Obsahový kontajner: `max-width:1240px; margin:0 auto; padding:34px 24px 70px`.
- Karta padding: 16–20px.
- Grid rozostupy: 14–16px.

---

## Layout & responzivita
- **Sticky header** (z-index 50): priehľadné biele pozadie + `backdrop-filter: blur(14px)`, spodné orámovanie `#e7e9ec`. Obsah v kontajneri 1240px.
  - Vľavo: kruhové logo SFZ (44×44, `assets/sfz-logo-official.svg`) + textová časť „ŠTATISTIKY / SLOVENSKÉHO FUTBALU" + **badge „BETA VERZIA"** (červený pill `#ec1c24`, biely text, 9px uppercase) **pod** textom loga.
  - Vpravo: navigácia (Prehľad, Profil zväzu, Porovnania, Demografia, Projekty) + **výber sezóny** (custom dropdown).
- **Responzívne bez media queries** kde sa dá: gridy `repeat(auto-fit, minmax(...,1fr))`, `flex-wrap`, `clamp()` na typografiu, `overflow-x:auto` na širokých grafoch/tabuľkách.
- **Breakpoint ~820px**: dvojstĺpcové bloky (mapa+rebríček, sunbursty) sa menia na jeden stĺpec (v prototype riadené `window.innerWidth`, v Astro použite Tailwind `lg:` triedy).
- **Breakpoint ~760px (mobil)**: navigácia + sezóna sa zbalia do **hamburger menu (☰)** — tlačidlo vpravo, po kliknutí dropdown panel (240px) so zvislým zoznamom položiek (aktívna zvýraznená modrou) + výber sezóny; klik mimo zatvára (overlay).

---

## Screens / Views

### 1. Prehľad (Domov)
- **Hero**: modrý gradient `linear-gradient(120deg,#0a2a8f,#1450df 60%,#2f6bff)`, rádius 20, padding `clamp(26px,4vw,46px)`, biely text; pill „Sezóna … · celé Slovensko", H1 „Slovenský futbal v číslach", odsek popisu. Dekoratívny radiálny glow vpravo hore.
- **KPI band**: 7 kariet (auto-fit minmax 150px): Súťaže, Odohraté zápasy, Družstvá, Strelené góly, Diváci, Žlté karty, Červené karty. Každá: uppercase label (muted), veľké číslo (tabular-nums), **medziročná zmena** (▲ zelená / ▼ červená + „medziročne"). Pre karty (žlté/červené) je „dobré" klesanie → farba delty invertovaná (`good=false`).
- **Mapa SR** (ľavá, ~1.6fr) + **Rebríček** (pravá, ~1fr):
  - Prepínač úrovne: **SFZ / RFZ / ObFZ** (segmented toggle).
  - Metriky (taby-pills): Zápasy, Družstvá, Góly, Diváci, Hráči.
  - Choropleth: sekvenčná modrá škála (`#dbe6ff` → `#1450df`) podľa hodnoty metriky; hover = červené orámovanie + tooltip (názov + hodnota); klik na región → Profil zväzu. Legenda min–max s gradientom.
  - SFZ úroveň = celé Slovensko ako jeden útvar; RFZ = 4 regióny; ObFZ = 38 oblastí.
  - Rebríček: top 10 podľa metriky, horizontálne bary (modré), klik → profil.
- **Osoby vo futbale** (small multiples): 5 kariet (Hráči/Tréneri/Rozhodcovia/Delegáti/Personál) — číslo + delta + sparkline za ~13 sezón.
- **Celoslovenský súhrn** — filtre + 2 sunbursty vedľa seba:
  - **Filtre (spoločné pre oba)**: „Šport:" Futbal / Futsal (oba môžu byť zapnuté súčasne) · „Pohlavie:" Všetci / Muži / Ženy (vzťahuje sa len na sunburst súťaží).
  - **Súťaže — štruktúra pyramídy**: sunburst 3 prstence **odvetvie → RFZ → ObFZ** (SFZ→RFZ→ObFZ). Farby podľa RFZ; SFZ vlastné súťaže `#7a44e0`. Pohlavie filtruje cez `pohlavie.{M|F}` na listoch. Stred zobrazuje spolu / hover hodnotu.
  - **Osoby — úroveň, rola a vek**: sunburst 4 prstence **odvetvie → úroveň (SFZ/RFZ/ObFZ) → rola → veková úroveň**. Farby úrovní: SFZ `#1450df`, RFZ `#12a06b`, ObFZ `#f0961b`. **⚠ Placeholder — viď „Dátové medzery" nižšie.**
- **Veková pyramída — celé Slovensko**: M vľavo (modrá) / Ž vpravo (červená) podľa vekových pásiem; prepínač rola (pills). Zdroj `sumar/demografia.json`.

### 2. Profil zväzu
- **Header**: pill úrovne (RFZ v jeho farbe), názov zväzu (H1), „Región: …". Vpravo **vyhľadávateľný výber zväzu**: trigger pill s aktuálnym názvom → panel s **input „Hľadať zväz…"** (autocomplete, ignoruje diakritiku) a zoznamom **ObFZ vnorené (odsadené) pod svoj RFZ**; SFZ na vrchu. Overlay zatvára.
- **KPI**: Súťaže, Zápasy, Družstvá, Góly, Diváci, Žlté karty, Červené karty — s medziročnou zmenou vs. predchádzajúca sezóna.
- **Zápasy podľa vekových kategórií**: 4 skupinové bary (Dospelí/Dorast/Žiaci/Prípravky) — **klik rozbalí** konkrétne vekové úrovne (U-kódy) s bar + počty (zápasy, družstvá).
- **Osoby v súťažiach**: karty Hráči/Tréneri/Rozhodcovia/Delegáti/Personál — `unikatni` + mini-bary rozpadu po kategóriách (`poKategorii`). Poznámka o viacnásobnom pôsobení.
- **Veková pyramída** zväzu (ak existuje `demografia/{id}.json`).
- Metodická poznámka (closed zápasy, pokrytie divákov, súčet po kategóriách).

### 3. Porovnania
- Prepínač úrovne: **RFZ / ObFZ**.
- **Zoraditeľná tabuľka**: stĺpce Zväz, Zápasy, Družstvá, Góly, Diváci, Hráči, Góly/zápas, Diváci/zápas, ŽK, ČK. Klik na hlavičku triedi (toggle smer). Farebná bodka RFZ pri názve. Klik na riadok → profil. Zebra + hover.
- **Priame porovnanie zväzov**: chips výber **2–5 zväzov** (limit 5, min 2), každý v svojej farbe (paleta). **Radar** normalizovaný na maximum úrovne (100 % = najlepší zväz v metrike), osi: Zápasy, Diváci/zápas, Góly/zápas, Diváci, Hráči, Góly, Družstvá; **skutočné hodnoty v tooltipe**.
- **Bump chart**: vývoj **poradia 4 RFZ** v čase (14 sezón) podľa zvolenej metriky (Diváci/zápas, Góly/zápas, Hráči, Zápasy, Diváci); čiary vo farbách RFZ, os Y = poradie 1.–4.

### 4. Demografia
- **10-ročný trend — vekové úrovne**: **jedna čiara na každú vybranú vekovú kategóriu/úroveň** (nie filter jednej čiary). Prepínač rola (pills). **Pills výberu čiar**: „Kategórie (všetky)" (default = 4 kategórie ako 4 čiary) + jednotlivé kategórie + jednotlivé U-úrovne. Legenda s poslednou hodnotou.
  - Výpočet zo `sumar/demografia.json` (resp. `demografia/{id}.json`): pre sezónu `S` je `endYear = parseInt(S.split('/')[1])`, pre každý rok narodenia `yr`: `age = endYear - yr`, `level = age>=19 ? 'ADULTS' : 'U'+pad(min(max(age+1,7),19))`. Kategória cez mapovanie skupín. Sčítaj `M+F+N`.
- **Rozpad aktuálnej sezóny**: bar na každú vybranú čiaru (posledná sezóna), podiel z osôb roly s uvedeným vekom.
- **Small multiples** rolí (klik prepína rolu).

### 5. Projekty (grassroots)
- Prepínač projektu (karty): Dajme spolu gól, Futbalové krúžky McDonald's, Disney Playmakers (`projekty/index.json`).
- KPI: Zapojené deti, Školy/kluby, Tímy/skupiny (posledná sezóna s dátami).
- Trend „Zapojené deti podľa sezón" (stĺpce), Donut pohlavia, Vek účastníkov (stacked M/F po roku veku).
- Metodika: deti = súpisky, nie zápasy. Disney: účastníci až od 2026/2027 → prázdny stav s poznámkou.

---

## Interactions & Behavior
- **Segmented toggle** (úroveň mapy/porovnaní): sivé puzdro `#eceef1`, aktívny biely chip s tieňom.
- **Metric pills / filter pills**: aktívny = plná farba + biely text; neaktívny = biely s orámovaním `#dcdfe4`.
- **Custom season dropdown**: pill trigger („SEZÓNA" + hodnota + ▾), panel so zoznamom sezón (aktívna zvýraznená `#eef3ff`/modrá), scroll pri veľa sezónach, overlay zatvára. **Nepoužívať natívny `<select>`** (nedá sa štýlovať).
- **Zväz picker**: viď Profil — search + vnorené ObFZ pod RFZ.
- **Sunburst hover**: zvýraznenie segmentu (ostatné stlmené na opacity ~0.32), stred zobrazí názov + hodnotu + %.
- **Mapa hover**: tooltip sledujúci kurzor; klik → profil.
- **Tabuľka**: klik hlavička = sort (toggle), klik riadok = profil.
- Prechody: `transition` na šírkach barov (~.3s), opacite segmentov (~.12s), farbách máp (~.15s).

## State Management
Kľúčové stavy (v prototype v jednej triede; v Astro rozdeľte na islandy/props + URL query pre permalink):
- `view` (obrazovka), `season` (globálna), `mapLevel` (SFZ/RFZ/ObFZ), `mapMetric`, `zvaz` (aktívny profil), `drill` (rozbalená kategória), `porovLevel`, `sortKey`+`sortDir`, `compare[]` (2–5 zväzov), `bumpMetric`, `demoRole`, `demoSel[]` (vybrané čiary), `pyrRole`/`pyrRoleSR`, `sports{futbal,futsal}`, `sbGender`, `projekt`, UI: `menuOpen`, `seasonOpen`, `zvazPickerOpen`+`zvazQuery`, hover stavy.
- **Permalink** (F6 z projektového plánu): mapovať `view + zvaz + sezona + metrika` do URL/query, ako to už riešite v Astro routingu (`/zvaz/[id]/[sezona]`, `/zvaz/[id]/[odvetvie]/[sezona]`).

---

## Dátové kontrakty (existujúce JSON — bez zmeny)
Publikované statické JSON (viď `web/src/lib/data.ts`, `data/README.md`):
- `index.json` — `zvazy[]{ id, nazov, uroven(SFZ|RFZ|ObFZ), rfz?, appSpace, sezony[], odvetvia?{futsal:[]} }`
- `zvaz/{id}/{sezona}.json` — `{ kpi{ sutaze, zapasy, druzstva, goly, divaci, zlteKarty, cerveneKarty }, kategorie{ <ageCategory>:{ zapasy, druzstva, goly, zlte, cervene, divaci, divaciPokrytych } }, pohlavie{...}, osoby{ <rola>:{ unikatni, poKategorii{<cat>:n} } }, methodologyFlags }` — súbor odvetvia: `{sezona}-{sektor}.json` (napr. `2025-2026-futsal.json`)
- `porovnania/{rfz|obfz}/{sezona}.json` — `{ uroven, sezona, zvazy[]{ id, nazov, rfz?, zapasy, druzstva, goly, divaci, zlteKarty, cerveneKarty, hraci, golyNaZapas, divaciNaZapas } }`
- `sumar/{sezona}.json` — `{ kpi, osoby{hraci,treneri,rozhodcovia,delegati,personal,spolu}, odvetvia{futsal:{kpi,osoby}}, sunburstSutaze, sunburstOsoby }`. Sunburst listy súťaží nesú `pohlavie{M,F,NEURCENE}` (pre gender filter).
- `demografia/{id}.json` a `sumar/demografia.json` — `{ sezony{ <sezona>:{ <rola>:{ osoby, sUdajmi, bezUdajov, roky{ <rokNarodenia>:{M,F,N} } } } } }`
- `projekty/{id}.json` + `projekty/index.json` — `sezony{ <sezona>:{ deti, skoly, timy, pohlavie{M,F,N}, vek{ <vek>:{M,F,N} } } }`
- `geo/mapa.json` — `{ viewBox:"0 0 1000 497", slovensko:"<path d>", rfz[{name,path}], obfz[{name,path}] }`; mapovanie `geoName → id` cez `etl/config/zvazy.json` (pole `geoName`). RFZ `name` → id: `BA→bfz, ZsFZ→zsfz, SsFZ→ssfz, VsFZ→vsfz`.

## ⚠ Dátové medzery (potrebný ETL doplnok)
- **Sunburst „Osoby — úroveň, rola a vek"** je v prototype **placeholder** — rozdelenie osôb podľa úrovne (SFZ/RFZ/ObFZ) je len ilustračné (fixný pomer). `sumar/sunburstOsoby` má dnes iba `odvetvie → rola → vek`. **ETL doplniť** agregát `odvetvie → úroveň → rola → veková úroveň` (osoby unikátne v rámci úrovne). **Definícia úrovne SFZ = vrátane ULK / Niké liga** (rovnaké rozlíšenie ako pri súťažiach — rozhodnutie PO). Po dodaní vymeňte placeholder za reálny uzol.
- Multi-line demografia používa **rok narodenia → vek** ako proxy pre vekovú úroveň (súťažná kategória per sezónu historicky nie je k dispozícii). Ak ETL vydá per-sezónne súťažné kategórie osôb, prepnite na ne.
- `kpi.sutaze` (počet súťaží) je už dogenerované pre celú históriu — karta „Súťaže" ho používa.

## Assets
- `assets/sfz-logo-official.svg` — oficiálne kruhové logo SFZ (viewBox 154×154), použité v hlavičke 44×44. (V repe zodpovedá brand logu z `docs/brand`.)
- Mapa SR — `geo/mapa.json` (už v repe: `web/assets/geo/mapa.json`).
- Žiadne rastrové obrázky; všetko SVG/dáta.

## Files (v tomto balíku)
- `README.md` — táto špecifikácia (vizuál, obrazovky, tokeny, dátové kontrakty).
- `IMPLEMENTATION.md` — **návod na implementáciu v Astro + ECharts** (štruktúra súborov, helpery, recepty grafov, poradie prác).
- `theme.css` — hotové **Tailwind v4 `@theme` brand tokeny** (drop-in do `web/src/styles/global.css`).
- `Statistika SFZ.dc.html` — kompletný interaktívny prototyp (referencia vzhľadu + logiky všetkých obrazoviek a grafov).
- `sfz-data.js` — `window.SFZ` so **skutočnými** agregovanými dátami (národný trend, sumár, porovnania, profily vybraných zväzov, demografia SR + 6 zväzov, mapa, projekty). Slúži na overenie čísel; v produkcii sa číta z `data/*.json`.
- `assets/sfz-logo-official.svg` — logo.
- `reference-data/mapa.json` — SVG paths mapy SR (viewBox 1000×497; `slovensko`, `rfz[]`, `obfz[]`). V repe: `web/assets/geo/mapa.json`.
- `reference-data/zvazy-register.json` — register 43 zväzov + `geoName → id` mapovanie pre mapu. V repe: `etl/config/zvazy.json`.
- Pozn.: `Statistika SFZ.dc.html` je „Design Component" a v behu potrebuje runtime `support.js` (nie je súčasťou balíka). Ako referencia poslúži čítanie zdroja (celá logika grafov a rozložení je v ňom) + živý náhľad v tomto projekte. V Astro sa nič z toho nekopíruje 1:1 — recreate cez ECharts/Tailwind.

## Odporúčaný postup integrácie (Astro)
1. Zjednotiť **brand tokeny** (`web/src/styles/global.css` `@theme`) s tabuľkou vyššie (pridať region + group + neutral tokeny, Archivo Expanded).
2. Hlavička: logo + **badge Beta** + **custom dropdown sezóny** + **hamburger** (mobil). Nahradiť natívny select.
3. **Prehľad**: KPI band (pridať kartu Súťaže), choropleth (inline SVG z `geo/mapa.json`), rebríček, sunbursty (ECharts `sunburst`), veková pyramída, sport/gender filtre.
4. **Profil**: vyhľadávateľný zväz picker (ObFZ pod RFZ), KPI s YoY, drill-down kategórií, osoby, pyramída.
5. **Porovnania**: sort tabuľka + radar (ECharts `radar`, normalizované) + bump chart (ECharts `line` s inverznou osou poradia).
6. **Demografia**: multi-line (ECharts `line`, séria = kategória/úroveň) + rozpad + small multiples.
7. **Projekty**: napojiť na `projekty/*.json`.
8. Doplniť **ETL agregát osôb per úroveň** (viď Dátové medzery), potom finalizovať 4-prstencový sunburst osôb.
