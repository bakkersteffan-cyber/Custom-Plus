/* CUSTOM+ — componentbibliotheek van de nieuwe beheerindeling.
   ------------------------------------------------------------------
   WAARVOOR DIT BESTAND BESTAAT
   Het beheer wordt heringedeeld van negen tabbladen naar vijf werkgebieden.
   De inventarisatie liet zien waarom dat vandaag zo moeilijk is: .pagehead
   staat elf keer handgebouwd in beheer.html, de filterknop bestaat drie keer
   los (vdTabBtn, filterChip, tabBtn), de samenvattingskaart twee keer, de
   tijdlijnrij twee keer (.tlrow en .logrow), en er is geen enkel menu-,
   dropdown- of popoverpatroon in het hele bestand. Elke pagina heeft daardoor
   zijn eigen kleine afwijking, en niemand heeft dat ooit besloten.

   Dit bestand is de gedeelde versie daarvan. Eén plek waar een kop een kop is,
   een filter een filter, en een menu een menu — inclusief het toetsenbordwerk
   dat je nooit elf keer opnieuw goed krijgt.

   DE ECHTE REDEN VOOR EEN APARTE BIBLIOTHEEK IS TOEGANKELIJKHEID
   In beheer.html staat vandaag nul keer role="tab", nul keer aria-pressed en
   nul keer aria-haspopup. Dat is geen slordigheid van de bouwer maar een
   gevolg van kopiëren: wie een knop overneemt uit de rij ernaast, neemt ook
   over wat er niet staat. Zolang een filterrij per pagina wordt nagebouwd
   blijft dat zo. Vandaar dat elke interactieve component hier het volledige
   toetsenbordgedrag meebrengt: pijltjes, Home/End, Escape, focusherstel. Dat
   is niet de garnering van dit bestand, het is de reden dat het er is.

   VIER AFSPRAKEN DIE DE REST VERKLAREN

   1. GEEN ENKELE COMPONENT LEEST APPSTATE. Er staat hier geen DS, geen
      adminSettings, geen currentView en geen refresh(). Alles komt via opts
      binnen en gaat via callbacks terug. Een component weet dus nooit welk
      project open staat — en kan daardoor ook nooit het verkeerde tonen.

   2. NOOIT innerHTML. Alles via el(). Dat is niet alleen stijl: klantnamen,
      projectnamen en vraagteksten komen uit de database en gaan hier
      ongefilterd doorheen. textContent maakt injectie onmogelijk.

   3. ELKE COMPONENT VERDRAAGT ONTBREKENDE opts. Geen titel, geen menu, lege
      lijst, opts helemaal weg: het resultaat is altijd een geldig element.
      Het beheer haalt tien bronnen tegelijk op en een halve render mag nooit
      een lege pagina opleveren.

   4. STIJL KOMT UIT CSS, NOOIT UIT JS. De klassen staan in
      portal/admin-ui.css (alles met u-) en in de <style> van beheer.html.
      De paar inline style-attributen hieronder staan er alleen waar
      admin-ui.css bewust geen klasse heeft — ze staan met reden erbij
      genoteerd, zodat ze naar CSS kunnen verhuizen zodra beheer.html weer
      veilig te bewerken is.

   VERHOUDING TOT CP_MODEL
   CP_MODEL (portal/admin-model.js) is de rekenlaag: wat speelt er en wie is
   aan zet. Dit bestand tekent dat. De enige aanraking is datumopmaak in de
   tijdlijn, met een terugval als CP_MODEL niet geladen is — een rekenlaag is
   geen state, maar een component mag er ook niet op stukvallen.

   VIJFDE AFSPRAAK, ERBIJ GEKOMEN MET DE MOCKUPRONDE
   GRAFIEKEN WORDEN HIER NIET GETEKEND. CP_CHART (portal/admin-charts.js)
   heeft ring, sparkline, ratingDots, leafOrnament en de rest al. Dit bestand
   ROEPT ze aan en heeft altijd een terugval als CP_CHART niet geladen is —
   een stattegel zonder ring toont dan gewoon zijn getal. Zo blijft er precies
   één plek waar een ring wordt getekend.

   Publieke API (globalThis.CP_UI, en module.exports in Node) — deze lijst
   volgt de exporttabel onderaan dit bestand exact:
     VERSION
     el / clear / icon / iconKnop / iconBestaat / iconNamen
     pageHeader / crumbs
     filterChips / tabs
     statusChip / statusDot / summaryCard / summaryRow
     taskCard / entityRow / entityList / emptyState / emptyTile
     timelineRow / timeline
     contextMenu / confirmInline
     masterDetail / stickyPanel / saveBar / settingsCategoryCard
     projectProgress / searchField / toast / kb
     avatar / avatarGroep / iconTile
     statTile / statRow
     thread / metaGrid / chipRow
     previewCard / sectionHead / productRow / ratingRow

   LADEN
     browser : <script src="portal/admin-ui.js"></script> na admin-model.js en
               vóór het hoofdscript van beheer.html; het bestand zet zichzelf
               op globalThis als CP_UI.
     node    : importeerbaar voor tests. Het factory-lichaam raakt geen enkele
               globale aan bij het laden — alle document-toegang zit binnen de
               componenten — dus importeren zonder DOM klapt niet.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_UI = api;
  /* zelfde reden als in admin-model.js: geen "type":"module", dus in Node is
     dit CJS en is dit een echte export. Draait het ooit als ESM, dan bestaat
     `module` niet en blijft alleen globalThis over. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.1.0';

  /* ============================================================
     0. KALE HULPJES
     ============================================================ */

  function arr(v) { return Array.isArray(v) ? v : []; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function opt(v) { return isObj(v) ? v : {}; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function fn(v) { return typeof v === 'function' ? v : null; }
  function isNode(v) { return !!v && typeof v === 'object' && typeof v.nodeType === 'number'; }

  /* de globale scope opnieuw bepalen: de factory krijgt hem niet mee (het
     modulepatroon is letterlijk overgenomen uit invoice-core.js) en we willen
     hem alleen voor CP_MODEL en window/matchMedia */
  function G() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    return null;
  }
  function MODEL() {
    var g = G();
    return (g && g.CP_MODEL) ? g.CP_MODEL : null;
  }

  /* CP_CHART is de tekenlaag (portal/admin-charts.js). Net als CP_MODEL is
     het een pure functiebibliotheek zonder state, en net als daar geldt: elke
     component die hem gebruikt moet ZONDER hem ook een geldig element
     opleveren. Een stattegel valt terug op zijn kale getal, een ratingrij op
     zijn tekst, een takje verdwijnt gewoon. Nooit een uitzondering, want de
     laadvolgorde van tien scripts is niets om een pagina op te verliezen. */
  function CHART() {
    var g = G();
    return (g && g.CP_CHART) ? g.CP_CHART : null;
  }

  /* getalnotatie leent van CP_CHART zodat elk getal in het beheer dezelfde
     Nederlandse schrijfwijze krijgt; zonder die laag de kale String() */
  function getalTekst(v, decimalen) {
    var c = CHART();
    if (c && fn(c.getal)) return str(c.getal(v, decimalen));
    return str(v);
  }

  /* oplopende teller voor id's die aria nodig heeft (aria-controls,
     aria-activedescendant, aria-labelledby). Bewust geen willekeur: bij een
     herrender wil je in de DOM-inspector kunnen zien welk paneel bij welke
     tab hoort. */
  var teller = 0;
  function uid(voorvoegsel) { teller++; return 'u' + str(voorvoegsel) + teller; }

  /* el() is LETTERLIJK de helper uit beheer.html regel 2120. Niet "ongeveer":
     er zijn 1.848 aanroepsites die op precies dit gedrag rekenen, en zodra
     een tweede el() ook maar één attribuut anders behandelt is dat een bug
     die pas maanden later opvalt. */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null) return;
        if (k === 'class') { n.className = v; }
        else if (k === 'text') { n.textContent = v; }
        else if (k === 'value') { n.value = v; }
        else if (k === 'checked') { n.checked = !!v; }
        else if (k === 'disabled') { n.disabled = !!v; }
        else if (k.indexOf('on') === 0 && typeof v === 'function') { n.addEventListener(k.slice(2), v); }
        else { n.setAttribute(k, v); }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return n;
  }

  /* heet clearNode() in beheer.html; hier clear(), omdat de bibliotheek geen
     tweede naam voor hetzelfde wil en 'node' in een DOM-bestand niets toevoegt */
  function clear(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* zit `node` in `wortel`? Bewust geen Element.closest(): een handvol
     aanroepen wil ook een niet-Element-doel (een tekstnode uit een klik)
     kunnen doorgeven, en contains() klapt daar niet op. */
  function binnen(node, wortel) {
    if (!node || !wortel) return false;
    var p = node;
    while (p) {
      if (p === wortel) return true;
      p = p.parentNode;
    }
    return false;
  }

  /* verbergen gaat via het hidden-attribuut. beheer.html regel 38 zet
     [hidden]{display:none !important} — nodig, want anders wint de
     display:flex van .u-stat of .u-chip van het attribuut. */
  function verberg(node, aan) {
    if (!node) return;
    node.hidden = !!aan;
  }

  /* veilig terug naar een eerder gefocust element: het kan intussen uit de
     DOM zijn gehaald door een herrender, en focus() op een los element doet
     stilletjes niets én laat de focus op <body> achter.

     Het antwoord is een METING en geen aanname. focus() gooit geen
     uitzondering op een element dat helemaal niet focusbaar is, dus alleen
     document.activeElement kan vertellen of het gelukt is. Aanroepers die op
     hun terugval rekenen — masterDetail.sluit() valt terug op de eerste rij
     van de lijst — krijgen zo een eerlijk antwoord in plaats van een true die
     alleen betekent "er is niets geklapt".

     ÉÉN ELEMENT ONTSNAPT AAN DE METING: <body>. Dat is precies de plek waar
     de focus belandt als er niets meer is, en document.body.focus() zet
     document.activeElement wél op body — dus true. Bewaar <body> daarom
     nooit als "vorige focus"; masterDetail.open() filtert hem er apart uit. */
  function herstelFocus(node) {
    if (!node || !node.focus) return false;
    var d = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!d) return false;
    if (d.contains && !d.contains(node)) return false;
    try { node.focus(); } catch (e) { return false; }
    return d.activeElement === node;
  }

  function nlAantal(n, enkel, meervoud) {
    return n + ' ' + (n === 1 ? enkel : meervoud);
  }

  /* .u-main.u-has-bar houdt onder 700px de ruimte vrij onder de vaste
     actiebalk (padding-bottom:78px in admin-ui.css, binnen de mediaquery —
     boven 700px doet de klasse dus niets en hoeft er ook niets meegeschakeld
     te worden). stickyPanel zet hem ZELF, want dit was een afspraak waar
     iedereen naar de ander wees: de CSS naar de JS, dit bestand naar de
     shell, en de shell deed het niet. Nu hoeft geen enkel scherm en ook de
     shell er niets voor te doen.

     De teller staat op moduleniveau voor het geval twee panelen tegelijk
     leven: pas als de laatste stopt mag de onderrand weer dicht. */
  var balken = 0;
  function werkkolom() {
    if (typeof document === 'undefined' || !document.querySelector) return null;
    return document.querySelector('.u-main');
  }

  /* meldBalk/vergeetBalk zijn de gedeelde vorm van die afspraak. Er zijn er
     nu TWEE die onderaan het scherm ruimte innemen — stickyPanel met zijn
     .u-sticky-bar en saveBar met de zwevende opslagbalk — en die mogen elkaar
     niet in de weg zitten. Zonder gedeelde teller haalt de eerste die stopt
     de klasse weg terwijl de tweede nog staat, en dan ligt de laatste rij van
     de lijst onder een balk die er nog wél is.
     meldBalk() geeft de kolom terug of null; vergeetBalk() geeft altijd null
     terug, zodat een aanroeper zijn eigen verwijzing in één regel kan wissen
     en tweemaal stoppen nooit dubbel aftelt. */
  function meldBalk() {
    var kolom = werkkolom();
    if (!kolom || !kolom.classList) return null;
    balken++;
    kolom.classList.add('u-has-bar');
    return kolom;
  }
  function vergeetBalk(kolom) {
    if (!kolom || !kolom.classList) return null;
    balken--;
    if (balken <= 0) {
      balken = 0;
      kolom.classList.remove('u-has-bar');
    }
    return null;
  }

  /* ---- de tintklassen van admin-ui.css (hoofdstuk 1b) ------------------
     Eén tintklasse zet --vlak, --volle en --inkt in één keer goed, en elk
     component hieronder leest die drie met een terugval. Daardoor kleurt
     dezelfde toonnaam een icoontegel, een grote stattegel, een stip en een
     chip in één keer juist — inclusief de doorgerekende tekstkleur.
     De sleutels van TONEN (klaar/wacht/extern/kritiek) staan er náást de
     kale CSS-namen (ok/warn/info/crit) in, zodat een aanroeper niet hoeft te
     onthouden welk van de twee woordenboeken bij welk component hoort. */
  var TINTEN = {
    ok: 'u-tint-ok', klaar: 'u-tint-ok',
    warn: 'u-tint-warn', wacht: 'u-tint-warn',
    crit: 'u-tint-crit', kritiek: 'u-tint-crit',
    info: 'u-tint-info', extern: 'u-tint-info',
    neutraal: 'u-tint-neutraal', nu: 'u-tint-neutraal',
    '1': 'u-tint-1', '2': 'u-tint-2', '3': 'u-tint-3',
    '4': 'u-tint-4', '5': 'u-tint-5', '6': 'u-tint-6',
    salie: 'u-tint-1', perzik: 'u-tint-2', blauw: 'u-tint-3',
    paars: 'u-tint-4', zand: 'u-tint-5', grafiet: 'u-tint-6'
  };
  function tintKlasse(toon) {
    return TINTEN[str(toon)] || TINTEN.neutraal;
  }

  /* de stipklassen van .u-dot. Ze hebben ANDERE namen dan de chiptonen
     (done/current bestaan niet als stip), dus geen gedeelde tabel. */
  var STIPPEN = {
    ok: 'ok', klaar: 'ok',
    warn: 'warn', wacht: 'warn',
    crit: 'crit', kritiek: 'crit',
    info: 'info', extern: 'info',
    neutraal: 'neutraal', nu: 'neutraal'
  };
  function dotKlasse(toon) {
    return STIPPEN[str(toon)] || 'neutraal';
  }

  /* Het woord dat naast de stip hoort als de aanroeper er geen meegeeft.
     Hoofdstuk 8 van de spec: kleur is nooit de enige drager, dus een stip
     zonder woord bestaat niet — ook niet per ongeluk. */
  var STIP_WOORD = {
    ok: 'Op koers', klaar: 'Gereed',
    warn: 'Aandacht', wacht: 'Wacht',
    crit: 'Te laat', kritiek: 'Te laat',
    info: 'Extern', extern: 'Extern',
    neutraal: 'Onbekend', nu: 'Nu'
  };

  /* ---- knopklassen ----------------------------------------------------
     De mockupknop is .u-btn: 15px, normale schrijfwijze, pilvorm. De oude
     .btn van beheer.html blijft bestaan voor de elf oude schermen en wordt
     hier NIET aangeraakt (admin-ui.css hoofdstuk 6 legt uit waarom).
     De modificatoren heten in het nieuwe stijlblad anders dan in het oude
     (klein/breed/gevaar in plaats van small/wide/danger). Elke aanroeper die
     ooit een oude naam doorgeeft in opts.klasse blijft daardoor werken: de
     tabel hieronder vertaalt hem, in plaats van hem stil te laten vallen. */
  var KNOP_OUD = {
    small: 'klein', wide: 'breed', danger: 'gevaar',
    primary: 'primair', round: 'rond', quiet: 'stil'
  };
  function knopKlasse(extra) {
    var uit = ['u-btn'];
    str(extra).split(/\s+/).forEach(function (w) {
      if (!w) return;
      var n = KNOP_OUD[w] || w;
      if (uit.indexOf(n) < 0) uit.push(n);
    });
    return uit.join(' ');
  }

  /* ============================================================
     1. ICONEN

     Eén set, inline SVG, geen bestand en geen font. De zes iconen die het
     beheer al kent (Vandaag, Aanvragen, Klanten, Projecten, Logboek,
     Instellingen) zijn LETTERLIJK overgenomen uit de statische zijbalk van
     beheer.html regel 797-806, zodat de heringedeelde navigatie er niet
     ineens anders uitziet dan de oude. De rest is nieuw en volgt dezelfde
     tekenstijl: viewBox 24, alleen lijnen, ronde uiteinden.

     De stijl staat als attribuut op de <svg> en niet alleen in CSS. Reden:
     .navbtn svg, .u-iconbtn svg en .u-menu-item svg zetten hem elk zelf,
     maar een icoon in een taakkaart of een lege toestand valt buiten alle
     drie en zou dan een 300x150 zwart vlak worden. CSS wint van
     presentatie-attributen, dus de drie bestaande regels blijven de baas.
     ============================================================ */

  var ICONEN = {
    /* uit de zijbalk: data-nav="vandaag" */
    overzicht: [
      ['path', { d: 'M5.5 16.5a6.5 6.5 0 0 1 13 0' }],
      ['line', { x1: '3', y1: '16.5', x2: '21', y2: '16.5' }],
      ['line', { x1: '12', y1: '4', x2: '12', y2: '6.2' }],
      ['line', { x1: '5.6', y1: '6.6', x2: '7.2', y2: '8.2' }],
      ['line', { x1: '18.4', y1: '6.6', x2: '16.8', y2: '8.2' }],
      ['line', { x1: '7', y1: '20', x2: '17', y2: '20' }]
    ],
    /* uit de zijbalk: data-nav="aanvragen" — de postbak */
    inbox: [
      ['path', { d: 'M4.5 5.5h15l2 7.5v5a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5v-5z' }],
      ['path', { d: 'M2.5 13h5.2l1.6 2.6h5.4l1.6-2.6h5.2' }]
    ],
    /* uit de zijbalk: data-nav="projects" */
    projecten: [
      ['path', { d: 'M12 3.2 20 7.6v8.8L12 20.8 4 16.4V7.6z' }],
      ['path', { d: 'M4 7.6l8 4.4 8-4.4' }],
      ['line', { x1: '12', y1: '12', x2: '12', y2: '20.8' }]
    ],
    /* uit de zijbalk: data-nav="clients" — twee mensen, want Relaties is
       klanten én fabrieken */
    relaties: [
      ['circle', { cx: '9', cy: '8.2', r: '3.4' }],
      ['path', { d: 'M3.2 19.6c.7-3.3 3-5 5.8-5s5.1 1.7 5.8 5' }],
      ['circle', { cx: '17', cy: '9.4', r: '2.5' }],
      ['path', { d: 'M16.6 14.7c2.4.3 4 1.7 4.5 4.3' }]
    ],
    /* nieuw: een bankbiljet. Bewust geen euroteken — het beheer rekent ook
       in dollars (invoice.currency) en een € in de navigatie zou liegen. */
    financien: [
      ['rect', { x: '2.5', y: '6', width: '19', height: '12', rx: '2.5' }],
      ['circle', { cx: '12', cy: '12', r: '2.9' }],
      ['line', { x1: '5.6', y1: '9.7', x2: '5.6', y2: '14.3' }],
      ['line', { x1: '18.4', y1: '9.7', x2: '18.4', y2: '14.3' }]
    ],
    /* uit de zijbalk: data-nav="log" */
    activiteit: [
      ['circle', { cx: '12', cy: '12', r: '8' }],
      ['polyline', { points: '12 7.5 12 12 15.4 14' }]
    ],
    /* uit de zijbalk: data-nav="settings" */
    instellingen: [
      ['circle', { cx: '12', cy: '12', r: '3.2' }],
      ['path', { d: 'M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8' }]
    ],
    zoek: [
      ['circle', { cx: '10.8', cy: '10.8', r: '6.3' }],
      ['line', { x1: '15.4', y1: '15.4', x2: '20', y2: '20' }]
    ],
    plus: [
      ['line', { x1: '12', y1: '5', x2: '12', y2: '19' }],
      ['line', { x1: '5', y1: '12', x2: '19', y2: '12' }]
    ],
    bel: [
      ['path', { d: 'M18 16.6V11a6 6 0 1 0-12 0v5.6L4.4 18.6h15.2z' }],
      ['path', { d: 'M9.8 21.2a2.4 2.4 0 0 0 4.4 0' }]
    ],
    gebruiker: [
      ['circle', { cx: '12', cy: '8.4', r: '3.6' }],
      ['path', { d: 'M4.8 20c.9-3.7 3.6-5.6 7.2-5.6s6.3 1.9 7.2 5.6' }]
    ],
    /* de ••• : drie gevulde stippen. Ze krijgen expliciet fill/stroke mee,
       want de svg zelf staat op fill:none — een cirkel zonder vulling en met
       r=1.2 is op deze maat een grijze veeg. */
    meer: [
      ['circle', { cx: '5.6', cy: '12', r: '1.25', fill: 'currentColor', stroke: 'none' }],
      ['circle', { cx: '12', cy: '12', r: '1.25', fill: 'currentColor', stroke: 'none' }],
      ['circle', { cx: '18.4', cy: '12', r: '1.25', fill: 'currentColor', stroke: 'none' }]
    ],
    /* wijst naar rechts: dat is de stand die het vaakst voorkomt
       (kruimelpad, "open dit"). Voor een uitklapper is er chevronOmlaag —
       roteren via CSS zou een tweede waarheid over de richting maken. */
    chevron: [
      ['polyline', { points: '9.5 5.5 16 12 9.5 18.5' }]
    ],
    chevronOmlaag: [
      ['polyline', { points: '5.5 9.5 12 16 18.5 9.5' }]
    ],
    terug: [
      ['line', { x1: '20', y1: '12', x2: '4.6', y2: '12' }],
      ['polyline', { points: '10.6 5.5 4 12 10.6 18.5' }]
    ],
    sluiten: [
      ['line', { x1: '6', y1: '6', x2: '18', y2: '18' }],
      ['line', { x1: '18', y1: '6', x2: '6', y2: '18' }]
    ],
    waarschuwing: [
      ['path', { d: 'M12 4.2 21.2 19.4H2.8z' }],
      ['line', { x1: '12', y1: '10', x2: '12', y2: '14' }],
      ['circle', { cx: '12', cy: '16.7', r: '.75', fill: 'currentColor', stroke: 'none' }]
    ],

    /* ---- erbij gekomen met de mockupronde -----------------------------
       De mockup zet op vrijwel elke rij een icoontegel (spec 4.9 noemt hem
       "het meest herhaalde element van de hele mockup") en de tegels tonen
       niet zes keer hetzelfde icoon. Dezelfde tekenstijl als hierboven:
       viewBox 24, alleen lijnen, ronde uiteinden — zodat een nieuw icoon
       naast een oud nooit uit de toon valt. */
    pijl: [
      ['line', { x1: '4', y1: '12', x2: '19.5', y2: '12' }],
      ['polyline', { points: '13.5 6 19.5 12 13.5 18' }]
    ],
    pijlOmhoog: [
      ['line', { x1: '12', y1: '20', x2: '12', y2: '5' }],
      ['polyline', { points: '6 11 12 5 18 11' }]
    ],
    pijlOmlaag: [
      ['line', { x1: '12', y1: '4', x2: '12', y2: '19' }],
      ['polyline', { points: '6 13 12 19 18 13' }]
    ],
    vinkje: [
      ['polyline', { points: '5 12.6 9.6 17.2 19 6.8' }]
    ],
    kalender: [
      ['rect', { x: '3', y: '5', width: '18', height: '16', rx: '3' }],
      ['line', { x1: '3', y1: '10', x2: '21', y2: '10' }],
      ['line', { x1: '8', y1: '3', x2: '8', y2: '6.6' }],
      ['line', { x1: '16', y1: '3', x2: '16', y2: '6.6' }]
    ],
    mail: [
      ['rect', { x: '2.5', y: '5.5', width: '19', height: '13', rx: '2.5' }],
      ['path', { d: 'M3.2 7.2 12 13.6l8.8-6.4' }]
    ],
    bestand: [
      ['path', { d: 'M6.2 3h7.6L19 8.4V21H6.2z' }],
      ['path', { d: 'M13.8 3v5.4H19' }]
    ],
    klok: [
      ['circle', { cx: '12', cy: '12', r: '8' }],
      ['polyline', { points: '12 7.4 12 12 15.6 13.8' }]
    ],
    locatie: [
      ['path', { d: 'M12 21.2c0 0 6.4-5.7 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 15.5 12 21.2 12 21.2z' }],
      ['circle', { cx: '12', cy: '10.6', r: '2.4' }]
    ],
    fabriek: [
      ['path', { d: 'M3.4 20.6V11l5 2.9V11l5 2.9V7.4l6.2 3.5v9.7z' }],
      ['line', { x1: '7.6', y1: '17', x2: '7.6', y2: '18.4' }],
      ['line', { x1: '12.4', y1: '17', x2: '12.4', y2: '18.4' }],
      ['line', { x1: '17.2', y1: '17', x2: '17.2', y2: '18.4' }]
    ],
    extern: [
      ['polyline', { points: '14 3.8 20.2 3.8 20.2 10' }],
      ['line', { x1: '20.2', y1: '3.8', x2: '11.4', y2: '12.6' }],
      ['path', { d: 'M18 14.6V19a1.6 1.6 0 0 1-1.6 1.6H5.4A1.6 1.6 0 0 1 3.8 19V7.6A1.6 1.6 0 0 1 5.4 6h4.4' }]
    ],
    /* de twee schuifjes uit de mockupknop "Filters" */
    filter: [
      ['line', { x1: '4', y1: '7.4', x2: '20', y2: '7.4' }],
      ['circle', { cx: '9.4', cy: '7.4', r: '2.2' }],
      ['line', { x1: '4', y1: '16.6', x2: '20', y2: '16.6' }],
      ['circle', { cx: '15', cy: '16.6', r: '2.2' }]
    ],
    potlood: [
      ['path', { d: 'M4.2 19.8 5.3 15.6 16.5 4.5a2.1 2.1 0 0 1 3 3L8.4 18.7z' }],
      ['line', { x1: '14.4', y1: '6.6', x2: '17.4', y2: '9.6' }]
    ],
    ster: [
      ['path', { d: 'M12 4.2l2.42 4.9 5.41.79-3.92 3.81.93 5.38L12 16.54l-4.84 2.54.93-5.38L4.17 9.89l5.41-.79z' }]
    ],
    vraagteken: [
      ['circle', { cx: '12', cy: '12', r: '8.4' }],
      ['path', { d: 'M9.6 9.6a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1.1.9-1.1 1.7v.3' }],
      ['circle', { cx: '11.7', cy: '16.6', r: '.75', fill: 'currentColor', stroke: 'none' }]
    ],
    camera: [
      ['rect', { x: '2.8', y: '7', width: '18.4', height: '13.2', rx: '2.6' }],
      ['circle', { cx: '12', cy: '13.6', r: '3.6' }],
      ['path', { d: 'M8.7 7 10 4.6h4L15.3 7' }]
    ],

    /* DRIE hoofdjes, en dat is precies het verschil met 'relaties'.
       'gebruiker' is één persoon, 'relaties' zijn er twee (een klant en een
       fabriek), en 'team' is een GROEP — de categorie "Team & rechten" gaat
       over iedereen die meekijkt, niet over een tweetal. Een groep tekenen
       als een tweetal zou drie begrippen op twee beelden persen.
       Zelfde tekenstijl als de rest: viewBox 24, alleen lijnen, stroke 1.6
       via het svg-attribuut, ronde uiteinden. De twee buitenste figuren staan
       een tikje hoger en kleiner, zodat ze achter de middelste lijken te
       staan zonder dat er een vlak nodig is. */
    team: [
      ['circle', { cx: '12', cy: '9.2', r: '3.1' }],
      ['path', { d: 'M6.7 19.4c.6-3 2.6-4.6 5.3-4.6s4.7 1.6 5.3 4.6' }],
      ['circle', { cx: '4.9', cy: '10.2', r: '2.1' }],
      ['path', { d: 'M1.9 18.4c.3-2.1 1.3-3.4 3-3.7' }],
      ['circle', { cx: '19.1', cy: '10.2', r: '2.1' }],
      ['path', { d: 'M22.1 18.4c-.3-2.1-1.3-3.4-3-3.7' }]
    ]
  };

  /* ÉÉN ALIAS, EN HET IS ER BEWUST MAAR ÉÉN.
     'financien' is de naam die admin-schermen-beheer.js en
     admin-schermen-relaties.js al gebruiken; admin-schermen-werk.js schreef
     'geld'. De schermbestanden verhuizen naar 'financien' — maar een vergeten
     plek mag daarna nooit een leeg vak opleveren, en daarom blijft 'geld'
     bestaan en wijst hij naar dezelfde tekening. Alias en geen kopie: twee
     losse tekeningen lopen vroeg of laat uit elkaar en dan is "Bedrag"
     ineens een ander biljet dan "Financiën".
     'team' is met opzet GEEN alias meer (zie hierboven). */
  ICONEN.geld = ICONEN.financien;

  /* de zichtbare terugval voor een naam die niet in de tabel staat: een
     doorgekruist vak. Bewust lelijk en bewust herkenbaar — een tikfout in een
     icoonnaam hoort op te vallen tijdens het bouwen en niet pas als de
     eigenaar naar een leeg vlakje op een factuurrij kijkt. */
  var ICOON_TERUGVAL = [
    ['rect', { x: '3.4', y: '3.4', width: '17.2', height: '17.2', rx: '4' }],
    ['line', { x1: '8.4', y1: '8.4', x2: '15.6', y2: '15.6' }],
    ['line', { x1: '15.6', y1: '8.4', x2: '8.4', y2: '15.6' }]
  ];
  /* één waarschuwing per naam. Een onbekende naam zit meestal in een tabel
     die per rij wordt uitgelezen, en dan is één regel in de console nuttig en
     zeshonderd regels een reden om de console te sluiten. */
  var GEMELD = {};

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function svgKind(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /* icon('meer') → <svg>.
     EEN ONBEKENDE NAAM MAG NOOIT MEER STIL EEN LEEG VAK OPLEVEREN. Dat was
     precies de fout die 'geld' en 'team' zo lang onzichtbaar hield: de vorige
     versie deed arr(ICONEN[naam]).forEach(...) en leverde bij een tikfout een
     geldige maar volstrekt lege <svg> op. Op een icoontegel is dat een
     gekleurd vierkantje met niets erin, en dat ziet er precies zo bedoeld uit
     als het is: een gekleurd vierkantje.
     Nu gebeuren er twee dingen. Er wordt een ZICHTBARE terugvalvorm getekend
     (een doorgekruist vak), en er gaat één keer per naam een waarschuwing naar
     de console. Nog steeds geen uitzondering: een tikfout mag geen halve
     pagina kosten. */
  function icon(naam, maat) {
    var m = (typeof maat === 'number' && maat > 0) ? maat : 18;
    var sleutel = str(naam);
    var vormen = ICONEN[sleutel];
    var bekend = Array.isArray(vormen) && vormen.length > 0;
    var svg = svgKind('svg', {
      viewBox: '0 0 24 24',
      width: m, height: m,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    if (!bekend) {
      vormen = ICOON_TERUGVAL;
      /* in de DOM-inspector meteen te zien WELKE naam ontbrak, ook als de
         console al leeggemaakt is */
      svg.setAttribute('data-onbekend-icoon', sleutel || '(leeg)');
      if (!GEMELD[sleutel]) {
        GEMELD[sleutel] = true;
        var g = G();
        if (g && g.console && fn(g.console.warn)) {
          g.console.warn('CP_UI.icon: onbekende icoonnaam "' + sleutel +
            '". Er wordt een terugvalvorm getekend. Bekende namen: ' +
            Object.keys(ICONEN).sort().join(', '));
        }
      }
    }
    arr(vormen).forEach(function (spec) {
      svg.appendChild(svgKind(spec[0], spec[1]));
    });
    return svg;
  }

  /* iconBestaat('team') — zodat een scherm of een testpagina een naam kan
     controleren zonder er eerst een element van te maken. dev/admin-ui.html
     had precies dit nodig om te weten welke naam in zijn overzicht ontbreekt. */
  function iconBestaat(naam) {
    var v = ICONEN[str(naam)];
    return Array.isArray(v) && v.length > 0;
  }
  function iconNamen() {
    return Object.keys(ICONEN).sort();
  }

  /* een knop die alleen een icoon draagt heeft ALTIJD een aria-label nodig;
     zonder tekst is de knop voor een schermlezer een knop zonder naam */
  function iconKnop(naam, label, onClick, extraKlasse) {
    return el('button', {
      type: 'button',
      class: 'u-iconbtn' + (extraKlasse ? ' ' + extraKlasse : ''),
      'aria-label': label || 'Actie',
      title: label || null,
      onclick: fn(onClick) || null
    }, icon(naam));
  }

  /* het chevronnetje aan het eind van een klikbare rij. admin-ui.css geeft
     hem een eigen klasse (.u-row-chevron: 18px, --ink-3) omdat hij op elke
     rijsoort terugkomt en nergens een eigen kleur mag krijgen.
     Hij is ALTIJD decoratie: de rij eromheen is de knop en draagt de naam,
     dus icon() zet er al aria-hidden op. */
  function chevronRij() {
    var s = icon('chevron', 18);
    s.setAttribute('class', 'u-row-chevron');
    return s;
  }

  /* ============================================================
     2. KOP EN KRUIMELPAD
     ============================================================ */

  /* crumbs([{label, route|href|onKies}, ...])
     Het laatste item is de huidige pagina: geen link, wel aria-current.
     Vervangt de .backbtn die vandaag op beide detailschermen staat — een
     terugknop vertelt je wél waar je heen gaat maar niet waar je bent. */
  function crumbs(items) {
    var lijst = arr(items).filter(function (i) { return isObj(i) && str(i.label); });
    var nav = el('nav', { class: 'u-crumb', 'aria-label': 'Kruimelpad' });
    lijst.forEach(function (it, i) {
      var laatste = i === lijst.length - 1;
      if (i > 0) nav.appendChild(el('span', { class: 'u-crumb-sep', 'aria-hidden': 'true', text: '/' }));
      if (laatste) {
        nav.appendChild(el('span', { class: 'u-crumb-cur', 'aria-current': 'page', text: str(it.label) }));
        return;
      }
      var doel = it.href || it.route;
      if (fn(it.onKies)) {
        nav.appendChild(el('button', { type: 'button', text: str(it.label), onclick: it.onKies }));
      } else if (doel) {
        nav.appendChild(el('a', { href: str(doel), text: str(it.label) }));
      } else {
        /* een kruimel zonder bestemming is geen link: hem tóch als link
           tonen leert de gebruiker dat kruimels soms niets doen */
        nav.appendChild(el('span', { text: str(it.label) }));
      }
    });
    return nav;
  }

  /* pageHeader({kicker, titel, crumbs, primair, menu, badge, actiePlaats})
     Vervangt de elf handgebouwde .pagehead-instanties in beheer.html. De
     opbouw (kicker boven een lichte grote h1) is daaruit overgenomen; nieuw
     zijn het kruimelpad, precies ÉÉN primaire knop, en de h1 met tabindex=-1.

     Die tabindex is geen detail. De shell vervangt bij navigatie de inhoud
     van #content zonder de pagina te herladen; zonder focusverplaatsing
     blijft een schermlezer- of toetsenbordgebruiker achter op een knop die
     niet meer bestaat.

     De shell verplaatst die focus na elke navigatie, en heeft daar twee
     wegen voor die op dezelfde h1 uitkomen: kop.focusTitel() aanroepen als
     hij de kop van het scherm in handen heeft, en anders zelf
     h1[tabindex="-1"] opzoeken binnen #content met #content als terugval.
     Die tweede weg is de reden dat de tabindex hier staat en niet alleen de
     eerste — een scherm dat zijn kop niet doorgeeft moet ook landen.

     Alles wat geen primaire actie is gaat achter •••. Dat is letterlijk de
     klacht uit de opdracht: de projectkop heeft vandaag vijf gelijkwaardige
     knoppen, en vijf gelijkwaardige knoppen zijn geen keuze maar een lijst.

     TWEE UITBREIDINGEN UIT DE MOCKUP (allebei optioneel, de signatuur
     verandert niet):

     · BIJZIN — "Relaties — Fabrieken". Één h1, twee gewichten: de titel op
       500 en de bijzin op 300 in --ink-3 (.u-bijzin). Bewust binnen dezelfde
       h1 en niet als tweede element: het IS één paginanaam, en een
       schermlezer hoort hem dan ook als één kop. De scheiding (—) zet dit
       component erbij, tenzij de aanroeper er zelf al een leesteken voor
       heeft gezet — anders staat er "Relaties — — Fabrieken".

     · STATUSREGEL — stip plus woord onder de titel (projectdetail 5.4:
       "daaronder statusstip + fase"). Loopt via statusDot, dus er kan geen
       stip zonder woord ontstaan.

     DE MOCKUP KENT TWEE KOPPEN EN NIET ÉÉN — actiePlaats
     Naast elkaar gelegd tonen de tien schermafbeeldingen twee vormen, en het
     verschil is geen toeval maar leesrichting:

       'rechts' (standaard)  Overzicht, Financiën, Relaties, Fabrieken,
                             Instellingen. De titel staat links, de primaire
                             knop staat RECHTS UITGELIJND op dezelfde regel.
                             De titel is dan de plek waar je landt en de knop
                             de plek waar je naartoe reikt.
       'naast'               Projecten. De knop sluit DIRECT aan op de tekst
                             van de titel, alsof hij erbij hoort. Dat werkt
                             daar omdat "Projecten" één kort woord is; bij
                             "Goedemorgen, Steffan" zou de knop midden op de
                             regel gaan zweven.

     IN BEIDE GEVALLEN STAAT HET ••• DIRECT NAAST DE PRIMAIRE KNOP. Het is de
     rest van diezelfde actie en hoort er dus tegenaan, niet ergens anders in
     de kolom. Ze zitten daarom altijd in hetzelfde groepje (.u-pagehead-acts)
     en dat groepje verhuist als geheel.

     TERUGVALREGEL VOOR EEN AANROEPER DIE ZIJN KNOP IN `badge` ZET
     Een scherm dat zijn primaire knop als kant-en-klaar element in het
     badgeslot meegeeft (dat is vandaag het geval op Projecten) bedoelt
     onmiskenbaar de vorm 'naast': hij hangt zijn knop letterlijk aan de
     titelregel. Zonder actiePlaats zou het ••• dan als enige naar rechts
     vliegen en precies de losgeslagen stand opleveren die de mockup niet
     heeft. Staat er dus een knopelement in `badge` en géén `primair`, dan
     kiest dit component 'naast'. Een expliciete actiePlaats wint altijd. */
  function pageHeader(opts) {
    var o = opt(opts);
    var h1 = el('h1', { tabindex: '-1', id: uid('kop') }, str(o.titel) || null);

    var bijzin = str(o.bijzin);
    if (bijzin) {
      /* begint de bijzin al met een streepje of een punt, dan is de
         scheiding van de aanroeper en zet dit component er geen tweede bij */
      var eerste = bijzin.charAt(0);
      var eigenScheiding = (eerste === '—' || eerste === '–' || eerste === '-' || eerste === '·' || eerste === ':');
      h1.appendChild(document.createTextNode(' '));
      h1.appendChild(el('span', {
        class: 'u-bijzin',
        text: (eigenScheiding ? '' : '— ') + bijzin
      }));
    }

    /* het badgeslot: een kant-en-klaar element of een woord dat een chip
       wordt. Apart in een variabele omdat de terugvalregel hieronder wil
       weten of er een KNOP in staat. */
    var badgeNode = isNode(o.badge) ? o.badge : (str(o.badge) ? statusChip({ label: o.badge }) : null);

    /* .u-pagehead-titel staat sinds deze ronde in admin-ui.css; hij was
       inline gezet omdat .pagehead in de <style> van beheer.html woont en dat
       bestand niet aangeraakt mag worden. Dat argument gold nooit voor
       admin-ui.css zelf: een NIEUWE klasse daar raakt beheer.html niet. */
    var titelRegel = el('div', { class: 'u-pagehead-titel' }, [h1, badgeNode]);

    var statusRegel = null;
    if (isNode(o.status)) {
      statusRegel = o.status;
    } else if (isObj(o.status) || (typeof o.status === 'string' && str(o.status))) {
      statusRegel = statusDot(o.status);
    }
    if (statusRegel) {
      /* alleen een marge; de vorm zit in .u-status */
      statusRegel = el('div', { class: 'u-pagehead-status' }, statusRegel);
    }

    var links = el('div', { class: 'u-pagehead-links' }, [
      arr(o.crumbs).length ? crumbs(o.crumbs) : null,
      str(o.kicker) ? el('span', { class: 'kicker u-kicker', text: str(o.kicker) }) : null,
      titelRegel,
      statusRegel
    ]);

    var acties = [];
    var p = opt(o.primair);
    if (str(p.label)) {
      /* de mockupknop draagt vaak een plusje ("Nieuw project +"). Het icoon
         staat NA het label, precies zoals daar, en is decoratie: het label
         zegt al wat de knop doet. */
      acties.push(el('button', {
        type: 'button',
        class: knopKlasse(p.klasse),
        disabled: !!p.disabled,
        title: p.titel || null,
        onclick: fn(p.onClick) || null
      }, [
        el('span', { text: str(p.label) }),
        str(p.ico) ? icon(str(p.ico), 18) : null
      ]));
    }
    if (arr(o.menu).length) {
      acties.push(contextMenu({ knop: { titel: o.menuTitel || 'Meer acties op deze pagina' }, items: o.menu }).el);
    }

    /* WELKE VAN DE TWEE KOPPEN WORDT HET. Een expliciete keuze wint; daarna
       de terugvalregel uit het kopblok; anders de mockupstandaard 'rechts'. */
    var plaats = str(o.actiePlaats);
    if (plaats !== 'naast' && plaats !== 'rechts') {
      var knopInBadge = !!(badgeNode && badgeNode.querySelector &&
        (badgeNode.tagName === 'BUTTON' || badgeNode.querySelector('button')));
      plaats = (!str(p.label) && knopInBadge) ? 'naast' : 'rechts';
    }

    var actieVak = acties.length ? el('div', { class: 'u-pagehead-acts' }, acties) : null;
    /* 'naast': het hele groepje schuift de titelregel in en sluit daarmee aan
       op de tekst. .u-pagehead-titel is al flex met align-items:center, dus er
       is geen tweede maatvoering nodig — en juist dat is de bedoeling: één
       vorm, twee plaatsen. */
    if (actieVak && plaats === 'naast') titelRegel.appendChild(actieVak);

    var kop = el('header', { class: 'pagehead u-pagehead ' + (plaats === 'naast' ? 'acties-naast' : 'acties-rechts') }, [
      links,
      (actieVak && plaats === 'rechts') ? actieVak : null
    ]);

    /* de shell heeft de h1 nodig na elke routewissel. Beide velden blijven
       staan: focusTitel() is de weg voor een scherm dat zijn kop doorgeeft
       (dan hoeft de opbouw hierboven nooit vast te liggen), titelEl is er
       voor wie de h1 zelf ergens anders voor nodig heeft — een aria-labelledby
       op een paneel bijvoorbeeld. */
    kop.titelEl = h1;
    kop.focusTitel = function () { return herstelFocus(h1); };
    return kop;
  }

  /* ============================================================
     3. FILTERS EN TABS

     Twee verschillende dingen, en dat is precies waar het vandaag misgaat:
     vdTabBtn, filterChip en tabBtn zijn drie bijna identieke functies die
     alle drie hetzelfde ding zijn — een knop die eruitziet als een tab maar
     zich gedraagt als een filter, zonder enige aria.

     filterChips VERKLEINT wat er al staat  → aria-pressed, geen tablist.
     tabs       WISSELT wat je ziet          → role=tab, panelen, pijltjes.
     ============================================================ */

  /* het aantal staat IN het label, zoals filterChip dat vandaag al doet;
     .u-count zet het in mono met tabular-nums zodat de chips niet dansen
     terwijl de aantallen veranderen */
  function telSpan(aantal) {
    if (typeof aantal !== 'number') return null;
    return el('span', { class: 'u-count', text: String(aantal) });
  }

  /* filterChips({chips, actief, onKies, verbergNul})
     chips: [{key, label, count, altijd}]
     Geeft het element terug, met node.zetActief(key) erop. Dat laatste is
     een bewuste toevoeging: bij een herrender van de hele rij verliest de
     chip die focus had zijn focus, en dan springt de gebruiker terug naar
     het begin van de pagina. Alleen aria-pressed omzetten voorkomt dat. */
  function filterChips(opts) {
    var o = opt(opts);
    var lijst = arr(o.chips).filter(function (c) { return isObj(c) && str(c.key); });
    var actief = str(o.actief);
    var kies = fn(o.onKies);
    var wrap = el('div', { class: 'u-chips', role: 'group', 'aria-label': str(o.label) || 'Filters' });
    /* per sleutel de knoop ÉN zijn telling. De telling moet bewaard blijven,
       want zetActief() moet dezelfde verbergvoorwaarde opnieuw kunnen
       stellen; zonder die gegevens kon een chip alleen nog tevoorschijn
       komen en nooit meer terug. */
    var knoppen = {};

    /* de verbergvoorwaarde staat één keer, zodat bouwen en wisselen niet uit
       elkaar kunnen lopen. Twee uitzonderingen die je pas merkt als ze
       ontbreken: de chip die NU aan staat mag nooit verdwijnen (dan zie je
       niet meer waarom de lijst leeg is), en een chip met altijd:true —
       "Alles" — hoort er ook bij nul te staan. */
    function moetVerbergen(k) {
      var v = knoppen[k];
      if (!v) return false;
      return !!o.verbergNul && v.count === 0 && k !== actief && !v.altijd;
    }

    lijst.forEach(function (c) {
      var label = str(c.label) || str(c.key);
      var heeftTel = typeof c.count === 'number';
      var b = el('button', {
        type: 'button',
        class: 'u-chip',
        'aria-pressed': (str(c.key) === actief) ? 'true' : 'false',
        /* de zichtbare tekst wordt "Nieuw 12" en dat leest een schermlezer
           ook zo voor; het expliciete label maakt er "Nieuw, 12 items" van */
        'aria-label': heeftTel ? (label + ', ' + nlAantal(c.count, 'item', 'items')) : null,
        onclick: kies ? function () { kies(str(c.key), c); } : null
      }, [document.createTextNode(label), heeftTel ? telSpan(c.count) : null]);

      knoppen[str(c.key)] = { el: b, count: heeftTel ? c.count : null, altijd: !!c.altijd };
      verberg(b, moetVerbergen(str(c.key)));
      wrap.appendChild(b);
    });

    wrap.zetActief = function (key) {
      actief = str(key);
      Object.keys(knoppen).forEach(function (kk) {
        knoppen[kk].el.setAttribute('aria-pressed', kk === actief ? 'true' : 'false');
        /* niet alleen tevoorschijn halen maar ook weer wegzetten: een lege
           chip die één keer actief was, bleef anders voorgoed staan en dan
           groeit de rij stil aan tijdens het gebruik */
        verberg(knoppen[kk].el, moetVerbergen(kk));
      });
    };
    return wrap;
  }

  /* tabs({tabs, actief, onKies})
     tabs: [{key, label, panelId, count}]
     Echte tabs. Dit bestaat vandaag nergens correct in de app: geen enkele
     role=tab, geen aria-controls, geen pijltjesbediening.

     Automatische activering (pijltje wisselt meteen van paneel) en niet
     handmatig, omdat elk paneel hier al gerenderd of goedkoop te renderen
     is; handmatige activering vraagt een extra Enter voor niets.

     Elke tab krijgt een afgeleid id: panelId + '-tab'. Daarmee kan de
     aanroeper op zijn paneel aria-labelledby zetten zonder dit component
     iets terug te hoeven vragen.

     DE MOCKUPVORM IS DE ONDERSTREEPTE, EN DAT IS EEN CSS-KEUZE
     Spec 4/hoofdstuk 0: geen pillen maar lopende tekst met een ZWARTE lijn
     onder de actieve tab. admin-ui.css doet dat op .u-tab[aria-selected] met
     border-bottom-color:var(--ink) — dit component hoeft dus geen tweede
     variantklasse te zetten en doet dat ook niet. Wat het WEL doet is de
     telling los van het label houden in .u-count: mono, tabular-nums en een
     lichtere kleur (--ink-2 naast --ink), zodat "Klanten 2" niet leest als
     één woord en de rij niet danst als een aantal verandert.
     Wie hier ooit een pilvariant bij wil: dat is .u-chips en dus
     filterChips() — twee verschillende dingen, zie het kopblok hierboven. */
  function tabs(opts) {
    var o = opt(opts);
    var lijst = arr(o.tabs).filter(function (t) { return isObj(t) && str(t.key); });
    var kies = fn(o.onKies);
    var actief = str(o.actief) || (lijst.length ? str(lijst[0].key) : '');
    var lijstEl = el('div', {
      class: 'u-tabs' + (str(o.klasse) ? ' ' + str(o.klasse) : ''),
      role: 'tablist',
      'aria-label': str(o.label) || 'Onderdelen'
    });
    var knoppen = [];

    function zetActief(key, verplaatsFocus) {
      actief = str(key);
      knoppen.forEach(function (b) {
        var aan = b.getAttribute('data-key') === actief;
        b.setAttribute('aria-selected', aan ? 'true' : 'false');
        /* roving tabindex: precies één tab is bereikbaar met Tab, de rest
           met de pijltjes. Anders kost het doorlopen van een tabrij van zes
           zes Tabs voordat je bij de inhoud bent. */
        b.setAttribute('tabindex', aan ? '0' : '-1');
        if (aan && verplaatsFocus) herstelFocus(b);
      });
    }

    function ga(vanaf, stap) {
      if (!knoppen.length) return;
      var i = (vanaf + stap + knoppen.length) % knoppen.length;
      var key = knoppen[i].getAttribute('data-key');
      zetActief(key, true);
      if (kies) kies(key, lijst[i]);
    }

    lijst.forEach(function (t, i) {
      var pid = str(t.panelId);
      var heeftTel = typeof t.count === 'number';
      var b = el('button', {
        type: 'button',
        class: 'u-tab',
        role: 'tab',
        id: pid ? pid + '-tab' : uid('tab'),
        'data-key': str(t.key),
        'aria-selected': 'false',
        'aria-controls': pid || null,
        tabindex: '-1',
        onclick: function () {
          zetActief(str(t.key), false);
          if (kies) kies(str(t.key), t);
        },
        onkeydown: function (e) {
          if (e.key === 'ArrowRight') { e.preventDefault(); ga(i, 1); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); ga(i, -1); }
          else if (e.key === 'Home') { e.preventDefault(); ga(-1, 1); }
          else if (e.key === 'End') { e.preventDefault(); ga(0, -1); }
        }
      }, [
        document.createTextNode(str(t.label) || str(t.key)),
        heeftTel ? telSpan(t.count) : null
      ]);
      knoppen.push(b);
      lijstEl.appendChild(b);
    });

    zetActief(actief, false);
    lijstEl.zetActief = function (key) { zetActief(key, false); };
    return lijstEl;
  }

  /* ============================================================
     4. STATUS EN SAMENVATTING
     ============================================================ */

  /* Hier gaan .awaiting en .crit eindelijk uit elkaar. Ze stonden in
     beheer.html op exact dezelfde drie waarden terwijl ze iets heel anders
     betekenen; admin-ui.css hoofdstuk 2 splitst de kleuren, en deze tabel
     splitst de bedoeling:

       neutraal  grijs    er is niets aan de hand
       klaar     groen    af, betaald, goedgekeurd
       nu        zwart    dit is de huidige stand
       wacht     oranje   vraagt jouw aandacht, nog niet te laat
       extern    blauw    de bal ligt bij klant, fabriek of vervoerder
       kritiek   rood     te laat

     'wacht' en 'extern' zijn de twee tonen die tot nu toe niet bestonden en
     die samen alle achttien .awaiting-plekken moeten opvangen. */
  var TONEN = {
    neutraal: 'neutral',
    klaar: 'done',
    nu: 'current',
    wacht: 'warn',
    extern: 'info',
    kritiek: 'crit'
  };

  function statusChip(opts) {
    var o = (typeof opts === 'string') ? { label: opts } : opt(opts);
    var klasse = TONEN[str(o.toon)] || TONEN.neutraal;
    return el('span', {
      class: 'chip ' + klasse,
      /* de titel is een toelichting, geen vervanging: de zichtbare tekst
         draagt de betekenis al, want de spec eist dat status nooit alleen
         via kleur wordt gemeld. Een aria-label hier zou de tekst juist
         OVERSCHRIJVEN en dat zou het slechter maken. */
      title: str(o.titel) || null,
      text: str(o.label)
    });
  }

  /* summaryCard({label, waarde, toon, sub, onClick, verbergBijNul})
     De kaart bestaat vandaag twee keer lokaal (statgrid op Vandaag en de
     klantkop) en tekent altijd alle vijf tegels, ook die op nul staan. Dat
     is letterlijk de klacht uit de opdracht: vijf tegels waarvan er drie nul
     zeggen, lezen als "er is niets" terwijl er twee dingen open staan.

     Klikken gaat naar een gefilterde lijst, niet naar een anker. Een
     scrollIntoView belooft dat er onderaan iets staat; een filter laat het
     zien. */
  function isNul(waarde) {
    if (typeof waarde === 'number') return waarde === 0;
    var s = str(waarde).trim();
    return s === '' || s === '0';
  }

  function summaryCard(opts) {
    var o = opt(opts);
    var klik = fn(o.onClick);
    var toon = TONEN[str(o.toon)] ? str(o.toon) : null;
    /* de toonklassen op .u-stat heten crit/warn/info/ok — die van .chip
       heten net anders (done i.p.v. ok), dus geen gedeelde tabel */
    var statToon = { klaar: 'ok', wacht: 'warn', extern: 'info', kritiek: 'crit' }[toon] || '';

    var kinderen = [
      el('span', { class: 'u-stat-lbl', text: str(o.label) }),
      el('span', { class: 'u-stat-num', text: str(o.waarde) }),
      str(o.sub) ? el('span', { class: 'u-stat-sub', text: str(o.sub) }) : null
    ];

    /* een tegel zonder bestemming is geen knop. Dat is geen purisme: een
       button zonder handler is een tabstop die niets doet, en in een rij van
       vier zijn dat vier stops voor niets. */
    var node = klik
      ? el('button', { type: 'button', class: 'u-stat' + (statToon ? ' ' + statToon : ''), onclick: klik }, kinderen)
      : el('div', { class: 'u-stat' + (statToon ? ' ' + statToon : '') }, kinderen);

    if (o.verbergBijNul && isNul(o.waarde)) verberg(node, true);
    return node;
  }

  /* summaryRow(kaarten) — het raster eromheen.
     Maximaal vier: dat is geen CSS-grens maar een leesgrens, en hij staat
     hier zodat niemand hem per pagina opnieuw hoeft te bewaken.
     Is alles verborgen, dan is het raster zelf verborgen — een lege
     marge van 26px onder een onzichtbaar raster is de zichtbare versie van
     "hier stond ooit iets". */
  function summaryRow(kaarten) {
    var lijst = arr(kaarten).filter(isNode).filter(function (n) { return !n.hidden; }).slice(0, 4);
    var wrap = el('div', { class: 'u-stats' }, lijst);
    if (!lijst.length) verberg(wrap, true);
    return wrap;
  }

  /* ============================================================
     5. RIJEN: TAAK, ENTITEIT, LEGE TOESTAND
     ============================================================ */

  /* chipUit() accepteert zowel een kant-en-klaar element als een spec, zodat
     een aanroeper die al een bijzondere chip heeft (de klok-chips van de
     vragenlijst) hem gewoon kan doorgeven */
  function chipUit(v) {
    if (v == null) return null;
    if (isNode(v)) return v;
    if (typeof v === 'string') return statusChip({ label: v });
    return statusChip(v);
  }

  /* taskCard({vorm, titel, kicker, context, meta, chip, primair, menu, inline,
               urgent, why, beeld, onOpen})
     Bouwt voort op buildRow() en zijn zeven rijvarianten in beheer.html. Die
     beantwoorden de vier vragen van de spec al (wat, van wie, waarom nu, wat
     doe ik) — het probleem is de rechterkant: rowFactuur zet vandaag ZES
     controls naast elkaar (open project, herinnering, betaald, eigenaar,
     snooze, pin). Hier is het er één, plus •••.

     BEHOUDEN uit rowVraag: het inline uitklapveld onder de kaart. Dat is het
     antwoordveld met focusdoorstroom naar de volgende open vraag, en het is
     het beste stukje interactie dat het beheer heeft. Het staat hier als
     'inline' zodat de aanroeper zijn eigen veld meegeeft en de doorstroom
     zelf houdt — die logica hoort bij de vragenlijst, niet bij de kaart.

     TWEE VORMEN, WANT DE MOCKUP HEEFT ER TWEE — vorm:'kaart' | 'rij'

       'kaart' (standaard)  wat er altijd al stond: chip, titel, context,
                            reden, meta eronder, en RECHTS een primaire knop
                            plus •••. Dit is de vorm van het Inbox-detail en
                            van elke plek waar de actie zelf in beeld moet.

       'rij'                de vorm die de mockup op Overzicht ("Nu doen") en
                            in de Inbox-LIJST tekent, en die hoofdstuk 5.1 ook
                            met zoveel woorden beschrijft: "tegel/avatar ·
                            kicker+titel · meta rechts · chevron". GEEN knop
                            in de rij. De hele rij is de knop, de meta staat
                            rechts, en alle bediening zit achter het •••.

     WAAROM DE KNOP DAAR WEG MOET is geen smaak. Een rij met een volle knop
     erin heeft twee even zware doelen naast elkaar: de rij en de knop. De
     gebruiker moet dan per rij lezen wélke van de twee hij wil, en dat is
     precies het werk dat een lijst je hoort te besparen. Met één doel en een
     chevron is de belofte overal dezelfde: klikken opent dit item.

     EEN KNOP IN EEN KNOP BESTAAT NIET, dus dezelfde splitsing als entityRow:
       zonder ••• → de rij ZELF is de <button>;
       met •••    → de rij is een <div> waarin beeld en tekst één <button>
                    zijn, plus een klik op de rest van de rij.
     Alle tekstsloten in de rijvorm zijn <span>, want binnen een button hoort
     frasering-inhoud te staan — dezelfde regel die admin-ui.css hoofdstuk 4
     al opschrijft. */
  function taskCard(opts) {
    var o = opt(opts);
    var toonKlasse = '';
    if (o.urgent === true) toonKlasse = ' crit';
    else if (typeof o.urgent === 'string' && o.urgent) toonKlasse = ' ' + o.urgent;

    if (str(o.vorm) === 'rij') return taakRij(o, toonKlasse);

    var acties = [];
    var p = opt(o.primair);
    if (str(p.label)) {
      acties.push(el('button', {
        type: 'button',
        class: knopKlasse('klein ' + str(p.klasse)),
        text: str(p.label),
        disabled: !!p.disabled,
        title: p.titel || null,
        onclick: fn(p.onClick) || null
      }));
    }
    if (arr(o.menu).length) {
      acties.push(contextMenu({
        knop: { titel: (str(o.titel) ? 'Meer acties bij: ' + str(o.titel) : 'Meer acties') },
        items: o.menu
      }).el);
    }

    var metaKinderen = [];
    arr(isObj(o.meta) || typeof o.meta === 'string' ? [o.meta] : o.meta).forEach(function (m) {
      if (m == null) return;
      metaKinderen.push(isNode(m) ? m : el('span', { text: str(m) }));
    });

    /* het beeldslot vooraan. In de mockup staat daar op elke "Nu doen"-rij
       een icoontegel of een avatar (spec 5.1: "tegel/avatar · kicker+titel ·
       meta rechts · chevron"). Het is een kant-en-klaar element van de
       aanroeper, want alleen die weet of het een tegel of een gezicht is. */
    var rij = el('div', { class: 'u-task' + toonKlasse }, [
      isNode(o.beeld) ? o.beeld : null,
      chipUit(o.chip),
      el('div', { class: 'u-task-body' }, [
        el('span', { class: 'u-task-title', text: str(o.titel) }),
        str(o.context) ? el('span', { class: 'u-task-ctx', text: str(o.context) }) : null,
        str(o.why) ? el('span', { class: 'u-task-why', text: str(o.why) }) : null,
        metaKinderen.length ? el('div', { class: 'u-task-meta' }, metaKinderen) : null
      ]),
      acties.length ? el('div', { class: 'u-task-acts' }, acties) : null
    ]);

    /* de wikkel is de rij in een .rowlist (die zet de scheidingslijn op elk
       direct kind); het uitklapveld hoort ONDER de kaart en binnen dezelfde
       scheidingslijn te vallen. Zelfde constructie als rowVraag. */
    return el('div', null, [rij, isNode(o.inline) ? o.inline : null]);
  }

  /* de rijvorm van taskCard. Zie het kopblok hierboven voor het waarom; dit
     is alleen het hoe.

     DE LEESVOLGORDE VAN DE MOCKUP, VAN LINKS NAAR RECHTS:
       beeldslot (icoontegel of avatar)
       kickerregel  "Klantenvraag · Nordisk Retail"   13px, --ink-2
       titel        "Maatvoering van de binnenpan"    16px, weight 500
       meta rechts  "30 min", "Vandaag"               mag een chip of een
                                                      statusstip zijn
       •••          alleen als er acties zijn
       chevron      alleen als de rij ergens heen gaat

     De PRIMAIRE actie van de aanroeper verdwijnt niet: staat er een
     opts.primair meegegeven, dan wordt die als EERSTE item vooraan in het
     •••-menu gezet. Anders zou een scherm dat overstapt op vorm:'rij' stil
     zijn belangrijkste knop kwijtraken, en dat is het soort verlies dat
     niemand meteen ziet. */
  function taakRij(o, toonKlasse) {
    var open = fn(o.onOpen);

    var menuItems = arr(o.menu).slice(0);
    var p = opt(o.primair);
    if (str(p.label)) {
      menuItems.unshift({
        label: str(p.label),
        ico: str(p.ico) || null,
        titel: str(p.titel) || null,
        uit: !!p.disabled,
        onKies: fn(p.onClick) || null
      });
    }

    var menuNode = menuItems.length ? contextMenu({
      knop: { titel: (str(o.titel) ? 'Meer acties bij: ' + str(o.titel) : 'Meer acties') },
      items: menuItems
    }).el : null;

    var body = el('span', { class: 'u-task-body' }, [
      str(o.kicker) ? el('span', { class: 'u-task-kicker', text: str(o.kicker) }) : null,
      chipUit(o.chip),
      el('span', { class: 'u-task-title', text: str(o.titel) }),
      str(o.context) ? el('span', { class: 'u-task-ctx', text: str(o.context) }) : null,
      str(o.why) ? el('span', { class: 'u-task-why', text: str(o.why) }) : null
    ]);

    var metaKinderen = [];
    arr(isObj(o.meta) || typeof o.meta === 'string' ? [o.meta] : o.meta).forEach(function (m) {
      if (m == null) return;
      metaKinderen.push(isNode(m) ? m : el('span', { text: str(m) }));
    });

    var staart = [];
    if (metaKinderen.length) staart.push(el('span', { class: 'u-task-metarechts' }, metaKinderen));
    if (menuNode) staart.push(menuNode);
    /* het chevronnetje hangt aan onOpen en niet aan een losse optie: het is de
       belofte "hier zit iets achter", en die mag er niet staan als er niets
       achter zit. Met chevron:false kan een scherm hem alsnog weglaten. */
    if (open && o.chevron !== false) staart.push(chevronRij());
    var einde = staart.length ? el('span', { class: 'u-task-end' }, staart) : null;

    var klasse = 'u-task u-task-rij' + toonKlasse;

    /* zonder ••• kan de hele rij één <button> zijn — precies wat hoofdstuk 8
       van de spec vraagt, en dus de vorm die de voorkeur heeft */
    if (open && !menuNode) {
      return el('button', { type: 'button', class: klasse, onclick: open }, [
        isNode(o.beeld) ? o.beeld : null, body, einde
      ]);
    }

    if (open) {
      var knop = el('button', {
        type: 'button',
        class: 'u-task-klik',
        onclick: open
      }, [isNode(o.beeld) ? o.beeld : null, body]);
      var rij = el('div', { class: klasse }, [knop, einde]);
      /* de rest van de rij opent ook, maar nooit een klik die in het
         staartstuk begon — daar zit het ••• */
      rij.addEventListener('click', function (e) {
        if (binnen(e.target, knop)) return;
        if (einde && binnen(e.target, einde)) return;
        open();
      });
      return rij;
    }

    /* geen bestemming: dan is dit geen knop maar een regel. Een button zonder
       handler is een tabstop die niets doet. */
    return el('div', { class: klasse }, [isNode(o.beeld) ? o.beeld : null, body, einde]);
  }

  /* entityRow({thumb, titel, sub, volgendeActie, meta, chips, onOpen, menu})
     Bouwt op .rowitem + .nextact. Twee dingen veranderen:

     1. De hele rij is klikbaar. Vandaag is dat 3 van de 34 keer, en een
        gebruiker die één keer op een rij heeft geklikt die niets deed,
        klikt daarna nergens meer op een rij.

     2. Er is een beeldslot van vaste maat, ook zonder foto. Anders trapt een
        lijst waarin de helft een foto heeft.

     AFWIJKING, BEWUST: de opdracht vraagt "button, geen div met onclick".
     Dat kan niet samen met een ••• in dezelfde rij — een button in een
     button is ongeldige HTML en de binnenste knop wordt in de meeste
     browsers onbereikbaar. Daarom:
       zonder menu → de rij IS een <button> (precies zoals gevraagd);
       met menu    → de rij is een <div> waarin alles behalve het staartstuk
                     één <button> is, plus een klik op de rij zelf. Toetsen-
                     bord houdt dan één tabstop voor openen en één voor •••,
                     en dat is ook de bedoeling. */
  function entityRow(opts) {
    var o = opt(opts);
    var open = fn(o.onOpen);
    var menuItems = arr(o.menu);

    /* beeldslot: een <img> als er een bron is, anders een tegel met de
       initialen. .u-thumb.ph is daar in admin-ui.css op gemaakt (mono,
       gecentreerd). Het slot is 56x56 sinds de mockupronde en 44 onder
       700px; die maten staan in de CSS en nergens hier — een inline maat zou
       de twee uit elkaar laten lopen. */
    var thumb = null;
    if (o.thumb !== false) {
      if (isNode(o.thumb)) {
        thumb = o.thumb;
      } else if (str(o.thumb)) {
        thumb = el('img', { class: 'u-thumb', src: str(o.thumb), alt: '', loading: 'lazy' });
      } else {
        thumb = el('span', { class: 'u-thumb ph', 'aria-hidden': 'true', text: initialenUit(str(o.titel)) });
      }
    }

    /* <span> en geen <div>: in de tak zonder ••• IS deze rij een <button>, en
       binnen een button hoort frasering-inhoud te staan. admin-ui.css zet
       .u-row-main al op display:block, dus er verandert niets aan het beeld —
       wel aan de geldigheid van de HTML. Dezelfde regel geldt voor .u-row-end
       hieronder. */
    var tekst = el('span', { class: 'u-row-main' }, [
      el('span', { class: 'u-row-title', text: str(o.titel) }),
      str(o.sub) ? el('span', { class: 'u-row-sub', text: str(o.sub) }) : null,
      /* de volgende-actie-regel bestaat al als .nextact en heeft twee
         standen: er is een actie (ink) of er is er geen (grijs). Die tweede
         stand is nuttige informatie en mag niet wegvallen. */
      o.volgendeActie === undefined ? null
        : el('span', {
          class: 'u-row-next' + (str(o.volgendeActie) ? '' : ' none'),
          text: str(o.volgendeActie) || 'Geen open actie'
        })
    ]);

    var staart = [];
    arr(o.chips).forEach(function (c) { var n = chipUit(c); if (n) staart.push(n); });
    if (str(o.meta)) staart.push(el('span', { class: 'u-row-meta', text: str(o.meta) }));
    /* het chevronnetje staat in de mockup aan het eind van élke rij die
       ergens heen gaat, en nergens anders — het is de belofte "hier zit iets
       achter". Daarom hangt hij aan onOpen en niet aan een losse optie; met
       chevron:false kan een scherm hem alsnog weglaten (een rij die alleen
       selecteert binnen een lijst-met-detail gaat immers niet wég). */
    var wilChevron = open && o.chevron !== false;

    var menuNode = null;
    if (menuItems.length) {
      menuNode = contextMenu({
        knop: { titel: (str(o.titel) ? 'Meer acties bij: ' + str(o.titel) : 'Meer acties') },
        items: menuItems
      }).el;
    }
    var staartNodes = staart.concat(menuNode ? [menuNode] : []);
    if (wilChevron && !menuNode) staartNodes.push(chevronRij());
    var einde = staartNodes.length ? el('span', { class: 'u-row-end' }, staartNodes) : null;

    if (open && !menuNode) {
      return el('button', { type: 'button', class: 'u-row', onclick: open }, [thumb, tekst, einde]);
    }
    if (open) {
      var knop = el('button', {
        type: 'button',
        /* .u-row-klik is "de klikbare helft van een rij": de flexopbouw van
           .u-row zonder de padding, zodat beeld en tekst binnen één tabstop
           vallen. Stond hier als inline style omdat admin-ui.css er geen
           klasse voor had; die klasse staat er sinds deze ronde wel. */
        class: 'u-row-main u-row-klik',
        onclick: open
      }, [thumb, tekst]);
      var rij = el('div', { class: 'u-row' }, [knop, einde]);
      /* de rest van de rij (padding, het gebied naast de chips) opent ook,
         maar nooit een klik die in het staartstuk begon — daar zit het ••• */
      rij.addEventListener('click', function (e) {
        if (binnen(e.target, knop)) return;
        if (einde && binnen(e.target, einde)) return;
        open();
      });
      return rij;
    }
    return el('div', { class: 'u-row' }, [thumb, tekst, einde]);
  }

  /* entityList(rijen, opts) — de witte kaart met scheidingslijnen.
     Was .card.rowlist (de vorm uit beheer.html); is sinds de mockupronde
     .u-card.u-rows. Dat is geen hernoeming om de hernoeming: .u-card heeft de
     radius van 20px en de nieuwe schaduw uit hoofdstuk 1, en .u-rows zet zijn
     binnenlijnen op --line-2 in plaats van --line — hoofdstuk 1 noemt dat
     token letterlijk "binnenlijnen in lijsten". Beide klassen staan in
     admin-ui.css, dus dit werkt binnen én buiten .u-shell.
     Wat blijft: een lege lijst krijgt een échte lege toestand in plaats van
     een grijze zin zonder uitweg. */
  function entityList(rijen, opts) {
    var o = opt(opts);
    var lijst = arr(rijen).filter(isNode);
    var kaart = el('div', { class: 'u-card u-rows' + (o.klasse ? ' ' + o.klasse : '') });
    if (!lijst.length) {
      kaart.appendChild(isNode(o.leeg) ? o.leeg : emptyState({ titel: str(o.leegTitel) || 'Niets te tonen', uitleg: o.leegUitleg, kaal: true }));
      return kaart;
    }
    lijst.forEach(function (r) { kaart.appendChild(r); });
    return kaart;
  }

  /* emptyState({titel, uitleg, actie, kaal})
     De 27 bestaande lege toestanden hebben geen enkele knop. Een lege lijst
     is bijna altijd óf goed nieuws óf een uitnodiging; zonder knop is het
     alleen een gat.

     kaal:true laat de kaartrand weg — voor een lege toestand die AL binnen
     een .card staat (zoals in entityList), want een kaart in een kaart geeft
     een dubbele rand. */
  function emptyState(opts) {
    var o = opt(opts);
    var a = opt(o.actie);
    return el('div', { class: (o.kaal ? '' : 'u-card ') + 'u-empty' }, [
      el('span', { class: 'u-empty-title', text: str(o.titel) || 'Niets te tonen' }),
      str(o.uitleg) ? el('span', { class: 'u-empty-text', text: str(o.uitleg) }) : null,
      str(a.label) ? el('button', {
        type: 'button',
        class: knopKlasse(a.klasse),
        text: str(a.label),
        onclick: fn(a.onClick) || null
      }) : null
    ]);
  }

  /* ============================================================
     6. TIJDLIJN

     Eén vorm voor wat vandaag twee bijna identieke vormen zijn: .tlrow op
     klantdetail en .logrow in het logboek. Het enige echte verschil tussen
     die twee is dat het logboek een projectkolom heeft, en dat is hier een
     optie geworden.

     De rij komt uit CP_MODEL.mergeActivity en heeft de vorm
       {at, kind, cls, actor, detail, projectId, clientId, id}
     ============================================================ */

  function kindLabel(kind, o) {
    if (fn(o.kindLabel)) return str(o.kindLabel(kind));
    var m = MODEL();
    var lijst = (m && arr(m.ACTIVITY_KINDS)) || [];
    for (var i = 0; i < lijst.length; i++) {
      if (lijst[i].key === kind) return lijst[i].label;
    }
    return str(kind);
  }

  function tijdTekst(at, o) {
    if (fn(o.formatteerTijd)) return str(o.formatteerTijd(at));
    var m = MODEL();
    /* CP_MODEL is een pure rekenlaag zonder state — dit is de enige globale
       die dit bestand aanraakt, en alleen voor datumopmaak. Ontbreekt hij,
       dan tonen we de ruwe waarde: onhandig, maar nooit leeg en nooit fout. */
    if (m && fn(m.formatDateTime)) return str(m.formatDateTime(at));
    return str(at);
  }

  /* timelineRow(rij, opts)
     opts: {toonProject, projectLabel(rij)|projectTekst, formatteerTijd,
            kindLabel, onOpen(rij)} */
  function timelineRow(rij, opts) {
    var r = opt(rij);
    var o = opt(opts);
    var projectTekst = null;
    if (o.toonProject) {
      projectTekst = fn(o.projectLabel) ? str(o.projectLabel(r)) : str(o.projectTekst || r.projectCode || r.projectId);
    }
    var kinderen = [
      el('span', { class: 'u-tl-when', text: tijdTekst(r.at, o) }),
      el('span', { class: 'u-tl-kind' }, statusChip({ label: kindLabel(r.kind, o), toon: 'neutraal' })),
      el('span', { class: 'u-tl-detail', text: str(r.detail) }),
      projectTekst ? el('span', { class: 'u-tl-proj', text: projectTekst }) : null
    ];
    /* de kindchip draagt de bronklasse van CP_MODEL (act-klant, act-mail,
       …) náást de neutrale chiptoon. Bestaat die klasse nog niet in CSS, dan
       blijft de chip gewoon neutraal — dat is de bedoelde terugval en geen
       ontbrekende regel. */
    if (str(r.cls)) kinderen[1].firstChild.classList.add(str(r.cls));

    if (fn(o.onOpen)) {
      return el('button', {
        type: 'button',
        class: 'u-tl-row',
        /* .u-tl-row is geen knop in de CSS; een klikbare tijdlijnrij komt
           alleen in het logboek voor en heeft daar deze twee resets nodig */
        style: 'width:100%;text-align:left;',
        onclick: function () { o.onOpen(r); }
      }, kinderen);
    }
    return el('div', { class: 'u-tl-row' }, kinderen);
  }

  /* timeline(rijen, opts) — de kaart eromheen, met lege toestand. */
  function timeline(rijen, opts) {
    var o = opt(opts);
    var lijst = arr(rijen);
    var kaart = el('div', { class: 'u-card u-tl' });
    if (!lijst.length) {
      kaart.appendChild(isNode(o.leeg) ? o.leeg : emptyState({
        titel: str(o.leegTitel) || 'Nog geen activiteit',
        uitleg: str(o.leegUitleg) || 'Zodra er iets gebeurt — een mail, een goedkeuring, een betaling — verschijnt het hier.',
        kaal: true
      }));
      return kaart;
    }
    lijst.forEach(function (r) { kaart.appendChild(timelineRow(r, o)); });
    return kaart;
  }

  /* ============================================================
     7. MENU EN INLINE BEVESTIGING

     Dit is het component met het meeste nieuwe werk, want er bestaat vandaag
     GEEN ENKEL menu-, dropdown- of popoverpatroon in het hele beheer. Alles
     eromheen is dus nieuw: aria-haspopup, aria-expanded, role=menu,
     roving tabindex, pijltjes, Home/End, Escape met focusherstel, klik
     buiten, en niet buiten het scherm vallen.

     Het ••• komt straks terug in TaskCard, EntityRow, ProjectHeader, de
     paginakop, Financiën en Overzicht. Eén keer goed is hier het verschil
     tussen zes toegankelijke menu's en zes onbereikbare.
     ============================================================ */

  /* confirmInline({vraag, bevestigLabel, annuleerLabel, gevaarlijk,
                    onBevestig, onAnnuleer})
     Vervangt de laatste window.confirm() (het verwijderen van een
     projectsjabloon). Bewust géén modal: een bevestiging die je uit het menu
     naar het midden van het scherm gooit, kost meer aandacht dan de vraag
     waard is. Geeft {el, focus} terug. */
  function confirmInline(opts) {
    var o = opt(opts);
    var ja = el('button', {
      type: 'button',
      class: knopKlasse('klein' + (o.gevaarlijk === false ? '' : ' gevaar')),
      text: str(o.bevestigLabel) || 'Ja, doorgaan',
      onclick: fn(o.onBevestig) || null
    });
    var nee = el('button', {
      type: 'button',
      class: knopKlasse('ghost klein'),
      text: str(o.annuleerLabel) || 'Annuleer',
      onclick: fn(o.onAnnuleer) || null
    });
    var wrap = el('div', {
      class: 'u-menu-item',
      role: 'group',
      'aria-label': str(o.vraag) || 'Bevestiging',
      /* .u-menu-item is een rij; een bevestiging is twee regels. Alleen de
         richting draait om, de rest van de vorm (padding, radius) blijft. */
      style: 'flex-direction:column;align-items:stretch;gap:9px;cursor:default;',
      onkeydown: function (e) {
        if (e.key === 'Escape' && fn(o.onAnnuleer)) { e.preventDefault(); e.stopPropagation(); o.onAnnuleer(); }
      }
    }, [
      el('span', { style: 'font-size:13px;line-height:1.5;', text: str(o.vraag) || 'Weet je het zeker?' }),
      el('div', { style: 'display:flex;gap:8px;' }, [nee, ja])
    ]);
    return {
      el: wrap,
      /* de gevaarlijke knop krijgt NIET de focus: wie het menu per ongeluk
         opende, mag niet met één Enter iets verwijderen */
      focus: function () { herstelFocus(nee); }
    };
  }

  /* contextMenu({knop, items, kop, uitlijning})
     items: [{label, onKies, gevaarlijk, uit, scheiding, kop, hint, ico,
              bevestig:{vraag, bevestigLabel}}]
     Geeft {el, open, sluit, isOpen} terug. */
  function contextMenu(opts) {
    var o = opt(opts);
    var items = arr(o.items).filter(isObj);
    var menuId = uid('menu');

    var knop;
    if (isNode(o.knop)) {
      knop = o.knop;
    } else {
      var kSpec = opt(o.knop);
      knop = str(kSpec.label)
        ? el('button', { type: 'button', class: knopKlasse('ghost klein'), text: str(kSpec.label), title: kSpec.titel || null })
        : iconKnop('meer', str(kSpec.titel) || 'Meer acties');
    }
    knop.setAttribute('aria-haspopup', 'menu');
    knop.setAttribute('aria-expanded', 'false');

    var wrap = el('div', { class: 'u-menuwrap' }, knop);
    var menu = null;
    var rijen = [];   /* alleen de echte menuitems, in DOM-volgorde */

    function bereikbaar() {
      return rijen.filter(function (r) { return r.node.parentNode; });
    }

    function focusIndex(i) {
      var lijst = bereikbaar();
      if (!lijst.length) return;
      var n = ((i % lijst.length) + lijst.length) % lijst.length;
      lijst.forEach(function (r, j) { r.node.setAttribute('tabindex', j === n ? '0' : '-1'); });
      herstelFocus(lijst[n].node);
    }

    function huidigeIndex() {
      var lijst = bereikbaar();
      for (var i = 0; i < lijst.length; i++) {
        if (lijst[i].node === document.activeElement) return i;
      }
      return -1;
    }

    function opDocument(e) {
      if (!menu) return;
      if (binnen(e.target, wrap)) return;
      sluit(false);
    }

    /* het menu mag nooit buiten het scherm vallen. De CSS levert twee
       standen (.to-right spiegelt naar links, .to-up klapt omhoog); de JS
       kiest ze pas ná het meten, want vóór het invoegen heeft het menu geen
       maat. Meten en dan pas een klasse zetten kost één reflow en dat is
       goedkoper dan een menu dat half buiten beeld hangt. */
    function positioneer() {
      if (!menu) return;
      var g = G();
      var vw = (g && g.innerWidth) || 0;
      var vh = (g && g.innerHeight) || 0;
      if (!vw || !menu.getBoundingClientRect) return;
      if (o.uitlijning === 'rechts') menu.classList.add('to-right');
      var r = menu.getBoundingClientRect();
      if (r.right > vw - 8 && !menu.classList.contains('to-right')) {
        menu.classList.add('to-right');
        r = menu.getBoundingClientRect();
      }
      /* na het spiegelen kan hij links uitsteken (een ••• helemaal links op
         een smal scherm); dan is de oorspronkelijke stand alsnog de minst
         slechte */
      if (r.left < 8 && menu.classList.contains('to-right')) {
        menu.classList.remove('to-right');
        r = menu.getBoundingClientRect();
      }
      if (r.bottom > vh - 8 && r.top > (vh - r.bottom)) menu.classList.add('to-up');
    }

    /* KOPPEN EN GROEPEN
       role="menu" laat maar vier soorten kinderen toe: menuitem (en zijn twee
       radio/checkbox-varianten), group en separator. Een kale <span> met een
       koptekst valt daarmee uit de toegankelijkheidsboom en is voor een
       schermlezer dus niet aanwezig. De kop wordt daarom het aria-label van
       een role="group" om de rijen eronder, en de zichtbare span zelf gaat op
       role="presentation" plus aria-hidden — hij staat er nog voor het oog,
       maar de groep draagt de naam en niemand hoort hem twee keer. */
    var groep = null;   /* de open role=group, of null als de rijen los onder het menu hangen */

    function nieuweGroep(koptekst) {
      groep = el('div', { role: 'group', 'aria-label': str(koptekst) },
        el('span', { class: 'u-menu-label', role: 'presentation', 'aria-hidden': 'true', text: str(koptekst) }));
      menu.appendChild(groep);
    }

    function voegToe(node) {
      (groep || menu).appendChild(node);
    }

    function bouwItem(it, index) {
      var rij = el('button', {
        type: 'button',
        class: 'u-menu-item' + (it.gevaarlijk ? ' danger' : ''),
        role: 'menuitem',
        tabindex: '-1',
        /* uitgeschakelde items blijven bereikbaar met de pijltjes maar doen
           niets: ze weghalen zou de lijst per rij van vorm laten veranderen,
           en dan leert niemand waar een actie staat */
        'aria-disabled': it.uit ? 'true' : null,
        onclick: function () { kiesItem(it, index); }
      }, [
        str(it.ico) ? icon(str(it.ico), 16) : null,
        el('span', { text: str(it.label) }),
        str(it.hint) ? el('span', { class: 'u-menu-hint', text: str(it.hint) }) : null
      ]);
      return rij;
    }

    function kiesItem(it, index) {
      if (it.uit) return;
      if (isObj(it.bevestig)) {
        toonBevestiging(it, index);
        return;
      }
      /* eerst sluiten (focus terug naar de knop), dan pas de actie. Opent de
         actie een venster, dan neemt dat de focus meteen weer over; sluit hij
         niets, dan staat de gebruiker waar hij begon. Andersom zou de focus
         na een modal in het niets belanden. */
      sluit(true);
      if (fn(it.onKies)) it.onKies(it);
    }

    function toonBevestiging(it, index) {
      var rij = rijen[index];
      if (!rij || !rij.node.parentNode) return;
      var ouder = rij.node.parentNode;
      var bev = confirmInline({
        vraag: str(it.bevestig.vraag) || ('Weet je zeker dat je "' + str(it.label) + '" wilt doen?'),
        bevestigLabel: str(it.bevestig.bevestigLabel) || str(it.label),
        gevaarlijk: it.gevaarlijk !== false,
        onBevestig: function () {
          sluit(true);
          if (fn(it.onKies)) it.onKies(it);
        },
        onAnnuleer: function () {
          if (!bev.el.parentNode) return;
          ouder.replaceChild(rij.node, bev.el);
          herstelFocus(rij.node);
        }
      });
      ouder.replaceChild(bev.el, rij.node);
      bev.focus();
    }

    function open() {
      if (menu) return;
      rijen = [];
      menu = el('div', {
        class: 'u-menu',
        id: menuId,
        role: 'menu',
        'aria-label': str(o.kop) || knop.getAttribute('aria-label') || 'Acties',
        onkeydown: function (e) {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); sluit(true); return; }
          if (e.key === 'Tab') { sluit(false); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); focusIndex(huidigeIndex() + 1); return; }
          if (e.key === 'ArrowUp') { e.preventDefault(); focusIndex(huidigeIndex() - 1); return; }
          if (e.key === 'Home') { e.preventDefault(); focusIndex(0); return; }
          if (e.key === 'End') { e.preventDefault(); focusIndex(bereikbaar().length - 1); return; }
        }
      });
      groep = null;
      if (str(o.kop)) nieuweGroep(str(o.kop));

      items.forEach(function (it) {
        if (it.scheiding) {
          /* een scheiding sluit de lopende groep af: wat erna komt hoort er
             per definitie niet meer bij */
          groep = null;
          menu.appendChild(el('div', { class: 'u-menu-sep', role: 'separator' }));
          return;
        }
        if (str(it.kop) && !str(it.label)) {
          nieuweGroep(str(it.kop));
          return;
        }
        var node = bouwItem(it, rijen.length);
        rijen.push({ node: node, item: it });
        voegToe(node);
      });
      if (!rijen.length) {
        /* de lege stand is een ECHT menuitem en geen losse tekst: zo leest
           een schermlezer hem voor en blijft hij met de pijltjes bereikbaar,
           precies zoals een uitgeschakeld item. Zonder onKies doet hij
           niets — aria-disabled is hier de hele boodschap. */
        var leeg = el('button', {
          type: 'button',
          class: 'u-menu-item',
          role: 'menuitem',
          tabindex: '-1',
          'aria-disabled': 'true',
          text: 'Geen acties beschikbaar'
        });
        rijen.push({ node: leeg, item: { uit: true } });
        voegToe(leeg);
      }

      wrap.appendChild(menu);
      knop.setAttribute('aria-expanded', 'true');
      knop.setAttribute('aria-controls', menuId);
      positioneer();
      /* capture-fase: een klik op een knop elders sluit dit menu vóórdat die
         knop zijn eigen werk doet, anders staat er straks een menu open bij
         een rij die niet meer bestaat */
      document.addEventListener('mousedown', opDocument, true);
      focusIndex(0);
    }

    function sluit(focusTerug) {
      if (!menu) return;
      document.removeEventListener('mousedown', opDocument, true);
      if (menu.parentNode) menu.parentNode.removeChild(menu);
      menu = null;
      rijen = [];
      knop.setAttribute('aria-expanded', 'false');
      knop.removeAttribute('aria-controls');
      if (focusTerug) herstelFocus(knop);
    }

    knop.addEventListener('click', function (e) {
      e.preventDefault();
      if (menu) sluit(true); else open();
    });
    /* pijltje omlaag op de knop opent het menu op het eerste item — dat is
       het gedrag dat iedereen van een menu verwacht en dat scheelt een Enter */
    knop.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && !menu) { e.preventDefault(); open(); }
    });

    return {
      el: wrap,
      knop: knop,
      open: open,
      sluit: function () { sluit(true); },
      isOpen: function () { return !!menu; }
    };
  }

  /* ============================================================
     8. INDELING: lijst-met-detail, plakkend actiepaneel, instellingenkaart
     ============================================================ */

  /* masterDetail({lijst, detail, onSluitDetail, detailOpen, detailLabel,
                   focusBron, registreerLaag, verwijderLaag})
     open(bron) — geef de knop mee waarop geklikt is; zie bij open() waarom.
     focusBron is dezelfde bron voor de beginstand: de rijknop die net gekozen
     werd, voor het geval de aanroeper hem nog heeft.
     Het raster bestaat als .inved (de factuureditor); admin-ui.css heeft die
     maatvoering gekopieerd naar .u-md en .inved met rust gelaten — daar
     loopt de factuurmodulebouw in.

     Wat hier echt nieuw is, is niet het raster maar het gedrag: op smal
     scherm schuift het detail óver de lijst, er is een terugknop, en de
     focus verhuist mee. Zonder dat laatste opent een schermlezergebruiker een
     detailpaneel en blijft hij in de lijst eronder staan.

     De SELECTIE houdt de aanroeper bij, niet dit component. Dat is met opzet:
     de shell moet de selectie over een refresh() heen kunnen bewaren, en een
     component dat zelf onthoudt welk item open staat, kan die twee niet meer
     gelijk houden.

     .detail-open BETEKENT ÉÉN DING: HET DETAIL LIGT OVER DE LIJST
     Dit was de openstaande bevinding van de vorige review en hij is echt:
     boven 1100px heeft .detail-open in admin-ui.css GEEN enkele regel achter
     zich — de klasse staat daar uitsluitend binnen
     @media (max-width:1099.98px). Toch werd hij ook op een breed scherm
     gezet, en dat had een gevolg buiten dit bestand: admin-shell.js valt voor
     de vraag "staat er een laag open?" terug op
     document.querySelector('.u-md.detail-open'). Op een breed scherm vond hij
     die klasse, dacht dat er een paneel over de pagina lag, en gaf Escape
     daaraan — waarna een selectie werd losgelaten zonder dat er iets
     dichtging. Escape ging dus verloren aan een laag die niet bestond.

     Sindsdien is er één toestand meer en één betekenis minder:
       `geopend`      LOGISCH — er is een item gekozen. Dat is altijd waar of
                      niet waar, op elke breedte, en het is wat de aanroeper
                      bedoelt met open()/sluit().
       .detail-open   VISUEEL — het paneel ligt óver de lijst. Alleen op smal
                      scherm, en alleen als `geopend`.
     De mediaquery wordt gevolgd, zodat een venster dat over de grens sleept
     de twee niet uit elkaar laat lopen. isOpen() geeft de VISUELE stand
     terug, want dat is de vraag die de shell stelt; wie de logische stand
     wil, houdt zijn eigen selectie bij — zoals hierboven afgesproken.

     stop() meldt de luisteraar op de mediaquery weer af, en meldt de laag bij
     de shell weer af. Roep hem aan zodra het scherm verdwijnt, net als bij
     stickyPanel.

     ---------------------------------------------------------------------
     DRIE DINGEN DIE DIT COMPONENT SINDS DE MOCKUPRONDE ZELF DOET

     De review vond op de Inbox drie gaten tegelijk: het scherm riep open()
     niet aan, meldde de laag niet bij de shell aan, en riep stop() nooit aan.
     Dat waren drie regels in dat ene scherm — maar het is de VIERDE keer dat
     iemand die drie regels moet onthouden, en de derde keer dat er één
     vergeten wordt. Ze staan daarom nu hier, waar ze maar één keer goed
     hoeven te zijn:

     1. DE BEGINSTAND OPENT ECHT. detailOpen:true zette alleen de vlag; alle
        focuswerk zat in open(). Nu loopt de beginstand dóór open(), zodat de
        focus op een smal scherm meeverhuist naar het paneel dat over de lijst
        ligt. Op een BREED scherm gebeurt dat bewust niet: daar staan lijst en
        detail naast elkaar en zou het de pijltjesnavigatie door de lijst
        stukmaken.
        Bij de eerste tekening hangt het paneel nog niet in het document en
        kan de focus er dus niet heen. Daarom staat er één uitgestelde poging
        klaar (setTimeout 0) die alleen doorgaat als het paneel er dan wél in
        hangt, het scherm nog steeds smal is, én de focus nergens staat. Die
        laatste voorwaarde is de belangrijkste: heeft de shell de focus
        intussen op de h1 gezet, dan blijft hij daar. Dit component pakt nooit
        focus af van iets dat er al staat.

     2. DE LAAG MELDT ZICHZELF AAN BIJ DE SHELL. Zonder registreerLaag geeft
        laagOpen('detail') in admin-shell.js altijd false en gaat Escape nooit
        naar dit paneel — het is dus geen extraatje maar de helft van het
        gedrag. De aanroeper mag zijn eigen functie meegeven
        (opts.registreerLaag / opts.verwijderLaag); staat die er niet, dan
        wordt CP_SHELL gebruikt als die er is. Dat is de enige globale die dit
        component aanraakt, hij wordt nooit gelezen voor state (afspraak 1
        blijft staan: dit component weet nog altijd niet wélk item open staat)
        en met registreerLaag:false gaat hij helemaal uit.
        EIGENAARSCHAP wordt bijgehouden, want de shell heeft maar één sleuf
        'detail'. Meldt een nieuwe lijst-met-detail zich aan, dan is die de
        eigenaar; een oudere die daarna stopt, mag de sleuf dus NIET leegmaken.

     3. EEN VERGETEN stop() RUIMT ZICHZELF OP. Elke hertekening van de Inbox
        maakte een nieuw component met een nieuwe luisteraar op de
        mediaquery, en liet de oude staan — inclusief de hele DOM-boom die
        eraan hing. Bij het maken van een nieuwe lijst-met-detail wordt daarom
        eerst de lijst met levende exemplaren nagelopen: alles waarvan het
        wortelelement niet meer in het document hangt, wordt gestopt. Dat is
        deterministisch (elke hertekening ruimt de vorige op) en het maakt
        stop() niet overbodig — het maakt hem alleen niet meer fataal om te
        vergeten. Daarnaast staat stop() óók op het wortelelement, zodat de
        gastheerconventie node.stop() werkt als een scherm md.el rechtstreeks
        teruggeeft. */

  /* de over-de-lijst-grens staat op ÉÉN plek, want hij moet in de CSS en in
     de JS exact gelijk zijn. Hoofdstuk 6 van de spec zet hem op 900px: tussen
     900 en 1100 staan lijst en detail naast elkaar en heeft "Terug naar de
     lijst" geen betekenis. admin-ui.css hoofdstuk 9c houdt dezelfde waarde
     aan; verschuift er ooit één, dan hangt er tussen de twee maten een waas
     zonder paneel of een terugknop die nergens heen gaat. */
  var MD_SMAL = '(max-width:899.98px)';

  /* de levende exemplaren, voor de opruiming hierboven onder punt 3 */
  var mdLevend = [];
  /* wie op dit moment de sleuf 'detail' van de shell in handen heeft */
  var mdLaagEigenaar = null;

  function mdRuimOp() {
    var over = [];
    for (var i = 0; i < mdLevend.length; i++) {
      var m = mdLevend[i];
      var weg = !m.el || (document.contains ? !document.contains(m.el) : false);
      if (weg) { try { m.stop(); } catch (e) { /* opruimen mag nooit een render kosten */ } }
      else over.push(m);
    }
    mdLevend = over;
  }

  function masterDetail(opts) {
    var o = opt(opts);
    /* eerst opruimen, dan bouwen: het nieuwe exemplaar mag zichzelf niet in
       zijn eigen sweep tegenkomen (hij hangt nog nergens in het document) */
    mdRuimOp();
    var lijstVak = el('div', { class: 'u-md-list' }, isNode(o.lijst) ? o.lijst : null);
    var detailVak = el('div', {
      class: 'u-md-detail',
      /* tabindex -1 zodat de focus er naartoe kán zonder dat het paneel een
         tabstop wordt voor wie er langs wil */
      tabindex: '-1',
      role: 'region',
      'aria-label': str(o.detailLabel) || 'Detail'
    });
    var terug = el('button', {
      type: 'button',
      class: 'u-md-back ' + knopKlasse('ghost klein'),
      onclick: function () { sluit(); }
    }, [icon('terug', 14), el('span', { text: 'Terug naar de lijst' })]);
    var detailInhoud = el('div', null, isNode(o.detail) ? o.detail : null);
    detailVak.appendChild(terug);
    detailVak.appendChild(detailInhoud);

    var scrim = el('div', { class: 'u-md-scrim', onclick: function () { sluit(); } });
    var wrap = el('div', { class: 'u-md' }, [lijstVak, scrim, detailVak]);
    var vorigeFocus = null;
    /* de LOGISCHE stand: is er een item gekozen. Zie het kopblok voor het
       verschil met de klasse .detail-open. */
    var geopend = false;

    /* de over-de-lijst-stand. Daar verhuist de focus altijd mee; op
       bureaublad staan lijst en detail naast elkaar en zou de focus bij elke
       selectie weghalen pijltjesnavigatie door de lijst onmogelijk maken —
       zie open() voor het ene geval waarin het daar tóch moet.

       Dezelfde grens (MD_SMAL, 899.98px) als in admin-ui.css hoofdstuk 9c, en
       dat is geen toeval maar de afspraak die daar met zoveel woorden staat:
       zou de een op 899.98 omklappen en de ander op 1099.98, dan hangt er
       tussen die twee maten een waas zonder paneel.

       DE VRAAG WORDT ELKE KEER OPNIEUW GESTELD, en het ABONNEMENT staat
       apart. Dat is met opzet twee dingen: smal() moet de stand van DIT
       moment geven — hij wordt een handvol keer per scherm aangeroepen, dus
       dat kost niets — en de bewaarde MediaQueryList is er alleen om de
       luisteraar op te kunnen zeggen in stop(). Zou smal() uit dat ene
       bewaarde object lezen, dan hangt het antwoord aan een object dat
       misschien al is opgezegd. */
    var mqSmal = null;
    var g0 = G();
    if (g0 && g0.matchMedia) mqSmal = g0.matchMedia(MD_SMAL);
    function smal() {
      var g = G();
      if (!g || !g.matchMedia) return false;
      return g.matchMedia(MD_SMAL).matches;
    }

    /* de enige plek waar .detail-open aan of uit gaat. Geen focuswerk hier:
       deze functie draait óók bij het slepen van een vensterrand, en focus
       verplaatsen op een resize is iets wat niemand heeft gevraagd. */
    function pasLaagAan() {
      if (geopend && smal()) wrap.classList.add('detail-open');
      else wrap.classList.remove('detail-open');
    }

    /* staat de focus nog ergens waar hij iets waard is? <body> en <html> zijn
       de plek waar hij belandt als er niets meer is — dat is geen plek, dat
       is de afwezigheid van een plek. */
    function focusIsWeg() {
      var a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return true;
      return !!(document.contains && !document.contains(a));
    }

    /* open(bron)
       BRON is de knop waarop geklikt is, en die mag de aanroeper meegeven.
       Dat moet ook: wie een item kiest, tekent doorgaans eerst de lijst
       opnieuw en dan pas het detail — de aangeklikte rijknop is op dit
       moment dus al vervangen en document.activeElement is <body>. Zonder
       bron bewaren we die <body>, en dan denkt sluit() straks dat het
       focusherstel geslaagd is (body.focus() zet activeElement wél op body)
       en slaat hij de terugval naar de eerste rij over.

       Daarom twee dingen: een bron die nog leeft wint, en <body>/<html>
       worden nooit bewaard. */
    function open(bron) {
      var kandidaat = (isNode(bron) && bron.focus) ? bron : document.activeElement;
      if (kandidaat && (kandidaat === document.body || kandidaat === document.documentElement || !kandidaat.focus)) kandidaat = null;
      if (kandidaat && document.contains && !document.contains(kandidaat)) kandidaat = null;
      vorigeFocus = kandidaat || null;

      geopend = true;
      pasLaagAan();

      /* Op smal scherm schuift het detail óver de lijst: daar MOET de focus
         mee, anders bedient de gebruiker een lijst die hij niet meer ziet.
         Op breed scherm blijft de focus staan waar hij staat — pijltjes door
         de lijst moeten blijven werken — behalve als hij nergens meer staat.
         Dat is na een hertekende lijst de regel en niet de uitzondering, en
         dan is het detailvak het enige bruikbare vertrekpunt dat er nog is:
         het draagt al tabindex=-1 en role=region.

         Hangt het detailvak nog niet in het document (de allereerste
         tekening, vóór de shell het scherm inhangt), dan meldt herstelFocus
         eerlijk false en zet de shell de focus zelf op de h1. */
      if (smal() || focusIsWeg()) herstelFocus(detailVak);
    }

    function sluit() {
      if (!geopend) return;
      geopend = false;
      pasLaagAan();
      if (fn(o.onSluitDetail)) o.onSluitDetail();
      /* herstelFocus meet of de focus echt geland is, dus deze terugval
         draait ook echt wanneer het element weg is of niet focusbaar bleek */
      if (!herstelFocus(vorigeFocus)) herstelFocus(lijstVak.querySelector('button, a, [tabindex]'));
      vorigeFocus = null;
    }

    /* ESCAPE HOORT HIER ALLEEN BIJ EEN PANEEL DAT ER ECHT LIGT.
       Op een breed scherm staan lijst en detail naast elkaar: er is niets
       dicht te doen, en de selectie loslaten is niet wat iemand met Escape
       bedoelt. Dan gaat de toets ongemoeid door naar de shell, die er zijn
       eigen laag mee kan bedienen. */
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!geopend || !smal()) return;
      e.preventDefault();
      sluit();
    });

    var opBreedte = function () { pasLaagAan(); };
    if (mqSmal) {
      if (mqSmal.addEventListener) mqSmal.addEventListener('change', opBreedte);
      else if (mqSmal.addListener) mqSmal.addListener(opBreedte);
    }

    function isOpen() { return geopend && smal(); }

    /* ---- aanmelden bij de shell (zie punt 2 in het kopblok) ---------- */
    var meldAan = null;
    var meldAf = null;
    if (o.registreerLaag !== false) {
      var g1 = G();
      var shell = (g1 && g1.CP_SHELL) ? g1.CP_SHELL : null;
      meldAan = fn(o.registreerLaag) || (shell && fn(shell.registreerLaag)) || null;
      meldAf = fn(o.verwijderLaag) || (shell && fn(shell.verwijderLaag)) || null;
    }
    var zelf = {};
    if (meldAan) {
      try {
        meldAan('detail', sluit, isOpen);
        mdLaagEigenaar = zelf;
      } catch (e) { /* een shell die dit niet kent, mag geen render kosten */ }
    }

    function stop() {
      if (mqSmal && opBreedte) {
        if (mqSmal.removeEventListener) mqSmal.removeEventListener('change', opBreedte);
        else if (mqSmal.removeListener) mqSmal.removeListener(opBreedte);
      }
      mqSmal = null; opBreedte = null;
      /* alleen afmelden als deze lijst-met-detail de sleuf ook echt nog in
         handen heeft; anders haalt een oude de aanmelding van een nieuwe weg */
      if (meldAf && mdLaagEigenaar === zelf) {
        mdLaagEigenaar = null;
        try { meldAf('detail'); } catch (e2) { /* zie hierboven */ }
      }
      meldAan = null; meldAf = null;
    }

    /* ---- de beginstand (zie punt 1 in het kopblok) ------------------- */
    if (o.detailOpen) {
      open(isNode(o.focusBron) ? o.focusBron : null);
      /* het paneel hangt bij de eerste tekening nog nergens in, dus de
         focusverhuizing van open() kon niet landen. Eén uitgestelde poging,
         met drie voorwaarden die alle drie moeten kloppen. */
      if (smal()) {
        var g2 = G();
        if (g2 && fn(g2.setTimeout)) {
          g2.setTimeout(function () {
            if (!geopend || !smal()) return;
            if (!document.contains || !document.contains(detailVak)) return;
            if (!focusIsWeg()) return;   /* iemand anders heeft de focus al gezet */
            herstelFocus(detailVak);
          }, 0);
        }
      }
    }
    pasLaagAan();

    var api = {
      el: wrap,
      zetLijst: function (node) { clear(lijstVak); if (isNode(node)) lijstVak.appendChild(node); },
      zetDetail: function (node) { clear(detailInhoud); if (isNode(node)) detailInhoud.appendChild(node); },
      open: open,
      sluit: sluit,
      /* de VISUELE stand, want dat is de vraag die admin-shell.js stelt met
         registreerLaag('detail', ...): mag Escape naar deze laag? Alleen als
         er ook echt iets over de pagina ligt. */
      isOpen: isOpen,
      stop: stop
    };
    /* óók op het wortelelement, zodat de gastheerconventie node.stop() werkt
       voor een scherm dat md.el rechtstreeks als wortel teruggeeft */
    wrap.stop = stop;
    mdLevend.push(api);
    return api;
  }

  /* stickyPanel({kinderen, primair, secundair, dirty, dirtyTekst, mobieleBalk})
     Twee dingen in één component, want ze delen één handler:
       .u-sticky      de plakkende rechterkolom op ruimte
       .u-sticky-bar  dezelfde primaire actie, vastgezet onderaan op mobiel

     De balk staat BINNEN .u-sticky. Dat lijkt vreemd maar is precies goed:
     position:fixed hangt aan het venster en niet aan de plakkende kolom, dus
     hij komt onderaan het scherm terecht, en er is maar één wortelelement
     nodig. Een wikkel eromheen zou position:sticky juist kapotmaken — een
     plakkend element plakt binnen zijn ouder, en een wikkel die precies zo
     hoog is als zijn kind laat niets meer plakken.

     Op mobiel wordt het knoppenblok in het paneel verborgen, anders staat
     dezelfde knop twee keer op het scherm. Dat kan alleen in JS: het is
     admin-ui.css niet aan te zien welke van de twee de kopie is.

     Zolang er een balk is, zet dit component .u-has-bar op .u-main en haalt
     hem in stop() weer weg — zie het blok bij nlAantal(). Roep stop() dus aan
     zodra het scherm verdwijnt; dat was toch al nodig voor de luisteraar op
     de mediaquery. */
  function stickyPanel(opts) {
    var o = opt(opts);
    var p = opt(o.primair);
    var s = opt(o.secundair);

    var merk = el('span', {
      class: 'u-dirty' + (o.dirty ? ' on' : ''),
      /* polite: "Niet opgeslagen" mag melden, maar mag nooit een gebruiker
         onderbreken die midden in een veld zit te typen */
      'aria-live': 'polite',
      text: str(o.dirtyTekst) || 'Niet opgeslagen'
    });

    function maakPrimair(klein) {
      if (!str(p.label)) return null;
      return el('button', {
        type: 'button',
        class: knopKlasse(klein ? 'klein' : 'breed'),
        text: str(p.label),
        disabled: !!p.disabled,
        onclick: fn(p.onClick) || null
      });
    }
    function maakSecundair(klein) {
      if (!str(s.label)) return null;
      return el('button', {
        type: 'button',
        class: knopKlasse('ghost ' + (klein ? 'klein' : 'breed')),
        text: str(s.label),
        disabled: !!s.disabled,
        onclick: fn(s.onClick) || null
      });
    }

    var paneelPrimair = maakPrimair(false);
    var voet = (paneelPrimair || str(s.label))
      ? el('div', { class: 'u-card', style: 'padding:14px 16px;display:flex;flex-direction:column;gap:10px;' },
        [merk, paneelPrimair, maakSecundair(false)])
      : null;

    var kinderen = [];
    arr(isNode(o.kinderen) ? [o.kinderen] : o.kinderen).forEach(function (k) { if (isNode(k)) kinderen.push(k); });

    var balk = null;
    if (paneelPrimair && o.mobieleBalk !== false) {
      balk = el('div', { class: 'u-sticky-bar' }, [maakSecundair(true), maakPrimair(true)]);
    }

    var wrap = el('div', { class: 'u-sticky' }, kinderen.concat([voet, balk]));

    /* zodra er een vaste balk is, houdt de werkkolom er ruimte voor vrij.
       meldBalk() doet dat via de gedeelde teller bovenin dit bestand, zodat
       een saveBar en dit paneel elkaar niet de klasse onder de voeten
       weghalen. Defensief: staat er geen .u-main (een ontwikkelpagina, een
       test, een scherm buiten de shell), dan geeft meldBalk() null terug en
       gebeurt er gewoon niets. */
    var kolom = balk ? meldBalk() : null;

    /* de mediaquery één keer opvragen en volgen. addEventListener op een
       MediaQueryList bestaat pas sinds Safari 14; addListener is de oude weg
       en is nog altijd de enige die overal werkt. */
    var mq = null, opWissel = null;
    if (balk && voet) {
      var g = G();
      if (g && g.matchMedia) {
        mq = g.matchMedia('(max-width:699.98px)');
        opWissel = function () { verberg(voet, mq.matches); };
        opWissel();
        if (mq.addEventListener) mq.addEventListener('change', opWissel);
        else if (mq.addListener) mq.addListener(opWissel);
      }
    }

    return {
      el: wrap,
      balk: balk,
      zetDirty: function (aan) {
        if (aan) merk.classList.add('on'); else merk.classList.remove('on');
      },
      /* stop() ruimt allebei de sporen op die dit paneel buiten zijn eigen
         boom achterlaat: de luisteraar op de mediaquery en .u-has-bar op de
         werkkolom. Twee keer aanroepen mag — kolom en mq worden leeggezet. */
      stop: function () {
        kolom = vergeetBalk(kolom);
        if (!mq || !opWissel) return;
        if (mq.removeEventListener) mq.removeEventListener('change', opWissel);
        else if (mq.removeListener) mq.removeListener(opWissel);
        mq = null; opWissel = null;
      }
    };
  }

  /* settingsCategoryCard({titel, uitleg, route, onGa, onKies, aantal, meta})
     De kaart is triviaal; het echte werk zit in het omgekeerde opslagmodel
     van Instellingen (elf losse "Opgeslagen"-flitsen worden één bevestiging
     per route) en dat hoort niet hier maar in de instellingenroutes zelf.

     MET EEN ROUTE BLIJFT HET EEN ECHTE <a href="#/...">, want middelklik en
     "open in een nieuw tabblad" horen bij iets met een eigen route. Alleen
     de gewone linkerklik loopt niet langs de adresbalk maar langs de
     navigatiefunctie die de aanroeper meegeeft. Reden: langs die functie
     komt de navigatiewaarschuwing vóórdat de hash verandert. Een kale <a>
     zou de hash eerst wijzigen en pas daarna vragen of het mag, en annuleren
     laat dan een geschiedenisregel achter die naar een pagina wijst waar je
     nooit bent geweest.

     Die functie komt uit opts (onGa, anders onKies) en NIET uit CP_SHELL:
     geen enkele component in dit bestand leest een globale. Ontbreekt hij,
     dan doet de href gewoon zijn eigen werk — dat is slechter dan de guard,
     maar beter dan een kaart die niets doet.

     Beide krijgen (route, opts) mee; zonder route is dat null.

     DE VORM UIT DE MOCKUP (5.9): icoontegel 48px links, dan titel, uitleg en
     onderaan "n instellingen →". admin-ui.css maakt van .u-setcard daarvoor
     een flexrij met .u-setcard-body ernaast; de teksten zitten daarom sinds
     de mockupronde in dat lijf en niet meer los in de kaart. De tegel is
     optioneel — zonder icoon staat de tekst gewoon vooraan. */
  function settingsCategoryCard(opts) {
    var o = opt(opts);
    var meta = str(o.meta) || (typeof o.aantal === 'number' ? nlAantal(o.aantal, 'instelling', 'instellingen') : '');
    var lijf = el('span', { class: 'u-setcard-body' }, [
      el('span', { class: 'u-setcard-title', text: str(o.titel) }),
      str(o.uitleg) ? el('span', { class: 'u-setcard-text', text: str(o.uitleg) }) : null,
      meta ? el('span', { class: 'u-setcard-meta', text: meta }) : null
    ]);
    var tegel = null;
    if (isNode(o.icoon)) tegel = o.icoon;
    else if (str(o.icoon)) tegel = iconTile({ icoon: str(o.icoon), toon: o.toon, maat: 48 });
    var kinderen = [tegel, lijf];
    var route = str(o.route);
    var ga = fn(o.onGa) || fn(o.onKies);

    if (route) {
      var a = el('a', { class: 'u-setcard', href: route }, kinderen);
      if (ga) {
        a.addEventListener('click', function (e) {
          /* alles wat de gebruiker bewust anders doet, blijft van de browser:
             middelklik, en klikken met cmd/ctrl/shift/alt openen een nieuw
             tabblad of venster en horen dus NIET langs de guard te lopen —
             daar verandert de huidige pagina immers niet van route */
          if (e.defaultPrevented) return;
          if (typeof e.button === 'number' && e.button !== 0) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          ga(route, o);
        });
      }
      return a;
    }
    if (ga) {
      return el('button', { type: 'button', class: 'u-setcard', onclick: function () { ga(null, o); } }, kinderen);
    }
    return el('div', { class: 'u-setcard' }, kinderen);
  }

  /* ============================================================
     9. PROJECTVOORTGANG

     .stagegrid in beheer.html is al sterk: volgnummer, betaalpercentage,
     bedrag, goedkeuringsdatum, statuschip, Factureer-knop en de
     statuswissel-selector. Die opbouw is hier overgenomen. Nieuw zijn
     verantwoordelijke en openstaande actie per fase, en het uitklappen
     daarvan.

     WAT HIER NIET GEBEURT: de statuswissel-motor. Die zit in beheer.html en
     doet bij één wissel vier dingen (status opslaan, automatisch een
     conceptfactuur maken, de mailkeuze tonen, verversen). Dit component
     roept alleen onWissel/onBewerk/onFactureer aan. Ook de vraag ÓF een fase
     factureerbaar is (betaalfase, nog geen factuur, projectwaarde ingevuld)
     blijft daar: hier telt alleen fase.kanFactureren.

     Bedragen en datums komen als kant-en-klare tekst binnen. Er is in dit
     bestand geen geldopmaak en die hoort er ook niet te komen — fmtMoneyCur
     kent de valuta van het project en dit component niet.
     ============================================================ */
  function projectProgress(opts) {
    var o = opt(opts);
    var fases = arr(o.fases).filter(isObj);
    var statussen = arr(o.statussen).filter(function (s) { return isObj(s) && str(s.key); });
    /* .stagegrid en .stagerow wonen in de <style> van beheer.html en zijn
       niet naar admin-ui.css verhuisd — daar loopt de factuurmodulebouw in.
       De KAART eromheen wordt wel de nieuwe: .u-card geeft de radius van
       20px en de nieuwe schaduw, .u-rows de binnenlijn in --line-2. De
       fasebalk zelf houdt zijn oude opbouw tot de mockup hem vervangt door
       CP_CHART.stagePath (spec 4.11). */
    var kaart = el('div', { class: 'u-card u-rows stagegrid' });

    if (!fases.length) {
      kaart.appendChild(emptyState({
        titel: 'Nog geen fases',
        uitleg: 'Dit project heeft nog geen fasestructuur. Voeg er een toe of kies een sjabloon.',
        actie: o.leegActie,
        kaal: true
      }));
      return kaart;
    }

    fases.forEach(function (f) {
      var nr = (typeof f.nr === 'number') ? ('0' + f.nr).slice(-2) : str(f.nr);

      /* de mono-onderregel houdt zich aan de huisregel: alleen codes,
         bedragen, datums en microlabels. Een percentage, een bedrag en een
         datum horen daar alle drie. */
      var micro = [];
      if (f.pct) micro.push(f.pct + '% betaalmoment');
      if (str(f.bedrag)) micro.push(str(f.bedrag));
      if (str(f.datum)) micro.push('afgerond ' + str(f.datum));

      var extras = [];
      /* verantwoordelijke NIET in mono: een naam is geen code. Hij krijgt de
         gewone subregel-stijl, zodat hij als tekst leest en niet als label. */
      if (str(f.verantwoordelijke)) {
        extras.push(el('span', { class: 'u-row-sub', text: 'Verantwoordelijk: ' + str(f.verantwoordelijke) }));
      }
      if (str(f.openstaandeActie)) {
        extras.push(el('span', { class: 'u-row-next', text: str(f.openstaandeActie) }));
      }

      var naamVak = el('div', { class: 'stagename' }, [
        document.createTextNode(str(f.naam)),
        el('small', { text: micro.join(' · ') || ' ' })
      ]);

      /* UITKLAPBAAR, en bewust niet met <details>/<summary>: de rij bevat
         een <select> en twee knoppen, en een klik op een select binnen een
         <summary> klapt het blok open in plaats van de lijst. Een aparte
         schakelknop met aria-expanded houdt die twee dingen uit elkaar.
         Zonder uitklapbaar staan de extra's er gewoon altijd. */
      var schakel = null;
      if (extras.length) {
        if (o.uitklapbaar) {
          var vak = el('div', { id: uid('fase') }, extras);
          /* dicht beginnen: een uitklapper die open start is geen uitklapper,
             en de fasebalk moet in een oogopslag te scannen blijven */
          vak.hidden = true;
          schakel = el('button', {
            type: 'button',
            class: 'u-iconbtn',
            'aria-expanded': 'false',
            'aria-controls': vak.id,
            'aria-label': 'Meer over fase ' + str(f.naam),
            onclick: function () {
              var open = vak.hidden;
              vak.hidden = !open;
              schakel.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
          }, icon('chevronOmlaag', 16));
          naamVak.appendChild(vak);
        } else {
          extras.forEach(function (e2) { naamVak.appendChild(e2); });
        }
      }

      var kinderen = [
        el('span', { class: 'stagenum', text: nr }),
        naamVak,
        statusChip({ label: str(f.statusLabel) || str(f.status), toon: str(f.statusToon) || 'neutraal' })
      ];
      if (schakel) kinderen.push(schakel);

      if (f.kanFactureren && fn(o.onFactureer)) {
        kinderen.push(el('button', {
          type: 'button', class: knopKlasse('ghost klein'), text: 'Factureer',
          'aria-label': 'Fase ' + str(f.naam) + ' factureren',
          onclick: function () { o.onFactureer(f); }
        }));
      }
      if (f.kanDatumBewerken && fn(o.onBewerk)) {
        kinderen.push(iconKnop('instellingen', 'Goedkeuringsdatum van ' + str(f.naam) + ' aanpassen',
          function () { o.onBewerk(f); }));
      }
      if (statussen.length && fn(o.onWissel)) {
        var sel = el('select', { class: 'input stagesel', 'aria-label': 'Status van fase ' + str(f.naam) });
        statussen.forEach(function (st) {
          var op = el('option', { value: str(st.key), text: str(st.label) });
          if (str(st.key) === str(f.status)) op.selected = true;
          sel.appendChild(op);
        });
        sel.addEventListener('change', function () { o.onWissel(f, sel.value, sel); });
        kinderen.push(sel);
      }

      kaart.appendChild(el('div', { class: 'stagerow' }, kinderen));
    });

    return kaart;
  }

  /* ============================================================
     10. ZOEKVELD (combobox)

     openJumpBar() bestaat compleet in beheer.html: cmd+K, substringfilter,
     pijltjes, Enter. Wat er niet is, is de aria: het is een modal met een
     inputveld en een rij knoppen, en een schermlezer hoort dus niet dat er
     resultaten verschijnen of welk resultaat "geselecteerd" is.

     Hier wordt het een echte combobox in de topbalk. De resultaatrij houdt de
     bestaande .jumprow-vorm — die is goed en herkenbaar — maar wordt een
     role=option in plaats van een button: opties in een listbox horen géén
     eigen tabstop te zijn, de focus blijft in het invoerveld en
     aria-activedescendant wijst aan wat "actief" is.
     ============================================================ */
  function searchField(opts) {
    var o = opt(opts);
    var lijstId = uid('zoek');
    var resultaten = arr(o.resultaten);
    var actiefIdx = -1;
    var open = false;

    var input = el('input', {
      class: 'input',
      type: 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      role: 'combobox',
      'aria-expanded': 'false',
      'aria-controls': lijstId,
      'aria-autocomplete': 'list',
      'aria-label': str(o.label) || 'Zoek een klant, project of factuur',
      placeholder: str(o.placeholder) || 'Zoeken',
      value: str(o.waarde)
    });

    var paneel = el('div', {
      class: 'u-menu',
      id: lijstId,
      role: 'listbox',
      'aria-label': 'Zoekresultaten',
      /* .u-menu is op een actiemenu gemaakt (216-300px). Een zoekpaneel moet
         net zo breed zijn als het veld erboven, anders lezen lange klant- en
         projectnamen niet. Alleen de breedtegrenzen gaan eraf. */
      style: 'width:100%;max-width:none;padding:6px;'
    });
    paneel.hidden = true;

    function zetActief(i) {
      var rijen = paneel.childNodes;
      actiefIdx = i;
      for (var j = 0; j < rijen.length; j++) {
        var aan = (j === i);
        if (rijen[j].classList) {
          if (aan) rijen[j].classList.add('sel'); else rijen[j].classList.remove('sel');
          rijen[j].setAttribute('aria-selected', aan ? 'true' : 'false');
        }
      }
      if (i > -1 && rijen[i]) {
        input.setAttribute('aria-activedescendant', rijen[i].id);
        if (rijen[i].scrollIntoView) rijen[i].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    function zetOpen(aan) {
      open = !!aan;
      paneel.hidden = !open;
      input.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) zetActief(-1);
    }

    function kies(i) {
      var r = resultaten[i];
      if (!r) return;
      zetOpen(false);
      if (fn(r.onKies)) r.onKies(r);
      else if (fn(o.onKies)) o.onKies(r, i);
    }

    function teken() {
      clear(paneel);
      if (!resultaten.length) {
        /* geen lege listbox achterlaten: een open paneel zonder opties meldt
           "0 resultaten" aan een schermlezer maar toont een gebruiker niets */
        paneel.appendChild(el('span', { class: 'u-menu-label', text: 'Niets gevonden' }));
        zetOpen(str(input.value).length > 0);
        zetActief(-1);
        return;
      }
      resultaten.forEach(function (r, i) {
        paneel.appendChild(el('div', {
          class: 'jumprow',
          id: lijstId + '-o' + i,
          role: 'option',
          'aria-selected': 'false',
          /* mousedown en niet click: bij click is het veld al geblurd en is
             het paneel al dicht, en dan is er niets meer om op te klikken */
          onmousedown: function (e) { e.preventDefault(); kies(i); }
        }, [
          el('span', { class: 'jr-main', text: str(r.label) }),
          str(r.sub) ? el('span', { class: 'jr-sub', text: str(r.sub) }) : null
        ]));
      });
      zetOpen(true);
      zetActief(-1);
    }

    input.addEventListener('input', function () {
      if (fn(o.onZoek)) o.onZoek(str(input.value));
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!open && resultaten.length) { zetOpen(true); zetActief(0); return; }
        zetActief(Math.min(actiefIdx + 1, resultaten.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        zetActief(Math.max(actiefIdx - 1, 0));
      } else if (e.key === 'Home' && open) {
        e.preventDefault(); zetActief(0);
      } else if (e.key === 'End' && open) {
        e.preventDefault(); zetActief(resultaten.length - 1);
      } else if (e.key === 'Enter') {
        if (!open || actiefIdx < 0) return;
        e.preventDefault();
        kies(actiefIdx);
      } else if (e.key === 'Escape') {
        /* eerste Escape sluit de lijst, tweede leegt het veld. Meteen legen
           zou een zoekterm wissen die iemand alleen even uit beeld wilde. */
        if (open) { e.preventDefault(); zetOpen(false); return; }
        if (str(input.value)) { e.preventDefault(); input.value = ''; if (fn(o.onZoek)) o.onZoek(''); }
      }
    });
    input.addEventListener('blur', function () { zetOpen(false); });

    var wrap = el('div', { class: 'u-search', role: 'search' }, [
      el('span', { class: 'u-search-ico' }, icon('zoek', 16)),
      input,
      paneel
    ]);

    wrap.input = input;
    wrap.zetResultaten = function (lijst) {
      resultaten = arr(lijst);
      teken();
    };
    wrap.focus = function () { herstelFocus(input); };
    if (resultaten.length) teken();
    return wrap;
  }

  /* ============================================================
     11. MELDING

     Hergebruikt de .undotoast-vorm (zwarte pil onderaan het scherm) die
     showUndoToast() al gebruikt, maar is er niet dezelfde als: deze heeft
     geen teller en geen ongedaan-knop.

     BOTST NIET met de bestaande undo-toast: hij stapelt niet maar vervangt.
     Twee pillen op dezelfde coördinaten leveren één onleesbare stapel op, en
     de nieuwste melding is per definitie de relevante. Daarom haalt hij ook
     een undo-toast van beheer.html weg — die is dan al minstens één actie
     oud.

     DAT MOET WEL TWEE KANTEN OP. Alleen de DOM-knoop weghalen laat de
     aanroeper met een pil zitten die hij nog denkt te hebben, inclusief een
     lopende teller die tot het einde doortikt op een losgekoppeld element.
     Vandaar de haak toast.opRuimBestaande: die mag de aanroeper zetten
     (beheer.html hangt er straks zijn dismissUndoToast in, en dan stopt de
     timer ook echt). Hij draait vóór het opruimen hieronder; wat hij laat
     staan, ruimt dit component alsnog op.
     ============================================================ */
  function toast(tekst, opts) {
    var o = opt(opts);
    var doel = isNode(o.doel) ? o.doel : document.body;

    if (fn(toast.opRuimBestaande)) {
      /* een kapotte haak mag nooit de melding tegenhouden: de melding is het
         antwoord op iets wat de gebruiker net gedaan heeft */
      try { toast.opRuimBestaande(doel); } catch (e) { /* bewust genegeerd */ }
    }

    var bestaand = doel.querySelectorAll ? doel.querySelectorAll('.undotoast') : [];
    for (var i = 0; i < bestaand.length; i++) {
      if (bestaand[i].parentNode) bestaand[i].parentNode.removeChild(bestaand[i]);
    }

    var a = opt(o.actie);
    var node = el('div', {
      class: 'undotoast',
      /* status en niet alert: een bevestiging mag wachten tot de gebruiker
         uitgesproken is. alert zou elke opgeslagen wijziging door een
         lopende voorleesbeurt heen knallen. */
      role: 'status',
      'aria-live': 'polite'
    }, [
      el('span', { text: str(tekst) }),
      str(a.label) ? el('button', {
        type: 'button', class: 'undobtn', text: str(a.label),
        onclick: function () { sluit(); if (fn(a.onKies)) a.onKies(); }
      }) : null
    ]);
    doel.appendChild(node);

    var timer = null;
    function sluit() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    var duur = (typeof o.duur === 'number') ? o.duur : 4000;
    if (duur > 0) timer = setTimeout(sluit, duur);

    node.sluit = sluit;
    return node;
  }

  /* de haak uit het kopblok hierboven: CP_UI.toast.opRuimBestaande = fn.
     Hij staat hier expliciet op null zodat hij in de code te vinden is en
     niet alleen in een commentaarregel. De aanroeper krijgt het doelelement
     mee en ruimt zijn eigen melding op — inclusief zijn timer. */
  toast.opRuimBestaande = null;

  /* ============================================================
     12. LIJSTSNELTOETSEN

     kbRegister() in beheer.html duwt rijen in één globale kbRows-array die
     alleen bij een volledige render wordt geleegd. Dat gaat precies mis waar
     de nieuwe indeling het vaakst komt: als een LIJST deels hertekent (een
     beantwoorde vraag verdwijnt, een filter verandert) blijven de oude rijen
     in de array staan, en dan selecteert j/k elementen die niet meer in de
     DOM zitten.

     kb() geeft daarom een eigen registratie terug die de shell na elke
     deelherbouw kan legen. De sneltoetsen zelf zijn ongewijzigd: j omlaag,
     k omhoog, Enter opent, plus de losse letters die een rij zelf meebrengt
     (a antwoorden, s snoozen, m mijlpaal) — dezelfde als in het
     sneltoetsvenster staan.
     ============================================================ */
  function kb(opts) {
    var o = opt(opts);
    var rijen = [];
    var idx = -1;
    var doc = isNode(o.doc) ? o.doc : (typeof document !== 'undefined' ? document : null);

    function inVeld() {
      if (!doc) return true;
      var t = doc.activeElement;
      if (!t) return false;
      var tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    }

    function selecteer(i) {
      if (!rijen.length) return;
      if (idx > -1 && rijen[idx]) rijen[idx].el.classList.remove('kbsel');
      idx = Math.max(0, Math.min(i, rijen.length - 1));
      var r = rijen[idx];
      r.el.classList.add('kbsel');
      if (r.el.scrollIntoView) r.el.scrollIntoView({ block: 'nearest' });
    }

    function opToets(e) {
      /* de shell beslist of deze registratie nu mag: er kan een venster open
         staan, of een andere lijst kan aan de beurt zijn. Zonder die veto
         zouden twee registraties tegelijk op dezelfde j reageren. */
      if (fn(o.actief) && !o.actief()) return;
      if (inVeld()) return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (!rijen.length) return;
      if (e.key === 'j') { e.preventDefault(); selecteer(idx + 1); return; }
      if (e.key === 'k') { e.preventDefault(); selecteer(idx <= 0 ? 0 : idx - 1); return; }
      if (idx < 0 || !rijen[idx]) return;
      var h = rijen[idx].h;
      if (e.key === 'Enter' && fn(h.open)) { e.preventDefault(); h.open(); return; }
      /* elke andere handler op een enkele letter: 'answer' luistert niet naar
         a maar naar wat de aanroeper als sleutel meegeeft, zodat een nieuwe
         rijsoort geen wijziging in dit bestand nodig heeft */
      Object.keys(h).forEach(function (sleutel) {
        if (sleutel.length !== 1 || !fn(h[sleutel])) return;
        if (e.key.toLowerCase() !== sleutel.toLowerCase()) return;
        e.preventDefault();
        h[sleutel]();
      });
    }

    if (doc) doc.addEventListener('keydown', opToets);

    return {
      registreer: function (node, handlers) {
        if (!isNode(node)) return;
        rijen.push({ el: node, h: opt(handlers) });
      },
      leeg: function () {
        rijen.forEach(function (r) { r.el.classList.remove('kbsel'); });
        rijen = [];
        idx = -1;
      },
      /* de huidige selectie, zodat de shell hem over een deelherbouw heen
         kan terugzetten in plaats van de gebruiker naar rij 1 te sturen */
      index: function () { return idx; },
      selecteer: selecteer,
      stop: function () { if (doc) doc.removeEventListener('keydown', opToets); rijen = []; idx = -1; }
    };
  }

  /* ============================================================
     13. DE BOUWSTENEN VAN DE MOCKUP

     Alles hieronder komt uit hoofdstuk 4 van beheer-ui-mockup-spec.md en
     bestond in fase 0 nog niet. Drie regels gelden voor de hele afdeling:

     1. GEEN GRAFIEK WORDT HIER GETEKEND. CP_CHART heeft ring, sparkline,
        ratingDots en leafOrnament al; deze componenten roepen ze aan en
        hebben altijd een terugval als die laag ontbreekt.
     2. GEEN STIP ZONDER WOORD. Elke toon die hier binnenkomt levert een
        stip én een tekst op — kleur draagt nooit alleen (spec hoofdstuk 8).
     3. GEEN NIEUWE MAAT IN JS. De maten staan in admin-ui.css; hier staan
        alleen de klassenamen die ze aanzetten. De handvol inline stijlen die
        toch nodig is, staat met reden erbij genoteerd.
     ============================================================ */

  /* ---- 13a. avatar (spec 4.8) ----------------------------------------

     DE INITIALEN ZIJN EEN VOLWAARDIGE VARIANT EN GEEN GEBREK. Hoofdstuk 7
     van de spec bouwt avatar_url als echt veld, maar een leeg veld hoort een
     eerlijke lege stand te tonen — en twee letters op zwart zijn dat.

     TUSSENVOEGSELS WORDEN OVERGESLAGEN. "Noor van Dijk" is ND en niet NV.
     Dat is geen finesse: in het Nederlandse deel van dit bestand komt bijna
     elke tweede achternaam met een tussenvoegsel, en NV zegt over Noor van
     Dijk precies niets. De regel is bewust asymmetrisch — het EERSTE woord
     telt altijd mee, want dat is de voornaam en "De Vries" hoort DV te
     geven, niet V. Van de rest wint het eerste woord dat géén tussenvoegsel
     is; is dat er niet, dan het laatste woord dat er nog staat. */
  var TUSSENVOEGSELS = {
    van: 1, von: 1, de: 1, den: 1, der: 1, des: 1, het: 1, 't': 1,
    ten: 1, ter: 1, te: 1, tot: 1, thoe: 1, op: 1, in: 1, aan: 1, bij: 1,
    onder: 1, over: 1, uit: 1, voor: 1, vd: 1, af: 1,
    la: 1, le: 1, du: 1, di: 1, da: 1, del: 1, dos: 1, das: 1, el: 1, al: 1
  };

  function woordenUit(naam) {
    /* dezelfde opschoning als in entityRow: alles wat geen letter of cijfer
       is wordt een spatie, zodat "Fjell Outdoor B.V." niet op de punten
       struikelt. De apostrof blijft staan voor 't. */
    return str(naam).replace(/[^A-Za-z0-9À-ÿ'’ ]/g, ' ').trim().split(/\s+/)
      .filter(function (w) { return !!w; });
  }

  function initialenUit(naam) {
    var w = woordenUit(naam);
    if (!w.length) return '—';
    var uit = w[0].charAt(0).toUpperCase();
    if (w.length === 1) return uit;

    var rest = w.slice(1);
    var tweede = '';
    for (var i = 0; i < rest.length; i++) {
      var kaal = rest[i].toLowerCase().replace(/[’']/g, "'");
      if (TUSSENVOEGSELS[kaal]) continue;
      tweede = rest[i];
      break;
    }
    /* alleen tussenvoegsels achter de voornaam ("Jan van der") — dan is het
       laatste woord het meest onderscheidende dat er nog is */
    if (!tweede) tweede = rest[rest.length - 1];
    return uit + tweede.charAt(0).toUpperCase();
  }

  /* de vier maten uit de spec. Een getal dat er niet tussen staat wordt naar
     de dichtstbijzijnde gerond: een halve maat zou een eigen CSS-regel
     vragen en die is er niet. */
  var AVATAR_MATEN = [
    { px: 28, klasse: 'klein' },
    { px: 36, klasse: '' },
    { px: 48, klasse: 'groot' },
    { px: 72, klasse: 'xl' }
  ];
  function avatarMaat(maat) {
    if (typeof maat === 'string') {
      for (var j = 0; j < AVATAR_MATEN.length; j++) {
        if (AVATAR_MATEN[j].klasse === maat) return AVATAR_MATEN[j].klasse;
      }
      if (maat === 'normaal') return '';
    }
    var px = (typeof maat === 'number' && maat > 0) ? maat : 36;
    var beste = AVATAR_MATEN[1], afstand = Infinity;
    for (var i = 0; i < AVATAR_MATEN.length; i++) {
      var d = Math.abs(AVATAR_MATEN[i].px - px);
      if (d < afstand) { afstand = d; beste = AVATAR_MATEN[i]; }
    }
    return beste.klasse;
  }

  /* avatar({naam, url, maat, titel, badge})
     Met foto een <img> met de VOLLEDIGE naam als alt — niet de initialen,
     want alt beschrijft wie er staat en niet wat er staat. Zonder foto een
     <span role="img"> met datzelfde aria-label; de letters erin zijn dan
     puur beeld en zouden zonder rol als losse tekst worden voorgelezen.
     badge zet er de ronde vinkbadge rechtsonder bij (spec 5.5). Die draagt
     betekenis ("geverifieerd") en krijgt daarom een eigen naam, geen kleur
     alleen. */
  function avatar(opts) {
    var o = opt(opts);
    var naam = str(o.naam);
    var klasse = 'u-avatar' + (avatarMaat(o.maat) ? ' ' + avatarMaat(o.maat) : '');
    var titel = str(o.titel) || null;

    var node;
    if (str(o.url)) {
      node = el('img', {
        class: klasse,
        src: str(o.url),
        alt: naam,
        title: titel,
        loading: 'lazy'
      });
    } else {
      node = el('span', {
        class: klasse,
        role: 'img',
        'aria-label': naam || 'Onbekend',
        title: titel,
        text: initialenUit(naam)
      });
    }

    if (!o.badge) return node;
    var b = isObj(o.badge) ? o.badge : {};
    var vink = el('span', {
      class: 'u-avatar-badge',
      role: 'img',
      'aria-label': str(b.label) || 'Geverifieerd',
      title: str(b.label) || 'Geverifieerd'
    }, icon('vinkje', 12));
    return el('span', { class: 'u-avatar-wrap' }, [node, vink]);
  }

  /* avatarGroep(lijst, max)
     lijst: ['Noor van Dijk', ...] of [{naam, url}, ...]

     DE GROEP IS ÉÉN AFBEELDING VOOR EEN SCHERMLEZER, en dat is met opzet.
     Vier losse avatars achter elkaar leveren vier losse "afbeelding"-beurten
     op terwijl er één ding staat: wie er aan dit project werkt. Het label
     noemt daarom álle namen, óók die achter de "+n" verdwijnen — anders is
     de overloop informatie die alleen een ziende krijgt.

     DE STAPELING ZIT SINDS DEZE RONDE IN CSS. Hij stond inline met de
     opmerking "zodra daar een .u-avatargroep verschijnt" — die klasse werd
     hier wél gezet maar bestond in admin-ui.css niet, dus er stond een naam
     die niets deed en een stapeling die op drie plekken in JS werd
     uitgeschreven. Nu doet .u-avatargroep de flexrij, de overlap (-10px) en
     de witte ring om elk gezicht; de JS zet alleen nog wie er in staat. */
  function avatarGroep(lijst, max) {
    var mensen = arr(lijst).map(function (p) {
      return isObj(p) ? p : { naam: str(p) };
    }).filter(function (p) { return str(p.naam) || str(p.url); });

    /* minstens één zichtbaar gezicht: een groep die alleen uit "+5" bestaat
       is geen groep meer maar een getal, en dat is niet wat hier hoort */
    var n = (typeof max === 'number' && max > 0) ? Math.max(1, Math.round(max)) : 4;
    var zichtbaar = mensen.slice(0, n);
    var rest = mensen.slice(n);
    var maatKlasse = avatarMaat(zichtbaar.length ? zichtbaar[0].maat : null);

    var namen = mensen.map(function (p) { return str(p.naam) || 'Onbekend'; });
    var wrap = el('span', {
      class: 'u-avatargroep',
      role: 'img',
      'aria-label': namen.length ? namen.join(', ') : 'Niemand toegewezen'
    });
    if (!mensen.length) { verberg(wrap, true); return wrap; }

    zichtbaar.forEach(function (p) {
      var a = avatar({ naam: p.naam, url: p.url, maat: p.maat });
      /* de kinderen dragen geen eigen naam meer: de groep is de afbeelding */
      a.setAttribute('aria-hidden', 'true');
      a.removeAttribute('role');
      wrap.appendChild(a);
    });
    if (rest.length) {
      wrap.appendChild(el('span', {
        class: 'u-avatar u-avatargroep-meer' + (maatKlasse ? ' ' + maatKlasse : ''),
        'aria-hidden': 'true',
        text: '+' + rest.length
      }));
    }
    return wrap;
  }

  /* ---- 13b. icoontegel (spec 4.9) ------------------------------------
     "Het meest herhaalde element in de hele mockup", en daarom bewust het
     kortste component van dit bestand: één span, één tintklasse, één icoon.
     Standaard decoratie (aria-hidden), want een tegel staat in de mockup
     altijd naast een titel die hetzelfde al zegt. Alleen met een expliciete
     titel wordt hij een zelfstandige afbeelding. */
  function iconTile(opts) {
    var o = opt(opts);
    var px = (typeof o.maat === 'number' && o.maat > 0) ? o.maat : 44;
    var maatKlasse = '';
    if (px >= 56) maatKlasse = ' m56';
    else if (px >= 48) maatKlasse = ' m48';
    else if (px <= 40) maatKlasse = ' m40';

    var kind = isNode(o.icoon) ? o.icoon : icon(str(o.icoon), 20);
    var attrs = { class: 'u-tile' + maatKlasse + ' ' + tintKlasse(o.toon) };
    if (str(o.titel)) {
      attrs.role = 'img';
      attrs['aria-label'] = str(o.titel);
      attrs.title = str(o.titel);
    } else {
      attrs['aria-hidden'] = 'true';
    }
    return el('span', attrs, kind);
  }

  /* ---- 13c. stattegel (spec 4.10) ------------------------------------
     Drie varianten in één functie, want het zijn drie standen van hetzelfde
     ding: een getal met een naam eronder. Ze delen hun klasse (.u-stat),
     hun klikgedrag en hun verbergregel.

       'ring'   ring links met het getal erin, rechts icoon + label + subregel
       'groot'  gevulde kaart in een -soft tint, enorm getal, ronde pijlknop
       'trend'  label, bedrag, subregel, sparkline rechtsboven, verschilregel
       (geen)   de kale tegel — precies wat summaryCard al tekent

     DRIE DINGEN DIE JE PAS MERKT ALS ZE MISGAAN

     1. EEN KNOP IN EEN KNOP BESTAAT NIET. De variant 'groot' heeft in de
        mockup een ronde pijlknop rechtsonder én is zelf klikbaar. Dat kan
        niet allebei een <button> zijn — de binnenste wordt in de meeste
        browsers onbereikbaar en de HTML is ongeldig. Is de tegel klikbaar,
        dan is de pijl dus PUUR BEELD (aria-hidden, geen eigen tabstop) en
        opent de tegel zelf. Is de tegel dat niet, dan wordt de pijl de knop
        en draagt hij het label.
     2. DE RING DRAAGT ZIJN EIGEN GETAL. .u-stat.ring zet .u-stat-num op
        display:none, want het getal staat al middenin de ring. Zonder
        CP_CHART is er geen ring en zou het getal dus helemaal verdwijnen —
        vandaar de terugval met .u-groot in het ringslot.
     3. BINNEN EEN KNOP GEEN BLOKELEMENTEN. Dezelfde regel als hierboven, maar
        een stap dieper: een <button> mag alleen frasering-inhoud bevatten, dus
        de tussenlagen van 'ring' en 'trend' zijn <span> en niet <div>. Hun
        WEERGAVE komt uit admin-ui.css (.u-stat-body op display:block,
        .u-stat-kop en .u-stat-koptekst op flex respectievelijk blok), want een
        span is van zichzelf inline en zou label, getal en subregel anders op
        één regel aan elkaar plakken. Wie hier een laag bijbouwt: geef hem een
        klasse en zet zijn weergave in het stijlblad, nooit hier. */
  function statTile(opts) {
    var o = opt(opts);
    var C = CHART();
    var variant = ({ ring: 1, groot: 1, trend: 1 })[str(o.variant)] ? str(o.variant) : '';
    var klik = fn(o.onClick);
    var label = str(o.label);
    var waarde = str(o.waarde);

    /* de betekenistinten op .u-stat heten ok/warn/info/crit; die van .chip
       heten net anders. Geen gedeelde tabel, wel dezelfde toonnamen in. */
    var statToon = ({
      klaar: 'ok', ok: 'ok',
      wacht: 'warn', warn: 'warn',
      extern: 'info', info: 'info',
      kritiek: 'crit', crit: 'crit'
    })[str(o.toon)] || '';

    var klassen = ['u-stat'];
    if (variant) klassen.push(variant);
    if (variant === 'groot') {
      /* de gevulde kaart leest --vlak en --inkt uit zijn tintklasse. Perzik
         is de stand uit de mockup en dus de terugval. */
      klassen.push(tintKlasse(o.tint !== undefined ? o.tint : (str(o.toon) || 2)));
    } else if (statToon) {
      klassen.push(statToon);
    }

    var tegel = null;
    if (isNode(o.icoon)) tegel = o.icoon;
    else if (str(o.icoon)) tegel = iconTile({ icoon: str(o.icoon), toon: o.tint !== undefined ? o.tint : o.toon, maat: 40 });

    var lblEl = el('span', { class: 'u-stat-lbl', text: label });
    var numEl = el('span', { class: 'u-stat-num', text: waarde });
    var subEl = str(o.sub) ? el('span', { class: 'u-stat-sub', text: str(o.sub) }) : null;

    var kinderen = [];

    if (variant === 'ring') {
      var r = opt(o.ring);
      var ringNode = (C && fn(C.ring)) ? C.ring({
        waarde: r.waarde,
        max: r.max,
        maat: (typeof r.maat === 'number' && r.maat > 0) ? r.maat : 72,
        dikte: r.dikte,
        tekst: (r.tekst !== undefined) ? r.tekst : (waarde || undefined),
        subtekst: r.subtekst,
        toon: r.toon,
        percentage: r.percentage,
        label: label || str(r.label),
        beschrijving: r.beschrijving,
        animeer: r.animeer
      }) : el('span', { class: 'u-groot', text: waarde });

      kinderen.push(el('span', { class: 'u-stat-ringslot' }, ringNode));
      /* <span> en geen <div>: deze tegel IS een <button> zodra er een onClick
         is, en binnen een button hoort frasering-inhoud te staan. De vorm
         komt uit admin-ui.css — .u-stat.ring .u-stat-body staat daar op
         display:block en .u-stat-kop op display:flex — dus er verandert niets
         aan het beeld, wel aan de geldigheid van de HTML. */
      kinderen.push(el('span', { class: 'u-stat-body' }, [
        el('span', { class: 'u-stat-kop' }, [tegel, lblEl]),
        subEl
      ]));
    } else if (variant === 'groot') {
      kinderen.push(numEl);
      kinderen.push(lblEl);
      if (subEl) kinderen.push(subEl);
      var pijlLabel = str(o.pijlLabel) || (label ? 'Open ' + label : 'Openen');
      /* hoofdstuk 4.10 schrijft 36px voor en .u-btn.rond kende alleen 40 (kaal)
         en 32 (.klein). Er stond dus 32 waar 36 hoort. .m36 staat sinds deze
         ronde in admin-ui.css en is de enige maat die de spec hier noemt. */
      if (klik) {
        kinderen.push(el('span', {
          class: 'u-btn rond m36 u-stat-pijl',
          'aria-hidden': 'true'
        }, icon('pijl', 18)));
      } else if (fn(o.onPijl)) {
        kinderen.push(el('button', {
          type: 'button',
          class: knopKlasse('rond m36') + ' u-stat-pijl',
          'aria-label': pijlLabel,
          title: pijlLabel,
          onclick: o.onPijl
        }, icon('pijl', 18)));
      }
    } else if (variant === 'trend') {
      var spark = null;
      if (arr(o.reeks).length && C && fn(C.sparkline)) {
        spark = el('span', { class: 'u-stat-spark' }, C.sparkline({
          reeks: o.reeks,
          breedte: 130,
          hoogte: 58,
          toon: str(o.sparkToon) || 'ink',
          eindpunt: true,
          label: label || 'Verloop',
          beschrijving: str(o.sparkBeschrijving)
        }));
      }
      /* zelfde reden als bij de ringvariant: <span> binnen een knop. Het
         linkerblok had hier helemaal geen klasse en kon dus ook geen weergave
         uit het stijlblad krijgen; .u-stat-koptekst staat sinds deze ronde in
         admin-ui.css en zet die weergave (blok, en krimpbaar naast de
         sparkline van 130px). */
      kinderen.push(el('span', { class: 'u-stat-kop' }, [
        el('span', { class: 'u-stat-koptekst' }, [lblEl, numEl, subEl]),
        spark
      ]));

      var t = opt(o.trend);
      var pct = Number(t.pct);
      var richting = str(t.richting);
      if (!richting && isFinite(pct) && pct !== 0) richting = (pct > 0) ? 'op' : 'af';
      var trendTekst = str(t.tekst);
      /* geen tekst en geen percentage: dan is er niets te vergelijken en
         staat er ook niets. Een verzonnen "0% t.o.v. vorige maand" zou een
         meting suggereren die er niet is. */
      if (!trendTekst && isFinite(pct)) {
        trendTekst = getalTekst(Math.abs(pct), (typeof t.decimalen === 'number') ? t.decimalen : 0) + '%' +
          (str(t.periode) ? ' ' + str(t.periode) : '');
      }
      if (trendTekst) {
        var pijlIco = (richting === 'af') ? 'pijlOmlaag' : (richting === 'op' ? 'pijlOmhoog' : '');
        var woord = (richting === 'af') ? 'Gedaald' : (richting === 'op' ? 'Gestegen' : 'Gelijk gebleven');
        kinderen.push(el('span', {
          class: 'u-stat-trendregel' + (richting ? ' ' + richting : ''),
          /* de PIJL is voor het oog de tweede drager naast de kleur; het
             label is dezelfde informatie voor wie hem niet ziet. Hij VULT
             de zichtbare tekst aan en vervangt hem niet. */
          role: 'img',
          'aria-label': woord + ': ' + trendTekst
        }, [
          pijlIco ? icon(pijlIco, 15) : null,
          el('span', { text: trendTekst })
        ]));
      }
    } else {
      kinderen.push(lblEl);
      kinderen.push(numEl);
      if (subEl) kinderen.push(subEl);
    }

    var attrs = { class: klassen.join(' ') };
    var node;
    if (klik) {
      attrs.type = 'button';
      attrs.onclick = klik;
      if (str(o.titel)) attrs.title = str(o.titel);
      node = el('button', attrs, kinderen);
    } else {
      if (str(o.titel)) attrs.title = str(o.titel);
      node = el('div', attrs, kinderen);
    }

    if (o.verbergBijNul && isNul(o.waarde)) verberg(node, true);
    return node;
  }

  /* statRow(tegels) — het raster om de stattegels.
     .u-stats vult zichzelf met auto-fit; .drie dwingt precies drie kolommen
     af, en dat is de rij van Overzicht (spec 5.1). Die klasse gaat er dus
     alleen op als er ook echt drie zichtbare tegels staan.
     Is alles verborgen, dan verdwijnt het raster: een lege marge van 32px
     onder een onzichtbaar raster is de zichtbare versie van "hier stond ooit
     iets". */
  function statRow(tegels) {
    var lijst = arr(tegels).filter(isNode).filter(function (n) { return !n.hidden; });
    var wrap = el('div', { class: 'u-stats' + (lijst.length === 3 ? ' drie' : '') }, lijst);
    if (!lijst.length) verberg(wrap, true);
    return wrap;
  }

  /* ---- 13d. gespreksdraad (spec 4.12) --------------------------------
     berichten: [{auteur, organisatie, tekst, at, avatarUrl, vanKlant}]

     EEN BERICHT VAN DE KLANT EN EEN VAN JOU MOETEN UIT ELKAAR TE HOUDEN
     ZIJN ZONDER KLEUR. De mockup lost dat op met een tint, en een tint alleen
     is precies wat hoofdstuk 8 verbiedt. Hier draagt daarom een WOORD het
     verschil: een chip "Klant" of "Jij" naast de naam. Dat werkt in
     zwart-wit, in hoog contrast en voor een schermlezer, en het is meteen
     duidelijker dan een kleurverschil dat je moet leren. De klasse
     van-klant/van-ons staat er los bij, zodat een tint er later gratis
     bovenop kan.

     Het tijdstip loopt langs dezelfde datumopmaak als de tijdlijn: geef een
     ISO-tijd mee en CP_MODEL maakt er Nederlandse tekst van, of geef kant en
     klare tekst en er verandert niets. */
  function thread(opts) {
    var o = opt(opts);
    var berichten = arr(o.berichten).filter(isObj);
    var wrap = el('div', { class: 'u-thread' });

    if (!berichten.length) {
      wrap.appendChild(emptyTile({
        icoon: 'inbox',
        titel: str(o.leegTekst) || 'Nog geen berichten',
        uitleg: str(o.leegUitleg)
      }));
      return wrap;
    }

    berichten.forEach(function (b) {
      var vanKlant = !!b.vanKlant;
      var naam = str(b.auteur);
      wrap.appendChild(el('article', {
        class: 'u-thread-item ' + (vanKlant ? 'van-klant' : 'van-ons')
      }, [
        avatar({ naam: naam, url: b.avatarUrl, maat: 36 }),
        el('div', { class: 'u-thread-body' }, [
          el('div', { class: 'u-thread-kop' }, [
            el('span', { class: 'u-thread-naam', text: naam || 'Onbekend' }),
            str(b.organisatie) ? el('span', { class: 'u-thread-org', text: str(b.organisatie) }) : null,
            statusChip({
              label: vanKlant ? (str(o.klantLabel) || 'Klant') : (str(o.eigenLabel) || 'Jij'),
              toon: vanKlant ? 'extern' : 'nu'
            }),
            b.at ? el('span', { class: 'u-thread-tijd', text: tijdTekst(b.at, o) }) : null
          ]),
          el('span', { class: 'u-thread-tekst', text: str(b.tekst) })
        ])
      ]));
    });
    return wrap;
  }

  /* ---- 13e. metadataraster (spec 4.13) -------------------------------
     cellen: [{icoon, label, waarde, toon, groot}]
     Drie kolommen, twee op tablet, één op mobiel — dat staat allemaal in
     admin-ui.css. Een waarde mag een statusstip dragen; het WOORD ernaast is
     dan de waarde zelf, dus er ontstaat nooit een stip zonder tekst.
     Een lege waarde wordt "Niet ingevuld" en geen streepje: een streepje
     leest een schermlezer voor als niets, en "leeg" is hier echte
     informatie (hoofdstuk 7 van de spec: een leeg veld toont een eerlijke
     lege stand). */
  function metaGrid(opts) {
    var o = opt(opts);
    var cellen = arr(o.cellen).filter(isObj);
    var wrap = el('div', { class: 'u-meta' });
    if (!cellen.length) { verberg(wrap, true); return wrap; }

    cellen.forEach(function (c) {
      var ico = isNode(c.icoon) ? c.icoon : (str(c.icoon) ? icon(str(c.icoon), 15) : null);
      var heeftWaarde = str(c.waarde) !== '';
      var cel = el('div', {
        class: 'u-meta-cel',
        /* admin-ui.css heeft geen klasse voor "deze cel pakt de volle
           breedte"; het is één eigenschap en hij hoort bij de CEL en niet
           bij het raster, dus inline met opzet. */
        style: c.groot ? 'grid-column:1/-1;' : null
      }, [
        el('span', { class: 'u-meta-label' }, [ico, el('span', { text: str(c.label) })]),
        el('span', { class: 'u-meta-waarde' }, [
          str(c.toon) ? el('span', { class: 'u-dot ' + dotKlasse(c.toon) }) : null,
          el('span', { text: heeftWaarde ? str(c.waarde) : (str(c.leegTekst) || 'Niet ingevuld') })
        ])
      ]);
      wrap.appendChild(cel);
    });
    return wrap;
  }

  /* ---- 13f. chiprij (spec 4.16) --------------------------------------
     chips: [{label, icoon}] of ['Spuitgieten', ...]

     DE OVERLOOP MAG NIET ALLEEN IN EEN title STAAN. De spec vraagt een
     "+2" met een title die de rest noemt, maar een title-attribuut bereikt
     alleen wie een muis heeft: op aanraking verschijnt hij niet en een
     schermlezer leest hem lang niet altijd. De overloopchip is daarom een
     echte afbeelding met een naam (role=img + aria-label) mét dezelfde tekst
     — dan hoort iedereen wat er achter de +2 zit, en houdt de muisgebruiker
     zijn tooltip. */
  function chipRow(opts) {
    var o = opt(opts);
    var chips = arr(o.chips).map(function (c) {
      return isObj(c) ? c : { label: str(c) };
    }).filter(function (c) { return str(c.label); });

    var wrap = el('div', { class: 'u-chiprow' });
    if (!chips.length) { verberg(wrap, true); return wrap; }

    /* minstens één echte chip: een rij die alleen "+4" toont vertelt niets */
    var max = (typeof o.max === 'number' && o.max > 0) ? Math.max(1, Math.round(o.max)) : chips.length;
    var zichtbaar = chips.slice(0, max);
    var rest = chips.slice(max);

    zichtbaar.forEach(function (c) {
      wrap.appendChild(el('span', { class: 'u-chiprow-chip' }, [
        isNode(c.icoon) ? c.icoon : (str(c.icoon) ? icon(str(c.icoon), 14) : null),
        el('span', { text: str(c.label) })
      ]));
    });

    if (rest.length) {
      var namen = rest.map(function (c) { return str(c.label); }).join(', ');
      var tekst = (str(o.restTitel) || 'Ook nog') + ': ' + namen;
      wrap.appendChild(el('span', {
        class: 'u-chiprow-chip meer',
        role: 'img',
        'aria-label': tekst,
        title: tekst,
        text: '+' + rest.length
      }));
    }
    return wrap;
  }

  /* ---- 13g. zwevende opslagbalk (spec 4.18) --------------------------
     saveBar({dirty, tekst, bezigTekst, herstelLabel, opslaanLabel,
              opHerstel, opOpslaan, bezig})
     Geeft {el, zetDirty, zetBezig, stop} terug.

     Dit is de zichtbare vorm van het omgekeerde opslagmodel: geen elf losse
     "Opgeslagen"-flitsen meer, maar één knop per pagina. Dan moet je wél op
     elk moment kunnen zien of er iets openstaat, anders loop je weg met werk
     waarvan je denkt dat het bewaard is.

     DE LIVE-REGIO ZIT OP HET MERKTEKEN EN NIET OP DE HELE BALK. admin-ui.css
     vraagt role="status" "op de balk"; dat zou de twee knoppen mee in de
     live-regio trekken, en dan meldt de balk zich opnieuw zodra een knop van
     toestand wisselt. Het merkteken is precies het stuk dat verandert
     ("Niet opgeslagen" → "Bezig met opslaan…"), dus daar hoort hij.

     De balk staat er alleen als er iets te melden is. Een altijd zichtbare
     opslagbalk leert de gebruiker hem te negeren, en dan doet de ene keer
     dat er wél iets openstaat er ook niet meer toe.

     stop() geeft de onderrand van de werkkolom weer vrij — via dezelfde
     gedeelde teller als stickyPanel, zodat de twee elkaar niet in de weg
     zitten. Roep hem aan zodra het scherm verdwijnt. */
  function saveBar(opts) {
    var o = opt(opts);
    var dirty = !!o.dirty;
    var bezig = false;
    var rustTekst = str(o.tekst) || 'Niet opgeslagen';
    var bezigTekst = str(o.bezigTekst) || 'Bezig met opslaan…';

    var tekstEl = el('span', { text: rustTekst });
    var merk = el('span', {
      class: 'u-savebar-merk',
      role: 'status',
      /* polite: dit mag melden, maar nooit iemand onderbreken die midden in
         een veld zit te typen */
      'aria-live': 'polite'
    }, [el('span', { class: 'u-dot warn' }), tekstEl]);

    /* hoofdstuk 4.18 zet hier een GHOSTknop en niet de stille tekstknop die
       er stond. Het verschil is zichtbaar en het is er met reden: de balk
       zweeft op een witte kaart, en een knop zonder vulling en zonder rand
       leest daar als lopende tekst naast de zwarte opslaanknop. De ghostknop
       heeft een witte vulling en een --line rand en is dus als knop te
       herkennen zonder dat hij met de primaire actie concurreert. */
    var herstel = fn(o.opHerstel) ? el('button', {
      type: 'button',
      class: knopKlasse('ghost klein'),
      text: str(o.herstelLabel) || 'Herstel',
      onclick: o.opHerstel
    }) : null;

    var opslaan = el('button', {
      type: 'button',
      class: knopKlasse('klein'),
      text: str(o.opslaanLabel) || 'Wijzigingen opslaan',
      onclick: fn(o.opOpslaan) || null
    });

    var wrap = el('div', { class: 'u-savebar' }, [merk, herstel, opslaan]);

    /* De onderrand van de werkkolom wordt alleen vrijgehouden ZOLANG DE BALK
       ER STAAT, en niet vanaf het moment dat dit component bestaat. Anders
       reserveert een pagina zonder onopgeslagen werk 78px die niemand
       gebruikt — en een saveBar die nooit dirty wordt en dus ook nooit
       gestopt hoeft te worden, zou de klasse voorgoed laten staan. */
    var kolom = null;
    function toonBalk() {
      var zichtbaar = dirty || bezig;
      verberg(wrap, !zichtbaar);
      if (zichtbaar && !kolom) kolom = meldBalk();
      else if (!zichtbaar && kolom) kolom = vergeetBalk(kolom);
    }
    function zetDirty(aan) {
      dirty = !!aan;
      toonBalk();
    }
    function zetBezig(aan) {
      bezig = !!aan;
      /* tijdens opslaan gaat de knop op slot: twee keer opslaan is twee keer
         schrijven, en de tweede weet niets van de eerste */
      opslaan.disabled = bezig;
      if (herstel) herstel.disabled = bezig;
      tekstEl.textContent = bezig ? bezigTekst : rustTekst;
      toonBalk();
    }

    zetBezig(!!o.bezig);

    return {
      el: wrap,
      zetDirty: zetDirty,
      zetBezig: zetBezig,
      stop: function () { kolom = vergeetBalk(kolom); }
    };
  }

  /* ---- 13h. voorbeeldkaart (spec 4.19) -------------------------------
     "Zo wordt je organisatie weergegeven" en "Voorbeeld van uitgaande
     e-mail": een kaart op --card-2 die laat zien hoe iets er bij de
     ONTVANGER uitziet. De kop is daarom een uitleg en geen titel — hij zegt
     wat je ziet, niet wat er staat. */
  function previewCard(opts) {
    var o = opt(opts);
    var C = CHART();
    var kinderen = [];
    if (str(o.titel)) kinderen.push(el('span', { class: 'u-preview-kop', text: str(o.titel) }));
    arr(isNode(o.kinderen) ? [o.kinderen] : o.kinderen).forEach(function (k) {
      if (isNode(k)) kinderen.push(k);
    });

    var wilTakje = !!o.ornament && !!C && fn(C.leafOrnament);
    var kaart = el('div', { class: 'u-preview' + (wilTakje ? ' u-ornament-host' : '') }, kinderen);
    if (wilTakje) {
      kaart.appendChild(C.leafOrnament({
        hoek: (typeof o.ornament === 'string') ? o.ornament : 'rechtsonder',
        maat: 120
      }));
    }
    return kaart;
  }

  /* ---- 13i. lege tegel (spec 4.21) -----------------------------------
     De lege SECTIE uit het projectdetail ("Verzendingen" zonder zendingen),
     niet te verwarren met emptyState — dat is de lege LIJST binnen een kaart.
     Het icoon is hier decoratie: de titel eronder zegt hetzelfde in woorden,
     dus de lichte --ink-4 van admin-ui.css is geen drager en geen probleem. */
  function emptyTile(opts) {
    var o = opt(opts);
    var a = opt(o.actie);
    return el('div', { class: 'u-emptytile' }, [
      isNode(o.icoon) ? o.icoon : (str(o.icoon) ? icon(str(o.icoon), 40) : null),
      el('span', { class: 'u-emptytile-title', text: str(o.titel) || 'Nog niets' }),
      str(o.uitleg) ? el('span', { class: 'u-emptytile-text', text: str(o.uitleg) }) : null,
      str(a.label) ? el('button', {
        type: 'button',
        class: knopKlasse('ghost klein ' + str(a.klasse)),
        text: str(a.label),
        onclick: fn(a.onClick) || null
      }) : null
    ]);
  }

  /* ---- 13j. sectiekop ------------------------------------------------
     sectionHead({kicker, titel, telling, actie})
     De kop van 20px met rechts een stille actielink ("Bekijk alle
     activiteit →"). De link is ZWART met onderstreping bij hover — hoofdstuk
     0 van de spec — en dat zit in .u-link, niet hier.
     Met een route wordt het een echte <a>: middelklik en "open in een nieuw
     tabblad" horen bij iets met een eigen adres. Met alleen een handler een
     <button>, want een link die nergens heen gaat is geen link. */
  function sectionHead(opts) {
    var o = opt(opts);
    var kop = el('h2', null, [
      document.createTextNode(str(o.titel)),
      (typeof o.telling === 'number') ? telSpan(o.telling) : null
    ]);
    var links = str(o.kicker)
      ? el('div', null, [el('span', { class: 'u-kicker', text: str(o.kicker) }), kop])
      : kop;

    var a = opt(o.actie);
    var actie = null;
    if (isNode(o.actie)) {
      actie = o.actie;
    } else if (str(a.label)) {
      var inhoud = [el('span', { text: str(a.label) }), icon(str(a.ico) || 'chevron', 15)];
      var doel = str(a.href) || str(a.route);
      if (fn(a.onClick)) {
        actie = el('button', { type: 'button', class: 'u-link', onclick: a.onClick }, inhoud);
      } else if (doel) {
        actie = el('a', { class: 'u-link', href: doel }, inhoud);
      }
    }
    return el('div', { class: 'u-sectionhead' }, [links, actie]);
  }

  /* ---- 13k. producttegelrij (spec 5.5) -------------------------------
     De drie producttegels onder de hairline op de klantkaart: beeld 64px,
     naam, klant. Zonder onOpen is het een gewone rij en geen tabstop — een
     knop die niets doet is een stop voor niets. */
  function productRow(opts) {
    var o = opt(opts);
    var open = fn(o.onOpen);

    var beeld;
    if (isNode(o.beeld)) beeld = o.beeld;
    else if (str(o.beeld)) beeld = el('img', { class: 'u-productrow-beeld', src: str(o.beeld), alt: '', loading: 'lazy' });
    else beeld = el('span', { class: 'u-productrow-beeld', 'aria-hidden': 'true' });

    var kinderen = [
      beeld,
      el('span', { class: 'u-productrow-body' }, [
        el('span', { class: 'u-productrow-naam', text: str(o.titel) }),
        str(o.sub) ? el('span', { class: 'u-productrow-klant', text: str(o.sub) }) : null
      ]),
      open ? chevronRij() : null
    ];

    if (open) return el('button', { type: 'button', class: 'u-productrow', onclick: open }, kinderen);
    return el('div', { class: 'u-productrow' }, kinderen);
  }

  /* ---- 13l. beoordelingsrij (spec 4.15 in gebruik) -------------------
     ratingRow({label, waarde, max, toon, leegTekst})
     Label, vijf stippen, en de waarde ALS TEKST ernaast. Die tekst is geen
     dubbeling maar de tweede drager: vier gevulde stippen en één lege zijn
     op een klein scherm, in hoog contrast of met kleurenblindheid niet
     betrouwbaar te tellen.

     De stippen worden daarom expliciet op decoratie gezet. CP_CHART.ratingDots
     geeft ze standaard role="img" met een eigen label, en dan hoort een
     schermlezer "Kwaliteit, 4 van 5" gevolgd door "4 van 5" — één keer is
     genoeg, en de tekst die iedereen ziet is de juiste bron.

     Een fabriek die nog niet beoordeeld is (hoofdstuk 7 van de spec zet er
     in de demoseed met opzet één zo neer) krijgt geen nul stippen maar een
     eerlijke lege stand: nul is een oordeel, "nog niet beoordeeld" is er
     geen. */
  function ratingRow(opts) {
    var o = opt(opts);
    var C = CHART();
    var max = (typeof o.max === 'number' && o.max > 0) ? Math.round(o.max) : 5;
    var heeft = (typeof o.waarde === 'number') && isFinite(o.waarde);
    var label = str(o.label);

    /* DE LEGE STAND HANGT NERGENS VAN AF, en dat was ze wel.
       Ze gebruikte .cpch-rating en .cpch-rating-label — klassen die alleen
       bestaan in het stijlblok dat CP_CHART in de <head> zet, en dat blok
       wordt uitsluitend geplaatst door zorgStijl(), die aan het begin van élke
       TEKENfunctie staat. In de lege tak wordt er niets getekend, dus op een
       pagina waar verder geen enkele grafiek staat (het fabrieksdetail van de
       fabriek die in de demoseed met opzet zonder scores staat) was er geen
       stijl en stond er kale tekst. Nu staat de lege stand op de eigen
       klassen van admin-ui.css en hangt ze aan niets. */
    if (!heeft) {
      return el('div', { class: 'u-ratingrij' }, [
        label ? el('span', { class: 'u-ratingrij-label', text: label }) : null,
        el('span', { class: 'u-ratingrij-leeg', text: str(o.leegTekst) || 'Nog niet beoordeeld' })
      ]);
    }

    var waarde = Math.max(0, Math.min(Math.round(o.waarde), max));
    var rij;
    if (C && fn(C.ratingDots)) {
      rij = C.ratingDots({ label: label, waarde: waarde, max: max, toon: o.toon });
      var stippen = rij.querySelector ? rij.querySelector('.cpch-rating-stippen') : null;
      if (stippen) {
        stippen.removeAttribute('role');
        stippen.removeAttribute('aria-label');
        stippen.setAttribute('aria-hidden', 'true');
      }
    } else {
      /* zonder CP_CHART is er ook geen .cpch-stijlblok; zelfde reden als in
         de lege tak hierboven */
      rij = el('div', { class: 'u-ratingrij' }, label ? el('span', { class: 'u-ratingrij-label', text: label }) : null);
    }
    /* beide klassen: binnen een echte ratingDots-rij past hij bij de stippen
       ernaast (die kleur komt uit het stijlblok van CP_CHART), en in de
       terugval staat hij op de eigen klasse van admin-ui.css. De twee zijn
       expres op dezelfde maat en kleur gezet, dus welke van de twee wint
       maakt visueel niets uit. */
    rij.appendChild(el('span', {
      class: 'cpch-rating-label u-ratingrij-label',
      text: getalTekst(waarde, 0) + ' van ' + getalTekst(max, 0)
    }));
    return rij;
  }

  /* ---- 13m. statusstip ----------------------------------------------
     statusDot({toon, label, titel}) of statusDot('wacht')
     Stip PLUS woord, altijd. Laat de aanroeper het woord weg, dan zet dit
     component er het standaardwoord van die toon neer — een stip zonder
     tekst kan hier dus niet ontstaan, ook niet per ongeluk. Dat is
     hoofdstuk 8 van de spec, en het is de reden dat dit component bestaat in
     plaats van dat elk scherm zelf een .u-dot neerzet. */
  function statusDot(opts) {
    var o = (typeof opts === 'string') ? { toon: opts } : opt(opts);
    var toon = str(o.toon);
    var woord = str(o.label) || STIP_WOORD[toon] || 'Onbekend';
    return el('span', { class: 'u-status', title: str(o.titel) || null }, [
      el('span', { class: 'u-dot ' + dotKlasse(toon) }),
      el('span', { text: woord })
    ]);
  }

  /* ============================================================
     EXPORT
     ============================================================ */
  return {
    VERSION: VERSION,

    el: el,
    clear: clear,
    icon: icon,
    iconKnop: iconKnop,
    iconBestaat: iconBestaat,
    iconNamen: iconNamen,

    pageHeader: pageHeader,
    crumbs: crumbs,

    filterChips: filterChips,
    tabs: tabs,

    statusChip: statusChip,
    statusDot: statusDot,
    summaryCard: summaryCard,
    summaryRow: summaryRow,

    taskCard: taskCard,
    entityRow: entityRow,
    entityList: entityList,
    emptyState: emptyState,
    emptyTile: emptyTile,

    timelineRow: timelineRow,
    timeline: timeline,

    contextMenu: contextMenu,
    confirmInline: confirmInline,

    masterDetail: masterDetail,
    stickyPanel: stickyPanel,
    saveBar: saveBar,
    settingsCategoryCard: settingsCategoryCard,

    projectProgress: projectProgress,
    searchField: searchField,
    toast: toast,
    kb: kb,

    /* de bouwstenen van de mockup (hoofdstuk 13) */
    avatar: avatar,
    avatarGroep: avatarGroep,
    iconTile: iconTile,
    statTile: statTile,
    statRow: statRow,
    thread: thread,
    metaGrid: metaGrid,
    chipRow: chipRow,
    previewCard: previewCard,
    sectionHead: sectionHead,
    productRow: productRow,
    ratingRow: ratingRow
  };
});
