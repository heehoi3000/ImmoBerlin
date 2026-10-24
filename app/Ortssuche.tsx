"use client";
// Eingabefeld für Ort oder PLZ. Vorschläge kommen aus den vorab erzeugten Gebietsdateien (lib/orte.ts);
// nur wenn diese fehlen, fragt die Seite Photon (OpenStreetMap-Geocoder, kostenlos, ohne Schlüssel).
import { useEffect, useId, useRef, useState } from 'react';
import { Ort } from '../lib/filter';
import { orteSuchen } from '../lib/orte';

const PHOTON_URL = 'https://photon.komoot.io/api/';
// Vorschläge auf Deutschland beschränken
const DEUTSCHLAND_BBOX = '5.8,47.2,15.1,55.1';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string; postcode?: string; city?: string; district?: string; state?: string;
    countrycode?: string; extent?: [number, number, number, number]; type?: string;
    osm_type?: string; osm_id?: number;
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
    kurzname: p.name,
    osmRelation: p.osm_type === 'R' ? p.osm_id : undefined,
  };
}

export default function Ortssuche({ ort, onChange, platzhalter = 'Ort oder PLZ, z.B. Berlin, Potsdam, 10115' }: { ort: Ort | null; onChange: (o: Ort | null) => void; platzhalter?: string }) {
  const [text, setText] = useState(ort?.name ?? '');
  const [vorschlaege, setVorschlaege] = useState<Ort[]>([]);
  const [offen, setOffen] = useState(false);
  const anfrage = useRef(0);

  // Feld übernimmt einen von außen gewählten Ort
  const [letzterOrt, setLetzterOrt] = useState(ort);
  if (ort !== letzterOrt) {
    setLetzterOrt(ort);
    setText(ort?.name ?? '');
  }

  // Ohne Eingabe keine (veralteten) Vorschläge zeigen
  const sichtbar = offen && text.trim().length > 0 && text.trim() !== ort?.name ? vorschlaege : [];
  // Mit Pfeiltasten markierter Vorschlag (Enter übernimmt ihn, ohne Markierung den ersten)
  const [markiert, setMarkiert] = useState(-1);
  const listeId = useId();
  const waehle = (v: Ort) => { onChange(v); setText(v.name); setOffen(false); setMarkiert(-1); };

  useEffect(() => {
    const suchtext = text.trim();
    if (!offen || suchtext.length < 1 || suchtext === ort?.name) return;
    const nr = ++anfrage.current;
    const timer = setTimeout(async () => {
      try {
        const eigene = await orteSuchen(suchtext);
        if (eigene) {
          if (nr === anfrage.current) setVorschlaege(eigene);
          return;
        }
        // Erlaubte Ebenen laut Photon-Doku: house, street, locality, district, city, county, state, country, other.
        // Ein ungültiger Wert lässt die ganze Anfrage scheitern. Postleitzahlen liegen unter "other".
        const url = `${PHOTON_URL}?q=${encodeURIComponent(suchtext)}&lang=de&limit=6&bbox=${DEUTSCHLAND_BBOX}&layer=city&layer=district&layer=locality&layer=county&layer=state&layer=other`;
        const antwort = await fetch(url);
        if (!antwort.ok) throw new Error(`Photon antwortet mit ${antwort.status}`);
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
        placeholder={platzhalter}
        aria-label="Ort oder Postleitzahl"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={sichtbar.length > 0}
        aria-controls={listeId}
        aria-activedescendant={markiert >= 0 && sichtbar[markiert] ? `${listeId}-${markiert}` : undefined}
        onChange={(e) => { setText(e.target.value); setOffen(true); setMarkiert(-1); if (e.target.value === '') onChange(null); }}
        onFocus={() => setOffen(true)}
        onBlur={() => setTimeout(() => setOffen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && sichtbar.length) { e.preventDefault(); setMarkiert(m => (m + 1) % sichtbar.length); }
          else if (e.key === 'ArrowUp' && sichtbar.length) { e.preventDefault(); setMarkiert(m => (m <= 0 ? sichtbar.length : m) - 1); }
          else if (e.key === 'Escape') { setOffen(false); setMarkiert(-1); }
          else if (e.key === 'Enter' && sichtbar.length) { e.preventDefault(); waehle(sichtbar[Math.max(markiert, 0)]); }
        }}
        className="w-full h-[38px] bg-white border border-zinc-200 rounded-md px-3 pr-8 text-sm font-medium focus:ring-1 focus:ring-black outline-none placeholder:text-zinc-500"
      />
      {ort && (
        <button type="button" title="Ort entfernen" aria-label="Ort entfernen" onClick={() => { onChange(null); setText(''); setVorschlaege([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-black text-lg leading-none">×</button>
      )}
      {sichtbar.length > 0 && (
        <div id={listeId} role="listbox" aria-label="Vorschläge" className="absolute top-full mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg z-30 max-h-60 overflow-y-auto">
          {sichtbar.map((v, i) => (
            <div key={`${v.name}-${i}`} id={`${listeId}-${i}`} role="option" aria-selected={i === markiert}
              onMouseDown={(e) => e.preventDefault()} onClick={() => waehle(v)}
              className={`w-full text-left px-3 py-2 hover:bg-zinc-100 text-sm text-zinc-800 cursor-pointer ${i === markiert ? 'bg-zinc-100' : ''}`}>
              {v.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
