// Dátová vrstva — číta predgenerované JSON zo susedného priečinka ../data
// pri BUILDE (Node fs). Web nemá žiadny runtime prístup k dátam ani DB (ADR-0001).
import fs from 'node:fs';
import path from 'node:path';
import { endYear, ageLevel } from './format';

const DATA = path.resolve(process.cwd(), '..', 'data');
const CONFIG = path.resolve(process.cwd(), '..', 'etl', 'config');

export interface ZvazIndex {
  id: string;
  nazov: string;
  uroven: string; // SFZ | RFZ | ObFZ
  rfz?: string; // skratka nadradeného RFZ (BFZ/ZsFZ/SsFZ/VsFZ)
  appSpace: string;
  sezony: string[]; // futbal, vzostupne
  odvetvia?: Record<string, string[]>; // napr. { futsal: ["2014/2015", …] }
}

export interface Index {
  generatedAt: string;
  zvazy: ZvazIndex[];
}

export interface Kpi {
  sutaze?: number; // počet súťaží (od 19. 7. 2026; staršie profily ho nemajú)
  zapasy: number;
  druzstva: number;
  goly: number;
  divaci: number;
  zlteKarty: number;
  cerveneKarty: number;
  kontumovane?: number; // #kontumácie: počet zápasov s contumation.isContumated=true, súčasť zapasy (nie odpočítané)
}

export interface Kategoria {
  sutaze?: number; // počet súťaží vo vekovej úrovni (staršie profily ho nemajú)
  zapasy: number;
  druzstva: number;
  goly: number;
  zlte: number;
  cervene: number;
  divaci: number;
  divaciPokrytych: number;
}

export interface OsobaSkupina {
  unikatni: number;
  poKategorii: Record<string, number>;
}

/** Súhrn za jednu úroveň súťaže (blok `urovne`; disjunktný — sedí na kpi.sutaze). */
export interface UrovenSuhrn {
  nazov: string;
  sutaze: number;
  zapasy: number;
}

/**
 * Riadok rozpadu súťaží: úroveň × veková kategória × pohlavie (blok `sutazeUroven`).
 * Súťaž so zápasmi vo viacerých vekových úrovniach sa započíta v každej z nich.
 */
export interface UrovenRiadok {
  uroven: string; // L1…L9 | L10P | POHARE | NEURCENE
  kat: string; // ADULTS | U19 | … | NEZNAMA
  pohlavie: string; // M | F | NEURCENE
  sutaze: number;
  zapasy: number;
}

export interface Profil {
  zvaz: string;
  sezona: string;
  sportSector: string;
  generatedAt: string;
  methodologyFlags: Record<string, unknown>;
  kpi: Kpi;
  kategorie: Record<string, Kategoria>;
  /** Počet súťaží po úrovniach (etapa 2; staršie profily blok nemajú). */
  urovne?: Record<string, UrovenSuhrn>;
  /** Rozpad úroveň × kategória × pohlavie (etapa 2; staršie profily blok nemajú). */
  sutazeUroven?: UrovenRiadok[];
  pohlavie: Record<string, unknown>;
  osoby: Record<string, OsobaSkupina>;
}

const _jsonCache = new Map<string, unknown>();
function readJson<T>(p: string): T {
  const hit = _jsonCache.get(p);
  if (hit !== undefined) return hit as T;
  const v = JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  _jsonCache.set(p, v);
  return v;
}

export function getIndex(): Index {
  return readJson<Index>(path.join(DATA, 'index.json'));
}

export function getZvazy(): ZvazIndex[] {
  return [...getIndex().zvazy].sort((a, b) => a.id.localeCompare(b.id, 'sk'));
}

export function getZvaz(id: string): ZvazIndex | undefined {
  return getIndex().zvazy.find((z) => z.id === id);
}

/** Najnovšia futbalová sezóna zväzu (sezony sú vzostupne). */
export function najnovsiaSezona(z: ZvazIndex): string | undefined {
  return z.sezony.length ? z.sezony[z.sezony.length - 1] : undefined;
}

/** Načíta profil zväzu za sezónu (futbal). */
export function getProfil(id: string, sezona: string): Profil {
  const nazov = sezona.replace('/', '-') + '.json';
  return readJson<Profil>(path.join(DATA, 'zvaz', id, nazov));
}

