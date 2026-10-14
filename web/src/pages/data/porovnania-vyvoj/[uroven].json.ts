// Statický JSON endpoint s dátami grafu „Vývoj v čase“ v porovnaní zväzov (všetky sezóny úrovne).
// Zámerne mimo HTML: dáta sú rovnaké pre každú sezónu porovnania (~1 MB), preto boli predtým
// vložené do každej stránky /porovnania/{uroven}/{sezona}. Komponent si ich stiahne až pri
// priblížení k sekcii a prehliadač ich drží v cache pre všetky sezóny.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getBumpDataObfz, getBumpDataRfz } from '../../../lib/data';

export const getStaticPaths: GetStaticPaths = () => [{ params: { uroven: 'obfz' } }, { params: { uroven: 'rfz' } }];

export const GET: APIRoute = ({ params }) => {
  const data = params.uroven === 'obfz' ? getBumpDataObfz() : getBumpDataRfz();
  return new Response(JSON.stringify({ hodnoty: data.hodnoty, kat: data.kat }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
