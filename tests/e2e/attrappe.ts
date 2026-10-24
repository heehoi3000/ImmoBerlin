// Ersatz für Supabase und fremde Dienste in den Browser-Tests. Alle Anfragen werden im Browser abgefangen,
// die echte Datenbank wird nie berührt. Gefiltert wird so weit, wie die Seite PostgREST-Filter benutzt.
import type { Page, Route } from '@playwright/test';

export const SUPABASE = 'http://supabase.test';

type Zeile = Record<string, unknown>;

export interface Daten {
  anzeigen: Zeile[];
  linien: Zeile[];
  haltestellen: Record<number, Zeile[]>;     // je linie_id
  naheLinien: Record<number, string[]>;     // je linie_id: ids der Anzeigen im Umkreis
  naheHalte?: Zeile[];                      // Antwort von haltestellen_in_der_naehe (Inseratsseite)
  grundversorgung?: Zeile[];                // Antwort von grundversorgung_in_der_naehe (Inseratsseite)
  tauschWuensche?: Zeile[];                 // Tabelle tausch_wuensche
  tauschPartner?: Zeile[];                  // Antwort von tausch_partner
}

export interface Aufzeichnung {
  nachrichten: Zeile[];
  neueAnzeigen: Zeile[];
  rpc: { name: string; body: Zeile }[];
  wuensche: Zeile[];                        // gespeicherte Tauschwünsche (upsert)
}

export const NUTZER = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.org' };

// PostgREST-Filter wie "preis=lte.800" auf eine Zeile anwenden (nur die Operatoren, die die Seite nutzt)
function passt(zeile: Zeile, spalte: string, ausdruck: string): boolean {
  const punkt = ausdruck.indexOf('.');
  const op = ausdruck.slice(0, punkt), wert = ausdruck.slice(punkt + 1);
  const v = zeile[spalte];
  switch (op) {
    case 'eq': return String(v) === wert;
    case 'gte': return v !== null && v !== undefined && Number(v) >= Number(wert);
    case 'lte': return v !== null && v !== undefined && Number(v) <= Number(wert);
    case 'in': return wert.slice(1, -1).split(',').map(w => w.replace(/^"|"$/g, '')).includes(String(v));
    default: return true;   // ilike, or usw. werden nicht nachgebaut
  }
}

const STEUERPARAMETER = new Set(['select', 'order', 'limit', 'offset', 'or', 'on_conflict', 'columns']);

function filtern(zeilen: Zeile[], params: URLSearchParams): Zeile[] {
  return zeilen.filter(z => [...params.entries()].every(([k, v]) => STEUERPARAMETER.has(k) || passt(z, k, v)));
}

function json(route: Route, daten: unknown, status = 200, kopf: Record<string, string> = {}) {
  return route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', ...kopf }, body: JSON.stringify(daten) });
}

// Antwort als Einzelobjekt, wenn supabase-js .single() benutzt
function ergebnis(route: Route, zeilen: Zeile[]) {
  const einzeln = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
  if (!einzeln) return json(route, zeilen);
  return zeilen.length === 1 ? json(route, zeilen[0]) : json(route, { code: 'PGRST116', message: 'no rows' }, 406);
}

