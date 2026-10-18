"use client";
// Zahl der ungelesenen Kontaktanfragen für das Abzeichen in der Kopfzeile.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

const EREIGNIS = 'nachrichten-geaendert';
export const nachrichtenGeaendert = () => window.dispatchEvent(new Event(EREIGNIS));

export function useUngelesen(nutzerId: string | undefined): number {
  const [anzahl, setAnzahl] = useState(0);
  useEffect(() => {
    if (!nutzerId) { setAnzahl(0); return; } // eslint-disable-line react-hooks/set-state-in-effect
    const laden = () => supabase.from('nachrichten').select('id', { count: 'exact', head: true })
      .eq('empfaenger_id', nutzerId).eq('gelesen', false)
      .then(({ count }) => setAnzahl(count ?? 0));
    laden();
    window.addEventListener(EREIGNIS, laden);
    window.addEventListener('focus', laden);
    return () => { window.removeEventListener(EREIGNIS, laden); window.removeEventListener('focus', laden); };
  }, [nutzerId]);
  return anzahl;
}
