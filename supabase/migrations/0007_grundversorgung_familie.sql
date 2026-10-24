-- Grundversorgung um Kita, Schule, Spielplatz und Park erweitern (Workflow grundversorgung.yml). Mehrfach ausführbar.
alter table public.grundversorgung drop constraint if exists grundversorgung_art_check;
alter table public.grundversorgung add constraint grundversorgung_art_check
  check (art in ('supermarkt', 'drogerie', 'baeckerei', 'apotheke', 'hausarzt', 'post', 'geldautomat',
                 'kita', 'schule', 'spielplatz', 'park'));

-- Je Art der nächste Ort im Umkreis (100 bis 3000 m, Luftlinie); Arten ohne Treffer fehlen in der Antwort.
create or replace function public.grundversorgung_in_der_naehe(p_lat double precision, p_lon double precision, p_radius_m integer default 1500)
returns table(art text, name text, lat double precision, lon double precision, entfernung_m integer)
    language sql stable
    set search_path to ''
    as $$
  with punkt as (
    select public.st_setsrid(public.st_makepoint(p_lon, p_lat), 4326)::public.geography as g
  )
  select a.art, o.name, public.st_y(o.geom::public.geometry), public.st_x(o.geom::public.geometry),
         round(public.st_distance(o.geom, punkt.g))::integer as entfernung_m
  from punkt
  cross join unnest(array['supermarkt', 'drogerie', 'baeckerei', 'apotheke', 'hausarzt', 'post', 'geldautomat',
                          'kita', 'schule', 'spielplatz', 'park']) as a(art)
  cross join lateral (
    select g.name, g.geom from public.grundversorgung g
    where g.art = a.art and public.st_dwithin(g.geom, punkt.g, least(greatest(p_radius_m, 100), 3000))
    order by g.geom operator(public.<->) punkt.g
    limit 1
  ) o
  order by entfernung_m;
$$;
