# Glosár SK → EN pre portál štatistika.futbalsfz.sk

**Na schválenie, 20. 8. 2026.** Toto je terminologický základ anglickej verzie portálu. Kým to
neschválite, neprekladá sa nič — inak by sa 18 000 slov prepisovalo dvakrát.

Stĺpec **Návrh** je to, čo použijem. Stĺpec **Alternatíva** je to, čo som zvažoval a prečo som to
nevybral. Riadky označené **⚠️ ROZHODNUTIE** potrebujú tvoje slovo — sú to prípady, kde je viac
legitímnych možností a voľba ovplyvní celý portál.

---

## 1. Organizačná štruktúra

| Slovensky | Návrh | Alternatíva / poznámka |
|---|---|---|
| Slovenský futbalový zväz (SFZ) | **Slovak Football Association (SFZ)** | Skratku SFZ nechávam, je to značka; „SFA“ by nikto nespoznal |
| Regionálny futbalový zväz (RFZ) | **regional football association (RFZ)** | ⚠️ ROZHODNUTIE — viď nižšie |
| Oblastný futbalový zväz (ObFZ) | **district football association (ObFZ)** | ⚠️ ROZHODNUTIE — viď nižšie |
| zväz (všeobecne) | **association** | „federation“ používa FIFA pre národné federácie, na regionálnu úroveň sa nehodí |
| riadiaci zväz súťaže | **competition organiser** | „governing association“ je presnejšie právne, ale dlhé do tabuliek |
| vlastník súťaže | **competition owner** | |
| domovský zväz klubu | **home association** | |
| úroveň zväzu (SFZ / RFZ / ObFZ) | **association tier** | |
| pyramída zväzov | **association pyramid** | |

> **⚠️ ROZHODNUTIE 1 — ako prekladať RFZ a ObFZ.** Tri možnosti:
> - **(a) regional / district football association** — čitateľné pre cudzinca, zaužívané v UEFA
>   dokumentoch (odporúčam)
> - **(b) regional / sub-regional football association** — presnejšie hierarchicky, ale „sub-regional“
>   je kancelárske
> - **(c) nechať RFZ / ObFZ bez prekladu** s vysvetlením raz na stránke — najbezpečnejšie voči
>   oficiálnym dokumentom, ale cudzinec z názvu nič nepochopí
>
> Skratky RFZ/ObFZ ostanú v každom prípade, menia sa len rozpisy. Vlastné názvy zväzov
> („ObFZ Prievidza“, „Stredoslovenský futbalový zväz“) **neprekládam vôbec** — sú to vlastné mená
> a v dátach sú kľúčom.

## 2. Súťaže

| Slovensky | Návrh | Alternatíva / poznámka |
|---|---|---|
| súťaž | **competition** | |
| ročník súťaže / sezóna | **season** (zápis `2025/26`) | Na portáli je `2025/2026`; v EN je zvykom `2025/26` — ⚠️ ROZHODNUTIE 4 |
| časť súťaže | **competition phase** | „stage“ používa UEFA pre skupinovú/vyraďovaciu fázu; „phase“ sedí lepšie na našu štruktúru |
| základná časť | **regular phase** | |
| nadstavba | **play-off phase** | |
| skupina o postup | **promotion group** | |
| skupina o udržanie | **relegation group** | |
| skupina | **group** | |
| úroveň súťaže / liga | **league tier** (1. liga = tier 1) | „level“ je v dátach pole `level`, v texte je „tier“ jasnejšie |
| pyramída líg | **league pyramid** | |
| postup / zostup | **promotion / relegation** | |
| veková úroveň | **age level** (U15, U19, ADULTS) | |
| veková kategória | **age category** | |
| — Dospelí | **Adults** | ⚠️ ROZHODNUTIE 2 |
| — Dorast | **Juniors (U19)** | ⚠️ ROZHODNUTIE 2 |
| — Žiaci | **Youth (U15)** | ⚠️ ROZHODNUTIE 2 |
| — Prípravka | **Mini (U11)** | ⚠️ ROZHODNUTIE 2 |
| pohlavie | **gender**; muži / ženy | **men / women** |
| šport / odvetvie | **discipline** (futbal, futsal, plážový futbal) | V dátach je to `sportSector`; „sport sector“ je interný pojem, do UI sa nehodí |
| pohár | **cup** | Slovnaft Cup zostáva Slovnaft Cup |

