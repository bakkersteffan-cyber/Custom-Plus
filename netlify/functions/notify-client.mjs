/* CUSTOM+ klantmeldingen — serverless proxy naar Resend.
   De API key en het gedeelde wachtwoord leven uitsluitend hier (Netlify env vars
   RESEND_API_KEY / RESEND_FROM / NOTIFY_SHARED_SECRET), nooit in beheer.html of
   portal.html. Zonder een van de env vars is deze functie uit (503), zodat
   er nooit per ongeluk een halfgeconfigureerde open relay live staat.

   ------------------------------------------------------------------
   TWEE BEVEILIGINGSREPARATIES, ZIE DE BLOKKEN "DE POORT" EN "DE KNOP"

   1. WIE MAG DEZE FUNCTIE AANROEPEN. Het gedeelde geheim stond in
      portal/config.js, en dat bestand publiceert netlify.toml als
      onderdeel van de site. Iedereen kon het lezen en dus namens CUSTOM+
      mail versturen. De functie verifieert nu server-side de identiteit
      van de aanroeper: het Supabase-sessietoken uit de kopregel
      'Authorization: Bearer …' wordt bij Supabase gecontroleerd en daarna
      wordt in staff_users gekeken of dit echt staf is. Het geheim blijft
      alleen over voor aanroepen zonder sessie (cron, webhook).

   2. WAAR DE KNOP IN DE MAIL NAARTOE WIJST. portalUrl kwam ongecontroleerd
      uit de request. De basis-URL komt nu uit de omgeving; uit de request
      wordt hoogstens het pad met zijn parameters overgenomen.

   NIEUWE OMGEVINGSVARIABELEN
     PORTAL_BASE_URL           de oorsprong waarop elke knop uitkomt,
                               bijvoorbeeld https://custom-plus.nl. Staat
                               hij niet ingesteld, dan geldt de door
                               Netlify zelf gezette URL; is er geen van
                               beide, dan is de functie uit (503).
     PORTAL_URL_EXTRA_ORIGINS  optioneel, komma-gescheiden: extra
                               toegestane oorsprongen. Nodig zodra de
                               instelling "klantlinkbasis" in het beheer
                               naar een ander domein wijst dan de site
                               zelf, anders worden die links geweigerd.
     SUPABASE_URL /            nodig om een sessietoken te kunnen
     SUPABASE_SERVICE_ROLE_KEY verifiëren. Ze staan er al voor
                               admin-revoke-sessions.mjs en
                               invoice-link.mjs.

   WAT beheer.html NOG MOET AANPASSEN (aparte, kleine wijziging — dit
   bestand mag beheer.html niet aanraken):
     · Bij elke fetch naar /.netlify/functions/notify-client het
       sessietoken meesturen als kopregel:
         window.__cpSb.auth.getSession().then(function(s){
           var tok = s && s.data && s.data.session && s.data.session.access_token;
           …  headers: { 'Content-Type':'application/json',
                         'Authorization': 'Bearer ' + tok }  …
         });
       Het gaat om drie plekken: notifyClient → sendOne (rond regel 2270),
       invSendMail (rond regel 17360 én de fan-out rond 17392) en de
       ingeplande factuurmail rond regel 20870.
     · Het veld `secret` mag uit de body verdwijnen.
     · De bewakingen `if(!CFG.notifySharedSecret){ … }` (regels 2265, 12593,
       17321, 19407, 22966) moeten kijken of er een SESSIE is in plaats van
       naar een geheim dat er niet meer staat.

   beheer.html stuurt alleen KORTE, al-vertaalde tekst (subject/bodyLine) mee —
   deze functie bouwt daar zelf de gestylede e-mail omheen. Dat houdt de content
   voorspelbaar (geen vrije HTML van de client) en de sjabloon op één plek.

   ------------------------------------------------------------------
   FASE 4 (factuurmodule) — WAT ER IS BIJGEKOMEN, EN WAAROM ZO

   Een factuurmail heeft drie dingen nodig die een projectupdate niet
   heeft: een BIJLAGE (de definitieve PDF), CC/BCC (de boekhouder van de
   klant, de eigen administratie) en een BERICHT VAN MEER DAN ÉÉN REGEL.
   Alle drie zijn hier toegevoegd als OPTIONELE velden:

     cc, bcc      lijsten met e-mailadressen (elk max 10)
     attachment   { filename, contentBase64 } — Resend accepteert
                  base64-bijlagen, dus er hoeft geen bestand ergens
                  publiek te staan om hem te kunnen meesturen
     bodyText     meerregelig bericht; elke lege regel wordt een alinea
     facts        [{label, value}] — de gegevensstrook (factuurnummer,
                  bedrag, vervaldatum), max 6 rijen
     invoice      (advies 35) de factuurrij zelf: { statusCode,
                  totalInclCents, paidCents, creditedCents, dueDate,
                  currency, gemeld } — camelCase of snake_case. Stuur je
                  hem mee, dan zet de server er zelf de standregel van
                  het portaal bij ('Stand: Open · € 1.000 van € 3.125
                  ontvangen'), met dezelfde vertaler als portal.html.

   Alles blijft TEKST: de client stuurt nooit HTML, deze functie bouwt de
   opmaak. Dat is niet uit netheid maar omdat een gedeeld wachtwoord in
   een publiek JS-bestand geen echte authenticatie is (zie de opmerking in
   beheer.html) — een aanvaller die het geheim vindt mag hoogstens lelijke
   tekst versturen, nooit HTML met links naar elders.

   De BESTAANDE aanroepen blijven ongewijzigd werken: laat je cc, bcc,
   attachment, bodyText en facts weg, dan doet deze functie precies wat hij
   altijd deed. */

