// Suchfilter wie bei ImmoScout/Immowelt, plus ÖPNV-Linien mit Umkreis.
import { Linie } from './oepnv';

export interface Ort {
  name: string;          // Anzeige, z. B. "Berlin" oder "Potsdam, Brandenburg"
  lat: number;
  lon: number;
  // Ausdehnung des Orts [minLon, minLat, maxLon, maxLat], wenn Photon sie liefert
  ausdehnung?: [number, number, number, number];
  kurzname?: string;     // nur der Ortsname, z. B. "Berlin"
  osmRelation?: number;  // OSM-Relation des Orts, für die Bezirksliste
}

// Bezirk oder Ortsteil einer Stadt (OSM-Relation), Grenze wird beim Auswählen geladen
export interface Bezirk {
  id: number;            // OSM-Relations-ID
  name: string;
  // GeoJSON-Geometrie (Polygon oder MultiPolygon) in [lon, lat]
  grenze?: { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
}

export interface Filter {
  transaktion: 'mieten' | 'kaufen' | 'tauschen';
  immobilientyp: 'wohnung' | 'haus';
  objektarten: string[];
  ort: Ort | null;
  umkreisKm: number;             // 0 = nur der Ort selbst
  bezirke: Bezirk[];             // gewählte Bezirke des Orts, leer = ganzer Ort
  preisMin: string; preisMax: string;
  preisArt: 'kalt' | 'warm';     // nur bei Miete
  zimmerMin: string; zimmerMax: string;
  flaecheMin: string; flaecheMax: string;
  ausstattung: string[];
  baujahrMin: string; baujahrMax: string;
  etageMin: string; etageMax: string;
  bezugsfreiBis: string;         // Datum yyyy-mm-dd, leer = egal
  energieMindestens: string;     // z. B. 'C' = A+ bis C, leer = egal
  wbs: 'egal' | 'ohne' | 'nur';
  linien: Linie[];
  linienUmkreisM: string;
  sortierung: string;
}

export const STANDARD_FILTER: Filter = {
  transaktion: 'mieten',
  immobilientyp: 'wohnung',
  objektarten: [],
  ort: null,
  umkreisKm: 0,
  bezirke: [],
  preisMin: '', preisMax: '',
  preisArt: 'kalt',
  zimmerMin: '', zimmerMax: '',
  flaecheMin: '', flaecheMax: '',
  ausstattung: [],
  baujahrMin: '', baujahrMax: '',
  etageMin: '', etageMax: '',
  bezugsfreiBis: '',
  energieMindestens: '',
  wbs: 'egal',
  linien: [],
  linienUmkreisM: '600',
  sortierung: 'neueste',
};

export const OBJEKTARTEN: Record<Filter['immobilientyp'], { wert: string; name: string }[]> = {
  wohnung: [
    { wert: 'etagenwohnung', name: 'Etagenwohnung' },
    { wert: 'dachgeschoss', name: 'Dachgeschoss' },
    { wert: 'maisonette', name: 'Maisonette' },
    { wert: 'penthouse', name: 'Penthouse' },
    { wert: 'erdgeschoss', name: 'Erdgeschoss' },
    { wert: 'souterrain', name: 'Souterrain' },
    { wert: 'loft', name: 'Loft' },
  ],
  haus: [
    { wert: 'einfamilienhaus', name: 'Einfamilienhaus' },
    { wert: 'mehrfamilienhaus', name: 'Mehrfamilienhaus' },
    { wert: 'reihenhaus', name: 'Reihenhaus' },
    { wert: 'doppelhaushaelfte', name: 'Doppelhaushälfte' },
    { wert: 'bungalow', name: 'Bungalow' },
    { wert: 'villa', name: 'Villa' },
  ],
};

// Spaltenname in anzeigen -> Anzeigename
export const AUSSTATTUNG: { wert: string; name: string }[] = [
  { wert: 'balkon_terrasse', name: 'Balkon/Terrasse' },
  { wert: 'einbaukueche', name: 'Einbauküche' },
  { wert: 'aufzug', name: 'Aufzug' },
  { wert: 'keller', name: 'Keller' },
  { wert: 'garten', name: 'Garten' },
  { wert: 'stellplatz', name: 'Stellplatz/Garage' },
  { wert: 'barrierefrei', name: 'Barrierefrei' },
  { wert: 'haustiere_erlaubt', name: 'Haustiere erlaubt' },
  { wert: 'moebliert', name: 'Möbliert' },
];

export const ENERGIEKLASSEN = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export const UMKREISE_KM = [0, 1, 2, 5, 10, 20, 50];

export const SORTIERUNGEN: { wert: string; name: string; nurMitLinien?: boolean }[] = [
  { wert: 'neueste', name: 'Neueste zuerst' },
  { wert: 'preis_auf', name: 'Preis aufsteigend' },
  { wert: 'preis_ab', name: 'Preis absteigend' },
  { wert: 'flaeche_ab', name: 'Fläche absteigend' },
  { wert: 'zimmer_ab', name: 'Zimmer absteigend' },
  { wert: 'haltestelle', name: 'Nächste Haltestelle zuerst', nurMitLinien: true },
];

// Zahl der gesetzten Filter im Bereich "Weitere Filter"
export function weitereFilterAnzahl(f: Filter): number {
  return f.objektarten.length + f.ausstattung.length + [
    f.baujahrMin || f.baujahrMax,
    f.etageMin || f.etageMax,
    f.bezugsfreiBis,
    f.energieMindestens,
    f.wbs !== 'egal',
  ].filter(Boolean).length;
}

// Luftlinie in Metern
export function entfernungM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
