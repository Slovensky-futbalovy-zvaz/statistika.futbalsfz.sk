// Statický JSON endpoint s KOMPLETNÝM zoznamom klubov danej sezóny (priame
// porovnanie klubov). Zámerne mimo Astro stránky (bez embed do HTML) — klient
// si ho natiahne fetch-om až pri otvorení záložky "Kluby" v Porovnaniach,
// keďže obsahuje tisícky riadkov (~1–1.5 MB/sezóna). Dáta = data/porovnania/kluby
// (etl/porovnania_kluby.py), bez DB prístupu za behu (ADR-0001).
import type { APIRoute, GetStaticPaths } from 'astro';
import { getPorovnanieKlubySezony, getPorovnanieKluby } from '../../../lib/data';

export const getStaticPaths: GetStaticPaths = () =>
  getPorovnanieKlubySezony().map((sezona) => ({ params: { sezona } }));

export const GET: APIRoute = ({ params }) => {
  const data = getPorovnanieKluby(params.sezona!);
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
