#!/usr/bin/env python3
"""Generátor porovnávacích dát klubov — data/porovnania/kluby/{sezona}.json.

Z už vygenerovaných profilov data/klub/{id}/{sezona}.json (futbal) zostaví pre
KAŽDÚ sezónu zoznam VŠETKÝCH klubov s KPI a odvodenými metrikami (góly/zápas,
diváci/zápas) + rozpad po vekových kategóriách (na filtre priameho porovnania
na webe, rovnaká konvencia ako etl/porovnania.py pre zväzy).

BEZ databázy — číta len lokálne JSON (data/klub/*). Spúšťa sa po ETL behu
kluby.py. Výstup je zámerne kompletný (tisícky klubov) — web ho servíruje ako
statický JSON endpoint a načíta ho klientsky až pri otvorení záložky
"Priame porovnanie klubov" (viď web/src/pages/data/kluby-porovnanie).

Použitie:
    python etl/porovnania_kluby.py
    python etl/porovnania_kluby.py --out data
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def zvaz_nazvy() -> dict[str, str]:
    cfg = load_json(CONFIG / "zvazy.json")
    out: dict[str, str] = {}
    for kluc in ("sfz", "rfz", "obfz"):
        for z in cfg.get(kluc, []) or []:
            out[z["id"]] = z["nazov"]
    return out


def riadok(klub: dict, nazvy: dict[str, str]) -> dict:
    kpi = klub.get("kpi", {}) or {}
    zapasy = kpi.get("zapasy", 0) or 0
    osoby = klub.get("osoby", {}) or {}
    hraci_kat = osoby.get("hraci", {}).get("poKategorii", {}) or {}
    kat = {}
    for lvl, k in (klub.get("kategorie") or {}).items():
        kat[lvl] = {
            "zapasy": k.get("zapasy", 0),
            "druzstva": k.get("druzstva", 0),
            "goly": k.get("goly", 0),
            "divaci": k.get("divaci", 0),
            "hraci": hraci_kat.get(lvl, 0),
        }
    zvaz_id = klub.get("zvaz")
    return {
        "id": klub["klub"],
        "nazov": klub["nazov"],
        "zvaz": zvaz_id,
        "zvazNazov": nazvy.get(zvaz_id or "", klub.get("zvaz") or ""),
        "uroven": klub.get("uroven", ""),
        "zapasy": zapasy,
        "druzstva": kpi.get("druzstva", 0),
        "goly": kpi.get("goly", 0),
        "divaci": kpi.get("divaci", 0),
        "zlteKarty": kpi.get("zlteKarty", 0),
        "cerveneKarty": kpi.get("cerveneKarty", 0),
        "hraci": osoby.get("hraci", {}).get("unikatni", 0),
        "treneri": osoby.get("treneri", {}).get("unikatni", 0),
        "realizacnyTim": osoby.get("realizacnyTim", {}).get("unikatni", 0),
        "golyNaZapas": round(kpi.get("goly", 0) / zapasy, 2) if zapasy else 0.0,
        "divaciNaZapas": round(kpi.get("divaci", 0) / zapasy, 1) if zapasy else 0.0,
        "kat": kat,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Generátor porovnávacích dát klubov")
    ap.add_argument("--out", default=str(REPO / "data"), help="dátový priečinok (default: data/)")
    args = ap.parse_args()
    out_dir = Path(args.out)
    klub_dir = out_dir / "klub"
    if not klub_dir.exists():
        print("Chýba data/klub — najprv spusti etl/kluby.py")
        return 1

    nazvy = zvaz_nazvy()

    # sezona (slug RRRR-RRRR) → zoznam riadkov
    podla_sezony: dict[str, list[dict]] = {}
    for kid in sorted(klub_dir.iterdir()):
        if not kid.is_dir():
            continue
        for f in kid.glob("*.json"):
            if not re.fullmatch(r"\d{4}-\d{4}\.json", f.name):
                continue
            slug = f.stem
            try:
                klub = load_json(f)
            except (json.JSONDecodeError, OSError):
                continue
            if (klub.get("kpi", {}) or {}).get("zapasy", 0) <= 0:
                continue
            podla_sezony.setdefault(slug, []).append(riadok(klub, nazvy))

    spolu = 0
    for slug, riadky in sorted(podla_sezony.items()):
        riadky.sort(key=lambda r: r["zapasy"], reverse=True)
        doc = {
            "sezona": slug.replace("-", "/"),
            "generatedAt": teraz(),
            "pocetKlubov": len(riadky),
            "kluby": riadky,
        }
        ciel = out_dir / "porovnania" / "kluby" / f"{slug}.json"
        ciel.parent.mkdir(parents=True, exist_ok=True)
        with open(ciel, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
            f.write("\n")
        spolu += 1
        print(f"OK {ciel.relative_to(REPO)} — {len(riadky)} klubov")

    print(f"Hotovo: {spolu} súborov porovnaní klubov.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
