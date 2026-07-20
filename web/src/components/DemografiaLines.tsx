import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { Demografia } from '../lib/data';
import { fmt, endYear, ageLevel } from '../lib/format';
import { GROUPS, GROUP_COLOR, PALETTE, ROLA_LABEL, ROLY_PORADIE, skupinaKategorie } from '../lib/palette';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

interface Props {
  demo: Demografia;
}

const U_LEVELS = ['ADULTS', 'U19', 'U18', 'U17', 'U16', 'U15', 'U14', 'U13', 'U12', 'U11', 'U10', 'U09', 'U08', 'U07'];

/** Multi-line demografia: séria = veková kategória alebo úroveň (default 4 skupiny). */
export default function DemografiaLines({ demo }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const barEl = useRef<HTMLDivElement>(null);
  const barChart = useRef<echarts.ECharts | null>(null);
  const [rola, setRola] = useState('hraci');
  const [sel, setSel] = useState<string[]>(GROUPS.map((g) => g.key)); // default 4 skupiny

  const sezony = useMemo(() => Object.keys(demo.sezony).sort(), [demo]);
  const dostupneRoly = ROLY_PORADIE.filter((r) => sezony.some((s) => (demo.sezony[s]?.[r]?.osoby ?? 0) > 0));

  // hodnota série (skupina alebo úroveň) v sezóne
  function hodnota(sezona: string, key: string): number {
    const r = demo.sezony[sezona]?.[rola];
    if (!r) return 0;
    const ey = endYear(sezona);
    let sum = 0;
    for (const [yr, pg] of Object.entries(r.roky)) {
      const lvl = ageLevel(ey - parseInt(yr, 10));
      const zhoda = GROUPS.some((g) => g.key === key) ? skupinaKategorie(lvl) === key : lvl === key;
      if (zhoda) sum += (pg.M ?? 0) + (pg.F ?? 0) + (pg.N ?? 0);
    }
    return sum;
  }

  const jeSkupina = (k: string) => GROUPS.some((g) => g.key === k);

  useEffect(() => {
    if (!el.current) return;
    if (!chart.current) chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' });
    const series = sel.map((key, i) => ({
      name: key,
      type: 'line' as const,
      smooth: false,
      symbolSize: 6,
      itemStyle: { color: jeSkupina(key) ? GROUP_COLOR[key] : PALETTE[i % PALETTE.length] },
      data: sezony.map((s) => hodnota(s, key)),
    }));
    chart.current.setOption(
      {
        legend: { top: 0, type: 'scroll', textStyle: { fontSize: 11 } },
        tooltip: { trigger: 'axis', confine: true },
        grid: { left: 48, right: 16, top: 40, bottom: 46 },
        xAxis: { type: 'category', data: sezony, axisLabel: { fontSize: 10, rotate: 45 } },
        yAxis: { type: 'value' },
        series,
      },
      true,
    );
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, [sel, rola, sezony]);

  // rozpad poslednej sezóny — bar na každú vybranú sériu
  useEffect(() => {
    if (!barEl.current || !sezony.length) return;
    if (!barChart.current) barChart.current = echarts.init(barEl.current, undefined, { renderer: 'canvas' });
    const posledna = sezony[sezony.length - 1];
    barChart.current.setOption(
      {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, confine: true },
        grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: sel, axisLabel: { fontSize: 11 } },
        series: [
          {
            type: 'bar',
            data: sel.map((key, i) => ({
              value: hodnota(posledna, key),
              itemStyle: { color: jeSkupina(key) ? GROUP_COLOR[key] : PALETTE[i % PALETTE.length] },
            })),
            label: { show: true, position: 'right', fontSize: 10, formatter: (p: { value: number }) => fmt(p.value) },
            barMaxWidth: 22,
          },
        ],
      },
      true,
    );
    const ro = new ResizeObserver(() => barChart.current?.resize());
    ro.observe(barEl.current);
    return () => ro.disconnect();
  }, [sel, rola, sezony]);

  function toggle(key: string) {
    setSel((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }
  function vsetkyKategorie() {
    setSel(GROUPS.map((g) => g.key));
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '4px 11px',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? 'none' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12.5, color: 'var(--color-muted)', marginRight: 2 }}>Rola:</span>
        {dostupneRoly.map((r) => (
          <button key={r} type="button" style={pill(rola === r)} onClick={() => setRola(r)}>
            {ROLA_LABEL[r]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <button type="button" style={pill(sel.length === GROUPS.length && GROUPS.every((g) => sel.includes(g.key)))} onClick={vsetkyKategorie}>
          Kategórie (všetky)
        </button>
        {GROUPS.map((g) => (
          <button key={g.key} type="button" style={pill(sel.includes(g.key))} onClick={() => toggle(g.key)}>
            {g.key}
          </button>
        ))}
        <span style={{ width: 1, height: 22, background: 'var(--color-line)', margin: '0 2px' }} />
        {U_LEVELS.map((u) => (
          <button key={u} type="button" style={pill(sel.includes(u))} onClick={() => toggle(u)}>
            {u}
          </button>
        ))}
      </div>
      <div ref={el} style={{ width: '100%', height: 380 }} role="img" aria-label="Trend demografie" />
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 6 }}>
          Rozpad poslednej sezóny{sezony.length ? ` · ${sezony[sezony.length - 1]}` : ''}
        </div>
        <div ref={barEl} style={{ width: '100%', height: Math.max(120, sel.length * 34 + 20) }} role="img" aria-label="Rozpad poslednej sezóny" />
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 6 }}>
        Veková úroveň je odvodená z roku narodenia (vek k záveru sezóny) — proxy, keďže historická
        súťažná kategória osôb nie je dostupná. Súčet M+Ž+neuvedené.
      </p>
    </div>
  );
}
