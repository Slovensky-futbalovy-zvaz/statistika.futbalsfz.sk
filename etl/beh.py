#!/usr/bin/env python3
"""Dávkový runner ETL — plný beh cez všetky zväzy.

Znovu používa funkcie z etl/run.py so ZDIEĽANÝM DB spojením (efektívnejšie než
spúšťať run.py 43×). Iteruje zväzy v poradí SFZ → RFZ → ObFZ po regiónoch
(BFZ, ZsFZ, SsFZ, VsFZ) — poradie dané rozhodnutím PO 13. 7. 2026.

Správanie pri chybách (rozhodnutie PO 13. 7. 2026): dátové anomálie sa NEzastavujú
beh — zbierajú sa a reportujú na konci. Beh sa zastaví LEN pri systémovej chybe
(výpadok/nedostupnosť DB spojenia).

Použitie:
    export MONGODB_URI="mongodb+srv://…"
    export SSL_CERT_FILE=$(python -c 'import certifi; print(certifi.where())')
    python etl/beh.py --sezona 2025/2026          # VLNA 1: jedna sezóna, všetkých 43 zväzov
    python etl/beh.py --all-sezony                 # VLNA 2: všetky kanonické sezóny s dátami
    python etl/beh.py --sezona 2025/2026 --od zsfz # pokračovať od zadaného zväzu (podľa poradia)

Výstup: data/zvaz/{id}/{sezona}.json + data/index.json (rovnako ako run.py).
Súhrn behu (JSON) sa vypíše na stdout a zapíše do --sumar (default /tmp/beh-sumar.json).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import traceback
from datetime import datetime, timezone, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "etl"))

import run  # noqa: E402  — znovu použité funkcie ETL
import validate  # noqa: E402

log = logging.getLogger("beh")

#: Poradie RFZ (a tým aj poradie regiónov pre ObFZ) — rozhodnutie PO 13. 7. 2026.
RFZ_PORADIE = ["bfz", "zsfz", "ssfz", "vsfz"]


def zoznam_zvazov(zvazy: dict) -> list[dict]:
    """Zväzy v poradí SFZ → RFZ (BFZ, ZsFZ, SsFZ, VsFZ) → ObFZ po regiónoch.

    V rámci regiónu sa zachová poradie z registra zvazy.json.
    """
    poradie: list[dict] = list(zvazy.get("sfz", []))
    rfz_podla_id = {r["id"]: r for r in zvazy.get("rfz", [])}
    for rfz_id in RFZ_PORADIE:
        if rfz_id in rfz_podla_id:
            poradie.append(rfz_podla_id[rfz_id])
    for rfz_id in RFZ_PORADIE:
        poradie += [o for o in zvazy.get("obfz", []) if o.get("rfz") == rfz_id]
    # poistka: ObFZ s neznámym/chýbajúcim rfz (nemalo by nastať) na koniec
    zname = {rfz_id for rfz_id in RFZ_PORADIE}
    poradie += [o for o in zvazy.get("obfz", []) if o.get("rfz") not in zname]
    return poradie


def je_systemova_chyba(e: BaseException) -> bool:
    """Systémová chyba = výpadok/nedostupnosť DB spojenia → beh sa zastaví."""
    try:
        from pymongo.errors import (
            AutoReconnect,
            ConnectionFailure,
            NetworkTimeout,
            ServerSelectionTimeoutError,
        )
    except Exception:  # noqa: BLE001
        return False
    return isinstance(
        e, (ConnectionFailure, ServerSelectionTimeoutError, AutoReconnect, NetworkTimeout)
    )


def teraz() -> str:
    return datetime.now(timezone(timedelta(hours=2))).isoformat(timespec="seconds")


def main() -> int:
    ap = argparse.ArgumentParser(description="Dávkový ETL beh cez všetky zväzy")
    grp = ap.add_mutually_exclusive_group(required=True)
    grp.add_argument("--sezona", help="kanonická sezóna, napr. 2025/2026 (vlna 1)")
    grp.add_argument("--all-sezony", action="store_true", help="všetky kanonické sezóny (vlna 2)")
    ap.add_argument("--od", help="pokračovať od tohto id zväzu (podľa poradia behu)")
    ap.add_argument("--mongodb-uri", help="connection string (default: env MONGODB_URI)")
    ap.add_argument("--db", default="sutaze", help="názov databázy (default: sutaze)")
    ap.add_argument("--out", default=str(REPO / "data"), help="výstupný priečinok (default: data/)")
    ap.add_argument("--sumar", default="/tmp/beh-sumar.json", help="cesta k JSON súhrnu behu")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    zvazy = run.load_json(run.CONFIG / "zvazy.json")
    sezony_cfg = run.load_json(run.CONFIG / "sezony.json")
    roly = run.load_json(run.CONFIG / "roly.json")
    korekcie = run.load_json(run.CONFIG / "korekcie.json") if (run.CONFIG / "korekcie.json").exists() else {}
    out_dir = Path(args.out)

    poradie = zoznam_zvazov(zvazy)
    if args.od:
        ids = [z["id"] for z in poradie]
        if args.od not in ids:
            raise SystemExit(f"--od {args.od!r} nie je medzi zväzmi: {ids}")
        poradie = poradie[ids.index(args.od):]

    sezony = sezony_cfg["kanonicke"] if args.all_sezony else [args.sezona]
    # overenie sezón vopred (rýchle zlyhanie na preklep)
    for s in sezony:
        run.sezona_varianty(sezony_cfg, s)

    db = run.pripoj_db(args.mongodb_uri, args.db)
    # ping — ak DB nedostupná, je to systémová chyba a beh nemá zmysel začínať
    db.command("ping")

    log.info(
        "=== DÁVKOVÝ BEH: %d zväzov × %d sezón (%s) ===",
        len(poradie), len(sezony),
        args.sezona if args.sezona else "všetky kanonické",
    )

    sumar = {
        "start": teraz(),
        "sezony": sezony,
        "pocetZvazov": len(poradie),
        "zvazy": [],
        "anomalieSpolu": 0,
        "systemovaChyba": None,
    }
    hotovo = 0

    try:
        for i, zvaz in enumerate(poradie, 1):
            zaznam = {
                "id": zvaz["id"], "nazov": zvaz["nazov"], "uroven": zvaz.get("uroven", "ObFZ"),
                "sezony": [], "preskocene": [], "anomalie": [], "chyba": None,
            }
            log.info("[%d/%d] %s (%s)", i, len(poradie), zvaz["nazov"], zvaz["id"])
            try:
                for sezona in sezony:
                    varianty = run.sezona_varianty(sezony_cfg, sezona)
                    doc = run.vygeneruj(db, zvaz, sezona, varianty, roly, corrections=korekcie)
                    if doc is None:
                        zaznam["preskocene"].append(sezona)
                        log.info("    %s: žiadne uzavreté zápasy — preskakujem.", sezona)
                        continue
                    anomalie = validate.validuj(doc)
                    for a in anomalie:
                        log.warning("    ANOMÁLIA %s/%s: %s", zvaz["id"], sezona, a)
                        zaznam["anomalie"].append({"sezona": sezona, "anomalia": a})
                    cesta = run.zapis(doc, out_dir)
                    zaznam["sezony"].append({
                        "sezona": sezona,
                        "zapasy": doc["kpi"]["zapasy"],
                        "druzstva": doc["kpi"]["druzstva"],
                        "goly": doc["kpi"]["goly"],
                        "hraci": doc["osoby"]["hraci"]["unikatni"],
                        "subor": str(cesta.relative_to(REPO)) if cesta.is_relative_to(REPO) else str(cesta),
                    })
                    log.info(
                        "    OK %s — zápasy %d, družstvá %d, góly %d, hráči %d",
                        sezona, doc["kpi"]["zapasy"], doc["kpi"]["druzstva"],
                        doc["kpi"]["goly"], doc["osoby"]["hraci"]["unikatni"],
                    )
                # index.json (futbal) — upsert zväzu podľa reálne existujúcich súborov
                run.aktualizuj_index(out_dir, zvaz, zvazy)
                hotovo += 1
            except Exception as e:  # noqa: BLE001
                if je_systemova_chyba(e):
                    zaznam["chyba"] = f"SYSTÉMOVÁ: {e}"
                    sumar["zvazy"].append(zaznam)
                    sumar["systemovaChyba"] = {"zvaz": zvaz["id"], "chyba": str(e)}
                    log.error("SYSTÉMOVÁ CHYBA pri %s — beh sa zastavuje: %s", zvaz["id"], e)
                    raise
                # dátová/lokálna chyba jedného zväzu — zaloguj a pokračuj
                zaznam["chyba"] = str(e)
                log.error("CHYBA pri %s (pokračujem): %s\n%s", zvaz["id"], e, traceback.format_exc())
            sumar["zvazy"].append(zaznam)
            sumar["anomalieSpolu"] += len(zaznam["anomalie"])
    finally:
        sumar["koniec"] = teraz()
        sumar["hotovoZvazov"] = hotovo
        with open(args.sumar, "w", encoding="utf-8") as f:
            json.dump(sumar, f, ensure_ascii=False, indent=2)
        log.info(
            "=== KONIEC: %d/%d zväzov, anomálií spolu %d, súhrn: %s ===",
            hotovo, len(poradie), sumar["anomalieSpolu"], args.sumar,
        )
        print(json.dumps(sumar, ensure_ascii=False, indent=2))

    # nenulový exit len pri systémovej chybe; dátové anomálie nezastavujú beh
    return 2 if sumar["systemovaChyba"] else 0


if __name__ == "__main__":
    sys.exit(main())
