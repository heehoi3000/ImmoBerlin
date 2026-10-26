-- Prüft den Bot-Schutz (Migration 0014): Aufgabe lösen wie das Widget, Lösung gilt genau einmal,
-- veränderte oder fehlende Lösungen werden abgelehnt, Einträge über die Schnittstelle brauchen den Header.
create function pg_temp.altcha_loesen() returns text language plpgsql as $$
declare
  a jsonb := public.altcha_aufgabe();
  z bigint := 0;
begin
  while left(encode(extensions.digest(decode(a->'parameters'->>'salt', 'hex') || decode(a->'parameters'->>'nonce', 'hex')
                      || substring(int8send(z) from 5 for 4), 'sha256'), 'hex'), 4) <> '0000' loop
    z := z + 1;
  end loop;
  return replace(encode(convert_to(jsonb_build_object('challenge', a, 'solution', jsonb_build_object('counter', z))::text, 'UTF8'), 'base64'), E'\n', '');
end $$;

do $$
declare
  a jsonb := public.altcha_aufgabe();
  p jsonb := a->'parameters';
  z bigint := 0;
  loesung text;
  falsch text;
  fehler text;
begin
  while left(encode(extensions.digest(decode(p->>'salt', 'hex') || decode(p->>'nonce', 'hex')
                      || substring(int8send(z) from 5 for 4), 'sha256'), 'hex'), 4) <> '0000' loop
    z := z + 1;
  end loop;
  loesung := encode(convert_to(jsonb_build_object('challenge', a, 'solution', jsonb_build_object('counter', z, 'derivedKey', ''))::text, 'UTF8'), 'base64');
  loesung := replace(loesung, E'\n', '');

  if privat.altcha_fehler(null) is distinct from 'fehlt' then raise exception 'Fehlende Lösung nicht erkannt'; end if;
  if privat.altcha_fehler('kein base64!') is distinct from 'ungültig' then raise exception 'Kaputte Lösung nicht erkannt'; end if;

  -- Falscher Zähler
  falsch := replace(encode(convert_to(jsonb_build_object('challenge', a, 'solution', jsonb_build_object('counter', z + 1))::text, 'UTF8'), 'base64'), E'\n', '');
  if privat.altcha_fehler(falsch) is null then raise exception 'Falsche Lösung angenommen'; end if;

  -- Leichtere Aufgabe untergeschoben: Signatur passt nicht mehr
  falsch := replace(encode(convert_to(jsonb_build_object('challenge', jsonb_set(a, '{parameters,keyPrefix}', '"0"'), 'solution', jsonb_build_object('counter', z))::text, 'UTF8'), 'base64'), E'\n', '');
  if privat.altcha_fehler(falsch) is distinct from 'ungültig' then raise exception 'Veränderte Aufgabe angenommen'; end if;

  fehler := privat.altcha_fehler(loesung);
  if fehler is not null then raise exception 'Richtige Lösung abgelehnt: %', fehler; end if;
  if privat.altcha_fehler(loesung) is distinct from 'schon benutzt' then raise exception 'Lösung doppelt angenommen'; end if;

  -- Auth-Hook
  if public.altcha_vor_registrierung('{"user":{"user_metadata":{}}}') ? 'error' is not true then
    raise exception 'Registrierung ohne Lösung angenommen';
  end if;

  -- Über die Schnittstelle ohne Header: Meldung wird abgelehnt
  perform set_config('request.headers', '{"x-forwarded-for":"192.0.2.1"}', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    insert into public.meldungen (art, nachricht) values ('sonstiges', 'Test ohne Bot-Schutz');
    raise exception 'Meldung ohne Lösung angenommen';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'Bot-Schutz%' then raise; end if;
  end;
  -- Mit gültiger Lösung im Header klappt es
  perform set_config('request.headers', json_build_object('x-forwarded-for', '192.0.2.1', 'x-altcha', pg_temp.altcha_loesen())::text, true);
  insert into public.meldungen (art, nachricht) values ('sonstiges', 'Test mit Bot-Schutz');
  delete from public.meldungen where nachricht = 'Test mit Bot-Schutz';
  perform set_config('request.headers', '', true);
  perform set_config('request.jwt.claims', '', true);

  if not has_function_privilege('anon', 'public.altcha_aufgabe()', 'execute') then raise exception 'anon darf keine Aufgabe holen'; end if;
  if has_function_privilege('anon', 'public.altcha_vor_registrierung(jsonb)', 'execute') then raise exception 'anon darf den Auth-Hook aufrufen'; end if;
  if has_function_privilege('anon', 'privat.altcha_fehler(text)', 'execute') then raise exception 'anon darf Lösungen prüfen'; end if;
  raise notice 'Bot-Schutz in Ordnung (Zähler %)', z;
end $$;
