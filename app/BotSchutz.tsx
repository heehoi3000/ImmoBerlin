"use client";
// Bot-Schutz mit ALTCHA: Der Browser löst eine kleine Rechenaufgabe (meist in etwa einer Sekunde, ohne Bilderrätsel).
// Das Widget wird mit der Seite ausgeliefert und lädt nichts von fremden Servern; Aufgabe und Prüfung macht
// unsere Datenbank (lib/botschutz.ts). Gelöst wird beim Absenden (oder beim Klick auf den Haken): Das Widget hält
// das Absenden kurz an und sendet danach selbst ab. Ist die Lösung abgelaufen, holt loesung() eine neue.
// Jede Lösung gilt nur einmal.
import type {} from 'altcha/types/react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { aufgabeHolen } from '../lib/botschutz';

interface Widget extends HTMLElement {
  configure: (c: Record<string, unknown>) => Promise<void>;
  reset: () => void;
  verify: () => Promise<{ payload: string } | null>;
}

export interface BotSchutzGriff {
  // gültige Lösung oder null, wenn die Prüfung fehlschlägt
  loesung: () => Promise<string | null>;
  // nach jedem Absenden aufrufen
  zuruecksetzen: () => void;
}

const BotSchutz = forwardRef<BotSchutzGriff>(function BotSchutz(_props, ref) {
  const el = useRef<HTMLElement>(null);
  const bereit = useRef<Promise<void> | null>(null);
  const letzte = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    loesung: async () => {
      if (letzte.current) return letzte.current;
      try {
        await bereit.current;
        return (await (el.current as Widget | null)?.verify())?.payload ?? null;
      } catch (err) { console.error('Bot-Schutz fehlgeschlagen:', err); return null; }
    },
    zuruecksetzen: () => { letzte.current = null; (el.current as Widget | null)?.reset?.(); },
  }), []);

  useEffect(() => {
    let aktiv = true;
    const widget = el.current as Widget | null;
    const zustand = (e: Event) => {
      const { state, payload } = (e as CustomEvent<{ state: string; payload?: string }>).detail ?? {};
      letzte.current = state === 'verified' && payload ? payload : null;
    };
    widget?.addEventListener('statechange', zustand);
    bereit.current = (async () => {
      await import('altcha');
      await import('altcha/i18n/de');
      await customElements.whenDefined('altcha-widget');
      if (!aktiv || !widget) return;
      // auto erst hier setzen, sonst startet das Widget vor dem eigenen fetch mit der Platzhalter-Adresse
      await widget.configure({ challenge: '/altcha-aufgabe', fetch: aufgabeHolen, auto: 'onsubmit', language: 'de', hideFooter: true, minDuration: 300 });
    })();
    bereit.current.catch(err => console.error('Bot-Schutz nicht geladen:', err));
    return () => { aktiv = false; widget?.removeEventListener('statechange', zustand); };
  }, []);

  return <altcha-widget ref={el} language="de" name="altcha" suppressHydrationWarning className="block" />;
});
export default BotSchutz;
