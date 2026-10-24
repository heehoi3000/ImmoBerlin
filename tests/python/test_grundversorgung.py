"""Prüft scripts/umgebung/grundversorgung_osm.py mit einer kleinen GeoJSON-Sequenz."""
import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WURZEL / 'scripts' / 'umgebung'))
import grundversorgung_osm as gv  # noqa: E402


def punkt(typ, i, tags, lon=13.4, lat=52.5):
    return {'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
            'properties': {'@type': typ, '@id': i, **tags}}


class Grundversorgung(unittest.TestCase):
    def test_arten(self):
        self.assertEqual(gv.art({'shop': 'supermarket'}), 'supermarkt')
        self.assertEqual(gv.art({'shop': 'chemist'}), 'drogerie')
        self.assertEqual(gv.art({'amenity': 'pharmacy'}), 'apotheke')
        self.assertEqual(gv.art({'amenity': 'parcel_locker'}), 'post')
        self.assertEqual(gv.art({'amenity': 'bank', 'atm': 'yes'}), 'geldautomat')
        self.assertIsNone(gv.art({'amenity': 'bank'}))
        self.assertEqual(gv.art({'amenity': 'doctors', 'healthcare:speciality': 'general;internal'}), 'hausarzt')
        self.assertIsNone(gv.art({'amenity': 'doctors', 'healthcare:speciality': 'dentist'}))
        self.assertIsNone(gv.art({'amenity': 'doctors'}))
        self.assertIsNone(gv.art({'shop': 'clothes'}))
        self.assertEqual(gv.art({'amenity': 'kindergarten'}), 'kita')
        self.assertEqual(gv.art({'amenity': 'school'}), 'schule')
        self.assertEqual(gv.art({'leisure': 'playground'}), 'spielplatz')
        self.assertEqual(gv.art({'leisure': 'park'}), 'park')
        self.assertEqual(gv.name({'leisure': 'playground', 'name': 'Spielplatz Am Teich'}, 'spielplatz'), '')

    def test_csv(self):
        flaeche = {'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': [[[13.0, 52.0], [13.2, 52.0], [13.2, 52.2], [13.0, 52.0]]]},
                   'properties': {'@type': 'way', '@id': 5, 'shop': 'supermarket', 'brand': 'Rewe'}}
        objekte = [punkt('node', 1, {'amenity': 'pharmacy', 'name': '  Linden-\nApotheke '}), flaeche,
                   punkt('node', 2, {'amenity': 'parcel_locker'}), punkt('node', 3, {'shop': 'clothes', 'name': 'X'}),
                   punkt('node', 4, {'amenity': 'doctors', 'healthcare:speciality': 'general', 'name': 'Dr. Muster'})]
        with tempfile.TemporaryDirectory() as d:
            ein, aus = Path(d) / 'orte.geojsonseq', Path(d) / 'gv.csv'
            ein.write_text(''.join('\x1e' + json.dumps(o) + '\n' for o in objekte), encoding='utf-8')
            gv.main(ein, aus)
            with open(aus, encoding='utf-8') as f:
                zeilen = list(csv.DictReader(f))
        self.assertEqual([(z['osm_id'], z['art'], z['name']) for z in zeilen],
                         [('n1', 'apotheke', 'Linden- Apotheke'), ('w5', 'supermarkt', 'Rewe'), ('n2', 'post', 'Paketstation'), ('n4', 'hausarzt', '')])
        self.assertEqual(zeilen[1]['lat'], '52.050000')

    def test_spielplaetze_ausgeduennt(self):
        # zwei Spielplätze 30 m auseinander zählen einmal, einer 500 m weiter extra; Kitas werden nie ausgedünnt
        sp = {'leisure': 'playground'}
        objekte = [punkt('node', 1, sp, 13.40, 52.5300), punkt('node', 2, sp, 13.40, 52.5303),
                   punkt('node', 3, sp, 13.40, 52.5345), punkt('node', 4, {'amenity': 'kindergarten'}, 13.40, 52.5300),
                   punkt('node', 5, {'amenity': 'kindergarten'}, 13.40, 52.5300)]
        with tempfile.TemporaryDirectory() as d:
            ein, aus = Path(d) / 'orte.geojsonseq', Path(d) / 'gv.csv'
            ein.write_text(''.join(json.dumps(o) + '\n' for o in objekte), encoding='utf-8')
            gv.main(ein, aus)
            with open(aus, encoding='utf-8') as f:
                ids = [z['osm_id'] for z in csv.DictReader(f)]
        self.assertEqual(ids, ['n1', 'n3', 'n4', 'n5'])


if __name__ == '__main__':
    unittest.main()
