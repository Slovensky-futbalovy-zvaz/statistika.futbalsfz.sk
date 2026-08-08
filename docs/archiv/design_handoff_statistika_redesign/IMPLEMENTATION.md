# Implementácia v Astro + ECharts — návod

Doplnok k `README.md`. Cieľ: preklopiť prototyp do produkčného stacku (**Astro SSG + ECharts islands + Tailwind v4 + brand tokeny**) čo najpriamočiarejšie. `README.md` = čo a ako má vyzerať; tento súbor = **kde to v kóde spraviť** + hotové recepty.

> Pozn.: v repe (`web/src`) je zatiaľ len `lib/data.ts` a `styles/global.css` — `.astro` stránky/komponenty nie sú commitnuté. Ak existuje lokálna necommitnutá verzia, zosúlaď ju s týmto; inak stavaj podľa štruktúry nižšie.

## Navrhovaná štruktúra `web/src`
```
src/
  styles/global.css            # → nahraď obsahom priloženého theme.css
  lib/
    data.ts                    # už existuje (čítanie JSON pri builde)
    format.ts                  # helpery (fmt, delta, ageLevel, choroColor) — viď nižšie
    palette.ts                 # REGION, GROUP_COLOR, PALETTE, METRICS, GROUPS
  layouts/
    Base.astro                 # <head>, fonty, Header, Footer, kontajner 1240px
  components/
    Header.astro               # logo + BETA badge + Nav + SeasonPicker (+ mobilný hamburger)
    Nav.astro / MobileMenu.tsx # navigácia; hamburger je island (klient)
    SeasonPicker.tsx           # custom dropdown (nie natívny <select>)
    ZvazPicker.tsx             # vyhľadávateľný výber zväzu (ObFZ pod RFZ) — island
    KpiCard.astro              # label + číslo + medziročná delta
    KpiBand.astro
    SlovakiaMap.tsx            # inline SVG choropleth (island: level+metric+hover+click)
    Leaderboard.astro
    SunburstSutaze.tsx         # ECharts sunburst + sport/gender filtre (island)
    SunburstOsoby.tsx          # ECharts 4-ring sunburst (island) — pozri Dátové medzery
    AgePyramid.tsx             # M/Ž pyramída, prepínač rola (island)
    CategoryBars.astro         # zápasy podľa kategórií + drill-down (island pre drill)
    OsobyCards.astro
    CompareRadar.tsx           # radar 2–5 zväzov (island)
    BumpChart.tsx              # poradie RFZ v čase (island)
    PorovnanieTable.tsx        # zoraditeľná tabuľka (island)
    DemografiaLines.tsx        # multi-line podľa kategórií/úrovní (island)
    SmallMultiples.astro
    ProjektView.tsx
  pages/
    index.astro                # Prehľad (default sezóna)
    zvaz/[id]/[sezona].astro           # Profil (futbal)
    zvaz/[id]/[odvetvie]/[sezona].astro# Profil (futsal a i.)
    porovnania/[uroven]/[sezona].astro # Porovnania
    demografia/[id].astro / demografia/index.astro
    projekty/index.astro, projekty/[id].astro
```
Astro = statický shell + SEO; **interaktívne časti sú islands** (`client:load`/`client:visible`) — mapa, sunbursty, radar, bump, pyramída, pickery, tabuľka, demografia lines.

## Helpery — `lib/format.ts`
```ts
export const fmt  = (n:number) => new Intl.NumberFormat('sk-SK').format(Math.round(n));
export const fmt1 = (n:number) => new Intl.NumberFormat('sk-SK',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);

// medziročná zmena: {pct, dir:'up'|'down'|'flat', good} ; pre karty (žlté/červené) daj goodUp=false
export function delta(cur:number, prev?:number, goodUp=true){
  if(prev==null || !prev) return null;
  const d=(cur-prev)/prev*100, up=d>=0, positive=goodUp?up:!up;
  return { pct:d, up, color: Math.abs(d)<0.05?'var(--color-muted)':(positive?'var(--color-good)':'var(--color-sfz-red)'),
           arrow: Math.abs(d)<0.05?'→':(up?'▲':'▼') };
}

// rok narodenia → veková úroveň (proxy pre demografiu; sezóna S = "RRRR/RRRR")
export const endYear = (s:string)=>parseInt(s.split('/')[1],10);
export const ageLevel = (age:number)=> age>=19 ? 'ADULTS' : 'U'+String(Math.min(Math.max(age+1,7),19)).padStart(2,'0');

// choropleth: sekvenčná modrá #dbe6ff → #1450df podľa t∈<0,1>
export function choroColor(t:number){
  const lo=[219,230,255], hi=[20,80,223], k=0.15+t*0.85;
  return '#'+lo.map((v,i)=>Math.round(v+(hi[i]-v)*k).toString(16).padStart(2,'0')).join('');
}
```

