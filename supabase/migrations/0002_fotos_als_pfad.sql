-- Fotos der Inserate: alte volle Supabase-Adressen in Pfade im Bucket umwandeln
-- (.../storage/v1/object/public/inserat-bilder/<nutzer>/<datei> wird zu <nutzer>/<datei>).
-- Die Seite kann seit lib/fotos.ts beides; nach dem Umzug zeigen nur Pfade auf den neuen Server.
-- Mehrfach ausführbar: Zeilen ohne volle Adresse bleiben unverändert.
update public.anzeigen
   set bilder = array(
         select regexp_replace(b, '^https?://.*/inserat-bilder/', '')
           from unnest(bilder) with ordinality as u(b, nr)
          order by nr)
 where exists (select 1 from unnest(bilder) as b where b ~ '^https?://.*/inserat-bilder/');
