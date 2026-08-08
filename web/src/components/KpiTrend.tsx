import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { fmt } from '../lib/format';
import { GROUPS, GROUP_COLOR } from '../lib/palette';
import { METRIKA_POPIS } from '../lib/urovneTypy';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

type PerSeason = Record<string, Record<string, Record<string, number>>>;
// osoby: sezona -> rola -> kategoria -> počet
type PerSeasonOsoby = Record<string, Record<string, Record<string, number>>>;

interface Props {
  sezony: string[]; // vzostupne
  perSeason: PerSeason; // sezona -> kategoria(ADULTS/U19…) -> metrika -> hodnota (zápasové KPI, futbal)
  perSeasonOsoby?: PerSeasonOsoby;
  /** Ďalšie odvetvia (futsal, …) v rovnakej schéme ako perSeason — zapnú pill filter športu. */
  perSeasonOdvetvia?: Record<string, PerSeason>;
  /** Zobrazované názvy odvetví, napr. { futsal: 'Futsal' }. */
  odvetvieLabel?: Record<string, string>;
}

const ZAPASY_METRIKY = [
  // „Skupiny“ sa zobrazujú len tam, kde ich dáta naozaj nesú — pozri `maSkupiny` nižšie
  { k: 'skupiny', label: 'Skupiny' },
  { k: 'sutaze', label: 'Súťaže' },
  { k: 'zapasy', label: 'Zápasy' },
  { k: 'goly', label: 'Góly' },
  { k: 'divaci', label: 'Diváci' },
  { k: 'druzstva', label: 'Družstvá' },
  { k: 'zlte', label: 'Žlté karty' },
  { k: 'cervene', label: 'Červené karty' },
];
const OSOBY_METRIKY = [
  { k: 'hraci', label: 'Hráči' },
  { k: 'treneri', label: 'Tréneri' },
  { k: 'realizacnyTim', label: 'Realizačný tím' },
  { k: 'rozhodcovia', label: 'Rozhodcovia' },
  { k: 'delegati', label: 'Delegáti' },
  { k: 'personal', label: 'Personál' },
];
const OSOBA_KEYS = new Set(OSOBY_METRIKY.map((m) => m.k));
const FUTBAL = 'futbal';

