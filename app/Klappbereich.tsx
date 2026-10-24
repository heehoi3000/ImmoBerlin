"use client";
// Abschnitt der Inseratsseite, der sich über seine Überschrift ein- und ausklappen lässt. Der Zustand wird je
// Abschnitt im Browser gemerkt (localStorage), damit er beim nächsten Inserat gleich bleibt; ohne gemerkten
// Zustand gilt anfangsOffen.
import { ReactNode, useEffect, useState } from 'react';

export default function Klappbereich({ id, titel, anfangsOffen = true, children }: {
  id: string; titel: string; anfangsOffen?: boolean; children: ReactNode;
}) {
  const schluessel = `klappbereich-${id}`;
  const [offen, setOffen] = useState(anfangsOffen);
  useEffect(() => {
    try {
      const gemerkt = localStorage.getItem(schluessel);
      if (gemerkt) setOffen(gemerkt === 'offen'); // eslint-disable-line react-hooks/set-state-in-effect
    } catch { /* ohne Speicher gilt anfangsOffen */ }
  }, [schluessel]);
  const umschalten = () => {
    setOffen(!offen);
    try { localStorage.setItem(schluessel, offen ? 'zu' : 'offen'); } catch { /* nicht merken */ }
  };
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby={`${id}-titel`}>
      <h2 id={`${id}-titel`} className="font-bold">
        <button type="button" onClick={umschalten} aria-expanded={offen} aria-controls={`${id}-inhalt`}
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
