# statistika.futbalsfz.sk

Verejný štatistický portál slovenského futbalu — interaktívna mapa všetkých troch úrovní futbalovej pyramídy (SFZ → 4 RFZ → 38 ObFZ), sezónne štatistiky s drill-down na vekové úrovne, porovnávanie zväzov a 10-ročná demografia osôb vo futbale (hráči, tréneri, rozhodcovia, delegáti).

> **Stav projektu:** koncepčná fáza (F0) — projektový plán v pripomienkovaní, prototyp v príprave.

## Čo tu nájdete

| Priečinok | Obsah |
|---|---|
| `docs/` | Projektový plán a koncept, metodika výpočtov, záznamy rozhodnutí (ADR) |
| `etl/` | ETL pipeline — agregácie zo Sportnet DB do publikovateľných JSON (fáza F1) |
| `web/` | Frontend aplikácia — mapa, profily zväzov, porovnania, demografia (fáza F2+) |
| `data/` | Schémy a vzorky predgenerovaných dátových súborov |

## Kľúčové dokumenty

- [Projektový plán a koncept](docs/projektovy-plan.md) ([docx verzia](docs/Statistika-futbalsfz-sk_Projektovy-plan-a-koncept_v1.0.docx))
- [Metodika a poznatky o dátach](docs/metodika.md)
- [ADR-0001: Predgenerované JSON namiesto živého API](docs/adr/0001-architektura-predgenerovane-json.md)

## Architektúra (skratka)

```
Sportnet MongoDB („sutaze“) ──► ETL (Python, denne) ──► statické JSON ──► web (SSG) + CDN
```

Verejný web nemá žiadny prístup k databáze ani interným API — publikujú sa výhradne agregované dáta. Detaily a zdôvodnenie v ADR-0001.

## Fázy projektu

| Fáza | Obsah | Stav |
|---|---|---|
| F0 | Príprava — schválenie konceptu, prístupy, GDPR, dizajn | 🔄 prebieha |
| F1 | Dátový audit a ETL (normalizácia sezón, register appSpace, JSON) | ⬜ |
| F2 | Frontend — interaktívna mapa a profily zväzov | ⬜ |
| F3 | Porovnania a radenie zväzov | ⬜ |
| F4 | Demografia za 10 sezón | ⬜ |
| F5 | Beta a verifikácia so zväzmi | ⬜ |
| F6 | Verejné spustenie | ⬜ |

## Kontakt

Produktový vlastník: **Ján Letko** (jan.letko@futbalsfz.sk)

---
© Slovenský futbalový zväz · Zdroj dát: Sportnet
