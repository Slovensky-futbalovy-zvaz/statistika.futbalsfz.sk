# Nahlásenie: Vysokoškolská liga vo futsale bez úrovne súťaže — draft e-mailu

Pripravené 21. 10. 2026. Odosielateľ: Ján Letko (PO). Po odoslaní doplniť stav do sekcie „Stav“ nižšie.

---

**Komu:** podpora Sportnet / Bart.sk
**Predmet:** Vysokoškolská liga vo futsale 2026/2027 — chýbajúca úroveň súťaže (`level`)

Dobrý deň,

nadväzujem na opravu z 14. 10., ktorou ste doplnili `rules.category` a `rules.gender` do oboch
častí Vysokoškolskej ligy vo futsale. Oprava zabrala — náš týždenný beh 21. 10. už prešiel celý.
Pri jeho kontrole sme však narazili na zvyšný problém s tou istou súťažou.

**Súťaž:**

| Pole | Hodnota |
|---|---|
| Databáza / kolekcia | `sutaze` / `competitions` |
| `_id` | `6ab20c8bba18d7d790c6906b` |
| Názov | Vysokoškolská liga vo futsale |
| `identifier` | `VSL` |
| `appSpace` / `ownerPPO` | `futsalslovakia.sk` |
| Sezóna | 2026/2027 |
| Časti | Bratislava / Skupina A (`6ab20d45ba18d7d790c6906c`), Bratislava / Skupina B (`6ab20dc9ba18d7d790c6906d`) |

**Problém 1 — chýba `level` a `sortvalue`.** Dokument súťaže tieto polia nemá vôbec. Všetky
ostatné futsalové súťaže sezóny 2026/2027 ich majú vyplnené (Tipos Futsal Extraliga a extraligy
mládeže `level` 1, Slovenský pohár SF `level` 99). Dôsledkom je, že naše agregácie zaraďujú
9 uzatvorených zápasov tejto súťaže do skupiny „neurčená úroveň“ mimo ligovej pyramídy.

Podľa dokumentácie Súťaží sú `level` a `sortvalue` polia kopírované z ISSF a v administrácii
sa nedajú nastaviť. Keďže táto súťaž vznikla priamo v Sportnete pod `ownerPPO`
`futsalslovakia.sk` (teda nie je zrkadlená z ISSF), zaujíma nás:

1. Ako sa má úroveň súťaže doplniť pri súťaži, ktorá nepochádza z ISSF? Existuje na to postup
   na vašej strane, alebo to vieme nastaviť my ako správca `futsalslovakia.sk`?
2. Je správne, aby takáto súťaž ostala bez úrovne, alebo má dostať vyhradenú hodnotu (obdobne
   ako `level` 99 pre pohárové súťaže)?

**Problém 2 — nevyplnená návštevnosť.** Žiadny z 9 uzatvorených zápasov tejto súťaže nemá
vyplnené pole `protocol.audience` (chýba úplne, nie je nulové). Tých 9 zápasov je presne dôvod,
prečo pokrytie návštevnosti futsalu SFZ v sezóne 2026/2027 kleslo na 76,3 % (29 z 38 zápasov).
Chápeme, že ide o vec zadávateľov zápisov, nie systému — ak však viete, komu to na strane
správcu súťaže pripomenúť, budeme radi.

Ďakujeme.

S pozdravom
Ján Letko
Slovenský futbalový zväz
jan.letko@futbalsfz.sk

---

## Poznámky (interné, neposielať)

- Nález z behu 21. 10. 2026 (devlog). Anomália ETL: „nízke pokrytie divákov 76.3 % (< 80 %)“,
  prah `DIVACI_POKRYTIE_MIN` v `etl/validate/__init__.py`.
- Overené priamo v DB 21. 10.: dokument súťaže nemá kľúče `level` ani `sortvalue`; 9 uzatvorených
  zápasov (Skupina A 6, Skupina B 3) má `protocol.audience` typu `missing`. Ďalších 7 zápasov
  zatiaľ nie je uzatvorených — do štatistík nevstupujú.
- Zdroj tvrdenia o ISSF: dokumentácia `sutaze`, Competition Lifecycle — „`level` and `sortvalue`
  are non-settable numeric fields copied from ISSF“.
- Keď sa úroveň doplní, treba prepočítať sezónu 2026/2027 (súčasťou bežného týždenného behu)
  a bod zmazať z `NEXT.md`.

## Stav

- [ ] Odoslané (dátum):
- [ ] Odpoveď Sportnet:
- [ ] `level` doplnený, overené v DB:
- [ ] Prepočítané 2026/2027, bod zmazaný z NEXT.md:
