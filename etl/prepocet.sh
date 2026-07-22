#!/bin/bash
# Prepočet do data/ — po jednotlivých zväzoch a sezónach (jemný, sledovateľný progres).
#   bash etl/prepocet.sh                     # futbal (zväzy + kluby) + futsal (SFZ zväz + kluby), všetky sezóny
#   bash etl/prepocet.sh 2025/2026           # len daná sezóna (futbal zväzy+kluby + futsal)
#   bash etl/prepocet.sh 2025/2026 zvazy     # len futbal zväzy, daná sezóna
#   bash etl/prepocet.sh "" kluby            # len futbal kluby, všetky sezóny
#   bash etl/prepocet.sh "" futsal           # len futsal (SFZ zväz + kluby), všetky sezóny
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
export SSL_CERT_FILE="$(./.venv/bin/python -c 'import certifi;print(certifi.where())')"
PY="./.venv/bin/python -u"
G() { grep --line-buffered -E "OK |klubov|CHYBA|Error|Traceback" || true; }
SEZONA="${1:-}"; MODE="${2:-vsetko}"
IDS=$(./.venv/bin/python -c "import json;d=json.load(open('etl/config/zvazy.json'));print(' '.join(z['id'] for u in ('sfz','rfz','obfz') for z in d.get(u,[])))")
if [ -n "$SEZONA" ]; then SEZONY="$SEZONA"; else
  SEZONY=$(./.venv/bin/python -c "import json;print(' '.join(json.load(open('etl/config/sezony.json'))['kanonicke']))")
fi
echo "START $(date '+%F %T') — mode=$MODE, zvazov=$(echo $IDS|wc -w|tr -d ' '), sezony: $SEZONY"
# 1) FUTBAL — zväzy per sezóna
if [ "$MODE" = "vsetko" ] || [ "$MODE" = "zvazy" ]; then
  for z in $IDS; do for s in $SEZONY; do
    echo "[zvaz] $z $s"; $PY etl/run.py --zvaz "$z" --sezona "$s" 2>&1 | G
  done; done
fi
# 2) FUTBAL — kluby per sezóna
if [ "$MODE" = "vsetko" ] || [ "$MODE" = "kluby" ]; then
  for s in $SEZONY; do echo "[kluby] $s"; $PY etl/kluby.py --sezona "$s" 2>&1 | G; done
fi
# 3) FUTSAL — SFZ zväz + kluby per sezóna (futsal žije pod SFZ na futsalslovakia.sk)
if [ "$MODE" = "vsetko" ] || [ "$MODE" = "futsal" ]; then
  for s in $SEZONY; do echo "[futsal-zvaz] $s"; $PY etl/run.py --zvaz sfz --sport-sector futsal --sezona "$s" 2>&1 | G; done
  for s in $SEZONY; do echo "[futsal-kluby] $s"; $PY etl/kluby.py --sport-sector futsal --sezona "$s" 2>&1 | G; done
fi
echo "DONE $(date '+%F %T')"
