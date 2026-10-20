"use client";
// Moderation für das Team: Meldungen bearbeiten, Inserate mit Begründung sperren, über Einsprüche entscheiden.
// Zugriff regelt die Datenbank (privat.moderatoren), die Seite blendet sich für alle anderen nur aus.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useNutzer } from '../../lib/konto';
import { SPERR_KATEGORIEN, moderationsFehler, useModerator } from '../../lib/moderation';
import Sperrdialog from '../Sperrdialog';

type Ansicht = 'offen' | 'erledigt' | 'gesperrt';

interface Meldung {
  id: string; art: string; nachricht: string; email: string | null; seite: string | null; erstellt_am: string; erledigt: boolean;
  anzeige_id: string | null; anzeigen: { id: string; titel: string; status: string } | null;
}
interface Gesperrt {
  id: string; titel: string; sperr_kategorie: string | null; sperrgrund: string | null; gesperrt_am: string | null;
  einspruch: string | null; einspruch_am: string | null; einspruch_antwort: string | null; einspruch_entschieden_am: string | null;
}

const ARTEN: Record<string, string> = { fehler: 'Fehler', inserat: 'Inserat', sonstiges: 'Sonstiges' };
const datum = (s: string | null) => s ? new Date(s).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
const knopf = 'h-9 px-3 rounded-lg border border-zinc-200 text-sm font-semibold hover:border-black disabled:opacity-50';

export default function Moderation() {
  const nutzer = useNutzer();
  const darf = useModerator(nutzer?.id);
  const [ansicht, setAnsicht] = useState<Ansicht>('offen');
  const [meldungen, setMeldungen] = useState<Meldung[] | null>(null);
  const [gesperrt, setGesperrt] = useState<Gesperrt[] | null>(null);
  const [sperren, setSperren] = useState<{ id: string; titel: string } | null>(null);
  const [fehler, setFehler] = useState('');

  const laden = useCallback(async () => {
    const [m, g] = await Promise.all([
      supabase.from('meldungen').select('id, art, nachricht, email, seite, erstellt_am, erledigt, anzeige_id, anzeigen(id, titel, status)')
        .order('erstellt_am', { ascending: false }).limit(200),
      supabase.from('anzeigen').select('id, titel, sperr_kategorie, sperrgrund, gesperrt_am, einspruch, einspruch_am, einspruch_antwort, einspruch_entschieden_am')
        .eq('status', 'gesperrt').order('einspruch_am', { ascending: false, nullsFirst: false }),
    ]);
    if (m.error || g.error) setFehler('Die Daten konnten nicht geladen werden.');
    setMeldungen((m.data as unknown as Meldung[]) ?? []);
    setGesperrt((g.data as Gesperrt[]) ?? []);
  }, []);

  useEffect(() => { if (darf) laden(); }, [darf, laden]); // eslint-disable-line react-hooks/set-state-in-effect

  async function rpc(name: string, args: Record<string, unknown>) {
    setFehler('');
    const { error } = await supabase.rpc(name, args);
    if (error) { setFehler(moderationsFehler(error.message)); return false; }
    await laden();
    return true;
  }

  if (nutzer === undefined) return <div className="p-10 text-center text-sm text-zinc-500">Wird geladen…</div>;
  if (!darf) {
    return (
      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Moderation</h1>
          <p className="text-sm text-zinc-600">Diese Seite ist nur für das IMMOBIL-Team.</p>
          {!nutzer && <Link href="/konto/?weiter=/moderation/" className="h-11 rounded-lg bg-black text-white text-sm font-bold flex items-center justify-center">Anmelden</Link>}
        </div>
      </div>
    );
  }

  const offen = meldungen?.filter(m => !m.erledigt) ?? [];
  const erledigt = meldungen?.filter(m => m.erledigt) ?? [];
  const offeneEinsprueche = gesperrt?.filter(g => g.einspruch && !g.einspruch_entschieden_am).length ?? 0;
  const reiter: { wert: Ansicht; name: string; zahl: number }[] = [
    { wert: 'offen', name: 'Offene Meldungen', zahl: offen.length },
    { wert: 'gesperrt', name: 'Gesperrte Inserate', zahl: offeneEinsprueche },
    { wert: 'erledigt', name: 'Erledigt', zahl: 0 },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Moderation</h1>
        <p className="text-sm text-zinc-500 mt-1">Meldungen prüfen, Inserate mit Begründung sperren und über Einsprüche entscheiden.</p>
      </div>
      <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 w-max max-w-full overflow-x-auto text-sm font-bold">
        {reiter.map(r => (
          <button key={r.wert} onClick={() => setAnsicht(r.wert)} className={`h-9 px-3 rounded-md whitespace-nowrap transition ${ansicht === r.wert ? 'bg-white shadow-sm text-black' : 'text-zinc-500'}`}>
            {r.name}{r.zahl > 0 && <span className="ml-1.5 px-1.5 rounded-full bg-red-700 text-white text-[10px]">{r.zahl}</span>}
          </button>
        ))}
      </div>
      {fehler && <p role="alert" className="text-sm text-red-600">{fehler}</p>}
      {meldungen === null && <p className="text-sm text-zinc-500">Wird geladen…</p>}

      {ansicht !== 'gesperrt' && meldungen && (
        <div className="flex flex-col gap-3">
          {(ansicht === 'offen' ? offen : erledigt).length === 0 && <p className="text-sm text-zinc-500 bg-white border border-dashed border-zinc-300 rounded-2xl p-8 text-center">Keine Meldungen.</p>}
          {(ansicht === 'offen' ? offen : erledigt).map(m => (
            <div key={m.id} className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`font-bold px-2 py-0.5 rounded-full ${m.art === 'inserat' ? 'bg-amber-100 text-amber-900' : 'bg-zinc-100 text-zinc-700'}`}>{ARTEN[m.art] ?? m.art}</span>
                <span className="text-zinc-500">{datum(m.erstellt_am)}</span>
                {m.email && <a href={`mailto:${m.email}`} className="text-zinc-500 underline underline-offset-2">{m.email}</a>}
              </div>
              {m.anzeigen && (
                <p className="text-sm">Inserat: <Link href={`/anzeige/?id=${m.anzeigen.id}`} className="font-semibold underline underline-offset-2">{m.anzeigen.titel}</Link>
                  {m.anzeigen.status === 'gesperrt' && <span className="ml-2 text-[11px] font-bold text-red-700">gesperrt</span>}</p>
              )}
              {m.art === 'inserat' && !m.anzeigen && <p className="text-xs text-zinc-500">Das Inserat gibt es nicht mehr.</p>}
              <p className="text-sm text-zinc-800 whitespace-pre-line">{m.nachricht}</p>
              {m.seite && <p className="text-[11px] text-zinc-500 truncate">Seite: {m.seite}</p>}
              <div className="flex flex-wrap gap-2 mt-1">
                {m.anzeigen && m.anzeigen.status !== 'gesperrt' && (
                  <button onClick={() => setSperren({ id: m.anzeigen!.id, titel: m.anzeigen!.titel })} className={`${knopf} text-red-700`}>Inserat sperren</button>
                )}
                <button onClick={() => rpc('meldung_erledigen', { p_id: m.id, p_erledigt: !m.erledigt })} className={knopf}>
                  {m.erledigt ? 'Wieder öffnen' : 'Erledigt'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {ansicht === 'gesperrt' && gesperrt && (
        <div className="flex flex-col gap-3">
          {gesperrt.length === 0 && <p className="text-sm text-zinc-500 bg-white border border-dashed border-zinc-300 rounded-2xl p-8 text-center">Keine gesperrten Inserate.</p>}
          {gesperrt.map(g => <GesperrtKarte key={g.id} g={g} rpc={rpc} />)}
        </div>
      )}

      {sperren && <Sperrdialog anzeigeId={sperren.id} titel={sperren.titel} onAbbrechen={() => setSperren(null)} onFertig={() => { setSperren(null); laden(); }} />}
    </div>
  );
}

function GesperrtKarte({ g, rpc }: { g: Gesperrt; rpc: (name: string, args: Record<string, unknown>) => Promise<boolean> }) {
  const [antwort, setAntwort] = useState('');
  const [laedt, setLaedt] = useState(false);
  const einspruchOffen = !!g.einspruch && !g.einspruch_entschieden_am;
  const ausfuehren = async (name: string, args: Record<string, unknown>) => { setLaedt(true); await rpc(name, args); setLaedt(false); };

  return (
    <div className={`bg-white border rounded-2xl p-4 flex flex-col gap-2 ${einspruchOffen ? 'border-amber-400' : 'border-zinc-200'}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">Gesperrt</span>
        <span className="text-zinc-500">{datum(g.gesperrt_am)}</span>
        {einspruchOffen && <span className="font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">Einspruch offen</span>}
      </div>
      <Link href={`/anzeige/?id=${g.id}`} className="font-semibold underline underline-offset-2 w-max max-w-full truncate">{g.titel}</Link>
      <p className="text-sm"><strong>{SPERR_KATEGORIEN[g.sperr_kategorie ?? ''] ?? 'Grund'}:</strong> {g.sperrgrund}</p>
      {g.einspruch && (
        <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-sm flex flex-col gap-1">
          <span className="text-[11px] text-zinc-500">Einspruch vom {datum(g.einspruch_am)}</span>
          <p className="whitespace-pre-line">{g.einspruch}</p>
          {g.einspruch_antwort && <p className="text-xs text-zinc-600 mt-1">Abgelehnt am {datum(g.einspruch_entschieden_am)}: {g.einspruch_antwort}</p>}
        </div>
      )}
      {einspruchOffen && (
        <textarea rows={3} maxLength={2000} value={antwort} onChange={(e) => setAntwort(e.target.value)} placeholder="Begründung, falls du den Einspruch ablehnst"
          className="border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-black/10 focus:border-black outline-none" />
      )}
      <div className="flex flex-wrap gap-2 mt-1">
        <button disabled={laedt} onClick={() => ausfuehren('inserat_freigeben', { p_id: g.id })} className={knopf}>Freigeben</button>
        {einspruchOffen && <button disabled={laedt} onClick={() => ausfuehren('einspruch_ablehnen', { p_id: g.id, p_antwort: antwort })} className={`${knopf} text-red-700`}>Einspruch ablehnen</button>}
      </div>
    </div>
  );
}
