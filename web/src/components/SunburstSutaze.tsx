import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { SunburstChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { SunburstUzol } from '../lib/data';
import { fmt } from '../lib/format';
import { REGION } from '../lib/palette';
import { METRIKA_POPIS } from '../lib/urovneTypy';
import { useTooltip } from './Tooltip.tsx';

echarts.use([SunburstChart, TooltipComponent, CanvasRenderer]);

interface Props {
  strom: SunburstUzol; // sumar.sunburstSutaze (SR → odvetvie → SFZ → RFZ → ObFZ)
}

type Gender = 'VSETCI' | 'M' | 'F';
type Metrika = 'zapasy' | 'skupiny' | 'sutaze';

/** Sunburst pyramídy so spoločnými filtrami metrika (zápasy/skupiny/súťaže), šport a pohlavie. */
export default function SunburstSutaze({ strom }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const [futbal, setFutbal] = useState(true);
  const [futsal, setFutsal] = useState(true);
  const [gender, setGender] = useState<Gender>('VSETCI');
  const [metrika, setMetrika] = useState<Metrika>('zapasy');
  const tip = useTooltip();
  const jeSutaz = metrika === 'sutaze' || metrika === 'skupiny';

  // farbenie uzla podľa mena (RFZ / SFZ vlastné / odvetvie)
  function farba(name: string, depth: number): string | undefined {
    if (name.startsWith('Bratislavský')) return REGION.bfz;
    if (name.startsWith('Západoslovenský')) return REGION.zsfz;
    if (name.startsWith('Stredoslovenský')) return REGION.ssfz;
    if (name.startsWith('Východoslovenský')) return REGION.vsfz;
    if (name.includes('SFZ')) return '#7a44e0';
    if (name === 'Futsal' || name.startsWith('Slovenský futsal')) return '#ec1c24';
    if (name === 'Futbal') return '#1450df';
    return undefined;
  }

  const data = useMemo(() => {
    function pretvor(u: SunburstUzol, depth: number): SunburstUzol | null {
      // list
      if (!u.children || u.children.length === 0) {
        // skupiny sú fallbackom na súťaže — staršie súhrny ešte pole `skupiny` nemajú
        const val =
          metrika === 'skupiny'
            ? gender === 'VSETCI'
              ? (u.skupiny ?? u.sutaze ?? 0)
              : (u.skupinyPohlavie?.[gender] ?? u.sutazePohlavie?.[gender] ?? 0)
            : metrika === 'sutaze'
              ? gender === 'VSETCI'
                ? (u.sutaze ?? 0)
                : (u.sutazePohlavie?.[gender] ?? 0)
              : gender === 'VSETCI'
                ? (u.value ?? 0)
                : (u.pohlavie?.[gender] ?? 0);
        if (val <= 0) return null;
        return { name: u.name, value: val, itemStyle: { color: farba(u.name, depth) } } as SunburstUzol & { itemStyle?: unknown };
      }
      const deti = u.children.map((c) => pretvor(c, depth + 1)).filter(Boolean) as SunburstUzol[];
      if (!deti.length) return null;
      const c = farba(u.name, depth);
      return { name: u.name, children: deti, ...(c ? { itemStyle: { color: c } } : {}) } as SunburstUzol;
    }
    const odvetvia = (strom.children ?? []).filter((o) =>
      o.name === 'Futbal' ? futbal : o.name === 'Futsal' ? futsal : true,
    );
    return odvetvia.map((o) => pretvor(o, 1)).filter(Boolean) as SunburstUzol[];
  }, [strom, futbal, futsal, gender, metrika]);

  useEffect(() => {
    if (!el.current) return;
    if (!chart.current) chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' });
    chart.current.setOption(
      {
        tooltip: { confine: true, formatter: (p: { name: string; value: number }) => `${p.name}: <b>${fmt(p.value || 0)}</b>` },
        series: [
          {
            type: 'sunburst',
            radius: ['16%', '95%'],
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
  }, [data]);

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
    <div onMouseLeave={tip.skry}>
      <tip.Tooltip />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10, fontSize: 12.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--color-muted)' }}>Metrika:</span>
          <button type="button" style={pill(metrika === 'zapasy')} onClick={() => setMetrika('zapasy')}>Zápasy</button>
          <button
            type="button"
            style={pill(metrika === 'skupiny')}
            aria-label={METRIKA_POPIS.skupiny.popis}
            {...tip.viazat(<div style={{ whiteSpace: 'normal' }}>{METRIKA_POPIS.skupiny.popis}</div>)}
            onClick={() => setMetrika('skupiny')}
          >
            Skupiny
          </button>
          <button
            type="button"
            style={pill(metrika === 'sutaze')}
            aria-label={METRIKA_POPIS.sutaze.popis}
            {...tip.viazat(<div style={{ whiteSpace: 'normal' }}>{METRIKA_POPIS.sutaze.popis}</div>)}
            onClick={() => setMetrika('sutaze')}
          >
            Súťaže
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--color-muted)' }}>Šport:</span>
          <button type="button" style={pill(futbal)} onClick={() => setFutbal((v) => !v)}>Futbal</button>
          <button type="button" style={pill(futsal)} onClick={() => setFutsal((v) => !v)}>Futsal</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--color-muted)' }}>Pohlavie:</span>
          {(['VSETCI', 'M', 'F'] as Gender[]).map((g) => (
            <button key={g} type="button" style={pill(gender === g)} onClick={() => setGender(g)}>
              {g === 'VSETCI' ? 'Všetci' : g === 'M' ? 'Muži' : 'Ženy'}
            </button>
          ))}
        </div>
      </div>
      <div ref={el} style={{ width: '100%', height: 420 }} role="img" aria-label="Sunburst súťaží" />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 11.5, color: 'var(--color-muted)' }}>
        {[
          { label: 'Futbal', color: '#1450df' },
          { label: 'Futsal', color: '#ec1c24' },
          { label: 'SFZ', color: '#7a44e0' },
          { label: 'Bratislavský FZ', color: REGION.bfz },
          { label: 'Západoslovenský FZ', color: REGION.zsfz },
          { label: 'Stredoslovenský FZ', color: REGION.ssfz },
          { label: 'Východoslovenský FZ', color: REGION.vsfz },
        ].map((it) => (
          <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color, display: 'inline-block' }} />
            {it.label}
          </span>
        ))}
      </div>
      <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--color-muted)' }}>
        Kruhy zvnútra von: odvetvie → SFZ → RFZ → ObFZ → súťaž.
        {jeSutaz && ' Počítajú sa len súťaže s aspoň jedným odohraným zápasom, priradené svojmu riadiacemu zväzu.'}
        {jeSutaz && gender !== 'VSETCI' &&
          ' Pohlavie súťaže sa určuje z častí súťaže — súťaž s mužskými aj ženskými časťami sa započíta v oboch skupinách.'}
      </p>
      {jeSutaz && (
        <p style={{ marginTop: 4, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.55 }}>
          {METRIKA_POPIS[metrika].popis}
        </p>
      )}
    </div>
  );
}
