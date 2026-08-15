#!/usr/bin/env python3
"""Zanikanie klubov — s mládežou vs. bez mládeže, po zväzoch a po obdobiach.

Zadanie Ján Letko (14. 8. 2026): koľko klubov definitívne zaniká a v akom stave boli, keď
naposledy hrali. ZÁSADNÉ PRAVIDLO: koniec klubu v súťažiach dospelých NIE JE zánik klubu,
pokiaľ klub má mládež — zánik je až to, keď klub prestane hrať úplne.

Doplnenie 15. 8. 2026 (Ján Letko): „v ktorých zväzoch najviac ubudlo klubov a v ktorom
období?“ → blok `zvazy` (rebríček podľa miery odchodu aj podľa absolútneho úbytku) a blok
`poObdobiach` (odchody a príchody v troch obdobiach). Zväz klubu je jeho DOMOVSKÝ zväz —
ten, v ktorom v danej sezóne odohral najviac zápasov; môže sa medzi sezónami zmeniť.

Beží OFFLINE nad publikovanými artefaktmi data/klub/{klub}/{sezona}.json, ktoré vznikli
rovnakým behom (a rovnakým filtrom) ako blok Počet klubov, takže čísla sedia na portál.
MongoDB netreba.

Definície (rozhodnutia Ján Letko, 14. 8. 2026):
- aktívny v sezóne  = klub má v danej sezóne artefakt (aspoň jeden reálne odohraný zápas),
- definitívny odchod v sezóne N = aktívny v N a neaktívny vo VŠETKÝCH nasledujúcich sezónach,
- jednorazový výpadok = nehral N+1, ale neskôr sa vrátil,
- stav pri odchode = stav v poslednej odohranej sezóne (mládež / bez mládeže).

Poslednú sezónu v dátach nemožno hodnotiť (nemá nasledujúcu) a predposledná je provizórna.
"""
from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SEZ_RE = re.compile(r"^(\d{4})-(\d{4})\.json$")  # bez -{sektor} = futbal


def stav_klubu(p: Path) -> tuple[bool, bool, str | None]:
    """(má mládež, má dospelých, domovský zväz) v danej sezóne."""
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    kat = set((d.get("kategorie") or {}).keys())
    return (bool(kat - {"ADULTS"}), "ADULTS" in kat, d.get("zvaz"))


def nacitaj(out_dir: Path) -> dict[str, dict[str, tuple[bool, bool, str | None]]]:
    kluby: dict[str, dict[str, tuple[bool, bool, str | None]]] = {}
    for d in sorted((out_dir / "klub").iterdir()):
        if not d.is_dir():
            continue
        pre_sezony: dict[str, tuple[bool, bool, str | None]] = {}
        for f in sorted(d.iterdir()):
            m = SEZ_RE.match(f.name)
            if m:
                pre_sezony[f"{m.group(1)}/{m.group(2)}"] = stav_klubu(f)
        if pre_sezony:
            kluby[d.name] = pre_sezony
    return kluby


def kluby_po_zvazoch(out_dir: Path, sezony: list[str]) -> dict[str, dict[str, int]]:
    """{zvaz: {sezona: počet klubov}} z artefaktov bloku Počet klubov.

    Zámerne NIE z domovského zväzu: tu je klub započítaný v každom zväze, v ktorého súťaži
    hral — presne to číslo, ktoré má zväz na svojom profile. Domovský zväz sa medzi sezónami
    mení (klub, ktorý začne hrať celoštátnu mládežnícku súťaž, „prejde“ pod SFZ), takže na
    otázku „koľko klubov ubudlo v zväze“ by dával skreslenú odpoveď.
    """
    von: dict[str, dict[str, int]] = collections.defaultdict(dict)
    for s in sezony:
        p = out_dir / "kluby" / f"{s.replace('/', '-')}.json"
        if not p.exists():
            continue
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        for zid, rez in (d.get("zvazy") or {}).items():
            von[zid][s] = rez.get("kluby", 0) if isinstance(rez, dict) else rez
    return von


