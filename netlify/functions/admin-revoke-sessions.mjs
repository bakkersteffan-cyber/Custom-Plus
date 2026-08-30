/* CUSTOM+ beheer — sessies intrekken (golf 6, functie 32).
   Trekt ALLE refresh-tokens van één klantaccount in via de GoTrue admin-API
   van Supabase. De service-role key leeft uitsluitend hier (Netlify env vars
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) en komt nooit in de browser.

   Aanroep vanuit beheer.html (revokeClientSessions):
     POST { secret, userId }
   `secret` is hetzelfde gedeelde wachtwoord als bij notify-client.mjs
   (NOTIFY_SHARED_SECRET) — een drempel tegen toevallig misbruik, geen echte
   authenticatie; zie de kanttekening in notify-client.mjs. Zonder een van de
   drie env vars is deze functie uit (503), zodat er nooit een halfgecon-
   figureerd admin-endpoint live staat.

   Effect: op elk apparaat is de klant uitgelogd zodra zijn huidige
   toegangstoken verloopt (maximaal ~een uur); opnieuw inloggen kan alleen
   met het (eventueel via Toegangsherstel opnieuw ingestelde) wachtwoord. */

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  var supabaseUrl = process.env.SUPABASE_URL;
  var serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  var secretConfigured = process.env.NOTIFY_SHARED_SECRET;
  if (!supabaseUrl || !serviceKey || !secretConfigured) return json({ error: 'not-configured' }, 503);

  var body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad-json' }, 400); }
  if (!body || body.secret !== secretConfigured) return json({ error: 'unauthorized' }, 401);

  var userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  /* strikte UUID-check: het id landt in een URL-pad — nooit vrije tekst */
  if (!UUID_RE.test(userId)) return json({ error: 'invalid-user-id' }, 400);

  /* GoTrue admin: POST /auth/v1/admin/users/{id}/logout trekt alle
     refresh-tokens van dit account in ("logout everywhere"). */
  var upstream;
  try {
    upstream = await fetch(
      supabaseUrl.replace(/\/+$/, '') + '/auth/v1/admin/users/' + userId + '/logout',
      {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': 'Bearer ' + serviceKey,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (e) {
    return json({ error: 'upstream-unreachable' }, 502);
  }
  if (!upstream.ok && upstream.status !== 204) {
    var errText = '';
    try { errText = await upstream.text(); } catch (e) { /* negeer */ }
    return json({ error: 'upstream-' + upstream.status, detail: errText.slice(0, 300) }, 502);
  }
  return json({ ok: true });
}
