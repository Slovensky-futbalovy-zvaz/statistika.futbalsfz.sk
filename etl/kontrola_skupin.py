#!/usr/bin/env python3
"""Kontrola invariantov metriky SKUPINY nad publikovanými dátami.

Súťažná skupina = základná časť súťaže (ADR-0009). Keďže databáza príznak typu
časti nenesie a `run.nacitaj_skupina_mapu` ho ODHADUJE dvoma sitami, musí sa po
každom behu overiť, že odhad nevyrobil nezmysel.

Kontrolované invarianty:

1. každý profil má `kpi.skupiny`;
2. **`skupiny >= sutaze` v KAŽDOM reze** (KPI, úroveň, kategória, `sutazeUroven`)
   — skupín nikdy nemôže byť menej než súťaží, súťaž má vždy aspoň jednu;
3. súčet `skupiny` cez `urovne` sa presne rovná `kpi.skupiny` — úroveň je
   disjunktná, súťaž má práve jednu;
4. porovnania nesú `skupiny` pre každý zväz.

Chyby končia nenulovým exit kódom. Do `data/` nezapisuje.

Použitie (z koreňa repozitára, po behu `sumar.py` a `porovnania.py`):

    python etl/kontrola_skupin.py
"""
from __future__ import annotations

import glob
import json
import sys

chyby: list[str] = []
varovania: list[str] = []
profilov = 0

for f in sorted(glob.glob("data/zvaz/*/*.json")):
    d = json.load(open(f, encoding="utf-8"))
    kpi = d.get("kpi") or {}
    if "skupiny" not in kpi:
        chyby.append(f"{f}: chýba kpi.skupiny")
        continue
    profilov += 1
    s, sk = kpi.get("sutaze", 0), kpi["skupiny"]

    if sk < s:
        chyby.append(f"{f}: kpi.skupiny {sk} < kpi.sutaze {s}")

    su = sum((u or {}).get("skupiny", 0) for u in (d.get("urovne") or {}).values())
    if su != sk:
        chyby.append(f"{f}: súčet úrovní (skupiny) {su} != kpi.skupiny {sk}")
    su_s = sum((u or {}).get("sutaze", 0) for u in (d.get("urovne") or {}).values())
    if su_s != s:
        varovania.append(f"{f}: súčet úrovní (sutaze) {su_s} != kpi.sutaze {s}")

    for kod, u in (d.get("urovne") or {}).items():
        u = u or {}
        if u.get("skupiny", 0) < u.get("sutaze", 0):
            chyby.append(f"{f}: úroveň {kod} skupiny < sutaze")
    for c, k in (d.get("kategorie") or {}).items():
        if k.get("skupiny", 0) < k.get("sutaze", 0):
            chyby.append(
                f"{f}: kategória {c} skupiny {k.get('skupiny')} < sutaze {k.get('sutaze')}"
            )
    for r in d.get("sutazeUroven") or []:
        if r.get("skupiny", 0) < r.get("sutaze", 0):
            chyby.append(
                f"{f}: riadok {r['uroven']}/{r['kat']}/{r['pohlavie']} skupiny < sutaze"
            )

print(f"PROFILOV: {profilov}")

for sez in ("2025/2026", "2024/2025"):
    slug = sez.replace("/", "-")
    try:
        sm = json.load(open(f"data/sumar/{slug}.json", encoding="utf-8"))
    except FileNotFoundError:
        continue
    print(f"SÚHRN {sez}: súťaže {sm['kpi'].get('sutaze')}, skupiny {sm['kpi'].get('skupiny')}")
    for uz, v in (sm.get("sutazePodlaRiadiacehoZvazu") or {}).items():
        if isinstance(v, dict):
            print(f"   {uz}: súťaže {v.get('sutaze')}, skupiny {v.get('skupiny')}")

for uroven in ("rfz", "obfz"):
    for p in sorted(glob.glob(f"data/porovnania/{uroven}/*.json")):
        d = json.load(open(p, encoding="utf-8"))
        bez = [z["id"] for z in d.get("zvazy", []) if "skupiny" not in z]
        if bez:
            chyby.append(f"{p}: {len(bez)} zväzov bez skupín ({', '.join(bez[:5])}…)")

print(f"\nCHYBY: {len(chyby)}")
for c in chyby:
    print("  ", c)
print(f"VAROVANIA: {len(varovania)}")
for c in varovania:
    print("  ", c)

sys.exit(1 if chyby else 0)
