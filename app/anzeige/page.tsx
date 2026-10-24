"use client";
// Detailseite eines Inserats (/anzeige/?id=...), mit Merken und Melden.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';
import { Anzeige } from '../../lib/suche';
import { fotoUrl } from '../../lib/fotos';
import { AUSSTATTUNG, OBJEKTARTEN, WBS_ARTEN } from '../../lib/filter';
import { useMerkliste } from '../../lib/merkliste';
import { useNutzer } from '../../lib/konto';
import { useMelden } from '../Meldedialog';
import Kontaktformular from '../Kontaktformular';
import { KeinFoto } from '../Ergebnisliste';
import { useModerator } from '../../lib/moderation';
import Sperrdialog from '../Sperrdialog';
import OepnvNaehe from '../OepnvNaehe';
import { TauschPartnerListe, TauschWunschAnzeige } from '../Tausch';
import Grundversorgung from '../Grundversorgung';
import Routenplanung from '../Routenplanung';
import LinksDokumente from '../LinksDokumente';
import { Art, Ort, grundversorgungLaden } from '../../lib/grundversorgung';
import { Station, nurMitNeuenLinien, stationenDerLinien, stationenLaden } from '../../lib/oepnvNaehe';

const Map = dynamic(() => import('../Map'), { ssr: false, loading: () => <div className="h-full w-full bg-zinc-100" /> });

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const objektartName: Record<string, string> = Object.fromEntries([...OBJEKTARTEN.wohnung, ...OBJEKTARTEN.haus].map(o => [o.wert, o.name]));
const wbsArtName: Record<string, string> = Object.fromEntries(WBS_ARTEN.map(o => [o.wert, o.name]));
const AUSWEIS: Record<string, string> = { verbrauch: 'Verbrauchsausweis', bedarf: 'Bedarfsausweis', nicht_erforderlich: 'Nicht erforderlich' };

// Farben der Effizienzklassen wie auf dem Energieausweis (A+ dunkelgrün bis H rot); Text so gewählt, dass er lesbar bleibt
const KLASSEN_FARBE: Record<string, [string, string]> = {
  'A+': ['#007a3d', '#fff'], A: ['#2e9e44', '#000'], B: ['#8cc63f', '#000'], C: ['#c8d82e', '#000'], D: ['#fff200', '#000'],
  E: ['#fcb814', '#000'], F: ['#f37021', '#000'], G: ['#ed1c24', '#000'], H: ['#b5121b', '#fff'],
};

