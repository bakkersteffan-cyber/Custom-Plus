/* CUSTOM+ — tests voor portal/admin-model.js.
   Draaien: node test/run.mjs admin
   ------------------------------------------------------------------
   admin-model.js is de reken- en regellaag van de nieuwe beheerindeling.
   Er staat geen scherm in en dus ook geen enkele visuele controle: wat
   hier faalt is een verkeerd geteld badgecijfer, een deeplink die na F5
   ergens anders landt, of een item dat twee keer in de werkvoorraad staat.

   VIER DINGEN DIE DEZE TESTS BEWAKEN EN DIE STIL KUNNEN BREKEN

   1. DE KLOK IS EEN PARAMETER, GEEN OMGEVING. Elke functie die "nu" nodig
      heeft krijgt hier een vaste nowIso mee. Sluipt er ooit een Date.now()
      terug in het bestand, dan blijven de meeste tests groen maar gaat de
      snoozetest bewust kapot: die zet de klok in 2020 en verwacht een
      antwoord dat met de echte kalender niet kan kloppen.

   2. DE ONTDUBBELING CONCEPTFACTUUR ↔ FACTUURDOCUMENT. Eén conceptfactuur
      genereert een documentrij die óók de conceptstand draagt. Telt die
      twee keer, dan telt de Inbox-badge werk dat één keer bestaat. Dat is
      de belangrijkste test in dit bestand en hij staat in zijn eigen groep.

   3. DE AFSPRAAK "GEEN VERZONNEN DEADLINE". nextDateFor() geeft null als er
      geen enkele echte bron is. Wie daar ooit een gok van maakt (aanmaak +
      30, of vandaag + 7) laat het scherm een datum tonen die de database
      niet kent — beslissing 2.5 van het migratieplan verbiedt dat expliciet.

   4. NIETS WAT ZICHTBAAR IS, IS VERZONNEN OF ENGELS. Een fasenaam komt uit
      de tabel van de aanroeper en nooit uit de rekenlaag; een onmogelijke
      datum wordt lege tekst en nooit het woord "undefined"; een tab wordt
      via tabOf() gelezen en niet per scherm opnieuw uit het pad of de query
      gevist; en `raw` is overal de canonieke vorm, met de letterlijk
      getypte hash in het aparte veld `ingevoerd`. Dat zijn de reparaties van
      de fase-1-fixronde en ze hebben hier elk hun eigen groep, zodat ze niet
      stilletjes terug kunnen komen.

   5. DE KLANTACTIES UIT MIGRATIE 0021 ZIJN ÉÉN KEER WERK. Een gemelde
      betaling, een bestand van de klant, een gevraagde aanpassing op een
      sample en een bezwaar op een factuur zijn Inbox-items die op mij
      wachten (hoofdstuk 2 van .claude/portaal-spec.md). Elk wordt één keer
      geteld — een ronde met een klantbeslissing mag niet óók nog als "wacht
      op de klant" staan — en in de tijdlijn staat de tweeling die
      portaal_log() in twee logtabellen schrijft één keer. De groepen 11, 12
      en 13 onderaan bewaken dat, met de veldnamen van demo-data-portaal.js.

   Alle datums hieronder zijn kale 'YYYY-MM-DD'-dagen zonder tijdzone.
   Dat is bewust: dateParts() leest die letterlijk, dus deze tests geven in
   Amsterdam dezelfde uitkomst als in een CI-machine op UTC.
   ------------------------------------------------------------------ */
import '../portal/admin-model.js';

const M = globalThis.CP_MODEL;

/* De vaste klok van dit bestand: zondag 30 augustus 2026. */
const NU = '2026-08-30';

/* ids uit een lijst halen, zodat een volgorde leesbaar te vergelijken is */
function ids(rows) {
  return (rows || []).map(function (r) { return r && r.id; });
}

/* één item uit een Inbox-lijst opzoeken; de volgorde van collectInbox is
   getest, maar de chiptests mogen er niet van afhangen */
function pick(items, kind, id) {
  const hit = (items || []).filter(function (it) { return it.kind === kind && it.id === id; });
  return hit.length ? hit[0] : null;
}

/* de chip van één item, of een leesbaar antwoord als het item ontbreekt —
   'ONTBREEKT' leest bij een rode test prettiger dan een TypeError */
function chipOf(items, kind, id) {
  const it = pick(items, kind, id);
  return it ? it.chip : 'ONTBREEKT';
}

