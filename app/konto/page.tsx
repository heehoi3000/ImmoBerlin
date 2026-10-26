"use client";
// Anmelden, Registrieren, Passwort zurücksetzen und Kontoübersicht.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { authFehlerText, seitenUrl, useNutzer } from '../../lib/konto';
import BotSchutz, { BotSchutzGriff } from '../BotSchutz';
import { BOTSCHUTZ_FEHLER } from '../../lib/botschutz';

type Modus = 'anmelden' | 'registrieren' | 'vergessen' | 'neues_passwort';

const feld = "w-full h-11 border border-zinc-200 rounded-lg px-3 text-sm bg-white focus:ring-2 focus:ring-black/10 focus:border-black outline-none";

export default function Konto() {
  const nutzer = useNutzer();
  const router = useRouter();
  const [modus, setModus] = useState<Modus>('anmelden');
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [zustimmung, setZustimmung] = useState(false);
  const botschutzFeld = useRef<BotSchutzGriff>(null);

  // Link aus der "Passwort vergessen"-Mail öffnet diese Seite im Modus "neues Passwort"
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((ereignis) => { if (ereignis === 'PASSWORD_RECOVERY') setModus('neues_passwort'); });
    return () => data.subscription.unsubscribe();
  }, []);

  // Ziel nach dem Anmelden, z. B. ?weiter=/inserieren/
  const weiterZiel = () => new URLSearchParams(window.location.search).get('weiter');

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true); setFehler(null); setHinweis(null);
    try {
      if (modus === 'anmelden') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: passwort });
        if (error) throw error;
        router.push(weiterZiel() ?? '/meine-inserate/');
      } else if (modus === 'registrieren') {
        // Registrieren nur mit gelöster Aufgabe; Anmelden und „Passwort vergessen“ begrenzt Supabase selbst
        const botschutz = await botschutzFeld.current?.loesung();
        if (!botschutz) { setFehler(BOTSCHUTZ_FEHLER); return; }
        const { data, error } = await supabase.auth.signUp({ email, password: passwort, options: { emailRedirectTo: seitenUrl('/konto/'), data: { altcha: botschutz } } });
        if (error) throw error;
        if (data.session) router.push(weiterZiel() ?? '/inserieren/');
        else setHinweis(`Fast geschafft: Wir haben dir eine Mail an ${email} geschickt. Klicke auf den Link darin, um dein Konto zu bestätigen.`);
      } else if (modus === 'vergessen') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: seitenUrl('/konto/') });
        if (error) throw error;
        setHinweis(`Wenn es ein Konto für ${email} gibt, ist jetzt eine Mail mit einem Link zum Zurücksetzen unterwegs.`);
      } else {
        const { error } = await supabase.auth.updateUser({ password: passwort });
        if (error) throw error;
        setHinweis('Dein neues Passwort ist gespeichert.');
        setModus('anmelden');
      }
    } catch (err) {
      setFehler(authFehlerText((err as Error).message ?? ''));
    } finally {
      setLaedt(false);
      // eine Lösung gilt nur für einen Versuch
      botschutzFeld.current?.zuruecksetzen();
    }
  }

  if (nutzer === undefined) return <Huelle><p className="text-sm text-zinc-500">Wird geladen…</p></Huelle>;

  if (nutzer && modus !== 'neues_passwort') {
    return (
      <Huelle titel="Mein Konto">
        <p className="text-sm text-zinc-600">Angemeldet als <strong className="text-zinc-900">{nutzer.email}</strong></p>
        {hinweis && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{hinweis}</p>}
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <Link href="/meine-inserate/" className="h-11 rounded-lg border border-zinc-200 flex items-center justify-center text-sm font-bold hover:border-black">Meine Inserate</Link>
          <Link href="/inserieren/" className="h-11 rounded-lg bg-black text-white flex items-center justify-center text-sm font-bold hover:bg-zinc-800">Neues Inserat</Link>
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <button onClick={() => setModus('neues_passwort')} className="text-zinc-600 underline underline-offset-2 hover:text-black">Passwort ändern</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); }} className="text-red-700 underline underline-offset-2">Abmelden</button>
        </div>
        <KontoLoeschen onGeloescht={() => { setModus('anmelden'); setHinweis('Dein Konto und alle deine Inserate wurden gelöscht.'); }} />
      </Huelle>
    );
  }

  const titel = { anmelden: 'Anmelden', registrieren: 'Konto erstellen', vergessen: 'Passwort vergessen', neues_passwort: 'Neues Passwort festlegen' }[modus];
  return (
    <Huelle titel={titel}>
      {(modus === 'anmelden' || modus === 'registrieren') && (
        <div className="grid grid-cols-2 bg-zinc-100 rounded-lg p-1 text-sm font-bold">
          {(['anmelden', 'registrieren'] as const).map(m => (
            <button key={m} onClick={() => { setModus(m); setFehler(null); setHinweis(null); }} aria-pressed={modus === m}
              className={`h-9 rounded-md transition ${modus === m ? 'bg-white shadow-sm text-black' : 'text-zinc-600'}`}>
              {m === 'anmelden' ? 'Anmelden' : 'Registrieren'}
            </button>
          ))}
        </div>
      )}
      {modus === 'registrieren' && <p className="text-sm text-zinc-600">Mit einem Konto kannst du kostenlos Wohnungen und Häuser inserieren und deine Inserate verwalten. Wie wir deine Daten verarbeiten, steht in der <Link href="/datenschutz/" className="underline underline-offset-2">Datenschutzerklärung</Link>.</p>}
      <form onSubmit={absenden} className="flex flex-col gap-3">
        {modus !== 'neues_passwort' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-zinc-700">E-Mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={feld} />
          </label>
        )}
        {modus !== 'vergessen' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-zinc-700">{modus === 'neues_passwort' ? 'Neues Passwort' : 'Passwort'}</span>
            <input type="password" required minLength={modus === 'anmelden' ? undefined : 8} autoComplete={modus === 'anmelden' ? 'current-password' : 'new-password'}
              value={passwort} onChange={(e) => setPasswort(e.target.value)} className={feld} />
            {modus !== 'anmelden' && <span className="text-[11px] text-zinc-500">Mindestens 8 Zeichen</span>}
          </label>
        )}
        {modus === 'registrieren' && (
          <label className="flex items-start gap-2 text-sm text-zinc-600">
            <input type="checkbox" required checked={zustimmung} onChange={(e) => setZustimmung(e.target.checked)} className="mt-1 accent-black" />
            <span>Ich akzeptiere die <Link href="/nutzungsbedingungen/" target="_blank" className="underline underline-offset-2">Nutzungsbedingungen</Link>.</span>
          </label>
        )}
        {modus === 'registrieren' && <BotSchutz ref={botschutzFeld} />}
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        {hinweis && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{hinweis}</p>}
        <button type="submit" disabled={laedt} className="h-11 rounded-lg bg-black text-white text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 mt-1">
          {laedt ? 'Einen Moment…' : { anmelden: 'Anmelden', registrieren: 'Konto erstellen', vergessen: 'Link senden', neues_passwort: 'Passwort speichern' }[modus]}
        </button>
      </form>
      {modus === 'anmelden' && <button onClick={() => { setModus('vergessen'); setFehler(null); }} className="text-sm text-zinc-500 underline underline-offset-2 hover:text-black self-start">Passwort vergessen?</button>}
      {modus === 'vergessen' && <button onClick={() => setModus('anmelden')} className="text-sm text-zinc-500 underline underline-offset-2 hover:text-black self-start">Zurück zur Anmeldung</button>}
    </Huelle>
  );
}

