// Tauschwohnungen: Wunsch je Tauschinserat (Tabelle tausch_wuensche) und passende Tauschpartner
// (RPC tausch_partner, supabase/migrations/0006_tausch.sql).
import { supabase } from './supabase';
import { Linie } from './oepnv';

// Linie im Wunsch: ohne linie_id, weil die sich bei jedem Fahrplan-Import ändert
export interface WunschLinie { typ: string; nummer: string; betreiber: string; endpunkte?: string }

export interface TauschWunsch {
  linien: WunschLinie[];
  umkreis_m: number;
  ort: string | null;
  max_warmmiete: number | null;
  min_zimmer: number | null;
  min_qm: number | null;
}

export interface TauschPartner { id: string; gegenseitig: boolean }

export const MAX_WUNSCH_LINIEN = 5;
export const LEERER_WUNSCH: TauschWunsch = { linien: [], umkreis_m: 600, ort: null, max_warmmiete: null, min_zimmer: null, min_qm: null };

export const wunschLinie = (l: Linie): WunschLinie => ({ typ: l.typ, nummer: l.nummer, betreiber: l.betreiber, endpunkte: l.endpunkte });

export async function wunschLaden(anzeigeId: string): Promise<TauschWunsch | null> {
  const { data, error } = await supabase.from('tausch_wuensche')
    .select('linien, umkreis_m, ort, max_warmmiete, min_zimmer, min_qm').eq('anzeige_id', anzeigeId).maybeSingle();
  if (error) throw error;
  return (data as TauschWunsch) ?? null;
}

export async function wunschSpeichern(anzeigeId: string, w: TauschWunsch) {
  const { error } = await supabase.from('tausch_wuensche').upsert({ anzeige_id: anzeigeId, ...w, geaendert_am: new Date().toISOString() });
  if (error) throw error;
}

export async function wunschLoeschen(anzeigeId: string) {
  const { error } = await supabase.from('tausch_wuensche').delete().eq('anzeige_id', anzeigeId);
  if (error) throw error;
}

// Wunschlinien wieder als auswählbare Linien (mit heutiger linie_id); nicht mehr vorhandene fallen weg
export async function wunschLinienAufloesen(linien: WunschLinie[]): Promise<Linie[]> {
  if (!linien.length) return [];
  const { data, error } = await supabase.from('oepnv_linien').select('linie_id, typ, nummer, betreiber, endpunkte')
    .in('nummer', [...new Set(linien.map(l => l.nummer))]);
  if (error) throw error;
  return linien.flatMap(w => ((data ?? []) as Linie[]).filter(l => l.typ === w.typ && l.nummer === w.nummer && l.betreiber === w.betreiber).slice(0, 1));
}

export async function partnerLaden(anzeigeId: string): Promise<TauschPartner[]> {
  const { data, error } = await supabase.rpc('tausch_partner', { p_anzeige: anzeigeId });
  if (error) throw error;
  return (data ?? []) as TauschPartner[];
}

// Wunsch als kurze Zeilen für die Anzeige, z. B. "höchstens 800 € warm"
export function wunschZeilen(w: TauschWunsch): string[] {
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const zeilen: string[] = [];
  if (w.linien.length) {
    zeilen.push(`An ${w.linien.map(l => l.nummer).join(', ')}, höchstens ${w.umkreis_m < 1000 ? `${w.umkreis_m} m` : `${(w.umkreis_m / 1000).toLocaleString('de-DE')} km`} bis zur Haltestelle`);
  }
  if (w.ort) zeilen.push(`In ${w.ort}`);
  if (w.min_zimmer) zeilen.push(`Mindestens ${w.min_zimmer.toLocaleString('de-DE')} Zimmer`);
  if (w.min_qm) zeilen.push(`Mindestens ${w.min_qm.toLocaleString('de-DE')} m²`);
  if (w.max_warmmiete) zeilen.push(`Höchstens ${euro.format(w.max_warmmiete)} warm`);
  return zeilen;
}
