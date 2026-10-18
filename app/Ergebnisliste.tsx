"use client";
// Liste der Treffer unter der Karte, in der gewählten Sortierung.
import Link from 'next/link';
import { Anzeige, NaechsteHaltestelle } from '../lib/suche';
import { useMerkliste } from '../lib/merkliste';
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
  onZeigen?: (id: string) => void;   // ohne: kein Knopf "Auf der Karte"
}

export default function Ergebnisliste({ anzeigen, naechste, onZeigen }: Props) {
  const { gemerkt, umschalten } = useMerkliste();
  if (anzeigen.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div key={a.id} className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-zinc-300 transition-all flex flex-col">
            <Link href={`/anzeige/?id=${a.id}`} className="block aspect-[16/10] bg-zinc-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.bilder?.[0] ? <img src={a.bilder[0]} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                : <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-zinc-50 to-zinc-200">🏠</div>}
            </Link>
            <button onClick={() => umschalten(a.id)} aria-label={gemerkt(a.id) ? 'Von der Merkliste entfernen' : 'Merken'}
              className={`absolute right-3 top-3 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-lg ${gemerkt(a.id) ? 'text-red-700' : 'text-zinc-500 hover:text-red-700'}`}>
              {gemerkt(a.id) ? '♥' : '♡'}
            </button>
            <div className="p-4 flex flex-col gap-2 flex-1">
              <Link href={`/anzeige/?id=${a.id}`} className="contents">
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
              </Link>
              {n && <p className="text-[11px] font-semibold text-blue-700">{n.distanz_m} m zur {n.linie}, {n.haltestelle}</p>}
              {onZeigen && <button onClick={() => onZeigen(a.id)} className="mt-auto pt-1 self-start text-[11px] font-semibold text-zinc-500 hover:text-black underline underline-offset-2">Auf der Karte zeigen</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
