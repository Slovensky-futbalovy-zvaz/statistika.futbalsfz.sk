import { useEffect, useMemo, useRef, useState } from 'react';
import { bezDiakritiky } from '../lib/format';
import { REGION, RFZ_LABEL } from '../lib/palette';

interface Zvaz {
  id: string;
  nazov: string;
  uroven: string; // SFZ | RFZ | ObFZ
  rfz?: string; // skratka nadr. RFZ (BFZ/ZsFZ/SsFZ/VsFZ)
}
interface Props {
  zvazy: Zvaz[];
  aktualne: string; // id
  hrefTemplate?: string; // default /zvaz/{id}
}

const RFZ_ID_OF_SKRATKA: Record<string, string> = { BFZ: 'bfz', ZsFZ: 'zsfz', SsFZ: 'ssfz', VsFZ: 'vsfz' };

/** Vyhľadávateľný výber zväzu; ObFZ vnorené pod svoj RFZ, SFZ na vrchu. */
export default function ZvazPicker({ zvazy, aktualne, hrefTemplate = '/zvaz/{id}' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const aktualny = zvazy.find((z) => z.id === aktualne);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filter = bezDiakritiky(q.trim());
  const match = (z: Zvaz) => !filter || bezDiakritiky(z.nazov).includes(filter);

  const strom = useMemo(() => {
    const sfz = zvazy.filter((z) => z.uroven === 'SFZ');
    const rfzy = zvazy.filter((z) => z.uroven === 'RFZ');
    const obfz = zvazy.filter((z) => z.uroven === 'ObFZ');
    const poradie = ['BFZ', 'ZsFZ', 'SsFZ', 'VsFZ'];
    return { sfz: sfz.filter(match), rfzy, obfz, poradie };
  }, [zvazy, filter]);

  function go(id: string) {
    window.location.href = hrefTemplate.replace('{id}', id);
  }

  function riadok(z: Zvaz, indent = false) {
    const akt = z.id === aktualne;
    return (
      <button
        key={z.id}
        type="button"
        onClick={() => go(z.id)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: indent ? '6px 10px 6px 24px' : '7px 10px',
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: akt ? 700 : 500,
          color: akt ? 'var(--color-sfz-blue)' : 'var(--color-ink)',
          background: akt ? '#eef3ff' : 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {z.nazov}
      </button>
    );
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid var(--color-line)',
          background: 'var(--color-card)',
          borderRadius: 18,
          padding: '7px 14px',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: 'pointer',
          color: 'var(--color-ink)',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {aktualny?.nazov ?? 'Vyber zväz'}
        <span style={{ color: 'var(--color-muted)' }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            width: 320,
            maxHeight: 440,
            overflowY: 'auto',
            background: 'var(--color-card)',
            border: '1px solid var(--color-line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
            padding: 8,
            zIndex: 60,
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hľadať zväz…"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-line)',
              fontSize: 13.5,
              marginBottom: 6,
              outline: 'none',
            }}
          />
          {strom.sfz.map((z) => riadok(z))}
          {strom.poradie.map((skr) => {
            const rfz = strom.rfzy.find((r) => r.rfz === skr || r.id === RFZ_ID_OF_SKRATKA[skr]);
            const deti = strom.obfz.filter((o) => o.rfz === skr).filter(match);
            const rfzMatch = rfz && match(rfz);
            if (!rfzMatch && deti.length === 0) return null;
            return (
              <div key={skr} style={{ marginTop: 4 }}>
                {rfz && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: REGION[RFZ_ID_OF_SKRATKA[skr]] ?? '#ccc', display: 'inline-block', marginLeft: 4 }} />
                    <div style={{ flex: 1 }}>{riadok(rfz)}</div>
                  </div>
                )}
                {deti.map((o) => riadok(o, true))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
