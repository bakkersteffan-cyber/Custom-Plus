/* CUSTOM+ — server-side factuurcontrole.
   ------------------------------------------------------------------
   De spec is hier kort en hard: "Bedragen en btw ook server-side
   controleren" en "herbereken alle bedragen server-side" als stap 2 van
   definitief maken. Deze functie doet precies dat en niets meer: hij
   ontvangt een factuurpayload, gooit de meegestuurde totalen weg,
   herberekent alles met dezelfde portal/invoice-core.js die de browser
   gebruikt, en geeft terug wat er volgens de server uit komt.

   Waarom dit iets toevoegt terwijl de browser al rekende: alles wat in de
   browser draait, kan in de browser worden aangepast. Een totaal dat pas
   telt als de server het opnieuw heeft uitgerekend, is een totaal dat je
   kunt verdedigen. Wijkt de client af, dan komt er een harde fout
   'totalen_wijken_af' terug en mag de factuur niet definitief worden.

   AUTHENTICATIE — GEWIJZIGD, ZIE HET BLOK "DE POORT" HIERONDER.
   Tot deze wijziging was het gedeelde geheim de enige poort, en dat geheim
   stond in portal/config.js: een bestand dat netlify.toml meepubliceert.
   Nu verifieert de functie de IDENTITEIT van de aanroeper server-side; het
   geheim blijft alleen over voor aanroepen zonder sessie. Geen enkele
   omgevingsvariabele ingesteld = de functie is uit (503), zodat er nooit
   een halfgeconfigureerde open rekenmachine live staat.
     GET   → { configured: true|false }   (geen geheim nodig; verklapt niets)
     POST  Authorization: Bearer <supabase-sessietoken>   (of: { secret })
           { invoice, intent?, claimedTotals?, toleranceCents? }
             → { ok, totals, groups, lines, errors[], warnings[], version }

   WAT beheer.html NOG MOET AANPASSEN (aparte, kleine wijziging — dit
   bestand mag beheer.html niet aanraken):
     In invFinalizeSteps → recompute (rond regel 16900) het sessietoken
     meesturen als kopregel:

       return window.__cpSb.auth.getSession().then(function(s){
         var tok = s && s.data && s.data.session && s.data.session.access_token;
         return fetch('/.netlify/functions/invoice-validate', {
           method: 'POST',
           headers: tok
             ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }
             : { 'Content-Type': 'application/json' },
           body: JSON.stringify({ invoice: payload, intent: 'finalize', claimedTotals: {…} })
         });
       });

     Het veld `secret` mag daarbij uit de body verdwijnen, en de bewaking
     `if(DS.mode === 'demo' || !CFG.notifySharedSecret)` moet worden
     `if(DS.mode === 'demo')` — anders staat de servercontrole uit zodra
     het geheim uit portal/config.js weg is.

   BTW-TABEL EN BETAALTOLERANTIE KOMEN NIET MEER UIT DE REQUEST.
   Ze worden hieronder uit de database gelezen (tax_codes uit 0008,
   admin_settings.factuur_betalingen uit 0012), met de standaardtabel uit
   portal/invoice-core.js als terugval. Zie de blokken "DE EIGEN BTW-TABEL"
   en "DE EIGEN BETAALTOLERANTIE".

   EERLIJKE AFWIJKING — DEMOMODUS.
   In demomodus bestaat er geen server. Daar draait exact dezelfde
   invoice-core in de browser en toont de UI dat ook met zoveel woorden
   ("in de live-omgeving wordt dit ook op de server gecontroleerd").
   In Supabase-modus is de serverbevestiging verplicht vóór definitief
   maken. Zie docs/factuurmodule.md.
   ------------------------------------------------------------------ */

/* De rekenkern is één bestand voor browser én server. Het zet zichzelf op
   globalThis EN op module.exports; we lezen allebei, zodat het werkt of
   het bestand nu als CommonJS of als ESM wordt geladen. De import is een
   side-effect-import met een namespace-binding, zodat een bundler hem
   nooit wegsnoeit. */
