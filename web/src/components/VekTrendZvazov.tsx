import { useMemo, useState } from 'react';
import { PALETTE } from '../lib/palette';
import type { VekVCase } from '../lib/trendyTypy';

interface Props {
  data: VekVCase;
  /** Predvolený výber (id zväzov). Ak prázdny, vyberie sa SFZ a štyri RFZ. */
  defaultVyber?: string[];
}

const PREDVOLENE = ['sfz', 'bfz', 'zsfz', 'ssfz', 'vsfz'];

/**
 * Vývoj mediánu veku hráčov v súťažiach dospelých, jedna séria na zväz.
 *
 * Prebiehajúca sezóna sa kreslí prerušovane — čísla sa v nej ešte dopĺňajú.
 * Typy a dáta chodia z `lib/trendy.ts`; tento komponent nesmie importovať nič,
 * čo siaha na súbory (pozri poznámku v `urovneTypy.ts`).
 */
export default function VekTrendZvazov({ data, defaultVyber }: Props) {
  const [vybrane, setVybrane] = useState<number[]>(() => {
    const ids = defaultVyber?.length ? defaultVyber : PREDVOLENE;
    const idx = data.subjekty.map((z, i) => (ids.includes(z.id) ? i : -1)).filter((i) => i >= 0);
    return idx.length ? idx : data.subjekty.map((_, i) => i).slice(0, 5);
  });

  const { hodnoty, min, max } = useMemo(() => {
    const h = new Map<string, { median: number; n: number }>();
    let lo = 99;
    let hi = 0;
    for (const r of (data.rows ? data.rows.split(';') : [])) {
      const [zi, si, med, , n] = r.split(',').map(Number);
      h.set(`${zi}|${si}`, { median: med, n });
      if (med < lo) lo = med;
      if (med > hi) hi = med;
    }
    return { hodnoty: h, min: Math.floor(lo - 1), max: Math.ceil(hi + 1) };
  }, [data]);

  const n = data.sezony.length;
  const prebiehaOd = useMemo(() => {
    const i = data.sezony.indexOf(data.poslednaKompletna);
    return i < 0 ? n : i + 1;
  }, [data, n]);

  const val = (zi: number, si: number) => hodnoty.get(`${zi}|${si}`)?.median ?? null;

  const W = 860;
  const L = 40;
  const R = 172;
  const T = 10;
  const H = 250;
  const x = (s: number) => L + (n <= 1 ? 0 : (s / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - min) / Math.max(1, max - min)) * H;
  const farba = (zi: number) => PALETTE[zi % PALETTE.length];

  const cesta = (zi: number, od: number, doIdx: number) => {
    let d = '';
    for (let s = Math.max(0, od); s <= doIdx && s < n; s++) {
      const v = val(zi, s);
      if (v === null) { d = d; continue; }
      d += (d ? ' L' : 'M') + x(s) + ',' + y(v);
    }
    return d;
  };

  const chip = (active: boolean, col: string): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 13, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid transparent' : '1px solid #dcdfe4',
    background: active ? col : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-muted)',
  });

  const kroky = useMemo(() => {
    const out: number[] = [];
    for (let v = min; v <= max; v++) if ((v - min) % Math.max(1, Math.ceil((max - min) / 6)) === 0) out.push(v);
    return out;
  }, [min, max]);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 12, fontSize: 12 }}>
        <span style={{ color: 'var(--color-muted)' }}>Zväzy:</span>
        {data.subjekty.map((z, zi) => {
          const on = vybrane.includes(zi);
          return (
            <button
              key={z.id}
              type="button"
              style={chip(on, farba(zi))}
              onClick={() => setVybrane((v) => (on ? v.filter((i) => i !== zi) : [...v, zi]))}
            >
              {z.nazov}
            </button>
          );
        })}
      </div>

      {vybrane.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Vyber aspoň jeden zväz.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${T + H + 30}`} style={{ display: 'block', width: '100%', height: 'auto' }} role="img">
          {kroky.map((g) => (
            <g key={g}>
              <line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="#eef0f3" />
              <text x={L - 6} y={y(g) + 3} textAnchor="end" fontSize={10} fill="var(--color-muted)">{g}</text>
            </g>
          ))}
          {data.sezony.map((s, i) =>
            i % 2 ? null : (
              <text key={s} x={x(i)} y={T + H + 16} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
                {s.slice(2, 4)}/{s.slice(7)}
              </text>
            ),
          )}
          {vybrane.map((zi, k) => (
            <g key={zi}>
              <path d={cesta(zi, 0, prebiehaOd - 1)} fill="none" stroke={farba(zi)} strokeWidth={2} strokeLinejoin="round" />
              {prebiehaOd < n && (
                <path d={cesta(zi, prebiehaOd - 1, n - 1)} fill="none" stroke={farba(zi)} strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
              )}
              {data.sezony.map((s, si) => {
                const v = val(zi, si);
                if (v === null) return null;
                return (
                  <circle key={s} cx={x(si)} cy={y(v)} r={2.4} fill={farba(zi)} opacity={si >= prebiehaOd ? 0.6 : 1}>
                    <title>{`${data.subjekty[zi].nazov} · ${s}: medián ${v} rokov (${hodnoty.get(`${zi}|${si}`)?.n ?? 0} zápisov)`}</title>
                  </circle>
                );
              })}
              <text x={W - R + 8} y={T + 12 + k * 14} fontSize={10.5} fontWeight={700} fill={farba(zi)}>
                {data.subjekty[zi].nazov}
              </text>
            </g>
          ))}
          <line x1={L} y1={T + H} x2={W - R} y2={T + H} stroke="var(--color-line, #e6e8ec)" />
        </svg>
      )}

      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        Medián vekovej úrovne osoby v zápisoch o stretnutí v súťažiach dospelých. Prerušovaný
        úsek je prebiehajúca sezóna, v ktorej sa čísla ešte dopĺňajú — posledná kompletná je{' '}
        {data.poslednaKompletna}. Zobrazujú sa len zväzy a sezóny s aspoň 100 zápismi.
      </p>
    </div>
  );
}
