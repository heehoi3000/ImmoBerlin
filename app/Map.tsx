"use client";
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { MapContainer, Popup, Circle, CircleMarker, Rectangle, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import 'leaflet.markercluster';
import { setWorkerUrl } from 'maplibre-gl';
import { Kartenausschnitt } from '../lib/oepnv';
import { Bezirk } from '../lib/filter';
import { bezirkeAusdehnung } from '../lib/bezirke';
import { Anzeige, Haltestelle, NaechsteHaltestelle } from '../lib/suche';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/ImmoBerlin/leaflet/marker-icon-2x.png',
  iconUrl: '/ImmoBerlin/leaflet/marker-icon.png',
  shadowUrl: '/ImmoBerlin/leaflet/marker-shadow.png',
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

// Gewählte Bezirke: Grenzen zeichnen und die Karte darauf ausrichten
function BezirkeAnzeige({ bezirke }: { bezirke: Bezirk[] }) {
  const map = useMap();
  const schluessel = bezirke.map(b => b.id).join(',');
  useEffect(() => {
    const r = bezirkeAusdehnung(bezirke);
    if (r) map.fitBounds([[r[1], r[0]], [r[3], r[2]]], { padding: [20, 20] });
  }, [map, schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  const stil = { color: '#000', weight: 2, opacity: 0.6, dashArray: '6 6', fillOpacity: 0.04 };
  return <>{bezirke.filter(b => b.grenze).map(b => <GeoJSON key={b.id} data={b.grenze!} style={stil} interactive={false} />)}</>;
}

// Preis kurz für den Pin: 1.160 €, 485 Tsd. €, 1,2 Mio. €
function kurzPreis(a: Anzeige) {
  const n = Number(a.transaktions_typ === 'mieten' && a.warmmiete ? a.warmmiete : a.preis);
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('de-DE')} Tsd. €`;
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
}

const pinIcon = (a: Anzeige, aktiv: boolean) => L.divIcon({
  html: `<span>${kurzPreis(a)}</span>`,
  className: `preis-pin${aktiv ? ' aktiv' : ''}`,
  iconSize: null as unknown as L.PointExpression, iconAnchor: [0, 0],
});

const gruppenIcon = (c: L.MarkerCluster) => {
  const n = c.getChildCount();
  const groesse = n < 10 ? 36 : n < 100 ? 44 : 52;
  return L.divIcon({ html: `<span>${n}</span>`, className: 'preis-gruppe', iconSize: [groesse, groesse] });
};

// Preis-Pins der Anzeigen, nah beieinander liegende werden zu Gruppen mit Anzahl zusammengefasst
function PreisPins({ anzeigen, aktivId, onAuswahl }: { anzeigen: Anzeige[]; aktivId: string | null; onAuswahl?: (id: string) => void }) {
  const map = useMap();
  const gruppe = useRef<L.MarkerClusterGroup | null>(null);
  const pins = useRef<Record<string, { m: L.Marker; a: Anzeige }>>({});
  const vorher = useRef<string | null>(null);
  const auswahl = useRef(onAuswahl);
  useEffect(() => { auswahl.current = onAuswahl; }, [onAuswahl]);

  useEffect(() => {
    const g = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, spiderfyOnMaxZoom: true, iconCreateFunction: gruppenIcon });
    gruppe.current = g;
    map.addLayer(g);
    return () => { map.removeLayer(g); };
  }, [map]);

  useEffect(() => {
    const g = gruppe.current!;
    g.clearLayers();
    pins.current = {};
    const marker = anzeigen.map(a => {
      const m = L.marker([a.koordinate_lat, a.koordinate_lon], { icon: pinIcon(a, false), riseOnHover: true });
      m.on('click', () => auswahl.current?.(a.id));
      pins.current[a.id] = { m, a };
      return m;
    });
    g.addLayers(marker);
    vorher.current = null;
  }, [anzeigen]);

  // Aktiven Pin (Hover in der Liste oder ausgewählt) schwarz und nach vorn
  useEffect(() => {
    const alt = vorher.current && pins.current[vorher.current];
    if (alt) { alt.m.setIcon(pinIcon(alt.a, false)); alt.m.setZIndexOffset(0); }
    const neu = aktivId && pins.current[aktivId];
    if (neu) { neu.m.setIcon(pinIcon(neu.a, true)); neu.m.setZIndexOffset(1000); }
    vorher.current = aktivId;
  }, [aktivId, anzeigen]);
  return null;
}

// Springt zu einer Anzeige (z. B. nach Klick in der Liste auf dem Handy)
function Fokus({ fokus, anzeigen }: { fokus: MapProps['fokus']; anzeigen: Anzeige[] }) {
  const map = useMap();
  useEffect(() => {
    const a = fokus && anzeigen.find(x => x.id === fokus.id);
    if (a) map.setView([a.koordinate_lat, a.koordinate_lon], Math.max(map.getZoom(), 16));
  }, [map, fokus]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Klick auf die freie Karte hebt die Auswahl auf
function KlickLeer({ onKlick }: { onKlick?: () => void }) {
  useMapEvents({ click: () => onKlick?.() });
  return null;
}

interface MapProps {
  anzeigen: Anzeige[];
  haltestellen: Haltestelle[];
  naechste: Record<string, NaechsteHaltestelle>;
  linienUmkreisM: number;
  ortKreis: OrtKreis | null;
  bezirke: Bezirk[];
  // Anzeige, zu der die Karte springen soll (nr ändert sich bei jedem Klick)
  fokus?: { id: string; nr: number } | null;
  aktivId?: string | null;
  onAuswahl?: (id: string | null) => void;
  onAusschnittChange?: (a: Kartenausschnitt) => void;
}

export default function Map({ anzeigen, haltestellen, linienUmkreisM, ortKreis, bezirke, fokus = null, aktivId = null, onAuswahl, onAusschnittChange }: MapProps) {
  const berlinPosition: [number, number] = [52.516, 13.42];

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <MapContainer center={berlinPosition} zoom={11} maxZoom={19} preferCanvas zoomControl={false} style={{ height: "100%", width: "100%", position: "absolute", top: 0, left: 0, bottom: 0, right: 0 }}>
        <Hintergrundkarte />
        <Zoomknoepfe />
        <GroesseBeobachten />
        <AusschnittMelder onChange={onAusschnittChange} />
        <OrtAnzeige ort={ortKreis} />
        <BezirkeAnzeige bezirke={bezirke} />
        <Fokus fokus={fokus} anzeigen={anzeigen} />
        <KlickLeer onKlick={() => onAuswahl?.(null)} />

        {/* Umkreis um jede Haltestelle der gewählten Linien */}
        {haltestellen.map((h) => (
          <Circle key={`umkreis-${h.stop_id}`} center={[h.lat, h.lon]} radius={linienUmkreisM}
            pathOptions={{ color: '#2563eb', weight: 1, opacity: 0.35, fillColor: '#2563eb', fillOpacity: 0.06 }} interactive={false} />
        ))}
        {haltestellen.map((h) => (
          <CircleMarker key={`halt-${h.stop_id}`} center={[h.lat, h.lon]} radius={4}
            pathOptions={{ color: '#1d4ed8', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
            <Popup>{h.name}</Popup>
          </CircleMarker>
        ))}

        <PreisPins anzeigen={anzeigen} aktivId={aktivId} onAuswahl={(id) => onAuswahl?.(id)} />
      </MapContainer>
    </div>
  );
}

function Zoomknoepfe() {
  const map = useMap();
  useEffect(() => {
    const z = L.control.zoom({ position: 'topright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' }).addTo(map);
    return () => { z.remove(); };
  }, [map]);
  return null;
}

// Leaflet merkt nicht, wenn der Kartenbereich ein- oder ausgeblendet wird (Umschalter auf dem Handy)
function GroesseBeobachten() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}
