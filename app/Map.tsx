'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  AttributionControl, Map as KartenMap, Marker, NavigationControl, Popup, setWorkerUrl,
  type AddLayerObject, type GeoJSONSource, type LngLatBoundsLike, type MapMouseEvent, type StyleSpecification,
} from 'maplibre-gl';
import Supercluster from 'supercluster';
import polygonClipping, { type MultiPolygon as PcMultiPolygon, type Polygon as PcPolygon } from 'polygon-clipping';
import { Kartenausschnitt, Linie, haltestelleKurz } from '../lib/oepnv';
import { Bezirk } from '../lib/filter';
import { bezirkeAusdehnung } from '../lib/bezirke';
import { Anzeige, Haltestelle } from '../lib/suche';
import { BASIS } from '../lib/basis';
import { Verlauf, streckeLaden } from '../lib/strecken';
import { Station } from '../lib/oepnvNaehe';
import { Art, Ort, UMKREIS_M, artName, ortBeschriftung } from '../lib/grundversorgung';
import { symbolSvg, verkehrArt, verkehrSvg } from '../lib/symbole';

// Hintergrundkarte: OpenFreeMap (weltweit, kostenlos, ohne API-Schlüssel), Vektorkacheln im Stil Positron.
const KARTE_STIL = 'https://tiles.openfreemap.org/styles/positron';
const KARTE_HINWEIS = '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Daten von <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Ist OpenFreeMap nicht erreichbar, bleibt die Karte trotzdem bedienbar: schlichter Hintergrund,
// Pins, Linien und Grenzen werden weiter gezeichnet.
const ERSATZ_STIL: StyleSpecification = {
  version: 8, sources: {},
  layers: [{ id: 'hintergrund', type: 'background', paint: { 'background-color': '#f4f4f5' } }],
};

// Der Worker liegt unter public/maplibre/ (siehe scripts/maplibre-worker-kopieren.mjs).
setWorkerUrl(new URL(`${BASIS}/maplibre/maplibre-gl-worker.mjs`, window.location.href).href);

// Zoomstufen: MapLibre rechnet mit 512er-Kacheln, eine Stufe weniger als früher bei Leaflet zeigt denselben Ausschnitt.
const START_ZOOM = 10;
const MAX_ZOOM = 18;
const HALTESTELLEN_AB_ZOOM = 12;
const NAH_ZOOM = 15;

// Die Karte und ein Zähler, der bei jedem geladenen Stil steigt (0 = Stil noch nicht da).
// Eigene Flächen und Linien hängen am Stil und müssen nach einem Stilwechsel neu angelegt werden.
const KarteKontext = createContext<{ map: KartenMap; stil: number } | null>(null);
const useKarte = () => useContext(KarteKontext)!;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Nach map.remove() werfen Aufräumaufrufe; dann ist ohnehin nichts mehr zu tun
function sicher(f: () => void) { try { f(); } catch { /* Karte schon entfernt */ } }

type FC = GeoJSON.FeatureCollection;
const LEER: FC = { type: 'FeatureCollection', features: [] };
type Ebene = { id: string; type: AddLayerObject['type']; unterBeschriftung?: boolean; [k: string]: unknown };

// GeoJSON-Quelle mit Ebenen anlegen und bei neuen Daten aktualisieren. Flächen kommen unter die
// Straßennamen der Hintergrundkarte, damit diese lesbar bleiben.
function useGeoJson(id: string, daten: FC, ebenen: Ebene[]) {
  const { map, stil } = useKarte();
  const aktuell = useRef(daten);
  useEffect(() => { aktuell.current = daten; }, [daten]);
  useEffect(() => {
    if (!stil) return;
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: aktuell.current });
    const beschriftung = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
    for (const { unterBeschriftung, ...e } of ebenen) {
      if (!map.getLayer(e.id)) map.addLayer({ ...e, source: id } as AddLayerObject, unterBeschriftung ? beschriftung : undefined);
    }
    return () => sicher(() => {
      for (const e of ebenen) if (map.getLayer(e.id)) map.removeLayer(e.id);
      if (map.getSource(id)) map.removeSource(id);
    });
  }, [map, stil]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (stil) (map.getSource(id) as GeoJSONSource | undefined)?.setData(daten);
  }, [map, stil, daten, id]);
}

