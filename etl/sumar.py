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
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CONFIG = REPO / "etl" / "config"

sys.path.insert(0, str(REPO / "etl"))
import pipelines  # noqa: E402  — len číselník úrovní (UROVEN_PORADIE/NAZOV), bez DB
import validate  # noqa: E402
import kluby_zvazy  # noqa: E402  — poradie vekových kategórií

ROLY = ["hraci", "treneri", "rozhodcovia", "delegati", "personal"]
ROLA_NAZOV = {
    "hraci": "Hráči",
    "treneri": "Tréneri",
    "rozhodcovia": "Rozhodcovia",
    "delegati": "Delegáti",
    "personal": "Personál",
}
KPI_KLUCE = ["sutaze", "skupiny", "zapasy", "uzatvorene", "administrativne", "druzstva", "goly", "divaci", "zlteKarty", "cerveneKarty", "kontumovane", "kontumovaneAdmin", "kontumovaneOdohrane", "odstupene", "odstupeneAdmin", "odstupeneOdohrane"]
#: Metriky sčítané po vekových kategóriách (pre celoslovenský trend po úrovniach).
#: `sutaze` = počet súťaží s aspoň jedným uzavretým zápasom v danej vekovej úrovni
#: (doplnené 6. 8. 2026). Súťaž, ktorej zápasy spadajú do viacerých vekových úrovní,
#: sa započíta v každej z nich — súčet po kategóriách preto môže prevýšiť kpi.sutaze.
KAT_METRIKY = ["sutaze", "skupiny", "zapasy", "uzatvorene", "administrativne", "druzstva", "goly", "zlte", "cervene", "divaci"]

#: Úrovne pyramídy pre rozpad súťaží podľa riadiaceho zväzu.
RIADIACE_UROVNE = [("sfz", "SFZ"), ("rfz", "RFZ"), ("obfz", "ObFZ")]

#: Skupiny pohlavia v rozpade súťaží (etapa 2, 6. 8. 2026).
POHLAVIA = ["M", "F", "NEURCENE"]


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


def _zoradene_urovne(acc: dict) -> dict:
    """Zoradenie súhrnu úrovní podľa pyramídy (1. liga … poháre … neurčené)."""
    return {k: acc[k] for k in pipelines.UROVEN_PORADIE if k in acc}


def _zoradene_riadky(acc: dict) -> list[dict]:
    """Plochý zoznam úroveň súťaže × veková úroveň × pohlavie zo slovníka (u, kat, g) → sumy."""
    poradie_u = {k: i for i, k in enumerate(pipelines.UROVEN_PORADIE)}
    poradie_kat = {k: i for i, k in enumerate(validate.KATEGORIE_PORADIE)}
    poradie_g = {g: i for i, g in enumerate(POHLAVIA)}
    riadky = [
        {"uroven": u, "kat": kat, "pohlavie": g, **sumy}
        for (u, kat, g), sumy in acc.items()
    ]
    riadky.sort(
        key=lambda x: (
            poradie_u.get(x["uroven"], 99),
            poradie_kat.get(x["kat"], 99),
            poradie_g.get(x["pohlavie"], 9),
        )
    )
    return riadky


def _zber_urovni(p: dict, urovne_acc: dict, riadky_acc: dict, pohlavie_acc: dict) -> None:
    """Pripočíta rozpad súťaží jedného profilu do celoslovenských akumulátorov."""
    for kod, u in (p.get("urovne") or {}).items():
        a = urovne_acc.setdefault(
            kod,
            {"nazov": u.get("nazov") or pipelines.UROVEN_NAZOV.get(kod, kod),
             "sutaze": 0, "skupiny": 0, "zapasy": 0},
        )
        a["sutaze"] += u.get("sutaze", 0) or 0
        a["skupiny"] += u.get("skupiny", 0) or 0
        a["zapasy"] += u.get("zapasy", 0) or 0
    for r in p.get("sutazeUroven") or []:
        a = riadky_acc.setdefault(
            (r["uroven"], r["kat"], r["pohlavie"]), {"sutaze": 0, "skupiny": 0, "zapasy": 0}
        )
        a["sutaze"] += r.get("sutaze", 0) or 0
        a["skupiny"] += r.get("skupiny", 0) or 0
        a["zapasy"] += r.get("zapasy", 0) or 0
    for g, s in _pohlavie_sutaze(p).items():
        pohlavie_acc[g] = pohlavie_acc.get(g, 0) + s


