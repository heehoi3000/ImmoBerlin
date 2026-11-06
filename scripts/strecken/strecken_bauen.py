"""Baut aus OpenStreetMap-Linienrelationen (route=bus, tram, subway, train, ...) statische Dateien mit dem
echten Streckenverlauf jeder Linie.

Eingabe:
  relationen.opl     nur die Linienrelationen, aus `osmium tags-filter ... -R -f opl`
  wege.geojsonseq    alle Wege dieser Relationen als Linien, aus `osmium export --add-unique-id=type_id`
  linien.csv         optional: typ,nummer unserer Linien (für die Abdeckung im Bericht)

Ausgabe (im Zielordner):
  i/<gruppe>/<schluessel>.json   Verzeichnis je Verkehrsmittelgruppe und Liniennummer:
                                 [[relation, betreiber, [west, süd, ost, nord], farbe], ...]
                                 farbe = OSM-Tag colour als #rrggbb, sonst ""
  r/<relation>.json              Streckenverlauf: {"p": ["<polyline>", ...]} (Google-Polyline, 5 Stellen)
  stand.json                     Erstellungszeit und Kennzahlen

Gruppen: u = U-Bahn, t = Tram/Stadtbahn, z = Zug (S-Bahn, Regional, Fern), b = Bus, f = Fähre.
Der Schlüssel ist die Liniennummer klein und nur mit a-z/0-9 ("S 41" -> "s41"), wie in lib/strecken.ts.

Aufruf: python3 strecken_bauen.py relationen.opl wege.geojsonseq ziel/ [linien.csv]
"""
import csv
import json
import os
import re
import sys
import time
from array import array
from collections import Counter, defaultdict

from shapely.geometry import LineString
from shapely.ops import linemerge

# OSM-Verkehrsmittel -> unsere Gruppen
GRUPPEN_OSM = {
    'subway': ['u'], 'tram': ['t'], 'light_rail': ['t', 'z'], 'monorail': ['t'],
    'train': ['z'], 'bus': ['b'], 'trolleybus': ['b'], 'ferry': ['f'],
}
# Unsere Linientypen (oepnv_linien.typ) -> Gruppe, nur für den Abdeckungsbericht
GRUPPE_TYP = {'ubahn': 'u', 'tram': 't', 'sbahn': 'z', 'regional': 'z', 'fern': 'z',
              'bus': 'b', 'ersatzverkehr': 'b', 'faehre': 'f'}
VEREINFACHUNG = 0.00005  # Grad, etwa 4–5 m
NICHT_STRECKE = re.compile(r'^(platform|stop|hail)', re.I)
FARBNAMEN = {'red': '#ff0000', 'green': '#008000', 'blue': '#0000ff', 'yellow': '#ffff00', 'orange': '#ffa500',
             'purple': '#800080', 'brown': '#a52a2a', 'black': '#000000', 'grey': '#808080', 'gray': '#808080',
             'pink': '#ffc0cb', 'magenta': '#ff00ff', 'cyan': '#00ffff', 'white': '#ffffff'}


def farbe(wert):
    """OSM-Tag colour als #rrggbb ('#F00', 'red', 'ff0000' werden vereinheitlicht), sonst ''."""
    w = (wert or '').strip().lower()
    w = FARBNAMEN.get(w, w)
    if re.fullmatch(r'#?[0-9a-f]{6}', w):
        return '#' + w.lstrip('#')
    if re.fullmatch(r'#?[0-9a-f]{3}', w):
        return '#' + ''.join(c * 2 for c in w.lstrip('#'))
    return ''


def schluessel(ref):
    s = ref.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    return re.sub(r'[^a-z0-9]', '', s)


def opl_text(s):
    # OPL maskiert Sonderzeichen als %<hex>%
    return re.sub(r'%([0-9a-fA-F]+)%', lambda m: chr(int(m.group(1), 16)), s)


def relationen_lesen(pfad):
    for zeile in open(pfad, encoding='utf-8'):
        if not zeile.startswith('r'):
            continue
        teile = zeile.rstrip('\n').split(' ')
        rid = int(teile[0][1:])
        tags, mitglieder = {}, []
        for t in teile[1:]:
            if t.startswith('T') and len(t) > 1:
                for kv in t[1:].split(','):
                    if '=' in kv:
                        k, v = kv.split('=', 1)
                        tags[opl_text(k)] = opl_text(v)
            elif t.startswith('M') and len(t) > 1:
                for m in t[1:].split(','):
                    if m.startswith('w') and '@' in m:
                        wid, rolle = m[1:].split('@', 1)
                        if not NICHT_STRECKE.match(opl_text(rolle)):
                            mitglieder.append(int(wid))
        yield rid, tags, mitglieder


def polyline(koordinaten):
    """Google-Polyline mit 5 Nachkommastellen; koordinaten als [(lon, lat), ...]."""
    aus, plat, plon = [], 0, 0
    for lon, lat in koordinaten:
        ilat, ilon = round(lat * 1e5), round(lon * 1e5)
        for d in (ilat - plat, ilon - plon):
            d = ~(d << 1) if d < 0 else d << 1
            while d >= 0x20:
                aus.append(chr((0x20 | (d & 0x1f)) + 63))
                d >>= 5
            aus.append(chr(d + 63))
        plat, plon = ilat, ilon
    return ''.join(aus)


