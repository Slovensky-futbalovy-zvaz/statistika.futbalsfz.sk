# NEXT — čo je rozrobené a čo nasleduje

**Stav k 21. 11. 2026.** Krátkodobý zoznam krokov. Dlhodobé otvorené úlohy sú v
[docs/TODO.md](docs/TODO.md), rozhodnutia v [metodike](docs/metodika.md) a [ADR](docs/adr/),
zmeny čísel v [CHANGELOG.md](CHANGELOG.md), priebeh práce v [docs/devlog.md](docs/devlog.md).

## Čaká na zdroj (Sportnet)
- **Vysokoškolská liga vo futsale — „Dospelí“ mimo číselníka.** Úroveň aj diváci sú vyriešené
  (21. 11., viď devlog). Zostáva drobnosť: novo pridaná tretia časť „Bratislava/ Finálová časť“
  má `rules.category` = `Dospelí` namiesto `ADULTS`. ETL to normalizuje (`KAT_NORMALIZACIA`
  v `etl/run.py`), na čísla to vplyv nemá — nahlásené Michalovi 21. 11. spolu s potvrdením opravy.
- **Zápasy bez vekovej kategórie — po prepočte histórie 21. 11. zostáva 256 z 518.** Zoznam pre
  Sportnet: `Claude outputs/sutaze-bez-kategorie-po-prepocte-2026-11-21.xlsx` (lokálne, mimo gitu),
  **odoslané Michalovi (Bart.sk) 21. 11. 2026** — čaká sa na odpoveď.
  (1) **Na opravu:** `V.liga Podtatranská dospelí VsFZ` 2018/2019 — časť
  `5e300d0094f2303d560e7dfc` bez `rules.category`, 182 zápasov. (2) **Osirelé zápasy:** 31 zápasov
  v 12 častiach, ktoré v `competitions` neexistujú (LFZ U08 2022/2023 14, ObFZ LC 3+3, TFZ 3,
  zvyšok po 1); 7 z 12 častí vzniklo 14.–21. 6. 2024 — zrejme hromadná operácia v Sportnete.
  (3) 43 zápasov vo vylúčených turnajoch (RT U14/U15 SFZ, test VsFZ) — nízka priorita.
  Krajská futbalová liga VsFZ je po prepočte čistá. Po oprave Podtatranskej ručne prepočítať
  2018/2019 (bez `--hint`).

## Poznámky k ručným prepočtom
- Historické sezóny 2021/2022+ púšťať s `--hint appSpace_1_closed_1_competition._id_1_competitionPart._id_1_round.dateFrom_-1_startDate_-1`
  (bez neho Atlas volí zlý plán a beh visí). Offline agregáty potrebujú **absolútne** `--out`.
- Demografia veľkých zväzov (ZsFZ, SsFZ, VsFZ, BFZ) v historických sezónach potrebuje
  `--max-time-ms 600000` — s predvoleným limitom 2023/2024 padla na `MaxTimeMSExpired`.
  `etl/tyzdenna.py --sezona` ho nepodáva (ani `--hint` pre `beh.py`) — ručný prepočet histórie
  preto cez vlastný spúšťač (vzor: devlog 21. 11.).
- Spúšťače na Macu písať pre **bash 3.2**: pri `set -u` prázdne pole `"${A[@]}"` padá na
  „unbound variable“ — použiť `${A[@]+"${A[@]}"}`.
- Push veľkých dátových commitov: `git -c http.postBuffer=1048576000 push` (inak HTTP 408).
- Lokálne repo je od 14. 10. v `~/GitHub/statistika.futbalsfz.sk` (mimo iCloudu); `web/dist`
  sa lokálne neuchováva (`pnpm build` ho vyrobí, produkciu zostavuje Vercel).
