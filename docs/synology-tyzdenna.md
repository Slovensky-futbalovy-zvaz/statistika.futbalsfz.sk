# Týždenná aktualizácia na Synology (DSM 7.3, Container Manager)

Beh prebieha lokálne na NAS `cloud.futbalsfz.sk` → von ide cez **jednu statickú verejnú IP**,
ktorú stačí povoliť v MongoDB Atlas. Databáza sa neotvára do sveta.

**Čo sa pri behu deje:** kontajner stiahne repozitár, spustí `etl/tyzdenna.py` (prepočet
aktuálnej sezóny, v júli–septembri aj predchádzajúcej, plus sezóny so zmeneným odtlačkom —
viď [metodika](metodika.md), kapitola „Automatická aktualizácia dát a spätné opravy zápasov"),
zmeny v `data/` commitne a pushne do `main` → Vercel nasadí produkciu.

Zdrojové súbory: `deploy/synology/` (Dockerfile, entrypoint.sh, docker-compose.yml, .env.example).

---

## 0. Čo si priprav vopred

| Vec | Odkiaľ |
|---|---|
| Read-only pripojovací reťazec do MongoDB | Atlas — účet s právom čítať `sutaze` a `sportnet.users` (polia `birthdate`, `sex`) |
| Statická verejná IP siete SFZ | Atlas → *Network Access → Add IP Address* |
| Prihlásenie do GitHubu pre push | deploy key **alebo** fine-grained token — viď krok 3 |

---

## 1. Priečinok na NAS (File Station)

1. **Package Center** → nainštaluj **Container Manager**, ak chýba. Vytvorí zdieľaný
   priečinok `docker`.
2. **File Station** → v `docker` vytvor priečinok **`sfz-etl`**.
3. Nahraj doň obsah `deploy/synology/`:
   - `Dockerfile`
   - `entrypoint.sh`
   - `docker-compose.yml`
4. Vytvor podpriečinok **`keys`** (len pri variante s deploy key).
5. Vytvor podpriečinok **`repo`** — musí existovať **pred** buildom. Synology Docker
   adresár pre bind mount **nevytvorí** (na rozdiel od pomenovaných volumes) a build padne
   na `Bind mount failed: '/volume2/docker/sfz-etl/repo' does not exist`. Slúži ako
   perzistentný klon repozitára (ďalšie behy už len `fetch`, nie celý `clone`).

Výsledok: `/volume2/docker/sfz-etl/`

> **Cesta sa líši podľa NAS.** Na `cloud.futbalsfz.sk` je zdieľaný priečinok `docker` na
> druhom volume, teda `/volume2/...`. Skutočnú cestu zistíš vo File Station v *Properties*
> priečinka — a použi ju aj v príkazoch pre Task Scheduler nižšie.

---

## 2. Súbor `.env`

V File Station vytvor v `sfz-etl` súbor **`.env`** (Vytvoriť → Súbor, alebo nahraj hotový
z `.env.example`). Obsah:

```
MONGODB_URI=mongodb+srv://readonly-user:HESLO@cluster.mongodb.net/?retryWrites=true&w=majority
```

Voliteľne:

```
# GITHUB_TOKEN=...      # len pri variante B (token namiesto deploy key)
# SEZONA=2024/2025      # jednorazový ručný prepočet konkrétnej sezóny
# MAX_SEZON=4           # strop počtu sezón v jednom behu
```

`.env` sa **nikdy necommituje** — `deploy/synology/.gitignore` ho vylučuje.

---

## 3. Prihlásenie do GitHubu — dve varianty

`entrypoint.sh` podporuje obe a sám si vyberie podľa toho, čo nájde.

### A) Deploy key (bezpečnejšie, preferované)

Kľúč je viazaný na jediný repozitár, nemá identitu používateľa a nevyprší.

**Pozor:** organizácia `Slovensky-futbalovy-zvaz` mala 17. 8. 2026 deploy keys **zakázané**
(`Deploy keys are disabled for this repository`). Admin organizácie ich musí najprv povoliť —
GitHub to popisuje v [Restricting deploy keys in your organization](https://docs.github.com/en/enterprise-cloud@latest/organizations/managing-organization-settings/restricting-deploy-keys-in-your-organization).
Ak je politika vynútená na úrovni enterprise, toggle v organizácii je zamknutý a mení sa
v enterprise policies.

1. Vygeneruj pár kľúčov (na Macu):
   `ssh-keygen -t ed25519 -f deploy_key -N "" -C "sfz-etl-nas"`
2. **Verejnú** časť (`deploy_key.pub`) pridaj v GitHube: repo → *Settings → Deploy keys →
   Add deploy key* → **zaškrtni „Allow write access"**.
   Cez CLI: `gh api -X POST repos/<org>/<repo>/keys -f title="SFZ ETL — Synology NAS" -f key="$(cat deploy_key.pub)" -F read_only=false`
3. **Privátnu** časť (`deploy_key`, bez prípony) nahraj cez File Station do
   `sfz-etl/keys/deploy_key`.

> Práva súboru riešiť netreba. SSH síce odmieta privátny kľúč s voľnými právami
> („UNPROTECTED PRIVATE KEY FILE") a File Station práva 600 nenastaví, ale `entrypoint.sh`
> si kľúč skopíruje do kontajnera a práva nastaví sám. `/keys` je pripojený read-only.

### B) Fine-grained token (keď deploy keys nie sú povolené)

1. GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens*.
2. Repository access: **len tento repozitár**. Permissions: **Contents → Read and write**.
3. Token vlož do `.env` ako `GITHUB_TOKEN=...`.

> Token je viazaný na účet a **vyprší** — po expirácii beh prestane pushovať. Dátum expirácie
> si poznač. Token sa neukladá do `.git/config`: `entrypoint.sh` nastaví `origin` na čistú URL
> a prihlasovacie údaje používa len v samotných príkazoch `fetch`/`push`.

---

## 4. MongoDB Atlas — allowlist

*Network Access → Add IP Address* → pridaj **statickú verejnú IP** siete SFZ.
Ak sa IP zmení, treba ju v Atlase aktualizovať — inak beh spadne na nedostupnej databáze.

---

## 5. Build a testovací beh (Container Manager)

1. **Container Manager → Project → Create.**
2. *Project name:* `sfz-etl`, *Path:* `/docker/sfz-etl`, zdroj **existujúci
   `docker-compose.yml`**.
3. Spusti build. Prvý beh naklonuje repozitár a prebehne celé ETL — **trvá 1–2 hodiny**,
   takže sa neľakaj, že „to visí".
4. Skontroluj log kontajnera: má skončiť riadkom `>>> Pushnute do main -> Vercel build.`
   a v GitHube má pribudnúť commit „Tyzdenna aktualizacia statistik (dátum): …".

> Projekt v Container Manageri je určený na dlho bežiace služby, náš kontajner je
> jednorazový — po dobehnutí zostane v stave *Exited*. Je to v poriadku; plánovaný beh
> nerieši Projekt, ale Task Scheduler (krok 6).

---

## 6. Naplánovanie behu (Task Scheduler)

*Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script*

- **Task:** `SFZ ETL — týždenná aktualizácia`
- **User:** `root`
- **Schedule:** *Run on the following days* → **Wednesday**, *First run time* **03:00**
- **Run command:**
  ```bash
  cd /volume2/docker/sfz-etl && /usr/local/bin/docker compose run --rm etl
  ```
  (cestu k `docker` over cez `which docker`; býva `/usr/local/bin/docker` alebo `/usr/bin/docker`)
- **Settings → Send run details by email** → `jan.letko@futbalsfz.sk`, zaškrtni
  **„Send run details only when the script terminates abnormally"**.

**Prečo streda a nie pondelok:** väčšina zápisov z víkendových zápasov sa uzatvára až
v pondelok a v utorok. Pôvodný cron bol na pondelok — v stredu je portál bližšie k realite.

### Druhá, ručne spúšťaná úloha — prepočet konkrétnej sezóny

Rovnaký postup, ale **bez rozvrhu** (spúšťa sa tlačidlom *Run*):

```bash
cd /volume2/docker/sfz-etl && /usr/local/bin/docker compose run --rm -e SEZONA=2024/2025 etl
```

Použije sa, keď treba prepočítať staršiu sezónu mimo automatického plánu.

---

## 7. Čo robiť, keď beh zlyhá

| Príznak | Príčina a riešenie |
|---|---|
| E-mail „terminated abnormally", v logu `Chyba MONGODB_URI` | `.env` chýba alebo je zle pripojený — over `env_file` v `docker-compose.yml` |
| `ServerSelectionTimeout` na Atlase | zmenila sa verejná IP → doplniť do Atlas allowlistu |
| `Deploy keys are disabled for this repository` | politika organizácie (krok 3A) alebo prejdi na token (3B) |
| Push prejde, ale Vercel nenasadí | autor commitu — musí byť `jan.letko@icloud.com`, commity z `@futbalsfz.sk` Vercel blokuje |
| Commit označený `CIASTOCNY BEH` | niektorý ETL krok zlyhal; dáta sa aj tak publikovali, chybu nájdeš v logu. Sezóny bez potvrdeného odtlačku sa prepočítajú pri najbližšom behu |
| `fatal: detected dubious ownership in repository at '/work/repo'` | bind mount patrí Synology užívateľovi (napr. `1026:100`), proces v kontajneri je `root` — poistkou je `safe.directory` v `Dockerfile` aj v `entrypoint.sh`; ak sa hlásenie objaví, beží starý image (viď nižšie) |
| `! [rejected] HEAD -> main (fetch first)` | počas behu pribudol na main cudzi commit. `entrypoint.sh` to od 19. 8. 2026 rieší sám — preskladá sa na aktuálny main a skúsi to znova, až 3×. Ak padnú všetky tri, dáta zostávajú v `/work/repo` a najbližší beh sezóny prepočíta znova |
| Tá istá chyba sa opakuje aj po oprave súboru | spustil sa **starý image**. Kontajner s hash prefixom v názve (`02e063e4a75d_sfz-etl-etl-1`) je sirota po predchádzajúcom builde — Docker starý kontajner prekrstí, keď nový preberie meno. Nikdy ho nespúšťaj cez *Start*; nový beh sa vždy štartuje cez **Project → Action → Build** |

---

## Poznámky

- Prepočítava sa **aktuálna sezóna**, v júli–septembri **aj predchádzajúca** a **sezóny so
  zmeneným odtlačkom** — nie celá história. Beh je preto v hodinách, nie v dňoch.
- Frekvencia sa mení v Task Scheduleri; ručný beh = tlačidlo *Run* na úlohe.
- **Diagnostika bez terminálu.** Container Manager pri projektových kontajneroch záložku
  *Terminal* neponúka. `entrypoint.sh` preto vypisuje stav prostredia priamo do logu
  (`Prostredie: HOME=… UID/GID:`, `/work/repo vlastnik …`, `safe.directory …`,
  `Autentifikacia: …`). Tieto štyri riadky odpovedajú na väčšinu otázok, na ktoré by inak
  bol potrebný shell.
- **`data/` je derivovaný výstup.** Pri kolízii s main vyhráva najnovší prepočet. Súbor,
  ktorý je na main a beh ho nevygeneroval, sa nemaže — kopíruje sa, nezrkadlí.
- Cron v `.github/workflows/tyzdenna.yml` je zámerne vypnutý — GitHub-hostované runnery majú
  dynamické IP a vyžadovali by `0.0.0.0/0` v Atlas allowliste. Workflow zostáva ako záložné
  ručné spustenie.
- Alternatíva bez Dockera: Python 3 z Package Center + Task Scheduler priamo na
  `python3 etl/tyzdenna.py` v naklonovanom repozitári. Docker je však čistejší
  a reprodukovateľný.
