"use client";
// Trefferliste als Kacheln. Auf der Suchseite mit der Karte gekoppelt (Hover hebt den Preis-Pin hervor).
import Link from 'next/link';
import { Anzeige, NaechsteHaltestelle } from '../lib/suche';
import { useMerkliste } from '../lib/merkliste';
import { OBJEKTARTEN } from '../lib/filter';
import { haltestelleKurz } from '../lib/oepnv';
import { fotoFallback, fotoUrl } from '../lib/fotos';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const objektartName: Record<string, string> = Object.fromEntries(
  [...OBJEKTARTEN.wohnung, ...OBJEKTARTEN.haus].map(o => [o.wert, o.name]));

function etageText(etage: number | null | undefined) {
  if (etage === null || etage === undefined) return null;
  if (etage === 0) return 'EG';
  if (etage < 0) return 'Souterrain';
  return `${etage}. OG`;
}

function neu(datum: string | undefined) {
  return !!datum && Date.now() - new Date(datum).getTime() < 3 * 24 * 3600 * 1000;
}

// Platzhalter ohne Foto: sanfter Farbverlauf, je Inserat leicht anders getönt
export function KeinFoto({ id }: { id: string }) {
  const ton = [...id].reduce((s, z) => s + z.charCodeAt(0), 0) % 4;
  const verlauf = ['from-stone-100 to-stone-200', 'from-slate-100 to-slate-200', 'from-zinc-100 to-zinc-200', 'from-neutral-100 to-stone-200'][ton];
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${verlauf}`}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" /></svg>
    </div>
  );
}

// Link zum Inserat; nach einem Linienfilter mit den Linien, damit das Inserat deren nächste Haltestelle zeigt
export function inseratLink(id: string, linienIds?: number[]) {
  return `/anzeige/?id=${id}${linienIds?.length ? `&linien=${linienIds.join(',')}` : ''}`;
}

export function AnzeigeKachel({ a, n, aktiv, onHover, kompakt, linienIds }: {
  a: Anzeige; n?: NaechsteHaltestelle; aktiv?: boolean; onHover?: (id: string | null) => void; kompakt?: boolean; linienIds?: number[];
}) {
  const link = inseratLink(a.id, linienIds);
  const { gemerkt, umschalten } = useMerkliste();
  const miete = a.transaktions_typ === 'mieten';
  const fakten = [`${a.zimmer} Zi.`, `${a.quadratmeter} m²`, etageText(a.etage), objektartName[a.objektart]].filter(Boolean);
  const ort = [a.bezirk, a.ort].filter(Boolean).join(', ') || a.adresse;
  return (
    <div id={`kachel-${a.id}`} onMouseEnter={() => onHover?.(a.id)} onMouseLeave={() => onHover?.(null)}
      className={`group relative flex ${kompakt ? 'flex-row gap-3' : 'flex-col gap-3'} rounded-2xl transition ${aktiv ? 'ring-2 ring-black ring-offset-4 ring-offset-zinc-50' : ''}`}>
      {/* Foto verlinkt doppelt zum Titel darunter; für Tastatur und Bildschirmleser reicht der Titel-Link */}
      <Link href={link} tabIndex={-1} aria-hidden="true" className={`relative block overflow-hidden rounded-2xl bg-zinc-100 shrink-0 ${kompakt ? 'w-32 h-28' : 'aspect-[16/10] sm:aspect-[4/3]'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {a.bilder?.[0] ? <img src={fotoUrl(a.bilder[0], 'klein')} onError={fotoFallback(a.bilder[0])} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" /> : <KeinFoto id={a.id} />}
        {!kompakt && (
          <div className="absolute left-3 top-3 flex gap-1.5">
            {neu(a.erstellt_am) && <span className="px-2 py-1 rounded-full bg-white text-[11px] font-bold shadow-sm">Neu</span>}
          </div>
        )}
      </Link>
      <button onClick={() => umschalten(a.id)} aria-label={gemerkt(a.id) ? 'Von der Merkliste entfernen' : 'Merken'}
        className={`absolute ${kompakt ? 'left-[6.4rem] top-1.5 w-7 h-7 text-sm' : 'right-3 top-3 w-9 h-9 text-lg'} rounded-full bg-white/90 shadow-sm flex items-center justify-center hover:scale-110 transition ${gemerkt(a.id) ? 'text-red-600' : 'text-zinc-700'}`}>
        {gemerkt(a.id) ? '♥' : '♡'}
      </button>
      <Link href={link} className="flex flex-col gap-0.5 min-w-0 px-0.5">
        {neu(a.erstellt_am) && <span className="sr-only">Neu:</span>}
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-extrabold tracking-tight">{euro.format(Number(miete && a.warmmiete ? a.warmmiete : a.preis))}</span>
          <span className="text-xs text-zinc-500">{miete ? (a.warmmiete ? 'warm' : 'kalt') : 'Kaufpreis'}</span>
        </div>
        <p className="text-sm text-zinc-800">{fakten.join(' · ')}</p>
        <p className="text-sm text-zinc-500 truncate">{ort}</p>
        {n && <p className="text-xs font-semibold text-blue-700 mt-0.5 truncate">{n.linie} · {n.distanz_m} m bis {haltestelleKurz(n.haltestelle)}</p>}
        {!kompakt && <p className="text-xs text-zinc-500 truncate mt-0.5">{a.titel}</p>}
      </Link>
    </div>
  );
}

interface Props {
  anzeigen: Anzeige[];
  naechste: Record<string, NaechsteHaltestelle>;
  aktivId?: string | null;
  onHover?: (id: string | null) => void;
  raster?: string;
  linienIds?: number[];
}

export default function Ergebnisliste({ anzeigen, naechste, aktivId, onHover, raster = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', linienIds }: Props) {
  if (anzeigen.length === 0) return null;
  return (
    <div className={`grid ${raster} gap-x-5 gap-y-8`}>
      {anzeigen.map(a => <AnzeigeKachel key={a.id} a={a} n={naechste[a.id]} aktiv={aktivId === a.id} onHover={onHover} linienIds={linienIds} />)}
    </div>
  );
}
