> ## ⚠️ Pred publikovaním
>
> - **Čísla sú z portálu.** Sekcia **Zanikanie klubov** na `/trendy` ich nesie všetky —
>   graf tokov po sezónach, tri obdobia aj rebríček všetkých 43 zväzov s prepínačom metriky.
>   Zdroj je `data/zanikanie.json` (`etl/zanikanie.py`), overenie `etl/kontrola_zanikania.py`.
> - **Toky sú horná hranica.** Nový subjekt v ISSF nie je nutne nový klub — pri novej
>   registrácii vznikne nové IČO bez väzby na predchodcu (nameraných aspoň 41 párov). Stavov
>   klubov a mier odchodu sa to netýka.
> - **Rebríček zväzov je citlivá vec.** Sú tam menované konkrétne ObFZ. Čísla sedia a sú
>   verejne overiteľné, ale je namieste dať to vopred vedieť dotknutým zväzom — najmä
>   ObFZ Trebišov, Michalovce, Rožňava, Rimavská Sobota, Svidník a Humenné.
> - **Sezóny nábehu ISSF ani prebiehajúca sezóna do analýzy nevstupujú**; posledné dve
>   hodnotené sezóny sú provizórne.

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

**Najprv to, čo nás prekvapilo najviac.** Tempo odchodov je celé sledované obdobie takmer
rovnaké — okolo **52 až 54 klubov za sezónu**, a v posledných sezónach dokonca mierne klesá.
Čo sa zmenilo, je druhá strana rovnice: pred covidom vzniklo **28 nových klubov za sezónu**,
počas covidu 15 a dnes **13**. Úbytok teda nerobí to, že by klubov zanikalo viac. Robí ho to,
že nových pribúda polovica.

**A kde.** Rozdiely medzi oblasťami sú väčšie, než by človek čakal. Priemer za celé Slovensko je
**3,1 % klubo-sezón** — toľkokrát sa stane, že klub odohrá sezónu a už nikdy nenastúpi.
V **ObFZ Trebišov je to 10,2 %**, teda viac než trojnásobok; z 42 klubov mu zostalo 19.
Nasledujú ObFZ Rimavská Sobota (9,7 %), Mestský FZ Košice (8,2 %), ObFZ Rožňava (8,1 %),
ObFZ Zvolen (7,5 %) a ObFZ Komárno (7,3 %). Absolútne najviac klubov stratil **ObFZ Michalovce
— tridsať** (63 → 33).

Na druhej strane rebríčka je **ObFZ Senica s 0,6 %** a o klub viac než pred desiatimi rokmi.
Rastie aj Bratislava a ObFZ Trenčín. Obraz je regionálny: juh a východ ubúdajú, západ
a Považie držia.

**Čo s tým.** Toto už nie je čítanie z dát, to je náš pohľad. Ak sa problém presunul z „kluby
zanikajú“ na „nové nevznikajú“, potom podpora, ktorá udržiava existujúce kluby pri živote, na
zvrátenie trendu nestačí — chýba niečo, čo pomôže klub **založiť a udržať prvé tri sezóny**.
A platí to hlavne tam, kde je to najhoršie: v okresoch, ktoré strácajú aj obyvateľov.

**Ako to počítame.** Za zaniknutý považujeme klub, ktorý odohral svoju poslednú sezónu a odvtedy
už nenastúpil — nie klub, ktorý si dal pauzu, a **nie klub, ktorý skončil v súťažiach
dospelých**, pokiaľ má mládež. Miera odchodu je podiel z klubo-sezón, takže sa dá porovnávať
medzi veľkým a malým zväzom. Odchod sa pripisuje domovskému zväzu klubu; počet klubov vedľa
neho je ten istý údaj, aký má zväz na svojom profile. Sezóny nábehu ISSF (2012/2013 a 2013/2014)
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

| Obdobie | Odchodov za sezónu | Nových klubov za sezónu |
|---|---|---|
| do 2018/2019 | 54,4 | **28,3** |
| 2019/2020 – 2021/2022 (covid) | 54,3 | **15,3** |
| od 2022/2023 | 52,0 | **13,5** |

Najhoršia jednotlivá sezóna: **2021/2022 (−57 klubov)**. Medziročne posledné sezóny −29, −26, −11.

### Kde (miera definitívneho odchodu, priemer SR 3,1 %)

| Zväz | Miera | Klubov 2014/15 → 2025/26 |
|---|---|---|
| ObFZ Trebišov | **10,2 %** | 42 → 19 |
| ObFZ Rimavská Sobota | 9,7 % | 16 → 15 |
| Mestský FZ Košice | 8,2 % | 7 → 15 |
| ObFZ Rožňava | 8,1 % | 29 → 15 |
| ObFZ Zvolen | 7,5 % | 35 → 28 |
| ObFZ Komárno | 7,3 % | 16 → 22 |
| ObFZ Svidník | 6,5 % | 25 → 14 |
| ObFZ Michalovce | 5,9 % | **63 → 33** |
| ObFZ Vranov nad Topľou | 5,2 % | 23 → 18 |
| ObFZ Humenné | 5,1 % | 48 → 34 |
| **ObFZ Senica (najmenej)** | **0,6 %** | 47 → 48 |

---

## Alt texty k snímkam

1. **01** Rebríček zväzov podľa miery definitívneho odchodu klubu za sezónu: ObFZ Trebišov
   10,2 %, Rimavská Sobota 9,7 %, Mestský FZ Košice 8,2 %, Rožňava 8,1 %, Zvolen 7,5 %,
   Komárno 7,3 %, Svidník 6,5 %, Michalovce 5,9 %, Vranov nad Topľou 5,2 %, Humenné 5,1 %.
   Priemer Slovenska je 3,1 %.
2. **02** Porovnanie troch období: odchodov je stále okolo 52 až 54 za sezónu, ale nových klubov
   ubudlo z 28 pred covidom na 15 počas neho a 13 dnes.
