-- Tauschwunsch: der Ort kommt jetzt aus der Ortssuche und kann ein Ort, ein Bezirk/Ortsteil oder eine PLZ sein
-- (Leeroys Wunsch, 24.10.2026). Er passt, wenn er Ort, Bezirk oder PLZ des Inserats entspricht. Mehrfach ausführbar.
create or replace function privat.tausch_passt(w public.tausch_wuensche, a public.anzeigen)
returns boolean
    language sql stable
    set search_path to ''
    as $$
  select w.anzeige_id is not null
     and (w.max_warmmiete is null or coalesce(a.warmmiete, a.preis) <= w.max_warmmiete)
     and (w.min_zimmer is null or a.zimmer >= w.min_zimmer)
     and (w.min_qm is null or a.quadratmeter >= w.min_qm)
     and (coalesce(w.ort, '') = '' or coalesce(lower(w.ort) in (lower(a.ort), lower(a.bezirk), lower(a.plz)), false))
     and (jsonb_array_length(w.linien) = 0 or exists (
           select 1
           from jsonb_array_elements(w.linien) x
           join public.oepnv_linien l on l.typ = x->>'typ' and l.nummer = x->>'nummer' and l.betreiber = x->>'betreiber'
           join public.oepnv_linie_haltestelle lh on lh.linie_id = l.linie_id
           join public.oepnv_haltestellen h on h.stop_id = lh.stop_id
           where public.st_dwithin(h.geom, a.geom, w.umkreis_m)));
$$;
