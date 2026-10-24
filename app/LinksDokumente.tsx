// Abschnitt „Links und Dokumente“ der Inseratsseite: PDFs (Grundriss, Energieausweis …) und Links des Inserenten.
// Fehlt beides, erscheint der Abschnitt nicht.
import { dokumentArtName, dokumentUrl, dokumenteVon, linkHost, linksVon } from '../lib/dokumente';

const PDF_SYMBOL = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>;
const LINK_SYMBOL = <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>;

function Eintrag({ href, symbol, titel, unter }: { href: string; symbol: React.ReactNode; titel: string; unter: string }) {
  return (
    <li>
      <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc"
        className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 hover:border-black transition">
        <span className="w-10 h-10 shrink-0 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center">{symbol}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold truncate">{titel}</span>
          <span className="block text-xs text-zinc-600 truncate">{unter}</span>
        </span>
        <span className="sr-only"> (öffnet in neuem Fenster)</span>
      </a>
    </li>
  );
}

export default function LinksDokumente({ dokumente, links }: { dokumente: unknown; links: unknown }) {
  const docs = dokumenteVon(dokumente);
  const verweise = linksVon(links);
  if (!docs.length && !verweise.length) return null;
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="dokumente-titel">
      <h2 id="dokumente-titel" className="font-bold mb-3">Links und Dokumente</h2>
      <ul className="grid md:grid-cols-2 gap-2">
        {docs.map(d => <Eintrag key={d.pfad} href={dokumentUrl(d.pfad)} symbol={PDF_SYMBOL} titel={d.titel || dokumentArtName(d.art)} unter={`${dokumentArtName(d.art)} · PDF`} />)}
        {verweise.map(l => <Eintrag key={l.url} href={l.url} symbol={LINK_SYMBOL} titel={l.titel || linkHost(l.url)} unter={linkHost(l.url)} />)}
      </ul>
      {verweise.length > 0 && <p className="text-[11px] text-zinc-500 mt-3">Links führen zu Seiten außerhalb von IMMOBIL. Für deren Inhalt ist der Inserent verantwortlich.</p>}
    </section>
  );
}
