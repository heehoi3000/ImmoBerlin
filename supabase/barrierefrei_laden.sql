-- Lädt barrierefrei.csv (scripts/oepnv/barrierefrei_osm.py) und ersetzt oepnv_barrierefrei.
-- Aufruf im Ordner mit der CSV-Datei: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f barrierefrei_laden.sql
begin;
create temp table t_barrierefrei (osm_id text, art text, wert text, lat double precision, lon double precision);
\copy t_barrierefrei from 'barrierefrei.csv' csv header
-- delete statt truncate, damit die Website bis zum commit die alten Daten lesen kann
delete from oepnv_barrierefrei;
insert into oepnv_barrierefrei (osm_id, art, wert, geom)
select distinct on (osm_id) osm_id, art, wert, st_setsrid(st_makepoint(lon, lat), 4326)::geography from t_barrierefrei;
commit;
vacuum analyze oepnv_barrierefrei;
reindex index concurrently oepnv_barrierefrei_geom_idx;
reindex index concurrently oepnv_barrierefrei_pkey;
