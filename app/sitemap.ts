// Sitemap für Suchmaschinen (sitemap.xml). Inserate stehen nicht darin: Sie werden im Browser geladen
// und brauchen dafür eigene Seiten, die es erst auf dem eigenen Server gibt.
import type { MetadataRoute } from 'next';
import { SEITEN_URL } from '../lib/seite';

export const dynamic = 'force-static';

const SEITEN: { pfad: string; prioritaet: number; haeufigkeit: 'daily' | 'monthly' | 'yearly' }[] = [
  { pfad: '', prioritaet: 1, haeufigkeit: 'daily' },
  { pfad: 'suche/', prioritaet: 0.9, haeufigkeit: 'daily' },
  { pfad: 'inserieren/', prioritaet: 0.7, haeufigkeit: 'monthly' },
  { pfad: 'impressum/', prioritaet: 0.2, haeufigkeit: 'yearly' },
  { pfad: 'datenschutz/', prioritaet: 0.2, haeufigkeit: 'yearly' },
  { pfad: 'nutzungsbedingungen/', prioritaet: 0.2, haeufigkeit: 'yearly' },
  { pfad: 'barrierefreiheit/', prioritaet: 0.2, haeufigkeit: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return SEITEN.map(s => ({ url: `${SEITEN_URL}/${s.pfad}`, changeFrequency: s.haeufigkeit, priority: s.prioritaet }));
}
