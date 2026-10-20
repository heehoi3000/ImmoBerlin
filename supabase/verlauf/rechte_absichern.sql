-- Schreibrechte absichern (19.10.2026).
-- Supabase gibt anon und authenticated standardmäßig alle Rechte; bisher bremsten nur die Zeilenrechte (RLS).
-- Beschreibbare Ansichten mit Admin-Rechten (bezirk_grenzen_view) und spatial_ref_sys (ohne RLS) waren dadurch offen.

-- 1) Besucher ohne Login: nirgends schreiben, außer Melden und Nachrichten senden
revoke insert, update, delete, truncate on all tables in schema public from anon;
grant insert on public.meldungen, public.nachrichten to anon;

-- 2) Angemeldete: nur eigene Inserate, Melden und Nachrichten (Rechte im Detail regeln die Policies)
revoke insert, update, delete, truncate on all tables in schema public from authenticated;
grant insert, update, delete on public.anzeigen to authenticated;
grant insert on public.meldungen to authenticated;
grant insert, delete on public.nachrichten to authenticated;
grant update (gelesen) on public.nachrichten to authenticated;

-- 3) Neue Tabellen bekommen künftig keine Schreibrechte mehr automatisch
alter default privileges for role postgres in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- 4) Ungenutzte Ansicht mit Admin-Rechten auf Aufruferrechte umstellen
alter view public.bezirk_grenzen_view set (security_invoker = true);
alter view public.stops_mit_linien set (security_invoker = true);

-- 5) PostGIS-Tabellen gehören supabase_admin, ihre Rechte lassen sich nicht entziehen.
--    Deshalb blockiert eine Prüfung vor jeder API-Anfrage das Schreiben darauf (Leeroys Wahl, 19.10.2026).
--    Zurücknehmen: alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';
create schema if not exists privat;
grant usage on schema privat to anon, authenticated;
create or replace function privat.anfrage_pruefen() returns void language plpgsql stable set search_path = '' as $$
begin
  if current_setting('request.method', true) not in ('GET', 'HEAD', 'OPTIONS')
     and current_setting('request.path', true) ~ '/(spatial_ref_sys|geometry_columns|geography_columns)' then
    raise exception 'Schreiben nicht erlaubt' using errcode = '42501';
  end if;
end $$;
grant execute on function privat.anfrage_pruefen() to anon, authenticated;
alter role authenticator set pgrst.db_pre_request = 'privat.anfrage_pruefen';
notify pgrst, 'reload config';
