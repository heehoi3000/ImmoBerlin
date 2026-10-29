-- Liniensuche innerhalb eines Orts: nur Linien mit mindestens einer Haltestelle im Gebiet (GeoJSON-Polygon,
-- z. B. die Ortsgrenze), auf Wunsch um p_umkreis_m erweitert. Suche wie im Browser: genau passende Nummern
-- vollständig, dazu Nummernanfang, Betreiber oder Endstation. Ohne Ort sucht die Seite weiter in oepnv_linien.
-- Mehrfach ausführbar.
create or replace function public.linien_im_gebiet(p_begriff text, p_gebiet jsonb, p_umkreis_m integer default 0)
returns table(linie_id integer, typ text, nummer text, betreiber text, endpunkte text, mitte public.geography)
    language plpgsql stable
    set search_path to ''
    as $$
declare
  flaeche public.geometry;
  -- % und _ im Suchbegriff wörtlich nehmen
  b text := replace(replace(replace(trim(coalesce(p_begriff, '')), '\', '\\'), '%', '\%'), '_', '\_');
begin
  if b = '' or length(b) > 60 then return; end if;
  flaeche := public.st_makevalid(public.st_setsrid(public.st_geomfromgeojson(p_gebiet::text), 4326));
  -- Grenzen kommen vereinfacht aus dem Browser; übergroße Polygone nicht annehmen
  if public.st_npoints(flaeche) > 20000 then raise exception 'Gebiet zu groß' using errcode = '22023'; end if;
  if coalesce(p_umkreis_m, 0) > 0 then
    flaeche := public.st_buffer(flaeche::public.geography, least(p_umkreis_m, 50000))::public.geometry;
  end if;

  return query
  with im_gebiet as (
    select distinct lh.linie_id
    from public.oepnv_haltestellen h
    join public.oepnv_linie_haltestelle lh on lh.stop_id = h.stop_id
    where h.geom operator(public.&&) flaeche::public.geography
      and public.st_intersects(h.geom::public.geometry, flaeche)
  ),
  treffer as (
    select l.*, (l.nummer ilike b) as genau
    from public.oepnv_linien l
    join im_gebiet g on g.linie_id = l.linie_id
    where l.nummer ilike b or l.nummer ilike b || '%' or l.betreiber ilike '%' || b || '%' or l.endpunkte ilike '%' || b || '%'
  )
  select t.linie_id, t.typ, t.nummer, t.betreiber, t.endpunkte, t.mitte
  from treffer t
  order by t.genau desc, t.linie_id
  limit 900;
end $$;

revoke all on function public.linien_im_gebiet(text, jsonb, integer) from public;
grant execute on function public.linien_im_gebiet(text, jsonb, integer) to anon, authenticated, service_role;
