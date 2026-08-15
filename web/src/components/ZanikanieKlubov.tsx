import { useMemo, useState } from 'react';
import { fmt, fmt1 } from '../lib/format';
import { useTooltip, TipNadpis, TipRiadok } from './Tooltip.tsx';

export interface ZanikZvaz {
  id: string;
  nazov: string;
  uroven?: string | null;
  odchody: number;
  klubosezony: number;
  miera: number | null;
  prichody: number;
  poObdobiach: Record<string, number>;
  klubovPrva: number;
  klubovPosledna: number;
  zmena: number;
  zmenaPct: number | null;
}

export interface ZanikObdobie {
  nazov: string;
  sezon: number;
  sezonPrichodov: number;
  odchody: number;
  prichody: number;
  odchodovNaSezonu: number | null;
  prichodovNaSezonu: number | null;
}

interface Props {
  /** Sezóny okna (bez nábehu ISSF a bez prebiehajúcej). */
  sezony: string[];
  /** Odchody a príchody po sezónach — [sezona, odchodov, prichodov]. */
  toky: [string, number, number][];
  zvazy: ZanikZvaz[];
  obdobia: ZanikObdobie[];
  /** Prvá a posledná sezóna, z ktorých sa počíta stĺpec Zmena. */
  oknoStavu: [string, string];
}

type Metrika = 'miera' | 'zmena';

/** „2016/2017“ → „16/17“ — na os sa celé sezóny nezmestia. */
const kratka = (s: string): string => `${s.slice(2, 4)}/${s.slice(7, 9)}`;

const ZANIK = '#ec1c24';
const VZNIK = '#12a06b';
const STRANA = 15;

/**
 * Zanikanie klubov — kde a kedy (zadanie Ján Letko, 15. 8. 2026).
 *
 * Dve veci, ktoré musia byť v jednom pohľade, lebo samostatne klamú:
 * 1. TOKY po sezónach — koľko klubov definitívne prestalo hrať a koľko začalo. Bez druhého
 *    stĺpca to vyzerá, že futbal sa rúca; v skutočnosti sa zlomil prítok nových klubov,
 *    tempo odchodov je celé obdobie takmer rovnaké.
 * 2. REBRÍČEK ZVÄZOV s dvoma metrikami. Miera odchodu je porovnateľná medzi veľkými
 *    a malými zväzmi, absolútny úbytok je zrozumiteľnejší — preto sú obe vedľa seba
 *    a používateľ prepína (rovnaký prístup ako pri metrike súťaže/skupiny).
 */
