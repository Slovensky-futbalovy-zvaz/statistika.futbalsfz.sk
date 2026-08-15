import { useMemo, useState } from 'react';
import { fmt, fmt1 } from '../lib/format';
import { useTooltip, TipNadpis, TipRiadok } from './Tooltip.tsx';

export interface ZanikZvaz {
  id: string;
  nazov: string;
  uroven?: string | null;
  zanikov: number;
  podielSR: number | null;
  klubosezony: number;
  miera: number | null;
  prichody: number;
  poObdobiach: Record<string, number>;
}

export interface ZanikObdobie {
  nazov: string;
  sezon: number;
  sezonPrichodov: number;
  zanikov: number;
  prichody: number;
  zanikovNaSezonu: number | null;
  prichodovNaSezonu: number | null;
}

interface Props {
  /** Zaniknuté a nové kluby po sezónach — [sezona, zaniklo, vzniklo]. */
  toky: [string, number, number][];
  zvazy: ZanikZvaz[];
  obdobia: ZanikObdobie[];
  /** Prvá a posledná hodnotiteľná sezóna. */
  okno: [string, string];
  /** Zaniknutých spolu a z toho tí, čo sa po dvoch tichých sezónach vrátili. */
  spolu: number;
  obnovenych: number;
  /** Presuny medzi zväzmi — dôkaz, že postup ani zostup nie je zánik. */
  presuny: { zmien: number; dvojicSezon: number; podiel: number | null; klubovSoZmenou: number };
}

type Metrika = 'podiel' | 'miera';

/** „2016/2017“ → „16/17“ — na os sa celé sezóny nezmestia. */
const kratka = (s: string): string => `${s.slice(2, 4)}/${s.slice(7, 9)}`;

const ZANIK = '#ec1c24';
const VZNIK = '#12a06b';
const STRANA = 15;

/**
 * Zanikanie klubov — kde a kedy.
 *
 * ZÁVÄZNÁ DEFINÍCIA (Ján Letko, 15. 8. 2026): zaniknutý klub je klub, ktorý DVA ROKY PO SEBE
 * neprihlási do súťaže žiadne družstvo. Koniec v dospelých nie je zánik, pokiaľ klub má mládež,
 * a POSTUP ANI ZOSTUP NIE JE ZÁNIK — aktivita sa posudzuje celoslovensky, nie vo zväze.
 *
 * Rebríček zväzov sa vyhodnocuje V RÁMCI CELÉHO SLOVENSKA: hlavná metrika je podiel zväzu na
 * všetkých zaniknutých kluboch v SR. Miera vo zväze stojí vedľa nej, lebo veľký zväz má
 * prirodzene vyšší podiel a malý zväz zase rozkolísanú mieru.
 */
