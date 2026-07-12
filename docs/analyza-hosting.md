# Analýza hostingu a nasadenia (O3)

**Dátum:** 12. 7. 2026 · **Autor:** Claude + Ján Letko (PO) · **Stav:** návrh na rozhodnutie

Vstupné fakty: architektúra je statická (ADR-0001 — predgenerované JSON + SSG web, žiadny backend); DNS zóny futbalsfz.sk spravuje PO (nie je prekážka); repo žije na GitHube (private, org Slovensky-futbalovy-zvaz); vývoj/prevádzku platformy zabezpečuje Bart.sk, dáta Sportnet Media (O1); ETL potrebuje read-only prístup k MongoDB (ADR-0002), teda beží najlepšie blízko databázy, nie na verejnom hostingu.

## Čo hosting musí spĺňať

Web = statické súbory (HTML/JS/CSS + `data/*.json`, rádovo stovky MB pri 43 zväzoch × 13 sezónach + demografia). Potrebujeme: subdoménu `statistika.futbalsfz.sk` s HTTPS, CDN (rýchla odozva aj pri špičkách po zverejnení), automatický deploy z git repa, riadenie cache (JSON sa mení denne), a nulovú expozíciu interných systémov.

## Varianty

### A — Cloudflare Pages (odporúčané)

Statický hosting s globálnou CDN, deploy priamo z GitHub repa (build SSG pri každom pushi), vlastná doména s automatickým certifikátom, jemné riadenie cache (`_headers`), neobmedzená šírka pásma aj na free pláne. Ak by časom vznikla potreba drobnej dynamiky (napr. vyhľadávanie), doplní sa Workers/R2 bez zmeny architektúry. PO už Cloudflare používa (DNS), takže správa je na jednom mieste.

- **Pre:** náklady ~0 €, DNS aj CDN u jedného správcu (PO), git-based deploy, výkon.
- **Proti:** tretí vendor mimo Sportnet ekosystému (akceptovateľné — sú to len verejné agregáty).

### B — GitHub Pages + Actions

Deploy z repa cez Actions. Jednoduché, ale slabšie riadenie cache a redirectov, Pages z private repa vyžaduje platený plán organizácie a CDN výkon je slabší než Cloudflare.

- **Pre:** všetko v GitHube.
- **Proti:** menej kontroly nad cache/doménou, limity veľkosti (1 GB soft limit je blízko nášmu rastu dát).

### C — Vercel / Netlify

Komfortný DX, náhľadové deploye. Free tier má limity šírky pásma (rádovo 100 GB/mes.) — verejný portál SFZ ich po mediálnom zdieľaní môže prekročiť; platené plány sú per-seat a drahšie než A.

- **Pre:** najlepší DX pre frontend tím.
- **Proti:** náklady/limity, ďalší vendor bez inej väzby na projekt.

### D — Infraštruktúra Sportnet/Bart.sk

Web by bežal tam, kde ostatné služby platformy. Konzistentné s prevádzkou (Bart.sk), ale statický web na aplikačnej infraštruktúre je zbytočná prevádzková záťaž (patching, monitoring, CDN by sa aj tak riešila zvlášť) a viaže kapacitu Bart.sk na nízku pridanú hodnotu.

- **Pre:** jednotná prevádzka, žiadny nový vendor.
- **Proti:** najdrahšie na kapacitu, žiadna výhoda pre čisto statický obsah.

## ETL beh (spoločné pre všetky varianty)

ETL (`etl/run.py`) beží ako denný cron **na infraštruktúre Sportnet/Bart.sk blízko MongoDB** (read-only účet, ADR-0002). Výstupné JSON commitne do git repa (audit trail zmien dát zadarmo) → push spustí deploy webu. Historické sezóny sa generujú raz, denne len aktuálna sezóna — beh je krátky (minúty).

## Odporúčanie

**Variant A — Cloudflare Pages** pre web + CDN, **ETL ako cron u Sportnet/Bart.sk** s výstupom cez git. DNS záznam `statistika.futbalsfz.sk` → Pages doplní PO. Rozhodnutie navrhujeme potvrdiť s Bart.sk (security review pipeline: GitHub Actions → Pages) a zapísať ako ADR-0003.

| Kritérium | A Cloudflare | B GitHub Pages | C Vercel/Netlify | D Sportnet infra |
|---|---|---|---|---|
| Náklady | ~0 € | plán org | free tier limity | kapacita Bart.sk |
| CDN výkon | ★★★ | ★★ | ★★★ | ★ (bez CDN) |
| Deploy z GitHubu | áno | áno | áno | build pipeline na mieru |
| Riadenie cache | plné | obmedzené | plné | plné |
| Nový vendor | nie (DNS už CF) | nie | áno | nie |
