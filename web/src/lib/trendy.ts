// Dátová vrstva pre Trendy (vekové zloženie) a Index klubu.
// Číta predgenerované JSON pri BUILDE (Node fs) — rovnako ako lib/data.ts.
//
// Typy a výpočtové funkcie sú v `trendyTypy.ts`, aby si ich mohli importovať React
// komponenty bez toho, aby sa im do bundlu dostala táto dátová vrstva.
import fs from 'node:fs';
import path from 'node:path';
import { statistiky, zluc, sklon, PRAH_KLUBOV, type Histogram, type IndexKlubu, type IndexPrehladRiadok, type VekVCase } from './trendyTypy';
import { getZvazy, klubyZvazu, poslednaKompletnaSlug } from './data';
import { UROVEN_PORADIE } from './palette';

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
                          /** competitionId → kód úrovne súťaže dospelých (len pri kluboch). */
                          urovne?: Record<string, string>;
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

/**
 * Vekový vývoj po zväzoch — podklad pre stránku Trendy.
 *
 * Okrem celku sa počíta aj rez podľa **úrovne ligy** (rozhodnutie Ján Letko, 7. 8. 2026),
 * aby sa dalo porovnať napríklad 7. ligu naprieč ObFZ. Úrovne sú naprieč sezónami
 * stabilné, na rozdiel od názvov súťaží.
 */
/** Zanikanie a vznikanie klubov (data/zanikanie.json, vyrába etl/zanikanie.py).
 *
 * Definícia (Ján Letko, 15. 8. 2026): zaniknutý klub je klub, ktorý dva roky po sebe neprihlási
 * do súťaže žiadne družstvo. Postup ani zostup nie je zánik — aktivita sa posudzuje celoslovensky.
 */
export interface Zanikanie {
  generatedAt: string;
  definicia: string;
  sezony: string[];
  hodnotitelne: string[];
  tichoSezon: number;
  vynechane: { nabehISSF: string[]; prebiehajuca: string; bezNasledujucich: string[] };
  zanik: Record<string, Record<string, number>>;
  jednosezonnaPauza: Record<string, number>;
  obnovene: Record<string, number>;
  obnovenychSpolu: number;
  prislo: Record<string, Record<string, number>>;
  miery: Record<string, { klubosezon: number; zanikov: number; miera: number | null }>;
  zanikovSpolu: number;
  zvazy: Record<string, {
    nazov: string; uroven?: string | null;
    zanikov: number; podielSR: number | null; klubosezony: number; miera: number | null;
    prichody: number; poObdobiach: Record<string, number>;
    klubovVSutaziachZvazu: Record<string, number>;
  }>;
  poObdobiach: Record<string, {
    sezon: number; sezonPrichodov: number; zanikov: number; prichody: number;
    zanikovNaSezonu: number | null; prichodovNaSezonu: number | null;
  }>;
  presunyMedziZvazmi: {
    zmien: number; dvojicSezon: number; podiel: number | null; klubovSoZmenou: number;
    poznamka: string;
  };
}

export function getZanikanie(): Zanikanie | undefined {
  return readJson<Zanikanie>(path.join(DATA, 'zanikanie.json'));
}

export function getVekZvazovVCase(): VekVCase {
  const zvazy = getZvazy();
  const sezonySet = new Set<string>();
  const urovneSet = new Set<string>();
  const data = new Map<string, VekSubor>();
  for (const z of zvazy) {
    const v = getVekZvaz(z.id);
    if (!v) continue;
    data.set(z.id, v);
    for (const [s, sez] of Object.entries(v.sezony || {})) {
      sezonySet.add(s);
      for (const kluc of Object.keys(sez?.vekUroven || {})) urovneSet.add(kluc.split('|')[0]);
    }
  }
  const sezony = [...sezonySet].sort();
  const subjekty = zvazy.filter((z) => data.has(z.id)).map((z) => ({ id: z.id, nazov: z.nazov }));
  // index 0 = celok, potom úrovne v poradí pyramídy
  const urovne = ['', ...UROVEN_PORADIE.filter((u) => urovneSet.has(u))];

  const riadky: string[] = [];
  subjekty.forEach((z, zi) => {
    const v = data.get(z.id)!;
    sezony.forEach((s, si) => {
      const sez = v.sezony?.[s];
      urovne.forEach((u, ui) => {
        let h: Histogram;
        if (!u) {
          h = zluc(...Object.values(sez?.vek || {}));
        } else {
          const kusy = Object.entries(sez?.vekUroven || {})
            .filter(([kluc]) => kluc.split('|')[0] === u)
            .map(([, x]) => x);
          h = zluc(...kusy);
        }
        const st = statistiky(h);
        if (!st) return;
        riadky.push(`${zi},${si},${ui},${st.median},${Math.round(st.priemer * 100)},${st.n}`);
      });
    });
  });

  return {
    sezony,
    subjekty,
    urovne,
    rows: riadky.join(';'),
    poslednaKompletna: poslednaKompletnaSlug().replace('-', '/'),
  };
}

