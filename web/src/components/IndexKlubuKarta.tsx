import { useState } from 'react';
import { ZLOZKY_POPIS, INDEX_LIMITY, type IndexSezona } from '../lib/trendyTypy';
import { fmt } from '../lib/format';

interface Props {
  /** Index po sezónach (z data/index-klubu/{klub}.json). */
  sezony: Record<string, IndexSezona>;
  /** Sezóna, ktorú stránka práve zobrazuje. */
  sezona: string;
  nazov: string;
}

const KLUCE = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Index klubu na profile klubu — číslo s rozpadom na päť zložiek a vysvetlivkami.
 *
 * Rozpad je povinný: bez neho je index čierna skrinka. Vysvetlivka pri každej
 * zložke aj text „čo index nemeria" sú súčasťou zobrazenia, nie odkazom v pätičke
 * (rozhodnutie Ján Letko, 7. 8. 2026).
 */
export default function IndexKlubuKarta({ sezony, sezona, nazov }: Props) {
  const [otvorena, setOtvorena] = useState<string | null>(null);
  const v = sezony[sezona];
  const vsetky = Object.keys(sezony).sort();

  if (!v) {
    return (
      <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>
        Pre sezónu {sezona} sa index nedá spočítať — klub v nej nemal započítané družstvo.
      </p>
    );
  }

  const bezMladeze = v.stav === 'bez-mladeze';
  const bezDospelych = v.stav === 'bez-dospelych';

  // vývoj indexu v čase — jednoduchý stĺpcový prehľad
  const maxIdx = Math.max(100, ...vsetky.map((s) => sezony[s].index));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 130 }}>
          {bezMladeze ? (
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-muted)', lineHeight: 1.1 }}>
              bez mládeže
            </div>
          ) : (
            <>
              <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {v.index}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>zo 100 bodov</div>
            </>
          )}
          {bezDospelych && (
            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', marginTop: 6, maxWidth: 150, lineHeight: 1.5 }}>
              Klub nemá družstvo dospelých — hodnotí sa zo štyroch zložiek prepočítaných na sto bodov.
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 320px', minWidth: 280 }}>
          {KLUCE.map((k) => {
            const popis = ZLOZKY_POPIS[k];
            const b = v.zlozky[k];
            const otvor = otvorena === k;
            return (
              <div key={k} style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setOtvorena(otvor ? null : k)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 12.5, minWidth: 150, color: 'var(--color-ink)' }}>
                    {popis.nazov}
                  </span>
                  <span style={{
                    flex: 1, height: 8, background: '#eef0f3', borderRadius: 4, overflow: 'hidden', minWidth: 60,
                  }}>
                    <span style={{
                      display: 'block',
                      width: b === null ? '0%' : `${(b / popis.max) * 100}%`,
                      height: '100%',
                      background: k === 'E' ? '#2fa36b' : 'var(--color-sfz-blue)',
                    }} />
                  </span>
                  <span style={{
                    fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 46, textAlign: 'right',
                    color: b === null ? 'var(--color-muted)' : 'var(--color-ink)', fontWeight: 700,
                  }}>
                    {b === null ? '—' : `${b}/${popis.max}`}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{otvor ? '▾' : '▸'}</span>
                </button>
                {otvor && (
                  <p style={{
                    fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6,
                    margin: '6px 0 0', paddingLeft: 2,
                  }}>
                    {popis.popis}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14, paddingTop: 12,
        borderTop: '1px solid var(--color-line, #eef0f3)', fontSize: 12.5, color: 'var(--color-muted)',
      }}>
        <span>Obsadené skupiny mládeže: <b style={{ color: 'var(--color-ink)' }}>{v.detaily.skupiny} z 3</b></span>
        <span>Detí v mládeži: <b style={{ color: 'var(--color-ink)' }}>{fmt(v.detaily.deti)}</b></span>
        <span>Družstiev mládeže: <b style={{ color: 'var(--color-ink)' }}>{v.detaily.druzstvaMladez}</b></span>
        <span>
          Mládež nepretržite:{' '}
          <b style={{ color: 'var(--color-ink)' }}>
            {v.detaily.sezonPoSebe} {v.detaily.sezonPoSebe === 1 ? 'sezónu' : v.detaily.sezonPoSebe < 5 ? 'sezóny' : 'sezón'}
          </b>
        </span>
        {v.detaily.podielMladych !== null && (
          <span>
            Hráčov do 21 rokov v dospelých:{' '}
            <b style={{ color: 'var(--color-ink)' }}>{Math.round(v.detaily.podielMladych * 100)} %</b>
          </span>
        )}
      </div>

      {vsetky.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 6 }}>Vývoj indexu v čase</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
            {vsetky.map((s) => {
              const iv = sezony[s];
              const akt = s === sezona;
              return (
                <div key={s} style={{ flex: 1, textAlign: 'center', minWidth: 0 }} title={`${s}: ${iv.index}`}>
                  <div
                    style={{
                      height: Math.max(2, (iv.index / maxIdx) * 56),
                      background: akt ? 'var(--color-sfz-blue)' : '#c7d4f2',
                      borderRadius: '3px 3px 0 0',
                    }}
                  />
                  <div style={{ fontSize: 9, color: 'var(--color-muted)', marginTop: 3, whiteSpace: 'nowrap' }}>
                    {s.slice(2, 4)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{
        background: '#fff7e6', border: '1px solid #f5d9a3', borderRadius: 10,
        padding: '9px 12px', fontSize: 11.5, color: '#7a4d00', margin: '14px 0 0', lineHeight: 1.6,
      }}>
        <strong>Čo index nemeria:</strong> {INDEX_LIMITY}
      </p>
    </div>
  );
}
