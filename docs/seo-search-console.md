# SEO, Search Console a overenie zdieľania

Krátky checklist po nasadení SEO/OG (commit `26f0d88`). Cieľ: dostať web do
Google/Bing a overiť, že náhľady pri zdieľaní fungujú.

## Čo je už hotové v kóde

- **Meta tagy** na každej stránke: `title`, `description`, `canonical`, `robots`
  (`index,follow`), `theme-color`, `author`.
- **Open Graph + Twitter**: `og:title/description/url/image` (1200×630) a
  `twitter:card=summary_large_image`. Každá sekcia má vlastný OG obrázok v `/og/`.
- **JSON-LD**: `SportsOrganization` (SFZ) + `WebSite` na celom webe;
  `BreadcrumbList` na profiloch zväzov a klubov; `FAQPage` na úvode.
- **robots.txt** (`/robots.txt`): povolení všetci vrátane AI botov (GPTBot,
  ClaudeBot, PerplexityBot, Google-Extended, CCBot…) + odkaz na sitemap.
- **Sitemap** (`/sitemap-index.xml` → `/sitemap-0.xml`): generuje `@astrojs/sitemap`
  pri každom builde, obsahuje všetkých ~3 600 URL.

## 1. Google Search Console (jednorazovo)

1. Otvor <https://search.google.com/search-console> a prihlás sa firemným Google účtom.
2. **Add property → URL prefix**: `https://statistika.futbalsfz.sk`.
3. **Overenie vlastníctva** — najjednoduchšie cez DNS TXT (doména beží na WebSupport):
   - GSC ti dá TXT záznam `google-site-verification=…`.
   - Pridaj ho vo WebSupporte ako TXT k doméne `futbalsfz.sk` (alebo subdoméne
     `statistika`), počkaj na propagáciu, klikni **Verify**.
   - Alternatíva bez DNS: HTML meta tag → pošli mi hodnotu, pridám ju do
     `Base.astro` ako `<meta name="google-site-verification" …>`.
4. **Sitemaps** → zadaj `sitemap-index.xml` → **Submit**.
5. **URL Inspection** → vlož `https://statistika.futbalsfz.sk/` → **Request indexing**
   (a to isté pre /kluby, /porovnanie, /demografia, /projekty, /zvaz/sfz).

## 2. Bing Webmaster Tools (voliteľné, rýchle)

1. <https://www.bing.com/webmasters> → **Import from Google Search Console**
   (prenesie property aj sitemap jedným klikom), alebo pridaj ručne + sitemap.
   Bing pokrýva aj vyhľadávanie v ChatGPT/Copilot.

## 3. Overenie OG náhľadov (po každom väčšom vizuálnom update)

- **Facebook**: <https://developers.facebook.com/tools/debug/> → vlož URL →
  **Scrape Again** (Facebook si OG cachuje, preto po zmene obrázka treba re-scrape).
- **LinkedIn**: <https://www.linkedin.com/post-inspector/>
- **X/Twitter**: náhľad sa zobrazí priamo pri vložení odkazu do príspevku.
- **WhatsApp/Messenger**: preberajú OG z Facebook cache.

Skontroluj, že sa ukáže správny obrázok (`/og/{sekcia}.png`), titul a popis.

## 4. Rich Results / štruktúrované dáta

- **Rich Results Test**: <https://search.google.com/test/rich-results> → vlož URL
  úvodnej stránky → over, že sa deteguje **FAQ** a **Organization**.
- **Schema Markup Validator**: <https://validator.schema.org/> → skontroluje
  `BreadcrumbList` na profile zväzu/klubu.

## 5. Priebežná údržba

- Po zmene textov/obrázkov znova spusti **Scrape Again** (FB) a v GSC prípadne
  **Request indexing** pre dotknuté URL.
- Sitemap sa aktualizuje automaticky pri každom nasadení — netreba nič robiť.
- Ak pribudnú historické sezóny klubov, počet URL v sitemape narastie; GSC ich
  postupne prejde sám.

## Poznámky

- Overovací meta tag Google/Bing viem pridať do `web/src/layouts/Base.astro`
  (do `<head>`), ak preferuješ HTML metódu pred DNS.
- `_headers` v `web/public/` je z čias Cloudflare a na Vercel sa ignoruje —
  bezpečnostné hlavičky sa dajú neskôr doriešiť cez `vercel.json` (nie je nutné pre SEO).
