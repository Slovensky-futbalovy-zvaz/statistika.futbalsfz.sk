# Archív dokumentácie

Dokumenty, ktoré splnili svoj účel a **už nie sú zdrojom pravdy**. Nechávame ich v repe, lebo
vysvetľujú, prečo je niečo tak, ako je — ale keď hľadáš aktuálny stav, hľadaj ho o priečinok
vyššie ([rozcestník](../README.md)).

Nič odtiaľto sa nemaže. Presunuté 8. 8. 2026.

| Dokument | Prečo je v archíve |
|---|---|
| [analyza-hosting.md](analyza-hosting.md) | Porovnanie štyroch variantov hostingu z 12. 7. 2026. Viedlo k ADR-0003 (Cloudflare Pages), ktorý bol v časti „web + CDN“ nahradený [ADR-0006](../adr/0006-hosting-vercel-namiesto-cloudflare.md) — portál beží na Verceli |
| [cloudflare-pages-nasadenie.md](cloudflare-pages-nasadenie.md) | Postup nasadenia na Cloudflare. Nepoužíva sa, ale zostáva ako referencia pre prípad budúcej migrácie DNS — tak to určuje aj ADR-0006 |
| [podklady-bart-produkcny-beh.md](podklady-bart-produkcny-beh.md) | Podklady pre Bart.sk k produkčnému behu ETL. **Odoslanie je stále otvorená úloha** ([TODO](../TODO.md)); dokument je tu, lebo popisuje stav ETL zo 7/2026 |
| [design_handoff_statistika_redesign/](design_handoff_statistika_redesign/) | Dizajnový handoff k redizajnu z 19. 7. 2026 — vizuálna špecifikácia, ECharts recepty, interaktívny prototyp, `theme.css`. Redizajn je hotový a implementovaný ([ADR-0007](../adr/0007-react-islands-redizajn.md)); brand tokeny dnes žijú vo `web/src/styles/`. **Odkazy vnútri týchto súborov ukazujú na priečinok podľa jeho pôvodného mena** — po presune sú relatívne k tomuto archívu |
| [prompty/](prompty/) | Štyri handoff prompty medzi pracovnými sessions z júla 2026. Zachytávajú, čo sa v ktorej etape riešilo; ako návod na prácu už neslúžia |
