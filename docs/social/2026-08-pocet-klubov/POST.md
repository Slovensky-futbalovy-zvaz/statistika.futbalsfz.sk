> ## ⚠️ Pred publikovaním (14. 8. 2026)
>
> - **Čísla sú exaktné**, spočítané skriptom `etl/zanikanie.py` nad publikovanými klubovými
>   artefaktmi, teda nad rovnakou definíciou, akú má blok Počet klubov na portáli. Výstup je
>   v `data/zanikanie.json`, metodika v `claude/analyza-zanikanie-klubov.md`.
> - **Do analýzy nevstupujú** sezóny **2012/2013 a 2013/2014** (nábeh ISSF, evidencia nebola
>   úplná) ani **prebiehajúca 2026/2027** (súťaže sa ešte len začínajú). Posledná hodnotená
>   sezóna 2024/2025 je provizórna — klub sa ešte môže vrátiť.
> - **Príčiny úbytku (demografia, verejné zdroje, podmienky pre trénerov, komerční partneri) sú
>   POSTOJ SFZ, nie zistenie z dát.** V texte sú zámerne oddelené od číselnej časti — portál
>   meria stavy a pohyby, nie dôvody.
> - **Rozpad na mládež a dospelých pred sezónou 2024/2025** sa opiera o vekovú kategóriu časti
>   súťaže (`teams.ageCategory` je vyplnené až od 2024/2025). Trend je spoľahlivý v smere
>   a ráde, nie na jednotky klubov.
> - **Vizuály (finálna sada, 1080 × 1350 px, s logom SFZ):** `01-preco-len-dospeli.png`,
>   `02-karta-pocet-klubov.png`, `03-vyvoj-po-sezonach.png`, `04-stav-mladez.png`,
>   `05-toky-klubov.png`, `06-miera-zaniku.png`, `07-hraci-po-kategoriach.png`,
>   `08-zanik-vs-vznik.png`, `09-priciny.png`, `10-delegovane-osoby.png`, `11-starnutie.png`,
>   `12-index-klubu.png`. Pre LinkedIn je z nich zložený dokument
>   `pocet-klubov-linkedin-carousel.pdf` (12 strán v tom istom poradí).
> - **Snímky 09 a 10 nie sú dátové** — 09 je označená ako názor SFZ („Náš pohľad, nie údaj
>   z portálu“), 10 je faktické vysvetlenie financovania delegovaných osôb. Obe majú v pätičke
>   Slovenský futbalový zväz namiesto „Zdroj: ISSF“.

# Sociálne siete — počet klubov a mládež (august 2026), verzia 2

**Kanály:** LinkedIn SFZ, Facebook SFZ
**Formát:** carousel, 12 snímok, 1080 × 1350 px (LinkedIn: priložiť PDF ako dokument)
**Odkaz:** https://statistika.futbalsfz.sk

---

## Text príspevku

**Prečo sa stále bavíme len o súťažiach dospelých? Lebo tam je najviac hluku — a najmenej
budúcnosti. To, že klub skončil v súťažiach dospelých, neznamená, že zanikol.**

Tak ako je to teda s tými klubmi? Ubúdajú, alebo pribúdajú? S mládežou, alebo bez? A čo ich
vlastne ničí? Odpovede sú od dnešného dňa na portáli Štatistiky slovenského futbalu, v novom
bloku **Počet klubov**. Za aktívny klub považujeme klub, ktorý v sezóne odohral aspoň jeden
zápas — nie ten, ktorý je len zapísaný v registri.

**Ubúdajú.** V sezóne 2025/2026 hralo futbal **1 406 klubov**. Pred desiatimi rokmi, v sezóne
2015/2016, ich bolo **1 715**. Za desať rokov teda z evidencie zmizlo vyše tristo klubov.
Medziročne je to −11, čiže tempo sa spomalilo, ale smer sa nezmenil.

**Ubúdajú ale nerovnomerne.** Klubov, ktoré majú **iba družstvo dospelých**, ubudlo takmer
o polovicu: **zo 461 na 239**. Klubov, ktoré majú **len mládež** a žiadnych dospelých, je
naopak viac než dvojnásobok: **zo 65 na 143**. Mládežnícke družstvo má dnes **1 167 klubov,
teda 83 % všetkých aktívnych**.

**A hráčov v mládeži je výrazne viac než pred desiatimi rokmi.** V dospelých ich ubudlo
(45 578 → 38 429) a v doraste tiež (23 173 → 19 554), ale u žiakov pribudlo
(23 596 → 31 726) a v prípravkách sa ich počet **viac než strojnásobil**
(8 289 → 27 149). Celkovo je v mládeži **78 429 hráčov, o 42 % viac než v sezóne 2014/2015**.

**Mládež je to, čo klub drží nad vodou.** Toto je najdôležitejšie číslo celej analýzy. Keď sme
spočítali, ktoré kluby definitívne prestali hrať, klub **bez mládeže mal takmer štyrikrát
vyššiu pravdepodobnosť, že zanikne** — 7,9 % za sezónu oproti 2,1 % u klubu, ktorý mládež má.

