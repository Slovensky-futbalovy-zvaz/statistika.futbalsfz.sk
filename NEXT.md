# NEXT — čo je rozrobené a čo nasleduje

**Stav k 14. 10. 2026.** Krátkodobý zoznam krokov. Dlhodobé otvorené úlohy sú v
[docs/TODO.md](docs/TODO.md), rozhodnutia v [metodike](docs/metodika.md) a [ADR](docs/adr/),
zmeny čísel v [CHANGELOG.md](CHANGELOG.md).

## Hotové — oprava osôb po kategóriách a pokrytia divákov (vetva `fix/osoby-kategorie-pokrytie`)
- [x] Oprava ETL (pipelines, kluby.py), validátor NEURCENE, texty a metodika — v `main` od 6. 10.
- [x] Prepočet všetkých sezón 2012/2013 – 2025/2026 (zväzy, futsal SFZ, kluby) + offline agregáty
- [x] Overenie: menia sa len `osoby.*.poKategorii`, pokrytie divákov a poznámka; pokrytie ≤ 1 všade

## Rozrobené — Plán B: unikáty po vekových kategóriách (vetva `feat/osoby-skupiny`)
- [x] ETL `osoby.<rola>.poSkupinach` + `mladez`, web s fallbackom, Index klubu zložka B z `mladez`
- [ ] Zlúčenie do `main` + druhý plný prepočet (zväzy, kluby, agregáty)
- [ ] Diff Indexu klubu (top 20 zmien) na schválenie pred publikovaním, mobil 375 px

## Čaká na zdroj (Sportnet)
- **Vysokoškolská liga vo futsale 2026/2027** — časti súťaže nemajú `rules.category` ani
  `rules.gender` (2025/2026 mali „Dospelí“ / „M“). Futsalový krok preto končí chybou
  (`neznáma veková kategória NEZNAMA`) a týždenný beh je od 7. 10. „ČIASTOČNÝ“. Nahlasuje
  Ján Letko v Sportnete; ETL sa neobchádza.
- **Historické zápasy bez kategórie súťaže** — napr. VsFZ 2019/2020 (165 zápasov NEZNAMA),
  VsFZ 2022/2023 (92 zápasov NEURCENE): časť súťaže nemá kategóriu, osoby len z týchto zápasov
  v rozpade po kategóriách chýbajú (validátor: súčet < unikátni). Existovalo pred opravou.

## Upratovanie (na rozhodnutie)
- 71 súborov `* 2.json` / `* 2.png` / `POST 2.md` z 15. a 19. 8. 2026 — vyzerajú ako konfliktné
  kópie iCloudu (repo je v `~/Documents`). Nie sú v gite; zmazať až po kontrole.
- Worktree `.worktrees/planB` (Plán B) — po zlúčení odstrániť (`git worktree remove`).
- `.git/stale-*-claude`, `.git/claude-f7*.sh` — pomocné súbory z 14. 10., po skončení zmazať.
