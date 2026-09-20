/* CUSTOM+ — definitief maken: snapshot-onveranderlijkheid, vergrendeling
   en de acht stappen op volgorde.
   ------------------------------------------------------------------
   Drie beloftes worden hier hard gemaakt:

   1. DE SNAPSHOT IS ONVERANDERLIJK. Niet "we spreken af dat niemand hem
      aanraakt", maar diep bevroren, zodat een latere wijziging aan de
      klantkaart, het bedrijfsadres of een btw-tarief een al verstuurde
      factuur nooit meer kan veranderen.

   2. NA DEFINITIEF MAKEN ZIJN FINANCIELE VELDEN DICHT. Alleen interne
      tags en de interne notitie blijven open — die staan niet op het vel
      van de klant en niet in de snapshot.

   3. DE ACHT STAPPEN LOPEN OP VOLGORDE, en het nummer valt pas in stap 4.
      Struikelt stap 1, 2 of 3, dan is er geen nummer uit de reeks
      getrokken. Struikelt stap 5 of later, dan wordt het uitgegeven
      nummer als wees gemeld zodat de nummer-audit het gat kan verklaren.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-finalize.js';

const core = globalThis.CP_INVOICE;
const F = globalThis.CP_INVOICE_FINAL;

/* een echte, berekende factuur — geen handmatig ingetypte bedragen */
function maakModel() {
  const invoice = {
    currency: 'EUR',
    pricesIncludeVat: false,
    lines: [
      { type: 'heading', description: 'Ontwerp' },
      { type: 'item', description: 'Ontwerpuren', unit: 'uur', quantity: '12,5', unitPrice: '85,00', taxCode: 'NL21' },
      { type: 'item', description: 'Tooling', unit: 'stuk', quantity: '1', unitPrice: '2.400,00', taxCode: 'NL21', discountType: 'percent', discountPercent: '10' }
    ],
    surcharges: [{ label: 'Verzendkosten', amountCents: 4500, taxCode: 'NL21' }],
    discount: { type: 'percent', percent: '5' },
    payments: [{ amountCents: 50000 }]
  };
  const computed = core.computeInvoice(invoice);
  return {
    docKind: 'invoice',
    administration: 'CP',
    invoiceNumber: '',
    invoiceDate: '2026-03-04',
    dueDate: '2026-03-18',
    paymentTermDays: 14,
    currency: 'EUR',
    language: 'nl',
    pricesIncludeVat: false,
    clientReference: 'PO-88',
    purchaseOrder: '4500123',
    internalNote: 'Nog navragen bij Chen',
    tags: ['q1'],
    discount: { type: 'percent', value: 5000 },
    seller: { name: 'CUSTOM+', address: 'Voorbeeldstraat 1', vatNumber: 'NL001234567B01', iban: 'NL91ABNA0417164300' },
    buyer: { name: 'Atelier Noor', address: 'Keizersgracht 1', vatNumber: 'NL0099887B01', email: 'noor@example.com' },
    computed: computed
  };
}

