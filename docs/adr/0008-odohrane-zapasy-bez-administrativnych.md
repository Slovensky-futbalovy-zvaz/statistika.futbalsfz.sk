# ADR-0008: Odohraté zápasy — vylúčenie administratívnych kontumácií a odstúpení bez zápisu

**Stav:** Prijaté · **Dátum:** 2026-07-22 · **PO:** Ján Letko

## Kontext

Kontumácia v Sportnete automaticky uzatvára zápas (`closed:true`, vloží syntetické
`goal_contumation` udalosti). Do doterajšej metriky „Odohraté zápasy" (= `closed:true`)
preto vstupovali aj administratívne kontumácie a odstúpenia družstva, ktoré sa fyzicky
nikdy neodohrali (technický výsledok 0:0, prázdna návštevnosť, spravidla bez rozhodcu).

Nezávislá analýza ObFZ Nitra z ISSF (2782 všetkých vs 2627 so schváleným zápisom) ukázala
155 takýchto zápasov. Overenie v Sportnet dátach potvrdilo, že sú v `closed:true`
započítané. Celoslovensky za 2025/2026 ide o 2 939 zápasov (≈ 4,6 % uzatvorených).

## Rozhodnutie

„Odohraté zápasy" (`kpi.zapasy`) = uzatvorené (`closed:true`) **mínus administratívne
ukončené bez zápisu**.

Administratívne ukončený zápas = `__issfMatchStatus` (fallback `state`) ∈
{`KONTUMOVANY`, `ODSTUPENE_DRUZSTVO`} **a zároveň** bez udalostí v protokole
(`protocol.events` prázdne) **a zároveň** bez zaznamenanej návštevnosti
(`protocol.audience` prázdne/0) **a zároveň** bez uzavretej nominácie
(`nominations[].closed` — nebola podaná zostava).

Reálne odohrané kontumácie/odstúpenia (majú protokol, návštevnosť alebo uzavretú
nomináciu) ostávajú započítané. Doplnkové KPI: `uzatvorene`, `administrativne`, `kontumovane` a `odstupene`
(každé so split `*Admin` / `*Odohrane`).

## Dôsledky

- Platí pre zväzy aj kluby, futbal aj futsal, všetky sezóny (prepočítané 2012/2013–2026/2027).
- Implementácia: `etl/pipelines/__init__.py` (`_ADMIN_NEODOHRANY_EXPR`), `etl/run.py`,
  `etl/kluby.py`; pravidlo v `docs/metodika.md`. Nový runner `etl/prepocet.sh`.
- Web: nová stránka **Dokumentácia**, karty „Odstúpené", prepísané FAQ a metodické poznámky.
- Príznak reálneho odohratia = aspoň jeden z: udalosti v protokole, zaznamenaná návštevnosť
  alebo uzavretá nominácia (podaná zostava). Overené na ObFZ Nitra 2025/2026: 155 (pôvodná
  proxy) → 152 (spresnené o uzavretú nomináciu).
- Do budúcna možno zvážiť explicitný ISSF príznak zápis-podaný/schválený (dnes nie je
  v ISSF connectore importovaný — vyžadoval by zmenu connectora a backfill).
