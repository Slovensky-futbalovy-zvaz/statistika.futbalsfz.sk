# Metodika a poznatky o dátach Sportnet

Zhrnutie overených poznatkov z realizácie infografík ObFZ Nitra a ZsFZ a z overovania databázy (júl 2026). Tento dokument je záväzný pre implementáciu ETL.

## Zdroj dát

- MongoDB, databáza **`sutaze`**, kolekcie **`matches`** a **`competitions`**.
- Alternatívne API: Súťaže v2 (`sutaze.sportnet.online/api/v2`), CRM (`api.sportnet.online/v1`) — rozhodnutie o prístupe ETL je otvorená otázka O2.

## Základné pravidlá

### Dátový model súťaže

- **Jedinečný identifikátor súťaže** je kombinácia: **Úroveň súťaže** (liga; 1. liga je najvyššia) + **Veková úroveň** (Ux; U19 je posledná oficiálna, nad ňou len „Dospelí“) + **Pohlavie** (muži, ženy) + **Sezóna** (ročník, 1.7.–30.6., formát „2025/2026“).
- **Názvy súťaží sú nespoľahlivé** — menia sa podľa partnerov v príslušnom ročníku. Nikdy nie sú identifikátorom.
- Súťaž obsahuje vždy minimálne jednu **Časť súťaže** (napr. Základná časť, Skupina o udržanie, Skupina o postup) — pri agregáciách zápasov pozor na dvojité započítanie, zápas patrí vždy práve jednej časti.
- SFZ je **vlastník** všetkých súťaží (~400 na sezónu); riadenie deleguje na RFZ a ObFZ — tie sú „riadiaci zväz súťaže“ (v dátach appSpace).

### Polia v kolekcii `competitions` (overené 12. 7. 2026, dokumentácia + reálne dáta)

- **`level`** = úroveň súťaže / liga (číslo; nižšie = vyššia súťaž, napr. 4 = IV. liga); `sortvalue` radí v rámci úrovne. Pokrytie, semantika a obmedzenia: kapitola **Úroveň súťaže — pyramída líg** nižšie.
- **`competitionGroupId`** = **stabilná identita súťaže naprieč sezónami aj premenovaniami** (kolekcia `competitions_groups`). Overené: „VIII. liga A - TAJBI sport ObFZ NR“ (2025/2026) nesie groupId vytvorené ešte v r. 2020. **ETL zlučuje premenované súťaže cez `competitionGroupId`, nie cez názvy ani `$in` zoznamy.**
- **`parts[]`** = časti súťaže; každá časť má:
  - **`rules.gender`** = pohlavie („M“ / „F“ / prázdne),
  - **`rules.category`** = veková úroveň („U15“, „ADULTS“…),
  - **`rules.sport_sector`** (futbal/futsal…), `format` (`points`/`draw`), `dateFrom`/`dateTo`, `teams[]`, `rounds[]`.
- Jedinečný identifikátor súťaže (úroveň + veková úroveň + pohlavie + sezóna) sa teda skladá z: `level` + `parts[].rules.category` + `parts[].rules.gender` + `season.name`.
- Zápas patrí vždy práve jednej časti súťaže → agregácie zápasov cez súťaž sa nedvojia; pozor len pri odvodzovaní atribútov súťaže z častí (súťaž môže mať viac častí s rovnakými rules — napr. skupiny A/B).

### Identifikácia zväzu — appSpace

- `appSpace` je kritický identifikátor riadiaceho zväzu; **nikdy sa nehádaj z názvu**, vždy sa overuje dotazom.
- ObFZ: typicky `obfz-<mesto>.futbalnet.sk` (napr. `obfz-nitra.futbalnet.sk`).
- RFZ: krátke identifikátory ako `ZsFZ` (bez domény) — úplne iný formát než ObFZ.
- `ownerPPO` je takmer vždy `futbalsfz.sk` (SFZ vlastní všetky súťaže) — na rozlíšenie zväzov nepoužiteľné.
- ETL musí obsahovať **overený register všetkých 43 zväzov** (SFZ + 4 RFZ + 38 ObFZ) s ich appSpace.
- **SFZ pohľad zahŕňa dva appSpace**: `futbalsfz.sk` a `ulk.futbalnet.sk` (Únia ligových klubov — Niké liga, najvyššia súťaž mužov; riadenie delegované na ULK, ale patrí do SFZ úrovne pyramídy). Rozhodnutie: Ján Letko, 12. 7. 2026.

### Šport a športové odvetvie (systémová premenná)

- Každý zápas nesie `rules.sport_sector` — športové odvetvie; súťaž ho má v `parts[].rules.sport_sector`.
- Číselníky Sportnet API: šport (`/v1/codelist/sport`) a odvetvia futbalu (`/v1/codelist/sport/futbal/sector`): **futbal, futsal, minifootball, beachfutbal** — lokálna kópia v `etl/config/sporty.json`.
- ETL vždy filtruje `rules.sport_sector` (default `futbal`) — overené: futbalové zväzy majú v dátach čisto `futbal`, filter nič nemení, ale chráni pred zmiešaním odvetví.
- **Futsal** (`appSpace: futsalslovakia.sk`) **patrí priamo pod SFZ** (rozhodnutie Ján Letko, 12. 7. 2026); generuje sa cez `run.py --zvaz sfz --sport-sector futsal` do súboru `{sezona}-futsal.json`. MVP publikuje futbal.
- **Projekty** (`disney`, `kruzkymcd`, `dajmespolugol`) sú SFZ grassroots projekty — časom pribudne samostatná časť štatistík „Projekty“; zatiaľ mimo ETL.

### Odohraný zápas

- Do štatistík sa počítajú len zápasy s `closed: true` (uzavreté/uzatvorené).
- **POZOR — kontumácia zápas automaticky uzatvára** (`closed:true`, vloží syntetické `goal_contumation` udalosti). Preto `closed:true` zahŕňa aj kontumácie a odstúpené družstvá, **vrátane tých, ktoré sa fyzicky nikdy nehrali** (technický výsledok 0:0, prázdna návštevnosť, bez rozhodcu). Samotný `closed` teda „odohraný“ nezaručuje.
- **Reálne odohrané (kpi.zapasy)** = `closed:true` **mínus administratívne ukončené bez zápisu**. Administratívne ukončený zápas = `__issfMatchStatus` (fallback `state`) ∈ {`KONTUMOVANY`, `ODSTUPENE_DRUZSTVO`} **a zároveň** žiadne udalosti v protokole (`protocol.events` prázdne) **a zároveň** žiadna návštevnosť (`protocol.audience` prázdne/0) **a zároveň** žiadna uzavretá nominácia (`nominations[].closed` — nebola podaná zostava). Implementácia: `_ADMIN_NEODOHRANY_EXPR` v `etl/pipelines/__init__.py`.
- **Reálne odohrané kontumácie/odstúpenia ostávajú započítané** (majú protokol, návštevnosť alebo uzavretú nomináciu) — vylučujú sa len administratívne bez akéhokoľvek znaku odohratia.
- Doplnkové KPI: `kpi.uzatvorene` (pôvodná báza všetkých `closed:true`), `kpi.administrativne`, a kategórie `kpi.kontumovane` / `kpi.odstupene` (každá so split `*Admin` / `*Odohrane`). Odstúpené družstvo **nemá** `contumation.isContumated` — preto sa kategórie určujú cez `__issfMatchStatus`, nie cez `isContumated`.
- **Overenie (ObFZ Nitra 2025/2026):** uzatvorené 2786 → reálne odohrané 2634; administratívne 152. Pôvodná proxy (bez udalostí a bez divákov) dávala 155; spresnenie o uzavretú nomináciu (3 zápasy s podanou zostavou sa preklopili na odohrané) → 152. Nezávislá ISSF analýza: 2782 vs 2627. Celoslovensky 2025/2026: 63 943 uzatvorených → 61 004 odohraných, 2 939 administratívnych (≈ 4,6 %).

### Premenovávanie súťaží počas sezóny (rebranding pasca)

- Súťaže sa vedia premenovať v priebehu ročníka (sponzorské názvy) — overený prípad v ObFZ Nitra („VIII. liga - A“ → „VIII. liga A - TAJBI sport“).
- **Správne riešenie: zlučovať cez `competitionGroupId`** (stabilné naprieč sezónami aj premenovaniami — viď vyššie). Explicitný `$in` zoznam názvov je len núdzový fallback.
- **Nikdy nepoužívať regex na názvy súťaží** — falošné zhody (regex „A“ matchuje „TAJBI“); názvy sa menia podľa partnerov a nie sú identifikátorom.

### Vekové kategórie

- Primárny zdroj: `teams[].ageCategory` — **ale vyplnené len od sezóny 2024/2025** (99,6 %; staršie sezóny ~0 % — overené 12. 7. 2026).
- **Historické sezóny (≤ 2023/2024):** kategória z `competitions.parts[].rules.category` (vyplnenosť 96,5 – 100 %), join cez `match.competitionPart._id`. **Fallback je implementovaný v ETL** (mapa partId→kategória sa načíta z `competitions` a vkladá do pipelines ako `$switch`; overené na ObFZ Nitra 2019/2020 — 100 % zápasov s kategóriou, 12. 7. 2026).
- Reálny číselník hodnôt je širší než metodika pôvodne uvádzala: `U06`–`U20` + `ADULTS` (U10 v ZsFZ, U08/U12/U14/U16 inde, U20 vo futsale).
- Mapovanie do 4 hlavných kategórií: Dospelí (ADULTS), Dorastenci (U17, U19), Žiaci (U12–U15), Prípravky (U07–U11).
- Dorastenci sú na RFZ/SFZ úrovni nenulová kategória (na rozdiel od niektorých ObFZ) — nulu nikdy nepredpokladať, vždy overiť.
- Na webe sa zobrazujú len vekové úrovne, ktoré mali v danom ročníku aspoň jeden uzavretý zápas.