// Kreis als Ring aus [lon, lat]-Punkten (geschlossen)
function kreisRing(lat: number, lon: number, m: number, punkte = 36): [number, number][] {
  const dLat = m / 111320, dLon = m / (111320 * Math.cos(lat * Math.PI / 180));
  const ring = Array.from({ length: punkte }, (_, i) => {
    const w = (i / punkte) * 2 * Math.PI;
    return [lon + dLon * Math.cos(w), lat + dLat * Math.sin(w)] as [number, number];
  });
  return [...ring, ring[0]];
}

function kreisAusdehnung(lat: number, lon: number, m: number): LngLatBoundsLike {
  const dLat = m / 111320, dLon = m / (111320 * Math.cos(lat * Math.PI / 180));
  return [[lon - dLon, lat - dLat], [lon + dLon, lat + dLat]];
}

function ausdehnung(punkte: { lat: number; lon: number }[]): LngLatBoundsLike {
  const lons = punkte.map(p => p.lon), lats = punkte.map(p => p.lat);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

// Symbol als DOM-Element auf der Karte: per Tastatur erreichbar, Name beim Überfahren oder Fokus
// (Tooltip), beim Antippen ein Popup mit mehr Angaben.
function symbolSetzen(map: KartenMap, o: {
  lat: number; lon: number; element: HTMLElement; label: string; tooltip: string; popup: string; abstand: number; vorn?: boolean;
}) {
  const { element: el } = o;
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.setAttribute('aria-label', o.label);
  if (o.vorn) el.style.zIndex = '5';
  const marker = new Marker({ element: el }).setLngLat([o.lon, o.lat]).addTo(map);
  const tip = new Popup({ closeButton: false, closeOnClick: false, focusAfterOpen: false, className: 'karte-tooltip', offset: o.abstand, anchor: 'bottom' }).setText(o.tooltip);
  const zeigen = () => tip.setLngLat([o.lon, o.lat]).addTo(map);
  const weg = () => tip.remove();
  const oeffnen = (e: Event) => {
    e.stopPropagation();
    weg();
    new Popup({ offset: o.abstand, className: 'karte-popup', maxWidth: '260px' }).setLngLat([o.lon, o.lat]).setHTML(o.popup).addTo(map);
  };
  const taste = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); oeffnen(e); } };
  el.addEventListener('mouseenter', zeigen);
  el.addEventListener('mouseleave', weg);
  el.addEventListener('focus', zeigen);
  el.addEventListener('blur', weg);
  el.addEventListener('click', oeffnen);
  el.addEventListener('keydown', taste);
  return () => { tip.remove(); marker.remove(); };
}

function element(klasse: string, html: string, groesse?: number) {
  const el = document.createElement('div');
  el.className = klasse;
  el.innerHTML = html;
  if (groesse) { el.style.width = `${groesse}px`; el.style.height = `${groesse}px`; }
  return el;
}