/** Trend KPI aj osôb naprieč sezónami; série = vekové skupiny (Dospelí/Dorast/Žiaci/Prípravky). */
export default function KpiTrend({
  sezony,
  perSeason,
  perSeasonOsoby = {},
  perSeasonOdvetvia = {},
  odvetvieLabel = {},
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [metric, setMetric] = useState('zapasy');
  const [sel, setSel] = useState<string[]>(GROUPS.map((g) => g.key));

  // šport: futbal + odvetvia, ktoré majú dáta (pill filter sa zobrazí len ak je čo prepínať)
  const sporty = [
    { k: FUTBAL, label: 'Futbal' },
    ...Object.keys(perSeasonOdvetvia)
      .filter((o) => sezony.some((s) => Object.keys(perSeasonOdvetvia[o]?.[s] ?? {}).length > 0))
      .map((o) => ({ k: o, label: odvetvieLabel[o] ?? o.charAt(0).toUpperCase() + o.slice(1) })),
  ];
  const [selSport, setSelSport] = useState<string[]>(() => [FUTBAL, ...Object.keys(perSeasonOdvetvia)]);
  const jeOsoba = OSOBA_KEYS.has(metric);
  const maSporty = sporty.length > 1;

  // Profily KLUBOV metriku `skupiny` zatiaľ nemajú (počíta sa v `etl/run.py` pre zväzy).
  // Bez tejto kontroly by pill „Skupiny“ na stránke klubu ticho ukazoval hodnoty `sutaze`,
  // čo je horšie než ho nezobraziť vôbec.
  const maSkupiny = sezony.some((s) =>
    Object.values(perSeason[s] ?? {}).some((k) => (k as Record<string, number>)?.skupiny != null),
  );
  const zapasyMetriky = maSkupiny
    ? ZAPASY_METRIKY
    : ZAPASY_METRIKY.filter((m) => m.k !== 'skupiny');

  // ktoré osobné roly majú vôbec dáta (kluby nemajú rozhodcov/delegátov/personál)
  const osobyAvail = OSOBY_METRIKY.filter((m) =>
    sezony.some((s) => {
      const rr = perSeasonOsoby[s]?.[m.k];
      return rr && Object.values(rr).some((v) => (v as number) > 0);
    }),
  );

  function hodnota(s: string, groupKey: string): number {
    const g = GROUPS.find((x) => x.key === groupKey);
    if (!g) return 0;
    if (jeOsoba) {
      // osoby sú zatiaľ len za futbal (zdroj = demografia), pill filter športu sa na ne neuplatňuje
      const rr = perSeasonOsoby[s]?.[metric] || {};
      return g.cats.reduce((a, c) => a + (rr[c] ?? 0), 0);
    }
    let suma = 0;
    for (const sport of maSporty ? selSport : [FUTBAL]) {
      const kk = (sport === FUTBAL ? perSeason : perSeasonOdvetvia[sport])?.[s] || {};
      // skupiny sú fallbackom na súťaže — staršie profily pole `skupiny` nemajú
      suma += g.cats.reduce(
        (a, c) => a + (metric === 'skupiny' ? (kk[c]?.skupiny ?? kk[c]?.sutaze ?? 0) : (kk[c]?.[metric] ?? 0)),
        0,
      );
    }
    return suma;
  }

  useEffect(() => {
    if (!el.current) return;
    if (!chart.current) chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' });
    const series = sel.map((key) => ({
      name: key,
      type: 'line' as const,
      smooth: false,
      symbolSize: 6,
      itemStyle: { color: GROUP_COLOR[key] },
      data: sezony.map((s) => hodnota(s, key)),
    }));
    chart.current.setOption(
      {
        legend: { top: 0, type: 'scroll', textStyle: { fontSize: 11 } },
        tooltip: { trigger: 'axis', confine: true, valueFormatter: (v: unknown) => fmt(Number(v)) },
        grid: { left: 8, right: 14, top: 34, bottom: 8, containLabel: true },
        xAxis: { type: 'category', data: sezony, axisLabel: { fontSize: 10, rotate: 45 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: (v: number) => fmt(v) } },
        series,
      },
      true,
    );
    chart.current.resize();
  }, [metric, sel, selSport, sezony, perSeason, perSeasonOsoby, perSeasonOdvetvia]);

  useEffect(() => {
    const on = () => chart.current?.resize();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const toggle = (k: string) => setSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const toggleSport = (k: string) =>
    setSelSport((p) => (p.includes(k) ? (p.length > 1 ? p.filter((x) => x !== k) : p) : [...p, k]));

  const btn = (active: boolean, color?: string) => ({
    padding: '5px 10px', borderRadius: 16, fontSize: 12.5, fontWeight: active ? 700 : 500, cursor: 'pointer',
    border: '1px solid ' + (active ? (color ?? 'var(--color-sfz-blue)') : 'var(--color-line)'),
    background: active ? (color ?? 'var(--color-sfz-blue)') : 'transparent',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0 4px' }}>
        {zapasyMetriky.map((m) => (
          <button
            key={m.k}
            type="button"
            onClick={() => setMetric(m.k)}
            title={m.k === 'skupiny' || m.k === 'sutaze' ? METRIKA_POPIS[m.k].popis : undefined}
            style={btn(m.k === metric)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {osobyAvail.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 6px' }}>
          <span style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginRight: 2 }}>Osoby:</span>
          {osobyAvail.map((m) => (
            <button key={m.k} type="button" onClick={() => setMetric(m.k)} style={btn(m.k === metric)}>{m.label}</button>
          ))}
        </div>
      )}
      {maSporty && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 6px', opacity: jeOsoba ? 0.45 : 1 }}>
          <span style={{ alignSelf: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginRight: 2 }}>Šport:</span>
          {sporty.map((o) => (
            <button
              key={o.k}
              type="button"
              disabled={jeOsoba}
              title={jeOsoba ? 'Osoby sa vykazujú len za futbal' : undefined}
              onClick={() => toggleSport(o.k)}
              style={{ ...btn(selSport.includes(o.k)), ...(jeOsoba ? { cursor: 'not-allowed' } : {}) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {GROUPS.map((g) => (
          <button key={g.key} type="button" onClick={() => toggle(g.key)} style={btn(sel.includes(g.key), g.color)}>{g.key}</button>
        ))}
      </div>
      <div ref={el} style={{ width: '100%', height: 320 }} />
      {(metric === 'sutaze' || metric === 'skupiny') && (
        <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
          {METRIKA_POPIS[metric].popis} Počítajú sa len súťaže s aspoň jedným odohraným zápasom
          v danej sezóne; súťaž, ktorej zápasy patria do viacerých vekových úrovní, sa započíta
          v každej z nich — súčet cez vekové skupiny preto môže byť mierne vyšší než celkový počet.
        </p>
      )}
      {jeOsoba && (
        <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--color-muted)' }}>
          Pri osobách sa kategória určuje z <strong>ročníka narodenia</strong> (koncový rok sezóny
          mínus ročník), teda podľa <strong>vekovej úrovne osoby</strong>. Pri zápasoch, súťažiach
          a družstvách ide o <strong>vekovú úroveň súťaže alebo družstva</strong>, ktorá je zadaná
          priamo v súťaži. Sú to dve rôzne veci: sedemnásťročný hráč, ktorý nastupuje za
          dospelých, je tu v skupine Dorast, ale jeho zápasy sú medzi zápasmi dospelých.
        </p>
      )}
    </div>
  );
}
