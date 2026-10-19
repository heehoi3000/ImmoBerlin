-- Aufräumen nach dem Supabase-Sicherheits- und Performance-Check (19.10.2026).

-- Teil A: bereits angewendet
-- Feste search_path für die ÖPNV-Funktionen
alter function public.anzeigen_naechste_haltestelle(integer[], integer) set search_path = public, extensions;
alter function public.anzeigen_nahe_linien(integer[], integer) set search_path = public, extensions;
alter function public.haltestellen_der_linien(integer[]) set search_path = public, extensions;
alter function public.linien_im_ausschnitt(double precision, double precision, double precision, double precision) set search_path = public, extensions;

-- PostGIS-Hilfsfunktionen gehören supabase_admin und lassen sich nicht entziehen,
-- deshalb sperrt die Anfrageprüfung ihre Aufrufe über die API.
create or replace function privat.anfrage_pruefen() returns void
language plpgsql stable set search_path to '' as $function$
begin
  if current_setting('request.method', true) not in ('GET', 'HEAD', 'OPTIONS')
     and current_setting('request.path', true) ~ '/(spatial_ref_sys|geometry_columns|geography_columns)' then
    raise exception 'Schreiben nicht erlaubt' using errcode = '42501';
  end if;
  -- PostGIS-Hilfsfunktionen (z. B. st_estimatedextent, security definer) nicht über die API aufrufbar
  if current_setting('request.path', true) ~* '/rpc/(_?st_|postgis|geometry|geography|box|addgeometry|dropgeometry|updategeometry|populate_geometry|find_srid|gettransactionid|lockrow|unlockrows|addauth|checkauth|disablelongtransactions|enablelongtransactions)' then
    raise exception 'Nicht erlaubt' using errcode = '42501';
  end if;
end $function$;

-- auth.uid() einmal pro Abfrage statt pro Zeile auswerten
alter policy "Aktive Inserate lesen" on public.anzeigen using (status = 'aktiv' or inserent_id = (select auth.uid()));
alter policy "Lesen für alle" on public.anzeigen using (status = 'aktiv' or inserent_id = (select auth.uid()));
alter policy "Enable read access for all users" on public.anzeigen using (status = 'aktiv' or inserent_id = (select auth.uid()));
alter policy "Eigene Inserate anlegen" on public.anzeigen with check (inserent_id = (select auth.uid()) and status in ('aktiv', 'pausiert'));
alter policy "Eigene Inserate ändern" on public.anzeigen using (inserent_id = (select auth.uid()) and status <> 'gesperrt') with check (inserent_id = (select auth.uid()) and status in ('aktiv', 'pausiert'));
alter policy "Eigene Inserate löschen" on public.anzeigen using (inserent_id = (select auth.uid()));
alter policy "Jeder darf melden" on public.meldungen with check (erledigt = false and (nutzer_id is null or nutzer_id = (select auth.uid())));
alter policy "Eigene Nachrichten lesen" on public.nachrichten using (empfaenger_id = (select auth.uid()) or absender_id = (select auth.uid()));
alter policy "Empfänger markiert gelesen" on public.nachrichten using (empfaenger_id = (select auth.uid())) with check (empfaenger_id = (select auth.uid()));
alter policy "Empfänger löscht" on public.nachrichten using (empfaenger_id = (select auth.uid()));
alter policy "Moderatoren lesen Inserate" on public.anzeigen using ((select public.ist_moderator()));
alter policy "Moderatoren lesen Meldungen" on public.meldungen using ((select public.ist_moderator()));

-- Indizes für Fremdschlüssel
create index if not exists meldungen_anzeige_idx on public.meldungen (anzeige_id);
create index if not exists nachrichten_absender_idx on public.nachrichten (absender_id);
create index if not exists nachrichten_anzeige_idx on public.nachrichten (anzeige_id);
alter table privat.geheimnis add primary key (wert);


-- Teil B: Löschbefehle, im Supabase-Dashboard unter SQL Editor auszuführen
-- (über die Claude-Anbindung hängen DROP und DELETE an einer Bestätigung).
begin;
-- doppelte Leseregeln, identisch mit "Aktive Inserate lesen"
drop policy if exists "Enable read access for all users" on public.anzeigen;
drop policy if exists "Lesen für alle" on public.anzeigen;
-- überflüssig neben dem Primärschlüssel bzw. ungenutzt
drop index if exists privat.drossel_idx;
alter table privat.drossel drop column if exists quelle;
-- Tabellen und Sichten des ersten Berlin-Prototyps, von der Seite nicht mehr genutzt
drop function if exists public.linien_im_ausschnitt(double precision, double precision, double precision, double precision);
drop view if exists public.stops_mit_linien;
drop view if exists public.bezirk_grenzen_view;
drop table if exists public.route_stops;
drop table if exists public.routes;
drop table if exists public.stops;
drop table if exists public.city_grenze;
commit;
