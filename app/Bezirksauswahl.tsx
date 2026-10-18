"use client";
// Auswahl eines oder mehrerer Bezirke bzw. Ortsteile des gewählten Orts.
import { useEffect, useState } from 'react';
import { Bezirk, Ort } from '../lib/filter';
import { BezirkEintrag, bezirkeLaden, bezirksgrenzeLaden } from '../lib/bezirke';

const MAX_LISTE = 30;

interface Props {
  ort: Ort;
  ausgewaehlt: Bezirk[];
  onChange: (bezirke: Bezirk[]) => void;
}

export default function Bezirksauswahl({ ort, ausgewaehlt, onChange }: Props) {
  const [suchtext, setSuchtext] = useState('');
  const [liste, setListe] = useState<{ fuer: number | undefined; eintraege: BezirkEintrag[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedtGrenze, setLaedtGrenze] = useState<number | null>(null);

  useEffect(() => {
    let aktuell = true;
    bezirkeLaden(ort)
      .then(eintraege => { if (aktuell) { setListe({ fuer: ort.osmRelation, eintraege }); setFehler(null); } })
      .catch(err => { console.error("Bezirke konnten nicht geladen werden:", err); if (aktuell) setFehler('Die Bezirke konnten nicht geladen werden.'); });
    return () => { aktuell = false; };
  }, [ort]);

  const eintraege = liste && liste.fuer === ort.osmRelation ? liste.eintraege : null;
  const begriff = suchtext.trim().toLowerCase();
  // Vorschläge erst nach dem ersten Zeichen, Bezirke vor Ortsteilen
  const treffer = begriff === '' || !eintraege ? [] : eintraege
    .filter(b => !ausgewaehlt.some(a => a.id === b.id) && b.name.toLowerCase().includes(begriff))
    .sort((a, b) => (a.ebene === b.ebene ? 0 : a.ebene === 'bezirk' ? -1 : 1));

  async function waehlen(b: BezirkEintrag) {
    setLaedtGrenze(b.id);
    try {
      const mitGrenze = await bezirksgrenzeLaden(b);
      onChange([...ausgewaehlt, mitGrenze]);
      setSuchtext('');
      setFehler(null);
    } catch (err) {
      console.error(err);
      setFehler(`Die Grenze von ${b.name} konnte nicht geladen werden.`);
    } finally {
      setLaedtGrenze(null);
    }
  }

  return (
    <div className="md:w-[420px]">
      <p className="text-[11px] text-zinc-500 mb-2">Bezirke und Ortsteile in {ort.kurzname ?? ort.name}. Ohne Auswahl wird im ganzen Ort gesucht.</p>
      <input type="text" placeholder="Bezirk oder Ortsteil, z.B. Mitte, Prenzlauer Berg" value={suchtext} onChange={(e) => setSuchtext(e.target.value)} className="w-full h-[38px] bg-white border border-zinc-200 rounded-md px-3 text-sm font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
      {begriff !== '' && (
        <div className="mt-1 w-full bg-white border border-zinc-200 rounded-lg max-h-56 overflow-y-auto">
          {!eintraege && !fehler && <p className="px-4 py-3 text-xs text-zinc-500">Bezirke werden geladen…</p>}
          {eintraege && treffer.length === 0 && (
            <p className="px-4 py-3 text-xs text-zinc-500">{eintraege.length === 0 ? 'Für diesen Ort sind keine Bezirke bekannt.' : 'Kein passender Bezirk.'}</p>
          )}
          {treffer.slice(0, MAX_LISTE).map(b => (
            <button key={b.id} disabled={laedtGrenze !== null} onClick={() => waehlen(b)} className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 transition flex items-baseline gap-2 disabled:opacity-50">
              <span className="text-sm font-bold text-zinc-900">{b.name}</span>
              <span className="text-[11px] text-zinc-500">{laedtGrenze === b.id ? 'lädt…' : b.ebene === 'bezirk' ? 'Bezirk' : 'Ortsteil'}</span>
            </button>
          ))}
        </div>
      )}
      {fehler && <p className="mt-2 text-xs text-red-600">{fehler}</p>}
      {ausgewaehlt.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {ausgewaehlt.map(b => (
            <button key={b.id} onClick={() => onChange(ausgewaehlt.filter(a => a.id !== b.id))} className="px-2.5 py-1 rounded-md bg-black text-white text-xs font-bold flex items-center gap-1.5">
              <span>{b.name}</span><span>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
