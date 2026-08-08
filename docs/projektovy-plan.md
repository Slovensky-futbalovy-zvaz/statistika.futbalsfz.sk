# Štatistika.futbalsfz.sk — Projektový plán a koncept

**Verzia:** 1.0 (návrh na pripomienkovanie) · **Autor:** Ján Letko · **Dátum:** 12. 7. 2026
**Zdroj dát:** Sportnet (MongoDB „sutaze“, API Súťaže v2, CRM API)

---

## 1. Zhrnutie

Cieľom projektu je vytvoriť verejne dostupný interaktívny štatistický portál slovenského futbalu na doméne **statistika.futbalsfz.sk**. Portál nadväzuje na overený koncept sezónnych infografík zväzov (referenčné realizácie ObFZ Nitra a ZsFZ) a rozširuje ho o interaktívnu mapu Slovenska so všetkými tromi úrovňami futbalovej pyramídy (SFZ → 4 RFZ → 38 ObFZ), plnú granularitu vekových úrovní, porovnávanie a radenie zväzov podľa vybraných ukazovateľov a 10-ročnú demografiu osôb vo futbale (hráči, tréneri, rozhodcovia, delegáti).

Uskutočniteľnosť bola overená priamo v databáze: dáta siahajú po sezónu 2012/2013, plné pokrytie je od sezóny 2013/2014 a napríklad sezóna 2016/2017 obsahuje 57 399 uzavretých zápasov, všetky s nomináciami. Požadovaný 10-ročný demografický pohľad je teda dátovo podložený.

Odporúčaná architektúra je hybridná: interné ETL skripty periodicky predgenerujú agregované JSON súbory z databázy Sportnet a verejný web je čisto statická aplikácia servírovaná cez CDN — bez priameho prístupu verejnosti k databáze či interným API (kapitola 7 a ADR-0001).

## 2. Vízia a ciele

**Vízia:** každý fanúšik, funkcionár, novinár či rodič si vie na jednom mieste pozrieť, ako žije futbal v jeho okrese, kraji aj na celom Slovensku — koľko sa hrá, koľko detí hrá, ako sa vyvíjajú počty trénerov a rozhodcov — a porovnať svoj zväz s ostatnými.

### 2.1 Merateľné ciele

- Publikovať štatistiky pre všetkých 43 zväzov (SFZ + 4 RFZ + 38 ObFZ) minimálne za 10 sezón.
- Interaktívna mapa s drill-down na 3 úrovne a rozbaliteľnými vekovými úrovňami (zobrazujú sa len úrovne reálne hrané v danom ročníku).
- Porovnanie ľubovoľných zväzov a radenie podľa vybraných ukazovateľov v rámci zvolenej sezóny (inšpirácia stats.sportup.sk).
- Demografické trendy osôb (hráči, tréneri, rozhodcovia, delegáti) za 10 sezón, v členení podľa vekových kategórií a pohlavia.
- Automatická aktualizácia dát bez manuálneho zásahu (aktuálna sezóna denne alebo týždenne).

### 2.2 Čo projekt nie je

- Nie je to náhrada futbalnetu — portál nezobrazuje výsledky jednotlivých zápasov ani tabuľky súťaží, iba agregované štatistiky.
- Nezobrazuje žiadne osobné údaje jednotlivcov — výhradne agregované počty (GDPR, kap. 6 a 11).

## 3. Východiská a už vykonaná práca

- **Referenčné infografiky:** kompletné sezónne porovnania pre ObFZ Nitra a ZsFZ (2024/2025 vs. 2025/2026) vrátane máp, KPI, vekových kategórií a štatistiky osôb.
- **Znovupoužiteľný skill „sfz-sezonna-statistika“:** odladené MongoDB agregačné pipelines pre všetky metriky, mapovanie vekových kategórií, skript na generovanie SVG mapy z KMZ exportu a referenčná HTML šablóna. Tieto pipelines sú priamym základom budúceho ETL.
- **Overené poznatky o dátach:** identifikácia zväzu cez appSpace, pasca premenovávania súťaží počas sezóny, spoľahlivé pole `teams[].ageCategory`, metodika unikátnych osôb (kap. 9 a [metodika.md](metodika.md)).
- **Mapové podklady:** KMZ export z Google My Maps s vrstvami Slovensko, Kraje, Okresy, RFZ (4 polygóny) a ObFZ (38 polygónov).

