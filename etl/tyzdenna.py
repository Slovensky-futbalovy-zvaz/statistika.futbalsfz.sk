#!/usr/bin/env python3
"""Týždenná aktualizácia štatistík — prepočíta LEN aktuálnu sezónu a odvodené agregáty.

Historické sezóny sú nemenné, preto sa negenerujú opakovane. Orchestruje existujúce
ETL skripty (bez vlastnej DB logiky). Negituje — commit/push rieši CI workflow
(.github/workflows/tyzdenna.yml).

Poradie:
  1. run.py --zvaz <id> --sezona <S>            (43 zväzov, futbal)
  2. run.py --zvaz sfz --sezona <S> --sport-sector futsal
  3. demografia.py --zvaz <id> --sezona <S>     (43 zväzov, zdroj sportnet.users)
  4. kluby.py --sezony <S> --index-sezona <S>   (index sa prestavia skenom disku → história ostáva)
  5. porovnania.py        (odvodené z profilov, bez DB)
  6. sumar.py             (odvodené z profilov, bez DB)
  7. projekty.py          (grassroots projekty)

Použitie:
    export MONGODB_URI="mongodb+srv://…"
    export SSL_CERT_FILE=$(python -c 'import certifi; print(certifi.where())')
    python etl/tyzdenna.py                 # aktuálna sezóna podľa dátumu
    python etl/tyzdenna.py --sezona 2025/2026
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ETL = REPO / "etl"
CONFIG = ETL / "config"
PY = sys.executable


def aktualna_sezona(dnes: date | None = None) -> str:
    """Súťažná sezóna 1.7.–30.6. → 'RRRR/RRRR+1'."""
    d = dnes or date.today()
    zac = d.year if d.month >= 7 else d.year - 1
    return f"{zac}/{zac + 1}"


def zvaz_ids() -> list[str]:
    z = json.loads((CONFIG / "zvazy.json").read_text(encoding="utf-8"))
    return [x["id"] for grp in ("sfz", "rfz", "obfz") for x in z.get(grp, [])]


def spusti(args: list[str], nazov: str, chyby: list[str]) -> None:
    """Spustí ETL krok; zlyhanie zaznamená, ale nezastaví celý beh."""
    print(f"\n>>> {nazov}: {' '.join(args)}", flush=True)
    r = subprocess.run([PY, *args], cwd=str(REPO))
    if r.returncode != 0:
        print(f"!!! ZLYHALO ({r.returncode}): {nazov}", flush=True)
        chyby.append(nazov)


def main() -> int:
    ap = argparse.ArgumentParser(description="Týždenná aktualizácia (aktuálna sezóna)")
    ap.add_argument("--sezona", help="kanonická sezóna (default: podľa dátumu)")
    ap.add_argument("--index-sezona", help="referenčná sezóna pre rebríček klubov (default: --sezona)")
    args = ap.parse_args()

    sez = args.sezona or aktualna_sezona()
    idx_sez = args.index_sezona or sez
    ids = zvaz_ids()
    chyby: list[str] = []
    print(f"=== Týždenná aktualizácia — sezóna {sez} ({len(ids)} zväzov) ===", flush=True)

    # 1) zväzy — futbal
    for zid in ids:
        spusti(["etl/run.py", "--zvaz", zid, "--sezona", sez], f"run {zid}", chyby)
    # 2) futsal (len SFZ)
    spusti(["etl/run.py", "--zvaz", "sfz", "--sezona", sez, "--sport-sector", "futsal"], "run sfz futsal", chyby)
    # 3) demografia — futbal
    for zid in ids:
        spusti(["etl/demografia.py", "--zvaz", zid, "--sezona", sez], f"demografia {zid}", chyby)
    # 4) kluby (aktuálna sezóna; index skenom disku → história ostáva)
    spusti(["etl/kluby.py", "--sezony", sez, "--index-sezona", idx_sez], "kluby", chyby)
    # 5) odvodené agregáty (bez DB)
    spusti(["etl/porovnania.py"], "porovnania", chyby)
    spusti(["etl/sumar.py"], "sumar", chyby)
    # 6) projekty
    spusti(["etl/projekty.py"], "projekty", chyby)

    if chyby:
        print(f"\n=== DOKONČENÉ s {len(chyby)} chybami: {', '.join(chyby)} ===", flush=True)
        return 1
    print("\n=== DOKONČENÉ bez chýb ===", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
