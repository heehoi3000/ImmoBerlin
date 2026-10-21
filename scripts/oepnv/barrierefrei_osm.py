#!/usr/bin/env python3
"""Liest Haltestellen mit wheelchair-Angabe aus einem OSM-Auszug (osmium export als GeoJSON-Sequenz)
und schreibt sie als CSV für die Tabelle oepnv_barrierefrei (Workflow barrierefrei.yml).

  osm_id, art (bahnhof | bahnsteig | bushalt), wert (ja | eingeschraenkt | nein), lat, lon

Wege und Flächen (z. B. Bahnsteige) bekommen den Mittelpunkt ihrer Punkte. Nur Standardbibliothek.
Aufruf: python3 barrierefrei_osm.py oev.geojsonseq barrierefrei.csv
"""
import csv
import json
import sys

WERTE = {'yes': 'ja', 'designated': 'ja', 'limited': 'eingeschraenkt', 'no': 'nein'}


def art(p):
    if p.get('railway') in ('station', 'halt') or p.get('public_transport') == 'station':
        return 'bahnhof'
    if p.get('highway') == 'bus_stop' or (p.get('public_transport') == 'platform' and p.get('bus') == 'yes'):
        return 'bushalt'
    return 'bahnsteig'


def punkte(geometrie):
    """Alle Koordinaten einer GeoJSON-Geometrie."""
    def flach(k):
        if k and isinstance(k[0], (int, float)):
            yield k
        else:
            for x in k:
                yield from flach(x)
    return list(flach(geometrie['coordinates']))


def mitte(geometrie):
    p = punkte(geometrie)
    return sum(x[1] for x in p) / len(p), sum(x[0] for x in p) / len(p)


def main(ein, aus):
    n = 0
    with open(ein, encoding='utf-8') as f, open(aus, 'w', newline='', encoding='utf-8') as g:
        w = csv.writer(g)
        w.writerow(['osm_id', 'art', 'wert', 'lat', 'lon'])
        for zeile in f:
            zeile = zeile.lstrip('\x1e').strip()
            if not zeile:
                continue
            obj = json.loads(zeile)
            p = obj['properties']
            wert = WERTE.get((p.get('wheelchair') or '').strip())
            if wert is None or p.get('highway') == 'elevator':
                continue
            lat, lon = mitte(obj['geometry'])
            w.writerow([f"{p.get('@type', '?')[0]}{p.get('@id', '')}", art(p), wert, f'{lat:.6f}', f'{lon:.6f}'])
            n += 1
    print(f'{n} Haltestellen mit Angabe zur Barrierefreiheit -> {aus}', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
