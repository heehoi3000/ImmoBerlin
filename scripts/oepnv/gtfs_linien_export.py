#!/usr/bin/env python3
"""Bereitet einen GTFS-Feed (z. B. DELFI Deutschland) für den Linienfilter auf.

Liest das GTFS-ZIP direkt (ohne Entpacken) und schreibt vier CSV-Dateien,
die mit supabase/oepnv_laden.sql in die Datenbank geladen werden:

  haltestellen.csv        stop_id, name, lat, lon        (nur bediente Haltestellen)
  linien.csv              linie_id, typ, nummer, betreiber, endpunkte, lat, lon
  linie_route.csv         linie_id, route_id
  linie_haltestelle.csv   linie_id, stop_id

Eine "Linie" fasst alle GTFS-Routen zusammen, die denselben Betreiber, dieselbe
Nummer und denselben Typ haben UND sich mindestens eine Haltestelle teilen.
So werden doppelte Routen aus DELFI zu einer Linie, aber die S1 in Dresden und
die S1 im Ruhrgebiet (beide DB Regio) bleiben getrennt.

Nur Python-Standardbibliothek. Aufruf:
  python3 gtfs_linien_export.py feed.zip ausgabe_ordner/
"""

import csv
import io
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

csv.field_size_limit(10_000_000)


def gtfs_rows(zf, name):
    """Liefert die Zeilen einer GTFS-Datei als dicts, gestreamt."""
    with zf.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        yield from csv.DictReader(text)


def linientyp(route_type, nummer):
    """Bildet GTFS route_type (Basis- und erweiterte Typen) auf unsere Typen ab."""
    try:
        t = int(route_type)
    except (TypeError, ValueError):
        return "sonstige"
    nummer = (nummer or "").strip().upper()
    ist_sbahn_nummer = re.match(r"^S\s?\d", nummer) is not None
    if t == 109 or (t in (2, 100, 106, 116, 117) and ist_sbahn_nummer):
        return "sbahn"
    if t == 1 or 400 <= t <= 405:
        return "ubahn"
    if t == 0 or 900 <= t <= 906:
        return "tram"
    if t in (3, 11) or 200 <= t <= 299 or 700 <= t <= 716 or t == 800:
        return "bus"
    if t in (101, 102, 105) or re.match(r"^(ICE|IC|EC|ECE|NJ|EN|FLX|RJ|RJX|TGV)\b", nummer):
        return "fern"
    if t == 2 or 100 <= t <= 117:
        return "regional"
    if t == 4 or 1000 <= t <= 1200:
        return "faehre"
    return "sonstige"


