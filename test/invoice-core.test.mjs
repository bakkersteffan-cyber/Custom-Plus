/* CUSTOM+ — tests voor portal/invoice-core.js.
   Draaien: node test/run.mjs
   ------------------------------------------------------------------
   Elke test hieronder is een geval dat op een echte factuur kan staan.
   Er zit bewust geen enkele test in die alleen bewijst dat een functie
   bestaat; wat hier faalt, is een bedrag dat de klant verkeerd zou zien.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';

const core = globalThis.CP_INVOICE;

/* korte bouwers zodat de gevallen leesbaar blijven */
function line(o) {
  return Object.assign({ type: 'item', description: 'Regel', quantity: 1, taxCode: 'NL21' }, o);
}
function inv(o) {
  return Object.assign({ currency: 'EUR', lines: [] }, o);
}

export default function (t) {

  /* ============================================================
     1. AFRONDEN — de regel waar alles op staat
     ============================================================ */
  t.group('afronden');
  t.eq(core.divRound(5, 2), 3, '2,5 rondt af naar 3 (half omhoog)');
  t.eq(core.divRound(-5, 2), -3, '-2,5 rondt af naar -3 (half wég van nul, zodat crediteren spiegelt)');
  t.eq(core.divRound(4, 2), 2, 'precies deelbaar blijft precies');
  t.eq(core.divRound(1, 3), 0, 'een derde cent verdwijnt');
  t.eq(core.divRound(2, 3), 1, 'tweederde cent wordt een hele');
  t.eq(core.divRound(999999999999, 1000000), 1000000, 'grote deling blijft exact ondanks float-deling');

  /* ============================================================
     2. BEDRAGEN LEZEN — Nederlandse én Engelse notatie
     ============================================================ */
  t.group('bedragen lezen');
  t.eq(core.parseAmountToMinor('12,34', 2), 1234, 'komma is decimaalteken');
  t.eq(core.parseAmountToMinor('12.34', 2), 1234, 'punt met twee cijfers is ook decimaalteken');
  t.eq(core.parseAmountToMinor('1.234,56', 2), 123456, 'punt is duizendscheider zodra er een komma staat');
  t.eq(core.parseAmountToMinor('1,234.56', 2), 123456, 'Engelse notatie: laatste teken telt als decimaal');
  t.eq(core.parseAmountToMinor('1.234', 2), 123400, 'punt met exact drie cijfers zonder komma is duizendtal');
  t.eq(core.parseAmountToMinor('€ 1 234,50', 2), 123450, 'valutateken en spaties vallen weg');
  t.eq(core.parseAmountToMinor('-99,99', 2), -9999, 'negatief bedrag');
  t.eq(core.parseAmountToMinor('10,005', 2), 1001, 'derde decimaal rondt commercieel af naar boven');
  t.eq(core.parseAmountToMinor('appel', 2), null, 'onleesbare invoer geeft null, niet stiekem 0');
  t.eq(core.parseAmountToMinor('', 2), null, 'lege invoer geeft null');

  /* ============================================================
     3. VALUTA-PRECISIE
     ============================================================ */
  t.group('valuta-precisie');
  t.eq(core.minorUnitsFor('EUR'), 2, 'euro heeft centen');
  t.eq(core.minorUnitsFor('JPY'), 0, 'yen heeft geen decimalen');
  t.eq(core.minorUnitsFor('ZZZ'), 2, 'onbekende valuta valt terug op 2 decimalen');
  t.eq(core.parseAmountToMinor('1500', 0), 1500, 'JPY: 1500 yen is 1500 kleinste eenheden');
  t.eq(core.parseAmountToMinor('1500,6', 0), 1501, 'JPY: een halve yen bestaat niet en rondt af');
  t.eq(core.formatMinor(123456, 2), '1234.56', 'ruwe weergave met twee decimalen');
  t.eq(core.formatMinor(-5, 2), '-0.05', 'negatieve cent houdt zijn teken en zijn nullen');
  t.eq(core.formatMinor(1500, 0), '1500', 'JPY krijgt geen decimaalteken');

  {
    const r = core.computeInvoice(inv({
      currency: 'JPY',
      lines: [line({ unitPriceCents: 10000, taxCode: 'NL21' })]
    }));
    t.eq(r.minorUnits, 0, 'JPY-factuur rekent in hele yen');
    t.eq(r.totals.vatCents, 2100, '21% over 10.000 yen is 2.100 yen, een geheel getal');
  }

  /* ============================================================
     4. EEN ENKELE REGEL
     ============================================================ */
  t.group('regelberekening');
  {
    const r = core.computeInvoice(inv({ lines: [line({ quantity: 3, unitPriceCents: 12500 })] }));
    t.eq(r.totals.totalExclCents, 37500, '3 × € 125,00 is € 375,00 exclusief');
    t.eq(r.totals.vatCents, 7875, '21% btw over € 375,00 is € 78,75');
    t.eq(r.totals.totalInclCents, 45375, 'totaal inclusief is € 453,75');
  }
  {
    /* 2,5 uur × € 87,50 = € 218,75 — het klassieke geval waar een float
       218.74999999999997 van maakt */
    const r = core.computeInvoice(inv({ lines: [line({ quantity: '2,5', unitPriceCents: 8750, unit: 'uur' })] }));
    t.eq(r.totals.totalExclCents, 21875, '2,5 uur × € 87,50 is exact € 218,75');
  }
  {
    /* 1/3 stuk × € 0,01 → een derde cent, moet naar 0 */
    const r = core.computeInvoice(inv({ lines: [line({ quantityMicro: 333333, unitPriceCents: 1 })] }));
    t.eq(r.totals.totalExclCents, 0, 'een derde cent rondt af naar nul en niet naar een halve cent');
  }

  /* ============================================================
     5. KORTING PER REGEL
     ============================================================ */
  t.group('regelkorting');
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 10, unitPriceCents: 10000, discountType: 'percent', discountValue: 10000 })]
    }));
    t.eq(r.totals.subtotalBeforeDiscountCents, 100000, 'subtotaal vóór korting is € 1.000,00');
    t.eq(r.totals.lineDiscountCents, 10000, '10% regelkorting is € 100,00');
    t.eq(r.totals.totalExclCents, 90000, 'na korting blijft € 900,00 exclusief over');
    t.eq(r.totals.vatCents, 18900, 'btw rekent over de grondslag ná korting');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 33333, discountType: 'percent', discountValue: 12500 })]
    }));
    t.eq(r.totals.lineDiscountCents, 4167, '12,5% van € 333,33 is € 41,67 (halve cent omhoog)');
    t.eq(r.totals.totalExclCents, 29166, 'bruto min korting klopt tot op de cent');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 2, unitPriceCents: 5000, discountType: 'amount', discountValue: 1500 })]
    }));
    t.eq(r.totals.totalExclCents, 8500, 'vast kortingsbedrag van € 15,00 gaat er recht van af');
  }

  /* ============================================================
     6. PRIJZEN INCLUSIEF BTW — terugrekenen
     ============================================================ */
  t.group('inclusieve prijzen');
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 12100, priceIncludesVat: true })]
    }));
    t.eq(r.totals.totalExclCents, 10000, '€ 121,00 inclusief 21% is € 100,00 exclusief');
    t.eq(r.totals.vatCents, 2100, 'de btw is € 21,00');
    t.eq(r.totals.totalInclCents, 12100, 'het inclusieve totaal is exact wat er getypt is');
  }
  {
    /* het lastige geval: € 100,00 inclusief rekent niet rond terug */
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 10000, priceIncludesVat: true })]
    }));
    t.eq(r.totals.totalExclCents, 8264, '€ 100,00 incl. is € 82,64 excl.');
    t.eq(r.totals.vatCents, 1736, 'de btw is het VERSCHIL en dus € 17,36, niet 21% van 82,64');
    t.eq(r.totals.totalInclCents, 10000, 'de klant betaalt exact de € 100,00 die er stond');
  }
  {
    const r = core.computeInvoice(inv({
      pricesIncludeVat: true,
      lines: [line({ quantity: 3, unitPriceCents: 10000 })]
    }));
    t.eq(r.totals.totalInclCents, 30000, 'de factuurstand incl. btw geldt ook voor regels die niets zeggen');
  }
  {
    /* inclusief + regelkorting: bruto en netto worden apart teruggerekend
       en de korting is het verschil, zodat er geen zwevende cent ontstaat */
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 10000, priceIncludesVat: true, discountType: 'percent', discountValue: 10000 })]
    }));
    t.eq(r.totals.subtotalBeforeDiscountCents - r.totals.lineDiscountCents, r.totals.totalExclCents,
      'subtotaal min regelkorting is exact het totaal exclusief');
    t.eq(r.totals.totalInclCents, 9000, '10% korting op € 100,00 incl. geeft € 90,00 incl.');
  }

  /* ============================================================
     7. GEMENGDE BTW-TARIEVEN
     ============================================================ */
  t.group('gemengde btw-tarieven');
  {
    const r = core.computeInvoice(inv({
      lines: [
        line({ description: 'Ontwerp', quantity: 1, unitPriceCents: 100000, taxCode: 'NL21' }),
        line({ description: 'Boekje', quantity: 1, unitPriceCents: 50000, taxCode: 'NL9' })
      ]
    }));
    t.eq(r.groups.length, 2, 'twee tarieven geven twee btw-groepen');
    t.eq(r.groups[0].baseCents, 100000, 'grondslag 21% is € 1.000,00');
    t.eq(r.groups[0].vatCents, 21000, 'btw 21% is € 210,00');
    t.eq(r.groups[1].baseCents, 50000, 'grondslag 9% is € 500,00');
    t.eq(r.groups[1].vatCents, 4500, 'btw 9% is € 45,00');
    t.eq(r.totals.vatCents, 25500, 'de btw-totalen tellen op tot € 255,00');
    t.eq(r.totals.totalInclCents, 175500, 'het eindtotaal is € 1.755,00');
  }

  /* ============================================================
     8. FACTUURKORTING, OOK SAMEN MET REGELKORTING
     ============================================================ */
  t.group('factuurkorting');
  {
    const r = core.computeInvoice(inv({
      lines: [
        line({ quantity: 1, unitPriceCents: 100000, taxCode: 'NL21', discountType: 'percent', discountValue: 10000 }),
        line({ quantity: 1, unitPriceCents: 50000, taxCode: 'NL9' })
      ],
      discount: { type: 'percent', value: 5000 }
    }));
    t.eq(r.totals.netAfterLineDiscountCents, 140000, 'na € 100,00 regelkorting resteert € 1.400,00');
    t.eq(r.totals.invoiceDiscountCents, 7000, '5% factuurkorting over € 1.400,00 is € 70,00');
    t.eq(r.totals.totalExclCents, 133000, 'totaal exclusief is € 1.330,00');
    t.eq(r.groups[0].discountShareCents + r.groups[1].discountShareCents, 7000,
      'de verdeelde korting telt exact op tot de factuurkorting');
    t.eq(r.groups[0].discountShareCents, 4500, 'het 21%-deel draagt naar rato € 45,00');
    t.eq(r.groups[1].discountShareCents, 2500, 'het 9%-deel draagt naar rato € 25,00');
    /* de 21%-regel staat na zijn eigen 10% korting op € 900,00 → € 189,00
       btw; de toegewezen factuurkorting van € 45,00 haalt daar € 9,45 af */
    t.eq(r.groups[0].vatCents, 18900 - 945, 'de btw 21% daalt mee met de toegewezen korting');
  }
  {
    /* de klassieke restcent: € 10,00 korting over grondslagen 33,33 en 66,67 */
    const r = core.computeInvoice(inv({
      lines: [
        line({ quantity: 1, unitPriceCents: 3333, taxCode: 'NL21' }),
        line({ quantity: 1, unitPriceCents: 6667, taxCode: 'NL9' })
      ],
      discount: { type: 'amount', value: 1000 }
    }));
    t.eq(r.groups[0].discountShareCents + r.groups[1].discountShareCents, 1000,
      'grootste-restverdeling laat geen cent liggen');
    t.eq(r.totals.totalExclCents, 9000, 'na € 10,00 korting blijft € 90,00 over');
  }
  t.deep(core.allocateProportional(1000, [3333, 6667]), [333, 667], 'verdeling los getest: 333 + 667 = 1000');
  t.deep(core.allocateProportional(10, [1, 1, 1]), [4, 3, 3], 'onverdeelbare rest gaat naar de grootste resten');
  t.deep(core.allocateProportional(-10, [1, 1, 1]), [-4, -3, -3], 'een negatieve verdeling spiegelt netjes');
  t.deep(core.allocateProportional(100, [0, 0]), [100, 0], 'zonder gewicht valt alles op de eerste groep');

  /* ------------------------------------------------------------------
     8b. EEN NEGATIEVE BTW-GROEP KRIJGT EEN NEGATIEF DEEL VAN DE KORTING
     ------------------------------------------------------------------
     Een coulance- of verrekenregel maakt een btw-groep negatief. Werd er
     op absolute waarde gewogen, dan kreeg die groep een POSITIEF deel van
     de korting en werd hij dieper negatief in plaats van kleiner: het
     eindtotaal klopte, de richting en de btw per groep niet. Evenredig
     verdelen betekent dat elke groep met dezelfde factor krimpt.
     ------------------------------------------------------------------ */
  t.deep(core.allocateProportional(90, [1000, -100]), [100, -10],
    'een negatieve groep krijgt een negatief deel: +100 en -10 samen is 90, en beide groepen krimpen met 10%');
  t.deep(core.allocateProportional(-90, [1000, -100]), [-100, 10],
    'en gespiegeld precies andersom, zodat crediteren het spiegelbeeld blijft');
  t.deep(core.allocateProportional(-110, [-1000, -100]), [-100, -10],
    'een volledig negatieve factuur (creditnota) verdeelt gewoon evenredig mee');
  {
    const scheef = core.allocateProportional(100, [3333, -1000]);
    t.eq(scheef[0] + scheef[1], 100, 'ook met een negatieve groep telt de verdeling exact op tot de korting');
    t.true(scheef[1] < 0, 'en het deel van de negatieve groep is negatief');
  }
  {
    /* dezelfde regel op een echte factuur: € 1.000,00 werk (21%) en
       € 100,00 coulance (9%), met 10% factuurkorting over het netto van
       € 900,00. Elke groep hoort 10% te krimpen. */
    const r = core.computeInvoice(inv({
      lines: [
        line({ description: 'Werk', quantity: 1, unitPriceCents: 100000, taxCode: 'NL21' }),
        line({ description: 'Coulance', quantity: 1, unitPriceCents: -10000, taxCode: 'NL9' })
      ],
      discount: { type: 'percent', value: 10000 }
    }));
    t.eq(r.totals.netAfterLineDiscountCents, 90000, 'het netto van de factuur is € 900,00');
    t.eq(r.totals.invoiceDiscountCents, 9000, '10% factuurkorting is € 90,00');
    t.eq(r.groups[0].discountShareCents, 10000, 'de 21%-groep draagt € 100,00 van de korting');
    t.eq(r.groups[1].discountShareCents, -1000, 'de negatieve 9%-groep draagt € 10,00 NEGATIEF, zodat de coulance mee krimpt');
    t.eq(r.groups[0].discountShareCents + r.groups[1].discountShareCents, 9000,
      'de delen tellen exact op tot de factuurkorting');
    t.eq(r.groups[0].baseCents, 90000, 'de 21%-grondslag krimpt van € 1.000,00 naar € 900,00');
    t.eq(r.groups[1].baseCents, -9000, 'de 9%-grondslag krimpt van -€ 100,00 naar -€ 90,00 en wordt niet -€ 108,18');
    t.eq(r.groups[1].vatCents, -810, 'en de btw van die groep is 9% van -€ 90,00, dus -€ 8,10');
    t.eq(r.totals.totalExclCents, 81000, 'het totaal exclusief is € 810,00');
    t.eq(r.errors.length, 0, 'een negatieve groep is gewoon te verdelen en dus geen fout');
  }

  /* ------------------------------------------------------------------
     8c. EEN KORTING DIE NIET TE VERDELEN IS, IS EEN FOUT — GEEN STILTE
     ------------------------------------------------------------------
     Kan de verdeling niet (de bedragen vallen buiten het rekenbereik, of
     de groepen heffen elkaar precies op), dan valt de hele korting op de
     eerste groep. Het eindtotaal klopt dan nog, maar de btw per groep
     niet. Dat mag deze module nooit stil afgeven.
     ------------------------------------------------------------------ */
  {
    const overloop = core.allocateProportional(1000000000000, [1000000000, 1000000000]);
    t.false(overloop.ok, 'buiten het rekenbereik meldt de verdeling eerlijk dat ze niet gelukt is');
    t.eq(overloop.reason, 'overloop', 'en zegt waarom');
    t.eq(overloop[0] + overloop[1], 1000000000000, 'het totaal blijft ondanks alles exact kloppen');
    t.true(core.allocateProportional(1000, [3333, 6667]).ok, 'een gewone verdeling meldt zich als gelukt');
    t.true(core.allocateProportional(100, [0, 0]).ok,
      'zonder enig gewicht is er geen verdeelsleutel, maar dat is de bewuste keuze en geen fout');
  }
  {
    /* twee groepen van € 10.000.000,00: t × het zwaarste gewicht valt
       buiten het veilige integerbereik */
    const groot = 1000000000;
    const r = core.computeInvoice(inv({
      lines: [
        line({ description: 'Groot belast', quantity: 1, unitPriceCents: groot, taxCode: 'NL21' }),
        line({ description: 'Groot laag', quantity: 1, unitPriceCents: groot, taxCode: 'NL9' })
      ],
      discount: { type: 'amount', value: groot }
    }));
    t.true(r.errors.some((e) => e.code === 'factuurkorting_niet_verdeeld'),
      'een korting die door overloop niet verdeeld kan worden, komt er als harde fout uit');
    const v = core.validateInvoice(inv({
      lines: [
        line({ description: 'Groot belast', quantity: 1, unitPriceCents: groot, taxCode: 'NL21' }),
        line({ description: 'Groot laag', quantity: 1, unitPriceCents: groot, taxCode: 'NL9' })
      ],
      discount: { type: 'amount', value: groot }
    }));
    t.false(v.ok, 'en houdt de factuur tegen in plaats van een stil verkeerd btw-bedrag af te geven');
  }
  {
    /* de groepen heffen elkaar precies op: er is wél een verdeelsleutel,
       maar geen antwoord — delen door nul */
    const r = core.computeInvoice(inv({
      lines: [
        line({ description: 'Werk', quantity: 1, unitPriceCents: 100000, taxCode: 'NL21' }),
        line({ description: 'Verrekening', quantity: 1, unitPriceCents: -100000, taxCode: 'NL9' })
      ],
      discount: { type: 'amount', value: 2500 }
    }));
    t.true(r.errors.some((e) => e.code === 'factuurkorting_niet_verdeeld'),
      'groepen die elkaar opheffen leveren geen evenredige verdeling en dus een fout op');
    t.eq(r.groups[0].discountShareCents + r.groups[1].discountShareCents, 2500,
      'het totaal blijft ook dan exact kloppen — er verdwijnt geen cent');
  }

  /* ============================================================
     9. VERZEND- EN OVERIGE KOSTEN
     ============================================================ */
  t.group('verzendkosten');
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 10000, taxCode: 'NL21' })],
      surcharges: [{ label: 'Verzending', amountCents: 1500, taxCode: 'NL21' }]
    }));
    t.eq(r.totals.surchargeCents, 1500, 'verzendkosten staan apart in de totalen');
    t.eq(r.totals.totalExclCents, 11500, 'ze tellen mee in het totaal exclusief');
    t.eq(r.totals.vatCents, 2415, 'en dragen hun eigen btw (21% over € 115,00)');
  }
  {
    /* verzendkosten worden NIET gekort: dat is de gedocumenteerde keuze */
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 10000, taxCode: 'NL21' })],
      surcharges: [{ label: 'Verzending', amountCents: 1000, taxCode: 'NL21' }],
      discount: { type: 'percent', value: 10000 }
    }));
    t.eq(r.totals.invoiceDiscountCents, 1000, 'de factuurkorting rekent alleen over de regels');
    t.eq(r.totals.totalExclCents, 10000, '€ 100,00 - € 10,00 + € 10,00 verzending');
  }

  /* ============================================================
     10. BTW-BEHANDELINGEN
     ============================================================ */
  t.group('btw-behandelingen');
  {
    const r = core.computeInvoice(inv({ lines: [line({ unitPriceCents: 100000, taxCode: 'VERLEGD' })] }));
    t.eq(r.totals.vatCents, 0, 'btw verlegd rekent geen btw');
    t.eq(r.totals.totalInclCents, 100000, 'het totaal is gelijk aan de grondslag');
    t.eq(r.groups[0].legalNoteNl, 'Btw verlegd naar de afnemer.', 'de wettelijke vermelding hoort bij de behandeling');
  }
  {
    const r = core.computeInvoice(inv({ lines: [line({ unitPriceCents: 100000, taxCode: 'NL0' })] }));
    t.eq(r.totals.vatCents, 0, '0% export rekent geen btw');
    t.eq(r.groups[0].legalNoteNl, 'Btw 0% (export).', '0%-export draagt zijn eigen vermelding');
  }
  {
    const r = core.computeInvoice(inv({ lines: [line({ unitPriceCents: 100000, taxCode: 'VRIJ' })] }));
    t.eq(r.totals.vatCents, 0, 'vrijgesteld rekent geen btw');
    t.eq(r.groups[0].legalNoteNl, 'Vrijgesteld van btw.', 'vrijstelling draagt zijn eigen vermelding');
  }
  {
    const r = core.computeInvoice(inv({ lines: [line({ unitPriceCents: 100000, taxCode: 'ICP' })] }));
    t.eq(r.totals.vatCents, 0, 'intracommunautair rekent geen btw');
    t.true(core.treatmentOf('intracom').needsBuyerVat, 'intracommunautair eist het btw-nummer van de afnemer');
  }
  {
    /* een inclusieve prijs bij een niet-belaste behandeling mag niet stil
       worden teruggerekend — er zit immers geen btw in */
    const r = core.computeInvoice(inv({
      lines: [line({ unitPriceCents: 12100, taxCode: 'VERLEGD', priceIncludesVat: true })]
    }));
    t.eq(r.totals.totalExclCents, 12100, 'bij verlegd is incl. gelijk aan excl.');
  }
  t.eq(core.taxCodeOf('verlegd').code, 'VERLEGD', 'de oude vat-mode “verlegd” wijst naar de nieuwe code');
  t.eq(core.taxCodeOf('21').rateMilli, 21000, 'de oude vat-mode “21” wijst naar 21%');
  t.eq(core.taxCodeOf('BESTAATNIET'), null, 'een onbekende btw-code geeft null en geen stille 0%');

  /* ============================================================
     11. TEKSTREGELS EN TUSSENKOPPEN
     ============================================================ */
  t.group('tekstregels');
  {
    const r = core.computeInvoice(inv({
      lines: [
        { type: 'heading', description: 'Fase 1 — ontwerp' },
        line({ description: 'Schetsen', quantity: 2, unitPriceCents: 25000 }),
        { type: 'text', description: 'Levering in overleg, prijs geldig tot 31 december.' }
      ]
    }));
    t.eq(r.lines.length, 3, 'alle drie de regels blijven in de uitkomst staan');
    t.false(r.lines[0].counts, 'een tussenkop telt niet mee');
    t.false(r.lines[2].counts, 'een tekstregel telt niet mee');
    t.eq(r.totals.totalExclCents, 50000, 'alleen de bedragregel bepaalt het totaal');
    t.eq(r.groups.length, 1, 'tekstregels maken geen eigen btw-groep');
  }

  /* ============================================================
     12. NEGATIEVE REGELS
     ============================================================ */
  t.group('negatieve regels');
  {
    const r = core.computeInvoice(inv({
      lines: [
        line({ description: 'Werk', quantity: 1, unitPriceCents: 100000 }),
        line({ description: 'Coulance', quantity: 1, unitPriceCents: -20000 })
      ]
    }));
    t.eq(r.totals.totalExclCents, 80000, 'een negatieve regel trekt van het totaal af');
    t.eq(r.totals.vatCents, 16800, 'de btw volgt het saldo van de regels');
    t.true(r.warnings.some((w) => w.code === 'negatieve_regel'), 'een negatieve regel geeft een waarschuwing, geen fout');
    t.eq(r.errors.length, 0, 'een negatieve regel is toegestaan');
  }
  {
    /* spiegeling: de btw van een negatieve regel is exact min de btw van
       de positieve regel — dat is waarom er half-wég-van-nul wordt afgerond */
    const plus = core.computeInvoice(inv({ lines: [line({ quantity: 1, unitPriceCents: 3333 })] }));
    const min = core.computeInvoice(inv({ lines: [line({ quantity: 1, unitPriceCents: -3333 })] }));
    t.eq(min.totals.vatCents, -plus.totals.vatCents, 'crediteren spiegelt de btw exact');
    t.eq(min.totals.totalInclCents, -plus.totals.totalInclCents, 'crediteren spiegelt het totaal exact');
  }

  /* ============================================================
     13. DEELBETALING, OPENSTAAND, CREDIT
     ============================================================ */
  t.group('betalingen');
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 40000 }, { amountCents: 20000 }]
    }));
    t.eq(r.totals.totalInclCents, 121000, 'het factuurtotaal is € 1.210,00');
    t.eq(r.totals.paidCents, 60000, 'twee deelbetalingen tellen op tot € 600,00');
    t.eq(r.totals.outstandingCents, 61000, 'er staat € 610,00 open');
    t.eq(core.settlement(r.totals).code, 'partially_paid', 'de factuur is deels betaald');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 121000 }]
    }));
    t.eq(r.totals.outstandingCents, 0, 'volledig betaald laat niets open');
    t.eq(core.settlement(r.totals).code, 'paid', 'de factuur staat op betaald');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 120998 }]
    }));
    const zonder = core.settlement(r.totals);
    const met = core.settlement(r.totals, { toleranceCents: 5 });
    t.eq(zonder.code, 'partially_paid', 'zonder tolerantie is twee cent te weinig gewoon te weinig');
    t.eq(met.code, 'paid', 'binnen de ingestelde tolerantie geldt de factuur als betaald');
    t.true(met.withinTolerance, 'en dat wordt eerlijk gemarkeerd als tolerantie, niet als echte betaling');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 130000 }]
    }));
    const s = core.settlement(r.totals);
    t.eq(s.code, 'overpaid', 'te veel betaald wordt gesignaleerd');
    t.eq(s.overpaidCents, 9000, 'het teveel is € 90,00');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      credits: [{ amountCents: 121000 }]
    }));
    t.eq(r.totals.creditedCents, 121000, 'het creditbedrag staat apart in de totalen');
    t.eq(r.totals.outstandingCents, 0, 'een volledige creditering zet het openstaande op nul');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 10000 })],
      credits: [{ amountCents: 20000 }]
    }));
    t.true(r.warnings.some((w) => w.code === 'te_veel_gecrediteerd'), 'meer crediteren dan er staat geeft een waarschuwing');
  }

  /* ------------------------------------------------------------------
     13b. EEN VOLLEDIG GECREDITEERDE FACTUUR IS NIET BETAALD
     ------------------------------------------------------------------
     Bij volledige creditering is het openstaande bedrag óók nul. Stond de
     nulcontrole vóór de creditcontrole, dan heette zo'n factuur 'betaald'
     en was de status 'gecrediteerd' onbereikbaar. In een overzicht is dat
     het verschil tussen "dit geld is binnengekomen" en "deze factuur is
     teruggedraaid" — en dat verschil is boekhoudkundig alles.
     De volgorde is dezelfde als in recalc_invoice_settlement() (0012).
     ------------------------------------------------------------------ */
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      credits: [{ amountCents: 121000 }]
    }));
    const s = core.settlement(r.totals);
    t.eq(s.code, 'credited', 'een volledig gecrediteerde factuur heet gecrediteerd en niet betaald');
    t.eq(s.outstandingCents, 0, 'er staat niets meer open, maar dat maakt hem niet voldaan');
    t.eq(s.overpaidCents, 0, 'crediteren is geen geld dat binnenkwam');
  }
  {
    /* méér gecrediteerd dan er stond: nog steeds gecrediteerd, en zeker
       geen overbetaling — er is niets betaald */
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      credits: [{ amountCents: 130000 }]
    }));
    const s = core.settlement(r.totals);
    t.eq(s.code, 'credited', 'te veel crediteren blijft crediteren en wordt geen overbetaling');
    t.eq(s.overpaidCents, 0, 'er is geen cent te veel ontvangen, want er is niets ontvangen');
  }
  {
    /* betaling én creditering die samen de factuur sluiten: dat is wél
       gewoon betaald — de creditbranch eist dat er niets betaald is */
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 40000 }],
      credits: [{ amountCents: 81000 }]
    }));
    t.eq(core.settlement(r.totals).code, 'paid',
      'deels betaald en voor de rest gecrediteerd sluit de factuur als betaald');
  }
  {
    /* eerst betaald, daarna alles gecrediteerd: er staat geld dat terug
       moet, en dat mag niet als 'gecrediteerd' worden weggeschreven */
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 121000 }],
      credits: [{ amountCents: 121000 }]
    }));
    const s = core.settlement(r.totals);
    t.eq(s.code, 'overpaid', 'betaald én gecrediteerd betekent dat er geld terug moet');
    t.eq(s.overpaidCents, 121000, 'en dat bedrag wordt genoemd');
  }

  /* ------------------------------------------------------------------
     13c. DE TOLERANTIE GELDT AAN BEIDE KANTEN VAN NUL
     ------------------------------------------------------------------
     Een cent te veel bij een ingestelde tolerantie van vijf cent is geen
     overbetaling — net zomin als een cent te weinig een tekort is. De
     database toetst `v_out <= greatest(v_tol, 0)` en kent dus geen
     overbetaling binnen de tolerantie; die volgorde is de norm.
     ------------------------------------------------------------------ */
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 121001 }]
    }));
    const met = core.settlement(r.totals, { toleranceCents: 5 });
    t.eq(met.code, 'paid', 'één cent te veel binnen een tolerantie van vijf is gewoon betaald');
    t.true(met.withinTolerance, 'en dat wordt eerlijk gemarkeerd als tolerantie');
    t.eq(met.overpaidCents, 0, 'er wordt geen overbetaling gemeld die niemand hoeft terug te boeken');
    t.eq(met.outstandingCents, -1, 'het werkelijke verschil blijft zichtbaar — er wordt niets weggepoetst');

    const zonder = core.settlement(r.totals);
    t.eq(zonder.code, 'overpaid', 'zonder ingestelde tolerantie is één cent te veel wél een overbetaling');
    t.eq(zonder.overpaidCents, 1, 'en dan wordt het bedrag genoemd');
  }
  {
    const r = core.computeInvoice(inv({
      lines: [line({ quantity: 1, unitPriceCents: 100000 })],
      payments: [{ amountCents: 121006 }]
    }));
    const s = core.settlement(r.totals, { toleranceCents: 5 });
    t.eq(s.code, 'overpaid', 'zes cent te veel valt buiten een tolerantie van vijf');
    t.eq(s.overpaidCents, 6, 'het teveel wordt als positief getal gemeld');
    t.false(s.withinTolerance, 'buiten de tolerantie is er niets kwijtgescholden');
  }

  /* ============================================================
     14. STATUSMODEL EN TRANSITIES
     ============================================================ */
  t.group('statusmodel');
  t.eq(core.STATUSES.length, 12, 'er zijn precies twaalf statuscodes');
  for (const s of core.STATUSES) {
    if (!core.STATUS_META[s]) t.true(false, 'status ' + s + ' mist zijn metagegevens');
    if (!core.TRANSITIONS[s]) t.true(false, 'status ' + s + ' mist zijn transitierij');
  }
  t.true(core.STATUSES.every((s) => core.STATUS_META[s] && core.TRANSITIONS[s]),
    'elke status heeft metagegevens en een transitierij');
  t.true(core.STATUSES.every((s) => (core.TRANSITIONS[s] || []).every((d) => core.STATUSES.indexOf(d) > -1)),
    'geen enkele transitie wijst naar een status die niet bestaat');

  t.true(core.canTransition('draft', 'finalized', { hasNumber: true }).ok, 'concept mag definitief worden');
  t.true(core.canTransition('draft', 'scheduled').ok, 'concept mag ingepland worden');
  t.true(core.canTransition('finalized', 'sent').ok, 'definitief mag verstuurd worden');
  t.true(core.canTransition('sent', 'viewed').ok, 'verstuurd mag bekeken worden');
  t.true(core.canTransition('viewed', 'partially_paid').ok, 'bekeken mag deels betaald worden');
  t.true(core.canTransition('partially_paid', 'paid').ok, 'deels betaald mag volledig betaald worden');
  t.true(core.canTransition('paid', 'credited').ok, 'een betaalde factuur mag alsnog gecrediteerd worden');
  t.true(core.canTransition('disputed', 'paid').ok, 'een opgelost geschil mag naar betaald');
  t.true(core.canTransition('uncollectible', 'paid').ok, 'geld dat alsnog binnenkomt mag oninbaar terugdraaien');
  t.true(core.canTransition('paid', 'paid').ok, 'dezelfde status opnieuw zetten is geen overgang');

  /* elke verboden overgang faalt */
  t.false(core.canTransition('finalized', 'draft').ok, 'een definitieve factuur mag NOOIT terug naar concept');
  t.false(core.canTransition('sent', 'draft').ok, 'een verstuurde factuur mag niet terug naar concept');
  t.false(core.canTransition('paid', 'draft').ok, 'een betaalde factuur mag niet terug naar concept');
  t.false(core.canTransition('paid', 'overdue').ok, 'betaald kan niet alsnog vervallen');
  t.false(core.canTransition('cancelled', 'sent').ok, 'geannuleerd is een eindpunt');
  t.false(core.canTransition('cancelled', 'draft').ok, 'geannuleerd klapt niet weer open');
  t.false(core.canTransition('credited', 'paid').ok, 'gecrediteerd is een eindpunt');
  t.false(core.canTransition('draft', 'paid').ok, 'een concept kan niet zomaar betaald zijn');
  t.false(core.canTransition('draft', 'sent').ok, 'een concept kan niet verstuurd zijn zonder definitief te worden');
  t.false(core.canTransition('scheduled', 'paid').ok, 'een ingeplande factuur kan niet betaald zijn');
  t.false(core.canTransition('partially_paid', 'cancelled').ok, 'annuleren mag niet meer zodra er deels betaald is');
  t.false(core.canTransition('draft', 'bestaatniet').ok, 'een onbekende doelstatus wordt geweigerd');
  t.false(core.canTransition('bestaatniet', 'draft').ok, 'een onbekende beginstatus wordt geweigerd');
  t.false(core.canTransition('sent', 'cancelled', { paidCents: 100 }).ok,
    'annuleren met geld op de factuur wordt geweigerd — crediteren is de weg');
  t.true(core.canTransition('sent', 'cancelled', { paidCents: 0 }).ok,
    'annuleren zonder betaling mag nog wel');
  t.false(core.canTransition('draft', 'finalized', { hasNumber: false }).ok,
    'definitief maken zonder factuurnummer wordt geweigerd');
  t.true(core.canTransition('finalized', 'draft').reason.length > 0,
    'een geweigerde overgang legt in het Nederlands uit waarom');

  /* ============================================================
     15. VALIDATIE
     ============================================================ */
  t.group('validatie');
  {
    const v = core.validateInvoice(inv({ lines: [] }));
    t.false(v.ok, 'een factuur zonder regels is niet geldig');
    t.true(v.errors.some((e) => e.code === 'geen_regels'), 'en dat wordt met zoveel woorden gemeld');
  }
  {
    const v = core.validateInvoice(inv({
      lines: [line({ description: '', unitPriceCents: 100 })]
    }));
    t.true(v.errors.some((e) => e.code === 'regel_zonder_omschrijving'), 'een regel zonder omschrijving is een fout');
  }
  {
    const v = core.validateInvoice(inv({
      lines: [line({ unitPriceCents: 100000, taxCode: 'VERLEGD' })],
      buyer: { name: 'Klant', address: 'Straat 1' }
    }));
    t.true(v.errors.some((e) => e.code === 'afnemer_btw_ontbreekt'),
      'btw verlegd zonder btw-nummer van de klant is server-side een harde fout');
  }
  {
    const v = core.validateInvoice(inv({
      lines: [line({ unitPriceCents: 100000, taxCode: 'VERLEGD' })],
      buyer: { name: 'Klant', address: 'Straat 1', vatNumber: 'DE123456789' }
    }));
    t.false(v.errors.some((e) => e.code === 'afnemer_btw_ontbreekt'), 'mét btw-nummer verdwijnt die fout');
  }
  {
    const v = core.validateInvoice(inv({
      currency: 'USD',
      lines: [line({ unitPriceCents: 100000 })]
    }));
    t.true(v.errors.some((e) => e.code === 'koers_ontbreekt'),
      'een niet-EUR-factuur zonder koersanker wordt geweigerd');
  }
  {
    const v = core.validateInvoice(inv({
      lines: [line({ unitPriceCents: 100000 })],
      invoiceDate: '2026-03-10', dueDate: '2026-03-01'
    }));
    t.true(v.errors.some((e) => e.code === 'vervaldatum_voor_factuurdatum'),
      'een vervaldatum vóór de factuurdatum is een fout');
  }
  {
    const v = core.validateInvoice(inv({ lines: [line({ unitPriceCents: 100000 })] }), { intent: 'finalize' });
    t.false(v.ok, 'definitief maken zonder kopgegevens lukt niet');
    t.true(v.errors.some((e) => e.code === 'nummer_ontbreekt'), 'het ontbrekende factuurnummer wordt gemeld');
    t.true(v.errors.some((e) => e.code === 'klant_naam_ontbreekt'), 'de ontbrekende klantnaam wordt gemeld');
    t.true(v.errors.some((e) => e.code === 'verkoper_btw_ontbreekt'), 'het ontbrekende eigen btw-nummer wordt gemeld');
  }
  {
    const compleet = inv({
      status: 'draft',
      invoiceNumber: 'CP-2026-0001',
      invoiceDate: '2026-03-01',
      dueDate: '2026-03-15',
      paymentTermDays: 14,
      seller: { name: 'CUSTOM+', address: 'Straat 1, Amsterdam', vatNumber: 'NL001234567B01' },
      buyer: { name: 'Klant BV', address: 'Weg 2, Rotterdam' },
      lines: [line({ description: 'Ontwerp', quantity: 1, unitPriceCents: 100000 })]
    });
    const v = core.validateInvoice(compleet, { intent: 'finalize' });
    t.true(v.ok, 'een volledige factuur mag definitief worden');
    t.eq(v.errors.length, 0, 'en levert geen enkele fout op');
    t.eq(v.totals.totalInclCents, 121000, 'de validatie geeft de herberekende totalen terug');

    const mis = core.validateInvoice(compleet, { intent: 'finalize', claimedTotals: { totalInclCents: 121001 } });
    t.false(mis.ok, 'een client die een ander totaal beweert wordt geweigerd');
    t.true(mis.errors.some((e) => e.code === 'totalen_wijken_af'), 'en het verschil wordt benoemd');

    const gelijk = core.validateInvoice(compleet, { intent: 'finalize', claimedTotals: { totalInclCents: 121000, vatCents: 21000, totalExclCents: 100000 } });
    t.true(gelijk.ok, 'kloppende cijfers van de client komen er wel door');
  }
  {
    const v = core.validateInvoice(inv({
      lines: [line({ unitPriceCents: 100000 })],
      paymentTermDays: 180
    }));
    t.true(v.warnings.some((w) => w.code === 'betaaltermijn_ongebruikelijk'),
      'een betaaltermijn van een half jaar is een waarschuwing, geen blokkade');
    t.true(v.ok, 'en houdt de factuur dus geldig');
  }

  /* ============================================================
     16. EEN COMPLETE FACTUUR VAN VOOR TOT ACHTER
     ============================================================ */
  t.group('complete factuur');
  {
    const r = core.computeInvoice(inv({
      lines: [
        { type: 'heading', description: 'Ontwikkeling' },
        line({ description: 'Ontwerp', quantity: '12,5', unit: 'uur', unitPriceCents: 9500, taxCode: 'NL21' }),
        line({ description: 'Drukwerk', quantity: 200, unitPriceCents: 175, taxCode: 'NL9', discountType: 'percent', discountValue: 5000 }),
        { type: 'text', description: 'Levering na akkoord op de proefdruk.' },
        line({ description: 'Retour defect', quantity: 1, unitPriceCents: -5000, taxCode: 'NL21' })
      ],
      surcharges: [{ label: 'Verzending', amountCents: 895, taxCode: 'NL21' }],
      discount: { type: 'amount', value: 2500 },
      payments: [{ amountCents: 50000 }]
    }));
    /* 12,5 × 95,00 = 1187,50 ; 200 × 1,75 = 350,00 -5% = 332,50 ; -50,00 */
    t.eq(r.totals.subtotalBeforeDiscountCents, 118750 + 35000 - 5000, 'subtotaal vóór korting klopt');
    t.eq(r.totals.lineDiscountCents, 1750, 'de regelkorting op het drukwerk is € 17,50');
    t.eq(r.totals.netAfterLineDiscountCents, 118750 + 33250 - 5000, 'netto na regelkorting klopt');
    t.eq(r.totals.subtotalBeforeDiscountCents - r.totals.lineDiscountCents,
      r.totals.netAfterLineDiscountCents, 'subtotaal min regelkortingen is exact het netto');
    t.eq(r.totals.invoiceDiscountCents, 2500, 'de factuurkorting is € 25,00');
    t.eq(r.totals.totalExclCents,
      r.totals.netAfterLineDiscountCents - 2500 + 895, 'totaal exclusief = netto - factuurkorting + verzending');
    t.eq(r.totals.totalInclCents, r.totals.totalExclCents + r.totals.vatCents, 'incl. is excl. plus btw');
    t.eq(r.totals.outstandingCents, r.totals.totalInclCents - 50000, 'openstaand is totaal min de aanbetaling');

    let som = 0;
    for (const g of r.groups) som += g.baseCents;
    t.eq(som, r.totals.totalExclCents, 'de btw-grondslagen tellen exact op tot het totaal exclusief');
    let somBtw = 0;
    for (const g of r.groups) somBtw += g.vatCents;
    t.eq(somBtw, r.totals.vatCents, 'de btw per groep telt exact op tot de totale btw');
  }
}
