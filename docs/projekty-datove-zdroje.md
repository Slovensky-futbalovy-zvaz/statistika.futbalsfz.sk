# Projekty (grassroots) — dátové zdroje a návrh metrík

**Dátum:** 19. 7. 2026 · **Autor:** Claude + Ján Letko · **Stav:** podklad na rozhodnutie PO (metriky a rozsah sekcie „Projekty“)

## Zistenie: projekty nemajú zápasy, majú súpisky (deti) a družstvá (školy)

Grassroots projekty (`dajmespolugol`, `disney`, `kruzkymcd`) fungujú v Súťažiach inak než klasické súťaže — podstatou je **množstvo zapojených detí a škôl/krúžkov**, nie výsledky zápasov:

- V `sutaze.matches` je takmer nič: disney 0, kruzkymcd 0, dajmespolugol 53 zápasov (z toho len 12 uzavretých, sezóny 2018–2020). Zápasy sa v DSG vytvárajú „open“ (aktivity/tréningy) a neuzatvárajú sa — **metodika „len closed:true“ je pre projekty nepoužiteľná**.
- Skutočné dáta sú v **`sutaze.competitions.parts[].teams[]`** (družstvá = školy/krúžky prihlásené do časti súťaže) a ich **`squad.athletes[]`** (zapojené deti). Overené 19. 7. 2026:

| Projekt | Sezóny | Družstvá (školy) | Deti v súpiskách |
|---|---|---|---|
| dajmespolugol | 2018/19–2025/26 (8) | 196–485/sezónu | 836–2 330/sezónu (2018/19 len 2 — vtedy bežali nominácie zápasov) |
| disney | 2021/22–2025/26 (5) | 21–32/sezónu | **0 — súpisky prázdne** (evidencia detí zrejme mimo Súťaží) |
| kruzkymcd | 2022/23–2024/25 (3) | 49–54/sezónu (2024/25 zatiaľ 0) | 36–96/sezónu |

- DSG má aj vlastné API vrstvy: `sutaze.api` DSG endpointy (družstvá s flagom `dajmespolugol: true`, súpisky s vekom a pohlavím dieťaťa v `additionalData`) a **CoreApi verejný register** `/registry/dajmespolugol/{organizations,users}` (zapojené organizácie s počtami athletes, účastníci s flagom `dajmespolugol`). Endpoint podporuje param `project` — tá istá infra obsluhuje aj sub-projekty.

## Návrh metrík sekcie „Projekty“ (na schválenie PO)

Na sezónu a projekt: **zapojené školy/krúžky** (družstvá v častiach súťaží), **zapojené deti** (athletes v súpiskách; u DSG s vekom a pohlavím → možná aj demografia), **aktivity** (zápasy/tréningy vrátane neuzavretých — len ako doplnok s výhradou). Vlastný ETL modul `etl/projekty.py` (agregácia zo `competitions`, nie z `matches`), výstup `data/projekty/{projekt}.json`, samostatná stránka `/projekty`.

## Otvorené otázky pre PO

1. Disney má prázdne súpisky — overiť u Sportnetu, kde sa evidujú zapojené deti Disney projektu (CoreApi register? CRM skupiny?).
2. dajmespolugol 2018/19: deti počítať z nominácií zápasov (jediná sezóna so zápasmi) alebo vynechať?
3. Kruzkymcd 2024/25 bez družstiev — projekt skončil, alebo dáta meškajú?
4. Publikovať „aktivity“ (neuzavreté zápasy) vôbec, alebo len školy + deti?