def _pohlavie_sutaze(p: dict) -> dict:
    """Súťaže po pohlaví z bloku profilu (doplnené 6. 8. 2026, etapa 2).

    Súťaž patrí práve jednému zväzu, takže sčítanie naprieč zväzmi je korektné.
    V rámci jedného zväzu však súťaž s mužskými aj ženskými časťami spadne do
    oboch skupín — súčet pohlaví preto môže prevýšiť kpi.sutaze.
    """
    out = {}
    for g, blok in (p.get("pohlavie") or {}).items():
        s = (blok or {}).get("sutaze", 0) or 0
        if s:
            out[g] = s
    return out


def _pohlavie_skupiny(p: dict) -> dict:
    """Súťažné skupiny po pohlaví — analógia `_pohlavie_sutaze` (8. 8. 2026)."""
    out = {}
    for g, blok in (p.get("pohlavie") or {}).items():
        s = (blok or {}).get("skupiny", 0) or 0
        if s:
            out[g] = s
    return out


def sunburst_sutaze(zvazy_cfg: dict, out_dir: Path, sezona: str) -> dict:
    """Strom SR → odvetvie → SFZ → RFZ → ObFZ; hodnota listu = zápasy zväzu.

    Vlastné súťaže SFZ/RFZ sú samostatný list („… — vlastné súťaže“), aby súčet
    uzla presne sedel na súčet celej vetvy (ECharts sunburst sčíta listy).
    Listy nesú aj rozpad zápasov po pohlaví (kľúč `pohlavie`) pre klientsky
    pill filter Muži/Ženy — hodnoty sa prepočítajú vo frontende.
    Kľúč `sutaze` nesie počet súťaží zväzu (prepínač metriky Zápasy/Súťaže vo
    frontende) a `sutazePohlavie` jeho rozpad po pohlaví (etapa 2, 6. 8. 2026) —
    vďaka nemu funguje pill filter Muži/Ženy aj pri metrike Súťaže.
    """
    def leaf(nazov: str, p: dict, zvaz_id: str | None = None) -> dict:
        d = {
            "name": nazov,
            "value": p["kpi"]["zapasy"],
            "sutaze": p["kpi"].get("sutaze", 0) or 0,
            "skupiny": p["kpi"].get("skupiny", 0) or 0,
            # kluby v sunburste = DOMOVSKÝ zväz (kde klub odohral najviac zápasov):
            # prstence sa sčítavajú, takže tu musí byť disjunktné číslo sediace na SR
            "kluby": (p.get("kluby") or {}).get("domaci", 0) or 0,
            "pohlavie": _pohlavie_zapasy(p),
            "sutazePohlavie": _pohlavie_sutaze(p),
            "skupinyPohlavie": _pohlavie_skupiny(p),
        }
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
    # id zväzu → úroveň pyramídy (SFZ/RFZ/ObFZ) pre rozpad súťaží podľa riadiaceho zväzu
    uroven_zvazu = {
        z["id"]: label for kluc, label in RIADIACE_UROVNE for z in zvazy_cfg.get(kluc, [])
    }

    sezony: set[str] = set()
    for z in vsetky:
        sezony |= set(sezony_zvazu(out_dir, z["id"]))

    sumar_dir = out_dir / "sumar"
    sumar_dir.mkdir(parents=True, exist_ok=True)

    for sezona in sorted(sezony):
        kpi: dict = {}
        kat: dict = {}
        osobyKat: dict = {}
        osoby = {rola: 0 for rola in ROLY}
        riadiaci: dict = {}
        urovne_acc: dict = {}       # kód úrovne → {nazov, sutaze, zapasy}
        uroven_riadky: dict = {}    # (uroven, kat, pohlavie) → {sutaze, zapasy}
        sutaze_pohlavie: dict = {}  # M/F/NEURCENE → počet súťaží
        pocet_zvazov = 0
        for z in vsetky:
            p = profil(out_dir, z["id"], sezona)
            if not p:
                continue
            pocet_zvazov += 1
            scitaj_kpi(kpi, p["kpi"])
            _zber_urovni(p, urovne_acc, uroven_riadky, sutaze_pohlavie)
            for c, cd in (p.get("kategorie") or {}).items():
                acc = kat.setdefault(c, {m: 0 for m in KAT_METRIKY})
                for m in KAT_METRIKY:
                    acc[m] += cd.get(m, 0) or 0
            # rozpad súťaží podľa riadiaceho zväzu (SFZ / RFZ / ObFZ)
            uz = uroven_zvazu.get(z["id"])
            if uz:
                racc = riadiaci.setdefault(
                    uz, {"sutaze": 0, "skupiny": 0, "zapasy": 0, "pocetZvazov": 0, "kategorie": {}}
                )
                racc["sutaze"] += p["kpi"].get("sutaze", 0) or 0
                racc["skupiny"] += p["kpi"].get("skupiny", 0) or 0
                racc["zapasy"] += p["kpi"].get("zapasy", 0) or 0
                racc["pocetZvazov"] += 1
                for c, cd in (p.get("kategorie") or {}).items():
                    rk = racc["kategorie"].setdefault(c, {"sutaze": 0, "skupiny": 0, "zapasy": 0})
                    rk["sutaze"] += cd.get("sutaze", 0) or 0
                    rk["skupiny"] += cd.get("skupiny", 0) or 0
                    rk["zapasy"] += cd.get("zapasy", 0) or 0
            for rola in ROLY:
                osoby[rola] += p.get("osoby", {}).get(rola, {}).get("unikatni", 0)
            for rola, ob in (p.get("osoby") or {}).items():
                poKat = (ob or {}).get("poKategorii") or {}
                acc = osobyKat.setdefault(rola, {})
                for cat, n in poKat.items():
                    acc[cat] = acc.get(cat, 0) + (n or 0)

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
            # rozpad odvetvia po vekových úrovniach — pre pill filter športu v 15-ročnom trende
            o_kat: dict = {}
            for c, cd in (p_s.get("kategorie") or {}).items():
                o_kat[c] = {m: (cd.get(m, 0) or 0) for m in KAT_METRIKY}
            # rozpad súťaží odvetvia po úrovniach a pohlaví (etapa 2)
            o_urovne: dict = {}
            o_riadky: dict = {}
            o_pohlavie: dict = {}
            _zber_urovni(p_s, o_urovne, o_riadky, o_pohlavie)
            odvetvia[sektor] = {
                "kpi": o_kpi,
                "osoby": o_osoby,
                "kategorie": o_kat,
                "urovne": _zoradene_urovne(o_urovne),
                "sutazeUroven": _zoradene_riadky(o_riadky),
                "sutazePohlavie": {g: o_pohlavie[g] for g in POHLAVIA if o_pohlavie.get(g)},
            }
            # Počet klubov odvetvia (futsal…) z artefaktu data/kluby/{sezona}-{sektor}.json.
            # S futbalom sa SČÍTAŤ NESMIE — klub môže hrať oba športy a bol by dvakrát;
            # na úvodnej stránke je preto samostatná dlaždica.
            k_sekt = kluby_zvazy.blok_sr(kluby_zvazy.nacitaj(out_dir, sezona, sektor))
            if k_sekt:
                o_kpi["kluby"] = k_sekt["kluby"]
                odvetvia[sektor]["kluby"] = k_sekt

        # Počet klubov: celoslovenské číslo sa NESMIE skladať sčítaním po zväzoch
        # (klub hrá vo viacerých zväzoch) — berie sa z artefaktu data/kluby/{sezona}.json.
        kluby_sr = kluby_zvazy.blok_sr(kluby_zvazy.nacitaj(out_dir, sezona))
        if kluby_sr:
            kpi["kluby"] = kluby_sr["kluby"]
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
                "sutazePoznamka": (
                    "Súťaž = distinct súťaž s aspoň jedným uzavretým zápasom. V bloku "
                    "kategorie sa súťaž so zápasmi vo viacerých vekových úrovniach započíta "
                    "v každej z nich, preto súčet po kategóriách môže prevýšiť kpi.sutaze."
                ),
                "urovenPoznamka": (
                    "Úroveň súťaže pochádza z poľa competitions.level (nenastaviteľné, "
                    "kopírované z ISSF; nižší level = vyššia súťaž). Základný kľúč: úroveň "
                    "sa vždy vzťahuje ku konkrétnej vekovej úrovni (ADULTS, U19, U13…), nie "
                    "k vekovej kategórii — každá veková úroveň má vlastnú pyramídu a „1. liga“ "
                    "dospelých, U19 a U13 sú tri rôzne súťaže, ktoré sa nesčítavajú do jedného "
                    "stĺpca. Vekové kategórie (Dospelí, Dorast, Žiaci, Prípravky) sú len "
                    "medzisúčty pre vizualizáciu. Blok urovne je disjunktný a sedí na "
                    "kpi.sutaze; sutazeUroven je rez úroveň × veková úroveň × pohlavie, kde "
                    "sa súťaž so zápasmi vo viacerých vekových úrovniach započíta v každej "
                    "z nich."
                ),
            },
            "kpi": kpi,
            "kluby": kluby_sr,
            "kategorie": kat,
            "urovne": _zoradene_urovne(urovne_acc),
            "sutazeUroven": _zoradene_riadky(uroven_riadky),
            "sutazePohlavie": {g: sutaze_pohlavie[g] for g in POHLAVIA if sutaze_pohlavie.get(g)},
            "sutazePodlaRiadiacehoZvazu": {
                label: riadiaci[label] for _, label in RIADIACE_UROVNE if label in riadiaci
            },
            "osobyKat": osobyKat,
            "osoby": {**osoby, "spolu": sum(osoby.values())},
            "odvetvia": odvetvia,
            "sunburstSutaze": sunburst_sutaze(zvazy_cfg, out_dir, sezona),
            "sunburstOsoby": sunburst_osoby(zvazy_cfg, out_dir, sezona),
        }
        cesta = sumar_dir / f"{slug}.json"
        with open(cesta, "w", encoding="utf-8") as f:
            json.dump(vystup, f, ensure_ascii=False, indent=1)
        print(f"OK {cesta} — {pocet_zvazov} zväzov, {kpi.get('zapasy', 0)} zápasov")

    # SR demografia: prednost ma UNIKATNY beh etl/demografia.py --zvaz sr. Sucet zvazovych
    # suborov (ktory tu istu osobu duplikuje v kazdom zvaze) sa pouzije len ako zaloha,
    # kym unikatny beh neprebehol.
    cesta_demo = sumar_dir / "demografia.json"
    if cesta_demo.exists() and load_json(cesta_demo).get("unikatne"):
        print(f"SKIP {cesta_demo} — uz je z unikatneho SR behu (demografia.py --zvaz sr)")
        return 0
    demo = demografia_sr(zvazy_cfg, out_dir)
    with open(sumar_dir / "demografia.json", "w", encoding="utf-8") as f:
        json.dump(demo, f, ensure_ascii=False, indent=1)
    print(f"OK {sumar_dir / 'demografia.json'} — {len(demo['sezony'])} sezón")


if __name__ == "__main__":
    main()
