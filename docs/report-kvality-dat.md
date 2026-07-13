# Report kvality dát — fáza F1 (dátový audit)

**Dátum merania:** 12. 7. 2026 · **Zdroj:** Sportnet MongoDB `sutaze` (kolekcie `matches`, `competitions`) · **Autor:** Ján Letko + Claude

## 1. Register zväzov (F1a)

Discovery cez `competitions` (sezóny 2024/2025 + 2025/2026) našla **51 appSpace hodnôt**, z toho:

- **43 zväzov futbalovej pyramídy**: `futbalsfz.sk` (SFZ) + 4 RFZ (`BFZ`, `ZsFZ`, `SsFZ`, `VsFZ`) + presne **38 ObFZ** — kompletný register s priradením k RFZ a k polygónom mapy je v [`etl/config/zvazy.json`](../etl/config/zvazy.json).
- **`ulk.futbalnet.sk`** (Únia ligových klubov — Niké liga, najvyššia súťaž mužov): **zaradené pod SFZ pohľad** (rozhodnutie 12. 7. 2026).
- **`futsalslovakia.sk`** (futsal): patrí priamo pod SFZ ako samostatné športové odvetvie (rozhodnutie 12. 7. 2026, uzatvára otázku O6) — viď `etl/config/sporty.json`.
- **Projekty** (`disney`, `kruzkymcd`, `dajmespolugol`): SFZ grassroots projekty, časom samostatná časť štatistík „Projekty“ (rozhodnutie 12. 7. 2026).
- **Mimo registra:** testovacie a klubové priestory (vylúčené).

Formáty appSpace sú **úplne nekonzistentné** (`ObFZ-Trnava`, `obfz-prievidza`, `obfz-nitra.futbalnet.sk`, `TFZ`, `BA-mesto`, `MFZ-Kosice`…) — potvrdzuje sa zásada *nikdy nehádať, len register*.

Všetkých 38 ObFZ sa podarilo 1:1 napárovať na polygóny KMZ mapy (vrstva OBFZ).

## 2. Normalizácia sezón (F1b)

Distinct `season.name` obsahuje **84 hodnôt**: kanonické sezóny 2012/2013 – 2026/2027, varianty zápisu („2024 / 2025“, „2024/25“, „24/25“…), samostatné roky (1939 – 2027) a testovacie/nezmyselné hodnoty. Normalizačná mapa je v [`etl/config/sezony.json`](../etl/config/sezony.json); nenamapovateľné hodnoty ETL vylúči a zaloguje.

Počty súťaží na kanonickú sezónu: 2012/2013 = 117, 2013/2014 = 313, od 2014/2015 stabilne **~400 – 460 súťaží/sezóna**.

## 3. Pokrytie dát po sezónach (F1c)

Meranie na uzavretých zápasoch (`closed: true`) celej DB. „S udalosťami“ = aspoň 1 udalosť v protokole (zápas 0:0 bez kariet je legitímne prázdny, reálne pokrytie protokolov je teda ešte vyššie ako uvedené %).

| Sezóna | Zápasy | Nominácie | Udalosti (goly/karty) | Diváci | Veková kategória |
|---|---:|---:|---:|---:|---:|
| 2013/2014 | 40 393 | 100,0 % | 95,7 % | 96,2 % | 100 % |
| 2014/2015 | 53 151 | 100,0 % | 95,3 % | 96,1 % | 100 % |
| 2015/2016 | 54 039 | 100,0 % | 94,2 % | 95,1 % | 100 % |
| 2016/2017 | 57 399 | 100,0 % | 94,0 % | 95,1 % | 100 % |
| 2017/2018 | 59 355 | 100,0 % | 91,7 % | 95,0 % | 100 % |
| 2018/2019 | 59 679 | 100,0 % | 91,3 % | 94,4 % | 100 % |
| 2019/2020 | 31 682 | 100,0 % | 90,9 % | 93,3 % | 100 % |
| 2020/2021 | 24 649 | 100,0 % | 89,0 % | 91,3 % | 100 % |
| 2021/2022 | 56 093 | 100,0 % | 87,1 % | 95,1 % | 100 % |
| 2022/2023 | 58 481 | 100,0 % | 86,4 % | 94,4 % | 100 % |
| 2023/2024 | 61 241 | 100,0 % | 85,8 % | 95,4 % | 100 % |
| 2024/2025 | 62 468 | 99,9 % | 84,6 % | 95,3 % | 100 % |
| 2025/2026 | 64 151 | 99,9 % | 83,3 % | 94,9 % | 100 % |

