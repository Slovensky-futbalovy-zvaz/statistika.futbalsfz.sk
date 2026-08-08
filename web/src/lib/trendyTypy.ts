// Typy a čisté funkcie pre Trendy (vekové zloženie) a Index klubu —
// ZDIEĽANÉ SO SERVEROM AJ S PREHLIADAČOM.
//
// POZOR: tento súbor nesmie nikdy importovať `./data` ani nič z Node (`fs`,
// `path`, `process`). React komponenty z neho berú výpočtové funkcie, takže sa
// zabalí do klientskeho bundlu — rovnaké pravidlo ako pri `urovneTypy.ts`
// (7. 8. 2026 to raz zhodilo celý island na `process is not defined`).

/** Histogram: veková úroveň osoby → počet zápisov hráčov. */
export type Histogram = Record<string, number>;

/** Kompaktný rez vekového vývoja pre React island. */
export interface VekVCase {
  sezony: string[];
  /** Subjekty (zväzy alebo kluby) v poradí. */
  subjekty: { id: string; nazov: string }[];
  /**
   * Rezy podľa úrovne ligy. Index 0 je vždy celok (všetky súťaže dospelých),
   * ďalšie sú kódy úrovní (`L1`…`L9`, `L10P`, `POHARE`, `NEURCENE`).
   */
  urovne: string[];
  /**
   * Riadky zbalené do reťazca — šestice oddelené `;`, čísla `,`:
   * `subjektIdx,sezonaIdx,urovenIdx,median,priemer×100,pocetZapisov`.
   * Dôvod reťazca: pole polí by Astro serializovalo s obalom `[0, x]` okolo
   * každého čísla (rovnaká lekcia ako pri `urovneTypy.ts`).
   */
  rows: string;
  poslednaKompletna: string;
}

export interface VekStat {
  /** Počet zápisov (jeden zápis = jeden hráč v jednom zápase). */
  n: number;
  /** Medián vekovej úrovne osoby — hlavné číslo (rozhodnutie Ján Letko). */
  median: number;
  priemer: number;
  p25: number;
  p75: number;
  /** Podiel zápisov hráčov do 21 rokov vrátane. */
  doU21: number;
  /** Podiel zápisov hráčov 35 a viac. */
  nad35: number;
}

/** Prah, pod ktorým sa hodnoty nezobrazujú (rozhodnutie Ján Letko: 100 zápisov). */
export const PRAH_ZAPISOV = 100;

/**
 * Percentil z histogramu. Histogram je {vek: početZápisov}, takže percentil sa
 * počíta nad rozvinutým radom — hráč s 25 zápismi váži 25×.
 */
function percentil(dvojice: [number, number][], n: number, q: number): number {
  const ciel = q * n;
  let kum = 0;
  for (const [vek, poc] of dvojice) {
    kum += poc;
    if (kum >= ciel) return vek;
  }
  return dvojice.length ? dvojice[dvojice.length - 1][0] : 0;
}

