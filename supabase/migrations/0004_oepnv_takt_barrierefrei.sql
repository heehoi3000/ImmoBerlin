-- ÖPNV-Details an der Inseratsseite: Takt je Linie und Haltestelle, Barrierefreiheit aus OpenStreetMap
-- und die Haltestellen in der Nähe eines Inserats. Mehrfach ausführbar.

-- Abfahrten werktags 6 bis 20 Uhr in der meistbedienten Richtung (scripts/oepnv/gtfs_linien_export.py);
-- 0 = unbekannt. Die Website zeigt daraus den Takt (840 Minuten / fahrten).
alter table public.oepnv_linie_haltestelle add column if not exists fahrten smallint not null default 0;

-- Haltestellen, Bahnhöfe und Bahnsteige mit wheelchair-Angabe aus OpenStreetMap
-- (Workflow barrierefrei.yml, monatlich). Die Fahrplandaten (DELFI) haben dazu fast keine Angaben.
create table if not exists public.oepnv_barrierefrei (
    osm_id text primary key,
    art text not null check (art in ('bahnhof', 'bahnsteig', 'bushalt')),
    wert text not null check (wert in ('ja', 'eingeschraenkt', 'nein')),
    geom public.geography(Point, 4326) not null
);
create index if not exists oepnv_barrierefrei_geom_idx on public.oepnv_barrierefrei using gist (geom);
alter table public.oepnv_barrierefrei enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'oepnv_barrierefrei' and policyname = 'lesen') then
    create policy lesen on public.oepnv_barrierefrei for select using (true);
  end if;
end $$;
grant select on public.oepnv_barrierefrei to anon, authenticated;

-- Haltestellen (Bahnsteige und Haltepunkte) im Umkreis eines Punkts mit ihren Linien, dem Takt und der
-- Barrierefreiheit des nächsten OSM-Punkts im Umkreis von 40 m. Höchstens 60 Treffer, die nächsten zuerst.
create or replace function public.haltestellen_in_der_naehe(p_lat double precision, p_lon double precision, p_radius_m integer default 1000)
returns table(stop_id text, name text, lat double precision, lon double precision, entfernung_m integer, barrierefrei text, linien jsonb)
    language sql stable
    set search_path to ''
    as $$
  with punkt as (
    select public.st_setsrid(public.st_makepoint(p_lon, p_lat), 4326)::public.geography as g
  ), nah as (
    select h.stop_id, h.name, h.geom, public.st_distance(h.geom, punkt.g) as d
    from public.oepnv_haltestellen h, punkt
    where public.st_dwithin(h.geom, punkt.g, least(greatest(p_radius_m, 100), 2000))
    order by d
    limit 60
  )
  select nah.stop_id, nah.name, public.st_y(nah.geom::public.geometry), public.st_x(nah.geom::public.geometry),
         round(nah.d)::integer,
         (select b.wert from public.oepnv_barrierefrei b
           where public.st_dwithin(b.geom, nah.geom, 40)
           order by b.geom operator(public.<->) nah.geom limit 1),
         coalesce((select jsonb_agg(jsonb_build_object('linie_id', l.linie_id, 'typ', l.typ, 'nummer', l.nummer,
                                                       'endpunkte', l.endpunkte, 'fahrten', lh.fahrten)
                                    order by l.typ, l.nummer)
                   from public.oepnv_linie_haltestelle lh join public.oepnv_linien l on l.linie_id = lh.linie_id
                   where lh.stop_id = nah.stop_id), '[]'::jsonb)
  from nah
  order by nah.d;
$$;
revoke all on function public.haltestellen_in_der_naehe(double precision, double precision, integer) from public;
grant execute on function public.haltestellen_in_der_naehe(double precision, double precision, integer) to anon, authenticated, service_role;
