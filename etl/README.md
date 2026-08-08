# ETL pipeline

Agregácie zo Sportnet DB (MongoDB `sutaze`, primárne kolekcia `matches`) do publikovateľných
JSON súborov v `data/`. Web nemá do databázy prístup — všetko, čo sa na portáli zobrazí, musí
najprv prejsť týmito skriptami ([ADR-0001](../docs/adr/0001-architektura-predgenerovane-json.md)).

Pipelines sú verifikované proti vzorkám ObFZ Nitra (2024/2025, 2025/2026 — 100 % zhoda)
a všeobecnosť overená na ZsFZ a SFZ.

## Štruktúra

```
etl/
├── config/
│   ├── zvazy.json          # register 43 zväzov (appSpace, úroveň, názov) — overený, nie hádaný
│   ├── sezony.json         # normalizačná mapa season.name → kanonická sezóna
│   ├── roly.json           # overený číselník rolí osôb (rozhodcovia, delegáti, personál, tréneri)
│   ├── sporty.json         # číselník športu a odvetví (futbal/futsal/…) zo Sportnet API
│   └── korekcie.json       # ručné korekcie chybných záznamov (napr. diváci 300 000 → 30)
├── pipelines/              # agregačné pipelines (kategórie, družstvá, hráči, tréneri, rozhodcovia…)
├── validate/               # validácie výstupov (KPI = súčet kategórií, pokrytie divákov, anomálie)
└── *.py, prepocet.sh       # jednotlivé behy — pozri tabuľku nižšie
```

## Čo ktorý skript robí

Skripty sa delia na tie, ktoré **čítajú databázu**, a tie, ktoré len **prepočítavajú už
vygenerované JSON**. Druhá skupina je rýchla a dá sa púšťať opakovane bez prístupu do DB.

### Čítajú databázu