class UnionFind:
    def __init__(self):
        self.parent = {}

    def find(self, x):
        self.parent.setdefault(x, x)
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def main(feed_pfad, ziel_pfad):
    ziel = Path(ziel_pfad)
    ziel.mkdir(parents=True, exist_ok=True)
    zf = zipfile.ZipFile(feed_pfad)

    betreiber = {r["agency_id"]: r["agency_name"] for r in gtfs_rows(zf, "agency.txt")}
    einziger_betreiber = next(iter(betreiber.values())) if len(betreiber) == 1 else ""

    routen = {}
    for r in gtfs_rows(zf, "routes.txt"):
        nummer = (r.get("route_short_name") or "").strip() or (r.get("route_long_name") or "").strip()
        routen[r["route_id"]] = {
            "nummer": nummer,
            "betreiber": betreiber.get(r.get("agency_id", ""), einziger_betreiber),
            "typ": linientyp(r.get("route_type"), nummer),
        }

    # Schienenersatzverkehr: Busse mit Nummer und Betreiber einer Bahnlinie (z. B. Bus "U2"
    # der BVG) bekommen einen eigenen Typ, damit sie in der Auswahl nicht als zweite U2 erscheinen.
    schiene = {(i["betreiber"], i["nummer"].upper()) for i in routen.values()
               if i["typ"] in ("sbahn", "ubahn", "tram", "regional", "fern")}
    for i in routen.values():
        if i["typ"] == "bus" and (i["betreiber"], i["nummer"].upper()) in schiene:
            i["typ"] = "ersatzverkehr"

    trip_route = {r["trip_id"]: r["route_id"] for r in gtfs_rows(zf, "trips.txt")}
    print(f"{len(routen)} Routen, {len(trip_route)} Fahrten", file=sys.stderr)

    # stop_times ist die mit Abstand größte Datei: einmal streamen und dabei
    # (route, stop)-Paare sowie Start- und Endhaltestelle jeder Fahrt merken.
    route_stops = defaultdict(set)
    trip_enden = {}  # trip_id -> [min_seq, start_stop, max_seq, end_stop]
    for n, r in enumerate(gtfs_rows(zf, "stop_times.txt"), 1):
        route_id = trip_route.get(r["trip_id"])
        if route_id is None:
            continue
        stop_id = r["stop_id"]
        route_stops[route_id].add(stop_id)
        seq = int(r["stop_sequence"])
        e = trip_enden.get(r["trip_id"])
        if e is None:
            trip_enden[r["trip_id"]] = [seq, stop_id, seq, stop_id]
        else:
            if seq < e[0]:
                e[0], e[1] = seq, stop_id
            if seq > e[2]:
                e[2], e[3] = seq, stop_id
        if n % 10_000_000 == 0:
            print(f"  {n:,} stop_times gelesen", file=sys.stderr)

    haltestellen = {}
    for r in gtfs_rows(zf, "stops.txt"):
        try:
            lat, lon = float(r["stop_lat"]), float(r["stop_lon"])
        except (KeyError, ValueError):
            continue
        if lat == 0 and lon == 0:
            continue
        haltestellen[r["stop_id"]] = (r.get("stop_name", "").strip(), lat, lon)

    # Routen gruppieren: gleicher Schlüssel + gemeinsame Haltestelle = eine Linie.
    uf = UnionFind()
    erster_route_je_stop = {}
    for route_id, stops in route_stops.items():
        info = routen.get(route_id)
        if info is None:
            continue
        schluessel = (info["betreiber"], info["nummer"].upper(), info["typ"])
        uf.find(route_id)
        for stop_id in stops:
            andere = erster_route_je_stop.setdefault((schluessel, stop_id), route_id)
            uf.union(andere, route_id)

    gruppen = defaultdict(list)
    for route_id in route_stops:
        if route_id in routen:
            gruppen[uf.find(route_id)].append(route_id)

    route_endpunkte = defaultdict(Counter)
    for trip_id, (_, start, _, ende) in trip_enden.items():
        route_endpunkte[trip_route[trip_id]][tuple(sorted((start, ende)))] += 1

    bediente = set()
    with open(ziel / "linien.csv", "w", newline="", encoding="utf-8") as f_l, \
         open(ziel / "linie_route.csv", "w", newline="", encoding="utf-8") as f_lr, \
         open(ziel / "linie_haltestelle.csv", "w", newline="", encoding="utf-8") as f_lh:
        w_l, w_lr, w_lh = csv.writer(f_l), csv.writer(f_lr), csv.writer(f_lh)
        w_l.writerow(["linie_id", "typ", "nummer", "betreiber", "endpunkte", "lat", "lon"])
        w_lr.writerow(["linie_id", "route_id"])
        w_lh.writerow(["linie_id", "stop_id"])

        for linie_id, route_ids in enumerate(sorted(gruppen.values(), key=lambda g: sorted(g)), 1):
            info = routen[route_ids[0]]
            stops = set().union(*(route_stops[r] for r in route_ids)) & haltestellen.keys()
            if not stops:
                continue
            bediente |= stops

            endpunkte = Counter()
            for r in route_ids:
                endpunkte.update(route_endpunkte[r])
            endpunkt_text = ""
            if endpunkte:
                a, b = endpunkte.most_common(1)[0][0]
                namen = [haltestellen[s][0] for s in (a, b) if s in haltestellen]
                endpunkt_text = " – ".join(dict.fromkeys(namen))

            lat = sum(haltestellen[s][1] for s in stops) / len(stops)
            lon = sum(haltestellen[s][2] for s in stops) / len(stops)
            w_l.writerow([linie_id, info["typ"], info["nummer"], info["betreiber"],
                          endpunkt_text, f"{lat:.6f}", f"{lon:.6f}"])
            for r in sorted(route_ids):
                w_lr.writerow([linie_id, r])
            for s in sorted(stops):
                w_lh.writerow([linie_id, s])

    with open(ziel / "haltestellen.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["stop_id", "name", "lat", "lon"])
        for stop_id in sorted(bediente):
            name, lat, lon = haltestellen[stop_id]
            w.writerow([stop_id, name, f"{lat:.6f}", f"{lon:.6f}"])

    print(f"{len(gruppen)} Linien aus {len(route_stops)} Routen, "
          f"{len(bediente)} bediente Haltestellen -> {ziel}", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
