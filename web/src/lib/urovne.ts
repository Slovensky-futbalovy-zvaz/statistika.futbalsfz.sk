// Úrovne súťaže v čase — podklad pre heatmapu zväzov, graf vývoja počtu súťaží
// danej úrovne a plošný graf pyramídy jedného zväzu (7. 8. 2026).
//
// Číta len predgenerované JSON (data/porovnania a data/zvaz) pri BUILDE, rovnako
// ako zvyšok dátovej vrstvy. Výsledok je zámerne kompaktný — číselné indexy
// namiesto reťazcov — aby payload React islandu ostal malý aj pri 38 ObFZ × 15 sezón.
import type { UrovenRiadok } from './data';
import {
  getPorovnanie,
  getZvaz,
  getProfil,
  poslednaKompletnaSlug,
  sezonyUrovne,
} from './data';
import { GROUPS, UROVEN_PORADIE } from './palette';
import { POHLAVIA_PORADIE, type UrovneVCase } from './urovneTypy';

// Typy a `rozbal()` žijú v `urovneTypy.ts`, aby si ich mohli importovať React
// komponenty bez toho, aby sa im do bundlu dostala dátová vrstva (fs/path).
// Tu sa len re-exportujú pre .astro stránky.
export type { UrovneVCase } from './urovneTypy';
export { POHLAVIA_PORADIE, rozbal } from './urovneTypy';
export type { UrovenRiadok } from './data';

/** Index vekovej kategórie pre vekovú úroveň (ADULTS, U19…); mimo GROUPS = Ostatné. */
function kategoriaVeku(kat: string): number {
  const i = GROUPS.findIndex((g) => g.cats.includes(kat));
  return i < 0 ? GROUPS.length : i;
}

/** Spoločné zostavenie kompaktného rezu z funkcie, ktorá vráti riadky pre (zväz, sezóna). */
function zostav(
  zvazy: { id: string; nazov: string }[],
  sezony: string[],
  citaj: (zvazId: string, sezona: string) => UrovenRiadok[] | undefined,
): UrovneVCase {
  const kategorie = [...GROUPS.map((g) => g.key), 'Ostatné'];
  const pouzite = new Set<string>();
  interface Surovy { zi: number; si: number; kod: string; k: number; g: number; n: number; sk: number }
  const surove: Surovy[] = [];

  zvazy.forEach((z, zi) =>
    sezony.forEach((s, si) => {
      const riadky = citaj(z.id, s);
      if (!riadky?.length) return;
      // agregácia na (úroveň, kategória, pohlavie) — vekové úrovne sa v rámci
      // kategórie sčítajú; presný rez po vekovej úrovni rieši pyramída na profile
      const acc = new Map<string, [number, number]>();
      for (const r of riadky) {
        const gi = POHLAVIA_PORADIE.indexOf(r.pohlavie);
        const kluc = `${r.uroven}|${kategoriaVeku(r.kat)}|${gi < 0 ? 2 : gi}`;
        const [a, b] = acc.get(kluc) ?? [0, 0];
        acc.set(kluc, [a + r.sutaze, b + (r.skupiny ?? r.sutaze)]);
        pouzite.add(r.uroven);
      }
      for (const [kluc, [n, sk]] of acc) {
        const [kod, k, g] = kluc.split('|');
        surove.push({ zi, si, kod, k: Number(k), g: Number(g), n, sk });
      }
    }),
  );

  const urovne = UROVEN_PORADIE.filter((u) => pouzite.has(u));
  const rows = surove
    .map((r) => `${r.zi},${r.si},${urovne.indexOf(r.kod)},${r.k},${r.g},${r.n},${r.sk}`)
    .join(';');

  return {
    sezony,
    zvazy,
    urovne,
    kategorie,
    rows,
    poslednaKompletna: poslednaKompletnaSlug().replace('-', '/'),
  };
}

/** Rez pre celú úroveň porovnania (rfz / obfz) naprieč všetkými jej sezónami. */
export function getUrovneVCase(urovenSlug: string): UrovneVCase {
  const slugy = sezonyUrovne(urovenSlug).slice().sort(); // vzostupne
  const sezony = slugy.map((s) => s.replace('-', '/'));
  const cache = new Map<string, Map<string, UrovenRiadok[]>>();
  const nazvy = new Map<string, string>();

  slugy.forEach((slug, i) => {
    const por = getPorovnanie(urovenSlug, slug);
    const m = new Map<string, UrovenRiadok[]>();
    for (const r of por.zvazy) {
      nazvy.set(r.id, r.nazov);
      if (r.sutazeUroven?.length) m.set(r.id, r.sutazeUroven);
    }
    cache.set(sezony[i], m);
  });

  const zvazy = [...nazvy.entries()].map(([id, nazov]) => ({ id, nazov }));
  zvazy.sort((a, b) => a.nazov.localeCompare(b.nazov, 'sk'));
  return zostav(zvazy, sezony, (id, s) => cache.get(s)?.get(id));
}

/** Rez pre jeden zväz naprieč jeho sezónami (plošný graf na profile). */
export function getUrovneVCaseZvazu(zvazId: string): UrovneVCase {
  const z = getZvaz(zvazId);
  if (!z) return { sezony: [], zvazy: [], urovne: [], kategorie: [], rows: '', poslednaKompletna: '' };
  const sezony = [...z.sezony].sort();
  return zostav([{ id: z.id, nazov: z.nazov }], sezony, (_id, s) => {
    try {
      return getProfil(z.id, s).sutazeUroven;
    } catch {
      return undefined;
    }
  });
}
