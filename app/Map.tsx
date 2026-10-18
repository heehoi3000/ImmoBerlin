"use client";
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapContainer, Marker, Popup, Circle, CircleMarker, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import { Kartenausschnitt } from '../lib/oepnv';
import { Anzeige, Haltestelle, NaechsteHaltestelle } from '../lib/suche';

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

// Hintergrundkarte: OpenFreeMap (weltweit, kostenlos, ohne API-Schlüssel).
// Liefert Vektorkacheln, die MapLibre über das Leaflet-Plugin zeichnet.
const KARTE_STIL = 'https://tiles.openfreemap.org/styles/positron';
const KARTE_HINWEIS = '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Daten von <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const FAHRPLAN_HINWEIS = 'Fahrplandaten: <a href="https://www.delfi.de">DELFI e.V.</a>, CC BY 4.0';

// Der Worker liegt unter public/maplibre/ (siehe scripts/maplibre-worker-kopieren.mjs).
// '/ImmoBerlin' ist der basePath aus next.config.ts.
setWorkerUrl(new URL('/ImmoBerlin/maplibre/maplibre-gl-worker.mjs', window.location.href).href);

function Hintergrundkarte() {
  const map = useMap();
  useEffect(() => {
    const ebene = L.maplibreGL({ style: KARTE_STIL, attributionControl: { customAttribution: KARTE_HINWEIS } });
    ebene.addTo(map);
    map.attributionControl.addAttribution(FAHRPLAN_HINWEIS);
    return () => {
      map.attributionControl.removeAttribution(FAHRPLAN_HINWEIS);
      ebene.remove();
    };
  }, [map]);
  return null;
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

type OrtKreis = { lat: number; lon: number; m: number; ausdehnung?: [number, number, number, number] };

// Gesuchter Ort: Umkreis (oder Ortsgrenze) zeichnen und die Karte dorthin bewegen
function OrtAnzeige({ ort }: { ort: OrtKreis | null }) {
  const map = useMap();
  useEffect(() => {
    if (!ort) return;
    if (ort.m > 0) map.fitBounds(L.latLng(ort.lat, ort.lon).toBounds(ort.m * 2), { padding: [20, 20] });
    else if (ort.ausdehnung) map.fitBounds([[ort.ausdehnung[1], ort.ausdehnung[0]], [ort.ausdehnung[3], ort.ausdehnung[2]]], { padding: [20, 20] });
    else map.setView([ort.lat, ort.lon], 13);
  }, [map, ort?.lat, ort?.lon, ort?.m]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ort) return null;
  const stil = { color: '#000', weight: 2, opacity: 0.5, dashArray: '6 6', fillOpacity: 0.03 };
  if (ort.m > 0) return <Circle center={[ort.lat, ort.lon]} radius={ort.m} pathOptions={stil} interactive={false} />;
  if (ort.ausdehnung) return <Rectangle bounds={[[ort.ausdehnung[1], ort.ausdehnung[0]], [ort.ausdehnung[3], ort.ausdehnung[2]]]} pathOptions={stil} interactive={false} />;
  return null;
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface MapProps {
  anzeigen: Anzeige[];
  haltestellen: Haltestelle[];
  naechste: Record<string, NaechsteHaltestelle>;
  linienUmkreisM: number;
  ortKreis: OrtKreis | null;
  // Anzeige, zu der die Karte springen soll (nr ändert sich bei jedem Klick)
  fokus: { id: string; nr: number } | null;
  onAusschnittChange?: (a: Kartenausschnitt) => void;
}

// Springt zur angeklickten Anzeige aus der Ergebnisliste und öffnet ihr Popup
function Fokus({ fokus, marker }: { fokus: MapProps['fokus']; marker: React.RefObject<Record<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    const m = fokus && marker.current[fokus.id];
    if (!m) return;
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 15));
    m.openPopup();
  }, [map, fokus, marker]);
  return null;
}

export default function Map({ anzeigen, haltestellen, naechste, linienUmkreisM, ortKreis, fokus, onAusschnittChange }: MapProps) {
  const berlinPosition: [number, number] = [52.516, 13.42];
  const marker = useRef<Record<string, L.Marker>>({});

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer center={berlinPosition} zoom={11} preferCanvas style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}>
        <Hintergrundkarte />
        <AusschnittMelder onChange={onAusschnittChange} />
        <OrtAnzeige ort={ortKreis} />
        <Fokus fokus={fokus} marker={marker} />

        {/* Umkreis um jede Haltestelle der gewählten Linien */}
        {haltestellen.map((h) => (
          <Circle key={`umkreis-${h.stop_id}`} center={[h.lat, h.lon]} radius={linienUmkreisM}
            pathOptions={{ color: '#1E88E5', weight: 1, opacity: 0.4, fillColor: '#1E88E5', fillOpacity: 0.06 }} interactive={false} />
        ))}
        {haltestellen.map((h) => (
          <CircleMarker key={`halt-${h.stop_id}`} center={[h.lat, h.lon]} radius={4}
            pathOptions={{ color: '#333', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
            <Popup>{h.name}</Popup>
          </CircleMarker>
        ))}

        {anzeigen.map((anzeige) => (
          <Marker key={anzeige.id} position={[anzeige.koordinate_lat, anzeige.koordinate_lon]} icon={houseIcon}
            ref={(m) => { if (m) marker.current[anzeige.id] = m; else delete marker.current[anzeige.id]; }}>
            <Popup>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '15px', fontWeight: 'bold' }}>{anzeige.titel}</h3>
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <span style={{ display: 'inline-block', backgroundColor: 'black', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {anzeige.transaktions_typ}
                </span><br/>
                <strong>{anzeige.transaktions_typ === 'mieten' ? 'Kaltmiete' : 'Kaufpreis'}:</strong> {euro.format(Number(anzeige.preis))}<br/>
                {anzeige.warmmiete && <><strong>Warmmiete:</strong> {euro.format(Number(anzeige.warmmiete))}<br/></>}
                <strong>Fläche:</strong> {anzeige.quadratmeter} m² · <strong>Zimmer:</strong> {anzeige.zimmer}<br/>
                {anzeige.adresse}
                {naechste[anzeige.id] && (
                  <><br/><strong>ÖPNV:</strong> {naechste[anzeige.id].distanz_m} m zur {naechste[anzeige.id].linie}, {naechste[anzeige.id].haltestelle}</>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
