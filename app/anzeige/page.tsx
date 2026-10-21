"use client";
// Detailseite eines Inserats (/anzeige/?id=...), mit Merken und Melden.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { Anzeige } from '../../lib/suche';
import { fotoUrl } from '../../lib/fotos';
import { AUSSTATTUNG, OBJEKTARTEN } from '../../lib/filter';
import { useMerkliste } from '../../lib/merkliste';
import { useNutzer } from '../../lib/konto';
import { useMelden } from '../Meldedialog';
import Kontaktformular from '../Kontaktformular';
import { KeinFoto } from '../Ergebnisliste';
import { useModerator } from '../../lib/moderation';
import Sperrdialog from '../Sperrdialog';
import OepnvNaehe from '../OepnvNaehe';
import Grundversorgung from '../Grundversorgung';
import { Ort, grundversorgungLaden } from '../../lib/grundversorgung';
import { Station, nurMitNeuenLinien, stationenDerLinien, stationenLaden } from '../../lib/oepnvNaehe';

const Map = dynamic(() => import('../Map'), { ssr: false, loading: () => <div className="h-full w-full bg-zinc-100" /> });

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const objektartName: Record<string, string> = Object.fromEntries([...OBJEKTARTEN.wohnung, ...OBJEKTARTEN.haus].map(o => [o.wert, o.name]));
const AUSWEIS: Record<string, string> = { verbrauch: 'Verbrauchsausweis', bedarf: 'Bedarfsausweis', nicht_erforderlich: 'Nicht erforderlich' };

function Zeile({ name, wert }: { name: string; wert: React.ReactNode }) {
  if (wert === null || wert === undefined || wert === '') return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-zinc-100 last:border-0 text-sm">
      <span className="text-zinc-500">{name}</span>
      <span className="font-semibold text-right">{wert}</span>
    </div>
  );
}

