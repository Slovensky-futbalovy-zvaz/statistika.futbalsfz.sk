import { useState } from 'react';
import type { UrovneVCase } from '../lib/urovne';
import HeatmapaUrovni from './HeatmapaUrovni.tsx';
import UrovenTrend from './UrovenTrend.tsx';

interface Props {
  data: UrovneVCase;
  /** Sezóna zobrazená v matici (RRRR/RRRR). */
  sezona: string;
  /** Predvolený výber zväzov pre graf vývoja. */
  defaultVyber?: string[];
}

type Gender = 'VSETCI' | 'M' | 'F';

/**
 * Sekcia „Počet súťaží podľa úrovne“ v Porovnaniach — matica zväzy × úrovne
 * a graf vývoja v čase.
 *
 * Filtre vekovej kategórie a pohlavia sú spoločné, aby oba grafy ukazovali ten
 * istý rez. Zároveň je to jediný React island, takže sa kompaktný rozpad
 * (`UrovneVCase`) serializuje do stránky len raz — pri 38 ObFZ × 15 sezónach
 * by dva islandy stránku zbytočne nafúkli.
 */
export default function UrovneSekcia({ data, sezona, defaultVyber }: Props) {
  const [kat, setKat] = useState(0); // index do data.kategorie, -1 = všetky
  const [gender, setGender] = useState<Gender>('VSETCI');
  const gi = gender === 'VSETCI' ? -1 : gender === 'M' ? 0 : 1;

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

  const KARTA: React.CSSProperties = {
    border: '1px solid var(--color-line, #e6e8ec)',
    background: 'var(--color-card)',
    borderRadius: 16,
    padding: 18,
    boxShadow: 'var(--shadow-card)',
    marginTop: 18,
  };
  const KICKER: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--color-sfz-blue)',
  };
  const H2: React.CSSProperties = { fontWeight: 800, fontSize: 20, margin: '2px 0 4px' };
  const POPIS: React.CSSProperties = { fontSize: 13.5, color: 'var(--color-muted)', margin: '0 0 12px', lineHeight: 1.55 };

  return (
    <div>
      <div style={KARTA}>
        <div style={KICKER}>Počet súťaží</div>
        <h2 style={H2}>Kto čo riadi — zväzy × úrovne súťaže</h2>
        <p style={POPIS}>
          Matica ukáže na jeden pohľad, na ktorých úrovniach má ktorý zväz súťaže a koľko ich je.
          Úroveň sa vzťahuje vždy ku konkrétnej vekovej úrovni, preto sa porovnáva v rámci jednej
          kategórie — filtre platia aj pre graf vývoja nižšie.
        </p>

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

        {kat === -1 && (
          <p
            style={{
              background: '#fff7e6',
              border: '1px solid #f5d9a3',
              borderRadius: 10,
              padding: '9px 12px',
              fontSize: 12,
              color: '#7a4d00',
              margin: '0 0 12px',
            }}
          >
            <strong>Pozor:</strong> pri voľbe „Všetky“ sa sčítavajú rôzne vekové kategórie — „1. liga“
            dospelých a „1. liga“ U13 sú rôzne súťaže. Na porovnávanie použi konkrétnu kategóriu.
          </p>
        )}

        <HeatmapaUrovni data={data} sezona={sezona} kat={kat} gender={gi} />
      </div>

      <div style={KARTA}>
        <div style={KICKER}>Vývoj v čase</div>
        <h2 style={H2}>Počet súťaží danej úrovne naprieč sezónami</h2>
        <p style={POPIS}>
          Zvoľ úroveň a pozri sa, ako sa počet súťaží vyvíjal v jednotlivých zväzoch. Veková
          kategória a pohlavie sa preberajú z filtrov vyššie ({kat === -1 ? 'všetky kategórie' : data.kategorie[kat]}
          {gender === 'VSETCI' ? '' : gender === 'M' ? ' · muži' : ' · ženy'}).
        </p>
        <UrovenTrend data={data} defaultVyber={defaultVyber} kat={kat} gender={gi} />
      </div>
    </div>
  );
}
