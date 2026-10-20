// Bezirke, Ortsteile und Ortsgrenzen aus OpenStreetMap.
// Normalerweise aus vorab erzeugten Dateien unter public/gebiete (siehe scripts/gebiete/gebiete_bauen.py),
// die mit der Seite ausgeliefert werden und sofort da sind. Fehlen sie, fragen wir Overpass und Nominatim.
import { Bezirk, Ort } from './filter';

// '/ImmoBerlin' ist der basePath aus next.config.ts
export const GEBIETE_URL = '/ImmoBerlin/gebiete';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/lookup';

export interface BezirkEintrag extends Bezirk {
  ebene: 'bezirk' | 'ortsteil';   // admin_level 9 bzw. 10
}

const listenCache: Record<number, Promise<BezirkEintrag[]>> = {};
const grenzenCache: Record<number, Promise<Bezirk['grenze']>> = {};

// Bezirkslisten ändern sich selten: im Browser für eine Woche merken, dann ist die Liste beim nächsten Besuch sofort da
const SPEICHER_DAUER_MS = 7 * 24 * 3600 * 1000;
function gemerkt<T>(schluessel: string): T | null {
  try {
    const eintrag = JSON.parse(localStorage.getItem(schluessel) ?? 'null');
    return eintrag && Date.now() - eintrag.zeit < SPEICHER_DAUER_MS ? eintrag.wert : null;
  } catch { return null; }
}
function merken(schluessel: string, wert: unknown) {
  try { localStorage.setItem(schluessel, JSON.stringify({ zeit: Date.now(), wert })); } catch { /* Speicher voll oder gesperrt */ }
}

// Gibt es die vorab erzeugten Dateien? Einmal je Seitenaufruf geprüft.
let dateienDa: Promise<boolean> | null = null;
export function gebietsdateienVorhanden() {
  dateienDa ??= fetch(`${GEBIETE_URL}/stand.json`).then(a => a.ok).catch(() => false);
  return dateienDa;
}

// Liest eine vorab erzeugte Datei. null heißt: gibt es nicht (z. B. Ort ohne Bezirke).
async function gebietsdatei<T>(pfad: string): Promise<T | null> {
  const antwort = await fetch(`${GEBIETE_URL}/${pfad}`);
  if (antwort.status === 404) return null;
  if (!antwort.ok) throw new Error(`${pfad}: ${antwort.status}`);
  return antwort.json();
}

// Bezirke (admin_level 9) und Ortsteile (admin_level 10) innerhalb der Stadtgrenze
export function bezirkeLaden(ort: Ort): Promise<BezirkEintrag[]> {
  const id = ort.osmRelation;
  if (!id) return Promise.resolve([]);
  if (!listenCache[id]) {
    listenCache[id] = gebietsdateienVorhanden().then(async da => {
      if (da) return (await gebietsdatei<BezirkEintrag[]>(`l/${id}.json`)) ?? [];
      return bezirkeAusOverpass(ort, id);
    });
    listenCache[id].catch(() => { delete listenCache[id]; });
  }
  return listenCache[id];
}

// Rückfall ohne vorab erzeugte Dateien: langsam, je nach Auslastung des kostenlosen Dienstes
function bezirkeAusOverpass(ort: Ort, id: number): Promise<BezirkEintrag[]> {
  const vorhanden = gemerkt<BezirkEintrag[]>(`bezirke:${id}`);
  if (vorhanden) return Promise.resolve(vorhanden);
  const abfrage = `[out:json][timeout:25];area(id:${3600000000 + id})->.stadt;` +
    `rel(area.stadt)["boundary"="administrative"]["admin_level"~"^(9|10)$"];out tags center;`;
  return fetch(OVERPASS_URL, { method: 'POST', body: 'data=' + encodeURIComponent(abfrage), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    .then(antwort => {
      if (!antwort.ok) throw new Error(`Overpass antwortet mit ${antwort.status}`);
      return antwort.json();
    })
    .then(daten => {
      const e = ort.ausdehnung;
      const liste: BezirkEintrag[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const el of daten.elements as any[]) {
        const name = el.tags?.name;
        if (!name) continue;
        // Nachbarorte teilen Grenzlinien mit der Stadt und landen deshalb mit in der Antwort.
        // Ihr Mittelpunkt liegt aber außerhalb der Stadt.
        const c = el.center;
        if (e && c && (c.lon < e[0] || c.lat < e[1] || c.lon > e[2] || c.lat > e[3])) continue;
        liste.push({ id: el.id, name, ebene: el.tags.admin_level === '9' ? 'bezirk' : 'ortsteil' });
      }
      liste.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      merken(`bezirke:${id}`, liste);
      return liste;
    });
}

// Grenze eines Bezirks oder Orts (OSM-Relation) als GeoJSON, vereinfacht auf etwa 10 m
export async function bezirksgrenzeLaden(bezirk: Bezirk): Promise<Bezirk> {
  const id = bezirk.id;
  if (!grenzenCache[id]) {
    grenzenCache[id] = (async () => {
      if (await gebietsdateienVorhanden()) {
        const g = await gebietsdatei<Bezirk['grenze']>(`g/${id}.json`);
        if (g) return g;
      }
      const vorhanden = gemerkt<Bezirk['grenze']>(`grenze:${id}`);
      if (vorhanden) return vorhanden;
      const antwort = await fetch(`${NOMINATIM_URL}?osm_ids=R${id}&format=geojson&polygon_geojson=1&polygon_threshold=0.0001`);
      if (!antwort.ok) throw new Error(`Nominatim antwortet mit ${antwort.status}`);
      const daten = await antwort.json();
      const g = daten.features?.[0]?.geometry;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) throw new Error(`Keine Grenze für ${bezirk.name}`);
      merken(`grenze:${id}`, g);
      return g;
    })();
    grenzenCache[id].catch(() => { delete grenzenCache[id]; });
  }
  return { id, name: bezirk.name, grenze: await grenzenCache[id] };
}

function ringe(grenze: NonNullable<Bezirk['grenze']>): number[][][][] {
  return grenze.type === 'Polygon' ? [grenze.coordinates] : grenze.coordinates;
}

// Umschließendes Rechteck [minLon, minLat, maxLon, maxLat] aller Bezirke
export function bezirkeAusdehnung(bezirke: Bezirk[]): [number, number, number, number] | null {
  let r: [number, number, number, number] | null = null;
  for (const b of bezirke) {
    if (!b.grenze) continue;
    for (const polygon of ringe(b.grenze)) for (const [lon, lat] of polygon[0]) {
      r = r ? [Math.min(r[0], lon), Math.min(r[1], lat), Math.max(r[2], lon), Math.max(r[3], lat)] : [lon, lat, lon, lat];
    }
  }
  return r;
}

// Strahlverfahren: liegt der Punkt in einem der Polygone (Löcher berücksichtigt)?
export function inBezirken(lat: number, lon: number, bezirke: Bezirk[]): boolean {
  const imRing = (ring: number[][]) => {
    let innen = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) innen = !innen;
    }
    return innen;
  };
  return bezirke.some(b => b.grenze && ringe(b.grenze).some(([aussen, ...loecher]) => imRing(aussen) && !loecher.some(imRing)));
}
