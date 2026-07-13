# ADR-0005: Frontend stack F2 (Astro + ECharts + Tailwind)

**Stav:** rozhodnuté · **Dátum:** 13. 7. 2026 · **Rozhodol:** Ján Letko (PO)

## Kontext

Fáza F2 stavia verejný web statistika.futbalsfz.sk nad predgenerovanými statickými JSON (ADR-0001), hosting Cloudflare Pages s buildom pri push na `main` (ADR-0003). Obsah je z ~95 % statický (KPI, tabuľky, profily zväzov po sezónach — stovky stránok) s niekoľkými interaktívnymi prvkami: mapa SR (3 úrovne SFZ / 4 RFZ / 38 ObFZ), grafy (drill-down po vekových úrovniach, porovnania zväzov, 10-ročná demografia). Žiadny backend, žiadne volania interných API. Dáta: `data/index.json` (vrát. `zvazy[].odvetvia.futsal`) + `data/zvaz/{id}/{sezona}.json`.

## Rozhodnutie

- **SSG framework: Astro (+ TypeScript).** Islands architektúra — statické HTML, JS len pre interaktívne komponenty; predgenerovanie stránok z JSON cez `getStaticPaths`. Najlepší výkon/SEO a najjednoduchší build/deploy pre čisto statický web bez backendu.
- **Grafy: Apache ECharts** (ako Astro island, načítaný len na stránkach s grafom). Pokrýva KPI, drill-down, porovnania aj demografiu s rozumným úsilím. D3 len ako doplnok pre prípadnú bespoke vizualizáciu.
- **Mapa: inline SVG choropleth** z `web/assets/geo/mapa.json` (nie Leaflet — ten je na dlaždicové geo-mapy). Interaktivita (hover/klik → drill-down na RFZ/ObFZ) cez malý island.
- **Styling: Tailwind CSS + brand tokeny SFZ** (farby, typografia).
- **Runtime/manažér balíkov: Node 24 LTS + pnpm.** Node 20 dosiahol EOL 30. 4. 2026; Node 24 je Active LTS (podpora do apríla 2028). pnpm pre rýchlosť a striktné závislosti. Verzia zafixovaná cez `.node-version` + `engines` v `package.json` + `NODE_VERSION` pre Cloudflare; pnpm cez pole `packageManager` (corepack) → reprodukovateľný build.
- **Build/deploy: → Cloudflare Pages** (ADR-0003), doména `statistika.futbalsfz.sk`, cache cez `_headers`.

## Zvažované varianty (zhrnutie)

- **Framework:** Astro (zvolené) vs Next.js static export (ťažší, hydratuje aj statický obsah, static export má obmedzenia — dáva zmysel len pri raste do dynamickej appky) vs vanilla (min. závislosti, ale veľa ručnej práce pri stovkách stránok).
- **Grafy:** ECharts (zvolené) vs Chart.js (jednoduchšie, ale strop pri porovnaniach/demografii) vs D3 (max. flexibilita, najviac práce).
- **Mapa:** SVG choropleth (zvolené) vs Leaflet (nevhodný pre štylizované administratívne úrovne).

## Dôsledky

**Pozitívne:** minimálny JS a špičkové Core Web Vitals/SEO (verejný portál); jednoduchý, reprodukovateľný build z JSON; interaktívne prvky izolované v islands; nulové prevádzkové náklady; React/Vue/Svelte island možný, ak zíde na um.

**Negatívne / kompromisy:** Astro má menší ekosystém a menej vývojárov ho pozná než React/Next.js; pri budúcej potrebe SSR/dynamiky by bola migrácia (nízke riziko — architektúra je zámerne statická). ECharts pridá ~1 MB (tree-shakeable, len na stránkach s grafom).

**Nadväzuje (F2 kickoff):** štruktúra `web/` (Astro projekt), načítanie `data/index.json` + profil zväzu, komponent mapy z `mapa.json`, brand tokeny SFZ; prototyp `web/prototyp.html` slúži ako vizuálna referencia.
