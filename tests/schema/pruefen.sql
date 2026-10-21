-- Prüft nach dem Einspielen von supabase/migrations, ob der Aufbau vollständig und abgesichert ist.
-- Bricht mit einer Meldung ab, wenn etwas fehlt (psql -v ON_ERROR_STOP=1).
do $$
declare
  fehlt text;
  zu_viel text;
begin
  select string_agg(t, ', ') into fehlt
    from unnest(array['public.anzeigen', 'public.meldungen', 'public.nachrichten', 'public.oepnv_haltestellen',
                      'public.oepnv_linien', 'public.oepnv_linie_haltestelle', 'privat.moderatoren', 'privat.drossel']) t
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
