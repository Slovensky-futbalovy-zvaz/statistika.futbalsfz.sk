# ADR-0007: React islands pre interaktívne prvky (redizajn 2026)

**Stav:** rozhodnuté · **Dátum:** 19. 7. 2026 · **Rozhodol:** Ján Letko (PO) — dopĺňa ADR-0005

## Kontext

Vizuálny redizajn portálu (design handoff `design_handoff_statistika_redesign/`) prináša viac bohato interaktívnych prvkov: choropleth mapa s prepínaním úrovne a metriky, dva sunbursty s filtrami šport/pohlavie, radar 2–5 zväzov, bump chart poradia RFZ, multi-line demografia s výberom čiar, vyhľadávateľný zväz picker, custom dropdown sezóny a mobilný hamburger. Handoff je napísaný s receptami pre React (`.tsx`) islands.

Doteraz (ADR-0005) boli islands riešené ako vanilla `.astro` komponenty s `<script>`. Pri narastajúcej interaktivite (zdieľaný stav, prekresľovanie grafov podľa viacerých filtrov, permalink) je ručný DOM/stav v `<script>` čoraz krehkejší.

## Rozhodnutie

Pre interaktívne prvky sa použije **React (`@astrojs/react`)** ako Astro island framework. Statický shell, SEO, routing a načítanie dát ostávajú v Astro (SSG, `getStaticPaths`, `lib/data.ts` pri builde). React sa hydratuje len na komponentoch s interaktivitou (`client:load` / `client:visible`), dáta sa im odovzdávajú ako props (serializované pri builde). ECharts sa používa vnútri React islandov; choropleth ostáva inline SVG.

ADR-0005 (Astro + ECharts + Tailwind) ostáva v platnosti; toto ADR len spresňuje, že „island môže byť React", čo ADR-0005 explicitne pripúšťalo („React/Vue/Svelte island možný, ak zíde na um").

## Dôsledky

**Pozitívne:** deklaratívny stav a prekresľovanie (filtre, výbery), priama realizácia receptov z handoffu, jednoduchšia údržba komplexných grafov, znovupoužiteľné komponenty. Statická podstata sa nemení — React beží len na klientovi v ostrovoch, väčšina stránky je stále statické HTML.

**Negatívne / kompromisy:** pridané závislosti (`@astrojs/react`, `react`, `react-dom`, typy) a väčší JS bundle na interaktívnych stránkach (mierne, hydratujú sa len ostrovy). Build je naďalej čisto statický (Vercel, ADR-0006).

**Nadväzuje:** existujúce vanilla `.astro` islands sa postupne migrujú na React pri redizajne jednotlivých obrazoviek; nové interaktívne komponenty sa píšu rovno v Reacte.
