"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabase';

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
  // HIER GEÄNDERT: Beide Startwerte sind jetzt 'false' (geschlossen)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  // Lokales Gedächtnis der Filter
  const [transactionType, setTransactionType] = useState('mieten');
  const [propertyType, setPropertyType] = useState('wohnung');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [roomsMin, setRoomsMin] = useState('');
  const [roomsMax, setRoomsMax] = useState('');
  const [spaceMin, setSpaceMin] = useState('');
  const [spaceMax, setSpaceMax] = useState('');
  const [routeSearchTerm, setRouteSearchTerm] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [routeRadius, setRouteRadius] = useState('1500');

  // Datenbank Strecken
  const [databaseRoutes, setDatabaseRoutes] = useState<string[]>([]);

  // Das Paket, das wir an die Karte schicken
  const [appliedFilters, setAppliedFilters] = useState({
    transactionType: 'mieten', propertyType: 'wohnung',
    priceMin: '', priceMax: '', roomsMin: '', roomsMax: '', spaceMin: '', spaceMax: '',
    selectedRoutes: [] as string[], selectedDistricts: [] as string[], routeRadius: '1500'
  });

  useEffect(() => {
    async function loadRoutesFromDB() {
      try {
        const { data, error } = await supabase
          .from('routes')
          .select('route_short_name');

        if (error) throw error;

        if (data) {
          const uniqueRoutes = Array.from(new Set(data.map(r => r.route_short_name).filter(Boolean)));
          uniqueRoutes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
          setDatabaseRoutes(uniqueRoutes);
        }
      } catch (err) {
        console.error("Fehler beim Laden der Strecken:", err);
      }
    }
    loadRoutesFromDB();
  }, []);

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
    // Dropdowns schließen sich beim Suchen
    setIsSearchOpen(false);
    setIsLocationOpen(false);
  };

  const filteredRoutes = databaseRoutes.filter(route => 
    route.toLowerCase().includes(routeSearchTerm.toLowerCase()) && 
    !selectedRoutes.includes(route) 
  );

  return (
    <div className="flex flex-1 w-full overflow-hidden bg-white">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-[30%] min-w-[360px] bg-white p-6 flex flex-col gap-5 overflow-y-auto shadow-[8px_0_30px_rgba(0,0,0,0.05)] z-10">
        
        {/* SUCHEINSTELLUNGEN */}
        <div className="flex flex-col border border-zinc-200 rounded-lg overflow-hidden shadow-sm bg-white transition-all">
          <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="flex justify-between items-center w-full p-4 bg-white hover:bg-zinc-50 transition cursor-pointer">
            <h3 className="text-base font-extrabold text-black uppercase tracking-wide">Wonach suchst du?</h3>
            <svg className={`w-5 h-5 text-black transition-transform duration-300 ${isSearchOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {isSearchOpen && (
            <div className="p-4 pt-0 border-t border-zinc-100 flex flex-col gap-4 bg-white">
              
              <div className="flex gap-2 w-full mt-2">
                <button onClick={() => setTransactionType('kaufen')} className={`flex-1 w-full h-[38px] flex items-center justify-center rounded-md border text-sm font-medium transition-all ${transactionType === 'kaufen' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Kaufen</button>
                <button onClick={() => setTransactionType('mieten')} className={`flex-1 w-full h-[38px] flex items-center justify-center rounded-md border text-sm font-medium transition-all ${transactionType === 'mieten' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Mieten</button>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Immobilientyp</h4>
                <div className="flex gap-2 w-full">
                  <button onClick={() => setPropertyType('haus')} className={`flex-1 w-full h-[38px] flex items-center justify-center rounded-md border text-sm font-medium transition-all ${propertyType === 'haus' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Haus</button>
                  <button onClick={() => setPropertyType('wohnung')} className={`flex-1 w-full h-[38px] flex items-center justify-center rounded-md border text-sm font-medium transition-all ${propertyType === 'wohnung' ? 'border-black bg-black text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>Wohnung</button>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Preis</h4>
                <div className="flex gap-2 w-full">
                  <input type="number" placeholder="Min." value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="flex-1 w-full min-w-0 h-[38px] bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                  <input type="number" placeholder="Max." value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="flex-1 w-full min-w-0 h-[38px] bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Zimmer</h4>
                <div className="flex gap-2 w-full">
                  <input type="number" placeholder="Min." value={roomsMin} onChange={(e) => setRoomsMin(e.target.value)} className="flex-1 w-full min-w-0 h-[38px] bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                  <input type="number" placeholder="Max." value={roomsMax} onChange={(e) => setRoomsMax(e.target.value)} className="flex-1 w-full min-w-0 h-[38px] bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-widest">Wohnfläche</h4>
                <div className="flex gap-2 w-full">
                  <input type="number" placeholder="Min." value={spaceMin} onChange={(e) => setSpaceMin(e.target.value)} className="flex-1 w-full min-w-0 h-[38px] bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                  <input type="number" placeholder="Max." value={spaceMax} onChange={(e) => setSpaceMax(e.target.value)} className="flex-1 w-full min-w-0 h-[38px] bg-white border border-zinc-200 rounded-md px-2 text-sm text-center font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* REGION & ÖPNV */}
        <div className="flex flex-col border border-zinc-200 rounded-lg overflow-hidden shadow-sm bg-white transition-all">
          <button onClick={() => setIsLocationOpen(!isLocationOpen)} className="flex justify-between items-center w-full p-4 bg-white hover:bg-zinc-50 transition cursor-pointer">
            <h3 className="text-base font-extrabold text-black uppercase tracking-wide">Wo in Berlin?</h3>
            <svg className={`w-5 h-5 text-black transition-transform duration-300 ${isLocationOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {isLocationOpen && (
            <div className="p-4 pt-0 border-t border-zinc-100 flex flex-col gap-6 bg-white">
              <div>
                <h4 className="text-[10px] font-extrabold text-zinc-400 mb-2 uppercase tracking-widest">ÖPNV Strecken</h4>
                <div className="relative">
                  <input type="text" placeholder="Suchen (z.B. S3, U5, M41)" value={routeSearchTerm} onChange={(e) => setRouteSearchTerm(e.target.value)} className="w-full h-[38px] bg-white border border-zinc-200 rounded-md px-4 text-sm font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400" />
                  {routeSearchTerm.length > 0 && filteredRoutes.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                      {filteredRoutes.map(route => (
                        <button key={route} onClick={() => { if (!selectedRoutes.includes(route)) setSelectedRoutes([...selectedRoutes, route]); setRouteSearchTerm(''); }} className="w-full text-left px-4 py-2 hover:bg-zinc-100 text-sm font-semibold text-zinc-800 transition">
                          {route}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedRoutes.length > 0 && (
                  <div className="flex flex-col gap-3 mt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRoutes.map(route => (
                        <button key={route} onClick={() => setSelectedRoutes(selectedRoutes.filter(r => r !== route))} className="px-2.5 py-1 rounded-md bg-black text-white text-xs font-bold flex items-center gap-1.5">
                          {route} <span>×</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-md border border-zinc-100">
                      <span className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest flex-1">Max. Entfernung (m):</span>
                      <input type="number" value={routeRadius} onChange={(e) => setRouteRadius(e.target.value)} className="w-20 bg-white border border-zinc-200 rounded-md py-1 px-2 text-xs text-center font-bold outline-none focus:ring-1 focus:ring-black" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[10px] font-extrabold text-zinc-400 mb-2 uppercase tracking-widest">Bezirk</h4>
                <div className="flex flex-wrap gap-1">
                  {VERFUEGBARE_BEZIRKE.map((bezirk) => (
                    <button key={bezirk} onClick={() => setSelectedDistricts(prev => prev.includes(bezirk) ? prev.filter(b => b !== bezirk) : [...prev, bezirk])} className={`px-1.5 py-1 rounded-md border text-[11px] font-bold transition-all ${selectedDistricts.includes(bezirk) ? 'border-black bg-black text-white shadow-sm' : 'border-zinc-200 bg-white text-zinc-600 hover:border-black hover:text-black'}`}>
                      {bezirk}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AKTIONEN */}
        <div className="pt-2 flex gap-3">
           <button onClick={resetFilters} title="Filter zurücksetzen" className="flex-none w-[60px] border border-zinc-200 bg-white text-zinc-500 rounded-lg hover:border-black hover:text-black transition-all flex items-center justify-center group cursor-pointer">
              <svg className="w-5 h-5 group-hover:-rotate-180 transition-transform duration-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
           </button>
           <button onClick={handleSearch} className="flex-1 bg-black text-white font-extrabold text-base py-3.5 rounded-lg uppercase tracking-[0.2em] shadow-lg hover:bg-zinc-800 hover:-translate-y-0.5 transition-all duration-300">
              Suchen
           </button>
        </div>
        
      </aside>
      {/* --- SIDEBAR ENDE --- */}

      {/* --- MAP --- */}
      <section className="flex-1 relative z-0 p-6 bg-white flex justify-center items-start">
        <div className="w-full max-w-5xl h-[500px] rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-zinc-200 relative bg-white">
          <Map filters={appliedFilters} />
        </div>
      </section>

    </div>
  );
}