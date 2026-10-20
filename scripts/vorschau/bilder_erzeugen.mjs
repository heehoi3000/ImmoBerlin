// Erzeugt die Vorschaubilder in public/: vorschau.png (geteilte Links, 1200×630), icon.png (Browser-Tab),
// apple-icon.png (Startbildschirm). Nach Änderungen ausführen und die PNGs committen:
//   node scripts/vorschau/bilder_erzeugen.mjs
// Fest als PNG statt beim Build, weil GitHub Pages Dateien ohne Endung nicht als Bild ausliefert.
import { readFileSync, writeFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

const ordner = new URL('.', import.meta.url);
const schrift = gewicht => ({ name: 'Outfit', data: readFileSync(new URL(`schrift/outfit-${gewicht}.ttf`, ordner)), weight: gewicht, style: 'normal' });
const fonts = [schrift(300), schrift(700), schrift(800)];

const div = (style, ...kinder) => h('div', { style: { display: 'flex', ...style } }, ...kinder);

const LINIEN = [
  { farbe: '#1d4ed8', y: 150, name: 'U8' },
  { farbe: '#15803d', y: 280, name: 'S41' },
  { farbe: '#b91c1c', y: 450, name: 'M10' },
];
const HALTE = [70, 200, 330];

function logo(groesse) {
  return div({ alignItems: 'baseline', fontSize: groesse, letterSpacing: -groesse * 0.04, lineHeight: 1 },
    h('span', { style: { fontWeight: 800, color: '#09090b' } }, 'IMMO'),
    h('span', { style: { fontWeight: 300, color: '#71717b', marginLeft: groesse * 0.03 } }, 'BIL'));
}

const haus = h('svg', { width: 56, height: 56, viewBox: '0 0 24 24' },
  h('path', { d: 'M3 11 12 3l9 8v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', fill: '#09090b' }));

const vorschau = div({ width: '100%', height: '100%', background: '#ffffff', padding: '72px 80px', position: 'relative' },
  div({ flexDirection: 'column', width: 660 },
    logo(104),
    div({ fontSize: 58, fontWeight: 700, color: '#09090b', marginTop: 48, lineHeight: 1.12, letterSpacing: -1 }, 'Wohnungen nah an Bahn, Tram und Bus'),
    div({ fontSize: 30, fontWeight: 300, color: '#3f3f46', marginTop: 28, lineHeight: 1.35 },
      'Linie wählen, Umkreis festlegen und passende Wohnungen und Häuser in ganz Deutschland sehen.')),
  div({ position: 'absolute', right: 0, top: 0, width: 440, height: 630 },
    // Umkreis um eine Haltestelle der S41 mit einer Wohnung darin
    div({ position: 'absolute', left: 116, top: 196, width: 200, height: 200, borderRadius: 100, background: 'rgba(21,128,61,0.08)', border: '4px dashed #15803d' }),
    ...LINIEN.map(l => div({ position: 'absolute', left: 40, top: l.y, width: 400, height: 14, background: l.farbe, borderRadius: 7 })),
    ...LINIEN.flatMap(l => HALTE.map(x => div({ position: 'absolute', left: x, top: l.y - 9, width: 32, height: 32, borderRadius: 16, background: '#ffffff', border: `7px solid ${l.farbe}` }))),
    ...LINIEN.map(l => div({ position: 'absolute', left: 40, top: l.y - 64, padding: '2px 14px', borderRadius: 8, background: l.farbe, color: '#ffffff', fontSize: 30, fontWeight: 700 }, l.name)),
    div({ position: 'absolute', left: 236, top: 318 }, haus)),
);

function symbol(groesse, rund) {
  return div({ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: '#09090b', borderRadius: rund ? groesse * 0.22 : 0 },
    div({ fontSize: groesse * 0.42, fontWeight: 800, color: '#ffffff', letterSpacing: -groesse * 0.02 }, 'IM'));
}

async function speichern(datei, element, breite, hoehe) {
  const bild = new ImageResponse(element, { width: breite, height: hoehe, fonts });
  writeFileSync(new URL(`../../public/${datei}`, ordner), Buffer.from(await bild.arrayBuffer()));
  console.log(`public/${datei} (${breite}×${hoehe})`);
}

await speichern('vorschau.png', vorschau, 1200, 630);
await speichern('icon.png', symbol(64, true), 64, 64);
await speichern('apple-icon.png', symbol(180, false), 180, 180);
