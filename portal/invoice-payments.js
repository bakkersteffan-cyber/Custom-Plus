/* CUSTOM+ — betalingen op een factuur.
   ------------------------------------------------------------------
   FASE 5. Deze module weet alles over het GELD DAT BINNENKOMT en niets
   over opslag: geen fetch, geen localStorage, geen Supabase. Precies zoals
   invoice-core, invoice-series, invoice-finalize en invoice-mail draait hij
   ongewijzigd in beheer.html én in Node, en daarom is elke regel hieronder
   testbaar zonder browser.

   GELD IS ALTIJD EEN GEHEEL GETAL IN DE KLEINSTE MUNTEENHEID.
   Er staat in dit bestand geen enkele berekening met kommagetallen. Waar er
   gedeeld moet worden (rente, evenredige verdeling) loopt dat via
   CP_INVOICE.divRound() — dezelfde afronding als de rest van de factuur,
   half weg van nul. Deze module rekent bewust NIET zelf: hij leunt op
   invoice-core, want een tweede afrondregel is een tweede waarheid.

   ------------------------------------------------------------------
   DRIE KEUZES DIE UITLEG VERDIENEN

   1. EEN BETALING WORDT NOOIT HERSCHREVEN.
      Corrigeren en terugboeken gebeuren met een NIEUWE rij met een
      negatief bedrag die naar de oorspronkelijke wijst
      (reversesPaymentId). Zou je de oude rij aanpassen, dan verdwijnt
      precies het audittrail dat je nodig hebt op de dag dat een klant
      belt met "ik heb wél betaald". De tabel invoice_payments in
      0008_invoices.sql is om dezelfde reden zo gebouwd.

   2. DE TOLERANTIE IS EEN BEWUSTE INSTELLING, GEEN STILZWIJGENDE GUNST.
      Staat er minder open dan de ingestelde tolerantie (het centverschil
      van een buitenlandse overboeking, de afgeronde bankkosten), dan geldt
      de factuur als volledig betaald — MET een zichtbare notitie die
      precies zegt hoeveel er is kwijtgescholden. De standaard is 0.

   3. DE PROVIDER IS EEN STOPCONTACT, GEEN BANKMODULE.
      createProvider() beschrijft één afspraak — registerPayment, getStatus,
      handleWebhook — en er is precies één implementatie: 'handmatig'. Die
      doet geen enkel netwerkverzoek en kan dat ook niet. Alles wat een
      echte provider (Mollie, Stripe, een bank-API) later nodig heeft, staat
      als contract vast: idempotentie op providerEventId, bedragen in
      centen, en een status uit een vaste lijst. Zo is de dag dat er een
      provider bij komt een dag waarop er één bestand bijkomt en niets
      verandert aan de factuurlogica.

   Publieke API (globalThis.CP_PAYMENTS, en module.exports in Node):
     VERSION, METHODS, methodLabel(key)
     normalizePayment(row)
     ledger(payments)                 alle rijen + het opgetelde saldo; een
                                      onbevestigde klantmelding (0021:
                                      reportedByClient zonder verifiedAt)
                                      staat in de rijen maar niet in het
                                      saldo — zie unverifiedCents
     settle(input)                    betaald / deels / open / te veel
                                      input.currency = de valuta van de
                                      factuur; alle bedragen in noteNl en
                                      warnings worden ermee opgemaakt
     nextStatus(current, settleRes, ctx)
     validatePayment(input, ctx)      {errors, warnings}
     buildReversal(original, opts)    de tegenboeking
     isDuplicateProviderEvent(rows, provider, eventId)
     PROVIDER_CONTRACT, PROVIDER_STATUSES
     createProvider(impl)             de abstracte interface
     manualProvider()                 de enige implementatie: handmatig

   LADEN
     browser : <script src="portal/invoice-payments.js"></script> ná
               portal/invoice-core.js
     node    : import '../portal/invoice-core.js';
               import '../portal/invoice-payments.js';
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_PAYMENTS = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '5.0.0';

  /* De rekenkern is verplicht: er is één afrondregel in dit project en die
     woont in invoice-core.js. Ontbreekt hij, dan zeggen we dat hardop in
     plaats van stilletjes een tweede te bouwen. */
  function core() {
    var c = (root && root.CP_INVOICE) ||
      (typeof globalThis !== 'undefined' ? globalThis.CP_INVOICE : null);
    if (!c) throw new Error('portal/invoice-core.js moet vóór portal/invoice-payments.js geladen zijn.');
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
  function isIsoDate(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00Z').getTime());
  }

  /* Bedragen als Nederlandse tekst, voor de meldingen in dit bestand. Geen
     Intl (die verschilt per omgeving) en vooral: geen deling door 100 met
     een kommagetal. Quotient en rest, net als overal in deze module.

     DE VALUTA KOMT ALTIJD MEE. De eerste versie hardcodeerde '€ ' en deelde
     altijd door 100. Op een factuur in USD of CNY stond er dan letterlijk
     iets onwaars ("er staat nog € 0,03 open" op een CNY-factuur), en op een
     factuur in JPY — nul decimalen, zie CURRENCY_MINOR_UNITS in
     invoice-core — werd 3 yen als "0,03" gepresenteerd. Het aantal
     decimalen komt daarom uit invoice-core: één precisietabel in dit
     project, net zoals er één afrondregel is.

     Het minteken staat VOOR het valutateken ("-€ 25,50"), dezelfde afspraak
     als in portal/invoice-pdf.js. */
  var CURRENCY_SYMBOLS = { EUR: '€', USD: '$', CNY: '¥', JPY: '¥', GBP: '£' };

  /* een valutacode waar je op kunt rekenen: drie hoofdletters, anders EUR */
  function currencyCode(v) {
    var c = String(str(v, 'EUR')).toUpperCase();
    return /^[A-Z]{3}$/.test(c) ? c : 'EUR';
  }

  function money(cents, currency) {
    var code = currencyCode(currency);
    /* geen teken bekend? dan de ISO-code zelf. Een onbekende valuta krijgt
       liever "SEK 12,50" dan het teken van een andere munt. */
    var sym = CURRENCY_SYMBOLS[code] || code;
    var C = core();
    var mu = (typeof C.minorUnitsFor === 'function') ? C.minorUnitsFor(code) : 2;
    var n = int(cents);
    var neg = n < 0;
    if (neg) n = -n;
    var scale = 1, i;
    for (i = 0; i < mu; i++) scale *= 10;
    var whole = Math.floor(n / scale);
    var rest = n - whole * scale;
    var txt = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (mu > 0) txt += ',' + ('000000' + rest).slice(-mu);
    return (neg ? '-' : '') + sym + ' ' + txt;
  }

  /* De valuta van een stel geboekte betalingen, maar alleen als ze het
     eens zijn. Dit is de terugval voor een aanroeper die (nog) geen valuta
     meegeeft: validatePayment() weigert een betaling in een andere valuta
     dan de factuur, dus zijn eensluidende betaalrijen een betrouwbare
     bron. Spreken ze elkaar tegen, dan wordt er niets aangenomen. */
  function ledgerCurrency(rows) {
    var seen = '';
    for (var i = 0; i < (rows || []).length; i++) {
      var c = String(rows[i].currency || '').toUpperCase();
      if (!c) continue;
      if (!seen) seen = c;
      else if (seen !== c) return '';
    }
    return seen;
  }

  /* ============================================================
     1. BETAALMETHODEN
     ============================================================
     Bewust een korte, vaste lijst: dit is een eenmanszaak en geen
     boekhoudpakket. 'overig' vangt alles wat er niet in staat, met de
     transactiereferentie als plek voor het echte verhaal. De sleutels
     komen letterlijk overeen met de check-constraint op
     invoice_payments.method in 0008_invoices.sql. */
  var METHODS = [
    { key: 'overboeking', label: 'Bankoverboeking' },
    { key: 'ideal',       label: 'iDEAL' },
    { key: 'contant',     label: 'Contant' },
    { key: 'verrekening', label: 'Verrekening' },
    { key: 'overig',      label: 'Overig' }
  ];
  var METHOD_KEYS = METHODS.map(function (m) { return m.key; });
  function methodLabel(key) {
    for (var i = 0; i < METHODS.length; i++) if (METHODS[i].key === key) return METHODS[i].label;
    return String(key || '');
  }

  /* ============================================================
     2. ÉÉN BETAALRIJ
     ============================================================ */
  function normalizePayment(row) {
    row = row || {};
    var method = str(row.method, 'overboeking');
    if (METHOD_KEYS.indexOf(method) < 0) method = 'overig';
    return {
      id: str(row.id),
      invoiceId: str(row.invoiceId || row.invoice_id),
      paidOn: isIsoDate(row.paidOn || row.paid_on) ? String(row.paidOn || row.paid_on).slice(0, 10) : '',
      amountCents: int(row.amountCents !== undefined ? row.amountCents : row.amount_cents),
      currency: String(str(row.currency, 'EUR')).toUpperCase(),
      rateToEur: (Number(row.rateToEur || row.rate_to_eur) > 0) ? Number(row.rateToEur || row.rate_to_eur) : null,
      method: method,
      transactionRef: str(row.transactionRef || row.transaction_ref),
      internalNote: str(row.internalNote || row.internal_note),
      /* het bewijs is een INTERNE bijlage. Hij hoort bewust niet in de
         documententabel: die is klantzichtbaar via het portaal, en een
         bankafschrift is dat niet. */
      proofRef: str(row.proofRef || row.proof_path || row.proofPath),
      proofName: str(row.proofName || row.proof_filename),
      proofSize: int(row.proofSize || row.proof_size),
      reversesPaymentId: str(row.reversesPaymentId || row.reverses_payment_id),
      provider: str(row.provider),
      providerEventId: str(row.providerEventId || row.provider_event_id),
      createdBy: str(row.createdBy || row.created_by),
      createdAt: str(row.createdAt || row.created_at),
      /* MIGRATIE 0021: een betaling die de KLANT in zijn portaal meldt
         (report_payment) is dezelfde rij als een stafboeking, met deze vlag
         erop. Zo'n melding is een bewering en geen bankfeit: de databank
         (recalc_invoice_settlement) telt haar pas mee zodra de staf haar
         bevestigt en verified_at zet. Beide velden reizen hier mee zodat
         ledger() dezelfde regel toepast — anders stond de factuureditor op
         "betaald" terwijl de databank "open" zei. Alleen een letterlijke
         true telt als melding: een ontbrekend of vreemd veld is een gewone
         boeking, precies zoals 0021 het bedoelt. */
      reportedByClient: (row.reportedByClient === true || row.reported_by_client === true),
      verifiedAt: str(row.verifiedAt || row.verified_at),
      clientReference: str(row.clientReference || row.client_reference)
    };
  }

  /* ============================================================
     3. HET GROOTBOEKJE VAN ÉÉN FACTUUR
     ============================================================
     Alles wat er ooit op de factuur is geboekt, in de volgorde waarin het
     gebeurde, plus wat er per saldo staat. Een tegenboeking is gewoon een
     rij met een negatief bedrag; hij telt dus vanzelf mee en er is nergens
     een tweede optelling nodig.

     EEN ONBEVESTIGDE KLANTMELDING STAAT WEL IN DE RIJEN MAAR NIET IN HET
     SALDO. De rij blijft zichtbaar (de editor moet kunnen tonen dat de klant
     iets beweert, en de staf moet hem kunnen bevestigen), maar het bedrag
     telt pas mee zodra verifiedAt gevuld is — letterlijk de regel van
     recalc_invoice_settlement() in 0021 ("and not (reported_by_client and
     verified_at is null)"). Tot deze ronde telde ledger() élke rij, en dan
     sprong een factuur in het beheer op "betaald" op het woord van de klant
     terwijl de databank hem terecht open hield. Wat er aan onbevestigd geld
     staat komt apart terug (unverifiedCents), zodat een scherm het kan
     noemen zonder het bij het saldo op te tellen. */
  function ledger(payments) {
    var rows = (payments || []).map(normalizePayment);
    /* op betaaldatum, en bij gelijke datum op aanmaakmoment — zo staat een
       tegenboeking altijd ná de betaling die hij terugdraait */
    rows.sort(function (a, b) {
      if (a.paidOn !== b.paidOn) return a.paidOn < b.paidOn ? -1 : 1;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
    var received = 0, reversed = 0, unverified = 0, unverifiedCount = 0, i;
    var byMethod = {};
    var reversedIds = {};
    for (i = 0; i < rows.length; i++) {
      var p = rows[i];
      p.isUnverifiedReport = !!(p.reportedByClient && !p.verifiedAt);
      if (p.isUnverifiedReport) {
        /* een melding is nooit een tegenboeking; een negatief bedrag erin
           is een fout in de bron en telt hier nergens mee */
        if (p.amountCents > 0) { unverified += p.amountCents; }
        unverifiedCount += 1;
        continue;
      }
      if (p.amountCents < 0) reversed += -p.amountCents; else received += p.amountCents;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amountCents;
      if (p.reversesPaymentId) reversedIds[p.reversesPaymentId] = true;
    }
    for (i = 0; i < rows.length; i++) {
      rows[i].isReversal = rows[i].amountCents < 0;
      rows[i].isReversed = !!(rows[i].id && reversedIds[rows[i].id]);
    }
    return {
      rows: rows,
      count: rows.length,
      receivedCents: received,
      reversedCents: reversed,
      paidCents: received - reversed,
      unverifiedCents: unverified,
      unverifiedCount: unverifiedCount,
      byMethod: byMethod
    };
  }

  /* ============================================================
     4. AFWIKKELING — betaald, deels, open, te veel
     ============================================================
     settlement() in invoice-core doet de kern; deze functie voegt toe wat
     een gebruiker moet zien: het tekort, het teveel en — bij tolerantie —
     de zin die verklaart waarom een factuur op betaald staat terwijl er
     nog drie cent open lijkt te staan. Die zin is NEDERLANDS: hij hoort
     in het beheer, niet op het vel van de klant.

     input.currency is de valuta van de FACTUUR en hoort te worden
     meegegeven; alle bedragen in de meldingen worden ermee opgemaakt. */
  function settle(input) {
    input = input || {};
    var C = core();
    var totalIncl = int(input.totalInclCents);
    var L = ledger(input.payments || []);
    var paid = (input.paidCents !== undefined && input.paidCents !== null)
      ? int(input.paidCents) : L.paidCents;
    var credited = int(input.creditedCents);
    if (credited < 0) credited = -credited;
    var tol = Math.abs(int(input.toleranceCents));
    /* De valuta van de meldingen: bij voorkeur die van de factuur. Geeft de
       aanroeper hem niet mee, dan die van de geboekte betalingen zolang die
       het eens zijn — beter de waarheid uit het grootboekje dan een
       aangenomen euro. Is er niets bekend, dan pas EUR. */
    var currency = currencyCode(str(input.currency) || ledgerCurrency(L.rows) || 'EUR');

    var totals = {
      totalInclCents: totalIncl,
      paidCents: paid,
      creditedCents: credited,
      outstandingCents: totalIncl - paid - credited
    };
    var base = C.settlement(totals, { toleranceCents: tol });

    var res = {
      code: base.code,
      totalInclCents: totalIncl,
      currency: currency,
      paidCents: paid,
      creditedCents: credited,
      reversedCents: L.reversedCents,
      outstandingCents: totals.outstandingCents,
      overpaidCents: base.overpaidCents || 0,
      shortfallCents: totals.outstandingCents > 0 ? totals.outstandingCents : 0,
      toleranceCents: tol,
      withinTolerance: !!base.withinTolerance,
      paymentCount: L.count,
      /* wat de klant heeft GEMELD maar de staf nog niet heeft bevestigd
         (0021). Het zit niet in paidCents en dus ook niet in outstandingCents:
         dat is precies de consistentie met de databank die deze twee velden
         hier rechtvaardigt. Een scherm mag het noemen, nooit optellen. */
      unverifiedCents: L.unverifiedCents,
      unverifiedCount: L.unverifiedCount,
      noteNl: '',
      warnings: []
    };

    /* de zichtbare notitie bij een verschil dat automatisch is
       kwijtgescholden. Zonder deze zin zou een factuur op 'betaald' staan
       terwijl de bank iets anders zegt, en niemand zou weten waarom. */
    if (res.withinTolerance && res.shortfallCents > 0) {
      res.noteNl = 'Er stond nog ' + money(res.shortfallCents, currency) + ' open. Dat valt binnen de ingestelde betaaltolerantie van ' +
        money(tol, currency) + ', dus deze factuur geldt als volledig betaald. Het verschil is niet afgeboekt bij de klant.';
    }
    if (res.overpaidCents > 0) {
      res.warnings.push({
        code: 'overbetaling',
        message: 'Er is ' + money(res.overpaidCents, currency) + ' méér ontvangen dan er op deze factuur staat. Boek het terug of verreken het met een volgende factuur — laat het niet stil staan.'
      });
    }
    if (res.creditedCents > totalIncl && totalIncl > 0) {
      res.warnings.push({
        code: 'te_veel_gecrediteerd',
        message: 'Er is meer gecrediteerd dan er op deze factuur stond. Controleer de gekoppelde creditnota’s.'
      });
    }
    return res;
  }

  /* ============================================================
     5. DE AUTOMATISCHE STATUS
     ============================================================
     De spec vraagt "automatisch partially_paid/paid via het statusmodel".
     Het tweede deel van die zin is het belangrijkste: de nieuwe status
     wordt altijd door canTransition() gehaald. Mag de overgang niet, dan
     verandert er niets en zegt deze functie waarom. Zo kan een betaling
     nooit een geannuleerde factuur weer tot leven wekken.

     Twee statussen worden bewust NIET automatisch verlaten:
       · cancelled en credited zijn eindpunten (de tabel weigert ze al);
       · uncollectible en disputed WORDEN verlaten zodra er geld binnenkomt
         — dat is precies het signaal dat de zaak weer loopt, en de tabel
         staat die overgangen toe. */
  function nextStatus(current, settleRes, ctx) {
    ctx = ctx || {};
    var C = core();
    var from = String(current || 'draft');
    var res = settleRes || {};
    var want = null;

    if (from === 'draft' || from === 'scheduled') {
      return { status: from, changed: false, reason: 'Een concept heeft nog geen betaalstatus; die begint bij het definitief maken.' };
    }
    if (res.code === 'paid' || res.code === 'overpaid') want = 'paid';
    else if (res.paidCents > 0) want = 'partially_paid';
    else if (res.outstandingCents > 0 && (from === 'paid' || from === 'partially_paid')) {
      /* ER IS TERUGGEBOEKT. Het saldo staat weer open terwijl de factuur
         nog 'Betaald' of 'Deels betaald' zegt, en dat is precies het geval
         waarvoor fase 5 de weg terug in de transitietabel heeft gezet.
         canTransition() hieronder laat hem alleen door omdat we
         paidCents: 0 expliciet meesturen. */
      want = ctx.overdue ? 'overdue' : 'sent';
    }
    else if (ctx.overdue && res.outstandingCents > 0) want = 'overdue';

    if (!want || want === from) {
      return { status: from, changed: false, reason: '' };
    }
    /* paidCents gaat ALTIJD expliciet mee — ook als hij 0 is. Dat is niet
       cosmetisch: canTransition() laat de weg terug na een terugboeking
       uitsluitend toe wanneer die nul er echt staat. */
    var chk = C.canTransition(from, want, { paidCents: res.paidCents || 0, hasNumber: ctx.hasNumber !== false });
    if (!chk.ok) {
      return { status: from, changed: false, reason: chk.reason };
    }
    return { status: want, changed: true, reason: '' };
  }

  /* ============================================================
     6. CONTROLE VÓÓR HET BOEKEN
     ============================================================
     Fouten blokkeren, waarschuwingen niet. De grens ligt bij "kan dit
     kloppen?": een betaling in de toekomst kan kloppen (een toezegging die
     je alvast vastlegt), een betaling van nul kan dat niet. */
  function validatePayment(input, ctx) {
    input = input || {};
    ctx = ctx || {};
    var errors = [], warnings = [];
    var p = normalizePayment(input);
    /* de valuta waarin de meldingen hieronder rekenen: die van de factuur
       als de aanroeper hem meegeeft, anders die van de betaling zelf */
    var cur = currencyCode(str(ctx.invoiceCurrency) || p.currency);

    if (!p.amountCents) {
      errors.push({ code: 'bedrag_nul', message: 'Een betaling van ' + money(0, cur) + ' zegt niets. Vul het werkelijk ontvangen bedrag in.' });
    }
    if (!p.paidOn) {
      errors.push({ code: 'datum_ontbreekt', message: 'De betaaldatum ontbreekt.' });
    } else if (ctx.today && p.paidOn > String(ctx.today).slice(0, 10)) {
      warnings.push({ code: 'datum_toekomst', message: 'De betaaldatum ligt in de toekomst. Dat mag, maar controleer of dit klopt.' });
    }
    if (ctx.invoiceDate && p.paidOn && p.paidOn < String(ctx.invoiceDate).slice(0, 10)) {
      warnings.push({ code: 'datum_voor_factuur', message: 'De betaaldatum ligt vóór de factuurdatum. Dat kan bij een vooruitbetaling, maar controleer het.' });
    }
    /* valuta: er wordt NOOIT stil omgerekend. Betaalt een klant in dollars
       op een eurofactuur, dan hoort daar een expliciete beslissing bij en
       niet een koers die deze module zelf verzint. */
    if (ctx.invoiceCurrency && p.currency && p.currency !== String(ctx.invoiceCurrency).toUpperCase()) {
      errors.push({
        code: 'valuta_wijkt_af',
        message: 'De betaling staat in ' + p.currency + ' en de factuur in ' + String(ctx.invoiceCurrency).toUpperCase() +
          '. Boek het bedrag in de valuta van de factuur; er wordt hier nooit stilzwijgend omgerekend.'
      });
    }
    if (p.reversesPaymentId) {
      var orig = null;
      var rows = (ctx.payments || []).map(normalizePayment);
      for (var i = 0; i < rows.length; i++) if (rows[i].id === p.reversesPaymentId) orig = rows[i];
      if (!orig) {
        errors.push({ code: 'terugboeking_zonder_bron', message: 'De betaling die je wilt terugboeken bestaat niet (meer).' });
      } else {
        if (p.amountCents >= 0) {
          errors.push({ code: 'terugboeking_positief', message: 'Een terugboeking is een negatief bedrag. Zo blijft de oorspronkelijke betaling staan en is te zien wat er is gebeurd.' });
        } else if (-p.amountCents > orig.amountCents) {
          errors.push({
            code: 'terugboeking_te_groot',
            /* het bedrag van de OORSPRONKELIJKE betaling, dus ook in de
               valuta waarin die betaling is geboekt */
            message: 'Je kunt niet meer terugboeken dan er is ontvangen. De oorspronkelijke betaling was ' +
              money(orig.amountCents, orig.currency) + '.'
          });
        }
        for (var j = 0; j < rows.length; j++) {
          if (rows[j].reversesPaymentId === p.reversesPaymentId && rows[j].id && rows[j].id !== p.id) {
            warnings.push({ code: 'al_teruggeboekt', message: 'Deze betaling is al eerder (deels) teruggeboekt. Controleer of dit een tweede correctie hoort te zijn.' });
            break;
          }
        }
      }
    }
    if (p.provider && p.providerEventId && isDuplicateProviderEvent(ctx.payments, p.provider, p.providerEventId)) {
      errors.push({
        code: 'provider_dubbel',
        message: 'Deze providergebeurtenis is al als betaling geboekt. Providers leveren gebeurtenissen vaker af; de tweede hoort weggegooid te worden.'
      });
    }
    /* overbetaling is een waarschuwing en geen blokkade: het gebeurt, en
       het moet zichtbaar zijn — niet onmogelijk. */
    if (ctx.outstandingCents !== undefined && p.amountCents > 0 &&
        p.amountCents > int(ctx.outstandingCents) + Math.abs(int(ctx.toleranceCents))) {
      warnings.push({
        code: 'meer_dan_openstaand',
        message: 'Dit bedrag is hoger dan wat er nog openstaat. Er ontstaat dan een overbetaling; die blijft zichtbaar tot je hem terugboekt of verrekent.'
      });
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings, payment: p };
  }

  /* De tegenboeking. Bewust een aparte functie: hem met de hand samenstellen
     is precies de plek waar iemand vergeet de verwijzing mee te geven, en
     dan is het geen correctie meer maar een tweede betaling met een min. */
  function buildReversal(original, opts) {
    opts = opts || {};
    var o = normalizePayment(original);
    if (!o.id) throw new Error('Een terugboeking heeft de oorspronkelijke betaling nodig.');
    var amount = (opts.amountCents === undefined || opts.amountCents === null)
      ? o.amountCents : Math.abs(int(opts.amountCents));
    return {
      invoiceId: o.invoiceId,
      paidOn: isIsoDate(opts.paidOn) ? opts.paidOn : (opts.today || o.paidOn),
      amountCents: -Math.abs(amount),
      currency: o.currency,
      rateToEur: o.rateToEur,
      method: o.method,
      transactionRef: o.transactionRef,
      internalNote: str(opts.reason, 'Teruggeboekt'),
      reversesPaymentId: o.id,
      provider: o.provider,
      /* bewust LEEG: de idempotentiesleutel hoort bij de gebeurtenis van de
         provider, niet bij onze correctie erop. Zou hij worden overgenomen,
         dan botst de tegenboeking met de unieke index in 0008. */
      providerEventId: ''
    };
  }

  /* webhook-idempotentie. Dit is in Supabase-modus een unieke index
     (invoice_payments_provider_event_uniq) en dus de échte garantie; deze
     functie is de demomodus-variant en de vroege melding in het scherm. */
  function isDuplicateProviderEvent(rows, provider, eventId) {
    if (!provider || !eventId) return false;
    var list = (rows || []).map(normalizePayment);
    for (var i = 0; i < list.length; i++) {
      if (list[i].provider === provider && list[i].providerEventId === eventId) return true;
    }
    return false;
  }

  /* ============================================================
     7. HET STOPCONTACT VOOR EEN BETAALPROVIDER
     ============================================================
     GEEN ECHTE PROVIDER, GEEN BANKMODULE. Wat hier staat is de afspraak
     waaraan een toekomstige implementatie moet voldoen, plus de enige
     implementatie die dit systeem vandaag heeft: 'handmatig'. Die doet
     precies niets over het netwerk — een handmatige betaling is een
     mededeling van de eigenaar, geen transactie.

     WAAR EEN ECHTE PROVIDER AANHAAKT (drie plekken, meer niet):
       1. createProvider({...}) met dezelfde drie methoden. De naam wordt de
          waarde van invoice_payments.provider.
       2. Een Netlify Function netlify/functions/<provider>-webhook.mjs die
          de handtekening controleert VÓÓR het parsen — precies zoals
          resend-webhook.mjs dat al doet — en daarna
          provider.handleWebhook(event) aanroept.
       3. De unieke index invoice_payments_provider_event_uniq doet de
          idempotentie. Die staat in de database en niet in code, want code
          verliest van twee gelijktijdige afleveringen.
     Er hoeft niets aan de factuurlogica te veranderen: settle() en
     nextStatus() kijken alleen naar bedragen. */
  var PROVIDER_STATUSES = ['onbekend', 'open', 'betaald', 'mislukt', 'verlopen', 'teruggeboekt'];

  var PROVIDER_CONTRACT = [
    'name            unieke sleutel, landt in invoice_payments.provider',
    'label           Nederlandse naam voor het beheer',
    'canCollect      of deze provider echt geld kan innen (handmatig: nee)',
    'registerPayment(intent) → Promise<{ok, payment, reference, error}>',
    '                intent = {invoiceId, amountCents, currency, reference, note, paidOn}',
    '                payment is een rij in de vorm van normalizePayment()',
    'getStatus(reference) → Promise<{status, amountCents, raw}>',
    '                status komt uit PROVIDER_STATUSES',
    'handleWebhook(event, ctx) → {handled, duplicate, payment, reason}',
    '                MOET idempotent zijn op event.id; ctx.payments zijn de',
    '                al geboekte betalingen van deze factuur'
  ].join('\n');

  function createProvider(impl) {
    impl = impl || {};
    var name = str(impl.name, 'handmatig');
    function need(fn, what) {
      if (typeof fn !== 'function') {
        throw new Error('Een betaalprovider mist ' + what + '. Zie CP_PAYMENTS.PROVIDER_CONTRACT.');
      }
      return fn;
    }
    var reg = need(impl.registerPayment, 'registerPayment(intent)');
    var stat = need(impl.getStatus, 'getStatus(reference)');
    var hook = need(impl.handleWebhook, 'handleWebhook(event, ctx)');
    return {
      name: name,
      label: str(impl.label, name),
      canCollect: !!impl.canCollect,
      registerPayment: function (intent) {
        return Promise.resolve().then(function () { return reg(intent || {}); });
      },
      getStatus: function (reference) {
        return Promise.resolve().then(function () { return stat(reference); });
      },
      handleWebhook: function (event, ctx) {
        return hook(event || {}, ctx || {});
      }
    };
  }

  /* De enige implementatie. Hij bestaat om te bewijzen dat de interface
     bruikbaar is zonder dat er ooit een netwerkverzoek in staat. */
  function manualProvider() {
    return createProvider({
      name: 'handmatig',
      label: 'Handmatig geboekt',
      canCollect: false,
      registerPayment: function (intent) {
        var amount = int(intent.amountCents);
        if (!amount) return { ok: false, error: 'Een handmatige betaling heeft een bedrag nodig.' };
        return {
          ok: true,
          reference: str(intent.reference),
          payment: normalizePayment({
            invoiceId: intent.invoiceId,
            paidOn: intent.paidOn,
            amountCents: amount,
            currency: intent.currency || 'EUR',
            method: intent.method || 'overboeking',
            transactionRef: intent.reference || '',
            internalNote: intent.note || '',
            provider: '',            /* handmatig laat het providerveld LEEG:
                                        anders zou de unieke index op
                                        (provider, provider_event_id) gaan
                                        gelden voor iets wat geen
                                        providergebeurtenis is */
            providerEventId: ''
          })
        };
      },
      getStatus: function () {
        /* eerlijk: er is niets om op te vragen. Een handmatige betaling
           weet alleen wat de eigenaar heeft ingevoerd. */
        return { status: 'onbekend', amountCents: 0, raw: null };
      },
      handleWebhook: function () {
        return { handled: false, duplicate: false, payment: null, reason: 'De handmatige provider ontvangt geen webhooks.' };
      }
    });
  }

  return {
    VERSION: VERSION,
    METHODS: METHODS,
    METHOD_KEYS: METHOD_KEYS,
    methodLabel: methodLabel,
    normalizePayment: normalizePayment,
    ledger: ledger,
    settle: settle,
    nextStatus: nextStatus,
    validatePayment: validatePayment,
    buildReversal: buildReversal,
    isDuplicateProviderEvent: isDuplicateProviderEvent,
    PROVIDER_STATUSES: PROVIDER_STATUSES,
    PROVIDER_CONTRACT: PROVIDER_CONTRACT,
    createProvider: createProvider,
    manualProvider: manualProvider
  };
});
