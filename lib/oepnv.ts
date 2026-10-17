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

// Ab dieser Ausschnittsbreite (Grad Länge) werden keine Linien mehr geladen,
// sonst kämen tausende Linien auf einmal.
export const MAX_AUSSCHNITT_BREITE = 1.2;
