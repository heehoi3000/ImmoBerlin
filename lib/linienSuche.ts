// Linien deutschlandweit nach Nummer, Betreiber oder Endstation suchen und nach Passgenauigkeit und Nähe sortieren.
// Gemeinsam genutzt von der Linienauswahl in der Suche und dem Linienfeld auf der Startseite.
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { Linie, punktAusEwkb, LINIENTYPEN } from './oepnv';
import { entfernungM } from './filter';

// Auswahl für die maximale Entfernung zur Haltestelle (Startseite und Suche)
export const UMKREISE_M = [300, 600, 1000, 1500, 2000];

// Breite Suche (Betreiber, Endpunkte, Nummernanfang) liefert höchstens so viele Linien
const MAX_TREFFER = 400;

type Treffer = Linie & { km: number | null; guete: number };

// Zeichen, die in PostgREST-Filtern eine Bedeutung haben, entfernen
function bereinigen(text: string) {
  return text.replace(/[,()*%"\\:]/g, ' ').trim();
}

export function useLinienSuche(suchtext: string, bezug: { lat: number; lon: number } | null, ausgewaehlt: Linie[]) {
  const [ergebnis, setErgebnis] = useState<{ fuer: string; linien: (Linie & { mitte?: string })[] } | null>(null);
  const [fehler, setFehler] = useState(false);
  const anfrageNr = useRef(0);
  const begriff = bereinigen(suchtext);

  useEffect(() => {
    if (begriff === '') return;
    const nr = ++anfrageNr.current;
    const timer = setTimeout(async () => {
      const spalten = 'linie_id, typ, nummer, betreiber, endpunkte, mitte';
      // Genau passende Nummern immer vollständig, dazu eine begrenzte breite Suche
      const [genau, breit] = await Promise.all([
        supabase.from('oepnv_linien').select(spalten).ilike('nummer', begriff).limit(500),
        supabase.from('oepnv_linien').select(spalten)
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
      setErgebnis({ fuer: begriff, linien: [...alle.values()] });
      setFehler(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [begriff]);

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
  const laedt = begriff !== '' && ergebnis?.fuer !== begriff && !fehler;

  return { begriff, treffer, laedt, fehler };
}
