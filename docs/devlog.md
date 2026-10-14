# Devlog

Chronologický záznam práce na projekte (čo sa robilo, prečo, čo nevyšlo). Najnovšie hore.
Čísla, ktoré sa menia na webe, sú v [CHANGELOG.md](../CHANGELOG.md), krátkodobé kroky v
[NEXT.md](../NEXT.md).

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
