import { useState } from 'react';
import { delta, fmt } from '../lib/format';
import { METRIKA_DEFAULT, METRIKA_POPIS, type MetrikaSutazi } from '../lib/urovneTypy';
import { useTooltip } from './Tooltip.tsx';

interface Props {
  /** Počet súťažných skupín (základných častí) v zobrazenej sezóne. */
  skupiny: number;
  /** Počet zastrešujúcich súťaží v zobrazenej sezóne. */
  sutaze: number;
  skupinyPredch?: number;
  sutazePredch?: number;
}

/**
 * KPI karta „Súťaže“ s prepínačom Skupiny / Súťaže.
 *
 * Jediná karta v KPI páse, ktorá je islandom — ostatné sú statické. Dôvod:
 * počet súťaží sa nedá vykázať jedným číslom. „III. liga U19 ZsFZ“ je v ISSF
 * jedna súťaž, ale hrajú sa v nej dve paralelné skupiny (JV a SZ), z ktorých
 * každá má vlastných účastníkov aj vlastnú tabuľku — a rovnakú realitu vedie
 * VsFZ ako samostatné súťaže. Publikované čísla za staršie sezóny sa
 * neprepisujú, preto je tu prepínač a nie tichá zmena metriky
 * (rozhodnutie Ján Letko, 8. 8. 2026).
 */
export default function KpiSutazeKarta({ skupiny, sutaze, skupinyPredch, sutazePredch }: Props) {
  // Predvolené sú SKUPINY — to, v čom sa reálne hrá
  const [metrika, setMetrika] = useState<MetrikaSutazi>(METRIKA_DEFAULT);
  const tip = useTooltip();
  const jeSkupiny = metrika === 'skupiny';
  const hodnota = jeSkupiny ? skupiny : sutaze;
  const predch = jeSkupiny ? skupinyPredch : sutazePredch;
  const d = delta(hodnota, predch, true);

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '1px 8px',
    borderRadius: 12,
    fontSize: 10.5,
    fontWeight: 700,
    cursor: 'pointer',
    lineHeight: 1.6,
    border: active ? '1px solid transparent' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'transparent',
    color: active ? '#fff' : 'var(--color-muted)',
  });

  return (
    <>
      <tip.Tooltip />
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
        {jeSkupiny ? 'Súťažné skupiny' : 'Súťaže'}
      </div>
      <div
        className="tnum mt-1.5 font-extrabold"
        style={{ fontSize: 'clamp(20px,17cqi,32px)', lineHeight: 1.05, whiteSpace: 'nowrap' }}
        aria-label={METRIKA_POPIS[metrika].popis}
        {...tip.viazat(<div style={{ whiteSpace: 'normal' }}>{METRIKA_POPIS[metrika].popis}</div>)}
      >
        {fmt(hodnota)}
      </div>
      {d && (
        <div className="mt-1 text-xs">
          <span className="tnum font-semibold" style={{ color: d.color }}>
            {d.arrow} {d.text}
          </span>
          <span className="text-muted"> medziročne</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
        {(['skupiny', 'sutaze'] as MetrikaSutazi[]).map((m) => (
          <button
            key={m}
            type="button"
            style={pill(metrika === m)}
            aria-label={METRIKA_POPIS[m].popis}
            {...tip.viazat(<div style={{ whiteSpace: 'normal' }}>{METRIKA_POPIS[m].popis}</div>)}
            onClick={() => setMetrika(m)}
          >
            {METRIKA_POPIS[m].label}
          </button>
        ))}
      </div>
    </>
  );
}
