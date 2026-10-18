"use client";

import { useState, useEffect, useRef, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Banner from './Banner';
import Ortssuche from './Ortssuche';
import Linienauswahl from './Linienauswahl';
import Bezirksauswahl from './Bezirksauswahl';
import Ergebnisliste from './Ergebnisliste';
import { Kartenausschnitt } from '../lib/oepnv';
import {
  Filter, STANDARD_FILTER, OBJEKTARTEN, AUSSTATTUNG, ENERGIEKLASSEN, UMKREISE_KM, SORTIERUNGEN,
  weitereFilterAnzahl,
} from '../lib/filter';
import { anzeigenSuchen, erweiterteFelderVorhanden, linienUmkreisM, Suchergebnis } from '../lib/suche';

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <div className="p-6 text-zinc-500 font-bold tracking-widest uppercase flex h-full w-full items-center justify-center bg-white">Karte lädt...</div>
});

type Panel = 'bezirke' | 'preis' | 'zimmer' | 'flaeche' | 'linien' | 'weitere' | null;

const LEER: Suchergebnis = { anzeigen: [], haltestellen: [], naechste: {} };

// --- kleine Bausteine der Filterleiste ---

function Umschalter<T extends string>({ werte, wert, onChange }: { werte: { wert: T; name: string }[]; wert: T; onChange: (w: T) => void }) {
  return (
    <div className="flex bg-white border border-zinc-200 rounded-lg p-1 h-[48px] shadow-sm">
      {werte.map(w => (
        <button key={w.wert} onClick={() => onChange(w.wert)} className={`px-3 md:px-4 rounded-md text-xs font-bold transition-all ${wert === w.wert ? 'bg-black text-white' : 'text-zinc-600 hover:text-black'}`}>
          {w.name}
        </button>
      ))}
    </div>
  );
}

