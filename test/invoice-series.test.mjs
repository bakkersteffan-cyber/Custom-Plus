/* CUSTOM+ — nummerreeksen: opmaak, periodereset, uitgifte en botsingen.
   ------------------------------------------------------------------
   Wat hier wordt bewaakt is niet "rekent de code", maar "kan hetzelfde
   nummer twee keer vallen". Dat is de enige fout in dit onderwerp die je
   niet meer kunt repareren: een verzonden factuur met een nummer dat al
   op een andere verzonden factuur staat, krijg je niet meer uit de
   administratie weg.

   De laatste groep simuleert gelijktijdigheid. CP_SERIES.issue() is puur
   en kan dat dus niet zelf garanderen — de garantie zit in de ONDEELBARE
   lees-, ophoog- en schrijfstap van de datalaag. Die stap wordt hier
   nagebouwd: een gedeelde 'opslag', twee claimers die elkaar afwisselen,
   en de vraag of het slot zijn werk doet. De variant zonder slot moet
   FALEN (dubbel nummer) en de variant met slot moet slagen — anders test
   je alleen je eigen optimisme.
   ------------------------------------------------------------------ */
import '../portal/invoice-series.js';

const S = globalThis.CP_SERIES;

function serie(over) {
  return S.normalise(Object.assign({
    id: 'srs-test', kind: 'invoice', administration: 'CP', label: 'Test',
    prefix: 'CP', suffix: '', useYear: true, useMonth: false, separator: '-',
    padLength: 4, startValue: 1, currentValue: 0, currentYear: 2026, currentMonth: null,
    resetPeriod: 'year', active: true
  }, over || {}));
}

