# TODO — otvorené úlohy a známe obmedzenia

**Stav k 14. 8. 2026.** Tento dokument hovorí, **čo je otvorené** — nie čo sa už spravilo.
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
- [ ] **Príznak „regulárna súťaž / turnaj“ v `competitions`** (žiadosť na Sportnet / ISSF).
  Reprezentačné turnaje, školské turnaje a Vysokoškolská liga sa v dátach ničím nelíšia od
  ligovej súťaže a `level` sa na rozlíšenie použiť nedá (nemá ho ani VII. liga SOFZ). Preto
  existuje **ručný číselník** `etl/config/vylucene_sutaze.json`, ktorý treba pri každej novej
  neregulárnej súťaži dopĺňať manuálne. Bez príznaku sa to inak spraviť nedá.
- [ ] **Príznak právneho nástupcu klubu v ISSF** (žiadosť na Sportnet / ISSF). Pri novej
  registrácii klubu (transformácia na s. r. o., zmena právnej formy) vznikne nový subjekt bez
  väzby na predchodcu, takže ten istý reálny klub vyjde v tokoch raz ako zánik a raz ako vznik.
  Nameraných je aspoň 41 takých párov — pozri [metodiku](metodika.md), kap. „Zanikanie klubov“.
  Bez príznaku sa toky klubov očistiť nedajú inak než heuristikou podľa názvu, a tú do
  publikovaných dát nedávame.
- [ ] **Odoslať podklady Bart.sk** pre produkčný beh — [draft](archiv/podklady-bart-produkcny-beh.md).
- [ ] **Nahlásiť chybný záznam divákov** — [draft](sportnet-nahlasenie-divaci.md).
- [ ] **Sociálny post „Počet klubov“ na publikovanie** — text, 12 vizuálov a PDF carousel sú
  hotové v [docs/social/2026-08-pocet-klubov/](social/2026-08-pocet-klubov/). Pred zverejnením
  potrebuje schválenie snímky 09 (príčiny úbytku — je to **postoj SFZ**, nie údaj z portálu)
  a snímky 10 (financovanie delegovaných osôb).

## Dáta a ETL

- [ ] **Filter neregulárnych súťaží do `etl/trendy.py` a `etl/demografia_klub.py`.**
  `etl/kluby.py` už vylučuje súťaže mimo slovenských zväzov a neregulárne súťaže
  (`etl/config/vylucene_sutaze.json`), ale tieto dva skripty ten filter ešte nemajú — pri
  najbližšom behu znova vyrobia `data/vek-klub/*.json` a `data/demografia-klub/*.json` aj pre
  vylúčené subjekty (školy, výbery zväzov, zahraničné kluby). Artefakty sú dnes odložené
  v `data/_archiv-klubov/` (lokálne, v `.gitignore`) a `etl/index_klubu.py` má poistku, ale
  správne riešenie je doplniť rovnaký filter do oboch skriptov.
- [ ] **Osoby × pohlavie × veková úroveň v profiloch zväzov.** Dnes je pill filter pohlavia len
  na sunburste súťaží; pre osoby chýba, lebo pohlavie osoby sa musí odvodiť z gender časti
  súťaže. Vyžaduje re-beh histórie.
- [ ] **Revízia počtu indexov na `matches`** — 44 indexov spomaľuje samotné plánovanie dotazov
  (`optimizationTimeMillis ≈ 1,9 s`). Opatrne, je to zdieľaná produkčná databáza.
- [ ] **Explicitný ISSF príznak „zápis podaný“** namiesto dnešnej proxy (bez udalostí a bez
  divákov = administratívna kontumácia). Pozri [ADR-0008](adr/0008-odohrane-zapasy-bez-administrativnych.md).
- [ ] **Kluby vo futsale do bloku odvetví sumáru boli doplnené** (`odvetvia.futsal.kpi.kluby`),
  ale **klub hrajúci futbal aj futsal sa sčítať nesmie** — počet unikátnych klubov cez obe
  odvetvia nie je publikovaný. Ak ho bude niekto potrebovať, treba ho spočítať v `etl/kluby.py`
  nad oboma sektormi naraz.

## Frontend

