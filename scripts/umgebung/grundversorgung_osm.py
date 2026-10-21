#!/usr/bin/env python3
"""Liest Orte der Grundversorgung aus einem OSM-Auszug (osmium export als GeoJSON-Sequenz) und schreibt sie
als CSV für die Tabelle grundversorgung (Workflow grundversorgung.yml).

  osm_id, art, name, lat, lon

art: supermarkt, drogerie, baeckerei, apotheke, hausarzt, post, geldautomat.
Wege und Flächen (z. B. ein Supermarkt als Gebäude) bekommen den Mittelpunkt ihrer Punkte. Nur Standardbibliothek.
Aufruf: python3 grundversorgung_osm.py orte.geojsonseq grundversorgung.csv
"""
import csv
import json
import sys

SHOP = {'supermarket': 'supermarkt', 'chemist': 'drogerie', 'bakery': 'baeckerei'}
AMENITY = {'pharmacy': 'apotheke', 'post_office': 'post', 'parcel_locker': 'post', 'atm': 'geldautomat'}


def werte(text):
    return {w.strip() for w in (text or '').split(';')}


def art(p):
    """Art eines OSM-Objekts oder None, wenn es nicht zur Grundversorgung zählt."""
    if p.get('shop') in SHOP:
        return SHOP[p['shop']]
    a = p.get('amenity')
    if a in AMENITY:
        return AMENITY[a]
    if a == 'bank' and p.get('atm') == 'yes':
        return 'geldautomat'
    # Hausarzt: Praxis für Allgemeinmedizin; Fachärzte und Praxen ohne Fachangabe zählen nicht
    if (a == 'doctors' or p.get('healthcare') == 'doctor') and 'general' in werte(p.get('healthcare:speciality')):
        return 'hausarzt'
    return None


def name(p, a):
    n = p.get('name') or p.get('brand') or p.get('operator') or ''
    if not n and a == 'post' and p.get('amenity') == 'parcel_locker':
        n = 'Paketstation'
    return ' '.join(n.split())[:80]


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
        w.writerow(['osm_id', 'art', 'name', 'lat', 'lon'])
        for zeile in f:
            zeile = zeile.lstrip('\x1e').strip()
            if not zeile:
                continue
            obj = json.loads(zeile)
            p = obj['properties']
            a = art(p)
            if a is None:
                continue
            lat, lon = mitte(obj['geometry'])
            w.writerow([f"{p.get('@type', '?')[0]}{p.get('@id', '')}", a, name(p, a), f'{lat:.6f}', f'{lon:.6f}'])
            n += 1
    print(f'{n} Orte der Grundversorgung -> {aus}', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
