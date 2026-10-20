-- Moderation mit Begründung (Art. 17 DSA), Einspruch, Konto löschen und Spamschutz.
-- Setzt inserate_login_meldungen.sql, nachrichten.sql und rechte_absichern.sql voraus.

-- 1) Moderatoren: Konten, die Meldungen sehen und Inserate sperren dürfen.
--    Die Tabelle hat keine Regeln für anon/authenticated, gepflegt wird sie im Dashboard.
create table if not exists privat.moderatoren (
  nutzer_id uuid primary key references auth.users(id) on delete cascade,
  erstellt_am timestamptz not null default now()
);
revoke all on privat.moderatoren from public, anon, authenticated;

create or replace function public.ist_moderator() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privat.moderatoren where nutzer_id = auth.uid());
$$;
revoke execute on function public.ist_moderator() from public, anon;
grant execute on function public.ist_moderator() to authenticated;

-- 2) Sperrgrund und Einspruch am Inserat
alter table public.anzeigen
  add column if not exists sperr_kategorie text check (sperr_kategorie in ('betrug', 'falsche_angaben', 'diskriminierung', 'rechtswidrig', 'regelverstoss', 'sonstiges')),
  add column if not exists sperrgrund text check (char_length(sperrgrund) <= 2000),
  add column if not exists gesperrt_am timestamptz,
  add column if not exists einspruch text check (char_length(einspruch) <= 2000),
  add column if not exists einspruch_am timestamptz,
  add column if not exists einspruch_antwort text check (char_length(einspruch_antwort) <= 2000),
  add column if not exists einspruch_entschieden_am timestamptz;

-- Diese Felder ändern nur die Moderationsfunktionen unten (sie setzen immobil.moderation),
-- über die normale Bearbeitung bleiben sie unverändert.
create or replace function public.anzeigen_moderation_schuetzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('immobil.moderation', true), '') <> 'an' then
    if tg_op = 'INSERT' then
      new.sperr_kategorie := null; new.sperrgrund := null; new.gesperrt_am := null;
      new.einspruch := null; new.einspruch_am := null; new.einspruch_antwort := null; new.einspruch_entschieden_am := null;
    else
      new.sperr_kategorie := old.sperr_kategorie; new.sperrgrund := old.sperrgrund; new.gesperrt_am := old.gesperrt_am;
      new.einspruch := old.einspruch; new.einspruch_am := old.einspruch_am;
      new.einspruch_antwort := old.einspruch_antwort; new.einspruch_entschieden_am := old.einspruch_entschieden_am;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists anzeigen_moderation_schuetzen on public.anzeigen;
create trigger anzeigen_moderation_schuetzen before insert or update on public.anzeigen
  for each row execute function public.anzeigen_moderation_schuetzen();

-- Moderatoren lesen alle Inserate und alle Meldungen
create policy "Moderatoren lesen Inserate" on public.anzeigen for select to authenticated using (public.ist_moderator());
create policy "Moderatoren lesen Meldungen" on public.meldungen for select to authenticated using (public.ist_moderator());
grant select on public.meldungen to authenticated;

create or replace function public.inserat_sperren(p_id uuid, p_kategorie text, p_grund text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_moderator() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_grund, ''))) < 10 then raise exception 'Bitte eine Begründung mit mindestens 10 Zeichen angeben'; end if;
  perform set_config('immobil.moderation', 'an', true);
  update public.anzeigen set status = 'gesperrt', sperr_kategorie = p_kategorie, sperrgrund = trim(p_grund), gesperrt_am = now(),
    einspruch = null, einspruch_am = null, einspruch_antwort = null, einspruch_entschieden_am = null
  where id = p_id;
  if not found then raise exception 'Inserat nicht gefunden'; end if;
  -- offene Meldungen zu diesem Inserat sind damit erledigt
  update public.meldungen set erledigt = true where anzeige_id = p_id and not erledigt;
end $$;

create or replace function public.inserat_freigeben(p_id uuid, p_antwort text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_moderator() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  perform set_config('immobil.moderation', 'an', true);
  update public.anzeigen set status = 'aktiv', sperr_kategorie = null, sperrgrund = null, gesperrt_am = null,
    einspruch = null, einspruch_am = null, einspruch_antwort = null, einspruch_entschieden_am = null
  where id = p_id and status = 'gesperrt';
  if not found then raise exception 'Inserat ist nicht gesperrt'; end if;
end $$;

create or replace function public.einspruch_ablehnen(p_id uuid, p_antwort text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_moderator() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_antwort, ''))) < 10 then raise exception 'Bitte eine Begründung mit mindestens 10 Zeichen angeben'; end if;
  perform set_config('immobil.moderation', 'an', true);
  update public.anzeigen set einspruch_antwort = trim(p_antwort), einspruch_entschieden_am = now()
  where id = p_id and status = 'gesperrt' and einspruch is not null;
  if not found then raise exception 'Kein offener Einspruch'; end if;
end $$;

