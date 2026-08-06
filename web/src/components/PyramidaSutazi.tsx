import { useMemo, useState } from 'react';
import type { UrovenRiadok } from '../lib/data';
import { fmt } from '../lib/format';
import { GROUPS, UROVEN_LABEL, UROVEN_PORADIE } from '../lib/palette';

type Gender = 'VSETCI' | 'M' | 'F';

interface Props {
  /** Rozpad úroveň súťaže × veková úroveň × pohlavie (profil.sutazeUroven / sumar.sutazeUroven). */
  riadky: UrovenRiadok[];
  /** Voliteľné rozpady ďalších odvetví (napr. { futsal: [...] }) — zapne pill filter športu. */
  odvetvia?: Record<string, UrovenRiadok[]>;
  odvetvieLabel?: Record<string, string>;
}

/** Poradie vekových úrovní vo vnútri kategórie (od najstarších). */
const UROVNE_VEKU = [
  'ADULTS', 'U21', 'U20', 'U19', 'U18', 'U17', 'U16', 'U15', 'U14', 'U13',
  'U12', 'U11', 'U10', 'U09', 'U08', 'U07', 'U06',
];

const OSTATNE = 'Ostatné';
const OSTATNE_FARBA = '#5b6470';

/** Úrovne, ktoré nie sú súčasťou ligovej pyramídy (kreslia sa pod čiarou). */
const MIMO_PYRAMIDY = new Set(['POHARE', 'NEURCENE']);

// geometria SVG pyramídy (viewBox 0 0 320 …)
const W = 320;
const LAB = 76; // stĺpec s názvom ligy
const CX = LAB + (W - LAB) / 2;
const MAX_HALF = (W - LAB) / 2 - 10;
const H = 26; // výška stupňa
const GAP = 3;

interface Stupen {
  kod: string;
  label: string;
  sutaze: number;
}

/**
 * Počet súťaží podľa úrovne súťaže — samostatná pyramída pre každú vekovú
 * kategóriu (Dospelí, Dorast, Žiaci, Prípravky).
 *
 * Metodika: `competitions.level` sa vzťahuje vždy ku KONKRÉTNEJ VEKOVEJ ÚROVNI
 * (ADULTS, U19, U13…), nie ku kategórii — „1. liga“ dospelých, „1. liga“ U19
 * a „1. liga“ U13 sú tri rôzne súťaže v troch rôznych pyramídach. Kategórie sú
 * len medzisúčty pre prehľad, preto sa pyramídy nikdy nezlučujú do jednej
 * a v každej kategórii sa dá rozbaliť konkrétna veková úroveň.
 *
 * Zobrazenie: súvislá silueta (šírka stupňa = počet súťaží), rozhodnutie
 * Ján Letko, 6. 8. 2026 — ukazuje, kde je ťažisko súťaží danej kategórie.
 */
