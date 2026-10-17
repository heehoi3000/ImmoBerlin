#!/usr/bin/env python3
"""Lädt die CSV-Dateien aus gtfs_linien_export.py über die Supabase-REST-API.

Alternative zu supabase/oepnv_laden.sql, wenn der Postgres-Port nicht erreichbar ist.
Ersetzt die alten ÖPNV-Daten (vorher werden die Tabellen geleert, nicht in einer Transaktion).

    SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
        python3 scripts/oepnv/oepnv_rest_laden.py oepnv_csv/

Nur Python-Standardbibliothek nötig.
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request

BATCH = 5000


def schluessel():
    k = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    # Häufige Einfügefehler entfernen: Leerzeichen, Anführungszeichen, spitze Klammern
    k = "".join(k.split()).strip("<>\"'")
    if not k:
        sys.exit("SUPABASE_SERVICE_ROLE_KEY fehlt")
    return k


BASIS = os.environ.get("SUPABASE_URL", "https://jugqpccbynyzzxvyettv.supabase.co").rstrip("/") + "/rest/v1/"
KEY = schluessel()


def anfrage(methode, pfad, daten=None, extra=None):
    kopf = {"apikey": KEY, "Content-Type": "application/json"}
    if not KEY.startswith("sb_"):
        kopf["Authorization"] = "Bearer " + KEY
    kopf.update(extra or {})
    body = json.dumps(daten).encode() if daten is not None else None
    for versuch in range(5):
        req = urllib.request.Request(BASIS + pfad, data=body, method=methode, headers=kopf)
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or versuch == 4:
                sys.exit(f"{methode} {pfad.split('?')[0]}: HTTP {e.code} {e.read()[:500].decode(errors='replace')}")
        except (urllib.error.URLError, TimeoutError) as e:
            if versuch == 4:
                sys.exit(f"{methode} {pfad.split('?')[0]}: {e}")
        time.sleep(2 ** versuch)


def leeren(tabelle, spalte):
    anfrage("DELETE", f"{tabelle}?{spalte}=not.is.null", extra={"Prefer": "return=minimal"})


def laden(tabelle, datei, zeile_zu_dict):
    with open(datei, newline="", encoding="utf-8") as f:
        stapel, n = [], 0
        for zeile in csv.DictReader(f):
            stapel.append(zeile_zu_dict(zeile))
            if len(stapel) >= BATCH:
                anfrage("POST", tabelle, stapel, {"Prefer": "return=minimal"})
                n += len(stapel)
                stapel = []
                print(f"\r{tabelle}: {n}", end="", flush=True)
        if stapel:
            anfrage("POST", tabelle, stapel, {"Prefer": "return=minimal"})
            n += len(stapel)
    print(f"\r{tabelle}: {n} Zeilen geladen")


def punkt(z):
    return f"SRID=4326;POINT({z['lon']} {z['lat']})"


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    ordner = sys.argv[1]
    pfad = lambda name: os.path.join(ordner, name)

    # Abhängige Tabellen zuerst leeren
    leeren("oepnv_linie_haltestelle", "linie_id")
    leeren("oepnv_linie_route", "linie_id")
    leeren("oepnv_linien", "linie_id")
    leeren("oepnv_haltestellen", "stop_id")

    laden("oepnv_haltestellen", pfad("haltestellen.csv"),
          lambda z: {"stop_id": z["stop_id"], "name": z["name"], "geom": punkt(z)})
    laden("oepnv_linien", pfad("linien.csv"),
          lambda z: {"linie_id": int(z["linie_id"]), "typ": z["typ"], "nummer": z["nummer"],
                     "betreiber": z["betreiber"], "endpunkte": z["endpunkte"] or "", "mitte": punkt(z)})
    laden("oepnv_linie_route", pfad("linie_route.csv"),
          lambda z: {"linie_id": int(z["linie_id"]), "route_id": z["route_id"]})
    laden("oepnv_linie_haltestelle", pfad("linie_haltestelle.csv"),
          lambda z: {"linie_id": int(z["linie_id"]), "stop_id": z["stop_id"]})


if __name__ == "__main__":
    main()