/**
 * Vekový vývoj jedného zväzu — riadky pre komponent `VekKlubu` (rovnaký formát).
 *
 * Rez sa dá prepínať medzi **úrovňami ligy** (stabilné naprieč sezónami, hodia sa na vývoj
 * v čase) a **konkrétnymi súťažami** (presnejšie v jednej sezóne, ale premenúvajú sa) —
 * rozhodnutie Ján Letko, 7. 8. 2026. Úrovne dostávajú prefix `L:`, súťaže `S:`, aby ich
 * komponent vedel rozlíšiť do dvoch skupín.
 */
export function getVekZvazuRows(id: string): string {
  const v = getVekZvaz(id);
  if (!v?.sezony) return '';
  const out: string[] = [];
  const riadok = (sez: string, rez: string, st: NonNullable<ReturnType<typeof statistiky>>) =>
    [sez, rez, st.median, Math.round(st.priemer * 100), st.p25, st.p75, st.n,
     Math.round(st.doU21 * 1000), Math.round(st.nad35 * 1000)].join('|');

  for (const sez of Object.keys(v.sezony).sort()) {
    const s = v.sezony[sez];
    const celok = statistiky(zluc(...Object.values(s?.vek || {})));
    if (celok) out.push(riadok(sez, '', celok));

    // úrovne ligy — kľúč je `urovenKod|pohlavie`
    const perUroven = new Map<string, Histogram[]>();
    for (const [kluc, h] of Object.entries(s?.vekUroven || {})) {
      const kod = kluc.split('|')[0];
      const zoz = perUroven.get(kod) ?? [];
      zoz.push(h);
      perUroven.set(kod, zoz);
    }
    for (const [kod, hs] of perUroven) {
      const st = statistiky(zluc(...hs));
      if (st) out.push(riadok(sez, 'L:' + kod, st));
    }

    // konkrétne súťaže — kľúč je `competitionId|pohlavie`
    const perSutaz = new Map<string, Histogram[]>();
    for (const [kluc, h] of Object.entries(s?.vekSutaz || {})) {
      const nazov = s?.sutaze?.[kluc.split('|')[0]] || '';
      if (!nazov) continue;
      const zoz = perSutaz.get(nazov) ?? [];
      zoz.push(h);
      perSutaz.set(nazov, zoz);
    }
    for (const [nazov, hs] of perSutaz) {
      const st = statistiky(zluc(...hs));
      if (st) out.push(riadok(sez, 'S:' + nazov.replace(/[|\n]/g, ' '), st));
    }
  }
  return out.join('\n');
}

