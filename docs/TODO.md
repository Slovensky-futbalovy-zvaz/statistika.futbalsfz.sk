# TODO — projektový zásobník

Aktuálny stav úloh projektu statistika.futbalsfz.sk. Udržiava sa priebežne v každej session; rozhodnutia PO sa zapisujú sem a do príslušných dokumentov (metodika, ADR, report kvality).

**Stav k:** 19. 7. 2026 (session: vizuálny redizajn podľa design handoff — React islands)

## Redizajn 2026 (design_handoff_statistika_redesign) — 19. 7. 2026

Kompletný vizuálny redizajn portálu podľa handoffu. **React islands** (ADR-0007), brand tokeny z `theme.css`, Archivo fonty, kontajner 1240px. Fázy:

- [x] **F0** React setup (@astrojs/react), tokeny, fonty, `lib/format.ts` + `lib/palette.ts`, logo, ADR-0007.
- [x] **F1** Header — kruhové logo SFZ, BETA badge, nav (5 sekcií), custom SeasonPicker, mobilný hamburger.
- [x] **F2** Prehľad — hero gradient, KPI band 7 kariet s YoY+ikony, choropleth mapa (React: SFZ/RFZ/ObFZ + metriky + hover + rebríček), small multiples osôb (sparkline), 2 sunbursty (šport/gender filter; osoby 4-prstencové per úroveň), SR pyramída.
- [x] **F3** Profil zväzu — vyhľadávateľný ZvazPicker (ObFZ pod RFZ, bez diakritiky), drill-down vekových kategórií.
- [x] **F4** Porovnania — bump chart poradia RFZ v čase (+ existujúca sort tabuľka a radar).
- [x] **F5** Demografia — nová sekcia `/demografia` + `/demografia/[id]` (multi-line trend po kategóriách/úrovniach, výber čiar, pyramída).
- [x] **F6** Projekty — donut pohlavia, zladenie na nové tokeny.
- [x] **F7** ETL sunburstOsoby 4-prstencový (odvetvie→úroveň→rola→vek; SFZ vrátane ULK) — nahrádza placeholder.

Build 707 stránok. **Poznámky/zvyšky:** stará `/prehlad` stránka je duplicitná (index = plný Prehľad) — zvážiť zmazanie so súhlasom PO; SeasonPicker na Prehľade zatiaľ nemení sezónu reaktívne (Prehľad je server-rendered pre poslednú kompletnú sezónu) — plná reaktivita/permalink je ďalší krok; staré komponenty MapaSR.astro, KategorieChart.astro, SumarSR.astro ostali v repe (nahradené, neodkázané) — zmazať so súhlasom.

## Stav k 19. 7. 2026 (predošlá session)

## Rozhodnutia PO z 13. 7. 2026 (plný dátový beh)

| Otázka | Rozhodnutie |
|---|---|
| Rozsah sezón | **Dve vlny:** vlna 1 = 2025/2026 všetkých 43 zväzov; vlna 2 = história 2013/2014–2024/2025 |
| Poradie zväzov | **SFZ → RFZ → ObFZ po regiónoch** (BFZ, ZsFZ, SsFZ, VsFZ); commit po dávkach |
| Anomálie počas behu | **Zbierať a riešiť hromadne na konci** (beh sa nezastavuje, stop len pri systémovej chybe); zapísať do report-kvality-dat.md |
| Demografia ďalších zväzov | **Až po hlavnom behu, ak zvýši čas** |
| Terminológia zdroja dát | Zdroj dát je **platforma sportnet.online** — nezamieňať s verejným portálom Sportnet.sk (ten na platforme len beží); opravené v dokumentácii |

## Prebieha (táto session)

- [x] **Vlna 1:** ETL 2025/2026 pre všetkých 43 zväzov (SFZ → RFZ → ObFZ po regiónoch), dávkový runner `etl/beh.py` — **hotové 13. 7. 2026: 43/43 OK, 0 preskočených, 2 anomálie (VsFZ), žiadna systémová chyba** (viď report-kvality-dat.md §8)
- [x] **Vlna 2:** história pre všetkých 43 zväzov — **hotové 13. 7. 2026: 43/43 zväzov kompletných, 573 sezónnych výstupov, 0 kritických anomálií** (viď report §9). zsfz 2021/22–2024/25 dogenerované cez `--hint` (viď §9d).
- [x] Po behu: kontrola `data/index.json`, anomálie a zistenia do report-kvality-dat.md §8–§9, commity po regiónoch
- [x] Korekčná vrstva divákov (`etl/config/korekcie.json` + `audience_expr`): Sľažany–Nevidzany 300000→30, obfz-nitra 2019/20 pregenerované (viď report §9c)

