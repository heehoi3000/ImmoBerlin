// Titel und Suchmaschinen-Angaben für /anzeige/ (die Seite selbst läuft im Browser und kann keine Metadaten exportieren)
import type { Metadata } from 'next';
import { vorschau } from '../../lib/seite';

export const metadata: Metadata = {
  title: 'Inserat',
  description: 'Wohnung oder Haus auf IMMOBIL mit Lage, Ausstattung und Entfernung zur nächsten Haltestelle.',
  openGraph: vorschau('Inserat – IMMOBIL', 'Wohnung oder Haus auf IMMOBIL mit Lage, Ausstattung und Entfernung zur nächsten Haltestelle.'),
  alternates: { canonical: './' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
