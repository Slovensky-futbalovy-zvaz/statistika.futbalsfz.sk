# NEXT — čo je rozrobené a čo nasleduje

**Stav k 14. 10. 2026.** Krátkodobý zoznam krokov. Dlhodobé otvorené úlohy sú v
[docs/TODO.md](docs/TODO.md), rozhodnutia v [metodike](docs/metodika.md) a [ADR](docs/adr/),
zmeny čísel v [CHANGELOG.md](CHANGELOG.md), priebeh práce v [docs/devlog.md](docs/devlog.md).

## Čaká na zdroj (Sportnet)
- **Vysokoškolská liga vo futsale 2026/2027** — **opravené v Sportnete** (overené 14. 10.):
  obe časti (Skupina A, B) majú `rules.category` = `ADULTS` a `rules.gender` = `M`, všetkých
  16 zápasov odkazuje na existujúce časti. Týždenné behy 7. a 14. 10. boli kvôli tomu
  „ČIASTOČNÉ“; overiť, že beh 21. 10. prebehne celý, potom bod zmazať.
- **Historické zápasy bez kategórie súťaže** — 40 častí súťaží, 518 uzavretých zápasov
  (2016/2017 – 2023/2024), zoznam na nahlásenie odovzdaný 14. 10. (XLSX). 25 častí nemá
  `rules.category`, 15 častí v `competitions` už neexistuje. Najväčšie: Krajská futbalová liga
  VsFZ (266 zápasov) — zvážiť zaradenie do `vylucene_sutaze.json`. Pohlavie mimo číselníka
  nechýba nikde.

## Poznámky k ručným prepočtom
- Historické sezóny 2021/2022+ púšťať s `--hint appSpace_1_closed_1_competition._id_1_competitionPart._id_1_round.dateFrom_-1_startDate_-1`
  (bez neho Atlas volí zlý plán a beh visí). Offline agregáty potrebujú **absolútne** `--out`.
- Push veľkých dátových commitov: `git -c http.postBuffer=1048576000 push` (inak HTTP 408).
- Lokálne repo je od 14. 10. v `~/GitHub/statistika.futbalsfz.sk` (mimo iCloudu); `web/dist`
  sa lokálne neuchováva (`pnpm build` ho vyrobí, produkciu zostavuje Vercel).
