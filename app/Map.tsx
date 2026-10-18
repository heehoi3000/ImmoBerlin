"use client";
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
// NEU: GeoJSON importieren
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Circle, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { Linie, Kartenausschnitt } from '../lib/oepnv';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const houseIcon = L.divIcon({
  html: '<div style="font-size: 28px; text-shadow: 0 2px 5px rgba(0,0,0,0.3);">🏠</div>',
  className: 'custom-house-icon',
  iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15]
});

// Hintergrundkarte von OpenStreetMap. CARTO liefert seit Oktober 2026 nur noch
// mit API-Schlüssel Kacheln ("API KEY REQUIRED").
const KARTE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const KARTE_HINWEIS = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const FAHRPLAN_HINWEIS = ' | Fahrplandaten: <a href="https://www.delfi.de">DELFI e.V.</a>, CC BY 4.0';

interface Haltestelle { stop_id: string; name: string; lat: number; lon: number; }
interface NaechsteHaltestelle { anzeige_id: string; distanz_m: number; haltestelle: string; linie: string; }

// Umkreis in Metern, auf 50 bis 5000 m begrenzt
function umkreisMeter(eingabe?: string) {
  return Math.min(Math.max(parseInt(eingabe || '') || 1500, 50), 5000);
}

// Meldet den sichtbaren Kartenausschnitt an die Seite, damit sie die Linien dort laden kann.
function AusschnittMelder({ onChange }: { onChange?: (a: Kartenausschnitt) => void }) {
  const map = useMapEvents({
    moveend: () => melden(),
  });
  function melden() {
    const b = map.getBounds();
    onChange?.({ minLon: b.getWest(), minLat: b.getSouth(), maxLon: b.getEast(), maxLat: b.getNorth() });
  }
  useEffect(() => { melden(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

interface MapProps {
  filters?: {
    transactionType: string; propertyType: string;
    priceMin: string; priceMax: string;
    roomsMin: string; roomsMax: string;
    spaceMin: string; spaceMax: string;
    selectedRoutes: Linie[]; selectedDistricts: string[];
    routeRadius: string;
  };
  onAusschnittChange?: (a: Kartenausschnitt) => void;
}

export default function Map({ filters, onAusschnittChange }: MapProps) {
  const berlinPosition: [number, number] = [52.516, 13.42]; 
  const [anzeigen, setAnzeigen] = useState<any[]>([]);
  // NEU: Speicher für unsere Bezirksgrenzen
  const [bezirkGrenzen, setBezirkGrenzen] = useState<any[]>([]);
  const [haltestellen, setHaltestellen] = useState<Haltestelle[]>([]);
  const [naechste, setNaechste] = useState<Record<string, NaechsteHaltestelle>>({});

  useEffect(() => {
    async function fetchAnzeigenUndGrenzen() {
      try {
        const linienIds = (filters?.selectedRoutes || []).map(l => l.linie_id);
        const radius = umkreisMeter(filters?.routeRadius);

        // Mit Linien: Supabase sucht die Anzeigen im Umkreis der Haltestellen (PostGIS),
        // die übrigen Filter werden an dieselbe Abfrage angehängt.
        let query = linienIds.length > 0
          ? supabase.rpc('anzeigen_nahe_linien', { linien_ids: linienIds, radius_m: radius }).select('*') as unknown as ReturnType<ReturnType<typeof supabase.from>['select']>
          : supabase.from('anzeigen').select('*');

        if (filters) {
          if (filters.transactionType) query = query.eq('transaktions_typ', filters.transactionType);
          if (filters.propertyType) query = query.eq('immobilien_typ', filters.propertyType);
          if (filters.priceMin) query = query.gte('preis', parseInt(filters.priceMin));
          if (filters.priceMax) query = query.lte('preis', parseInt(filters.priceMax));
          if (filters.roomsMin) query = query.gte('zimmer', parseFloat(filters.roomsMin));
          if (filters.roomsMax) query = query.lte('zimmer', parseFloat(filters.roomsMax));
          if (filters.spaceMin) query = query.gte('quadratmeter', parseInt(filters.spaceMin));
          if (filters.spaceMax) query = query.lte('quadratmeter', parseInt(filters.spaceMax));
          if (filters.selectedDistricts && filters.selectedDistricts.length > 0) {
            query = query.in('bezirk', filters.selectedDistricts);
          }
        }

        const { data: wohnungenData, error: wohnungenError } = await query;
        if (wohnungenError) throw wohnungenError;
        const finaleWohnungen = wohnungenData || [];

        // --- ÖPNV: Haltestellen für die Umkreise und nächste Haltestelle je Anzeige ---
        let haltestellenZumZeigen: Haltestelle[] = [];
        const naechsteJeAnzeige: Record<string, NaechsteHaltestelle> = {};
        if (linienIds.length > 0) {
          const [haltRes, naechsteRes] = await Promise.all([
            supabase.rpc('haltestellen_der_linien', { linien_ids: linienIds }),
            supabase.rpc('anzeigen_naechste_haltestelle', { linien_ids: linienIds, radius_m: radius }),
          ]);
          if (haltRes.error) console.error("Fehler beim Laden der Haltestellen:", haltRes.error);
          if (naechsteRes.error) console.error("Fehler beim Laden der Entfernungen:", naechsteRes.error);
          haltestellenZumZeigen = (haltRes.data as Haltestelle[]) || [];
          for (const n of (naechsteRes.data as NaechsteHaltestelle[]) || []) naechsteJeAnzeige[n.anzeige_id] = n;
        }

        // --- NEU: GRENZEN LADEN ---
        let grenzenZumZeigen: any[] = [];
        if (filters?.selectedDistricts && filters.selectedDistricts.length > 0) {
          // Wir rufen den neuen SQL View auf!
          // WICHTIG: Achte hier darauf, dass der Spaltenname ('bezirk_name') mit deinem View übereinstimmt!
          const { data: grenzenData, error: grenzenError } = await supabase
            .from('bezirk_grenzen_view')
            .select('*')
            .in('bezirk_name', filters.selectedDistricts);
            
          if (grenzenError) console.error("Fehler beim Laden der Grenzen:", grenzenError);
          if (grenzenData) grenzenZumZeigen = grenzenData;
        }

        setAnzeigen(finaleWohnungen);
        setBezirkGrenzen(grenzenZumZeigen);
        setHaltestellen(haltestellenZumZeigen);
        setNaechste(naechsteJeAnzeige);

      } catch (err) {
        console.error("Ladefehler:", err);
      }
    }
    
    fetchAnzeigenUndGrenzen();
  }, [filters]);

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '100vh', position: 'relative' }}>
      <MapContainer center={berlinPosition} zoom={11} preferCanvas style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}>
        <TileLayer
          attribution={KARTE_HINWEIS + FAHRPLAN_HINWEIS}
          url={KARTE_URL}
        />

        <AusschnittMelder onChange={onAusschnittChange} />

        {/* Umkreis um jede Haltestelle der gewählten Linien */}
        {haltestellen.map((h) => (
          <Circle key={`umkreis-${h.stop_id}`} center={[h.lat, h.lon]} radius={umkreisMeter(filters?.routeRadius)}
            pathOptions={{ color: '#1E88E5', weight: 1, opacity: 0.4, fillColor: '#1E88E5', fillOpacity: 0.06 }} interactive={false} />
        ))}
        {haltestellen.map((h) => (
          <CircleMarker key={`halt-${h.stop_id}`} center={[h.lat, h.lon]} radius={4}
            pathOptions={{ color: '#333', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
            <Popup>{h.name}</Popup>
          </CircleMarker>
        ))}

        {/* NEU: DIE GRENZEN AUF DIE KARTE ZEICHNEN */}
        {bezirkGrenzen.map((grenze, idx) => (
          <GeoJSON 
            // Der Key muss eindeutig sein, damit Leaflet das Polygon bei Updates neu zeichnet
            key={`${grenze.bezirk_name}-${idx}`} 
            data={grenze.geojson} 
            style={{
              color: '#000000',      // Randfarbe (Schwarz, passend zum Design)
              weight: 2,             // Liniendicke
              opacity: 0.6,          // Transparenz der Linie
              fillColor: '#000000',  // Füllfarbe
              fillOpacity: 0.08      // Sehr leichte Füllung (8%)
            }} 
          />
        ))}

        {anzeigen?.map((anzeige) => (
           anzeige.koordinate_lat && anzeige.koordinate_lon && (
            <Marker key={anzeige.id} position={[anzeige.koordinate_lat, anzeige.koordinate_lon]} icon={houseIcon}>
              <Popup>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: 'bold' }}>{anzeige.titel}</h3>
                <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                  <span style={{ display: 'inline-block', backgroundColor: 'black', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {anzeige.transaktions_typ}
                  </span><br/>
                  <strong>Preis:</strong> {anzeige.preis} €<br/>
                  <strong>Bezirk:</strong> {anzeige.bezirk}<br/>
                  <strong>Fläche:</strong> {anzeige.quadratmeter} m²
                  {naechste[anzeige.id] && (
                    <><br/><strong>ÖPNV:</strong> {naechste[anzeige.id].distanz_m} m zur {naechste[anzeige.id].linie}, {naechste[anzeige.id].haltestelle}</>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}