### 3.1 Referencia: stats.sportup.sk

Portál stats.sportup.sk (SportStats) je interaktívny dashboard dát o slovenskom športe za roky 2021–2026 postavený na dátach Informačného systému športu SR. Preberáme princíp výberu roka/sezóny, trendových grafov a radenia podľa ukazovateľov; náš portál ide hlbšie (3 úrovne zväzov, vekové úrovne, zápasové metriky) a stavia na primárnom zdroji — databáze Sportnet.

## 4. Cieľové skupiny

| Skupina | Potreba | Typické použitie |
|---|---|---|
| Funkcionári zväzov (SFZ, RFZ, ObFZ) | Podklady pre rozhodovanie, VV, konferencie | Medziročné porovnanie svojho zväzu, trend družstiev mládeže |
| Kluby a tréneri | Kontext o regióne | Koľko družstiev U15 hrá v okrese, vývoj počtu hráčov |
| Médiá a novinári | Overiteľné čísla o futbale | Demografické trendy, porovnania krajov |
| Rodičia a verejnosť | Prehľad o futbale v okolí | Mapa → môj okres → mládežnícke súťaže |
| Analytici / štát (šport) | Dáta o organizovanom športe | 10-ročné trendy registrovaných osôb |

## 5. Funkčné požiadavky (rozsah MVP)

MVP ide v plnom rozsahu — všetky nasledujúce moduly sú súčasťou prvej verzie.

### F1 — Interaktívna mapa Slovenska

- Tri prepínateľné úrovne: SFZ (celé Slovensko), RFZ (4 regióny), ObFZ (38 oblastí); polygóny z existujúceho KMZ podkladu.
- Kliknutím na oblasť sa otvorí štatistický profil daného zväzu; hover zobrazí mini-súhrn.
- Voliteľné tematické zafarbenie mapy podľa zvoleného ukazovateľa (choropleth).

### F2 — Štatistický profil zväzu

- KPI riadok: odohrané zápasy, družstvá, góly, diváci, žlté a červené karty — s medziročným porovnaním a farebným značením poklesu.
- Rozpad podľa 4 hlavných kategórií (Dospelí, Dorastenci, Žiaci, Prípravky) s rozbalením na konkrétne vekové úrovne; zobrazia sa len úrovne s aspoň jedným uzavretým zápasom v ročníku.
- Sekcia Osoby v súťažiach: hráči, tréneri, rozhodcovia, delegáti podľa vekových kategórií, s metodickou poznámkou o viacnásobnom pôsobení.
- Metodické poznámky pod profilom.

### F3 — Výber sezóny a medziročné porovnanie

- Prepínač ročníkov minimálne od 2016/2017 (10 sezón), s ambíciou až po 2013/2014.
- Každý ukazovateľ s hodnotou predchádzajúcej sezóny a percentuálnou zmenou.

### F4 — Porovnania a radenie zväzov

- Tabuľkový režim: zväzy jednej úrovne ako riadky, ukazovatele ako stĺpce, radenie kliknutím.
- Výber 2–5 zväzov na priame porovnanie (bar chart / radar).
- Normalizované ukazovatele (na družstvo, na zápas, na obyvateľa okresu).

### F5 — Demografia osôb za 10 rokov

- Trendové grafy unikátnych hráčov, trénerov, rozhodcov a delegátov po sezónach, za každý zväz aj za SR.
- Členenie podľa vekových kategórií a pohlavia (ženský futbal ako samostatný pohľad).
- Vekové pyramídy hráčov, ak CRM API poskytne agregovateľné roky narodenia (overí sa vo F1).

### F6 — Zdieľanie a export

- Permalink na každý pohľad (zväz + sezóna + ukazovateľ).
- Export pohľadu do PNG/PDF (nadväzuje na dizajn infografík).
- Otvorené dáta: stiahnutie agregovaných JSON/CSV.

### F7 — Obsah a dôveryhodnosť

