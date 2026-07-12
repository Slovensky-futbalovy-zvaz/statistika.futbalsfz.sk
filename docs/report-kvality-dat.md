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

- [ ] Pokrytie udalostí po vekových kategóriách (overenie záveru č. 3) — čiastočná evidencia: prípravky ZsFZ (U09–U11, 2025/2026) majú 0 gólov v protokole, zatiaľ čo prípravky ObFZ Nitra góly evidujú → pokrytie protokolov sa medzi zväzmi líši, pred publikovaním mládežníckych metrík treba merať po zväzoch
- [x] ~~Distinct roly `managers.type.label` po zväzoch~~ — vyriešené 12. 7. 2026: texty rolí sú **identické vo všetkých 43 zväzoch** (overené na sezóne 2025/2026); overený číselník v [`etl/config/roly.json`](../etl/config/roly.json). O8/O9 rozhodnuté 12. 7. 2026 (Ján Letko): VAR roly (Videorozhodca, Asistent videorozhodcu, Replay Operátor) patria medzi **rozhodcov**; Delegát stretnutia + Pozorovateľ rozhodcov tvoria skupinu **delegáti**; Hlavný usporiadateľ, Hlásateľ a Videotechnik tvoria skupinu **personál**
- [x] ~~Kontrola premenovaných súťaží~~ — vyriešené: súťaže sa zlučujú cez `competitionGroupId` (stabilné naprieč sezónami aj premenovaniami); úroveň = `level`, pohlavie = `parts[].rules.gender`, veková úroveň = `parts[].rules.category` (overené v dokumentácii aj na dátach, 12. 7. 2026)
- [ ] Overenie CRM API pre demografické atribúty (rok narodenia, pohlavie) — otázka O7
- [x] ~~Prvá verzia ETL skriptu~~ — hotové 12. 7. 2026: `etl/run.py` + moduly `etl/pipelines/`, `etl/validate/`. Pipelines verifikované proti vzorkám ObFZ Nitra 2024/2025 aj 2025/2026 (100 % zhoda vo všetkých metrikách); všeobecnosť overená vygenerovaním ZsFZ 2025/2026 (8 kategórií vrát. U10 a dorasteneckých U17/U19, bez anomálií). Beh po jednej sezóne + 1 retry (timeouty potvrdené aj pri discovery rolí — agregácie nad viacerými zväzmi naraz treba deliť na chunky ≤ 4–5 appSpace)

## 6. Doplnené zistenia z implementácie ETL (12. 7. 2026 večer)

1. **Vekové kategórie v dátach presahujú číselník metodiky** — ZsFZ 2025/2026 má aj `U10`. ETL číselník rozšírený (U06–U19 + ADULTS); neznáme hodnoty hlási validácia ako anomáliu.
2. **`divaciPokrytych`** = počet zápasov s vyplneným `protocol.audience` (vrátane 0); `divaciPokrytie` = pokrytých / všetkých zápasov — presne zodpovedá vzorkám.
3. **Družstvo** je unikát `organization.name` v rámci vekovej kategórie; KPI `druzstva` = súčet po kategóriách (rovnaká organizácia vo viacerých kategóriách sa počíta v každej z nich).
4. **VAR roly** (`Videorozhodca`, `Asistent videorozhodcu`, `Replay Operátor`) existujú len na `futbalsfz.sk`/`ulk.futbalnet.sk` a započítavajú sa medzi **rozhodcov**; `Delegát stretnutia` + `Pozorovateľ rozhodcov` = skupina **delegáti** (v praxi často tá istá osoba — unikáty ObFZ Nitra aj ZsFZ sa po zlúčení nezmenili); `Hlavný usporiadateľ`, `Hlásateľ`, `Videotechnik` = skupina **personál** (rozhodnutie 12. 7. 2026, viď roly.json).
5. **Delegáti chýbajú v niektorých ObFZ úplne** (Topoľčany, Veľký Krtíš, OFZ Orava… 2025/2026) — reálny stav, nie chyba dát (potvrdil Ján Letko, 12. 7. 2026).
6. **Futsal SFZ 2025/2026 vygenerovaný** (`data/zvaz/sfz/2025-2026-futsal.json`): 246 zápasov, kategórie ADULTS/U20/U17/U15 — futsal má **U20** (doplnená do číselníka). 23 zápasov „Vysokoškolskej ligy vo futsale“ nemá vyplnenú `teams.ageCategory` → vo výstupe kategória `NEZNAMA` + logovaná anomália. Roly osôb identické s futbalom. Pokrytie divákov len 89 % (pod futbalovým štandardom ~95 %).
