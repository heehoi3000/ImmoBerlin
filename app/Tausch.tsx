"use client";
// Inseratsseite eines Tauschinserats: was der Inserent im Tausch sucht und, für den Inserenten selbst,
// die passenden Tauschpartner (lib/tausch.ts).
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Anzeige } from '../lib/suche';
import { TauschPartner, TauschWunsch, partnerLaden, wunschLaden, wunschZeilen } from '../lib/tausch';
import { AnzeigeKachel } from './Ergebnisliste';

export function TauschWunschAnzeige({ anzeigeId, eigenes }: { anzeigeId: string; eigenes: boolean }) {
  const [wunsch, setWunsch] = useState<TauschWunsch | null | undefined>(undefined);
  useEffect(() => {
    wunschLaden(anzeigeId).then(setWunsch).catch(e => { console.error('Tauschwunsch:', e); setWunsch(null); });
  }, [anzeigeId]);
  const zeilen = wunsch ? wunschZeilen(wunsch) : [];
  return (
    <section className="bg-violet-50 border border-violet-200 rounded-2xl p-5" aria-labelledby="tausch-titel">
      <h2 id="tausch-titel" className="font-bold">{eigenes ? 'Dein Tauschwunsch' : 'Gesucht im Tausch'}</h2>
      {wunsch === undefined && <p className="text-sm text-zinc-600 mt-2" role="status">Wird geladen…</p>}
      {wunsch !== undefined && zeilen.length === 0 && <p className="text-sm text-zinc-600 mt-2">Keine Angaben.</p>}
      {zeilen.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {zeilen.map(z => <li key={z} className="flex gap-2"><span aria-hidden="true" className="text-violet-700">•</span>{z}</li>)}
        </ul>
      )}
      <p className="text-[11px] text-zinc-600 mt-3">Ein Tausch braucht die Zustimmung beider Vermieter.</p>
    </section>
  );
}

export function TauschPartnerListe({ anzeigeId }: { anzeigeId: string }) {
  const [partner, setPartner] = useState<(TauschPartner & { a: Anzeige })[] | null>(null);
  const [fehler, setFehler] = useState(false);
  useEffect(() => {
    let aktuell = true;
    partnerLaden(anzeigeId).then(async liste => {
      if (!liste.length) return [];
      const { data, error } = await supabase.from('anzeigen').select('*').eq('status', 'aktiv').in('id', liste.map(p => p.id));
      if (error) throw error;
      const nachId = new Map(((data ?? []) as Anzeige[]).map(a => [a.id, a]));
      return liste.flatMap(p => nachId.has(p.id) ? [{ ...p, a: nachId.get(p.id)! }] : []);
    }).then(l => { if (aktuell) setPartner(l); })
      .catch(e => { console.error('Tauschpartner:', e); if (aktuell) setFehler(true); });
    return () => { aktuell = false; };
  }, [anzeigeId]);
  const gegenseitig = partner?.filter(p => p.gegenseitig).length ?? 0;
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="partner-titel">
      <h2 id="partner-titel" className="font-bold">Passende Tauschpartner</h2>
      <p className="text-xs text-zinc-500 mt-0.5 mb-3">Tauschinserate, die zu deinem Wunsch passen. „Passt gegenseitig“: deine Wohnung passt auch zu deren Wunsch.</p>
      {partner === null && !fehler && <p className="text-sm text-zinc-500" role="status">Wird gesucht…</p>}
      {fehler && <p className="text-sm text-zinc-500" role="status">Die Tauschpartner konnten nicht geladen werden.</p>}
      {partner?.length === 0 && <p className="text-sm text-zinc-500" role="status">Noch keine passenden Tauschinserate. Wir zeigen sie hier, sobald jemand passendes inseriert.</p>}
      {partner && partner.length > 0 && (
        <>
          <p className="text-sm font-semibold mb-3" role="status">{partner.length} passend, davon {gegenseitig} gegenseitig</p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
            {partner.map(p => (
              <li key={p.id} className="flex flex-col gap-1.5">
                <span className={`self-start text-[11px] font-bold px-2 py-0.5 rounded-full ${p.gegenseitig ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'}`}>
                  {p.gegenseitig ? 'Passt gegenseitig' : 'Passt zu deinem Wunsch'}
                </span>
                <AnzeigeKachel a={p.a} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
