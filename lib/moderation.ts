"use client";
// Moderation: Sperrgründe (Art. 17 DSA) und ob das angemeldete Konto moderieren darf.
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export const SPERR_KATEGORIEN: Record<string, string> = {
  betrug: 'Verdacht auf Betrug oder Fake-Inserat',
  falsche_angaben: 'Falsche oder irreführende Angaben',
  diskriminierung: 'Diskriminierende Inhalte (AGG)',
  rechtswidrig: 'Rechtswidriger Inhalt',
  regelverstoss: 'Verstoß gegen unsere Nutzungsregeln',
  sonstiges: 'Sonstiger Grund',
};

// Datenbankfehler auf Deutsch, die Moderationsfunktionen werfen schon deutsche Texte
export const moderationsFehler = (m: string) => /[äöüÄÖÜß]|Bitte|Kein|nicht/.test(m) ? m : 'Das hat nicht geklappt. Bitte versuche es noch einmal.';

export function useModerator(nutzerId: string | undefined): boolean {
  const [darf, setDarf] = useState(false);
  useEffect(() => {
    if (!nutzerId) { setDarf(false); return; } // eslint-disable-line react-hooks/set-state-in-effect
    supabase.rpc('ist_moderator').then(({ data }) => setDarf(data === true));
  }, [nutzerId]);
  return darf;
}
