"use client";
// Postfach: Anfragen zu den eigenen Inseraten und selbst gesendete Anfragen.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useNutzer } from '../../lib/konto';
import { nachrichtenGeaendert } from '../../lib/nachrichten';

interface Nachricht {
  id: string; anzeige_id: string; empfaenger_id: string; absender_id: string | null;
  name: string; email: string; telefon: string | null; nachricht: string; gelesen: boolean; erstellt_am: string;
  anzeigen: { titel: string } | null;
}
type Ansicht = 'eingang' | 'gesendet';

const zeit = (t: string) => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Postfach() {
  const nutzer = useNutzer();
  const [ansicht, setAnsicht] = useState<Ansicht>('eingang');
  const [liste, setListe] = useState<Nachricht[] | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ansicht') === 'gesendet') setAnsicht('gesendet'); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    if (!nutzer) return;
    setListe(null); // eslint-disable-line react-hooks/set-state-in-effect
    supabase.from('nachrichten').select('*, anzeigen(titel)')
      .eq(ansicht === 'eingang' ? 'empfaenger_id' : 'absender_id', nutzer.id)
      .order('erstellt_am', { ascending: false }).limit(200)
      .then(({ data, error }) => { setFehler(!!error); setListe((data as Nachricht[]) ?? []); });
  }, [nutzer, ansicht]);

  async function oeffnen(n: Nachricht) {
    setOffen(offen === n.id ? null : n.id);
    if (ansicht === 'eingang' && !n.gelesen) {
      const { error } = await supabase.from('nachrichten').update({ gelesen: true }).eq('id', n.id);
      if (!error) { setListe(l => l!.map(x => x.id === n.id ? { ...x, gelesen: true } : x)); nachrichtenGeaendert(); }
    }
  }

  async function loeschen(n: Nachricht) {
    if (!confirm(`Anfrage von ${n.name} löschen?`)) return;
    const { error } = await supabase.from('nachrichten').delete().eq('id', n.id);
    if (!error) { setListe(l => l!.filter(x => x.id !== n.id)); nachrichtenGeaendert(); }
  }

  if (nutzer === undefined) return <div className="p-10 text-center text-sm text-zinc-500">Wird geladen…</div>;
  if (nutzer === null) {
    return (
      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center flex flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Nachrichten</h1>
          <p className="text-sm text-zinc-600">Melde dich an, um Anfragen zu deinen Inseraten zu lesen.</p>
          <Link href="/konto/?weiter=/nachrichten/" className="h-11 rounded-lg bg-black text-white text-sm font-bold flex items-center justify-center">Anmelden</Link>
        </div>
      </div>
    );
  }

  const ungelesen = ansicht === 'eingang' ? liste?.filter(n => !n.gelesen).length ?? 0 : 0;
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nachrichten</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {ansicht === 'eingang' ? 'Anfragen von Interessenten zu deinen Inseraten. Du antwortest per E-Mail oder Telefon.' : 'Anfragen, die du an Anbieter gesendet hast. Die Antwort kommt per E-Mail.'}
        </p>
      </div>
      <div className="flex gap-1.5">
        {([['eingang', 'Eingang'], ['gesendet', 'Gesendet']] as const).map(([w, t]) => (
          <button key={w} onClick={() => { setAnsicht(w); setOffen(null); }}
            className={`px-4 py-2 rounded-full border text-sm font-bold transition ${ansicht === w ? 'border-black bg-black text-white' : 'border-zinc-200 text-zinc-600 hover:border-black'}`}>
            {t}{w === 'eingang' && ungelesen > 0 ? ` (${ungelesen} neu)` : ''}
          </button>
        ))}
      </div>
      {fehler && <p className="text-sm text-red-600">Die Nachrichten konnten nicht geladen werden.</p>}
      {liste === null && <p className="text-sm text-zinc-500">Wird geladen…</p>}
      {liste?.length === 0 && (
        <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-10 text-center text-sm text-zinc-500">
          {ansicht === 'eingang' ? 'Noch keine Anfragen. Sobald sich jemand für eines deiner Inserate interessiert, steht es hier.' : 'Du hast noch keine Anfragen gesendet.'}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {liste?.map(n => {
          const neu = ansicht === 'eingang' && !n.gelesen;
          const betreff = `Ihre Anfrage zu „${n.anzeigen?.titel ?? 'meinem Inserat'}“`;
          return (
            <div key={n.id} className={`bg-white border rounded-2xl transition ${neu ? 'border-black' : 'border-zinc-200'}`}>
              <button onClick={() => oeffnen(n)} aria-expanded={offen === n.id} className="w-full text-left p-4 flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${neu ? 'bg-red-700' : 'bg-transparent'}`} />
                <span className="flex-1 min-w-0">
                  <span className="flex justify-between gap-3">
                    <span className={`truncate ${neu ? 'font-bold' : 'font-semibold'}`}>{ansicht === 'eingang' ? n.name : n.anzeigen?.titel ?? 'Inserat gelöscht'}</span>
                    <span className="text-xs text-zinc-500 shrink-0">{zeit(n.erstellt_am)}</span>
                  </span>
                  {ansicht === 'eingang' && <span className="block text-xs text-zinc-500 truncate">zu {n.anzeigen?.titel ?? 'einem gelöschten Inserat'}</span>}
                  {offen !== n.id && <span className="block text-sm text-zinc-500 truncate mt-0.5">{n.nachricht}</span>}
                </span>
              </button>
              {offen === n.id && (
                <div className="px-4 pb-4 pl-9 flex flex-col gap-3">
                  <p className="text-sm text-zinc-800 whitespace-pre-line leading-relaxed">{n.nachricht}</p>
                  {ansicht === 'eingang' ? (
                    <>
                      <div className="text-xs text-zinc-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>{n.email}</span>{n.telefon && <span>{n.telefon}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm font-semibold">
                        <a href={`mailto:${n.email}?subject=${encodeURIComponent(betreff)}`} className="h-9 px-4 rounded-lg bg-black text-white flex items-center hover:bg-zinc-800">Per E-Mail antworten</a>
                        {n.telefon && <a href={`tel:${n.telefon.replace(/[^\d+]/g, '')}`} className="h-9 px-4 rounded-lg border border-zinc-200 flex items-center hover:border-black">Anrufen</a>}
                        <Link href={`/anzeige/?id=${n.anzeige_id}`} className="h-9 px-4 rounded-lg border border-zinc-200 flex items-center hover:border-black">Inserat ansehen</Link>
                        <button onClick={() => loeschen(n)} className="h-9 px-4 rounded-lg text-red-700 hover:bg-red-50">Löschen</button>
                      </div>
                    </>
                  ) : (
                    <Link href={`/anzeige/?id=${n.anzeige_id}`} className="text-sm font-semibold underline underline-offset-2 self-start">Inserat ansehen</Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
