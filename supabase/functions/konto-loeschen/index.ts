// Löscht das Konto des angemeldeten Nutzers samt Fotos und Dokumenten (DSGVO Art. 17), beide im Ordner <nutzer-id>/.
// Inserate und empfangene Nachrichten fallen per Fremdschlüssel weg, Meldungen verlieren den Bezug zum Konto,
// gesendete Anfragen bleiben beim Anbieter (ohne Bezug zum Konto).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const BUCKET = 'inserat-bilder';

function antwort(status: number, daten: Record<string, unknown>) {
  return new Response(JSON.stringify(daten), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return antwort(405, { fehler: 'Nur POST' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authFehler } = await admin.auth.getUser(token);
  if (authFehler || !user) return antwort(401, { fehler: 'Nicht angemeldet' });

  // Reihenfolge so, dass ein Abbruch nie Daten öffentlich lässt: erst Inserate aus der Suche nehmen, dann Meldungen
  // anonymisieren, dann Fotos und Dokumente löschen, zuletzt das Konto. Scheitert ein Schritt, sind die Inserate
  // schon unsichtbar und ein zweiter Versuch räumt den Rest auf.
  const { error: pauseFehler } = await admin.from('anzeigen').update({ status: 'pausiert' }).eq('inserent_id', user.id).eq('status', 'aktiv');
  if (pauseFehler) return antwort(500, { fehler: 'Inserate konnten nicht pausiert werden' });

  const { error: meldFehler } = await admin.from('meldungen').update({ nutzer_id: null, email: null }).eq('nutzer_id', user.id);
  if (meldFehler) return antwort(500, { fehler: 'Meldungen konnten nicht anonymisiert werden' });

  // Fotos und Dokumente im Ordner <nutzer-id>/ löschen, seitenweise
  for (;;) {
    const { data: dateien, error } = await admin.storage.from(BUCKET).list(user.id, { limit: 100 });
    if (error) return antwort(500, { fehler: 'Fotos konnten nicht gelesen werden' });
    if (!dateien?.length) break;
    const { error: loeschFehler } = await admin.storage.from(BUCKET).remove(dateien.map(d => `${user.id}/${d.name}`));
    if (loeschFehler) return antwort(500, { fehler: 'Fotos konnten nicht gelöscht werden' });
    if (dateien.length < 100) break;
  }

  const { error: loeschFehler } = await admin.auth.admin.deleteUser(user.id);
  if (loeschFehler) return antwort(500, { fehler: 'Konto konnte nicht gelöscht werden' });
  return antwort(200, { geloescht: true });
});
