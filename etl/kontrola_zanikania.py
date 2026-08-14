#!/usr/bin/env python3
"""Kontrola definície zániku klubu — diagnostika, nič nezapisuje.

Zadanie Ján Letko (14. 8. 2026): „nedá mi to zanikanie klubov, naozaj toľko klubov zaniklo?“
Tento skript odpovedá tromi meraniami nad tými istými artefaktmi, nad ktorými beží
`etl/zanikanie.py` (`data/klub/{klub}/{sezona}.json`), takže sa dá kedykoľvek zopakovať:

1. **Uzávierka.** Koľko klubov v okne vôbec hralo, koľko hrá v poslednej sezóne a či rozdiel
   sedí na súčet odchodov. Ak sedí, číslo zánikov nie je odhad, je to odčítanie.
2. **Diery a návratnosť.** Koľko klubov si dalo pauzu a vrátilo sa, a aká je pravdepodobnosť,
   že sa „zaniknutý“ klub ešte vráti — podľa toho, koľko sezón už nehral. Z toho vidno, ktoré
   kohorty sú definitívne a ktoré provizórne.
3. **Kandidáti na právneho nástupcu.** Nový subjekt v ISSF nie je nutne nový klub — pri novej
   registrácii (napr. transformácia na s. r. o.) vznikne nové organization ID bez väzby na
   predchodcu. Párovanie podľa normalizovaného názvu dá DOLNÚ hranicu takých prípadov.

Párovanie názvov je heuristika a **do publikovaných dát nevstupuje** — `data/zanikanie.json`
nesie len merané toky. Preto je to samostatná kontrola, nie súčasť `zanikanie.py`.

Použitie:
    python etl/kontrola_zanikania.py
"""
from __future__ import annotations

import argparse
import collections
import json
import re
import unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SEZ_RE = re.compile(r"^(\d{4})-(\d{4})\.json$")  # bez -{sektor} = futbal
NABEH_ISSF = ("2012/2013", "2013/2014")
PREBIEHA = "2026/2027"

# právne formy a generické názvy, ktoré o identite klubu nehovoria nič
VYPLN = {
    "tj", "fk", "ofk", "mfk", "sk", "tsk", "ktj", "fc", "mstk", "stk", "zsk", "as", "ac",
    "pfk", "sfc", "sfk", "mska", "msk", "kfc", "csk", "slavia", "lokomotiva", "druzstevnik",
    "partizan", "sokol", "iskra", "dynamo", "slovan", "tatran", "tatra", "pokrok", "hviezda",
    "jednota", "ozeta", "odeva", "futbalovy", "klub", "obec", "sportovy", "telovychovna",
    "zdruzenie", "mladeze",
}