- Sekcia Metodika: úplný popis výpočtov, zdrojov a známych obmedzení dát.
- Časová pečiatka poslednej aktualizácie pri každom pohľade.

## 6. Nefunkčné požiadavky

- **Výkon:** úvodná mapa do 2 s; prepnutie zväzu/sezóny do 500 ms (dáta predpočítané).
- **Responzivita:** plnohodnotné použitie na mobile.
- **SEO:** statické predgenerovanie stránok zväzov (indexovateľné profily).
- **Bezpečnosť:** verejný web bez prístupu k databáze a interným API.
- **GDPR:** žiadne osobné údaje; agregáty pod prahom (napr. < 3 osoby) sa posúdia z hľadiska nepriamej identifikovateľnosti.
- **Náklady:** statický hosting + CDN, rádovo jednotky € mesačne.
- **Prístupnosť:** farebné škály čitateľné pri farbosleposti; mapa s tabuľkovou alternatívou.

## 7. Dátová architektúra — analýza a odporúčanie

Posudzované varianty: **A** — živé volania Sportnet API; **B** — predgenerované JSON (ETL); **C** — hybrid (B + denná regenerácia aktuálnej sezóny, historické sezóny raz; tenká API vrstva len ak vznikne reálna potreba).

| Kritérium | A — živé API | B/C — predgenerované JSON |
|---|---|---|
| Rýchlosť odozvy | Závislá od API a agregácií za behu | Okamžitá — statické súbory z CDN |
| Náročnosť vývoja | Vysoká — nová backend služba | Nízka — ETL už z veľkej časti existuje |
| Prevádzkové náklady | Server + monitoring + škálovanie | Statický hosting + CDN |
| Bezpečnosť | Verejná expozícia interných API | Nulová expozícia — len agregáty |
| Aktuálnosť dát | Real-time | Denná/týždenná — pre sezónne štatistiky postačuje |
| Záťaž na Sportnet | Každá návšteva generuje dotazy | Jeden ETL beh denne |
| Riziko závislosti | Výpadok API = výpadok webu | Web funguje aj pri výpadku zdroja |

**Odporúčanie: Variant C.** Detailné zdôvodnenie v [ADR-0001](adr/0001-architektura-predgenerovane-json.md). Otvorená otázka pre Sportnet: či má ETL bežať priamo nad MongoDB, alebo cez API — rozhodne sa v dátovom audite (F1).

## 8. Technický návrh

| Komponent | Technológia (návrh) | Poznámka |
|---|---|---|
| ETL pipeline | Python (agregácie z existujúceho skillu), cron/CI | Beží v internej infraštruktúre s prístupom k DB/API |
| Dátové úložisko webu | Statické JSON + JSON schéma, verzovanie | ~43 zväzov × ~13 sezón; jednotky–desiatky MB |
| Frontend | Next.js/React (SSG) alebo Astro; grafy ECharts/D3; mapa SVG z KMZ | Statické predgenerovanie profilov pre SEO |
| Hosting + CDN | Podľa infraštruktúry SFZ (subdoména statistika.futbalsfz.sk) | TLS, cache, invalidácia po ETL behu |
| Automatizácia | Denný job: ETL → validácia → publikácia → invalidácia cache | Alerting pri zlyhaní alebo anomálii dát |

### 8.1 Návrh štruktúry JSON

- `index.json` — zoznam zväzov (id, názov, úroveň, appSpace, geometria-ref), dostupné sezóny.
- `zvaz/{id}/{sezona}.json` — KPI, metriky podľa vekových kategórií a úrovní, osoby, metodické flagy.
- `porovnania/{uroven}/{sezona}.json` — predpočítaná tabuľka zväzov úrovne pre porovnávanie/radenie.
- `demografia/{id}.json` — 10-ročné časové rady osôb podľa rolí, kategórií a pohlavia.

### 8.2 Mapa

Polygóny sa jednorazovo skonvertujú z KMZ do GeoJSON/TopoJSON (zjednodušené pre web, ~50–200 kB). Web používa interaktívne SVG s hover/click; existujúci skript `build_map_svg.py` poslúži ako základ konverzie.

## 9. Dáta, overené fakty a kvalita dát

### 9.1 Overené v databáze (12. 7. 2026)

