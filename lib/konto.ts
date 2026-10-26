"use client";
// Angemeldeter Nutzer über Supabase Auth (E-Mail und Passwort).
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { BASIS } from './basis';

// undefined = wird noch geprüft, null = nicht angemeldet
export function useNutzer(): User | null | undefined {
  const [nutzer, setNutzer] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setNutzer(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_ereignis, sitzung) => {
      setNutzer(sitzung?.user ?? null);
      // Die Bot-Schutz-Lösung aus der Registrierung wird nur einmal gebraucht und nicht im Konto behalten
      if (sitzung?.user.user_metadata?.altcha) setTimeout(() => { supabase.auth.updateUser({ data: { altcha: null } }); }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return nutzer;
}

// Supabase-Fehlermeldungen auf Deutsch
export function authFehlerText(nachricht: string): string {
  const m = nachricht.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-Mail oder Passwort stimmen nicht.';
  if (m.includes('email not confirmed')) return 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Mail.';
  if (m.includes('already registered')) return 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.';
  if (m.includes('password should be at least')) return 'Das Passwort muss mindestens 8 Zeichen haben.';
  if (m.includes('bot-schutz')) return 'Die Prüfung gegen Bots hat nicht geklappt. Bitte setze den Haken bei „Ich bin kein Roboter“ noch einmal.';
  if (m.includes('rate limit')) return 'Zu viele Versuche. Bitte warte kurz und versuche es dann noch einmal.';
  if (m.includes('invalid') && m.includes('email')) return 'Diese E-Mail-Adresse ist ungültig.';
  return 'Das hat nicht geklappt. Bitte versuche es noch einmal.';
}

// Adresse der Seite inkl. basePath, für Links in Bestätigungsmails
export function seitenUrl(pfad: string) {
  return new URL(`${BASIS}${pfad}`, window.location.origin).href;
}