## 4. Závery

1. **10-ročná demografia je plne podložená** — nominácie sú ~100 % vo všetkých sezónach od 2013/2014, veková kategória 100 %. Portál môže bez obmedzení ukazovať trendy osôb od sezóny 2013/2014 (13 sezón, viac než požadovaných 10).
2. **Diváci:** pokrytie 91 – 96 % — publikovať vždy s % pokrytia (spodný odhad), podľa metodiky.
3. **Klesajúci podiel zápasov s udalosťami** (95,7 % → 83,3 %) pravdepodobne odráža rastúci podiel mládežníckych zápasov bez kariet a bezgólových protokolov, nie zhoršenie evidencie — overiť vo F1 detailne po kategóriách pred publikovaním kariet za mládež.
4. **COVID sezóny 2019/2020 a 2020/2021** majú výrazne menej zápasov (31,7 tis. / 24,6 tis. oproti ~60 tis.) — v trendových grafoch označiť anotáciou, inak budú pôsobiť ako chyba dát.
5. **Výkonnostná poznámka pre ETL:** agregácie cez viacero sezón naraz timeoutujú; ETL musí bežať po jednej sezóne (historické sezóny sa aj tak počítajú len raz).

## 5. Zostávajúce úlohy F1

- [x] ~~Pokrytie udalostí po vekových kategóriách~~ — zmerané 12. 7. 2026 (viď sekcia 7): záver č. 3 potvrdený, pokles celkového % spôsobujú výhradne prípravky
- [x] ~~Distinct roly `managers.type.label` po zväzoch~~ — vyriešené 12. 7. 2026: texty rolí sú **identické vo všetkých 43 zväzoch** (overené na sezóne 2025/2026); overený číselník v [`etl/config/roly.json`](../etl/config/roly.json). O8/O9 rozhodnuté 12. 7. 2026 (Ján Letko): VAR roly (Videorozhodca, Asistent videorozhodcu, Replay Operátor) patria medzi **rozhodcov**; Delegát stretnutia + Pozorovateľ rozhodcov tvoria skupinu **delegáti**; Hlavný usporiadateľ, Hlásateľ a Videotechnik tvoria skupinu **personál**
- [x] ~~Kontrola premenovaných súťaží~~ — vyriešené: súťaže sa zlučujú cez `competitionGroupId` (stabilné naprieč sezónami aj premenovaniami); úroveň = `level`, pohlavie = `parts[].rules.gender`, veková úroveň = `parts[].rules.category` (overené v dokumentácii aj na dátach, 12. 7. 2026)
- [x] ~~Overenie CRM API pre demografické atribúty~~ — vyriešené 12. 7. 2026 inou cestou (viď sekcia 7): CRM API nemá verejný agregovaný endpoint, ale demografia sa dá počítať priamo z DB `sportnet.users` (polia `birthdate`, `sex`; `_id` = sportnetId ako ObjectId — join na `nominations[].athletes[].sportnetUser._id` cez `$toObjectId`). Publikovať výhradne agregáty (GDPR prah — O5). CRM API netreba — uzatvára O7
- [x] ~~Prvá verzia ETL skriptu~~ — hotové 12. 7. 2026: `etl/run.py` + moduly `etl/pipelines/`, `etl/validate/`. Pipelines verifikované proti vzorkám ObFZ Nitra 2024/2025 aj 2025/2026 (100 % zhoda vo všetkých metrikách); všeobecnosť overená vygenerovaním ZsFZ 2025/2026 (8 kategórií vrát. U10 a dorasteneckých U17/U19, bez anomálií). Beh po jednej sezóne + 1 retry (timeouty potvrdené aj pri discovery rolí — agregácie nad viacerými zväzmi naraz treba deliť na chunky ≤ 4–5 appSpace)

