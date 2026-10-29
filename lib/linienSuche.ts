// Linien nach Nummer, Betreiber oder Endstation suchen und nach Passgenauigkeit und Nähe sortieren: ohne Ort
// deutschlandweit, mit Ort nur Linien mit einer Haltestelle im Ort (RPC linien_im_gebiet, Migration 0015).
// Gemeinsam genutzt von der Linienauswahl in der Suche und dem Linienfeld auf der Startseite.
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { Linie, punktAusEwkb, LINIENTYPEN } from './oepnv';
import { Bezirk, Ort, entfernungM } from './filter';
import { bezirksgrenzeLaden } from './bezirke';

// Auswahl für die maximale Entfernung zur Haltestelle (Startseite und Suche)
export const UMKREISE_M = [300, 600, 1000, 1500, 2000];

// Breite Suche (Betreiber, Endpunkte, Nummernanfang) liefert höchstens so viele Linien
const MAX_TREFFER = 400;

type Treffer = Linie & { km: number | null; guete: number };

type Flaeche = NonNullable<Bezirk['grenze']>;

// Höchstens so viele Punkte je Ring gehen an die Datenbank; die Ortsgrenze braucht für die Liniensuche keine 10 m Genauigkeit
const MAX_PUNKTE_JE_RING = 300;
const MAX_TEILE = 30;

function ringVereinfachen(ring: number[][]): number[][] {
  if (ring.length <= MAX_PUNKTE_JE_RING) return ring;
  const schritt = Math.ceil(ring.length / MAX_PUNKTE_JE_RING);
  const neu = ring.filter((_, i) => i % schritt === 0);
  neu.push(ring[0]);
  return neu;
}

// Löcher (z. B. Enklaven) weglassen, kleinste Teilflächen weglassen, Ringe ausdünnen
export function flaecheVereinfachen(f: Flaeche): Flaeche {
  const teile = (f.type === 'Polygon' ? [f.coordinates] : f.coordinates)
    .slice().sort((a, b) => b[0].length - a[0].length).slice(0, MAX_TEILE)
    .map(p => [ringVereinfachen(p[0])]);
  return teile.length === 1 ? { type: 'Polygon', coordinates: teile[0] } : { type: 'MultiPolygon', coordinates: teile };
}

// Fläche des Orts: echte Ortsgrenze, sonst das Rechteck aus der Ortssuche, sonst keine (dann deutschlandweit)
const flaechenCache = new Map<string, Promise<Flaeche | null>>();
export function ortsflaeche(ort: Ort): Promise<Flaeche | null> {
  const schluessel = ort.osmRelation ? `r${ort.osmRelation}` : ort.ausdehnung ? ort.ausdehnung.join(',') : '';
  if (!schluessel) return Promise.resolve(null);
  let f = flaechenCache.get(schluessel);
  if (!f) {
    const rechteck = (): Flaeche | null => {
      if (!ort.ausdehnung) return null;
      const [w, s, o, n] = ort.ausdehnung;
      return { type: 'Polygon', coordinates: [[[w, s], [o, s], [o, n], [w, n], [w, s]]] };
    };
    f = ort.osmRelation
      ? bezirksgrenzeLaden({ id: ort.osmRelation, name: ort.name })
        .then(b => b.grenze ? flaecheVereinfachen(b.grenze) : rechteck())
        .catch(() => rechteck())
      : Promise.resolve(rechteck());
    flaechenCache.set(schluessel, f);
  }
  return f;
}

// "U", "S4" oder "M10" ist eine Liniennummer: nur in der Nummer suchen, sonst träfe "U" jede Endstation "S+U …".
// Gleiche Regel in linien_im_gebiet (Migration 0016).
export function nurNummer(begriff: string) {
  return begriff.length < 3 || /\d/.test(begriff);
}