import * as coreModule from '../../portal/invoice-core.js';

const CORE = (coreModule && coreModule.default) || globalThis.CP_INVOICE;

/* harde grenzen: dit is een publiek endpoint, geen rekencluster */
const MAX_BODY_BYTES = 512 * 1024;
const MAX_LINES = 500;
const MAX_SURCHARGES = 50;
const MAX_PAYMENTS = 200;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

/* ==================================================================
   DE POORT — WIE MAG DEZE FUNCTIE AANROEPEN
   ==================================================================
   Er zijn precies twee toegelaten aanroepers, in deze volgorde:

     1. EEN INGELOGD STAFLID. De browser stuurt zijn Supabase-sessietoken
        mee als 'Authorization: Bearer …'. Wij vragen Supabase met de
        service-role-sleutel uit de omgeving WIE dat token is, en kijken
        daarna in staff_users of die gebruiker echt staf is. Beide stappen
        gebeuren hier, op de server; de browser kan er niets aan sturen.

     2. EEN AANROEP ZONDER SESSIE — een cron of een webhook — met het
        gedeelde geheim NOTIFY_SHARED_SECRET.

   WAAROM DEZE POORT ER IS, EN WAT ER MISGAAT ALS HIJ WEG IS.
   Tot deze wijziging was (2) de enige poort en stond dat geheim in
   portal/config.js — een bestand dat netlify.toml als onderdeel van de
   publieke site uitserveert en dat beheer.html, portal.html én
   factuur.html alle drie laden. Iedereen kon het dus gewoon ophalen, en
   daarmee deze rekenmachine, de AI-functie en de mailfunctie aanroepen.
   Een geheim dat de browser moet meesturen is per definitie geen geheim.
   Valt deze poort helemaal weg, dan is het adres van de functie genoeg om
   er onbeperkt op te rekenen — en bij notify-client.mjs zelfs om namens
   ons mail te versturen.

   ZOLANG DE OVERGANG LOOPT worden BEIDE geaccepteerd: beheer.html stuurt
   nu nog het geheim en nog geen token. Zodra beheer.html het token
   meestuurt (zie het kopblok) hoort het geheim alleen nog bij (2) te
   horen en mag het uit portal/config.js blijven.

   Een token dat niet deugt of niet van een staflid is, valt stil door
   naar (2) en eindigt dus als een gewone 401. Bewust: het antwoord mag
   niet verklappen of een account bestaat of staf is. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/* een JWT is drie base64url-delen met punten ertussen. Meer hoeft deze
   vormcontrole niet te weten: hij bestaat alleen om onzin niet naar
   Supabase door te sturen. De ECHTE controle doet Supabase. */
const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const BEARER_RE = /^Bearer\s+(\S+)$/i;

function supabaseEnv() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return (url && key) ? { url, key } : null;
}

