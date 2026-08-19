import { useMemo, useState } from 'react';
import { fmt, fmt1 } from '../lib/format';
import { useTooltip, TipNadpis, TipRiadok } from './Tooltip.tsx';

/** Zväz v heatmape — počty odstúpených klubov po sezónach v poradí `sezony`. */
export interface OdstupenyZvaz {
  id: string;
  nazov: string;
  uroven?: string | null;
  spolu: number;
  poSezonach: number[];
}

/** Klub v menoslove. Kľúče sú krátke, aby props islandu nenafúkli stránku. */
export interface OdstupenyKlub {
  /** názov */ n: string;
  /** slug na profil */ s: string;
  /** posledná odohraná sezóna */ sez: string;
  /** id zväzu */ z: string;
  /** najvyššia liga dospelých (null = v tej sezóne dospelých nemal) */ l: number | null;
  /** prípravka */ p: number;
  /** žiaci */ zi: number;
  /** dorast */ d: number;
  /** dospelí */ a: number;
  /** koľko sezón klub odohral */ h: number;
  /** vrátil sa po tichej sezóne */ v: boolean;
}

interface Props {
  /** Hodnotené sezóny, v ktorých sa dá odstúpenie zmerať. */
  sezony: string[];
  /** [sezóna, odstúpených, z nich sa vrátilo, z nich zaniklo]. */
  poSezonach: [string, number, number, number][];
  priemer: number;
  spolu: number;
  zvazy: OdstupenyZvaz[];
  kluby: OdstupenyKlub[];
}

const CERVENA = '#ec1c24';
const ZELENA = '#12a06b';
const ZVAZOV_NAJPRV = 20;
const KLUBOV_NA_STRANU = 15;

/** „2016/2017“ → „16/17“ — celé sezóny sa do hlavičky heatmapy nezmestia. */
const kratka = (s: string): string => `${s.slice(2, 4)}/${s.slice(7, 9)}`;

/** Štyri odtiene ako na infografike; 0 je prázdne políčko, nie nula. */
function odtien(v: number, max: number): { bg: string; fg: string } {
  if (!v) return { bg: 'var(--color-bg, #f7f9fc)', fg: 'var(--color-muted)' };
  const t = max > 1 ? (v - 1) / (max - 1) : 1;
  if (t < 0.25) return { bg: 'rgba(236,28,36,0.16)', fg: '#7f1d1d' };
  if (t < 0.5) return { bg: 'rgba(236,28,36,0.34)', fg: '#7f1d1d' };
  if (t < 0.75) return { bg: 'rgba(236,28,36,0.62)', fg: '#fff' };
  return { bg: 'rgba(236,28,36,0.92)', fg: '#fff' };
}

const STITOK: Record<string, { bg: string; fg: string }> = {
  sfz: { bg: '#e8effd', fg: '#1450df' },
  rfz: { bg: '#e7f6ef', fg: '#0a7d63' },
  obfz: { bg: '#fef3e2', fg: '#b45309' },
};

/**
 * Odstúpenia klubov — kto v ktorej sezóne nemal v súťažiach ani jedno družstvo.
 *
 * POJEM (Ján Letko, 16. 8. 2026): ODSTÚPENÝ KLUB = klub, ktorý prvú sezónu nemá v súťažiach
 * žiadne družstvo, pričom v predchádzajúcej mal aspoň jedno. NIE JE to zaniknutý klub — zánik
 * je až po dvoch tichých sezónach a po jednej vynechanej sa vracia každý piaty klub.
 *
 * Zväz je ten, v ktorého súťažiach klub odohral najviac zápasov v poslednej sezóne. Prebiehajúca
 * sezóna sa nehodnotí (rozbeh súťaží je v poznámke nad sekciou Zanikanie klubov).
 */
