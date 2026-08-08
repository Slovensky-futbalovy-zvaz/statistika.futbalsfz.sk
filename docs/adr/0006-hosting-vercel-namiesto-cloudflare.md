# ADR-0006: Hosting webu na Vercel namiesto Cloudflare — DNS zostáva na WebSupport

**Stav:** rozhodnuté · **Dátum:** 19. 7. 2026 · **Rozhodol:** Ján Letko (PO) — mení časť ADR-0003 (web + CDN)

## Kontext

ADR-0003 predpokladal, že DNS zóna `futbalsfz.sk` je spravovaná PO priamo na Cloudflare. Pri realizácii nasadenia (19. 7. 2026) sa zistilo, že predpoklad neplatí:

- Overené cez verejné DNS (`dig`/DoH): `futbalsfz.sk` má nameservery **`ns1–3.websupport.sk`** — zóna je u registrátora WebSupport, nie na Cloudflare.
- MX záznamy smerujú na **Microsoft 365** (`futbalsfz-sk.mail.protection.outlook.com`) — firemný email SFZ beží priamo na tejto doméne.

Cloudflare medzičasom (nezávisle od tohto projektu) zlúčil Pages do Workers (static assets) — nasadenie sa vyskúšalo touto cestou a **funguje** (`web/wrangler.jsonc`, git-connected Worker, https://statistika-futbalsfz-sk.jan-letko.workers.dev, 657 stránok). Problém nie je Cloudflare ako platforma, ale pripojenie vlastnej domény: Cloudflare **Custom Domain** vyžaduje, aby zóna `futbalsfz.sk` bola aktívna priamo v danom Cloudflare účte. Na Free/Pro pláne to znamená zmenu nameserverov pre **celú doménu**, čo by preniesolo správu DNS aj pre produkčný email (M365) a čokoľvek iné na doméne — vysoké riziko výpadku mimo rozsah a kontrolu tohto projektu. (Čiastočná/CNAME delegácia zóny existuje, ale je len na Enterprise pláne Cloudflare.)

**Rozhodnutie PO (19. 7. 2026): doména `futbalsfz.sk` sa na Cloudflare (ani inam) nepresúva za žiadnych okolností.**

## Rozhodnutie

- **Web + CDN: Vercel** namiesto Cloudflare Pages/Workers. Git-connected projekt `statistika-futbalsfz-sk` (tím `ltksolutions-projects`), Root Directory `web`, framework Astro auto-detekovaný, deploy pri pushi na `main` — rovnaký princíp ako v ADR-0003, iná platforma.
- **Vlastná doména cez CNAME na existujúcom DNS.** Vercel (na rozdiel od Cloudflare Custom Domain) vie vydať platný certifikát a servovať vlastnú doménu len na základe **CNAME záznamu** na ľubovoľnom externom DNS — zóna `futbalsfz.sk` **zostáva bez zmeny na WebSupport**, nameservery sa nemenia, email cez M365 je nedotknutý. Pridaný jeden záznam: `statistika.futbalsfz.sk CNAME <vercel-pridelený-cieľ>`.
- **Cloudflare Worker nasadenie ostáva bokom** (nemaže sa) — `https://statistika-futbalsfz-sk.jan-letko.workers.dev` funguje ako záložná/testovacia URL, `web/wrangler.jsonc` zostáva v repe pre prípad budúcej potreby (napr. ak sa raz rozhodne o migrácii DNS).
- ETL časť ADR-0003 (denný cron na infraštruktúre Sportnet/Bart.sk) sa **nemení** — týka sa DB prístupu, nie hostingu webu.

## Dôsledky

**Pozitívne:** žiadny zásah do produkčného DNS/emailu SFZ; vlastná doména aj tak funguje (CNAME); Vercel git-integrácia je rovnako automatická ako plánovaná Cloudflare Pages integrácia (deploy pri push na `main`); Cloudflare nasadenie zostáva ako funkčná záloha bez dodatočnej práce.

**Negatívne / kompromisy:** dva aktívne hostingové ciele (Vercel produkčný + Cloudflare Worker bokom) — mierne viac údržby (dependency `wrangler` v `package.json`, `wrangler.jsonc` v repe); ak raz bude potrebné oba zosúladiť alebo jeden odstrániť, treba explicitné rozhodnutie PO (nič sa nemaže bez povolenia).

**Nadväzuje:** `docs/archiv/cloudflare-pages-nasadenie.md` zostáva ako referencia pre Cloudflare cestu (pre prípad budúcej DNS migrácie); tento ADR je zdroj pravdy pre aktuálny produkčný hosting.