// 3D-Gebäude aus den Kartenkacheln (OpenMapTiles "building", Höhe render_height). Erst ab Straßenzoom sichtbar,
// damit es auch auf schwächeren Geräten flüssig bleibt; der Knopf "3D" neigt die Karte und blendet sie ein.
// Wer am Gerät "Bewegung reduzieren" eingestellt hat, startet immer flach.
const GEBAEUDE_AB_ZOOM = 14;
const NEIGUNG = 50;
function Gebaeude3D({ start }: { start: boolean }) {
  const { map, stil } = useKarte();
  const [an, setAn] = useState(() => start && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [moeglich, setMoeglich] = useState(false);
  const anRef = useRef(an);
  const erstesMal = useRef(false);
  useEffect(() => { anRef.current = an; }, [an]);

  useEffect(() => {
    if (!stil) return;
    const quelle = Object.entries(map.getStyle().sources).find(([, q]) => q.type === 'vector')?.[0];
    setMoeglich(!!quelle); // eslint-disable-line react-hooks/set-state-in-effect
    if (!quelle) return;
    const beschriftung = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
    if (!map.getLayer('gebaeude-3d')) map.addLayer({
      id: 'gebaeude-3d', type: 'fill-extrusion', source: quelle, 'source-layer': 'building', minzoom: GEBAEUDE_AB_ZOOM,
      layout: { visibility: anRef.current ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-color': '#e2e1dc',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 0],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], GEBAEUDE_AB_ZOOM, 0, GEBAEUDE_AB_ZOOM + 0.6, 0.85],
      },
    }, beschriftung);
    return () => sicher(() => { if (map.getLayer('gebaeude-3d')) map.removeLayer('gebaeude-3d'); });
  }, [map, stil]);

  useEffect(() => {
    sicher(() => { if (map.getLayer('gebaeude-3d')) map.setLayoutProperty('gebaeude-3d', 'visibility', an ? 'visible' : 'none'); });
    const ziel = an ? NEIGUNG : 0;
    if (Math.abs(map.getPitch() - ziel) < 0.5) return;
    // Beim ersten Mal ohne Animation, sonst bricht das Einpassen der Inseratskarte die Neigung ab
    const ruhig = !erstesMal.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (ruhig) map.jumpTo({ pitch: ziel }); else map.easeTo({ pitch: ziel, duration: 600 });
  }, [map, an, stil]);
  useEffect(() => { erstesMal.current = true; }, []);

  if (!moeglich) return null;
  return (
    <button type="button" onClick={() => setAn(x => !x)} aria-pressed={an}
      title={an ? '3D-Ansicht ausschalten' : '3D-Ansicht einschalten'}
      className={`karte-3d absolute right-2.5 top-[92px] z-[2] w-9 h-9 rounded-xl text-[12px] font-extrabold shadow-[0_2px_10px_rgba(0,0,0,.15)] ${an ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-900 hover:bg-zinc-100'}`}>
      3D
    </button>
  );
}

// Meldet den sichtbaren Kartenausschnitt an die Seite, damit sie die Linien dort laden kann.
function AusschnittMelder({ onChange }: { onChange?: (a: Kartenausschnitt) => void }) {
  const { map } = useKarte();
  const melden = useRef(onChange);
  useEffect(() => { melden.current = onChange; }, [onChange]);
  useEffect(() => {
    const f = () => {
      const b = map.getBounds();
      melden.current?.({ minLon: b.getWest(), minLat: b.getSouth(), maxLon: b.getEast(), maxLat: b.getNorth() });
    };
    f();
    map.on('moveend', f);
    return () => { map.off('moveend', f); };
  }, [map]);
  return null;
}

type OrtKreis = { lat: number; lon: number; m: number; ausdehnung?: [number, number, number, number] };

const GESTRICHELT = (breite: number, deckkraft: number, fuellung: number, prefix: string): Ebene[] => [
  { id: `${prefix}-flaeche`, type: 'fill', paint: { 'fill-color': '#000', 'fill-opacity': fuellung }, unterBeschriftung: true },
  { id: `${prefix}-rand`, type: 'line', paint: { 'line-color': '#000', 'line-width': breite, 'line-opacity': deckkraft, 'line-dasharray': [3, 3] }, unterBeschriftung: true },
];
const ORT_EBENEN = GESTRICHELT(2, 0.5, 0.03, 'ort');
const BEZIRK_EBENEN = GESTRICHELT(2, 0.6, 0.04, 'bezirk');

// Gesuchter Ort: Umkreis (oder Ortsgrenze) zeichnen und die Karte dorthin bewegen
function OrtAnzeige({ ort }: { ort: OrtKreis | null }) {
  const { map } = useKarte();
  useEffect(() => {
    if (!ort) return;
    if (ort.m > 0) map.fitBounds(kreisAusdehnung(ort.lat, ort.lon, ort.m), { padding: 20 });
    else if (ort.ausdehnung) map.fitBounds([[ort.ausdehnung[0], ort.ausdehnung[1]], [ort.ausdehnung[2], ort.ausdehnung[3]]], { padding: 20 });
    else map.jumpTo({ center: [ort.lon, ort.lat], zoom: 12 });
  }, [map, ort?.lat, ort?.lon, ort?.m]); // eslint-disable-line react-hooks/exhaustive-deps
  const ausdehnungText = ort?.ausdehnung?.join(',');
  const daten = useMemo<FC>(() => {
    if (!ort || (!(ort.m > 0) && !ort.ausdehnung)) return LEER;
    let ring: [number, number][];
    if (ort.m > 0) ring = kreisRing(ort.lat, ort.lon, ort.m, 64);
    else {
      const [w, s, o, n] = ort.ausdehnung!;
      ring = [[w, s], [o, s], [o, n], [w, n], [w, s]];
    }
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }] };
  }, [ort?.lat, ort?.lon, ort?.m, ausdehnungText]); // eslint-disable-line react-hooks/exhaustive-deps
  useGeoJson('ort', daten, ORT_EBENEN);
  return null;
}

