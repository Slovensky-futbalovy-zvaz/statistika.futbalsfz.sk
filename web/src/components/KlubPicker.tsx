import { useEffect, useMemo, useRef, useState } from 'react';
import { bezDiakritiky } from '../lib/format';

interface KlubItem {
  id: string;
  nazov: string;
  zvazNazov: string;
  uroven: string;
}
interface Props {
  kluby: KlubItem[];
  aktualne?: string;
  hrefTemplate?: string; // default /klub/{id}
}

/** Vyhľadávací výber klubu (kluby vnorené pod svojím zväzom). Search bez diakritiky. */
export default function KlubPicker({ kluby, aktualne, hrefTemplate = '/klub/{id}' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const aktualny = kluby.find((k) => k.id === aktualne);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filter = bezDiakritiky(q.trim());
  const vysledky = useMemo(() => {
    if (filter.length < 2) return [];
    const f = kluby.filter((k) => bezDiakritiky(k.nazov).includes(filter)).slice(0, 60);
    // zoskup podľa zväzu
    const grp = new Map<string, KlubItem[]>();
    for (const k of f) {
      const key = k.zvazNazov;
      if (!grp.has(key)) grp.set(key, []);
      grp.get(key)!.push(k);
    }
    return [...grp.entries()];
  }, [kluby, filter]);

  function go(id: string) {
    window.location.href = hrefTemplate.replace('{id}', id);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-line)', background: 'var(--color-card)', borderRadius: 18, padding: '7px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: 'var(--color-ink)', maxWidth: 320 }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aktualny?.nazov ?? 'Vyber klub'}</span>
        <span style={{ color: 'var(--color-muted)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 340, maxHeight: 460, overflowY: 'auto', background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 12, boxShadow: 'var(--shadow-pop)', padding: 8, zIndex: 60 }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hľadať klub…"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-line)', fontSize: 13.5, marginBottom: 6, outline: 'none' }}
          />
          {filter.length < 2 && <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--color-muted)' }}>Začni písať názov klubu (min. 2 znaky).</div>}
          {filter.length >= 2 && vysledky.length === 0 && <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--color-muted)' }}>Žiadny klub nenájdený.</div>}
          {vysledky.map(([zvaz, list]) => (
            <div key={zvaz} style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-muted)', padding: '4px 10px' }}>{zvaz}</div>
              {list.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => go(k.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px 6px 20px', borderRadius: 8, fontSize: 13.5, fontWeight: k.id === aktualne ? 700 : 500, color: k.id === aktualne ? 'var(--color-sfz-blue)' : 'var(--color-ink)', background: k.id === aktualne ? '#eef3ff' : 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  {k.nazov}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
