// Symbole der Grundversorgung (eigene Zeichnungen, 24 × 24, Linienstärke 2). Als SVG-Text, weil sie sowohl
// in React (Liste) als auch in Leaflet-Markern (L.divIcon, nur HTML) gebraucht werden.
import { Art } from './grundversorgung';

const PFADE: Record<Art, string> = {
  supermarkt: '<circle cx="8" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 7H6"/>',
  drogerie: '<path d="M10 2h4v3h-4z"/><path d="M9 5h6l1 4v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9z"/><path d="M8 13h8"/>',
  baeckerei: '<path d="M5 10a3 3 0 0 1 0-6h14a3 3 0 0 1 0 6v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 4v3M15 4v3"/>',
  apotheke: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  hausarzt: '<path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
  post: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/>',
  geldautomat: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  kita: '<circle cx="12" cy="5" r="3"/><path d="M12 8v7"/><path d="M7 11h10"/><path d="M9 21l3-6 3 6"/>',
  schule: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/>',
  spielplatz: '<path d="M4 21V5l8-2 8 2v16"/><path d="M4 12h16"/><path d="M8 12l-2 9M16 12l2 9"/>',
  park: '<path d="M12 2l6 9h-3l4 6H5l4-6H6z"/><path d="M12 17v5"/>',
};

export function symbolSvg(art: Art, groesse = 16) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${groesse}" height="${groesse}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PFADE[art]}</svg>`;
}
