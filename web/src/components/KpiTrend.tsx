import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { fmt } from '../lib/format';
import { GROUPS, GROUP_COLOR } from '../lib/palette';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

type PerSeason = Record<string, Record<string, Record<string, number>>>;
interface Props {
  sezony: string[]; // vzostupne
  perSeason: PerSeason; // sezona -> kategoria(ADULTS/U19…) -> metrika -> hodnota
}

const METRIKY = [
  { k: 'zapasy', label: 'Zápasy' },
  { k: 'goly', label: 'Góly' },
  { k: 'divaci', label: 'Diváci' },
  { k: 'druzstva', label: 'Družstvá' },
  { k: 'zlte', label: 'Žlté karty' },
  { k: 'cervene', label: 'Červené karty' },
];

/** Trend hlavných KPI naprieč sezónami, série = vekové skupiny (Dospelí/Dorast/Žiaci/Prípravky). */
export default function KpiTrend({ sezony, perSeason }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [metric, setMetric] = useState('zapasy');
  const [sel, setSel] = useState<string[]>(GROUPS.map((g) => g.key));

  function hodnota(s: string, groupKey: string): number {
    const kat = perSeason[s] || {};
    const g = GROUPS.find((x) => x.key === groupKey);
    if (!g) return 0;
    let sum = 0;
    for (const c of g.cats) sum += kat[c]?.[metric] ?? 0;
    return sum;
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
  }, [metric, sel, sezony, perSeason]);

  useEffect(() => {
    const on = () => chart.current?.resize();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const toggle = (k: string) => setSel((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '2px 0 6px' }}>
        {METRIKY.map((m) => (
          <button
            key={m.k}
            type="button"
            onClick={() => setMetric(m.k)}
            style={{
              padding: '5px 10px', borderRadius: 16, fontSize: 12.5, fontWeight: m.k === metric ? 700 : 500, cursor: 'pointer',
              border: '1px solid ' + (m.k === metric ? 'var(--color-sfz-blue)' : 'var(--color-line)'),
              background: m.k === metric ? 'var(--color-sfz-blue)' : 'transparent',
              color: m.k === metric ? '#fff' : 'var(--color-ink)',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
        {GROUPS.map((g) => {
          const on = sel.includes(g.key);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => toggle(g.key)}
              style={{
                padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid ' + (on ? g.color : 'var(--color-line)'),
                background: on ? g.color : 'transparent',
                color: on ? '#fff' : 'var(--color-muted)',
              }}
            >
              {g.key}
            </button>
          );
        })}
      </div>
      <div ref={el} style={{ width: '100%', height: 320 }} />
    </div>
  );
}