- Sezóny v DB od 2012/2013 (117 súťaží); plné pokrytie od 2013/2014 (313 súťaží); stabilne 400–460 súťaží na sezónu od 2014/2015.
- Sezóna 2016/2017: 57 399 uzavretých zápasov, 100 % s nomináciami → 10-ročná demografia je dátovo podložená.
- Vekové úrovne spoľahlivo v poli `teams[].ageCategory` (U07–U19, ADULTS).

### 9.2 Známe riziká kvality dát

Podrobne v [metodika.md](metodika.md). Skratka: nekonzistentné názvy sezón (normalizačná mapa), premenovávanie súťaží počas sezóny (explicitné zlúčenie, nikdy regex), appSpace register 43 zväzov (nikdy nehádať), viacnásobné pôsobenie osôb (súčet po kategóriách > unikáty — publikovať oba pohľady), pokrytie divákov (publikovať s % pokrytia), roly trénerov (coach, assist_coach, coach_goalkeepers, conditioning_coach; nie manager), staršie sezóny (merať pokrytie, nespoľahlivé ukazovatele nezobrazovať).

## 10. Fázy projektu a harmonogram

| Fáza | Obsah | Výstup / akceptačné kritérium | Odhad |
|---|---|---|---|
| F0 — Príprava | Schválenie konceptu, vlastník vývoja, prístupy, GDPR, dizajn | Podpísané zadanie, prístupy zriadené | 2–3 týž. |
| F1 — Dátový audit a ETL | Normalizácia sezón, register appSpace, meranie pokrytia, agregácie, JSON schéma | Validované JSON za 10 sezón × 43 zväzov; report kvality | 4–6 týž. |
| F2 — Frontend: mapa a profily | Mapa 3 úrovní, profil zväzu, sezóny, drill-down | Klikateľný web nad reálnymi JSON, mobil OK | 4–6 týž. |
| F3 — Porovnania a radenie | Tabuľkový režim, normalizované metriky | Radenie a porovnanie pre všetky úrovne | 2–3 týž. |
| F4 — Demografia | 10-ročné trendy, pohlavie, kategórie | Trendy za všetky zväzy aj SR | 2–3 týž. |
| F5 — Beta a verifikácia | Interná beta, krížová kontrola so zväzmi, metodika | Odsúhlasenie čísel min. 3 pilotnými zväzmi | 2–4 týž. |
| F6 — Spustenie | DNS, produkčný ETL job, monitoring, komunikácia | Verejná prevádzka, denná aktualizácia | 1–2 týž. |

Celkovo cca **4–6 mesiacov** do verejného spustenia; F3 a F4 môžu bežať čiastočne paralelne.

## 11. Riziká a mitigácie

| Riziko | Dopad | Pravdep. | Mitigácia |
|---|---|---|---|
| Kvalita historických dát nepostačuje | Stredný | Vysoká | Merať pokrytie vo F1; nespoľahlivé ukazovatele nezobrazovať |
| Nedoriešený vlastník vývoja (O1) | Vysoký | Stredná | Rozhodnúť vo F0; dokument slúži ako zadanie |
| Zmena schémy DB / API Sportnetu | Stredný | Stredná | ETL validácie a alerting; dohoda o oznamovaní zmien |
| GDPR — malé agregáty | Stredný | Nízka | Prah minimálnej veľkosti bunky; posúdenie DPO vo F0 |
| Výkon ETL (10 sezón × 43 zväzov) | Nízky | Stredná | Historické sezóny raz; inkrementálne behy |
| Nesúlad čísel s očakávaniami zväzov | Vysoký | Stredná | Pilotná verifikácia vo F5; publikovaná metodika |
| Preťaženie rozsahom | Stredný | Stredná | Fázovanie s ukážkami; F2 je funkčné jadro |

## 12. Projektové riadenie

| Rola | Nominácia | Zodpovednosť |
|---|---|---|
| Sponzor projektu | vedenie SFZ (doplniť) | Rozsah, rozpočet, doména |
| Produktový vlastník | Ján Letko | Priority, akceptácia, metodika |
| Dátový inžinier (ETL) | podľa O1 | Agregácie, JSON, automatizácia, kvalita |
| Frontend vývojár | podľa O1 | Mapa, profily, porovnania, demografia |
| Dizajn / brand | SFZ marketing | Vizuálna identita SFZ |
| DPO / právnik | SFZ | GDPR posúdenie agregátov |

