-- Prüft nach dem Einspielen von supabase/migrations, ob der Aufbau vollständig und abgesichert ist.
-- Bricht mit einer Meldung ab, wenn etwas fehlt (psql -v ON_ERROR_STOP=1).
do $$
declare
  fehlt text;
  zu_viel text;
begin
  select string_agg(t, ', ') into fehlt
    from unnest(array['public.anzeigen', 'public.meldungen', 'public.nachrichten', 'public.oepnv_haltestellen',
                      'public.oepnv_linien', 'public.oepnv_linie_haltestelle', 'public.grundversorgung', 'public.tausch_wuensche', 'privat.moderatoren', 'privat.drossel']) t
   where to_regclass(t) is null;
  if fehlt is not null then raise exception 'Tabellen fehlen: %', fehlt; end if;

  select string_agg(format('%s.%s', n.nspname, c.relname), ', ') into fehlt
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
     and c.relname <> 'spatial_ref_sys';
  if fehlt is not null then raise exception 'Zeilenschutz (RLS) fehlt bei: %', fehlt; end if;

  -- Gäste dürfen nur Meldungen und Nachrichten anlegen, sonst nichts schreiben (supabase/verlauf/rechte_absichern.sql).
  -- Ausgenommen sind die Tabellen von PostGIS selbst: Sie gehören supabase_admin (wie in der Cloud), die Schnittstelle
  -- sperrt sie über privat.anfrage_pruefen.
  select string_agg(format('%s %s', table_name, privilege_type), ', ') into zu_viel
    from information_schema.role_table_grants
   where grantee = 'anon' and table_schema in ('public', 'privat')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
     and table_name not in ('spatial_ref_sys', 'geometry_columns', 'geography_columns')
     and not (privilege_type = 'INSERT' and table_name in ('meldungen', 'nachrichten'));
  if zu_viel is not null then raise exception 'anon darf zu viel: %', zu_viel; end if;

  -- Das Schema privat ist sichtbar (für privat.anfrage_pruefen vor jeder Anfrage), seine Tabellen aber nicht
  select string_agg(format('%s %s', table_name, privilege_type), ', ') into zu_viel
    from information_schema.role_table_grants
   where grantee in ('anon', 'authenticated') and table_schema = 'privat';
  if zu_viel is not null then raise exception 'Tabellen in privat sind offen: %', zu_viel; end if;

  if not exists (select 1 from storage.buckets where id = 'inserat-bilder') then raise exception 'Bucket inserat-bilder fehlt'; end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') < 3 then
    raise exception 'Regeln für die Fotos fehlen';
  end if;

  if not exists (select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
                  where r.rolname = 'authenticator' and 'pgrst.db_pre_request=privat.anfrage_pruefen' = any(s.setconfig)) then
    raise exception 'pgrst.db_pre_request fehlt';
  end if;
  raise notice 'Datenbank-Aufbau vollständig und abgesichert';
end $$;

-- Erledigte Meldungen bekommen ihren Zeitpunkt, damit aufraeumen.yml sie nach einem Jahr löschen kann
-- (supabase/migrations/0003_meldungen_erledigt_am.sql). Läuft in einer Transaktion und hinterlässt nichts.
begin;
do $$
declare
  m uuid;
  zeit timestamptz;
begin
  insert into public.meldungen (art, nachricht) values ('fehler', 'Prüfung erledigt_am') returning id into m;
  update public.meldungen set erledigt = true where id = m;
  select erledigt_am into zeit from public.meldungen where id = m;
  if zeit is null then raise exception 'erledigt_am wird beim Erledigen nicht gesetzt'; end if;
  update public.meldungen set erledigt = false where id = m;
  select erledigt_am into zeit from public.meldungen where id = m;
  if zeit is not null then raise exception 'erledigt_am bleibt nach dem Wiederöffnen stehen'; end if;
  raise notice 'Erledigungszeitpunkt der Meldungen funktioniert';
