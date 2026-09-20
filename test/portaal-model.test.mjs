/* CUSTOM+ — tests voor portal/portaal-model.js (CP_PORTAAL), ronde 3.
   Draaien: node test/run.mjs portaal
   ------------------------------------------------------------------
   De held bovenaan het klantportaal spreekt sinds ronde 3 in één zin en
   één datum. Wat hier faalt is dus geen visuele kleinigheid maar een
   zin die liegt: een fasenaam die verzonnen is, een doorlooptijd die
   nergens op de site van CUSTOM+ staat, een leverdatum die uit een fase
   is afgeleid, een bedrag met een verkeerd teken, of een dag die door de
   tijdzone een dag te vroeg staat.

   VIJF DINGEN DIE DEZE TESTS BEWAKEN

   1. DE DOORLOOPTIJDEN ZIJN DIE VAN DE SITE. faseUitleg() noemt per fase
      "meestal x tot y weken"; die bandbreedte wordt hier letterlijk
      vergeleken met content/nl/services.json (steps[n].dur), het bestand
      waaruit custom-plus.html en diensten/index.html hun dienstenpagina
      bouwen. Wijzigt de site, dan wordt deze test rood en hoort de
      tabel in portaal-model.js mee te veranderen.

   2. GEEN VERZONNEN LEVERDATUM. verwachteLevering() geeft null zonder
      zending-ETA of projectdeadline. Een lopende fase is geen datum.

   3. DE KLOK IS EEN PARAMETER. datumKort() beslist over het jaar op basis
      van `nu`, niet van de machineklok; alleen de test zonder `nu` leest
      de echte dag en controleert dan uitsluitend dat het jaar ontbreekt.

   4. LOKALE DAG, GEEN UTC-VERSCHUIVING. Een tijdstempel met Z wordt naar
      de lokale dag gelezen; de verwachting wordt hier met new Date()
      berekend, zodat de test in Amsterdam én op een UTC-machine klopt.

   5. DE EXPORT IS DE HELE API. Zelfde bewaking als bij admin-model.js:
      een functie die niet in de export staat, bouwt een scherm na.
   ------------------------------------------------------------------ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../portal/admin-model.js';
import '../portal/portaal-model.js';

const P = globalThis.CP_PORTAAL;
const HERE = dirname(fileURLToPath(import.meta.url));

/* de vaste klok van dit bestand: zondag 30 augustus 2026 */
const NU = '2026-08-30';

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/* de lokale dag van een tijdstempel, zoals het scherm hem hoort te tonen */
function lokaal(iso) {
  const d = new Date(iso);
  return { dag: d.getDate(), maand: MAAND[d.getMonth()], jaar: d.getFullYear() };
}

/* een project in de vorm van demo-data.js, met zes fases */
function project(id, naam, standen, extra) {
  const keys = ['concept', 'dfm', 'sourcing', 'tooling', 'production', 'logistics'];
  const p = { id, clientId: 'cli-noor', name: naam, status: 'active', createdAt: '2026-04-02',
    stages: keys.map((k, i) => ({ stageKey: k, position: i + 1, status: standen[i] || 'upcoming', paymentPct: 0, approvedAt: standen[i] === 'done' ? '2026-05-0' + (i + 1) : null })) };
  return Object.assign(p, extra || {});
}

/* het diffuservat: productie loopt, batch A onderweg met een ETA-venster */
function diffuserBundel(extra) {
  const p = project('prj-diffuser', 'Hervulbaar diffuservat', ['done', 'done', 'done', 'done', 'current', 'upcoming']);
  return Object.assign({
    project: p,
    stages: p.stages,
    klant: { id: 'cli-noor', naam: 'Noor van Dijk', voornaam: 'Noor', bedrijf: 'Atelier Noor' },
    invoices: [],
    shipments: [
      { id: 'shp-01', projectId: 'prj-diffuser', type: 'koerier', sampleRoundId: 'smp-t2', etaWindowStart: null, etaWindowEnd: null, deliveredAt: '2026-07-17T15:40:00Z', createdAt: '2026-07-14' },
      { id: 'shp-02', projectId: 'prj-diffuser', type: 'zeevracht', sampleRoundId: null, etaWindowStart: '2026-10-12', etaWindowEnd: '2026-10-18', deliveredAt: null, createdAt: '2026-08-20' }
    ],
    shipmentEvents: [
      { id: 'shev-05', shipmentId: 'shp-01', milestoneKey: 'geleverd', occurredAt: '2026-07-17' },
      { id: 'shev-09', shipmentId: 'shp-02', milestoneKey: 'vertrek_zee', occurredAt: '2026-08-25' }
    ]
  }, extra || {});
}

