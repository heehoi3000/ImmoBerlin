"use client";
// Liste der Treffer unter der Karte, in der gewählten Sortierung.
import { Anzeige, NaechsteHaltestelle } from '../lib/suche';
import { AUSSTATTUNG, OBJEKTARTEN } from '../lib/filter';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const objektartName: Record<string, string> = Object.fromEntries(
  [...OBJEKTARTEN.wohnung, ...OBJEKTARTEN.haus].map(o => [o.wert, o.name]));

function etageText(etage: number | null | undefined) {
  if (etage === null || etage === undefined) return null;
  if (etage === 0) return 'Erdgeschoss';
  if (etage < 0) return 'Souterrain';
  return `${etage}. OG`;
}

function verfuegbarText(datum: string | null | undefined) {
  if (datum === undefined) return null;
  if (!datum || new Date(datum) <= new Date()) return 'sofort frei';
  return `frei ab ${new Date(datum).toLocaleDateString('de-DE')}`;
}

interface Props {
  anzeigen: Anzeige[];
  naechste: Record<string, NaechsteHaltestelle>;
  onZeigen: (id: string) => void;
}

export default function Ergebnisliste({ anzeigen, naechste, onZeigen }: Props) {
  if (anzeigen.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {anzeigen.map(a => {
        const miete = a.transaktions_typ === 'mieten';
        const n = naechste[a.id];
        const ausstattung = AUSSTATTUNG.filter(x => a[x.wert]).map(x => x.name);
        const fakten = [
          objektartName[a.objektart],
          etageText(a.etage),
          a.baujahr ? `Baujahr ${a.baujahr}` : null,
          verfuegbarText(a.verfuegbar_ab),
          a.energieeffizienzklasse ? `Energie ${a.energieeffizienzklasse}` : null,
          a.wbs_erforderlich ? 'WBS erforderlich' : null,
        ].filter(Boolean);
        return (
          <button key={a.id} onClick={() => onZeigen(a.id)} className="text-left bg-white border border-zinc-200 rounded-xl p-4 hover:border-black hover:shadow-md transition-all flex flex-col gap-2">
            <h3 className="text-sm font-bold text-black leading-snug">{a.titel}</h3>
            <p className="text-[11px] text-zinc-500">{a.adresse}</p>
            <div className="flex gap-4 items-baseline">
              <div>
                <div className="text-base font-extrabold text-black">{euro.format(Number(a.preis))}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{miete ? 'Kaltmiete' : 'Kaufpreis'}</div>
              </div>
              {miete && a.warmmiete && (
                <div>
                  <div className="text-sm font-bold text-zinc-700">{euro.format(Number(a.warmmiete))}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Warmmiete</div>
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-zinc-700">{a.quadratmeter} m²</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Fläche</div>
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-700">{a.zimmer}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wide">Zimmer</div>
              </div>
            </div>
            {fakten.length > 0 && <p className="text-[11px] text-zinc-600">{fakten.join(' · ')}</p>}
            {ausstattung.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {ausstattung.map(x => <span key={x} className="px-1.5 py-0.5 bg-zinc-100 rounded text-[10px] text-zinc-600">{x}</span>)}
              </div>
            )}
            {n && <p className="text-[11px] font-semibold text-blue-700">{n.distanz_m} m zur {n.linie}, {n.haltestelle}</p>}
          </button>
        );
      })}
    </div>
  );
}
