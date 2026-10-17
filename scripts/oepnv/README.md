# ÖPNV-Linienfilter: Daten-Import

Lädt alle Linien und Haltestellen Deutschlands aus dem DELFI-GTFS-Feed nach Supabase,
damit man Anzeigen nach „höchstens X Meter von einer Haltestelle der Linie Y“ filtern kann.

## Einmalig: Datenbank vorbereiten

Inhalt von `supabase/oepnv_linienfilter.sql` im Supabase SQL-Editor ausführen.
Das schaltet PostGIS ein, legt die Tabellen `oepnv_*` an, ergänzt `anzeigen` um eine
berechnete Spalte `geom` und legt die Funktionen für den Filter an.
Die Prototyp-Tabellen `routes`, `route_stops` und `stops` bleiben unverändert.

## Wöchentlich: Daten aktualisieren

1. Feed herunterladen, z. B. von [gtfs.de](https://gtfs.de/de/feeds/de_nv/) oder
   den kompletten DELFI-Feed von [Mobilitätsdaten NRW](https://www.mobilitaetsdaten.nrw/api/ckan/en/dataset/deutschlandweite-sollfahrplandaten-gtfs).
2. CSV-Dateien erzeugen (nur Python-Standardbibliothek nötig):
   ```bash
   python3 scripts/oepnv/gtfs_linien_export.py feed.zip oepnv_csv/
   ```
3. In die Datenbank laden (ersetzt die alten ÖPNV-Daten in einer Transaktion):
   ```bash
   cd oepnv_csv
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ../supabase/oepnv_laden.sql
   ```

## Funktionen für die Website

| Funktion | Zweck |
| --- | --- |
| `anzeigen_nahe_linien(linien_ids, radius_m)` | Anzeigen im Umkreis der Haltestellen der gewählten Linien |
| `anzeigen_naechste_haltestelle(linien_ids, radius_m)` | Je Anzeige die nächste Haltestelle mit Entfernung in Metern |
| `linien_im_ausschnitt(min_lon, min_lat, max_lon, max_lat)` | Linien, die im Kartenausschnitt halten (für die Auswahl) |
| `haltestellen_der_linien(linien_ids)` | Haltestellen, um den Umkreis als Kreise zu zeichnen |

Aufruf aus Next.js, weitere Filter lassen sich anhängen:

```ts
const { data } = await supabase
  .rpc('anzeigen_nahe_linien', { linien_ids: [5], radius_m: 600 })
  .lte('preis', 1500);
```

Fahrplandaten: DELFI e.V., CC BY 4.0. Diese Namensnennung muss auf der Website stehen.
