// Liefert den statischen Export (out/) unter dem Seitenpfad aus (Standard /ImmoBerlin), wie GitHub Pages oder später der eigene Server.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const WURZEL = join(process.cwd(), 'out');
const BASIS = process.env.NEXT_PUBLIC_BASIS_PFAD ?? '/ImmoBerlin';
const PORT = Number(process.env.PORT ?? 4173);
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };

createServer(async (req, res) => {
  const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!pfad.startsWith(BASIS)) { res.writeHead(404).end(); return; }
  let datei = normalize(join(WURZEL, pfad.slice(BASIS.length)));
  if (!datei.startsWith(WURZEL)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] ?? 'application/octet-stream' }).end(await readFile(datei));
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, () => console.log(`Testserver auf http://localhost:${PORT}${BASIS}/`));