### Pohlavie (dimenzia O6, rozhodnutia 13. 7. 2026)

- Zápas pohlavie priamo nenesie — **jediný zdroj je `competitions.parts[].rules.gender`** („M“/„F“), mapovanie cez `match.competitionPart._id` rovnakým mechanizmom ako fallback kategórií (mapa partId→{cat, gender} v ETL).
- Vyplnenosť overená 13. 7. 2026: v riadnych súťažiach ~100 % (2013/2014: 339 M + 13 F; 2025/2026: 964 M + 29 F častí). Prázdny gender **neznamená mužské** — sú to testy, grassroots projekty a malý futbal (mimo ETL); jediná reálna výnimka je školský turnaj VsFZ s kategóriou „U15 mix“.
- Zmiešané časti (M aj F v jednej súťaži) v riadnych súťažiach neexistujú.
- **Výstupná schéma:** blok `pohlavie` vedľa `kategorie` — `{M: {súhrn + kategorie}, F: {…}, NEURCENE: {…}}`; skupina NEURCENE (časť bez gender) sa vykazuje samostatne a vždy loguje ako anomália.
- **KPI a `kategorie` zväzu zostávajú súčtom všetkých pohlaví** — dimenzia pohlavie je doplnkový drill-down; existujúce čísla sa nemenia.
- Súčty M+F+NEURCENE presne sedia na KPI (zápas patrí práve jednej časti); výnimka `druzstva` — organizácia s mužským aj ženským družstvom sa počíta v oboch pohlaviach (analógia dvojitého pôsobenia osôb, publikovať s poznámkou).
- Ženský futbal 2025/2026: SFZ 6 súťaží (ADULTS 222, U19 351, U15 351, WU14 12 zápasov), SsFZ 5, BFZ 3, VsFZ 1, futsal 1; **ZsFZ a všetky ObFZ bez ženských súťaží** (reálny stav).
- **WUxx → Uxx** (rozhodnutie Ján Letko, 13. 7. 2026): „W“ v kategórii (napr. WU14 na futbalsfz.sk) je len označenie ženskej súťaže v názve kategórie — veková úroveň je Uxx, pohlavie nesie `rules.gender` („F“). ETL normalizuje v part mape; hodnoty WUxx sa vyskytujú výhradne v `parts.rules.category` (v `teams.ageCategory` nie).
- **Normalizácia nekanonických kategórií** (rozhodnutie Ján Letko, 13. 7. 2026): „Dospelí“ → ADULTS (futsal, Vysokoškolská liga), „U15 mix“ → U15 (školský turnaj VsFZ; zmiešané pohlavie vykáže dimenzia pohlavie ako NEURCENE). **U21** (SsFZ 2015/2016) je regulárna veková úroveň — doplnená do číselníka medzi ADULTS a U20.

### Úroveň súťaže — pyramída líg (dimenzia, meranie a rozhodnutia 6. 8. 2026)

- Zdroj je **`competitions.level`** — číselné, **nenastaviteľné** pole kopírované z ISSF (nižší level = vyššia súťaž). Zápas úroveň priamo nenesie — mapuje sa cez `match.competition._id` mapou `competitionId → kód úrovne` (`run.nacitaj_comp_mapu`), analógiou k part mape pre vekovú úroveň a pohlavie.
- **ZÁKLADNÝ KĽÚČ (rozhodnutie Ján Letko, 6. 8. 2026): `level` sa vždy vzťahuje ku KONKRÉTNEJ VEKOVEJ ÚROVNI, nie k vekovej kategórii.** Neexistuje jedna spoločná pyramída pre všetky vekové úrovne — každá veková úroveň (ADULTS, U19, U15, U11…) má vlastnú pyramídu. „1. liga“ dospelých, „1. liga“ U19 a „1. liga“ U13 sú **tri rôzne súťaže v troch rôznych pyramídach** a nesmú sa sčítať do jedného stĺpca. Vekové kategórie (Dospelí, Dorast, Žiaci, Prípravky) sú **len medzisúčty pre vizualizáciu** — okrem Dospelých obsahuje každá viacero vekových úrovní. **Toto nie je chyba dát, je to spôsob, akým sa súťaže organizujú** (a nielen vo futbale).
- **Hĺbka pyramídy sa líši podľa vekovej úrovne aj podľa regiónu** — podľa toho, koľko stupňov sa v danej úrovni reálne hrá. Príklad U11 (2025/2026): „Prípravka U11 ObFZ Kysúc“ má level 1, „Prípravka U11 ObFZ Trnava“ level 3 — v západnom regióne je nad oblastnou súťažou ešte regionálna a celoštátna U11, na Kysuciach nie. Číslo teda popisuje reálnu štruktúru, len ju **nemožno čítať ako výkonnostnú škálu porovnateľnú medzi zväzmi**.
- **Pokrytie (merané 6. 8. 2026 nad `competitions`, futbal, kanonické sezóny):** 100 % v sezónach 2012/2013–2017/2018, potom 95–99 % (2024/2025: 421 zo 437; 2025/2026: 421 z 432; 2026/2027: 401 z 405). Hodnota `null` sa **nevyskytuje ani raz** — pole buď je číslo, alebo chýba úplne.
- **Čo chýba, nie sú ligy:** reprezentačné turnaje (RT U14, RT WU14, Memoriál Gejzu Princa), Regions' Cup, Vysokoškolská liga (futbal aj futsal), školský turnaj ZŠ mesta Košice. Jediná bežná liga bez `level` je VII. liga SOFZ.
- **Stabilita naprieč sezónami:** medzi 2024/2025 a 2025/2026 má z 401 skupín (`competitionGroupId`) rovnakú úroveň 390, šesť ju zmenilo, päť ju nemá → 98,5 %. Cez celú históriu 2012→2026 je to horšie (zo 695 skupín má 317 jednu hodnotu, 278 dve, 32 tri, 4 štyri) — zodpovedá prečíslovaniam v rokoch 2013–2016.
- **Skupiny vo výstupe** (rozhodnutie Ján Letko, 6. 8. 2026): `L1`…`L9` = 1.–9. liga, `L10P` = „10. liga a nižšie“ (pojíma aj ojedinelé hodnoty 12 a 20), `POHARE` = level ≥ 90 (poháre, superpoháre a halové turnaje — Slovnaft Cup 96, Prezidentský pohár 97, oblastné poháre 99), `NEURCENE` = level nevyplnený.
- **Kontrola na dospelých (2025/2026):** pyramída ADULTS mužov je plná a celoslovenská — 1 = Niké liga, 2 = MONACObet, 3 = III. liga (SFZ), 4–6 = regionálne (RFZ), 7–9 = oblastné (ObFZ). Ženská vetva beží paralelne (vlastná 1., 2. a 3. liga). Pre U19, U15 a U13 vychádza rovnako konzistentný obraz v rámci každej vekovej úrovne.
- **Spôsob vykazovania (rozhodnutie Ján Letko, 6. 8. 2026):** vo frontende sa zobrazuje **niekoľko samostatných pyramíd — jedna na vekovú kategóriu** (Dospelí, Dorast, Žiaci, Prípravky), pretože kategórie sa naprieč zväzmi pravidelne sledujú. V každej sa dá rozbaliť konkrétna veková úroveň (U19, U18, U17, U16…), kde je pyramída metodicky presná; pri zobrazenom medzisúčte kategórie sa uvedie, cez ktoré vekové úrovne sa sčítava. **Pyramídy sa nikdy nezlučujú do jednej.**
- **Výstupná schéma:** blok `urovne` = `{kód: {nazov, sutaze, zapasy}}` — **disjunktný** (súťaž má práve jednu úroveň), preto súčet presne sedí na `kpi.sutaze`. Blok `sutazeUroven` = plochý zoznam `{uroven, kat, pohlavie, sutaze, zapasy}` — súťaž so zápasmi vo viacerých vekových úrovniach sa v ňom započíta v každej z nich, takže súčet môže `kpi.sutaze` prevýšiť (rovnaká metodika ako `kategorie.*.sutaze`).
- **Počet súťaží po pohlaví** (`pohlavie.{M,F,NEURCENE}.sutaze` a rovnaký kľúč v ich `kategorie`) je distinct súťaž danej skupiny; súťaž s mužskými aj ženskými časťami sa započíta v oboch, preto sa **nesčítava** — preberá sa priamo z agregácie.
- Všetky štyri rezy počíta jediný prechod nad `matches` (`pipelines.pocet_sutazi_rozpad`, `$facet` nad distinct štvoricou pohlavie × veková úroveň × úroveň súťaže × súťaž).

#### Zobrazenia pyramídy vo frontende (doplnené 7. 8. 2026)

Pyramída sa ukazuje v troch pohľadoch; každý odpovedá na inú otázku a všetky čítajú ten istý blok `sutazeUroven`.

