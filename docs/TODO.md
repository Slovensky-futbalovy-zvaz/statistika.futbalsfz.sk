# TODO — projektový zásobník

Aktuálny stav úloh projektu statistika.futbalsfz.sk. Udržiava sa priebežne v každej session; rozhodnutia PO sa zapisujú sem a do príslušných dokumentov (metodika, ADR, report kvality).

**Stav k:** 13. 7. 2026 (session: plný dátový beh)

## Rozhodnutia PO z 13. 7. 2026 (plný dátový beh)

| Otázka | Rozhodnutie |
|---|---|
| Rozsah sezón | **Dve vlny:** vlna 1 = 2025/2026 všetkých 43 zväzov; vlna 2 = história 2013/2014–2024/2025 |
| Poradie zväzov | **SFZ → RFZ → ObFZ po regiónoch** (BFZ, ZsFZ, SsFZ, VsFZ); commit po dávkach |
| Anomálie počas behu | **Zbierať a riešiť hromadne na konci** (beh sa nezastavuje, stop len pri systémovej chybe); zapísať do report-kvality-dat.md |
| Demografia ďalších zväzov | **Až po hlavnom behu, ak zvýši čas** |
| Terminológia zdroja dát | Zdroj dát je **platforma sportnet.online** — nezamieňať s verejným portálom Sportnet.sk (ten na platforme len beží); opravené v dokumentácii |

## Prebieha (táto session)

- [x] **Vlna 1:** ETL 2025/2026 pre všetkých 43 zväzov (SFZ → RFZ → ObFZ po regiónoch), dávkový runner `etl/beh.py` — **hotové 13. 7. 2026: 43/43 OK, 0 preskočených, 2 anomálie (VsFZ), žiadna systémová chyba** (viď report-kvality-dat.md §8)
- [x] **Vlna 2:** história pre všetkých 43 zväzov — **hotové 13. 7. 2026: 43/43 zväzov kompletných, 573 sezónnych výstupov, 0 kritických anomálií** (viď report §9). zsfz 2021/22–2024/25 dogenerované cez `--hint` (viď §9d).
- [x] Po behu: kontrola `data/index.json`, anomálie a zistenia do report-kvality-dat.md §8–§9, commity po regiónoch
- [x] Korekčná vrstva divákov (`etl/config/korekcie.json` + `audience_expr`): Sľažany–Nevidzany 300000→30, obfz-nitra 2019/20 pregenerované (viď report §9c)

## Zásobník (podľa priority)

- [x] zsfz 2021/22–2024/25 dogenerované (13. 7. 2026) cez `--hint` — zsfz kompletný (14 sezón), stav 43/43 (viď report §9d).
- [ ] **DBA/PO: vytvoriť cielený index na `matches`** (ADR-0004; diagnóza cez explain — report §9d):
  `db.matches.createIndex({ appSpace:1, closed:1, "rules.sport_sector":1, "season.name":1 }, { name: "etl_appSpace_closed_sport_season" })`
  Zrýchli všetkých 7 ETL agregácií pre všetky zväzy a **odstráni potrebu `--hint`**. Hint je len dočasná obchádzka.
- [ ] (Neskôr, opatrne) Revízia počtu indexov na `matches` — 44 indexov spomaľuje samotné plánovanie dotazov (`optimizationTimeMillis ≈ 1,9 s`, `maxIndexedAndSolutionsReached`).
- [ ] Demografia ďalších zväzov (SFZ, 4 RFZ, ostatné ObFZ) — rovnaký vzor ako ObFZ Nitra (`etl/demografia.py`)
- [~] Frontend (ADR-0005 — Astro + ECharts + Tailwind): **hotové** — mapa SR, profil zväzu, per-sezónne stránky, graf kategórií, pohlavie+osoby, **medziročné porovnanie KPI**, **F4 porovnanie a radenie zväzov** (`/porovnanie/{uroven}/{sezona}` — tabuľka + graf s výberom metriky, RFZ aj ObFZ). Build 646 stránok. **Ďalej:** demografia (F5), prepínač odvetvia futbal/futsal, výber 2–5 zväzov + radar, napojiť Cloudflare Pages (root `web/`).
- [ ] Optimalizácia: tree-shaking ECharts (import len potrebných modulov cez `echarts/core`) — teraz sa bundluje celý (~1 MB) na sezónnych stránkach
- [ ] Overiť odoslanie podkladov Bart.sk (`docs/podklady-bart-produkcny-beh.md`) — čaká na odoslanie PO
- [ ] Overiť odoslanie nahlásenia chybného záznamu divákov (`docs/sportnet-nahlasenie-divaci.md`) — draft čaká na PO
- [x] Futsal: historické sezóny (SFZ) — **hotové 13. 7. 2026: 11 sezón (2014/15–2025/26, 2022/23 v DB prázdna), 0 kritických anomálií**; evidencia v `index.json` cez `zvazy[sfz].odvetvia.futsal` (aktualizuj_index rozšírené)
- [ ] Projekty (disney, kruzkymcd, dajmespolugol) — samostatná časť štatistík „Projekty“ (zatiaľ mimo ETL)
- [ ] Pokrytie kariet/gólov za prípravky (U07–U11) — publikovať len s výhradou/nezobrazovať (F2 rozhodnutie o UI)

## Hotové (výber)

- [x] F1 dátový audit + report kvality dát (12. 7. 2026)
- [x] ETL v1 `etl/run.py` — verifikované na ObFZ Nitra, ZsFZ, SFZ (12.–13. 7. 2026)
- [x] Dimenzia pohlavie M/F/NEURCENE vo všetkých výstupoch; KPI = súčet pohlaví (13. 7. 2026)
- [x] Normalizácie: WUxx→Uxx, „Dospelí“→ADULTS, „U15 mix“→U15, U21 v číselníku (13. 7. 2026)
- [x] Demografia v1 `etl/demografia.py` — ObFZ Nitra, 13 sezón, 100 % pokrytie (13. 7. 2026)
