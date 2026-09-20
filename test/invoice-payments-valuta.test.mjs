/* CUSTOM+ — de VALUTA in de meldingen van portal/invoice-payments.js.
   ------------------------------------------------------------------
   Deze tests horen bij één bevinding uit de review: de tolerantie- en
   overbetalingsmelding toonde altijd euro's. De teksten werden gebouwd met
   een hulpfunctie die '€ ' hardcodeerde en bovendien altijd door 100 deelde.
   Op een factuur in USD of CNY stond er dus letterlijk iets onwaars, en op
   een factuur in JPY — een valuta zonder decimalen — werd 3 yen als "0,03"
   gepresenteerd.

   Ze staan in een eigen bestand en niet in invoice-payments.test.mjs, omdat
   dat bestand tegelijk door een andere hand wordt bewerkt; een eigen bestand
   loopt niemand in de weg en de testrunner pakt elk *.test.mjs vanzelf op.

   Elke assertie hieronder faalt op de oude code.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-payments.js';

const P = globalThis.CP_PAYMENTS;

/* een factuur die op één cent na is betaald, in de valuta die je meegeeft */
function bijnaBetaald(currency, totaal, betaald, tolerantie) {
  return P.settle({
    totalInclCents: totaal,
    currency: currency,
    payments: [{ id: 'p1', paidOn: '2026-03-01', amountCents: betaald, currency: currency }],
    toleranceCents: tolerantie
  });
}

