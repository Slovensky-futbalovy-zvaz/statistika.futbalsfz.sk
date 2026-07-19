# Dizajn manuál — statistika.futbalsfz.sk

Živý referenčný dokument pre **konzistentné pridávanie nových funkcií** (napr. **klubové štatistiky**). Doplnok k `README.md` (vizuál) a `IMPLEMENTATION.md` (Astro/ECharts). Drž sa týchto pravidiel, aby každá nová stránka vyzerala a fungovala ako zvyšok portálu.

---

## 1. Základy (foundations)

### Farby
Zdroj pravdy = `theme.css`. Nikdy nezavádzaj nové ad-hoc farby; použi tokeny.
- **Značka:** modrá `#1450df` (primárna), červená `#ec1c24` (akcent/negatív/Beta), sivá `#bbbdbf`, čierna `#070504`.
- **Neutrály:** ink `#0b0a0a`, muted `#6c7178`, line `#e7e9ec`, bg `#f4f5f7`, card `#fff`, track `#eceef1`, good `#12a06b`.
- **Kategórie/regióny:** viď paletky v `theme.css` (RFZ, vekové skupiny). Pre klubovú úroveň zaveď **jednu novú akcentovú rodinu** (napr. súťaž/liga) len ak treba — a doplň ju do `theme.css` ako token, nie inline.

### Typografia
- **Archivo** (400–900) — text/UI/čísla; **Archivo Expanded** (600–900) — veľké nadpisy.
- Škála: kicker 11–12px/700/uppercase/`.12–.18em`; nadpis sekcie `clamp(21px,2.4vw,28px)`/800; H1 hero `clamp(28px,4.6vw,52px)`/Expanded; KPI číslo `clamp(24px,3vw,32px)`/800.
- **Všetky čísla `font-variant-numeric: tabular-nums`** + `Intl.NumberFormat('sk-SK')`.

### Priestor, rádius, tieň
- Kontajner `max-width:1240px; padding:34px 24px 70px`.
- Rádius: karta 16, prvky 8–11, pill 16–22. Tieň karta `0 1px 2px rgba(11,10,10,.04)`, pop `0 16px 40px rgba(11,10,10,.16)`.
- Gridy: `gap:14–16px`; responzíva cez `repeat(auto-fit,minmax(…,1fr))`, `flex-wrap`, `clamp()`.

---

## 2. Komponenty (stavebné bloky)

