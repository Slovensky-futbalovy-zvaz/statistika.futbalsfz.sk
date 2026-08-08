import { useMemo, useState } from 'react';
import { PALETTE, UROVEN_LABEL_KRATKY } from '../lib/palette';
import type { VekVCase } from '../lib/trendyTypy';

interface Props {
  data: VekVCase;
  /** Predvolený výber (id zväzov). Ak prázdny, vyberie sa SFZ a štyri RFZ. */
  defaultVyber?: string[];
  /** Jednotka meranej hodnoty v tooltipe — `rokov` pri veku, `bodov` pri Indexe klubu. */
  jednotka?: string;
  /** Čo sa počíta v `n` — `zápisov` pri veku, `klubov` pri Indexe klubu. */
  pocetSlovo?: string;
  /** Popisok filtra rezov. */
  rezSlovo?: string;
  /** Vysvetlivka pod grafom. Ak nie je zadaná, použije sa veková. */
  poznamka?: string;
}

const PREDVOLENE = ['sfz', 'bfz', 'zsfz', 'ssfz', 'vsfz'];

/** Koľko zväzov sa pri prepnutí úrovne vyberie automaticky. Viac čiar sa už nedá čítať. */
const MAX_AUTO = 6;

/**
 * Vývoj mediánu veku hráčov v súťažiach dospelých, jedna séria na zväz.
 *
 * Prebiehajúca sezóna sa kreslí prerušovane — čísla sa v nej ešte dopĺňajú.
 * Typy a dáta chodia z `lib/trendy.ts`; tento komponent nesmie importovať nič,
 * čo siaha na súbory (pozri poznámku v `urovneTypy.ts`).
 *
 * Filter úrovne pri prepnutí PREHODÍ VÝBER ZVÄZOV na tie, ktoré danú úroveň naozaj
 * riadia (rozhodnutie Ján Letko, 8. 8. 2026). Bez toho ostal graf po kliknutí na
 * napríklad 7. ligu prázdny — predvolene sú vybrané SFZ a RFZ, ale 7. liga je
 * úroveň oblastných zväzov.
 */
