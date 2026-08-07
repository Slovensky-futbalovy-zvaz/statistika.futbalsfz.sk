// Dátová vrstva pre Trendy (vekové zloženie) a Index klubu.
// Číta predgenerované JSON pri BUILDE (Node fs) — rovnako ako lib/data.ts.
//
// Typy a výpočtové funkcie sú v `trendyTypy.ts`, aby si ich mohli importovať React
// komponenty bez toho, aby sa im do bundlu dostala táto dátová vrstva.
import fs from 'node:fs';
import path from 'node:path';
import { statistiky, zluc, sklon, type Histogram, type IndexKlubu, type IndexPrehladRiadok, type VekVCase } from './trendyTypy';
import { getZvazy, poslednaKompletnaSlug } from './data';

const DATA = path.resolve(process.cwd(), '..', 'data');
const VEK = path.join(DATA, 'vek');
const VEK_KLUB = path.join(DATA, 'vek-klub');
const INDEX_KLUB = path.join(DATA, 'index-klubu');

export type { Histogram, IndexKlubu, IndexPrehladRiadok, VekVCase };

const _cache = new Map<string, unknown>();
function readJson<T>(p: string): T | undefined {
  if (_cache.has(p)) return _cache.get(p) as T | undefined;
  let v: T | undefined;
  try {
    v = JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    v = undefined;
  }
  _cache.set(p, v);
  return v;
}

interface VekSubor {
  sezony: Record<string, { vek?: Record<string, Histogram>; vekUroven?: Record<string, Histogram>;
                          vekSutaz?: Record<string, Histogram>; sutaze?: Record<string, string>;
                          druzstva?: Record<string, number> }>;
}

export function getVekZvaz(id: string): VekSubor | undefined {
  return readJson<VekSubor>(path.join(VEK, id + '.json'));
}

export function getVekKlub(id: string): VekSubor | undefined {
  return readJson<VekSubor>(path.join(VEK_KLUB, id + '.json'));
}

export function getIndexKlubu(id: string): IndexKlubu | undefined {
  return readJson<IndexKlubu>(path.join(INDEX_KLUB, id + '.json'));
}

export interface IndexPrehlad {
  generatedAt: string;
  sezona: string;
  pocetKlubov: number;
  kluby: IndexPrehladRiadok[];
}

export function getIndexPrehlad(): IndexPrehlad | undefined {
  return readJson<IndexPrehlad>(path.join(DATA, 'index-klubu.json'));
}

/** Vekový vývoj po zväzoch — podklad pre stránku Trendy. */
export function getVekZvazovVCase(): VekVCase {
  const zvazy = getZvazy();
  const sezonySet = new Set<string>();
  const data = new Map<string, VekSubor>();
  for (const z of zvazy) {
    const v = getVekZvaz(z.id);
    if (!v) continue;
    data.set(z.id, v);
    for (const s of Object.keys(v.sezony || {})) sezonySet.add(s);
  }
  const sezony = [...sezonySet].sort();
  const subjekty = zvazy.filter((z) => data.has(z.id)).map((z) => ({ id: z.id, nazov: z.nazov }));

  const riadky: string[] = [];
  subjekty.forEach((z, zi) => {
    const v = data.get(z.id)!;
    sezony.forEach((s, si) => {
      const st = statistiky(zluc(...Object.values(v.sezony?.[s]?.vek || {})));
      if (!st) return;
      riadky.push(`${zi},${si},${st.median},${Math.round(st.priemer * 100)},${st.n}`);
    });
  });

  return {
    sezony,
    subjekty,
    rows: riadky.join(';'),
    poslednaKompletna: poslednaKompletnaSlug().replace('-', '/'),
  };
}

/**
 * Vekový vývoj jedného klubu — riadky pre komponent `VekKlubu`.
 * `sezona|rez|median|priemer×100|p25|p75|n|doU21×1000|nad35×1000`, rez prázdny = celý klub.
 */
