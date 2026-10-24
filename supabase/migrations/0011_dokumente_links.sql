-- Links und Dokumente im Inserat (Leeroys Wunsch, 24.10.2026): Inserenten laden PDFs wie Grundriss oder
-- Energieausweis hoch und können Links (z. B. virtueller Rundgang) angeben. Die PDFs liegen im selben Bucket
-- wie die Fotos (Ordner <nutzer-id>/), damit „Konto löschen“ sie ohne Änderung mit entfernt. Mehrfach ausführbar.

-- Bucket: zusätzlich PDF erlauben, Grenze 10 MB (Fotos werden im Browser ohnehin auf wenige 100 KB verkleinert)
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], file_size_limit = 10485760
where id = 'inserat-bilder';

-- dokumente: [{"art": "grundriss" | "energieausweis" | "sonstiges", "titel": "...", "pfad": "<nutzer-id>/<zeit>-<zufall>.pdf"}]
-- links:     [{"titel": "...", "url": "https://..."}]
alter table public.anzeigen add column if not exists dokumente jsonb not null default '[]'::jsonb;
alter table public.anzeigen add column if not exists links jsonb not null default '[]'::jsonb;

alter table public.anzeigen drop constraint if exists anzeigen_dokumente_check;
alter table public.anzeigen add constraint anzeigen_dokumente_check check (
  jsonb_typeof(dokumente) = 'array' and jsonb_array_length(dokumente) <= 10
  and not jsonb_path_exists(dokumente, '$[*] ? (!(@.art == "grundriss" || @.art == "energieausweis" || @.art == "sonstiges"))')
  and not jsonb_path_exists(dokumente, '$[*] ? (!(@.pfad like_regex "^[0-9a-f-]{36}/[0-9]+-[a-z0-9]+\\.pdf$"))')
  and not jsonb_path_exists(dokumente, '$[*] ? (@.titel.type() != "string")')
  and length(dokumente::text) <= 5000);

alter table public.anzeigen drop constraint if exists anzeigen_links_check;
alter table public.anzeigen add constraint anzeigen_links_check check (
  jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 5
  and not jsonb_path_exists(links, '$[*] ? (!(@.url like_regex "^https://[^\\s<>\"]+$"))')
  and not jsonb_path_exists(links, '$[*] ? (@.titel.type() != "string")')
  and length(links::text) <= 3000);
