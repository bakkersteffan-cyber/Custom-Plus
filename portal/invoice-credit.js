/* CUSTOM+ — creditfacturen, en het dupliceren van een factuur.
   ------------------------------------------------------------------
   FASE 5. Pure module, geen IO. Twee onderwerpen die hier samen wonen
   omdat ze allebei precies één ding doen: UIT EEN BESTAANDE FACTUUR EEN
   NIEUW DOCUMENT MAKEN. Crediteren maakt er een tegenboeking van,
   dupliceren een schone kopie. Wat ze delen is de vraag "wat gaat er mee
   en wat blijft er achter", en dat antwoord hoort maar op één plek te
   staan.

   ------------------------------------------------------------------
   HOE EEN CREDITNOTA ER IN DIT SYSTEEM UITZIET

   POSITIEVE bedragen, docKind 'credit_note', en een verwijzing naar het
   origineel. Niet negatief. Drie redenen, en ze wijzen alle drie dezelfde
   kant op:

     · UBL 2.1 schrijft voor dat een CreditNote positieve bedragen draagt —
       het documenttype zegt al dat het de andere kant op gaat;
     · het PDF-sjabloon uit fase 3 rekent er al zo mee (het toont bij een
       creditnota "Openstaand bedrag" in plaats van "Te betalen");
     · computeInvoice() in de rekenkern telt credits met Math.abs() op, dus
       een creditbedrag is daar per definitie een positief getal dat van
       het openstaande saldo AF gaat.

   Het effect op de oorspronkelijke factuur loopt dus via
   invoices.credited_cents, en nergens via een min in de regels.

   ------------------------------------------------------------------
   DE HARDE GRENS: NOOIT MEER CREDITEREN DAN ER STAAT

   creditable() rekent per regel uit hoeveel er nog te crediteren valt,
   gegeven wat er al is gecrediteerd. buildCredit() weigert een selectie
   die daaroverheen gaat. Dat is geen waarschuwing maar een fout: een
   creditnota die groter is dan zijn factuur maakt van een vordering een
   schuld, en die kun je bij een controle niet uitleggen.

   Er wordt op TWEE niveaus geteld:
     · per regel, op het AANTAL (quantityMicro) — zodat je twee van de
       vijf stuks kunt crediteren en later nog eens twee;
     · op het totaal in centen — het laatste vangnet, ook voor facturen
       zonder regels (de golf-1-facturen met alleen een bedrag).

   Publieke API (globalThis.CP_CREDIT, en module.exports in Node):
     VERSION
     creditable(input)              per regel: wat kan er nog weg
     fullSelection(creditableRes)   alles, in één keer
     buildCredit(input)             de conceptcreditnota
     linkedCredits(input)           het overzicht + het effectieve saldo
     duplicateDraft(input)          een schone kopie als nieuw concept

   LADEN
     browser : <script src="portal/invoice-credit.js"></script> ná
               portal/invoice-core.js
     node    : import '../portal/invoice-core.js';
               import '../portal/invoice-credit.js';
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_CREDIT = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '5.0.0';
  var QTY_SCALE = 1000000;

  function core() {
    var c = (root && root.CP_INVOICE) ||
      (typeof globalThis !== 'undefined' ? globalThis.CP_INVOICE : null);
    if (!c) throw new Error('portal/invoice-core.js moet vóór portal/invoice-credit.js geladen zijn.');
    return c;
  }
  function int(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return n < 0 ? -Math.round(-n) : Math.round(n);
  }
  function str(v, dflt) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? (dflt === undefined ? '' : dflt) : s;
  }

  /* ============================================================
     1. WAT VALT ER NOG TE CREDITEREN
     ============================================================
     input:
       snapshot   de onveranderlijke factuur (bron van waarheid) — of, bij
                  een factuur uit de oude stroom, een los {lines, totals}
       credits    de al bestaande creditnota's op deze factuur, elk met hun
                  eigen snapshot (of minimaal {totals, lines, statusCode})

     Alleen creditnota's die ECHT bestaan tellen mee: een concept telt niet,
     een geannuleerde telt niet. Een creditnota die nog niet definitief is,
     kan immers nog veranderen of verdwijnen; zou hij meetellen, dan zou de
     ruimte tijdelijk kleiner lijken dan hij is. */
  var COUNTING_CREDIT_STATUSES = [
    'finalized', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'disputed', 'uncollectible', 'credited'
  ];

  function creditCounts(credit) {
    var st = String((credit && (credit.statusCode || credit.status_code)) || '');
    if (!st) return !!(credit && credit.snapshot);
    return COUNTING_CREDIT_STATUSES.indexOf(st) > -1;
  }

  function creditable(input) {
    input = input || {};
    var snap = input.snapshot || {};
    var srcLines = Array.isArray(snap.lines) ? snap.lines : [];
    var totals = snap.totals || {};
    var minorUnits = (snap.minorUnits === undefined || snap.minorUnits === null) ? 2 : int(snap.minorUnits);

    /* wat er al weg is, per regel en in totaal */
    var usedQty = {}, usedCents = {}, creditedTotal = 0;
    var counted = [];
    (input.credits || []).forEach(function (c) {
      if (!creditCounts(c)) return;
      counted.push(c);
      var cs = c.snapshot || c;
      var ct = (cs && cs.totals) || {};
      creditedTotal += Math.abs(int(ct.totalInclCents));
      var cl = Array.isArray(cs.lines) ? cs.lines : [];
      cl.forEach(function (L) {
        var key = (L.creditOfSort !== undefined && L.creditOfSort !== null) ? String(L.creditOfSort) : null;
        if (key === null) return;    /* een vrije creditregel telt alleen in het totaal */
        usedQty[key] = (usedQty[key] || 0) + Math.abs(int(L.quantityMicro));
        usedCents[key] = (usedCents[key] || 0) + Math.abs(int(L.inclCents !== undefined ? L.inclCents : L.netExclCents));
      });
    });

    var lines = srcLines.map(function (L, i) {
      var sort = (L.sort === undefined || L.sort === null) ? i : int(L.sort);
      var key = String(sort);
      var counts = L.type === 'item' || L.counts === true;
      var qty = Math.abs(int(L.quantityMicro));
      var incl = Math.abs(int(L.inclCents !== undefined ? L.inclCents : (int(L.netExclCents) + int(L.vatCents))));
      var doneQty = usedQty[key] || 0;
      var doneCents = usedCents[key] || 0;
      return {
        sort: sort,
        type: L.type || 'item',
        counts: !!counts,
        description: str(L.description),
        detail: str(L.detail),
        unit: str(L.unit),
        taxCode: str(L.taxCode),
        rateMilli: int(L.rateMilli),
        priceIncludesVat: !!L.priceIncludesVat,
        unitPriceCents: int(L.unitPriceCents),
        discountType: str(L.discountType, 'none'),
        discountValue: int(L.discountValue),
        ledgerRef: str(L.ledgerRef),
        productRef: str(L.productRef),
        originalQuantityMicro: qty,
        originalInclCents: incl,
        creditedQuantityMicro: counts ? Math.min(doneQty, qty) : 0,
        creditedCents: counts ? Math.min(doneCents, incl) : 0,
        remainingQuantityMicro: counts ? Math.max(0, qty - doneQty) : 0,
        remainingInclCents: counts ? Math.max(0, incl - doneCents) : 0
      };
    });

    var totalIncl = Math.abs(int(totals.totalInclCents));
    return {
      currency: str(snap.currency, 'EUR'),
      minorUnits: minorUnits,
      totalInclCents: totalIncl,
      creditedCents: creditedTotal,
      remainingCents: Math.max(0, totalIncl - creditedTotal),
      fullyCredited: totalIncl > 0 && creditedTotal >= totalIncl,
      creditCount: counted.length,
      lines: lines
    };
  }

  /* alles wat er nog te crediteren valt, in één selectie */
  function fullSelection(res) {
    return (res && res.lines ? res.lines : [])
      .filter(function (L) { return L.counts && L.remainingQuantityMicro > 0; })
      .map(function (L) { return { sort: L.sort, quantityMicro: L.remainingQuantityMicro }; });
  }

  /* ============================================================
     2. DE CREDITNOTA BOUWEN
     ============================================================
     input:
       snapshot     de originele factuur
       credits      de al bestaande creditnota's
       selection    [{sort, quantityMicro}] — leeg = volledig crediteren
       reason       de reden, komt op het vel én in het audittrail
       today        'YYYY-MM-DD'
       administration / language / template / paymentTermDays

     uitkomst: {ok, errors[], warnings[], head, lines[], surcharges[],
                creditable}
     head en lines hebben exact de vorm die de editor en computeInvoice()
     eten, zodat de creditnota daarna gewoon een factuur is die door
     dezelfde acht stappen gaat. */
  function buildCredit(input) {
    input = input || {};
    var snap = input.snapshot || {};
    var res = creditable({ snapshot: snap, credits: input.credits });
    var errors = [], warnings = [];

    if (!snap || !snap.invoiceNumber) {
      errors.push({ code: 'geen_definitieve_factuur', message: 'Crediteren kan alleen op een definitieve factuur: die heeft een nummer en een vastgelegde snapshot.' });
    }
    if (String(snap.docKind || 'invoice') === 'credit_note') {
      errors.push({ code: 'credit_op_credit', message: 'Een creditnota crediteer je niet. Maak een nieuwe factuur als er alsnog betaald moet worden.' });
    }
    if (res.fullyCredited && !(input.selection && input.selection.length)) {
      errors.push({ code: 'al_volledig_gecrediteerd', message: 'Deze factuur is al volledig gecrediteerd. Er valt niets meer weg te boeken.' });
    }

    var wanted = (input.selection && input.selection.length) ? input.selection : fullSelection(res);
    if (!wanted.length && !errors.length) {
      errors.push({ code: 'niets_geselecteerd', message: 'Er is geen enkele regel geselecteerd om te crediteren.' });
    }

    var bySort = {};
    res.lines.forEach(function (L) { bySort[String(L.sort)] = L; });

    var lines = [];
    var geschat = 0;
    wanted.forEach(function (sel) {
      var src = bySort[String(sel.sort)];
      if (!src) {
        errors.push({ code: 'regel_onbekend', message: 'Regel ' + sel.sort + ' staat niet op deze factuur.' });
        return;
      }
      if (!src.counts) {
        /* tekstregels en tussenkoppen kun je niet crediteren — er hangt
           geen bedrag aan. Ze mogen wél mee als context; dat doet de
           aanroeper met een eigen tekstregel. */
        return;
      }
      var qty = int(sel.quantityMicro === undefined ? src.remainingQuantityMicro : sel.quantityMicro);
      if (qty <= 0) return;
      if (qty > src.remainingQuantityMicro) {
        errors.push({
          code: 'meer_dan_crediteerbaar',
          message: 'Regel “' + (src.description || ('#' + src.sort)) + '”: je wilt ' + (qty / QTY_SCALE) +
            ' crediteren, maar er staat er nog ' + (src.remainingQuantityMicro / QTY_SCALE) + ' open.'
        });
        return;
      }
      geschat += core().divRound(src.originalInclCents * qty, src.originalQuantityMicro || QTY_SCALE);
      lines.push({
        id: null,
        type: 'item',
        /* de verwijzing die creditable() straks weer leest. Zonder dit veld
           weet niemand meer WELKE regel er is gecrediteerd en kan er per
           ongeluk twee keer dezelfde regel weg. */
        creditOfSort: src.sort,
        description: src.description,
        detail: src.detail,
        quantityMicro: qty,
        unit: src.unit,
        unitPriceCents: src.unitPriceCents,
        priceIncludesVat: src.priceIncludesVat,
        discountType: src.discountType,
        discountValue: src.discountValue,
        taxCode: src.taxCode,
        ledgerRef: src.ledgerRef,
        productRef: src.productRef
      });
    });

    /* Een selectie kan wél gevuld zijn en tóch geen enkele bedragregel
       opleveren — bijvoorbeeld als er alleen een tekstregel of een
       tussenkop is aangevinkt. Zonder deze controle zou dat een lege
       creditnota van € 0,00 opleveren, en die is niet fout maar wel
       zinloos: hij krijgt een nummer uit de reeks en corrigeert niets. */
    if (!lines.length && !errors.length) {
      errors.push({
        code: 'niets_geselecteerd',
        message: 'Er is geen enkele bedragregel geselecteerd. Tekstregels en tussenkoppen dragen geen bedrag en kunnen dus niet worden gecrediteerd.'
      });
    }

    /* het laatste vangnet: ook als elke regel binnen zijn eigen ruimte
       blijft, mag het TOTAAL nooit boven het openstaande creditbedrag
       uitkomen. Dit vangt de golf-1-facturen af die geen regels hebben. */
    if (!errors.length && res.totalInclCents > 0 && geschat > res.remainingCents) {
      errors.push({
        code: 'totaal_te_hoog',
        message: 'Het gecrediteerde totaal komt hoger uit dan wat er nog te crediteren valt. Er is al ' +
          fmt(res.creditedCents) + ' van ' + fmt(res.totalInclCents) + ' gecrediteerd.'
      });
    }
    if (!errors.length && res.creditCount > 0) {
      warnings.push({
        code: 'meerdere_credits',
        message: 'Er staan al ' + res.creditCount + ' creditnota’s op deze factuur. Controleer of deze er echt bij hoort.'
      });
    }

    var today = str(input.today, '');
    var term = int(input.paymentTermDays);
    var head = {
      docKind: 'credit_note',
      administration: str(input.administration, str(snap.administration, 'CP')),
      projectId: str(input.projectId),
      creditOfInvoiceId: str(input.creditOfInvoiceId),
      creditOfNumber: str(snap.invoiceNumber),
      label: 'Creditnota bij ' + str(snap.invoiceNumber, 'factuur'),
      currency: str(snap.currency, 'EUR'),
      pricesIncludeVat: !!snap.pricesIncludeVat,
      invoiceDate: today,
      paymentTermDays: term,
      dueDate: today,       /* een creditnota vervalt niet: er valt niets te betalen */
      deliveryStart: str(snap.deliveryStart),
      deliveryEnd: str(snap.deliveryEnd),
      clientReference: str(snap.clientReference),
      purchaseOrder: str(snap.purchaseOrder),
      costCenter: str(snap.costCenter),
      language: str(input.language, str(snap.language, 'nl')),
      template: str(input.template, str(snap.template, 'standaard')),
      buyerAddress: str((snap.buyer && (snap.buyer.address || snap.buyer.billingAddress)) || ''),
      deliveryAddress: str((snap.buyer && snap.buyer.deliveryAddress) || ''),
      rateToEur: (snap.rateToEur && snap.rateToEur > 0) ? snap.rateToEur : null,
      /* de introtekst zegt in één zin waar dit document over gaat. Hij
         staat op het vel van de klant en gaat dus door de vertaling. */
      introText: '',
      outroText: '',
      internalNote: str(input.reason),
      paymentInstructions: '',
      tags: []
    };

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      head: head,
      lines: lines,
      /* verzendkosten gaan NIET automatisch mee: die zijn gemaakt en
         meestal niet terug te draaien. Wie ze wil crediteren, zet ze er in
         de editor met de hand bij — dat is één handeling en het voorkomt
         dat je stilzwijgend meer terugbetaalt dan bedoeld. */
      surcharges: [],
      discount: { type: 'none', value: 0 },
      estimatedInclCents: geschat,
      creditable: res,
      reason: str(input.reason)
    };

    function fmt(cents) {
      var neg = cents < 0, n = neg ? -cents : cents;
      var whole = Math.floor(n / 100), rest = n - whole * 100;
      return (neg ? '-' : '') + '€ ' + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.') +
        ',' + (rest < 10 ? '0' : '') + rest;
    }
  }

  /* ============================================================
     3. HET OVERZICHT VAN GEKOPPELDE CREDITS
     ============================================================
     Wat de spec "automatische herberekening van het effectieve openstaande
     saldo" noemt. Het antwoord is één getal met zijn herkomst erbij, zodat
     een gebruiker kan zien waaróm er nog € 300 openstaat. */
  function linkedCredits(input) {
    input = input || {};
    var snap = input.snapshot || {};
    var totalIncl = Math.abs(int((snap.totals && snap.totals.totalInclCents) || input.totalInclCents));
    var rows = [];
    var credited = 0;
    (input.credits || []).forEach(function (c) {
      var counts = creditCounts(c);
      var cs = c.snapshot || c;
      var amount = Math.abs(int(((cs && cs.totals) || {}).totalInclCents));
      if (counts) credited += amount;
      rows.push({
        id: str(c.id),
        number: str(c.invoiceNumber || (cs && cs.invoiceNumber), 'nummer volgt'),
        statusCode: str(c.statusCode || c.status_code, 'draft'),
        date: str((cs && cs.invoiceDate) || c.invoiceDate),
        amountCents: amount,
        counts: counts
      });
    });
    rows.sort(function (a, b) { return String(a.date + a.number).localeCompare(String(b.date + b.number)); });
    var paid = int(input.paidCents);
    var outstanding = totalIncl - paid - credited;
    return {
      rows: rows,
      creditedCents: credited,
      paidCents: paid,
      totalInclCents: totalIncl,
      outstandingCents: outstanding,
      fullyCredited: totalIncl > 0 && credited >= totalIncl,
      /* een factuur die volledig is gecrediteerd hoort op 'credited' te
         staan — maar alleen als er niets op betaald is, want dan is er ook
         geld terug te geven en is 'credited' te makkelijk. */
      suggestsCreditedStatus: totalIncl > 0 && credited >= totalIncl && paid === 0
    };
  }

  /* ============================================================
     4. DUPLICEREN
     ============================================================
     "Dupliceren naar nieuw concept (zonder nummer, zonder betalingen,
     zonder snapshot)." Dat is de hele opdracht, en de kunst zit hem in wat
     er NIET meegaat. De lijst hieronder is bewust expliciet in plaats van
     "alles behalve een paar velden": een nieuw veld op de factuur hoort
     standaard NIET mee te reizen, want de kans dat het per ongeluk een
     verstuurde factuur nabootst is groter dan de kans dat het bedoeld is.

     Wat er BEWUST niet meegaat, en waarom:
       invoiceNumber   het nummer valt pas bij definitief maken (fase 2)
       snapshot        een kopie is geen definitief document
       pdf*            hetzelfde bestand hoort bij één factuur
       betalingen      geld hoort bij de factuur waarop het is ontvangen
       herinneringen   die gaan over een schuld die deze kopie niet heeft
       tokens/mail     een klantlink hoort bij het document dat is gestuurd
       creditOf*       een kopie van een creditnota crediteert niets
       recurringProfileId  de kopie hoort niet bij de terugkerende reeks
       tags            interne markeringen zijn per document
  */
  function duplicateDraft(input) {
    input = input || {};
    var src = input.invoice || {};
    var snap = input.snapshot || src.snapshot || null;
    var today = str(input.today);
    var term = (input.paymentTermDays !== undefined && input.paymentTermDays !== null)
      ? int(input.paymentTermDays)
      : int(src.paymentTermDays !== undefined ? src.paymentTermDays : (snap && snap.paymentTermDays));

    /* de regels komen bij voorkeur uit de LEVENDE rijen; alleen als die er
       niet zijn (een factuur uit de oude stroom) valt hij terug op de
       snapshot. Andersom zou een concept dat na de snapshot nog is
       bijgewerkt de oude regels kopiëren. */
    var srcLines = Array.isArray(input.lines) && input.lines.length
      ? input.lines
      : (snap && Array.isArray(snap.lines) ? snap.lines : []);

    var lines = srcLines.map(function (L, i) {
      return {
        id: null,                        /* een kopie is een NIEUWE regel */
        type: str(L.type, 'item'),
        description: str(L.description),
        detail: str(L.detail),
        quantityMicro: int(L.quantityMicro),
        unit: str(L.unit),
        unitPriceCents: int(L.unitPriceCents),
        priceIncludesVat: !!L.priceIncludesVat,
        discountType: str(L.discountType, 'none'),
        discountValue: int(L.discountValue),
        taxCode: str(L.taxCode),
        ledgerRef: str(L.ledgerRef),
        productRef: str(L.productRef),
        sort: i
      };
    });

    var head = {
      docKind: 'invoice',
      administration: str(src.administration, 'CP'),
      projectId: str(input.projectId, str(src.projectId)),
      stageKey: str(src.stageKey, 'concept'),
      label: str(input.label, str(src.label)),
      currency: str(src.currency, 'EUR'),
      pricesIncludeVat: !!src.pricesIncludeVat,
      invoiceDate: today,
      paymentTermDays: term,
      dueDate: today && term >= 0 ? addDays(today, term) : '',
      deliveryStart: '',                 /* een leverperiode hoort bij de
                                            levering, niet bij de kopie */
      deliveryEnd: '',
      clientReference: str(src.clientReference),
      purchaseOrder: '',                 /* een inkoopordernummer is per
                                            opdracht; hergebruiken is een
                                            fout die je pas bij de klant ziet */
      costCenter: str(src.costCenter),
      language: str(src.language, 'nl'),
      template: str(src.template, 'standaard'),
      introText: str(src.introText),
      outroText: str(src.outroText),
      paymentInstructions: str(src.paymentInstructions),
      internalNote: '',
      buyerAddress: str(src.buyerAddress || src.billingAddress),
      deliveryAddress: str(src.deliveryAddress),
      rateToEur: (src.rateToEur && src.rateToEur > 0) ? src.rateToEur : null,
      tags: []
    };

    return {
      head: head,
      lines: lines,
      surcharges: Array.isArray(src.surchargeRows) ? src.surchargeRows.map(function (s) {
        return { label: str(s.label), amountCents: int(s.amountCents), taxCode: str(s.taxCode) };
      }) : [],
      discount: {
        type: str(src.invoiceDiscountType, 'none'),
        value: int(src.invoiceDiscountValue)
      },
      /* de expliciete lijst van wat er is weggelaten. De aanroeper toont
         hem, zodat "dupliceren" nooit een verrassing is. */
      dropped: ['invoiceNumber', 'snapshot', 'pdf', 'betalingen', 'herinneringen',
                'klantlinks', 'mailgeschiedenis', 'creditkoppeling',
                'terugkerend profiel', 'tags', 'interne notitie',
                'inkoopordernummer', 'leverperiode']
    };

    function addDays(iso, days) {
      var d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
      if (isNaN(d.getTime())) return '';
      d.setUTCDate(d.getUTCDate() + days);
      return d.toISOString().slice(0, 10);
    }
  }

  return {
    VERSION: VERSION,
    COUNTING_CREDIT_STATUSES: COUNTING_CREDIT_STATUSES,
    creditable: creditable,
    fullSelection: fullSelection,
    buildCredit: buildCredit,
    linkedCredits: linkedCredits,
    duplicateDraft: duplicateDraft
  };
});
