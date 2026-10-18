"use client";
// Anfrage an den Inserenten. Die Nachricht landet in "nachrichten", der Inserent sieht sie in seinem Postfach.
import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useNutzer } from '../lib/konto';

const feld = 'w-full border border-zinc-200 rounded-lg px-3 text-sm focus:ring-2 focus:ring-black/10 focus:border-black outline-none';

function fehlerText(nachricht: string) {
  if (nachricht.includes('Zu viele')) return 'Du hast in der letzten Stunde schon mehrere Anfragen gesendet. Bitte versuche es später noch einmal.';
  if (nachricht.includes('nicht kontaktiert')) return 'Dieses Inserat ist nicht mehr online.';
  if (nachricht.includes('check constraint')) return 'Bitte prüfe deine Angaben (Name, E-Mail und eine Nachricht mit mindestens 10 Zeichen).';
  return 'Die Nachricht konnte nicht gesendet werden. Bitte versuche es noch einmal.';
}

export default function Kontaktformular({ anzeigeId, titel, kontaktierbar }: { anzeigeId: string; titel: string; kontaktierbar: boolean }) {
  const nutzer = useNutzer();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telefon, setTelefon] = useState('');
  const [nachricht, setNachricht] = useState(`Hallo,\n\nich interessiere mich für Ihr Inserat „${titel}“ und würde es gern besichtigen.\n\nViele Grüße`);
  const [falle, setFalle] = useState(''); // unsichtbares Feld gegen Spam-Bots
  const [zustand, setZustand] = useState<'offen' | 'sendet' | 'gesendet'>('offen');
  const [fehler, setFehler] = useState('');

  if (!kontaktierbar) {
    return <p className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">Das ist ein Beispielinserat. Eine Anfrage ist hier nicht möglich.</p>;
  }
  if (zustand === 'gesendet') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900 flex flex-col gap-1">
        <strong>Anfrage gesendet</strong>
        <span>Der Anbieter antwortet dir direkt an {email.trim() || nutzer?.email}.</span>
        {nutzer && <Link href="/nachrichten/?ansicht=gesendet" className="underline underline-offset-2 mt-1">Gesendete Anfragen ansehen</Link>}
      </div>
    );
  }

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    if (falle) { setZustand('gesendet'); return; }
    setZustand('sendet');
    setFehler('');
    // ohne .select(): nicht angemeldete Absender dürfen die Zeile danach nicht lesen
    const { error } = await supabase.from('nachrichten').insert({
      anzeige_id: anzeigeId,
      name: name.trim(),
      email: (email.trim() || nutzer?.email || '').trim(),
      telefon: telefon.trim() || null,
      nachricht: nachricht.trim(),
    });
    if (error) { console.error('Anfrage fehlgeschlagen:', error); setFehler(fehlerText(error.message)); setZustand('offen'); return; }
    setZustand('gesendet');
  }

  return (
    <form onSubmit={senden} className="flex flex-col gap-2.5">
      <h2 className="font-bold">Anbieter kontaktieren</h2>
      <input aria-label="Name" required minLength={2} maxLength={100} placeholder="Dein Name" value={name} onChange={(e) => setName(e.target.value)} className={`${feld} h-10`} />
      {!nutzer && <input aria-label="E-Mail" type="email" required maxLength={200} placeholder="Deine E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} className={`${feld} h-10`} />}
      <input aria-label="Telefon" type="tel" maxLength={40} placeholder="Telefon (freiwillig)" value={telefon} onChange={(e) => setTelefon(e.target.value)} className={`${feld} h-10`} />
      <textarea aria-label="Nachricht" required minLength={10} maxLength={3000} rows={6} value={nachricht} onChange={(e) => setNachricht(e.target.value)} className={`${feld} py-2 resize-y`} />
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={falle} onChange={(e) => setFalle(e.target.value)} className="absolute -left-[9999px] w-px h-px opacity-0" name="website" />
      {fehler && <p role="alert" className="text-xs text-red-600">{fehler}</p>}
      <button type="submit" disabled={zustand === 'sendet'} className="h-11 rounded-lg bg-black text-white text-sm font-bold hover:bg-zinc-800 disabled:opacity-50">
        {zustand === 'sendet' ? 'Wird gesendet…' : 'Anfrage senden'}
      </button>
      <p className="text-[11px] text-zinc-400">Wir geben deinen Namen, deine E-Mail, die Telefonnummer und die Nachricht nur an diesen Anbieter weiter, damit er dir antworten kann.</p>
    </form>
  );
}
