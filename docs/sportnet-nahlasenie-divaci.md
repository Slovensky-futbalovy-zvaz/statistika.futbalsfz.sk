# Nahlásenie chybného záznamu divákov Sportnetu — draft e-mailu

Pripravené 13. 7. 2026. Odosielateľ: Ján Letko (PO). Po odoslaní doplniť stav do sekcie „Stav“ nižšie.

---

**Komu:** podpora Sportnet / Bart.sk
**Predmet:** Chybný údaj o návštevnosti v zápase ObFZ Nitra (protocol.audience = 300 000)

Dobrý deň,

pri príprave štatistického portálu statistika.futbalsfz.sk (agregácie nad DB `sutaze`) sme identifikovali zjavne chybný údaj o návštevnosti v zápisoch o stretnutí. Prosíme o preverenie a opravu, prípadne o informáciu, ako sa takéto opravy štandardne riešia.

**Chybný záznam:**

| Pole | Hodnota |
|---|---|
| Databáza / kolekcia | `sutaze` / `matches` |
| `_id` | `5f3ffdab4000de0cc7e62c45` |
| Zápas | OFK Sľažany – ŠK Nevidzany |
| Súťaž | IV. liga - U13 – ObFZ NR (appSpace `obfz-nitra.futbalnet.sk`) |
| Sezóna | 2019/2020 |
| Dátum | 14. 10. 2019 o 14:30 |
| `protocol.audience` | **300 000** |

Ide o žiacky (U13) zápas — hodnota 300 000 divákov je zjavne chybný zápis (pravdepodobne preklep pri zadávaní, reálna hodnota bude rádovo desiatky). Tento jediný záznam tvorí ~99 % celkovej vykázanej návštevnosti kategórie U13 v ObFZ Nitra za sezónu 2019/2020 (303 610 spolu / 107 zápasov) a skresľuje tak akékoľvek štatistiky návštevnosti.

Zaujíma nás zároveň:

1. Je možné hodnotu opraviť priamo v dátach (a existuje na to štandardný proces)?
2. Existuje v systéme validácia vstupu `protocol.audience` (horný limit)? Ak nie, zvážte prosím jej doplnenie — predišlo by sa podobným zápisom.

Ďakujeme.

S pozdravom
Ján Letko
Slovenský futbalový zväz
jan.letko@futbalsfz.sk

---

## Poznámky (interné, neposielať)

- Nález z 12. 7. 2026 (test fallbacku kategórií, docs/report-kvality-dat.md §7b); presná identifikácia zápasu 13. 7. 2026 priamym dotazom (audience > 500, sezóna 2019/2020, ObFZ Nitra).
- Druhý najvyšší záznam sezóny: 1 750 divákov (VI. liga D U19 sk. A, OFK Čifáre – FC Čechynce, 31. 8. 2019, `_id: 5f40337f4000de0cc7e9be82`) — hraničný, ale nie absurdný; nenahlasujeme, ETL ho pokryje validáciou extrémov.
- ETL ochrana už nasadená: anomália pri priemere > 2 000 divákov/zápas na kategóriu (etl/validate). Do budúcna zvážiť aj per-zápas limit pri publikácii.

## Stav

- [ ] Odoslané (dátum):
- [ ] Odpoveď Sportnet:
- [ ] Oprava v DB overená:
