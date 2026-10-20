// Ortssuche aus vorab erzeugten Dateien (scripts/gebiete/gebiete_bauen.py), ohne Anfrage an fremde Dienste.
// Je zwei Anfangszeichen gibt es eine Datei mit allen Orten, Bezirken, Ortsteilen und PLZ-Gebieten,
// deren eigener Name ein Wort mit diesen Zeichen hat. Nach dem ersten Zeichen reichen die größten Orte.
import { Ort } from './filter';
import { GEBIETE_URL } from './bezirke';

interface OrtEintrag {
  n: string;                                // Anzeige, z. B. "Potsdam, Brandenburg"
  k: string;                                // eigener Name, z. B. "Potsdam"
  a: number; o: number;                     // Mittelpunkt (lat, lon)
  b: [number, number, number, number];      // Ausdehnung [minLon, minLat, maxLon, maxLat]
  r?: number;                               // OSM-Relation, wenn es eine Grenze unter g/ gibt
  w: number;                                // Gewicht für die Reihenfolge (Einwohner)
}

// Muss zu normalisieren() in scripts/gebiete/gebiete_bauen.py passen
export function normalisieren(text: string): string {
  // "koeln" und "köln" sollen dasselbe finden
  return text.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/\p{Mn}/gu, '')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

const dateiCache: Record<string, Promise<OrtEintrag[]>> = {};
// null heißt: keine Dateien vorhanden (z. B. beim Entwickeln ohne Gebietsdaten), dann sucht die Seite bei Photon
let erstesZeichen: Promise<Record<string, OrtEintrag[]> | null> | null = null;

function laden<T>(pfad: string, leer: T): Promise<T> {
  return fetch(`${GEBIETE_URL}/o/${pfad}`).then(a => {
    if (a.status === 404) return leer;
    if (!a.ok) throw new Error(`Ortssuche ${pfad}: ${a.status}`);
    return a.json();
  });
}

function datei(schluessel: string): Promise<OrtEintrag[]> {
  if (!dateiCache[schluessel]) {
    dateiCache[schluessel] = laden<OrtEintrag[]>(`${schluessel}.json`, []);
    dateiCache[schluessel].catch(() => { delete dateiCache[schluessel]; });
  }
  return dateiCache[schluessel];
}

function alsOrt(e: OrtEintrag): Ort {
  return { name: e.n, kurzname: e.k, lat: e.a, lon: e.o, ausdehnung: e.b, osmRelation: e.r };
}

// null: keine vorab erzeugten Dateien vorhanden
export async function orteSuchen(suchtext: string, anzahl = 6): Promise<Ort[] | null> {
  if (!erstesZeichen) {
    erstesZeichen = laden<Record<string, OrtEintrag[]> | null>('_1.json', null);
    erstesZeichen.catch(() => { erstesZeichen = null; });
  }
  const top = await erstesZeichen;
  if (!top) return null;
  const worte = normalisieren(suchtext).split(' ').filter(Boolean);
  if (!worte.length) return [];
  const erstes = worte[0];
  let kandidaten: OrtEintrag[];
  if (erstes.length === 1 && worte.length === 1) {
    kandidaten = top[erstes] ?? [];
  } else {
    kandidaten = await datei(erstes.slice(0, 2));
  }
  // Das erste Wort muss ein Wort des eigenen Namens beginnen, alle weiteren irgendein Wort der Anzeige
  const treffer = kandidaten.filter(e => {
    const eigen = normalisieren(e.k).split(' ');
    const alle = normalisieren(e.n).split(' ');
    return eigen.some(w => w.startsWith(erstes)) && worte.slice(1).every(q => alle.some(w => w.startsWith(q)));
  });
  // Genauer Treffer und Namensanfang zählen mehr als ein Treffer mitten im Namen, große Orte mehr als kleine
  const suche = worte.join(' ');
  const punkte = (e: OrtEintrag) => {
    const k = normalisieren(e.k);
    return (e.w + 1) * (k === suche ? 10 : k.startsWith(suche) ? 3 : 1);
  };
  treffer.sort((x, y) => punkte(y) - punkte(x));
  return treffer.slice(0, anzahl).map(alsOrt);
}
