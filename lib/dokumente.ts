// Links und Dokumente eines Inserats (Spalten anzeigen.dokumente und anzeigen.links, Migration 0011).
// PDFs liegen im Foto-Bucket im Ordner des Inserenten, damit „Konto löschen“ sie mit entfernt.
import { supabase } from './supabase';
import { FOTO_BUCKET } from './fotos';

export type DokumentArt = 'grundriss' | 'energieausweis' | 'sonstiges';
export interface Dokument { art: DokumentArt; titel: string; pfad: string }
export interface InseratLink { titel: string; url: string }

export const DOKUMENT_ARTEN: { wert: DokumentArt; name: string }[] = [
  { wert: 'grundriss', name: 'Grundriss' },
  { wert: 'energieausweis', name: 'Energieausweis' },
  { wert: 'sonstiges', name: 'Sonstiges Dokument' },
];
export const dokumentArtName = (art: string) => DOKUMENT_ARTEN.find(a => a.wert === art)?.name ?? 'Dokument';

export const MAX_DOKUMENTE = 10;
export const MAX_LINKS = 5;
export const MAX_DOKUMENT_MB = 10;

// Neuer Speicherpfad im Ordner des Inserenten, z. B. „<nutzer-id>/1729000000000-ab12cd34.pdf“
export const dokumentPfad = (nutzerId: string) => `${nutzerId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.pdf`;

export const dokumentUrl = (pfad: string) => supabase.storage.from(FOTO_BUCKET).getPublicUrl(pfad).data.publicUrl;

// Echte PDF-Datei? Prüft die ersten Bytes („%PDF-“), nicht nur Endung oder angegebenen Typ
export async function istPdf(datei: Blob): Promise<boolean> {
  const kopf = new Uint8Array(await datei.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...kopf) === '%PDF-';
}

// Nur https-Adressen ohne Leer- und Sonderzeichen (wie die Prüfung in der Datenbank); gibt die bereinigte Adresse oder null
export function linkPruefen(eingabe: string): string | null {
  let s = eingabe.trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = `https://${s}`;
  try {
    const url = new URL(s);
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return null;
    const text = url.toString();
    return /^https:\/\/[^\s<>"]+$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

// Kurze Anzeige der Adresse, z. B. „my.matterport.com“
export function linkHost(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// Werte aus der Datenbank sicher lesen (ältere Inserate haben die Spalten noch nicht)
export const dokumenteVon = (wert: unknown): Dokument[] => (Array.isArray(wert) ? wert.filter(d => d && typeof d.pfad === 'string') : []);
export const linksVon = (wert: unknown): InseratLink[] => (Array.isArray(wert) ? wert.filter(l => l && linkPruefen(String(l.url)) === l.url) : []);