export default function (t) {

  /* ============================================================
     0. DE EXPORTTABEL IS DE HELE API
     ============================================================ */
  t.group('de export is de hele API');

  const API = [
    'VERSION', 'VERS_DAGEN',
    'SOORTEN_NODIG', 'ACTIES', 'ROLLEN_CONTACT', 'KLANT_DOC_TYPES', 'REORDER_STAGES',
    'watWeNodigHebben', 'aantalNodig', 'belangrijkeDatums', 'voortgang', 'activiteitVoorKlant',
    'factuurStatusVoorKlant', 'openstaandCents', 'openstaandPerValuta', 'volgendeBetaling',
    'reorderStand',
    'FASE_SLEUTELS', 'faseKort', 'faseUitleg', 'geldKlant', 'datumKort', 'datumKortDelen', 'verwachteLevering', 'begroeting',
    'vul', 'metVars', 'dayISO', 'daysBetween'
  ];
  API.forEach(function (naam) {
    t.true(Object.prototype.hasOwnProperty.call(P, naam),
      'de export bevat ' + naam + ' — ontbreekt hij, dan bouwt een scherm hem na en loopt die kopie weg van het origineel');
  });
  t.deep(Object.keys(P).slice().sort(), API.slice().sort(),
    'er staat niets in de export dat hier niet genoemd wordt: deze lijst, de exporttabel en het kopblok van portaal-model.js horen dezelfde drie te zijn');

  /* ============================================================
     1. faseKort — de zes korte klantnamen uit het contract
     ============================================================ */
  t.group('faseKort');

  t.deep(P.FASE_SLEUTELS, ['concept', 'dfm', 'sourcing', 'tooling', 'production', 'logistics'],
    'de zes sleutels staan in de volgorde van STAGE_ORDER in portal.html');
  t.eq(P.faseKort('concept'), 'Ontwerp', 'concept → Ontwerp');
  t.eq(P.faseKort('dfm'), 'Ontwerp voor productie', 'dfm → Ontwerp voor productie');
  t.eq(P.faseKort('sourcing'), 'Fabriek kiezen', 'sourcing → Fabriek kiezen');
  t.eq(P.faseKort('tooling'), 'Tooling & samples', 'tooling → Tooling & samples');
  t.eq(P.faseKort('production'), 'Productie & controle', 'production → Productie & controle');
  t.eq(P.faseKort('logistics'), 'Compliance & verzending', 'logistics → Compliance & verzending');
  t.eq(P.faseKort(' Tooling '), 'Tooling & samples', 'spaties en hoofdletters rond de sleutel maken het geen andere fase');
  t.eq(P.faseKort('onbekend'), 'onbekend', 'een onbekende sleutel zonder lange naam blijft de kale sleutel: zichtbaar onaf, nooit verzonnen');
  t.eq(P.faseKort('onbekend', 'Lange fasenaam'), 'Lange fasenaam', 'een onbekende sleutel met een lange naam als tekst krijgt die lange naam');
  t.eq(P.faseKort('onbekend', function (k) { return 'Lang: ' + k; }), 'Lang: onbekend', 'een onbekende sleutel met een stageLabel-functie krijgt het antwoord van die functie');
  t.eq(P.faseKort('tooling', function () { return 'Lang'; }), 'Tooling & samples', 'een bekende sleutel gebruikt de lange naam NIET: de korte naam is het doel');
  t.eq(P.faseKort('onbekend', function () { throw new Error('boem'); }), 'onbekend', 'een lange naam die klapt valt terug op de sleutel, niet op een fout');
  t.eq(P.faseKort(''), '', 'lege sleutel → lege tekst');
  t.eq(P.faseKort(null), '', 'null → lege tekst');
  t.eq(P.faseKort(undefined, 'Lang'), '', 'undefined → lege tekst, ook met een lange naam erbij');

  /* ============================================================
     2. faseUitleg — één zin, en de duur is die van de site
     ============================================================ */
  t.group('faseUitleg');

  const site = JSON.parse(readFileSync(join(HERE, '..', 'content', 'nl', 'services.json'), 'utf8'));
  const stappen = site.steps || [];
  t.eq(stappen.length, 6, 'de dienstenpagina van CUSTOM+ kent zes stappen, één per fase');
  P.FASE_SLEUTELS.forEach(function (k, i) {
    const zin = P.faseUitleg(k);
    const duur = stappen[i] ? String(stappen[i].dur || '') : '';
    t.true(zin.length > 20 && zin.slice(-1) === '.', k + ': één hele zin met een punt');
    t.true(duur && zin.indexOf('meestal ' + duur) >= 0,
      k + ': de duur in de zin (' + zin + ') is letterlijk die van content/nl/services.json (' + duur + ') — geen verzonnen doorlooptijd');
    t.false(/\w-\w/.test(zin), k + ': geen koppeltekens in klanttekst (huisregel)');
  });
  t.true(P.faseUitleg('tooling').indexOf('4 tot 10 weken') >= 0,
    'tooling zegt 4 tot 10 weken — de site zegt dat, niet de 4 tot 6 uit het contractvoorbeeld');
  t.eq(P.faseUitleg('onbekend'), '', 'onbekende fase → lege tekst, geen zin zonder inhoud');
  t.eq(P.faseUitleg(''), '', 'lege sleutel → lege tekst');
  t.eq(P.faseUitleg(null), '', 'null → lege tekst');
  t.eq(P.faseUitleg(' PRODUCTION '), P.faseUitleg('production'), 'de sleutel wordt op dezelfde manier gelezen als bij faseKort');

  /* ============================================================
     3. geldKlant — heel zonder centen, anders met, zelfde tekens als CP_MODEL
     ============================================================ */
  t.group('geldKlant');

  t.eq(P.geldKlant(312500), '€ 3.125', 'een heel bedrag zonder centen');
  t.eq(P.geldKlant(312550), '€ 3.125,50', 'een niet-heel bedrag met centen');
  t.eq(P.geldKlant(0), '€ 0', 'nul is € 0');
  t.eq(P.geldKlant(5), '€ 0,05', 'vijf cent');
  t.eq(P.geldKlant(100), '€ 1', 'één euro zonder centen');
  t.eq(P.geldKlant(123456789), '€ 1.234.567,89', 'duizendtallen met een punt over meerdere groepen');
  t.eq(P.geldKlant(-1250), '-€ 12,50', 'negatief: het minteken vóór het valutateken, zoals CP_MODEL.formatCents');
  t.eq(P.geldKlant(-300000), '-€ 3.000', 'negatief en heel');
  t.eq(P.geldKlant(100000, 'USD'), '$ 1.000', 'USD met dollarteken');
  t.eq(P.geldKlant(187550, 'CNY'), '¥ 1.875,50', 'CNY met yenteken, zoals de factuurmodule');
  t.eq(P.geldKlant(1250, 'SEK'), 'SEK 12,50', 'een munt zonder bekend teken krijgt haar ISO-code');
  t.eq(P.geldKlant(1250, 'eur'), '€ 12,50', 'kleine letters in de valutacode zijn dezelfde munt');
  t.eq(P.geldKlant(1250, 'x'), '€ 12,50', 'een onleesbare valutacode telt als EUR');
  t.eq(P.geldKlant(1250, null), '€ 12,50', 'geen valuta is EUR');
  t.eq(P.geldKlant('312500'), '€ 3.125', 'een getal als tekst wordt gelezen');
  t.eq(P.geldKlant(312549.6), '€ 3.125,50', 'een kommagetal wordt afgerond, nooit doorgerekend');
  t.eq(P.geldKlant('abc'), '€ 0', 'onleesbaar is nul, niet NaN');
  t.eq(P.geldKlant(null), '€ 0', 'null is nul');
  t.true(!!globalThis.CP_MODEL, 'CP_MODEL is in deze test geladen; formatCents is daar niet geëxporteerd, dus de symboolregels hieronder komen uit het eigen exemplaar');

  /* zonder CP_MODEL moet de terugval woordelijk hetzelfde zeggen */
  {
    const bewaard = globalThis.CP_MODEL;
    delete globalThis.CP_MODEL;
    try {
      t.eq(P.geldKlant(312500), '€ 3.125', 'terugval zonder CP_MODEL: heel bedrag');
      t.eq(P.geldKlant(312550), '€ 3.125,50', 'terugval zonder CP_MODEL: centen');
      t.eq(P.geldKlant(-1250, 'USD'), '-$ 12,50', 'terugval zonder CP_MODEL: negatief in USD');
      t.eq(P.geldKlant(1250, 'SEK'), 'SEK 12,50', 'terugval zonder CP_MODEL: ISO-code voor een onbekende munt');
      t.eq(P.geldKlant(123456789), '€ 1.234.567,89', 'terugval zonder CP_MODEL: duizendtallen');
    } finally {
      globalThis.CP_MODEL = bewaard;
    }
  }

  /* ============================================================
     4. datumKort / datumKortDelen — jaar alleen als het een ander jaar is
     ============================================================ */
  t.group('datumKort');

  t.eq(P.datumKort('2026-04-24', NU), '24 apr', 'in het lopende jaar zonder jaartal');
  t.eq(P.datumKort('2025-04-24', NU), '24 apr 2025', 'in een ander jaar mét jaartal');
  t.eq(P.datumKort('2027-01-03', NU), '3 jan 2027', 'een volgend jaar ook mét jaartal, dag zonder voorloopnul');
  t.eq(P.datumKort('2026-01-01', '2026-01-01'), '1 jan', 'jaargrens: nieuwjaarsdag in het lopende jaar');
  t.eq(P.datumKort('2025-12-31', '2026-01-01'), '31 dec 2025', 'jaargrens: oudejaarsdag hoort bij het vorige jaar zodra het nieuwe jaar is begonnen');
  t.eq(P.datumKort('2026-12-31', '2026-12-31'), '31 dec', 'jaargrens: de laatste dag van het jaar is nog het lopende jaar');
  t.eq(P.datumKort('2026-03-01', '2026-03-01T23:59:00Z'), '1 mrt', 'nu mag een tijdstempel zijn; maart heet mrt');
  t.deep(P.datumKortDelen('2026-04-24', NU), { dag: 24, maand: 'apr', jaar: null }, 'delen in het lopende jaar: jaar is null');
  t.deep(P.datumKortDelen('2025-04-24', NU), { dag: 24, maand: 'apr', jaar: 2025 }, 'delen in een ander jaar: jaar als getal');
  t.eq(typeof P.datumKortDelen('2026-04-24', NU).dag, 'number', 'dag is een getal, geen tekst');
  MAAND.forEach(function (m, i) {
    const iso = '2026-' + String(i + 1).padStart(2, '0') + '-15';
    t.eq(P.datumKortDelen(iso, NU).maand, m, 'maand ' + (i + 1) + ' heet ' + m);
  });

  /* tijdstempels met Z: de LOKALE dag, berekend zoals de browser dat doet */
  {
    const iso = '2026-04-24T23:30:00Z';
    const l = lokaal(iso);
    t.deep(P.datumKortDelen(iso, NU), { dag: l.dag, maand: l.maand, jaar: null },
      '23:30Z wordt de lokale dag (in Amsterdam 25 apr, op UTC 24 apr) — nooit de UTC-dag als die verschilt');
    t.eq(P.datumKort(iso, NU), l.dag + ' ' + l.maand, 'en datumKort schrijft diezelfde lokale dag');
  }
  {
    const iso = '2026-12-31T23:30:00Z';
    const l = lokaal(iso);
    const verwacht = l.jaar === 2026 ? '31 dec' : (l.dag + ' ' + l.maand + ' ' + l.jaar);
    t.eq(P.datumKort(iso, '2026-12-31'), verwacht, 'een Z-tijdstempel over de jaargrens toont het jaar precies dan wanneer de lokale dag in het nieuwe jaar valt');
  }
  t.eq(P.datumKort(new Date(2026, 3, 24, 12, 0, 0), NU), '24 apr', 'een Date-object wordt als lokale dag gelezen');

  t.eq(P.datumKort('', NU), '', 'lege tekst → lege tekst');
  t.eq(P.datumKort(null, NU), '', 'null → lege tekst');
  t.eq(P.datumKort(undefined, NU), '', 'undefined → lege tekst');
  t.eq(P.datumKort('abc', NU), '', 'onleesbaar → lege tekst');
  t.eq(P.datumKort('2026-13-45', NU), '', 'een onmogelijke datum → lege tekst, nooit het woord undefined');
  t.eq(P.datumKortDelen('', NU), null, 'delen van lege invoer → null');
  t.eq(P.datumKortDelen('2026-13-45', NU), null, 'delen van een onmogelijke datum → null');

  /* zonder nu: de echte klok, en dan alleen controleren dat het jaar ontbreekt */
  {
    const vandaag = P.dayISO(new Date());
    const uit = P.datumKort(vandaag);
    t.eq(uit.split(' ').length, 2, 'zonder nu telt de echte dag als lopend jaar: dag en maand, geen jaartal');
    t.eq(P.datumKort('1999-06-15').indexOf('1999') > 0, true, 'zonder nu krijgt een ver verleden wél zijn jaartal');
  }

  /* zonder CP_MODEL leest het eigen exemplaar dezelfde dag */
  {
    const bewaard = globalThis.CP_MODEL;
    delete globalThis.CP_MODEL;
    try {
      const iso = '2026-04-24T23:30:00Z';
      const l = lokaal(iso);
      t.eq(P.datumKort(iso, NU), l.dag + ' ' + l.maand, 'terugval zonder CP_MODEL.dateParts: dezelfde lokale dag');
      t.eq(P.datumKort('2025-04-24', NU), '24 apr 2025', 'terugval zonder CP_MODEL.dateParts: kale dag letterlijk, met jaar');
    } finally {
      globalThis.CP_MODEL = bewaard;
    }
  }

  /* ============================================================
     5. verwachteLevering — alleen uit echte velden
     ============================================================ */
  t.group('verwachteLevering');

  {
    const r = P.verwachteLevering(diffuserBundel());
    t.true(!!r, 'batch A heeft een ETA-venster, dus er is een verwachte levering');
    t.eq(r && r.datumISO, '2026-10-18', 'de datum is het EINDE van het ETA-venster (etaWindowEnd)');
    t.eq(r && r.bron, 'zending', 'de bron is de zending');
    t.eq(r && r.vanISO, '2026-10-12', 'het begin van het venster reist mee voor "tussen … en …"');
    t.eq(r && r.totISO, '2026-10-18', 'het einde van het venster reist mee');
    t.eq(r && r.id, 'shp-02', 'de zending zelf is aanwijsbaar');
    t.eq(r && r.sampleRoundId, null, 'een productzending draagt geen sampleronde');
  }
  t.eq(P.verwachteLevering(diffuserBundel({ shipments: [], shipmentEvents: [] })), null,
    'zonder zending en zonder deadline: null — productie loopt is GEEN datum');
  t.eq(P.verwachteLevering({}), null, 'lege bundel → null');
  t.eq(P.verwachteLevering(null), null, 'null → null');
  t.eq(P.verwachteLevering(undefined), null, 'undefined → null');
  {
    const b = diffuserBundel({
      shipments: [{ id: 'shp-x', projectId: 'prj-diffuser', etaWindowStart: '2026-09-01', etaWindowEnd: '2026-09-05', deliveredAt: '2026-09-04T10:00:00Z' }],
      shipmentEvents: []
    });
    t.eq(P.verwachteLevering(b), null, 'een zending met deliveredAt is geen verwachting meer');
  }
  {
    const b = diffuserBundel({
      shipments: [{ id: 'shp-x', projectId: 'prj-diffuser', etaWindowStart: '2026-09-01', etaWindowEnd: '2026-09-05', deliveredAt: null }],
      shipmentEvents: [{ id: 'e1', shipmentId: 'shp-x', milestoneKey: 'geleverd', occurredAt: '2026-09-04' }]
    });
    t.eq(P.verwachteLevering(b), null, 'een zending met een mijlpaal geleverd is ook geen verwachting meer');
  }
  {
    const b = diffuserBundel({
      shipments: [{ id: 'shp-x', projectId: 'prj-diffuser', etaWindowStart: '2026-09-01', etaWindowEnd: null, deliveredAt: null }],
      shipmentEvents: []
    });
    t.eq(P.verwachteLevering(b).datumISO, '2026-09-01', 'zonder einde van het venster telt het begin');
  }
  {
    const b = diffuserBundel({ shipments: [{ id: 'shp-x', projectId: 'prj-diffuser', eta: '2026-09-09', deliveredAt: null }], shipmentEvents: [] });
    t.eq(P.verwachteLevering(b).datumISO, '2026-09-09', 'een datalaag die het veld eta noemt wordt gelezen');
  }
  {
    const b = diffuserBundel({ shipments: [{ id: 'shp-x', projectId: 'prj-diffuser', etaISO: '2026-09-10T08:00:00Z', deliveredAt: null }], shipmentEvents: [] });
    t.true(!!P.verwachteLevering(b) && P.verwachteLevering(b).datumISO.indexOf('2026-09-') === 0, 'etaISO wordt gelezen en als dag geschreven');
  }
  {
    const b = diffuserBundel({ shipments: [{ id: 'shp-x', projectId: 'prj-diffuser', expectedAt: '2026-09-11', deliveredAt: null }], shipmentEvents: [] });
    t.eq(P.verwachteLevering(b).datumISO, '2026-09-11', 'expectedAt wordt gelezen');
  }
  {
    const b = diffuserBundel({ shipments: [{ id: 'shp-x', projectId: 'prj-diffuser', etaWindowEnd: 'ooit', deliveredAt: null }], shipmentEvents: [] });
    t.eq(P.verwachteLevering(b), null, 'een onleesbare ETA is geen datum');
  }
  {
    const b = diffuserBundel({
      shipments: [
        { id: 'shp-a', projectId: 'prj-diffuser', etaWindowEnd: '2026-11-20', deliveredAt: null },
        { id: 'shp-b', projectId: 'prj-diffuser', etaWindowEnd: '2026-10-02', deliveredAt: null },
        { id: 'shp-c', projectId: 'prj-diffuser', etaWindowEnd: '2026-12-01', deliveredAt: null }
      ],
      shipmentEvents: []
    });
    t.eq(P.verwachteLevering(b).id, 'shp-b', 'bij meerdere zendingen onderweg wint de vroegste ETA');
  }
  {
    const b = diffuserBundel({
      shipments: [
        { id: 'shp-sample', projectId: 'prj-diffuser', sampleRoundId: 'smp-t3', etaWindowEnd: '2026-09-02', deliveredAt: null },
        { id: 'shp-batch', projectId: 'prj-diffuser', sampleRoundId: null, etaWindowEnd: '2026-10-18', deliveredAt: null }
      ],
      shipmentEvents: []
    });
    const r = P.verwachteLevering(b);
    t.eq(r.id, 'shp-batch', 'een productzending gaat vóór een eerdere samplezending: de held gaat over het product');
  }
  {
    const b = diffuserBundel({
      shipments: [{ id: 'shp-sample', projectId: 'prj-diffuser', sampleRoundId: 'smp-t3', etaWindowEnd: '2026-09-02', deliveredAt: null }],
      shipmentEvents: []
    });
    const r = P.verwachteLevering(b);
    t.eq(r && r.sampleRoundId, 'smp-t3', 'alleen een samplezending onderweg: die telt, en de sampleronde staat erbij zodat het scherm het eerlijk kan zeggen');
  }

  /* planning: projects.deadline (0020) */
  {
    const b = diffuserBundel({ shipments: [], shipmentEvents: [] });
    b.project.deadline = '2026-11-30';
    const r = P.verwachteLevering(b);
    t.deep(r && { datumISO: r.datumISO, bron: r.bron }, { datumISO: '2026-11-30', bron: 'planning' },
      'zonder zending telt de beloofde einddatum van het project als planning');
    t.eq(r && r.projectId, 'prj-diffuser', 'de planning wijst naar het project');
  }
  {
    const b = diffuserBundel();
    b.project.deadline = '2026-11-30';
    t.eq(P.verwachteLevering(b).bron, 'zending', 'zending én deadline: de zending wint, die is concreter');
  }
  {
    const b = diffuserBundel({ shipments: [], shipmentEvents: [] });
    b.project.deadline = '2026-11-30';
    b.project.status = 'archived';
    t.eq(P.verwachteLevering(b), null, 'de deadline van een gearchiveerd project telt niet');
  }
  {
    const p = project('prj-geurflacon', 'Amberglazen geurflacon', ['done', 'done', 'done', 'done', 'done', 'done'], { deadline: '2026-02-27' });
    t.eq(P.verwachteLevering({ project: p, stages: p.stages }), null, 'de deadline van een afgerond product is geen verwachting meer');
  }
  {
    const b = diffuserBundel({ shipments: [], shipmentEvents: [] });
    b.project.deadline = 'geen datum';
    t.eq(P.verwachteLevering(b), null, 'een onleesbare deadline is geen datum');
  }

  /* de plank: meerdere projecten, met en zonder projectId */
  {
    const a = project('prj-a', 'A', ['done', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming'], { deadline: '2026-12-01' });
    const c = project('prj-c', 'C', ['done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming'], { deadline: '2026-10-01' });
    const plank = { projects: [a, c], shipments: [{ id: 'shp-c', projectId: 'prj-c', etaWindowEnd: '2026-10-05', deliveredAt: null }], shipmentEvents: [] };
    t.eq(P.verwachteLevering(plank).id, 'shp-c', 'over de hele plank: de zending van C');
    t.deep((function () { const r = P.verwachteLevering(plank, 'prj-a'); return r && { datumISO: r.datumISO, bron: r.bron }; })(),
      { datumISO: '2026-12-01', bron: 'planning' }, 'beperkt tot A: geen zending, dus de planning van A');
    t.eq(P.verwachteLevering(plank, 'prj-onbekend'), null, 'beperkt tot een project dat er niet is: null');
    t.eq(P.verwachteLevering({ projects: [a, c] }).datumISO, '2026-10-01', 'alleen planningen: de vroegste deadline wint');
  }

  /* ============================================================
     6. begroeting — de bouwstenen van de openingszin
     ============================================================ */
  t.group('begroeting');

  {
    const g = P.begroeting(diffuserBundel(), NU);
    t.eq(g.naam, 'Noor', 'de voornaam uit klant.voornaam');
    t.eq(g.product, 'Hervulbaar diffuservat', 'het product is de naam van het open project');
    t.eq(g.faseKort, 'Productie & controle', 'de korte naam van de huidige fase (production)');
    t.eq(g.faseSleutel, 'production', 'de kale sleutel reist mee');
    t.eq(g.faseIndex, 5, 'Fase 5 …');
    t.eq(g.faseTotaal, 6, '… van 6');
    t.eq(g.nodig, 0, 'zonder open werk wacht er niets: nodig is 0');
    t.eq(g.klaar, false, 'het product is niet af');
    t.eq(g.projectId, 'prj-diffuser', 'het project is aanwijsbaar');
    t.eq(g.aantalProducten, 1, 'één product in de bundel');
  }
  {
    const b = diffuserBundel({ klant: { naam: 'Noor van Dijk' } });
    t.eq(P.begroeting(b, NU).naam, 'Noor', 'zonder voornaam: het eerste woord van klant.naam');
  }
  {
    const b = diffuserBundel({ klant: null, client: { contactName: 'Mats Berger' } });
    t.eq(P.begroeting(b, NU).naam, 'Mats', 'client.contactName (de sessievorm van portal.html) werkt ook');
  }
  {
    const b = diffuserBundel({ klant: null, contactName: '  Lotte   Meijer ' });
    t.eq(P.begroeting(b, NU).naam, 'Lotte', 'contactName op de bundel, met rommelige spaties');
  }
  {
    const b = diffuserBundel({ klant: null });
    t.eq(P.begroeting(b, NU).naam, '', 'zonder naam blijft naam leeg — geen verzonnen naam');
  }
  {
    /* één open factuur = één ding dat wacht */
    const b = diffuserBundel({ invoices: [
      { id: 'inv-04', projectId: 'prj-diffuser', label: '15% — pre-shipment QC', amountCents: 187500, currency: 'EUR', status: 'open', createdAt: '2026-08-27' }
    ] });
    t.eq(P.begroeting(b, NU).nodig, 1, 'één open factuur: nodig is 1');
  }
  {
    /* open factuur + fase op akkoord = twee dingen */
    const b = diffuserBundel({ invoices: [
      { id: 'inv-04', projectId: 'prj-diffuser', amountCents: 187500, currency: 'EUR', status: 'open', createdAt: '2026-08-27' }
    ] });
    b.stages[4].status = 'awaiting_approval';
    const g = P.begroeting(b, NU);
    t.eq(g.nodig, 2, 'open factuur én fase op akkoord: nodig is 2');
    t.eq(g.faseKort, 'Productie & controle', 'een fase die op akkoord wacht is nog steeds de huidige fase');
  }
  {
    const b = diffuserBundel({ invoices: [
      { id: 'inv-04', projectId: 'prj-diffuser', amountCents: 187500, currency: 'EUR', status: 'paid', paidAt: '2026-08-28', createdAt: '2026-08-27' }
    ] });
    t.eq(P.begroeting(b, NU).nodig, 0, 'een betaalde factuur wacht niet');
  }
  {
    const p = project('prj-geurflacon', 'Amberglazen geurflacon', ['done', 'done', 'done', 'done', 'done', 'done']);
    const g = P.begroeting({ project: p, stages: p.stages, klant: { voornaam: 'Noor' } }, NU);
    t.eq(g.klaar, true, 'alle fases af: klaar');
    t.eq(g.faseKort, '', 'en dan is er geen huidige fase meer');
    t.eq(g.faseIndex, 6, 'faseIndex is dan het totaal');
    t.eq(g.nodig, 0, 'de herbestelsuggestie telt niet als werk');
  }
  {
    const g = P.begroeting({}, NU);
    t.deep({ naam: g.naam, product: g.product, faseKort: g.faseKort, nodig: g.nodig }, { naam: '', product: '', faseKort: '', nodig: 0 },
      'lege bundel: alles leeg en nul, niets klapt');
    t.eq(g.projectId, null, 'lege bundel: geen project');
  }
  t.eq(P.begroeting(null, NU).nodig, 0, 'null: nodig is 0');
  {
    /* de plank zonder open project: het eerste lopende project */
    const arch = project('prj-oud', 'Oud', ['done', 'done', 'done', 'done', 'done', 'done'], { status: 'archived' });
    const a = project('prj-a', 'Kookset', ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
    const g = P.begroeting({ projects: [arch, a], klant: { voornaam: 'Mats' } }, NU);
    t.eq(g.product, 'Kookset', 'op de plank slaat een gearchiveerd project over');
    t.eq(g.faseKort, 'Ontwerp', 'kookset zit in concept → Ontwerp');
    t.eq(g.aantalProducten, 2, 'maar beide producten worden geteld');
  }
  {
    /* stageLabel via opties wordt gebruikt voor een onbekende fase */
    const p = project('prj-x', 'X', ['done', 'done', 'done', 'done', 'done', 'done']);
    p.stages.push({ stageKey: 'extra', position: 7, status: 'current' });
    const g = P.begroeting({ project: p, stages: p.stages }, NU, { stageLabel: function (k) { return 'Lang ' + k; } });
    t.eq(g.faseKort, 'Lang extra', 'een onbekende fase krijgt de lange naam van opties.stageLabel');
  }

  /* ============================================================
     7. factuurStatusVoorKlant — de toon van advies 27
     ============================================================ */
  t.group('factuurStatusVoorKlant: toon');

  const TONEN_BEKEND = ['ok', 'warn', 'crit', 'info', 'muted'];
  function st(inv, opties) { return P.factuurStatusVoorKlant(inv, NU, opties); }
  const basis = { id: 'inv-1', projectId: 'prj-diffuser', amountCents: 187500, currency: 'EUR', createdAt: '2026-08-01' };

  t.eq(st(Object.assign({}, basis, { status: 'paid', statusCode: 'paid' })).toon, 'muted', 'Betaald tekent grijs (muted)');
  t.eq(st(Object.assign({}, basis, { status: 'paid', statusCode: 'paid' })).woord, 'Betaald', '… en zegt nog steeds Betaald');
  t.eq(st(Object.assign({}, basis, { status: 'open', statusCode: 'sent' }), { gemeld: true }).toon, 'muted', 'Gemeld tekent grijs (muted)');
  t.eq(st(Object.assign({}, basis, { status: 'open', statusCode: 'sent' }), { gemeld: true }).woord, 'Gemeld', '… en zegt Gemeld');
  t.eq(st(Object.assign({}, basis, { statusCode: 'credited', creditedCents: 187500 })).toon, 'muted', 'gecrediteerd leest als Betaald en tekent dus ook grijs');
  t.eq(st(Object.assign({}, basis, { status: 'open', statusCode: 'sent' })).toon, 'warn', 'Open houdt zijn kleur (warn)');
  t.eq(st(Object.assign({}, basis, { status: 'open', statusCode: 'overdue', dueDate: '2026-08-01' })).toon, 'warn', 'te laat is Open met warn');
  t.eq(st(Object.assign({}, basis, { status: 'open', statusCode: 'partially_paid', paidCents: 50000 })).toon, 'warn', 'deels betaald is Open met warn');
  t.eq(st(Object.assign({}, basis, { status: 'open', statusCode: 'disputed' })).toon, 'info', 'Bezwaar houdt zijn kleur (info)');
  t.eq(st(Object.assign({}, basis, { status: 'void', statusCode: 'cancelled' })).toon, 'muted', 'geannuleerd blijft grijs');
  t.eq(st(Object.assign({}, basis, { publishStatus: 'concept', statusCode: 'draft' })).toon, 'muted', 'concept blijft grijs');
  ['paid', 'sent', 'overdue', 'disputed', 'cancelled', 'credited', 'draft', 'partially_paid'].forEach(function (code) {
    const s = st(Object.assign({}, basis, { statusCode: code, dueDate: '2026-08-01' }));
    t.true(TONEN_BEKEND.indexOf(s.toon) >= 0, code + ': de toon (' + s.toon + ') is er een die de TOON-tabellen van de schermen kennen');
  });
  t.false(['paid', 'credited'].some(function (code) { return st(Object.assign({}, basis, { statusCode: code })).toon === 'ok'; }),
    'de toon ok komt niet meer voor: alleen Open en Bezwaar houden kleur');
}