- **Pyramída súťaží** (`PyramidaSutazi.tsx`, profil zväzu + Prehľad) — statický rez jednou sezónou: štyri samostatné siluety vedľa seba, jedna na vekovú kategóriu, s možnosťou rozbaliť konkrétnu vekovú úroveň. Odpovedá „ako vyzerá pyramída tohto zväzu dnes“.
- **Heatmapa zväzy × úrovne** (`HeatmapaUrovni.tsx`, Porovnania) — matica, riadok je zväz, stĺpec úroveň, hodnota počet súťaží. Odpovedá „kto čo riadi“ a robí okamžite viditeľným, že oblastné zväzy sedia na 7.–9. lige a regionálne na 4.–6. Prázdna bunka znamená, že zväz na danej úrovni v tomto reze súťaž nemá. Poháre, turnaje a súťaže bez úrovne majú vlastný stĺpec — do ligovej pyramídy nepatria.
- **Heatmapa sezóny × úrovne** (`HeatmapaZvazuVCase.tsx`, profil zväzu, sekcia „Ako sa menila pyramída súťaží“) — tá istá matica otočená na jeden zväz: riadok je sezóna, stĺpec úroveň. Odpovedá „kedy zväzu liga pribudla alebo zanikla“. Prebiehajúce sezóny sú zosvetlené a označené symbolom — čísla sa v nich ešte len dopĺňajú, nižšia hodnota nie je pokles. Referenciou je posledná kompletná sezóna z `poslednaKompletnaSlug()`.
- **Zrušené pohľady (7. 8. 2026, rozhodnutie Ján Letko):** čiarový graf `UrovenTrend` (vývoj počtu súťaží zvolenej úrovne naprieč zväzmi) a skladaný plošný graf `PyramidaVCase`. Pri RFZ aj ObFZ sa počty menia o jednotku raz za niekoľko rokov, takže čiary nepovedali nič, čo heatmapa neukáže presnejšie; plocha dávala len tvar bez čísel.
- **Sýtosť buniek** je pomer k maximu rezu. Keď má celý rez maximum 1 (napr. dorast, kde má každý zväz jednu súťaž), použije sa pevná miernejšia sýtosť — inak by matica bola jedna tmavá plocha.
- **Prenos dát do prehliadača:** rez pripravuje `web/src/lib/urovne.ts` (`getUrovneVCase`, `getUrovneVCaseZvazu`) a riadky serializuje ako jeden reťazec (`zvazIdx,sezonaIdx,urovenIdx,katIdx,pohlavieIdx,pocet` oddelené `;`), pretože pole polí by Astro do stránky zapísalo s obalom `[0, x]` okolo každého čísla — pri 38 ObFZ × 15 sezónach ~150 kB navyše.
- **POZOR pri úpravách:** typy a `rozbal()` žijú v samostatnom module **`web/src/lib/urovneTypy.ts`**, ktorý nesmie importovať `lib/data` ani nič z Node. React komponenty musia brať `rozbal()` odtiaľ, nie z `lib/urovne.ts` — ten číta JSON zo súborov a Vite by celú dátovú vrstvu pribalil do klientskeho bundlu. Stačilo to raz a stránka padala na `ReferenceError: process is not defined`: island sa nehydratoval a pill filtre nereagovali (nasadené v `a046cfcc8`, opravené ešte ten deň).

#### SÚŤAŽ vs. SÚŤAŽNÁ SKUPINA (rozhodnutie Ján Letko, 8. 8. 2026)

ZÁKLADNÝ KĽÚČ: **„súťaž = základná časť“**. To, čo ISSF vedie ako jednu súťaž, sa často hrá
vo viacerých **paralelných skupinách**, z ktorých každá má vlastných účastníkov a vlastnú tabuľku.
„III. liga U19 HUMMEL ZsFZ“ 2025/2026 je jedna súťaž, ale hrajú sa v nej **skupina JV a skupina SZ**
(obe 14 družstiev, 26 kôl) plus nadstavba. **Rovnakú realitu vykazujú zväzy rôzne** — ZsFZ vedie
IV. ligu U19 ako jednu súťaž so skupinami A–F, VsFZ tie isté skupiny ako samostatné súťaže.
**Počty súťaží preto medzi zväzmi nie sú porovnateľné; počty skupín áno.** To je hlavný dôvod
existencie tejto metriky.

**Databáza príznak typu časti NEMÁ.** Stĺpec „Základná / Nadstavbová časť“ existuje len v ISSF.
Overené 8. 8. 2026 — `competitions.parts[]` nesie iba `name`, `publicComment`, `type`, `format`,
`signup`, `published`, `rules`, `settings`, `dateFrom`, `dateTo`, `__issfId`, `_id`, `rounds`,
`teams`, `resultsTable`. `type` je collective/race (druh športu) a dátumy sú pri všetkých
častiach rovnaké. **Žiadosť na Sportnet: preniesť typ časti z ISSF do `parts[]`** — pozri `docs/TODO.md`.

Skupina sa preto určuje **dvoma sitami** (`run.nacitaj_skupina_mapu`):

1. **Štruktúrny signál** — nadstavba si družstvá preberá zo základných častí, nikdy neprivedie nové.
   *Časť je základná skupina, ak obsahuje aspoň jedno družstvo, ktoré nie je v žiadnej inej časti
   tej istej súťaže.* Identita družstva je `organization._id | category | ageCategory` — rovnaký
   kľúč ako pri Indexe klubu.
2. **Názov časti** (`run.je_nadstavbova_cast`) — sito č. 1 zlyháva tam, kde nadstavba nové družstvo
   priviesť naozaj môže: baráž o postup, kde súper prichádza z inej súťaže. Vyraďujú sa časti,
   ktorých názov (bez diakritiky, malými) obsahuje `baraz`, `nadstavb`, `o udrzanie`, `o postup`,
   `o titul`, `o umiestnenie`, `play-off`, `o majstra`, `majster okresu`, `kvalifikac`, `finale`,
   `finalov`, `semifinale`, `stvrtfinale`, `osemfinale`, `o N-M miesto`, `superpohar`.

**Prečo sa tu názvom veriť môže:** zásada „názvom neveriť“ sa týka **názvov SÚŤAŽÍ**, ktoré sa
menia podľa partnerov ročníka („III. liga U19 **HUMMEL** ZsFZ“). Názvy **ČASTÍ** sú štruktúrny
popis („Baráž o postup“, „Nadstavba o 5.–8. miesto“, „ŠTVRŤFINÁLE“) a nemenia sa.

**Vzor `o pohar` bol zámerne vyradený** — zachytával legítímne paralelné turnajové skupiny
(„Halový turnaj O pohár predsedu ObFZ Trnava sk. A / sk. B“). Zmerané 8. 8. 2026 na 2025/2026:
549 → 537 základných skupín, 12 preklasifikovaných, žiadna skutočná liga sa nestratila.

**FALLBACK:** ak sa v súťaži nedá rozlíšiť ani jedna základná skupina — všetky časti majú tých
istých účastníkov (turnajové prípravky, delenie na jesennú a jarnú časť), alebo všetky vypadli cez
sito názvov (Niké liga, Slovenský pohár SF) — **celá súťaž sa započíta ako JEDNA skupina.**
Konzervatívne: radšej podpočítať než nafukovať. Fallback sa vyhodnocuje **v rámci každého rezu
samostatne** (`run._skupiny_rezy`), nie globálne za súťaž — inak vznikajú rezy so `skupiny = 0`
pri `sutaze = 1`.

**Invariant (kontroluje sa po každom behu): `skupiny >= sutaze` v každom reze.**

**Výstupná schéma:** `kpi.skupiny`, `kategorie.*.skupiny`, `urovne.*.skupiny`,
`pohlavie.*.skupiny`, `sutazeUroven[].skupiny`; v porovnaniach `skupiny`, `skupinyPohlavie`,
`urovneSkupiny`; v súhrne aj listy `sunburstSutaze` (`skupiny`, `skupinyPohlavie`).

**Publikované čísla sa neprepisujú** (rozhodnutie Ján Letko) — obe metriky sú vo výstupe súčasne
a frontend medzi nimi prepína. **Predvolená je metrika Skupiny** (`METRIKA_DEFAULT`
v `web/src/lib/urovneTypy.ts`). Prepínač je v: KPI karte „Súťaže“, pyramíde súťaží, oboch
heatmapách úrovní, sunburste súťaží, radare a grafe vývoja v Porovnaniach aj v tabuľke zväzov.
Tabuľka má prepínač, nie dva stĺpce vedľa seba — je to zoraditeľný rebríček a dva stĺpce by
pozývali zoradiť podľa „Súťaže“, čo dáva poradie, ktoré medzi zväzmi neplatí.

Profily KLUBOV metriku `skupiny` nemajú (počíta ju `etl/run.py` pre zväzy, nie `etl/kluby.py`),
preto sa na stránke klubu prepínač **nezobrazí** — `KpiTrend` si prítomnosť metriky overuje
v dátach a pill skryje. Ticho ukazovať hodnoty `sutaze` pod názvom „Skupiny“ by bolo horšie
než prepínač nemať.

**Meranie po plných behoch (8. 8. 2026, celoslovensky, výsledné čísla s oboma sitami):**

| Sezóna | Súťaže | Skupiny | SFZ | RFZ | ObFZ |
|---|---|---|---|---|---|
| 2025/2026 | 397 | **557** | 27 → 56 | 83 → 125 | 287 → 376 |
| 2024/2025 | 401 | **569** | 27 → 50 | 86 → 121 | 288 → 398 |

Sito názvov ubralo oproti samotnému štruktúrnemu signálu 6 skupín v 2025/2026 a 3 v 2024/2025.
Kontrola všetkých **609 profilov** prešla bez chyby a bez varovania.

#### Kontextové popisky v grafoch (rozhodnutie Ján Letko, 10. 8. 2026)

