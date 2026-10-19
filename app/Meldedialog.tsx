"use client";
// Formular zum Melden von Fehlern auf der Seite oder von rechtswidrigen Inseraten (Art. 16 DSA).
// Die Meldung landet in der Tabelle "meldungen"; lesen kann sie nur das Team im Supabase-Dashboard.
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';
import { useNutzer } from '../lib/konto';

type Art = 'fehler' | 'inserat' | 'sonstiges';
interface Anlass { art: Art; anzeigeId?: string; anzeigeTitel?: string }

const MeldenKontext = createContext<(anlass?: Anlass) => void>(() => {});
export const useMelden = () => useContext(MeldenKontext);

const ARTEN: { wert: Art; name: string; hinweis: string }[] = [
  { wert: 'fehler', name: 'Fehler auf der Seite', hinweis: 'Was hast du gemacht, und was ist passiert? Je genauer, desto schneller finden wir es.' },
  { wert: 'inserat', name: 'Problem mit einem Inserat', hinweis: 'Warum ist das Inserat falsch oder rechtswidrig? Zum Beispiel Betrug, falsche Angaben oder diskriminierende Formulierungen.' },
  { wert: 'sonstiges', name: 'Idee oder Sonstiges', hinweis: 'Was sollen wir verbessern?' },
];

export function MeldenAnbieter({ children }: { children: ReactNode }) {
  const [anlass, setAnlass] = useState<Anlass | null>(null);
  return (
    <MeldenKontext.Provider value={(a) => setAnlass(a ?? { art: 'fehler' })}>
      {children}
      {anlass && <Dialog key={JSON.stringify(anlass)} anlass={anlass} onSchliessen={() => setAnlass(null)} />}
    </MeldenKontext.Provider>
  );
}

function Dialog({ anlass, onSchliessen }: { anlass: Anlass; onSchliessen: () => void }) {
  const nutzer = useNutzer();
  const [art, setArt] = useState<Art>(anlass.art);
  const [nachricht, setNachricht] = useState('');
  const [email, setEmail] = useState('');
  const [zustand, setZustand] = useState<'offen' | 'sendet' | 'gesendet' | 'fehler' | 'zu_viele'>('offen');
  const [falle, setFalle] = useState(''); // unsichtbares Feld gegen Spam-Bots

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    if (falle) { setZustand('gesendet'); return; }
    setZustand('sendet');
    const { error } = await supabase.from('meldungen').insert({
      art,
      anzeige_id: art === 'inserat' ? anlass.anzeigeId ?? null : null,
      nachricht: nachricht.trim(),
      email: email.trim() || nutzer?.email || null,
      seite: window.location.href.slice(0, 500),
      browser: navigator.userAgent.slice(0, 500),
      nutzer_id: nutzer?.id ?? null,
    });
    if (error) console.error("Meldung fehlgeschlagen:", error);
    setZustand(!error ? 'gesendet' : error.message.includes('Zu viele') ? 'zu_viele' : 'fehler');
  }

  // Escape schließt den Dialog
  useEffect(() => {
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') onSchliessen(); };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [onSchliessen]);

  const hinweis = ARTEN.find(a => a.wert === art)!.hinweis;
  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={onSchliessen}>
      <div role="dialog" aria-modal="true" aria-labelledby="melden-titel" onMouseDown={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <h2 id="melden-titel" className="text-lg font-bold text-zinc-900">{zustand === 'gesendet' ? 'Danke für deine Meldung' : 'Melden'}</h2>
          <button onClick={onSchliessen} aria-label="Schließen" className="text-zinc-400 hover:text-black text-2xl leading-none">×</button>
        </div>
        {zustand === 'gesendet' ? (
          <>
            <p className="text-sm text-zinc-600">Wir schauen uns das an. {art === 'inserat' ? 'Wenn das Inserat gegen unsere Regeln verstößt, nehmen wir es offline und informieren den Inserenten.' : 'Wenn du eine E-Mail angegeben hast, melden wir uns bei Rückfragen.'}</p>
            <button onClick={onSchliessen} className="self-end h-10 px-5 rounded-lg bg-black text-white text-sm font-bold">Schließen</button>
          </>
        ) : (
          <form onSubmit={senden} className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              {ARTEN.map(a => (
                <button type="button" key={a.wert} onClick={() => setArt(a.wert)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-bold transition ${art === a.wert ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-black'}`}>
                  {a.name}
                </button>
              ))}
            </div>
            {art === 'inserat' && anlass.anzeigeTitel && (
              <p className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">Inserat: <strong className="text-zinc-800">{anlass.anzeigeTitel}</strong></p>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-zinc-700">Beschreibung</span>
              <textarea required minLength={5} maxLength={3000} rows={5} value={nachricht} onChange={(e) => setNachricht(e.target.value)} placeholder={hinweis}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-black/10 focus:border-black outline-none resize-y" />
            </label>
            {!nutzer && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-zinc-700">E-Mail für Rückfragen <span className="font-normal text-zinc-400">(freiwillig)</span></span>
                <input type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 border border-zinc-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-black/10 focus:border-black outline-none" />
              </label>
            )}
            <p className="text-[11px] text-zinc-400">Mit der Meldung speichern wir die aktuelle Seitenadresse und deinen Browsertyp, damit wir Fehler nachvollziehen können. Mehr dazu in der <Link href="/datenschutz/" onClick={onSchliessen} className="underline underline-offset-2">Datenschutzerklärung</Link>.</p>
            <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} className="absolute -left-[9999px] w-px h-px opacity-0" name="website" />
            {zustand === 'zu_viele' && <p className="text-sm text-red-600">Du hast in der letzten Stunde schon mehrere Meldungen gesendet. Bitte versuche es später noch einmal.</p>}
            {zustand === 'fehler' && <p className="text-sm text-red-600">Die Meldung konnte nicht gesendet werden. Bitte versuche es noch einmal.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onSchliessen} className="h-10 px-4 rounded-lg text-sm font-semibold text-zinc-600 hover:bg-zinc-100">Abbrechen</button>
              <button type="submit" disabled={zustand === 'sendet'} className="h-10 px-5 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50">
                {zustand === 'sendet' ? 'Wird gesendet…' : 'Meldung senden'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
