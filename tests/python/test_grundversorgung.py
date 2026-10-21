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


if __name__ == '__main__':
    unittest.main()