Portál mal tri rôzne správania: grafy na ECharts (trendy, sunbursty, radar, demografia) mali
tmavý popisok idúci za kurzorom, mapy mali vlastný takmer zhodný, a ručne kreslené SVG grafy
len natívny `<title>`. Ten čaká asi sekundu, nedá sa naštýlovať a **na dotykových zariadeniach
sa nezobrazí vôbec**, takže mobilní návštevníci o detailné čísla úplne prichádzali.

Jediným miestom pravdy je **`web/src/components/Tooltip.tsx`** (`useTooltip`, `TipNadpis`,
`TipRiadok`). Vzhľad je odvodený z popisku máp, aby zostal zhodný s ECharts a nebolo treba
prekresľovať osem existujúcich grafov.

- **Natívny `<title>` a `title=` sa v grafoch už nepoužívajú.** Prístupnosť rieši `aria-label`
  na spúšťacom prvku; popisok je `aria-hidden`.
- **Dotyk:** ťuknutie popisok zobrazí, ťuknutie inam ho zavrie (handler na prvku volá
  `stopPropagation`, dokumentový listener zavrie zvyšok). Zavíra ho aj skrolovanie.
- **Preklopenie k okraju okna** — bez neho popisok pri pravom okraji vytŕčal von a na úzkych
  displejoch rozširoval stránku o vodorovné posúvanie.
- **Malé body čiarových grafov** (r = 2,4–2,8 px) majú neviditeľnú záchytnú plochu r = 9 px —
  do samotného bodu sa myšou netrafiť.
- **Čísla vykreslené na stupni pyramídy majú `pointer-events: none`**, inak by nad číslom
  popisok nevyskočil (nájdené pri kontrole v prehliadači 10. 8. 2026).
- **POZOR na poradie hookov:** `useTooltip()` musí byť nad každým podmieneným `return`
  (napr. `if (!body.length)` vo `VekKlubu`), inak sa volá podmienene.
- `useLayoutEffect` je vymenený za `useEffect` mimo prehliadača — Astro islands sa serverovo
  renderujú a React by pri buildte 24 000 stránok zaplavil log varovaním.

Pokryté: pyramída súťaží, obe heatmapy úrovní, vek klubu, vekový trend zväzov, starnúce kluby,
tabuľka aj karta Indexu klubu, obe mapy, veková pyramída a drill-down kategórií (posledné dva
nemali popisok žiadny), a prepínače metriky Skupiny/Súťaže — tie nesú vysvetlenie pojmov, takže
natívny popisok pri nich škodil najviac.

### Počet klubov (dimenzia, rozhodnutia Ján Letko 14. 8. 2026)

ETL: `etl/kluby.py` a `etl/kluby_zvazy.py`, artefakt `data/kluby/<sezona>.json` (bloky
`celkovo`, `zvazy`, `podlaDomovskehoZvazu`, `vylucene`). Zobrazenie: karta na úvodnej stránke
a na profile zväzu, metrika a deviata os radaru v Porovnaniach, metrika v sunburste.

#### Kto je aktívny klub

**Aktívny klub = klub s aspoň jedným reálne odohraným zápasom v sezóne.** Nie klub v registri
a nie klub s prihláseným družstvom — klub, ktorý naozaj hral. „Reálne odohraný“ je tá istá
definícia ako v kapitole „Odohraný zápas“: `closed: true` bez administratívnych kontumácií
a odstúpení bez zápisu.

Klub je účastník **regulárnej súťaže riadenej slovenským zväzom** — zápas, ktorého `appSpace`
nie je v `zvazy.json`, sa nezapočíta. Tým z počtu vypadnú zahraničné kluby z európskych
pohárov, reprezentácie (`appSpace = uefa`), futsalové priestory pri futbalovom reze
a testovacie profily. Práve pohároví súperi Slovana boli dôvodom, prečo hrubé číslo bez filtra
tvrdilo medziročný pokles −33 namiesto skutočných −11.

#### Klub sa počíta v každom zväze, kde hral

**Rozhodnutie:** klub je aktívny v každom zväze, v ktorého súťaži odohral aspoň jeden zápas.
Bežný prípad — ačko v 5. lige ZsFZ a prípravka v ObFZ Nitra — je klubom oboch zväzov a v oboch
sa počíta.

**Dôsledok, ktorý treba uvádzať pri každom zobrazení:** súčet klubov po zväzoch je vyšší než
celoslovenský počet. Celoslovenské číslo je počet **unikátnych** klubov, nie súčet, preto ho
`etl/sumar.py` berie priamo z artefaktu a **nikdy nesčítava** po zväzoch.

Doplnkovo sa publikuje blok `podlaDomovskehoZvazu` — klub je v ňom započítaný raz, v zväze,
v ktorého súťažiach odohral najviac zápasov. Toto číslo **sčítateľné je** a používa sa všade,
kde vizualizácia sčítava vetvy: v **sunburste** (SR → RFZ → ObFZ) sa metrika Kluby počíta nad
domovským zväzom, inak by rodičovský prstenec ukazoval viac než celoslovenské číslo.
Vysvetlivka je priamo pri grafe aj v karte.

Filter pohlavia je pri metrike Kluby **zašednutý** — počet klubov sa podľa pohlavia nerozpadá,
klub s mužským aj ženským družstvom je jeden klub.

Do **pyramídy a heatmáp úrovní sa metrika Kluby zámerne nedáva.** Klub hrá naraz v štyroch až
piatich úrovniach, stupne by sa nedali sčítať a tvar pyramídy by klamal.

#### Mládež

Mládež = **akákoľvek veková úroveň okrem dospelých**. Klub je práve v jednom z troch stavov:
`lenDospeli`, `dospeliAMladez`, `lenMladez`; `sMladezou` je súčet posledných dvoch.

**Sezóny pred 2024/2025 stoja na fallbacku** `competitions.parts[].rules.category`, lebo
`teams.ageCategory` je vyplnené až od 2024/2025. Rozpad na mládež je tam menej presný — trend
je spoľahlivý v smere a ráde, nie na jednotky klubov. Pri desaťročných porovnaniach to treba
uviesť.

**Sezóny nábehu ISSF** (rozhodnutie Ján Letko, 14. 8. 2026): **2012/2013 a 2013/2014** sú roky,
v ktorých sa Informačný systém slovenského futbalu ešte len nasadzoval — evidencia nie je úplná
(2012/2013 má v dátach zlomok klubov). V karte „Počet klubov“ sú preto **šrafované** rovnako ako
prebiehajúca sezóna a nesmú sa čítať ako stav. Číselník je v `KlubyKarta.tsx` (`NABEH_ISSF`).

**Prebiehajúca sezóna** má nízky počet klubov s mládežou (2026/2027: 908 klubov, z toho 562
„bez mládeže“), lebo mládežnícke súťaže sa začínajú neskôr. V grafe je šrafovaná a nesmie sa
čítať ako prepad.

#### Filter neregulárnych súťaží

**Štrukturálny príznak „regulárna súťaž / turnaj“ v `competitions` neexistuje.** RT U14,
Vysokoškolská liga aj turnaj ZŠ mesta Košice sa od ligovej súťaže ničím nelíšia a `level = null`
sa použiť nedá (nemá ho ani VII. liga SOFZ). Preto ručný číselník
`etl/config/vylucene_sutaze.json` s kľúčom `competitionGroupId` (12 položiek): turnaj ZŠ mesta
Košice, reprezentačné turnaje RT U14/U15/U17/U19/WU14, Memoriál Gejzu Princa, Regions' Cup
a testovacie záznamy. **Číselník treba udržiavať** — nová neregulárna súťaž doň musí pribudnúť
ručne. Požiadavka na príznak zo strany ISSF/Sportnetu je v `docs/TODO.md`.

**Vysokoškolská liga je regulárna súťaž** (rozhodnutie Ján Letko) — fakulty sa počítajú ako
kluby. Školské a výberové (reprezentačné) turnaje nie.

**Pasca, ktorá stála prvý beh:** `competition.competitionGroupId` je v kolekcii `matches`
**ObjectId, nie string** — porovnávať treba cez `str()`, inak filter ticho nevylúči nič.

Filter platí pre **celý portál** vrátane Indexu klubu a rebríčkov. `etl/index_klubu.py` má
poistku proti vylúčeným subjektom; **`etl/trendy.py` a `etl/demografia_klub.py` filter zatiaľ
nemajú** a pri najbližšom behu znova vyrobia artefakty aj pre vylúčené subjekty (zapísané
v `docs/TODO.md`).

Očistením vypadlo z `data/` **297 publikovaných profilov** subjektov, ktoré klubmi nie sú
(zahraničné kluby, reprezentácie, 40 košických škôl, testovacie profily). Sú archivované
lokálne v `data/_archiv-klubov/`, ktorý je v `.gitignore` — nič sa nemazalo.

#### Výsledky a krížová kontrola (14. 8. 2026, futbal)

| Sezóna | Kluby | S mládežou | Bez mládeže | Len mládež |
|---|---|---|---|---|
| 2015/2016 | 1 715 | 1 254 | 461 | 65 |
| 2020/2021 | 1 549 | 1 232 | 317 | 105 |
| 2024/2025 | 1 417 | 1 177 | 240 | 143 |
| **2025/2026** | **1 406** | **1 167** | **239** | **143** |

Klubov ubúda, ale **klubov bez mládeže ubudlo takmer o polovicu** (461 → 239, podiel
27 % → 17 %) a klubov **len s mládežou je dvojnásobok** (65 → 143).

#### Vzťah k Indexu klubu

