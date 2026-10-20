// Pfad, unter dem die Seite liegt: auf GitHub Pages /ImmoBerlin, auf der eigenen Domain leer (Seite direkt unter /).
// Beim Build über NEXT_PUBLIC_BASIS_PFAD wählbar, z. B. NEXT_PUBLIC_BASIS_PFAD= npm run build für die eigene Domain.
const basis = process.env.NEXT_PUBLIC_BASIS_PFAD ?? '/ImmoBerlin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // <-- Das schaltet das doppelte Laden ab
  output: 'export',
  basePath: basis,
  trailingSlash: true, // jede Seite als ordner/index.html, damit GitHub Pages /konto/ usw. findet
  env: { NEXT_PUBLIC_BASIS_PFAD: basis }, // derselbe Wert für den Code im Browser (lib/basis.ts)
};

export default nextConfig;
