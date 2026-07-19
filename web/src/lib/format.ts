// Formátovacie a výpočtové helpery (design handoff). Bez závislostí — použiteľné
// v .astro frontmatteri (build) aj v React islandoch (klient).

export const fmt = (n: number): string =>
  new Intl.NumberFormat('sk-SK').format(Math.round(n));

export const fmt1 = (n: number): string =>
  new Intl.NumberFormat('sk-SK', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);

export interface Delta {
  pct: number;
  up: boolean;
  arrow: string;
  color: string;
  text: string;
}

/**
 * Medziročná zmena. `goodUp=false` pre metriky, kde je klesanie pozitívne
 * (žlté/červené karty) — farba delty sa invertuje.
 */
export function delta(cur: number, prev?: number, goodUp = true): Delta | null {
  if (prev == null || !prev) return null;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  const positive = goodUp ? up : !up;
  const flat = Math.abs(pct) < 0.05;
  return {
    pct,
    up,
    arrow: flat ? '→' : up ? '▲' : '▼',
    color: flat
      ? 'var(--color-muted)'
      : positive
        ? 'var(--color-good)'
        : 'var(--color-sfz-red)',
    text: `${up ? '+' : ''}${Math.round(pct)} %`,
  };
}

/** Koncový rok sezóny "RRRR/RRRR" → RRRR (číslo). */
export const endYear = (s: string): number => parseInt(s.split('/')[1], 10);

/**
 * Rok/vek → veková úroveň (proxy pre demografiu): vek ≥ 19 → ADULTS,
 * inak U07–U19 (age+1, orezané do 7..19).
 */
export const ageLevel = (age: number): string =>
  age >= 19 ? 'ADULTS' : 'U' + String(Math.min(Math.max(age + 1, 7), 19)).padStart(2, '0');

/** Choropleth: sekvenčná modrá #dbe6ff → #1450df podľa t∈⟨0,1⟩. */
export function choroColor(t: number): string {
  const lo = [219, 230, 255];
  const hi = [20, 80, 223];
  const k = 0.15 + Math.max(0, Math.min(1, t)) * 0.85;
  return (
    '#' +
    lo
      .map((v, i) => Math.round(v + (hi[i] - v) * k).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Normalizácia bez diakritiky pre vyhľadávanie. */
export const bezDiakritiky = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