export default function VekTrendZvazov({
  data,
  defaultVyber,
  jednotka = 'rokov',
  pocetSlovo = 'zápisov',
  rezSlovo = 'Úroveň',
  poznamka,
}: Props) {
  const predvolene = useMemo(() => {
    const ids = defaultVyber?.length ? defaultVyber : PREDVOLENE;
    const idx = data.subjekty.map((z, i) => (ids.includes(z.id) ? i : -1)).filter((i) => i >= 0);
    return idx.length ? idx : data.subjekty.map((_, i) => i).slice(0, 5);
  }, [data, defaultVyber]);

  const [vybrane, setVybrane] = useState<number[]>(predvolene);
  const [uroven, setUroven] = useState(0);

  /**
   * Pre každú úroveň zoznam zväzov, ktoré v nej majú dáta, zoradený podľa počtu
   * zápisov zostupne — pri prepnutí úrovne sa berie zhora.
   */
  const zvazyNaUrovni = useMemo(() => {
    const sucty = new Map<number, Map<number, number>>();
    for (const r of data.rows ? data.rows.split(';') : []) {
      const [zi, , ui, , , n] = r.split(',').map(Number);
      let g = sucty.get(ui);
      if (!g) { g = new Map(); sucty.set(ui, g); }
      g.set(zi, (g.get(zi) ?? 0) + n);
    }
    const out = new Map<number, number[]>();
    for (const [ui, g] of sucty) {
      out.set(ui, [...g.entries()].sort((a, b) => b[1] - a[1]).map(([zi]) => zi));
    }
    return out;
  }, [data]);

  const dostupne = zvazyNaUrovni.get(uroven) ?? [];

  const prepniUroven = (ui: number) => {
    setUroven(ui);
    if (ui === 0) {
      setVybrane(predvolene);
      return;
    }
    const kandidati = zvazyNaUrovni.get(ui) ?? [];
    // Ponecháme z terajšieho výberu tie, ktoré úroveň naozaj riadia, zvyšok doplníme
    // od najväčších, aby graf nikdy neostal prázdny.
    const ponechane = vybrane.filter((zi) => kandidati.includes(zi));
    const doplnene = kandidati.filter((zi) => !ponechane.includes(zi));
    setVybrane([...ponechane, ...doplnene].slice(0, MAX_AUTO));
  };

  const { hodnoty, min, max } = useMemo(() => {
    const h = new Map<string, { median: number; n: number }>();
    let lo = 99;
    let hi = 0;
    for (const r of (data.rows ? data.rows.split(';') : [])) {
      const [zi, si, ui, med, , n] = r.split(',').map(Number);
      if (ui !== uroven) continue;
      h.set(`${zi}|${si}`, { median: med, n });
      if (med < lo) lo = med;
      if (med > hi) hi = med;
    }
    if (lo > hi) return { hodnoty: h, min: 20, max: 35 };
    return { hodnoty: h, min: Math.floor(lo - 1), max: Math.ceil(hi + 1) };
  }, [data, uroven]);

  const n = data.sezony.length;
  const prebiehaOd = useMemo(() => {
    const i = data.sezony.indexOf(data.poslednaKompletna);
    return i < 0 ? n : i + 1;
  }, [data, n]);

  /**
   * Index prvej plne porovnateľnej sezóny. Sezóny pred ňou sa kreslia prerušovane
   * rovnako ako prebiehajúca sezóna na konci — pri Indexe klubu je to úsek, v ktorom
   * ešte nemohla byť nasytená zložka kontinuity.
   */
  const porovnatelneOd = useMemo(() => {
    if (!data.porovnatelneOd) return 0;
    const i = data.sezony.indexOf(data.porovnatelneOd);
    return i < 0 ? 0 : i;
  }, [data]);

  const val = (zi: number, si: number) => hodnoty.get(`${zi}|${si}`)?.median ?? null;

  const W = 860;
  const L = 40;
  const R = 172;
  const T = 10;
  const H = 250;
  const x = (s: number) => L + (n <= 1 ? 0 : (s / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - min) / Math.max(1, max - min)) * H;
  const farba = (zi: number) => PALETTE[zi % PALETTE.length];

  const cesta = (zi: number, od: number, doIdx: number) => {
    let d = '';
    for (let s = Math.max(0, od); s <= doIdx && s < n; s++) {
      const v = val(zi, s);
      if (v === null) { d = d; continue; }
      d += (d ? ' L' : 'M') + x(s) + ',' + y(v);
    }
    return d;
  };

  const chip = (active: boolean, col: string, tlmene = false): React.CSSProperties => ({
    padding: '3px 10px', borderRadius: 13, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid transparent' : '1px solid #dcdfe4',
    background: active ? col : 'var(--color-card)',
    color: active ? '#fff' : 'var(--color-muted)',
    opacity: !active && tlmene ? 0.45 : 1,
  });

  const kroky = useMemo(() => {
    const out: number[] = [];
    for (let v = min; v <= max; v++) if ((v - min) % Math.max(1, Math.ceil((max - min) / 6)) === 0) out.push(v);
    return out;
  }, [min, max]);

  const menoUrovne = (u: string) => (u ? (UROVEN_LABEL_KRATKY[u] ?? u) : 'Všetky súťaže');

  return (
    <div>
      {data.urovne.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--color-muted)' }}>{rezSlovo}:</span>
          {data.urovne.map((u, ui) => (
            <button
              key={u || 'celok'}
              type="button"
              style={{
                padding: '3px 10px', borderRadius: 13, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                border: uroven === ui ? 'none' : '1px solid #dcdfe4',
                background: uroven === ui ? 'var(--color-sfz-blue)' : 'var(--color-card)',
                color: uroven === ui ? '#fff' : 'var(--color-ink)',
              }}
              onClick={() => prepniUroven(ui)}
            >
              {menoUrovne(u)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginBottom: 8, fontSize: 12 }}>
        <span style={{ color: 'var(--color-muted)' }}>Zväzy:</span>
        {data.subjekty.map((z, zi) => {
          const on = vybrane.includes(zi);
          const maData = uroven === 0 || dostupne.includes(zi);
          return (
            <button
              key={z.id}
              type="button"
              style={chip(on, farba(zi), !maData)}
              title={maData ? undefined : `${z.nazov} nemá v reze „${menoUrovne(data.urovne[uroven])}“ žiadne dáta`}
              onClick={() => setVybrane((v) => (on ? v.filter((i) => i !== zi) : [...v, zi]))}
            >
              {z.nazov}
            </button>
          );
        })}
      </div>

      {uroven > 0 && (
        <p style={{ marginBottom: 12, fontSize: 11.5, color: 'var(--color-muted)' }}>
          {dostupne.length === 0
            ? `Rez „${menoUrovne(data.urovne[uroven])}“ nemá dostatok dát v žiadnom zväze.`
            : `Rez „${menoUrovne(data.urovne[uroven])}“ má dáta v ${dostupne.length} ${
                dostupne.length === 1 ? 'zväze' : dostupne.length < 5 ? 'zväzoch' : 'zväzoch'
              }; výber sa prepol na ${vybrane.length} z nich (podľa počtu ${pocetSlovo}). Ďalšie pridáš kliknutím vyššie — zväzy bez dát v tomto reze sú stlmené.`}
        </p>
      )}

      {vybrane.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Vyber aspoň jeden zväz.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${T + H + 30}`} style={{ display: 'block', width: '100%', height: 'auto' }} role="img">
          {kroky.map((g) => (
            <g key={g}>
              <line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="#eef0f3" />
              <text x={L - 6} y={y(g) + 3} textAnchor="end" fontSize={10} fill="var(--color-muted)">{g}</text>
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
              {porovnatelneOd > 0 && (
                <path d={cesta(zi, 0, porovnatelneOd)} fill="none" stroke={farba(zi)} strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
              )}
              <path d={cesta(zi, porovnatelneOd, prebiehaOd - 1)} fill="none" stroke={farba(zi)} strokeWidth={2} strokeLinejoin="round" />
              {prebiehaOd < n && (
                <path d={cesta(zi, prebiehaOd - 1, n - 1)} fill="none" stroke={farba(zi)} strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
              )}
              {data.sezony.map((s, si) => {
                const v = val(zi, si);
                if (v === null) return null;
                return (
                  <circle key={s} cx={x(si)} cy={y(v)} r={2.4} fill={farba(zi)} opacity={si >= prebiehaOd || si < porovnatelneOd ? 0.6 : 1}>
                    <title>{`${data.subjekty[zi].nazov} · ${s}: medián ${v} ${jednotka} (${hodnoty.get(`${zi}|${si}`)?.n ?? 0} ${pocetSlovo})`}</title>
                  </circle>
                );
              })}
              <text x={W - R + 8} y={T + 12 + k * 14} fontSize={10.5} fontWeight={700} fill={farba(zi)}>
                {data.subjekty[zi].nazov}
              </text>
            </g>
          ))}
          <line x1={L} y1={T + H} x2={W - R} y2={T + H} stroke="var(--color-line, #e6e8ec)" />
        </svg>
      )}

      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--color-muted)', lineHeight: 1.6 }}>
        {poznamka ?? (
          <>
            Medián vekovej úrovne osoby v zápisoch o stretnutí v súťažiach dospelých. Prerušovaný
            úsek je prebiehajúca sezóna, v ktorej sa čísla ešte dopĺňajú — posledná kompletná je{' '}
            {data.poslednaKompletna}. Filter úrovne porovnáva tú istú ligu naprieč zväzmi — úrovne
            sú naprieč sezónami stabilné, na rozdiel od názvov súťaží. Zobrazujú sa len zväzy
            a sezóny s aspoň 100 zápismi.
          </>
        )}
      </p>
    </div>
  );
}