export function getVekKlubuRows(id: string): string {
  const v = getVekKlub(id);
  if (!v?.sezony) return '';
  const out: string[] = [];
  for (const sez of Object.keys(v.sezony).sort()) {
    const s = v.sezony[sez];
    const celok = statistiky(zluc(...Object.values(s?.vek || {})));
    const riadok = (rez: string, st: NonNullable<ReturnType<typeof statistiky>>) =>
      [sez, rez, st.median, Math.round(st.priemer * 100), st.p25, st.p75, st.n,
       Math.round(st.doU21 * 1000), Math.round(st.nad35 * 1000)].join('|');
    if (celok) out.push(riadok('', celok));

    // rez po súťažiach — kľúč vo `vekSutaz` je `competitionId|pohlavie`
    const perSutaz = new Map<string, Histogram[]>();
    for (const [kluc, h] of Object.entries(s?.vekSutaz || {})) {
      const comp = kluc.split('|')[0];
      const nazov = s?.sutaze?.[comp] || '';
      if (!nazov) continue;
      const zoz = perSutaz.get(nazov) ?? [];
      zoz.push(h);
      perSutaz.set(nazov, zoz);
    }
    for (const [nazov, hs] of perSutaz) {
      const st = statistiky(zluc(...hs));
      if (st) out.push(riadok(nazov.replace(/[|\n]/g, ' '), st));
    }
  }
  return out.join('\n');
}

export interface StarnuciKlub {
  klub: string;
  nazov: string;
  /** Sklon mediánu veku za posledné 3 sezóny — rokov za sezónu. Kladné = starne. */
  trend: number;
  medianPrva: number;
  medianPosledna: number;
  /** Zmena počtu zápisov medzi prvou a poslednou sezónou okna (%). */
  zmenaHracov: number;
  zapisov: number;
  /** Podiel hráčov do 21 rokov v poslednej sezóne okna. */
  doU21: number;
  sezony: string[];
}

/**
 * Rebríček „starnúce kluby" — kluby, ktorým vek RASTIE (rozhodnutie Ján Letko).
 * Radí sa podľa sklonu za posledné 3 sezóny, nie podľa medziročnej zmeny; jednorazový
 * výkyv (odchádzajúci ročník, zranenia) nesmie rozhodovať.
 *
 * Vedľa zmeny veku sa nesie aj zmena počtu hráčov — bez nej sa nedá odlíšiť zdravé
 * omladenie od rozpadu kádra (SK Velčice −3,4 roka pri poklese zápisov na polovicu
 * verzus Slovan Hostie −3,2 roka pri raste; meranie 7. 8. 2026).
 */
export function getStarnuceKluby(oknoSezon = 3): StarnuciKlub[] {
  const prehlad = getIndexPrehlad();
  if (!prehlad) return [];
  const cielova = prehlad.sezona;

  const out: StarnuciKlub[] = [];
  for (const r of prehlad.kluby) {
    const v = getVekKlub(r.klub);
    if (!v?.sezony) continue;
    const vsetky = Object.keys(v.sezony).sort();
    const i = vsetky.indexOf(cielova);
    if (i < oknoSezon - 1) continue;
    const okno = vsetky.slice(i - oknoSezon + 1, i + 1);

    const staty = okno.map((s) => statistiky(zluc(...Object.values(v.sezony[s]?.vek || {}))));
    if (staty.some((s) => s === null)) continue; // musí mať dosť dát vo všetkých sezónach

    const mediany = staty.map((s) => s!.median);
    const t = sklon(mediany);
    if (t === null || t <= 0) continue; // rebríček starnúcich — len rast

    const prva = staty[0]!;
    const posledna = staty[staty.length - 1]!;
    out.push({
      klub: r.klub,
      nazov: r.nazov || r.klub,
      trend: t,
      medianPrva: prva.median,
      medianPosledna: posledna.median,
      zmenaHracov: prva.n ? ((posledna.n - prva.n) / prva.n) * 100 : 0,
      zapisov: posledna.n,
      doU21: posledna.doU21,
      sezony: okno,
    });
  }
  out.sort((a, b) => b.trend - a.trend);
  return out;
}
