# NEXT — čo je rozrobené a čo nasleduje

**Stav k 21. 10. 2026.** Krátkodobý zoznam krokov. Dlhodobé otvorené úlohy sú v
[docs/TODO.md](docs/TODO.md), rozhodnutia v [metodike](docs/metodika.md) a [ADR](docs/adr/),
zmeny čísel v [CHANGELOG.md](CHANGELOG.md), priebeh práce v [docs/devlog.md](docs/devlog.md).

## Čaká na zdroj (Sportnet)
- **Vysokoškolská liga vo futsale — chýba úroveň súťaže.** Oprava z 14. 10. doplnila
  `rules.category` = `ADULTS` a `rules.gender` = `M` (beh 21. 10. už prešiel celý), ale časti
  súťaže nemajú priradenú **úroveň súťaže**, takže ich 9 zápasov sezóny 2026/2027 spadá do
  `NEURCENE` mimo ligovej pyramídy. Tie isté zápasy zároveň nemajú vyplnených divákov a samy
  stiahli pokrytie divákov futsalu SFZ na 76,3 %. Podľa dokumentácie Súťaží je `level`
  kopírovaný z ISSF a nedá sa nastaviť v admine, pričom táto súťaž vznikla priamo v Sportnete
  (`ownerPPO` `futsalslovakia.sk`) — draft nahlásenia v
  [docs/sportnet-nahlasenie-vs-liga-uroven.md](docs/sportnet-nahlasenie-vs-liga-uroven.md),
  čaká na odoslanie.
- **Historické zápasy bez kategórie súťaže** — 40 častí súťaží, 518 uzavretých zápasov
  (2016/2017 – 2023/2024), zoznam na nahlásenie odovzdaný 14. 10. (XLSX). 25 častí nemá
  `rules.category`, 15 častí v `competitions` už neexistuje. Pohlavie mimo číselníka nechýba nikde.
- **Krajská futbalová liga VsFZ** (zimná liga dospelých mužov, ~100 družstiev) — 262 z nich:
  2019/2020 všetkých 164 zápasov (10 častí bez kategórie), 2022/2023 92 zápasov (8 zmazaných
  skupín), 2023/2024 6 zápasov (1 časť bez kategórie). Rieši kolega v Sportnete (15. 10.):
  kategória Dospelí do 11 častí; 2022/2023 presun zápasov alebo obnovenie skupín. Potom ručne
  prepočítať 2019/2020, 2022/2023 a 2023/2024 (`--hint`) + kluby a agregáty.

## Poznámky k ručným prepočtom
- Historické sezóny 2021/2022+ púšťať s `--hint appSpace_1_closed_1_competition._id_1_competitionPart._id_1_round.dateFrom_-1_startDate_-1`
  (bez neho Atlas volí zlý plán a beh visí). Offline agregáty potrebujú **absolútne** `--out`.
- Push veľkých dátových commitov: `git -c http.postBuffer=1048576000 push` (inak HTTP 408).
- Lokálne repo je od 14. 10. v `~/GitHub/statistika.futbalsfz.sk` (mimo iCloudu); `web/dist`
  sa lokálne neuchováva (`pnpm build` ho vyrobí, produkciu zostavuje Vercel).