// Gewählte Bezirke: Grenzen zeichnen und die Karte darauf ausrichten
function BezirkeAnzeige({ bezirke }: { bezirke: Bezirk[] }) {
  const { map } = useKarte();
  const schluessel = bezirke.map(b => b.id).join(',');
  useEffect(() => {
    const r = bezirkeAusdehnung(bezirke);
    if (r) map.fitBounds([[r[0], r[1]], [r[2], r[3]]], { padding: 20 });
  }, [map, schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  const daten = useMemo<FC>(() => ({
    type: 'FeatureCollection',
    features: bezirke.filter(b => b.grenze).map(b => ({ type: 'Feature', properties: {}, geometry: b.grenze! })),
  }), [bezirke]);
  useGeoJson('bezirke', daten, BEZIRK_EBENEN);
  return null;
}

// Eine Farbe je gewählter Linie, gut unterscheidbar
const LINIENFARBEN = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#db2777', '#0891b2', '#ca8a04'];
export const linienFarbe = (i: number) => LINIENFARBEN[i % LINIENFARBEN.length];

const KORRIDOR_EBENEN: Ebene[] = [
  { id: 'korridor-flaeche', type: 'fill', paint: { 'fill-color': ['get', 'farbe'], 'fill-opacity': 0.16 }, unterBeschriftung: true },
];
const STRECKEN_EBENEN: Ebene[] = [{
  id: 'strecken-linie', type: 'line', layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': ['get', 'farbe'], 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 14, 4.5], 'line-opacity': 0.9 },
  unterBeschriftung: true,
}];
const HALT_EBENEN: Ebene[] = [{
  id: 'halt-punkte', type: 'circle', minzoom: HALTESTELLEN_AB_ZOOM,
  paint: {
    'circle-radius': ['step', ['zoom'], 3.5, 14, 5],
    'circle-color': '#fff', 'circle-stroke-color': ['get', 'farbe'], 'circle-stroke-width': 2.5,
  },
}];

// Einzugsbereich jeder Linie als eine zusammenhängende Fläche: die Kreise um alle Haltestellen werden
// vorher vereinigt, damit sich Überlappungen nicht dunkler färben. Haltestellen erscheinen erst beim
// Hineinzoomen als kleine Punkte, Antippen zeigt Linie und Namen.
function Linienkorridore({ haltestellen, linien, umkreisM }: { haltestellen: Haltestelle[]; linien: Linie[]; umkreisM: number }) {
  const { map, stil } = useKarte();
  const flaechen = useMemo<FC>(() => ({
    type: 'FeatureCollection',
    features: linien.flatMap((l, i) => {
      const halte = haltestellen.filter(h => h.linie_id === l.linie_id);
      if (halte.length === 0 || !(umkreisM > 0)) return [];
      const kreise = halte.map(h => [kreisRing(h.lat, h.lon, umkreisM)] as PcPolygon);
      const vereint: PcMultiPolygon = polygonClipping.union(kreise[0], ...kreise.slice(1));
      return [{ type: 'Feature' as const, properties: { farbe: linienFarbe(i) }, geometry: { type: 'MultiPolygon' as const, coordinates: vereint } }];
    }),
  }), [haltestellen, linien, umkreisM]);
  const punkte = useMemo<FC>(() => ({
    type: 'FeatureCollection',
    features: linien.flatMap((l, i) => haltestellen.filter(h => h.linie_id === l.linie_id).map(h => ({
      type: 'Feature' as const,
      properties: { farbe: linienFarbe(i), text: `<strong>${esc(l.nummer)}</strong> · ${esc(haltestelleKurz(h.name))}` },
      geometry: { type: 'Point' as const, coordinates: [h.lon, h.lat] },
    }))),
  }), [haltestellen, linien]);
  const [verlaeufe, setVerlaeufe] = useState<Record<number, Verlauf>>({});
  useEffect(() => {
    let aktiv = true;
    for (const l of linien) {
      const halte = haltestellen.filter(h => h.linie_id === l.linie_id);
      streckeLaden(l, halte).then(v => {
        if (aktiv && v) setVerlaeufe(alt => ({ ...alt, [l.linie_id]: v }));
      });
    }
    return () => { aktiv = false; };
  }, [haltestellen, linien]);
  const strecken = useMemo<FC>(() => ({
    type: 'FeatureCollection',
    features: linien.flatMap((l, i) => verlaeufe[l.linie_id] ? [{
      type: 'Feature' as const, properties: { farbe: linienFarbe(i) },
      geometry: { type: 'MultiLineString' as const, coordinates: verlaeufe[l.linie_id] },
    }] : []),
  }), [linien, verlaeufe]);
  useGeoJson('korridore', flaechen, KORRIDOR_EBENEN);
  useGeoJson('strecken', strecken, STRECKEN_EBENEN);
  useGeoJson('haltestellen', punkte, HALT_EBENEN);

  useEffect(() => {
    if (!stil) return;
    const klick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== 'Point') return;
      new Popup({ offset: 8, className: 'karte-popup' }).setLngLat(f.geometry.coordinates as [number, number]).setHTML(String(f.properties?.text ?? '')).addTo(map);
    };
    const zeiger = () => { map.getCanvas().style.cursor = 'pointer'; };
    const normal = () => { map.getCanvas().style.cursor = ''; };
    map.on('click', 'halt-punkte', klick);
    map.on('mouseenter', 'halt-punkte', zeiger);
    map.on('mouseleave', 'halt-punkte', normal);
    return () => sicher(() => {
      map.off('click', 'halt-punkte', klick);
      map.off('mouseenter', 'halt-punkte', zeiger);
      map.off('mouseleave', 'halt-punkte', normal);
    });
  }, [map, stil]);
  return null;
}

