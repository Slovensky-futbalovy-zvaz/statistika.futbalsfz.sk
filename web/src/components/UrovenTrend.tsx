import { useMemo, useState } from 'react';
import { rozbal, type UrovneVCase } from '../lib/urovne';
import { fmt } from '../lib/format';
import { PALETTE, UROVEN_LABEL, UROVEN_LABEL_KRATKY } from '../lib/palette';

export interface UrovenTrendProps {
  data: UrovneVCase;
  /** Predvolený výber zväzov (id) — zvyčajne top 4 podľa zápasov. */
  defaultVyber?: string[];
  /** Index vekovej kategórie (-1 = všetky) — riadi ho UrovneSekcia. */
  kat: number;
  /** Index pohlavia v POHLAVIA_PORADIE (-1 = všetci). */
  gender: number;
}

type Styl = 'auto' | 'ciary' | 'mriezka';

/** Nad toľko vybraných zväzov sa v režime „auto“ prepne na mriežku sparkline. */
const PRAH_MRIEZKY = 4;

/**
 * Vývoj počtu súťaží ZVOLENEJ ÚROVNE v čase, jedna séria na zväz.
 *
 * Pri malom počte zväzov je čitateľnejší jeden čiarový graf, pri veľkom mriežka
 * mini-grafov — hodnoty bývajú 1–3, takže tucet čiar cez seba splýva. Režim
 * „auto“ prepína podľa počtu vybraných zväzov, dá sa aj vynútiť ručne.
 *
 * Prebiehajúca sezóna sa kreslí prerušovane; čísla sa v nej ešte len dopĺňajú,
 * takže prepad k nule nie je trend.
 */
