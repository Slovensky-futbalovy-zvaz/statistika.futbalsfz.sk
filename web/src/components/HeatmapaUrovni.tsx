import { useMemo } from 'react';
import { rozbal, type UrovneVCase } from '../lib/urovneTypy';
import { fmt } from '../lib/format';
import { UROVEN_LABEL, UROVEN_LABEL_KRATKY } from '../lib/palette';

export interface HeatmapaProps {
  data: UrovneVCase;
  /** Sezóna, ktorú matica zobrazuje (RRRR/RRRR). */
  sezona: string;
  /** Index vekovej kategórie (-1 = všetky) — riadi ho UrovneSekcia. */
  kat: number;
  /** Index pohlavia v POHLAVIA_PORADIE (-1 = všetci). */
  gender: number;
}

/**
 * Matica zväzy × úrovne súťaže — koľko súťaží ktorý zväz riadi na ktorej úrovni.
 * Číslo v bunke je presný počet, sýtosť farby dáva obraz na prvý pohľad.
 *
 * Filtre vekovej kategórie a pohlavia drží nadradená sekcia.
 */
export default function HeatmapaUrovni({ data, sezona, kat, gender }: HeatmapaProps) {
  const si = data.sezony.indexOf(sezona);

  const { bunky, urovneIdx, zvazyIdx, max } = useMemo(() => {
    const m = new Map<string, number>();
    const pouziteU = new Set<number>();
    const pouziteZ = new Set<number>();
    for (const [zi, s, ui, ki, g, n] of rozbal(data.rows)) {
      if (s !== si) continue;
      if (kat >= 0 && ki !== kat) continue;
      if (gender >= 0 && g !== gender) continue;
      m.set(`${zi}|${ui}`, (m.get(`${zi}|${ui}`) ?? 0) + n);
      pouziteU.add(ui);
      pouziteZ.add(zi);
    }
    return {
      bunky: m,
      urovneIdx: data.urovne.map((_, i) => i).filter((i) => pouziteU.has(i)),
      zvazyIdx: data.zvazy.map((_, i) => i).filter((i) => pouziteZ.has(i)),
      max: Math.max(1, ...m.values()),
    };
  }, [data, si, kat, gender]);

  const bunka = (n: number): React.CSSProperties => {
    // Pri reze, kde je všade najviac jedna súťaž, by pomer n/max spravil všetky
    // bunky plne sýte a matica by pôsobila ako jedna tmavá plocha — vtedy sa
    // použije miernejšia pevná sýtosť.
    const t = max <= 1 ? 0.3 : n / max;
    return {
      background: n === 0 ? 'var(--color-track, #f4f6f8)' : `rgba(20, 80, 223, ${(0.12 + t * 0.8).toFixed(2)})`,
      color: n && t > 0.5 ? '#fff' : 'var(--color-ink)',
      textAlign: 'center',
      fontWeight: n ? 700 : 400,
      fontVariantNumeric: 'tabular-nums',
      padding: '5px 4px',
      borderRadius: 4,
      fontSize: 12,
    };
  };

  if (zvazyIdx.length === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
        V sezóne {sezona} nemá pre tento rez žiadny zväz súťaže.
      </p>
    );
  }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              {/* prvý stĺpec si vezme zvyšnú šírku (bunky majú pevných 78 px),
                  aby sa nerozťahovali cez pôl tabuľky pri jedinej úrovni v reze */}
              <th style={{ textAlign: 'left', color: 'var(--color-muted)', fontWeight: 600, padding: '0 6px 4px 0', minWidth: 180 }}>
                Zväz
              </th>
              {urovneIdx.map((ui) => (
                <th
                  key={ui}
                  title={UROVEN_LABEL[data.urovne[ui]]}
                  style={{ color: 'var(--color-muted)', fontWeight: 600, padding: '0 2px 4px', whiteSpace: 'nowrap', width: 78 }}
                >
                  {UROVEN_LABEL_KRATKY[data.urovne[ui]] ?? data.urovne[ui]}
                </th>
              ))}
              <th style={{ color: 'var(--color-muted)', fontWeight: 600, padding: '0 0 4px 6px', textAlign: 'center' }}>
                Spolu
              </th>
            </tr>
          </thead>
          <tbody>
            {zvazyIdx.map((zi) => {
              const spolu = urovneIdx.reduce((s, ui) => s + (bunky.get(`${zi}|${ui}`) ?? 0), 0);
              return (
                <tr key={zi}>
                  <td style={{ padding: '0 6px 0 0', whiteSpace: 'nowrap' }}>
                    <a href={`/zvaz/${data.zvazy[zi].id}`} style={{ color: 'var(--color-sfz-blue)' }}>
                      {data.zvazy[zi].nazov}
                    </a>
                  </td>
                  {urovneIdx.map((ui) => {
                    const n = bunky.get(`${zi}|${ui}`) ?? 0;
                    return (
                      <td
                        key={ui}
                        style={bunka(n)}
                        title={`${data.zvazy[zi].nazov} · ${UROVEN_LABEL[data.urovne[ui]]}: ${fmt(n)} súťaží`}
                      >
                        {n || ''}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      padding: '0 0 0 6px',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      textAlign: 'center',
                    }}
                  >
                    {fmt(spolu)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)' }}>
        Sezóna {sezona}. Prázdna bunka znamená, že zväz na danej úrovni v tomto reze nemá žiadnu
        súťaž. Poháre, turnaje a súťaže s neuvedenou úrovňou majú vlastný stĺpec — do ligovej
        pyramídy nepatria.
      </p>
    </div>
  );
}
