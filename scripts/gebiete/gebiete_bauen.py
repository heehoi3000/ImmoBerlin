"""Baut aus OpenStreetMap-Verwaltungsgrenzen statische Dateien für den Bezirksfilter.

Eingabe: GeoJSON-Sequenz aus `osmium export` (nur boundary=administrative).
Ausgabe (im Zielordner):
  l/<ort-relation>.json   Bezirke (admin_level 9) und Ortsteile (10) eines Orts: [{id, name, ebene}]
  g/<relation>.json       vereinfachte Grenze (GeoJSON-Geometrie) eines Orts, Bezirks oder Ortsteils
  stand.json              Erstellungszeit

Orte sind Gemeinden/Städte (admin_level 8), kreisfreie Städte und Kreise (6) und Stadtstaaten (4).
Ein Bezirk gehört zu jedem dieser Orte, in dem sein Mittelpunkt liegt.

Aufruf: python3 gebiete_bauen.py grenzen.geojsonseq ziel/
"""
import json
import os
import sys
import time

from shapely.geometry import mapping, shape
from shapely.strtree import STRtree
from shapely.validation import make_valid

ORT_EBENEN = {'4', '6', '8'}
BEZIRK_EBENEN = {'9': 'bezirk', '10': 'ortsteil'}
# Länder wie Bayern hätten tausende Bezirke; nur Stadtstaaten (Berlin, Hamburg, Bremen) bleiben übrig
MAX_BEZIRKE_LAND = 400
VEREINFACHUNG = 0.0001  # Grad, etwa 10 m


def relation_id(merkmal):
    roh = str(merkmal.get('id', ''))
    if roh.startswith('r'):
        return int(roh[1:])
    if roh.startswith('a'):
        # Flächen-ID von osmium: Relation n wird zu 2n+1
        n = int(roh[1:])
        return n // 2 if n % 2 == 1 else None
    return None


def runden(koordinaten):
    if isinstance(koordinaten[0], (int, float)):
        return [round(koordinaten[0], 5), round(koordinaten[1], 5)]
    return [runden(k) for k in koordinaten]


def grenze(geom):
    g = geom.simplify(VEREINFACHUNG, preserve_topology=True)
    if g.geom_type not in ('Polygon', 'MultiPolygon'):
        g = geom
    m = mapping(g)
    return {'type': m['type'], 'coordinates': runden(m['coordinates'])}


def schreiben(pfad, daten):
    with open(pfad, 'w', encoding='utf-8') as f:
        json.dump(daten, f, ensure_ascii=False, separators=(',', ':'))


def main(eingabe, ziel):
    orte, bezirke = [], []
    with open(eingabe, encoding='utf-8') as f:
        for zeile in f:
            zeile = zeile.strip('\x1e \n')
            if not zeile:
                continue
            m = json.loads(zeile)
            p = m.get('properties') or {}
            ebene, name, rid = p.get('admin_level'), p.get('name'), relation_id(m)
            if not name or rid is None or not m.get('geometry'):
                continue
            if ebene not in ORT_EBENEN and ebene not in BEZIRK_EBENEN:
                continue
            geom = shape(m['geometry'])
            if not geom.is_valid:
                geom = make_valid(geom)
            if geom.is_empty or geom.geom_type not in ('Polygon', 'MultiPolygon'):
                continue
            eintrag = {'id': rid, 'name': name, 'ebene': ebene, 'geom': geom}
            (orte if ebene in ORT_EBENEN else bezirke).append(eintrag)
    print(f'{len(orte)} Orte, {len(bezirke)} Bezirke/Ortsteile gelesen')

    baum = STRtree([o['geom'] for o in orte])
    zuordnung = {}
    for b in bezirke:
        punkt = b['geom'].representative_point()
        for i in baum.query(punkt, predicate='within'):
            zuordnung.setdefault(orte[i]['id'], []).append(b)

    os.makedirs(os.path.join(ziel, 'l'), exist_ok=True)
    os.makedirs(os.path.join(ziel, 'g'), exist_ok=True)
    orte_nach_id = {o['id']: o for o in orte}
    mit_bezirken = 0
    for ort_id, liste in zuordnung.items():
        if orte_nach_id[ort_id]['ebene'] == '4' and len(liste) > MAX_BEZIRKE_LAND:
            continue
        liste = sorted({b['id']: b for b in liste}.values(), key=lambda b: b['name'])
        schreiben(os.path.join(ziel, 'l', f'{ort_id}.json'),
                  [{'id': b['id'], 'name': b['name'], 'ebene': BEZIRK_EBENEN[b['ebene']]} for b in liste])
        mit_bezirken += 1

    geschrieben = 0
    for e in orte + bezirke:
        # Länder nur, wenn sie als Stadtstaat eine Bezirksliste haben
        if e['ebene'] == '4' and not os.path.exists(os.path.join(ziel, 'l', f"{e['id']}.json")):
            continue
        schreiben(os.path.join(ziel, 'g', f"{e['id']}.json"), grenze(e['geom']))
        geschrieben += 1

    schreiben(os.path.join(ziel, 'stand.json'), {'erstellt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
    print(f'{mit_bezirken} Orte mit Bezirken, {geschrieben} Grenzen geschrieben')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
