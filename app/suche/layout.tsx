// Titel und Suchmaschinen-Angaben für /suche/ (die Seite selbst läuft im Browser und kann keine Metadaten exportieren)
import type { Metadata } from 'next';
import { vorschau } from '../../lib/seite';

export const metadata: Metadata = {
  title: 'Wohnungen und Häuser suchen',
  description: 'Suche Mietwohnungen, Häuser und Eigentum nach Ort, Bezirk und ÖPNV-Linie. Lege fest, wie weit die nächste Haltestelle höchstens entfernt sein darf.',
  openGraph: vorschau('Wohnungen und Häuser suchen – IMMOBIL', 'Suche Mietwohnungen, Häuser und Eigentum nach Ort, Bezirk und ÖPNV-Linie. Lege fest, wie weit die nächste Haltestelle höchstens entfernt sein darf.'),
  alternates: { canonical: './' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