function Effizienzklasse({ klasse }: { klasse: string }) {
  const [hintergrund, text] = KLASSEN_FARBE[klasse] ?? ['#e4e4e7', '#000'];
  return (
    <span className="inline-flex items-center justify-center min-w-9 h-6 pl-2 pr-3 text-xs font-extrabold"
      style={{ background: hintergrund, color: text, clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)' }}>
      {klasse}
    </span>
  );
}

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
  const [orteSichtbar, setOrteSichtbar] = useState<Set<Art>>(new Set());
  const orteUmschalten = (art: Art) => setOrteSichtbar(s => {
    const neu = new Set(s);
    if (neu.has(art)) neu.delete(art); else neu.add(art);
    return neu;
  });
  useEffect(() => {
    if (lat == null || lon == null) return;
    let aktuell = true;
    setOrte(null); setOrteFehler(false); setOrteSichtbar(new Set()); // eslint-disable-line react-hooks/set-state-in-effect
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

  const miete = a.transaktions_typ !== 'kaufen';
  const tausch = a.transaktions_typ === 'tauschen';
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
              {a.anbieter_typ && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-zinc-100 text-zinc-700">{a.anbieter_typ === 'gewerblich' ? `Gewerblich${a.anbieter_name ? `: ${a.anbieter_name}` : ''}` : 'Privatanbieter'}</span>}
              {a.status !== 'aktiv' && <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Nicht öffentlich ({a.status})</span>}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{a.titel}</h1>
            <p className="text-sm text-zinc-500 mt-1">{[a.adresse, [a.plz, a.ort].filter(Boolean).join(' '), a.bezirk].filter(Boolean).join(', ')}</p>
          </div>

          {/* Eckdaten unter den Bildern; Nebenkosten, Kaution und Provision als Zeile darunter */}
          <div className={`grid gap-3 ${miete && a.warmmiete ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
            {[
              [euro.format(Number(a.preis)), miete ? 'Kaltmiete' : 'Kaufpreis'],
              ...(miete && a.warmmiete ? [[euro.format(Number(a.warmmiete)), 'Warmmiete']] : []),
              [`${a.quadratmeter} m²`, 'Wohnfläche'],
              [String(a.zimmer), 'Zimmer'],
            ].map(([w, n]) => (
              <div key={n} className="bg-white border border-zinc-200 rounded-xl p-4">
                <div className="text-lg md:text-xl font-extrabold">{w}</div>
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">{n}</div>
              </div>
            ))}
          </div>
          {(() => {
            const weitere = miete
              ? [a.nebenkosten && `Nebenkosten ${euro.format(Number(a.nebenkosten))}`, a.kaution && `Kaution ${euro.format(Number(a.kaution))}`]
              : [a.provision && `Käuferprovision: ${a.provision}`];
            const text = weitere.filter(Boolean).join(' · ');
            return text ? <p className="text-sm text-zinc-600 -mt-3">{text}</p> : null;
          })()}

          {tausch && <TauschWunschAnzeige anzeigeId={a.id} eigenes={!!eigenes} />}
          {tausch && eigenes && <TauschPartnerListe anzeigeId={a.id} />}

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

          <section className="bg-white border border-zinc-200 rounded-2xl p-5">
            <h2 className="font-bold mb-2">Gebäude und Energie</h2>
            {(() => {
              // Angaben gleichmäßig auf zwei Spalten verteilen (leere fallen weg)
              const zeilen: [string, React.ReactNode][] = ([
                ['Typ', a.objektart && objektartName[a.objektart]],
                ['Etage', etage],
                ['Baujahr', a.baujahr],
                ['Verfügbar ab', !a.verfuegbar_ab || new Date(a.verfuegbar_ab) <= new Date() ? 'sofort' : new Date(a.verfuegbar_ab).toLocaleDateString('de-DE')],
                ['WBS erforderlich', miete ? (a.wbs_erforderlich ? 'Ja' : 'Nein') : null],
                ['WBS-Art', miete && a.wbs_erforderlich ? (a.wbs_art ? wbsArtName[a.wbs_art] : 'ohne Angabe') : null],
                ['Energieausweis', AUSWEIS[a.energieausweis_art]],
                ['Energiekennwert', a.energiekennwert && `${a.energiekennwert} kWh/(m²·a)`],
                ['Energieträger', a.energietraeger],
                ['Effizienzklasse', a.energieeffizienzklasse && <Effizienzklasse klasse={a.energieeffizienzklasse} />],
              ] as [string, React.ReactNode][]).filter(([, w]) => w !== null && w !== undefined && w !== '');
              const haelfte = Math.ceil(zeilen.length / 2);
              return (
                <div className="grid md:grid-cols-2 gap-x-8">
                  {[zeilen.slice(0, haelfte), zeilen.slice(haelfte)].map((spalte, i) => (
                    <div key={i}>{spalte.map(([n, w]) => <Zeile key={n} name={n} wert={w} />)}</div>
                  ))}
                </div>
              );
            })()}
          </section>

          <LinksDokumente dokumente={a.dokumente} links={a.links} />

          <OepnvNaehe stationen={stationen} auswahl={station} onAuswahl={setStation} fehler={stationenFehler}
            gewaehlteLinien={linienIds.length ? linienIds : undefined} />

          {/* Karte links, Einkaufen und Alltag rechts daneben (auf dem Handy untereinander) */}
          <div className="grid md:grid-cols-[1fr_300px] gap-6">
            <section className="h-80 md:h-auto md:min-h-80 rounded-2xl overflow-hidden border border-zinc-200 relative z-0" aria-label="Karte mit Lage, Haltestellen und Grundversorgung">
              <Map anzeigen={[a]} haltestellen={[]} naechste={{}} linienUmkreisM={0}
                ortKreis={stationen?.length ? null : { lat: a.koordinate_lat, lon: a.koordinate_lon, m: 0 }} bezirke={[]} fokus={null}
                stationen={stationen ?? undefined} stationAuswahl={station}
                orte={orte && orteSichtbar.size ? orte.filter(o => orteSichtbar.has(o.art)) : undefined} />
            </section>
            <div className="self-start">
              <Grundversorgung orte={orte} fehler={orteFehler} sichtbar={orteSichtbar} onUmschalten={orteUmschalten} />
            </div>
          </div>

          <Routenplanung lat={a.koordinate_lat} lon={a.koordinate_lon} />
        </div>

        <aside className="lg:sticky lg:top-24 flex flex-col gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col gap-3">
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