export default function (t) {

  t.group('snapshot — inhoud');
  const model = maakModel();
  const snap = F.buildSnapshot(model);
  t.eq(snap.snapshotVersion, 1, 'de snapshot draagt zijn eigen versienummer');
  t.eq(snap.coreVersion, core.VERSION, 'en de versie van de rekenkern waarmee hij is gemaakt');
  t.eq(snap.seller.name, 'CUSTOM+', 'de bedrijfsgegevens zitten erin');
  t.eq(snap.buyer.name, 'Atelier Noor', 'de klantgegevens zitten erin');
  t.eq(snap.buyer.address, 'Keizersgracht 1', 'het adres zit erin');
  t.eq(snap.lines.length, 3, 'alle regels zitten erin, ook de tussenkop');
  t.eq(snap.lines[0].type, 'heading', 'het regeltype blijft bewaard');
  t.eq(snap.lines[1].netExclCents, 106250, 'het berekende regelbedrag zit erin (12,5 x 85,00)');
  t.true(snap.taxGroups.length >= 1, 'de btw-groepen zitten erin');
  t.eq(snap.taxGroups[0].rateMilli, 21000, 'inclusief het gehanteerde tarief');
  t.eq(snap.totals.totalInclCents, model.computed.totals.totalInclCents,
    'het totaal in de snapshot is exact het berekende totaal');
  t.eq(snap.totals.paidCents, 50000, 'reeds betaald staat erin');

  t.group('snapshot — wat er bewust NIET in staat');
  t.eq(snap.internalNote, undefined, 'de interne notitie staat niet in de snapshot — die is niet klantzichtbaar');
  t.eq(snap.tags, undefined, 'interne tags staan er evenmin in, anders zou een tagwijziging de factuur aanraken');

  t.group('snapshot — onveranderlijk');
  t.true(Object.isFrozen(snap), 'de snapshot is bevroren');
  t.true(Object.isFrozen(snap.buyer), 'ook de klantgegevens erin zijn bevroren');
  t.true(Object.isFrozen(snap.lines), 'de regellijst is bevroren');
  t.true(Object.isFrozen(snap.lines[1]), 'en elke regel afzonderlijk');
  t.true(Object.isFrozen(snap.totals), 'en het totalenblok');
  const voor = F.snapshotFingerprint(snap);
  try { snap.buyer.name = 'Iemand anders'; } catch (e) { /* strict mode gooit, sloppy mode negeert */ }
  try { snap.totals.totalInclCents = 1; } catch (e) {}
  try { snap.lines.push({ type: 'item' }); } catch (e) {}
  t.eq(snap.buyer.name, 'Atelier Noor', 'een poging de klantnaam te wijzigen doet niets');
  t.eq(snap.totals.totalInclCents, model.computed.totals.totalInclCents, 'het totaal blijft staan');
  t.eq(snap.lines.length, 3, 'er kan geen regel bij');
  t.eq(F.snapshotFingerprint(snap), voor, 'de vingerafdruk is na alle pogingen ongewijzigd');

  t.group('snapshot — de bron mag daarna gerust bewegen');
  model.buyer.name = 'Atelier Noor B.V.';
  model.buyer.address = 'Nieuw adres 9';
  model.computed.totals.totalInclCents = 999999;
  t.eq(snap.buyer.name, 'Atelier Noor', 'een naamswijziging op de klantkaart raakt de vastgelegde factuur niet');
  t.eq(snap.buyer.address, 'Keizersgracht 1', 'en een verhuizing evenmin');
  t.eq(F.snapshotFingerprint(snap), voor, 'de snapshot is nog steeds bit voor bit dezelfde');

  t.group('vingerafdruk');
  const a = F.buildSnapshot(maakModel());
  const b = F.buildSnapshot(maakModel());
  t.true(F.snapshotMatches(a, b) === (a.takenAt === b.takenAt),
    'twee snapshots van dezelfde stand verschillen hooguit in hun tijdstempel');
  const c = F.buildSnapshot(Object.assign(maakModel(), { takenAt: a.takenAt }));
  t.true(F.snapshotMatches(a, c), 'met hetzelfde tijdstempel zijn ze identiek');
  const d = F.buildSnapshot(Object.assign(maakModel(), { takenAt: a.takenAt, clientReference: 'anders' }));
  t.false(F.snapshotMatches(a, d), 'één gewijzigd veld levert een andere vingerafdruk op');

  t.group('vergrendeling');
  t.false(F.lockState({ statusCode: 'draft' }).locked, 'een concept is gewoon bewerkbaar');
  t.false(F.lockState({ statusCode: 'scheduled' }).locked, 'een ingeplande factuur ook');
  t.true(F.lockState({ statusCode: 'finalized' }).locked, 'een definitieve factuur is vergrendeld');
  t.true(F.lockState({ statusCode: 'sent' }).locked, 'een verstuurde factuur ook');
  t.true(F.lockState({ statusCode: 'paid' }).locked, 'een betaalde factuur ook');
  t.true(F.lockState({ statusCode: 'cancelled' }).locked, 'een geannuleerde factuur ook');
  t.true(F.lockState({ statusCode: 'draft', snapshot: { a: 1 } }).locked,
    'een concept met snapshot is in werkelijkheid definitief en wordt ook zo behandeld');
  t.true(F.lockState({ statusCode: 'finalized' }).reason.indexOf('creditfactuur') > -1,
    'de melding wijst de gebruiker naar crediteren in plaats van naar herschrijven');

  /* elke status uit de rekenkern moet aan één van beide kanten vallen —
     zo kan er nooit een status bijkomen die stil bewerkbaar blijft */
  let open = 0, dicht = 0;
  for (const st of core.STATUSES) {
    const l = F.lockState({ statusCode: st });
    if (l.locked) dicht++; else open++;
    t.eq(l.locked, !core.STATUS_META[st].editable,
      'status “' + st + '” is in beide bestanden even (on)bewerkbaar');
  }
  t.eq(open, 2, 'precies twee statussen zijn bewerkbaar: concept en ingepland');
  t.eq(dicht, core.STATUSES.length - 2, 'alle andere statussen zijn vergrendeld');

  t.group('welke velden blijven open');
  const def = { statusCode: 'sent' };
  t.true(F.assertPatch(def, { tags: ['x'] }).ok, 'interne tags mogen nog');
  t.true(F.assertPatch(def, { internalNote: 'gebeld' }).ok, 'de interne notitie mag nog');
  t.true(F.assertPatch(def, { tags: ['x'], internalNote: 'y' }).ok, 'allebei tegelijk mag ook');
  t.false(F.assertPatch(def, { lines: [] }).ok, 'regels wijzigen mag niet meer');
  t.false(F.assertPatch(def, { totalInclCents: 1 }).ok, 'een totaal wijzigen mag niet meer');
  t.false(F.assertPatch(def, { invoiceDate: '2026-01-01' }).ok, 'de factuurdatum wijzigen mag niet meer');
  t.false(F.assertPatch(def, { buyer: {} }).ok, 'de klantgegevens wijzigen mag niet meer');
  t.false(F.assertPatch(def, { invoiceNumber: 'CP-2026-9999' }).ok, 'het factuurnummer wijzigen mag niet meer');
  t.deep(F.assertPatch(def, { tags: ['x'], amountCents: 1, dueDate: 'x' }).blocked, ['amountCents', 'dueDate'],
    'de melding noemt precies de velden die geweigerd worden');
  t.true(F.assertPatch({ statusCode: 'draft' }, { lines: [] }).ok, 'op een concept mag alles nog');

  t.group('verwijderen');
  t.true(F.canDelete({ statusCode: 'draft' }).ok, 'een concept mag weg — dat heeft nooit bestaan');
  t.false(F.canDelete({ statusCode: 'finalized' }).ok, 'een definitieve factuur mag nooit weg');
  t.false(F.canDelete({ statusCode: 'cancelled' }).ok, 'een geannuleerde factuur ook niet — annuleren is geen wissen');
  t.false(F.canDelete({ statusCode: 'paid' }).ok, 'een betaalde factuur ook niet');
  t.true(F.canDelete({ statusCode: 'finalized' }).reason.indexOf('Annuleer') > -1,
    'en de melding wijst naar annuleren of crediteren');

  /* ------------------------------------------------------------------
     DE PAYLOAD DIE NAAR DE SERVER GAAT
     Stap 2 laat de server herrekenen en vergelijkt zijn uitkomst met die
     van de browser; wijkt er iets af, dan gaat de factuur niet definitief.
     Dat werkt alleen als de server dezelfde regels kríjgt. De editor typt
     in RUWE tekst ("12,5", "85,00", "10"), maar
     netlify/functions/invoice-validate.mjs laat bewust alleen de velden
     door die de rekenkern kent — en discountPercent/discountAmount zitten
     daar niet bij. De browser stuurt daarom de GENORMALISEERDE waarden.
     Deze test legt vast dat die twee vormen exact hetzelfde uitrekenen.
     ------------------------------------------------------------------ */
  t.group('genormaliseerde regels rekenen identiek');
  const ruw = maakModel();
  const uitRuw = ruw.computed;
  const genormaliseerd = {
    currency: 'EUR',
    pricesIncludeVat: false,
    lines: uitRuw.lines.map((L, i) => ({
      type: L.type, description: L.description, detail: L.detail, unit: L.unit,
      ledgerRef: L.ledgerRef, productRef: L.productRef, sort: i,
      quantityMicro: L.quantityMicro, unitPriceCents: L.unitPriceCents,
      priceIncludesVat: L.priceIncludesVat,
      discountType: L.discountType, discountValue: L.discountValue,
      taxCode: L.taxCode
    })),
    surcharges: uitRuw.surcharges.map((s) => ({
      label: s.label, amountCents: s.amountCents, taxCode: s.taxCode
    })),
    discount: { type: 'percent', value: 5000 },
    payments: [{ amountCents: 50000 }]
  };
  const uitNorm = core.computeInvoice(genormaliseerd);
  t.deep(uitNorm.totals, uitRuw.totals,
    'dezelfde factuur uit ruwe invoer en uit genormaliseerde waarden geeft exact dezelfde totalen');
  t.eq(uitNorm.groups.length, uitRuw.groups.length, 'en dezelfde btw-groepen');
  t.eq(uitNorm.lines[1].netExclCents, uitRuw.lines[1].netExclCents, 'en dezelfde regelbedragen');
  t.eq(uitNorm.lines[2].discountExclCents, uitRuw.lines[2].discountExclCents,
    'inclusief de regelkorting — die zou verdwijnen als alleen discountPercent werd meegestuurd');
  t.true(uitRuw.lines[2].discountExclCents > 0, 'de testfactuur draagt echt een regelkorting, anders bewijst dit niets');

  t.group('de acht stappen');
  t.eq(F.STEPS.length, 8, 'er zijn acht stappen');
  t.deep(F.STEPS.map((s) => s.key),
    ['valideren', 'herberekenen', 'reeks', 'nummer', 'snapshot', 'pdf', 'audit', 'vergrendelen'],
    'in exact de volgorde van de spec');
  t.eq(F.STEPS[3].nr, 4, 'het nummer valt in stap 4, na validatie en herberekening');

  return runAsync(t);
}