function FilterKnopf({ titel, wert, aktiv, offen, onClick }: { titel: string; wert?: string; aktiv: boolean; offen: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 h-[40px] px-3 rounded-lg border text-xs font-bold transition-all whitespace-nowrap ${aktiv ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-black'}`}>
      <span>{titel}{wert ? `: ${wert}` : ''}</span>
      <svg className={`w-3.5 h-3.5 transition-transform ${offen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
    </button>
  );
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-extrabold text-zinc-400 mb-1.5 uppercase tracking-widest">{titel}</h4>
      {children}
    </div>
  );
}

function VonBis({ min, max, onMin, onMax, einheit }: { min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void; einheit?: string }) {
  const feld = "flex-1 w-full min-w-0 h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400";
  return (
    <div className="flex gap-1.5 w-full items-center">
      <input type="number" placeholder="von" value={min} onChange={(e) => onMin(e.target.value)} className={feld} />
      <span className="text-zinc-300">–</span>
      <input type="number" placeholder="bis" value={max} onChange={(e) => onMax(e.target.value)} className={feld} />
      {einheit && <span className="text-xs text-zinc-500 w-8">{einheit}</span>}
    </div>
  );
}

function Chip({ aktiv, onClick, children }: { aktiv: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`px-2.5 py-1.5 rounded-md border text-[11px] font-bold transition-all ${aktiv ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>
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

export default function Home() {
  // Entwurf: was im Formular steht. Angewendet: womit zuletzt gesucht wurde.
  const [filter, setFilter] = useState<Filter>(STANDARD_FILTER);
  const [angewendet, setAngewendet] = useState<Filter>(STANDARD_FILTER);
  const [panel, setPanel] = useState<Panel>(null);
  const [ausschnitt, setAusschnitt] = useState<Kartenausschnitt | null>(null);
  const [erweitert, setErweitert] = useState(false);
  const [ergebnis, setErgebnis] = useState<Suchergebnis>(LEER);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState(false);
  const [fokus, setFokus] = useState<{ id: string; nr: number } | null>(null);
  const leiste = useRef<HTMLDivElement>(null);
  const anfrageNr = useRef(0);

  const setze = (teil: Partial<Filter>) => setFilter(f => ({ ...f, ...teil }));

  useEffect(() => { erweiterteFelderVorhanden().then(setErweitert); }, []);

  useEffect(() => {
    const nr = ++anfrageNr.current;
    anzeigenSuchen(angewendet, erweitert)
      .then(e => { if (nr === anfrageNr.current) { setErgebnis(e); setFehler(false); } })
      .catch(err => { console.error("Ladefehler:", err); if (nr === anfrageNr.current) { setErgebnis(LEER); setFehler(true); } })
      .finally(() => { if (nr === anfrageNr.current) setLaedt(false); });
  }, [angewendet, erweitert]);

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
    setAngewendet(neu);
    setPanel(null);
  };

  const zuruecksetzen = () => {
    const neu = { ...STANDARD_FILTER, transaktion: filter.transaktion, immobilientyp: filter.immobilientyp };
    setFilter(neu);
    suchen(neu);
  };

  const oeffne = (p: Panel) => setPanel(panel === p ? null : p);
  const istMiete = filter.transaktion === 'mieten';
  const weitere = weitereFilterAnzahl(filter);
  const sortierungen = SORTIERUNGEN.filter(s => !s.nurMitLinien || angewendet.linien.length > 0);

  const typName = angewendet.immobilientyp === 'wohnung' ? 'Wohnungen' : 'Häuser';
  const transaktionName = angewendet.transaktion === 'mieten' ? 'zur Miete' : 'zum Kauf';
  const ortKreis = angewendet.ort && angewendet.bezirke.length === 0
    ? { lat: angewendet.ort.lat, lon: angewendet.ort.lon, m: angewendet.umkreisKm * 1000, ausdehnung: angewendet.ort.ausdehnung }
    : null;

  return (
    <div className="flex flex-col min-h-screen w-full bg-white overflow-x-hidden">
      <Banner />

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-4">

        {/* --- FILTERLEISTE --- */}
        <div ref={leiste} className="flex flex-col gap-3 w-full relative z-20">

          {/* Zeile 1: Was und wo */}
          <div className="flex flex-col lg:flex-row gap-2 w-full">
            <div className="flex gap-2">
              <Umschalter werte={[{ wert: 'mieten', name: 'Mieten' }, { wert: 'kaufen', name: 'Kaufen' }]} wert={filter.transaktion}
                onChange={(t) => setze({ transaktion: t, preisMin: '', preisMax: '', wbs: 'egal' })} />
              <Umschalter werte={[{ wert: 'wohnung', name: 'Wohnung' }, { wert: 'haus', name: 'Haus' }]} wert={filter.immobilientyp}
                onChange={(t) => setze({ immobilientyp: t, objektarten: [], etageMin: '', etageMax: '' })} />
            </div>
            <div className="flex flex-1 gap-2 items-center bg-white border border-zinc-200 rounded-lg px-2 h-[48px] shadow-sm">
              <Ortssuche ort={filter.ort} onChange={(o) => setze({ ort: o, bezirke: [] })} />
              <select value={filter.umkreisKm} onChange={(e) => setze({ umkreisKm: parseInt(e.target.value) })} disabled={!filter.ort || filter.bezirke.length > 0}
                title={filter.bezirke.length > 0 ? 'Bei gewählten Bezirken wird genau in deren Grenzen gesucht' : undefined}
                className="h-[38px] border border-zinc-200 rounded-md px-2 text-xs font-bold bg-white disabled:text-zinc-300">
                {UMKREISE_KM.map(km => <option key={km} value={km}>{km === 0 ? 'Nur Ort' : `+ ${km} km`}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={zuruecksetzen} title="Filter zurücksetzen" className="flex-none w-[48px] h-[48px] border border-zinc-200 bg-white text-zinc-500 rounded-lg shadow-sm hover:border-black hover:text-black transition-all flex items-center justify-center group cursor-pointer">
                <svg className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
              <button onClick={() => suchen()} className="flex-1 lg:w-[180px] h-[48px] bg-black text-white font-extrabold text-sm rounded-lg uppercase tracking-[0.2em] shadow-lg hover:bg-zinc-800 hover:-translate-y-0.5 transition-all duration-300">
                Suchen
              </button>
            </div>
          </div>

          {/* Zeile 2: Detailfilter */}
          <div className="flex gap-2 flex-wrap items-center">
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
          </div>

          {/* Aufklappbereiche */}
          {panel && (
            <div className="absolute top-full left-0 w-full md:w-auto md:min-w-[420px] max-w-full mt-2 p-4 border border-zinc-200 rounded-lg shadow-xl bg-white z-50 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              {panel === 'bezirke' && filter.ort && (
                <Bezirksauswahl ort={filter.ort} ausgewaehlt={filter.bezirke} onChange={(b) => setze({ bezirke: b })} />
              )}
              {panel === 'preis' && (
                <>
                  {istMiete && erweitert && (
                    <div className="flex gap-2">
                      <Chip aktiv={filter.preisArt === 'kalt'} onClick={() => setze({ preisArt: 'kalt' })}>Kaltmiete</Chip>
                      <Chip aktiv={filter.preisArt === 'warm'} onClick={() => setze({ preisArt: 'warm' })}>Warmmiete</Chip>
                    </div>
                  )}
                  <VonBis min={filter.preisMin} max={filter.preisMax} onMin={(v) => setze({ preisMin: v })} onMax={(v) => setze({ preisMax: v })} einheit="€" />
                </>
              )}
              {panel === 'zimmer' && (
                <>
                  <div className="flex gap-1.5 flex-wrap">
                    {['1', '2', '3', '4', '5'].map(z => (
                      <Chip key={z} aktiv={filter.zimmerMin === z && !filter.zimmerMax} onClick={() => setze({ zimmerMin: z, zimmerMax: '' })}>ab {z}</Chip>
                    ))}
                  </div>
                  <VonBis min={filter.zimmerMin} max={filter.zimmerMax} onMin={(v) => setze({ zimmerMin: v })} onMax={(v) => setze({ zimmerMax: v })} />
                </>
              )}
              {panel === 'flaeche' && (
                <VonBis min={filter.flaecheMin} max={filter.flaecheMax} onMin={(v) => setze({ flaecheMin: v })} onMax={(v) => setze({ flaecheMax: v })} einheit="m²" />
              )}
              {panel === 'linien' && (
                <Linienauswahl ausschnitt={ausschnitt} ausgewaehlt={filter.linien} onChange={(l) => setze({ linien: l })}
                  umkreis={filter.linienUmkreisM} onUmkreis={(v) => setze({ linienUmkreisM: v })} />
              )}
              {panel === 'weitere' && (
                erweitert ? (
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
                        <VonBis min={filter.baujahrMin} max={filter.baujahrMax} onMin={(v) => setze({ baujahrMin: v })} onMax={(v) => setze({ baujahrMax: v })} />
                      </Abschnitt>
                      {filter.immobilientyp === 'wohnung' && (
                        <Abschnitt titel="Etage (0 = Erdgeschoss)">
                          <VonBis min={filter.etageMin} max={filter.etageMax} onMin={(v) => setze({ etageMin: v })} onMax={(v) => setze({ etageMax: v })} />
                        </Abschnitt>
                      )}
                      <Abschnitt titel="Bezugsfrei bis">
                        <input type="date" value={filter.bezugsfreiBis} onChange={(e) => setze({ bezugsfreiBis: e.target.value })}
                          className="w-full h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs font-medium focus:ring-1 focus:ring-black outline-none" />
                      </Abschnitt>
                      <Abschnitt titel="Energieeffizienz mindestens">
                        <select value={filter.energieMindestens} onChange={(e) => setze({ energieMindestens: e.target.value })}
                          className="w-full h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs font-medium">
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
                ) : (
                  <p className="text-xs text-zinc-500 max-w-sm">Diese Filter (Objektart, Ausstattung, Baujahr, Etage, Verfügbarkeit, Energieeffizienz, WBS) werden aktiv, sobald die zusätzlichen Felder in der Datenbank angelegt sind.</p>
                )
              )}
              <div className="flex justify-end">
                <button onClick={() => suchen()} className="h-[38px] px-5 bg-black text-white font-bold text-xs rounded-md uppercase tracking-widest hover:bg-zinc-800">Ergebnisse anzeigen</button>
              </div>
            </div>
          )}
        </div>

        {/* --- ERGEBNISKOPF --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mt-1">
          <p className="text-sm text-zinc-700">
            {laedt ? 'Suche läuft…' : fehler ? 'Die Suche ist fehlgeschlagen. Bitte versuche es noch einmal.' : (
              <><strong className="text-black">{ergebnis.anzeigen.length}</strong> {typName} {transaktionName}{angewendet.ort ? (angewendet.bezirke.length ? ` in ${angewendet.bezirke.map(b => b.name).join(', ')} (${angewendet.ort.kurzname ?? angewendet.ort.name})` : ` in ${angewendet.ort.name}${angewendet.umkreisKm ? ` + ${angewendet.umkreisKm} km` : ''}`) : ''}{angewendet.linien.length ? ` nahe ${angewendet.linien.map(l => l.nummer).join(', ')}` : ''}</>
            )}
          </p>
          <select value={angewendet.sortierung} onChange={(e) => { setze({ sortierung: e.target.value }); suchen({ ...angewendet, sortierung: e.target.value }); }}
            className="h-[36px] border border-zinc-200 rounded-md px-2 text-xs font-bold bg-white self-start md:self-auto">
            {sortierungen.map(s => <option key={s.wert} value={s.wert}>{s.name}</option>)}
          </select>
        </div>

        {/* --- MAP --- */}
        <section id="karte" className="w-full h-[550px] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-200 relative bg-white z-0">
          <Map anzeigen={ergebnis.anzeigen} haltestellen={ergebnis.haltestellen} naechste={ergebnis.naechste}
            linienUmkreisM={linienUmkreisM(angewendet.linienUmkreisM)} ortKreis={ortKreis} bezirke={angewendet.bezirke} fokus={fokus}
            onAusschnittChange={setAusschnitt} />
        </section>

        {/* --- ERGEBNISLISTE --- */}
        <Ergebnisliste anzeigen={ergebnis.anzeigen} naechste={ergebnis.naechste}
          onZeigen={(id) => { setFokus(f => ({ id, nr: (f?.nr ?? 0) + 1 })); document.getElementById('karte')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
      </div>
    </div>
  );
}
