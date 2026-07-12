# statistika.futbalsfz.sk

Verejný štatistický portál slovenského futbalu — interaktívna mapa všetkých troch úrovní futbalovej pyramídy (SFZ → 4 RFZ → 38 ObFZ), sezónne štatistiky s drill-down na vekové úrovne, porovnávanie zväzov a 10-ročná demografia osôb vo futbale (hráči, tréneri, rozhodcovia, delegáti).

> **Stav projektu:** F1 v plnom prúde — dátový audit hotový, prvá verzia ETL (`etl/run.py`) funkčná a verifikovaná, všetky otvorené otázky O1–O7 rozhodnuté (12. 7. 2026).

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
| F0 | Príprava — schválenie konceptu, prístupy, GDPR, dizajn | ✅ rozhodnutia O1–O7 uzavreté (ADR-0002, ADR-0003) |
| F1 | Dátový audit a ETL (normalizácia sezón, register appSpace, JSON) | 🔄 audit hotový, ETL v1 funkčné vrát. dimenzie pohlavie; zostáva produkčný beh |
| F2 | Frontend — interaktívna mapa a profily zväzov | ⬜ |
| F3 | Porovnania a radenie zväzov | ⬜ |
| F4 | Demografia za 10 sezón | ⬜ |
| F5 | Beta a verifikácia so zväzmi | ⬜ |
| F6 | Verejné spustenie | ⬜ |

## Kontakt

Produktový vlastník: **Ján Letko** (jan.letko@futbalsfz.sk)

---
© Slovenský futbalový zväz · Zdroj dát: Sportnet
