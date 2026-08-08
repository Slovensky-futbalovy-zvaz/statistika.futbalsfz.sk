#!/usr/bin/env python3
"""Generátor porovnávacích tabuliek (F4) — data/porovnania/{uroven}/{sezona}.json.

Z už vygenerovaných profilov data/zvaz/{id}/{sezona}.json (futbal) zostaví pre
každú ÚROVEŇ (RFZ, ObFZ) a každú sezónu tabuľku zväzov s KPI a odvodenými
metrikami (góly/zápas, diváci/zápas) na porovnávanie a radenie na webe.

BEZ databázy — číta len lokálne JSON. Spúšťa sa po ETL behu (run.py/beh.py).

Použitie:
    python etl/porovnania.py                 # všetky úrovne a sezóny
    python etl/porovnania.py --out data
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"

# úrovne, ktoré má zmysel porovnávať (SFZ je jediný → neporovnáva sa)
UROVNE = [("rfz", "RFZ"), ("obfz", "ObFZ")]


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def sezony_zvazu(out_dir: Path, zvaz_id: str) -> list[str]:
    """Kanonické futbalové sezóny podľa existujúcich súborov RRRR-RRRR.json."""
    d = out_dir / "zvaz" / zvaz_id
    if not d.exists():
        return []
    return sorted(
        p.stem.replace("-", "/") for p in d.glob("*.json") if re.fullmatch(r"\d{4}-\d{4}", p.stem)
    )


def riadok(profil: dict, zvaz: dict, rfz_skratka: str | None) -> dict:
    kpi = profil["kpi"]
    zapasy = kpi.get("zapasy", 0) or 0
    # rozpad po vekových úrovniach (na filtre priameho porovnania + graf vývoja na webe)
    osoby_pk = profil.get("osoby", {}) or {}
    def _pk(role):
        return (osoby_pk.get(role, {}) or {}).get("poKategorii", {}) or {}
    hraci_kat = _pk("hraci")
    treneri_kat = _pk("treneri")
    rozhodcovia_kat = _pk("rozhodcovia")
    realizacny_kat = _pk("realizacnyTim")
    delegati_kat = _pk("delegati")
    personal_kat = _pk("personal")
    kat = {}
    for lvl, k in (profil.get("kategorie") or {}).items():
        kat[lvl] = {
            "sutaze": k.get("sutaze", 0),
            "skupiny": k.get("skupiny", 0),
            "zapasy": k.get("zapasy", 0),
            "druzstva": k.get("druzstva", 0),
            "goly": k.get("goly", 0),
            "divaci": k.get("divaci", 0),
            "zlteKarty": k.get("zlte", 0),
            "cerveneKarty": k.get("cervene", 0),
            "hraci": hraci_kat.get(lvl, 0),
            "treneri": treneri_kat.get(lvl, 0),
            "rozhodcovia": rozhodcovia_kat.get(lvl, 0),
            "realizacnyTim": realizacny_kat.get(lvl, 0),
            "delegati": delegati_kat.get(lvl, 0),
            "personal": personal_kat.get(lvl, 0),
        }
    # rozpad súťaží po pohlaví a po úrovniach súťaže (etapa 2, 6. 8. 2026)
    sutaze_pohlavie = {
        g: (blok or {}).get("sutaze", 0) or 0
        for g, blok in (profil.get("pohlavie") or {}).items()
    }
    # súťažné skupiny — základné časti súťaží (Ján Letko, 8. 8. 2026)
    skupiny_pohlavie = {
        g: (blok or {}).get("skupiny", 0) or 0
        for g, blok in (profil.get("pohlavie") or {}).items()
    }
    urovne = {
        kod: (u or {}).get("sutaze", 0) or 0
        for kod, u in (profil.get("urovne") or {}).items()
    }
    urovne_skupiny = {
        kod: (u or {}).get("skupiny", 0) or 0
        for kod, u in (profil.get("urovne") or {}).items()
    }
    osoby = profil.get("osoby", {}) or {}
    r = {
        "id": zvaz["id"],
        "nazov": zvaz["nazov"],
        "sutaze": kpi.get("sutaze", 0) or 0,
        "skupiny": kpi.get("skupiny", 0) or 0,
        "zapasy": zapasy,
        "druzstva": kpi.get("druzstva", 0),
        "kontumovane": kpi.get("kontumovane", 0) or 0,
        "goly": kpi.get("goly", 0),
        "divaci": kpi.get("divaci", 0),
        "zlteKarty": kpi.get("zlteKarty", 0),
        "cerveneKarty": kpi.get("cerveneKarty", 0),
        "hraci": osoby.get("hraci", {}).get("unikatni", 0),
        "treneri": osoby.get("treneri", {}).get("unikatni", 0),
        "rozhodcovia": osoby.get("rozhodcovia", {}).get("unikatni", 0),
        "realizacnyTim": osoby.get("realizacnyTim", {}).get("unikatni", 0),
        "delegati": osoby.get("delegati", {}).get("unikatni", 0),
        "personal": osoby.get("personal", {}).get("unikatni", 0),
        "golyNaZapas": round(kpi.get("goly", 0) / zapasy, 2) if zapasy else 0.0,
        "divaciNaZapas": round(kpi.get("divaci", 0) / zapasy, 1) if zapasy else 0.0,
        "kat": kat,
        "sutazePohlavie": {g: n for g, n in sutaze_pohlavie.items() if n},
        "skupinyPohlavie": {g: n for g, n in skupiny_pohlavie.items() if n},
        "urovne": {kod: n for kod, n in urovne.items() if n},
        "urovneSkupiny": {kod: n for kod, n in urovne_skupiny.items() if n},
        # plochý rez úroveň × veková úroveň × pohlavie — podklad pre heatmapu
        # a graf vývoja počtu súťaží danej úrovne v čase (7. 8. 2026)
        "sutazeUroven": profil.get("sutazeUroven") or [],
    }
    if rfz_skratka:
        r["rfz"] = rfz_skratka
    return r


def main() -> int:
    ap = argparse.ArgumentParser(description="Generátor porovnávacích tabuliek (F4)")
    ap.add_argument("--out", default=str(REPO / "data"), help="dátový priečinok (default: data/)")
    args = ap.parse_args()
    out_dir = Path(args.out)

    zvazy_cfg = load_json(CONFIG / "zvazy.json")
    # id RFZ → zobrazovaná skratka (appSpace: BFZ/ZsFZ/SsFZ/VsFZ)
    rfz_skratka = {r["id"]: r["appSpace"] for r in zvazy_cfg.get("rfz", [])}

    spolu = 0
    for kluc, uroven in UROVNE:
        zvazy = zvazy_cfg.get(kluc, [])
        # všetky sezóny naprieč zväzmi úrovne
        vsetky_sezony: set[str] = set()
        for z in zvazy:
            vsetky_sezony.update(sezony_zvazu(out_dir, z["id"]))

        for sezona in sorted(vsetky_sezony):
            nazov_suboru = sezona.replace("/", "-") + ".json"
            riadky = []
            for z in zvazy:
                cesta = out_dir / "zvaz" / z["id"] / nazov_suboru
                if not cesta.exists():
                    continue
                profil = load_json(cesta)
                rfz = rfz_skratka.get(z.get("rfz")) if kluc == "obfz" else None
                riadky.append(riadok(profil, z, rfz))
            if not riadky:
                continue
            riadky.sort(key=lambda r: r["zapasy"], reverse=True)

            doc = {
                "uroven": uroven,
                "sezona": sezona,
                "generatedAt": teraz(),
                "pocetZvazov": len(riadky),
                "zvazy": riadky,
            }
            ciel = out_dir / "porovnania" / kluc / nazov_suboru
            ciel.parent.mkdir(parents=True, exist_ok=True)
            with open(ciel, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=2)
                f.write("\n")
            spolu += 1
            print(f"OK {ciel.relative_to(REPO)} — {len(riadky)} zväzov")

    print(f"Hotovo: {spolu} súborov porovnaní.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
