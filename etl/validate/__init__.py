"""Validácie výstupov ETL — počty, povinné polia, anomálie.

Nezhody sa vracajú ako zoznam textových anomálií; run.py ich loguje.
Nedostatočné pokrytie sa NEODHADUJE — len sa označí (metodika, kap. Známe problémy).
"""

#: Poradie kategórií pre výstup (od najstarších); vychádza z teams[].ageCategory.
#: Reálne overené hodnoty: ADULTS, U19, U17, U15, U13, U11, U10 (ZsFZ), U09, U07;
#: U18/U16/U14/U12/U08/U06 preventívne (číselník Ux sa v dátach vyskytuje širší).
KATEGORIE_PORADIE = [
    "ADULTS", "U20", "U19", "U18", "U17", "U16", "U15", "U14", "U13",
    "U12", "U11", "U10", "U09", "U08", "U07", "U06",
]

#: Prah nízkeho pokrytia divákov — pod túto hodnotu ide anomália do logu.
DIVACI_POKRYTIE_MIN = 0.80


def zorad_kategorie(kategorie: dict) -> dict:
    """Zoradí kategórie podľa KATEGORIE_PORADIE; neznáme na koniec (a do anomálií)."""
    zname = [k for k in KATEGORIE_PORADIE if k in kategorie]
    nezname = [k for k in kategorie if k not in KATEGORIE_PORADIE]
    return {k: kategorie[k] for k in zname + sorted(nezname)}


def validuj(doc: dict) -> list[str]:
    """Validácia hotového výstupného dokumentu zväz+sezóna. Vracia zoznam anomálií."""
    anomalie: list[str] = []
    kpi = doc.get("kpi", {})
    kategorie = doc.get("kategorie", {})

    if not kategorie:
        return [f"{doc.get('zvaz')}/{doc.get('sezona')}: žiadne kategórie — prázdna sezóna?"]

    # 1) KPI = súčet kategórií
    sucty = {
        "zapasy": sum(k["zapasy"] for k in kategorie.values()),
        "druzstva": sum(k["druzstva"] for k in kategorie.values()),
        "goly": sum(k["goly"] for k in kategorie.values()),
        "divaci": sum(k["divaci"] for k in kategorie.values()),
        "zlteKarty": sum(k["zlte"] for k in kategorie.values()),
        "cerveneKarty": sum(k["cervene"] for k in kategorie.values()),
    }
    for kluc, hodnota in sucty.items():
        if kpi.get(kluc) != hodnota:
            anomalie.append(f"KPI {kluc}={kpi.get(kluc)} ≠ súčet kategórií {hodnota}")

    # 2) Neznáme kategórie (mimo číselníka)
    for k in kategorie:
        if k not in KATEGORIE_PORADIE:
            anomalie.append(f"neznáma veková kategória: {k!r}")

    # 3) Pokrytie divákov
    pokrytie = doc.get("methodologyFlags", {}).get("divaciPokrytie")
    if pokrytie is None:
        anomalie.append("chýba methodologyFlags.divaciPokrytie")
    elif not (0.0 <= pokrytie <= 1.0):
        anomalie.append(f"divaciPokrytie mimo <0,1>: {pokrytie}")
    elif pokrytie < DIVACI_POKRYTIE_MIN:
        anomalie.append(
            f"nízke pokrytie divákov {pokrytie:.1%} (< {DIVACI_POKRYTIE_MIN:.0%}) — publikovať s upozornením"
        )

    # 4) Osoby: súčet po kategóriách musí byť ≥ unikáty (dvojité pôsobenie)
    for rola, data in doc.get("osoby", {}).items():
        sucet = sum(data.get("poKategorii", {}).values())
        if sucet < data.get("unikatni", 0):
            anomalie.append(
                f"osoby.{rola}: súčet po kategóriách {sucet} < unikátni {data.get('unikatni')}"
            )

    # 5) Osoby v kategóriách, ktoré nemajú zápasy
    for rola, data in doc.get("osoby", {}).items():
        for k in data.get("poKategorii", {}):
            if k not in kategorie:
                anomalie.append(f"osoby.{rola}: kategória {k} nemá žiadny uzavretý zápas")

    return anomalie