def register_zvazov(repo: Path) -> dict[str, dict]:
    """id → {nazov, uroven} z overeného registra (etl/config/zvazy.json)."""
    with open(repo / "etl" / "config" / "zvazy.json", encoding="utf-8") as f:
        cfg = json.load(f)
    reg: dict[str, dict] = {}
    for uroven, zoznam in cfg.items():
        if not isinstance(zoznam, list):
            continue
        for z in zoznam:
            reg[z["id"]] = {"nazov": z.get("nazov", z["id"]), "uroven": z.get("uroven", uroven)}
    return reg


# Sezóny, ktoré sa do analýzy nesmú dostať (rozhodnutia Ján Letko, 14. 8. 2026):
# 2012/2013 a 2013/2014 = nábeh ISSF (evidencia nie je úplná, „nové“ kluby sú dobiehajúce dáta),
# posledná sezóna v dátach = prebiehajúca (klub, ktorý v nej ešte nehral, nezanikol).
NABEH_ISSF = ("2012/2013", "2013/2014")

# Obdobia pre otázku „kedy sa to dialo“ (Ján Letko, 15. 8. 2026). Hranice sú vecné, nie
# štatistické: covid zasiahol sezóny 2019/2020 (prerušená) až 2021/2022 (prvá po nej).
OBDOBIA = (
    ("do 2018/2019", None, "2018/2019"),
    ("2019/2020 – 2021/2022 (covid)", "2019/2020", "2021/2022"),
    ("od 2022/2023", "2022/2023", None),
)


def obdobie_sezony(s: str) -> str:
    for nazov, od, do in OBDOBIA:
        if (od is None or s >= od) and (do is None or s <= do):
            return nazov
    return OBDOBIA[-1][0]


