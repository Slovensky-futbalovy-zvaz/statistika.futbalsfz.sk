# ADR-0009: Súťaž vs. súťažná skupina — dve metriky vedľa seba, predvolená je skupina

**Stav:** Prijaté · **Dátum:** 2026-08-08 · **PO:** Ján Letko

## Kontext

Portál doteraz vykazoval „počet súťaží“ ako počet záznamov v `competitions`. Ukázalo sa, že
toto číslo **nemeria to, čo si pod ním čitateľ predstaví, a medzi zväzmi nie je porovnateľné.**

„III. liga U19 HUMMEL ZsFZ“ 2025/2026 je v ISSF jedna súťaž, ale hrajú sa v nej dve paralelné
základné skupiny — skupina JV a skupina SZ, obe 14 družstiev a 26 kôl, každá s vlastnou
tabuľkou. Nad nimi je ešte nadstavbová časť. To isté platí pre „IV. ligu U19 ZsFZ“ so skupinami
A–F.

Podstatné je, že **rovnakú realitu vykazujú zväzy rôzne**: čo ZsFZ vedie ako jednu súťaž so
šiestimi skupinami, má VsFZ ako šesť samostatných súťaží. Rebríček zväzov podľa počtu súťaží
teda meria evidenčný zvyk zväzu, nie objem súťaží, ktoré riadi.

Prekážka: **databáza príznak typu časti nenesie.** Stĺpec „Základná / Nadstavbová časť“ existuje
len v ISSF; `competitions.parts[]` má iba `name`, `publicComment`, `type` (collective/race —
druh športu), `format`, `signup`, `published`, `rules`, `settings`, `dateFrom`, `dateTo`,
`__issfId`, `_id`, `rounds`, `teams`, `resultsTable`. Dátumy sú pri všetkých častiach rovnaké.

## Rozhodnutie

**Zavádza sa druhá metrika `skupiny` — súťažná skupina = základná časť súťaže —
a vykazuje sa SÚČASNE s doterajšou `sutaze`. Publikované čísla sa spätne neprepisujú.**
Frontend medzi metrikami prepína, **predvolená je Skupiny**.

Typ časti sa odhaduje dvoma sitami (`etl/run.py::nacitaj_skupina_mapu`):

1. **Štruktúrny signál** — nadstavba si družstvá preberá zo základných častí, nikdy neprivedie
   nové. *Časť je základná skupina, ak obsahuje aspoň jedno družstvo, ktoré nie je v žiadnej
   inej časti tej istej súťaže.* Identita družstva je `organization._id | category | ageCategory`.
2. **Názov časti** (`je_nadstavbova_cast`) — sito č. 1 zlyháva tam, kde nadstavba nové družstvo
   priviesť naozaj môže: baráž o postup so súperom z inej súťaže. Vyraďujú sa časti, ktorých
   názov (bez diakritiky) obsahuje `baraz`, `nadstavb`, `o udrzanie`, `o postup`, `o titul`,
   `o umiestnenie`, `play-off`, `o majstra`, `majster okresu`, `kvalifikac`, `finale`,
   `finalov`, `semifinale`, `stvrtfinale`, `osemfinale`, `o N-M miesto`, `superpohar`.

Zásada „názvom neveriť“ z metodiky sa týka **názvov súťaží**, ktoré sa menia podľa partnerov
ročníka („III. liga U19 **HUMMEL** ZsFZ“). Názvy **častí** sú štruktúrny popis a nemenia sa.

**Fallback:** ak sa v súťaži nedá rozlíšiť ani jedna základná skupina — všetky časti majú tých
istých účastníkov, alebo všetky vypadli cez sito názvov (Niké liga, Slovenský pohár SF) — celá
súťaž sa započíta ako **jedna** skupina. Konzervatívne: radšej podpočítať než nafukovať.
Fallback sa vyhodnocuje **v rámci každého rezu samostatne** (`run._skupiny_rezy`), nie globálne
za súťaž — inak vznikajú rezy so `skupiny = 0` pri `sutaze = 1`.

**Invariant kontrolovaný po každom behu: `skupiny >= sutaze` v každom reze.**

## Dôsledky

- **Namerané po plných behoch (8. 8. 2026, celoslovensky):**

  | Sezóna | Súťaže | Skupiny | SFZ | RFZ | ObFZ |
  |---|---|---|---|---|---|
  | 2025/2026 | 397 | **557** | 27 → 56 | 83 → 125 | 287 → 376 |
  | 2024/2025 | 401 | **569** | 27 → 50 | 86 → 121 | 288 → 398 |

  Sito názvov preklasifikovalo na 2025/2026 dvanásť častí (549 → 537 základných skupín pri
  meraní nad `competitions`), čo je po fallbackoch −6 skupín celoslovensky. **Žiadna skutočná
  liga sa nestratila** — zachytené boli baráže (Niké liga, ObFZ Michalovce), „O Majstra regiónu
  III. ligy Východ“ U13 a U15, finálový turnaj prípraviek, nadstavba o 5.–8. miesto, KFL
  nadstavba, superpoháre a osemfinále/štvrťfinále Slovenského pohára SF.
  Kontrola všetkých **609 profilov** prešla bez chyby a bez varovania.
- **Výstupná schéma:** `kpi.skupiny`, `kategorie.*.skupiny`, `urovne.*.skupiny`,
  `pohlavie.*.skupiny`, `sutazeUroven[].skupiny`; v porovnaniach `skupiny`, `skupinyPohlavie`,
  `urovneSkupiny`; v súhrne listy `sunburstSutaze` (`skupiny`, `skupinyPohlavie`).
- **Frontend:** prepínač v KPI karte „Súťaže“, pyramíde súťaží, oboch heatmapách úrovní,
  sunburste súťaží, radare aj grafe vývoja v Porovnaniach a v tabuľke zväzov.
  `METRIKA_DEFAULT` a spoločné popisy sú v `web/src/lib/urovneTypy.ts` — jedno miesto pravdy.
- **Tabuľka zväzov má prepínač, nie dva stĺpce vedľa seba.** Je to zoraditeľný rebríček; dva
  stĺpce by pozývali zoradiť podľa „Súťaže“, čo dáva poradie, ktoré medzi zväzmi neplatí.
- Vyžiadať od Sportnetu **explicitný príznak typu časti** v `competitions.parts[]` — potom
  odhad odpadá. Zapísané v [TODO](../TODO.md).
- Vzor `o pohar` bol zámerne vyradený zo sita názvov: zachytával legitímne paralelné turnajové
  skupiny („Halový turnaj O pohár predsedu ObFZ Trnava sk. A / sk. B“).
- Verejné vysvetlenie pojmov je na stránke **Dokumentácia**, kapitola „Súťaž a súťažná skupina
  — dve rôzne veci“.
