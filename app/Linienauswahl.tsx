"use client";
// Auswahl einer oder mehrerer ÖPNV-Linien. Gesucht wird in ganz Deutschland,
// Linien nahe dem gewählten Ort bzw. der Kartenmitte stehen oben.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Linie, punktAusEwkb, endpunkteKurz, LINIENTYPEN } from '../lib/oepnv';
import { entfernungM } from '../lib/filter';

const MAX_LISTE = 60;
// Breite Suche (Betreiber, Endpunkte, Nummernanfang) liefert höchstens so viele Linien
const MAX_TREFFER = 400;

type Treffer = Linie & { km: number | null; guete: number };

interface Props {
  bezug: { lat: number; lon: number } | null;   // Ort oder Kartenmitte, nur fürs Sortieren
  ausgewaehlt: Linie[];
  onChange: (linien: Linie[]) => void;
  umkreis: string;
  onUmkreis: (wert: string) => void;
}

// Zeichen, die in PostgREST-Filtern eine Bedeutung haben, entfernen
function bereinigen(text: string) {
  return text.replace(/[,()*%"\\:]/g, ' ').trim();
}

export default function Linienauswahl({ bezug, ausgewaehlt, onChange, umkreis, onUmkreis }: Props) {
  const [suchtext, setSuchtext] = useState('');
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

  return (
    <div className="md:w-[460px]">
      <p className="text-[11px] text-zinc-500 mb-2">Suche nach Liniennummer, Betreiber oder Endstation in ganz Deutschland. Linien in deiner Nähe stehen oben.</p>
      <input type="text" aria-label="Linie suchen" placeholder="z.B. U2, BVG, Ruhleben" value={suchtext} onChange={(e) => setSuchtext(e.target.value)} className="w-full h-[38px] bg-white border border-zinc-200 rounded-md px-3 text-sm font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-500" />
      {begriff !== '' && (
        <div className="mt-1 w-full bg-white border border-zinc-200 rounded-lg max-h-64 overflow-y-auto">
          {fehler && <p role="alert" className="px-4 py-3 text-xs text-red-600">Die Linien konnten nicht geladen werden.</p>}
          {laedt && treffer.length === 0 && <p role="status" className="px-4 py-3 text-xs text-zinc-500">Linien werden gesucht…</p>}
          {!laedt && !fehler && treffer.length === 0 && <p role="status" className="px-4 py-3 text-xs text-zinc-500">Keine passende Linie gefunden.</p>}
          {treffer.slice(0, MAX_LISTE).map(linie => (
            <button key={linie.linie_id} onClick={() => { onChange([...ausgewaehlt, linie]); setSuchtext(''); }} title={`${LINIENTYPEN[linie.typ] || linie.typ} · ${linie.betreiber}`} className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 transition flex items-baseline gap-2">
              <span className="text-sm font-bold text-zinc-900 shrink-0 min-w-[2.5rem]">{linie.nummer}</span>
              <span className="text-xs text-zinc-600 truncate flex-1">{linie.endpunkte ? endpunkteKurz(linie.endpunkte) : linie.betreiber}</span>
              {linie.km !== null && linie.km >= 20 && <span className="text-[10px] text-zinc-500 shrink-0">{Math.round(linie.km)} km</span>}
            </button>
          ))}
          {treffer.length > MAX_LISTE && (
            <p className="px-4 py-2 text-[11px] text-zinc-500">Weitere Linien gefunden. Tippe genauer, um die Liste einzugrenzen.</p>
          )}
        </div>
      )}

      {ausgewaehlt.length > 0 && (
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex flex-wrap gap-1.5">
            {ausgewaehlt.map(linie => (
              <button key={linie.linie_id} title={`${linie.betreiber}${linie.endpunkte ? ` · ${linie.endpunkte}` : ''}`} onClick={() => onChange(ausgewaehlt.filter(r => r.linie_id !== linie.linie_id))} className="px-2.5 py-1 rounded-md bg-black text-white text-xs font-bold flex items-center gap-1.5 max-w-full">
                <span>{linie.nummer}</span>
                <span className="font-normal text-white/70 truncate max-w-[200px]">{linie.endpunkte ? endpunkteKurz(linie.endpunkte) : linie.betreiber}</span>
                <span aria-hidden="true">×</span><span className="sr-only">entfernen</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-md border border-zinc-100">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest flex-1">Max. Entfernung zur Haltestelle (m):</span>
            <input type="number" aria-label="Maximale Entfernung zur Haltestelle in Metern" min={50} max={5000} step={50} value={umkreis} onChange={(e) => onUmkreis(e.target.value)} className="w-20 bg-white border border-zinc-200 rounded-md py-1 px-2 text-xs text-center font-bold outline-none focus:ring-1 focus:ring-black" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[300, 600, 1000, 1500, 2000].map(m => (
              <button key={m} onClick={() => onUmkreis(String(m))} aria-pressed={umkreis === String(m)} className={`px-2 py-1 rounded-md border text-[11px] font-bold ${umkreis === String(m) ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-black'}`}>{m} m</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
