# Týždenná aktualizácia štatistík

Automatická aktualizácia dát cez **GitHub Actions**. Prepočítava sa len **aktuálna
sezóna** (historické sú nemenné); po prepočte sa zmeny commitnú a pushnú → Vercel
automaticky nasadí.

## Ako to funguje

```
GitHub Actions (cron, pondelok)  →  etl/tyzdenna.py  →  zmeny v data/  →  git push  →  Vercel build
```

- **Orchestrátor:** `etl/tyzdenna.py` — spustí pre aktuálnu sezónu: 43 zväzov
  (`run.py`), futsal, demografiu (`demografia.py`), kluby (`kluby.py` — index sa
  prestavia skenom disku, takže história a neaktívne kluby ostávajú), a odvodené
  agregáty `porovnania.py`, `sumar.py`, `projekty.py`.
- **Workflow:** `.github/workflows/tyzdenna.yml` — cron `0 3 * * 1` (pondelok 03:00
  UTC) + manuálne spustenie. Beh trvá rádovo minúty (nie hodiny ako plná história).
- **Sezóna** sa určí z dátumu (1.7.–30.6.); dá sa prepísať vstupom `sezona` pri
  manuálnom spustení.

## Jednorazové nastavenie

1. **Secret `MONGODB_URI`** — v GitHube: *Settings → Secrets and variables →
   Actions → New repository secret*. Použi **read-only** účet (kolekcie `sutaze` a
   `sportnet.users` — polia `birthdate`, `sex`; viď GDPR poznámka v podkladoch).
2. **MongoDB Atlas — Network Access:** GitHub-hostované runnery majú dynamické IP.
   Možnosti (vyber jednu):
   - povoliť `0.0.0.0/0` a spoľahnúť sa na silné read-only credentials (najjednoduchšie),
   - alebo **self-hosted runner** so statickou IP (pridá sa jedna IP do allowlistu),
   - alebo Atlas PrivateLink / VPN peering (najbezpečnejšie, viac prevádzky).
   Odporúčanie: read-only účet + `0.0.0.0/0`, alebo self-hosted runner.
3. **Vercel** už nasadzuje na push do `main` (netreba nič).

## Spustenie

- **Automaticky:** každý pondelok o 03:00 UTC.
- **Ručne:** *Actions → „Týždenná aktualizácia štatistík" → Run workflow*
  (voliteľne zadaj sezónu, napr. `2025/2026`).
- **Lokálne (odladenie):**
  ```bash
  export MONGODB_URI="mongodb+srv://…"
  export SSL_CERT_FILE=$(python -c 'import certifi; print(certifi.where())')
  python etl/tyzdenna.py            # aktuálna sezóna podľa dátumu
  python etl/tyzdenna.py --sezona 2025/2026
  ```

## Monitoring / alerting

- Ak niektorý ETL krok zlyhá, `etl/tyzdenna.py` skončí s návratovým kódom 1 a
  **workflow spadne (červený)** → GitHub pošle notifikáciu vlastníkom repozitára.
- Voliteľne sa dá pridať krok na e-mail (`jan.letko@futbalsfz.sk`) alebo Slack pri zlyhaní.

## Poznámky

- Frekvencia: týždenne postačuje (zápisy sa uzatvárajú priebežne). Dá sa zmeniť
  `cron` výraz vo workflow (napr. denne `0 3 * * *`).
- Plnú históriu (všetky sezóny) netreba generovať opakovane; v prípade potreby
  jednorazovo: `python etl/run.py --zvaz <id> --all-sezony`, `python etl/kluby.py --vsetky`.
