// Fragt die Anzeigen passend zu den Filtern bei Supabase ab.
import { supabase } from './supabase';
import { Filter, ENERGIEKLASSEN, entfernungM } from './filter';
import { bezirkeAusdehnung, inBezirken } from './bezirke';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Anzeige = Record<string, any> & { id: string; koordinate_lat: number; koordinate_lon: number };
export interface Haltestelle { stop_id: string; name: string; lat: number; lon: number; }
export interface NaechsteHaltestelle { anzeige_id: string; distanz_m: number; haltestelle: string; linie: string; }

export interface Suchergebnis {
  anzeigen: Anzeige[];
  haltestellen: Haltestelle[];
  naechste: Record<string, NaechsteHaltestelle>;
}

// Umkreis um die Haltestellen in Metern, auf 50 bis 5000 m begrenzt
export function linienUmkreisM(eingabe?: string) {
  return Math.min(Math.max(parseInt(eingabe || '') || 600, 50), 5000);
}

// Prüft einmal, ob die Spalten aus supabase/anzeigen_filter.sql schon existieren.
// Ohne sie blendet die Seite die Filter für Ausstattung, Baujahr usw. aus.
export async function erweiterteFelderVorhanden(): Promise<boolean> {
  const { error } = await supabase.from('anzeigen').select('warmmiete, objektart, erstellt_am').limit(1);
  return !error;
}

function zahl(eingabe: string) {
  const n = parseFloat(eingabe.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export async function anzeigenSuchen(f: Filter, erweitert: boolean): Promise<Suchergebnis> {
  const linienIds = f.linien.map(l => l.linie_id);
  const radius = linienUmkreisM(f.linienUmkreisM);

  // Mit Linien sucht Supabase die Anzeigen im Umkreis der Haltestellen (PostGIS),
  // alle anderen Filter hängen an derselben Abfrage.
  let query = linienIds.length > 0
    ? supabase.rpc('anzeigen_nahe_linien', { linien_ids: linienIds, radius_m: radius }).select('*') as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>
    : supabase.from('anzeigen').select('*');

  query = query.eq('transaktions_typ', f.transaktion).eq('immobilien_typ', f.immobilientyp);

  const preisSpalte = erweitert && f.transaktion === 'mieten' && f.preisArt === 'warm' ? 'warmmiete' : 'preis';
  const bereiche: [string, string, string][] = [
    [preisSpalte, f.preisMin, f.preisMax],
    ['zimmer', f.zimmerMin, f.zimmerMax],
    ['quadratmeter', f.flaecheMin, f.flaecheMax],
  ];
  if (erweitert) {
    bereiche.push(['baujahr', f.baujahrMin, f.baujahrMax]);
    if (f.immobilientyp === 'wohnung') bereiche.push(['etage', f.etageMin, f.etageMax]);
  }
  for (const [spalte, min, max] of bereiche) {
    const von = zahl(min), bis = zahl(max);
    if (von !== null) query = query.gte(spalte, von);
    if (bis !== null) query = query.lte(spalte, bis);
  }

  // Ort mit Umkreis: grob über ein Rechteck in der Datenbank, genau danach im Browser
  let kreis: { lat: number; lon: number; m: number } | null = null;
  // Mit Bezirken genau innerhalb ihrer Grenzen: Rechteck in der Datenbank, Polygon im Browser
  const bezirke = f.ort ? f.bezirke.filter(b => b.grenze) : [];
  const bezirkRechteck = bezirkeAusdehnung(bezirke);
  if (bezirkRechteck) {
    const [minLon, minLat, maxLon, maxLat] = bezirkRechteck;
    query = query.gte('koordinate_lat', minLat).lte('koordinate_lat', maxLat)
      .gte('koordinate_lon', minLon).lte('koordinate_lon', maxLon);
  } else if (f.ort) {
    let [minLon, minLat, maxLon, maxLat] = f.ort.ausdehnung ?? [f.ort.lon, f.ort.lat, f.ort.lon, f.ort.lat];
    if (f.umkreisKm > 0 || !f.ort.ausdehnung) {
      const km = f.umkreisKm > 0 ? f.umkreisKm : 2;
      kreis = { lat: f.ort.lat, lon: f.ort.lon, m: km * 1000 };
      const dLat = km / 111.32;
      const dLon = km / (111.32 * Math.cos(f.ort.lat * Math.PI / 180));
      minLat = f.ort.lat - dLat; maxLat = f.ort.lat + dLat;
      minLon = f.ort.lon - dLon; maxLon = f.ort.lon + dLon;
    }
    query = query.gte('koordinate_lat', minLat).lte('koordinate_lat', maxLat)
      .gte('koordinate_lon', minLon).lte('koordinate_lon', maxLon);
  }

  if (erweitert) {
    if (f.objektarten.length > 0) query = query.in('objektart', f.objektarten);
    for (const spalte of f.ausstattung) query = query.eq(spalte, true);
    if (f.bezugsfreiBis) query = query.or(`verfuegbar_ab.is.null,verfuegbar_ab.lte.${f.bezugsfreiBis}`);
    if (f.energieMindestens) {
      query = query.in('energieeffizienzklasse', ENERGIEKLASSEN.slice(0, ENERGIEKLASSEN.indexOf(f.energieMindestens) + 1));
    }
    if (f.transaktion === 'mieten' && f.wbs !== 'egal') query = query.eq('wbs_erforderlich', f.wbs === 'nur');
  }

  const sortierung: Record<string, [string, boolean]> = {
    neueste: [erweitert ? 'erstellt_am' : 'preis', !erweitert],
    preis_auf: [preisSpalte, true],
    preis_ab: [preisSpalte, false],
    flaeche_ab: ['quadratmeter', false],
    zimmer_ab: ['zimmer', false],
  };
  const [spalte, aufsteigend] = sortierung[f.sortierung] ?? sortierung.neueste;
  query = query.order(spalte, { ascending: aufsteigend, nullsFirst: false });

  const [anzeigenRes, haltRes, naechsteRes] = await Promise.all([
    query,
    linienIds.length > 0 ? supabase.rpc('haltestellen_der_linien', { linien_ids: linienIds }) : null,
    linienIds.length > 0 ? supabase.rpc('anzeigen_naechste_haltestelle', { linien_ids: linienIds, radius_m: radius }) : null,
  ]);
  if (anzeigenRes.error) throw anzeigenRes.error;
  if (haltRes?.error) console.error("Fehler beim Laden der Haltestellen:", haltRes.error);
  if (naechsteRes?.error) console.error("Fehler beim Laden der Entfernungen:", naechsteRes.error);

  let anzeigen = ((anzeigenRes.data as Anzeige[]) || []).filter(a => a.koordinate_lat && a.koordinate_lon);
  if (kreis) {
    const k = kreis;
    anzeigen = anzeigen.filter(a => entfernungM(k.lat, k.lon, a.koordinate_lat, a.koordinate_lon) <= k.m);
  }
  if (bezirkRechteck) anzeigen = anzeigen.filter(a => inBezirken(a.koordinate_lat, a.koordinate_lon, bezirke));

  const naechste: Record<string, NaechsteHaltestelle> = {};
  for (const n of (naechsteRes?.data as NaechsteHaltestelle[]) || []) naechste[n.anzeige_id] = n;
  if (f.sortierung === 'haltestelle' && linienIds.length > 0) {
    anzeigen.sort((a, b) => (naechste[a.id]?.distanz_m ?? Infinity) - (naechste[b.id]?.distanz_m ?? Infinity));
  }

  return { anzeigen, haltestellen: (haltRes?.data as Haltestelle[]) || [], naechste };
}
