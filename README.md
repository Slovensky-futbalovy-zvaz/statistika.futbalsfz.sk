# statistika.futbalsfz.sk

Verejný štatistický portál slovenského futbalu — **[statistika.futbalsfz.sk](https://statistika.futbalsfz.sk)**.

Interaktívna mapa všetkých troch úrovní futbalovej pyramídy (SFZ → 4 RFZ → 38 ObFZ), sezónne
štatistiky s drill-down na vekové úrovne, profily 2 000+ klubov, **počet klubov a jeho vývoj
v čase**, porovnávanie zväzov, demografia osôb vo futbale a trendy v čase — vek hráčov
v súťažiach dospelých a Index klubu.

> **Stav:** portál je **verejne v prevádzke**. Posledný build 24 768 stránok, dátová základňa
> pokrýva sezóny 2012/2013 – 2026/2027 a všetkých 43 zväzov.
> Otvorené úlohy a známe obmedzenia: [docs/TODO.md](docs/TODO.md).

## Ako to funguje

```
sportnet.online MongoDB („sutaze“) ──► ETL (Python) ──► statické JSON v data/ ──► Astro SSG ──► Vercel
```

Verejný web **nemá žiadny prístup k databáze ani interným API** — publikujú sa výhradne
agregované dáta, ktoré ETL vopred zapíše do `data/`. Zdôvodnenie v
[ADR-0001](docs/adr/0001-architektura-predgenerovane-json.md).

Nasadenie beží na Verceli, spúšťa sa pushom do `main`
([ADR-0006](docs/adr/0006-hosting-vercel-namiesto-cloudflare.md); pôvodné rozhodnutie o
Cloudflare Pages v ADR-0003 už v časti „web + CDN“ neplatí). Build trvá zhruba 10–12 minút
lokálne a 17–20 minút na Verceli.

> **Pozor pri commitoch:** commity s autorom `@futbalsfz.sk` Vercel **blokuje**. Používa sa
> autor `jan.letko@icloud.com`.

> **Pozor pred lokálnym buildom:** treba pozabíjať všetky bežiace `astro dev` servery, inak si
> dva Vite procesy konkurujú o cache a build sa zasekne na „Re-optimizing dependencies“.

## Štruktúra repozitára

| Priečinok | Obsah |
|---|---|
| `etl/` | ETL pipeline — agregácie zo Sportnet DB do publikovateľných JSON. Vlastné [README](etl/README.md) |
| `data/` | **Publikované dáta** — 29 000+ JSON súborov, ktoré číta web pri builde (nie vzorky) |
| `web/` | Frontend — Astro 5 (SSG) + React islands, TypeScript, Tailwind |
| `docs/` | Projektová dokumentácia, metodika, záznamy rozhodnutí (ADR). [Rozcestník](docs/README.md) |
| `docs/social/` | Podklady pre sociálne siete — text príspevku, vizuály 1080 × 1350 px, PDF carousely |
| `tools/og/` | Generátor OG obrázkov pre sociálne siete (HTML šablóna + headless Chrome) |
| `deploy/` | Docker prostredie pre týždenný beh ETL na Synology NAS |
| `.github/workflows/` | `tyzdenna.yml` — týždenná aktualizácia aktuálnej sezóny |

### Čo je v `data/`

| Priečinok / súbor | Súborov | Obsah |
|---|---|---|
| `zvaz/` | 609 | Profil zväzu za sezónu (43 zväzov × sezóny × odvetvia) |
| `klub/` | 21 972 | Profil klubu za sezónu |
| `kluby/` | 32 | **Počet klubov za sezónu** — celoslovensky, po zväzoch, podľa stavu mládeže |
| `vek/`, `vek-klub/` | 43 + 2 047 | Vekové histogramy pre stránku Trendy |
| `index-klubu/` | 2 076 | Index klubu po sezónach + celoslovenský prehľad `index-klubu.json` |
| `demografia/`, `demografia-klub/` | 43 + 2 029 | Rok narodenia × pohlavie × rola |
| `porovnania/` | 45 | Porovnávacie tabuľky zväzov a klubov |
| `sumar/` | 16 | Celoslovenský súhrn za sezónu |
| `projekty/` | 4 | Grassroots projekty (Dajme spolu gól, Disney, McDonald's) |
| `zanikanie.json` | 1 | Zánik a vznik klubov po sezónach, miery odchodu podľa stavu mládeže |

## Stránky portálu

Prehľad (`/`), profily zväzov (`/zvaz/…`), kluby (`/kluby`, `/klub/…`), porovnania
(`/porovnania/…`), demografia (`/demografia`), **Trendy** (`/trendy` — vek hráčov, starnúce
kluby, Index klubu), projekty (`/projekty`) a verejná
[dokumentácia metodiky](https://statistika.futbalsfz.sk/dokumentacia) (`/dokumentacia`).

## Súťaž vs. súťažná skupina

Počet súťaží sa na portáli vykazuje **dvoma metrikami súčasne** a používateľ medzi nimi prepína:

- **Súťažná skupina** — to, v čom sa reálne hrá: má vlastných účastníkov a vlastnú tabuľku.
- **Súťaž** — zastrešujúci celok tak, ako ho vypisuje riadiaci zväz; môže obsahovať viac skupín.

Dôvod: **rovnakú realitu vykazujú zväzy rôzne.** „IV. liga U19 ZsFZ“ je jedna súťaž so skupinami
A–F, ale VsFZ tie isté skupiny vedie ako šesť samostatných súťaží. **Počty súťaží preto medzi
zväzmi porovnateľné nie sú, počty skupín áno** — predvolená metrika je preto **Skupiny**
(`METRIKA_DEFAULT` v `web/src/lib/urovneTypy.ts`).

Databáza príznak typu časti nemá (stĺpec „Základná / Nadstavbová časť“ existuje len v ISSF), preto
ho ETL odhaduje dvoma sitami — štruktúrnym (nadstavba neprivedie nové družstvo) a podľa názvu
časti (baráž, play-off, finálový turnaj…). Celá metodika vrátane nameraných čísel je v
[docs/metodika.md](docs/metodika.md), kapitola „SÚŤAŽ vs. SÚŤAŽNÁ SKUPINA“. Žiadosť o explicitný
príznak zo Sportnetu je v [docs/TODO.md](docs/TODO.md).

**Publikované čísla sa spätne neprepisujú** — obe metriky sú vo výstupe vedľa seba.

## Počet klubov

**Aktívny klub = klub, ktorý v sezóne odohral aspoň jeden zápas** — nie klub zapísaný v registri.
Blok Počet klubov je na úvodnej stránke, na profiloch všetkých zväzov, v Porovnaniach a ako KPI
dlaždica; člení kluby podľa toho, či majú mládež, len dospelých, alebo len mládež.

Tri veci, ktoré treba pri tomto čísle vedieť:

- **Súčet po zväzoch je vyšší než celoslovenské číslo** — klub je započítaný v každom zväze,
  v ktorého súťaži hral. Sčítateľné číslo je `podlaDomovskehoZvazu`.
- **Do počtu vstupujú len regulárne súťaže riadené slovenskými zväzmi.** Reprezentačné a školské
  turnaje nie, Vysokoškolská liga áno. Databáza príznak „regulárna súťaž“ nemá, preto existuje
  ručný číselník [`etl/config/vylucene_sutaze.json`](etl/config/vylucene_sutaze.json).
- **Sezóny 2012/2013 a 2013/2014 sú roky nábehu ISSF** — evidencia v nich nie je úplná, preto sú
  v grafoch šrafované; rovnako šrafovaná je prebiehajúca sezóna.

## Zanikanie klubov

> **Za zaniknutý klub sa považuje klub, ktorý dva roky po sebe neprihlási do súťaže žiadne
> družstvo** (rozhodnutie Ján Letko, 15. 8. 2026).

Táto definícia je záväzná pre ETL, portál aj komunikáciu. Päť pravidiel, ktoré z nej plynú:

- **koniec v súťažiach dospelých nie je zánik**, pokiaľ klub má mládež (214 takých prípadov);
- **postup do vyššej ani zostup do nižšej súťaže nie je zánik** — aktivita sa posudzuje na celom
  Slovensku, nie vo zväze (domovský zväz sa mení pri 8,8 % dvojíc po sebe idúcich sezón; po
  zväzoch by vzniklo 658 falošných zánikov);
- **jednosezónna pauza nie je zánik** — po nej sa ešte vracia každý piaty klub, po dvoch už len
  necelá desatina;
- **poháre sa nerátajú vôbec** — do Slovnaft Cupu sa dostane len klub aktívny v súťažiach, takže
  pohárový zápas nie je dôkazom aktivity a vie poriadne pomýliť;
- **nový subjekt v ISSF nie je nový klub.** Rozlíšiť ich umožňuje súťažný poriadok: *zaniknutý
  klub, ktorý sa znova prihlási, musí začínať od poslednej ligy vo svojom ObFZ.* Subjekt, ktorý
  sa objaví vyššie, je pokračovaním klubu z tej istej obce. Automaticky spárovaných 23 dvojíc,
  výnimky v [`etl/config/nastupcovia.json`](etl/config/nastupcovia.json).

**Medzi zánikmi sú aj zlúčenia** — zánik subjektu nie je vždy koniec futbalu v obci. Doložené
zlúčenia sa nepočítajú, ostatné od skutočného konca odlíšiť nevieme. Ženské kluby a akadémie sa
vykazujú oddelene, lebo ich súťaže riadi SFZ.

Počíta to [`etl/zanikanie.py`](etl/zanikanie.py) → `data/zanikanie.json` (offline nad
`data/klub/`, bez databázy), overuje [`etl/kontrola_zanikania.py`](etl/kontrola_zanikania.py).
Namerané za obdobie 2014/2015 – 2023/2024: **566 zaniknutých klubov** (z toho 9 ženských a 3
akadémie), miera **8,6 %** za sezónu pri klube bez mládeže oproti **2,1 %** pri klube s mládežou.
Rozdelenie ObFZ 90,3 % / RFZ 8,1 % / SFZ 1,6 % — na úrovni SFZ zanikol jediný klasický klub.
Zobrazené v sekcii Zanikanie klubov na `/trendy`, metodika v [docs/metodika.md](docs/metodika.md).

## Kľúčové dokumenty

- [Metodika a poznatky o dátach](docs/metodika.md) — **najdôležitejší dokument v repe**;
  obsahuje overené pravidlá výpočtov, pasce v dátach a namerané čísla
- [TODO — otvorené úlohy a obmedzenia](docs/TODO.md)
- [Rozcestník dokumentácie](docs/README.md)
- [Projektový plán a koncept](docs/projektovy-plan.md)
  ([docx verzia](docs/Statistika-futbalsfz-sk_Projektovy-plan-a-koncept_v1.0.docx))
- [Report kvality dát](docs/report-kvality-dat.md)
- [Záznamy rozhodnutí (ADR)](docs/adr/) — ADR-0001 až ADR-0009
- [Podklady pre sociálne siete](docs/social/)

## Vývoj

```bash
# web
cd web && pnpm install
pnpm dev                 # dev server na http://localhost:4321
pnpm build               # produkčný build (24 000+ stránok, ~10–12 min)
npx tsc --noEmit         # typová kontrola .ts / .tsx
npx astro check          # typová kontrola vrátane .astro súborov

# ETL — vyžaduje prístup do MongoDB (read-only stačí)
export MONGODB_URI="mongodb://…"
python etl/run.py --zvaz obfz-nitra --sezona 2025/2026

# Zanikanie klubov — beží offline nad data/klub/, MongoDB netreba
python etl/zanikanie.py

# OG obrázky pre sociálne siete (1200×630) — prepíše len vymenované stránky
node tools/og/generuj.mjs trendy dokumentacia
```

> **`--hint` pri ETL** je obchádzka chýbajúceho indexu (ADR-0004). Používaj ho **len na
> jednotlivé sezóny, ktoré timeoutujú** (týka sa hlavne ZsFZ) — pri plných behoch
> vynucuje nevhodný index a spomalí ich približne 1,5× (zmerané 8. 8. 2026).

Podrobnosti o jednotlivých ETL skriptoch a poradí behov: [etl/README.md](etl/README.md).

## Kontakt

Produktový vlastník: **Ján Letko** (jan.letko@futbalsfz.sk)

---
© Slovenský futbalový zväz · Zdroj dát: platforma sportnet.online
