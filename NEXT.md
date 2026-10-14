# NEXT — čo je rozrobené a čo nasleduje

**Stav k 14. 10. 2026.** Krátkodobý zoznam krokov. Dlhodobé otvorené úlohy sú v
[docs/TODO.md](docs/TODO.md), rozhodnutia v [metodike](docs/metodika.md) a [ADR](docs/adr/),
zmeny čísel v [CHANGELOG.md](CHANGELOG.md).

## Hotové — oprava osôb po kategóriách a pokrytia divákov (vetva `fix/osoby-kategorie-pokrytie`)
- [x] Oprava ETL (pipelines, kluby.py), validátor NEURCENE, texty a metodika — v `main` od 6. 10.
- [x] Prepočet všetkých sezón 2012/2013 – 2025/2026 (zväzy, futsal SFZ, kluby) + offline agregáty
- [x] Overenie: menia sa len `osoby.*.poKategorii`, pokrytie divákov a poznámka; pokrytie ≤ 1 všade

## Hotové — Plán B: unikáty po vekových skupinách (vetva `feat/osoby-skupiny`, v `main` od 14. 10.)
- [x] ETL `osoby.<rola>.poSkupinach` + `mladez`, web s fallbackom, Index klubu zložka B z `mladez`
- [x] Plný prepočet (zväzy, futsal, kluby, agregáty); validátor max ≤ skupina ≤ súčet bez porušenia
- [x] Diff Indexu klubu schválený 14. 10. (168 z 1 410 klubov −3 až −7 b., nikto nahor)
- [x] Kontrola produkcie 14. 10., mobil 375 px bez horizontálneho scrollu (VsFZ 2018/2019 rozhodcovia 210, Dorast 179; Ľubotín index 69; porovnanie klubov so skupinami)

## Poznámka k ručným prepočtom
- Historické sezóny 2021/2022+ púšťať s `--hint appSpace_1_closed_1_competition._id_1_competitionPart._id_1_round.dateFrom_-1_startDate_-1`
  (bez neho Atlas volí zlý plán a beh visí). Offline agregáty potrebujú **absolútne** `--out`.
- Push veľkých dátových commitov: `git -c http.postBuffer=1048576000 push` (inak HTTP 408).

## Čaká na zdroj (Sportnet)
- **Vysokoškolská liga vo futsale 2026/2027** — časti súťaže nemajú `rules.category` ani
  `rules.gender` (2025/2026 mali „Dospelí“ / „M“). Futsalový krok preto končí chybou
  (`neznáma veková kategória NEZNAMA`) a týždenný beh je od 7. 10. „ČIASTOČNÝ“. Nahlasuje
  Ján Letko v Sportnete; ETL sa neobchádza.
- **Historické zápasy bez kategórie súťaže** — 40 častí súťaží, 518 uzavretých zápasov
  (2016/2017 – 2023/2024), zoznam na nahlásenie odovzdaný 14. 10. (XLSX). 25 častí nemá
  `rules.category`, 15 častí v `competitions` už neexistuje. Najväčšie: Krajská futbalová liga
  VsFZ (266 zápasov) — zvážiť zaradenie do `vylucene_sutaze.json`. Pohlavie mimo číselníka
  nechýba nikde.

## Upratovanie (hotové 14. 10. 2026, so súhlasom)
- Zmazané: worktree `.worktrees/planB`, pomocné súbory `.git/claude-*` a `.git/stale-*`,
  1 733 konfliktných kópií iCloudu `* 2*` (72 v repe — staršie verzie sledovaných súborov;
  1 661 vo `web/dist`) a lokálny build `web/dist` (25 GB, generuje sa `pnpm build`).
- Lokálne repo presunuté z `~/Documents/GitHub` (iCloud) do `~/GitHub`; `.venv` vytvorené nanovo.
- Vetvy `fix/osoby-kategorie-pokrytie` a `feat/osoby-skupiny` sú zlúčené v `main` — zmazať na pokyn.