export async function attrappeEinrichten(page: Page, daten: Daten): Promise<Aufzeichnung> {
  const auf: Aufzeichnung = { nachrichten: [], neueAnzeigen: [], rpc: [], wuensche: [] };

  await page.route(`${SUPABASE}/**`, async route => {
    const req = route.request();
    const url = new URL(req.url());
    const pfad = url.pathname;
    if (req.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    }
    const body = req.postData() ? JSON.parse(req.postData()!) : {};

    if (pfad.startsWith('/rest/v1/rpc/')) {
      const name = pfad.slice('/rest/v1/rpc/'.length);
      auf.rpc.push({ name, body });
      const ids: number[] = body.linien_ids ?? [];
      if (name === 'anzeigen_nahe_linien') {
        const nahe = new Set(ids.flatMap(id => daten.naheLinien[id] ?? []));
        return json(route, filtern(daten.anzeigen.filter(a => nahe.has(String(a.id))), url.searchParams));
      }
      if (name === 'haltestellen_der_linien') return json(route, ids.flatMap(id => daten.haltestellen[id] ?? []));
      if (name === 'ist_moderator') return json(route, false);
      if (name === 'haltestellen_in_der_naehe') return json(route, daten.naheHalte ?? []);
      if (name === 'grundversorgung_in_der_naehe') return json(route, daten.grundversorgung ?? []);
      if (name === 'tausch_partner') return json(route, daten.tauschPartner ?? []);
      return json(route, []);
    }

    if (pfad === '/rest/v1/anzeigen') {
      if (req.method() === 'POST') {
        const zeile = { ...body, id: 'neu-1' };
        auf.neueAnzeigen.push(zeile);
        return ergebnis(route, [{ id: zeile.id }]);
      }
      return ergebnis(route, filtern(daten.anzeigen, url.searchParams));
    }
    if (pfad === '/rest/v1/tausch_wuensche') {
      if (req.method() === 'POST') { auf.wuensche.push(body); return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } }); }
      if (req.method() === 'DELETE') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
      return ergebnis(route, filtern(daten.tauschWuensche ?? [], url.searchParams));
    }
    if (pfad === '/rest/v1/oepnv_linien') {
      // Die Seite sucht mit ilike; hier reicht: Nummer beginnt mit dem Suchbegriff
      const begriff = (url.searchParams.get('nummer') ?? url.searchParams.get('or') ?? '')
        .replace(/^ilike\./, '').replace(/^\(nummer\.ilike\./, '').split(/[*,]/)[0].toLowerCase();
      return json(route, daten.linien.filter(l => String(l.nummer).toLowerCase().startsWith(begriff)));
    }
    if (pfad === '/rest/v1/nachrichten') {
      if (req.method() === 'POST') { auf.nachrichten.push(body); return route.fulfill({ status: 201, headers: { 'Access-Control-Allow-Origin': '*' } }); }
      return json(route, [], 200, { 'Content-Range': '*/0' });
    }
    if (pfad.startsWith('/auth/v1/')) return json(route, { message: 'nicht nachgebaut' }, 400);
    return json(route, []);
  });

  // Karte, Geocoder und Overpass gibt es in den Tests nicht; die Seite muss ohne sie bedienbar bleiben
  await page.route(/^https:\/\/(tiles\.openfreemap\.org|photon\.komoot\.io|overpass-api\.de|nominatim\.openstreetmap\.org)\//, route => {
    const url = route.request().url();
    if (url.startsWith('https://photon.komoot.io/api/')) {
      return json(route, { features: [{
        geometry: { coordinates: [13.4024, 52.5309] },
        properties: { name: 'Torstraße', housenumber: '1', postcode: '10119', city: 'Berlin', district: 'Mitte' },
      }] });
    }
    return route.abort();
  });

  // Vorab erzeugte Ortsdaten (sonst aus dem Branch "gebiete"): Berlin mit zwei Bezirken
  const berlin = { n: 'Berlin', k: 'Berlin', a: 52.517, o: 13.389, b: [13.088, 52.338, 13.761, 52.675], r: 62422, w: 3_800_000 };
  const gebiete: Record<string, unknown> = {
    'stand.json': { stand: 'test' },
    'o/_1.json': { b: [berlin] },
    'o/be.json': [berlin],
    'l/62422.json': [{ id: 1, name: 'Mitte', ebene: 'bezirk' }, { id: 2, name: 'Pankow', ebene: 'bezirk' }],
    // Pankow als Rechteck um 52.55 N: enthält nur a2 aus STANDARD_DATEN
    'g/2.json': { type: 'Polygon', coordinates: [[[13.3, 52.54], [13.5, 52.54], [13.5, 52.6], [13.3, 52.6], [13.3, 52.54]]] },
  };
  await page.route('**/gebiete/**', route => {
    const teil = new URL(route.request().url()).pathname.replace(/^.*\/gebiete\//, '');
    return teil in gebiete ? json(route, gebiete[teil]) : route.fulfill({ status: 404, body: '' });
  });

  return auf;
}

// Angemeldeten Nutzer vortäuschen: supabase-js liest die Sitzung aus dem localStorage
export async function anmelden(page: Page) {
  const sitzung = {
    access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: NUTZER.id, email: NUTZER.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  };
  await page.addInitScript(s => localStorage.setItem('sb-supabase-auth-token', s), JSON.stringify(sitzung));
}