export default function AnzeigeSeite() {
  const [a, setA] = useState<Anzeige | null | undefined>(undefined);
  const [bild, setBild] = useState(0);
  const { gemerkt, umschalten } = useMerkliste();
  const nutzer = useNutzer();
  const melden = useMelden();
  const moderator = useModerator(nutzer?.id);
  const [sperren, setSperren] = useState(false);
  const [stationen, setStationen] = useState<Station[] | null>(null);
  const [stationenFehler, setStationenFehler] = useState(false);
  const [station, setStation] = useState(0);
  // Linien aus dem Filter der Suche (…&linien=5897,12): dann nur deren nächste Haltestelle
  const [linienIds, setLinienIds] = useState<number[]>([]);
  useEffect(() => {
    const roh = new URLSearchParams(window.location.search).get('linien') ?? '';
    setLinienIds(roh.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) { setA(null); return; } // eslint-disable-line react-hooks/set-state-in-effect
    supabase.from('anzeigen').select('*').eq('id', id).maybeSingle().then(({ data }) => setA((data as Anzeige) ?? null));
  }, [nutzer]);

  // Haltestellen in der Nähe, sobald die Koordinaten des Inserats bekannt sind
  const lat = a?.koordinate_lat, lon = a?.koordinate_lon;
  const linienSchluessel = linienIds.join(',');
  useEffect(() => {
    if (lat == null || lon == null) return;
    let aktuell = true;
    setStationen(null); setStationenFehler(false); // eslint-disable-line react-hooks/set-state-in-effect
    const ids = linienSchluessel ? linienSchluessel.split(',').map(Number) : [];
    // Mit Linienfilter nur die nächste Haltestelle der Linie (mit allen Linien dort); ohne Filter die nächsten
    // Haltestellen, jede mit einer weiteren Linie (nicht fünfmal derselbe Bus)
    (ids.length ? stationenDerLinien(lat, lon, ids) : stationenLaden(lat, lon).then(s => nurMitNeuenLinien(s)))
      .then(s => { if (aktuell) { setStationen(s.slice(0, 6)); setStation(0); } })
      .catch(e => { console.error('Haltestellen in der Nähe:', e); if (aktuell) setStationenFehler(true); });
    return () => { aktuell = false; };
  }, [lat, lon, linienSchluessel]);

  // Grundversorgung in der Nähe (Supermarkt, Apotheke …)
  const [orte, setOrte] = useState<Ort[] | null>(null);
  const [orteFehler, setOrteFehler] = useState(false);
  const [orteAufKarte, setOrteAufKarte] = useState(false);
  useEffect(() => {
    if (lat == null || lon == null) return;
    let aktuell = true;
    setOrte(null); setOrteFehler(false); // eslint-disable-line react-hooks/set-state-in-effect
    grundversorgungLaden(lat, lon)
      .then(o => { if (aktuell) setOrte(o); })
      .catch(e => { console.error('Grundversorgung:', e); if (aktuell) setOrteFehler(true); });
    return () => { aktuell = false; };
  }, [lat, lon]);

  // Titel im Browser-Tab und für Suchmaschinen, die die Seite ausführen (geteilte Links zeigen die allgemeine Vorschau)
  useEffect(() => {
    if (a) document.title = `${a.titel} – IMMOBIL`;
    else if (a === null) document.title = 'Inserat nicht gefunden – IMMOBIL';
  }, [a]);

  if (a === undefined) return <div className="p-10 text-center text-sm text-zinc-500">Wird geladen…</div>;
  if (a === null) {
    return (
      <div className="p-16 text-center flex flex-col gap-3 items-center">
        <h1 className="text-2xl font-bold">Inserat nicht gefunden</h1>
        <p className="text-sm text-zinc-500">Vielleicht wurde es gelöscht oder pausiert.</p>
        <Link href="/suche/" className="h-10 px-5 rounded-lg bg-black text-white text-sm font-bold flex items-center">Zur Suche</Link>
      </div>
    );
  }

  const miete = a.transaktions_typ === 'mieten';
  const bilder: string[] = (a.bilder ?? []).map((b: string) => fotoUrl(b));
  const ausstattung = AUSSTATTUNG.filter(x => a[x.wert]);
  const eigenes = nutzer && a.inserent_id === nutzer.id;
  const etage = a.etage === null || a.etage === undefined ? null : a.etage === 0 ? 'Erdgeschoss' : a.etage < 0 ? 'Souterrain' : `${a.etage}. OG`;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6 md:py-10 flex flex-col gap-6">
      <Link href="/suche/" className="text-sm text-zinc-500 hover:text-black w-max">← Zurück zur Suche</Link>
      {moderator && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm">
          <span className="font-bold">Moderation:</span>
          <span>{a.status === 'gesperrt' ? 'Dieses Inserat ist gesperrt.' : a.status === 'pausiert' ? 'Dieses Inserat ist pausiert.' : 'Dieses Inserat ist online.'}</span>
          {a.status !== 'gesperrt'
            ? <button onClick={() => setSperren(true)} className="ml-auto font-bold text-red-700 underline underline-offset-2">Sperren</button>
            : <Link href="/moderation/" className="ml-auto font-bold underline underline-offset-2">Zur Moderation</Link>}
        </div>
      )}
      {sperren && <Sperrdialog anzeigeId={a.id} titel={a.titel} onAbbrechen={() => setSperren(false)} onFertig={() => { setSperren(false); setA({ ...a, status: 'gesperrt' }); }} />}

      {/* Fotos */}
      <div className={`relative rounded-2xl overflow-hidden bg-zinc-100 ${bilder.length ? 'aspect-[16/9] md:aspect-[21/9]' : 'h-40 md:h-56'}`}>
        {bilder.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bilder[bild]} alt={`Foto ${bild + 1} von ${a.titel}`} className="w-full h-full object-cover" />
            {bilder.length > 1 && (
              <>
                <button onClick={() => setBild((bild - 1 + bilder.length) % bilder.length)} aria-label="Vorheriges Foto" className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow text-lg">‹</button>
                <button onClick={() => setBild((bild + 1) % bilder.length)} aria-label="Nächstes Foto" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow text-lg">›</button>
                <span className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full">{bild + 1} / {bilder.length}</span>
              </>
            )}
          </>
        ) : <KeinFoto id={a.id} />}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-black text-white">{miete ? 'Miete' : 'Kauf'}</span>
              {a.objektart && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-zinc-100 text-zinc-700">{objektartName[a.objektart]}</span>}
              {a.anbieter_typ && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-zinc-100 text-zinc-700">{a.anbieter_typ === 'gewerblich' ? `Gewerblich${a.anbieter_name ? `: ${a.anbieter_name}` : ''}` : 'Privatanbieter'}</span>}
              {a.status !== 'aktiv' && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Nicht öffentlich ({a.status})</span>}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{a.titel}</h1>
            <p className="text-sm text-zinc-500 mt-1">{[a.adresse, [a.plz, a.ort].filter(Boolean).join(' '), a.bezirk].filter(Boolean).join(', ')}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              [euro.format(Number(a.preis)), miete ? 'Kaltmiete' : 'Kaufpreis'],
              [`${a.quadratmeter} m²`, 'Wohnfläche'],
              [String(a.zimmer), 'Zimmer'],
            ].map(([w, n]) => (
              <div key={n} className="bg-white border border-zinc-200 rounded-xl p-4">
                <div className="text-lg md:text-xl font-extrabold">{w}</div>
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">{n}</div>
              </div>
            ))}
          </div>

          {a.beschreibung && (
            <section className="bg-white border border-zinc-200 rounded-2xl p-5">
              <h2 className="font-bold mb-2">Beschreibung</h2>
              <p className="text-sm text-zinc-700 whitespace-pre-line leading-relaxed">{a.beschreibung}</p>
            </section>
          )}

          {ausstattung.length > 0 && (
            <section className="bg-white border border-zinc-200 rounded-2xl p-5">
              <h2 className="font-bold mb-3">Ausstattung</h2>
              <div className="flex flex-wrap gap-2">
                {ausstattung.map(x => <span key={x.wert} className="px-3 py-1.5 bg-zinc-100 rounded-full text-xs font-semibold">✓ {x.name}</span>)}
              </div>
            </section>
          )}

          <section className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-zinc-200 rounded-2xl p-5">
              <h2 className="font-bold mb-2">Kosten</h2>
              <Zeile name={miete ? 'Kaltmiete' : 'Kaufpreis'} wert={euro.format(Number(a.preis))} />
              {miete && <Zeile name="Nebenkosten" wert={a.nebenkosten && euro.format(Number(a.nebenkosten))} />}
              {miete && <Zeile name="Warmmiete" wert={a.warmmiete && euro.format(Number(a.warmmiete))} />}
              {miete && <Zeile name="Kaution" wert={a.kaution && euro.format(Number(a.kaution))} />}
              {!miete && <Zeile name="Käuferprovision" wert={a.provision} />}
              {miete && <Zeile name="WBS erforderlich" wert={a.wbs_erforderlich ? 'Ja' : 'Nein'} />}
            </div>
            <div className="bg-white border border-zinc-200 rounded-2xl p-5">
              <h2 className="font-bold mb-2">Gebäude und Energie</h2>
              <Zeile name="Etage" wert={etage} />
              <Zeile name="Baujahr" wert={a.baujahr} />
              <Zeile name="Verfügbar ab" wert={!a.verfuegbar_ab || new Date(a.verfuegbar_ab) <= new Date() ? 'sofort' : new Date(a.verfuegbar_ab).toLocaleDateString('de-DE')} />
              <Zeile name="Energieausweis" wert={AUSWEIS[a.energieausweis_art]} />
              <Zeile name="Energiekennwert" wert={a.energiekennwert && `${a.energiekennwert} kWh/(m²·a)`} />
              <Zeile name="Energieträger" wert={a.energietraeger} />
              <Zeile name="Effizienzklasse" wert={a.energieeffizienzklasse} />
            </div>
          </section>

          <OepnvNaehe stationen={stationen} auswahl={station} onAuswahl={setStation} fehler={stationenFehler}
            gewaehlteLinien={linienIds.length ? linienIds : undefined} />

          <Grundversorgung orte={orte} fehler={orteFehler} aufKarte={orteAufKarte} onAufKarte={setOrteAufKarte} />

          <section className="h-80 rounded-2xl overflow-hidden border border-zinc-200 relative z-0" aria-label="Karte mit Lage, Haltestellen und Grundversorgung">
            <Map anzeigen={[a]} haltestellen={[]} naechste={{}} linienUmkreisM={0}
              ortKreis={stationen?.length ? null : { lat: a.koordinate_lat, lon: a.koordinate_lon, m: 0 }} bezirke={[]} fokus={null}
              stationen={stationen ?? undefined} stationAuswahl={station}
              orte={orteAufKarte && orte ? orte : undefined} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 flex flex-col gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col gap-3">
            <div className="text-2xl font-extrabold">{euro.format(Number(miete && a.warmmiete ? a.warmmiete : a.preis))}</div>
            <div className="text-xs text-zinc-500 -mt-2">{miete && a.warmmiete ? 'Warmmiete pro Monat' : miete ? 'Kaltmiete pro Monat' : 'Kaufpreis'}</div>
            <button onClick={() => umschalten(a.id)} className={`h-11 rounded-lg border text-sm font-bold transition ${gemerkt(a.id) ? 'border-red-700 text-red-700 bg-red-50' : 'border-zinc-200 hover:border-black'}`}>
              {gemerkt(a.id) ? '♥ Gemerkt' : '♡ Merken'}
            </button>
            {eigenes && <Link href={`/inserieren/?id=${a.id}`} className="h-11 rounded-lg bg-black text-white text-sm font-bold flex items-center justify-center">Inserat bearbeiten</Link>}
            <p className="text-[11px] text-zinc-500">Inseriert am {new Date(a.erstellt_am).toLocaleDateString('de-DE')}</p>
          </div>
          {!eigenes && (
            <div className="bg-white border border-zinc-200 rounded-2xl p-5">
              <Kontaktformular anzeigeId={a.id} titel={a.titel} kontaktierbar={!!a.inserent_id && a.status === 'aktiv'} />
            </div>
          )}
          {eigenes && <Link href="/nachrichten/" className="text-xs text-zinc-500 hover:text-black underline underline-offset-2 self-start px-1">Anfragen zu deinen Inseraten ansehen</Link>}
          {!eigenes && (
            <button onClick={() => melden({ art: 'inserat', anzeigeId: a.id, anzeigeTitel: a.titel })} className="text-xs text-zinc-500 hover:text-red-700 underline underline-offset-2 self-start px-1">
              Inserat melden
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
