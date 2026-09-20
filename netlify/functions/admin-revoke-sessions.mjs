/* CUSTOM+ beheer — sessies intrekken (golf 6, functie 32).
   Trekt ALLE refresh-tokens van één klantaccount in via de GoTrue admin-API
   van Supabase. De service-role key leeft uitsluitend hier (Netlify env vars
   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) en komt nooit in de browser.

   Aanroep vanuit beheer.html (revokeClientSessions):
     POST { userId }   met kopregel  Authorization: Bearer <sessietoken>

   DE POORT. Deze functie logt iemand overal uit; wie hem kan aanroepen kan
   elke klant buitensluiten. Hij hangt daarom aan dezelfde poort als
   notify-client.mjs, invoice-validate.mjs en invoice-ai.mjs:

     1. het sessietoken van de aanroeper wordt bij Supabase geverifieerd en
        daarna getoetst aan staff_users — met de service-role-sleutel, dus
        buiten RLS om. Alleen echte staf komt binnen.
     2. anders het gedeelde geheim in de body, in constante tijd vergeleken.
        Die weg bestaat nog uitsluitend voor aanroepen zonder sessie (cron,
        webhook) en is voor een buitenstaander onbruikbaar, omdat het geheim
        sinds de beveiligingsronde nergens meer in de browser staat.

   Waarom het vroeger niet genoeg was: het geheim stond in portal/config.js,
   en netlify.toml publiceert de hele map. Iedereen kon het dus opvragen en
   daarmee namens de eigenaar elke klant uitloggen.

   Zonder een van de drie env vars is deze functie uit (503), zodat er nooit
   een half geconfigureerd admin-endpoint live staat.

   Effect: op elk apparaat is de klant uitgelogd zodra zijn huidige
   toegangstoken verloopt (maximaal ~een uur); opnieuw inloggen kan alleen
   met het (eventueel via Toegangsherstel opnieuw ingestelde) wachtwoord. */

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
var BEARER_RE = /^Bearer\s+(\S+)$/i;

/* ---- de gedeelde poort, regel voor regel gelijk aan de andere drie functies.
   Bewust gekopieerd en niet uitgetrokken naar een eigen bestand: alles in
   netlify/functions/ wordt vanzelf een endpoint, en een vierde endpoint met
   alleen hulpcode erin is een deur die niemand nodig heeft. Wijzigt de poort,
   dan wijzigt hij op vier plekken — dat staat ook boven de andere drie. ---- */

function supabaseEnv() {
  var url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return (url && key) ? { url: url, key: key } : null;
}
function serviceHeaders(key) {
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}
function bearerToken(req) {
  var raw = String(req.headers.get('authorization') || '').trim();
  var m = raw.match(BEARER_RE);
  var tok = m ? m[1] : '';
  return (tok.length <= 4096 && JWT_RE.test(tok)) ? tok : '';
}
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function staffUserId(env, token) {
  var user = null;
  try {
    var who = await fetch(env.url + '/auth/v1/user', {
      headers: { apikey: env.key, Authorization: 'Bearer ' + token }
    });
    if (!who.ok) return '';
    user = await who.json();
  } catch (e) { return ''; }
  var uid = (user && typeof user.id === 'string') ? user.id : '';
  if (!UUID_RE.test(uid)) return '';
  try {
    /* met de service-role-sleutel, dus zonder RLS ertussen: we vragen niet of
       DEZE gebruiker de stafregels mag lezen, we vragen of hij erin staat. */
    var res = await fetch(
      env.url + '/rest/v1/staff_users?select=user_id&limit=1&user_id=eq.' + encodeURIComponent(uid),
      { headers: serviceHeaders(env.key) });
    if (!res.ok) return '';
    var rows = await res.json();
    return (Array.isArray(rows) && rows.length) ? uid : '';
  } catch (e) { return ''; }
}
async function checkCaller(req, body) {
  var env = supabaseEnv();
  var token = bearerToken(req);
  if (token && env) {
    var uid = await staffUserId(env, token);
    if (uid) return { ok: true, via: 'sessie', userId: uid };
  }
  var secret = process.env.NOTIFY_SHARED_SECRET;
  if (secret && body && sameSecret(String(body.secret || ''), secret)) {
    return { ok: true, via: 'geheim', userId: '' };
  }
  return { ok: false, via: '', userId: '' };
}

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

  /* Sessietoken van een staflid, of het gedeelde geheim voor aanroepen zonder
     sessie. Een afgekeurd token valt stil door naar de geheimcontrole en
     eindigt als gewone 401, zodat het antwoord niet verklapt of een account
     staf is. */
  var poort = await checkCaller(req, body);
  if (!poort.ok) return json({ error: 'unauthorized' }, 401);

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
