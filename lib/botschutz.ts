// Bot-Schutz mit ALTCHA: Die Datenbank stellt eine signierte Rechenaufgabe aus (RPC altcha_aufgabe) und prüft
// die Lösung selbst (Migration 0014). Es ist kein fremder Dienst beteiligt.
import { supabase } from './supabase';

export const ALTCHA_KOPF = 'x-altcha';

// Für das Widget: Es ruft fetch() mit seiner challenge-Adresse auf, wir holen die Aufgabe stattdessen per RPC
export const aufgabeHolen: typeof fetch = async () => {
  const { data, error } = await supabase.rpc('altcha_aufgabe');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
};

export function istBotSchutzFehler(nachricht: string | undefined) {
  return !!nachricht && nachricht.includes('Bot-Schutz');
}

export const BOTSCHUTZ_FEHLER = 'Die Prüfung gegen Bots hat nicht geklappt. Bitte setze den Haken bei „Ich bin kein Roboter“ noch einmal und sende erneut.';
