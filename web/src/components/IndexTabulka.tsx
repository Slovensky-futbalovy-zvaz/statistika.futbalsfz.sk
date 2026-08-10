import { useMemo, useState } from 'react';
import { ZLOZKY_POPIS, INDEX_LIMITY } from '../lib/trendyTypy';
import { fmt } from '../lib/format';
import { TipNadpis, useTooltip } from './Tooltip.tsx';

/** Skrátené názvy zložiek indexu v hlavičke tabuľky (plný popis je v popisku). */
const ZLOZKY_NAZOV: Record<'A' | 'B' | 'C' | 'D' | 'E', string> = {
  A: 'Šírka',
  B: 'Deti',
  C: 'Družstvá',
  D: 'Kontinuita',
  E: 'Prechod',
};

interface Props {
  /**
   * Riadky zbalené do reťazca — jeden klub na riadok, polia oddelené `|`:
   * `slug|nazov|index|stav|A|B|C|D|E|skupiny|deti|druzstva|sezon|podielU21`.
   * `E` je prázdne, keď klub nemá družstvo dospelých.
   */
  rows: string;
  sezona: string;
  /** Mapa slug zväzu → názov, na filter. */
  zvazy?: { id: string; nazov: string }[];
  /** Mapa slug klubu → slug zväzu. */
  klubZvaz?: Record<string, string>;
}

interface Riadok {
  slug: string;
  nazov: string;
  index: number;
  stav: string;
  A: number; B: number; C: number; D: number; E: number | null;
  skupiny: number; deti: number; druzstva: number; sezon: number;
  u21: number | null;
}

const STRANA = 50;

/**
 * Celoslovenská tabuľka Indexu klubu (rozhodnutie Ján Letko: bez rozdelenia na
 * skupiny). Nad tabuľkou stojí vysvetlenie, čo index nemeria — je to povinná
 * súčasť každého zobrazenia, nie odkaz v pätičke.
 */
