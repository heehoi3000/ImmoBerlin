// Haltestellen in der Nähe eines Inserats mit Takt und Barrierefreiheit (RPC haltestellen_in_der_naehe,
// supabase/migrations/0004_oepnv_takt_barrierefrei.sql).
import { supabase } from './supabase';
import { haltestelleKurz } from './oepnv';

export type Barrierefrei = 'ja' | 'eingeschraenkt' | 'nein';

export interface NaheLinie { linie_id: number; typ: string; nummer: string; endpunkte: string; fahrten: number }

// Eine Zeile der Datenbank: ein Bahnsteig oder Haltepunkt
export interface NaherHalt {
  stop_id: string; name: string; lat: number; lon: number; entfernung_m: number;
  barrierefrei: Barrierefrei | null; linien: NaheLinie[];
}

// Eine Station für die Anzeige: alle Bahnsteige gleichen Namens zusammengefasst
export interface Station {
  name: string; lat: number; lon: number; entfernung_m: number;
  barrierefrei: Barrierefrei | null; linien: NaheLinie[];
}

// Reihenfolge der Linien in einer Station: Schiene vor Bus
const TYP_RANG: Record<string, number> = { sbahn: 0, ubahn: 1, regional: 2, fern: 3, tram: 4, bus: 5, faehre: 6, ersatzverkehr: 7, sonstige: 8 };

// Bahnsteige gleichen Kurznamens, die höchstens so weit auseinanderliegen, gehören zu einer Station
const STATION_RADIUS_M = 300;

function abstandM(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (a.lat - b.lat) * 111320;
  const dLon = (a.lon - b.lon) * 111320 * Math.cos(a.lat * Math.PI / 180);
  return Math.hypot(dLat, dLon);
}

// Bekannte Angaben der Bahnsteige zusammenfassen: alle ja → ja, alle nein → nein, sonst eingeschränkt
export function barrierefreiGesamt(werte: (Barrierefrei | null)[]): Barrierefrei | null {
  const bekannt = werte.filter((w): w is Barrierefrei => w !== null);
  if (bekannt.length === 0) return null;
  if (bekannt.every(w => w === 'ja')) return 'ja';
  if (bekannt.every(w => w === 'nein')) return 'nein';
  return 'eingeschraenkt';
}

// Bahnsteige zu Stationen zusammenfassen, die nächste zuerst. Linien ohne Abfahrt werktags tagsüber
// (Nachtlinien, nur am Wochenende) fallen weg, Halte ohne verbleibende Linie ebenso.
export function stationenBilden(halte: NaherHalt[]): Station[] {
  const gruppen: { name: string; halte: NaherHalt[] }[] = [];
  for (const roh of [...halte].sort((a, b) => a.entfernung_m - b.entfernung_m)) {
    const h = { ...roh, linien: roh.linien.filter(l => l.fahrten > 0) };
    if (h.linien.length === 0) continue;
    const name = haltestelleKurz(h.name);
    const g = gruppen.find(x => x.name === name && abstandM(x.halte[0], h) <= STATION_RADIUS_M);
    if (g) g.halte.push(h); else gruppen.push({ name, halte: [h] });
  }
  return gruppen.map(({ name, halte }) => {
    const linien: Record<number, NaheLinie> = {};
    for (const h of halte) for (const l of h.linien) {
      if (!linien[l.linie_id] || l.fahrten > linien[l.linie_id].fahrten) linien[l.linie_id] = l;
    }
    return {
      name, lat: halte[0].lat, lon: halte[0].lon, entfernung_m: halte[0].entfernung_m,
      barrierefrei: barrierefreiGesamt(halte.map(h => h.barrierefrei)),
      linien: Object.values(linien).sort((a, b) => (TYP_RANG[a.typ] ?? 9) - (TYP_RANG[b.typ] ?? 9)
        || a.nummer.localeCompare(b.nummer, 'de', { numeric: true })),
    };
  });
}

// Übliche Taktzeiten in Minuten; der berechnete Wert wird auf die nächste gerundet
const TAKTE = [2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 40, 60, 90, 120];

// Takt aus den Abfahrten werktags 6 bis 20 Uhr (840 Minuten) je Richtung, z. B. "alle 10 min"
export function taktText(fahrten: number): string | null {
  if (!fahrten || fahrten <= 0) return null;
  const minuten = 840 / fahrten;
  if (minuten > 150) return `${fahrten}× tagsüber`;
  const takt = TAKTE.reduce((best, t) => Math.abs(t - minuten) < Math.abs(best - minuten) ? t : best);
  return `alle ${takt} min`;
}

export const BARRIEREFREI_TEXT: Record<Barrierefrei, string> = {
  ja: 'Barrierefrei',
  eingeschraenkt: 'Eingeschränkt barrierefrei',
  nein: 'Nicht barrierefrei',
};

export async function stationenLaden(lat: number, lon: number, radiusM = 1000): Promise<Station[]> {
  const { data, error } = await supabase.rpc('haltestellen_in_der_naehe', { p_lat: lat, p_lon: lon, p_radius_m: radiusM });
  if (error) throw error;
  return stationenBilden((data as NaherHalt[]) || []);
}
