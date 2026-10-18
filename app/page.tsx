"use client";
// Startseite: Einstieg in die Suche, neueste Angebote, Städte und geplante Bereiche.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Ortssuche from './Ortssuche';
import { AnzeigeKachel } from './Ergebnisliste';
import { supabase } from '../lib/supabase';
import { Filter, Ort } from '../lib/filter';
import { Anzeige } from '../lib/suche';

const STAEDTE: (Ort & { bild: string })[] = [
  { name: 'Berlin', kurzname: 'Berlin', lat: 52.517, lon: 13.389, osmRelation: 62422, ausdehnung: [13.088, 52.338, 13.761, 52.675], bild: 'from-amber-100 to-orange-200' },
  { name: 'Hamburg', kurzname: 'Hamburg', lat: 53.55, lon: 10.0, osmRelation: 62782, ausdehnung: [9.73, 53.395, 10.325, 53.74], bild: 'from-sky-100 to-blue-200' },
  { name: 'München', kurzname: 'München', lat: 48.137, lon: 11.575, osmRelation: 62428, ausdehnung: [11.36, 48.061, 11.723, 48.248], bild: 'from-emerald-100 to-teal-200' },
  { name: 'Köln', kurzname: 'Köln', lat: 50.938, lon: 6.96, osmRelation: 62578, ausdehnung: [6.772, 50.83, 7.162, 51.085], bild: 'from-rose-100 to-pink-200' },
  { name: 'Frankfurt am Main', kurzname: 'Frankfurt', lat: 50.11, lon: 8.68, osmRelation: 62400, ausdehnung: [8.472, 50.015, 8.8, 50.227], bild: 'from-violet-100 to-indigo-200' },
  { name: 'Leipzig', kurzname: 'Leipzig', lat: 51.34, lon: 12.375, osmRelation: 62649, ausdehnung: [12.237, 51.238, 12.543, 51.448], bild: 'from-lime-100 to-green-200' },
];

const BALD = [
  { titel: 'Studierende und Wohnheime', text: 'Hochschule wählen, die Linien dorthin sind vorausgewählt. Wohnheime zeigen freie Plätze, WG-Zimmer und Zwischenmiete inklusive.', symbol: 'M12 3 2 8l10 5 10-5-10-5zM6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5' },
  { titel: 'Wohnungstausch', text: '2 Zimmer an der U8 gegen 3 Zimmer an der S41: Wir finden passende Tauschpartner entlang deiner Linien.', symbol: 'M7 7h13l-4-4M17 17H4l4 4' },
  { titel: 'Takt, Nachtverkehr, Barrierefreiheit', text: 'Filtere nach Linien, die nachts fahren, dichtem Takt oder barrierefreien Haltestellen.', symbol: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' },
];

// Hintergrund des Einstiegs: zarte Linienverläufe mit Haltestellen über die ganze Breite
function Linienhintergrund() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1440 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M-40 430 C 260 420, 360 250, 620 270 S 1000 120, 1480 150" fill="none" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" opacity="0.14" />
      <path d="M-40 140 C 220 160, 330 330, 560 380 S 1100 470, 1480 380" fill="none" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" opacity="0.16" />
      <path d="M180 -20 C 240 200, 120 360, 260 600" fill="none" stroke="#10b981" strokeWidth="6" strokeLinecap="round" opacity="0.12" />
      <path d="M1250 -20 C 1180 180, 1330 340, 1220 600" fill="none" stroke="#e11d48" strokeWidth="6" strokeLinecap="round" opacity="0.1" />
      {[[620, 270, '#2563eb'], [1000, 175, '#2563eb'], [560, 380, '#f59e0b'], [1080, 455, '#f59e0b'], [215, 300, '#10b981'], [1262, 260, '#e11d48']].map(([x, y, f], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill="#fff" stroke={f as string} strokeWidth="3.5" opacity="0.5" />
      ))}
    </svg>
  );
}

