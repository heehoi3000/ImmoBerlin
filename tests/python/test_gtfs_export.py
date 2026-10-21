"""Prüft scripts/oepnv/gtfs_linien_export.py mit einem kleinen künstlichen Fahrplan.

Die U8 fährt täglich A–B–C–D. Dazu kommen eine Umleitung über X an drei Bautagen,
eine einzelne tägliche Fahrt über Y (wie eine Depotfahrt) und ein Ersatzbus "U8".
Zur Linie dürfen nur A, B, C und D gehören. Die zehn Fahrten der U8 beginnen stündlich ab 5 Uhr,
neun davon liegen im Takt-Zeitfenster 6 bis 20 Uhr.
"""
import csv
import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(WURZEL / 'scripts' / 'oepnv'))
import gtfs_linien_export as export  # noqa: E402


def tabelle(zeilen):
    puffer = io.StringIO()
    csv.writer(puffer, lineterminator='\n').writerows(zeilen)
    return puffer.getvalue()


def feed_bauen(pfad, mit_kalender=True):
    stops = [['stop_id', 'stop_name', 'stop_lat', 'stop_lon']]
    for i, s in enumerate(['A', 'B', 'C', 'D', 'X', 'Y', 'P', 'Q', 'R', 'S']):
        stops.append([s, f'Halt {s}', f'{52.5 + i / 100:.3f}', f'{13.4 + i / 100:.3f}'])

    trips = [['route_id', 'service_id', 'trip_id']]
    stop_times = [['trip_id', 'stop_id', 'stop_sequence', 'departure_time']]

    def fahrt(trip, route, service, halte, stunde=None):
        trips.append([route, service, trip])
        for seq, s in enumerate(halte, 1):
            # nur die erste Haltestelle mit Zeit: die übrigen übernehmen sie (wie bei Feeds ohne Zwischenzeiten)
            zeit = f'{stunde:02d}:00:00' if stunde is not None and seq == 1 else ''
            stop_times.append([trip, s, seq, zeit])

    for n in range(10):
        fahrt(f'u8_{n}', 'u8', 'taeglich', ['A', 'B', 'C', 'D'], stunde=5 + n)
    fahrt('u8_kurz', 'u8_b', 'taeglich', ['A', 'B', 'C'])          # zweite GTFS-Route derselben Linie
    fahrt('u8_umleitung', 'u8', 'bau', ['A', 'X', 'D'])             # nur an drei Bautagen
    fahrt('u8_depot', 'u8', 'taeglich', ['D', 'Y'])                 # täglich, aber nur eine Fahrt
    fahrt('sev', 'u8_bus', 'taeglich', ['A', 'D'])                  # Ersatzbus mit derselben Nummer
    fahrt('s1_nord', 's1_nord', 'taeglich', ['P', 'Q'])             # zwei S1 ohne gemeinsame Haltestelle
    fahrt('s1_sued', 's1_sued', 'taeglich', ['R', 'S'])

    dateien = {
        'agency.txt': tabelle([['agency_id', 'agency_name'], ['bvg', 'BVG'], ['db', 'DB Regio']]),
        'routes.txt': tabelle([
            ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type'],
            ['u8', 'bvg', 'U8', '', '1'],
            ['u8_b', 'bvg', 'U8', '', '400'],
            ['u8_bus', 'bvg', 'U8', '', '3'],
            ['s1_nord', 'db', 'S1', '', '109'],
            ['s1_sued', 'db', 'S1', '', '109'],
        ]),
        'stops.txt': tabelle(stops),
        'trips.txt': tabelle(trips),
        'stop_times.txt': tabelle(stop_times),
    }
    if mit_kalender:
        dateien['calendar.txt'] = tabelle([
            ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
             'start_date', 'end_date'],
            ['taeglich', '1', '1', '1', '1', '1', '1', '1', '20260101', '20260130'],
        ])
        dateien['calendar_dates.txt'] = tabelle([
            ['service_id', 'date', 'exception_type'],
            ['bau', '20260110', '1'], ['bau', '20260111', '1'], ['bau', '20260112', '1'],
        ])
    with zipfile.ZipFile(pfad, 'w') as zf:
        for name, inhalt in dateien.items():
            zf.writestr(name, inhalt)


def lesen(pfad):
    with open(pfad, encoding='utf-8', newline='') as f:
        return list(csv.DictReader(f))


