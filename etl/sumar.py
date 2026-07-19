#!/usr/bin/env python3
"""Generátor celoslovenského sumáru — data/sumar/{sezona}.json + data/sumar/demografia.json.

Z už vygenerovaných profilov data/zvaz/{id}/{sezona}.json (futbal + odvetvia)
a demografie data/demografia/{id}.json zostaví pre každú sezónu súhrn celej SR:

- kpi: súčty všetkých 43 zväzov (zápasy, družstvá, góly, diváci, karty),
- osoby: súčty unikátnych osôb po roliach + spolu — POZOR: osoba pôsobiaca vo
  viacerých zväzoch sa počíta v každom z nich (dvojité pôsobenie naprieč zväzmi,
  rovnaká metodika ako pri kategóriách; publikovať s poznámkou),
- odvetvia: futsal (a budúce odvetvia) samostatne,
- sunburstSutaze: strom SR → odvetvie → SFZ → RFZ → ObFZ (hodnota = zápasy),
- sunburstOsoby: strom SR → rola → úroveň (SFZ/RFZ/ObFZ) → zväz (hodnota = unikátni v zväze).

data/sumar/demografia.json = SR demografia v schéme zhodnej s data/demografia/{id}.json
(element-wise súčet rokov narodenia × pohlavie cez všetky zväzy) — použiteľná priamo
komponentom VekovaPyramida.

BEZ databázy — číta len lokálne JSON. Spúšťa sa po ETL behu (run.py/beh.py/demografia.py).

Použitie:
    python etl/sumar.py                 # všetky sezóny, ktoré majú aspoň 1 zväz
    python etl/sumar.py --out data
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"

ROLY = ["hraci", "treneri", "rozhodcovia", "delegati", "personal"]
ROLA_NAZOV = {
    "hraci": "Hráči",
    "treneri": "Tréneri",
    "rozhodcovia": "Rozhodcovia",
    "delegati": "Delegáti",
    "personal": "Personál",
}
KPI_KLUCE = ["sutaze", "zapasy", "druzstva", "goly", "divaci", "zlteKarty", "cerveneKarty"]


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


def profil(out_dir: Path, zvaz_id: str, sezona: str, sektor: str | None = None) -> dict | None:
    suffix = f"-{sektor}" if sektor else ""
    p = out_dir / "zvaz" / zvaz_id / f"{sezona.replace('/', '-')}{suffix}.json"
    return load_json(p) if p.exists() else None


def scitaj_kpi(cielove: dict, kpi: dict) -> None:
    for k in KPI_KLUCE:
        cielove[k] = cielove.get(k, 0) + (kpi.get(k, 0) or 0)


# ---------------------------------------------------------------- sunburst

def _pohlavie_zapasy(p: dict) -> dict:
    """Zápasy po pohlaví z bloku profilu (M/F/NEURCENE → počty zápasov)."""
    out = {}
    for g, blok in (p.get("pohlavie") or {}).items():
        z = (blok or {}).get("zapasy", 0) or 0
        if z:
            out[g] = z
    return out


def sunburst_sutaze(zvazy_cfg: dict, out_dir: Path, sezona: str) -> dict:
    """Strom SR → odvetvie → SFZ → RFZ → ObFZ; hodnota listu = zápasy zväzu.

    Vlastné súťaže SFZ/RFZ sú samostatný list („… — vlastné súťaže“), aby súčet
    uzla presne sedel na súčet celej vetvy (ECharts sunburst sčíta listy).
    Listy nesú aj rozpad zápasov po pohlaví (kľúč `pohlavie`) pre klientsky
    pill filter Muži/Ženy — hodnoty sa prepočítajú vo frontende.
    """
    def leaf(nazov: str, p: dict, zvaz_id: str | None = None) -> dict:
        d = {"name": nazov, "value": p["kpi"]["zapasy"], "pohlavie": _pohlavie_zapasy(p)}
        if zvaz_id:
            d["id"] = zvaz_id
        return d

    # futbal — pyramída SFZ → RFZ → ObFZ
    rfz_uzly = []
    for rfz in zvazy_cfg["rfz"]:
        p_rfz = profil(out_dir, rfz["id"], sezona)
        deti = []
        if p_rfz and p_rfz["kpi"]["zapasy"]:
            deti.append(leaf(f"{rfz['nazov']} — vlastné súťaže", p_rfz, rfz["id"]))
        for obfz in zvazy_cfg["obfz"]:
            if obfz.get("rfz") != rfz["id"]:
                continue
            p_o = profil(out_dir, obfz["id"], sezona)
            if p_o and p_o["kpi"]["zapasy"]:
                deti.append(leaf(obfz["nazov"], p_o, obfz["id"]))
        if deti:
            rfz_uzly.append({"name": rfz["nazov"], "id": rfz["id"], "children": deti})

    sfz = zvazy_cfg["sfz"][0]
    p_sfz = profil(out_dir, sfz["id"], sezona)
    sfz_deti = []
    if p_sfz and p_sfz["kpi"]["zapasy"]:
        sfz_deti.append(leaf("SFZ — vlastné súťaže", p_sfz, sfz["id"]))
    sfz_deti += rfz_uzly

    odvetvia = []
    if sfz_deti:
        odvetvia.append({"name": "Futbal", "children": [
            {"name": sfz["nazov"], "id": sfz["id"], "children": sfz_deti}
        ]})

    # ďalšie odvetvia (futsal, …) — súbory RRRR-RRRR-{sektor}.json pod SFZ
    sfz_dir = out_dir / "zvaz" / sfz["id"]
    slug = sezona.replace("/", "-")
    for f in sorted(sfz_dir.glob(f"{slug}-*.json")):
        sektor = f.stem[len(slug) + 1 :]
        p_s = load_json(f)
        if p_s["kpi"]["zapasy"]:
            odvetvia.append({
                "name": sektor.capitalize(),
                "children": [leaf(f"Slovenský {sektor}", p_s, sfz["id"])],
            })

    return {"name": "SR", "children": odvetvia}


def sunburst_osoby(zvazy_cfg: dict, out_dir: Path, sezona: str) -> dict:
    """Strom SR → odvetvie (Futbal/Futsal) → úroveň (SFZ/RFZ/ObFZ) → rola → veková úroveň.

    4-prstencový agregát (rozhodnutie PO 19. 7. 2026 — nahrádza placeholder z prototypu).
    Hodnota listu = súčet osôb v kategórii cez všetky zväzy danej úrovne
    (osoby.{rola}.poKategorii). Úroveň SFZ = zväzy `sfz` (ich profil je v ETL
    agregovaný cez appSpaces `futbalsfz.sk` + `ulk.futbalnet.sk`, teda ULK/Niké
    liga je automaticky započítaná). Futsal beží len pod SFZ.
    Osoby bez priradenej kategórie (historické sezóny) → list „Bez kategórie“,
    aby súčet sedel na počet unikátnych.
    """
    def rola_uzly(profily: list[dict]) -> list[dict]:
        uzly = []
        for rola in ROLY:
            kat: dict[str, int] = {}
            unikatni = 0
            for p in profily:
                o = p.get("osoby", {}).get(rola, {})
                unikatni += o.get("unikatni", 0)
                for k, n in (o.get("poKategorii") or {}).items():
                    kat[k] = kat.get(k, 0) + n
            bez = unikatni - sum(kat.values())
            deti = [{"name": k, "value": n} for k, n in sorted(kat.items(), key=lambda x: -x[1]) if n]
            if bez > 0:
                deti.append({"name": "Bez kategórie", "value": bez})
            if deti:
                uzly.append({"name": ROLA_NAZOV[rola], "children": deti})
        return uzly

    def uroven_uzly(zvazy: list[dict], nazov: str) -> dict | None:
        profily = [p for z in zvazy if (p := profil(out_dir, z["id"], sezona))]
        roly = rola_uzly(profily)
        return {"name": nazov, "uroven": nazov, "children": roly} if roly else None

    # futbal — SFZ / RFZ / ObFZ ako medzi-prsteň úrovne
    urovne = [
        uroven_uzly(zvazy_cfg["sfz"], "SFZ"),
        uroven_uzly(zvazy_cfg["rfz"], "RFZ"),
        uroven_uzly(zvazy_cfg["obfz"], "ObFZ"),
    ]
    urovne = [u for u in urovne if u]
    odvetvia = []
    if urovne:
        odvetvia.append({"name": "Futbal", "children": urovne})

    # futsal — len SFZ úroveň
    sfz_dir = out_dir / "zvaz" / zvazy_cfg["sfz"][0]["id"]
    slug = sezona.replace("/", "-")
    for f in sorted(sfz_dir.glob(f"{slug}-*.json")):
        sektor = f.stem[len(slug) + 1 :]
        roly = rola_uzly([load_json(f)])
        if roly:
            odvetvia.append({
                "name": sektor.capitalize(),
                "children": [{"name": "SFZ", "uroven": "SFZ", "children": roly}],
            })

    return {"name": "SR", "children": odvetvia}


# ---------------------------------------------------------------- demografia SR

def demografia_sr(zvazy_cfg: dict, out_dir: Path) -> dict:
    """SR demografia = element-wise súčet data/demografia/{id}.json cez všetky zväzy.

    Osoba pôsobiaca vo viacerých zväzoch sa počíta v každom z nich (dvojité
    pôsobenie naprieč zväzmi) — publikovať s poznámkou.
    """
    vsetky = zvazy_cfg["sfz"] + zvazy_cfg["rfz"] + zvazy_cfg["obfz"]
    sr: dict = {}
    for z in vsetky:
        p = out_dir / "demografia" / f"{z['id']}.json"
        if not p.exists():
            continue
        for sezona, roly in load_json(p)["sezony"].items():
            cs = sr.setdefault(sezona, {})
            for rola, r in roly.items():
                cr = cs.setdefault(rola, {"osoby": 0, "sUdajmi": 0, "bezUdajov": 0, "roky": {}})
                cr["osoby"] += r.get("osoby", 0)
                cr["sUdajmi"] += r.get("sUdajmi", 0)
                cr["bezUdajov"] += r.get("bezUdajov", 0)
                for rok, pohlavia in r.get("roky", {}).items():
                    crok = cr["roky"].setdefault(rok, {})
                    for g, n in pohlavia.items():
                        crok[g] = crok.get(g, 0) + n
    return {
        "zvaz": "sr",
        "sportSector": "futbal",
        "generatedAt": teraz(),
        "methodologyFlags": {
            "osobyPoznamka": "Súčet cez všetky zväzy — osoba pôsobiaca vo viacerých zväzoch sa počíta v každom z nich.",
        },
        "sezony": {s: sr[s] for s in sorted(sr)},
    }


# ---------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data", help="výstupný priečinok (default data)")
    args = ap.parse_args()
    out_dir = (REPO / args.out) if not Path(args.out).is_absolute() else Path(args.out)

    zvazy_cfg = load_json(CONFIG / "zvazy.json")
    vsetky = zvazy_cfg["sfz"] + zvazy_cfg["rfz"] + zvazy_cfg["obfz"]

    sezony: set[str] = set()
    for z in vsetky:
        sezony |= set(sezony_zvazu(out_dir, z["id"]))

    sumar_dir = out_dir / "sumar"
    sumar_dir.mkdir(parents=True, exist_ok=True)

    for sezona in sorted(sezony):
        kpi: dict = {}
        osoby = {rola: 0 for rola in ROLY}
        pocet_zvazov = 0
        for z in vsetky:
            p = profil(out_dir, z["id"], sezona)
            if not p:
                continue
            pocet_zvazov += 1
            scitaj_kpi(kpi, p["kpi"])
            for rola in ROLY:
                osoby[rola] += p.get("osoby", {}).get(rola, {}).get("unikatni", 0)

        # odvetvia (futsal, …) — zatiaľ len SFZ
        odvetvia: dict = {}
        sfz_dir = out_dir / "zvaz" / zvazy_cfg["sfz"][0]["id"]
        slug = sezona.replace("/", "-")
        for f in sorted(sfz_dir.glob(f"{slug}-*.json")):
            sektor = f.stem[len(slug) + 1 :]
            p_s = load_json(f)
            o_kpi: dict = {}
            scitaj_kpi(o_kpi, p_s["kpi"])
            o_osoby = {rola: p_s.get("osoby", {}).get(rola, {}).get("unikatni", 0) for rola in ROLY}
            o_osoby["spolu"] = sum(o_osoby.values())
            odvetvia[sektor] = {"kpi": o_kpi, "osoby": o_osoby}

        vystup = {
            "sezona": sezona,
            "generatedAt": teraz(),
            "pocetZvazov": pocet_zvazov,
            "methodologyFlags": {
                "osobyPoznamka": (
                    "Súčty unikátnych osôb po zväzoch — osoba pôsobiaca vo viacerých "
                    "zväzoch sa počíta v každom z nich (dvojité pôsobenie)."
                ),
                "kpiPoznamka": "Futbal, súčet všetkých zväzov; ďalšie odvetvia v bloku odvetvia.",
            },
            "kpi": kpi,
            "osoby": {**osoby, "spolu": sum(osoby.values())},
            "odvetvia": odvetvia,
            "sunburstSutaze": sunburst_sutaze(zvazy_cfg, out_dir, sezona),
            "sunburstOsoby": sunburst_osoby(zvazy_cfg, out_dir, sezona),
        }
        cesta = sumar_dir / f"{slug}.json"
        with open(cesta, "w", encoding="utf-8") as f:
            json.dump(vystup, f, ensure_ascii=False, indent=1)
        print(f"OK {cesta} — {pocet_zvazov} zväzov, {kpi.get('zapasy', 0)} zápasov")

    demo = demografia_sr(zvazy_cfg, out_dir)
    with open(sumar_dir / "demografia.json", "w", encoding="utf-8") as f:
        json.dump(demo, f, ensure_ascii=False, indent=1)
    print(f"OK {sumar_dir / 'demografia.json'} — {len(demo['sezony'])} sezón")


if __name__ == "__main__":
    main()
