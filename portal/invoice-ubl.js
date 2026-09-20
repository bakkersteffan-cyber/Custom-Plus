/* CUSTOM+ — e-facturatie: UBL 2.1 Invoice en CreditNote.
   ------------------------------------------------------------------
   FASE 5, ACHTER EEN FEATURE FLAG. Pure module, geen IO: snapshot erin,
   XML eruit. Geen netwerk, geen provider, geen verzending.

   ------------------------------------------------------------------
   DE VOLGORDE: EERST EEN EIGEN REPRESENTATIE, DAN PAS XML

   fromSnapshot() zet de factuur om naar een INTERNE, PROVIDER-
   ONAFHANKELIJKE vorm (de "IR"). Pas toXml() maakt daar UBL van. Dat is
   één stap meer dan strikt nodig, en hij staat er met opzet:

     · validate() kan de verplichte velden toetsen zonder ook maar één
       tag te schrijven, dus een factuur die niet compleet is levert nooit
       half-XML op;
     · komt er ooit een tweede formaat bij (Peppol BIS is UBL, maar
       Factur-X is XML-in-PDF en een Duitse XRechnung heeft eigen regels),
       dan is dat een tweede toXml() en géén tweede vertaling van de
       snapshot;
     · de IR is leesbaar in een console, XML niet.

   WAAR EEN PEPPOL-PROVIDER ZOU AANHAKEN
   Peppol verzenden vraagt een geregistreerd Access Point; dat is een
   contract met een partij en een certificaat, geen code. Als het er komt:
     1. netlify/functions/peppol-send.mjs met de sleutels van de provider
        in de Netlify-omgeving (nooit in de browser);
     2. die functie leest de al bewaarde XML uit ubl_exports.xml — hij
        genereert nooit opnieuw, want dan zou het verzonden document
        kunnen afwijken van het bewaarde;
     3. het antwoord landt in ubl_exports.provider, provider_ref, sent_at
        en status ('verzonden' of 'afgewezen' met validation_errors).
   Er verandert niets aan deze module: die kent alleen documenten.

   ------------------------------------------------------------------
   GELD IN UBL
   UBL wil decimale getallen als tekst ("1234.56"), met een punt. De
   omzetting loopt via gehele centen: quotient en rest, nooit een deling
   met een kommagetal. centsToDecimal(123456, 2) → "1234.56", en
   centsToDecimal(-5, 2) → "-0.05".

   Publieke API (globalThis.CP_UBL, en module.exports in Node):
     VERSION, PROFILE_ID, CUSTOMIZATION_ID
     UNIT_CODES, unitCode(unit)
     TAX_CATEGORIES, taxCategory(treatment)
     centsToDecimal(cents, minorUnits)
     escapeXml(s)
     fromSnapshot(snapshot, opts)   → de interne representatie
     validate(ir)                   → {ok, errors[], warnings[]}
     toXml(ir)                      → UBL 2.1 XML als string
     filename(ir)
     REQUIRED_FIELDS

   LADEN
     browser : <script src="portal/invoice-ubl.js"></script>
     node    : import '../portal/invoice-ubl.js';
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_UBL = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '5.0.0';
  /* Peppol BIS Billing 3.0 — het profiel dat in Europa de facto de norm is
     voor e-facturatie tussen bedrijven. De waarden zijn letterlijk
     voorgeschreven; ze staan hier als constante zodat er nooit een typefout
     in een string midden in een sjabloon sluipt. */
  var CUSTOMIZATION_ID = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
  var PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';
  var QTY_SCALE = 1000000;

  function str(v, dflt) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? (dflt === undefined ? '' : dflt) : s;
  }
  function int(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return n < 0 ? -Math.round(-n) : Math.round(n);
  }

  /* ============================================================
     1. TEKST EN GETALLEN
     ============================================================ */
  /* XML-escaping. Alle vijf de tekens, ook in attributen: dit is de enige
     plek waar klant- en regeltekst het bestand in gaat, en een adres met
     een '&' erin hoort geen kapotte XML op te leveren. De laatste stap
     gooit de stuurtekens weg die in XML 1.0 domweg niet mogen bestaan;
     tab, regeleinde en enter blijven staan. */
  var CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
  function escapeXml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(CONTROL_RE, '');
  }

  function centsToDecimal(cents, minorUnits) {
    var mu = (minorUnits === undefined || minorUnits === null) ? 2 : int(minorUnits);
    if (mu < 0) mu = 0;
    var n = int(cents);
    var neg = n < 0;
    if (neg) n = -n;
    if (mu === 0) return (neg && n ? '-' : '') + String(n);
    var pow = 1;
    for (var i = 0; i < mu; i++) pow *= 10;
    var whole = Math.floor(n / pow);
    var rest = String(n - whole * pow);
    while (rest.length < mu) rest = '0' + rest;
    return (neg && n ? '-' : '') + whole + '.' + rest;
  }

  /* aantal (quantityMicro) → decimale tekst met hoogstens zes decimalen en
     zonder overbodige nullen: "2.5", "1", "0.333333" */
  function microToDecimal(micro) {
    var n = int(micro);
    var neg = n < 0;
    if (neg) n = -n;
    var whole = Math.floor(n / QTY_SCALE);
    var rest = String(QTY_SCALE + (n % QTY_SCALE)).slice(1).replace(/0+$/, '');
    return (neg && n ? '-' : '') + whole + (rest ? '.' + rest : '');
  }

  /* percentage (rateMilli) → "21", "5.5", "0" */
  function milliToDecimal(milli) {
    var n = int(milli);
    var neg = n < 0;
    if (neg) n = -n;
    var whole = Math.floor(n / 1000);
    var rest = String(1000 + (n % 1000)).slice(1).replace(/0+$/, '');
    return (neg && n ? '-' : '') + whole + (rest ? '.' + rest : '');
  }

  /* ============================================================
     2. CODELIJSTEN
     ============================================================
     UBL gebruikt UN/ECE Recommendation 20 voor eenheden en UNCL5305 voor
     btw-categorieën. Alleen de codes die dit systeem echt kan voortbrengen
     staan hier; wat er niet in staat valt terug op 'C62' (stuk) — dat is
     de gedocumenteerde restcategorie en geen gok. */
  var UNIT_CODES = {
    stuk: 'C62', st: 'C62', pcs: 'C62', stuks: 'C62',
    uur: 'HUR', u: 'HUR', uren: 'HUR',
    dag: 'DAY', dagen: 'DAY',
    maand: 'MON',
    jaar: 'ANN',
    abonnement: 'C62',
    kg: 'KGM',
    meter: 'MTR', m: 'MTR',
    doos: 'BX',
    set: 'SET'
  };
  function unitCode(unit) {
    var k = String(unit || '').toLowerCase().trim();
    return Object.prototype.hasOwnProperty.call(UNIT_CODES, k) ? UNIT_CODES[k] : 'C62';
  }

  /* UNCL5305. De vijf btw-behandelingen van invoice-core hebben elk exact
     één juiste categorie; ze raden is hier niet toegestaan, want een
     verkeerde categorie maakt van een verlegde factuur een belaste. */
  var TAX_CATEGORIES = {
    standard: { id: 'S',  needsReason: false, reason: '' },
    zero:     { id: 'Z',  needsReason: true,  reason: 'Btw 0% (export)' },
    exempt:   { id: 'E',  needsReason: true,  reason: 'Vrijgesteld van btw' },
    reverse:  { id: 'AE', needsReason: true,  reason: 'Btw verlegd naar de afnemer' },
    intracom: { id: 'K',  needsReason: true,  reason: 'Intracommunautaire levering' }
  };
  function taxCategory(treatment) {
    var k = String(treatment || 'standard');
    return Object.prototype.hasOwnProperty.call(TAX_CATEGORIES, k) ? TAX_CATEGORIES[k] : TAX_CATEGORIES.standard;
  }

  /* ============================================================
     3. DE INTERNE REPRESENTATIE
     ============================================================
     Provider-onafhankelijk: geen enkel veld heet hier zoals het in UBL
     heet. Wat erin zit is precies wat een e-factuur nodig heeft en niets
     meer — de interne notitie en de interne tags zitten er dus niet in,
     net zomin als in de snapshot zelf. */
  var NL_POSTCODE_RE = /^([0-9]{4}\s?[A-Za-z]{2})\s+(.+)$/;
  var GENERIC_ZIP_RE = /^([0-9]{3,10})\s+(.+)$/;

  function splitAddress(text) {
    /* het adres staat in dit systeem als vrije tekst op de factuur (zie
       docs §8: adressen wonen op de factuur, niet op de klantrij). UBL wil
       straat, postcode, plaats en land apart. Wat met zekerheid af te
       leiden is leiden we af; de rest blijft in `raw` staan. Een postcode
       raden zou een e-factuur naar het verkeerde land sturen. */
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var out = { street: '', city: '', postalCode: '', country: '', raw: lines.join('\n') };
    if (!lines.length) return out;
    out.street = lines[0];
    for (var i = 1; i < lines.length; i++) {
      var m = lines[i].match(NL_POSTCODE_RE);
      if (m) {
        out.postalCode = m[1].toUpperCase().replace(/\s+/, ' ');
        out.city = m[2];
        continue;
      }
      var m2 = lines[i].match(GENERIC_ZIP_RE);
      if (m2 && !out.postalCode) {
        out.postalCode = m2[1];
        out.city = m2[2];
        continue;
      }
      /* de laatste regel van een adres van drie of meer regels is in de
         praktijk het land */
      if (i === lines.length - 1 && lines.length > 2) { out.country = lines[i]; continue; }
      if (!out.city) out.city = lines[i];
    }
    return out;
  }

  /* ISO 3166-1 alfa-2 voor de landen die in dit systeem voorkomen. Staat
     het land er niet bij, dan komt er GEEN code in de XML en meldt
     validate() dat als waarschuwing — een verzonnen landcode is erger dan
     een ontbrekende. */
  var COUNTRY_CODES = {
    nederland: 'NL', netherlands: 'NL', nl: 'NL', holland: 'NL',
    belgie: 'BE', 'belgië': 'BE', belgium: 'BE', be: 'BE',
    duitsland: 'DE', germany: 'DE', deutschland: 'DE', de: 'DE',
    frankrijk: 'FR', france: 'FR', fr: 'FR',
    spanje: 'ES', spain: 'ES', 'españa': 'ES', es: 'ES',
    italie: 'IT', 'italië': 'IT', italy: 'IT', it: 'IT',
    china: 'CN', cn: 'CN',
    noorwegen: 'NO', norway: 'NO', norge: 'NO', no: 'NO',
    zweden: 'SE', sweden: 'SE', sverige: 'SE', se: 'SE',
    denemarken: 'DK', denmark: 'DK', danmark: 'DK', dk: 'DK',
    finland: 'FI', suomi: 'FI', fi: 'FI',
    oostenrijk: 'AT', austria: 'AT', at: 'AT',
    zwitserland: 'CH', switzerland: 'CH', ch: 'CH',
    polen: 'PL', poland: 'PL', polska: 'PL', pl: 'PL',
    portugal: 'PT', pt: 'PT',
    ierland: 'IE', ireland: 'IE', ie: 'IE',
    luxemburg: 'LU', luxembourg: 'LU', lu: 'LU',
    'tsjechie': 'CZ', 'tsjechië': 'CZ', czechia: 'CZ', cz: 'CZ',
    'verenigd koninkrijk': 'GB', 'united kingdom': 'GB', gb: 'GB', uk: 'GB',
    'verenigde staten': 'US', 'united states': 'US', us: 'US', usa: 'US'
  };
  function countryCode(name) {
    var k = String(name || '').toLowerCase().trim();
    return Object.prototype.hasOwnProperty.call(COUNTRY_CODES, k) ? COUNTRY_CODES[k] : '';
  }

  function fromSnapshot(snapshot, opts) {
    snapshot = snapshot || {};
    opts = opts || {};
    var isCredit = String(snapshot.docKind || 'invoice') === 'credit_note';
    var mu = (snapshot.minorUnits === undefined || snapshot.minorUnits === null) ? 2 : int(snapshot.minorUnits);
    var seller = snapshot.seller || {};
    var buyer = snapshot.buyer || {};
    var totals = snapshot.totals || {};

    var sellerAddr = splitAddress(seller.address);
    var buyerAddr = splitAddress(buyer.address || buyer.billingAddress);

    var lines = [];
    var notes = [];
    var srcLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
    for (var i = 0; i < srcLines.length; i++) {
      var L = srcLines[i] || {};
      /* tekstregels en tussenkoppen dragen geen bedrag en horen niet als
         InvoiceLine in UBL: een regel zonder prijs maakt elke validator
         boos. Ze verdwijnen niet — ze gaan als Note mee op documentniveau. */
      if (L.type && L.type !== 'item') {
        var n = str(L.description) + (str(L.detail) ? ' — ' + str(L.detail) : '');
        if (n) notes.push(n);
        continue;
      }
      lines.push({
        id: String(lines.length + 1),
        sourceSort: (L.sort === undefined || L.sort === null) ? i : int(L.sort),
        description: str(L.description),
        detail: str(L.detail),
        quantityMicro: int(L.quantityMicro),
        unit: str(L.unit, 'stuk'),
        unitPriceCents: int(L.unitPriceCents),
        /* UBL wil de regelprijs EXCLUSIEF btw. Die staat al in de snapshot
           (computeInvoice heeft hem uitgerekend), dus er wordt hier niets
           opnieuw berekend. */
        netExclCents: int(L.netExclCents),
        discountExclCents: int(L.discountExclCents),
        grossExclCents: int(L.grossExclCents),
        vatCents: int(L.vatCents),
        taxCode: str(L.taxCode),
        rateMilli: int(L.rateMilli),
        treatment: str(L.treatment, 'standard'),
        ledgerRef: str(L.ledgerRef),
        productRef: str(L.productRef)
      });
    }

    var groups = (snapshot.taxGroups || []).map(function (g) {
      return {
        taxCode: str(g.taxCode),
        rateMilli: int(g.rateMilli),
        treatment: str(g.treatment, 'standard'),
        baseCents: int(g.baseCents),
        vatCents: int(g.vatCents),
        legalNote: str(g.legalNoteNl)
      };
    });

    return {
      irVersion: 1,
      generatedBy: 'CUSTOM+ invoice-ubl ' + VERSION,
      documentKind: isCredit ? 'credit_note' : 'invoice',
      number: str(snapshot.invoiceNumber),
      issueDate: str(snapshot.invoiceDate),
      dueDate: str(snapshot.dueDate),
      currency: String(str(snapshot.currency, 'EUR')).toUpperCase(),
      minorUnits: mu,
      language: str(snapshot.language, 'nl'),
      note: notes.join(' · '),
      buyerReference: str(snapshot.clientReference),
      orderReference: str(snapshot.purchaseOrder),
      accountingCost: str(snapshot.costCenter),
      creditOfNumber: str(snapshot.creditOfNumber),
      deliveryStart: str(snapshot.deliveryStart),
      deliveryEnd: str(snapshot.deliveryEnd),
      paymentTermDays: int(snapshot.paymentTermDays),
      paymentInstructions: str(snapshot.paymentInstructions),
      paymentReference: str(snapshot.invoiceNumber),
      supplier: {
        name: str(seller.name),
        tradeName: str(seller.tradeName),
        vatNumber: str(seller.vatNumber),
        registrationNumber: str(seller.registrationNumber || seller.kvk),
        email: str(seller.email),
        phone: str(seller.phone),
        iban: str(seller.iban || opts.iban),
        bic: str(seller.bic || opts.bic),
        address: sellerAddr,
        countryCode: countryCode(sellerAddr.country) || str(opts.sellerCountry, 'NL')
      },
      customer: {
        name: str(buyer.name),
        tradeName: str(buyer.tradeName),
        vatNumber: str(buyer.vatNumber),
        registrationNumber: str(buyer.registrationNumber),
        email: str(buyer.email || buyer.invoiceEmail),
        contactName: str(buyer.contactName),
        address: buyerAddr,
        countryCode: countryCode(buyerAddr.country)
      },
      lines: lines,
      taxGroups: groups,
      totals: {
        /* LineExtensionAmount is de som van de regels: het totaal exclusief
           btw min de kosten die op documentniveau staan, plus de korting
           die daar is afgetrokken. Zo klopt de UBL-optelsom
           regels − korting + kosten = totaal exclusief. */
        lineExtensionCents: int(totals.totalExclCents) - int(totals.surchargeCents) + int(totals.invoiceDiscountCents),
        allowanceCents: int(totals.invoiceDiscountCents),
        chargeCents: int(totals.surchargeCents),
        taxExclusiveCents: int(totals.totalExclCents),
        taxCents: int(totals.vatCents),
        taxInclusiveCents: int(totals.totalInclCents),
        prepaidCents: int(totals.paidCents),
        payableCents: int(totals.totalInclCents) - int(totals.paidCents)
      }
    };
  }

  /* ============================================================
     4. VALIDATIE — VÓÓR de export, niet erna
     ============================================================
     Wat hier faalt, wordt geen XML. Dat is de hele reden dat validate() op
     de IR werkt en niet op het resultaat: een half document dat een
     provider straks weigert is erger dan een export die netjes zegt wat er
     ontbreekt. */
  var REQUIRED_FIELDS = [
    { path: 'number', message: 'Het factuurnummer ontbreekt. Een e-factuur zonder nummer bestaat niet.' },
    { path: 'issueDate', message: 'De factuurdatum ontbreekt.' },
    { path: 'currency', message: 'De valuta ontbreekt.' },
    { path: 'supplier.name', message: 'De eigen bedrijfsnaam ontbreekt.' },
    { path: 'supplier.vatNumber', message: 'Het eigen btw-identificatienummer ontbreekt. Zonder dat nummer weigert elke ontvanger de e-factuur.' },
    { path: 'supplier.address.street', message: 'Het eigen adres ontbreekt.' },
    { path: 'supplier.countryCode', message: 'Het land van de verkoper ontbreekt of is niet herkend.' },
    { path: 'customer.name', message: 'De naam van de klant ontbreekt.' },
    { path: 'customer.address.street', message: 'Het factuuradres van de klant ontbreekt.' }
  ];

  function pick(obj, path) {
    var parts = String(path).split('.'), cur = obj, i;
    for (i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function validate(ir) {
    ir = ir || {};
    var errors = [], warnings = [], i;

    for (i = 0; i < REQUIRED_FIELDS.length; i++) {
      var f = REQUIRED_FIELDS[i];
      var v = pick(ir, f.path);
      if (v === null || v === undefined || String(v).trim() === '') {
        errors.push({ code: 'veld_ontbreekt', field: f.path, message: f.message });
      }
    }
    if (!ir.lines || !ir.lines.length) {
      errors.push({ code: 'geen_regels', field: 'lines', message: 'Er is geen enkele bedragregel om te exporteren.' });
    }
    (ir.lines || []).forEach(function (L, idx) {
      if (!str(L.description)) {
        errors.push({ code: 'regel_zonder_omschrijving', field: 'lines[' + idx + ']', message: 'Regel ' + (idx + 1) + ' heeft geen omschrijving.' });
      }
      if (!int(L.quantityMicro)) {
        errors.push({ code: 'regel_zonder_aantal', field: 'lines[' + idx + ']', message: 'Regel ' + (idx + 1) + ' heeft geen aantal.' });
      }
    });
    /* verlegd en intracommunautair kunnen alleen met het btw-nummer van de
       afnemer. Dat is dezelfde poortwachter als in invoice-core; hij staat
       hier nog eens omdat een e-factuur naar een ander systeem gaat en daar
       niemand meer kan bijsturen. */
    var needsBuyerVat = false;
    (ir.taxGroups || []).forEach(function (g) {
      if (g.treatment === 'reverse' || g.treatment === 'intracom') needsBuyerVat = true;
    });
    if (needsBuyerVat && !str(ir.customer && ir.customer.vatNumber)) {
      errors.push({
        code: 'btw_nummer_afnemer_ontbreekt', field: 'customer.vatNumber',
        message: 'Bij verlegde of intracommunautaire btw is het btw-identificatienummer van de afnemer verplicht.'
      });
    }
    /* de optelsom moet kloppen: dit is de laatste plek waar een fout in de
       snapshot nog zichtbaar wordt vóór hij het huis verlaat */
    var t = ir.totals || {};
    if (int(t.taxExclusiveCents) + int(t.taxCents) !== int(t.taxInclusiveCents)) {
      errors.push({
        code: 'totalen_kloppen_niet', field: 'totals',
        message: 'Totaal exclusief plus btw is niet gelijk aan totaal inclusief. Er is iets mis met de snapshot; exporteren heeft geen zin.'
      });
    }

    if (!str(ir.customer && ir.customer.countryCode)) {
      warnings.push({
        code: 'land_afnemer_onbekend', field: 'customer.countryCode',
        message: 'Het land van de klant is niet uit het adres af te leiden. Er komt geen landcode in de XML; sommige ontvangers weigeren dat.'
      });
    }
    if (!str(ir.supplier && ir.supplier.iban)) {
      warnings.push({
        code: 'iban_ontbreekt', field: 'supplier.iban',
        message: 'Er staat geen IBAN in de export. De ontvanger kan de betaling dan niet automatisch klaarzetten.'
      });
    }
    if (ir.documentKind === 'credit_note' && !str(ir.creditOfNumber)) {
      warnings.push({
        code: 'credit_zonder_referentie', field: 'creditOfNumber',
        message: 'Deze creditnota verwijst niet naar een factuurnummer. Dat mag, maar de ontvanger kan hem dan niet automatisch koppelen.'
      });
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  /* ============================================================
     5. DE XML
     ============================================================
     Met de hand geschreven, want een XML-serializer is in deze stack niet
     beschikbaar en zou voor twee documenttypen te veel zijn. De inspringing
     is puur cosmetisch (XML trekt zich er niets van aan) maar maakt het
     bestand leesbaar voor wie hem opent om te controleren wat er is
     verstuurd — en dat gebeurt precies op de dag dat er iets misgaat.

     De VOLGORDE van de elementen ligt in UBL vast (het schema is een
     sequence). Wie hier iets verplaatst, breekt de validatie bij de
     ontvanger zonder dat er in dit project ook maar iets rood wordt. */
  function tag(name, value, attrs) {
    var a = '';
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] === '' || attrs[k] === null || attrs[k] === undefined) return;
        a += ' ' + k + '="' + escapeXml(attrs[k]) + '"';
      });
    }
    return '<' + name + a + '>' + escapeXml(value) + '</' + name + '>';
  }

  function toXml(ir) {
    ir = ir || {};
    var isCredit = ir.documentKind === 'credit_note';
    var docTag = isCredit ? 'CreditNote' : 'Invoice';
    var lineTag = isCredit ? 'cac:CreditNoteLine' : 'cac:InvoiceLine';
    var qtyTag = isCredit ? 'cbc:CreditedQuantity' : 'cbc:InvoicedQuantity';
    var cur = ir.currency || 'EUR';
    var mu = (ir.minorUnits === undefined || ir.minorUnits === null) ? 2 : int(ir.minorUnits);
    var out = [];

    function push(indent, s) { out.push(new Array(indent + 1).join('  ') + s); }
    function amt(name, cents, indent) {
      push(indent, tag(name, centsToDecimal(cents, mu), { currencyID: cur }));
    }
    function party(indent, wrapper, p) {
      p = p || {};
      var addr = p.address || {};
      push(indent, '<' + wrapper + '>');
      push(indent + 1, '<cac:Party>');
      if (p.email) push(indent + 2, tag('cbc:EndpointID', p.email, { schemeID: 'EM' }));
      push(indent + 2, '<cac:PartyName>');
      push(indent + 3, tag('cbc:Name', p.tradeName || p.name));
      push(indent + 2, '</cac:PartyName>');
      push(indent + 2, '<cac:PostalAddress>');
      if (addr.street) push(indent + 3, tag('cbc:StreetName', addr.street));
      if (addr.city) push(indent + 3, tag('cbc:CityName', addr.city));
      if (addr.postalCode) push(indent + 3, tag('cbc:PostalZone', addr.postalCode));
      if (p.countryCode) {
        push(indent + 3, '<cac:Country>');
        push(indent + 4, tag('cbc:IdentificationCode', p.countryCode));
        push(indent + 3, '</cac:Country>');
      }
      push(indent + 2, '</cac:PostalAddress>');
      if (p.vatNumber) {
        push(indent + 2, '<cac:PartyTaxScheme>');
        push(indent + 3, tag('cbc:CompanyID', p.vatNumber));
        push(indent + 3, '<cac:TaxScheme>');
        push(indent + 4, tag('cbc:ID', 'VAT'));
        push(indent + 3, '</cac:TaxScheme>');
        push(indent + 2, '</cac:PartyTaxScheme>');
      }
      push(indent + 2, '<cac:PartyLegalEntity>');
      push(indent + 3, tag('cbc:RegistrationName', p.name));
      if (p.registrationNumber) push(indent + 3, tag('cbc:CompanyID', p.registrationNumber));
      push(indent + 2, '</cac:PartyLegalEntity>');
      if (p.contactName || p.email || p.phone) {
        push(indent + 2, '<cac:Contact>');
        if (p.contactName) push(indent + 3, tag('cbc:Name', p.contactName));
        if (p.phone) push(indent + 3, tag('cbc:Telephone', p.phone));
        if (p.email) push(indent + 3, tag('cbc:ElectronicMail', p.email));
        push(indent + 2, '</cac:Contact>');
      }
      push(indent + 1, '</cac:Party>');
      push(indent, '</' + wrapper + '>');
    }
    /* De prijs die UBL wil is de prijs EXCLUSIEF btw en NA korting, per
       eenheid. Die leiden we af uit het netto regelbedrag gedeeld door het
       aantal — dan klopt Price × Quantity met LineExtensionAmount, ook bij
       een inclusief ingevoerde prijs. Er blijft hoogstens een halve cent
       afrondingsverschil over; UBL staat dat toe. */
    function unitNet(line) {
      var q = int(line.quantityMicro);
      if (!q) return int(line.netExclCents);
      var num = int(line.netExclCents) * QTY_SCALE;
      var neg = num < 0;
      var v = Math.round(Math.abs(num) / Math.abs(q));
      return (neg !== (q < 0)) ? -v : v;
    }

    push(0, '<?xml version="1.0" encoding="UTF-8"?>');
    push(0, '<' + docTag +
      ' xmlns="urn:oasis:names:specification:ubl:schema:xsd:' + docTag + '-2"' +
      ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
      ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">');
    push(1, tag('cbc:CustomizationID', CUSTOMIZATION_ID));
    push(1, tag('cbc:ProfileID', PROFILE_ID));
    push(1, tag('cbc:ID', ir.number));
    push(1, tag('cbc:IssueDate', ir.issueDate));
    if (!isCredit && ir.dueDate) push(1, tag('cbc:DueDate', ir.dueDate));
    /* UNCL1001: 380 = commerciële factuur, 381 = creditnota */
    push(1, tag(isCredit ? 'cbc:CreditNoteTypeCode' : 'cbc:InvoiceTypeCode', isCredit ? '381' : '380'));
    if (ir.note) push(1, tag('cbc:Note', ir.note));
    push(1, tag('cbc:DocumentCurrencyCode', cur));
    if (ir.accountingCost) push(1, tag('cbc:AccountingCost', ir.accountingCost));
    if (ir.buyerReference) push(1, tag('cbc:BuyerReference', ir.buyerReference));

    if (ir.deliveryStart || ir.deliveryEnd) {
      push(1, '<cac:InvoicePeriod>');
      if (ir.deliveryStart) push(2, tag('cbc:StartDate', ir.deliveryStart));
      if (ir.deliveryEnd) push(2, tag('cbc:EndDate', ir.deliveryEnd));
      push(1, '</cac:InvoicePeriod>');
    }
    if (ir.orderReference) {
      push(1, '<cac:OrderReference>');
      push(2, tag('cbc:ID', ir.orderReference));
      push(1, '</cac:OrderReference>');
    }
    if (isCredit && ir.creditOfNumber) {
      push(1, '<cac:BillingReference>');
      push(2, '<cac:InvoiceDocumentReference>');
      push(3, tag('cbc:ID', ir.creditOfNumber));
      push(2, '</cac:InvoiceDocumentReference>');
      push(1, '</cac:BillingReference>');
    }

    party(1, 'cac:AccountingSupplierParty', ir.supplier);
    party(1, 'cac:AccountingCustomerParty', ir.customer);

    if (ir.supplier && ir.supplier.iban) {
      push(1, '<cac:PaymentMeans>');
      /* UNCL4461: 31 = overboeking */
      push(2, tag('cbc:PaymentMeansCode', '31'));
      if (ir.paymentReference) push(2, tag('cbc:PaymentID', ir.paymentReference));
      push(2, '<cac:PayeeFinancialAccount>');
      push(3, tag('cbc:ID', ir.supplier.iban));
      if (ir.supplier.bic) {
        push(3, '<cac:FinancialInstitutionBranch>');
        push(4, tag('cbc:ID', ir.supplier.bic));
        push(3, '</cac:FinancialInstitutionBranch>');
      }
      push(2, '</cac:PayeeFinancialAccount>');
      push(1, '</cac:PaymentMeans>');
    }
    if (ir.paymentInstructions || ir.paymentTermDays) {
      push(1, '<cac:PaymentTerms>');
      push(2, tag('cbc:Note', ir.paymentInstructions ||
        ('Betaling binnen ' + ir.paymentTermDays + ' dagen')));
      push(1, '</cac:PaymentTerms>');
    }

    var tt = ir.totals || {};
    if (int(tt.allowanceCents)) {
      push(1, '<cac:AllowanceCharge>');
      push(2, tag('cbc:ChargeIndicator', 'false'));
      push(2, tag('cbc:AllowanceChargeReason', 'Factuurkorting'));
      amt('cbc:Amount', int(tt.allowanceCents), 2);
      push(1, '</cac:AllowanceCharge>');
    }
    if (int(tt.chargeCents)) {
      push(1, '<cac:AllowanceCharge>');
      push(2, tag('cbc:ChargeIndicator', 'true'));
      push(2, tag('cbc:AllowanceChargeReason', 'Verzend- en overige kosten'));
      amt('cbc:Amount', int(tt.chargeCents), 2);
      push(1, '</cac:AllowanceCharge>');
    }

    push(1, '<cac:TaxTotal>');
    amt('cbc:TaxAmount', int(tt.taxCents), 2);
    (ir.taxGroups || []).forEach(function (g) {
      var cat = taxCategory(g.treatment);
      push(2, '<cac:TaxSubtotal>');
      amt('cbc:TaxableAmount', g.baseCents, 3);
      amt('cbc:TaxAmount', g.vatCents, 3);
      push(3, '<cac:TaxCategory>');
      push(4, tag('cbc:ID', cat.id));
      push(4, tag('cbc:Percent', milliToDecimal(g.rateMilli)));
      if (cat.needsReason) push(4, tag('cbc:TaxExemptionReason', g.legalNote || cat.reason));
      push(4, '<cac:TaxScheme>');
      push(5, tag('cbc:ID', 'VAT'));
      push(4, '</cac:TaxScheme>');
      push(3, '</cac:TaxCategory>');
      push(2, '</cac:TaxSubtotal>');
    });
    push(1, '</cac:TaxTotal>');

    push(1, '<cac:LegalMonetaryTotal>');
    amt('cbc:LineExtensionAmount', int(tt.lineExtensionCents), 2);
    amt('cbc:TaxExclusiveAmount', int(tt.taxExclusiveCents), 2);
    amt('cbc:TaxInclusiveAmount', int(tt.taxInclusiveCents), 2);
    if (int(tt.allowanceCents)) amt('cbc:AllowanceTotalAmount', int(tt.allowanceCents), 2);
    if (int(tt.chargeCents)) amt('cbc:ChargeTotalAmount', int(tt.chargeCents), 2);
    if (int(tt.prepaidCents)) amt('cbc:PrepaidAmount', int(tt.prepaidCents), 2);
    amt('cbc:PayableAmount', int(tt.payableCents), 2);
    push(1, '</cac:LegalMonetaryTotal>');

    (ir.lines || []).forEach(function (line) {
      var cat = taxCategory(line.treatment);
      push(1, '<' + lineTag + '>');
      push(2, tag('cbc:ID', line.id));
      push(2, tag(qtyTag, microToDecimal(line.quantityMicro), { unitCode: unitCode(line.unit) }));
      amt('cbc:LineExtensionAmount', line.netExclCents, 2);
      if (line.ledgerRef) push(2, tag('cbc:AccountingCost', line.ledgerRef));
      if (line.discountExclCents) {
        push(2, '<cac:AllowanceCharge>');
        push(3, tag('cbc:ChargeIndicator', 'false'));
        push(3, tag('cbc:AllowanceChargeReason', 'Regelkorting'));
        amt('cbc:Amount', line.discountExclCents, 3);
        push(2, '</cac:AllowanceCharge>');
      }
      push(2, '<cac:Item>');
      push(3, tag('cbc:Name', line.description));
      if (line.detail) push(3, tag('cbc:Description', line.detail));
      if (line.productRef) {
        push(3, '<cac:SellersItemIdentification>');
        push(4, tag('cbc:ID', line.productRef));
        push(3, '</cac:SellersItemIdentification>');
      }
      push(3, '<cac:ClassifiedTaxCategory>');
      push(4, tag('cbc:ID', cat.id));
      push(4, tag('cbc:Percent', milliToDecimal(line.rateMilli)));
      push(4, '<cac:TaxScheme>');
      push(5, tag('cbc:ID', 'VAT'));
      push(4, '</cac:TaxScheme>');
      push(3, '</cac:ClassifiedTaxCategory>');
      push(2, '</cac:Item>');
      push(2, '<cac:Price>');
      amt('cbc:PriceAmount', unitNet(line), 3);
      push(2, '</cac:Price>');
      push(1, '</' + lineTag + '>');
    });

    push(0, '</' + docTag + '>');
    return out.join('\n') + '\n';
  }

  function filename(ir) {
    var nr = String((ir && ir.number) || 'zonder-nummer').replace(/[^A-Za-z0-9._-]+/g, '-');
    return (ir && ir.documentKind === 'credit_note' ? 'creditnota-' : 'factuur-') + nr + '.ubl.xml';
  }

  return {
    VERSION: VERSION,
    CUSTOMIZATION_ID: CUSTOMIZATION_ID,
    PROFILE_ID: PROFILE_ID,
    UNIT_CODES: UNIT_CODES,
    unitCode: unitCode,
    TAX_CATEGORIES: TAX_CATEGORIES,
    taxCategory: taxCategory,
    COUNTRY_CODES: COUNTRY_CODES,
    countryCode: countryCode,
    centsToDecimal: centsToDecimal,
    microToDecimal: microToDecimal,
    milliToDecimal: milliToDecimal,
    escapeXml: escapeXml,
    splitAddress: splitAddress,
    fromSnapshot: fromSnapshot,
    validate: validate,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    toXml: toXml,
    filename: filename
  };
});
