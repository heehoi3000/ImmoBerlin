import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Rahmen from "./Rahmen";
import { BESCHREIBUNG, SEITEN_NAME, SEITEN_URL, vorschau } from "../lib/seite";
import { BASIS } from "../lib/basis";

const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`${SEITEN_URL}/`),
  title: { default: "IMMOBIL – Wohnungen nah an Bahn, Tram und Bus finden", template: "%s – IMMOBIL" },
  description: BESCHREIBUNG,
  applicationName: SEITEN_NAME,
  openGraph: vorschau("IMMOBIL – Wohnungen nah an Bahn, Tram und Bus"),
  twitter: { card: "summary_large_image" },
  // fest als Pfad mit BASIS, weil Next.js den Seitenpfad bei Symbolen nicht ergänzt
  icons: { icon: `${BASIS}/icon.png`, apple: `${BASIS}/apple-icon.png` },
  formatDetection: { telephone: false },
};

// Strukturierte Angaben für Suchmaschinen (Name der Website in den Suchergebnissen)
const STRUKTUR = { "@context": "https://schema.org", "@type": "WebSite", name: SEITEN_NAME, url: `${SEITEN_URL}/`, inLanguage: "de" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${outfit.className} antialiased min-h-screen flex flex-col bg-zinc-50 text-zinc-900`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUKTUR) }} />
        <Rahmen>{children}</Rahmen>
      </body>
    </html>
  );
}