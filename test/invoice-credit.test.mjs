/* CUSTOM+ — creditnota's en dupliceren.
   ------------------------------------------------------------------
   De belangrijkste test in dit bestand is de crediteerlimiet: er mag
   NOOIT meer worden gecrediteerd dan er nog te crediteren valt. Een
   creditnota die groter is dan zijn factuur maakt van een vordering een
   schuld, en dat kun je bij een controle niet uitleggen.

   De limiet wordt op twee niveaus bewaakt en allebei worden hier getest:
     · per regel, op het AANTAL — zodat je twee van de vijf stuks kunt
       crediteren en later nog eens twee, maar nooit zes;
     · op het TOTAAL in centen — het vangnet, ook voor facturen zonder
       regels (de facturen uit golf 1 die alleen een bedrag dragen).

   Bij dupliceren is de kern juist wat er NIET meegaat.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-credit.js';

const C = globalThis.CP_CREDIT;

/* een definitieve factuur: 5 stoelen à € 100 excl., 21% btw */
function snapshot(over) {
  return Object.assign({
    docKind: 'invoice',
    invoiceNumber: 'CP-2026-0007',
    invoiceDate: '2026-03-01',
    currency: 'EUR', minorUnits: 2, language: 'nl', template: 'standaard',
    administration: 'CP',
    seller: { name: 'CUSTOM+', address: 'Straat 1\n1234 AB Amsterdam' },
    buyer: { name: 'Klant BV', address: 'Rue 2\n1000 Brussel' },
    lines: [
      { sort: 0, type: 'item', description: 'Stoel', quantityMicro: 5000000, unit: 'stuk',
        unitPriceCents: 10000, priceIncludesVat: false, discountType: 'none', discountValue: 0,
        taxCode: 'NL21', rateMilli: 21000, treatment: 'standard',
        grossExclCents: 50000, discountExclCents: 0, netExclCents: 50000,
        vatCents: 10500, inclCents: 60500 },
      { sort: 1, type: 'text', description: 'Levering week 12' }
    ],
    totals: { totalExclCents: 50000, vatCents: 10500, totalInclCents: 60500,
      paidCents: 0, creditedCents: 0, outstandingCents: 60500 }
  }, over || {});
}

/* een definitieve creditnota van 2 stuks (€ 24,20 incl.) */
const credit2 = {
  id: 'c1', statusCode: 'sent', invoiceNumber: 'CPC-2026-0001',
  snapshot: {
    docKind: 'credit_note', invoiceNumber: 'CPC-2026-0001', invoiceDate: '2026-04-01',
    lines: [{ sort: 0, type: 'item', creditOfSort: 0, quantityMicro: 2000000,
      netExclCents: 20000, vatCents: 4200, inclCents: 24200 }],
    totals: { totalInclCents: 24200 }
  }
};

