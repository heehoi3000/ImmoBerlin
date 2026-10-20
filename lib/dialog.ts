// Tastaturbedienung für Dialoge (WCAG 2.1.2, 2.4.3): Beim Öffnen springt der Fokus in den Dialog,
// Tab bleibt im Dialog, Escape schließt ihn, danach steht der Fokus wieder auf dem auslösenden Knopf.
import { RefObject, useEffect, useRef } from 'react';

const FOKUSSIERBAR = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialog(ref: RefObject<HTMLElement | null>, onSchliessen: () => void) {
  const schliessen = useRef(onSchliessen);
  useEffect(() => { schliessen.current = onSchliessen; }, [onSchliessen]);

  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    const felder = () => [...(ref.current?.querySelectorAll<HTMLElement>(FOKUSSIERBAR) ?? [])];
    // erstes Eingabefeld, sonst das erste Bedienelement (meist "Schließen")
    const start = felder().find(f => f.matches('input, select, textarea')) ?? felder()[0];
    start?.focus();

    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); schliessen.current(); return; }
      if (e.key !== 'Tab') return;
      const alle = felder();
      if (alle.length === 0) return;
      const erstes = alle[0], letztes = alle[alle.length - 1];
      if (e.shiftKey && document.activeElement === erstes) { e.preventDefault(); letztes.focus(); }
      else if (!e.shiftKey && document.activeElement === letztes) { e.preventDefault(); erstes.focus(); }
    };
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('keydown', taste);
      if (vorher && document.contains(vorher)) vorher.focus();
    };
  }, [ref]);
}
