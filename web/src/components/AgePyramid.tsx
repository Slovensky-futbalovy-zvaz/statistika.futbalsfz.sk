import { useMemo, useState } from 'react';
import type { Demografia } from '../lib/data';
import { fmt, endYear } from '../lib/format';
import { ROLA_LABEL, ROLY_PORADIE } from '../lib/palette';
import { TipNadpis, TipRiadok, useTooltip } from './Tooltip.tsx';

interface Props {
  // Pick<...> namiesto celeho Demografia — umoznuje znovupouzitie aj pre
  // DemografiaKlub (#37), ktora ma odlisny id field (klub, nie zvaz).
  demo: Pick<Demografia, 'sezony'>;
  sezona?: string; // ak nie je, použije sa posledná
}

// vekové pásma (zhora dole ako v prototype)
const PASMA: { label: string; test: (v: number) => boolean }[] = [
  { label: '50+', test: (v) => v >= 50 },
  { label: '40–49', test: (v) => v >= 40 && v <= 49 },
  { label: '35–39', test: (v) => v >= 35 && v <= 39 },
  { label: '30–34', test: (v) => v >= 30 && v <= 34 },
  { label: '25–29', test: (v) => v >= 25 && v <= 29 },
  { label: '20–24', test: (v) => v >= 20 && v <= 24 },
  { label: '16–19', test: (v) => v >= 16 && v <= 19 },
  { label: '13–15', test: (v) => v >= 13 && v <= 15 },
  { label: '10–12', test: (v) => v >= 10 && v <= 12 },
  { label: '6–9', test: (v) => v >= 6 && v <= 9 },
  { label: '≤5', test: (v) => v <= 5 },
];

/** Veková pyramída po pásmach (Muži vľavo modrá, Ženy vpravo červená). */
export default function AgePyramid({ demo, sezona }: Props) {
  const sezony = useMemo(() => Object.keys(demo.sezony).sort(), [demo]);
  const akt = sezona && demo.sezony[sezona] ? sezona : sezony[sezony.length - 1];
  const dostupneRoly = ROLY_PORADIE.filter((r) => sezony.some((s) => (demo.sezony[s]?.[r]?.osoby ?? 0) > 0));
  const [rola, setRola] = useState(dostupneRoly[0] ?? 'hraci');
  const tip = useTooltip();

  const { riadky, sumM, sumF } = useMemo(() => {
    const r = demo.sezony[akt]?.[rola];
    const ey = endYear(akt);
    const rows = PASMA.map((p) => ({ label: p.label, M: 0, F: 0 }));
    let sM = 0, sF = 0;
    if (r) {
      for (const [yr, pg] of Object.entries(r.roky)) {
        const vek = ey - parseInt(yr, 10);
        const idx = PASMA.findIndex((p) => p.test(vek));
        if (idx >= 0) {
          rows[idx].M += pg.M ?? 0;
          rows[idx].F += pg.F ?? 0;
        }
        sM += pg.M ?? 0;
        sF += pg.F ?? 0;
      }
    }
    return { riadky: rows, sumM: sM, sumF: sF };
  }, [demo, akt, rola]);

  const maxAbs = Math.max(1, ...riadky.map((r) => Math.max(r.M, r.F)));

  const pill = (aktiv: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 18, fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
    border: aktiv ? 'none' : '1px solid #dcdfe4',
    background: aktiv ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: aktiv ? '#fff' : 'var(--color-ink)',
  });

  const spoluVsetci = sumM + sumF;

  return (
    <div onMouseLeave={tip.skry}>
      <tip.Tooltip />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {dostupneRoly.map((r) => (
          <button key={r} type="button" style={pill(rola === r)} onClick={() => setRola(r)}>
            {ROLA_LABEL[r]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-sfz-blue)' }}>Muži · <span className="tnum">{fmt(sumM)}</span></div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>vek</div>
        <div style={{ textAlign: 'left', fontWeight: 700, color: 'var(--color-sfz-red)' }}>Ženy · <span className="tnum">{fmt(sumF)}</span></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {riadky.map((r) => (
          <div
            key={r.label}
            style={{ display: 'grid', gridTemplateColumns: '1fr 64px 1fr', alignItems: 'center', gap: 4 }}
            aria-label={`${r.label} rokov: muži ${fmt(r.M)}, ženy ${fmt(r.F)}`}
            {...tip.viazat(
              <>
                <TipNadpis>{`${r.label} rokov · ${ROLA_LABEL[rola]}`}</TipNadpis>
                <TipRiadok popis="Muži" hodnota={fmt(r.M)} />
                <TipRiadok popis="Ženy" hodnota={fmt(r.F)} />
                <TipRiadok popis="Spolu" hodnota={fmt(r.M + r.F)} />
                {spoluVsetci > 0 && (
                  <TipRiadok
                    popis="Podiel z roly"
                    hodnota={`${(((r.M + r.F) / spoluVsetci) * 100).toFixed(1)} %`}
                  />
                )}
              </>,
            )}
          >
            {/* muži vľavo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              {r.M > 0 && <span className="tnum" style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmt(r.M)}</span>}
              <span style={{ width: `${(r.M / maxAbs) * 100}%`, height: 16, background: 'var(--color-sfz-blue)', borderRadius: '4px 0 0 4px' }} />
            </div>
            <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 700 }}>{r.label}</div>
            {/* ženy vpravo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: `${(r.F / maxAbs) * 100}%`, height: 16, background: 'var(--color-sfz-red)', borderRadius: '0 4px 4px 0' }} />
              {r.F > 0 && <span className="tnum" style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmt(r.F)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
