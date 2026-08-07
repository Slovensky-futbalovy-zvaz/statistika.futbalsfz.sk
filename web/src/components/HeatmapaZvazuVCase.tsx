import { useMemo, useState } from 'react';
import { rozbal, type UrovneVCase } from '../lib/urovneTypy';
import { fmt } from '../lib/format';
import { UROVEN_LABEL, UROVEN_LABEL_KRATKY } from '../lib/palette';

interface Props {
  /** Rez pre JEDEN zväz (getUrovneVCaseZvazu). */
  data: UrovneVCase;
}

type Gender = 'VSETCI' | 'M' | 'F';

/**
 * Matica sezóny × úrovne súťaže pre jeden zväz — kedy zväzu liga pribudla,
 * kedy zanikla a kde má dnes ťažisko.
 *
 * Nahradila skladaný plošný graf (rozhodnutie Ján Letko, 7. 8. 2026): plocha
 * dávala len tvar, matica dá presné číslo a je konzistentná s maticou
 * v Porovnaniach.
 *
 * Prebiehajúca sezóna (za poslednou kompletnou) je označená — čísla sa v nej
 * ešte len dopĺňajú, takže nižšia hodnota nie je pokles.
 */
export default function HeatmapaZvazuVCase({ data }: Props) {
  const [kat, setKat] = useState(0); // index do data.kategorie, -1 = všetky
  const [gender, setGender] = useState<Gender>('VSETCI');
  const gi = gender === 'VSETCI' ? -1 : gender === 'M' ? 0 : 1;

  const prebiehaOd = useMemo(() => {
    const i = data.sezony.indexOf(data.poslednaKompletna);
    return i < 0 ? data.sezony.length : i + 1;
  }, [data]);

  const { bunky, urovneIdx, max } = useMemo(() => {
    const m = new Map<string, number>();
    const pouzite = new Set<number>();
    for (const [, si, ui, ki, g, n] of rozbal(data.rows)) {
      if (kat >= 0 && ki !== kat) continue;
      if (gi >= 0 && g !== gi) continue;
      m.set(`${si}|${ui}`, (m.get(`${si}|${ui}`) ?? 0) + n);
      pouzite.add(ui);
    }
    return {
      bunky: m,
      urovneIdx: data.urovne.map((_, i) => i).filter((i) => pouzite.has(i)),
      max: Math.max(1, ...m.values()),
    };
  }, [data, kat, gi]);

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

  const bunka = (n: number): React.CSSProperties => {
    // Pri reze, kde je všade najviac jedna súťaž, by pomer n/max spravil všetky
    // bunky plne sýte — vtedy sa použije miernejšia pevná sýtosť.
    const t = max <= 1 ? 0.3 : n / max;
    return {
      background: n === 0 ? 'var(--color-track, #f4f6f8)' : `rgba(20, 80, 223, ${(0.12 + t * 0.8).toFixed(2)})`,
      color: n && t > 0.5 ? '#fff' : 'var(--color-ink)',
      textAlign: 'center',
      fontWeight: n ? 700 : 400,
      fontVariantNumeric: 'tabular-nums',
      padding: '5px 4px',
      borderRadius: 4,
      fontSize: 12,
    };
  };

  if (urovneIdx.length === 0) {
    return (
      <div>
        <Filtre
          data={data}
          kat={kat}
          setKat={setKat}
          gender={gender}
          setGender={setGender}
          pill={pill}
        />
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
          Pre tento rez nemá zväz v žiadnej sezóne súťaže.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Filtre data={data} kat={kat} setKat={setKat} gender={gender} setGender={setGender} pill={pill} />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              {/* prvý stĺpec si vezme zvyšnú šírku, aby sa bunky nerozahovali
                  cez pôl tabuľky, keď je v reze len jedna úroveň súťaže */}
              <th style={{ textAlign: 'left', color: 'var(--color-muted)', fontWeight: 600, padding: '0 6px 4px 0', width: '100%' }}>
                Sezóna
              </th>
              {urovneIdx.map((ui) => (
                <th
                  key={ui}
                  title={UROVEN_LABEL[data.urovne[ui]]}
                  style={{ color: 'var(--color-muted)', fontWeight: 600, padding: '0 2px 4px', whiteSpace: 'nowrap', width: 78 }}
                >
                  {UROVEN_LABEL_KRATKY[data.urovne[ui]] ?? data.urovne[ui]}
                </th>
              ))}
              <th style={{ color: 'var(--color-muted)', fontWeight: 600, padding: '0 0 4px 6px', textAlign: 'center' }}>
                Spolu
              </th>
            </tr>
          </thead>
          <tbody>
            {data.sezony.map((s, si) => {
              const spolu = urovneIdx.reduce((a, ui) => a + (bunky.get(`${si}|${ui}`) ?? 0), 0);
              const prebieha = si >= prebiehaOd;
              return (
                <tr key={s}>
                  <td style={{ padding: '0 6px 0 0', whiteSpace: 'nowrap', color: prebieha ? 'var(--color-muted)' : undefined }}>
                    {s}
                    {prebieha && <span title="prebiehajúca sezóna — čísla sa ešte dopĺňajú"> ⧗</span>}
                  </td>
                  {urovneIdx.map((ui) => {
                    const n = bunky.get(`${si}|${ui}`) ?? 0;
                    return (
                      <td
                        key={ui}
                        style={{ ...bunka(n), opacity: prebieha ? 0.55 : 1 }}
                        title={`${s} · ${UROVEN_LABEL[data.urovne[ui]]}: ${fmt(n)} súťaží`}
                      >
                        {n || ''}
                      </td>
                    );
                  })}
                  <td
                    style={{
                      padding: '0 0 0 6px',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      textAlign: 'center',
                      opacity: prebieha ? 0.55 : 1,
                    }}
                  >
                    {fmt(spolu)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)' }}>
        Riadok je sezóna, stĺpec úroveň súťaže, číslo počet súťaží. Prázdna bunka znamená, že zväz
        v tej sezóne na danej úrovni súťaž nemal — tak vidno, kedy liga pribudla alebo zanikla.
        Zosvetlené riadky sú prebiehajúce sezóny, v ktorých sa čísla ešte len dopĺňajú; posledná
        kompletná je {data.poslednaKompletna}. Poháre, turnaje a súťaže s neuvedenou úrovňou majú
        vlastný stĺpec — do ligovej pyramídy nepatria.
      </p>
    </div>
  );
}

/** Pill filtre kategórie a pohlavia (vlastné, lebo tento graf je samostatný island). */
function Filtre({
  data,
  kat,
  setKat,
  gender,
  setGender,
  pill,
}: {
  data: UrovneVCase;
  kat: number;
  setKat: (n: number) => void;
  gender: Gender;
  setGender: (g: Gender) => void;
  pill: (active: boolean) => React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12, fontSize: 12.5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--color-muted)' }}>Kategória:</span>
        {data.kategorie.slice(0, 4).map((k, i) => (
          <button key={k} type="button" style={pill(kat === i)} onClick={() => setKat(i)}>
            {k}
          </button>
        ))}
        <button type="button" style={pill(kat === -1)} onClick={() => setKat(-1)}>
          Všetky
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--color-muted)' }}>Pohlavie:</span>
        {(['VSETCI', 'M', 'F'] as Gender[]).map((g) => (
          <button key={g} type="button" style={pill(gender === g)} onClick={() => setGender(g)}>
            {g === 'VSETCI' ? 'Všetci' : g === 'M' ? 'Muži' : 'Ženy'}
          </button>
        ))}
      </div>
    </div>
  );
}
