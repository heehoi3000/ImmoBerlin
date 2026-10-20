// Öffentliche Adresse der Seite für Vorschaubilder, Sitemap und Suchmaschinen.
// Auf der eigenen Domain beim Build NEXT_PUBLIC_SEITEN_URL=https://… setzen (ohne / am Ende).
import { BASIS } from './basis';

export const SEITEN_URL = process.env.NEXT_PUBLIC_SEITEN_URL ?? `https://heehoi3000.github.io${BASIS}`;
export const SEITEN_NAME = 'IMMOBIL';
export const BESCHREIBUNG = 'Finde Wohnungen und Häuser in ganz Deutschland, die nah an deiner Bahn-, Tram- oder Buslinie liegen. Kostenlos suchen und inserieren.';

// Angaben für geteilte Links (Open Graph); jede Seite ersetzt die der Startseite ganz, daher immer vollständig
export function vorschau(titel: string, beschreibung: string = BESCHREIBUNG) {
  return {
    type: 'website' as const, locale: 'de_DE', siteName: SEITEN_NAME, title: titel, description: beschreibung, url: './',
    // public/vorschau.png, erzeugt mit scripts/vorschau/bilder_erzeugen.mjs
    images: [{ url: `${SEITEN_URL}/vorschau.png`, width: 1200, height: 630, alt: 'IMMOBIL – Wohnungen nah an Bahn, Tram und Bus finden' }],
  };
}
