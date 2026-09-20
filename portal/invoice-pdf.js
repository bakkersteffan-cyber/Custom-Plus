/* CUSTOM+ — het factuursjabloon: van snapshot naar PDF-bytes.
   ------------------------------------------------------------------
   Dit bestand tekent de factuur; portal/pdf.js weet hoe je een PDF
   schrijft en verder niets. De scheiding is met opzet:

     portal/pdf.js         kent papier, punten, fonts, xref — geen factuur
     portal/invoice-pdf.js kent facturen — geen bytes

   DE BRON IS DE SNAPSHOT, NIETS ANDERS
   render() leest uitsluitend de onveranderlijke snapshot uit
   portal/invoice-finalize.js. Niet de editorstand, niet de database, niet
   de huidige instellingen. Dat is precies wat "versie-vast" betekent: de
   PDF die bij het definitief maken ontstaat is een functie van de snapshot
   plus de huisstijl van dát moment, en beide worden bewaard. Wie morgen
   zijn accentkleur verandert, verandert daarmee geen enkele bestaande
   factuur — de bytes van toen liggen er nog.

   TWEE SJABLONEN, ÉÉN TEKENING
   'standaard' en 'compact' zijn geen twee lay-outs maar één lay-out met
   twee stijlwaarden (fontgrootte, regelafstand, wel of geen logoband).
   Twee losse tekeningen zouden betekenen dat elke verbetering twee keer
   moet en er vroeg of laat een verschil insluipt dat niemand bedoelde.
   Dat is de eenmanszaak-toets: het verschil dat de klant ziet is echt,
   het onderhoud is enkel.

   TAAL
   Elke klantzichtbare string gaat door t(), die de vier woordenboeken uit
   portal/i18n.js leest — dezelfde bron als het portaal, dus het woord op
   de PDF is letterlijk het woord op het scherm van de klant.

   GELD
   Alle bedragen komen als GEHELE CENTEN uit de snapshot. Dit bestand
   rekent niet: het formatteert. De enige deling die hier staat is die van
   centen naar tekst, en die loopt over gehele getallen (quotient en rest),
   niet over een kommagetal.

   Publieke API (globalThis.CP_INVOICE_PDF, en module.exports in Node):
     VERSION, TEMPLATE_VERSION, TEMPLATES, CLIENT_STRINGS
     brandDefaults() / normalizeBrand(brand)
     translator(lang)
     formatMoney(cents, currency, minorUnits, lang)
     formatQuantity(micro, lang) / formatPercent(milli, lang)
     formatDate(iso, lang)
     filename(snapshot)
     render(snapshot, opts)      → Uint8Array   (geen enkele IO)
     setStore(fn)                de opslag die de aanroeper aanlevert
     generate(snapshot, context) DE HAAK UIT FASE 2 (stap 6)

   LADEN
     browser : <script src="portal/pdf.js"></script>
               <script src="portal/invoice-pdf.js"></script>   (in die volgorde)
     node    : import '../portal/pdf.js'; import '../portal/invoice-pdf.js';
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_INVOICE_PDF = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.0.0';

  /* De sjabloonversie wordt BIJ DE FACTUUR BEWAARD. Verandert de tekening
     ooit (andere kolomindeling, andere volgorde), dan gaat dit nummer
     omhoog en weet je van elke bestaande factuur met welke tekening zijn
     bewaarde PDF is gemaakt. Het is geen versienummer van dit bestand:
     een commentaarregel bijwerken verandert de factuur niet. */
  var TEMPLATE_VERSION = 1;

  function PDF() {
    var p = root.CP_PDF || (typeof globalThis !== 'undefined' ? globalThis.CP_PDF : null);
    if (!p) throw new Error('portal/pdf.js is niet geladen — zonder de PDF-schrijver kan er geen factuur worden getekend.');
    return p;
  }

  /* ============================================================
     1. SJABLONEN EN HUISSTIJL
     ============================================================ */
  var TEMPLATES = {
    standaard: {
      key: 'standaard',
      label: 'Standaard',
      hint: 'Ruim vel met logoband, een rustige gegevensstrook en royale regelafstand. De keuze voor een factuur met een handvol regels.',
      style: {
        base: 9.5, small: 8, kicker: 7, title: 15,
        lead: 1.42, rowGap: 2.2, band: true, metaCard: true,
        logoMaxH: 16, qrSize: 26, sectionGap: 7
      }
    },
    compact: {
      key: 'compact',
      label: 'Compact',
      hint: 'Dezelfde gegevens dichter op elkaar: kleiner corps, strakkere regelafstand, geen logoband. Scheelt bij lange facturen een hele pagina.',
      style: {
        base: 8.5, small: 7.2, kicker: 6.5, title: 12,
        lead: 1.35, rowGap: 1.4, band: false, metaCard: false,
        logoMaxH: 11, qrSize: 22, sectionGap: 4
      }
    }
  };
  var TEMPLATE_KEYS = ['standaard', 'compact'];

  /* De huisstijl. accent is de ENIGE kleur die de gebruiker kiest; alles
     eromheen is de vaste papierhuisstijl (crème strook, dunne lijn, zwarte
     tekst). Eén instelbare kleur houdt elke factuur leesbaar; drie
     instelbare kleuren leveren vroeg of laat grijs op grijs. */
  var INK = '#141414';
  var MUTED = '#6f6a63';
  var LINE = '#e2ddd6';
  var CREAM = '#faf8f5';

  function brandDefaults() {
    return {
      template: 'standaard',
      accent: '#1B6E45',
      logoData: '',        /* data-URI (JPEG of eenvoudige PNG), leeg = woordmerk */
      logoWidthMm: 34,
      footerNote: ''
    };
  }

  function normalizeBrand(b) {
    var d = brandDefaults();
    b = b || {};
    var tpl = TEMPLATE_KEYS.indexOf(b.template) > -1 ? b.template : d.template;
    var accent = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(b.accent || '')) ? b.accent : d.accent;
    var w = Number(b.logoWidthMm);
    if (!isFinite(w) || w < 10) w = d.logoWidthMm;
    if (w > 70) w = 70;
    return {
      template: tpl,
      accent: accent,
      logoData: typeof b.logoData === 'string' ? b.logoData : '',
      logoWidthMm: w,
      footerNote: typeof b.footerNote === 'string' ? b.footerNote : ''
    };
  }

  /* ============================================================
     2. TAAL
     ============================================================ */
  function translator(lang) {
    var code = (lang && lang !== 'nl') ? String(lang) : '';
    return function (nl, vars) {
      var out = String(nl == null ? '' : nl);
      if (code) {
        var all = (typeof root.CP_PORTAL_I18N === 'object' && root.CP_PORTAL_I18N) ||
          (typeof globalThis !== 'undefined' ? globalThis.CP_PORTAL_I18N : null);
        var dict = all && all[code];
        if (dict && typeof dict[out] === 'string' && dict[out]) out = dict[out];
      }
      if (vars) {
        out = out.replace(/\{(\w+)\}/g, function (m, k) {
          return vars[k] === undefined || vars[k] === null ? m : String(vars[k]);
        });
      }
      return out;
    };
  }

  /* Elke bronstring die dit bestand op het vel van de klant zet. De test
     leest deze lijst en faalt zodra er een vertaling ontbreekt — precies
     hetzelfde vangnet als CP_INVOICE_FINAL.CLIENT_STRINGS. */
  var CLIENT_STRINGS = [
    'Factuur', 'Creditnota', 'Van', 'Aan',
    'Factuurnummer', 'Factuurdatum', 'Vervaldatum', 'Betaaltermijn', '{n} dagen',
    'Leveringsdatum', 'Leveringsperiode', 'Klantreferentie', 'Inkoopordernummer',
    'Registratienummer', 'Btw-nummer', 'Koers op factuurdatum',
    'Omschrijving', 'Aantal', 'Prijs per eenheid', 'Korting', 'Btw', 'Regelbedrag',
    'Vervolg',
    'Subtotaal', 'Regelkortingen', 'Factuurkorting', 'Verzend- en overige kosten',
    'Totaal exclusief btw', 'Totaal inclusief btw', 'Btw {p}%',
    'Reeds betaald', 'Gecrediteerd', 'Openstaand bedrag', 'Te betalen',
    'Prijzen zijn inclusief btw.',
    'Btw-specificatie', 'Tarief', 'Grondslag', 'Btw-bedrag',
    'Betaalinstructie', 'IBAN', 'BIC of SWIFT', 'Op naam van', 'Bedrag',
    'Betalingskenmerk', 'Scan met je bank-app',
    'Pagina {p} van {n}'
  ];

  /* ============================================================
     3. OPMAAK VAN GETALLEN — geen Intl voor geld
     ============================================================
     Intl.NumberFormat geeft per locale andere onzichtbare spaties (een
     smalle vaste spatie in het Frans bijvoorbeeld) die een standaardfont
     niet kan tekenen; die zouden als '?' op de factuur belanden. Daarom
     hier een eigen, expliciete opmaak: gehele centen in, tekst uit, en de
     scheidingstekens per taal benoemd. */
  var SEPS = {
    nl: { group: '.', dec: ',', symbolFirst: true, space: true },
    de: { group: '.', dec: ',', symbolFirst: false, space: true },
    es: { group: '.', dec: ',', symbolFirst: false, space: true },
    fr: { group: ' ', dec: ',', symbolFirst: false, space: true },
    en: { group: ',', dec: '.', symbolFirst: true, space: false }
  };
  var SYMBOLS = { EUR: '€', USD: '$', CNY: '¥', GBP: '£' };

  function sepsFor(lang) { return SEPS[lang] || SEPS.nl; }

  /* een geheel getal in de kleinste munteenheid → "1.234,56".
     De splitsing gebeurt met een gehele deling en een rest; er komt in
     deze functie geen kommagetal voor. */
  function groupDigits(intPart, group) {
    var s = String(intPart);
    var out = '';
    var n = 0;
    for (var i = s.length - 1; i >= 0; i--) {
      out = s[i] + out;
      n++;
      if (n % 3 === 0 && i > 0) out = group + out;
    }
    return out;
  }

  function minorText(cents, minorUnits, lang) {
    var mu = (minorUnits === undefined || minorUnits === null) ? 2 : Math.max(0, Math.min(3, minorUnits));
    var s = sepsFor(lang);
    var v = Math.round(Number(cents) || 0);
    var neg = v < 0;
    if (neg) v = -v;
    var scale = 1;
    for (var i = 0; i < mu; i++) scale *= 10;
    var whole = Math.floor(v / scale);
    var frac = v - whole * scale;
    var txt = groupDigits(whole, s.group);
    if (mu > 0) txt += s.dec + ('000' + frac).slice(-mu);
    return (neg ? '-' : '') + txt;
  }

  /* Het minteken staat VOOR het valutateken, niet ertussen: "-€ 25,50",
     nooit "€ -25,50". Een creditregel moet in één oogopslag als min te
     lezen zijn, ook onder aan een kolom met tien andere bedragen. */
  function formatMoney(cents, currency, minorUnits, lang) {
    var s = sepsFor(lang);
    var v = Math.round(Number(cents) || 0);
    var neg = v < 0;
    var body = minorText(neg ? -v : v, minorUnits, lang);
    var cur = String(currency || 'EUR').toUpperCase();
    var sym = SYMBOLS[cur] || cur;
    var out = s.symbolFirst ? (sym + (s.space ? ' ' : '') + body) : (body + ' ' + sym);
    return (neg ? '-' : '') + out;
  }

  /* aantal: opslag is quantityMicro (aantal × 1.000.000). Achterliggende
     nullen weg — 2,5 blijft 2,5 en 3 blijft 3. */
  function formatQuantity(micro, lang) {
    var s = sepsFor(lang);
    var n = Math.round(Number(micro) || 0);
    var neg = n < 0;
    if (neg) n = -n;
    var whole = Math.floor(n / 1000000);
    var frac = String(1000000 + (n % 1000000)).slice(1).replace(/0+$/, '');
    return (neg ? '-' : '') + groupDigits(whole, s.group) + (frac ? s.dec + frac : '');
  }

  /* percentage: opslag is milli (percentage × 1000) */
  function formatPercent(milli, lang) {
    var s = sepsFor(lang);
    var n = Math.round(Number(milli) || 0);
    var neg = n < 0;
    if (neg) n = -n;
    var whole = Math.floor(n / 1000);
    var frac = String(1000 + (n % 1000)).slice(1).replace(/0+$/, '');
    return (neg ? '-' : '') + whole + (frac ? s.dec + frac : '') + '%';
  }

  var LOCALES = { nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };

  /* Datums MOGEN wel door Intl: die geeft de maandnaam in de taal van de
     klant, en dat is op een factuur ondubbelzinnig ("3-4-2026" is dat
     niet). De uitkomst wordt geschoond van smalle vaste spaties, want die
     kan een standaardfont niet tekenen. Zonder Intl (of bij een kale
     ICU-build) valt hij terug op de ISO-datum — leesbaar en eerlijk. */
  function formatDate(iso, lang, style) {
    var s = String(iso || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    try {
      var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      var out = new Intl.DateTimeFormat(LOCALES[lang] || LOCALES.nl, {
        /* 'short' is er voor de leveringsPERIODE: twee volledige datums
           naast elkaar passen niet in een cel van de gegevensstrook en
           zouden worden afgekapt. Een korte datum is beter dan een halve. */
        day: 'numeric', month: style === 'short' ? 'short' : 'long', year: 'numeric', timeZone: 'UTC'
      }).format(d);
      return String(out).replace(/[   ]/g, ' ');
    } catch (e) {
      return m[1] + '-' + m[2] + '-' + m[3];
    }
  }

  /* Een leveringsperiode als één leesbaar geheel. Twee volledige datums
     naast elkaar zijn te lang voor een cel in de gegevensstrook, dus wat
     dubbel is valt weg: dezelfde maand → "1 – 28 augustus 2026", hetzelfde
     jaar → "1 aug – 12 sep 2026", en anders allebei volledig kort. */
  function formatPeriod(startIso, endIso, lang) {
    var a = String(startIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    var b = String(endIso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!a || !b) return formatDate(startIso, lang, 'short') + ' – ' + formatDate(endIso, lang, 'short');
    if (a[1] === b[1] && a[2] === b[2]) {
      return String(Number(a[3])) + ' – ' + formatDate(endIso, lang);
    }
    if (a[1] === b[1]) {
      var left = formatDate(startIso, lang, 'short').replace(' ' + a[1], '');
      return left + ' – ' + formatDate(endIso, lang, 'short');
    }
    return formatDate(startIso, lang, 'short') + ' – ' + formatDate(endIso, lang, 'short');
  }

  function filename(snapshot) {
    var nr = String((snapshot && snapshot.invoiceNumber) || '').replace(/[^A-Za-z0-9._-]+/g, '-');
    var kind = (snapshot && snapshot.docKind === 'credit_note') ? 'Creditnota' : 'Factuur';
    return kind + (nr ? '-' + nr : '') + '.pdf';
  }

  /* ============================================================
     4. DE BETAAL-QR
     ============================================================
     portal/qr.js maakt de EPC069-12-payload en codeert hem; hier wordt
     alleen zijn SVG-pad opgehaald en aan de PDF-schrijver doorgegeven, die
     het als vectorpad tekent. Voorwaarden zijn dezelfde als op het scherm:
     euro, een geldige IBAN, een bedrag boven nul en een echt nummer. Is er
     ook maar één ingrediënt niet, dan komt er geen QR — nooit een code die
     naar niets leidt. */
  function qrPathFor(snapshot, opts) {
    if (opts && opts.qr === false) return null;
    if (opts && opts.qr && opts.qr.d) return opts.qr;
    var Q = root.CP_QR || (typeof globalThis !== 'undefined' ? globalThis.CP_QR : null);
    if (!Q || typeof Q.epcPayload !== 'function' || typeof Q.svgParts !== 'function') return null;
    if (snapshot.docKind === 'credit_note') return null;
    var seller = snapshot.seller || {};
    var due = snapshot.totals ? snapshot.totals.outstandingCents : 0;
    if (!(due > 0) || !snapshot.invoiceNumber) return null;
    var payload = Q.epcPayload({
      name: seller.name, iban: seller.iban, bic: seller.bic,
      amountCents: due, currency: snapshot.currency, reference: snapshot.invoiceNumber
    });
    if (!payload) return null;
    try {
      var parts = Q.svgParts(payload, { margin: 2 });
      return { d: parts.d, box: parts.box, margin: parts.margin };
    } catch (e) {
      return null;                 /* te lange payload → gewoon geen QR */
    }
  }

  /* labels die als CODE horen te lezen krijgen het monospace-font; de rest
     blijft in de tekstletter. Bedragen staan er bewust NIET bij: in
     Helvetica zijn alle cijfers precies even breed, dus die lijnen al uit. */
  function isCodeLabel(label, t) {
    var codes = ['Factuurnummer', 'Inkoopordernummer', 'Klantreferentie', 'Btw-nummer', 'Registratienummer'];
    for (var i = 0; i < codes.length; i++) if (label === t(codes[i])) return true;
    return false;
  }

  /* ============================================================
     5. DE TEKENING
     ============================================================ */
  function render(snapshot, opts) {
    opts = opts || {};
    var P = PDF();
    var snap = snapshot || {};
    var brand = normalizeBrand(opts.brand || snap.brand);
    /* WIE BEPAALT HET SJABLOON: de FACTUUR, niet de instellingen.
       De huisstijl uit Instellingen levert het logo, de accentkleur en het
       STANDAARDsjabloon voor een nieuwe factuur; zodra een factuur zelf een
       sjabloon draagt staat die keuze in zijn snapshot en telt alleen die.
       Andersom zou het omzetten van de standaard in Instellingen elke
       bestaande factuur van vorm veranderen — precies wat versie-vast moet
       voorkomen. opts.forceTemplate is er voor het live voorbeeld in de
       instellingen: dat toont wat je nú kiest, niet wat er in de snapshot
       staat. */
    if (opts.forceTemplate && TEMPLATE_KEYS.indexOf(opts.forceTemplate) > -1) {
      brand.template = opts.forceTemplate;
    } else if (snap.template && TEMPLATE_KEYS.indexOf(snap.template) > -1) {
      brand.template = snap.template;
    }
    var tplDef = TEMPLATES[brand.template] || TEMPLATES.standaard;
    var S = tplDef.style;
    var lang = opts.lang || snap.language || 'nl';
    var t = opts.t || translator(lang);
    var cur = snap.currency || 'EUR';
    var mu = (snap.minorUnits === undefined || snap.minorUnits === null) ? 2 : snap.minorUnits;
    var seller = snap.seller || {};
    var buyer = snap.buyer || {};
    var totals = snap.totals || {};
    var isCredit = snap.docKind === 'credit_note';
    var accent = brand.accent;

    function money(c) { return formatMoney(c, cur, mu, lang); }
    function mm(pt) { return P.pt2mm(pt); }
    function leading(size) { return mm(size * S.lead); }

    var doc = P.createDoc({
      width: 210, height: 297,
      margin: { top: 15, right: 15, bottom: 18, left: 15 },
      title: (isCredit ? t('Creditnota') : t('Factuur')) + ' ' + (snap.invoiceNumber || ''),
      subject: buyer.name || '',
      author: seller.name || '',
      /* de vaste datum maakt de bytes reproduceerbaar: dezelfde snapshot
         geeft tweemaal exact hetzelfde bestand */
      date: opts.date || (snap.takenAt ? new Date(snap.takenAt) : new Date())
    });

    var L = doc.margin.left;
    var R = doc.width - doc.margin.right;
    var CW = R - L;

    /* de logobytes één keer klaarzetten; mislukt het beeld, dan valt het
       vel stil terug op het woordmerk in tekst — een factuur mag nooit
       stuklopen op een plaatje */
    var logo = null;
    if (brand.logoData) {
      try {
        var bytes = P.dataUriToBytes(brand.logoData);
        if (bytes && bytes.length) {
          var box = doc.imageBox(bytes, brand.logoWidthMm, S.logoMaxH);
          if (box) logo = { bytes: bytes, w: box.width, h: box.height };
        }
      } catch (e) { logo = null; }
    }

    function drawLogo(x, y, maxH) {
      if (logo) {
        var h = Math.min(logo.h, maxH);
        var w = logo.w * (h / logo.h);
        try { doc.image(logo.bytes, x, y, w, h); return h; }
        catch (e) { /* val terug op het woordmerk */ }
      }
      /* geen logo: het woordmerk in tekst, op een corps dat binnen dezelfde
         hoogte blijft als een logo zou doen — anders springt de hele kop
         van plaats zodra iemand een logo toevoegt of weghaalt */
      var size = maxH * 1.2;
      doc.text(seller.name || 'CUSTOM+', x, y + mm(size * 0.78), { font: 'bold', size: size, color: INK });
      return maxH;
    }

    /* ---------- herhalende koptekst ---------- */
    doc.setHeader(function (d, nr) {
      if (nr === 1) { d.y = d.margin.top; return; }
      d.text(seller.name || '', L, 12.5, { font: 'bold', size: S.small, color: INK, maxWidth: CW * 0.5 });
      d.text((isCredit ? t('Creditnota') : t('Factuur')) + ' ' + (snap.invoiceNumber || '') +
        ' · ' + t('Vervolg'), R, 12.5, { align: 'right', size: S.small, color: MUTED });
      d.line(L, 15, R, 15, { color: LINE, width: 0.3 });
      d.y = 22;
    });

    /* ---------- voettekst met paginanummers ---------- */
    doc.setFooter(function (d, nr, total) {
      var fy = d.height - 13;
      d.line(L, fy, R, fy, { color: LINE, width: 0.3 });
      var bits = [];
      if (seller.name) bits.push(seller.name);
      if (seller.registrationNumber) bits.push(t('Registratienummer') + ' ' + seller.registrationNumber);
      if (seller.vatNumber) bits.push(t('Btw-nummer') + ' ' + seller.vatNumber);
      if (seller.iban) bits.push('IBAN ' + seller.iban);
      var left = bits.join(' · ');
      if (brand.footerNote) left = brand.footerNote + (left ? ' · ' + left : '');
      d.text(left, L, fy + 4.5, { size: 6.8, color: MUTED, maxWidth: CW - 34 });
      d.text(t('Pagina {p} van {n}', { p: nr, n: total }), R, fy + 4.5,
        { align: 'right', size: 6.8, color: MUTED });
    });

    doc.addPage();

    /* ---------- 1. briefhoofd ---------- */
    var headTop = doc.y;
    var logoH = drawLogo(L, headTop, S.logoMaxH);
    doc.text((isCredit ? t('Creditnota') : t('Factuur')).toUpperCase(), R, headTop + mm(S.title * 0.8),
      { align: 'right', font: 'bold', size: S.title, color: accent, charSpace: 0.5 });
    doc.text(snap.invoiceNumber || '', R, headTop + mm(S.title * 0.8) + leading(S.base) + 1,
      { align: 'right', font: 'mono', size: S.base, color: INK });
    doc.y = headTop + Math.max(logoH, mm(S.title) + leading(S.base) + 2) + 4;
    if (S.band) {
      doc.rect(L, doc.y, CW, 1.1, { fill: accent });
      doc.y += 1.1 + S.sectionGap;
    } else {
      doc.line(L, doc.y, R, doc.y, { color: LINE, width: 0.4 });
      doc.y += S.sectionGap;
    }

    /* ---------- 2. partijen ---------- */
    var colW = (CW - 10) / 2;
    var partyTop = doc.y;

    function partyBlock(x, kicker, blockLines) {
      var y = partyTop + leading(S.kicker) * 0.8;
      doc.text(t(kicker).toUpperCase(), x, y, { size: S.kicker, color: MUTED, charSpace: 0.4 });
      y += leading(S.kicker) + 1.4;
      for (var i = 0; i < blockLines.length; i++) {
        var ln = blockLines[i];
        if (!ln || !ln.text) continue;
        /* paragraph() geeft de basislijn van de VOLGENDE regel terug, dus
           dit stapelt vanzelf zonder overlap */
        y = doc.paragraph(ln.text, x, y, colW, {
          size: ln.size || S.base,
          font: ln.font || 'regular',
          color: ln.color || INK,
          leading: leading(ln.size || S.base)
        });
      }
      return y;
    }

    var sellerLines = [{ text: seller.name, font: 'bold' }];
    if (seller.address) sellerLines.push({ text: seller.address, size: S.small, color: MUTED });
    if (seller.registrationNumber) sellerLines.push({ text: t('Registratienummer') + ' ' + seller.registrationNumber, size: S.small, color: MUTED });
    if (seller.vatNumber) sellerLines.push({ text: t('Btw-nummer') + ' ' + seller.vatNumber, size: S.small, color: MUTED });
    if (seller.email) sellerLines.push({ text: seller.email, size: S.small, color: MUTED });

    var buyerLines = [{ text: buyer.name || '', font: 'bold' }];
    if (buyer.tradeName && buyer.tradeName !== buyer.name) buyerLines.push({ text: buyer.tradeName, size: S.small, color: MUTED });
    if (buyer.contactName) buyerLines.push({ text: buyer.contactName, size: S.small, color: MUTED });
    if (buyer.address) buyerLines.push({ text: buyer.address, size: S.small, color: MUTED });
    if (buyer.registrationNumber) buyerLines.push({ text: t('Registratienummer') + ' ' + buyer.registrationNumber, size: S.small, color: MUTED });
    if (buyer.vatNumber) buyerLines.push({ text: t('Btw-nummer') + ' ' + buyer.vatNumber, size: S.small, color: MUTED });
    /* een afwijkend afleveradres hoort op het vel; is het gelijk aan het
       factuuradres, dan zou herhalen alleen ruis zijn */
    if (buyer.deliveryAddress && buyer.deliveryAddress !== buyer.address) {
      buyerLines.push({ text: buyer.deliveryAddress, size: S.small, color: MUTED });
    }

    var yA = partyBlock(L, 'Van', sellerLines);
    var yB = partyBlock(L + colW + 10, 'Aan', buyerLines);
    doc.y = Math.max(yA, yB) + S.sectionGap;

    /* ---------- 3. gegevensstrook ---------- */
    var facts = [];
    function fact(label, value) { if (value) facts.push({ label: t(label), value: value }); }
    fact('Factuurnummer', snap.invoiceNumber);
    fact('Factuurdatum', formatDate(snap.invoiceDate, lang));
    fact('Vervaldatum', formatDate(snap.dueDate, lang));
    if (snap.paymentTermDays) fact('Betaaltermijn', t('{n} dagen', { n: snap.paymentTermDays }));
    if (snap.deliveryStart && snap.deliveryEnd) {
      fact('Leveringsperiode', formatPeriod(snap.deliveryStart, snap.deliveryEnd, lang));
    } else if (snap.deliveryStart) {
      fact('Leveringsdatum', formatDate(snap.deliveryStart, lang));
    }
    fact('Klantreferentie', snap.clientReference);
    fact('Inkoopordernummer', snap.purchaseOrder);
    if (cur !== 'EUR' && snap.rateToEur) {
      fact('Koers op factuurdatum', '1 EUR = ' + String(snap.rateToEur).replace('.', sepsFor(lang).dec) + ' ' + cur);
    }

    if (facts.length) {
      /* vier kolommen zodra er meer dan zes gegevens zijn: dan past de
         hele strook in twee rijen in plaats van drie, en dat is precies
         het verschil tussen een korte factuur van één vel en één van twee */
      var cols = facts.length > 6 ? 4 : 3;
      var rows = Math.ceil(facts.length / cols);
      var cellW = (CW - 8) / cols;
      var cellH = leading(S.kicker) + leading(S.base) + 0.8;
      var stripH = rows * cellH + 5;
      var stripTop = doc.y;
      if (S.metaCard) doc.rect(L, stripTop, CW, stripH, { fill: CREAM, radius: 2 });
      for (var fi = 0; fi < facts.length; fi++) {
        var c = fi % cols, r2 = Math.floor(fi / cols);
        var fx = L + (S.metaCard ? 4 : 0) + c * cellW;
        var fy2 = stripTop + 3 + r2 * cellH + leading(S.kicker) * 0.8;
        doc.text(facts[fi].label.toUpperCase(), fx, fy2, { size: S.kicker, color: MUTED, charSpace: 0.3, maxWidth: cellW - 4 });
        doc.text(facts[fi].value, fx, fy2 + leading(S.kicker) + 0.4,
          { size: S.base, font: isCodeLabel(facts[fi].label, t) ? 'mono' : 'regular', color: INK, maxWidth: cellW - 4 });
      }
      doc.y = stripTop + stripH + S.sectionGap * 0.8;
    }

    /* ---------- 4. introtekst ---------- */
    if (snap.introText) {
      doc.y = doc.paragraph(snap.introText, L, doc.y + leading(S.base) * 0.8, CW,
        { size: S.base, color: INK, leading: leading(S.base) }) + S.sectionGap * 0.5;
    }

    /* ---------- 5. de regeltabel ---------- */
    /* kolommen: alle x-waarden zijn RECHTERranden behalve de omschrijving,
       die links begint. Rechts uitlijnen is wat een bedragenkolom leesbaar
       maakt; in Helvetica zijn alle cijfers even breed, dus de komma's
       staan onder elkaar. */
    var COL = {
      descX: L,
      qtyR: L + CW * 0.535,
      priceR: L + CW * 0.695,
      discR: L + CW * 0.805,
      vatR: L + CW * 0.878,
      amountR: R
    };
    var descW = COL.qtyR - L - 26;

    function tableHead(continued) {
      if (continued) {
        doc.text(t('Vervolg'), COL.descX, doc.y, { size: S.kicker, color: accent, charSpace: 0.3 });
        doc.y += leading(S.kicker) + 0.6;
      }
      doc.text(t('Omschrijving'), COL.descX, doc.y, { size: S.kicker, color: MUTED, charSpace: 0.3 });
      doc.text(t('Aantal'), COL.qtyR, doc.y, { align: 'right', size: S.kicker, color: MUTED, charSpace: 0.3 });
      doc.text(t('Prijs per eenheid'), COL.priceR, doc.y, { align: 'right', size: S.kicker, color: MUTED, charSpace: 0.3 });
      doc.text(t('Korting'), COL.discR, doc.y, { align: 'right', size: S.kicker, color: MUTED, charSpace: 0.3 });
      doc.text(t('Btw'), COL.vatR, doc.y, { align: 'right', size: S.kicker, color: MUTED, charSpace: 0.3 });
      doc.text(t('Regelbedrag'), COL.amountR, doc.y, { align: 'right', size: S.kicker, color: MUTED, charSpace: 0.3 });
      doc.y += leading(S.kicker) + 1.4;
      doc.line(L, doc.y, R, doc.y, { color: accent, width: 0.6 });
      doc.y += 2.6;
    }

    var docLines = snap.lines || [];

    /* Een regel wordt EERST gemeten en dan pas getekend. Die volgorde is
       het hele geheim van een nette paginabreuk: pas als vaststaat hoe
       hoog een regel wordt, kan de tekenaar besluiten hem in zijn geheel
       naar de volgende pagina te verhuizen. Meten en tekenen gebruiken
       dezelfde regelarrays, dus ze kunnen niet uit elkaar lopen. */
    function measureRow(row) {
      var m = { desc: [], detail: [], height: 0 };
      if (row.type === 'heading') {
        m.desc = [row.description || ''];
        m.height = leading(S.base) + S.rowGap + 1.5;
        return m;
      }
      m.desc = P.wrapText(row.description || '', descW, { font: 'regular', size: S.base });
      if (row.detail) m.detail = P.wrapText(row.detail, descW, { font: 'regular', size: S.small });
      m.height = Math.max(m.desc.length, 1) * leading(S.base) +
        m.detail.length * leading(S.small) + S.rowGap;
      return m;
    }

    tableHead(false);
    for (var li = 0; li < docLines.length; li++) {
      var row = docLines[li];
      var m2 = measureRow(row);
      /* onderaan moet altijd nog de voettekst passen */
      if (doc.ensure(m2.height + 4)) tableHead(true);
      var top = doc.y;
      var yText = top + leading(S.base) * 0.78;

      if (row.type === 'heading') {
        doc.text(row.description || '', COL.descX, yText,
          { font: 'bold', size: S.base, color: accent, maxWidth: CW });
        doc.y = top + m2.height;
        continue;
      }

      for (var di = 0; di < m2.desc.length; di++) {
        doc.text(m2.desc[di], COL.descX, yText + di * leading(S.base), { size: S.base, color: INK });
      }
      var detailTop = yText + m2.desc.length * leading(S.base);
      for (var ei = 0; ei < m2.detail.length; ei++) {
        doc.text(m2.detail[ei], COL.descX, detailTop + ei * leading(S.small), { size: S.small, color: MUTED });
      }

      if (row.type !== 'text') {
        var qty = formatQuantity(row.quantityMicro, lang);
        var unit = row.unit ? (' ' + t(row.unit)) : '';
        doc.text(qty + unit, COL.qtyR, yText, { align: 'right', size: S.base, color: INK });
        doc.text(money(row.unitPriceCents), COL.priceR, yText, { align: 'right', size: S.base, color: INK });
        var disc = '';
        if (row.discountType === 'percent' && row.discountValue) disc = formatPercent(row.discountValue, lang);
        else if (row.discountType === 'amount' && row.discountValue) disc = money(row.discountValue);
        if (disc) doc.text(disc, COL.discR, yText, { align: 'right', size: S.base, color: MUTED });
        doc.text(formatPercent(row.rateMilli, lang), COL.vatR, yText, { align: 'right', size: S.small, color: MUTED });
        doc.text(money(row.netExclCents), COL.amountR, yText, { align: 'right', size: S.base, color: INK });
      }

      doc.y = top + m2.height;
      doc.line(L, doc.y - S.rowGap * 0.4, R, doc.y - S.rowGap * 0.4, { color: LINE, width: 0.2 });
    }

    /* toeslagen (verzend- en overige kosten) staan als eigen regels onder
       de tabel — ze zijn geen factuurregel maar horen wel zichtbaar te
       zijn, met hun eigen btw-grondslag */
    var sur = snap.surcharges || [];
    for (var si = 0; si < sur.length; si++) {
      var sRow = sur[si];
      var sh = leading(S.base) + S.rowGap;
      if (doc.ensure(sh + 4)) tableHead(true);
      var sTop = doc.y;
      var sY = sTop + leading(S.base) * 0.78;
      doc.text(sRow.label || t('Verzend- en overige kosten'), COL.descX, sY, { size: S.base, color: INK, maxWidth: descW });
      doc.text(formatPercent(sRow.rateMilli, lang), COL.vatR, sY, { align: 'right', size: S.small, color: MUTED });
      doc.text(money(sRow.amountCents), COL.amountR, sY, { align: 'right', size: S.base, color: INK });
      doc.y = sTop + sh;
      doc.line(L, doc.y - S.rowGap * 0.35, R, doc.y - S.rowGap * 0.35, { color: LINE, width: 0.2 });
    }

    doc.y += S.sectionGap * 0.6;

    /* ---------- 6. totalen ---------- */
    var totRows = [];
    function totRow(label, cents, o) {
      totRows.push({ label: label, cents: cents, strong: !!(o && o.strong), rule: !!(o && o.rule) });
    }
    totRow(t('Subtotaal'), totals.subtotalBeforeDiscountCents);
    if (totals.lineDiscountCents) totRow(t('Regelkortingen'), -totals.lineDiscountCents);
    if (totals.invoiceDiscountCents) totRow(t('Factuurkorting'), -totals.invoiceDiscountCents);
    if (totals.surchargeCents) totRow(t('Verzend- en overige kosten'), totals.surchargeCents);
    totRow(t('Totaal exclusief btw'), totals.totalExclCents, { rule: true });
    var groups = snap.taxGroups || [];
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      if (!g.charges && !g.vatCents) continue;
      totRow(t('Btw {p}%', { p: formatPercent(g.rateMilli, lang).replace('%', '') }), g.vatCents);
    }
    totRow(t('Totaal inclusief btw'), totals.totalInclCents, { strong: true, rule: true });
    if (totals.paidCents) totRow(t('Reeds betaald'), -totals.paidCents);
    if (totals.creditedCents) totRow(t('Gecrediteerd'), -totals.creditedCents);
    totRow(isCredit ? t('Openstaand bedrag') : t('Te betalen'), totals.outstandingCents, { strong: true, rule: true });

    var totW = 78;
    var totX = R - totW;
    var totPitch = leading(S.base) + 0.6;
    var totH = totRows.length * totPitch + 4;
    doc.ensure(totH + 4);
    var tTop = doc.y;
    for (var ti = 0; ti < totRows.length; ti++) {
      var tr = totRows[ti];
      var ty = tTop + ti * totPitch + leading(S.base) * 0.8;
      if (tr.rule) doc.line(totX, ty - leading(S.base) * 0.95, R, ty - leading(S.base) * 0.95, { color: LINE, width: 0.3 });
      doc.text(tr.label, totX, ty, {
        size: tr.strong ? S.base + 0.5 : S.base,
        font: tr.strong ? 'bold' : 'regular',
        color: tr.strong ? INK : MUTED, maxWidth: totW - 34
      });
      doc.text(money(tr.cents), R, ty, {
        align: 'right', size: tr.strong ? S.base + 0.5 : S.base,
        font: tr.strong ? 'bold' : 'regular', color: INK
      });
    }
    doc.y = tTop + totH;
    if (snap.pricesIncludeVat) {
      doc.text(t('Prijzen zijn inclusief btw.'), R, doc.y, { align: 'right', size: S.small, color: MUTED });
      doc.y += leading(S.small);
    }
    doc.y += S.sectionGap * 0.35;

    /* ---------- 7. btw-specificatie per code ---------- */
    if (groups.length) {
      var specH = (groups.length + 2) * (leading(S.small) + 1.4) + 6;
      doc.ensure(specH);
      doc.text(t('Btw-specificatie').toUpperCase(), L, doc.y, { size: S.kicker, color: MUTED, charSpace: 0.4 });
      doc.y += leading(S.kicker) + 1.6;
      var sc = { code: L, rate: L + 46, base: L + 84, vat: L + 122 };
      doc.text(t('Btw'), sc.code, doc.y, { size: S.kicker, color: MUTED });
      doc.text(t('Tarief'), sc.rate, doc.y, { align: 'right', size: S.kicker, color: MUTED });
      doc.text(t('Grondslag'), sc.base, doc.y, { align: 'right', size: S.kicker, color: MUTED });
      doc.text(t('Btw-bedrag'), sc.vat, doc.y, { align: 'right', size: S.kicker, color: MUTED });
      doc.y += leading(S.kicker) + 1;
      doc.line(L, doc.y, sc.vat, doc.y, { color: LINE, width: 0.3 });
      doc.y += 2;
      for (var gj = 0; gj < groups.length; gj++) {
        var gr = groups[gj];
        var gy = doc.y + leading(S.small) * 0.8;
        doc.text(t(gr.label || gr.taxCode), sc.code, gy, { size: S.small, color: INK, maxWidth: 44 });
        doc.text(formatPercent(gr.rateMilli, lang), sc.rate, gy, { align: 'right', size: S.small, color: INK });
        doc.text(money(gr.baseCents), sc.base, gy, { align: 'right', size: S.small, color: INK });
        doc.text(money(gr.vatCents), sc.vat, gy, { align: 'right', size: S.small, color: INK });
        doc.y = gy + leading(S.small) * 0.35;
      }
      /* de wettelijke vermeldingen (verlegd, vrijstelling, intracommunau-
         taire levering) horen op het vel, niet in een voetnoot die
         wegvalt */
      var notes = [];
      for (var gk = 0; gk < groups.length; gk++) {
        var note = groups[gk].legalNoteNl;
        if (note && notes.indexOf(note) < 0) notes.push(note);
      }
      if (notes.length) {
        var ny = doc.y + leading(S.small) * 1.4;
        for (var ni = 0; ni < notes.length; ni++) {
          ny = doc.paragraph(t(notes[ni]), L, ny, CW * 0.62,
            { size: S.small, color: MUTED, leading: leading(S.small) });
        }
        doc.y = ny;
      }
      doc.y += S.sectionGap * 0.45;
    }

    /* ---------- 8. betaalblok met QR ---------- */
    /* Twee kolommen naast elkaar in plaats van vijf regels onder elkaar:
       de bankgegevens links, het te betalen bedrag en het kenmerk rechts.
       Dat is niet alleen korter (het scheelt een halve pagina bij een
       kleine factuur) maar leest ook beter — wie betaalt heeft twee dingen
       nodig, en die staan nu naast elkaar in plaats van in een rij. */
    var qr = qrPathFor(snap, opts);
    var payLeft = [];
    var payRight = [];
    if (seller.iban) payLeft.push({ label: t('IBAN'), value: seller.iban, mono: true });
    if (seller.bic) payLeft.push({ label: t('BIC of SWIFT'), value: seller.bic, mono: true });
    if (seller.name) payLeft.push({ label: t('Op naam van'), value: seller.name, mono: false });
    payRight.push({ label: t('Bedrag'), value: money(totals.outstandingCents), mono: false });
    if (snap.invoiceNumber) payRight.push({ label: t('Betalingskenmerk'), value: snap.invoiceNumber, mono: true });

    var instr = snap.paymentInstructions || '';
    var payInner = CW - 12 - (qr ? S.qrSize + 8 : 0);
    var colGap = payInner / 2;
    var instrLines = instr ? P.wrapText(instr, payInner, { size: S.small }).length : 0;
    var payRows = Math.max(payLeft.length, payRight.length);
    var payH = 5.5 + leading(S.kicker) * 1.8 + 1.2 +
      instrLines * leading(S.small) + (instr ? leading(S.small) * 0.4 : 0) +
      payRows * (leading(S.small) + 0.6) + 3;
    if (qr) payH = Math.max(payH, S.qrSize + 12);
    doc.ensure(payH + 4);
    var pTop = doc.y;
    doc.rect(L, pTop, CW, payH, { fill: CREAM, radius: 2.5 });
    doc.rect(L, pTop, 1.2, payH, { fill: accent });
    var px = L + 6;
    var py = pTop + 5 + leading(S.kicker) * 0.8;
    doc.text(t('Betaalinstructie').toUpperCase(), px, py, { size: S.kicker, color: MUTED, charSpace: 0.4 });
    py += leading(S.kicker) + 1.2;
    if (instr) {
      py = doc.paragraph(instr, px, py, payInner,
        { size: S.small, color: INK, leading: leading(S.small) }) + leading(S.small) * 0.4;
    }
    var labelW = Math.min(30, colGap * 0.42);
    function payColumn(list, x) {
      var cy2 = py;
      for (var pi = 0; pi < list.length; pi++) {
        var pl = list[pi];
        doc.text(pl.label, x, cy2, { size: S.small, color: MUTED, maxWidth: labelW - 2 });
        doc.text(pl.value, x + labelW, cy2,
          { size: S.small, font: pl.mono ? 'mono' : 'regular', color: INK, maxWidth: colGap - labelW - 3 });
        cy2 += leading(S.small) + 0.6;
      }
    }
    payColumn(payLeft, px);
    payColumn(payRight, px + colGap);
    if (qr) {
      /* het SVG-pad van portal/qr.js, één op één als PDF-vectorpad:
         oneindig scherp, geen rasterbeeld, geen extra bestand */
      var qx = R - S.qrSize - 6;
      var qy = pTop + (payH - S.qrSize) / 2 - 1;
      doc.rect(qx - 1.5, qy - 1.5, S.qrSize + 3, S.qrSize + 3, { fill: '#ffffff', radius: 1.5 });
      var qscale = S.qrSize / qr.box;
      doc.svgPath(qr.d, { x: qx + qr.margin * qscale, y: qy + qr.margin * qscale, scale: qscale, fill: INK });
      doc.text(t('Scan met je bank-app'), qx + S.qrSize / 2, qy + S.qrSize + 4,
        { align: 'center', size: 6.4, color: MUTED });
    }
    doc.y = pTop + payH + S.sectionGap * 0.4;

    /* ---------- 9. afsluittekst ---------- */
    if (snap.outroText) {
      doc.ensure(leading(S.small) * (P.wrapText(snap.outroText, CW, { size: S.small }).length + 1));
      doc.y = doc.paragraph(snap.outroText, L, doc.y + leading(S.small) * 0.8, CW,
        { size: S.small, color: MUTED, leading: leading(S.small) });
    }

    return doc.build();
  }

  /* ============================================================
     6. DE HAAK UIT FASE 2
     ============================================================
     Stap 6 van het definitief maken roept CP_INVOICE_PDF.generate() aan.
     Dit bestand doet zelf geen IO — het weet niets van IndexedDB, van
     Supabase storage of van documentrecords. De aanroeper (beheer.html)
     meldt via setStore() hoe bytes bewaard worden; hier staat alleen de
     volgorde: renderen, bewaren, terugmelden.

     Zonder opslag geeft generate() nog steeds de bytes terug en zegt
     eerlijk dat er niets is bewaard. Dat is beter dan stil doen alsof. */
  var storeFn = null;
  function setStore(fn) { storeFn = (typeof fn === 'function') ? fn : null; }

  function generate(snapshot, context) {
    context = context || {};
    var bytes;
    try {
      bytes = render(snapshot, {
        brand: context.brand,
        lang: context.lang || (snapshot && snapshot.language),
        t: context.t,
        date: context.date,
        qr: context.qr
      });
    } catch (e) {
      return Promise.reject(e);
    }
    var used = normalizeBrand(context.brand);
    var meta = {
      bytes: bytes,
      size: bytes.length,
      filename: filename(snapshot),
      template: used.template,
      templateVersion: TEMPLATE_VERSION,
      brand: used,
      generatorVersion: VERSION
    };
    if (!storeFn) {
      return Promise.resolve({
        ok: true, bytes: bytes, meta: meta,
        detail: 'PDF gegenereerd (' + Math.round(bytes.length / 1024) + ' kB), maar er is geen opslag aangesloten — het bestand is niet bewaard.'
      });
    }
    /* De opslag wordt IN een then gestart, niet ervoor. Gooit hij synchroon
       (en dat doet hij: "deze factuur heeft al een PDF" is een gewone
       throw), dan zou Promise.resolve(storeFn(...)) die fout langs de
       promise heen naar buiten gooien en zou de aanroeper hem met .catch
       nooit vangen. Zo komt élke fout als afwijzing terug. */
    return Promise.resolve().then(function () {
      return storeFn(meta, snapshot, context);
    }).then(function (res) {
      return {
        ok: true, bytes: bytes, meta: meta,
        detail: (res && res.detail) ||
          ('Definitieve PDF gegenereerd en versie-vast bewaard (' + Math.round(bytes.length / 1024) +
            ' kB, sjabloon “' + (TEMPLATES[meta.template] || TEMPLATES.standaard).label + '” v' + TEMPLATE_VERSION + ').')
      };
    });
  }

  return {
    VERSION: VERSION,
    TEMPLATE_VERSION: TEMPLATE_VERSION,
    TEMPLATES: TEMPLATES,
    TEMPLATE_KEYS: TEMPLATE_KEYS,
    CLIENT_STRINGS: CLIENT_STRINGS,
    INK: INK, MUTED: MUTED, LINE: LINE, CREAM: CREAM,
    brandDefaults: brandDefaults,
    normalizeBrand: normalizeBrand,
    translator: translator,
    formatMoney: formatMoney,
    formatQuantity: formatQuantity,
    formatPercent: formatPercent,
    formatDate: formatDate,
    filename: filename,
    render: render,
    setStore: setStore,
    generate: generate
  };
});
