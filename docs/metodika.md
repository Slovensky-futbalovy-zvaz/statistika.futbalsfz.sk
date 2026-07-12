# Metodika a poznatky o dátach Sportnet

Zhrnutie overených poznatkov z realizácie infografík ObFZ Nitra a ZsFZ a z overovania databázy (júl 2026). Tento dokument je záväzný pre implementáciu ETL.

## Zdroj dát

- MongoDB, databáza **`sutaze`**, kolekcie **`matches`** a **`competitions`**.
- Alternatívne API: Súťaže v2 (`sutaze.sportnet.online/api/v2`), CRM (`api.sportnet.online/v1`) — rozhodnutie o prístupe ETL je otvorená otázka O2.

## Základné pravidlá

### Dátový model súťaže

- **Jedinečný identifikátor súťaže** je kombinácia: **Úroveň súťaže** (liga; 1. liga je najvyššia) + **Veková úroveň** (Ux; U19 je posledná oficiálna, nad ňou len „Dospelí“) + **Pohlavie** (muži, ženy) + **Sezóna** (ročník, 1.7.–30.6., formát „2025/2026“).
- **Názvy súťaží sú nespoľahlivé** — menia sa podľa partnerov v príslušnom ročníku. Nikdy nie sú identifikátorom.
- Súťaž obsahuje vždy minimálne jednu **Časť súťaže** (napr. Základná časť, Skupina o udržanie, Skupina o postup) — pri agregáciách zápasov pozor na dvojité započítanie, zápas patrí vždy práve jednej časti.
- SFZ je **vlastník** všetkých súťaží (~400 na sezónu); riadenie deleguje na RFZ a ObFZ — tie sú „riadiaci zväz súťaže“ (v dátach appSpace).

### Identifikácia zväzu — appSpace

- `appSpace` je kritický identifikátor riadiaceho zväzu; **nikdy sa nehádaj z názvu**, vždy sa overuje dotazom.
- ObFZ: typicky `obfz-<mesto>.futbalnet.sk` (napr. `obfz-nitra.futbalnet.sk`).
- RFZ: krátke identifikátory ako `ZsFZ` (bez domény) — úplne iný formát než ObFZ.
- `ownerPPO` je takmer vždy `futbalsfz.sk` (SFZ vlastní všetky súťaže) — na rozlíšenie zväzov nepoužiteľné.
- ETL musí obsahovať **overený register všetkých 43 zväzov** (SFZ + 4 RFZ + 38 ObFZ) s ich appSpace.
- **SFZ pohľad zahŕňa dva appSpace**: `futbalsfz.sk` a `ulk.futbalnet.sk` (Únia ligových klubov — Niké liga, najvyššia súťaž mužov; riadenie delegované na ULK, ale patrí do SFZ úrovne pyramídy). Rozhodnutie: Ján Letko, 12. 7. 2026.

### Odohraný zápas

- Do štatistík sa počítajú len zápasy s `closed: true` (uzavreté/uzatvorené).

### Premenovávanie súťaží počas sezóny (rebranding pasca)

- Súťaže sa vedia premenovať v priebehu ročníka (sponzorské názvy) — overený prípad v ObFZ Nitra („VIII. liga - A“ → „VIII. liga A - TAJBI sport“).
- Pred zoskupovaním podľa `competition.name` vždy skontrolovať distinct názvy a varianty **explicitne zlúčiť** cez `$in`.
- **Nikdy nepoužívať regex na názvy súťaží** — falošné zhody (regex „A“ matchuje „TAJBI“).

### Vekové kategórie

- Spoľahlivý zdroj: `teams[].ageCategory` s hodnotami `U07`, `U09`, `U11`, `U13`, `U15`, `U17`, `U19`, `ADULTS`.
- Mapovanie do 4 hlavných kategórií: Dospelí (ADULTS), Dorastenci (U17, U19), Žiaci (U12–U15), Prípravky (U07–U11).
- Dorastenci sú na RFZ/SFZ úrovni nenulová kategória (na rozdiel od niektorých ObFZ) — nulu nikdy nepredpokladať, vždy overiť.
- Na webe sa zobrazujú len vekové úrovne, ktoré mali v danom ročníku aspoň jeden uzavretý zápas.

### Osoby

- **Hráči:** `nominations[].athletes[].sportnetUser._id`, väzba na tím (a kategóriu) cez `nominations[].teamId == teams[]._id`.
- **Tréneri:** `nominations[].crew[].position` ∈ {`coach`, `assist_coach`, `coach_goalkeepers`, `conditioning_coach`}. **Pozor:** `manager` je vedúci družstva, nie tréner.
- **Rozhodcovia:** `managers[].type.label` ∈ {`Rozhodca`, `1. asistent rozhodcu`, `2. asistent rozhodcu`, `Náhradný rozhodca`} — presné slovenské názvy overiť pre každý zväz.
- **Delegáti:** `managers[].type.label == "Delegát stretnutia"` (presný text overiť).
- Kategória zápasu pre rozhodcov/delegátov: `$arrayElemAt: ["$teams.ageCategory", 0]`.
- **Dvojité počítanie:** tá istá osoba pôsobí vo viacerých kategóriách/roliach; súčet po kategóriách je vyšší než počet unikátnych osôb. Publikujú sa **oba pohľady s explicitnou poznámkou** — inak to vyzerá ako chyba.
- Nižšie kategórie (prípravky, mladší žiaci) často nemajú rozhodcov/delegátov v systéme — reálny stav, nie chyba dát.

### Ostatné metriky

- Góly a karty: `protocol.events` (eventType: `goal`, `yellow_card`, `red_card`).
- Diváci: `protocol.audience` — pole nie je vyplnené pri všetkých zápasoch; publikovať vždy spolu s percentom pokrytia.
- Družstvo = unikátne `teams[].organization.name` s aspoň jedným uzavretým zápasom (nie registrácie na začiatku sezóny — uviesť v poznámke).

## Overené fakty o rozsahu dát (12. 7. 2026)

| Fakt | Hodnota |
|---|---|
| Najstaršia plnohodnotná sezóna | 2012/2013 (117 súťaží) |
| Plné pokrytie od | 2013/2014 (313 súťaží), od 2014/2015 stabilne 400–460 súťaží/sezóna |
| Kontrola hĺbky: 2016/2017 | 57 399 uzavretých zápasov, 100 % s nomináciami |

## Známe problémy kvality dát

1. **Nekonzistentné `season.name`:** varianty „2024/2025“, „2024 / 2025“, „2024/25“, „24/25“, samostatné roky („2016“…), aj testovacie hodnoty („Test“, „KLF“…). ETL musí mať normalizačnú mapu sezón; nenormalizovateľné záznamy sa logujú a vylučujú.
2. **Staršie sezóny (pred ~2016):** kvalita vyplnenia protokolov (karty, diváci) sa musí zmerať vo F1; ukazovatele s nedostatočným pokrytím sa za dané sezóny **nezobrazia, nie odhadnú**.
3. **Zmena schémy DB:** ETL beh obsahuje validácie (počty, povinné polia) a alerting pri anomáliách.

## GDPR zásady

- Publikujú sa výhradne agregované počty, žiadne menné zoznamy ani identifikátory osôb.
- Agregáty s hodnotou pod prahom (návrh: < 3) sa posúdia z hľadiska nepriamej identifikovateľnosti (otvorená otázka O5, DPO SFZ).
