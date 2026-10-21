-- Lädt grundversorgung.csv (scripts/umgebung/grundversorgung_osm.py) und ersetzt die Tabelle grundversorgung.
-- Aufruf im Ordner mit der CSV-Datei: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f grundversorgung_laden.sql
begin;
create temp table t_grundversorgung (osm_id text, art text, name text, lat double precision, lon double precision);
\copy t_grundversorgung from 'grundversorgung.csv' csv header
-- delete statt truncate, damit die Website bis zum commit die alten Daten lesen kann
delete from grundversorgung;
insert into grundversorgung (osm_id, art, name, geom)
select distinct on (osm_id) osm_id, art, coalesce(name, ''), st_setsrid(st_makepoint(lon, lat), 4326)::geography from t_grundversorgung;
commit;
vacuum analyze grundversorgung;
reindex index concurrently grundversorgung_geom_idx;
reindex index concurrently grundversorgung_pkey;
