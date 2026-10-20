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
// Neben jedem Foto liegt eine kleine Fassung für Listen: abc.webp → abc-klein.webp
export function kleinPfad(pfad: string): string {
  return pfad.replace(/(\.[a-z0-9]+)$/i, '-klein$1');
}

// klein = Fassung für Listen; ältere Fotos haben keine, dafür sorgt fotoFallback()
export function fotoUrl(wert: string, groesse: 'gross' | 'klein' = 'gross'): string {
  const pfad = fotoPfad(wert);
  if (!pfad) return wert;
  return supabase.storage.from(FOTO_BUCKET).getPublicUrl(groesse === 'klein' ? kleinPfad(pfad) : pfad).data.publicUrl;
}

// onError eines <img> mit der kleinen Fassung: einmal auf das große Foto ausweichen
export function fotoFallback(wert: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const gross = fotoUrl(wert);
    if (e.currentTarget.src !== gross) e.currentTarget.src = gross;
  };
}
