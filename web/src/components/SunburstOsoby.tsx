import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { SunburstChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { SunburstUzol } from '../lib/data';
import { fmt } from '../lib/format';
import { LEVEL_COLOR } from '../lib/palette';

echarts.use([SunburstChart, TooltipComponent, CanvasRenderer]);

interface Props {
  strom: SunburstUzol; // sumar.sunburstOsoby (SR → odvetvie → úroveň → rola → vek)
}

/** 4-prstencový sunburst osôb; farby podľa úrovne (SFZ/RFZ/ObFZ). */
export default function SunburstOsoby({ strom }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!el.current) return;
    if (!chart.current) chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' });

    // uzlom úrovne priraď farbu; ostatné dedia
    function pretvor(u: SunburstUzol): SunburstUzol {
      const c = u.uroven ? LEVEL_COLOR[u.uroven] : undefined;
      const node: SunburstUzol & { itemStyle?: unknown } = { name: u.name };
      if (u.value != null) node.value = u.value;
      if (c) node.itemStyle = { color: c };
      if (u.children) node.children = u.children.map(pretvor);
      return node;
    }
    const data = (strom.children ?? []).map(pretvor);

    chart.current.setOption(
      {
        tooltip: { confine: true, formatter: (p: { name: string; value: number }) => `${p.name}: <b>${fmt(p.value || 0)}</b>` },
        series: [
          {
            type: 'sunburst',
            radius: ['12%', '95%'],
            sort: undefined,
            data,
            label: { show: false },
            emphasis: { focus: 'ancestor' },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
          },
        ],
      },
      true,
    );
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => ro.disconnect();
  }, [strom]);

  return (
    <div>
      <div ref={el} style={{ width: '100%', height: 420 }} role="img" aria-label="Sunburst osôb" />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5, color: 'var(--color-muted)' }}>
        {Object.entries(LEVEL_COLOR).map(([k, c]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: 'inline-block' }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