// Zeichen, die in PostgREST-Filtern eine Bedeutung haben, entfernen
function bereinigen(text: string) {
  return text.replace(/[,()*%"\\:]/g, ' ').trim();
}

// gebiet: gewählter Ort (und Umkreis um den Ort in km); ohne Ort deutschlandweit
export function useLinienSuche(suchtext: string, bezug: { lat: number; lon: number } | null, ausgewaehlt: Linie[],
  gebiet: { ort: Ort | null; umkreisKm?: number } = { ort: null }) {
  const [ergebnis, setErgebnis] = useState<{ fuer: string; linien: (Linie & { mitte?: string })[] } | null>(null);
  const [fehler, setFehler] = useState(false);
  const anfrageNr = useRef(0);
  const begriff = bereinigen(suchtext);
  const ort = gebiet.ort;
  const umkreisM = Math.round((gebiet.umkreisKm ?? 0) * 1000);
  // Ergebnis gilt für Begriff und Gebiet zusammen
  const ortSchluessel = ort ? `${ort.osmRelation ?? ''}|${ort.ausdehnung?.join(',') ?? ''}|${umkreisM}` : '';
  const anfrage = `${begriff}#${ortSchluessel}`;

  useEffect(() => {
    if (begriff === '') return;
    const nr = ++anfrageNr.current;
    const timer = setTimeout(async () => {
      const flaeche = ort ? await ortsflaeche(ort) : null;
      if (nr !== anfrageNr.current) return;
      if (flaeche) {
        const { data, error } = await supabase.rpc('linien_im_gebiet', { p_begriff: begriff, p_gebiet: flaeche, p_umkreis_m: umkreisM });
        if (nr !== anfrageNr.current) return;
        if (error) {
          console.error("Fehler beim Suchen der Linien:", error);
          setFehler(true);
          return;
        }
        setErgebnis({ fuer: anfrage, linien: data ?? [] });
        setFehler(false);
        return;
      }
      const spalten = 'linie_id, typ, nummer, betreiber, endpunkte, mitte';
      // Genau passende Nummern immer vollständig, dazu eine begrenzte breite Suche
      const [genau, breit] = await Promise.all([
        supabase.from('oepnv_linien').select(spalten).ilike('nummer', begriff).limit(500),
        nurNummer(begriff)
          ? supabase.from('oepnv_linien').select(spalten).ilike('nummer', `${begriff}*`).limit(MAX_TREFFER)
          : supabase.from('oepnv_linien').select(spalten)
            .or(`nummer.ilike.${begriff}*,betreiber.ilike.*${begriff}*,endpunkte.ilike.*${begriff}*`)
            .limit(MAX_TREFFER),
      ]);
      if (nr !== anfrageNr.current) return;
      if (genau.error || breit.error) {
        console.error("Fehler beim Suchen der Linien:", genau.error ?? breit.error);
        setFehler(true);
        return;
      }
      const alle = new Map<number, Linie & { mitte?: string }>();
      for (const l of [...(genau.data ?? []), ...(breit.data ?? [])]) alle.set(l.linie_id, l);
      setErgebnis({ fuer: anfrage, linien: [...alle.values()] });
      setFehler(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [begriff, anfrage]); // eslint-disable-line react-hooks/exhaustive-deps -- ort und umkreisM stecken in anfrage

  const typen = Object.keys(LINIENTYPEN);
  const klein = begriff.toLowerCase();
  const treffer: Treffer[] = begriff === '' || !ergebnis ? [] : ergebnis.linien
    .filter(l => !ausgewaehlt.some(s => s.linie_id === l.linie_id))
    .map(l => {
      const p = punktAusEwkb(l.mitte);
      const nummer = l.nummer.toLowerCase();
      return {
        linie_id: l.linie_id, typ: l.typ, nummer: l.nummer, betreiber: l.betreiber, endpunkte: l.endpunkte,
        km: p && bezug ? entfernungM(bezug.lat, bezug.lon, p.lat, p.lon) / 1000 : null,
        guete: nummer === klein ? 0 : nummer.startsWith(klein) ? 1 : 2,
      };
    })
    // Erst wie gut die Nummer passt, Ersatzverkehr hinten, dann wie nah die Linie ist
    .sort((a, b) => (a.guete - b.guete) || (Number(a.typ === 'ersatzverkehr') - Number(b.typ === 'ersatzverkehr')) ||
      ((a.km ?? 1e9) - (b.km ?? 1e9)) ||
      (typen.indexOf(a.typ) - typen.indexOf(b.typ)) ||
      a.nummer.localeCompare(b.nummer, undefined, { numeric: true, sensitivity: 'base' }));
  const laedt = begriff !== '' && ergebnis?.fuer !== anfrage && !fehler;

  return { begriff, treffer, laedt, fehler, imOrt: ort && (ort.osmRelation || ort.ausdehnung) ? ort.kurzname ?? ort.name.split(',')[0] : null };
}
