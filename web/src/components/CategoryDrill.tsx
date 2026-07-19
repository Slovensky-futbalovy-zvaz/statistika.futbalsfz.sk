import { useState } from 'react';
import { fmt } from '../lib/format';
import { GROUPS } from '../lib/palette';

interface Kat {
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

  const skupiny = GROUPS.map((g) => {
    const uKody = g.cats
      .filter((c) => kategorie[c])
      .map((c) => ({ cat: c, ...kategorie[c] }))
      .sort((a, b) => b.zapasy - a.zapasy);
    const zapasy = uKody.reduce((s, k) => s + k.zapasy, 0);
    const druzstva = uKody.reduce((s, k) => s + k.druzstva, 0);
    const goly = uKody.reduce((s, k) => s + k.goly, 0);
    return { ...g, uKody, zapasy, druzstva, goly };
  }).filter((g) => g.zapasy > 0 || g.uKody.length > 0);

  const max = Math.max(1, ...skupiny.map((s) => s.zapasy));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                  <b style={{ color: 'var(--color-ink)' }}>{fmt(g.zapasy)}</b> zápasov · {fmt(g.druzstva)} druž.
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'var(--color-track)' }}>
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
                        {fmt(u.zapasy)} z. · {fmt(u.druzstva)} d. · {fmt(u.goly)} g.
                      </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: 'var(--color-track)' }}>
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
