> ## ⚠️ Pred publikovaním
>
> - **Definícia (Ján Letko, 15. 8. 2026): zaniknutý klub = klub, ktorý dva roky po sebe
>   neprihlási do súťaže žiadne družstvo.** Postup do vyššej ani zostup do nižšej súťaže zánik
>   nie je — aktivita sa posudzuje celoslovensky. Rebríček je preto podľa **podielu na všetkých
>   zánikoch v SR**, nie podľa úbytku klubov vo zväze (ten je postupmi a zostupmi skreslený).
> - **Čísla sú z portálu.** Sekcia **Zanikanie klubov** na `/trendy` ich nesie všetky —
>   graf tokov po sezónach, tri obdobia aj rebríček všetkých 43 zväzov s prepínačom metriky.
>   Zdroj je `data/zanikanie.json` (`etl/zanikanie.py`), overenie `etl/kontrola_zanikania.py`.
> - **Toky sú horná hranica.** Nový subjekt v ISSF nie je nutne nový klub — pri novej
>   registrácii vznikne nové IČO bez väzby na predchodcu (nameraných aspoň 41 párov). Stavov
>   klubov a mier odchodu sa to netýka.
> - **Rebríček zväzov je citlivá vec.** Sú tam menované konkrétne ObFZ. Čísla sedia a sú
>   verejne overiteľné, ale je namieste dať to vopred vedieť dotknutým zväzom — najmä
>   ObFZ Trebišov, Michalovce, Prievidza, Nitra, Trnava, Humenné a Rožňava.
> - **Sezóny nábehu ISSF ani prebiehajúca sezóna do analýzy nevstupujú**; posledné dve
>   hodnotené sezóny sú provizórne.
> - **Podiel a miera nie sú to isté** a v jednej tabuľke sa ľahko zamenia. Podiel hovorí, kde
>   zaniklo najviac klubov (veľký zväz ich má viac), miera hovorí, ako často sa to stane klubu
>   daného zväzu. ObFZ Prievidza má vysoký podiel a podpriemernú mieru, ObFZ Rožňava naopak.
>   Na portáli je pri tabuľke vysvetlenie oboch stĺpcov.

# Sociálne siete — kde a kedy kluby končia (august 2026)

**Kanály:** LinkedIn SFZ, Facebook SFZ
**Formát:** 2 snímky, 1080 × 1350 px
**Odkaz:** https://statistika.futbalsfz.sk/trendy

---

## Text príspevku

**Kluby na Slovensku nezanikajú rýchlejšie než pred desiatimi rokmi. Prestali vznikať.**

V predchádzajúcom príspevku sme ukázali, že klubov ubúda a že klub bez mládeže zaniká takmer
štyrikrát častejšie. Pýtali ste sa na pokračovanie: kde presne kluby končia a kedy sa to
zlomilo. Odpoveď je od dnes na portáli, v novej sekcii **Zanikanie klubov** na stránke Trendy.

**Najprv to, čo nás prekvapilo najviac.** Kluby zanikajú **pomalšie** než pred desiatimi rokmi —
zo 62 klubov za sezónu pred covidom na 54 dnes. Čo sa zmenilo, je druhá strana rovnice: pred
covidom vzniklo **28 nových klubov za sezónu**, počas covidu 15 a dnes **13**. Úbytok teda
nerobí to, že by klubov zanikalo viac. Robí ho to, že nových pribúda polovica.

**A kde.** V období 2014/15 – 2023/24 zaniklo na Slovensku **595 klubov**. Najväčší podiel
z nich pripadá na **ObFZ Trebišov (29 klubov, 4,9 %)**, **ObFZ Michalovce (28)** a **ObFZ
Prievidza (28)**. Toto je ale len jedna polovica obrazu — veľký zväz má prirodzene viac
zánikov. Druhá polovica je, ako často sa to stane klubu daného zväzu: priemer Slovenska je
**3,7 % za sezónu**, ObFZ Trebišov má **11,4 %**, ObFZ Rožňava 8,5 %, ObFZ Michalovce 6,2 % —
a naopak ObFZ Prievidza podpriemerných 3,9 %.

Najnižšiu mieru má **ObFZ Senica — 1,0 %**. Obraz je regionálny: juh a východ strácajú, západ
a Považie držia.

**Čo s tým.** Toto už nie je čítanie z dát, to je náš pohľad. Ak sa problém presunul z „kluby
zanikajú“ na „nové nevznikajú“, potom podpora, ktorá udržiava existujúce kluby pri živote, na
zvrátenie trendu nestačí — chýba niečo, čo pomôže klub **založiť a udržať prvé tri sezóny**.
A platí to hlavne tam, kde je to najhoršie: v okresoch, ktoré strácajú aj obyvateľov.