export default function (t) {
  t.group('tolerantienotitie draagt de valuta van de factuur');

  const usd = bijnaBetaald('USD', 100000, 99997, 5);
  t.eq(usd.code, 'paid', 'drie cent open binnen een tolerantie van vijf geldt als betaald');
  t.true(usd.withinTolerance, 'en dat gebeurt zichtbaar via de tolerantie');
  t.eq(usd.currency, 'USD', 'de afwikkeling geeft terug in welke valuta ze rekent');
  t.true(usd.noteNl.indexOf('$ 0,03') > -1, 'de notitie noemt het kwijtgescholden bedrag in dollars');
  t.true(usd.noteNl.indexOf('$ 0,05') > -1, 'en de ingestelde tolerantie ook');
  t.true(usd.noteNl.indexOf('€') < 0, 'er staat geen euroteken in een melding over een dollarfactuur');

  const cny = bijnaBetaald('CNY', 100000, 99997, 5);
  t.true(cny.noteNl.indexOf('¥ 0,03') > -1, 'een factuur in CNY krijgt het yuanteken');
  t.true(cny.noteNl.indexOf('€') < 0, 'en nergens meer een euro');

  /* JPY heeft NUL decimalen (CURRENCY_MINOR_UNITS in invoice-core). De oude
     hulpfunctie deelde onvoorwaardelijk door 100 en maakte van 3 yen "0,03";
     dat is een factor honderd mis, geen opmaakdetail. */
  const jpy = bijnaBetaald('JPY', 100000, 99997, 5);
  t.true(jpy.noteNl.indexOf('¥ 3 open') > -1, 'in yen staat er 3 open, niet 0,03');
  t.true(jpy.noteNl.indexOf('¥ 5') > -1, 'en de tolerantie is 5 yen');
  t.true(jpy.noteNl.indexOf('0,03') < 0, 'er wordt niet blind door honderd gedeeld');

  /* een valuta zonder eigen teken hoort de ISO-code te krijgen en niet het
     teken van een andere munt */
  const sek = bijnaBetaald('SEK', 100000, 99997, 5);
  t.true(sek.noteNl.indexOf('SEK 0,03') > -1, 'een valuta zonder bekend teken toont zijn ISO-code');

  t.group('de euro blijft de euro');
  const eur = bijnaBetaald('EUR', 100000, 99997, 5);
  t.true(eur.noteNl.indexOf('€ 0,03') > -1, 'een eurofactuur leest exact zoals hij las');
  const zonder = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'p1', paidOn: '2026-03-01', amountCents: 99997 }],
    toleranceCents: 5
  });
  t.true(zonder.noteNl.indexOf('€ 0,03') > -1, 'zonder valuta blijft het gedrag ongewijzigd: euro');
  t.eq(zonder.currency, 'EUR', 'en dat staat er dan ook bij');

  t.group('terugval op de valuta van de geboekte betalingen');
  /* een aanroeper die (nog) geen valuta meegeeft: dan is het grootboekje de
     beste bron, want validatePayment() weigert een betaling in een andere
     valuta dan de factuur */
  const uitLedger = P.settle({
    totalInclCents: 100000,
    payments: [{ id: 'p1', paidOn: '2026-03-01', amountCents: 99997, currency: 'USD' }],
    toleranceCents: 5
  });
  t.true(uitLedger.noteNl.indexOf('$ 0,03') > -1, 'eensluidende betaalrijen bepalen de valuta van de melding');
  const tegenspraak = P.settle({
    totalInclCents: 100000,
    payments: [
      { id: 'p1', paidOn: '2026-03-01', amountCents: 50000, currency: 'USD' },
      { id: 'p2', paidOn: '2026-03-02', amountCents: 49997, currency: 'CNY' }
    ],
    toleranceCents: 5
  });
  t.eq(tegenspraak.currency, 'EUR', 'spreken de rijen elkaar tegen, dan wordt er niets aangenomen');

  t.group('overbetaling in vreemde valuta');
  const teVeel = P.settle({
    totalInclCents: 10000,
    currency: 'CNY',
    payments: [{ id: 'p1', paidOn: '2026-03-01', amountCents: 10500, currency: 'CNY' }]
  });
  const w = teVeel.warnings.filter(function (x) { return x.code === 'overbetaling'; })[0];
  t.true(!!w, 'te veel ontvangen wordt gemeld');
  t.true(!!w && w.message.indexOf('¥ 5,00') > -1, 'het teveel staat er in de valuta van de factuur');
  t.true(!!w && w.message.indexOf('€') < 0, 'en niet in euro');

  t.group('de controle vóór het boeken rekent in dezelfde valuta');
  const nul = P.validatePayment(
    { paidOn: '2026-03-01', amountCents: 0, currency: 'USD' },
    { invoiceCurrency: 'USD' }
  );
  const eNul = nul.errors.filter(function (x) { return x.code === 'bedrag_nul'; })[0];
  t.true(!!eNul && eNul.message.indexOf('$ 0,00') > -1, 'een betaling van niets wordt in de valuta van de factuur benoemd');
  t.true(!!eNul && eNul.message.indexOf('€') < 0, 'zonder euroteken op een dollarfactuur');

  const teGroot = P.validatePayment(
    { paidOn: '2026-03-05', amountCents: -20000, currency: 'USD', reversesPaymentId: 'p1' },
    {
      invoiceCurrency: 'USD',
      payments: [{ id: 'p1', paidOn: '2026-03-01', amountCents: 10000, currency: 'USD' }]
    }
  );
  const eTerug = teGroot.errors.filter(function (x) { return x.code === 'terugboeking_te_groot'; })[0];
  t.true(!!eTerug, 'meer terugboeken dan er is ontvangen blijft een fout');
  t.true(!!eTerug && eTerug.message.indexOf('$ 100,00') > -1, 'en het oorspronkelijke bedrag staat er in de juiste valuta bij');

  t.group('duizendtallen en het minteken');
  const groot = P.settle({
    totalInclCents: 100000000,
    currency: 'USD',
    payments: [{ id: 'p1', paidOn: '2026-03-01', amountCents: 100000300, currency: 'USD' }]
  });
  const wg = groot.warnings.filter(function (x) { return x.code === 'overbetaling'; })[0];
  t.true(!!wg && wg.message.indexOf('$ 3,00') > -1, 'ook bij grote bedragen klopt het teveel');
  const veelTeVeel = P.settle({
    totalInclCents: 100,
    currency: 'USD',
    payments: [{ id: 'p1', paidOn: '2026-03-01', amountCents: 123456789, currency: 'USD' }]
  });
  const wv = veelTeVeel.warnings.filter(function (x) { return x.code === 'overbetaling'; })[0];
  t.true(!!wv && wv.message.indexOf('$ 1.234.566,89') > -1, 'de duizendscheiding blijft Nederlands, ook in dollars');
}
