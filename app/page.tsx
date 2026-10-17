"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';
import { Linie, Kartenausschnitt, LINIENTYPEN, MAX_AUSSCHNITT_BREITE } from '../lib/oepnv';

const Map = dynamic(() => import("./Map"), { 
  ssr: false,
  loading: () => <div className="p-6 text-zinc-500 font-bold tracking-widest uppercase flex h-full w-full items-center justify-center bg-white">Karte lädt...</div>
});

const VERFUEGBARE_BEZIRKE = [
  'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf', 
  'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln', 
  'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf'
];

export default function Home() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  const [transactionType, setTransactionType] = useState('mieten');
  const [propertyType, setPropertyType] = useState('wohnung');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [roomsMin, setRoomsMin] = useState('');
  const [roomsMax, setRoomsMax] = useState('');
  const [spaceMin, setSpaceMin] = useState('');
  const [spaceMax, setSpaceMax] = useState('');
  const [routeSearchTerm, setRouteSearchTerm] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<Linie[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [routeRadius, setRouteRadius] = useState('1500');

  // Linien, die im aktuellen Kartenausschnitt halten
  const [ausschnitt, setAusschnitt] = useState<Kartenausschnitt | null>(null);
  const [linienImAusschnitt, setLinienImAusschnitt] = useState<Linie[]>([]);
  const [ladeStatus, setLadeStatus] = useState<'bereit' | 'laedt' | 'fehler'>('bereit');
  const linienAnfrage = useRef(0);

  const [appliedFilters, setAppliedFilters] = useState({
    transactionType: 'mieten', propertyType: 'wohnung',
    priceMin: '', priceMax: '', roomsMin: '', roomsMax: '', spaceMin: '', spaceMax: '',
    selectedRoutes: [] as Linie[], selectedDistricts: [] as string[], routeRadius: '1500'
  });

  const ausschnittZuGross = !!ausschnitt && ausschnitt.maxLon - ausschnitt.minLon > MAX_AUSSCHNITT_BREITE;
  const linienStatus = ausschnittZuGross ? 'zu_gross' : ladeStatus;

  useEffect(() => {
    if (!isLocationOpen || !ausschnitt || ausschnittZuGross) return;
    const anfrage = ++linienAnfrage.current;
    // kurz warten, damit beim Verschieben der Karte nicht jede Bewegung eine Anfrage auslöst
    const timer = setTimeout(async () => {
      setLadeStatus('laedt');
      const { data, error } = await supabase
        .rpc('linien_im_ausschnitt', {
          min_lon: ausschnitt.minLon, min_lat: ausschnitt.minLat,
          max_lon: ausschnitt.maxLon, max_lat: ausschnitt.maxLat,
        })
        .select('linie_id, typ, nummer, betreiber, endpunkte');
      if (anfrage !== linienAnfrage.current) return;
      if (error) {
        console.error("Fehler beim Laden der Linien:", error);
        setLadeStatus('fehler');
        return;
      }
      const linien = (data as Linie[]) || [];
      const typen = Object.keys(LINIENTYPEN);
      linien.sort((a, b) =>
        (typen.indexOf(a.typ) - typen.indexOf(b.typ)) ||
        a.nummer.localeCompare(b.nummer, undefined, { numeric: true, sensitivity: 'base' }) ||
        a.betreiber.localeCompare(b.betreiber));
      setLinienImAusschnitt(linien);
      setLadeStatus('bereit');
    }, 400);
    return () => clearTimeout(timer);
  }, [isLocationOpen, ausschnitt, ausschnittZuGross]);

  const resetFilters = () => {
    setTransactionType('mieten'); setPropertyType('wohnung');
    setPriceMin(''); setPriceMax(''); setRoomsMin(''); setRoomsMax('');
    setSpaceMin(''); setSpaceMax(''); setRouteSearchTerm('');
    setSelectedRoutes([]); setSelectedDistricts([]); setRouteRadius('1500');
    setAppliedFilters({
      transactionType: 'mieten', propertyType: 'wohnung',
      priceMin: '', priceMax: '', roomsMin: '', roomsMax: '', spaceMin: '', spaceMax: '', 
      selectedRoutes: [], selectedDistricts: [], routeRadius: '1500'
    });
  };

  const handleSearch = () => {
    setAppliedFilters({
      transactionType, propertyType,
      priceMin, priceMax, roomsMin, roomsMax, spaceMin, spaceMax,
      selectedRoutes, selectedDistricts, routeRadius
    });
    setIsSearchOpen(false);
    setIsLocationOpen(false);
  };

  const suchbegriff = routeSearchTerm.trim().toLowerCase();
  const filteredRoutes = linienImAusschnitt.filter(linie =>
    !selectedRoutes.some(s => s.linie_id === linie.linie_id) &&
    (suchbegriff === '' ||
      linie.nummer.toLowerCase().includes(suchbegriff) ||
      linie.betreiber.toLowerCase().includes(suchbegriff) ||
      linie.endpunkte.toLowerCase().includes(suchbegriff))
  );
  const MAX_LISTE = 150;

  return (
    <div className="flex flex-col min-h-screen w-full bg-white overflow-x-hidden">
      
      {/* --- BANNER BEREICH --- */}
      <div className="relative w-full h-64 md:h-80 bg-zinc-50 flex items-center justify-center overflow-hidden border-b border-zinc-200">
        
        {/* TEXT IN DER MITTE */}
        <div className="relative z-10 text-center max-w-3xl px-4 flex justify-center -mt-8 md:-mt-12">
          <div className="bg-white/90 backdrop-blur-md px-6 py-4 md:px-10 md:py-6 rounded-2xl border border-zinc-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col items-center gap-1.5 md:gap-2 text-center">
            <p className="text-2xl md:text-4xl font-medium tracking-normal text-black uppercase">
              Dein Zuhause
            </p>
            <p className="text-lg md:text-2xl font-normal tracking-normal text-black/70 uppercase">
              Nur einen Bahnhof entfernt
            </p>
          </div>
        </div>
        
        {/* SYMBOLISCHES STRECKENNETZ */}
        <div className="absolute inset-0 z-0 opacity-50 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
            
            {/* 1. Rote Strecke - Verläuft nach dem Umsteigebahnhof (750, 350) nun waagerecht auf Höhe 350 weiter */}
            <path d="M -50 250 L 300 250 L 500 250 L 750 350 L 1050 350" stroke="#E53935" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            
            {/* 2. Blaue Strecke */}
            <path d="M 300 50 L 300 550" stroke="#1E88E5" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* 3. Grüne Strecke */}
            <path d="M 750 -50 L 750 350 L 900 500 L 1050 500" stroke="#43A047" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* 4. Lila Strecke */}
            <path d="M -50 300 L 100 300 L 200 400 L 500 400 L 600 500 L 750 500" stroke="#8E24AA" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />

            {/* --- Haltestellen --- */}
            
            {/* Rote Linie - Die rechte Station wurde von cy="250" auf cy="350" verschoben */}
            <circle cx="100" cy="250" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="475" cy="250" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="900" cy="350" r="8" fill="white" stroke="#333" strokeWidth="3" />

            {/* Blaue Linie */}
            <circle cx="300" cy="150" r="8" fill="white" stroke="#333" strokeWidth="3" />

            {/* Grüne Linie */}
            <circle cx="750" cy="210" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="825" cy="425" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="900" cy="500" r="8" fill="white" stroke="#333" strokeWidth="3" />

            {/* Lila Linie */}
            <circle cx="50" cy="300" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="250" cy="400" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="450" cy="400" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="550" cy="450" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="650" cy="500" r="8" fill="white" stroke="#333" strokeWidth="3" />
            <circle cx="750" cy="500" r="8" fill="white" stroke="#333" strokeWidth="3" />

            {/* --- Umsteigebahnhöfe --- */}
            <circle cx="300" cy="250" r="14" fill="white" stroke="#333" strokeWidth="4" />
            <circle cx="750" cy="350" r="14" fill="white" stroke="#333" strokeWidth="4" />
            <circle cx="300" cy="400" r="14" fill="white" stroke="#333" strokeWidth="4" />

            {/* --- Bufferzonen & Häuser --- */}
            
            {/* LINKE SEITE */}
            <circle cx="300" cy="250" r="110" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="8 8" opacity="0.3" />
            <g transform="translate(230, 190) scale(1.5)">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
            </g>
            <g transform="translate(230, 280) scale(1.5)">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
            </g>

            {/* RECHTE SEITE */}
            <circle cx="750" cy="350" r="110" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="8 8" opacity="0.3" />
            <g transform="translate(830, 310) scale(1.5)">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
            </g>
            <g transform="translate(710, 390) scale(1.5)">
              <path d="M3 13h1v7c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2v-7h1a1 1 0 0 0 .707-1.707l-9-9a1.002 1.002 0 0 0-1.414 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.586 7 7V20h-1v-6H10v6H9V9.414l7-7z" fill="#333" />
            </g>
          </svg>
        </div>
      </div>

      {/* --- CONTENT BEREICH --- */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-4">
        
        {/* --- FILTER & BUTTONS IN EINER REIHE --- */}
        <div className="flex flex-col md:flex-row gap-3 items-start w-full relative z-20">
          
          {/* FILTER 1: Wonach suchst du? */}
          <div className="flex-1 w-full relative">
            <button 
              onClick={() => { setIsSearchOpen(!isSearchOpen); setIsLocationOpen(false); }} 
              className="flex justify-between items-center w-full h-[48px] px-4 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-black transition-all cursor-pointer"
            >
              <h3 className="text-sm font-extrabold text-black uppercase tracking-wide">Wonach suchst du?</h3>
              <svg className={`w-4 h-4 text-black transition-transform duration-300 ${isSearchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isSearchOpen && (
              <div className="absolute top-full left-0 w-full mt-2 p-4 border border-zinc-200 rounded-lg shadow-xl bg-white z-50 flex flex-col gap-4">
                <div className="flex gap-2 w-full mt-1">
                  <button onClick={() => setTransactionType('kaufen')} className={`flex-1 h-[36px] flex items-center justify-center rounded-md border text-xs font-bold transition-all ${transactionType === 'kaufen' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Kaufen</button>
                  <button onClick={() => setTransactionType('mieten')} className={`flex-1 h-[36px] flex items-center justify-center rounded-md border text-xs font-bold transition-all ${transactionType === 'mieten' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Mieten</button>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Immobilientyp</h4>
                  <div className="flex gap-2 w-full">
                    <button onClick={() => setPropertyType('haus')} className={`flex-1 h-[36px] flex items-center justify-center rounded-md border text-xs font-bold transition-all ${propertyType === 'haus' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Haus</button>
                    <button onClick={() => setPropertyType('wohnung')} className={`flex-1 h-[36px] flex items-center justify-center rounded-md border text-xs font-bold transition-all ${propertyType === 'wohnung' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Wohnung</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Preis Min/Max</h4>
                    <div className="flex gap-1 w-full">
                      <input type="number" placeholder="Min." value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="flex-1 w-full min-w-0 h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                      <input type="number" placeholder="Max." value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="flex-1 w-full min-w-0 h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Zimmer Min/Max</h4>
                    <div className="flex gap-1 w-full">
                      <input type="number" placeholder="Min." value={roomsMin} onChange={(e) => setRoomsMin(e.target.value)} className="flex-1 w-full min-w-0 h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                      <input type="number" placeholder="Max." value={roomsMax} onChange={(e) => setRoomsMax(e.target.value)} className="flex-1 w-full min-w-0 h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Wohnfläche Min/Max</h4>
                  <div className="flex gap-1 w-full">
                    <input type="number" placeholder="Min." value={spaceMin} onChange={(e) => setSpaceMin(e.target.value)} className="flex-1 w-full min-w-0 h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                    <input type="number" placeholder="Max." value={spaceMax} onChange={(e) => setSpaceMax(e.target.value)} className="flex-1 w-full min-w-0 h-[36px] bg-white border border-zinc-200 rounded-md px-2 text-xs text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FILTER 2: Wo in Berlin? */}
          <div className="flex-1 w-full relative">
            <button 
              onClick={() => { setIsLocationOpen(!isLocationOpen); setIsSearchOpen(false); }} 
              className="flex justify-between items-center w-full h-[48px] px-4 bg-white border border-zinc-200 rounded-lg shadow-sm hover:border-black transition-all cursor-pointer"
            >
              <h3 className="text-sm font-extrabold text-black uppercase tracking-wide">Wo &amp; welche Linien?</h3>
              <svg className={`w-4 h-4 text-black transition-transform duration-300 ${isLocationOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isLocationOpen && (
              <div className="absolute top-full left-0 w-full md:w-[200%] md:-left-[100%] lg:w-full lg:left-0 mt-2 p-4 border border-zinc-200 rounded-lg shadow-xl bg-white z-50 flex flex-col gap-5">
                <div>
                  <h4 className="text-[10px] font-extrabold text-zinc-400 mb-1 uppercase tracking-widest">ÖPNV Linien im Kartenausschnitt</h4>
                  <p className="text-[11px] text-zinc-500 mb-2">Verschiebe oder zoome die Karte, um Linien in anderen Orten zu sehen.</p>
                  <input type="text" placeholder="Filtern (z.B. U2, BVG, Ruhleben)" value={routeSearchTerm} onChange={(e) => setRouteSearchTerm(e.target.value)} className="w-full h-[38px] bg-white border border-zinc-200 rounded-md px-4 text-sm font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                  <div className="mt-1 w-full bg-white border border-zinc-200 rounded-lg max-h-56 overflow-y-auto">
                    {linienStatus === 'zu_gross' && (
                      <p className="px-4 py-3 text-xs text-zinc-500">Der Kartenausschnitt ist zu groß. Zoome näher an einen Ort heran.</p>
                    )}
                    {linienStatus === 'laedt' && linienImAusschnitt.length === 0 && (
                      <p className="px-4 py-3 text-xs text-zinc-500">Linien werden geladen…</p>
                    )}
                    {linienStatus === 'fehler' && (
                      <p className="px-4 py-3 text-xs text-red-600">Die Linien konnten nicht geladen werden.</p>
                    )}
                    {linienStatus === 'bereit' && filteredRoutes.length === 0 && (
                      <p className="px-4 py-3 text-xs text-zinc-500">Keine passenden Linien in diesem Ausschnitt.</p>
                    )}
                    {linienStatus !== 'zu_gross' && filteredRoutes.slice(0, MAX_LISTE).map((linie, i) => (
                      <div key={linie.linie_id}>
                        {(i === 0 || filteredRoutes[i - 1].typ !== linie.typ) && (
                          <div className="sticky top-0 bg-zinc-50 px-4 py-1 text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                            {LINIENTYPEN[linie.typ] || linie.typ}
                          </div>
                        )}
                        <button onClick={() => { setSelectedRoutes([...selectedRoutes, linie]); setRouteSearchTerm(''); }} className="w-full text-left px-4 py-1.5 hover:bg-zinc-100 transition flex items-baseline gap-2">
                          <span className="text-sm font-bold text-zinc-900 shrink-0">{linie.nummer}</span>
                          <span className="text-[11px] text-zinc-500 truncate">{linie.betreiber}{linie.endpunkte ? ` · ${linie.endpunkte}` : ''}</span>
                        </button>
                      </div>
                    ))}
                    {linienStatus !== 'zu_gross' && filteredRoutes.length > MAX_LISTE && (
                      <p className="px-4 py-2 text-[11px] text-zinc-500">{filteredRoutes.length - MAX_LISTE} weitere Linien. Tippe oben, um die Liste einzugrenzen.</p>
                    )}
                  </div>

                  {selectedRoutes.length > 0 && (
                    <div className="flex flex-col gap-3 mt-3">
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRoutes.map(linie => (
                          <button key={linie.linie_id} title={`${linie.betreiber}${linie.endpunkte ? ` · ${linie.endpunkte}` : ''}`} onClick={() => setSelectedRoutes(selectedRoutes.filter(r => r.linie_id !== linie.linie_id))} className="px-2.5 py-1 rounded-md bg-black text-white text-xs font-bold flex items-center gap-1.5 max-w-full">
                            <span>{linie.nummer}</span>
                            <span className="font-normal text-white/70 truncate max-w-[140px]">{linie.betreiber}</span>
                            <span>×</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-md border border-zinc-100">
                        <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest flex-1">Max. Entfernung zur Haltestelle (m):</span>
                        <input type="number" min={50} max={5000} step={50} value={routeRadius} onChange={(e) => setRouteRadius(e.target.value)} className="w-20 bg-white border border-zinc-200 rounded-md py-1 px-2 text-xs text-center font-bold outline-none focus:ring-1 focus:ring-black" />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-[10px] font-extrabold text-zinc-400 mb-2 uppercase tracking-widest">Bezirk (nur Berlin)</h4>
                  <div className="flex flex-wrap gap-1">
                    {VERFUEGBARE_BEZIRKE.map((bezirk) => (
                      <button key={bezirk} onClick={() => setSelectedDistricts(prev => prev.includes(bezirk) ? prev.filter(b => b !== bezirk) : [...prev, bezirk])} className={`px-2 py-1.5 rounded-md border text-[11px] font-bold transition-all ${selectedDistricts.includes(bezirk) ? 'border-black bg-black text-white shadow-sm' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>
                        {bezirk}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AKTIONEN */}
          <div className="flex gap-2 w-full md:w-auto mt-0">
             <button onClick={resetFilters} title="Filter zurücksetzen" className="flex-none w-[48px] h-[48px] border border-zinc-200 bg-white text-zinc-500 rounded-lg shadow-sm hover:border-black hover:text-black transition-all flex items-center justify-center group cursor-pointer">
                <svg className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
             </button>
             <button onClick={handleSearch} className="flex-1 md:w-[150px] lg:w-[180px] h-[48px] bg-black text-white font-extrabold text-sm rounded-lg uppercase tracking-[0.2em] shadow-lg hover:bg-zinc-800 hover:-translate-y-0.5 transition-all duration-300">
                Suchen
             </button>
          </div>
        </div>

        {/* --- MAP --- */}
        <section className="w-full h-[550px] mt-2 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-200 relative bg-white z-0">
          <Map filters={appliedFilters} onAusschnittChange={setAusschnitt} />
        </section>

      </div>
    </div>
  );
}