export default function ZanikanieKlubov({ sezony, toky, zvazy, obdobia, oknoStavu }: Props) {
  const [metrika, setMetrika] = useState<Metrika>('miera');
  const [strana, setStrana] = useState(0);
  const tip = useTooltip();

  const zoradene = useMemo(() => {
    const z = [...zvazy];
    if (metrika === 'miera') z.sort((a, b) => (b.miera ?? -1) - (a.miera ?? -1));
    else z.sort((a, b) => a.zmena - b.zmena);
    return z;
  }, [zvazy, metrika]);

  const strán = Math.max(1, Math.ceil(zoradene.length / STRANA));
  const s = Math.min(strana, strán - 1);
  const vidno = zoradene.slice(s * STRANA, (s + 1) * STRANA);
  const priemer = useMemo(() => {
    const o = zvazy.reduce((a, z) => a + z.odchody, 0);
    const k = zvazy.reduce((a, z) => a + z.klubosezony, 0);
    return k ? (100 * o) / k : 0;
  }, [zvazy]);

  // ---- graf tokov -------------------------------------------------------------------
  const W = 1000;
  const H = 340;
  const OS = 150;                       // y súradnica nulovej osi
  const max = Math.max(...toky.map((t) => Math.max(t[1], t[2])), 1);
  const krok = W / Math.max(toky.length, 1);
  const sirka = Math.min(krok * 0.44, 46);
  const skala = (v: number) => (v / max) * 120;

  const pill = (aktivne: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 16, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    border: '1px solid ' + (aktivne ? 'var(--color-sfz-blue)' : '#dcdfe4'),
    background: aktivne ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: aktivne ? '#fff' : 'var(--color-ink)',
  });
  const pillStrana: React.CSSProperties = {
    padding: '4px 12px', borderRadius: 16, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
    border: '1px solid #dcdfe4', background: 'var(--color-card)', color: 'var(--color-ink)',
  };

  if (!toky.length) {
    return <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Dáta o zanikaní klubov sa nepodarilo načítať.</p>;
  }

  return (
    <div onMouseLeave={tip.skry}>
      <tip.Tooltip />

      {/* ---- toky po sezónach ---- */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5,
                    fontWeight: 700, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: VZNIK }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: VZNIK }} /> nové kluby
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: ZANIK }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: ZANIK }} /> prestali hrať
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: 'block' }}
             role="img"
             aria-label="Kluby, ktoré definitívne prestali hrať, a nové kluby po sezónach">
          <line x1="0" y1={OS} x2={W} y2={OS} stroke="var(--color-line, #e2e8f0)" strokeWidth="2" />
          {toky.map(([sez, odch, pric], i) => {
            const x = i * krok + krok / 2 - sirka / 2;
            const hz = skala(odch);
            const hv = skala(pric);
            return (
              <g key={sez}>
                <rect
                  x={x} y={OS + 2} width={sirka} height={Math.max(hz, 2)} rx={4} fill={ZANIK}
                  aria-label={`${sez}: ${odch} klubov prestalo hrať`}
                  {...tip.viazat(
                    <>
                      <TipNadpis>{sez}</TipNadpis>
                      <TipRiadok popis="Prestalo hrať" hodnota={`${fmt(odch)} klubov`} />
                      <TipRiadok popis="Nových klubov" hodnota={fmt(pric)} />
                    </>,
                  )}
                />
                <rect
                  x={x} y={OS - 2 - Math.max(hv, 2)} width={sirka} height={Math.max(hv, 2)} rx={4} fill={VZNIK}
                  aria-label={`${sez}: ${pric} nových klubov`}
                  {...tip.viazat(
                    <>
                      <TipNadpis>{sez}</TipNadpis>
                      <TipRiadok popis="Nových klubov" hodnota={fmt(pric)} />
                      <TipRiadok popis="Prestalo hrať" hodnota={`${fmt(odch)} klubov`} />
                    </>,
                  )}
                />
                <text x={x + sirka / 2} y={OS - 10 - hv} textAnchor="middle"
                      fontSize="16" fontWeight="700" fill="var(--color-ink)">{pric}</text>
                <text x={x + sirka / 2} y={OS + 20 + hz} textAnchor="middle"
                      fontSize="16" fontWeight="700" fill="var(--color-ink)">{odch}</text>
                <text x={x + sirka / 2} y={H - 8} textAnchor="middle"
                      fontSize="13" fill="var(--color-muted)">{kratka(sez)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ---- obdobia ---- */}
      <div style={{ display: 'grid', gap: 10, marginTop: 14,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {obdobia.map((o) => (
          <div key={o.nazov} style={{ border: '1px solid var(--color-line, #e2e8f0)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)' }}>{o.nazov}</div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.7 }}>
              <span style={{ color: ZANIK, fontWeight: 800 }}>{fmt1(o.odchodovNaSezonu ?? 0)}</span>
              {' '}odchodov za sezónu<br />
              <span style={{ color: VZNIK, fontWeight: 800 }}>{fmt1(o.prichodovNaSezonu ?? 0)}</span>
              {' '}nových za sezónu
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.65 }}>
        <b>Kluby nezanikajú rýchlejšie — prestali vznikať.</b> Tempo odchodov je celé sledované
        obdobie takmer rovnaké. Čo sa zlomilo okolo covidu, je prítok nových klubov, a ten sa
        odvtedy nevrátil.
      </p>

      {/* ---- rebríček zväzov ---- */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '22px 0 10px' }}>
        <span style={{ fontSize: 12.5, color: 'var(--color-muted)', fontWeight: 600 }}>Zoradiť podľa:</span>
        <button type="button" style={pill(metrika === 'miera')}
                onClick={() => { setMetrika('miera'); setStrana(0); }}>Miery odchodu</button>
        <button type="button" style={pill(metrika === 'zmena')}
                onClick={() => { setMetrika('zmena'); setStrana(0); }}>Úbytku klubov</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 12 }}>
              <th style={{ padding: '6px 8px 6px 0', width: 40 }}>#</th>
              <th style={{ padding: '6px 8px 6px 0' }}>Zväz</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}
                  {...tip.viazat('Koľko percent klubo-sezón sa skončilo tým, že klub už nikdy nenastúpil. Číslo je porovnateľné medzi veľkými a malými zväzmi.')}>
                Miera odchodu
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}
                  {...tip.viazat(`Počet klubov, ktoré hrali v súťažiach zväzu, v sezónach ${oknoStavu[0]} a ${oknoStavu[1]}. Klub hrajúci v súťažiach viacerých zväzov je započítaný v každom z nich.`)}>
                Klubov {kratka(oknoStavu[0])} → {kratka(oknoStavu[1])}
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Zmena</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}
                  {...tip.viazat('Kluby, ktoré sa vo zväze objavili prvýkrát. Nový subjekt v ISSF ale nemusí byť nový klub — pri novej registrácii vznikne nové IČO bez väzby na predchodcu.')}>
                Nových
              </th>
            </tr>
          </thead>
          <tbody>
            {vidno.map((z, i) => (
              <tr key={z.id} style={{ borderTop: '1px solid var(--color-line, #eef0f3)' }}>
                <td style={{ padding: '7px 8px 7px 0', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {s * STRANA + i + 1}
                </td>
                <td style={{ padding: '7px 8px 7px 0' }}>
                  <a href={`/zvaz/${z.id}`} style={{ color: 'var(--color-sfz-blue)' }}>{z.nazov}</a>
                </td>
                <td
                  style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                           fontWeight: (z.miera ?? 0) > priemer * 1.5 ? 800 : 500,
                           color: (z.miera ?? 0) > priemer * 1.5 ? ZANIK : 'var(--color-ink)' }}
                  {...tip.viazat(
                    <>
                      <TipNadpis>{z.nazov}</TipNadpis>
                      <TipRiadok popis="Definitívnych odchodov" hodnota={fmt(z.odchody)} />
                      <TipRiadok popis="Klubo-sezón" hodnota={fmt(z.klubosezony)} />
                      {Object.entries(z.poObdobiach).map(([o, n]) => (
                        <TipRiadok key={o} popis={o} hodnota={fmt(n)} />
                      ))}
                    </>,
                  )}
                >
                  {z.miera === null ? '—' : `${fmt1(z.miera)} %`}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(z.klubovPrva)} → <b>{fmt(z.klubovPosledna)}</b>
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                             fontWeight: 700, color: z.zmena < 0 ? ZANIK : z.zmena > 0 ? VZNIK : 'var(--color-muted)' }}>
                  {z.zmena > 0 ? '+' : ''}{z.zmena}
                  {z.zmenaPct !== null && (
                    <span style={{ color: 'var(--color-muted)', fontWeight: 500 }}> ({fmt1(z.zmenaPct)} %)</span>
                  )}
                </td>
                <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                             color: 'var(--color-muted)' }}>
                  {fmt(z.prichody)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {strán > 1 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, fontSize: 12.5 }}>
          <button type="button" style={pillStrana} disabled={s === 0} onClick={() => setStrana(s - 1)}>← Späť</button>
          <span style={{ color: 'var(--color-muted)' }}>strana {s + 1} z {strán}</span>
          <button type="button" style={pillStrana} disabled={s >= strán - 1} onClick={() => setStrana(s + 1)}>Ďalej →</button>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        <b>Zánik</b> je to, keď klub odohral svoju poslednú sezónu a odvtedy nenastúpil už nikdy —
        nie jednosezónna pauza a <b>nie koniec v súťažiach dospelých</b>, pokiaľ klub má mládež.
        Priemer za celé Slovensko je {fmt1(priemer)} % za sezónu. Odchod sa pripisuje
        <b> domovskému zväzu</b> klubu (tomu, v ktorom odohral najviac zápasov), lebo klub zaniká
        raz; stĺpec <b>Klubov</b> naproti tomu počíta klub v každom zväze, v ktorého súťaži hral —
        je to to isté číslo, aké má zväz na svojom profile. Sezóny nábehu ISSF (2012/2013
        a 2013/2014) ani prebiehajúca sezóna do analýzy nevstupujú a posledné dve hodnotené
        sezóny sú provizórne — klub sa ešte môže vrátiť.
      </p>
    </div>
  );
}