**A späť k úvodnej vete.** Ak má klub mládež, klub žije — aj keď v tabuľke dospelých už nie je.
V dátach je takých prípadov **220**: klub prestal hrať dospelú súťaž a s deťmi pokračuje.
V debate o „zanikajúcich kluboch“ sa pritom počíta práve len áčko.

**Nové kluby pritom vznikajú — len ich je málo.** Za posledných deväť sezón zaniklo 468 klubov
a vzniklo 180. Na jeden nový klub tak pripadajú takmer tri zaniknuté a tento rozdiel sa
nezmenšuje.

A ešte jeden pohyb, ktorý sa nespomína: **550-krát** si klub, ktorý mal len dospelých, pridal
mládežnícke družstvo. Opačným smerom, teda stratou mládeže, to bolo **482-krát**. Pridávanie
teda mierne prevyšuje stratu.

**A ešte dve veci z Trendov, ktoré k tomu patria.** Súťaže dospelých **starnú**: medián veku
hráčov v zápise stúpol za trinásť sezón z 25 na **28 rokov**. Zaujímavé je, ako — mladých
v dospelých súťažiach ubudlo len mierne (25 % → 22 % zápisov), ale podiel hráčov
**35-ročných a starších sa takmer zdvojnásobil** (15 % → 25 %). Kluby dopĺňajú kádre skúsenými
hráčmi, nie mladými.

Prácu s mládežou meriame **Indexom klubu** — číslom od 0 do 100 z piatich zložiek (šírka
mládeže, počet detí, počet družstiev, kontinuita a prechod do dospelých). Medián je **66
bodov**, 539 klubov je nad 76 bodmi a 239 má nulu, pretože mládež nemá. Index pritom **nehovorí
nič** o kvalite trénerskej práce, zázemí ani o prístupe k deťom a systematicky zvýhodňuje veľké
kluby — malý klub s jednou prípravkou môže byť pre dieťa z tej obce tou najlepšou voľbou.

---

**Čo ich teda ničí.** Toto už nie je čítanie z dát, to je náš pohľad na vec: demografia —
detí je jednoducho menej; nezáujem mládeže o šport ako taký; zlé podmienky pre trénerov, ktorí
prácu s deťmi robia často za symbolické peniaze; a najmä **chýbajúce verejné zdroje z miest
a obcí** — tam, kde obec klub nepodrží, klub nemá z čoho žiť. Ubúdajú aj komerční partneri,
lebo podmienky pre podnikanie sa na Slovensku výrazne zhoršili, a malý klub bez lokálneho
partnera je odkázaný sám na seba.

**Jedna vec, ktorá sa v tejto debate zamlčuje.** Náklady na **delegované osoby v mládežníckych
súťažiach — rozhodcov a delegátov — platí už niekoľko rokov celé SFZ.** Klub si platí len
súťaže dospelých. A treba doplniť ešte niečo, čo sa pravidelne pletie: tieto poplatky
**nie sú príjmom zväzov.** Cez zväz iba prechádzajú k delegovaným osobám — sú to peniaze pre
rozhodcov a delegátov, nie pre aparát.

---

**Ako to počítame.** Aktívny klub = klub s aspoň jedným reálne odohraným zápasom
(administratívne kontumácie bez zápisu sa nerátajú). Mládež znamená akúkoľvek vekovú úroveň
okrem dospelých. Do počtu vstupujú len regulárne súťaže riadené slovenskými zväzmi — školské
a výberové turnaje nie, Vysokoškolská liga áno. Klub hrajúci v súťažiach viacerých zväzov je
započítaný v každom z nich, preto je súčet po zväzoch vyšší než celoslovenské číslo. Za
zaniknutý klub považujeme klub, ktorý odohral svoju poslednú sezónu a odvtedy nehral už nikdy —
nie klub, ktorý si dal jednu sezónu pauzu. Sezóny 2012/2013 a 2013/2014 do analýzy nevstupujú,
bol to nábeh ISSF; prebiehajúca sezóna tiež nie, tá sa ešte len rozohráva.

Celá metodika je na portáli v sekcii Dokumentácia. Dáta pochádzajú z ISSF, portál je verejne
dostupný a bezplatný.

https://statistika.futbalsfz.sk

#slovenskyfutbal #SFZ #futbal #mládež #dáta #otvorenédáta #štatistiky #goodIdeaSportSlovakia
Slovak Football Association

---

## Skrátená verzia (kratší úvod v náhľade)

Tak ako je to s tými klubmi? Ubúdajú — za desať rokov ubudlo vyše tristo klubov. Ale klub bez
mládeže zaniká takmer štyrikrát častejšie než klub, ktorý má deti. A to, že klub skončil
v súťažiach dospelých, neznamená, že zanikol — v dátach je 220 klubov, ktoré prestali hrať
dospelú súťaž a s deťmi pokračujú. Nový blok Počet klubov na portáli Štatistiky slovenského
futbalu.

https://statistika.futbalsfz.sk

---

## Kľúčové čísla (na kontrolu pred publikovaním)

### Stav klubov

