# Web — statistika.futbalsfz.sk

Frontend aplikácia. Implementácia vo fáze F2 (mapa + profily), F3 (porovnania), F4 (demografia).

## Návrh (upresní sa po rozhodnutí O1/O4)

- SSG framework (Next.js/React alebo Astro) — statické predgenerovanie profilov zväzov pre SEO.
- Interaktívna SVG mapa Slovenska (3 úrovne: SFZ / 4 RFZ / 38 ObFZ) z KMZ → TopoJSON.
- Grafy: ECharts alebo D3.
- Dáta: statické JSON z `data/` (viď ADR-0001), žiadne volania interných API.
