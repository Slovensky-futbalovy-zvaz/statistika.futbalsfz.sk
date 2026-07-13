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
- [x] **Vlna 2:** história pre všetkých 43 zväzov — **hotové 13. 7. 2026: 42/43 zväzov kompletných, 568 sezón OK, 1019 anomálií, 0 kritických** (viď report §9). Výnimka: zsfz 2021/22–2024/25 (viď nižšie).
- [x] Po behu: kontrola `data/index.json`, anomálie a zistenia do report-kvality-dat.md §8–§9, commity po regiónoch
- [x] Korekčná vrstva divákov (`etl/config/korekcie.json` + `audience_expr`): Sľažany–Nevidzany 300000→30, obfz-nitra 2019/20 pregenerované (viď report §9c)

## Zásobník (podľa priority)

- [ ] **zsfz 2021/22–2024/25 dogenerovať** — `kategorie` agregácia pre ZsFZ 2021/2022 prekračuje časový limit (aj 600 s), pravdepodobne chýbajúci index `matches` (appSpace + season.name + closed). Preveriť indexy, potom `python etl/run.py --zvaz zsfz --sezona 2021/2022 --max-time-ms N` (a zvyšné sezóny). Viď report §9d.
- [ ] Overiť/doplniť indexy kolekcie `matches` pre rýchlosť ťažkých agregácií (súvisí so zsfz 2021/22)
- [ ] Demografia ďalších zväzov (SFZ, 4 RFZ, ostatné ObFZ) — rovnaký vzor ako ObFZ Nitra (`etl/demografia.py`)
- [ ] Kickoff frontendu (F2): štruktúra `web/`, výber SSG frameworku, načítanie `data/index.json` + profil zväzu
- [ ] Overiť odoslanie podkladov Bart.sk (`docs/podklady-bart-produkcny-beh.md`) — čaká na odoslanie PO
- [ ] Overiť odoslanie nahlásenia chybného záznamu divákov (`docs/sportnet-nahlasenie-divaci.md`) — draft čaká na PO
- [ ] Futsal: historické sezóny (`run.py --zvaz sfz --sport-sector futsal --all-sezony`) + evidencia futsalových súborov v `data/index.json`
- [ ] Projekty (disney, kruzkymcd, dajmespolugol) — samostatná časť štatistík „Projekty“ (zatiaľ mimo ETL)
- [ ] Pokrytie kariet/gólov za prípravky (U07–U11) — publikovať len s výhradou/nezobrazovať (F2 rozhodnutie o UI)

## Hotové (výber)

- [x] F1 dátový audit + report kvality dát (12. 7. 2026)
- [x] ETL v1 `etl/run.py` — verifikované na ObFZ Nitra, ZsFZ, SFZ (12.–13. 7. 2026)
- [x] Dimenzia pohlavie M/F/NEURCENE vo všetkých výstupoch; KPI = súčet pohlaví (13. 7. 2026)
- [x] Normalizácie: WUxx→Uxx, „Dospelí“→ADULTS, „U15 mix“→U15, U21 v číselníku (13. 7. 2026)
- [x] Demografia v1 `etl/demografia.py` — ObFZ Nitra, 13 sezón, 100 % pokrytie (13. 7. 2026)