/* De driver is asynchroon; de testrunner kan een Promise aan. */
async function runAsync(t) {
  const log = [];
  function handlers(over) {
    const h = {
      validate: () => { log.push('validate'); return { ok: true }; },
      recompute: () => { log.push('recompute'); return { ok: true }; },
      checkSeries: () => { log.push('checkSeries'); return { ok: true }; },
      claimNumber: () => { log.push('claimNumber'); return { ok: true, data: { number: 'CP-2026-0042' } }; },
      snapshot: (nr) => { log.push('snapshot:' + nr); return { ok: true, data: { snapshot: { nr: nr } } }; },
      pdf: (snap) => { log.push('pdf:' + (snap ? snap.nr : '')); return { ok: true }; },
      audit: () => { log.push('audit'); return { ok: true }; },
      lock: () => { log.push('lock'); return { ok: true }; },
      onStep: (e) => { log.push('#' + e.nr); }
    };
    return Object.assign(h, over || {});
  }

  t.group('de acht stappen — gelukte doorloop');
  log.length = 0;
  const ok = await globalThis.CP_INVOICE_FINAL.runFinalize(handlers());
  t.true(ok.ok, 'een volledige doorloop lukt');
  t.eq(ok.number, 'CP-2026-0042', 'het uitgegeven nummer komt terug');
  t.eq(ok.steps.length, 8, 'alle acht stappen zijn gedraaid');
  t.deep(ok.steps.map((s) => s.nr), [1, 2, 3, 4, 5, 6, 7, 8], 'in oplopende volgorde');
  t.deep(log.filter((x) => x[0] === '#'), ['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#8'],
    'elke stap meldt zich bij onStep — daar schrijft de aanroeper zijn audit-regel');
  t.eq(log[log.indexOf('snapshot:CP-2026-0042')] , 'snapshot:CP-2026-0042',
    'stap 5 krijgt het nummer uit stap 4 mee');
  t.eq(log[log.indexOf('pdf:CP-2026-0042')], 'pdf:CP-2026-0042',
    'stap 6 krijgt de snapshot uit stap 5 mee');

  t.group('de acht stappen — vroege fout trekt geen nummer');
  log.length = 0;
  let wees = null;
  const stuk = await globalThis.CP_INVOICE_FINAL.runFinalize(handlers({
    validate: () => { log.push('validate'); return { ok: false, detail: 'De klantnaam ontbreekt.' }; },
    onNumberOrphan: (n) => { wees = n; }
  }));
  t.false(stuk.ok, 'de doorloop mislukt');
  t.eq(stuk.failedStep.nr, 1, 'en meldt precies welke stap struikelde');
  t.eq(stuk.failedStep.detail, 'De klantnaam ontbreekt.', 'met de reden erbij');
  t.eq(stuk.number, '', 'er is geen nummer uitgegeven');
  t.false(log.indexOf('claimNumber') > -1, 'stap 4 is niet eens gedraaid');
  t.eq(wees, null, 'er is dus ook geen wees te melden');

  log.length = 0;
  const stuk3 = await globalThis.CP_INVOICE_FINAL.runFinalize(handlers({
    checkSeries: () => ({ ok: false, detail: 'De reeks bestaat niet.' })
  }));
  t.eq(stuk3.failedStep.nr, 3, 'een kapotte reeks struikelt in stap 3');
  t.eq(stuk3.number, '', 'ook dan valt er geen nummer — de reeks houdt geen gat over');

  t.group('de acht stappen — late fout meldt het nummer als wees');
  log.length = 0;
  let weesNummer = null, weesStap = null;
  const laat = await globalThis.CP_INVOICE_FINAL.runFinalize(handlers({
    snapshot: () => { throw new Error('de opslag antwoordde niet'); },
    onNumberOrphan: (n, step) => { weesNummer = n; weesStap = step; }
  }));
  t.false(laat.ok, 'de doorloop mislukt');
  t.eq(laat.failedStep.nr, 5, 'in stap 5');
  t.eq(laat.number, 'CP-2026-0042', 'het nummer was al uitgegeven');
  t.eq(weesNummer, 'CP-2026-0042', 'en wordt als wees gemeld zodat de nummer-audit het gat verklaart');
  t.eq(weesStap.nr, 5, 'met de stap waarin het misging');
  t.false(log.indexOf('lock') > -1, 'stap 8 draait niet meer — de factuur blijft concept');

  t.group('de acht stappen — de PDF-hook van fase 3 mag ontbreken');
  log.length = 0;
  const zonderPdf = handlers();
  delete zonderPdf.pdf;
  const geenPdf = await globalThis.CP_INVOICE_FINAL.runFinalize(zonderPdf);
  t.true(geenPdf.ok, 'zonder PDF-generator loopt definitief maken gewoon door');
  t.true(geenPdf.steps[5].detail.indexOf('fase 3') > -1,
    'en stap 6 zegt eerlijk dat de generator van fase 3 nog niet is aangesloten');

  t.group('de acht stappen — een ontbrekende andere stap is een fout');
  const zonderLock = handlers();
  delete zonderLock.lock;
  const geenLock = await globalThis.CP_INVOICE_FINAL.runFinalize(zonderLock);
  t.false(geenLock.ok, 'een ontbrekende vergrendelstap wordt niet stil overgeslagen');
  t.true(geenLock.error.indexOf('Stap 8') > -1, 'de melding noemt de stap');

  t.group('de acht stappen — stap 4 zonder nummer');
  const leeg = await globalThis.CP_INVOICE_FINAL.runFinalize(handlers({
    claimNumber: () => ({ ok: true, data: { number: '' } })
  }));
  t.false(leeg.ok, 'een lege uitgifte geldt niet als geslaagd');
  t.eq(leeg.failedStep.nr, 4, 'en struikelt in stap 4');
}