/** Celoslovenský vekový vývoj — súčet histogramov všetkých zväzov. */
export function getVekSlovenskoRows(): string {
  const perSezona = new Map<string, Histogram[]>();
  for (const z of getZvazy()) {
    const v = getVekZvaz(z.id);
    if (!v?.sezony) continue;
    for (const [sez, s] of Object.entries(v.sezony)) {
      const zoz = perSezona.get(sez) ?? [];
      zoz.push(...Object.values(s?.vek || {}));
      perSezona.set(sez, zoz);
    }
  }
  const out: string[] = [];
  for (const sez of [...perSezona.keys()].sort()) {
    const st = statistiky(zluc(...perSezona.get(sez)!));
    if (!st) continue;
    out.push([sez, '', st.median, Math.round(st.priemer * 100), st.p25, st.p75, st.n,
              Math.round(st.doU21 * 1000), Math.round(st.nad35 * 1000)].join('|'));
  }
  return out.join('\n');
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

/** Kód rezu pre kluby, ktoré v danej sezóne nemali dospelé družstvo. */
export const BEZ_DOSPELYCH = 'Bez dospelých';

/**
 * Najvyššia úroveň dospelej súťaže, v ktorej klub v sezóne hral.
 * `BEZ_DOSPELYCH`, ak nehral žiadnu — takých klubov je okoľo 156 a sú medzi nimi
 * tie najsilnejšie mládežnícke akadémie, takže sa nesmú poticho zahodiť.
 */
function najvyssiaUroven(urovne: Record<string, string> | undefined): string {
  const kody = new Set(Object.values(urovne || {}));
  if (!kody.size) return BEZ_DOSPELYCH;
  for (const u of UROVEN_PORADIE) if (kody.has(u)) return u;
  return [...kody][0];
}

/**
 * Vývoj Indexu klubu po zväzoch — medián indexu klubov zväzu v každej sezóne.
 *
 * Rozhodnutia Jána Letka (8. 8. 2026):
 * - hlavné číslo je **medián**, priemer sa nesie vedľa (rovnako ako pri veku);
 * - kluby **bez mládeže sa započítavajú** s indexom 0 — sú súčasťou reality zväzu;
 * - rez sa robí podľa **najvyššej dospelej úrovne klubu** v danej sezóne.
 *
 * POZOR na čítanie rezu: klub sa medzi sezónami sťahuje medzi úrovňami (postup, pád),
 * takže séria „6. liga" nie je ten istý súbor klubov naprieč sezónami. Pri veku to
 * nevadilo — tam sa merala súťaž; tu sa merie klub a súťažou sa len označuje.
 *
 * Výstup má rovnaký tvar ako `getVekZvazovVCase()`, aby sa dal použiť ten istý
 * komponent — `median` je medián indexu, `n` je počet klubov (nie zápisov).
 */
export function getIndexZvazovVCase(): VekVCase {
  const zvazy = getZvazy();
  const posledna = poslednaKompletnaSlug().replace('-', '/');

  // zväz → sezóna → rez → histogram {index: početKlubov}
  const data = new Map<string, Map<string, Map<string, Histogram>>>();
  const pocetKlubov = new Map<string, number>();
  const rezySet = new Set<string>();
  // hodnoty zložky D (kontinuita) po sezónach — z nich sa určí, od kedy je index
  // porovnateľný (kontinuita potrebuje päť sezón histórie, aby mohla dať plných 15 b.)
  const kontinuita = new Map<string, number[]>();

  for (const z of zvazy) {
    const perSezona = new Map<string, Map<string, Histogram>>();
    for (const k of klubyZvazu(z.id)) {
      const idx = getIndexKlubu(k.id);
      if (!idx?.sezony) continue;
      const vek = getVekKlub(k.id);
      for (const [sez, s] of Object.entries(idx.sezony)) {
        if (typeof s?.index !== 'number') continue;
        // Prebiehajúca sezóna sa vynecháva ÚPLNE. Na rozdiel od veku (kde má rozohratá
        // sezóna zmysel) tu ešte nie sú prihlásené mládežnícke družstvá, takže index
        // vychádza 0 a graf by sa na konci zrútil (meranie 8. 8. 2026: 75 % núl).
        if (sez > posledna) continue;
        const rez = najvyssiaUroven(vek?.sezony?.[sez]?.urovne);
        rezySet.add(rez);
        pocetKlubov.set(sez, (pocetKlubov.get(sez) ?? 0) + 1);
        if (typeof s.zlozky?.D === 'number') {
          const zoz = kontinuita.get(sez) ?? [];
          zoz.push(s.zlozky.D);
          kontinuita.set(sez, zoz);
        }
        let rezy = perSezona.get(sez);
        if (!rezy) { rezy = new Map(); perSezona.set(sez, rezy); }
        for (const kluc of ['', rez]) {
          const h = rezy.get(kluc) ?? {};
          h[s.index] = (h[s.index] ?? 0) + 1;
          rezy.set(kluc, h);
        }
      }
    }
    if (perSezona.size) data.set(z.id, perSezona);
  }

  // Sezóny s výrazne menším pokrytím sa vynechávajú — nie sú porovnateľné. Týka sa to
  // 2012/2013, kde je v dátach 578 klubov oproti ~1 700 v ďalších sezónach; medián 0
  // by čítateľ vnímal ako stav mládeže, nie ako dôsledok toho, že dáta ešte nie sú.
  const maxPocet = Math.max(0, ...pocetKlubov.values());
  const sezony = [...pocetKlubov.keys()]
    .filter((s) => (pocetKlubov.get(s) ?? 0) >= 0.6 * maxPocet)
    .sort();
  const subjekty = zvazy.filter((z) => data.has(z.id)).map((z) => ({ id: z.id, nazov: z.nazov }));
  const urovne = ['', ...UROVEN_PORADIE.filter((u) => rezySet.has(u))];
  if (rezySet.has(BEZ_DOSPELYCH)) urovne.push(BEZ_DOSPELYCH);

  // Od kedy je index porovnateľný: prvá sezóna, v ktorej medián zložky kontinuity
  // dosiahne svoje maximum. Do vtedy je rast indexu z väčšej časti len tým, že
  // história ešte nebola dosť dlhá (rozhodnutie Ján Letko, 8. 8. 2026: sezóny pred
  // touto hranicou sa kreslia prerušovane).
  const medianD = (sez: string) => {
    const v = (kontinuita.get(sez) ?? []).slice().sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  };
  const maxD = Math.max(0, ...sezony.map(medianD));
  const porovnatelneOd = sezony.find((s) => medianD(s) >= maxD);

  const riadky: string[] = [];
  subjekty.forEach((z, zi) => {
    const perSezona = data.get(z.id)!;
    sezony.forEach((s, si) => {
      urovne.forEach((u, ui) => {
        const st = statistiky(perSezona.get(s)?.get(u), PRAH_KLUBOV);
        if (!st) return;
        riadky.push(`${zi},${si},${ui},${st.median},${Math.round(st.priemer * 100)},${st.n}`);
      });
    });
  });

  return {
    sezony,
    subjekty,
    urovne,
    rows: riadky.join(';'),
    poslednaKompletna: posledna,
    porovnatelneOd,
  };
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
