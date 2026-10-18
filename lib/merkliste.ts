"use client";
// Merkliste der Nutzer, nur im eigenen Browser gespeichert (kein Login nötig).
import { useEffect, useState } from 'react';

const SCHLUESSEL = 'merkliste';
const EREIGNIS = 'merkliste-geaendert';

function lesen(): string[] {
  try { return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '[]'); } catch { return []; }
}

export function useMerkliste() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const neu = () => setIds(lesen());
    neu();
    window.addEventListener(EREIGNIS, neu);
    window.addEventListener('storage', neu);
    return () => { window.removeEventListener(EREIGNIS, neu); window.removeEventListener('storage', neu); };
  }, []);
  function umschalten(id: string) {
    const aktuell = lesen();
    const neu = aktuell.includes(id) ? aktuell.filter(x => x !== id) : [...aktuell, id];
    try { localStorage.setItem(SCHLUESSEL, JSON.stringify(neu)); } catch { /* Speicher gesperrt */ }
    window.dispatchEvent(new Event(EREIGNIS));
  }
  return { ids, gemerkt: (id: string) => ids.includes(id), umschalten };
}