## Konštanty — `lib/palette.ts`
```ts
export const REGION = { bfz:'#1450df', zsfz:'#2f9bff', ssfz:'#12a06b', vsfz:'#f0961b' };
export const RFZ_LABEL = { bfz:'Bratislavský FZ', zsfz:'Západoslovenský FZ', ssfz:'Stredoslovenský FZ', vsfz:'Východoslovenský FZ' };
export const RFZ_OF_GEONAME = { BA:'bfz', ZsFZ:'zsfz', SsFZ:'ssfz', VsFZ:'vsfz' };
export const GROUPS = [
  { key:'Dospelí',   cats:['ADULTS'],                     color:'#1450df' },
  { key:'Dorast',    cats:['U19','U18','U17','U16'],       color:'#2f9bff' },
  { key:'Žiaci',     cats:['U15','U14','U13','U12'],       color:'#12a06b' },
  { key:'Prípravky', cats:['U11','U10','U09','U08','U07'], color:'#f0961b' },
];
export const PALETTE = ['#1450df','#ec1c24','#12a06b','#f0961b','#7a44e0','#2f9bff','#d6336c','#0a7d63','#b45309','#0891b2','#8b5cf6','#65a30d','#5b6470'];
export const METRICS = [
  {k:'zapasy',label:'Zápasy'},{k:'druzstva',label:'Družstvá'},{k:'goly',label:'Góly'},
  {k:'divaci',label:'Diváci'},{k:'hraci',label:'Hráči'} ];
```

## Mapa (choropleth) — inline SVG, NIE ECharts
`geo/mapa.json` = `{ viewBox, slovensko, rfz[{name,path}], obfz[{name,path}] }`. Region → id: RFZ cez `RFZ_OF_GEONAME[name]`, ObFZ cez `geoName → id` z `etl/config/zvazy.json`. Hodnota metriky: RFZ z `porovnania/rfz/{sezona}.json`, ObFZ z `porovnania/obfz/{sezona}.json`, SFZ = národný súčet.
```
<svg viewBox={mapa.viewBox}>
  {regions.map(r => <path d={r.path}
     fill={r.value ? choroColor((r.value-min)/(max-min||1)) : '#eef0f3'}
     stroke={hover?.id===r.id ? 'var(--color-sfz-red)' : '#fff'}
     strokeWidth={hover?.id===r.id ? 2.2 : 0.9}
     onMouseEnter/Move={…tooltip} onClick={() => goToProfil(r.id)} />)}
</svg>
```
Legenda: gradient `#dbe6ff → #1450df` s popiskami min/max.

## ECharts recepty (import len potrebné moduly cez `echarts/core` — tree-shaking, viď TODO)

### Sunburst — Súťaže (odvetvie → RFZ → ObFZ)
Zdroj `sumar/{sezona}.json.sunburstSutaze` (strom už hotový). Sport filter = zobraz len vetvy Futbal/Futsal. Gender filter = na listoch použi `pohlavie.M|F` namiesto `value` (prepočítať hodnoty stromu). Farby: `itemStyle.color` podľa RFZ (`REGION`), SFZ vlastné `#7a44e0`, Futsal `#ec1c24`.
```ts
option = { series:[{ type:'sunburst', radius:['18%','95%'], sort:null,
  data: buildTree(filteredRoot),            // {name, value?, children?, itemStyle:{color}}
  label:{ show:false }, emphasis:{ focus:'ancestor' },
  levels:[{}, {r0:'18%',r1:'45%'}, {r0:'45%',r1:'72%'}, {r0:'72%',r1:'95%'}] }],
  tooltip:{ formatter: p => `${p.name}: ${fmt(p.value)}` } };
```

