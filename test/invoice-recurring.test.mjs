/* CUSTOM+ — terugkerende facturen.
   ------------------------------------------------------------------
   DE KERN VAN DIT BESTAND IS IDEMPOTENTIE. Een profiel dat twee keer
   wordt geëvalueerd mag nooit twee facturen voor dezelfde periode
   opleveren. Dat is hier op drie manieren dichtgetimmerd, en alle drie
   worden ze getest:

     1. de periodesleutel — plan() geeft alleen sleutels terug die nog niet
        in existingKeys staan;
     2. lastPeriodKey op het profiel — vangt de tweede evaluatie af, ook als
        de aanroeper zijn lijst niet heeft ververst;
     3. het dagslot lastEvaluatedOn — hoogstens één evaluatie per dag.

   De derde garantie, de unieke index recurring_runs_period_uniq, staat in
   0012_betalingen.sql en is de enige die twee gelijktijdige tabbladen
   overleeft. Die kan hier niet worden getest zonder database; wat hier
   staat is alles wat zonder database te bewijzen valt.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-recurring.js';

const RC = globalThis.CP_RECURRING;

function profiel(over) {
  return RC.normalizeProfile(Object.assign({
    id: 'p1', projectId: 'prj1', label: 'Abonnement',
    frequency: 'month', intervalCount: 1,
    startDate: '2026-01-01', paymentTermDays: 14,
    currency: 'EUR', language: 'nl',
    linesTemplate: [{
      type: 'item', description: 'Maandabonnement', quantityMicro: 1000000,
      unit: 'maand', unitPriceCents: 10000, taxCode: 'NL21'
    }]
  }, over || {}));
}

export default function (t) {
  t.group('module');
  t.true(!!RC, 'portal/invoice-recurring.js levert CP_RECURRING op');
  t.eq(RC.FREQUENCIES.length, 5, 'vijf frequenties: week, maand, kwartaal, half jaar, jaar');

  /* ------------------------------------------------------------------
     1. PERIODESLEUTELS — stabiel en sorteerbaar
     ------------------------------------------------------------------ */
  t.group('periodesleutels');
  t.eq(RC.periodKey('2026-03-15', 'month'), '2026-03', 'maand');
  t.eq(RC.periodKey('2026-03-15', 'quarter'), '2026-Q1', 'kwartaal');
  t.eq(RC.periodKey('2026-07-15', 'quarter'), '2026-Q3', 'derde kwartaal');
  t.eq(RC.periodKey('2026-03-15', 'half_year'), '2026-H1', 'eerste halfjaar');
  t.eq(RC.periodKey('2026-08-15', 'half_year'), '2026-H2', 'tweede halfjaar');
  t.eq(RC.periodKey('2026-03-15', 'year'), '2026', 'jaar');
  t.eq(RC.periodKey('2026-01-01', 'week'), '2026-W01', 'week met een voorloopnul, zodat sorteren blijft werken');
  t.eq(RC.periodKey('2026-12-31', 'week'), '2026-W53', 'de laatste ISO-week van 2026');
  t.eq(RC.periodKey('', 'month'), '', 'zonder datum geen sleutel');
  t.true('2025-12' < '2026-01', 'de sleutels sorteren over de jaargrens heen correct');
  t.true('2026-W01' < '2026-W12', 'en weeksleutels ook, dankzij de voorloopnul');

  /* dezelfde datum geeft altijd dezelfde sleutel — dat is wat idempotentie
     mogelijk maakt */
  t.eq(RC.periodKey('2026-03-15', 'month'), RC.periodKey('2026-03-15', 'month'),
    'dezelfde invoer geeft altijd dezelfde sleutel');
  t.eq(RC.periodKey('2026-03-01', 'month'), RC.periodKey('2026-03-31', 'month'),
    'elke dag in maart geeft dezelfde maandsleutel');

  t.group('periodegrenzen');
  t.deep(RC.periodBounds('2026-03-15', 'month'), { start: '2026-03-01', end: '2026-03-31' }, 'maart loopt van 1 t/m 31');
  t.deep(RC.periodBounds('2026-02-10', 'month'), { start: '2026-02-01', end: '2026-02-28' }, 'februari 2026 heeft 28 dagen');
  t.deep(RC.periodBounds('2024-02-10', 'month'), { start: '2024-02-01', end: '2024-02-29' }, 'een schrikkeljaar telt 29');
  t.deep(RC.periodBounds('2026-05-06', 'quarter'), { start: '2026-04-01', end: '2026-06-30' }, 'het tweede kwartaal');
  t.deep(RC.periodBounds('2026-03-04', 'week'), { start: '2026-03-02', end: '2026-03-08' }, 'een week loopt van maandag tot zondag');

  /* ------------------------------------------------------------------
     2. VOORUITSPRINGEN — de ankerdag blijft staan
     ------------------------------------------------------------------ */
  t.group('vooruitspringen');
  t.eq(RC.advance('2026-01-15', 'month', 1), '2026-02-15', 'een maand vooruit houdt de dag vast');
  t.eq(RC.advance('2026-01-31', 'month', 1), '2026-02-28',
    '31 januari plus een maand is 28 februari, niet 3 maart');
  t.eq(RC.advance('2024-01-31', 'month', 1), '2024-02-29', 'in een schrikkeljaar is dat 29 februari');
  t.eq(RC.advance('2026-01-31', 'month', 2), '2026-03-31', 'twee maanden later staat de 31e er weer');
  t.eq(RC.advance('2026-01-15', 'week', 1), '2026-01-22', 'een week is zeven dagen');
  t.eq(RC.advance('2026-01-15', 'quarter', 1), '2026-04-15', 'een kwartaal is drie maanden');
  t.eq(RC.advance('2026-01-15', 'year', 1), '2027-01-15', 'een jaar is twaalf maanden');
  t.eq(RC.advance('2026-03-28', 'week', 1), '2026-04-04', 'de zomertijdovergang haalt er geen dag af');

  /* ------------------------------------------------------------------
     3. TIJDZONE
     ------------------------------------------------------------------ */
  t.group('tijdzone');
  const ams = RC.todayIn('Europe/Amsterdam', '2026-03-15T23:30:00Z');
  t.eq(ams.date, '2026-03-16', 'om 23:30 UTC is het in Amsterdam al de volgende dag');
  t.false(ams.fallback, 'de tijdzone is herkend');
  const utc = RC.todayIn('UTC', '2026-03-15T23:30:00Z');
  t.eq(utc.date, '2026-03-15', 'in UTC is het dan nog 15 maart');
  const jkt = RC.todayIn('Asia/Jakarta', '2026-03-15T18:30:00Z');
  t.eq(jkt.date, '2026-03-16', 'in Jakarta is het om 18:30 UTC al de volgende dag');
  const onbekend = RC.todayIn('Mars/Olympus', '2026-03-15T12:00:00Z');
  t.true(onbekend.fallback, 'een onbekende tijdzone valt terug op de lokale datum');
  t.true(onbekend.timeZone.indexOf('lokale') > -1, 'en zegt dat er eerlijk bij in plaats van iets anders te doen');
  t.true(/^\d{4}-\d{2}-\d{2}$/.test(onbekend.date), 'ook de terugval levert een geldige datum op');

  /* ------------------------------------------------------------------
     4. DE PLANNING
     ------------------------------------------------------------------ */
  t.group('planning');
  const p = profiel();
  t.eq(RC.nextRunDate(p), '2026-01-01', 'zonder gedane periode is de startdatum de eerste beurt');
  t.eq(RC.nextRunDate(profiel({ lastPeriodKey: '2026-01' })), '2026-02-01',
    'na januari is februari aan de beurt');
  t.eq(RC.nextRunDate(profiel({ lastPeriodKey: '2026-03' })), '2026-04-01',
    'na maart is april aan de beurt');
  t.eq(RC.nextRunDate(profiel({ lastPeriodKey: '2026-12', endDate: '2026-12-31' })), '',
    'voorbij de einddatum komt er niets meer');
  t.eq(RC.nextRunDate(profiel({ startDate: '' })), '', 'zonder startdatum is er geen beurt');

  const inhaal = RC.plan({ profile: p, today: '2026-03-15', existingKeys: [] });
  t.eq(inhaal.generate.length, 3, 'op 15 maart staan januari, februari en maart open');
  t.deep(inhaal.generate.map((g) => g.periodKey), ['2026-01', '2026-02', '2026-03'],
    'in chronologische volgorde');
  t.eq(inhaal.generate[0].invoiceDate, '2026-01-01', 'de factuurdatum is de periodedatum');
  t.eq(inhaal.generate[0].dueDate, '2026-01-15', 'en de vervaldatum telt de betaaltermijn erbij');
  t.eq(inhaal.generate[0].deliveryStart, '2026-01-01', 'de leverperiode is de hele maand');
  t.eq(inhaal.generate[0].deliveryEnd, '2026-01-31', 'van de eerste tot en met de laatste dag');
  t.eq(inhaal.nextRunDate, '2026-04-01', 'de volgende beurt staat op 1 april');

  const maxTwee = RC.plan({ profile: p, today: '2026-06-15', existingKeys: [], maxPerRun: 2 });
  t.eq(maxTwee.generate.length, 2, 'maxPerRun beperkt hoeveel er in één keer wordt ingehaald');
  t.eq(maxTwee.pendingAfterRun, 4, 'en meldt hoeveel er nog wachten');

  const geeindigd = RC.plan({ profile: profiel({ endDate: '2026-02-28' }), today: '2026-06-01', existingKeys: [] });
  t.eq(geeindigd.generate.length, 2, 'na de einddatum wordt er niets meer gepland');

  /* ------------------------------------------------------------------
     5. IDEMPOTENTIE — de kern
     ------------------------------------------------------------------ */
  t.group('idempotentie');
  const eerste = RC.plan({ profile: p, today: '2026-03-15', existingKeys: [] });
  const tweede = RC.plan({ profile: p, today: '2026-03-15',
    existingKeys: eerste.generate.map((g) => g.periodKey) });
  t.eq(tweede.generate.length, 0, 'een tweede evaluatie met dezelfde sleutels levert NIETS op');
  t.true(tweede.skipped.length >= 3, 'de overgeslagen perioden staan wel in de uitleg');
  t.true(tweede.skipped.every((s) => s.reason === 'is al gegenereerd'), 'met de reden erbij');

  const viaProfiel = RC.plan({ profile: profiel({ lastPeriodKey: '2026-03' }), today: '2026-03-15', existingKeys: [] });
  t.eq(viaProfiel.generate.length, 0,
    'ook zonder verse sleutellijst houdt lastPeriodKey op het profiel de generatie tegen');

  const gedeeltelijk = RC.plan({ profile: p, today: '2026-03-15', existingKeys: ['2026-01', '2026-03'] });
  t.eq(gedeeltelijk.generate.length, 1, 'een gat in het midden wordt alsnog ingehaald');
  t.eq(gedeeltelijk.generate[0].periodKey, '2026-02', 'namelijk precies de ontbrekende periode');

  const dagslot = RC.plan({ profile: profiel({ lastEvaluatedOn: '2026-03-15' }), today: '2026-03-15', existingKeys: [] });
  t.true(dagslot.alreadyToday, 'een profiel dat vandaag al is beoordeeld wordt overgeslagen');
  t.eq(dagslot.generate.length, 0, 'en levert dus niets op');
  const dagslotWeg = RC.plan({ profile: profiel({ lastEvaluatedOn: '2026-03-15' }), today: '2026-03-16', existingKeys: [] });
  t.true(dagslotWeg.generate.length > 0, 'de volgende dag telt weer');
  const geforceerd = RC.plan({ profile: profiel({ lastEvaluatedOn: '2026-03-15' }), today: '2026-03-15',
    existingKeys: [], force: true });
  t.true(geforceerd.generate.length > 0, 'met force wordt het dagslot bewust overgeslagen');

  /* markSuccess sluit de lus: hij onthoudt de sleutel én zet de volgende
     datum vooruit, zodat een tweede ronde niets meer vindt */
  let na = RC.markSuccess(p, '2026-01', '2026-03-15');
  t.eq(na.lastPeriodKey, '2026-01', 'de sleutel wordt onthouden');
  t.eq(na.nextRunDate, '2026-02-01', 'en de volgende datum staat vooruit');
  na = RC.markSuccess(na, '2026-02', '2026-03-15');
  na = RC.markSuccess(na, '2026-03', '2026-03-15');
  t.eq(RC.plan({ profile: na, today: '2026-03-15', existingKeys: [], force: true }).generate.length, 0,
    'na drie geslaagde generaties staat er niets meer open');

  /* ------------------------------------------------------------------
     6. STATUSSEN
     ------------------------------------------------------------------ */
  t.group('pauzeren, fout en retry');
  t.eq(RC.plan({ profile: RC.pause(p), today: '2026-03-15', existingKeys: [] }).generate.length, 0,
    'een gepauzeerd profiel genereert niets');
  t.true(RC.plan({ profile: RC.pause(p), today: '2026-03-15', existingKeys: [] }).reason.indexOf('pauze') > -1,
    'met de reden erbij');
  t.eq(RC.resume(RC.pause(p)).status, 'actief', 'hervatten zet hem weer aan');
  t.eq(RC.finish(p).status, 'beeindigd', 'beëindigen kan ook');

  const stuk = RC.markError(p, 'de nummerreeks ontbreekt');
  t.eq(stuk.status, 'fout', 'een fout zet het profiel op fout');
  t.eq(stuk.retryCount, 1, 'met een retryteller');
  t.eq(RC.markError(stuk, 'nog steeds').retryCount, 2, 'die bij elke poging oploopt');
  t.eq(RC.plan({ profile: stuk, today: '2026-03-15', existingKeys: [] }).generate.length, 0,
    'een profiel op fout genereert niets meer');
  t.true(RC.plan({ profile: stuk, today: '2026-03-15', existingKeys: [] }).reason.indexOf('nummerreeks') > -1,
    'en de oorzaak staat in de uitleg');
  const hersteld = RC.resume(stuk);
  t.eq(hersteld.status, 'actief', 'opnieuw proberen zet hem weer op actief');
  t.eq(hersteld.retryCount, 0, 'en zet de teller terug');
  t.eq(hersteld.errorDetail, '', 'en wist de foutmelding');

  t.eq(RC.plan({ profile: profiel({ linesTemplate: [] }), today: '2026-03-15', existingKeys: [] }).generate.length, 0,
    'een profiel zonder regels genereert niets');

  /* deze module raakt nooit aan wat hij krijgt */
  const origineel = profiel();
  RC.pause(origineel);
  t.eq(origineel.status, 'actief', 'pause() geeft een nieuw profiel terug en wijzigt het originele niet');

  /* ------------------------------------------------------------------
     7. HET CONCEPT
     ------------------------------------------------------------------ */
  t.group('het concept');
  const occ = RC.plan({ profile: p, today: '2026-01-15', existingKeys: [] }).generate[0];
  const draft = RC.draftFrom(p, occ);
  t.eq(draft.periodKey, '2026-01', 'de periodesleutel reist mee, zodat hij in dezelfde beweging kan landen');
  t.eq(draft.head.docKind, 'invoice', 'er komt een gewone factuur uit');
  t.eq(draft.head.projectId, 'prj1', 'aan het juiste project');
  t.eq(draft.head.recurringProfileId, 'p1', 'met een verwijzing naar het profiel');
  t.true(draft.head.label.indexOf('2026-01') > -1, 'het label draagt de periode, zodat je ze uit elkaar houdt');
  t.eq(draft.lines.length, 1, 'de regels komen uit het sjabloon');
  t.eq(draft.lines[0].id, null, 'als NIEUWE regels');
  t.eq(draft.lines[0].unitPriceCents, 10000, 'met de prijs uit het sjabloon');
  t.eq(draft.head.dueDate, '2026-01-15', 'en de vervaldatum uit de betaaltermijn');
  t.false(draft.indexed, 'zonder indexering wordt er niets aangepast');

  /* ------------------------------------------------------------------
     8. PRIJSINDEXERING — alleen na expliciete configuratie
     ------------------------------------------------------------------ */
  t.group('indexering');
  const zonder = RC.applyIndexation([{ type: 'item', unitPriceCents: 10000 }], 0);
  t.eq(zonder[0].unitPriceCents, 10000, 'zonder percentage verandert er niets');
  const met = RC.applyIndexation([{ type: 'item', unitPriceCents: 10000 }], 3500);
  t.eq(met[0].unitPriceCents, 10350, '3,5% over € 100,00 is € 103,50');
  const afronding = RC.applyIndexation([{ type: 'item', unitPriceCents: 3333 }], 3500);
  t.eq(afronding[0].unitPriceCents, 3333 + 117, 'de afronding loopt via divRound: 3333 + 117 cent');
  t.eq(afronding[0].unitPriceCents % 1, 0, 'en levert een geheel aantal centen op');
  const tekstregel = RC.applyIndexation([{ type: 'text', unitPriceCents: 10000 }], 3500);
  t.eq(tekstregel[0].unitPriceCents, 10000, 'een tekstregel wordt niet geïndexeerd');
  const bronRegels = [{ type: 'item', unitPriceCents: 10000 }];
  RC.applyIndexation(bronRegels, 3500);
  t.eq(bronRegels[0].unitPriceCents, 10000, 'de bronregels worden niet aangeraakt');

  const geindexeerd = profiel({ indexationPctMilli: 3500, indexationAppliesFrom: '2026-03-01' });
  const plan3 = RC.plan({ profile: geindexeerd, today: '2026-03-15', existingKeys: [] });
  t.false(plan3.generate[0].indexed, 'januari valt vóór de ingangsdatum en wordt niet geïndexeerd');
  t.true(plan3.generate[2].indexed, 'maart valt erna en wel');
  t.eq(RC.draftFrom(geindexeerd, plan3.generate[2]).lines[0].unitPriceCents, 10350,
    'en het concept van maart draagt de geïndexeerde prijs');
  t.eq(RC.draftFrom(geindexeerd, plan3.generate[0]).lines[0].unitPriceCents, 10000,
    'terwijl januari op de oude prijs blijft staan');

  const zonderDatum = profiel({ indexationPctMilli: 3500 });
  t.false(RC.plan({ profile: zonderDatum, today: '2026-03-15', existingKeys: [] }).generate[2].indexed,
    'zonder ingangsdatum wordt er nooit geïndexeerd — indexering vraagt een expliciete configuratie');
}
