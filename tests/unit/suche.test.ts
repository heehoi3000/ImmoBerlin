import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STANDARD_FILTER, Filter } from '../../lib/filter';
import { anzeigenSuchen, linienUmkreisM } from '../../lib/suche';

// Fängt alle Anfragen an Supabase ab und merkt sich die Adressen
let anfragen: URL[] = [];
let antworten: Record<string, unknown> = {};

beforeEach(() => {
  anfragen = [];
  antworten = {};
  vi.stubGlobal('fetch', vi.fn(async (eingabe: string | URL | Request) => {
    const url = new URL(typeof eingabe === 'string' ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url);
    anfragen.push(url);
    const daten = antworten[url.pathname] ?? [];
    return new Response(JSON.stringify(daten), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

const anzeige = (id: string, lat: number, lon: number) => ({ id, koordinate_lat: lat, koordinate_lon: lon, preis: 700 });
const parameter = (pfad: string) => anfragen.find(a => a.pathname === pfad)!.searchParams;

describe('linienUmkreisM', () => {
  it.each([['', 600], ['abc', 600], ['10', 50], ['800', 800], ['99999', 5000]])('"%s" → %i m', (eingabe, m) => {
    expect(linienUmkreisM(eingabe)).toBe(m);
  });
});

describe('anzeigenSuchen', () => {
  it('fragt Miete, Wohnung und Preisgrenzen ab', async () => {
    const f: Filter = { ...STANDARD_FILTER, preisMin: '500', preisMax: '1000,5', zimmerMin: '2' };
    await anzeigenSuchen(f, false);
    const p = parameter('/rest/v1/anzeigen');
    expect(p.get('transaktions_typ')).toBe('eq.mieten');
    expect(p.get('immobilien_typ')).toBe('eq.wohnung');
    expect(p.getAll('preis')).toEqual(['gte.500', 'lte.1000.5']);
    expect(p.get('zimmer')).toBe('gte.2');
  });

  it('Warmmiete und weitere Filter nur mit erweiterten Spalten', async () => {
    const f: Filter = { ...STANDARD_FILTER, preisArt: 'warm', preisMax: '900', ausstattung: ['aufzug'], wbs: 'ohne', energieMindestens: 'B' };
    await anzeigenSuchen(f, true);
    const p = parameter('/rest/v1/anzeigen');
    expect(p.get('warmmiete')).toBe('lte.900');
    expect(p.get('aufzug')).toBe('eq.true');
    expect(p.get('wbs_erforderlich')).toBe('eq.false');
    expect(p.get('energieeffizienzklasse')).toBe('in.(A+,A,B)');
  });

  it('mit Linien sucht die Datenbankfunktion im Umkreis der Haltestellen', async () => {
    const f: Filter = { ...STANDARD_FILTER, linien: [{ linie_id: 7, typ: 'ubahn', nummer: 'U8', betreiber: 'BVG', endpunkte: '' }], linienUmkreisM: '400' };
    await anzeigenSuchen(f, false);
    const rpc = anfragen.filter(a => a.pathname.startsWith('/rest/v1/rpc/')).map(a => a.pathname);
    expect(rpc).toContain('/rest/v1/rpc/anzeigen_nahe_linien');
    expect(rpc).toContain('/rest/v1/rpc/haltestellen_der_linien');
    expect(rpc).toContain('/rest/v1/rpc/anzeigen_naechste_haltestelle');
  });

  it('Ort mit Umkreis: genaue Entfernung wird im Browser geprüft', async () => {
    antworten['/rest/v1/anzeigen'] = [
      anzeige('nah', 52.52, 13.405),          // ca. 0,3 km vom Mittelpunkt
      anzeige('fern', 52.52, 13.48),          // ca. 5 km, liegt im Rechteck, aber außerhalb des Kreises
      anzeige('ohne-lage', 0, 0),
    ];
    const f: Filter = { ...STANDARD_FILTER, ort: { name: 'Berlin', lat: 52.52, lon: 13.40 }, umkreisKm: 2 };
    const { anzeigen } = await anzeigenSuchen(f, false);
    expect(anzeigen.map(a => a.id)).toEqual(['nah']);
    expect(parameter('/rest/v1/anzeigen').getAll('koordinate_lat')).toHaveLength(2);
  });

  it('mit Bezirken nur Anzeigen innerhalb der Grenze', async () => {
    antworten['/rest/v1/anzeigen'] = [anzeige('drin', 52.5, 13.3), anzeige('draussen', 52.5, 13.95)];
    const f: Filter = {
      ...STANDARD_FILTER,
      ort: { name: 'Berlin', lat: 52.52, lon: 13.40, osmRelation: 62422 },
      bezirke: [{ id: 1, name: 'Dreieck', grenze: { type: 'Polygon', coordinates: [[[13, 52], [14, 52], [13, 53], [13, 52]]] } }],
    };
    const { anzeigen } = await anzeigenSuchen(f, false);
    expect(anzeigen.map(a => a.id)).toEqual(['drin']);
  });

  it('sortiert nach nächster Haltestelle', async () => {
    antworten['/rest/v1/rpc/anzeigen_nahe_linien'] = [anzeige('a', 52.5, 13.4), anzeige('b', 52.5, 13.4)];
    antworten['/rest/v1/rpc/anzeigen_naechste_haltestelle'] = [
      { anzeige_id: 'a', distanz_m: 500, haltestelle: 'X', linie: 'U8' },
      { anzeige_id: 'b', distanz_m: 120, haltestelle: 'Y', linie: 'U8' },
    ];
    const f: Filter = { ...STANDARD_FILTER, sortierung: 'haltestelle', linien: [{ linie_id: 7, typ: 'ubahn', nummer: 'U8', betreiber: 'BVG', endpunkte: '' }] };
    const { anzeigen, naechste } = await anzeigenSuchen(f, false);
    expect(anzeigen.map(a => a.id)).toEqual(['b', 'a']);
    expect(naechste.b.distanz_m).toBe(120);
  });
});