Index klubu má **vlastnú definíciu započítaného družstva** (družstvo sa počíta, len ak odohralo
viac než polovicu mediánu zápasov v tej istej časti súťaže) a beží nad mierne odlišným súborom
klubov (1 410 oproti 1 406). Čísla preto **nie sú tá istá metrika**, hoci v sezóne 2025/2026
sedia:

| | Počet klubov | Index klubu |
|---|---|---|
| Bez mládeže | 239 (`lenDospeli`) | 239 (`stav = bez-mladeze`, index 0) |
| Bez dospelých | 143 (`lenMladez`) | 156 (`stav = bez-dospelych`) |

Rozdiel pri kluboch bez dospelých (156 oproti 143) je dôsledkom prahu zápasov: klub, ktorého
dospelé družstvo odohralo len pár zápasov, je pre index „bez dospelých“, pre Počet klubov už
nie. **V dokumentácii treba obe metriky pomenovať**, inak to vyzerá ako nesúlad. Údaj „260
klubov bez mládeže“ z pôvodnej metodiky Indexu klubu bol meraný **pred zavedením filtra**
neregulárnych súťaží a už neplatí.


#### ZANIKANIE KLUBOV — záväzná definícia (rozhodnutie Ján Letko, 15. 8. 2026)

> **Za zaniknutý klub sa považuje klub, ktorý dva roky po sebe neprihlási do súťaže žiadne
> družstvo.**

Táto veta je záväzná a platí všade — v ETL, na portáli, v dokumentácii aj v komunikácii.
Vyplýva z nej päť pravidiel, ktoré sa nesmú stratiť:

1. **Koniec klubu v súťažiach dospelých NIE JE zánik**, pokiaľ klub má mládež. Práve prípady
   „áčko skončilo, deti hrajú“ sa vo verejnej debate počítajú ako zaniknuté kluby; v dátach ich
   je **214**.
2. **POSTUP DO VYŠŠEJ ANI ZOSTUP DO NIŽŠEJ SÚŤAŽE NIE JE ZÁNIK.** Aktivita sa posudzuje **na
   celom Slovensku, nie vo zväze**. Namerané: domovský zväz sa mení pri **8,8 % dvojíc po sebe
   idúcich sezón** (1 464 zo 16 687), týka sa to **617 klubov**, a **658-krát** klub definitívne
   opustil súťaže svojho zväzu a hral ďalej inde. Po zväzoch by to bolo 658 falošných zánikov.
3. **Jednosezónna pauza nie je zánik.** Po jednej vynechanej sezóne sa ešte vráti **19,7 %**
   klubov, po dvoch **9,4 %**, po troch 6,6 %.
4. **POHÁRE SA NERÁTAJÚ VÔBEC.** Do Slovnaft Cupu sa dostane len klub aktívny v súťažiach, takže
   pohárový zápas nie je dôkazom aktivity — a vie poriadne pomýliť: sezóna odohraná len v pohári
   by klub držala „nažive“ a zároveň by mu ako domovský zväz vyšiel SFZ, hoci patrí do svojho
   ObFZ. Vyradených **323** takých sezón.
5. **Nový subjekt v ISSF nie je nový klub** — pozri „Pravidlo o poslednej lige“ nižšie.

**Proxy v dátach.** Prihlásené družstvo v dátach nemáme, meria sa **reálne odohraný zápas**
(`kpi.zapasy > 0`). Samotná existencia profilu nestačí: FK Senica mal v 2022/2023 **nula
odohraných a 61 uzatvorených** zápasov — v priebehu sezóny sa odhlásil a všetko sú
administratívne kontumácie.

**Okno.** Bez sezón nábehu ISSF (2012/2013, 2013/2014), bez prebiehajúcej sezóny a bez posledných
dvoch sezón — za nimi ešte nie sú dva roky. Hodnotiteľné obdobie je **2014/2015 – 2023/2024**.

Výpočet robí **`etl/zanikanie.py`** (offline nad `data/klub/`, výstup `data/zanikanie.json`),
kontrolu **`etl/kontrola_zanikania.py`**.

##### Pravidlo o poslednej lige (Ján Letko, 15. 8. 2026)

> **Ak sa zaniknutý klub znova prihlási do súťaže, musí začínať od poslednej ligy vo svojom
> ObFZ.**

Toto pravidlo zo súťažného poriadku je jediný spoľahlivý spôsob, ako odlíšiť **nový klub** od
**novej registrácie toho istého klubu** — ISSF pri preregistrácii založí nové organization ID
a väzbu na predchodcu nenesie. Test je preto absolútny, nie porovnávací: **subjekt, ktorý sa
objaví kdekoľvek vyššie než na dne pyramídy svojho zväzu, nemôže byť nový** — je to pokračovanie
klubu, ktorý v tej istej obci práve „zanikol“.

Automatika takto spojila **23 dvojíc** (Futbalový klub Humenné → … s. r. o., KFC Komárno → KFC
Komárno futbal, TJ Fatran Varín → FK Fatran Varín, MFK Dubnica → FK Dubnica, FK Púchov → MŠK
Púchov, OFK Malženice → OFK Dynamo Malženice a ďalšie). Párovanie je zámerne prísne: rovnaká obec
(zhodná množina slov po odstránení právnej formy a značky klubu) a slovo, ktoré obec skutočne
identifikuje — teda nie „bratislava“ či „kosice“, ktoré sú v desiatkach klubov.

Dva druhy prípadov automatika chytiť nemôže a rieši ich ručný číselník
[`etl/config/nastupcovia.json`](../etl/config/nastupcovia.json):

- **názov v ISSF neobsahuje obec** — FK Dukla Banská Bystrica je v dátach vedená ako „STANZA“;
- **veľkomesto** — FK Inter Bratislava.

##### Medzi zánikmi sú aj zlúčenia

**Zánik subjektu nie je vždy koniec futbalu v obci.** Časť zánikov sú zlúčenia: klub sa spojil
s iným a jeho identita, hráči aj mládež pokračujú tam. Dukla Banská Bystrica je presne taký
prípad — v roku 2017 subjekt skončil, ale klub žil ďalej v druhom subjekte. Doložené zlúčenia sú
v číselníku nástupcov a **nepočítajú sa ako zánik**; tie, ktoré doložiť nevieme, medzi zánikmi
zostávajú a od „skutočného“ konca sa v dátach odlíšiť nedajú. Najčastejšie sú pri **ženských
kluboch** — ženské družstvo prejde pod iný klub v meste.

##### Typy klubov — vykazujú sa oddelene

| Typ | Zaniknutých | Ako sa určuje |
|---|---|---|
| klasický klub | 554 (97,9 %) | zvyšok |
| **ženský klub** | 9 (1,6 %) | ≥ 80 % hráčok v poslednej odohranej sezóne (z demografie klubu) |
| **akadémia** | 3 (0,5 %) | názov obsahuje „akadémia“, „academy“ alebo „škola futbalu“ |

Rozlíšenie je nutné na pochopenie rezu po zväzoch: **ženské ligy aj celoštátne mládežnícke súťaže
riadi SFZ**, takže ženský klub a akadémia vychádzajú na úroveň SFZ celkom správne. Bez toho to
vyzerá ako chyba. Z deviatich zaniknutých ženských klubov sa v ôsmich prípadoch ženský futbal
v obci už neobnovil — nie sú to teda väčšinou zlúčenia, ale skutočné konce.

##### Logická kontrola podľa úrovne (Ján Letko, 15. 8. 2026)

Kluby zanikajú a vznikajú **takmer výlučne na úrovni ObFZ** — vyplýva to z pravidla o poslednej
lige. Zánik na úrovni SFZ má byť rarita, na RFZ výnimka. `etl/zanikanie.py` to preto po každom
behu vypisuje a varuje:

| Úroveň | Zaniknutých | Podiel |
|---|---|---|
| ObFZ | 511 | 90,3 % |
| RFZ | 46 | 8,1 % |
| SFZ | 9 | 1,6 % |

Z tých deviatich na úrovni SFZ je **sedem ženských klubov, jedna akadémia a jediný klasický klub
— FC VSS Košice** (krach 2017, návrat 2021/2022 odspodu). Kontrola preto sleduje len klasické
kluby a prahom sú tri.

##### Namerané (15. 8. 2026)

**Zaniknutých spolu: 566.** Z nich sa **56 po dvoch tichých sezónach ešte vrátilo** — podľa
definície zostávajú zaniknuté a ich návrat sa nepočíta ako nový klub.

| Stav klubu v poslednej odohranej sezóne | Klubo-sezón | Zaniknutých | Miera za sezónu |
|---|---|---|---|
| **bez mládeže** | 3 508 | 302 | **8,6 %** |
| **s mládežou** | 12 324 | 264 | **2,1 %** |

Klub bez mládeže zaniká **takmer štyrikrát častejšie**. Priemer za celé Slovensko je 3,6 %.

**Prechody stavov (klub prežil, len sa zmenil):**

| Prechod | Počet |
|---|---|
| len dospelí → dospelí + mládež (klub pridal mládež) | **549** |
| dospelí + mládež → len dospelí (klub stratil mládež) | 471 |
| dospelí + mládež → len mládež (**skončil v dospelých, mládež si udržal**) | **214** |
| len mládež → dospelí + mládež | 137 |
| len dospelí → len mládež | 14 |
| len mládež → len dospelí | 6 |

#### Rez po zväzoch a po obdobiach (zadanie Ján Letko, 15. 8. 2026)

*„V ktorých zväzoch najviac ubudlo klubov a v ktorom období?“* → blok `zvazy` a `poObdobiach`
v `data/zanikanie.json`, zobrazené v sekcii **Zanikanie klubov** na `/trendy`.

