# ADR-0001: Predgenerované JSON namiesto živého API

**Stav:** navrhnuté (čaká na potvrdenie po F0/F1) · **Dátum:** 12. 7. 2026 · **Rozhoduje:** Ján Letko (PO) + Sportnet

## Kontext

Verejný portál statistika.futbalsfz.sk potrebuje agregované štatistiky zo systému Sportnet (MongoDB `sutaze`; existujú aj API Súťaže v2 a CRM API). Verejná aplikácia nesmie mať priamy prístup k produkčnej databáze. API vracia primárne dáta (súťaže, zápasy), nie agregáty typu „unikátni hráči U15 za sezónu“ — tie by musel niekto počítať pri každej návšteve.

## Zvažované varianty

- **A — živé volania API:** real-time dáta, ale vyžaduje novú backend službu (agregácie, cache, autorizácia), verejnú expozíciu infraštruktúry a trvalú prevádzku.
- **B — predgenerované JSON:** interný ETL periodicky vygeneruje agregáty do statických súborov; web je čisto statický.
- **C — hybrid:** B + historické sezóny sa generujú raz, aktuálna sezóna denne; API vrstva sa doplní, len ak vznikne funkcia s reálnou potrebou živých dát.

## Rozhodnutie

**Variant C.** Sezónne štatistiky sa menia pomaly (jedno kolo týždenne) — real-time neprináša hodnotu úmernú nákladom a rizikám.

## Dôsledky

**Pozitívne:** okamžitá odozva (CDN), minimálne prevádzkové náklady, nulová expozícia interných systémov, web funguje aj pri výpadku zdroja, ETL stavia na existujúcich odladených agregáciách.

**Negatívne / kompromisy:** dáta aktuálne max. k poslednému ETL behu (akceptované — časová pečiatka pri každom pohľade); potreba spoľahlivej automatizácie ETL s validáciou a alertingom.

**Otvorené:** či ETL číta priamo MongoDB alebo Sportnet API (otázka O2, rozhodne dátový audit vo F1 podľa výkonu a garancií stability schémy).
