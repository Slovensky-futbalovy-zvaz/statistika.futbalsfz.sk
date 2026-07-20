import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { BumpData } from '../lib/data';
import { REGION } from '../lib/palette';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface Props {
  bump: BumpData;
}

const METRIKY = [
  { k: 'divaciNaZapas', label: 'Diváci/zápas' },
  { k: 'golyNaZapas', label: 'Góly/zápas' },
  { k: 'hraci', label: 'Hráči' },
  { k: 'zapasy', label: 'Zápasy' },
  { k: 'divaci', label: 'Diváci' },
];

/** Bump chart — poradie 4 RFZ v čase podľa zvolenej metriky (1 = najlepší). */
export default function BumpChart({ bump }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [metric, setMetric] = useState('divaciNaZapas');

  const series = useMemo(() => {
    return bump.zvazy.map((z) => ({
      name: z.nazov,
      type: 'line' as const,
      symbolSize: 9,
      lineStyle: { width: 3 },
      itemStyle: { color: REGION[z.id] ?? '#888' },
      data: bump.sezony.map((s) => {
        const poradie = [...bump.zvazy]
          .map((zz) => ({ id: zz.id, v: bump.hodnoty[s]?.[zz.id]?.[metric] ?? 0 }))
          .sort((a, b) => b.v - a.v);
        const rank = poradie.findIndex((p) => p.id === z.id) + 1;
        return rank || null;
      }),
    }));
  }, [bump, metric]);

  useEffect(() => {
    if (!el.current) return;
    if (!chart.current) chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' });
    chart.current.setOption(
      {
        legend: { top: 0, textStyle: { fontSize: 11 } },
        tooltip: { trigger: 'axis', confine: true },
        grid: { left: 40, right: 16, top: 40, bottom: 40 },
        xAxis: { type: 'category', data: bump.sezony, axisLabel: { fontSize: 10, rotate: 45 } },
        yAxis: {
          type: 'value',
          inverse: true,
          min: 1,
          max: bump.zvazy.length,
          interval: 1,
          axisLabel: { formatter: (v: number) => `${v}.` },
        },
        series,
      },
      true,
    );
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, [series, bump]);

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

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {METRIKY.map((m) => (
          <button key={m.k} type="button" style={pill(metric === m.k)} onClick={() => setMetric(m.k)}>
            {m.label}
          </button>
        ))}
      </div>
      <div ref={el} style={{ width: '100%', height: 340 }} role="img" aria-label="Bump chart poradia RFZ" />
    </div>
  );
}
