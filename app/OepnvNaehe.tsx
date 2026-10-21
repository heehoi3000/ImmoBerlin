"use client";
// Haltestellen in der Nähe eines Inserats: Entfernung (Luftlinie), Linien mit Takt und Barrierefreiheit.
// Ein Klick auf eine Station zeigt sie auf der Karte darunter.
import { BARRIEREFREI_TEXT, Station, taktText } from '../lib/oepnvNaehe';
import { LINIENTYPEN, endpunkteKurz } from '../lib/oepnv';

const BARRIEREFREI_STIL = { ja: 'bg-emerald-50 text-emerald-800', eingeschraenkt: 'bg-amber-50 text-amber-800', nein: 'bg-red-50 text-red-800' };

// Rollstuhl-Symbol (ISO 7001), rein dekorativ
function Rollstuhl() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0">
      <circle cx="12" cy="4" r="2" />
      <path d="M11 7h2v5h4.5l2.6 5.2-1.8.9-2-4.1H11z" />
      <path d="M9.6 9.3l.4 2.1a5 5 0 1 0 5.9 6.1l1.9.6A7 7 0 1 1 9.6 9.3z" />
    </svg>
  );
}

// gewaehlteLinien: Linien aus dem Suchfilter; deren nächste Haltestelle steht vorn, die Linien sind hervorgehoben
export default function OepnvNaehe({ stationen, auswahl, onAuswahl, fehler, gewaehlteLinien }: {
  stationen: Station[] | null; auswahl: number; onAuswahl: (i: number) => void; fehler?: boolean;
  gewaehlteLinien?: number[];
}) {
  const gefiltert = !!gewaehlteLinien?.length;
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="oepnv-titel">
      <h2 id="oepnv-titel" className="font-bold">ÖPNV in der Nähe</h2>
      <p className="text-xs text-zinc-500 mt-0.5 mb-3">
        {gefiltert ? 'Zuerst die nächste Haltestelle deiner gewählten Linie, danach Haltestellen mit weiteren Linien. ' : 'Nächste Haltestellen, jede mit mindestens einer weiteren Linie. '}
        Entfernung in Luftlinie, Takt werktags von 6 bis 20 Uhr
      </p>
      {stationen === null && !fehler && <p className="text-sm text-zinc-500" role="status">Haltestellen werden geladen…</p>}
      {fehler && <p className="text-sm text-zinc-500" role="status">Die Haltestellen konnten nicht geladen werden.</p>}
      {stationen?.length === 0 && <p className="text-sm text-zinc-500" role="status">{gefiltert ? 'Keine Haltestelle der gewählten Linie gefunden.' : 'Keine Haltestelle im Umkreis von 1 km.'}</p>}
      {stationen && stationen.length > 0 && (
        <ul className="flex flex-col gap-2">
          {stationen.map((s, i) => (
            <li key={`${s.name}-${i}`}>
              <button type="button" onClick={() => onAuswahl(i)} aria-pressed={stationen.length > 1 ? i === auswahl : undefined}
                className={`w-full text-left rounded-xl border p-3 transition ${i === auswahl ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'}`}>
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold text-sm">
                    {i === 0 && <span className="sr-only">Nächste Haltestelle: </span>}
                    {s.name}
                  </span>
                  <span className="text-sm text-zinc-600 tabular-nums">{s.entfernung_m.toLocaleString('de-DE')} m</span>
                </span>
                <span className="flex flex-wrap gap-1.5 mt-2">
                  {s.linien.map(l => {
                    const takt = taktText(l.fahrten);
                    const ersatz = l.typ === 'ersatzverkehr';
                    const gewaehlt = gewaehlteLinien?.includes(l.linie_id);
                    return (
                      <span key={l.linie_id} className={`inline-flex items-center gap-1 rounded-full pl-1 pr-2 py-0.5 text-xs ${gewaehlt ? 'bg-blue-50 ring-2 ring-blue-700' : 'bg-zinc-100'}`} title={`${LINIENTYPEN[l.typ] ?? l.typ}${l.endpunkte ? `: ${endpunkteKurz(l.endpunkte)}` : ''}`}>
                        <span className={`rounded-full px-1.5 font-bold ${ersatz ? 'bg-white border border-dashed border-zinc-500 text-zinc-800' : 'bg-black text-white'}`}>{l.nummer}</span>
                        {gewaehlt && <span className="sr-only">(deine gewählte Linie)</span>}
                        {ersatz && <span className="text-zinc-600">Ersatzverkehr</span>}
                        {takt && <span className="text-zinc-600">{takt}</span>}
                      </span>
                    );
                  })}
                </span>
                <span className={`inline-flex items-center gap-1 mt-2 rounded-full px-2 py-0.5 text-xs font-semibold ${s.barrierefrei ? BARRIEREFREI_STIL[s.barrierefrei] : 'bg-zinc-100 text-zinc-600'}`}>
                  <Rollstuhl />
                  {s.barrierefrei ? BARRIEREFREI_TEXT[s.barrierefrei] : 'Barrierefreiheit: keine Angabe'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-zinc-500 mt-3">
        Fahrplandaten: DELFI e.V. (CC BY 4.0). Barrierefreiheit: © OpenStreetMap-Mitwirkende (ODbL), nicht überall eingetragen.
      </p>
    </section>
  );
}