export default function PyramidaSutazi({ riadky, odvetvia, odvetvieLabel }: Props) {
  const [gender, setGender] = useState<Gender>('VSETCI');
  const sektory = Object.keys(odvetvia ?? {});
  const [aktivneSektory, setAktivneSektory] = useState<string[]>(['futbal', ...sektory]);
  /** Vybraná veková úroveň v rámci kategórie ('' = medzisúčet celej kategórie). */
  const [vybranaUroven, setVybranaUroven] = useState<Record<string, string>>({});

  const zdroj = useMemo(() => {
    const out: UrovenRiadok[] = [];
    if (aktivneSektory.includes('futbal')) out.push(...riadky);
    for (const s of sektory) {
      if (aktivneSektory.includes(s)) out.push(...(odvetvia?.[s] ?? []));
    }
    return gender === 'VSETCI' ? out : out.filter((r) => r.pohlavie === gender);
  }, [riadky, odvetvia, sektory.join('|'), aktivneSektory.join('|'), gender]);

  /** Panely = vekové kategórie prítomné v dátach; každý so svojimi vekovými úrovňami. */
  const panely = useMemo(() => {
    const kategoriaKat = (kat: string) => GROUPS.find((g) => g.cats.includes(kat))?.key ?? OSTATNE;
    const podlaKategorie = new Map<string, UrovenRiadok[]>();
    for (const r of zdroj) {
      const k = kategoriaKat(r.kat);
      if (!podlaKategorie.has(k)) podlaKategorie.set(k, []);
      podlaKategorie.get(k)!.push(r);
    }
    const poradie = [...GROUPS.map((g) => g.key), OSTATNE];
    return poradie
      .filter((k) => podlaKategorie.has(k))
      .map((k) => {
        const rs = podlaKategorie.get(k)!;
        const urovneVeku = UROVNE_VEKU.filter((u) => rs.some((r) => r.kat === u));
        const zvyskove = [...new Set(rs.map((r) => r.kat))].filter((u) => !UROVNE_VEKU.includes(u));
        return {
          kategoria: k,
          farba: GROUPS.find((g) => g.key === k)?.color ?? OSTATNE_FARBA,
          riadky: rs,
          urovneVeku: [...urovneVeku, ...zvyskove.sort()],
        };
      });
  }, [zdroj]);

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    borderRadius: 16,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? 'none' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  const miniPill = (active: boolean, farba: string): React.CSSProperties => ({
    padding: '2px 9px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '1px solid transparent' : '1px solid #dcdfe4',
    background: active ? farba : 'transparent',
    color: active ? '#fff' : 'var(--color-muted)',
  });

  /** Farba stupňa: základná farba kategórie, svetlejšia smerom nadol. */
  function farbaStupna(kod: string, poradie: number, pocet: number, zaklad: string): string {
    if (kod === 'POHARE') return '#7a44e0';
    if (kod === 'NEURCENE') return '#98a2b3';
    const alpha = pocet <= 1 ? 1 : 1 - (poradie / (pocet - 1)) * 0.5;
    return zaklad + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14, fontSize: 12.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--color-muted)' }}>Pohlavie:</span>
          {(['VSETCI', 'M', 'F'] as Gender[]).map((g) => (
            <button key={g} type="button" style={pill(gender === g)} onClick={() => setGender(g)}>
              {g === 'VSETCI' ? 'Všetci' : g === 'M' ? 'Muži' : 'Ženy'}
            </button>
          ))}
        </div>
        {sektory.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--color-muted)' }}>Šport:</span>
            {['futbal', ...sektory].map((s) => (
              <button
                key={s}
                type="button"
                style={pill(aktivneSektory.includes(s))}
                onClick={() =>
                  setAktivneSektory((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]))
                }
              >
                {odvetvieLabel?.[s] ?? s}
              </button>
            ))}
          </div>
        )}
      </div>

      {panely.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          Pre zvolenú kombináciu filtrov nie sú v tejto sezóne žiadne súťaže.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          }}
        >
          {panely.map((p) => {
            const vybrana = vybranaUroven[p.kategoria] ?? '';
            const filtrovane = vybrana ? p.riadky.filter((r) => r.kat === vybrana) : p.riadky;
            const acc = new Map<string, number>();
            for (const r of filtrovane) acc.set(r.uroven, (acc.get(r.uroven) ?? 0) + r.sutaze);
            const vsetky: Stupen[] = UROVEN_PORADIE.filter((u) => (acc.get(u) ?? 0) > 0).map((u) => ({
              kod: u,
              label: UROVEN_LABEL[u] ?? u,
              sutaze: acc.get(u) ?? 0,
            }));
            const ligove = vsetky.filter((t) => !MIMO_PYRAMIDY.has(t.kod));
            const mimo = vsetky.filter((t) => MIMO_PYRAMIDY.has(t.kod));
            const spolu = vsetky.reduce((s, t) => s + t.sutaze, 0);
            const maxN = Math.max(1, ...vsetky.map((t) => t.sutaze));
            const half = (n: number) => Math.max(5, (n / maxN) * MAX_HALF);
            const medzisucet = !vybrana && p.urovneVeku.length > 1;

            // rozloženie stupňov po zvislej osi
            let y = 6;
            const tvary: React.ReactNode[] = [];
            ligove.forEach((t, i) => {
              const h1 = half(t.sutaze);
              const h2 = i + 1 < ligove.length ? half(ligove[i + 1].sutaze) : h1 * 0.94;
              const body = [
                [CX - h1, y],
                [CX + h1, y],
                [CX + h2, y + H],
                [CX - h2, y + H],
              ]
                .map((q) => q.join(','))
                .join(' ');
              const siroky = Math.min(h1, h2) * 2 > 30;
              tvary.push(
                <g key={t.kod}>
                  <polygon points={body} fill={farbaStupna(t.kod, i, ligove.length, p.farba)}>
                    <title>{`${t.label}: ${fmt(t.sutaze)} súťaží`}</title>
                  </polygon>
                  <text x={LAB - 10} y={y + H / 2 + 4} textAnchor="end" fontSize={10.5} fontWeight={600} fill="var(--color-muted)">
                    {t.label}
                  </text>
                  <text
                    x={siroky ? CX : CX + Math.max(h1, h2) + 7}
                    y={y + H / 2 + 4}
                    textAnchor={siroky ? 'middle' : 'start'}
                    fontSize={10.5}
                    fontWeight={800}
                    fill={siroky ? '#fff' : 'var(--color-ink)'}
                  >
                    {fmt(t.sutaze)}
                  </text>
                </g>,
              );
              y += H + GAP;
            });

            if (mimo.length) {
              y += 5;
              const yCiara = y;
              tvary.push(
                <line
                  key="sep"
                  x1={LAB - 4}
                  y1={yCiara}
                  x2={W}
                  y2={yCiara}
                  stroke="var(--color-line, #e6e8ec)"
                  strokeDasharray="3 3"
                />,
              );
              y += 9;
              mimo.forEach((t) => {
                const h1 = half(t.sutaze);
                const vyska = H - 6;
                const siroky = h1 * 2 > 30;
                tvary.push(
                  <g key={t.kod}>
                    <rect x={CX - h1} y={y} width={h1 * 2} height={vyska} rx={4} fill={farbaStupna(t.kod, 0, 1, p.farba)}>
                      <title>{`${t.label}: ${fmt(t.sutaze)} súťaží`}</title>
                    </rect>
                    <text x={LAB - 10} y={y + vyska / 2 + 4} textAnchor="end" fontSize={10.5} fontWeight={600} fill="var(--color-muted)">
                      {t.label}
                    </text>
                    <text
                      x={siroky ? CX : CX + h1 + 7}
                      y={y + vyska / 2 + 4}
                      textAnchor={siroky ? 'middle' : 'start'}
                      fontSize={10.5}
                      fontWeight={800}
                      fill={siroky ? '#fff' : 'var(--color-ink)'}
                    >
                      {fmt(t.sutaze)}
                    </text>
                  </g>,
                );
                y += vyska + GAP;
              });
            }

            return (
              <div
                key={p.kategoria}
                style={{
                  border: '1px solid var(--color-line, #e6e8ec)',
                  borderRadius: 12,
                  padding: '12px 14px 10px',
                  background: 'var(--color-card)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: p.farba, display: 'inline-block' }} />
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{p.kategoria}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{fmt(spolu)} súťaží</span>
                </div>

                {p.urovneVeku.length > 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0 4px' }}>
                    <button
                      type="button"
                      style={miniPill(!vybrana, p.farba)}
                      onClick={() => setVybranaUroven((v) => ({ ...v, [p.kategoria]: '' }))}
                    >
                      Spolu
                    </button>
                    {p.urovneVeku.map((u) => (
                      <button
                        key={u}
                        type="button"
                        style={miniPill(vybrana === u, p.farba)}
                        onClick={() => setVybranaUroven((v) => ({ ...v, [p.kategoria]: u }))}
                      >
                        {u === 'ADULTS' ? 'Dospelí' : u === 'NEZNAMA' ? 'Neznáma' : u}
                      </button>
                    ))}
                  </div>
                )}

                <svg
                  viewBox={`0 0 ${W} ${y + 6}`}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                  role="img"
                  aria-label={`Pyramída líg — ${p.kategoria}`}
                >
                  {tvary}
                </svg>

                {medzisucet && (
                  <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--color-muted)' }}>
                    Medzisúčet cez vekové úrovne {p.urovneVeku.join(', ')} — každá má vlastnú
                    pyramídu. Presné poradie líg zobrazíš výberom konkrétnej úrovne.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--color-muted)' }}>
        Šírka stupňa zodpovedá počtu súťaží, preto silueta ukazuje, kde je ťažisko súťaží danej
        kategórie. Úroveň súťaže (liga) sa vzťahuje vždy ku konkrétnej vekovej úrovni — „1. liga“
        dospelých, „1. liga“ U19 a „1. liga“ U13 sú tri rôzne súťaže v troch samostatných
        pyramídach, preto sa nikdy nesčítavajú do jedného stupňa. Vekové kategórie sú medzisúčty pre
        prehľad. Zdrojom je pole <code>level</code> z ISSF (nižšia úroveň = vyššia súťaž); hĺbka
        pyramídy sa medzi vekovými úrovňami aj regiónmi líši podľa toho, koľko stupňov sa v danej
        úrovni reálne hrá. Pod prerušovanou čiarou sú poháre, turnaje a súťaže s neuvedenou úrovňou
        — tie do ligovej pyramídy nepatria. Súťaž so zápasmi vo viacerých vekových úrovniach sa
        započíta v každej z nich.
      </p>
    </div>
  );
}
