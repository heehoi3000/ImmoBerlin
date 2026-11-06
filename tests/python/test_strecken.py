"""Prüft scripts/strecken/strecken_bauen.py mit zwei kleinen Linienrelationen."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
SKRIPT = WURZEL / 'scripts' / 'strecken' / 'strecken_bauen.py'
sys.path.insert(0, str(SKRIPT.parent))
import strecken_bauen as sb  # noqa: E402

OPL = ('r1 v1 dV c0 t i0 u Ttype=route,route=subway,ref=U8,operator=BVG,colour=#224F86 Mw10@,w11@,n5@stop,w12@platform\n'
       'r2 v1 dV c0 t i0 u Ttype=route,route=bus,ref=M41;N41,operator=BVG%20%Bus Mw11@\n')
WEGE = [
    {'type': 'Feature', 'id': 'w10', 'geometry': {'type': 'LineString', 'coordinates': [[13.4, 52.5], [13.41, 52.51]]}},
    {'type': 'Feature', 'id': 'w11', 'geometry': {'type': 'LineString', 'coordinates': [[13.41, 52.51], [13.42, 52.52]]}},
    {'type': 'Feature', 'id': 'w12', 'geometry': {'type': 'LineString', 'coordinates': [[9.0, 50.0], [9.1, 50.1]]}},
]


class Strecken(unittest.TestCase):
    def test_schluessel(self):
        self.assertEqual(sb.schluessel('S 41'), 's41')
        self.assertEqual(sb.schluessel('Fähre'), 'faehre')

    def test_farbe(self):
        self.assertEqual(sb.farbe('#F00'), '#ff0000')
        self.assertEqual(sb.farbe('red'), '#ff0000')
        self.assertEqual(sb.farbe('224F86'), '#224f86')
        self.assertEqual(sb.farbe('rot-weiß'), '')

    def test_polyline(self):
        self.assertEqual(sb.polyline([(13.4, 52.5), (13.42, 52.52)]), '_|l_I_expA_|B_|B')

    def test_relationen_lesen(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'r.opl'
            p.write_text(OPL, encoding='utf-8')
            rel = list(sb.relationen_lesen(p))
        self.assertEqual(rel[0], (1, {'type': 'route', 'route': 'subway', 'ref': 'U8', 'operator': 'BVG', 'colour': '#224F86'}, [10, 11]))
        self.assertEqual(rel[1][1]['operator'], 'BVG Bus')

    def test_bauen(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / 'r.opl').write_text(OPL, encoding='utf-8')
            (d / 'w.geojsonseq').write_text(''.join('\x1e' + json.dumps(w) + '\n' for w in WEGE), encoding='utf-8')
            (d / 'l.csv').write_text('typ,nummer\nubahn,U8\nbus,M41\nbus,100\n', encoding='utf-8')
            subprocess.run([sys.executable, str(SKRIPT), str(d / 'r.opl'), str(d / 'w.geojsonseq'), str(d / 'aus'),
                            str(d / 'l.csv')], check=True, capture_output=True)
            u8 = json.loads((d / 'aus/i/u/u8.json').read_text())
            self.assertEqual(u8, [[1, 'BVG', [13.4, 52.5, 13.42, 52.52], '#224f86']])
            # Bahnsteig (w12) gehört nicht zum Verlauf; zwei Wege werden zu einem Linienzug
            self.assertEqual(json.loads((d / 'aus/r/1.json').read_text()), {'p': ['_|l_I_expA_|B_|B']})
            self.assertTrue((d / 'aus/i/b/n41.json').exists())
            stand = json.loads((d / 'aus/stand.json').read_text())
            self.assertEqual(stand['abdeckung_nach_nummer'], {'bus': '1/2 (50 %)', 'ubahn': '1/1 (100 %)'})


if __name__ == '__main__':
    unittest.main()
