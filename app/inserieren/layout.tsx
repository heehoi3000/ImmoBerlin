// Titel und Suchmaschinen-Angaben für /inserieren/ (die Seite selbst läuft im Browser und kann keine Metadaten exportieren)
import type { Metadata } from 'next';
import { vorschau } from '../../lib/seite';

export const metadata: Metadata = {
  title: 'Inserat aufgeben',
  description: 'Wohnung oder Haus kostenlos inserieren und Menschen erreichen, die nah an einer bestimmten Bahn-, Tram- oder Buslinie wohnen wollen.',
  openGraph: vorschau('Inserat aufgeben – IMMOBIL', 'Wohnung oder Haus kostenlos inserieren und Menschen erreichen, die nah an einer bestimmten Bahn-, Tram- oder Buslinie wohnen wollen.'),
  alternates: { canonical: './' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