def main():
    rel_pfad, wege_pfad, ziel = sys.argv[1:4]
    linien_pfad = sys.argv[4] if len(sys.argv) > 4 else None
    start = time.time()

    relationen = []
    benoetigt = set()
    for rid, tags, mitglieder in relationen_lesen(rel_pfad):
        gruppen = GRUPPEN_OSM.get(tags.get('route', ''))
        refs = [r.strip() for r in tags.get('ref', '').split(';') if schluessel(r)]
        if not gruppen or not refs or not mitglieder:
            continue
        betreiber = (tags.get('operator') or tags.get('network') or '')[:60]
        relationen.append((rid, gruppen, refs, betreiber, mitglieder, tags.get('route'), farbe(tags.get('colour'))))
        benoetigt.update(mitglieder)
    print(f'{len(relationen)} Linienrelationen mit Nummer, {len(benoetigt)} Wege', flush=True)

    # Wege kompakt im Speicher: id -> array('d') [lon, lat, lon, lat, ...]
    wege = {}
    with open(wege_pfad, encoding='utf-8') as f:
        for zeile in f:
            zeile = zeile.strip().lstrip('\x1e')
            if not zeile:
                continue
            m = json.loads(zeile)
            roh = str(m.get('id', ''))
            if not roh.startswith('w'):
                continue
            wid = int(roh[1:])
            g = m.get('geometry') or {}
            if wid in benoetigt and g.get('type') == 'LineString':
                wege[wid] = array('d', [c for p in g['coordinates'] for c in p])
    print(f'{len(wege)} Wege gelesen ({time.time() - start:.0f} s)', flush=True)

    os.makedirs(os.path.join(ziel, 'r'), exist_ok=True)
    verzeichnis = defaultdict(list)
    zaehler = Counter()
    groesse_r = 0
    for rid, gruppen, refs, betreiber, mitglieder, route, linienfarbe in relationen:
        stuecke = []
        for wid in mitglieder:
            a = wege.get(wid)
            if a and len(a) >= 4:
                stuecke.append(LineString(list(zip(a[0::2], a[1::2]))))
        if not stuecke:
            zaehler['ohne_geometrie'] += 1
            continue
        geom = linemerge(stuecke).simplify(VEREINFACHUNG, preserve_topology=False)
        teile = [geom] if geom.geom_type == 'LineString' else list(getattr(geom, 'geoms', []))
        linien = [polyline(list(t.coords)) for t in teile if len(t.coords) >= 2]
        if not linien:
            zaehler['ohne_geometrie'] += 1
            continue
        daten = json.dumps({'p': linien}, separators=(',', ':'))
        with open(os.path.join(ziel, 'r', f'{rid}.json'), 'w', encoding='utf-8') as f:
            f.write(daten)
        groesse_r += len(daten.encode())
        w, s, o, n = geom.bounds
        eintrag = [rid, betreiber, [round(w, 3), round(s, 3), round(o, 3), round(n, 3)], linienfarbe]
        if linienfarbe:
            zaehler['mit_farbe'] += 1
        for g in gruppen:
            for ref in refs:
                verzeichnis[(g, schluessel(ref))].append(eintrag)
        zaehler[route] += 1

    groesse_i = 0
    for (g, k), eintraege in verzeichnis.items():
        os.makedirs(os.path.join(ziel, 'i', g), exist_ok=True)
        daten = json.dumps(eintraege, separators=(',', ':'), ensure_ascii=False)
        with open(os.path.join(ziel, 'i', g, f'{k}.json'), 'w', encoding='utf-8') as f:
            f.write(daten)
        groesse_i += len(daten.encode())

    bericht = {
        'stand': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'relationen': sum(v for k, v in zaehler.items() if k not in ('ohne_geometrie', 'mit_farbe')),
        'ohne_geometrie': zaehler['ohne_geometrie'],
        'mit_farbe': zaehler['mit_farbe'],
        'je_verkehrsmittel': {k: v for k, v in zaehler.items() if k not in ('ohne_geometrie', 'mit_farbe')},
        'verzeichnisdateien': len(verzeichnis),
        'groesse_strecken_mb': round(groesse_r / 1e6, 1),
        'groesse_verzeichnis_mb': round(groesse_i / 1e6, 1),
    }

    if linien_pfad:
        gesamt, gefunden = Counter(), Counter()
        for zeile in csv.DictReader(open(linien_pfad, encoding='utf-8')):
            g = GRUPPE_TYP.get(zeile['typ'])
            if not g:
                continue
            gesamt[zeile['typ']] += 1
            if (g, schluessel(zeile['nummer'])) in verzeichnis:
                gefunden[zeile['typ']] += 1
        bericht['abdeckung_nach_nummer'] = {
            t: f'{gefunden[t]}/{gesamt[t]} ({100 * gefunden[t] / gesamt[t]:.0f} %)' for t in sorted(gesamt)}

    with open(os.path.join(ziel, 'stand.json'), 'w', encoding='utf-8') as f:
        json.dump(bericht, f, ensure_ascii=False, indent=1)
    print(json.dumps(bericht, ensure_ascii=False, indent=1))
    print(f'fertig in {time.time() - start:.0f} s')


if __name__ == '__main__':
    main()
