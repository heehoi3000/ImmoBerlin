// Gebäude des Inserats in der 3D-Ansicht finden (Leeroy, 10.11.2026). Die Gebäude kommen aus den Kartenkacheln
// (OpenMapTiles "building"); gesucht wird das Gebäude, in dem der Punkt des Inserats liegt, sonst das nächste
// in wenigen Metern (Adresspunkte liegen manchmal am Eingang auf dem Gehweg).

type Ring = GeoJSON.Position[];
type Flaeche = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

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

// Alle Stücke des Gebäudes am Punkt: Gebäudeteile, die den Punkt enthalten, und Stücke mit derselben Kennung
// aus Nachbarkacheln (ein Gebäude an der Kachelgrenze ist zerschnitten). Leer, wenn nichts nah genug liegt.
export function gebaeudeAmPunkt(features: GeoJSON.Feature[], lon: number, lat: number): Flaeche[] {
  const flaechen = features.filter(f => polygone(f).length > 0) as Flaeche[];
  let treffer = flaechen.filter(f => polygone(f).some(p => punktInPolygon(lon, lat, p)));
  if (treffer.length === 0) {
    let naechste: Flaeche | null = null, best = NAH_M;
    for (const f of flaechen) {
      const d = abstandM(lon, lat, f);
      if (d <= best) { best = d; naechste = f; }
    }
    if (!naechste) return [];
    treffer = [naechste];
  }
  const ids = new Set(treffer.map(f => f.id).filter(id => id != null));
  const dazu = ids.size ? flaechen.filter(f => f.id != null && ids.has(f.id) && !treffer.includes(f)) : [];
  return [...treffer, ...dazu];
}

// Kennungen der gefundenen Stücke (für den Filter der normalen Gebäudeebene)
export function kennungen(stuecke: GeoJSON.Feature[]): (string | number)[] {
  return [...new Set(stuecke.map(f => f.id).filter((id): id is string | number => id != null))];
}