## 6. Doplnené zistenia z implementácie ETL (12. 7. 2026 večer)

1. **Vekové kategórie v dátach presahujú číselník metodiky** — ZsFZ 2025/2026 má aj `U10`. ETL číselník rozšírený (U06–U19 + ADULTS); neznáme hodnoty hlási validácia ako anomáliu.
2. **`divaciPokrytych`** = počet zápasov s vyplneným `protocol.audience` (vrátane 0); `divaciPokrytie` = pokrytých / všetkých zápasov — presne zodpovedá vzorkám.
3. **Družstvo** je unikát `organization.name` v rámci vekovej kategórie; KPI `druzstva` = súčet po kategóriách (rovnaká organizácia vo viacerých kategóriách sa počíta v každej z nich).
4. **VAR roly** (`Videorozhodca`, `Asistent videorozhodcu`, `Replay Operátor`) existujú len na `futbalsfz.sk`/`ulk.futbalnet.sk` a započítavajú sa medzi **rozhodcov**; `Delegát stretnutia` + `Pozorovateľ rozhodcov` = skupina **delegáti** (v praxi často tá istá osoba — unikáty ObFZ Nitra aj ZsFZ sa po zlúčení nezmenili); `Hlavný usporiadateľ`, `Hlásateľ`, `Videotechnik` = skupina **personál** (rozhodnutie 12. 7. 2026, viď roly.json).
5. **Delegáti chýbajú v niektorých ObFZ úplne** (Topoľčany, Veľký Krtíš, OFZ Orava… 2025/2026) — reálny stav, nie chyba dát (potvrdil Ján Letko, 12. 7. 2026).
6. **Futsal SFZ 2025/2026 vygenerovaný** (`data/zvaz/sfz/2025-2026-futsal.json`): 246 zápasov, kategórie ADULTS/U20/U17/U15 — futsal má **U20** (doplnená do číselníka). 23 zápasov „Vysokoškolskej ligy vo futsale“ nemá vyplnenú `teams.ageCategory` → vo výstupe kategória `NEZNAMA` + logovaná anomália. Roly osôb identické s futbalom. Pokrytie divákov len 89 % (pod futbalovým štandardom ~95 %).

## 7. Merania 12. 7. 2026 večer — udalosti po kategóriách, historické kategórie, demografia

### 7a. Pokrytie udalostí po vekových kategóriách (2025/2026, celá DB, uzavreté zápasy)

| Kategória | Zápasy | S udalosťou | S gólom |
|---|---:|---:|---:|
| ADULTS | 17 288 | 96,3 % | 94,0 % |
| U19 | 7 845 | 91,3 % | 90,1 % |
| U17 | 2 163 | 94,4 % | 91,8 % |
| U15 | 9 196 | 94,3 % | 93,3 % |
| U13 | 8 119 | 95,3 % | 95,1 % |
| U11 | 8 950 | 67,5 % | 67,5 % |
| U09 | 6 136 | 48,6 % | 48,6 % |
| U10 | 1 418 | 16,6 % | 16,6 % |
| U08 | 984 | 18,5 % | 18,4 % |
| U07 | 301 | 28,9 % | 28,9 % |

**Záver č. 3 potvrdený:** dospelí + žiaci + dorast majú stabilne > 91 %; pokles celkového % spôsobujú prípravky (U07–U11), kde sa protokoly udalostí často nevedú a evidencia sa medzi zväzmi líši (Nitra góly eviduje, ZsFZ nie). Karty a góly za prípravky publikovať len s výhradou/nezobrazovať.

### 7b. KRITICKÉ: `teams.ageCategory` existuje len od sezóny 2024/2025

| Sezóna | Zápasy s teams.ageCategory |
|---|---:|
| 2013/2014 – 2023/2024 | ~0 % (2022/2023: 52 z 58 481; 2023/2024: 10 z 61 241) |
| 2024/2025 | 99,6 % |
| 2025/2026 | 99,6 % |