// Haltestellen-Symbol (Bahn, Tram, Bus, Fähre); die gewählte Haltestelle größer und schwarz
function stationElement(s: Station, gewaehlt: boolean) {
  return element(`station-symbol${gewaehlt ? ' gewaehlt' : ''}`, verkehrSvg(verkehrArt(s.linien.map(l => l.typ)), gewaehlt ? 18 : 13), gewaehlt ? 32 : 24);
}
const stationPopup = (s: Station) => `<strong>${esc(s.name)}</strong><br />${esc(s.entfernung_m)} m · ${esc(s.linien.map(l => l.nummer).join(', '))}`;

const LUFTLINIE_EBENEN: Ebene[] = [{
  id: 'luftlinie', type: 'line', layout: { 'line-cap': 'round' },
  paint: { 'line-color': '#000', 'line-width': 3, 'line-opacity': 0.7, 'line-dasharray': [0.1, 2.7] },
}];

// Inseratsseite: Haltestellen in der Nähe, die gewählte (anfangs die nächste) hervorgehoben und mit
// gestrichelter Luftlinie zum Inserat. Die Karte zeigt Inserat und gewählte Haltestelle zusammen.
function StationenAnzeige({ stationen, auswahl, von }: { stationen: Station[]; auswahl: number; von: { lat: number; lon: number } }) {
  const { map } = useKarte();
  const ziel = stationen[auswahl];
  useEffect(() => {
    if (!ziel) return;
    // Die Karte kann beim ersten Zeichnen noch ohne Größe sein; dann erst nach dem nächsten Frame ausrichten
    const ausrichten = () => {
      map.resize();
      map.fitBounds(ausdehnung([von, ziel]), { padding: 50, maxZoom: NAH_ZOOM, animate: false });
    };
    ausrichten();
    const f = requestAnimationFrame(ausrichten);
    return () => cancelAnimationFrame(f);
  }, [map, ziel, von.lat, von.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const weg = stationen.map((s, i) => {
      const gewaehlt = i === auswahl;
      return symbolSetzen(map, {
        lat: s.lat, lon: s.lon, element: stationElement(s, gewaehlt), vorn: gewaehlt, abstand: gewaehlt ? 16 : 12,
        label: `${gewaehlt ? 'Gewählte Haltestelle' : 'Haltestelle'} ${s.name} · ${s.entfernung_m} m`,
        tooltip: `${s.name} · ${s.entfernung_m} m`, popup: stationPopup(s),
      });
    });
    return () => weg.forEach(f => f());
  }, [map, stationen, auswahl]);

  const linie = useMemo<FC>(() => ziel ? {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[von.lon, von.lat], [ziel.lon, ziel.lat]] } }],
  } : LEER, [ziel, von.lat, von.lon]);
  useGeoJson('luftlinie', linie, LUFTLINIE_EBENEN);
  return null;
}

const UMKREIS_EBENEN: Ebene[] = [{
  id: 'umkreis', type: 'line',
  paint: { 'line-color': '#000', 'line-width': 1.5, 'line-opacity': 0.5, 'line-dasharray': [2.7, 4] },
}];

