-- Login, eigene Inserate und Meldungen (Fehler und rechtswidrige Inserate).
-- Login läuft über Supabase Auth (E-Mail und Passwort), dafür ist keine eigene Tabelle nötig.

-- 1) anzeigen: Inserent, Status, Beschreibung, Bilder und Pflichtangaben
--    (§ 87 GEG Energieausweis, § 5a UWG privat/gewerblich, §§ 656c/656d BGB Provision bei Kauf, § 6 WoVermittG)
alter table public.anzeigen
  add column if not exists inserent_id uuid references auth.users(id) on delete cascade default auth.uid(),
  add column if not exists status text not null default 'aktiv' check (status in ('aktiv', 'pausiert', 'gesperrt')),
  add column if not exists beschreibung text check (char_length(beschreibung) <= 5000),
  add column if not exists bilder text[] not null default '{}',
  add column if not exists anbieter_typ text check (anbieter_typ in ('privat', 'gewerblich')),
  add column if not exists anbieter_name text check (char_length(anbieter_name) <= 200),
  add column if not exists nebenkosten numeric,
  add column if not exists kaution numeric,
  add column if not exists provision text check (char_length(provision) <= 200),
  add column if not exists energieausweis_art text check (energieausweis_art in ('verbrauch', 'bedarf', 'nicht_erforderlich')),
  add column if not exists energiekennwert numeric,
  add column if not exists energietraeger text check (char_length(energietraeger) <= 100);

create index if not exists anzeigen_inserent_idx on public.anzeigen (inserent_id);

-- Koordinaten aus dem Formular werden zur Geometrie für die ÖPNV-Suche
create or replace function public.anzeigen_geom_setzen() returns trigger language plpgsql set search_path = public, extensions as $$
begin
  if new.koordinate_lat is not null and new.koordinate_lon is not null then
    new.geom := st_setsrid(st_point(new.koordinate_lon, new.koordinate_lat), 4326)::geography;
  end if;
  return new;
end $$;
create trigger anzeigen_geom before insert or update of koordinate_lat, koordinate_lon on public.anzeigen
  for each row execute function public.anzeigen_geom_setzen();

-- Lesen: alle sehen aktive Inserate, Inserenten zusätzlich ihre eigenen
-- Die beiden alten Lese-Regeln ("true") werden eingeschränkt statt gelöscht
alter policy "Lesen für alle" on public.anzeigen using (status = 'aktiv' or inserent_id = auth.uid());
alter policy "Enable read access for all users" on public.anzeigen using (status = 'aktiv' or inserent_id = auth.uid());
create policy "Aktive Inserate lesen" on public.anzeigen for select
  using (status = 'aktiv' or inserent_id = auth.uid());
-- Schreiben nur eigene Inserate, gesperrte kann der Inserent nicht selbst freischalten
create policy "Eigene Inserate anlegen" on public.anzeigen for insert to authenticated
  with check (inserent_id = auth.uid() and status in ('aktiv', 'pausiert'));
create policy "Eigene Inserate ändern" on public.anzeigen for update to authenticated
  using (inserent_id = auth.uid() and status <> 'gesperrt')
  with check (inserent_id = auth.uid() and status in ('aktiv', 'pausiert'));
create policy "Eigene Inserate löschen" on public.anzeigen for delete to authenticated
  using (inserent_id = auth.uid());

-- 2) meldungen: Fehler auf der Seite und Meldungen zu Inseraten (Art. 16 DSA)
--    Jeder darf melden, lesen kann nur das Team im Supabase-Dashboard.
create table if not exists public.meldungen (
  id uuid primary key default gen_random_uuid(),
  art text not null check (art in ('fehler', 'inserat', 'sonstiges')),
  anzeige_id uuid references public.anzeigen(id) on delete set null,
  nachricht text not null check (char_length(nachricht) between 5 and 3000),
  email text check (char_length(email) <= 200),
  seite text check (char_length(seite) <= 500),
  browser text check (char_length(browser) <= 500),
  nutzer_id uuid default auth.uid(),
  erledigt boolean not null default false,
  erstellt_am timestamptz not null default now()
);
alter table public.meldungen enable row level security;
create policy "Jeder darf melden" on public.meldungen for insert to anon, authenticated
  with check (erledigt = false and (nutzer_id is null or nutzer_id = auth.uid()));

-- 3) Bilder der Inserate: öffentlich lesbar, hochladen nur in den eigenen Ordner (<nutzer-id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inserat-bilder', 'inserat-bilder', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "Eigene Bilder hochladen" on storage.objects for insert to authenticated
  with check (bucket_id = 'inserat-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Eigene Bilder löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'inserat-bilder' and (storage.foldername(name))[1] = auth.uid()::text);
