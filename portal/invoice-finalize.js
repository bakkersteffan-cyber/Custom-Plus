/* CUSTOM+ — definitief maken: snapshot, vergrendeling en de acht stappen.
   ------------------------------------------------------------------
   DE SPEC GEEFT ACHT STAPPEN, IN DEZE VOLGORDE:
     1 valideer verplichte gegevens
     2 herbereken alle bedragen server-side
     3 controleer de nummerreeks
     4 ken atomair een definitief nummer toe
     5 maak een onveranderlijke snapshot
     6 genereer de definitieve PDF
     7 schrijf een audit-event
     8 voorkom normale wijzigingen aan financiële gegevens
   Dit bestand voert die volgorde uit. Het doet zelf geen enkele IO: elke
   stap is een callback die de aanroeper meegeeft. beheer.html geeft de
   browserversie, een latere Netlify Function kan exact dezelfde volgorde
   server-side draaien, en test/invoice-finalize.test.mjs geeft nepstappen.
   Zo is de volgorde zelf getest, niet alleen de brokstukken.

   WAAROM DE VOLGORDE ER ECHT TOE DOET
   Het nummer valt in stap 4, na de validatie en na de herberekening. Zou
   het eerder vallen, dan trekt elke mislukte poging een nummer uit de
   reeks en laat een gat achter. Klapt er na stap 4 alsnog iets, dan meldt
   de driver het uitgegeven nummer terug aan de aanroeper (onNumberOrphan)
   zodat die er een 'cancelled'-regel in number_audit van kan maken. Een
   gat mag bestaan; een onverklaard gat niet.

   DE SNAPSHOT
   buildSnapshot() maakt een diep bevroren kopie van klant-, bedrijfs-,
   adres-, regel- en belastinggegevens plus alle berekende bedragen. Diep
   bevroren, niet "per afspraak onveranderlijk": Object.freeze maakt van
   een programmeerfout een stille no-op in plaats van een gewijzigde
   factuur. snapshotFingerprint() geeft een stabiele vingerafdruk waarmee
   je later kunt aantonen dat er niets aan is gerommeld.

   DE VERGRENDELING
   lockState() zegt of een factuur nog financieel bewerkbaar is en welke
   velden er dan nog overblijven. Na definitief maken zijn dat er precies
   twee: interne tags en de interne notitie. Beide zijn per definitie niet
   klantzichtbaar en staan niet in de snapshot, dus ze kunnen de factuur
   niet veranderen. assertPatch() controleert een voorgenomen wijziging
   tegen die regel en geeft Nederlandse tekst terug voor de beheer-UI.

   Publieke API (globalThis.CP_INVOICE_FINAL, en module.exports in Node):
     VERSION, STEPS, UNITS, CLIENT_STRINGS
     unitLabel(key)
     deepFreeze(obj) / deepClone(obj)
     buildSnapshot(model)            de onveranderlijke factuur
     snapshotFingerprint(snapshot)   stabiele vingerafdruk
     snapshotMatches(a, b)
     lockState(invoice)              {locked, reason, editable[]}
     assertPatch(invoice, patch)     {ok, blocked[], reason}
     canDelete(invoice)              nooit waar bij een definitieve factuur
     runFinalize(handlers)           de acht stappen, op volgorde

   LADEN
     browser : script-tag portal/invoice-finalize.js, na invoice-core.js
     node    : import '../portal/invoice-finalize.js'
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_INVOICE_FINAL = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     1. EENHEDEN EN KLANTZICHTBARE BRONSTRINGS
     ============================================================
     De eenheden uit de spec (uur/stuk/dag/abonnement) plus de twee die een
     productiefactuur werkelijk nodig heeft. De labels zijn NEDERLANDSE
     BRONSTRINGS: ze staan op het klantvel en gaan dus door invT() in
     beheer.html of i18nT() in portal.html.

     CLIENT_STRINGS is de complete lijst bronstrings die de factuurlaag op
     het klantvel zet. test/i18n-invoice.test.mjs leest deze lijst en faalt
     zodra er een vertaling in een van de vier woordenboeken ontbreekt —
     dat is goedkoper dan het over een half jaar in een Franse factuur
     ontdekken. */
  var UNITS = [
    { key: 'stuk', label: 'stuk' },
    { key: 'uur', label: 'uur' },
    { key: 'dag', label: 'dag' },
    { key: 'abonnement', label: 'abonnement' },
    { key: 'set', label: 'set' },
    { key: 'kg', label: 'kg' }
  ];
  function unitLabel(key) {
    var k = String(key || '');
    for (var i = 0; i < UNITS.length; i++) if (UNITS[i].key === k) return UNITS[i].label;
    return k;   /* vrije eenheid: letterlijk wat de gebruiker typte */
  }

  var CLIENT_STRINGS = [
    /* kolomkoppen van de regeltabel */
    'Omschrijving',
    'Eenheid',
    'Prijs per eenheid',
    'Korting',
    'Regelbedrag',
    'Grondslag',
    /* totalenblok */
    'Subtotaal',
    'Regelkortingen',
    'Factuurkorting',
    'Verzend- en overige kosten',
    'Totaal exclusief btw',
    'Totaal inclusief btw',
    'Reeds betaald',
    'Gecrediteerd',
    'Openstaand bedrag',
    'Btw {p}%',
    'Prijzen zijn inclusief btw.',
    /* kopgegevens */
    'Vervaldatum',
    'Betaaltermijn',
    '{n} dagen',
    'Leveringsdatum',
    'Leveringsperiode',
    'Klantreferentie',
    'Inkoopordernummer',
    'Creditnota',
    /* eenheden — ook deze staan op het vel van de klant */
    'stuk', 'uur', 'dag', 'abonnement', 'set', 'kg'
  ];

  /* ============================================================
     2. DIEP KOPIEREN EN DIEP BEVRIEZEN
     ============================================================
     Geen JSON.parse(JSON.stringify(...)): dat verandert stil een undefined
     in "weg" en een Date in tekst. Deze twee lopen expliciet, kennen
     alleen platte data (dat is alles wat een snapshot mag bevatten) en
     laten een cyclus niet ontsporen. */
  function deepClone(v, seen) {
    if (v === null || typeof v !== 'object') return v;
    seen = seen || [];
    for (var s = 0; s < seen.length; s++) if (seen[s].src === v) return seen[s].copy;
    var copy;
    if (Array.isArray(v)) {
      copy = [];
      seen.push({ src: v, copy: copy });
      for (var i = 0; i < v.length; i++) copy.push(deepClone(v[i], seen));
      return copy;
    }
    if (v instanceof Date) return new Date(v.getTime());
    copy = {};
    seen.push({ src: v, copy: copy });
    var keys = Object.keys(v);
    for (var k = 0; k < keys.length; k++) copy[keys[k]] = deepClone(v[keys[k]], seen);
    return copy;
  }

  function deepFreeze(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Object.isFrozen(v)) return v;
    Object.freeze(v);
    var keys = Object.keys(v);
    for (var i = 0; i < keys.length; i++) deepFreeze(v[keys[i]]);
    return v;
  }

  /* ============================================================
     3. DE SNAPSHOT
     ============================================================
     model is de complete werkstand van de factuur zoals de editor hem
     kent. De snapshot neemt daar bewust ALLES uit over wat op papier komt
     of het bedrag bepaalt, en niets wat dat niet doet:

       WEL   verkoper (naam, adres, KvK, btw-nummer, IBAN/BIC), koper
             (naam, handelsnaam, contactpersoon, factuuradres,
             afleveradres, e-mail, registratienummer, btw-nummer), de
             kopvelden, alle regels met hun berekende bedragen, de
             btw-groepen met hun wettelijke vermelding, de totalen, de
             valuta met precisie en het koersanker.
       NIET  de interne notitie en de interne tags. Die zijn niet
             klantzichtbaar en mogen daarom ook na definitief maken nog
             wijzigen; stonden ze in de snapshot, dan zou elke tagwijziging
             de onveranderlijke factuur aanraken.

     De uitkomst is diep bevroren. Wie er daarna toch in schrijft, schrijft
     in het niets — en dat is precies de bedoeling. */
  function buildSnapshot(model) {
    model = model || {};
    var computed = model.computed || {};
    var totals = computed.totals || {};
    var snap = {
      snapshotVersion: 1,
      coreVersion: computed.version || '',
      rounding: model.rounding || 'half-weg-van-nul',
      takenAt: model.takenAt || new Date().toISOString(),

      docKind: model.docKind === 'credit_note' ? 'credit_note' : 'invoice',
      administration: model.administration || 'CP',
      seriesId: model.seriesId || '',
      invoiceNumber: model.invoiceNumber || '',
      creditOfInvoiceId: model.creditOfInvoiceId || null,
      creditOfNumber: model.creditOfNumber || '',

      invoiceDate: model.invoiceDate || '',
      dueDate: model.dueDate || '',
      paymentTermDays: Math.round(Number(model.paymentTermDays) || 0),
      deliveryStart: model.deliveryStart || '',
      deliveryEnd: model.deliveryEnd || '',

      currency: (computed.currency || model.currency || 'EUR'),
      minorUnits: (computed.minorUnits === undefined ? 2 : computed.minorUnits),
      rateToEur: (model.rateToEur && model.rateToEur > 0) ? model.rateToEur : null,
      pricesIncludeVat: !!model.pricesIncludeVat,

      language: model.language || 'nl',
      template: model.template || 'standaard',

      clientReference: model.clientReference || '',
      purchaseOrder: model.purchaseOrder || '',
      costCenter: model.costCenter || '',

      introText: model.introText || '',
      outroText: model.outroText || '',
      paymentInstructions: model.paymentInstructions || '',

      seller: deepClone(model.seller || {}),
      buyer: deepClone(model.buyer || {}),

      lines: [],
      surcharges: deepClone(computed.surcharges || []),
      discount: deepClone(model.discount || { type: 'none', value: 0 }),
      taxGroups: [],
      totals: {
        subtotalBeforeDiscountCents: totals.subtotalBeforeDiscountCents || 0,
        lineDiscountCents: totals.lineDiscountCents || 0,
        netAfterLineDiscountCents: totals.netAfterLineDiscountCents || 0,
        invoiceDiscountCents: totals.invoiceDiscountCents || 0,
        surchargeCents: totals.surchargeCents || 0,
        totalExclCents: totals.totalExclCents || 0,
        vatCents: totals.vatCents || 0,
        totalInclCents: totals.totalInclCents || 0,
        paidCents: totals.paidCents || 0,
        creditedCents: totals.creditedCents || 0,
        outstandingCents: totals.outstandingCents || 0
      }
    };

    var src = computed.lines || [];
    for (var i = 0; i < src.length; i++) {
      var L = src[i];
      snap.lines.push({
        sort: i,
        type: L.type,
        description: L.description || '',
        detail: L.detail || '',
        unit: L.unit || '',
        quantityMicro: L.quantityMicro || 0,
        unitPriceCents: L.unitPriceCents || 0,
        priceIncludesVat: !!L.priceIncludesVat,
        discountType: L.discountType || 'none',
        discountValue: L.discountValue || 0,
        taxCode: L.taxCode || '',
        rateMilli: L.rateMilli || 0,
        treatment: L.treatment || 'standard',
        legalNoteNl: L.legalNoteNl || '',
        ledgerRef: L.ledgerRef || '',
        productRef: L.productRef || '',
        grossExclCents: L.grossExclCents || 0,
        discountExclCents: L.discountExclCents || 0,
        netExclCents: L.netExclCents || 0,
        vatCents: L.vatCents || 0,
        inclCents: L.inclCents || 0
      });
    }

    var groups = computed.groups || [];
    for (var g = 0; g < groups.length; g++) {
      var G = groups[g];
      snap.taxGroups.push({
        taxCode: G.taxCode || '',
        label: G.label || '',
        rateMilli: G.rateMilli || 0,
        treatment: G.treatment || 'standard',
        charges: !!G.charges,
        legalNoteNl: G.legalNoteNl || '',
        baseCents: G.baseCents || 0,
        vatCents: G.vatCents || 0
      });
    }

    return deepFreeze(snap);
  }

  /* Een stabiele vingerafdruk: dezelfde inhoud geeft dezelfde tekst,
     ongeacht de volgorde waarin de sleutels zijn gezet. Geen hash — een
     hashfunctie zou hier alleen maar schijnzekerheid toevoegen; dit is een
     canonieke weergave waarmee je twee snapshots letterlijk kunt
     vergelijken en het verschil kunt tonen. */
  function canonical(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'number') return isFinite(v) ? String(v) : 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v !== 'object') return JSON.stringify(String(v));
    if (Array.isArray(v)) {
      var parts = [];
      for (var i = 0; i < v.length; i++) parts.push(canonical(v[i]));
      return '[' + parts.join(',') + ']';
    }
    var keys = Object.keys(v).sort();
    var kv = [];
    for (var k = 0; k < keys.length; k++) kv.push(JSON.stringify(keys[k]) + ':' + canonical(v[keys[k]]));
    return '{' + kv.join(',') + '}';
  }
  function snapshotFingerprint(snapshot) { return canonical(snapshot); }
  function snapshotMatches(a, b) { return canonical(a) === canonical(b); }

  /* ============================================================
     4. VERGRENDELING NA DEFINITIEF MAKEN
     ============================================================
     Stap 8 van de spec. Vanaf 'finalized' zijn financiële gegevens dicht;
     alleen interne tags en de interne notitie blijven open. De reden staat
     in het antwoord dat de gebruiker krijgt: crediteren, niet herschrijven.

     De statuslijst hieronder is bewust NIET afgeleid uit
     CP_INVOICE.STATUS_META.editable — die zegt hetzelfde, maar dit bestand
     moet ook bruikbaar zijn zonder de rekenkern erbij. Klopt het niet meer
     met elkaar, dan valt dat op in de test die beide leest. */
  var OPEN_STATUSES = ['draft', 'scheduled'];
  var EDITABLE_AFTER_FINALIZE = ['tags', 'internalNote'];

  function lockState(invoice) {
    invoice = invoice || {};
    var status = String(invoice.statusCode || invoice.status_code || 'draft');
    var hasSnapshot = !!(invoice.snapshot);
    var open = OPEN_STATUSES.indexOf(status) > -1 && !hasSnapshot;
    if (open) {
      return { locked: false, status: status, reason: '', editable: null };
    }
    var reason = hasSnapshot && OPEN_STATUSES.indexOf(status) > -1
      ? 'Deze factuur heeft al een vastgelegde snapshot en is daarmee definitief; financiële gegevens liggen vast.'
      : 'Deze factuur is definitief. Financiële gegevens liggen vast — corrigeren doe je met een creditfactuur, niet door de factuur te herschrijven.';
    return { locked: true, status: status, reason: reason, editable: EDITABLE_AFTER_FINALIZE.slice() };
  }

  /* Toetst een voorgenomen wijziging. Geeft altijd Nederlandse tekst
     terug: dit is beheer-UI en serverantwoord, geen klanttekst. */
  function assertPatch(invoice, patch) {
    var st = lockState(invoice);
    if (!st.locked) return { ok: true, blocked: [], reason: '' };
    var blocked = [];
    var keys = Object.keys(patch || {});
    for (var i = 0; i < keys.length; i++) {
      if (EDITABLE_AFTER_FINALIZE.indexOf(keys[i]) < 0) blocked.push(keys[i]);
    }
    if (!blocked.length) return { ok: true, blocked: [], reason: '' };
    return {
      ok: false,
      blocked: blocked,
      reason: st.reason + ' Alleen interne tags en de interne notitie zijn nog te wijzigen.'
    };
  }

  /* Verwijderen. Een definitieve factuur verdwijnt nooit: hij wordt
     geannuleerd (binnen de toegestane statusovergangen, met reden) of
     gecrediteerd. Een concept mag wel weg — dat heeft nooit bestaan. */
  function canDelete(invoice) {
    var st = lockState(invoice);
    if (!st.locked) return { ok: true, reason: '' };
    return {
      ok: false,
      reason: 'Een definitieve factuur kan niet worden verwijderd. Annuleer hem met een reden zolang dat mag, of maak een creditfactuur.'
    };
  }

  /* ============================================================
     5. DE ACHT STAPPEN
     ============================================================
     runFinalize(handlers) draait ze op volgorde. Elke handler geeft een
     Promise terug die oplost naar {ok, detail, data} of naar niets (dan
     geldt de stap als gelukt). Gooit hij, of geeft hij ok:false, dan stopt
     de driver daar en meldt hij precies welke stap het was.

     handlers:
       validate()        stap 1 — verplichte gegevens
       recompute()       stap 2 — bedragen herberekenen (server-side waar dat kan)
       checkSeries()     stap 3 — bestaat de reeks, klopt de periode
       claimNumber()     stap 4 — atomair uitgeven; data.number is verplicht
       snapshot(number)  stap 5 — snapshot vastleggen
       pdf(snapshot)     stap 6 — HOOK VOOR FASE 3, mag ontbreken
       audit(summary)    stap 7 — audit-event over het geheel
       lock(number)      stap 8 — status en vergrendeling wegschrijven
       onStep(step, res) na elke stap; hier schrijft de aanroeper zijn
                         audit-regel per stap
       onNumberOrphan(n) een uitgegeven nummer dat door een latere fout
                         niet op een factuur is beland
  */
  var STEPS = [
    { key: 'valideren',    nr: 1, label: 'Verplichte gegevens controleren' },
    { key: 'herberekenen', nr: 2, label: 'Alle bedragen herberekenen' },
    { key: 'reeks',        nr: 3, label: 'Nummerreeks controleren' },
    { key: 'nummer',       nr: 4, label: 'Definitief nummer atomair toekennen' },
    { key: 'snapshot',     nr: 5, label: 'Onveranderlijke snapshot vastleggen' },
    { key: 'pdf',          nr: 6, label: 'Definitieve PDF genereren' },
    { key: 'audit',        nr: 7, label: 'Audit-event schrijven' },
    { key: 'vergrendelen', nr: 8, label: 'Financiële gegevens vergrendelen' }
  ];

  function runFinalize(handlers) {
    handlers = handlers || {};
    var P = (typeof Promise === 'function') ? Promise : null;
    if (!P) throw new Error('runFinalize heeft Promise nodig.');

    var results = [];
    var number = '';
    var snapshot = null;
    var failed = null;

    function record(step, res) {
      var entry = {
        key: step.key, nr: step.nr, label: step.label,
        ok: !res || res.ok !== false,
        detail: (res && res.detail) || '',
        data: (res && res.data) || null,
        errors: (res && res.errors) || []
      };
      results.push(entry);
      if (typeof handlers.onStep === 'function') {
        try { handlers.onStep(entry); } catch (e) { /* loggen mag nooit de factuur tegenhouden */ }
      }
      return entry;
    }

    function runStep(step) {
      var fn = handlers[stepHandlerName(step.key)];
      if (typeof fn !== 'function') {
        /* een ontbrekende handler is alleen bij de PDF-stap normaal: die
           bouwt fase 3. Elke andere ontbrekende stap is een programmeerfout
           en dat zeggen we hardop. */
        if (step.key === 'pdf') {
          return P.resolve(record(step, { ok: true, detail: 'Overgeslagen — de PDF-generator van fase 3 is nog niet aangesloten.' }));
        }
        return P.reject(new Error('Stap ' + step.nr + ' (' + step.label + ') heeft geen uitvoerder.'));
      }
      var arg = null;
      if (step.key === 'snapshot') arg = number;
      else if (step.key === 'pdf') arg = snapshot;
      else if (step.key === 'vergrendelen') arg = { number: number, snapshot: snapshot };
      else if (step.key === 'audit') arg = { number: number, snapshot: snapshot, steps: results.slice() };
      return P.resolve().then(function () { return fn(arg); }).then(function (res) {
        var entry = record(step, res);
        if (!entry.ok) {
          failed = entry;
          var err = new Error(entry.detail || ('Stap ' + step.nr + ' mislukte.'));
          err.cpStep = entry;
          throw err;
        }
        if (step.key === 'nummer') {
          number = (entry.data && entry.data.number) || '';
          if (!number) {
            failed = entry;
            var e2 = new Error('Stap 4 gaf geen factuurnummer terug.');
            e2.cpStep = entry;
            throw e2;
          }
        }
        if (step.key === 'snapshot') snapshot = (entry.data && entry.data.snapshot) || null;
        return entry;
      });
    }

    var chain = P.resolve();
    STEPS.forEach(function (step) {
      chain = chain.then(function () { return runStep(step); });
    });

    return chain.then(function () {
      return { ok: true, number: number, snapshot: snapshot, steps: results, failedStep: null, error: '' };
    }, function (err) {
      var entry = (err && err.cpStep) || null;
      if (!entry) {
        /* een gooiende handler: alsnog als mislukte stap vastleggen */
        var idx = results.length;
        var step = STEPS[idx] || { key: 'onbekend', nr: idx + 1, label: 'Onbekende stap' };
        entry = record(step, { ok: false, detail: (err && err.message) || String(err) });
      }
      /* stap 4 gelukt maar daarna gestrand: het nummer is uitgegeven en
         hangt aan niets. De aanroeper moet dat kunnen vastleggen. */
      if (number && entry.nr > 4 && typeof handlers.onNumberOrphan === 'function') {
        try { handlers.onNumberOrphan(number, entry); } catch (e) {}
      }
      return {
        ok: false, number: number, snapshot: snapshot, steps: results,
        failedStep: entry, error: (err && err.message) || String(err)
      };
    });
  }

  function stepHandlerName(key) {
    if (key === 'valideren') return 'validate';
    if (key === 'herberekenen') return 'recompute';
    if (key === 'reeks') return 'checkSeries';
    if (key === 'nummer') return 'claimNumber';
    if (key === 'snapshot') return 'snapshot';
    if (key === 'pdf') return 'pdf';
    if (key === 'audit') return 'audit';
    if (key === 'vergrendelen') return 'lock';
    return key;
  }

  return {
    VERSION: VERSION,
    STEPS: STEPS,
    UNITS: UNITS,
    CLIENT_STRINGS: CLIENT_STRINGS,
    OPEN_STATUSES: OPEN_STATUSES,
    EDITABLE_AFTER_FINALIZE: EDITABLE_AFTER_FINALIZE,

    unitLabel: unitLabel,
    deepClone: deepClone,
    deepFreeze: deepFreeze,
    buildSnapshot: buildSnapshot,
    snapshotFingerprint: snapshotFingerprint,
    snapshotMatches: snapshotMatches,
    lockState: lockState,
    assertPatch: assertPatch,
    canDelete: canDelete,
    runFinalize: runFinalize,
    stepHandlerName: stepHandlerName
  };
});
