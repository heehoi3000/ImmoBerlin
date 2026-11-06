// Echter Streckenverlauf einer Linie aus vorab erzeugten Dateien unter public/strecken
// (OpenStreetMap-Linienrelationen, siehe scripts/strecken/strecken_bauen.py und Workflow strecken.yml).
//   i/<gruppe>/<schluessel>.json  [[relation, betreiber, [west, süd, ost, nord]], ...]
//   r/<relation>.json             {"p": ["<polyline>", ...]}
// Gleiche Liniennummern gibt es in vielen Städten; passend ist eine Relation erst, wenn die Haltestellen
// unserer Linie in ihrem Rechteck liegen und der Verlauf wirklich an ihnen vorbeiführt.
// Fehlt die Datei oder passt nichts, bleibt es beim Korridor um die Haltestellen.
import { BASIS } from './basis';

export const STRECKEN_URL = `${BASIS}/strecken`;

type Punkt = { lat: number; lon: number };
export type Eintrag = [number, string, [number, number, number, number], string?];   // ..., Linienfarbe (#rrggbb oder '')
export type Verlauf = [number, number][][];   // Linienzüge aus [lon, lat]

// Liniennummer wie im Skript: klein, Umlaute ausgeschrieben, nur a-z/0-9 ("S 41" -> "s41")
export function schluessel(ref: string): string {
  return ref.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
}

// Unsere Linientypen -> Gruppen der Dateien. Stadtbahnen (Köln, Stuttgart, ...) heißen bei uns U-Bahn,
// sind in OpenStreetMap aber meist als Tram oder Light Rail eingetragen.
const GRUPPEN: Record<string, string[]> = {
  ubahn: ['u', 't'], tram: ['t'], sbahn: ['z'], regional: ['z'], fern: ['z'],
  bus: ['b'], ersatzverkehr: ['b'], faehre: ['f'],
};
export const gruppenFuer = (typ: string) => GRUPPEN[typ] ?? [];

const RAND = 0.01;          // Grad Spielraum ums Rechteck (gut 1 km)
const NAH_M = 400;          // so nah muss der Verlauf an einer Haltestelle vorbeiführen
const MIN_ANTEIL = 0.8;     // Anteil der Haltestellen im Rechteck bzw. nahe am Verlauf
const MAX_RELATIONEN = 4;   // meist Hin- und Rückrichtung, manchmal Varianten

const vereinfachen = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

// Kandidaten aus dem Verzeichnis: Haltestellen müssen im Rechteck liegen, das Rechteck darf nicht viel
// größer sein als das der Haltestellen. Passender Betreiber geht vor.
export function kandidaten(eintraege: Eintrag[], halte: Punkt[], betreiber = ''): number[] {
  if (halte.length === 0) return [];
  const lats = halte.map(h => h.lat), lons = halte.map(h => h.lon);
  const hb = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  const bewertet = eintraege.map(([rid, betr, [w, s, o, n]]) => {
    const drin = halte.filter(h => h.lon >= w - RAND && h.lon <= o + RAND && h.lat >= s - RAND && h.lat <= n + RAND).length;
    const zuGross = (o - w) > 3 * (hb[2] - hb[0]) + 0.05 || (n - s) > 3 * (hb[3] - hb[1]) + 0.05;
    const b = vereinfachen(betreiber), e = vereinfachen(betr);
    const gleicherBetreiber = !!b && !!e && (b.includes(e) || e.includes(b));
    return { rid, anteil: zuGross ? 0 : drin / halte.length, gleicherBetreiber };
  }).filter(k => k.anteil >= MIN_ANTEIL);
  if (bewertet.length === 0) return [];
  const mitBetreiber = bewertet.filter(k => k.gleicherBetreiber);
  const auswahl = mitBetreiber.length > 0 ? mitBetreiber : bewertet;
  const beste = Math.max(...auswahl.map(k => k.anteil));
  return auswahl.filter(k => k.anteil >= beste - 0.05).sort((a, b) => b.anteil - a.anteil).map(k => k.rid);
}

