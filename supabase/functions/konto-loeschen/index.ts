// Löscht das Konto des angemeldeten Nutzers samt Fotos (DSGVO Art. 17).
// Inserate und empfangene Nachrichten fallen per Fremdschlüssel weg, Meldungen verlieren den Bezug zum Konto.
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

  // Fotos im Ordner <nutzer-id>/ löschen, seitenweise
  for (;;) {
    const { data: dateien, error } = await admin.storage.from(BUCKET).list(user.id, { limit: 100 });
    if (error) return antwort(500, { fehler: 'Fotos konnten nicht gelesen werden' });
    if (!dateien?.length) break;
    const { error: loeschFehler } = await admin.storage.from(BUCKET).remove(dateien.map(d => `${user.id}/${d.name}`));
    if (loeschFehler) return antwort(500, { fehler: 'Fotos konnten nicht gelöscht werden' });
    if (dateien.length < 100) break;
  }

  const { error: meldFehler } = await admin.from('meldungen').update({ nutzer_id: null, email: null }).eq('nutzer_id', user.id);
  if (meldFehler) return antwort(500, { fehler: 'Meldungen konnten nicht anonymisiert werden' });

  const { error: loeschFehler } = await admin.auth.admin.deleteUser(user.id);
  if (loeschFehler) return antwort(500, { fehler: 'Konto konnte nicht gelöscht werden' });
  return antwort(200, { geloescht: true });
});
