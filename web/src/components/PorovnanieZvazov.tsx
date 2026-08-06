import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { RadarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { PorovnanieRiadok, BumpData } from '../lib/data';
import { PALETTE, METRICS_RADAR, GROUPS } from '../lib/palette';
import { fmt, fmt1 } from '../lib/format';

echarts.use([RadarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

type Row = PorovnanieRiadok & { kat?: Record<string, Record<string, number>> };

interface Props {
  rows: Row[];
  bump: BumpData;
  /** Predvolene vybrané id zväzov. */
  defaultVyber?: string[];
  /** Max. počet naraz vybraných zväzov. */
  maxVyber?: number;
}

/** 16 metrík pre graf „Vývoj v čase“ (reálne hodnoty). */
const CAS_METRIKY: { k: string; label: string; fixed: number }[] = [
  { k: 'sutaze', label: 'Súťaže', fixed: 0 },
  { k: 'zapasy', label: 'Zápasy', fixed: 0 },
  { k: 'druzstva', label: 'Družstvá', fixed: 0 },
  { k: 'goly', label: 'Góly', fixed: 0 },
  { k: 'zlteKarty', label: 'Žlté karty', fixed: 0 },
  { k: 'cerveneKarty', label: 'Červené karty', fixed: 0 },
  { k: 'hraci', label: 'Hráči', fixed: 0 },
  { k: 'treneri', label: 'Tréneri', fixed: 0 },
  { k: 'rozhodcovia', label: 'Rozhodcovia', fixed: 0 },
  { k: 'realizacnyTim', label: 'Realizačný tím', fixed: 0 },
  { k: 'delegati', label: 'Delegáti', fixed: 0 },
  { k: 'personal', label: 'Personál', fixed: 0 },
  { k: 'divaci', label: 'Diváci', fixed: 0 },
  { k: 'divaciNaZapas', label: 'Diváci/zápas', fixed: 1 },
  { k: 'golyNaZapas', label: 'Góly/zápas', fixed: 1 },
];

const LVL_ORDER = ['ADULTS', 'U19', 'U18', 'U17', 'U16', 'U15', 'U14', 'U13', 'U12', 'U11', 'U10', 'U09', 'U08', 'U07'];
// metriky bez vekového rozpadu v dátach (zatiaľ len súčty za celý zväz)
const CAT_NEPODPOROVANE = new Set<string>([]);

const CARD: React.CSSProperties = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-line)',
  borderRadius: 16,
  padding: 18,
  boxShadow: 'var(--shadow-card)',
};
const KICK: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--color-sfz-blue)',
};
const H2: React.CSSProperties = { fontSize: 20, fontWeight: 800, margin: '2px 0 2px' };
const P: React.CSSProperties = { fontSize: 14, color: 'var(--color-muted)', margin: '0 0 12px' };

