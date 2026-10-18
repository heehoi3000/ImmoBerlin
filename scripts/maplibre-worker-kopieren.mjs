// Kopiert den Web Worker von MapLibre nach public/maplibre/, damit er neben der
// statischen Seite liegt. Next.js bündelt ihn nicht mit, ohne ihn bleibt die Karte grau.
// Läuft automatisch vor "npm run dev" und "npm run build".
import { copyFileSync, mkdirSync } from 'node:fs';

const quelle = 'node_modules/maplibre-gl/dist';
const ziel = 'public/maplibre';
mkdirSync(ziel, { recursive: true });
for (const datei of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(`${quelle}/${datei}`, `${ziel}/${datei}`);
}
