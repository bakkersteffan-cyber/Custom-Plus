/* CUSTOM+ — factuurmodule fase 4: e-mail, klantlink-tokens en tracking.
   ------------------------------------------------------------------
   Dit bestand is de PURE kant van deze fase. Het weet hoe een klantlink-
   token eruitziet, hoe je hem herkent, wanneer hij nog geldig is, hoe je
   uit een rij gebeurtenissen een eerlijke bezorgstatus afleidt en hoe een
   Resend-webhookbericht wordt vertaald naar een rij in
   invoice_email_events. Het praat met niets: geen DOM, geen database,
   geen netwerk. Daardoor draait exact deze code in de browser
   (beheer.html, factuur.html), in de Netlify Functions en in
   test/invoice-mail.test.mjs.

   Waarom dat de moeite waard is: een token dat in het beheer wordt
   gemaakt, wordt in een Netlify Function gecontroleerd. Zouden dat twee
   implementaties zijn, dan is de dag dat ze uit elkaar lopen de dag dat
   een klant zijn eigen factuur niet meer kan openen — of erger, die van
   een ander wel.

   ------------------------------------------------------------------
   HET TOKEN — en waarom precies zo

   · 32 bytes uit crypto.getRandomValues, dus 256 bits. Geen Math.random,
     geen tijdstempel, geen teller: alle drie zijn voorspelbaar en een
     factuurlink is voor iedereen zonder wachtwoord te openen.
   · Weergave als base64url (43 tekens, alfabet A-Z a-z 0-9 - _). Dat
     alfabet overleeft een e-mailclient, een adresbalk en een kopieer-
     plakactie zonder escaping.
   · Opgeslagen wordt NOOIT het token zelf maar uitsluitend de SHA-256-
     hash ervan (invoice_tokens.token_hash, zie 0008_invoices.sql). Lekt
     die tabel, dan lekken de links niet.
   · De link draagt het token in het HASH-deel van de URL
     (factuur.html#t=…), niet in de query. Een hash wordt door de browser
     nooit meegestuurd naar de server, dus hij staat niet in een
     serverlog, niet in een Referer-header en niet in een CDN-cache.
   · Intrekbaar (revoked_at) en optioneel met vervaldatum (expires_at).
     Beide worden hier gecontroleerd, en nog eens server-side.

   ------------------------------------------------------------------
   DE BEZORGSTATUS — eerlijk boven volledig

   Verzenden weten we zelf (Resend antwoordt met een message-id).
   BEZORGEN weten we alleen als de Resend-webhook is aangezet. Zolang dat
   niet zo is, zegt deze module 'verstuurd' met webhookNeeded: true, en
   de UI zegt dan letterlijk "bezorgstatus onbekend". Nooit 'bezorgd'
   omdat het verzenden lukte — dat zijn twee verschillende dingen.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_INVOICE_MAIL = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '4.0.0';

  /* ============================================================
     1. TOKENS
     ============================================================ */

  var TOKEN_BYTES = 32;                 /* 256 bits */
  var TOKEN_LENGTH = 43;                /* base64url van 32 bytes, zonder '=' */
  var TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
  var B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  function cryptoObj() {
    if (root && root.crypto) return root.crypto;
    if (typeof globalThis !== 'undefined' && globalThis.crypto) return globalThis.crypto;
    return null;
  }

  /* base64url zonder padding, met de hand — btoa en Buffer zijn allebei
     omgevingsafhankelijk en dit is dertig regels die overal hetzelfde doen. */
  function bytesToBase64Url(bytes) {
    var out = '';
    var i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += B64URL[(n >> 18) & 63] + B64URL[(n >> 12) & 63] + B64URL[(n >> 6) & 63] + B64URL[n & 63];
    }
    var rest = bytes.length - i;
    if (rest === 1) {
      var a = bytes[i] << 16;
      out += B64URL[(a >> 18) & 63] + B64URL[(a >> 12) & 63];
    } else if (rest === 2) {
      var b = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += B64URL[(b >> 18) & 63] + B64URL[(b >> 12) & 63] + B64URL[(b >> 6) & 63];
    }
    return out;
  }

  /* randomBytes is injecteerbaar zodat de test kan bewijzen dat er echt
     TOKEN_BYTES bytes worden opgevraagd en dat elke byte doorwerkt. In de
     praktijk is het altijd crypto.getRandomValues — er is bewust GEEN
     terugval op Math.random: liever een duidelijke fout dan een link die
     te raden is. */
  function randomBytes(n) {
    var c = cryptoObj();
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new Error('Deze browser heeft geen crypto.getRandomValues. Een klantlink kan zonder echte willekeur niet veilig worden gemaakt.');
    }
    var buf = new Uint8Array(n);
    c.getRandomValues(buf);
    return buf;
  }

  function newToken(rnd) {
    var gen = typeof rnd === 'function' ? rnd : randomBytes;
    var bytes = gen(TOKEN_BYTES);
    if (!bytes || bytes.length !== TOKEN_BYTES) {
      throw new Error('De willekeurbron leverde ' + (bytes ? bytes.length : 0) + ' bytes in plaats van ' + TOKEN_BYTES + '.');
    }
    return bytesToBase64Url(bytes);
  }

  function tokenLooksValid(t) {
    return typeof t === 'string' && TOKEN_RE.test(t);
  }

  function utf8Bytes(text) {
    var s = String(text == null ? '' : text);
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(s);
    /* terugval voor exotische omgevingen; het token is toch al ASCII */
    var out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 255);
    return new Uint8Array(out);
  }

  function toHex(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) {
      var h = bytes[i].toString(16);
      out += h.length === 1 ? '0' + h : h;
    }
    return out;
  }

  /* SHA-256 via WebCrypto — bestaat in elke moderne browser en in Node 18+.
     Async, want subtle.digest is dat. */
  function sha256Hex(text) {
    var c = cryptoObj();
    if (!c || !c.subtle || typeof c.subtle.digest !== 'function') {
      return Promise.reject(new Error('Deze omgeving heeft geen crypto.subtle; een token kan niet worden gehasht.'));
    }
    return Promise.resolve(c.subtle.digest('SHA-256', utf8Bytes(text)))
      .then(function (buf) { return toHex(new Uint8Array(buf)); });
  }

  /* De staat van een tokenrij. Nederlandse reden (beheer-UI en serverlog);
     de klantpagina toont een eigen, vertaalde tekst op basis van `code`. */
  function tokenState(row, nowIso) {
    var now = nowIso || new Date().toISOString();
    if (!row) return { usable: false, code: 'onbekend', reason: 'Deze link is niet bekend.' };
    if (row.revokedAt || row.revoked_at) {
      return { usable: false, code: 'ingetrokken', reason: 'Deze link is ingetrokken.' };
    }
    var exp = row.expiresAt || row.expires_at || '';
    if (exp && String(exp) <= String(now)) {
      return { usable: false, code: 'verlopen', reason: 'Deze link is verlopen.' };
    }
    return { usable: true, code: 'geldig', reason: '' };
  }

  /* De link zelf. Het token staat in het hash-deel; de basis-URL mag geen
     eigen hash dragen. */
  function tokenUrl(baseUrl, token) {
    var base = String(baseUrl || '').split('#')[0];
    return base + '#t=' + String(token || '');
  }
  function parseTokenFromHash(hash) {
    var h = String(hash || '');
    var i = h.indexOf('#');
    if (i >= 0) h = h.slice(i + 1);
    var m = /(?:^|&)t=([A-Za-z0-9_-]+)/.exec(h);
    return m ? m[1] : '';
  }

  /* ============================================================
     2. E-MAILADRESSEN
     ============================================================ */

  var EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
  function validEmail(s) { return EMAIL_RE.test(String(s || '').trim()); }

  /* "a@b.nl, c@d.nl; e@f.nl" wordt ['a@b.nl','c@d.nl','e@f.nl'] */
  function splitAddresses(str) {
    return String(str || '')
      .split(/[,;\n]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return !!s; });
  }

  /* Ontvangerslijsten opschonen: ongeldige adressen eruit, dubbelen eruit,
     en een adres dat al in 'aan' staat mag niet ook nog in cc of bcc. Dat
     laatste is geen muggenzifterij: een klant die dezelfde factuur twee
     keer krijgt denkt dat er twee facturen zijn. */
  function planRecipients(input) {
    input = input || {};
    var seen = {};
    var dropped = [];
    function take(list, veld) {
      var out = [];
      (list || []).forEach(function (raw) {
        var mail = String(raw || '').trim();
        if (!mail) return;
        var key = mail.toLowerCase();
        if (!validEmail(mail)) { dropped.push({ email: mail, veld: veld, reden: 'ongeldig' }); return; }
        if (seen[key]) { dropped.push({ email: mail, veld: veld, reden: 'dubbel' }); return; }
        seen[key] = true;
        out.push(mail);
      });
      return out;
    }
    var to = take(input.to, 'aan');
    var cc = take(input.cc, 'cc');
    var bcc = take(input.bcc, 'bcc');
    return { to: to, cc: cc, bcc: bcc, dropped: dropped, total: to.length + cc.length + bcc.length };
  }

  /* ============================================================
     3. GEBEURTENISSEN EN BEZORGSTATUS
     ============================================================ */

  /* exact de enum uit 0008_invoices.sql */
  var EVENTS = ['queued', 'sent', 'delivered', 'bounced', 'complained', 'opened',
                'clicked', 'portal_viewed', 'pdf_downloaded', 'failed'];

  var EVENT_LABELS_NL = {
    queued: 'Ingepland',
    sent: 'Verstuurd',
    delivered: 'Bezorgd',
    bounced: 'Gebounced',
    complained: 'Als spam gemeld',
    opened: 'Geopend',
    clicked: 'Link aangeklikt',
    portal_viewed: 'Klantpagina bekeken',
    pdf_downloaded: 'PDF gedownload',
    failed: 'Mislukt'
  };

  function evTime(e) { return String((e && (e.occurredAt || e.occurred_at)) || ''); }
  function evName(e) { return String((e && e.event) || ''); }

  function sortEvents(events) {
    return (events || []).slice().sort(function (a, b) {
      return evTime(a).localeCompare(evTime(b));
    });
  }

  /* De afleiding. Chronologisch, en met een harde regel: verzenden is niet
     bezorgen. Zolang er geen webhookgebeurtenis is, blijft de status
     'verstuurd' met webhookNeeded: true. */
  function deliveryState(events) {
    var list = sortEvents(events);
    var st = {
      status: 'nooit_verstuurd',
      webhookNeeded: false,
      queuedAt: '', sentAt: '', deliveredAt: '', bouncedAt: '',
      complainedAt: '', failedAt: '', openedAt: '', clickedAt: '',
      firstViewedAt: '', lastViewedAt: '',
      viewCount: 0, downloadCount: 0, attempts: 0,
      messageIds: [], recipients: [], lastError: '', lastTemplate: ''
    };
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var t = evTime(e);
      var name = evName(e);
      var mid = String((e && (e.mailMessageId || e.mail_message_id)) || '');
      var rcpt = String((e && e.recipient) || '');
      var tpl = String((e && (e.templateKey || e.template_key)) || '');
      if (mid && st.messageIds.indexOf(mid) < 0) st.messageIds.push(mid);
      if (rcpt && st.recipients.indexOf(rcpt) < 0) st.recipients.push(rcpt);
      if (tpl) st.lastTemplate = tpl;
      switch (name) {
        case 'queued': st.queuedAt = t; break;
        case 'sent': st.sentAt = t; st.attempts++; break;
        case 'delivered': st.deliveredAt = t; break;
        case 'bounced': st.bouncedAt = t; st.lastError = String((e && e.detail) || ''); break;
        case 'complained': st.complainedAt = t; break;
        case 'failed': st.failedAt = t; st.lastError = String((e && e.detail) || ''); break;
        case 'opened': st.openedAt = t; break;
        case 'clicked': st.clickedAt = t; break;
        case 'portal_viewed':
          if (!st.firstViewedAt) st.firstViewedAt = t;
          st.lastViewedAt = t; st.viewCount++;
          break;
        case 'pdf_downloaded': st.downloadCount++; break;
        default: break;
      }
    }
    var sent = st.sentAt;
    if (st.complainedAt) st.status = 'geklaagd';
    else if (st.bouncedAt && st.bouncedAt >= sent) st.status = 'gebounced';
    else if (st.deliveredAt && st.deliveredAt >= sent) st.status = 'bezorgd';
    else if (st.failedAt && st.failedAt >= sent) st.status = 'mislukt';
    else if (sent) st.status = 'verstuurd';
    else if (st.failedAt) st.status = 'mislukt';
    else if (st.queuedAt) st.status = 'ingepland';
    else st.status = 'nooit_verstuurd';

    /* alleen dan weten we het echt niet: de mail is de deur uit en er is
       nooit een webhookbericht over binnengekomen */
    st.webhookNeeded = (st.status === 'verstuurd');
    return st;
  }

  /* IDEMPOTENTIE, de code-kant.
     In Supabase doet de unieke index op provider_event_id dit werk (zie
     0011_factuurmail.sql) — een controle in code verliest daar van twee
     gelijktijdige afleveringen. In DEMOMODUS is er geen database en geen
     gelijktijdigheid, en daar is deze functie de hele idempotentie.
     Beide kanten hanteren dezelfde regel, en die staat hier zodat de test
     hem kan vastleggen: een gebeurtenis ZONDER provider-id (alles wat we
     zelf schrijven: queued, sent, portal_viewed, pdf_downloaded) mag zo
     vaak voorkomen als hij gebeurt. */
  function isDuplicateEvent(existing, providerEventId) {
    var id = String(providerEventId || '');
    if (!id) return false;
    var list = existing || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      var have = String((e && (e.providerEventId || e.provider_event_id)) || '');
      if (have && have === id) return true;
    }
    return false;
  }

  var STATUS_LABELS_NL = {
    nooit_verstuurd: 'Nog niet verstuurd',
    ingepland: 'Ingepland',
    verstuurd: 'Verstuurd — bezorgstatus onbekend',
    bezorgd: 'Bezorgd',
    gebounced: 'Gebounced — niet aangekomen',
    geklaagd: 'Als spam gemeld',
    mislukt: 'Verzenden mislukt'
  };

  /* ============================================================
     4. RESEND-WEBHOOK
     ============================================================
     Resend levert zijn gebeurtenissen via Svix. Het type staat in
     payload.type; het bericht-id in payload.data.email_id. De
     idempotentiesleutel is de svix-id uit de header — dezelfde
     gebeurtenis die drie keer wordt afgeleverd draagt drie keer dezelfde
     svix-id, en de unieke index op provider_event_id gooit de tweede en
     derde weg. */
  var RESEND_EVENT_MAP = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': '',      /* bewust genegeerd: nog geen uitkomst */
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.failed': 'failed'
  };

  function firstRecipient(data) {
    if (!data) return '';
    var to = data.to;
    if (Array.isArray(to)) return String(to[0] || '');
    if (typeof to === 'string') return to;
    return '';
  }

  /* payload wordt een rij, of null als we deze gebeurtenis bewust laten
     liggen. `allowOpen` is de expliciete instelling
     'factuur_openingsregistratie': staat die uit, dan komt een opening er
     NOOIT in — ook niet als Resend hem stuurt. Uit is de standaard. */
  function normalizeResendEvent(payload, opts) {
    opts = opts || {};
    if (!payload || typeof payload !== 'object') return null;
    var type = String(payload.type || '');
    var mapped = RESEND_EVENT_MAP[type];
    if (mapped === undefined) return null;      /* onbekend type */
    if (!mapped) return null;                   /* bekend maar bewust genegeerd */
    if ((mapped === 'opened' || mapped === 'clicked') && !opts.allowOpen) return null;

    var data = payload.data || {};
    var detail = '';
    if (mapped === 'bounced') {
      var b = data.bounce || {};
      detail = String(b.message || b.subType || b.type || data.reason || '').slice(0, 300);
    } else if (mapped === 'failed') {
      detail = String((data.failed && data.failed.reason) || data.reason || '').slice(0, 300);
    }
    return {
      eventId: String(opts.eventId || payload.id || '').slice(0, 120),
      event: mapped,
      messageId: String(data.email_id || data.id || '').slice(0, 120),
      recipient: firstRecipient(data).slice(0, 200),
      subject: String(data.subject || '').slice(0, 200),
      detail: detail,
      occurredAt: String(payload.created_at || data.created_at || new Date().toISOString())
    };
  }

  /* ============================================================
     5. INPLANNEN
     ============================================================
     EERLIJKE AFWIJKING. Er draait geen cron en geen achtergrondproces:
     dit is een statische site met serverloze functies die alleen bestaan
     terwijl er iemand op klikt. Een ingeplande verzending vertrekt
     daarom bij het EERSTVOLGENDE moment dat het beheer open staat op of
     na het gekozen tijdstip — precies zoals de geplande publicatie
     (functie 45) dat al doet. De UI zegt dat er letterlijk bij. */
  function dueSchedules(list, nowIso) {
    var now = nowIso || new Date().toISOString();
    return (list || []).filter(function (s) {
      if (!s || s.status !== 'gepland') return false;
      return String(s.sendAt || '') <= String(now);
    }).sort(function (a, b) { return String(a.sendAt).localeCompare(String(b.sendAt)); });
  }

  /* ============================================================
     6. WAT DE KLANT MAG ZIEN
     ============================================================
     Een lijst, hier, in plaats van drie keer 'vergeet het interne veld
     niet' in drie bestanden. De klantpagina en de Netlify Function lezen
     allebei deze functie; wat er niet in staat, verlaat de server niet.
     De interne notitie en de interne tags staan er dus bewust niet in. */
  function clientView(snapshot, extra) {
    var s = snapshot || {};
    var x = extra || {};
    var t = s.totals || {};
    function money(k) { return typeof t[k] === 'number' ? t[k] : 0; }
    var lines = (s.lines || []).map(function (L) {
      return {
        type: L.type || 'item',
        description: L.description || '',
        detail: L.detail || '',
        unit: L.unit || '',
        quantityMicro: L.quantityMicro || 0,
        unitPriceCents: L.unitPriceCents || 0,
        rateMilli: L.rateMilli || 0,
        treatment: L.treatment || 'standard',
        netExclCents: L.netExclCents || 0,
        vatCents: L.vatCents || 0,
        inclCents: L.inclCents || 0
      };
    });
    var paid = typeof x.paidCents === 'number' ? x.paidCents : money('paidCents');
    var incl = money('totalInclCents');
    var outstanding = typeof x.outstandingCents === 'number'
      ? x.outstandingCents
      : (money('outstandingCents') || Math.max(0, incl - paid));
    return {
      docKind: s.docKind === 'credit_note' ? 'credit_note' : 'invoice',
      invoiceNumber: s.invoiceNumber || '',
      invoiceDate: s.invoiceDate || '',
      dueDate: s.dueDate || '',
      language: s.language || 'nl',
      currency: s.currency || 'EUR',
      minorUnits: (s.minorUnits === undefined ? 2 : s.minorUnits),
      clientReference: s.clientReference || '',
      purchaseOrder: s.purchaseOrder || '',
      introText: s.introText || '',
      outroText: s.outroText || '',
      paymentInstructions: s.paymentInstructions || '',
      /* De veldnamen zijn EXACT die van de snapshot (invSellerBlock /
         invBuyerBlock in beheer.html, en dus ook die van de PDF). Een
         tweede woordenlijst hier zou betekenen dat een veld dat morgen
         wordt toegevoegd op twee plekken moet worden hernoemd, en dat de
         klantpagina bij de eerste vergissing stilzwijgend een leeg vak
         toont in plaats van een fout. */
      seller: {
        name: (s.seller && s.seller.name) || '',
        address: (s.seller && s.seller.address) || '',
        vatNumber: (s.seller && s.seller.vatNumber) || '',
        registrationNumber: (s.seller && s.seller.registrationNumber) || '',
        iban: (s.seller && s.seller.iban) || '',
        bic: (s.seller && s.seller.bic) || '',
        email: (s.seller && s.seller.email) || ''
      },
      buyer: {
        name: (s.buyer && s.buyer.name) || '',
        tradeName: (s.buyer && s.buyer.tradeName) || '',
        contactName: (s.buyer && s.buyer.contactName) || '',
        address: (s.buyer && s.buyer.address) || '',
        vatNumber: (s.buyer && s.buyer.vatNumber) || ''
      },
      lines: lines,
      taxGroups: (s.taxGroups || []).map(function (g) {
        return {
          taxCode: g.taxCode || '', rateMilli: g.rateMilli || 0,
          treatment: g.treatment || 'standard',
          baseCents: g.baseCents || 0, vatCents: g.vatCents || 0,
          legalNoteNl: g.legalNoteNl || ''
        };
      }),
      totals: {
        totalExclCents: money('totalExclCents'),
        vatCents: money('vatCents'),
        totalInclCents: incl,
        paidCents: paid,
        outstandingCents: outstanding
      },
      statusCode: String(x.statusCode || 'sent'),
      payUrl: String(x.payUrl || ''),
      projectName: String(x.projectName || ''),
      pdfAvailable: !!x.pdfAvailable
    };
  }

  /* De status zoals de KLANT hem hoort te lezen. Interne codes als
     'disputed' of 'uncollectible' zijn beheerstaal en horen niet op een
     klantpagina; die vallen terug op 'open'. */
  function clientStatus(statusCode, outstandingCents, dueDate, nowIso) {
    var code = String(statusCode || '');
    if (code === 'cancelled') return 'geannuleerd';
    if (code === 'credited') return 'gecrediteerd';
    if (code === 'paid') return 'betaald';
    if ((outstandingCents || 0) <= 0) return 'betaald';
    if (code === 'partially_paid') return 'deels_betaald';
    var now = (nowIso || new Date().toISOString()).slice(0, 10);
    if (dueDate && String(dueDate) < now) return 'verlopen';
    return 'open';
  }

  /* ============================================================
     7. DE VIER WOORDEN VAN DE KLANT — OOK IN DE MAIL
     ============================================================
     De factuurmodule kent twaalf statussen; de klant leest er in zijn
     portaal precies vier: Open · Gemeld · Betaald · Bezwaar. Een mail die
     "Deels betaald", "Verlopen" of — erger — 'partially_paid' zegt,
     spreekt een andere taal dan het portaal waar de knop in diezelfde
     mail naartoe wijst. Daarom staat de vertaler HIER: deze module wordt
     door de browser (beheer.html, factuur.html) én door
     netlify/functions/notify-client.mjs geladen, dus er is één tabel en
     één rangorde, niet twee die uit elkaar kunnen lopen.

     De rangorde is woordelijk die van factuurStatusVoorKlant() in
     portal/portaal-model.js (lees het kopblok daar): gemeld wint van
     bezwaar, bezwaar van deels betaald, en te laat blijft 'Open' met de
     datum ernaast. Verandert die rangorde daar, dan hoort hij hier mee te
     veranderen — test/invoice-mail.test.mjs legt beide functies naast
     elkaar en klapt zodra ze een ander woord geven.

     Wat de klant LEEST zijn Nederlandse bronstrings (dezelfde
     i18n-sleutels als het portaal); wie ze vertaalt geeft een T(nl)-functie
     mee, zoals i18nT in de browser of het woordenboekje in
     notify-client.mjs. Zonder T blijft het Nederlands staan. */

  /* exact STATUS_CODES uit portal/portaal-model.js (en 0008_invoices.sql) */
  var STATUS_CODES = ['draft', 'scheduled', 'finalized', 'sent', 'viewed',
    'partially_paid', 'paid', 'overdue', 'disputed', 'cancelled', 'credited',
    'uncollectible'];

  /* de vier woorden en de toelichtingen: letterlijk T.woord* en
     T.toelichting* uit portaal-model.js, dus dezelfde vertaalsleutels */
  var KLANT_WOORD = { open: 'Open', gemeld: 'Gemeld', betaald: 'Betaald', bezwaar: 'Bezwaar' };
  var KLANT_TOELICHTING = {
    gemeld: 'Steffan controleert je betaling',
    teLaat: 'Vervaldatum was {datum}',
    deels: '{betaald} van {totaal} ontvangen',
    creditnota: 'Creditnota, verrekend',
    vervallen: 'Vervallen'
  };
  /* de kop van de regel in de gegevensstrook van de mail; i18n-sleutel
     'Stand' bestaat al (het portaal noemt de kolom zo) */
  var KLANT_STAND_LABEL = 'Stand';

  /* Beheerstaal die een klant nooit hoort te lezen: de twaalf codes plus de
     fijne Nederlandse en Engelse labels van het beheer en de oude
     klantpagina. De waarde is de sleutel van het klantwoord dat ervoor in
     de plaats komt; '' betekent GEEN woord (een concept of een
     geannuleerde factuur beweert niets — zie de uitzondering in het
     kopblok van factuurStatusVoorKlant). */
  var INTERN_NAAR_KLANT = {
    draft: '', scheduled: '', finalized: 'open', sent: 'open', viewed: 'open',
    partially_paid: 'open', paid: 'betaald', overdue: 'open', disputed: 'bezwaar',
    cancelled: '', credited: 'betaald', uncollectible: 'open',
    'Concept': '', 'Ingepland': '', 'Definitief': 'open', 'Verzonden': 'open',
    'Bekeken': 'open', 'Deels betaald': 'open', 'Verlopen': 'open',
    'Betwist': 'bezwaar', 'Bezwaar in behandeling': 'bezwaar', 'Oninbaar': 'open',
    'Gecrediteerd': 'betaald', 'Geannuleerd': '',
    'Partly paid': 'open', 'Overdue': 'open'
  };

  /* Wat er in LOPENDE TEKST wordt vervangen. Bewust een kortere lijst dan
     hierboven: 'sent', 'paid', 'draft', 'viewed', 'credited' en 'cancelled'
     zijn ook gewoon Engelse woorden ("the first draft", "credited to your
     account") en zouden een correcte Engelse zin kapotmaken. Wat hier
     staat is nooit een gewoon woord in een klantmail. Langste eerst, zodat
     'Bezwaar in behandeling' niet halverwege wordt geraakt. */
  var INTERN_IN_TEKST = ['Bezwaar in behandeling', 'partially_paid', 'uncollectible',
    'Deels betaald', 'Gecrediteerd', 'Partly paid', 'finalized', 'Definitief',
    'disputed', 'Verlopen', 'Oninbaar', 'Betwist', 'Overdue'];
  function reEscape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /* geen lookbehind (ES5): de tekenreeks vóór het woord wordt gevangen en
     teruggezet. \w is ASCII, dus 'vóór' of 'één' ervoor is geen probleem. */
  var INTERN_TEKST_RE = new RegExp('(^|[^A-Za-z0-9_])(' + INTERN_IN_TEKST.map(reEscape).join('|') + ')(?![A-Za-z0-9_])', 'g');

  function identiteit(s) { return s; }
  function vertaler(T) { return typeof T === 'function' ? T : identiteit; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function centsVan(v) {
    var n = typeof v === 'number' ? v : parseInt(String(v == null ? '' : v), 10);
    return (typeof n === 'number' && isFinite(n)) ? Math.round(n) : 0;
  }
  /* camelCase (beheer, snapshot) of snake_case (Supabase-rij): beide */
  function veld(inv, a, b) {
    if (inv[a] !== undefined && inv[a] !== null) return inv[a];
    if (b && inv[b] !== undefined && inv[b] !== null) return inv[b];
    return undefined;
  }
  /* null zonder datum — dezelfde afspraak als dayISO() in portaal-model.js,
     zodat vervaltISO in beide vertalers hetzelfde is */
  function dagISO(v) {
    var m = String(v == null ? '' : v).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  /* dezelfde vuller als CP_STATUS.fill en portaal-model.vul */
  function vul(tpl, vars) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars && vars[k] !== null && vars[k] !== undefined) ? String(vars[k]) : m;
    });
  }

  /* --- de rij → één code, met dezelfde eerlijke terugval als
         statusCodeVan() in portaal-model.js --- */
  function statusCodeVan(inv) {
    var code = String(veld(inv, 'statusCode', 'status_code') || '');
    if (code && STATUS_CODES.indexOf(code) >= 0) return code;
    if (veld(inv, 'publishStatus', 'publish_status') === 'concept') return 'draft';
    var st = veld(inv, 'status');
    if (st === 'paid') return 'paid';
    if (st === 'void') return 'cancelled';
    return 'finalized';
  }
  /* het TE BETALEN bedrag, incl. btw: de factuurmodule (totalInclCents /
     total_incl_cents, ook in de snapshot), anders golf 1 (totalCents,
     amountCents). Er wordt hier nooit btw gerekend. */
  function totaalCentsVan(inv) {
    var t = centsVan(veld(inv, 'totalInclCents', 'total_incl_cents'));
    if (t > 0) return t;
    var snap = veld(inv, 'snapshot');
    if (isObj(snap) && isObj(snap.totals)) { t = centsVan(snap.totals.totalInclCents); if (t > 0) return t; }
    t = centsVan(veld(inv, 'totalCents', 'total_cents'));
    if (t > 0) return t;
    return centsVan(veld(inv, 'amountCents', 'amount_cents'));
  }
  /* paidCents telt zodra het er staat — óók als het 0 is (zie de uitleg
     bij betaaldCentsVan in portaal-model.js) */
  function betaaldCentsVan(inv, code) {
    var p = veld(inv, 'paidCents', 'paid_cents');
    if (p !== undefined) return centsVan(p);
    return code === 'paid' ? totaalCentsVan(inv) : 0;
  }
  function gemeldeBetalingVan(inv, opties) {
    var o = isObj(opties) ? opties : {};
    var g = o.gemeld !== undefined ? o.gemeld : veld(inv, 'gemeld');
    if (Array.isArray(g)) return g.some(function (m) { return !isObj(m) || !(m.verifiedAt || m.verified_at); });
    if (typeof g === 'number') return g > 0;
    if (g === true) return true;
    var m = veld(inv, 'gemeldeBetaling', 'gemelde_betaling');
    return isObj(m) && !(m.verifiedAt || m.verified_at);
  }

  /* DE VERTALER. Geeft dezelfde velden terug als factuurStatusVoorKlant()
     (code, stand, woord, toelichting, toon, betaald, open, deels, gemeld,
     bezwaar, gesloten, openCents, totaalCents, betaaldCents,
     gecrediteerdCents, valuta, vervaltISO, verstreken) plus minorUnits,
     zodat een scherm of mail het bedrag in de juiste munt kan schrijven.
     'nu' is de dag van vandaag (ISO); een test zet hem vast. */
  function klantStatus(invoice, nu, opties) {
    var inv = isObj(invoice) ? invoice : {};
    /* geen rij is geen factuur: 'draft', nergens open, beweert niets */
    var code = isObj(invoice) ? statusCodeVan(inv) : 'draft';
    var totaal = totaalCentsVan(inv);
    var betaald = betaaldCentsVan(inv, code);
    var gecrediteerd = centsVan(veld(inv, 'creditedCents', 'credited_cents'));
    if (gecrediteerd < 0) gecrediteerd = 0;
    var openC;
    var buiten = veld(inv, 'outstandingCents', 'outstanding_cents');
    if (totaal > 0 || buiten === undefined) {
      openC = totaal - betaald - gecrediteerd;
    } else {
      /* een serverrij die alleen zijn openstaande bedrag kent: dan is dat
         de waarheid en wordt het totaal daaruit teruggerekend */
      openC = centsVan(buiten);
      totaal = openC + betaald + gecrediteerd;
    }
    if (openC < 0) openC = 0;
    var vervalt = dagISO(veld(inv, 'dueDate', 'due_date'));
    var vandaag = dagISO(nu) || new Date().toISOString().slice(0, 10);
    var verstreken = !!(vervalt && vervalt < vandaag);

    var stand;
    if (code === 'cancelled') stand = 'geannuleerd';
    else if (code === 'credited') stand = 'gecrediteerd';
    else if (code === 'paid') stand = 'betaald';
    else if (code === 'draft' || code === 'scheduled') stand = 'concept';
    else if (openC <= 0) stand = 'betaald';
    else if (code === 'partially_paid') stand = 'deels_betaald';
    else if (verstreken) stand = 'verlopen';
    else stand = 'open';

    var gesloten = stand === 'geannuleerd' || stand === 'gecrediteerd';
    var isBetaald = stand === 'betaald';
    var isOpen = !gesloten && !isBetaald && stand !== 'concept' && openC > 0;
    var deels = isOpen && (betaald + gecrediteerd) > 0;
    var bezwaar = code === 'disputed';
    var gemeld = isOpen && gemeldeBetalingVan(inv, opties);

    var woord = '', toelichting = '', toon;
    if (stand === 'concept') { toon = 'muted'; }
    else if (isBetaald) { woord = KLANT_WOORD.betaald; toon = 'muted'; }
    else if (stand === 'gecrediteerd') { woord = KLANT_WOORD.betaald; toelichting = KLANT_TOELICHTING.creditnota; toon = 'muted'; }
    else if (stand === 'geannuleerd') { toelichting = KLANT_TOELICHTING.vervallen; toon = 'muted'; }
    else if (gemeld) { woord = KLANT_WOORD.gemeld; toelichting = KLANT_TOELICHTING.gemeld; toon = 'muted'; }
    else if (bezwaar) { woord = KLANT_WOORD.bezwaar; toon = 'info'; }
    else if (deels) { woord = KLANT_WOORD.open; toelichting = KLANT_TOELICHTING.deels; toon = 'warn'; }
    else if (verstreken) { woord = KLANT_WOORD.open; toelichting = KLANT_TOELICHTING.teLaat; toon = 'warn'; }
    else { woord = KLANT_WOORD.open; toon = 'warn'; }

    var snap = veld(inv, 'snapshot');
    var valuta = veld(inv, 'currency') || (isObj(snap) && snap.currency) || 'EUR';
    var mu = veld(inv, 'minorUnits', 'minor_units');
    if (mu === undefined && isObj(snap) && snap.minorUnits !== undefined) mu = snap.minorUnits;
    return {
      code: code, stand: stand, woord: woord, toelichting: toelichting, toon: toon,
      betaald: isBetaald, open: isOpen, deels: deels, gemeld: gemeld, bezwaar: bezwaar,
      gesloten: gesloten,
      openCents: isOpen ? openC : 0, totaalCents: totaal, betaaldCents: betaald,
      gecrediteerdCents: gecrediteerd,
      valuta: String(valuta).toUpperCase(), minorUnits: (mu === undefined ? 2 : mu),
      vervaltISO: vervalt, verstreken: isOpen && verstreken
    };
  }

  /* alleen een code of een beheerlabel, zonder bedragen: wat er dan
     minimaal over te zeggen valt ({woord, toelichting}, of null als het
     geen status is) */
  function woordVoorCode(code) {
    var k = String(code == null ? '' : code).trim();
    if (!hasOwn(INTERN_NAAR_KLANT, k)) {
      if (hasOwn(INTERN_NAAR_KLANT, k.toLowerCase())) k = k.toLowerCase();
      else return null;
    }
    var sleutel = INTERN_NAAR_KLANT[k];
    var out = { woord: sleutel ? KLANT_WOORD[sleutel] : '', toelichting: '' };
    if (k === 'cancelled' || k === 'Geannuleerd') out.toelichting = KLANT_TOELICHTING.vervallen;
    if (k === 'credited' || k === 'Gecrediteerd') out.toelichting = KLANT_TOELICHTING.creditnota;
    return out;
  }

  /* --- bedragen en datums zoals het portaal ze schrijft --- */

  /* dezelfde scheidingstekens per taal als SEPS in invoice-pdf.js, met
     één verschil dat het portaal ook maakt: hele bedragen ZONDER centen
     ("€ 3.125"), centen alleen als ze er zijn ("€ 3.125,50") */
  var MAIL_SEPS = {
    nl: { group: '.', dec: ',', symbolFirst: true, space: true },
    de: { group: '.', dec: ',', symbolFirst: false, space: true },
    es: { group: '.', dec: ',', symbolFirst: false, space: true },
    fr: { group: ' ', dec: ',', symbolFirst: false, space: true },
    en: { group: ',', dec: '.', symbolFirst: true, space: false }
  };
  var MAIL_SYMBOLS = { EUR: '€', USD: '$', CNY: '¥', GBP: '£' };
  function groepeer(intPart, group) {
    var s = String(intPart), out = '', n = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s[i] + out;
      n++;
      if (n % 3 === 0 && i > 0) out = group + out;
    }
    return out;
  }
  function mailBedrag(cents, currency, lang, minorUnits) {
    var s = MAIL_SEPS[lang] || MAIL_SEPS.nl;
    var mu = (minorUnits === undefined || minorUnits === null) ? 2 : Math.max(0, Math.min(3, minorUnits));
    var v = centsVan(cents);
    var neg = v < 0;
    if (neg) v = -v;
    var scale = 1;
    for (var i = 0; i < mu; i++) scale *= 10;
    var whole = Math.floor(v / scale);
    var frac = v - whole * scale;
    var body = groepeer(whole, s.group);
    if (mu > 0 && frac !== 0) body += s.dec + ('000' + frac).slice(-mu);
    var cur = String(currency || 'EUR').toUpperCase();
    var sym = MAIL_SYMBOLS[cur] || cur;
    var out = s.symbolFirst ? (sym + (s.space ? ' ' : '') + body) : (body + ' ' + sym);
    return (neg ? '-' : '') + out;
  }

  /* "24 apr 2026": de korte vorm van de tijdlijn en de factuurrijen.
     NL en EN uit een tabel (narekenbaar, geen ICU nodig); de andere talen
     via Intl met EN als terugval. Een kale dag gaat nooit door new Date()
     zonder UTC, anders schuift hij in Nederland een dag terug. */
  var MAAND_KORT_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var MAAND_KORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MAAND_LANG_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var MAAND_LANG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MAIL_LOCALES = { de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };
  function mailDatum(iso, lang) {
    var s = String(iso == null ? '' : iso).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    var j = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return m[1] + '-' + m[2] + '-' + m[3];
    if (lang === 'en') return d + ' ' + MAAND_KORT_EN[mo - 1] + ' ' + j;
    if (MAIL_LOCALES[lang]) {
      try {
        var out = new Intl.DateTimeFormat(MAIL_LOCALES[lang], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(Date.UTC(j, mo - 1, d)));
        /* de smalle vaste spaties die Intl per taal invoegt (\u00a0, \u202f,
           \u2009) kan een mailclient in platte tekst als ? tonen */
        return String(out).replace(/[\u00a0\u202f\u2009]/g, ' ');
      } catch (e) { /* kale ICU: dan Engels */ }
      return d + ' ' + MAAND_KORT_EN[mo - 1] + ' ' + j;
    }
    return d + ' ' + MAAND_KORT_NL[mo - 1] + ' ' + j;
  }

  /* --- de regel die de klant leest --- */

  /* "Open · € 1.000 van € 3.125 ontvangen": woord en toelichting, in de
     taal van de klant (T) en met bedragen en datum in zijn schrijfwijze.
     Leeg voor een concept. */
  function statusRegel(st, lang, T) {
    var t = vertaler(T);
    if (!isObj(st)) return '';
    var delen = [];
    if (st.woord) delen.push(t(st.woord));
    if (st.toelichting) {
      var vars = {
        datum: mailDatum(st.vervaltISO, lang),
        /* {betaald} is alles wat niet meer betaald hoeft te worden — betaald
           én verrekend via creditnota, precies zoals standToelichting() in
           portaal-schermen-berichten.js het scherm vult */
        betaald: mailBedrag(centsVan(st.betaaldCents) + centsVan(st.gecrediteerdCents), st.valuta, lang, st.minorUnits),
        totaal: mailBedrag(st.totaalCents, st.valuta, lang, st.minorUnits)
      };
      delen.push(vul(t(st.toelichting), vars));
    }
    return delen.join(' · ');
  }
  /* de rij voor de gegevensstrook ({label, value}), of null als er niets
     te zeggen valt */
  function statusFact(st, lang, T) {
    var v = statusRegel(st, lang, T);
    return v ? { label: vertaler(T)(KLANT_STAND_LABEL), value: v } : null;
  }

  /* --- schoonmaken van wat het beheer al meestuurt --- */

  /* een losse waarde die een interne code of een beheerlabel IS (exact,
     na trimmen) → het klantwoord; anders null (het was geen status) */
  function vertaalStatusWaarde(value, T) {
    var w = woordVoorCode(value);
    if (!w) return null;
    var t = vertaler(T);
    var delen = [];
    if (w.woord) delen.push(t(w.woord));
    if (w.toelichting) delen.push(t(w.toelichting));
    return delen.join(' · ');
  }
  function bevatInterneStatus(text) {
    INTERN_TEKST_RE.lastIndex = 0;
    return INTERN_TEKST_RE.test(String(text == null ? '' : text));
  }
  /* beheerstaal midden in een zin → het klantwoord. Alleen de woorden uit
     INTERN_IN_TEKST, hoofdlettergevoelig en als heel woord. */
  function vervangInterneStatus(text, T) {
    var t = vertaler(T);
    return String(text == null ? '' : text).replace(INTERN_TEKST_RE, function (m, voor, woord) {
      var w = woordVoorCode(woord);
      var delen = [];
      if (w && w.woord) delen.push(t(w.woord));
      if (w && w.toelichting) delen.push(t(w.toelichting));
      return voor + delen.join(' · ');
    });
  }
  function telInterneStatus(text) {
    var n = 0;
    String(text == null ? '' : text).replace(INTERN_TEKST_RE, function () { n++; return ''; });
    return n;
  }

  /* "€ 3.125,00" → "€ 3.125", "€3,125.00" → "€3,125", "3.125,00 EUR" →
     "3.125 EUR". Alleen bij een bedrag met een valutateken of -code
     eromheen, zodat een tijd ("10.00 uur") of een versienummer met rust
     wordt gelaten. Een bedrag mét centen ("€ 3.125,50") blijft staan. */
  var GELD_TEKEN = '[€$¥£]';
  var GELD_CODE = '(?:EUR|USD|CNY|GBP)';
  var GELD_GETAL = '(?:\\d{1,3}(?:[.,\\u00a0\\u202f ]\\d{3})+|\\d+)';
  var GELD_VOOR_RE = new RegExp('(' + GELD_TEKEN + '\\s?-?|' + GELD_CODE + '\\s)(' + GELD_GETAL + ')[.,]00(?!\\d)', 'g');
  var GELD_NA_RE = new RegExp('(^|[^\\d.,])(' + GELD_GETAL + ')[.,]00(?!\\d)(\\s?(?:' + GELD_TEKEN + '|' + GELD_CODE + '(?![A-Za-z])))', 'g');
  function bedragZonderCenten(text) {
    return String(text == null ? '' : text)
      .replace(GELD_VOOR_RE, '$1$2')
      .replace(GELD_NA_RE, '$1$2$3');
  }

  /* ISO-datums en lange maandnamen (NL/EN) in een tekst → de korte vorm.
     Een ISO-tijdstempel (met T of :) wordt met rust gelaten. */
  var ISO_IN_TEKST_RE = /(^|[^\d])(\d{4})-(\d{2})-(\d{2})(?![\dT:-])/g;
  var LANG_NL_RE = new RegExp('(^|[^A-Za-z0-9_])(\\d{1,2}) (' + MAAND_LANG_NL.join('|') + ') (\\d{4})(?!\\d)', 'g');
  var LANG_EN_RE = new RegExp('(^|[^A-Za-z0-9_])(\\d{1,2}) (' + MAAND_LANG_EN.join('|') + ') (\\d{4})(?!\\d)', 'g');
  function datumsKort(text, lang) {
    return String(text == null ? '' : text)
      .replace(ISO_IN_TEKST_RE, function (m, voor, j, mo, d) { return voor + mailDatum(j + '-' + mo + '-' + d, lang); })
      .replace(LANG_NL_RE, function (m, voor, d, maand, j) {
        return voor + parseInt(d, 10) + ' ' + MAAND_KORT_NL[MAAND_LANG_NL.indexOf(maand)] + ' ' + j;
      })
      .replace(LANG_EN_RE, function (m, voor, d, maand, j) {
        return voor + parseInt(d, 10) + ' ' + MAAND_KORT_EN[MAAND_LANG_EN.indexOf(maand)] + ' ' + j;
      });
  }

  /* de hele schoonmaak voor lopende tekst (onderwerp, bodyLine, bodyText)
     en voor een losse waarde in de gegevensstrook */
  function mailTekstVoorKlant(text, lang, T) {
    return datumsKort(bedragZonderCenten(vervangInterneStatus(text, T)), lang);
  }
  function mailWaardeVoorKlant(value, lang, T) {
    var v = String(value == null ? '' : value).trim();
    var exact = vertaalStatusWaarde(v, T);
    if (exact !== null) return exact;
    return mailTekstVoorKlant(v, lang, T);
  }

  /* alle NL bronstrings die deze sectie kan laten lezen — voor de
     vertaalronde en voor de test die controleert dat een mail-woordenboek
     ze allemaal kent */
  var KLANT_BRONSTRINGEN = [KLANT_STAND_LABEL,
    KLANT_WOORD.open, KLANT_WOORD.gemeld, KLANT_WOORD.betaald, KLANT_WOORD.bezwaar,
    KLANT_TOELICHTING.gemeld, KLANT_TOELICHTING.teLaat, KLANT_TOELICHTING.deels,
    KLANT_TOELICHTING.creditnota, KLANT_TOELICHTING.vervallen];

  return {
    VERSION: VERSION,

    /* 7. de vier woorden van de klant, ook in de mail */
    STATUS_CODES: STATUS_CODES,
    KLANT_WOORD: KLANT_WOORD,
    KLANT_TOELICHTING: KLANT_TOELICHTING,
    KLANT_STAND_LABEL: KLANT_STAND_LABEL,
    KLANT_BRONSTRINGEN: KLANT_BRONSTRINGEN,
    INTERN_NAAR_KLANT: INTERN_NAAR_KLANT,
    INTERN_IN_TEKST: INTERN_IN_TEKST,
    klantStatus: klantStatus,
    woordVoorCode: woordVoorCode,
    statusRegel: statusRegel,
    statusFact: statusFact,
    vertaalStatusWaarde: vertaalStatusWaarde,
    bevatInterneStatus: bevatInterneStatus,
    vervangInterneStatus: vervangInterneStatus,
    telInterneStatus: telInterneStatus,
    mailBedrag: mailBedrag,
    mailDatum: mailDatum,
    bedragZonderCenten: bedragZonderCenten,
    datumsKort: datumsKort,
    mailTekstVoorKlant: mailTekstVoorKlant,
    mailWaardeVoorKlant: mailWaardeVoorKlant,
    TOKEN_BYTES: TOKEN_BYTES,
    TOKEN_LENGTH: TOKEN_LENGTH,
    TOKEN_RE: TOKEN_RE,
    randomBytes: randomBytes,
    bytesToBase64Url: bytesToBase64Url,
    newToken: newToken,
    tokenLooksValid: tokenLooksValid,
    sha256Hex: sha256Hex,
    tokenState: tokenState,
    tokenUrl: tokenUrl,
    parseTokenFromHash: parseTokenFromHash,

    EMAIL_RE: EMAIL_RE,
    validEmail: validEmail,
    splitAddresses: splitAddresses,
    planRecipients: planRecipients,

    EVENTS: EVENTS,
    EVENT_LABELS_NL: EVENT_LABELS_NL,
    STATUS_LABELS_NL: STATUS_LABELS_NL,
    sortEvents: sortEvents,
    deliveryState: deliveryState,
    isDuplicateEvent: isDuplicateEvent,

    RESEND_EVENT_MAP: RESEND_EVENT_MAP,
    normalizeResendEvent: normalizeResendEvent,

    dueSchedules: dueSchedules,
    clientView: clientView,
    clientStatus: clientStatus
  };
});
