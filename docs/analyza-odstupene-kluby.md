# Odstúpené kluby — čo hovoria dáta

**Podklad na argumentáciu, 19. 8. 2026.** Zadanie prišlo ako „štatistika odhlásených klubov za
posledných 5 rokov“ s cieľom vyvrátiť rétoriku, že sa kluby hromadne odhlásili tento rok — či už
pre zmeny v RaPP, alebo pre nevyplatené finančné záväzky zo strany SFZ.

Zdroj: ISSF, prepočet `etl/odstupene_kluby.py` → `data/odstupene-kluby.json`. Overiteľné na
[statistika.futbalsfz.sk](https://statistika.futbalsfz.sk).

---

## Najprv terminológia, inak sa v tom stratíme

**„Odhlásený klub“ je zlá definícia — odhlasujú sa DRUŽSTVÁ, nie kluby.** Klub môže odhlásiť
dorast a ďalej hrať dospelých aj prípravku. Preto sa v tomto podklade pracuje s dvoma presnými
pojmami:

| Pojem | Definícia |
|---|---|
| **Odstúpený klub** | klub, ktorý **prvú sezónu nemá v súťažiach žiadne družstvo** a v predchádzajúcej sezóne mal aspoň jedno |
| **Zaniknutý klub** | klub, ktorý **dva roky po sebe** neprihlási do súťaže žiadne družstvo |

Odstúpený klub **nie je zaniknutý klub**. Po jednej vynechanej sezóne sa vracia každý piaty klub
(19,7 %). Zánik je až druhá tichá sezóna.

Prihlásené družstvo sa v dátach meria **reálne odohraným zápasom** — družstvo, ktoré sa prihlási
a odhlási pred prvým kolom, hraný futbal nie je. Poháre sa nerátajú: do Slovnaft Cupu sa dostane
len klub aktívny v súťažiach. **Prebiehajúca sezóna 2026/2027 sa nehodnotí** — mládežnícke súťaže
sa rozbiehajú neskôr, takže klub, ktorý ešte len čaká na štart svojej súťaže, by vyšiel ako
odstúpený. Preregistrácie klubu (nové IČO) sa spájajú s predchodcom, inak by preregistrácia vyšla
ako strata všetkých družstiev.

---

## 1. Koľko klubov odstúpilo — a kedy

| Sezóna | Odstúpených klubov | Z nich sa vrátilo | Z nich zaniklo |
|---|---|---|---|
| 2015/2016 | 72 | 16 | 56 |
| 2016/2017 | 78 | 24 | 54 |
| 2017/2018 | 58 | 20 | 38 |
| 2018/2019 | 70 | 27 | 43 |
| 2019/2020 | 76 | 15 | 61 |
| 2020/2021 | 63 | 11 | 52 |
| 2021/2022 | 80 | 18 | 62 |
| 2022/2023 | 59 | 15 | 44 |
| 2023/2024 | 53 | 8 | 45 |
| 2024/2025 | 51 | 7 | 44 |
| **2025/2026** | **42** | zatiaľ 0 | zatiaľ nevieme |

**Priemer jedenástich sezón je 63,8 klubu.** V sezóne 2025/2026 odstúpilo **42 klubov — najmenej
za celé sledované obdobie.** Tri najnižšie hodnoty v celom rade sú tri posledné sezóny: 53, 51, 42.

> **Veta na použitie:** *„V poslednej sezóne odstúpilo 42 klubov. To je najnižší počet za jedenásť
> sezón, pri priemere 63,8 — a tri najnižšie hodnoty v celom rade sú tri posledné sezóny.“*

Ak by za odstupovaním stáli zmeny v RaPP alebo nevyplatené záväzky, čakali by sme v poslednej
sezóne **skok nahor**. Namerané je presne opačné číslo.

---

## 2. Aké to boli kluby

Profil 42 klubov, ktoré odstúpili v sezóne 2025/2026:

| Ukazovateľ | Hodnota |
|---|---|
| Priemerný počet družstiev v poslednej odohranej sezóne | **1,45** |
| Malo jediné družstvo | **27 zo 42** |
| Malo dve družstvá | 12 |
| Malo tri a viac | 3 |
| Priemerný počet sezón, ktoré klub odohral | **9,6** |
| Existovalo 9 a viac sezón | **33 zo 42** |
| Malo len dospelých (žiadnu mládež) | 16 |
| Malo len mládež (žiadnych dospelých) | 15 |

Najväčší z nich mal štyri družstvá (ŠK fan-club Púchov), ďalšie tri po troch. **Ani jeden veľký
klub.**

Obraz je jednoznačný: **odstupujú malé, staré klubíky s jedným alebo dvoma družstvami.** Nie sú to
noví klubi, ktorí by sa po roku vzdali — dve tretiny z nich hrali deväť a viac sezón. A nie sú to
kluby, ktoré by niesli mládežnícku základňu regiónu.

### Kategórie, v ktorých mali družstvo

| Sezóna | Prípravka | Žiaci | Dorast | Dospelí |
|---|---|---|---|---|
| 2015/2016 | 5 | 17 | 19 | 62 |
| 2019/2020 | 4 | 18 | 11 | 64 |
| 2021/2022 | 11 | 27 | 8 | 66 |
| 2023/2024 | 15 | 15 | 8 | 44 |
| 2024/2025 | 19 | 14 | 6 | 32 |
| **2025/2026** | **13** | **15** | **2** | **27** |

**Odstupujú kluby dospelých — a aj tých je čoraz menej.** Klubov s družstvom dospelých medzi
odstúpenými ubudlo zo 62 – 70 na 27, dorastu z 19 na 2.

### História: scvrkávali sa postupne, nezmizli zrazu

Tá istá skupina 42 klubov, ktorá odstúpila v 2025/2026, mala v predchádzajúcich sezónach:

| Sezóna | Hralo klubov | Prípravka | Žiaci | Dorast | Dospelí |
|---|---|---|---|---|---|
| 2022/2023 | 40 | 24 | 19 | 2 | 34 |
| 2023/2024 | 40 | 19 | 16 | 2 | 29 |
| 2024/2025 | 42 | 20 | 20 | 4 | 28 |

Počet družstiev dospelých v tejto skupine klesal tri sezóny pred odstúpením (34 → 29 → 28).
**Nie je to náhly odchod, je to koniec dlhého scvrkávania.**

---

## 3. Spoločný menovateľ

**Dôvod odstúpenia v ISSF evidovaný nie je** — žiadne pole s dôvodom v dátach neexistuje. Čo sa
dá povedať zodpovedne, je profil, a ten ukazuje na jednu vec:

**Spoločný menovateľ je veľkosť, nie legislatíva.** Odstupujúci klub je malý klub s jedným
družstvom dospelých, ktorý existoval dlho a postupne sa scvrkával. Zmeny v RaPP ani finančné
vzťahy so SFZ toto vysvetliť nedokážu, pretože:

1. **Časovanie nesedí.** Odstúpení je v poslednej sezóne najmenej za jedenásť rokov. Legislatívna
   zmena by sa musela prejaviť skokom, nie historickým minimom.
2. **Zásah je nerovnomerný a dlhodobý.** Jedenásť rokov odstupujú prakticky výlučne kluby
   dospelých. Ak by príčinou boli podmienky nastavené centrálne, zasiahlo by to aj mládež — a tá
   naopak rastie.
3. **Mládežnícke družstvá pribúdajú.** Prípraviek je dnes 1 712 oproti 163 v sezóne 2014/2015,
   žiakov 1 611 oproti 1 316. Dorast klesol na 706 v 2022/2023 a odvtedy **rastie** na 803.
   Jediná kategória s nepretržitým poklesom sú dospelí: 1 788 → 1 320 družstiev.
4. **Poplatky za delegované osoby v mládeži platí SFZ.** Klub si platí len súťaže dospelých —
   presne tú kategóriu, ktorá ubúda, a tú, kde náklady na klub zostávajú.

> **Veta na použitie:** *„Odstupujú malé kluby s jedným družstvom dospelých, ktoré existovali
> deväť a viac sezón a tri sezóny pred odchodom sa scvrkávali. Mládežnícke družstvá pritom
> pribúdajú — prípraviek je dnes desaťnásobok stavu z roku 2014.“*

---

## Čo treba vedieť, skôr než tieto čísla niekto použije

- **Dôvod odstúpenia v dátach nie je.** Profil klubov je fakt, výklad príčin je náš úsudok. Ak
  máme rozhodnutia ŠTK alebo evidenciu záväzkov, dá sa to k tomu priložiť a vyhodnotiť
  kvantitatívne — bez toho zostáva pri profile.
- **Sezóna 2025/2026 ešte nie je uzavretá z hľadiska návratov.** Zo 42 klubov sa časť vráti; podľa
  histórie približne pätina. Definitívne číslo zánikov za túto sezónu budeme vedieť po 2027/2028.
- **Prebiehajúca sezóna 2026/2027 v analýze nie je.** V nej má nula odohraných zápasov 40 klubov,
  ale väčšina z nich len čaká na štart svojej súťaže. Toto číslo sa **nedá** použiť ako počet
  odstúpených klubov a treba naň dávať pozor — je to presne to číslo, ktoré by rétoriku o hromadnom
  odhlasovaní zdanlivo potvrdilo.
- **Kluby vo viacerých kategóriách sa v tabuľke kategórií počítajú viackrát** — klub s prípravkou
  aj dospelými je v oboch stĺpcoch. Súčet stĺpcov preto nie je počet klubov.
- **135 klubo-sezón má vekovú kategóriu „NEZNÁMA“** a do rozpadu po kategóriách nevstupuje
  (rovnako U20 a U21, ktoré do štyroch skúmaných kategórií nepatria).

## 4. Ktoré kluby konkrétne a v ktorom zväze

Menoslov všetkých **702 odstúpených klubov** za jedenásť sezón je v interaktívnom prehľade
[`odstupene-kluby.html`](obrazky/odstupene-kluby/odstupene-kluby.html) — heatmapa 43 zväzov × 11
sezón, klik na políčko vyfiltruje konkrétne kluby. Pri každom klube je posledná odohraná sezóna,
zväz, najvyššia liga dospelých, počty družstiev po kategóriách (prípravka / žiaci / dorast /
dospelí), počet odohraných sezón a či sa klub neskôr vrátil. Názov klubu vedie na jeho profil na
portáli.

Zväzy s najväčším počtom odstúpených klubov za celé obdobie:

| Zväz | Spolu | Z toho 2025/2026 |
|---|---|---|
| ObFZ Prievidza | 37 | 2 |
| ObFZ Michalovce | 34 | 3 |
| ObFZ Trebišov | 34 | 3 |
| ObFZ Trnava | 32 | 1 |
| ObFZ Nitra | 28 | 0 |
| ObFZ Humenné | 25 | 0 |
| ObFZ Levice | 24 | 1 |
| ObFZ Rožňava | 23 | 0 |

**Ako čítať zväz.** Je to zväz, v ktorého súťažiach klub odohral najviac zápasov v poslednej
sezóne. Pri malom klube s jediným družstvom dospelých je to priamo zväz, kde hrali dospelí; pri
klube s mládežou v celoštátnej alebo regionálnej súťaži to môže byť zväz tejto mládežníckej
súťaže. **Presné priradenie súťaže dospelých ku zväzu si vyžaduje prístup do ISSF databázy** —
publikované dáta ho nenesú a databáza bola pri spracovaní nedostupná. Preto je vedľa zväzu
uvedená aj najvyššia liga dospelých (L1 je najvyššia); ak chýba, klub v tej sezóne dospelých
nemal.

## Vizuály

| Súbor | Čo je na ňom |
|---|---|
| `01-odstupene.png` | Odstúpené kluby po sezónach s priemerom — hlavný graf |
| `02-kategorie.png` | Aké družstvá mali odstúpené kluby, keď naposledy hrali |
| `03-druzstva.png` | Družstvá v súťažiach po vekových kategóriách, 2014/2015 – 2025/2026 |
| `odstupene-kluby.html` | **Interaktívny menoslov** — heatmapa zväz × sezóna a filtrovateľná tabuľka klubov |
