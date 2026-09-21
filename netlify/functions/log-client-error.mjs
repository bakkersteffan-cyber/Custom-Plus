/* CUSTOM+ foutlogboek — serverless vangnet voor clientfouten, zonder tracker.
   ------------------------------------------------------------------
   Eén eindpunt, POST, JSON: { app, message, stack, url, lang, client_id }

   app is een van 'site' | 'portal' | 'beheer' (hardcoded in het kleine
   scriptblokje van elk van de drie bestanden zelf, niet iets wat de client
   vrij kan kiezen — zie custom-plus.html, portal.html en beheer.html).

   GEEN TRACKER, GEEN PII
   Er wordt hier bewust niets gelezen of opgeslagen wat een bezoeker
   identificeert: geen IP-adres, geen user agent, geen cookies. clientIp()
   hieronder bestaat uitsluitend voor de snelheidslimiet, leeft alleen in het
   geheugen van deze functie-instantie en wordt nooit naar Supabase gestuurd.
   client_id is een willekeurige waarde die de browser zelf verzint en alleen
   in sessionStorage bewaart — puur om "één bezoeker met veel fouten" te
   onderscheiden van "veel bezoekers met één fout elk", niet om iemand te
   herkennen.

   VALIDATIE (afwijzen, behalve stack — die wordt afgekapt, nooit geweigerd:
   stack traces zijn onvoorspelbaar lang en de fout zelf is de moeite van het
   bewaren waard, ook zonder de volledige trace)
     · app moet exact 'site', 'portal' of 'beheer' zijn
     · message verplicht, niet leeg, hoogstens 500 tekens
     · stack optioneel, wordt afgekapt op 4000 tekens
     · url optioneel; aanwezig, dan hoogstens 300 tekens én moet beginnen met
       de eigen oorsprong (dezelfde originecontrole als site-chat.mjs) —
       zonder die eis zou dit eindpunt een gratis logboek voor eender welke
       url worden

   BESCHERMING (zelfde opzet als site-chat.mjs, zie de uitleg daar)
     · per IP 30 meldingen per uur, alleen voor de limiet, nooit opgeslagen
     · CORS: alleen de eigen oorsprong

   ONTBREKENDE CONFIGURATIE
   Zonder SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY is er nergens om naartoe
   te schrijven. De functie antwoordt dan met status 204 (geen inhoud — een
   204-antwoord mag van de Fetch-specificatie geen body hebben) en logt
   niets: geen halve actie, geen verzonnen "ok:true".

   OMGEVINGSVARIABELEN
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  verplicht om daadwerkelijk op
                                te slaan; zonder een van beide: 204, niets
                                gelogd (zie hierboven)
     URL, DEPLOY_PRIME_URL, DEPLOY_URL, PORTAL_BASE_URL
                                voor de originecontrole, zoals site-chat.mjs
   ------------------------------------------------------------------ */

export var APP_VALUES = ['site', 'portal', 'beheer'];
export var MAX_MESSAGE_CHARS = 500;
export var MAX_STACK_CHARS = 4000;
export var MAX_URL_CHARS = 300;
export var RATE_LIMIT = 30;
export var RATE_WINDOW_MS = 60 * 60 * 1000;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

/* ============================================================ oorsprong */

/* Dezelfde lijst als site-chat.mjs: de eigen Netlify-oorsprong plus de
   omgevingsvariabelen die Netlify daarvoor zet, plus lokaal (elke poort). */
function allowedOrigins(req) {
  var own = '';
  try { own = new URL(req.url).origin; } catch (e) { own = ''; }
  return [own, process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, process.env.PORTAL_BASE_URL]
    .map(function (v) { try { return v ? new URL(v).origin : ''; } catch (e) { return ''; } })
    .filter(Boolean);
}

/* Alleen de eigen oorsprong. Een ontbrekende Origin (curl, server, of een
   fetch met keepalive vanaf dezelfde pagina die de header soms weglaat)
   laten we door: de snelheidslimiet hierboven geldt dan nog steeds. */
function originAllowed(req) {
  var origin = req.headers.get('origin');
  if (!origin) return true;
  var allowed = allowedOrigins(req);
  if (allowed.indexOf(origin) >= 0) return true;
  var own = '';
  try { own = new URL(req.url).origin; } catch (e) { own = ''; }
  return /^https?:\/\/localhost(:\d+)?$/.test(origin) && /^https?:\/\/localhost(:\d+)?$/.test(own);
}

