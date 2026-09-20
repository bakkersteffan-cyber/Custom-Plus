/* CUSTOM+ — de herinneringstrap: wanneer staat welke stap klaar, wanneer
   gaat er nooit iets uit, en wat kost een te late betaling.
   ------------------------------------------------------------------
   Twee dingen worden hier het hardst bewaakt:

     1. IDEMPOTENTIE. Vijf keer het beheer openen mag niet vijf keer een
        herinnering opleveren, en een stap die al klaarstaat komt nooit
        terug. Dat is in demomodus deze code en live de unieke index
        invoice_reminders_step_uniq — allebei getest, elk op hun eigen plek.
     2. DE HARDE STOPS. Betwist, gecrediteerd, oninbaar en geannuleerd zijn
        statussen waarbij er NOOIT iets uit mag gaan. Dat is geen instelling
        maar een regel, en er is een test per status.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-reminders.js';

const core = globalThis.CP_INVOICE;
const R = globalThis.CP_REMINDERS;

/* een factuur die zeker aan de beurt is: vervallen, verstuurd, onbetaald */
function factuur(over) {
  return Object.assign({
    id: 'i1', statusCode: 'sent', dueDate: '2026-03-01',
    reminderPaused: false, reminderEvaluatedOn: ''
  }, over || {});
}
const openStaat = { code: 'open', paidCents: 0, outstandingCents: 100000 };

