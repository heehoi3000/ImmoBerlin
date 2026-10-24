-- Art des Wohnberechtigungsscheins (nur wenn wbs_erforderlich). Werte wie in Berlin üblich (Einkommensgrenze in
-- Prozent), dazu „besonderer Wohnbedarf“ und „ohne Angabe“ für andere Länder. Mehrfach ausführbar.
alter table public.anzeigen add column if not exists wbs_art text;
alter table public.anzeigen drop constraint if exists anzeigen_wbs_art_check;
alter table public.anzeigen add constraint anzeigen_wbs_art_check
  check (wbs_art is null or (wbs_erforderlich and wbs_art in ('wbs', 'wbs_100', 'wbs_140', 'wbs_160', 'wbs_180', 'wbs_220', 'besonderer_bedarf')));
