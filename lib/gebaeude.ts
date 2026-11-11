// Gebäude des Inserats in der 3D-Ansicht finden (Leeroy, 10.11.2026). Die Gebäude kommen aus den Kartenkacheln
// (OpenMapTiles "building"); gesucht wird das Gebäude, in dem der Punkt des Inserats liegt, sonst das nächste
// in wenigen Metern (Adresspunkte liegen manchmal am Eingang auf dem Gehweg).
// Kennungen der Kacheln taugen nicht: bei OpenFreeMap teilen sich viele Gebäude eine (ganze Blöcke wurden
// markiert), daher zählt nur die Lage.

type Ring = GeoJSON.Position[];

export const NAH_M = 12;

function polygone(f: GeoJSON.Feature): Ring[][] {
  const g = f.geometry;
  if (g?.type === 'Polygon') return [g.coordinates];
  if (g?.type === 'MultiPolygon') return g.coordinates;
  return [];
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let drin = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

// Punkt im Polygon (äußerer Ring, Löcher ausgenommen)
export function punktInPolygon(lon: number, lat: number, polygon: Ring[]): boolean {
  if (!polygon[0] || !inRing(lon, lat, polygon[0])) return false;
  return !polygon.slice(1).some(loch => inRing(lon, lat, loch));
}

// Abstand in Metern vom Punkt zum Rand der Fläche (flache Näherung)
export function abstandM(lon: number, lat: number, f: GeoJSON.Feature): number {
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540;
  let best = Infinity;
  for (const polygon of polygone(f)) for (const ring of polygon) {
    for (let j = 1; j < ring.length; j++) {
      const ax = (ring[j - 1][0] - lon) * kx, ay = (ring[j - 1][1] - lat) * ky;
      const bx = (ring[j][0] - lon) * kx, by = (ring[j][1] - lat) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

// Das Gebäude am Punkt: alle Flächen, die den Punkt enthalten (Gebäude und seine Teile), sonst die nächste bis
// NAH_M. Die Kacheln fassen gleich hohe Gebäude eines Viertels zu einem MultiPolygon zusammen (bis zu Hunderte
// Häuser), daher wird jede Fläche einzeln betrachtet. Doppelte Stücke (Kachelränder) zählen einmal.
// Leer, wenn nichts nah genug liegt.
export function gebaeudeAmPunkt(features: GeoJSON.Feature[], lon: number, lat: number): GeoJSON.Feature<GeoJSON.Polygon>[] {
  const flaechen = features.flatMap(f => polygone(f).map(p => ({
    type: 'Feature' as const, properties: f.properties ?? {}, geometry: { type: 'Polygon' as const, coordinates: p },
  })));
  const gesehen = new Set<string>();
  const einmal = (f: GeoJSON.Feature<GeoJSON.Polygon>) => {
    const k = JSON.stringify(f.geometry.coordinates) + JSON.stringify(f.properties ?? {});
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  };
  const treffer = flaechen.filter(f => polygone(f).some(p => punktInPolygon(lon, lat, p))).filter(einmal);
  if (treffer.length > 0) return treffer;
  let naechste: GeoJSON.Feature<GeoJSON.Polygon> | null = null, best = NAH_M;
  for (const f of flaechen) {
    const d = abstandM(lon, lat, f);
    if (d <= best) { best = d; naechste = f; }
  }
  return naechste ? [naechste] : [];
}

// Fläche um m Meter nach außen schieben (Löcher werden kleiner). So liegen die Wände der hervorgehobenen
// Fläche knapp vor denen der normalen Gebäudeebene und flackern nicht mit ihnen.
export function nachAussen(polygon: Ring[], m: number): Ring[] {
  if (!polygon[0]?.length) return polygon;
  const lat0 = polygon[0][0][1];
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  return polygon.map((ring, i) => {
    const pkt = ring.slice(0, -1).map(([x, y]) => [x * kx, y * ky]);
    const n = pkt.length;
    if (n < 3) return ring;
    let flaeche = 0;
    for (let j = 0; j < n; j++) { const [ax, ay] = pkt[j], [bx, by] = pkt[(j + 1) % n]; flaeche += ax * by - bx * ay; }
    // Normale nach außen: beim äußeren Ring vom Gebäude weg, beim Loch in das Loch hinein
    const vz = (flaeche > 0 ? 1 : -1) * (i === 0 ? 1 : -1);
    const normale = (a: number[], b: number[]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [vz * dy / l, -vz * dx / l];
    };
    const neu = pkt.map((p, j) => {
      const n1 = normale(pkt[(j - 1 + n) % n], p), n2 = normale(p, pkt[(j + 1) % n]);
      const f = m / Math.max(0.2, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
      return [(p[0] + (n1[0] + n2[0]) * f) / kx, (p[1] + (n1[1] + n2[1]) * f) / ky];
    });
    return [...neu, neu[0]];
  });
}

// Verschmolzene Gebäudezeilen nach Hausnummern teilen (Leeroy, 11.11.2026). Die Kacheln fügen aneinandergebaute
// gleich hohe Häuser zu einer Fläche zusammen; die Hausnummern liegen dort als einzelne Punkte, meist am Eingang.
// Jeder Teil der Fläche gehört zur nächstgelegenen Hausnummer (Voronoi), behalten wird der Teil um die Adresse
// des Inserats. Die Trennlinien liegen so ungefähr an den Brandwänden.
export const NUMMER_NAH_M = 8;       // Hausnummern so nah an der Fläche zählen zu ihr
const GLEICHE_ADRESSE_M = 4;         // Punkte so nah am Inseratspunkt gelten als dieselbe Adresse

type Punkt2 = [number, number];

// Ring mit der Halbebene (x - m) · n <= 0 schneiden (Sutherland-Hodgman), in Metern
function halbebene(ring: Punkt2[], m: Punkt2, n: Punkt2): Punkt2[] {
  const wert = (p: Punkt2) => (p[0] - m[0]) * n[0] + (p[1] - m[1]) * n[1];
  const aus: Punkt2[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const wa = wert(a), wb = wert(b);
    if (wa <= 0) aus.push(a);
    if ((wa < 0 && wb > 0) || (wa > 0 && wb < 0)) {
      const t = wa / (wa - wb);
      aus.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return aus;
}

export function nachHausnummer(polygon: Ring[], nummern: GeoJSON.Position[], lon: number, lat: number): Ring[] {
  if (!polygon[0]?.length) return polygon;
  const kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110540;
  const inM = (p: GeoJSON.Position): Punkt2 => [(p[0] - lon) * kx, (p[1] - lat) * ky];
  const zurueck = ([x, y]: Punkt2): GeoJSON.Position => [x / kx + lon, y / ky + lat];
  const flaeche: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: polygon } };
  const zurFlaeche = nummern.filter(p => punktInPolygon(p[0], p[1], polygon) || abstandM(p[0], p[1], flaeche) <= NUMMER_NAH_M);
  if (zurFlaeche.length < 2) return polygon;
  // Mittelpunkt der eigenen Zelle: die Hausnummer am Inseratspunkt, sonst der Punkt selbst
  const nah = zurFlaeche.map(inM).sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  const eigen: Punkt2 = Math.hypot(...nah[0]) <= 20 ? nah[0] : [0, 0];
  const andere = nah.filter(q => Math.hypot(q[0] - eigen[0], q[1] - eigen[1]) > GLEICHE_ADRESSE_M
    && Math.hypot(q[0], q[1]) > GLEICHE_ADRESSE_M);
  if (andere.length === 0) return polygon;
  const geschnitten = polygon.map(ring => {
    let r: Punkt2[] = ring.slice(0, -1).map(inM);
    for (const q of andere) {
      const m: Punkt2 = [(eigen[0] + q[0]) / 2, (eigen[1] + q[1]) / 2];
      r = halbebene(r, m, [q[0] - eigen[0], q[1] - eigen[1]]);
      if (r.length < 3) return null;
    }
    return [...r.map(zurueck), zurueck(r[0])];
  });
  if (!geschnitten[0]) return polygon;
  return geschnitten.filter((r): r is Ring => r !== null);
}
