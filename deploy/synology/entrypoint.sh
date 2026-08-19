#!/bin/sh
# Tyzdenna aktualizacia na Synology (Docker). Stiahne repo, prepocita sezony podla planu
# (etl/tyzdenna.py), commitne a pushne zmeny -> Vercel nasadi.
#
# AUTOR COMMITU: musi byt jan.letko@icloud.com. Vercel commity z domeny @futbalsfz.sk
# BLOKUJE (v historii projektu su dva BLOCKED deploye) — push by presiel, build by sa
# nespustil a skript by skoncil "uspesne". Preto sa tu pouziva presne ta identita, ktora
# je overena na existujucich commitoch; automat je oznaceny v sprave commitu.
#
# CIASTOCNY BEH: ak niektory ETL krok zlyha, zmeny sa aj tak publikuju (lepsie cerstve
# data z 42 zvazov nez zamrznuty portal), ale sprava commitu je oznacena ako CIASTOCNA a
# skript skonci nenulovym kodom -> Task Scheduler posle e-mail. Sezony, ktore spadli,
# nemaju potvrdeny odtlacok, takze sa prepocitaju pri najblizsom behu.
set -u

REPO_SLUG="${REPO_SLUG:-Slovensky-futbalovy-zvaz/statistika.futbalsfz.sk}"
DIR=/work/repo
LOG=/tmp/tyzdenna.log

# AUTENTIFIKACIA VOCI GITHUBU — dve podporovane cesty:
#
#  A) GITHUB_TOKEN v .env  -> push cez HTTPS. Pouzi, ked su v organizacii zakazane deploy
#     keys (stav k 17. 8. 2026: "Deploy keys are disabled for this repository"). Staci
#     fine-grained token s pravom Contents: Read and write na tento jediny repozitar.
#
#  B) /keys/deploy_key     -> push cez SSH deploy key. Bezpecnejsie (viazane na jeden
#     repozitar, bez identity pouzivatela), ale vyzaduje, aby organizacia deploy keys
#     povolila.
#
# Token sa NIKDY nevypisuje do logu — remote sa nastavuje az v ramci prikazu.
if [ -n "${GITHUB_TOKEN:-}" ]; then
  REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO_SLUG}.git"
  echo ">>> Autentifikacia: HTTPS token"
elif [ -f /keys/deploy_key ]; then
  REPO_URL="git@github.com:${REPO_SLUG}.git"
  # SSH odmietne privatny kluc s prilis volnymi pravami ("UNPROTECTED PRIVATE KEY FILE").
  # Subor nahrany cez DSM File Station prava 600 nema a v GUI sa nedaju pohodlne nastavit,
  # preto sa kluc skopiruje do kontajnera a prava sa nastavia tu. /keys zostava read-only.
  mkdir -p /tmp/.ssh
  cp /keys/deploy_key /tmp/.ssh/deploy_key
  chmod 600 /tmp/.ssh/deploy_key
  export GIT_SSH_COMMAND="ssh -i /tmp/.ssh/deploy_key -o StrictHostKeyChecking=accept-new"
  echo ">>> Autentifikacia: SSH deploy key"
else
  echo "CHYBA: chyba GITHUB_TOKEN v .env aj /keys/deploy_key — bez jedneho z nich sa nedá pushnut."
  exit 1
fi

# Prihlasovacie udaje sa pouzivaju len v prikazoch, NEuklada sa do .git/config — inak by
# token zostal v citatelnej podobe v repozitari na NAS. Preto sa `origin` prepisuje na
# cistu URL a fetch/push dostavaju "$REPO_URL" priamo.
CLEAN_URL="https://github.com/${REPO_SLUG}.git"
if [ -d "$DIR/.git" ]; then
  echo ">>> Aktualizujem repo…"
  cd "$DIR" || exit 1
  git fetch --quiet "$REPO_URL" main || exit 1
  git reset --hard --quiet FETCH_HEAD || exit 1
else
  echo ">>> Klonujem repo…"
  git clone --quiet "$REPO_URL" "$DIR" || exit 1
  cd "$DIR" || exit 1
  git remote set-url origin "$CLEAN_URL"
fi

git config user.name "Ján Letko"
git config user.email "jan.letko@icloud.com"
export SSL_CERT_FILE="$(python -c 'import certifi; print(certifi.where())')"

# Argumenty behu. SEZONA = rucny prepocet jednej sezony, MAX_SEZON = strop sezon na beh.
set -- 
if [ -n "${SEZONA:-}" ]; then
  set -- --sezona "$SEZONA"
elif [ -n "${MAX_SEZON:-}" ]; then
  set -- --max-sezon "$MAX_SEZON"
fi

# POZOR: v POSIX sh nie je PIPESTATUS, takze `... | tee` by vratilo kod tee, nie Pythonu.
# Navratovy kod ETL sa preto prenesie cez subor.
RCF=/tmp/tyzdenna.rc
{ python etl/tyzdenna.py "$@"; echo $? > "$RCF"; } 2>&1 | tee "$LOG"
ETL_RC="$(cat "$RCF" 2>/dev/null || echo 1)"

SEZONY="$(grep -m1 'na prepocet' "$LOG" | sed 's/.*): //')"
[ -n "$SEZONY" ] || SEZONY="${SEZONA:-neurcene}"
if [ "$ETL_RC" -eq 0 ]; then
  STAV=""
else
  STAV=" — CIASTOCNY BEH, chyby v logu"
  echo ">>> POZOR: ETL skoncilo s chybami (kod $ETL_RC). Zmeny sa aj tak publikuju."
fi

git add data
if git diff --cached --quiet; then
  echo ">>> Ziadne zmeny dat — nic sa necommituje."
else
  git commit -q -m "Tyzdenna aktualizacia statistik ($(date +%F)): ${SEZONY}${STAV}

Automaticky beh na Synology NAS (deploy/synology). Prepocitane sezony: ${SEZONY}."
  git push --quiet "$REPO_URL" HEAD:main || exit 1
  echo ">>> Pushnute do main -> Vercel build."
fi

exit "$ETL_RC"
