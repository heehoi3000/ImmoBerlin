"use client";
// Kompaktes Linienfeld für die Suchleiste der Startseite: Linien als Schilder im Feld, Vorschläge darunter,
// danach die maximale Entfernung zur Haltestelle. Ausführliche Auswahl in der Suche: Linienauswahl.tsx.
import { useId, useState } from 'react';
import { Linie, endpunkteKurz, LINIENTYPEN } from '../lib/oepnv';
import { useLinienSuche } from '../lib/linienSuche';

const MAX_LISTE = 30;
export const UMKREISE_M = [300, 600, 1000, 1500, 2000];

interface Props {
  bezug: { lat: number; lon: number } | null;
  ausgewaehlt: Linie[];
  onChange: (linien: Linie[]) => void;
  umkreis: string;
  onUmkreis: (wert: string) => void;
}

export default function LinienFeld({ bezug, ausgewaehlt, onChange, umkreis, onUmkreis }: Props) {
  const [text, setText] = useState('');
  const [offen, setOffen] = useState(false);
  const [markiert, setMarkiert] = useState(-1);
  const listeId = useId();
  const { begriff, treffer, laedt, fehler } = useLinienSuche(text, bezug, ausgewaehlt);
  const sichtbar = offen && begriff !== '' ? treffer.slice(0, MAX_LISTE) : [];
  const zeigeListe = offen && begriff !== '';

  const waehle = (l: Linie) => { onChange([...ausgewaehlt, l]); setText(''); setMarkiert(-1); };

  return (
    <div className="relative flex-1 min-w-0 flex items-center gap-2">
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5 py-1.5">
        {ausgewaehlt.map(l => (
          <button key={l.linie_id} type="button" onClick={() => onChange(ausgewaehlt.filter(x => x.linie_id !== l.linie_id))}
            title={`${LINIENTYPEN[l.typ] || l.typ} · ${l.endpunkte ?? l.betreiber}`}
            className="h-8 pl-2.5 pr-2 rounded-lg bg-zinc-900 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-black">
            {l.nummer}<span aria-hidden="true" className="text-white/70 font-normal">×</span><span className="sr-only">entfernen</span>
          </button>
        ))}
        <input
          type="text"
          value={text}
          placeholder={ausgewaehlt.length ? 'weitere Linie' : 'Linie, z.B. U8, S41, Bus 100'}
          aria-label="ÖPNV-Linie"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={zeigeListe}
          aria-controls={listeId}
          aria-activedescendant={markiert >= 0 && sichtbar[markiert] ? `${listeId}-${markiert}` : undefined}
          onChange={(e) => { setText(e.target.value); setOffen(true); setMarkiert(-1); }}
          onFocus={() => setOffen(true)}
          onBlur={() => setTimeout(() => setOffen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && sichtbar.length) { e.preventDefault(); setMarkiert(m => (m + 1) % sichtbar.length); }
            else if (e.key === 'ArrowUp' && sichtbar.length) { e.preventDefault(); setMarkiert(m => (m <= 0 ? sichtbar.length : m) - 1); }
            else if (e.key === 'Escape') { setOffen(false); setMarkiert(-1); }
            else if (e.key === 'Enter' && sichtbar.length) { e.preventDefault(); waehle(sichtbar[Math.max(markiert, 0)]); }
            else if (e.key === 'Backspace' && text === '' && ausgewaehlt.length) onChange(ausgewaehlt.slice(0, -1));
          }}
          className="flex-1 min-w-[7rem] h-9 bg-transparent outline-none text-base placeholder:text-zinc-500"
        />
      </div>
      {ausgewaehlt.length > 0 && (
        <select value={UMKREISE_M.includes(Number(umkreis)) ? umkreis : '600'} onChange={(e) => onUmkreis(e.target.value)}
          aria-label="Maximale Entfernung zur Haltestelle"
          className="shrink-0 h-9 rounded-lg bg-zinc-100 px-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-black">
          {UMKREISE_M.map(m => <option key={m} value={m}>bis {m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString('de-DE')} km`}</option>)}
        </select>
      )}
      {zeigeListe && (
        <div id={listeId} role="listbox" aria-label="Linien"
          className="absolute left-0 right-0 top-full mt-2 bg-white border border-zinc-200 rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto py-1 min-w-[280px]">
          {fehler && <p role="alert" className="px-4 py-3 text-sm text-red-700">Die Linien konnten nicht geladen werden.</p>}
          {laedt && sichtbar.length === 0 && <p role="status" className="px-4 py-3 text-sm text-zinc-500">Linien werden gesucht…</p>}
          {!laedt && !fehler && sichtbar.length === 0 && <p role="status" className="px-4 py-3 text-sm text-zinc-500">Keine passende Linie gefunden.</p>}
          {sichtbar.map((l, i) => (
            <div key={l.linie_id} id={`${listeId}-${i}`} role="option" aria-selected={i === markiert}
              onMouseDown={(e) => e.preventDefault()} onClick={() => waehle(l)}
              className={`px-4 py-2 flex items-baseline gap-3 cursor-pointer hover:bg-zinc-100 ${i === markiert ? 'bg-zinc-100' : ''}`}>
              <span className="text-sm font-bold text-zinc-900 min-w-[2.75rem]">{l.nummer}</span>
              <span className="text-sm text-zinc-600 truncate flex-1">{l.endpunkte ? endpunkteKurz(l.endpunkte) : l.betreiber}</span>
              <span className="text-xs text-zinc-500 shrink-0">{LINIENTYPEN[l.typ] || l.typ}{l.km !== null && l.km >= 20 ? ` · ${Math.round(l.km)} km` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