**Ako to počítame.** Za zaniknutý považujeme klub, ktorý **dva roky po sebe neprihlási do súťaže
žiadne družstvo**. Jedna sezóna pauzy zánik nie je. **Koniec v súťažiach dospelých** zánik nie
je, pokiaľ klub má mládež. A **postup do vyššej ani zostup do nižšej súťaže** zánik nie je už
vôbec — aktivitu klubu sledujeme na celom Slovensku, nie vo zväze; klub, ktorý postúpi
z oblastnej súťaže do regionálnej, prestane hrať súťaže svojho ObFZ, ale hrá ďalej. Domovský
zväz sa takto mení pri 8,8 % dvojíc po sebe idúcich sezón, takže keby sa aktivita posudzovala
po zväzoch, vyšlo by z toho 658 falošných zánikov. Zánik sa pripisuje domovskému zväzu klubu
v jeho poslednej odohranej sezóne. Sezóny nábehu ISSF (2012/2013 a 2013/2014)
ani prebiehajúca sezóna do analýzy nevstupujú. A ešte jedna poctivá poznámka: časť „nových“
klubov je ten istý klub s novým IČO — pri novej registrácii vznikne v ISSF nový subjekt bez
väzby na predchodcu.

Celý pohľad aj s rebríčkom všetkých 43 zväzov je na portáli, metodika v sekcii Dokumentácia.

https://statistika.futbalsfz.sk/trendy

#slovenskyfutbal #SFZ #futbal #mládež #dáta #otvorenédáta #štatistiky #goodIdeaSportSlovakia
Slovak Football Association

---

## Kľúčové čísla (na kontrolu pred publikovaním)

### Kedy

| Obdobie | Zaniknutých za sezónu | Nových klubov za sezónu |
|---|---|---|
| do 2018/2019 | 62,4 | **28,3** |
| 2019/2020 – 2021/2022 (covid) | 58,7 | **15,3** |
| od 2022/2023 | 53,5 | **13,5** |

Zaniknutých spolu 595 (z toho 56 sa po dvoch tichých sezónach ešte vrátilo — podľa definície
zostávajú zaniknuté). Čistý úbytok klubov medziročne: posledné sezóny −29, −26, −11.

### Kde (595 zaniknutých klubov, 2014/15 – 2023/24; priemerná miera SR 3,7 %)

| Zväz | Zaniknutých | Podiel na SR | Miera vo zväze |
|---|---|---|---|
| ObFZ Trebišov | 29 | **4,9 %** | **11,4 %** |
| ObFZ Michalovce | 28 | 4,7 % | 6,2 % |
| ObFZ Prievidza | 28 | 4,7 % | 3,9 % |
| ObFZ Nitra | 26 | 4,4 % | 3,6 % |
| ObFZ Trnava | 25 | 4,2 % | 3,6 % |
| ObFZ Humenné | 21 | 3,5 % | 5,7 % |
| ObFZ Levice | 19 | 3,2 % | 4,8 % |
| ObFZ Prešov | 18 | 3,0 % | 2,9 % |
| ObFZ Rožňava | 18 | 3,0 % | **8,5 %** |
| Slovenský futbalový zväz | 18 | 3,0 % | 4,4 % |
| **ObFZ Senica (najnižšia miera)** | 4 | 0,7 % | **1,0 %** |

Podiel a miera hovoria každý niečo iné: veľký zväz má prirodzene väčší podiel, miera je
porovnateľná medzi veľkým a malým — pri malom zväze ňou ale hýbe aj jeden klub.

---

## Alt texty k snímkam

1. **01** Rebríček zväzov podľa podielu na všetkých 595 kluboch, ktoré na Slovensku zanikli
   v období 2014/15 – 2023/24: ObFZ Trebišov 29 klubov (4,9 %, miera vo zväze 11,4 %),
   Michalovce 28 (4,7 %), Prievidza 28 (4,7 %), Nitra 26, Trnava 25, Humenné 21, Levice 19,
   Prešov 18, Rožňava 18, SFZ 18. Priemerná miera na Slovensku je 3,7 % za sezónu.
2. **02** Porovnanie troch období: zaniknutých klubov za sezónu ubudlo zo 62 na 54, ale nových
   klubov ubudlo z 28 pred covidom na 15 počas neho a 13 dnes.
