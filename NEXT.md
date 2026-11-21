# NEXT — čo je rozrobené a čo nasleduje

**Stav k 21. 11. 2026.** Krátkodobý zoznam krokov. Dlhodobé otvorené úlohy sú v
[docs/TODO.md](docs/TODO.md), rozhodnutia v [metodike](docs/metodika.md) a [ADR](docs/adr/),
zmeny čísel v [CHANGELOG.md](CHANGELOG.md), priebeh práce v [docs/devlog.md](docs/devlog.md).

## Čaká na zdroj (Sportnet)
- **Vysokoškolská liga vo futsale — „Dospelí“ mimo číselníka.** Úroveň aj diváci sú vyriešené
  (21. 11., viď devlog). Zostáva drobnosť: novo pridaná tretia časť „Bratislava/ Finálová časť“
  má `rules.category` = `Dospelí` namiesto `ADULTS`. ETL to normalizuje (`KAT_NORMALIZACIA`
  v `etl/run.py`), na čísla to vplyv nemá — nahlásené Michalovi 21. 11. spolu s potvrdením opravy.
- **Historické zápasy bez kategórie súťaže** — zoznam odovzdaný 14. 10. (XLSX, 40 častí /
  518 uzavretých zápasov) je z väčšej časti vybavený. Kontrola v DB 21. 11.: z 25 existujúcich
  častí bez `rules.category` zostali **štyri** — `V.liga Podtatranská dospelí VsFZ` 2018/2019
  (súťaž `5e300d0032c839b23cbc45eb`, časť `5e300d0094f2303d560e7dfc`, **182 uzavretých zápasov**,
  jediná časť súťaže) a tri futsalové časti bez jediného uzavretého zápasu (`MFLKNM` 2019/2020,
  `Mestská ligy v Kysuckom Novom Meste` 2020/2021). Zvyšných ~73 zápasov v dátach pripadá na
  časti, ktoré v `competitions` neexistujú — presný zoznam až po prepočte histórie.
  Podtatranská ligu nahlásiť Sportnetu.
- **Krajská futbalová liga VsFZ — vyriešené pri zdroji, čaká prepočet.** Kontrola v DB 21. 11.:
  2019/2020 má všetkých 10 častí `category` = `ADULTS` a všetkých 164 uzavretých zápasov na
  existujúcich častiach; 2022/2023 (`634d0261e0a43db9a46b3041`) má 10 častí vrátane 8 obnovených
  skupín a všetkých 156 uzavretých zápasov sedí; 2023/2024 (`65361e86ba9790c412e33f23`) má 9 častí
  s kategóriou. **Zostáva nám ručne prepočítať 2019/2020, 2022/2023 a 2023/2024** (`--hint`)
  + kluby a agregáty — týždenný beh históriu neprepočítava (fingerprint).

## Poznámky k ručným prepočtom
- Historické sezóny 2021/2022+ púšťať s `--hint appSpace_1_closed_1_competition._id_1_competitionPart._id_1_round.dateFrom_-1_startDate_-1`
  (bez neho Atlas volí zlý plán a beh visí). Offline agregáty potrebujú **absolútne** `--out`.
- Push veľkých dátových commitov: `git -c http.postBuffer=1048576000 push` (inak HTTP 408).
- Lokálne repo je od 14. 10. v `~/GitHub/statistika.futbalsfz.sk` (mimo iCloudu); `web/dist`
  sa lokálne neuchováva (`pnpm build` ho vyrobí, produkciu zostavuje Vercel).
