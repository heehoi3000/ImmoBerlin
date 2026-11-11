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
