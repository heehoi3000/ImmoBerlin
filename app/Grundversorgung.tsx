"use client";
// Grundversorgung in der Nähe eines Inserats: je Kategorie ein Knopf mit dem nächsten Ort (Luftlinie).
// Ein Knopf blendet alle Orte der Kategorie im Umkreis auf der Karte darunter ein oder aus.
import { ARTEN, Art, GRUPPEN, Ort, UMKREIS_M } from '../lib/grundversorgung';
import { symbolSvg } from '../lib/symbole';

export default function Grundversorgung({ orte, fehler, sichtbar, onUmschalten }: {
  orte: Ort[] | null; fehler?: boolean; sichtbar: Set<Art>; onUmschalten: (art: Art) => void;
}) {
  const km = (UMKREIS_M / 1000).toLocaleString('de-DE');
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="grundversorgung-titel">
      <h2 id="grundversorgung-titel" className="font-bold">Einkaufen und Alltag</h2>
      <p className="text-xs text-zinc-500 mt-0.5">Jeweils der nächste Ort in Luftlinie. Tippe auf eine Kategorie, um alle Orte im Umkreis von {km} km auf der Karte zu sehen.</p>
      {orte === null && !fehler && <p className="text-sm text-zinc-500 mt-3" role="status">Wird geladen…</p>}
      {fehler && <p className="text-sm text-zinc-500 mt-3" role="status">Die Angaben konnten nicht geladen werden.</p>}
      {orte && GRUPPEN.map(({ gruppe, name: gruppenName }) => (
        <div key={gruppe} className="mt-4">
          <h3 id={`gv-${gruppe}`} className="text-xs font-bold uppercase tracking-wide text-zinc-600">{gruppenName}</h3>
          <ul className="mt-2 grid sm:grid-cols-2 gap-2" aria-labelledby={`gv-${gruppe}`}>
            {ARTEN.filter(a => a.gruppe === gruppe).map(({ art, name }) => {
              const alle = orte.filter(x => x.art === art);
              const o = alle[0];
              const an = sichtbar.has(art);
              return (
                <li key={art}>
                  <button type="button" disabled={!o} aria-pressed={o ? an : undefined} onClick={() => onUmschalten(art)}
                    title={o ? `${alle.length} ${alle.length === 1 ? 'Ort' : 'Orte'} im Umkreis auf der Karte ${an ? 'ausblenden' : 'zeigen'}` : undefined}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-sm text-left transition
                      ${an ? 'border-black bg-black text-white' : 'border-zinc-200 hover:border-black'}
                      disabled:hover:border-zinc-200 disabled:cursor-default`}>
                    <span className="flex items-center gap-2">
                      <span className="shrink-0" dangerouslySetInnerHTML={{ __html: symbolSvg(art, 16) }} />
                      <span className={an ? 'font-semibold' : 'text-zinc-700'}>{name}</span>
                    </span>
                    <span className="text-right">
                      {o ? (
                        <>
                          {o.name && <span className="font-semibold">{o.name}, </span>}
                          <span className="tabular-nums">{o.entfernung_m.toLocaleString('de-DE')} m</span>
                        </>
                      ) : <span className="text-zinc-600">nicht im Umkreis von {km} km</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-[11px] text-zinc-500 mt-3">Daten: © OpenStreetMap-Mitwirkende (ODbL), nicht überall vollständig. Hausarzt: nur Praxen mit Angabe Allgemeinmedizin, ohne Namen. Schulen aller Art, ohne Angabe zu Schulform oder Einzugsgebiet.</p>
    </section>
  );
}