class GtfsExport(unittest.TestCase):
    def ausfuehren(self, mit_kalender=True):
        ordner = Path(tempfile.mkdtemp())
        feed_bauen(ordner / 'feed.zip', mit_kalender)
        export.main(ordner / 'feed.zip', ordner / 'csv')
        linien = lesen(ordner / 'csv' / 'linien.csv')
        zuordnung = lesen(ordner / 'csv' / 'linie_haltestelle.csv')
        halte = {}
        for z in zuordnung:
            halte.setdefault(z['linie_id'], set()).add(z['stop_id'])
        self.fahrten = {(z['linie_id'], z['stop_id']): int(z['fahrten']) for z in zuordnung}
        return linien, halte, lesen(ordner / 'csv' / 'haltestellen.csv')

    def linie(self, linien, nummer, typ):
        treffer = [l for l in linien if l['nummer'] == nummer and l['typ'] == typ]
        self.assertTrue(treffer, f'{nummer} ({typ}) fehlt')
        return treffer

    def test_nur_regelmaessig_bediente_haltestellen(self):
        linien, halte, _ = self.ausfuehren()
        (u8,) = self.linie(linien, 'U8', 'ubahn')
        self.assertEqual(halte[u8['linie_id']], {'A', 'B', 'C', 'D'})

    def test_routen_derselben_linie_werden_zusammengefasst(self):
        linien, _, _ = self.ausfuehren()
        self.assertEqual(len(self.linie(linien, 'U8', 'ubahn')), 1)

    def test_ersatzbus_bekommt_eigenen_typ(self):
        linien, _, _ = self.ausfuehren()
        self.linie(linien, 'U8', 'ersatzverkehr')
        self.assertFalse([l for l in linien if l['nummer'] == 'U8' and l['typ'] == 'bus'])

    def test_gleiche_nummer_ohne_gemeinsame_haltestelle_bleibt_getrennt(self):
        linien, halte, _ = self.ausfuehren()
        s1 = self.linie(linien, 'S1', 'sbahn')
        self.assertEqual(sorted(sorted(halte[l['linie_id']]) for l in s1), [['P', 'Q'], ['R', 'S']])

    def test_selten_bediente_haltestellen_fehlen_ganz(self):
        _, _, haltestellen = self.ausfuehren()
        ids = {h['stop_id'] for h in haltestellen}
        self.assertNotIn('X', ids)
        self.assertNotIn('Y', ids)

    def test_ohne_kalender_zaehlt_nur_der_anteil_der_fahrten(self):
        linien, halte, _ = self.ausfuehren(mit_kalender=False)
        (u8,) = self.linie(linien, 'U8', 'ubahn')
        # X und Y haben je eine von zwölf Fahrten, also unter einem Zehntel
        self.assertEqual(halte[u8['linie_id']], {'A', 'B', 'C', 'D'})

    def test_endpunkte(self):
        linien, _, _ = self.ausfuehren()
        (u8,) = self.linie(linien, 'U8', 'ubahn')
        self.assertEqual(u8['endpunkte'], 'Halt A – Halt D')


    def test_fahrten_fuer_den_takt(self):
        linien, _, _ = self.ausfuehren()
        (u8,) = self.linie(linien, 'U8', 'ubahn')
        f = {s: self.fahrten[(u8['linie_id'], s)] for s in 'ABCD'}
        # A, B: neun Fahrten im Zeitfenster plus die kurze Fahrt ohne Zeitangabe; C: Endpunkt der kurzen Fahrt;
        # D: Endpunkt, nur die Depotfahrt fährt dort weiter
        self.assertEqual(f, {'A': 10, 'B': 10, 'C': 9, 'D': 1})

    def test_referenztag_ist_werktag_mit_den_meisten_fahrten(self):
        import datetime
        start = datetime.date(2026, 1, 1)                       # Donnerstag
        trips = {'a': 0b1111111, 'b': 1 << 6}                   # b fährt nur am 7.1. (Mittwoch)
        self.assertEqual(export.referenztag(start, trips, heute=datetime.date(2026, 1, 1)), 6)
        self.assertIsNone(export.referenztag(None, trips))


class Linientyp(unittest.TestCase):
    def test_typen(self):
        faelle = [('109', 'S41', 'sbahn'), ('2', 'S 3', 'sbahn'), ('2', 'RE1', 'regional'), ('1', 'U2', 'ubahn'),
                  ('900', 'M10', 'tram'), ('3', '100', 'bus'), ('101', 'ICE 123', 'fern'), ('2', 'IC 2', 'fern'),
                  ('4', 'F10', 'faehre'), ('x', '', 'sonstige')]
        for route_type, nummer, erwartet in faelle:
            with self.subTest(route_type=route_type, nummer=nummer):
                self.assertEqual(export.linientyp(route_type, nummer), erwartet)


if __name__ == '__main__':
    unittest.main()
