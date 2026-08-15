> ## ⚠️ Pred publikovaním
>
> - **Definícia (Ján Letko, 15. 8. 2026): zaniknutý klub = klub, ktorý dva roky po sebe
>   neprihlási do súťaže žiadne družstvo.** Poháre sa nerátajú. Nový subjekt v ISSF nie je nový
>   klub — zaniknutý klub, ktorý sa vráti, musí začínať od poslednej ligy svojho ObFZ.
>   **Medzi zánikmi sú aj zlúčenia**, zánik subjektu nie je vždy koniec futbalu v obci.
>   Ženské kluby (9) a akadémie (3) sa vykazujú oddelene — ich súťaže riadi SFZ, preto vychádzajú
>   na tú úroveň správne. Na úrovni SFZ zanikol jediný klasický klub: FC VSS Košice. Postup do vyššej ani zostup do nižšej súťaže zánik
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

> ## 📦 Podklady na publikovanie
>
> V podpriečinku [`na-publikovanie/`](na-publikovanie/):
>
> | Súbor | Kam |
> |---|---|
> | `prispevok-linkedin.txt` | LinkedIn SFZ — **2 391 znakov** (limit príspevku je 3 000) |
> | `prispevok-facebook.txt` | Facebook SFZ — 2 887 znakov, s krátkym háčikom do náhľadu a dvoma číslami navyše |
> | `alt-texty.txt` | alt texty k obom snímkam |
> | `zanikanie-klubov-linkedin-carousel.pdf` | 2 strany — na LinkedIn nahrať ako dokument |
>
> Snímky sú v tomto priečinku (`01-kde.png`, `02-kedy.png`).

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
zo 60 klubov za sezónu pred covidom na 46 dnes. Čo sa zmenilo, je druhá strana rovnice: pred
covidom vzniklo **27 nových klubov za sezónu**, počas covidu 14 a dnes **12**. Úbytok teda
nerobí to, že by klubov zanikalo viac. Robí ho to, že nových pribúda polovica.

**A kde.** V období 2014/15 – 2023/24 zaniklo na Slovensku **566 klubov**. Najväčší podiel
z nich pripadá na **ObFZ Trebišov (30 klubov, 5,3 %)**, **ObFZ Michalovce (29)** a **ObFZ
Prievidza (28)**. Toto je ale len jedna polovica obrazu — veľký zväz má prirodzene viac
zánikov. Druhá polovica je, ako často sa to stane klubu daného zväzu: priemer Slovenska je
**3,6 % za sezónu**, ObFZ Trebišov má **12,0 %**, ObFZ Rožňava 9,2 %, ObFZ Michalovce 6,4 % —
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
| do 2018/2019 | 60,2 | **26,7** |
| 2019/2020 – 2021/2022 (covid) | 57,7 | **13,7** |
| od 2022/2023 | 46,0 | **12,0** |

Zaniknutých spolu 566 (z toho 56 sa po dvoch tichých sezónach ešte vrátilo — podľa definície
zostávajú zaniknuté). Čistý úbytok klubov medziročne: posledné sezóny −29, −26, −11.

### Kde (566 zaniknutých klubov, 2014/15 – 2023/24; priemerná miera SR 3,6 %)

| Zväz | Zaniknutých | Podiel na SR | Miera vo zväze |
|---|---|---|---|
| ObFZ Trebišov | 30 | **5,3 %** | **12,0 %** |
| ObFZ Michalovce | 29 | 5,1 % | 6,4 % |
| ObFZ Prievidza | 28 | 5,0 % | 3,9 % |
| ObFZ Nitra | 26 | 4,6 % | 3,6 % |
| ObFZ Trnava | 24 | 4,2 % | 3,5 % |
| ObFZ Humenné | 21 | 3,7 % | 5,7 % |
| ObFZ Levice | 19 | 3,4 % | 4,9 % |
| ObFZ Prešov | 18 | 3,2 % | 2,9 % |
| ObFZ Rožňava | 19 | 3,4 % | **9,2 %** |
| ObFZ Košice-okolie | 16 | 2,8 % | 4,7 % |
| **ObFZ Senica (najnižšia miera)** | 4 | 0,7 % | **1,0 %** |

Podiel a miera hovoria každý niečo iné: veľký zväz má prirodzene väčší podiel, miera je
porovnateľná medzi veľkým a malým — pri malom zväze ňou ale hýbe aj jeden klub.

---

## Alt texty k snímkam

1. **01** Rebríček zväzov podľa podielu na všetkých 566 kluboch, ktoré na Slovensku zanikli
   v období 2014/15 – 2023/24: ObFZ Trebišov 30 klubov (5,3 %, miera vo zväze 12,0 %),
   Michalovce 29 (5,1 %), Prievidza 28 (5,0 %), Nitra 26, Trnava 24, Humenné 21, Levice 19,
   Rožňava 19, Prešov 18, Košice-okolie 16. Priemerná miera na Slovensku je 3,6 % za sezónu.
2. **02** Porovnanie troch období: zaniknutých klubov za sezónu ubudlo zo 60 na 46, ale nových
   klubov ubudlo z 27 pred covidom na 14 počas neho a 12 dnes.