export default function UrovenTrend({ data, defaultVyber, kat, gender }: UrovenTrendProps) {
  const [uroven, setUroven] = useState<number | null>(null);
  const [styl, setStyl] = useState<Styl>('auto');
  const [vybrane, setVybrane] = useState<number[]>(() => {
    const ids = defaultVyber ?? [];
    const idx = data.zvazy.map((z, i) => (ids.includes(z.id) ? i : -1)).filter((i) => i >= 0);
    return idx.length ? idx : data.zvazy.map((_, i) => i).slice(0, 4);
  });

  // Okrem hodnôt sa ráta aj predvolená úroveň: tá, ktorá má v poslednej kompletnej
  // sezóne najviac súťaží — v rámci PRÁVE ZVOLENÉHO rezu. Prvá úroveň v poradí by
  // pri ObFZ znamenala „1. ligu“, ktorú oblastné zväzy takmer neriadia — graf by sa
  // otvoril prázdny.
  const { hodnoty, urovneIdx, predvolena } = useMemo(() => {
    const h = new Map<string, number>();
    const pouziteU = new Set<number>();
    const poslKompl = Math.max(0, data.sezony.indexOf(data.poslednaKompletna));
    const sucty = new Map<number, number>();
    for (const [zi, si, ui, ki, g, n] of rozbal(data.rows)) {
      if (kat >= 0 && ki !== kat) continue;
      if (gender >= 0 && g !== gender) continue;
      pouziteU.add(ui);
      h.set(`${ui}|${zi}|${si}`, (h.get(`${ui}|${zi}|${si}`) ?? 0) + n);
      if (si === poslKompl) sucty.set(ui, (sucty.get(ui) ?? 0) + n);
    }
    const idx = data.urovne.map((_, i) => i).filter((i) => pouziteU.has(i));
    let najlepsia = idx[0] ?? 0;
    let najviac = -1;
    for (const [ui, v] of sucty) if (v > najviac) [najlepsia, najviac] = [ui, v];
    return { hodnoty: h, urovneIdx: idx, predvolena: najlepsia };
  }, [data, kat, gender]);

  const zvolena = uroven ?? predvolena;
  const aktivnaUroven = urovneIdx.includes(zvolena) ? zvolena : predvolena;
  const n = data.sezony.length;
  const val = (zi: number, si: number) => hodnoty.get(`${aktivnaUroven}|${zi}|${si}`) ?? 0;

  const prebiehaOd = useMemo(() => {
    const i = data.sezony.indexOf(data.poslednaKompletna);
    return i < 0 ? n : i + 1; // index prvej prebiehajúcej sezóny
  }, [data, n]);
  const poslKomplet = Math.max(0, Math.min(prebiehaOd - 1, n - 1));

  const max = useMemo(() => {
    let m = 1;
    vybrane.forEach((zi) => {
      for (let s = 0; s < n; s++) if (val(zi, s) > m) m = val(zi, s);
    });
    return m;
  }, [vybrane, hodnoty, aktivnaUroven, n]);

  const mriezka = styl === 'mriezka' || (styl === 'auto' && vybrane.length > PRAH_MRIEZKY);
  const farba = (zi: number) => PALETTE[zi % PALETTE.length];

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
  const chip = (active: boolean, col: string): React.CSSProperties => ({
    padding: '3px 10px',
    borderRadius: 13,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    border: active ? '1px solid transparent' : '1px solid #dcdfe4',
    background: active ? col : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-muted)',
  });

  const W = 860;
  const L = 44;
  const R = 168;
  const T = 10;
  const H = 230;
  const x = (s: number) => L + (n <= 1 ? 0 : (s / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * H;
  const cesta = (zi: number, od: number, doIdx: number) => {
    let d = '';
    for (let s = Math.max(0, od); s <= doIdx && s < n; s++) d += (d ? ' L' : 'M') + x(s) + ',' + y(val(zi, s));
    return d;
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
        <span style={{ color: 'var(--color-muted)' }}>Úroveň:</span>
        {urovneIdx.map((ui) => (
          <button
            key={ui}
            type="button"
            title={UROVEN_LABEL[data.urovne[ui]]}
            style={chip(aktivnaUroven === ui, 'var(--color-sfz-blue)')}
            onClick={() => setUroven(ui)}
          >
            {UROVEN_LABEL_KRATKY[data.urovne[ui]] ?? data.urovne[ui]}
          </button>
        ))}
        <span style={{ color: 'var(--color-muted)', marginLeft: 8 }}>Zobrazenie:</span>
        {([['auto', 'Auto'], ['ciary', 'Čiary'], ['mriezka', 'Mriežka']] as [Styl, string][]).map(([s, l]) => (
          <button key={s} type="button" style={pill(styl === s)} onClick={() => setStyl(s)}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 12, fontSize: 12 }}>
        <span style={{ color: 'var(--color-muted)' }}>Zväzy:</span>
        {data.zvazy.map((z, zi) => {
          const on = vybrane.includes(zi);
          return (
            <button
              key={z.id}
              type="button"
              style={chip(on, farba(zi))}
              onClick={() => setVybrane((v) => (on ? v.filter((i) => i !== zi) : [...v, zi]))}
            >
              {z.nazov}
            </button>
          );
        })}
      </div>

      {vybrane.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Vyber aspoň jeden zväz.</p>
      ) : mriezka ? (
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
          {vybrane.map((zi) => {
            const sw = 180;
            const sh = 46;
            const px = (s: number) => 4 + (n <= 1 ? 0 : (s / (n - 1)) * (sw - 8));
            const py = (v: number) => 4 + (1 - v / max) * (sh - 8);
            let d1 = '';
            for (let s = 0; s < Math.min(prebiehaOd, n); s++) d1 += (d1 ? ' L' : 'M') + px(s) + ',' + py(val(zi, s));
            let d2 = '';
            if (prebiehaOd < n) {
              for (let s = prebiehaOd - 1; s < n; s++) d2 += (d2 ? ' L' : 'M') + px(s) + ',' + py(val(zi, s));
            }
            return (
              <div key={zi} style={{ border: '1px solid var(--color-line, #e6e8ec)', borderRadius: 10, padding: '8px 10px 5px' }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: farba(zi), marginBottom: 2 }}>
                  {data.zvazy[zi].nazov}
                </div>
                <svg viewBox={`0 0 ${sw} ${sh}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
                  <path d={d1} fill="none" stroke={farba(zi)} strokeWidth={1.8} />
                  {d2 && <path d={d2} fill="none" stroke={farba(zi)} strokeWidth={1.8} strokeDasharray="3 3" opacity={0.6} />}
                  <circle cx={px(poslKomplet)} cy={py(val(zi, poslKomplet))} r={2.6} fill={farba(zi)} />
                </svg>
                <div style={{ fontSize: 10.5, color: 'var(--color-muted)' }}>
                  {data.poslednaKompletna}: <b style={{ color: 'var(--color-ink)' }}>{fmt(val(zi, poslKomplet))}</b>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${T + H + 30}`} style={{ display: 'block', width: '100%', height: 'auto' }} role="img">
          {Array.from({ length: max + 1 }, (_, g) => g)
            .filter((g) => max <= 6 || g % Math.ceil(max / 5) === 0)
            .map((g) => (
              <g key={g}>
                <line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="#eef0f3" />
                <text x={L - 8} y={y(g) + 3} textAnchor="end" fontSize={10} fill="var(--color-muted)">
                  {g}
                </text>
              </g>
            ))}
          {data.sezony.map((s, i) =>
            i % 2 ? null : (
              <text key={s} x={x(i)} y={T + H + 16} textAnchor="middle" fontSize={10} fill="var(--color-muted)">
                {s.slice(2, 4)}/{s.slice(7)}
              </text>
            ),
          )}
          {vybrane.map((zi, k) => (
            <g key={zi}>
              <path d={cesta(zi, 0, prebiehaOd - 1)} fill="none" stroke={farba(zi)} strokeWidth={2} strokeLinejoin="round" />
              {prebiehaOd < n && (
                <path d={cesta(zi, prebiehaOd - 1, n - 1)} fill="none" stroke={farba(zi)} strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
              )}
              {data.sezony.map((s, si) => (
                <circle key={s} cx={x(si)} cy={y(val(zi, si))} r={2.4} fill={farba(zi)} opacity={si >= prebiehaOd ? 0.6 : 1}>
                  <title>{`${data.zvazy[zi].nazov} · ${s}: ${fmt(val(zi, si))} súťaží`}</title>
                </circle>
              ))}
              <text x={W - R + 8} y={T + 12 + k * 14} fontSize={10.5} fontWeight={700} fill={farba(zi)}>
                {data.zvazy[zi].nazov}
              </text>
            </g>
          ))}
          <line x1={L} y1={T + H} x2={W - R} y2={T + H} stroke="var(--color-line, #e6e8ec)" />
        </svg>
      )}

      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)' }}>
        Počet súťaží úrovne „{UROVEN_LABEL[data.urovne[aktivnaUroven]] ?? ''}“ naprieč sezónami.
        Prerušovaný úsek je prebiehajúca sezóna, v ktorej sa čísla ešte len dopĺňajú — posledná
        kompletná je {data.poslednaKompletna}. Pri viac než {PRAH_MRIEZKY} zväzoch sa graf
        automaticky prepne na mriežku mini-grafov, lebo hodnoty bývajú malé a čiary by splývali.
      </p>
    </div>
  );
}
