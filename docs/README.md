# Dokumentácia — rozcestník

Čo je ktorý dokument a kedy ho otvoriť. Dokumenty, ktoré už doslúžili, sú v
[`archiv/`](archiv/) a nie sú tu uvedené.

## Začni tu

| Dokument | Kedy ho potrebuješ |
|---|---|
| **[metodika.md](metodika.md)** | **Najdôležitejší dokument v repe.** Ako sa čo počíta, aké pasce sú v dátach, čo sa zmerať nedá a namerané čísla, o ktoré sa opierajú rozhodnutia. Otvor ho vždy, keď ideš robiť čokoľvek s dátami |
| [TODO.md](TODO.md) | Čo je otvorené a aké sú známe obmedzenia |
| [../README.md](../README.md) | Prehľad projektu, architektúra, štruktúra repa |
| [../etl/README.md](../etl/README.md) | Čo ktorý ETL skript robí a v akom poradí sa púšťajú |

## Rozhodnutia (ADR)

Záznamy architektonických rozhodnutí — **prečo** je niečo tak, ako je. Ak sa rozhodnutie
zmenilo, starší ADR sa nemaže; dostane do hlavičky poznámku, ktorý ADR ho nahradil.

| ADR | O čom |
|---|---|
| [0001](adr/0001-architektura-predgenerovane-json.md) | Predgenerované JSON namiesto živého API — **základ celej architektúry** |
| [0002](adr/0002-etl-priamo-mongodb.md) | ETL číta priamo MongoDB (read-only) |
| [0003](adr/0003-hosting-cloudflare-pages.md) | Hosting na Cloudflare Pages — časť „web + CDN“ **nahradená ADR-0006** |
| [0004](adr/0004-index-pre-etl-agregacie.md) | Cielený index na `matches` pre ETL agregácie |
| [0005](adr/0005-frontend-stack-f2.md) | Frontend stack — Astro + ECharts + Tailwind |
| [0006](adr/0006-hosting-vercel-namiesto-cloudflare.md) | **Hosting na Verceli**, DNS zostáva na WebSupport |
| [0007](adr/0007-react-islands-redizajn.md) | React islands namiesto vanilla `.astro` skriptov |
| [0008](adr/0008-odohrane-zapasy-bez-administrativnych.md) | „Odohraté zápasy“ bez administratívnych kontumácií a odstúpení |

## Projekt a dáta

| Dokument | O čom |
|---|---|
| [projektovy-plan.md](projektovy-plan.md) | Pôvodný koncept, fázy F0–F6, rozhodnutia O1–O7. Historický kontext, ale rozhodnutia O1–O7 stále platia ([docx](Statistika-futbalsfz-sk_Projektovy-plan-a-koncept_v1.0.docx)) |
| [report-kvality-dat.md](report-kvality-dat.md) | Dátový audit — čo je v databáze v poriadku a čo nie, nájdené anomálie |
| [projekty-datove-zdroje.md](projekty-datove-zdroje.md) | Odkiaľ pochádzajú dáta o grassroots projektoch (nie z `matches`) |
| [sportnet-nahlasenie-divaci.md](sportnet-nahlasenie-divaci.md) | Draft nahlásenia chybného záznamu divákov — **čaká na odoslanie** |

## Prevádzka

| Dokument | O čom |
|---|---|
| [tyzdenna-aktualizacia.md](tyzdenna-aktualizacia.md) | Ako funguje týždenný prepočet aktuálnej sezóny |
| [synology-tyzdenna.md](synology-tyzdenna.md) | Beh ETL v Dockeri na Synology NAS ([deploy/synology/](../deploy/synology/)) |
| [seo-search-console.md](seo-search-console.md) | Sitemap, indexovanie, Search Console |

## Ostatné priečinky

- **[brand/](brand/)** — dizajn manuál SFZ (PDF), zdroj brand tokenov
- **[social/](social/)** — podklady pre príspevky na sociálne siete (carousel, PNG, texty)
- **[archiv/](archiv/)** — dokumenty, ktoré už doslúžili; pozri [archiv/README.md](archiv/README.md)
