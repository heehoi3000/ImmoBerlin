"use client";
// Abschnitt der Inseratsseite, der sich über seine Überschrift ein- und ausklappen lässt. Startet ausgeklappt
// (bewusst nicht gemerkt, sonst wirkt ein einmal eingeklappter Abschnitt beim nächsten Inserat wie ein Fehler).
import { ReactNode, useState } from 'react';

export default function Klappbereich({ id, titel, children }: { id: string; titel: string; children: ReactNode }) {
  const [offen, setOffen] = useState(true);
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`} className="font-bold">
        <button type="button" onClick={() => setOffen(!offen)} aria-expanded={offen} aria-controls={`${id}-inhalt`}
          className="w-full flex items-center justify-between gap-3 text-left rounded-lg">
          {titel}
          <svg aria-hidden="true" className={`w-4 h-4 shrink-0 transition-transform ${offen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </h2>
      <div id={`${id}-inhalt`} hidden={!offen}>
        {children}
      </div>
    </section>
  );
}
