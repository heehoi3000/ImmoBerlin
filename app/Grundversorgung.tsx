"use client";
// Grundversorgung in der Nähe eines Inserats: je Kategorie ein Knopf, der alle Orte der Kategorie im Umkreis
// auf der Karte darunter ein- oder ausblendet. Kategorien ohne Ort im Umkreis sind ausgegraut.
import { ARTEN, Art, GRUPPEN, Ort, UMKREIS_TEXT } from '../lib/grundversorgung';
import { symbolSvg } from '../lib/symbole';

export default function Grundversorgung({ orte, fehler, sichtbar, onUmschalten }: {
  orte: Ort[] | null; fehler?: boolean; sichtbar: Set<Art>; onUmschalten: (art: Art) => void;
}) {
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="grundversorgung-titel">
      <h2 id="grundversorgung-titel" className="font-bold">Einkaufen und Alltag</h2>
      <p className="text-xs text-zinc-500 mt-0.5">Tippe auf eine Kategorie, um alle Orte im Umkreis von {UMKREIS_TEXT} (Luftlinie) auf der Karte zu sehen.</p>
      {orte === null && !fehler && <p className="text-sm text-zinc-500 mt-3" role="status">Wird geladen…</p>}
      {fehler && <p className="text-sm text-zinc-500 mt-3" role="status">Die Angaben konnten nicht geladen werden.</p>}
      {orte && GRUPPEN.map(({ gruppe, name: gruppenName }) => (
        <div key={gruppe} className="mt-4">
          <h3 id={`gv-${gruppe}`} className="text-xs font-bold uppercase tracking-wide text-zinc-600">{gruppenName}</h3>
          <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby={`gv-${gruppe}`}>
            {ARTEN.filter(a => a.gruppe === gruppe).map(({ art, name }) => {
              const anzahl = orte.filter(x => x.art === art).length;
              const an = sichtbar.has(art);
              return (
                <li key={art}>
                  <button type="button" disabled={!anzahl} aria-pressed={anzahl ? an : undefined} onClick={() => onUmschalten(art)}
                    title={anzahl ? `${anzahl} ${anzahl === 1 ? 'Ort' : 'Orte'} im Umkreis` : `Nicht im Umkreis von ${UMKREIS_TEXT}`}
                    className={`flex items-center gap-2 h-9 px-3.5 rounded-full border text-sm font-semibold transition
                      ${an ? 'border-black bg-black text-white' : 'border-zinc-300 text-zinc-800 hover:border-black'}
                      disabled:border-dashed disabled:border-zinc-300 disabled:text-zinc-500 disabled:hover:border-zinc-200 disabled:cursor-default`}>
                    <span className="shrink-0" dangerouslySetInnerHTML={{ __html: symbolSvg(art, 16) }} />
                    {name}
                    {!anzahl && <span className="sr-only">, nicht im Umkreis von {UMKREIS_TEXT}</span>}
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
