import { useMemo, useState } from 'react';
import { fmt, fmt1, bezDiakritiky } from '../lib/format';
import type { KlubIndexPolozka } from '../lib/data';

interface Props {
  kluby: KlubIndexPolozka[];
}

const STLPCE = [
  { key: 'zapasy', label: 'Zápasy', f: 0 },
  { key: 'hraci', label: 'Hráči', f: 0 },
];

const REGION: Record<string, string> = { sfz: '#7a44e0', bfz: '#1450df', zsfz: '#2f9bff', ssfz: '#12a06b', vsfz: '#f0961b' };

/** Zoznam klubov — search (bez diakritiky) + filter úrovne + zoraditeľná tabuľka. */
export default function KlubyView({ kluby }: Props) {
  const [q, setQ] = useState('');
  const [uroven, setUroven] = useState<string>('VSETKY');
  const [sortKey, setSortKey] = useState('zapasy');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const filter = bezDiakritiky(q.trim());
  const urovne = ['VSETKY', 'SFZ', 'RFZ', 'ObFZ'];

  const rows = useMemo(() => {
    let r = kluby;
    if (uroven !== 'VSETKY') r = r.filter((k) => k.uroven === uroven);
    if (filter) r = r.filter((k) => bezDiakritiky(k.nazov).includes(filter) || bezDiakritiky(k.zvazNazov).includes(filter));
    r = [...r].sort((a, b) => (((a as unknown as Record<string, number>)[sortKey]) - ((b as unknown as Record<string, number>)[sortKey])) * sortDir);
    return r.slice(0, 200);
  }, [kluby, uroven, filter, sortKey, sortDir]);

  const klubUrl = (k: KlubIndexPolozka) => {
    const s = k.sezony?.[k.sezony.length - 1];
    return s ? `/klub/${k.id}/${s.replace('/', '-')}` : `/klub/${k.id}`;
  };

  function sort(k: string) {
    if (k === sortKey) setSortDir((d) => (d === -1 ? 1 : -1));
    else { setSortKey(k); setSortDir(-1); }
  }

  const pill = (aktiv: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
    background: aktiv ? 'var(--color-card)' : 'transparent', color: aktiv ? 'var(--color-sfz-blue)' : 'var(--color-muted)', boxShadow: aktiv ? 'var(--shadow-card)' : 'none',
  });

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', background: 'var(--color-track)', borderRadius: 12, padding: 3 }}>
          {urovne.map((u) => (
            <button key={u} type="button" style={pill(uroven === u)} onClick={() => setUroven(u)}>{u === 'VSETKY' ? 'Všetky' : u}</button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hľadať klub…"
          style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 10, border: '1px solid var(--color-line)', fontSize: 14, outline: 'none' }}
        />
      </div>

      <div className="border border-line" style={{ background: 'var(--color-card)', borderRadius: 16, padding: 18, boxShadow: 'var(--shadow-card)', overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-muted)', borderBottom: '1px solid var(--color-line)' }}>
              <th style={{ padding: '8px 16px 8px 0', fontWeight: 600 }}>Klub</th>
              <th style={{ padding: '8px 8px', fontWeight: 600 }}>Zväz</th>
              {STLPCE.map((s) => (
                <th key={s.key} style={{ padding: '8px 8px', fontWeight: 600, textAlign: 'right', cursor: 'pointer', color: s.key === sortKey ? 'var(--color-sfz-blue)' : undefined }} onClick={() => sort(s.key)}>
                  {s.label} {s.key === sortKey ? (sortDir === -1 ? '▼' : '▲') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((k, i) => (
              <tr key={k.id} style={{ borderBottom: '1px solid var(--color-line)', cursor: 'pointer', background: i % 2 ? 'rgba(0,0,0,.015)' : undefined }} onClick={() => (window.location.href = klubUrl(k))}>
                <td style={{ padding: '8px 16px 8px 0' }}>
                  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: REGION[k.zvaz ?? ''] ?? '#c7ccd2', marginRight: 8 }} />
                  <a href={klubUrl(k)} style={{ color: 'var(--color-sfz-blue)' }} onClick={(e) => e.stopPropagation()}>{k.nazov}</a>
                </td>
                <td style={{ padding: '8px 8px', color: 'var(--color-muted)' }}>{k.zvazNazov}</td>
                {STLPCE.map((s) => (
                  <td key={s.key} className="tnum" style={{ padding: '8px 8px', textAlign: 'right' }}>
                    {s.f ? fmt1((k as unknown as Record<string, number>)[s.key]) : fmt((k as unknown as Record<string, number>)[s.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
          Zobrazených {rows.length} z {kluby.length} klubov. Použi vyhľadávanie alebo filter úrovne na zúženie; klik na riadok otvorí profil.
        </p>
      </div>
    </div>
  );
}
