"use client";
// Inserat sperren mit Begründung. Der Inserent sieht Kategorie und Begründung unter „Meine Inserate“ (Art. 17 DSA).
import { useRef, useState } from 'react';
import { useDialog } from '../lib/dialog';
import { supabase } from '../lib/supabase';
import { SPERR_KATEGORIEN, moderationsFehler } from '../lib/moderation';

export default function Sperrdialog({ anzeigeId, titel, onFertig, onAbbrechen }: { anzeigeId: string; titel: string; onFertig: () => void; onAbbrechen: () => void }) {
  const [kategorie, setKategorie] = useState('falsche_angaben');
  const [grund, setGrund] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');

  const dialog = useRef<HTMLFormElement>(null);
  useDialog(dialog, onAbbrechen);

  async function sperren(e: React.FormEvent) {
    e.preventDefault();
    setLaedt(true); setFehler('');
    const { error } = await supabase.rpc('inserat_sperren', { p_id: anzeigeId, p_kategorie: kategorie, p_grund: grund });
    setLaedt(false);
    if (error) { setFehler(moderationsFehler(error.message)); return; }
    onFertig();
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onMouseDown={onAbbrechen}>
      <form ref={dialog} onSubmit={sperren} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sperren-titel"
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
        <h2 id="sperren-titel" className="text-lg font-bold">Inserat sperren</h2>
        <p className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">Inserat: <strong className="text-zinc-800">{titel}</strong></p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-zinc-700">Grund</span>
          <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} className="h-10 border border-zinc-200 rounded-lg px-3 text-sm bg-white">
            {Object.entries(SPERR_KATEGORIEN).map(([wert, name]) => <option key={wert} value={wert}>{name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-zinc-700">Begründung für den Inserenten</span>
          <textarea required minLength={10} maxLength={2000} rows={5} value={grund} onChange={(e) => setGrund(e.target.value)}
            placeholder="Welche Angaben oder Inhalte sind das Problem? Zum Beispiel: Die Fotos stammen aus einem anderen Inserat."
            className="border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-black/10 focus:border-black outline-none" />
          <span className="text-[11px] text-zinc-500">Der Inserent sieht diesen Text. Nenne die konkreten Tatsachen, damit er die Entscheidung nachvollziehen und Einspruch einlegen kann.</span>
        </label>
        {fehler && <p className="text-sm text-red-600">{fehler}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onAbbrechen} className="h-10 px-4 rounded-lg text-sm font-semibold text-zinc-600 hover:bg-zinc-100">Abbrechen</button>
          <button type="submit" disabled={laedt} className="h-10 px-5 rounded-lg bg-red-700 text-white text-sm font-bold disabled:opacity-50">{laedt ? 'Wird gesperrt…' : 'Sperren'}</button>
        </div>
      </form>
    </div>
  );
}
