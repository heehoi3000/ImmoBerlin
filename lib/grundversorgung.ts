// Grundversorgung in der Nähe eines Inserats (RPC grundversorgung_im_umkreis,
// supabase/migrations/0008): alle Orte im Umkreis, nächste zuerst, Daten aus OpenStreetMap.
import { supabase } from './supabase';

export type Art = 'supermarkt' | 'drogerie' | 'baeckerei' | 'apotheke' | 'hausarzt' | 'post' | 'geldautomat'
  | 'kita' | 'schule' | 'spielplatz' | 'park';

export interface Ort { art: Art; name: string; lat: number; lon: number; entfernung_m: number }

export type Gruppe = 'alltag' | 'familie';

export const GRUPPEN: { gruppe: Gruppe; name: string }[] = [
  { gruppe: 'alltag', name: 'Einkaufen und Erledigungen' },
  { gruppe: 'familie', name: 'Kinder und Freizeit' },
];

// Reihenfolge der Anzeige; ohneName steht auf der Karte, wenn ein Ort keinen Namen hat (Hausärzte immer)
export const ARTEN: { art: Art; name: string; ohneName: string; gruppe: Gruppe }[] = [
  { art: 'supermarkt', name: 'Supermarkt', ohneName: 'Supermarkt', gruppe: 'alltag' },
  { art: 'drogerie', name: 'Drogerie', ohneName: 'Drogerie', gruppe: 'alltag' },
  { art: 'baeckerei', name: 'Bäckerei', ohneName: 'Bäckerei', gruppe: 'alltag' },
  { art: 'apotheke', name: 'Apotheke', ohneName: 'Apotheke', gruppe: 'alltag' },
  { art: 'hausarzt', name: 'Hausarzt', ohneName: 'Hausarztpraxis', gruppe: 'alltag' },
  { art: 'post', name: 'Post und Pakete', ohneName: 'Post', gruppe: 'alltag' },
  { art: 'geldautomat', name: 'Bank und Geldautomat', ohneName: 'Bank oder Geldautomat', gruppe: 'alltag' },
  { art: 'kita', name: 'Kita', ohneName: 'Kita', gruppe: 'familie' },
  { art: 'schule', name: 'Schule', ohneName: 'Schule', gruppe: 'familie' },
  { art: 'park', name: 'Park', ohneName: 'Park', gruppe: 'familie' },
];

export const UMKREIS_M = 500;
// „500 m“ bzw. „1,5 km“ für Texte
export const UMKREIS_TEXT = UMKREIS_M < 1000 ? `${UMKREIS_M} m` : `${(UMKREIS_M / 1000).toLocaleString('de-DE')} km`;

export const artName = (art: Art) => ARTEN.find(a => a.art === art)?.name ?? art;

// Text für Tooltip und Popup auf der Karte, z. B. „Rewe · 180 m“
export function ortBeschriftung(o: Ort) {
  const name = o.name || ARTEN.find(a => a.art === o.art)?.ohneName || o.art;
  return `${name} · ${o.entfernung_m.toLocaleString('de-DE')} m`;
}

export async function grundversorgungLaden(lat: number, lon: number): Promise<Ort[]> {
  const { data, error } = await supabase.rpc('grundversorgung_im_umkreis', { p_lat: lat, p_lon: lon, p_radius_m: UMKREIS_M });
  if (error) throw error;
  return (data ?? []) as Ort[];
}
