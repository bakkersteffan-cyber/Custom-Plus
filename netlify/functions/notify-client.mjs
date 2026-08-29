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
  var greet = data.clientName ? 'Hallo ' + esc(data.clientName.split(' ')[0]) + ',' : 'Hallo,';
  return [
    '<!doctype html><html lang="nl"><body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,\'Helvetica Neue\',Arial,sans-serif;color:#111;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">',
    '<tr><td align="center">',
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid rgba(228,224,219,.6);border-radius:20px;overflow:hidden;">',
    '<tr><td style="padding:28px 32px 0;">',
    '<div style="font-weight:800;font-size:18px;letter-spacing:.02em;">CUSTOM<span style="color:#1B6E45;">+</span></div>',
    '</td></tr>',
    '<tr><td style="padding:20px 32px 4px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#696969;font-family:ui-monospace,Menlo,monospace;">',
    esc(data.projectName || 'Jouw project') + (data.projectCode ? ' &middot; ' + esc(data.projectCode) : ''),
    '</td></tr>',
    '<tr><td style="padding:4px 32px 0;font-size:19px;font-weight:700;letter-spacing:-.01em;">' + esc(data.subject) + '</td></tr>',
    '<tr><td style="padding:14px 32px 0;font-size:15px;line-height:1.6;color:#333;">' + esc(greet) + '</td></tr>',
    '<tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6;color:#333;">' + esc(data.bodyLine) + '</td></tr>',
    '<tr><td style="padding:24px 32px 32px;">',
    '<a href="' + esc(data.portalUrl) + '" style="display:inline-block;background:#111;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 24px;border-radius:100px;">' + esc(data.portalLabel || 'Bekijk je project') + '</a>',
    '</td></tr>',
    '<tr><td style="padding:0 32px 28px;font-size:12.5px;color:#999;line-height:1.6;">Reageren op deze update? Log in op je project en stel je vraag daar &mdash; Steffan reageert meestal binnen 1 werkdag.</td></tr>',
    '</table></td></tr></table></body></html>'
  ].join('');
}

function renderText(data) {
  var greet = data.clientName ? 'Hallo ' + data.clientName.split(' ')[0] + ',' : 'Hallo,';
  return [
    (data.projectName || 'Jouw project') + (data.projectCode ? ' (' + data.projectCode + ')' : ''),
    data.subject, '',
    greet, '',
    data.bodyLine, '',
    (data.portalLabel || 'Bekijk je project') + ': ' + data.portalUrl
  ].join('\n');
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405);

  var apiKey = process.env.RESEND_API_KEY;
  var from = process.env.RESEND_FROM;
  var secretConfigured = process.env.NOTIFY_SHARED_SECRET;
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

  var data = {
    to: to,
    subject: subject,
    bodyLine: bodyLine,
    portalUrl: portalUrl,
    portalLabel: typeof body.portalLabel === 'string' ? body.portalLabel.trim().slice(0, 60) : 'Bekijk je project',
    clientName: typeof body.clientName === 'string' ? body.clientName.trim().slice(0, 80) : '',
    projectName: typeof body.projectName === 'string' ? body.projectName.trim().slice(0, 120) : '',
    projectCode: typeof body.projectCode === 'string' ? body.projectCode.trim().slice(0, 40) : ''
  };

  var upstream;
  try {
    upstream = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from,
        to: [data.to],
        subject: data.subject,
        html: renderHtml(data),
        text: renderText(data)
      })
    });
  } catch (e) {
    return json({ error: 'upstream-unreachable' }, 502);
  }
  if (!upstream.ok) {
    var errText = '';
    try { errText = await upstream.text(); } catch (e) { /* negeer */ }
    return json({ error: 'upstream-' + upstream.status, detail: errText.slice(0, 300) }, 502);
  }
  return json({ ok: true });
}
