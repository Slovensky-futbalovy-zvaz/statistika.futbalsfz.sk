#!/usr/bin/env python3
"""Blok „Počet klubov“ — z artefaktu data/kluby/{sezona}.json do profilov zväzov.

Artefakt vyrába etl/kluby.py (jediný prechod nad zápasmi sezóny nad celým SR).
Tento modul ho len číta a vkladá do už vygenerovaných profilov — BEZ databázy.
Vďaka tomu blok prežije aj samostatný beh etl/run.py pre jeden zväz.

Metodika (rozhodnutie Ján Letko, 14. 8. 2026):
- aktívny klub = klub s aspoň jedným REÁLNE odohraným zápasom (closed:true bez
  administratívnych kontumácií a odstúpení bez zápisu),
- klub sa započíta v KAŽDOM zväze, v ktorého súťaži odohral aspoň jeden zápas —
  súčet po zväzoch je preto vyšší než celoslovenský počet (rovnaká pasca ako pri
  osobách); celoslovenské číslo sa berie z bloku „celkovo“, nikdy sčítaním,
- mládež = akákoľvek veková úroveň okrem ADULTS; klub bez mládeže má len ADULTS,
- počítajú sa len regulárne súťaže riadené slovenským zväzom — školské a výberové
  turnaje sú v číselníku etl/config/vylucene_sutaze.json.

Použitie:
    python etl/kluby_zvazy.py --doplnit     # vloží blok do data/zvaz/**/*.json
"""
from __future__ import annotations

import argparse
import json
import logging
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
log = logging.getLogger("kluby_zvazy")

POZNAMKA = (
    "Aktívny klub = klub s aspoň jedným reálne odohraným zápasom. Klub sa započíta "
    "v každom zväze, v ktorého súťaži hral, preto je súčet po zväzoch vyšší než "
    "celoslovenský počet klubov. Mládež = akákoľvek veková úroveň okrem dospelých. "
    "Nezapočítavajú sa účastníci neregulárnych súťaží (školské a výberové turnaje) "
    "ani súťaží mimo riadenia slovenských zväzov."
)

KLUCE = ["kluby", "sMladezou", "lenDospeli", "dospeliAMladez", "lenMladez", "neurcene"]


def _cesta(out_dir: Path, sezona: str, sport_sector: str = "futbal") -> Path:
    suffix = "" if sport_sector == "futbal" else f"-{sport_sector}"
    return Path(out_dir) / "kluby" / f"{sezona.replace('/', '-')}{suffix}.json"


def nacitaj(out_dir: Path, sezona: str, sport_sector: str = "futbal") -> dict | None:
    """Artefakt data/kluby/{sezona}.json, alebo None ak ešte nebol vygenerovaný."""
    p = _cesta(out_dir, sezona, sport_sector)
    if not p.exists():
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _blok(rez: dict | None, domaci: int | None = None) -> dict | None:
    if not rez:
        return None
    b = {k: rez.get(k, 0) for k in KLUCE}
    b["kategorie"] = rez.get("kategorie") or {}
    b["pohlavie"] = rez.get("pohlavie") or {}
    b["urovne"] = rez.get("urovne") or {}
    if domaci is not None:
        # doplnkové číslo: klub sa počíta len v „domovskom“ zväze (najviac zápasov) —
        # tieto počty sa dajú sčítať cez zväzy, na rozdiel od hlavného čísla
        b["domaci"] = domaci
    b["poznamka"] = POZNAMKA
    return b


def blok_zvazu(art: dict | None, zvaz_id: str) -> dict | None:
    if not art:
        return None
    dom = ((art.get("podlaDomovskehoZvazu") or {}).get(zvaz_id) or {}).get("kluby")
    return _blok((art.get("zvazy") or {}).get(zvaz_id), dom)


def blok_sr(art: dict | None) -> dict | None:
    if not art:
        return None
    b = _blok(art.get("celkovo"))
    if b is not None:
        b["vylucene"] = art.get("vylucene") or {}
    return b


def doplnit_do_profilu(doc: dict, out_dir: Path, zvaz_id: str, sezona: str,
                       sport_sector: str = "futbal") -> bool:
    """Vloží blok `kluby` a `kpi.kluby` do profilu zväzu. True ak sa blok doplnil."""
    b = blok_zvazu(nacitaj(out_dir, sezona, sport_sector), zvaz_id)
    if not b:
        return False
    doc["kluby"] = b
    doc.setdefault("kpi", {})["kluby"] = b["kluby"]
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data", help="výstupný priečinok (default data)")
    ap.add_argument("--doplnit", action="store_true",
                    help="vloží blok kluby do už publikovaných data/zvaz/**/*.json")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    out_dir = (REPO / args.out) if not Path(args.out).is_absolute() else Path(args.out)
    if not args.doplnit:
        log.info("nič na prácu — použi --doplnit")
        return 0

    doplnene = chybajuce = 0
    for p in sorted((out_dir / "zvaz").glob("*/*.json")):
        m = re.fullmatch(r"(\d{4})-(\d{4})(?:-([a-z]+))?", p.stem)
        if not m:
            continue
        sezona = f"{m.group(1)}/{m.group(2)}"
        sektor = m.group(3) or "futbal"
        with open(p, encoding="utf-8") as f:
            doc = json.load(f)
        if doplnit_do_profilu(doc, out_dir, p.parent.name, sezona, sektor):
            with open(p, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=2)
                f.write("\n")
            doplnene += 1
        else:
            chybajuce += 1
    log.info("OK — blok kluby doplnený do %d profilov (%d bez artefaktu alebo bez klubov)",
             doplnene, chybajuce)
    log.info("Ďalej spusti: python etl/sumar.py && python etl/porovnania.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