export default function OdstupeneKluby({ sezony, poSezonach, priemer, spolu, zvazy, kluby }: Props) {
  const [vsetkyZvazy, setVsetkyZvazy] = useState(false);
  const [fSezona, setFSezona] = useState('');
  const [fZvaz, setFZvaz] = useState('');
  const [lenMladez, setLenMladez] = useState(false);
  const [lenDospeli, setLenDospeli] = useState(false);
  const [skryVratenych, setSkryVratenych] = useState(false);
  const [strana, setStrana] = useState(0);
  const tip = useTooltip();

  const zvazMapa = useMemo(
    () => Object.fromEntries(zvazy.map((z) => [z.id, z])) as Record<string, OdstupenyZvaz>,
    [zvazy],
  );
  const maxVBunke = useMemo(
    () => Math.max(...zvazy.flatMap((z) => z.poSezonach), 1),
    [zvazy],
  );
  const poslednaSezona = poSezonach.length ? poSezonach[poSezonach.length - 1] : null;

  const vidnoZvazy = vsetkyZvazy ? zvazy : zvazy.slice(0, ZVAZOV_NAJPRV);

  const filtrovane = useMemo(() => {
    let k = kluby;
    if (fSezona) k = k.filter((x) => x.sez === predchadzajuca(fSezona, sezony));
    if (fZvaz) k = k.filter((x) => x.z === fZvaz);
    if (lenMladez) k = k.filter((x) => x.p + x.zi + x.d > 0);
    if (lenDospeli) k = k.filter((x) => x.a > 0);
    if (skryVratenych) k = k.filter((x) => !x.v);
    return k;
  }, [kluby, fSezona, fZvaz, lenMladez, lenDospeli, skryVratenych, sezony]);

  const stran = Math.max(1, Math.ceil(filtrovane.length / KLUBOV_NA_STRANU));
  const s = Math.min(strana, stran - 1);
  const vidnoKluby = filtrovane.slice(s * KLUBOV_NA_STRANU, (s + 1) * KLUBOV_NA_STRANU);

  const filter = (sezona: string, zvaz: string) => {
    setFSezona(sezona);
    setFZvaz(zvaz);
    setStrana(0);
  };
  const nulovat = () => {
    setFSezona('');
    setFZvaz('');
    setLenMladez(false);
    setLenDospeli(false);
    setSkryVratenych(false);
    setStrana(0);
  };
  const aktivnyFilter = !!(fSezona || fZvaz || lenMladez || lenDospeli || skryVratenych);

  // ---- graf po sezónach ------------------------------------------------------------
  const W = 1000;
  const H = 250;
  const OS = 195;
  const maxSez = Math.max(...poSezonach.map((t) => t[1]), 1);
  const krok = W / Math.max(poSezonach.length, 1);
  const sirka = Math.min(krok * 0.5, 52);
  const vyska = (v: number) => (v / maxSez) * 150;
  const yPriemer = OS - vyska(priemer);

  const pill = (aktivne: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 16, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    border: '1px solid ' + (aktivne ? 'var(--color-sfz-blue)' : '#dcdfe4'),
    background: aktivne ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: aktivne ? '#fff' : 'var(--color-ink)',
  });
  const vyber: React.CSSProperties = {
    padding: '5px 10px', borderRadius: 16, fontSize: 12.5, fontWeight: 600,
    border: '1px solid #dcdfe4', background: 'var(--color-card)', color: 'var(--color-ink)',
  };
  const bunka: React.CSSProperties = {
    padding: '5px 8px', fontSize: 12.5, borderBottom: '1px solid var(--color-line, #e2e8f0)',
    whiteSpace: 'nowrap',
  };
  const hlavicka: React.CSSProperties = {
    padding: '5px 8px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '.04em', color: 'var(--color-muted)', textAlign: 'left',
    borderBottom: '1px solid var(--color-line, #e2e8f0)', whiteSpace: 'nowrap',
  };

  if (!poSezonach.length) {
    return <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Dáta o odstúpených kluboch sa nepodarilo načítať.</p>;
  }

  return (
    <div onMouseLeave={tip.skry}>
      <tip.Tooltip />

      {/* ---- KPI ---- */}
      <div style={{ display: 'grid', gap: 10, marginBottom: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {[
          { p: 'Odstúpených klubov', v: fmt(spolu), d: `${sezony[1]} – ${sezony[sezony.length - 1]}`, c: 'var(--color-ink)' },
          { p: 'Priemer za sezónu', v: fmt1(priemer), d: `${poSezonach.length} sezón`, c: 'var(--color-ink)' },
          { p: 'Posledná sezóna', v: fmt(poslednaSezona ? poslednaSezona[1] : 0),
            d: `${poslednaSezona ? poslednaSezona[0] : ''} — najnižší počet`, c: ZELENA },
          { p: 'Zväzov, ktorých sa to dotklo', v: fmt(zvazy.length), d: 'z 43', c: 'var(--color-ink)' },
        ].map((k) => (
          <div key={k.p} style={{ border: '1px solid var(--color-line, #e2e8f0)', borderRadius: 12, padding: '11px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)' }}>{k.p}</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: k.c, fontVariantNumeric: 'tabular-nums' }}>{k.v}</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>{k.d}</div>
          </div>
        ))}
      </div>

      {/* ---- graf po sezónach ---- */}
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
        Odstúpené kluby po sezónach{' '}
        <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>
          — prerušovaná čiara je priemer {fmt1(priemer)}; klikni na stĺpec a dole sa vyfiltrujú kluby
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: 'block' }}
             role="img" aria-label="Odstúpené kluby po sezónach">
          <line x1="0" y1={OS} x2={W} y2={OS} stroke="var(--color-line, #e2e8f0)" strokeWidth="2" />
          <line x1="0" y1={yPriemer} x2={W} y2={yPriemer} stroke="var(--color-muted)" strokeWidth="1.5"
                strokeDasharray="7 6" />
          {poSezonach.map(([sez, poc, vrat, zan], i) => {
            const x = i * krok + krok / 2 - sirka / 2;
            const h = Math.max(vyska(poc), 2);
            const posledna = i === poSezonach.length - 1;
            const zvyraznene = fSezona === sez;
            return (
              <g key={sez} style={{ cursor: 'pointer' }} onClick={() => filter(zvyraznene ? '' : sez, fZvaz)}>
                <rect x={x} y={OS - h} width={sirka} height={h} rx={4}
                      fill={posledna ? ZELENA : CERVENA}
                      opacity={fSezona && !zvyraznene ? 0.45 : 1}
                      aria-label={`${sez}: odstúpilo ${poc} klubov`}
                      {...tip.viazat(
                        <>
                          <TipNadpis>{sez}</TipNadpis>
                          <TipRiadok popis="Odstúpených klubov" hodnota={fmt(poc)} />
                          <TipRiadok popis="Z nich sa vrátilo" hodnota={posledna ? 'zatiaľ 0' : fmt(vrat)} />
                          <TipRiadok popis="Z nich zaniklo" hodnota={posledna ? 'zatiaľ nevieme' : fmt(zan)} />
                        </>,
                      )} />
                <text x={x + sirka / 2} y={OS - h - 8} textAnchor="middle"
                      fontSize="16" fontWeight="700" fill="var(--color-ink)">{poc}</text>
                <text x={x + sirka / 2} y={H - 8} textAnchor="middle"
                      fontSize="13" fill="var(--color-muted)">{kratka(sez)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ---- heatmapa zväz × sezóna ---- */}
      <div style={{ fontSize: 12.5, fontWeight: 700, margin: '18px 0 4px' }}>
        Kde odstúpené kluby naposledy hrali{' '}
        <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>
          — klikni na políčko alebo na zväz a dole sa vyfiltrujú kluby
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '3px 3px', minWidth: 620 }}>
          <thead>
            <tr>
              <th style={{ ...hlavicka, borderBottom: 'none' }}>Zväz</th>
              {sezony.slice(1).map((sez) => (
                <th key={sez} style={{ ...hlavicka, borderBottom: 'none', textAlign: 'center', width: 44 }}>
                  {kratka(sez)}
                </th>
              ))}
              <th style={{ ...hlavicka, borderBottom: 'none', textAlign: 'center' }}>Σ</th>
            </tr>
          </thead>
          <tbody>
            {vidnoZvazy.map((z) => {
              const st = STITOK[z.uroven || 'obfz'] || STITOK.obfz;
              return (
                <tr key={z.id}>
                  <td style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', paddingRight: 10, cursor: 'pointer' }}
                      onClick={() => filter(fSezona, fZvaz === z.id ? '' : z.id)}>
                    <span style={{ color: fZvaz === z.id ? 'var(--color-sfz-blue)' : 'var(--color-ink)' }}>{z.nazov}</span>{' '}
                    <span style={{ background: st.bg, color: st.fg, borderRadius: 6, padding: '1px 6px',
                                   fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase' }}>
                      {z.uroven || 'obfz'}
                    </span>
                  </td>
                  {z.poSezonach.map((v, i) => {
                    const sez = sezony[i + 1];
                    const o = odtien(v, maxVBunke);
                    return (
                      <td key={sez} style={{ textAlign: 'center', width: 44, cursor: v ? 'pointer' : 'default' }}
                          onClick={() => v && filter(sez, z.id)}>
                        <span style={{ display: 'block', height: 28, lineHeight: '28px', borderRadius: 7,
                                       fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                                       background: o.bg, color: o.fg,
                                       outline: fSezona === sez && fZvaz === z.id ? '2px solid var(--color-sfz-blue)' : 'none' }}
                              {...(v ? tip.viazat(
                                <>
                                  <TipNadpis>{z.nazov}</TipNadpis>
                                  <TipRiadok popis={sez} hodnota={`${fmt(v)} odstúpených klubov`} />
                                  <TipRiadok popis="Za celé obdobie" hodnota={fmt(z.spolu)} />
                                </>,
                              ) : {})}>
                          {v || '·'}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {z.spolu}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        {zvazy.length > ZVAZOV_NAJPRV && (
          <button type="button" style={pill(false)} onClick={() => setVsetkyZvazy(!vsetkyZvazy)}>
            {vsetkyZvazy ? `Zobraziť len prvých ${ZVAZOV_NAJPRV}` : `Zobraziť všetkých ${zvazy.length} zväzov`}
          </button>
        )}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
                       color: 'var(--color-muted)', fontWeight: 700 }}>
          málo
          {[0.16, 0.34, 0.62, 0.92].map((a) => (
            <span key={a} style={{ width: 22, height: 12, borderRadius: 3, background: `rgba(236,28,36,${a})` }} />
          ))}
          veľa
        </span>
      </div>

      {/* ---- menoslov klubov ---- */}
      <div style={{ fontSize: 12.5, fontWeight: 700, margin: '20px 0 6px' }}>
        Konkrétne kluby{' '}
        <span style={{ color: 'var(--color-muted)', fontWeight: 600 }}>
          — družstvá sú z poslednej odohranej sezóny klubu
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <select style={vyber} value={fSezona} onChange={(e) => filter(e.target.value, fZvaz)}
                aria-label="Sezóna odstúpenia">
          <option value="">Všetky sezóny</option>
          {sezony.slice(1).map((sez) => <option key={sez} value={sez}>{sez}</option>)}
        </select>
        <select style={vyber} value={fZvaz} onChange={(e) => filter(fSezona, e.target.value)}
                aria-label="Zväz">
          <option value="">Všetky zväzy</option>
          {zvazy.map((z) => <option key={z.id} value={z.id}>{z.nazov}</option>)}
        </select>
        <button type="button" style={pill(lenMladez)} onClick={() => { setLenMladez(!lenMladez); setStrana(0); }}>
          Len s mládežou
        </button>
        <button type="button" style={pill(lenDospeli)} onClick={() => { setLenDospeli(!lenDospeli); setStrana(0); }}>
          Len s dospelými
        </button>
        <button type="button" style={pill(skryVratenych)} onClick={() => { setSkryVratenych(!skryVratenych); setStrana(0); }}>
          Skryť tých, čo sa vrátili
        </button>
        {aktivnyFilter && (
          <button type="button" style={pill(false)} onClick={nulovat}>Zrušiť filtre</button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 6 }}>
        {filtrovane.length === kluby.length
          ? `${fmt(kluby.length)} klubov`
          : `${fmt(filtrovane.length)} z ${fmt(kluby.length)} klubov`}
        {fSezona ? ` · odstúpili v sezóne ${fSezona}` : ''}
        {fZvaz ? ` · ${zvazMapa[fZvaz]?.nazov ?? fZvaz}` : ''}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={hlavicka}>Klub</th>
              <th style={hlavicka}>Naposledy hral</th>
              <th style={hlavicka}>Zväz</th>
              <th style={{ ...hlavicka, textAlign: 'center' }}>Liga</th>
              <th style={{ ...hlavicka, textAlign: 'center' }}>Družstvá</th>
              <th style={{ ...hlavicka, textAlign: 'center' }}>Sezón</th>
              <th style={{ ...hlavicka, textAlign: 'center' }}>Vrátil sa</th>
            </tr>
          </thead>
          <tbody>
            {vidnoKluby.map((k) => (
              <tr key={k.s + k.sez}>
                <td style={{ ...bunka, whiteSpace: 'normal', fontWeight: 600 }}>
                  <a href={`/klub/${k.s}`} style={{ color: 'var(--color-sfz-blue)', textDecoration: 'none' }}>{k.n}</a>
                </td>
                <td style={bunka}>{k.sez}</td>
                <td style={{ ...bunka, whiteSpace: 'normal' }}>{zvazMapa[k.z]?.nazov ?? k.z}</td>
                <td style={{ ...bunka, textAlign: 'center' }}>{k.l ? `L${k.l}` : '—'}</td>
                <td style={{ ...bunka, textAlign: 'center' }}>
                  {([['P', k.p, '#b45309', '#fef3e2'], ['Ž', k.zi, '#0a7d63', '#e7f6ef'],
                     ['D', k.d, '#1450df', '#e8effd'], ['A', k.a, '#7f1d1d', '#fdecec']] as const)
                    .filter(([, n]) => n > 0)
                    .map(([z, n, fg, bg]) => (
                      <span key={z} style={{ display: 'inline-block', marginRight: 4, borderRadius: 6,
                                             padding: '1px 6px', fontSize: 11.5, fontWeight: 800,
                                             background: bg, color: fg }}>
                        {z}{n > 1 ? ` ${n}` : ''}
                      </span>
                    ))}
                </td>
                <td style={{ ...bunka, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{k.h}</td>
                <td style={{ ...bunka, textAlign: 'center' }}>
                  {k.v ? <span style={{ color: ZELENA, fontWeight: 800 }}>áno</span>
                       : <span style={{ color: 'var(--color-muted)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {stran > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 12.5 }}>
          <button type="button" style={pill(false)} disabled={s === 0} onClick={() => setStrana(s - 1)}>
            Predchádzajúce
          </button>
          <span style={{ color: 'var(--color-muted)', fontWeight: 700 }}>{s + 1} / {stran}</span>
          <button type="button" style={pill(false)} disabled={s >= stran - 1} onClick={() => setStrana(s + 1)}>
            Ďalšie
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Klub odstúpil v sezóne N, ale v menoslove je uvedená jeho POSLEDNÁ ODOHRANÁ sezóna, teda N−1.
 * Filter podľa sezóny odstúpenia preto porovnáva predchádzajúcu sezónu zo zoznamu.
 */
function predchadzajuca(sezona: string, sezony: string[]): string {
  const i = sezony.indexOf(sezona);
  return i > 0 ? sezony[i - 1] : sezona;
}
