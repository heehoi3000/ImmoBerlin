-- Kontaktanfragen an Inserenten. Der Empfänger wird per Trigger aus dem Inserat gesetzt,
-- die E-Mail des Inserenten bleibt so verborgen. Lesen dürfen nur Empfänger und angemeldete Absender.
create table public.nachrichten (
  id uuid primary key default gen_random_uuid(),
  anzeige_id uuid not null references public.anzeigen(id) on delete cascade,
  empfaenger_id uuid not null references auth.users(id) on delete cascade,
  absender_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 200 and email like '%_@_%._%'),
  telefon text check (char_length(telefon) <= 40),
  nachricht text not null check (char_length(nachricht) between 10 and 3000),
  gelesen boolean not null default false,
  erstellt_am timestamptz not null default now()
);
create index nachrichten_empfaenger_idx on public.nachrichten (empfaenger_id, erstellt_am desc);
create index nachrichten_email_zeit_idx on public.nachrichten (email, erstellt_am desc);
alter table public.nachrichten enable row level security;

-- Empfänger kommt immer aus dem Inserat, nicht aus dem Browser; höchstens 5 Nachrichten pro E-Mail und Stunde.
create function public.nachricht_vorbereiten() returns trigger
language plpgsql security definer set search_path = public as $$
declare inserent uuid;
begin
  select inserent_id into inserent from anzeigen where id = new.anzeige_id and status = 'aktiv';
  if inserent is null then raise exception 'Dieses Inserat kann nicht kontaktiert werden'; end if;
  new.empfaenger_id := inserent;
  new.absender_id := auth.uid();
  new.gelesen := false;
  new.erstellt_am := now();
  if (select count(*) from nachrichten where lower(email) = lower(new.email) and erstellt_am > now() - interval '1 hour') >= 5 then
    raise exception 'Zu viele Nachrichten, bitte später erneut versuchen';
  end if;
  return new;
end $$;
create trigger nachrichten_vorbereiten before insert on public.nachrichten for each row execute function public.nachricht_vorbereiten();

create policy "Nachricht senden" on public.nachrichten for insert to anon, authenticated with check (true);
create policy "Eigene Nachrichten lesen" on public.nachrichten for select to authenticated using (empfaenger_id = auth.uid() or absender_id = auth.uid());
create policy "Empfänger markiert gelesen" on public.nachrichten for update to authenticated using (empfaenger_id = auth.uid()) with check (empfaenger_id = auth.uid());
create policy "Empfänger löscht" on public.nachrichten for delete to authenticated using (empfaenger_id = auth.uid());
revoke update on public.nachrichten from anon, authenticated;
grant update (gelesen) on public.nachrichten to authenticated;
revoke execute on function public.nachricht_vorbereiten() from public, anon, authenticated;