/* Dezelfde controle, maar dan op het url-veld uit de body in plaats van de
   Origin-header: moet beginnen met (= dezelfde oorsprong als) de site. */
function urlSameOrigin(req, value) {
  var origin;
  try { origin = new URL(value).origin; } catch (e) { return false; }
  var allowed = allowedOrigins(req);
  if (allowed.indexOf(origin) >= 0) return true;
  var own = '';
  try { own = new URL(req.url).origin; } catch (e) { own = ''; }
  return /^https?:\/\/localhost(:\d+)?$/.test(origin) && /^https?:\/\/localhost(:\d+)?$/.test(own);
}

/* ============================================================ validatie */

function cleanText(v) {
  return typeof v === 'string' ? v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim() : '';
}

/* Geeft { error } bij een geweigerd veld, anders de opgeschoonde waarden.
   req is nodig voor de originecontrole op url. */
export function validateBody(req, body) {
  if (!body || typeof body !== 'object') return { error: 'bad-json' };

  var app = body.app;
  if (APP_VALUES.indexOf(app) < 0) return { error: 'invalid-app' };

  var message = cleanText(body.message);
  if (!message) return { error: 'invalid-message' };
  if (message.length > MAX_MESSAGE_CHARS) return { error: 'invalid-message' };

  var stack = cleanText(body.stack).slice(0, MAX_STACK_CHARS);

  var url = cleanText(body.url);
  if (url) {
    if (url.length > MAX_URL_CHARS) return { error: 'invalid-url' };
    if (!urlSameOrigin(req, url)) return { error: 'invalid-url' };
  }

  var lang = cleanText(body.lang).slice(0, 10);
  var clientId = cleanText(body.client_id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);

  return { app: app, message: message, stack: stack, url: url, lang: lang, clientId: clientId };
}

/* ============================================================ snelheidslimiet */

var rateMap = new Map();

export function __resetState() {
  rateMap = new Map();
}

function clientIp(req) {
  var h = req.headers;
  var ip = h.get('x-nf-client-connection-ip') || (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('client-ip') || '';
  return ip || 'onbekend';
}

/* true = mag door. Vast venster per IP; oude vensters worden bij het
   passeren opgeruimd zodat de map niet groeit. Puur voor de limiet: het IP
   zelf wordt nooit naar Supabase gestuurd of ergens opgeslagen. */
function rateAllow(ip, now) {
  now = now || Date.now();
  var e = rateMap.get(ip);
  if (!e || now - e.start >= RATE_WINDOW_MS) {
    e = { start: now, n: 0 };
    rateMap.set(ip, e);
    if (rateMap.size > 5000) {
      rateMap.forEach(function (v, k) { if (now - v.start >= RATE_WINDOW_MS) rateMap.delete(k); });
    }
  }
  e.n += 1;
  return e.n <= RATE_LIMIT;
}

/* ============================================================ Supabase */

function supabaseEnv() {
  var url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return (url && key) ? { url: url, key: key } : null;
}

function sbHeaders(key) {
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

/* Gooit nooit: een onbereikbare Supabase mag deze functie niet laten
   klappen. Geeft true terug bij een gelukte RPC, anders false — nooit
   verzonnen succes. */
async function callLogRpc(env, v) {
  try {
    var r = await fetch(env.url + '/rest/v1/rpc/log_client_error', {
      method: 'POST',
      headers: sbHeaders(env.key),
      body: JSON.stringify({
        p_app: v.app,
        p_message: v.message,
        p_stack: v.stack || null,
        p_url: v.url || null,
        p_lang: v.lang || null,
        p_client_id: v.clientId || null
      })
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

/* ============================================================ handler */

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!originAllowed(req)) return json({ error: 'forbidden-origin' }, 403);

  var body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad-json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad-json' }, 400);

  /* eerst de goedkope config-check (zoals site-chat.mjs eerst MISTRAL_API_KEY
     controleert, vóór er iets gevalideerd wordt): zonder Supabase is er toch
     nergens om naartoe te schrijven, en dan heeft validatie geen zin. */
  var env = supabaseEnv();
  if (!env) return new Response(null, { status: 204 });

  var v = validateBody(req, body);
  if (v.error) return json({ error: v.error }, 400);

  if (!rateAllow(clientIp(req))) return json({ error: 'rate-limited' }, 429);

  var stored = await callLogRpc(env, v);
  return json({ ok: stored }, 200);
}
