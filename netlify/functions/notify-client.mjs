/* CUSTOM+ klantmeldingen — serverless proxy naar Resend.
   De API key en het gedeelde wachtwoord leven uitsluitend hier (Netlify env vars
   RESEND_API_KEY / RESEND_FROM / NOTIFY_SHARED_SECRET), nooit in beheer.html of
   portal.html. Zonder een van de drie env vars is deze functie uit (503), zodat
   er nooit per ongeluk een halfgeconfigureerde open relay live staat.

   beheer.html stuurt alleen KORTE, al-vertaalde tekst (subject/bodyLine) mee —
   deze functie bouwt daar zelf de gestylede e-mail omheen. Dat houdt de content
   voorspelbaar (geen vrije HTML van de client) en de sjabloon op één plek. */

var RESEND_URL = 'https://api.resend.com/emails';
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var MAX_LEN = 300;

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

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderHtml(data) {
  var t = langPack(data.lang);
  var greet = data.clientName ? t.hello + ' ' + esc(data.clientName.split(' ')[0]) + ',' : t.hello + ',';
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
  return [
    (data.projectName || t.project) + (data.projectCode ? ' (' + data.projectCode + ')' : ''),
    data.subject, '',
    greet, '',
    data.bodyLine, '',
    (data.portalLabel || t.label) + ': ' + data.portalUrl
  ].join('\n');
}

export default async function handler(req) {
  var apiKey = process.env.RESEND_API_KEY;
  var from = process.env.RESEND_FROM;
  var secretConfigured = process.env.NOTIFY_SHARED_SECRET;

  /* health-check (functie 70 / go-live): een GET verstuurt nooit iets en
     antwoordt eerlijk of de drie env vars op Netlify staan — zo kan de
     beheer-header 'Live' pas groen tonen als mails ook echt kunnen. */
  if (req.method === 'GET') {
    return json({ configured: !!(apiKey && from && secretConfigured) }, 200);
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  if (!apiKey || !from || !secretConfigured) return json({ error: 'not-configured' }, 503);

  var body;
  try { body = await req.json(); } catch (e) { return json({ error: 'bad-json' }, 400); }
  if (!body || body.secret !== secretConfigured) return json({ error: 'unauthorized' }, 401);

  var to = typeof body.to === 'string' ? body.to.trim() : '';
  var subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 140) : '';
  var bodyLine = typeof body.bodyLine === 'string' ? body.bodyLine.trim().slice(0, MAX_LEN) : '';
  var portalUrl = typeof body.portalUrl === 'string' ? body.portalUrl.trim().slice(0, 300) : '';
  if (!EMAIL_RE.test(to)) return json({ error: 'invalid-to' }, 400);
  if (!subject || !bodyLine || !portalUrl) return json({ error: 'missing-fields' }, 400);

  /* taal (functie 30 + contactpersoon-taal 26): default nl */
  var lang = (typeof body.lang === 'string' && MAIL_LANGS[body.lang.toLowerCase()]) ? body.lang.toLowerCase() : 'nl';

  var data = {
    to: to,
    subject: subject,
    bodyLine: bodyLine,
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
  return json({ ok: true, id: (upstreamBody && typeof upstreamBody.id === 'string') ? upstreamBody.id : '' });
}