export default function PorovnanieZvazov({ rows, bump, defaultVyber = [], maxVyber = 13 }: Props) {
  const radarEl = useRef<HTMLDivElement>(null);
  const lineEl = useRef<HTMLDivElement>(null);
  const radarCh = useRef<echarts.ECharts | null>(null);
  const lineCh = useRef<echarts.ECharts | null>(null);

  const initVyber = (defaultVyber.length ? defaultVyber : rows.slice(0, 4).map((r) => r.id)).slice(0, maxVyber);
  const [vyber, setVyber] = useState<string[]>(initVyber);
  const [subset, setSubset] = useState<string[] | null>(null); // vekový filter (radar); null = celý zväz
  const [metric, setMetric] = useState<string>('zapasy');

  const maSezony = bump.sezony.length > 1;

  // prítomné vekové úrovne (naprieč zväzmi)
  const pritomne = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) for (const l of Object.keys(r.kat ?? {})) s.add(l);
    return LVL_ORDER.filter((l) => s.has(l));
  }, [rows]);

  function rowMetric(r: Row, k: string): number {
    if (!subset) return Number((r as unknown as Record<string, number>)[k] ?? 0);
    const kat = r.kat ?? {};
    let z = 0, g = 0, dv = 0, dr = 0, h = 0, su = 0;
    for (const l of subset) {
      const c = kat[l];
      if (!c) continue;
      z += c.zapasy || 0; g += c.goly || 0; dv += c.divaci || 0; dr += c.druzstva || 0; h += c.hraci || 0;
      su += c.sutaze || 0;
    }
    switch (k) {
      case 'zapasy': return z;
      case 'goly': return g;
      case 'divaci': return dv;
      case 'druzstva': return dr;
      case 'hraci': return h;
      // súťaž so zápasmi vo viacerých vekových úrovniach sa pri výbere viacerých
      // úrovní započíta v každej z nich — viď poznámka pod grafom
      case 'sutaze': return su;
      case 'golyNaZapas': return z ? g / z : 0;
      case 'divaciNaZapas': return z ? dv / z : 0;
      default: return 0;
    }
  }

  const vybrane = useMemo(
    () => vyber.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Row[],
    [vyber, rows],
  );

  // ---- RADAR (priame porovnanie) ----
  useEffect(() => {
    if (!radarEl.current) return;
    if (vybrane.length < 2) {
      radarCh.current?.dispose();
      radarCh.current = null;
      return;
    }
    if (!radarCh.current) radarCh.current = echarts.init(radarEl.current, undefined, { renderer: 'canvas' });
    const maxima: Record<string, number> = {};
    for (const m of METRICS_RADAR) maxima[m.k] = Math.max(...rows.map((r) => rowMetric(r, m.k)), 1);
    radarCh.current.setOption(
      {
        legend: { top: 0, type: 'scroll', data: vybrane.map((r) => r.nazov), textStyle: { fontSize: 11 } },
        color: vybrane.map((_, i) => PALETTE[i % PALETTE.length]),
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: (p: { dataIndex: number; value: number[] }) => {
            const r = vybrane[p.dataIndex];
            return (
              `<b>${r.nazov}</b><br/>` +
              METRICS_RADAR.map(
                (m, i) =>
                  `${m.label}: <b>${m.k.includes('NaZapas') ? fmt1(rowMetric(r, m.k)) : fmt(rowMetric(r, m.k))}</b> (${Math.round(p.value[i])} %)`,
              ).join('<br/>')
            );
          },
        },
        radar: {
          indicator: METRICS_RADAR.map((m) => ({ name: m.label, max: 100 })),
          radius: '62%',
          axisName: { fontSize: 11, color: '#475569' },
        },
        series: [
          {
            type: 'radar',
            data: vybrane.map((r, i) => ({
              name: r.nazov,
              value: METRICS_RADAR.map((m) => (rowMetric(r, m.k) / maxima[m.k]) * 100),
              itemStyle: { color: PALETTE[i % PALETTE.length] },
              areaStyle: { opacity: 0.12 },
            })),
          },
        ],
      },
      true,
    );
    radarCh.current.resize();
    const ro = new ResizeObserver(() => radarCh.current?.resize());
    ro.observe(radarEl.current);
    return () => ro.disconnect();
  }, [vybrane, subset, rows]);

  // ---- LINE (vývoj v čase, reálne hodnoty) ----
  useEffect(() => {
    if (!lineEl.current || !maSezony || !vybrane.length) {
      if (!vybrane.length || !maSezony) {
        lineCh.current?.dispose();
        lineCh.current = null;
      }
      return;
    }
    if (!lineCh.current) lineCh.current = echarts.init(lineEl.current, undefined, { renderer: 'canvas' });
    const fixed = CAS_METRIKY.find((m) => m.k === metric)?.fixed ?? 0;
    const catHodnota = (sez: string, id: string, m: string): number | null => {
      if (!subset) {
        const v = bump.hodnoty[sez]?.[id]?.[m];
        return v == null ? null : v;
      }
      // metriky bez vekového rozpadu → celý zväz (pill je aj tak zablokovaný)
      if (CAT_NEPODPOROVANE.has(m)) {
        const v = bump.hodnoty[sez]?.[id]?.[m];
        return v == null ? null : v;
      }
      const katS = bump.kat?.[sez]?.[id];
      if (!katS) return null;
      const suma = (mm: string) => subset.reduce((acc, c) => acc + (katS[c]?.[mm] ?? 0), 0);
      if (m === 'golyNaZapas') { const z = suma('zapasy'); return z ? suma('goly') / z : 0; }
      if (m === 'divaciNaZapas') { const z = suma('zapasy'); return z ? suma('divaci') / z : 0; }
      return suma(m);
    };
    const series = vyber.map((id, i) => {
      const z = bump.zvazy.find((x) => x.id === id);
      return {
        name: z?.nazov ?? id,
        type: 'line' as const,
        symbolSize: 7,
        lineStyle: { width: 2.5 },
        itemStyle: { color: PALETTE[i % PALETTE.length] },
        connectNulls: false,
        data: bump.sezony.map((s) => catHodnota(s, id, metric)),
      };
    });
    lineCh.current.setOption(
      {
        legend: { type: 'scroll', top: 0, textStyle: { fontSize: 11 }, itemWidth: 18, itemGap: 8 },
        tooltip: {
          trigger: 'axis',
          confine: true,
          valueFormatter: (v: number | null) => (v == null ? '—' : fixed ? fmt1(v) : fmt(v)),
        },
        grid: { left: 52, right: 16, top: 92, bottom: 46 },
        xAxis: { type: 'category', data: bump.sezony, axisLabel: { fontSize: 10, rotate: 45 } },
        yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (fixed ? fmt1(v) : fmt(v)) } },
        series,
      },
      true,
    );
    lineCh.current.resize();
    const ro = new ResizeObserver(() => lineCh.current?.resize());
    ro.observe(lineEl.current);
    return () => ro.disconnect();
  }, [vyber, vybrane.length, metric, subset, bump, maSezony]);

  // ak je zvolená kategória a metrika nemá vekový rozpad, prepni na Zápasy
  useEffect(() => {
    if (subset !== null && CAT_NEPODPOROVANE.has(metric)) setMetric('zapasy');
  }, [subset, metric]);

  function toggle(id: string) {
    setVyber((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= maxVyber ? cur : [...cur, id],
    );
  }

  const plno = vyber.length >= maxVyber;
  const pocet = rows.length;

  const chip = (active: boolean, disabled: boolean, color?: string): React.CSSProperties => ({
    padding: '4px 12px',
    borderRadius: 16,
    fontSize: 12.5,
    fontWeight: active ? 700 : 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid ' + (active ? (color ?? 'var(--color-sfz-blue)') : '#dcdfe4'),
    background: active ? (color ?? 'var(--color-sfz-blue)') : 'var(--color-card)',
    color: active ? '#fff' : disabled ? '#b7bcc4' : 'var(--color-ink)',
  });

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '4px 11px',
    borderRadius: 16,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? 'none' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  const fbtn = (active: boolean): React.CSSProperties => ({
    padding: '3px 12px',
    borderRadius: 16,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid ' + (active ? 'var(--color-sfz-blue)' : '#dcdfe4'),
    background: active ? 'var(--color-sfz-blue)' : 'transparent',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  const ux = pritomne.filter((l) => l !== 'ADULTS');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Spoločný výber zväzov */}
      <section style={CARD}>
        <div style={KICK}>Výber zväzov</div>
        <h2 style={H2}>Vyber zväzy na porovnanie</h2>
        <p style={P}>
          Jeden výber pre obe vizualizácie nižšie. Vyber 2–{maxVyber} zväzov (napr. všetky ObFZ jedného RFZ) spomedzi {pocet}.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Výber zväzov na porovnanie">
          {rows.map((r) => {
            const idx = vyber.indexOf(r.id);
            const active = idx >= 0;
            const disabled = !active && plno;
            return (
              <button
                key={r.id}
                type="button"
                style={chip(active, disabled, active ? PALETTE[idx % PALETTE.length] : undefined)}
                onClick={() => toggle(r.id)}
                disabled={disabled}
              >
                {r.nazov}
              </button>
            );
          })}
        </div>
      </section>

      {/* Priame porovnanie (radar) */}
      <section style={CARD}>
        <div style={KICK}>Priame porovnanie</div>
        <h2 style={H2}>Priame porovnanie zväzov</h2>
        <p style={P}>
          Radar normalizuje na maximum úrovne (100 % = najlepší zväz v metrike); skutočné hodnoty v tooltipe.
          Voliteľne filter podľa vekovej kategórie.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, color: 'var(--color-muted)', marginRight: 2 }}>Kategória:</span>
          <button type="button" style={fbtn(subset === null)} onClick={() => setSubset(null)}>
            Celý zväz
          </button>
          {GROUPS.map((g) => {
            const cats = g.cats.filter((c) => pritomne.includes(c));
            if (!cats.length) return null;
            const active = subset !== null && subset.join() === cats.join();
            return (
              <button key={g.key} type="button" style={fbtn(active)} onClick={() => setSubset(cats)}>
                {g.key}
              </button>
            );
          })}
          {ux.length > 0 && <span style={{ fontSize: 12.5, color: 'var(--color-muted)', margin: '0 2px 0 6px' }}>Úroveň:</span>}
          {ux.map((l) => {
            const active = subset !== null && subset.length === 1 && subset[0] === l;
            return (
              <button key={l} type="button" style={fbtn(active)} onClick={() => setSubset([l])}>
                {l}
              </button>
            );
          })}
        </div>
        {vybrane.length >= 2 ? (
          <div ref={radarEl} style={{ width: '100%', height: 420 }} role="img" aria-label="Radarové porovnanie vybraných zväzov" />
        ) : (
          <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Vyber aspoň 2 zväzy.</p>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--color-muted)', margin: '8px 0 0' }}>
          Súťaž = súťaž s aspoň jedným odohraným zápasom v danej sezóne. Pri filtri vekovej
          skupiny sa súťaž, ktorej zápasy patria do viacerých vekových úrovní, započíta
          v každej z nich — súčet cez skupiny preto môže prevýšiť počet súťaží celého zväzu.
        </p>
      </section>

      {/* Vývoj v čase (reálne hodnoty) */}
      {maSezony && (
        <section style={CARD}>
          <div style={KICK}>Vývoj v čase</div>
          <h2 style={H2}>Vývoj v čase</h2>
          <p style={P}>
            Reálne hodnoty vybraných zväzov naprieč {bump.sezony.length} sezónami. Vyber metriku{subset ? ' (filter vekovej kategórie z priameho porovnania sa uplatní)' : ''}:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {CAS_METRIKY.map((m) => {
              const dis = subset !== null && CAT_NEPODPOROVANE.has(m.k);
              return (
                <button
                  key={m.k}
                  type="button"
                  disabled={dis}
                  title={dis ? 'Táto metrika zatiaľ nemá vekový rozpad — zruš filter kategórie' : undefined}
                  style={{ ...pill(metric === m.k), ...(dis ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}
                  onClick={() => { if (!dis) setMetric(m.k); }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          {vybrane.length ? (
            <div ref={lineEl} style={{ width: '100%', height: 400 }} role="img" aria-label="Vývoj vybraných zväzov v čase" />
          ) : (
            <p style={{ fontSize: 14, color: 'var(--color-muted)' }}>Vyber aspoň jeden zväz.</p>
          )}
        </section>
      )}
    </div>
  );
}
