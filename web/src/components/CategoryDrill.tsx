import { useState } from 'react';
import { fmt } from '../lib/format';
import { GROUPS } from '../lib/palette';
import { TipNadpis, TipRiadok, useTooltip } from './Tooltip.tsx';

interface Kat {
  sutaze?: number;
  zapasy: number;
  druzstva: number;
  goly: number;
  divaci: number;
  zlte: number;
  cervene: number;
}
interface Props {
  kategorie: Record<string, Kat>;
}

/** Zápasy podľa vekových skupín; klik na skupinu rozbalí jej U-úrovne. */
export default function CategoryDrill({ kategorie }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const tip = useTooltip();

  /** Rozpísaný popisok — v riadku sú čísla len skratkami („12 z. · 4 d.“). */
  const popisok = (nadpis: string, k: { sutaze?: number; zapasy: number; druzstva: number; goly: number }) => (
    <>
      <TipNadpis>{nadpis}</TipNadpis>
      {(k.sutaze ?? 0) > 0 && <TipRiadok popis="Súťaže" hodnota={fmt(k.sutaze ?? 0)} />}
      <TipRiadok popis="Odohraté zápasy" hodnota={fmt(k.zapasy)} />
      <TipRiadok popis="Družstvá" hodnota={fmt(k.druzstva)} />
      <TipRiadok popis="Góly" hodnota={fmt(k.goly)} />
      {k.zapasy > 0 && (
        <TipRiadok popis="Góly na zápas" hodnota={(k.goly / k.zapasy).toFixed(1)} />
      )}
    </>
  );

  const skupiny = GROUPS.map((g) => {
    const uKody = g.cats
      .filter((c) => kategorie[c])
      .map((c) => ({ cat: c, ...kategorie[c] }))
      .sort((a, b) => b.zapasy - a.zapasy);
    const zapasy = uKody.reduce((s, k) => s + k.zapasy, 0);
    const druzstva = uKody.reduce((s, k) => s + k.druzstva, 0);
    const goly = uKody.reduce((s, k) => s + k.goly, 0);
    const sutaze = uKody.reduce((s, k) => s + (k.sutaze ?? 0), 0);
    return { ...g, uKody, zapasy, druzstva, goly, sutaze };
  }).filter((g) => g.zapasy > 0 || g.uKody.length > 0);

  const max = Math.max(1, ...skupiny.map((s) => s.zapasy));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onMouseLeave={tip.skry}>
      <tip.Tooltip />
      {skupiny.map((g) => {
        const rozbalene = open === g.key;
        return (
          <div key={g.key}>
            <button
              type="button"
              onClick={() => setOpen(rozbalene ? null : g.key)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3, fontSize: 13.5 }}>
                <span style={{ fontWeight: 600 }}>
                  <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>{rozbalene ? '▾' : '▸'}</span> {g.key}
                </span>
                <span className="tnum" style={{ color: 'var(--color-muted)' }}>
                  <b style={{ color: 'var(--color-ink)' }}>{fmt(g.zapasy)}</b> zápasov
                  {g.sutaze > 0 && <> · {fmt(g.sutaze)} súť.</>} · {fmt(g.druzstva)} druž.
                </span>
              </div>
              <div
                style={{ height: 10, borderRadius: 5, background: 'var(--color-track)' }}
                aria-label={`${g.key}: ${fmt(g.zapasy)} zápasov`}
                {...tip.viazat(popisok(g.key, g))}
              >
                <div style={{ height: '100%', width: `${(g.zapasy / max) * 100}%`, borderRadius: 5, background: g.color, transition: 'width .3s' }} />
              </div>
            </button>

            {rozbalene && g.uKody.length > 0 && (
              <div style={{ marginTop: 8, marginLeft: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.uKody.map((u) => (
                  <div key={u.cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 2 }}>
                      <span>{u.cat}</span>
                      <span className="tnum" style={{ color: 'var(--color-muted)' }}>
                        {(u.sutaze ?? 0) > 0 && <>{fmt(u.sutaze ?? 0)} s. · </>}
                        {fmt(u.zapasy)} z. · {fmt(u.druzstva)} d. · {fmt(u.goly)} g.
                      </span>
                    </div>
                    <div
                      style={{ height: 7, borderRadius: 4, background: 'var(--color-track)' }}
                      aria-label={`${u.cat}: ${fmt(u.zapasy)} zápasov`}
                      {...tip.viazat(popisok(`${g.key} · ${u.cat}`, u))}
                    >
                      <div style={{ height: '100%', width: `${(u.zapasy / max) * 100}%`, borderRadius: 4, background: g.color, opacity: 0.7 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
