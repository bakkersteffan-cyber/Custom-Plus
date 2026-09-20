/* CUSTOM+ — de beveiligde klantpagina: het token verzilveren.
   ------------------------------------------------------------------
   factuur.html draait ZONDER login. Deze functie is de enige weg waarlangs
   die pagina aan gegevens komt, en het token is de hele sleutel.

   ------------------------------------------------------------------
   WAAROM EEN FUNCTIE EN GEEN RLS-POLICY

   De alternatieve opzet is: geef de anon-rol leesrecht op invoices en
   invoice_lines met een policy die zegt "alleen als je het juiste token in
   een header meestuurt". Dat werkt, maar het betekent dat de factuurtabel
   principieel benaderbaar wordt door iedereen op internet en dat alleen
   een policy-expressie ertussen staat. Eén vergeten USING op een tweede
   tabel, één view zonder security_invoker, en de hele boekhouding ligt op
   straat. Bovendien zou het token dan door de browser worden meegestuurd
   naar een endpoint dat de klant zelf kan aanroepen met wat hij wil.

   Deze opzet: de anon-rol heeft NUL rechten op de factuurtabellen. Deze
   functie draait met de service role (sleutel uitsluitend in de
   Netlify-omgeving), verzilvert het token in één databaseronde
   (redeem_invoice_token in 0011_factuurmail.sql) en geeft alleen terug wat
   CP_INVOICE_MAIL.clientView() doorlaat. Wat daar niet in staat, verlaat de
   server niet — de interne notitie en de interne tags dus nooit.

   ------------------------------------------------------------------
   WAT ER TEGEN RADEN BESCHERMT

   Het token is 32 bytes uit crypto.getRandomValues, weergegeven als 43
   base64url-tekens. Dat zijn 2^256 mogelijkheden; raden is geen aanval
   maar een rekensom die niet afloopt. Een fout token krijgt altijd
   hetzelfde korte antwoord ('ongeldig'), zodat er niets valt af te leiden
   uit het verschil tussen 'bestaat niet' en 'is ingetrokken' — behalve
   voor een token dat bestaat én van deze klant is, want die mag wél weten
   dat zijn link is ingetrokken of verlopen.

   Er zit bewust GEEN teller of blokkade op mislukte pogingen: die zou
   gedeelde staat vragen die deze serverloze opzet niet heeft, en tegen
   2^256 voegt hij niets toe. Dat is een bewuste keuze en geen omissie.

   ------------------------------------------------------------------
   ACTIES
     POST { token, action: 'view' }      → de factuurgegevens
     POST { token, action: 'pdf' }       → een 60 seconden geldige downloadlink
     POST { token, action: 'question', text } → landt in de bestaande
                                           vragenstroom (question_threads),
                                           precies waar de vragen uit het
                                           portaal ook landen
   ------------------------------------------------------------------ */

import * as mailModule from '../../portal/invoice-mail.js';

const MAIL = (mailModule && mailModule.default) || globalThis.CP_INVOICE_MAIL;

const MAX_BODY_BYTES = 8 * 1024;
const MAX_QUESTION = 1200;
const SIGNED_URL_SECONDS = 60;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      /* een antwoord met factuurgegevens mag nergens blijven hangen */
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Referrer-Policy': 'no-referrer'
    }
  });
}

function sbHeaders(key, extra) {
  const h = {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  };
  Object.keys(extra || {}).forEach((k) => { h[k] = extra[k]; });
  return h;
}

async function sbGet(url, key, path) {
  const res = await fetch(url + '/rest/v1/' + path, { headers: sbHeaders(key) });
  if (!res.ok) throw new Error('db-' + res.status);
  return res.json();
}

async function sbInsert(url, key, table, row) {
  const res = await fetch(url + '/rest/v1/' + table, {
    method: 'POST',
    headers: sbHeaders(key, { 'Prefer': 'return=minimal' }),
    body: JSON.stringify(row)
  });
  return res.ok;
}

/* De gebeurtenissenregistratie mag het openen van de pagina nooit
   blokkeren: als het logboek klapt, ziet de klant nog steeds zijn
   factuur. Andersom zou een klant die zijn rekening wil betalen worden
   tegengehouden door een administratief detail. */
async function logEvent(url, key, invoiceId, event, detail) {
  try {
    await sbInsert(url, key, 'invoice_email_events', {
      invoice_id: invoiceId,
      event: event,
      detail: String(detail || '').slice(0, 300)
    });
  } catch { /* stil */ }
}

