import { useEffect, useMemo, useRef, useState } from 'react';
import { bezDiakritiky } from '../lib/format';

interface KlubItem {
  id: string;
  nazov: string;
  zvazNazov: string;
  sezona: string; // posledná sezóna klubu ako slug "RRRR-RRRR" ('' ak nie je známa)
}

interface Props {
  aktualne?: string;
  aktualnyNazov?: string;
  zoznamUrl?: string; // statický JSON so zoznamom klubov (src/pages/data/kluby-zoznam.json.ts)
  hrefTemplate?: string; // default /klub/{id}
}

// Zoznam klubov sa sťahuje až pri prvom otvorení výberu (nie je vložený v HTML stránky)
// a zdieľa sa medzi všetkými inštanciami na stránke.
let zoznamPromise: Promise<KlubItem[]> | null = null;
function nacitajZoznam(url: string): Promise<KlubItem[]> {
  if (!zoznamPromise) {
    zoznamPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<[string, string, string, string][]>;
      })
      .then((rows) => rows.map(([id, nazov, zvazNazov, sezona]) => ({ id, nazov, zvazNazov, sezona })))
      .catch((e) => {
        zoznamPromise = null; // pri chybe skúsiť znova pri ďalšom otvorení
        throw e;
      });
  }
  return zoznamPromise;
}

/** Vyhľadávací výber klubu (kluby vnorené pod svojím zväzom). Search bez diakritiky. */
export default function KlubPicker({ aktualne, aktualnyNazov, zoznamUrl = '/data/kluby-zoznam.json', hrefTemplate = '/klub/{id}' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [kluby, setKluby] = useState<KlubItem[] | null>(null);
  const [chyba, setChyba] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open || kluby) return;
    setChyba(false);
    nacitajZoznam(zoznamUrl).then(setKluby, () => setChyba(true));
  }, [open, kluby, zoznamUrl]);

  const filter = bezDiakritiky(q.trim());
  const vysledky = useMemo(() => {
    if (!kluby || filter.length < 2) return [];
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

  function go(k: KlubItem) {
    window.location.href = k.sezona ? `/klub/${k.id}/${k.sezona}` : hrefTemplate.replace('{id}', k.id);
  }

  const info = (text: string) => <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--color-muted)' }}>{text}</div>;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={() => { nacitajZoznam(zoznamUrl).catch(() => {}); }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-line)', background: 'var(--color-card)', borderRadius: 18, padding: '7px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', color: 'var(--color-ink)', maxWidth: 320 }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aktualnyNazov ?? 'Vyber klub'}</span>
        <span style={{ color: 'var(--color-muted)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', width: 340, maxWidth: 'calc(100vw - 48px)', maxHeight: 460, overflowY: 'auto', background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 12, boxShadow: 'var(--shadow-pop)', padding: 8, zIndex: 60 }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hľadať klub…"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-line)', fontSize: 13.5, marginBottom: 6, outline: 'none' }}
          />
          {chyba && info('Zoznam klubov sa nepodarilo načítať. Zatvor a skús to znova.')}
          {!chyba && filter.length < 2 && info('Začni písať názov klubu (min. 2 znaky).')}
          {!chyba && filter.length >= 2 && !kluby && info('Načítavam zoznam klubov…')}
          {!chyba && kluby && filter.length >= 2 && vysledky.length === 0 && info('Žiadny klub nenájdený.')}
          {vysledky.map(([zvaz, list]) => (
            <div key={zvaz} style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--color-muted)', padding: '4px 10px' }}>{zvaz}</div>
              {list.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => go(k)}
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