create or replace function public.meldung_erledigen(p_id uuid, p_erledigt boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_moderator() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  update public.meldungen set erledigt = p_erledigt where id = p_id;
end $$;

-- Inserent legt einmal Einspruch gegen eine Sperre ein (nach Ablehnung ist kein zweiter möglich)
create or replace function public.einspruch_einlegen(p_id uuid, p_text text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(trim(coalesce(p_text, ''))) < 10 then raise exception 'Bitte begründe deinen Einspruch mit mindestens 10 Zeichen'; end if;
  perform set_config('immobil.moderation', 'an', true);
  update public.anzeigen set einspruch = trim(p_text), einspruch_am = now()
  where id = p_id and inserent_id = auth.uid() and status = 'gesperrt' and einspruch is null;
  if not found then raise exception 'Einspruch nicht möglich'; end if;
end $$;

revoke execute on function public.inserat_sperren(uuid, text, text), public.inserat_freigeben(uuid, text),
  public.einspruch_ablehnen(uuid, text), public.meldung_erledigen(uuid, boolean), public.einspruch_einlegen(uuid, text)
  from public, anon;
grant execute on function public.inserat_sperren(uuid, text, text), public.inserat_freigeben(uuid, text),
  public.einspruch_ablehnen(uuid, text), public.meldung_erledigen(uuid, boolean), public.einspruch_einlegen(uuid, text)
  to authenticated;
revoke execute on function public.anzeigen_moderation_schuetzen() from public, anon, authenticated;

-- 3) Konto löschen läuft über die Edge Function supabase/functions/konto-loeschen
--    (Fotos löschen, Meldungen anonymisieren, auth.admin.deleteUser). Inserate und empfangene
--    Nachrichten fallen per Fremdschlüssel weg. Zum Auflisten der eigenen Fotos:
create policy "Eigene Bilder auflisten" on storage.objects for select to authenticated
  using (bucket_id = 'inserat-bilder' and (storage.foldername(name))[1] = auth.uid()::text);

-- Die Service-Rolle braucht das Schema privat für die Anfrageprüfung (pgrst.db_pre_request),
-- sonst scheitert jede REST-Anfrage mit dem Service-Schlüssel.
grant usage on schema privat to service_role;

-- 4) Spamschutz: Obergrenzen je IP-Adresse. Gespeichert wird nur ein Hash aus geheimem Salz,
--    Adresse und Datum (nicht zurückrechenbar, nur am selben Tag verknüpfbar), gezählt je Minute.
--    Alte Zeilen löscht täglich .github/workflows/aufraeumen.yml.
create table if not exists privat.drossel (
  art text not null,
  schluessel text not null,
  zeit timestamptz not null default now(),
  anzahl int not null default 1,
  quelle text,   -- ungenutzt (Diagnose beim Einrichten)
  primary key (art, schluessel, zeit)
);
revoke all on privat.drossel from public, anon, authenticated;
create table if not exists privat.geheimnis (wert bytea not null);
insert into privat.geheimnis select extensions.gen_random_bytes(32) where not exists (select 1 from privat.geheimnis);
revoke all on privat.geheimnis from public, anon, authenticated;

create or replace function privat.drosseln(p_art text, p_max int, p_fenster interval) returns void
language plpgsql security definer set search_path = '' as $$
declare
  kopf json := nullif(current_setting('request.headers', true), '')::json;
  ip text := coalesce(kopf->>'cf-connecting-ip', split_part(kopf->>'x-forwarded-for', ',', 1), kopf->>'x-real-ip');
  s text;
begin
  if ip is null or trim(ip) = '' then return; end if;   -- z. B. Aufrufe aus dem Dashboard
  s := encode(extensions.digest((select wert from privat.geheimnis limit 1) || convert_to(trim(ip) || current_date::text, 'UTF8'), 'sha256'), 'hex');
  if (select coalesce(sum(anzahl), 0) from privat.drossel d where d.art = p_art and d.schluessel = s and d.zeit > now() - p_fenster) >= p_max then
    raise exception 'Zu viele Anfragen, bitte später erneut versuchen' using errcode = 'P0001';
  end if;
  insert into privat.drossel as d (art, schluessel, zeit) values (p_art, s, date_trunc('minute', now()))
  on conflict (art, schluessel, zeit) do update set anzahl = d.anzahl + 1;
end $$;
revoke execute on function privat.drosseln(text, int, interval) from public, anon, authenticated;

create or replace function public.meldung_drosseln() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privat.drosseln('meldung', 5, interval '1 hour');
  return new;
end $$;
drop trigger if exists meldungen_drosseln on public.meldungen;
create trigger meldungen_drosseln before insert on public.meldungen for each row execute function public.meldung_drosseln();

create or replace function public.nachricht_drosseln() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privat.drosseln('nachricht', 10, interval '1 hour');
  return new;
end $$;
drop trigger if exists nachrichten_drosseln on public.nachrichten;
create trigger nachrichten_drosseln before insert on public.nachrichten for each row execute function public.nachricht_drosseln();

-- Inserate: höchstens 10 neue pro Konto und Tag
create or replace function public.inserat_drosseln() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.anzeigen where inserent_id = auth.uid() and erstellt_am > now() - interval '1 day') >= 10 then
    raise exception 'Zu viele neue Inserate heute, bitte morgen erneut versuchen' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists anzeigen_drosseln on public.anzeigen;
create trigger anzeigen_drosseln before insert on public.anzeigen for each row execute function public.inserat_drosseln();

revoke execute on function public.meldung_drosseln(), public.nachricht_drosseln(), public.inserat_drosseln() from public, anon, authenticated;

-- 5) Leeroys Konto als Moderator (weitere im Dashboard: insert into privat.moderatoren values ('<nutzer-id>'))
insert into privat.moderatoren (nutzer_id)
select id from auth.users where lower(email) = 'leeroy.leffke@web.de'
on conflict do nothing;
