#!/usr/bin/env python3
"""Zanikanie klubov — s mládežou vs. bez mládeže.

Zadanie Ján Letko (14. 8. 2026): koľko klubov definitívne zaniká a v akom stave boli, keď
naposledy hrali. ZÁSADNÉ PRAVIDLO: koniec klubu v súťažiach dospelých NIE JE zánik klubu,
pokiaľ klub má mládež — zánik je až to, keď klub prestane hrať úplne.

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


def stav_klubu(p: Path) -> tuple[bool, bool]:
    """(má mládež, má dospelých) podľa vekových kategórií, v ktorých klub v sezóne hral."""
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    kat = set((d.get("kategorie") or {}).keys())
    return (bool(kat - {"ADULTS"}), "ADULTS" in kat)


def nacitaj(out_dir: Path) -> dict[str, dict[str, tuple[bool, bool]]]:
    kluby: dict[str, dict[str, tuple[bool, bool]]] = {}
    for d in sorted((out_dir / "klub").iterdir()):
        if not d.is_dir():
            continue
        pre_sezony: dict[str, tuple[bool, bool]] = {}
        for f in sorted(d.iterdir()):
            m = SEZ_RE.match(f.name)
            if m:
                pre_sezony[f"{m.group(1)}/{m.group(2)}"] = stav_klubu(f)
        if pre_sezony:
            kluby[d.name] = pre_sezony
    return kluby


# Sezóny, ktoré sa do analýzy nesmú dostať (rozhodnutia Ján Letko, 14. 8. 2026):
# 2012/2013 a 2013/2014 = nábeh ISSF (evidencia nie je úplná, „nové“ kluby sú dobiehajúce dáta),
# posledná sezóna v dátach = prebiehajúca (klub, ktorý v nej ešte nehral, nezanikol).
NABEH_ISSF = ("2012/2013", "2013/2014")


def analyza(kluby: dict, od: str | None = None) -> dict:
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

    def label(t: tuple[bool, bool]) -> str:
        mlad, dosp = t
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
            mlad, _ = v[s]
            aktivni[s] += 1
            if mlad:
                aktivni_mlad[s] += 1
            kluc = "s mladezou" if mlad else "bez mladeze"
            if i == posl and i < posledna:
                zanik[s][kluc] += 1
                zanik[s]["spolu"] += 1
                zanik[s][label(v[s])] += 1
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

    # miera odchodu za spoľahlivé obdobie (bez prvých dvoch a posledných dvoch sezón)
    # posledná sezóna okna sa hodnotiť nedá (nemá nasledujúcu) a predchádzajúca je provizórna
    obdobie = sezony[:-2] if od is None else [s for s in sezony[:-2] if s >= od]
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
        "poznamka": (
            "Zánik = klub odohral svoju poslednú sezónu a nehral už v žiadnej nasledujúcej. "
            "Koniec v súťažiach dospelých nie je zánik, pokiaľ klub má mládež. "
            "Do analýzy nevstupujú sezóny nábehu ISSF (2012/2013, 2013/2014) ani prebiehajúca "
            "sezóna. Posledná hodnotená sezóna je provizórna — klub sa ešte môže vrátiť."
        ),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(REPO / "data"))
    ap.add_argument("--od", help="počítať miery odchodu od tejto sezóny, napr. 2018/2019")
    args = ap.parse_args()
    out_dir = Path(args.out)

    kluby = nacitaj(out_dir)
    vys = analyza(kluby, args.od)
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
    print(f"\nOK {cesta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