Historické sezóny majú vekovú kategóriu v **`competitions.parts[].rules.category`** (vyplnenosť 96,5 – 100 % častí súťaží; 2013/2014 a 2016/2017 = 100 %). Zápas nesie `competitionPart._id` → join na súťaž. (Tabuľka pokrytia v sekcii 3 merala kategóriu na úrovni súťaží, nie zápasov — preto ukazovala 100 %.)

**Fallback implementovaný 12. 7. 2026** (rozhodnutie Ján Letko): ETL načíta mapu partId→kategória z `competitions` a vloží ju do pipelines ako `$switch`. Overené na ObFZ Nitra 2019/2020 — 100 % z 1 284 zápasov dostalo kategóriu (ADULTS 529, U19 143, U15 75, U13 107, U11 284, U09 146). Pri teste sa našiel chybný záznam divákov (U13: 303 610 divákov / 107 zápasov, ~2 837/zápas) → do validácií pridaná kontrola extrémneho priemeru divákov (> 2 000/zápas = anomália). **Doplnené 13. 7. 2026:** vinníkom je jediný zápas OFK Sľažany – ŠK Nevidzany (IV. liga U13, 14. 10. 2019, `_id: 5f3ffdab4000de0cc7e62c45`) s `protocol.audience` = 300 000; draft nahlásenia: docs/sportnet-nahlasenie-divaci.md.

### 7c. Demografia (O7) — CRM API netreba

CRM API (`/crm/{appSpace}/users`) vyžaduje autentifikáciu a vracia osobné záznamy, žiadny agregovaný endpoint. Overené priamo v DB: kolekcia **`sportnet.users`** má `birthdate` aj `sex`, `_id` = sportnetId (ObjectId). Join z `sutaze.matches.nominations[].athletes[].sportnetUser._id` (string) cez `$toObjectId` funguje (overené na vzorke). ETL demografiu spočíta ako agregáty rok narodenia × pohlavie × rola × zväz — žiadne osobné údaje sa nepublikujú (prah agregátov = O5, DPO).

### 7d. Dimenzia pohlavie (O6) — merania 13. 7. 2026

Vyplnenosť `competitions.parts[].rules.gender` (počty častí súťaží, celá DB):

| Sezóna | M | F | prázdne/chýba |
|---|---:|---:|---:|
| 2013/2014 | 339 | 13 | 0 |
| 2016/2017 | 696 | 19 | 0 |
| 2019/2020 | 715 | 20 | 8 |
| 2024/2025 | 932 | 41 | 6 |
| 2025/2026 | 964 | 29 | 3 |

Zistenia:

1. **Prázdny gender ≠ muži** — výhradne testovacie súťaže, grassroots projekty (dajmespolugol, disney, kruzkymcd) a malý futbal (všetko mimo ETL); jediná reálna výnimka: „Futbalový turnaj základných škôl mesta Košice“ (VsFZ, kategória „U15 mix“). Preto skupina **NEURCENE** + anomália, nie tiché priradenie k mužom.
2. **Zmiešané časti** (M aj F v jednej súťaži) v riadnych súťažiach neexistujú (jediný nález: testovacia súťaž VsFZ 2019/2020).
3. **Ženské súťaže 2025/2026 po zväzoch:** futbalsfz.sk 6, SsFZ 5, BFZ 3, VsFZ 1, futsalslovakia.sk 1; **ZsFZ a všetky ObFZ 0** (reálny stav).
4. **Presná ETL pipeline overená cez MCP na SFZ 2025/2026** (part mapa 89 častí, dva appSpace): 8 027 uzavretých zápasov, 0 × NEURCENE; F = 936 zápasov (ADULTS 222, U19 351, U15 351, WU14 12), M = 7 091. Fallback kategórií doriešil aj 71 zápasov bez `teams.ageCategory`.
5. **Nová kategória `WU14`** (ženská U14, SFZ) — mimo číselníka Ux, validácia hlási anomáliu; zaradenie (samostatná položka vs. mapovanie na U14) rozhodne PO.
6. **Regresia:** nový `cat_fallback_expr` (part mapa rozšírená o gender) generuje bajtovo identický `$switch` ako pôvodná verzia; ObFZ Nitra má výhradne M časti → existujúce výstupy sa pri pregenerovaní nemenia, pribudne len blok `pohlavie` a `methodologyFlags.pohlaviePoznamka`.