export default function (t) {
  t.group('module');
  t.true(!!R, 'portal/invoice-reminders.js levert CP_REMINDERS op');
  t.eq(R.STEPS.length, 4, 'de trap heeft de vier stappen uit de spec');
  t.eq(R.STEPS[0].waitDays < 0, true, 'de eerste stap ligt vóór de vervaldatum');
  t.eq(R.MANUAL_STEP, 99, 'de losse handmatige herinnering is stap 99');

  /* ------------------------------------------------------------------
     1. DE INSTELLINGEN
     ------------------------------------------------------------------ */
  t.group('instellingen');
  const d = R.defaultConfig();
  t.false(d.aan, 'de trap staat standaard uit');
  t.false(d.rente.aan, 'rente staat standaard uit');
  t.false(d.incasso.aan, 'incassokosten staan standaard uit');
  t.eq(d.stappen.length, 4, 'de standaardconfiguratie heeft vier stappen');

  const omgedraaid = R.normalizeConfig({ stappen: [{ step: 0, wachtdagen: 3 }] });
  t.eq(omgedraaid.stappen[0].wachtdagen, -3,
    'stap 0 hoort vóór de vervaldatum: een positief getal wordt omgeklapt in plaats van stil geaccepteerd');

  const doorElkaar = R.normalizeConfig({
    stappen: [{ step: 1, wachtdagen: 20 }, { step: 2, wachtdagen: 5 }, { step: 3, wachtdagen: 30 }]
  });
  t.true(doorElkaar.stappen[2].wachtdagen > doorElkaar.stappen[1].wachtdagen,
    'de wachtdagen lopen altijd op — een tweede herinnering vóór de eerste is geen trap maar een stapel');
  t.true(doorElkaar.stappen[3].wachtdagen > doorElkaar.stappen[2].wachtdagen,
    'ook de laatste aanmaning wordt vooruitgeschoven als dat nodig is');

  const rommel = R.normalizeConfig({ rente: { jaarPctMilli: -500 }, incasso: { methode: 'onzin' } });
  t.eq(rommel.rente.jaarPctMilli, 0, 'een negatief rentepercentage wordt nul, niet negatief');
  t.eq(rommel.incasso.methode, 'wik', 'een onbekende incassomethode valt terug op de wettelijke staffel');
  t.deep(R.normalizeConfig(null).stappen.length, 4, 'null levert de volledige standaardconfiguratie op');

  /* ------------------------------------------------------------------
     2. WANNEER STAAT EEN STAP KLAAR
     ------------------------------------------------------------------ */
  t.group('planning');
  t.eq(R.plannedDate('2026-03-01', -3), '2026-02-26', 'drie dagen vóór 1 maart is 26 februari');
  t.eq(R.plannedDate('2026-03-01', 21), '2026-03-22', 'eenentwintig dagen erna is 22 maart');
  t.eq(R.plannedDate('', 3), '', 'zonder vervaldatum is er geen moment om vanaf te tellen');
  t.eq(R.daysBetween('2026-03-01', '2026-03-15'), 14, 'veertien dagen ertussen');
  /* zomertijd: 29 maart 2026 is de overgang in Europa. Een kalenderdag
     hoort daar geen dag door te verspringen. */
  t.eq(R.addDays('2026-03-28', 2), '2026-03-30', 'de zomertijdovergang haalt er geen dag af');

  /* ------------------------------------------------------------------
     3. DE HARDE STOPS
     ------------------------------------------------------------------ */
  t.group('nooit versturen bij');
  for (const st of ['disputed', 'credited', 'uncollectible', 'cancelled']) {
    const e = R.eligible(factuur({ statusCode: st }), openStaat);
    t.false(e.ok, 'bij status “' + st + '” gaat er geen herinnering uit');
    t.eq(e.code, 'status_geblokkeerd', 'en dat is een harde regel, geen instelling');
  }
  t.false(R.eligible(factuur({ statusCode: 'draft' }), openStaat).ok, 'een concept krijgt geen herinnering');
  t.false(R.eligible(factuur({ statusCode: 'paid' }), openStaat).ok, 'een betaalde factuur ook niet');
  t.eq(R.eligible(factuur(), { code: 'paid', paidCents: 100000, outstandingCents: 0 }).code, 'betaald',
    'de trap stopt automatisch zodra er niets meer openstaat');
  t.eq(R.eligible(factuur({ reminderPaused: true }), openStaat).code, 'gepauzeerd',
    'handmatig pauzeren werkt');
  t.eq(R.eligible(factuur({ dueDate: '' }), openStaat).code, 'geen_vervaldatum',
    'zonder vervaldatum is er niets om vanaf te tellen');
  t.true(R.eligible(factuur(), openStaat).ok, 'een gewone openstaande factuur mag wel');

  /* de vier geblokkeerde statussen zijn ook echt de vier uit de spec */
  t.deep(R.BLOCKED_STATUSES.slice().sort(),
    ['cancelled', 'credited', 'disputed', 'uncollectible'],
    'precies de vier statussen die de opdracht noemt');
  for (const st of R.BLOCKED_STATUSES) {
    t.true(core.STATUSES.indexOf(st) > -1, 'status “' + st + '” bestaat ook echt in de rekenkern');
  }

  /* ------------------------------------------------------------------
     4. DE EVALUATIE
     ------------------------------------------------------------------ */
  t.group('evaluatie');
  const aan = R.normalizeConfig({ aan: true });

  const uit = R.evaluate({ invoice: factuur(), config: { aan: false }, existing: [], settle: openStaat, today: '2026-03-20' });
  t.eq(uit.due.length, 0, 'met de trap uit gebeurt er niets');
  t.true(uit.reason.indexOf('uit') > -1, 'en dat staat er zo bij');

  const vroeg = R.evaluate({ invoice: factuur(), config: aan, existing: [], settle: openStaat, today: '2026-02-20' });
  t.eq(vroeg.due.length, 0, 'ruim vóór de vervaldatum staat er nog niets klaar');
  t.eq(vroeg.nextStep.step, 0, 'de eerstvolgende stap is de vriendelijke herinnering');
  t.eq(vroeg.nextStep.plannedFor, '2026-02-26', 'op drie dagen vóór de vervaldatum');

  const eerste = R.evaluate({ invoice: factuur(), config: aan, existing: [], settle: openStaat, today: '2026-02-27' });
  t.eq(eerste.due.length, 1, 'op de dag na de planningsdatum staat er precies één stap klaar');
  t.eq(eerste.due[0].step, 0, 'en dat is stap 0');

  /* HOOGSTENS ÉÉN STAP PER RONDE, ook als er drie achterstallig zijn */
  const laat = R.evaluate({ invoice: factuur(), config: aan, existing: [], settle: openStaat, today: '2026-05-01' });
  t.eq(laat.due.length, 1, 'ook als de factuur twee maanden oud is komt er hoogstens één stap tegelijk');
  t.eq(laat.due[0].step, 0, 'en dat is de eerste die nog niet is geweest');
  t.true(laat.skipped.some((s) => s.reason.indexOf('wacht tot de vorige') > -1),
    'de rest wacht tot de vorige stap is verstuurd');

  /* ------------------------------------------------------------------
     5. IDEMPOTENTIE — de kern
     ------------------------------------------------------------------ */
  t.group('idempotentie');
  const alKlaar = R.evaluate({
    invoice: factuur(), config: aan,
    existing: [{ step: 0, status: 'gepland' }],
    settle: openStaat, today: '2026-05-01'
  });
  t.eq(alKlaar.due[0].step, 1, 'een stap die al klaarstaat komt niet terug — de volgende is aan de beurt');

  const alGeweest = R.evaluate({
    invoice: factuur(), config: aan,
    existing: [{ step: 0, status: 'verzonden' }, { step: 1, status: 'overgeslagen' }, { step: 2, status: 'fout' }],
    settle: openStaat, today: '2026-05-01'
  });
  t.eq(alGeweest.due[0].step, 3, 'ook een overgeslagen of mislukte stap komt nooit terug');

  const alles = R.evaluate({
    invoice: factuur(), config: aan,
    existing: [0, 1, 2, 3].map((s) => ({ step: s, status: 'verzonden' })),
    settle: openStaat, today: '2026-06-01'
  });
  t.eq(alles.due.length, 0, 'als alle vier de stappen zijn geweest, stopt de trap');
  t.true(alles.reason.indexOf('geweest') > -1, 'met een uitleg in plaats van stilte');

  /* het dagslot: vijf keer verversen doet vier keer niets */
  const vandaagAl = R.evaluate({
    invoice: factuur({ reminderEvaluatedOn: '2026-05-01' }), config: aan,
    existing: [], settle: openStaat, today: '2026-05-01'
  });
  t.true(vandaagAl.alreadyToday, 'een factuur die vandaag al is beoordeeld wordt overgeslagen');
  t.eq(vandaagAl.due.length, 0, 'en levert dus niets op');
  t.false(vandaagAl.ran, 'de evaluatie is niet eens gedraaid');

  const geforceerd = R.evaluate({
    invoice: factuur({ reminderEvaluatedOn: '2026-05-01' }), config: aan,
    existing: [], settle: openStaat, today: '2026-05-01', force: true
  });
  t.eq(geforceerd.due.length, 1, 'met force wordt het dagslot bewust overgeslagen (het scherm doet dat om te tonen wat er zou gebeuren)');

  const morgen = R.evaluate({
    invoice: factuur({ reminderEvaluatedOn: '2026-05-01' }), config: aan,
    existing: [], settle: openStaat, today: '2026-05-02'
  });
  t.false(morgen.alreadyToday, 'de volgende dag telt weer');

  /* een uitgezette stap wordt overgeslagen, niet uitgesteld */
  const stapUit = R.normalizeConfig({ aan: true, stappen: [{ step: 0, aan: false }] });
  const zonderNul = R.evaluate({
    invoice: factuur(), config: stapUit, existing: [], settle: openStaat, today: '2026-05-01'
  });
  t.eq(zonderNul.due[0].step, 1, 'een uitgezette stap wordt overgeslagen');
  t.true(zonderNul.skipped.some((s) => s.step === 0 && s.reason === 'staat uit'), 'en dat staat in de uitleg');

  /* ------------------------------------------------------------------
     6. DE TEKSTEN
     ------------------------------------------------------------------ */
  t.group('teksten');
  const vars = { nummer: 'CP-2026-0042', naam: 'Jan', bedrag: '€ 100,00',
    openstaand: '€ 60,00', vervaldatum: '1 maart 2026', afzender: 'Steffan' };
  const tekst = R.renderStep({ step: 1 }, vars);
  t.true(tekst.subject.indexOf('CP-2026-0042') > -1, 'het factuurnummer wordt ingevuld');
  t.true(tekst.body.indexOf('Jan') > -1, 'de naam wordt ingevuld');
  t.true(tekst.body.indexOf('€ 60,00') > -1, 'het openstaande bedrag wordt ingevuld');
  t.false(tekst.body.indexOf('{') > -1, 'er blijft geen enkele plaatshouder staan');
  t.false(tekst.custom, 'zonder eigen tekst is dit de standaardtekst');

  const eigen = R.renderStep({ step: 1, onderwerp: 'Even over {nummer}', tekst: 'Hoi {naam}' }, vars);
  t.eq(eigen.subject, 'Even over CP-2026-0042', 'een eigen onderwerp wordt gebruikt en ingevuld');
  t.eq(eigen.body, 'Hoi Jan', 'en een eigen tekst ook');
  t.true(eigen.custom, 'de uitkomst meldt dat dit een eigen tekst is');

  /* de vertaalfunctie wordt op de BRONSTRING toegepast, niet op de
     ingevulde tekst — anders vertaal je een klantnaam mee */
  let gezien = null;
  R.renderStep({ step: 1 }, vars, (s) => { gezien = s; return s; });
  t.true(gezien !== null && gezien.indexOf('{naam}') > -1,
    'de vertaler krijgt de bronstring MET plaatshouders, niet de ingevulde tekst');

  const eigenNietVertaald = R.renderStep({ step: 1, tekst: 'Mijn eigen tekst' }, vars, () => 'VERTAALD');
  t.eq(eigenNietVertaald.body, 'Mijn eigen tekst', 'een eigen tekst wordt niet vertaald — die staat er al in de gekozen taal');

  const prev = R.preview(aan, { ...vars, vervaldatumIso: '2026-03-01' });
  t.eq(prev.length, 4, 'het voorbeeld toont alle vier de stappen vóór je inschakelt');
  t.eq(prev[0].plannedFor, '2026-02-26', 'met de datum waarop elke stap zou vertrekken');
  t.true(prev[3].subject.length > 0, 'ook de laatste aanmaning heeft een onderwerp');

  /* ------------------------------------------------------------------
     7. RENTE — gehele centen
     ------------------------------------------------------------------ */
  t.group('rente');
  t.eq(R.interestCents({ principalCents: 100000, annualPctMilli: 8000, days: 365 }).cents, 8000,
    '8% over € 1.000,00 gedurende een jaar is € 80,00');
  t.eq(R.interestCents({ principalCents: 100000, annualPctMilli: 8000, days: 0 }).cents, 0,
    'nul dagen is nul rente');
  t.eq(R.interestCents({ principalCents: 0, annualPctMilli: 8000, days: 365 }).cents, 0,
    'geen hoofdsom is geen rente');
  t.eq(R.interestCents({ principalCents: 100000, annualPctMilli: 0, days: 365 }).cents, 0,
    'nul procent is nul rente');
  t.eq(R.interestCents({ principalCents: 100000, annualPctMilli: 8000, days: -10 }).cents, 0,
    'een negatief aantal dagen levert nooit negatieve rente op');
  const eenDag = R.interestCents({ principalCents: 100000, annualPctMilli: 8000, days: 1 });
  t.eq(eenDag.cents, 22, 'één dag rente over € 1.000,00 bij 8% is 22 cent (afgerond, half weg van nul)');
  t.eq(eenDag.cents, core.divRound(100000 * 8000 * 1, 100 * 1000 * 365),
    'de uitkomst komt exact overeen met divRound uit de rekenkern');
  t.eq(typeof R.interestCents({ principalCents: 12345, annualPctMilli: 5500, days: 37 }).cents, 'number',
    'de uitkomst is altijd een getal');
  t.eq(R.interestCents({ principalCents: 12345, annualPctMilli: 5500, days: 37 }).cents % 1, 0,
    'en altijd een geheel aantal centen');

  /* ------------------------------------------------------------------
     8. INCASSOKOSTEN — de wettelijke staffel
     ------------------------------------------------------------------ */
  t.group('incassokosten');
  t.eq(R.collectionCostCents(10000, { methode: 'wik' }).cents, R.WIK_MIN_CENTS,
    'over € 100,00 komt de staffel onder het minimum uit en geldt € 40,00');
  t.true(R.collectionCostCents(10000, { methode: 'wik' }).floored, 'en dat wordt gemeld');
  t.eq(R.collectionCostCents(100000, { methode: 'wik' }).cents, 15000,
    '15% over € 1.000,00 is € 150,00');
  t.eq(R.collectionCostCents(250000, { methode: 'wik' }).cents, 37500,
    '15% over precies € 2.500,00 is € 375,00 — de grens van de eerste schijf');
  t.eq(R.collectionCostCents(500000, { methode: 'wik' }).cents, 62500,
    '€ 5.000,00 loopt over twee schijven: € 375 + € 250 = € 625,00');
  t.eq(R.collectionCostCents(1000000, { methode: 'wik' }).cents, 87500,
    '€ 10.000,00 loopt over drie schijven: € 375 + € 250 + € 250 = € 875,00');
  t.eq(R.collectionCostCents(100000000, { methode: 'wik' }).cents, R.WIK_MAX_CENTS,
    'bij € 1.000.000,00 raakt de staffel precies het wettelijke maximum van € 6.775,00');
  t.true(R.collectionCostCents(200000000, { methode: 'wik' }).capped,
    'daarboven wordt afgetopt, en dat wordt gemeld');
  t.eq(R.collectionCostCents(0, { methode: 'wik' }).cents, 0, 'zonder openstaand bedrag geen kosten');
  t.eq(R.collectionCostCents(100000, { methode: 'vast', vastBedragCents: 5000 }).cents, 5000,
    'een vast bedrag wordt letterlijk gebruikt');
  t.eq(R.collectionCostCents(100000, { methode: 'wik' }).cents % 1, 0, 'de uitkomst is een geheel aantal centen');

  /* ------------------------------------------------------------------
     9. RENTE EN INCASSO KOMEN NOOIT AUTOMATISCH
     ------------------------------------------------------------------ */
  t.group('bevestiging verplicht');
  const geenExtras = R.extrasFor({ config: aan, step: 3, outstandingCents: 100000, daysOverdue: 60 });
  t.eq(geenExtras.totalCents, 0, 'met rente en incasso uit komt er niets bij');
  t.false(geenExtras.bevestigingNodig, 'en er valt dus niets te bevestigen');

  const metExtras = R.extrasFor({
    config: R.normalizeConfig({ aan: true, rente: { aan: true, jaarPctMilli: 8000, vanafStap: 2 },
      incasso: { aan: true, methode: 'wik', vanafStap: 3 } }),
    step: 3, outstandingCents: 100000, daysOverdue: 60
  });
  t.true(metExtras.renteCents > 0, 'met rente aan wordt er rente voorgerekend');
  t.eq(metExtras.incassoCents, 15000, 'en de incassokosten volgen de staffel');
  t.true(metExtras.bevestigingNodig, 'het resultaat zegt dat er bevestigd moet worden');
  t.eq(metExtras.items.length, 2, 'beide posten staan er los in, met hun uitleg');
  t.true(metExtras.items[0].detail.length > 0, 'elke post legt uit waar hij vandaan komt');

  const teVroeg = R.extrasFor({
    config: R.normalizeConfig({ aan: true, rente: { aan: true, jaarPctMilli: 8000, vanafStap: 2 } }),
    step: 1, outstandingCents: 100000, daysOverdue: 60
  });
  t.eq(teVroeg.renteCents, 0, 'vóór de ingestelde stap komt er geen rente bij');

  const nietsOpen = R.extrasFor({
    config: R.normalizeConfig({ aan: true, rente: { aan: true, jaarPctMilli: 8000, vanafStap: 0 } }),
    step: 3, outstandingCents: 0, daysOverdue: 60
  });
  t.eq(nietsOpen.totalCents, 0, 'zonder openstaand bedrag valt er niets te berekenen');
}