export default function (t) {
  t.group('module');
  t.true(!!C, 'portal/invoice-credit.js levert CP_CREDIT op');

  /* ------------------------------------------------------------------
     1. WAT VALT ER TE CREDITEREN
     ------------------------------------------------------------------ */
  t.group('crediteerbaar');
  const schoon = C.creditable({ snapshot: snapshot(), credits: [] });
  t.eq(schoon.totalInclCents, 60500, 'het totaal komt uit de snapshot');
  t.eq(schoon.creditedCents, 0, 'er is nog niets gecrediteerd');
  t.eq(schoon.remainingCents, 60500, 'dus alles valt nog te crediteren');
  t.false(schoon.fullyCredited, 'en de factuur is niet volledig gecrediteerd');
  t.eq(schoon.lines.length, 2, 'alle regels komen terug, ook de tekstregel');
  t.true(schoon.lines[0].counts, 'de bedragregel telt mee');
  t.false(schoon.lines[1].counts, 'de tekstregel telt niet mee');
  t.eq(schoon.lines[0].remainingQuantityMicro, 5000000, 'alle vijf de stuks staan nog open');
  t.eq(schoon.lines[1].remainingQuantityMicro, 0, 'een tekstregel heeft niets te crediteren');

  const na2 = C.creditable({ snapshot: snapshot(), credits: [credit2] });
  t.eq(na2.creditedCents, 24200, 'de bestaande creditnota telt mee');
  t.eq(na2.remainingCents, 36300, 'er blijft € 363,00 over');
  t.eq(na2.lines[0].creditedQuantityMicro, 2000000, 'twee van de vijf stuks zijn weg');
  t.eq(na2.lines[0].remainingQuantityMicro, 3000000, 'er staan er nog drie open');
  t.eq(na2.creditCount, 1, 'er hangt één meetellende creditnota aan');

  /* een CONCEPT-creditnota telt niet mee: die kan nog veranderen of
     verdwijnen, en dan zou de ruimte tijdelijk kleiner lijken dan hij is */
  const conceptCredit = Object.assign({}, credit2, { id: 'c2', statusCode: 'draft' });
  const metConcept = C.creditable({ snapshot: snapshot(), credits: [conceptCredit] });
  t.eq(metConcept.creditedCents, 0, 'een concept-creditnota telt niet mee');
  t.eq(metConcept.remainingCents, 60500, 'de volledige ruimte blijft dus beschikbaar');

  const geannuleerd = Object.assign({}, credit2, { id: 'c3', statusCode: 'cancelled' });
  t.eq(C.creditable({ snapshot: snapshot(), credits: [geannuleerd] }).creditedCents, 0,
    'een geannuleerde creditnota telt ook niet mee');

  const volledig = C.creditable({
    snapshot: snapshot(),
    credits: [{ id: 'c9', statusCode: 'sent', snapshot: {
      lines: [{ creditOfSort: 0, quantityMicro: 5000000, inclCents: 60500 }],
      totals: { totalInclCents: 60500 } } }]
  });
  t.true(volledig.fullyCredited, 'een volledig gecrediteerde factuur wordt als zodanig herkend');
  t.eq(volledig.remainingCents, 0, 'en er blijft niets over');

  /* ------------------------------------------------------------------
     2. DE CREDITNOTA BOUWEN
     ------------------------------------------------------------------ */
  t.group('creditnota bouwen');
  const vol = C.buildCredit({ snapshot: snapshot(), credits: [], today: '2026-04-01',
    creditOfInvoiceId: 'i1', projectId: 'p1' });
  t.true(vol.ok, 'een volledige creditnota op een schone factuur kan');
  t.eq(vol.head.docKind, 'credit_note', 'het document is een creditnota');
  t.eq(vol.head.creditOfNumber, 'CP-2026-0007', 'met een verwijzing naar het originele nummer');
  t.eq(vol.head.creditOfInvoiceId, 'i1', 'en naar het originele id');
  t.eq(vol.lines.length, 1, 'alleen de bedragregel gaat mee, de tekstregel niet');
  t.eq(vol.lines[0].quantityMicro, 5000000, 'met het volledige aantal');
  t.eq(vol.lines[0].creditOfSort, 0, 'en met de verwijzing naar de regel die hij terugdraait');
  t.true(vol.lines[0].unitPriceCents > 0, 'de bedragen zijn POSITIEF — UBL en het PDF-sjabloon rekenen er zo mee');
  t.eq(vol.head.dueDate, vol.head.invoiceDate, 'een creditnota vervalt niet: er valt niets te betalen');
  t.eq(vol.surcharges.length, 0, 'verzendkosten gaan niet automatisch mee — die zijn gemaakt');

  const deel = C.buildCredit({ snapshot: snapshot(), credits: [], today: '2026-04-01',
    selection: [{ sort: 0, quantityMicro: 2000000 }] });
  t.true(deel.ok, 'gedeeltelijk crediteren kan');
  t.eq(deel.lines[0].quantityMicro, 2000000, 'met precies het gekozen aantal');
  t.eq(deel.estimatedInclCents, 24200, 'twee van de vijf van € 605,00 is € 242,00');

  /* ------------------------------------------------------------------
     3. DE HARDE GRENS
     ------------------------------------------------------------------ */
  t.group('crediteerlimiet');
  const teVeelRegel = C.buildCredit({ snapshot: snapshot(), credits: [], today: '2026-04-01',
    selection: [{ sort: 0, quantityMicro: 6000000 }] });
  t.false(teVeelRegel.ok, 'zes van de vijf stuks crediteren kan niet');
  t.eq(teVeelRegel.errors[0].code, 'meer_dan_crediteerbaar', 'met een herkenbare foutcode');
  t.true(teVeelRegel.errors[0].message.indexOf('Stoel') > -1, 'en de melding noemt de regel');

  const teVeelNaEerdere = C.buildCredit({ snapshot: snapshot(), credits: [credit2], today: '2026-04-01',
    selection: [{ sort: 0, quantityMicro: 4000000 }] });
  t.false(teVeelNaEerdere.ok, 'vier crediteren terwijl er nog maar drie open staan kan niet');

  const preciesGoed = C.buildCredit({ snapshot: snapshot(), credits: [credit2], today: '2026-04-01',
    selection: [{ sort: 0, quantityMicro: 3000000 }] });
  t.true(preciesGoed.ok, 'precies de resterende drie crediteren mag wel');
  t.eq(preciesGoed.estimatedInclCents, 36300, 'en dat is exact het resterende bedrag');

  const opeen = C.buildCredit({ snapshot: snapshot(), credits: [], today: '2026-04-01',
    selection: [{ sort: 0, quantityMicro: 3000000 }, { sort: 0, quantityMicro: 3000000 }] });
  t.false(opeen.ok, 'twee keer dezelfde regel selecteren telt op en loopt tegen het totaal aan');
  t.true(opeen.errors.some((e) => e.code === 'totaal_te_hoog' || e.code === 'meer_dan_crediteerbaar'),
    'en dat wordt geblokkeerd door de totaalcontrole of de regelcontrole');

  const alVol = C.buildCredit({
    snapshot: snapshot(),
    credits: [{ id: 'c9', statusCode: 'sent', snapshot: {
      lines: [{ creditOfSort: 0, quantityMicro: 5000000, inclCents: 60500 }],
      totals: { totalInclCents: 60500 } } }],
    today: '2026-04-01'
  });
  t.false(alVol.ok, 'een volledig gecrediteerde factuur kan niet nog eens');
  t.eq(alVol.errors[0].code, 'al_volledig_gecrediteerd', 'met de juiste foutcode');

  const opCredit = C.buildCredit({ snapshot: snapshot({ docKind: 'credit_note' }), credits: [], today: '2026-04-01' });
  t.false(opCredit.ok, 'een creditnota crediteren kan niet');
  t.eq(opCredit.errors[0].code, 'credit_op_credit', 'met een uitleg dat je dan een nieuwe factuur maakt');

  const zonderNummer = C.buildCredit({ snapshot: snapshot({ invoiceNumber: '' }), credits: [], today: '2026-04-01' });
  t.false(zonderNummer.ok, 'crediteren kan alleen op een definitieve factuur');

  const nietsGekozen = C.buildCredit({ snapshot: snapshot(), credits: [], today: '2026-04-01',
    selection: [{ sort: 1, quantityMicro: 1000000 }] });
  t.false(nietsGekozen.ok, 'alleen een tekstregel selecteren levert geen creditnota op');

  const onbekend = C.buildCredit({ snapshot: snapshot(), credits: [], today: '2026-04-01',
    selection: [{ sort: 99, quantityMicro: 1000000 }] });
  t.false(onbekend.ok, 'een regel die niet op de factuur staat wordt geweigerd');

  t.true(C.buildCredit({ snapshot: snapshot(), credits: [credit2], today: '2026-04-01' }).warnings
    .some((w) => w.code === 'meerdere_credits'),
    'bij een tweede creditnota volgt een waarschuwing — geen blokkade, wel een pauze');

  /* ------------------------------------------------------------------
     4. HET EFFECTIEVE SALDO
     ------------------------------------------------------------------ */
  t.group('effectief saldo');
  const saldo = C.linkedCredits({ snapshot: snapshot(), credits: [credit2], paidCents: 10000 });
  t.eq(saldo.creditedCents, 24200, 'de meetellende credits worden opgeteld');
  t.eq(saldo.outstandingCents, 60500 - 10000 - 24200, 'het openstaande bedrag trekt betaald én gecrediteerd af');
  t.eq(saldo.rows.length, 1, 'het overzicht toont elke gekoppelde creditnota');
  t.true(saldo.rows[0].counts, 'met de vermelding of hij meetelt');
  t.false(saldo.suggestsCreditedStatus, 'gedeeltelijk gecrediteerd is nog geen status “gecrediteerd”');

  const helemaal = C.linkedCredits({
    snapshot: snapshot(),
    credits: [{ id: 'c9', statusCode: 'sent', snapshot: { totals: { totalInclCents: 60500 } } }],
    paidCents: 0
  });
  t.true(helemaal.fullyCredited, 'volledig gecrediteerd wordt herkend');
  t.true(helemaal.suggestsCreditedStatus, 'en dan mag de status “gecrediteerd” worden voorgesteld');

  const helemaalMaarBetaald = C.linkedCredits({
    snapshot: snapshot(),
    credits: [{ id: 'c9', statusCode: 'sent', snapshot: { totals: { totalInclCents: 60500 } } }],
    paidCents: 60500
  });
  t.false(helemaalMaarBetaald.suggestsCreditedStatus,
    'is er ook betaald, dan is “gecrediteerd” te makkelijk — er staat dan geld terug te geven');

  const conceptInLijst = C.linkedCredits({ snapshot: snapshot(), credits: [conceptCredit], paidCents: 0 });
  t.eq(conceptInLijst.creditedCents, 0, 'een concept telt niet mee in het saldo');
  t.eq(conceptInLijst.rows.length, 1, 'maar staat wel in het overzicht');
  t.false(conceptInLijst.rows[0].counts, 'met de eerlijke vermelding dat hij nog niet meetelt');

  /* ------------------------------------------------------------------
     5. DUPLICEREN — de kern is wat er NIET meegaat
     ------------------------------------------------------------------ */
  t.group('dupliceren');
  const bron = {
    id: 'i1', projectId: 'p1', invoiceNumber: 'CP-2026-0007',
    currency: 'EUR', paymentTermDays: 14, label: 'Fase 2',
    purchaseOrder: 'PO-9', clientReference: 'REF-1', costCenter: 'KP-3',
    deliveryStart: '2026-02-01', deliveryEnd: '2026-02-28',
    internalNote: 'nog even bellen', tags: ['spoed'],
    creditOfInvoiceId: null, recurringProfileId: 'rec-1',
    invoiceDiscountType: 'percent', invoiceDiscountValue: 5000,
    introText: 'Hartelijk dank', outroText: 'Tot ziens',
    buyerAddress: 'Rue 2\n1000 Brussel',
    snapshot: snapshot()
  };
  const dup = C.duplicateDraft({ invoice: bron, snapshot: snapshot(), today: '2026-05-01' });
  t.eq(dup.head.invoiceDate, '2026-05-01', 'de kopie krijgt de datum van vandaag');
  t.eq(dup.head.dueDate, '2026-05-15', 'en een verse vervaldatum uit de betaaltermijn');
  t.eq(dup.lines.length, 2, 'alle regels gaan mee, ook de tekstregel');
  t.eq(dup.lines[0].id, null, 'elke regel is een NIEUWE regel, geen tweede verwijzing naar dezelfde rij');
  t.eq(dup.lines[0].quantityMicro, 5000000, 'met hetzelfde aantal');
  t.eq(dup.head.docKind, 'invoice', 'een kopie is altijd een gewone factuur');
  t.eq(dup.discount.type, 'percent', 'de factuurkorting gaat wel mee');
  t.eq(dup.discount.value, 5000, 'met dezelfde waarde');

  t.eq(dup.head.purchaseOrder, '', 'het inkoopordernummer gaat BEWUST niet mee — dat is per opdracht');
  t.eq(dup.head.internalNote, '', 'de interne notitie gaat niet mee');
  t.deep(dup.head.tags, [], 'de interne tags gaan niet mee');
  t.eq(dup.head.deliveryStart, '', 'de leverperiode hoort bij de levering, niet bij de kopie');
  t.eq(dup.head.deliveryEnd, '', 'ook de einddatum niet');
  t.eq(dup.head.invoiceNumber, undefined, 'er komt geen factuurnummer op een kopie');
  t.eq(dup.head.creditOfInvoiceId, undefined, 'de creditkoppeling gaat niet mee');
  t.eq(dup.head.recurringProfileId, undefined, 'de kopie hoort niet bij het terugkerende profiel');
  t.eq(dup.head.snapshot, undefined, 'een kopie is geen definitief document');
  t.eq(dup.head.clientReference, 'REF-1', 'de klantreferentie gaat wél mee — die hoort bij de klant');
  t.eq(dup.head.introText, 'Hartelijk dank', 'de zichtbare teksten gaan mee');
  t.true(dup.dropped.length > 0, 'de lijst van wat er is weggelaten wordt meegegeven, zodat het scherm hem kan tonen');
  t.true(dup.dropped.indexOf('betalingen') > -1, 'betalingen staan expliciet in die lijst');
  t.true(dup.dropped.indexOf('herinneringen') > -1, 'herinneringen ook');

  /* een factuur uit de oude stroom heeft geen regels maar wel een snapshot */
  const uitSnapshot = C.duplicateDraft({ invoice: { id: 'i2', projectId: 'p1', paymentTermDays: 0 },
    snapshot: snapshot(), today: '2026-05-01' });
  t.eq(uitSnapshot.lines.length, 2, 'zonder losse regels wordt er uit de snapshot gekopieerd');
  t.eq(uitSnapshot.head.dueDate, '2026-05-01', 'een betaaltermijn van nul geeft vandaag als vervaldatum');
}
