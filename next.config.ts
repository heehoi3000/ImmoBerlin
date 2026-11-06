import { readFileSync } from 'node:fs';

// Pfad, unter dem die Seite liegt: auf GitHub Pages /ImmoBerlin, auf der eigenen Domain leer (Seite direkt unter /).
// Beim Build über NEXT_PUBLIC_BASIS_PFAD wählbar, z. B. NEXT_PUBLIC_BASIS_PFAD= npm run build für die eigene Domain.
const basis = process.env.NEXT_PUBLIC_BASIS_PFAD ?? '/ImmoBerlin';

// Stand der Streckendaten (public/strecken/stand.json, vom Deploy hineinkopiert). Er hängt an jeder Dateiadresse,
// damit Browser nach einem Daten-Update nicht die alten, zwischengespeicherten Dateien nehmen (lib/strecken.ts).
let streckenStand = '';
try {
  streckenStand = String(JSON.parse(readFileSync('public/strecken/stand.json', 'utf8')).stand ?? '').replace(/[^0-9]/g, '');
} catch { /* keine Streckendaten im Build */ }

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // <-- Das schaltet das doppelte Laden ab
  output: 'export',
  basePath: basis,
  trailingSlash: true, // jede Seite als ordner/index.html, damit GitHub Pages /konto/ usw. findet
  env: { NEXT_PUBLIC_BASIS_PFAD: basis, NEXT_PUBLIC_STRECKEN_STAND: streckenStand }, // Werte für den Code im Browser
};

export default nextConfig;