// Google-Polyline (5 Stellen) -> [[lon, lat], ...]
export function dekodieren(s: string): [number, number][] {
  const aus: [number, number][] = [];
  let i = 0, lat = 0, lon = 0;
  while (i < s.length) {
    for (const feld of [0, 1]) {
      let wert = 0, verschiebung = 0, b: number;
      do {
        b = s.charCodeAt(i++) - 63;
        wert |= (b & 0x1f) << verschiebung;
        verschiebung += 5;
      } while (b >= 0x20);
      const d = wert & 1 ? ~(wert >> 1) : wert >> 1;
      if (feld === 0) lat += d; else lon += d;
    }
    aus.push([lon / 1e5, lat / 1e5]);
  }
  return aus;
}

// Abstand in Metern von p zum nächsten Abschnitt des Verlaufs (flache Näherung, reicht für einige 100 m)
function abstandM(p: Punkt, verlauf: Verlauf): number {
  const kx = 111320 * Math.cos(p.lat * Math.PI / 180), ky = 110540;
  let best = Infinity;
  for (const zug of verlauf) {
    for (let j = 0; j < zug.length; j++) {
      const ax = (zug[j][0] - p.lon) * kx, ay = (zug[j][1] - p.lat) * ky;
      if (j === 0) { best = Math.min(best, Math.hypot(ax, ay)); continue; }
      const bx = (zug[j - 1][0] - p.lon) * kx, by = (zug[j - 1][1] - p.lat) * ky;
      const dx = ax - bx, dy = ay - by, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.max(0, Math.min(1, -(bx * dx + by * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(bx + t * dx, by + t * dy));
    }
  }
  return best;
}

// Führt der Verlauf an (fast) allen Haltestellen vorbei?
export function passtZuHaltestellen(verlauf: Verlauf, halte: Punkt[]): boolean {
  if (halte.length === 0 || verlauf.length === 0) return false;
  const nah = halte.filter(h => abstandM(h, verlauf) <= NAH_M).length;
  return nah / halte.length >= MIN_ANTEIL;
}

const cache = new Map<string, Promise<unknown>>();
function laden<T>(pfad: string): Promise<T | null> {
  if (!cache.has(pfad)) {
    cache.set(pfad, fetch(`${STRECKEN_URL}/${pfad}`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null));
  }
  return cache.get(pfad) as Promise<T | null>;
}

// Linienfarbe aus OpenStreetMap (colour), nur wenn sie auf der hellen Karte sichtbar bleibt
export function farbeGueltig(f?: string): string | null {
  if (!f || !/^#[0-9a-f]{6}$/i.test(f)) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(f.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.85 ? null : f.toLowerCase();
}

export interface Strecke { verlauf: Verlauf; farbe: string | null }

// Verlauf einer Linie (mit ihrer echten Farbe, falls eingetragen) oder null, wenn keiner sicher passt
export async function streckeLaden(linie: { typ: string; nummer: string; betreiber?: string }, halte: Punkt[]): Promise<Strecke | null> {
  const k = schluessel(linie.nummer);
  if (!k || halte.length < 2) return null;
  for (const g of gruppenFuer(linie.typ)) {
    const eintraege = await laden<Eintrag[]>(`i/${g}/${k}.json`);
    if (!Array.isArray(eintraege)) continue;
    const ids = kandidaten(eintraege, halte, linie.betreiber).slice(0, MAX_RELATIONEN);
    const verlauf: Verlauf = [];
    let farbe: string | null = null;
    const daten = await Promise.all(ids.map(rid => laden<{ p: string[] }>(`r/${rid}.json`)));
    daten.forEach((d, i) => {
      const zuege = (d?.p ?? []).map(dekodieren).filter(z => z.length >= 2);
      if (zuege.length === 0 || !passtZuHaltestellen(zuege, halte)) return;
      verlauf.push(...zuege);
      farbe ??= farbeGueltig(eintraege.find(e => e[0] === ids[i])?.[3]);
    });
    if (verlauf.length > 0) return { verlauf, farbe };
  }
  return null;
}