function serviceHeaders(key) {
  return { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
}

function bearerToken(req) {
  const raw = String(req.headers.get('authorization') || '').trim();
  const m = raw.match(BEARER_RE);
  const tok = m ? m[1] : '';
  return (tok.length <= 4096 && JWT_RE.test(tok)) ? tok : '';
}

/* Gelijk vergelijken zonder de lengte van het gemeenschappelijke voorvoegsel
   te verklappen. Over een netwerk is dat verschil verdronken in ruis, maar
   het kost hier niets om het goed te doen. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Geeft het gebruikers-id terug als dit token van een STAFLID is, en
   anders een lege string. Gooit nooit; een onbereikbare Supabase is geen
   toegang. */
async function staffUserId(env, token) {
  let user = null;
  try {
    const who = await fetch(env.url + '/auth/v1/user', {
      headers: { apikey: env.key, Authorization: 'Bearer ' + token }
    });
    if (!who.ok) return '';
    user = await who.json();
  } catch { return ''; }
  const uid = (user && typeof user.id === 'string') ? user.id : '';
  if (!UUID_RE.test(uid)) return '';
  try {
    /* met de service-role-sleutel, dus zonder RLS ertussen: we vragen niet
       of DEZE gebruiker de stafregels mag lezen, we vragen of hij erin
       staat. is_staff() zou hetzelfde antwoord geven, maar dan afhankelijk
       van een policy die iemand anders kan wijzigen. */
    const res = await fetch(
      env.url + '/rest/v1/staff_users?select=user_id&limit=1&user_id=eq.' + encodeURIComponent(uid),
      { headers: serviceHeaders(env.key) });
    if (!res.ok) return '';
    const rows = await res.json();
    return (Array.isArray(rows) && rows.length) ? uid : '';
  } catch { return ''; }
}

async function checkCaller(req, body) {
  const env = supabaseEnv();
  const token = bearerToken(req);
  if (token && env) {
    const uid = await staffUserId(env, token);
    if (uid) return { ok: true, via: 'sessie', userId: uid };
  }
  const secret = process.env.NOTIFY_SHARED_SECRET;
  if (secret && body && sameSecret(String(body.secret || ''), secret)) {
    return { ok: true, via: 'geheim', userId: '' };
  }
  return { ok: false, via: '', userId: '' };
}

/* ==================================================================
   DE EIGEN BTW-TABEL VAN DE SERVER
   ==================================================================
   Hiervóór nam cleanInvoice() raw.taxCodes over uit de request. Daarmee
   kwamen rateMilli en treatment uit dezelfde browser die dit endpoint moet
   wantrouwen: wie 21% in 0% veranderde kreeg gewoon een akkoord terug, en
   de hele server-side controle was een formaliteit.

   De server gebruikt nu zijn eigen tabel: tax_codes uit 0008_invoices.sql.
   Is er geen database bereikbaar of staat de tabel leeg, dan geldt
   CORE.DEFAULT_TAX_CODES — de vaste standaardreeks uit
   portal/invoice-core.js. Beide terugvallen zijn van ONS; er is geen enkel
   pad meer waarlangs de client het tarief bepaalt.

   Een btw-code die de client op een regel zet en die in deze tabel niet
   voorkomt, levert vanzelf de fout 'btwcode_onbekend' op uit computeLine()
   — precies wat de bedoeling is: een onbekende code is een fout, geen
   reden om de client te geloven.

   De tabel wordt maximaal een minuut vastgehouden. Een serverloze functie
   wordt tussen aanroepen hergebruikt, dus zonder cache is elke
   factuurcontrole een extra databaseronde; een minuut is kort genoeg dat
   een gewijzigd tarief meteen meetelt. */
const DB_CACHE_MS = 60 * 1000;
let taxCache = { at: 0, codes: null };
let tolCache = { at: 0, cents: null };

async function serverTaxCodes() {
  const fallback = (CORE && CORE.DEFAULT_TAX_CODES) || [];
  const env = supabaseEnv();
  if (!env) return fallback;
  const now = Date.now();
  if (taxCache.codes && (now - taxCache.at) < DB_CACHE_MS) return taxCache.codes;
  try {
    const res = await fetch(
      env.url + '/rest/v1/tax_codes?select=code,label,rate_milli,treatment,active&order=sort.asc',
      { headers: serviceHeaders(env.key) });
    if (!res.ok) return fallback;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return fallback;
    const codes = rows.map((r) => ({
      code: String((r && r.code) || ''),
      label: String((r && (r.label || r.code)) || ''),
      rateMilli: Math.round(Number(r && r.rate_milli) || 0),
      treatment: String((r && r.treatment) || 'standard'),
      active: !(r && r.active === false)
    })).filter((c) => c.code !== '');
    if (!codes.length) return fallback;
    taxCache = { at: now, codes: codes };
    return codes;
  } catch {
    return fallback;
  }
}

/* ==================================================================
   DE EIGEN BETAALTOLERANTIE VAN DE SERVER
   ==================================================================
   Hiervóór kwam toleranceCents uit de body. Een tolerantie is een bewuste
   instelling en nooit een stilzwijgende aanname van de aanroeper: wie hem
   zelf mag kiezen, verklaart elke factuur betaald. De database doet het al
   goed (invoice_tolerance_cents() in 0012_betalingen.sql leest
   admin_settings.factuur_betalingen); deze functie leest nu exact dezelfde
   rij, zodat er één plek is waar dat getal staat.

   De waarde uit de request wordt alleen nog geaccepteerd als hij KLEINER
   is dan de ingestelde — dat is een strengere voorbeeldberekening en kan
   dus nooit iets goedkeuren wat de instelling afkeurt. Alles daarboven
   wordt genegeerd. Kan de instelling niet worden gelezen, dan geldt 0: de
   strengste stand, nooit de ruimste. */
async function serverToleranceCents() {
  const env = supabaseEnv();
  if (!env) return 0;
  const now = Date.now();
  if (tolCache.cents !== null && (now - tolCache.at) < DB_CACHE_MS) return tolCache.cents;
  try {
    const res = await fetch(
      env.url + '/rest/v1/admin_settings?select=value&limit=1&key=eq.factuur_betalingen',
      { headers: serviceHeaders(env.key) });
    if (!res.ok) return 0;
    const rows = await res.json();
    const value = (Array.isArray(rows) && rows[0]) ? rows[0].value : null;
    const n = Number(value && value.tolerantieCents);
    const cents = (Number.isFinite(n) && n > 0) ? Math.round(n) : 0;
    tolCache = { at: now, cents: cents };
    return cents;
  } catch {
    return 0;
  }
}

/* Alleen de velden die de rekenkern en de validatie kennen gaan door.
   Alles wat de client verder meestuurt blijft buiten — een payload is
   invoerdata, geen instructie. */
function str(v, max) {
  return typeof v === 'string' ? v.slice(0, max || 400) : '';
}
function intOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function party(p) {
  p = p || {};
  return {
    name: str(p.name, 200),
    tradeName: str(p.tradeName, 200),
    contact: str(p.contact, 200),
    address: str(p.address, 400),
    deliveryAddress: str(p.deliveryAddress, 400),
    email: str(p.email, 200),
    registrationNumber: str(p.registrationNumber, 60),
    vatNumber: str(p.vatNumber, 60)
  };
}
function cleanLine(l) {
  l = l || {};
  return {
    id: str(l.id, 60),
    type: str(l.type, 20) || 'item',
    description: str(l.description, 600),
    detail: str(l.detail, 2000),
    unit: str(l.unit, 40),
    ledgerRef: str(l.ledgerRef, 60),
    productRef: str(l.productRef, 60),
    sort: intOrNull(l.sort) || 0,
    quantityMicro: intOrNull(l.quantityMicro),
    quantity: (typeof l.quantity === 'string' || typeof l.quantity === 'number') ? l.quantity : undefined,
    unitPriceCents: intOrNull(l.unitPriceCents),
    unitPrice: (typeof l.unitPrice === 'string' || typeof l.unitPrice === 'number') ? l.unitPrice : undefined,
    priceIncludesVat: l.priceIncludesVat === true ? true : (l.priceIncludesVat === false ? false : undefined),
    discountType: str(l.discountType, 20) || 'none',
    discountValue: intOrNull(l.discountValue),
    taxCode: str(l.taxCode, 40)
  };
}
function cleanInvoice(raw) {
  raw = raw || {};
  const lines = Array.isArray(raw.lines) ? raw.lines.slice(0, MAX_LINES).map(cleanLine) : [];
  const surcharges = Array.isArray(raw.surcharges)
    ? raw.surcharges.slice(0, MAX_SURCHARGES).map((s) => ({
        label: str(s && s.label, 200),
        amountCents: intOrNull(s && s.amountCents),
        taxCode: str(s && s.taxCode, 40)
      }))
    : [];
  const payments = Array.isArray(raw.payments)
    ? raw.payments.slice(0, MAX_PAYMENTS).map((p) => ({ amountCents: intOrNull(p && p.amountCents) || 0 }))
    : [];
  const credits = Array.isArray(raw.credits)
    ? raw.credits.slice(0, MAX_PAYMENTS).map((c) => ({ amountCents: intOrNull(c && c.amountCents) || 0 }))
    : [];
  /* raw.taxCodes wordt BEWUST NIET overgenomen. De btw-tabel komt van de
     server (serverTaxCodes()) en wordt in de handler ingevuld; wat de
     client over tarieven beweert, doet hier niet meer mee. */

  return {
    status: str(raw.status, 30) || 'draft',
    invoiceNumber: str(raw.invoiceNumber, 60),
    administration: str(raw.administration, 60),
    currency: str(raw.currency, 8) || 'EUR',
    rateToEur: (raw.rateToEur === undefined || raw.rateToEur === null || raw.rateToEur === '')
      ? null : Number(raw.rateToEur),
    language: str(raw.language, 8),
    template: str(raw.template, 60),
    invoiceDate: str(raw.invoiceDate, 30),
    dueDate: str(raw.dueDate, 30),
    deliveryStart: str(raw.deliveryStart, 30),
    deliveryEnd: str(raw.deliveryEnd, 30),
    paymentTermDays: intOrNull(raw.paymentTermDays),
    clientReference: str(raw.clientReference, 120),
    purchaseOrder: str(raw.purchaseOrder, 120),
    costCenter: str(raw.costCenter, 120),
    seller: party(raw.seller),
    buyer: party(raw.buyer),
    pricesIncludeVat: raw.pricesIncludeVat === true,
    discount: {
      type: str(raw.discount && raw.discount.type, 20) || 'none',
      value: intOrNull(raw.discount && raw.discount.value)
    },
    taxCodes: undefined,
    lines: lines,
    surcharges: surcharges,
    payments: payments,
    credits: credits
  };
}

/* ==================================================================
   WAT DE SERVER HIERNA NOG STEEDS VAN DE CLIENT AANNEEMT
   ==================================================================
   Btw-tabel en tolerantie komen nu van de server. Deze drie waarden nog
   niet, en dat staat hier zwart op wit zodat niemand denkt dat dit
   endpoint alles narekent:

     invoice.status      gaat naar canTransition() bij intent 'finalize'.
                         Een aanroeper die 'draft' beweert terwijl de rij
                         in de database al 'sent' of 'paid' is, glipt langs
                         die overgangscontrole. Te sluiten door het
                         factuur-id mee te sturen en status_code hier uit
                         invoices te lezen. BEWUST NOG NIET GEDAAN: dan
                         moet ook worden afgesproken wat er gebeurt als die
                         databaseronde faalt, en dat raakt de
                         definitief-maken-stroom in beheer.html — een
                         bestand dat deze wijziging niet mag aanraken. Een
                         halve poort is erger dan een beschreven poort.
                         De btw-tabel en de tolerantie mochten wél nu al,
                         omdat hun terugval (standaardtabel, tolerantie 0)
                         strenger is dan de client; een statusterugval is
                         dat niet.

     invoice.payments/   de reeds betaalde en gecrediteerde bedragen. Ze
     invoice.credits     bepalen paidCents en dus de uitkomst van
                         settlement(). De echte bedragen staan in
                         invoice_payments; recalc_invoice_settlement() in
                         0012 rekent ze al server-side. Dit endpoint krijgt
                         ze aangereikt en controleert ze niet.

     invoice.rateToEur   de wisselkoers bij een niet-EUR-factuur. De
                         validatie eist alleen DAT er een koers staat, niet
                         dat hij klopt; zonder eigen koersbron kan de
                         server dat ook niet weten. Vermeld omdat het
                         hetzelfde patroon is.
   ================================================================== */

export default async function handler(req) {
  const secretConfigured = process.env.NOTIFY_SHARED_SECRET;

  /* GET vertelt alleen OF de controle beschikbaar is. Het beheer gebruikt
     dat om eerlijk te tonen of de serverbevestiging haalbaar is; er lekt
     geen enkel gegeven mee. */
  if (req.method === 'GET') {
    return json({
      configured: !!(secretConfigured && CORE),
      /* of de identiteitscontrole van gat 1 hier daadwerkelijk kan draaien.
         Geen sleutel, geen geheim, geen url — alleen ja of nee. */
      sessionAuth: !!supabaseEnv(),
      version: CORE ? CORE.VERSION : null
    }, 200);
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!secretConfigured) return json({ error: 'not-configured' }, 503);
  if (!CORE || typeof CORE.validateInvoice !== 'function') {
    /* liever een duidelijke 500 dan een factuur die stilzwijgend
       ongecontroleerd doorgaat */
    return json({ error: 'core-unavailable' }, 500);
  }

  let text;
  try { text = await req.text(); } catch { return json({ error: 'bad-body' }, 400); }
  if (text.length > MAX_BODY_BYTES) return json({ error: 'body-too-large' }, 413);

  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'bad-json' }, 400); }

  const caller = await checkCaller(req, body);
  if (!caller.ok) return json({ error: 'unauthorized' }, 401);
  /* pas ná de poort, zodat een aanroeper zonder toegang altijd hetzelfde
     antwoord krijgt: een body die geen object is, is een nette 400 */
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'bad-json' }, 400);

  const invoice = cleanInvoice(body.invoice);
  /* de btw-tabel van de SERVER, nooit die van de aanroeper */
  invoice.taxCodes = await serverTaxCodes();
  const intent = body.intent === 'finalize' ? 'finalize' : 'draft';

  /* de door de client BEWEERDE totalen — alleen om tegen af te zetten,
     nooit om over te nemen */
  let claimedTotals;
  if (body.claimedTotals && typeof body.claimedTotals === 'object') {
    claimedTotals = {};
    for (const k of ['totalExclCents', 'vatCents', 'totalInclCents']) {
      const v = intOrNull(body.claimedTotals[k]);
      if (v !== null) claimedTotals[k] = v;
    }
    if (!Object.keys(claimedTotals).length) claimedTotals = undefined;
  }

  let result;
  try {
    result = CORE.validateInvoice(invoice, { intent, claimedTotals });
  } catch (e) {
    return json({ error: 'compute-failed', detail: String(e && e.message).slice(0, 300) }, 500);
  }

  /* de tolerantie van de SERVER. Een kleinere wens uit de request mag,
     een grotere nooit — zie het blok "DE EIGEN BETAALTOLERANTIE". */
  const ingesteld = await serverToleranceCents();
  const gevraagd = intOrNull(body.toleranceCents);
  const tolerance = (gevraagd !== null && gevraagd >= 0 && gevraagd < ingesteld) ? gevraagd : ingesteld;
  const paid = CORE.settlement(result.totals, { toleranceCents: tolerance });

  return json({
    ok: result.ok,
    intent: result.intent,
    version: CORE.VERSION,
    /* welke tolerantie er werkelijk is gebruikt, zodat het beheer kan
       tonen waar het antwoord vandaan komt in plaats van het te raden */
    toleranceCents: tolerance,
    rounding: CORE.ROUNDING,
    totals: result.totals,
    settlement: paid,
    groups: result.groups.map((g) => ({
      taxCode: g.taxCode,
      rateMilli: g.rateMilli,
      treatment: g.treatment,
      legalNoteNl: g.legalNoteNl,
      baseCents: g.baseCents,
      vatCents: g.vatCents
    })),
    lines: result.lines.map((l) => ({
      index: l.index,
      id: l.id,
      type: l.type,
      counts: l.counts,
      taxCode: l.taxCode,
      rateMilli: l.rateMilli,
      treatment: l.treatment,
      grossExclCents: l.grossExclCents,
      discountExclCents: l.discountExclCents,
      netExclCents: l.netExclCents,
      vatCents: l.vatCents,
      inclCents: l.inclCents
    })),
    errors: result.errors,
    warnings: result.warnings
  }, 200);
}
