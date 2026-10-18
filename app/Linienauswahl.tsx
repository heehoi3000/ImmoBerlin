"use client";
// Auswahl einer oder mehrerer ÖPNV-Linien, die im sichtbaren Kartenausschnitt halten.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Linie, Kartenausschnitt, LINIENTYPEN, MAX_AUSSCHNITT_BREITE } from '../lib/oepnv';

const MAX_LISTE = 150;

interface Props {
  ausschnitt: Kartenausschnitt | null;
  ausgewaehlt: Linie[];
  onChange: (linien: Linie[]) => void;
  umkreis: string;
  onUmkreis: (wert: string) => void;
}

export default function Linienauswahl({ ausschnitt, ausgewaehlt, onChange, umkreis, onUmkreis }: Props) {
  const [suchtext, setSuchtext] = useState('');
  const [linienImAusschnitt, setLinienImAusschnitt] = useState<Linie[]>([]);
  const [ladeStatus, setLadeStatus] = useState<'bereit' | 'laedt' | 'fehler'>('bereit');
  const anfrageNr = useRef(0);

  const zuGross = !!ausschnitt && ausschnitt.maxLon - ausschnitt.minLon > MAX_AUSSCHNITT_BREITE;
  const status = zuGross ? 'zu_gross' : ladeStatus;

  useEffect(() => {
    if (!ausschnitt || zuGross) return;
    const nr = ++anfrageNr.current;
    // kurz warten, damit beim Verschieben der Karte nicht jede Bewegung eine Anfrage auslöst
    const timer = setTimeout(async () => {
      setLadeStatus('laedt');
      const laden = () => supabase
        .rpc('linien_im_ausschnitt', {
          min_lon: ausschnitt.minLon, min_lat: ausschnitt.minLat,
          max_lon: ausschnitt.maxLon, max_lat: ausschnitt.maxLat,
        })
        .select('linie_id, typ, nummer, betreiber, endpunkte');
      let { data, error } = await laden();
      // Die erste Abfrage in einer Gegend kann das Zeitlimit (3 s) reißen, solange die
      // Datenbank die Haltestellen dort noch nicht im Speicher hat. Ein zweiter Versuch klappt dann.
      for (let versuch = 0; error?.code === '57014' && versuch < 2 && nr === anfrageNr.current; versuch++) {
        ({ data, error } = await laden());
      }
      if (nr !== anfrageNr.current) return;
      if (error) {
        console.error("Fehler beim Laden der Linien:", error);
        setLadeStatus('fehler');
        return;
      }
      const linien = (data as Linie[]) || [];
      const typen = Object.keys(LINIENTYPEN);
      linien.sort((a, b) =>
        (typen.indexOf(a.typ) - typen.indexOf(b.typ)) ||
        a.nummer.localeCompare(b.nummer, undefined, { numeric: true, sensitivity: 'base' }) ||
        a.betreiber.localeCompare(b.betreiber));
      setLinienImAusschnitt(linien);
      setLadeStatus('bereit');
    }, 400);
    return () => clearTimeout(timer);
  }, [ausschnitt, zuGross]);

  const begriff = suchtext.trim().toLowerCase();
  // Vorschläge erst zeigen, wenn mindestens ein Zeichen eingegeben ist
  const treffer = begriff === '' ? [] : linienImAusschnitt.filter(linie =>
    !ausgewaehlt.some(s => s.linie_id === linie.linie_id) &&
    (linie.nummer.toLowerCase().includes(begriff) ||
      linie.betreiber.toLowerCase().includes(begriff) ||
      linie.endpunkte.toLowerCase().includes(begriff))
  );

  return (
    <div>
      <p className="text-[11px] text-zinc-500 mb-2">Linien im Kartenausschnitt. Verschiebe oder zoome die Karte, um Linien in anderen Orten zu sehen.</p>
      <input type="text" placeholder="Filtern (z.B. U2, BVG, Ruhleben)" value={suchtext} onChange={(e) => setSuchtext(e.target.value)} className="w-full h-[38px] bg-white border border-zinc-200 rounded-md px-3 text-sm font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
      <div className="mt-1 w-full bg-white border border-zinc-200 rounded-lg max-h-56 overflow-y-auto">
        {status === 'zu_gross' && (
          <p className="px-4 py-3 text-xs text-zinc-500">Der Kartenausschnitt ist zu groß. Zoome näher an einen Ort heran.</p>
        )}
        {status === 'laedt' && begriff !== '' && linienImAusschnitt.length === 0 && (
          <p className="px-4 py-3 text-xs text-zinc-500">Linien werden geladen…</p>
        )}
        {status === 'fehler' && (
          <p className="px-4 py-3 text-xs text-red-600">Die Linien konnten nicht geladen werden.</p>
        )}
        {(status === 'bereit' || status === 'laedt') && begriff === '' && (
          <p className="px-4 py-3 text-xs text-zinc-500">Tippe eine Linie, einen Betreiber oder eine Endstation, z.B. U2.</p>
        )}
        {status === 'bereit' && begriff !== '' && treffer.length === 0 && (
          <p className="px-4 py-3 text-xs text-zinc-500">Keine passenden Linien in diesem Ausschnitt.</p>
        )}
        {status !== 'zu_gross' && treffer.slice(0, MAX_LISTE).map((linie, i) => (
          <div key={linie.linie_id}>
            {(i === 0 || treffer[i - 1].typ !== linie.typ) && (
              <div className="sticky top-0 bg-zinc-50 px-4 py-1 text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                {LINIENTYPEN[linie.typ] || linie.typ}
              </div>
            )}
            <button onClick={() => { onChange([...ausgewaehlt, linie]); setSuchtext(''); }} className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 transition flex items-baseline gap-2">
              <span className="text-sm font-bold text-zinc-900 shrink-0">{linie.nummer}</span>
              <span className="text-[11px] text-zinc-500 truncate">{linie.betreiber}{linie.endpunkte ? ` · ${linie.endpunkte}` : ''}</span>
            </button>
          </div>
        ))}
        {status !== 'zu_gross' && treffer.length > MAX_LISTE && (
          <p className="px-4 py-2 text-[11px] text-zinc-500">{treffer.length - MAX_LISTE} weitere Linien. Tippe oben, um die Liste einzugrenzen.</p>
        )}
      </div>

      {ausgewaehlt.length > 0 && (
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex flex-wrap gap-1.5">
            {ausgewaehlt.map(linie => (
              <button key={linie.linie_id} title={`${linie.betreiber}${linie.endpunkte ? ` · ${linie.endpunkte}` : ''}`} onClick={() => onChange(ausgewaehlt.filter(r => r.linie_id !== linie.linie_id))} className="px-2.5 py-1 rounded-md bg-black text-white text-xs font-bold flex items-center gap-1.5 max-w-full">
                <span>{linie.nummer}</span>
                <span className="font-normal text-white/70 truncate max-w-[140px]">{linie.betreiber}</span>
                <span>×</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-md border border-zinc-100">
            <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest flex-1">Max. Entfernung zur Haltestelle (m):</span>
            <input type="number" min={50} max={5000} step={50} value={umkreis} onChange={(e) => onUmkreis(e.target.value)} className="w-20 bg-white border border-zinc-200 rounded-md py-1 px-2 text-xs text-center font-bold outline-none focus:ring-1 focus:ring-black" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[300, 600, 1000, 1500, 2000].map(m => (
              <button key={m} onClick={() => onUmkreis(String(m))} className={`px-2 py-1 rounded-md border text-[11px] font-bold ${umkreis === String(m) ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-black'}`}>{m} m</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