export default function ZanikanieKlubov({
  toky, zvazy, obdobia, okno, spolu, obnovenych, presuny,
}: Props) {
  const [metrika, setMetrika] = useState<Metrika>('podiel');
  const [strana, setStrana] = useState(0);
  const tip = useTooltip();

  const zoradene = useMemo(() => {
    const z = [...zvazy];
    if (metrika === 'miera') z.sort((a, b) => (b.miera ?? -1) - (a.miera ?? -1));
    else z.sort((a, b) => b.zanikov - a.zanikov);
    return z;
  }, [zvazy, metrika]);

  const strán = Math.max(1, Math.ceil(zoradene.length / STRANA));
  const s = Math.min(strana, strán - 1);
  const vidno = zoradene.slice(s * STRANA, (s + 1) * STRANA);
  const priemer = useMemo(() => {
    const o = zvazy.reduce((a, z) => a + z.zanikov, 0);
    const k = zvazy.reduce((a, z) => a + z.klubosezony, 0);
    return k ? (100 * o) / k : 0;
  }, [zvazy]);
  const maxPodiel = useMemo(() => Math.max(...zvazy.map((z) => z.podielSR ?? 0), 1), [zvazy]);
  const maxMiera = useMemo(() => Math.max(...zvazy.map((z) => z.miera ?? 0), 1), [zvazy]);

  // ---- graf tokov -------------------------------------------------------------------
  const W = 1000;
  const H = 340;
  const OS = 150;
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
          <span style={{ width: 12, height: 12, borderRadius: 3, background: ZANIK }} /> zaniknuté kluby
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 560, display: 'block' }}
             role="img" aria-label="Zaniknuté a nové kluby po sezónach">
          <line x1="0" y1={OS} x2={W} y2={OS} stroke="var(--color-line, #e2e8f0)" strokeWidth="2" />
          {toky.map(([sez, zan, pric], i) => {
            const x = i * krok + krok / 2 - sirka / 2;
            const hz = skala(zan);
            const hv = skala(pric);
            return (
              <g key={sez}>
                <rect
                  x={x} y={OS + 2} width={sirka} height={Math.max(hz, 2)} rx={4} fill={ZANIK}
                  aria-label={`${sez}: zaniklo ${zan} klubov`}
                  {...tip.viazat(
                    <>
                      <TipNadpis>{sez}</TipNadpis>
                      <TipRiadok popis="Zaniklo" hodnota={`${fmt(zan)} klubov`} />
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
                      <TipRiadok popis="Zaniklo" hodnota={`${fmt(zan)} klubov`} />
                    </>,
                  )}
                />
                <text x={x + sirka / 2} y={OS - 10 - hv} textAnchor="middle"
                      fontSize="16" fontWeight="700" fill="var(--color-ink)">{pric}</text>
                <text x={x + sirka / 2} y={OS + 20 + hz} textAnchor="middle"
                      fontSize="16" fontWeight="700" fill="var(--color-ink)">{zan}</text>
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
              <span style={{ color: ZANIK, fontWeight: 800 }}>{fmt1(o.zanikovNaSezonu ?? 0)}</span>
              {' '}zaniknutých za sezónu<br />
              <span style={{ color: VZNIK, fontWeight: 800 }}>{fmt1(o.prichodovNaSezonu ?? 0)}</span>
              {' '}nových za sezónu
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.65 }}>
        <b>Kluby nezanikajú rýchlejšie — prestali vznikať.</b> Tempo zanikania celé sledované
        obdobie mierne klesá. Čo sa zlomilo okolo covidu, je prítok nových klubov, a ten sa
        odvtedy nevrátil.
      </p>

      {/* ---- rebríček zväzov ---- */}
      <p style={{ marginTop: 22, fontSize: 12.5, lineHeight: 1.65 }}>
        Rebríček sa vyhodnocuje <b>v rámci celého Slovenska</b>. <b>Podiel</b> hovorí, aká časť
        všetkých {fmt(spolu)} zaniknutých klubov pripadá na tento zväz — veľký zväz má prirodzene
        väčší podiel. <b>Miera</b> je podiel z klubo-sezón zväzu, takže sa dá porovnať veľký
        s malým, ale pri malom zväze ňou hýbe aj jeden klub. Priemer za celé Slovensko je
        {' '}{fmt1(priemer)} % za sezónu.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '14px 0 10px' }}>
        <span style={{ fontSize: 12.5, color: 'var(--color-muted)', fontWeight: 600 }}>Zoradiť podľa:</span>
        <button type="button" style={pill(metrika === 'podiel')}
                onClick={() => { setMetrika('podiel'); setStrana(0); }}>Podielu na zánikoch v SR</button>
        <button type="button" style={pill(metrika === 'miera')}
                onClick={() => { setMetrika('miera'); setStrana(0); }}>Miery vo zväze</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 12 }}>
              <th style={{ padding: '6px 8px 6px 0', width: 40 }}>#</th>
              <th style={{ padding: '6px 8px 6px 0' }}>Zväz</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}
                  {...tip.viazat(`Aká časť všetkých ${fmt(spolu)} klubov, ktoré na Slovensku zanikli v období ${okno[0]} – ${okno[1]}, pripadá na tento zväz.`)}>
                Podiel na zánikoch v SR
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}>Zaniknutých</th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}
                  {...tip.viazat('Koľko percent klubo-sezón zväzu sa skončilo zánikom klubu. Porovnateľné medzi veľkým a malým zväzom, ale pri malom zväze ňou hýbe aj jeden klub.')}>
                Miera vo zväze
              </th>
              <th style={{ padding: '6px 8px', textAlign: 'center' }}
                  {...tip.viazat('Kluby, ktoré sa vo zväze objavili prvýkrát. Nový subjekt v ISSF ale nemusí byť nový klub — pri novej registrácii vznikne nové IČO bez väzby na predchodcu.')}>
                Nových
              </th>
            </tr>
          </thead>
          <tbody>
            {vidno.map((z, i) => {
              const sirkaP = Math.round(70 * ((z.podielSR ?? 0) / maxPodiel));
              const sirkaM = Math.round(70 * ((z.miera ?? 0) / maxMiera));
              return (
                <tr key={z.id} style={{ borderTop: '1px solid var(--color-line, #eef0f3)' }}>
                  <td style={{ padding: '7px 8px 7px 0', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {s * STRANA + i + 1}
                  </td>
                  <td style={{ padding: '7px 8px 7px 0' }}>
                    <a href={`/zvaz/${z.id}`} style={{ color: 'var(--color-sfz-blue)' }}>{z.nazov}</a>
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 70, height: 8, borderRadius: 4, background: 'var(--color-line, #eef0f3)' }}>
                        <span style={{ display: 'block', width: sirkaP, height: 8, borderRadius: 4,
                                       background: metrika === 'miera' ? '#cbd5e1' : ZANIK }} />
                      </span>
                      <b>{z.podielSR === null ? '—' : `${fmt1(z.podielSR)} %`}</b>
                    </span>
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
                      {...tip.viazat(
                        <>
                          <TipNadpis>{z.nazov}</TipNadpis>
                          {Object.entries(z.poObdobiach).map(([o, n]) => (
                            <TipRiadok key={o} popis={o} hodnota={fmt(n)} />
                          ))}
                          <TipRiadok popis="Klubo-sezón" hodnota={fmt(z.klubosezony)} />
                        </>,
                      )}>
                    {fmt(z.zanikov)}
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 70, height: 8, borderRadius: 4, background: 'var(--color-line, #eef0f3)' }}>
                        <span style={{ display: 'block', width: sirkaM, height: 8, borderRadius: 4,
                                       background: metrika === 'miera' ? ZANIK : '#cbd5e1' }} />
                      </span>
                      <b style={{ color: (z.miera ?? 0) > priemer * 1.5 ? ZANIK : 'var(--color-ink)' }}>
                        {z.miera === null ? '—' : `${fmt1(z.miera)} %`}
                      </b>
                    </span>
                  </td>
                  <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                               color: 'var(--color-muted)' }}>
                    {fmt(z.prichody)}
                  </td>
                </tr>
              );
            })}
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

      <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        <b>Za zaniknutý klub sa považuje klub, ktorý dva roky po sebe neprihlási do súťaže žiadne
        družstvo.</b> Jedna vynechaná sezóna teda zánik nie je — po nej sa ešte vracia každý piaty
        klub, po dvoch už len necelá desatina. <b>Koniec v súťažiach dospelých</b> zánik nie je,
        pokiaľ klub má mládež. <b>Postup do vyššej ani zostup do nižšej súťaže</b> zánik nie je už
        vôbec — aktivita klubu sa posudzuje na celom Slovensku, nie vo zväze; klub, ktorý postúpi
        z oblastnej súťaže do regionálnej, prestane hrať súťaže svojho ObFZ, ale hrá ďalej.
        Domovský zväz sa takto zmenil pri {fmt1(presuny.podiel ?? 0)} % dvojíc po sebe idúcich
        sezón a týka sa to {fmt(presuny.klubovSoZmenou)} klubov. A <b>poháre sa nerátajú vôbec</b> —
        do Slovnaft Cupu sa dostane len klub aktívny v súťažiach, takže pohárový zápas nie je
        dôkazom, že klub žije. Prihlásené družstvo sa v dátach meria reálne odohraným zápasom.
        {' '}<b>Medzi zánikmi sú aj zlúčenia:</b> zánik klubu ako subjektu nie je vždy koniec
        futbalu v obci — časť klubov sa spojila s iným a hráči aj mládež pokračujú tam. Doložené
        zlúčenia sa nepočítajú, ostatné od skutočného konca odlíšiť nevieme; najčastejšie sú pri
        ženských kluboch. Ženské kluby a akadémie preto vykazujeme oddelene a v rebríčku sa
        objavujú na úrovni SFZ správne — ich súťaže riadi SFZ. Zánik sa pripisuje domovskému
        zväzu klubu v jeho poslednej odohranej sezóne. Hodnotiteľné je obdobie {okno[0]} – {okno[1]}:
        sezóny nábehu ISSF (2012/2013 a 2013/2014), prebiehajúca sezóna ani posledné dve sezóny
        (ešte za nimi nie sú dva roky) doň nevstupujú. Zo {fmt(spolu)} zaniknutých klubov sa
        {' '}{fmt(obnovenych)} po dvoch tichých sezónach ešte vrátilo — podľa definície zostávajú
        zaniknuté.
      </p>
    </div>
  );
}
