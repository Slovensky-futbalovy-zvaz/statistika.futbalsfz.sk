import { useEffect, useRef, useState } from 'react';

interface Props {
  sezony: string[]; // kanonické "RRRR/RRRR", vzostupne
  aktualna: string;
  /** Ak je zadaný, klik naviguje na template s {sezona} (slug RRRR-RRRR). Inak emituje event + query. */
  hrefTemplate?: string;
}

/** Custom dropdown výberu sezóny (nie natívny select). */
export default function SeasonPicker({ sezony, aktualna, hrefTemplate }: Props) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(aktualna);
  const ref = useRef<HTMLDivElement>(null);
  const zoradene = [...sezony].reverse(); // najnovšia hore

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function vyber(s: string) {
    setSel(s);
    setOpen(false);
    if (hrefTemplate) {
      window.location.href = hrefTemplate.replace('{sezona}', s.replace('/', '-'));
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('sezona', s.replace('/', '-'));
      history.replaceState(null, '', url);
      window.dispatchEvent(new CustomEvent('sezonaChange', { detail: s }));
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="tnum"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid var(--color-line)',
          background: 'var(--color-card)',
          borderRadius: 18,
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-ink)',
          cursor: 'pointer',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="hidden sm:inline"
          style={{ color: 'var(--color-muted)', fontSize: 10, letterSpacing: '.14em', fontWeight: 700 }}
        >
          SEZÓNA
        </span>
        {sel}
        <span style={{ color: 'var(--color-muted)' }}>▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: 'var(--color-card)',
            border: '1px solid var(--color-line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
            padding: 6,
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 60,
            minWidth: 160,
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          {zoradene.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => vyber(s)}
              className="tnum"
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: s === sel ? 700 : 500,
                background: s === sel ? '#eef3ff' : 'transparent',
                color: s === sel ? 'var(--color-sfz-blue)' : 'var(--color-ink)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
