#!/usr/bin/env python3
"""Zanikanie klubov — definícia, miery, rez po zväzoch a po obdobiach.

═══════════════════════════════════════════════════════════════════════════════════════
ZÁVÄZNÁ DEFINÍCIA (rozhodnutie Ján Letko, 15. 8. 2026)

    Za zaniknutý klub sa považuje klub, ktorý DVA ROKY PO SEBE neprihlási
    do súťaže žiadne družstvo.

Z toho plynú tri veci, ktoré sa nesmú stratiť:

1. Koniec klubu v súťažiach dospelých NIE JE zánik, pokiaľ klub má mládež. Zánik je až
   to, keď klub nemá v súťaži žiadne družstvo — ani mládežnícke.
2. POSTUP DO VYŠŠEJ ALEBO ZOSTUP DO NIŽŠEJ SÚŤAŽE NIE JE ZÁNIK. Aktivita sa posudzuje
   na celom Slovensku, nie vo zväze. Klub, ktorý postúpi z oblastnej súťaže do
   regionálnej, prestane hrať v súťažiach ObFZ, ale hrá ďalej — a tak sa aj počíta.
   Namerané 15. 8. 2026: domovský zväz sa mení pri 8,8 % dvojíc po sebe idúcich sezón
   a aspoň raz sa zmenil 621 klubom z 2 034. Keby sa aktivita posudzovala po zväzoch,
   boli by to všetko falošné zániky.
3. Jednosezónna pauza nie je zánik. Až dve sezóny po sebe bez družstva.
4. NOVÝ SUBJEKT V ISSF NIE JE NOVÝ KLUB. Pri novej registrácii (transformácia na s. r. o.,
   zmena právnej formy) vznikne nové organization ID bez väzby na predchodcu. Rozlíšiť ich
   umožňuje súťažný poriadok (pravidlo Ján Letko, 15. 8. 2026): ak sa zaniknutý klub znova
   prihlási do súťaže, MUSÍ ZAČÍNAŤ OD POSLEDNEJ LIGY VO SVOJOM ObFZ. Subjekt, ktorý sa
   objaví rovno v rovnakej alebo vyššej lige než mal „zaniknutý" klub s podobným názvom,
   teda nie je nový klub — je to jeho pokračovanie a spája sa s ním do jedného klubu.

Z pravidla plynie aj trvalá logická kontrola: kluby zanikajú a vznikajú takmer výlučne na
úrovni ObFZ. Zánik pripísaný SFZ má byť rarita, na RFZ výnimka. Ak ich vyjde viac, výpočet
je pokazený — kontroluje to `etl/kontrola_zanikania.py`.

Dôsledok pre okno: posledné DVE sezóny sa hodnotiť nedajú, lebo za nimi ešte nie sú dve
nasledujúce sezóny.
═══════════════════════════════════════════════════════════════════════════════════════

Meranie prihlásených družstiev v dátach nemáme — proxy je REÁLNE ODOHRANÝ ZÁPAS: klub má
v sezóne artefakt `data/klub/{klub}/{sezona}.json` práve vtedy, keď aspoň jedno jeho
družstvo v regulárnej súťaži slovenského zväzu odohralo aspoň jeden zápas. Klub, ktorý
družstvo prihlási a odhlási ho pred prvým kolom, je tak v dátach neaktívny. Je to
prísnejšie než znenie definície a je to zámerné — počítame hraný futbal, nie evidenciu.

Skript beží OFFLINE nad publikovanými artefaktmi, ktoré vznikli rovnakým behom (a rovnakým
filtrom súťaží) ako blok Počet klubov, takže čísla sedia na portál. MongoDB netreba.

Rez po zväzoch (zadanie Ján Letko, 15. 8. 2026: „v ktorých zväzoch najviac ubudlo klubov
a v ktorom období?“) sa vyhodnocuje V RÁMCI CELÉHO SLOVENSKA — hlavná metrika je podiel
zväzu na všetkých zaniknutých kluboch v SR. Vedľa nej stojí miera odchodu vo zväze
(podiel z klubo-sezón zväzu), lebo veľký zväz má prirodzene väčší podiel.

Použitie:
    python etl/zanikanie.py
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

# Sezóny, ktoré sa do analýzy nesmú dostať (rozhodnutia Ján Letko, 14. 8. 2026):
# 2012/2013 a 2013/2014 = nábeh ISSF (evidencia nie je úplná, „nové“ kluby sú dobiehajúce dáta),
# posledná sezóna v dátach = prebiehajúca (klub, ktorý v nej ešte nehral, nezanikol).
NABEH_ISSF = ("2012/2013", "2013/2014")

# Koľko sezón po sebe musí byť klub bez družstva, aby sa považoval za zaniknutý.
TICHO_SEZON = 2

# Na párovanie nástupcov: slovo, ktoré je vo viac než toľkých kluboch, obec neidentifikuje
# („bratislava", „kosice"). Pri nich sa nástupca automaticky nehľadá.
PRAH_DF = 6

# Zväzy, v ktorých nový klub vzniknúť nemôže — musel by začínať od poslednej ligy svojho ObFZ.
UROVNE_BEZ_NOVYCH = {"sfz", "bfz", "zsfz", "ssfz", "vsfz"}

# Obdobia pre otázku „kedy sa to dialo“. Hranice sú vecné, nie štatistické: covid zasiahol
# sezóny 2019/2020 (prerušená) až 2021/2022 (prvá po nej).
OBDOBIA = (
    ("do 2018/2019", None, "2018/2019"),
    ("2019/2020 – 2021/2022 (covid)", "2019/2020", "2021/2022"),
    ("od 2022/2023", "2022/2023", None),
)


def obdobie_sezony(s: str) -> str:
    for nazov, od, do in OBDOBIA:
        if (od is None or s >= od) and (do is None or s <= do):
            return nazov
    return OBDOBIA[-1][0]


def stav_klubu(p: Path) -> tuple[bool, bool, str | None, str] | None:
    """(má mládež, má dospelých, domovský zväz, názov), alebo None ak klub sezónu NEODOHRAL.

    Existencia artefaktu nestačí: klub, ktorý sa v priebehu sezóny odhlásil, má profil, ale
    `kpi.zapasy` = 0 — všetko sú administratívne kontumácie. FK Senica mal takto v 2022/2023
    nula odohraných zápasov a 61 uzatvorených, a sezóna sa rátala ako odohraná.
    """
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    if not (d.get("kpi") or {}).get("zapasy"):
        return None
    kat = set((d.get("kategorie") or {}).keys())
    return (bool(kat - {"ADULTS"}), "ADULTS" in kat, d.get("zvaz"), d.get("nazov") or "")


def nacitaj(out_dir: Path) -> dict[str, dict[str, tuple[bool, bool, str | None, str]]]:
    kluby: dict[str, dict[str, tuple[bool, bool, str | None, str]]] = {}
    for d in sorted((out_dir / "klub").iterdir()):
        if not d.is_dir():
            continue
        pre_sezony: dict[str, tuple[bool, bool, str | None, str]] = {}
        for f in sorted(d.iterdir()):
            m = SEZ_RE.match(f.name)
            if not m:
                continue
            st = stav_klubu(f)
            if st is not None:
                pre_sezony[f"{m.group(1)}/{m.group(2)}"] = st
        if pre_sezony:
            kluby[d.name] = pre_sezony
    return kluby


LIGA_RE = re.compile(r"^L(\d+)$")


def urovne_klubov(out_dir: Path) -> dict[str, dict[str, tuple[int | None, bool]]]:
    """{klub: {sezona: (najvyššia liga ako číslo, hral len pohár)}} z data/vek-klub/.

    Úroveň potrebujeme na pravidlo o poslednej lige: nový klub musí začínať odspodu.
    „Len pohár" je dôležité kvôli domovskému zväzu — klub, ktorý v sezóne odohral iba zápas
    Slovnaft Cupu, by inak dostal ako domovský zväz SFZ, hoci patrí do svojho ObFZ.
    """
    von: dict[str, dict[str, tuple[int | None, bool]]] = {}
    d = out_dir / "vek-klub"
    if not d.is_dir():
        return von
    for f in sorted(d.iterdir()):
        if not f.name.endswith(".json"):
            continue
        try:
            with open(f, encoding="utf-8") as fh:
                sez = (json.load(fh).get("sezony") or {})
        except Exception:
            continue
        pre: dict[str, tuple[int | None, bool]] = {}
        for s, obsah in sez.items():
            kody = list((obsah.get("urovne") or {}).values())
            ligy = [int(m.group(1)) for k in kody if (m := LIGA_RE.match(str(k)))]
            pre[s] = (min(ligy) if ligy else None, bool(kody) and not ligy)
        von[f.name[:-5]] = pre
    return von


def normalizuj_nazov(nazov: str) -> set[str]:
    """Slová, ktoré nesú identitu klubu — bez diakritiky, právnych foriem a generických slov."""
    n = unicodedata.normalize("NFKD", nazov.lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    return {w for w in n.split() if len(w) >= 4 and w not in VYPLN_NAZOV}


# Slová, ktoré o identite klubu nehovoria nič — právne formy a generické podstatné mená.
VYPLN_NAZOV = {
    "tj", "fk", "ofk", "mfk", "sk", "fc", "msk", "mfc", "skf", "zfk", "pfk", "sfc", "sfk",
    "mska", "kfc", "ktj", "stk", "mstk", "osk", "oskf", "futbalovy", "futbalove", "futbalova",
    "futbal", "klub", "kluby", "sportovy", "sportove", "sportovy", "telovychovna", "jednota",
    "obecny", "mestsky", "miestny", "obec", "mesto", "akademia", "mladeze", "skola",
}

# Značky klubov. V názve zostávajú, ale na určenie OBCE sa ignorujú — „TJ Družstevník Selce"
# a „FK Selce" je ten istý klub, značka sa pri preregistrácii mení bežne.
ZNACKY = {
    "sokol", "lokomotiva", "dukla", "inter", "slovan", "tatran", "spartak", "partizan",
    "druzstevnik", "iskra", "dynamo", "banik", "pokrok", "hviezda", "odeva", "ozeta",
    "tatra", "slavia", "junior", "sitno", "fatran", "kriv", "vix", "roma",
}


def obec_tokeny(nazov: str) -> frozenset[str]:
    """Slová, ktoré identifikujú OBEC — bez právnej formy a bez značky klubu."""
    return frozenset(normalizuj_nazov(nazov) - ZNACKY)


def najdi_nastupcov(kluby: dict, urovne: dict, sezony: list[str], ticho: int) -> dict[str, str]:
    """{nový klub: jeho predchodca} — subjekty, ktoré sú v skutočnosti ten istý klub.

    PRAVIDLO (Ján Letko, 15. 8. 2026): zaniknutý klub, ktorý sa znova prihlási, MUSÍ ZAČÍNAŤ
    OD POSLEDNEJ LIGY VO SVOJOM ObFZ. Test je preto na absolútnej úrovni, nie na porovnaní
    s predchodcom: ak sa subjekt objaví kdekoľvek vyššie než v najhlbšej lige svojho zväzu
    (a na úrovni SFZ alebo RFZ tým skôr), nemôže byť nový — je to pokračovanie klubu, ktorý
    v tej istej obci práve „zanikol“.
    """
    idx = {s: i for i, s in enumerate(sezony)}
    prve, posledne, obce = {}, {}, {}
    for k, v in kluby.items():
        p = sorted(idx[s] for s in v if s in idx)
        if not p:
            continue
        prve[k], posledne[k] = p[0], p[-1]
        obce[k] = {i: obec_tokeny(v[sezony[i]][3]) for i in (p[0], p[-1])}

    # Ako často sa dané slovo vyskytuje v názvoch klubov. „bratislava" je v desiatkach klubov,
    # „malzenice" v jednom — a práve to rozlišuje obec od kraja. Bez tejto poistky by sa
    # spárovali dva úplne nesúvisiace bratislavské kluby.
    df: collections.Counter = collections.Counter()
    for k in prve:
        for w in obce[k][prve[k]] | obce[k][posledne[k]]:
            df[w] += 1

    # Najhlbšia liga v každom zväze a sezóne — „posledná liga“, od ktorej musí nový klub začať.
    najhlbsia: dict[tuple[str | None, str], int] = {}
    for k, v in kluby.items():
        for s, st in v.items():
            liga = (urovne.get(k, {}).get(s) or (None, False))[0]
            if liga is None:
                continue
            kl = (st[2], s)
            najhlbsia[kl] = max(najhlbsia.get(kl, 0), liga)

    nastupca: dict[str, str] = {}
    for nk, fi in prve.items():
        if fi == 0:
            continue
        fs = sezony[fi]
        _, _, nz_zvaz, _ = kluby[nk][fs]
        tok = obce[nk][fi]
        if not tok or min(df[w] for w in tok) > PRAH_DF:
            continue                      # samé bežné slová — obec sa z názvu určiť nedá
        n_liga = (urovne.get(nk, {}).get(fs) or (None, False))[0]
        dno = najhlbsia.get((nz_zvaz, fs))
        # Mohol to byť naozaj nový klub? Len ak začal na dne pyramídy svojho zväzu.
        moze_byt_novy = (
            str(nz_zvaz or "") not in UROVNE_BEZ_NOVYCH
            and (n_liga is None or dno is None or n_liga >= dno)
        )
        if moze_byt_novy:
            continue
        najlepsi = None
        for pk, pi in posledne.items():
            if pk == nk or prve[pk] >= fi or not (0 < fi - pi <= ticho + 2):
                continue
            if obce[pk][pi] != tok:       # musí to byť tá istá obec, nie len prienik slov
                continue
            if najlepsi is None or pi > posledne[najlepsi]:
                najlepsi = pk
        if najlepsi:
            nastupca[nk] = najlepsi
    return nastupca


def spoj_nastupcov(kluby: dict, nastupca: dict) -> dict:
    """Spojí nástupcu s predchodcom do jedného klubu (koreň reťaze)."""
    def koren(k: str) -> str:
        videne = set()
        while k in nastupca and k not in videne:
            videne.add(k)
            k = nastupca[k]
        return k
    spojene: dict[str, dict] = {}
    for k, v in kluby.items():
        c = spojene.setdefault(koren(k), {})
        for s, st in v.items():
            if s not in c:
                c[s] = st
    return spojene


def kluby_po_zvazoch(out_dir: Path, sezony: list[str]) -> dict[str, dict[str, int]]:
    """{zvaz: {sezona: počet klubov hrajúcich v súťažiach zväzu}} z bloku Počet klubov.

    POZOR: tento rad NIE JE o zanikaní. Klub, ktorý postúpi z oblastnej súťaže do
    regionálnej, z neho vypadne, hoci hrá ďalej. Publikuje sa ako doplnkový údaj a v
    rebríčku zanikania sa nepoužíva.
    """
    von: dict[str, dict[str, int]] = collections.defaultdict(dict)
    for s in sezony:
        p = out_dir / "kluby" / f"{s.replace('/', '-')}.json"
        if not p.exists():
            continue
        with open(p, encoding="utf-8") as f:
            d = json.load(f)
        for zid, rez in (d.get("zvazy") or {}).items():
            von[zid][s] = rez.get("kluby", 0) if isinstance(rez, dict) else rez
    return von


def register_zvazov(repo: Path) -> dict[str, dict]:
    """id → {nazov, uroven} z overeného registra (etl/config/zvazy.json)."""
    with open(repo / "etl" / "config" / "zvazy.json", encoding="utf-8") as f:
        cfg = json.load(f)
    reg: dict[str, dict] = {}
    for uroven, zoznam in cfg.items():
        if not isinstance(zoznam, list):
            continue
        for z in zoznam:
            reg[z["id"]] = {"nazov": z.get("nazov", z["id"]), "uroven": z.get("uroven", uroven)}
    return reg


def analyza(kluby: dict, register: dict | None = None, pocty: dict | None = None,
            nastupcov: int = 0) -> dict:
    vsetky = sorted({s for v in kluby.values() for s in v})
    # okno: bez nábehu ISSF a bez prebiehajúcej (poslednej) sezóny
    sezony = [s for s in vsetky[:-1] if s not in NABEH_ISSF]
    prebiehajuca = vsetky[-1]
    idx = {s: i for i, s in enumerate(sezony)}
    n = len(sezony)
    # hodnotiteľné sezóny: za každou musia byť ešte TICHO_SEZON nasledujúce
    hodnotitelne = sezony[: n - TICHO_SEZON]
    hodn_mn = set(hodnotitelne)

    aktivni = {s: 0 for s in sezony}
    aktivni_mlad = {s: 0 for s in sezony}
    zanik: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    prislo: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    prech: collections.Counter = collections.Counter()
    pauza: collections.Counter = collections.Counter()          # jednosezónne pauzy
    obnovene: collections.Counter = collections.Counter()       # zaniknuté, ktoré sa vrátili
    z_zanik: collections.Counter = collections.Counter()
    z_klubosezony: collections.Counter = collections.Counter()
    z_prichody: collections.Counter = collections.Counter()
    z_obdobia: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    ob_zanik: collections.Counter = collections.Counter()
    ob_prichody: collections.Counter = collections.Counter()
    ob_sezon: collections.Counter = collections.Counter()
    ob_prichody_sezon: collections.Counter = collections.Counter()
    zmien_zvazu = 0
    dvojic = 0
    klubov_so_zmenou = 0

    for s in hodnotitelne:
        ob_sezon[obdobie_sezony(s)] += 1
    # PRÍCHODY sa dajú hodnotiť až od tretej sezóny okna: v prvej nový klub vzniknúť nemôže
    # a v druhej vyjde nafúknuto — objavia sa v nej všetky kluby, ktoré si prvú vynechali.
    # Okno príchodov sa zároveň orezáva rovnako ako okno zánikov, aby sa dali porovnávať.
    prichody_mn = set(sezony[2:]) & hodn_mn
    for s in sorted(prichody_mn):
        ob_prichody_sezon[obdobie_sezony(s)] += 1

    def label(t) -> str:
        mlad, dosp = t[0], t[1]
        if mlad and dosp:
            return "dospeli+mladez"
        return "len mladez" if mlad else "len dospeli"

    for v in kluby.values():
        poradia = sorted(idx[s] for s in v if s in idx)
        if not poradia:
            continue
        zmenil = False
        predch_zvaz = None
        for i in poradia:
            s = sezony[i]
            mlad, _, zvaz = v[s][0], v[s][1], v[s][2]
            aktivni[s] += 1
            if mlad:
                aktivni_mlad[s] += 1

            # POSTUP/ZOSTUP: len sa počíta, na zánik nemá vplyv (aktivita je celoslovenská)
            if predch_zvaz is not None:
                dvojic += 1
                if zvaz != predch_zvaz:
                    zmien_zvazu += 1
                    zmenil = True
            predch_zvaz = zvaz

            kluc = "s mladezou" if mlad else "bez mladeze"
            if s in hodn_mn:
                if zvaz:
                    z_klubosezony[zvaz] += 1
                # ZÁNIK: TICHO_SEZON nasledujúcich sezón bez jediného družstva
                if all(sezony[i + k] not in v for k in range(1, TICHO_SEZON + 1)):
                    zanik[s][kluc] += 1
                    zanik[s]["spolu"] += 1
                    zanik[s][label(v[s])] += 1
                    ob_zanik[obdobie_sezony(s)] += 1
                    # klub, ktorý sa po dvoch tichých sezónach ešte vrátil — podľa definície
                    # zaniknutý ostáva, ale treba o tom vedieť
                    if any(sezony[j] in v for j in range(i + TICHO_SEZON + 1, n)):
                        obnovene[s] += 1
                    if zvaz:
                        z_zanik[zvaz] += 1
                        z_obdobia[zvaz][obdobie_sezony(s)] += 1
                elif i + 1 < n and sezony[i + 1] not in v:
                    pauza[s] += 1

            if i + 1 < n and sezony[i + 1] in v:
                a, b = label(v[s]), label(v[sezony[i + 1]])
                if a != b:
                    prech[f"{a} -> {b}"] += 1

        klubov_so_zmenou += zmenil
        s0 = sezony[poradia[0]]
        if poradia[0] > 0:
            prislo[s0]["s mladezou" if v[s0][0] else "bez mladeze"] += 1
            prislo[s0]["spolu"] += 1
            if s0 in prichody_mn:
                ob_prichody[obdobie_sezony(s0)] += 1
                if v[s0][2]:
                    z_prichody[v[s0][2]] += 1

    # miera zániku podľa toho, či klub v poslednej odohranej sezóne mal mládež
    miery = {}
    for kluc, filtr in (("bez mladeze", False), ("s mladezou", True)):
        klubo_sezon = sum(
            1 for v in kluby.values() for s in hodnotitelne if s in v and v[s][0] is filtr
        )
        odchodov = sum(zanik[s][kluc] for s in hodnotitelne)
        miery[kluc] = {
            "klubosezon": klubo_sezon,
            "zanikov": odchodov,
            "miera": round(100.0 * odchodov / klubo_sezon, 2) if klubo_sezon else None,
        }

    zanikov_sr = sum(z_zanik.values())
    reg = register or {}
    poc = pocty or {}
    zvazy_out = {}
    for zid in sorted(set(z_klubosezony) | set(z_zanik) | set(poc)):
        rad = poc.get(zid, {})
        ks = z_klubosezony[zid]
        zvazy_out[zid] = {
            "nazov": reg.get(zid, {}).get("nazov", zid),
            "uroven": reg.get(zid, {}).get("uroven"),
            "zanikov": z_zanik[zid],
            "podielSR": round(100.0 * z_zanik[zid] / zanikov_sr, 2) if zanikov_sr else None,
            "klubosezony": ks,
            "miera": round(100.0 * z_zanik[zid] / ks, 2) if ks else None,
            "prichody": z_prichody[zid],
            "poObdobiach": {n_: z_obdobia[zid].get(n_, 0) for n_, _, _ in OBDOBIA},
            "klubovVSutaziachZvazu": {s: rad.get(s, 0) for s in sezony},
        }

    po_obdobiach = {}
    for n_, _, _ in OBDOBIA:
        sez = ob_sezon[n_]
        sezp = ob_prichody_sezon[n_]
        po_obdobiach[n_] = {
            "sezon": sez,
            "sezonPrichodov": sezp,
            "zanikov": ob_zanik[n_],
            "prichody": ob_prichody[n_],
            "zanikovNaSezonu": round(ob_zanik[n_] / sez, 1) if sez else None,
            "prichodovNaSezonu": round(ob_prichody[n_] / sezp, 1) if sezp else None,
        }

    return {
        "definicia": (
            "Za zaniknutý klub sa považuje klub, ktorý dva roky po sebe neprihlási do súťaže "
            "žiadne družstvo (rozhodnutie Ján Letko, 15. 8. 2026). V dátach sa prihlásené "
            "družstvo meria reálne odohraným zápasom. Koniec v súťažiach dospelých nie je zánik, "
            "pokiaľ klub má mládež. POSTUP DO VYŠŠEJ ANI ZOSTUP DO NIŽŠEJ SÚŤAŽE NIE JE ZÁNIK — "
            "aktivita klubu sa posudzuje na celom Slovensku, nie v jednom zväze."
        ),
        "sezony": sezony,
        "hodnotitelne": hodnotitelne,
        "vynechane": {
            "nabehISSF": list(NABEH_ISSF),
            "prebiehajuca": prebiehajuca,
            "bezNasledujucich": sezony[n - TICHO_SEZON:],
        },
        "tichoSezon": TICHO_SEZON,
        "aktivni": aktivni,
        "aktivniSMladezou": aktivni_mlad,
        "zanik": {s: dict(zanik[s]) for s in hodnotitelne},
        "jednosezonnaPauza": {s: pauza[s] for s in hodnotitelne},
        "obnovene": {s: obnovene[s] for s in hodnotitelne},
        "obnovenychSpolu": sum(obnovene.values()),
        "prislo": {s: dict(prislo[s]) for s in sezony[1:]},
        "prechody": dict(prech),
        "miery": miery,
        "zanikovSpolu": zanikov_sr,
        "zvazy": zvazy_out,
        "poObdobiach": po_obdobiach,
        "spojenychNastupcov": nastupcov,
        "presunyMedziZvazmi": {
            "zmien": zmien_zvazu,
            "dvojicSezon": dvojic,
            "podiel": round(100.0 * zmien_zvazu / dvojic, 1) if dvojic else None,
            "klubovSoZmenou": klubov_so_zmenou,
            "poznamka": (
                "Klub, ktorý postúpi alebo zostúpi, zmení domovský zväz. Nie je to zánik — "
                "je to dôvod, prečo sa aktivita klubu posudzuje celoslovensky."
            ),
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(REPO / "data"))
    args = ap.parse_args()
    out_dir = Path(args.out)

    kluby = nacitaj(out_dir)
    sezony = [s for s in sorted({s for v in kluby.values() for s in v})[:-1] if s not in NABEH_ISSF]
    urovne = urovne_klubov(out_dir)

    # PRAVIDLO O POSLEDNEJ LIGE — spojenie subjektov, ktoré sú v skutočnosti ten istý klub
    nastupca = najdi_nastupcov(kluby, urovne, sezony, TICHO_SEZON)
    if nastupca:
        print("právni nástupcovia (nový subjekt = pokračovanie klubu):")
        for nk, pk in sorted(nastupca.items()):
            ps = max(s for s in kluby[pk] if s in set(sezony))
            ns = min(s for s in kluby[nk] if s in set(sezony))
            print(f"  {kluby[pk][ps][3]} ({ps}) → {kluby[nk][ns][3]} ({ns})")
        print()
    kluby = spoj_nastupcov(kluby, nastupca)

    # DOMOVSKÝ ZVÄZ: sezónu odohranú len v pohári neberieme na určenie zväzu
    for k, v in kluby.items():
        predch = None
        for s in sorted(v):
            len_pohar = (urovne.get(k, {}).get(s) or (None, False))[1]
            if len_pohar and predch:
                mlad, dosp, _, nz = v[s]
                v[s] = (mlad, dosp, predch, nz)
            else:
                predch = v[s][2]

    vys = analyza(kluby, register_zvazov(REPO), kluby_po_zvazoch(out_dir, sezony), len(nastupca))
    cesta = out_dir / "zanikanie.json"
    with open(cesta, "w", encoding="utf-8") as f:
        json.dump(
            {"generatedAt": __import__("datetime").datetime.now().astimezone().isoformat(timespec="seconds"), **vys},
            f, ensure_ascii=False, indent=1,
        )

    print(f"klubov: {len(kluby)} | okno {vys['sezony'][0]} – {vys['sezony'][-1]}"
          f" | hodnotiteľné {vys['hodnotitelne'][0]} – {vys['hodnotitelne'][-1]}")
    print(f"definícia: {TICHO_SEZON} sezóny po sebe bez družstva\n")
    print("sezóna | aktívnych | zaniklo | bez mládeže | s mládežou | jednosezónna pauza")
    for s in vys["hodnotitelne"]:
        z = vys["zanik"].get(s, {})
        print(f"{s} | {vys['aktivni'][s]} | {z.get('spolu', 0)} | {z.get('bez mladeze', 0)}"
              f" | {z.get('s mladezou', 0)} | {vys['jednosezonnaPauza'].get(s, 0)}")
    print(f"spojených nástupcov: {vys['spojenychNastupcov']}")
    print(f"\nzaniknutých spolu: {vys['zanikovSpolu']}"
          f" (z toho {vys['obnovenychSpolu']} sa po dvoch tichých sezónach ešte vrátilo)")
    for k, m in vys["miery"].items():
        print(f"  {k}: {m['zanikov']} z {m['klubosezon']} klubo-sezón = {m['miera']} %")

    p = vys["presunyMedziZvazmi"]
    print(f"\npostupy/zostupy (zmena domovského zväzu): {p['zmien']} z {p['dvojicSezon']}"
          f" dvojíc sezón = {p['podiel']} %, týka sa {p['klubovSoZmenou']} klubov"
          f" — ŽIADEN z nich nie je zánik")

    print("\npo obdobiach:")
    for n_, o in vys["poObdobiach"].items():
        print(f"  {n_}: {o['zanikov']} zánikov ({o['zanikovNaSezonu']} na sezónu),"
              f" {o['prichody']} nových ({o['prichodovNaSezonu']} na sezónu)")

    print("\nzväzy — podiel na všetkých zánikoch v SR:")
    for zid, z in sorted(vys["zvazy"].items(), key=lambda x: -(x[1]["podielSR"] or 0))[:12]:
        print(f"  {z['nazov'][:34]:34} {z['podielSR']:5} %  ({z['zanikov']} klubov,"
              f" miera vo zväze {z['miera']} %)")
    print("\nLOGICKÁ KONTROLA — kluby majú zanikať takmer výlučne na úrovni ObFZ:")
    podla_urovne = collections.Counter()
    for z in vys["zvazy"].values():
        podla_urovne[(z.get("uroven") or "?")] += z["zanikov"]
    for u, n in sorted(podla_urovne.items(), key=lambda x: -x[1]):
        print(f"  {u}: {n} zaniknutých ({100.0 * n / vys['zanikovSpolu']:.1f} %)")
    sfz = podla_urovne.get("SFZ", 0)
    if sfz > 5:
        print(f"  ⚠️  na úrovni SFZ vyšlo {sfz} zánikov — to je priveľa, výpočet treba preveriť")

    print(f"\nOK {cesta}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