export default function IndexTabulka({ rows, sezona, zvazy, klubZvaz }: Props) {
  const [hladanie, setHladanie] = useState('');
  const [zvaz, setZvaz] = useState('');
  const [strana, setStrana] = useState(0);
  const [detail, setDetail] = useState<string | null>(null);
  const tip = useTooltip();

  const data = useMemo<Riadok[]>(() => {
    if (!rows) return [];
    return rows.split('\n').map((r) => {
      const p = r.split('|');
      return {
        slug: p[0], nazov: p[1], index: Number(p[2]), stav: p[3],
        A: Number(p[4]), B: Number(p[5]), C: Number(p[6]), D: Number(p[7]),
        E: p[8] === '' ? null : Number(p[8]),
        skupiny: Number(p[9]), deti: Number(p[10]), druzstva: Number(p[11]),
        sezon: Number(p[12]), u21: p[13] === '' ? null : Number(p[13]),
      };
    });
  }, [rows]);

  const filtrovane = useMemo(() => {
    const q = hladanie.trim().toLowerCase();
    return data.filter((r) => {
      if (zvaz && klubZvaz?.[r.slug] !== zvaz) return false;
      if (q && !r.nazov.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, hladanie, zvaz, klubZvaz]);

  const strán = Math.max(1, Math.ceil(filtrovane.length / STRANA));
  const s = Math.min(strana, strán - 1);
  const vidno = filtrovane.slice(s * STRANA, (s + 1) * STRANA);

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 16, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    border: active ? 'none' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  const pruh = (v: number, max: number, farba: string) => (
    <span style={{ display: 'inline-block', width: 34, height: 6, background: '#eef0f3', borderRadius: 3, overflow: 'hidden' }}>
      <span style={{ display: 'block', width: `${(v / max) * 100}%`, height: '100%', background: farba }} />
    </span>
  );

  return (
    <div onMouseLeave={tip.skry}>
      <tip.Tooltip />
      <p style={{
        background: '#fff7e6', border: '1px solid #f5d9a3', borderRadius: 10,
        padding: '10px 13px', fontSize: 12.5, color: '#7a4d00', margin: '0 0 14px', lineHeight: 1.55,
      }}>
        <strong>Čo index nemeria:</strong> {INDEX_LIMITY}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          type="search"
          value={hladanie}
          onChange={(e) => { setHladanie(e.target.value); setStrana(0); }}
          placeholder="Hľadať klub…"
          style={{
            padding: '7px 14px', borderRadius: 18, border: '1px solid #dcdfe4',
            fontSize: 13, minWidth: 210, background: 'var(--color-card)',
            color: 'var(--color-ink)', outline: 'none',
          }}
        />
        {zvazy && zvazy.length > 0 && (
          // natívny <select> je zámerný — na mobile otvorí systémový picker, čo je
          // pri 43 zväzoch pohodlnejšie než vlastný dropdown. Štýluje sa len zavretý
          // stav (appearance:none + vlastná šípka), aby sadol k zvyšku UI.
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <select
              value={zvaz}
              onChange={(e) => { setZvaz(e.target.value); setStrana(0); }}
              style={{
                appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                padding: '7px 34px 7px 14px', borderRadius: 18,
                border: zvaz ? 'none' : '1px solid #dcdfe4',
                background: zvaz ? 'var(--color-sfz-blue)' : 'var(--color-card)',
                color: zvaz ? '#fff' : 'var(--color-ink)',
                fontSize: 13, fontWeight: zvaz ? 600 : 400,
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="">Všetky zväzy</option>
              {zvazy.map((z) => <option key={z.id} value={z.id}>{z.nazov}</option>)}
            </select>
            <span
              aria-hidden
              style={{
                position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', fontSize: 9, lineHeight: 1,
                color: zvaz ? '#fff' : 'var(--color-muted)',
              }}
            >
              ▼
            </span>
          </span>
        )}
        {(zvaz || hladanie) && (
          <button
            type="button"
            onClick={() => { setZvaz(''); setHladanie(''); setStrana(0); }}
            style={{
              padding: '7px 12px', borderRadius: 18, border: '1px solid #dcdfe4',
              background: 'var(--color-card)', color: 'var(--color-muted)',
              fontSize: 12.5, cursor: 'pointer',
            }}
          >
            Zrušiť filter
          </button>
        )}
        <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>
          {fmt(filtrovane.length)} klubov · sezóna {sezona}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 12 }}>
              <th style={{ padding: '6px 8px 6px 0', width: 44 }}>#</th>
              <th style={{ padding: '6px 8px 6px 0' }}>Klub</th>
              <th style={{ padding: '6px 8px', textAlign: 'center', width: 70 }}>Index</th>
              {(['A', 'B', 'C', 'D', 'E'] as const).map((k) => (
                <th
                  key={k}
                  style={{ padding: '6px 8px', textAlign: 'center' }}
                  aria-label={ZLOZKY_POPIS[k].popis}
                  {...tip.viazat(
                    <>
                      <TipNadpis>{ZLOZKY_NAZOV[k]}</TipNadpis>
                      <div style={{ whiteSpace: 'normal' }}>{ZLOZKY_POPIS[k].popis}</div>
                    </>,
                  )}
                >
                  {ZLOZKY_NAZOV[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vidno.map((r, i) => {
              const poradie = s * STRANA + i + 1;
              const otvoreny = detail === r.slug;
              return (
                <>
                  <tr
                    key={r.slug}
                    onClick={() => setDetail(otvoreny ? null : r.slug)}
                    style={{ borderTop: '1px solid var(--color-line, #eef0f3)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '7px 8px 7px 0', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {poradie}
                    </td>
                    <td style={{ padding: '7px 8px 7px 0' }}>
                      <a href={`/klub/${r.slug}`} style={{ color: 'var(--color-sfz-blue)' }} onClick={(e) => e.stopPropagation()}>
                        {r.nazov}
                      </a>
                      {r.stav === 'bez-dospelych' && (
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}> · bez dospelých</span>
                      )}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {r.stav === 'bez-mladeze'
                        ? <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-muted)' }}>bez mládeže</span>
                        : r.index}
                    </td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pruh(r.A, 30, '#1450df')}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pruh(r.B, 25, '#1450df')}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pruh(r.C, 15, '#4d7fe8')}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>{pruh(r.D, 15, '#4d7fe8')}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                      {r.E === null ? <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>—</span> : pruh(r.E, 15, '#2fa36b')}
                    </td>
                  </tr>
                  {otvoreny && (
                    <tr key={r.slug + '-d'} style={{ background: '#f7f9fc' }}>
                      <td />
                      <td colSpan={7} style={{ padding: '8px 8px 12px', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.6 }}>
                        <strong style={{ color: 'var(--color-ink)' }}>{r.nazov}</strong> — obsadené skupiny mládeže:{' '}
                        <b style={{ color: 'var(--color-ink)' }}>{r.skupiny} z 3</b>, detí v mládeži:{' '}
                        <b style={{ color: 'var(--color-ink)' }}>{fmt(r.deti)}</b>, družstiev mládeže:{' '}
                        <b style={{ color: 'var(--color-ink)' }}>{r.druzstva}</b>, mládež nepretržite:{' '}
                        <b style={{ color: 'var(--color-ink)' }}>{r.sezon} {r.sezon === 1 ? 'sezónu' : r.sezon < 5 ? 'sezóny' : 'sezón'}</b>
                        {r.u21 !== null && <>, hráčov do 21 rokov v dospelých: <b style={{ color: 'var(--color-ink)' }}>{Math.round(r.u21 * 100)} %</b></>}.
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {strán > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, fontSize: 12.5 }}>
          <button type="button" style={pill(false)} disabled={s === 0} onClick={() => setStrana(s - 1)}>
            ← Späť
          </button>
          <span style={{ color: 'var(--color-muted)' }}>strana {s + 1} z {strán}</span>
          <button type="button" style={pill(false)} disabled={s >= strán - 1} onClick={() => setStrana(s + 1)}>
            Ďalej →
          </button>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        Klikni na riadok pre rozpad zložiek. Index je súčet piatich zložiek:{' '}
        {(['A', 'B', 'C', 'D', 'E'] as const).map((k, i) => (
          <span key={k}>{i ? ', ' : ''}{ZLOZKY_POPIS[k].nazov.toLowerCase()} ({ZLOZKY_POPIS[k].max} b.)</span>
        ))}
        . Klub bez družstva dospelých sa hodnotí zo štyroch zložiek prepočítaných na sto bodov —
        prechod do dospelých sa mu vyhodnotiť nedá.
      </p>
    </div>
  );
}
