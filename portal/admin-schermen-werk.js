/* CUSTOM+ — de vier werkschermen van de nieuwe beheerindeling.
   ------------------------------------------------------------------
   WAT DIT BESTAND IS
   Overzicht (§5.1), Inbox (§5.2), Projecten (§5.3) en Projectdetail (§5.4)
   uit .claude/beheer-ui-mockup-spec.md. Niets anders. De overige zes
   schermen van hoofdstuk 5 komen in een eigen bestand, dat net als dit
   bestand window.CP_SCHERMEN AANVULT en nooit overschrijft.

   WAT DIT BESTAND NIET IS
   Geen componentbibliotheek en geen tekenlaag. Elke vorm komt uit CP_UI
   (portal/admin-ui.js), elke grafiek uit CP_CHART (portal/admin-charts.js),
   elke afleiding uit CP_MODEL (portal/admin-model.js) of CP_DATA
   (portal/admin-data.js). Waar de mockup een vorm vraagt waar geen
   component voor bestaat, wordt de dichtstbijzijnde bestaande vorm gebruikt
   en staat dat hieronder met zoveel woorden genoteerd:

     · §4.7 timelineList — er is geen CP_UI-component. admin-ui.css heeft er
       wél de klassen voor (.u-tlrail…, hoofdstuk 8k) en die worden hier met
       CP_UI.el samengesteld. Eén vorm, in één functie (raillijst()).
     · §5.3 projectkaart en §5.7 factuurrij — idem: .u-projectcard en
       .u-invoicerow bestaan alleen als CSS. Ook die staan hier elk in één
       functie, zodat ze naar CP_UI kunnen verhuizen zonder dat er ergens
       een tweede kopie blijkt te staan.
     · De rail-deadlinerij (datumkicker boven de titel) gebruikt .u-row plus
       .u-datekicker; CP_UI.entityRow kent geen kickerslot.

   DRIE DINGEN DIE DE MOCKUP NIET TEKENT EN DIE ER TOCH IN ZITTEN
   ("dingen die missen moet je erbij doen dus ontwikkel het", 30-08-2026)

     · PROJECTEN KRIJGT FILTERCHIPS. De mockup toont ze niet, fase 3 van het
       migratieplan vraagt ze, en ze zijn volledig af te leiden met
       CP_MODEL.filterProjects. Ze staan in .u-chips — de vorm die het
       stijlblad er al voor heeft — tussen de gezondheidskaart en de
       kaarten. De chip "Vertraagd" ontbrak, omdat hij de zendingsignalen
       vraagt en die nergens vandaan kwamen; sinds hoofdstuk 4b komen ze uit
       modelCtx().sig en telt de chip echte vertraagde zendingen.
     · DE KNOP "FILTERS" IN DE INBOX WERKT ECHT. §5.2 tekent hem; hij
       filtert hier op itemsoort, want CP_MODEL.filterInbox kent dat filter
       (extra.kind) al en het had alleen nog geen bediening. De keuze staat
       in de route als ?soort=, net als de tab en de selectie.
     · DE DEADLINEKALENDER IS AANKLIKBAAR. Een dag kiezen zet ?dag= in de
       route en de gedateerde lijst eronder toont dan die dag, met een weg
       terug. Zonder dat is de kalender een plaatje met stippen.

   DE VIER AFSPRAKEN VAN DE OPDRACHT, EN HOE ZE HIER LANDEN

   1. EEN SCHERM IS PUUR. Geen module-state, geen globale variabelen, geen
      onthouden tussen twee aanroepen. Alles wat een tweede aanroep anders
      maakt, staat in de route: welke tab, welke chip, welk item, welke dag.
      Dat is precies waarom de router bestaat.

   2. NIETS VERZINNEN. Elk getal op het scherm komt uit ctx.data of uit een
      afgeleide functie van CP_MODEL/CP_DATA; boven elke afleiding staat de
      bron in commentaar. Bestaat een waarde niet, dan staat er een eerlijke
      lege stand — nooit een plaatsvervanger.

   3. TOEGANKELIJKHEID GAAT VOOR EEN PIXEL. Elke klikbare rij is een echte
      knop, elke tabgroep loopt via CP_UI.tabs (role=tablist met pijltjes),
      elk menu via CP_UI.contextMenu (Escape met focusherstel), elke grafiek
      krijgt zijn tekstuele tegenhanger van CP_CHART, en naast elke
      statuskleur staat een woord.

   4. ES5. Alleen var, alleen functie-expressies, nooit innerHTML.

   TWEE HAKEN DIE DIT BESTAND VAN DE GASTHEER VRAAGT
   (allebei optioneel; zonder allebei blijft elk scherm werken)

     ctx.stageLabel(sleutel) -> Nederlandse fasenaam
       De STAGES-tabel woont in de afgesloten scriptblok van beheer.html en
       is van hieruit niet te lezen. Een tweede tabel aanleggen is precies
       wat admin-model.js verbiedt ("fasenamen komen van de aanroeper"), dus
       die tabel komt binnen als functie. Ontbreekt hij, dan valt het scherm
       terug op window.CP_STAGE_LABEL, daarna op window.CP_STAGES, en pas
       daarna op de kale sleutel: zichtbaar onaf, nooit een verzonnen
       vertaling.

     ctx.acties[<naam>](payload) -> de bestaande dialoogvensters
       Elke schrijfactie van deze vier schermen loopt hierlangs. De vensters
       zelf wonen in beheer.html en worden hier NOOIT nagebouwd: dit bestand
       maakt ze bereikbaar, meer niet. Een tweede openMarkPaidModal zou een
       tweede bron van waarheid zijn.
       De namen die dit bestand kent staan in HAKEN hieronder; ze zijn
       letterlijk die van iaActies() in beheer.html.

       DRIE REGELS DIE OVERAL GELDEN, EN DIE VERKLAREN WAAROM EEN KNOP SOMS
       NIET TE ZIEN IS:

       1. GEEN HAAK, GEEN KNOP. Een menurij, een sectielink of een blok dat
          aan een ontbrekende haak hangt, wordt niet getekend. Dat is de
          opdracht letterlijk: liever geen actie dan een knop die niets doet.
          Eén uitzondering, en die is bewust: het ••• van de projectkop houdt
          zijn zeven vaste regels en zet een ontbrekende erbij als
          "— nog niet gekoppeld". Dat menu staat één keer per pagina en daar
          is een gat informatie; per rij van een lijst zou het ruis zijn.
       2. DE PRIMAIRE KNOP VAN EEN INBOX-ITEM heeft nog een terugval vóór hij
          uitgaat: bestaat de haak niet, dan opent hij het item op zijn eigen
          route. Bestaat ook die niet — alleen bij een site-brief, die nog
          geen klant en geen project heeft — dan staat hij uitgeschakeld mét
          uitleg. Een knop die doet alsof, is erger dan een knop die uitlegt.
       3. ELKE HAAK EINDIGT ZELF IN DE VASTE AFSLUITER: auditregel, venster
          sluiten, scherm verversen, ongedaan maken. Dit bestand roept dus
          nooit zelf ctx.ververs() aan na een haak.

     WAT ER BEWUST NIET STAAT, OMDAT ER GEEN HAAK OF GEEN BRON VOOR IS
       · de inhaalmodus van een zending (openCatchupModal): geen haak in
         iaActies(), dus geen knop;
       · een handmatig vinkje op de onboardingchecklist — die zes punten
         vinken zichzelf af op echte gegevens, en een vinkje ernaast zou een
         tweede waarheid zijn.
       Allebei staan ze bij hun eigen blok verderop met dezelfde reden erbij.

     DRIE DINGEN DIE HIER STONDEN ALS "KAN NIET" EN INMIDDELS GEBOUWD ZIJN
     Ze ontbraken doordat de vorige ronde parallel werkte: de agent die de
     haken maakte en de agent die de schermen bouwde konden elkaars werk niet
     zien. De haken bestonden dus al; er riep alleen niemand ze aan.
       · het ••• van een DOCUMENTRIJ. Bewerken, kopiëren naar een ander
         project en verwijderen staan alle drie in iaActies() als
         documentBewerken, documentKopierenNaar en documentVerwijderen;
       · "Kopieer naar een ander project" bij een FOTOrij: mediaKopierenNaar,
         de tweelinghaak van documentKopierenNaar;
       · een rij per OPEN DOCUMENTSLOT. iaLaadLijsten() levert de slotenlijst
         sinds deze ronde mee (onder allebei de namen, docSlots en
         documentSlots) en allebei de haken bestaan: documentSlotVullen en
         documentSlotVerwijderen.
         "VERWIJDER SLOT" IS DE ENIGE GEVAARLIJKE RIJ IN DIT BESTAND ZONDER
         ONGEDAAN MAKEN. Een documentslot is een verwachting en geen bestand;
         het gaat niet door de prullenbak en de haak zegt dat er zelf bij. Die
         ene rij draagt daarom als enige wél een bevestigingsvraag — zie
         haakRij().

   VIER DINGEN DIE DE INBOX BEWUST NIET DRAAGT
   Een stille zending, een verlopen ETA en een follow-up-herinnering vallen
   buiten collectInbox() — dat zegt die functie er zelf bij. De mappingtabel
   zet ze op Overzicht onder "Nu doen" en bij Projecten onder het filter
   Vertraagd. Sinds deze ronde staan ze daar ook echt; zie hoofdstuk 4b.
   Het vierde is een verstuurde, openstaande factuur: die hoort in Financiën
   en niet in de werkvoorraad, maar een UITSTEL dat erop afloopt hoort je wel
   te zien. Dat ene geval staat ook onder "Nu doen"; zie hoofdstuk 4c.

   LADEN
     <script src="portal/admin-schermen-werk.js"></script> ná admin-ui.js,
     admin-charts.js, admin-model.js en admin-data.js. Het bestand raakt bij
     het laden niets aan behalve window.CP_SCHERMEN.
   ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  /* aanvullen, nooit overschrijven: een tweede schermbestand vult dezelfde
     tafel en mag niet van de volgorde van de <script>-tags afhangen */
  if (!root.CP_SCHERMEN) root.CP_SCHERMEN = {};
  var SCHERMEN = root.CP_SCHERMEN;

  /* ============================================================
     0. KALE HULPJES
     ============================================================ */

  var lijst = function (v) { return Array.isArray(v) ? v : []; };
  var isObj = function (v) { return !!v && typeof v === 'object' && !Array.isArray(v); };
  var opt = function (v) { return isObj(v) ? v : {}; };
  var tekst = function (v) { return (v === null || v === undefined) ? '' : String(v); };
  var fn = function (v) { return typeof v === 'function' ? v : null; };
  var isNode = function (v) { return !!v && typeof v === 'object' && typeof v.nodeType === 'number'; };
  var getal = function (v, terugval) {
    var n = Number(v);
    return isFinite(n) ? n : (typeof terugval === 'number' ? terugval : 0);
  };

  /* rijen op hun id: elk scherm zoekt een project of een klant vaker dan
     één keer, en een lineaire zoektocht per rij maakt van een lijst van
     honderd projecten een lijst van honderd zoektochten */
  var indexOp = function (rijen, sleutel) {
    var uit = {};
    lijst(rijen).forEach(function (r) {
      if (r && r[sleutel]) uit[r[sleutel]] = r;
    });
    return uit;
  };

  var eersteTekst = function () {
    for (var i = 0; i < arguments.length; i++) {
      var t = tekst(arguments[i]);
      if (t) return t;
    }
    return '';
  };

  /* " · " tussen de delen die er zijn — dezelfde samenvoeging die
     CP_MODEL binnenin gebruikt voor zijn subregels */
  var samen = function (delen) {
    var uit = [];
    lijst(delen).forEach(function (d) { if (tekst(d)) uit.push(tekst(d)); });
    return uit.join(' · ');
  };

  var nlAantal = function (n, enkel, meervoud) {
    return n + ' ' + (n === 1 ? enkel : meervoud);
  };

  /* CP_MODEL levert zijn relatieve dagen in kleine letters ("vandaag",
     "3 dagen geleden"), want ze staan daar meestal midden in een zin. Aan de
     rechterkant van een rij beginnen ze wél een regel, en dan hoort er een
     hoofdletter. Alleen de eerste letter verandert; er wordt niets vertaald
     en niets afgekort. */
  var hoofdletter = function (waarde) {
    var t = tekst(waarde);
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  };

  /* AFKORTEN IS GEEN WEGLATEN. Een klantvraag of een auditregel kan drie
     zinnen lang zijn; in een compacte tegel of op één regel "volgende
     actie" past dat niet. De volledige tekst blijft altijd één klik ver
     weg — in het detailpaneel van de Inbox, in de tijdlijn, in het
     projectdetail — en er wordt hier nooit iets weggelaten wat nergens
     anders staat. Er wordt op een spatie afgebroken, zodat er geen woord
     doormidden valt. */
  var afkorten = function (waarde, max) {
    var t = tekst(waarde);
    var n = (typeof max === 'number' && max > 8) ? max : 90;
    if (t.length <= n) return t;
    var kort = t.slice(0, n);
    var spatie = kort.lastIndexOf(' ');
    if (spatie > n * 0.6) kort = kort.slice(0, spatie);
    return kort.replace(/[\s.,;:·-]+$/, '') + '…';
  };

  /* ============================================================
     1. DE VIER BIBLIOTHEKEN EN DE OPGEHAALDE LIJSTEN

     Het schermcontract noemt ctx.data twee keer: als "de al opgehaalde
     lijsten" en als "de vier bibliotheken". Dat kan niet allebei, dus dit
     bestand kijkt naar wat er werkelijk in zit in plaats van te gokken:
     draagt ctx.data de functie portfolioHealth, dan is het CP_DATA en
     wonen de lijsten in ctx.lijsten; anders is ctx.data de lijsten en komt
     CP_DATA van de globale. Beide standen werken, geen enkele stand raakt
     stil de verkeerde bron.
     ============================================================ */

  var isDataBib = function (v) { return !!v && typeof v.portfolioHealth === 'function'; };

  var UI = function (ctx) { return (ctx && ctx.ui) || root.CP_UI || null; };
  var CH = function (ctx) { return (ctx && ctx.chart) || root.CP_CHART || null; };
  var MOD = function (ctx) { return (ctx && ctx.model) || root.CP_MODEL || null; };
  var DAT = function (ctx) {
    if (ctx && isDataBib(ctx.data)) return ctx.data;
    return root.CP_DATA || null;
  };
  /* de opgehaalde verzamelingen: clients, projects, media, documents,
     invoices, samples, inspections, questions, disclosures, shipments,
     factories, briefs, team, log, mailLog, audit, settings */
  var D = function (ctx) {
    if (ctx && isDataBib(ctx.data)) return opt(ctx.lijsten);
    return opt(ctx && ctx.data);
  };

  /* de site-briefs heten in de datalaag "aanvragen" en in het contract
     "briefs"; allebei accepteren kost één regel en voorkomt een lege Inbox
     die niemand kan verklaren */
  var briefsVan = function (d) {
    if (lijst(d.briefs).length) return lijst(d.briefs);
    if (lijst(d.requests).length) return lijst(d.requests);
    return lijst(d.aanvragen);
  };

  /* de documentslots, om dezelfde reden onder twee namen gelezen: de
     laadfunctie van de gastheer biedt ze aan als `docSlots` én als
     `documentSlots`, en een lijst die stil leeg blijft omdat het scherm hem
     anders noemt, is het gat dat je pas maanden later opmerkt. */
  var slotsVan = function (d) {
    if (lijst(d.docSlots).length) return lijst(d.docSlots);
    return lijst(d.documentSlots);
  };

  var nuVan = function (ctx) {
    var n = tekst(ctx && ctx.nu);
    return n || new Date().toISOString();
  };

  /* "de bal ligt bij mij" heet in CP_MODEL OWNERS.MIJ. De waarde wordt daar
     gelezen en niet hier overgetypt: verandert die sleutel ooit, dan telt
     Overzicht anders dan de Inbox-badge en valt dat pas op als de twee naast
     elkaar staan. */
  var isVanMij = function (ctx, item) {
    var m = MOD(ctx);
    var mij = (m && m.OWNERS && m.OWNERS.MIJ) ? m.OWNERS.MIJ : 'mij';
    return !!item && item.owner === mij;
  };

  var routeVan = function (ctx) {
    var r = ctx && ctx.route;
    if (isObj(r)) return r;
    var m = MOD(ctx);
    if (m && fn(m.parseRoute)) return m.parseRoute(tekst(r));
    return { area: '', sub: null, id: null, tab: null, params: {} };
  };

  var paramVan = function (ctx, naam) {
    return tekst(opt(routeVan(ctx).params)[naam]);
  };

  /* ============================================================
     2. FASENAMEN

     Zie het kopblok: de tabel komt van de gastheer en wordt hier nooit
     nagemaakt. Drie wegen naar dezelfde tabel, en een kale sleutel als er
     geen enkele is.
     ============================================================ */

  var faseNaamVan = function (ctx) {
    var bron = null;
    /* VIER PLEKKEN, ÉÉN TABEL. Het schermbestand van de andere zes schermen
       verwacht de tabel BINNEN de lijsten (lijsten.stageLabel); dit bestand
       accepteert allebei, zodat het niet uitmaakt hoe beheer.html hem
       doorgeeft en de twee bestanden nooit een andere fasenaam tonen. */
    if (ctx && fn(ctx.stageLabel)) bron = ctx.stageLabel;
    else if (fn(D(ctx).stageLabel)) bron = D(ctx).stageLabel;
    else if (fn(root.CP_STAGE_LABEL)) bron = root.CP_STAGE_LABEL;
    else if (Array.isArray(root.CP_STAGES)) {
      bron = function (sleutel) {
        var tabel = root.CP_STAGES;
        for (var i = 0; i < tabel.length; i++) {
          if (tabel[i] && tabel[i].key === sleutel) return tabel[i].label;
        }
        return '';
      };
    }
    return function (sleutel) {
      var k = tekst(sleutel);
      if (!k || !bron) return k;
      var uit = '';
      /* de tabel van de gastheer mag struikelen over een sleutel die zij
         niet kent; dit scherm gaat daar niet in mee */
      try { uit = tekst(bron(k)); } catch (e) { uit = ''; }
      return uit || k;
    };
  };

  /* DE KORTE FASENAAM — ÉÉN TABEL, EN HIJ HOORT HIER NIET TE BLIJVEN.

     De stepper (§4.14) en het golvende fasepad (§4.11) zetten hun labels in
     vijf of zes even brede kolommen. De VOLLEDIGE namen uit de STAGES-tabel
     van beheer.html passen daar niet in: "Massaproductie &
     Kwaliteitscontrole" wikkelt in zo'n kolom over drie of vier regels, en
     naast elkaar lopen die stapels visueel in elkaar over. De mockup gebruikt
     daarom precies één woord per fase.

     ACHT TEKENS IS DE GRENS, EN DIE IS GEMETEN. admin-charts.js legt de
     meting vast bij naamPaar(): de stepper op de projectkaart heeft per fase
     een kolom van 63,0px, waarvan .cpch-stap links en rechts 4px padding
     afneemt, dus 55,0px netto tekst bij 13px/500. Dat is 8,35 gemiddelde
     kleine letters, en daarmee past een label van ten hoogste ACHT tekens
     altijd. Negen tekens hangt van de letters af en is dus een gok — precies
     de gok die hier twee keer misging: "Productie" is daar gemeten op 55,9px
     en kapt af tot "Producti…", "Prototyping" op 67,4px en kapt af tot
     "Prototyp…". Beide stonden in deze tabel en zijn hieronder vervangen.

     DE KORTE NAMEN ZIJN NIET VERZONNEN. Elk woord hieronder staat in de
     volledige naam die in beheer.html staat (STAGES, regel 1010); het aantal
     tekens staat erachter, zodat de meting hierboven na te rekenen is:

       concept     Concept & Industrieel Ontwerp        -> Concept   (7)
       dfm         Ontwerp voor Produceerbaarheid       -> Ontwerp   (7)
       sourcing    Fabriekssourcing & Screening         -> Sourcing  (8)
       tooling     Tooling, Sampling & Iteratie         -> Tooling   (7)
       production  Massaproductie & Kwaliteitscontrole  -> Massa     (5)
       logistics   Compliance & Logistiek               -> Levering  (8)

     TWEE VAN DE ZES VERDIENEN EEN TOELICHTING, want daar wijkt het woord af
     van wat de mockup tekent:

       · tooling tekende de mockup als "Prototyping". Elf tekens passen niet
         in een kolom waar er acht in gaan, en een afgekapt "Prototyp…" is
         precies de brij die een kort label moest oplossen. "Tooling" is het eerste woord van
         de volledige naam, het is de fasesleutel zelf, en het is het woord
         dat het klantportaal in STAGE_SHORT (portal.html, regel 1782) al
         toont. Beheer en portaal noemen die fase nu hetzelfde.
       · production tekende de mockup als "Productie". Negen tekens, gemeten
         op 55,9px in een kolom van 55,0px: net niet. "Massa" is het eerste
         lid van "Massaproductie" en daarmee het kortste stuk van de echte
         naam dat de fase nog aanwijst; tussen "Tooling" en "Levering" leest
         het als de massafase die het is. Korter dan de naam kan alleen door
         een woord te verzinnen, en dat doen we niet.

     In beide gevallen is de volledige naam nergens weg: hij staat in de
     tooltip en in het aria-label van elke stap, en op het projectdetail
     voluit in de regel onder de titel, bij Kerngegevens en bij Betaalmomenten
     per fase.

     DEZE TABEL MOET NAAR BEHEER.HTML. Daar woont STAGES, en daar hoort naast
     `label` een veld `kort` te komen — dan is er weer ÉÉN woordenlijst in
     plaats van twee. Zolang beheer.html niet gewijzigd mag worden, staat hij
     hier op precies één plek, zodat die verhuizing later een knip-en-plak is
     en geen zoektocht. Een sleutel die hier niet in staat valt terug op de
     volledige naam: een lang label is lelijk, een verzonnen kort label is
     fout. */
  var FASE_KORT = {
    concept: 'Concept',
    dfm: 'Ontwerp',
    sourcing: 'Sourcing',
    tooling: 'Tooling',
    production: 'Massa',
    logistics: 'Levering'
  };

  /* eigen sleutel, nooit een geërfde: FASE_KORT['toString'] bestaat op elk
     object en zou hier een functie als label opleveren */
  var eigenVeld = function (tabel, sleutel) {
    return Object.prototype.hasOwnProperty.call(tabel, sleutel) ? tabel[sleutel] : undefined;
  };

  var faseKortVan = function (ctx) {
    var vol = faseNaamVan(ctx);
    return function (sleutel) {
      var k = tekst(sleutel);
      return tekst(eigenVeld(FASE_KORT, k)) || vol(k);
    };
  };

  /* DE VOLLEDIGE FASENAAM BIJ EEN KORT LABEL — NU WERK VAN CP_CHART.
     Hier stond zetVolledigeNamen(): een hulpje dat na het tekenen de
     volledige fasenaam alsnog in `title` en achter het aria-label hing, omdat
     stepper() en stagePath() maar ÉÉN naam per stap kenden en het label op
     het scherm dus ook het label voor de schermlezer was.

     Dat is verholpen in de tekenlaag zelf: admin-charts.js kent sinds deze
     ronde naamPaar(), leest per stap twee namen, en zet de volledige naam in
     de title én in het aria-label terwijl het korte label op het scherm komt.
     Twee plekken die hetzelfde attribuut zetten is één te veel, dus het
     hulpje is weg en de twee aanroepen hieronder geven de namen in de vorm
     die admin-charts.js beschrijft:

       label  de VOLLEDIGE naam  — gaat naar title en aria-label
       kort   het korte label    — komt op het scherm

     Ontbreekt `kort` (of draait er een oudere admin-charts.js), dan valt de
     tekenlaag terug op `label`: dan staat de volledige naam op het scherm.
     Lang, maar nooit fout en nooit stuk. */

  /* de vier fasestanden zoals beheer.html ze kent. Dit is GEEN tweede
     fasenamentabel: het zijn de statuswoorden, die nergens anders in de
     nieuwe laag staan en die niet uit de fasesleutels af te leiden zijn. */
  var FASE_STAND = {
    done: { woord: 'Afgerond', toon: 'klaar' },
    current: { woord: 'Actief', toon: 'nu' },
    awaiting_approval: { woord: 'Wacht op akkoord', toon: 'extern' },
    upcoming: { woord: 'Gepland', toon: 'neutraal' }
  };
  var faseStand = function (status) {
    return FASE_STAND[tekst(status)] || { woord: 'Onbekend', toon: 'neutraal' };
  };

  /* de drie standen van een sampleronde (het STAFveld status; de
     klantbeslissing staat er sinds 0021 los naast, zie BESLISSING in het
     Inbox-deel). Eén tabel voor het projectdetail én het Inbox-paneel van
     een samplebeslissing — hij stond eerst alleen lokaal in tabOverzicht. */
  var SAMPLE_STAND = {
    approved: { woord: 'Goedgekeurd', toon: 'klaar' },
    reviewed: { woord: 'Wacht op de keuze van de klant', toon: 'extern' },
    superseded: { woord: 'Verdrongen door een nieuwere ronde', toon: 'neutraal' }
  };

  /* HET AKKOORD OP EEN FASE, IN WOORDEN (0021: approvedBy, approvedVia).
     Drie herkomsten, drie zinnen, en geen verzonnen naam:
       portaal   de klant klikte zelf akkoord — CP_MODEL.doorKlant zegt ja
       beheer    de eigenaar legde het akkoord met naam vast in het beheer
       onbekend  van vóór 0021: alleen de datum, precies wat er altijd stond
     Zonder datum is er geen akkoord en dus geen zin. */
  var akkoordTekst = function (ctx, stage) {
    var s = opt(stage);
    if (!s.approvedAt) return '';
    var m = MOD(ctx);
    var datum = datumTekst(ctx, s.approvedAt);
    var naam = tekst(s.approvedBy);
    var viaPortaal = !!(m && fn(m.doorKlant) && m.doorKlant(s));
    if (viaPortaal) return 'Akkoord door ' + (naam || 'de klant') + ' op ' + datum + ' via het portaal';
    if (naam) return 'Akkoord van ' + naam + ' op ' + datum + ', vastgelegd in het beheer';
    return 'Goedgekeurd op ' + datum;
  };

  /* ============================================================
     3. DATUM- EN GETALOPMAAK

     Alles loopt langs CP_DATA of CP_MODEL, zodat het beheer op elk scherm
     dezelfde Nederlandse schrijfwijze houdt. Ontbreekt de laag, dan komt de
     ruwe waarde terug: onhandig, nooit leeg en nooit fout.
     ============================================================ */

  var dagVan = function (ctx, waarde) {
    var m = MOD(ctx);
    if (m && fn(m.dayISO)) return tekst(m.dayISO(waarde));
    var t = tekst(waarde).match(/^(\d{4}-\d{2}-\d{2})/);
    return t ? t[1] : '';
  };

  var datumTekst = function (ctx, waarde) {
    var m = MOD(ctx);
    if (m && fn(m.formatDate)) return tekst(m.formatDate(waarde));
    var dt = DAT(ctx);
    if (dt && fn(dt.datumLabel)) return tekst(dt.datumLabel(waarde));
    return tekst(waarde);
  };

  var tijdTekst = function (ctx, waarde) {
    var m = MOD(ctx);
    if (m && fn(m.formatDateTime)) return tekst(m.formatDateTime(waarde));
    return datumTekst(ctx, waarde);
  };

  var relatiefTekst = function (ctx, waarde) {
    var m = MOD(ctx);
    if (m && fn(m.relativeDay)) return tekst(m.relativeDay(waarde, nuVan(ctx)));
    return '';
  };

  /* geld komt overal in CENTEN binnen en wordt pas hier gedeeld — de
     afspraak van invoice-core.js. Het euroteken staat er expliciet bij:
     een kaal "1.875" naast een aantal is niet te onderscheiden van een
     aantal, en dat is precies de verwarring die een bedrag niet mag geven. */
  var bedragTekst = function (ctx, centen) {
    var c = CH(ctx);
    if (c && fn(c.bedrag)) return tekst(c.bedrag(centen, { euro: true }));
    return tekst(centen);
  };

  var getalTekst = function (ctx, waarde) {
    var c = CH(ctx);
    if (c && fn(c.getal)) return tekst(c.getal(waarde, 0));
    return tekst(waarde);
  };

  /* weekdag van een ISO-dag, maandag = 0. In UTC gerekend, precies zoals
     CP_DATA en CP_CHART het doen: met lokale tijd duurt een dag rond een
     zomertijdovergang 23 of 25 uur en verschuift de weekdag. */
  var weekdagIndex = function (iso) {
    var m = tekst(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return -1;
    var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (!isFinite(d.getTime())) return -1;
    return (d.getUTCDay() + 6) % 7;
  };

  /* de datumkicker uit de mockup: "VR 16 MEI".
     De maandnaam komt uit CP_DATA.datumLabel ("16 mei 2026") en wordt dus
     NIET hier opnieuw opgeschreven; alleen het jaartal valt weg. De
     weekdagafkorting komt uit CP_DATA.WEEKDAGEN — ook een bestaande tabel. */
  var datumKicker = function (ctx, iso) {
    var dag = dagVan(ctx, iso);
    if (!dag) return '';
    var vol = datumTekst(ctx, dag).split(' ');
    var kern = (vol.length >= 2) ? (vol[0] + ' ' + vol[1]) : dag;
    var dt = DAT(ctx);
    var idx = weekdagIndex(dag);
    var dagen = (dt && Array.isArray(dt.WEEKDAGEN)) ? dt.WEEKDAGEN : [];
    var kort = (idx >= 0 && dagen[idx]) ? tekst(dagen[idx].kort) : '';
    return ((kort ? kort + ' ' : '') + kern).toUpperCase();
  };

  /* ============================================================
     4. GEDEELDE AFLEIDINGEN

     Elke functie hieronder noemt zijn bron. Ze worden per schermaanroep
     opnieuw gedraaid — dat is de prijs van een puur scherm, en met de
     omvang van deze verzamelingen is die prijs nul.
     ============================================================ */

  /* concepten = media- en documentrijen die nog niet gepubliceerd zijn.
     BRON: media[].publishStatus en documents[].publishStatus, precies wat
     CP_MODEL.isConceptRow leest. De vorm ({kind, row}) is de vorm die
     collectInbox verwacht van DS.listConcepts(). */
  var conceptRijen = function (ctx, d) {
    var m = MOD(ctx);
    var isConcept = (m && fn(m.isConceptRow)) ? m.isConceptRow : function (r) {
      return !!r && r.publishStatus === 'concept';
    };
    var uit = [];
    lijst(d.media).forEach(function (r) { if (isConcept(r)) uit.push({ kind: 'media', row: r }); });
    lijst(d.documents).forEach(function (r) { if (isConcept(r)) uit.push({ kind: 'document', row: r }); });
    return uit;
  };

  /* de klantcollecties uit 0021, elk onder de namen waaronder de gastheer
     ze aanbiedt (iaLaadLijsten zet ze twee keer neer, en de demo kent
     invoicePayments). Zonder deze lezing kwam geen enkele klantactie in de
     Inbox terecht, terwijl collectInbox ze al kende: de bouwfunctie hieronder
     gaf de lijsten simpelweg niet door. */
  var betalingsmeldingenVan = function (d) {
    if (Array.isArray(d.clientPayments)) return d.clientPayments;
    if (Array.isArray(d.betalingsmeldingen)) return d.betalingsmeldingen;
    return lijst(d.invoicePayments);
  };
  var herbestellingenVan = function (d) {
    if (Array.isArray(d.reorders)) return d.reorders;
    return lijst(d.reorderRequests);
  };

  /* de werkvoorraad. BRON: CP_MODEL.collectInbox over de bestaande
     verzamelingen plus de klantcollecties van 0021. Eén bouwfunctie voor
     Overzicht, Inbox en Projecten, zodat de tellingen op de drie schermen
     niet uit elkaar kunnen lopen.
     invoiceAudit staat er alleen voor de reden van een bezwaar; iaLaadLijsten
     levert die lijst vandaag niet, en dan zegt het item eerlijk dat de reden
     in het factuurlogboek staat — collectInbox doet dat zelf. */
  var inboxItems = function (ctx) {
    var m = MOD(ctx);
    if (!m || !fn(m.collectInbox)) return [];
    var d = D(ctx);
    return m.collectInbox({
      questions: lijst(d.questions),
      /* de berichten van een gesprek: een reactie van de klant na het antwoord
         heropent de vraag in de Inbox (collectInbox leest ze zelf uit) */
      questionMessages: lijst(d.questionMessages),
      briefs: briefsVan(d),
      drafts: conceptRijen(ctx, d),
      invoices: lijst(d.invoices),
      projects: lijst(d.projects),
      clients: lijst(d.clients),
      samples: lijst(d.samples),
      documents: lijst(d.documents),
      clientPayments: betalingsmeldingenVan(d),
      invoiceAudit: lijst(d.invoiceAudit),
      reorders: herbestellingenVan(d),
      settings: opt(d.settings),
      now: nuVan(ctx),
      stageLabel: faseNaamVan(ctx)
    });
  };

  /* "door klant" op een item: het model zet de vlag op elk item
     (collectInbox) en heeft voor een kale rij CP_MODEL.doorKlant. Beide
     wegen staan hier één keer, zodat de lijst, het paneel en het
     projectdetail hetzelfde antwoord geven. */
  var isDoorKlant = function (ctx, item) {
    if (!item) return false;
    if (item.doorKlant === true) return true;
    var m = MOD(ctx);
    return !!(m && fn(m.doorKlant) && m.doorKlant(item.raw || item));
  };

  /* WAT WACHT ER OP MIJ — ÉÉN REGEL VOOR DE LIJST ÉN VOOR HET GETAL.

     Overzicht en de Inbox telden dit verschillend, en dat kon je pas zien met
     échte gegevens: Overzicht nam alles wat niet afgehandeld en niet
     geparkeerd was en van mij was, terwijl CP_MODEL.inboxBadgeCount (de bron
     van "n op jou" en van de zijbalkbadge) een GEPLANDE publicatie er
     expliciet uit laat — beslissing 2.3: daar wacht een klok, niet jij. Eén
     ingeplande foto liet de pil op Overzicht dus "5 zaken" zeggen terwijl de
     zijbalk er 4 toonde.

     Hieronder staat de regel van inboxBadgeCount, letterlijk en op één plek:
       · afgehandeld valt af;
       · gepland valt af (daar wacht een klok);
       · alles met een andere eigenaar dan ik valt af;
       · een snooze die nog loopt valt af — een snooze die verstreken is niet,
         want dan ligt het werk er weer.
     Het GETAL komt daarnaast rechtstreeks uit CP_MODEL, zodat de pil, de
     tegel, de ring en de badge niet alsnog uit elkaar kunnen lopen als die
     beslissing ooit verandert. */
  var opMijItems = function (ctx, items) {
    var m = MOD(ctx);
    var mij = (m && m.OWNERS && m.OWNERS.MIJ) ? m.OWNERS.MIJ : 'mij';
    var vandaag = dagVan(ctx, nuVan(ctx));
    var uit = [];
    lijst(items).forEach(function (it) {
      if (!it) return;
      if (it.chip === 'afgehandeld' || it.chip === 'gepland') return;
      if (it.owner !== mij) return;
      if (it.snoozedUntil && dagVan(ctx, it.snoozedUntil) > vandaag) return;
      uit.push(it);
    });
    return uit;
  };

  var opMijAantal = function (ctx, items, terugval) {
    var m = MOD(ctx);
    if (m && fn(m.inboxBadgeCount)) return getal(m.inboxBadgeCount(items, nuVan(ctx)), 0);
    return lijst(terugval).length;
  };

  /* ============================================================
     4b. DE DRIE SIGNALEN DIE DE INBOX NIET DRAAGT

     WAAROM ZE HIER STAAN
     collectInbox() laat zendingsignalen en follow-up-herinneringen er
     bewust uit — dat staat letterlijk in de kop van die functie: "die horen
     op Overzicht en bij Projecten Vertraagd; ze hebben een eigen scherm met
     eigen acties". Die keuze is goed, maar hij kostte drie signalen hun
     enige plek: een stille zending, een verlopen ETA en een herinnering die
     vandaag afloopt kwamen na het verdwijnen van de oude cockpit nergens
     meer bovendrijven. De mappingtabel wijst ze toe aan Overzicht → Nu doen
     en aan Projecten → filter Vertraagd. Dit hoofdstuk is die toewijzing.

     ÉÉN BRON, EN LIEFST DE BESTAANDE
     De rekenregels wonen in computeSignals() in beheer.html, vierde bak.
     Die functie staat in het afgesloten scriptblok van dat bestand en is van
     hieruit niet aan te roepen: alleen window.CP_BEHEER_INDELING komt daar
     naar buiten. Daarom kijkt zendingSignalen() eerst of de uitkomst al
     MEEGELEVERD is: draagt de lijstenverzameling een `sig` — of een
     `signalen`, want dat contract biedt een lijst vaker onder twee namen
     aan — dan is dát de bron. Ontbreekt hij, dan staat de berekening
     hieronder, op ÉÉN plek, met de grenzen van computeSignals letterlijk
     overgenomen.

     DE TERUGVAL VALT DAN OOK ECHT STIL, EN ER ONTSTAAT GEEN TWEEDE TELLING
     De twee wegen sluiten elkaar uit: is er een meegeleverde uitkomst, dan
     keert de functie meteen terug en draait de lus eronder geen enkele keer.
     Er wordt niets bij elkaar opgeteld en niets aangevuld — wie een halve
     lijst meelevert, krijgt die halve lijst terug en geen mengeling van twee
     bronnen. Alle lezers (Nu doen, de chip Vertraagd, de projectkaart) halen
     hun signalen langs deze ene functie op, dus ze schuiven vanzelf mee.

     DE UITSLUITING STAAT ÉÉN KEER, EN DAT IS HIER
     Een zending met een ETA-signaal komt NOOIT óók in de stiltelijst. In
     computeSignals is dat een `return` middenin de lus; hieronder is het
     dezelfde `return`, in dezelfde lus, op dezelfde plaats. Elke lezer van
     deze uitkomst — "Nu doen", het projectfilter Vertraagd, de projectkaart
     — erft die uitsluiting daardoor, en geen enkele lezer toetst hem nog
     een tweede keer.

     DE VORM VAN DE UITKOMST
     { eta: [...], stil: [...] } — precies de twee lijsten die
     CP_MODEL.isDelayed() leest voor de chip Vertraagd, met per item dezelfde
     velden als computeSignals ze zet (type, key, projectId, shipment,
     events, passed / stilDays).
     ER ZIT BEWUST GEEN `items` IN, OOK NIET ALS DE GASTHEER HET WÉL MEELEVERT.
     CP_DATA.portfolioHealth() leest juist dat veld en telt daaruit de
     gezondheid van de hele portefeuille. Twee van de zes signaalsoorten erin
     stoppen zou een halve meting als een hele presenteren; zonder `items`
     blijft die kaart precies zo eerlijk "niet gemeten" als hij was. Levert
     iaLaadLijsten() ooit de vólledige uitkomst van computeSignals mee, dan
     hoort de keuze om die kaart daarop te laten rekenen op Projecten gemaakt
     te worden en niet stilletjes hier: deze functie geeft twee lijsten terug
     en niets meer.
     ============================================================ */

  var zendingSignalen = function (ctx) {
    var d = D(ctx);
    /* al berekend door de gastheer? Dan is dát de bron en rekent dit bestand
       zelf niets meer uit — de lus hieronder draait dan niet. */
    var meegeleverd = isObj(d.sig) ? d.sig : opt(d.signalen);
    if (Array.isArray(meegeleverd.eta) || Array.isArray(meegeleverd.stil)) {
      return { eta: lijst(meegeleverd.eta), stil: lijst(meegeleverd.stil) };
    }

    var m = MOD(ctx);
    var vandaag = dagVan(ctx, nuVan(ctx));
    /* de stiltedrempel is een instelling (Automatiseringen); computeSignals
       valt op 5 dagen terug en dat doen we hier ook — niet omdat 5 mooi is,
       maar omdat het dezelfde terugval moet zijn. */
    var drempel = getal(opt(d.settings).stilteDrempelDagen, 5);
    if (!(drempel > 0)) drempel = 5;

    var dagenSinds = function (waarde) {
      var dag = dagVan(ctx, waarde);
      if (!dag || !m || !fn(m.daysBetween)) return null;
      var n = m.daysBetween(dag, vandaag);
      return (n === null || n === undefined) ? null : n;
    };

    var projectOp = indexOp(lijst(d.projects), 'id');

    var perZending = {};
    lijst(d.shipmentEvents).forEach(function (ev) {
      if (!ev || !ev.shipmentId) return;
      if (!perZending[ev.shipmentId]) perZending[ev.shipmentId] = [];
      perZending[ev.shipmentId].push(ev);
    });

    /* de laatste foto PER PROJECT: een nieuwe foto uit de fabriek is ook
       beweging, en zonder die tweede bron zou elke zending zonder mijlpalen
       na vijf dagen stil heten terwijl er wel degelijk beeld binnenkwam */
    var laatsteFoto = {};
    lijst(d.media).forEach(function (r) {
      if (!r || !r.projectId) return;
      var dag = dagVan(ctx, r.capturedAt);
      if (!dag) return;
      if (!laatsteFoto[r.projectId] || dag > laatsteFoto[r.projectId]) laatsteFoto[r.projectId] = dag;
    });

    var eta = [], stil = [];
    lijst(d.shipments).forEach(function (s) {
      if (!s || !s.id) return;
      if (s.deliveredAt) return;
      var p = projectOp[s.projectId];
      if (p && p.status === 'archived') return;

      var events = (perZending[s.id] || []).slice(0);
      events.sort(function (a, b) {
        return tekst(a && a.occurredAt) < tekst(b && b.occurredAt) ? -1 : 1;
      });
      var geleverd = false;
      events.forEach(function (ev) { if (ev && ev.milestoneKey === 'geleverd') geleverd = true; });
      if (geleverd) return;

      var sleutel = (m && fn(m.itemKey)) ? m.itemKey('zending', s.id) : ('ship:' + s.id);

      /* 1. ETA-venster: computeSignals slaat toe zodra het EINDE VAN DE DAG
         van etaWindowEnd nog minder dan 48 uur weg is. In hele dagen is dat
         precies "het venster sluit vandaag of morgen, of het is al gesloten"
         — dezelfde grens, zonder een klok te lezen die dit bestand niet mag
         lezen (elk scherm rekent met ctx.nu). */
      var venster = dagVan(ctx, s.etaWindowEnd);
      if (venster) {
        var dagenTot = (m && fn(m.daysBetween)) ? m.daysBetween(vandaag, venster) : null;
        if (dagenTot !== null && dagenTot <= 1) {
          eta.push({
            type: 'eta', key: sleutel, projectId: s.projectId,
            shipment: s, events: events, passed: venster < vandaag
          });
          return;   /* DE UITSLUITING: niet óók in de stiltelijst */
        }
      }

      /* 2. stil: geen nieuwe mijlpaal én geen nieuwe foto in `drempel` dagen */
      var laatsteBeweging = dagVan(ctx, s.createdAt);
      events.forEach(function (ev) {
        var dag = dagVan(ctx, ev && ev.occurredAt);
        if (dag && (!laatsteBeweging || dag > laatsteBeweging)) laatsteBeweging = dag;
      });
      var stilDagen = dagenSinds(laatsteBeweging);
      if (stilDagen === null || stilDagen < drempel) return;
      var fotoDagen = laatsteFoto[s.projectId] ? dagenSinds(laatsteFoto[s.projectId]) : null;
      if (fotoDagen !== null && fotoDagen < drempel) return;
      stil.push({
        type: 'stil', key: sleutel, projectId: s.projectId,
        shipment: s, events: events,
        stilDays: (fotoDagen === null ? stilDagen : Math.min(stilDagen, fotoDagen))
      });
    });

    return { eta: eta, stil: stil };
  };

  /* de zendingtitel zoals beheer.html hem schrijft (shipmentTitle): soort ·
     vervoerder · nummer. De tabel komt uit CP_SHIPPING, het gedeelde
     zendingenbestand dat portal.html én beheer.html allebei laden — hij
     wordt hier dus niet overgetypt. */
  var zendingTitel = function (s) {
    var SHIP = root.CP_SHIPPING;
    var nummer = eersteTekst(s && s.containerNumber, s && s.trackingNumber);
    if (!SHIP) return samen([tekst(s && s.type), nummer]);
    var vervoerder = (SHIP.CARRIERS && SHIP.CARRIERS[s && s.carrierCode]) || null;
    return samen([SHIP.typeLabel(s && s.type), vervoerder ? tekst(vervoerder.name) : '', nummer]);
  };

  /* de eerstvolgende openstaande mijlpaal van een zending. Dezelfde keuze
     die de stille-zendingrij van de oude cockpit maakte, en dezelfde die de
     haak mijlpaalAfvinken zonder tweede argument zelf neemt — dit hulpje
     bestaat alleen om het LABEL in het menu te kunnen zetten. */
  var volgendeMijlpaal = function (s, events) {
    var SHIP = root.CP_SHIPPING;
    if (!SHIP || !fn(SHIP.milestonesFor)) return null;
    var gedaan = {};
    lijst(events).forEach(function (ev) { if (ev && ev.milestoneKey) gedaan[ev.milestoneKey] = true; });
    var tpl = lijst(SHIP.milestonesFor(s && s.type));
    for (var i = 0; i < tpl.length; i++) {
      if (tpl[i] && !gedaan[tpl[i].key]) return tpl[i];
    }
    return null;
  };

  /* DE ITEMSTATUS OP EEN ITEM DAT NIET UIT collectInbox KOMT.
     Die functie doet dit zelf, binnenin push(); hieronder staat exact
     dezelfde bewerking, één keer, voor de signalen van hoofdstuk 4b én de
     terugrijen van 4c. Langs dezelfde CP_MODEL-functies en op dezelfde
     sleutels, zodat een uitstel dat in de oude cockpit is gezet hier nog
     steeds bij hetzelfde item hoort. */
  var zetItemStatus = function (ctx, states, item) {
    var m = MOD(ctx);
    var nu = nuVan(ctx);
    var vandaag = dagVan(ctx, nu);
    var tot = (m && fn(m.snoozedUntil)) ? m.snoozedUntil(item, states) : null;
    var loopt = !!(tot && dagVan(ctx, tot) > vandaag);
    item.owner = (m && fn(m.ownerOf)) ? m.ownerOf(item, states) : 'mij';
    item.snoozedUntil = loopt ? tot : null;
    item.returnedAt = (tot && !loopt) ? tot : null;
    item.pinned = (m && fn(m.isPinned)) ? m.isPinned(item, states) : false;
    if (m && fn(m.isChasing) && m.isChasing(item, states, nu)) item.urgent = true;
    return item;
  };

  /* de sleutel waarop de itemstatus van een item staat. Het item draagt hem
     meestal zelf; anders stelt CP_MODEL.itemKey hem samen uit soort en id. */
  var itemSleutel = function (ctx, item) {
    if (!item) return '';
    var eigen = tekst(item.key);
    if (eigen) return eigen;
    var m = MOD(ctx);
    return (m && fn(m.itemKey)) ? tekst(m.itemKey(item.kind, item.id)) : '';
  };

  /* DE DRIE SIGNALEN ALS ITEM.
     Zelfde vorm als collectInbox() zijn items geeft, want elke rijbouwer,
     elk menu en elke haak in dit bestand leest die vorm al. De itemstatus
     (uitstel, pin, bal) komt uit dezelfde settings.itemState en langs
     dezelfde CP_MODEL-functies, op dezelfde sleutels: 'ship:<id>' voor een
     zending — letterlijk de sleutel die computeSignals gebruikt — en
     'rem:<id>' voor een herinnering.

     `buitenInbox` markeert ze voor itemNavigatie(): deze items staan NIET in
     de Inbox, dus de menurij "Toon in de Inbox" zou naar een lege selectie
     wijzen. */
  var signaalItems = function (ctx) {
    var d = D(ctx);
    var m = MOD(ctx);
    var vandaag = dagVan(ctx, nuVan(ctx));
    var states = opt(opt(d.settings).itemState);
    var projectOp = indexOp(lijst(d.projects), 'id');
    var uit = [];

    var status = function (item) { return zetItemStatus(ctx, states, item); };

    var sig = zendingSignalen(ctx);

    lijst(sig.eta).forEach(function (r) {
      var s = opt(r.shipment);
      var p = projectOp[r.projectId] || null;
      uit.push(status({
        id: tekst(s.id), kind: 'eta', key: tekst(r.key), chip: null,
        title: zendingTitel(s),
        sub: samen([
          'Venster ' + datumTekst(ctx, s.etaWindowStart) + ' – ' + datumTekst(ctx, s.etaWindowEnd),
          volgendeMijlpaal(s, r.events) ? 'volgende stap: ' + tekst(volgendeMijlpaal(s, r.events).label) : ''
        ]),
        projectId: r.projectId || null,
        clientId: p ? (p.clientId || null) : null,
        at: s.etaWindowEnd || null,
        urgent: !!r.passed,
        /* het woord naast de stip: "ETA verlopen" of "ETA loopt af" — de
           twee standen die de oude ETA-rij ook toonde */
        signaalWoord: r.passed ? 'ETA verlopen' : 'ETA loopt af',
        signaalToon: r.passed ? 'kritiek' : 'wacht',
        buitenInbox: true,
        events: lijst(r.events),
        raw: s
      }));
    });

    lijst(sig.stil).forEach(function (r) {
      var s = opt(r.shipment);
      var p = projectOp[r.projectId] || null;
      var volgende = volgendeMijlpaal(s, r.events);
      uit.push(status({
        id: tekst(s.id), kind: 'stil', key: tekst(r.key), chip: null,
        title: zendingTitel(s),
        sub: samen([
          getal(r.stilDays, 0) + ' dagen geen beweging',
          volgende ? 'volgende stap: ' + tekst(volgende.label) : ''
        ]),
        projectId: r.projectId || null,
        clientId: p ? (p.clientId || null) : null,
        at: null,
        /* stil is GEEN urgentie: computeSignals kent er geen grens voor en
           CP_DATA.isUrgentSignaal ook niet. Er wordt hier geen nieuwe
           drempel verzonnen. */
        urgent: false,
        signaalWoord: getal(r.stilDays, 0) + ' dagen stil',
        signaalToon: 'wacht',
        buitenInbox: true,
        events: lijst(r.events),
        raw: s
      }));
    });

    /* follow-up-herinneringen: dezelfde regel als de oude cockpit —
       een contactmoment met een terugkomdatum die vandaag of eerder viel en
       dat nog niet is afgevinkt. */
    var momenten = lijst(d.contactMoments).length ? lijst(d.contactMoments) : lijst(d.moments);
    var klantOp = indexOp(lijst(d.clients), 'id');
    momenten.forEach(function (mnt) {
      if (!mnt || !mnt.id || !mnt.remindAt || mnt.remindDone) return;
      var dag = dagVan(ctx, mnt.remindAt);
      if (!dag || dag > vandaag) return;
      var klant = klantOp[mnt.clientId] || null;
      uit.push(status({
        id: tekst(mnt.id), kind: 'herinnering',
        key: (m && fn(m.itemKey)) ? m.itemKey('herinnering', mnt.id) : ('rem:' + mnt.id),
        chip: null,
        title: eersteTekst(mnt.note, 'Contactmoment opvolgen'),
        sub: samen([klantNaam(klant), 'beloofd op ' + datumTekst(ctx, dag)]),
        projectId: mnt.projectId || null,
        clientId: mnt.clientId || null,
        at: mnt.remindAt || null,
        urgent: dag < vandaag,
        signaalWoord: dag < vandaag ? 'Beloofd voor ' + datumTekst(ctx, dag) : 'Loopt vandaag af',
        signaalToon: dag < vandaag ? 'kritiek' : 'wacht',
        buitenInbox: true,
        raw: mnt
      }));
    });

    return uit;
  };

  /* ============================================================
     4c. EEN AFGELOPEN UITSTEL DAT NERGENS ANDERS BOVENDRIJFT

     WAT ER STUK WAS
     Uitstel, pin en bal leven in settings.itemState op een sleutel per item,
     en die sleutel overleeft het item. Een conceptfactuur is een Inbox-item;
     versturen maakt er een openstaande factuur van, en die laat collectInbox
     er bewust uit — verstuurde facturen horen in Financiën, anders loopt de
     werkvoorraad elke maand vol met geld waar geen handeling bij hoort. Het
     uitstel dat je er als concept op zette, loopt daarna gewoon door. Liep
     het af, dan hoorde je dat te zien, en dat gebeurde nergens meer: in de
     oude indeling stond zo'n item in de bak `terug` van verdeelItems(), want
     die bak werkte op de items van computeSignals() en dáár zit een
     openstaande factuur wél in. De demodata zet er precies één klaar
     ('inv:inv-04'), en juist die viel in de nieuwe indeling van het scherm af.

     WAAROM ER MAAR ÉÉN SOORT UITKOMT
     Elk ander soort dat een uitstel kan dragen, ís al een rij zolang er werk
     aan is: een open vraag, een aanvraag die nog niet omgezet is, een
     concept, een fase op akkoord en een wachtende sampleronde staan in de
     Inbox, en een stille zending, een verlopen ETA en een openstaande
     herinnering staan hierboven in hoofdstuk 4b. Hun teruggekeerde uitstel is
     daarmee al zichtbaar — en mocht een van die rijen hier tóch langskomen,
     dan valt hij op zijn sleutel weg tegen wat er al staat. Wat overblijft is
     de verstuurde, openstaande factuur.

     ALLEEN EEN UITSTEL DAT AFGELOPEN IS, NOOIT DE HELE STAPEL
     Zonder die grens zou elke openstaande factuur op Overzicht komen te
     staan, en dat is precies wat collectInbox bewust niet doet. De grens
     wordt niet zelf uitgerekend maar afgelezen: zetItemStatus() zet
     returnedAt met dezelfde CP_MODEL-functies als elk ander item, en alleen
     een item mét returnedAt komt hieronder in de lijst.
     ============================================================ */

  var terugItems = function (ctx, alGetoond) {
    var d = D(ctx);
    var m = MOD(ctx);
    var data = DAT(ctx);
    var vandaag = dagVan(ctx, nuVan(ctx));
    var states = opt(opt(d.settings).itemState);
    var projectOp = indexOp(lijst(d.projects), 'id');
    var klantOp = indexOp(lijst(d.clients), 'id');

    /* wat al ergens in de lijst staat, hoeft er geen tweede keer in */
    var gezien = {};
    lijst(alGetoond).forEach(function (it) {
      var s = itemSleutel(ctx, it);
      if (s) gezien[s] = true;
    });

    var uit = [];
    lijst(d.invoices).forEach(function (inv) {
      if (!inv || !inv.id) return;
      /* dezelfde grens als de derde bak van computeSignals: verstuurd en nog
         niet betaald. Een conceptfactuur staat in de Inbox en komt hier dus
         niet langs; een gearchiveerd project valt af, net als daar. */
      if (tekst(inv.status) !== 'open') return;
      if (m && fn(m.isConceptRow) && m.isConceptRow(inv)) return;
      var project = projectOp[inv.projectId] || null;
      if (project && project.status === 'archived') return;

      var sleutel = (m && fn(m.itemKey)) ? tekst(m.itemKey('factuur', inv.id)) : ('inv:' + inv.id);
      if (gezien[sleutel]) return;

      var verval = (m && fn(m.invoiceDueISO)) ? m.invoiceDueISO(inv) : null;
      var bedrag = (data && fn(data.factuurBedragCents))
        ? data.factuurBedragCents(inv)
        : getal(inv.amountCents, 0);
      var klant = project ? (klantOp[project.clientId] || null) : null;

      var item = zetItemStatus(ctx, states, {
        id: tekst(inv.id), kind: 'factuur', key: sleutel, chip: null,
        /* HET SOORTWOORD EN HET KNOPLABEL WIJKEN AF, DE REST NIET.
           ITEM_SOORT en PRIMAIR_LABEL zeggen bij soort 'factuur'
           "Conceptfactuur" en "Open de conceptfactuur", want dat is wat er in
           de Inbox staat. Deze is verstuurd, dus dat woord zou hier onwaar
           zijn. Het icoon, de route, de haak factuurOpenen en het hele •••
           blijven wél die van elke andere factuur — het ís er een. */
        soortWoord: 'Openstaande factuur',
        primairLabel: 'Open de factuur',
        title: samen([tekst(inv.invoiceNumber), tekst(inv.label)]) || 'Factuur zonder omschrijving',
        sub: samen([
          klantNaam(klant),
          bedragTekst(ctx, bedrag),
          verval ? 'vervalt ' + datumTekst(ctx, verval) : ''
        ]),
        projectId: inv.projectId || null,
        clientId: klant ? klant.id : null,
        at: inv.createdAt || null,
        /* te laat = de vervaldatum is verstreken. Dezelfde grens die de tab
           Financiën van een project gebruikt; er komt hier geen tweede bij. */
        urgent: !!(verval && verval < vandaag),
        buitenInbox: true,
        raw: inv
      });

      if (!item.returnedAt) return;
      uit.push(item);
    });

    return uit;
  };

  /* de ctx die CP_MODEL.nextDateFor en filterProjects/sortProjects lezen.
     shipmentEvents zit niet in het schermcontract; ontbreekt hij, dan valt
     nextDateFor terug op shipments[].deliveredAt en dat is precies wat die
     functie daarvoor heeft.

     `sig` is nieuw en het is de reden dat de chip "Vertraagd" er sinds deze
     ronde staat: CP_MODEL.isDelayed() leest hem, en zonder hem liet
     PROJECT_CHIPS die chip terecht weg ("niet gemeten" is iets anders dan
     nul). Zie hoofdstuk 4b voor wat er wel en niet in dat object zit. */
  var modelCtx = function (ctx, items) {
    var d = D(ctx);
    return {
      items: lijst(items),
      sig: zendingSignalen(ctx),
      clients: lijst(d.clients),
      shipments: lijst(d.shipments),
      events: lijst(d.shipmentEvents),
      questions: lijst(d.questions),
      invoices: lijst(d.invoices),
      moments: lijst(d.contactMoments).length ? lijst(d.contactMoments) : lijst(d.moments),
      drafts: conceptRijen(ctx, d),
      settings: opt(d.settings),
      now: nuVan(ctx)
    };
  };

  /* de activiteitsfeed. BRON: CP_MODEL.mergeActivity — de enige bron voor
     alle vier de activiteitsweergaven (beslissing 2.6 van het migratieplan). */
  var activiteit = function (ctx, scope) {
    var m = MOD(ctx);
    if (!m || !fn(m.mergeActivity)) return [];
    var d = D(ctx);
    var fases = [];
    lijst(d.projects).forEach(function (p) {
      if (!p) return;
      lijst(p.stages).forEach(function (s) {
        if (!s) return;
        fases.push({
          projectId: p.id, stageKey: s.stageKey, status: s.status,
          approvedAt: s.approvedAt, paymentPct: s.paymentPct, position: s.position,
          /* 0021: wie akkoord gaf en langs welke weg. Zonder deze twee velden
             schreef mergeActivity elk akkoord als kale regel "Fase
             goedgekeurd: …" van de soort klant, ook als de klant het zelf in
             het portaal deed — de soort 'akkoord' en de naam bleven dan uit
             de tijdlijn. */
          approvedBy: s.approvedBy, approvedVia: s.approvedVia
        });
      });
    });
    return m.mergeActivity({
      accessLog: lijst(d.log),
      mailLog: lijst(d.mailLog),
      auditLog: lijst(d.audit),
      contacts: lijst(d.contactMoments).length ? lijst(d.contactMoments) : lijst(d.moments),
      questions: lijst(d.questions),
      stages: fases,
      shipments: lijst(d.shipments),
      shipmentEvents: lijst(d.shipmentEvents),
      invoices: lijst(d.invoices),
      projects: lijst(d.projects),
      stageLabel: faseNaamVan(ctx)
    }, opt(scope));
  };

  /* het projectbeeld. BRON: de eerste gepubliceerde foto van het project —
     hoofdstuk 7 van de mockupspec wijst die bron letterlijk aan. Een
     conceptfoto telt niet mee: die heeft de klant nog nooit gezien. */
  var projectFoto = function (ctx, projectId) {
    var d = D(ctx);
    var uit = '';
    lijst(d.media).forEach(function (r) {
      if (uit || !r || r.projectId !== projectId) return;
      if (r.publishStatus === 'concept') return;
      if (!tekst(r.src)) return;
      uit = tekst(r.src);
    });
    return uit;
  };

  var klantVan = function (ctx, project) {
    if (!project) return null;
    return indexOp(lijst(D(ctx).clients), 'id')[project.clientId] || null;
  };

  var klantNaam = function (klant) {
    if (!klant) return '';
    return eersteTekst(klant.company, klant.contactName);
  };

  /* de voortgang van een project.
     BRON: de fases van het project — afgerond gedeeld door totaal, en niets
     anders. Zonder fases is er niets te meten en is het antwoord null, geen
     nul: nul is "niets af", null is "niet te zeggen".

     DE RING OP 0% (observatie V4) — WAAR HET PERCENTAGE VANDAAN KOMT.
     Nagelopen tegen de gegevens: de teller is het aantal fases met
     status 'done', de noemer het aantal fases van het project. Dat klopt, en
     0% is bij een pas gestart project dus geen storing maar een meting: er is
     nog geen enkele fase afgerond. Een project halverwege (vier van de zes
     afgerond) toont hier gewoon 67%.

     OPNIEUW NAGEREKEND OP DE DEMODATA (opdracht C). De 0% die op de
     projectkaart van "Nestbare kampeerkookset" staat, is echt:
     portal/demo-data.js zet dat project (prj-cookset, aangemaakt 14-08-2026)
     op zes fases waarvan 'concept' de status 'current' heeft en de andere
     vijf 'upcoming' — nul keer 'done', dus 0 van 6 en 0%. Ter vergelijking
     staat prj-diffuser in hetzelfde bestand op vier keer 'done' en toont die
     kaart 67%, en prj-geurflacon is helemaal rond. De berekening is dus niet
     gerepareerd, want er was niets stuk; wat wél is veranderd, is dat de ring
     nu te ZIEN is (zie het kleurcommentaar bij de aanroep in projectKaart).
     De 45% en 78% uit de mockup blijven wat ze zijn: demowaarden uit een
     plaatje, en die tekenen we niet na.

     Wat er WEL ontbrak, is de betekenis. De ring heette "voortgang" zonder
     ergens te zeggen waarvan, en bij 0% is er geen boog te zien — dan lijkt
     een geldige meting op een kapot component. Daarom geeft deze functie de
     teller en de noemer terug in plaats van alleen een percentage: de
     aanroeper zet ze in de tooltip en in het aria-label, en de ring vertelt
     zo in woorden wat de boog laat zien.

     De ring verdwijnt alleen als er GEEN bron is (een project zonder fases).
     Dan is er niets te meten en zou een ring op 0% beweren dat er niets af
     is, terwijl het antwoord "niet te zeggen" is. */
  var faseVoortgang = function (project) {
    var stages = lijst(project && project.stages);
    if (!stages.length) return null;
    var af = 0;
    stages.forEach(function (s) { if (s && s.status === 'done') af++; });
    return { af: af, totaal: stages.length, pct: Math.round((af / stages.length) * 100) };
  };

  var fasesGesorteerd = function (project) {
    var stages = lijst(project && project.stages).slice(0);
    stages.sort(function (a, b) {
      return getal(a && a.position, 0) - getal(b && b.position, 0);
    });
    return stages;
  };

  /* de index van de fase waar het project NU staat: de eerste die niet
     afgerond is. Is alles afgerond, dan is dat de laatste — het project is
     aan het eind van het pad en niet aan het begin. */
  var actieveFaseIndex = function (stages) {
    for (var i = 0; i < stages.length; i++) {
      if (!stages[i] || stages[i].status !== 'done') return i;
    }
    return stages.length ? stages.length - 1 : -1;
  };

  /* ============================================================
     5. WAT MOET ER MET DIT ITEM GEBEUREN

     De actiewoorden hieronder zijn GEEN verzonnen gegevens: ze zijn de
     Nederlandse benoeming van een itemsoort die uit collectInbox komt. Het
     getal, de naam en de datum in de regel komen altijd uit het item zelf.
     ============================================================ */

  /* de icoonnamen komen uit de tabel van CP_UI (admin-ui.js, ICONEN). Een
     naam die daar niet in staat levert een leeg <svg> op zonder enige vorm —
     precies wat 'geld' hier deed. De juiste naam is 'financien', en dat is
     ook de naam die de twee andere schermbestanden al gebruiken. */
  var ITEM_ICOON = {
    brief: 'inbox', vraag: 'mail', fase: 'vinkje',
    factuur: 'financien', concept: 'bestand', sample: 'camera',
    /* de drie soorten uit hoofdstuk 4b */
    eta: 'klok', stil: 'waarschuwing', herinnering: 'bel',
    /* DE VIJF KLANTACTIES UIT 0021 (collectInbox). Alle vijf namen staan in
       ICONEN van admin-ui.js; een naam die daar ontbreekt tekent een
       terugval en waarschuwt in de console. */
    betaling: 'financien', klantbestand: 'bestand', samplebeslissing: 'camera',
    bezwaar: 'waarschuwing', herbestelling: 'projecten'
  };

  var ITEM_SOORT = {
    brief: 'Aanvraag', vraag: 'Klantvraag', fase: 'Goedkeuring',
    factuur: 'Conceptfactuur', concept: 'Concept', sample: 'Sampleronde',
    eta: 'Zending', stil: 'Zending', herinnering: 'Herinnering',
    betaling: 'Betaling gemeld', klantbestand: 'Bestand van klant',
    samplebeslissing: 'Samplebeslissing', bezwaar: 'Bezwaar', herbestelling: 'Herbestelling'
  };

  var ITEM_ACTIE = {
    brief: 'Zet de aanvraag om naar een klant en een project',
    vraag: 'Beantwoord de vraag van de klant',
    fase: 'Wacht op akkoord van de klant',
    factuur: 'Werk de conceptfactuur af',
    concept: 'Publiceer dit concept of plan het in',
    sample: 'Wacht op de keuze van de klant',
    eta: 'Werk de ETA bij of vink de levering af',
    stil: 'Vraag na of deze zending nog loopt',
    herinnering: 'Kom terug op wat je bij dit contactmoment beloofde',
    betaling: 'Controleer de gemelde betaling en bevestig hem',
    klantbestand: 'Bekijk het bestand dat de klant aanleverde',
    samplebeslissing: 'Verwerk de beslissing van de klant op de sampleronde',
    bezwaar: 'Behandel het bezwaar van de klant op de factuur',
    herbestelling: 'Maak van de herbestelling een project'
  };

  /* de haaknamen die dit bestand kent. Zie het kopblok: allemaal optioneel.

     DE NAMEN ZIJN LETTERLIJK DIE VAN iaActies() IN BEHEER.HTML. Ze worden
     hier nooit in een andere vorm overgetypt: een tikfout in een naam levert
     stil een ontbrekende haak op, en dus stil een verdwenen actie — precies
     het verlies dat deze ronde moest repareren. */
  var HAKEN = {
    /* de primaire actie per itemsoort */
    brief: 'aanvraagOmzetten',
    vraag: 'vraagBeantwoorden',
    fase: 'faseOpenen',
    factuur: 'factuurOpenen',
    concept: 'conceptPubliceren',
    sample: 'sampleOpenen',

    /* de drie signalen van hoofdstuk 4b. Ze hangen aan haken die er AL
       waren — er is geen enkele nieuwe haak voor nodig geweest:
         eta          staat verderop al als `eta`: openEtaModal, hetzelfde
                      venster als de ETA-knop op de zendingrij van het
                      projectdetail. Hij wordt hier dus niet nog eens
                      opgeschreven;
         stil         mijlpaalAfvinken ZONDER tweede argument, dus de haak
                      pakt zelf de eerstvolgende openstaande stap uit het
                      sjabloon — precies de keuze die de oude stille-
                      zendingrij maakte;
         herinnering  setReminderDone via contactmomentAfvinken. */
    stil: 'mijlpaalAfvinken',
    herinnering: 'contactmomentAfvinken',

    /* DE VIJF KLANTACTIES UIT 0021 — de tegenhangers in iaActies(), sectie
       PORTAAL. Elke haak opent een BESTAAND venster met de gegevens van de
       klant voorgevuld, of springt naar de plek waar de handeling al woont.
       herbestellingStap is de tweede haak van dezelfde soort: de
       tussenstappen aanvraag → offerte → akkoord op de rij zelf. */
    betaling: 'betalingVerifieren',
    klantbestand: 'klantbestandBekijken',
    samplebeslissing: 'sampleAanpassingVerwerken',
    bezwaar: 'bezwaarBehandelen',
    herbestelling: 'herbestellingOppakken',
    herbestellingStap: 'herbestellingStapZetten',

    /* Overzicht — de itemacties per rij en de dagafsluiting */
    snoozen: 'itemSnoozen',
    pinnen: 'itemPinnen',
    balVerleggen: 'itemBalVerleggen',
    najagen: 'itemNajagen',
    dagAfsluiten: 'dagAfsluiten',

    /* Inbox — wat er naast en achter de primaire knop hoort */
    antwoordBewerken: 'vraagAntwoordBewerken',
    faseStatus: 'faseStatusZetten',
    conceptVerwijderen: 'conceptVerwijderen',
    inplannen: 'publicatieInplannen',
    planAnnuleren: 'publicatieAnnuleren',
    nuPubliceren: 'nuPubliceren',
    factuurPubliceren: 'factuurPubliceren',
    factuurPdf: 'factuurPdf',
    sampleGoedkeuren: 'sampleGoedkeuren',

    /* Projectdetail */
    nieuwProject: 'nieuwProject',
    nieuweUpdate: 'nieuweUpdate',
    alsKlant: 'bekijkAlsKlant',
    publiceren: 'projectPubliceren',
    exporteren: 'dossierExport',
    dupliceren: 'projectDupliceren',
    archiveren: 'projectArchiveren',
    projectBewerken: 'projectBewerken',
    projectwaarde: 'projectwaardeBewerken',
    faseFactureren: 'faseFactureren',
    faseDatum: 'faseDatumBewerken',
    fotoToevoegen: 'mediaToevoegen',
    fotoBewerken: 'mediaBewerken',
    fotoVerwijderen: 'mediaVerwijderen',
    /* de twee helften van "Kopieer naar…" (functie 51). Het zijn met opzet
       twee haken en geen één: iaKopieerNaarProject() moet weten of het om
       een foto of om een document gaat, want openCopyToProjectModal krijgt
       twee gescheiden lijsten mee. */
    fotoKopieren: 'mediaKopierenNaar',
    documentToevoegen: 'documentToevoegen',
    documentBewerken: 'documentBewerken',
    documentKopieren: 'documentKopierenNaar',
    documentVerwijderen: 'documentVerwijderen',
    /* de documentslots (functie 52). Vullen opent het documentvenster
       voorgevuld met type, fase en slot-id; verwijderen gooit het slot echt
       weg — zie haakRij() voor waarom die ene rij een vraag vooraf heeft. */
    slotVullen: 'documentSlotVullen',
    slotVerwijderen: 'documentSlotVerwijderen',
    disclosure: 'disclosureVastleggen',
    zendingToevoegen: 'zendingToevoegen',
    mijlpaal: 'mijlpaalAfvinken',
    eta: 'etaBijwerken',
    sampleToevoegen: 'sampleTdToevoegen',
    inspectie: 'inspectieToevoegen',

    /* de factuurrijen op de tab Financiën van een project */
    factuurBetaald: 'factuurBetaaldMarkeren',
    factuurHerinnering: 'factuurHerinnering',
    factuurAnnuleren: 'factuurAnnuleren'
  };

  var haak = function (ctx, naam) {
    var haken = opt(ctx && ctx.acties);
    return fn(haken[naam]);
  };

  /* ELKE HAAK EINDIGT ZELF IN DE VASTE AFSLUITER.
     De haken van beheer.html sluiten hun eigen venster, schrijven hun
     auditregel en roepen daarna refresh() aan — en refresh() ís
     window.CP_SHELL.ververs() zodra de nieuwe indeling draait. Dit bestand
     roept daarom NOOIT zelf ctx.ververs() aan na een haak: twee verversingen
     op één handeling zijn twee tekeningen, en de tweede gooit de eerste weg.
     Waar hieronder "eindigt in ververs()" staat, wordt dus die ene weg
     bedoeld, niet een tweede ernaast.

     EEN MENURIJ DIE AAN EEN ONTBREKENDE HAAK HANGT, KOMT ER NIET.
     Dat is de opdracht letterlijk: liever geen actie dan een knop die niets
     doet. Deze functie geeft null terug als de haak er niet is, en
     CP_UI.contextMenu laat een null-item vanzelf vallen. Alleen de vaste
     zeven regels van de projectkop houden hun bestaande "— nog niet
     gekoppeld"-vorm: dat menu is één keer per pagina en daar is een gat
     informatie, terwijl het per rij van een lijst alleen ruis zou zijn. */
  /* dezelfde regel voor de actie rechts in een sectiekop ("Foto toevoegen →").
     Geen haak, geen link: een sectiekop met een dode link is precies de knop
     die niets doet waar de opdracht voor waarschuwt. */
  var sectieActie = function (ctx, naam, label, doe, ico) {
    var h = haak(ctx, naam);
    if (!h) return null;
    return { label: label, ico: tekst(ico) || 'plus', onClick: function () { doe(h); } };
  };

  /* `gevaarlijk` zet de rij in de kritieke kleur en hoort onderin zijn groep.
     Er zit standaard GEEN bevestigingsvraag aan vast: bijna elke gevaarlijke
     rij in dit bestand heeft al een vangnet uit de app zelf — een concept,
     een foto en een document verdwijnen via verwijderMetUndo met vijftien
     seconden "Maak ongedaan", en een factuur annuleren gebeurt in de
     factuureditor, die zijn eigen bevestiging draagt. Er een tweede vraag
     vóór zetten zou een tweede weg naast een bestaande afsluiter zijn.

     ÉÉN RIJ HEEFT DAT VANGNET NIET, EN DAARVOOR IS `bevestig`.
     "Verwijder slot" haalt een documentslot weg, en een slot gaat niet door
     de prullenbak: DS.deleteDocSlot() gooit de rij echt weg. De haak zegt dat
     er zelf bij — er is niets om terug te zetten, dus er komt bewust geen
     ongedaan-maken-melding, want die zou een herstel beloven dat de datalaag
     niet kan waarmaken. Precies daarom draagt die ene rij wél een vraag
     vooraf: de inline bevestiging van CP_UI.contextMenu, twee regels in het
     menu zelf en geen apart venster. */
  var haakRij = function (ctx, naam, label, ico, doe, gevaarlijk, bevestig) {
    var h = haak(ctx, naam);
    if (!h) return null;
    return {
      label: label,
      ico: ico,
      gevaarlijk: !!gevaarlijk,
      /* CP_UI.contextMenu toont de vraag alleen als dit een object is */
      bevestig: isObj(bevestig) ? bevestig : null,
      onKies: function () { doe(h); }
    };
  };

  /* een scheiding hoort alleen tussen twee GEVULDE groepen. Zonder deze
     controle levert een item zonder itemacties een menu op dat met een
     streep begint. */
  var voegGroepToe = function (doel, groep) {
    var echte = lijst(groep).filter(function (r) { return !!r; });
    if (!echte.length) return doel;
    if (doel.length) doel.push({ scheiding: true });
    echte.forEach(function (r) { doel.push(r); });
    return doel;
  };

  /* twee tot vier groepen in één menu, in leesvolgorde: wat je met dit ding
     DOET bovenaan, waar je naartoe kunt onderaan. Lege groepen en null-rijen
     verdwijnen, inclusief de scheiding die er anders eenzaam voor zou staan. */
  var menuGroepen = function () {
    var uit = [];
    for (var i = 0; i < arguments.length; i++) voegGroepToe(uit, arguments[i]);
    return uit;
  };

  var PRIMAIR_LABEL = {
    brief: 'Klant en project aanmaken',
    vraag: 'Beantwoorden',
    fase: 'Bekijk de goedkeuring',
    factuur: 'Open de conceptfactuur',
    concept: 'Publiceren',
    sample: 'Bekijk de sampleronde',
    eta: 'ETA bijwerken',
    stil: 'Volgende mijlpaal afvinken',
    herinnering: 'Afvinken',
    betaling: 'Bevestig betaling',
    klantbestand: 'Bekijk bestand',
    samplebeslissing: 'Verwerk aanpassing',
    bezwaar: 'Behandel bezwaar',
    herbestelling: 'Maak er een project van'
  };

  /* de route waar een item op zijn eigen scherm te vinden is. Dit is de
     terugval van elke primaire knop: geen schrijfactie, maar wel een
     werkende weg naar de plek waar de actie thuishoort. */
  var itemRoute = function (item) {
    if (!item) return null;
    if (item.kind === 'factuur') return { area: 'factuur', id: item.id };
    /* een bezwaar IS de factuur; een gemelde betaling hangt eraan (invoiceId
       op de melding). Allebei horen thuis in de factuureditor. */
    if (item.kind === 'bezwaar') return { area: 'factuur', id: item.id };
    if (item.kind === 'betaling') {
      var factuurId = tekst(opt(item.raw).invoiceId);
      return factuurId ? { area: 'factuur', id: factuurId } : null;
    }
    /* een herinnering hangt aan een KLANT en niet aan een project: het is
       een contactmoment. Zonder deze regel viel hij terug op "geen route" en
       stond zijn knop uitgeschakeld terwijl het klantdossier gewoon bestaat. */
    if (item.kind === 'herinnering') {
      return item.clientId ? { area: 'relaties', sub: 'klanten', id: item.clientId } : null;
    }
    if (!item.projectId) return null;
    var tab = 'overzicht';
    if (item.kind === 'vraag') tab = 'communicatie';
    else if (item.kind === 'concept' || item.kind === 'klantbestand') tab = 'bestanden';
    return { area: 'projecten', id: item.projectId, tab: tab };
  };

  /* de primaire actie van een item: eerst de haak van de gastheer, dan de
     route van het item, en pas als er geen van beide is een uitgeschakelde
     knop die uitlegt waarom. Nooit een knop die niets doet zonder tekst. */
  var primaireActie = function (ctx, item) {
    var soort = tekst(item && item.kind);
    /* een item mag zijn eigen knoplabel dragen. Dat is er precies één: de
       teruggekeerde openstaande factuur van hoofdstuk 4c, waar het vaste
       label "Open de conceptfactuur" onwaar zou zijn. */
    var vast = tekst(item && item.primairLabel) || PRIMAIR_LABEL[soort] || 'Afhandelen';
    var h = haak(ctx, HAKEN[soort]);
    if (h) {
      return {
        label: vast,
        /* de uitkomst gaat terug naar de aanroeper: de Inbox leest eruit of
           de haak een belofte gaf (voorstel 10, zie hoofdstuk 8) */
        onClick: function () { return h(item); }
      };
    }
    var route = itemRoute(item);
    if (route) {
      var woord = 'Open in het project';
      if (route.area === 'factuur') woord = 'Open de factuur';
      else if (route.area === 'relaties') woord = 'Open de klant';
      return {
        label: woord,
        onClick: function () { navigeer(ctx, route); }
      };
    }
    return {
      label: vast,
      disabled: true,
      titel: 'Deze actie loopt via het beheerscherm en is nog niet aan dit scherm gekoppeld.'
    };
  };

  /* ---- DE ITEMACTIES — DE KERN VAN DE OPDRACHT ----------------------
     Uitstellen, pinnen, de bal verleggen en najagen schrijven alle vier in
     settings.itemState. Dit bestand kan dat niet zelf — ctx.opslaan verwacht
     soort, id en velden van een RIJ — en dat hoeft ook niet: beheer.html
     biedt ze sinds deze ronde als haken aan, en die schrijven op exact
     dezelfde sleutels ('q:', 'stage:', 'inv:', 'ship:', 'smp:') als de oude
     cockpit deed. Een uitstel dat in de oude indeling is gezet, hoort dus nog
     steeds bij hetzelfde item, en andersom.

     DE BAL LIGT BIJ ÉÉN VAN DRIE, EN DE HUIDIGE STAND STAAT ERBIJ. Het item
     draagt zijn eigenaar al (CP_MODEL.ownerOf), dus de stand hoeft niet
     opnieuw uitgerekend te worden. De rij die de huidige stand is, krijgt een
     vinkje en het woord "actief" — dezelfde vorm als het soortfilter van de
     Inbox, zodat kleur noch pictogram ooit de enige drager is. */
  var BAL_KEUZES = [
    { wie: 'mij', label: 'Leg de bal bij mij', ico: 'gebruiker' },
    { wie: 'klant', label: 'Leg de bal bij de klant', ico: 'relaties' },
    { wie: 'fabriek', label: 'Leg de bal bij de fabriek', ico: 'fabriek' }
  ];

  /* NAJAGEN STAAT NIET BIJ ELKE SOORT, EN DAT IS EEN EERLIJKHEIDSKEUZE.
     De haak levert de bestaande chase-tekst voor de FABRIEK: een Engelse
     mail die het item bij naam noemt — de vraag, de factuurregel, de fasenaam
     of het rondenummer. Voor een site-brief en voor een concept bestaat die
     zin niet; openGenericChase valt dan terug op de kale sleutel ("Item:
     req:req-01"), en een aanvraag van je eigen website najagen bij een
     Chinese fabriek slaat sowieso nergens op. De rij staat er dus alleen bij
     de soorten waar de bestaande tekst echt over gaat.

     ZENDINGEN HOREN ER JUIST WÉL BIJ. De haak itemNajagen kiest voor soort
     'eta' en 'stil' openChaseModal in plaats van openGenericChase: de
     volledige zendingtekst met de mijlpalen erin. Dat is de rijkste
     chase-tekst die de app kent, en zonder deze twee regels was hij na het
     verdwijnen van de oude cockpit nergens meer op te vragen.
     Een herinnering blijft er bewust buiten: een contactmoment met je eigen
     klant jaag je niet na bij een fabriek. */
  var NAJAAGBAAR = { vraag: true, fase: true, factuur: true, sample: true, eta: true, stil: true };

  var itemActies = function (ctx, item) {
    if (!item) return [];
    var uit = [];
    var vandaag = dagVan(ctx, nuVan(ctx));
    var uitgesteld = item.snoozedUntil && dagVan(ctx, item.snoozedUntil) > vandaag;

    uit.push(haakRij(ctx, HAKEN.snoozen,
      uitgesteld
        ? 'Uitstel wijzigen (nu tot ' + datumTekst(ctx, item.snoozedUntil) + ')'
        : 'Uitstellen',
      'klok',
      function (h) { h(item); }));

    /* pinnen is een schakelaar: de haak leest item.pinned en zet hem om.
       Maximaal vijf pins blijft afgedwongen door de haak zelf. */
    uit.push(haakRij(ctx, HAKEN.pinnen,
      item.pinned ? 'Losmaken van bovenaan' : 'Vastzetten bovenaan',
      item.pinned ? 'sluiten' : 'ster',
      function (h) { h(item); }));

    var balRijen = [];
    BAL_KEUZES.forEach(function (b) {
      var isNu = tekst(item.owner) === b.wie;
      balRijen.push(haakRij(ctx, HAKEN.balVerleggen,
        b.label + (isNu ? ' — actief' : ''),
        isNu ? 'vinkje' : b.ico,
        function (h) { h(item, b.wie); }));
    });
    balRijen.filter(function (r) { return !!r; }).forEach(function (r) { uit.push(r); });

    /* eigenVeld en geen kale lezing: NAJAAGBAAR['constructor'] bestaat op elk
       object en zou hier een rij opleveren voor een soort die er niet is */
    if (eigenVeld(NAJAAGBAAR, tekst(item.kind))) {
      uit.push(haakRij(ctx, HAKEN.najagen, 'Najagen — chase-tekst opstellen', 'mail',
        function (h) { h(item); }));
    }

    return uit.filter(function (r) { return !!r; });
  };

  /* waar je vanaf dit item naartoe kunt. Staat onderaan in elk menu: het is
     de uitweg en niet de handeling. */
  var itemNavigatie = function (ctx, item) {
    var d = D(ctx);
    var project = item && item.projectId ? indexOp(lijst(d.projects), 'id')[item.projectId] : null;
    var klant = item && item.clientId ? indexOp(lijst(d.clients), 'id')[item.clientId] : null;
    var uit = [];
    if (project) {
      uit.push({
        label: 'Open het project', ico: 'projecten',
        onKies: function () { navigeer(ctx, { area: 'projecten', id: project.id, tab: 'overzicht' }); }
      });
    }
    if (klant) {
      uit.push({
        label: 'Open de klant', ico: 'relaties',
        onKies: function () { navigeer(ctx, { area: 'relaties', sub: 'klanten', id: klant.id }); }
      });
    }
    /* een bezwaar en een gemelde betaling (0021) hangen aan een factuur, en
       de factuureditor is waar beide afgehandeld worden */
    if (item && (item.kind === 'bezwaar' || item.kind === 'betaling')) {
      var factuurId = item.kind === 'bezwaar' ? tekst(item.id) : tekst(opt(item.raw).invoiceId);
      if (factuurId) {
        uit.push({
          label: 'Open de factuur', ico: 'financien',
          onKies: function () { navigeer(ctx, { area: 'factuur', id: factuurId }); }
        });
      }
    }
    /* EEN ZENDINGSIGNAAL, EEN HERINNERING EN EEN TERUGGEKEERD UITSTEL OP EEN
       VERSTUURDE FACTUUR STAAN NIET IN DE INBOX.
       collectInbox() laat ze er bewust uit (hoofdstuk 4b en 4c), dus "Toon in
       de Inbox" zou hier naar een lijst springen waar het item niet in staat —
       de selectie valt dan stil weg en je landt op een willekeurige andere
       rij. Precies de knop die niets doet waar de opdracht voor waarschuwt.
       De uitwegen hierboven blijven wél staan: die wijzen naar het project en
       de klant, en die bestaan. */
    if (!(item && item.buitenInbox)) {
      uit.push({
        label: 'Toon in de Inbox', ico: 'inbox',
        onKies: function () {
          navigeer(ctx, { area: 'inbox', params: { chip: tekst(item && item.chip) || 'alles', item: tekst(item && item.id) } });
        }
      });
    }
    return uit;
  };

  /* DE SOORTEIGEN ACTIES VAN DE DRIE SIGNALEN.
     Wat de oude cockpit als tweede knop op die rijen had, en wat hier dus
     niet mag verdwijnen: bij een ETA-rij "Geleverd afvinken", bij een stille
     zending "ETA bijwerken". De primaire knop draagt telkens de andere helft
     (zie PRIMAIR_LABEL), dus samen zijn het dezelfde twee handelingen.
     Een herinnering heeft er geen: afvinken is de handeling en die staat al
     bovenaan; het klantdossier staat onderaan bij de uitwegen. */
  var signaalActies = function (ctx, item) {
    var soort = tekst(item && item.kind);
    var s = opt(item && item.raw);
    var uit = [];

    if (soort === 'eta') {
      var SHIP = root.CP_SHIPPING;
      var label = (SHIP && fn(SHIP.milestoneLabel)) ? tekst(SHIP.milestoneLabel(s.type, 'geleverd')) : 'Geleverd';
      uit.push(haakRij(ctx, HAKEN.mijlpaal, 'Vink af: ' + label, 'vinkje',
        function (h) { h(item, { key: 'geleverd', label: label }); }));
    }
    if (soort === 'stil') {
      uit.push(haakRij(ctx, HAKEN.eta, 'ETA bijwerken', 'klok',
        function (h) { h(item); }));
    }
    return uit.filter(function (r) { return !!r; });
  };

  /* de acties achter de ••• van een itemrij op Overzicht: eerst wat je met
     het item DOET, daarna waar je het vandaan haalt. Het Inbox-detail voegt
     daar nog de soorteigen acties aan toe (zie inboxMenu). */
  var itemMenu = function (ctx, item) {
    return menuGroepen(signaalActies(ctx, item), itemActies(ctx, item), itemNavigatie(ctx, item));
  };

  /* ---- ÉÉN KLIK MAG MAAR ÉÉN DING DOEN -------------------------------
     CP_UI.taskCard en CP_UI.entityRow maken van een rij mét ••• een <div>
     met een klikbare helft, plús een klik op de rest van de rij. Die
     rijklik slaat over wat binnen het staartstuk gebeurt, maar hij meet dat
     PAS ALS DE KLIK BIJ HEM AANKOMT — en op dat moment heeft het menu
     zichzelf al opgeruimd. De aangeklikte menurij hangt dan nergens meer aan
     en de rij herkent hem niet meer als "van het staartstuk".

     Gevolg, en dit is in de browser gezien: "Uitstellen" kiezen opende het
     snoozevenster én sprong tegelijk naar de Inbox. Zolang er alleen
     navigatie in dat menu stond viel het niet op — twee navigaties op één
     klik zien er hetzelfde uit als één. Met echte schrijfacties erin is het
     wel zichtbaar, en het is fout.

     Dit hulpje laat de klik van het menu bij het menu ophouden. Het luistert
     op de OMHULLENDE .u-menuwrap en niet op het menu zelf: de opbouw van een
     klikgebeurtenis ligt vast op het moment van afvuren, dus dit hulpje komt
     gegarandeerd aan de beurt ná de menurij en vóór de rij eromheen — ook al
     is het menu er dan niet meer.

     HET HOORT IN ADMIN-UI.JS EN NIET HIER. In deze ronde mag alleen dit
     bestand wijzigen; zodra de componentbibliotheek zijn rijklik met een
     vlag in de vangfase meet, kan dit hulpje weg. */
  var menuKlikApart = function (node) {
    if (!node || !node.querySelectorAll) return node;
    var wraps = node.querySelectorAll('.u-menuwrap');
    Array.prototype.forEach.call(wraps, function (w) {
      w.addEventListener('click', function (e) { e.stopPropagation(); });
    });
    return node;
  };

  var navigeer = function (ctx, route, opties) {
    var g = fn(ctx && ctx.ga);
    if (!g) return;
    g(route, opt(opties));
  };

  /* een deelnavigatie: een tab, een chip of een selectie. De pagina blijft
     staan waar hij staat en de melding vertelt wat er veranderde — anders
     hoort een schermlezer bij elke chipklik alleen weer de paginanaam. */
  var deelNavigatie = function (ctx, route, melding) {
    navigeer(ctx, route, { behoudScroll: true, behoudFocus: true, melding: tekst(melding) });
  };

  /* ============================================================
     6. GEDEELDE BOUWSTUKJES

     Alle vier de schermen delen deze vormen. Ze staan hier één keer,
     zodat er geen tweede variant kan ontstaan.
     ============================================================ */

  /* admin-ui.css kent geen binnenmargeklasse voor een kaart: .u-card zet
     alleen vlak, rand, radius en schaduw, want de meeste kaarten vullen
     zich met rijen die hun eigen padding meebrengen. Een kaart met vrije
     inhoud (een grafiek, een kalender) heeft die marge wél nodig. Hij staat
     hier op PRECIES ÉÉN plek inline, zodat hij in één regel naar CSS kan
     zodra daar een .u-cardpad verschijnt. */
  var kaart = function (ui, kinderen, extraKlasse) {
    return ui.el('div', {
      class: 'u-card' + (tekst(extraKlasse) ? ' ' + tekst(extraKlasse) : ''),
      style: 'padding:20px 22px;'
    }, lijst(kinderen));
  };

  var sectie = function (ui, kop, kinderen) {
    return ui.el('div', { class: 'u-section' }, [kop].concat(lijst(kinderen)));
  };

  /* DE TWEE VORMHULPJES DIE ADMIN-UI.CSS NIET HEEFT.
     Een stapel met één afstand en een lege tussenruimte komen in alle vier
     de schermen terug. Ze staan hier één keer in plaats van veertien keer
     inline: dat scheelt niet alleen regels, het is ook het verschil tussen
     "veertien plekken bijwerken" en "twee regels bijwerken" zodra
     admin-ui.css hier klassen voor krijgt.
     De tussenruimte draagt aria-hidden: hij is een marge en geen inhoud. */
  var stapel = function (ui, kinderen, gap) {
    var g = (typeof gap === 'number' && gap >= 0) ? gap : 16;
    return ui.el('div', { style: 'display:flex;flex-direction:column;gap:' + g + 'px;' }, lijst(kinderen));
  };
  var ruimte = function (ui, px) {
    var p = (typeof px === 'number' && px > 0) ? px : 20;
    return ui.el('div', { 'aria-hidden': 'true', style: 'height:' + p + 'px;' });
  };

  /* de tintklassen van admin-ui.css hoofdstuk 1b. Ze zetten --vlak, --volle
     en --inkt in één keer goed; .u-tlrail-stip leest --volle en --inkt. */
  var TINT_KLASSE = {
    klaar: 'u-tint-ok', wacht: 'u-tint-warn', kritiek: 'u-tint-crit',
    extern: 'u-tint-info', neutraal: 'u-tint-neutraal', nu: 'u-tint-neutraal'
  };

  /* §4.7 timelineList — gedateerde lijst met verbindingslijn.
     Er is geen CP_UI-component; admin-ui.css hoofdstuk 8k heeft de klassen
     wel. Rijen: {iso, dag, datum, tijd, titel, tekst, toon, toonWoord, onOpen}
     De stip draagt kleur, het WOORD ernaast draagt de betekenis — zonder dat
     woord zou kleur de enige drager zijn en dat mag niet (hoofdstuk 8). */
  var raillijst = function (ctx, ui, rijen) {
    var wrap = ui.el('div', { class: 'u-tlrail' });
    lijst(rijen).forEach(function (r) {
      var toon = tekst(r.toon) || 'neutraal';
      /* span en geen div: zodra er een onOpen is, belandt deze tekstkolom
         binnen de <button> hieronder, en het inhoudsmodel van een knop is
         frasering-inhoud. Een div daarbinnen is ongeldige HTML en er zijn
         schermlezers die de inhoud van zo'n knop dan overslaan — dan is de
         hele rij er voor die lezer niet. admin-ui.css zet .u-tlrail-tekstkol
         met zoveel woorden op display:block (hoofdstuk 8k noemt deze plek
         zelfs bij naam), dus de vorm verandert geen pixel. */
      var lijf = ui.el('span', { class: 'u-tlrail-tekstkol' }, [
        tekst(r.tijd) ? ui.el('span', { class: 'u-tlrail-tijd', text: tekst(r.tijd) }) : null,
        ui.el('span', { class: 'u-tlrail-title', text: tekst(r.titel) }),
        tekst(r.tekst) ? ui.el('span', { class: 'u-tlrail-text', text: tekst(r.tekst) }) : null,
        ui.statusDot({ toon: toon, label: tekst(r.toonWoord) })
      ]);
      var body = fn(r.onOpen)
        ? ui.el('div', { class: 'u-tlrail-body' }, ui.el('button', {
          type: 'button',
          /* admin-ui.css heeft geen klasse voor "de klikbare helft van een
             tijdlijnrij"; dit is de reset die van de tekstkolom één
             tabstop maakt zonder de vorm te veranderen */
          style: 'display:block;width:100%;text-align:left;',
          onclick: r.onOpen
        }, lijf))
        : ui.el('div', { class: 'u-tlrail-body' }, lijf);

      wrap.appendChild(ui.el('div', { class: 'u-tlrail-row' }, [
        ui.el('div', { class: 'u-tlrail-datum-kol' }, [
          ui.el('span', { class: 'u-tlrail-dag', text: tekst(r.dag) }),
          ui.el('span', { class: 'u-tlrail-datum', text: tekst(r.datum) })
        ]),
        ui.el('div', { class: 'u-tlrail-lijn' },
          ui.el('span', { class: 'u-tlrail-stip ' + (TINT_KLASSE[toon] || TINT_KLASSE.neutraal), 'aria-hidden': 'true' })),
        body
      ]));
    });
    return wrap;
  };

  /* de deadlinerij in de rail van Projecten: datumkicker BOVEN de titel.
     CP_UI.entityRow kent geen kickerslot, dus de rij wordt hier uit .u-row
     en .u-datekicker samengesteld — allebei bestaande klassen. */
  var deadlineRij = function (ctx, ui, r) {
    return ui.el('button', {
      type: 'button', class: 'u-row',
      onclick: fn(r.onOpen) || null
    }, [
      ui.el('span', { class: 'u-row-main' }, [
        ui.el('span', { class: 'u-datekicker', text: datumKicker(ctx, r.iso) }),
        ui.el('span', { class: 'u-row-title', text: tekst(r.titel) }),
        ui.el('span', { class: 'u-row-sub', text: tekst(r.sub) })
      ]),
      ui.el('span', { class: 'u-row-end' }, ui.statusDot({ toon: tekst(r.toon), label: tekst(r.toonWoord) }))
    ]);
  };

  /* de gedateerde agenda van het beheer.
     BRON: twee dingen naast elkaar, en ze worden nooit door elkaar gehaald.
       1. project.deadline — het ECHTE veld uit hoofdstuk 7 van de spec: de
          met de hand beloofde einddatum;
       2. CP_MODEL.nextDateFor — de eerstvolgende van de zes bestaande
          datumprojecties (ETA, antwoordklok, factuur, uitstel, herinnering,
          geplande publicatie).
     Elke rij zegt in woorden welke van de twee hij is. */
  var agendaRijen = function (ctx, items) {
    var d = D(ctx);
    var m = MOD(ctx);
    var mctx = modelCtx(ctx, items);
    var vandaag = dagVan(ctx, nuVan(ctx));
    var uit = [];

    lijst(d.projects).forEach(function (p) {
      if (!p || !p.id) return;
      if (m && fn(m.isArchived) && m.isArchived(p)) return;

      var deadline = dagVan(ctx, p.deadline);
      if (deadline) {
        uit.push({
          iso: deadline, projectId: p.id, titel: tekst(p.name),
          sub: 'Beloofde einddatum',
          toon: deadline < vandaag ? 'kritiek' : 'wacht',
          toonWoord: deadline < vandaag ? 'Datum verstreken' : 'Deadline'
        });
      }

      if (!m || !fn(m.nextDateFor)) return;
      var nd = m.nextDateFor(p, mctx);
      if (!nd || !nd.iso) return;
      uit.push({
        iso: nd.iso, projectId: p.id, titel: tekst(p.name),
        sub: 'Eerstvolgende datum: ' + tekst(nd.label),
        toon: nd.passed ? 'kritiek' : 'extern',
        toonWoord: nd.passed ? 'Verstreken' : 'Staat gepland'
      });
    });

    uit.sort(function (a, b) {
      if (a.iso === b.iso) return a.titel < b.titel ? -1 : (a.titel > b.titel ? 1 : 0);
      return a.iso < b.iso ? -1 : 1;
    });
    return uit;
  };

  /* ============================================================
     7. SCHERM — OVERZICHT (§5.1)

     h1 met begroeting en een pil met het aantal zaken, drie stattegels in
     de drie varianten van §4.10, "Nu doen" met maximaal vijf taakkaarten,
     "Recente activiteit" als drie compacte items naast elkaar.
     Rail: deadlinekalender, de gedateerde lijst, en "Operaties deze week".
     ============================================================ */

  /* De begroeting wisselt met het uur van ctx.nu en NOOIT met de echte
     klok: een scherm dat zijn eigen tijd leest, is niet te testen en geeft
     bij twee aanroepen op één seconde verschil twee uitkomsten. */
  var begroeting = function (nuIso) {
    var m = tekst(nuIso).match(/T(\d{2}):/);
    var uur = m ? Number(m[1]) : 9;
    if (!isFinite(uur)) uur = 9;
    if (uur < 12) return 'Goedemorgen';
    if (uur < 18) return 'Goedemiddag';
    return 'Goedenavond';
  };

  /* de naam achter de begroeting. BRON: het teamlid met de rol eigenaar uit
     de nieuwe tabel team_members (hoofdstuk 7). Staat die er niet, dan
     groet het scherm zonder naam — beter dan een naam verzinnen. */
  var eigenaarNaam = function (ctx) {
    var uit = '';
    lijst(D(ctx).team).forEach(function (t) {
      if (uit || !t) return;
      if (tekst(t.role) === 'eigenaar' && tekst(t.name)) uit = tekst(t.name);
    });
    return uit;
  };

  var voornaam = function (naam) {
    var delen = tekst(naam).split(/\s+/);
    return delen.length ? delen[0] : '';
  };

  /* DE VOLGORDE VAN "NU DOEN".
     Dezelfde vier bakken en dezelfde voorrang als verdeelItems() in
     beheer.html: eerst wat je zelf bovenaan hebt gezet, dan wat vandaag uit
     uitstel terugvalt ("blijft bovenaan tot je er iets mee doet", zegt de
     mappingtabel), dan wat te laat is, en tenslotte de rest in de volgorde
     waarin de bronnen hem aanleveren.

     Met vier losse bakken die aan het eind aan elkaar worden geplakt, is de
     ordening per definitie STABIEL — binnen een bak verschuift er niets.
     Array.prototype.sort met een vergelijker zou dat pas sinds ES2019
     garanderen, en dit bestand is ES5. */
  var ordenNuDoen = function (items) {
    var gepind = [], terug = [], laat = [], rest = [];
    lijst(items).forEach(function (it) {
      if (!it) return;
      if (it.pinned) gepind.push(it);
      else if (it.returnedAt) terug.push(it);
      else if (it.urgent) laat.push(it);
      else rest.push(it);
    });
    return gepind.concat(terug, laat, rest);
  };

  /* WAAROM STAAT DEZE RIJ HIER, EN WAAROM ZO HOOG.
     Er waren twee markeringen — "Te laat" en "Gepind" — en die dekten de
     volgorde niet: een item waarvan de uitsteldatum verstreken is, valt
     terug in de lijst en was daarna van niets meer te onderscheiden. Het
     item DRAAGT die stand al (collectInbox zet returnedAt zodra een snooze
     gepasseerd is, en signaalItems doet hetzelfde), hij werd alleen nergens
     getoond.

     Hoogstens twee markeringen per rij: de derde zou de datum rechts van de
     rij duwen, en de rij heeft er maar één regel voor. De volgorde hieronder
     ís de voorrang — het signaalwoord van een zending of een herinnering
     staat vooraan, want dat is de enige plek waar hij staat. */
  var rijMerken = function (ctx, ui, it) {
    var uit = [];
    if (tekst(it.signaalWoord)) {
      uit.push(ui.statusDot({ toon: tekst(it.signaalToon) || 'wacht', label: tekst(it.signaalWoord) }));
    }
    if (it.pinned) uit.push(ui.statusDot({ toon: 'neutraal', label: 'Gepind' }));
    if (it.returnedAt) {
      uit.push(ui.statusDot({
        toon: 'nu',
        label: 'Terug uit uitstel',
        titel: 'Het uitstel liep af op ' + datumTekst(ctx, it.returnedAt) + '.'
      }));
    }
    if (it.urgent && !tekst(it.signaalWoord)) {
      uit.push(ui.statusDot({ toon: 'kritiek', label: 'Te laat' }));
    }
    return uit.slice(0, 2);
  };

  SCHERMEN.overzicht = function (ctx) {
    var ui = UI(ctx);
    if (!ui) return noodElement('Overzicht');
    var chart = CH(ctx);
    var model = MOD(ctx);
    var data = DAT(ctx);
    var d = D(ctx);
    var nu = nuVan(ctx);
    var vandaag = dagVan(ctx, nu);

    var items = inboxItems(ctx);
    var open = (model && fn(model.filterInbox)) ? model.filterInbox(items, 'alles') : items;
    /* zie opMijItems(): één regel voor de lijst hieronder én voor het getal
       in de pil, de tegel en de zijbalkbadge */
    var opMij = opMijItems(ctx, items);
    var aantalOpMij = opMijAantal(ctx, items, opMij);
    var nieuw = (model && fn(model.filterInbox)) ? model.filterInbox(items, 'nieuw') : [];

    /* de drie signalen van hoofdstuk 4b, langs dezelfde "wacht dit op mij"-
       regel als de Inbox-items. Ze staan hier al vóór de kop, want de pil
       achter de begroeting telt ze mee — zie daar. */
    var signalen = signaalItems(ctx);
    var opMijSignalen = opMijItems(ctx, signalen);
    /* en hoofdstuk 4c: een uitstel dat afliep op iets wat nergens anders
       bovendrijft. Het krijgt de al opgebouwde lijst mee, zodat een item dat
       hierboven al staat er geen tweede keer bij komt. */
    var terug = terugItems(ctx, items.concat(signalen));
    var opMijTerug = opMijItems(ctx, terug);
    var buitenInbox = opMijSignalen.length + opMijTerug.length;
    var teDoen = ordenNuDoen(opMij.concat(opMijSignalen, opMijTerug));

    /* ---------- kop ----------
       §5.1 en observatie V1: op Overzicht staat de zwarte knop RECHTS
       UITGELIJND op de titelregel, met het ••• er direct tegenaan. Dat is de
       stand 'rechts' van pageHeader, en die staat hier expliciet: hij is
       weliswaar ook de standaard, maar dit scherm en Projecten kiezen bewust
       de twee verschillende koppen van de mockup en dan hoort die keuze
       zichtbaar te zijn op allebei de plekken. */
    /* DE PIL TELT WAT ER ONDER "NU DOEN" STAAT, EN DAT IS MEER DAN DE INBOX.
       Hij telde inboxBadgeCount — hetzelfde getal als de zijbalkbadge — en
       dat klopte zolang "Nu doen" alleen Inbox-items toonde. Sinds daar ook
       zendingsignalen en herinneringen in staan (hoofdstuk 4b), zou de pil
       "2 zaken" zeggen boven een lijst van vier. Een getal dat niet klopt met
       de lijst er direct onder is erger dan een getal dat afwijkt van een
       badge verderop.

       DAT VERSCHIL MET DE ZIJBALK IS DUS GEEN TERUGVAL NAAR DE OUDE BUG. Die
       ging over twee tellingen van HETZELFDE (een ingeplande publicatie die
       in de pil zat en niet in de badge); dit zijn twee tellingen van iets
       anders — de badge hangt aan het woord "Inbox" en telt de Inbox, de pil
       hangt aan de begroeting en telt je dag. Precies zoals de oude cockpit
       zijn "n open punten" telde: die rekende herinneringen, zendingsignalen
       en een teruggekeerd uitstel op een openstaande factuur óók mee.
       De tegel "Wacht op jouw actie" blijft wél op de Inbox-telling staan —
       hij zégt "in de Inbox" en hij LINKT naar de Inbox. */
    var naam = voornaam(eigenaarNaam(ctx));
    var kop = ui.pageHeader({
      titel: begroeting(nu) + (naam ? ', ' + naam : ''),
      badge: teDoen.length
        ? ui.statusChip({
          label: nlAantal(teDoen.length, 'zaak', 'zaken'),
          toon: 'neutraal',
          titel: buitenInbox
            ? nlAantal(aantalOpMij, 'zaak', 'zaken') + ' uit de Inbox plus '
              + nlAantal(buitenInbox, 'zaak die daar bewust buiten valt', 'zaken die daar bewust buiten vallen')
              + ': zendingsignalen, herinneringen en een uitstel dat afliep op een verstuurde factuur.'
            : null
        })
        : null,
      actiePlaats: 'rechts',
      primair: {
        label: 'Nieuw project', ico: 'plus',
        onClick: function () {
          var h = haak(ctx, HAKEN.nieuwProject);
          if (h) { h(null); return; }
          navigeer(ctx, { area: 'projecten' });
        }
      },
      /* DAG AFSLUITEN STAAT IN HET ••• EN NIET OP DE PAGINA (beslissing 2.9
         van het migratieplan: "niet dominant"). Het is de ritueelknop van het
         eind van de dag; als volle knop naast "Nieuw project" zou hij elke
         ochtend even zwaar wegen als de handeling die je wél zoekt.
         De haak draait dezelfde signaalberekening en dezelfde itemindeling
         als de oude cockpit — alleen het venster staat nu buiten die
         schermbouwer. */
      menu: menuGroepen([
        haakRij(ctx, HAKEN.dagAfsluiten, 'Dag afsluiten', 'vinkje',
          function (h) { h(); })
      ], [
        {
          label: 'Bekijk alle activiteit', ico: 'activiteit',
          onKies: function () { navigeer(ctx, { area: 'activiteit' }); }
        },
        {
          label: 'Open de Inbox', ico: 'inbox',
          onKies: function () { navigeer(ctx, { area: 'inbox' }); }
        }
      ])
    });

    /* DE REGEL ONDER DE TITEL IS WEG (observatie V8). Er stond "5 zaken
       vragen vandaag je aandacht · 30 aug 2026" tussen de titel en de tegels.
       De mockup heeft daar niets: de pil "4 zaken" achter de titel zegt het
       al, en de datum staat rechtsboven in de kalender van de rail. Twee keer
       hetzelfde getal onder elkaar is geen nadruk maar ruis.
       De Inbox houdt zijn eigen regel ("4 op jou") wél — die tekent §5.2
       daar met zoveel woorden. */

    /* ---------- de drie stattegels (§4.10) ----------
       DE VORM HOORT BIJ DE TEGEL EN NIET ANDERSOM (observatie V9). De mockup
       zet de ring op "Nieuwe aanvragen", de gevulde perzikkaart op "Wacht op
       jouw actie" en de trendkaart op "Openstaande betalingen". De drie
       varianten stonden goed, maar op de verkeerde tegel. */
    var tegels = [];

    /* 1. ring — BRON: collectInbox, chip 'nieuw' (site-briefs en
       herbestelaanvragen die nog niet zijn omgezet). De boog toont hun
       aandeel in de hele open werkvoorraad; 'nieuw' is een deelverzameling
       van 'alles', dus die verhouding is echt en niet geschaald.

       "ALLES IS OMGEZET" WAS EEN ZIN DIE ONWAAR KON ZIJN.
       Hij stond er zodra de bak Nieuw leeg was, en die bak is niet hetzelfde
       als "geen open aanvragen meer". collectInbox zet een site-brief op
       'nieuw' zolang zijn status niet 'omgezet' is, maar chipVoorBal legt de
       bal daaroverheen: verleg je de bal naar de klant of de fabriek, dan
       staat diezelfde niet-omgezette aanvraag onder 'wachtopklant'. Een
       uitstel haalt hem er ook uit — filterInbox laat alles vallen wat nog
       geparkeerd staat. In beide gevallen las je "alles is omgezet" boven een
       aanvraag die dat niet was. De telling hieronder kijkt daarom naar de
       aanvragen zelf: elke brief die niet in de bak 'afgehandeld' valt, is
       nog niet omgezet — dat is precies de bak die collectInbox aan status
       'omgezet' hangt. */
    var inBakNieuw = {};
    nieuw.forEach(function (it) { if (it) inBakNieuw[tekst(it.id)] = true; });
    var aanvraagElders = 0;
    /* de bak waar de eerste van die aanvragen wél in staat — dezelfde regel
       als filterInbox: een lopend uitstel gaat vóór de chip. Zo opent de
       tegel een lijst waar er ook echt een in staat. */
    var eldersBak = '';
    lijst(items).forEach(function (it) {
      if (!it || it.kind !== 'brief') return;
      if (it.chip === 'afgehandeld') return;
      if (inBakNieuw[tekst(it.id)]) return;
      aanvraagElders++;
      if (!eldersBak) eldersBak = it.snoozedUntil ? 'uitgesteld' : tekst(it.chip);
    });

    tegels.push(ui.statTile({
      variant: 'ring',
      label: 'Nieuwe aanvragen',
      waarde: String(nieuw.length),
      icoon: 'inbox',
      toon: (nieuw.length || aanvraagElders) ? 'wacht' : 'klaar',
      sub: nieuw.length
        ? 'nog niet omgezet naar een klant'
        : (aanvraagElders
          ? nlAantal(aanvraagElders, 'aanvraag is nog niet omgezet', 'aanvragen zijn nog niet omgezet')
          : (open.length ? 'alles is omgezet' : 'De Inbox is leeg')),
      /* DEZELFDE BEHANDELING ALS DE TEGEL ERNAAST: bij nul verdwijnt de
         kaart, want een tegel die "0" toont is precies de klacht uit de
         opdracht. Eén uitzondering, en die is de reden dat hier geen kale
         `true` staat: liggen er wél aanvragen die nog niet omgezet zijn maar
         buiten de bak Nieuw vallen, dan zou verbergen die aanvragen laten
         verdwijnen in plaats van een leeg getal. Dan blijft de kaart staan en
         zegt de regel hierboven waar het om gaat. */
      verbergBijNul: !aanvraagElders,
      titel: (!nieuw.length && aanvraagElders)
        ? 'Deze aanvragen vallen buiten de bak Nieuw: de bal ligt bij de klant of de fabriek, of ze staan uitgesteld.'
        : null,
      ring: {
        waarde: nieuw.length, max: Math.max(open.length, nieuw.length, 1),
        maat: 72, tekst: String(nieuw.length),
        label: 'Nieuwe aanvragen',
        beschrijving: 'Nieuwe aanvragen: ' + nieuw.length + ' van '
          + nlAantal(open.length, 'open zaak', 'open zaken') + ' in de Inbox'
          + (aanvraagElders
            ? '; daarnaast ' + nlAantal(aanvraagElders, 'aanvraag', 'aanvragen')
              + ' die nog niet omgezet zijn en buiten die bak vallen'
            : '')
      },
      /* de knop opent de bak waar de aanvragen echt staan. Is de bak Nieuw
         leeg en staan ze elders, dan opent de tegel díé bak — anders zou hij
         een lijst openen waar niets in staat. */
      onClick: function () {
        navigeer(ctx, {
          area: 'inbox',
          params: { chip: (!nieuw.length && eldersBak) ? eldersBak : 'nieuw' }
        });
      }
    }));

    /* 2. groot, perzik — BRON: dezelfde regel als de zijbalkbadge (zie
       opMijItems). Bij nul verdwijnt de kaart: een grote gevulde kaart die
       "0" zegt, is precies de klacht uit de opdracht. */
    tegels.push(ui.statTile({
      variant: 'groot',
      tint: 2,
      label: 'Wacht op jouw actie',
      waarde: String(aantalOpMij),
      sub: open.length
        ? 'van ' + nlAantal(open.length, 'open zaak', 'open zaken') + ' in de Inbox'
        : '',
      verbergBijNul: true,
      /* NAAR "ALLES" EN NIET NAAR DE TAB "WACHT OP MIJ".
         Die tab is de bak van de open klantvragen (collectInbox zet chip
         'wachtopmij' alleen daarop); hij telt dus iets anders dan deze tegel,
         en een tegel die "5" zegt en een tab opent die "2" toont, is opnieuw
         één bron met twee uitkomsten. "Alles" bevat ze gegarandeerd alle vijf:
         opMijItems is een deelverzameling daarvan — beide laten afgehandeld
         weg en beide hanteren dezelfde snoozeregel. */
      onClick: function () {
        navigeer(ctx, { area: 'inbox', params: { chip: 'alles' } });
      }
    }));

    /* 3. trend — BRON: CP_DATA.cashflow over zes maanden, in centen uit de
       facturen (betaald op de maand van paidAt). De vergelijking met de
       vorige maand wordt alleen getoond als die maand ECHT een bedrag had;
       anders is er niets te vergelijken en staat er ook niets — en nu doet de
       code dat ook echt, zie trendVeld hieronder. */
    var cash = (data && fn(data.cashflow)) ? data.cashflow(lijst(d.invoices), 6, nu) : null;
    var reeks = [], labels = [];
    lijst(cash && cash.reeks).forEach(function (p) {
      reeks.push(p.betaaldCents);
      labels.push(p.label);
    });
    var dezeMaand = reeks.length ? reeks[reeks.length - 1] : 0;
    var vorigeMaand = reeks.length > 1 ? reeks[reeks.length - 2] : 0;
    var openCents = 0, openAantal = 0;
    lijst(d.invoices).forEach(function (inv) {
      if (!inv || inv.status !== 'open') return;
      if (model && fn(model.isConceptRow) && model.isConceptRow(inv)) return;
      openAantal++;
      if (data && fn(data.factuurBedragCents)) openCents += data.factuurBedragCents(inv);
      else openCents += getal(inv.amountCents, 0);
    });

    /* DE ONDERSTE REGEL VAN DE TEGEL IS DE PROCENTUELE VERGELIJKING DIE
       §4.10 TEKENT ("↗ 12% t.o.v. vorige maand"), en geen tweede bedrag.
       Het percentage is een echte meting: dezeMaand en vorigeMaand komen
       allebei uit dezelfde cashflowreeks. Is de vorige maand nul, dan is er
       niets om door te delen en dus niets te vergelijken — dan blijft trend
       leeg en tekent statTile de regel helemaal niet. Dat is precies wat het
       commentaar hierboven altijd al beloofde.
       Het betaalde bedrag per maand gaat niet verloren: het staat in de
       tekstuele tegenhanger van de sparkline en voluit op Financiën. */
    var trendVeld = null;
    if (vorigeMaand > 0) {
      trendVeld = {
        pct: Math.round((dezeMaand - vorigeMaand) / vorigeMaand * 100),
        periode: 't.o.v. vorige maand'
      };
    }

    if (cash) {
      /* TWEE METINGEN IN ÉÉN TEGEL, EN ALLEBEI DRAGEN HUN EIGEN NAAM.
         Het grote getal is wat er NU openstaat; de sparkline en de regel
         eronder gaan over wat er per maand BETAALD is. Zonder die twee
         namen zou de lijn als het verloop van het openstaande bedrag
         gelezen worden, en dat verloop meten we niet. */
      tegels.push(ui.statTile({
        variant: 'trend',
        label: 'Openstaande betalingen',
        waarde: bedragTekst(ctx, openCents),
        sub: openAantal
          ? nlAantal(openAantal, 'verstuurde factuur staat open', 'verstuurde facturen staan open')
          : 'Er staat niets open',
        reeks: reeks,
        sparkToon: 'ink',
        sparkBeschrijving: 'Betaald per maand: ' + reeks.map(function (c, i) {
          return labels[i] + ' ' + bedragTekst(ctx, c);
        }).join(', '),
        trend: trendVeld,
        onClick: function () { navigeer(ctx, { area: 'financien' }); }
      }));
    }

    /* ---------- Nu doen ----------
       DE RIJVORM VAN §5.1, NIET DE KAARTVORM (observatie V2).
       De mockup tekent per rij vier dingen en niets meer: icoontegel ·
       kickerregel + titel · meta rechts · chevron. Er stond hier een chip
       ("AANVRAAG") in plaats van een kickerregel, plus een volle knop midden
       in de rij. Twee even zware doelen naast elkaar dwingen de lezer om per
       rij te kiezen welk van de twee hij wil; met één doel en een chevron is
       de belofte op elke rij dezelfde: klikken opent dit item.

       WAT ER NAAR HET ••• VERHUIST EN WAT NAAR HET DETAIL.
       taskCard zet de primaire actie zelf bovenaan in het •••, dus die raakt
       niet zoek. De reden ("Beantwoord de vraag van de klant"), de subregel
       van het item en een teruggekeerd uitstel stonden onder de titel; die
       staan nu in het Inbox-detail waar de rij naartoe gaat — dat is precies
       de plek die V2 aanwijst, en het is één klik ver.
       Wat WEL in de rij blijft, is waaróm hij bovenaan staat: gepind, terug
       uit uitstel of te laat. Zonder dat woord is de volgorde van de lijst
       onverklaarbaar. De stip draagt kleur, het woord ernaast de betekenis.

       VIER SOORTEN KOMEN NIET UIT DE INBOX. Drie uit hoofdstuk 4b: een
       stille zending, een verlopen ETA en een herinnering die vandaag
       afloopt. En één uit 4c: een uitstel dat afliep op een verstuurde
       factuur — die staat in geen enkele Inbox-bak, en zonder deze rij zou je
       hem nergens meer terugzien. Alle vier lopen ze door dezelfde "wacht dit
       op mij"-regel als de rest — dezelfde eigenaar, hetzelfde uitstel,
       dezelfde pin — en staan daarna in dezelfde rijvorm tussen de andere.
       `teDoen` staat hierboven, bij de kop, want de pil achter de begroeting
       telt dezelfde lijst. */
    var taken = [];
    teDoen.slice(0, 5).forEach(function (it) {
      var project = it.projectId ? indexOp(lijst(d.projects), 'id')[it.projectId] : null;
      var klant = it.clientId ? indexOp(lijst(d.clients), 'id')[it.clientId] : null;
      var wanneer = relatiefTekst(ctx, it.at);
      var route = itemRoute(it);
      /* menuKlikApart: de rij én het ••• zitten in één klikgebied; zonder
         dit hulpje opent een keuze uit het menu óók de rij eronder */
      taken.push(menuKlikApart(ui.taskCard({
        vorm: 'rij',
        beeld: ui.iconTile({
          icoon: ITEM_ICOON[it.kind] || 'inbox',
          toon: it.urgent ? 'kritiek' : (it.pinned ? 'nu' : 'wacht'),
          maat: 40
        }),
        /* "Klantenvraag · Nordisk Retail" — de soort en van wie het komt,
           precies de twee delen die de mockup op deze regel zet. Heeft een
           item nog geen klant (een site-brief heeft er per definitie geen),
           dan neemt het project die plek in; is er geen van beide, dan blijft
           alleen de soort staan.
           `soortWoord` gaat vóór de vaste tabel: een verstuurde factuur uit
           hoofdstuk 4c deelt zijn soort met de conceptfactuur, maar niet dat
           woord. */
        kicker: samen([
          tekst(it.soortWoord) || ITEM_SOORT[it.kind] || 'Zaak',
          klantNaam(klant) || (project ? tekst(project.name) : '')
        ]),
        titel: tekst(it.title),
        meta: [wanneer ? hoofdletter(wanneer) : null].concat(rijMerken(ctx, ui, it)),
        urgent: it.urgent ? true : '',
        primair: primaireActie(ctx, it),
        menu: itemMenu(ctx, it),
        /* WAAR DE RIJ HEEN GAAT.
           Een Inbox-item opent in de Inbox, in de bak "Alles" — daar staat
           hij gegarandeerd (zie de tegel hierboven). In een bak waar hij niet
           in staat, zou de selectie stilletjes op een ander item vallen.
           Een zendingsignaal, een herinnering en een teruggekeerd uitstel op
           een verstuurde factuur staan niet ín de Inbox; die gaan naar hun
           eigen plek: het projectdetail bij de verzendingen, het klantdossier
           bij de contactmomenten, de factuureditor bij de factuur. */
        onOpen: it.buitenInbox
          ? (route ? function () { navigeer(ctx, route); } : null)
          : function () {
            navigeer(ctx, {
              area: 'inbox',
              params: { chip: 'alles', item: tekst(it.id) }
            });
          }
      })));
    });

    /* DE UITWEG ONDER DE LIJST.
       Er passen er vijf, en "Bekijk de hele Inbox" dekt alleen de Inbox-
       helft. De uitleg verschijnt zodra er iets in de lijst staat dat buiten
       de Inbox valt, en noemt precies wat er staat — een uitstel dat op een
       verstuurde factuur afliep is iets anders dan een stille zending.
       DE KNOP HANGT AAN DE ZENDINGSIGNALEN EN NIET AAN DE UITLEG. Hij wijst
       naar Projecten, filter Vertraagd, en dat filter telt zendingen; een
       teruggekeerde factuur staat daar niet in. Geen tekst zonder bestemming,
       en geen bestemming zonder inhoud. */
    var vertraagdKnop = null;
    if (buitenInbox) {
      vertraagdKnop = ui.el('div', { style: 'margin-top:14px;' }, [
        ui.el('p', {
          class: 'u-sub', style: 'margin:0 0 10px;',
          text: (opMijTerug.length
            ? (opMijSignalen.length
              ? 'Zendingsignalen, herinneringen en een uitstel dat afliep op een verstuurde factuur staan hier'
              : 'Een uitstel dat afliep op een verstuurde factuur staat hier')
            : 'Zendingsignalen en herinneringen staan hier')
            + ', maar niet in de Inbox: die telt alleen werk dat via een klantvraag, een aanvraag, een goedkeuring of een concept binnenkomt.'
        }),
        opMijSignalen.length ? ui.el('button', {
          type: 'button', class: 'u-btn ghost klein', text: 'Toon vertraagde projecten',
          onclick: function () {
            navigeer(ctx, { area: 'projecten', params: { chip: 'vertraagd' } });
          }
        }) : null
      ]);
    }

    var nuDoen = sectie(ui, ui.sectionHead({
      titel: 'Nu doen',
      actie: teDoen.length > 5 ? {
        label: 'Bekijk de hele Inbox', ico: 'chevron',
        onClick: function () { navigeer(ctx, { area: 'inbox', params: { chip: 'alles' } }); }
      } : null
    }), [
      ui.entityList(taken, {
        leegTitel: 'Er wacht nu niets op jou',
        leegUitleg: 'Zodra er een vraag, een goedkeuring, een concept of een zending die stilvalt binnenkomt, staat hij hier bovenaan.'
      }),
      vertraagdKnop
    ]);

    /* ---------- Recente activiteit ---------- */
    var feed = activiteit(ctx, { limit: 3 });
    var recent = [];
    feed.forEach(function (r) {
      recent.push(ui.el('div', { class: 'u-card' }, ui.taskCard({
        beeld: ui.iconTile({ icoon: ACT_ICOON[r.kind] || 'activiteit', toon: ACT_TOON[r.kind] || 'neutraal', maat: 40 }),
        /* drie tegels naast elkaar zijn elk een derde van de kolom breed;
           een auditregel van drie zinnen maakt daar een toren van. De hele
           regel staat in de tijdlijn achter "Bekijk alle activiteit". */
        titel: afkorten(r.detail, 84),
        context: samen([actLabel(ctx, r.kind), tijdTekst(ctx, r.at)])
      })));
    });

    var activiteitBlok = sectie(ui, ui.sectionHead({
      titel: 'Recente activiteit',
      actie: {
        label: 'Bekijk alle activiteit', ico: 'chevron',
        onClick: function () { navigeer(ctx, { area: 'activiteit' }); }
      }
    }), [
      recent.length
        ? ui.el('div', { class: 'u-grid-3' }, recent)
        : ui.emptyState({
          titel: 'Nog geen activiteit',
          uitleg: 'Zodra er iets gebeurt — een mail, een goedkeuring, een betaling — verschijnt het hier.'
        })
    ]);

    /* ---------- rail ---------- */
    var agenda = agendaRijen(ctx, items);
    var gekozenDag = paramVan(ctx, 'dag');

    var kalender = (chart && fn(chart.miniCalendar)) ? chart.miniCalendar({
      vandaag: vandaag,
      gekozen: gekozenDag || null,
      gebeurtenissen: agenda.map(function (r) { return { iso: r.iso, toon: r.toon }; }),
      onKies: function (iso) {
        deelNavigatie(ctx, { area: 'overzicht', params: { dag: iso } },
          'Agenda van ' + datumTekst(ctx, iso));
      }
    }) : null;

    var kalenderKaart = kaart(ui, [
      ui.sectionHead({
        titel: 'Deadlinekalender',
        actie: {
          label: 'Bekijk alles', ico: 'chevron',
          onClick: function () { navigeer(ctx, { area: 'projecten' }); }
        }
      }),
      kalender,
      ui.el('p', {
        class: 'u-sub', style: 'margin:12px 0 0;',
        text: agenda.length
          ? 'Een stip markeert een dag met een beloofde einddatum of een eerstvolgende datum.'
          : 'Er staan nog geen datums in de agenda.'
      })
    ]);

    /* de gedateerde lijst eronder: standaard de eerstvolgende drie, en na
       een klik in de kalender die ene dag. De keuze staat in de route, dus
       een gedeelde link opent hetzelfde scherm. */
    var getoond = [];
    if (gekozenDag) {
      agenda.forEach(function (r) { if (r.iso === gekozenDag) getoond.push(r); });
    } else {
      agenda.forEach(function (r) { if (getoond.length < 3 && r.iso >= vandaag) getoond.push(r); });
      if (!getoond.length) getoond = agenda.slice(Math.max(0, agenda.length - 3));
    }

    var agendaRijenUI = getoond.map(function (r) {
      var idx = weekdagIndex(r.iso);
      var dagen = (data && Array.isArray(data.WEEKDAGEN)) ? data.WEEKDAGEN : [];
      return {
        iso: r.iso,
        dag: (idx >= 0 && dagen[idx]) ? tekst(dagen[idx].label) : '',
        datum: datumTekst(ctx, r.iso),
        titel: r.titel,
        tekst: r.sub,
        toon: r.toon,
        toonWoord: r.toonWoord,
        onOpen: function () {
          navigeer(ctx, { area: 'projecten', id: r.projectId, tab: 'overzicht' });
        }
      };
    });

    var agendaKaart = kaart(ui, [
      ui.sectionHead({
        titel: gekozenDag ? datumTekst(ctx, gekozenDag) : 'Eerstvolgende datums',
        actie: gekozenDag ? {
          label: 'Toon weer de eerstvolgende', ico: 'terug',
          onClick: function () { deelNavigatie(ctx, { area: 'overzicht' }, 'Eerstvolgende datums'); }
        } : null
      }),
      agendaRijenUI.length
        ? raillijst(ctx, ui, agendaRijenUI)
        : ui.emptyTile({
          icoon: 'kalender',
          titel: gekozenDag ? 'Op deze dag staat niets' : 'Nog geen datums',
          uitleg: 'Een datum ontstaat uit een beloofde einddatum of uit een ETA, een antwoordklok, een factuur, een uitstel, een herinnering of een geplande publicatie.'
        })
    ]);

    /* ---------- Operaties deze week ----------
       BRON: CP_DATA.workload — de ingestelde dagcapaciteit tegen het ECHTE
       aantal acties dat volgens de zes datumprojecties op die dag valt.
       De legenda noemt dat WERKDRUK en geen fabriekscapaciteit: dat laatste
       meten we niet en doen we ook niet alsof. */
    var werkKaart = null;
    if (data && fn(data.workload) && chart && fn(chart.barChart)) {
      var week = data.workload({
        settings: opt(d.settings),
        shipments: lijst(d.shipments),
        events: lijst(d.shipmentEvents),
        questions: lijst(d.questions),
        invoices: lijst(d.invoices),
        moments: lijst(d.contactMoments).length ? lijst(d.contactMoments) : lijst(d.moments),
        media: lijst(d.media),
        documents: lijst(d.documents),
        projects: lijst(d.projects)
      }, vandaag);

      var maxWerk = 1;
      week.forEach(function (dag) {
        maxWerk = Math.max(maxWerk, dag.bezetting, dag.capaciteit);
      });
      /* de y-as loopt tot het EERSTE veelvoud van de stap dat de hoogste
         waarde haalt, niet tot vier stappen. Anders staat een week met vier
         acties in een as tot acht en lijkt elke dag leeg. */
      var stap = Math.max(1, Math.ceil(maxWerk / 4));
      var top = stap * Math.ceil(maxWerk / stap);
      var yLabels = [];
      for (var yy = 0; yy <= top; yy += stap) yLabels.push(yy);

      var groepen = week.map(function (dag) {
        return {
          label: tekst(dag.dagLabel).slice(0, 2),
          delen: [
            { label: 'Binnen je dagcapaciteit', waarde: Math.min(dag.bezetting, dag.capaciteit), kleur: 'cat-3' },
            { label: 'Boven je dagcapaciteit', waarde: dag.overbelasting, kleur: 'warn' }
          ]
        };
      });

      var totaalWerk = 0, drukDagen = 0;
      week.forEach(function (dag) {
        totaalWerk += dag.bezetting;
        if (dag.overbelasting > 0) drukDagen++;
      });

      /* de tekstuele tegenhanger schrijven we zelf: CP_CHART plakt zijn
         eenheid ongewijzigd achter elk getal ("1 acties") en dit is
         zichtbare Nederlandse tekst voor wie de grafiek niet ziet. Elke
         waarde erin komt uit dezelfde week-berekening als de staven. */
      var zinnen = week.map(function (dag) {
        return tekst(dag.dagLabel) + ': ' + nlAantal(dag.bezetting, 'actie', 'acties')
          + ' bij een dagcapaciteit van ' + dag.capaciteit
          + (dag.overbelasting > 0 ? ', waarvan ' + dag.overbelasting + ' erboven' : '');
      });

      werkKaart = kaart(ui, [
        ui.sectionHead({
          titel: 'Operaties deze week',
          actie: {
            label: 'Details bekijken', ico: 'chevron',
            onClick: function () { navigeer(ctx, { area: 'instellingen', tab: 'automatiseringen' }); }
          }
        }),
        chart.barChart({
          titel: 'Werkdruk deze week',
          beschrijving: 'Werkdruk deze week. ' + zinnen.join('. ') + '.',
          groepen: groepen,
          eenheid: 'acties',
          max: top,
          yLabels: yLabels,
          hoogte: 190,
          overlay: { punten: week.map(function (dag) { return dag.capaciteit; }) },
          legenda: [
            { label: 'Werkdruk binnen je dagcapaciteit', kleur: 'cat-3' },
            { label: 'Werkdruk boven je dagcapaciteit', kleur: 'warn' },
            { label: 'Ingestelde dagcapaciteit', kleur: 'ink-3' }
          ]
        }),
        ui.el('p', {
          class: 'u-sub', style: 'margin:10px 0 0;',
          text: nlAantal(totaalWerk, 'actie valt', 'acties vallen') + ' deze week'
            + (drukDagen ? ', op ' + nlAantal(drukDagen, 'dag', 'dagen') + ' meer dan je dagcapaciteit.' : '.')
        })
      ]);
    }

    /* ---------- samenstellen ---------- */
    var hoofd = ui.el('div', { class: 'u-cols-main' }, [
      kop,
      ui.statRow(tegels),
      nuDoen,
      activiteitBlok
    ]);
    var rail = ui.el('div', { class: 'u-cols-side' }, [
      /* de drie railkaarten onder elkaar, met één afstand in plaats van
         drie losse marges. Een null ertussen (geen werkdrukkaart, geen
         kalender) valt vanzelf weg — el() slaat hem over. */
      stapel(ui, [kalenderKaart, agendaKaart, werkKaart])
    ]);
    return ui.el('div', { class: 'u-cols' }, [hoofd, rail]);
  };

  /* de activiteitssoorten van CP_MODEL.ACTIVITY_KINDS in beeld en tint.
     Het LABEL komt uit die tabel zelf, nooit uit deze.
     De vijf klantacties uit 0021 (akkoord, samplekeuze, betaling,
     klantbestand, bezwaar) staan er sinds deze ronde bij; tot dan viel elke
     klantactie stil terug op het algemene activiteitsicoon. Elke naam staat
     in ICONEN van admin-ui.js. De tonen zijn de zes van CP_UI.statusChip:
     een bezwaar zou 'waarschuwing' krijgen als die toon bestond, maar
     admin-ui.js kent hem niet en dus is het 'extern' — de bal ligt bij de
     klant én bij mij, en een verzonnen toon zou stil op grijs terugvallen. */
  var ACT_ICOON = {
    klant: 'relaties', mail: 'mail', systeem: 'instellingen',
    bestanden: 'bestand', financieel: 'financien',
    akkoord: 'vinkje', samplekeuze: 'camera', betaling: 'financien',
    klantbestand: 'bestand', bezwaar: 'waarschuwing'
  };
  var ACT_TOON = {
    klant: 'extern', mail: 'extern', systeem: 'neutraal',
    bestanden: 'neutraal', financieel: 'klaar',
    akkoord: 'extern', samplekeuze: 'extern', betaling: 'klaar',
    klantbestand: 'neutraal', bezwaar: 'extern'
  };
  var actLabel = function (ctx, kind) {
    var m = MOD(ctx);
    var tabel = (m && Array.isArray(m.ACTIVITY_KINDS)) ? m.ACTIVITY_KINDS : [];
    for (var i = 0; i < tabel.length; i++) {
      if (tabel[i].key === kind) return tabel[i].label;
    }
    return tekst(kind);
  };

  /* ============================================================
     8. SCHERM — INBOX (§5.2)

     Titel met "n op jou" eronder, onderstreepte tabs met tellingen uit
     CP_MODEL, en een lijst met detail. De selectie staat in ?item=, de
     tabkeuze in ?chip= — allebei in de route en nooit in een variabele.

     DE VIJF KLANTACTIES UIT 0021 HEBBEN ELK EEN EIGEN PANEEL.
     collectInbox kende betaling, klantbestand, samplebeslissing, bezwaar
     en (sinds deze ronde) herbestelling al; dit scherm gaf de lijsten niet
     door en had er geen paneel voor, dus een gemelde betaling viel in het
     conceptpaneel en toonde een lege voorbeeldkaart. Per soort staat er nu
     wat de klant precies deed, wanneer, de feiten, één primaire knop en één
     secundaire (zie klantSlot). Een rij van een klantsoort draagt in de
     lijst het kenmerk "Door klant" — de tegenhanger van "extern" in de
     mockup — uit CP_MODEL.doorKlant en de vlag op het item.

     DOOR NAAR HET VOLGENDE (voorstel 10) — HOE HET WERKT EN WAT HET EIST.
     Na een geslaagde afhandeling sprong de selectie nergens heen: het
     afgehandelde item verdween uit de bak en het paneel viel terug op de
     eerste rij. Nu springt de selectie naar het VOLGENDE item in de huidige
     gefilterde lijst — het vorige als het het laatste was, en de lege stand
     "Inbox leeg" als er niets meer is. Langs dezelfde weg als elke andere
     selectie: ?item= in de route, als VERVANGENDE navigatie (opts.vervang)
     zodat de terugknop niet langs elk afgehandeld item loopt. Geen
     schakelaar in de instellingen: het is het standaardgedrag.
       · Het gebeurt UITSLUITEND als de haak een belofte teruggeeft die
         VERVULD wordt met iets anders dan `false` — dat is het teken dat de
         handeling echt gelukt is (false is in deze codebase "afgebroken",
         zie CP_SHELL.ga). Een verworpen belofte is een fout of een
         annulering en dan blijft de selectie staan; de bestaande undo-toast
         van de haak zelf blijft het vangnet.
       · Een haak die GEEN belofte teruggeeft, kan geen succes bewijzen, en
         dan springt er niets. Dat is vandaag de stand voor de haken die een
         venster openen (beantwoorden, publiceren, bevestigen, oppakken): ze
         geven in beheer.html undefined terug en het venster meldt zijn
         succes alleen via refresh(). Zodra zo'n haak een belofte teruggeeft
         die het venster bij opslaan vervult, werkt de doorsprong daar
         vanzelf — er hoeft hier niets meer voor te veranderen.
       · Het volgende item wordt bepaald VÓÓR de haak draait, op de lijst
         zoals hij op dat moment op het scherm staat. Na het verversen is
         het afgehandelde item weg en zou "de volgende" niet meer te vinden
         zijn. Staat het gekozen volgende item er na het verversen ook niet
         meer (het is intussen ook afgehandeld), dan valt het scherm terug
         op zijn bestaande regel: een ?item= dat niet in de bak staat kiest
         de eerste rij.
       · "Volgende stap" bij een herbestelling loopt er bewust NIET langs:
         die haak geeft wél een belofte, maar het item blijft in de bak en
         je wilt juist zíen dat de stap is gezet.
     ============================================================ */

  /* het item ná dit item in de zichtbare lijst, anders het item ervoor,
     anders null. Op soort én id, want ids overlappen tussen soorten (een
     bezwaar en een factuur delen het factuur-id). */
  var volgendeNa = function (zichtbaar, item) {
    var rijen = lijst(zichtbaar);
    var idx = -1;
    rijen.forEach(function (it, i) {
      if (idx < 0 && it && item && it.id === item.id && it.kind === item.kind) idx = i;
    });
    if (idx < 0) return null;
    if (rijen[idx + 1]) return rijen[idx + 1];
    if (idx > 0) return rijen[idx - 1];
    return null;
  };

  /* de doorsprong van het Inbox-scherm (zie de kop van dit hoofdstuk).
     `na(item, uitkomst)` geeft de uitkomst van de haak ongewijzigd terug,
     zodat een aanroeper er niets van merkt; alleen een vervulde belofte
     verplaatst de selectie. `leeg` zegt of de lijst op dit moment leeg is,
     voor de lege stand van het paneel. */
  var maakDoorsprong = function (ctx, zichtbaar, params) {
    var p = opt(params);
    return {
      leeg: !lijst(zichtbaar).length,
      na: function (item, uitkomst) {
        if (!uitkomst || typeof uitkomst.then !== 'function') return uitkomst;
        var volgende = volgendeNa(zichtbaar, item);
        uitkomst.then(function (v) {
          if (v === false) return;
          var doel = { chip: p.chip || 'alles', soort: p.soort || null };
          if (volgende) doel.item = volgende.id;
          navigeer(ctx, { area: 'inbox', params: doel }, {
            vervang: true, behoudScroll: true, behoudFocus: true,
            melding: volgende
              ? 'Afgehandeld. Volgende: ' + tekst(volgende.title)
              : 'Afgehandeld. De Inbox is leeg.'
          });
        }, function () {
          /* fout of annulering: de selectie blijft staan; de haak heeft zijn
             eigen melding al getoond */
        });
        return uitkomst;
      }
    };
  };

  /* de ene regel die elke afhandelende knop volgt: de uitkomst van de haak
     door de doorsprong halen als er een is. Buiten de Inbox (door = null)
     verandert er niets. */
  var viaDoor = function (door, item, uitkomst) {
    return (door && fn(door.na)) ? door.na(item, uitkomst) : uitkomst;
  };

  SCHERMEN.inbox = function (ctx) {
    var ui = UI(ctx);
    if (!ui) return noodElement('Inbox');
    var model = MOD(ctx);
    var d = D(ctx);

    var items = inboxItems(ctx);
    var chips = (model && Array.isArray(model.INBOX_CHIPS)) ? model.INBOX_CHIPS : [];
    var actief = paramVan(ctx, 'chip') || 'alles';
    var bekend = false;
    chips.forEach(function (c) { if (c.key === actief) bekend = true; });
    if (!bekend) actief = 'alles';

    /* het tweede filter uit §5.2 (de knop "Filters" rechts van de tabbalk):
       op ITEMSOORT. CP_MODEL.filterInbox kent daar het veld extra.kind al
       voor, dus dit is geen nieuwe rekenregel maar een bestaande die tot nu
       toe geen bediening had. De keuze staat in de route (?soort=), net als
       de tab en de selectie. */
    var soort = paramVan(ctx, 'soort');
    /* eigen sleutel: zonder deze controle zou ?soort=constructor door de
       poort komen en daarna een lijst opleveren die zonder reden leeg is */
    if (soort && !tekst(eigenVeld(ITEM_SOORT, soort))) soort = '';
    var extra = soort ? { kind: soort } : null;

    var zichtbaar = (model && fn(model.filterInbox)) ? model.filterInbox(items, actief, extra) : items;
    var opMij = opMijAantal(ctx, items, opMijItems(ctx, items));

    /* ---------- kop ---------- */
    var kop = ui.pageHeader({
      titel: 'Inbox',
      menu: [
        {
          label: 'Bekijk alle activiteit', ico: 'activiteit',
          onKies: function () { navigeer(ctx, { area: 'activiteit' }); }
        },
        {
          label: 'Open Projecten', ico: 'projecten',
          onKies: function () { navigeer(ctx, { area: 'projecten' }); }
        }
      ]
    });
    var onder = ui.el('p', {
      class: 'u-lees', style: 'font-size:17px;margin:6px 0 0;',
      text: opMij ? (opMij + ' op jou') : 'Niets op jou'
    });

    /* ---------- tabs ----------
       De mockup toont onderstreepte tabs, dus dit is CP_UI.tabs (een echte
       tablist met pijltjes) en niet CP_UI.filterChips (pillen). Er is één
       paneel voor negen tabs, dus geen panelId: aria-controls naar een
       paneel dat er voor acht van de negen niet is, is slechter dan geen
       aria-controls. Het paneel draagt zelf een naam via role=region. */
    var tabDefs = chips.map(function (c) {
      return {
        key: c.key, label: c.label,
        /* de telling telt HETZELFDE filter mee als de lijst eronder.
           Zonder dat belooft een tab "12" en toont hij er drie. */
        count: (model && fn(model.filterInbox)) ? model.filterInbox(items, c.key, extra).length : 0
      };
    });

    var tabBalk = ui.tabs({
      tabs: tabDefs,
      actief: actief,
      label: 'Filters van de werkvoorraad',
      onKies: function (key, tab) {
        /* de selectie valt weg bij een tabwissel: een item uit de vorige
           bak staat in de nieuwe lijst niet meer, en een detailpaneel dat
           een rij toont die links niet bestaat, is een leugen. Het
           soortfilter blijft wél staan — dat is een keuze over de hele
           werkvoorraad en niet over één bak. */
        deelNavigatie(ctx, { area: 'inbox', params: { chip: key, soort: soort || null } },
          tekst(tab && tab.label) + ', ' + nlAantal(getal(tab && tab.count, 0), 'item', 'items'));
      }
    });
    /* de tabbalk pakt de breedte en de knop "Filters" staat ernaast, precies
       zoals §5.2 hem tekent. De onderrand van .u-tabs loopt daardoor tot aan
       de knop; de knop krijgt dezelfde ondermarge zodat de twee op één lijn
       eindigen. */
    tabBalk.style.flex = '1 1 auto';
    tabBalk.style.minWidth = '0';

    /* DE ACTIEVE KEUZE STAAT IN HET LABEL EN IN EEN VINKJE, NIET IN HET
       SNELTOETSVAKJE. .u-menu-hint is de rechterkolom van een menurij en is
       volgens admin-ui.css "mono, want het is een code": daar hoorde een
       toetsaanslag te staan, en er stond het woord "nu". Dat las als een
       sneltoets in plaats van als een stand.
       Nu draagt het vinkje de vorm en het woord "actief" de betekenis — kleur
       en pictogram zijn allebei nooit de enige drager. Het sneltoetsvakje
       blijft daarmee leeg en houdt precies één betekenis over. */
    var soortRij = function (label, ico, isActief, onKies) {
      return {
        label: label + (isActief ? ' — actief' : ''),
        ico: isActief ? 'vinkje' : ico,
        onKies: onKies
      };
    };

    var soortItems = [soortRij('Alle soorten', 'filter', !soort, function () {
      deelNavigatie(ctx, { area: 'inbox', params: { chip: actief } }, 'Alle soorten');
    })];
    Object.keys(ITEM_SOORT).forEach(function (k) {
      var aantal = 0;
      lijst(items).forEach(function (it) { if (it && it.kind === k) aantal++; });
      if (!aantal) return;   /* een soort die niet voorkomt, is geen keuze */
      soortItems.push(soortRij(
        ITEM_SOORT[k] + ' (' + aantal + ')',
        ITEM_ICOON[k],
        soort === k,
        function () {
          deelNavigatie(ctx, { area: 'inbox', params: { chip: actief, soort: k } },
            ITEM_SOORT[k] + ', ' + nlAantal(aantal, 'item', 'items'));
        }
      ));
    });

    var filterKnop = ui.el('button', {
      type: 'button', class: 'u-btn ghost klein',
      title: 'Filter de werkvoorraad op soort'
    }, [
      ui.icon('filter', 16),
      ui.el('span', { text: soort ? 'Filters: ' + ITEM_SOORT[soort] : 'Filters' })
    ]);
    var filterMenu = ui.contextMenu({
      knop: filterKnop,
      kop: 'Soort',
      items: soortItems
    }).el;
    filterMenu.style.marginBottom = '24px';

    var tabRij = ui.el('div', {
      style: 'display:flex;align-items:flex-end;gap:18px;'
    }, [tabBalk, filterMenu]);

    /* ---------- lijst ---------- */
    var gekozenId = paramVan(ctx, 'item');
    var uitRoute = null;
    /* een ?item= dat niet in DEZE bak staat, selecteert niets. Dat is de
       juiste uitkomst na een tabwissel of na het afhandelen van een item:
       een detailpaneel dat een rij toont die links niet bestaat, is een
       leugen. */
    zichtbaar.forEach(function (it) { if (it.id === gekozenId) uitRoute = it; });

    /* DE EERSTE RIJ STAAT BIJ BINNENKOMST AL OPEN (observatie V7).
       De mockup toont de Inbox met de eerste rij gekozen en het detail ernaast
       gevuld; bij ons stond er "Kies een item uit de lijst" naast een volle
       lijst, en dan opent het scherm half leeg.

       DIT BREEKT DE ZUIVERHEID NIET. De keuze is volledig af te leiden uit de
       route: dezelfde route geeft dezelfde lijst en dus dezelfde eerste rij.
       Er staat hier bewust GEEN navigatie: een scherm dat tijdens zijn eigen
       tekening de route bijwerkt, tekent zichzelf een tweede keer opnieuw, en
       de shell kent geen weg om alleen de hash bij te werken. Zodra de
       gebruiker zelf een rij kiest, staat de selectie wél in ?item= — en dan
       wint die boven deze terugval.

       DE LEGE TOESTAND BLIJFT. Is de lijst écht leeg, dan is er niets te
       kiezen en toont het detail zijn eigen lege stand. */
    var gekozen = uitRoute || (zichtbaar.length ? zichtbaar[0] : null);

    /* de doorsprong (voorstel 10) kent de lijst zoals hij NU staat en de
       route waarin hij de volgende selectie moet schrijven */
    var door = maakDoorsprong(ctx, zichtbaar, { chip: actief, soort: soort || null });

    var rijen = zichtbaar.map(function (it) {
      var project = it.projectId ? indexOp(lijst(d.projects), 'id')[it.projectId] : null;
      var klant = it.clientId ? indexOp(lijst(d.clients), 'id')[it.clientId] : null;
      var wanneer = relatiefTekst(ctx, it.at);
      var rij = ui.entityRow({
        thumb: ui.iconTile({
          icoon: ITEM_ICOON[it.kind] || 'inbox',
          toon: it.urgent ? 'kritiek' : (it.snoozedUntil ? 'neutraal' : 'wacht'),
          maat: 40
        }),
        titel: tekst(it.title),
        sub: samen([ITEM_SOORT[it.kind], klantNaam(klant), project ? tekst(project.name) : '', tekst(it.sub)]),
        /* TERUG UIT UITSTEL KRIJGT ZIJN EIGEN MARKERING.
           Een item waarvan de uitsteldatum verstreken is, valt gewoon terug
           in deze lijst en was daarna van niets meer te onderscheiden — de
           bak "Uitgesteld" is hij dan immers uit. De stand staat al op het
           item (collectInbox zet returnedAt zodra de snooze gepasseerd is);
           hij werd alleen nergens getoond. De stip staat vóór de
           eigenaarschip, want dit is de reden dat de rij er weer is. */
        chips: [
          it.returnedAt ? ui.statusDot({
            toon: 'nu', label: 'Terug uit uitstel',
            titel: 'Het uitstel liep af op ' + datumTekst(ctx, it.returnedAt) + '.'
          }) : null,
          /* het kenmerk "door klant" (0021): de klant deed dit zelf in het
             portaal. Blauw is de toon van "de ander", en het woord ernaast
             draagt de betekenis — de mockup markeert dit als "extern". */
          isDoorKlant(ctx, it) ? ui.statusDot({
            toon: 'extern', label: 'Door klant',
            titel: 'De klant deed dit zelf in het portaal.'
          }) : null,
          ui.statusDot({
            toon: it.urgent ? 'kritiek' : (isVanMij(ctx, it) ? 'wacht' : 'extern'),
            label: it.urgent ? 'Te laat' : (isVanMij(ctx, it) ? 'Wacht op jou' : 'Wacht op de ander')
          })
        ],
        meta: wanneer,
        chevron: false,
        onOpen: function () {
          deelNavigatie(ctx, { area: 'inbox', params: { chip: actief, soort: soort || null, item: it.id } },
            'Geopend: ' + tekst(it.title));
        }
      });
      if (gekozen && gekozen.id === it.id) {
        /* de gekozen rij: .gekozen doet de vorm (--tint-ink, radius 14) en
           aria-current draagt de betekenis. aria-selected zou hier onjuist
           zijn — die hoort in een listbox of een tablist, en dit is een
           lijst met knoppen. */
        rij.classList.add('gekozen');
        rij.setAttribute('aria-current', 'true');
      }
      return rij;
    });

    var lijstNode = ui.el('div', { role: 'region', 'aria-label': 'Werkvoorraad' }, [
      ui.entityList(rijen, {
        leegTitel: 'Deze bak is leeg',
        leegUitleg: 'Er staat op dit moment niets onder dit filter. Kies een ander filter om de rest van de werkvoorraad te zien.'
      })
    ]);

    /* detailOpen BETEKENT "HET PANEEL LIGT OVER DE LIJST", en dat is alleen
       onder 900px zo. Daarom hangt hij aan de selectie UIT DE ROUTE en niet
       aan de terugval hierboven: op een breed scherm staan lijst en detail
       naast elkaar en toont het detail de eerste rij gewoon mee, maar op een
       telefoon zou een automatische selectie de lijst meteen achter een
       paneel wegschuiven dat niemand heeft geopend.
       masterDetail regelt sinds deze ronde zelf drie dingen die hier eerder
       ontbraken: hij opent de beginstand écht (inclusief focus op smal
       scherm), hij meldt de laag bij de shell aan zodat Escape hem bereikt,
       en hij ruimt een vergeten stop() op. Dit scherm hoeft dus alleen nog
       zijn eigen opruiming door te geven — zie wortel.stop hieronder. */
    var md = ui.masterDetail({
      lijst: lijstNode,
      detail: inboxDetail(ctx, ui, gekozen, actief, door),
      detailLabel: gekozen ? tekst(gekozen.title) : 'Detail',
      detailOpen: !!uitRoute,
      onSluitDetail: function () {
        deelNavigatie(ctx, { area: 'inbox', params: { chip: actief, soort: soort || null } }, 'Terug naar de lijst');
      }
    });

    var wortel = ui.el('div', null, [kop, onder, tabRij, md.el]);
    /* de gastheer roept node.stop() aan zodra het scherm verdwijnt; zonder
       deze doorgifte blijft de luisteraar op de mediaquery hangen, met de
       hele oude DOM-boom eraan */
    wortel.stop = function () { md.stop(); };
    return wortel;
  };

  /* het detailpaneel. Negen itemtypen krijgen elk hun eigen paneel (de vier
     van de eerste ronde plus de vijf klantacties uit 0021); de omlijsting
     (chip, •••, grote titel, subregel, inhoud, metadataraster en onderaan
     één volle zwarte knop) is voor alle negen gelijk, want dat is precies
     wat §5.2 vraagt.

     WAT ER ONDER DIE KNOP ZIT, VERSCHILT WEL PER SOORT — zie detailSlot():
     een klantvraag krijgt het antwoordveld, een goedkeuring de statuskeuze
     van zijn fase, een concept de publiceerknop, een conceptfactuur de zijne,
     en de rest houdt de bestaande primaire actie. Dat is de reparatie waar
     deze ronde om ging: het paneel was leesbaar en niet bewerkbaar. */
  var inboxDetail = function (ctx, ui, item, chip, door) {
    if (!item) {
      /* twee lege standen, en ze zeggen iets anders: een lege BAK ("Inbox
         leeg" — ook de landing van de doorsprong na het laatste item) en een
         volle bak zonder keuze. */
      var bakLeeg = !!(door && door.leeg);
      return ui.el('div', { class: 'u-hero' }, ui.emptyTile({
        icoon: 'inbox',
        titel: bakLeeg ? 'Inbox leeg' : 'Kies een item uit de lijst',
        uitleg: bakLeeg
          ? 'Alles in deze bak is afgehandeld. Kies een andere tab om de rest van de werkvoorraad te zien.'
          : 'Links staat je werkvoorraad. Kies een rij en je kunt hem hier afhandelen zonder de pagina te verlaten.'
      }));
    }

    var d = D(ctx);
    var project = item.projectId ? indexOp(lijst(d.projects), 'id')[item.projectId] : null;
    var klant = item.clientId ? indexOp(lijst(d.clients), 'id')[item.clientId] : null;

    var acties = ui.el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
      ui.statusChip({
        label: ITEM_SOORT[item.kind] || 'Zaak',
        toon: item.urgent ? 'kritiek' : 'neutraal'
      }),
      /* dezelfde markering als in de lijst: de klant deed dit zelf */
      isDoorKlant(ctx, item) ? ui.statusChip({
        label: 'Door klant', toon: 'extern',
        titel: 'De klant deed dit zelf in het portaal.'
      }) : null,
      /* dezelfde markering als in de lijst links: zonder hem is in het
         paneel niet te zien dat dit item vandaag uit uitstel terugkwam */
      item.returnedAt ? ui.statusChip({
        label: 'Terug uit uitstel',
        toon: 'nu',
        titel: 'Het uitstel liep af op ' + datumTekst(ctx, item.returnedAt) + '.'
      }) : null,
      ui.contextMenu({
        knop: { titel: 'Meer acties bij: ' + tekst(item.title) },
        items: inboxMenu(ctx, item)
      }).el
    ]);

    var titelRegel = samen([
      ITEM_SOORT[item.kind],
      klantNaam(klant),
      project ? tekst(project.name) : '',
      item.at ? 'binnengekomen ' + tijdTekst(ctx, item.at) : ''
    ]);

    var inhoud;
    var cellen;

    if (item.kind === 'brief') {
      inhoud = briefInhoud(ctx, ui, item);
      cellen = briefCellen(ctx, item);
    } else if (item.kind === 'vraag') {
      inhoud = vraagInhoud(ctx, ui, item, klant);
      cellen = vraagCellen(ctx, item, project, klant);
    } else if (item.kind === 'fase') {
      inhoud = faseInhoud(ctx, ui, item, project);
      cellen = faseCellen(ctx, item, project, klant);
    } else if (item.kind === 'betaling') {
      inhoud = betalingInhoud(ctx, ui, item);
      cellen = betalingCellen(ctx, item, project, klant);
    } else if (item.kind === 'klantbestand') {
      inhoud = klantbestandInhoud(ctx, ui, item, klant);
      cellen = klantbestandCellen(ctx, item, project, klant);
    } else if (item.kind === 'samplebeslissing') {
      inhoud = samplebeslissingInhoud(ctx, ui, item, klant);
      cellen = samplebeslissingCellen(ctx, item, project, klant);
    } else if (item.kind === 'bezwaar') {
      inhoud = bezwaarInhoud(ctx, ui, item, klant);
      cellen = bezwaarCellen(ctx, item, project, klant);
    } else if (item.kind === 'herbestelling') {
      inhoud = herbestellingInhoud(ctx, ui, item, project, klant);
      cellen = herbestellingCellen(ctx, item, project, klant);
    } else {
      inhoud = conceptInhoud(ctx, ui, item);
      cellen = conceptCellen(ctx, item, project, klant);
    }

    /* ONDERAAN HET PANEEL STAAT DE HANDELING, EN NIET ALLEEN EEN VERWIJZING.
       Dit is de plek waar de opdracht om vroeg: een klantvraag beantwoorden
       is de kernhandeling van de dag en kon nergens meer. Per soort staat
       hier nu de bijbehorende afsluiting; is er voor een soort geen haak, dan
       valt het paneel terug op de bestaande primaire knop (die op zijn beurt
       terugvalt op de route van het item). */
    var slot = detailSlot(ctx, ui, item, project, door);

    return ui.el('div', { class: 'u-hero' }, [
      ui.el('div', { class: 'u-hero-kop' }, [
        ui.el('div', null, [
          ui.el('span', { class: 'u-kicker', text: chipLabel(ctx, chip) }),
          ui.el('h2', { class: 'u-paneeltitel', text: tekst(item.title) })
        ]),
        acties
      ]),
      ui.el('p', { class: 'u-lees', style: 'margin:0 0 22px;', text: titelRegel }),
      inhoud,
      ruimte(ui, 24),
      ui.metaGrid({ cellen: cellen }),
      ruimte(ui, 26),
      slot
    ]);
  };

  /* ---------------------------------------------------------------
     HET ••• VAN HET DETAILPANEEL

     Drie groepen in leesvolgorde: wat je met DEZE SOORT kunt (antwoord
     bewerken, publicatie inplannen, concept verwijderen), daarna de
     itemacties die voor elk item gelden (uitstellen, pinnen, bal, najagen),
     en onderaan de uitwegen. Een gevaarlijke rij staat onderin haar eigen
     groep en in de kritieke kleur.

     GEEN BEVESTIGINGSVRAAG BIJ EEN VERWIJDERING MET ONGEDAAN MAKEN. De
     bestaande afsluiter van conceptVerwijderen is verwijderMetUndo: een
     zachte verwijdering plus vijftien seconden "Maak ongedaan". Daar een
     bevestigingsvraag vóór zetten is een tweede weg naast een vangnet dat
     er al is, en het is de weg die de app bewust nergens meer neemt
     (archiveren doet het al zo). De kleur en de plaats onderin dragen het
     gewicht; het vangnet doet de veiligheid.
     --------------------------------------------------------------- */
  var inboxMenu = function (ctx, item) {
    return menuGroepen(soortActies(ctx, item), itemActies(ctx, item), itemNavigatie(ctx, item));
  };

  var soortActies = function (ctx, item) {
    if (!item) return [];
    var soort = tekst(item.kind);
    var r = opt(item.raw);
    var uit = [];

    if (soort === 'vraag' && r.answeredAt) {
      /* stil bewerken: een correctie is geen gebeurtenis, dus geen nieuwe
         mail naar de klant. Dat verschil met beantwoorden staat in het
         label, want het is precies wat je wilt weten vóór je klikt.

         DEZELFDE ACTIE STAAT OOK ONDERAAN HET PANEEL, EN DAT IS GEEN
         VERGISSING. §5.2 laat het detail altijd op één volle zwarte knop
         eindigen, en bij een beantwoorde vraag is bewerken de enige handeling
         die er nog is — een knop "Beantwoorden" zou daar alleen de melding
         "deze vraag is al beantwoord" opleveren. Twee ingangen, één haak; er
         is geen tweede bewerkweg bijgekomen. */
      uit.push(haakRij(ctx, HAKEN.antwoordBewerken,
        'Antwoord bewerken (stil, geen nieuwe mail)', 'potlood',
        function (h) { h(item); }));
    }

    if (soort === 'fase') {
      uit.push(haakRij(ctx, HAKEN.fase, 'Open de fase in het project', 'projecten',
        function (h) { h(item); }));
    }

    if (soort === 'sample') {
      uit.push(haakRij(ctx, HAKEN.sampleGoedkeuren, 'Ronde beoordelen of goedkeuren', 'camera',
        function (h) { h(item); }));
    }

    if (soort === 'concept') {
      if (r.scheduledAt) {
        uit.push(haakRij(ctx, HAKEN.nuPubliceren, 'Nu publiceren in plaats van op de geplande tijd', 'vinkje',
          function (h) { h(item); }));
        uit.push(haakRij(ctx, HAKEN.planAnnuleren, 'Publicatie annuleren (blijft concept)', 'klok',
          function (h) { h(item); }));
      } else {
        uit.push(haakRij(ctx, HAKEN.inplannen, 'Publicatie inplannen', 'kalender',
          function (h) { h(item); }));
      }
      uit.push(haakRij(ctx, HAKEN.conceptVerwijderen, 'Concept verwijderen', 'sluiten',
        function (h) { h(item); }, true));
    }

    if (soort === 'factuur') {
      uit.push(haakRij(ctx, HAKEN.factuur, 'Open in de factuureditor', 'financien',
        function (h) { h(item); }));
      uit.push(haakRij(ctx, HAKEN.factuurPdf, 'Factuurdocument bekijken', 'bestand',
        function (h) { h(item); }));
    }

    /* de vijf klantacties uit 0021: dezelfde haken als onderaan het paneel,
       plus wat er náást hoort (het factuurdocument, de ronde zelf). De
       sprongen naar factuur en project staan onderaan bij de uitwegen. */
    if (soort === 'betaling') {
      uit.push(haakRij(ctx, HAKEN.betaling, 'Betaling controleren en bevestigen', 'vinkje',
        function (h) { h(item); }));
    }
    if (soort === 'klantbestand') {
      uit.push(haakRij(ctx, HAKEN.klantbestand, 'Bestand bekijken', 'bestand',
        function (h) { h(item); }));
    }
    if (soort === 'samplebeslissing') {
      if (tekst(r.clientDecision) === 'aanpassing') {
        uit.push(haakRij(ctx, HAKEN.samplebeslissing, 'Nieuwe ronde met deze opmerking als startpunt', 'camera',
          function (h) { h(item); }));
      }
      uit.push(haakRij(ctx, HAKEN.sampleGoedkeuren, 'Ronde openen', 'camera',
        function (h) { h(item); }));
    }
    if (soort === 'bezwaar') {
      uit.push(haakRij(ctx, HAKEN.bezwaar, 'Bezwaar behandelen in de factuureditor', 'financien',
        function (h) { h(item); }));
      uit.push(haakRij(ctx, HAKEN.factuurPdf, 'Factuurdocument bekijken', 'bestand',
        function (h) { h(item); }));
    }
    if (soort === 'herbestelling') {
      var volgende = item.pipeline && item.pipeline.next ? item.pipeline.next : null;
      uit.push(haakRij(ctx, HAKEN.herbestelling, 'Omzetten naar een project', 'projecten',
        function (h) { h(item); }));
      if (volgende && volgende.key !== 'project') {
        uit.push(haakRij(ctx, HAKEN.herbestellingStap, 'Volgende stap: ' + tekst(volgende.label), 'pijl',
          function (h) { h(item, volgende.key); }));
      }
    }

    return uit.filter(function (x) { return !!x; });
  };

  /* ---------------------------------------------------------------
     DE AFSLUITING ONDERAAN HET DETAILPANEEL

     §5.2 tekent daar één volle zwarte knop. Per soort is dat een andere
     handeling, en bij een klantvraag hoort er het antwoordveld boven.
     --------------------------------------------------------------- */
  var detailSlot = function (ctx, ui, item, project, door) {
    var soort = tekst(item && item.kind);
    var r = opt(item && item.raw);

    if (soort === 'vraag') {
      var veld = antwoordBlok(ctx, ui, item, r.answeredAt ? 'bewerken' : 'beantwoorden', door);
      if (veld) return veld;
    }
    if (soort === 'fase') {
      var fase = faseStatusBlok(ctx, ui, item, project, door);
      if (fase) return fase;
    }
    if (soort === 'concept') {
      var pub = conceptPubliceerBlok(ctx, ui, item, door);
      if (pub) return pub;
    }
    if (soort === 'factuur') {
      var fact = factuurPubliceerBlok(ctx, ui, item, door);
      if (fact) return fact;
    }
    /* de vijf klantacties uit 0021: elk paneel eindigt in klantSlot, dat bij
       een ontbrekende haak geen knop tekent maar het eerlijk zegt */
    if (soort === 'betaling') return betalingSlot(ctx, ui, item, door);
    if (soort === 'klantbestand') return klantbestandSlot(ctx, ui, item, project, door);
    if (soort === 'samplebeslissing') return samplebeslissingSlot(ctx, ui, item, project, door);
    if (soort === 'bezwaar') return bezwaarSlot(ctx, ui, item, door);
    if (soort === 'herbestelling') return herbestellingSlot(ctx, ui, item, project, door);
    return primaireKnop(ctx, ui, item, door);
  };

  /* de bestaande terugval: de primaire knop van primaireActie(), en als er
     geen haak én geen route is een uitgeschakelde knop met uitleg */
  var primaireKnop = function (ctx, ui, item, door) {
    var p = primaireActie(ctx, item);
    return ui.el('div', null, [
      ui.el('button', {
        type: 'button',
        class: 'u-btn breed',
        text: tekst(p.label),
        disabled: !!p.disabled,
        title: tekst(p.titel) || null,
        /* de uitkomst van de haak gaat door de doorsprong (voorstel 10);
           een sprong naar een route geeft niets terug en verplaatst niets */
        onclick: fn(p.onClick) ? function () { viaDoor(door, item, p.onClick()); } : null
      }),
      p.disabled
        ? ui.el('p', { class: 'u-sub', style: 'margin:10px 0 0;', text: tekst(p.titel) })
        : null
    ]);
  };

  /* HET ANTWOORDVELD (§5.2, en dezelfde vorm op projectdetail tab
     Communicatie).

     ÉÉN VERZENDWEG, EN DAT IS ER AL EEN. Het echte antwoordveld staat in
     beheer.html als antwoordVeldMaken(): één textarea, één verzendknop, en
     daarachter DS.answerQuestion → de klantmail → de badge. Hier een tweede
     textarea neerzetten die zijn tekst niet aan die ene weg kan doorgeven,
     zou een veld opleveren dat typen accepteert en het daarna weggooit. Het
     vak hieronder is daarom geen invoerveld dat doet alsof, maar de INGANG
     naar dat ene veld: hij ziet eruit als het veld dat je zo krijgt, hij
     zegt met zoveel woorden dat hij het antwoordveld opent, en hij opent
     precies dezelfde dialoog als de zwarte knop eronder.

     DE EERLIJKHEIDSREGEL DIE HET MIGRATIEPLAN VRAAGT (§5, rij "Open vragen
     met antwoordklok"): beantwoorden verstuurt ONVOORWAARDELIJK een mail
     naar de klant. Bij publiceren mag je kiezen tussen stil en met mail,
     hier niet — en dat verschil hoort zichtbaar te zijn vóór je klikt, niet
     erna. Bewerken is wél stil; dan staat die regel er.

     Zonder haak komt er geen veld: een antwoordvak dat nergens op uitkomt
     is erger dan geen antwoordvak. */
  var antwoordBlok = function (ctx, ui, item, stand, door) {
    var bewerken = stand === 'bewerken';
    var h = haak(ctx, bewerken ? HAKEN.antwoordBewerken : HAKEN.vraag);
    if (!h) return null;

    /* langs de doorsprong (voorstel 10): springt pas door als de haak een
       vervulde belofte teruggeeft — vandaag opent hij een venster en geeft
       hij niets terug, dus blijft de selectie staan */
    var open = function () { viaDoor(door, item, h(item)); };
    var titel = bewerken ? 'Antwoord bewerken' : 'Beantwoorden';

    /* het vak. .input geeft hem de vorm van een invoerveld uit de mockup; de
       twee eigenschappen die een <button> daarvan laten afwijken
       (gecentreerde tekst en één regel hoog) staan inline, want admin-ui.css
       heeft geen klasse voor "een vak dat een veld opent". De tekst staat in
       --ink-hint, de placeholderkleur van datzelfde stijlblad.
       De muisaanwijzer blijft bewust een WIJZER en wordt geen tekstcursor:
       hij is een knop die een veld opent, en een I-balk zou beloven dat je
       er meteen in kunt typen. */
    var vak = ui.el('button', {
      type: 'button',
      class: 'input',
      style: 'display:block;width:100%;text-align:left;min-height:96px;'
        + 'color:var(--ink-hint);',
      'aria-label': titel + ' — opent het antwoordveld',
      text: bewerken
        ? 'Het verstuurde antwoord aanpassen…'
        : 'Schrijf je antwoord aan de klant…',
      onclick: open
    });

    return ui.el('div', null, [
      ui.el('span', { class: 'u-kicker', text: 'Antwoord' }),
      ruimte(ui, 8),
      vak,
      ruimte(ui, 12),
      ui.el('button', { type: 'button', class: 'u-btn breed', text: titel, onclick: open }),
      ui.el('p', {
        class: 'u-sub', style: 'margin:10px 0 0;',
        text: bewerken
          ? 'Een correctie is stil: de klant krijgt géén nieuwe mail en ziet het aangepaste antwoord bij zijn volgende bezoek aan het portaal.'
          : 'Verzenden stuurt de klant altijd een mail. Anders dan bij publiceren is er hier geen keuze tussen stil en met bericht.'
      })
    ]);
  };

  /* DE FASEKNOP BIJ EEN GOEDKEURING.

     De statuskeuze is de zwaarste schrijfactie van de app: DS.setStageStatus,
     bij "wacht op akkoord" de automatische conceptfactuur met betaalpercentage
     en btw-modus, en daarna de mailkeuzedialoog. De haak draait die hele
     motor; hier staan alleen de keuzelijst en de knop, plus het terugspringen
     bij een fout — precies wat de oude fasebalk ook zelf deed.

     DE KNOP STAAT OP SLOT ZOLANG DE KEUZE NIET IS VERANDERD. Een fase op
     dezelfde status zetten zou de motor gewoon draaien: opnieuw schrijven,
     opnieuw een conceptfactuur, opnieuw een mailvraag. Dat is geen
     herhaling zonder gevolg. */
  var FASE_VOLGORDE = ['done', 'current', 'awaiting_approval', 'upcoming'];

  var faseStatusBlok = function (ctx, ui, item, project, door) {
    var h = haak(ctx, HAKEN.faseStatus);
    if (!h) return null;
    var s = opt(item.raw);
    var huidig = tekst(s.status) || 'awaiting_approval';
    var faseNaam = faseNaamVan(ctx);
    var naam = faseNaam(s.stageKey);

    var sel = ui.el('select', {
      class: 'input',
      style: 'width:100%;',
      'aria-label': 'Nieuwe status van fase ' + naam
    });
    FASE_VOLGORDE.forEach(function (k) {
      var optie = ui.el('option', { value: k, text: faseStand(k).woord });
      if (k === huidig) optie.selected = true;
      sel.appendChild(optie);
    });

    var knop = ui.el('button', {
      type: 'button', class: 'u-btn breed', text: 'Fasestatus bijwerken',
      disabled: true,
      onclick: function () {
        var nieuw = tekst(sel.value);
        if (nieuw === huidig) return;
        knop.disabled = true;
        viaDoor(door, item, h(item, null, nieuw, function () {
          /* bijFout: de keuzelijst springt terug naar de opgeslagen stand,
             zodat het scherm nooit een status toont die er niet staat */
          sel.value = huidig;
          knop.disabled = true;
        }));
      }
    });
    sel.addEventListener('change', function () {
      knop.disabled = (tekst(sel.value) === huidig);
    });

    return ui.el('div', null, [
      ui.el('span', { class: 'u-kicker', text: 'Fase ' + naam }),
      ruimte(ui, 8),
      sel,
      ruimte(ui, 12),
      knop,
      ui.el('p', {
        class: 'u-sub', style: 'margin:10px 0 0;',
        text: 'Bij "Wacht op akkoord" maakt het beheer automatisch de conceptfactuur voor het betaalmoment van deze fase aan; daarna vraagt het of '
          + (project ? tekst(project.name) : 'dit project')
          + ' een klantmail krijgt. Gaat er iets mis, dan springt de keuze terug.'
      })
    ]);
  };

  /* een concept publiceren: het bestaande publiceervenster draagt de keuze
     tussen stil publiceren en publiceren mét klantmail. Die keuze wordt hier
     niet nagebouwd — hij staat één regel eronder beschreven zodat je weet
     wat je krijgt. */
  var conceptPubliceerBlok = function (ctx, ui, item, door) {
    var h = haak(ctx, HAKEN.concept);
    if (!h) return null;
    var r = opt(item.raw);
    return ui.el('div', null, [
      ui.el('button', {
        type: 'button', class: 'u-btn breed', text: 'Publiceren',
        onclick: function () { viaDoor(door, item, h(item)); }
      }),
      ui.el('p', {
        class: 'u-sub', style: 'margin:10px 0 0;',
        text: r.scheduledAt
          ? 'Dit concept staat al ingepland. Publiceren opent hetzelfde venster; kies daar of de klant een mail krijgt of dat het stil gebeurt.'
          : 'In het venster kies je of de klant een mail krijgt of dat het stil gebeurt. Inplannen voor later staat in het ••• hierboven.'
      })
    ]);
  };

  /* een conceptfactuur: publiceren geeft het nummer uit, maakt het document
     en stuurt de klantmail. De blokkade bij bedrag nul zit in dat venster en
     wordt hier niet nagedaan. */
  var factuurPubliceerBlok = function (ctx, ui, item, door) {
    var h = haak(ctx, HAKEN.factuurPubliceren);
    if (!h) return null;
    return ui.el('div', null, [
      ui.el('button', {
        type: 'button', class: 'u-btn breed', text: 'Conceptfactuur publiceren',
        onclick: function () { viaDoor(door, item, h(item)); }
      }),
      ui.el('p', {
        class: 'u-sub', style: 'margin:10px 0 0;',
        text: 'Publiceren geeft het factuurnummer uit, maakt het factuurdocument en stuurt de klant het bericht. Regels aanpassen doe je eerst in de factuureditor — die staat in het ••• hierboven.'
      })
    ]);
  };

  var chipLabel = function (ctx, chip) {
    var m = MOD(ctx);
    var tabel = (m && Array.isArray(m.INBOX_CHIPS)) ? m.INBOX_CHIPS : [];
    for (var i = 0; i < tabel.length; i++) {
      if (tabel[i].key === chip) return tabel[i].label;
    }
    return 'Inbox';
  };

  /* --- aanvraag (site-brief) ---
     De brief IS het bericht dat de klant stuurde, dus hij staat in dezelfde
     gespreksweergave als een klantvraag: één beurt, van de klant. */
  var briefInhoud = function (ctx, ui, item) {
    var r = opt(item.raw);
    var draad = ui.thread({
      berichten: [{
        auteur: eersteTekst(r.name, 'Onbekende afzender'),
        organisatie: tekst(r.company),
        tekst: tekst(r.product) || 'Deze aanvraag bevat geen omschrijving.',
        at: r.createdAt,
        vanKlant: true
      }],
      formatteerTijd: function (at) { return tijdTekst(ctx, at); }
    });

    var bestanden = lijst(r.files);
    if (!bestanden.length) return draad;

    var rijen = bestanden.map(function (f) {
      return ui.entityRow({
        thumb: ui.iconTile({ icoon: 'bestand', toon: 'neutraal', maat: 40 }),
        titel: tekst(f.name),
        sub: samen([tekst(f.type), bestandsGrootte(ctx, f.size),
          tekst(f.path) ? '' : 'bestand nog niet beschikbaar'])
      });
    });

    return ui.el('div', null, [
      draad,
      ruimte(ui, 20),
      ui.sectionHead({ titel: 'Bijlagen' }),
      ui.entityList(rijen, { leegTitel: 'Geen bijlagen' })
    ]);
  };

  /* de grootte van een bijlage. Het veld staat in bytes; boven de duizend
     kilobyte wordt het megabyte, want "2.324 kB" met een duizendpunt is op
     één regel niet te onderscheiden van 2,3 kB. Er wordt hier gedeeld en
     niet geschat: de bron blijft het echte bytegetal. */
  var bestandsGrootte = function (ctx, bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n <= 0) return '';
    var kb = n / 1024;
    if (kb < 1000) return getalTekst(ctx, Math.round(kb)) + ' kB';
    var c = CH(ctx);
    var mb = kb / 1024;
    return (c && fn(c.getal) ? tekst(c.getal(mb, 1)) : String(Math.round(mb))) + ' MB';
  };

  var briefCellen = function (ctx, item) {
    var r = opt(item.raw);
    return [
      { icoon: 'gebruiker', label: 'Contactpersoon', waarde: tekst(r.name) },
      { icoon: 'relaties', label: 'Bedrijf', waarde: tekst(r.company) },
      { icoon: 'mail', label: 'E-mail', waarde: tekst(r.email) },
      { icoon: 'locatie', label: 'Land', waarde: tekst(r.country) },
      { icoon: 'extern', label: 'Bron', waarde: tekst(r.source), leegTekst: 'Onbekend' },
      { icoon: 'kalender', label: 'Ontvangen', waarde: tijdTekst(ctx, r.createdAt) },
      { icoon: 'bestand', label: 'Taal van de aanvraag', waarde: tekst(r.lang).toUpperCase() },
      {
        icoon: 'vinkje', label: 'Stand',
        waarde: tekst(r.status) === 'omgezet' ? 'Omgezet naar klant en project' : 'Nog niet omgezet',
        toon: tekst(r.status) === 'omgezet' ? 'klaar' : 'wacht'
      }
    ];
  };

  /* --- klantvraag ---
     De gespreksdraad komt uit CP_DATA.threadOf. Zijn er echte berichten
     (question_messages), dan zijn dat de draad; zijn die er niet, dan bouwt
     threadOf hem uit de bestaande vraag- en antwoordkolommen — dezelfde
     omzetting als de migratie, dus de weergave is vóór en na het draaien
     van die migratie gelijk. */
  var vraagInhoud = function (ctx, ui, item, klant) {
    var data = DAT(ctx);
    var d = D(ctx);
    var q = opt(item.raw);
    var berichten = (data && fn(data.threadOf))
      ? data.threadOf(q, lijst(d.questionMessages), {
        klantNaam: eersteTekst(klant && klant.contactName, klantNaam(klant)),
        beheerNaam: eigenaarNaam(ctx)
      })
      : [];

    return ui.thread({
      berichten: berichten.map(function (b) {
        return {
          auteur: eersteTekst(b.authorName, b.author === 'client' ? klantNaam(klant) : 'Beheer'),
          organisatie: b.author === 'client' ? klantNaam(klant) : '',
          tekst: tekst(b.body),
          at: b.createdAt,
          vanKlant: b.author === 'client'
        };
      }),
      formatteerTijd: function (at) { return tijdTekst(ctx, at); },
      leegTekst: 'Nog geen berichten in dit gesprek'
    });
  };

  var vraagCellen = function (ctx, item, project, klant) {
    var m = MOD(ctx);
    var q = opt(item.raw);
    var deadline = (m && fn(m.answerDeadlineISO) && !q.answeredAt) ? m.answerDeadlineISO(q.askedAt) : null;
    var vandaag = dagVan(ctx, nuVan(ctx));
    var faseNaam = faseNaamVan(ctx);
    return [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Project', waarde: project ? tekst(project.name) : '' },
      { icoon: 'vinkje', label: 'Fase', waarde: q.stageKey ? faseNaam(q.stageKey) : '' },
      { icoon: 'kalender', label: 'Gesteld op', waarde: tijdTekst(ctx, q.askedAt) },
      {
        icoon: 'klok', label: 'Antwoord voor',
        waarde: deadline ? datumTekst(ctx, deadline) : '',
        leegTekst: q.answeredAt ? 'Beantwoord' : 'Geen termijn',
        toon: deadline ? (deadline < vandaag ? 'kritiek' : 'wacht') : 'klaar'
      },
      {
        icoon: 'mail', label: 'Stand',
        waarde: q.answeredAt ? 'Beantwoord op ' + tijdTekst(ctx, q.answeredAt) : 'Nog niet beantwoord',
        toon: q.answeredAt ? 'klaar' : 'wacht'
      }
    ];
  };

  /* --- goedkeuring (fase op akkoord) ---
     Er is geen gespreksdraad bij een fase, en er wordt er ook geen
     verzonnen: het paneel toont wat er wél is — welke fase, in welk
     project, sinds wanneer, en wat er aan geld aan hangt. */
  var faseInhoud = function (ctx, ui, item, project) {
    var d = D(ctx);
    var s = opt(item.raw);
    var faseNaam = faseNaamVan(ctx);
    var factuur = null;
    lijst(d.invoices).forEach(function (inv) {
      if (factuur || !inv) return;
      if (inv.projectId === item.projectId && inv.stageKey === s.stageKey) factuur = inv;
    });

    var regels = [
      ui.el('p', {
        class: 'u-lees', style: 'margin:0 0 14px;',
        text: 'Deze fase staat op "wacht op akkoord". Zolang de klant niet aftekent, blijft hij hier staan; er is voor jou pas weer iets te doen zodra dat akkoord binnen is.'
      })
    ];
    if (factuur) {
      var data = DAT(ctx);
      var cents = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(factuur) : getal(factuur.amountCents, 0);
      regels.push(ui.el('p', {
        class: 'u-lees', style: 'margin:0;',
        text: 'Aan deze fase hangt de factuur "' + tekst(factuur.label) + '" van ' + bedragTekst(ctx, cents) + '.'
      }));
    }

    return ui.el('div', null, [
      ui.el('div', { class: 'u-preview' }, [
        ui.el('span', { class: 'u-preview-kop', text: 'Wat er op akkoord wacht' }),
        ui.el('span', { class: 'u-row-title', text: faseNaam(s.stageKey) }),
        ui.el('span', { class: 'u-row-sub', text: project ? tekst(project.name) : '' })
      ]),
      ruimte(ui, 18),
      ui.el('div', null, regels)
    ]);
  };

  var faseCellen = function (ctx, item, project, klant) {
    var s = opt(item.raw);
    var faseNaam = faseNaamVan(ctx);
    var stand = faseStand(s.status || 'awaiting_approval');
    return [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Project', waarde: project ? tekst(project.name) : '' },
      { icoon: 'vinkje', label: 'Fase', waarde: faseNaam(s.stageKey) },
      { icoon: 'financien', label: 'Betaalmoment', waarde: getal(s.paymentPct, 0) ? getal(s.paymentPct, 0) + '%' : '', leegTekst: 'Geen betaalmoment' },
      { icoon: 'kalender', label: 'Goedgekeurd op', waarde: s.approvedAt ? datumTekst(ctx, s.approvedAt) : '', leegTekst: 'Nog niet' },
      { icoon: 'klok', label: 'Stand', waarde: stand.woord, toon: stand.toon }
    ];
  };

  /* --- concept en conceptfactuur ---
     De previewkaart is §4.19: laten zien wat de KLANT straks ziet. Dat is
     precies wat de IA-spec bij een conceptpublicatie vraagt. */
  var conceptInhoud = function (ctx, ui, item) {
    var r = opt(item.raw);
    var isFactuur = item.kind === 'factuur';

    var kinderen = [];
    if (!isFactuur && tekst(r.src)) {
      kinderen.push(ui.el('img', {
        src: tekst(r.src), alt: '',
        style: 'display:block;width:100%;border-radius:14px;',
        loading: 'lazy'
      }));
    }
    /* een foto heeft alleen een caption en een document alleen een titel;
       de kop pakt de eerste die er is. Het bijschrift eronder verschijnt
       dus alleen als het ECHT iets anders zegt dan de kop — anders staat
       dezelfde zin twee keer in de voorbeeldkaart. */
    var kopTekst = eersteTekst(r.title, r.label, r.caption, r.name, isFactuur ? 'Conceptfactuur' : 'Concept');
    kinderen.push(ui.el('span', { class: 'u-row-title', text: kopTekst }));
    if (tekst(r.caption) && tekst(r.caption) !== kopTekst) {
      kinderen.push(ui.el('span', { class: 'u-row-sub', text: tekst(r.caption) }));
    }
    if (isFactuur) {
      var data = DAT(ctx);
      var cents = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(r) : getal(r.amountCents, 0);
      kinderen.push(ui.el('span', { class: 'u-groot', text: bedragTekst(ctx, cents) }));
    }

    return ui.el('div', null, [
      ui.previewCard({ titel: 'Zo ziet de klant dit straks', kinderen: kinderen }),
      r.scheduledAt ? ui.el('p', {
        class: 'u-lees', style: 'margin:18px 0 0;',
        text: 'Dit concept staat ingepland voor ' + tijdTekst(ctx, r.scheduledAt)
          + '. De publicatie gebeurt bij het eerstvolgende bezoek aan het beheer; er draait geen server die dat op het moment zelf doet.'
      }) : null
    ]);
  };

  var conceptCellen = function (ctx, item, project, klant) {
    var r = opt(item.raw);
    var isFactuur = item.kind === 'factuur';
    var data = DAT(ctx);
    var cellen = [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Project', waarde: project ? tekst(project.name) : '' },
      { icoon: 'bestand', label: 'Soort', waarde: isFactuur ? 'Conceptfactuur' : (tekst(r.src) ? 'Foto' : 'Document') },
      { icoon: 'kalender', label: 'Aangemaakt', waarde: tijdTekst(ctx, r.createdAt || r.capturedAt) },
      {
        icoon: 'klok', label: 'Publicatiemoment',
        waarde: r.scheduledAt ? tijdTekst(ctx, r.scheduledAt) : '',
        leegTekst: 'Nog niet ingepland',
        toon: r.scheduledAt ? 'extern' : 'wacht'
      }
    ];
    if (isFactuur) {
      var cents = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(r) : getal(r.amountCents, 0);
      cellen.push({ icoon: 'financien', label: 'Bedrag', waarde: bedragTekst(ctx, cents) });
      cellen.push({ icoon: 'bestand', label: 'Factuurnummer', waarde: tekst(r.invoiceNumber), leegTekst: 'Nog geen nummer' });
    }
    return cellen;
  };

  /* ---------------------------------------------------------------
     DE VIJF KLANTACTIES UIT 0021 — DE DETAILPANELEN

     Eén vorm voor alle vijf, dezelfde als de vier bestaande panelen: een
     voorbeeldkaart met wat de klant precies deed, daaronder de opmerking van
     de klant als CITAAT (thread, van de klant), dan de feiten in metaGrid en
     onderaan één primaire en één secundaire knop (klantSlot).
     NIETS HIER IS VERZONNEN: elk getal komt van de rij zelf of van de factuur
     of het project waar de rij aan hangt. Wat er niet is (de reden van een
     bezwaar zonder factuurlogboek, een factuur die niet in de lijst staat)
     staat er in woorden en niet als plaatsvervanger.
     --------------------------------------------------------------- */

  /* geld in een andere munt dan euro: CP_CHART.bedrag kent alleen het
     euroteken, dus voor USD/CNY komt de ISO-code ervoor — dezelfde keuze als
     formatCents in admin-model.js, zodat de titel van het item en het bedrag
     in het paneel niet twee schrijfwijzen hebben. */
  var geldTekst = function (ctx, centen, munt) {
    var code = tekst(munt).toUpperCase();
    if (!code || code === 'EUR') return bedragTekst(ctx, centen);
    var c = CH(ctx);
    return code + ' ' + ((c && fn(c.bedrag)) ? tekst(c.bedrag(centen)) : tekst(centen));
  };

  /* wat er op een factuur nog openstaat, in centen — of null als het niet
     te zeggen is. De factuurmodule zet outstandingCents; een factuur van vóór
     die module heeft alleen amountCents en paidAt, en dan is "open" het hele
     bedrag zolang hij niet betaald is. Er wordt hier niets geschat. */
  var openstaandCents = function (ctx, inv) {
    if (!inv) return null;
    if (typeof inv.outstandingCents === 'number') return inv.outstandingCents;
    var data = DAT(ctx);
    var totaal = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv.amountCents, 0);
    if (typeof inv.paidCents === 'number') return totaal - inv.paidCents - getal(inv.creditedCents, 0);
    if (inv.paidAt) return 0;
    return totaal;
  };

  var factuurNaamVan = function (inv) {
    if (!inv) return '';
    return eersteTekst(inv.invoiceNumber, inv.label, inv.id);
  };

  /* één bericht van de klant in de gespreksvorm van §4 (thread): de
     klantopmerking bij een bestand, een sample, een bezwaar of een
     herbestelling is een citaat en hoort er als citaat te staan — niet als
     een regel die van het beheer lijkt te komen. Zonder tekst geen blok. */
  var klantBericht = function (ctx, ui, klant, body, at) {
    if (!tekst(body)) return null;
    return ui.thread({
      berichten: [{
        auteur: eersteTekst(klant && klant.contactName, klantNaam(klant), 'Klant'),
        organisatie: klantNaam(klant),
        tekst: tekst(body),
        at: at,
        vanKlant: true
      }],
      formatteerTijd: function (t) { return tijdTekst(ctx, t); }
    });
  };

  /* de voorbeeldkaart "wat de klant deed": dezelfde .u-preview als faseInhoud */
  var klantVoorbeeld = function (ui, kop, titel, sub, extra) {
    return ui.el('div', { class: 'u-preview' }, [
      ui.el('span', { class: 'u-preview-kop', text: tekst(kop) }),
      ui.el('span', { class: 'u-row-title', text: tekst(titel) }),
      tekst(sub) ? ui.el('span', { class: 'u-row-sub', text: tekst(sub) }) : null,
      isNode(extra) ? extra : null
    ]);
  };

  var leesRegel = function (ui, t, marge) {
    return ui.el('p', { class: 'u-lees', style: 'margin:' + (tekst(marge) || '0 0 12px') + ';', text: tekst(t) });
  };

  var NIET_BESCHIKBAAR = 'Deze actie is in deze versie nog niet beschikbaar.';

  /* DE AFSLUITING VAN EEN KLANTACTIE: één primaire knop, één secundaire.
     spec.primair / spec.secundair zijn elk óf {haak, label, doe} (een haak
     uit HAKEN; `doe(h)` mag de aanroep bepalen, anders h(item)) óf {label,
     onClick} (een sprong). Bestaat een haak niet in ctx.acties, dan komt er
     op die plek GEEN knop maar de regel "nog niet beschikbaar" — eerlijk, en
     nooit een crash. Alleen de PRIMAIRE loopt door de doorsprong (voorstel
     10): dat is de afhandeling; de secundaire is een sprong of een
     tussenstap waarna je het item juist wilt blijven zien. */
  var klantSlot = function (ctx, ui, item, door, spec) {
    var s = opt(spec);
    var kinderen = [];

    var knop = function (k, klasse, primair) {
      if (!k) return;
      if (k.haak) {
        var h = haak(ctx, k.haak);
        if (!h) {
          kinderen.push(ui.el('p', { class: 'u-sub', style: 'margin:0;', text: NIET_BESCHIKBAAR }));
          return;
        }
        kinderen.push(ui.el('button', {
          type: 'button', class: klasse, text: tekst(k.label),
          onclick: function () {
            var uit = fn(k.doe) ? k.doe(h) : h(item);
            if (primair) viaDoor(door, item, uit);
          }
        }));
        return;
      }
      if (fn(k.onClick)) {
        kinderen.push(ui.el('button', { type: 'button', class: klasse, text: tekst(k.label), onclick: k.onClick }));
      }
    };

    knop(s.primair, 'u-btn breed', true);
    knop(s.secundair, 'u-btn ghost breed', false);
    if (tekst(s.uitleg)) {
      kinderen.push(ui.el('p', { class: 'u-sub', style: 'margin:4px 0 0;', text: tekst(s.uitleg) }));
    }
    return ui.el('div', { style: 'display:flex;flex-direction:column;gap:10px;' }, kinderen);
  };

  var projectSprong = function (ctx, project, tab) {
    if (!project) return null;
    return {
      label: 'Open project',
      onClick: function () { navigeer(ctx, { area: 'projecten', id: project.id, tab: tekst(tab) || 'overzicht' }); }
    };
  };
  var factuurSprong = function (ctx, factuurId) {
    if (!tekst(factuurId)) return null;
    return {
      label: 'Open factuur',
      onClick: function () { navigeer(ctx, { area: 'factuur', id: tekst(factuurId) }); }
    };
  };

  /* --- betaling gemeld ---
     BRON: de invoice_payments-rij (item.raw) en de factuur waar hij naar
     wijst. De melding is een VOORSTEL: het saldo telt hem pas mee na
     bevestigen (0021, verify_payment_report). Het verschil tussen gemeld en
     openstaand wordt alleen benoemd als beide in dezelfde munt staan —
     anders is het geen verschil maar een vergelijking van appels en peren. */
  var betalingFeiten = function (ctx, item) {
    var d = D(ctx);
    var p = opt(item.raw);
    var inv = tekst(p.invoiceId) ? (indexOp(lijst(d.invoices), 'id')[p.invoiceId] || null) : null;
    var gemeld = getal(p.amountCents, 0);
    var open = openstaandCents(ctx, inv);
    var muntGemeld = tekst(p.currency || (inv && inv.currency) || 'EUR').toUpperCase();
    var muntFactuur = tekst((inv && inv.currency) || muntGemeld).toUpperCase();
    var vergelijkbaar = (open !== null) && muntGemeld === muntFactuur;
    return {
      p: p, inv: inv, gemeld: gemeld, open: open, munt: muntGemeld,
      verschil: vergelijkbaar ? gemeld - open : null
    };
  };

  var betalingInhoud = function (ctx, ui, item) {
    var f = betalingFeiten(ctx, item);
    var p = f.p;
    var regels = [];

    if (f.inv) {
      regels.push(leesRegel(ui, 'Op factuur "' + factuurNaamVan(f.inv) + '" staat '
        + (f.open === null ? 'een onbekend bedrag' : geldTekst(ctx, f.open, f.inv.currency)) + ' open.'));
      if (f.verschil === 0) {
        regels.push(leesRegel(ui, 'Het gemelde bedrag is precies het openstaande bedrag.'));
      } else if (f.verschil !== null && f.verschil > 0) {
        regels.push(leesRegel(ui, 'De klant meldt ' + geldTekst(ctx, f.verschil, f.munt)
          + ' méér dan er openstaat. Controleer of er een tweede factuur bij hoort of dat het bedrag verkeerd is ingevuld voordat je bevestigt.'));
      } else if (f.verschil !== null && f.verschil < 0) {
        regels.push(leesRegel(ui, 'De klant meldt ' + geldTekst(ctx, -f.verschil, f.munt)
          + ' minder dan er openstaat. Na bevestigen blijft er ' + geldTekst(ctx, -f.verschil, f.munt) + ' open op deze factuur.'));
      } else if (f.open !== null) {
        regels.push(leesRegel(ui, 'De melding staat in een andere munt dan de factuur; het verschil is daarom niet te berekenen.'));
      }
    } else {
      regels.push(leesRegel(ui, 'De factuur van deze melding (' + eersteTekst(p.invoiceId, 'zonder id')
        + ') staat niet in de lijst. Bevestigen kan pas als die factuur er weer is.'));
    }
    regels.push(leesRegel(ui, 'Bevestigen opent het betaalvenster met datum, bedrag en kenmerk voorgevuld. Pas na opslaan telt de betaling mee op de factuur; tot dan is dit een melding en geen boeking.', '0'));

    return ui.el('div', null, [
      klantVoorbeeld(ui, 'Wat de klant meldde',
        geldTekst(ctx, f.gemeld, f.munt) + ' overgemaakt' + (p.paidOn ? ' op ' + datumTekst(ctx, p.paidOn) : ''),
        samen([p.clientReference ? 'kenmerk ' + tekst(p.clientReference) : 'zonder kenmerk', tekst(p.method)])),
      ruimte(ui, 18),
      ui.el('div', null, regels)
    ]);
  };

  var betalingCellen = function (ctx, item, project, klant) {
    var f = betalingFeiten(ctx, item);
    var p = f.p;
    return [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Project', waarde: project ? tekst(project.name) : '' },
      { icoon: 'financien', label: 'Factuur', waarde: factuurNaamVan(f.inv), leegTekst: 'Niet gevonden' },
      { icoon: 'financien', label: 'Bedrag gemeld', waarde: geldTekst(ctx, f.gemeld, f.munt) },
      {
        icoon: 'financien', label: 'Openstaand',
        waarde: f.open === null ? '' : geldTekst(ctx, f.open, f.inv && f.inv.currency),
        leegTekst: 'Onbekend',
        toon: f.verschil === 0 ? 'klaar' : (f.verschil === null ? 'neutraal' : 'wacht')
      },
      { icoon: 'kalender', label: 'Overgemaakt op', waarde: p.paidOn ? datumTekst(ctx, p.paidOn) : '', leegTekst: 'Geen datum' },
      { icoon: 'klok', label: 'Gemeld op', waarde: tijdTekst(ctx, p.createdAt) },
      { icoon: 'bestand', label: 'Kenmerk', waarde: tekst(p.clientReference), leegTekst: 'Zonder kenmerk' },
      {
        icoon: 'vinkje', label: 'Stand',
        waarde: p.verifiedAt ? 'Bevestigd op ' + tijdTekst(ctx, p.verifiedAt) : 'Nog niet bevestigd',
        toon: p.verifiedAt ? 'klaar' : 'wacht'
      }
    ];
  };

  var betalingSlot = function (ctx, ui, item, door) {
    var f = betalingFeiten(ctx, item);
    return klantSlot(ctx, ui, item, door, {
      primair: { haak: HAKEN.betaling, label: PRIMAIR_LABEL.betaling },
      secundair: factuurSprong(ctx, f.p.invoiceId),
      uitleg: 'Bevestigen boekt de betaling op de factuur en sluit deze melding af.'
    });
  };

  /* --- bestand van de klant ---
     BRON: de documentrij (uploadedBy 'klant', clientNote, slotId) en het slot
     dat hij vult. Er is geen "gezien"-veld in de database; het item valt na
     zeven dagen vanzelf uit de Inbox (collectInbox zegt waarom). */
  var slotVanDocument = function (ctx, doc) {
    var slots = slotsVan(D(ctx));
    var uit = null;
    slots.forEach(function (s) {
      if (uit || !s) return;
      if ((doc.slotId && s.id === doc.slotId) || (s.documentId && s.documentId === doc.id)) uit = s;
    });
    return uit;
  };

  var klantbestandInhoud = function (ctx, ui, item, klant) {
    var doc = opt(item.raw);
    var slot = slotVanDocument(ctx, doc);
    var faseNaam = faseNaamVan(ctx);
    return ui.el('div', null, [
      klantVoorbeeld(ui, 'Wat de klant aanleverde',
        eersteTekst(doc.title, doc.fileName, 'Bestand zonder titel'),
        samen([tekst(doc.fileName), bestandsGrootte(ctx, doc.fileSize), tekst(doc.mimeType)])),
      ruimte(ui, 18),
      klantBericht(ctx, ui, klant, doc.clientNote, doc.createdAt),
      tekst(doc.clientNote) ? ruimte(ui, 18) : null,
      leesRegel(ui, slot
        ? 'Dit bestand vult het slot "' + eersteTekst(slot.docType, doc.docType, 'bestand') + '"'
          + (slot.stageKey ? ' in de fase ' + faseNaam(slot.stageKey) : '') + ', dat je voor de klant had klaargezet.'
        : 'Dit bestand hangt niet aan een klaargezet slot; de klant leverde het los aan.'),
      leesRegel(ui, 'Bekijken opent het documentvenster met het herkomstblok "Van de klant" en de bestandslink. Er is geen vinkje "gezien": dit item verdwijnt na zeven dagen vanzelf uit de Inbox, of eerder als je het uitstelt.', '0')
    ]);
  };

  var klantbestandCellen = function (ctx, item, project, klant) {
    var doc = opt(item.raw);
    var slot = slotVanDocument(ctx, doc);
    var faseNaam = faseNaamVan(ctx);
    var zichtbaar = tekst(doc.publishStatus);
    return [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Project', waarde: project ? tekst(project.name) : '' },
      { icoon: 'vinkje', label: 'Fase', waarde: doc.stageKey ? faseNaam(doc.stageKey) : '', leegTekst: 'Geen fase' },
      { icoon: 'bestand', label: 'Slot', waarde: slot ? eersteTekst(slot.docType, doc.docType) : '', leegTekst: 'Los aangeleverd' },
      { icoon: 'bestand', label: 'Bestandsnaam', waarde: tekst(doc.fileName), leegTekst: 'Onbekend' },
      { icoon: 'bestand', label: 'Grootte', waarde: bestandsGrootte(ctx, doc.fileSize), leegTekst: 'Onbekend' },
      { icoon: 'kalender', label: 'Aangeleverd op', waarde: tijdTekst(ctx, doc.createdAt) },
      {
        icoon: 'extern', label: 'Zichtbaar voor de klant',
        waarde: zichtbaar === 'concept' ? 'Nee, concept' : (zichtbaar ? 'Ja' : ''),
        leegTekst: 'Onbekend',
        toon: zichtbaar === 'concept' ? 'neutraal' : 'klaar'
      }
    ];
  };

  var klantbestandSlot = function (ctx, ui, item, project, door) {
    return klantSlot(ctx, ui, item, door, {
      primair: { haak: HAKEN.klantbestand, label: PRIMAIR_LABEL.klantbestand },
      secundair: projectSprong(ctx, project, 'bestanden')
    });
  };

  /* --- samplebeslissing ---
     BRON: de sampleronde met clientDecision, clientNote, clientDecidedAt en
     clientMarks (0021). 0021 kent twee beslissingen: 'goedgekeurd' en
     'aanpassing'. Een derde waarde (een latere 'afgekeurd') komt hier niet
     als "onbekend" op het scherm maar als wat hij is: een beslissing die om
     een nieuwe ronde vraagt. collectInbox maakt vandaag alleen van
     'aanpassing' een item; de andere takken staan er zodat het paneel niet
     hoeft te veranderen als dat ooit anders wordt. */
  var BESLISSING = {
    goedgekeurd: { woord: 'Goedgekeurd door de klant', toon: 'klaar' },
    aanpassing: { woord: 'Aanpassing gevraagd', toon: 'wacht' },
    afgekeurd: { woord: 'Afgekeurd door de klant', toon: 'kritiek' }
  };
  var beslissingVan = function (sm) {
    var k = tekst(sm && sm.clientDecision);
    if (!k) return { key: '', woord: 'Nog geen beslissing', toon: 'neutraal' };
    var b = eigenVeld(BESLISSING, k) || { woord: 'Beslissing: ' + k, toon: 'wacht' };
    return { key: k, woord: b.woord, toon: b.toon };
  };

  var samplebeslissingInhoud = function (ctx, ui, item, klant) {
    var d = D(ctx);
    var sm = opt(item.raw);
    var b = beslissingVan(sm);
    var foto = '';
    lijst(d.media).forEach(function (m) {
      if (!foto && m && m.id === sm.mediaId) foto = tekst(m.src);
    });
    var marks = lijst(sm.clientMarks).filter(function (mk) { return isObj(mk); });

    var uitleg;
    if (b.key === 'aanpassing') {
      uitleg = 'De klant wil een aanpassing: de bal ligt bij jou. Verwerken opent het rondevenster voor een NIEUWE ronde met deze opmerking als startpunt; deze ronde zelf blijft zoals hij was.';
    } else if (b.key === 'goedgekeurd') {
      uitleg = 'De klant heeft deze ronde goedgekeurd. Er is hier niets meer te doen behalve doorgaan met het project; de ronde staat op goedgekeurd.';
    } else if (b.key) {
      uitleg = 'De klant heeft deze ronde afgekeurd. Er is een nieuwe sampleronde nodig; die maak je in het project.';
    } else {
      uitleg = 'De klant heeft nog niet gekozen.';
    }

    var markLijst = marks.length ? ui.el('div', null, [
      ui.el('span', { class: 'u-kicker', text: nlAantal(marks.length, 'aanwijzing op de foto', 'aanwijzingen op de foto') }),
      ui.el('ul', { class: 'u-lees', style: 'margin:8px 0 0;padding-left:20px;' }, marks.map(function (mk, i) {
        var plek = (typeof mk.x === 'number' && typeof mk.y === 'number')
          ? ' — op ' + Math.round(mk.x * 100) + '% van links, ' + Math.round(mk.y * 100) + '% van boven'
          : '';
        return ui.el('li', { text: (tekst(mk.tekst) || ('Aanwijzing ' + (i + 1))) + plek });
      }))
    ]) : null;

    return ui.el('div', null, [
      ui.el('div', { style: 'display:flex;gap:18px;align-items:flex-start;' }, [
        foto ? ui.el('img', {
          src: foto, alt: '', loading: 'lazy',
          style: 'width:120px;height:120px;border-radius:14px;object-fit:cover;flex:none;'
        }) : null,
        klantVoorbeeld(ui, 'Wat de klant besliste', 'Ronde ' + tekst(sm.roundLabel), tekst(sm.note),
          ui.el('div', { style: 'margin-top:10px;' }, ui.statusDot({ toon: b.toon, label: b.woord })))
      ]),
      ruimte(ui, 18),
      klantBericht(ctx, ui, klant, sm.clientNote, sm.clientDecidedAt),
      tekst(sm.clientNote) ? ruimte(ui, 18) : null,
      markLijst,
      markLijst ? ruimte(ui, 18) : null,
      leesRegel(ui, uitleg, '0')
    ]);
  };

  var samplebeslissingCellen = function (ctx, item, project, klant) {
    var sm = opt(item.raw);
    var b = beslissingVan(sm);
    var st = eigenVeld(SAMPLE_STAND, tekst(sm.status)) || { woord: tekst(sm.status), toon: 'neutraal' };
    var marks = lijst(sm.clientMarks).length;
    return [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Project', waarde: project ? tekst(project.name) : '' },
      { icoon: 'camera', label: 'Ronde', waarde: tekst(sm.roundLabel) },
      { icoon: 'vinkje', label: 'Beslissing', waarde: b.woord, toon: b.toon },
      { icoon: 'kalender', label: 'Beslist op', waarde: sm.clientDecidedAt ? tijdTekst(ctx, sm.clientDecidedAt) : '', leegTekst: 'Onbekend' },
      { icoon: 'camera', label: 'Aanwijzingen op de foto', waarde: marks ? String(marks) : '', leegTekst: 'Geen' },
      { icoon: 'klok', label: 'Ronde van', waarde: sm.roundDate ? datumTekst(ctx, sm.roundDate) : '' },
      { icoon: 'klok', label: 'Stand van de ronde', waarde: st.woord, toon: st.toon }
    ];
  };

  var samplebeslissingSlot = function (ctx, ui, item, project, door) {
    var b = beslissingVan(opt(item.raw));
    if (b.key === 'aanpassing') {
      return klantSlot(ctx, ui, item, door, {
        primair: { haak: HAKEN.samplebeslissing, label: PRIMAIR_LABEL.samplebeslissing },
        secundair: projectSprong(ctx, project, 'overzicht'),
        uitleg: 'Verwerken maakt een nieuwe ronde aan met de opmerking van de klant als startpunt.'
      });
    }
    /* goedgekeurd of afgekeurd: er is geen haak die iets afhandelt — bij
       goedgekeurd is er niets te doen, bij afgekeurd maak je de nieuwe ronde
       in het project. De primaire knop is dan de sprong daarheen. */
    var sprong = projectSprong(ctx, project, 'overzicht');
    return klantSlot(ctx, ui, item, door, {
      primair: sprong,
      secundair: null,
      uitleg: b.key === 'goedgekeurd'
        ? 'Niets te doen: de ronde is goedgekeurd. Open het project om door te gaan.'
        : (b.key ? 'Een nieuwe sampleronde is nodig; die maak je op de tab Overzicht van het project.' : '')
    });
  };

  /* --- bezwaar op een factuur ---
     BRON: de factuur (statusCode 'disputed', reminderPaused) en de reden uit
     het factuurlogboek (event 'bezwaar_klant'), als die lijst er is.
     iaLaadLijsten levert invoiceAudit vandaag niet mee; dan zegt het paneel
     waar de reden staat in plaats van hem te verzinnen.
     De herinneringen staan echt stil: invoice-reminders.js zet 'disputed' in
     BLOCKED_STATUSES, en de factuurmodule zet reminderPaused. */
  var bezwaarReden = function (ctx, factuurId) {
    var uit = null;
    lijst(D(ctx).invoiceAudit).forEach(function (a) {
      if (!a || tekst(a.event) !== 'bezwaar_klant' || a.invoiceId !== factuurId) return;
      if (!uit || tekst(a.createdAt) > tekst(uit.createdAt)) uit = a;
    });
    return uit;
  };

  var bezwaarInhoud = function (ctx, ui, item, klant) {
    var inv = opt(item.raw);
    var data = DAT(ctx);
    var totaal = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv.amountCents, 0);
    var reden = bezwaarReden(ctx, inv.id);
    var vandaag = dagVan(ctx, nuVan(ctx));
    var verval = dagVan(ctx, inv.dueDate);
    return ui.el('div', null, [
      klantVoorbeeld(ui, 'Waar de klant bezwaar tegen maakt', factuurNaamVan(inv),
        samen([geldTekst(ctx, totaal, inv.currency),
          verval ? ((verval < vandaag ? 'verviel op ' : 'vervalt op ') + datumTekst(ctx, verval)) : ''])),
      ruimte(ui, 18),
      reden
        ? klantBericht(ctx, ui, klant, reden.detail, reden.createdAt)
        : leesRegel(ui, 'De reden van het bezwaar staat in het factuurlogboek van deze factuur; dit scherm krijgt dat logboek niet mee. Open de factuur om de reden te lezen.'),
      reden ? ruimte(ui, 18) : null,
      leesRegel(ui, 'Zolang de factuur op "Betwist" staat, staan de automatische herinneringen stil: de herinneringstrap slaat die status over. Er gaat dus niets naar de klant totdat jij de status verandert.'),
      leesRegel(ui, 'Behandelen opent de factuureditor op deze factuur met de reden in beeld; daar zet je de status verder (herstellen, crediteren of oninbaar).', '0')
    ]);
  };

  var bezwaarCellen = function (ctx, item, project, klant) {
    var inv = opt(item.raw);
    var data = DAT(ctx);
    var totaal = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv.amountCents, 0);
    var open = openstaandCents(ctx, inv);
    var reden = bezwaarReden(ctx, inv.id);
    var vandaag = dagVan(ctx, nuVan(ctx));
    var verval = dagVan(ctx, inv.dueDate);
    return [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Project', waarde: project ? tekst(project.name) : '' },
      { icoon: 'financien', label: 'Factuur', waarde: factuurNaamVan(inv) },
      { icoon: 'financien', label: 'Bedrag', waarde: geldTekst(ctx, totaal, inv.currency) },
      { icoon: 'financien', label: 'Openstaand', waarde: open === null ? '' : geldTekst(ctx, open, inv.currency), leegTekst: 'Onbekend' },
      {
        icoon: 'kalender', label: 'Vervaldatum',
        waarde: verval ? datumTekst(ctx, verval) : '', leegTekst: 'Geen',
        toon: verval && verval < vandaag ? 'kritiek' : 'neutraal'
      },
      { icoon: 'klok', label: 'Bezwaar op', waarde: tijdTekst(ctx, (reden && reden.createdAt) || inv.updatedAt), leegTekst: 'Onbekend' },
      {
        icoon: 'bel', label: 'Herinneringen',
        waarde: (inv.reminderPaused === true || tekst(inv.statusCode) === 'disputed') ? 'Staan stil' : '',
        leegTekst: 'Onbekend',
        toon: 'wacht'
      }
    ];
  };

  var bezwaarSlot = function (ctx, ui, item, door) {
    return klantSlot(ctx, ui, item, door, {
      primair: { haak: HAKEN.bezwaar, label: PRIMAIR_LABEL.bezwaar },
      secundair: factuurSprong(ctx, item.id)
    });
  };

  /* --- herbestelling ---
     BRON: de reorder_requests-rij en de pijplijn die collectInbox op het item
     zet (item.pipeline, uit de statuskolom). De vier stappen staan er als
     stip-plus-woord, zodat kleur nooit de enige drager is. */
  var pijplijnRij = function (ui, pijplijn) {
    var stappen = lijst(pijplijn && pijplijn.steps);
    if (!stappen.length) return null;
    return ui.el('div', { style: 'display:flex;flex-wrap:wrap;gap:14px;', role: 'list', 'aria-label': 'Stappen van de herbestelling' },
      stappen.map(function (s) {
        var toon = s.state === 'done' ? 'klaar' : (s.state === 'current' ? 'nu' : 'neutraal');
        var woord = s.state === 'done' ? ' (gedaan)' : (s.state === 'current' ? ' (nu)' : '');
        return ui.el('span', { role: 'listitem' }, ui.statusDot({ toon: toon, label: tekst(s.label) + woord }));
      }));
  };

  var herbestellingInhoud = function (ctx, ui, item, project, klant) {
    var r = opt(item.raw);
    var pl = item.pipeline || null;
    var aantal = (typeof r.qty === 'number') ? getalTekst(ctx, r.qty) + ' stuks' : 'aantal onbekend';
    var spec = r.sameSpec === true ? 'zelfde specificatie' : (r.sameSpec === false ? 'met wijziging' : '');
    var uitleg;
    if (pl && pl.next && pl.next.key !== 'project') {
      uitleg = 'Deze herbestelling staat op stap ' + pl.step + ' van ' + pl.total + ': ' + pl.label
        + '. De volgende stap is ' + tekst(pl.next.label).toLowerCase() + '; "Maak er een project van" slaat de tussenstappen over en maakt meteen het batchproject.';
    } else if (pl) {
      uitleg = 'Deze herbestelling staat op stap ' + pl.step + ' van ' + pl.total + ': ' + pl.label
        + '. De laatste stap maakt er een project van: het omzetvenster opent met aantal, datum en wijziging voorgevuld.';
    } else {
      uitleg = 'De stand van deze herbestelling is niet bekend.';
    }
    return ui.el('div', null, [
      klantVoorbeeld(ui, 'Wat de klant aanvraagt',
        aantal + (project ? ' van ' + tekst(project.name) : ''),
        samen([r.wantedBy ? 'gewenst op ' + datumTekst(ctx, r.wantedBy) : '', spec]),
        pl ? ui.el('div', { style: 'margin-top:12px;' }, pijplijnRij(ui, pl)) : null),
      ruimte(ui, 18),
      r.sameSpec === false ? klantBericht(ctx, ui, klant, r.changeNote, r.createdAt) : null,
      (r.sameSpec === false && tekst(r.changeNote)) ? ruimte(ui, 18) : null,
      leesRegel(ui, uitleg, '0')
    ]);
  };

  var herbestellingCellen = function (ctx, item, project, klant) {
    var r = opt(item.raw);
    var pl = item.pipeline || null;
    var vandaag = dagVan(ctx, nuVan(ctx));
    var gewenst = dagVan(ctx, r.wantedBy);
    return [
      { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
      { icoon: 'projecten', label: 'Product', waarde: project ? tekst(project.name) : '', leegTekst: 'Niet gevonden' },
      { icoon: 'bestand', label: 'Aantal', waarde: (typeof r.qty === 'number') ? getalTekst(ctx, r.qty) + ' stuks' : '', leegTekst: 'Onbekend' },
      {
        icoon: 'kalender', label: 'Gewenste datum',
        waarde: gewenst ? datumTekst(ctx, gewenst) : '', leegTekst: 'Geen',
        toon: gewenst && gewenst < vandaag ? 'kritiek' : 'neutraal'
      },
      {
        icoon: 'potlood', label: 'Specificatie',
        waarde: r.sameSpec === true ? 'Zelfde als het product' : (r.sameSpec === false ? 'Met wijziging' : ''),
        leegTekst: 'Onbekend'
      },
      { icoon: 'klok', label: 'Huidige stap', waarde: pl ? ('Stap ' + pl.step + ' van ' + pl.total + ': ' + pl.label) : '', leegTekst: 'Onbekend', toon: 'nu' },
      { icoon: 'kalender', label: 'Aangevraagd op', waarde: tijdTekst(ctx, r.createdAt) },
      { icoon: 'klok', label: 'Laatste stap gezet op', waarde: r.updatedAt && r.updatedAt !== r.createdAt ? tijdTekst(ctx, r.updatedAt) : '', leegTekst: 'Nog geen stap gezet' },
      { icoon: 'bestand', label: 'Offerteconcept', waarde: pl && pl.quoteDocId ? 'Aangemaakt' : '', leegTekst: 'Nog geen', toon: pl && pl.quoteDocId ? 'klaar' : 'neutraal' }
    ];
  };

  var herbestellingSlot = function (ctx, ui, item, project, door) {
    var pl = item.pipeline || null;
    var volgende = (pl && pl.next && pl.next.key !== 'project') ? pl.next : null;
    return klantSlot(ctx, ui, item, door, {
      primair: { haak: HAKEN.herbestelling, label: PRIMAIR_LABEL.herbestelling },
      /* de tussenstap op de rij zelf; op de laatste stap vóór 'project' is
         er geen tussenstap meer en wijst de secundaire naar het product */
      secundair: volgende
        ? { haak: HAKEN.herbestellingStap, label: 'Volgende stap: ' + tekst(volgende.label), doe: function (h) { return h(item, volgende.key); } }
        : projectSprong(ctx, project, 'overzicht'),
      uitleg: volgende
        ? 'De volgende stap zet alleen de stand van de pijplijn; het item blijft hier staan tot er een project van gemaakt is.'
        : ''
    });
  };

  /* ============================================================
     9. SCHERM — PROJECTEN (§5.3)

     De knop staat DIRECT NAAST de titel en niet rechts uitgelijnd — dat is
     de tweede van de twee koppen die de mockup tekent, en pageHeader kent hem
     sinds deze ronde als actiePlaats:'naast'.

     Er stond hier eerst een met de hand gebouwde knop in het badge-slot,
     omdat pageHeader zijn primaire knop altijd rechts zette. Dat werkte voor
     de knop, maar het ••• bleef achter in het actieblok aan de rechterkant en
     zweefde daar los van de knop waar hij bij hoort (observatie V10). Met
     actiePlaats verhuizen knop én menu samen naar de titelregel; de knop gaat
     dus terug naar `primair`, waar precies één primaire actie hoort.
     ============================================================ */

  SCHERMEN.projecten = function (ctx) {
    var ui = UI(ctx);
    if (!ui) return noodElement('Projecten');
    var chart = CH(ctx);
    var model = MOD(ctx);
    var data = DAT(ctx);
    var d = D(ctx);
    var nu = nuVan(ctx);

    var items = inboxItems(ctx);
    var mctx = modelCtx(ctx, items);
    var alle = lijst(d.projects);

    var chipKey = paramVan(ctx, 'chip') || 'alle';
    var chipDefs = [];
    lijst(model && model.PROJECT_CHIPS).forEach(function (c) {
      /* een chip met vereistSig kan alleen bestaan als er signalen gemeten
         zijn: een telling van nul zou "er is niets vertraagd" beweren
         terwijl het antwoord "niet gemeten" is.
         SINDS DE VORIGE RONDE IS ER WÉL EEN METING. modelCtx() geeft de
         zendingsignalen mee (hoofdstuk 4b) en CP_MODEL.isDelayed() leest ze,
         dus "Vertraagd" telt hier echte vertraagde zendingen.
         DE CONTROLE HIERONDER IS DAARMEE EEN VANGNET EN GEEN SCHAKELAAR:
         zendingSignalen() geeft altijd een object terug — ook een leeg — dus
         hij slaat vandaag nooit toe. Hij blijft staan voor de dag dat
         modelCtx() de meting weglaat; dan hoort de chip te verdwijnen in
         plaats van een telling van nul te tonen. */
      if (c.vereistSig && !mctx.sig) return;
      chipDefs.push({
        key: c.key, label: c.label,
        count: (fn(model.filterProjects)) ? model.filterProjects(alle, c.key, mctx).length : 0,
        altijd: c.key === 'alle'
      });
    });
    var bekend = false;
    chipDefs.forEach(function (c) { if (c.key === chipKey) bekend = true; });
    if (!bekend) chipKey = 'alle';

    var zichtbaar = (model && fn(model.filterProjects)) ? model.filterProjects(alle, chipKey, mctx) : alle;
    if (model && fn(model.sortProjects)) zichtbaar = model.sortProjects(zichtbaar, 'actie', mctx);

    /* ---------- kop met de knop ernaast ---------- */
    var kop = ui.pageHeader({
      titel: 'Projecten',
      actiePlaats: 'naast',
      primair: {
        label: 'Nieuw project', ico: 'plus',
        onClick: function () {
          var h = haak(ctx, HAKEN.nieuwProject);
          if (h) { h(null); return; }
          navigeer(ctx, { area: 'inbox', params: { chip: 'nieuw' } });
        }
      },
      menu: [
        {
          label: 'Bekijk alle activiteit', ico: 'activiteit',
          onKies: function () { navigeer(ctx, { area: 'activiteit' }); }
        },
        {
          label: 'Open Financiën', ico: 'financien',
          onKies: function () { navigeer(ctx, { area: 'financien' }); }
        }
      ]
    });

    /* ---------- Portfolio gezondheid ----------
       BRON: CP_DATA.portfolioHealth over de projecten. Die functie telt uit
       sig.ITEMS.

       LET OP WELKE sig HIER BINNENKOMT. Er zijn er twee, en ze zijn niet
       inwisselbaar. mctx.sig is het signaalobject van hoofdstuk 4b: dat bevat
       met opzet ALLEEN de zendingsignalen ({eta, stil}), want die reconstructie
       bestond juist omdat de volledige berekening van buiten onbereikbaar was.
       Geef je die door, dan is items leeg en telt élk lopend project als "op
       koers" — dan staat er onvermijdelijk 100 / 0 / 0.

       Dat was precies de fout: dezelfde kaart zei rechts "100% op koers" terwijl
       de tekstuele tegenhanger van de grafiek ernaast "2 op koers, 1 met
       aandacht" zei. Twee getallen over dezelfde drie projecten op hetzelfde
       moment, en ze spraken elkaar tegen. Een getal dat een meting suggereert
       die er niet is, is precies wat hoofdstuk 7 van de mockupspec verbiedt.

       iaLaadLijsten() in beheer.html levert sinds de laatste ronde de VOLLEDIGE
       uitkomst van computeSignals mee, inclusief items. Die gebruiken we hier,
       met mctx.sig als terugval voor een gastheer die hem nog niet meelevert
       (de ontwikkelpagina). De band per week komt uit echte historie en zegt
       zelf dat hij een ondergrens is. */
    var volleSig = (d && d.sig && d.sig.items) ? d.sig : (mctx.sig || null);
    var gezond = (data && fn(data.portfolioHealth))
      ? data.portfolioHealth(alle, volleSig, nu, {
        bron: {
          questions: lijst(d.questions),
          invoices: lijst(d.invoices),
          shipments: lijst(d.shipments),
          events: lijst(d.shipmentEvents)
        },
        weken: 8
      })
      : null;

    var gezondKaart = null;
    if (gezond && chart && fn(chart.areaChart)) {
      var xLabels = [], sOk = [], sWarn = [], sCrit = [], zinnen = [];
      lijst(gezond.reeks).forEach(function (p) {
        xLabels.push(tekst(p.label));
        sOk.push(getal(p.opKoers, 0));
        sWarn.push(getal(p.aandacht, 0));
        sCrit.push(getal(p.afwijkend, 0));
        /* de tekstuele tegenhanger in lopend Nederlands: CP_CHART zou zijn
           eenheid ongewijzigd achter elk getal plakken ("1 projecten") */
        zinnen.push(tekst(p.label) + ': ' + nlAantal(getal(p.opKoers, 0), 'project', 'projecten')
          + ' op koers, ' + getal(p.aandacht, 0) + ' met aandacht, '
          + getal(p.afwijkend, 0) + ' afwijkend');
      });

      var grafiek = chart.areaChart({
        titel: 'Portfolio gezondheid',
        beschrijving: 'Portfolio gezondheid per week. ' + zinnen.join('. ') + '.',
        gestapeld: true,
        hoogte: 210,
        xLabels: xLabels,
        eenheid: 'projecten',
        reeksen: [
          { label: 'Op koers', kleur: 'ok-soft', punten: sOk },
          { label: 'Aandacht', kleur: 'warn-soft', punten: sWarn },
          { label: 'Afwijkend', kleur: 'crit-soft', punten: sCrit }
        ],
        legenda: [
          { label: 'Op koers', kleur: 'ok' },
          { label: 'Aandacht', kleur: 'warn' },
          { label: 'Afwijkend', kleur: 'crit' }
        ]
      });

      /* De drie standen en de band meten NIET hetzelfde, en dat moet op de kaart
         staan — anders leest het als een tegenspraak.
         · de standen zijn de stand van NU, over alle zes de signaalsoorten
         · de band is historie, en die kan alleen worden opgebouwd uit de drie
           signalen die een echte begin- en einddatum hebben (open vragen, open
           facturen, verlopen ETA-vensters). Voor fases, samples en stilte
           bestaat geen historisch venster, dus die zijn per week niet terug te
           rekenen.
         Dat betekent dat het laatste punt van de band lager kan liggen dan de
         standen ernaast. Dat is geen fout maar een verschil in bron, en het
         label zegt dat nu ook. Ze gelijktrekken zou betekenen dat we het laatste
         punt op een andere basis tekenen dan de rest van de lijn — dan liegt de
         lijn zelf. */
      var standen = stapel(ui, [
        ui.el('p', {
          class: 'u-kicker', style: 'margin:0 0 4px;',
          text: 'Stand van nu'
        }),
        gezondStand(ui, 'Op koers', gezond.opKoers, 'klaar'),
        gezondStand(ui, 'Aandacht', gezond.aandacht, 'wacht'),
        gezondStand(ui, 'Afwijkend', gezond.afwijkend, 'kritiek')
      ], 18);

      gezondKaart = kaart(ui, [
        ui.sectionHead({
          titel: 'Portfolio gezondheid'
        }),
        ui.el('div', {
          /* de mockup zet de grafiek links en de drie standen in een eigen,
             smalle kolom rechts. admin-ui.css heeft daar geen klasse voor:
             .u-grid-2 is 1fr 1fr en .u-cols is de paginarail. Eén regel,
             met opzet hier en nergens anders. */
          style: 'display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:28px;align-items:center;'
        }, [grafiek, standen]),
        ui.el('p', {
          class: 'u-sub', style: 'margin:14px 0 0;',
          text: gezond.reeksVolledig
            ? 'De band toont de stand per week; de cijfers rechts zijn de stand van nu.'
            /* reeksBron noemt zelf al welke signalen erin zitten en waarom, dus
               die zin niet herhalen — anders staat er twee keer hetzelfde. */
            : 'De cijfers rechts zijn de stand van nu, over alle signalen. De band per week is '
              + 'een ondergrens en is opgebouwd uit ' + tekst(gezond.reeksBron)
              + '. Het laatste punt van de band kan daardoor gunstiger uitvallen dan de cijfers '
              + 'ernaast.'
        })
      ]);
    }

    /* ---------- filterchips ----------
       De mockup toont ze niet, maar fase 3 van het migratieplan vraagt ze
       en ze zijn volledig af te leiden. Ze staan in .u-chips, dus in de
       vorm die het stijlblad er al voor heeft. */
    var chipRij = ui.filterChips({
      chips: chipDefs,
      actief: chipKey,
      label: 'Filters op de projectenlijst',
      onKies: function (key) {
        var telling = 0;
        chipDefs.forEach(function (c) { if (c.key === key) telling = c.count; });
        deelNavigatie(ctx, { area: 'projecten', params: { chip: key } },
          nlAantal(telling, 'project', 'projecten'));
      }
    });

    /* ---------- de projectkaarten ---------- */
    var kaarten = zichtbaar.map(function (p) {
      return projectKaart(ctx, ui, chart, p, items, mctx);
    });

    var lijstBlok = sectie(ui, ui.sectionHead({
      titel: 'Projecten'
    }), [
      kaarten.length
        ? stapel(ui, kaarten)
        : ui.emptyState({
          titel: 'Geen projecten onder dit filter',
          uitleg: 'Kies een ander filter, of begin een nieuw project.',
          actie: {
            label: 'Nieuw project',
            onClick: function () {
              var h = haak(ctx, HAKEN.nieuwProject);
              if (h) { h(null); return; }
              navigeer(ctx, { area: 'inbox', params: { chip: 'nieuw' } });
            }
          }
        })
    ]);

    /* ---------- rail: aankomende deadlines ---------- */
    var agenda = agendaRijen(ctx, items);
    var vandaag = dagVan(ctx, nu);
    var komend = [];
    agenda.forEach(function (r) { if (komend.length < 6 && r.iso >= vandaag) komend.push(r); });

    var railKaart = kaart(ui, [
      ui.sectionHead({ titel: 'Aankomende deadlines' })
    ]);
    railKaart.appendChild(
      komend.length
        ? ui.entityList(komend.map(function (r) {
          return deadlineRij(ctx, ui, {
            iso: r.iso, titel: r.titel, sub: r.sub, toon: r.toon, toonWoord: r.toonWoord,
            onOpen: function () { navigeer(ctx, { area: 'projecten', id: r.projectId, tab: 'overzicht' }); }
          });
        }))
        : ui.emptyTile({
          icoon: 'kalender',
          titel: 'Geen datums in het verschiet',
          uitleg: 'Zodra een project een beloofde einddatum krijgt of er een ETA, een antwoordklok of een factuur gaat lopen, staat hij hier.'
        })
    );

    var hoofd = ui.el('div', { class: 'u-cols-main' }, [kop, gezondKaart, ruimte(ui, 26), chipRij, lijstBlok]);
    var rail = ui.el('div', { class: 'u-cols-side' }, [railKaart]);
    return ui.el('div', { class: 'u-cols' }, [hoofd, rail]);
  };

  var gezondStand = function (ui, label, stand, toon) {
    var s = opt(stand);
    /* .u-groot, .u-status en .u-sub zijn alle drie inline: zonder deze
       kolom lopen "100%", "Op koers" en "2 projecten" op één regel aan
       elkaar vast. De vorm zit in de klassen; alleen het stapelen staat hier. */
    return ui.el('div', { style: 'display:flex;flex-direction:column;align-items:flex-start;gap:2px;' }, [
      ui.el('span', { class: 'u-groot', text: getal(s.pct, 0) + '%' }),
      ui.statusDot({ toon: toon, label: label }),
      ui.el('span', { class: 'u-sub', text: nlAantal(getal(s.aantal, 0), 'project', 'projecten') })
    ]);
  };

  /* §5.3 projectkaart. Er is geen CP_UI-component; admin-ui.css hoofdstuk
     8l heeft de klassen. De hele kaart is één knop: er zit geen tweede
     bediening in (de stepper krijgt bewust geen onKies), dus één tabstop
     die het project opent is precies goed. */
  var projectKaart = function (ctx, ui, chart, project, items, mctx) {
    var d = D(ctx);
    var model = MOD(ctx);
    var faseNaam = faseNaamVan(ctx);
    var faseKort = faseKortVan(ctx);
    var klant = klantVan(ctx, project);
    var foto = projectFoto(ctx, project.id);
    var stages = fasesGesorteerd(project);
    var actiefIdx = actieveFaseIndex(stages);
    var voortgang = faseVoortgang(project);

    var beeld = foto
      ? ui.el('img', { class: 'u-projectcard-beeld', src: foto, alt: '', loading: 'lazy' })
      : ui.el('span', { class: 'u-projectcard-beeld', 'aria-hidden': 'true' });

    var huidigeFase = (actiefIdx >= 0 && stages[actiefIdx]) ? stages[actiefIdx] : null;
    var stand = huidigeFase ? faseStand(huidigeFase.status) : { woord: 'Geen fases', toon: 'neutraal' };
    if (model && fn(model.isArchived) && model.isArchived(project)) stand = { woord: 'Gearchiveerd', toon: 'neutraal' };
    else if (model && fn(model.isFinished) && model.isFinished(project)) stand = { woord: 'Afgerond', toon: 'klaar' };

    var volgende = volgendeActieTekst(ctx, project, items);

    /* DE STEPPER KRIJGT KORTE LABELS (observatie V3).
       In vijf of zes even brede kolommen wikkelden de volledige fasenamen
       over drie en vier regels en liepen ze visueel in elkaar over. De korte
       naam staat op het scherm; de volledige naam blijft in de tooltip en in
       het aria-label, en staat voluit op het projectdetail — bij Kerngegevens
       en bij Betaalmomenten per fase, waar wél ruimte is.
       De subregel van deze kaart noemt de huidige fase ook nog steeds voluit,
       dus de lange naam is nergens van het scherm verdwenen.
       Hier is de kolom 55,0px breed en past niets langer dan acht tekens —
       zie de meting bij FASE_KORT hierboven en bij naamPaar() in
       admin-charts.js. */
    var stepper = (chart && fn(chart.stepper)) ? chart.stepper({
      huidigIndex: actiefIdx,
      stappen: stages.map(function (s) {
        return {
          sleutel: tekst(s.stageKey),
          /* label = voluit (title en aria-label), kort = op het scherm */
          label: faseNaam(s.stageKey),
          kort: faseKort(s.stageKey),
          status: s.status === 'done' ? 'gereed'
            : (s.status === 'current' || s.status === 'awaiting_approval') ? 'huidig' : 'toekomst'
        };
      })
    }) : null;

    var leiderNaam = tekst(project.lead);
    var leider = leiderNaam ? ui.el('span', { class: 'u-projectcard-lead' }, [
      ui.avatar({ naam: leiderNaam, url: teamAvatar(ctx, leiderNaam), maat: 28 }),
      ui.el('span', { text: leiderNaam })
    ]) : null;

    /* DE VOORTGANGSRING (observatie V4).
       Teller en noemer gaan nu rechtstreeks de ring in in plaats van een al
       uitgerekend percentage: dan rondt er maar één keer iets af, en dan kan
       de ring zijn eigen tekstuele tegenhanger opbouwen uit de echte getallen
       ("4 van 6, 67 procent"). De tooltip zegt hetzelfde in woorden, zodat
       een boog van 0% herkenbaar is als een meting en niet als een storing.
       Zonder fases is er geen bron en dus geen ring — zie faseVoortgang().

       En span en geen div: deze omhulling staat binnen de <button> die de
       hele kaart is, en het inhoudsmodel van een knop laat geen div toe (zie
       de tekstkolom van raillijst(), dezelfde fout op een andere plek).
       admin-ui.css zet .u-projectcard-ring op display:block, dus de ring
       blijft staan waar hij stond. */
    var ring = (chart && fn(chart.ring) && voortgang)
      ? ui.el('span', {
        class: 'u-projectcard-ring',
        title: nlAantal(voortgang.af, 'fase', 'fases') + ' van ' + voortgang.totaal + ' afgerond'
      }, chart.ring({
        waarde: voortgang.af, max: voortgang.totaal, maat: 56, percentage: true,
        /* DE RING MOET TE ZIEN ZIJN (opdracht C, en hoofdstuk 0: de
           voortgangsring is een INKTSCHAAL, zwart naar warm grijs).
           De boog stond al op --ink en blijft daar; het spoor stond op de
           standaardwaarde --line-2 (#f3efe8) en dat haalt op een witte kaart
           1,16:1 — een ring die je alleen ziet als je weet dat hij er is. Bij
           een project dat nog in zijn eerste fase staat is de boog bovendien
           nul lang en IS het spoor de hele ring; dan is bijna onzichtbaar
           hetzelfde als afwezig, en gaat een eerlijke meting van 0% eruitzien
           als een kapot component.
           Het spoor gaat daarom naar --ink-4 (#b3aba0, 2,27:1): het lichte
           uiteinde van diezelfde inktschaal, in hoofdstuk 1 het token van
           assen — precies de rol die een spoor speelt — en nog altijd licht
           genoeg om nooit voor een gevulde boog door te gaan: de boog haalt
           18,9:1 op de witte kaart en staat met 8,3:1 los van zijn eigen
           spoor, dus afgelegd en nog te gaan blijven twee verschillende
           dingen.
           Dit wijkt bewust af van de letterlijke "spoor --line-2" uit §4.1.
           Hoofdstuk 8 gaat vóór een pixel, en een ring die niet te zien is
           meet niets. Het percentage staat trouwens ook als tekst in het
           midden van de ring, in de title en in het aria-label, dus kleur is
           hier nooit de enige drager. */
        toon: 'ink',
        spoor: 'ink-4',
        label: 'Voortgang van ' + tekst(project.name),
        beschrijving: 'Voortgang van ' + tekst(project.name) + ': '
          + nlAantal(voortgang.af, 'fase', 'fases') + ' van ' + voortgang.totaal
          + ' afgerond, ' + voortgang.pct + ' procent'
      }))
      : null;

    return ui.el('button', {
      type: 'button', class: 'u-projectcard',
      /* .u-projectcard is in de CSS geen knop en zet daarom geen
         tekstuitlijning; een <button> centreert van zichzelf */
      style: 'text-align:left;',
      onclick: function () {
        navigeer(ctx, { area: 'projecten', id: project.id, tab: 'overzicht' });
      }
    }, [
      beeld,
      ui.el('span', { class: 'u-projectcard-body' }, [
        ui.el('span', { class: 'u-projectcard-kop' }, [
          /* .u-projectcard-titel en -sub staan in admin-ui.css niet op
             display:block (de lijst in hoofdstuk 4 noemt ze niet) en de
             hele kaart is hier een <button>, dus titel, subregel en
             statusstip zijn spans. Zonder deze kolom lopen ze op één
             regel aan elkaar vast. */
          ui.el('span', { style: 'display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;' }, [
            ui.el('span', { class: 'u-projectcard-titel', text: tekst(project.name) }),
            ui.el('span', {
              class: 'u-projectcard-sub',
              text: samen([klantNaam(klant), huidigeFase ? faseNaam(huidigeFase.stageKey) : '', tekst(project.category)])
            }),
            ui.statusDot({ toon: stand.toon, label: stand.woord })
          ]),
          leider
        ]),
        stepper ? ui.el('span', { class: 'u-projectcard-stepper' }, stepper) : null,
        ui.el('span', { class: 'u-projectcard-next', text: '→ ' + volgende })
      ]),
      ring
    ]);
  };

  /* de volgende actie van een project.
     BRON: de werkvoorraad van collectInbox. Het eerste open item van dit
     project (die lijst staat al op gepind, dan urgent, dan het oudste)
     bepaalt wat er te doen is; is er geen item, dan is er geen actie en
     zegt de regel dat ook. Er wordt hier geen rangorde verzonnen — de
     volgorde komt uit CP_MODEL. */
  var volgendeActieTekst = function (ctx, project, items) {
    var gevonden = null;
    lijst(items).forEach(function (it) {
      if (gevonden || !it || it.projectId !== project.id) return;
      if (it.chip === 'afgehandeld' || it.snoozedUntil) return;
      gevonden = it;
    });
    if (!gevonden) return 'Geen open actie';
    return (ITEM_ACTIE[gevonden.kind] || 'Handel dit af') + ' — ' + afkorten(gevonden.title, 70);
  };

  /* de foto van een teamlid bij een naam. BRON: team_members.avatarUrl uit
     hoofdstuk 7. Geen treffer of geen foto: dan tekent CP_UI.avatar de
     initialen, en dat is een volwaardige variant en geen gebrek. */
  var teamAvatar = function (ctx, naam) {
    var uit = '';
    lijst(D(ctx).team).forEach(function (t) {
      if (uit || !t) return;
      if (tekst(t.name) === tekst(naam)) uit = tekst(t.avatarUrl);
    });
    return uit;
  };

  /* ============================================================
     10. SCHERM — PROJECTDETAIL (§5.4)

     Het golvende fasepad is het karakteristiekste element van de hele
     mockup. Het staat bovenaan de tab Overzicht, met de NEDERLANDSE
     fasenamen eronder — nooit de kale sleutels.
     ============================================================ */

  var PROJECT_TABS = [
    { key: 'overzicht', label: 'Overzicht' },
    { key: 'tijdlijn', label: 'Tijdlijn' },
    { key: 'bestanden', label: "Bestanden & foto's" },
    { key: 'financien', label: 'Financiën' },
    { key: 'communicatie', label: 'Communicatie' },
    { key: 'details', label: 'Details' }
  ];

  SCHERMEN.project = function (ctx) {
    var ui = UI(ctx);
    if (!ui) return noodElement('Project');
    var chart = CH(ctx);
    var model = MOD(ctx);
    var d = D(ctx);
    var route = routeVan(ctx);

    var project = indexOp(lijst(d.projects), 'id')[tekst(route.id)] || null;
    if (!project) {
      return ui.el('div', null, [
        ui.pageHeader({
          crumbs: [
            { label: 'Projecten', onKies: function () { navigeer(ctx, { area: 'projecten' }); } },
            { label: 'Onbekend project' }
          ],
          titel: 'Dit project bestaat niet'
        }),
        ui.emptyState({
          titel: 'Geen project met dit adres',
          uitleg: 'De link verwijst naar een project dat er niet (meer) is. Misschien is het gearchiveerd of verwijderd.',
          actie: {
            label: 'Terug naar Projecten',
            onClick: function () { navigeer(ctx, { area: 'projecten' }); }
          }
        })
      ]);
    }

    var faseNaam = faseNaamVan(ctx);
    var klant = klantVan(ctx, project);
    var items = inboxItems(ctx);
    var mctx = modelCtx(ctx, items);
    var stages = fasesGesorteerd(project);
    var actiefIdx = actieveFaseIndex(stages);
    var huidigeFase = (actiefIdx >= 0 && stages[actiefIdx]) ? stages[actiefIdx] : null;

    var stand = huidigeFase ? faseStand(huidigeFase.status) : { woord: 'Geen fases', toon: 'neutraal' };
    if (model && fn(model.isArchived) && model.isArchived(project)) stand = { woord: 'Gearchiveerd', toon: 'neutraal' };
    else if (model && fn(model.isFinished) && model.isFinished(project)) stand = { woord: 'Afgerond', toon: 'klaar' };

    var tab = (model && fn(model.tabOf)) ? tekst(model.tabOf(route, 'overzicht')) : 'overzicht';
    var bekend = false;
    PROJECT_TABS.forEach(function (t) { if (t.key === tab) bekend = true; });
    if (!bekend) tab = 'overzicht';

    /* ---------- kop ----------
       DE REDEN WAAROM EEN RIJ UITSTAAT HOORT IN HET LABEL, NIET IN HET
       SNELTOETSVAKJE. Dat vakje (.u-menu-hint) is volgens admin-ui.css mono,
       "want het is een code"; er stond lopende tekst in. Sinds deze ronde is
       het in dit bestand helemaal leeg en houdt het precies één betekenis
       over: een toetsaanslag. De uitleg staat nu waar hij gelezen wordt, en
       aria-disabled (via `uit`) draagt de stand voor wie hem niet ziet. */
    var menuItem = function (label, ico, haakNaam, gevaarlijk) {
      var h = haak(ctx, haakNaam);
      return {
        label: label + (h ? '' : ' — nog niet gekoppeld'),
        ico: ico, gevaarlijk: !!gevaarlijk, uit: !h,
        onKies: h ? function () { h(project); } : null
      };
    };

    var kop = ui.pageHeader({
      crumbs: [
        { label: 'Projecten', onKies: function () { navigeer(ctx, { area: 'projecten' }); } },
        { label: tekst(project.name) }
      ],
      kicker: samen([klantNaam(klant).toUpperCase(), tekst(project.code)]),
      titel: tekst(project.name),
      status: { toon: stand.toon, label: samen([stand.woord, huidigeFase ? faseNaam(huidigeFase.stageKey) : '']) },
      menu: [
        menuItem('Projectgegevens bewerken', 'potlood', HAKEN.projectBewerken),
        menuItem('Nieuwe update', 'plus', HAKEN.nieuweUpdate),
        menuItem('Bekijk als klant', 'extern', HAKEN.alsKlant),
        menuItem('Publiceren', 'vinkje', HAKEN.publiceren),
        /* een scheiding is in CP_UI.contextMenu een EIGEN item en geen vlag
           op een rij: een rij met scheiding:true wordt alléén de streep en
           verliest zijn label. Daarom staat hij hier los. */
        { scheiding: true },
        {
          label: 'Open de klant', ico: 'relaties', uit: !klant,
          onKies: klant ? function () { navigeer(ctx, { area: 'relaties', sub: 'klanten', id: klant.id }); } : null
        },
        menuItem('Dossier exporteren', 'bestand', HAKEN.exporteren),
        menuItem('Dupliceren', 'projecten', HAKEN.dupliceren),
        menuItem('Archiveren', 'sluiten', HAKEN.archiveren, true)
      ]
    });

    var tabBalk = ui.tabs({
      tabs: PROJECT_TABS,
      actief: tab,
      label: 'Onderdelen van dit project',
      onKies: function (key, t) {
        deelNavigatie(ctx, { area: 'projecten', id: project.id, tab: key }, tekst(t && t.label));
      }
    });

    var paneelId = 'projecttab-' + tekst(project.id);
    var paneel = ui.el('div', {
      id: paneelId, role: 'region', tabindex: '-1',
      'aria-label': 'Tab ' + tabLabel(tab)
    }, [tabInhoud(ctx, ui, chart, project, tab, items, mctx)]);

    /* ---------- rail ---------- */
    var rail = projectRail(ctx, ui, chart, project, klant, items, mctx);

    var hoofd = ui.el('div', { class: 'u-cols-main' }, [kop, tabBalk, paneel]);
    return ui.el('div', { class: 'u-cols' }, [hoofd, rail]);
  };

  var tabLabel = function (key) {
    for (var i = 0; i < PROJECT_TABS.length; i++) {
      if (PROJECT_TABS[i].key === key) return PROJECT_TABS[i].label;
    }
    return 'Overzicht';
  };

  var tabInhoud = function (ctx, ui, chart, project, tab, items, mctx) {
    if (tab === 'tijdlijn') return tabTijdlijn(ctx, ui, project);
    if (tab === 'bestanden') return tabBestanden(ctx, ui, project);
    if (tab === 'financien') return tabFinancien(ctx, ui, project);
    if (tab === 'communicatie') return tabCommunicatie(ctx, ui, project);
    if (tab === 'details') return tabDetails(ctx, ui, project, mctx);
    return tabOverzicht(ctx, ui, chart, project, items);
  };

  /* --- tab Overzicht: het fasepad, de sampleronde en de zendingen --- */
  var tabOverzicht = function (ctx, ui, chart, project, items) {
    var d = D(ctx);
    var data = DAT(ctx);
    var faseNaam = faseNaamVan(ctx);
    var stages = fasesGesorteerd(project);
    var actiefIdx = actieveFaseIndex(stages);

    /* de factuur per fase: het betaalpercentage staat op de fase, het
       BEDRAG staat op de factuur die aan die fase hangt. Is er geen
       factuur, dan toont de fase alleen het percentage — een bedrag
       uitrekenen uit een projectwaarde die niet bestaat, zou verzinnen zijn. */
    var factuurPerFase = {};
    lijst(d.invoices).forEach(function (inv) {
      if (!inv || inv.projectId !== project.id || !inv.stageKey) return;
      if (!factuurPerFase[inv.stageKey]) factuurPerFase[inv.stageKey] = inv;
    });

    var FASE_ICOON = {
      concept: 'lamp', dfm: 'gereedschap', sourcing: 'winkelwagen',
      tooling: 'gereedschap', production: 'fabriek', logistics: 'vrachtwagen'
    };

    /* HET GOLVENDE FASEPAD KRIJGT DEZELFDE KORTE LABELS ALS DE STEPPER
       (observatie V3). Ook hier staan de labels in even brede kolommen, en
       ook hier viel "Massaproductie & Kwaliteitscontrole" uit elkaar. Onder
       elke fase staat wél de volledige stand ("Afgerond", "Wacht op akkoord")
       en het betaalmoment; de volledige fasenaam zit in de tooltip, in het
       aria-label, en verderop op deze pagina bij Kerngegevens en bij
       Betaalmomenten per fase.

       Dit is een LEESBAARDERE uitvoering van dezelfde bewuste afwijking die
       §4.11 vastlegt: de mockup toont daar de kale sleutels (concept · dfm ·
       sourcing), wij tonen Nederlandse woorden — nu alleen kort in het pad en
       voluit waar de ruimte is.

       EN DE RUIMTE IS HIER RUIMER, MAAR NIET RUIM GENOEG. De meting bij
       naamPaar() in admin-charts.js geeft dit pad een kolom van 112px netto
       bij 14px/500, oftewel ongeveer 15,8 tekens per regel over twee regels.
       Op papier is dat plek voor de volledige naam; in de praktijk breekt een
       browser op hele woorden, en dan valt geen van de zes namen binnen twee
       regels: "Fabriekssourcing" is als woord al 113px, "Produceerbaarheid"
       121px, en "Concept & Industrieel Ontwerp" heeft er drie regels nodig.
       Het korte label blijft hier dus staan, en de volledige naam staat op
       deze pagina voluit in de regel onder de titel, bij Kerngegevens en bij
       Betaalmomenten per fase. */
    var faseKort = faseKortVan(ctx);
    var pad = (chart && fn(chart.stagePath)) ? chart.stagePath({
      titel: 'Fasepad van ' + tekst(project.name),
      actiefIndex: actiefIdx,
      hoogte: 140,
      fases: stages.map(function (s) {
        var stand = faseStand(s.status);
        var inv = factuurPerFase[s.stageKey];
        var cents = inv
          ? ((data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv.amountCents, 0))
          : null;
        var pct = getal(s.paymentPct, 0);
        var nadruk = '';
        if (pct) nadruk = pct + '%' + (cents !== null ? ' · ' + bedragTekst(ctx, cents) : '');
        return {
          sleutel: tekst(s.stageKey),
          /* label = voluit (title en aria-label), kort = op het scherm */
          label: faseNaam(s.stageKey),
          kort: faseKort(s.stageKey),
          status: stand.woord,
          nadruk: nadruk,
          icoon: FASE_ICOON[tekst(s.stageKey)] || 'doos',
          /* wie akkoord gaf en langs welke weg (0021), of alleen de datum */
          onder: s.approvedAt ? [akkoordTekst(ctx, s)] : []
        };
      })
    }) : null;

    /* --- DE FASEBALK: HET PAD LAAT ZIEN WAAR JE STAAT, DE BALK IS WAAR JE
       WERKT ---------------------------------------------------------------
       Het golvende pad hierboven is de vorm die §4.11 vraagt en het is puur
       een afbeelding: zes iconen op een curve. De handelingen die de opdracht
       terugvraagt — de statuskeuze per fase, Factureer bij een betaalfase
       zonder factuur, en de goedkeuringsdatum corrigeren — zitten in de
       bestaande fasebalk (CP_UI.projectProgress, de .stagegrid uit
       beheer.html). Die twee staan bewust in dezelfde sectie: het pad
       beantwoordt "waar staat dit project", de balk beantwoordt "wat doe ik
       eraan", en dat is dezelfde vraag in twee helften.

       DRIE HAKEN, ELK MET ZIJN EIGEN VOORWAARDE — precies de voorwaarden die
       de oude fasebalk ook stelde:
         · statuskeuze: altijd. Bij een fout springt de keuzelijst terug naar
           de opgeslagen stand (het derde argument van onWissel is de select
           zelf, dus dat terugspringen kan hier écht).
         · Factureer: alleen bij paymentPct > 0 zónder factuur op die fase.
           De haak weigert zelf als de projectwaarde nog leeg is — daar wordt
           het bedrag uit berekend.
         · goedkeuringsdatum: alleen bij een afgeronde fase mét datum. Een
           datum corrigeren op een fase die nog loopt, zou een goedkeuring
           verzinnen die er niet is. */
    var faseStatusHaak = haak(ctx, HAKEN.faseStatus);
    var faseFactuurHaak = haak(ctx, HAKEN.faseFactureren);
    var faseDatumHaak = haak(ctx, HAKEN.faseDatum);

    var faseBalk = ui.projectProgress({
      uitklapbaar: true,
      fases: stages.map(function (s) {
        var stand = faseStand(s.status);
        var inv = factuurPerFase[s.stageKey];
        var cents = inv
          ? ((data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv.amountCents, 0))
          : null;
        return {
          sleutel: tekst(s.stageKey),
          nr: getal(s.position, 0),
          naam: faseNaam(s.stageKey),
          pct: getal(s.paymentPct, 0),
          bedrag: cents !== null ? bedragTekst(ctx, cents) : '',
          datum: s.approvedAt ? datumTekst(ctx, s.approvedAt) : '',
          status: tekst(s.status),
          statusLabel: stand.woord,
          statusToon: stand.toon,
          /* de uitklapregel: wie akkoord gaf (0021) en wat er op deze fase
             openstaat. Geen verzonnen tekst — het is de naam die op de fase
             staat en de factuurregel die er echt aan hangt, of niets. */
          openstaandeActie: samen([
            akkoordTekst(ctx, s),
            inv
              ? ('Factuur: ' + eersteTekst(inv.invoiceNumber, inv.label))
              : (getal(s.paymentPct, 0) ? 'Betaalmoment nog niet gefactureerd' : '')
          ]),
          kanFactureren: !!(faseFactuurHaak && getal(s.paymentPct, 0) > 0 && !inv),
          kanDatumBewerken: !!(faseDatumHaak && tekst(s.status) === 'done' && s.approvedAt)
        };
      }),
      statussen: faseStatusHaak ? FASE_VOLGORDE.map(function (k) {
        return { key: k, label: faseStand(k).woord };
      }) : [],
      onWissel: faseStatusHaak ? function (f, waarde, sel) {
        faseStatusHaak(project, f.sleutel, waarde, function () { sel.value = f.status; });
      } : null,
      onFactureer: faseFactuurHaak ? function (f) { faseFactuurHaak(project, f.sleutel); } : null,
      onBewerk: faseDatumHaak ? function (f) { faseDatumHaak(project, f.sleutel); } : null
    });

    var faseUitleg = faseStatusHaak ? ui.el('p', {
      class: 'u-sub', style: 'margin:12px 0 0;',
      text: 'Een fase op "Wacht op akkoord" zetten maakt automatisch de conceptfactuur voor het betaalmoment aan en vraagt daarna of de klant een mail krijgt.'
    }) : null;

    /* --- DE PROJECTWAARDE STAAT NIET MEER OP DEZE TAB ---
       De mappingtabel zet de waardebalk op tab Financiën, bovenaan, "want de
       fasebedragen worden daaruit berekend". Hij stond hier, met als
       verantwoording dat je hem bij de fasebalk nodig hebt. Dat argument
       klopt maar het is het argument voor een VERWIJZING, niet voor de balk
       zelf: de waarde is geld, hij hoort bij de facturen die eruit ontstaan,
       en op Financiën staat hij naast de facturen die hij niet meer
       herrekent — precies de waarschuwing die de mappingtabel meeverhuisd
       wil zien.
       Wat hier blijft is één regel, en die staat er alleen als er ook
       werkelijk iets aan de hand is: een betaalfase zonder projectwaarde.
       Dan weigert Factureer, en dan hoor je te weten waarom en waarheen. */
    var waardeCents = (typeof project.valueCents === 'number' && project.valueCents > 0)
      ? project.valueCents : null;
    var heeftBetaalfase = false;
    stages.forEach(function (s) { if (getal(s && s.paymentPct, 0) > 0) heeftBetaalfase = true; });
    var waardeWijzer = (!waardeCents && heeftBetaalfase) ? ui.el('p', {
      class: 'u-sub', style: 'margin:8px 0 0;',
      text: 'De projectwaarde is nog niet ingevuld, dus een betaalfase kan nog niet gefactureerd worden: het fasebedrag wordt eruit berekend. De waarde staat op de tab Financiën.'
    }) : null;

    /* --- DE ONBOARDINGCHECKLIST ---
       ZES FEITEN DIE ZICHZELF AFVINKEN, EN DAAROM GEEN AFVINKKNOP.
       Elk vinkje hieronder is een meting aan echte gegevens: staat er een
       NNN-document in het project, staat er een offerte, staat de eerste
       factuur op betaald, heeft de klant naam én e-mail, is er een
       uitnodiging verstuurd, en staat er een klantregel in het toegangslog
       van dit project. Precies dezelfde zes bronnen als de oude checklist.

       Er is bewust GEEN haak "onboardingAfvinken" in beheer.html, en er wordt
       er hier ook geen gemaakt: een handmatig vinkje zou een tweede waarheid
       naast die zes feiten zetten, en dan zegt de lijst "aanbetaling
       ontvangen" terwijl er geen betaalde factuur is. De weg naar een open
       punt loopt daarom via het punt zelf — de tekst zegt bij elk openstaand
       item waar het vandaan komt. */
    var onboardingKaart = onboardingBlok(ctx, ui, project);

    /* --- huidige sampleronde ---
       BRON: samples van dit project; de NIEUWSTE ronde telt, precies zoals
       computeSignals en collectInbox het doen. Oudere rondes zijn verdrongen. */
    var nieuwste = null;
    lijst(d.samples).forEach(function (sm) {
      if (!sm || sm.projectId !== project.id) return;
      if (!nieuwste || tekst(sm.roundDate) > tekst(nieuwste.roundDate)) nieuwste = sm;
    });

    var sampleBlok;
    if (nieuwste) {
      var st = SAMPLE_STAND[tekst(nieuwste.status)] || { woord: tekst(nieuwste.status), toon: 'neutraal' };
      /* DE KLANTBESLISSING (0021) STAAT NAAST DE STAFSTAND, NIET ERVOOR.
         status blijft van de staf; clientDecision/clientNote zeggen wat de
         klant in het portaal koos. Zonder beslissing komt er geen regel —
         een ronde van vóór 0021 of een ronde die nog wacht heeft er geen. */
      var beslissing = beslissingVan(nieuwste);
      var beslissingRegels = beslissing.key ? [
        ui.statusDot({ toon: beslissing.toon, label: beslissing.woord + (nieuwste.clientDecidedAt ? ' op ' + datumTekst(ctx, nieuwste.clientDecidedAt) : '') + ' via het portaal' }),
        tekst(nieuwste.clientNote) ? ui.el('span', { class: 'u-row-sub', text: '“' + tekst(nieuwste.clientNote) + '”' }) : null,
        lijst(nieuwste.clientMarks).length ? ui.el('span', { class: 'u-sub', text: nlAantal(lijst(nieuwste.clientMarks).length, 'aanwijzing op de foto', 'aanwijzingen op de foto') }) : null
      ] : [];
      var sampleHaak = haak(ctx, HAKEN.sampleGoedkeuren);
      var sampleKnop = sampleHaak ? ui.el('button', {
        type: 'button', class: 'u-btn ghost klein',
        style: 'margin-top:8px;',
        text: 'Ronde beoordelen of goedkeuren',
        onclick: function () { sampleHaak(nieuwste); }
      }) : null;
      var foto = '';
      lijst(d.media).forEach(function (m) {
        if (!foto && m && m.id === nieuwste.mediaId) foto = tekst(m.src);
      });
      sampleBlok = kaart(ui, [
        ui.el('div', { style: 'display:flex;gap:18px;align-items:flex-start;' }, [
          foto ? ui.el('img', {
            src: foto, alt: '', loading: 'lazy',
            style: 'width:120px;height:120px;border-radius:14px;object-fit:cover;flex:none;'
          }) : null,
          ui.el('div', { style: 'flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:4px;' }, [
            ui.el('span', { class: 'u-row-title', text: 'Ronde ' + tekst(nieuwste.roundLabel) }),
            ui.el('span', { class: 'u-row-sub', text: tekst(nieuwste.note) }),
            /* stip-plus-woord en de datum zijn allebei inline; de kolom
               hierboven houdt ze uit elkaar zonder een lege tussenregel */
            ui.statusDot({ toon: st.toon, label: st.woord }),
            beslissing.key ? ui.el('div', { style: 'display:flex;flex-direction:column;align-items:flex-start;gap:4px;' }, beslissingRegels) : null,
            ui.el('span', { class: 'u-sub', text: 'Ronde van ' + datumTekst(ctx, nieuwste.roundDate) }),
            /* GOEDKEUREN LOOPT VIA HET RONDEVENSTER, EN DAT IS EEN KEUZE.
               Daar staat de statuskeuze, en DS.updateSample verdringt bij
               'approved' de eerdere goedkeuringen. Een losse knop "Keur goed"
               zou die verdringing moeten nadoen — een tweede waarheid over
               welke ronde de geldige is. */
            sampleKnop
          ])
        ])
      ]);
    } else {
      sampleBlok = ui.emptyTile({
        icoon: 'camera',
        titel: 'Nog geen samplerondes',
        uitleg: 'Zodra er een sample uit de mal komt en je die vastlegt, staat de nieuwste ronde hier.',
        actie: sectieActie(ctx, HAKEN.sampleToevoegen, 'Sampleronde toevoegen',
          function (h) { h(project); })
      });
    }

    /* --- zendingen --- */
    var zendingen = [];
    lijst(d.shipments).forEach(function (s) {
      if (s && s.projectId === project.id) zendingen.push(s);
    });

    /* DE MIJLPAAL EN DE ETA ZITTEN IN HET ••• VAN DE ZENDINGRIJ.
       "Volgende mijlpaal afvinken" geeft geen mijlpaal mee: de haak neemt dan
       de eerstvolgende openstaande stap uit het sjabloon van deze zending —
       dezelfde keuze die de stille-zendingrij in de oude cockpit maakte. Bij
       een geleverde zending staat die rij er niet: er is dan niets meer af te
       vinken en de haak zou dat zelf melden.

       DE INHAALMODUS ONTBREEKT HIER BEWUST. openCatchupModal bestaat in
       beheer.html, maar er is geen haak voor in het actiecontract. Een knop
       die niets doet is erger dan een ontbrekende knop, dus hij staat er niet
       — dit is de plek waar hij hoort zodra de haak er is. */
    var zendingBlok = zendingen.length
      ? ui.entityList(zendingen.map(function (s) {
        var af = !!s.deliveredAt;
        return ui.entityRow({
          thumb: ui.iconTile({ icoon: 'projecten', toon: af ? 'klaar' : 'extern', maat: 40 }),
          titel: samen([tekst(s.type), tekst(s.carrierCode).toUpperCase()]),
          sub: samen([
            tekst(s.trackingNumber) ? 'Track & trace ' + tekst(s.trackingNumber) : '',
            tekst(s.containerNumber) ? 'Container ' + tekst(s.containerNumber) : '',
            tekst(s.blNumber) ? 'B/L ' + tekst(s.blNumber) : ''
          ]),
          chips: [ui.statusDot({
            toon: af ? 'klaar' : 'extern',
            label: af ? 'Geleverd op ' + datumTekst(ctx, s.deliveredAt) : 'Onderweg'
          })],
          meta: s.etaWindowEnd ? 'ETA-venster tot ' + datumTekst(ctx, s.etaWindowEnd) : '',
          /* menuGroepen en geen kale reeks: hij laat de null-rijen vallen van
             de haken die er niet zijn. Een kale reeks met twee nullen erin
             heeft lengte twee, en dan tekent CP_UI een ••• met "Geen acties
             beschikbaar" erin — een knop die niets doet, langs de achterdeur. */
          menu: menuGroepen([
            af ? null : haakRij(ctx, HAKEN.mijlpaal, 'Volgende mijlpaal afvinken', 'vinkje',
              function (h) { h(s); }),
            haakRij(ctx, HAKEN.eta, 'ETA bijwerken', 'klok', function (h) { h(s); })
          ])
        });
      }))
      : ui.emptyTile({
        icoon: 'projecten',
        titel: 'Nog geen zendingen',
        uitleg: 'Zodra er iets de fabriek verlaat, komt de zending hier te staan met zijn mijlpalen.',
        actie: sectieActie(ctx, HAKEN.zendingToevoegen, 'Zending toevoegen',
          function (h) { h(project); })
      });

    /* --- inspecties --- */
    var inspecties = [];
    lijst(d.inspections).forEach(function (i) {
      if (i && i.projectId === project.id) inspecties.push(i);
    });

    var inspectieBlok = inspecties.length
      ? ui.entityList(inspecties.map(function (i) {
        var defecten = lijst(i.defects).length;
        return ui.entityRow({
          thumb: ui.iconTile({ icoon: 'vinkje', toon: i.passed ? 'klaar' : 'kritiek', maat: 40 }),
          titel: samen([tekst(i.checkpoint).toUpperCase(), faseNaam(i.stageKey)]),
          sub: samen([tekst(i.contextLine), tekst(i.aqlNorm), 'steekproef ' + getalTekst(ctx, i.sampleSize)]),
          chips: [ui.statusDot({
            toon: i.passed ? 'klaar' : 'kritiek',
            label: i.passed ? 'Vrijgegeven' : 'Afgekeurd'
          })],
          meta: defecten ? nlAantal(defecten, 'bevinding', 'bevindingen') : 'Geen bevindingen'
        });
      }))
      : ui.emptyTile({
        icoon: 'vinkje',
        titel: 'Nog geen inspecties',
        uitleg: 'IQC, IPQC en FQC verschijnen hier zodra er een rapport van is.',
        actie: sectieActie(ctx, HAKEN.inspectie, 'Inspectie vastleggen',
          function (h) { h(project); })
      });

    /* de volgorde is die van het migratieplan (fase 4, tab Overzicht):
       onboarding, fases, samplerondes, inspecties, zendingen — de volgorde
       waarin een project ze doorloopt. De projectwaarde staat sinds deze
       ronde op tab Financiën; de link in de sectiekop hieronder is de weg
       erheen en hij navigeert echt. */
    return ui.el('div', null, [
      onboardingKaart,
      onboardingKaart ? ruimte(ui, 20) : null,
      sectie(ui, ui.sectionHead({
        titel: 'Fases',
        actie: {
          label: 'Projectwaarde en facturen', ico: 'chevron',
          onClick: function () {
            navigeer(ctx, { area: 'projecten', id: project.id, tab: 'financien' });
          }
        }
      }), [
        pad ? kaart(ui, [pad]) : null,
        pad ? ruimte(ui, 16) : null,
        faseBalk,
        faseUitleg,
        waardeWijzer
      ]),
      sectie(ui, ui.sectionHead({
        titel: 'Huidige sampleronde',
        actie: sectieActie(ctx, HAKEN.sampleToevoegen, 'Sampleronde toevoegen',
          function (h) { h(project); })
      }), [sampleBlok]),
      sectie(ui, ui.sectionHead({
        titel: 'Inspecties',
        actie: sectieActie(ctx, HAKEN.inspectie, 'Inspectie vastleggen',
          function (h) { h(project); })
      }), [inspectieBlok]),
      sectie(ui, ui.sectionHead({
        titel: 'Verzendingen',
        actie: sectieActie(ctx, HAKEN.zendingToevoegen, 'Zending toevoegen',
          function (h) { h(project); })
      }), [zendingBlok])
    ]);
  };

  /* ---------------------------------------------------------------
     DE ONBOARDINGCHECKLIST

     Zes feiten, elk gemeten aan een echte bron. Dit is dezelfde lijst als
     het oude projectdetail hem toonde, met dezelfde metingen — alleen de
     vorm is nieuw. Er is geen afvinkknop en er komt er ook geen: zie de
     toelichting bij de aanroep hierboven.

     De checklist verdwijnt bij een gearchiveerd project, precies zoals in de
     oude vorm: onboarding van een afgesloten project is geen open werk meer.
     --------------------------------------------------------------- */
  var onboardingBlok = function (ctx, ui, project) {
    var model = MOD(ctx);
    if (model && fn(model.isArchived) && model.isArchived(project)) return null;

    var d = D(ctx);
    var klant = klantVan(ctx, project);

    var heeftDoc = function (soort) {
      var raak = false;
      lijst(d.documents).forEach(function (doc) {
        if (raak || !doc || doc.projectId !== project.id) return;
        if (tekst(doc.docType) === soort) raak = true;
      });
      return raak;
    };

    var betaald = false;
    lijst(d.invoices).forEach(function (inv) {
      if (betaald || !inv || inv.projectId !== project.id) return;
      if (tekst(inv.status) === 'paid') betaald = true;
    });

    var klantActief = false;
    lijst(d.log).forEach(function (r) {
      if (klantActief || !r || r.projectId !== project.id) return;
      if (tekst(r.actor) === 'client') klantActief = true;
    });

    var punten = [
      { label: 'NNN getekend', af: heeftDoc('nnn'),
        bron: 'vinkt af zodra er een NNN-document in dit project staat' },
      { label: 'Offerte gedeeld', af: heeftDoc('quote'),
        bron: 'vinkt af zodra er een offerte-document in dit project staat' },
      { label: 'Aanbetaling ontvangen', af: betaald,
        bron: 'vinkt af zodra de eerste factuur van dit project op betaald staat' },
      { label: 'Contactpersoon ingesteld', af: !!(klant && tekst(klant.contactName) && tekst(klant.email)),
        bron: 'naam én e-mail op de klantkaart' },
      { label: 'Uitnodiging verstuurd', af: !!(klant && klant.invitedAt),
        bron: 'via Toegang & veiligheid op de klantkaart' },
      { label: 'Eerste portaalactiviteit', af: klantActief,
        bron: 'vinkt af bij de eerste klantregel in het toegangslogboek van dit project' }
    ];

    var af = 0;
    punten.forEach(function (p) { if (p.af) af++; });
    var compleet = af === punten.length;

    return kaart(ui, [
      ui.sectionHead({
        kicker: af + ' van ' + punten.length + ' klaar',
        titel: compleet ? 'Onboarding compleet' : 'Onboarding'
      }),
      ui.el('div', { class: 'u-meta' }, punten.map(function (p) {
        return ui.el('div', { class: 'u-meta-cel' }, [
          ui.el('span', { class: 'u-meta-label' }, ui.el('span', { text: p.label })),
          ui.el('span', { class: 'u-meta-waarde' }, [
            ui.statusDot({ toon: p.af ? 'klaar' : 'wacht', label: p.af ? 'Klaar' : 'Open' })
          ]),
          p.af ? null : ui.el('span', { class: 'u-row-sub', text: p.bron })
        ]);
      })),
      compleet ? null : ui.el('p', {
        class: 'u-sub', style: 'margin:14px 0 0;',
        text: 'Deze zes punten vinken zichzelf af op echte gegevens; er is bewust geen handmatig vinkje, want dat zou een tweede waarheid naast die gegevens zetten.'
      })
    ]);
  };

  /* --- tab Tijdlijn --- */
  var tabTijdlijn = function (ctx, ui, project) {
    var rijen = activiteit(ctx, { projectId: project.id, limit: 60 });
    return ui.timeline(rijen, {
      formatteerTijd: function (at) { return tijdTekst(ctx, at); },
      leegTitel: 'Nog geen activiteit op dit project',
      leegUitleg: 'Elke publicatie, elke mail, elke goedkeuring en elke mijlpaal komt hier vanzelf te staan.'
    });
  };

  /* --- tab Bestanden & foto's ---
     Per rij staat er met zoveel woorden bij of iets intern is, of de klant
     hem ziet, en of hij met de fabriek gedeeld is. Dat is de eis uit de
     IA-spec en het is ook de enige manier waarop deze lijst veilig is. */
  var tabBestanden = function (ctx, ui, project) {
    var d = D(ctx);
    var data = DAT(ctx);
    var faseNaam = faseNaamVan(ctx);
    var fabrieken = indexOp(lijst(d.factories), 'id');

    var zichtbaarheid = function (rij) {
      return rij.publishStatus === 'concept'
        ? { woord: 'Concept, de klant ziet dit nog niet', toon: 'wacht' }
        : { woord: 'Zichtbaar voor de klant', toon: 'klaar' };
    };

    var fotoRijen = [];
    lijst(d.media).forEach(function (m) {
      if (!m || m.projectId !== project.id) return;
      var z = zichtbaarheid(m);
      fotoRijen.push(ui.entityRow({
        thumb: tekst(m.src),
        titel: eersteTekst(m.caption, 'Foto zonder omschrijving'),
        sub: samen([faseNaam(m.stageKey), m.factoryId && fabrieken[m.factoryId] ? 'gemaakt bij ' + tekst(fabrieken[m.factoryId].name) : '']),
        chips: [ui.statusDot({ toon: z.toon, label: z.woord })],
        meta: m.capturedAt ? datumTekst(ctx, m.capturedAt) : '',
        /* VERWIJDEREN ZONDER BEVESTIGINGSVRAAG, MET ONGEDAAN MAKEN.
           De haak loopt door verwijderMetUndo: zachte verwijdering plus
           vijftien seconden "Maak ongedaan". Een bevestigingsvraag ervoor
           zou een tweede weg naast dat vangnet zijn — en dat is precies de
           weg die deze app bewust nergens neemt (archiveren doet het al zo).
           De kritieke kleur en de plaats onderin het menu dragen het
           gewicht.

           KOPIËREN NAAR EEN ANDER PROJECT (functie 51) STAAT ER SINDS DEZE
           RONDE BIJ. De haak mediaKopierenNaar opent openCopyToProjectModal
           met deze ene foto erin; de kopie landt als CONCEPT in het
           doelproject, zodat publiceren daar een bewuste stap blijft. Het is
           geen verwijdering en geen bewerking van dit item, dus hij staat in
           de eerste groep, ná bewerken. */
        menu: menuGroepen([
          haakRij(ctx, HAKEN.fotoBewerken, 'Foto bewerken', 'potlood',
            function (h) { h(m); }),
          /* icoon 'projecten' en niet een kopieersymbool: dat staat niet in
             de ICONEN-tabel van CP_UI en zou een leeg <svg> opleveren. Deze
             wijst naar waar de kopie heen gaat, en dat is de kern. */
          haakRij(ctx, HAKEN.fotoKopieren, 'Kopieer naar een ander project', 'projecten',
            function (h) { h(m); })
        ], [
          haakRij(ctx, HAKEN.fotoVerwijderen, 'Foto verwijderen', 'sluiten',
            function (h) { h(m); }, true)
        ])
      }));
    });

    /* DE TWEE PDF-CHIPS, EN WAAROM ZE HIER MOETEN STAAN.
       De mappingtabel eist ze letterlijk: "de chips 'PDF nog uploaden' en
       'PDF verouderd' blijven zichtbaar". Ze zeggen allebei iets wat je
       nergens anders ziet en waar de KLANT wél tegenaan loopt:

         PDF nog uploaden  een factuurdocument ontstaat bij het printen,
                           zónder bestand — er is geen serverside
                           PDF-generatie. Zolang er niets is geüpload, ziet
                           de klant in het portaal "PDF volgt" en geen
                           download.
         PDF verouderd     fileStale: de factuur is ná het uploaden nog
                           bewerkt, dus de PDF die de klant kan downloaden
                           toont oudere gegevens dan de factuur zelf.

       DE VELDNAAM VERSCHILT PER MODUS, DE VRAAG NIET. Demomodus bewaart het
       bestand als fileRef, Supabase als storagePath. Beide leeg is in beide
       modi hetzelfde antwoord: er is geen bestand. Daarom kijken we naar
       allebei in plaats van naar de modus — één regel minder om fout te
       hebben. De modus bepaalt alleen nog wat de klant in plaats daarvan
       ziet, en dat is precies het verschil dat de oude rij ook maakte. */
    var demo = !(data && fn(data.modus) && tekst(data.modus()) === 'supa');

    var docRijen = [];
    lijst(d.documents).forEach(function (doc) {
      if (!doc || doc.projectId !== project.id) return;
      var z = zichtbaarheid(doc);
      var geenBestand = tekst(doc.docType) === 'invoice'
        && !tekst(doc.fileRef) && !tekst(doc.storagePath);
      var oudeBestand = !!doc.fileStale && !geenBestand;

      var chips = [ui.statusDot({ toon: z.toon, label: z.woord })];
      if (geenBestand) chips.push(ui.statusChip({ label: 'PDF nog uploaden', toon: 'wacht' }));
      if (oudeBestand) chips.push(ui.statusChip({ label: 'PDF verouderd', toon: 'wacht' }));

      docRijen.push(ui.entityRow({
        thumb: ui.iconTile({
          icoon: 'bestand',
          toon: (geenBestand || oudeBestand) ? 'wacht' : 'neutraal',
          maat: 40
        }),
        titel: tekst(doc.title),
        /* de eerlijke regels van de oude rij gaan mee: zonder die zin is
           "PDF nog uploaden" een waarschuwing zonder gevolg, en juist het
           gevolg (wat de klant ziet) is de reden dat de chip bestaat */
        sub: samen([
          tekst(doc.docType).toUpperCase(),
          faseNaam(doc.stageKey),
          'versie ' + getalTekst(ctx, doc.version),
          geenBestand
            ? (demo
              ? 'de klant ziet de demo-uitleg in plaats van een bestand'
              : 'de klant ziet "PDF volgt", nog geen download')
            : '',
          oudeBestand ? 'de PDF dateert van vóór de laatste factuurwijziging' : ''
        ]),
        chips: chips,
        meta: doc.createdAt ? datumTekst(ctx, doc.createdAt) : '',
        /* HET ••• VAN DE DOCUMENTRIJ — dezelfde drie knoppen die het oude
           projectdetail hier had, en in dezelfde vorm als bij de fotorij
           hierboven: bewerken en kopiëren bovenaan, verwijderen onderin in
           de kritieke kleur.
           Bewerken is stil: titel, fase, type, versie en de koppeling aan een
           zending of factuur, zonder klantmail — een correctie is geen
           gebeurtenis. Verwijderen loopt door verwijderMetUndo, dus met
           vijftien seconden "Maak ongedaan" en zonder vraag vooraf; het slot
           dat dit document ooit vulde, valt daardoor vanzelf weer open. */
        menu: menuGroepen([
          haakRij(ctx, HAKEN.documentBewerken, 'Document bewerken', 'potlood',
            function (h) { h(doc); }),
          haakRij(ctx, HAKEN.documentKopieren, 'Kopieer naar een ander project', 'projecten',
            function (h) { h(doc); })
        ], [
          haakRij(ctx, HAKEN.documentVerwijderen, 'Document verwijderen', 'sluiten',
            function (h) { h(doc); }, true)
        ])
      }));
    });

    /* ---- DE OPEN DOCUMENTSLOTS (functie 52) ----
       Een slot is een VERWACHTING: "hier hoort nog een compliance-document
       te komen". De klant ziet het slot ook, dus een slot dat je niet meer
       verwacht hoort weg te kunnen.
       WANNEER IS EEN SLOT OPEN? Precies zoals slotIsOpen() in het oude
       projectdetail: er hangt geen document aan, óf het document waar het aan
       hing bestaat niet meer. Die tweede helft is de reden dat een verwijderd
       document zijn slot vanzelf weer openzet.
       De rijen staan ónder de documenten in dezelfde lijst, zodat de lege
       stand er alleen komt als er ook echt niets is — documenten noch
       verwachtingen. Het chipwoord "Verwacht" draagt het verschil. */
    /* alleen de documenten van DIT project, precies zoals slotIsOpen() ze
       kreeg: de lijst hierboven is de platte lijst van de hele app, en een
       document uit een ander project mag een slot hier niet dichtzetten */
    var docIds = {};
    lijst(d.documents).forEach(function (r) {
      if (r && r.id && r.projectId === project.id) docIds[r.id] = true;
    });

    var slotRijen = [];
    slotsVan(d).forEach(function (sl) {
      if (!sl || sl.projectId !== project.id) return;
      if (sl.documentId && docIds[sl.documentId]) return;

      slotRijen.push(ui.entityRow({
        thumb: ui.iconTile({ icoon: 'bestand', toon: 'wacht', maat: 40 }),
        /* geen tweede typetabel: de documentrijen hierboven tonen hun type
           ook als de kale sleutel in hoofdletters, en docTypeLabel() woont in
           het afgesloten scriptblok van beheer.html */
        titel: tekst(sl.docType).toUpperCase() || 'Document',
        sub: samen([
          faseNaam(sl.stageKey) ? 'wordt verwacht in fase ' + faseNaam(sl.stageKey) : 'wordt verwacht',
          'de klant ziet dit slot ook'
        ]),
        chips: [ui.statusChip({ label: 'Verwacht', toon: 'wacht' })],
        meta: '',
        menu: menuGroepen([
          haakRij(ctx, HAKEN.slotVullen, 'Vul slot', 'plus',
            function (h) { h(project, sl); })
        ], [
          /* DE ENIGE GEVAARLIJKE RIJ IN DIT BESTAND MET EEN VRAAG VOORAF.
             Een slot gaat niet door de prullenbak: DS.deleteDocSlot() gooit
             de rij echt weg en er is niets om terug te zetten. Een
             ongedaan-maken-melding zou een herstel beloven dat de datalaag
             niet kan waarmaken, dus staat de bescherming vóór de handeling in
             plaats van erna. Het document dat het slot ooit vulde blijft
             gewoon staan; alleen de verwachting verdwijnt, en dat zegt de
             vraag er ook bij. */
          haakRij(ctx, HAKEN.slotVerwijderen, 'Verwijder slot', 'sluiten',
            function (h) { h(sl); }, true, {
              vraag: 'Dit slot weghalen kan niet ongedaan gemaakt worden. Een document dat het slot ooit vulde blijft staan; alleen de verwachting verdwijnt, ook bij de klant.',
              bevestigLabel: 'Verwijder slot'
            })
        ])
      }));
    });

    /* DE OMSCHRIJVING VAN EEN DISCLOSURE BESTAAT LIVE NIET.
       Het vrije omschrijvingsveld zit wel in de demodata maar niet in de
       Supabase-tabel; de datalaag zegt dat zelf met de vlag
       disclosureOmschrijving. Lazen we `what` blind, dan zou deze rij in
       demomodus compleet ogen en live een TITELLOZE rij zijn met alleen
       "gedeeld met Fabriek Chen · op 26 mei 2026" — precies het soort verschil
       dat je in demomodus per definitie nooit ziet.
       Zolang de kolom er niet is, benoemen we het gedeelde bestand in plaats van
       een lege titel te tonen. Zodra de kolom er wél is (zie de restpost in
       beheer.html bij disclosureOmschrijving) valt deze terugval vanzelf weg. */
    var disOmschrijving = !!(ctx && ctx.ds && ctx.ds.disclosureOmschrijving);
    var disRijen = [];
    lijst(d.disclosures).forEach(function (dis) {
      if (!dis || dis.projectId !== project.id) return;
      var fab = fabrieken[dis.factoryId];
      var wat = disOmschrijving ? tekst(dis.what) : '';
      disRijen.push(ui.entityRow({
        thumb: ui.iconTile({ icoon: 'fabriek', toon: dis.underNnn ? 'klaar' : 'kritiek', maat: 40 }),
        titel: wat || tekst(dis.assetName) || tekst(dis.fileName) || 'Gedeeld bestand',
        sub: samen(['gedeeld met ' + (fab ? tekst(fab.name) : 'een fabriek'),
          dis.disclosedAt ? 'op ' + datumTekst(ctx, dis.disclosedAt) : '']),
        chips: [ui.statusDot({
          toon: dis.underNnn ? 'klaar' : 'kritiek',
          label: dis.underNnn ? 'Onder NNN gedeeld' : 'Geen NNN vastgelegd'
        })]
      }));
    });

    return ui.el('div', null, [
      sectie(ui, ui.sectionHead({
        titel: "Foto's",
        actie: sectieActie(ctx, HAKEN.fotoToevoegen, 'Foto toevoegen',
          function (h) { h(project); })
      }), [
        sleepvak(ctx, ui, project),
        ui.entityList(fotoRijen, {
          leegTitel: "Nog geen foto's",
          leegUitleg: 'Foto’s uit de fabriek komen hier te staan, met per foto of de klant hem al ziet.'
        })
      ]),
      sectie(ui, ui.sectionHead({
        titel: 'Documenten',
        /* EEN DOCUMENTSLOT VULT ZICHZELF BIJ HET UPLOADEN.
           Nagelopen in beheer.html: openDocumentModal krijgt de slots van dit
           project mee en vult zonder expliciet slot vanzelf een openstaand
           slot van HETZELFDE TYPE — uploaden ís een slot vullen. Er is dus
           niets aan te wijzen in het venster, en de regel hieronder zegt wat
           er werkelijk gebeurt in plaats van een keuze te beloven die er niet
           is.
           DE "VERWACHT"-RIJEN VAN OPEN SLOTS STAAN ER SINDS DEZE RONDE.
           iaLaadLijsten() levert de slotenlijst mee (slotsVan) en allebei de
           haken bestaan, dus de rij draagt weer zijn twee knoppen: "Vul slot"
           opent het documentvenster voorgevuld met type, fase en slot-id, en
           "Verwijder slot" haalt de verwachting weg. Ze staan onderaan
           dezelfde lijst als de documenten; het chipwoord "Verwacht" is het
           verschil. Zie de kicker hieronder voor de telling. */
        actie: sectieActie(ctx, HAKEN.documentToevoegen, 'Document toevoegen',
          function (h) { h(project); }),
        kicker: slotRijen.length
          ? nlAantal(slotRijen.length, 'slot wordt nog verwacht', 'slots worden nog verwacht')
          : null
      }), [
        haak(ctx, HAKEN.documentToevoegen) ? ui.el('p', {
          class: 'u-sub', style: 'margin:0 0 12px;',
          text: 'Kies in het venster de fase en het type; staat er een documentslot van datzelfde type open, dan valt dat bij het opslaan vanzelf dicht.'
        }) : null,
        ui.entityList(docRijen.concat(slotRijen), {
          leegTitel: 'Nog geen documenten',
          leegUitleg: 'Offertes, rapporten en overeenkomsten van dit project staan hier.'
        })
      ]),
      sectie(ui, ui.sectionHead({
        titel: 'Gedeeld met een fabriek',
        actie: sectieActie(ctx, HAKEN.disclosure, 'Disclosure vastleggen',
          function (h) { h(project); })
      }), [
        ui.entityList(disRijen, {
          leegTitel: 'Nog niets met een fabriek gedeeld',
          leegUitleg: 'Zodra er productiebestanden de deur uit gaan, wordt hier vastgelegd wat, met wie en onder welke NNN.'
        })
      ])
    ]);
  };

  /* ---------------------------------------------------------------
     SLEPEN EN PLAKKEN (functie 48)

     De haak mediaToevoegen neemt een tweede argument: een lijst bestanden.
     Die gaat rechtstreeks door naar openMediaModal, hetzelfde venster als de
     knop opent — er komt dus geen tweede uploadweg naast.

     PLAKKEN HOEFT HIER NIETS. Beheer.html luistert al op document naar een
     plakactie en gebruikt daarvoor projectPageCtx, die de router per
     projectroute vult. Dat werkt dus op elke tab van dit project, en een
     tweede luisteraar hier zou hetzelfde plakje twee keer openen. De regel
     eronder vertelt alleen dát het kan.

     GEEN LUISTERAAR BUITEN DEZE BOOM. Beide gebeurtenissen hangen aan het vak
     zelf; verdwijnt het scherm, dan verdwijnen ze mee. Er is dus niets op te
     ruimen en dit scherm hoeft geen stop() te melden.
     --------------------------------------------------------------- */
  var sleepvak = function (ctx, ui, project) {
    var h = haak(ctx, HAKEN.fotoToevoegen);
    if (!h) return null;

    var vak = ui.el('div', {
      /* .u-emptytile geeft de gestreepte lege vorm uit §4.21; de streepjesrand
         en de overgang staan inline omdat admin-ui.css geen sleepvak kent. */
      class: 'u-emptytile',
      style: 'border:1px dashed var(--line-ctrl);margin-bottom:14px;transition:background .2s ease;'
    }, [
      ui.icon('camera', 28),
      ui.el('span', { class: 'u-emptytile-title', text: "Sleep foto's hierheen" }),
      ui.el('span', {
        class: 'u-emptytile-text',
        text: 'Of plak een schermafbeelding met ⌘V — dat werkt overal op deze projectpagina. In beide gevallen opent hetzelfde venster als de knop hierboven.'
      }),
      ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', text: 'Kies bestanden',
        onclick: function () { h(project); }
      })
    ]);

    var aan = function (e) {
      e.preventDefault();
      vak.style.background = 'var(--tint-ink)';
    };
    var uit = function (e) {
      e.preventDefault();
      vak.style.background = '';
    };
    vak.addEventListener('dragover', aan);
    vak.addEventListener('dragenter', aan);
    vak.addEventListener('dragleave', uit);
    vak.addEventListener('drop', function (e) {
      uit(e);
      var bestanden = e.dataTransfer && e.dataTransfer.files;
      /* niets erbij? Dan is er niets gesleept wat we kunnen opslaan, en dan
         is het venster openen met een lege lijst misleidend. */
      if (!bestanden || !bestanden.length) return;
      h(project, bestanden);
    });
    return vak;
  };

  /* --- tab Financiën ---
     Alleen lezen. De factuurmodule wordt op dit moment in beheer.html
     gebouwd; dit scherm toont wat er staat en linkt naar de eigen route
     van een factuur, maar raakt geen enkele factuuractie aan. */
  var tabFinancien = function (ctx, ui, project) {
    var d = D(ctx);
    var data = DAT(ctx);
    var model = MOD(ctx);
    var faseNaam = faseNaamVan(ctx);
    var vandaag = dagVan(ctx, nuVan(ctx));

    var facturen = [];
    lijst(d.invoices).forEach(function (inv) {
      if (inv && inv.projectId === project.id) facturen.push(inv);
    });

    var totaal = 0, betaald = 0, openstaand = 0;
    facturen.forEach(function (inv) {
      var bedrag = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv.amountCents, 0);
      var isConcept = model && fn(model.isConceptRow) ? model.isConceptRow(inv) : false;
      if (isConcept) return;
      totaal += bedrag;
      var b = (data && fn(data.factuurBetaaldCents)) ? data.factuurBetaaldCents(inv) : (inv.status === 'paid' ? bedrag : 0);
      betaald += b;
      openstaand += Math.max(0, bedrag - b);
    });

    var rijen = facturen.map(function (inv) {
      var bedrag = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv.amountCents, 0);
      var isConcept = model && fn(model.isConceptRow) ? model.isConceptRow(inv) : false;
      var verval = (model && fn(model.invoiceDueISO)) ? model.invoiceDueISO(inv) : null;
      var stand;
      if (isConcept) stand = { woord: 'Concept', toon: 'wacht' };
      else if (inv.status === 'paid') stand = { woord: 'Betaald', toon: 'klaar' };
      else if (verval && verval < vandaag) stand = { woord: 'Te laat', toon: 'kritiek' };
      else stand = { woord: 'Openstaand', toon: 'extern' };
      return factuurRij(ctx, ui, {
        titel: samen([tekst(inv.invoiceNumber), tekst(inv.label)]),
        sub: samen([faseNaam(inv.stageKey), inv.createdAt ? 'aangemaakt ' + datumTekst(ctx, inv.createdAt) : '']),
        bedrag: bedragTekst(ctx, bedrag),
        datum: verval ? 'vervalt ' + datumTekst(ctx, verval) : '',
        stand: stand,
        onOpen: function () { navigeer(ctx, { area: 'factuur', id: inv.id }); },
        menu: factuurMenu(ctx, inv, isConcept)
      });
    });

    /* --- FACTUREREN PER FASE ---
       De betaalfases van dit project die nog geen factuur hebben. Dezelfde
       haak als de knop Factureer in de fasebalk op de tab Overzicht: twee
       ingangen, één bron. Hier hoort hij thuis omdat je vanuit het geld
       kijkt; daar omdat je vanuit de fase kijkt.
       De haak weigert zelf zolang de projectwaarde leeg is — het fasebedrag
       wordt daaruit berekend — en zegt dat met zoveel woorden. */
    var teFactureren = [];
    var factuurHaak = haak(ctx, HAKEN.faseFactureren);
    if (factuurHaak) {
      var metFactuur = {};
      facturen.forEach(function (inv) { if (inv && inv.stageKey) metFactuur[inv.stageKey] = true; });
      fasesGesorteerd(project).forEach(function (s) {
        if (!s || getal(s.paymentPct, 0) <= 0) return;
        if (metFactuur[tekst(s.stageKey)]) return;
        var waarde = (typeof project.valueCents === 'number' && project.valueCents > 0)
          ? Math.round(project.valueCents * getal(s.paymentPct, 0) / 100) : null;
        teFactureren.push(ui.entityRow({
          thumb: ui.iconTile({ icoon: 'financien', toon: 'wacht', maat: 40 }),
          titel: 'Fase ' + getal(s.position, 0) + ' — ' + faseNaam(s.stageKey),
          sub: getal(s.paymentPct, 0) + '% betaalmoment'
            + (waarde !== null ? ' · voorstel ' + bedragTekst(ctx, waarde) : ' · projectwaarde nog niet ingevuld'),
          chips: [ui.statusDot({ toon: 'wacht', label: 'Nog niet gefactureerd' })],
          menu: menuGroepen([
            haakRij(ctx, HAKEN.faseFactureren, 'Factureer deze fase', 'financien',
              function (h) { h(project, s.stageKey); })
          ])
        }));
      });
    }

    /* --- DE PROJECTWAARDEBALK, BOVENAAN ---
       De mappingtabel wijst hem hier aan: "tab Financiën, bovenaan", omdat
       de fasebedragen eruit worden berekend (waarde × betaalpercentage).
       Hij stond op tab Overzicht en werkte daar functioneel prima; wat hij
       daar miste is zijn context. Hier staat hij naast de facturen waar hij
       over gaat, en dus ook naast de waarschuwing die de mappingtabel
       expliciet mee wil verhuizen.

       DE WAARSCHUWING IS GEEN NIEUWE TEKST. Hij staat woordelijk in
       openProjectValueModal en gaat over hetzelfde: een nieuwe waarde
       verandert bestaande facturen niet, alleen de bedragen die nog berekend
       worden. Hier zegt hij het vóórdat je het venster opent, want dit is de
       plek waar je die facturen ziet staan. Het getal komt uit deze lijst en
       niet uit een tweede telling. */
    var waardeCents = (typeof project.valueCents === 'number' && project.valueCents > 0)
      ? project.valueCents : null;
    var waardeHaak = haak(ctx, HAKEN.projectwaarde);
    var echteFacturen = facturen.filter(function (inv) {
      return !(model && fn(model.isConceptRow) && model.isConceptRow(inv));
    }).length;

    var waardeKaart = kaart(ui, [
      ui.sectionHead({
        titel: 'Projectwaarde',
        actie: sectieActie(ctx, HAKEN.projectwaarde,
          waardeCents ? 'Waarde bijwerken' : 'Waarde invullen',
          function (h) { h(project); }, 'potlood')
      }),
      ui.el('span', {
        class: 'u-groot',
        text: waardeCents ? bedragTekst(ctx, waardeCents) : 'Nog niet ingevuld'
      }),
      ui.el('p', {
        class: 'u-sub', style: 'margin:8px 0 0;',
        text: waardeCents
          ? 'Elk fasebedrag is deze waarde maal het betaalpercentage van die fase.'
          : (waardeHaak
            ? 'Zolang deze waarde leeg is, kan een fase niet gefactureerd worden: het fasebedrag wordt eruit berekend.'
            : 'Zolang deze waarde leeg is, kan een fase niet gefactureerd worden. Invullen loopt via het beheerscherm en is nog niet aan dit scherm gekoppeld.')
      }),
      echteFacturen ? ui.el('p', {
        class: 'u-sub', style: 'margin:6px 0 0;',
        text: 'Let op: er ' + (echteFacturen === 1 ? 'bestaat al 1 factuur' : 'bestaan al ' + echteFacturen + ' facturen')
          + ' bij dit project. Een nieuwe waarde verandert die facturen niet — alleen de bedragen die nog berekend worden.'
      }) : null
    ]);

    return ui.el('div', null, [
      waardeKaart,
      ruimte(ui, 20),
      ui.statRow([
        ui.statTile({ label: 'Gefactureerd', waarde: bedragTekst(ctx, totaal), sub: 'concepten tellen niet mee' }),
        ui.statTile({ label: 'Betaald', waarde: bedragTekst(ctx, betaald), toon: 'klaar' }),
        ui.statTile({ label: 'Openstaand', waarde: bedragTekst(ctx, openstaand), toon: openstaand ? 'wacht' : 'klaar' })
      ]),
      teFactureren.length
        ? sectie(ui, ui.sectionHead({ titel: 'Nog te factureren fases' }), [
          ui.entityList(teFactureren)
        ])
        : null,
      sectie(ui, ui.sectionHead({ titel: 'Facturen van dit project'}), [
        ui.entityList(rijen, {
          leegTitel: 'Nog geen facturen',
          leegUitleg: 'Een factuur ontstaat bij een fase met een betaalmoment, of met de hand vanuit Financiën.'
        })
      ])
    ]);
  };

  /* DE ACTIES VAN ÉÉN FACTUURRIJ.
     Per stand een andere set, want een concept kun je niet betaald melden en
     een betaalde factuur hoeft geen herinnering. Openen in de editor is de
     rij zelf, dus die staat hier niet nog een keer.

     ANNULEREN LOOPT VIA DE FACTUUREDITOR, EN DAT IS GEEN OMWEG. Het
     annuleervenster werkt op de volledige editorstaat en die bestaat pas als
     de editor getekend is; de haak brengt je erheen en opent het daar. Zo
     komt er geen tweede annuleerweg naast. De bevestiging staat in dat
     venster — hier is de rij alleen kritiek gekleurd en staat hij onderin. */
  var factuurMenu = function (ctx, inv, isConcept) {
    var betaald = tekst(inv.status) === 'paid';
    var handelingen = [];

    if (isConcept) {
      handelingen.push(haakRij(ctx, HAKEN.factuurPubliceren, 'Publiceren en versturen', 'vinkje',
        function (h) { h(inv); }));
    } else {
      if (!betaald) {
        handelingen.push(haakRij(ctx, HAKEN.factuurBetaald, 'Betaald markeren', 'financien',
          function (h) { h(inv); }));
        handelingen.push(haakRij(ctx, HAKEN.factuurHerinnering, 'Herinnering sturen', 'mail',
          function (h) { h(inv); }));
      }
      handelingen.push(haakRij(ctx, HAKEN.factuurPdf, 'Factuurdocument bekijken', 'bestand',
        function (h) { h(inv); }));
    }

    return menuGroepen(handelingen, [
      haakRij(ctx, HAKEN.factuurAnnuleren, 'Factuur annuleren', 'sluiten',
        function (h) { h(inv); }, true)
    ]);
  };

  /* §5.7 factuurrij. Vijf vaste sloten uit admin-ui.css hoofdstuk 8o; er
     is geen CP_UI-component voor, dus hij staat hier één keer.

     MET ••• WORDT DE RIJ EEN DUO EN GEEN KNOP-IN-EEN-KNOP. Dezelfde
     splitsing die CP_UI.entityRow maakt, maar andersom uitgevoerd: de rij
     BLIJFT hier de <button> en het menu komt ernaast te staan. Dat is met
     opzet — de lijstsneltoetsen van beheer.html melden 'button.u-invoicerow'
     aan voor j/k/Enter, en een klasse die naar een omhulsel verhuist, laat
     die toetsen stil over deze lijst heen lopen. */
  var factuurRij = function (ctx, ui, r) {
    var stand = opt(r.stand);
    var menuItems = lijst(r.menu);
    var knop = ui.el('button', {
      type: 'button', class: 'u-invoicerow',
      onclick: fn(r.onOpen) || null
    }, [
      ui.iconTile({ icoon: 'financien', toon: stand.toon, maat: 40 }),
      ui.el('span', { class: 'u-invoicerow-main' }, [
        ui.el('span', { class: 'u-invoicerow-titel', text: tekst(r.titel) }),
        ui.el('span', { class: 'u-invoicerow-sub', text: tekst(r.sub) })
      ]),
      ui.el('span', { class: 'u-invoicerow-geld' }, [
        ui.el('span', { class: 'u-invoicerow-bedrag', text: tekst(r.bedrag) }),
        ui.el('span', { class: 'u-invoicerow-datum', text: tekst(r.datum) })
      ]),
      ui.el('span', { class: 'u-invoicerow-status' }, ui.statusDot({ toon: stand.toon, label: stand.woord })),
      /* het chevronnetje is de belofte "hier zit iets achter"; met een •••
         ernaast zou hij naast een tweede eindteken staan */
      menuItems.length ? null : ui.icon('chevron', 18)
    ]);
    if (!menuItems.length) return knop;

    knop.style.flex = '1 1 auto';
    knop.style.minWidth = '0';
    return ui.el('div', {
      /* admin-ui.css kent geen omhulsel voor "rij plus •••"; dit zijn de
         twee eigenschappen die de knop en het menu op één lijn houden */
      style: 'display:flex;align-items:center;'
    }, [
      knop,
      ui.el('span', { style: 'flex:none;padding-right:16px;' }, ui.contextMenu({
        knop: { titel: 'Meer acties bij: ' + tekst(r.titel) },
        items: menuItems
      }).el)
    ]);
  };

  /* --- tab Communicatie --- */
  var tabCommunicatie = function (ctx, ui, project) {
    var d = D(ctx);
    var data = DAT(ctx);
    var klant = klantVan(ctx, project);
    var faseNaam = faseNaamVan(ctx);

    var vragen = [];
    lijst(d.questions).forEach(function (q) {
      if (q && q.projectId === project.id) vragen.push(q);
    });
    vragen.sort(function (a, b) { return tekst(b.askedAt) < tekst(a.askedAt) ? -1 : 1; });

    var blokken = vragen.map(function (q) {
      var berichten = (data && fn(data.threadOf))
        ? data.threadOf(q, lijst(d.questionMessages), {
          klantNaam: eersteTekst(klant && klant.contactName, klantNaam(klant)),
          beheerNaam: eigenaarNaam(ctx)
        })
        : [];
      var antwoord = antwoordBlok(ctx, ui, q, q.answeredAt ? 'bewerken' : 'beantwoorden');
      return kaart(ui, [
        ui.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:14px;' }, [
          ui.el('span', { class: 'u-kicker', text: samen([faseNaam(q.stageKey), datumTekst(ctx, q.askedAt)]) }),
          ui.statusDot({
            toon: q.answeredAt ? 'klaar' : 'wacht',
            label: q.answeredAt ? 'Beantwoord' : 'Wacht op jouw antwoord'
          })
        ]),
        ui.thread({
          berichten: berichten.map(function (b) {
            return {
              auteur: eersteTekst(b.authorName, b.author === 'client' ? klantNaam(klant) : 'Beheer'),
              organisatie: b.author === 'client' ? klantNaam(klant) : '',
              tekst: tekst(b.body),
              at: b.createdAt,
              vanKlant: b.author === 'client'
            };
          }),
          formatteerTijd: function (at) { return tijdTekst(ctx, at); }
        }),
        /* HETZELFDE ANTWOORDVELD ALS IN DE INBOX, EN LETTERLIJK DEZELFDE
           FUNCTIE. Een klantvraag hoort op twee plekken te kunnen worden
           beantwoord — in de werkvoorraad en bij het project — en dat mogen
           nooit twee verschillende velden met twee verschillende beloftes
           zijn. De haak neemt de ruwe vraagrij net zo goed als een
           Inbox-item, dus q kan hier ongewijzigd doorheen. */
        antwoord ? ruimte(ui, 18) : null,
        antwoord
      ]);
    });

    var mails = [];
    lijst(d.mailLog).forEach(function (m) {
      if (!m) return;
      if (m.projectId !== project.id && (!klant || m.clientId !== klant.id)) return;
      mails.push(ui.entityRow({
        thumb: ui.iconTile({ icoon: 'mail', toon: 'extern', maat: 40 }),
        titel: eersteTekst(m.subject, 'Bericht zonder onderwerp'),
        sub: samen([m.to ? 'naar ' + tekst(m.to) : '', tekst(m.note)]),
        chips: [ui.statusDot({
          toon: tekst(m.status) === 'delivered' ? 'klaar' : 'neutraal',
          label: tekst(m.status) || 'Bezorgstatus nog onbekend'
        })],
        meta: tijdTekst(ctx, m.createdAt)
      }));
    });

    return ui.el('div', null, [
      sectie(ui, ui.sectionHead({ titel: 'Klantvragen'}), [
        blokken.length
          ? stapel(ui, blokken)
          : ui.emptyState({
            titel: 'Nog geen vragen',
            uitleg: 'Zodra de klant in het portaal een vraag stelt bij een foto of een fase, staat het gesprek hier.'
          })
      ]),
      sectie(ui, ui.sectionHead({ titel: 'Verzonden e-mail'}), [
        ui.entityList(mails, {
          leegTitel: 'Nog geen e-mail verstuurd',
          leegUitleg: 'Elke mail die het beheer naar deze klant stuurt, komt hier met zijn bezorgstatus te staan.'
        })
      ])
    ]);
  };

  /* --- tab Details --- */
  var tabDetails = function (ctx, ui, project, mctx) {
    var d = D(ctx);
    var model = MOD(ctx);
    var data = DAT(ctx);
    var klant = klantVan(ctx, project);
    var faseNaam = faseNaamVan(ctx);
    var stages = fasesGesorteerd(project);
    var actiefIdx = actieveFaseIndex(stages);
    var huidige = (actiefIdx >= 0 && stages[actiefIdx]) ? stages[actiefIdx] : null;

    /* de fabriek: het ECHTE veld factoryId wint, en de oude afleiding uit
       de foto's en de disclosures blijft de terugval voor rijen van vóór
       hoofdstuk 7. CP_DATA.factoryIdOf doet precies die twee dingen. */
    var fabriekId = tekst(project.factoryId);
    if (!fabriekId && data && fn(data.factoryIdOf)) {
      fabriekId = tekst(data.factoryIdOf(project, lijst(d.media), lijst(d.disclosures)));
    }
    var fabriek = fabriekId ? indexOp(lijst(d.factories), 'id')[fabriekId] : null;

    var nd = (model && fn(model.nextDateFor)) ? model.nextDateFor(project, mctx) : null;

    return ui.el('div', null, [
      kaart(ui, [
        ui.sectionHead({ titel: 'Kerngegevens' }),
        ui.metaGrid({
          cellen: [
            { icoon: 'projecten', label: 'Projectcode', waarde: tekst(project.code) },
            { icoon: 'relaties', label: 'Klant', waarde: klantNaam(klant) },
            { icoon: 'bestand', label: 'Categorie', waarde: tekst(project.category) },
            { icoon: 'gebruiker', label: 'Projectleider', waarde: tekst(project.lead) },
            { icoon: 'fabriek', label: 'Fabriek', waarde: fabriek ? tekst(fabriek.name) : '', leegTekst: 'Nog niet gekoppeld' },
            { icoon: 'kalender', label: 'Gestart op', waarde: datumTekst(ctx, project.createdAt) },
            {
              icoon: 'klok', label: 'Beloofde einddatum',
              waarde: project.deadline ? datumTekst(ctx, project.deadline) : '',
              leegTekst: 'Geen deadline afgesproken',
              toon: project.deadline ? 'wacht' : 'neutraal'
            },
            {
              icoon: 'kalender', label: 'Eerstvolgende datum',
              waarde: nd ? datumTekst(ctx, nd.iso) + ' — ' + tekst(nd.label) : '',
              leegTekst: 'Er loopt geen enkele klok',
              toon: nd ? (nd.passed ? 'kritiek' : 'extern') : 'neutraal'
            },
            {
              icoon: 'vinkje', label: 'Huidige fase',
              waarde: huidige ? faseNaam(huidige.stageKey) + ' — ' + faseStand(huidige.status).woord : '',
              leegTekst: 'Geen fases vastgelegd'
            }
          ]
        })
      ]),
      ruimte(ui, 20),
      kaart(ui, [
        ui.sectionHead({ titel: 'Betaalmomenten per fase' }),
        /* HIER STOND EEN KALE STIP EN DAT MOCHT NIET (hoofdstuk 8: kleur is
           nooit de enige drager). De stip zei "afgerond ja of nee" en de tekst
           ernaast noemde alleen het betaalpercentage — het woord bij de kleur
           ontbrak dus volledig. CP_UI.statusDot bestaat juist om die fout
           onmogelijk te maken: stip plus woord, altijd. De vier woorden komen
           uit faseStand(), dezelfde tabel als de rest van dit bestand, dus er
           staat nu "Afgerond", "Actief", "Wacht op akkoord" of "Gepland".
           De fasenaam staat op deze plek bewust VOLUIT: dit is een van de
           plekken op het projectdetail waar de ruimte er wél is. */
        ui.el('div', { class: 'u-meta' }, stages.map(function (s) {
          var stand = faseStand(s.status);
          return ui.el('div', { class: 'u-meta-cel' }, [
            ui.el('span', { class: 'u-meta-label' }, ui.el('span', { text: faseNaam(s.stageKey) })),
            ui.el('span', { class: 'u-meta-waarde' }, [
              ui.statusDot({ toon: stand.toon, label: stand.woord }),
              ui.el('span', {
                text: getal(s.paymentPct, 0)
                  ? ' · ' + getal(s.paymentPct, 0) + '% betaalmoment'
                  : ' · geen betaalmoment'
              })
            ])
          ]);
        }))
      ])
    ]);
  };

  /* --- de rail van het projectdetail --- */
  var projectRail = function (ctx, ui, chart, project, klant, items, mctx) {
    var model = MOD(ctx);
    var foto = projectFoto(ctx, project.id);

    /* het eerstvolgende open item van dit project is de volgende actie */
    var volgende = null;
    lijst(items).forEach(function (it) {
      if (volgende || !it || it.projectId !== project.id) return;
      if (it.chip === 'afgehandeld' || it.snoozedUntil) return;
      volgende = it;
    });

    var nd = (model && fn(model.nextDateFor)) ? model.nextDateFor(project, mctx) : null;

    var actieKaart = kaart(ui, [
      ui.el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;' }, [
        ui.statusDot({
          toon: volgende ? (volgende.urgent ? 'kritiek' : 'wacht') : 'klaar',
          label: volgende ? (volgende.urgent ? 'Te laat' : 'Wacht op jou') : 'Niets openstaand'
        })
      ]),
      ui.el('span', {
        /* 18px staat in §5.4 bij deze kaart; admin-ui.css heeft geen klasse
           tussen .u-row-title (16px) en h2 (20px) in */
        class: 'u-row-title', style: 'font-size:18px;',
        text: volgende ? (ITEM_ACTIE[volgende.kind] || 'Handel dit af') : 'Er wacht niets op jou'
      }),
      ui.el('span', {
        class: 'u-row-sub',
        text: volgende
          ? tekst(volgende.title)
          : 'Zodra de klant iets vraagt of een fase op akkoord komt te staan, verschijnt de actie hier.'
      }),
      nd ? ui.el('span', {
        class: 'u-datekicker', style: 'margin-top:12px;',
        text: datumKicker(ctx, nd.iso) + ' · ' + tekst(nd.label).toUpperCase()
      }) : null
    ]);

    var updateHaak = haak(ctx, HAKEN.nieuweUpdate);
    var klantHaak = haak(ctx, HAKEN.alsKlant);

    var knoppen = stapel(ui, [
      ui.el('button', {
        type: 'button', class: 'u-btn breed',
        disabled: !updateHaak,
        title: updateHaak ? null : 'Een nieuwe update maken loopt via het beheerscherm en is nog niet aan dit scherm gekoppeld.',
        onclick: updateHaak ? function () { updateHaak(project); } : null
      }, [ui.el('span', { text: 'Nieuwe update' }), ui.icon('chevron', 16)]),
      ui.el('button', {
        type: 'button', class: 'u-btn ghost breed',
        disabled: !klantHaak,
        title: klantHaak ? null : 'De klantweergave opent vanuit het beheerscherm en is nog niet aan dit scherm gekoppeld.',
        onclick: klantHaak ? function () { klantHaak(project); } : null
      }, [ui.el('span', { text: 'Bekijk als klant' }), ui.icon('extern', 16)])
    ], 10);
    actieKaart.appendChild(ruimte(ui, 16));
    actieKaart.appendChild(knoppen);

    /* Kerngegevens: label links, waarde rechts — dat is de vorm uit §5.4.
       CP_UI.metaGrid zet label BOVEN waarde; hier hoort de compacte rij, en
       die staat als .u-meta-label/.u-meta-waarde al in het stijlblad. */
    var kern = [
      { label: 'Klant', waarde: klantNaam(klant) },
      { label: 'Projectcode', waarde: tekst(project.code) },
      { label: 'Categorie', waarde: tekst(project.category) },
      { label: 'Projectleider', waarde: tekst(project.lead) },
      { label: 'Deadline', waarde: project.deadline ? datumTekst(ctx, project.deadline) : 'Geen deadline' }
    ];

    var kernKaart = kaart(ui, [
      ui.sectionHead({ titel: 'Kerngegevens' }),
      ui.el('div', { style: 'display:flex;flex-direction:column;gap:12px;' }, kern.map(function (r) {
        return ui.el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:16px;' }, [
          ui.el('span', { class: 'u-meta-label' }, ui.el('span', { text: r.label })),
          ui.el('span', { class: 'u-meta-waarde', style: 'margin-top:0;text-align:right;', text: tekst(r.waarde) || 'Niet ingevuld' })
        ]);
      }))
    ]);

    var fotoKaart = foto
      ? kaart(ui, [
        ui.sectionHead({ titel: 'Productfoto' }),
        ui.el('img', {
          src: foto, alt: 'Foto van ' + tekst(project.name), loading: 'lazy',
          style: 'display:block;width:100%;border-radius:14px;'
        })
      ])
      : kaart(ui, [
        ui.sectionHead({ titel: 'Productfoto' }),
        ui.emptyTile({
          icoon: 'camera',
          titel: 'Nog geen gepubliceerde foto',
          uitleg: 'De eerste foto die je publiceert, staat hier en in de projectlijst.'
        })
      ]);

    /* het takje: §4.20 zet er één op het projectdetail. aria-hidden en
       weg onder 900px — dat regelt CP_CHART.leafOrnament en admin-ui.css. */
    if (chart && fn(chart.leafOrnament)) {
      actieKaart.classList.add('u-ornament-host');
      actieKaart.appendChild(chart.leafOrnament({ hoek: 'rechtsboven', maat: 120 }));
    }

    return ui.el('div', { class: 'u-cols-side' }, [
      ui.el('div', { class: 'u-sticky' }, [actieKaart, kernKaart, fotoKaart])
    ]);
  };

  /* ============================================================
     11. NOODUITGANG

     Zonder CP_UI is er geen enkele vorm om op terug te vallen. Dan nog moet
     een scherm ÉÉN geldig element teruggeven, want de shell hangt de
     uitkomst zonder controle in #content en een null zou een lege pagina
     zonder uitleg opleveren.
     ============================================================ */
  var noodElement = function (naam) {
    var div = document.createElement('div');
    var kop = document.createElement('h1');
    kop.textContent = tekst(naam);
    var p = document.createElement('p');
    p.textContent = 'De componentbibliotheek (portal/admin-ui.js) is niet geladen, '
      + 'dus dit scherm kan niet worden getekend.';
    div.appendChild(kop);
    div.appendChild(p);
    return div;
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
