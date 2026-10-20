"""Baut aus OpenStreetMap-Grenzen statische Dateien für Ortssuche und Bezirksfilter.

Eingabe: GeoJSON-Sequenz aus `osmium export` (boundary=administrative und boundary=postal_code).
Ausgabe (im Zielordner):
  l/<ort-relation>.json   Bezirke (admin_level 9) und Ortsteile (10) eines Orts: [{id, name, ebene}]
  g/<relation>.json       vereinfachte Grenze (GeoJSON-Geometrie) eines Orts, Bezirks, Ortsteils oder PLZ-Gebiets
  o/<schluessel>.json     Ortssuche: alle Orte, deren eigener Name (ohne Land/Stadt) ein Wort mit diesen zwei Anfangszeichen hat
  o/_1.json               Ortssuche nach dem ersten Zeichen: die größten Orte je Anfangszeichen
  stand.json              Erstellungszeit

Orte sind Gemeinden/Städte (admin_level 8), kreisfreie Städte und Kreise (6) und Stadtstaaten (4).
Ein Bezirk gehört zu jedem dieser Orte, in dem sein Mittelpunkt liegt.

Aufruf: python3 gebiete_bauen.py grenzen.geojsonseq ziel/
"""
import json
import os
import re
import sys
import time
import unicodedata

from shapely.geometry import mapping, shape
from shapely.strtree import STRtree
from shapely.validation import make_valid

ORT_EBENEN = {'4', '6', '8'}
BEZIRK_EBENEN = {'9': 'bezirk', '10': 'ortsteil'}
# Länder wie Bayern hätten tausende Bezirke; nur Stadtstaaten (Berlin, Hamburg, Bremen) bleiben übrig
MAX_BEZIRKE_LAND = 400
VEREINFACHUNG = 0.0001  # Grad, etwa 10 m
# Gewicht für die Reihenfolge der Vorschläge, wenn keine Einwohnerzahl getaggt ist
GEWICHT_OHNE_EINWOHNER = {'4': 3_000_000, '6': 150_000, '8': 2_000, '9': 3_000, '10': 500, 'plz': 0}
# Landkreise ohne Einwohnerzahl hinter gleichnamige Städte stellen
GEWICHT_LANDKREIS = 20_000
# Füllwörter tragen keinen eigenen Suchschlüssel (der Namensanfang zählt trotzdem)
FUELLWOERTER = {'am', 'an', 'auf', 'bei', 'der', 'die', 'den', 'des', 'dem', 'im', 'in', 'ob', 'vor', 'zu', 'zum', 'zur',
                'kreis', 'landkreis', 'stadt', 'kreisfreie', 'gemeinde', 'samtgemeinde', 'verwaltungsgemeinschaft'}
VORSCHLAEGE_ERSTES_ZEICHEN = 20


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


# Muss zu normalisieren() in lib/orte.ts passen
def normalisieren(text):
    text = text.lower().replace('ß', 'ss')
    text = unicodedata.normalize('NFD', text)
    text = ''.join(z for z in text if unicodedata.category(z) != 'Mn')
    # "koeln" und "köln" sollen dasselbe finden
    text = text.replace('ae', 'a').replace('oe', 'o').replace('ue', 'u')
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()


def schluessel(text):
    """Zweistellige Suchschlüssel: Namensanfang und Anfang jedes weiteren Worts."""
    worte = normalisieren(text).split()
    ergebnis = set()
    for i, w in enumerate(worte):
        if len(w) >= 2 and (i == 0 or w not in FUELLWOERTER):
            ergebnis.add(w[:2])
    return ergebnis


def einwohner(p):
    try:
        return int(str(p.get('population', '')).replace('.', '').replace(' ', ''))
    except ValueError:
        return None


def lesen(eingabe):
    orte, bezirke, plz = [], [], []
    with open(eingabe, encoding='utf-8') as f:
        for zeile in f:
            zeile = zeile.strip('\x1e \n')
            if not zeile:
                continue
            m = json.loads(zeile)
            p = m.get('properties') or {}
            rid = relation_id(m)
            if rid is None or not m.get('geometry'):
                continue
            if p.get('boundary') == 'postal_code':
                code = str(p.get('postal_code') or '').strip()
                if not re.fullmatch(r'\d{5}', code):
                    continue
                ebene, name = 'plz', code
            else:
                ebene, name = p.get('admin_level'), p.get('name')
                if not name or (ebene not in ORT_EBENEN and ebene not in BEZIRK_EBENEN):
                    continue
            geom = shape(m['geometry'])
            if not geom.is_valid:
                geom = make_valid(geom)
            if geom.is_empty or geom.geom_type not in ('Polygon', 'MultiPolygon'):
                continue
            eintrag = {'id': rid, 'name': name, 'ebene': ebene, 'geom': geom, 'einwohner': einwohner(p)}
            if ebene == 'plz':
                plz.append(eintrag)
            elif ebene in ORT_EBENEN:
                orte.append(eintrag)
            else:
                bezirke.append(eintrag)
    return orte, bezirke, plz


def umgebend(baum, liste, geom, ebenen):
    """Alle Einträge der gegebenen Ebenen, in denen der Mittelpunkt von geom liegt, kleinste Fläche zuerst."""
    punkt = geom.representative_point()
    treffer = [liste[i] for i in baum.query(punkt, predicate='within') if liste[i]['ebene'] in ebenen]
    return sorted(treffer, key=lambda e: e['geom'].area)