| Ukazovateľ | 2015/2016 | 2020/2021 | 2025/2026 |
|---|---|---|---|
| Aktívne kluby | 1 715 | 1 549 | **1 406** |
| S mládežou | 1 254 | 1 232 | **1 167** |
| Bez mládeže (len dospelí) | 461 | 317 | **239** |
| Len mládež | 65 | 105 | **143** |
| Podiel klubov bez mládeže | 26,9 % | 20,5 % | **17,0 %** |

Medziročne 2024/2025 → 2025/2026: **−11 klubov** (1 417 → 1 406). Futsal sa vykazuje samostatne
(23 klubov v 2025/2026).

### Hráči podľa vekovej úrovne osoby (futbal)

| Kategória | 2014/2015 | 2025/2026 | Zmena |
|---|---|---|---|
| Dospelí | 45 578 | 38 429 | −16 % |
| Dorast (U19–U16) | 23 173 | 19 554 | −16 % |
| Žiaci (U15–U12) | 23 596 | 31 726 | **+34 %** |
| Prípravky (U11–U07) | 8 289 | 27 149 | **3,3×** |
| **Mládež spolu** | 55 058 | **78 429** | **+42 %** |

### Zanikanie klubov (exaktné, 2014/2015 – 2023/2024)

| Ukazovateľ | Hodnota |
|---|---|
| Miera definitívneho odchodu — klub **bez mládeže** | **7,9 %** za sezónu (281 z 3 554 klubo-sezón) |
| Miera definitívneho odchodu — klub **s mládežou** | **2,1 %** za sezónu (258 z 12 365) |
| Definitívne odchody spolu | 539 |
| Klub pridal mládež (len dospelí → dospelí + mládež) | **550** |
| Klub stratil mládež (dospelí + mládež → len dospelí) | 482 |
| Klub stratil dospelých, mládež si udržal | **220** |

### Vek v súťažiach dospelých a Index klubu (2025/2026)

| Ukazovateľ | Hodnota |
|---|---|
| Medián veku hráčov v súťažiach dospelých | **28 rokov** (2013/2014: 25) |
| Podiel zápisov hráčov 35 a viac | **24,5 %** (2013/2014: 14,8 %) |
| Podiel zápisov hráčov do 21 rokov | **21,6 %** (2013/2014: 24,5 %) |
| Zápisov, na ktorých to stojí | 539 504 |
| Medián Indexu klubu | **66 bodov** (priemer 59, kvartily 41 / 66 / 86) |
| Klubov nad 76 bodov / s nulou | 539 / 239 |

### Zanikanie a vznikanie klubov (2016/2017 – 2024/2025)

| Ukazovateľ | Hodnota |
|---|---|
| Zaniklo klubov | **468** (44 – 65 za sezónu) |
| Vzniklo nových klubov | **180** (10 – 32 za sezónu) |
| Pomer | na jeden nový klub takmer **tri zaniknuté** |

---

## Alt texty k snímkam (prístupnosť)

1. **01** Titulná snímka: „Prečo sa stále bavíme len o súťažiach dospelých? Lebo tam je najviac
   hluku — a najmenej budúcnosti.“ plus dve čísla: klub bez mládeže zanikne v 7,9 % sezón, klub
   s mládežou v 2,1 %.
2. **02** Karta Počet klubov z úvodnej stránky: 1 406 aktívnych klubov, 1 167 s mládežou (83 %),
   239 bez mládeže (17 %).
3. **03** Stĺpcový graf počtu klubov po sezónach od 2012/2013 po 2025/2026; šrafované stĺpce sú
   roky nábehu ISSF.
4. **04** Stav klubov v sezónach 2015/2016 a 2025/2026: bez mládeže 461 → 239, len mládež
   65 → 143.
5. **05** Skutočné pohyby klubov: 550× klub pridal mládež, 482× ju stratil, 220× skončil
   v dospelých a mládež si udržal; úplne zaniklo 539 klubov.
6. **06** Miera zániku: klub bez mládeže 7,9 % za sezónu, klub s mládežou 2,1 % — takmer
   štyrikrát menej.
7. **07** Pätnásťročný trend hráčov: dospelí a dorast klesajú, žiaci a prípravky rastú;
   v mládeži je o 42 % hráčov viac než v 2014/2015.
8. **08** Zanikanie a vznikanie klubov po sezónach: 468 zaniknutých oproti 180 novým za deväť
   sezón.
9. **09** Čo kluby naozaj ničí — náš pohľad, nie údaj z portálu: mestá a obce, štát, komerční
   partneri, tréneri, infraštruktúra, demografia a záujem.
10. **10** Jedna vec, ktorá sa zamlčuje: náklady na delegované osoby v mládežníckych súťažiach
    platí celé SFZ, klub si platí len súťaže dospelých — a tieto poplatky nie sú príjmom zväzov.
11. **11** Starnutie súťaží dospelých: medián veku hráčov stúpol z 25 na 28 rokov, podiel
    hráčov nad 35 rokov z 15 % na 25 %.
12. **12** Index klubu: rozdelenie 1 410 klubov podľa bodov (539 nad 76 bodov, 239 s nulou)
    a upozornenie, čo index nemeria.