| Skript | Výstup | Čo robí |
|---|---|---|
| `run.py` | `data/zvaz/{id}/{sezona}.json` | Profil zväzu za sezónu — KPI, kategórie, družstvá, osoby, pohlavie. Základ všetkého ostatného |
| `beh.py` | to isté, hromadne | Dávkový runner cez všetkých 43 zväzov so **zdieľaným DB spojením** (efektívnejšie než 43× `run.py`). Poradie SFZ → RFZ → ObFZ po regiónoch |
| `kluby.py` | `data/klub/{id}/{sezona}.json` | Profil klubu za sezónu. Klub = `teams[].organization._id`, agreguje sa **naprieč všetkými súťažami celej SR**, nie podľa riadiaceho zväzu |
| `demografia.py` | `data/demografia/{id}.json` | Rok narodenia × pohlavie × rola za zväz, všetky sezóny v jednom súbore |
| `demografia_klub.py` | `data/demografia-klub/{id}.json` | To isté za klub (hráči, tréneri, realizačný tím) |
| `trendy.py` | `data/vek/`, `data/vek-klub/` | Vekové histogramy pre stránku Trendy — po kluboch, zväzoch, súťažiach a úrovniach ligy. **~43 s na sezónu**, celá história ~14 min |
| `projekty.py` | `data/projekty/{id}.json` | Grassroots projekty (Dajme spolu gól, Disney, McDonald's krúžky). Zdroj je `competitions.parts[].teams[].squad.athletes[]`, **nie `matches`** — tieto projekty nemajú zápasy |

### Prepočítavajú už vygenerované JSON

| Skript | Výstup | Čo robí |
|---|---|---|
| `sumar.py` | `data/sumar/{sezona}.json` | Celoslovenský súhrn — súčty 43 zväzov, sunbursty, SR demografia. Podklad úvodnej stránky |
| `porovnania.py` | `data/porovnania/{uroven}/{sezona}.json` | Porovnávacie tabuľky zväzov (RFZ, ObFZ) s odvodenými metrikami |
| `porovnania_kluby.py` | `data/porovnania/kluby/{sezona}.json` | To isté pre všetky kluby |
| `index_klubu.py` | `data/index-klubu/`, `data/index-klubu.json` | Index klubu (0–100) z piatich zložiek. Beží **nad výstupmi `trendy.py`**, do DB nesiaha |
| `kontrola_skupin.py` | (nezapisuje) | Overuje invarianty metriky **skupiny** nad `data/` — `skupiny >= sutaze` v každom reze, súčet cez úrovne = `kpi.skupiny`, porovnania nesú `skupiny`. Nenulový exit pri chybe. Pusti po každom behu, ktorý sa dotýka počtov súťaží |

### Orchestrácia

| Skript | Čo robí |
|---|---|
| `prepocet.sh` | Prepočet `data/` po jednotlivých zväzoch a sezónach s jemným progresom — futbal (zväzy + kluby) aj futsal. `bash etl/prepocet.sh 2025/2026` pustí len jednu sezónu |
| `tyzdenna.py` | Týždenná aktualizácia — prepočíta **len aktuálnu sezónu** a odvodené agregáty. Historické sezóny sú nemenné. Necommituje; to rieši [workflow](../.github/workflows/tyzdenna.yml) |

## Poradie behov

Závislosti idú zhora nadol — čo je nižšie, potrebuje výstupy toho, čo je vyššie:

```
1.  run.py / beh.py          → data/zvaz/
2.  kluby.py                 → data/klub/
3.  demografia.py            → data/demografia/
    demografia_klub.py       → data/demografia-klub/
4.  sumar.py                 → data/sumar/          (potrebuje 1 a 3)
    porovnania.py            → data/porovnania/     (potrebuje 1)
    porovnania_kluby.py      → data/porovnania/kluby/ (potrebuje 2)
5.  trendy.py                → data/vek/, data/vek-klub/
6.  index_klubu.py           → data/index-klubu/    (potrebuje 5)
```

`projekty.py` je nezávislý, dá sa pustiť kedykoľvek.

## Použitie

```bash
export MONGODB_URI="mongodb://…"          # read-only prístup do DB sutaze + sportnet stačí

python etl/run.py --zvaz obfz-nitra --sezona 2025/2026
python etl/run.py --zvaz obfz-nitra --all-sezony
python etl/run.py --zvaz sfz --sezona 2025/2026 --sport-sector futsal   # futsal patrí pod SFZ
python etl/demografia.py --zvaz obfz-nitra --all-sezony
python etl/trendy.py --vsetky                                          # všetky sezóny, ~14 min
python etl/index_klubu.py --sezona-prehladu 2025/2026
bash   etl/prepocet.sh 2025/2026
python etl/kontrola_skupin.py                                          # po behu: invarianty skupín
```

**Lokálny beh (macOS, python.org build):**

```bash
python3 -m venv .venv && ./.venv/bin/pip install pymongo certifi
export SSL_CERT_FILE=$(./.venv/bin/python -c 'import certifi; print(certifi.where())')   # Atlas TLS
```

URI patrí do `.env.local` (gitignorované). Anomálie sa logujú ako WARNING; pri nezrovnalostiach
počtov skončí skript nenulovým exit kódom.

> **`--hint` používaj striedmejšie, než sa zdá.** Je to obchádzka chýbajúceho cieleného indexu
> ([ADR-0004](../docs/adr/0004-vykonnost-agregacii.md)) a **plný beh spomalí približne 1,5×**
> (zmerané 8. 8. 2026: ~0,7 profilu/min s hintom oproti ~1,1 bez neho). Pusti plný beh bez neho
> a hint nasaď až na tých pár sezón, ktoré spadnú na `MaxTimeMSExpired` — týka sa hlavne ZsFZ:
>
> ```bash
> python etl/run.py --zvaz zsfz --sezona 2024/2025 \
>   --hint appSpace_1_closed_1_competition._id_1_competitionPart._id_1_round.dateFrom_-1_startDate_-1
> ```

> **Pozor pri `index_klubu.py`:** celoslovenský prehľad musí dostať jednu konkrétnu sezónu cez
> `--sezona-prehladu`. Bez toho berie pre každý klub jeho poslednú dostupnú sezónu a vychádza
> 46 % klubov „bez mládeže“ namiesto skutočných 18 %.

## Zásady (záväzné, viď [docs/metodika.md](../docs/metodika.md))

- Len `closed: true` zápasy; „odohraté“ = uzatvorené mínus administratívne kontumácie
  a odstúpenia bez zápisu ([ADR-0008](../docs/adr/0008-odohrane-zapasy-bez-administrativnych.md)).
- appSpace vždy z overeného registra (`--zvaz` = id zo `zvazy.json`; SFZ má dva appSpace).
- Súťaže sa zlučujú cez `competitionGroupId`; **nikdy regex na názvy súťaží** — názvy sa počas
  sezóny menia podľa partnerov.
- Vekové kategórie z `teams[].ageCategory`; `nominations.teamId` (string) ↔ `teams._id`
  (ObjectId) sa spája cez `$toString`.
- **Dve rôzne „vekové úrovne“:** veková úroveň OSOBY sa odvodzuje z ročníka narodenia (koncový
  rok sezóny mínus ročník), veková úroveň SÚŤAŽE alebo DRUŽSTVA je exaktne zadaná v databáze.
  Nezamieňať.
- Roly osôb výhradne z `config/roly.json`.
- Osoby: publikovať unikáty aj súčty po kategóriách s poznámkou (dvojité pôsobenie).
- Diváci vždy s % pokrytia; nedostatočné pokrytie sa nezobrazí, **neodhaduje sa**.
- Agregácie po JEDNEJ sezóne (viac sezón naraz timeoutuje); 1 retry na transportný timeout.
- Pohlavie výhradne z `competitions.parts[].rules.gender` cez `competitionPart._id`.
- Úroveň súťaže (`competitions.level`) sa vždy vzťahuje ku konkrétnej vekovej úrovni — „1. liga“
  dospelých a U19 sú dve rôzne súťaže a nikdy sa nesčítavajú do jedného stupňa.
- **Súťaž vs. súťažná skupina:** vykazujú sa OBE metriky súčasne (`sutaze` aj `skupiny`
  v každom reze). Skupina = základná časť súťaže; určuje ju `run.nacitaj_skupina_mapu` dvoma
  sitami — štruktúrnym a podľa názvu časti. Databáza typ časti nenesie. Invariant po každom
  behu: **`skupiny >= sutaze` v každom reze**. Podrobne v metodike, kapitola
  „SÚŤAŽ vs. SÚŤAŽNÁ SKUPINA“.