// Inseratsseite: eingeblendete Orte der Grundversorgung als Symbole, Name beim Überfahren (Tooltip) und
// Antippen (Popup); der gestrichelte Kreis zeigt den Umkreis. Beim Ein- und Ausblenden passt sich die Karte an.
function OrteAnzeige({ orte, von }: { orte: Ort[]; von: { lat: number; lon: number } }) {
  const { map } = useKarte();
  useEffect(() => {
    if (!orte.length) return;
    map.fitBounds(ausdehnung([von, ...orte]), { padding: 30, maxZoom: NAH_ZOOM, animate: false });
  }, [map, orte, von.lat, von.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const weg = orte.map(o => symbolSetzen(map, {
      lat: o.lat, lon: o.lon, element: element('ort-symbol', symbolSvg(o.art as Art, 14), 26), abstand: 12,
      label: `${artName(o.art)}: ${ortBeschriftung(o)}`, tooltip: ortBeschriftung(o),
      popup: `<strong>${esc(artName(o.art))}</strong><br />${esc(ortBeschriftung(o))}`,
    }));
    return () => weg.forEach(f => f());
  }, [map, orte]);

  const kreis = useMemo<FC>(() => ({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: kreisRing(von.lat, von.lon, UMKREIS_M, 64) } }],
  }), [von.lat, von.lon]);
  useGeoJson('umkreis', kreis, UMKREIS_EBENEN);
  return null;
}

// Preis kurz für den Pin: 1.160 €, 485 Tsd. €, 1,2 Mio. €
function kurzPreis(a: Anzeige) {
  const n = Number(a.transaktions_typ !== 'kaufen' && a.warmmiete ? a.warmmiete : a.preis);
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio. €`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('de-DE')} Tsd. €`;
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
}

// Bis zu dieser Zoomstufe werden nahe Pins zu Gruppen zusammengefasst; darüber stehen alle einzeln,
// Inserate an exakt derselben Stelle werden dann im Kreis aufgefächert.
const GRUPPEN_BIS_ZOOM = 17;

type PinEintrag = { marker: Marker; el: HTMLElement; a?: Anzeige };

function pinHervorheben(p: PinEintrag | undefined, an: boolean) {
  if (!p) return;
  p.el.classList.toggle('aktiv', an);
  p.el.style.zIndex = an ? '10' : '';
}