export default function (t) {

  /* ============================================================
     0. DE EXPORTTABEL IS DE HELE API

     Staat een functie niet in de export, dan bestaat hij voor een scherm
     niet en bouwt dat scherm hem vroeg of laat na. Precies zo ontstond de
     kopie van invoiceDueISO() in de ontwikkelpagina, en die kopie miste de
     tak `inv.invoiceDueISO` al: twee vervaldatums voor dezelfde factuur.
     Deze lijst is dus geen formaliteit maar de enige bewaking op dat soort
     tweede waarheid. Komt er een functie bij, dan hoort hij hier én in het
     kopblok van admin-model.js.
     ============================================================ */
  t.group('de export is de hele API');

  const API = [
    'VERSION',
    'AREAS', 'parseRoute', 'buildRoute', 'routeEquals', 'tabOf',
    'legacyViewToRoute', 'routeToLegacyView', 'LEGACY_VIEW_NAMES',
    'OWNERS', 'itemKey', 'ownerOf', 'doorKlant', 'isSnoozed', 'snoozedUntil', 'isPinned', 'isChasing',
    'INBOX_CHIPS', 'collectInbox', 'filterInbox', 'inboxBadgeCount',
    'REORDER_STAGES', 'reorderPipelineOf',
    'answerDeadlineISO', 'invoiceDueISO', 'isConceptRow',
    'PROJECT_CHIPS', 'filterProjects', 'sortProjects', 'nextDateFor', 'isArchived', 'isFinished',
    'ACTIVITY_KINDS', 'mergeActivity',
    'daysBetween', 'relativeDay', 'formatDate', 'formatDateTime', 'dayISO', 'dateParts'
  ];
  API.forEach(function (naam) {
    t.true(Object.prototype.hasOwnProperty.call(M, naam),
      'de export bevat ' + naam + ' — ontbreekt hij, dan bouwt een scherm hem na en loopt die kopie weg van het origineel');
  });
  t.deep(Object.keys(M).slice().sort(), API.slice().sort(),
    'en er staat niets in de export dat hier niet genoemd wordt: deze lijst, de exporttabel en het kopblok van admin-model.js horen dezelfde drie te zijn');

  /* ============================================================
     1. ROUTES — DE VORM VAN EEN PAD

     De grammatica verschilt per werkgebied: bij Projecten en Factuur is het
     tweede segment een id, bij Relaties is het een deelverzameling en bij
     Instellingen is het de tab zelf. Zonder dat onderscheid past
     '#/relaties/klanten/cl-2/facturen' niet in {area, id, tab}.
     ============================================================ */
  t.group('routes: vorm');

  {
    const r = M.parseRoute('#/overzicht');
    t.eq(r.area, 'overzicht', 'kaal werkgebied levert alleen een area op');
    t.eq(r.id, null, 'Overzicht kent geen entiteit');
    t.eq(r.tab, null, 'Overzicht kent geen tab');
    t.deep(r.params, {}, 'zonder vraagteken zijn er geen parameters');
  }
  {
    const r = M.parseRoute('#/inbox');
    t.eq(r.area, 'inbox', 'Inbox zonder chip is een geldige route');
    t.eq(r.tab, null, 'de Inbox stuurt via parameters, niet via een tab');
  }
  {
    const r = M.parseRoute('#/inbox?chip=nieuw&item=q-3');
    t.eq(r.area, 'inbox', 'de chip zit in de parameters en niet in het pad');
    t.deep(r.params, { chip: 'nieuw', item: 'q-3' }, 'chip en geselecteerd item overleven allebei als parameter');
  }
  {
    const r = M.parseRoute('#/projecten');
    t.eq(r.area, 'projecten', 'de projectenlijst is de kale vorm van het werkgebied');
    t.eq(r.id, null, 'zonder tweede segment is er geen project geselecteerd');
  }
  {
    const r = M.parseRoute('#/projecten/pr-1');
    t.eq(r.id, 'pr-1', 'bij Projecten is het tweede segment een project-id, geen tab');
    t.eq(r.tab, null, 'zonder derde segment valt het projectdetail terug op zijn eigen standaardtab');
  }
  {
    const r = M.parseRoute('#/projecten/pr-1/financien');
    t.eq(r.id, 'pr-1', 'projectdetail houdt zijn id vast als er ook een tab staat');
    t.eq(r.tab, 'financien', 'het derde segment is de tab van projectdetail');
  }
  {
    const r = M.parseRoute('#/relaties/klanten');
    t.eq(r.sub, 'klanten', 'bij Relaties is het tweede segment de deelverzameling');
    t.eq(r.id, null, 'de klantenlijst heeft geen geselecteerde klant');
  }
  {
    const r = M.parseRoute('#/relaties/klanten/cl-2/facturen');
    t.eq(r.sub, 'klanten', 'deelverzameling en id staan naast elkaar in het pad');
    t.eq(r.id, 'cl-2', 'het derde segment is de klant');
    t.eq(r.tab, 'facturen', 'het vierde segment is de tab van klantdetail');
  }
  {
    const r = M.parseRoute('#/relaties/fabrieken/fa-1/activiteit');
    t.eq(r.sub, 'fabrieken', 'Fabrieken is de tweede deelverzameling van Relaties');
    t.eq(r.id, 'fa-1', 'fabriekdetail leest zijn id op dezelfde plek als klantdetail');
    t.eq(r.tab, 'activiteit', 'fabriekdetail heeft eigen tabs');
  }
  {
    const r = M.parseRoute('#/financien?tab=concepten');
    t.eq(r.area, 'financien', 'Financiën stuurt zijn tab via een parameter (beslissing 2.2)');
    t.eq(r.tab, null, 'er staat geen tweede segment, dus route.tab blijft leeg');
    t.deep(r.params, { tab: 'concepten' }, 'de tabkeuze staat in de parameters');
  }
  {
    const r = M.parseRoute('#/activiteit');
    t.eq(r.area, 'activiteit', 'Activiteit is een werkgebied zonder entiteiten');
  }
  {
    const r = M.parseRoute('#/instellingen/facturatie');
    t.eq(r.area, 'instellingen', 'Instellingen is een werkgebied zonder entiteiten');
    t.eq(r.tab, 'facturatie', 'daar IS het tweede segment de categorie, dus de tab');
    t.eq(r.id, null, 'een instellingencategorie is geen entiteit en krijgt dus geen id');
  }
  {
    const r = M.parseRoute('#/factuur/inv-9');
    t.eq(r.area, 'factuur', 'de factuureditor is een eigen route en geen tab van Financiën');
    t.eq(r.id, 'inv-9', 'het tweede segment is de factuur');
  }

  t.true(M.AREAS.length === 7, 'de zijbalk kent zeven werkgebieden: vijf primair plus Activiteit en Instellingen');
  t.eq(M.AREAS.filter(function (a) { return a.primary; }).length, 5, 'vijf daarvan staan boven de scheidingslijn');
  t.eq(M.parseRoute('#/factuur/inv-9').area, 'factuur', 'factuur is wel een geldige route maar staat bewust niet in AREAS');

  /* --- DE TAB: TWEE VORMEN, EEN LEZER ---
     Een tab van een ENTITEIT staat in het pad (#/projecten/pr-1/financien),
     een tab van een WERKGEBIED in de query (#/financien?tab=concepten). Dat
     verschil is echt — een werkgebied zonder entiteiten houdt zijn pad vrij —
     maar geen enkel scherm hoort het te kennen. tabOf() is de ENIGE manier
     waarop een consument een tab hoort te lezen; wie het verschil zelf
     uitschrijft leest de helft van de routes stil verkeerd en opent
     '#/financien?tab=concepten' zonder melding op de verkeerde tab. */
  t.group('routes: tabbladen via tabOf');

  t.eq(M.tabOf(M.parseRoute('#/projecten/pr-1/financien')), 'financien',
    'een tab van een entiteit staat in het pad en komt gewoon uit tabOf');
  t.eq(M.tabOf(M.parseRoute('#/relaties/klanten/cl-2/facturen')), 'facturen',
    'ook de tab in het vierde segment van klantdetail leest via dezelfde functie');
  t.eq(M.tabOf(M.parseRoute('#/financien?tab=concepten')), 'concepten',
    'een tab van een werkgebied staat in de query, en tabOf haalt hem daar net zo goed vandaan');
  t.eq(M.tabOf(M.parseRoute('#/instellingen/facturatie')), 'facturatie',
    'bij Instellingen IS het tweede segment de tab; ook dat verschil hoeft een scherm niet te kennen');
  t.eq(M.tabOf(M.parseRoute('#/projecten/pr-1/financien?tab=concepten')), 'financien',
    'staan ze allebei, dan wint de tab uit het PAD: het pad is de route, de query is hooguit een restje van het vorige scherm');
  t.eq(M.tabOf({ area: 'projecten', id: 'pr-1', tab: 'financien', params: { tab: 'concepten' } }), 'financien',
    'diezelfde voorrang geldt voor een routeobject dat een scherm zelf in elkaar zet, niet alleen voor een geparste hash');
  t.eq(M.tabOf(M.parseRoute('#/financien'), 'openstaand'), 'openstaand',
    'staat er geen tab, dan komt de terugval van de aanroeper terug: zo hoeft geen scherm zijn standaardtab twee keer op te schrijven');
  t.eq(M.tabOf(M.parseRoute('#/financien')), null,
    'zonder tab én zonder terugval is het antwoord null, en niet een lege tekst die per ongeluk als tabsleutel doorgaat');
  t.eq(M.tabOf(M.parseRoute('#/financien?tab='), 'openstaand'), 'openstaand',
    'een lege tabparameter telt als geen keuze en valt dus ook terug');
  t.eq(M.tabOf(null, 'overzicht'), 'overzicht', 'geen route is ook geen tab: de terugval wint en er klapt niets');
  t.eq(M.tabOf(undefined), null, 'zonder route en zonder terugval blijft het null');
  t.eq(M.tabOf('#/financien?tab=CONCEPTEN'), 'concepten',
    'een kale hash mag ook rechtstreeks mee, en een tab uit de query komt in kleine letters terug');
  t.eq(M.tabOf('#/projecten/pr-1/FINANCIEN'), 'financien',
    'een tab uit het pad komt óók in kleine letters terug, zodat een scherm zijn tabsleutels op één manier mag vergelijken');

  /* --- TWEE TEKSTVELDEN, EEN BETEKENIS PER VELD ---
     raw is ALTIJD de canonieke vorm (raw === buildRoute(route)), zodat twee
     routes met dezelfde betekenis ook dezelfde tekst dragen. De letterlijk
     ingetypte hash zit in `ingevoerd`. Eerder betekende raw per functie iets
     anders — parseRoute gaf de invoer terug, finishRoute de opgeschoonde
     vorm — en kreeg een scherm dus soms '#/INBOX' en soms '#/inbox' te zien
     voor precies dezelfde bestemming. */
  t.group('routes: raw is canoniek, ingevoerd is de invoer');

  {
    const r = M.parseRoute('#/INBOX');
    t.eq(r.raw, '#/inbox', 'raw is de opgeschoonde vorm: hoofdletters in de adresbalk leveren dezelfde canonieke tekst op');
    t.eq(r.ingevoerd, '#/INBOX', 'ingevoerd houdt de letterlijke invoer vast, voor het scherm dat wil tonen wat er getypt is');
    t.eq(r.area, 'inbox', 'en het werkgebied zelf is gewoon gevonden');
    t.eq(r.raw, M.buildRoute(r), 'raw is per definitie buildRoute(route) en geen tweede berekening');
  }
  {
    const r = M.parseRoute('#/Projecten//PR-1/Financien');
    t.eq(r.raw, '#/projecten/PR-1/financien',
      'een slordig pad (dubbele schuine streep, hoofdletters) wordt in raw opgeruimd; alleen het id houdt zijn eigen schrijfwijze, want dat is een sleutel');
    t.eq(r.ingevoerd, '#/Projecten//PR-1/Financien', 'de slordige vorm blijft ongewijzigd in ingevoerd staan');
  }
  t.eq(M.parseRoute('#/onzin').raw, '#/overzicht',
    'een onbekend werkgebied heeft als canonieke vorm de route waar je écht landt, want daar staat het scherm');
  t.eq(M.parseRoute('#/onzin').ingevoerd, '#/onzin',
    'maar de getypte tekst blijft bewaard: dát is wat het scherm "Onbekend werkgebied" moet tonen');
  t.eq(M.parseRoute('').ingevoerd, '', 'een lege hash geeft lege ingevoerde tekst');
  t.eq(M.parseRoute(null).ingevoerd, '', 'null als hash wordt lege tekst, zodat een scherm er zonder controle mee kan werken');
  t.eq(M.legacyViewToRoute({ name: 'log' }).ingevoerd, null,
    'een route die uit een oude viewnaam komt is nooit ingetypt; null is eerlijker dan de canonieke vorm daar nog eens neerzetten');
  t.eq(M.legacyViewToRoute({ name: 'log' }).raw, '#/activiteit', 'raw is daar wél gevuld, en ook daar canoniek');

  /* --- een hash die nergens op slaat mag nooit een leeg scherm geven --- */
  t.group('routes: onbekende en lege hash');
  ['', '#', '#/', '#/onzin'].forEach(function (h) {
    const r = M.parseRoute(h);
    t.eq(r.area, 'overzicht', 'hash ' + JSON.stringify(h) + ' landt op Overzicht in plaats van te klappen');
    t.eq(r.id, null, 'hash ' + JSON.stringify(h) + ' laat geen id achter');
    t.eq(r.tab, null, 'hash ' + JSON.stringify(h) + ' laat geen tab achter');
  });
  t.deep(M.parseRoute('#/onzin/diep?a=1').params, {},
    'parameters van een niet-bestaande route worden weggegooid: ze zijn geen state van Overzicht');
  t.eq(M.parseRoute(null).area, 'overzicht', 'null als hash geeft Overzicht en geen uitzondering');
  t.eq(M.parseRoute(undefined).area, 'overzicht', 'undefined als hash geeft Overzicht en geen uitzondering');
  t.eq(M.buildRoute({ area: 'zomaar' }), '#/overzicht', 'buildRoute van een onbekend werkgebied valt terug op Overzicht');
  t.eq(M.buildRoute(null), '#/overzicht', 'buildRoute zonder route geeft de startpagina');

  /* --- de rondreis: wat het scherm schrijft moet het scherm terugkrijgen --- */
  t.group('routes: rondreis');

  const VORMEN = [
    '#/overzicht',
    '#/inbox',
    '#/inbox?chip=nieuw&item=q-3',
    '#/projecten',
    '#/projecten/pr-1',
    '#/projecten/pr-1/financien',
    '#/relaties/klanten',
    '#/relaties/klanten/cl-2/facturen',
    '#/relaties/fabrieken/fa-1/activiteit',
    '#/financien?tab=concepten',
    '#/activiteit',
    '#/instellingen/facturatie',
    '#/factuur/inv-9'
  ];
  VORMEN.forEach(function (h) {
    t.eq(M.buildRoute(M.parseRoute(h)), h, 'rondreis: ' + h + ' komt letterlijk terug uit buildRoute(parseRoute(h))');
    t.eq(M.parseRoute(h).raw, h,
      'raw: ' + h + ' is al canoniek, dus parseRoute schrijft hem letterlijk zo in raw — geen enkele route heeft twee schrijfwijzen');
  });

  t.eq(M.buildRoute({ area: 'inbox', params: { item: 'q-3', chip: 'nieuw', a: '1' } }), '#/inbox?a=1&chip=nieuw&item=q-3',
    'parameters worden alfabetisch geschreven, zodat dezelfde route altijd dezelfde tekst geeft');
  t.eq(M.buildRoute({ area: 'inbox', params: { chip: 'nieuw', item: null, sel: undefined } }), '#/inbox?chip=nieuw',
    'een parameter zonder waarde verdwijnt in plaats van als "null" in de adresbalk te belanden');
  t.eq(M.buildRoute(M.parseRoute('#/inbox?item')), '#/inbox?item',
    'een kale sleutel zonder = overleeft de rondreis als kale sleutel');
  t.deep(M.parseRoute('#/inbox?item').params, { item: '' }, 'een kale sleutel leest terug als lege waarde');
  t.true(M.routeEquals('#/inbox?chip=nieuw&item=q-3', { area: 'inbox', params: { item: 'q-3', chip: 'nieuw' } }),
    'routeEquals kijkt naar de betekenis, niet naar de schrijfvolgorde van de parameters');
  t.false(M.routeEquals('#/inbox', '#/overzicht'), 'twee verschillende werkgebieden zijn niet gelijk');

  {
    /* Zoeken en filteren zetten vrije tekst in de adresbalk. Een spatie,
       een ampersand of een accent mag daar niet sneuvelen: de ampersand is
       de scheider tussen parameters en zou de rest van de query opeten. */
    const bijzonder = {
      zoek: 'blauw & wit',
      naam: 'café crème',
      vrij: 'twee woorden',
      plus: 'a+b',
      schuin: 'a/b',
      vraag: 'wat?'
    };
    const h = M.buildRoute({ area: 'inbox', params: bijzonder });
    t.deep(M.parseRoute(h).params, bijzonder, 'spatie, ampersand, accent, plus, schuine streep en vraagteken overleven de rondreis');
    t.eq(M.buildRoute(M.parseRoute(h)), h, 'en de geschreven vorm van die parameters is ook nog stabiel');
    t.eq(h.indexOf('blauw & wit'), -1, 'de ampersand staat gecodeerd in het pad en niet los, anders breekt hij de query');
  }
  {
    const h = M.buildRoute({ area: 'projecten', id: 'pr 1', tab: 'financien' });
    t.eq(M.parseRoute(h).id, 'pr 1', 'een id met een spatie wordt gecodeerd en weer letterlijk teruggelezen');
    t.eq(M.parseRoute(h).tab, 'financien', 'de tab achter zo een id blijft gewoon staan');
  }

  /* --- de compatibiliteitslaag: hier breekt het stil als hij wegvalt --- */
  t.group('routes: oud en nieuw');

  t.eq(M.LEGACY_VIEW_NAMES.length, 12, 'er zijn twaalf oude viewnamen; elke nieuwe route moet er een kunnen teruggeven');

  /* De storage-listener in beheer.html (cross-tab-verversing vanuit
     portal.html) noemt vandaag, aanvragen, wachtrij en questions HARD in de
     code. Valt er hier één weg, dan ververst het beheer stil niet meer. */
  const OUDE_VIEWS = [
    { name: 'vandaag' },
    { name: 'aanvragen' },
    { name: 'wachtrij' },
    { name: 'questions' },
    { name: 'clients' },
    { name: 'client', clientId: 'cl-2' },
    { name: 'factories' },
    { name: 'projects' },
    { name: 'project', projectId: 'pr-1' },
    { name: 'log' },
    { name: 'settings' },
    { name: 'factuur', invoiceId: 'inv-9' }
  ];
  OUDE_VIEWS.forEach(function (view) {
    const heen = M.legacyViewToRoute(view);
    const terug = M.routeToLegacyView(heen);
    t.eq(terug.name, view.name, 'oude view "' + view.name + '" overleeft de omweg via de nieuwe route');
  });
  t.eq(M.routeToLegacyView(M.legacyViewToRoute({ name: 'client', clientId: 'cl-2' })).clientId, 'cl-2',
    'de klant-id gaat mee heen en terug, anders opent het oude scherm de verkeerde klant');
  t.eq(M.routeToLegacyView(M.legacyViewToRoute({ name: 'project', projectId: 'pr-1' })).projectId, 'pr-1',
    'de project-id gaat mee heen en terug');
  t.eq(M.routeToLegacyView(M.legacyViewToRoute({ name: 'factuur', invoiceId: 'inv-9' })).invoiceId, 'inv-9',
    'de factuur-id gaat mee heen en terug');

  t.eq(M.legacyViewToRoute({ name: 'aanvragen' }).raw, '#/inbox?chip=nieuw', 'Aanvragen wordt de Inbox met chip Nieuw');
  t.eq(M.legacyViewToRoute({ name: 'wachtrij' }).raw, '#/inbox?chip=concepten', 'de Wachtrij wordt de Inbox met chip Concepten');
  t.eq(M.legacyViewToRoute({ name: 'questions' }).raw, '#/inbox?chip=wachtopmij', 'Vragen wordt de Inbox met chip Wacht op mij');
  t.eq(M.legacyViewToRoute({ name: 'vandaag' }).raw, '#/overzicht', 'Vandaag wordt Overzicht');
  t.eq(M.legacyViewToRoute({ name: 'log' }).raw, '#/activiteit', 'het Logboek wordt Activiteit');

  /* DE ENIGE DEEPLINK DIE HET BEHEER KENT. Precies één plek roept
     go({name:'settings'}) aan: de knop "Go-live-checklist" in
     openModeStatusModal, het venster achter de Demo-badge. In de oude
     indeling was Instellingen één pagina en rolde renderSettings() daarna
     naar de checklist; in de nieuwe indeling zijn het negen routes en staat
     de checklist onder Integraties. Zonder tab landde die knop op de
     categorieënpagina — een raster van negen kaarten waar het woord
     checklist nergens op staat. */
  t.eq(M.legacyViewToRoute({ name: 'settings' }).raw, '#/instellingen/integraties?focus=golive',
    'de go-live-deeplink landt op de checklist zelf en niet op de categorieënpagina');
  t.eq(M.legacyViewToRoute({ name: 'settings' }).tab, 'integraties',
    'de categorie zit in het pad, want daar leest instellingCategorie hem met tabOf()');
  t.eq(M.legacyViewToRoute({ name: 'settings' }).params.focus, 'golive',
    'en de focuswens reist als parameter mee: settingsFocusGoLive is een var binnen het afgesloten scriptblok van beheer.html en voor een scherm dus onbereikbaar');
  t.eq(M.routeToLegacyView('#/instellingen/integraties?focus=golive').name, 'settings',
    'terug is het gewoon weer de oude viewnaam settings, zodat de cross-tab-verversing blijft werken');
  t.eq(M.legacyViewToRoute('clients').raw, '#/relaties/klanten', 'een kale viewnaam als string werkt net zo goed als een object');
  t.eq(M.legacyViewToRoute({ name: 'factuur', projectId: 'pr-1' }).raw, '#/factuur/nieuw?project=pr-1',
    'een nieuwe factuur zonder id houdt zijn project als parameter, zodat de route deelbaar en verversbaar blijft');
  t.eq(M.routeToLegacyView('#/financien').name, 'vandaag',
    'Financiën heeft geen oud scherm; Vandaag is de enige oude view die openstaand geld toont');
  t.eq(M.routeToLegacyView('#/relaties/fabrieken/fa-1').name, 'factories',
    'er bestaat geen oud fabriekdetailscherm, dus de lijst is het dichtstbijzijnde eerlijke antwoord');
  t.eq(M.routeToLegacyView({ area: 'inbox', params: { chip: 'goedkeuringen' } }).name, 'questions',
    'een chip zonder eigen oud scherm valt terug op questions, want dat is een naam waarop de storage-listener ververst');
  t.eq(M.legacyViewToRoute({ name: 'bestaat-niet' }).raw, '#/overzicht', 'een onbekende oude viewnaam landt op Overzicht');

  /* ============================================================
     2. WIE IS AAN ZET

     Drie bronnen in vaste voorrang (beslissing 2.4): expliciet gezet,
     dan structureel, dan de rest is van mij.
     ============================================================ */
  t.group('wie is aan zet');

  const FASE = { kind: 'fase', id: 'pr-1:sampling', status: 'awaiting_approval' };
  const SAMPLE = { kind: 'sample', id: 'smp-2', status: 'reviewed' };
  const VRAAG = { kind: 'vraag', id: 'q-1' };

  t.eq(M.itemKey('fase', 'pr-1:sampling'), 'stage:pr-1:sampling',
    'de sleutel van een fase is stage:<projectId>:<stageKey> — precies zoals computeSignals hem al schrijft');
  t.eq(M.itemKey('vraag', 'q-1'), 'q:q-1', 'de sleutel van een vraag blijft q: — elke bestaande snooze hangt eraan');
  t.eq(M.itemKey('factuur', 'inv-1'), 'inv:inv-1', 'de sleutel van een factuur blijft inv:');
  t.eq(M.itemKey('zending', 'sh-1'), 'ship:sh-1', 'de sleutel van een zending blijft ship:');
  t.eq(M.itemKey('sample', 'smp-2'), 'smp:smp-2', 'de sleutel van een sampleronde blijft smp:');
  t.eq(M.itemKey('onbekend', 'x-1'), 'x-1', 'een itemtype zonder voorvoegsel levert het kale id op en geen "undefined:x-1"');

  t.eq(M.ownerOf(FASE, { 'stage:pr-1:sampling': { owner: 'fabriek' } }), 'fabriek',
    'een expliciet gezette eigenaar wint van de structurele regel dat een fase op akkoord bij de klant ligt');
  t.eq(M.ownerOf(FASE, { 'stage:pr-1:sampling': { owner: 'mij' } }), 'mij',
    'expliciet "mij" wint óók van de structurele regel — anders kun je een fase nooit naar je toe trekken');
  t.eq(M.ownerOf(FASE, {}), 'klant',
    'een fase op akkoord is zonder itemState al van de klant: dat is de structurele regel, geen instelling');
  t.eq(M.ownerOf(FASE, { 'stage:pr-1:sampling': { owner: 'niemand' } }), 'klant',
    'een onbekende eigenaarswaarde wordt genegeerd en valt terug op de structurele regel');
  t.eq(M.ownerOf(SAMPLE, {}), 'klant', 'een beoordeelde sampleronde wacht per definitie op een keuze van de klant');
  t.eq(M.ownerOf({ kind: 'sample', id: 'smp-2', status: 'chosen' }, {}), 'mij',
    'een sampleronde die al gekozen is wacht niet meer op de klant en valt terug op mij');
  t.eq(M.ownerOf(VRAAG, {}), 'mij', 'alles wat overblijft ligt bij mij — dat is de standaard, niet een opgeslagen waarde');
  t.eq(M.ownerOf(null, {}), 'mij', 'een leeg item geeft "mij" en geen uitzondering');
  t.eq(M.ownerOf(FASE, null), 'klant', 'ontbrekende itemState mag niet klappen');
  t.eq(M.ownerOf({ kind: 'fase', id: 'x', raw: { status: 'awaiting_approval' } }, {}), 'klant',
    'de status mag ook in .raw zitten: een ruw signaalitem draagt hem daar');
  t.eq(M.ownerOf({ kind: 'vraag', id: 'q-1', key: 'q:anders' }, { 'q:anders': { owner: 'fabriek' } }), 'fabriek',
    'een item met een eigen .key gebruikt die sleutel en niet de afgeleide');

  /* --- snooze leest de MEEGEGEVEN klok, niet de echte ---
     De data hieronder staat in 2020. Zou isSnoozed stiekem new Date()
     gebruiken, dan is elke terugkeerdatum allang gepasseerd en slaat de
     eerste assertie om. */
  const SNOOZE_2020 = { 'q:q-9': { snoozedUntil: '2020-01-02', pinned: true } };
  const ITEM_Q9 = { kind: 'vraag', id: 'q-9' };
  t.true(M.isSnoozed(ITEM_Q9, SNOOZE_2020, '2020-01-01'),
    'een snooze tot morgen geldt vandaag — en "vandaag" is 1 januari 2020 omdat de test dat zegt, niet de echte klok');
  t.false(M.isSnoozed(ITEM_Q9, SNOOZE_2020, '2020-01-03'),
    'diezelfde snooze geldt overmorgen niet meer, met exact dezelfde opgeslagen data');
  t.false(M.isSnoozed(ITEM_Q9, SNOOZE_2020, '2020-01-02'),
    'op de terugkeerdatum zelf is het item terug: de vergelijking is strikt groter dan');
  t.eq(M.snoozedUntil(ITEM_Q9, SNOOZE_2020), '2020-01-02',
    'snoozedUntil geeft de opgeslagen datum ongeacht of hij al gepasseerd is');
  t.true(M.isSnoozed(ITEM_Q9, { 'q:q-9': { snoozedUntil: '2020-01-02T23:59:00Z' } }, '2020-01-01'),
    'een terugkeerdatum met tijdstempel wordt op de dag afgekapt en niet als onvergelijkbaar afgeserveerd');
  t.false(M.isSnoozed(ITEM_Q9, {}, NU), 'zonder opgeslagen staat is niets gesnoozed');
  t.false(M.isSnoozed(ITEM_Q9, null, NU), 'ontbrekende itemState is geen snooze en geen uitzondering');
  t.true(M.isPinned(ITEM_Q9, SNOOZE_2020), 'pin leest uit dezelfde sleutel als snooze');
  t.false(M.isPinned(ITEM_Q9, {}), 'zonder opgeslagen staat is niets gepind');

  /* --- najagen: de bal ligt langer dan drie dagen bij de fabriek --- */
  function chasing(since, now, owner) {
    return M.isChasing(ITEM_Q9, { 'q:q-9': { owner: owner || 'fabriek', ownerSince: since } }, now);
  }
  t.true(chasing('2026-08-24', NU), 'zes dagen bij de fabriek is najagen');
  t.true(chasing('2026-08-26', NU), 'vier dagen bij de fabriek is najagen: de grens is meer dan drie');
  t.false(chasing('2026-08-27', NU), 'precies drie dagen is nog geen najagen');
  t.false(chasing('2026-08-28', NU), 'twee dagen bij de fabriek is gewoon wachten');
  t.false(chasing('2026-01-01', NU, 'klant'), 'najagen geldt alleen voor de fabriek, niet voor een klant die lang stil is');
  t.false(chasing(null, NU), 'zonder ownerSince is er niets om ouderdom uit af te leiden');

  /* ============================================================
     3. INBOX — WELK ITEMTYPE KRIJGT WELKE CHIP

     Onderstaande bron is een doorsnee werkdag: twee lopende projecten en
     één archiefproject, met van elk itemtype minstens één rij.
     ============================================================ */
  t.group('inbox: chips per itemtype');

  const BRON = {
    now: NU,
    projects: [
      { id: 'pr-1', clientId: 'cl-1', name: 'Kussenhoezen', status: 'active', createdAt: '2026-05-01' },
      { id: 'pr-2', clientId: 'cl-2', name: 'Theedoeken', status: 'active', createdAt: '2026-06-01' },
      { id: 'pr-9', clientId: 'cl-3', name: 'Afgesloten reeks', status: 'archived', createdAt: '2025-01-01' }
    ],
    briefs: [
      { id: 'req-1', status: 'nieuw', product: 'Katoenen tas', name: 'Anna', email: 'anna@x.nl', createdAt: '2026-08-25' },
      { id: 'req-2', status: 'omgezet', product: 'Servetten', createdAt: '2026-07-01' }
    ],
    questions: [
      { id: 'q-1', projectId: 'pr-1', question: 'Welke kleur garen?', askedAt: '2026-08-28' },
      { id: 'q-2', projectId: 'pr-1', question: 'HERBESTELLING: 200 stuks', askedAt: '2026-08-27' },
      { id: 'q-3', projectId: 'pr-2', question: 'Klopt de maat?', askedAt: '2026-08-20', answeredAt: '2026-08-21' },
      { id: 'q-4', projectId: 'pr-2', question: 'Is de proef akkoord?', askedAt: '2026-08-26' }
    ],
    stages: [
      { projectId: 'pr-1', stageKey: 'sampling', status: 'awaiting_approval' },
      { projectId: 'pr-9', stageKey: 'sampling', status: 'awaiting_approval' },
      { projectId: 'pr-2', stageKey: 'productie', status: 'in_progress' }
    ],
    invoices: [
      { id: 'inv-1', projectId: 'pr-1', publishStatus: 'concept', status: 'concept', invoiceNumber: '2026-014', label: 'Aanbetaling', createdAt: '2026-08-24', documentId: 'doc-1' },
      { id: 'inv-2', projectId: 'pr-2', publishStatus: 'published', status: 'open', invoiceNumber: '2026-013', label: 'Slottermijn', createdAt: '2026-07-15' }
    ],
    drafts: [
      { kind: 'document', row: { id: 'doc-1', title: 'Factuur 2026-014', projectId: 'pr-1', createdAt: '2026-08-24' } },
      { kind: 'media', row: { id: 'med-7', caption: 'Detailfoto', projectId: 'pr-1', createdAt: '2026-08-26' } },
      { kind: 'media', row: { id: 'med-8', caption: 'Sfeerfoto', projectId: 'pr-2', createdAt: '2026-08-27', scheduledAt: '2026-09-05T09:00' } }
    ],
    samples: [
      { id: 'smp-1', projectId: 'pr-2', roundDate: '2026-08-10', roundLabel: '1', status: 'chosen' },
      { id: 'smp-2', projectId: 'pr-2', roundDate: '2026-08-22', roundLabel: '2', status: 'reviewed' },
      { id: 'smp-3', projectId: 'pr-1', roundDate: '2026-07-01', roundLabel: '1', status: 'reviewed' },
      { id: 'smp-4', projectId: 'pr-1', roundDate: '2026-08-05', roundLabel: '2', status: 'chosen' }
    ],
    settings: { itemState: { 'q:q-4': { owner: 'klant' } } }
  };

  const INBOX = M.collectInbox(BRON);

  t.eq(chipOf(INBOX, 'brief', 'req-1'), 'nieuw', 'een site-brief die nog niet omgezet is, is een nieuwe aanvraag');
  t.eq(chipOf(INBOX, 'brief', 'req-2'), 'afgehandeld', 'een site-brief met status omgezet is klaar');
  t.eq(chipOf(INBOX, 'vraag', 'q-1'), 'wachtopmij', 'een open klantvraag wacht op mij');
  t.eq(chipOf(INBOX, 'vraag', 'q-2'), 'nieuw', 'een herbestelling uit Mijn Producten hoort onder Nieuw en niet tussen de klantvragen');
  t.eq(chipOf(INBOX, 'vraag', 'q-3'), 'afgehandeld', 'een beantwoorde vraag is afgehandeld');
  t.eq(chipOf(INBOX, 'vraag', 'q-4'), 'wachtopklant', 'een vraag waarvan de bal expliciet bij de klant ligt, wacht op de klant');
  t.eq(chipOf(INBOX, 'fase', 'pr-1:sampling'), 'goedkeuringen', 'een fase op akkoord staat onder Goedkeuringen');
  t.eq(chipOf(INBOX, 'factuur', 'inv-1'), 'concepten', 'een conceptfactuur staat onder Concepten');
  t.eq(chipOf(INBOX, 'concept', 'med-7'), 'concepten', 'een foto zonder publicatiedatum is een concept');
  t.eq(chipOf(INBOX, 'concept', 'med-8'), 'gepland', 'een foto mét publicatiedatum staat onder Gepland');
  t.eq(chipOf(INBOX, 'sample', 'smp-2'), 'wachtopklant', 'een beoordeelde sampleronde wacht op een keuze van de klant');

  t.eq(pick(INBOX, 'factuur', 'inv-2'), null,
    'een verstuurde factuur hoort in Financiën en niet in de werkvoorraad — anders loopt de Inbox elke maand vol met geld waar geen handeling bij hoort');
  t.eq(pick(INBOX, 'fase', 'pr-2:productie'), null, 'een fase die niet op akkoord staat vraagt niets');
  t.eq(pick(INBOX, 'fase', 'pr-9:sampling'), null, 'een fase op een gearchiveerd project is ruis en valt af');
  t.eq(pick(INBOX, 'sample', 'smp-3'), null,
    'alleen de nieuwste sampleronde per project telt: ronde 1 is verdrongen door ronde 2 en vraagt niets meer');
  t.eq(pick(INBOX, 'sample', 'smp-4'), null, 'de nieuwste ronde van pr-1 is al gekozen, dus er staat niets in de Inbox');

  t.eq(pick(INBOX, 'vraag', 'q-1').owner, 'mij', 'de eigenaar reist mee met het item, zodat het scherm hem niet opnieuw hoeft af te leiden');
  t.eq(pick(INBOX, 'fase', 'pr-1:sampling').owner, 'klant', 'de structurele eigenaar van een fase op akkoord komt mee als klant');
  t.eq(pick(INBOX, 'vraag', 'q-1').clientId, 'cl-1', 'de klant wordt via het project afgeleid, want een vraag draagt hem zelf niet');
  t.eq(pick(INBOX, 'vraag', 'q-1').sub, 'antwoord voor 31 aug 2026',
    'de antwoordklok is ontvangst plus één werkdag: vrijdag 28 augustus wordt maandag 31 augustus');
  t.true(pick(INBOX, 'vraag', 'q-2').urgent, 'een vraag waarvan de antwoordklok verstreken is, is urgent');
  t.false(pick(INBOX, 'vraag', 'q-1').urgent, 'een vraag die morgen pas afloopt is nog niet urgent');
  t.eq(pick(INBOX, 'vraag', 'q-2').title, '200 stuks', 'bij een herbestelling verdwijnt het voorvoegsel HERBESTELLING uit de titel');

  /* ============================================================
     3b. DE VIERSTAPSPIJPLIJN VAN EEN HERBESTELLING

     De stand staat per vraag in settings.reorderPipeline en werd door geen
     enkel nieuw scherm gelezen: de herbestelling landde wel in de bak Nieuw,
     maar zonder pijplijnstand en dus zonder de stap-afhankelijke primaire
     actie. Wat hieronder staat is dat gat, dichtgetimmerd — inclusief de
     enige twee standen waarin een scherm iets zou kunnen verzinnen: geen
     opgeslagen stand, en een opgeslagen stand die niet bestaat.
     ============================================================ */
  t.group('inbox: de pijplijn van een herbestelling');

  t.deep(M.REORDER_STAGES.map(function (s) { return s.key; }),
    ['aanvraag', 'offerte', 'akkoord', 'project'],
    'de vier stappen staan in de volgorde waarin ze doorlopen worden; de sleutels zijn opgeslagen waarden en mogen daarom nooit hernoemd worden');

  t.eq(pick(INBOX, 'vraag', 'q-1').pipeline, null,
    'een gewone klantvraag heeft geen pijplijn, maar het veld staat er wel — een scherm hoeft de soort niet te kennen om it.pipeline te mogen lezen');
  t.eq(pick(INBOX, 'brief', 'req-1').pipeline, null, 'ook een site-brief draagt het veld, leeg');

  {
    /* zonder opgeslagen stand: stap 1. Dat is geen verzonnen stand maar de
       beginstand — een herbestelling die nog nooit is aangeraakt ís een
       aanvraag, precies zoals de bestaande pijplijnrij hem toont. */
    const pl = pick(INBOX, 'vraag', 'q-2').pipeline;
    t.eq(pl.stage, 'aanvraag', 'een herbestelling zonder opgeslagen stand staat op de eerste stap');
    t.eq(pl.label, 'Aanvraag', 'en draagt de Nederlandse naam van die stap');
    t.eq(pl.step, 1, 'stap 1');
    t.eq(pl.total, 4, 'van vier');
    t.eq(pl.index, 0, 'de nulgebaseerde index staat er apart bij, zodat een scherm niet hoeft af te trekken');
    t.deep(pl.steps.map(function (s) { return s.state; }), ['current', 'pending', 'pending', 'pending'],
      'de eerste stap is de huidige en de rest staat open — dezelfde drie standen als de chiprij van de oude Aanvragenpagina');
    t.eq(pl.next.key, 'offerte', 'de volgende stap komt mee, want daar hangt de stap-afhankelijke primaire actie aan');
    t.eq(pl.quoteDocId, null, 'er is nog geen offerteconcept');
    t.eq(pl.projectId, null, 'en nog geen batchproject');
  }

  t.eq(pick(INBOX, 'vraag', 'q-2').sub, 'Herbestelling · stap 1 van 4: Aanvraag · antwoord voor 28 aug 2026',
    'de stand staat ook in woorden op de rij: zonder die regel zien twee herbestellingen in verschillende stappen er identiek uit');

  {
    const inOfferte = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: {}, reorderPipeline: { 'q-2': { stage: 'offerte', quoteDocId: 'doc-9' } } }
    }));
    const pl = pick(inOfferte, 'vraag', 'q-2').pipeline;
    t.eq(pl.stage, 'offerte', 'de opgeslagen stand wint van de beginstand');
    t.eq(pl.step, 2, 'offerte is stap 2');
    t.deep(pl.steps.map(function (s) { return s.state; }), ['done', 'current', 'pending', 'pending'],
      'alles vóór de huidige stap is gedaan en alles erna staat open');
    t.eq(pl.next.label, 'Akkoord', 'de volgende klik van de pijplijn is Akkoord ontvangen');
    t.eq(pl.quoteDocId, 'doc-9',
      'het offerteconcept dat stap 2 aanmaakte reist mee, zodat het scherm er rechtstreeks naartoe kan');
    t.eq(pick(inOfferte, 'vraag', 'q-2').sub.indexOf('stap 2 van 4: Offerte') > -1, true,
      'en de regel op de rij verschuift mee');
  }

  {
    const inProject = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: {}, reorderPipeline: { 'q-2': { stage: 'project', projectId: 'pr-77' } } }
    }));
    const pl = pick(inProject, 'vraag', 'q-2').pipeline;
    t.eq(pl.step, 4, 'project is de laatste stap');
    t.eq(pl.next, null, 'op de laatste stap is er geen volgende klik meer, dus ook geen primaire actie om te verzinnen');
    t.eq(pl.projectId, 'pr-77',
      'het batchproject dat stap 4 aanmaakte staat in de pijplijn en niet op het item — item.projectId blijft het project waar de herbestelling bij hoort');
    t.eq(pick(inProject, 'vraag', 'q-2').projectId, 'pr-1',
      'en dat item.projectId is en blijft het oorspronkelijke project');
  }

  {
    const raar = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: {}, reorderPipeline: { 'q-2': { stage: 'geleverd' } } }
    }));
    t.eq(pick(raar, 'vraag', 'q-2').pipeline.stage, 'aanvraag',
      'een opgeslagen stand die niet in de tabel staat valt terug op de eerste stap — hetzelfde wat de bestaande pijplijnrij doet, in plaats van een vijfde stap te tonen die niet bestaat');
  }

  t.eq(M.reorderPipelineOf('', { reorderPipeline: {} }), null, 'zonder vraag-id is er niets op te zoeken');
  t.eq(M.reorderPipelineOf('q-2', null).stage, 'aanvraag', 'zonder instellingen klapt de opzoeking niet, hij begint gewoon bij stap 1');

  t.group('inbox: chips per itemtype');

  {
    /* LET OP — GEMELD ALS INCONSISTENTIE, ZIE HET RAPPORT BIJ DIT BESTAND.
       Fases, conceptfacturen en samplerondes van een gearchiveerd project
       vallen af, maar klantvragen en site-briefs kennen geen archieffilter.
       Dit is geen nieuw gedrag: computeSignals() in beheer.html filtert
       open vragen vandaag ook niet op archief. De assertie legt het huidige
       gedrag vast zodat de keuze zichtbaar is in plaats van toevallig. */
    const opArchief = M.collectInbox(Object.assign({}, BRON, {
      questions: [{ id: 'q-9', projectId: 'pr-9', question: 'Vraag op een archiefproject', askedAt: '2026-08-24' }]
    }));
    t.eq(chipOf(opArchief, 'vraag', 'q-9'), 'wachtopmij',
      'een klantvraag op een gearchiveerd project blijft staan, terwijl een fase op datzelfde project afvalt (gemeld, zie het rapport)');
  }

  /* --- de vaste volgorde: gepind, dan urgent, dan wat het langst wacht --- */
  t.eq(INBOX[0].id, 'q-4', 'urgente items staan bovenaan, en daarbinnen het oudste eerst');
  t.eq(INBOX[INBOX.length - 1].kind, 'fase',
    'een item zonder tijdstempel zakt naar onderen in plaats van bovenaan te blijven plakken');
  t.true(INBOX.every(function (it, i) {
    return i === 0 || !(it.urgent && !INBOX[i - 1].urgent);
  }), 'er staat nooit een urgent item onder een niet-urgent item');

  {
    const gepind = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: { 'q:q-4': { owner: 'klant' }, 'inv:inv-1': { pinned: true } } }
    }));
    t.eq(gepind[0].id, 'inv-1', 'een gepind item gaat boven alles, ook boven een urgente vraag');
    t.true(pick(gepind, 'factuur', 'inv-1').pinned, 'de pin reist mee met het item');
  }

  /* ------------------------------------------------------------------
     DE CHIP VOLGT DE BAL, NIET ALLEEN DE SOORT

     collectInbox zette de chip vroeger uitsluitend op SOORT en alleen de
     klantvraag keek naar de eigenaar. De bal verleggen bij een site-brief
     of een concept veranderde daardoor wél de badge en wél de statuspil op
     de rij, maar niet de bak waarin het item viel: de chip "Wacht op klant"
     bevatte nooit een aanvraag of een concept, terwijl zijn naam dat wel
     belooft.

     Drie bakken doen bewust niet mee: 'afgehandeld' (daar is de bal
     nergens meer), 'gepland' (daar wacht een klok) en 'goedkeuringen' (dat
     ís wacht-op-klant, maar met een eigen naam en een eigen bak die het
     migratieplan expliciet toewijst).
     ------------------------------------------------------------------ */
  t.group('inbox: de chip volgt de bal');

  const BAL_BIJ_KLANT = M.collectInbox(Object.assign({}, BRON, {
    settings: {
      itemState: {
        'q:q-4': { owner: 'klant' },
        'req:req-1': { owner: 'klant' },
        'cpt:med-7': { owner: 'klant' },
        'inv:inv-1': { owner: 'fabriek' },
        'q:q-2': { owner: 'klant' }
      }
    }
  }));

  t.eq(chipOf(BAL_BIJ_KLANT, 'brief', 'req-1'), 'wachtopklant',
    'een site-brief waarvan de bal bij de klant ligt valt onder Wacht op klant en blijft niet onder Nieuw staan');
  t.eq(chipOf(BAL_BIJ_KLANT, 'concept', 'med-7'), 'wachtopklant',
    'een concept waarvan de bal bij de klant ligt valt onder Wacht op klant en blijft niet onder Concepten staan');
  t.eq(chipOf(BAL_BIJ_KLANT, 'factuur', 'inv-1'), 'wachtopklant',
    'een conceptfactuur die bij de fabriek ligt valt óók onder Wacht op klant: de bak zegt "niet bij mij", niet "bij precies deze partij"');
  t.eq(chipOf(BAL_BIJ_KLANT, 'vraag', 'q-2'), 'wachtopklant',
    'een herbestelling waarvan de bal bij de klant ligt verlaat Nieuw, net als elk ander itemtype');

  t.deep(ids(M.filterInbox(BAL_BIJ_KLANT, 'nieuw')), [],
    'Nieuw is daarna leeg: beide nieuwe aanvragen liggen bij de klant');
  t.deep(ids(M.filterInbox(BAL_BIJ_KLANT, 'concepten')), [],
    'Concepten is daarna leeg: het concept en de conceptfactuur liggen buiten de deur');
  t.deep(ids(M.filterInbox(BAL_BIJ_KLANT, 'wachtopklant')).sort(),
    ['inv-1', 'med-7', 'q-2', 'q-4', 'req-1', 'smp-2'],
    'en Wacht op klant bevat nu wél een aanvraag, een concept en een conceptfactuur — precies wat die chipnaam belooft');
  t.deep(ids(M.filterInbox(BAL_BIJ_KLANT, 'wachtopmij')), ['q-1'],
    'alleen de open klantvraag wacht nog op mij');
  t.eq(M.inboxBadgeCount(BAL_BIJ_KLANT, NU), 1,
    'de badge zakt mee naar één: badge en bak lezen dezelfde eigenaar en kunnen dus niet uit elkaar lopen');

  {
    /* de andere kant op: een bak die "wacht op klant" heet mag een item
       niet vasthouden zodra jij het naar je toe trekt */
    const naarMij = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: { 'q:q-4': { owner: 'klant' }, 'smp:smp-2': { owner: 'mij' } } }
    }));
    t.eq(chipOf(naarMij, 'sample', 'smp-2'), 'wachtopmij',
      'een sampleronde die je expliciet naar je toe trekt valt onder Wacht op mij, ondanks de structurele regel');
    t.eq(M.inboxBadgeCount(naarMij, NU), 6, 'en de badge telt hem dan ook mee: vijf wordt zes');
  }
  {
    const faseNaarMij = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: { 'q:q-4': { owner: 'klant' }, 'stage:pr-1:sampling': { owner: 'mij' } } }
    }));
    t.eq(chipOf(faseNaarMij, 'fase', 'pr-1:sampling'), 'goedkeuringen',
      'een fase op akkoord blijft onder Goedkeuringen staan, ook als je de bal naar je toe trekt: dat is zijn eigen bak, niet een bal-bak');
    t.eq(M.inboxBadgeCount(faseNaarMij, NU), 6,
      'de badge telt hem wél mee, want er ligt dan echt werk voor mij — de bak en de badge spreken elkaar niet tegen, ze beantwoorden een andere vraag');
  }
  {
    const vasteBakken = M.collectInbox(Object.assign({}, BRON, {
      settings: {
        itemState: {
          'q:q-4': { owner: 'klant' },
          'cpt:med-8': { owner: 'klant' },
          'req:req-2': { owner: 'klant' },
          'q:q-3': { owner: 'fabriek' }
        }
      }
    }));
    t.eq(chipOf(vasteBakken, 'concept', 'med-8'), 'gepland',
      'een ingeplande publicatie blijft onder Gepland: daar wacht een klok, en die verandert niet doordat iemand een eigenaar invult');
    t.eq(chipOf(vasteBakken, 'brief', 'req-2'), 'afgehandeld',
      'een omgezette site-brief blijft afgehandeld: bij klaar werk ligt de bal nergens meer');
    t.eq(chipOf(vasteBakken, 'vraag', 'q-3'), 'afgehandeld', 'een beantwoorde vraag idem');
    t.eq(M.inboxBadgeCount(vasteBakken, NU), 5, 'en de badge blijft op vijf staan: er is niets van eigenaar veranderd dat op mij wacht');
  }

  /* --- de bakken en de badge vertellen hetzelfde verhaal ---
     Dit is de controle die eerder is misgegaan: een chip die zijn eigen
     regel kreeg terwijl de badge de oude bleef lezen. De vier lijsten
     hieronder dekken alle vier de standen van de bal. */
  {
    const OPEN_BAKKEN = ['nieuw', 'wachtopmij', 'wachtopklant', 'goedkeuringen', 'concepten', 'gepland'];
    function bak(items, chip) { return M.filterInbox(items, chip); }
    function somVanBakken(items) {
      let n = 0;
      OPEN_BAKKEN.forEach(function (c) { n += bak(items, c).length; });
      return n;
    }
    /* de badge nagerekend uit de bakken in plaats van uit it.owner */
    function badgeUitBakken(items) {
      let n = 0;
      ['nieuw', 'wachtopmij', 'concepten'].forEach(function (c) { n += bak(items, c).length; });
      bak(items, 'goedkeuringen').forEach(function (it) { if (it.owner === 'mij') n++; });
      return n;
    }
    const naarMij = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: { 'q:q-4': { owner: 'klant' }, 'smp:smp-2': { owner: 'mij' } } }
    }));
    const standen = [
      { naam: 'de gewone werkdag', items: INBOX },
      { naam: 'alles bij de klant', items: BAL_BIJ_KLANT },
      { naam: 'een sample naar mij toe getrokken', items: naarMij }
    ];
    standen.forEach(function (s) {
      t.eq(somVanBakken(s.items), M.filterInbox(s.items, 'alles').length,
        'de zes open bakken zijn samen precies Alles (' + s.naam + '): elk item valt in één bak en er valt er geen buiten');
      t.eq(bak(s.items, 'wachtopklant').filter(function (it) { return it.owner === 'mij'; }).length, 0,
        'onder Wacht op klant staat niets dat op mij wacht (' + s.naam + ')');
      t.eq(bak(s.items, 'nieuw').concat(bak(s.items, 'wachtopmij'), bak(s.items, 'concepten'))
        .filter(function (it) { return it.owner !== 'mij'; }).length, 0,
        'en onder Nieuw, Wacht op mij en Concepten staat niets dat buiten de deur ligt (' + s.naam + ')');
      t.eq(badgeUitBakken(s.items), M.inboxBadgeCount(s.items, NU),
        'de badge nagerekend uit de bakken geeft hetzelfde getal als inboxBadgeCount (' + s.naam + ') — precies dit liep eerder uiteen');
    });
  }

  /* ============================================================
     4. INBOX — DE ONTDUBBELING

     DIT IS DE BELANGRIJKSTE TEST VAN DIT BESTAND.
     Een conceptfactuur genereert een documentrij die óók de conceptstand
     draagt. Telt die twee keer, dan telt de badge werk dat één keer bestaat
     en klopt geen enkele telling op Overzicht meer. updateBadge() in
     beheer.html doet dit vandaag identiek; buildProjectsList() en
     renderWachtrij() herhalen dezelfde vier regels nog twee keer los.
     ============================================================ */
  t.group('inbox: ontdubbeling conceptfactuur en factuurdocument');

  const BASIS_DUO = {
    now: NU,
    projects: [{ id: 'pr-1', clientId: 'cl-1', status: 'active' }],
    invoices: [{ id: 'inv-1', projectId: 'pr-1', publishStatus: 'concept', invoiceNumber: '2026-014', label: 'Aanbetaling', createdAt: '2026-08-24', documentId: 'doc-1' }],
    drafts: [{ kind: 'document', row: { id: 'doc-1', projectId: 'pr-1', title: 'Factuur 2026-014', createdAt: '2026-08-24' } }]
  };
  {
    const duo = M.collectInbox(BASIS_DUO);
    t.eq(duo.length, 1, 'een conceptfactuur en haar gegenereerde factuurdocument leveren samen EEN item, niet twee');
    t.eq(duo[0].kind, 'factuur', 'het item dat overblijft is de factuur zelf, want daar zit de handeling');
    t.eq(duo[0].id, 'inv-1', 'en het draagt het factuur-id, zodat een klik in de factuureditor landt');
    t.eq(M.inboxBadgeCount(duo, NU), 1, 'de badge telt dat werk dus ook één keer');
    /* Scherper dan alleen tellen: het item dat VERDWIJNT is het document en
       het item dat BLIJFT is de factuur. Een filter die het precies andersom
       doet houdt er ook maar één over en zou een kale telling overleven. */
    t.eq(duo.filter(function (it) { return it.kind === 'concept'; }).length, 0,
      'de gegenereerde documentrij is degene die weggaat, niet de factuur');
    t.deep(ids(duo), ['inv-1'], 'en wat overblijft draagt het factuur-id en niet het document-id doc-1');
  }
  {
    /* Twee conceptfacturen met elk hun eigen document, plus één los
       document dat bij geen enkele factuur hoort. Een filter die kortweg
       "alle documentconcepten" weggooit houdt hier ook drie items over als
       je alleen telt, maar dan zijn het de verkeerde drie — daarom staan de
       ids er letterlijk. */
    const meer = M.collectInbox({
      now: NU,
      projects: [{ id: 'pr-1', clientId: 'cl-1', status: 'active' }],
      invoices: [
        { id: 'inv-1', projectId: 'pr-1', publishStatus: 'concept', label: 'Aanbetaling', createdAt: '2026-08-24', documentId: 'doc-1' },
        { id: 'inv-3', projectId: 'pr-1', publishStatus: 'concept', label: 'Slottermijn', createdAt: '2026-08-25', documentId: 'doc-3' }
      ],
      drafts: [
        { kind: 'document', row: { id: 'doc-1', projectId: 'pr-1', title: 'Factuur aanbetaling', createdAt: '2026-08-24' } },
        { kind: 'document', row: { id: 'doc-3', projectId: 'pr-1', title: 'Factuur slottermijn', createdAt: '2026-08-25' } },
        { kind: 'document', row: { id: 'doc-5', projectId: 'pr-1', title: 'Losse offerte', createdAt: '2026-08-26' } }
      ]
    });
    t.deep(ids(meer).sort(), ['doc-5', 'inv-1', 'inv-3'],
      'elke conceptfactuur slikt precies HAAR eigen document; een document dat bij geen enkele factuur hoort blijft gewoon staan');
    t.eq(M.inboxBadgeCount(meer, NU), 3, 'de badge telt dus drie stuks werk en niet vijf');
  }
  {
    /* De filter kijkt naar de conceptfacturen die zélf in de Inbox staan.
       Een verstuurde factuur staat er bewust niet in, dus haar document
       dubbelt niets en moet blijven — anders verdwijnt er stil werk. */
    const verstuurd = M.collectInbox({
      now: NU,
      projects: [{ id: 'pr-1', clientId: 'cl-1', status: 'active' }],
      invoices: [{ id: 'inv-2', projectId: 'pr-1', publishStatus: 'published', status: 'open', label: 'Slottermijn', createdAt: '2026-07-15', documentId: 'doc-2' }],
      drafts: [{ kind: 'document', row: { id: 'doc-2', projectId: 'pr-1', title: 'Factuur 2026-013', createdAt: '2026-07-15' } }]
    });
    t.deep(ids(verstuurd), ['doc-2'],
      'een verstuurde factuur zit niet in de werkvoorraad, dus haar documentconcept blijft er als enige item staan');
  }
  {
    /* LET OP — GEMELD ALS GAT, ZIE HET RAPPORT BIJ DIT BESTAND.
       Op een gearchiveerd project valt de conceptfactuur af (ruis op een
       afgesloten project), maar haar document niet: concepten kennen geen
       archieffilter. Er blijft dan een factuurdocument van een afgesloten
       project in de werkvoorraad staan, en de ontdubbeling grijpt daar juist
       niet omdat de factuur er al uit is. Deze assertie legt het HUIDIGE
       gedrag vast; wordt hij ooit rood, dan is het gat gedicht en mag deze
       regel weg. */
    const opArchief = M.collectInbox({
      now: NU,
      projects: [{ id: 'pr-9', clientId: 'cl-3', status: 'archived' }],
      invoices: [{ id: 'inv-9', projectId: 'pr-9', publishStatus: 'concept', label: 'Op archief', createdAt: '2026-08-24', documentId: 'doc-9' }],
      drafts: [{ kind: 'document', row: { id: 'doc-9', projectId: 'pr-9', title: 'Factuur op archief', createdAt: '2026-08-24' } }]
    });
    t.deep(ids(opArchief), ['doc-9'],
      'de conceptfactuur van een gearchiveerd project valt af, maar haar document blijft staan (gemeld als gat, zie het rapport)');
  }
  {
    /* De controle op de controle: zonder de koppeling documentId zijn het
       echt twee losse stukken werk en horen ze allebei te blijven staan. */
    const losseInvoice = Object.assign({}, BASIS_DUO.invoices[0]);
    delete losseInvoice.documentId;
    const twee = M.collectInbox(Object.assign({}, BASIS_DUO, { invoices: [losseInvoice] }));
    t.eq(twee.length, 2, 'zonder documentId is er geen koppeling en blijven het twee losse items');
    t.eq(M.inboxBadgeCount(twee, NU), 2, 'en dan telt de badge er ook twee');
  }
  {
    /* Een mediaconcept met toevallig hetzelfde id als het factuurdocument
       mag niet meesneuvelen: de filter kijkt naar kind én id. */
    const gemengd = M.collectInbox(Object.assign({}, BASIS_DUO, {
      drafts: [
        { kind: 'document', row: { id: 'doc-1', projectId: 'pr-1', title: 'Factuur 2026-014', createdAt: '2026-08-24' } },
        { kind: 'media', row: { id: 'doc-1', projectId: 'pr-1', caption: 'Foto met hetzelfde id', createdAt: '2026-08-24' } }
      ]
    }));
    t.eq(gemengd.length, 2, 'alleen een documentconcept wordt weggefilterd; een foto met hetzelfde id blijft staan');
    t.eq(chipOf(gemengd, 'concept', 'doc-1'), 'concepten', 'die foto houdt gewoon zijn eigen chip');
  }
  t.eq(M.collectInbox(BRON).filter(function (it) { return it.kind === 'concept' && it.id === 'doc-1'; }).length, 0,
    'ook in de volledige werkdagbron verdwijnt het factuurdocument en blijft alleen de conceptfactuur over');

  /* ============================================================
     5. INBOX — DE BADGE (beslissing 2.3)
     ============================================================ */
  t.group('inbox: badge');

  t.eq(M.inboxBadgeCount(INBOX, NU), 5,
    'de badge telt vijf stuks werk: de nieuwe site-brief, de open vraag, de herbestelling, de conceptfactuur en de conceptfoto — de andere zes items in de lijst wachten niet op mij');

  {
    /* per soort nagelopen, zodat een rode badge te herleiden is tot één regel */
    function badgeVan(items) { return M.inboxBadgeCount(items, NU); }
    const alleen = function (kind, id) {
      return badgeVan(INBOX.filter(function (it) { return it.kind === kind && it.id === id; }));
    };
    t.eq(alleen('vraag', 'q-1'), 1, 'de badge telt WEL een open klantvraag');
    t.eq(alleen('vraag', 'q-2'), 1, 'de badge telt WEL een herbestelaanvraag');
    t.eq(alleen('brief', 'req-1'), 1, 'de badge telt WEL een nieuwe site-brief');
    t.eq(alleen('concept', 'med-7'), 1, 'de badge telt WEL een concept');
    t.eq(alleen('factuur', 'inv-1'), 1, 'de badge telt WEL een conceptfactuur');

    t.eq(alleen('fase', 'pr-1:sampling'), 0,
      'de badge telt GEEN fase op akkoord: die staat wel in de Inbox onder Goedkeuringen, maar er is voor mij niets te doen');
    t.eq(alleen('sample', 'smp-2'), 0, 'de badge telt GEEN wachtende sampleronde: de klant is aan zet');
    t.eq(alleen('vraag', 'q-4'), 0, 'de badge telt GEEN item waarvan de bal bij de klant ligt');
    t.eq(alleen('concept', 'med-8'), 0,
      'de badge telt GEEN ingeplande publicatie: daar wacht een klok, niet ik — dit is het verschil met de oude wBadge die nooit op nul kwam');
    t.eq(alleen('vraag', 'q-3'), 0, 'de badge telt GEEN afgehandeld item');
    t.eq(alleen('brief', 'req-2'), 0, 'de badge telt GEEN omgezette site-brief');
  }
  {
    const geparkeerd = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: { 'q:q-4': { owner: 'klant' }, 'q:q-1': { snoozedUntil: '2026-09-05' } } }
    }));
    t.eq(M.inboxBadgeCount(geparkeerd, NU), 4,
      'de badge zakt van vijf naar vier zodra een van die vijf geparkeerd wordt: bewust parkeren was anders zinloos, want de oude badges bleven eraan hangen');
    t.eq(pick(geparkeerd, 'vraag', 'q-1').snoozedUntil, '2026-09-05', 'de lopende terugkeerdatum reist mee met het item');
  }
  {
    const terug = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: { 'q:q-4': { owner: 'klant' }, 'q:q-1': { snoozedUntil: '2026-08-28' } } }
    }));
    const q1 = pick(terug, 'vraag', 'q-1');
    t.eq(q1.snoozedUntil, null, 'een gepasseerde terugkeerdatum is geen snooze meer, dus filterInbox hoeft geen klok te kennen');
    t.eq(q1.returnedAt, '2026-08-28', 'die datum blijft als returnedAt bewaard, zodat het scherm "terug uit uitstel" bovenaan kan zetten');
    t.eq(M.inboxBadgeCount(terug, NU), 5, 'en het item telt weer gewoon mee in de badge: terug op vijf');
  }
  t.eq(M.inboxBadgeCount([], NU), 0, 'een lege lijst telt nul');
  t.eq(M.inboxBadgeCount(undefined, NU), 0, 'een ontbrekende lijst telt nul in plaats van te klappen');

  /* ============================================================
     6. INBOX — FILTEREN
     ============================================================ */
  t.group('inbox: filteren');

  {
    const alles = M.filterInbox(INBOX, 'alles');
    t.eq(alles.length, INBOX.length - 2,
      'chip Alles laat de twee afgehandelde items weg: afgehandeld werk hoort niet in de werkvoorraad');
    t.eq(alles.filter(function (it) { return it.chip === 'afgehandeld'; }).length, 0, 'er zit niets afgehandelds in Alles');
    t.deep(ids(M.filterInbox(INBOX, 'afgehandeld')), ['req-2', 'q-3'], 'chip Afgehandeld toont uitsluitend het afgehandelde werk');
    t.deep(ids(M.filterInbox(INBOX, 'goedkeuringen')), ['pr-1:sampling'], 'chip Goedkeuringen toont alleen fases op akkoord');
    t.deep(ids(M.filterInbox(INBOX, 'gepland')), ['med-8'], 'chip Gepland toont alleen ingeplande publicaties');
    t.deep(ids(M.filterInbox(INBOX, 'uitgesteld')), [], 'zonder lopende snooze is Uitgesteld leeg');
  }
  {
    const geparkeerd = M.collectInbox(Object.assign({}, BRON, {
      settings: { itemState: { 'q:q-4': { owner: 'klant' }, 'q:q-1': { snoozedUntil: '2026-09-05' } } }
    }));
    t.deep(ids(M.filterInbox(geparkeerd, 'uitgesteld')), ['q-1'], 'chip Uitgesteld toont het geparkeerde item');
    t.eq(M.filterInbox(geparkeerd, 'wachtopmij').filter(function (it) { return it.id === 'q-1'; }).length, 0,
      'een geparkeerd item valt uit ELKE andere chip, anders was parkeren zinloos');
    t.eq(M.filterInbox(geparkeerd, 'alles').filter(function (it) { return it.id === 'q-1'; }).length, 0,
      'chip Alles laat uitgesteld werk ook weg');
  }
  t.deep(ids(M.filterInbox(INBOX, 'alles', { clientId: 'cl-2' })).sort(), ['med-8', 'q-4', 'smp-2'],
    'een extra filter op klant houdt alleen het werk van die klant over');
  t.deep(ids(M.filterInbox(INBOX, 'alles', { projectId: 'pr-1' })).sort(), ['inv-1', 'med-7', 'pr-1:sampling', 'q-1', 'q-2'],
    'een extra filter op project houdt alleen het werk van dat project over');
  t.deep(ids(M.filterInbox(INBOX, 'alles', { kind: 'brief' })), ['req-1'], 'een extra filter op itemtype houdt alleen dat type over');
  t.deep(ids(M.filterInbox(INBOX, 'alles', { q: 'AANBETALING' })), ['inv-1'],
    'zoeken kijkt hoofdletterongevoelig naar titel en ondertitel');
  t.deep(ids(M.filterInbox(INBOX, 'alles', { q: 'bestaat niet' })), [], 'een zoekterm zonder treffer geeft een lege lijst');

  /* ============================================================
     7. INBOX — LEGE EN ONTBREKENDE BRONNEN

     Het beheer haalt tien verzamelingen tegelijk op. Eén trage of lege bron
     mag geen leeg scherm en zeker geen uitzondering veroorzaken.
     ============================================================ */
  t.group('inbox: lege bronnen');

  t.deep(M.collectInbox({}), [], 'collectInbox({}) levert een lege lijst en geen exception');
  t.deep(M.collectInbox(undefined), [], 'collectInbox(undefined) levert een lege lijst en geen exception');
  t.deep(M.collectInbox(null), [], 'collectInbox(null) levert een lege lijst en geen exception');
  t.deep(M.collectInbox({ questions: null, briefs: undefined, drafts: 'onzin', invoices: 7, samples: {} }), [],
    'bronnen die geen lijst zijn worden genegeerd in plaats van doorgegeven aan forEach');
  t.deep(M.collectInbox({ now: NU, questions: [null, {}, { question: 'zonder id' }] }), [],
    'rijen zonder id worden overgeslagen: zonder id is er geen sleutel voor snooze en pin');
  t.deep(M.filterInbox(undefined, 'alles'), [], 'filterInbox zonder lijst geeft een lege lijst');
  t.deep(M.filterInbox(null), [], 'filterInbox zonder lijst en zonder chip geeft een lege lijst');
  t.deep(M.filterInbox([null, undefined], 'alles'), [], 'lege plekken in de lijst worden overgeslagen');
  t.eq(M.collectInbox({ now: NU, projects: [{ id: 'pr-1', clientId: 'cl-1', status: 'active', stages: [{ stageKey: 'sampling', status: 'awaiting_approval' }] }] }).length, 1,
    'ontbreekt de losse fasenlijst, dan komen de fases uit projects[].stages — zo levert de datalaag ze vandaag');

  /* ============================================================
     8. DATUMS
     ============================================================ */

  /* ---------- de twee klokken achter de Inbox ----------
     Elk scherm dat een vervaldatum of een antwoordtermijn toont rekende die
     tot voor kort zelf uit, want ze stonden niet in de export. De
     ontwikkelpagina had er al een kopie van, en die kopie miste de tak
     `inv.invoiceDueISO`: twee vervaldatums voor dezelfde factuur, afhankelijk
     van welk scherm je open had. Deze groep bewijst dat ze in de export
     staan én dat ze rekenen wat ze beloven. */
  t.group('klokken: vervaldatum en antwoordtermijn');

  t.eq(typeof M.invoiceDueISO, 'function', 'invoiceDueISO is bereikbaar voor een scherm en hoeft dus niet nagebouwd te worden');
  t.eq(typeof M.answerDeadlineISO, 'function', 'answerDeadlineISO ook, om precies dezelfde reden');

  t.eq(M.invoiceDueISO({ createdAt: '2026-08-24' }), '2026-09-23',
    'zonder eigen vervaldatum is de projectie aanmaak plus 30 dagen: 24 augustus wordt 23 september');
  t.eq(M.invoiceDueISO({ dueDate: '2026-09-01', createdAt: '2026-08-24' }), '2026-09-01',
    'een ECHT dueDate-veld gaat vóór de 30-dagenprojectie: de factuurmodule zet dat veld en die weet de afspraak met de klant');
  t.eq(M.invoiceDueISO({ invoiceDueISO: '2026-10-05', createdAt: '2026-08-24' }), '2026-10-05',
    'een al berekende invoiceDueISO op de rij telt ook mee — precies de tak die de kopie in de ontwikkelpagina miste');
  t.eq(M.invoiceDueISO({ dueDate: '2026-09-01', invoiceDueISO: '2026-10-05', createdAt: '2026-08-24' }), '2026-09-01',
    'staan alle drie de bronnen op de rij, dan wint dueDate, daarna invoiceDueISO en pas als laatste de projectie');
  t.eq(M.invoiceDueISO({ dueDate: '2026-09-01T14:30' }), '2026-09-01',
    'een vervaldatum met een tijd erachter wordt teruggebracht tot de dag: de hele app vergelijkt dagen');
  t.eq(M.invoiceDueISO({}), null, 'een factuur zonder enkele datum levert null: er valt niets te projecteren');
  t.eq(M.invoiceDueISO(null), null, 'geen factuur is geen vervaldatum, en geen uitzondering');
  t.eq(M.invoiceDueISO({ createdAt: 'onzin' }), null, 'een onleesbare aanmaakdatum geeft null in plaats van een datum vlak na 1970');

  t.eq(M.answerDeadlineISO('2026-08-24'), '2026-08-25', 'doordeweeks is de antwoordtermijn simpelweg de volgende dag');
  t.eq(M.answerDeadlineISO('2026-08-28'), '2026-08-31', 'een vraag van vrijdag krijgt maandag: het weekend telt niet mee als werkdag');
  t.eq(M.answerDeadlineISO('2026-08-29'), '2026-08-31', 'een vraag van zaterdag krijgt ook maandag');
  t.eq(M.answerDeadlineISO('2026-08-30'), '2026-08-31', 'en een vraag van zondag eveneens');
  t.eq(M.answerDeadlineISO('onzin'), null, 'een onleesbaar ontvangstmoment geeft null');
  t.eq(M.answerDeadlineISO(null), null, 'een ontbrekend ontvangstmoment ook');

  t.true(M.isConceptRow({ publishStatus: 'concept' }), 'een rij met publishStatus concept is een concept');
  t.false(M.isConceptRow({ publishStatus: 'published' }), 'een gepubliceerde rij is dat niet');
  t.false(M.isConceptRow({}), 'een ontbrekend veld telt als gepubliceerd: migratieveilig, net als isConcept() in beheer.html');
  t.false(M.isConceptRow(null), 'en een lege rij klapt niet');

  {
    /* De klokken zijn ook echt DEZELFDE die nextDateFor() gebruikt. Zou het
       projectscherm zelf rekenen, dan staat daar een andere datum dan in de
       Inbox bij hetzelfde stuk werk — en dan gelooft niemand ze allebei.
       PROJECT_KLOK is met opzet een eigen constante en niet de PROJECT van
       de volgende groep: die wordt pas hieronder aangemaakt. */
    const PROJECT_KLOK = { id: 'pr-1', clientId: 'cl-1' };
    const openstaand = { id: 'inv-2', projectId: 'pr-1', status: 'open', publishStatus: 'published', createdAt: '2026-08-20' };
    t.eq(M.nextDateFor(PROJECT_KLOK, { now: NU, invoices: [openstaand] }).iso, M.invoiceDueISO(openstaand),
      'de eerstvolgende datum van een openstaande factuur is letterlijk wat invoiceDueISO() zegt, en geen tweede berekening');
    const metEigenDatum = { id: 'inv-4', projectId: 'pr-1', status: 'open', publishStatus: 'published', createdAt: '2026-08-20', dueDate: '2026-09-04' };
    t.eq(M.nextDateFor(PROJECT_KLOK, { now: NU, invoices: [metEigenDatum] }).iso, '2026-09-04',
      'zet de factuurmodule een echt dueDate op de factuur, dan schuift de datum op het projectscherm mee in plaats van op 30 dagen te blijven staan');
    const vraag = { id: 'q-1', projectId: 'pr-1', askedAt: '2026-08-28' };
    t.eq(M.nextDateFor(PROJECT_KLOK, { now: NU, questions: [vraag] }).iso, M.answerDeadlineISO(vraag.askedAt),
      'en de antwoordklok op het projectscherm is letterlijk answerDeadlineISO() van de ontvangstdatum');
  }

  t.group('datums: eerstvolgende datum');

  const PROJECT = { id: 'pr-1', clientId: 'cl-1' };
  {
    /* Zes bronnen door elkaar, waarvan één in het verleden. De juiste
       uitkomst is de eerstvolgende die nog moet komen, niet de eerste in de
       lijst en niet de oudste. */
    const ctx = {
      now: NU,
      shipments: [
        { id: 'sh-1', projectId: 'pr-1', etaWindowEnd: '2026-08-05' },
        { id: 'sh-2', projectId: 'pr-1', etaWindowEnd: '2026-09-20' }
      ],
      questions: [{ id: 'q-1', projectId: 'pr-1', askedAt: '2026-09-01' }],
      invoices: [{ id: 'inv-2', projectId: 'pr-1', status: 'open', publishStatus: 'published', createdAt: '2026-08-20' }],
      moments: [{ id: 'm-1', clientId: 'cl-1', remindAt: '2026-09-15' }],
      drafts: [{ kind: 'media', row: { id: 'med-8', projectId: 'pr-1', scheduledAt: '2026-09-10T09:00' } }],
      items: [{ id: 'q-9', kind: 'vraag', projectId: 'pr-1', snoozedUntil: '2026-09-03' }]
    };
    const d = M.nextDateFor(PROJECT, ctx);
    t.eq(d.iso, '2026-09-02', 'uit zes kandidaten wint de eerstvolgende die nog moet komen: de antwoordklok van 2 september');
    t.eq(d.kind, 'antwoordklok', 'de soort komt mee, zodat het scherm kan uitleggen wáárom die datum er staat');
    t.false(d.passed, 'een datum in de toekomst is niet verstreken');
  }
  {
    const ctx = {
      now: NU,
      shipments: [
        { id: 'sh-1', projectId: 'pr-1', etaWindowEnd: '2026-08-05' },
        { id: 'sh-3', projectId: 'pr-1', etaWindowEnd: '2026-08-20' }
      ]
    };
    const d = M.nextDateFor(PROJECT, ctx);
    t.eq(d.iso, '2026-08-20', 'zijn alle datums verstreken, dan komt de MEEST RECENT verstreken datum terug');
    t.true(d.passed, 'en die is gemarkeerd als verstreken, want dat is precies het moment waarop je hem moet zien');
  }
  {
    const d = M.nextDateFor(PROJECT, { now: NU, shipments: [{ id: 'sh-1', projectId: 'pr-1', etaWindowEnd: NU }] });
    t.eq(d.iso, NU, 'een datum van vandaag telt als eerstvolgend en niet als verstreken');
    t.false(d.passed, 'vandaag is niet gepasseerd');
  }

  t.eq(M.nextDateFor(PROJECT, { now: NU }), null,
    'GEEN VERZONNEN DEADLINE: zonder enkele bron is het antwoord null (beslissing 2.5) — een gegokte datum is erger dan geen datum');
  t.eq(M.nextDateFor(PROJECT), null, 'ook zonder ctx wordt er niets verzonnen');
  t.eq(M.nextDateFor(null), null, 'zonder project is er niets te berekenen');
  t.eq(M.nextDateFor({}, { now: NU }), null, 'een project zonder id levert null, want niets kan eraan gekoppeld worden');
  t.eq(M.nextDateFor(PROJECT, { now: NU, shipments: [{ id: 'sh-1', projectId: 'pr-1', etaWindowEnd: '2026-09-02', deliveredAt: '2026-08-29' }] }), null,
    'een geleverde zending heeft geen ETA-venster meer en levert dus geen datum');
  t.eq(M.nextDateFor(PROJECT, { now: NU, invoices: [{ id: 'inv-1', projectId: 'pr-1', status: 'concept', publishStatus: 'concept', createdAt: '2026-08-20' }] }), null,
    'een conceptfactuur is nog niet verstuurd en heeft dus nog geen vervaldatum');
  t.eq(M.nextDateFor(PROJECT, { now: NU, questions: [{ id: 'q-1', projectId: 'pr-2', askedAt: '2026-09-01' }] }), null,
    'een vraag van een ander project telt niet mee');

  t.group('datums: schrijfwijze en afstand');

  t.eq(M.relativeDay(NU, NU), 'vandaag', 'dezelfde dag heet vandaag');
  t.eq(M.relativeDay('2026-08-29', NU), 'gisteren', 'de dag ervoor heet gisteren');
  t.eq(M.relativeDay('2026-08-31', NU), 'over 1 dag', 'één dag vooruit is enkelvoud: over 1 dag');
  t.eq(M.relativeDay('2026-09-02', NU), 'over 3 dagen', 'meer dan één dag vooruit is meervoud');
  t.eq(M.relativeDay('2026-08-25', NU), '5 dagen geleden', 'terug in de tijd telt in hele dagen');
  t.eq(M.relativeDay('onzin', NU), '', 'een onleesbare datum geeft lege tekst en geen "NaN dagen geleden"');
  t.eq(M.relativeDay(null, NU), '', 'een ontbrekende datum geeft lege tekst');

  t.eq(M.formatDate('2026-01-05'), '5 jan 2026', 'januari is jan, en de dag krijgt geen voorloopnul');
  t.eq(M.formatDate('2026-03-12'), '12 mrt 2026', 'maart is mrt en niet maa of mar');
  t.eq(M.formatDate('2026-05-01'), '1 mei 2026', 'mei blijft mei');
  t.eq(M.formatDate('2026-06-09'), '9 jun 2026', 'juni is jun');
  t.eq(M.formatDate('2026-10-31'), '31 okt 2026', 'oktober is okt en niet oct');
  t.eq(M.formatDate('2026-12-25'), '25 dec 2026', 'december is dec');
  t.eq(M.formatDate(''), '', 'een lege datum geeft lege tekst');
  t.eq(M.formatDate('onzin'), '', 'een onleesbare datum geeft lege tekst');
  t.eq(M.formatDateTime('2026-09-05T09:00'), '5 sep 2026 09:00', 'een tijdstempel toont zijn tijd');
  t.eq(M.formatDateTime('2026-09-05'), '5 sep 2026',
    'een kale dag krijgt geen verzonnen 00:00: dat zou een precisie suggereren die de bron niet heeft');

  /* ONMOGELIJKE DATUMS — DIT STOND LETTERLIJK ZO OP HET SCHERM.
     De ISO-vorm laat elke twee cijfers als maand en als dag door, dus
     '2026-13-45' kwam er als vorm doorheen en schreef de dertiende
     maandnaam op het scherm: die bestaat niet, en er stond dus het woord
     "undefined". Een onmogelijke datum hoort lege tekst te geven, want dat
     is wat elke aanroeper al verwacht en al vertaalt. */
  ['2026-13-45', '2026-13-01', '2026-00-10', '2026-05-00', '2026-05-32'].forEach(function (onmogelijk) {
    t.eq(M.formatDate(onmogelijk), '',
      'formatDate(' + onmogelijk + ') geeft lege tekst: maand 13, maand 00, dag 00 en dag 32 bestaan geen van alle');
    t.eq(M.formatDateTime(onmogelijk + 'T09:00'), '',
      'formatDateTime(' + onmogelijk + ' 09:00) geeft ook lege tekst, want het is dezelfde datumlezer eronder');
    t.eq(M.dayISO(onmogelijk), null,
      'en dayISO(' + onmogelijk + ') geeft null, zodat zo een datum ook nergens stil in een vergelijking meesluipt');
  });
  t.eq(M.formatDate('2026-13-45').indexOf('undefined'), -1,
    'het woord "undefined" komt er in geen enkel geval nog als maandnaam uit — dat is precies wat er gebeurde');
  t.eq(M.formatDate('2026-04-31'), '31 apr 2026',
    '31 april wordt bewust NIET geweigerd: dat is een bestaande dag in de verkeerde maand en geen onzin, en het dagnummer rekent hem netjes door');

  t.eq(M.daysBetween('2026-03-28', '2026-03-30'), 2,
    'over de zomertijdovergang (29 maart 2026) telt daysBetween twee hele kalenderdagen en niet 23 of 25 uur');
  t.eq(M.daysBetween('2026-10-24', '2026-10-26'), 2,
    'over de wintertijdovergang (25 oktober 2026) telt daysBetween er ook precies twee');
  t.eq(M.daysBetween('2026-03-28', '2026-03-29'), 1, 'de korte nacht zelf telt als één hele dag');
  t.eq(M.daysBetween('2026-10-24', '2026-10-25'), 1, 'de lange nacht zelf telt ook als één hele dag');
  t.eq(M.daysBetween('2025-12-31', '2026-01-01'), 1, 'over de jaargrens telt hij gewoon door');
  t.eq(M.daysBetween('2028-02-28', '2028-03-01'), 2, 'in een schrikkeljaar zit 29 februari er echt tussen');
  t.eq(M.daysBetween(NU, NU), 0, 'dezelfde dag is nul dagen');
  t.eq(M.daysBetween('2026-03-30', '2026-03-28'), -2, 'terug in de tijd is negatief');
  t.eq(M.daysBetween('onzin', NU), null, 'een onleesbare datum geeft null en niet NaN');

  /* ============================================================
     9. ACTIVITEIT

     mergeActivity is de ENIGE bron voor alle vier de activiteitsweergaven
     (beslissing 2.6). Een nieuwe weergave bouwt een scope, nooit een eigen
     samenvoeging.
     ============================================================ */
  t.group('activiteit');

  const ACT_BRON = {
    projects: [{ id: 'pr-1', clientId: 'cl-1' }, { id: 'pr-2', clientId: 'cl-2' }],
    accessLog: [{ id: 'log-1', createdAt: '2026-08-28T09:00:00', actor: 'client', action: 'bekeken', assetKind: 'document', projectId: 'pr-1' }],
    mailLog: [{ id: 'mail-1', createdAt: '2026-08-29T10:00:00', subject: 'Je factuur', to: 'anna@x.nl', status: 'bezorgd', clientId: 'cl-1', projectId: 'pr-1' }],
    auditLog: [{ id: 'aud-1', createdAt: '2026-08-27T08:00:00', kind: 'bewerking', detail: 'Fase bijgewerkt', projectId: 'pr-2' }],
    shipments: [{ id: 'sh-1', projectId: 'pr-1', events: [{ id: 'ev-1', shipmentId: 'sh-1', occurredAt: '2026-08-26T12:00:00', milestoneKey: 'verscheept' }] }],
    shipmentEvents: [{ id: 'ev-1', shipmentId: 'sh-1', occurredAt: '2026-08-26T12:00:00', milestoneKey: 'verscheept' }],
    questions: [{ id: 'q-1', projectId: 'pr-2', question: 'Maat?', askedAt: '2026-08-20T11:00:00', answeredAt: '2026-08-21T11:00:00' }],
    invoices: [{ id: 'inv-1', projectId: 'pr-1', invoiceNumber: '2026-014', label: 'Aanbetaling', createdAt: '2026-08-24T08:00:00', paidAt: '2026-08-30T08:00:00' }]
  };
  const ACT = M.mergeActivity(ACT_BRON, {});

  t.eq(ACT.length, 8, 'acht gebeurtenissen uit zeven bronnen: het dubbele zendingmoment is er één, niet twee');
  t.true(ACT.every(function (r, i) { return i === 0 || ACT[i - 1].at >= r.at; }),
    'de tijdlijn staat aflopend op tijd: het nieuwste bovenaan');
  t.eq(ACT[0].id, 'inv-1:paid', 'de meest recente gebeurtenis staat vooraan');
  t.eq(ACT[ACT.length - 1].id, 'q-1:asked', 'de oudste gebeurtenis staat achteraan');

  t.eq(ACT.filter(function (r) { return r.id === 'ev-1'; }).length, 1,
    'dezelfde zendingmijlpaal uit twee bronnen (los én genest in de zending) verschijnt EEN keer');
  t.eq(ACT.filter(function (r) { return r.id === 'mail-1'; }).length, 1, 'de mail uit het mail-logboek staat er één keer in');

  t.eq(ACT.filter(function (r) { return r.id === 'log-1'; })[0].kind, 'bestanden',
    'een toegangsregel op een document of foto is een bestandsgebeurtenis, geen kale systeemregel');
  t.eq(ACT.filter(function (r) { return r.id === 'aud-1'; })[0].kind, 'systeem',
    'het veld kind in het auditlogboek is een ACTIETYPE en geen weergavesoort: bewerking wordt systeem');

  /* --- het actietype zelf gaat niet verloren ---
     Zonder dit veld komen zeven verschillende soorten systeemhandelingen
     als één ononderscheidbare hoop 'systeem' naar buiten, en kan het
     werkgebied Activiteit de filterchips uit de mappingtabel niet bouwen. */
  t.eq(ACT.filter(function (r) { return r.id === 'aud-1'; })[0].actie, 'bewerking',
    'het actietype reist mee als .actie, naast de weergavesoort in .kind');
  t.eq(ACT.filter(function (r) { return r.id === 'ev-1'; })[0].actie, undefined,
    'een zendingmijlpaal draagt GEEN actietype: die staat niet in het auditlogboek en krijgt er ook geen aangemeten');
  t.eq(ACT.filter(function (r) { return r.id === 'log-1'; })[0].actie, undefined,
    'een toegangsregel evenmin — zo kan een scherm "type overig" onderscheiden van "geen type vastgelegd"');
  {
    const zonderType = M.mergeActivity({ auditLog: [{ id: 'aud-9', createdAt: '2026-08-27T08:00:00', detail: 'Iets gedaan' }] }, {});
    t.eq(zonderType[0].actie, 'overig',
      'een auditregel zonder kind valt terug op overig: dezelfde terugval die addAudit bij het wegschrijven al gebruikt');
    t.eq(zonderType[0].kind, 'systeem', 'en hij blijft gewoon een systeemgebeurtenis');
  }
  {
    const mailAudit = M.mergeActivity({ auditLog: [{ id: 'aud-8', createdAt: '2026-08-27T08:00:00', kind: 'mail', detail: 'Mail verstuurd' }] }, {});
    t.eq(mailAudit[0].kind, 'mail', 'actietype mail valt samen met de weergavesoort E-mail en krijgt dus die tab');
    t.eq(mailAudit[0].actie, 'mail', 'het actietype blijft daarnaast leesbaar');
  }
  t.eq(ACT.filter(function (r) { return r.id === 'mail-1'; })[0].cls, 'act-mail',
    'de klassenaam is een eigen act-naam en kaapt geen bestaande chipklasse');
  t.eq(ACT.filter(function (r) { return r.id === 'inv-1:paid'; })[0].kind, 'financieel', 'een betaalde factuur is een financiële gebeurtenis');
  t.eq(ACT.filter(function (r) { return r.id === 'q-1:asked'; })[0].actor, 'klant', 'een gestelde vraag komt van de klant');
  t.eq(ACT.filter(function (r) { return r.id === 'q-1:answered'; })[0].actor, 'beheer', 'het antwoord komt van het beheer');
  t.eq(ACT.filter(function (r) { return r.id === 'log-1'; })[0].clientId, 'cl-1',
    'een rij die alleen een projectId draagt krijgt zijn klant via het project erbij');

  t.deep(ids(M.mergeActivity(ACT_BRON, { clientId: 'cl-1' })), ['inv-1:paid', 'mail-1', 'log-1', 'ev-1', 'inv-1:created'],
    'een scope op klant filtert alles weg wat niet van die klant is');
  t.eq(M.mergeActivity(ACT_BRON, { clientId: 'cl-1' }).filter(function (r) { return r.clientId !== 'cl-1'; }).length, 0,
    'er lekt geen enkele rij van een andere klant door de scope heen');
  t.deep(ids(M.mergeActivity(ACT_BRON, { projectId: 'pr-2' })), ['aud-1', 'q-1:answered', 'q-1:asked'],
    'een scope op project houdt alleen dat project over');
  t.deep(ids(M.mergeActivity(ACT_BRON, { kinds: ['mail'] })), ['mail-1'], 'een scope op soort houdt alleen die soort over');
  t.eq(M.mergeActivity(ACT_BRON, { kinds: ['alles'] }).length, 8, 'de soort "alles" filtert niets weg');
  t.deep(ids(M.mergeActivity(ACT_BRON, { factoryId: 'fa-1' })), [],
    'geen enkele huidige bron draagt een factoryId, dus een fabriekscope levert eerlijk niets op in plaats van te raden op tekst');

  t.deep(ids(M.mergeActivity(ACT_BRON, { limit: 2 })), ['inv-1:paid', 'mail-1'],
    'een limit knipt de lijst af aan de NIEUWE kant: de twee meest recente blijven staan');
  t.eq(M.mergeActivity(ACT_BRON, { limit: 2 }).length, 2, 'en de lijst is dan ook echt twee lang');
  t.eq(M.mergeActivity(ACT_BRON, { limit: 0 }).length, 8, 'limit 0 betekent geen limiet en niet een lege lijst');
  t.eq(M.mergeActivity(ACT_BRON, { limit: 99 }).length, 8, 'een limit groter dan de lijst laat de lijst heel');

  t.deep(ids(M.mergeActivity(ACT_BRON, { from: '2026-08-27', to: '2026-08-29' })), ['mail-1', 'log-1', 'aud-1'],
    'van en tot zijn allebei inclusief');
  t.deep(M.mergeActivity({}), [], 'zonder bronnen levert mergeActivity een lege lijst');
  t.deep(M.mergeActivity(), [], 'zonder argumenten ook');
  t.deep(M.mergeActivity(null, null), [], 'en met null als bron en als scope ook');
  t.deep(M.mergeActivity({ accessLog: [{ id: 'zonder-tijd', detail: 'geen createdAt' }] }), [],
    'een gebeurtenis zonder tijdstempel kan niet in een tijdlijn en valt af');

  /* ============================================================
     9b. FASENAMEN KOMEN VAN DE AANROEPER

     De fasesleutels zijn Engels ('dfm', 'sourcing', 'logistics') en
     beheer.html heeft daar al één Nederlandse tabel voor: STAGES met
     stageLabel(). De rekenlaag mag die tabel niet nabouwen — twee tabellen
     lopen binnen een maand uit de pas — maar hij mag de sleutel evenmin als
     zichtbare tekst doorgeven. Dat gebeurde wél: in de Inbox stond 'dfm' als
     titel van een goedkeuring, en in de tijdlijn stond 'Fase goedgekeurd:
     logistics' naast een auditregel die dezelfde fase juist wél vertaald had.
     De bron geeft daarom een stageLabel(sleutel) mee, precies zoals
     timelineRow al een kindLabel accepteert.
     ============================================================ */
  t.group('fasenamen: de labeltabel komt van de aanroeper');

  /* de echte tabel uit beheer.html, ingekort tot de sleutels waar het
     verschil tussen sleutel en naam het duidelijkst is */
  const STAGE_LABELS = {
    dfm: 'Ontwerp voor Produceerbaarheid',
    sourcing: 'Inkoop en Leveranciers',
    logistics: 'Compliance & Logistiek'
  };
  function stageLabel(key) { return STAGE_LABELS[key] || key; }

  const FASE_BRON = {
    now: NU,
    stageLabel: stageLabel,
    projects: [{ id: 'pr-1', clientId: 'cl-1', status: 'active' }],
    stages: [{ projectId: 'pr-1', stageKey: 'dfm', status: 'awaiting_approval' }],
    questions: [{ id: 'q-1', projectId: 'pr-1', question: 'Welke kleur garen?', askedAt: '2026-08-28', stageKey: 'logistics' }]
  };
  {
    const metTabel = M.collectInbox(FASE_BRON);
    t.eq(pick(metTabel, 'fase', 'pr-1:dfm').title, 'Ontwerp voor Produceerbaarheid',
      'de TITEL van een goedkeuring is de Nederlandse fasenaam van de aanroeper en niet de sleutel dfm');
    t.eq(pick(metTabel, 'vraag', 'q-1').sub, 'Compliance & Logistiek · antwoord voor 31 aug 2026',
      'de ONDERTITEL van een vraag noemt diezelfde vertaalde fasenaam, vóór de antwoordklok');

    /* het bewijs in één regel: geen enkele van de Engelse sleutels staat nog
       ergens in de zichtbare tekst van de Inbox */
    const zichtbaar = metTabel.map(function (it) { return String(it.title) + ' ' + String(it.sub); }).join(' | ');
    ['dfm', 'sourcing', 'logistics'].forEach(function (sleutel) {
      t.eq(zichtbaar.indexOf(sleutel), -1,
        'de rauwe Engelse fasesleutel "' + sleutel + '" komt nergens meer als zichtbare tekst uit de Inbox');
    });
  }
  {
    const zonderTabel = M.collectInbox(Object.assign({}, FASE_BRON, { stageLabel: null }));
    t.eq(pick(zonderTabel, 'fase', 'pr-1:dfm').title, 'dfm',
      'ontbreekt de tabel, dan komt de kale sleutel terug: zichtbaar onaf, maar nooit een hier verzonnen vertaling');
    t.eq(pick(zonderTabel, 'vraag', 'q-1').sub, 'logistics · antwoord voor 31 aug 2026',
      'ook de ondertitel valt dan netjes terug op de sleutel in plaats van leeg te blijven');
  }
  {
    const stukkeTabel = M.collectInbox(Object.assign({}, FASE_BRON, {
      stageLabel: function () { throw new Error('de tabel van de aanroeper struikelt over een onbekende sleutel'); }
    }));
    t.eq(pick(stukkeTabel, 'fase', 'pr-1:dfm').title, 'dfm',
      'klapt de tabel van de aanroeper, dan valt alleen die ene naam terug op de sleutel en niet de hele Inbox weg');
    const leegLabel = M.collectInbox(Object.assign({}, FASE_BRON, { stageLabel: function () { return ''; } }));
    t.eq(pick(leegLabel, 'fase', 'pr-1:dfm').title, 'dfm',
      'een tabel die een lege naam teruggeeft levert ook de sleutel op, en geen goedkeuring zonder titel');
  }
  {
    const FASE_ACT = { projectId: 'pr-1', stageKey: 'logistics', approvedAt: '2026-08-20T10:00:00' };
    t.eq(M.mergeActivity({ stageLabel: stageLabel, stages: [FASE_ACT] }, {})[0].detail,
      'Fase goedgekeurd: Compliance & Logistiek',
      'de tijdlijn schrijft dezelfde vertaalde fasenaam als het auditlogboek, anders staan Nederlands en Engels in één lijst door elkaar');
    t.eq(M.mergeActivity({ stages: [FASE_ACT] }, {})[0].detail, 'Fase goedgekeurd: logistics',
      'zonder tabel staat er de kale sleutel: onaf, maar niet verzonnen');
  }

  /* ============================================================
     10. PROJECTEN
     ============================================================ */
  t.group('projecten: filteren');

  const PROJECTEN = [
    { id: 'pr-a', name: 'Alfa', clientId: 'cl-1', createdAt: '2026-06-01', status: 'active', stages: [{ stageKey: 'ontwerp', status: 'done' }, { stageKey: 'sampling', status: 'awaiting_approval' }] },
    { id: 'pr-b', name: 'Beta', clientId: 'cl-2', createdAt: '2026-06-01', status: 'active', stages: [{ stageKey: 'ontwerp', status: 'done' }, { stageKey: 'productie', status: 'done' }] },
    { id: 'pr-c', name: 'Gamma', clientId: 'cl-1', createdAt: '2026-06-01', status: 'archived', stages: [{ stageKey: 'ontwerp', status: 'done' }] },
    { id: 'pr-d', name: 'Delta', clientId: 'cl-3', createdAt: '2026-06-01', status: 'active', stages: [] }
  ];
  const PCTX = {
    now: NU,
    items: [
      { id: 'q-1', kind: 'vraag', projectId: 'pr-a', owner: 'mij', chip: 'wachtopmij' },
      { id: 'st-1', kind: 'fase', projectId: 'pr-d', owner: 'klant', chip: 'goedkeuringen' },
      { id: 'q-2', kind: 'vraag', projectId: 'pr-b', owner: 'mij', chip: 'afgehandeld' },
      { id: 'q-3', kind: 'vraag', projectId: 'pr-b', owner: 'mij', chip: 'wachtopmij', snoozedUntil: '2026-09-10' }
    ],
    sig: { eta: [{ projectId: 'pr-d' }], stil: [] },
    clients: [{ id: 'cl-1', company: 'Zeegers' }, { id: 'cl-2', company: 'Aalders' }, { id: 'cl-3', company: 'Mulder' }]
  };

  /* geen enkele chip mag hetzelfde project twee keer opleveren */
  M.PROJECT_CHIPS.forEach(function (c) {
    const gevonden = ids(M.filterProjects(PROJECTEN, c.key, PCTX));
    const uniek = gevonden.filter(function (id, i) { return gevonden.indexOf(id) === i; });
    t.eq(gevonden.length, uniek.length, 'chip ' + c.key + ' levert geen enkel project dubbel op');
  });

  t.deep(ids(M.filterProjects(PROJECTEN, 'alle', PCTX)), ['pr-a', 'pr-b', 'pr-c', 'pr-d'], 'chip Alle toont ook het archief');
  t.deep(ids(M.filterProjects(PROJECTEN, 'actief', PCTX)), ['pr-a', 'pr-d'],
    'Actief is alles wat niet gearchiveerd is en nog een fase open heeft; een project zonder fases telt als actief');
  t.deep(ids(M.filterProjects(PROJECTEN, 'afgerond', PCTX)), ['pr-b'],
    'Afgerond is een AFLEIDING: elke fase op done, ook al is het project nog niet gearchiveerd');
  t.deep(ids(M.filterProjects(PROJECTEN, 'gearchiveerd', PCTX)), ['pr-c'], 'Gearchiveerd toont alleen het archief');
  t.deep(ids(M.filterProjects(PROJECTEN, 'wachtopmij', PCTX)), ['pr-a'], 'Wacht op mij kijkt naar de eigenaar van de openstaande items');
  t.deep(ids(M.filterProjects(PROJECTEN, 'wachtopklant', PCTX)), ['pr-d'],
    'Wacht op klant telt ook de fabriek mee: in beide gevallen ligt de bal buiten de deur');
  t.deep(ids(M.filterProjects(PROJECTEN, 'vertraagd', PCTX)), ['pr-d'],
    'Vertraagd komt uit computeSignals, want zendingen zitten bewust niet in de Inbox');

  {
    /* DE CHIP MOET WEG ALS ER NIETS GEMETEN IS.
       'Vertraagd' kan alleen bestaan als de aanroeper ctx.sig meegeeft: de
       terugvalweg zoekt items met soort 'zending' en collectInbox() maakt die
       soort bewust nooit aan. Zonder sig is het eerlijke antwoord "niet
       gemeten", en dat is iets anders dan nul — een chip met telling 0 zegt
       "er is niets vertraagd", en dat is precies de stand die een scherm dan
       NIET mag tonen. Daarom draagt de chip vereistSig en laat een scherm
       zonder sig hem weg in plaats van een nul op te schrijven. */
    const metSig = M.PROJECT_CHIPS.filter(function (c) { return c.vereistSig; });
    t.deep(metSig.map(function (c) { return c.key; }), ['vertraagd'],
      'precies één chip is gemarkeerd als "heeft ctx.sig nodig", zodat een scherm zonder sig weet welke chip hij moet weglaten');
    t.deep(ids(M.filterProjects(PROJECTEN, 'vertraagd', { now: NU, items: PCTX.items })), [],
      'zonder ctx.sig levert Vertraagd inderdaad niets op: niet gemeten, en dus niet als telling van nul te tonen');
    M.PROJECT_CHIPS.forEach(function (c) {
      if (c.key === 'vertraagd') return;
      t.false(c.vereistSig, 'chip ' + c.key + ' rekent niet op sig en hoort dus altijd zichtbaar te zijn');
    });
  }

  {
    /* Actief, Afgerond en Gearchiveerd horen samen precies alle projecten te
       zijn, elk exact één keer. Loopt dat scheef, dan verdwijnt een project
       uit alle lijsten tegelijk en merkt niemand het. */
    const drie = ids(M.filterProjects(PROJECTEN, 'actief', PCTX))
      .concat(ids(M.filterProjects(PROJECTEN, 'afgerond', PCTX)))
      .concat(ids(M.filterProjects(PROJECTEN, 'gearchiveerd', PCTX)));
    t.eq(drie.length, PROJECTEN.length, 'Actief, Afgerond en Gearchiveerd tellen samen op tot alle projecten');
    t.deep(drie.slice().sort(), ['pr-a', 'pr-b', 'pr-c', 'pr-d'], 'en elk project zit in precies één van die drie');
  }
  ['actief', 'afgerond', 'wachtopmij', 'wachtopklant', 'vertraagd'].forEach(function (chip) {
    t.eq(ids(M.filterProjects(PROJECTEN, chip, PCTX)).indexOf('pr-c'), -1,
      'chip ' + chip + ' bevat geen gearchiveerd project: het archief hoort in geen enkele werkchip');
  });
  t.eq(M.filterProjects(PROJECTEN, 'wachtopmij', PCTX).filter(function (p) { return p.id === 'pr-b'; }).length, 0,
    'een project waarvan het enige openstaande item geparkeerd is, staat niet onder Wacht op mij');
  t.deep(ids(M.filterProjects(PROJECTEN, 'zomaar-een-chip', PCTX)), ['pr-a', 'pr-b', 'pr-d'],
    'een onbekende chip toont liever alles dan stilletjes een lege lijst (het archief blijft er wel uit)');
  t.deep(M.filterProjects(undefined, 'alle'), [], 'zonder projecten is elke chip leeg in plaats van kapot');
  t.deep(M.filterProjects(null, 'actief', null), [], 'zonder projecten en zonder ctx ook');
  t.deep(ids(M.filterProjects(PROJECTEN, 'wachtopmij', null)), [],
    'zonder ctx weet niemand wie aan zet is, dus levert die chip niets op in plaats van te gokken');

  t.group('projecten: sorteren');

  {
    /* Alle vier de projecten hebben dezelfde createdAt, dus elke
       vergelijking eindigt gelijk. Wat er dan uitkomt is puur de stabiliteit
       van de sortering. */
    const een = ids(M.sortProjects(PROJECTEN, 'actie', PCTX));
    const twee = ids(M.sortProjects(M.sortProjects(PROJECTEN, 'actie', PCTX), 'actie', PCTX));
    t.deep(twee, een, 'twee keer sorteren geeft exact dezelfde volgorde: de sortering is stabiel');
    t.deep(een, ['pr-a', 'pr-b', 'pr-d', 'pr-c'],
      'bij gelijke sleutels blijft de oorspronkelijke volgorde staan en zakt alleen het archief');
    t.eq(een[een.length - 1], 'pr-c', 'gearchiveerde projecten staan achteraan bij de standaardsortering');
  }
  {
    const metActies = ids(M.sortProjects(PROJECTEN, 'actie', { actions: { 'pr-b': { rank: 1 }, 'pr-d': { rank: 0 } } }));
    t.deep(metActies, ['pr-d', 'pr-b', 'pr-a', 'pr-c'],
      'projecten met een openstaande actie gaan voor, daarbinnen op de rangorde van nextActionFor, en het archief blijft achteraan');
  }
  {
    const opNaam = ids(M.sortProjects(PROJECTEN, 'naam', PCTX));
    t.deep(opNaam, ['pr-a', 'pr-b', 'pr-d', 'pr-c'], 'sorteren op naam is Alfa, Beta, Delta, Gamma');
    t.deep(ids(M.sortProjects(M.sortProjects(PROJECTEN, 'naam', PCTX), 'naam', PCTX)), opNaam, 'ook op naam is twee keer sorteren stabiel');
  }
  {
    const opKlant = ids(M.sortProjects(PROJECTEN, 'klant', PCTX));
    t.deep(opKlant, ['pr-b', 'pr-d', 'pr-a', 'pr-c'],
      'sorteren op klant is Aalders, Mulder, Zeegers, en binnen dezelfde klant op projectnaam');
    t.deep(ids(M.sortProjects(M.sortProjects(PROJECTEN, 'klant', PCTX), 'klant', PCTX)), opKlant, 'ook op klant is twee keer sorteren stabiel');
  }
  {
    const opDatum = ids(M.sortProjects(PROJECTEN, 'datum', PCTX));
    t.eq(opDatum[0], 'pr-b', 'sorteren op eerstvolgende datum zet het project met een echte datum vooraan');
    t.deep(opDatum.slice(1), ['pr-a', 'pr-c', 'pr-d'],
      'projecten zonder eerstvolgende datum zakken naar onderen en houden onderling hun oorspronkelijke volgorde');
    t.deep(ids(M.sortProjects(M.sortProjects(PROJECTEN, 'datum', PCTX), 'datum', PCTX)), opDatum, 'ook op datum is twee keer sorteren stabiel');
  }
  {
    /* LET OP — GEMELD ALS GAT, ZIE HET RAPPORT BIJ DIT BESTAND.
       Alleen de standaardsortering 'actie' zakt het archief naar onderen.
       Kiest de gebruiker in de sorteerselector een van de vier andere modi,
       dan kan een gearchiveerd project gewoon bovenaan de lijst komen,
       terwijl fase 3 van het migratieplan onvoorwaardelijk "gearchiveerde
       projecten onderaan" als eis noemt. Deze assertie legt het HUIDIGE
       gedrag vast; wordt hij ooit rood, dan is het gat gedicht en mag deze
       regel weg. */
    const rijen = [
      { id: 'pr-oud', name: 'Aaa archief', clientId: 'cl-0', createdAt: '2026-07-01', status: 'archived' },
      { id: 'pr-nu', name: 'Zzz actief', clientId: 'cl-9', createdAt: '2026-06-01', status: 'active' }
    ];
    t.eq(ids(M.sortProjects(rijen, 'actie', {}))[0], 'pr-nu', 'standaardsortering: het actieve project staat boven het archief');
    t.eq(ids(M.sortProjects(rijen, 'naam', {}))[0], 'pr-oud',
      'sorteren op naam zakt het archief NIET — alleen modus actie doet dat (gemeld als gat, zie het rapport)');
  }
  t.deep(M.sortProjects(undefined), [], 'sorteren zonder projecten geeft een lege lijst');
  t.deep(ids(M.sortProjects(PROJECTEN, 'bestaat-niet', PCTX)), ['pr-a', 'pr-b', 'pr-d', 'pr-c'],
    'een onbekende sorteermodus valt terug op de standaardsortering in plaats van de volgorde te verhaspelen');

  /* ============================================================
     11. DE KLANTACTIES UIT MIGRATIE 0021 — DE INBOX

     Hoofdstuk 2 van .claude/portaal-spec.md: wat de klant in het portaal
     doet, ziet het beheer als Inbox-item dat op MIJ wacht. De veldnamen
     hieronder zijn die van portal/demo-data-portaal.js (camelCase van
     0021): reportedByClient / verifiedAt / clientReference / paidOn op een
     betaling, uploadedBy / clientNote op een document, clientDecision /
     clientNote / clientDecidedAt / clientMarks op een sampleronde,
     statusCode 'disputed' op een factuur en event 'bezwaar_klant' in het
     factuurlogboek. De klok staat op zondag 30 augustus 2026 (NU).
     ============================================================ */
  t.group('inbox: klantacties uit 0021');

  const KLANT_BRON = {
    now: NU,
    stageLabel: function (k) { return k === 'sourcing' ? 'Inkoop en Leveranciers' : k; },
    projects: [
      { id: 'pr-1', clientId: 'cl-1', status: 'active' },
      { id: 'pr-2', clientId: 'cl-2', status: 'active' },
      { id: 'pr-9', clientId: 'cl-3', status: 'archived' }
    ],
    invoices: [
      { id: 'inv-a', projectId: 'pr-1', publishStatus: 'published', docKind: 'invoice', statusCode: 'sent', invoiceNumber: '2026-013', label: 'Slottermijn', currency: 'EUR', createdAt: '2026-08-01' },
      { id: 'inv-b', projectId: 'pr-2', publishStatus: 'published', docKind: 'invoice', statusCode: 'disputed', invoiceNumber: '', label: 'Meerwerk — polijstronde', currency: 'EUR', outstandingCents: 42000, reminderPaused: true, createdAt: '2026-07-28', updatedAt: '2026-08-29T09:05:00Z' },
      { id: 'inv-c', projectId: 'pr-1', publishStatus: 'published', docKind: 'invoice', statusCode: 'overdue', invoiceNumber: '2026-011', label: 'Aanbetaling', currency: 'EUR', createdAt: '2026-06-01' }
    ],
    invoiceAudit: [
      { id: 'iau-0', invoiceId: 'inv-b', event: 'gepubliceerd', detail: 'Factuur gepubliceerd', createdAt: '2026-07-28T14:05:00Z' },
      { id: 'iau-1', invoiceId: 'inv-b', event: 'bezwaar_klant', fromStatus: 'overdue', toStatus: 'disputed', detail: 'De polijstronde zat in de toolingprijs.', createdAt: '2026-08-29T09:05:00Z' }
    ],
    clientPayments: [
      { id: 'pay-1', invoiceId: 'inv-a', paidOn: '2026-08-28', amountCents: 187500, currency: 'EUR', reportedByClient: true, clientReference: 'REQ 0402', verifiedAt: null, createdAt: '2026-08-29' },
      { id: 'pay-2', invoiceId: 'inv-c', paidOn: '2026-08-20', amountCents: 50000, currency: 'EUR', reportedByClient: true, clientReference: '', verifiedAt: null, createdAt: '2026-08-25' },
      { id: 'pay-3', invoiceId: 'inv-a', paidOn: '2026-08-10', amountCents: 10000, currency: 'EUR', reportedByClient: true, clientReference: 'x', verifiedAt: '2026-08-12T08:00:00Z', createdAt: '2026-08-11' },
      { id: 'pay-4', invoiceId: 'inv-a', paidOn: '2026-08-05', amountCents: 25000, currency: 'EUR', reportedByClient: false, verifiedAt: null, createdAt: '2026-08-05' }
    ],
    documents: [
      { id: 'doc-k1', projectId: 'pr-9', stageKey: 'sourcing', docType: 'artwork', title: 'Etiket — nieuwe huisstijl', uploadedBy: 'klant', clientNote: 'Definitieve versie.', slotId: 'slot-3', publishStatus: 'published', createdAt: '2026-08-28' },
      { id: 'doc-k2', projectId: 'pr-1', docType: 'artwork', title: 'Oud logo', uploadedBy: 'klant', clientNote: '', publishStatus: 'published', createdAt: '2026-08-20' },
      { id: 'doc-s1', projectId: 'pr-1', docType: 'quote', title: 'Offerte', uploadedBy: 'staf', publishStatus: 'published', createdAt: '2026-08-29' },
      { id: 'doc-k3', projectId: 'pr-1', docType: 'artwork', title: 'Zonder datum', uploadedBy: 'klant', publishStatus: 'published' }
    ],
    samples: [
      { id: 'smp-a', projectId: 'pr-1', roundLabel: 'T1', roundDate: '2026-08-20', status: 'reviewed', note: 'T1 naast T0', clientDecision: 'aanpassing', clientNote: 'De schouder is nog dof.', clientDecidedAt: '2026-08-27T08:15:00Z', clientMarks: [{ x: 0.5, y: 0.4, tekst: 'hier' }] },
      { id: 'smp-b', projectId: 'pr-2', roundLabel: 'T1', roundDate: '2026-07-01', status: 'superseded', clientDecision: 'aanpassing', clientNote: 'Dof.', clientDecidedAt: '2026-07-05T08:15:00Z', clientMarks: [] },
      { id: 'smp-c', projectId: 'pr-2', roundLabel: 'T2', roundDate: '2026-08-22', status: 'reviewed', note: 'gepolijst', clientDecision: null, clientNote: '', clientDecidedAt: null, clientMarks: [] }
    ]
  };
  const KLANT_INBOX = M.collectInbox(KLANT_BRON);

  /* --- betaling gemeld --- */
  {
    const p1 = pick(KLANT_INBOX, 'betaling', 'pay-1');
    t.true(!!p1, 'een door de klant gemelde, nog niet bevestigde betaling is een Inbox-item');
    t.eq(p1 && p1.chip, 'wachtopmij', 'en die wacht op mij: ik moet hem controleren en bevestigen');
    t.eq(p1 && p1.owner, 'mij', 'de eigenaar is mij, zonder dat iemand dat instelde');
    t.eq(p1 && p1.title, 'Betaling gemeld: € 1.875,00 op factuur 2026-013',
      'de titel noemt het bedrag in euro met twee decimalen en het factuurnummer — geld is gehele centen en wordt hier één keer tekst');
    t.true(p1 && p1.sub.indexOf('kenmerk REQ 0402') > -1, 'de ondertitel draagt het kenmerk dat de klant opgaf');
    t.true(p1 && p1.sub.indexOf('overgemaakt 28 aug 2026') > -1, 'en de dag waarop de klant zegt te hebben overgemaakt');
    t.false(p1 && p1.urgent, 'een melding van gisteren is nog niet urgent');
    t.eq(p1 && p1.clientId, 'cl-1', 'de klant komt via de factuur en het project');
    t.eq(p1 && p1.projectId, 'pr-1', 'het project komt van de factuur');
    t.eq(p1 && p1.at, '2026-08-29', 'het item is zo oud als de melding, niet als de overmaking');
    t.eq(p1 && p1.sourceId, 'pay-1', 'de bron is de betalingsrij zelf: daar hangt verify_payment_report aan');

    const p2 = pick(KLANT_INBOX, 'betaling', 'pay-2');
    t.true(p2 && p2.urgent, 'een melding van vijf dagen oud is urgent: na drie dagen hoort de klant "klopt" te hebben gehoord');
    t.eq(p2 && p2.title, 'Betaling gemeld: € 500,00 op factuur 2026-011', 'ook een bedrag onder de duizend wordt netjes geschreven');
    t.true(p2 && p2.sub.indexOf('zonder kenmerk') === 0, 'geen kenmerk opgegeven staat er eerlijk bij');

    t.eq(pick(KLANT_INBOX, 'betaling', 'pay-3'), null, 'een al bevestigde melding (verifiedAt gevuld) is klaar en geen item meer');
    t.eq(pick(KLANT_INBOX, 'betaling', 'pay-4'), null,
      'een gewone stafboeking (reportedByClient false) is nooit een item, ook niet zonder verifiedAt: dat veld betekent daar niets');

    /* de grens van drie dagen, op de dag af */
    function meldingVan(dag) {
      const uit = M.collectInbox({ now: NU, invoices: KLANT_BRON.invoices, projects: KLANT_BRON.projects,
        clientPayments: [{ id: 'pay-x', invoiceId: 'inv-a', amountCents: 100, currency: 'EUR', reportedByClient: true, verifiedAt: null, createdAt: dag }] });
      return pick(uit, 'betaling', 'pay-x');
    }
    t.false(meldingVan('2026-08-27').urgent, 'precies drie dagen is nog niet urgent — dezelfde grens als najagen');
    t.true(meldingVan('2026-08-26').urgent, 'vier dagen wél');

    /* de naam van de lijst */
    const viaOud = M.collectInbox({ now: NU, invoices: KLANT_BRON.invoices, projects: KLANT_BRON.projects, invoicePayments: KLANT_BRON.clientPayments });
    t.eq(viaOud.filter(function (it) { return it.kind === 'betaling'; }).length, 2,
      'onder de oude naam invoicePayments (demo en beheer.html) komen dezelfde twee meldingen binnen');
    const legeNieuw = M.collectInbox({ now: NU, invoices: KLANT_BRON.invoices, projects: KLANT_BRON.projects, clientPayments: [], invoicePayments: KLANT_BRON.clientPayments });
    t.eq(legeNieuw.filter(function (it) { return it.kind === 'betaling'; }).length, 0,
      'een expliciet meegegeven clientPayments wint van invoicePayments, ook als hij leeg is: de aanroeper zei wat hij bedoelde');

    /* een wees: de factuur ontbreekt in de lijst */
    const wees = M.collectInbox({ now: NU, clientPayments: [{ id: 'pay-w', invoiceId: 'inv-zoek', amountCents: 12345, currency: 'USD', reportedByClient: true, verifiedAt: null, createdAt: '2026-08-29' }] });
    t.eq(pick(wees, 'betaling', 'pay-w').title, 'Betaling gemeld: $ 123,45 op factuur inv-zoek',
      'zonder factuurrij blijft de melding staan met het factuur-id als naam en de eigen munt: de melding wacht evengoed');
    t.eq(pick(wees, 'betaling', 'pay-w').projectId, null, 'en zonder factuur is er eerlijk geen project');
  }

  /* --- bestand van de klant --- */
  {
    const d1 = pick(KLANT_INBOX, 'klantbestand', 'doc-k1');
    t.true(!!d1, 'een bestand dat de klant twee dagen geleden in een slot aanleverde is een Inbox-item');
    t.eq(d1 && d1.chip, 'wachtopmij', 'en het wacht op mij');
    t.eq(d1 && d1.title, 'Etiket — nieuwe huisstijl', 'de titel is die van het document');
    t.eq(d1 && d1.sub, 'aangeleverd door de klant · Definitieve versie. · Inkoop en Leveranciers',
      'de ondertitel zegt wie het aanleverde, wat de klant erbij schreef en de vertaalde fasenaam');
    t.eq(d1 && d1.clientId, 'cl-3', 'ook op een gearchiveerd project telt het bestand: het artwork voor een herbestelling komt juist daar');
    t.eq(d1 && d1.at, '2026-08-28', 'het item is zo oud als de upload');

    t.eq(pick(KLANT_INBOX, 'klantbestand', 'doc-k2'), null,
      'een bestand van tien dagen oud valt af: er is geen reviewedAt-veld, dus het item verdwijnt op ouderdom en niet op een handeling');
    t.eq(pick(KLANT_INBOX, 'klantbestand', 'doc-s1'), null, 'een stafdocument is nooit een bestand van de klant');
    t.eq(pick(KLANT_INBOX, 'klantbestand', 'doc-k3'), null,
      'een document zonder createdAt kan geen "jonger dan zeven dagen" bewijzen en valt af — liever een gat dat opvalt dan een item dat nooit meer weggaat');

    function bestandVan(dag) {
      const uit = M.collectInbox({ now: NU, documents: [{ id: 'doc-x', projectId: 'pr-1', title: 'x', uploadedBy: 'klant', createdAt: dag }] });
      return pick(uit, 'klantbestand', 'doc-x');
    }
    t.true(!!bestandVan('2026-08-24'), 'zes dagen oud staat er nog');
    t.eq(bestandVan('2026-08-23'), null, 'zeven dagen oud niet meer: de grens is jonger dan zeven');
    t.eq(bestandVan('2026-08-30').title, 'x', 'vandaag geüpload telt uiteraard');
  }

  /* --- samplebeslissing: de klant vroeg een aanpassing --- */
  {
    const s = pick(KLANT_INBOX, 'samplebeslissing', 'smp-a');
    t.true(!!s, 'een nieuwste ronde waarop de klant een aanpassing vroeg is een Inbox-item');
    t.eq(s && s.chip, 'wachtopmij', 'en die wacht op mij: een nieuwe ronde maken');
    t.eq(s && s.title, 'Sample T1: aanpassing gevraagd', 'de titel noemt de ronde en de beslissing');
    t.eq(s && s.sub, 'De schouder is nog dof. · 1 aanwijzing op de foto · nieuwe ronde maken',
      'de ondertitel draagt de opmerking van de klant en het aantal aanwijzingen op de foto');
    t.eq(s && s.at, '2026-08-27T08:15:00Z', 'het item is zo oud als de beslissing van de klant');
    t.eq(pick(KLANT_INBOX, 'sample', 'smp-a'), null,
      'ONTDUBBELING: diezelfde ronde staat NIET óók als "wacht op keuze van de klant" — de status bleef reviewed, maar de klant heeft gekozen');
    t.eq(pick(KLANT_INBOX, 'samplebeslissing', 'smp-b'), null,
      'een aanpassing waar al een nieuwere ronde op volgde is verwerkt en vraagt niets meer');
    t.eq(chipOf(KLANT_INBOX, 'sample', 'smp-c'), 'wachtopklant',
      'en die nieuwere ronde zonder klantbeslissing wacht gewoon nog op de klant, zoals altijd');

    const goed = M.collectInbox({ now: NU, projects: KLANT_BRON.projects,
      samples: [{ id: 'smp-g', projectId: 'pr-1', roundLabel: 'T2', roundDate: '2026-08-25', status: 'approved', clientDecision: 'goedgekeurd', clientNote: 'Dit is hem.', clientDecidedAt: '2026-08-26T10:40:00Z', clientMarks: [] }] });
    t.eq(goed.length, 0, 'een goedgekeurde ronde is geen item van welke soort ook: decide_sample zette hem zelf op approved en dat was het werk');

    const meerMarks = M.collectInbox({ now: NU, projects: KLANT_BRON.projects,
      samples: [{ id: 'smp-m', projectId: 'pr-1', roundLabel: 'T3', roundDate: '2026-08-25', status: 'reviewed', clientDecision: 'aanpassing', clientNote: '', clientDecidedAt: '2026-08-26T10:40:00Z', clientMarks: [{ x: 0.1, y: 0.1, tekst: 'a' }, { x: 0.2, y: 0.2, tekst: 'b' }] }] });
    t.eq(pick(meerMarks, 'samplebeslissing', 'smp-m').sub, '2 aanwijzingen op de foto · nieuwe ronde maken',
      'zonder opmerking maar met twee aanwijzingen staat er het meervoud en geen lege plek');
  }

  /* --- bezwaar op een factuur --- */
  {
    const b = pick(KLANT_INBOX, 'bezwaar', 'inv-b');
    t.true(!!b, 'een factuur met statusCode disputed is een Inbox-item');
    t.eq(b && b.chip, 'wachtopmij', 'dat op mij wacht');
    t.true(b && b.urgent, 'en altijd urgent is: een betwiste factuur staat stil tot ik iets doe');
    t.eq(b && b.title, 'Bezwaar op factuur Meerwerk — polijstronde', 'zonder factuurnummer draagt de titel het label, zoals 0021 dat ook kiest');
    t.eq(b && b.sub, 'De polijstronde zat in de toolingprijs. · open € 420,00',
      'de reden komt uit het factuurlogboek (event bezwaar_klant), want 0021 zet hem niet op de factuur; het open bedrag staat erachter');
    t.eq(b && b.at, '2026-08-29T09:05:00Z', 'het item is zo oud als het bezwaar');
    t.eq(b && b.clientId, 'cl-2', 'de klant komt via het project van de factuur');
    t.eq(pick(KLANT_INBOX, 'bezwaar', 'inv-a'), null, 'een verstuurde factuur zonder bezwaar hoort in Financiën en niet hier');
    t.eq(pick(KLANT_INBOX, 'factuur', 'inv-b'), null, 'en de betwiste factuur is geen conceptfactuur: hij staat één keer in de Inbox, als bezwaar');

    const zonderLogboek = M.collectInbox({ now: NU, projects: KLANT_BRON.projects, invoices: KLANT_BRON.invoices });
    t.eq(pick(zonderLogboek, 'bezwaar', 'inv-b').sub, 'reden in het factuurlogboek · open € 420,00',
      'zonder invoiceAudit zegt de regel eerlijk waar de reden staat in plaats van hem te verzinnen');
    t.eq(pick(zonderLogboek, 'bezwaar', 'inv-b').at, '2026-08-29T09:05:00Z', 'en valt voor de ouderdom terug op updatedAt van de factuur');
  }

  /* --- de sleutels: eigen voorvoegsels, zodat de oude itemState niet meelekt --- */
  t.eq(M.itemKey('betaling', 'pay-1'), 'pay:pay-1', 'een gemelde betaling krijgt het nieuwe voorvoegsel pay:');
  t.eq(M.itemKey('klantbestand', 'doc-k1'), 'upl:doc-k1', 'een bestand van de klant krijgt upl:, en niet cpt: van een concept');
  t.eq(M.itemKey('samplebeslissing', 'smp-a'), 'dec:smp-a', 'een samplebeslissing krijgt dec:, en niet smp: van de ronde die op de klant wachtte');
  t.eq(M.itemKey('bezwaar', 'inv-b'), 'disp:inv-b', 'een bezwaar krijgt disp:, en niet inv: van de factuur zelf');
  {
    const oudeStaat = M.collectInbox(Object.assign({}, KLANT_BRON, {
      settings: { itemState: { 'smp:smp-a': { owner: 'klant', snoozedUntil: '2026-09-20' }, 'inv:inv-b': { owner: 'fabriek' } } }
    }));
    t.eq(pick(oudeStaat, 'samplebeslissing', 'smp-a').owner, 'mij',
      'een eigenaar die vorige week op de ronde-als-sample stond (smp:) lekt NIET in de samplebeslissing: de klant heeft net gehandeld, het werk begint schoon bij mij');
    t.eq(pick(oudeStaat, 'samplebeslissing', 'smp-a').snoozedUntil, null, 'en de snooze van dat oude item ook niet');
    t.eq(pick(oudeStaat, 'bezwaar', 'inv-b').owner, 'mij', 'hetzelfde voor een bezwaar naast een factuursignaal (inv:) dat bij de fabriek lag');

    const nieuweStaat = M.collectInbox(Object.assign({}, KLANT_BRON, {
      settings: { itemState: { 'dec:smp-a': { snoozedUntil: '2026-09-20' }, 'pay:pay-1': { owner: 'klant' } } }
    }));
    t.eq(pick(nieuweStaat, 'samplebeslissing', 'smp-a').snoozedUntil, '2026-09-20', 'op de eigen sleutel werkt parkeren gewoon');
    t.eq(pick(nieuweStaat, 'betaling', 'pay-1').chip, 'wachtopklant', 'en de bal verleggen ook: de chip volgt de bal, net als bij elk ander itemtype');
    t.eq(M.inboxBadgeCount(nieuweStaat, NU), 3, 'de badge zakt dan van vijf naar drie: één geparkeerd, één bij de klant');
  }

  /* --- de badge telt ze mee, en de bakken vertellen hetzelfde verhaal --- */
  t.eq(M.inboxBadgeCount(KLANT_INBOX, NU), 5,
    'de badge telt vijf: twee gemelde betalingen, een bestand, een samplebeslissing en een bezwaar — de ronde die op de klant wacht niet');
  t.eq(M.filterInbox(KLANT_INBOX, 'wachtopmij').length, 5, 'en precies die vijf staan onder Wacht op mij');
  t.eq(M.filterInbox(KLANT_INBOX, 'wachtopklant').length, 1, 'onder Wacht op klant staat alleen de ronde zonder klantbeslissing');
  t.eq(M.filterInbox(KLANT_INBOX, 'alles').length, 6, 'Alles is zes: elk item valt in één bak');
  ['betaling', 'klantbestand', 'samplebeslissing', 'bezwaar'].forEach(function (soort) {
    t.true(M.filterInbox(KLANT_INBOX, 'alles', { kind: soort }).length >= 1,
      'het soortfilter van de Inbox (extra.kind) kent de nieuwe soort ' + soort);
  });
  {
    let som = 0;
    ['nieuw', 'wachtopmij', 'wachtopklant', 'goedkeuringen', 'concepten', 'gepland'].forEach(function (c) { som += M.filterInbox(KLANT_INBOX, c).length; });
    t.eq(som, M.filterInbox(KLANT_INBOX, 'alles').length, 'de zes open bakken zijn samen precies Alles, ook met de vier nieuwe soorten erin');
    let uitBakken = 0;
    ['nieuw', 'wachtopmij', 'concepten'].forEach(function (c) { uitBakken += M.filterInbox(KLANT_INBOX, c).length; });
    t.eq(uitBakken, M.inboxBadgeCount(KLANT_INBOX, NU), 'de badge nagerekend uit de bakken geeft hetzelfde getal als inboxBadgeCount');
  }

  /* --- de bestaande ontdubbeling blijft heel --- */
  {
    const samen = M.collectInbox(Object.assign({}, BASIS_DUO, {
      clientPayments: KLANT_BRON.clientPayments, documents: KLANT_BRON.documents,
      samples: KLANT_BRON.samples, invoiceAudit: KLANT_BRON.invoiceAudit,
      invoices: BASIS_DUO.invoices.concat(KLANT_BRON.invoices),
      projects: KLANT_BRON.projects
    }));
    t.eq(samen.filter(function (it) { return it.kind === 'factuur'; }).length, 1, 'de conceptfactuur staat er nog precies één keer');
    t.eq(samen.filter(function (it) { return it.kind === 'concept'; }).length, 0,
      'en haar factuurdocument blijft weggeslikt: de nieuwe soorten raken de ontdubbeling conceptfactuur ↔ factuurdocument niet');
    t.eq(M.inboxBadgeCount(samen, NU), 6, 'de badge telt de conceptfactuur plus de vijf klantacties: zes');
  }

  /* --- lege en rare bronnen --- */
  t.deep(M.collectInbox({ now: NU, clientPayments: null, documents: 'onzin', invoiceAudit: 7, samples: {} }), [],
    'rare waarden voor de nieuwe lijsten leveren niets op en geen exception');
  t.eq(M.collectInbox({ now: NU, clientPayments: [null, {}, { reportedByClient: true }] }).length, 0,
    'een melding zonder id valt af, net als elk ander item zonder id');
  t.eq(M.collectInbox(BRON).filter(function (it) { return ['betaling', 'klantbestand', 'samplebeslissing', 'bezwaar', 'herbestelling'].indexOf(it.kind) > -1; }).length, 0,
    'de bron van vóór 0021 (zonder de nieuwe lijsten en velden) levert geen enkele klantactie op — een oudere aanroeper merkt niets');

  /* --- de vlag doorKlant op het item zelf --- */
  t.true(pick(KLANT_INBOX, 'betaling', 'pay-1').doorKlant, 'een gemelde betaling draagt doorKlant true op het item: het scherm hoeft het niet zelf af te leiden');
  t.true(pick(KLANT_INBOX, 'klantbestand', 'doc-k1').doorKlant, 'een bestand van de klant ook');
  t.true(pick(KLANT_INBOX, 'samplebeslissing', 'smp-a').doorKlant, 'een samplebeslissing ook');
  t.true(pick(KLANT_INBOX, 'bezwaar', 'inv-b').doorKlant, 'een bezwaar mét regel bezwaar_klant in het factuurlogboek is door de klant');
  t.false(pick(M.collectInbox({ now: NU, projects: KLANT_BRON.projects, invoices: KLANT_BRON.invoices }), 'bezwaar', 'inv-b').doorKlant,
    'zonder dat logboek blijft de vlag eerlijk uit: statusCode disputed kan ook met de hand gezet zijn ("Als betwist markeren" in de editor)');
  t.false(pick(KLANT_INBOX, 'sample', 'smp-c').doorKlant, 'een ronde die op de klant wacht is niet door de klant gedaan');
  t.eq(typeof pick(INBOX, 'vraag', 'q-1').doorKlant, 'boolean', 'het veld staat op ELK item, ook op een klantvraag van vóór 0021 — een vlag is nooit undefined');

  /* ============================================================
     11b. INBOX — DE HERBESTELLING UIT 0021 (reorder_requests)

     De vijfde klantactie. Vóór 0021 was een herbestelling een klantvraag
     met het voorvoegsel HERBESTELLING: (groep 4 hierboven); 0021 maakt er
     een eigen tabel van met een statuskolom in de vier stappen van
     REORDER_STAGES. De veldnamen zijn die van demo-data-portaal.js (ro-01):
     qty, wantedBy, sameSpec, changeNote, status, clientId.
     ============================================================ */
  t.group('inbox: herbestelling uit 0021');

  const RO_BRON = {
    now: NU,
    projects: [
      /* een herbestelling landt per definitie op een AFGEROND product */
      { id: 'pr-af', clientId: 'cl-1', name: 'Amberglazen geurflacon', status: 'archived' },
      { id: 'pr-1', clientId: 'cl-1', name: 'Diffuser', status: 'active' }
    ],
    reorders: [
      { id: 'ro-1', projectId: 'pr-af', clientId: 'cl-1', qty: 3000, wantedBy: '2026-11-20', sameSpec: false, changeNote: 'nieuw etiket', status: 'offerte', createdAt: '2026-08-25T10:12:00Z', updatedAt: '2026-08-27T14:30:00Z' },
      { id: 'ro-2', projectId: 'pr-1', clientId: 'cl-1', qty: 500, wantedBy: '2026-10-01', sameSpec: true, changeNote: '', status: 'aanvraag', createdAt: '2026-08-28T09:00:00Z' },
      { id: 'ro-3', projectId: 'pr-1', clientId: 'cl-1', qty: 200, wantedBy: '2026-09-15', sameSpec: true, status: 'project', createdAt: '2026-08-01' },
      { id: 'ro-4', projectId: 'pr-1', clientId: 'cl-1', qty: 120, wantedBy: '2026-08-20', sameSpec: true, status: '', createdAt: '2026-08-10' }
    ]
  };
  const RO_INBOX = M.collectInbox(RO_BRON);

  {
    const r1 = pick(RO_INBOX, 'herbestelling', 'ro-1');
    t.true(!!r1, 'een herbestelling uit reorder_requests is een Inbox-item van de eigen soort herbestelling');
    t.eq(r1 && r1.chip, 'wachtopmij', 'en die wacht op mij: de klant heeft geleverd');
    t.eq(r1 && r1.title, 'Herbestelling Amberglazen geurflacon: 3.000 stuks', 'de titel noemt het product en het aantal, met duizendtal');
    t.eq(r1 && r1.sub, 'gewenst op 20 nov 2026 · stap 2 van 4: Offerte · met wijziging',
      'de ondertitel draagt de gewenste datum, de stap uit de STATUSKOLOM en of de spec wijzigt');
    t.eq(r1 && r1.pipeline && r1.pipeline.stage, 'offerte', 'de pijplijn op het item volgt de kolom status van de rij');
    t.eq(r1 && r1.pipeline && r1.pipeline.next && r1.pipeline.next.key, 'akkoord', 'en kent de volgende stap');
    t.eq(r1 && r1.clientId, 'cl-1', 'de klant komt van de rij zelf (0021 zet clientId apart)');
    t.eq(r1 && r1.projectId, 'pr-af', 'ook op een gearchiveerd product blijft hij staan: daar hoort een herbestelling');
    t.true(r1 && r1.doorKlant, 'en hij is door de klant');
    t.eq(r1 && r1.at, '2026-08-25T10:12:00Z', 'de ouderdom is het moment van aanvragen, niet van de laatste stap');
  }
  t.eq(M.itemKey('herbestelling', 'ro-1'), 'ro:ro-1', 'een herbestelling krijgt het eigen voorvoegsel ro:, niet q: van de oude vraagvorm');
  t.eq(pick(RO_INBOX, 'herbestelling', 'ro-3'), null, 'een rij op status project is klaar en geen item meer');
  t.eq(pick(RO_INBOX, 'herbestelling', 'ro-2').sub, 'gewenst op 1 okt 2026 · stap 1 van 4: Aanvraag · zelfde specificatie', 'zelfde specificatie staat er in woorden');
  {
    const r4 = pick(RO_INBOX, 'herbestelling', 'ro-4');
    t.eq(r4 && r4.pipeline && r4.pipeline.stage, 'aanvraag', 'een lege statuskolom is de beginstand aanvraag, net als reorderPipelineOf');
    t.true(r4 && r4.urgent, 'een gewenste datum die verstreken is terwijl er nog geen project is, is urgent');
    t.false(pick(RO_INBOX, 'herbestelling', 'ro-1').urgent, 'een gewenste datum in de toekomst niet');
  }
  {
    const metStand = M.collectInbox(Object.assign({}, RO_BRON, {
      settings: { reorderPipeline: { 'ro-4': { stage: 'akkoord', quoteDocId: 'doc-q' }, 'ro-1': { stage: 'aanvraag', projectId: 'pr-batch' } } }
    }));
    t.eq(pick(metStand, 'herbestelling', 'ro-4').pipeline.stage, 'akkoord', 'zonder kolom valt de stap terug op settings.reorderPipeline');
    t.eq(pick(metStand, 'herbestelling', 'ro-4').pipeline.quoteDocId, 'doc-q', 'en het offerteconcept komt daar altijd vandaan: 0021 zet het niet op de rij');
    t.eq(pick(metStand, 'herbestelling', 'ro-1').pipeline.stage, 'offerte', 'maar mét kolom wint de kolom van een oudere opgeslagen stand');
    t.eq(pick(metStand, 'herbestelling', 'ro-1').pipeline.projectId, 'pr-batch', 'terwijl het batchproject uit de opgeslagen stand wél meereist');
  }
  t.eq(M.inboxBadgeCount(RO_INBOX, NU), 3, 'de badge telt de drie open herbestellingen mee');
  t.eq(M.filterInbox(RO_INBOX, 'wachtopmij').length, 3, 'en precies die drie staan onder Wacht op mij');
  t.eq(M.filterInbox(RO_INBOX, 'alles', { kind: 'herbestelling' }).length, 3, 'het soortfilter van de Inbox kent de soort herbestelling');
  {
    const geparkeerd = M.collectInbox(Object.assign({}, RO_BRON, { settings: { itemState: { 'ro:ro-2': { snoozedUntil: '2026-09-20' }, 'q:ro-1': { owner: 'klant' } } } }));
    t.eq(pick(geparkeerd, 'herbestelling', 'ro-2').snoozedUntil, '2026-09-20', 'op de eigen sleutel werkt parkeren');
    t.eq(pick(geparkeerd, 'herbestelling', 'ro-1').owner, 'mij', 'een stand op de oude vraagsleutel (q:) lekt niet in de nieuwe rij');
    t.eq(M.inboxBadgeCount(geparkeerd, NU), 2, 'de badge zakt met het geparkeerde item mee');
  }
  t.eq(M.collectInbox({ now: NU, reorderRequests: RO_BRON.reorders, projects: RO_BRON.projects }).filter(function (it) { return it.kind === 'herbestelling'; }).length, 3,
    'de lijst mag ook reorderRequests heten — de naam waaronder beheer.html en de demo hem kennen');
  t.eq(M.collectInbox({ now: NU, reorders: [], reorderRequests: RO_BRON.reorders }).length, 0,
    'een expliciet meegegeven reorders wint, ook als hij leeg is');
  t.eq(M.collectInbox({ now: NU, reorders: [null, {}, { qty: 5 }, { id: 'ro-x', qty: 'veel' }] }).length, 1,
    'rijen zonder id vallen af; een rij met een onleesbaar aantal blijft staan');
  t.eq(pick(M.collectInbox({ now: NU, reorders: [{ id: 'ro-x', qty: 'veel' }] }), 'herbestelling', 'ro-x').title, 'Herbestelling: aantal onbekend',
    'en zegt dan eerlijk dat het aantal onbekend is, zonder product als er geen project is');
  t.deep(M.collectInbox({ now: NU, reorders: 'onzin', reorderRequests: 7 }), [], 'rare waarden leveren niets op en geen exception');

  /* ============================================================
     12. DOORKLANT — WIE DEED HET

     Migratie 0021 markeert per tabel anders wie iets deed. Projectdetail,
     klantdetail en de tijdlijn horen op één plek te vragen "deed de klant
     dit?", anders wordt "door klant" op drie schermen net anders afgeleid.
     ============================================================ */
  t.group('doorKlant: wie deed het');

  t.true(M.doorKlant({ stageKey: 'tooling', status: 'done', approvedAt: '2026-07-21', approvedBy: 'Noor van Dijk', approvedVia: 'portaal' }),
    'een fase met approvedVia portaal is door de klant goedgekeurd (approve_stage)');
  t.false(M.doorKlant({ stageKey: 'dfm', status: 'done', approvedBy: 'Noor van Dijk', approvedVia: 'beheer' }),
    'via het beheer legde de eigenaar het akkoord zelf vast — niet door de klant, ook al staat haar naam erbij');
  t.false(M.doorKlant({ stageKey: 'concept', status: 'done', approvedAt: '2025-12-19', approvedBy: '', approvedVia: null }),
    'een fase van vóór 0021 (approvedVia null) is onbekend, en onbekend is niet "door klant"');
  t.false(M.doorKlant({ stageKey: 'production', status: 'awaiting_approval' }), 'een fase die nog op akkoord wacht is door niemand gedaan');

  t.true(M.doorKlant({ roundLabel: 'T1', status: 'superseded', clientDecision: 'aanpassing', clientNote: 'dof' }),
    'een sampleronde met clientDecision aanpassing is door de klant beoordeeld, ook al verdrong de staf hem daarna');
  t.true(M.doorKlant({ roundLabel: 'T2', status: 'approved', clientDecision: 'goedgekeurd' }), 'goedgekeurd door de klant telt ook');
  t.false(M.doorKlant({ roundLabel: 'P1', status: 'reviewed', clientDecision: null, clientNote: '' }),
    'een ronde zonder klantbeslissing is door de staf beoordeeld, niet door de klant');
  t.false(M.doorKlant({ roundLabel: 'X', clientDecision: 'misschien' }), 'een onbekende beslissingswaarde is geen beslissing');

  t.true(M.doorKlant({ title: 'Etiket', uploadedBy: 'klant', clientNote: 'definitief', slotId: 'slot-3' }), 'een document met uploadedBy klant komt uit de klantbucket');
  t.false(M.doorKlant({ title: 'Offerte', uploadedBy: 'staf' }), 'een stafdocument niet');
  t.false(M.doorKlant({ title: 'Oud rapport', docType: 'inspection' }), 'een document zonder uploadedBy is van vóór 0021 en dus van de staf (de databasestandaard)');

  t.true(M.doorKlant({ id: 'cc-01', name: 'Sanne Vermeulen', email: 'sanne@x.nl', role: 'Inkoop', mailCategories: ['fase', 'sample'], canLogin: true, avatarUrl: '' }),
    'een contactpersoon in de vorm van client_contacts (mailCategories, canLogin) is door de klant beheerd — 0021 zet geen vlag, de tabel ís de herkomst');
  t.false(M.doorKlant({ id: 'ct-01', name: 'Rens de Boer', email: 'rens@x.nl', role: 'Inkoop', lang: 'nl', cats: ['fase'], active: true }),
    'een contactpersoon in de vorm van admin_contacts (cats, active) is van de staf');
  t.true(M.doorKlant({ name: 'Iris', bron: 'klant' }), 'een stempel van de datalaag (bron klant) wint, ook zonder de kenmerkende velden');
  t.false(M.doorKlant({ name: 'Iris', bron: 'staf', mailCategories: ['update'], canLogin: false }),
    'en een stempel staf wint óók van de vorm: de datalaag weet het beter dan een gok op velden');
  t.true(M.doorKlant({ name: 'Iris', herkomst: 'klant' }), 'herkomst is een geldige naam voor dat stempel');
  t.true(M.doorKlant({ name: 'Iris', source: 'klant' }), 'source ook');

  t.true(M.doorKlant({ id: 'pay-p01', reportedByClient: true, verifiedAt: null }), 'een gemelde betaling is door de klant gemeld (geen van de vier, maar dezelfde vraag)');
  t.false(M.doorKlant({ id: 'pay-1', reportedByClient: false }), 'een stafboeking niet');

  t.true(M.doorKlant({ id: 'ro-01', projectId: 'pr-1', qty: 3000, wantedBy: '2026-11-20', sameSpec: false, changeNote: 'etiket', status: 'offerte' }),
    'een rij in de vorm van reorder_requests (sameSpec naast qty/wantedBy) is door de klant: alleen request_reorder() vult die tabel');
  t.false(M.doorKlant({ id: 'q-2', question: 'HERBESTELLING: 200 stuks', askedAt: '2026-08-28' }),
    'de oude herbestelling-als-vraag heeft die velden niet en blijft wat hij was');
  t.false(M.doorKlant({ id: 'inv-05', statusCode: 'disputed', reminderPaused: true }),
    'een betwiste factuur bewijst uit zichzelf niet dat de klant het deed — de editor kent "Als betwist markeren" met de hand');

  t.false(M.doorKlant(null), 'null is niet door de klant en geen exception');
  t.false(M.doorKlant(undefined), 'undefined ook niet');
  t.false(M.doorKlant('klant'), 'een kale tekst is geen rij');
  t.false(M.doorKlant({}), 'een lege rij is van niemand');
  t.false(M.doorKlant([]), 'een lijst is geen rij');

  /* ============================================================
     13. ACTIVITEIT — DE KLANTACTIES UIT 0021 ALS EIGEN SOORT

     portaal_log() schrijft elke klantactie twee keer: in access_log (met
     action) en in admin_audit_log (kind klant, alleen de tekst), met
     woordelijk dezelfde tekst en hetzelfde tijdstip. De tijdlijn hoort die
     tweeling één keer te tonen (beslissing 2.6), onder de soort die spec §2
     vraagt: akkoord, samplekeuze, betaling gemeld, bestand, bezwaar.
     De teksten hieronder zijn die van demo-data-portaal.js.
     ============================================================ */
  t.group('activiteit: klantacties uit 0021');

  const KA_BRON = {
    projects: [{ id: 'pr-1', clientId: 'cl-1' }],
    stageLabel: function (k) { return k === 'tooling' ? 'Tooling, Sampling & Iteratie' : k; },
    accessLog: [
      { id: 'log-p01', projectId: 'pr-1', actor: 'client', assetKind: 'sample', assetId: 'smp-t1', action: 'decide', detail: 'Sample T1: aanpassing gevraagd door klant — dof (1 aanwijzing(en) op de foto)', createdAt: '2026-06-27T08:15:00Z' },
      { id: 'log-p03', projectId: 'pr-1', actor: 'client', assetKind: 'stage', assetId: null, action: 'approve', detail: 'Fase goedgekeurd door Noor van Dijk: Tooling, Sampling & Iteratie', createdAt: '2026-07-21T10:44:00Z' },
      { id: 'log-p05', projectId: 'pr-1', actor: 'client', assetKind: 'reorder', assetId: 'ro-01', action: 'reorder', detail: 'Herbestelling aangevraagd: 3000 stuks, zelfde specificatie', createdAt: '2026-08-31T10:12:00Z' },
      { id: 'log-p06', projectId: 'pr-1', actor: 'client', assetKind: 'invoice', assetId: 'inv-05', action: 'dispute', detail: 'Bezwaar op factuur Meerwerk: te duur', createdAt: '2026-09-01T09:05:00Z' },
      { id: 'log-p07', projectId: 'pr-1', actor: 'client', assetKind: 'document', assetId: 'doc-10', action: 'upload', detail: 'Bestand aangeleverd door klant: Etiket — definitief', createdAt: '2026-09-03T09:48:00Z' },
      { id: 'log-p08', projectId: 'pr-1', actor: 'client', assetKind: 'invoice', assetId: 'inv-04', action: 'report_payment', detail: 'Betaling gemeld op factuur 15%: 187500 centen EUR op 03-09-2026, kenmerk REQ', createdAt: '2026-09-04T10:15:00Z' },
      { id: 'log-x', projectId: 'pr-1', actor: 'client', assetKind: 'document', action: 'download', detail: 'Offerte', createdAt: '2026-09-02T10:00:00Z' }
    ],
    auditLog: [
      { id: 'aud-p01', kind: 'klant', clientId: 'cl-1', projectId: 'pr-1', detail: 'Sample T1: aanpassing gevraagd door klant — dof (1 aanwijzing(en) op de foto)', createdAt: '2026-06-27T08:15:00Z' },
      { id: 'aud-p03', kind: 'klant', clientId: 'cl-1', projectId: 'pr-1', detail: 'Fase goedgekeurd door Noor van Dijk: Tooling, Sampling & Iteratie', createdAt: '2026-07-21T10:44:00Z' },
      { id: 'aud-p05', kind: 'klant', clientId: 'cl-1', projectId: 'pr-1', detail: 'Herbestelling aangevraagd: 3000 stuks, zelfde specificatie', createdAt: '2026-08-31T10:12:00Z' },
      { id: 'aud-p06', kind: 'klant', clientId: 'cl-1', projectId: 'pr-1', detail: 'Bezwaar op factuur Meerwerk: te duur', createdAt: '2026-09-01T09:05:00Z' },
      { id: 'aud-p07', kind: 'klant', clientId: 'cl-1', projectId: 'pr-1', detail: 'Bestand aangeleverd door klant: Etiket — definitief', createdAt: '2026-09-03T09:48:00Z' },
      { id: 'aud-p08', kind: 'klant', clientId: 'cl-1', projectId: 'pr-1', detail: 'Betaling gemeld op factuur 15%: 187500 centen EUR op 03-09-2026, kenmerk REQ', createdAt: '2026-09-04T10:15:00Z' },
      { id: 'aud-p04', kind: 'klant', clientId: 'cl-1', projectId: null, detail: 'Contactpersoon toegevoegd door klant: Sanne Vermeulen <sanne@x.nl>', createdAt: '2026-08-30T15:20:00Z' },
      { id: 'aud-q', kind: 'klant', clientId: 'cl-1', projectId: 'pr-1', detail: 'Iets nieuws wat 0021 nog niet kent', createdAt: '2026-08-30T16:00:00Z' },
      { id: 'aud-b', kind: 'bewerking', clientId: 'cl-1', projectId: 'pr-1', detail: 'Fase bijgewerkt', createdAt: '2026-08-30T17:00:00Z' }
    ],
    stages: [
      { projectId: 'pr-1', stageKey: 'tooling', status: 'done', approvedAt: '2026-07-21T10:44:00Z', approvedBy: 'Noor van Dijk', approvedVia: 'portaal' }
    ]
  };
  const KA = M.mergeActivity(KA_BRON, {});
  function kaRij(id) { return KA.filter(function (r) { return r.id === id; })[0] || null; }
  function kaKind(id) { const r = kaRij(id); return r ? r.kind : 'ONTBREEKT'; }

  t.deep(M.ACTIVITY_KINDS.map(function (k) { return k.key; }),
    ['alles', 'klant', 'mail', 'systeem', 'bestanden', 'financieel', 'akkoord', 'samplekeuze', 'betaling', 'klantbestand', 'bezwaar'],
    'de vijf klantacties staan als eigen soort in ACTIVITY_KINDS, ACHTER de bestaande zes: de donut kleurt op positie en de oude posities schuiven niet');

  t.eq(KA.length, 10, 'tien regels: zes klantacties, één download, één contactpersoon, één onbekende klantregel en één bewerking — de zes tweelingen uit het auditlogboek en het akkoord uit de fase zijn er niet nog eens');
  t.eq(kaKind('log-p03'), 'akkoord', 'een akkoord op een fase (action approve) is de soort akkoord');
  t.eq(kaKind('log-p01'), 'samplekeuze', 'een samplebeoordeling (action decide) is de soort samplekeuze');
  t.eq(kaKind('log-p08'), 'betaling', 'een gemelde betaling (action report_payment) is de soort betaling');
  t.eq(kaKind('log-p07'), 'klantbestand', 'een upload door de klant (action upload) is de soort bestand van klant, geen kale bestandsregel');
  t.eq(kaKind('log-p06'), 'bezwaar', 'een bezwaar (action dispute) is de soort bezwaar');
  t.eq(kaKind('log-p05'), 'klant', 'een herbestelling blijft de soort klant: spec §2 noemt vijf eigen soorten en dit is de zesde niet');
  t.eq(kaKind('log-x'), 'bestanden', 'een gewone download door de klant blijft een bestandsgebeurtenis: alleen de zes acties uit 0021 zijn klantacties');
  t.eq(kaRij('log-p03').cls, 'act-akkoord', 'de klassenaam volgt de soort, zoals bij de bestaande vijf');
  t.eq(kaRij('log-p08').cls, 'act-betaling', 'ook voor een betaling');

  ['aud-p01', 'aud-p03', 'aud-p05', 'aud-p06', 'aud-p07', 'aud-p08'].forEach(function (id) {
    t.eq(kaRij(id), null, 'de auditregel ' + id + ' is de tweeling van een toegangsregel (zelfde tekst, tijd en project) en staat niet nog eens in de tijdlijn');
  });
  t.eq(kaRij('pr-1:tooling:approved'), null,
    'het akkoord uit de fase zelf (approvedAt, approvedBy, via portaal) is dezelfde gebeurtenis als de logregel en valt ook weg');

  t.eq(kaKind('aud-p04'), 'klant', 'een contactpersoon door de klant blijft de soort klant');
  t.eq(kaRij('aud-p04').actor, 'klant', 'maar de actor is de klant en niet het beheer: kind klant in het auditlogboek is een klantactie');
  t.eq(kaRij('aud-p04').actie, 'klant', 'en het actietype blijft leesbaar als klant');
  t.eq(kaRij('aud-p04').clientId, 'cl-1', 'de klant komt van de auditregel zelf, want een contactpersoon hangt aan geen project');
  t.eq(kaKind('aud-q'), 'klant', 'een klantregel met een tekst die geen enkel patroon kent valt terug op klant — nooit op een verkeerde soort');
  t.eq(kaKind('aud-b'), 'systeem', 'een auditregel van een ander actietype blijft wat hij was');
  t.eq(kaRij('aud-b').actor, 'beheer', 'met het beheer als actor, zoals altijd');

  t.deep(ids(M.mergeActivity(KA_BRON, { kinds: ['betaling'] })), ['log-p08'], 'een scope op de nieuwe soort betaling houdt alleen die regel over');
  t.deep(ids(M.mergeActivity(KA_BRON, { kinds: ['akkoord', 'bezwaar'] })), ['log-p06', 'log-p03'], 'en op twee nieuwe soorten tegelijk ook');

  /* alleen het auditlogboek: de tekst is dan de enige weg */
  {
    const alleenAudit = M.mergeActivity({ projects: KA_BRON.projects, auditLog: KA_BRON.auditLog }, {});
    function soort(id) { const r = alleenAudit.filter(function (x) { return x.id === id; })[0]; return r ? r.kind : 'ONTBREEKT'; }
    t.eq(alleenAudit.length, 9, 'zonder toegangslogboek staan alle negen auditregels er zelf in');
    t.eq(soort('aud-p03'), 'akkoord', 'de tekst "Fase goedgekeurd door …" van approve_stage herkent het akkoord');
    t.eq(soort('aud-p01'), 'samplekeuze', 'de tekst "Sample …: aanpassing gevraagd door klant" van decide_sample herkent de samplekeuze');
    t.eq(soort('aud-p08'), 'betaling', 'de tekst "Betaling gemeld op factuur …" van report_payment herkent de betaling');
    t.eq(soort('aud-p07'), 'klantbestand', 'de tekst "Bestand aangeleverd door klant: …" van documents_fill_slot herkent het bestand');
    t.eq(soort('aud-p06'), 'bezwaar', 'de tekst "Bezwaar op factuur …" van dispute_invoice herkent het bezwaar');
    t.eq(soort('aud-p05'), 'klant', 'de herbestelling blijft klant');
    t.eq(alleenAudit.filter(function (x) { return x.id === 'aud-p03'; })[0].actor, 'klant', 'en de actor van elke klantregel is de klant');
    const goedgekeurd = M.mergeActivity({ auditLog: [{ id: 'aud-g', kind: 'klant', createdAt: '2026-07-21T10:40:00Z', detail: 'Sample T2 goedgekeurd door klant — Dit is hem.' }] }, {});
    t.eq(goedgekeurd[0].kind, 'samplekeuze', 'ook de goedkeuringstekst van decide_sample is een samplekeuze');
    const geenKlant = M.mergeActivity({ auditLog: [{ id: 'aud-n', kind: 'bewerking', createdAt: '2026-07-21T10:40:00Z', detail: 'Fase goedgekeurd door Steffan: dfm' }] }, {});
    t.eq(geenKlant[0].kind, 'systeem', 'een tekst die op een klantactie lijkt maar een ander actietype draagt is er geen: alleen kind klant gaat langs de patronen');
    const download = M.mergeActivity({ accessLog: [{ id: 'log-d', actor: 'client', assetKind: 'document', action: 'download', createdAt: '2026-07-21T10:40:00Z', detail: 'Bestand aangeleverd door klant: iets' }] }, {});
    t.eq(download[0].kind, 'bestanden', 'en bij een toegangsregel beslist uitsluitend de actie, nooit een toevallig gelijke tekst');
  }

  /* het akkoord uit de fase zelf, zonder logboeken */
  {
    const viaPortaal = M.mergeActivity({ stageLabel: KA_BRON.stageLabel, stages: KA_BRON.stages }, {})[0];
    t.eq(viaPortaal.kind, 'akkoord', 'een fase met approvedVia portaal is in de tijdlijn een akkoord');
    t.eq(viaPortaal.detail, 'Fase goedgekeurd door Noor van Dijk: Tooling, Sampling & Iteratie',
      'met woordelijk de tekst van approve_stage(), zodat de tweeling in de logboeken wegvalt zodra die er wél zijn');
    t.eq(viaPortaal.actor, 'klant', 'gedaan door de klant');

    const viaBeheer = M.mergeActivity({ stageLabel: KA_BRON.stageLabel, stages: [{ projectId: 'pr-1', stageKey: 'tooling', approvedAt: '2026-07-21T10:44:00Z', approvedBy: 'Noor van Dijk', approvedVia: 'beheer' }] }, {})[0];
    t.eq(viaBeheer.kind, 'klant', 'een akkoord dat de eigenaar in het beheer vastlegde blijft de oude soort klant: niet in het portaal gedaan');
    t.eq(viaBeheer.detail, 'Fase goedgekeurd door Noor van Dijk: Tooling, Sampling & Iteratie', 'maar de naam staat er wel bij, want die is vastgelegd');

    const vanVoor = M.mergeActivity({ stageLabel: KA_BRON.stageLabel, stages: [{ projectId: 'pr-1', stageKey: 'tooling', approvedAt: '2025-12-19', approvedBy: '', approvedVia: null }] }, {})[0];
    t.eq(vanVoor.kind, 'klant', 'een fase van vóór 0021 blijft klant');
    t.eq(vanVoor.detail, 'Fase goedgekeurd: Tooling, Sampling & Iteratie', 'zonder naam staat er wat er altijd stond — geen verzonnen "door"');

    /* de demo heeft op de fase een kale dag en in het logboek een tijdstip:
       dat is geen exacte tweeling meer, en dan blijven beide staan — een
       echte regel wegpoetsen op een vaag tijdvenster is erger */
    const anderTijdstip = M.mergeActivity({ projects: KA_BRON.projects, stageLabel: KA_BRON.stageLabel,
      accessLog: [KA_BRON.accessLog[1]],
      stages: [{ projectId: 'pr-1', stageKey: 'tooling', approvedAt: '2026-07-21', approvedBy: 'Noor van Dijk', approvedVia: 'portaal' }] }, {});
    t.eq(anderTijdstip.length, 2, 'een akkoord op een kale dag naast een logregel met tijdstip zijn geen tweeling: allebei blijven staan');
  }

  /* de tweeling zonder project: de klant telt dan mee in de sleutel */
  {
    const tweeKlanten = M.mergeActivity({ auditLog: [
      { id: 'aud-c1', kind: 'klant', clientId: 'cl-1', projectId: null, detail: 'Contactpersoon toegevoegd door klant: Jan <jan@x.nl>', createdAt: '2026-08-30T15:20:00Z' },
      { id: 'aud-c2', kind: 'klant', clientId: 'cl-2', projectId: null, detail: 'Contactpersoon toegevoegd door klant: Jan <jan@x.nl>', createdAt: '2026-08-30T15:20:00Z' }
    ] }, {});
    t.eq(tweeKlanten.length, 2, 'twee klanten die op hetzelfde moment dezelfde naam toevoegen drukken elkaar niet weg: zonder project telt de klant in de tweelingsleutel');
  }

  /* de bestaande tijdlijn verandert niet */
  t.eq(M.mergeActivity(ACT_BRON, {}).length, 8, 'de werkdagbron van groep 9 levert nog steeds acht regels: geen klantactie erin, niets veranderd');

  /* ============================================================
     14. INBOX: DE DRAAD HEROPENT EEN BEANTWOORDE VRAAG (0020)
     question/answer zeggen "afgehandeld"; zegt de klant daarna in
     question_messages nog iets, dan ligt de bal weer bij mij. Dat leest
     collectInbox uit de draad (bron questionMessages) en niet uit de
     kolom. demo-data-portaal.js blok G (q-07) is precies deze stand; de
     ketencontrole (keten-portaal.test.mjs) zag hem tot deze groep bestond
     nooit in de Inbox aankomen.
     ============================================================ */
  t.group('inbox: klantantwoord in een beantwoorde draad');
  {
    const VRAAG = { id: 'q-r', projectId: 'pr-1', question: 'Kan er ook een 30 ml bij?', askedAt: '2026-08-25T15:12:00Z', answeredAt: '2026-08-27T07:30:00Z' };
    const BASIS = { now: NU, projects: [{ id: 'pr-1', clientId: 'cl-1', status: 'active' }], questions: [VRAAG] };
    /* de draad zoals de datamigratie van 0020 hem maakt: de vraag als
       klantbericht op askedAt, het antwoord als stafbericht op answeredAt */
    const DRAAD = [
      { id: 'm-1', questionId: 'q-r', author: 'client', body: VRAAG.question, createdAt: VRAAG.askedAt },
      { id: 'm-2', questionId: 'q-r', author: 'staff', body: 'Een 30 ml is een nieuwe mal.', createdAt: VRAAG.answeredAt }
    ];
    const REACTIE = { id: 'm-3', questionId: 'q-r', author: 'client', body: 'Neem dan ook 2.000 stuks mee.', createdAt: '2026-08-27T08:02:00Z' };

    const zonder = M.collectInbox(Object.assign({}, BASIS, { questionMessages: DRAAD }));
    t.eq(chipOf(zonder, 'vraag', 'q-r'), 'afgehandeld', 'vraag en antwoord in de draad en niets erna: afgehandeld, zoals de kolommen zeggen');
    t.eq(M.inboxBadgeCount(zonder, NU), 0, 'en de badge telt niets');
    t.false(pick(zonder, 'vraag', 'q-r').doorKlant, 'zonder reactie is er geen klanthandeling om te vlaggen');

    const heropend = M.collectInbox(Object.assign({}, BASIS, { questionMessages: DRAAD.concat([REACTIE]) }));
    const it = pick(heropend, 'vraag', 'q-r');
    t.eq(it && it.chip, 'wachtopmij', 'zegt de klant ná het antwoord nog iets, dan is de vraag heropend: wacht op mij');
    t.eq(it && it.owner, 'mij', 'de eigenaar is mij, zonder dat iemand dat instelde');
    t.true(it && it.sub.indexOf('Reactie van de klant') === 0, 'de ondertitel zegt dat het een reactie van de klant is');
    t.eq(it && it.doorKlant, true, 'met de vlag doorKlant: de klant handelde het laatst');
    t.eq(it && it.at, REACTIE.createdAt, 'het item is zo oud als de reactie, niet als de vraag');
    t.eq(it && M.itemKey(it.kind, it.id), 'q:q-r', 'dezelfde sleutel als elke vraag: q:…');
    t.eq(M.inboxBadgeCount(heropend, NU), 1, 'en de badge telt hem mee');
    t.true(it && it.sub.indexOf('antwoord voor 28 aug 2026') > -1, 'de antwoordtermijn loopt vanaf de reactie: donderdag 27 → vrijdag 28 aug');
    t.true(it && it.urgent, 'en op zondag 30 augustus is die termijn verstreken: urgent');

    const gesloten = M.collectInbox(Object.assign({}, BASIS, { questionMessages: DRAAD.concat([REACTIE,
      { id: 'm-4', questionId: 'q-r', author: 'staff', body: 'Staat erin.', createdAt: '2026-08-27T09:00:00Z' }]) }));
    t.eq(chipOf(gesloten, 'vraag', 'q-r'), 'afgehandeld', 'antwoordt de staf daarna in de draad, dan is hij weer afgehandeld — ook al is answeredAt niet bijgewerkt');
    t.eq(M.inboxBadgeCount(gesloten, NU), 0, 'en telt de badge weer nul');

    const kaal = M.collectInbox(BASIS);
    t.eq(chipOf(kaal, 'vraag', 'q-r'), 'afgehandeld', 'zonder bron questionMessages verandert er niets: de kolommen beslissen zoals altijd');
    t.eq(pick(kaal, 'vraag', 'q-r').at, VRAAG.askedAt, 'en het item blijft zo oud als de vraag');

    /* een klantbericht van vóór het antwoord (een aanvulling terwijl
       Steffan nog niet had geantwoord) heropent niets */
    const eerder = M.collectInbox(Object.assign({}, BASIS, { questionMessages: DRAAD.concat([
      { id: 'm-0', questionId: 'q-r', author: 'client', body: 'PS: liefst mat.', createdAt: '2026-08-26T10:00:00Z' }]) }));
    t.eq(chipOf(eerder, 'vraag', 'q-r'), 'afgehandeld', 'een klantbericht van vóór het antwoord heropent niets');

    /* een nog onbeantwoorde vraag met berichten blijft gewoon open, zonder
       "reactie": de bal lag al bij mij */
    const open = M.collectInbox(Object.assign({}, BASIS, {
      questions: [Object.assign({}, VRAAG, { answeredAt: null })],
      questionMessages: [DRAAD[0], REACTIE]
    }));
    const itOpen = pick(open, 'vraag', 'q-r');
    t.eq(itOpen && itOpen.chip, 'wachtopmij', 'een onbeantwoorde vraag blijft wacht op mij');
    t.false(itOpen && itOpen.sub.indexOf('Reactie van de klant') > -1, 'zonder het woord reactie: er was nog geen antwoord om op te reageren');
    t.eq(itOpen && itOpen.at, VRAAG.askedAt, 'en zo oud als de vraag');

    /* de ontdubbeling: berichten zonder draad-id of zonder tijd tellen niet */
    const rommel = M.collectInbox(Object.assign({}, BASIS, { questionMessages: DRAAD.concat([
      { id: 'm-x', author: 'client', body: 'zonder draad', createdAt: '2026-08-29T10:00:00Z' },
      { id: 'm-y', questionId: 'q-r', author: 'client', body: 'zonder tijd' }, null]) }));
    t.eq(chipOf(rommel, 'vraag', 'q-r'), 'afgehandeld', 'een bericht zonder questionId of zonder createdAt (of null) heropent niets en gooit niets om');
  }
}
