#!/usr/bin/env python3
"""Kurzer Qualitätsbericht zu linien.csv aus gtfs_linien_export.py.

Zeigt Linien je Typ und mögliche Doppelungen: gleicher Betreiber, gleiche Nummer und gleicher
Typ mit Mittelpunkten näher als 20 km. Das deutet auf eine Linie hin, die in mehrere zerfallen ist
(z. B. weil Hin- und Rückrichtung keine gemeinsame Haltestellen-ID haben).

    python3 scripts/oepnv/linien_pruefen.py oepnv_csv/linien.csv
"""
import csv
import math
import sys
from collections import Counter, defaultdict


def km(a, b):
    dlat = math.radians(b[0] - a[0])
    dlon = math.radians(b[1] - a[1]) * math.cos(math.radians((a[0] + b[0]) / 2))
    return 6371 * math.hypot(dlat, dlon)


def main(pfad):
    linien = list(csv.DictReader(open(pfad, encoding="utf-8")))
    print(f"{len(linien)} Linien:", ", ".join(f"{t} {n}" for t, n in Counter(l["typ"] for l in linien).most_common()))

    gruppen = defaultdict(list)
    for l in linien:
        gruppen[(l["betreiber"], l["nummer"].upper(), l["typ"])].append(l)
    doppelt = []
    for schluessel, ls in gruppen.items():
        punkte = [(float(l["lat"]), float(l["lon"])) for l in ls]
        if any(km(punkte[i], punkte[j]) < 20 for i in range(len(ls)) for j in range(i + 1, len(ls))):
            doppelt.append((schluessel, ls))
    print(f"Mögliche Doppelungen (gleiche Linie, < 20 km): {len(doppelt)} Schlüssel, "
          f"{sum(len(ls) for _, ls in doppelt)} Linien")
    for (betreiber, nummer, typ), ls in sorted(doppelt, key=lambda x: -len(x[1]))[:25]:
        print(f"  {nummer} ({typ}, {betreiber[:30]}): {len(ls)}x  " + " | ".join(l["endpunkte"][:40] for l in ls[:3]))

    print("Stichprobe Berlin:")
    for nummer in ("U2", "U8", "S1", "S41", "M10", "100", "RE1"):
        treffer = [l for l in linien if l["nummer"] == nummer
                   and 52.3 < float(l["lat"]) < 52.7 and 13.1 < float(l["lon"]) < 13.8]
        print(f"  {nummer}: " + (" | ".join(f"{l['typ']}, {l['betreiber'][:20]}, {l['endpunkte'][:40]}" for l in treffer) or "nicht gefunden"))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
