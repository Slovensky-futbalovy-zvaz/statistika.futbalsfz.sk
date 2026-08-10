import { useMemo, useState } from 'react';
import type { MapData, MapRegion } from '../lib/data';
import { fmt, choroColor } from '../lib/format';
import { METRICS } from '../lib/palette';
import { TipNadpis, TipRiadok, useTooltip } from './Tooltip.tsx';

interface Props {
  mapData: MapData;
}

type Level = 'SFZ' | 'RFZ' | 'ObFZ';

/** Choropleth mapa SR + rebríček. Prepínač úrovne (SFZ/RFZ/ObFZ) a metriky. */
export default function SlovakiaMap({ mapData }: Props) {
  const [level, setLevel] = useState<Level>('RFZ');
  const [metric, setMetric] = useState<string>('zapasy');
  // `aktivny` už neničí popisok — drží len červený obrys zvýrazneného regiónu.
  // Popisok rieši spoločný `useTooltip` (rovnaký ako v ostatných grafoch).
  const [aktivny, setAktivny] = useState<string | null>(null);
  const tip = useTooltip();

  const regions: MapRegion[] = level === 'RFZ' ? mapData.rfz : level === 'ObFZ' ? mapData.obfz : [];
  const values = regions.map((r) => r.values[metric] ?? 0).filter((v) => v > 0);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;

  const rebricek = useMemo(
    () =>
      [...regions]
        .filter((r) => (r.values[metric] ?? 0) > 0)
        .sort((a, b) => (b.values[metric] ?? 0) - (a.values[metric] ?? 0))
        .slice(0, 10),
    [regions, metric],
  );
  const rebricekMax = rebricek.length ? rebricek[0].values[metric] ?? 1 : 1;

  const sfzVal = mapData.sfz[metric] ?? 0;

  function goProfil(id?: string) {
    if (id) window.location.href = `/zvaz/${id}`;
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? 'none' : '1px solid #dcdfe4',
    background: active ? 'var(--color-sfz-blue)' : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-ink)',
  });

  const metricLabel = METRICS.find((m) => m.k === metric)?.label ?? '';
  const cardStyle: React.CSSProperties = {
    background: 'var(--color-card)',
    border: '1px solid var(--color-line)',
    borderRadius: 16,
    padding: 20,
    boxShadow: 'var(--shadow-card)',
  };
  const KICK: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    color: 'var(--color-sfz-blue)',
  };
  const TITLE: React.CSSProperties = { fontSize: 19, fontWeight: 800, margin: '4px 0 14px' };

  return (
    <div>
      <div className="map-grid" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', alignItems: 'start' }}>
        {/* MAPA — vlastná karta */}
        <div style={cardStyle}>
          <div style={KICK}>Mapa Slovenska</div>
          <div style={TITLE}>{metricLabel} podľa zväzov</div>
          {/* ovládanie */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'inline-flex', background: 'var(--color-track)', borderRadius: 12, padding: 3 }}>
              {(['SFZ', 'RFZ', 'ObFZ'] as Level[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLevel(l)}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 9,
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    background: level === l ? 'var(--color-card)' : 'transparent',
                    color: level === l ? 'var(--color-sfz-blue)' : 'var(--color-muted)',
                    boxShadow: level === l ? 'var(--shadow-card)' : 'none',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {METRICS.map((m) => (
                <button key={m.k} type="button" onClick={() => setMetric(m.k)} style={pill(metric === m.k)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
          <svg viewBox={mapData.viewBox} style={{ width: '100%', height: 'auto' }}>
            {level === 'SFZ' ? (
              <path
                d={mapData.slovensko}
                fill={choroColor(1)}
                stroke="#fff"
                strokeWidth={1}
                style={{ cursor: 'default' }}
                aria-label={`Slovenský futbalový zväz — ${metricLabel}: ${fmt(sfzVal)}`}
                {...tip.viazat(
                  <>
                    <TipNadpis>Slovenský futbalový zväz</TipNadpis>
                    <TipRiadok popis={metricLabel} hodnota={fmt(sfzVal)} />
                  </>,
                )}
              />
            ) : (
              regions.map((r) => {
                const v = r.values[metric] ?? 0;
                const t = max > min ? (v - min) / (max - min) : 0.5;
                const aktiv = aktivny === r.name;
                const viaz = tip.viazat(
                  <>
                    <TipNadpis>{r.name}</TipNadpis>
                    <TipRiadok popis={metricLabel} hodnota={fmt(v)} />
                  </>,
                );
                return (
                  <path
                    key={r.name}
                    d={r.path}
                    fill={v > 0 ? choroColor(t) : '#eef0f3'}
                    stroke={aktiv ? 'var(--color-sfz-red)' : '#fff'}
                    strokeWidth={aktiv ? 2.2 : 0.9}
                    style={{ cursor: 'pointer', transition: 'fill .15s' }}
                    aria-label={`${r.name} — ${metricLabel}: ${fmt(v)}`}
                    {...viaz}
                    onMouseMove={(e) => {
                      setAktivny(r.name);
                      viaz.onMouseMove(e);
                    }}
                    onMouseLeave={() => {
                      setAktivny(null);
                      viaz.onMouseLeave();
                    }}
                    onTouchStart={(e) => {
                      setAktivny(r.name);
                      viaz.onTouchStart(e);
                    }}
                    onClick={() => goProfil(r.id)}
                  />
                );
              })
            )}
          </svg>

          {/* legenda */}
          {level !== 'SFZ' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: 'var(--color-muted)' }}>
              <span className="tnum">{fmt(min)}</span>
              <span
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #dbe6ff, #1450df)',
                }}
              />
              <span className="tnum">{fmt(max)}</span>
            </div>
          )}

          <tip.Tooltip />
          </div>
        </div>
        {/* REBRÍČEK — vlastná karta */}
        <div style={cardStyle}>
          <div style={KICK}>Rebríček</div>
          <div style={TITLE}>{level === 'SFZ' ? 'Slovensko spolu' : `Najviac ${metricLabel.toLowerCase()}`}</div>
          {level === 'SFZ' ? (
            <div className="tnum" style={{ fontSize: 34, fontWeight: 800 }}>{fmt(sfzVal)}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {rebricek.map((r, i) => {
                const v = r.values[metric] ?? 0;
                return (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => goProfil(r.id)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 2 }}>
                      <span style={{ color: 'var(--color-ink)' }}>
                        <span style={{ color: 'var(--color-muted)' }}>{i + 1}.</span> {r.name}
                      </span>
                      <span className="tnum" style={{ fontWeight: 700 }}>{fmt(v)}</span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: 'var(--color-track)' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(v / rebricekMax) * 100}%`,
                          borderRadius: 4,
                          background: 'var(--color-sfz-blue)',
                          transition: 'width .3s',
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 820px){ .map-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
