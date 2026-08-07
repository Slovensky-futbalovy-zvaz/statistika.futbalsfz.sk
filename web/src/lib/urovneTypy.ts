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
   * Riadky zbalené do jedného reťazca — šestice oddelené `;`, čísla `,`:
   * `zvazIdx,sezonaIdx,urovenIdx,kategoriaIdx,pohlavieIdx,pocetSutazi`.
   * Pole polí by Astro serializovalo do stránky s obalom `[0, x]` okolo každého
   * čísla (pri 38 ObFZ × 15 sezónach ~150 kB), reťazec má ~pätinu.
   */
  rows: string;
  /** Posledná kompletná sezóna; sezóny za ňou sú prebiehajúce. */
  poslednaKompletna: string;
}

export const POHLAVIA_PORADIE = ['M', 'F', 'NEURCENE'];

/** Rozbalí `UrovneVCase.rows` späť na šestice čísel. */
export function rozbal(rows: string): number[][] {
  if (!rows) return [];
  return rows.split(';').map((r) => r.split(',').map(Number));
}
