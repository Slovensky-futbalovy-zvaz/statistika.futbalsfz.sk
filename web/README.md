# Web — statistika.futbalsfz.sk

Frontend aplikácia. Implementácia vo fáze F2 (mapa + profily), F3 (porovnania), F4 (demografia).

## Stack (rozhodnuté — ADR-0005, 13. 7. 2026)

- **Astro (+ TypeScript)** — SSG, islands architektúra; predgenerovanie profilov zväzov (× sezóna) pre SEO.
- **Apache ECharts** (island) — grafy: KPI, drill-down po vekových úrovniach, porovnania, 10-ročná demografia.
- **Inline SVG choropleth** z `assets/geo/mapa.json` — mapa SR (3 úrovne: SFZ / 4 RFZ / 38 ObFZ), interaktivita cez island.
- **Tailwind CSS + brand tokeny SFZ** — styling.
- **Dáta:** statické JSON z `data/` (ADR-0001) — futbal z `zvazy[].sezony`, futsal z `zvazy[].odvetvia.futsal`. Žiadne volania interných API.
- **Runtime:** Node 24 LTS + pnpm (verzia fixovaná cez `.node-version`, `engines`, `packageManager`).
- **Build/deploy:** pnpm → Cloudflare Pages pri push na `main` (ADR-0003).

`prototyp.html` = vizuálna referencia (vanilla), nahradí ho Astro implementácia.
