/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // <-- Das schaltet das doppelte Laden ab
  output: 'export',
  basePath: '/ImmoBerlin',
  trailingSlash: true, // jede Seite als ordner/index.html, damit GitHub Pages /konto/ usw. findet
};

export default nextConfig;