// ---- Odvetvia mimo futbalu (konvencia index.odvetvia — report kvality §10) ----

export const ODVETVIE_LABEL: Record<string, string> = {
  futbal: 'Futbal',
  futsal: 'Futsal',
};

/**
 * Načíta profil zväzu za sezónu pre iné odvetvie než futbal
 * (súbor RRRR-RRRR-{sektor}.json, napr. 2025-2026-futsal.json).
 */
export function getProfilOdvetvie(id: string, sezona: string, sektor: string): Profil {
  const nazov = `${sezona.replace('/', '-')}-${sektor}.json`;
  return readJson<Profil>(path.join(DATA, 'zvaz', id, nazov));
}

/** Sezóny zväzu pre dané odvetvie (futbal = zvaz.sezony, inak z odvetvia mapy). */
export function sezonyOdvetvia(z: ZvazIndex, odvetvie: string): string[] {
  return odvetvie === 'futbal' ? z.sezony : (z.odvetvia?.[odvetvie] ?? []);
}

/** Odvetvia dostupné pre zväz (futbal prvé, potom podľa index.odvetvia). */
export function odvetviaZvazu(z: ZvazIndex): string[] {
  const dalsie = Object.keys(z.odvetvia ?? {}).filter((o) => (z.odvetvia?.[o] ?? []).length > 0);
  return [...(z.sezony.length ? ['futbal'] : []), ...dalsie.sort()];
}

/**
 * Mapa geoName → id zväzu (z etl/config/zvazy.json) na spojenie polygónov
 * mapy (web/assets/geo/mapa.json má `name` = geoName) s profilmi zväzov.
 */
export function geoNameToId(): Record<string, string> {
  const cfg = readJson<Record<string, Array<{ id: string; geoName?: string | null }>>>(
    path.join(CONFIG, 'zvazy.json'),
  );
  const map: Record<string, string> = {};
  for (const uroven of ['rfz', 'obfz'] as const) {
    for (const z of cfg[uroven] ?? []) {
      if (z.geoName) map[z.geoName] = z.id;
    }
  }
  return map;
}

/** Formátovanie čísel v slovenskom tvare (medzera ako oddeľovač tisícov). */
export function fmt(n: number): string {
  return new Intl.NumberFormat('sk-SK').format(n);
}

// ---- F4: porovnania a radenie zväzov ----

export interface PorovnanieRiadok {
  id: string;
  nazov: string;
  rfz?: string;
  sutaze?: number;
  zapasy: number;
  druzstva: number;
  kontumovane?: number;
  goly: number;
  divaci: number;
  zlteKarty: number;
  cerveneKarty: number;
  hraci: number;
  treneri?: number;
  rozhodcovia?: number;
  realizacnyTim?: number;
  delegati?: number;
  personal?: number;
  golyNaZapas: number;
  divaciNaZapas: number;
  /** Počet súťaží po pohlaví (etapa 2; staršie porovnania kľúč nemajú). */
  sutazePohlavie?: Record<string, number>;
  /** Počet súťaží po úrovniach súťaže, kód → počet (etapa 2). */
  urovne?: Record<string, number>;
  /** Plochý rez úroveň × veková úroveň × pohlavie (podklad pre heatmapu a trend úrovní). */
  sutazeUroven?: UrovenRiadok[];
}

export interface Porovnanie {
  uroven: string;
  sezona: string;
  generatedAt: string;
  pocetZvazov: number;
  zvazy: PorovnanieRiadok[];
}

const POROVNANIA = path.join(DATA, 'porovnania');
const UROVEN_SLUGY = ['rfz', 'obfz'] as const;

/** Zoznam dostupných porovnaní (úroveň × sezóna) pre getStaticPaths. */
export function getPorovnaniaZoznam(): { urovenSlug: string; sezona: string; sezonaSlug: string }[] {
  const res: { urovenSlug: string; sezona: string; sezonaSlug: string }[] = [];
  for (const urovenSlug of UROVEN_SLUGY) {
    const dir = path.join(POROVNANIA, urovenSlug);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const sezonaSlug = f.replace('.json', '');
      res.push({ urovenSlug, sezona: sezonaSlug.replace('-', '/'), sezonaSlug });
    }
  }
  return res;
}

export function getPorovnanie(urovenSlug: string, sezonaSlug: string): Porovnanie {
  return readJson<Porovnanie>(path.join(POROVNANIA, urovenSlug, sezonaSlug + '.json'));
}

export interface BumpData {
  sezony: string[]; // vzostupne
  zvazy: { id: string; nazov: string }[];
  hodnoty: Record<string, Record<string, Record<string, number>>>; // sezona → id → metrika → hodnota
  // sezona → id → kategória (ADULTS/U19…) → metrika → hodnota (pre vekový filter grafu vývoja)
  kat: Record<string, Record<string, Record<string, Record<string, number>>>>;
}

/** Dáta pre bump chart poradia zväzov v čase pre danú úroveň (všetky sezóny úrovne). */
function getBumpData(urovenSlug: string): BumpData {
  const dir = path.join(POROVNANIA, urovenSlug);
  if (!fs.existsSync(dir)) return { sezony: [], zvazy: [], hodnoty: {}, kat: {} };
  const sezony = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort();
  const hodnoty: BumpData['hodnoty'] = {};
  const kat: BumpData['kat'] = {};
  const zvazMap = new Map<string, string>();
  const metriky = [
    'sutaze', 'zapasy', 'druzstva', 'kontumovane', 'goly', 'zlteKarty', 'cerveneKarty',
    'hraci', 'treneri', 'rozhodcovia', 'realizacnyTim', 'delegati', 'personal',
    'divaci', 'golyNaZapas', 'divaciNaZapas',
  ];
  for (const slug of sezony) {
    const por = getPorovnanie(urovenSlug, slug);
    const sezona = slug.replace('-', '/');
    hodnoty[sezona] = {};
    kat[sezona] = {};
    for (const r of por.zvazy) {
      zvazMap.set(r.id, r.nazov);
      hodnoty[sezona][r.id] = Object.fromEntries(
        metriky.map((m) => [m, (r as unknown as Record<string, number>)[m] ?? 0]),
      );
      const rkat = (r as unknown as { kat?: Record<string, Record<string, number>> }).kat;
      if (rkat) kat[sezona][r.id] = rkat;
    }
  }
  return {
    sezony: sezony.map((s) => s.replace('-', '/')),
    zvazy: [...zvazMap.entries()].map(([id, nazov]) => ({ id, nazov })),
    hodnoty,
    kat,
  };
}

/** Bump chart poradia RFZ v čase (4 regionálne zväzy). */
export function getBumpDataRfz(): BumpData {
  return getBumpData('rfz');
}

/** Bump chart poradia ObFZ v čase (38 oblastných zväzov; na frontende výber 2–5). */
export function getBumpDataObfz(): BumpData {
  return getBumpData('obfz');
}

/** Sezóny dostupné pre danú úroveň (zostupne), na prepínač. */
export function sezonyUrovne(urovenSlug: string): string[] {
  return getPorovnaniaZoznam()
    .filter((p) => p.urovenSlug === urovenSlug)
    .map((p) => p.sezonaSlug)
    .sort()
    .reverse();
}

/** Posledná KOMPLETNÁ sezóna (slug RRRR-RRRR) — najnovšia s aspoň polovicou max. objemu zápasov.
 *  Vynechá práve začatú sezónu (napr. 2026/2027 po 1. 7.). */
export function poslednaKompletnaSlug(): string {
  const sez = getSumarSezony();
  if (!sez.length) return '';
  const maxZ = Math.max(...sez.map((s) => getSumar(s).kpi.zapasy));
  const komplet = sez.filter((s) => getSumar(s).kpi.zapasy >= maxZ * 0.5);
  return (komplet[komplet.length - 1] ?? sez[sez.length - 1]).replace('/', '-');
}

/** Cieľová sezóna pri prepnutí úrovne v Porovnaniach: zachovaj aktuálnu ak ju cieľová
 *  úroveň má, inak posledná kompletná, inak najnovšia dostupná. */
export function porovnanieCielovaSlug(cielovaUroven: string, aktualnaSlug: string): string {
  const dostupne = sezonyUrovne(cielovaUroven); // zostupne
  if (dostupne.includes(aktualnaSlug)) return aktualnaSlug;
  const komplet = poslednaKompletnaSlug();
  if (komplet && dostupne.includes(komplet)) return komplet;
  return dostupne[0] ?? aktualnaSlug;
}

// ---- F5: demografia osôb ----

export interface DemoRola {
  osoby: number;
  sUdajmi: number;
  bezUdajov: number;
  roky: Record<string, Record<string, number>>; // rok → {M,F,N: počet}
}
export interface Demografia {
  zvaz: string;
  sportSector: string;
  generatedAt: string;
  methodologyFlags: Record<string, unknown>;
  sezony: Record<string, Record<string, DemoRola>>; // sezóna → rola → agregát
}

const DEMOGRAFIA = path.join(DATA, 'demografia');
export const ROLY_PORADIE = ['hraci', 'treneri', 'rozhodcovia', 'delegati', 'personal'] as const;
export const ROLA_LABEL: Record<string, string> = {
  hraci: 'Hráči',
  treneri: 'Tréneri',
  rozhodcovia: 'Rozhodcovia',
  delegati: 'Delegáti',
  personal: 'Personál',
};

/** Demografia zväzu, ak existuje (súbor môže chýbať). */
export function getDemografia(id: string): Demografia | undefined {
  const p = path.join(DEMOGRAFIA, id + '.json');
  return fs.existsSync(p) ? readJson<Demografia>(p) : undefined;
}

// ---- Demografia klubu (#37 klubový plán) — etl/demografia_klub.py -> data/demografia-klub ----
export interface DemografiaKlub {
  klub: string;
  sportSector: string;
  generatedAt: string;
  methodologyFlags: Record<string, unknown>;
  sezony: Record<string, Record<string, DemoRola>>;
}
const DEMOGRAFIA_KLUB = path.join(DATA, 'demografia-klub');

/** Demografia klubu, ak existuje (súbor môže chýbať — vyžaduje samostatný ETL beh). */
export function getDemografiaKlub(id: string): DemografiaKlub | undefined {
  const p = path.join(DEMOGRAFIA_KLUB, id + '.json');
  return fs.existsSync(p) ? readJson<DemografiaKlub>(p) : undefined;
}

/** Osoby po sezónach a rolách z DEMOGRAFIE (rok narodenia → veková úroveň) pre KpiTrend.
 *  { sezona -> rola -> úroveň(ADULTS/U..) -> počet }. Dostupné za všetky sezóny
 *  (na rozdiel od osoby.poKategorii, ktoré vychádza z teams.ageCategory až od ~2024). */
export function demoTrend(demo: Demografia | DemografiaKlub | undefined): Record<string, Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, Record<string, number>>> = {};
  if (!demo) return out;
  for (const [s, roly] of Object.entries(demo.sezony)) {
    const ey = endYear(s);
    const o: Record<string, Record<string, number>> = {};
    for (const [rola, r] of Object.entries(roly)) {
      const byLvl: Record<string, number> = {};
      for (const [yr, pg] of Object.entries(r.roky || {})) {
        const lvl = ageLevel(ey - parseInt(yr, 10));
        byLvl[lvl] = (byLvl[lvl] ?? 0) + (((pg as Record<string, number>).M ?? 0) + ((pg as Record<string, number>).F ?? 0) + ((pg as Record<string, number>).N ?? 0));
      }
      o[rola] = byLvl;
    }
    out[s] = o;
  }
  return out;
}

// ---- Celoslovenský sumár (etl/sumar.py → data/sumar) ----

export interface SunburstUzol {
  name: string;
  id?: string;
  uroven?: string; // SFZ/RFZ/ObFZ — na uzloch úrovne v sunburstOsoby
  value?: number;
  sutaze?: number; // len listy sunburstSutaze — počet súťaží zväzu (prepínač metriky)
  pohlavie?: Record<string, number>; // len listy sunburstSutaze (M/F/NEURCENE → zápasy)
  sutazePohlavie?: Record<string, number>; // len listy sunburstSutaze (M/F/NEURCENE → súťaže)
  children?: SunburstUzol[];
}

export interface Sumar {
  sezona: string;
  generatedAt: string;
  pocetZvazov: number;
  methodologyFlags: Record<string, string>;
  kpi: Kpi;
  osoby: Record<string, number>; // roly + spolu
  kategorie?: Record<string, Kategoria>; // súčty po vekových úrovniach (futbal, 43 zväzov)
  /** Rozpad súťaží podľa riadiaceho zväzu (SFZ / RFZ / ObFZ). */
  sutazePodlaRiadiacehoZvazu?: Record<
    string,
    { sutaze: number; zapasy: number; pocetZvazov: number; kategorie: Record<string, { sutaze: number; zapasy: number }> }
  >;
  /** Počet súťaží po úrovniach za celú SR (etapa 2; staršie sumáre blok nemajú). */
  urovne?: Record<string, UrovenSuhrn>;
  /** Rozpad úroveň × kategória × pohlavie za celú SR (etapa 2). */
  sutazeUroven?: UrovenRiadok[];
  /** Počet súťaží po pohlaví za celú SR (etapa 2). */
  sutazePohlavie?: Record<string, number>;
  odvetvia: Record<
    string,
    {
      kpi: Kpi;
      osoby: Record<string, number>;
      kategorie?: Record<string, Kategoria>;
      urovne?: Record<string, UrovenSuhrn>;
      sutazeUroven?: UrovenRiadok[];
      sutazePohlavie?: Record<string, number>;
    }
  >;
  sunburstSutaze: SunburstUzol;
  sunburstOsoby: SunburstUzol;
}

const SUMAR = path.join(DATA, 'sumar');

/** Sezóny so sumárom (vzostupne), z data/sumar/RRRR-RRRR.json. */
export function getSumarSezony(): string[] {
  if (!fs.existsSync(SUMAR)) return [];
  return fs
    .readdirSync(SUMAR)
    .filter((f) => /^\d{4}-\d{4}\.json$/.test(f))
    .map((f) => f.replace('.json', '').replace('-', '/'))
    .sort();
}

export function getSumar(sezona: string): Sumar {
  return readJson<Sumar>(path.join(SUMAR, sezona.replace('/', '-') + '.json'));
}

/** Celoslovenská demografia (súčet zväzov; dvojité pôsobenie — viď methodologyFlags). */
export function getSumarDemografia(): Demografia | undefined {
  const p = path.join(SUMAR, 'demografia.json');
  return fs.existsSync(p) ? readJson<Demografia>(p) : undefined;
}

// ---- Projekty (grassroots) — etl/projekty.py → data/projekty ----

export interface ProjektSezona {
  deti: number;
  skoly: number;
  timy: number;
  pohlavie: Record<string, number>; // M/F/N
  vek: Record<string, Record<string, number>>; // vek → {M,F,N}
}
export interface Projekt {
  projekt: string;
  nazov: string;
  popis: string;
  generatedAt: string;
  methodologyFlags: Record<string, string>;
  sezony: Record<string, ProjektSezona>;
}
export interface ProjektIndexPolozka {
  id: string;
  nazov: string;
  popis: string;
  sezony: string[];
  poslednaDeti: number;
}

const PROJEKTY = path.join(DATA, 'projekty');

export function getProjektyIndex(): ProjektIndexPolozka[] {
  const p = path.join(PROJEKTY, 'index.json');
  return fs.existsSync(p)
    ? readJson<{ projekty: ProjektIndexPolozka[] }>(p).projekty
    : [];
}

export function getProjekt(id: string): Projekt | undefined {
  const p = path.join(PROJEKTY, id + '.json');
  return fs.existsSync(p) ? readJson<Projekt>(p) : undefined;
}

// ---- Kluby (COWORK_TASK_KLUBY) ----

export interface KlubIndexPolozka {
  id: string;
  nazov: string;
  zvaz: string | null;
  zvazNazov: string;
  uroven: string;
  sezony: string[];
  zapasy: number;
  hraci: number;
  odvetvia?: Record<string, string[]>; // napr. { futsal: ["2014/2015", ...] } (data/kluby/{sektor}-index.json)
}
export interface Klub {
  klub: string;
  orgId: string;
  nazov: string;
  sezona: string;
  sportSector: string;
  zvaz: string | null;
  uroven: string;
  generatedAt: string;
  methodologyFlags: Record<string, unknown>;
  kpi: Kpi;
  kategorie: Record<string, Kategoria>;
  osoby: Record<string, OsobaSkupina>;
}

const KLUBY = path.join(DATA, 'kluby');
const KLUB = path.join(DATA, 'klub');

export function getKluby(): KlubIndexPolozka[] {
  const p = path.join(KLUBY, 'index.json');
  return fs.existsSync(p) ? readJson<{ kluby: KlubIndexPolozka[] }>(p).kluby : [];
}

/** Metadáta indexu klubov (referenčná sezóna rebríčka + zoznam všetkých sezón). Pre kozmetický
 *  badge 'SEZÓNA X' v hlavičke /kluby (#4 klubový plán) — bez reálneho per-sezónneho filtra. */
export function getKlubyIndexMeta(): { sezona: string; sezony: string[]; generatedAt: string } | undefined {
  const p = path.join(KLUBY, 'index.json');
  if (!fs.existsSync(p)) return undefined;
  const raw = readJson<{ sezona: string; sezony: string[]; generatedAt: string }>(p);
  return { sezona: raw.sezona, sezony: raw.sezony, generatedAt: raw.generatedAt };
}

/** Sezóny dostupné pre klub (VŠETKY — podľa súborov RRRR-RRRR.json). Používa sa na
 *  medziročné porovnanie (predošlá sezóna sa číta z dátového súboru, aj keď nemá stránku). */
export function getKlubSezony(id: string): string[] {
  const d = path.join(KLUB, id);
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => /^\d{4}-\d{4}\.json$/.test(f))
    .map((f) => f.replace('.json', '').replace('-', '/'))
    .sort();
}

/** Okno sezón, pre ktoré sa GENERUJÚ stránky klubov (posledných 6 kanonických =
 *  2021/22–2026/27). Staršie dáta ostávajú pre medziročné porovnanie, ale bez vlastnej stránky.
 *  Vracia slugy (RRRR-RRRR). */
export function klubWindowSlugy(): string[] {
  const p = path.join(KLUBY, 'index.json');
  const all = fs.existsSync(p) ? readJson<{ sezony?: string[] }>(p).sezony ?? [] : [];
  return all.slice(-6).map((s) => s.replace('/', '-'));
}

/** Sezóny klubu, ktoré majú stránku (prienik dostupných sezón a okna).
 *  Ak klub nemá žiadnu sezónu v okne (zanikol pred oknom), dostane aspoň svoju najnovšiu. */
export function getKlubSezonyPaged(id: string): string[] {
  // Všetky sezóny klubu (predtým okno posledných ~6 sezón). Výber rieši SeasonPicker.
  return getKlubSezony(id);
}

export function getKlub(id: string, sezona: string): Klub | undefined {
  const p = path.join(KLUB, id, sezona.replace('/', '-') + '.json');
  return fs.existsSync(p) ? readJson<Klub>(p) : undefined;
}

// ---- Kluby: odvetvia mimo futbalu (napr. futsal) — etl/kluby.py --sport-sector,
// data/kluby/{sektor}-index.json + data/klub/{id}/{sezona}-{sektor}.json ----

/** Index klubov pre dané odvetvie mimo futbalu (napr. futsal). */
export function getKlubyOdvetvie(sektor: string): { id: string; nazov: string; zvaz: string | null; zvazNazov: string; uroven: string; sezony: string[] }[] {
  const p = path.join(KLUBY, `${sektor}-index.json`);
  if (!fs.existsSync(p)) return [];
  const raw = readJson<{ kluby: { id: string; nazov: string; zvaz: string | null; uroven: string; sezony: string[] }[] }>(p);
  return raw.kluby.map((k) => ({ ...k, zvazNazov: k.zvaz ? (getZvaz(k.zvaz)?.nazov ?? k.zvaz) : '?' }));
}

/** Načíta profil klubu za sezónu pre iné odvetvie než futbal (RRRR-RRRR-{sektor}.json). */
export function getKlubProfilOdvetvie(id: string, sezona: string, sektor: string): Klub | undefined {
  const p = path.join(KLUB, id, `${sezona.replace('/', '-')}-${sektor}.json`);
  return fs.existsSync(p) ? readJson<Klub>(p) : undefined;
}

const KLUB_ODVETVIA_MIMO_FUTBALU = ['futsal'];

/** Odvetvia dostupné pre klub (futbal ak má stránky v okne, plus nájdené v {sektor}-index.json). */
export function odvetviaKlubu(id: string, sezonyFutbal: string[]): { odvetvie: string; sezony: string[] }[] {
  const vysledok: { odvetvie: string; sezony: string[] }[] = [];
  if (sezonyFutbal.length) vysledok.push({ odvetvie: 'futbal', sezony: sezonyFutbal });
  for (const sektor of KLUB_ODVETVIA_MIMO_FUTBALU) {
    const zaznam = getKlubyOdvetvie(sektor).find((k) => k.id === id);
    if (zaznam) vysledok.push({ odvetvie: sektor, sezony: zaznam.sezony });
  }
  return vysledok;
}

/** Zoznam (klub, sezóna) pre getStaticPaths — len sezóny v okne (posledných 6). */
export function getKlubyPaths(): { id: string; sezonaSlug: string }[] {
  const res: { id: string; sezonaSlug: string }[] = [];
  if (!fs.existsSync(KLUB)) return res;
  for (const id of fs.readdirSync(KLUB)) {
    const d = path.join(KLUB, id);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const s of getKlubSezonyPaged(id)) {
      res.push({ id, sezonaSlug: s.replace('/', '-') });
    }
  }
  return res;
}

/** Kluby patriace pod daný zväz (na prepojenie zo zväzu). */
export function klubyZvazu(zvazId: string): KlubIndexPolozka[] {
  return getKluby().filter((k) => k.zvaz === zvazId);
}

// ---- Kluby: priame porovnanie (etl/porovnania_kluby.py → data/porovnania/kluby) ----

export interface PorovnanieKlubRiadok {
  id: string;
  nazov: string;
  zvaz: string | null;
  zvazNazov: string;
  uroven: string;
  zapasy: number;
  druzstva: number;
  goly: number;
  divaci: number;
  zlteKarty: number;
  cerveneKarty: number;
  hraci: number;
  treneri: number;
  realizacnyTim: number;
  golyNaZapas: number;
  divaciNaZapas: number;
  kat: Record<string, { zapasy: number; druzstva: number; goly: number; divaci: number; hraci: number }>;
}

export interface PorovnanieKluby {
  sezona: string;
  generatedAt: string;
  pocetKlubov: number;
  kluby: PorovnanieKlubRiadok[];
}

const POROVNANIA_KLUBY = path.join(DATA, 'porovnania', 'kluby');

/** Sezóny (slugy RRRR-RRRR, vzostupne), pre ktoré existuje porovnanie klubov. */
export function getPorovnanieKlubySezony(): string[] {
  if (!fs.existsSync(POROVNANIA_KLUBY)) return [];
  return fs
    .readdirSync(POROVNANIA_KLUBY)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort();
}

export function getPorovnanieKluby(sezonaSlug: string): PorovnanieKluby {
  return readJson<PorovnanieKluby>(path.join(POROVNANIA_KLUBY, sezonaSlug + '.json'));
}

/** Východisková sezóna pre odkaz na porovnanie klubov (posledná kompletná, inak najnovšia dostupná). */
export function porovnanieKlubyDefaultSlug(): string {
  const dostupne = getPorovnanieKlubySezony(); // vzostupne
  if (!dostupne.length) return '';
  const komplet = poslednaKompletnaSlug();
  return dostupne.includes(komplet) ? komplet : dostupne[dostupne.length - 1];
}

// ---- Mapové dáta pre choropleth (redizajn) ----

export interface MapRegion {
  id?: string;
  name: string;
  path: string;
  values: Record<string, number>; // zapasy, druzstva, goly, divaci, hraci
}
export interface MapData {
  viewBox: string;
  slovensko: string;
  rfz: MapRegion[];
  obfz: MapRegion[];
  sfz: Record<string, number>;
  nazvy: Record<string, string>; // id → názov zväzu (pre tooltip/klik)
}

const MAP_METRIKY = ['zapasy', 'druzstva', 'goly', 'divaci', 'hraci'] as const;

function porovnanieValues(urovenSlug: string, sezonaSlug: string): Record<string, Record<string, number>> {
  const p = path.join(POROVNANIA, urovenSlug, sezonaSlug + '.json');
  if (!fs.existsSync(p)) return {};
  const por = readJson<Porovnanie>(p);
  const out: Record<string, Record<string, number>> = {};
  for (const r of por.zvazy) {
    out[r.id] = Object.fromEntries(
      MAP_METRIKY.map((m) => [m, (r as unknown as Record<string, number>)[m] ?? 0]),
    );
  }
  return out;
}

