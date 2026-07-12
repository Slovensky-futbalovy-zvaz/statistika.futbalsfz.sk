# Dáta

Schémy a vzorky predgenerovaných JSON súborov (produkčné dáta generuje ETL, fáza F1).

## Plánovaná štruktúra publikovaných dát

```
index.json                      # zoznam zväzov + dostupné sezóny
zvaz/{id}/{sezona}.json         # profil zväzu: KPI, vekové kategórie/úrovne, osoby
porovnania/{uroven}/{sezona}.json  # tabuľka zväzov úrovne pre porovnávanie a radenie
demografia/{id}.json            # 10-ročné časové rady osôb (roly × kategórie × pohlavie)
```

Každý súbor obsahuje `generatedAt` (časová pečiatka ETL behu) a `methodologyFlags` (napr. % pokrytia divákov, zlúčené premenované súťaže).