export default async function handler(req) {
  const sbUrl = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    return json({ configured: !!(sbUrl && sbKey) }, 200);
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);
  if (!sbUrl || !sbKey) return json({ error: 'not-configured' }, 503);

  let raw;
  try { raw = await req.text(); } catch { return json({ error: 'bad-body' }, 400); }
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'body-too-large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad-json' }, 400); }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const action = typeof body.action === 'string' ? body.action : 'view';
  /* vorm eerst: een token dat niet eens de juiste lengte en het juiste
     alfabet heeft, hoeft de database niet te zien */
  if (!MAIL.tokenLooksValid(token)) return json({ ok: false, reason: 'ongeldig' }, 200);
  if (['view', 'pdf', 'question'].indexOf(action) < 0) return json({ error: 'bad-action' }, 400);

  let hash;
  try { hash = await MAIL.sha256Hex(token); } catch { return json({ error: 'no-crypto' }, 500); }

  /* verzilveren: lezen, geldigheid toetsen en aftekenen in één statement */
  let redeem;
  try {
    const res = await fetch(sbUrl + '/rest/v1/rpc/redeem_invoice_token', {
      method: 'POST',
      headers: sbHeaders(sbKey),
      body: JSON.stringify({
        p_hash: hash,
        p_user_agent: String(req.headers.get('user-agent') || '').slice(0, 300)
      })
    });
    if (!res.ok) return json({ error: 'db-' + res.status }, 500);
    const rows = await res.json();
    redeem = Array.isArray(rows) ? rows[0] : rows;
  } catch {
    return json({ error: 'db-unreachable' }, 500);
  }
  if (!redeem || !redeem.ok) {
    return json({ ok: false, reason: (redeem && redeem.reason) || 'ongeldig' }, 200);
  }
  const invoiceId = redeem.invoice_id;

  /* de factuur. Alleen de kolommen die de klantpagina nodig heeft: geen
     select *, want dan reist internal_note mee tot aan de laatste
     filterstap en is één vergeten regel genoeg om hem te lekken. */
  let inv;
  try {
    const rows = await sbGet(sbUrl, sbKey,
      'invoices?select=id,project_id,invoice_number,status_code,snapshot,pay_url,' +
      'pdf_path,pdf_filename,paid_cents,outstanding_cents,total_incl_cents,currency,due_date' +
      '&id=eq.' + encodeURIComponent(invoiceId));
    inv = rows && rows[0];
  } catch {
    return json({ error: 'db-unreachable' }, 500);
  }
  if (!inv) return json({ ok: false, reason: 'ongeldig' }, 200);
  if (!inv.snapshot) {
    /* geen snapshot = nooit definitief gemaakt. Er hoort dan ook geen
       klantlink te bestaan; als hij toch bestaat, tonen we niets. */
    return json({ ok: false, reason: 'niet_definitief' }, 200);
  }

  let projectName = '';
  try {
    const rows = await sbGet(sbUrl, sbKey,
      'projects?select=name&id=eq.' + encodeURIComponent(inv.project_id));
    projectName = (rows && rows[0] && rows[0].name) || '';
  } catch { /* een projectnaam is versiering, geen voorwaarde */ }

  const view = MAIL.clientView(inv.snapshot, {
    statusCode: inv.status_code,
    paidCents: typeof inv.paid_cents === 'number' ? inv.paid_cents : undefined,
    outstandingCents: typeof inv.outstanding_cents === 'number' ? inv.outstanding_cents : undefined,
    payUrl: inv.pay_url || '',
    projectName: projectName,
    pdfAvailable: !!inv.pdf_path
  });

  if (action === 'view') {
    await logEvent(sbUrl, sbKey, invoiceId, 'portal_viewed', 'klantpagina geopend');
    return json({ ok: true, invoice: view }, 200);
  }

  if (action === 'pdf') {
    if (!inv.pdf_path) return json({ ok: false, reason: 'geen_pdf' }, 200);
    let signed = '';
    try {
      const res = await fetch(sbUrl + '/storage/v1/object/sign/project-docs/' + inv.pdf_path, {
        method: 'POST',
        headers: sbHeaders(sbKey),
        body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.signedURL) signed = sbUrl + '/storage/v1' + data.signedURL;
      }
    } catch { /* val terug op de melding hieronder */ }
    if (!signed) return json({ ok: false, reason: 'geen_pdf' }, 200);
    await logEvent(sbUrl, sbKey, invoiceId, 'pdf_downloaded', inv.pdf_filename || '');
    return json({ ok: true, url: signed, filename: inv.pdf_filename || (view.invoiceNumber + '.pdf') }, 200);
  }

  /* action === 'question' — landt in de BESTAANDE vragenstroom, dezelfde
     tabel waar de vragen uit het portaal in komen. Een tweede postvak zou
     betekenen dat er een plek is waar een vraag onopgemerkt kan blijven. */
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_QUESTION) : '';
  if (!text) return json({ ok: false, reason: 'leeg' }, 200);
  const prefix = 'Factuur ' + (view.invoiceNumber || '') + ' — ';
  const okWrite = await sbInsert(sbUrl, sbKey, 'question_threads', {
    project_id: inv.project_id,
    stage_key: '',
    question: (prefix + text).slice(0, MAX_QUESTION + prefix.length)
  });
  if (!okWrite) return json({ ok: false, reason: 'niet_opgeslagen' }, 200);
  /* BEWUST GEEN gebeurtenis in invoice_email_events. De enum daar kent
     'portal_viewed' en 'pdf_downloaded'; een vraag als weergave loggen zou
     de teller "hoe vaak heeft de klant zijn factuur bekeken" vervuilen, en
     die teller is juist het signaal waarop je een herinnering baseert. De
     vraag zelf landt in question_threads en staat dus gewoon in het
     bestaande vragenoverzicht van het beheer — precies waar hij hoort. */
  return json({ ok: true }, 200);
}
