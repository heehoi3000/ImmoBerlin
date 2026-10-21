"use client";
// Grundversorgung in der Nähe eines Inserats: je Art der nächste Ort mit Entfernung (Luftlinie).
// Ein Knopf blendet die Orte auf der Karte darunter ein.
import { ARTEN, Ort, UMKREIS_M } from '../lib/grundversorgung';

export default function Grundversorgung({ orte, fehler, aufKarte, onAufKarte }: {
  orte: Ort[] | null; fehler?: boolean; aufKarte: boolean; onAufKarte: (an: boolean) => void;
}) {
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="grundversorgung-titel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="grundversorgung-titel" className="font-bold">Einkaufen und Alltag</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Jeweils der nächste Ort, Entfernung in Luftlinie</p>
        </div>
        {orte && orte.length > 0 && (
          <button type="button" onClick={() => onAufKarte(!aufKarte)} aria-pressed={aufKarte}
            className={`h-8 px-3 rounded-lg border text-xs font-bold transition ${aufKarte ? 'border-black bg-black text-white' : 'border-zinc-300 hover:border-black'}`}>
            Auf der Karte zeigen
          </button>
        )}
      </div>
      {orte === null && !fehler && <p className="text-sm text-zinc-500 mt-3" role="status">Wird geladen…</p>}
      {fehler && <p className="text-sm text-zinc-500 mt-3" role="status">Die Angaben konnten nicht geladen werden.</p>}
      {orte && (
        <dl className="mt-3 grid sm:grid-cols-2 gap-x-6">
          {ARTEN.map(({ art, name, farbe }) => {
            const o = orte.find(x => x.art === art);
            return (
              <div key={art} className="flex items-baseline justify-between gap-3 py-2 border-b border-zinc-100 text-sm">
                <dt className="flex items-center gap-2 text-zinc-600">
                  <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: farbe }} />
                  {name}
                </dt>
                <dd className="text-right">
                  {o ? (
                    <>
                      {o.name && <span className="font-semibold">{o.name}, </span>}
                      <span className="tabular-nums">{o.entfernung_m.toLocaleString('de-DE')} m</span>
                    </>
                  ) : <span className="text-zinc-500">nicht im Umkreis von {(UMKREIS_M / 1000).toLocaleString('de-DE')} km</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <p className="text-[11px] text-zinc-500 mt-3">Daten: © OpenStreetMap-Mitwirkende (ODbL), nicht überall vollständig. Hausarzt: nur Praxen mit Angabe Allgemeinmedizin, ohne Namen.</p>
    </section>
  );
}
