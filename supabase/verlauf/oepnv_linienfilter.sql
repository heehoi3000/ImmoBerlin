-- Linienfilter: Tabellen, Indizes und Funktionen.
-- Einmal im Supabase SQL-Editor ausführen. Danach die Daten mit oepnv_laden.sql laden.
-- Die bestehenden Prototyp-Tabellen (routes, route_stops, stops) bleiben unberührt.

create extension if not exists postgis;

create table if not exists oepnv_haltestellen (
  stop_id text primary key,
  name    text not null,
  geom    geography(Point, 4326) not null
);
create index if not exists oepnv_haltestellen_geom_idx on oepnv_haltestellen using gist (geom);

create table if not exists oepnv_linien (
  linie_id  integer primary key,
  typ       text not null,          -- sbahn, ubahn, tram, bus, regional, fern, faehre, ersatzverkehr, sonstige
  nummer    text not null,          -- z. B. U2, S1, 100
  betreiber text not null,
  endpunkte text not null default '',
  mitte     geography(Point, 4326) not null  -- Mittelpunkt aller Haltestellen, für die Auswahl nach Kartenausschnitt
);
create index if not exists oepnv_linien_mitte_idx on oepnv_linien using gist (mitte);

create table if not exists oepnv_linie_route (
  linie_id integer not null references oepnv_linien on delete cascade,
  route_id text not null,
  primary key (linie_id, route_id)
);

create table if not exists oepnv_linie_haltestelle (
  linie_id integer not null references oepnv_linien on delete cascade,
  stop_id  text not null references oepnv_haltestellen on delete cascade,
  primary key (linie_id, stop_id)
);
create index if not exists oepnv_linie_haltestelle_stop_idx on oepnv_linie_haltestelle (stop_id);

-- Koordinate der Anzeigen als Geometrie, automatisch aus koordinate_lat/lon berechnet.
alter table anzeigen add column if not exists geom geography(Point, 4326)
  generated always as (
    case when koordinate_lat is not null and koordinate_lon is not null
      then st_setsrid(st_makepoint(koordinate_lon, koordinate_lat), 4326)::geography
    end
  ) stored;
create index if not exists anzeigen_geom_idx on anzeigen using gist (geom);

-- Anzeigen, die höchstens radius_m Meter (Luftlinie) von einer Haltestelle
-- mindestens einer der gewählten Linien entfernt sind.
-- Die Suche geht von den Haltestellen aus, damit der Geo-Index auf anzeigen greift
-- (mit 500.000 Anzeigen: ca. 10-750 ms statt 30-130 s bei der Variante mit exists).
create or replace function anzeigen_nahe_linien(linien_ids integer[], radius_m integer)
returns setof anzeigen
language sql stable
as $$
  select a.*
  from anzeigen a
  where a.id in (
    select a2.id
    from oepnv_linie_haltestelle lh
    join oepnv_haltestellen h on h.stop_id = lh.stop_id
    join anzeigen a2 on st_dwithin(a2.geom, h.geom, radius_m)
    where lh.linie_id = any (linien_ids)
  );
$$;

-- Nächste Haltestelle der gewählten Linien je Anzeige, für "320 m zur U2, Eberswalder Straße".
create or replace function anzeigen_naechste_haltestelle(linien_ids integer[], radius_m integer)
returns table (anzeige_id uuid, distanz_m integer, haltestelle text, linie text)
language sql stable
as $$
  select distinct on (a.id)
    a.id, round(st_distance(a.geom, h.geom))::integer, h.name, l.nummer
  from anzeigen a
  join oepnv_haltestellen h on st_dwithin(a.geom, h.geom, radius_m)
  join oepnv_linie_haltestelle lh on lh.stop_id = h.stop_id and lh.linie_id = any (linien_ids)
  join oepnv_linien l on l.linie_id = lh.linie_id
  order by a.id, st_distance(a.geom, h.geom);
$$;

-- Linien, die im Kartenausschnitt halten, für die Linienauswahl.
create or replace function linien_im_ausschnitt(
  min_lon double precision, min_lat double precision,
  max_lon double precision, max_lat double precision)
returns setof oepnv_linien
language sql stable
as $$
  select l.*
  from oepnv_linien l
  where exists (
    select 1
    from oepnv_linie_haltestelle lh
    join oepnv_haltestellen h on h.stop_id = lh.stop_id
    where lh.linie_id = l.linie_id
      and h.geom && st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::geography
  )
  order by l.typ, l.nummer;
$$;

-- Haltestellen der gewählten Linien, um den Umkreis auf der Karte als Kreise zu zeigen.
create or replace function haltestellen_der_linien(linien_ids integer[])
returns table (stop_id text, name text, lat double precision, lon double precision)
language sql stable
as $$
  select distinct h.stop_id, h.name, st_y(h.geom::geometry), st_x(h.geom::geometry)
  from oepnv_linie_haltestelle lh
  join oepnv_haltestellen h on h.stop_id = lh.stop_id
  where lh.linie_id = any (linien_ids);
$$;

-- Lesezugriff für die Website (anon-Schlüssel).
alter table oepnv_haltestellen enable row level security;
alter table oepnv_linien enable row level security;
alter table oepnv_linie_route enable row level security;
alter table oepnv_linie_haltestelle enable row level security;
drop policy if exists "lesen" on oepnv_haltestellen;
drop policy if exists "lesen" on oepnv_linien;
drop policy if exists "lesen" on oepnv_linie_route;
drop policy if exists "lesen" on oepnv_linie_haltestelle;
create policy "lesen" on oepnv_haltestellen for select using (true);
create policy "lesen" on oepnv_linien for select using (true);
create policy "lesen" on oepnv_linie_route for select using (true);
create policy "lesen" on oepnv_linie_haltestelle for select using (true);