def ortsindex(orte, bezirke, plz, mit_grenze, mit_liste, baum):
    """Einträge der Ortssuche: {n: Anzeige, k: Kurzname, a: lat, o: lon, b: Ausdehnung, r: Relation, w: Gewicht}."""
    namen8 = {}
    for o in orte:
        if o['ebene'] == '8':
            namen8[o['name']] = namen8.get(o['name'], 0) + 1

    eintraege = []
    gesehen = {}

    def hinzu(e, anzeige, kurz):
        mitte = e['geom'].representative_point()
        b = e['geom'].bounds
        eintrag = {
            'n': anzeige, 'k': kurz, 'a': round(mitte.y, 4), 'o': round(mitte.x, 4),
            'b': [round(b[0], 3), round(b[1], 3), round(b[2], 3), round(b[3], 3)],
            'w': e['einwohner'] if e['einwohner'] is not None else GEWICHT_OHNE_EINWOHNER[e['ebene']],
        }
        if e['einwohner'] is None and e['ebene'] == '6' and re.match(r'(Land)?[Kk]reis|Region', e['name']):
            eintrag['w'] = GEWICHT_LANDKREIS
        if e['id'] in mit_grenze:
            eintrag['r'] = e['id']
        # Kreisfreie Städte gibt es oft doppelt (admin_level 6 und 8): den Eintrag mit Bezirksliste behalten
        doppelt = gesehen.get(anzeige)
        if doppelt is not None:
            alt = eintraege[doppelt]
            if alt.get('r') in mit_liste or (e['id'] not in mit_liste and alt['w'] >= eintrag['w']):
                return
            eintraege[doppelt] = eintrag
            return
        gesehen[anzeige] = len(eintraege)
        eintraege.append(eintrag)

    for o in orte:
        um = umgebend(baum, orte, o['geom'], {'4', '6'})
        land = next((u['name'] for u in um if u['ebene'] == '4'), None)
        kreis = next((u['name'] for u in um if u['ebene'] == '6' and u['id'] != o['id']), None)
        if o['ebene'] == '4':
            anzeige = o['name']
        elif o['ebene'] == '8' and namen8.get(o['name'], 0) > 1 and kreis:
            # gleichnamige Gemeinden (z. B. Neustadt) über den Kreis unterscheiden
            anzeige = ', '.join(t for t in (o['name'], kreis, land) if t)
        else:
            anzeige = ', '.join(t for t in (o['name'], land if land != o['name'] else None) if t)
        hinzu(o, anzeige, o['name'])

    for b in bezirke:
        um = umgebend(baum, orte, b['geom'], ORT_EBENEN)
        stadt = um[0]['name'] if um else None
        # Namen wie "Stadtmitte, Innenstadt, Frankfurt (Oder)" enthalten die Stadt schon
        zusatz = stadt if stadt and stadt not in b['name'] else None
        hinzu(b, ', '.join(t for t in (b['name'], zusatz) if t), b['name'])

    for p in plz:
        um = umgebend(baum, orte, p['geom'], {'8', '6', '4'})
        stadt = um[0]['name'] if um else None
        hinzu(p, ' '.join(t for t in (p['name'], stadt) if t), p['name'])

    eintraege.sort(key=lambda e: -e['w'])
    return eintraege


def main(eingabe, ziel):
    orte, bezirke, plz = lesen(eingabe)
    print(f'{len(orte)} Orte, {len(bezirke)} Bezirke/Ortsteile, {len(plz)} PLZ-Gebiete gelesen')

    baum = STRtree([o['geom'] for o in orte])
    zuordnung = {}
    for b in bezirke:
        for o in umgebend(baum, orte, b['geom'], ORT_EBENEN):
            zuordnung.setdefault(o['id'], []).append(b)

    for unterordner in ('l', 'g', 'o'):
        os.makedirs(os.path.join(ziel, unterordner), exist_ok=True)
    orte_nach_id = {o['id']: o for o in orte}
    mit_liste = set()
    for ort_id, liste in zuordnung.items():
        if orte_nach_id[ort_id]['ebene'] == '4' and len(liste) > MAX_BEZIRKE_LAND:
            continue
        liste = sorted({b['id']: b for b in liste}.values(), key=lambda b: b['name'])
        schreiben(os.path.join(ziel, 'l', f'{ort_id}.json'),
                  [{'id': b['id'], 'name': b['name'], 'ebene': BEZIRK_EBENEN[b['ebene']]} for b in liste])
        mit_liste.add(ort_id)

    mit_grenze = set()
    for e in orte + bezirke + plz:
        # Länder nur, wenn sie als Stadtstaat eine Bezirksliste haben
        if e['ebene'] == '4' and e['id'] not in mit_liste:
            continue
        schreiben(os.path.join(ziel, 'g', f"{e['id']}.json"), grenze(e['geom']))
        mit_grenze.add(e['id'])

    index = ortsindex(orte, bezirke, plz, mit_grenze, mit_liste, baum)
    dateien, erstes = {}, {}
    for e in index:
        schluessel_e = schluessel(e['k'])
        for s in schluessel_e:
            dateien.setdefault(s, []).append(e)
        # Nach dem ersten Zeichen zählt nur der Namensanfang
        z = normalisieren(e['k'])[:1]
        if z and len(erstes.setdefault(z, [])) < VORSCHLAEGE_ERSTES_ZEICHEN and e['w'] > 0:
            erstes[z].append(e)
    for s, liste in dateien.items():
        schreiben(os.path.join(ziel, 'o', f'{s}.json'), liste)
    schreiben(os.path.join(ziel, 'o', '_1.json'), erstes)

    schreiben(os.path.join(ziel, 'stand.json'), {'erstellt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})
    print(f'{len(mit_liste)} Orte mit Bezirken, {len(mit_grenze)} Grenzen, '
          f'{len(index)} Einträge in der Ortssuche ({len(dateien)} Dateien) geschrieben')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
