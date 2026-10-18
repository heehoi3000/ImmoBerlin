"use client";
// Übersicht der eigenen Inserate: ansehen, bearbeiten, pausieren, löschen.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useNutzer } from '../../lib/konto';
import { Anzeige } from '../../lib/suche';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const STATUS: Record<string, { text: string; farbe: string }> = {
  aktiv: { text: 'Online', farbe: 'bg-green-100 text-green-800' },
  pausiert: { text: 'Pausiert', farbe: 'bg-zinc-100 text-zinc-600' },
  gesperrt: { text: 'Gesperrt', farbe: 'bg-red-100 text-red-800' },
};

export default function MeineInserate() {
  const nutzer = useNutzer();
  const [inserate, setInserate] = useState<Anzeige[] | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    if (!nutzer) return;
    supabase.from('anzeigen').select('*').eq('inserent_id', nutzer.id).order('erstellt_am', { ascending: false })
      .then(({ data, error }) => { if (error) setFehler(true); setInserate((data as Anzeige[]) ?? []); });
  }, [nutzer]);

  async function status(a: Anzeige, neu: 'aktiv' | 'pausiert') {
    const { error } = await supabase.from('anzeigen').update({ status: neu }).eq('id', a.id);
    if (!error) setInserate(liste => liste!.map(x => x.id === a.id ? { ...x, status: neu } : x));
  }

  async function loeschen(a: Anzeige) {
    if (!confirm(`„${a.titel}“ endgültig löschen?`)) return;
    const { error } = await supabase.from('anzeigen').delete().eq('id', a.id);
    if (error) return;
    // Fotos aus dem Speicher entfernen (Pfad nach dem Bucket-Namen)
    const pfade = (a.bilder as string[] ?? []).map(url => url.split('/inserat-bilder/')[1]).filter(Boolean);
    if (pfade.length) await supabase.storage.from('inserat-bilder').remove(pfade);
    setInserate(liste => liste!.filter(x => x.id !== a.id));
  }

  if (nutzer === undefined) return <div className="p-10 text-center text-sm text-zinc-500">Wird geladen…</div>;
  if (nutzer === null) {
    return (
      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-8 text-center flex flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tight">Meine Inserate</h1>
          <p className="text-sm text-zinc-600">Melde dich an, um deine Inserate zu sehen und zu verwalten.</p>
          <Link href="/konto/?weiter=/meine-inserate/" className="h-11 rounded-lg bg-black text-white text-sm font-bold flex items-center justify-center">Anmelden</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meine Inserate</h1>
          <p className="text-sm text-zinc-500 mt-1">{inserate ? `${inserate.length} ${inserate.length === 1 ? 'Inserat' : 'Inserate'}` : 'Wird geladen…'}</p>
        </div>
        <Link href="/inserieren/" className="h-10 px-4 rounded-full bg-black text-white text-sm font-bold flex items-center hover:bg-zinc-800">+ Neues Inserat</Link>
      </div>
      {fehler && <p className="text-sm text-red-600">Deine Inserate konnten nicht geladen werden.</p>}
      {inserate?.length === 0 && (
        <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-10 text-center text-sm text-zinc-500">
          Du hast noch keine Inserate. <Link href="/inserieren/" className="text-black font-semibold underline underline-offset-2">Jetzt das erste aufgeben</Link>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {inserate?.map(a => {
          const s = STATUS[a.status] ?? STATUS.aktiv;
          return (
            <div key={a.id} className="bg-white border border-zinc-200 rounded-2xl p-3 flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-40 aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.bilder?.[0] ? <img src={a.bilder[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.farbe}`}>{s.text}</span>
                  <span className="text-[11px] text-zinc-400">{a.transaktions_typ === 'mieten' ? 'Miete' : 'Kauf'} · seit {new Date(a.erstellt_am).toLocaleDateString('de-DE')}</span>
                </div>
                <h2 className="font-bold truncate">{a.titel}</h2>
                <p className="text-xs text-zinc-500 truncate">{[a.adresse, a.ort].filter(Boolean).join(', ')}</p>
                <p className="text-sm font-semibold">{euro.format(Number(a.preis))} · {a.quadratmeter} m² · {a.zimmer} Zi.</p>
                {a.status === 'gesperrt' && <p className="text-xs text-red-700">Dieses Inserat wurde nach einer Meldung gesperrt. Bei Fragen nutze „Fehler melden“.</p>}
              </div>
              <div className="flex sm:flex-col gap-2 sm:w-36 shrink-0 text-sm font-semibold">
                <Link href={`/anzeige/?id=${a.id}`} className="flex-1 h-9 rounded-lg border border-zinc-200 flex items-center justify-center hover:border-black">Ansehen</Link>
                {a.status !== 'gesperrt' && <Link href={`/inserieren/?id=${a.id}`} className="flex-1 h-9 rounded-lg border border-zinc-200 flex items-center justify-center hover:border-black">Bearbeiten</Link>}
                {a.status === 'aktiv' && <button onClick={() => status(a, 'pausiert')} className="flex-1 h-9 rounded-lg border border-zinc-200 hover:border-black">Pausieren</button>}
                {a.status === 'pausiert' && <button onClick={() => status(a, 'aktiv')} className="flex-1 h-9 rounded-lg border border-zinc-200 hover:border-black">Online stellen</button>}
                <button onClick={() => loeschen(a)} className="flex-1 h-9 rounded-lg text-red-700 hover:bg-red-50">Löschen</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
