// Bezirke und Ortsteile einer Stadt aus OpenStreetMap (kostenlos, ohne Schlüssel).
// Liste: Overpass API, Grenzen: Nominatim. Beide werden nur bei Bedarf und je Stadt einmal abgefragt.
import { Bezirk, Ort } from './filter';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/lookup';

export interface BezirkEintrag extends Bezirk {
  ebene: 'bezirk' | 'ortsteil';   // admin_level 9 bzw. 10
}

const listenCache: Record<number, Promise<BezirkEintrag[]>> = {};
const grenzenCache: Record<number, Bezirk['grenze']> = {};

// Bezirke (admin_level 9) und Ortsteile (admin_level 10) innerhalb der Stadtgrenze
export function bezirkeLaden(ort: Ort): Promise<BezirkEintrag[]> {
  const id = ort.osmRelation;
  if (!id) return Promise.resolve([]);
  if (!listenCache[id]) {
    const abfrage = `[out:json][timeout:25];area(id:${3600000000 + id})->.stadt;` +
      `rel(area.stadt)["boundary"="administrative"]["admin_level"~"^(9|10)$"];out tags center;`;
    listenCache[id] = fetch(OVERPASS_URL, { method: 'POST', body: 'data=' + encodeURIComponent(abfrage), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
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
        return liste;
      })
      .catch(err => { delete listenCache[id]; throw err; });
  }
  return listenCache[id];
}

// Grenze eines Bezirks oder Orts (OSM-Relation) als GeoJSON, vereinfacht auf etwa 10 m
export async function bezirksgrenzeLaden(bezirk: Bezirk): Promise<Bezirk> {
  if (!grenzenCache[bezirk.id]) {
    const antwort = await fetch(`${NOMINATIM_URL}?osm_ids=R${bezirk.id}&format=geojson&polygon_geojson=1&polygon_threshold=0.0001`);
    if (!antwort.ok) throw new Error(`Nominatim antwortet mit ${antwort.status}`);
    const daten = await antwort.json();
    const g = daten.features?.[0]?.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) throw new Error(`Keine Grenze für ${bezirk.name}`);
    grenzenCache[bezirk.id] = g;
  }
  return { id: bezirk.id, name: bezirk.name, grenze: grenzenCache[bezirk.id] };
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
