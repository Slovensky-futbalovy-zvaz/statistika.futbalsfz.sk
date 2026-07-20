import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import * as echarts from 'echarts/core';
import { RadarChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { bezDiakritiky, fmt, fmt1 } from '../lib/format';
import type { PorovnanieKlubRiadok } from '../lib/data';

echarts.use([RadarChart, TooltipComponent, LegendComponent, CanvasRenderer]);

interface Props {
  sezonaSlug: string; // RRRR-RRRR
}

const PALETTE = ['#1450df', '#ec1c24', '#12a06b', '#f0961b', '#7a44e0'];
const RADAR = [
  { k: 'zapasy', label: 'Zápasy' },
  { k: 'divaciNaZapas', label: 'Diváci/zápas' },
  { k: 'golyNaZapas', label: 'Góly/zápas' },
  { k: 'divaci', label: 'Diváci' },
  { k: 'hraci', label: 'Hráči' },
  { k: 'goly', label: 'Góly' },
  { k: 'druzstva', label: 'Družstvá' },
];
const GROUPS: { key: string; cats: string[] }[] = [
  { key: 'Dospelí', cats: ['ADULTS'] },
  { key: 'Dorast', cats: ['U19', 'U18', 'U17', 'U16'] },
  { key: 'Žiaci', cats: ['U15', 'U14', 'U13', 'U12'] },
  { key: 'Prípravky', cats: ['U11', 'U10', 'U09', 'U08', 'U07'] },
];
const LVL_ORDER = ['ADULTS', 'U19', 'U18', 'U17', 'U16', 'U15', 'U14', 'U13', 'U12', 'U11', 'U10', 'U09', 'U08', 'U07'];

/** Priame porovnanie klubov (F4 pre kluby) — search-based výber 2–5 klubov
 *  z celoslovenského zoznamu (tisícky riadkov, natiahnuté fetch-om zo statického
 *  JSON endpointu), radar graf + filter podľa vekovej kategórie/úrovne. */
export default function KlubyPorovnanieView({ sezonaSlug }: Props) {
  const [rows, setRows] = useState<PorovnanieKlubRiadok[] | null>(null);
  const [q, setQ] = useState('');
  const [poradie, setPoradie] = useState<string[]>([]);
  const [subset, setSubset] = useState<string[] | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    let cancel = false;
    setRows(null);
    setPoradie([]);
    fetch(`/data/kluby-porovnanie/${sezonaSlug}.json`)
      .then((r) => r.json())
      .then((d: { kluby?: PorovnanieKlubRiadok[] }) => {
        if (!cancel) setRows(d.kluby ?? []);
      })
      .catch(() => {
        if (!cancel) setRows([]);
      });
    return () => {
      cancel = true;
    };
  }, [sezonaSlug]);

  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);
  const filter = bezDiakritiky(q.trim());
  const navrhy = useMemo(() => {
    if (!rows || filter.length < 2) return [];
    return rows.filter((r) => !poradie.includes(r.id) && bezDiakritiky(r.nazov).includes(filter)).slice(0, 8);
  }, [rows, filter, poradie]);

  const pritomne = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows ?? []) for (const l of Object.keys(r.kat || {})) s.add(l);
    return LVL_ORDER.filter((l) => s.has(l));
  }, [rows]);

  function rowMetric(r: PorovnanieKlubRiadok, k: string): number {
    if (!subset) return (r as unknown as Record<string, number>)[k] || 0;
    let z = 0, g = 0, dv = 0, dr = 0, h = 0;
    for (const l of subset) {
      const c = r.kat[l];
      if (!c) continue;
      z += c.zapasy || 0;
      g += c.goly || 0;
      dv += c.divaci || 0;
      dr += c.druzstva || 0;
      h += c.hraci || 0;
    }
    switch (k) {
      case 'zapasy': return z;
      case 'goly': return g;
      case 'divaci': return dv;
      case 'druzstva': return dr;
      case 'hraci': return h;
      case 'golyNaZapas': return z ? g / z : 0;
      case 'divaciNaZapas': return z ? dv / z : 0;
      default: return 0;
    }
  }

  function addKlub(id: string) {
    if (poradie.includes(id) || poradie.length >= 5) return;
    setPoradie([...poradie, id]);
    setQ('');
  }
  function removeKlub(id: string) {
    setPoradie(poradie.filter((x) => x !== id));
  }

  const vyber = poradie.map((id) => byId.get(id)).filter(Boolean) as PorovnanieKlubRiadok[];

  useEffect(() => {
    if (!el.current || !rows || vyber.length < 2) return;
    if (!chart.current) chart.current = echarts.init(el.current, undefined, { renderer: 'canvas' });
    const maxima: Record<string, number> = {};
    for (const m of RADAR) maxima[m.k] = Math.max(...rows.map((r) => rowMetric(r, m.k)), 1);
    chart.current.setOption(
      {
        legend: { top: 0, data: vyber.map((r) => r.nazov) },
        color: vyber.map((_, i) => PALETTE[i % PALETTE.length]),
        tooltip: {
          trigger: 'item',
          formatter: (p: { dataIndex: number; value: number[] }) => {
            const r = vyber[p.dataIndex];
            return (
              `<b>${r.nazov}</b><br/>` +
              RADAR.map(
                (m, i) =>
                  `${m.label}: <b>${m.k.toLowerCase().includes('zapas') ? fmt1(rowMetric(r, m.k)) : fmt(rowMetric(r, m.k))}</b> (${Math.round(p.value[i])} %)`,
              ).join('<br/>')
            );
          },
        },
        radar: { indicator: RADAR.map((m) => ({ name: m.label, max: 100 })), radius: '62%', axisName: { fontSize: 11, color: '#475569' } },
        series: [
          {
            type: 'radar',
            data: vyber.map((r, i) => ({
              name: r.nazov,
              value: RADAR.map((m) => (rowMetric(r, m.k) / maxima[m.k]) * 100),
              itemStyle: { color: PALETTE[i % PALETTE.length] },
              areaStyle: { opacity: 0.12 },
            })),
          },
        ],
      },
      true,
    );
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vyber, subset, rows]);

  const filterBtn = (active: boolean): CSSProperties => ({
    borderRadius: 999,
    border: '1px solid ' + (active ? 'var(--color-sfz-blue)' : '#dcdfe4'),
    padding: '2px 12px',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    background: active ? 'var(--color-sfz-blue)' : 'transparent',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  return (
    <section className="border border-line" style={{ background: 'var(--color-card)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-card)' }}>
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-sfz-blue">Priame porovnanie</div>
      <h2 className="font-extrabold" style={{ fontSize: 20, margin: '2px 0 2px' }}>
        Priame porovnanie klubov
      </h2>
      <p className="text-sm text-muted mb-3">
        Vyhľadaj a vyber 2–5 klubov, voliteľne filtruj podľa vekovej kategórie alebo úrovne. Radar normalizuje na
        maximum naprieč všetkými klubmi sezóny (100 % = najlepší klub v metrike); skutočné hodnoty v tooltipe.
      </p>

      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={rows ? 'Hľadať klub… (min. 2 znaky)' : 'Načítavam zoznam klubov…'}
          disabled={!rows}
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d9dce1', borderRadius: 10, padding: '10px 13px', fontSize: 14, outline: 'none' }}
        />
        {navrhy.length > 0 && (
          <div
            style={{
              position: 'absolute', zIndex: 10, top: 'calc(100% + 4px)', left: 0, right: 0,
              background: '#fff', border: '1px solid #d9dce1', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto',
            }}
          >
            {navrhy.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => addKlub(r.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 13px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13.5 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f2f6ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <strong>{r.nazov}</strong> <span style={{ color: 'var(--color-muted)' }}>· {r.uroven} · {r.zvazNazov}</span>
              </button>
            ))}
          </div>
        )}
        {rows && q.trim().length >= 2 && navrhy.length === 0 && (
          <p className="text-sm text-muted" style={{ margin: '6px 0 0' }}>Žiadny klub nezodpovedá hľadaniu.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {vyber.map((r, i) => (
          <span
            key={r.id}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, background: PALETTE[i % PALETTE.length], color: '#fff', padding: '5px 6px 5px 12px', fontSize: 13.5, fontWeight: 700 }}
          >
            {r.nazov}
            <button
              type="button"
              onClick={() => removeKlub(r.id)}
              aria-label={`Odobrať ${r.nazov}`}
              style={{ background: 'rgba(255,255,255,.25)', border: 'none', borderRadius: 999, color: '#fff', width: 18, height: 18, lineHeight: '18px', cursor: 'pointer', fontSize: 12 }}
            >
              ×
            </button>
          </span>
        ))}
        {vyber.length === 0 && <span className="text-sm text-muted">Zatiaľ nie je vybraný žiadny klub.</span>}
      </div>

      {pritomne.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4 text-sm">
          <span className="text-muted" style={{ margin: '0 4px 0 0' }}>Kategória:</span>
          <button type="button" style={filterBtn(subset === null)} onClick={() => setSubset(null)}>
            Celý klub
          </button>
          {GROUPS.map((g) => {
            const cats = g.cats.filter((c) => pritomne.includes(c));
            if (!cats.length) return null;
            const active = subset != null && subset.length === cats.length && cats.every((c) => subset.includes(c));
            return (
              <button key={g.key} type="button" style={filterBtn(active)} onClick={() => setSubset(cats)}>
                {g.key}
              </button>
            );
          })}
          {pritomne.filter((l) => l !== 'ADULTS').length > 0 && (
            <span className="text-muted" style={{ margin: '0 4px 0 6px' }}>Úroveň:</span>
          )}
          {pritomne
            .filter((l) => l !== 'ADULTS')
            .map((l) => (
              <button key={l} type="button" style={filterBtn(!!subset && subset.length === 1 && subset[0] === l)} onClick={() => setSubset([l])}>
                {l}
              </button>
            ))}
        </div>
      )}

      {vyber.length >= 2 ? (
        <div ref={el} style={{ width: '100%', height: 420 }} role="img" aria-label="Radarové porovnanie vybraných klubov" />
      ) : (
        <p className="text-sm text-muted">{rows ? 'Vyber aspoň 2 kluby.' : 'Načítavam zoznam klubov…'}</p>
      )}
    </section>
  );
}
