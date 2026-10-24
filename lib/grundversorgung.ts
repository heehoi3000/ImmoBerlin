// Grundversorgung in der Nähe eines Inserats (RPC grundversorgung_in_der_naehe,
// supabase/migrations/0005/0007): je Art der nächste Ort, Daten aus OpenStreetMap.
import { supabase } from './supabase';

export type Art = 'supermarkt' | 'drogerie' | 'baeckerei' | 'apotheke' | 'hausarzt' | 'post' | 'geldautomat'
  | 'kita' | 'schule' | 'spielplatz' | 'park';

export interface Ort { art: Art; name: string; lat: number; lon: number; entfernung_m: number }

// Reihenfolge der Anzeige, Bezeichnung und Farbe auf der Karte
export type Gruppe = 'alltag' | 'familie';

export const GRUPPEN: { gruppe: Gruppe; name: string }[] = [
  { gruppe: 'alltag', name: 'Einkaufen und Erledigungen' },
  { gruppe: 'familie', name: 'Kinder und Freizeit' },
];

export const ARTEN: { art: Art; name: string; farbe: string; gruppe: Gruppe }[] = [
  { art: 'supermarkt', name: 'Supermarkt', farbe: '#15803d', gruppe: 'alltag' },
  { art: 'drogerie', name: 'Drogerie', farbe: '#be185d', gruppe: 'alltag' },
  { art: 'baeckerei', name: 'Bäckerei', farbe: '#b45309', gruppe: 'alltag' },
  { art: 'apotheke', name: 'Apotheke', farbe: '#b91c1c', gruppe: 'alltag' },
  { art: 'hausarzt', name: 'Hausarzt', farbe: '#1d4ed8', gruppe: 'alltag' },
  { art: 'post', name: 'Post und Pakete', farbe: '#0f766e', gruppe: 'alltag' },
  { art: 'geldautomat', name: 'Geldautomat', farbe: '#4338ca', gruppe: 'alltag' },
  { art: 'kita', name: 'Kita', farbe: '#c2410c', gruppe: 'familie' },
  { art: 'schule', name: 'Schule', farbe: '#7e22ce', gruppe: 'familie' },
  { art: 'spielplatz', name: 'Spielplatz', farbe: '#a16207', gruppe: 'familie' },
  { art: 'park', name: 'Park', farbe: '#166534', gruppe: 'familie' },
];

export const UMKREIS_M = 1500;

export const artName = (art: Art) => ARTEN.find(a => a.art === art)?.name ?? art;
export const artFarbe = (art: Art) => ARTEN.find(a => a.art === art)?.farbe ?? '#3f3f46';

export async function grundversorgungLaden(lat: number, lon: number): Promise<Ort[]> {
  const { data, error } = await supabase.rpc('grundversorgung_in_der_naehe', { p_lat: lat, p_lon: lon, p_radius_m: UMKREIS_M });
  if (error) throw error;
  return (data ?? []) as Ort[];
}