def analyza(kluby: dict, od: str | None = None, register: dict | None = None,
            pocty: dict | None = None) -> dict:
    vsetky = sorted({s for v in kluby.values() for s in v})
    # okno: bez nábehu ISSF a bez prebiehajúcej (poslednej) sezóny
    sezony = [s for s in vsetky[:-1] if s not in NABEH_ISSF]
    prebiehajuca = vsetky[-1]
    idx = {s: i for i, s in enumerate(sezony)}
    posledna = len(sezony) - 1

    aktivni = {s: 0 for s in sezony}
    aktivni_mlad = {s: 0 for s in sezony}
    zanik = collections.defaultdict(collections.Counter)
    vypadok = collections.defaultdict(collections.Counter)
    prislo = collections.defaultdict(collections.Counter)
    prech = collections.Counter()
    # rez po DOMOVSKOM zväze — zväz sa berie z tej sezóny, ktorej sa údaj týka
    z_odchody: collections.Counter = collections.Counter()
    z_klubosezony: collections.Counter = collections.Counter()
    z_prichody: collections.Counter = collections.Counter()
    z_obdobia: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    z_po_sezonach: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    ob_odchody: collections.Counter = collections.Counter()
    ob_prichody: collections.Counter = collections.Counter()
    ob_sezon: collections.Counter = collections.Counter()
    ob_prichody_sezon: collections.Counter = collections.Counter()

    # hodnotiteľné obdobie: bez poslednej sezóny okna (nemá nasledujúcu) a bez provizórnej
    obdobie = sezony[:-2] if od is None else [s for s in sezony[:-2] if s >= od]
    obdobie_mn = set(obdobie)
    for s in obdobie:
        ob_sezon[obdobie_sezony(s)] += 1
    # PRÍCHODY sa dajú hodnotiť až od tretej sezóny okna. V prvej sezóne nový klub vzniknúť
    # nemôže (nemá sa voči čomu porovnať) a v druhej vyjde nafúknuto — objavia sa v nej všetky
    # kluby, ktoré si prvú sezónu okna vynechali. 2015/2016 tak má 74 „nových“ klubov oproti
    # 26 – 32 v ďalších sezónach; to je artefakt okna, nie realita.
    prichody_mn = set(sezony[2:]) & obdobie_mn
    for s in sorted(prichody_mn):
        ob_prichody_sezon[obdobie_sezony(s)] += 1

    def label(t: tuple[bool, bool, str | None]) -> str:
        mlad, dosp = t[0], t[1]
        if mlad and dosp:
            return "dospeli+mladez"
        return "len mladez" if mlad else "len dospeli"

    for v in kluby.values():
        poradia = sorted(idx[s] for s in v if s in idx)
        if not poradia:
            continue
        prva, posl = poradia[0], poradia[-1]
        for i in poradia:
            s = sezony[i]
            mlad, _, zvaz = v[s]
            if zvaz:
                z_po_sezonach[zvaz][s] += 1
            aktivni[s] += 1
            if mlad:
                aktivni_mlad[s] += 1
            kluc = "s mladezou" if mlad else "bez mladeze"
            if s in obdobie_mn and zvaz:
                z_klubosezony[zvaz] += 1
            if i == posl and i < posledna:
                zanik[s][kluc] += 1
                zanik[s]["spolu"] += 1
                zanik[s][label(v[s])] += 1
                if s in obdobie_mn:
                    ob_odchody[obdobie_sezony(s)] += 1
                    if zvaz:
                        z_odchody[zvaz] += 1
                        z_obdobia[zvaz][obdobie_sezony(s)] += 1
            elif i < posledna and sezony[i + 1] not in v:
                vypadok[s][kluc] += 1
                vypadok[s]["spolu"] += 1
            if i + 1 <= posledna and sezony[i + 1] in v:
                a, b = label(v[s]), label(v[sezony[i + 1]])
                if a != b:
                    prech[f"{a} -> {b}"] += 1
        s0 = sezony[prva]
        if prva > 0:
            prislo[s0]["s mladezou" if v[s0][0] else "bez mladeze"] += 1
            prislo[s0]["spolu"] += 1
            if s0 in prichody_mn:
                ob_prichody[obdobie_sezony(s0)] += 1
                if v[s0][2]:
                    z_prichody[v[s0][2]] += 1

    miery = {}
    for kluc, filtr in (("bez mladeze", False), ("s mladezou", True)):
        klubo_sezon = sum(
            1
            for v in kluby.values()
            for s in obdobie
            if s in v and v[s][0] is filtr
        )
        odchodov = sum(zanik[s][kluc] for s in obdobie)
        miery[kluc] = {
            "klubosezon": klubo_sezon,
            "odchodov": odchodov,
            "miera": round(100.0 * odchodov / klubo_sezon, 2) if klubo_sezon else None,
        }

    prva_s, posl_s = sezony[0], sezony[-1]
    reg = register or {}
    poc = pocty or {}
    zvazy_out = {}
    for zid in sorted(set(z_klubosezony) | set(z_odchody) | set(poc)):
        rad = poc.get(zid, {})
        a = rad.get(prva_s, 0)
        b = rad.get(posl_s, 0)
        ks = z_klubosezony[zid]
        zvazy_out[zid] = {
            "nazov": reg.get(zid, {}).get("nazov", zid),
            "uroven": reg.get(zid, {}).get("uroven"),
            "odchody": z_odchody[zid],
            "klubosezony": ks,
            "miera": round(100.0 * z_odchody[zid] / ks, 2) if ks else None,
            "prichody": z_prichody[zid],
            "poObdobiach": {n: z_obdobia[zid].get(n, 0) for n, _, _ in OBDOBIA},
            "klubovPrva": a,
            "klubovPosledna": b,
            "zmena": b - a,
            "zmenaPct": round(100.0 * (b - a) / a, 1) if a else None,
            "poSezonach": {s: rad.get(s, 0) for s in sezony},
            "domovskychPrva": z_po_sezonach[zid].get(prva_s, 0),
            "domovskychPosledna": z_po_sezonach[zid].get(posl_s, 0),
        }

    po_obdobiach = {}
    for n, _, _ in OBDOBIA:
        poc = ob_sezon[n]
        pocp = ob_prichody_sezon[n]
        po_obdobiach[n] = {
            "sezon": poc,
            "sezonPrichodov": pocp,
            "odchody": ob_odchody[n],
            "prichody": ob_prichody[n],
            "odchodovNaSezonu": round(ob_odchody[n] / poc, 1) if poc else None,
            "prichodovNaSezonu": round(ob_prichody[n] / pocp, 1) if pocp else None,
        }

    return {
        "sezony": sezony,
        "vynechane": {"nabehISSF": list(NABEH_ISSF), "prebiehajuca": prebiehajuca},
        "obdobie": obdobie,
        "aktivni": aktivni,
        "aktivniSMladezou": aktivni_mlad,
        "zanik": {s: dict(zanik[s]) for s in sezony[:-1]},
        "vypadok": {s: dict(vypadok[s]) for s in sezony[:-1]},
        "prislo": {s: dict(prislo[s]) for s in sezony[1:]},
        "prechody": dict(prech),
        "miery": miery,
        "zvazy": zvazy_out,
        "poObdobiach": po_obdobiach,
        "poznamka": (
            "Zánik = klub odohral svoju poslednú sezónu a nehral už v žiadnej nasledujúcej. "
            "Koniec v súťažiach dospelých nie je zánik, pokiaľ klub má mládež. "
            "Do analýzy nevstupujú sezóny nábehu ISSF (2012/2013, 2013/2014) ani prebiehajúca "
            "sezóna. Posledná hodnotená sezóna je provizórna — klub sa ešte môže vrátiť. "
            "Odchody a príchody sa prisudzujú DOMOVSKÉMU zväzu klubu (ten, v ktorom v danej "
            "sezóne odohral najviac zápasov) — klub zanikne raz, takže sa musí započítať raz. "
            "Domovský zväz sa ale medzi sezónami mení, preto 'klubovPrva/Posledna/zmena' pochádza "
            "z artefaktov bloku Počet klubov, kde je klub započítaný v každom zväze, v ktorého "
            "súťaži hral — to je číslo, ktoré zväz vidí na svojom profile. Príchody sa počítajú "
            "až od tretej sezóny okna; druhá sezóna okna je artefakt (objavia sa v nej všetky "
            "kluby, ktoré si prvú vynechali)."
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(REPO / "data"))
    ap.add_argument("--od", help="počítať miery odchodu od tejto sezóny, napr. 2018/2019")
    args = ap.parse_args()
    out_dir = Path(args.out)

    kluby = nacitaj(out_dir)
    vys_sezony = [s for s in sorted({s for v in kluby.values() for s in v})[:-1]
                  if s not in NABEH_ISSF]
    vys = analyza(kluby, args.od, register_zvazov(REPO), kluby_po_zvazoch(out_dir, vys_sezony))
    cesta = out_dir / "zanikanie.json"
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump({"generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(timespec="seconds"), **vys}, f, ensure_ascii=False, indent=1)

    print(f"klubov: {len(kluby)}, sezón: {len(vys['sezony'])}")
    print("sezóna | aktívnych | zanikli spolu | bez mládeže | s mládežou | z toho len mládež")
    for s in vys["sezony"][:-1]:
        z = vys["zanik"].get(s, {})
        print(
            f"{s} | {vys['aktivni'][s]} | {z.get('spolu', 0)} | {z.get('bez mladeze', 0)}"
            f" | {z.get('s mladezou', 0)} | {z.get('len mladez', 0)}"
        )
    print("\nmiery odchodu za", vys["obdobie"][0], "-", vys["obdobie"][-1])
    for k, m in vys["miery"].items():
        print(f"  {k}: {m['odchodov']} z {m['klubosezon']} klubo-sezón = {m['miera']} %")
    print("\nprechody stavov:")
    for k, n in sorted(vys["prechody"].items(), key=lambda x: -x[1]):
        print(f"  {k}: {n}")

    print("\npo obdobiach (odchody / príchody na sezónu):")
    for n, o in vys["poObdobiach"].items():
        print(f"  {n}: {o['odchody']} / {o['prichody']}"
              f"  ({o['odchodovNaSezonu']} odchodov z {o['sezon']} sezón,"
              f" {o['prichodovNaSezonu']} príchodov z {o['sezonPrichodov']} sezón)")

    print("\nzväzy — najvyššia miera odchodu:")
    for zid, z in sorted(vys["zvazy"].items(), key=lambda x: -(x[1]["miera"] or 0))[:10]:
        print(f"  {z['nazov'][:34]:34} {z['miera']:5} %  ({z['odchody']} z {z['klubosezony']}),"
              f" zmena {z['zmena']:+d}")
    print("\nzväzy — najväčší absolútny úbytok:")
    for zid, z in sorted(vys["zvazy"].items(), key=lambda x: x[1]["zmena"])[:10]:
        print(f"  {z['nazov'][:34]:34} {z['zmena']:+4d}  ({z['klubovPrva']} → {z['klubovPosledna']},"
              f" {z['zmenaPct']} %)")
    print(f"\nOK {cesta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
