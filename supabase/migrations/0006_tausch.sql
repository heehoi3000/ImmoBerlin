-- Tauschwohnungen: Inserate mit transaktions_typ 'tauschen' (Miete, Angaben wie bei Vermieten) und einem
-- Tauschwunsch. tausch_partner findet zu einem eigenen Tauschinserat die Inserate, die zum Wunsch passen,
-- und markiert die, bei denen es auch umgekehrt passt. Mehrfach ausführbar.

-- Wunsch je Tauschinserat. Linien als {typ, nummer, betreiber, endpunkte}, weil sich linie_id bei jedem
-- wöchentlichen Fahrplan-Import ändert; aufgelöst wird beim Abgleich über typ, nummer und betreiber.
create table if not exists public.tausch_wuensche (
    anzeige_id uuid primary key references public.anzeigen(id) on delete cascade,
    linien jsonb not null default '[]'::jsonb check (jsonb_typeof(linien) = 'array' and jsonb_array_length(linien) <= 5),
    umkreis_m integer not null default 600 check (umkreis_m between 200 and 2000),
    ort text check (char_length(ort) <= 100),
    max_warmmiete numeric check (max_warmmiete > 0),
    min_zimmer real check (min_zimmer > 0),
    min_qm real check (min_qm > 0),
    geaendert_am timestamptz not null default now()
);
alter table public.tausch_wuensche enable row level security;
do $$ begin
  -- Lesen, wer das Inserat lesen darf (aktive Inserate alle, pausierte nur der Inserent)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tausch_wuensche' and policyname = 'lesen') then
    create policy lesen on public.tausch_wuensche for select
      using (exists (select 1 from public.anzeigen a where a.id = anzeige_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tausch_wuensche' and policyname = 'eigene schreiben') then
    create policy "eigene schreiben" on public.tausch_wuensche for all to authenticated
      using (exists (select 1 from public.anzeigen a where a.id = anzeige_id and a.inserent_id = (select auth.uid())))
      with check (exists (select 1 from public.anzeigen a where a.id = anzeige_id and a.inserent_id = (select auth.uid())
                                                         and a.transaktions_typ = 'tauschen'));
  end if;
end $$;
revoke all on public.tausch_wuensche from anon, authenticated;
grant select on public.tausch_wuensche to anon, authenticated;
grant insert, update, delete on public.tausch_wuensche to authenticated;

-- Passt ein Inserat zu einem Wunsch? Fehlende Angaben im Wunsch schränken nicht ein.
create or replace function privat.tausch_passt(w public.tausch_wuensche, a public.anzeigen)
returns boolean
    language sql stable
    set search_path to ''
    as $$
  select w.anzeige_id is not null
     and (w.max_warmmiete is null or coalesce(a.warmmiete, a.preis) <= w.max_warmmiete)
     and (w.min_zimmer is null or a.zimmer >= w.min_zimmer)
     and (w.min_qm is null or a.quadratmeter >= w.min_qm)
     and (coalesce(w.ort, '') = '' or lower(a.ort) = lower(w.ort))
     and (jsonb_array_length(w.linien) = 0 or exists (
           select 1
           from jsonb_array_elements(w.linien) x
           join public.oepnv_linien l on l.typ = x->>'typ' and l.nummer = x->>'nummer' and l.betreiber = x->>'betreiber'
           join public.oepnv_linie_haltestelle lh on lh.linie_id = l.linie_id
           join public.oepnv_haltestellen h on h.stop_id = lh.stop_id
           where public.st_dwithin(h.geom, a.geom, w.umkreis_m)));
$$;
revoke all on function privat.tausch_passt(public.tausch_wuensche, public.anzeigen) from public;
grant execute on function privat.tausch_passt(public.tausch_wuensche, public.anzeigen) to authenticated, service_role;

-- Tauschpartner für ein eigenes Tauschinserat: aktive Tauschinserate anderer, die zum eigenen Wunsch passen.
-- gegenseitig = das eigene Inserat passt auch zu deren Wunsch. Gegenseitige zuerst, höchstens 50.
create or replace function public.tausch_partner(p_anzeige uuid)
returns table(id uuid, gegenseitig boolean)
    language sql stable
    set search_path to ''
    as $$
  select o.id, privat.tausch_passt(ow, m) as gegenseitig
  from public.anzeigen m
  join public.tausch_wuensche mw on mw.anzeige_id = m.id
  join public.anzeigen o on o.transaktions_typ = 'tauschen' and o.status = 'aktiv' and o.id <> m.id
                         and o.inserent_id is distinct from m.inserent_id
  left join public.tausch_wuensche ow on ow.anzeige_id = o.id
  where m.id = p_anzeige and m.inserent_id = (select auth.uid()) and m.transaktions_typ = 'tauschen'
    and privat.tausch_passt(mw, o)
  order by 2 desc, o.erstellt_am desc
  limit 50;
$$;
revoke all on function public.tausch_partner(uuid) from public;
grant execute on function public.tausch_partner(uuid) to authenticated, service_role;
