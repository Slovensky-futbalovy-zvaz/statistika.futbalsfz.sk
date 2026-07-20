# Týždenná aktualizácia na Synology (Docker + Task Scheduler)

Beh prebieha lokálne na Synology NAS → von ide cez **jednu statickú verejnú IP**,
ktorú stačí povoliť v MongoDB Atlas. Databáza sa neotvára do sveta.

Súbory: `deploy/synology/` (Dockerfile, entrypoint.sh, docker-compose.yml, .env.example).

## 1. Príprava na NAS

1. **Container Manager** (Package Center → nainštaluj, ak chýba).
2. Vytvor priečinok, napr. `/volume1/docker/sfz-etl/`, a skopíruj doň obsah
   `deploy/synology/` (Dockerfile, entrypoint.sh, docker-compose.yml).
3. Podpriečinky:
   - `keys/` → sem daj **SSH deploy key** s právom zápisu do repa (súbor `keys/deploy_key`, práva 600).
   - `.env` → skopíruj z `.env.example` a doplň `MONGODB_URI` (read-only účet).
   - `repo/` sa vytvorí sám pri prvom behu (perzistentný klon).

## 2. GitHub deploy key (push z NAS)

1. Na NAS vygeneruj kľúč: `ssh-keygen -t ed25519 -f keys/deploy_key -N ""`.
2. V GitHube: repo → *Settings → Deploy keys → Add deploy key* → vlož obsah
   `keys/deploy_key.pub`, **zaškrtni „Allow write access"**.

## 3. MongoDB Atlas allowlist

- *Network Access → Add IP Address* → pridaj **statickú verejnú IP** vašej siete.
- Účet nech je **read-only** na `sutaze` a `sportnet.users` (polia `birthdate`, `sex`).

## 4. Build image + test

V SSH na NAS (alebo cez Container Manager → Project):
```bash
cd /volume1/docker/sfz-etl
sudo docker compose build
sudo docker compose run --rm etl        # testovací beh (prepočíta aktuálnu sezónu, commit+push)
```
Prvý beh naklonuje repo a prebehne ETL; skontroluj, že vznikol commit „Týždenná
aktualizácia štatistík …" a Vercel spustil build.

## 5. Naplánovanie (Task Scheduler)

*Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script*:
- **User:** `root` (alebo účet s právom na docker), **Schedule:** týždenne, napr. pondelok 03:00.
- **Run command:**
  ```bash
  cd /volume1/docker/sfz-etl && /usr/local/bin/docker compose run --rm etl
  ```
  (cesta k `docker` môže byť `/usr/bin/docker` — over `which docker`.)
- Voliteľne: *Settings → Send run details by email* pri chybe → notifikácia na `jan.letko@futbalsfz.sk`.

## Poznámky

- Prepočítava sa len **aktuálna sezóna** (historické sú nemenné) → beh je krátky,
  diff v `data/` malý, push rýchly.
- Frekvencia sa mení v Task Scheduleri; ručný beh = *Run* na úlohe alebo príkaz z bodu 4.
- Ak sa zmení verejná IP, treba ju aktualizovať v Atlas allowliste.
- Alternatíva bez Dockera: Python 3 z Package Center + Task Scheduler priamo na
  `python3 etl/tyzdenna.py` v naklonovanom repe — Docker je však čistejší a reprodukovateľný.
