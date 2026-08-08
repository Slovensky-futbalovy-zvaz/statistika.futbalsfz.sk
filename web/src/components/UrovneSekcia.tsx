import { useState } from 'react';
import { METRIKA_DEFAULT, METRIKA_POPIS, type MetrikaSutazi, type UrovneVCase } from '../lib/urovneTypy';
import HeatmapaUrovni from './HeatmapaUrovni.tsx';

interface Props {
  data: UrovneVCase;
  /** Sezóna zobrazená v matici (RRRR/RRRR). */
  sezona: string;
}

type Gender = 'VSETCI' | 'M' | 'F';

/**
 * Sekcia „Počet súťaží podľa úrovne“ v Porovnaniach — matica zväzy × úrovne
 * s filtrom vekovej kategórie a pohlavia.
 *
 * Pôvodne tu bol aj čiarový graf vývoja počtu súťaží zvolenej úrovne — zrušený
 * 7. 8. 2026 (rozhodnutie Ján Letko): pri RFZ aj ObFZ sa počty menia o jednotku
 * raz za niekoľko rokov, takže graf nepovedal nič, čo heatmapa neukáže lepšie.
 *
 * Typy a `rozbal()` sa importujú z `lib/urovneTypy` (nie z `lib/urovne`) —
 * `lib/urovne` číta JSON zo súborov a jeho import by do klientskeho bundlu
 * pribalil dátovú vrstvu, čo island zhodí na `process is not defined`.
 */
export default function UrovneSekcia({ data, sezona }: Props) {
  const [kat, setKat] = useState(0); // index do data.kategorie, -1 = všetky
  const [gender, setGender] = useState<Gender>('VSETCI');
  // Predvolené sú SKUPINY — to, v čom sa reálne hrá (rozhodnutie Ján Letko, 8. 8. 2026)
  const [metrika, setMetrika] = useState<MetrikaSutazi>(METRIKA_DEFAULT);
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
  const POPIS: React.CSSProperties = {
    fontSize: 13.5,
    color: 'var(--color-muted)',
    margin: '0 0 12px',
    lineHeight: 1.55,
  };

  return (
    <div style={KARTA}>
      <div style={KICKER}>Počet súťaží</div>
      <h2 style={H2}>Kto čo riadi — zväzy × úrovne súťaže</h2>
      <p style={POPIS}>
        Matica ukáže na jeden pohľad, na ktorých úrovniach má ktorý zväz súťaže a koľko ich je.
        Úroveň sa vzťahuje vždy ku konkrétnej vekovej úrovni, preto sa porovnáva v rámci jednej
        vekovej kategórie.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 12, fontSize: 12.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-muted)' }}>Počítať:</span>
          {(['skupiny', 'sutaze'] as MetrikaSutazi[]).map((m) => (
            <button
              key={m}
              type="button"
              style={pill(metrika === m)}
              title={METRIKA_POPIS[m].popis}
              onClick={() => setMetrika(m)}
            >
              {METRIKA_POPIS[m].label}
            </button>
          ))}
        </div>
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

      <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 10px', lineHeight: 1.55 }}>
        {METRIKA_POPIS[metrika].popis}
      </p>

      <HeatmapaUrovni data={data} sezona={sezona} kat={kat} gender={gi} metrika={metrika} />
    </div>
  );
}