## Zásobník (podľa priority)

- [x] zsfz 2021/22–2024/25 dogenerované (13. 7. 2026) cez `--hint` — zsfz kompletný (14 sezón), stav 43/43 (viď report §9d).
- [ ] **DBA/PO: vytvoriť cielený index na `matches`** (ADR-0004; diagnóza cez explain — report §9d):
  `db.matches.createIndex({ appSpace:1, closed:1, "rules.sport_sector":1, "season.name":1 }, { name: "etl_appSpace_closed_sport_season" })`
  Zrýchli všetkých 7 ETL agregácií pre všetky zväzy a **odstráni potrebu `--hint`**. Hint je len dočasná obchádzka.
- [ ] (Neskôr, opatrne) Revízia počtu indexov na `matches` — 44 indexov spomaľuje samotné plánovanie dotazov (`optimizationTimeMillis ≈ 1,9 s`, `maxIndexedAndSolutionsReached`).
- [ ] Demografia ďalších zväzov (SFZ, 4 RFZ, ostatné ObFZ) — rovnaký vzor ako ObFZ Nitra (`etl/demografia.py`)
- [~] Frontend (ADR-0005 — Astro + ECharts + Tailwind): **hotové** — mapa SR, profil zväzu, per-sezónne stránky, graf kategórií, pohlavie+osoby, medziročné porovnanie KPI, F4 porovnanie a radenie zväzov, **F5 demografia** (10-ročné trendy osôb po rolách na profile). Build 646 stránok.
- [x] **Nasadenie na Cloudflare — Workers static assets** (19. 7. 2026) — skúšobné nasadenie, funkčné (`web/wrangler.jsonc`, git-connected Worker). **https://statistika-futbalsfz-sk.jan-letko.workers.dev** beží ďalej ako záložná URL (nezmazané, nevyužívané). Vlastnú doménu sme sem nedali — PO rozhodol nepresúvať DNS zónu `futbalsfz.sk` na Cloudflare nameservery (riziko pre firemný email na M365), pozri nižšie.
- [x] **Produkčné nasadenie — Vercel** (19. 7. 2026) — finálne riešenie: git-connected projekt `statistika-futbalsfz-sk` (tím `ltksolutions-projects`), Root Directory `web`, framework Astro auto-detekovaný. Deploy `dpl_87MaLvX5k9UQEDWovTPC9vqF11mN` READY (commit `a477f9b`). **Vlastná doména `statistika.futbalsfz.sk` nastavená cez CNAME na WebSupport DNS** (bez presunu nameserverov — DNS pre futbalsfz.sk zostáva na WebSupport.sk, email cez M365 nedotknutý). PO potvrdil funkčnosť.
- [x] **Prepínač odvetvia futbal/futsal** (19. 7. 2026) — futsalové sezónne stránky `/zvaz/[id]/[odvetvie]/[sezona]` (11 sezón SFZ z `…-futsal.json`), prepínač odvetvia na sezónnych stránkach (`SezonaProfil.astro` — zdieľaný futbal aj futsal), futsalové sezóny na profile ako odkazy; medziročné porovnanie v rámci odvetvia preskakuje chýbajúce sezóny (futsal 2022/23). Build 657 stránok.
- [x] **F4 rozšírenie: výber 2–5 zväzov + radar** (19. 7. 2026) — `PorovnanieView.astro`: chips výber zväzov (limit 5), radar graf normalizovaný na maximum úrovne (100 % = najlepší zväz v metrike), skutočné hodnoty v tooltipe.
- [x] **Vekové pyramídy** (19. 7. 2026) — `VekovaPyramida.astro` na profile zväzu: rok narodenia × pohlavie z `data/demografia/{id}.json`, klientske prepínače roly a sezóny, poznámka o osobách bez pohlavia/dátumu narodenia (payload max ~60 KB, SFZ profil 132 KB HTML).
- [x] **Demografia všetkých 43 zväzov** — hotové 13. 7. 2026 (`etl/demografia.py --hint`), `data/demografia/{id}.json`, 0 anomálií (žiadny zväz >20 % bez dátumu narodenia).
- [ ] Optimalizácia: tree-shaking ECharts (import len potrebných modulov cez `echarts/core`) — teraz sa bundluje celý (~1 MB) na sezónnych stránkach
- [ ] Overiť odoslanie podkladov Bart.sk (`docs/podklady-bart-produkcny-beh.md`) — čaká na odoslanie PO
- [ ] Overiť odoslanie nahlásenia chybného záznamu divákov (`docs/sportnet-nahlasenie-divaci.md`) — draft čaká na PO
- [x] Futsal: historické sezóny (SFZ) — **hotové 13. 7. 2026: 11 sezón (2014/15–2025/26, 2022/23 v DB prázdna), 0 kritických anomálií**; evidencia v `index.json` cez `zvazy[sfz].odvetvia.futsal` (aktualizuj_index rozšírené)
- [x] **Projekty** (disney, kruzkymcd, dajmespolugol) — **hotové 19. 7. 2026**: `etl/projekty.py` (agregácia z `competitions` — deti/školy/tímy + vek×pohlavie zo súpisiek, nie zo zápasov), `data/projekty/{id}.json` + index, stránka `/projekty` (KPI, trend zapojenia, veková pyramída detí, prepínač sezóny) + odkaz v menu. Rozhodnutia PO: dajmespolugol bez 2018/2019 (7 sezón, DSG posledná 1 625 detí), kruzkymcd ukončený (publikované), disney plné dáta od 2026/2027 (zatiaľ len tímy/školy, 0 detí). Config `zvazy.json → projekty.zoznam`.
- [ ] Osoby × pohlavie × veková úroveň v ETL profiloch — rozšírenie pipelines (pohlavie osôb cez gender časti súťaže), umožní pill filter pohlavia aj na sunburste osôb (dnes len na súťažiach); vyžaduje re-beh histórie.
- [ ] Optimalizácia úvodnej stránky — payload sumáru (452 KB HTML; gzip to zrazí, ale zvážiť orezanie sunburst dát starých sezón).
- [x] **Úvodná stránka: celoslovenský sumár** (19. 7. 2026) — `etl/sumar.py` → `data/sumar/` (KPI SR, osoby po roliach, sunbursty, SR demografia); KPI bloky s prepínačom sezóny (default aktuálna 2026/2027 + poznámka), sunburst súťaží (odvetvie→SFZ→RFZ→ObFZ, pill filter pohlavia) a osôb (odvetvie→rola→veková úroveň), SR veková pyramída. Pyramídy zobrazujú **vek** namiesto roku narodenia (rozhodnutie PO). Build 660 stránok, nasadené na Vercel.
- [x] **ETL sezóna 2026/2027** (19. 7. 2026) — beh 43 zväzov (3 s dátami: SFZ, ObFZ NR, SOFZ SNV — 29 zápasov, sezóna začala 1. 7.), demografia SFZ; `demografia.py` merguje jednotlivé sezóny do existujúceho súboru (pripravené pre denný cron).
- [x] **Počet súťaží — historický re-beh** (19. 7. 2026) — `kpi.sutaze` (distinct súťaž so zápasom) doplnený pre všetkých 43 zväzov × celú históriu (576 sezón, ~29 min cez index hint) + futsal (11). Overené: ZsFZ 2025/26 = 21 súťaží (sedí so vzorom infografiky). Karta Súťaže + blok o súťažiach teraz na všetkých sezónach.
- [ ] Pokrytie kariet/gólov za prípravky (U07–U11) — publikovať len s výhradou/nezobrazovať (F2 rozhodnutie o UI)

## Hotové (výber)

- [x] F1 dátový audit + report kvality dát (12. 7. 2026)
- [x] ETL v1 `etl/run.py` — verifikované na ObFZ Nitra, ZsFZ, SFZ (12.–13. 7. 2026)
- [x] Dimenzia pohlavie M/F/NEURCENE vo všetkých výstupoch; KPI = súčet pohlaví (13. 7. 2026)
- [x] Normalizácie: WUxx→Uxx, „Dospelí“→ADULTS, „U15 mix“→U15, U21 v číselníku (13. 7. 2026)
- [x] Demografia v1 `etl/demografia.py` — ObFZ Nitra, 13 sezón, 100 % pokrytie (13. 7. 2026)
