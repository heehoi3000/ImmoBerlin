// Titel und Suchmaschinen-Angaben für /merkliste/ (die Seite selbst läuft im Browser und kann keine Metadaten exportieren)
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Merkliste',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
