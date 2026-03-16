"use client";
import { useEffect, useState } from 'react';
import 'leaflet/dist/leaflet.css';
// NEU: GeoJSON importieren
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '../lib/supabase';

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

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

interface MapProps {
  filters?: {
    transactionType: string; propertyType: string;
    priceMin: string; priceMax: string;
    roomsMin: string; roomsMax: string;
    spaceMin: string; spaceMax: string;
    selectedRoutes: string[]; selectedDistricts: string[];
    routeRadius: string;
  }
}

export default function Map({ filters }: MapProps) {
  const berlinPosition: [number, number] = [52.516, 13.42]; 
  const [anzeigen, setAnzeigen] = useState<any[]>([]);
  // NEU: Speicher für unsere Bezirksgrenzen
  const [bezirkGrenzen, setBezirkGrenzen] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAnzeigenUndGrenzen() {
      try {
        let query = supabase.from('anzeigen').select('*');

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
        let finaleWohnungen = wohnungenData || [];

        // --- ÖPNV Filter ---
        if (filters?.selectedRoutes && filters.selectedRoutes.length > 0) {
          const { data: routesData } = await supabase.from('routes').select('route_id').in('route_short_name', filters.selectedRoutes);
          if (routesData && routesData.length > 0) {
            const routeIds = routesData.map(r => r.route_id);
            const { data: routeStopsData } = await supabase.from('route_stops').select('stop_id').in('route_id', routeIds);
            if (routeStopsData && routeStopsData.length > 0) {
              const stopIds = routeStopsData.map(rs => rs.stop_id);
              const { data: stopsData } = await supabase.from('stops').select('stop_lat, stop_lon').in('stop_id', stopIds);
              
              if (stopsData && stopsData.length > 0) {
                const maxRadius = filters.routeRadius ? parseInt(filters.routeRadius) : 1500;
                finaleWohnungen = finaleWohnungen.filter(wohnung => {
                  return stopsData.some(station => {
                    if (!wohnung.koordinate_lat || !wohnung.koordinate_lon || !station.stop_lat || !station.stop_lon) return false;
                    return getDistance(wohnung.koordinate_lat, wohnung.koordinate_lon, station.stop_lat, station.stop_lon) <= maxRadius;
                  });
                });
              } else finaleWohnungen = [];
            } else finaleWohnungen = [];
          } else finaleWohnungen = [];
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

      } catch (err) {
        console.error("Ladefehler:", err);
      }
    }
    
    fetchAnzeigenUndGrenzen();
  }, [filters]);

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '100vh', position: 'relative' }}>
      <MapContainer center={berlinPosition} zoom={11} style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}>
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

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
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}