/** Súhrnné štatistiky z histogramu. `null`, ak je pod prahom alebo prázdny. */
export function statistiky(h: Histogram | undefined): VekStat | null {
  if (!h) return null;
  const dvojice = Object.entries(h)
    .map(([v, n]) => [Number(v), n] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const n = dvojice.reduce((s, [, p]) => s + p, 0);
  if (n < PRAH_ZAPISOV) return null;

  let suma = 0;
  let mladi = 0;
  let stari = 0;
  for (const [vek, poc] of dvojice) {
    suma += vek * poc;
    if (vek <= 21) mladi += poc;
    if (vek >= 35) stari += poc;
  }
  return {
    n,
    median: percentil(dvojice, n, 0.5),
    priemer: suma / n,
    p25: percentil(dvojice, n, 0.25),
    p75: percentil(dvojice, n, 0.75),
    doU21: mladi / n,
    nad35: stari / n,
  };
}

/** Zlúči viac histogramov do jedného (napr. muži + ženy, alebo viac súťaží). */
export function zluc(...hs: (Histogram | undefined)[]): Histogram {
  const out: Histogram = {};
  for (const h of hs) {
    if (!h) continue;
    for (const [v, n] of Object.entries(h)) out[v] = (out[v] ?? 0) + n;
  }
  return out;
}

/**
 * Sklon lineárnej regresie cez body (index sezóny, hodnota) — rokov za sezónu.
 * Kladné číslo znamená, že vek rastie (klub starne).
 */
export function sklon(hodnoty: (number | null)[]): number | null {
  const body = hodnoty
    .map((v, i) => [i, v] as [number, number | null])
    .filter((b): b is [number, number] => b[1] !== null);
  if (body.length < 2) return null;
  const n = body.length;
  const sx = body.reduce((s, [x]) => s + x, 0);
  const sy = body.reduce((s, [, y]) => s + y, 0);
  const sxy = body.reduce((s, [x, y]) => s + x * y, 0);
  const sxx = body.reduce((s, [x]) => s + x * x, 0);
  const menovatel = n * sxx - sx * sx;
  if (!menovatel) return null;
  return (n * sxy - sx * sy) / menovatel;
}

// ---- Index klubu ----

export interface IndexZlozky {
  A: number; // šírka mládeže (30)
  B: number; // deti v mládeži (25)
  C: number; // počet družstiev mládeže (15)
  D: number; // kontinuita (15)
  E: number | null; // prechod do dospelých (15); null = klub nemá dospelých
}

export interface IndexDetaily {
  skupiny: number;
  deti: number;
  druzstvaMladez: number;
  sezonPoSebe: number;
  podielMladych: number | null;
  zapisovDospeli: number;
}

export interface IndexSezona {
  index: number;
  /** ok | bez-dospelych | bez-mladeze */
  stav: string;
  zlozky: IndexZlozky;
  detaily: IndexDetaily;
}

export interface IndexKlubu {
  klub: string;
  nazov: string;
  sezony: Record<string, IndexSezona>;
}

export interface IndexPrehladRiadok {
  klub: string;
  nazov: string;
  sezona: string;
  index: number;
  stav: string;
  zlozky: IndexZlozky;
  detaily: IndexDetaily;
}

/** Popisy zložiek indexu — vysvetlivky sa zobrazujú pri každom výskyte (Ján Letko). */
export const ZLOZKY_POPIS: Record<keyof IndexZlozky, { nazov: string; max: number; popis: string }> = {
  A: {
    nazov: 'Šírka mládeže',
    max: 30,
    popis:
      'Koľko z troch vekových skupín — dorast, žiaci, prípravky — má klub obsadených. ' +
      'Klub, ktorý má len prípravku, dieťa po jedenástke stratí: musí prejsť inam. ' +
      'Súvislá cesta od prípravky po dorast je pre rodiča najpodstatnejšia informácia, ' +
      'preto má táto zložka najvyššiu váhu.',
  },
  B: {
    nazov: 'Deti v mládeži',
    max: 25,
    popis:
      'Počet detí, ktoré za klub v sezóne hrali. Hranice sú nastavené podľa toho, ako sú ' +
      'na tom kluby na Slovensku: polovica klubov má do 36 detí, desatina má viac než 130.',
  },
  C: {
    nazov: 'Počet družstiev mládeže',
    max: 15,
    popis:
      'Dve prípravky namiesto jednej znamenajú, že sa na hru dostane viac detí. Táto zložka ' +
      'oceňuje kluby, ktoré majú v tej istej vekovej kategórii viac družstiev.',
  },
  D: {
    nazov: 'Kontinuita',
    max: 15,
    popis:
      'Koľko sezón po sebe má klub mládež. Odlišuje dlhodobú prácu od prípravky, ktorá sa ' +
      'prihlási na jednu sezónu a zanikne. Pre rodiča je to odpoveď na otázku, či tam dieťa ' +
      'bude môcť zostať.',
  },
  E: {
    nazov: 'Prechod do dospelých',
    max: 15,
    popis:
      'Koľko mladých hráčov do 21 rokov sa dostane do dospelého družstva. Jediná zložka, ktorá ' +
      'meria, či výchova k niečomu vedie — klub môže mať päť mládežníckych družstiev, ale ak ' +
      'v A-mužstve nehrá ani jeden vlastný dvadsaťročný, niečo v prechode nefunguje.',
  },
};

/** Čo index nemeria — text sa zobrazuje pri každom výskyte indexu (rozhodnutie Ján Letko). */
export const INDEX_LIMITY =
  'Index klubu meria mládežnícku základňu klubu a jej udržateľnosť. Nehovorí nič o kvalite ' +
  'trénerskej práce, o zázemí, o prístupe k deťom ani o športovej úspešnosti — tie údaje ' +
  'v dátach nie sú. Systematicky tiež zvýhodňuje veľké kluby: klub s jedným družstvom prípravky ' +
  'nikdy nedosiahne skóre mestského klubu so šiestimi družstvami, hoci pre dieťa z tej obce ' +
  'môže byť jedinou dostupnou a veľmi dobrou voľbou.';
