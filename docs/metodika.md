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

Pyramída sa ukazuje v štyroch pohľadoch; každý odpovedá na inú otázku a všetky čítajú ten istý blok `sutazeUroven`.

- **Pyramída súťaží** (`PyramidaSutazi.tsx`, profil zväzu + Prehľad) — statický rez jednou sezónou: štyri samostatné siluety vedľa seba, jedna na vekovú kategóriu, s možnosťou rozbaliť konkrétnu vekovú úroveň. Odpovedá „ako vyzerá pyramída tohto zväzu dnes“.
- **Heatmapa zväzy × úrovne** (`HeatmapaUrovni.tsx`, Porovnania) — matica, riadok je zväz, stĺpec úroveň, hodnota počet súťaží. Odpovedá „kto čo riadi“ a robí okamžite viditeľným, že oblastné zväzy sedia na 7.–9. lige a regionálne na 4.–6. Prázdna bunka znamená, že zväz na danej úrovni v tomto reze súťaž nemá. Poháre, turnaje a súťaže bez úrovne majú vlastný stĺpec — do ligovej pyramídy nepatria.
- **Vývoj počtu súťaží danej úrovne** (`UrovenTrend.tsx`, Porovnania) — jedna séria na zväz naprieč sezónami pre zvolenú úroveň. Predvolí sa **úroveň s najväčším počtom súťaží v poslednej kompletnej sezóne v práve zvolenom reze** (nie prvá v poradí — pri ObFZ by to bola „1. liga“, ktorú oblastné zväzy takmer neriadia). Nad štyri vybrané zväzy sa graf prepína na mriežku mini-grafov, lebo hodnoty bývajú 1–3 a čiary by splývali.
- **Ako sa menila pyramída súťaží** (`PyramidaVCase.tsx`, profil zväzu) — skladaný plošný graf jedného zväzu v čase; výška plochy je počet súťaží, farby sú úrovne od najvyššej (tmavá) po najnižšiu. Odpovedá „kedy zväzu liga pribudla alebo zanikla“.
- **Prebiehajúca sezóna** sa vo všetkých časových pohľadoch odlišuje (prerušovaná čiara, šrafovaná plocha) — čísla sa v nej ešte len dopĺňajú, prepad k nule nie je trend. Referenciou je posledná kompletná sezóna z `poslednaKompletnaSlug()`.
- **Prenos dát do prehliadača:** rez pripravuje `web/src/lib/urovne.ts` (`getUrovneVCase`, `getUrovneVCaseZvazu`) a riadky serializuje ako jeden reťazec (`zvazIdx,sezonaIdx,urovenIdx,katIdx,pohlavieIdx,pocet` oddelené `;`), pretože pole polí by Astro do stránky zapísalo s obalom `[0, x]` okolo každého čísla — pri 38 ObFZ × 15 sezónach ~150 kB navyše. Rozbaľuje `rozbal()`. Heatmapa aj trend bežia v jednom ostrove (`UrovneSekcia.tsx`), aby sa dáta do stránky serializovali len raz.

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
