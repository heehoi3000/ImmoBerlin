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

// Kleine Illustration: eine Linie mit Haltestellen und Preis-Pins
function Linienbild() {
  return (
    <svg viewBox="0 0 420 320" className="w-full h-auto" aria-hidden="true">
      <defs>
        <pattern id="raster" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0v28" fill="none" stroke="#e7e5e4" strokeWidth="1" /></pattern>
      </defs>
      <rect width="420" height="320" rx="28" fill="#fafaf9" />
      <rect width="420" height="320" rx="28" fill="url(#raster)" />
      <path d="M-10 250 C 80 250, 110 120, 200 140 S 330 60, 430 70" fill="none" stroke="#2563eb" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
      <path d="M40 -10 C 60 90, 180 200, 260 210 S 380 260, 400 330" fill="none" stroke="#f59e0b" strokeWidth="10" strokeLinecap="round" opacity="0.85" />
      {[[70, 236], [200, 140], [318, 84], [214, 198]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="60" fill="#2563eb" opacity="0.06" />
          <circle cx={x} cy={y} r="9" fill="#fff" stroke="#111" strokeWidth="3.5" />
        </g>
      ))}
      {[[118, 196, '890 €'], [250, 108, '1.240 €'], [282, 238, '760 €'], [352, 128, '1.050 €']].map(([x, y, t], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <rect x="-34" y="-15" width="68" height="30" rx="15" fill={i === 1 ? '#111' : '#fff'} stroke="#e7e5e4" />
          <text textAnchor="middle" y="5" fontSize="13" fontWeight="700" fill={i === 1 ? '#fff' : '#111'} fontFamily="inherit">{t}</text>
        </g>
      ))}
      <g transform="translate(24 24)">
        <rect width="92" height="30" rx="15" fill="#2563eb" /><text x="46" y="20" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="inherit">U8 · 600 m</text>
      </g>
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
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 md:py-20 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">
          <div className="flex flex-col gap-6">
            <span className="self-start px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">Kostenlos · deutschlandweit</span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Wohnen an <span className="text-blue-600">deiner Linie.</span>
            </h1>
            <p className="text-lg text-zinc-600 max-w-xl">
              Wähle deine Bahn-, Tram- oder Buslinie und wie weit die Haltestelle höchstens entfernt sein darf. IMMOBIL zeigt dir nur Wohnungen und Häuser, die dazu passen.
            </p>
            <div className="bg-white border border-zinc-200 rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-2 flex flex-col sm:flex-row gap-2">
              <div className="flex shrink-0 bg-zinc-100 rounded-full p-1 h-12 self-start sm:self-auto">
                {(['mieten', 'kaufen'] as const).map(t => (
                  <button key={t} onClick={() => setTransaktion(t)} className={`px-4 rounded-full text-sm font-semibold transition ${transaktion === t ? 'bg-white shadow-sm' : 'text-zinc-500 hover:text-black'}`}>
                    {t === 'mieten' ? 'Mieten' : 'Kaufen'}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-w-0 flex items-center pl-2 [&_input]:border-0 [&_input]:focus:ring-0 [&_input]:h-12 [&_input]:text-base [&_input]:bg-transparent">
                <Ortssuche ort={ort} onChange={setOrt} />
              </div>
              <button onClick={() => suchen({ transaktion, ort })} className="h-12 px-7 rounded-full bg-zinc-900 text-white font-semibold hover:bg-black transition">Suchen</button>
            </div>
            <p className="text-sm text-zinc-500">
              {anzahl !== null ? <><strong className="text-zinc-900">{anzahl.toLocaleString('de-DE')}</strong> Angebote · </> : null}
              über 21.000 Linien und 380.000 Haltestellen in ganz Deutschland
            </p>
          </div>
          <div className="hidden md:block"><Linienbild /></div>
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
