-- Lädt die CSV-Dateien aus gtfs_linien_export.py und ersetzt die alten ÖPNV-Daten.
-- Aufruf im Ordner mit den CSV-Dateien:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f oepnv_laden.sql
-- (Verbindungs-URL: Supabase > Project Settings > Database > Connection string)

begin;

create temp table t_haltestellen (stop_id text, name text, lat double precision, lon double precision);
create temp table t_linien (linie_id integer, typ text, nummer text, betreiber text, endpunkte text,
                            lat double precision, lon double precision);
create temp table t_linie_route (linie_id integer, route_id text);
create temp table t_linie_haltestelle (linie_id integer, stop_id text);

\copy t_haltestellen from 'haltestellen.csv' csv header
\copy t_linien from 'linien.csv' csv header
\copy t_linie_route from 'linie_route.csv' csv header
\copy t_linie_haltestelle from 'linie_haltestelle.csv' csv header

truncate oepnv_linie_haltestelle, oepnv_linie_route, oepnv_linien, oepnv_haltestellen;

insert into oepnv_haltestellen (stop_id, name, geom)
select stop_id, name, st_setsrid(st_makepoint(lon, lat), 4326)::geography from t_haltestellen;

insert into oepnv_linien (linie_id, typ, nummer, betreiber, endpunkte, mitte)
select linie_id, typ, nummer, betreiber, coalesce(endpunkte, ''),
       st_setsrid(st_makepoint(lon, lat), 4326)::geography
from t_linien;

insert into oepnv_linie_route select * from t_linie_route;
insert into oepnv_linie_haltestelle select * from t_linie_haltestelle;

commit;

analyze oepnv_haltestellen;
analyze oepnv_linien;
analyze oepnv_linie_haltestelle;
