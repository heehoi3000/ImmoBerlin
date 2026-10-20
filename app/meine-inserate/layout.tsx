// Titel und Suchmaschinen-Angaben für /meine-inserate/ (die Seite selbst läuft im Browser und kann keine Metadaten exportieren)
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Meine Inserate',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