function Symbol({ d }: { d: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default function Startseite() {
  const router = useRouter();
  const [transaktion, setTransaktion] = useState<Filter['transaktion']>('mieten');
  const [ort, setOrt] = useState<Ort | null>(null);
  const [neueste, setNeueste] = useState<Anzeige[] | null>(null);
  const [anzahl, setAnzahl] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('anzeigen').select('*').order('erstellt_am', { ascending: false }).limit(4)
      .then(({ data }) => setNeueste((data as Anzeige[]) ?? []));
    supabase.from('anzeigen').select('id', { count: 'exact', head: true }).then(({ count }) => setAnzahl(count ?? null));
  }, []);

  function suchen(teil: Partial<Filter>) {
    try { sessionStorage.setItem('startsuche', JSON.stringify(teil)); } catch { /* Speicher gesperrt */ }
    router.push('/suche/');
  }

  return (
    <div className="w-full flex flex-col">

      {/* --- EINSTIEG --- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-zinc-50 border-b border-zinc-200">
        <Linienhintergrund />
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-14 md:pt-28 md:pb-24 flex flex-col items-center text-center gap-6">
          <span className="px-3 py-1 rounded-full bg-white/80 border border-zinc-200 text-zinc-600 text-xs font-semibold backdrop-blur">Kostenlos · deutschlandweit · für Bahn, Tram und Bus</span>
          <h1 className="text-[2.6rem] leading-[1.05] md:text-7xl font-bold tracking-tight">
            Wohnen an<br className="sm:hidden" /> deiner Linie.
          </h1>
          <p className="text-base md:text-xl text-zinc-600 max-w-2xl">
            Wähle Bahn, Tram oder Bus und wie nah die Haltestelle sein soll. Du siehst nur Wohnungen und Häuser, die dazu passen.
          </p>

          <div className="w-full max-w-3xl mt-2 bg-white border border-zinc-200 rounded-[28px] shadow-[0_12px_40px_rgba(0,0,0,0.10)] p-2 flex flex-col sm:flex-row sm:items-center gap-2 text-left">
            <div className="flex shrink-0 bg-zinc-100 rounded-full p-1 h-12 self-stretch sm:self-auto">
              {(['mieten', 'kaufen'] as const).map(t => (
                <button key={t} onClick={() => setTransaktion(t)} className={`flex-1 sm:flex-none px-5 rounded-full text-sm font-semibold transition ${transaktion === t ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-black'}`}>
                  {t === 'mieten' ? 'Mieten' : 'Kaufen'}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 pl-3 sm:border-l sm:border-zinc-200 [&_input]:border-0 [&_input]:focus:ring-0 [&_input]:h-12 [&_input]:text-base [&_input]:bg-transparent">
              <svg className="w-5 h-5 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
              <div className="flex-1 min-w-0"><Ortssuche ort={ort} onChange={setOrt} /></div>
            </div>
            <button onClick={() => suchen({ transaktion, ort })} className="h-12 px-8 rounded-full bg-zinc-900 text-white font-semibold hover:bg-black transition flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              Suchen
            </button>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-2 text-sm">
            <span className="text-zinc-500">Beliebt:</span>
            {STAEDTE.slice(0, 4).map(stadt => (
              <button key={stadt.name} onClick={() => suchen({ transaktion, ort: stadt })}
                className="px-3 py-1.5 rounded-full bg-white border border-zinc-200 font-medium text-zinc-700 hover:border-zinc-900 hover:text-black transition">{stadt.kurzname}</button>
            ))}
          </div>

          <dl className="grid grid-cols-3 gap-6 md:gap-16 mt-6 md:mt-10">
            {[
              [anzahl !== null ? anzahl.toLocaleString('de-DE') : '…', 'Angebote'],
              ['21.800', 'ÖPNV-Linien'],
              ['382.000', 'Haltestellen'],
            ].map(([w, n]) => (
              <div key={n} className="flex flex-col items-center">
                <dt className="order-2 text-xs md:text-sm text-zinc-500">{n}</dt>
                <dd className="order-1 text-xl md:text-3xl font-bold tracking-tight">{w}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- SO FUNKTIONIERT'S --- */}
      <section className="max-w-7xl w-full mx-auto px-4 lg:px-8 py-14 md:py-20">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8">So funktioniert&apos;s</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ['1', 'Ort wählen', 'Stadt, Postleitzahl oder einzelne Bezirke, auf Wunsch mit Umkreis.'],
            ['2', 'Linien wählen', 'Eine oder mehrere Linien, z. B. U8 und S41, und den maximalen Abstand zur Haltestelle.'],
            ['3', 'Passend wohnen', 'Du siehst nur Angebote nahe deinen Linien, mit Entfernung zur nächsten Haltestelle.'],
          ].map(([nr, t, x]) => (
            <div key={nr} className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col gap-3">
              <span className="w-9 h-9 rounded-full bg-zinc-900 text-white text-sm font-bold flex items-center justify-center">{nr}</span>
              <h3 className="font-semibold text-lg">{t}</h3>
              <p className="text-sm text-zinc-600 leading-relaxed">{x}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --- NEUESTE ANGEBOTE --- */}
      <section className="max-w-7xl w-full mx-auto px-4 lg:px-8 pb-14 md:pb-20">
        <div className="flex items-end justify-between gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Neueste Angebote</h2>
          <Link href="/suche/" className="text-sm font-semibold hover:underline underline-offset-4 shrink-0">Alle ansehen →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-8">
          {neueste === null
            ? Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-[4/3] rounded-2xl bg-zinc-200/70 animate-pulse" />)
            : neueste.map(a => <AnzeigeKachel key={a.id} a={a} />)}
        </div>
      </section>

      {/* --- STÄDTE --- */}
      <section className="max-w-7xl w-full mx-auto px-4 lg:px-8 pb-14 md:pb-20">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">Beliebte Städte</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAEDTE.map(({ bild, ...stadt }) => (
            <button key={stadt.name} onClick={() => suchen({ ort: stadt })}
              className={`group h-28 rounded-2xl bg-gradient-to-br ${bild} p-4 flex flex-col justify-end text-left hover:shadow-lg hover:-translate-y-0.5 transition`}>
              <span className="font-bold text-lg leading-tight">{stadt.kurzname}</span>
              <span className="text-xs text-zinc-700 group-hover:underline underline-offset-2">Angebote ansehen</span>
            </button>
          ))}
        </div>
      </section>

      {/* --- BALD VERFÜGBAR --- */}
      <section className="bg-white border-y border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-14 md:py-20">
          <div className="flex flex-col gap-2 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Bald bei IMMOBIL</h2>
            <p className="text-zinc-600">Daran arbeiten wir gerade. Alles bleibt bei dem, was IMMOBIL ausmacht: der Suche entlang deiner Linien.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {BALD.map(b => (
              <div key={b.titel} className="rounded-2xl border border-zinc-200 p-6 flex flex-col gap-3 bg-zinc-50/60">
                <div className="flex items-center justify-between">
                  <span className="w-11 h-11 rounded-xl bg-white border border-zinc-200 flex items-center justify-center"><Symbol d={b.symbol} /></span>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">Bald verfügbar</span>
                </div>
                <h3 className="font-semibold text-lg">{b.titel}</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FÜR ANBIETER --- */}
      <section className="max-w-7xl w-full mx-auto px-4 lg:px-8 py-14 md:py-20">
        <div className="rounded-3xl bg-zinc-900 text-white p-8 md:p-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col gap-2 max-w-xl">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Du vermietest oder verkaufst?</h2>
            <p className="text-zinc-300">Inseriere kostenlos und erreiche Menschen, die genau an deiner Linie wohnen wollen. Mit Fotos, Energieausweis und Anfragen direkt in dein Postfach.</p>
          </div>
          <Link href="/inserieren/" className="shrink-0 h-12 px-7 rounded-full bg-white text-black font-semibold flex items-center justify-center hover:bg-zinc-100 transition">Kostenlos inserieren</Link>
        </div>
      </section>
    </div>
  );
}
