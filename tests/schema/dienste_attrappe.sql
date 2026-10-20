-- Nur für den Test des Datenbank-Aufbaus (tests.yml, Job "datenbank"): Das Docker-Image supabase/postgres
-- bringt die Schemas auth und storage leer mit; deren Tabellen legen sonst die Dienste Auth (GoTrue) und
-- Storage beim Start an. Hier steht nur das, worauf supabase/migrations verweist.
create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz default now()
);
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
-- In Supabase darf postgres Regeln für storage.objects anlegen und Buckets eintragen
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;
alter function storage.foldername(text) owner to postgres;