/* Advies 35: de vier woorden van de klant (Open · Gemeld · Betaald ·
   Bezwaar), de bedrag- en datumopmaak van het portaal en de schoonmaak van
   beheerstaal komen uit portal/invoice-mail.js — dezelfde module die de
   browser laadt, zodat er één vertaler is en niet twee. In Node is dat
   bestand CommonJS (UMD), dus de API zit op .default; zelfde recept als
   invoice-link.mjs en resend-webhook.mjs. */
import * as mailModule from '../../portal/invoice-mail.js';
var MAIL = (mailModule && mailModule.default) || globalThis.CP_INVOICE_MAIL;

var RESEND_URL = 'https://api.resend.com/emails';
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_LEN = 300;
/* fase 4: een factuurbericht mag langer zijn dan één regel, maar niet
   eindeloos — dit is een mailtje, geen brief */
var MAX_BODY_TEXT = 2000;
var MAX_CC = 10;
var MAX_FACTS = 6;
/* De factuur-PDF's van dit systeem zijn 30 tot 100 kB. 5 MB base64 is
   ruim tien keer de grootste die ooit voorkomt en houdt de request-body
   binnen wat een serverloze functie prettig verwerkt. */
var MAX_ATTACHMENT_B64 = 5 * 1024 * 1024;

/* taal per ontvanger (functies 26/30): beheer.html stuurt 'lang' mee —
   de portaaltaal van de klant, of de eigen taal van een contactpersoon.
   Alleen aanhef, voettekst, knop-fallback en html-lang komen uit dit
   woordenboekje; subject/bodyLine reizen al vertaald mee vanuit het
   beheer (waar sjablonen bestaan). Onbekende taal valt terug op NL. */
var MAIL_LANGS = {
  nl: {
    hello: 'Hallo',
    project: 'Jouw project',
    label: 'Bekijk je project',
    footer: 'Reageren op deze update? Log in op je project en stel je vraag daar — Steffan reageert meestal binnen 1 werkdag.'
  },
  en: {
    hello: 'Hello',
    project: 'Your project',
    label: 'View your project',
    footer: 'Want to reply to this update? Sign in to your project and ask your question there — Steffan usually replies within 1 working day.'
  },
  de: {
    hello: 'Hallo',
    project: 'Ihr Projekt',
    label: 'Projekt ansehen',
    footer: 'Sie möchten auf dieses Update reagieren? Melden Sie sich in Ihrem Projekt an und stellen Sie Ihre Frage dort — Steffan antwortet meist innerhalb von 1 Werktag.'
  },
  fr: {
    hello: 'Bonjour',
    project: 'Votre projet',
    label: 'Voir votre projet',
    footer: 'Vous souhaitez réagir à cette mise à jour ? Connectez-vous à votre projet et posez votre question là-bas — Steffan répond généralement sous 1 jour ouvré.'
  },
  es: {
    hello: 'Hola',
    project: 'Su proyecto',
    label: 'Ver su proyecto',
    footer: '¿Quiere responder a esta actualización? Inicie sesión en su proyecto y haga su pregunta allí — Steffan suele responder en 1 día laborable.'
  }
};
function langPack(lang) {
  return MAIL_LANGS[lang] || MAIL_LANGS.nl;
}

