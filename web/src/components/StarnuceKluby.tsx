import { useMemo, useState } from 'react';
import { fmt, fmt1 } from '../lib/format';

interface Props {
  /**
   * Riadky zbalené do reťazca — jeden klub na riadok, polia oddelené `|`:
   * `slug|nazov|trend×100|medianPrva|medianPosledna|zmenaHracov|zapisov|u21×1000`.
   */
  rows: string;
  /** Sezóny okna, cez ktoré sa trend počíta. */
  okno: string[];
}

interface Riadok {
  slug: string; nazov: string; trend: number;
  medPrva: number; medPosl: number; zmenaHracov: number; zapisov: number; u21: number;
}

const STRANA = 25;

/**
 * Rebríček klubov, ktorým vek dospelého družstva RASTIE (rozhodnutie Ján Letko,
 * 7. 8. 2026) — klub starne a nedopĺňa mladých.
 *
 * Radí sa podľa sklonu mediánu za tri sezóny, nie podľa medziročnej zmeny: jeden
 * odchádzajúci ročník alebo séria zranení nesmie rozhodovať o umiestnení.
 *
 * Vedľa veku stojí zmena počtu hráčov — bez nej sa nedá odlíšiť zdravé omladenie
 * od rozpadu kádra. Meranie 7. 8. 2026: dva kluby s takmer rovnakým poklesom veku
 * (−3,4 a −3,2 roka), pričom prvému klesli zápisy na polovicu a druhému narástli.
 */
export default function StarnuceKluby({ rows, okno }: Props) {
  const [strana, setStrana] = useState(0);

  const data = useMemo<Riadok[]>(() => {
    if (!rows) return [];
    return rows.split('\n').map((r) => {
      const p = r.split('|');
      return {
        slug: p[0], nazov: p[1], trend: Number(p[2]) / 100,
        medPrva: Number(p[3]), medPosl: Number(p[4]),
        zmenaHracov: Number(p[5]), zapisov: Number(p[6]), u21: Number(p[7]) / 1000,
      };
    });
  }, [rows]);

  const strán = Math.max(1, Math.ceil(data.length / STRANA));
  const s = Math.min(strana, strán - 1);
  const vidno = data.slice(s * STRANA, (s + 1) * STRANA);

  const pill: React.CSSProperties = {
    padding: '4px 12px', borderRadius: 16, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', border: '1px solid #dcdfe4', background: 'var(--color-card)',
    color: 'var(--color-ink)',
  };

  if (!data.length) {
    return <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Zatiaľ niet dosť sezón na výpočet trendu.</p>;
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 12 }}>
              <th style={{ padding: '6px 8px 6px 0', width: 44 }}>#</th>
              <th style={{ padding: '6px 8px 6px 0' }}>Klub</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }} title="Sklon mediánu veku za tri sezóny">
                Starne o
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Medián veku</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }} title="Zmena počtu zápisov hráčov medzi prvou a poslednou sezónou okna">
                Hráčov
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }} title="Podiel zápisov hráčov do 21 rokov">
                Do 21 r.
              </th>
            </tr>
          </thead>
          <tbody>
            {vidno.map((r, i) => (
              <tr key={r.slug} style={{ borderTop: '1px solid var(--color-line, #eef0f3)' }}>
                <td style={{ padding: '7px 8px 7px 0', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {s * STRANA + i + 1}
                </td>
                <td style={{ padding: '7px 8px 7px 0' }}>
                  <a href={`/klub/${r.slug}`} style={{ color: 'var(--color-sfz-blue)' }}>{r.nazov}</a>
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 800, color: '#c0392b', fontVariantNumeric: 'tabular-nums' }}>
                  +{fmt1(r.trend)} r./sez.
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {r.medPrva} → <b>{r.medPosl}</b>
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                             color: r.zmenaHracov < -10 ? '#c0392b' : 'var(--color-ink)' }}>
                  {r.zmenaHracov > 0 ? '+' : ''}{Math.round(r.zmenaHracov)} %
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                             color: r.u21 < 0.05 ? '#c0392b' : 'var(--color-ink)' }}>
                  {Math.round(r.u21 * 100)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {strán > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, fontSize: 12.5 }}>
          <button type="button" style={pill} disabled={s === 0} onClick={() => setStrana(s - 1)}>← Späť</button>
          <span style={{ color: 'var(--color-muted)' }}>strana {s + 1} z {strán}</span>
          <button type="button" style={pill} disabled={s >= strán - 1} onClick={() => setStrana(s + 1)}>Ďalej →</button>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        Trend je sklon mediánu veku za sezóny {okno.join(', ')} — koľko rokov ročne pribúda
        priemernému hráčovi v zápise dospelého družstva. Zoradené od najrýchlejšie starnúcich.
        Stĺpec <b>Hráčov</b> ukazuje, ako sa medzitým zmenil počet zápisov: klub, ktorému vek
        rastie <i>a zároveň</i> ubúdajú hráči, je na tom horšie než ten, ktorému len pribúdajú roky.
        Stĺpec <b>Do 21 r.</b> je priamy ukazovateľ, či klub dopĺňa mladých.
        Zobrazené sú len kluby s aspoň 100 zápismi v každej z troch sezón.
      </p>
    </div>
  );
}
