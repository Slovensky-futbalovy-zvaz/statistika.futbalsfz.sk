# Nasadenie na Cloudflare — postup (ADR-0003)

**Dátum:** 19. 7. 2026 · **Vykonáva:** Ján Letko (PO) · **Stav:** pripravené na realizáciu

Realizuje rozhodnutie ADR-0003: web + CDN na Cloudflare, deploy z GitHub repa pri pushi na `main`, vlastná doména `statistika.futbalsfz.sk`.

> **Aktualizácia 19. 7. 2026:** Cloudflare medzičasom zlúčil Pages do **Workers** — nové projekty
> pripojené cez Git sa teraz zakladajú vo flow „Create a Worker“ a nasadzujú cez `wrangler deploy`
> so statickými assetmi (nástupca Pages, rovnaké CDN aj cena). ADR-0003 sa realizuje týmto flow;
> pôvodný postup nižšie (Krok 1–5) je preto oproti prvej verzii dokumentu upravený.

## Predpoklady (všetky splnené v repe)

- `web/.node-version` = `24` — build image ju automaticky rešpektuje.
- `web/package.json` → `"packageManager": "pnpm@9.15.0"` — Workers Builds (corepack) automaticky použije pnpm v tejto verzii.
- `web/wrangler.jsonc` — config pre Workers static assets: `name: statistika-futbalsfz-sk`, `assets.directory: ./dist`. Bez tohto súboru by `wrangler deploy` skúšal interaktívne dopytovanie, ktoré v CI zlyhá — s configom beží deterministicky.
- `wrangler` je devDependency (`web/package.json`) — Workers Builds použije presne túto verziu.
- `web/public/_headers` — cache pravidlá (immutable `/_astro/*`, 1 h HTML); `_headers`/`_redirects` sú natívne podporované aj vo Workers static assets (rovnako ako v Pages).
- Build číta dáta z `../data` a `../etl/config` — Workers Builds klonuje **celé repo**, „Root directory“ iba mení pracovný adresár buildu, súbory mimo neho ostávajú dostupné. Funguje bez úprav.
- Lokálne overené: build **657 stránok** + `wrangler deploy --dry-run` prešiel bez chýb (19. 7. 2026).

## Krok 1 — vytvorenie projektu (Workers)

1. Prihlás sa na [dash.cloudflare.com](https://dash.cloudflare.com) → účet, kde je zóna `futbalsfz.sk`.
2. **Workers & Pages** → **Create** → **Import a repository** (alebo „Create a Worker“ → pripojiť Git).
3. Autorizuj **Cloudflare Workers/Pages GitHub App** pre organizáciu `Slovensky-futbalovy-zvaz` a povoľ prístup k repu `statistika.futbalsfz.sk` (repo je private — prístup musí schváliť admin organizácie; stačí „Only select repositories“).
4. Vyber repo `Slovensky-futbalovy-zvaz/statistika.futbalsfz.sk`.

## Krok 2 — nastavenia na obrazovke „Set up your application“

| Pole | Hodnota |
|---|---|
| Project name | `statistika-futbalsfz-sk` (**nie** `statistika.futbalsfz.sk` — mená Workerov nesmú obsahovať bodky, len písmená/číslice/pomlčky) |
| Build command | `pnpm install && pnpm build` |
| Deploy command | `npx wrangler deploy` (ponechať default) |
| Builds for non-production branches | podľa chuti (voliteľné preview pri PR vetvách) |
| **Advanced settings → Root directory** | `web` (**kritické** — inak build nenájde `../data`) |

Klikni **Deploy**. Prvý build trvá ~2–4 min (inštalácia + 657 stránok + upload assetov).

## Krok 3 — overenie na *.workers.dev

Po dobehnutí deployu skontroluj na `https://statistika-futbalsfz-sk.<account>.workers.dev` (presnú URL ukáže dashboard):

- `/` — mapa SR, klik na zväz funguje,
- `/zvaz/sfz` — profil vrát. demografie a vekovej pyramídy,
- `/zvaz/sfz/futsal/2025-2026` — futsalová sezónna stránka + prepínač odvetvia,
- `/porovnanie/obfz/2025-2026` — tabuľka, radenie, radar (výber 2–5 zväzov),
- odozva hlavičiek: `curl -sI https://…workers.dev/_astro/<súbor>` → `cache-control: public, max-age=31536000, immutable`.

## Krok 4 — vlastná doména

1. V projekte: **Settings → Domains & Routes → Add → Custom Domain** → zadaj `statistika.futbalsfz.sk`.
2. Zóna `futbalsfz.sk` je v tom istom Cloudflare účte → CNAME záznam a certifikát sa vytvoria **automaticky** (pár minút, stav „Active“).
3. Over `https://statistika.futbalsfz.sk`.

## Krok 5 — po nasadení

- Každý push na `main` (vrát. denných ETL commitov dát — ADR-0003) spustí automatický build a deploy.
- Zapísať výsledok (URL, dátum) do `docs/TODO.md` a odškrtnúť úlohu „napojiť Cloudflare“.
- Nadväzuje (ADR-0003): security review pipeline s Bart.sk a read-only DB účet pre produkčný ETL cron.
- **Voliteľné vylepšenie:** pridať `web/src/pages/404.astro` a zapnúť v `wrangler.jsonc` `assets.not_found_handling: "404-page"` (zatiaľ vypnuté — chýba vlastná 404 stránka, viď komentár v súbore).

## Riešenie problémov

- **„Worker name is invalid“:** Project name nesmie obsahovať bodky — použi `statistika-futbalsfz-sk`. Vlastná doména sa nastavuje samostatne v Kroku 4, s menom projektu nesúvisí.
- **`ENOENT ../data`:** znamená, že Root directory nie je `web` — build sa musí spúšťať z `web/` (nie z koreňa repa, nie z `web/dist`).
- **Deploy zlyhá s dopytom na framework/config:** over, že `web/wrangler.jsonc` je v repe (bez neho `wrangler deploy` skúša interaktívne auto-configure, čo v CI zlyhá).
- **GitHub repo nevidno v zozname:** GitHub App nemá prístup k private repu — v GitHub org Settings → GitHub Apps → Cloudflare → pridať repo.
