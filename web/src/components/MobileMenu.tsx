import { useEffect, useRef, useState } from 'react';

interface Polozka {
  href: string;
  label: string;
  aktivna: boolean;
}
interface Props {
  polozky: Polozka[];
  /** Voliteľný výber sezóny priamo v hamburgeri (na mobile nahrádza samostatný SeasonPicker). */
  sezony?: string[];
  aktualna?: string;
  hrefTemplate?: string;
}

/** Mobilný hamburger (< 768px). Panel je position:fixed ukotvený k pravému okraju viewportu,
 *  takže sa nikdy neoreže bez ohľadu na polohu tlačidla. Obsahuje výber sezóny (ak je zadaný)
 *  a navigáciu. Klik mimo / na položku zatvára. */
export default function MobileMenu({ polozky, sezony, aktualna, hrefTemplate }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const maSezony = Array.isArray(sezony) && sezony.length > 0 && !!aktualna;
  const sezonyZoradene = maSezony ? [...(sezony as string[])].sort((a, b) => b.localeCompare(a)) : [];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function vyberSezonu(s: string) {
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
            position: 'fixed',
            top: 64,
            right: 12,
            width: 'min(300px, calc(100vw - 24px))',
            maxHeight: 'calc(100vh - 84px)',
            overflowY: 'auto',
            background: 'var(--color-card)',
            border: '1px solid var(--color-line)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-pop)',
            padding: 8,
            zIndex: 80,
          }}
        >
          {maSezony && (
            <>
              <div
                style={{
                  padding: '4px 12px 6px',
                  fontSize: 10,
                  letterSpacing: '.14em',
                  fontWeight: 700,
                  color: 'var(--color-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Sezóna
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 8px 8px' }}>
                {sezonyZoradene.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => vyberSezonu(s)}
                    className="tnum"
                    style={{
                      padding: '5px 10px',
                      borderRadius: 16,
                      fontSize: 12.5,
                      fontWeight: s === aktualna ? 700 : 500,
                      cursor: 'pointer',
                      border: '1px solid ' + (s === aktualna ? 'var(--color-sfz-blue)' : 'var(--color-line)'),
                      background: s === aktualna ? 'var(--color-sfz-blue)' : 'transparent',
                      color: s === aktualna ? '#fff' : 'var(--color-ink)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div style={{ height: 1, background: 'var(--color-line)', margin: '2px 8px 8px' }} />
            </>
          )}
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
