# Devlog

Chronologický záznam práce na projekte (čo sa robilo, prečo, čo nevyšlo). Najnovšie hore.
Čísla, ktoré sa menia na webe, sú v [CHANGELOG.md](../CHANGELOG.md), krátkodobé kroky v
[NEXT.md](../NEXT.md).

## 2026-10-21 — týždenný beh: prvý úplný beh po oprave VŠ ligy vo futsale

- Automatický beh na Synology (03:00–04:01) prepočítal jedinú sezónu so zmeneným odtlačkom —
  2026/2027 (rozdiel oproti minulému týždňu: +8 300 zápasov, +39 895 skóre, +598 786 divákov,
  +208 kontumovaných). 43/43 zväzov OK, **0 anomálií** v dávkovom behu, commit `c77b4b3ddd`
  pushnutý do main, Vercel deployment READY, na webe sedí dátum aktualizácie 21. 10. 2026, 03:19.
- **Vysokoškolská liga vo futsale je vyriešená.** Behy 7. a 14. 10. boli kvôli nej „ČIASTOČNÉ“;
  tento beh prešiel celý (`DOKONCENE bez chyb`). Do futsalu SFZ 2026/2027 pribudlo 6 zápasov
  (32 → 38) a dva nové kluby (fakultné družstvá UK a STU).
- Jediné upozornenie behu: futsal SFZ 2026/2027 — pokrytie divákov 76,3 % (prah 80 %).
  Nie je to chyba ETL. Presne 29 z 38 zápasov má vyplnených divákov a tých 9 bez údaja je
  práve 9 zápasov v úrovni `NEURCENE` — teda zápasy VŠ ligy. Oprava v Sportnete doplnila
  `rules.category` a `rules.gender`, ale **nie úroveň súťaže**, takže VŠ liga visí mimo pyramídy
  a zároveň si neeviduje divákov. Pri 38 zápasoch jeden protokol hýbe pokrytím o 2,6 bodu,
  prah 80 % je kalibrovaný na plné sezóny.
- Kontext k pokrytiu divákov vo futsale naprieč sezónami: 2014/15–2021/22 100 %, 2023/24 99,6 %,
  2024/25 97,6 %, 2025/26 90,9 %. Medzisezónny pokles stojí za sledovanie — ak 2026/2027
  skončí pod 90 %, osloviť futsalový úsek.
- Lokálne repo bolo pred pullom 1 commit pozadu a nieslo 2 124 nezacommitovaných artefaktov
  v `data/` z testovacieho behu 15. 10. (`index-klubu` 2 059, `porovnania` 45, `sumar` 15).
  Po dohode zahodené (`git checkout -- data/`), Synology beh ich prepísal novšími.

## 2026-10-14 — menšie úvodná stránka, /trendy a profily zväzov

- Veková pyramída (`AgePyramid`) dostáva v Prehľade, profile sezóny a na stránkach klubu len
  zobrazenú sezónu (`demoPreSezonu` v `lib/data.ts`), nie celú históriu. Stránka demografie ostáva
  bez zmeny (prepína sezóny v ostrove).
- `/trendy`: tabuľka indexu klubov nesie zväz priamo v riadku (odpadla mapa `klubZvaz`), odstúpené
  kluby idú ako kompaktný reťazec namiesto poľa objektov.
- Overené na Vercel preview na 375 px: text pyramídy na `/`, `/zvaz/bfz`, `/zvaz/bfz/2022-2023`,
  `/zvaz/obfz-nitra/2019-2020` a `/demografia/bfz` je zhodný s produkciou (porovnanie hashom),
  prepínanie rolí, index klubov (hľadanie, filter zväzu, stránkovanie) a filtre odstúpených klubov
  dávajú rovnaké výsledky ako produkcia, bez horizontálneho scrollu.
- Veľkosti HTML (bez kompresie): úvod 676 → 459 kB, `/trendy` 985 → 660 kB, `/zvaz/bfz` 402 → 268 kB,
  `/zvaz/bfz/2022-2023` 326 → 192 kB.

## 2026-10-14 — porovnanie zväzov: graf vývoja mimo HTML

- Graf „Vývoj v čase“ v porovnaní zväzov niesol dáta všetkých sezón (0,98 MB) v každej stránke
  `/porovnania/{uroven}/{sezona}`. Hodnoty sú teraz v `/data/porovnania-vyvoj/{obfz,rfz}.json`
  (ObFZ ~100 kB po kompresii) a komponent si ich stiahne cez IntersectionObserver až pri
  priblížení k sekcii. Porovnanie ObFZ 1,71 MB → 0,45 MB.
- Overené na Vercel preview na 375 px (radar, oneskorené stiahnutie, čiarový graf, prepnutie
  metriky, RFZ aj /porovnania). Lokálny `astro dev` sa na overenie nedal použiť: radar padá aj na
  pôvodnom kóde (zmiešané verzie predoptimalizovaných balíkov Vite) — treba preskúmať lokálne
  `node_modules` (pravdepodobne poškodené iCloudom pred presunom repa).

