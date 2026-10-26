-- Bot-Schutz mit ALTCHA (26.10.2026). Mehrfach ausführbar.
-- Der Browser holt per altcha_aufgabe() eine signierte Rechenaufgabe, das Widget (npm-Paket altcha) löst sie
-- und schickt die Lösung mit: als Header x-altcha beim Melden, bei Nachrichten und neuen Inseraten, bei der
-- Registrierung in den Nutzerdaten (Auth-Hook „Before User Created“). Kein fremder Dienst beteiligt.
-- Format wie altcha 3.x mit Algorithmus SHA-256: Schlüssel = sha256(salt || nonce || zähler als uint32),
-- er muss mit keyPrefix beginnen. Die Signatur prüft nur dieser Server, daher eine einfache eigene Form.

-- Schlüssel für die Signaturen, abgeleitet aus privat.geheimnis (auf neuen Servern wird es hier angelegt)
insert into privat.geheimnis (wert) select extensions.gen_random_bytes(32) where not exists (select 1 from privat.geheimnis);

-- Benutzte Aufgaben, damit jede Lösung nur einmal gilt; Einträge werden nach Ablauf gelöscht
create table if not exists privat.altcha_genutzt (
  signatur text primary key,
  gilt_bis timestamptz not null
);
revoke all on privat.altcha_genutzt from public, anon, authenticated;

create or replace function privat.altcha_signatur(p jsonb) returns text
    language sql stable security definer
    set search_path to ''
    as $$
  select encode(extensions.hmac(
    convert_to(concat_ws('|', p->>'algorithm', p->>'nonce', p->>'salt', p->>'cost', p->>'keyLength', p->>'keyPrefix', p->>'expiresAt'), 'UTF8'),
    extensions.digest((select wert from privat.geheimnis limit 1) || convert_to('altcha', 'UTF8'), 'sha256'),
    'sha256'), 'hex');
$$;

-- Schwierigkeit: 4 Hex-Nullen = im Mittel 65.536 Versuche, im Browser etwa eine Sekunde
create or replace function public.altcha_aufgabe() returns jsonb
    language plpgsql volatile security definer
    set search_path to ''
    as $$
declare
  p jsonb := jsonb_build_object(
    'algorithm', 'SHA-256', 'cost', 1, 'keyLength', 32, 'keyPrefix', '0000',
    'nonce', encode(extensions.gen_random_bytes(16), 'hex'),
    'salt', encode(extensions.gen_random_bytes(16), 'hex'),
    'expiresAt', extract(epoch from now() + interval '10 minutes')::bigint);
begin
  return jsonb_build_object('parameters', p, 'signature', privat.altcha_signatur(p));
end $$;

-- Gibt null zurück, wenn die Lösung gilt (und verbraucht sie), sonst den Grund
create or replace function privat.altcha_fehler(p_loesung text) returns text
    language plpgsql volatile security definer
    set search_path to ''
    as $$
declare
  j jsonb;
  p jsonb;
  sig text;
  zaehler bigint;
  schluessel text;
begin
  if p_loesung is null or p_loesung = '' then return 'fehlt'; end if;
  if length(p_loesung) > 4000 then return 'ungültig'; end if;
  begin
    j := convert_from(decode(p_loesung, 'base64'), 'UTF8')::jsonb;
  exception when others then
    return 'ungültig';
  end;
  p := j->'challenge'->'parameters';
  sig := j->'challenge'->>'signature';
  if jsonb_typeof(p) is distinct from 'object' or sig is null
     or p->>'algorithm' is distinct from 'SHA-256' or p->>'cost' is distinct from '1'
     or p->>'keyLength' is distinct from '32' or p->>'keyPrefix' is distinct from '0000'
     or coalesce(p->>'nonce', '') !~ '^[0-9a-f]{32}$' or coalesce(p->>'salt', '') !~ '^[0-9a-f]{32}$'
     or coalesce(p->>'expiresAt', '') !~ '^[0-9]{1,12}$'
     or coalesce(j->'solution'->>'counter', '') !~ '^[0-9]{1,10}$' then
    return 'ungültig';
  end if;
  if sig <> privat.altcha_signatur(p) then return 'ungültig'; end if;
  if (p->>'expiresAt')::bigint < extract(epoch from now()) then return 'abgelaufen'; end if;
  zaehler := (j->'solution'->>'counter')::bigint;
  if zaehler > 4294967295 then return 'ungültig'; end if;
  schluessel := encode(extensions.digest(
    decode(p->>'salt', 'hex') || decode(p->>'nonce', 'hex') || substring(int8send(zaehler) from 5 for 4), 'sha256'), 'hex');
  if left(schluessel, 4) <> '0000' then return 'falsch'; end if;

  delete from privat.altcha_genutzt where gilt_bis < now();
  insert into privat.altcha_genutzt (signatur, gilt_bis) values (sig, to_timestamp((p->>'expiresAt')::bigint))
  on conflict do nothing;
  if not found then return 'schon benutzt'; end if;
  return null;