/* ==================================================================
   DE VIER WOORDEN VAN DE KLANT IN VIJF TALEN (advies 35)
   ==================================================================
   Sleutel = de NL bronstring uit portal/invoice-mail.js, sectie 7 —
   exact dezelfde sleutels als portal/i18n.js. Waar i18n.js de sleutel
   al kent ('Stand', 'Open', 'Gemeld', 'Betaald') staat hier LETTERLIJK
   die vertaling; test/notify-client.test.mjs legt beide naast elkaar en
   klapt zodra ze uit elkaar lopen. De overige ('Bezwaar' en de vijf
   toelichtingen) kent i18n.js nog niet: ze staan hier tot de
   vertaalronde ze daar toevoegt. i18n.js zelf importeren kan niet — dat
   bestand schrijft op window en is 3500 regels voor tien woorden. */
var STATUS_WOORDEN = {
  en: {
    'Stand': 'Status', 'Open': 'Open', 'Gemeld': 'Reported', 'Betaald': 'Paid', 'Bezwaar': 'Disputed',
    'Steffan controleert je betaling': 'Steffan is checking your payment',
    'Vervaldatum was {datum}': 'Due date was {datum}',
    '{betaald} van {totaal} ontvangen': '{betaald} of {totaal} received',
    'Creditnota, verrekend': 'Credit note, settled',
    'Vervallen': 'Cancelled'
  },
  de: {
    'Stand': 'Stand', 'Open': 'Offen', 'Gemeld': 'Gemeldet', 'Betaald': 'Bezahlt', 'Bezwaar': 'Einspruch',
    'Steffan controleert je betaling': 'Steffan prüft Ihre Zahlung',
    'Vervaldatum was {datum}': 'Fälligkeitsdatum war {datum}',
    '{betaald} van {totaal} ontvangen': '{betaald} von {totaal} erhalten',
    'Creditnota, verrekend': 'Gutschrift, verrechnet',
    'Vervallen': 'Entfallen'
  },
  fr: {
    'Stand': 'État', 'Open': 'En attente', 'Gemeld': 'Signalé', 'Betaald': 'Payé', 'Bezwaar': 'Contestation',
    'Steffan controleert je betaling': 'Steffan vérifie votre paiement',
    'Vervaldatum was {datum}': 'La date d’échéance était le {datum}',
    '{betaald} van {totaal} ontvangen': '{betaald} sur {totaal} reçus',
    'Creditnota, verrekend': 'Avoir, compensé',
    'Vervallen': 'Annulée'
  },
  es: {
    'Stand': 'Estado', 'Open': 'Pendiente', 'Gemeld': 'Comunicado', 'Betaald': 'Pagado', 'Bezwaar': 'Objeción',
    'Steffan controleert je betaling': 'Steffan está comprobando su pago',
    'Vervaldatum was {datum}': 'La fecha de vencimiento era el {datum}',
    '{betaald} van {totaal} ontvangen': '{betaald} de {totaal} recibidos',
    'Creditnota, verrekend': 'Nota de crédito, compensada',
    'Vervallen': 'Anulada'
  }
};
/* T(nl) → de vertaling voor deze taal. NL en een onbekende sleutel geven
   de bronstring terug — nooit een lege tekst, nooit een rauwe sleutel. */