Riadenie: týždenný 30-min status počas aktívnych fáz; každá fáza končí demom a akceptáciou PO; rozhodnutia sa zapisujú ako ADR do `docs/adr/`.

## 13. Otvorené otázky a najbližšie kroky

| # | Otázka | Kto rozhoduje | Termín |
|---|---|---|---|
| O1 | Kto bude vyvíjať a prevádzkovať (interný tím SFZ / Sportnet / externý dodávateľ)? | Sponzor + PO | F0 |
| O2 | Prístup ETL: priamo MongoDB alebo cez Sportnet API? Stabilita schémy? | Sportnet + PO | F1 start |
| O3 | Doména a hosting: kto spravuje DNS futbalsfz.sk, kde pobeží CDN? | SFZ IT | F0 |
| O4 | Dizajn: tmavý vizuál infografík alebo svetlý web podľa brand manuálu? | SFZ marketing + PO | F2 start |
| O5 | GDPR: prah minimálnej veľkosti agregátu, posúdenie DPO | DPO SFZ | F0 |
| O6 | Rozsah športov: len futbal, alebo aj futsal/ženské súťaže samostatne? | PO | F1 |
| O7 | Poskytne CRM API agregovateľné demografické atribúty bez osobných údajov? | Sportnet | F1 |

**Stav otázok k 12. 7. 2026:**

- **O1 — ROZHODNUTÉ (Ján Letko, 12. 7. 2026):** trojstranný model. **SFZ tím** = tvorcovia myšlienok, prototypy, analýza dát a dátové štruktúry (vedie Ján Letko ako PO). **Sportnet Media s.r.o.** = vlastník a prevádzkovateľ platformy sportnet.online so všetkými dátami SFZ systémov, partner SFZ (vedie tiež Ján Letko). **Bart.sk** = externý dodávateľ senior developerov; security, code review a prevádzka služieb platformy sportnet.online pre SFZ; zadania a projektový manažment dodáva PO.
- **O2 — ROZHODNUTÉ:** ETL číta priamo MongoDB read-only ([ADR-0002](adr/0002-etl-priamo-mongodb.md)).
- **O3 — ROZHODNUTÉ (Ján Letko, 12. 7. 2026):** hosting na **Cloudflare Pages**, ETL ako denný cron u Sportnet/Bart.sk s výstupom cez git ([ADR-0003](adr/0003-hosting-cloudflare-pages.md), analýza: [analyza-hosting.md](archiv/analyza-hosting.md)); DNS doplní PO.
- **O4 — ROZHODNUTÉ (Ján Letko):** dizajn čo najviac podľa brand manuálu SFZ, s denným aj nočným režimom (light + dark mode). Detailný návrh sa dorieši v F2.
- **O5 — ROZHODNUTÉ (Ján Letko, 12. 7. 2026):** prah minimálnej veľkosti agregátu sa **nepoužije** — SFZ disponuje publicistickou licenciou, agregované počty sa zobrazujú všetky. Zásada „publikujú sa výhradne agregáty, žiadne menné zoznamy ani identifikátory osôb“ zostáva v platnosti (metodika).
- **O6 — ROZHODNUTÉ:** šport/športové odvetvie je systémová premenná ETL (futbal + futsal pod SFZ, `etl/config/sporty.json`); pohlavie (mužské/ženské súťaže) sa pridá ako ďalšia dimenzia ETL (naplánované, zdroj `parts[].rules.gender`); Projekty (disney, kruzkymcd, dajmespolugol) budú samostatná časť štatistík neskôr.
- **O7 — ROZHODNUTÉ:** CRM API netreba; demografia priamo z DB `sportnet.users` ako agregáty (viď metodika a report kvality dát, sekcia 7c).

**Najbližšie kroky:** pripomienkovanie dokumentu → prezentácia vedeniu SFZ/Sportnet (O1–O3) → klikateľný prototyp (mapa + 1 zväz + 2 sezóny) → štart F1.