### Sunburst — Osoby (odvetvie → úroveň → rola → vek) ⚠
**Placeholder, kým ETL nedodá agregát** (viď README „Dátové medzery"; SFZ úroveň = vrátane ULK/Niké liga). Do dodania: z `sunburstOsoby` (odvetvie→rola→vek) vlož medzi-úroveň úrovne s ilustračným pomerom Futbal `{SFZ:.06, RFZ:.34, ObFZ:.60}`, Futsal `{SFZ:1}`. Farby úrovní: SFZ `#1450df`, RFZ `#12a06b`, ObFZ `#f0961b`. Zobraz viditeľnú „ilustračné dáta" poznámku.

### Radar — priame porovnanie 2–5 zväzov
Zdroj `porovnania/{uroven}/{sezona}.json`. Normalizuj každú metriku na **maximum úrovne** (100 % = najlepší). Indicators: Zápasy, Diváci/zápas, Góly/zápas, Diváci, Hráči, Góly, Družstvá.
```ts
option = { radar:{ indicator: METRICS7.map(m=>({name:m.label, max:100})) },
  tooltip:{ formatter: p => p.name+'<br>'+ /* skutočné hodnoty zo surových dát */ },
  series:[{ type:'radar', data: selected.map((z,i)=>({
    name:z.nazov, value: METRICS7.map(m=> (z[m.k]/max[m.k])*100 ),
    itemStyle:{color:PALETTE[i]}, areaStyle:{opacity:.12} })) }] };
```

### Bump chart — poradie RFZ v čase
Pre každú sezónu zoraď 4 RFZ podľa metriky → rank 1–4. `yAxis` inverzné (1 hore), `line` séria per RFZ vo farbe `REGION`.
```ts
yAxis:{ inverse:true, min:1, max:4, interval:1 }, xAxis:{ type:'category', data: seasons }
series: ids.map(id => ({ name:RFZ_LABEL[id], type:'line', symbolSize:8, lineStyle:{width:3},
  itemStyle:{color:REGION[id]}, data: seasons.map(s=> rankOf(id,s)) }))
```

### Multi-line — Demografia podľa kategórií/úrovní
Séria = **vybraná kategória alebo veková úroveň** (default 4 kategórie). Hodnota per sezóna z `demografia/{sr|id}.json`: `age = endYear(s) - rokNarodenia`, `lvl = ageLevel(age)`; ak séria=kategória → sčítaj úrovne skupiny, ak séria=úroveň → presná zhoda; sčítaj `M+F+N`.
```ts
series: selectedKeys.map((key,i)=>({ name: key, type:'line', smooth:false, symbolSize:6,
  itemStyle:{color: isCategory(key)?GROUP_COLOR[key]:PALETTE[i]},
  data: seasons.map(s => sumForSeries(demo, s, key)) }))
```

### Veková pyramída (M/Ž)
Nie nutne ECharts — stačí diverging bar (HTML/CSS grid `1fr 58px 1fr`, M vľavo modrá, Ž vpravo červená) alebo ECharts `bar` s dvomi sériami (M záporné, Ž kladné) a `yAxis` = vekové pásma (50+, 40–49, 35–39, 30–34, 25–29, 20–24, 16–19, 13–15, 10–12, 6–9, ≤5). Zdroj `demografia/{id}.json.sezony[S][rola].roky`. Prepínač rola.

## KPI band
Karty (auto-fit minmax 150px): **Súťaže** (`kpi.sutaze`), Zápasy, Družstvá, Góly, Diváci, Žlté karty, Červené karty. Každá: uppercase label, `.tnum` číslo, `delta(cur,prev,goodUp)` — pre karty `goodUp=false`.

## Interakčné detaily (dodrž)
- Segmented toggle (úroveň): puzdro `#eceef1`, aktívny biely chip + tieň.
- Pills: aktívny = plná farba + biely text; inak biely + `1px #dcdfe4`.
- Custom SeasonPicker/ZvazPicker: **žiadny natívny `<select>`** — vlastný dropdown s overlay na zatvorenie; ZvazPicker má search (ignoruj diakritiku: `s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')`) a **ObFZ odsadené pod svojím RFZ**.
- Mobil < 760px: hamburger ☰ → panel s položkami (aktívna modrá) + sezóna.
- Prechody: bar width .3s, sunburst emphasis, map fill .15s.
- Permalink (F6): sezóna/zväz/metrika do URL/query.

## Poradie prác
1) `theme.css` → `global.css`; fonty do `Base.astro`. 2) Header (logo+BETA+picker+hamburger). 3) Prehľad (KPI+mapa+rebríček). 4) Sunbursty + pyramída + filtre. 5) Profil (picker, KPI YoY, drill, osoby, pyramída). 6) Porovnania (tabuľka+radar+bump). 7) Demografia (multi-line+rozpad+small multiples). 8) Projekty. 9) ETL agregát osôb per úroveň → finalizuj SunburstOsoby.
