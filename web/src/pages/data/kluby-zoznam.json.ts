// Statický JSON endpoint so zoznamom všetkých klubov pre vyhľadávanie (KlubPicker).
// Zámerne mimo HTML: predtým bol celý zoznam (~1 MB) vložený do KAŽDEJ stránky klubu;
// klient si ho stiahne až pri otvorení výberu klubu a prehliadač ho drží v cache.
// Kompaktný tvar riadku: [id, názov, zväz, posledná sezóna ako slug "RRRR-RRRR"].
import type { APIRoute } from 'astro';
import { getKluby } from '../../lib/data';

export const GET: APIRoute = () => {
  const rows = getKluby().map((k) => [
    k.id,
    k.nazov,
    k.zvazNazov,
    (k.sezony?.[k.sezony.length - 1] ?? '').replace('/', '-'),
  ]);
  return new Response(JSON.stringify(rows), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
