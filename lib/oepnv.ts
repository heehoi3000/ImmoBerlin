// Gemeinsame Typen und Bezeichnungen für den ÖPNV-Linienfilter.

export interface Linie {
  linie_id: number;
  typ: string;
  nummer: string;
  betreiber: string;
  endpunkte: string;
}

export interface Kartenausschnitt {
  minLon: number; minLat: number;
  maxLon: number; maxLat: number;
}

// Reihenfolge und Anzeigenamen der Linientypen aus oepnv_linien.typ
export const LINIENTYPEN: Record<string, string> = {
  sbahn: 'S-Bahn',
  ubahn: 'U-Bahn',
  tram: 'Tram',
  bus: 'Bus',
  regional: 'Regionalverkehr',
  fern: 'Fernverkehr',
  faehre: 'Fähre',
  ersatzverkehr: 'Ersatzverkehr',
  sonstige: 'Sonstige',
};

// PostgREST liefert Geografie-Spalten als EWKB-Hex. Für einen Punkt mit SRID:
// 1 Byte Byte-Reihenfolge, 4 Byte Typ, 4 Byte SRID, dann Länge und Breite als double.
export function punktAusEwkb(hex: string | null | undefined): { lat: number; lon: number } | null {
  if (!hex || hex.length < 50) return null;
  const bytes = new Uint8Array(hex.match(/../g)!.map(b => parseInt(b, 16)));
  const v = new DataView(bytes.buffer);
  const le = bytes[0] === 1;
  const typ = v.getUint32(1, le);
  const start = typ & 0x20000000 ? 9 : 5;
  return { lon: v.getFloat64(start, le), lat: v.getFloat64(start + 8, le) };
}
