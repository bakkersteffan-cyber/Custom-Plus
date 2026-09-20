/* CUSTOM+ — factuurrekenkern.
   ------------------------------------------------------------------
   DIT IS DE ENIGE PLEK WAAR FACTUURWISKUNDE LEEFT. beheer.html,
   portal.html en netlify/functions/invoice-validate.mjs rekenen alle drie
   met exact deze code. Wie hier een regel verandert, verandert hem in de
   browser én op de server tegelijk — dat is precies de bedoeling: een
   factuur die in het beheer 1.234,56 zegt en op de server 1.234,55 is een
   factuur die je niet kunt verdedigen bij de Belastingdienst.

   GELD IS ALTIJD EEN GEHEEL GETAL IN DE KLEINSTE MUNTEENHEID (centen).
   Er staat in dit bestand geen enkele berekening met kommagetallen: elke
   deling loopt via divRound() met twee gehele getallen. Kommagetallen die
   binnenkomen (een aantal van 2,5 uur, een kortingspercentage van 12,5%,
   een btw-tarief van 5,5%) worden eerst naar gehele getallen geschaald:
     · aantal            × 1.000.000  (qtyMicro)
     · percentage/tarief × 1.000      (pctMilli / rateMilli)
   Zo is 21% btw over € 100,00 een som van gehele getallen en nooit een
   0.30000000000000004.

   AFRONDEN — één regel, overal: HALF NAAR BOVEN IN ABSOLUTE WAARDE
   (commercieel afronden). 0,5 cent wordt 1 cent, en -0,5 cent wordt
   -1 cent. Bewust symmetrisch rond nul: alleen dan is een creditregel
   exact het spiegelbeeld van de originele regel, en dat is de enige
   manier waarop een creditfactuur een factuur ook echt op nul zet.
   Wiskundig "half up" zou -0,5 naar 0 duwen en dan blijft er een cent
   staan die niemand kan verklaren.

   BTW WORDT PER REGEL BEREKEND en per btw-code opgeteld. Dat is de keuze
   die maakt dat een regel met een INCLUSIEF ingevoerde prijs exact
   uitkomt op wat de gebruiker typte (€ 100,00 incl. blijft € 100,00
   incl.). De prijs van die keuze is dat een btw-totaal een enkele cent
   kan afwijken van "grondslag × tarief" wanneer een factuur veel regels
   heeft; dat is toegestaan en is wat boekhoudpakketten doen. De
   factuurkorting en de verzendkosten krijgen hun eigen btw-berekening op
   de toegewezen grondslag.

   Publieke API (globalThis.CP_INVOICE, en module.exports in Node):
     VERSION, ROUNDING
     divRound(numer, denom)              gehele deling, half van nul af
     roundHalfUp(value)                  idem voor één kommagetal
     parseAmountToMinor(input, minor)    "1.234,56" → 123456
     formatMinor(cents, minorUnits)      123456 → "1234.56" (ruwe tekst)
     parseQuantity(input)                "2,5" → 2500000 (qtyMicro)
     parsePercent(input)                 "12,5" → 12500 (pctMilli)
     minorUnitsFor(currency)             EUR → 2, JPY → 0
     allocateProportional(total, w[])    grootste-restverdeling; de som is
                                         altijd exact `total`, en of de
                                         verdeling ook evenredig kón staat
                                         als .ok/.reason op de uitkomst
     TAX_TREATMENTS / treatmentOf()      btw-behandelingen + wettelijke tekst
     DEFAULT_TAX_CODES / taxCodeOf()
     LINE_TYPES
     STATUSES / STATUS_META / TRANSITIONS / canTransition()
     computeLine(line, ctx)
     computeInvoice(invoice, opts)       de complete uitkomst
     settlement(totals, opts)            betaald / deels / open / te veel /
                                         gecrediteerd — zelfde volgorde als
                                         recalc_invoice_settlement() in 0012
     validateInvoice(invoice, opts)      verplichte velden + btw-consistentie

   LADEN
     browser : <script src="portal/invoice-core.js"></script> vóór het
               hoofdscript van beheer.html / portal.html
     node    : import '../../portal/invoice-core.js' (of require) — het
               bestand zet zichzelf op globalThis EN op module.exports,
               dus beide vormen werken zonder buildstap.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_INVOICE = api;
  /* Node/CommonJS: er is geen package.json met "type":"module", dus dit
     bestand is daar CJS en dit is een echte export. Draait het ooit als
     ESM, dan bestaat `module` niet en blijft alleen globalThis over —
     invoice-validate.mjs kan tegen allebei. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var ROUNDING = 'half-weg-van-nul';
  var MAX_SAFE = 9007199254740991;       /* Number.MAX_SAFE_INTEGER */

  var QTY_SCALE = 1000000;               /* aantal × 1e6 */
  var PCT_SCALE = 1000;                  /* percentage × 1e3 */
  var PCT_FULL = 100 * PCT_SCALE;        /* 100% in pctMilli = 100000 */

  /* ============================================================
     1. REKENPRIMITIEVEN — alles geheel, niets drijft
     ============================================================ */

  /* gehele deling met commerciële afronding (half van nul af).
     numer en denom zijn gehele getallen, denom > 0. De correctielus vangt
     de laatste ulp van de float-deling af, zodat q*denom exact klopt. */
  function divRound(numer, denom) {
    if (!isFinite(numer) || !isFinite(denom) || denom <= 0) return 0;
    var neg = numer < 0;
    var n = neg ? -numer : numer;
    var q = Math.floor(n / denom);
    var r = n - q * denom;
    while (r < 0) { q -= 1; r += denom; }
    while (r >= denom) { q += 1; r -= denom; }
    if (r * 2 >= denom) q += 1;
    return neg ? -q : q;
  }

  /* één kommagetal naar een geheel getal, zelfde afrondregel. Alleen voor
     de randen van het systeem (invoer parsen); binnenin rekent alles met
     divRound. */
  function roundHalfUp(value) {
    if (!isFinite(value)) return 0;
    return value < 0 ? -Math.round(-value) : Math.round(value);
  }

  /* raakt een vermenigvuldiging buiten het veilige integerbereik, dan
     liegen we niet met een afgerond antwoord maar melden we het. */
  function safeMul(a, b) {
    var p = a * b;
    if (!isFinite(p) || Math.abs(p) > MAX_SAFE) return null;
    return p;
  }

  /* ============================================================
     2. VALUTA-PRECISIE
     ============================================================ */
  /* De opslag is ALTIJD een geheel getal in de kleinste munteenheid. Voor
     EUR/USD/CNY is dat de cent (2 decimalen), voor JPY de yen zelf (0).
     Omdat alles al in kleinste eenheden rekent, is de precisie precies
     hier zichtbaar: bij een 0-decimalenvaluta rondt btw vanzelf op hele
     yen af, want de uitkomst is een geheel getal. */
  var CURRENCY_MINOR_UNITS = {
    EUR: 2, USD: 2, CNY: 2, GBP: 2, CHF: 2, SEK: 2, DKK: 2, NOK: 2,
    PLN: 2, CZK: 2, HUF: 2, AUD: 2, CAD: 2, HKD: 2, SGD: 2, INR: 2,
    JPY: 0, KRW: 0, VND: 0, IDR: 0, CLP: 0, ISK: 0
  };
  function minorUnitsFor(currency) {
    var c = String(currency || 'EUR').toUpperCase();
    return Object.prototype.hasOwnProperty.call(CURRENCY_MINOR_UNITS, c)
      ? CURRENCY_MINOR_UNITS[c] : 2;
  }
  function pow10(n) {
    var p = 1;
    for (var i = 0; i < n; i++) p *= 10;
    return p;
  }

  /* ============================================================
     3. INVOER PARSEN
     ============================================================
     Eén gedocumenteerde regel voor decimaaltekens, want "1.234" is in
     Nederland duizendtallen en in Amerika een komma-getal:
       · staan er ZOWEL punten als komma's in, dan is het LAATSTE van de
         twee het decimaalteken en is de ander duizendscheider. Zo lezen
         "1.234,56" en "1,234.56" allebei als 1234,56;
       · staat er alleen een KOMMA in, dan is die altijd het decimaalteken.
         De komma is in het Nederlands nu eenmaal het decimaalteken, en
         "10,005" moet 10,005 blijven en geen tienduizend worden;
       · staat er alleen een PUNT in, dan is die het decimaalteken —
         TENZIJ het getal precies het duizendpatroon volgt ("1.234" of
         "1.234.567" → 1234 en 1234567). "12.34" blijft dus 12,34;
       · spaties, harde spaties, apostrofs en valutatekens vallen weg.
     De uitkomst is een geheel getal in de gevraagde schaal; te veel
     decimalen worden commercieel afgerond. Onleesbare invoer geeft null,
     nooit stilletjes 0. */
  function parseDecimalToScale(input, scale) {
    if (input === null || input === undefined) return null;
    var s;
    if (typeof input === 'number') {
      if (!isFinite(input)) return null;
      s = String(input);
      /* wetenschappelijke notatie is voor geld nooit invoer, maar vang hem
         af zodat 1e-7 geen "1e-7" als tekst wordt geparsed */
      if (s.indexOf('e') > -1 || s.indexOf('E') > -1) s = input.toFixed(12);
    } else {
      s = String(input);
    }
    s = s.replace(/[\s  ']/g, '').replace(/[€$£¥]/g, '');
    if (!s) return null;
    var neg = false;
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
    else if (s.charAt(0) === '+') { s = s.slice(1); }
    if (!/^[0-9.,]*$/.test(s) || !/[0-9]/.test(s)) return null;

    var intPart, fracPart = '';
    var lastComma = s.lastIndexOf(',');
    var lastDot = s.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
      /* beide tekens: de laatste is het decimaalteken */
      var dec = Math.max(lastComma, lastDot);
      intPart = s.slice(0, dec).replace(/[.,]/g, '');
      fracPart = s.slice(dec + 1).replace(/[.,]/g, '');
    } else if (lastComma > -1) {
      /* alleen komma's: de laatste komma is het decimaalteken */
      intPart = s.slice(0, lastComma).replace(/,/g, '');
      fracPart = s.slice(lastComma + 1).replace(/,/g, '');
    } else if (lastDot > -1) {
      /* alleen punten: duizendpatroon of decimaalteken */
      var thousandsLook = /^[0-9]{1,3}(\.[0-9]{3})+$/.test(s);
      if (thousandsLook) {
        intPart = s.replace(/\./g, '');
      } else {
        intPart = s.slice(0, lastDot).replace(/\./g, '');
        fracPart = s.slice(lastDot + 1);
      }
    } else {
      intPart = s;
    }
    if (intPart === '') intPart = '0';
    if (!/^[0-9]+$/.test(intPart) || (fracPart !== '' && !/^[0-9]+$/.test(fracPart))) return null;

    /* schaal toepassen zonder ooit te vermenigvuldigen met een float:
       de breuk wordt op lengte gebracht en de rest afgerond. */
    var digits = String(scale).length - 1;          /* scale is een macht van 10 */
    var whole = Number(intPart);
    var scaled = safeMul(whole, scale);
    if (scaled === null) return null;
    if (fracPart.length > digits) {
      var keep = Number(fracPart.slice(0, digits) || '0');
      var restStr = fracPart.slice(digits);
      var half = restStr.charAt(0) >= '5';
      scaled += keep + (half ? 1 : 0);
    } else {
      var padded = fracPart;
      while (padded.length < digits) padded += '0';
      scaled += Number(padded || '0');
    }
    if (Math.abs(scaled) > MAX_SAFE) return null;
    return neg ? -scaled : scaled;
  }

  function parseAmountToMinor(input, minorUnits) {
    var mu = (minorUnits === undefined || minorUnits === null) ? 2 : minorUnits;
    return parseDecimalToScale(input, pow10(mu));
  }
  function parseQuantity(input) { return parseDecimalToScale(input, QTY_SCALE); }
  function parsePercent(input) { return parseDecimalToScale(input, PCT_SCALE); }

  /* ruwe, taalneutrale weergave met een punt als decimaalteken — voor
     logs, tests en de UBL-export. De klantgerichte opmaak doet de UI zelf
     met Intl.NumberFormat in de taal van de klant. */
  function formatMinor(cents, minorUnits) {
    var mu = (minorUnits === undefined || minorUnits === null) ? 2 : minorUnits;
    var n = Math.round(cents || 0);
    var neg = n < 0;
    var abs = String(neg ? -n : n);
    if (mu === 0) return (neg ? '-' : '') + abs;
    while (abs.length <= mu) abs = '0' + abs;
    return (neg ? '-' : '') + abs.slice(0, abs.length - mu) + '.' + abs.slice(abs.length - mu);
  }

  /* ============================================================
     4. GROOTSTE-RESTVERDELING
     ============================================================
     Een factuurkorting van € 10,00 over twee btw-groepen van € 33,33 en
     € 66,67 mag niet € 3,33 + € 6,67 = € 10,00 net níet worden. Deze
     verdeling geeft eerst ieders hele deel en legt de resterende centen
     bij de grootste resten neer, zodat de som exact het totaal is.

     DE GEWICHTEN WEGEN GETEKEND, NIET OP ABSOLUTE WAARDE.
     Een btw-groep kan negatief zijn — een coulanceregel, een verrekening,
     een retour. Die groep hoort dan een NEGATIEF deel van de korting te
     krijgen. Dat is het evenredige antwoord: elke groep wordt met dezelfde
     factor geschaald.
       regels +€ 10,00 (21%) en -€ 1,00 (9%), netto € 9,00, korting € 0,90
       → 21% krijgt +€ 1,00 en 9% krijgt -€ 0,10; samen € 0,90, en beide
         groepen krimpen met 10% (1000→900 en -100→-90).
     Met een absolute weging kreeg de negatieve groep +8 cent toegewezen en
     werd hij -108 in plaats van -90: het eindtotaal klopte, maar de korting
     liep de verkeerde kant op en de btw per groep was fout.

     DE UITKOMST DRAAGT ZIJN EIGEN EERLIJKHEID MEE.
     De teruggave is altijd een gewone array waarvan de som exact `total`
     is. Of de verdeling ook echt EVENREDIG kon, staat als niet-opsombaar
     veld op die array: `ok` (true/false) en `reason`. Niet-opsombaar, zodat
     de uitkomst voor de rest van de wereld een doodgewone array blijft
     (JSON, forEach, vergelijken). computeInvoice() maakt van ok:false een
     harde validatiefout — vroeger stond in het commentaar dat de aanroeper
     dat deed, maar deed geen enkele aanroeper het. */
  var ALLOC_OVERLOOP = 'overloop';
  var ALLOC_GEEN_SLEUTEL = 'gewichten_heffen_elkaar_op';

  function markAllocation(out, ok, reason) {
    Object.defineProperty(out, 'ok', { value: !!ok, enumerable: false, writable: true, configurable: true });
    Object.defineProperty(out, 'reason', { value: reason || '', enumerable: false, writable: true, configurable: true });
    return out;
  }

  function allocateProportional(total, weights) {
    var n = weights ? weights.length : 0;
    var out = [], i, w;
    for (i = 0; i < n; i++) out.push(0);
    markAllocation(out, true, '');
    if (!n || !total) return out;

    var sum = 0, maxAbs = 0, heeftGewicht = false;
    for (i = 0; i < n; i++) {
      w = weights[i] || 0;
      sum += w;
      if (w !== 0) heeftGewicht = true;
      if (Math.abs(w) > maxAbs) maxAbs = Math.abs(w);
    }
    if (sum === 0) {
      /* Evenredig verdelen is hier delen door nul. Twee gevallen, en ze
         verdienen niet hetzelfde antwoord:
           · staan ALLE gewichten op nul, dan is er domweg geen
             verdeelsleutel. Alles valt op de eerste groep; dat is de
             bestaande, bewust gedocumenteerde keuze en het totaal blijft
             exact kloppen;
           · heffen de gewichten elkaar precies op (+100 en -100), dan is
             er wél een sleutel maar geen antwoord. Alles valt dan óók op de
             eerste groep — het totaal moet kloppen — maar mét een signaal,
             want elke andere verdeling zou net zo willekeurig zijn en de
             btw per groep is dan niet te verdedigen. */
      out[0] = total;
      if (heeftGewicht) markAllocation(out, false, ALLOC_GEEN_SLEUTEL);
      return out;
    }

    /* Een negatief totaal wordt gespiegeld berekend, zodat crediteren exact
       het spiegelbeeld is van de originele verdeling (zie de afrondregel
       bovenaan dit bestand). */
    var neg = total < 0;
    var t = neg ? -total : total;

    /* De gewichten worden in de richting van hun eigen som gelegd, zodat de
       noemer positief is. Het teken van de som valt daarmee weg uit de
       verdeling en niet uit de uitkomst: een factuur die helemaal negatief
       is (een creditnota) verdeelt precies gespiegeld. */
    var richting = sum < 0 ? -1 : 1;
    var denom = sum < 0 ? -sum : sum;

    /* het grootste product dat hieronder voorkomt is t × het zwaarste
       gewicht; mengen de tekens, dan kan dat groter zijn dan t × som */
    if (safeMul(t, maxAbs) === null) {
      /* buiten het veilige bereik: liever eerlijk niets verdelen dan een
         stil verkeerd antwoord. Het totaal blijft kloppen, de verdeling
         niet — en dat meldt dit signaal aan computeInvoice(). */
      out[0] = total;
      return markAllocation(out, false, ALLOC_OVERLOOP);
    }
    var rems = [], assigned = 0;
    for (i = 0; i < n; i++) {
      var v = (weights[i] || 0) * richting;
      var exact = t * v;
      var part = Math.floor(exact / denom);
      var r = exact - part * denom;
      while (r < 0) { part -= 1; r += denom; }
      while (r >= denom) { part += 1; r -= denom; }
      out[i] = part;
      rems.push({ i: i, r: r });
      assigned += part;
    }
    /* de resten liggen per stuk in [0, denom) en tellen samen op tot een
       geheel aantal eenheden; die gaan naar de grootste resten */
    var left = t - assigned;
    rems.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (i = 0; i < left && i < rems.length; i++) out[rems[i].i] += 1;
    if (neg) for (i = 0; i < n; i++) out[i] = -out[i];
    return out;
  }

  /* ============================================================
     5. BTW-BEHANDELINGEN
     ============================================================
     Per behandeling: of er btw wordt gerekend, of er een btw-nummer van de
     AFNEMER nodig is, en welke wettelijke vermelding op de factuur hoort.
     De vermeldingen zijn NEDERLANDSE BRONSTRINGS: de factuur wordt in de
     taal van de klant gedrukt, dus beheer.html haalt ze door invT() en
     portal.html door i18nT() — beide lezen portal/i18n.js, waar deze
     zinnen in alle vier de vertalingen staan.
     'Btw verlegd naar de afnemer.' en 'Btw 0% (export).' bestonden al sinds
     golf 1 en worden hier LETTERLIJK hergebruikt; ze staan dus maar één
     keer in het woordenboek en buildInvoiceDoc in beheer.html blijft
     precies dezelfde zin drukken. */
  var TAX_TREATMENTS = {
    standard: {
      key: 'standard',
      label: 'Belast',
      charges: true,
      forcesZeroRate: false,
      needsBuyerVat: false,
      legalNoteNl: ''
    },
    zero: {
      key: 'zero',
      label: '0% (export)',
      charges: false,
      forcesZeroRate: true,
      needsBuyerVat: false,
      legalNoteNl: 'Btw 0% (export).'
    },
    exempt: {
      key: 'exempt',
      label: 'Vrijgesteld',
      charges: false,
      forcesZeroRate: true,
      needsBuyerVat: false,
      legalNoteNl: 'Vrijgesteld van btw.'
    },
    reverse: {
      key: 'reverse',
      label: 'Btw verlegd',
      charges: false,
      forcesZeroRate: true,
      needsBuyerVat: true,
      legalNoteNl: 'Btw verlegd naar de afnemer.'
    },
    intracom: {
      key: 'intracom',
      label: 'Intracommunautaire levering',
      charges: false,
      forcesZeroRate: true,
      needsBuyerVat: true,
      legalNoteNl: 'Intracommunautaire levering — btw verlegd naar de afnemer.'
    }
  };
  var TREATMENT_KEYS = ['standard', 'zero', 'exempt', 'reverse', 'intracom'];
  function treatmentOf(key) {
    return TAX_TREATMENTS[key] || TAX_TREATMENTS.standard;
  }

  /* De standaardreeks btw-codes. Live komen ze uit de tabel tax_codes;
     deze lijst is de bron voor de demomodus en de terugval wanneer een
     factuur naar een code verwijst die niet meer bestaat. rateMilli is het
     percentage × 1000, dus 21% = 21000 en 5,5% = 5500. */
  var DEFAULT_TAX_CODES = [
    { code: 'NL21', label: 'Btw 21%', rateMilli: 21000, treatment: 'standard', active: true },
    { code: 'NL9', label: 'Btw 9%', rateMilli: 9000, treatment: 'standard', active: true },
    { code: 'NL0', label: 'Btw 0% (export)', rateMilli: 0, treatment: 'zero', active: true },
    { code: 'VRIJ', label: 'Vrijgesteld', rateMilli: 0, treatment: 'exempt', active: true },
    { code: 'VERLEGD', label: 'Btw verlegd', rateMilli: 0, treatment: 'reverse', active: true },
    { code: 'ICP', label: 'Intracommunautair', rateMilli: 0, treatment: 'intracom', active: true }
  ];

  /* De oude drie vat-modes uit golf 1 (verlegd | 0 | 21) blijven bestaan op
     al geboekte facturen. Deze tabel vertaalt ze naar btw-codes, zodat er
     geen enkele bestaande factuur hoeft te worden aangeraakt. */
  var LEGACY_VAT_MODE_TO_CODE = { verlegd: 'VERLEGD', '0': 'NL0', '21': 'NL21' };

  function taxCodeOf(code, table) {
    var list = (table && table.length) ? table : DEFAULT_TAX_CODES;
    var want = String(code || '').trim();
    var i;
    for (i = 0; i < list.length; i++) {
      if (String(list[i].code) === want) return normaliseTaxCode(list[i]);
    }
    if (Object.prototype.hasOwnProperty.call(LEGACY_VAT_MODE_TO_CODE, want)) {
      return taxCodeOf(LEGACY_VAT_MODE_TO_CODE[want], list);
    }
    return null;
  }
  function normaliseTaxCode(tc) {
    var tr = treatmentOf(tc.treatment);
    var rate = Math.round(Number(tc.rateMilli) || 0);
    if (tr.forcesZeroRate) rate = 0;
    return {
      code: String(tc.code),
      label: String(tc.label || tc.code),
      rateMilli: rate,
      treatment: tr.key,
      charges: tr.charges && rate > 0,
      needsBuyerVat: tr.needsBuyerVat,
      legalNoteNl: tr.legalNoteNl,
      active: tc.active !== false
    };
  }

  /* ============================================================
     6. REGELTYPES
     ============================================================
     Een tekstregel en een tussenkop dragen tekst en verder niets: ze
     tellen NIET mee in enig totaal en krijgen dus ook geen btw-code.
     Alleen 'item' is een bedragregel. */
  var LINE_TYPES = ['item', 'text', 'heading'];
  function lineTypeOf(t) {
    var k = String(t || 'item');
    return LINE_TYPES.indexOf(k) > -1 ? k : 'item';
  }

  /* ============================================================
     7. STATUSMODEL
     ============================================================ */
  var STATUSES = [
    'draft', 'scheduled', 'finalized', 'sent', 'viewed', 'partially_paid',
    'paid', 'overdue', 'disputed', 'cancelled', 'credited', 'uncollectible'
  ];
  var STATUS_META = {
    draft:          { label: 'Concept',        editable: true,  numbered: false, terminal: false, clientVisible: false },
    scheduled:      { label: 'Ingepland',      editable: true,  numbered: false, terminal: false, clientVisible: false },
    finalized:      { label: 'Definitief',     editable: false, numbered: true,  terminal: false, clientVisible: true },
    sent:           { label: 'Verstuurd',      editable: false, numbered: true,  terminal: false, clientVisible: true },
    viewed:         { label: 'Bekeken',        editable: false, numbered: true,  terminal: false, clientVisible: true },
    partially_paid: { label: 'Deels betaald',  editable: false, numbered: true,  terminal: false, clientVisible: true },
    paid:           { label: 'Betaald',        editable: false, numbered: true,  terminal: false, clientVisible: true },
    overdue:        { label: 'Vervallen',      editable: false, numbered: true,  terminal: false, clientVisible: true },
    disputed:       { label: 'Betwist',        editable: false, numbered: true,  terminal: false, clientVisible: true },
    cancelled:      { label: 'Geannuleerd',    editable: false, numbered: true,  terminal: true,  clientVisible: false },
    credited:       { label: 'Gecrediteerd',   editable: false, numbered: true,  terminal: true,  clientVisible: true },
    uncollectible:  { label: 'Oninbaar',       editable: false, numbered: true,  terminal: false, clientVisible: true }
  };

  /* De transitietabel. Wat er niet staat, mag niet.
     Twee dingen zitten er BEWUST niet in:
       · geen enkele weg terug naar 'draft' vanaf 'finalized' of later —
         een definitieve factuur corrigeer je met een creditfactuur, niet
         door hem weer open te klappen;
       · 'cancelled' en 'credited' zijn eindpunten. */
  var TRANSITIONS = {
    draft:          ['scheduled', 'finalized', 'cancelled'],
    scheduled:      ['draft', 'finalized', 'cancelled'],
    finalized:      ['sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'disputed', 'cancelled', 'credited', 'uncollectible'],
    sent:           ['viewed', 'partially_paid', 'paid', 'overdue', 'disputed', 'cancelled', 'credited', 'uncollectible'],
    viewed:         ['partially_paid', 'paid', 'overdue', 'disputed', 'cancelled', 'credited', 'uncollectible'],
    /* FASE 5 voegde 'sent' toe aan partially_paid en 'sent' + 'overdue' aan
       paid. Dat lijkt in strijd met "betaald kan niet alsnog vervallen",
       maar is het niet: die regel is van fase 1, toen een betaling nog niet
       teruggeboekt kón worden. Zodra een betaling wordt gestorneerd staat
       er weer geld open, en dan is 'Betaald' een leugen. canTransition()
       hieronder laat deze drie overgangen daarom ALLEEN toe wanneer de
       aanroeper expliciet meldt dat er niets meer betaald is
       (ctx.paidCents === 0). Zonder die context blijven ze verboden, en
       blijft de regel van fase 1 dus letterlijk overeind. */
    partially_paid: ['paid', 'overdue', 'disputed', 'credited', 'uncollectible', 'sent'],
    paid:           ['partially_paid', 'disputed', 'credited', 'overdue', 'sent'],
    overdue:        ['partially_paid', 'paid', 'disputed', 'cancelled', 'credited', 'uncollectible'],
    disputed:       ['sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited', 'uncollectible'],
    cancelled:      [],
    credited:       [],
    uncollectible:  ['partially_paid', 'paid', 'credited']
  };

  /* De drie overgangen die fase 5 toevoegde en die ALLEEN met een
     expliciete ctx.paidCents === 0 mogen. Zie de toelichting in TRANSITIONS. */
  var REOPEN_AFTER_REVERSAL = {
    'paid>overdue': true,
    'paid>sent': true,
    'partially_paid>sent': true
  };

  /* canTransition kent naast de tabel twee harde werkelijkheden:
       · annuleren mag nooit als er al geld op de factuur staat — dan is
         crediteren de enige juiste weg (ctx.paidCents);
       · definitief maken mag alleen met een factuurnummer (ctx.hasNumber),
         want stap 4 van 'definitief maken' is nu juist het atomair
         toekennen van dat nummer.
     Geeft altijd {ok, reason} terug; reason is Nederlands (beheer-UI). */
  function canTransition(from, to, ctx) {
    ctx = ctx || {};
    var f = String(from || '');
    var t = String(to || '');
    if (STATUSES.indexOf(f) < 0) return { ok: false, reason: 'Onbekende huidige status “' + f + '”.' };
    if (STATUSES.indexOf(t) < 0) return { ok: false, reason: 'Onbekende doelstatus “' + t + '”.' };
    if (f === t) return { ok: true, reason: '' };
    var allowed = TRANSITIONS[f] || [];
    if (allowed.indexOf(t) < 0) {
      return {
        ok: false,
        reason: 'Van “' + STATUS_META[f].label + '” naar “' + STATUS_META[t].label + '” kan niet.'
      };
    }
    /* FASE 5 — de weg terug na een TERUGBOEKING, en alleen die.
       Deze drie overgangen bestaan uitsluitend voor het geval waarin een
       betaling is gestorneerd en er dus weer geld openstaat. De aanroeper
       moet dat bewijzen door ctx.paidCents expliciet op 0 te zetten;
       ontbreekt die context, dan gelden ze als verboden — precies zoals in
       fase 1. Zo kan een scherm dat de betaalstand niet kent nooit per
       ongeluk een betaalde factuur heropenen. */
    if (REOPEN_AFTER_REVERSAL[f + '>' + t] && ctx.paidCents !== 0) {
      return {
        ok: false,
        reason: 'Van “' + STATUS_META[f].label + '” naar “' + STATUS_META[t].label +
          '” kan alleen wanneer er niets meer betaald is. Boek de betaling eerst terug.'
      };
    }
    if (t === 'cancelled' && (ctx.paidCents || 0) !== 0) {
      return {
        ok: false,
        reason: 'Er is al betaald op deze factuur — annuleren mag dan niet meer. Maak een creditfactuur.'
      };
    }
    if (t === 'finalized' && ctx.hasNumber === false) {
      return { ok: false, reason: 'Definitief maken kan alleen met een toegekend factuurnummer.' };
    }
    return { ok: true, reason: '' };
  }

  /* ============================================================
     8. REGELBEREKENING
     ============================================================
     Invoer per regel (alles optioneel behalve type):
       type            'item' | 'text' | 'heading'
       description, detail, unit, ledgerRef, productRef, sort
       quantityMicro   geheel getal, aantal × 1e6   (of: quantity als tekst)
       unitPriceCents  geheel getal in de kleinste munteenheid
       priceIncludesVat   true/false; ontbreekt → de factuurstand
       discountType    'none' | 'percent' | 'amount'
       discountValue   pctMilli bij percent, centen bij amount
                       (of: discountPercent / discountAmountCents als tekst)
       taxCode         verwijzing naar de btw-codetabel

     Uitvoer per regel — alles in de kleinste munteenheid, EXCLUSIEF btw
     tenzij de naam anders zegt:
       grossExclCents      aantal × prijs, vóór korting
       discountExclCents   de regelkorting
       netExclCents        grond­slag ná regelkorting
       vatCents            btw over deze regel
       inclExclSumCents    net + btw (wat de klant voor deze regel betaalt)
  */
  function computeLine(line, ctx) {
    ctx = ctx || {};
    var taxTable = ctx.taxCodes;
    var out = {
      index: (line && line.index !== undefined) ? line.index : null,
      id: (line && line.id) || null,
      type: lineTypeOf(line && line.type),
      description: (line && line.description) || '',
      detail: (line && line.detail) || '',
      unit: (line && line.unit) || '',
      ledgerRef: (line && line.ledgerRef) || '',
      productRef: (line && line.productRef) || '',
      sort: (line && typeof line.sort === 'number') ? line.sort : 0,
      counts: false,
      quantityMicro: 0,
      unitPriceCents: 0,
      priceIncludesVat: false,
      discountType: 'none',
      discountValue: 0,
      taxCode: '',
      rateMilli: 0,
      treatment: 'standard',
      charges: false,
      legalNoteNl: '',
      grossExclCents: 0,
      discountExclCents: 0,
      netExclCents: 0,
      vatCents: 0,
      inclCents: 0,
      warnings: [],
      errors: []
    };
    if (out.type !== 'item') return out;   /* tekstregel/tussenkop: geen bedragen */
    out.counts = true;

    /* aantal — ontbreekt het veld, dan is het aantal 1 (de gewone
       verwachting bij een dienstregel); een LEEG veld is 0. */
    var qm;
    if (line && line.quantityMicro !== undefined && line.quantityMicro !== null) {
      qm = Math.round(Number(line.quantityMicro) || 0);
    } else if (!line || line.quantity === undefined || line.quantity === null) {
      qm = QTY_SCALE;
    } else if (line.quantity === '') {
      qm = 0;
    } else {
      qm = parseQuantity(line.quantity);
      if (qm === null) {
        out.errors.push({ code: 'aantal_onleesbaar', message: 'Het aantal is niet te lezen als getal.' });
        qm = 0;
      }
    }
    out.quantityMicro = qm;

    /* prijs per eenheid. Een leeg veld is 0 en geen fout — een regel die
       nog geen prijs heeft is een regel in aanbouw. Alleen invoer die er
       WEL staat maar geen bedrag is, is een fout. */
    var up;
    if (line && line.unitPriceCents !== undefined && line.unitPriceCents !== null) {
      up = Math.round(Number(line.unitPriceCents) || 0);
    } else if (!line || line.unitPrice === undefined || line.unitPrice === null || line.unitPrice === '') {
      up = 0;
    } else {
      up = parseAmountToMinor(line.unitPrice, ctx.minorUnits);
      if (up === null) {
        out.errors.push({ code: 'prijs_onleesbaar', message: 'De prijs per eenheid is niet te lezen als bedrag.' });
        up = 0;
      }
    }
    out.unitPriceCents = up;

    /* btw-code */
    var tc = taxCodeOf(line && line.taxCode, taxTable);
    if (!tc) {
      out.errors.push({
        code: 'btwcode_onbekend',
        message: 'De btw-code “' + String((line && line.taxCode) || '') + '” bestaat niet.'
      });
      tc = normaliseTaxCode({ code: '', label: '', rateMilli: 0, treatment: 'standard' });
    } else if (!tc.active) {
      out.warnings.push({
        code: 'btwcode_inactief',
        message: 'De btw-code “' + tc.code + '” staat op inactief maar wordt hier nog gebruikt.'
      });
    }
    out.taxCode = tc.code;
    out.rateMilli = tc.rateMilli;
    out.treatment = tc.treatment;
    out.charges = tc.charges;
    out.legalNoteNl = tc.legalNoteNl;

    var incl = (line && line.priceIncludesVat !== undefined && line.priceIncludesVat !== null)
      ? !!line.priceIncludesVat
      : !!ctx.pricesIncludeVat;
    out.priceIncludesVat = incl;

    /* bruto in de ingevoerde grondslag (incl. of excl.) */
    var prod = safeMul(qm, up);
    if (prod === null) {
      out.errors.push({ code: 'bedrag_te_groot', message: 'Aantal × prijs valt buiten het rekenbereik.' });
      return out;
    }
    var grossBasis = divRound(prod, QTY_SCALE);

    /* korting op de regel */
    var dType = String((line && line.discountType) || 'none');
    if (dType !== 'percent' && dType !== 'amount') dType = 'none';
    var dValue = 0, discountBasis = 0;
    if (dType === 'percent') {
      if (line && line.discountValue !== undefined && line.discountValue !== null) {
        dValue = Math.round(Number(line.discountValue) || 0);
      } else if (!line || line.discountPercent === undefined || line.discountPercent === null || line.discountPercent === '') {
        dValue = 0;
      } else {
        dValue = parsePercent(line.discountPercent);
        if (dValue === null) {
          out.errors.push({ code: 'korting_onleesbaar', message: 'Het kortingspercentage is niet te lezen.' });
          dValue = 0;
        }
      }
      if (dValue < 0 || dValue > PCT_FULL) {
        out.warnings.push({
          code: 'korting_buiten_bereik',
          message: 'Een kortingspercentage buiten 0% t/m 100% is ongebruikelijk — controleer de regel.'
        });
      }
      var dp = safeMul(grossBasis, dValue);
      discountBasis = (dp === null) ? 0 : divRound(dp, PCT_FULL);
    } else if (dType === 'amount') {
      if (line && line.discountValue !== undefined && line.discountValue !== null) {
        dValue = Math.round(Number(line.discountValue) || 0);
      } else if (!line || line.discountAmount === undefined || line.discountAmount === null || line.discountAmount === '') {
        dValue = 0;
      } else {
        dValue = parseAmountToMinor(line.discountAmount, ctx.minorUnits);
        if (dValue === null) {
          out.errors.push({ code: 'korting_onleesbaar', message: 'Het kortingsbedrag is niet te lezen.' });
          dValue = 0;
        }
      }
      discountBasis = dValue;
      if (grossBasis >= 0 && discountBasis > grossBasis) {
        out.warnings.push({
          code: 'korting_groter_dan_regel',
          message: 'De korting is groter dan het regelbedrag — de regel wordt hierdoor negatief.'
        });
      }
    }
    out.discountType = dType;
    out.discountValue = dValue;

    var netBasis = grossBasis - discountBasis;

    /* naar de exclusieve grondslag. Bij een inclusief ingevoerde prijs
       rekenen we terug met 100/(100+tarief); bruto en korting worden
       afzonderlijk teruggerekend en de korting wordt daarna als VERSCHIL
       gezet, zodat bruto - korting exact het netto is (geen zwevende cent
       tussen twee onafhankelijke afrondingen). */
    var grossExcl, netExcl;
    if (incl && out.charges) {
      var denom = PCT_FULL + out.rateMilli;
      var gp = safeMul(grossBasis, PCT_FULL);
      var np = safeMul(netBasis, PCT_FULL);
      if (gp === null || np === null) {
        out.errors.push({ code: 'bedrag_te_groot', message: 'Het bedrag valt buiten het rekenbereik.' });
        return out;
      }
      grossExcl = divRound(gp, denom);
      netExcl = divRound(np, denom);
      out.vatCents = netBasis - netExcl;   /* exact: incl. blijft incl. */
    } else {
      grossExcl = grossBasis;
      netExcl = netBasis;
      if (out.charges) {
        var vp = safeMul(netExcl, out.rateMilli);
        out.vatCents = (vp === null) ? 0 : divRound(vp, PCT_FULL);
      } else {
        out.vatCents = 0;
      }
    }
    out.grossExclCents = grossExcl;
    out.discountExclCents = grossExcl - netExcl;
    out.netExclCents = netExcl;
    out.inclCents = netExcl + out.vatCents;

    if (netExcl < 0) {
      out.warnings.push({
        code: 'negatieve_regel',
        message: 'Deze regel is negatief. Dat mag, maar controleer of hier geen creditfactuur hoort.'
      });
    }
    if (qm === 0) {
      out.warnings.push({ code: 'aantal_nul', message: 'Het aantal is nul — deze regel telt voor niets mee.' });
    }
    return out;
  }

  /* ============================================================
     9. FACTUURTOTALEN
     ============================================================
     Invoer (alles optioneel behalve lines):
       currency            'EUR' (bepaalt de valuta-precisie)
       pricesIncludeVat    standaard voor regels die het niet zelf zeggen
       taxCodes            [{code,label,rateMilli,treatment,active}]
       lines               [regel, ...]
       surcharges          [{label, amountCents, taxCode}]  verzend/overig,
                           altijd EXCLUSIEF btw, nooit gekort
       discount            {type:'none'|'percent'|'amount', value}
                           factuurkorting; evenredig over de btw-groepen
       payments            [{amountCents, ...}]  reeds betaald
       credits             [{amountCents, ...}]  gekoppelde creditbedragen
                           (positieve bedragen; ze verlagen het openstaande)
  */
  function computeInvoice(invoice, opts) {
    invoice = invoice || {};
    opts = opts || {};
    var currency = String(invoice.currency || 'EUR').toUpperCase();
    var minorUnits = minorUnitsFor(currency);
    var taxTable = (invoice.taxCodes && invoice.taxCodes.length) ? invoice.taxCodes : DEFAULT_TAX_CODES;
    var ctx = {
      taxCodes: taxTable,
      minorUnits: minorUnits,
      pricesIncludeVat: !!invoice.pricesIncludeVat
    };
    var warnings = [], errors = [];
    var srcLines = invoice.lines || [];
    var lines = [], i, j;

    for (i = 0; i < srcLines.length; i++) {
      var src = srcLines[i];
      var computed = computeLine({
        index: i,
        id: src && src.id,
        type: src && src.type,
        description: src && src.description,
        detail: src && src.detail,
        unit: src && src.unit,
        ledgerRef: src && src.ledgerRef,
        productRef: src && src.productRef,
        sort: src && src.sort,
        quantity: src && src.quantity,
        quantityMicro: src && src.quantityMicro,
        unitPrice: src && src.unitPrice,
        unitPriceCents: src && src.unitPriceCents,
        priceIncludesVat: src && src.priceIncludesVat,
        discountType: src && src.discountType,
        discountValue: src && src.discountValue,
        discountPercent: src && src.discountPercent,
        discountAmount: src && src.discountAmount,
        taxCode: src && src.taxCode
      }, ctx);
      for (j = 0; j < computed.warnings.length; j++) {
        warnings.push({ code: computed.warnings[j].code, message: computed.warnings[j].message, line: i });
      }
      for (j = 0; j < computed.errors.length; j++) {
        errors.push({ code: computed.errors[j].code, message: computed.errors[j].message, line: i });
      }
      lines.push(computed);
    }

    /* ---- btw-groepen opbouwen op volgorde van eerste voorkomen ---- */
    var groups = [], byCode = {};
    function groupFor(tc) {
      var key = tc.code + '|' + tc.rateMilli + '|' + tc.treatment;
      if (!byCode[key]) {
        byCode[key] = {
          taxCode: tc.code,
          label: tc.label,
          rateMilli: tc.rateMilli,
          treatment: tc.treatment,
          charges: tc.charges,
          legalNoteNl: tc.legalNoteNl,
          lineNetCents: 0,
          surchargeCents: 0,
          discountShareCents: 0,
          baseCents: 0,
          vatCents: 0
        };
        groups.push(byCode[key]);
      }
      return byCode[key];
    }

    var subtotalBeforeDiscount = 0, lineDiscount = 0, netAfterLineDiscount = 0, lineVat = 0;
    for (i = 0; i < lines.length; i++) {
      var L = lines[i];
      if (!L.counts) continue;
      var tc = taxCodeOf(L.taxCode, taxTable) || normaliseTaxCode({ code: L.taxCode, label: L.taxCode, rateMilli: L.rateMilli, treatment: L.treatment });
      var g = groupFor(tc);
      g.lineNetCents += L.netExclCents;
      g.vatCents += L.vatCents;
      subtotalBeforeDiscount += L.grossExclCents;
      lineDiscount += L.discountExclCents;
      netAfterLineDiscount += L.netExclCents;
      lineVat += L.vatCents;
    }

    /* ---- verzend-/overige kosten ---- */
    var surcharges = [], surchargeTotal = 0;
    var srcSur = invoice.surcharges || [];
    for (i = 0; i < srcSur.length; i++) {
      var s = srcSur[i] || {};
      var amt = (s.amountCents !== undefined && s.amountCents !== null)
        ? Math.round(Number(s.amountCents) || 0)
        : parseAmountToMinor(s.amount, minorUnits);
      if (amt === null) {
        errors.push({ code: 'kosten_onleesbaar', message: 'Het bedrag van “' + String(s.label || '') + '” is niet te lezen.', surcharge: i });
        amt = 0;
      }
      var stc = taxCodeOf(s.taxCode, taxTable);
      if (!stc) {
        errors.push({ code: 'btwcode_onbekend', message: 'De btw-code van “' + String(s.label || '') + '” bestaat niet.', surcharge: i });
        stc = normaliseTaxCode({ code: '', label: '', rateMilli: 0, treatment: 'standard' });
      }
      var sg = groupFor(stc);
      sg.surchargeCents += amt;
      surchargeTotal += amt;
      surcharges.push({ label: String(s.label || ''), amountCents: amt, taxCode: stc.code, rateMilli: stc.rateMilli });
    }

    /* ---- factuurkorting ----
       Grondslag is het netto ná regelkortingen; verzendkosten doen NIET
       mee (je geeft geen korting op je eigen verzendkosten — dat is de
       gedocumenteerde keuze, niet een vergetelheid). */
    var dType = String((invoice.discount && invoice.discount.type) || 'none');
    if (dType !== 'percent' && dType !== 'amount') dType = 'none';
    var dValue = 0, invoiceDiscount = 0;
    if (dType === 'percent') {
      if (invoice.discount.value !== undefined && invoice.discount.value !== null) {
        dValue = Math.round(Number(invoice.discount.value) || 0);
      } else if (invoice.discount.percent === undefined || invoice.discount.percent === null || invoice.discount.percent === '') {
        dValue = 0;
      } else {
        dValue = parsePercent(invoice.discount.percent);
        if (dValue === null) {
          errors.push({ code: 'factuurkorting_onleesbaar', message: 'Het kortingspercentage op de factuur is niet te lezen.' });
          dValue = 0;
        }
      }
      var idp = safeMul(netAfterLineDiscount, dValue);
      invoiceDiscount = (idp === null) ? 0 : divRound(idp, PCT_FULL);
    } else if (dType === 'amount') {
      if (invoice.discount.value !== undefined && invoice.discount.value !== null) {
        dValue = Math.round(Number(invoice.discount.value) || 0);
      } else if (invoice.discount.amount === undefined || invoice.discount.amount === null || invoice.discount.amount === '') {
        dValue = 0;
      } else {
        dValue = parseAmountToMinor(invoice.discount.amount, minorUnits);
        if (dValue === null) {
          errors.push({ code: 'factuurkorting_onleesbaar', message: 'Het kortingsbedrag op de factuur is niet te lezen.' });
          dValue = 0;
        }
      }
      invoiceDiscount = dValue;
      if (netAfterLineDiscount >= 0 && invoiceDiscount > netAfterLineDiscount) {
        warnings.push({
          code: 'factuurkorting_te_groot',
          message: 'De factuurkorting is groter dan het totaal van de regels — de factuur wordt negatief.'
        });
      }
    }

    /* evenredig over de btw-groepen, op basis van hun netto regelbedrag.
       Een negatieve groep krijgt een negatief deel: zie de toelichting bij
       allocateProportional(). */
    if (invoiceDiscount !== 0 && groups.length) {
      var weights = [];
      for (i = 0; i < groups.length; i++) weights.push(groups[i].lineNetCents);
      var shares = allocateProportional(invoiceDiscount, weights);
      if (shares.ok === false) {
        /* De verdeling is NIET evenredig gelukt; de hele korting staat nu
           op de eerste groep. Het factuurtotaal klopt daarmee nog, maar de
           btw per groep niet — en een btw-bedrag dat je niet kunt uitleggen
           is precies wat deze module nooit mag afgeven. Dus een harde fout
           en geen waarschuwing: hiermee komt de factuur niet door
           validateInvoice() en dus ook niet langs stap 1 van definitief
           maken. */
        errors.push({
          code: 'factuurkorting_niet_verdeeld',
          message: (shares.reason === ALLOC_OVERLOOP)
            ? 'De factuurkorting kan niet over de btw-groepen worden verdeeld: de bedragen vallen buiten het rekenbereik.'
            : 'De factuurkorting kan niet evenredig over de btw-groepen worden verdeeld: de positieve en negatieve groepen heffen elkaar precies op. Zet de korting op de regels zelf.'
        });
      }
      for (i = 0; i < groups.length; i++) groups[i].discountShareCents = shares[i];
    }

    /* ---- grondslag en btw per groep afmaken ----
       De btw over de verzendkosten en over de toegewezen factuurkorting
       wordt hier alsnog berekend; de regel-btw stond er al in. */
    var totalVat = 0, totalExcl = 0;
    for (i = 0; i < groups.length; i++) {
      var G = groups[i];
      G.baseCents = G.lineNetCents + G.surchargeCents - G.discountShareCents;
      if (G.charges) {
        var sp = safeMul(G.surchargeCents, G.rateMilli);
        var dp2 = safeMul(G.discountShareCents, G.rateMilli);
        G.vatCents += (sp === null ? 0 : divRound(sp, PCT_FULL));
        G.vatCents -= (dp2 === null ? 0 : divRound(dp2, PCT_FULL));
      } else {
        G.vatCents = 0;
      }
      totalVat += G.vatCents;
      totalExcl += G.baseCents;
    }

    /* ---- betaald, gecrediteerd, openstaand ---- */
    var paid = 0, credited = 0;
    var pays = invoice.payments || [];
    for (i = 0; i < pays.length; i++) {
      var p = pays[i] || {};
      var pa = (p.amountCents !== undefined && p.amountCents !== null)
        ? Math.round(Number(p.amountCents) || 0)
        : parseAmountToMinor(p.amount, minorUnits);
      paid += (pa === null ? 0 : pa);
    }
    var creds = invoice.credits || [];
    for (i = 0; i < creds.length; i++) {
      var c = creds[i] || {};
      var ca = (c.amountCents !== undefined && c.amountCents !== null)
        ? Math.round(Number(c.amountCents) || 0)
        : parseAmountToMinor(c.amount, minorUnits);
      credited += (ca === null ? 0 : Math.abs(ca));
    }

    var totalIncl = totalExcl + totalVat;
    var outstanding = totalIncl - paid - credited;

    if (credited > totalIncl && totalIncl >= 0) {
      warnings.push({
        code: 'te_veel_gecrediteerd',
        message: 'Er is meer gecrediteerd dan er op deze factuur staat — controleer de gekoppelde creditfacturen.'
      });
    }

    /* btw-consistentie: mengt de factuur behandelingen die elkaar
       uitsluiten, dan is dat geen rekenfout maar wel iets wat je wilt
       weten vóór je hem definitief maakt. */
    var hasCharged = false, hasReverse = false, hasIntracom = false;
    for (i = 0; i < groups.length; i++) {
      if (groups[i].charges) hasCharged = true;
      if (groups[i].treatment === 'reverse') hasReverse = true;
      if (groups[i].treatment === 'intracom') hasIntracom = true;
    }
    if (hasCharged && (hasReverse || hasIntracom)) {
      warnings.push({
        code: 'btw_mengvorm',
        message: 'Deze factuur bevat zowel belaste regels als verlegde/intracommunautaire regels. Dat kan kloppen, maar controleer het — meestal hoort dit op twee facturen.'
      });
    }

    return {
      version: VERSION,
      currency: currency,
      minorUnits: minorUnits,
      lines: lines,
      groups: groups,
      surcharges: surcharges,
      totals: {
        subtotalBeforeDiscountCents: subtotalBeforeDiscount,
        lineDiscountCents: lineDiscount,
        netAfterLineDiscountCents: netAfterLineDiscount,
        invoiceDiscountCents: invoiceDiscount,
        surchargeCents: surchargeTotal,
        totalExclCents: totalExcl,
        vatCents: totalVat,
        totalInclCents: totalIncl,
        paidCents: paid,
        creditedCents: credited,
        outstandingCents: outstanding
      },
      warnings: warnings,
      errors: errors
    };
  }

  /* ============================================================
     10. AFWIKKELING — betaald, deels, open, te veel
     ============================================================
     toleranceCents vangt het centverschil van een buitenlandse
     overboeking af: staat er minder dan de tolerantie open, dan geldt de
     factuur als betaald. Default 0 — een tolerantie is een bewuste
     instelling, geen stilzwijgende gunst.

     DE VOLGORDE IS DE NORM UIT DE DATABASE.
     recalc_invoice_settlement() in supabase/portal/0012_betalingen.sql is
     de baas over deze regels; er zijn twee implementaties van één regel en
     de database is degene die niemand kan omzeilen. Die functie toetst in
     precies deze volgorde:
       1. volledig gecrediteerd  (credited >= totaal, totaal > 0, betaald 0)
       2. openstaand <= tolerantie  → betaald
       3. betaald > 0               → deels betaald
     Deze functie doet nu hetzelfde, en dat repareert twee dingen:
       · een VOLLEDIG GECREDITEERDE factuur heette 'paid'. Bij volledige
         creditering is het openstaande immers óók 0, en de nulcontrole
         stond vóór de creditcontrole. 'credited' was daarmee onbereikbaar
         en een gecrediteerde factuur stond in het overzicht als betaald —
         boekhoudkundig het verschil tussen "dit geld is binnen" en "deze
         factuur is teruggedraaid";
       · een OVERBETALING van één cent bij een tolerantie van vijf cent
         heette 'overpaid'. De tolerantie geldt aan beide kanten van nul:
         een verschil binnen de tolerantie is geen overbetaling, precies
         zoals het aan de tekortkant geen tekort is.
     Eén verschil blijft, bewust: de database kent de status 'overpaid'
     niet (hij staat niet in STATUSES) en zet zo'n factuur op 'paid'. Deze
     functie meldt het fijner, want het beheer moet een teveel wél zien. */
  function settlement(totals, opts) {
    opts = opts || {};
    var tol = Math.abs(Math.round(Number(opts.toleranceCents) || 0));
    var total = (totals && totals.totalInclCents) || 0;
    var out = (totals && totals.outstandingCents) || 0;
    var paid = (totals && totals.paidCents) || 0;
    var credited = (totals && totals.creditedCents) || 0;
    var res = {
      code: 'open',
      outstandingCents: out,
      overpaidCents: 0,
      withinTolerance: false
    };

    /* 1. VOLLEDIG GECREDITEERD gaat vóór alles. Is er niets betaald en is
          er minstens het hele factuurbedrag gecrediteerd, dan is deze
          factuur teruggedraaid en niet voldaan. */
    if (credited >= total && total > 0 && paid === 0) {
      res.code = 'credited';
      return res;
    }

    /* 2. binnen de tolerantie — aan beide kanten van nul. Het werkelijke
          verschil blijft in outstandingCents staan; er wordt niets
          weggepoetst, alleen anders benoemd. */
    if (out === 0) { res.code = 'paid'; return res; }
    if (out > 0 && out <= tol) { res.code = 'paid'; res.withinTolerance = true; return res; }
    if (out < 0) {
      if (-out <= tol) { res.code = 'paid'; res.withinTolerance = true; return res; }
      res.code = 'overpaid';
      res.overpaidCents = -out;
      return res;
    }

    /* 3. er staat nog echt geld open */
    if (paid > 0 || credited > 0) { res.code = 'partially_paid'; return res; }
    return res;
  }

  /* ============================================================
     11. VALIDATIE
     ============================================================
     intent 'draft'    : wat nu al fout is, mag je weten
     intent 'finalize' : alles wat op een definitieve factuur MOET staan
     De teksten zijn Nederlands: dit is beheer-UI en server-antwoord, geen
     klantzichtbare tekst. */
  var REQUIRED_ON_FINALIZE = [
    { path: 'invoiceNumber', code: 'nummer_ontbreekt', message: 'Er is nog geen factuurnummer toegekend.' },
    { path: 'invoiceDate', code: 'factuurdatum_ontbreekt', message: 'De factuurdatum ontbreekt.' },
    { path: 'dueDate', code: 'vervaldatum_ontbreekt', message: 'De vervaldatum ontbreekt.' },
    { path: 'seller.name', code: 'verkoper_naam_ontbreekt', message: 'De eigen bedrijfsnaam ontbreekt.' },
    { path: 'seller.address', code: 'verkoper_adres_ontbreekt', message: 'Het eigen adres ontbreekt.' },
    { path: 'seller.vatNumber', code: 'verkoper_btw_ontbreekt', message: 'Het eigen btw-identificatienummer ontbreekt.' },
    { path: 'buyer.name', code: 'klant_naam_ontbreekt', message: 'De klantnaam ontbreekt.' },
    { path: 'buyer.address', code: 'klant_adres_ontbreekt', message: 'Het factuuradres van de klant ontbreekt.' }
  ];
  function pick(obj, path) {
    var parts = String(path).split('.'), cur = obj, i;
    for (i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }
  function isIsoDate(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) && !isNaN(new Date(v).getTime());
  }

  function validateInvoice(invoice, opts) {
    invoice = invoice || {};
    opts = opts || {};
    var intent = opts.intent === 'finalize' ? 'finalize' : 'draft';
    var result = computeInvoice(invoice, opts);
    var errors = result.errors.slice();
    var warnings = result.warnings.slice();
    var i;

    /* valuta moet bekend zijn — een onbekende valuta betekent stilzwijgend
       twee decimalen aannemen, en dat is precies het soort aanname dat een
       JPY-factuur honderd keer te duur maakt */
    if (isBlank(invoice.currency)) {
      errors.push({ code: 'valuta_ontbreekt', message: 'Er is geen valuta gekozen.' });
    } else if (!Object.prototype.hasOwnProperty.call(CURRENCY_MINOR_UNITS, String(invoice.currency).toUpperCase())) {
      warnings.push({
        code: 'valuta_onbekend',
        message: 'Valuta “' + invoice.currency + '” staat niet in de precisietabel; er wordt met 2 decimalen gerekend.'
      });
    }

    /* minstens één bedragregel */
    var itemCount = 0;
    for (i = 0; i < result.lines.length; i++) if (result.lines[i].counts) itemCount++;
    if (itemCount === 0) {
      errors.push({ code: 'geen_regels', message: 'De factuur heeft geen enkele bedragregel.' });
    }
    for (i = 0; i < result.lines.length; i++) {
      if (result.lines[i].counts && isBlank(result.lines[i].description)) {
        errors.push({ code: 'regel_zonder_omschrijving', message: 'Regel ' + (i + 1) + ' heeft geen omschrijving.', line: i });
      }
    }

    /* btw-consistentie: verlegd en intracommunautair kunnen niet zonder
       het btw-identificatienummer van de AFNEMER — dat is precies de
       poortwachter die in golf 1 al in beheer.html zit, hier nog eens
       server-side. */
    var needsBuyerVat = false;
    for (i = 0; i < result.groups.length; i++) {
      if (treatmentOf(result.groups[i].treatment).needsBuyerVat) needsBuyerVat = true;
    }
    if (needsBuyerVat && isBlank(pick(invoice, 'buyer.vatNumber'))) {
      errors.push({
        code: 'afnemer_btw_ontbreekt',
        message: 'Btw verlegd of intracommunautair kan niet zonder het btw-identificatienummer van de klant.'
      });
    }

    /* datums */
    if (!isBlank(invoice.invoiceDate) && !isIsoDate(invoice.invoiceDate)) {
      errors.push({ code: 'factuurdatum_ongeldig', message: 'De factuurdatum is geen geldige datum.' });
    }
    if (!isBlank(invoice.dueDate) && !isIsoDate(invoice.dueDate)) {
      errors.push({ code: 'vervaldatum_ongeldig', message: 'De vervaldatum is geen geldige datum.' });
    }
    if (isIsoDate(invoice.invoiceDate) && isIsoDate(invoice.dueDate) &&
        new Date(invoice.dueDate) < new Date(invoice.invoiceDate)) {
      errors.push({ code: 'vervaldatum_voor_factuurdatum', message: 'De vervaldatum ligt vóór de factuurdatum.' });
    }
    if (invoice.paymentTermDays !== undefined && invoice.paymentTermDays !== null && invoice.paymentTermDays !== '') {
      var term = Number(invoice.paymentTermDays);
      if (!isFinite(term) || term < 0 || Math.floor(term) !== term) {
        errors.push({ code: 'betaaltermijn_ongeldig', message: 'De betaaltermijn moet een heel aantal dagen zijn.' });
      } else if (term > 90) {
        warnings.push({ code: 'betaaltermijn_ongebruikelijk', message: 'Een betaaltermijn van ' + term + ' dagen is ongebruikelijk lang.' });
      }
    }

    /* wisselkoersanker (golf 1, functie 7) */
    if (String(invoice.currency || 'EUR').toUpperCase() !== 'EUR') {
      var rate = Number(invoice.rateToEur);
      if (!isFinite(rate) || rate <= 0) {
        errors.push({
          code: 'koers_ontbreekt',
          message: 'Een factuur in ' + invoice.currency + ' heeft een vastgelegde koers op de factuurdatum nodig.'
        });
      }
    }

    /* nul- of negatieve eindtotalen */
    if (result.totals.totalInclCents === 0 && itemCount > 0) {
      warnings.push({ code: 'totaal_nul', message: 'Het factuurtotaal is nul.' });
    }
    if (result.totals.totalInclCents < 0) {
      warnings.push({ code: 'totaal_negatief', message: 'Het factuurtotaal is negatief — hoort dit een creditfactuur te zijn?' });
    }

    if (intent === 'finalize') {
      for (i = 0; i < REQUIRED_ON_FINALIZE.length; i++) {
        var rq = REQUIRED_ON_FINALIZE[i];
        if (isBlank(pick(invoice, rq.path))) {
          errors.push({ code: rq.code, message: rq.message, field: rq.path });
        }
      }
      var t = canTransition(invoice.status || 'draft', 'finalized', {
        paidCents: result.totals.paidCents,
        hasNumber: !isBlank(invoice.invoiceNumber)
      });
      if (!t.ok) errors.push({ code: 'status_overgang', message: t.reason });
    }

    /* claimedTotals: wat de CLIENT dacht dat het was. Wijkt dat af van wat
       hier is herberekend, dan is er onderweg iets veranderd — dat is een
       harde fout, geen waarschuwing. */
    if (opts.claimedTotals) {
      var keys = ['totalExclCents', 'vatCents', 'totalInclCents'];
      for (i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (opts.claimedTotals[k] !== undefined &&
            Math.round(Number(opts.claimedTotals[k])) !== result.totals[k]) {
          errors.push({
            code: 'totalen_wijken_af',
            message: 'Herberekening geeft een ander bedrag voor ' + k + ': ' +
              formatMinor(result.totals[k], result.minorUnits) + ' in plaats van ' +
              formatMinor(Math.round(Number(opts.claimedTotals[k])), result.minorUnits) + '.',
            field: k
          });
        }
      }
    }

    return {
      ok: errors.length === 0,
      intent: intent,
      totals: result.totals,
      groups: result.groups,
      lines: result.lines,
      errors: errors,
      warnings: warnings
    };
  }

  /* ============================================================
     12. PUBLIEKE API
     ============================================================ */
  return {
    VERSION: VERSION,
    ROUNDING: ROUNDING,
    QTY_SCALE: QTY_SCALE,
    PCT_SCALE: PCT_SCALE,

    divRound: divRound,
    roundHalfUp: roundHalfUp,
    allocateProportional: allocateProportional,

    CURRENCY_MINOR_UNITS: CURRENCY_MINOR_UNITS,
    minorUnitsFor: minorUnitsFor,
    parseAmountToMinor: parseAmountToMinor,
    parseQuantity: parseQuantity,
    parsePercent: parsePercent,
    formatMinor: formatMinor,

    TAX_TREATMENTS: TAX_TREATMENTS,
    TREATMENT_KEYS: TREATMENT_KEYS,
    treatmentOf: treatmentOf,
    DEFAULT_TAX_CODES: DEFAULT_TAX_CODES,
    LEGACY_VAT_MODE_TO_CODE: LEGACY_VAT_MODE_TO_CODE,
    taxCodeOf: taxCodeOf,

    LINE_TYPES: LINE_TYPES,
    STATUSES: STATUSES,
    STATUS_META: STATUS_META,
    TRANSITIONS: TRANSITIONS,
    canTransition: canTransition,

    computeLine: computeLine,
    computeInvoice: computeInvoice,
    settlement: settlement,
    validateInvoice: validateInvoice
  };
});
