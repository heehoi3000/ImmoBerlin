"use client";
// Eingabefeld für Ort oder PLZ mit Vorschlägen von Photon (OpenStreetMap-Geocoder, kostenlos, ohne Schlüssel).
import { useEffect, useRef, useState } from 'react';
import { Ort } from '../lib/filter';

const PHOTON_URL = 'https://photon.komoot.io/api/';
// Vorschläge auf Deutschland beschränken
const DEUTSCHLAND_BBOX = '5.8,47.2,15.1,55.1';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; postcode?: string; city?: string; district?: string; state?: string;
    countrycode?: string; extent?: [number, number, number, number];
  };
}

function ortAusFeature(f: PhotonFeature): Ort {
  const p = f.properties;
  const teile = [p.postcode && p.name !== p.postcode ? p.postcode : null, p.name, p.city, p.state]
    .filter((t, i, alle): t is string => !!t && alle.indexOf(t) === i);
  const [lon, lat] = f.geometry.coordinates;
  const e = p.extent;
  return {
    name: teile.join(', '),
    lat, lon,
    // Photon liefert [West, Nord, Ost, Süd]
    ausdehnung: e ? [Math.min(e[0], e[2]), Math.min(e[1], e[3]), Math.max(e[0], e[2]), Math.max(e[1], e[3])] : undefined,
  };
}

export default function Ortssuche({ ort, onChange }: { ort: Ort | null; onChange: (o: Ort | null) => void }) {
  const [text, setText] = useState(ort?.name ?? '');
  const [vorschlaege, setVorschlaege] = useState<Ort[]>([]);
  const [offen, setOffen] = useState(false);
  const anfrage = useRef(0);

  useEffect(() => { setText(ort?.name ?? ''); }, [ort]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    const suchtext = text.trim();
    if (!offen || suchtext.length < 2 || suchtext === ort?.name) return;
    const nr = ++anfrage.current;
    const timer = setTimeout(async () => {
      try {
        const url = `${PHOTON_URL}?q=${encodeURIComponent(suchtext)}&lang=de&limit=6&bbox=${DEUTSCHLAND_BBOX}&layer=city&layer=district&layer=locality&layer=postcode&layer=county&layer=state`;
        const antwort = await fetch(url);
        const daten = await antwort.json();
        if (nr !== anfrage.current) return;
        setVorschlaege(((daten.features as PhotonFeature[]) || []).map(ortAusFeature));
      } catch (err) {
        console.error("Ortssuche fehlgeschlagen:", err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [text, offen, ort]);

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={text}
        placeholder="Ort oder PLZ, z.B. Berlin, Potsdam, 10115"
        onChange={(e) => { setText(e.target.value); setOffen(true); if (e.target.value === '') onChange(null); }}
        onFocus={() => setOffen(true)}
        onBlur={() => setTimeout(() => setOffen(false), 150)}
        className="w-full h-[38px] bg-white border border-zinc-200 rounded-md px-3 pr-8 text-sm font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-400"
      />
      {ort && (
        <button title="Ort entfernen" onClick={() => { onChange(null); setText(''); setVorschlaege([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black text-lg leading-none">×</button>
      )}
      {offen && vorschlaege.length > 0 && text.trim() !== ort?.name && (
        <div className="absolute top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto">
          {vorschlaege.map((v, i) => (
            <button key={`${v.name}-${i}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(v); setText(v.name); setOffen(false); }} className="w-full text-left px-3 py-2 hover:bg-zinc-100 text-sm text-zinc-800">
              {v.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