def normalizuj(nazov: str) -> str:
    """Názov bez diakritiky, právnej formy a generických slov — na párovanie nástupcov."""
    n = unicodedata.normalize("NFKD", nazov.lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    slova = [w for w in n.split() if len(w) >= 4 and w not in VYPLN]
    return " ".join(sorted(set(slova)))


def nacitaj(out_dir: Path) -> dict[str, dict[str, Path]]:
    kluby: dict[str, dict[str, Path]] = {}
    for d in sorted((out_dir / "klub").iterdir()):
        if not d.is_dir():
            continue
        pre: dict[str, Path] = {}
        for f in d.iterdir():
            m = SEZ_RE.match(f.name)
            if m:
                pre[f"{m.group(1)}/{m.group(2)}"] = f
        if pre:
            kluby[d.name] = pre
    return kluby


def nazov(p: Path) -> str:
    d = json.load(open(p, encoding="utf-8"))
    return d.get("nazov") or d.get("name") or ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(REPO / "data"))
    ap.add_argument("--priklady", type=int, default=20, help="koľko párov nástupcov vypísať")
    args = ap.parse_args()

    vsetko = nacitaj(Path(args.out))
    okno = [
        s for s in sorted({s for v in vsetko.values() for s in v})
        if s not in NABEH_ISSF and s != PREBIEHA
    ]
    idx = {s: i for i, s in enumerate(okno)}
    posledna = len(okno) - 1
    kluby = {k: sorted(idx[s] for s in v if s in idx) for k, v in vsetko.items()}
    kluby = {k: v for k, v in kluby.items() if v}

    print(f"okno: {okno[0]} – {okno[-1]}")

    # 1. uzávierka
    prva = sum(1 for v in kluby.values() if 0 in v)
    posl = sum(1 for v in kluby.values() if posledna in v)
    odchody = sum(1 for v in kluby.values() if v[-1] < posledna)
    prichody = sum(1 for v in kluby.values() if v[0] > 0)
    print(f"\n1. UZÁVIERKA\n   klubov v okne: {len(kluby)}"
          f"\n   hralo v {okno[0]}: {prva} | hrá v {okno[-1]}: {posl}"
          f"\n   definitívnych odchodov: {odchody} | príchodov: {prichody}")
    print(f"   kontrola: {len(kluby)} − {odchody} = {len(kluby) - odchody}"
          f" (má byť {posl}) → {'OK' if len(kluby) - odchody == posl else 'NESEDÍ'}")
    print(f"   kontrola: {prva} − {odchody} + {prichody} = {prva - odchody + prichody}"
          f" (má byť {posl}) → {'OK' if prva - odchody + prichody == posl else 'NESEDÍ'}")

    # 2. diery a návratnosť
    s_dierou = 0
    dlzky = collections.Counter()
    vratil = collections.Counter()
    chybal = collections.Counter()
    for v in kluby.values():
        mal = False
        for a, b in zip(v, v[1:]):
            if b - a > 1:
                mal = True
                dlzky[b - a - 1] += 1
        s_dierou += mal
        for i in v:
            buduce = [j for j in v if j > i]
            if not buduce:
                for x in range(1, posledna - i + 1):
                    chybal[x] += 1
                continue
            diera = buduce[0] - i - 1
            if diera > 0:
                for x in range(1, diera + 1):
                    chybal[x] += 1
                vratil[diera] += 1
    print(f"\n2. DIERY A NÁVRATNOSŤ\n   klubov s aspoň jednou dierou: {s_dierou} z {len(kluby)}"
          f"\n   dĺžky dier (sezón): {dict(sorted(dlzky.items()))}")
    print("   z klubov, ktoré už nehrali x sezón, sa ešte vrátilo:")
    for x in range(1, 6):
        baza = chybal[x]
        if not baza:
            continue
        vrat = sum(n for d, n in vratil.items() if d >= x)
        print(f"     po {x} sezónach: {vrat} z {baza} = {100.0 * vrat / baza:.1f} %")
    kohorty = collections.Counter(okno[v[-1]] for v in kluby.values() if v[-1] < posledna)
    print("   posledné dve kohorty sú preto provizórne: "
          + ", ".join(f"{s}: {kohorty[s]}" for s in okno[posledna - 2:posledna]))

    # 3. kandidáti na právneho nástupcu
    mrtvi = collections.defaultdict(list)
    for k, v in kluby.items():
        if v[-1] < posledna:
            s = okno[v[-1]]
            n = normalizuj(nazov(vsetko[k][s]))
            if n:
                mrtvi[n].append((k, v[-1], nazov(vsetko[k][s])))
    pary = []
    for k, v in kluby.items():
        if v[0] == 0:
            continue
        s = okno[v[0]]
        n = normalizuj(nazov(vsetko[k][s]))
        for k2, i2, nz2 in mrtvi.get(n, []):
            if k2 != k and v[0] >= i2:      # nástupca sa objavil až po odchode predchodcu
                pary.append((nz2, okno[i2], nazov(vsetko[k][s]), s))
    print(f"\n3. KANDIDÁTI NA PRÁVNEHO NÁSTUPCU (dolná hranica): {len(pary)}")
    for a, sa, b, sb in pary[: args.priklady]:
        print(f"   {a!r} ({sa}) → {b!r} ({sb})")
    print(f"\n   → odchodov {odchody} je HORNÁ hranica, príchodov {prichody} tiež."
          f"\n   Stavy klubov a miery odchodu to neskresľuje, toky áno.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
