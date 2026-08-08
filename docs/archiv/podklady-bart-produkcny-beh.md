# Podklady pre Bart.sk — produkčný beh ETL

Pripravené 13. 7. 2026 ako podklad na dohodu so Sportnet/Bart.sk. Nadväzuje na ADR-0002 (ETL priamo MongoDB, read-only) a ADR-0003 (hosting Cloudflare Pages, ETL cron u Sportnet/Bart.sk).

## Čo od Bart.sk potrebujeme

### 1. Read-only DB účet pre produkčný ETL

| Parameter | Požiadavka |
|---|---|
| Cluster | MongoDB Atlas `sportnet1` (rovnaký, na aký smeruje dnešný dočasný účet) |
| Databázy a práva | `sutaze`: **read** (kolekcie `matches`, `competitions`, `competitions_groups`); `sportnet`: **read** (kolekcia `users` — len polia `birthdate`, `sex` pre agregovanú demografiu, viď GDPR poznámka) |
| Účel | výhradne agregačné pipelines (`$match`/`$group`/`$facet`), `allowDiskUse`, `maxTimeMS` 120 s, beh po jednej sezóne |
| Sieť | prístup z infraštruktúry, kde pobeží cron (IP allowlist podľa umiestnenia) |
| Správa | credentials mimo repa (secret manager / env), rotácia podľa štandardu Bart.sk |

GDPR poznámka: z DB odchádzajú výhradne agregované počty (rok narodenia × pohlavie × rola × zväz × sezóna); žiadne menné zoznamy ani identifikátory (metodika, O5 — publicistická licencia).

### 2. Denný cron

- Beh: `python etl/run.py --zvaz {id} --sezona {aktuálna}` pre 43 zväzov + `etl/demografia.py` (týždenne postačuje); len aktuálna sezóna — historické sa negenerujú opakovane (ADR-0003).
- Odporúčaný čas: v noci (napr. 03:00), po uzávierkach zápisov.
- Runtime: Python 3.11+ s balíkmi `pymongo`, `certifi` (žiadne ďalšie závislosti).
- Výstup: JSON súbory v `data/` → commit + push do GitHub repa `Slovensky-futbalovy-zvaz/statistika.futbalsfz.sk` (deploy key / GitHub App s právom push na `main`, prípadne PR podľa preferencie security).
- Logy: stdout/stderr do štandardného log systému Bart.sk; ETL loguje anomálie ako WARNING a vracia nenulový exit kód pri nezrovnalostiach počtov — na to naviazať alerting (e-mail na jan.letko@futbalsfz.sk postačuje).

### 3. Security review deploy pipeline

- Tok: cron (Bart.sk) → git push → GitHub → Cloudflare Pages build (SSG) → statika na `statistika.futbalsfz.sk`.
- Verejný web nemá žiadny prístup k DB ani interným API (ADR-0001); publikujú sa výhradne agregáty.
- Na potvrdenie od Bart.sk: umiestnenie cronu, formát credentials, notifikácia o zmenách schémy DB (ETL má validácie, ale heads-up pri migráciách schémy predíde výpadku dát).

## Otvorené body na dohodu

1. Kde presne cron pobeží (server/kontajner Bart.sk vs. SFZ) a kto ho prevádzkuje.
2. Mechanizmus push do GitHubu (deploy key vs. GitHub App; priamo `main` vs. PR).
3. Kontaktná osoba Bart.sk pre schému DB (notifikácie zmien) a pre incidenty.
4. Proces opravy chybných dát v zdrojovej DB (viď docs/sportnet-nahlasenie-divaci.md).

## Stav

- [ ] Odoslané Bart.sk (dátum):
- [ ] Účet zriadený:
- [ ] Cron nasadený:
- [ ] Security review deploy pipeline:
