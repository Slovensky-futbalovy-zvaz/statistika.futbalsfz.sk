// Dátová vrstva — číta predgenerované JSON zo susedného priečinka ../data
// pri BUILDE (Node fs). Web nemá žiadny runtime prístup k dátam ani DB (ADR-0001).
import fs from 'node:fs';
import path from 'node:path';

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
  zapasy: number;
  druzstva: number;
  goly: number;
  divaci: number;
  zlteKarty: number;
  cerveneKarty: number;
}

export interface Kategoria {
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

export interface Profil {
  zvaz: string;
  sezona: string;
  sportSector: string;
  generatedAt: string;
  methodologyFlags: Record<string, unknown>;
  kpi: Kpi;
  kategorie: Record<string, Kategoria>;
  pohlavie: Record<string, unknown>;
  osoby: Record<string, OsobaSkupina>;
}

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
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
  zapasy: number;
  druzstva: number;
  goly: number;
  divaci: number;
  zlteKarty: number;
  cerveneKarty: number;
  hraci: number;
  golyNaZapas: number;
  divaciNaZapas: number;
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

/** Sezóny dostupné pre danú úroveň (zostupne), na prepínač. */
export function sezonyUrovne(urovenSlug: string): string[] {
  return getPorovnaniaZoznam()
    .filter((p) => p.urovenSlug === urovenSlug)
    .map((p) => p.sezonaSlug)
    .sort()
    .reverse();
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
