-- Internetanschluss im Haus (Leeroy, 11.11.2026): freiwillige Angabe der Anbieter, null = weiß ich nicht.
-- Geschwindigkeit in Mbit/s ebenfalls freiwillig. Beispielinserate (ohne Inserent) bekommen Zufallswerte,
-- damit der Filter vor echten Inseraten etwas zeigt. Mehrfach ausführbar.
alter table public.anzeigen add column if not exists internet text;
alter table public.anzeigen add column if not exists internet_mbit integer;
alter table public.anzeigen drop constraint if exists anzeigen_internet_check;
alter table public.anzeigen add constraint anzeigen_internet_check
  check (internet is null or internet in ('glasfaser', 'kabel', 'dsl'));
alter table public.anzeigen drop constraint if exists anzeigen_internet_mbit_check;
alter table public.anzeigen add constraint anzeigen_internet_mbit_check
  check (internet_mbit is null or (internet is not null and internet_mbit between 1 and 100000));

update public.anzeigen
set internet = (array['glasfaser', 'kabel', 'dsl', null])[1 + floor(random() * 4)::int]
where inserent_id is null and internet is null;
