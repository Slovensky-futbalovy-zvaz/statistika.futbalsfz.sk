# statistika.futbalsfz.sk

Verejný štatistický portál slovenského futbalu — **[statistika.futbalsfz.sk](https://statistika.futbalsfz.sk)**.

Interaktívna mapa všetkých troch úrovní futbalovej pyramídy (SFZ → 4 RFZ → 38 ObFZ), sezónne
štatistiky s drill-down na vekové úrovne, profily 2 000+ klubov, porovnávanie zväzov, demografia
osôb vo futbale a trendy v čase — vek hráčov v súťažiach dospelých a Index klubu.

> **Stav:** portál je **verejne v prevádzke**. Posledný build 24 191 stránok, dátová základňa
> pokrýva sezóny 2012/2013 – 2026/2027 a všetkých 43 zväzov.
> Otvorené úlohy a známe obmedzenia: [docs/TODO.md](docs/TODO.md).

## Ako to funguje

```
sportnet.online MongoDB („sutaze“) ──► ETL (Python) ──► statické JSON v data/ ──► Astro SSG ──► Vercel
```

Verejný web **nemá žiadny prístup k databáze ani interným API** — publikujú sa výhradne
agregované dáta, ktoré ETL vopred zapíše do `data/`. Zdôvodnenie v
[ADR-0001](docs/adr/0001-architektura-predgenerovane-json.md).

Nasadenie beží na Verceli, spúšťa sa pushom do `main`
([ADR-0006](docs/adr/0006-hosting-vercel-namiesto-cloudflare.md); pôvodné rozhodnutie o
Cloudflare Pages v ADR-0003 už v časti „web + CDN“ neplatí). Build trvá zhruba 10–12 minút
lokálne a 17–20 minút na Verceli.

> **Pozor pri commitoch:** commity s autorom `@futbalsfz.sk` Vercel **blokuje**. Používa sa
> autor `jan.letko@icloud.com`.

## Štruktúra repozitára

| Priečinok | Obsah |
|---|---|
| `etl/` | ETL pipeline — agregácie zo Sportnet DB do publikovateľných JSON. Vlastné [README](etl/README.md) |
| `data/` | **Publikované dáta** — 28 000+ JSON súborov, ktoré číta web pri builde (nie vzorky) |
| `web/` | Frontend — Astro 5 (SSG) + React islands, TypeScript, Tailwind |
| `docs/` | Projektová dokumentácia, metodika, záznamy rozhodnutí (ADR). [Rozcestník](docs/README.md) |
| `deploy/` | Docker prostredie pre týždenný beh ETL na Synology NAS |
| `.github/workflows/` | `tyzdenna.yml` — týždenná aktualizácia aktuálnej sezóny |

### Čo je v `data/`

| Priečinok | Súborov | Obsah |
|---|---|---|
| `zvaz/` | 601 | Profil zväzu za sezónu (43 zväzov × sezóny × odvetvia) |
| `klub/` | 21 300 | Profil klubu za sezónu |
| `vek/`, `vek-klub/` | 43 + 2 076 | Vekové histogramy pre stránku Trendy |
| `index-klubu/` | 2 076 | Index klubu po sezónach + celoslovenský prehľad `index-klubu.json` |
| `demografia/`, `demografia-klub/` | 43 + 2 123 | Rok narodenia × pohlavie × rola |
| `porovnania/` | 45 | Porovnávacie tabuľky zväzov a klubov |
| `sumar/` | 16 | Celoslovenský súhrn za sezónu |
| `projekty/` | 4 | Grassroots projekty (Dajme spolu gól, Disney, McDonald's) |

## Stránky portálu

Prehľad (`/`), profily zväzov (`/zvaz/…`), kluby (`/kluby`, `/klub/…`), porovnania
(`/porovnania/…`), demografia (`/demografia`), **Trendy** (`/trendy` — vek hráčov, starnúce
kluby, Index klubu), projekty (`/projekty`) a verejná
[dokumentácia metodiky](https://statistika.futbalsfz.sk/dokumentacia) (`/dokumentacia`).

## Kľúčové dokumenty

- [Metodika a poznatky o dátach](docs/metodika.md) — **najdôležitejší dokument v repe**;
  obsahuje overené pravidlá výpočtov, pasce v dátach a namerané čísla
- [TODO — otvorené úlohy a obmedzenia](docs/TODO.md)
- [Rozcestník dokumentácie](docs/README.md)
- [Projektový plán a koncept](docs/projektovy-plan.md)
  ([docx verzia](docs/Statistika-futbalsfz-sk_Projektovy-plan-a-koncept_v1.0.docx))
- [Report kvality dát](docs/report-kvality-dat.md)
- [Záznamy rozhodnutí (ADR)](docs/adr/) — ADR-0001 až ADR-0008

## Vývoj

```bash
# web
cd web && pnpm install
pnpm dev                 # dev server na http://localhost:4321
pnpm build               # produkčný build (24 000+ stránok, ~10–12 min)
npx tsc --noEmit         # typová kontrola

# ETL — vyžaduje prístup do MongoDB (read-only stačí)
export MONGODB_URI="mongodb://…"
python etl/run.py --zvaz obfz-nitra --sezona 2025/2026
```

Podrobnosti o jednotlivých ETL skriptoch a poradí behov: [etl/README.md](etl/README.md).

## Kontakt

Produktový vlastník: **Ján Letko** (jan.letko@futbalsfz.sk)

---
© Slovenský futbalový zväz · Zdroj dát: platforma sportnet.online