function statusT(lang) {
  var d = STATUS_WOORDEN[lang];
  return function (nl) { return (d && d[nl]) || nl; };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

/* ==================================================================
   DE POORT — WIE MAG DEZE FUNCTIE AANROEPEN
   ==================================================================
   Twee toegelaten aanroepers, in deze volgorde:

     1. EEN INGELOGD STAFLID. De browser stuurt zijn Supabase-sessietoken
        mee als 'Authorization: Bearer …'. Wij vragen Supabase met de
        service-role-sleutel WIE dat token is, en kijken daarna in
        staff_users of die gebruiker echt staf is. Beide stappen gebeuren
        hier; de browser kan er niets aan sturen.

     2. EEN AANROEP ZONDER SESSIE — cron of webhook — met het gedeelde
        geheim NOTIFY_SHARED_SECRET.

   WAT ER MISGAAT ALS DEZE POORT WEG IS: dit is een mailfunctie met de
   afzender van CUSTOM+ erachter. Zonder poort kan iedereen die het adres
   van de functie kent mail versturen die van ons lijkt te komen. Tot deze
   wijziging was de poort een geheim dat in portal/config.js stond, en dat
   bestand serveert netlify.toml gewoon uit — dus in de praktijk stond de
   deur open.

   Zolang de overgang loopt worden BEIDE geaccepteerd: beheer.html stuurt
   nu nog het geheim en nog geen token. Een token dat niet deugt valt stil
   door naar (2) en eindigt als een gewone 401; het antwoord mag niet
   verklappen of een account bestaat of staf is. */

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* een JWT is drie base64url-delen met punten ertussen; meer hoeft deze
   vormcontrole niet te weten. De echte controle doet Supabase. */
var JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
var BEARER_RE = /^Bearer\s+(\S+)$/i;

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

/* Gelijk vergelijken zonder de lengte van het gemeenschappelijke
   voorvoegsel te verklappen. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Geeft het gebruikers-id terug als dit token van een STAFLID is, anders
   een lege string. Gooit nooit: een onbereikbare Supabase is geen toegang. */
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
    /* met de service-role-sleutel, dus zonder RLS ertussen: we vragen niet
       of DEZE gebruiker de stafregels mag lezen, we vragen of hij erin
       staat. */
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

/* ==================================================================
   DE KNOP IN DE MAIL — WAAR HIJ NAARTOE MAG WIJZEN
   ==================================================================
   portalUrl werd hiervóór alleen getrimd en op 500 tekens geknipt, en
   belandde daarna als href van de primaire knop in de mail. esc() zorgde
   wel dat er niet uit het attribuut te breken viel, maar een willekeurige
   http(s)-bestemming was gewoon geldig. Wie de functie kon aanroepen, kon
   dus een mail versturen die eruitziet als de factuurmail van CUSTOM+ maar
   naar zijn eigen pagina wijst. Dat is phishing met onze afzender, en het
   is precies het soort schade dat een klant op ONS verhaalt.

   Daarom: de oorsprong komt uit de OMGEVING, nooit uit de request.
     · Een pad ('/factuur.html?t=…') wordt op PORTAL_BASE_URL gezet.
     · Een volledige URL mag alleen als zijn oorsprong exact een van de
       toegestane is (PORTAL_BASE_URL plus PORTAL_URL_EXTRA_ORIGINS).
     · Alles wat daar niet op uitkomt — een ander domein, een ander
       schema, een URL met inloggegevens erin — wordt geweigerd met de
       foutcode 'portal-url-geweigerd'.
   De URL wordt daarna opnieuw OPGEBOUWD uit oorsprong + pad + query +
   fragment, zodat er nooit iets anders in de mail komt dan wat hier is
   goedgekeurd.

   Valt deze controle weg, dan is elke verstuurde mail een blanco
   cheque voor de aanroeper. */

function normOrigin(v) {
  var u;
  try { u = new URL(String(v == null ? '' : v).trim()); } catch (e) { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  return u.origin;
}

/* PORTAL_BASE_URL wint; anders de URL die Netlify zelf voor deze site
   zet. Beide komen uit de omgeving en niet uit de request — een
   Host-kopregel zou wél door de aanroeper te sturen zijn. */
function portalBase() {
  return normOrigin(process.env.PORTAL_BASE_URL || '') || normOrigin(process.env.URL || '');
}

function allowedOrigins() {
  var out = [];
  var base = portalBase();
  if (base) out.push(base);
  String(process.env.PORTAL_URL_EXTRA_ORIGINS || '').split(/[,;\s]+/).forEach(function (v) {
    var o = normOrigin(v);
    if (o && out.indexOf(o) < 0) out.push(o);
  });
  return out;
}

/* '' = geweigerd. De aanroeper krijgt dan een 400 met een code, geen mail. */
function safePortalUrl(raw) {
  var base = portalBase();
  if (!base) return '';
  var s = typeof raw === 'string' ? raw.trim().slice(0, 500) : '';
  if (!s) return '';
  var u;
  /* met base als grondslag: een kaal pad landt op onze eigen oorsprong,
     een volledige URL houdt de zijne en valt hieronder door de mand */
  try { u = new URL(s, base + '/'); } catch (e) { return ''; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
  if (u.username || u.password) return '';
  if (allowedOrigins().indexOf(u.origin) < 0) return '';
  return u.origin + u.pathname + u.search + u.hash;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* fase 4: het meerregelige bericht. Lege regels scheiden alinea's; elke
   alinea gaat door esc(), dus er komt nooit HTML van de client mee. */
function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(function (p) { return p.replace(/\n/g, ' ').trim(); })
    .filter(function (p) { return !!p; });
}

function renderFacts(facts) {
  if (!facts.length) return '';
  var rows = facts.map(function (f) {
    return '<tr>' +
      '<td style="padding:6px 0;font-size:12.5px;color:#696969;white-space:nowrap;">' + esc(f.label) + '</td>' +
      '<td style="padding:6px 0 6px 18px;font-size:13.5px;font-family:ui-monospace,Menlo,monospace;text-align:right;">' + esc(f.value) + '</td>' +
      '</tr>';
  }).join('');
  return '<tr><td style="padding:18px 32px 0;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
    'style="background:#faf8f5;border-radius:14px;padding:10px 16px;">' + rows + '</table>' +
    '</td></tr>';
}

function renderHtml(data) {
  var t = langPack(data.lang);
  var greet = data.clientName ? t.hello + ' ' + esc(data.clientName.split(' ')[0]) + ',' : t.hello + ',';
  var paras = data.bodyText ? paragraphs(data.bodyText) : [data.bodyLine];
  var bodyRows = paras.map(function (p) {
    return '<tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6;color:#333;">' + esc(p) + '</td></tr>';
  }).join('');
  var factRows = renderFacts(data.facts || []);
  if (data.bodyText || factRows) {
    return [
      '<!doctype html><html lang="' + esc(data.lang || 'nl') + '"><body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;color:#111;">',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">',
      '<tr><td align="center">',
      '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid rgba(228,224,219,.6);border-radius:20px;overflow:hidden;">',
      '<tr><td style="padding:28px 32px 0;">',
      '<div style="font-weight:800;font-size:18px;letter-spacing:.02em;">CUSTOM<span style="color:#1B6E45;">+</span></div>',
      '</td></tr>',
      '<tr><td style="padding:20px 32px 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#696969;font-family:ui-monospace,Menlo,monospace;">',
      esc(data.projectName || t.project) + (data.projectCode ? ' &middot; ' + esc(data.projectCode) : ''),
      '</td></tr>',
      '<tr><td style="padding:4px 32px 0;font-size:19px;font-weight:700;letter-spacing:-.01em;">' + esc(data.subject) + '</td></tr>',
      '<tr><td style="padding:14px 32px 0;font-size:15px;line-height:1.6;color:#333;">' + esc(greet) + '</td></tr>',
      bodyRows,
      factRows,
      '<tr><td style="padding:24px 32px 32px;">',
      '<a href="' + esc(data.portalUrl) + '" style="display:inline-block;background:#111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:100px;">' + esc(data.portalLabel || t.label) + '</a>',
      '</td></tr>',
      '<tr><td style="padding:0 32px 28px;font-size:12.5px;color:#999;line-height:1.6;">' + esc(t.footer) + '</td></tr>',
      '</table></td></tr></table></body></html>'
    ].join('');
  }
  return [
    '<!doctype html><html lang="' + esc(data.lang || 'nl') + '"><body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;color:#111;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid rgba(228,224,219,.6);border-radius:20px;overflow:hidden;">',
    '<tr><td style="padding:28px 32px 0;">',
    '<div style="font-weight:800;font-size:18px;letter-spacing:.02em;">CUSTOM<span style="color:#1B6E45;">+</span></div>',
    '</td></tr>',
    '<tr><td style="padding:20px 32px 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#696969;font-family:ui-monospace,Menlo,monospace;">',
    esc(data.projectName || t.project) + (data.projectCode ? ' &middot; ' + esc(data.projectCode) : ''),
    '</td></tr>',
    '<tr><td style="padding:4px 32px 0;font-size:19px;font-weight:700;letter-spacing:-.01em;">' + esc(data.subject) + '</td></tr>',
    '<tr><td style="padding:14px 32px 0;font-size:15px;line-height:1.6;color:#333;">' + esc(greet) + '</td></tr>',
    '<tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6;color:#333;">' + esc(data.bodyLine) + '</td></tr>',
    '<tr><td style="padding:24px 32px 32px;">',
    '<a href="' + esc(data.portalUrl) + '" style="display:inline-block;background:#111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:100px;">' + esc(data.portalLabel || t.label) + '</a>',
    '</td></tr>',
    '<tr><td style="padding:0 32px 28px;font-size:12.5px;color:#999;line-height:1.6;">' + esc(t.footer) + '</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
}

function renderText(data) {
  var t = langPack(data.lang);
  var greet = data.clientName ? t.hello + ' ' + data.clientName.split(' ')[0] + ',' : t.hello + ',';
  var parts = [
    (data.projectName || t.project) + (data.projectCode ? ' (' + data.projectCode + ')' : ''),
    data.subject, '',
    greet, '',
    data.bodyText ? paragraphs(data.bodyText).join('\n\n') : data.bodyLine, ''
  ];
  (data.facts || []).forEach(function (f) { parts.push(f.label + ': ' + f.value); });
  if ((data.facts || []).length) parts.push('');
  parts.push((data.portalLabel || t.label) + ': ' + data.portalUrl);
  return parts.join('\n');
}

/* ==================================================================
   WAT DE SERVER HIERNA NOG STEEDS VAN DE AANROEPER AANNEEMT
   ==================================================================
   Dit blijft zo, en het staat hier zodat niemand denkt dat de functie na
   bovenstaande reparaties alles narekent:

     to / cc / bcc   volledig door de aanroeper bepaald. Deze functie is
                     bedoeld om een klant te mailen, dus dat kan niet
                     anders; het is nu wél afgeschermd achter de identiteit
                     van een staflid in plaats van achter een geheim dat in
                     de publieke site stond. Er blijft één harde grens: de
                     afzender komt uitsluitend uit RESEND_FROM.
     subject /       vrije tekst van de aanroeper. Ze gaan door esc() de
     bodyText /      HTML in en er komt nooit HTML van de client mee, maar
     facts /         de INHOUD is van de aanroeper. Ook dat kan niet anders
     clientName      bij een mailfunctie met sjablonen aan de serverkant.
     attachment      naam en base64-inhoud van de aanroeper; alleen vorm en
                     omvang worden getoetst, niet wat er in het bestand
                     staat.
   ================================================================== */

export default async function handler(req) {
  var apiKey = process.env.RESEND_API_KEY;
  var from = process.env.RESEND_FROM;
  var secretConfigured = process.env.NOTIFY_SHARED_SECRET;

  var base = portalBase();

  /* health-check (functie 70 / go-live): een GET verstuurt nooit iets en
     antwoordt eerlijk of de env vars op Netlify staan — zo kan de
     beheer-header 'Live' pas groen tonen als mails ook echt kunnen.
     Er lekt geen sleutel, geen geheim en geen adres mee: alleen ja of nee. */
  if (req.method === 'GET') {
    return json({
      configured: !!(apiKey && from && secretConfigured && base),
      /* apart benoemd, want dit is de nieuwe voorwaarde: zonder
         basis-URL zou de knop in de mail nergens op uitkomen */
      portalBase: !!base,
      sessionAuth: !!supabaseEnv()
    }, 200);
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  if (!apiKey || !from || !secretConfigured || !base) return json({ error: 'not-configured' }, 503);

  var body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad-json' }, 400); }

  var caller = await checkCaller(req, body);
  if (!caller.ok) return json({ error: 'unauthorized' }, 401);
  /* pas ná de poort, zodat een aanroeper zonder toegang altijd hetzelfde
     antwoord krijgt: een body die geen object is, is een nette 400 */
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad-json' }, 400);

  var to = typeof body.to === 'string' ? body.to.trim() : '';
  /* het onderwerp wordt een mailkop: nooit een regeleinde erin, anders is
     een tweede kopregel erbij te schrijven zodra er ooit een andere
     verzender achter zit dan de JSON-API van Resend */
  var subject = typeof body.subject === 'string'
    ? body.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 140) : '';
  var bodyLine = typeof body.bodyLine === 'string' ? body.bodyLine.trim().slice(0, MAX_LEN) : '';
  var bodyText = typeof body.bodyText === 'string' ? body.bodyText.trim().slice(0, MAX_BODY_TEXT) : '';
  var portalUrlRaw = typeof body.portalUrl === 'string' ? body.portalUrl.trim() : '';
  if (!EMAIL_RE.test(to)) return json({ error: 'invalid-to' }, 400);
  /* bodyText is de fase 4-variant; is die er, dan mag bodyLine leeg zijn */
  if (!subject || (!bodyLine && !bodyText) || !portalUrlRaw) return json({ error: 'missing-fields' }, 400);
  /* zie het blok "DE KNOP IN DE MAIL": de oorsprong komt uit de omgeving */
  var portalUrl = safePortalUrl(portalUrlRaw);
  if (!portalUrl) {
    return json({
      error: 'portal-url-geweigerd',
      message: 'De knop in deze mail mag alleen naar het eigen portaal wijzen. ' +
        'Stuur een pad mee, of een adres op de oorsprong uit PORTAL_BASE_URL ' +
        '(of uit PORTAL_URL_EXTRA_ORIGINS).'
    }, 400);
  }

  /* ---- fase 4: cc, bcc, gegevensstrook en bijlage ----
     Alle vier optioneel. Een ongeldig cc-adres is geen reden om de hele
     mail te laten sneuvelen — hij wordt stil weggelaten en het aantal
     verwerkte adressen komt in het antwoord terug, zodat het beheer kan
     loggen wat er werkelijk de deur uit ging. */
  function addressList(v) {
    var arr = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(/[,;]+/) : []);
    var out = [];
    for (var i = 0; i < arr.length && out.length < MAX_CC; i++) {
      var a = String(arr[i] || '').trim();
      if (a && EMAIL_RE.test(a) && a.toLowerCase() !== to.toLowerCase() && out.indexOf(a) < 0) out.push(a);
    }
    return out;
  }
  var cc = addressList(body.cc);
  var bcc = addressList(body.bcc);

  var facts = [];
  if (Array.isArray(body.facts)) {
    for (var fi = 0; fi < body.facts.length && facts.length < MAX_FACTS; fi++) {
      var f = body.facts[fi];
      if (!f || typeof f.label !== 'string' || typeof f.value !== 'string') continue;
      var lab = f.label.trim().slice(0, 40);
      var val = f.value.trim().slice(0, 60);
      if (lab && val) facts.push({ label: lab, value: val });
    }
  }

  var attachment = null;
  if (body.attachment && typeof body.attachment === 'object') {
    var fn = typeof body.attachment.filename === 'string' ? body.attachment.filename.trim() : '';
    var b64 = typeof body.attachment.contentBase64 === 'string' ? body.attachment.contentBase64 : '';
    /* de bestandsnaam gaat als kop de mail in: alleen wat een bestandsnaam
       hoort te zijn, nooit een pad of een regeleinde */
    fn = fn.replace(/[\\/\r\n"<>]/g, '').slice(0, 120);
    if (!fn || !b64) return json({ error: 'invalid-attachment' }, 400);
    if (b64.length > MAX_ATTACHMENT_B64) return json({ error: 'attachment-too-large' }, 413);
    if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) return json({ error: 'invalid-attachment' }, 400);
    attachment = { filename: fn, content: b64.replace(/\s+/g, '') };
  }

  /* taal (functie 30 + contactpersoon-taal 26): default nl */
  var lang = (typeof body.lang === 'string' && MAIL_LANGS[body.lang.toLowerCase()]) ? body.lang.toLowerCase() : 'nl';

  /* ---- advies 35: de mail spreekt de taal van het portaal ----
     Wat het beheer meestuurt is al vertaald, maar het kan beheerstaal
     bevatten ('partially_paid', 'Deels betaald', 'Verlopen'), bedragen met
     lege centen ('€ 3.125,00') en lange of ISO-datums. Dat wordt hier, in
     de taal van de ontvanger, omgezet naar wat zijn portaal ook zegt: een
     van de vier woorden, '€ 3.125' en '24 apr 2026'. De interne code
     verlaat de server alleen als een telling in het antwoord (vertaald),
     zodat het beheer in het logboek kan zien dat er iets is rechtgezet. */
  var T = statusT(lang);
  var vertaald = MAIL.telInterneStatus(subject) + MAIL.telInterneStatus(bodyLine) + MAIL.telInterneStatus(bodyText);
  subject = MAIL.mailTekstVoorKlant(subject, lang, T).slice(0, 140);
  bodyLine = MAIL.mailTekstVoorKlant(bodyLine, lang, T).slice(0, MAX_LEN);
  bodyText = MAIL.mailTekstVoorKlant(bodyText, lang, T).slice(0, MAX_BODY_TEXT);
  facts = facts.map(function (f) {
    if (MAIL.woordVoorCode(f.value)) vertaald++;
    return { label: f.label, value: MAIL.mailWaardeVoorKlant(f.value, lang, T) };
  }).filter(function (f) { return !!f.value; });

  /* Stuurt het beheer de factuurrij mee, dan bouwt de server de standregel
     zelf met dezelfde vertaler als portal.html — en die wint van een
     'Stand'-rij die de aanroeper al had ingevuld. Een concept levert geen
     regel op; dan verandert er niets aan de strook. */
  var standFact = null;
  if (body.invoice && typeof body.invoice === 'object' && !Array.isArray(body.invoice)) {
    standFact = MAIL.statusFact(MAIL.klantStatus(body.invoice, new Date().toISOString()), lang, T);
  }
  if (standFact) {
    facts = facts.filter(function (f) { return f.label !== standFact.label; }).slice(0, MAX_FACTS - 1);
    facts.push(standFact);
  }

  var data = {
    to: to,
    subject: subject,
    bodyLine: bodyLine,
    bodyText: bodyText,
    facts: facts,
    portalUrl: portalUrl,
    lang: lang,
    portalLabel: typeof body.portalLabel === 'string' && body.portalLabel.trim() ? body.portalLabel.trim().slice(0, 60) : '',
    clientName: typeof body.clientName === 'string' ? body.clientName.trim().slice(0, 80) : '',
    projectName: typeof body.projectName === 'string' ? body.projectName.trim().slice(0, 120) : '',
    projectCode: typeof body.projectCode === 'string' ? body.projectCode.trim().slice(0, 40) : ''
  };

  /* afzenderblok (functie 64): optionele from-naam en reply-to uit de
     beheerinstellingen. De from-naam wordt alleen vóór het adres gezet als
     RESEND_FROM een kaal e-mailadres is (staat er al 'Naam <adres>' in de
     env var, dan wint die); een ongeldige reply-to wordt stil genegeerd. */
  var fromName = typeof body.fromName === 'string' ? body.fromName.trim().slice(0, 80).replace(/[<>"\r\n]/g, '') : '';
  var replyTo = typeof body.replyTo === 'string' ? body.replyTo.trim().slice(0, 120) : '';
  var fromHeader = (fromName && EMAIL_RE.test(from)) ? fromName + ' <' + from + '>' : from;

  var payload = {
    from: fromHeader,
    to: [data.to],
    subject: data.subject,
    html: renderHtml(data),
    text: renderText(data)
  };
  if (EMAIL_RE.test(replyTo)) payload.reply_to = [replyTo];
  if (cc.length) payload.cc = cc;
  if (bcc.length) payload.bcc = bcc;
  if (attachment) payload.attachments = [attachment];

  var upstream;
  try {
    upstream = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return json({ error: 'upstream-unreachable' }, 502);
  }
  if (!upstream.ok) {
    var errText = '';
    try { errText = await upstream.text(); } catch (e) { /* negeer */ }
    return json({ error: 'upstream-' + upstream.status, detail: errText.slice(0, 300) }, 502);
  }
  /* golf 3 (mail-logboek, functie 62): geef het Resend message-id terug,
     zodat het beheer per verstuurde mail een bewijsbaar id kan loggen.
     Ontbreekt het id in de respons, dan blijft ok:true gewoon staan —
     het beheer labelt de bezorgstatus dan eerlijk als 'nog onbekend'. */
  var upstreamBody = null;
  try { upstreamBody = await upstream.json(); } catch (e) { /* negeer */ }
  /* fase 4: cc/bcc/attached komen terug zodat het beheer kan LOGGEN wat er
     werkelijk is verstuurd, niet wat het dacht te versturen. Een cc-adres
     dat hier stil is weggelaten omdat het ongeldig was, staat dan ook niet
     in de tijdlijn als verstuurd. */
  return json({
    ok: true,
    id: (upstreamBody && typeof upstreamBody.id === 'string') ? upstreamBody.id : '',
    cc: cc.length,
    bcc: bcc.length,
    attached: !!attachment,
    /* advies 35: hoeveel stukjes beheerstaal er zijn rechtgezet en welke
       standregel de klant heeft gelezen — voor het mail-logboek */
    vertaald: vertaald,
    stand: standFact ? standFact.value : ''
  });
}