> **⚠️ ROZHODNUTIE 2 — vekové kategórie.** Naše štyri kategórie nemajú v angličtine jednotný
> ekvivalent, každá krajina to volá inak. Možnosti:
> - **(a) Adults / Juniors (U19) / Youth (U15) / Mini (U11)** — odporúčam, číslo v zátvorke
>   odstráni každú pochybnosť
> - **(b) Senior / U19 / U15 / U11** — najstručnejšie, dobré do grafov, ale „U19“ ako názov
>   kategórie sa bije s vekovou úrovňou U19, ktorá je iná dimenzia (portál ich rozlišuje!)
> - **(c) Adults / Under-19 / Under-15 / Under-11** — najzrozumiteľnejšie, ale dlhé do tabuliek
>
> Pozor, toto je práve to miesto, kde portál zámerne rozlišuje **vekovú úroveň** (U15 ako súťaž)
> od **vekovej kategórie** (Žiaci ako medzisúčet). V angličtine to musí zostať rozlíšené, inak
> sa stratí základný kľúč metodiky.

## 3. Zápasy

| Slovensky | Návrh | Alternatíva / poznámka |
|---|---|---|
| zápas | **match** | |
| odohraný zápas | **match played** | Naša definícia: uzavretý zápas bez administratívnych kontumácií |
| uzavretý zápas | **closed match** | Stav v ISSF; v EN texte vysvetlím raz |
| zápis o stretnutí | **match report** | |
| nominácia / zostava | **line-up** | |
| kontumácia | **forfeit** | „walkover“ je výsledok, „forfeit“ je akt — na náš príznak `isContumated` sedí forfeit |
| kontumovaný zápas | **forfeited match** | |
| odstúpené družstvo | **withdrawn team** | |
| administratívne ukončený zápas | **administratively closed match** | V texte doplním „(not actually played)“ |
| gól | **goal** | |
| diváci | **attendance** | ⚠️ ROZHODNUTIE 3 |
| žltá / červená karta | **yellow / red card** | |
| pokrytie údaju o divákoch | **attendance data coverage** | |

> **⚠️ ROZHODNUTIE 3 — diváci.** „Attendance“ je súčet návštevnosti (odporúčam, je to štandard
> v štatistike), „spectators“ sú ľudia. Portál sčítava návštevnosť zo zápisov, takže attendance je
> správnejšie — ale ak chceš doslovné „spectators“, prispôsobím.

## 4. Osoby

| Slovensky | Návrh | Alternatíva / poznámka |
|---|---|---|
| osoba | **individual** | „person“ je v UI menej formálne; v grafoch bude „individuals“ |
| registrovaná osoba | **registered individual** | |
| unikátne osoby | **unique individuals** | Kľúčový pojem po dnešnej oprave |
| hráč | **player** | |
| tréner | **coach** | |
| rozhodca | **referee** | |
| delegát stretnutia | **match delegate** | |
| pozorovateľ rozhodcov | **referee observer** | |
| personál (usporiadateľ, hlásateľ, videotechnik) | **other match personnel** | „match officials“ sa v EN chápe ako rozhodcovia — nesmieme to použiť |
| — usporiadateľ | **steward** | |
| — hlásateľ | **announcer** | |
| — videotechnik | **video technician** | |
| realizačný tím | **support staff** | |
| vedúci družstva | **team manager** | |
| delegovaná osoba | **appointed official** | |
| rok narodenia | **year of birth** | |
| vek | **age** | |
| medián veku | **median age** | |
| veková pyramída | **age pyramid** | |
| dvojité pôsobenie | **dual involvement** | Náš pojem pre osobu pôsobiacu vo viacerých zväzoch |

## 5. Kluby a družstvá

