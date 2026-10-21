// Grundversorgung in der Nähe eines Inserats (RPC grundversorgung_in_der_naehe,
// supabase/migrations/0005_grundversorgung.sql): je Art der nächste Ort, Daten aus OpenStreetMap.
import { supabase } from './supabase';

export type Art = 'supermarkt' | 'drogerie' | 'baeckerei' | 'apotheke' | 'hausarzt' | 'post' | 'geldautomat';

export interface Ort { art: Art; name: string; lat: number; lon: number; entfernung_m: number }

// Reihenfolge der Anzeige, Bezeichnung und Farbe auf der Karte
export const ARTEN: { art: Art; name: string; farbe: string }[] = [
  { art: 'supermarkt', name: 'Supermarkt', farbe: '#15803d' },
  { art: 'drogerie', name: 'Drogerie', farbe: '#be185d' },
  { art: 'baeckerei', name: 'Bäckerei', farbe: '#b45309' },
  { art: 'apotheke', name: 'Apotheke', farbe: '#b91c1c' },
  { art: 'hausarzt', name: 'Hausarzt', farbe: '#1d4ed8' },
  { art: 'post', name: 'Post und Pakete', farbe: '#0f766e' },
  { art: 'geldautomat', name: 'Geldautomat', farbe: '#4338ca' },
];

export const UMKREIS_M = 1500;

export const artName = (art: Art) => ARTEN.find(a => a.art === art)?.name ?? art;
export const artFarbe = (art: Art) => ARTEN.find(a => a.art === art)?.farbe ?? '#3f3f46';

export async function grundversorgungLaden(lat: number, lon: number): Promise<Ort[]> {
  const { data, error } = await supabase.rpc('grundversorgung_in_der_naehe', { p_lat: lat, p_lon: lon, p_radius_m: UMKREIS_M });
  if (error) throw error;
  return (data ?? []) as Ort[];
}
