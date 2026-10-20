"""Die Ortssuche im Browser (lib/orte.ts) und der Index (gebiete_bauen.py) müssen Namen gleich normalisieren,
sonst findet die Suche Orte nicht. Beide Seiten prüfen dieselben Fälle aus tests/faelle/normalisieren.json."""
import json
import sys
import unittest
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WURZEL / 'scripts' / 'gebiete'))
import gebiete_bauen  # noqa: E402


class Normalisieren(unittest.TestCase):
    def test_gleiche_faelle_wie_im_browser(self):
        faelle = json.loads((WURZEL / 'tests' / 'faelle' / 'normalisieren.json').read_text(encoding='utf-8'))
        for eingabe, erwartet in faelle:
            with self.subTest(eingabe=eingabe):
                self.assertEqual(gebiete_bauen.normalisieren(eingabe), erwartet)


if __name__ == '__main__':
    unittest.main()