## 8. Plný dátový beh — vlna 1 (2025/2026, všetkých 43 zväzov) — 13. 7. 2026

Dávkový runner `etl/beh.py` (zdieľané DB spojenie, poradie SFZ → RFZ → ObFZ po regiónoch). Beh: **43/43 zväzov OK, 0 preskočených, žiadna systémová chyba.** Výstup: `data/zvaz/{id}/2025-2026.json` (43 súborov) + `data/index.json` (43 záznamov). Súhrn behu: `/tmp/beh-vlna1-sumar.json`.

Kontrolné súčty (vlna 1, sezóna 2025/2026): SFZ 8 035 zápasov / 830 družstiev / 35 064 gólov / 18 840 hráčov; RFZ ZsFZ 6 340, SsFZ 4 486, VsFZ 4 256, BFZ 4 334 zápasov. Najmenší zväz: Ondavský OFZ (Svidník) 208 zápasov.

### 8a. Anomálie z vlny 1 (2, obe VsFZ 2025/2026) — na doriešenie hromadne

1. **`pohlavie`: 40 zápasov bez vyplneného `rules.gender` (NEURCENE).** Časti súťaží VsFZ bez vyplneného pohlavia (nadväzuje na zistenie 7d — školský turnaj Košice „U15 mix" a pod.). Zápasy sú korektne v skupine NEURCENE; KPI nedotknuté. Akcia: overiť dotknuté súťaže na sportnet.online, prípadne nahlásiť na doplnenie `rules.gender`.
2. **`osoby.hraci`: súčet po kategóriách 8 790 < unikátni 9 283 (rozdiel 493).** Opačný smer než pri dvojitom pôsobení — ~493 hráčov VsFZ nemá priradenú vekovú kategóriu (chýba `teams.ageCategory` aj part-fallback kategórie). Nadväzuje na 7b (kategória spoľahlivá až od 2024/2025). Akcia: preveriť, či ide o špecifické súťaže bez kategórie; pri vlne 2 (história) očakávať výraznejší jav.

Ostatných 41 zväzov bez anomálií (KPI = súčet kategórií, pohlavie = KPI, pokrytie divákov v norme).

## 9. Plný dátový beh — vlna 2 (história 2013/2014–2024/2025) — 13. 7. 2026

`etl/beh.py --all-sezony` (všetkých 15 kanonických sezón × 43 zväzov). Výsledok: **42/43 zväzov kompletných, 568 sezón OK, 71 prázdnych preskočených, 1019 anomálií, 0 kritických (žiadna KPI-nezhoda), žiadna systémová chyba.** Súhrn: `/tmp/beh-vlna2-sumar.json`.

### 9a. Rozdelenie anomálií (1019)

| Počet | Typ | Koreň |
|---:|---|---|
| 485 | `osoby.hraci`: súčet po kategóriách < unikátni | historické sezóny bez vekovej kategórie |
| 483 | `osoby.treneri`: súčet po kategóriách < unikátni | to isté |
| 18 | neznáma kategória `NEZNAMA` | zápasy bez kategórie ani part-fallbacku |
| 17 | nízke pokrytie divákov (< 80 %) | publikovať s upozornením |
| 15 | `pohlavie` NEURCENE | časti súťaží bez `rules.gender` |
| 1 | podozrivý priemer divákov | zápas Sľažany–Nevidzany (opravené, viď §9c) |

95 % anomálií (968) má jeden koreň: pre historické sezóny `teams[].ageCategory` a často aj part-kategória chýbajú, takže osoby sa nedajú rozdeliť po kategóriách (nadväzuje na §7b).

### 9b. Zistenie: historické pokrytie `teams[]` a kategórií (dôležité pre F2)

Pri mnohých historických sezónach je pole **`teams[]` nevyplnené** → `družstvá = 0` a kategórie zápasov chýbajú (napr. SsFZ/VsFZ 2016/2017: tisíce zápasov, 0 družstiev). Vyplnenosť je **nekonzistentná** — niektoré staršie sezóny družstvá majú (napr. VsFZ 2019/2020: 206), iné nie. Hráči (z `nominations`) fungujú aj historicky. **Dôsledok pre frontend:** historické „družstvá" a rozpad osôb po kategóriách sú nespoľahlivé; zvážiť ich historicky nezobrazovať alebo označiť výhradou (rozhodnutie F2).

### 9c. Korekcia divákov (korekčná vrstva `etl/config/korekcie.json`)

Zápas **OFK Sľažany – ŠK Nevidzany** (IV. liga U13 ObFZ NR, 14. 10. 2019, `_id 5f3ffdab4000de0cc7e62c45`) mal `protocol.audience = 300000` (zjavný preklep; PO požiadal opravu pri zdroji). Kým sa zdroj neopraví, aplikuje sa korekcia na 30 cez `etl/pipelines.audience_expr` (nemodifikuje DB). Efekt na obfz-nitra 2019/2020: `kpi.divaci` 384 941 → **84 971**; do výstupu pribudol `methodologyFlags.korekcie`; anomália „podozrivý priemer divákov" zmizla. Keď zdroj opravia, záznam z `korekcie.json` odstrániť.

### 9d. Známy problém: zsfz 2021/2022 — pomalý DB dotaz (diagnóza + riešenie)

Agregácia `kategorie` pre **ZsFZ 2021/2022** opakovane prekračuje časový limit (120 s vo vlne 2 → `MaxTimeMSExpired`; pri re-behu nedobehla ani po ~9 min pri limite 600 s; priamy MCP dotaz na ten istý filter tiež timeoutuje). **Nevygenerované: zsfz 2021/2022, 2022/2023, 2023/2024, 2024/2025** (zsfz má 2012/13–2020/21 + 2025/26).

**Diagnóza (explain, queryPlanner 13. 7. 2026).** ETL `$match` = `{appSpace, closed, rules.sport_sector, season.name ∈ varianty}`. Žiadny zo 44 indexov kolekcie `matches` túto kombináciu nepokrýva. Optimalizátor zvolil `closed_1___issfMatchStatus_1_season.name_1` → IXSCAN vráti **všetky uzavreté zápasy danej sezóny naprieč všetkými appSpace (celé SR)**, appSpace a rules.sport_sector sa filtrujú až vo FETCH v pamäti. Pri 2021/2022 (prvá plná posezóna po COVIDe → najviac zápasov v SR; staršie ZsFZ sezóny boli COVIDom skrátené) je táto medzimnožina najväčšia → prešvihne limit. Príčina teda nie je počet súťažných častí (len 30, max 2/súťaž).

Druhotný problém: **index bloat**. `optimizationTimeMillis ≈ 1910` (plánovač trávi ~1,9 s len výberom plánu) a `maxIndexedAndSolutionsReached: true` — 44 indexov je nad rozumný limit optimalizátora; opakuje sa pri každej zo 7 agregácií každej sezóny.

**Odporúčané riešenie — jeden cielený index** (poradie podľa pravidla ESR; rovnostné polia najprv, `$in` pole posledné):

```js
db.matches.createIndex(
  { appSpace: 1, closed: 1, "rules.sport_sector": 1, "season.name": 1 },
  { name: "etl_appSpace_closed_sport_season" }
)
```

Tým sa `$match` zmení na tesný IXSCAN presne na cieľové zápasy (bez in-memory filtra). Keďže **všetkých 7 ETL agregácií začína týmto istým `$match`**, zrýchli sa celý ETL, nielen zsfz 2021/22.

**Stav:** index na produkčnej DB SFZ NEbol vytvorený (zápisová/DDL operácia — čaká na schválenie PO/DBA). Do ETL doplnené `--max-time-ms` (dočasná pomôcka). **Akcia po vytvorení indexu:** `python etl/run.py --zvaz zsfz --sezona 2021/2022` (a 2022/23, 2023/24, 2024/25), potom commit + kontrola `data/index.json`. Zvážiť aj revíziu 44 indexov (samostatne, opatrne).