end $$;
rollback;

-- Grundversorgung im Umkreis (supabase/migrations/0005_grundversorgung.sql, 0008)
begin;
do $$
declare
  n integer;
  naechster text;
begin
  insert into public.grundversorgung (osm_id, art, name, geom) values
    ('n1', 'supermarkt', 'Nah', 'SRID=4326;POINT(13.401 52.53)'),
    ('n2', 'supermarkt', 'Fern', 'SRID=4326;POINT(13.41 52.53)'),
    ('n3', 'apotheke', 'Zu weit', 'SRID=4326;POINT(13.5 52.53)'),
    ('n4', 'kita', 'Kita Sonnenschein', 'SRID=4326;POINT(13.402 52.53)');
  -- alle Orte im Umkreis (0008), nächste zuerst
  select count(*), string_agg(name, ',') into n, naechster from public.grundversorgung_im_umkreis(52.53, 13.40, 1500);
  if n <> 3 or naechster <> 'Nah,Kita Sonnenschein,Fern' then raise exception 'grundversorgung_im_umkreis liefert % Orte: %', n, naechster; end if;
  raise notice 'Grundversorgung im Umkreis funktioniert';
end $$;
rollback;

-- Liniensuche im Ort (supabase/migrations/0015_linien_im_gebiet.sql): zwei Linien "U8", eine mit Haltestelle im
-- Gebiet, eine 100 km entfernt; die ferne erscheint erst gar nicht, mit Umkreis auch nicht (nur 5 km).
begin;
do $$
declare
  gebiet jsonb := '{"type":"Polygon","coordinates":[[[13.3,52.4],[13.5,52.4],[13.5,52.6],[13.3,52.6],[13.3,52.4]]]}';
  ergebnis text;
begin
  insert into public.oepnv_linien (linie_id, typ, nummer, betreiber, endpunkte, mitte) values
    (999801, 'ubahn', 'U8', 'Hier', 'A – B', 'SRID=4326;POINT(13.40 52.50)'),
    (999802, 'ubahn', 'U8', 'Dort', 'C – D', 'SRID=4326;POINT(14.90 52.50)'),
    (999803, 'bus', 'U80', 'Hier', 'E – F', 'SRID=4326;POINT(13.40 52.50)'),
    (999804, 'bus', '100', 'Hier', 'G – H', 'SRID=4326;POINT(13.51 52.50)'),
    (999805, 'sbahn', 'S1', 'Hier', 'S+U Testplatz – Ende', 'SRID=4326;POINT(13.40 52.50)');
  insert into public.oepnv_haltestellen (stop_id, name, geom) values
    ('u8-hier', 'Hier', 'SRID=4326;POINT(13.40 52.50)'), ('u8-dort', 'Dort', 'SRID=4326;POINT(14.90 52.50)'),
    ('bus-rand', 'Rand', 'SRID=4326;POINT(13.52 52.50)');
  insert into public.oepnv_linie_haltestelle (linie_id, stop_id) values
    (999801, 'u8-hier'), (999802, 'u8-dort'), (999803, 'u8-hier'), (999804, 'bus-rand'), (999805, 'u8-hier');
  select string_agg(linie_id::text, ',' order by linie_id) into ergebnis from public.linien_im_gebiet('U8', gebiet);
  if ergebnis is distinct from '999801,999803' then raise exception 'linien_im_gebiet(U8) liefert %', ergebnis; end if;
  select string_agg(linie_id::text, ',') into ergebnis from public.linien_im_gebiet('100', gebiet);
  if ergebnis is not null then raise exception 'Linie 100 außerhalb des Gebiets gefunden'; end if;
  select string_agg(linie_id::text, ',') into ergebnis from public.linien_im_gebiet('100', gebiet, 5000);
  if ergebnis is distinct from '999804' then raise exception 'Linie 100 im Umkreis fehlt: %', ergebnis; end if;
  -- "U" sucht nur in der Nummer (0016), nicht in der Endstation "S+U Testplatz"
  select string_agg(linie_id::text, ',' order by linie_id) into ergebnis from public.linien_im_gebiet('U', gebiet);
  if ergebnis is distinct from '999801,999803' then raise exception 'linien_im_gebiet(U) liefert %', ergebnis; end if;
  select string_agg(linie_id::text, ',') into ergebnis from public.linien_im_gebiet('Testplatz', gebiet);
  if ergebnis is distinct from '999805' then raise exception 'Suche nach Endstation liefert %', ergebnis; end if;
  select string_agg(linie_id::text, ',') into ergebnis from public.linien_im_gebiet('U_', gebiet);
  if ergebnis is not null then raise exception 'Unterstrich wirkt als Platzhalter: %', ergebnis; end if;
  raise notice 'Liniensuche im Ort funktioniert';
