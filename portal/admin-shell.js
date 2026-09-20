/* CUSTOM+ — applicatieshell van de nieuwe beheerindeling (fase 1).
   ------------------------------------------------------------------
   WAARVOOR DIT BESTAND BESTAAT
   Het beheer wordt heringedeeld van negen tabbladen naar vijf werkgebieden
   (Overzicht, Inbox, Projecten, Relaties, Financien) plus Activiteit en
   Instellingen. Dit bestand is de omlijsting daaromheen: zijbalk, topbalk,
   router, navigatiewaarschuwing en focusbeheer.

   Het is nadrukkelijk GEEN nieuw scherm. De schermen blijven in beheer.html
   staan en worden nog steeds door render() getekend; de shell zegt alleen
   WAARHEEN er genavigeerd wordt en zorgt dat er onderweg niets zoekraakt.

   DRIE GATEN DIE HIER DICHTGAAN, EN NIETS ANDERS
   Dit zijn geen extra's maar bestaande gebreken die de verbouwing zichtbaar
   zou maken:

   1. NAVIGATIEWAARSCHUWING. De factuureditor bewaakt vandaag alleen zijn
      eigen terugknop (invLeave). Een klik in de zijbalk, een zoekresultaat
      of de terugknop van de browser gooit onopgeslagen werk stil weg. Hier
      loopt ELKE navigatie langs registreerGuard(), inclusief het sluiten van
      het tabblad (beforeunload).

   2. RENDER-TOKEN. render() leegt #content synchroon terwijl de bouwers pas
      in een .then schrijven. Twee snelle navigaties schrijven dan allebei in
      hetzelfde vak en het resultaat is een half scherm. Elke navigatie hoogt
      hier een teller op; een bouwer die na zijn ophaalactie wil schrijven,
      controleert eerst tokenGeldig(t).

   3. FOCUS. Na een routewissel blijft een toetsenbord- of schermlezer-
      gebruiker achter op een knop die niet meer bestaat. Hier verhuist de
      focus naar de h1 van de nieuwe pagina (CP_UI.pageHeader geeft die een
      tabindex=-1), staat er een skiplink vooraan, en meldt een aria-live
      regio welke pagina er nu staat.

   VIJF AFSPRAKEN DIE DE REST VAN HET BESTAND VERKLAREN

   A. #content WORDT NOOIT VERVANGEN. De shell krijgt het bestaande element
      mee en verplaatst het alleen. Tientallen renderfuncties in beheer.html
      houden een verwijzing vast die één keer bij het laden is vastgelegd
      (var content = document.getElementById('content')); een nieuw element
      zou betekenen dat elk scherm in een losgekoppelde div tekent.

   B. VIER ELEMENT-ID'S VERHUIZEN MEE IN PLAATS VAN NAGEBOUWD TE WORDEN:
      #whoName, #whoMail, #logoutBtn en #modeBar (met #modeDot en #modeText).
      beheer.html zoekt ze bij het inloggen rechtstreeks op met
      getElementById en heeft er al gebeurtenislisteners op hangen. Ze worden
      verplaatst naar de topbalk en daar verborgen; de zichtbare topbalk
      LEEST ze. Zo blijven enterApp(), paintModeBar(), runHealthChecks() en de
      bestaande uitlogknop werken zonder één regel wijziging, en blijft de
      go-live-checklist bereikbaar via het statusvenster achter de badge.

   C. DE SHELL NEEMT DE TOETSENBORDLAAG EXPLICIET OVER. De listener staat in
      de CAPTURE-fase, zodat hij vóór de bestaande listener van beheer.html
      loopt en cmd+K naar het zoekveld kan sturen in plaats van naar de
      springbalk-modal. De bestaande bewaking blijft ONGEWIJZIGD gelden: geen
      sneltoets in een invoerveld, geen sneltoets terwijl er een dialoog open
      staat.

   D. GEEN EXTRA OMHULSEL OM DE APP. Het printvel van de factuur verbergt
      alle DIRECTE kinderen van body (body.print-invoice > *). De shell bouwt
      daarom BINNEN het bestaande #app-element: die wisselt van klasse
      (.shell wordt .u-shell) en krijgt de zijbalk en de werkkolom als
      kinderen. Zet hier nooit een extra div omheen, dan staat de hele app op
      de afdruk.

   E. DE SHELL KENT GEEN DATA. Geen DS, geen adminSettings, geen render().
      Alles komt via opts binnen en gaat via callbacks terug. Wat de shell
      wél weet is waar je bent, of er onopgeslagen werk is, en welke tekening
      nog geldig is.

   WAT DE MOCKUPRONDE HIER TOEVOEGDE (hoofdstuk 3 en 6 van de mockupspec)
   Vier dingen die de spec tekent en die tot deze ronde geen uitvoerder
   hadden. Alle vier zitten ze in de omlijsting en dus in dit bestand:

   1. HET DERDE SLOT IN DE TOPBALK. Hoofdstuk 3 zet rechts "bel 20px,
      kalender 20px (of vraagteken op Overzicht)". Er stond alleen de bel.
      Het is ÉÉN slot met twee knoppen: op Overzicht het vraagteken (dat
      opent de bestaande sneltoetshulp), op elk ander scherm de kalender.
      De kalenderknop is bewust de eenvoudigste eerlijke invulling: de
      deadlinekalender is geen eigen pagina maar een kaart in de rail van
      Overzicht, dus de knop navigeert daarheen en zegt dat ook hardop in de
      meldregio. Een eigen kalendervenster nabouwen zou een tweede kalender
      opleveren die meteen uit de pas gaat lopen met die kaart.

   2. DE INKLAPKNOP STAAT ONDERAAN LINKS. Hij hing als tweede kind in
      .u-side-head; hoofdstuk 3 zet hem onderaan. admin-ui.css schreef daar
      terecht over op dat een stijlblad een element niet naar een andere
      ouder kan verplaatsen — deze bouwer wel, en dus doet hij het hier.

   3. DE ZIJBALK IS ONDER 700PX EEN UITSCHUIFPANEEL. .u-side.open en
      .u-side-scrim stonden al in admin-ui.css met de aantekening "NOG GEEN
      UITVOERDER". Die uitvoerder is nu deze shell: een menuknop links in de
      topbalk, een waas die de rest afdekt, Escape, een focusval binnen het
      paneel, een klik op de waas, en sluiten zodra er genavigeerd wordt.
      De zeven werkgebieden blijven daarnáást in het + Nieuw-menu hangen:
      dat is de weg die vandaag werkt en een tweede weg naar dezelfde
      pagina's kost niets, terwijl het wegnemen ervan de telefoon
      onnavigeerbaar maakt zodra dit paneel ergens niet opent.
      De menuknop draagt naast .u-iconbtn ook .u-side-open. Dat is de
      stijlhaak waar admin-ui.css op drie plekken op mikt (verbergen boven
      700px, tonen eronder, en het printblok); zonder die klasse hing zijn
      onzichtbaarheid boven 700px aan het toeval dat beide gastheren een
      regel voor het hidden-attribuut hebben staan.

   4. HET GEBRUIKERSMENU IS COMPLEET. Hoofdstuk 3 zet rechtsboven "avatar
      36px rond + naam 15px weight 500 + chevron 16px --ink-3". De knop werd
      hier met alleen de avatar gebouwd, waardoor de naam nergens stond en
      drie regels in admin-ui.css niets raakten. Naam en chevron staan er nu
      bij, als inline elementen binnen de knop; onder 700px verbergt het
      stijlblad de naam en blijft de avatar staan.

   Publieke API (globalThis.CP_SHELL). Deze lijst IS de exporttabel van
   hoofdstuk 14, in dezelfde volgorde. Wijken ze af, dan is deze lijst fout
   en niet de tabel — een aanroeper die hier zoekt en niets vindt, bouwt de
   functie na:
     VERSION
     monteer(opts) -> handvat
     actief()                            het gemonteerde handvat, of null
     ga / route / start / ververs / reset
     zetBadge / zetTitel / zetKruimels / zetModus / zetKop / focusInhoud /
       meld
     registreerGuard / verwijderGuard / registreerLaag / verwijderLaag
     zetSelectie / selectie
     zoekbronnenVerlopen / tekenGebruiker / verversMeldingen / isGestart
     tokenNu / tokenGeldig
     legacyGo / legacyView / isLegacyView / raaktView
     zetSneltoetsenActief

   Het handvat dat monteer() teruggeeft draagt diezelfde functies, plus vier
   verwijzingen en zijn eigen opruimer. Die staan bewust NIET op CP_SHELL:
   zonder gemonteerde shell betekenen ze niets.
     el / zijbalkEl / topbalkEl / inhoudEl / demonteer

   LADEN
     browser : <script src="portal/admin-shell.js"></script> NA
               admin-model.js en admin-ui.js en vóór het hoofdscript van
               beheer.html. Het bestand zet zichzelf op globalThis als
               CP_SHELL en raakt bij het laden niets aan — monteer() doet al
               het DOM-werk, en die roep je pas aan als #app bestaat.
     node    : importeerbaar voor tests (module.exports). Het factory-lichaam
               raakt geen document aan, dus laden zonder DOM klapt niet.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_SHELL = api;
  /* zelfde reden als in admin-model.js en admin-ui.js: er is geen
     package.json met "type":"module", dus in Node is dit CJS en is dit een
     echte export. Draait het ooit als ESM, dan bestaat `module` niet en
     blijft alleen globalThis over. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     0. KALE HULPJES

     Bewust een eigen setje en niet dat van CP_UI: de shell moet kunnen
     opstarten terwijl CP_UI nog niet geladen is (dan valt hij terug op een
     kale zijbalk in plaats van te klappen), en een bestand dat nergens van
     afhangt is los te controleren met node --check.
     ============================================================ */

  function arr(v) { return Array.isArray(v) ? v : []; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function opt(v) { return isObj(v) ? v : {}; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function fn(v) { return typeof v === 'function' ? v : null; }
  function isNode(v) { return !!v && typeof v === 'object' && typeof v.nodeType === 'number'; }

  function G() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    return null;
  }
  function MODEL() { var g = G(); return (g && g.CP_MODEL) ? g.CP_MODEL : null; }
  function UI() { var g = G(); return (g && g.CP_UI) ? g.CP_UI : null; }

  /* el() is LETTERLIJK de helper uit beheer.html regel 2028 en uit
     admin-ui.js. Niet "ongeveer": zodra een tweede el() ook maar één
     attribuut anders behandelt is dat een fout die pas maanden later
     opvalt. */
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

  function leeg(node) {
    if (!node) return node;
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* focus() op een element dat intussen uit de DOM is gehaald doet stilletjes
     niets én laat de focus op <body> achter; dat is precies het gat dat we
     hier dichten, dus het wordt gemeten in plaats van gehoopt */
  function focusOp(node) {
    if (!node || !node.focus) return false;
    if (node.ownerDocument && node.ownerDocument.contains && !node.ownerDocument.contains(node)) return false;
    try { node.focus(); } catch (e) { return false; }
    return true;
  }

  function binnen(node, wortel) {
    if (!node || !wortel) return false;
    var p = node;
    while (p) { if (p === wortel) return true; p = p.parentNode; }
    return false;
  }

  /* CP_UI.icon met terugval: zonder componentbibliotheek moet de shell nog
     steeds een bruikbare zijbalk opleveren in plaats van te klappen */
  function ico(naam, maat) {
    var u = UI();
    if (u && fn(u.icon)) return u.icon(naam, maat);
    return null;
  }

  /* icoVorm() is ico() met één extra vraag: IS DIT ECHT HET GEVRAAGDE ICOON?
     CP_UI.icon zwijgt niet meer over een onbekende naam — hij tekent een
     terugvalvorm (een vierkantje met een kruis) en zet er
     data-onbekend-icoon op. Voor een tabel met icoontegels is dat precies
     goed: je ziet meteen welke naam ontbreekt. Voor een knop die ALLEEN een
     icoon draagt is het dat niet: dan zit er een kruisje in de topbalk dat
     eruitziet als "sluiten" en dat is erger dan geen icoon.
     Deze functie geeft in dat geval null, zodat de aanroeper zijn eigen
     terugval kan tekenen — dezelfde afspraak die de zijbalkknop al hanteerde
     toen CP_UI helemaal ontbrak. De tweede vraag (staat er iets in?) blijft
     staan voor een oudere admin-ui.js zonder terugvalvorm. */
  function icoVorm(naam, maat) {
    var s = ico(naam, maat);
    if (!s || !s.firstChild) return null;
    if (s.getAttribute && s.getAttribute('data-onbekend-icoon') != null) return null;
    return s;
  }

  /* CP_UI.iconKnop met terugval, naar het voorbeeld van de belknop: zonder
     componentbibliotheek moet er nog steeds een bedienbare knop met een
     naam staan in plaats van niets. */
  function iconKnopVeilig(naam, label, onKlik) {
    var u = UI();
    if (u && fn(u.iconKnop)) return u.iconKnop(naam, label, onKlik);
    var knop = el('button', {
      type: 'button',
      class: 'u-iconbtn',
      'aria-label': label,
      title: label,
      onclick: fn(onKlik) || null
    });
    var i = icoVorm(naam, 20);
    if (i) knop.appendChild(i);
    return knop;
  }

  /* De drie streepjes van de menuknop. CP_UI.ICONEN kent geen 'menu', en een
     letterteken als terugval (≡ of ☰) hangt af van het lettertype dat de
     bezoeker toevallig heeft. Drie spans op currentColor doen het altijd,
     schalen mee met de knopkleur en kosten geen icoontabel.

     WAAROM HIER NIET GEWOON icoVorm('menu') STAAT: CP_UI.icon schrijft bij
     een onbekende naam een waarschuwing in de console en tekent een
     vierkantje met een kruis. Die waarschuwing hoort bij een tikfout en dit
     is er geen, en dat kruisje leest in een topbalk als "sluiten". Dus
     alleen vragen als de tabel bekend én gevuld is — exporteert CP_UI zijn
     ICONEN ooit met een 'menu' erin, dan wint die vanzelf. */
  function menuTeken() {
    var u = UI();
    if (u && u.ICONEN && u.ICONEN.menu) {
      var s = icoVorm('menu', 20);
      if (s) return s;
    }
    var vak = el('span', {
      'aria-hidden': 'true',
      style: 'display:flex;flex-direction:column;justify-content:space-between;width:18px;height:14px;'
    });
    for (var i = 0; i < 3; i++) {
      vak.appendChild(el('span', { style: 'display:block;height:2px;border-radius:2px;background:currentColor;' }));
    }
    return vak;
  }

  function media(vraag) {
    var g = G();
    if (!g || !g.matchMedia) return null;
    try { return g.matchMedia(vraag); } catch (e) { return null; }
  }

  /* matchMedia luistert in oudere Safari alleen via addListener; beide
     paden staan hier één keer zodat de rest van het bestand er niets van
     merkt */
  function opMedia(mq, handler) {
    if (!mq) return;
    if (mq.addEventListener) { mq.addEventListener('change', handler); return; }
    if (mq.addListener) { mq.addListener(handler); }
  }

  /* de tegenhanger, en niet voor de netheid: een mediaquery blijft leven
     zolang de pagina leeft. Een luisteraar die bij het demonteren blijft
     hangen, schrijft na een tweede monteer() bij elke breedtewissel in een
     losgekoppelde zijbalk — geen fout, geen melding, alleen een shell die
     twee keer op één toetsaanslag reageert. Beide paden staan hier één keer,
     precies zoals bij opMedia(). */
  function afMedia(mq, handler) {
    if (!mq) return;
    if (mq.removeEventListener) { mq.removeEventListener('change', handler); return; }
    if (mq.removeListener) { mq.removeListener(handler); }
  }

  /* ============================================================
     1. MODULE-STAAT

     Er is per pagina precies één beheerapp en dus precies één shell. Die
     staat hier, zodat de losse exports (legacyGo, tokenGeldig, raaktView)
     zonder handvat aanroepbaar zijn — de storage-listener en de bestaande
     go()-aanroepen in beheer.html hebben er geen.
     ============================================================ */

  var gemonteerd = null;

  /* De teller staat BUITEN monteer(). Reden: tokenGeldig() wordt aangeroepen
     vanuit renderfuncties die de shell niet kennen, en een teller die bij
     opnieuw monteren terugspringt zou een oude tekening ineens weer geldig
     verklaren. */
  var token = 0;
  function tokenNu() { return token; }
  function tokenGeldig(t) { return t === token; }

  /* sneltoetsen kunnen door beheer.html tijdelijk uitgezet worden (een
     scherm dat zelf de pijltjes wil, een lange import). Staat ook buiten
     monteer() zodat de schakelaar overleeft wat er met de shell gebeurt. */
  var sneltoetsenAan = true;
  function zetSneltoetsenActief(aan) { sneltoetsenAan = (aan !== false); }

  /* ============================================================
     2. MONTEREN
     ============================================================ */

  /* monteer(opts) bouwt de omlijsting in `container` en geeft een handvat
     terug.

     LET OP — PRINTVEL. Het factuurprintvel van beheer.html werkt met
        body.print-invoice > *{ display:none !important; }
     Die regel verbergt alle DIRECTE kinderen van <body> en toont daarna
     alleen #invoiceprint. Deze functie bouwt daarom binnen het BESTAANDE
     #app-element en zet er geen enkele wikkel omheen. Wie hier later een
     extra <div> omheen zet, laat de complete beheerapp op de factuurafdruk
     verschijnen — en dat merk je pas bij de klant.

     opts:
       container      element waarin de shell komt (in de praktijk #app)
       contentEl      HET BESTAANDE #content — wordt verplaatst, nooit
                      vervangen of opnieuw aangemaakt
       gebruiker      {naam, mail} voor het gebruikersmenu (terugval: de
                      tekst van de meeverhuisde #whoName / #whoMail)
       onNavigeer(route)   de app tekent zelf het scherm; mag een Promise
                           teruggeven
       onUitloggen()
       zoekBronnen()       lijst (of Promise van een lijst) met
                           {label, sub, route|onKies} voor het zoekveld
       maakItems()         items voor het + Nieuw-menu (CP_UI.contextMenu)
       modus()             {mode:'demo'|'live', staat:'ok|warn|bad', tekst}
     optioneel, met een eerlijke terugval als ze ontbreken:
       bevestig(tekst)     -> Promise<bool>; standaard window.confirm
       modaalOpen()        -> bool; standaard: staat er een .overlay in de DOM
       meldingen()         lijst voor het belmenu
       onSneltoetshulp()   opent het sneltoetsvenster (beheer.html:
                           openShortcutHelp)
       onModusDetails()    opent het statusvenster; standaard wordt op het
                           meeverhuisde #modeBar geklikt, waar
                           openModeStatusModal al aan hangt */
  function monteer(opts) {
    var o = opt(opts);
    var doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return null;

    /* twee shells naast elkaar zouden twee routers, twee keydown-listeners
       en twee zijbalken opleveren; opnieuw monteren ruimt eerst op */
    if (gemonteerd && fn(gemonteerd.demonteer)) gemonteerd.demonteer();

    var container = isNode(o.container) ? o.container : doc.getElementById('app');
    var contentEl = isNode(o.contentEl) ? o.contentEl : doc.getElementById('content');
    if (!container || !contentEl) return null;

    var M = MODEL();
    var U = UI();

    /* ---------- 2a. de meeverhuizers veiligstellen ----------
       Deze vier id's worden door beheer.html rechtstreeks opgezocht. Ze
       worden hieronder VERPLAATST, niet nagebouwd: een kopie zou betekenen
       dat getElementById het oude, losgekoppelde element vindt en het
       inloggen stil in het niets schrijft. */
    var modeBar = doc.getElementById('modeBar');
    var whoName = doc.getElementById('whoName');
    var whoMail = doc.getElementById('whoMail');
    var logoutBtn = doc.getElementById('logoutBtn');

    /* ---------- 2b. staat van deze shell ---------- */
    var huidige = M ? M.parseRoute('') : { area: 'overzicht', sub: null, id: null, tab: null, params: {} };
    var laatsteHash = '';          /* wat WIJ als laatste geschreven hebben */
    var guards = [];
    /* per soort {sluit, isOpen} of null — zie registreerLaag() en laagOpen():
       de sluitfunctie alleen is niet genoeg, want een scherm meldt zijn laag
       één keer bij het tekenen aan en niet pas bij het openen */
    var lagen = { drawer: null, detail: null };
    var selectieWaarde = null;
    var zoekCache = null;
    var zoekTeller = 0;            /* tegen trage zoekbronnen die te laat terugkomen */
    var kruimelsGezet = false;
    var titel = '';
    /* de kop (CP_UI.pageHeader) van het scherm dat nu getekend is, of null.
       Wordt bij elke navigatie geleegd, om dezelfde reden als de guards: de
       kop van het vorige scherm bestaat daarna niet meer. */
    var huidigeKop = null;
    var gestart = false;
    var afgebroken = false;

    /* ============================================================
       3. DOM: skiplink, meldregio, zijbalk, topbalk, werkkolom
       ============================================================ */

    var skip = el('a', {
      class: 'u-skip',
      href: '#content',
      text: 'Naar de inhoud',
      /* href blijft staan voor de linksemantiek, maar de sprong gaat NOOIT
         door de browser heen: '#content' is geen route en zou via de
         hashchange-lus meteen naar Overzicht navigeren. */
      onclick: function (e) { e.preventDefault(); focusInhoud(); }
    });

    var melder = el('div', {
      role: 'status',
      'aria-live': 'polite',
      /* admin-ui.css heeft bewust geen sr-only-klasse; dit is dezelfde
         buiten-beeld-truc als .u-skip (geen clip-rect), zodat een
         schermlezer hem wel leest en een muisgebruiker hem nooit ziet */
      style: 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;'
    });

    /* ---------- 3a. zijbalk ---------- */

    /* DE INKLAPKNOP HOORT ONDERAAN LINKS (hoofdstuk 3). Hij stond als tweede
       kind in .u-side-head; die afwijking was voor het stijlblad onherstelbaar
       (CSS verplaatst geen elementen) maar voor deze bouwer niet. Hij hangt
       hieronder in .u-side-foot, ná de navigatie.

       ONDER 700PX BETEKENT DEZELFDE KNOP IETS ANDERS. Daar is de zijbalk een
       uitschuifpaneel en zet de mediaquery de ingeklapte stand toch terug op
       volle breedte — "inklappen naar 68px" is daar dus een knop die niets
       doet. Op die breedte SLUIT hij het paneel. Dat is geen extraatje: een
       aanraakgebruiker heeft geen Escape, en het paneel alleen via de waas
       kunnen sluiten is te weinig. */
    var zijToggle = el('button', {
      type: 'button',
      class: 'u-side-toggle',
      onclick: function () {
        if (paneelModus()) { sluitZijpaneel(true); return; }
        zetIngeklapt(!zij.classList.contains('collapsed'), true);
      }
    });

    /* DE VOET DRAAGT ZIJN EIGEN PLAATSING, EN NIET MEER DIT BESTAND.
       Hier stond een style-attribuut (display, margin-top:auto, padding) als
       vangnet zolang .u-side-foot nog niet in admin-ui.css bestond. Dat
       vangnet is weg: een inline stijl wint van het stijlblad en houdt elke
       latere verfijning tegen. Hetzelfde geldt voor de uitlijning in de
       ingeklapte rail, die niet meer in tekenZijToggle() gezet wordt.

       Dit is dus een AFHANKELIJKHEID en geen keuze. Zonder
         .u-side-foot{ margin-top:auto; display:flex; padding:6px 14px 20px; }
         .u-side.collapsed .u-side-foot{ justify-content:center; }
       schuift de inklapknop omhoog tegen de navigatie aan in plaats van
       onderaan links te staan, zoals hoofdstuk 3 hem tekent. */
    var zijFoot = el('div', { class: 'u-side-foot' }, zijToggle);

    var zijNav = el('nav', { class: 'u-side-nav', 'aria-label': 'Hoofdnavigatie' });

    var zij = el('aside', {
      class: 'u-side',
      /* de id is het doelwit van aria-controls op de menuknop. Vast en niet
         geteld: er is per pagina precies één shell en dus precies één
         zijbalk. */
      id: 'cp-zijbalk',
      /* focusdoel bij het openen van het paneel, zodat een schermlezer
         bovenaan het paneel begint en niet halverwege de navigatie */
      tabindex: '-1'
    }, [
      el('div', { class: 'u-side-head' }, [
        el('div', { class: 'u-side-brand' }, [
          el('div', { class: 'wordmark', text: 'CUSTOM+' }),
          el('div', { class: 'kicker', text: 'Beheer' })
        ])
      ]),
      zijNav,
      zijFoot
    ]);

    /* de waas onder het uitschuifpaneel. admin-ui.css tekent hem al
       (.u-side-scrim, z-index 44, fade van .25s) maar niemand maakte hem.
       Hij staat BUITEN paneelstand op hidden: zonder de mediaquery heeft
       .u-side-scrim geen enkele regel en zou het een leeg flex-item in
       .u-shell worden. Binnen paneelstand blijft hij juist altijd staan —
       ook dicht — want een element dat pas bij het openen uit display:none
       komt, mist zijn eigen overgang. Dicht is hij visibility:hidden en dus
       niet klikbaar en niet tabbaar. */
    var scrim = el('div', {
      class: 'u-side-scrim',
      'aria-hidden': 'true',
      onclick: function () { sluitZijpaneel(true); }
    });
    scrim.hidden = true;

    /* De knoppen worden hieronder DYNAMISCH gebouwd uit CP_MODEL.AREAS. Dat
       heeft één gevolg dat je stil zou missen: de bestaande klikbinding in
       beheer.html hangt aan de statische markup
         document.querySelectorAll('.navbtn').forEach(...)
       en is bij het laden al gelegd. Die kan deze knoppen dus nooit zien.
       Elke knop hieronder krijgt daarom zijn EIGEN listener. */
    var navKnoppen = [];     /* [{area, knop, badge}] */
    var inboxBadge = null;

    /* setNavActive() in beheer.html loopt bij ELKE render over
       document.querySelectorAll('.navbtn') en zet .active op basis van een
       OUDE viewnaam in data-nav. Onze knoppen dragen .navbtn (dat is de
       afspraak uit admin-ui.css: "de navigatieknoppen zelf blijven .navbtn")
       en zouden daardoor bij elke verversing hun markering verliezen — ook
       bij de 63 refresh()-aanroepen die niets met navigatie te maken hebben.
       Vandaar twee dingen: data-nav draagt de oude naam mee zodat de
       bestaande functie meestal het juiste doet, en een MutationObserver
       herstelt de markering wanneer dat niet lukt (Inbox is één werkgebied
       maar drie oude namen, en Financiën heeft er geen). */
    var LEGACY_NAV = {
      overzicht: 'vandaag',
      inbox: 'aanvragen',
      projecten: 'projects',
      relaties: 'clients',
      financien: 'financien',
      activiteit: 'log',
      instellingen: 'settings'
    };

    function bouwZijbalk() {
      leeg(zijNav);
      navKnoppen = [];
      inboxBadge = null;
      var areas = M ? arr(M.AREAS) : [];
      var scheidingGezet = false;

      areas.forEach(function (a) {
        /* de scheidingslijn komt precies één keer, op de overgang van de
           vijf werkgebieden naar Activiteit en Instellingen — niet op een
           vast getal, want dan verschuift hij zodra AREAS verandert */
        if (!a.primary && !scheidingGezet) {
          zijNav.appendChild(el('div', { class: 'navsep', 'aria-hidden': 'true' }));
          scheidingGezet = true;
        }
        var badge = null;
        var kinderen = [ico(a.key), el('span', { class: 'nl', text: str(a.label) })];
        if (a.key === 'inbox') {
          /* ÉÉN badge in de hele zijbalk. Vandaag staan er drie (Aanvragen,
             Wachtrij, Vragen) die elkaar overlappen en alle drie snooze en
             eigenaarschap negeren. */
          badge = el('span', { class: 'navbadge', text: '0' });
          /* verbergen via de eigenschap en niet via een attribuut met
             waarde: [hidden] verbergt bij ELKE waarde, ook bij "false" */
          badge.hidden = true;
          kinderen.push(badge);
          inboxBadge = badge;
        }
        var knop = el('button', {
          type: 'button',
          class: 'navbtn',
          'data-nav': LEGACY_NAV[a.key] || a.key,
          'data-area': a.key,
          onclick: function () { ga({ area: a.key }); }
        }, kinderen);
        navKnoppen.push({ area: a.key, knop: knop, badge: badge });
        zijNav.appendChild(knop);
      });
    }

    /* De route 'factuur' staat niet in AREAS (beslissing 2.2: de editor is
       een eigen scherm), maar de gebruiker is dan wél in Financiën bezig —
       vandaar de uitzondering hieronder, in plaats van een zijbalk zonder
       enige markering zodra iemand een factuur opent. */
    function tekenNavActief() {
      navKnoppen.forEach(function (n) {
        var aan = (n.area === str(huidige.area)) || (str(huidige.area) === 'factuur' && n.area === 'financien');
        /* alleen schrijven als het mis is. Dat is niet zuinigheid maar de
           voorwaarde waaronder de bewaker hieronder tot rust komt: elke
           schrijfactie is zelf weer een wijziging die hem wakker maakt. */
        if (n.knop.classList.contains('active') !== aan) n.knop.classList.toggle('active', aan);
        if (aan) n.knop.setAttribute('aria-current', 'page');
        else n.knop.removeAttribute('aria-current');
      });
    }

    var navWacht = null;
    function bewaakNavActief() {
      var g = G();
      if (!g || !g.MutationObserver) return null;
      /* aria-current staat bewust NIET in het filter: die schrijven alleen
         wij, en meeluisteren zou de bewaker op zijn eigen werk laten
         reageren */
      var obs = new g.MutationObserver(function () { tekenNavActief(); });
      obs.observe(zijNav, { attributes: true, attributeFilter: ['class'], subtree: true });
      return obs;
    }

    /* De knop draagt drie standen en dus drie namen. Ze staan hier bij elkaar
       omdat ze anders uit de pas lopen: het icoon wordt op de ene plek gezet
       en het aria-label op de andere, en dan zegt een schermlezer
       "inklappen" terwijl er een kruisje staat. */
    function tekenZijToggle() {
      var paneel = paneelModus();
      var ingeklapt = zij.classList.contains('collapsed');
      var label = paneel ? 'Menu sluiten' : (ingeklapt ? 'Zijbalk uitklappen' : 'Zijbalk inklappen');
      var naam = paneel ? 'sluiten' : (ingeklapt ? 'chevron' : 'terug');
      zijToggle.setAttribute('aria-label', label);
      zijToggle.setAttribute('title', label);
      /* aria-expanded hoort bij inklappen en niet bij sluiten: in paneelstand
         is de menuknop in de topbalk degene die de open/dicht-stand draagt,
         en twee elementen die hetzelfde claimen is er één te veel */
      if (paneel) zijToggle.removeAttribute('aria-expanded');
      else zijToggle.setAttribute('aria-expanded', ingeklapt ? 'false' : 'true');
      /* DE UITLIJNING STAAT HIER NIET MEER. In de ingeklapte rail van 68px
         hoort de knop gecentreerd te staan en in de uitgeklapte zijbalk op de
         linkerlijn van de navigatie, maar dat is vorm en geen stand: het
         stijlblad regelt het met .u-side.collapsed .u-side-foot. Deze functie
         gaat alleen nog over wat de knop BETEKENT — zijn drie namen en zijn
         icoon. */
      leeg(zijToggle);
      var i = icoVorm(naam, 16);
      /* zonder componentbibliotheek geen icoon; een lege knop is geen knop,
         dus dan staat er tenminste een teken */
      if (i) zijToggle.appendChild(i);
      else zijToggle.textContent = paneel ? '×' : (ingeklapt ? '»' : '«');
    }

    function zetIngeklapt(aan, doorGebruiker) {
      zij.classList.toggle('collapsed', !!aan);
      tekenZijToggle();
      if (doorGebruiker) keuzeGemaakt = true;
    }

    /* ---------- 3a-bis. het uitschuifpaneel onder 700px ----------
       Hoofdstuk 6, vijfde niveau. De vorm stond klaar in admin-ui.css; dit is
       de uitvoerder. Alles wat een paneel met een waas nodig heeft staat hier
       bij elkaar: openen, sluiten, focus erheen, focus terug, en een val die
       de tab-volgorde binnenhoudt zolang het paneel over de pagina ligt. */

    function paneelModus() { return !!(mqTelefoon && mqTelefoon.matches); }
    function zijpaneelOpen() { return zij.classList.contains('open'); }

    var FOCUSBAAR = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function focusbareIn(wortel) {
      var uit = [];
      if (!wortel || !wortel.querySelectorAll) return uit;
      var lijst = wortel.querySelectorAll(FOCUSBAAR);
      for (var i = 0; i < lijst.length; i++) {
        var n = lijst[i];
        if (n.hidden || n.disabled) continue;
        /* een knop die nergens een rechthoek heeft (display:none uit een
           mediaquery) mag de val niet vullen — dan springt de focus naar iets
           onzichtbaars en is hij voor de gebruiker gewoon weg */
        if (n.getClientRects && !n.getClientRects().length) continue;
        uit.push(n);
      }
      return uit;
    }

    /* De focusval. Hij hangt op het paneel zelf en niet op document: zolang
       de randen dichtzitten kan de focus er niet uit, en een luisteraar minder
       op document is er één minder die bij het demonteren kan blijven hangen.
       Staat het paneel dicht, dan doet deze functie niets — ook boven 700px,
       waar de zijbalk gewoon een kolom is en tabben er dwars doorheen hoort. */
    function opTabInPaneel(e) {
      if (e.key !== 'Tab' || !zijpaneelOpen()) return;
      var lijst = focusbareIn(zij);
      if (!lijst.length) { e.preventDefault(); focusOp(zij); return; }
      var eerste = lijst[0];
      var laatste = lijst[lijst.length - 1];
      var nu = document.activeElement;
      if (e.shiftKey && (nu === eerste || nu === zij)) { e.preventDefault(); focusOp(laatste); return; }
      if (!e.shiftKey && nu === laatste) { e.preventDefault(); focusOp(eerste); }
    }

    /* De focus MOET het paneel in. Het ligt over de pagina; wie hem opent en
       daarna tabt, zou anders de knoppen bedienen die eronder liggen en die
       hij niet meer ziet.

       MEET OF HET GELUKT IS, want focusOp() zegt alleen dat focus() geen
       fout gaf. Dat is hier niet genoeg: .u-side gaat van hidden naar visible
       via een overgang van .3s, en op het eerste moment ná het zetten van
       .open staat de zichtbaarheid nog op hidden. focus() doet dan niets en
       de focus blijft stil achter op de pagina eronder. Vandaar dat deze
       functie twee keer loopt — nu en na de eerste frame — en dat hij meteen
       stopt zodra de focus binnen staat. */
    function focusInPaneel() {
      if (!zijpaneelOpen()) return;
      if (binnen(document.activeElement, zij)) return;
      if (focusOp(zij) && document.activeElement === zij) return;
      var f = focusbareIn(zij);
      if (f.length) focusOp(f[0]);
    }

    /* De waas dekt de pagina af voor de muis en de focusval dekt hem af voor
       het toetsenbord, maar een schermlezer loopt met zijn eigen cursor
       gewoon door de topbalk en de inhoud eronder heen. Daarom gaat de
       werkkolom uit de leesvolgorde zolang het paneel erover ligt.

       DE VOORWAARDE IS GEEN NETHEID MAAR EEN HARDE EIS: aria-hidden op een
       voorouder van het element dat de focus heeft, is ongeldig en laat
       schermlezers raden. Dus alleen verbergen als de focus AL binnen het
       paneel staat — en bij het sluiten weer tevoorschijn halen vóórdat de
       focus teruggaat. */
    function zetAchtergrondVerborgen(aan) {
      if (!aan) { werkkolom.removeAttribute('aria-hidden'); return; }
      /* de vraag opnieuw stellen, want deze functie loopt ook op een timer:
         wie binnen die 60ms al doornavigeerde, mag geen verborgen werkkolom
         overhouden op een pagina zonder paneel */
      if (!zijpaneelOpen()) return;
      if (!binnen(document.activeElement, zij)) return;
      werkkolom.setAttribute('aria-hidden', 'true');
    }

    function openZijpaneel() {
      if (!paneelModus() || zijpaneelOpen()) return;
      zij.classList.add('open');
      scrim.classList.add('open');
      menuKnop.setAttribute('aria-expanded', 'true');
      menuKnop.setAttribute('aria-label', 'Menu sluiten');
      menuKnop.setAttribute('title', 'Menu sluiten');
      tekenZijToggle();
      focusInPaneel();
      zetAchtergrondVerborgen(true);
      var g = G();
      if (g && fn(g.setTimeout)) {
        g.setTimeout(function () {
          focusInPaneel();
          zetAchtergrondVerborgen(true);
        }, 60);
      }
    }

    /* sluitZijpaneel(herstelFocus)
       herstelFocus=true  bij Escape, de waas en de sluitknop: de focus gaat
                          terug naar de menuknop waar hij vandaan kwam.
       herstelFocus=false bij een navigatie: dan verhuist de focus even later
                          toch naar de kop van de nieuwe pagina, en hem eerst
                          naar de menuknop trekken zou hem twee keer
                          verplaatsen. */
    function sluitZijpaneel(herstelFocus) {
      if (!zijpaneelOpen()) return;
      var lag = binnen(document.activeElement, zij);
      zij.classList.remove('open');
      scrim.classList.remove('open');
      menuKnop.setAttribute('aria-expanded', 'false');
      menuKnop.setAttribute('aria-label', 'Menu openen');
      menuKnop.setAttribute('title', 'Menu openen');
      tekenZijToggle();
      /* eerst de werkkolom terug in de leesvolgorde, dan pas de focus: een
         focus zetten binnen een tak die nog aria-hidden draagt, is precies de
         ongeldige stand die zetAchtergrondVerborgen() vermijdt */
      zetAchtergrondVerborgen(false);
      /* de focus mag niet achterblijven op een knop die zojuist
         visibility:hidden werd — dan staat hij stil op <body> */
      if (herstelFocus && lag && !menuKnop.hidden) focusOp(menuKnop);
    }

    /* De keuze van de gebruiker wint van de mediaquery, maar wordt NIET
       opgeslagen: de verbouwing mag geen nieuwe opslagsleutel introduceren
       (risico 4 uit het plan — bouw uitsluitend op de bestaande datalaag). */
    var keuzeGemaakt = false;
    var mqTablet = media('(min-width:700px) and (max-width:1099.98px)');
    var mqTelefoon = media('(max-width:699.98px)');

    function volgTabletbreedte() {
      if (keuzeGemaakt) return;
      zetIngeklapt(!!(mqTablet && mqTablet.matches), false);
    }

    /* ---------- 3b. topbalk ---------- */

    /* De menuknop. Hij staat vóór het kruimelpad en dus helemaal links: dat
       is de plek waar een uitschuifpaneel vandaan komt en waar een duim hem
       kan bereiken. Boven 700px staat hij op hidden — daar is de zijbalk
       gewoon zichtbaar en zou een menuknop liegen over wat er te openen valt.
       Hij draagt zelf de open/dicht-stand (aria-expanded) en wijst met
       aria-controls naar het paneel.

       .u-side-open IS DE STIJLHAAK EN HOORT ER DUS BIJ. admin-ui.css mikt op
       drie plekken op die klasse: .u-topbar .u-side-open op display:none
       boven 700px, dezelfde kiezer op display:inline-flex binnen de
       mediaquery eronder, en het printblok dat hem samen met de topbalk
       wegneemt. Zonder de klasse raakte geen van de drie iets, en was de knop
       boven 700px alleen onzichtbaar doordat beide gastheren toevallig een
       [hidden]{display:none !important} hebben staan — dat is toeval en geen
       ontwerp, en op de afdruk viel hij helemaal buiten de boot. Het
       hidden-attribuut hieronder blijft daarnaast staan: dat haalt de knop
       ook uit de tabvolgorde en uit de leesvolgorde, en dat kan display:none
       uit een mediaquery niet garanderen zodra iemand die query overschrijft. */
    var menuKnop = el('button', {
      type: 'button',
      class: 'u-iconbtn u-side-open',
      'aria-label': 'Menu openen',
      /* title en aria-label zeggen hetzelfde en blijven dat ook zeggen, in
         beide standen — een tooltip die "Menu" zegt terwijl een schermlezer
         "Menu sluiten" hoort, is twee namen voor één knop */
      title: 'Menu openen',
      'aria-expanded': 'false',
      'aria-controls': 'cp-zijbalk',
      onclick: function () {
        if (zijpaneelOpen()) sluitZijpaneel(true);
        else openZijpaneel();
      }
    }, menuTeken());
    menuKnop.hidden = true;

    var kruimelVak = el('div', { class: 'u-topbar-grow' });

    var zoekVeld = (U && fn(U.searchField)) ? U.searchField({
      label: 'Zoek een klant, project, factuur of fabriek',
      placeholder: 'Zoeken',
      onZoek: function (tekst) { zoekOpnieuw(tekst); },
      /* DE plek waar een zoektreffer geopend wordt. De rijen dragen hun bron
         mee (zie zoekOpnieuw) en geen eigen onKies, zodat er niet twee wegen
         naast elkaar bestaan waarvan er één stil nooit gelopen wordt. */
      onKies: function (r) { kiesZoekresultaat(opt(r).bron); }
    }) : el('div', { class: 'u-search' });

    var acties = el('div', { class: 'u-topbar-acts' });

    /* --- het derde slot rechts in de topbalk (hoofdstuk 3) ---
       "bel 20px, kalender 20px (of vraagteken op Overzicht)". Eén slot, twee
       knoppen, nooit allebei tegelijk: tekenTopActies() wisselt ze op de
       route. Ze staan tussen de bel en de modusbadge, in dezelfde vorm als de
       bel (.u-iconbtn, 40px rond, icoon 20px) en allebei met een naam. */

    /* De deadlinekalender is geen eigen pagina maar een kaart in de rail van
       Overzicht (admin-schermen-werk.js, "Deadlinekalender"). De eenvoudigste
       eerlijke invulling is dus: breng me daarheen. De meldregio zegt er
       hardop bij waar de kalender staat, want de focus landt op de h1 en niet
       op de kaart — die zit in de rechterkolom en die springt op deze
       breedtes onder de werkkolom. Een eigen kalendervenster nabouwen zou een
       tweede kalender opleveren naast die kaart, en twee kalenders lopen
       gegarandeerd uit de pas. */
    var kalenderKnop = iconKnopVeilig('kalender', 'Deadlinekalender', function () {
      ga({ area: 'overzicht' }, { melding: 'Overzicht. De deadlinekalender staat in de rechterkolom.' });
    });
    kalenderKnop.hidden = true;

    var hulpKnop = iconKnopVeilig('vraagteken', 'Sneltoetsen', function () { sneltoetshulp(); });
    hulpKnop.hidden = true;

    /* Op Overzicht het vraagteken, op elk ander scherm de kalender — precies
       zoals hoofdstuk 3 het slot splitst. Op Overzicht zou een kalenderknop
       naar Overzicht wijzen en dus niets doen; daar is de hulp het nuttigst,
       want dat is de pagina waar iemand binnenkomt. */
    function tekenTopActies() {
      var opOverzicht = str(huidige.area) === 'overzicht';
      kalenderKnop.hidden = opOverzicht;
      hulpKnop.hidden = !opOverzicht;
    }

    /* Op de telefoon staat .u-search op display:none — een veld van 300px
       past niet naast breadcrumb, + Nieuw, bel en gebruiker. Deze knop laat
       het veld daar tijdelijk de hele regel innemen. De inline stijl is de
       enige manier: admin-ui.css kan niet weten wanneer de gebruiker wil
       zoeken, en een inline display wint van de mediaquery. */
    var zoekKnop = (U && fn(U.iconKnop)) ? U.iconKnop('zoek', 'Zoeken', function () { zetCompactZoeken(true); }) : null;
    if (zoekKnop) zoekKnop.hidden = true;

    /* DE HELE REGEL BETEKENT DE HELE REGEL. Het kruimelpad wegzetten was niet
       genoeg: naast het veld staan ook nog + Nieuw, de bel, het derde slot,
       de modusbadge en de avatar, en die lieten er op 390px zo'n honderd
       pixels van over. Met de menuknop erbij zou dat een veld van 35px
       worden — een zoekveld waar geen zoekterm in past. Daarom gaat in deze
       tijdelijke stand ook de actierij en de menuknop weg. Alles komt terug
       zodra het veld de focus verliest (zie de blur hieronder), dus er
       verdwijnt geen bediening langer dan één zoekopdracht. */
    function zetCompactZoeken(aan) {
      if (!aan) {
        /* opruimen mag NOOIT achter de mediaquery staan: wie op de telefoon
           zoekt en dan zijn scherm draait, zou anders een kruimelpad houden
           dat voorgoed op display:none staat */
        zoekVeld.style.display = '';
        kruimelVak.style.display = '';
        acties.style.display = '';
        menuKnop.style.display = '';
        if (zoekKnop) zoekKnop.hidden = !(mqTelefoon && mqTelefoon.matches);
        return;
      }
      if (!mqTelefoon || !mqTelefoon.matches) return;
      zoekVeld.style.display = 'block';
      kruimelVak.style.display = 'none';
      acties.style.display = 'none';
      menuKnop.style.display = 'none';
      if (zoekKnop) zoekKnop.hidden = true;
      if (fn(zoekVeld.focus)) zoekVeld.focus();
    }

    if (zoekVeld && zoekVeld.input) {
      zoekVeld.input.addEventListener('blur', function () {
        /* niet meteen dichtklappen: het paneel sluit zelf op blur, en een
           keuze met de muis gebeurt op mousedown — pas daarna is dit veilig */
        setTimeout(function () { zetCompactZoeken(false); }, 120);
      });
    }

    /* --- menu's in de topbalk ---
       CP_UI.contextMenu bouwt zijn rijen bij het OPENEN, maar uit de
       itemlijst die het bij het aanmaken meekreeg. Voor menu's waarvan de
       inhoud verandert (het + Nieuw-menu draagt op de telefoon ook de
       navigatie, het belmenu draagt meldingen) wordt daarom het hele
       menu-element vervangen in plaats van de lijst bijgewerkt. Dat is
       goedkoop en het scheelt een tweede menucomponent die net even anders
       werkt dan de eerste. */
    function menuHouder(maakKnop, maakItems, menuOpts) {
      var huidig = null;
      function bouw() {
        var u = UI();
        if (!u || !fn(u.contextMenu)) return null;
        var spec = opt(menuOpts);
        return u.contextMenu({
          knop: maakKnop(),
          items: maakItems(),
          kop: spec.kop || null,
          uitlijning: spec.uitlijning || 'rechts'
        });
      }
      return {
        plaats: function (ouder) {
          huidig = bouw();
          if (huidig && ouder) ouder.appendChild(huidig.el);
        },
        herbouw: function () {
          if (!huidig || !huidig.el.parentNode) return;
          var nieuw = bouw();
          if (!nieuw) return;
          huidig.el.parentNode.replaceChild(nieuw.el, huidig.el);
          huidig = nieuw;
        },
        sluit: function () { if (huidig && fn(huidig.sluit)) huidig.sluit(); },
        isOpen: function () { return !!(huidig && huidig.isOpen && huidig.isOpen()); }
      };
    }

    var nieuwMenu = menuHouder(
      function () {
        /* de enige echte knop in de topbalk — de rest is tekst, een zacht
           vlak of een icoon (zie de toelichting bij .u-topbar) */
        return el('button', { type: 'button', class: 'btn small', text: '+ Nieuw' });
      },
      function () {
        var items = [];
        /* een kapotte itemlijst mag hooguit een leeg menu opleveren; de
           topbalk zelf moet blijven staan, anders is de hele app weg omdat
           één aanmaakactie een fout maakt */
        if (fn(o.maakItems)) { try { items = arr(o.maakItems()); } catch (e) { items = []; } }
        if (!(mqTelefoon && mqTelefoon.matches)) return items;
        /* Onder 700px is .u-side verborgen; zonder deze kop is de app dan
           onnavigeerbaar. De navigatie hangt hier onder + Nieuw, precies
           zoals admin-ui.css het aankondigt. */
        var nav = [{ kop: 'Ga naar' }];
        (M ? arr(M.AREAS) : []).forEach(function (a) {
          nav.push({
            label: str(a.label),
            ico: a.key,
            onKies: function () { ga({ area: a.key }); }
          });
        });
        if (items.length) nav.push({ scheiding: true }, { kop: 'Nieuw' });
        return nav.concat(items);
      },
      { uitlijning: 'rechts' }
    );

    var belMenu = menuHouder(
      function () {
        var u = UI();
        var knop = (u && fn(u.iconKnop)) ? u.iconKnop('bel', 'Meldingen') : el('button', { type: 'button', class: 'u-iconbtn', 'aria-label': 'Meldingen' });
        var n = tellingMeldingen();
        if (n > 0) {
          /* het AANTAL staat in het menu, niet op de knop: een getal in een
             knop van 36px is niet te lezen. De stip zegt alleen "er is iets". */
          knop.appendChild(el('span', { class: 'u-bell-dot', 'aria-hidden': 'true' }));
          knop.setAttribute('aria-label', 'Meldingen (' + n + ')');
          knop.setAttribute('title', 'Meldingen (' + n + ')');
        }
        return knop;
      },
      function () {
        var lijst = [];
        if (fn(o.meldingen)) { try { lijst = arr(o.meldingen()); } catch (e) { lijst = []; } }
        if (!lijst.length) return [{ kop: 'Geen nieuwe meldingen' }];
        return lijst.map(function (m) {
          return {
            label: str(m.label),
            hint: str(m.hint) || null,
            onKies: function () {
              if (fn(m.onKies)) { m.onKies(m); return; }
              if (m.route) ga(m.route);
            }
          };
        });
      },
      { kop: 'Meldingen', uitlijning: 'rechts' }
    );

    function tellingMeldingen() {
      if (!fn(o.meldingen)) return 0;
      try { return arr(o.meldingen()).length; } catch (e) { return 0; }
    }

    /* de compacte demo-badge. Vandaag is dit een strook van volle breedte
       tussen navigatie en inhoud; hier is het een pil in de topbalk. De
       KLIK is het belangrijkste onderdeel: erachter zit openModeStatusModal
       en dat is de ENIGE ingang naar de go-live-checklist. */
    var modusStip = el('span', { class: 'dot', 'aria-hidden': 'true' });
    var modusTekst = el('span', { text: '—' });
    var modusBadge = el('button', {
      type: 'button',
      class: 'u-demobadge',
      'aria-label': 'Omgeving en status — klik voor details',
      onclick: function () {
        if (fn(o.onModusDetails)) { o.onModusDetails(); return; }
        /* terugval: het oorspronkelijke #modeBar is meeverhuisd en draagt
           zijn eigen klikbinding nog, dus dit opent hetzelfde venster
           zonder dat beheer.html er iets voor hoeft door te geven */
        if (modeBar && fn(modeBar.click)) modeBar.click();
      }
    }, [modusStip, modusTekst]);

    /* HET GEBRUIKERSMENU, NU COMPLEET. Hoofdstuk 3 tekent deze knop als
       "avatar 36px rond + naam 15px weight 500 + chevron 16px --ink-3". Er
       stond alleen de avatar, en daardoor was de naam van de ingelogde
       gebruiker nergens te lezen én raakten drie regels in admin-ui.css
       niets: de typografie op .u-userbtn (die 15/500 is precies deze naam),
       .u-userbtn svg (de chevron) en .u-userbtn-naam in de mediaquery.

       ALLEEN INLINE ELEMENTEN BINNEN DE KNOP. Een <div> in een <button> is
       ongeldige HTML — een knop mag alleen tekstinhoud dragen — en browsers
       mogen hem er bij het parsen uit halen. Vandaar twee spans en een svg,
       en geen omhulsel eromheen.

       AVATAR EN NAAM WORDEN HERGEBRUIKT over herbouwen heen. Het menu
       vervangt bij elke herbouw() zijn hele knop, en tekenGebruiker()
       schrijft rechtstreeks in deze twee elementen; waren ze per bouw nieuw,
       dan schreef die functie in een knop die net weggegooid is.
       De chevron is per bouw wél nieuw: hij draagt geen waarde.

       OP SMAL SCHERM VERDWIJNT DE NAAM EN BLIJFT DE AVATAR STAAN. Dat is
       geen tweede pad hier: .u-userbtn .u-userbtn-naam staat onder 700px in
       admin-ui.css op display:none. Het aria-label blijft daar de volledige
       naam dragen — zichtbaar korter, hoorbaar hetzelfde. En omdat dat label
       de zichtbare naam letterlijk bevat, blijft de knop met spraakbediening
       aan te spreken met wat erop staat. */
    var avatar = el('span', { class: 'u-avatar', 'aria-hidden': 'true', text: '—' });
    var gebruikerNaam = el('span', { class: 'u-userbtn-naam' });
    var gebruikerMenu = menuHouder(
      function () {
        var g = gebruikerGegevens();
        avatar.textContent = initialen(g.naam, g.mail);
        gebruikerNaam.textContent = g.naam;
        var label = g.naam ? ('Account: ' + g.naam) : 'Account en instellingen';
        var kinderen = [avatar];
        /* geen lege span als er nog niemand is ingelogd: .u-userbtn heeft een
           gap van 10px en die zou dan als een gat naast de avatar staan */
        if (g.naam) kinderen.push(gebruikerNaam);
        /* het chevronnetje is decoratie — icon() zet er zelf aria-hidden op —
           en het is het enige van de drie dat zonder componentbibliotheek mag
           ontbreken: avatar en naam dragen de knop dan nog steeds. Een
           letterteken als terugval hangt af van het lettertype dat de
           bezoeker toevallig heeft, en een verkeerd teken naast een naam
           leest als een fout in plaats van als een uitklapper. */
        var chevron = icoVorm('chevronOmlaag', 16);
        if (chevron) kinderen.push(chevron);
        return el('button', { type: 'button', class: 'u-userbtn', 'aria-label': label, title: label }, kinderen);
      },
      function () {
        var g = gebruikerGegevens();
        var items = [];
        if (g.naam) items.push({ kop: g.naam });
        if (g.mail) items.push({ kop: g.mail });
        if (items.length) items.push({ scheiding: true });
        items.push({
          label: 'Sneltoetsen',
          hint: '?',
          onKies: function () { sneltoetshulp(); }
        });
        items.push({ scheiding: true });
        items.push({
          label: 'Uitloggen',
          onKies: function () { uitloggen(); }
        });
        return items;
      },
      { uitlijning: 'rechts' }
    );

    function gebruikerGegevens() {
      var g = opt(o.gebruiker);
      /* de opts winnen, maar de meeverhuisde elementen zijn de bron die
         beheer.html bij het inloggen vult — en dat gebeurt ná het monteren */
      var naam = str(g.naam) || (whoName ? str(whoName.textContent) : '');
      var mail = str(g.mail) || (whoMail ? str(whoMail.textContent) : '');
      if (naam === '—') naam = '';
      return { naam: naam, mail: mail };
    }

    function initialen(naam, mail) {
      var bron = str(naam) || str(mail);
      if (!bron) return '—';
      var delen = bron.replace(/[@._-]+/g, ' ').split(/\s+/).filter(function (d) { return !!d; });
      if (!delen.length) return '—';
      var s = delen[0].charAt(0);
      if (delen.length > 1) s += delen[1].charAt(0);
      return s.toUpperCase();
    }

    /* enterApp() vult #whoName en #whoMail ná het monteren; dit is de
       aanroep die de topbalk daarna bijtrekt */
    function tekenGebruiker() {
      var g = gebruikerGegevens();
      avatar.textContent = initialen(g.naam, g.mail);
      gebruikerNaam.textContent = g.naam;
      /* herbouw() hangt de naam er ook pas BIJ zodra hij er is: de knop
         wordt zonder naamspan gebouwd zolang enterApp() #whoName nog niet
         gevuld heeft, en die eerste vulling is precies waarvoor deze functie
         wordt aangeroepen */
      gebruikerMenu.herbouw();
    }

    /* de vier meeverhuizers krijgen een eigen, verborgen plek in de topbalk.
       Verborgen en niet verwijderd: paintModeBar() schrijft in #modeDot en
       #modeText, enterApp() in #whoName en #whoMail, en op #logoutBtn hangt
       de echte uitlogafhandeling. Ze blijven dus vindbaar én functioneel,
       terwijl de zichtbare topbalk hun waarden spiegelt. */
    var bewaarVak = el('span', {
      hidden: true,
      'aria-hidden': 'true',
      style: 'display:none;'
    });

    var topbalk = el('header', { class: 'u-topbar', role: 'banner' }, [
      menuKnop,
      kruimelVak,
      zoekVeld,
      acties
    ]);

    var werkkolom = el('div', { class: 'u-main' }, [topbalk]);

    /* ============================================================
       4. INHANGEN — verplaatsen, nooit opnieuw aanmaken
       ============================================================ */

    function inhangen() {
      /* eerst de meeverhuizers uit de oude markup halen, daarna pas de rest
         weggooien — andersom neemt removeChild ze mee het niets in */
      [modeBar, whoName, whoMail, logoutBtn].forEach(function (n) {
        if (n) bewaarVak.appendChild(n);
      });
      acties.appendChild(bewaarVak);

      /* #content wordt VERPLAATST. Elke renderfunctie in beheer.html houdt
         een verwijzing vast die één keer bij het laden is vastgelegd; een
         nieuw element zou betekenen dat elk scherm in het niets tekent. */
      werkkolom.appendChild(contentEl);
      if (!contentEl.getAttribute('tabindex')) contentEl.setAttribute('tabindex', '-1');

      /* wat er nu nog in de container staat is de oude omlijsting (aside.side
         en div.main). Die mag weg: de badges erin zijn losgekoppeld en de
         schrijfacties erop zijn daarna onschadelijk. */
      var overig = [];
      for (var i = 0; i < container.childNodes.length; i++) overig.push(container.childNodes[i]);
      overig.forEach(function (n) {
        if (n === zij || n === werkkolom || n === skip || n === melder || n === scrim) return;
        if (n.parentNode) n.parentNode.removeChild(n);
      });

      /* .u-shell VERVANGT .shell — ze mogen niet samen op één element staan,
         anders vindt de bestaande 820px-regel van beheer.html de nieuwe
         omlijsting alsnog en wordt de zijbalk daar een knoppenrij */
      container.classList.remove('shell');
      container.classList.add('u-shell');

      container.appendChild(zij);
      container.appendChild(werkkolom);
      container.appendChild(melder);
      /* de waas hoort NA de zijbalk in de DOM en niet ervoor: hij ligt er
         visueel onder (z-index 44 tegen 45) maar mag in de leesvolgorde niet
         vóór het paneel komen te staan */
      container.appendChild(scrim);
      /* de skiplink hoort de EERSTE tabstop van de pagina te zijn, en de
         tabvolgorde volgt de DOM-volgorde — position:fixed verandert daar
         niets aan. Vandaar vooraan invoegen en niet achteraan aanhangen. */
      container.insertBefore(skip, container.firstChild);
    }

    /* ============================================================
       5. KOP: kruimelpad, titel, badge, modus
       ============================================================ */

    function areaLabel(key) {
      var areas = M ? arr(M.AREAS) : [];
      for (var i = 0; i < areas.length; i++) { if (areas[i].key === key) return areas[i].label; }
      if (key === 'factuur') return 'Factuur';
      return 'Beheer';
    }

    function tekenKruimels(lijst) {
      var u = UI();
      leeg(kruimelVak);
      if (!lijst.length) return;
      if (!u || !fn(u.crumbs)) {
        kruimelVak.appendChild(el('span', { class: 'u-crumb-cur', text: str(lijst[lijst.length - 1].label) }));
        return;
      }
      /* een kruimel met een route wordt een KNOP en geen link. Reden: langs
         ga() loopt de navigatiewaarschuwing vóórdat de hash verandert. Een
         <a href="#/..."> zou de hash eerst wijzigen en pas daarna vragen of
         het mag; annuleren laat dan een geschiedenisregel achter die naar
         een pagina wijst waar je nooit bent geweest. */
      kruimelVak.appendChild(u.crumbs(lijst.map(function (it) {
        if (it.route && !fn(it.onKies)) {
          return { label: it.label, onKies: function () { ga(it.route); } };
        }
        return it;
      })));
    }

    function zetKruimels(items) {
      var lijst = arr(items).filter(function (i) { return isObj(i) && str(i.label); });
      if (!lijst.length) return;
      /* vanaf nu is het pad van het SCHERM de waarheid over waar je bent, en
         mag zetTitel() het niet meer overschrijven met de werkgebiednaam */
      kruimelsGezet = true;
      tekenKruimels(lijst);
    }

    function zetTitel(tekst) {
      titel = str(tekst) || titel;
      var g = G();
      if (g && g.document) g.document.title = titel ? (titel + ' — CUSTOM+ Beheer') : 'CUSTOM+ Beheer';
      if (!kruimelsGezet) tekenKruimels([{ label: titel }]);
    }

    /* de kop zoals hij er staat vóórdat het scherm iets zegt: de naam van
       het werkgebied. Een scherm dat niets doet houdt dus nog steeds een
       kloppend kruimelpad en een kloppende venstertitel. */
    function standaardKop(route) {
      kruimelsGezet = false;
      titel = '';
      zetTitel(areaLabel(str(route.area)));
    }

    function zetBadge(n) {
      var aantal = (typeof n === 'number' && n > 0) ? Math.round(n) : 0;
      if (!inboxBadge) return;
      inboxBadge.textContent = String(aantal);
      inboxBadge.hidden = aantal === 0;
      /* in ingeklapte stand is de badge een stip zonder cijfer; zonder deze
         tekst weet niemand meer hoeveel er wacht */
      var knop = null;
      navKnoppen.forEach(function (k) { if (k.area === 'inbox') knop = k.knop; });
      if (!knop) return;
      var label = aantal ? ('Inbox, ' + aantal + (aantal === 1 ? ' item' : ' items') + ' die op je wachten') : 'Inbox';
      knop.setAttribute('aria-label', label);
      knop.setAttribute('title', label);
    }

    function zetModus() {
      var m = fn(o.modus) ? opt(o.modus()) : {};
      var staat = str(m.staat);
      var tekst = str(m.tekst);
      /* terugval op de meeverhuisde strook: zolang beheer.html paintModeBar()
         nog zelf aanroept is #modeDot de eerlijkste bron, en dan hoeft de
         integratie niets extra's door te geven */
      if (!staat && modeBar) {
        var dot = modeBar.querySelector('.dot');
        if (dot) {
          if (dot.classList.contains('bad')) staat = 'bad';
          else if (dot.classList.contains('warn')) staat = 'warn';
          else if (dot.classList.contains('ok')) staat = 'ok';
        }
      }
      if (!tekst) tekst = (str(m.mode) === 'live') ? 'Live' : 'Demo';
      modusStip.className = 'dot' + (staat ? ' ' + staat : '');
      modusTekst.textContent = tekst;
      var vol = tekst;
      if (modeBar) {
        var lang = str(modeBar.textContent).replace(/\s+/g, ' ').trim();
        if (lang) vol = lang;
      }
      modusBadge.setAttribute('title', vol);
      modusBadge.setAttribute('aria-label', vol + ' — klik voor details');
    }

    /* ============================================================
       6. ZOEKEN

       openJumpBar() bestaat compleet en werkt; wat eraan ontbreekt is dat
       het een modal is (dus niet permanent), dat het alleen klanten en
       projecten kent, en dat een schermlezer niet hoort dat er resultaten
       zijn. Hier is het een permanent veld in de topbalk, gevuld uit
       zoekBronnen() — vier soorten, want de opdracht vraagt letterlijk om
       klanten, projecten, facturen en fabrieken.
       ============================================================ */

    function zoekOpnieuw(tekst) {
      var q = str(tekst).trim().toLowerCase();
      if (!q) { if (fn(zoekVeld.zetResultaten)) zoekVeld.zetResultaten([]); return; }
      zoekTeller++;
      var mijn = zoekTeller;
      bronnen().then(function (lijst) {
        /* een trage bron mag nooit een nieuwere zoekterm overschrijven —
           hetzelfde principe als het render-token, één laag lager */
        if (mijn !== zoekTeller) return;
        var hits = arr(lijst).filter(function (e) {
          if (!isObj(e)) return false;
          return (str(e.label) + ' ' + str(e.sub)).toLowerCase().indexOf(q) > -1;
        }).slice(0, 12);
        /* het resultaat draagt alleen zijn BRON mee en geen eigen onKies:
           CP_UI.searchField gebruikt de globale onKies (hierboven bij het
           aanmaken) zodra een rij er zelf geen heeft, dus zo blijft er
           precies één plek waar een zoektreffer geopend wordt */
        if (fn(zoekVeld.zetResultaten)) zoekVeld.zetResultaten(hits.map(function (e) {
          return { label: str(e.label), sub: str(e.sub), bron: e };
        }));
      }, function () {
        if (mijn !== zoekTeller) return;
        if (fn(zoekVeld.zetResultaten)) zoekVeld.zetResultaten([]);
      });
    }

    function bronnen() {
      if (zoekCache) return Promise.resolve(zoekCache);
      if (!fn(o.zoekBronnen)) return Promise.resolve([]);
      var uit;
      try { uit = o.zoekBronnen(); } catch (e) { return Promise.resolve([]); }
      return Promise.resolve(uit).then(function (lijst) {
        zoekCache = arr(lijst);
        return zoekCache;
      });
    }

    function kiesZoekresultaat(e) {
      if (!isObj(e)) return;
      if (fn(e.onKies)) { e.onKies(e); return; }
      if (e.route) ga(e.route);
      else if (e.view) legacyGo(e.view);
    }

    /* ============================================================
       7. NAVIGATIEWAARSCHUWING

       registreerGuard(fn): fn geeft een tekst terug als er onopgeslagen werk
       is, en null als er niets aan de hand is.

       BELANGRIJKE AFSPRAAK: bij elke navigatie EN elke verversing wordt de
       lijst geleegd vlak vóórdat het nieuwe scherm getekend wordt. Het
       scherm dat de guard registreerde bestaat daarna namelijk niet meer, en
       een achtergebleven guard zou de app permanent blokkeren met een
       waarschuwing over werk dat allang weg is. Een scherm registreert zijn
       guard dus tijdens het tekenen, elke keer opnieuw.
       ============================================================ */

    function registreerGuard(f) {
      if (!fn(f)) return;
      if (guards.indexOf(f) > -1) return;
      guards.push(f);
    }
    function verwijderGuard(f) {
      var i = guards.indexOf(f);
      if (i > -1) guards.splice(i, 1);
    }
    function eersteTreffer() {
      for (var i = 0; i < guards.length; i++) {
        var t = null;
        try { t = guards[i](); } catch (e) { t = null; }
        if (str(t)) return str(t);
      }
      return null;
    }

    function vraagBevestiging(tekst) {
      if (fn(o.bevestig)) {
        var uit;
        try { uit = o.bevestig(tekst); } catch (e) { uit = true; }
        return Promise.resolve(uit).then(function (v) { return !!v; }, function () { return false; });
      }
      var g = G();
      /* geen enkele manier om te vragen: dan gaat de navigatie door. Voor
         altijd blokkeren is erger dan de waarschuwing overslaan, en in een
         browser bestaat confirm altijd. */
      if (!g || !fn(g.confirm)) return Promise.resolve(true);
      return Promise.resolve(!!g.confirm(tekst));
    }

    function opBeforeUnload(e) {
      var t = eersteTreffer();
      if (!t) return;
      /* de browser toont zijn eigen tekst; onze melding kan hier niet in,
         maar zonder deze twee regels sluit het tabblad zonder één vraag */
      e.preventDefault();
      e.returnValue = '';
      return '';
    }

    /* ============================================================
       8. ROUTER

       Hash-routing als DUNNE LAAG om onNavigeer() heen. De hash wordt pas
       NA een geslaagde tekening geschreven: een adresbalk die al de nieuwe
       route toont terwijl het scherm nog de oude is, liegt precies op het
       moment dat iemand de link kopieert.
       ============================================================ */

    function normaliseer(r) {
      if (!M) return isObj(r) ? r : { area: 'overzicht', sub: null, id: null, tab: null, params: {} };
      return M.parseRoute(M.buildRoute(r));
    }

    function huidigeHash() {
      var g = G();
      return (g && g.location) ? str(g.location.hash) : '';
    }

    function schrijfHash(route, vervang) {
      var g = G();
      if (!g || !g.location || !M) return;
      var raw = M.buildRoute(route);
      laatsteHash = raw;
      if (huidigeHash() === raw) return;
      if (vervang) {
        /* een herstel (eerste lading, terugknop, normalisatie van een
           handmatig getypte hash) mag geen extra geschiedenisregel maken,
           anders moet de gebruiker twee keer terug voor één stap */
        try { g.history.replaceState(null, '', raw); }
        catch (err) { g.location.replace(raw); }
      } else {
        g.location.hash = raw;
      }
    }

    function herstelHash() {
      var g = G();
      if (!g || !g.location || !M) return;
      var raw = M.buildRoute(huidige);
      laatsteHash = raw;
      if (huidigeHash() === raw) return;
      try { g.history.replaceState(null, '', raw); }
      catch (err) { g.location.replace(raw); }
    }

    /* ga(route, opts) — de enige weg naar een andere pagina.
         vervang         geen extra geschiedenisregel (eerste lading, herstel,
                         het rechtzetten van een handmatig getypte hash)
         guardOverslaan  de navigatiewaarschuwing overslaan
         behoudScroll    niet naar boven springen
         behoudFocus     de focus laten staan waar hij staat
         melding         wat de aria-live-regio moet zeggen. Een deelnavigatie
                         (een filterchip, een tabblad) kondigt hiermee zelf aan
                         wat er veranderde — 'Nieuw, 12 items'. Zonder dit veld
                         hoorde een schermlezer bij elke chipklik alleen weer
                         dezelfde paginanaam, en nooit het aantal treffers. */
    function ga(route, gaOpts) {
      var go = opt(gaOpts);
      var doel = normaliseer(route);
      if (go.guardOverslaan) return teken(doel, go);
      var melding = eersteTreffer();
      if (!melding) return teken(doel, go);
      return vraagBevestiging(melding).then(function (ok) {
        if (!ok) {
          /* afbreken is niet genoeg: kwam de navigatie van de terugknop, dan
             staat de nieuwe hash er al en zou de adresbalk een pagina tonen
             waar de gebruiker net besloot niet heen te gaan */
          herstelHash();
          return false;
        }
        return teken(doel, go);
      });
    }

    function teken(doel, go) {
      token++;
      var mijn = token;
      guards = [];                    /* zie hoofdstuk 7 */
      huidigeKop = null;              /* het scherm meldt zijn kop opnieuw aan */
      sluitMenus();
      /* het uitschuifpaneel gaat dicht zodra er genavigeerd wordt: een menu
         dat over de nieuwe pagina blijft liggen is geen menu meer maar een
         gordijn. Zonder focusherstel — de focus verhuist hieronder toch naar
         de kop van de nieuwe pagina. */
      sluitZijpaneel(false);
      zoekCache = null;               /* data kan intussen gewijzigd zijn */
      selectieWaarde = null;
      huidige = doel;
      tekenNavActief();
      tekenTopActies();
      standaardKop(doel);

      var p = null;
      if (fn(o.onNavigeer)) {
        try { p = o.onNavigeer(doel); } catch (e) { p = null; }
      }
      return Promise.resolve(p).then(afronden, afronden);

      /* afronden dient als beide takken van de Promise. Een mislukte
         tekening wordt hier bewust NIET gemeld: render() in beheer.html
         eindigt al op .catch(showError) en toont zijn eigen foutkaart. Wat
         hier telt is dat de shell ook dán netjes afsluit, want anders blijft
         de kop op de vorige pagina staan. */
      function afronden() {
        if (!tokenGeldig(mijn)) return false;
        /* setNavActive() in beheer.html heeft tijdens het tekenen over onze
           knoppen heen geschreven; hier staat de markering weer goed. De
           bewaker uit hoofdstuk 3 vangt de verversingen op die niet langs de
           shell lopen. */
        tekenNavActief();
        /* ook na een mislukte tekening wordt de hash geschreven: het scherm
           toont dan de foutkaart van showError(), en een hash die naar de
           vorige route wijst zou over die situatie liegen */
        schrijfHash(doel, !!go.vervang);
        if (!go.behoudScroll) {
          var g = G();
          if (g && fn(g.scrollTo)) g.scrollTo(0, 0);
        }
        if (!go.behoudFocus) focusInhoud();
        /* De paginanaam melden hoort bij een ECHTE paginawissel. Een
           deelnavigatie houdt de focus staan (behoudFocus) en tekent hooguit
           een deel van het scherm opnieuw; daar 'Inbox' herhalen vertelt
           niemand wat er zojuist veranderde. Zo'n navigatie geeft daarom een
           eigen melding mee, of hij zwijgt. */
        if (str(go.melding)) meld(go.melding);
        else if (!go.behoudFocus) meld(titel);
        return true;
      }
    }

    function ververs() {
      if (!fn(o.onNavigeer)) return Promise.resolve(false);
      var g = G();
      var y = (g && typeof g.scrollY === 'number') ? g.scrollY : 0;
      token++;
      var mijn = token;
      guards = [];
      zoekCache = null;
      var p = null;
      try { p = o.onNavigeer(huidige); } catch (e) { p = null; }
      return Promise.resolve(p).then(klaar, klaar);
      function klaar() {
        if (!tokenGeldig(mijn)) return false;
        tekenNavActief();
        /* geen focusverplaatsing en geen sprong naar boven: een verversing
           is geen paginawissel en mag niemand uit zijn veld tikken */
        if (g && fn(g.scrollTo)) g.scrollTo(0, y);
        return true;
      }
    }

    function opHashChange() {
      var h = huidigeHash();
      if (h === laatsteHash) return;          /* onze eigen schrijfactie */
      if (M && huidige && M.routeEquals(h, huidige)) { laatsteHash = h; return; }
      ga(M ? M.parseRoute(h) : {}, { vervang: true });
    }

    /* start() leest de hash bij het laden. Bewust NIET in monteer(): de app
       mag pas navigeren als er iemand is ingelogd, en dat weet alleen
       beheer.html. Roep dit aan in plaats van go({name:'vandaag'}) na het
       inloggen — anders gooit het inloggen elke gedeelde link weg. */
    function start() {
      gestart = true;
      var h = huidigeHash();
      var doel = M ? M.parseRoute(h) : {};
      /* vervang:true — de eerste route mag geen geschiedenisregel maken,
         anders leidt één keer terug naar dezelfde pagina */
      return ga(doel, { vervang: true, guardOverslaan: true });
    }

    /* ============================================================
       9. FOCUS EN MELDEN
       ============================================================ */

    /* zetKop(kop) — het scherm geeft de kop van CP_UI.pageHeader door, en de
       shell bewaart hem tot de volgende tekening. Dat is de afspraak die
       pageHeader zelf aankondigt ('de shell roept na elke navigatie
       focusTitel() aan'): de kop weet waar zijn h1 zit, en de shell hoeft de
       opbouw van dat component dan niet met een querySelector na te bouwen. */
    function zetKop(kop) {
      huidigeKop = (kop && fn(kop.focusTitel)) ? kop : null;
    }

    function focusInhoud(kop) {
      var k = (kop && fn(kop.focusTitel)) ? kop : huidigeKop;
      if (k) {
        /* focusTitel() geeft zelf niets terug, dus meten in plaats van
           aannemen — zelfde reden als bij focusOp(): een kop die intussen
           uit de DOM is, laat de focus stil op <body> achter */
        k.focusTitel();
        if (k.titelEl && document.activeElement === k.titelEl) return true;
      }
      /* Terugval voor elk scherm dat nog geen pageHeader gebruikt — en dat
         zijn er voorlopig elf, want de handgebouwde .pagehead-instanties
         staan nog in beheer.html. Een pagina zonder h1 valt terug op #content
         zelf, dat daarom bij het inhangen een tabindex kreeg. */
      var h1 = contentEl.querySelector('h1[tabindex="-1"]') || contentEl.querySelector('h1');
      if (h1 && focusOp(h1)) return true;
      return focusOp(contentEl);
    }

    function meld(tekst) {
      if (!str(tekst)) return;
      /* eerst legen: dezelfde tekst twee keer achter elkaar wordt anders
         niet als wijziging gezien en dus niet uitgesproken */
      melder.textContent = '';
      var g = G();
      var zet = function () { melder.textContent = str(tekst); };
      if (g && fn(g.setTimeout)) g.setTimeout(zet, 60); else zet();
    }

    /* ============================================================
       10. SNELTOETSEN

       De listener staat in de CAPTURE-fase. Dat is de enige manier om cmd+K
       naar het zoekveld te sturen zolang de bestaande listener van
       beheer.html nog openJumpBar() opent: capture loopt altijd vóór bubble,
       ongeacht de volgorde waarin de twee geregistreerd zijn.

       De bestaande bewaking blijft ONGEWIJZIGD gelden en staat vooraan:
       geen enkele sneltoets vuurt terwijl de focus in een invoerveld staat
       of terwijl er een dialoog open is. Snelzoeken vanuit een modal is
       geen use case, en een halve fotobatch weggooien met een toetsaanslag
       is precies wat die guard moet voorkomen. Escape hoort daar sinds deze
       ronde bij. Hij was de enige uitzondering, en juist daardoor gooide hij
       een half getypt antwoord weg in plaats van het paneel te sluiten waar
       de gebruiker in stond — zie de toelichting bij opToets().
       ============================================================ */

    var GA_NAAR = { o: 'overzicht', i: 'inbox', p: 'projecten', r: 'relaties', f: 'financien' };
    var wachtOpG = false;
    var gTimer = null;

    function inVeld() {
      var t = document.activeElement;
      if (!t) return false;
      var tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    }

    function dialoogOpen() {
      if (fn(o.modaalOpen)) {
        try { if (o.modaalOpen()) return true; } catch (e) { /* een kapotte melder mag de app niet blokkeren */ }
      }
      /* terugval zonder koppeling: openModal() in beheer.html hangt een
         .overlay aan body en haalt hem bij het sluiten weer weg */
      return !!document.querySelector('.overlay');
    }

    /* Rollen die Escape ZELF afhandelen en hem dus nooit van de shell mogen
       verliezen. Een menu sluit zichzelf, een combobox sluit eerst zijn
       resultatenlijst en leegt pas bij de tweede Escape het veld
       (CP_UI.searchField), en een listbox laat een keuze los. Alle drie
       zitten ze een laag DIEPER dan het paneel eromheen: wie in het zoekveld
       staat verwacht dat Escape de resultaten sluit, niet dat het hele
       detailpaneel eronder dichtklapt. */
    var ESC_EIGEN_ROLLEN = { menu: true, combobox: true, listbox: true };

    function inEigenEscape() {
      var t = document.activeElement;
      if (!t) return false;
      var p = t;
      while (p) {
        if (p.getAttribute && ESC_EIGEN_ROLLEN[str(p.getAttribute('role'))]) return true;
        p = p.parentNode;
      }
      return false;
    }

    /* Staat de laag echt open? Een scherm dat een isOpen() meegaf is de beste
       bron. Zonder die functie valt de shell terug op de DOM — dezelfde
       terugval-zonder-koppeling als bij dialoogOpen(): CP_UI.masterDetail zet
       .detail-open op zijn wortelelement, en het filterpaneel van fase 10
       krijgt .u-drawer.open. Is er niets van dat alles te vinden, dan is de
       laag dicht en houdt de gebruiker zijn Escape. */
    var LAAG_KIEZER = { drawer: '.u-drawer.open', detail: '.u-md.detail-open' };

    function laagOpen(soort) {
      var laag = lagen[soort];
      if (!laag || !fn(laag.sluit)) return false;
      if (fn(laag.isOpen)) {
        try { return !!laag.isOpen(); } catch (e) { return false; }
      }
      return !!document.querySelector(LAAG_KIEZER[soort]);
    }

    function sluitLaag(soort) {
      var laag = lagen[soort];
      if (laag && fn(laag.sluit)) laag.sluit();
    }

    function sluitMenus() {
      nieuwMenu.sluit();
      belMenu.sluit();
      gebruikerMenu.sluit();
    }

    function stopG() {
      wachtOpG = false;
      if (gTimer) { clearTimeout(gTimer); gTimer = null; }
    }

    function sneltoetshulp() {
      if (fn(o.onSneltoetshulp)) { o.onSneltoetshulp(); return; }
      /* geen eigen venster nabouwen: openShortcutHelp() bestaat al compleet
         en een tweede lijst zou meteen uit de pas gaan lopen */
    }

    function focusZoek() {
      if (mqTelefoon && mqTelefoon.matches) { zetCompactZoeken(true); return; }
      if (fn(zoekVeld.focus)) zoekVeld.focus();
    }

    function opToets(e) {
      if (!sneltoetsenAan) return;
      if (dialoogOpen()) return;

      /* ESCAPE. Twee regels, en de volgorde ertussen is het hele punt.

         1. HET VELD EERST. Escape in een invoerveld, een textarea, een select
            of een contenteditable is van dat veld en van niemand anders.
            Stond de laagafhandeling hiervoor — en dat stond hij — dan gooide
            één Escape midden in een half getypt antwoord het detailpaneel
            dicht, navigeerde ?item= leeg en was de tekst stil weg. Dat is
            precies het dataverlies dat deze verbouwing moet wegnemen, dus
            hier gaat de shell er vanaf en laat hij de toets doorlopen naar
            het component zelf. Hetzelfde geldt voor een menu, een combobox
            en een listbox: die handelen Escape zelf af.
         2. EEN LAAG KRIJGT ESCAPE PAS ALS HIJ OPEN STAAT. Een scherm meldt
            zijn detaillaag onvoorwaardelijk aan bij het tekenen, niet pas bij
            het openen. Zonder deze vraag slikt de shell dus élke Escape op de
            pagina — preventDefault en stopPropagation inbegrepen — voor een
            paneel dat misschien helemaal dicht is. */
      if (e.key === 'Escape') {
        if (inVeld() || inEigenEscape()) return;
        if (nieuwMenu.isOpen() || belMenu.isOpen() || gebruikerMenu.isOpen()) {
          e.preventDefault(); e.stopPropagation();
          sluitMenus();
          return;
        }
        /* het uitschuifpaneel ligt met z-index 45 boven alles wat er verder
           op de pagina staat, dus het krijgt Escape vóór het filterpaneel en
           vóór het detailpaneel. Het staat NIET in `lagen`: dat register is
           er voor lagen die een SCHERM aanmeldt, en dit paneel is van de
           shell zelf. */
        if (zijpaneelOpen()) { e.preventDefault(); e.stopPropagation(); sluitZijpaneel(true); return; }
        if (laagOpen('drawer')) { e.preventDefault(); e.stopPropagation(); sluitLaag('drawer'); return; }
        if (laagOpen('detail')) { e.preventDefault(); e.stopPropagation(); sluitLaag('detail'); return; }
        return;
      }

      if (inVeld()) { stopG(); return; }

      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopPropagation();     /* de springbalk-modal blijft dicht */
        focusZoek();
        return;
      }
      if (e.altKey || e.metaKey || e.ctrlKey) return;

      if (e.key === '?') {
        e.preventDefault(); e.stopPropagation();
        sneltoetshulp();
        return;
      }

      if (wachtOpG) {
        var doel = GA_NAAR[str(e.key).toLowerCase()];
        stopG();
        if (doel) { e.preventDefault(); e.stopPropagation(); ga({ area: doel }); }
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        e.stopPropagation();
        wachtOpG = true;
        /* een halve sneltoets mag niet blijven hangen: wie g typt en zich
           bedenkt, moet niet drie schermen verder per ongeluk springen */
        gTimer = setTimeout(function () { wachtOpG = false; gTimer = null; }, 1500);
        return;
      }
      /* alles wat hier komt (j, k, Enter, a, s, m) laten we bewust met rust:
         dat is de lijstlaag van beheer.html en die moet exact blijven werken */
    }

    /* ============================================================
       11. COMPATIBILITEITSLAAG oud <-> nieuw

       De 31 bestaande go()-aanroepen blijven werken zonder herschrijven, en
       de storage-listener (cross-tab-verversing vanuit portal.html) blijft
       kunnen vragen "gaat dit mij aan". Die listener vergelijkt vandaag hard
       op 'questions', 'log', 'vandaag' en 'aanvragen' en breekt STIL zodra
       die namen verdwijnen — geen fout, geen melding, alleen een beheer dat
       niet meer meebeweegt met het portaal.
       ============================================================ */

    function legacyGo(view) {
      if (!M) return Promise.resolve(false);
      return ga(M.legacyViewToRoute(view));
    }
    function legacyView() {
      if (!M) return { name: 'vandaag' };
      return M.routeToLegacyView(huidige);
    }
    function isLegacyView(naam) {
      if (!M) return false;
      return arr(M.LEGACY_VIEW_NAMES).indexOf(str(naam)) > -1;
    }
    /* raaktView('questions') === "hoort de pagina waar ik nu sta bij wat dat
       oude scherm liet zien". Dat is iets anders dan gelijkheid: Aanvragen,
       Wachtrij en Vragen zijn samen één Inbox geworden, dus alle drie de
       oude namen raken dezelfde route. */
    function raaktView(naam) {
      if (!M) return false;
      var r = M.legacyViewToRoute({ name: str(naam) });
      if (str(r.area) !== str(huidige.area)) return false;
      if (r.sub && str(r.sub) !== str(huidige.sub)) return false;
      return true;
    }

    /* ============================================================
       12. UITLOGGEN EN RESETTEN

       Vandaag reset het uitloggen helemaal niets. Met routes, een
       Inbox-selectie en een navigatiewaarschuwing wordt dat meteen
       zichtbaar: de volgende gebruiker landt op het dossier van de vorige,
       of loopt tegen een waarschuwing aan over een factuur die hij nooit
       heeft geopend.
       ============================================================ */

    function reset() {
      guards = [];
      huidigeKop = null;
      lagen.drawer = null;
      lagen.detail = null;
      selectieWaarde = null;
      zoekCache = null;
      zoekTeller++;
      token++;                       /* elke lopende tekening is nu ongeldig */
      gestart = false;
      stopG();
      sluitMenus();
      /* zonder focusherstel: er is zo meteen geen ingelogde gebruiker meer en
         de menuknop is dan niet de plek waar de focus hoort */
      sluitZijpaneel(false);
      zetBadge(0);
      huidige = M ? M.parseRoute('') : { area: 'overzicht', sub: null, id: null, tab: null, params: {} };
      tekenNavActief();
      tekenTopActies();
      standaardKop(huidige);
      if (zoekVeld && zoekVeld.input) zoekVeld.input.value = '';
      if (fn(zoekVeld.zetResultaten)) zoekVeld.zetResultaten([]);
      zetCompactZoeken(false);
      /* de hash gaat mee terug naar de landing: blijft #/relaties/klanten/cl-2
         staan, dan opent de volgende inlog dat dossier meteen weer */
      herstelHash();
    }

    function uitloggen() {
      var melding = eersteTreffer();
      var vervolg = function () {
        reset();
        if (fn(o.onUitloggen)) { o.onUitloggen(); return; }
        /* terugval: op het meeverhuisde #logoutBtn hangt de echte
           uitlogafhandeling van beheer.html nog steeds */
        if (logoutBtn && fn(logoutBtn.click)) logoutBtn.click();
      };
      if (!melding) { vervolg(); return; }
      vraagBevestiging(melding).then(function (ok) { if (ok) vervolg(); });
    }

    /* ============================================================
       13. OPBOUWEN EN AANHAKEN
       ============================================================ */

    bouwZijbalk();
    inhangen();

    if (zoekKnop) acties.appendChild(zoekKnop);
    nieuwMenu.plaats(acties);
    belMenu.plaats(acties);
    /* hoofdstuk 3: ná de bel en vóór de modusbadge. Er staat er altijd
       precies één van de twee zichtbaar — zie tekenTopActies(). */
    acties.appendChild(kalenderKnop);
    acties.appendChild(hulpKnop);
    acties.appendChild(modusBadge);
    gebruikerMenu.plaats(acties);
    /* het bewaarvak achteraan: het is onzichtbaar en mag de tabvolgorde van
       de zichtbare bediening niet doorsnijden */
    acties.appendChild(bewaarVak);

    volgTabletbreedte();
    tekenZijToggle();
    tekenNavActief();
    tekenTopActies();
    standaardKop(huidige);
    zetModus();
    tekenGebruiker();
    /* de focusval hangt op het paneel zelf en doet niets zolang het dicht is;
       hij hoeft dus niet aan- en uitgezet te worden bij elke breedtewissel */
    zij.addEventListener('keydown', opTabInPaneel);

    navWacht = bewaakNavActief();

    var g0 = G();
    if (g0 && fn(g0.addEventListener)) {
      g0.addEventListener('hashchange', opHashChange);
      g0.addEventListener('beforeunload', opBeforeUnload);
    }
    document.addEventListener('keydown', opToets, true);
    /* met naam en niet anoniem: een anonieme luisteraar is bij het
       demonteren niet meer te verwijderen, en dan schrijft de oude shell na
       een tweede monteer() bij elke breedtewissel in losgekoppelde DOM */
    function zetPaneelbediening() {
      var paneel = paneelModus();
      if (zoekKnop) zoekKnop.hidden = !paneel;
      /* de menuknop en de waas bestaan alléén in paneelstand. Daarboven is de
         zijbalk een gewone kolom: een menuknop zou dan een paneel beloven dat
         er niet is, en de waas zou een leeg element in de flexrij worden. */
      menuKnop.hidden = !paneel;
      scrim.hidden = !paneel;
      if (!paneel) sluitZijpaneel(false);
      tekenZijToggle();
    }

    function opTelefoonbreedte() {
      zetPaneelbediening();
      zetCompactZoeken(false);
      /* het + Nieuw-menu draagt op de telefoon óók de navigatie; die moet
         verschijnen en verdwijnen op het moment dat de zijbalk dat doet */
      nieuwMenu.herbouw();
      volgTabletbreedte();
    }
    opMedia(mqTablet, volgTabletbreedte);
    opMedia(mqTelefoon, opTelefoonbreedte);
    zetPaneelbediening();

    function demonteer() {
      if (afgebroken) return;
      afgebroken = true;
      if (g0 && fn(g0.removeEventListener)) {
        g0.removeEventListener('hashchange', opHashChange);
        g0.removeEventListener('beforeunload', opBeforeUnload);
      }
      document.removeEventListener('keydown', opToets, true);
      /* de twee mediaqueries leven zolang de pagina leeft; blijven deze
         luisteraars hangen, dan reageert elke oude shell op elke volgende
         breedtewissel mee */
      afMedia(mqTablet, volgTabletbreedte);
      afMedia(mqTelefoon, opTelefoonbreedte);
      /* het paneel mag niet open blijven staan over een shell die niet meer
         luistert: dan ligt er een gordijn over de pagina dat met geen enkele
         toets nog dichtgaat. De focusval gaat in dezelfde beweging weg. */
      sluitZijpaneel(false);
      zij.removeEventListener('keydown', opTabInPaneel);
      if (navWacht && fn(navWacht.disconnect)) navWacht.disconnect();
      stopG();
      guards = [];
      if (gemonteerd === handvat) gemonteerd = null;
    }

    var handvat = {
      ga: ga,
      route: function () { return huidige; },
      start: start,
      ververs: ververs,
      reset: reset,

      zetBadge: zetBadge,
      zetTitel: zetTitel,
      zetKruimels: zetKruimels,
      zetModus: zetModus,
      zetKop: zetKop,
      focusInhoud: focusInhoud,
      meld: meld,

      registreerGuard: registreerGuard,
      verwijderGuard: verwijderGuard,

      /* Escape sluit menu, dan drawer, dan detail. De twee onderste lagen
         kent de shell niet uit zichzelf — een filterpaneel en een
         detailpaneel horen bij het scherm — dus meldt het scherm zijn
         sluitfunctie hier aan.

         isOpen is optioneel maar wel het eerlijkste antwoord: een scherm
         meldt zijn laag één keer aan bij het tekenen en niet pas bij het
         openen, dus zonder die vraag zou de shell elke Escape opslokken voor
         een paneel dat dicht staat. Ontbreekt isOpen, dan kijkt laagOpen()
         zelf in de DOM (.u-md.detail-open, .u-drawer.open). */
      registreerLaag: function (soort, sluit, isOpen) {
        if (soort !== 'drawer' && soort !== 'detail') return;
        var f = fn(sluit);
        lagen[soort] = f ? { sluit: f, isOpen: fn(isOpen) } : null;
      },
      verwijderLaag: function (soort) {
        if (soort !== 'drawer' && soort !== 'detail') return;
        lagen[soort] = null;
      },

      /* de selectie van een lijst-met-detail leeft bij de shell en niet bij
         het component: alleen zo overleeft hij een verversing, en alleen zo
         weet het uitloggen dat hij weg moet */
      zetSelectie: function (v) { selectieWaarde = (v === undefined) ? null : v; },
      selectie: function () { return selectieWaarde; },

      zoekbronnenVerlopen: function () { zoekCache = null; },
      tekenGebruiker: tekenGebruiker,
      verversMeldingen: function () { belMenu.herbouw(); },
      isGestart: function () { return gestart; },

      tokenNu: tokenNu,
      tokenGeldig: tokenGeldig,

      legacyGo: legacyGo,
      legacyView: legacyView,
      isLegacyView: isLegacyView,
      raaktView: raaktView,

      zetSneltoetsenActief: zetSneltoetsenActief,

      el: container,
      zijbalkEl: zij,
      topbalkEl: topbalk,
      inhoudEl: contentEl,
      demonteer: demonteer
    };

    gemonteerd = handvat;
    return handvat;
  }

  /* ============================================================
     14. LOSSE EXPORTS

     Deze delegeren naar de gemonteerde shell. Ze bestaan omdat de
     aanroepers ze zonder handvat nodig hebben: de storage-listener, de 31
     go()-aanroepen en elke renderfunctie die na een ophaalactie wil weten
     of zijn tekening nog geldig is. Zonder shell doen ze niets in plaats
     van te klappen — het beheer moet ook draaien terwijl de verbouwing
     halverwege is.
     ============================================================ */

  function actief() { return gemonteerd; }

  function delegeer(naam, standaard) {
    return function (a, b) {
      if (!gemonteerd || !fn(gemonteerd[naam])) return standaard;
      return gemonteerd[naam](a, b);
    };
  }

  return {
    VERSION: VERSION,

    monteer: monteer,
    actief: actief,

    ga: delegeer('ga', Promise.resolve(false)),
    route: delegeer('route', null),
    start: delegeer('start', Promise.resolve(false)),
    ververs: delegeer('ververs', Promise.resolve(false)),
    reset: delegeer('reset', undefined),

    zetBadge: delegeer('zetBadge', undefined),
    zetTitel: delegeer('zetTitel', undefined),
    zetKruimels: delegeer('zetKruimels', undefined),
    zetModus: delegeer('zetModus', undefined),
    zetKop: delegeer('zetKop', undefined),
    focusInhoud: delegeer('focusInhoud', false),
    meld: delegeer('meld', undefined),

    registreerGuard: delegeer('registreerGuard', undefined),
    verwijderGuard: delegeer('verwijderGuard', undefined),
    registreerLaag: delegeer('registreerLaag', undefined),
    verwijderLaag: delegeer('verwijderLaag', undefined),

    zetSelectie: delegeer('zetSelectie', undefined),
    selectie: delegeer('selectie', null),
    zoekbronnenVerlopen: delegeer('zoekbronnenVerlopen', undefined),
    tekenGebruiker: delegeer('tekenGebruiker', undefined),
    verversMeldingen: delegeer('verversMeldingen', undefined),
    /* zonder shell is er niets gestart; false is dan geen gebrek aan
       informatie maar het juiste antwoord */
    isGestart: delegeer('isGestart', false),

    /* het render-token hoort NIET bij een instantie: een bouwer die zijn
       token bewaarde vóór het opnieuw monteren, moet daarna te horen
       krijgen dat hij verlopen is */
    tokenNu: tokenNu,
    tokenGeldig: tokenGeldig,

    legacyGo: delegeer('legacyGo', Promise.resolve(false)),
    legacyView: function () {
      if (gemonteerd) return gemonteerd.legacyView();
      return { name: 'vandaag' };
    },
    isLegacyView: function (naam) {
      var m = MODEL();
      if (!m) return false;
      var lijst = arr(m.LEGACY_VIEW_NAMES);
      return lijst.indexOf(str(naam)) > -1;
    },
    /* zonder shell is er geen huidige route; false is dan het eerlijke
       antwoord op "gaat dit mij aan" — de cross-tab-verversing slaat één
       ronde over in plaats van een scherm te verversen dat er niet is */
    raaktView: delegeer('raaktView', false),

    zetSneltoetsenActief: zetSneltoetsenActief
  };
});