// Konto mit allen Inseraten, Fotos, Dokumenten und empfangenen Anfragen löschen (Edge Function konto-loeschen)
function KontoLoeschen({ onGeloescht }: { onGeloescht: () => void }) {
  const [offen, setOffen] = useState(false);
  const [bestaetigung, setBestaetigung] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');

  async function loeschen() {
    setLaedt(true); setFehler('');
    const { error } = await supabase.functions.invoke('konto-loeschen', { method: 'POST' });
    if (error) { console.error(error); setFehler('Das Konto konnte nicht gelöscht werden. Bitte versuche es noch einmal.'); setLaedt(false); return; }
    onGeloescht();
    // nur lokal abmelden, das Konto gibt es auf dem Server nicht mehr
    await supabase.auth.signOut({ scope: 'local' });
  }

  if (!offen) {
    return <button onClick={() => setOffen(true)} className="self-start mt-6 pt-4 border-t border-zinc-100 w-full text-left text-sm text-zinc-500 hover:text-red-700">Konto löschen</button>;
  }
  return (
    <div className="mt-6 border border-red-200 bg-red-50 rounded-xl p-4 flex flex-col gap-3 text-sm text-red-900">
      <strong>Konto endgültig löschen?</strong>
      <p>Wir löschen dein Konto, alle deine Inserate mit Fotos und Dokumenten und die Anfragen, die du bekommen hast. Das lässt sich nicht rückgängig machen.</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold">Zur Bestätigung LÖSCHEN eintippen</span>
        <input value={bestaetigung} onChange={(e) => setBestaetigung(e.target.value)} className="h-10 bg-white border border-red-200 rounded-lg px-3 text-zinc-900 outline-none focus:border-red-700" />
      </label>
      {fehler && <p className="text-red-700">{fehler}</p>}
      <div className="flex gap-2">
        <button onClick={loeschen} disabled={laedt || bestaetigung.trim().toUpperCase() !== 'LÖSCHEN'} className="h-10 px-4 rounded-lg bg-red-700 text-white font-bold disabled:opacity-40">{laedt ? 'Wird gelöscht…' : 'Endgültig löschen'}</button>
        <button onClick={() => { setOffen(false); setBestaetigung(''); }} className="h-10 px-4 rounded-lg font-semibold hover:bg-red-100">Abbrechen</button>
      </div>
    </div>
  );
}

function Huelle({ titel, children }: { titel?: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-start justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-sm p-6 md:p-8 flex flex-col gap-4">
        {titel && <h1 className="text-2xl font-bold tracking-tight">{titel}</h1>}
        {children}
      </div>
    </div>
  );
}
