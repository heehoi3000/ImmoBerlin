"use client";

import { useState, useEffect, useRef, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Ortssuche from '../Ortssuche';
import Linienauswahl from '../Linienauswahl';
import Bezirksauswahl from '../Bezirksauswahl';
import Ergebnisliste, { AnzeigeKachel } from '../Ergebnisliste';
import { Kartenausschnitt } from '../../lib/oepnv';
import {
  Filter, STANDARD_FILTER, OBJEKTARTEN, AUSSTATTUNG, ENERGIEKLASSEN, UMKREISE_KM, SORTIERUNGEN,
  weitereFilterAnzahl,
} from '../../lib/filter';
import { bezirkeLaden, bezirksgrenzeLaden } from '../../lib/bezirke';
import { anzeigenSuchen, linienUmkreisM, Suchergebnis } from '../../lib/suche';

const Map = dynamic(() => import("../Map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-100 animate-pulse" />
});

type Panel = 'bezirke' | 'preis' | 'zimmer' | 'flaeche' | 'linien' | 'weitere' | null;

const LEER: Suchergebnis = { anzeigen: [], haltestellen: [], naechste: {} };

// --- kleine Bausteine der Filterleiste ---

function Umschalter<T extends string>({ werte, wert, onChange }: { werte: { wert: T; name: string }[]; wert: T; onChange: (w: T) => void }) {
  return (
    <div className="flex shrink-0 bg-zinc-100 rounded-full p-1 h-10">
      {werte.map(w => (
        <button key={w.wert} onClick={() => onChange(w.wert)} aria-pressed={wert === w.wert} className={`px-3.5 rounded-full text-[13px] font-semibold transition-all ${wert === w.wert ? 'bg-white text-black shadow-sm' : 'text-zinc-600 hover:text-black'}`}>
          {w.name}
        </button>
      ))}
    </div>
  );
}

function FilterKnopf({ titel, wert, aktiv, offen, onClick }: { titel: string; wert?: string; aktiv: boolean; offen: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-expanded={offen} aria-controls={offen ? 'filter-bereich' : undefined} className={`flex shrink-0 items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-semibold transition-all whitespace-nowrap ${aktiv ? 'border-zinc-900 bg-zinc-900 text-white' : offen ? 'border-zinc-900 bg-white text-black' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400'}`}>
      <span className="max-w-[220px] truncate">{titel}{wert ? `: ${wert}` : ''}</span>
      <svg aria-hidden="true" className={`w-3.5 h-3.5 transition-transform ${offen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
    </button>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-500 mb-2">{titel}</h4>
      {children}
    </div>
  );
}

function VonBis({ name, min, max, onMin, onMax, einheit }: { name: string; min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void; einheit?: string }) {
  const feld = "flex-1 w-full min-w-0 h-10 bg-white border border-zinc-200 rounded-xl px-3 text-sm font-medium focus:ring-2 focus:ring-black/10 focus:border-zinc-900 outline-none placeholder:text-zinc-500";
  return (
    <div className="flex gap-1.5 w-full items-center">
      <input type="number" placeholder="von" aria-label={`${name} von`} value={min} onChange={(e) => onMin(e.target.value)} className={feld} />
      <span className="text-zinc-500" aria-hidden="true">–</span>
      <input type="number" placeholder="bis" aria-label={`${name} bis`} value={max} onChange={(e) => onMax(e.target.value)} className={feld} />
      {einheit && <span className="text-xs text-zinc-500 w-8">{einheit}</span>}
    </div>
  );
}

function Chip({ aktiv, onClick, children }: { aktiv: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={aktiv} className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${aktiv ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-black'}`}>
      {children}
    </button>
  );
}

function bereichText(min: string, max: string, einheit: string) {
  const e = einheit ? ` ${einheit}` : '';
  if (min && max) return `${min}–${max}${e}`;
  if (min) return `ab ${min}${e}`;
  if (max) return `bis ${max}${e}`;
  return undefined;
}

function umschalten(liste: string[], wert: string) {
  return liste.includes(wert) ? liste.filter(w => w !== wert) : [...liste, wert];
}

export default function Suche() {
  // Entwurf: was im Formular steht. Angewendet: womit zuletzt gesucht wurde.
  const [filter, setFilter] = useState<Filter>(STANDARD_FILTER);
  const [angewendet, setAngewendet] = useState<Filter>(STANDARD_FILTER);
  const [panel, setPanel] = useState<Panel>(null);
  const [ausschnitt, setAusschnitt] = useState<Kartenausschnitt | null>(null);
  const [ergebnis, setErgebnis] = useState<Suchergebnis>(LEER);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [auswahlId, setAuswahlId] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<'liste' | 'karte'>('liste');   // nur auf schmalen Bildschirmen
  const [leisteUnten, setLeisteUnten] = useState(180);
  const leiste = useRef<HTMLDivElement>(null);
  const anfrageNr = useRef(0);

  const setze = (teil: Partial<Filter>) => setFilter(f => ({ ...f, ...teil }));

  // Suche von der Startseite übernehmen (Ort, Mieten/Kaufen, Wohnung/Haus)
  useEffect(() => {
    try {
      const daten = sessionStorage.getItem('startsuche');
      if (!daten) return;
      sessionStorage.removeItem('startsuche');
      const neu = { ...STANDARD_FILTER, ...(JSON.parse(daten) as Partial<Filter>) };
      setFilter(neu); // eslint-disable-line react-hooks/set-state-in-effect
      setAngewendet(neu);
    } catch { /* Speicher gesperrt */ }
  }, []);

  // Bezirksliste und Ortsgrenze schon beim Wählen des Orts im Hintergrund laden
  useEffect(() => {
    const ort = filter.ort;
    if (!ort?.osmRelation) return;
    bezirkeLaden(ort).catch(() => {});
    bezirksgrenzeLaden({ id: ort.osmRelation, name: ort.name }).catch(() => {});
  }, [filter.ort]);

  useEffect(() => {
    const nr = ++anfrageNr.current;
    anzeigenSuchen(angewendet)
      .then(e => { if (nr === anfrageNr.current) { setErgebnis(e); setFehler(false); } })
      .catch(err => { console.error("Ladefehler:", err); if (nr === anfrageNr.current) { setErgebnis(LEER); setFehler(true); } })
      .finally(() => { if (nr === anfrageNr.current) setLaedt(false); });
  }, [angewendet]);

  // Karte klebt direkt unter der Filterleiste; deren Höhe hängt von der Bildschirmbreite ab
  useEffect(() => {
    const el = leiste.current;
    if (!el) return;
    const messen = () => setLeisteUnten(el.getBoundingClientRect().height + 64);
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Aufklappbereich schließen, wenn außerhalb der Filterleiste geklickt wird
  useEffect(() => {
    function klick(e: MouseEvent) {
      if (leiste.current && !leiste.current.contains(e.target as Node)) setPanel(null);
    }
    document.addEventListener('mousedown', klick);
    return () => document.removeEventListener('mousedown', klick);
  }, []);

  const suchen = (neu: Filter = filter) => {
    setLaedt(true);
    setAuswahlId(null);
    setAngewendet(neu);
    setPanel(null);
  };

  const zuruecksetzen = () => {
    const neu = { ...STANDARD_FILTER, transaktion: filter.transaktion, immobilientyp: filter.immobilientyp };
    setFilter(neu);
    suchen(neu);
  };

  // Knopf, der den Aufklappbereich geöffnet hat: Escape schließt den Bereich und springt dorthin zurück
  const panelKnopf = useRef<HTMLElement | null>(null);
  const oeffne = (p: Panel) => { panelKnopf.current = document.activeElement as HTMLElement | null; setPanel(panel === p ? null : p); };
  const istMiete = filter.transaktion !== 'kaufen';
  const weitere = weitereFilterAnzahl(filter);
  const sortierungen = SORTIERUNGEN.filter(s => !s.nurMitLinien || angewendet.linien.length > 0);

  const einzeln = ergebnis.anzeigen.length === 1;
  const typName = angewendet.immobilientyp === 'wohnung' ? (einzeln ? 'Wohnung' : 'Wohnungen') : (einzeln ? 'Haus' : 'Häuser');
  const transaktionName = { mieten: 'zur Miete', kaufen: 'zum Kauf', tauschen: 'zum Tausch' }[angewendet.transaktion];
  const grenzen = angewendet.bezirke.length ? angewendet.bezirke : ergebnis.ortGrenze ? [ergebnis.ortGrenze] : [];
  const ortKreis = angewendet.ort && grenzen.length === 0
    ? { lat: angewendet.ort.lat, lon: angewendet.ort.lon, m: angewendet.umkreisKm * 1000, ausdehnung: angewendet.ort.ausdehnung }
    : null;

  const ortText = angewendet.ort ? (angewendet.bezirke.length ? `in ${angewendet.bezirke.map(b => b.name).join(', ')}` : `in ${angewendet.ort.kurzname ?? angewendet.ort.name}${angewendet.umkreisKm ? ` + ${angewendet.umkreisKm} km` : ''}`) : 'in ganz Deutschland';
  const ausgewaehlt = auswahlId ? ergebnis.anzeigen.find(a => a.id === auswahlId) : undefined;
  const pinWaehlen = (id: string | null) => {
    setAuswahlId(id);
    if (id && window.matchMedia('(min-width: 1024px)').matches) document.getElementById(`kachel-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const artWahl = (
    <>
      <Umschalter werte={[{ wert: 'mieten', name: 'Mieten' }, { wert: 'kaufen', name: 'Kaufen' }, { wert: 'tauschen', name: 'Tauschen' }]} wert={filter.transaktion}
        onChange={(t) => setze({ transaktion: t, preisMin: '', preisMax: '', wbs: 'egal' })} />
      <Umschalter werte={[{ wert: 'wohnung', name: 'Wohnung' }, { wert: 'haus', name: 'Haus' }]} wert={filter.immobilientyp}
        onChange={(t) => setze({ immobilientyp: t, objektarten: [], etageMin: '', etageMax: '' })} />
    </>
  );

  return (
    <div className="flex flex-col w-full">

      {/* --- FILTERLEISTE (klebt unter der Kopfzeile) --- */}
      <div ref={leiste} className="sticky top-16 z-[900] bg-white border-b border-zinc-200">
        <div className="px-4 lg:px-6 py-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 min-w-0 max-w-3xl items-center gap-1 h-12 pl-4 pr-1.5 bg-white border border-zinc-200 rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.06)] focus-within:border-zinc-900 transition">
              <svg className="w-4 h-4 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <div className="flex-1 min-w-0 [&_input]:border-0 [&_input]:focus:ring-0 [&_input]:h-10 [&_input]:bg-transparent [&_input]:text-[15px]">
                <Ortssuche ort={filter.ort} onChange={(o) => setze({ ort: o, bezirke: [] })} />
              </div>
              <select value={filter.umkreisKm} onChange={(e) => setze({ umkreisKm: parseInt(e.target.value) })} disabled={!filter.ort || filter.bezirke.length > 0}
                title={filter.bezirke.length > 0 ? 'Bei gewählten Bezirken wird genau in deren Grenzen gesucht' : 'Umkreis'}
                className="hidden sm:block h-9 border-l border-zinc-200 pl-3 pr-1 text-[13px] font-semibold bg-transparent outline-none disabled:text-zinc-300">
                {UMKREISE_KM.map(km => <option key={km} value={km}>{km === 0 ? 'Nur Ort' : `+ ${km} km`}</option>)}
              </select>
              <button onClick={() => suchen()} aria-label="Suchen" className="shrink-0 h-9 px-4 sm:px-5 rounded-full bg-zinc-900 text-white text-sm font-semibold hover:bg-black transition">
                Suchen
              </button>
            </div>
            <div className="hidden md:flex gap-2">{artWahl}</div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="flex md:hidden gap-2">{artWahl}</div>
            {filter.ort?.osmRelation && (
              <FilterKnopf titel="Bezirke" wert={filter.bezirke.length ? filter.bezirke.map(b => b.name).join(', ') : undefined}
                aktiv={filter.bezirke.length > 0} offen={panel === 'bezirke'} onClick={() => oeffne('bezirke')} />
            )}
            <FilterKnopf titel={istMiete ? (filter.preisArt === 'warm' ? 'Warmmiete' : 'Kaltmiete') : 'Kaufpreis'} wert={bereichText(filter.preisMin, filter.preisMax, '€')}
              aktiv={!!(filter.preisMin || filter.preisMax)} offen={panel === 'preis'} onClick={() => oeffne('preis')} />
            <FilterKnopf titel="Zimmer" wert={bereichText(filter.zimmerMin, filter.zimmerMax, '')}
              aktiv={!!(filter.zimmerMin || filter.zimmerMax)} offen={panel === 'zimmer'} onClick={() => oeffne('zimmer')} />
            <FilterKnopf titel="Fläche" wert={bereichText(filter.flaecheMin, filter.flaecheMax, 'm²')}
              aktiv={!!(filter.flaecheMin || filter.flaecheMax)} offen={panel === 'flaeche'} onClick={() => oeffne('flaeche')} />
            <FilterKnopf titel="ÖPNV-Linien" wert={filter.linien.length ? `${filter.linien.map(l => l.nummer).join(', ')} · ${linienUmkreisM(filter.linienUmkreisM)} m` : undefined}
              aktiv={filter.linien.length > 0} offen={panel === 'linien'} onClick={() => oeffne('linien')} />
            <FilterKnopf titel="Weitere Filter" wert={weitere ? String(weitere) : undefined}
              aktiv={weitere > 0} offen={panel === 'weitere'} onClick={() => oeffne('weitere')} />
            <button onClick={zuruecksetzen} className="shrink-0 h-9 px-3 text-[13px] font-semibold text-zinc-500 hover:text-black underline-offset-4 hover:underline">Zurücksetzen</button>
          </div>
        </div>

          {/* Aufklappbereiche */}
          {panel && (
            <div id="filter-bereich" onKeyDown={(e) => { if (e.key === 'Escape') { setPanel(null); panelKnopf.current?.focus(); } }}
              className="absolute top-full left-4 right-4 md:right-auto lg:left-6 md:min-w-[440px] mt-2 p-5 border border-zinc-200 rounded-2xl shadow-2xl bg-white z-50 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {panel === 'bezirke' && filter.ort && (
                <Bezirksauswahl ort={filter.ort} ausgewaehlt={filter.bezirke} onChange={(b) => setze({ bezirke: b })} />
              )}
              {panel === 'preis' && (
                <>
                  {istMiete && (
                    <div className="flex gap-2">
                      <Chip aktiv={filter.preisArt === 'kalt'} onClick={() => setze({ preisArt: 'kalt' })}>Kaltmiete</Chip>
                      <Chip aktiv={filter.preisArt === 'warm'} onClick={() => setze({ preisArt: 'warm' })}>Warmmiete</Chip>
                    </div>
                  )}
                  <VonBis name={istMiete ? (filter.preisArt === 'warm' ? 'Warmmiete' : 'Kaltmiete') : 'Kaufpreis'} min={filter.preisMin} max={filter.preisMax} onMin={(v) => setze({ preisMin: v })} onMax={(v) => setze({ preisMax: v })} einheit="€" />
                </>
              )}
              {panel === 'zimmer' && (
                <>
                  <div className="flex gap-1.5 flex-wrap">
                    {['1', '2', '3', '4', '5'].map(z => (
                      <Chip key={z} aktiv={filter.zimmerMin === z && !filter.zimmerMax} onClick={() => setze({ zimmerMin: z, zimmerMax: '' })}>ab {z}</Chip>
                    ))}
                  </div>
                  <VonBis name="Zimmer" min={filter.zimmerMin} max={filter.zimmerMax} onMin={(v) => setze({ zimmerMin: v })} onMax={(v) => setze({ zimmerMax: v })} />
                </>
              )}
              {panel === 'flaeche' && (
                <VonBis name="Fläche" min={filter.flaecheMin} max={filter.flaecheMax} onMin={(v) => setze({ flaecheMin: v })} onMax={(v) => setze({ flaecheMax: v })} einheit="m²" />
              )}
              {panel === 'linien' && (
                <Linienauswahl bezug={filter.ort ?? (ausschnitt ? { lat: (ausschnitt.minLat + ausschnitt.maxLat) / 2, lon: (ausschnitt.minLon + ausschnitt.maxLon) / 2 } : null)} ort={filter.ort} umkreisKm={filter.umkreisKm} ausgewaehlt={filter.linien} onChange={(l) => setze({ linien: l })}
                  umkreis={filter.linienUmkreisM} onUmkreis={(v) => setze({ linienUmkreisM: v })} />
              )}
              {panel === 'weitere' && (
              <div className="flex flex-col gap-5 md:w-[640px]">
                  <Abschnitt titel="Objektart">
                    <div className="flex gap-1.5 flex-wrap">
                      {OBJEKTARTEN[filter.immobilientyp].map(o => (
                        <Chip key={o.wert} aktiv={filter.objektarten.includes(o.wert)} onClick={() => setze({ objektarten: umschalten(filter.objektarten, o.wert) })}>{o.name}</Chip>
                      ))}
                    </div>
                  </Abschnitt>
                  <Abschnitt titel="Ausstattung">
                    <div className="flex gap-1.5 flex-wrap">
                      {AUSSTATTUNG.map(a => (
                        <Chip key={a.wert} aktiv={filter.ausstattung.includes(a.wert)} onClick={() => setze({ ausstattung: umschalten(filter.ausstattung, a.wert) })}>{a.name}</Chip>
                      ))}
                    </div>
                  </Abschnitt>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Abschnitt titel="Baujahr">
                      <VonBis name="Baujahr" min={filter.baujahrMin} max={filter.baujahrMax} onMin={(v) => setze({ baujahrMin: v })} onMax={(v) => setze({ baujahrMax: v })} />
                    </Abschnitt>
                    {filter.immobilientyp === 'wohnung' && (
                      <Abschnitt titel="Etage (0 = Erdgeschoss)">
                        <VonBis name="Etage" min={filter.etageMin} max={filter.etageMax} onMin={(v) => setze({ etageMin: v })} onMax={(v) => setze({ etageMax: v })} />
                      </Abschnitt>
                    )}
                    <Abschnitt titel="Bezugsfrei bis">
                      <input type="date" aria-label="Bezugsfrei bis" value={filter.bezugsfreiBis} onChange={(e) => setze({ bezugsfreiBis: e.target.value })}
                        className="w-full h-10 bg-white border border-zinc-200 rounded-xl px-3 text-sm font-medium focus:ring-1 focus:ring-black outline-none" />
                    </Abschnitt>
                    <Abschnitt titel="Energieeffizienz mindestens">
                      <select aria-label="Energieeffizienz mindestens" value={filter.energieMindestens} onChange={(e) => setze({ energieMindestens: e.target.value })}
                        className="w-full h-10 bg-white border border-zinc-200 rounded-xl px-3 text-sm font-medium">
                        <option value="">Egal</option>
                        {ENERGIEKLASSEN.map(k => <option key={k} value={k}>Klasse {k}{k !== 'A+' ? ' oder besser' : ''}</option>)}
                      </select>
                    </Abschnitt>
                  </div>
                  {istMiete && (
                    <Abschnitt titel="Wohnberechtigungsschein (WBS)">
                      <div className="flex gap-1.5">
                        <Chip aktiv={filter.wbs === 'egal'} onClick={() => setze({ wbs: 'egal' })}>Egal</Chip>
                        <Chip aktiv={filter.wbs === 'ohne'} onClick={() => setze({ wbs: 'ohne' })}>Ohne WBS</Chip>
                        <Chip aktiv={filter.wbs === 'nur'} onClick={() => setze({ wbs: 'nur' })}>Nur mit WBS</Chip>
                      </div>
                    </Abschnitt>
                  )}
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={() => suchen()} className="h-10 px-5 bg-zinc-900 text-white font-semibold text-sm rounded-full hover:bg-black">Ergebnisse anzeigen</button>
              </div>
            </div>
          )}
      </div>

      {/* --- LISTE LINKS, KARTE RECHTS --- */}
      <div className="flex w-full">
        <section className={`${ansicht === 'karte' ? 'hidden' : 'block'} lg:block w-full lg:w-[55%] xl:w-[58%] 2xl:w-[60%] px-4 lg:px-6 pt-5 pb-24 lg:pb-10`}>
          <div className="flex items-end justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h1 aria-live="polite" className="text-xl md:text-2xl font-bold tracking-tight">
                {laedt ? 'Suche läuft…' : fehler ? 'Suche fehlgeschlagen' : `${ergebnis.anzeigen.length.toLocaleString('de-DE')} ${typName} ${transaktionName}`}
              </h1>
              <p className="text-sm text-zinc-500 truncate">
                {fehler ? 'Bitte versuche es noch einmal.' : `${ortText}${angewendet.linien.length ? `, nahe ${angewendet.linien.map(l => l.nummer).join(', ')}` : ''}`}
              </p>
            </div>
            <select value={angewendet.sortierung} onChange={(e) => { setze({ sortierung: e.target.value }); suchen({ ...angewendet, sortierung: e.target.value }); }}
              aria-label="Sortierung" className="shrink-0 h-9 border border-zinc-200 rounded-full px-3 text-[13px] font-semibold bg-white outline-none hover:border-zinc-400">
              {sortierungen.map(s => <option key={s.wert} value={s.wert}>{s.name}</option>)}
            </select>
          </div>

          {laedt ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-8">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col gap-3 animate-pulse">
                  <div className="aspect-[4/3] rounded-2xl bg-zinc-200/70" />
                  <div className="h-4 w-1/3 rounded bg-zinc-200/70" /><div className="h-3 w-2/3 rounded bg-zinc-200/70" />
                </div>
              ))}
            </div>
          ) : ergebnis.anzeigen.length === 0 && !fehler ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center flex flex-col items-center gap-3">
              <p className="font-semibold">Keine passenden Angebote</p>
              <p className="text-sm text-zinc-500 max-w-sm">Vergrößere den Umkreis, entferne einzelne Filter oder wähle einen größeren Abstand zur Haltestelle.</p>
              <button onClick={zuruecksetzen} className="h-9 px-4 rounded-full border border-zinc-300 text-sm font-semibold hover:border-black">Filter zurücksetzen</button>
            </div>
          ) : (
            <Ergebnisliste anzeigen={ergebnis.anzeigen} naechste={ergebnis.naechste} aktivId={auswahlId} onHover={setHoverId}
              raster="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" linienIds={angewendet.linien.map(l => l.linie_id)} />
          )}
        </section>

        <section className={`${ansicht === 'liste' ? 'hidden' : 'block'} lg:block flex-1 lg:sticky z-0`}
          style={{ top: leisteUnten, height: `calc(100dvh - ${leisteUnten}px)` }}>
          <div className="relative h-full w-full lg:p-3 lg:pl-0">
            <div className="relative h-full w-full overflow-hidden lg:rounded-2xl">
              <Map anzeigen={ergebnis.anzeigen} haltestellen={ergebnis.haltestellen}
                linienUmkreisM={linienUmkreisM(angewendet.linienUmkreisM)} linien={angewendet.linien} ortKreis={ortKreis} bezirke={grenzen}
                aktivId={hoverId ?? auswahlId} onAuswahl={pinWaehlen} onAusschnittChange={setAusschnitt} />
              {ausgewaehlt && (
                <div className="absolute z-[1000] left-3 right-3 bottom-3 sm:left-auto sm:right-3 sm:w-[380px] bg-white rounded-2xl shadow-2xl p-2.5 pr-9">
                  <AnzeigeKachel a={ausgewaehlt} n={ergebnis.naechste[ausgewaehlt.id]} kompakt linienIds={angewendet.linien.map(l => l.linie_id)} />
                  <button onClick={() => setAuswahlId(null)} aria-label="Schließen" className="absolute right-2 top-2 w-7 h-7 rounded-full hover:bg-zinc-100 text-zinc-500 text-lg leading-none">×</button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Umschalter Liste/Karte auf schmalen Bildschirmen */}
      <button onClick={() => { setAnsicht(ansicht === 'liste' ? 'karte' : 'liste'); window.scrollTo({ top: 0 }); }}
        className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-[950] h-12 px-5 rounded-full bg-zinc-900 text-white text-sm font-semibold shadow-2xl flex items-center gap-2">
        {ansicht === 'liste' ? (
          <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" /></svg>Karte</>
        ) : (
          <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>Liste</>
        )}
      </button>
    </div>
  );
}
