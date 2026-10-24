"use client";
// Route von der Wohnung zu einem Ziel: öffnet Google Maps (Maps-URLs, ohne Schlüssel) mit fertiger Route.
// Daten gehen erst beim Klick an Google; eigene Routen auf der Karte folgen mit eigenen Servern (Hetzner).
import { useState } from 'react';

const ARTEN = [
  { modus: 'transit', name: 'ÖPNV' },
  { modus: 'driving', name: 'Auto' },
  { modus: 'walking', name: 'Zu Fuß' },
] as const;

export function routenLink(lat: number, lon: number, ziel: string, modus: string) {
  const p = new URLSearchParams({ api: '1', origin: `${lat},${lon}`, travelmode: modus });
  if (ziel.trim()) p.set('destination', ziel.trim());
  return `https://www.google.com/maps/dir/?${p}`;
}

export default function Routenplanung({ lat, lon }: { lat: number; lon: number }) {
  const [ziel, setZiel] = useState('');
  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5" aria-labelledby="route-titel">
      <h2 id="route-titel" className="font-bold">Route planen</h2>
      <p className="text-xs text-zinc-500 mt-0.5">Von der Wohnung zu deinem Ziel, zum Beispiel Arbeit, Uni oder Schule.</p>
      <label htmlFor="route-ziel" className="block text-sm font-semibold mt-3">Ziel</label>
      <input id="route-ziel" type="text" value={ziel} onChange={e => setZiel(e.target.value)} autoComplete="street-address"
        placeholder="Adresse oder Ort" className="mt-1 w-full h-10 px-3 rounded-lg border border-zinc-300 text-sm focus:border-black outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        {ARTEN.map(({ modus, name }) => (
          <a key={modus} href={routenLink(lat, lon, ziel, modus)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center h-9 px-4 rounded-full border border-zinc-300 text-sm font-semibold hover:border-black">
            {name}<span className="sr-only"> (öffnet Google Maps in neuem Fenster)</span>
          </a>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500 mt-3">Die Route öffnet sich bei Google Maps. Erst mit dem Klick gehen die Lage der Wohnung und dein Ziel an Google.</p>
    </section>
  );
}
