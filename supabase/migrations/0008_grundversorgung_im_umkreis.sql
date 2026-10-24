-- Alle Orte der Grundversorgung im Umkreis eines Punkts (für die Symbole auf der Karte der Inseratsseite).
-- Je Art höchstens 50, die nächsten zuerst; die Liste nimmt daraus den nächsten je Art. Mehrfach ausführbar.
create or replace function public.grundversorgung_im_umkreis(p_lat double precision, p_lon double precision, p_radius_m integer default 1500)
returns table(art text, name text, lat double precision, lon double precision, entfernung_m integer)
    language sql stable
    set search_path to ''
    as $$
  with punkt as (
    select public.st_setsrid(public.st_makepoint(p_lon, p_lat), 4326)::public.geography as g
  ),
  treffer as (
    select g.art, g.name, g.geom, public.st_distance(g.geom, punkt.g) as d,
           row_number() over (partition by g.art order by public.st_distance(g.geom, punkt.g), g.osm_id) as nr
    from public.grundversorgung g, punkt
    where public.st_dwithin(g.geom, punkt.g, least(greatest(p_radius_m, 100), 3000))
  )
  select t.art, t.name, public.st_y(t.geom::public.geometry), public.st_x(t.geom::public.geometry),
         round(t.d)::integer as entfernung_m
  from treffer t
  where t.nr <= 50
  order by t.d;
$$;

revoke all on function public.grundversorgung_im_umkreis(double precision, double precision, integer) from public;
grant execute on function public.grundversorgung_im_umkreis(double precision, double precision, integer) to anon, authenticated, service_role;
