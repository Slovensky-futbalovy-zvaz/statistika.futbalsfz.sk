# ADR-0003: Hosting na Cloudflare Pages, ETL ako cron u Sportnet/Bart.sk

**Stav:** rozhodnuté · **Dátum:** 12. 7. 2026 · **Rozhodol:** Ján Letko (PO) — uzatvára otázku O3 z projektového plánu

## Kontext

Architektúra je čisto statická (ADR-0001): predgenerované JSON + SSG web, žiadny backend. DNS zóny futbalsfz.sk spravuje PO na Cloudflare. Repo je na GitHube (private, org Slovensky-futbalovy-zvaz). Porovnanie štyroch variantov hostingu je v [docs/analyza-hosting.md](../analyza-hosting.md).

## Rozhodnutie

- **Web + CDN: Cloudflare Pages.** Deploy priamo z GitHub repa (build SSG pri pushi na main), vlastná doména `statistika.futbalsfz.sk` s automatickým certifikátom, riadenie cache cez `_headers`, náklady ~0 €.
- **ETL: denný cron na infraštruktúre Sportnet/Bart.sk** blízko MongoDB (read-only účet, ADR-0002). Výstupné JSON commituje do git repa — audit trail zmien dát; push spúšťa deploy webu.
- DNS záznam doplní PO.

## Dôsledky

**Pozitívne:** DNS aj CDN u jedného správcu (PO), nulové náklady na hosting, globálny výkon aj pri mediálnych špičkách, história dát v gite, žiadna expozícia interných systémov.

**Negatívne / kompromisy:** závislosť od Cloudflare (nízke riziko — statický obsah je prenositeľný kamkoľvek za hodiny); rast repa s dennými commitmi JSON (mitigácia: commituje sa len aktuálna sezóna, historické sezóny sa negenerujú opakovane).

**Nadväzuje:** potvrdiť s Bart.sk security review deploy pipeline (GitHub → Cloudflare Pages) a zriadiť read-only DB účet pre produkčný ETL beh.