- [ ] **41 typových chýb v dynamických route súboroch** (`astro check`, 8. 8. 2026). Všetky sú
  ten istý vzor: `Astro.params` je typovaný ako `string | number`, takže `id!`, `sezonaUrl!`
  a `odvetvie!` nesadá do funkcií čakajúcich `string`. Build ani beh portálu to neovplyvňuje,
  ale kontrola preto nekončí čisto. Týka sa `klub/[id]/[sezona]`, `klub/[id]/[odvetvie]/[sezona]`,
  `zvaz/[id]*`, `porovnania/*`, `demografia/[id]`. Riešenie: obaliť parametre `String(…)`
  alebo dotypovať `getStaticPaths`.
- [ ] **Payload stránok.** Úvodná stránka 628 kB HTML, `/trendy` 600 kB, profil klubu 1,17 MB
  (gzip to zráža na desatinu, ale je čo orezávať). Dominuje `KpiTrend` a sunburst dáta starých
  sezón. Pri `porovnania/obfz/*` (1 470 kB) dominuje `bump` payload — pomohol by rovnaký trik
  ako v `lib/urovne.ts`: poslať matice ako reťazec s indexmi namiesto objektov s názvami metrík.
- [ ] **Tree-shaking ECharts.** Bundluje sa celý (~1 MB) — používa ho desať komponentov, dá sa
  prejsť na `echarts/core` a importovať len potrebné moduly.
- [ ] **SeasonPicker na Prehľade** nemení sezónu reaktívne (Prehľad je server-rendered pre
  poslednú kompletnú sezónu). Plná reaktivita alebo permalink je možné vylepšenie.
- [ ] **Karty a góly za prípravky (U07–U11)** — pokrytie je slabé; rozhodnúť, či ich
  nezobrazovať alebo publikovať s výhradou.

## Trendy — čo sa dá pridať

Stránka `/trendy` dnes obsahuje vek hráčov v súťažiach dospelých, rebríček starnúcich klubov
a Index klubu (graf + celoslovenská tabuľka). Ďalšie kandidátne trendy:

- [ ] **Zanikanie klubov ako blok na portáli.** `etl/zanikanie.py` už publikuje
  `data/zanikanie.json` (odchody po sezónach, miery odchodu podľa stavu mládeže, prechody
  stavov, príchody). Dnes to je len podklad pre analýzu a sociálny post — na portáli by to
  čitateľ mohol overiť sám.
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
- **Sezóny 2012/2013 a 2013/2014 sú roky nábehu ISSF** — evidencia v nich nie je úplná
  (2012/2013 má 578 klubov oproti ~1 700 v ďalších sezónach). V karte Počet klubov sú preto
  šrafované a do analýzy zanikania nevstupujú.
- **Prebiehajúca sezóna sa nedá čítať ako stav.** Mládežnícke súťaže sa rozbiehajú neskôr než
  súťaže dospelých, takže na začiatku sezóny vyzerá, že klubov s mládežou je málo. Do analýzy
  zanikania prebiehajúca sezóna nevstupuje vôbec — inak by 501 klubov, ktoré len čakajú na
  štart svojej súťaže, vyšlo ako zaniknuté.
- **Zaniknutý klub = dva roky po sebe bez prihláseného družstva** (rozhodnutie Ján Letko,
  15. 8. 2026). Postup do vyššej ani zostup do nižšej súťaže zánik NIE JE — aktivita sa posudzuje
  celoslovensky, nie po zväzoch; inak by vzniklo 658 falošných zánikov. Rebríček zväzov sa preto
  robí podľa podielu na všetkých zánikoch v SR, nie podľa úbytku klubov vo zväze. Podrobne
  v [metodike](metodika.md), kap. „ZANIKANIE KLUBOV“.
- **Toky klubov (zánik/vznik) sú horná hranica.** Nový subjekt v ISSF nie je nutne nový klub —
  aspoň 41 z nameraných párov je ten istý klub s novým IČO. Stavy klubov a miery zániku to
  neskresľuje, toky áno.
- **56 z 595 zaniknutých klubov sa po dvoch tichých sezónach ešte vrátilo.** Podľa definície
  zostávajú zaniknuté; ich návrat sa nepočíta ako nový klub. Uvedené je to aj na portáli.
