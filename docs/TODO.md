# TODO — otvorené úlohy a známe obmedzenia

**Stav k 8. 8. 2026.** Tento dokument hovorí, **čo je otvorené** — nie čo sa už spravilo.
História dokončených etáp je na konci a v histórii gitu; rozhodnutia produktového vlastníka
sa zapisujú do [metodiky](metodika.md) a [ADR](adr/).

---

## Čaká na produktového vlastníka

- [ ] **Cielený index na `matches`** (ADR-0004). Bez neho ETL potrebuje `--hint` ako obchádzku:
  ```
  db.matches.createIndex(
    { appSpace:1, closed:1, "rules.sport_sector":1, "season.name":1 },
    { name: "etl_appSpace_closed_sport_season" })
  ```
  Zrýchli všetky ETL agregácie pre všetky zväzy. Vyžaduje DBA na strane Sportnetu.
- [ ] **Typ časti súťaže do `competitions.parts[]`** (žiadosť na Sportnet / Bart.sk).
  ISSF rozlišuje „Základná časť“ vs. „Nadstavbová časť“, ale do MongoDB sa tento stĺpec
  neprepísal — `parts[]` nesie len `name`, `type` (collective/race), `format`, `rules`,
  `dateFrom`/`dateTo` (pri všetkých častiach rovnaké) a `teams`. Bez neho musí ETL typ časti
  **odhadovať** dvoma sitami — štruktúrnym (nadstavba neprivedie nové družstvo) a podľa názvu
  časti (`baraz`, `nadstavb`, `play-off`…); pozri `run.nacitaj_skupina_mapu` a kapitolu
  „SÚŤAŽ vs. SÚŤAŽNÁ SKUPINA“ v [metodike](metodika.md). Odhad funguje, ale explicitný príznak
  by ho nahradil presným údajom a odstránil posúdenie hraničných prípadov (baráže so súperom
  z inej súťaže, finálové turnaje prípraviek).
- [ ] **Odoslať podklady Bart.sk** pre produkčný beh — [draft](archiv/podklady-bart-produkcny-beh.md).
- [ ] **Nahlásiť chybný záznam divákov** — [draft](sportnet-nahlasenie-divaci.md).

## Dáta a ETL

- [ ] **Osoby × pohlavie × veková úroveň v profiloch zväzov.** Dnes je pill filter pohlavia len
  na sunburste súťaží; pre osoby chýba, lebo pohlavie osoby sa musí odvodiť z gender časti
  súťaže. Vyžaduje re-beh histórie.
- [ ] **Revízia počtu indexov na `matches`** — 44 indexov spomaľuje samotné plánovanie dotazov
  (`optimizationTimeMillis ≈ 1,9 s`). Opatrne, je to zdieľaná produkčná databáza.
- [ ] **Explicitný ISSF príznak „zápis podaný“** namiesto dnešnej proxy (bez udalostí a bez
  divákov = administratívna kontumácia). Pozri [ADR-0008](adr/0008-odohrane-zapasy-bez-administrativnych.md).

## Frontend

- [x] ~~**Zjednotiť kontextové popisky v grafoch.**~~ Hotové 10. 8. 2026 — jeden zdieľaný
  `Tooltip.tsx` naprieč všetkými ručne kreslenými grafmi, vrátane dotyku a dvoch grafov,
  ktoré popisok nemali vôbec. Pozri metodiku, kap. „Kontextové popisky v grafoch“.
- [ ] **41 typových chýb v dynamických route súboroch** (`astro check`, 8. 8. 2026). Všetky sú
  ten istý vzor: `Astro.params` je typovaný ako `string | number`, takže `id!`, `sezonaUrl!`
  a `odvetvie!` nesadá do funkcií čakajúcich `string`. Build ani beh portálu to neovplyvňuje,
  ale kontrola preto nekončí čisto. Týka sa `klub/[id]/[sezona]`, `klub/[id]/[odvetvie]/[sezona]`,
  `zvaz/[id]*`, `porovnania/*`, `demografia/[id]`. Riešenie: obaliť parametre `String(…)`
  alebo dotypovať `getStaticPaths`. `@astrojs/check` je už v `devDependencies`
  (`npx astro check`).

- [ ] **Payload stránok.** Úvodná stránka 628 kB HTML, `/trendy` 600 kB, profil klubu 1,17 MB
  (gzip to zráža na desatinu, ale je čo orezávať). Dominuje `KpiTrend` a sunburst dáta starých
  sezón.
