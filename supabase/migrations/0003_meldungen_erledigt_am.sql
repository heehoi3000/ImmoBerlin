-- Meldungen: Zeitpunkt der Erledigung merken, damit der tägliche Aufräumlauf (aufraeumen.yml) erledigte
-- Meldungen ein Jahr danach löschen kann, wie es die Datenschutzerklärung (Abschnitt 6) zusagt.
-- Mehrfach ausführbar.
alter table public.meldungen add column if not exists erledigt_am timestamp with time zone;

-- Schon erledigte Meldungen bekommen den heutigen Tag, damit nichts früher als zugesagt verschwindet.
update public.meldungen set erledigt_am = now() where erledigt and erledigt_am is null;

-- Setzt erledigt_am bei jedem Weg, auf dem eine Meldung erledigt wird (meldung_erledigen, inserat_sperren …),
-- und nimmt ihn zurück, wenn sie wieder geöffnet wird.
create or replace function privat.meldung_erledigt_am() returns trigger
    language plpgsql
    set search_path to ''
    as $$
begin
  if new.erledigt and (tg_op = 'INSERT' or not old.erledigt) then
    new.erledigt_am := now();
  elsif not new.erledigt then
    new.erledigt_am := null;
  end if;
  return new;
end $$;

revoke all on function privat.meldung_erledigt_am() from public;

create or replace trigger meldung_erledigt_am
  before insert or update of erledigt on public.meldungen
  for each row execute function privat.meldung_erledigt_am();
