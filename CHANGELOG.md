# Changelog

Zmeny portálu štatistika.futbalsfz.sk, ktoré menia **čísla alebo ich význam**. Týždenné
aktualizácie dát sa sem nepíšu (sú v histórii gitu ako „Tyzdenna aktualizacia statistik“).
Formát podľa [Keep a Changelog](https://keepachangelog.com/sk/1.1.0/).

## [2026-10-14] — Plán B

### Pridané
- **Unikátne osoby po vekových skupinách** (`osoby.<rola>.poSkupinach`: Dospelí, Dorast,
  Žiaci, Prípravky) a **v mládeži spolu** (`osoby.<rola>.mladez`). Osoba, ktorá hrala súťaže
  viacerých vekových úrovní v rámci skupiny (napr. U13 aj U15), sa v skupine ráta raz.
  Profily zväzov, klubov a porovnanie klubov zobrazujú skupiny namiesto súčtu úrovní.

### Zmenené
- **Index klubu, zložka B „deti v mládeži“** počíta unikátne deti (`hraci.mladez`), nie súčet
  po vekových úrovniach. 2025/2026: 168 z 1 410 klubov klesá o 3–7 bodov, ostatné bez zmeny;
  priemer 58,8 → 58,3, medián 66 → 65. Všetky sezóny prepočítané.

## [2026-10-14]

### Opravené
- **Osoby po vekových úrovniach súťaží** (`osoby.hraci|treneri|realizacnyTim.poKategorii`).
  Fallback kategórie z časti súťaže v `etl/pipelines` nikdy nefungoval — rozpad bol pred
  sezónou 2024/2025 **prázdny** a v novších sezónach neúplný (VsFZ 2025/2026: súčet 8 790
  < 9 283 unikátnych hráčov). Rozhodcovia, delegáti a personál zasiahnutí neboli; počty
  unikátnych osôb (`unikatni`) sa nemenia.
- **Pokrytie divákov** (`methodologyFlags.divaciPokrytie`) sa počíta na rovnakej báze ako
  počet odohraných zápasov — administratívna kontumácia s explicitnou nulou divákov ho dvíhala
  nad 100 % (ObFZ Veľký Krtíš 2025/2026: 100,5 %; v histórii 16 súborov). Platí pre zväzy aj kluby.

### Zmenené
- Validátor: NEURCENE (časť súťaže bez pohlavia) zo súťaží v číselníku
  `etl/config/vylucene_sutaze.json` je poznámka, nie anomália (školský turnaj „U15 mix“ VsFZ).
- Texty a metodika: osoby v profile sú zaradené podľa **vekovej úrovne súťaže**, nie podľa
  veku osoby a nejde o počet štartov (metodika, „Tri pohľady na osoby“).
- Všetky sezóny 2012/2013 – 2025/2026 prepočítané opraveným ETL (zväzy, futsal, kluby,
  agregáty). Rozpad osôb po kategóriách sa na profiloch historických sezón zobrazuje prvýkrát.