/** Kompletné mapové dáta pre React island (choropleth) za sezónu. */
export function getMapData(sezona: string): MapData {
  const slug = sezona.replace('/', '-');
  const mapa = readJson<{ viewBox: string; slovensko: string; rfz: { name: string; path: string }[]; obfz: { name: string; path: string }[] }>(
    path.join(process.cwd(), 'assets', 'geo', 'mapa.json'),
  );
  const geo = geoNameToId(); // geoName → id
  const nazvy: Record<string, string> = Object.fromEntries(getZvazy().map((z) => [z.id, z.nazov]));
  const rfzVals = porovnanieValues('rfz', slug);
  const obfzVals = porovnanieValues('obfz', slug);

  const rfz: MapRegion[] = mapa.rfz.map((r) => {
    const id = geo[r.name];
    return { id, name: nazvy[id] ?? r.name, path: r.path, values: rfzVals[id] ?? {} };
  });
  const obfz: MapRegion[] = mapa.obfz.map((o) => {
    const id = geo[o.name];
    return { id, name: nazvy[id] ?? o.name, path: o.path, values: obfzVals[id] ?? {} };
  });

  // SFZ = národný súčet (sumár): KPI + hráči z osôb
  let sfz: Record<string, number> = {};
  try {
    const s = getSumar(sezona);
    sfz = {
      zapasy: s.kpi.zapasy,
      druzstva: s.kpi.druzstva,
      goly: s.kpi.goly,
      divaci: s.kpi.divaci,
      hraci: s.osoby?.hraci ?? 0,
    };
  } catch {
    // sumár pre sezónu nemusí existovať
  }

  return { viewBox: mapa.viewBox, slovensko: mapa.slovensko, rfz, obfz, sfz, nazvy };
}

// ---- Mapa ObFZ pre detail RFZ (len ObFZ patriace pod daný RFZ) ----
export interface RfzObfzMapa {
  viewBox: string;
  slovensko: string;
  regions: MapRegion[];
}

/** Choropleth dáta iba pre ObFZ patriace pod daný RFZ (za sezónu). */
export function getObfzMapaPreRfz(rfzId: string, sezona: string): RfzObfzMapa {
  const slug = sezona.replace('/', '-');
  const mapa = readJson<{ viewBox: string; slovensko: string; obfz: { name: string; path: string }[] }>(
    path.join(process.cwd(), 'assets', 'geo', 'mapa.json'),
  );
  const geo = geoNameToId();
  const nazvy: Record<string, string> = Object.fromEntries(getZvazy().map((z) => [z.id, z.nazov]));
  const cfg = readJson<Record<string, Array<{ id: string; rfz?: string }>>>(
    path.join(CONFIG, 'zvazy.json'),
  );
  const obfzRfz: Record<string, string> = {};
  for (const oo of cfg.obfz ?? []) if (oo.rfz) obfzRfz[oo.id] = oo.rfz;
  const vals = porovnanieValues('obfz', slug);
  const regions: MapRegion[] = mapa.obfz
    .map((oo) => {
      const id = geo[oo.name];
      return { id, name: nazvy[id] ?? oo.name, path: oo.path, values: vals[id] ?? {} };
    })
    .filter((r) => r.id && obfzRfz[r.id] === rfzId);
  return { viewBox: mapa.viewBox, slovensko: mapa.slovensko, regions };
}

/** Choropleth dáta pre 4 regionálne zväzy (RFZ) — pre profil SFZ. */
export function getRfzMapa(sezona: string): RfzObfzMapa {
  const slug = sezona.replace('/', '-');
  const mapa = readJson<{ viewBox: string; slovensko: string; rfz: { name: string; path: string }[] }>(
    path.join(process.cwd(), 'assets', 'geo', 'mapa.json'),
  );
  const geo = geoNameToId();
  const nazvy: Record<string, string> = Object.fromEntries(getZvazy().map((z) => [z.id, z.nazov]));
  const vals = porovnanieValues('rfz', slug);
  const regions: MapRegion[] = mapa.rfz.map((r) => {
    const id = geo[r.name];
    return { id, name: nazvy[id] ?? r.name, path: r.path, values: vals[id] ?? {} };
  });
  return { viewBox: mapa.viewBox, slovensko: mapa.slovensko, regions };
}