**Vyhodnocuje sa v rámci celého Slovenska.** Hlavná metrika je **podiel zväzu na všetkých
zaniknutých kluboch v SR**. Vedľa nej stojí **miera vo zväze** (podiel z klubo-sezón), lebo veľký
zväz má prirodzene väčší podiel a malý zväz zase rozkolísanú mieru. Zánik sa pripisuje
**domovskému zväzu** klubu v jeho poslednej odohranej sezóne — klub zaniká raz, tak sa musí
započítať raz.

**Čo sa do rebríčka zámerne NEDÁVA:** počet klubov hrajúcich v súťažiach zväzu a jeho zmena
v čase. Tento rad je ovplyvnený postupmi a zostupmi — klub, ktorý postúpi, z neho vypadne, hoci
hrá ďalej — a v tabuľke o zanikaní vedie k presne opačnému čítaniu, než aké je správne. Rad sa
publikuje ako `klubovVSutaziachZvazu`, ale v rebríčku sa nepoužíva.

| Zväz | Zaniknutých | Podiel na SR | Miera vo zväze |
|---|---|---|---|
| ObFZ Trebišov | 30 | **5,3 %** | **12,0 %** |
| ObFZ Michalovce | 29 | 5,1 % | 6,4 % |
| ObFZ Prievidza | 28 | 5,0 % | 3,9 % |
| ObFZ Nitra | 26 | 4,6 % | 3,6 % |
| ObFZ Trnava | 24 | 4,2 % | 3,5 % |
| ObFZ Humenné | 21 | 3,7 % | 5,7 % |
| ObFZ Rožňava | 19 | 3,4 % | **9,2 %** |
| ObFZ Senica | 4 | 0,7 % | **1,0 %** (najnižšia) |

Podiel a miera hovoria každý niečo iné: ObFZ Prievidza má vysoký podiel, lebo je veľký, ale
podpriemernú mieru; ObFZ Rožňava presne naopak.

**Kedy — a toto je hlavné zistenie:**

| Obdobie | Zaniknutých za sezónu | Nových klubov za sezónu |
|---|---|---|
| do 2018/2019 | 60,2 | **26,7** |
| 2019/2020 – 2021/2022 (covid) | 57,7 | **13,7** |
| od 2022/2023 | 46,0 | **12,0** |

**Kluby nezanikajú rýchlejšie — prestali vznikať.** Tempo zanikania dokonca klesá; čo sa zlomilo
okolo covidu, je prítok nových klubov, a ten sa nevrátil.

**Príchody sa počítajú až od tretej sezóny okna.** V prvej sezóne nový klub vzniknúť nemôže
a v druhej vyjde nafúknuto — objavia sa v nej všetky kluby, ktoré si prvú sezónu vynechali.

Analýza v plnom znení: `claude/definicia-zanik-klubu.md` a `claude/pyramida-vs-zanik-kontrola.md`.
**Príčiny** úbytku v dátach **nie sú** — portál meria stavy a pohyby, nie dôvody.

#### PREBIEHAJÚCA SEZÓNA — vykazuje sa len ako rozbeh (rozhodnutie Ján Letko, 19. 8. 2026)

> **Prebiehajúca sezóna sa NIKDY nevykazuje ako počet odstúpených ani zaniknutých klubov.**
> Uvádza sa iba stav rozbehu: koľko z minuloročného objemu už reálne hrá.

Dôvod je meraný, nie odhadovaný: **súťaže sa rozbiehajú v poradí dospelí → dorast → žiaci →
prípravky.** Klub, ktorý ešte nemá odohraný zápas, preto najčastejšie len čaká na štart svojej
súťaže. Keby sa počet klubov bez zápasu vykázal ako počet odstúpených klubov, vznikol by presne
ten falošný obraz hromadného odhlasovania, ktorý dáta vyvracajú.

Stav sezóny 2026/2027 k dátumu prepočtu (predchádzajúca sezóna 2025/2026 = 100 %):

| Ukazovateľ | 2026/2027 | 2025/2026 (celá) | Rozbeh |
|---|---|---|---|
| Súťaže s uzavretým zápasom | 145 | 397 | 36,5 % |
| Odohrané zápasy | 1 757 | 61 007 | 2,9 % |
| Družstvá | 2 326 | 5 686 | 40,9 % |
| Kluby s aspoň jedným zápasom | 1 024 | 1 401 | 73,1 % |

Rozbeh po vekových kategóriách — tu je vidieť, prečo sa prebiehajúca sezóna nedá hodnotiť:

| Kategória | 2026/2027 | 2025/2026 (celá) | Rozbeh |
|---|---|---|---|
| Dospelí | 1 007 | 1 320 | 76,3 % |
| Dorast | 487 | 803 | 60,6 % |
| Žiaci | 416 | 1 611 | 25,8 % |
| Prípravka | 32 | 1 712 | 1,9 % |

**382 klubov ešte nemá v sezóne 2026/2027 odohraný zápas. Toto číslo NIE JE počet odstúpených
klubov a nesmie sa tak použiť** — prípraviek hrá zatiaľ 1,9 % a žiakov 25,8 %, takže väčšina
tých klubov len čaká na štart svojej súťaže.

Číslo počíta `etl/odstupene_kluby.py` (funkcia `rozbeh_sezony`) do bloku `rozbeh`
v `data/odstupene-kluby.json`. Zdroj počtov súťaží a zápasov je `data/sumar/<sezóna>.json`.


### Vek hráčov a Index klubu — stránka Trendy (7. 8. 2026)

Metodika v plných podrobnostiach: `claude/plan-trendy-vek.md` a `claude/metodika-index-klubu.md`
v projekte. ETL: `etl/trendy.py` a `etl/index_klubu.py`.

#### ZÁKLADNÝ KĽÚČ: dve rôzne „vekové úrovne“ (rozhodnutie Ján Letko, 7. 8. 2026)

Portál pracuje s **dvoma odlišnými pojmami**, ktoré sa nesmú zamieňať:

1. **Veková úroveň OSOBY** — **odvodená** z ročníka narodenia:
   `vek = koncový rok sezóny − rok narodenia`. Ročník 2011 v sezóne 2025/2026 → 2026 − 2011 = 15 → **U15**.
   Hranica: 19 → U19, **20 a viac → ADULTS**. Je to celé číslo, **rovnaké pre celú sezónu** — dvaja
   hráči toho istého ročníka majú vždy rovnakú hodnotu bez ohľadu na mesiac narodenia.
2. **Veková úroveň SÚŤAŽE alebo DRUŽSTVA** — **exaktne zadaná** v databáze
   (`competitions.parts[].rules.category`, `teams[].ageCategory`). Týmto sa riadi drvivá väčšina portálu.

Sedemnásťročný hráč (veková úroveň osoby U17) môže nastupovať v súťaži dospelých (veková úroveň
súťaže ADULTS). Rez „súťaže dospelých“ sa preto berie podľa **vekovej úrovne súťaže**, kým vek hráča
podľa **vekovej úrovne osoby**.

> Do 7. 8. 2026 počítal `web/src/lib/format.ts` → `ageLevel` vekovú úroveň osoby o jednu vyššie
> (`age + 1`) a hranicou `>= 19` znemožňoval vznik U19. Opravené v commite `245642eab`.

#### Čo sa meria a čo sa zmerať nedá

- **Jednotka je jeden ZÁPIS hráča v jednom zápase** — hráč s 25 zápismi váži 25×
  (rozhodnutie Ján Letko). Odpovedá to na otázku „aký starý je futbal, ktorý sa reálne hrá“.
- Sú to **hráči uvedení v zápise o stretnutí**, nie tí, ktorí nastúpili na ihrisko.
  **Kto nastúpil sa zistiť NEDÁ**: `protocol.events` obsahuje len góly a súvisiace typy,
  **striedania sa neevidujú vôbec** (overené v ObFZ Nitra aj v súťažiach SFZ), a príznak
  `additionalData.substitute` je vyplnený len u 6,7 % hráčov. Odohrané minúty teda neexistujú.
- **`additionalData.age` sa NEPOUŽÍVA.** V dátach existuje a je vyplnený na 100 %, ale je to
  presný vek v deň zápasu — tomu istému hráčovi sa počas sezóny zmení (overené: 9 → 10).
  Zdrojom je `sportnet.users.birthdate` → ročník → veková úroveň osoby. Pokrytie ročníka je
  **100 %** (36 068 z 36 068 hráčov v súťažiach dospelých 2025/2026).
- **6–7 % uzavretých zápasov dospelých nemá vyplnenú nomináciu** a do štatistiky nevstupuje.
- **História siaha po sezónu 2013/2014**, nie 2012/2013.
- **Prah zobrazenia: 100 zápisov za sezónu.** Jedno družstvo dospelých odohrá ~28 zápasov a v každom
  je ~15 hráčov v zápise, teda **~415 zápisov za sezónu**. Rozdelenie je bimodálne (klub buď odohrá
  takmer celú sezónu, alebo takmer nič), takže prah nie je citlivý — v ObFZ Nitra vyradí 5 klubov z 51.
- Publikujú sa: **medián** (hlavné číslo), priemer, 25. a 75. percentil, podiel do 21 rokov a 35 a viac.

#### Rebríček „starnúce kluby“

Ohrozený je klub, ktorému vek **RASTIE** — starne a nedopĺňa mladých. Radí sa podľa **sklonu
mediánu za tri sezóny**, nie podľa medziročnej zmeny: jednorazový výkyv nesmie rozhodovať.
Vedľa zmeny veku sa **vždy zobrazuje zmena počtu hráčov** — bez nej sa nedá odlíšiť zdravé
omladenie od rozpadu kádra. Meranie 7. 8. 2026: SK Velčice −3,4 roka pri poklese zápisov
399 → 195, Slovan Hostie −3,2 roka pri raste 434 → 533 — dva opačné príbehy s takmer rovnakým
číslom veku.