| Slovensky | Návrh | Alternatíva / poznámka |
|---|---|---|
| klub | **club** | |
| družstvo | **team** | |
| aktívny klub | **active club** | |
| zaniknutý klub | **defunct club** | ⚠️ ROZHODNUTIE 5 |
| odstúpený klub | **withdrawn club** | Náš pojem: prvú sezónu bez družstva, predchádzajúcu aspoň s jedným |
| odhlásenie družstva | **team withdrawal** | Odhlasujú sa družstvá, nie kluby — v EN to musí byť rovnako dôsledné |
| nový klub / vznik klubu | **newly formed club** | |
| preregistrácia klubu | **club re-registration** | Nové IČO, ten istý klub |
| zlúčenie klubov | **club merger** | |
| právny nástupca | **legal successor** | |
| miera odchodu | **attrition rate** | „churn rate“ je marketingové, „attrition“ sedí na kluby |
| podiel na SR | **share of national total** | |
| Index klubu | **Club Index** | Vlastné meno metriky, s veľkými písmenami |
| mládežnícka základňa | **youth base** | |
| klub bez mládeže | **club with no youth teams** | |
| klubosezóna | **club-season** | Jednotka expozície pri mierach |

> **⚠️ ROZHODNUTIE 5 — zaniknutý klub.** Naša definícia je „dva roky po sebe neprihlási žiadne
> družstvo“. Možnosti:
> - **(a) defunct club** — odporúčam, znamená „už neexistuje/nefunguje“, a v texte vždy uvedieme
>   definíciu
> - **(b) dissolved club** — implikuje právne zrušenie subjektu, čo my nemeriame (klub môže
>   právne existovať a nehrať)
> - **(c) inactive club** — najpresnejšie voči tomu, čo naozaj meriame, ale znie mierne a ľudia
>   by to čítali ako „dočasne nehrá“
>
> Ja by som išel do **(a) defunct** a v EN definícii doslova napísal *„a club that has not entered
> a single team in a competition for two consecutive seasons“*.

## 6. Metodické pojmy

| Slovensky | Návrh |
|---|---|
| prebiehajúca sezóna | **current season (in progress)** |
| rozbeh sezóny | **season ramp-up** |
| sezóny nábehu ISSF | **ISSF roll-out seasons** |
| odtlačok sezóny | **season fingerprint** |
| súčet po zväzoch | **sum across associations** |
| celoslovensky / za SR | **national total** |
| metodika | **methodology** |
| výhrada / obmedzenie | **caveat** |
| zdroj dát | **data source** |
| agregované počty | **aggregated counts** |
| prepočet | **recalculation** |
| týždenná aktualizácia | **weekly update** |

## 7. Navigácia a UI

| Slovensky | Návrh |
|---|---|
| Prehľad | **Overview** |
| Zväzy | **Associations** |
| Kluby | **Clubs** |
| Porovnania | **Comparisons** |
| Trendy | **Trends** |
| Demografia | **Demographics** |
| Projekty | **Projects** |
| Dokumentácia | **Methodology** *(nie „Documentation“ — obsahom je metodika)* |
| Sezóna | **Season** |
| Zdroj: ISSF | **Source: ISSF** |
| Spolu | **Total** |
| Medziročne | **Year-on-year** |
| Priemer | **Average** |
| Podiel | **Share** |
| Zobraziť všetky | **Show all** |
| Zrušiť filtre | **Clear filters** |

---

## Čo potrebujem od teba

1. **Rozhodnutie 1** — RFZ a ObFZ: *regional / district*, *regional / sub-regional*, alebo bez prekladu?
2. **Rozhodnutie 2** — vekové kategórie: *Adults / Juniors (U19) / Youth (U15) / Mini (U11)*, alebo iná varianta?
3. **Rozhodnutie 3** — diváci: *attendance* alebo *spectators*?
4. **Rozhodnutie 4** — zápis sezóny: `2025/2026` (ako teraz) alebo `2025/26` (anglická konvencia)?
5. **Rozhodnutie 5** — zaniknutý klub: *defunct*, *dissolved*, alebo *inactive*?
6. **Existuje oficiálny anglický zdroj?** Ak má SFZ anglickú verziu súťažného poriadku, RaPP alebo
   stanov, terminológiu preberiem odtiaľ a tento glosár sa jej podriadi.

Keď to odklikneš, spustím 1. etapu: navigácia, labely, hlavičky tabuliek a názvy KPI a grafov.
Čísla sú jazykovo neutrálne, takže portál bude po anglicky použiteľný hneď po prvej etape.
