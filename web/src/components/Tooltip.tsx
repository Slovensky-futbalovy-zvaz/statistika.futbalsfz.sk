import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Jednotný kontextový popisok pre všetky ručne kreslené grafy portálu.
 *
 * PREČO EXISTUJE (rozhodnutie Ján Letko, 8. 8. 2026): portál mal tri rôzne
 * správania. Grafy postavené na ECharts (trendy, sunbursty, radar, demografia)
 * mali pekný tmavý popisok idúci za kurzorom, mapy mali vlastný takmer zhodný,
 * a ručne kreslené SVG grafy (pyramída líg, heatmapy, vekové grafy, rebríčky)
 * mali len natívny `<title>` — ten čaká asi sekundu, nedá sa naštýlovať
 * a na dotykových zariadeniach sa nezobrazí VÔBEC, takže mobilní návštevníci
 * o detailné čísla úplne prichádzali.
 *
 * Tento modul je jediné miesto pravdy pre vzhľad aj správanie popisku. Vzhľad
 * je odvodený z popisku máp (tmavé pozadie `--color-ink`, biely text), aby
 * zostal zhodný s ECharts a nebolo treba prekresľovať osem existujúcich grafov.
 *
 * PRÍSTUPNOSŤ: popisok je len vizuálna pomôcka (`aria-hidden`). Prvok, ktorý ho
 * spúšťa, musí mať vlastný `aria-label` — čítačka obrazovky číta ten, nie toto.
 *
 * Použitie:
 *
 *     const tip = useTooltip();
 *     …
 *     <rect {...tip.viazat(`${nazov}: ${fmt(hodnota)}`)} aria-label={`${nazov}: ${hodnota}`} />
 *     …
 *     <tip.Tooltip />
 */

/**
 * `useLayoutEffect` na serveri nič nerobí a React naňho pri každom renderi vypíše varovanie.
 * Astro islands sa serverovo renderujú, takže bez tejto zámeny by build 24 000 stránok
 * zaplavil log. V prehliadači potrebujeme layout efekt — pozícia sa musí dopočítať ešte
 * pred vykreslením, inak popisok blikne na zlom mieste.
 */
const useLayoutEffectSafe = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Odsadenie popisku od kurzora, aby ho ukazovateľ neprekrýval. */
const ODSADENIE = 14;
/** Rezerva od okraja okna pri preklápaní popisku. */
const OKRAJ = 8;

interface Pozicia {
  obsah: React.ReactNode;
  x: number;
  y: number;
}

export interface TooltipApi {
  /** Rozprestrie handlery na prvok grafu (myš aj dotyk). */
  viazat: (obsah: React.ReactNode) => {
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  /** Skryje popisok (napr. pri odchode z celého grafu). */
  skry: () => void;
  /** Vykresľuje sa raz na konci komponentu. */
  Tooltip: () => React.ReactElement | null;
}

export function useTooltip(): TooltipApi {
  const [poz, setPoz] = useState<Pozicia | null>(null);
  const el = useRef<HTMLDivElement | null>(null);

  const skry = useCallback(() => setPoz(null), []);

  // Dotyk: ťuknutie mimo grafu popisok zavrie. Handler na prvku volá
  // stopPropagation, takže sem prebublá len ťuknutie inam.
  useEffect(() => {
    if (!poz) return;
    const zavri = () => setPoz(null);
    document.addEventListener('touchstart', zavri);
    document.addEventListener('scroll', zavri, true);
    return () => {
      document.removeEventListener('touchstart', zavri);
      document.removeEventListener('scroll', zavri, true);
    };
  }, [poz]);

  // Preklopenie k okraju okna — bez toho by pri pravom okraji vytŕčal von
  // a na úzkych displejoch by rozšíril stránku o vodorovné posúvanie.
  useLayoutEffectSafe(() => {
    const d = el.current;
    if (!d || !poz) return;
    const r = d.getBoundingClientRect();
    let x = poz.x + ODSADENIE;
    let y = poz.y + ODSADENIE;
    if (x + r.width > window.innerWidth - OKRAJ) x = poz.x - r.width - ODSADENIE;
    if (y + r.height > window.innerHeight - OKRAJ) y = poz.y - r.height - ODSADENIE;
    d.style.left = `${Math.max(OKRAJ, x)}px`;
    d.style.top = `${Math.max(OKRAJ, y)}px`;
  }, [poz]);

  const viazat = useCallback(
    (obsah: React.ReactNode) => ({
      onMouseEnter: (e: React.MouseEvent) => setPoz({ obsah, x: e.clientX, y: e.clientY }),
      onMouseMove: (e: React.MouseEvent) => setPoz({ obsah, x: e.clientX, y: e.clientY }),
      onMouseLeave: () => setPoz(null),
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        e.stopPropagation(); // ťuknutie na prvok nesmie zavrieť vlastný popisok
        setPoz({ obsah, x: t.clientX, y: t.clientY });
      },
    }),
    [],
  );

  const Tooltip = useCallback(() => {
    if (!poz) return null;
    return (
      <div
        ref={el}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: poz.x + ODSADENIE,
          top: poz.y + ODSADENIE,
          background: 'var(--color-ink)',
          color: '#fff',
          padding: '7px 11px',
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.45,
          boxShadow: '0 6px 20px rgba(0,0,0,.22)',
          pointerEvents: 'none',
          zIndex: 70,
          maxWidth: 280,
        }}
      >
        {poz.obsah}
      </div>
    );
  }, [poz]);

  return { viazat, skry, Tooltip };
}

/**
 * Riadok popisku: názov vľavo, zvýraznená hodnota vpravo.
 * Drží rovnaký tvar obsahu naprieč grafmi.
 */
export function TipRiadok({ popis, hodnota }: { popis: string; hodnota: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', whiteSpace: 'nowrap' }}>
      <span style={{ opacity: 0.8 }}>{popis}</span>
      <b className="tnum">{hodnota}</b>
    </div>
  );
}

/** Nadpis popisku (názov zväzu, klubu, úrovne…). */
export function TipNadpis({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 700, marginBottom: 3 }}>{children}</div>;
}