- **Súčet klubov po zväzoch je vyšší než celoslovenské číslo** — klub je započítaný v každom
  zväze, v ktorého súťaži hral. Sčítateľné číslo je `podlaDomovskehoZvazu`.
- **Prvých päť sezón Indexu klubu nie je porovnateľných** — zložka kontinuity dáva plných 15
  bodov až za päť sezón mládeže po sebe, ale história začína 2013/2014, takže plný počet nemohol
  mať nikto pred 2018/2019 (namerané mediány zložky D: 3, 3, 6, 10, 10, potom 15). Zhruba 12
  z 28 bodov rastu celoslovenského mediánu je dobiehajúca metodika, nie zlepšenie mládeže.
- **Index klubu a blok Počet klubov nie sú tá istá metrika** — index počíta družstvo, len ak
  odohralo viac než polovicu mediánu zápasov svojej časti súťaže. V 2025/2026 obe metriky
  hovoria 239 klubov bez mládeže, ale klubov bez dospelých má index 156 a blok 143.
- **Commity s autorom `@futbalsfz.sk` Vercel blokuje** — používa sa `jan.letko@icloud.com`.
- **Pred lokálnym buildom treba pozabíjať všetky `astro dev`** — dva Vite procesy si konkurujú
  o cache a build sa zasekne na „Re-optimizing dependencies“ (stalo sa 14. 8. 2026, na porte
  4399 bežali štyri staré dev servery).

---

## História — dokončené etapy

| Kedy | Čo |
|---|---|
| 15. 8. 2026 | **Zanikanie klubov** — záväzná definícia (dva roky bez družstva; postup/zostup nie je zánik), rez po zväzoch v rámci SR a po obdobiach, sekcia na `/trendy`, `etl/kontrola_zanikania.py`; prepočet oboch sociálnych postov |
| 14. 8. 2026 | **Počet klubov** — nový blok na úvode, na profiloch zväzov, v Porovnaniach a v sunburste; KPI dlaždice Kluby a Kluby — futsal; filter neregulárnych súťaží (`etl/kluby.py`, `etl/kluby_zvazy.py`, číselník); šrafované sezóny nábehu ISSF; **`etl/zanikanie.py`** — zánik klubov s mládežou vs. bez mládeže; sociálny post s 12 vizuálmi a PDF carouselom |
| 10. 8. 2026 | Jednotné kontextové popisky vo všetkých grafoch + podpora dotyku |
| 8.–9. 8. 2026 | Súťažné skupiny ako druhá metrika počtu súťaží; `etl/kontrola_skupin.py`; vývoj Indexu klubu po zväzoch; upratanie dokumentácie |
| 7.–8. 8. 2026 | **Trendy** — vek hráčov v súťažiach dospelých, rebríček starnúcich klubov, **Index klubu** (`etl/trendy.py`, `etl/index_klubu.py`). Oprava `ageLevel` |
| 6.–7. 8. 2026 | **Pyramída súťaží** — počty súťaží podľa úrovne, heatmapa zväzy × úrovne, vývoj pyramídy v čase; oprava hydratácie React islands |
| 22. 7. 2026 | **Odohraté zápasy bez administratívnych kontumácií** ([ADR-0008](adr/0008-odohrane-zapasy-bez-administrativnych.md)); dopad 2025/2026: 63 943 uzatvorených → 60 958 odohraných |
| 19. 7. 2026 | **Vizuálny redizajn** — React islands ([ADR-0007](adr/0007-react-islands-redizajn.md)), celoslovenský sumár, demografia, projekty, futsal, porovnania s radarom, vekové pyramídy |
| 19. 7. 2026 | **Produkčné nasadenie na Vercel** ([ADR-0006](adr/0006-hosting-vercel-namiesto-cloudflare.md)) |
| 13. 7. 2026 | **Plný dátový beh** — 43/43 zväzov, 573 sezónnych výstupov, futsal 11 sezón; korekčná vrstva divákov |
| 12. 7. 2026 | **Dátový audit a ETL v1** — [report kvality dát](report-kvality-dat.md), register 43 zväzov, dimenzia pohlavie |

Podrobný priebeh jednotlivých etáp je v commit messages — tie sú v tomto projekte písané ako
záznam rozhodnutí, nie ako jednoriadkové poznámky.
