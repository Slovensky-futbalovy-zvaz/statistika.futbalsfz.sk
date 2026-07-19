# Nasadenie na Cloudflare Pages — postup (ADR-0003)

**Dátum:** 19. 7. 2026 · **Vykonáva:** Ján Letko (PO) · **Stav:** pripravené na realizáciu

Realizuje rozhodnutie ADR-0003: web + CDN na Cloudflare Pages, deploy z GitHub repa pri pushi na `main`, vlastná doména `statistika.futbalsfz.sk`.

## Predpoklady (všetky splnené v repe)

- `web/.node-version` = `24` — Pages build image v3 ju automaticky rešpektuje.
- `web/package.json` → `"packageManager": "pnpm@9.15.0"` — Pages (corepack) automaticky použije pnpm v tejto verzii.
- `web/public/_headers` — cache pravidlá (immutable `/_astro/*`, 1 h HTML) sa nasadia automaticky s buildom.
- Build číta dáta z `../data` a `../etl/config` — Pages klonuje **celé repo**, „Root directory“ iba mení pracovný adresár buildu, súbory mimo neho ostávajú dostupné. Funguje bez úprav.
- Lokálne overený build: **657 stránok** (19. 7. 2026).

## Krok 1 — vytvorenie Pages projektu

1. Prihlás sa na [dash.cloudflare.com](https://dash.cloudflare.com) → účet, kde je zóna `futbalsfz.sk`.
2. **Workers & Pages** → **Create** → záložka **Pages** → **Connect to Git**.
3. Autorizuj **Cloudflare Pages GitHub App** pre organizáciu `Slovensky-futbalovy-zvaz` a povoľ prístup k repu `statistika.futbalsfz.sk` (repo je private — prístup musí schváliť admin organizácie; stačí „Only select repositories“).
4. Vyber repo `statistika.futbalsfz.sk` → **Begin setup**.

## Krok 2 — build nastavenia

| Pole | Hodnota |
|---|---|
| Project name | `statistika-futbalsfz` (z toho vznikne `statistika-futbalsfz.pages.dev`) |
| Production branch | `main` |
| Framework preset | **Astro** |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| **Root directory** | `web` |
| Environment variables | žiadne netreba (Node rieši `.node-version`, pnpm rieši `packageManager`) |

Klikni **Save and Deploy**. Prvý build trvá ~2–4 min (inštalácia + 657 stránok).

## Krok 3 — overenie na *.pages.dev

Po dobehnutí deployu skontroluj na `https://statistika-futbalsfz.pages.dev`:

- `/` — mapa SR, klik na zväz funguje,
- `/zvaz/sfz` — profil vrát. demografie a vekovej pyramídy,
- `/zvaz/sfz/futsal/2025-2026` — futsalová sezónna stránka + prepínač odvetvia,
- `/porovnanie/obfz/2025-2026` — tabuľka, radenie, radar (výber 2–5 zväzov),
- odozva hlavičiek: `curl -sI https://…pages.dev/_astro/<súbor>` → `cache-control: public, max-age=31536000, immutable`.

## Krok 4 — vlastná doména

1. V projekte: **Custom domains** → **Set up a custom domain** → zadaj `statistika.futbalsfz.sk`.
2. Zóna `futbalsfz.sk` je v tom istom Cloudflare účte → CNAME záznam sa vytvorí **automaticky**, certifikát vydá Cloudflare (pár minút, stav „Active“).
3. Over `https://statistika.futbalsfz.sk`.

## Krok 5 — po nasadení

- Každý push na `main` (vrát. denných ETL commitov dát — ADR-0003) spustí automatický build a deploy.
- Odporúčané nastavenia projektu: **Settings → Builds & deployments** — Production branch `main`; Preview deployments podľa potreby (pre PR vetvy).
- Zapísať výsledok (URL, dátum) do `docs/TODO.md` a odškrtnúť úlohu „napojiť Cloudflare Pages“.
- Nadväzuje (ADR-0003): security review pipeline s Bart.sk a read-only DB účet pre produkčný ETL cron.

## Riešenie problémov

- **Build zlyhá na verzii Node/pnpm:** over, že „Build system version“ projektu je **v3** (Settings → Build & deployments); staršie verzie majú predvolený Node 18.
- **`ENOENT ../data`:** znamená, že Root directory nie je `web` — build sa musí spúšťať z `web/` (nie z koreňa repa, nie z `web/dist`).
- **GitHub repo nevidno v zozname:** GitHub App nemá prístup k private repu — v GitHub org Settings → GitHub Apps → Cloudflare Pages → pridať repo.