end $$;

-- Für Einträge über die Schnittstelle: verlangt den Header x-altcha. Interne Aufrufe (Migrationen,
-- Workflows mit service_role, Datenbank direkt) haben keine Anfrage-Header und bleiben frei.
create or replace function privat.altcha_verlangen() returns void
    language plpgsql volatile security definer
    set search_path to ''
    as $$
declare
  kopf json := nullif(current_setting('request.headers', true), '')::json;
  fehler text;
begin
  if kopf is null or (select auth.role()) = 'service_role' then return; end if;
  fehler := privat.altcha_fehler(kopf->>'x-altcha');
  if fehler is not null then
    raise exception 'Bot-Schutz nicht bestanden (%), bitte erneut versuchen', fehler using errcode = 'P0001';
  end if;
end $$;

revoke all on function privat.altcha_signatur(jsonb) from public, anon, authenticated;
revoke all on function privat.altcha_fehler(text) from public, anon, authenticated;
revoke all on function privat.altcha_verlangen() from public, anon, authenticated;
revoke all on function public.altcha_aufgabe() from public;
grant execute on function public.altcha_aufgabe() to anon, authenticated;

-- Prüfung vor der IP-Drossel, damit Fehlversuche das Kontingent nicht verbrauchen
create or replace function public.meldung_drosseln() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
  perform privat.altcha_verlangen();
  perform privat.drosseln('meldung', 5, interval '1 hour');
  return new;
end $$;

create or replace function public.nachricht_drosseln() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
  perform privat.altcha_verlangen();
  perform privat.drosseln('nachricht', 10, interval '1 hour');
  return new;
end $$;

create or replace function public.inserat_drosseln() returns trigger
    language plpgsql security definer
    set search_path to ''
    as $$
begin
  perform privat.altcha_verlangen();
  if (select count(*) from public.anzeigen where inserent_id = auth.uid() and erstellt_am > now() - interval '1 day') >= 10 then
    raise exception 'Zu viele neue Inserate heute, bitte morgen erneut versuchen' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Auth-Hook „Before User Created“: einschalten unter Authentication > Hooks (Postgres-Funktion
-- public.altcha_vor_registrierung), selbst gehostet per GOTRUE_HOOK_BEFORE_USER_CREATED_ENABLED=true und
-- GOTRUE_HOOK_BEFORE_USER_CREATED_URI=pg-functions://postgres/public/altcha_vor_registrierung.
-- Die Seite schickt die Lösung bei signUp in options.data.altcha und entfernt sie nach der ersten Anmeldung.
create or replace function public.altcha_vor_registrierung(event jsonb) returns jsonb
    language plpgsql volatile security definer
    set search_path to ''
    as $$
declare
  fehler text := privat.altcha_fehler(event->'user'->'user_metadata'->>'altcha');
begin
  if fehler is null then return '{}'::jsonb; end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 400,
    'message', format('Bot-Schutz nicht bestanden (%s), bitte erneut versuchen', fehler)));
end $$;

revoke all on function public.altcha_vor_registrierung(jsonb) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    grant execute on function public.altcha_vor_registrierung(jsonb) to supabase_auth_admin;
  end if;
end $$;