#### Index klubu

Číslo 0–100 za sezónu, ktoré meria **mládežnícku základňu klubu a jej udržateľnosť**. Zložky:
šírka mládeže 30 b., deti v mládeži 25 b., počet družstiev mládeže 15 b., kontinuita 15 b.,
prechod do dospelých 15 b. Prahy sú kalibrované na rozdelení 1 450 klubov (medián klubu má
2 z 3 skupín mládeže, 36 detí, 2 družstvá).

- **Tréneri do indexu NEVSTUPUJÚ.** Medián počtu mládežníckych trénerov na klub je 1 a dolný
  kvartil 0 — vyše štvrtiny klubov nemá evidovaného ani jedného. Nie je to skutočnosť, ale dôsledok
  nevyplňovania realizačného tímu v zápise; index by trestal administratívnu nedôslednosť.
- **Družstvo sa započíta, len ak odohralo viac než polovicu mediánu zápasov v tej istej časti
  súťaže** (rozhodnutie Ján Letko). Empirický medián je použitý zámerne namiesto teoretického
  počtu kol — pri prípravkách sa hrá turnajovo. Overené: z 285 družstiev ObFZ Nitra vyradí jediné.
- **Družstvo je unikátna dvojica (veková úroveň, `teams.category`)**, nie záznam v časti súťaže —
  to isté ačko hrajúce ligu aj pohár je jedno družstvo.
- Klub **bez družstva dospelých** (156 klubov) sa hodnotí zo štyroch zložiek prepočítaných na 100.
  Klub **bez mládeže** (239 klubov, 17,0 % — prepočítané 14. 8. 2026 po zavedení filtra neregulárnych súťaží; pôvodné meranie hovorilo 260) má index 0 a zobrazuje sa slovne ako „bez mládeže“.
- **Kapitola „Čo index nemeria“ je povinnou súčasťou každého zobrazenia**, nie odkazom v pätičke:
  index nehovorí nič o kvalite trénerskej práce, zázemí, prístupe k deťom ani o športovej
  úspešnosti a systematicky zvýhodňuje veľké kluby.

Rozdelenie indexu (2025/2026, 1 431 klubov): min 0, P25 40, medián 66, P75 86, P90 94, max 100.

#### Vývoj indexu po zväzoch (8. 8. 2026)

Na stránke Trendy je nad tabuľkou indexu čiarový graf **„Ako rastie mládežnícka základňa“** —
rovnaký pohľad ako pri veku, len na osi je index. Rozhodnutia Jána Letka (8. 8. 2026):

- **Medián**, nie priemer — typický klub zväzu; priemer je v tooltipe. Priemer by ťahali
  veľké mestské kluby so 100 bodmi.
- **Kluby bez mládeže sa započítavajú s indexom 0.** Sú súčasťou reality zväzu; ich vynechanie
  by spôsobilo, že zväz, ktorému mládež zaniká, by v grafe vyzeral, že sa zlepšuje.
- **Rez podľa najvyššej dospelej úrovne klubu** v danej sezóne (`data/vek-klub/*.json`,
  kľúč `urovne` — doplnené do `etl/trendy.py` 8. 8. 2026). Kluby **bez dospelého družstva**
  majú vlastný rez „Bez dospelých“ — je ich 156 a sú medzi nimi najsilnejšie mládežnícke
  akadémie, takže ich nemožno z rezov ticho vypustiť.
- **Prah 5 klubov** na zväz a sezónu (`PRAH_KLUBOV`) — medián z troch klubov nie je
  charakteristika zväzu.
- **Prebiehajúca sezóna sa vynecháva úplne** (na rozdiel od veku, kde sa kreslí prerušovane).
  Meranie 8. 8. 2026: v 2026/2027 malo 423 z 565 klubov (75 %) index 0, lebo mládežnícke
  družstvá ešte neboli prihlásené — graf sa na konci padal k nule.
- **Sezóny s pokrytím pod 60 % maxima sa vynechávajú.** Týka sa to 2012/2013 (578 klubov
  oproti ~1 700), kde medián vychádza 0.

**Prvých päť sezón nie je porovnateľných — kreslí sa prerušovane** (rozhodnutie Ján Letko,
8. 8. 2026). Zložka D dáva plných 15 bodov až za **päť sezón mládeže po sebe**, ale história
začína 2013/2014, takže plný počet nemohol mať nikto pred 2018/2019. Namerané mediány
zložky D: 2013/14 = 3, 2014/15 = 3, 2015/16 = 6, 2016/17 = 10, 2017/18 = 10, od 2018/19 = 15.
Celoslovenský medián indexu za ten čas stúpol z 38 na 66 — **zhruba dvanásť z tých
dvadsiatich ôsmich bodov je iba dobiehajúca kontinuita, nie zlepšenie mládeže.**
Hranica sa nepočíta natvrdo: `getIndexZvazovVCase()` hľadá prvú sezónu, v ktorej medián
zložky D dosiahne svoje maximum.

**Obmedzenie, ktoré patrí k rezu:** klub medzi sezónami postupuje a padá, takže séria „6. liga“
nie je ten istý súbor klubov naprieč sezónami. Pri veku to nevadilo — tam sa merala súťaž;
tu sa meria klub a súťažou sa len označuje. Text je uvedený priamo pod grafom.

### Osoby

- **Hráči:** `nominations[].athletes[].sportnetUser._id`, väzba na tím (a kategóriu) cez `nominations[].teamId == teams[]._id`.
- **Tréneri:** `nominations[].crew[].position` ∈ {`coach`, `assist_coach`, `coach_goalkeepers`, `conditioning_coach`}. **Pozor:** `manager` je vedúci družstva, nie tréner.
- **Rozhodcovia:** `managers[].type.label` ∈ {`Rozhodca`, `1. asistent rozhodcu`, `2. asistent rozhodcu`, `Náhradný rozhodca`, `Videorozhodca`, `Asistent videorozhodcu`, `Replay Operátor`} — VAR roly sa vyskytujú len na SFZ/ULK úrovni; zaradenie medzi rozhodcov rozhodol Ján Letko, 12. 7. 2026.
- **Delegáti:** `managers[].type.label` ∈ {`Delegát stretnutia`, `Pozorovateľ rozhodcov`} — v praxi často tá istá osoba na zápase, unikáty dvojité počítanie ošetria (rozhodnutie 12. 7. 2026).
- **Personál:** `managers[].type.label` ∈ {`Hlavný usporiadateľ`, `Hlásateľ`, `Videotechnik`} — samostatná skupina osôb, JSON kľúč `personal` (rozhodnutie 12. 7. 2026).
- Texty rolí sú **identické vo všetkých 43 zväzoch** (overené na sezóne 2025/2026, 12. 7. 2026) — záväzný číselník je v `etl/config/roly.json`.
- Kategória zápasu pre rozhodcov/delegátov: `$arrayElemAt: ["$teams.ageCategory", 0]`.
- **Dvojité počítanie:** tá istá osoba pôsobí vo viacerých kategóriách/roliach; súčet po kategóriách je vyšší než počet unikátnych osôb. Publikujú sa **oba pohľady s explicitnou poznámkou** — inak to vyzerá ako chyba.
- Nižšie kategórie (prípravky, mladší žiaci) často nemajú rozhodcov/delegátov v systéme — reálny stav, nie chyba dát.

### Ostatné metriky

- Góly a karty: `protocol.events` (eventType: `goal`, `yellow_card`, `red_card`).
- Diváci: `protocol.audience` — pole nie je vyplnené pri všetkých zápasoch; publikovať vždy spolu s percentom pokrytia.
- Družstvo = unikátne `teams[].organization.name` s aspoň jedným uzavretým zápasom (nie registrácie na začiatku sezóny — uviesť v poznámke).

## Overené fakty o rozsahu dát (12. 7. 2026)

| Fakt | Hodnota |
|---|---|
| Najstaršia plnohodnotná sezóna | 2012/2013 (117 súťaží) |
| Plné pokrytie od | 2013/2014 (313 súťaží), od 2014/2015 stabilne 400–460 súťaží/sezóna |
| Kontrola hĺbky: 2016/2017 | 57 399 uzavretých zápasov, 100 % s nomináciami |

## Známe problémy kvality dát

1. **Nekonzistentné `season.name`:** varianty „2024/2025“, „2024 / 2025“, „2024/25“, „24/25“, samostatné roky („2016“…), aj testovacie hodnoty („Test“, „KLF“…). ETL musí mať normalizačnú mapu sezón; nenormalizovateľné záznamy sa logujú a vylučujú.
2. **Staršie sezóny (pred ~2016):** kvalita vyplnenia protokolov (karty, diváci) sa musí zmerať vo F1; ukazovatele s nedostatočným pokrytím sa za dané sezóny **nezobrazia, nie odhadnú**.
3. **Zmena schémy DB:** ETL beh obsahuje validácie (počty, povinné polia) a alerting pri anomáliách.

> Poznámka: rôzne hodnoty `level` pri tej istej vekovej úrovni v rôznych zväzoch **nie sú** problém kvality dát — vyjadrujú rôznu hĺbku pyramídy v danej oblasti. Viď kapitola Úroveň súťaže — pyramída líg.

## Demografia (10-ročné rady osôb)

