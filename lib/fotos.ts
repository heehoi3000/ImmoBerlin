// Fotos der Inserate im Speicher (Bucket inserat-bilder). In anzeigen.bilder steht der Pfad im Bucket,
// z. B. "<nutzer-id>/1729000000000-ab12cd34.webp". Ältere Inserate enthalten noch die volle Supabase-Adresse;
// auch die wird verstanden und immer über den aktuellen Speicher ausgeliefert, damit Fotos einen Umzug überstehen.
import { supabase } from './supabase';

export const FOTO_BUCKET = 'inserat-bilder';

// Pfad im Bucket aus einem gespeicherten Wert, leer wenn er nicht in unseren Speicher zeigt
export function fotoPfad(wert: string): string {
  if (!/^https?:\/\//.test(wert)) return wert;
  const marke = `/${FOTO_BUCKET}/`;
  const i = wert.indexOf(marke);
  return i >= 0 ? wert.slice(i + marke.length) : '';
}

// Adresse zum Anzeigen
export function fotoUrl(wert: string): string {
  const pfad = fotoPfad(wert);
  return pfad ? supabase.storage.from(FOTO_BUCKET).getPublicUrl(pfad).data.publicUrl : wert;
}
