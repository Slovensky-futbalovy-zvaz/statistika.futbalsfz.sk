import { useEffect, useRef, useState } from 'react';

interface Polozka {
  href: string;
  label: string;
  aktivna: boolean;
}
interface Props {
  polozky: Polozka[];
}

/** Mobilný hamburger (< 760px). Panel s navigáciou; klik mimo/overlay zatvára. */
export default function MobileMenu({ polozky }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          border: '1px solid var(--color-line)',
          background: 'var(--color-card)',
          borderRadius: 10,
          width: 40,
          height: 40,
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          color: 'var(--color-ink)',
        }}
      >
        ☰
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 240,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--color-card)',
            border: '1px solid var(--color-line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
            padding: 8,
            zIndex: 60,
          }}
        >
          {polozky.map((p) => (
            <a
              key={p.href}
              href={p.href}
              style={{
                display: 'block',
                padding: '10px 12px',
                borderRadius: 9,
                fontSize: 15,
                fontWeight: 700,
                color: p.aktivna ? '#fff' : 'var(--color-ink)',
                background: p.aktivna ? 'var(--color-sfz-blue)' : 'transparent',
              }}
            >
              {p.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
