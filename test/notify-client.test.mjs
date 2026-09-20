/* CUSTOM+ — advies 35: klantmails spreken de taal van het portaal.
   ------------------------------------------------------------------
   Het portaal laat de klant vier woorden lezen over een factuur: Open ·
   Gemeld · Betaald · Bezwaar. De mail die naar diezelfde klant gaat,
   werd tot nu toe letterlijk afgedrukt zoals het beheer hem aanleverde —
   inclusief alles wat daar per ongeluk in kon zitten: een interne code
   ('partially_paid'), een beheerlabel ('Deels betaald'), een bedrag met
   lege centen ('€ 3.125,00') of een ISO-datum.

   Hieronder draait de ECHTE Netlify Function (notify-client.mjs) met een
   nagebootste Resend erachter, en wordt gelezen wat er werkelijk de deur
   uit zou gaan (de tekst- én de HTML-versie). Dat is het verschil tussen
   "de vertaler klopt" (test/invoice-mail.test.mjs) en "de mail gebruikt
   hem".
   ------------------------------------------------------------------ */
import * as mailModule from '../portal/invoice-mail.js';

const M = (mailModule && mailModule.default) || globalThis.CP_INVOICE_MAIL;

/* het portaalwoordenboek, geladen zoals de browser dat doet — om vast te
   leggen dat het woordenboekje in de mailfunctie er niet van afwijkt */
const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
if (!hadWindow) globalThis.window = globalThis;
await import('../portal/i18n.js');
const DICTS = globalThis.CP_PORTAL_I18N;
if (!hadWindow) delete globalThis.window;