export default function (t) {

  t.group('opmaak van het nummer');
  t.eq(S.formatNumber(serie(), 1, '2026-03-04'), 'CP-2026-0001', 'voorvoegsel, jaar en vier cijfers');
  t.eq(S.formatNumber(serie({ prefix: '', padLength: 5 }), 1, '2026-03-04'), '2026-00001',
    'zonder voorvoegsel precies het voorbeeld uit de spec: 2026-00001');
  t.eq(S.formatNumber(serie({ useMonth: true }), 7, '2026-03-04'), 'CP-2026-03-0007',
    'met maand komt de maand tussen jaar en volgnummer, altijd twee cijfers');
  t.eq(S.formatNumber(serie({ useYear: false }), 42, '2026-03-04'), 'CP-0042',
    'zonder jaar blijft alleen voorvoegsel en volgnummer over');
  t.eq(S.formatNumber(serie({ suffix: 'NL' }), 3, '2026-03-04'), 'CP-2026-0003-NL',
    'een achtervoegsel komt achteraan, met hetzelfde scheidingsteken');
  t.eq(S.formatNumber(serie({ separator: '/' }), 3, '2026-03-04'), 'CP/2026/0003',
    'het scheidingsteken is instelbaar');
  t.eq(S.formatNumber(serie({ padLength: 1 }), 12345, '2026-03-04'), 'CP-2026-12345',
    'een volgnummer dat langer is dan de opvulling wordt niet afgekapt');

  t.group('welk volgnummer is aan de beurt');
  t.eq(S.nextSeq(serie({ currentValue: 0 }), '2026-03-04').seq, 1,
    'een verse reeks begint bij het startnummer');
  t.eq(S.nextSeq(serie({ currentValue: 0, startValue: 500 }), '2026-03-04').seq, 500,
    'een instelbaar startnummer geldt meteen');
  t.eq(S.nextSeq(serie({ currentValue: 17 }), '2026-03-04').seq, 18,
    'daarna gewoon het laatst uitgegeven nummer plus een');
  t.eq(S.nextSeq(serie({ currentValue: 17, startValue: 900 }), '2026-03-04').seq, 900,
    'een later verhoogd startnummer wint van de lopende teller — anders doet instellen niets');

  t.group('periodewissel');
  const jaarwissel = S.nextSeq(serie({ currentValue: 88, currentYear: 2025 }), '2026-01-02');
  t.eq(jaarwissel.seq, 1, 'bij jaarreset begint de reeks in het nieuwe jaar opnieuw');
  t.true(jaarwissel.resets, 'de jaarwissel wordt als reset gemeld zodat de audit hem kan vastleggen');
  t.eq(S.nextSeq(serie({ currentValue: 88, currentYear: 2025, resetPeriod: 'never' }), '2026-01-02').seq, 89,
    'met resetPeriod never loopt de reeks over het jaar heen door');
  const maandwissel = S.nextSeq(
    serie({ currentValue: 12, currentYear: 2026, currentMonth: 2, resetPeriod: 'month', useMonth: true }),
    '2026-03-01');
  t.eq(maandwissel.seq, 1, 'bij maandreset begint de reeks elke maand opnieuw');
  t.true(S.normalise({ resetPeriod: 'month', useMonth: false }).useMonth,
    'een maandreset zonder maand in het nummer zou botsen — useMonth wordt afgedwongen');
  t.eq(S.nextSeq(serie({ currentValue: 12, currentYear: 2026, currentMonth: 2, resetPeriod: 'month', useMonth: true }), '2026-02-28').seq, 13,
    'binnen dezelfde maand loopt hij gewoon door');

  t.group('kijkje verandert niets');
  const s0 = serie({ currentValue: 5 });
  const kijk = S.preview(s0, '2026-03-04');
  t.eq(kijk.text, 'CP-2026-0006', 'het kijkje toont het nummer dat zou vallen');
  t.eq(s0.currentValue, 5, 'de reeks is door het kijkje niet opgehoogd');

  t.group('uitgeven');
  const uit = S.issue(serie({ currentValue: 5 }), { date: '2026-03-04' });
  t.true(uit.ok, 'uitgeven lukt');
  t.eq(uit.text, 'CP-2026-0006', 'het uitgegeven nummer volgt op het laatst uitgegeven');
  t.eq(uit.seq, 6, 'het volgnummer klopt');
  t.eq(uit.series.currentValue, 6, 'de nieuwe stand van de reeks is het zojuist uitgegeven nummer');
  t.eq(uit.series.currentYear, 2026, 'het jaar van de reeks volgt de factuurdatum');
  t.deep(uit.skipped, [], 'er is niets overgeslagen');

  t.group('al gebruikte nummers overslaan');
  const bezet = { 'CP-2026-0006': true, 'CP-2026-0007': true };
  const uit2 = S.issue(serie({ currentValue: 5 }), { date: '2026-03-04', used: bezet });
  t.eq(uit2.text, 'CP-2026-0008', 'een handmatig getypt nummer wordt overgeslagen, niet overschreven');
  t.deep(uit2.skipped, ['CP-2026-0006', 'CP-2026-0007'],
    'elk overgeslagen nummer komt terug zodat de nummer-audit het gat kan verklaren');
  t.eq(uit2.series.currentValue, 8, 'de reeks staat daarna op het echt uitgegeven nummer');

  const uit3 = S.issue(serie({ currentValue: 5 }), { date: '2026-03-04', used: new Set(['CP-2026-0006']) });
  t.eq(uit3.text, 'CP-2026-0007', 'een Set met gebruikte nummers werkt net zo goed als een object');

  const vol = S.issue(serie({ currentValue: 0, padLength: 1, prefix: '', useYear: false }),
    { date: '2026-03-04', used: { '1': true, '2': true }, maxSkip: 1 });
  t.false(vol.ok, 'raakt de zoektocht op, dan wordt er liever niets uitgegeven dan een duplicaat');
  t.eq(vol.text, '', 'en er komt geen nummer terug');

  t.group('reeks per soort');
  const lijst = S.defaultSeries();
  t.eq(S.seriesFor(lijst, 'invoice').kind, 'invoice', 'de factuurreeks wordt gevonden');
  t.eq(S.seriesFor(lijst, 'credit_note').kind, 'credit_note', 'de creditreeks wordt gevonden');
  t.true(S.seriesFor(lijst, 'invoice').prefix !== S.seriesFor(lijst, 'credit_note').prefix,
    'facturen en creditnota’s hebben standaard een eigen voorvoegsel en botsen dus niet');
  const zonderCredit = lijst.map((s) => (s.kind === 'credit_note' ? Object.assign({}, s, { active: false }) : s));
  t.eq(S.seriesFor(zonderCredit, 'credit_note').kind, 'invoice',
    'zonder actieve creditreeks valt een creditnota terug op de factuurreeks — gedeeld mag, nummerloos niet');
  t.eq(S.seriesFor([], 'invoice'), null, 'een lege lijst geeft eerlijk niets terug');

  t.group('brug naar de golf-1-jaarteller');
  const oud = { prefix: 'CP', jaar: 2026, volgende: 15 };
  const gemigreerd = S.fromLegacy(oud);
  t.eq(gemigreerd.currentValue, 14, '“volgende 15” betekent dat 14 het laatst uitgegeven nummer is');
  t.eq(S.preview(gemigreerd, '2026-03-04').text, 'CP-2026-0015',
    'de gemigreerde reeks geeft exact het nummer dat de oude teller ook zou geven');
  t.deep(S.toLegacy(gemigreerd), oud, 'en hij kan onveranderd terug naar de oude vorm');
  t.eq(S.toLegacy(serie({ useMonth: true, resetPeriod: 'month' })), null,
    'een reeks met maandnummer past niet in de oude vorm — dan liever niets terugschrijven');

  const uitOud = S.migrate([], oud);
  t.eq(uitOud.length, 2, 'migreren levert de factuurreeks en de creditreeks op');
  t.eq(S.preview(uitOud[0], '2026-03-04').text, 'CP-2026-0015',
    'de teller springt bij migratie niet terug — een al uitgegeven nummer valt nooit opnieuw');
  t.eq(uitOud[1].prefix, 'CPC', 'de creditreeks erft het voorvoegsel met een C zodat hij niet botst');
  t.eq(S.migrate(uitOud, oud).length, 2, 'een bestaande lijst wordt niet nog eens gemigreerd');

  /* ------------------------------------------------------------------
     GELIJKTIJDIGHEID
     Twee claimers, één gedeelde opslag. De datalaag belooft dat lezen,
     ophogen en terugschrijven ondeelbaar gebeurt; hier wordt die belofte
     nagebouwd en getoetst — inclusief het tegenbewijs.
     ------------------------------------------------------------------ */
  t.group('gelijktijdigheid');

  function maakOpslag() {
    return { serie: serie({ currentValue: 0 }), uitgegeven: [] };
  }

  /* ZONDER slot: beide claimers lezen eerst allebei, schrijven daarna
     allebei. Precies het scenario van twee beheertabs. */
  function claimZonderSlot(opslag) {
    const gelezen = S.normalise(opslag.serie);          // stap 1: lezen
    return function schrijf() {                          // stap 2: pas later schrijven
      const r = S.issue(gelezen, { date: '2026-03-04' });
      opslag.serie = r.series;
      opslag.uitgegeven.push(r.text);
      return r.text;
    };
  }
  const o1 = maakOpslag();
  const a = claimZonderSlot(o1);
  const b = claimZonderSlot(o1);
  const na = a();
  const nb = b();
  t.eq(na, nb, 'tegenbewijs: zonder ondeelbare stap geven twee claimers hetzelfde nummer');

  /* MET slot: lezen, ophogen en schrijven in één ondeelbare beweging,
     zoals demo (synchrone localStorage-stap) en live (rijvergrendeling in
     claim_series_number) het doen. */
  function claimMetSlot(opslag, datum) {
    const used = {};
    opslag.uitgegeven.forEach((n) => { used[n] = true; });
    const r = S.issue(opslag.serie, { date: datum || '2026-03-04', used });
    if (!r.ok) throw new Error(r.reason);
    opslag.serie = r.series;
    opslag.uitgegeven.push(r.text);
    return r.text;
  }
  const o2 = maakOpslag();
  const nummers = [];
  for (let i = 0; i < 25; i++) nummers.push(claimMetSlot(o2));
  t.eq(new Set(nummers).size, 25, 'met de ondeelbare stap geeft 25 keer claimen 25 verschillende nummers');
  t.eq(nummers[0], 'CP-2026-0001', 'de eerste claim is het startnummer');
  t.eq(nummers[24], 'CP-2026-0025', 'de laatste claim volgt aaneengesloten');
  t.eq(o2.serie.currentValue, 25, 'de reeksstand klopt na 25 claims');

  /* en met een handmatig getypt nummer ertussen blijft het uniek */
  const o3 = maakOpslag();
  o3.uitgegeven.push('CP-2026-0003');
  const nummers3 = [];
  for (let i = 0; i < 5; i++) nummers3.push(claimMetSlot(o3));
  t.deep(nummers3, ['CP-2026-0001', 'CP-2026-0002', 'CP-2026-0004', 'CP-2026-0005', 'CP-2026-0006'],
    'een handmatig getypt nummer wordt netjes overgeslagen zonder de reeks te breken');
  t.eq(new Set(o3.uitgegeven).size, o3.uitgegeven.length, 'er staat geen enkel dubbel nummer in de opslag');

  /* twee soorten door elkaar: facturen en creditnota's delen nooit een nummer */
  const oF = { serie: S.seriesFor(S.defaultSeries(), 'invoice'), uitgegeven: [] };
  const oC = { serie: S.seriesFor(S.defaultSeries(), 'credit_note'), uitgegeven: [] };
  const alles = [];
  for (let i = 0; i < 6; i++) { alles.push(claimMetSlot(oF)); alles.push(claimMetSlot(oC)); }
  t.eq(new Set(alles).size, 12, 'facturen en creditnota’s uit hun eigen reeks botsen nooit');
}
