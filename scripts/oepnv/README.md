# ÖPNV-Linienfilter: Daten-Import

Lädt alle Linien und Haltestellen Deutschlands aus dem DELFI-GTFS-Feed nach Supabase,
damit man Anzeigen nach „höchstens X Meter von einer Haltestelle der Linie Y“ filtern kann.

## Einmalig: Datenbank vorbereiten

Ist in `supabase/migrations/0001_ausgangsstand.sql` enthalten (siehe `supabase/README.md`): PostGIS,
die Tabellen `oepnv_*`, die berechnete Spalte `anzeigen.geom` und die Filterfunktionen.
Wie das ursprünglich eingerichtet wurde, steht in `supabase/verlauf/oepnv_linienfilter.sql`.

## Wöchentlich: Daten aktualisieren

Läuft automatisch dienstags früh über den GitHub-Workflow `.github/workflows/oepnv.yml`
(auch von Hand startbar unter Actions > ÖPNV-Daten aktualisieren). Er braucht das Secret
`SUPABASE_DB_URL`: Supabase > Connect > Session pooler (IPv4, Port 5432), mit eingesetztem
Datenbank-Passwort. Ohne Secret läuft nur ein Probelauf ohne Änderung an der Datenbank.

Von Hand geht es so:

1. Feed herunterladen: DELFI direkt (`https://mobi.nrw/gtfs-deutschland-gesamt.zip`) oder
   [gtfs.de](https://download.gtfs.de/germany/free/latest.zip).
2. CSV-Dateien erzeugen (nur Python-Standardbibliothek nötig):
   ```bash
   python3 scripts/oepnv/gtfs_linien_export.py feed.zip oepnv_csv/
   ```
3. In die Datenbank laden (ersetzt die alten ÖPNV-Daten in einer Transaktion, die Website
   sieht bis zum Ende die alten Daten):
   ```bash
   cd oepnv_csv
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ../supabase/oepnv_laden.sql
   ```

Die Linien-IDs werden bei jedem Import neu vergeben. Wer später Linien dauerhaft speichert
(z. B. gespeicherte Suchen), muss das berücksichtigen.

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