// Preis-Pins der Anzeigen, nah beieinander liegende werden zu Gruppen mit Anzahl zusammengefasst
function PreisPins({ anzeigen, aktivId, onAuswahl }: { anzeigen: Anzeige[]; aktivId: string | null; onAuswahl?: (id: string) => void }) {
  const { map } = useKarte();
  const auswahl = useRef(onAuswahl);
  useEffect(() => { auswahl.current = onAuswahl; }, [onAuswahl]);
  const aktiv = useRef(aktivId);
  const pins = useRef(new globalThis.Map<string, PinEintrag>());

  const index = useMemo(() => {
    const sc = new Supercluster<{ id: string }>({ radius: 50, maxZoom: GRUPPEN_BIS_ZOOM });
    sc.load(anzeigen.map(a => ({ type: 'Feature', properties: { id: a.id }, geometry: { type: 'Point', coordinates: [a.koordinate_lon, a.koordinate_lat] } })));
    return sc;
  }, [anzeigen]);

  useEffect(() => {
    const nachId = new globalThis.Map(anzeigen.map(a => [a.id, a]));
    const vorhanden = pins.current;

    function zeichnen() {
      const b = map.getBounds();
      const zoom = Math.floor(map.getZoom());
      const teile = index.getClusters([b.getWest() - 0.02, b.getSouth() - 0.02, b.getEast() + 0.02, b.getNorth() + 0.02], zoom);
      // Inserate an derselben Stelle zählen, um sie auffächern zu können
      const stellen = new globalThis.Map<string, string[]>();
      for (const t of teile) {
        if (t.properties && 'cluster' in t.properties) continue;
        const k = (t.geometry.coordinates as number[]).map(x => x.toFixed(6)).join(',');
        stellen.set(k, [...(stellen.get(k) ?? []), (t.properties as { id: string }).id]);
      }
      const behalten = new Set<string>();
      for (const t of teile) {
        const [lon, lat] = t.geometry.coordinates as [number, number];
        const p = t.properties as Supercluster.ClusterProperties | { id: string };
        if ('cluster' in p && p.cluster) {
          const schluessel = `c:${p.cluster_id}:${p.point_count}`;
          behalten.add(schluessel);
          if (vorhanden.has(schluessel)) continue;
          const n = p.point_count;
          const el = element('preis-gruppe', `<span>${n}</span>`, n < 10 ? 36 : n < 100 ? 44 : 52);
          el.setAttribute('role', 'button');
          el.tabIndex = 0;
          el.setAttribute('aria-label', `${n} Anzeigen, hineinzoomen`);
          const hinein = (e: Event) => {
            e.stopPropagation();
            map.easeTo({ center: [lon, lat], zoom: Math.min(index.getClusterExpansionZoom(p.cluster_id), MAX_ZOOM) });
          };
          el.addEventListener('click', hinein);
          el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hinein(e); } });
          vorhanden.set(schluessel, { marker: new Marker({ element: el }).setLngLat([lon, lat]).addTo(map), el });
        } else {
          const id = (p as { id: string }).id;
          const a = nachId.get(id);
          if (!a) continue;
          const schluessel = `a:${id}`;
          behalten.add(schluessel);
          const gleich = stellen.get([lon, lat].map(x => x.toFixed(6)).join(',')) ?? [id];
          const i = gleich.indexOf(id);
          const versatz: [number, number] = gleich.length > 1
            ? [Math.cos((i / gleich.length) * 2 * Math.PI) * 34, Math.sin((i / gleich.length) * 2 * Math.PI) * 22]
            : [0, 0];
          const da = vorhanden.get(schluessel);
          if (da) { da.marker.setOffset(versatz); continue; }
          const el = element(`preis-pin${aktiv.current === id ? ' aktiv' : ''}`, `<span>${esc(kurzPreis(a))}</span>`);
          if (aktiv.current === id) el.style.zIndex = '10';
          el.setAttribute('role', 'button');
          el.tabIndex = 0;
          el.setAttribute('aria-label', `${a.titel ? `${a.titel}, ` : ''}${kurzPreis(a)}`);
          const waehlen = (e: Event) => { e.stopPropagation(); auswahl.current?.(id); };
          el.addEventListener('click', waehlen);
          el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); waehlen(e); } });
          vorhanden.set(schluessel, { marker: new Marker({ element: el, offset: versatz }).setLngLat([lon, lat]).addTo(map), el, a });
        }
      }
      for (const [k, e] of vorhanden) if (!behalten.has(k)) { e.marker.remove(); vorhanden.delete(k); }
    }

    zeichnen();
    map.on('moveend', zeichnen);
    return () => {
      map.off('moveend', zeichnen);
      for (const e of vorhanden.values()) e.marker.remove();
      vorhanden.clear();
    };
  }, [map, index, anzeigen]);

  // Aktiven Pin (Hover in der Liste oder ausgewählt) schwarz und nach vorn
  useEffect(() => {
    const vorher = aktiv.current;
    aktiv.current = aktivId;
    if (vorher) pinHervorheben(pins.current.get(`a:${vorher}`), false);
    if (aktivId) pinHervorheben(pins.current.get(`a:${aktivId}`), true);
  }, [aktivId, anzeigen]);
  return null;
}

