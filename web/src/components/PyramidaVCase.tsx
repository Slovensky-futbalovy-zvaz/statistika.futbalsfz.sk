import { useMemo, useState } from 'react';
import { rozbal, type UrovneVCase } from '../lib/urovne';
import { fmt } from '../lib/format';
import { UROVEN_LABEL, UROVEN_LABEL_KRATKY } from '../lib/palette';

interface Props {
  /** Rez pre JEDEN zväz (getUrovneVCaseZvazu). */
  data: UrovneVCase;
}

type Gender = 'VSETCI' | 'M' | 'F';

const MIMO_PYRAMIDY = new Set(['POHARE', 'NEURCENE']);

/**
 * Vývoj celej pyramídy jedného zväzu v čase — skladané plochy sú úrovne súťaže,
 * os X sú sezóny. Ukáže, kedy zväzu pribudla alebo zanikla liga a ako sa presúvalo
 * ťažisko súťaží.
 *
 * Prebiehajúca sezóna (za `poslednaKompletna`) je šrafovaná — čísla sa v nej ešte
 * dopĺňajú, prepad k nule nie je trend.
 */
export default function PyramidaVCase({ data }: Props) {
  const [kat, setKat] = useState(0);
  const [gender, setGender] = useState<Gender>('VSETCI');

  const gi = gender === 'VSETCI' ? -1 : gender === 'M' ? 0 : 1;
  const n = data.sezony.length;

  const { hodnoty, urovneIdx } = useMemo(() => {
    const h = new Map<string, number>();
    const pouzite = new Set<number>();
    for (const [, si, ui, ki, g, v] of rozbal(data.rows)) {
      if (kat >= 0 && ki !== kat) continue;
      if (gi >= 0 && g !== gi) continue;
      h.set(`${ui}|${si}`, (h.get(`${ui}|${si}`) ?? 0) + v);
      pouzite.add(ui);
    }
    return { hodnoty: h, urovneIdx: data.urovne.map((_, i) => i).filter((i) => pouzite.has(i)) };
  }, [data, kat, gi]);

  const val = (ui: number, si: number) => hodnoty.get(`${ui}|${si}`) ?? 0;

  const prebiehaOd = useMemo(() => {
    const i = data.sezony.indexOf(data.poslednaKompletna);
    return i < 0 ? n : i + 1;
  }, [data, n]);

  const max = useMemo(() => {
    let m = 1;
    for (let s = 0; s < n; s++) {
      const t = urovneIdx.reduce((a, ui) => a + val(ui, s), 0);
      if (t > m) m = t;
    }
    return m;
  }, [hodnoty, urovneIdx, n]);

  const W = 860;
  const L = 40;
  const R = 150;
  const T = 10;
  const H = 220;
  const x = (s: number) => L + (n <= 1 ? 0 : (s / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * H;

  const farba = (ui: number, i: number) => {
    const kod = data.urovne[ui];
    if (kod === 'POHARE') return '#7a44e0';
    if (kod === 'NEURCENE') return '#98a2b3';
    const a = 1 - (i / Math.max(1, urovneIdx.length - 1)) * 0.62;
    return '#1450df' + Math.round(a * 255).toString(16).padStart(2, '0');
  };

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

  // skladané plochy zdola nahor
  const plochy: { ui: number; d: string; col: string }[] = [];
  const dol = new Array(n).fill(0);
  urovneIdx.forEach((ui, i) => {
    const hore = dol.map((d, s) => d + val(ui, s));
    let d = '';
    for (let s = 0; s < n; s++) d += (s ? ' L' : 'M') + x(s) + ',' + y(hore[s]);
    for (let s = n - 1; s >= 0; s--) d += ' L' + x(s) + ',' + y(dol[s]);
    plochy.push({ ui, d: d + ' Z', col: farba(ui, i) });
    for (let s = 0; s < n; s++) dol[s] = hore[s];
  });

  const prazdne = urovneIdx.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12, fontSize: 12.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-muted)' }}>Kategória:</span>
          {data.kategorie.slice(0, 4).map((k, i) => (
            <button key={k} type="button" style={pill(kat === i)} onClick={() => setKat(i)}>
              {k}
            </button>
          ))}
          <button type="button" style={pill(kat === -1)} onClick={() => setKat(-1)}>
            Všetky
          </button>
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

      {prazdne ? (
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          Pre zvolenú kombináciu filtrov nemá zväz v žiadnej sezóne súťaže.
        </p>
      ) : (
        <svg viewBox={`0 0 ${W} ${T + H + 28}`} style={{ display: 'block', width: '100%', height: 'auto' }} role="img" aria-label="Vývoj pyramídy súťaží v čase">
          <defs>
            <pattern id="prebieha" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#fff" opacity="0.55" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeWidth="3" opacity="0.75" />
            </pattern>
          </defs>
          {Array.from({ length: Math.floor(max / Math.max(1, Math.ceil(max / 5))) + 1 }, (_, i) => i * Math.max(1, Math.ceil(max / 5))).map((g) => (
            <g key={g}>
              <line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="#eef0f3" />
              <text x={L - 8} y={y(g) + 3} textAnchor="end" fontSize={10} fill="var(--color-muted)">
                {g}
              </text>
            </g>
          ))}
          {plochy.map((p, i) => (
            <path key={p.ui} d={p.d} fill={p.col} stroke="#fff" strokeWidth={0.6}>
              <title>{UROVEN_LABEL[data.urovne[p.ui]]}</title>
            </path>
          ))}
          {prebiehaOd < n && (
            <>
              <rect x={x(prebiehaOd - 1)} y={T} width={x(n - 1) - x(prebiehaOd - 1)} height={H} fill="url(#prebieha)" />
              <line x1={x(prebiehaOd - 1)} y1={T} x2={x(prebiehaOd - 1)} y2={T + H} stroke="#c7ccd2" strokeDasharray="3 3" />
            </>
          )}
          {data.sezony.map((s, i) =>
            i % 2 ? null : (
              <text key={s} x={x(i)} y={T + H + 16} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
                {s.slice(2, 4)}/{s.slice(7)}
              </text>
            ),
          )}
          {urovneIdx.map((ui, i) => (
            <g key={ui}>
              <rect x={W - R + 8} y={T + 4 + i * 15} width={9} height={9} rx={2} fill={farba(ui, i)} />
              <text x={W - R + 22} y={T + 12 + i * 15} fontSize={10.5} fill="var(--color-muted)">
                {UROVEN_LABEL_KRATKY[data.urovne[ui]] ?? data.urovne[ui]}
              </text>
            </g>
          ))}
          <line x1={L} y1={T + H} x2={W - R} y2={T + H} stroke="var(--color-line, #e6e8ec)" />
        </svg>
      )}

      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)' }}>
        Výška plochy je počet súťaží, farby sú úrovne súťaže od najvyššej (tmavá) po najnižšiu.
        Šrafovaná časť vpravo je prebiehajúca sezóna, v ktorej sa čísla ešte dopĺňajú — posledná
        kompletná je {data.poslednaKompletna}. Zobrazená kategória:{' '}
        {kat === -1 ? 'všetky (medzisúčet cez vekové úrovne)' : data.kategorie[kat]}. Spolu v poslednej
        kompletnej sezóne:{' '}
        {fmt(urovneIdx.reduce((a, ui) => a + val(ui, Math.max(0, prebiehaOd - 1)), 0))} súťaží.
      </p>
    </div>
  );
}
