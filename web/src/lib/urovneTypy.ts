// Typy a čisté funkcie pre rez „úrovne súťaže v čase“ — ZDIEĽANÉ SO SERVEROM
// AJ S PREHLIADAČOM.
//
// POZOR: tento súbor nesmie nikdy importovať `./data` ani nič z Node (`fs`,
// `path`, `process`). React komponenty z neho berú `rozbal()`, takže sa zabalí
// do klientskeho bundlu. Keď boli tieto funkcie ešte v `urovne.ts` (ktorý číta
// JSON zo súborov), Vite pribalil do prehliadača aj dátovú vrstvu a stránka
// padala na `ReferenceError: process is not defined` — island sa nehydratoval
// a filtre nereagovali (nájdené 7. 8. 2026 na produkcii).
//
// Dátovú časť (getUrovneVCase, getUrovneVCaseZvazu) drží `urovne.ts`, ktorý
// tieto typy re-exportuje pre .astro stránky.

export interface UrovneVCase {
  /** Sezóny vzostupne, v tvare RRRR/RRRR. */
  sezony: string[];
  zvazy: { id: string; nazov: string }[];
  /** Kódy úrovní (L1…NEURCENE) — len tie, ktoré sa v dátach vyskytujú. */
  urovne: string[];
  /** Vekové kategórie: Dospelí / Dorast / Žiaci / Prípravky / Ostatné. */
  kategorie: string[];
  /**
   * Riadky zbalené do jedného reťazca — sedmice oddelené `;`, čísla `,`:
   * `zvazIdx,sezonaIdx,urovenIdx,kategoriaIdx,pohlavieIdx,pocetSutazi,pocetSkupin`.
   * `pocetSkupin` sú základné časti súťaží (Ján Letko, 8. 8. 2026) — jedna súťaž
   * môže mať viac paralelných skupín, nadstavbové časti sa nerátajú.
   * Pole polí by Astro serializovalo do stránky s obalom `[0, x]` okolo každého
   * čísla (pri 38 ObFZ × 15 sezónach ~150 kB), reťazec má ~pätinu.
   */
  rows: string;
  /** Posledná kompletná sezóna; sezóny za ňou sú prebiehajúce. */
  poslednaKompletna: string;
}

export const POHLAVIA_PORADIE = ['M', 'F', 'NEURCENE'];

/** Metrika počtu súťaží: zastrešujúca súťaž alebo súťažná skupina (základná časť). */
export type MetrikaSutazi = 'sutaze' | 'skupiny';

/** Predvolená metrika je SKUPINA (rozhodnutie Ján Letko, 8. 8. 2026). */
export const METRIKA_DEFAULT: MetrikaSutazi = 'skupiny';

export const METRIKA_POPIS: Record<MetrikaSutazi, { label: string; popis: string }> = {
  skupiny: {
    label: 'Skupiny',
    popis:
      'Súťažná skupina je to, v čom sa reálne hrá — má vlastných účastníkov a vlastnú tabuľku. ' +
      'Jedna súťaž ich môže mať viac: IV. liga U19 ZsFZ má šesť skupín A–F. ' +
      'Nadstavbové časti (kvalifikácia, skupina o postup) sa do počtu nerátajú.',
  },
  sutaze: {
    label: 'Súťaže',
    popis:
      'Súťaž je zastrešujúci celok tak, ako ho vypisuje riadiaci zväz — má jednu úroveň, ' +
      'jednu vekovú úroveň a jedno pohlavie. Všetky jej skupiny sa rátajú ako jedna položka.',
  },
};

/** Rozbalí `UrovneVCase.rows` späť na sedmice čísel. */
export function rozbal(rows: string): number[][] {
  if (!rows) return [];
  return rows.split(';').map((r) => r.split(',').map(Number));
}