// Springt zu einer Anzeige (z. B. nach Klick in der Liste auf dem Handy)
function Fokus({ fokus, anzeigen }: { fokus: MapProps['fokus']; anzeigen: Anzeige[] }) {
  const { map } = useKarte();
  useEffect(() => {
    const a = fokus && anzeigen.find(x => x.id === fokus.id);
    if (a) map.easeTo({ center: [a.koordinate_lon, a.koordinate_lat], zoom: Math.max(map.getZoom(), NAH_ZOOM) });
  }, [map, fokus]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Klick auf die freie Karte hebt die Auswahl auf (Klicks auf Pins und Symbole zählen nicht)
function KlickLeer({ onKlick }: { onKlick?: () => void }) {
  const { map } = useKarte();
  const klick = useRef(onKlick);
  useEffect(() => { klick.current = onKlick; }, [onKlick]);
  useEffect(() => {
    const f = (e: MapMouseEvent) => { if (e.originalEvent.target === map.getCanvas()) klick.current?.(); };
    map.on('click', f);
    return () => { map.off('click', f); };
  }, [map]);
  return null;
}

interface MapProps {
  anzeigen: Anzeige[];
  haltestellen: Haltestelle[];
  linienUmkreisM: number;
  ortKreis: OrtKreis | null;
  bezirke: Bezirk[];
  // Anzeige, zu der die Karte springen soll (nr ändert sich bei jedem Klick)
  fokus?: { id: string; nr: number } | null;
  aktivId?: string | null;
  onAuswahl?: (id: string | null) => void;
  linien?: Linie[];
  onAusschnittChange?: (a: Kartenausschnitt) => void;
  // Inseratsseite: Haltestellen in der Nähe der ersten Anzeige und die gewählte davon
  stationen?: Station[];
  stationAuswahl?: number;
  // Inseratsseite: eingeblendete Orte der Grundversorgung
  orte?: Ort[];
  // Karte startet geneigt mit 3D-Gebäuden (Inseratsseite)
  start3D?: boolean;
}

export default function Map({ anzeigen, haltestellen, linien = [], linienUmkreisM, ortKreis, bezirke, fokus = null, aktivId = null, onAuswahl, onAusschnittChange, stationen, stationAuswahl = 0, orte, start3D = false }: MapProps) {
  const box = useRef<HTMLDivElement>(null);
  const [karte, setKarte] = useState<{ map: KartenMap; stil: number } | null>(null);

  useEffect(() => {
    const map = new KartenMap({
      container: box.current!, style: KARTE_STIL, center: [13.42, 52.516], zoom: START_ZOOM, maxZoom: MAX_ZOOM,
      attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      locale: { 'NavigationControl.ZoomIn': 'Hineinzoomen', 'NavigationControl.ZoomOut': 'Herauszoomen' },
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    let stil = 0, ersatz = false;
    // Quellenhinweis in der Kartenecke: OpenFreeMap liefert ihn mit den Kacheln (TileJSON) selbst. Unserer steht
    // nur beim Ersatzstil da, damit er nie doppelt erscheint. Fahrplandaten (DELFI) stehen in der Fußzeile und
    // unter Impressum › Datenquellen.
    let hinweis = false;
    map.on('style.load', () => {
      if (!hinweis) {
        hinweis = true;
        map.addControl(new AttributionControl({ compact: false, customAttribution: ersatz ? KARTE_HINWEIS : undefined }), 'bottom-right');
      }
      stil += 1;
      setKarte({ map, stil });
    });
    map.on('error', () => {
      if (stil === 0 && !ersatz) { ersatz = true; map.setStyle(ERSATZ_STIL, { diff: false }); }
    });
    setKarte({ map, stil: 0 });

    // Die Karte merkt nicht von selbst, wenn ihr Bereich ein- oder ausgeblendet wird (Umschalter auf dem Handy)
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current!);
    return () => { ro.disconnect(); setKarte(null); map.remove(); };
  }, []);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {karte && (
        <KarteKontext.Provider value={karte}>
          <Gebaeude3D start={start3D} />
          <AusschnittMelder onChange={onAusschnittChange} />
          <BezirkeAnzeige bezirke={bezirke} />
          <OrtAnzeige ort={ortKreis} />
          <Fokus fokus={fokus} anzeigen={anzeigen} />
          <KlickLeer onKlick={() => onAuswahl?.(null)} />
          <Linienkorridore haltestellen={haltestellen} linien={linien} umkreisM={linienUmkreisM} />
          {stationen && anzeigen[0] && (
            <StationenAnzeige stationen={stationen} auswahl={stationAuswahl}
              von={{ lat: anzeigen[0].koordinate_lat, lon: anzeigen[0].koordinate_lon }} />
          )}
          {orte && anzeigen[0] && <OrteAnzeige orte={orte} von={{ lat: anzeigen[0].koordinate_lat, lon: anzeigen[0].koordinate_lon }} />}
          <PreisPins anzeigen={anzeigen} aktivId={aktivId} onAuswahl={(id) => onAuswahl?.(id)} />
        </KarteKontext.Provider>
      )}
      {linien.length > 0 && (
        <div className="absolute left-3 top-3 z-[1000] flex flex-wrap gap-1.5 max-w-[70%] pointer-events-none">
          {linien.map((l, i) => (
            <span key={l.linie_id} className="flex items-center gap-1.5 bg-white/95 rounded-full pl-1 pr-2.5 py-1 shadow-md text-xs font-semibold">
              <span className="px-1.5 py-0.5 rounded-full text-white text-[11px] font-bold" style={{ background: linienFarbe(i) }}>{l.nummer}</span>
              {linienUmkreisM} m
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