- Zdroj: DB **`sportnet`**, kolekcia **`users`** — `_id` = sportnetId (ObjectId), polia `birthdate`, `sex` (overené 12. 7. 2026; uzatvára O7 — CRM API netreba).
- Join: `sutaze.matches.nominations[].athletes[].sportnetUser._id` (string) → `$toObjectId` → `sportnet.users._id`.
- Publikujú sa výhradne agregáty (rok narodenia × pohlavie × rola × zväz × sezóna); bez prahu minimálnej veľkosti (O5 rozhodnuté — publicistická licencia).
- **Implementácia: `etl/demografia.py`** (13. 7. 2026) → `data/demografia/{zvaz}.json` — jeden súbor na zväz, vnútri `sezony` → roly (hraci/treneri/rozhodcovia/delegati/personal) → `{osoby, sUdajmi, bezUdajov, roky: {rok: {M/F/N}}}`; N = pohlavie v users nevyplnené. Join v Pythone (ObjectId), users sa čítajú dávkami $in po 5 000. Anomália: > 20 % osôb roly bez birthdate.

## GDPR zásady

- Publikujú sa výhradne agregované počty, žiadne menné zoznamy ani identifikátory osôb.
- Prah minimálnej veľkosti agregátu sa **nepoužije** — SFZ disponuje publicistickou licenciou, agregované počty sa zobrazujú všetky (rozhodnutie Ján Letko, 12. 7. 2026; uzatvára O5).

## Automatická aktualizácia dát a spätné opravy zápasov

**Rozhodnutia Ján Letko, 17. 8. 2026.** Zadanie vzniklo z jeho otázky: *výsledky sa často
uzatvárajú aj o dva týždne neskôr, ako je dátum zápasu, a rozhodnutím komisií sa môžu
spätne opravovať aj staršie zápasy — koľko dní dozadu sa kontroluje?*

### Žiadne „okno posledných X dní" neexistuje a netreba ho

ETL **nie je inkrementálne**. Pri každej aktualizácii sa celá prepočítavaná sezóna počíta
odznova zo všetkých jej zápasov, takže neskoro uzavretý zápas ani spätná oprava komisie
v tej sezóne nemôžu uniknúť. Otázka „koľko dní dozadu" má odpoveď „po začiatok sezóny".

### Prekryv júl–september

Sezóna sa určuje z dátumu (1. 7. – 30. 6.), takže po 1. 7. by sa predchádzajúca sezóna už
nikdy neprepočítala — hoci sa do nej stále dopĺňajú dohrávky, baráže a rozhodnutia komisií.
V mesiacoch **7, 8 a 9** sa preto prepočítava aj predchádzajúca sezóna
(`PREKRYV_MESIACE` v `etl/tyzdenna.py`).

**Namerané 17. 8. 2026:** sezóna 2025/2026 (futbal, slovenské zväzy) mala 22. 7. 2026
podľa [ADR-0008](adr/0008-odohrane-zapasy-bez-administrativnych.md) **63 943** uzavretých
zápasov, 17. 8. 2026 ich má **63 945** — po skončení sezóny teda pribudli **dva zápasy**.

Prekryv preto **nestojí na veľkom nameranom rozdiele**, ale na tom, že v tomto období sa
sezóna reálne dokončuje (dohrávky, baráže, odvolania), a najmä na tom, že **počet zápasov
je slabý ukazovateľ: spätná oprava výsledku komisiou počet zápasov nemení vôbec.** Prekryv
je lacná poistka — dve sezóny namiesto jednej tri mesiace v roku.

> Pozor na porovnávanie čísel: `63 943` z ADR-0008 je futbal v slovenských zväzoch. Celkový
> počet uzavretých zápasov s názvom sezóny `2025/2026` cez všetky `appSpace` a odvetvia je
> **64 191** (futbal 63 945 + futsal 246 + zvyšok mimo slovenských zväzov). Prvá verzia tejto
> kapitoly tie dve čísla omylom porovnala a tvrdila „+248 zápasov"; opravené 17. 8. 2026.

### Odtlačky sezón — ako sa zachytí spätná oprava v starej sezóne

**`matches` nemá pole s časom poslednej zmeny.** Overené 17. 8. 2026 nad vzorkou dokumentov:
top-level kľúče sú `_id`, `competitionId`, `partId`, `sportGround`, `roundId`, `closed`,
`startDate`, `appSpace`, `competition`, `competitionPart`, `season`, `rules`, `settings`,
`round`, `createdDate`, `nominations`, `teams`, `protocol`, `timer`, `liveState`,
`resultsTable`, `score`, … `protocol.lastUpdate` je voliteľné a na vzorke chýbalo. Dotaz
„čo sa zmenilo od minulého týždňa" sa preto **spraviť nedá**.

Namiesto toho `etl/kontrola_sezon.py` spočíta pre každú sezónu **odtlačok** — počet
uzavretých zápasov, súčet skóre, súčet divákov a počet kontumácií, len za `appSpace`
slovenských zväzov — a porovná ho s odtlačkom z posledného úspešného behu. Sezóna, ktorá sa
pohla, sa prepočíta celá, aj keby išlo o zápas spred piatich rokov.

- **Prečo nie len počet zápasov:** spätná oprava výsledku komisiou počet zápasov nemení.
  Preto sú v odtlačku aj súčty skóre, divákov a kontumácií.
- **Stav zápasu je v `__issfMatchStatus`, nie v `state`.** Prvé meranie 17. 8. 2026 počítalo
  kontumácie podmienkou na `state` a vrátilo vo všetkých pätnástich sezónach nulu — to chybu
  odhalilo. Odtlačok počíta `KONTUMOVANY` aj `ODSTUPENE_DRUZSTVO`, lebo rozhodnutie komisie
  sa často prejaví práve zmenou stavu.
- **Futsal má vlastný `appSpace`** (`futsalslovakia.sk`, `zvazy.json` → `futsal.appSpace`),
  nie je v `sfz`/`rfz`/`obfz`. Prvá verzia `appspace_zvazy()` ho vynechala, takže odtlačok
  futsal ignoroval; opravené 17. 8. 2026.
- **Prečo `appSpace` v `$match` a nie až vo Pythone:** je to prvé pole indexov na `matches`.
  Bez neho išlo o plný sken celej kolekcie a beh nedobehol ani za päť minút (namerané
  17. 8. 2026). Súčty skóre a divákov si vyžadujú prečítanie dokumentov — v indexe tie polia
  nie sú (plán je `IXSCAN` + `FETCH`) —, takže úplne zadarmo to nebude nikdy.
  **Namerané trvanie celého skenu histórie: 9 min 53 s** (17. 8. 2026, 15 sezón, 627 skupín
  `appSpace` × sezóna). V rámci 1–2 hodinového behu ETL je to zanedbateľné.
- **Dvojfázovosť `--plan` / `--potvrd`:** odtlačok sa uloží ako platný až po úspešnom behu
  ETL, a to len pre sezóny, ktoré naozaj prebehli. Sezóna, ktorá spadla alebo sa preskočila,
  zostane na starom odtlačku a objaví sa v pláne aj pri najbližšom behu.
- **Obmedzenie:** zmena, ktorá odtlačok nezmení (zápas znova otvorený a uzavretý s rovnakým
  skóre aj divákmi), sa nezachytí. Pre publikované čísla je to bez dopadu.
- **Zmena metriky odtlačku znehodnotí uložené odtlačky** — po nej prebehne jednorazový
  prepočet všetkých sezón (4 h 53 min). Preto je zoznam `METRIKY` označený ako citlivý.

### Strop počtu sezón na jeden beh

`--max-sezon` (default 4) chráni pred utrhnutím behu, keby sa odtlačok zmenil vo veľa
sezónach naraz. Preskočené sezóny sa **vypisujú do logu** — nikdy sa nezahodia potichu — a
keďže im nebol potvrdený odtlačok, prepočítajú sa pri najbližšom behu.

### Kde beh prebieha

Plánovaný beh je na **Synology NAS** (Docker + Task Scheduler, `deploy/synology/`,
[návod](synology-tyzdenna.md)), **v stredu o 03:00**. Streda preto, že väčšina zápisov
z víkendových zápasov sa uzatvára až v pondelok a v utorok.

Cron v `.github/workflows/tyzdenna.yml` je **zámerne vypnutý** — GitHub-hostované runnery
majú dynamické IP, takže by si vyžadovali `0.0.0.0/0` v Atlas allowliste; secret
`MONGODB_URI` preto nikdy nebol nastavený a naplánovaný beh padal každý pondelok od
27. 7. 2026 (štyri behy, všetky `failure` na „Chýba MONGODB_URI"). Workflow zostáva ako
záložné ručné spustenie.

### Autor commitu z automatu

Commit z NAS musí mať autora **`jan.letko@icloud.com`**. Commity z domény `@futbalsfz.sk`
Vercel blokuje — push by prešiel, build by sa nespustil a skript by skončil „úspešne".
Pôvodná verzia `entrypoint.sh` commitovala ako `etl-bot@futbalsfz.sk`; opravené 17. 8. 2026.

### Čiastočný beh

Ak niektorý ETL krok zlyhá, zmeny sa aj tak publikujú (čerstvé dáta z 42 zväzov sú lepšie
než zamrznutý portál), ale správa commitu je označená ako **ČIASTOČNÁ** a `entrypoint.sh`
skončí nenulovým kódom → Task Scheduler pošle e-mail na `jan.letko@futbalsfz.sk`.

### Ručný prepočet jednej sezóny

```
python etl/tyzdenna.py --sezona 2024/2025                  # lokálne
docker compose run --rm -e SEZONA=2024/2025 etl            # na NAS
```
