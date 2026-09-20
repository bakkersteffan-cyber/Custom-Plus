/* CUSTOM+ — Resend-webhook: bezorgstatus, bounces en klachten.
   ------------------------------------------------------------------
   WAAROM DEZE FUNCTIE BESTAAT
   Verzenden weten we zelf: Resend antwoordt op elke verzendaanroep met
   een message-id, en dat id schrijft het beheer weg als 'sent'. Of de
   mail ook is AANGEKOMEN weten we niet — dat vertelt alleen de
   ontvangende mailserver, en Resend geeft dat door via een webhook.

   Zonder deze webhook toont de factuurtijdlijn dus eerlijk
   "verstuurd — bezorgstatus onbekend". Dat is geen gebrek dat wordt
   weggepoetst: het is precies wat er dan bekend is.

   ------------------------------------------------------------------
   DE EIGENAAR MOET DIT ÉÉNMALIG AANZETTEN
   In het Resend-dashboard: Webhooks → Add Webhook →
     endpoint  https://<jouw-site>/.netlify/functions/resend-webhook
     events    email.sent, email.delivered, email.bounced, email.complained
               (email.opened en email.clicked alleen als je de
                openingsregistratie bewust aanzet — zie onder)
   Resend toont daarna een signing secret dat begint met 'whsec_'. Zet dat
   als RESEND_WEBHOOK_SECRET in de Netlify-omgeving, samen met SUPABASE_URL
   en SUPABASE_SERVICE_ROLE_KEY.

   Zolang die drie er niet zijn, antwoordt deze functie 503 en verandert er
   niets. Ook staat er dan geen halfgeconfigureerd open eindpunt live.

   ------------------------------------------------------------------
   DRIE DINGEN DIE HIER HARD ZIJN

   1. HANDTEKENING. Resend tekent via Svix: HMAC-SHA256 over
      "<svix-id>.<svix-timestamp>.<ruwe body>" met de base64-gedecodeerde
      helft van het secret. Klopt de handtekening niet, dan gebeurt er
      niets — 401, geen rij, geen log met inhoud. Een webhook zonder
      handtekeningcontrole is een formulier waarmee iedereen op internet
      jouw factuurtijdlijn kan schrijven.

   2. IDEMPOTENT. De svix-id is de sleutel; dezelfde gebeurtenis die drie
      keer wordt afgeleverd (en dat gebeurt, retries horen bij webhooks)
      landt precies één keer. Dat is een unieke index in de database
      (0011_factuurmail.sql), niet een controle in code — een controle in
      code verliest van twee gelijktijdige afleveringen.

   3. OPENINGEN ALLEEN OP EXPLICIET VERZOEK. email.opened en email.clicked
      worden standaard WEGGEGOOID, ook als Resend ze stuurt. Zie onder.

   ------------------------------------------------------------------
   WAAROM DE OPENINGSREGISTRATIE STANDAARD UIT STAAT
   Een 'geopend'-melding werkt met een onzichtbare afbeelding van 1 bij 1
   pixel in de mail. Dat betekent: je laadt bij je klant een bestand van
   een server om te registreren dat hij zit te lezen, zonder dat hij dat
   weet of erom heeft gevraagd. Bovendien liegt het cijfer beide kanten
   op — mailclients die beelden blokkeren melden nooit een opening, en
   scanners die elke mail vooraf openen melden er juist een die er niet
   was.

   Het staat er wél, want de spec vraagt erom, maar als expliciete
   instelling (admin_settings.factuur_openingsregistratie) die standaard
   uit is. Uit betekent hier écht uit: de gebeurtenis wordt niet
   weggeschreven, ook niet 'voor later'.
   ------------------------------------------------------------------ */

import { createHmac, timingSafeEqual } from 'node:crypto';
import * as mailModule from '../../portal/invoice-mail.js';

const MAIL = (mailModule && mailModule.default) || globalThis.CP_INVOICE_MAIL;

/* Svix accepteert een bericht tot vijf minuten oud; ouder betekent een
   herhaalde aflevering van iets uit het verleden (replay). */
const TOLERANCE_SECONDS = 5 * 60;
const MAX_BODY_BYTES = 128 * 1024;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