end $$;
rollback;

-- Tauschpartner (supabase/migrations/0006_tausch.sql): A sucht an Linie T9 höchstens 500 m entfernt; B liegt
-- 200 m von deren Haltestelle, C 3 km. B sucht mindestens 3 Zimmer, A hat 3 → gegenseitig.
begin;
do $$
declare
  a uuid := '00000000-0000-4000-8000-00000000000a';
  b uuid := '00000000-0000-4000-8000-00000000000b';
  ergebnis text;
begin
  insert into auth.users (id, email) values (a, 'a@example.org'), (b, 'b@example.org');
  insert into public.oepnv_linien (linie_id, typ, nummer, betreiber, endpunkte, mitte)
    values (999999, 'ubahn', 'T9', 'Testbetrieb', 'A – B', 'SRID=4326;POINT(13.40 52.50)');
  insert into public.oepnv_haltestellen (stop_id, name, geom) values ('t9-halt', 'Testplatz', 'SRID=4326;POINT(13.40 52.50)');
  insert into public.oepnv_linie_haltestelle (linie_id, stop_id) values (999999, 't9-halt');
  insert into public.anzeigen (id, titel, transaktions_typ, preis, warmmiete, zimmer, quadratmeter, koordinate_lat, koordinate_lon, inserent_id, ort) values
    ('00000000-0000-4000-8000-0000000000a1', 'A', 'tauschen', 700, 900, 3, 80, 52.60, 13.40, a, 'Berlin'),
    ('00000000-0000-4000-8000-0000000000b1', 'B', 'tauschen', 500, 650, 2, 55, 52.5018, 13.40, b, 'Berlin'),
    ('00000000-0000-4000-8000-0000000000c1', 'C', 'tauschen', 500, 650, 2, 55, 52.527, 13.40, b, 'Berlin'),
    ('00000000-0000-4000-8000-0000000000d1', 'D', 'mieten', 500, 650, 2, 55, 52.5018, 13.40, b, 'Berlin');
  insert into public.tausch_wuensche (anzeige_id, linien, umkreis_m, max_warmmiete) values
    ('00000000-0000-4000-8000-0000000000a1', '[{"typ":"ubahn","nummer":"T9","betreiber":"Testbetrieb"}]', 500, 800);
  insert into public.tausch_wuensche (anzeige_id, min_zimmer) values ('00000000-0000-4000-8000-0000000000b1', 3);
  perform set_config('request.jwt.claim.sub', a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a)::text, true);
  select string_agg(an.titel || ':' || t.gegenseitig, ',') into ergebnis
    from public.tausch_partner('00000000-0000-4000-8000-0000000000a1') t join public.anzeigen an on an.id = t.id;
  if ergebnis is distinct from 'B:true' then raise exception 'tausch_partner liefert %', ergebnis; end if;
  -- Fremde Inserate: kein Ergebnis
  select count(*)::text into ergebnis from public.tausch_partner('00000000-0000-4000-8000-0000000000b1');
  if ergebnis <> '0' then raise exception 'tausch_partner zeigt Partner fremder Inserate'; end if;
  -- Fremden Tauschwunsch ändern darf niemand
  perform set_config('request.jwt.claim.sub', b::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.tausch_wuensche set umkreis_m = 2000 where anzeige_id = '00000000-0000-4000-8000-0000000000a1';
  reset role;
  if (select umkreis_m from public.tausch_wuensche where anzeige_id = '00000000-0000-4000-8000-0000000000a1') <> 500 then
    raise exception 'Fremder Tauschwunsch ließ sich ändern';
  end if;
  raise notice 'Tauschpartner werden richtig gefunden';
end $$;
rollback;

-- Links und Dokumente: nur PDFs im eigenen Ordner, nur https-Links (Migration 0011)
begin;
do $$
declare ok boolean;
begin
  if not exists (select 1 from storage.buckets where id = 'inserat-bilder' and 'application/pdf' = any(allowed_mime_types)) then
    raise exception 'Bucket inserat-bilder nimmt keine PDFs an';
  end if;
  insert into public.anzeigen (titel, dokumente, links) values ('L',
    '[{"art":"grundriss","titel":"Grundriss","pfad":"11111111-2222-3333-4444-555555555555/1729-ab12.pdf"}]',
    '[{"titel":"Rundgang","url":"https://example.org/tour"}]');
  begin
    insert into public.anzeigen (titel, links) values ('L2', '[{"titel":"x","url":"javascript:alert(1)"}]');
    ok := false;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'Link ohne https wurde angenommen'; end if;
  begin
    insert into public.anzeigen (titel, dokumente) values ('L3', '[{"art":"grundriss","titel":"x","pfad":"../fremd.exe"}]');
    ok := false;
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'Dokument mit fremdem Pfad wurde angenommen'; end if;
  raise notice 'Links und Dokumente werden geprüft';
end $$;
rollback;

-- anzeigen.geom kommt aus der berechneten Spalte, ohne Trigger (Migration 0012)
begin;
do $$
declare g text;
begin
  insert into public.anzeigen (titel, koordinate_lat, koordinate_lon) values ('G', 52.5, 13.4) returning st_astext(geom) into g;
  if g is distinct from 'POINT(13.4 52.5)' then raise exception 'anzeigen.geom ist %', g; end if;
  raise notice 'Lage der Inserate wird berechnet';
end $$;
rollback;

-- Tauschwunsch-Ort passt zu Ort, Bezirk oder PLZ des Inserats (Migration 0013)
begin;
do $$
declare ergebnis text;
begin
  insert into public.anzeigen (id, titel, transaktions_typ, ort, bezirk, plz) values
    ('00000000-0000-4000-8000-0000000000e1', 'E', 'tauschen', 'Berlin', 'Kreuzberg', '10997'),
    ('00000000-0000-4000-8000-0000000000f1', 'F', 'tauschen', 'Berlin', null, null);
  insert into public.tausch_wuensche (anzeige_id, ort) values
    ('00000000-0000-4000-8000-0000000000e1', 'berlin'),
    ('00000000-0000-4000-8000-0000000000f1', 'Kreuzberg');
  select string_agg(w.ort || '>' || an.titel || ':' || privat.tausch_passt(w, an), ',' order by lower(w.ort), an.titel) into ergebnis
    from public.tausch_wuensche w cross join public.anzeigen an
    where an.titel in ('E', 'F') and w.anzeige_id in ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000f1');
  if ergebnis is distinct from 'berlin>E:true,berlin>F:true,Kreuzberg>E:true,Kreuzberg>F:false' then
    raise exception 'tausch_passt mit Ort liefert %', ergebnis;
  end if;
  raise notice 'Tauschwunsch-Ort passt zu Ort, Bezirk und PLZ';
end $$;
rollback;
