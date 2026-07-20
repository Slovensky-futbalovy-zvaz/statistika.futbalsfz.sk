// Farebné palety a konštanty (design handoff). Bez závislostí.

export const REGION: Record<string, string> = {
  bfz: '#1450df',
  zsfz: '#2f9bff',
  ssfz: '#12a06b',
  vsfz: '#f0961b',
};

export const RFZ_LABEL: Record<string, string> = {
  bfz: 'Bratislavský FZ',
  zsfz: 'Západoslovenský FZ',
  ssfz: 'Stredoslovenský FZ',
  vsfz: 'Východoslovenský FZ',
};

/** Mapovanie geoName RFZ (v mapa.json) → id zväzu. */
export const RFZ_OF_GEONAME: Record<string, string> = {
  BA: 'bfz',
  ZsFZ: 'zsfz',
  SsFZ: 'ssfz',
  VsFZ: 'vsfz',
};

/** Farby úrovní (sunburst osôb). SFZ modrá / RFZ zelená / ObFZ oranžová. */
export const LEVEL_COLOR: Record<string, string> = {
  SFZ: '#1450df',
  RFZ: '#12a06b',
  ObFZ: '#f0961b',
};

export interface Group {
  key: string;
  cats: string[];
  color: string;
}

export const GROUPS: Group[] = [
  { key: 'Dospelí', cats: ['ADULTS'], color: '#1450df' },
  { key: 'Dorast', cats: ['U19', 'U18', 'U17', 'U16'], color: '#2f9bff' },
  { key: 'Žiaci', cats: ['U15', 'U14', 'U13', 'U12'], color: '#12a06b' },
  { key: 'Prípravky', cats: ['U11', 'U10', 'U09', 'U08', 'U07'], color: '#f0961b' },
];

export const GROUP_COLOR: Record<string, string> = Object.fromEntries(
  GROUPS.map((g) => [g.key, g.color]),
);

/** Skupina pre ageCategory (ADULTS/U19…) → názov skupiny. */
export function skupinaKategorie(cat: string): string | undefined {
  return GROUPS.find((g) => g.cats.includes(cat))?.key;
}

export const PALETTE = [
  '#1450df',
  '#ec1c24',
  '#12a06b',
  '#f0961b',
  '#7a44e0',
  '#2f9bff',
  '#d6336c',
  '#0a7d63',
  '#b45309',
  '#0891b2',
  '#8b5cf6',
  '#65a30d',
  '#5b6470',
];

export interface Metric {
  k: string;
  label: string;
}

export const METRICS: Metric[] = [
  { k: 'zapasy', label: 'Zápasy' },
  { k: 'druzstva', label: 'Družstvá' },
  { k: 'goly', label: 'Góly' },
  { k: 'divaci', label: 'Diváci' },
  { k: 'hraci', label: 'Hráči' },
];

/** 7 osí radaru pre priame porovnanie. */
export const METRICS7: Metric[] = [
  { k: 'zapasy', label: 'Zápasy' },
  { k: 'divaciNaZapas', label: 'Diváci/zápas' },
  { k: 'golyNaZapas', label: 'Góly/zápas' },
  { k: 'divaci', label: 'Diváci' },
  { k: 'hraci', label: 'Hráči' },
  { k: 'goly', label: 'Góly' },
  { k: 'druzstva', label: 'Družstvá' },
];

export const ROLA_LABEL: Record<string, string> = {
  hraci: 'Hráči',
  treneri: 'Tréneri',
  realizacnyTim: 'Realizačný tím',
  rozhodcovia: 'Rozhodcovia',
  delegati: 'Delegáti',
  personal: 'Personál',
};
export const ROLY_PORADIE = ['hraci', 'treneri', 'realizacnyTim', 'rozhodcovia', 'delegati', 'personal'];
