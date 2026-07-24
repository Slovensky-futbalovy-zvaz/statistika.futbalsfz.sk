import { useMemo, useState } from 'react';
import { fmt, bezDiakritiky } from '../lib/format';
import type { KlubIndexPolozka } from '../lib/data';

interface Props {
  kluby: KlubIndexPolozka[];
}

const REGION: Record<string, string> = { sfz: '#7a44e0', bfz: '#1450df', zsfz: '#2f9bff', ssfz: '#12a06b', vsfz: '#f0961b' };
const SORTY: { key: 'zapasy' | 'hraci'; label: string }[] = [
  { key: 'zapasy', label: 'Podľa zápasov' },
  { key: 'hraci', label: 'Podľa hráčov' },
];
const UROVNE = ['Všetky', 'SFZ', 'RFZ', 'ObFZ'];

/** Zoznam klubov ako rebríček s pruhmi (dizajn podľa vzoru): poradie · názov+zväz ·
 *  farebný pruh podľa regiónu · hodnota · šípka. Search + segment úrovne + sort pilulky. */
export default function KlubyView({ kluby }: Props) {
  const [q, setQ] = useState('');
  const [uroven, setUroven] = useState('Všetky');
  const [sortKey, setSortKey] = useState<'zapasy' | 'hraci'>('zapasy');

  const filter = bezDiakritiky(q.trim());

  const rows = useMemo(() => {
    let r = kluby.filter(
      (k) =>
        (uroven === 'Všetky' || k.uroven === uroven) &&
        (!filter || bezDiakritiky(k.nazov).includes(filter) || bezDiakritiky(k.zvazNazov).includes(filter)),
    );
    r = [...r].sort((a, b) => ((b[sortKey] as number) || 0) - ((a[sortKey] as number) || 0));
    return r;
  }, [kluby, uroven, filter, sortKey]);

  const max = Math.max(...rows.map((r) => (r[sortKey] as number) || 0), 1);

  const klubUrl = (k: KlubIndexPolozka) => {
    const s = k.sezony?.[k.sezony.length - 1];
    return s ? `/klub/${k.id}/${s.replace('/', '-')}` : `/klub/${k.id}`;
  };

  const segBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, border: 'none', cursor: 'pointer',
    color: active ? 'var(--color-ink)' : 'var(--color-muted)', background: active ? '#fff' : 'transparent',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
  });
  const sortBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    border: '1px solid ' + (active ? 'var(--color-sfz-blue)' : '#dcdfe4'),
    color: active ? '#fff' : 'var(--color-ink)', background: active ? 'var(--color-sfz-blue)' : '#fff',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '4px 0 18px' }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hľadať klub alebo zväz…"
          style={{ flex: '1 1 240px', minWidth: 200, border: '1px solid #d9dce1', borderRadius: 10, padding: '10px 13px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
        />
        <div style={{ display: 'inline-flex', background: 'var(--color-track)', borderRadius: 11, padding: 3 }}>
          {UROVNE.map((u) => (
            <button key={u} type="button" style={segBtn(uroven === u)} onClick={() => setUroven(u)}>{u}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SORTY.map((s) => (
            <button key={s.key} type="button" style={sortBtn(sortKey === s.key)} onClick={() => setSortKey(s.key)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="border border-line" style={{ background: 'var(--color-card)', borderRadius: 16, boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
        {rows.length ? (
          rows.map((r, i) => {
            const v = (r[sortKey] as number) || 0;
            return (
              <a
                key={r.id}
                href={klubUrl(r)}
                style={{
                  display: 'grid', gridTemplateColumns: '26px minmax(0,1fr) auto 14px', gap: 10, alignItems: 'center',
                  padding: '11px 14px', background: i % 2 ? '#fafbfc' : '#fff',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--color-line)' : 'none', color: 'inherit',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f2f6ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 ? '#fafbfc' : '#fff')}
              >
                <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-muted)' }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-ink)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: REGION[r.zvaz ?? ''] ?? '#bbbdbf', flex: '0 0 auto' }} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nazov}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 3, marginLeft: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(r.uroven || '') + ' · ' + r.zvazNazov}
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: '#eceef1', overflow: 'hidden', marginTop: 6, marginLeft: 17 }}>
                    <div style={{ height: '100%', width: `${(v / max) * 100}%`, background: REGION[r.zvaz ?? ''] ?? 'var(--color-sfz-blue)', borderRadius: 4 }} />
                  </div>
                </div>
                <span className="tnum" style={{ textAlign: 'right', fontSize: 14, fontWeight: 800, color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>{fmt(v)}</span>
                <span style={{ color: '#c4c8ce', fontSize: 13, textAlign: 'right' }}>›</span>
              </a>
            );
          })
        ) : (
          <div style={{ padding: '26px 16px', color: 'var(--color-muted)', fontSize: 14 }}>Žiadny klub nezodpovedá hľadaniu.</div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, background: '#eff4ff', border: '1px solid #cfe0ff', borderRadius: 10, padding: '11px 14px' }}>
        <strong style={{ color: 'var(--color-sfz-blue)' }}>Zobrazených {fmt(rows.length)} z {fmt(kluby.length)} klubov. </strong>
        Klub = organizácia naprieč všetkými súťažami v SR (sezóna {kluby[0]?.sezony?.[kluby[0].sezony.length - 1] ?? '2025/2026'}). Klik otvorí profil klubu.
      </div>
    </div>
  );
}
