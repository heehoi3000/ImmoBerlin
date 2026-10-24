"use client";
// Gemerkte Inserate (im Browser gespeichert).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { Anzeige } from '../../lib/suche';
import { useMerkliste } from '../../lib/merkliste';
import Ergebnisliste from '../Ergebnisliste';

export default function Merkliste() {
  const { ids } = useMerkliste();
  const [anzeigen, setAnzeigen] = useState<Anzeige[] | null>(null);

  useEffect(() => {
    if (ids.length === 0) { setAnzeigen([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    supabase.from('anzeigen').select('*').eq('status', 'aktiv').in('id', ids)
      .then(({ data }) => setAnzeigen(((data as Anzeige[]) ?? []).sort((a, b) => ids.indexOf(b.id) - ids.indexOf(a.id))));
  }, [ids]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Merkliste</h1>
        <p className="text-sm text-zinc-500 mt-1">Deine gemerkten Inserate werden nur in diesem Browser gespeichert.</p>
      </div>
      {anzeigen === null && <p className="text-sm text-zinc-500">Wird geladen…</p>}
      {anzeigen?.length === 0 && (
        <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-10 text-center text-sm text-zinc-500">
          Noch nichts gemerkt. Tippe in der <Link href="/suche/" className="text-black font-semibold underline underline-offset-2">Suche</Link> auf das Herz bei einem Inserat.
        </div>
      )}
      {anzeigen && <Ergebnisliste anzeigen={anzeigen} />}
      {anzeigen && anzeigen.length < ids.length && <p className="text-xs text-zinc-500">{ids.length - anzeigen.length} gemerkte Inserate sind nicht mehr online.</p>}
    </div>
  );
}
