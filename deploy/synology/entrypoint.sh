#!/bin/sh
# Týždenná aktualizácia na Synology (Docker). Stiahne repo, prepočíta aktuálnu
# sezónu (etl/tyzdenna.py), commitne a pushne zmeny → Vercel nasadí.
set -eu

REPO_URL="${REPO_URL:-git@github.com:Slovensky-futbalovy-zvaz/statistika.futbalsfz.sk.git}"
DIR=/work/repo
export GIT_SSH_COMMAND="ssh -i /keys/deploy_key -o StrictHostKeyChecking=accept-new"

if [ -d "$DIR/.git" ]; then
  echo ">>> Aktualizujem repo…"
  cd "$DIR"
  git fetch --quiet origin main
  git reset --hard --quiet origin/main
else
  echo ">>> Klonujem repo…"
  git clone --quiet "$REPO_URL" "$DIR"
  cd "$DIR"
fi

git config user.name "SFZ ETL bot"
git config user.email "etl-bot@futbalsfz.sk"
export SSL_CERT_FILE="$(python -c 'import certifi; print(certifi.where())')"

if [ -n "${SEZONA:-}" ]; then
  python etl/tyzdenna.py --sezona "$SEZONA"
else
  python etl/tyzdenna.py
fi

git add data
if git diff --cached --quiet; then
  echo ">>> Žiadne zmeny dát — nič sa necommituje."
else
  git commit -q -m "Týždenná aktualizácia štatistík ($(date +%F))"
  git push --quiet origin main
  echo ">>> Pushnuté do main → Vercel build."
fi