## 2026-10-14 — výber klubu bez zoznamu v HTML, revízia TODO

- Každá stránka klubu (2 200+ klubov × sezóny) niesla v HTML celý zoznam klubov pre výber
  (`KlubPicker`, 1,08 MB z 1,18 MB stránky). Zoznam je teraz statický `/data/kluby-zoznam.json`
  (kompaktné riadky `[id, názov, zväz, posledná sezóna]`, ~190 kB), ktorý si výber stiahne až
  pri otvorení (pri prejdení myšou vopred). Overené cez `astro dev` na 375 px vrátane prechodu
  na iný klub; `astro check` 0 chýb.
- TODO bolo zastarané: filter neregulárnych súťaží v `trendy.py`/`demografia_klub.py` je od
  19. 8., sekcia Zánik klubov na /trendy od 15. 8., ECharts už ide cez `echarts/core`.
  Karty a góly prípraviek sa zobrazujú bez výhrady — rozhodnutie zapísané do metodiky.

## 2026-10-14 — upratovanie vetiev

Zmazané zlúčené vetvy `fix/osoby-kategorie-pokrytie` a `feat/osoby-skupiny` (lokálne aj na
GitHube) a súbory `_tmp_*` z 17. – 19. 8. (pomocné skripty k NAS a deploy kľúču, bez tajomstiev,
s cestami na starú polohu repa).

## 2026-10-14 — typové chyby webu a dokumentácia týždenného behu

- `astro check`: 41 chýb → 0. Príčina: `getStaticPaths` typovaný ako `GetStaticPaths`, takže
  `Astro.params` mal typ `string | number`; v 9 stránkach `Astro.params as Record<string, string>`.
  Bez vplyvu na výstup (stránky overené cez `astro dev`).
- `docs/tyzdenna-aktualizacia.md`: produkčný beh je na Synology v stredu o 03:00, cron GitHub
  Actions je vypnutý (dokument predtým uvádzal pondelok 03:00 UTC).

## 2026-10-14 — päta: dátum poslednej aktualizácie

V päte každej stránky (`web/src/layouts/Base.astro`) pribudlo „Dátum poslednej aktualizácie“
z `data/index.json` → `generatedAt` (čas v Bratislave, formát „14. 10. 2026, 14:58“) a veta
„Portál sa aktualizuje každú stredu ráno.“ (týždenný beh na Synology, streda 03:00).
Overené lokálne cez `astro dev` na 375 px.

## 2026-10-14 — oprava osôb, Plán B, nahlásenie do Sportnetu, presun repa

**Podnet:** týždenný výpis zo Synology (6. 10.) s anomáliami — súčet osôb po kategóriách
menší ako unikátni, pokrytie divákov > 100 %, NEURCENE v školskom turnaji VsFZ.

**Oprava osôb a pokrytia (F1–F7, `main` cce18c3):**
- `etl/pipelines`: fallback kategórie z časti súťaže (`catFb`) sa počítal až po `$project`,
  ktorý `competitionPart` zahodil — rozpad `poKategorii` bol pred 2024/2025 prázdny.
- Pokrytie divákov na báze odohraných zápasov (bez administratívnych kontumácií), zväzy aj kluby.
- Validátor: NEURCENE zo súťaží v `vylucene_sutaze.json` je poznámka, nie anomália.
- Texty a metodika „Tri pohľady na osoby“ (veková úroveň súťaže ≠ vek osoby ≠ štarty).

**Plán B (`main` f1bbd63):** `osoby.<rola>.poSkupinach` (Dospelí/Dorast/Žiaci/Prípravky)
a `mladez` ako unikátne osoby; web ich zobrazuje, Index klubu zložka B počíta unikátne deti.
Validátor max ≤ skupina ≤ súčet: 10 431 kontrol bez porušenia. Index klubu 2025/2026:
168 z 1 410 klubov −3 až −7 b., schválené pred publikovaním. Produkcia overená na 375 px.

**Čo nevyšlo a prečo:**
- Plný prepočet visel na ZsFZ/SsFZ 2021/2022+ — Atlas volil zlý plán; vyriešené `--hint`.
- Push 25 tis. dátových súborov padol na HTTP 408 — `http.postBuffer`.
- Git z VM (Cowork) necháva `.lock` súbory — git spúšťať natívne na Macu.
- Týždenný beh v októbri neprepočítava 2025/2026 (fingerprint) — prepočítané ručne.

**Sportnet:** zoznam 40 častí súťaží / 518 zápasov bez vekovej kategórie (XLSX) odovzdaný
na nahlásenie; Vysokoškolská liga vo futsale 2026/2027 nahlasuje Ján Letko.

**Upratovanie:** zmazané pomocné súbory, worktree, 1 733 konfliktných kópií iCloudu a
`web/dist` (25 GB); repo presunuté z `~/Documents/GitHub` do `~/GitHub`, `.venv` nanovo.