/* base64 naar bytes zonder Buffer-aannames */
function b64ToBytes(b64) {
  const bin = atob(String(b64 || '').replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}

/* De Svix-verificatie, letterlijk zoals de standaard hem beschrijft.
   svix-signature bevat één of meer handtekeningen, spatie-gescheiden, elk
   in de vorm "v1,<base64>"; er hoeft er maar één te kloppen (dat maakt het
   roteren van een secret mogelijk zonder gemiste berichten). */
function verifySvix(secret, headers, rawBody) {
  const id = headers.get('svix-id') || headers.get('webhook-id') || '';
  const timestamp = headers.get('svix-timestamp') || headers.get('webhook-timestamp') || '';
  const signature = headers.get('svix-signature') || headers.get('webhook-signature') || '';
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing-headers' };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad-timestamp' };
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > TOLERANCE_SECONDS) return { ok: false, reason: 'stale-timestamp' };

  const raw = String(secret).startsWith('whsec_') ? String(secret).slice(6) : String(secret);
  let key;
  try { key = Buffer.from(b64ToBytes(raw)); } catch { return { ok: false, reason: 'bad-secret' }; }

  const signed = id + '.' + timestamp + '.' + rawBody;
  const expected = createHmac('sha256', key).update(signed, 'utf8').digest('base64');

  const parts = String(signature).split(' ');
  for (const part of parts) {
    const idx = part.indexOf(',');
    if (idx < 0) continue;
    const version = part.slice(0, idx);
    const value = part.slice(idx + 1);
    if (version !== 'v1') continue;
    if (safeEqual(value, expected)) return { ok: true, eventId: id };
  }
  return { ok: false, reason: 'bad-signature' };
}

/* ---- Supabase, met de service role. Geen client-library: twee fetches. ---- */
function sbHeaders(key) {
  return {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  };
}

async function readSetting(url, key, name) {
  try {
    const res = await fetch(url + '/rest/v1/admin_settings?select=value&key=eq.' + encodeURIComponent(name), {
      headers: sbHeaders(key)
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return (rows && rows[0] && rows[0].value) || null;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const sbUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  /* Health-check, net als de andere twee functies: verklapt alleen ÓF de
     webhook aan kan staan, nooit een sleutel. De beheerpagina gebruikt dit
     om eerlijk te tonen of bezorgstatus überhaupt kan werken. */
  if (req.method === 'GET') {
    return json({ configured: !!(secret && sbUrl && sbKey) }, 200);
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!secret || !sbUrl || !sbKey) return json({ error: 'not-configured' }, 503);

  let raw;
  try { raw = await req.text(); } catch { return json({ error: 'bad-body' }, 400); }
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'body-too-large' }, 413);

  /* EERST de handtekening, DAARNA pas parsen. Een payload waarvan de
     herkomst niet vaststaat, verdient geen JSON.parse en al helemaal geen
     databaseverbinding. */
  const check = verifySvix(secret, req.headers, raw);
  if (!check.ok) return json({ error: 'unauthorized', reason: check.reason }, 401);

  let payload;
  try { payload = JSON.parse(raw); } catch { return json({ error: 'bad-json' }, 400); }

  /* de openingsregistratie: standaard uit, en 'uit' betekent weggooien */
  const openSetting = await readSetting(sbUrl, sbKey, 'factuur_openingsregistratie');
  const allowOpen = !!(openSetting && openSetting.aan === true);

  const evt = MAIL.normalizeResendEvent(payload, { eventId: check.eventId, allowOpen: allowOpen });
  if (!evt) {
    /* Bewust genegeerd (onbekend type, delivery_delayed, of een opening
       terwijl de registratie uit staat). 200, want dit is geen fout en
       Resend hoeft niet opnieuw te proberen. */
    return json({ ok: true, ignored: true }, 200);
  }
  if (!evt.messageId) return json({ ok: true, ignored: true, reason: 'geen-message-id' }, 200);

  /* record_mail_event() zoekt de factuur op via het message-id dat wij bij
     het verzenden zelf hebben weggeschreven, en negeert een gebeurtenis
     die er al staat. Beide in één databaseronde: zie 0011_factuurmail.sql. */
  let result;
  try {
    const res = await fetch(sbUrl + '/rest/v1/rpc/record_mail_event', {
      method: 'POST',
      headers: sbHeaders(sbKey),
      body: JSON.stringify({
        p_provider_event_id: evt.eventId,
        p_message_id: evt.messageId,
        p_event: evt.event,
        p_recipient: evt.recipient,
        p_detail: evt.detail,
        p_subject: evt.subject,
        p_occurred_at: evt.occurredAt
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      /* 500 zodat Resend het opnieuw probeert: dit is een fout aan onze
         kant, niet aan die van de afzender. */
      return json({ error: 'db-' + res.status, detail: text.slice(0, 200) }, 500);
    }
    result = await res.json().catch(() => null);
  } catch (e) {
    return json({ error: 'db-unreachable' }, 500);
  }

  return json({ ok: true, event: evt.event, result: result || 'onbekend' }, 200);
}