- **Karta** — biele pozadie, `1px var(--color-line)`, radius 16, tieň-card, padding 16–20.
- **Sekcia** — `kicker` (modrý uppercase) + nadpis + voliteľný popis (muted, max ~640px).
- **KPI karta** — uppercase label (muted) + veľké číslo (tnum) + medziročná delta (▲ zelená / ▼ červená + „medziročne"). Pre „negatívne dobré" metriky (karty) invertuj smer.
- **Pill / tab** — aktívny = plná farba + biely text; inak biely + `1px #dcdfe4`. Multi-select = viac aktívnych.
- **Segmented toggle** — puzdro `#eceef1`, aktívny biely chip + tieň (úrovne, prepínače).
- **Custom dropdown** (sezóna, atď.) — pill trigger + panel (radius 12, tieň-pop, aktívna položka `#eef3ff`/modrá), overlay zatvára. **Nikdy natívny `<select>`.**
- **Vyhľadávací picker** (zväz → klub) — trigger + search input (ignoruj diakritiku) + **hierarchický zoznam** (deti odsadené pod rodičom). Vzor: ObFZ pod RFZ → **kluby pod súťažou/zväzom**.
- **Tabuľka** — sticky hlavička, klik = sort (toggle smer, aktívny stĺpec modrý + šípka), zebra `#fafbfc`, hover `#f2f6ff`, klik riadok = detail, `overflow-x:auto` na mobile, farebná bodka kategórie pri názve.
- **Bar / mini-bar** — track `#eceef1`, výplň token farbou, radius 6, `transition:width .3s`.
- **Badge** — malý pill (napr. „BETA VERZIA" červená). Rovnaký vzor pre stavové štítky (napr. „ukončené", „nové").
- **Prázdny stav** — jemná karta s textom (muted) a dôvodom (napr. „dáta dostupné od sezóny …").

---

## 3. Grafy (dátová vizualizácia)
Použi **ECharts** (islands), okrem mapy = **inline SVG**. Konzistentné pravidlá:
- Farby vždy z tokenov; hover zvýrazní prvok, ostatné stlmí (opacity ~0.32) alebo červený obrys (mapa).
- Tooltip: názov + hodnota (`sk-SK`), pri pomeroch 1 desatinné miesto.
- Osi jemné (`#e7e9ec`), popisky muted 10–11px, skrátené sezóny (`.slice(2)` → „25/26").
- **Typy a kedy:** KPI trend = area/line; podiel v hierarchii = **sunburst**; porovnanie 2–5 entít = **radar** (normalizovaný na max); vývoj poradia = **bump**; viac sérií v čase = **multi-line**; rozloženie M/Ž podľa veku = **pyramída**; geografia = **choropleth**.
- Recepty (ECharts option) sú v `IMPLEMENTATION.md` — pri novej entite ich znovupoužij.

---

## 4. Navigácia a stránka (šablóna)
- **Header** (sticky, blur): logo + Beta badge + Nav + custom výber kontextu (sezóna; na klube napr. aj súťaž). Mobil < 760px → **hamburger**.
- **Nová položka menu** sa pridáva do rovnakého Nav poľa (Prehľad, Profil zväzu, Porovnania, Demografia, Projekty, **+ Kluby**).
- **Šablóna dátovej stránky:** `sectionHead` → (voliteľné filtre/pills) → KPI band → hlavný graf(y) v kartách → tabuľka/rozpad → metodická poznámka. Rovnaké poradie ako existujúce obrazovky.
- **Permalink**: kontext do URL (`/klub/[id]/[sezona]`) — konzistentne s `/zvaz/[id]/[sezona]`.

---

## 5. Ako pridať novú funkciu — na príklade **Klubové štatistiky**
Postupuj presne takto, aby to zapadlo:

**a) Dáta (ETL → statické JSON, ADR-0001).** Priprav rovnaký tvar ako pri zväzoch:
- `data/klub/{klubId}/{sezona}.json` — `{ kpi{ zapasy, druzstva, goly, divaci, zlteKarty, cerveneKarty, … }, kategorie{…}, osoby{…}, methodologyFlags }` (rovnaké kľúče ako profil zväzu).
- `data/kluby/index.json` — `{ kluby[]{ id, nazov, zvaz(id ObFZ/RFZ), uroven, sezony[] } }` (na picker a routing).
- Prípadne `data/porovnania/kluby/{…}.json` pre rebríčky/tabuľky.
- **Nemeň existujúce kontrakty** — kluby sú nový súbor entít, nie zmena zväzov.

**b) Register/hierarchia.** Klub patrí pod súťaž/zväz → v pickeri použij **rovnaký hierarchický vzor** (kluby odsadené pod svojím zväzom/súťažou, so search).

**c) Routing + stránka.** `web/src/pages/klub/[id]/[sezona].astro` (SSG, predgeneruj z indexu). Použi **profil-zväzu šablónu** (KPI YoY, kategórie s drill-down, osoby, pyramída), len s klubovými dátami.

**d) Komponenty.** Znovupouži `KpiCard`, `CategoryBars`, `PorovnanieTable`, `CompareRadar`, `AgePyramid`, custom picker — nič nekresli nanovo. Ak potrebuješ nový graf, drž pravidlá §3 a farby z tokenov.

**e) Navigácia.** Pridaj „Kluby" do Nav; do zväzového profilu voliteľne odkaz na jeho kluby.

**f) Prázdne/čiastočné dáta.** Ak klub nemá niektorú metriku (napr. diváci), zobraz „—" a metodickú poznámku, nezakrývaj kartu.

**g) Copywriting.** Slovensky, vecne; kickery uppercase; jednotky a čísla `sk-SK`; metodická poznámka pod obsahom (čo sa počíta, pokrytie, výhrady).

---

## 6. Checklist pred nasadením novej stránky
- [ ] Farby, fonty, rozostupy z tokenov (žiadne inline ad-hoc hodnoty).
- [ ] KPI s medziročnou deltou (správny „dobrý smer").
- [ ] Grafy sa vykresľujú, majú tooltip a hover; prázdne stavy ošetrené.
- [ ] Custom dropdown/picker (nie natívny select), hierarchia + search kde dáva zmysel.
- [ ] Responzíva: mobil (hamburger, stĺpce sa zvinú, `overflow-x` na tabuľkách/grafoch).
- [ ] SSG/SEO + permalink konzistentný s existujúcim routingom.
- [ ] Metodická poznámka + časová pečiatka aktualizácie.
- [ ] `pnpm build` bez chýb, čísla sedia s JSON.
