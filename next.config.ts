/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // <-- Das schaltet das doppelte Laden ab
  output: 'export',
  basePath: '/ImmoBerlin',
};

export default nextConfig;
