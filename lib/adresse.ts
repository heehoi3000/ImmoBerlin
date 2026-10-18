// Adresssuche für das Inseratsformular über Photon (OpenStreetMap-Geocoder, kostenlos, ohne Schlüssel).
const PHOTON_URL = 'https://photon.komoot.io/api/';
const DEUTSCHLAND_BBOX = '5.8,47.2,15.1,55.1';

export interface Adresse {
  text: string;       // z. B. "Torstraße 1, 10119 Berlin"
  strasse: string;
  plz: string;
  ort: string;
  bezirk: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; postcode?: string; city?: string; district?: string; locality?: string; type?: string };
}

export async function adressenSuchen(suchtext: string): Promise<Adresse[]> {
  const url = `${PHOTON_URL}?q=${encodeURIComponent(suchtext)}&lang=de&limit=6&bbox=${DEUTSCHLAND_BBOX}&layer=house&layer=street`;
  const antwort = await fetch(url);
  if (!antwort.ok) throw new Error(`Photon antwortet mit ${antwort.status}`);
  const daten = await antwort.json();
  return ((daten.features as PhotonFeature[]) || []).map(f => {
    const p = f.properties;
    const strassenname = p.street ?? p.name ?? '';
    const strasse = [strassenname, p.housenumber].filter(Boolean).join(' ');
    const ort = p.city ?? '';
    const [lon, lat] = f.geometry.coordinates;
    return {
      text: [strasse, [p.postcode, ort].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      strasse, plz: p.postcode ?? '', ort, bezirk: p.district ?? p.locality ?? '', lat, lon,
    };
  }).filter(a => a.strasse && a.ort);
}
