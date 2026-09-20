/* CUSTOM+ — betalingen: deelbetaling, overbetaling, tolerantie, het
   audittrail van een terugboeking en het stopcontact voor een provider.
   ------------------------------------------------------------------
   Alles in gehele centen. Elke test die hier staat beschrijft een geval
   waarin een fout niet zichtbaar is op het scherm maar wel in de
   boekhouding: een factuur die op 'betaald' springt terwijl er drie cent
   openstaat, een tegenboeking die groter is dan de betaling die hij
   terugdraait, of een providergebeurtenis die twee keer landt.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-payments.js';

const core = globalThis.CP_INVOICE;
const P = globalThis.CP_PAYMENTS;

export default function (t) {
  t.group('module');
  t.true(!!P, 'portal/invoice-payments.js levert CP_PAYMENTS op');
  t.eq(typeof P.settle, 'function', 'settle() bestaat');

  /* ------------------------------------------------------------------
     1. HET GROOTBOEKJE
     ------------------------------------------------------------------ */
  t.group('grootboekje');
  const L = P.ledger([
    { id: 'a', paidOn: '2026-03-10', amountCents: 50000, method: 'overboeking' },
    { id: 'b', paidOn: '2026-03-01', amountCents: 25000, method: 'ideal' },
    { id: 'c', paidOn: '2026-03-12', amountCents: -25000, reversesPaymentId: 'b' }
  ]);
  t.eq(L.rows[0].id, 'b', 'de rijen staan op betaaldatum, dus de oudste eerst');
  t.eq(L.receivedCents, 75000, 'ontvangen telt alleen de positieve bedragen');
  t.eq(L.reversedCents, 25000, 'teruggeboekt telt de negatieve bedragen als positief getal');
  t.eq(L.paidCents, 50000, 'het saldo is ontvangen min teruggeboekt');
  t.true(L.rows[2].isReversal, 'een negatief bedrag is een tegenboeking');
  t.true(L.rows[0].isReversed, 'de oorspronkelijke betaling weet dat hij is teruggeboekt');
  t.false(L.rows[1].isReversed, 'een betaling zonder tegenboeking is niet teruggeboekt');
  t.eq(P.ledger([]).paidCents, 0, 'geen betalingen is nul, niet undefined');

  /* een tegenboeking wordt NOOIT verrekend door de oude rij te herschrijven:
     beide rijen blijven staan, en dat is het audittrail */
  t.eq(L.count, 3, 'alle drie de rijen blijven bestaan — een correctie verwijdert niets');

  /* ------------------------------------------------------------------
     2. DEELBETALING
     ------------------------------------------------------------------ */
  t.group('deelbetaling');
  const deel = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'a', paidOn: '2026-03-01', amountCents: 40000 }]
  });
  t.eq(deel.code, 'partially_paid', '40 van de 100 is deels betaald');
  t.eq(deel.paidCents, 40000, 'het betaalde bedrag klopt');
  t.eq(deel.outstandingCents, 60000, 'het openstaande bedrag is het verschil');
  t.eq(deel.shortfallCents, 60000, 'het tekort is gelijk aan het openstaande bedrag');
  t.eq(deel.overpaidCents, 0, 'er is niets te veel betaald');
  t.eq(deel.noteNl, '', 'zonder tolerantie is er niets uit te leggen');

  /* twee deelbetalingen tellen op, en de tweede maakt hem vol */
  const twee = P.settle({
    totalInclCents: 100000,
    payments: [
      { id: 'a', paidOn: '2026-03-01', amountCents: 40000 },
      { id: 'b', paidOn: '2026-03-08', amountCents: 60000 }
    ]
  });
  t.eq(twee.code, 'paid', 'twee deelbetalingen samen maken de factuur betaald');
  t.eq(twee.outstandingCents, 0, 'er staat niets meer open');
  t.false(twee.withinTolerance, 'exact betaald is geen tolerantiegeval');

  /* een tegenboeking zet de factuur terug op deels betaald */
  const terug = P.settle({
    totalInclCents: 100000,
    payments: [
      { id: 'a', paidOn: '2026-03-01', amountCents: 100000 },
      { id: 'b', paidOn: '2026-03-05', amountCents: -30000, reversesPaymentId: 'a' }
    ]
  });
  t.eq(terug.paidCents, 70000, 'een tegenboeking telt vanzelf mee in het saldo');
  t.eq(terug.code, 'partially_paid', 'na een gedeeltelijke terugboeking staat de factuur weer open');
  t.eq(terug.reversedCents, 30000, 'het teruggeboekte bedrag blijft zichtbaar');

  /* ------------------------------------------------------------------
     3. OVERBETALING
     ------------------------------------------------------------------ */
  t.group('overbetaling');
  const over = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'a', paidOn: '2026-03-01', amountCents: 110000 }]
  });
  t.eq(over.code, 'overpaid', 'meer dan het totaal is een overbetaling');
  t.eq(over.overpaidCents, 10000, 'het teveel wordt als positief getal gemeld');
  t.eq(over.outstandingCents, -10000, 'het openstaande bedrag wordt negatief');
  t.eq(over.shortfallCents, 0, 'bij een overbetaling is er geen tekort');
  t.true(over.warnings.some((w) => w.code === 'overbetaling'),
    'een overbetaling levert een waarschuwing op — hij mag nooit stil blijven staan');
  t.true(over.warnings[0].message.indexOf('100,00') > -1,
    'de waarschuwing noemt het bedrag dat te veel is ontvangen');

  /* ------------------------------------------------------------------
     4. TOLERANTIE
     ------------------------------------------------------------------ */
  t.group('tolerantie');
  const bijna = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'a', paidOn: '2026-03-01', amountCents: 99997 }],
    toleranceCents: 5
  });
  t.eq(bijna.code, 'paid', 'drie cent tekort binnen een tolerantie van vijf geldt als betaald');
  t.true(bijna.withinTolerance, 'de uitkomst zegt dat de tolerantie is gebruikt');
  t.eq(bijna.shortfallCents, 3, 'het werkelijke tekort blijft zichtbaar — het wordt niet weggepoetst');
  t.true(bijna.noteNl.indexOf('0,03') > -1, 'de notitie noemt het bedrag dat is kwijtgescholden');
  t.true(bijna.noteNl.indexOf('0,05') > -1, 'de notitie noemt de ingestelde tolerantie');

  const netNiet = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'a', paidOn: '2026-03-01', amountCents: 99994 }],
    toleranceCents: 5
  });
  t.eq(netNiet.code, 'partially_paid', 'zes cent tekort valt buiten een tolerantie van vijf');
  t.false(netNiet.withinTolerance, 'buiten de tolerantie is er niets kwijtgescholden');
  t.eq(netNiet.noteNl, '', 'zonder kwijtschelding is er ook geen notitie');

  /* de standaard is nul: een tolerantie is een bewuste instelling */
  const zonder = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'a', paidOn: '2026-03-01', amountCents: 99999 }]
  });
  t.eq(zonder.code, 'partially_paid', 'zonder ingestelde tolerantie is één cent tekort gewoon open');

  /* een negatieve tolerantie wordt als absolute waarde gelezen, niet als
     een tolerantie de andere kant op */
  const negTol = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'a', amountCents: 99997, paidOn: '2026-03-01' }],
    toleranceCents: -5
  });
  t.eq(negTol.code, 'paid', 'een negatief ingevoerde tolerantie telt als vijf cent, niet als min vijf');

  /* ------------------------------------------------------------------
     5. CREDITERING IN DE AFWIKKELING
     ------------------------------------------------------------------ */
  t.group('creditering');
  const metCredit = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'a', amountCents: 40000, paidOn: '2026-03-01' }],
    creditedCents: 60000
  });
  t.eq(metCredit.code, 'paid', '40 betaald plus 60 gecrediteerd sluit de factuur');
  t.eq(metCredit.outstandingCents, 0, 'credit en betaling gaan allebei van het totaal af');

  const teVeelCredit = P.settle({ totalInclCents: 100000, payments: [], creditedCents: 120000 });
  t.true(teVeelCredit.warnings.some((w) => w.code === 'te_veel_gecrediteerd'),
    'meer gecrediteerd dan er staat levert een waarschuwing op');

  /* ------------------------------------------------------------------
     5b. DE KLANTMELDING (migratie 0021)
     Een betaling die de klant in zijn portaal meldt, is dezelfde rij als
     een boeking met reportedByClient true. De databank telt hem pas mee
     zodra verified_at gevuld is; settle() moet exact hetzelfde zeggen,
     anders staat de editor op "betaald" terwijl de factuur open is.
     ------------------------------------------------------------------ */
  t.group('klantmelding');
  const gemeld = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'm', paidOn: '2026-09-03', amountCents: 100000, reportedByClient: true, verifiedAt: null }]
  });
  t.eq(gemeld.code, 'open', 'een onbevestigde klantmelding maakt de factuur niet betaald');
  t.eq(gemeld.paidCents, 0, 'het gemelde bedrag zit niet in het betaalde saldo');
  t.eq(gemeld.outstandingCents, 100000, 'het volledige bedrag staat nog open');
  t.eq(gemeld.unverifiedCents, 100000, 'wat de klant meldt komt apart terug, zonder te worden opgeteld');
  t.eq(gemeld.unverifiedCount, 1, 'en het aantal onbevestigde meldingen ook');
  t.eq(gemeld.paymentCount, 1, 'de melding blijft wel een rij in het grootboekje');
  t.eq(P.nextStatus('sent', gemeld, {}).status, 'sent', 'de status verandert niet op het woord van de klant alleen');

  const bevestigd = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'm', paidOn: '2026-09-03', amountCents: 100000, reportedByClient: true, verifiedAt: '2026-09-04T10:00:00Z' }]
  });
  t.eq(bevestigd.code, 'paid', 'zodra de staf de melding bevestigt telt hij wel mee');
  t.eq(bevestigd.paidCents, 100000, 'het bevestigde bedrag is het betaalde bedrag');
  t.eq(bevestigd.unverifiedCents, 0, 'na bevestiging staat er niets onbevestigds meer');

  const gewoon = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 's', paidOn: '2026-09-03', amountCents: 100000 }]
  });
  t.eq(gewoon.code, 'paid', 'een gewone stafboeking zonder verifiedAt telt zoals altijd mee');
  t.eq(gewoon.unverifiedCents, 0, 'verifiedAt betekent niets bij een boeking van de staf (0021)');

  /* de snake_case-vorm van de databank moet dezelfde uitkomst geven als de
     camelCase-vorm van de demo, anders klopt het alleen in demomodus */
  const snake = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'm', paid_on: '2026-09-03', amount_cents: 100000, reported_by_client: true, verified_at: null }]
  });
  t.eq(snake.paidCents, 0, 'ook een rij in de kolomnamen van de databank telt onbevestigd niet mee');
  const snakeBevestigd = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'm', paid_on: '2026-09-03', amount_cents: 100000, reported_by_client: true, verified_at: '2026-09-04T10:00:00Z' }]
  });
  t.eq(snakeBevestigd.paidCents, 100000, 'en met verified_at gevuld wel');

  /* een stafboeking náást een onbevestigde melding: alleen de boeking telt */
  const gemengd = P.settle({
    totalInclCents: 100000,
    payments: [
      { id: 's', paidOn: '2026-09-01', amountCents: 40000 },
      { id: 'm', paidOn: '2026-09-03', amountCents: 60000, reportedByClient: true }
    ]
  });
  t.eq(gemengd.code, 'partially_paid', 'boeking plus onbevestigde melding is deels betaald, niet betaald');
  t.eq(gemengd.outstandingCents, 60000, 'het gemelde deel staat nog open');

  const G = P.ledger([
    { id: 's', paidOn: '2026-09-01', amountCents: 40000, method: 'ideal' },
    { id: 'm', paidOn: '2026-09-03', amountCents: 60000, reportedByClient: true, method: 'overboeking' }
  ]);
  t.eq(G.count, 2, 'het grootboekje houdt de melding als rij — de staf moet hem kunnen zien en bevestigen');
  t.true(G.rows[1].isUnverifiedReport, 'de rij weet zelf dat hij een onbevestigde melding is');
  t.false(G.rows[0].isUnverifiedReport, 'een gewone boeking is dat niet');
  t.eq(G.paidCents, 40000, 'het saldo van het grootboekje telt de melding niet mee');
  t.eq(G.byMethod.overboeking, undefined, 'en de verdeling per methode ook niet');

  /* ------------------------------------------------------------------
     6. DE AUTOMATISCHE STATUS — altijd door canTransition
     ------------------------------------------------------------------ */
  t.group('automatische status');
  const deelS = P.settle({ totalInclCents: 100000, payments: [{ amountCents: 40000 }] });
  const volS = P.settle({ totalInclCents: 100000, payments: [{ amountCents: 100000 }] });

  t.eq(P.nextStatus('sent', deelS, {}).status, 'partially_paid', 'verstuurd + deelbetaling → deels betaald');
  t.true(P.nextStatus('sent', deelS, {}).changed, 'en dat is een echte wijziging');
  t.eq(P.nextStatus('sent', volS, {}).status, 'paid', 'verstuurd + volledige betaling → betaald');
  t.eq(P.nextStatus('partially_paid', volS, {}).status, 'paid', 'deels betaald wordt betaald');
  t.eq(P.nextStatus('overdue', volS, {}).status, 'paid', 'een vervallen factuur die wordt betaald is betaald');
  t.eq(P.nextStatus('disputed', volS, {}).status, 'paid', 'een betwiste factuur die wordt betaald mag naar betaald');
  t.eq(P.nextStatus('uncollectible', deelS, {}).status, 'partially_paid',
    'een oninbare factuur waarop alsnog wordt betaald komt weer in beweging');

  const cancel = P.nextStatus('cancelled', volS, {});
  t.eq(cancel.status, 'cancelled', 'een geannuleerde factuur blijft geannuleerd, ook als er geld binnenkomt');
  t.false(cancel.changed, 'er verandert niets');
  t.true(cancel.reason.length > 0, 'en er staat uitgelegd waarom niet');

  const credited = P.nextStatus('credited', volS, {});
  t.eq(credited.status, 'credited', 'gecrediteerd is een eindpunt');
  t.false(credited.changed, 'ook als er nog een betaling binnenkomt');

  /* DE WEG TERUG NA EEN TERUGBOEKING.
     Dit geval kwam uit de livetest: een volledig teruggeboekte betaling
     liet de factuur op 'Betaald' staan terwijl het hele bedrag weer
     openstond. Fase 5 heeft daar drie overgangen voor toegevoegd, en ze
     mogen ALLEEN met een expliciete paidCents van 0. */
  const teruggeboekt = P.settle({
    totalInclCents: 100000,
    payments: [
      { id: 'a', paidOn: '2026-03-01', amountCents: 100000 },
      { id: 'b', paidOn: '2026-03-05', amountCents: -100000, reversesPaymentId: 'a' }
    ]
  });
  t.eq(teruggeboekt.paidCents, 0, 'na een volledige terugboeking is er niets meer betaald');
  t.eq(teruggeboekt.outstandingCents, 100000, 'en staat het hele bedrag weer open');

  const heropend = P.nextStatus('paid', teruggeboekt, {});
  t.eq(heropend.status, 'sent', 'een volledig teruggeboekte factuur gaat terug naar Verstuurd');
  t.true(heropend.changed, 'en dat is een echte wijziging — niet stilzwijgend op Betaald blijven staan');

  const heropendTeLaat = P.nextStatus('paid', teruggeboekt, { overdue: true });
  t.eq(heropendTeLaat.status, 'overdue', 'is de vervaldatum al voorbij, dan is hij Vervallen');

  const deelsTeruggeboekt = P.nextStatus('partially_paid', teruggeboekt, {});
  t.eq(deelsTeruggeboekt.status, 'sent', 'ook vanaf Deels betaald gaat hij terug naar Verstuurd');

  /* de rekenkern laat die weg terug alleen toe met een expliciete nul —
     zonder die context blijft de regel van fase 1 letterlijk gelden */
  t.false(core.canTransition('paid', 'overdue').ok,
    'zonder betaalcontext kan een betaalde factuur nog steeds niet alsnog vervallen (regel van fase 1)');
  t.false(core.canTransition('paid', 'sent').ok, 'en ook niet terug naar Verstuurd');
  t.false(core.canTransition('paid', 'overdue', { paidCents: 100 }).ok,
    'met geld op de factuur mag het ook niet');
  t.true(core.canTransition('paid', 'overdue', { paidCents: 0 }).ok,
    'pas als er aantoonbaar niets meer betaald is, mag het');
  t.true(core.canTransition('paid', 'sent', { paidCents: 0 }).ok, 'hetzelfde voor Verstuurd');
  t.true(core.canTransition('partially_paid', 'sent', { paidCents: 0 }).ok,
    'en vanaf Deels betaald ook');
  t.true(core.canTransition('paid', 'overdue', { paidCents: 100 }).reason.indexOf('terug') > -1,
    'de weigering legt uit dat je de betaling eerst moet terugboeken');

  const concept = P.nextStatus('draft', volS, {});
  t.false(concept.changed, 'een concept krijgt geen betaalstatus');
  t.true(concept.reason.indexOf('concept') > -1, 'en dat staat er in gewoon Nederlands bij');

  /* de statuslijst van deze module moet blijven kloppen met de rekenkern */
  t.true(core.STATUSES.indexOf('partially_paid') > -1, 'partially_paid bestaat in het statusmodel');
  t.true(core.canTransition('sent', 'partially_paid', {}).ok, 'de rekenkern staat die overgang ook echt toe');

  /* een vervallen factuur zonder betaling: alleen als de aanroeper zegt dat
     hij vervallen is — deze module verzint geen datums */
  const leeg = P.settle({ totalInclCents: 100000, payments: [] });
  t.eq(P.nextStatus('sent', leeg, { overdue: true }).status, 'overdue', 'met overdue-vlag → vervallen');
  t.false(P.nextStatus('sent', leeg, {}).changed, 'zonder die vlag verandert er niets');

  /* ------------------------------------------------------------------
     7. CONTROLE VÓÓR HET BOEKEN
     ------------------------------------------------------------------ */
  t.group('controle');
  const nul = P.validatePayment({ amountCents: 0, paidOn: '2026-03-01' }, {});
  t.false(nul.ok, 'een betaling van nul wordt geweigerd');
  t.eq(nul.errors[0].code, 'bedrag_nul', 'met een herkenbare foutcode');

  const geenDatum = P.validatePayment({ amountCents: 1000 }, {});
  t.false(geenDatum.ok, 'een betaling zonder datum wordt geweigerd');

  const toekomst = P.validatePayment({ amountCents: 1000, paidOn: '2027-01-01' }, { today: '2026-03-01' });
  t.true(toekomst.ok, 'een betaaldatum in de toekomst mag');
  t.true(toekomst.warnings.some((w) => w.code === 'datum_toekomst'), 'maar hij wordt wel gemeld');

  const andereValuta = P.validatePayment(
    { amountCents: 1000, paidOn: '2026-03-01', currency: 'USD' },
    { invoiceCurrency: 'EUR' });
  t.false(andereValuta.ok, 'een betaling in een andere valuta dan de factuur wordt geweigerd');
  t.true(andereValuta.errors[0].message.indexOf('nooit stilzwijgend omgerekend') > -1,
    'en de melding zegt waarom: er wordt hier nooit een koers verzonnen');

  const teVeelTerug = P.validatePayment(
    { amountCents: -60000, paidOn: '2026-03-02', reversesPaymentId: 'a' },
    { payments: [{ id: 'a', amountCents: 50000, paidOn: '2026-03-01' }] });
  t.false(teVeelTerug.ok, 'je kunt niet meer terugboeken dan er is ontvangen');
  t.eq(teVeelTerug.errors[0].code, 'terugboeking_te_groot', 'met de juiste foutcode');

  const positieveTerugboeking = P.validatePayment(
    { amountCents: 50000, paidOn: '2026-03-02', reversesPaymentId: 'a' },
    { payments: [{ id: 'a', amountCents: 50000, paidOn: '2026-03-01' }] });
  t.false(positieveTerugboeking.ok, 'een terugboeking met een positief bedrag wordt geweigerd');

  const wees = P.validatePayment(
    { amountCents: -1000, paidOn: '2026-03-02', reversesPaymentId: 'zzz' }, { payments: [] });
  t.false(wees.ok, 'een terugboeking van een niet-bestaande betaling wordt geweigerd');

  const meerDanOpen = P.validatePayment(
    { amountCents: 200000, paidOn: '2026-03-01' }, { outstandingCents: 100000 });
  t.true(meerDanOpen.ok, 'meer betalen dan er openstaat mag — het gebeurt');
  t.true(meerDanOpen.warnings.some((w) => w.code === 'meer_dan_openstaand'), 'maar het wordt gemeld');

  /* ------------------------------------------------------------------
     8. DE TEGENBOEKING BOUWEN
     ------------------------------------------------------------------ */
  t.group('tegenboeking');
  const rev = P.buildReversal(
    { id: 'a', invoiceId: 'i1', paidOn: '2026-03-01', amountCents: 50000, method: 'ideal',
      transactionRef: 'X1', provider: 'mollie', providerEventId: 'evt_1' },
    { reason: 'stornering door de bank', today: '2026-03-09' });
  t.eq(rev.amountCents, -50000, 'de tegenboeking is precies het spiegelbeeld');
  t.eq(rev.reversesPaymentId, 'a', 'en hij verwijst naar de oorspronkelijke betaling');
  t.eq(rev.internalNote, 'stornering door de bank', 'de reden reist mee');
  t.eq(rev.paidOn, '2026-03-09', 'de meegegeven datum wordt gebruikt');
  t.eq(rev.providerEventId, '', 'de idempotentiesleutel wordt BEWUST niet overgenomen — anders botst hij met de unieke index');
  t.eq(rev.provider, 'mollie', 'de provider zelf blijft wel staan, want daar kwam het geld vandaan');
  t.throws(() => P.buildReversal({ amountCents: 100 }, {}), 'een tegenboeking zonder bron-id klapt');

  const halveRev = P.buildReversal({ id: 'a', invoiceId: 'i1', amountCents: 50000, paidOn: '2026-03-01' },
    { amountCents: 20000 });
  t.eq(halveRev.amountCents, -20000, 'een gedeeltelijke terugboeking mag');

  /* ------------------------------------------------------------------
     9. WEBHOOK-IDEMPOTENTIE
     ------------------------------------------------------------------ */
  t.group('webhook-idempotentie');
  const bestaand = [{ id: 'a', amountCents: 1000, provider: 'mollie', providerEventId: 'evt_1' }];
  t.true(P.isDuplicateProviderEvent(bestaand, 'mollie', 'evt_1'), 'dezelfde providergebeurtenis wordt herkend');
  t.false(P.isDuplicateProviderEvent(bestaand, 'mollie', 'evt_2'), 'een andere gebeurtenis niet');
  t.false(P.isDuplicateProviderEvent(bestaand, 'stripe', 'evt_1'), 'dezelfde id bij een andere provider is niet dubbel');
  t.false(P.isDuplicateProviderEvent(bestaand, '', ''), 'een handmatige betaling zonder provider is nooit dubbel');
  const dubbel = P.validatePayment(
    { amountCents: 1000, paidOn: '2026-03-01', provider: 'mollie', providerEventId: 'evt_1' },
    { payments: bestaand });
  t.false(dubbel.ok, 'een dubbele providergebeurtenis wordt geweigerd');

  /* ------------------------------------------------------------------
     10. HET STOPCONTACT
     ------------------------------------------------------------------ */
  t.group('provider-interface');
  const handmatig = P.manualProvider();
  t.eq(handmatig.name, 'handmatig', 'de enige implementatie heet handmatig');
  t.false(handmatig.canCollect, 'en hij kan bewust geen geld innen');
  t.throws(() => P.createProvider({ name: 'half' }), 'een provider zonder de drie methoden wordt geweigerd');
  t.throws(() => P.createProvider({ name: 'half', registerPayment: () => {} }),
    'twee van de drie is ook niet genoeg');
  t.true(P.PROVIDER_CONTRACT.indexOf('handleWebhook') > -1, 'het contract beschrijft handleWebhook');
  t.true(P.PROVIDER_STATUSES.indexOf('betaald') > -1, 'de statuslijst kent betaald');

  const hook = handmatig.handleWebhook({ id: 'x' }, {});
  t.false(hook.handled, 'de handmatige provider verwerkt geen webhooks');
  t.true(hook.reason.length > 0, 'en zegt eerlijk waarom niet');

  /* de registerPayment van de handmatige provider laat het providerveld
     leeg: anders zou de unieke index op (provider, provider_event_id) gaan
     gelden voor iets wat geen providergebeurtenis is */
  return handmatig.registerPayment({
    invoiceId: 'i1', amountCents: 12345, paidOn: '2026-03-01', currency: 'EUR', reference: 'bank-9'
  }).then((res) => {
    t.true(res.ok, 'een handmatige betaling wordt geaccepteerd');
    t.eq(res.payment.amountCents, 12345, 'het bedrag komt ongewijzigd terug');
    t.eq(res.payment.provider, '', 'het providerveld blijft leeg bij handmatig');
    t.eq(res.payment.transactionRef, 'bank-9', 'de referentie reist mee');
    return handmatig.registerPayment({ invoiceId: 'i1', amountCents: 0 });
  }).then((res2) => {
    t.false(res2.ok, 'een handmatige betaling zonder bedrag wordt geweigerd');
    return handmatig.getStatus('bank-9');
  }).then((st) => {
    t.eq(st.status, 'onbekend', 'een handmatige betaling heeft geen opvraagbare status — dat is eerlijk');
  });
}