- [ ] **Tree-shaking ECharts.** Bundluje sa celý (~1 MB) — používa ho desať komponentov, dá sa
  prejsť na `echarts/core` a importovať len potrebné moduly.
- [ ] **SeasonPicker na Prehľade** nemení sezónu reaktívne (Prehľad je server-rendered pre
  poslednú kompletnú sezónu). Plná reaktivita alebo permalink je možné vylepšenie.
- [ ] **Karty a góly za prípravky (U07–U11)** — pokrytie je slabé; rozhodnúť, či ich
  nezobrazovať alebo publikovať s výhradou.

## Trendy — čo sa dá pridať

Stránka `/trendy` dnes obsahuje vek hráčov v súťažiach dospelých, rebríček starnúcich klubov
a Index klubu (graf + celoslovenská tabuľka). Ďalšie kandidátne trendy:

- [ ] Družstvá v čase
- [ ] Návštevnosť v čase
- [ ] Karty v čase

## Známe obmedzenia (nie sú to chyby, ale treba o nich vedieť)

- **Kto reálne nastúpil na ihrisko sa z dát zistiť nedá.** Striedania sa v protokole neevidujú
  (`substitute` je vyplnený u 6,7 % hráčov), odohraté minúty v dátach neexistujú. Všetky vekové
  metriky sú o **hráčoch uvedených v zápise o stretnutí**.
- **6–7 % uzavretých zápasov dospelých nemá nomináciu** a do vekovej štatistiky nevstupuje.
- **Tréneri sa nedajú merať.** Vyše štvrtiny klubov nemá evidovaného ani jedného mládežníckeho
  trénera — je to nevyplnený realizačný tím, nie skutočnosť. Preto tréneri nevstupujú do
  Indexu klubu.
- **História siaha po sezónu 2013/2014**, nie 2012/2013 (tá má v dátach asi tretinu klubov).
- **Prvých päť sezón Indexu klubu nie je porovnateľných** — zložka kontinuity nemohla byť pred
  2018/2019 nasýtená. Podrobne v [metodike](metodika.md).
- **Commity s autorom `@futbalsfz.sk` Vercel blokuje** — používa sa `jan.letko@icloud.com`.

---

## História — dokončené etapy

| Kedy | Čo |
|---|---|
| 8. 8. 2026 | Vývoj Indexu klubu po zväzoch na `/trendy`; filter úrovní prehadzuje výber zväzov; upratanie dokumentácie repozitára |
| 7.–8. 8. 2026 | **Trendy** — vek hráčov v súťažiach dospelých (zväzy, kluby, súťaže, úrovne), rebríček starnúcich klubov, **Index klubu** (`etl/trendy.py`, `etl/index_klubu.py`). Oprava `ageLevel` — veková úroveň osoby sa rátala o úroveň vyššie |
| 6.–7. 8. 2026 | **Pyramída súťaží** — počty súťaží podľa úrovne, heatmapa zväzy × úrovne, vývoj pyramídy v čase; oprava hydratácie React islands (`process is not defined`) |
| 22. 7. 2026 | **Odohraté zápasy bez administratívnych kontumácií** ([ADR-0008](adr/0008-odohrane-zapasy-bez-administrativnych.md)); dopad 2025/2026: 63 943 uzatvorených → 60 958 odohraných |
| 19. 7. 2026 | **Vizuálny redizajn** — React islands ([ADR-0007](adr/0007-react-islands-redizajn.md)), celoslovenský sumár na úvodnej stránke, demografia, projekty, futsal, porovnania s radarom, vekové pyramídy |
| 19. 7. 2026 | **Produkčné nasadenie na Vercel** ([ADR-0006](adr/0006-hosting-vercel-namiesto-cloudflare.md)) — doména cez CNAME na WebSupport DNS, bez presunu nameserverov |
| 13. 7. 2026 | **Plný dátový beh** — 43/43 zväzov, 573 sezónnych výstupov, demografia všetkých zväzov, futsal 11 sezón; korekčná vrstva divákov |
| 12. 7. 2026 | **Dátový audit a ETL v1** — [report kvality dát](report-kvality-dat.md), register 43 zväzov, dimenzia pohlavie, normalizácie vekových kategórií |

Podrobný priebeh jednotlivých etáp je v commit messages — tie sú v tomto projekte písané ako
záznam rozhodnutí, nie ako jednoriadkové poznámky.
