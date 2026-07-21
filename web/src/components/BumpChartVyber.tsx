import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { BumpData } from '../lib/data';
import { PALETTE } from '../lib/palette';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface Props {
  bump: BumpData;
  /** Predvolene vybrané id zväzov (napr. top 4 podľa zápasov v poslednej sezóne). */
  defaultVyber?: string[];
}

const METRIKY = [
  { k: 'divaciNaZapas', label: 'Diváci/zápas' },
  { k: 'golyNaZapas', label: 'Góly/zápas' },
  { k: 'hraci', label: 'Hráči' },
  { k: 'zapasy', label: 'Zápasy' },
  { k: 'divaci', label: 'Diváci' },
];
const MAX_VYBER = 5;

/** Bump chart poradia vybraných ObFZ v čase. Poradie sa počíta spomedzi VŠETKÝCH zväzov
 *  úrovne (1 = najlepší), zobrazia sa len vybrané (2–5) čiary. */
export default function BumpChartVyber({ bump, defaultVyber = [] }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [metric, setMetric] = useState('divaciNaZapas');
  const [vyber, setVyber] = useState<string[]>(defaultVyber.slice(0, MAX_VYBER));

  const pocet = bump.zvazy.length;

  // poradie (rank) spomedzi všetkých zväzov pre danú sezónu a metriku
  const rankMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const s of bump.sezony) {
      const poradie = bump.zvazy
        .map((z) => ({ id: z.id, v: bump.hodnoty[s]?.[z.id]?.[metric] ?? null }))
        .filter((x) => x.v !== null)
        .sort((a, b) => (b.v as number) - (a.v as number));
      m[s] = {};
      poradie.forEach((p, i) => {
        m[s][p.id] = i + 1;
      });
    }
    return m;
  }, [bump, metric]);

  const series = useMemo(() => {
    return vyber.map((id, i) => {
      const z = bump.zvazy.find((x) => x.id === id);
      return {
        name: z?.nazov ?? id,
        type: 'line' as const,
        symbolSize: 8,
        lineStyle: { width: 3 },
        itemStyle: { color: PALETTE[i % PALETTE.length] },
        connectNulls: false,
        data: bump.sezony.map((s) => rankMap[s]?.[id] ?? null),
      };
    });
  }, [vyber, bump, rankMap]);

  useEffect(() => {
    if (!el.current || !vyber.length) return;
    if (!chart.current) chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' });
    chart.current.setOption(
      {
        legend: { type: 'scroll', top: 0, textStyle: { fontSize: 11 }, itemWidth: 18, itemGap: 8 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          valueFormatter: (v: number | null) => (v == null ? '—' : `${v}.`),
        },
        grid: { left: 40, right: 16, top: 96, bottom: 44 },
        xAxis: { type: 'category', data: bump.sezony, axisLabel: { fontSize: 10, rotate: 45 } },
        yAxis: {
          type: 'value',
          inverse: true,
          min: 1,
          max: pocet,
          interval: pocet > 12 ? 5 : 1,
          axisLabel: { formatter: (v: number) => `${v}.` },
        },
        series,
      },
      true,
    );
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, [series, bump, pocet, vyber.length]);

  function toggle(id: string) {
    setVyber((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX_VYBER ? cur : [...cur, id],
    );
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    borderRadius: 16,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? 'none' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  const chip = (active: boolean, disabled: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 14,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid ' + (active ? 'var(--color-sfz-blue)' : 'var(--color-line)'),
    background: active ? '#eef3ff' : 'transparent',
    color: active ? 'var(--color-sfz-blue)' : disabled ? '#b7bcc4' : 'var(--color-ink)',
  });

  const plno = vyber.length >= MAX_VYBER;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {METRIKY.map((m) => (
          <button key={m.k} type="button" style={pill(metric === m.k)} onClick={() => setMetric(m.k)}>
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginBottom: 6 }}>
        Vyber 2–5 zväzov (max {MAX_VYBER}); poradie je spomedzi všetkých {pocet} zväzov úrovne.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {bump.zvazy.map((z) => {
          const active = vyber.includes(z.id);
          const disabled = !active && plno;
          return (
            <button
              key={z.id}
              type="button"
              style={chip(active, disabled)}
              onClick={() => toggle(z.id)}
              disabled={disabled}
            >
              {z.nazov}
            </button>
          );
        })}
      </div>
      {vyber.length ? (
        <div ref={el} style={{ width: '100%', height: 380 }} role="img" aria-label="Bump chart poradia vybraných zväzov" />
      ) : (
        <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Vyber aspoň jeden zväz.</p>
      )}
    </div>
  );
}