const ENV_KEYS = ['RESEND_API_KEY', 'RESEND_FROM', 'NOTIFY_SHARED_SECRET', 'PORTAL_BASE_URL',
  'PORTAL_URL_EXTRA_ORIGINS', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

/* een hele lowercase code als los woord — hoofdlettergevoelig, want
   'Paid' en 'Disputed' zijn de Engelse klantwoorden en 'paid' en
   'disputed' de codes */
function bevatCode(tekst, code) {
  return new RegExp('(^|[^A-Za-z0-9_])' + code + '(?![A-Za-z0-9_])').test(tekst);
}

export default async function (t) {
  const origFetch = globalThis.fetch;
  const origEnv = {};
  ENV_KEYS.forEach(function (k) { origEnv[k] = process.env[k]; });

  try {
    const handler = (await import('../netlify/functions/notify-client.mjs')).default;

    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM = 'noreply@custom-plus.nl';
    process.env.NOTIFY_SHARED_SECRET = 'geheim-voor-de-test';
    process.env.PORTAL_BASE_URL = 'https://custom-plus.nl';
    delete process.env.PORTAL_URL_EXTRA_ORIGINS;
    /* zonder Supabase-omgeving loopt de poort via het gedeelde geheim */
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    /* nagebootste Resend: onthoudt de laatste mail en antwoordt met een id */
    let laatste = null;
    globalThis.fetch = async function (url, init) {
      if (String(url).indexOf('api.resend.com') >= 0) {
        laatste = JSON.parse(init.body);
        return new Response(JSON.stringify({ id: 're_test_1' }), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    };

    const basis = {
      secret: 'geheim-voor-de-test',
      to: 'klant@voorbeeld.nl',
      clientName: 'Anna de Vries',
      subject: 'Factuur CP-2026-00007 — Lamp',
      bodyLine: 'Er staat een factuur voor je klaar.',
      portalUrl: '/factuur.html#t=abc',
      projectName: 'Lamp',
      lang: 'nl'
    };
    async function stuur(extra) {
      laatste = null;
      const res = await handler(new Request('https://custom-plus.nl/.netlify/functions/notify-client', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({}, basis, extra || {}))
      }));
      let json = {};
      try { json = await res.json(); } catch (e) { /* geen json */ }
      return { res: res, json: json, mail: laatste };
    }

    /* ============================================================
       1. DE STANDREGEL: DE SERVER BOUWT HEM MET DE VERTALER VAN HET PORTAAL
       ============================================================ */
    t.group('notify-client: de standregel in de gegevensstrook');

    const deels = { statusCode: 'partially_paid', totalInclCents: 312500, paidCents: 100000, creditedCents: 0, dueDate: '2099-05-15', currency: 'EUR' };
    let r = await stuur({
      invoice: deels,
      facts: [
        { label: 'Factuurnummer', value: 'CP-2026-00007' },
        { label: 'Bedrag', value: '€ 3.125,00' },
        { label: 'Vervaldatum', value: '2099-05-15' }
      ]
    });
    t.eq(r.res.status, 200, 'de mail met een factuurrij wordt aangenomen');
    t.eq(r.json.ok, true, 'en verstuurd');
    t.true(!!r.mail, 'er is een mail naar Resend gegaan');
    t.true(r.mail.text.indexOf('Stand: Open · € 1.000 van € 3.125 ontvangen') >= 0,
      'een deels betaalde factuur zegt in de tekstversie "Open" met "€ 1.000 van € 3.125 ontvangen"');
    t.true(r.mail.html.indexOf('Open · € 1.000 van € 3.125 ontvangen') >= 0, 'en in de HTML-versie ook');
    t.true(r.mail.text.indexOf('Bedrag: € 3.125\n') >= 0, 'het bedrag uit het beheer verliest zijn lege centen: "€ 3.125"');
    t.true(r.mail.text.indexOf('Vervaldatum: 15 mei 2099') >= 0, 'de ISO-vervaldatum uit het beheer wordt kort: "15 mei 2099"');
    t.eq(r.json.stand, 'Open · € 1.000 van € 3.125 ontvangen', 'het antwoord meldt de standregel voor het mail-logboek');
    t.true(r.mail.text.indexOf('partially_paid') < 0 && r.mail.html.indexOf('partially_paid') < 0,
      'de interne code staat nergens in de mail');

    r = await stuur({ invoice: { statusCode: 'sent', totalInclCents: 312500, paidCents: 0, dueDate: '2099-05-15', gemeld: true } });
    t.true(r.mail.text.indexOf('Stand: Gemeld · Steffan controleert je betaling') >= 0,
      'een gemelde betaling zegt "Gemeld" met "Steffan controleert je betaling"');

    r = await stuur({ invoice: { statusCode: 'disputed', totalInclCents: 312500, paidCents: 0, dueDate: '2020-01-01' } });
    t.true(r.mail.text.indexOf('Stand: Bezwaar\n') >= 0, 'een betwiste factuur zegt "Bezwaar" — zonder datum, ook al is hij verstreken');
    t.false(bevatCode(r.mail.text, 'disputed'), 'en nergens "disputed"');

    r = await stuur({ invoice: { statusCode: 'paid', totalInclCents: 312500, paidCents: 312500 } });
    t.true(r.mail.text.indexOf('Stand: Betaald\n') >= 0, 'een betaalde factuur zegt "Betaald"');

    r = await stuur({ invoice: { statusCode: 'sent', totalInclCents: 312500, paidCents: 0, dueDate: '2020-04-24' } });
    t.true(r.mail.text.indexOf('Stand: Open · Vervaldatum was 24 apr 2020') >= 0,
      'een verstreken factuur zegt "Open" met de korte vervaldatum — nooit "Verlopen"');
    t.false(/Verlopen|overdue/.test(r.mail.text), 'en nergens "Verlopen" of "overdue"');

    r = await stuur({ invoice: { status_code: 'credited', total_incl_cents: 312500, paid_cents: 0, credited_cents: 312500 } });
    t.true(r.mail.text.indexOf('Stand: Betaald · Creditnota, verrekend') >= 0,
      'een gecrediteerde Supabase-rij (snake_case) zegt "Betaald · Creditnota, verrekend"');

    r = await stuur({ invoice: { statusCode: 'draft', totalInclCents: 312500 }, facts: [{ label: 'Factuurnummer', value: 'CP-2026-00007' }] });
    t.true(r.mail.text.indexOf('Stand:') < 0, 'een concept levert geen standregel op');
    t.eq(r.json.stand, '', 'en het antwoord zegt dat ook');

    /* een 'Stand'-rij die het beheer zelf al had gevuld verliest van de rij
       die de server uit de factuurrij bouwt — anders staan er twee */
    r = await stuur({ invoice: deels, facts: [{ label: 'Stand', value: 'disputed' }, { label: 'Factuurnummer', value: 'CP-2026-00007' }] });
    t.eq((r.mail.text.match(/Stand: /g) || []).length, 1, 'er staat precies één standregel in de mail');
    t.true(r.mail.text.indexOf('Stand: Open · € 1.000 van € 3.125 ontvangen') >= 0, 'en dat is die van de server');
    t.true(r.mail.text.indexOf('Factuurnummer: CP-2026-00007') >= 0, 'de andere rijen blijven staan');

    /* de strook is begrensd op zes rijen; de standregel mag er nooit
       vanaf vallen */
    const zes = [1, 2, 3, 4, 5, 6].map(function (i) { return { label: 'Rij ' + i, value: 'w' + i }; });
    r = await stuur({ invoice: deels, facts: zes });
    t.true(r.mail.text.indexOf('Stand: Open') >= 0, 'bij een volle strook blijft de standregel staan');
    t.true(r.mail.text.indexOf('Rij 6:') < 0, 'en valt de laatste vrije rij af');

    /* ============================================================
       2. DE VIJF TALEN — EN HET WOORDENBOEKJE VOLGT i18n.js
       ============================================================ */
    t.group('notify-client: de vier woorden in vijf talen');

    r = await stuur({ invoice: deels, lang: 'en' });
    t.true(r.mail.text.indexOf('Status: Open · €1,000 of €3,125 received') >= 0,
      'Engels: "Status: Open · €1,000 of €3,125 received"');
    r = await stuur({ invoice: deels, lang: 'de' });
    t.true(r.mail.text.indexOf('Stand: Offen · 1.000 € von 3.125 € erhalten') >= 0,
      'Duits: "Stand: Offen · 1.000 € von 3.125 € erhalten"');
    r = await stuur({ invoice: deels, lang: 'fr' });
    t.true(r.mail.text.indexOf('État: En attente · 1 000 € sur 3 125 € reçus') >= 0,
      'Frans: "État: En attente · 1 000 € sur 3 125 € reçus"');
    r = await stuur({ invoice: deels, lang: 'es' });
    t.true(r.mail.text.indexOf('Estado: Pendiente · 1.000 € de 3.125 € recibidos') >= 0,
      'Spaans: "Estado: Pendiente · 1.000 € de 3.125 € recibidos"');

    /* de woorden die i18n.js al kent moeten in de mail letterlijk zo
       luiden — anders leest de klant in zijn mail iets anders dan in zijn
       portaal */
    const perTaal = {
      Stand: { invoice: deels },
      Open: { invoice: deels },
      Gemeld: { invoice: { statusCode: 'sent', totalInclCents: 312500, paidCents: 0, gemeld: true } },
      Betaald: { invoice: { statusCode: 'paid', totalInclCents: 312500, paidCents: 312500 } }
    };
    for (const taal of ['en', 'de', 'fr', 'es']) {
      for (const nl of Object.keys(perTaal)) {
        const verwacht = DICTS[taal][nl];
        r = await stuur(Object.assign({ lang: taal }, perTaal[nl]));
        /* de strookregel is 'label: waarde' — het label is de vertaling van
           'Stand', de waarde begint met het woord */
        const kop = DICTS[taal].Stand + ': ';
        const regel = (r.mail.text.split('\n').filter(function (l) { return l.indexOf(kop) === 0; })[0]) || '';
        t.true(nl === 'Stand' ? !!regel : regel.indexOf(kop + verwacht) === 0,
          taal + ': de mail gebruikt voor "' + nl + '" exact het portaalwoord "' + verwacht + '" (regel: "' + regel + '")');
      }
    }

    /* ============================================================
       3. BEHEERSTAAL DIE HET BEHEER TÓCH MEESTUURT KOMT ER NIET DOORHEEN
       ============================================================ */
    t.group('notify-client: beheerstaal komt er niet doorheen');

    r = await stuur({
      subject: 'Factuur CP-2026-00007 (partially_paid)',
      bodyText: 'Status: Deels betaald.\n\nDe factuur is finalized, te voldoen vóór 24 april 2026 (€ 3.125,00).',
      facts: [{ label: 'Stand', value: 'partially_paid' }, { label: 'Status', value: 'Verlopen' }]
    });
    t.eq(r.mail.subject, 'Factuur CP-2026-00007 (Open)', 'het onderwerp: "partially_paid" wordt "Open"');
    t.true(r.mail.text.indexOf('Status: Open.') >= 0, 'in de tekst: "Deels betaald" wordt "Open"');
    t.true(r.mail.text.indexOf('De factuur is Open, te voldoen vóór 24 apr 2026 (€ 3.125).') >= 0,
      '"finalized" wordt "Open", de datum wordt kort en de lege centen verdwijnen');
    t.true(r.mail.text.indexOf('Stand: Open\n') >= 0, 'de strookwaarde "partially_paid" wordt "Open"');
    t.true(r.mail.text.indexOf('Status: Open\n') >= 0, 'de strookwaarde "Verlopen" wordt "Open"');
    t.false(/finalized|partially_paid|Deels betaald|Verlopen/.test(r.mail.text), 'geen beheerstaal in de tekstversie');
    t.false(/finalized|partially_paid|Deels betaald|Verlopen/.test(r.mail.html), 'en niet in de HTML-versie');
    t.eq(r.json.vertaald, 5, 'het antwoord telt de vijf stukjes beheerstaal die zijn rechtgezet');

    /* elk van de twaalf codes als strookwaarde: geen enkele komt erdoor */
    const doorgelaten = [];
    for (const code of M.STATUS_CODES) {
      r = await stuur({ facts: [{ label: 'Stand', value: code }] });
      if (bevatCode(r.mail.text, code) || bevatCode(r.mail.html, code)) doorgelaten.push(code);
    }
    t.eq(doorgelaten.length, 0, 'geen van de twaalf interne codes bereikt de klant als strookwaarde' +
      (doorgelaten.length ? ' — wel: ' + doorgelaten.join(', ') : ''));

    /* een mail zonder factuur: gewone tekst blijft gewone tekst */
    r = await stuur({ bodyLine: 'Nieuwe mijlpaal: Vertrokken uit de haven van Shenzhen.' });
    t.true(r.mail.text.indexOf('Nieuwe mijlpaal: Vertrokken uit de haven van Shenzhen.') >= 0,
      'een projectmail zonder status wordt niet aangeraakt');
    t.eq(r.json.vertaald, 0, 'en er is niets vertaald');
    r = await stuur({ lang: 'en', bodyLine: 'The first draft was sent; the amount will be credited to you.' });
    t.true(r.mail.text.indexOf('The first draft was sent; the amount will be credited to you.') >= 0,
      'gewone Engelse woorden (draft, sent, credited) worden in lopende tekst niet aangezien voor codes');

    /* ============================================================
       4. DE POORT EN DE HEALTH-CHECK ZIJN NIET VERANDERD
       ============================================================ */
    t.group('notify-client: poort en health-check');

    let res = await handler(new Request('https://custom-plus.nl/x', { method: 'GET' }));
    t.eq(res.status, 200, 'de health-check antwoordt');
    t.eq((await res.json()).configured, true, 'en meldt configured:true met alle omgevingsvariabelen');
    r = await stuur({ secret: 'verkeerd' });
    t.eq(r.res.status, 401, 'zonder geldig geheim of sessie is het 401');
    t.eq(r.mail, null, 'en gaat er niets naar Resend');
    r = await stuur({ portalUrl: 'https://kwaadaardig.example/factuur' });
    t.eq(r.res.status, 400, 'een knop naar een vreemde oorsprong wordt nog steeds geweigerd');
  } finally {
    globalThis.fetch = origFetch;
    ENV_KEYS.forEach(function (k) {
      if (origEnv[k] === undefined) delete process.env[k];
      else process.env[k] = origEnv[k];
    });
  }
}