// Beispieldaten
export function anzeige(id: string, teil: Zeile = {}): Zeile {
  return {
    id, titel: `Wohnung ${id}`, transaktions_typ: 'mieten', immobilien_typ: 'wohnung', status: 'aktiv',
    preis: 800, warmmiete: 1000, zimmer: 2, quadratmeter: 60, koordinate_lat: 52.53, koordinate_lon: 13.40,
    ort: 'Berlin', plz: '10115', bezirk: 'Mitte', adresse: 'Teststraße 1', bilder: [], inserent_id: 'jemand',
    erstellt_am: '2026-10-01T10:00:00Z', ...teil,
  };
}

export const STANDARD_DATEN: Daten = {
  anzeigen: [
    anzeige('a1', { titel: 'Altbau an der U8', preis: 750 }),
    anzeige('a2', { titel: 'Neubau mit Balkon', preis: 1200, koordinate_lat: 52.55 }),
    anzeige('a3', { titel: 'Kleine Wohnung', preis: 500, zimmer: 1, koordinate_lat: 52.50 }),
  ],
  linien: [
    { linie_id: 8, typ: 'ubahn', nummer: 'U8', betreiber: 'BVG', endpunkte: 'S+U Wittenau – S+U Hermannstr.', mitte: null },
    { linie_id: 80, typ: 'bus', nummer: 'U80', betreiber: 'Testbus', endpunkte: 'A – B', mitte: null },
  ],
  haltestellen: { 8: [{ stop_id: 's1', name: 'U Bernauer Str.', lat: 52.5375, lon: 13.3963 }] },
  naheLinien: { 8: ['a1', 'a3'] },
  // Um a1 (52.53, 13.40): U8 auf zwei Bahnsteigen, ein Bus mit Nachtlinie und eine Tram ohne Angabe
  naheHalte: [
    { stop_id: 'h1', name: 'Wolliner Str.', lat: 52.5312, lon: 13.4010, entfernung_m: 150, barrierefrei: 'nein',
      linien: [{ linie_id: 247, typ: 'bus', nummer: '247', endpunkte: 'S Nordbahnhof – U Leopoldplatz', fahrten: 28 },
               { linie_id: 908, typ: 'bus', nummer: 'N8', endpunkte: 'U Osloer Str. – U Hermannplatz', fahrten: 0 }] },
    { stop_id: 'h2', name: 'U Bernauer Str. Bstggl.1', lat: 52.5375, lon: 13.3963, entfernung_m: 870, barrierefrei: 'ja',
      linien: [{ linie_id: 8, typ: 'ubahn', nummer: 'U8', endpunkte: 'S+U Wittenau – S+U Hermannstr.', fahrten: 168 }] },
    { stop_id: 'h3', name: 'U Bernauer Str. Bstggl.2', lat: 52.5376, lon: 13.3964, entfernung_m: 880, barrierefrei: 'ja',
      linien: [{ linie_id: 8, typ: 'ubahn', nummer: 'U8', endpunkte: 'S+U Wittenau – S+U Hermannstr.', fahrten: 167 }] },
    { stop_id: 'h4', name: 'Arkonaplatz', lat: 52.5350, lon: 13.4020, entfernung_m: 560, barrierefrei: null,
      linien: [{ linie_id: 10, typ: 'tram', nummer: 'M10', endpunkte: 'Hauptbahnhof – Warschauer Str.', fahrten: 84 }] },
  ],
  // Um a1: Supermarkt, Apotheke, Kita und Park, sonst nichts im Umkreis
  grundversorgung: [
    { art: 'apotheke', name: 'Linden-Apotheke', lat: 52.5305, lon: 13.4005, entfernung_m: 90 },
    { art: 'supermarkt', name: 'Rewe', lat: 52.5315, lon: 13.4010, entfernung_m: 180 },
    { art: 'kita', name: 'Kita Sonnenschein', lat: 52.5302, lon: 13.4020, entfernung_m: 140 },
    { art: 'park', name: 'Weinbergspark', lat: 52.5298, lon: 13.3995, entfernung_m: 60 },
  ],
};
