/* CUSTOM+ — de twee "beheerschermen" van het KLANTPORTAAL:
   Activiteit en Instellingen (window.CP_PORTAAL_SCHERMEN).
   ------------------------------------------------------------------
   WAARVOOR DIT BESTAND BESTAAT
   Het klantportaal wordt herbouwd op precies dezelfde lagen als het beheer
   (CP_UI, CP_CHART, CP_MODEL, CP_SHELL) en krijgt hetzelfde beeld. Dit
   bestand levert de twee werkgebieden onder de scheidingslijn in de
   zijbalk — de tegenhangers van admin-schermen-beheer.js:

     CP_PORTAAL_SCHERMEN.activiteit           #/activiteit[/<filter>]
     CP_PORTAAL_SCHERMEN.instellingen         #/instellingen
     CP_PORTAAL_SCHERMEN.instellingCategorie  #/instellingen/<categorie>

   portal.html (kKiesScherm) kiest de categoriepagina zodra de route een
   tab draagt, en het overzicht wanneer niet — exact zoals het beheer dat
   doet. De vier categorieën staan in CATEGORIEEN en zijn ook naar buiten
   gezet (CP_PORTAAL_SCHERMEN.INSTELLING_CATEGORIEEN), zodat een zoekbalk
   of een test dezelfde vier namen en routes gebruikt als dit bestand.

   HET SCHERMCONTRACT (zie het montageblok in portal.html)
   Elk scherm is een functie (ctx) → element, of → Promise van een element.
   Het scherm is puur: selectie en tabkeuze komen uit ctx.route, de data
   uit ctx.bundle / ctx.projecten / ctx.data, de handelingen uit
   ctx.acties. Dit bestand schrijft NOOIT zelf: elke knop roept een naam
   uit het actiecontract aan (contactpersoonOpslaan,
   contactpersoonVerwijderen, meldingenOpslaan, taalKiezen, downloadAlles)
   en toont bij een verworpen Promise de Nederlandse boodschap via een
   toast. Tijdens het wachten is de knop uitgeschakeld en meldt een
   aria-live-regio (statusRegio) de toestand.

   MEERTALIGHEID — DE ENE AFSPRAAK DIE HET GROOTSTE DEEL VERKLAART
   Elke klantzichtbare tekst hier is een NEDERLANDSE BRONSTRING die door
   ctx.i18nT of ctx.i18nTpl gaat; de vertalingen leven in portal/i18n.js.
   Data (namen, e-mailadressen, productnamen, de regels uit het
   toegangslogboek) gaat NIET door i18nT en krijgt data-no-i18n, zodat de
   DOM-pass van portal.html hem met rust laat. Bronstrings zijn hele
   zinnen met {plaatshouders}; nooit aan elkaar geplakte stukjes.

   ACTIVITEIT — WAT DE KLANT ZIET EN WAAROM PRECIES DAT
   De tijdlijn komt uit CP_PORTAAL.activiteitVoorKlant. Die filter is een
   beveiligingsgrens (mail-logboek, auditlogboek, contactmomenten en
   concepten gaan er al bij de ingang uit) en dit bestand voegt daar GEEN
   eigen bron aan toe. Wat dit bestand wél doet is de rijen in zes
   klantbegrippen indelen — Alles, Updates, Foto's, Berichten, Betalingen,
   Zendingen — want "klant / systeem / bestanden / financieel" zijn
   beheerwoorden. De indeling leest de oorspronkelijke logregel terug op
   id (assetKind, action) en anders de vaste id-vormen van mergeActivity;
   wat nergens in past is een Update. De donut in de rail verschijnt pas
   bij tien gebeurtenissen: een verdeling over drie rijen is geen
   verdeling.

   RONDE 3 (adviezen 1, 5, 6, 9, 28, 29) — WAT ER SINDSDIEN ANDERS IS
   · Elke rij draagt hetzelfde dunne lijnicoon uit CP_UI.icon op een
     neutrale tegel; de gekleurde stip op de lijn is weg.
   · "Open het product" staat alleen onder een rij in de VOLLE stand én als
     de klant meer dan één product heeft; Berichten/Betalingen/Bestanden
     houden hun link altijd (refVoor).
   · Datums in tekst komen uit CP_PORTAAL.datumKortDelen ('8 sep', met
     jaartal buiten het lopende jaar), de weekdag is kort ('di'); bedragen
     gaan door CP_PORTAAL.geldKlant. Allebei met terugval op wat er stond.
   · Elke kaart heeft hoogstens één zin uitleg; de rest staat achter een
     "i"-knop (uitleg(), het aria-expanded-patroon van CP_UI.stageList).
     Elke lege stand is één regel.

   INSTELLINGEN — HET OMGEKEERDE OPSLAGMODEL, MET TWEE UITZONDERINGEN
   Jouw mensen en Meldingen bufferen: elke wijziging zet dirty, de
   zwevende opslagbalk (CP_UI.saveBar) verschijnt, en pas op "Wijzigingen
   opslaan" wordt er geschreven. Weglopen met onopgeslagen werk loopt langs
   ctx.registreerGuard. Taal slaat DIRECT op — het is een handeling, geen
   formulier — en Download alles ook.

   WAT HIER BEWUST NIET STAAT (eerlijkheid gaat vóór volledigheid)
   · Er bestaat geen inlogregel in het toegangslogboek. "Waar je bent
     ingelogd" toont daarom de apparaten uit de handelingen die de klant
     zélf deed (de apparaat-tag die portal.html achter elke eigen logregel
     zet), en zegt dat er ook bij.
   · De datalaag kent geen toegangslog over ALLE producten; het scherm
     leest het logboek van het product dat open staat en benoemt dat.
   · Over de regio van de live database wordt niets beweerd: config en
     migraties zeggen er niets over.
   · "Mag inloggen" op een contactpersoon is een wens: het maakt geen
     account aan. Het formulier zegt dat met zoveel woorden.

   ACTIVITEIT ALS INBOUWBLOK
   De tijdlijn is een bouwsteen, activiteitBlok(ctx, opties), en het scherm
   Activiteit is dat blok in zijn volle stand (kop, filtertabs, donutrail).
   Het productdetail in portaal-schermen-werk.js zet hetzelfde blok compact
   in een tab: alleen de lijst, begrensd op een aantal rijen met "Toon
   alles". Eén lijstbouwer, dus geen tweede tijdlijn die kan afwijken.

   MELDINGEN IN DRIE STANDEN
   Boven de zes soorten mail staat een keuze uit Alles, Alleen belangrijk
   en Zelf kiezen. Die stand is GEEN opgeslagen veld: hij wordt afgeleid uit
   de zes vinkjes (mailStandVan), zodat meldingenOpslaan en het datamodel
   ongewijzigd blijven en de stand ook klopt voor een klant die Steffan in
   het beheer instelde. Dezelfde kiezer staat per contactpersoon in Jouw
   mensen.

   Publieke API (globalThis.CP_PORTAAL_SCHERMEN krijgt de drie schermen en
   het blok erbij; module.exports in Node draagt alles):
     VERSION
     activiteit(ctx) / instellingen(ctx) / instellingCategorie(ctx)
     activiteitBlok(ctx, opties)  de tijdlijn als element; opties:
                                  {project, compact, max, filter, onFilter}
     CATEGORIEEN                de vier categorieën (key, label, icoon, …)
     ACT_FILTERS                de zes filters van Activiteit
     soortVan(rij, logIndex, eventIndex)   de indeling, los testbaar
     MAIL_STANDEN / BELANGRIJK  de drie standen en de drie belangrijke sleutels
     mailStandVan(waarden, cats)  de afgeleide stand, los testbaar

   LADEN
     browser : <script src="portal/portaal-schermen-beheer.js"></script>
               ná admin-ui.js, admin-charts.js, admin-model.js,
               portaal-model.js en portaal-data.js. Het bestand vult
               CP_PORTAAL_SCHERMEN AAN en overschrijft nooit een scherm
               van een ander bestand.
     node    : require-baar voor tests; het factory-lichaam raakt bij het
               laden geen document aan.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();

  /* AANVULLEN, NOOIT OVERSCHRIJVEN. De overige vijf schermen komen uit
     twee andere bestanden en de laadvolgorde ligt niet vast. */
  if (!root.CP_PORTAAL_SCHERMEN) root.CP_PORTAAL_SCHERMEN = {};
  root.CP_PORTAAL_SCHERMEN.activiteit = api.activiteit;
  /* de tijdlijn als bouwsteen voor het productdetail (portaal-schermen-werk.js) */
  root.CP_PORTAAL_SCHERMEN.activiteitBlok = api.activiteitBlok;
  root.CP_PORTAAL_SCHERMEN.instellingen = api.instellingen;
  root.CP_PORTAAL_SCHERMEN.instellingCategorie = api.instellingCategorie;
  root.CP_PORTAAL_SCHERMEN.INSTELLING_CATEGORIEEN = api.CATEGORIEEN;

  /* geen "type":"module" in dit project: in Node is dit CJS en dus een
     echte export, in een browser bestaat `module` niet */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     0. KALE HULPJES EN DE CONTEXT
     ============================================================ */

  function arr(v) { return Array.isArray(v) ? v : []; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function opt(v) { return isObj(v) ? v : {}; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function fn(v) { return typeof v === 'function' ? v : null; }
  function heeft(o, k) { return isObj(o) && Object.prototype.hasOwnProperty.call(o, k); }
  function pad2(n) { return (n < 10 ? '0' : '') + String(n); }

  function G() {
    try { return (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : null); }
    catch (e) { return null; }
  }

  /* diepe kopie voor de buffers. JSON volstaat: contactpersonen en
     voorkeuren zijn tekst, waar/onwaar en lijsten. Klapt het toch, dan de
     waarde zelf — een verwijzing in de buffer is beter dan geen formulier. */
  function kloon(v) {
    if (v === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  function sleutelsVan(o) {
    var uit = [];
    if (!isObj(o)) return uit;
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) uit.push(k);
    return uit;
  }

  /* de terugval voor i18nTpl wanneer een test het scherm zonder ctx.i18nTpl
     aanroept: zelfde vulling als CP_STATUS.fill */
  function vulTpl(tpl, vars) {
    return str(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars && vars[k] !== undefined && vars[k] !== null) ? String(vars[k]) : m;
    });
  }

  /* MEETEN IN PLAATS VAN RADEN: elke bibliotheek heeft één functie die
     alleen zij heeft, en die functie is het bewijs. Zo maakt het niet uit
     of de montage ze als ctx.ui/ctx.chart/… doorgeeft of dat ze alleen op
     globalThis staan (een test). */
  function bibliotheek(kandidaat, globaleNaam, merker) {
    if (isObj(kandidaat) && fn(kandidaat[merker])) return kandidaat;
    var g = G();
    var k = g ? g[globaleNaam] : null;
    return (isObj(k) && fn(k[merker])) ? k : null;
  }

  function context(ctx) {
    var c = opt(ctx);
    var T = fn(c.i18nT) || function (s) { return str(s); };
    var Tpl = fn(c.i18nTpl) || function (s, v) { return vulTpl(T(s), v); };
    return {
      ui: bibliotheek(c.ui, 'CP_UI', 'pageHeader'),
      chart: bibliotheek(c.chart, 'CP_CHART', 'donut'),
      model: bibliotheek(c.model, 'CP_MODEL', 'mergeActivity'),
      portaal: bibliotheek(c.portaal, 'CP_PORTAAL', 'activiteitVoorKlant'),
      data: bibliotheek(c.data, 'CP_PORTAAL_DATA', 'listContacts'),
      T: T,
      Tpl: Tpl,
      route: isObj(c.route) ? c.route : {},
      nu: str(c.nu) || new Date().toISOString(),
      lang: str(c.lang) || 'nl',
      locale: str(c.locale) || 'nl-NL',
      fmtDate: fn(c.fmtDate),
      fmtDateShort: fn(c.fmtDateShort),
      stageLabel: fn(c.stageLabel),
      ga: fn(c.ga),
      ververs: fn(c.ververs),
      guard: fn(c.registreerGuard),
      meld: fn(c.meld),
      zetKruimels: fn(c.zetKruimels),
      acties: opt(c.acties),
      klant: opt(c.klant),
      bundle: isObj(c.bundle) ? c.bundle : null,
      projecten: arr(c.projecten),
      voorvertoning: !!c.voorvertoning
    };
  }

  /* ÉÉN HAAK UIT HET ACTIECONTRACT, of null. De regel is even kort als
     hard: eerst vragen of hij bestaat, dan pas de knop tekenen. Zo kan er
     geen knop ontstaan die stil niets doet. */
  function haak(c, naam) { return fn(opt(c.acties)[str(naam)]); }

  /* zonder CP_UI is er geen el() en dus geen scherm: dan een kale, leesbare
     melding in plaats van een uitzondering die de shell meeneemt */
  function noodScherm(tekst) {
    var d = (typeof document !== 'undefined') ? document.createElement('div') : null;
    if (!d) return null;
    d.textContent = str(tekst);
    return d;
  }

  /* de route als tekst; zonder routemodel valt hij terug op de kale hash,
     zodat een link altijd ergens heen wijst */
  function routeNaar(c, spec, terugval) {
    if (c.model && fn(c.model.buildRoute)) return c.model.buildRoute(spec);
    return str(terugval);
  }
  function tabUit(c, terugval) {
    if (c.model && fn(c.model.tabOf)) return str(c.model.tabOf(c.route, terugval));
    var p = opt(c.route.params);
    return str(c.route.tab || p.tab || terugval);
  }
  function ga(c, spec, terugval) {
    if (!c.ga) return;
    c.ga(routeNaar(c, spec, terugval));
  }

  /* DATA KRIJGT data-no-i18n. De DOM-pass van portal.html vertaalt elke
     tekstnode die hij tegenkomt; een klantnaam of productnaam die toevallig
     gelijk is aan een Nederlandse sleutel zou dan van tekst wisselen. */
  function alsData(node) {
    if (node && node.setAttribute) node.setAttribute('data-no-i18n', '');
    return node;
  }

  /* KAART. admin-ui.css geeft .u-card bewust geen padding (er zitten ook
     rijenlijsten in); een kaart met lopende inhoud heeft die wél nodig.
     Zelfde inline-attribuut als admin-schermen-beheer.js, om dezelfde reden. */
  function kaart(ui, kinderen, extraKlasse) {
    return ui.el('div', {
      class: 'u-card' + (extraKlasse ? ' ' + extraKlasse : ''),
      style: 'padding:22px;'
    }, kinderen);
  }

  /* VELD. Label bóven het veld (mockup 5.10); .field/.flabel/.input krijgen
     hun vorm uit admin-ui.css en portaal-skin.css 1d. */
  function veldVak(ui, label, control, hint) {
    return ui.el('label', { class: 'field' }, [
      ui.el('span', { class: 'flabel', text: str(label) }),
      control,
      str(hint) ? ui.el('span', { class: 'u-sub', style: 'display:block;margin-top:6px;', text: str(hint) }) : null
    ]);
  }

  /* ÉÉN ZIN OP DE KAART, DE REST ACHTER EEN "i" (ronde 3, advies 1).
     CP_UI heeft geen helpHint en geen popover; wat het wél heeft is de
     uitklapper van stageList: een .u-iconbtn met aria-expanded en
     aria-controls naar een verborgen blok. Precies dat patroon, één keer
     hier, zodat elke kaart dezelfde knop en hetzelfde gedrag krijgt. De
     lange uitleg staat gewoon in de DOM (verborgen), dus wie de knop opent
     leest hem op zijn plaats — niets wordt bijgeladen of gepositioneerd,
     en op een telefoon valt er niets buiten het scherm.
       opts.zin     de ene zin (al vertaald)
       opts.meer    de rest: één tekst of een lijst zinnen (al vertaald)
       opts.klasse  'u-lees' (standaard) of 'u-sub'
       opts.stijl   extra stijl op het blok
       opts.data    de zin bevat data (e-mailadres) en krijgt data-no-i18n
     Zonder `meer` is het alleen de zin; zonder zin niets. */
  var uitlegTeller = 0;
  function uitleg(c, opts) {
    var ui = c.ui;
    var o = opt(opts);
    var zin = str(o.zin);
    if (!zin) return null;
    var meer = (Array.isArray(o.meer) ? o.meer : [o.meer]).map(str).filter(function (s) { return !!s; });
    var zinEl = ui.el('span', { text: zin });
    if (o.data) alsData(zinEl);
    /* de flexrij en de marge tekent de skin (10l); de leesbreedte staat daar
       niet in en blijft hier */
    var kop = ui.el('p', { class: str(o.klasse) || 'u-lees', style: 'max-width:66ch;' }, [zinEl]);
    var blok = ui.el('div', { class: 'k-uitleg', style: str(o.stijl) || null }, [kop]);
    if (!meer.length) return blok;

    uitlegTeller += 1;
    var vakId = 'k-uitleg-' + uitlegTeller;
    var vak = ui.el('div', { id: vakId, class: 'k-uitleg-meer' }, meer.map(function (s, i) {
      return ui.el('p', { class: 'u-sub', text: s });
    }));
    /* dicht beginnen: een uitleg die open staat is geen "i"-knop maar
       gewoon de lange tekst die we net weghaalden */
    vak.hidden = true;
    var knop = ui.iconKnop('vraagteken', c.T('Meer uitleg'), function () {
      var open = vak.hidden;
      vak.hidden = !open;
      knop.setAttribute('aria-expanded', open ? 'true' : 'false');
    }, 'k-uitleg-knop');
    knop.setAttribute('aria-expanded', 'false');
    knop.setAttribute('aria-controls', vakId);
    /* de knop van 40px staat in een tekstregel van ~22px; de negatieve
       marges geven die hoogte terug, zoals portaal-skin.css dat voor
       .u-link doet — het beeld verschuift geen pixel, het tikvlak blijft */
    /* de skin (hoofdstuk 10, .k-uitleg-knop) bepaalt de plek; negatieve marges
       hier werkten haar tegen en lieten de knop boven de alinea uitsteken */
    kop.appendChild(ui.el('span', { text: ' ' }));
    kop.appendChild(knop);
    blok.appendChild(vak);
    return blok;
  }

  /* CP_UI.sectionHead zet de telling als .u-count direct achter de h2-tekst
     zonder marge; dezelfde pleister als in admin-schermen-beheer.js */
  function sectiekop(ui, opts) {
    var node = ui.sectionHead(opts);
    var tel = node.querySelector ? node.querySelector('h2 .u-count') : null;
    if (tel && tel.style) tel.style.marginLeft = '8px';
    return node;
  }

  /* een categoriekaart is een <a>; er staat nergens een
     text-decoration-regel voor .u-setcard. Zelfde pleister als het beheer. */
  function geenOnderstreping(node) {
    if (node && node.style) node.style.textDecoration = 'none';
    return node;
  }

  function toast(c, tekst) {
    if (c.ui && fn(c.ui.toast)) c.ui.toast(str(tekst));
  }

  /* de Nederlandse boodschap van een verworpen Promise, door i18nT; een
     fout zonder tekst krijgt de meegegeven terugval */
  function foutTekst(c, e, terugval) {
    var m = '';
    if (typeof e === 'string') m = e;
    else if (e && e.message) m = str(e.message);
    return c.T(m || terugval || 'Er ging iets mis. Probeer het opnieuw.');
  }

  /* DE ARIA-LIVE-REGIO VAN EEN SCHERM. Elke knop die op een Promise wacht
     meldt hier zijn toestand ("Bezig met opslaan…", "Opgeslagen"). Eerst
     legen, dan met een kleine vertraging zetten: dezelfde tekst twee keer
     achter elkaar wordt anders niet als wijziging gezien en niet
     uitgesproken (zelfde recept als CP_SHELL.meld). */
  function statusRegio(ui) {
    var n = ui.el('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    return alsData(n);
  }
  function meldIn(regio, tekst) {
    if (!regio) return;
    regio.textContent = '';
    var g = G();
    var zet = function () { regio.textContent = str(tekst); };
    if (g && fn(g.setTimeout)) g.setTimeout(zet, 60); else zet();
  }

  /* een knop op slot tijdens het wachten; aria-busy zodat een schermlezer
     het verschil hoort tussen "uit" en "even wachten" */
  function zetBezig(knop, aan) {
    if (!knop) return;
    knop.disabled = !!aan;
    knop.setAttribute('aria-busy', aan ? 'true' : 'false');
  }

  /* de aria-labels die CP_UI zelf in het Nederlands zet, alsnog vertalen:
     de DOM-pass van portal.html vertaalt attributen alleen als de hele
     tekst een sleutel is, dus 'Meer acties bij: Sanne' blijft anders
     Nederlands. Alleen waar een component geen optie voor heeft. */
  function vertaalAttribuut(node, selector, attribuut, tekst) {
    var n = (node && node.querySelector) ? (node.matches && node.matches(selector) ? node : node.querySelector(selector)) : null;
    if (n) n.setAttribute(attribuut, str(tekst));
    return node;
  }

  /* ---- datum en tijd, in de taal van de klant ----------------------
     ÉÉN DATUMVORM (ronde 3, advies 6). Elke datum in tekst — de dagkolom
     van de tijdlijn, "laatst gebruikt op …" — komt uit
     CP_PORTAAL.datumKortDelen: '8 sep' in het lopende jaar, '8 sep 2025'
     daarbuiten, met de maand als NL bronstring door T() zodat een Engelse
     klant 'Sep' leest. Die functie wordt parallel gebouwd; ontbreekt ze,
     dan de opmaak van de browser in ctx.locale, de vorm die hier stond.
     De ONTLEDING blijft bij CP_MODEL.dateParts (kale dag letterlijk,
     tijdstempel met Z naar lokale tijd — de enige lezing in het project). */
  function delen(c, iso) {
    if (c.model && fn(c.model.dateParts)) return c.model.dateParts(iso) || null;
    var d = new Date(str(iso));
    if (isNaN(d.getTime())) return null;
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), hh: d.getHours(), mm: d.getMinutes(), hasTime: true };
  }
  function datumObj(c, iso) {
    var p = delen(c, iso);
    if (!p) return null;
    return new Date(p.y, p.m - 1, p.d, p.hh || 0, p.mm || 0);
  }
  function dagNaam(c, iso) {
    var d = datumObj(c, iso);
    if (!d) return '';
    var s = '';
    try { s = d.toLocaleDateString(c.locale, { weekday: 'long' }); } catch (e) { s = ''; }
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  /* de weekdag als kort label ('di'), zoals de dagkolom hem nu draagt.
     Geen bibliotheek in het project kent de korte vorm, dus dezelfde
     browseropmaak als de lange, en die lange als terugval. 'Di.' (de) en
     'mar.' (fr) verliezen hun punt; de hoofdletter blijft zoals de taal
     hem geeft. */
  function weekdagKort(c, iso) {
    var d = datumObj(c, iso);
    if (!d) return '';
    var s = '';
    try { s = d.toLocaleDateString(c.locale, { weekday: 'short' }); } catch (e) { s = ''; }
    s = str(s).replace(/\.$/, '');
    return s || dagNaam(c, iso);
  }
  function datumBrowser(c, iso) {
    var d = datumObj(c, iso);
    if (!d) return '';
    try { return d.toLocaleDateString(c.locale, { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', ''); }
    catch (e) { return str(iso).slice(0, 10); }
  }
  function datumKort(c, iso) {
    var P = c.portaal;
    if (P && fn(P.datumKortDelen)) {
      var d = null;
      try { d = P.datumKortDelen(iso, c.nu); } catch (e) { d = null; }
      if (isObj(d) && d.dag && str(d.maand)) {
        var vars = { dag: d.dag, maand: c.T(str(d.maand)), jaar: d.jaar || '' };
        /* twee sjablonen en geen gelijmde stukjes: een Engelse vertaling
           mag '{maand} {dag}' zeggen */
        return d.jaar ? c.Tpl('{dag} {maand} {jaar}', vars) : c.Tpl('{dag} {maand}', vars);
      }
    }
    return datumBrowser(c, iso);
  }
  /* een kale dag krijgt GEEN verzonnen 00:00: zonder tijd in de bron staat
     er geen tijd op het scherm (zelfde belofte als CP_MODEL.formatDateTime) */
  function tijdTekst(c, iso) {
    var p = delen(c, iso);
    if (!p || !p.hasTime) return '';
    var d = datumObj(c, iso);
    try { return d.toLocaleTimeString(c.locale, { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return pad2(p.hh) + ':' + pad2(p.mm); }
  }
  function dagISO(c, iso) {
    if (c.model && fn(c.model.dayISO)) return str(c.model.dayISO(iso));
    return str(iso).slice(0, 10);
  }

  /* ---- bedragen, in de vorm van de klant (ronde 3, advies 5) ----------
     CP_PORTAAL.geldKlant schrijft '€ 3.125' voor een heel bedrag en
     '€ 3.125,50' daarbuiten. De tijdlijn kent bedragen op twee plaatsen:
     de factuurregels die mergeActivity afleidt (daar hangt het bedrag aan
     de factuur in de bundel) en de zinnen die de server bij een klantactie
     schreef ('Betaling gemeld op factuur …: € 1.875,00 op 3 sep 2026'). Die
     zin is data en blijft data; alleen het BEDRAG erin wordt opnieuw
     geschreven — zelfde getal, zelfde valuta, andere vorm. Zonder geldKlant
     blijft alles zoals het was: geen bedrag bij de factuurregel en de
     serverzin ongemoeid (CP_MODEL exporteert zijn formatCents niet, dus
     een tweede formatter is er in het portaal niet en wordt hier ook niet
     nagebouwd). */
  var BEDRAG_RE = /(€|\$|£)\s?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?!\d)/g;
  var SYMBOOL_VALUTA = { '€': 'EUR', '$': 'USD', '£': 'GBP' };
  function geldKlant(c, cents, valuta) {
    var n = (typeof cents === 'number') ? cents : parseInt(str(cents), 10);
    if (isNaN(n) || !isFinite(n)) return '';
    if (!(c.portaal && fn(c.portaal.geldKlant))) return '';
    try { return str(c.portaal.geldKlant(n, valuta)); } catch (e) { return ''; }
  }
  function bedragenKlant(c, tekst) {
    var s = str(tekst);
    if (!s || !(c.portaal && fn(c.portaal.geldKlant))) return s;
    return s.replace(BEDRAG_RE, function (m, sym, heel, rest) {
      var n = parseInt(heel.replace(/\./g, ''), 10) * 100 + parseInt(rest, 10);
      if (isNaN(n)) return m;
      return geldKlant(c, n, SYMBOOL_VALUTA[sym] || 'EUR') || m;
    });
  }
  /* het bedrag van een factuur: totaal, anders het losse bedrag; nooit
     iets bij 0 of onbekend */
  function factuurCents(inv) {
    var t = parseInt(str(opt(inv).totalCents), 10);
    if (!(t > 0)) t = parseInt(str(opt(inv).amountCents), 10);
    return (t > 0) ? Math.round(t) : 0;
  }

  function indexeer(lijst, sleutel) {
    var uit = {};
    arr(lijst).forEach(function (r) {
      if (isObj(r) && str(r[sleutel])) uit[str(r[sleutel])] = r;
    });
    return uit;
  }

  function productNaam(p) {
    if (!isObj(p)) return '';
    return str(p.name || p.title || p.code || p.id);
  }

  /* ============================================================
     1. ACTIVITEIT — de klantzichtbare tijdlijn
     ============================================================ */

  /* De zes filters. ÉÉN ICONENSET (ronde 3, advies 28): het icoon per soort
     is hetzelfde dunne lijnicoon uit CP_UI.icon dat het productdetail voor
     dat gebied gebruikt (camera bij foto's, mail bij berichten, financien
     bij betalingen, locatie bij zendingen, activiteit voor de rest), op een
     neutrale tegel. De rijen dragen geen kleur meer: de donut in de rail
     kleurt zijn segmenten zelf (CP_CHART, catKleur per segment) en heeft
     daar zijn eigen legenda bij. */
  var ACT_FILTERS = [
    { key: 'alles',      label: 'Alles' },
    { key: 'updates',    label: 'Updates',    icoon: 'activiteit' },
    { key: 'fotos',      label: 'Foto’s',     icoon: 'camera' },
    { key: 'berichten',  label: 'Berichten',  icoon: 'mail' },
    { key: 'betalingen', label: 'Betalingen', icoon: 'financien' },
    { key: 'zendingen',  label: 'Zendingen',  icoon: 'locatie' }
  ];

  function filterVan(key) {
    for (var i = 0; i < ACT_FILTERS.length; i++) if (ACT_FILTERS[i].key === str(key)) return ACT_FILTERS[i];
    return null;
  }

  /* de apparaat-tag die portal.html achter elke eigen logregel zet
     (' — apparaat: Chrome · macOS · Europe/Amsterdam'). In de leesbare zin
     wordt hij gestript, precies zoals renderLog() dat al deed; op de
     pagina Toegang wordt hij juist GELEZEN. Zelfde regex als daar. */
  var APPARAAT_RE = / — apparaat: ([^—]+)$/;
  function zonderApparaat(s) { return str(s).replace(APPARAAT_RE, ''); }
  function apparaatVan(s) {
    var m = str(s).match(APPARAAT_RE);
    return m ? m[1].replace(/\s+$/, '') : '';
  }

  /* DE INDELING IN KLANTBEGRIPPEN. mergeActivity levert per rij {id, kind,
     detail, …}; de id is bewaard uit de bron, dus de oorspronkelijke
     logregel (assetKind, action) is op id terug te vinden, en de rijen die
     mergeActivity zelf afleidt hebben een vaste id-vorm (':asked',
     ':created', …). Wat nergens in past is een Update — de eerlijke
     restbak, nooit een verzonnen soort. */
  function soortVan(rij, logIndex, eventIndex) {
    var r = opt(rij);
    var id = str(r.id);
    var log = logIndex ? logIndex[id] : null;
    if (log) {
      var ak = str(log.assetKind), ac = str(log.action);
      if (ak === 'media') return 'fotos';
      if (ak === 'invoice' || ac === 'report_payment' || ac === 'dispute') return 'betalingen';
      if (ak === 'shipment') return 'zendingen';
      if (ak === 'question' || ak === 'message' || ak === 'thread') return 'berichten';
      return 'updates';
    }
    if (eventIndex && eventIndex[id]) return 'zendingen';
    if (/:asked$|:answered$/.test(id)) return 'berichten';
    if (/:created$|:paid$/.test(id) || str(r.kind) === 'financieel') return 'betalingen';
    if (str(r.detail).indexOf('Mijlpaal: ') === 0) return 'zendingen';
    return 'updates';
  }

  /* TITEL EN BESCHRIJVING UIT ÉÉN VELD. De detailregels zijn stelselmatig
     "<wat er gebeurde>: <waar het over ging>". Op de eerste dubbele punt
     splitsen is het lezen van de vorm die er al is; een te lange kop is
     duidelijk zelf de zin en blijft heel. */
  function splits(detail) {
    var d = str(detail);
    var i = d.indexOf(': ');
    if (i < 1 || i > 60) return { titel: d, tekst: '' };
    return { titel: d.slice(0, i), tekst: d.slice(i + 2) };
  }

  /* de Nederlandse mijlpaalnaam uit portal/shipping.js; de sleutel als
     terugval, zichtbaar onaf en nooit verzonnen */
  function mijlpaalLabel(type, key) {
    var g = G();
    var S = g && g.CP_SHIPPING;
    var k = str(key);
    if (S && fn(S.milestoneLabel)) {
      var l = str(S.milestoneLabel(str(type), k));
      if (l && l !== k) return l;
      var l2 = str(S.milestoneLabel(str(type) === 'zeevracht' ? 'koerier' : 'zeevracht', k));
      if (l2 && l2 !== k) return l2;
    }
    return k;
  }

  /* wat er op de rij komt te staan: {titel, tekst}. De titel is een
     bronstring en gaat door i18nT; de tekst is data. */
  function regelTekst(c, rij, log, ev, shipIndex, invIndex) {
    var uit = regelBasis(c, rij, log, ev, shipIndex);
    /* de factuurregels van mergeActivity ('<id>:created', '<id>:paid')
       noemen nummer en label maar geen bedrag; de factuur zelf ligt in de
       bundel, dus het bedrag erbij is data die er al is. Een logregel van
       een gemelde betaling draagt haar eigen (mogelijk gedeeltelijke)
       bedrag al in de zin en krijgt er niets bij. */
    var m = (!log && !ev) ? str(opt(rij).id).match(/^(.+):(created|paid)$/) : null;
    var inv = (m && invIndex) ? invIndex[m[1]] : null;
    if (inv && factuurCents(inv) > 0) {
      var bedrag = geldKlant(c, factuurCents(inv), inv.currency);
      if (bedrag) uit.tekst = uit.tekst ? (uit.tekst + ' · ' + bedrag) : bedrag;
    }
    uit.tekst = bedragenKlant(c, uit.tekst);
    return uit;
  }
  function regelBasis(c, rij, log, ev, shipIndex) {
    if (log) {
      var det = zonderApparaat(log.detail);
      var actor = str(log.actor);
      var ac = str(log.action);
      if (actor === 'client') {
        if (ac === 'view' || ac === 'download' || ac === 'share') {
          var tpl = (ac === 'download') ? 'Jij downloadde ‘{x}’' : ((ac === 'share') ? 'Jij deelde ‘{x}’' : 'Jij bekeek ‘{x}’');
          return { titel: c.Tpl(tpl, { x: det || c.T('een bestand') }), tekst: '' };
        }
        /* de klantacties van 0021 (akkoord, samplekeuze, betaling gemeld,
           bezwaar, upload, herbestelling): de zin is door de server
           geschreven en dus data; alleen de kop ervoor is een bekend woord */
        var g1 = splits(det);
        return { titel: c.T(g1.titel), tekst: g1.tekst };
      }
      if (actor === 'staff') return { titel: c.T('Update van Steffan'), tekst: det };
      var g2 = splits(det);
      return { titel: c.T(g2.titel), tekst: g2.tekst };
    }
    if (ev) {
      var ship = shipIndex ? shipIndex[str(ev.shipmentId)] : null;
      var label = mijlpaalLabel(ship ? ship.type : '', ev.milestoneKey);
      var extra = [str(ev.location), str(ev.note)].filter(function (s) { return !!s; }).join(' · ');
      return { titel: c.Tpl('Zending: {mijlpaal}', { mijlpaal: c.T(label) }), tekst: extra };
    }
    var g3 = splits(zonderApparaat(opt(rij).detail));
    return { titel: c.T(g3.titel), tekst: g3.tekst };
  }

  /* waar een rij heen wijst (ronde 3, advies 29). Berichten, Betalingen en
     Foto's hebben elders een eigen scherm en houden hun link altijd. "Open
     het product" is alleen zinvol als er iets te kiezen valt: in de
     compacte stand staat de lijst al ín het product, en met één product is
     dat product al open — dan is de link een klik naar waar je al bent. */
  function refVoor(c, soort, projectId, metProductLink) {
    if (soort === 'berichten') return { label: 'Open Berichten', route: routeNaar(c, { area: 'berichten' }, '#/berichten') };
    if (soort === 'betalingen') return { label: 'Open Betalingen', route: routeNaar(c, { area: 'betalingen' }, '#/betalingen') };
    if (soort === 'fotos') return { label: 'Open Bestanden', route: routeNaar(c, { area: 'bestanden' }, '#/bestanden') };
    if (!metProductLink || !projectId) return null;
    return { label: 'Open het product', route: routeNaar(c, { area: 'producten', id: projectId, tab: 'voortgang' }, '#/producten/' + projectId + '/voortgang') };
  }

  function refKnop(c, label, route) {
    var ui = c.ui;
    var inhoud = [ui.el('span', { text: str(label) }), ui.icon('extern', 14)];
    if (c.ga && str(route)) {
      return ui.el('button', {
        type: 'button', class: 'u-link',
        /* .u-link is op tekst gemaakt; deze drie zetten de knop op één
           regel met zijn icoontje, precies als in het beheer */
        style: 'display:inline-flex;align-items:center;gap:6px;font-size:13.5px;',
        onclick: function () { c.ga(route); }
      }, inhoud);
    }
    return ui.el('a', { class: 'u-link', href: str(route), style: 'display:inline-flex;align-items:center;gap:6px;font-size:13.5px;' }, inhoud);
  }

  /* ÉÉN RIJ VAN DE TIJDLIJN — mockup 5.8: datumkolom, de lijn, icoontegel,
     tijd, titel, beschrijving, verwijzing. admin-ui.css 8k beschrijft de
     vorm (.u-tlrail-*); CP_UI heeft er geen bouwer voor, dus dezelfde
     opbouw als admin-schermen-beheer.js. De gekleurde stip op de lijn is
     weg (advies 28): een gevulde cirkel naast een lijnicoon waren twee
     tekens voor één ding; de tegel is nu het teken en de lijn de rail.
       opties.metProductLink  de link "Open het product" onder een
                              update-regel (zie refVoor) */
  function actRij(c, rij, soort, tekst, opties) {
    var ui = c.ui;
    var o = opt(opties);
    var f = filterVan(soort) || filterVan('updates');
    var tijd = tijdTekst(c, rij.at);

    var datumKol = ui.el('div', { class: 'u-tlrail-datum-kol' }, [
      ui.el('span', { class: 'u-tlrail-dag', text: weekdagKort(c, rij.at) || c.T('Onbekend') }),
      ui.el('span', { class: 'u-tlrail-datum', text: datumKort(c, rij.at) || c.T('datum onbekend') })
    ]);
    /* de lijn is decoratie en houdt het raster van admin-ui.css 8k op zijn
       drie kolommen; de soort staat als naam op de icoontegel hiernaast */
    var lijnKol = ui.el('div', { class: 'u-tlrail-lijn', 'aria-hidden': 'true' });

    var ref = refVoor(c, soort, rij.projectId, !!o.metProductLink);
    var tekstKol = ui.el('div', { class: 'u-tlrail-tekstkol' }, [
      ui.el('span', {
        class: 'u-tlrail-tijd',
        text: tijd || c.T('tijd onbekend'),
        title: tijd ? null : c.T('Van deze regel is alleen de dag vastgelegd, niet het tijdstip.')
      }),
      alsData(ui.el('span', { class: 'u-tlrail-title', text: str(tekst.titel) || c.T(f.label) })),
      str(tekst.tekst) ? alsData(ui.el('span', { class: 'u-tlrail-text', text: str(tekst.tekst) })) : null,
      ref ? ui.el('div', { class: 'u-tlrail-refs' }, refKnop(c, c.T(ref.label), ref.route)) : null
    ]);

    var body = ui.el('div', { class: 'u-tlrail-body' }, [
      ui.iconTile({ icoon: f.icoon, toon: 'neutraal', maat: 44, titel: c.T(f.label) }),
      tekstKol
    ]);
    return ui.el('div', { class: 'u-tlrail-row', role: 'listitem' }, [datumKol, lijnKol, body]);
  }

  /* de bronnenzak voor activiteitVoorKlant: de open bundel plus de
     vertaalde fasenaam. De fasenamen komen van de aanroeper (ctx.stageLabel
     vertaalt ze al); zonder tabel toont de laag de kale sleutel en dat is
     eerlijker dan een tweede vertaaltabel. */
  function actBronnen(c) {
    var b = c.bundle || {};
    var uit = {};
    for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) uit[k] = b[k];
    if (c.stageLabel) uit.stageLabel = c.stageLabel;
    return uit;
  }

  /* de telling per soort in de donutbeschrijving: één hele bronstring per
     soort en geen gelijmd '{soort} {n}', want een vertaler moet de zin als
     geheel kunnen omzetten en de woordvolgorde is per taal anders */
  var SOORT_TELLING = {
    updates:    'Updates: {n}',
    fotos:      'Foto’s: {n}',
    berichten:  'Berichten: {n}',
    betalingen: 'Betalingen: {n}',
    zendingen:  'Zendingen: {n}'
  };

  function actDonutKaart(c, verdeling, totaal) {
    var ui = c.ui;
    var segmenten = [];
    var zinnen = [];
    ACT_FILTERS.forEach(function (f) {
      if (f.key === 'alles') return;
      var n = verdeling[f.key] || 0;
      segmenten.push({ label: c.T(f.label), waarde: n });
      zinnen.push(c.Tpl(SOORT_TELLING[f.key] || f.label, { n: n }));
    });
    var inhoud = [ui.sectionHead({ titel: c.T('Verdeling van je activiteit') })];
    if (c.chart && fn(c.chart.donut)) {
      inhoud.push(c.chart.donut({
        segmenten: segmenten,
        maat: 200,
        /* het middengetal is het ECHTE aantal rijen in de tijdlijn */
        midden: { waarde: String(totaal), label: c.T('Totaal') },
        legenda: 'percentage',
        titel: c.T('Verdeling van je activiteit'),
        beschrijving: c.Tpl('Verdeling van je activiteit: {lijst}.', { lijst: zinnen.join(', ') })
      }));
    } else {
      /* zonder tekenlaag geen donut, maar wél de cijfers */
      inhoud.push(alsData(ui.el('p', { class: 'u-lees', text: zinnen.join(' · ') })));
    }
    return kaart(ui, inhoud);
  }

  /* het project waar een blok over gaat: een projectobject, een id, of niets
     (dan het open product uit de bundel) */
  function projectIdUit(c, project) {
    if (isObj(project)) return str(project.id);
    if (str(project)) return str(project);
    return c.bundle ? str(opt(c.bundle.project).id) : '';
  }

  /* DE FEED, ÉÉN KEER. De enige bron is de klantfilter van CP_PORTAAL over de
     open bundel; dit bestand voegt er geen bron aan toe. De projectscope gaat
     mee naar activiteitVoorKlant (die geeft hem door aan mergeActivity, en
     die laat een rij zonder projectId dan al vallen) én wordt hier nog eens
     op de rij zelf nagekeken: een rij van een ander product hoort nooit in
     deze tijdlijn, ook niet als de laag eronder ooit soepeler wordt.
     Levert {rijen: [{rij, soort}], tellingen, logIndex, eventIndex,
     shipIndex, geladen, projectId}. `geladen` is onwaar zonder bundel, en
     ook als de bundel over een ÁNDER product gaat dan gevraagd: de datalaag
     kent geen logboek over alle producten, dus dan is er eerlijk niets. */
  function actFeed(c, projectId) {
    var bundle = c.bundle;
    var bronId = bundle ? str(opt(bundle.project).id) : '';
    var doelId = str(projectId) || bronId;
    var geladen = !!bundle && (!doelId || !bronId || doelId === bronId);
    var feed = [];
    if (geladen && c.portaal && fn(c.portaal.activiteitVoorKlant)) {
      try { feed = arr(c.portaal.activiteitVoorKlant(actBronnen(c), { projectId: doelId || null })); }
      catch (e) { feed = []; }
    }
    if (doelId) feed = feed.filter(function (r) { return isObj(r) && str(r.projectId) === doelId; });

    var logIndex = indexeer(bundle ? bundle.accessLog : [], 'id');
    var eventIndex = indexeer(bundle ? bundle.shipmentEvents : [], 'id');
    var shipIndex = indexeer(bundle ? bundle.shipments : [], 'id');
    var invIndex = indexeer(bundle ? bundle.invoices : [], 'id');

    /* per rij één keer indelen, en de tellingen uit dezelfde lijst als de
       tijdlijn — dus geen tweede telling die van de lijst kan afwijken */
    var rijen = feed.map(function (r) {
      return { rij: r, soort: soortVan(r, logIndex, eventIndex) };
    });
    var tellingen = { alles: rijen.length };
    ACT_FILTERS.forEach(function (f) { if (f.key !== 'alles') tellingen[f.key] = 0; });
    rijen.forEach(function (x) { tellingen[x.soort] += 1; });

    return {
      rijen: rijen, tellingen: tellingen,
      logIndex: logIndex, eventIndex: eventIndex, shipIndex: shipIndex, invIndex: invIndex,
      geladen: geladen, projectId: doelId
    };
  }

  function actRoute(c, key) {
    var tab = (key && key !== 'alles') ? str(key) : null;
    return routeNaar(c, { area: 'activiteit', tab: tab }, '#/activiteit' + (tab ? '/' + tab : ''));
  }

  /* DE LIJST, MET EEN GRENS. `max` toont de eerste rijen en een knop "Toon
     alles" die de rest in DEZELFDE lijst zet: geen hertekening, dus de
     scrollpositie blijft staan en de focus gaat naar de eerste nieuwe rij
     in plaats van naar het begin van de pagina. */
  function actLijst(c, feed, zichtbaar, max, metProductLink) {
    var ui = c.ui;
    var T = c.T;
    var grens = (typeof max === 'number' && max > 0) ? Math.round(max) : 0;
    var vak = ui.el('div', { class: 'k-activiteit-lijst' });
    var regio = statusRegio(ui);
    vak.appendChild(regio);

    var lijstVak = ui.el('div', {
      class: 'u-tlrail', role: 'list',
      'aria-label': (zichtbaar.length === 1) ? T('Tijdlijn, 1 gebeurtenis') : c.Tpl('Tijdlijn, {n} gebeurtenissen', { n: zichtbaar.length })
    });
    function rijEl(x) {
      var log = feed.logIndex[str(x.rij.id)] || null;
      var ev = feed.eventIndex[str(x.rij.id)] || null;
      return actRij(c, x.rij, x.soort, regelTekst(c, x.rij, log, ev, feed.shipIndex, feed.invIndex), { metProductLink: !!metProductLink });
    }
    var eerste = grens ? zichtbaar.slice(0, grens) : zichtbaar;
    eerste.forEach(function (x) { lijstVak.appendChild(rijEl(x)); });
    vak.appendChild(lijstVak);

    if (grens && zichtbaar.length > grens) {
      var rest = zichtbaar.slice(grens);
      var knop = ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', style: 'margin-top:14px;',
        /* de zichtbare tekst is kort; de schermlezer hoort hoeveel er komt */
        'aria-label': c.Tpl('Toon alle {n} gebeurtenissen', { n: zichtbaar.length }),
        onclick: function () {
          var eersteNieuw = null;
          rest.forEach(function (x) {
            var r = rijEl(x);
            if (!eersteNieuw) eersteNieuw = r;
            lijstVak.appendChild(r);
          });
          if (knop.parentNode) knop.parentNode.removeChild(knop);
          if (eersteNieuw) {
            eersteNieuw.setAttribute('tabindex', '-1');
            try { eersteNieuw.focus(); } catch (e) { /* stil */ }
          }
          meldIn(regio, c.Tpl('Alle {n} gebeurtenissen staan nu in de lijst.', { n: zichtbaar.length }));
        }
      }, [ui.el('span', { text: T('Toon alles') }), ui.icon('chevronOmlaag', 16)]);
      vak.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:14px 0 0;' }, [
        ui.el('span', { text: c.Tpl('De eerste {n} van {t} gebeurtenissen.', { n: grens, t: zichtbaar.length }) + ' ' }),
        knop
      ]));
    }
    return vak;
  }

  /* ACTIVITEIT ALS INBOUWBLOK — activiteitBlok(ctx, opties) → element.
       opties.project   projectobject of id; standaard het open product
       opties.compact   alleen de lijst (elke rij met zijn datumkolom): geen
                        kop, geen uitleg, geen filtertabs, geen donutrail, en
                        geen kaart eromheen — de aanroeper kiest de omlijsting
       opties.max       begrens het aantal rijen; "Toon alles" haalt de rest op
       opties.filter    soort ('alles' | 'updates' | 'fotos' | 'berichten' |
                        'betalingen' | 'zendingen'); onbekend → 'alles'
       opties.onFilter  (key) → bij een tabkeuze; zonder deze haak wisselt
                        het blok zelf van filter, lokaal en zonder route
     Het element draagt .aantal (alle rijen van dit product), .tellingen (per
     soort) en .geladen (onwaar als de bundel niet over dit product gaat).
     Het scherm Activiteit is dit blok in de volle stand; het productdetail
     in portaal-schermen-werk.js gebruikt de compacte. Geeft altijd een
     element terug, nooit een Promise: de bundel is al geladen door de shell. */
  function activiteitBlok(ctx, opties) {
    var c = context(ctx);
    var o = opt(opties);
    if (!c.ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen; de tijdlijn kan niet worden getekend.');
    var ui = c.ui;
    var T = c.T;
    var compact = !!o.compact;
    var feed = actFeed(c, projectIdUit(c, o.project));
    var rijen = feed.rijen;
    var project = c.bundle ? opt(c.bundle.project) : {};
    /* "Open het product" alleen in de volle stand én als er meer dan één
       product is om naartoe te gaan (advies 29, zie refVoor) */
    var metProductLink = !compact && c.projecten.length > 1;

    /* een onbekende soort landt op 'alles' in plaats van op een lege lijst
       zonder uitleg */
    var gekozen = filterVan(o.filter) ? str(o.filter) : 'alles';

    var wortel = ui.el('div', { class: 'k-activiteit' + (compact ? ' k-activiteit-compact' : '') });
    wortel.aantal = rijen.length;
    wortel.tellingen = feed.tellingen;
    wortel.geladen = feed.geladen;

    function zichtbareRijen(key) {
      return (key === 'alles') ? rijen : rijen.filter(function (x) { return x.soort === key; });
    }
    function paneelNaam(key) {
      return (key === 'alles')
        ? T('Tijdlijn, alle activiteit')
        : c.Tpl('Tijdlijn, gefilterd op {soort}', { soort: T(filterVan(key).label) });
    }
    function leeg(spec) {
      /* compact staat al in een kaart van de aanroeper; een kaart in een
         kaart is een rand te veel */
      spec.kaal = compact;
      return ui.emptyState(spec);
    }

    /* de inhoud van het paneel voor één filter: lege stand of lijst. Elke
       lege stand is ÉÉN REGEL (advies 9): de titel zegt wat er is, de
       knop wat je kunt doen; geen tweede zin die dat nog eens uitlegt. */
    function paneelInhoud(key, kiesAlles) {
      if (!c.bundle) {
        return leeg({
          titel: T('Er staat nog geen product open'),
          actie: c.ga ? { label: T('Naar mijn producten'), onClick: function () { ga(c, { area: 'producten' }, '#/producten'); } } : null
        });
      }
      if (!feed.geladen) {
        /* de bundel gaat over een ander product dan gevraagd: er is geen
           logboek over alle producten, dus eerlijk niets in plaats van de
           tijdlijn van het verkeerde product */
        return leeg({
          titel: T('De tijdlijn van dit product is nog niet geladen'),
          actie: (c.ga && feed.projectId) ? { label: T('Open het product'), onClick: function () { ga(c, { area: 'producten', id: feed.projectId, tab: 'voortgang' }, '#/producten/' + feed.projectId + '/voortgang'); } } : null
        });
      }
      var zichtbaar = zichtbareRijen(key);
      if (!zichtbaar.length) {
        if (!rijen.length) {
          return leeg({ titel: T('Nog geen activiteit; zodra er iets gebeurt, zie je het hier.') });
        }
        /* de kleinste stap terug is het filter loslaten, niet de pagina */
        return leeg({
          titel: T('Niets van deze soort in de tijdlijn.'),
          actie: kiesAlles ? { label: T('Toon alles'), klasse: 'ghost', onClick: kiesAlles } : null
        });
      }
      var lijst = actLijst(c, feed, zichtbaar, o.max, metProductLink);
      return compact ? lijst : kaart(ui, lijst);
    }

    /* ---- compact: alleen de lijst ---- */
    if (compact) {
      wortel.appendChild(paneelInhoud(gekozen, null));
      return wortel;
    }

    /* ---- vol: kop, uitleg, tabs, paneel, rail ---- */
    var regio = statusRegio(ui);
    wortel.appendChild(regio);

    var badge = null;
    if (rijen.length) badge = (rijen.length === 1) ? T('1 gebeurtenis') : c.Tpl('{n} gebeurtenissen', { n: rijen.length });
    var kop = ui.pageHeader({
      titel: T('Activiteit'),
      bijzin: productNaam(project) || null,
      badge: badge
    });
    /* de productnaam in de bijzin is data */
    var bijzinEl = kop.querySelector ? kop.querySelector('.u-bijzin') : null;
    if (bijzinEl) alsData(bijzinEl);
    wortel.appendChild(kop);

    /* wat hier staat, in één zin; de beveiligingsgrens van
       activiteitVoorKlant (geen interne notities) achter de "i" */
    wortel.appendChild(uitleg(c, {
      zin: T('Alles wat jou aangaat in dit product: updates, foto’s, berichten, betalingen en zendingen.'),
      meer: [T('Ook je eigen handelingen staan erin: een akkoord, een samplekeuze, een gemelde betaling, een download.'), T('Interne notities van CUSTOM+ staan hier niet.')],
      stijl: 'margin:0 0 10px;'
    }));

    /* meerdere producten: zeg welk logboek dit is, met de wissel ernaast */
    if (c.projecten.length > 1) {
      wortel.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:0 0 18px;' }, [
        ui.el('span', { text: T('Je kijkt naar de tijdlijn van het product dat nu open staat.') + ' ' }),
        c.ga ? ui.el('button', {
          type: 'button', class: 'u-link', text: T('Naar mijn producten'),
          onclick: function () { ga(c, { area: 'producten' }, '#/producten'); }
        }) : null
      ]));
    }

    var paneel = ui.el('div', { role: 'tabpanel', 'aria-label': paneelNaam(gekozen), tabindex: '0', style: 'margin-top:26px;' });
    var tabsEl = null;

    /* een tabkeuze gaat naar de aanroeper (het scherm zet hem in de route)
       of, zonder haak, wisselt het blok zelf: paneel hertekenen, naam
       bijwerken, en de tabs volgen via zetActief */
    function kies(key) {
      if (fn(o.onFilter)) { o.onFilter(key); return; }
      gekozen = filterVan(key) ? str(key) : 'alles';
      ui.clear(paneel);
      paneel.setAttribute('aria-label', paneelNaam(gekozen));
      paneel.appendChild(paneelInhoud(gekozen, function () { kies('alles'); }));
      if (tabsEl && fn(tabsEl.zetActief)) tabsEl.zetActief(gekozen);
      meldIn(regio, paneelNaam(gekozen));
    }

    /* echte tabs (pijltjes, Home, End). Zes tabs boven ÉÉN paneel, dus geen
       panelId — zes keer hetzelfde id is geen id. Het paneel draagt de naam
       van het actieve filter. */
    tabsEl = ui.tabs({
      tabs: ACT_FILTERS.map(function (f) {
        return { key: f.key, label: T(f.label), count: feed.tellingen[f.key] || 0 };
      }),
      actief: gekozen,
      label: T('Soort activiteit'),
      onKies: function (key) { kies(key); }
    });
    wortel.appendChild(tabsEl);

    var hoofd = ui.el('div', { class: 'u-cols-main' });
    paneel.appendChild(paneelInhoud(gekozen, function () { kies('alles'); }));
    hoofd.appendChild(paneel);

    /* DE RAIL ALLEEN BIJ TIEN OF MEER GEBEURTENISSEN. De verdeling is die van
       de hele tijdlijn en niet van het gekozen filter: anders is het
       middengetal bij "Berichten" gelijk aan het enige segment. */
    if (rijen.length >= 10) {
      var rail = ui.el('div', { class: 'u-cols-side' });
      rail.appendChild(ui.el('div', { class: 'u-sticky' }, [actDonutKaart(c, feed.tellingen, rijen.length)]));
      wortel.appendChild(ui.el('div', { class: 'u-cols', style: 'margin-top:0;' }, [hoofd, rail]));
    } else {
      wortel.appendChild(hoofd);
    }
    return wortel;
  }

  /* het scherm #/activiteit[/<filter>]: het blok in de volle stand, met het
     filter uit de route en een tabkeuze die de route zet — zodat een filter
     een adres heeft en de terugknop werkt */
  function activiteit(ctx) {
    var c = context(ctx);
    if (!c.ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen; het scherm Activiteit kan niet worden getekend.');
    return activiteitBlok(ctx, {
      filter: tabUit(c, 'alles'),
      onFilter: c.ga ? function (key) { c.ga(actRoute(c, key)); } : null
    });
  }

  /* ============================================================
     2. INSTELLINGEN — DE VIER CATEGORIEËN
     ============================================================ */

  /* Icoontegels uit CP_UI.ICONEN. Er is geen wereldbol- of taalicoon in die
     set; 'locatie' is de dichtstbijzijnde vorm en staat hier bewust met die
     kanttekening, zodat hij vervangen wordt zodra admin-ui.js er een heeft. */
  /* `uitleg` staat op de kaart in het overzicht, `subtitel` boven de
     categoriepagina: allebei één zin (advies 1). Wat er meer te zeggen
     valt staat in `meer` en komt achter de "i"-knop. */
  var CATEGORIEEN = [
    {
      key: 'mensen', label: 'Jouw mensen', icoon: 'team', tint: 1,
      uitleg: 'Wie bij jou meekijkt, welke mail hij of zij krijgt en wie mag inloggen.',
      subtitel: 'Je eigen contactpersonen, en per persoon welke mail van CUSTOM+ hij of zij krijgt.',
      meer: ['Wijzigingen staan pas vast als je ze opslaat.']
    },
    {
      key: 'meldingen', label: 'Meldingen', icoon: 'bel', tint: 2,
      uitleg: 'Welke mails jij als hoofdcontactpersoon ontvangt.',
      subtitel: 'Kies of je alles wilt ontvangen, alleen het belangrijkste, of zelf per soort.',
      meer: ['De mails gaan naar het adres waarmee je inlogt.', 'Wijzigingen staan pas vast als je ze opslaat.']
    },
    {
      key: 'taal', label: 'Taal', icoon: 'locatie', tint: 3,
      uitleg: 'De taal van dit portaal en van de mails die je krijgt.',
      subtitel: 'Kies de taal van dit portaal en van je mails.',
      meer: []
    },
    {
      key: 'toegang', label: 'Toegang en gegevens', icoon: 'instellingen', tint: 4,
      uitleg: 'Waar je bent ingelogd, wat er van je wordt bewaard, en alles downloaden.',
      subtitel: 'Wat CUSTOM+ van je vastlegt, waar dat staat, en hoe je het in één keer meeneemt.',
      meer: []
    }
  ];

  function categorieVan(key) {
    for (var i = 0; i < CATEGORIEEN.length; i++) if (CATEGORIEEN[i].key === str(key)) return CATEGORIEEN[i];
    return null;
  }

  /* de vijf talen van het portaal: de code is de opgeslagen waarde
     (clients.portal_lang, TALEN in portaal-data.js), de naam staat in de
     taal zelf en is data — een Duitser herkent 'Deutsch', niet 'Duits' */
  var TAALNAMEN = { nl: 'Nederlands', en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español' };
  var TAALCODES = { nl: 'NL', en: 'EN', de: 'DE', fr: 'FR', es: 'ES' };
  function talen(c) {
    var lijst = (c.data && arr(c.data.TALEN).length) ? c.data.TALEN : ['nl', 'en', 'de', 'fr', 'es'];
    return lijst.map(function (code) { return str(code); }).filter(function (code) { return !!TAALNAMEN[code]; });
  }

  /* de zes mailcategorieën uit CP_PORTAAL (sleutels = beheer); de terugval
     draagt dezelfde sleutels, voor een test zonder portaal-model.js */
  var ROLLEN_TERUGVAL = [
    { key: 'fase',    label: 'Fase-updates' },
    { key: 'update',  label: 'Updates, documenten & antwoorden' },
    { key: 'sample',  label: 'Samples' },
    { key: 'zending', label: 'Zendingen' },
    { key: 'factuur', label: 'Facturen & herinneringen' },
    { key: 'relatie', label: 'Relatiemails (welkom, check-in, afscheid)' }
  ];
  function rollen(c) {
    var bron = (c.portaal && arr(c.portaal.ROLLEN_CONTACT).length) ? c.portaal.ROLLEN_CONTACT : ROLLEN_TERUGVAL;
    return bron.filter(function (r) { return isObj(r) && str(r.key); }).map(function (r) {
      return { key: str(r.key), label: str(r.label) || str(r.key) };
    });
  }
  function rolLabel(c, key) {
    var lijst = rollen(c);
    for (var i = 0; i < lijst.length; i++) if (lijst[i].key === str(key)) return lijst[i].label;
    return str(key);
  }

  /* ---- de drie standen van mail ---------------------------------------
     "Alles", "Alleen belangrijk" en "Zelf kiezen" zijn geen opgeslagen veld:
     de stand wordt AFGELEID uit de zes vinkjes. Zo blijven meldingenOpslaan,
     mail_prefs (klant) en mail_categories (contactpersoon) precies wat ze
     waren, en klopt de stand ook voor een klant die Steffan in het beheer
     instelde: alles aan → Alles; precies de drie belangrijke aan en de rest
     uit → Alleen belangrijk; elke andere combinatie → Zelf kiezen.

     ALLEEN BELANGRIJK = de drie sleutels uit ROLLEN_CONTACT (CP_PORTAAL)
     waar een beslissing of geld aan hangt:
       fase     "Fase-updates" — daar valt de akkoordvraag onder: de mail
                'Jouw goedkeuring gevraagd' (faseAwaiting) gaat in het beheer
                met category 'fase', en prefCatFor() houdt die op 'fase'
       factuur  "Facturen & herinneringen"
       zending  "Zendingen" — de leveringen (onderweg, ETA, bezorgd)
     De andere drie (update, sample, relatie) staan in die stand uit. */
  var BELANGRIJK = ['fase', 'factuur', 'zending'];
  var MAIL_STANDEN = [
    { key: 'alles',      label: 'Alles' },
    { key: 'belangrijk', label: 'Alleen belangrijk' },
    { key: 'zelf',       label: 'Zelf kiezen' }
  ];

  /* de zin onder de keuze; de tweede tabel is de vorm voor een
     contactpersoon in Jouw mensen ("deze persoon") tegenover jezelf op
     Meldingen ("je") — hele zinnen per stand, geen gelijmde stukjes */
  var STAND_ZIN = {
    alles:      'Je krijgt elke mail van CUSTOM+: over fases, updates en antwoorden, samples, zendingen, facturen en je relatie met ons.',
    belangrijk: 'Je krijgt een mail bij akkoordvragen, facturen en leveringen.',
    zelf:       'Kies hieronder zelf welke soorten mail je krijgt.'
  };
  var STAND_ZIN_DERDE = {
    alles:      'Deze persoon krijgt elke mail van CUSTOM+: over fases, updates en antwoorden, samples, zendingen, facturen en de relatie met ons.',
    belangrijk: 'Deze persoon krijgt een mail bij akkoordvragen, facturen en leveringen.',
    zelf:       'Kies hieronder zelf welke soorten mail deze persoon krijgt.'
  };

  /* waarden: {sleutel: true|false} over de categorieën `cats` (objecten met
     key, of kale sleutels). Alleen een uitdrukkelijk true telt als aan: de
     aanroeper beslist zelf wat "ontbreekt" betekent (bij de klant aan, bij
     een contactpersoon uit) en bouwt de kaart compleet. */
  function mailStandVan(waarden, cats) {
    var w = opt(waarden);
    var lijst = arr(cats);
    if (!lijst.length) return 'zelf';
    var allesAan = true;
    var preciesBelangrijk = true;
    lijst.forEach(function (r) {
      var key = str(isObj(r) ? r.key : r);
      var aan = w[key] === true;
      if (!aan) allesAan = false;
      if (aan !== (BELANGRIJK.indexOf(key) > -1)) preciesBelangrijk = false;
    });
    if (allesAan) return 'alles';
    if (preciesBelangrijk) return 'belangrijk';
    return 'zelf';
  }

  /* de waarden die bij een gekozen stand horen; 'zelf' verandert niets en
     vult alleen ontbrekende sleutels aan met uit */
  function waardenVoorStand(stand, cats, huidig) {
    var uit = kloon(opt(huidig)) || {};
    arr(cats).forEach(function (r) {
      var key = str(isObj(r) ? r.key : r);
      if (stand === 'alles') uit[key] = true;
      else if (stand === 'belangrijk') uit[key] = BELANGRIJK.indexOf(key) > -1;
      else if (uit[key] !== true) uit[key] = false;
    });
    return uit;
  }

  /* DE KIEZER — één component voor Meldingen (jij) en het contactformulier
     (per persoon), zodat de stand nergens net anders wordt afgeleid.
     opts: {waarden, cats, label, derde, alleenLezen, onWijzig(waarden)}.
     Geeft het element terug met .lees() → kopie van de waarden en
     .zet(waarden) → nieuwe waarden van buiten (herstel, na opslaan).
     De segmentknop is CP_UI.filterChips: het bestaande aria-pressed-
     component voor een keuze uit een rij, met zetActief zodat de chip die
     focus heeft die focus houdt.

     "Zelf kiezen" is de enige stand met een geheugen: wie erop klikt ziet
     de zes vinkjes met de huidige waarden, óók als die toevallig "alles"
     zijn — anders springt de keuze meteen terug en valt er niets te kiezen.
     Dat geheugen (zelfOpen) leeft alleen in dit scherm; bij zet() en na
     opslaan geldt weer de afgeleide stand, en die is wat wordt bewaard. */
  function mailStandKiezer(c, opts) {
    var ui = c.ui;
    var T = c.T;
    var o = opt(opts);
    var cats = arr(o.cats).length ? o.cats : rollen(c);
    var waarden = waardenVoorStand('zelf', cats, o.waarden);
    var zinnen = o.derde ? STAND_ZIN_DERDE : STAND_ZIN;
    var zelfOpen = false;
    var vinkjes = {};

    function stand() { return zelfOpen ? 'zelf' : mailStandVan(waarden, cats); }
    function meld() { if (fn(o.onWijzig)) o.onWijzig(kloon(waarden)); }
    function zetVinkjes() {
      cats.forEach(function (r) { if (vinkjes[r.key]) vinkjes[r.key].checked = waarden[r.key] === true; });
    }

    var chips = ui.filterChips({
      chips: MAIL_STANDEN.map(function (s) { return { key: s.key, label: T(s.label) }; }),
      actief: stand(),
      label: str(o.label) || T('Welke mail wil je krijgen?'),
      onKies: function (key) {
        if (o.alleenLezen) return;
        if (key === 'zelf') {
          zelfOpen = true;
        } else {
          zelfOpen = false;
          waarden = waardenVoorStand(key, cats, waarden);
          zetVinkjes();
        }
        teken();
        meld();
      }
    });
    chips.classList.add('k-mailstand-keuze');
    /* in de alleen-lezen stand staan de knoppen vast — een chip die wel
       drukt maar niets doet is een stille knop */
    if (o.alleenLezen && chips.querySelectorAll) {
      var knoppen = chips.querySelectorAll('button');
      for (var i = 0; i < knoppen.length; i++) knoppen[i].disabled = true;
    }

    var zin = ui.el('p', { class: 'u-sub', style: 'margin:0 0 14px;max-width:62ch;' });

    var vinkVak = ui.el('div', { role: 'group', 'aria-label': T('Soorten mail') });
    cats.forEach(function (r) {
      var v = ui.el('input', { type: 'checkbox', checked: waarden[r.key] === true, disabled: !!o.alleenLezen });
      vinkjes[r.key] = v;
      v.addEventListener('change', function () {
        waarden[r.key] = !!v.checked;
        /* in de zelfstand blijven: een vinkje zetten mag de keuze niet
           laten wegspringen naar Alles of Alleen belangrijk */
        zelfOpen = true;
        teken();
        meld();
      });
      vinkVak.appendChild(ui.el('label', { class: 'checkline', style: 'padding:6px 0;' }, [v, ui.el('span', { text: T(r.label) })]));
    });

    function teken() {
      var s = stand();
      if (fn(chips.zetActief)) chips.zetActief(s);
      zin.textContent = T(zinnen[s]);
      vinkVak.hidden = (s !== 'zelf');
    }
    teken();

    var wortel = ui.el('div', { class: 'k-mailstand' }, [
      str(o.label) ? ui.el('span', { class: 'flabel', text: str(o.label) }) : null,
      chips,
      zin,
      vinkVak
    ]);
    wortel.lees = function () { return kloon(waarden); };
    wortel.zet = function (nieuw) {
      waarden = waardenVoorStand('zelf', cats, nieuw);
      zelfOpen = false;
      zetVinkjes();
      teken();
    };
    return wortel;
  }

  /* 'demo' of 'supa' — de datalaag weet het; zonder datalaag weten we het
     niet en zeggen we dat ook (lege tekst, geen aanname) */
  function modusVan(c) {
    if (c.data && fn(c.data.modus)) return str(c.data.modus());
    return '';
  }

  /* een Promise die NOOIT verwerpt: een leeslijst die niet laadt, wordt
     null en het scherm toont dan een eerlijke lege stand in plaats van een
     foutpagina over het hele werkgebied */
  function tolerant(belofte) {
    var p;
    try { p = belofte; } catch (e) { return Promise.resolve(null); }
    if (!p || !fn(p.then)) return Promise.resolve(p === undefined ? null : p);
    return p.then(function (v) { return v; }, function () { return null; });
  }

  /* ---- 2a. het overzicht (mockup 5.9, vier kaarten) ------------------ */

  function metaMensen(c, contacten) {
    if (contacten === null) return c.T('Nog niet geladen');
    var n = arr(contacten).length;
    if (!n) return c.T('Nog niemand toegevoegd');
    return (n === 1) ? c.T('1 contactpersoon') : c.Tpl('{n} contactpersonen', { n: n });
  }
  function metaMeldingen(c, klant) {
    if (!isObj(klant) || !isObj(klant.meldingen)) return c.T('Nog niet geladen');
    var cats = rollen(c);
    var waarden = {};
    var aan = 0;
    cats.forEach(function (r) {
      waarden[r.key] = klant.meldingen[r.key] !== false;
      if (waarden[r.key]) aan += 1;
    });
    /* dezelfde afleiding als op de pagina zelf, zodat de kaart en de
       segmentknop nooit iets anders zeggen */
    var stand = mailStandVan(waarden, cats);
    if (stand === 'alles') return c.T('Alle soorten mail aan');
    if (stand === 'belangrijk') return c.T('Alleen belangrijk');
    return c.Tpl('{n} van {t} soorten mail aan', { n: aan, t: cats.length });
  }
  function metaTaal(c) {
    return TAALNAMEN[c.lang] || c.lang;
  }
  function metaToegang(c) {
    var m = modusVan(c);
    if (m === 'supa') return c.T('Gegevens bij Supabase');
    if (m === 'demo') return c.T('Demo: alles staat in deze browser');
    return c.T('Toegang en download');
  }

  function accountKaart(c) {
    var ui = c.ui;
    var naam = str(c.klant.naam) || str(c.klant.email) || c.T('Jij');
    var regels = [
      alsData(ui.el('span', { class: 'u-row-title', text: naam })),
      str(c.klant.bedrijf) ? alsData(ui.el('span', { class: 'u-row-sub', text: str(c.klant.bedrijf) })) : null,
      str(c.klant.email) ? alsData(ui.el('span', { class: 'u-row-sub', text: str(c.klant.email) })) : null
    ];
    return kaart(ui, [
      ui.sectionHead({ titel: c.T('Jouw account') }),
      ui.el('div', { style: 'display:flex;align-items:center;gap:14px;' }, [
        alsData(ui.avatar({ naam: naam, maat: 48 })),
        ui.el('span', { style: 'min-width:0;display:block;' }, regels)
      ]),
      uitleg(c, {
        klasse: 'u-sub', stijl: 'margin:14px 0 0;',
        zin: c.T('De mails van CUSTOM+ komen op dit adres.'),
        meer: [c.T('Je bent de hoofdcontactpersoon van dit account; wat je precies krijgt, stel je in onder Meldingen.')]
      })
    ]);
  }

  /* waar de gegevens staan, in één zin plus de rest: {zin, meer}. Zonder
     datalaag weten we het niet en zeggen we dat ook. */
  function opslagZin(c) {
    var m = modusVan(c);
    if (m === 'supa') {
      return {
        zin: c.T('Je gegevens staan in de database van CUSTOM+ bij Supabase; alleen jij en CUSTOM+ kunnen erbij.'),
        meer: [c.T('Elke rij is met toegangsregels beperkt tot je eigen klantaccount, via je login.')]
      };
    }
    if (m === 'demo') {
      return {
        zin: c.T('Je werkt in de demo: alles staat alleen in deze browser en bereikt geen server.'),
        meer: [c.T('Het portaal en het beheer delen op dit apparaat dezelfde browseropslag; alles verdwijnt zodra je de browsergegevens wist.')]
      };
    }
    return { zin: c.T('Waar je gegevens staan, hangt af van de omgeving waarin dit portaal draait; die kon nu niet worden vastgesteld.'), meer: [] };
  }

  function instellingen(ctx) {
    var c = context(ctx);
    if (!c.ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen; het scherm Instellingen kan niet worden getekend.');
    /* de twee tellingen op de kaarten komen uit de datalaag; een lijst die
       niet laadt, kost geen scherm */
    var contacten = (c.data && fn(c.data.listContacts)) ? tolerant(c.data.listContacts()) : Promise.resolve(null);
    var klant = (c.data && fn(c.data.mijnKlant)) ? tolerant(c.data.mijnKlant()) : Promise.resolve(null);
    return Promise.all([contacten, klant]).then(function (r) {
      return tekenOverzicht(c, r[0], r[1]);
    });
  }

  function tekenOverzicht(c, contacten, klant) {
    var ui = c.ui;
    var T = c.T;
    var wortel = ui.el('div', { class: 'k-instellingen' });

    wortel.appendChild(ui.pageHeader({ kicker: T('Jouw account'), titel: T('Instellingen') }));
    wortel.appendChild(uitleg(c, {
      zin: T('Je mensen, je meldingen, je taal en je gegevens.'),
      meer: [T('Bij je mensen en je meldingen staan wijzigingen pas vast als je ze opslaat; loop je weg met onopgeslagen werk, dan krijg je een waarschuwing.')],
      stijl: 'margin:0 0 30px;'
    }));

    var hoofd = ui.el('div', { class: 'u-cols-main' });
    var rail = ui.el('div', { class: 'u-cols-side' });

    var raster = ui.el('div', { class: 'u-setgrid' });
    CATEGORIEEN.forEach(function (cat) {
      var meta = '';
      if (cat.key === 'mensen') meta = metaMensen(c, contacten);
      else if (cat.key === 'meldingen') meta = metaMeldingen(c, klant);
      else if (cat.key === 'taal') meta = metaTaal(c);
      else meta = metaToegang(c);
      var route = routeNaar(c, { area: 'instellingen', tab: cat.key }, '#/instellingen/' + cat.key);
      var kaartEl = ui.settingsCategoryCard({
        icoon: cat.icoon, toon: cat.tint,
        titel: T(cat.label),
        uitleg: T(cat.uitleg),
        meta: meta + ' →',
        route: route,
        onGa: c.ga || null
      });
      /* de meta van Taal is een taalnaam en dus data; de andere drie zijn
         vertaalde zinnen die de DOM-pass met rust laat */
      if (cat.key === 'taal') {
        var metaEl = kaartEl.querySelector ? kaartEl.querySelector('.u-setcard-meta') : null;
        if (metaEl) alsData(metaEl);
      }
      raster.appendChild(geenOnderstreping(kaartEl));
    });
    hoofd.appendChild(raster);

    rail.appendChild(ui.el('div', { class: 'u-sticky' }, [
      accountKaart(c),
      kaart(ui, [
        ui.sectionHead({ titel: T('Waar je gegevens staan') }),
        uitleg(c, opslagZin(c)),
        c.ga ? ui.el('p', { style: 'margin:14px 0 0;' }, ui.el('button', {
          type: 'button', class: 'u-link', text: T('Lees meer onder Toegang en gegevens'),
          onclick: function () { ga(c, { area: 'instellingen', tab: 'toegang' }, '#/instellingen/toegang'); }
        })) : null
      ])
    ]));

    wortel.appendChild(ui.el('div', { class: 'u-cols' }, [hoofd, rail]));
    return wortel;
  }

  /* ---- 2b. het geraamte van een categoriepagina (mockup 5.10) -------- */

  function categorieKaart(c, cat) {
    var ui = c.ui;
    return kaart(ui, [
      ui.sectionHead({ titel: c.T('Onderdeel') }),
      ui.el('div', { style: 'margin-bottom:12px;' }, ui.statusChip({ label: c.T(cat.label), toon: 'nu' })),
      ui.el('p', { class: 'u-lees', style: 'margin:0;', text: c.T(cat.uitleg) })
    ]);
  }

  function geraamte(c, cat) {
    var ui = c.ui;
    var terugRoute = routeNaar(c, { area: 'instellingen' }, '#/instellingen');
    var wortel = ui.el('div', { class: 'k-instellingen k-instellingen-' + cat.key });
    var regio = statusRegio(ui);
    wortel.appendChild(regio);
    wortel.appendChild(ui.pageHeader({
      crumbs: [{ label: c.T('Instellingen'), route: terugRoute }, { label: c.T(cat.label) }],
      titel: c.T(cat.label)
    }));
    /* het kruimelpad van CP_UI heeft een vast Nederlands aria-label */
    vertaalAttribuut(wortel, '.u-crumb', 'aria-label', c.T('Kruimelpad'));
    /* ook de topbalk laat zien waar je bent */
    if (c.zetKruimels) c.zetKruimels([{ label: c.T('Instellingen'), route: terugRoute }, { label: c.T(cat.label) }]);
    wortel.appendChild(uitleg(c, {
      zin: c.T(cat.subtitel),
      meer: arr(cat.meer).map(function (s) { return c.T(s); }),
      stijl: 'margin:0 0 30px;'
    }));

    var hoofd = ui.el('div', { class: 'u-cols-main' });
    var rail = ui.el('div', { class: 'u-cols-side' });
    var railBinnen = ui.el('div', { class: 'u-sticky' });
    rail.appendChild(railBinnen);
    wortel.appendChild(ui.el('div', { class: 'u-cols' }, [hoofd, rail]));
    return { wortel: wortel, hoofd: hoofd, rail: railBinnen, regio: regio, terugRoute: terugRoute };
  }

  /* HET OMGEKEERDE OPSLAGMODEL, ÉÉN KEER. De opslagbalk, de guard en de
     opruiming voor elke categorie die buffert. opts: {isVuil, opslaan (→
     Promise), herstel, naam}. Geeft {markeer, balk} terug. */
  function opslagModel(c, d, opts) {
    var ui = c.ui;
    var balk = ui.saveBar({
      dirty: false,
      tekst: c.T('Niet opgeslagen'),
      bezigTekst: c.T('Bezig met opslaan…'),
      herstelLabel: c.T('Herstel'),
      opslaanLabel: c.T('Wijzigingen opslaan'),
      opHerstel: function () {
        opts.herstel();
        balk.zetDirty(false);
        toast(c, c.T('Wijzigingen teruggedraaid.'));
        meldIn(d.regio, c.T('Wijzigingen teruggedraaid.'));
      },
      opOpslaan: function () {
        if (!opts.isVuil()) return;
        balk.zetBezig(true);
        meldIn(d.regio, c.T('Bezig met opslaan…'));
        var uit;
        try { uit = opts.opslaan(); } catch (e) { uit = Promise.reject(e); }
        Promise.resolve(uit).then(function () {
          balk.zetBezig(false);
          balk.zetDirty(opts.isVuil());
          if (!opts.isVuil()) {
            toast(c, c.T('Wijzigingen opgeslagen.'));
            meldIn(d.regio, c.T('Wijzigingen opgeslagen.'));
          }
        }, function (e) {
          balk.zetBezig(false);
          balk.zetDirty(opts.isVuil());
          var t = foutTekst(c, e, 'Opslaan is niet gelukt. Probeer het opnieuw.');
          toast(c, t);
          meldIn(d.regio, t);
        });
      }
    });
    d.wortel.appendChild(balk.el);

    /* de navigatiewaarschuwing: de shell leegt zijn guardlijst vlak vóór
       elke tekening, dus een scherm meldt zich elke keer opnieuw aan. De
       tekst is al vertaald; portal.html haalt hem nog een keer door i18nT
       en dat is dan een nul-bewerking. */
    if (c.guard) {
      c.guard(function () {
        planOpruiming();
        if (!opts.isVuil()) return null;
        return c.Tpl('Je hebt onopgeslagen wijzigingen bij {naam}. Weglopen gooit ze weg.', { naam: c.T(opts.naam) });
      });
    }
    /* de balk houdt op smalle schermen de onderrand van de werkkolom vrij
       en moet die teruggeven zodra dit scherm verdwijnt: de shell mág
       wortel.stop() aanroepen, en anders merkt het scherm het zelf */
    function losgekoppeld() {
      if (!d.wortel.parentNode) return true;
      var doc = d.wortel.ownerDocument;
      if (doc && doc.body && doc.body.contains) return !doc.body.contains(d.wortel);
      return false;
    }
    function planOpruiming() {
      var g = G();
      if (!g || !fn(g.setTimeout)) return;
      g.setTimeout(function () { if (losgekoppeld()) balk.stop(); }, 0);
      g.setTimeout(function () { if (losgekoppeld()) balk.stop(); }, 600);
    }
    d.wortel.stop = function () { balk.stop(); };

    return {
      balk: balk,
      markeer: function () { balk.zetDirty(opts.isVuil()); }
    };
  }

  /* de eerlijke regel voor de eigenaar die als klant meekijkt: in de
     voorvertoning is schrijven geweigerd door portal.html (kSchrijf), en
     dat hoort het scherm vooraf te zeggen in plaats van pas bij opslaan */
  function voorvertoningRegel(c) {
    if (!c.voorvertoning) return null;
    return c.ui.el('p', {
      class: 'u-lees',
      style: 'max-width:70ch;margin:0 0 22px;padding:16px 18px;background:var(--warn-soft,#fbeee2);border:1px solid var(--line);border-radius:var(--r-card,20px);',
      text: c.T('Je kijkt mee als beheerder: in de voorvertoning wordt niets bewaard.')
    });
  }

  /* ---- 2c. JOUW MENSEN -------------------------------------------- */

  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function isTijdelijk(id) { return str(id).indexOf('nieuw-') === 0; }

  /* het formulier voor één contactpersoon, inline in de lijst. Geeft de
     kaart terug; opts.onKlaar(contact) krijgt de nieuwe waarden, opts
     .onAnnuleer sluit zonder iets te doen. */
  function contactFormulier(c, contact, opts) {
    var ui = c.ui;
    var T = c.T;
    var ct = opt(contact);
    var nieuw = !str(ct.id);

    var naam = ui.el('input', { class: 'input', type: 'text', autocomplete: 'name', required: 'required' });
    naam.value = str(ct.name);
    var functie = ui.el('input', { class: 'input', type: 'text', placeholder: T('Bijvoorbeeld: inkoop, marketing, ontwerp') });
    functie.value = str(ct.role);
    var email = ui.el('input', { class: 'input', type: 'email', autocomplete: 'email', inputmode: 'email' });
    email.value = str(ct.email);

    var fout = ui.el('p', { class: 'u-sub', role: 'alert', style: 'margin:0 0 14px;color:var(--crit-ink,#8a3324);' });
    fout.hidden = true;

    /* de soorten mail als drie standen (zelfde kiezer als Meldingen); een
       nieuwe contactpersoon zonder soorten start eerlijk in Zelf kiezen met
       alles uit — mail_categories kent geen "ontbreekt = aan" */
    var huidigeCats = arr(ct.mailCategories);
    var startWaarden = {};
    rollen(c).forEach(function (r) { startWaarden[r.key] = huidigeCats.indexOf(r.key) > -1; });
    var catVak = mailStandKiezer(c, {
      waarden: startWaarden,
      cats: rollen(c),
      label: T('Welke mail krijgt deze persoon?'),
      derde: true
    });

    var login = ui.el('input', { type: 'checkbox', checked: !!ct.canLogin });
    var loginVak = ui.el('div', { style: 'margin:6px 0 18px;' }, [
      ui.el('label', { class: 'checkline', style: 'margin-bottom:6px;' }, [login, ui.el('span', { text: T('Mag inloggen in dit portaal') })]),
      /* EERLIJKHEIDSREGEL: het vinkje is een wens, geen account */
      ui.el('span', { class: 'u-sub', style: 'display:block;margin-left:25px;max-width:62ch;', text: T('Dit vinkje is een aanvraag: Steffan maakt de toegang aan en nodigt deze persoon per mail uit.') })
    ]);

    function lees() {
      var cats = [];
      var gekozenMail = catVak.lees();
      rollen(c).forEach(function (r) { if (gekozenMail[r.key] === true) cats.push(r.key); });
      return {
        id: str(ct.id),
        clientId: ct.clientId || null,
        name: str(naam.value).replace(/^\s+|\s+$/g, ''),
        role: str(functie.value).replace(/^\s+|\s+$/g, ''),
        email: str(email.value).replace(/^\s+|\s+$/g, '').toLowerCase(),
        mailCategories: cats,
        canLogin: !!login.checked,
        avatarUrl: str(ct.avatarUrl)
      };
    }
    function toonFout(tekst, veld) {
      fout.textContent = str(tekst);
      fout.hidden = false;
      if (veld && fn(veld.focus)) veld.focus();
    }

    var klaar = ui.el('button', { type: 'submit', class: 'u-btn klein', text: nieuw ? T('Toevoegen aan de lijst') : T('Klaar') });
    var annuleer = ui.el('button', {
      type: 'button', class: 'u-btn ghost klein', text: T('Annuleer'),
      onclick: function () { if (fn(opts.onAnnuleer)) opts.onAnnuleer(); }
    });

    var form = ui.el('form', {
      novalidate: 'novalidate',
      'aria-label': nieuw ? T('Nieuwe contactpersoon') : c.Tpl('Contactpersoon bewerken: {naam}', { naam: str(ct.name) }),
      onsubmit: function (e) {
        e.preventDefault();
        var w = lees();
        /* dezelfde twee controles als de datalaag, hier vooraf zodat de
           klant een zin krijgt bij het veld en niet pas bij opslaan */
        if (!w.name) { toonFout(T('Vul een naam in.'), naam); return; }
        if (w.email && !EMAIL_RE.test(w.email)) { toonFout(T('Dit e-mailadres ziet er niet goed uit.'), email); return; }
        if (!w.email && w.mailCategories.length) { toonFout(T('Zonder e-mailadres kan deze persoon geen mail krijgen. Vul een adres in of zet de soorten mail uit.'), email); return; }
        fout.hidden = true;
        if (fn(opts.onKlaar)) opts.onKlaar(w);
      }
    }, [
      ui.el('span', { class: 'u-kicker', style: 'display:block;margin-bottom:14px;', text: nieuw ? T('Nieuwe contactpersoon') : T('Contactpersoon bewerken') }),
      veldVak(ui, T('Naam'), naam),
      ui.el('div', { class: 'formrow' }, [
        veldVak(ui, T('Functie'), functie),
        veldVak(ui, T('E-mailadres'), email)
      ]),
      catVak,
      loginVak,
      fout,
      ui.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' }, [klaar, annuleer])
    ]);
    /* velden met de naam van de persoon erin zijn data */
    alsData(naam); alsData(functie); alsData(email);

    var vak = ui.el('div', { class: 'u-card', style: 'padding:22px;background:var(--card-2);' }, form);
    vak.focusEerste = function () {
      var g = G();
      if (!g || !fn(g.setTimeout)) return;
      g.setTimeout(function () { try { naam.focus(); } catch (e) { /* stil */ } }, 0);
    };
    return vak;
  }

  /* één contactpersoon als rij: avatar, naam, functie · e-mail, de
     mailcategorieën als chips, "mag inloggen", en ••• met bewerken en
     verwijderen (met bevestiging in het menu zelf) */
  function contactRij(c, contact, opts) {
    var ui = c.ui;
    var T = c.T;
    var ct = opt(contact);
    var naam = str(ct.name) || str(ct.email) || T('Naamloos');
    var sub = [str(ct.role), str(ct.email)].filter(function (s) { return !!s; }).join(' · ');
    var cats = arr(ct.mailCategories).map(function (k) { return { label: T(rolLabel(c, k)) }; });

    /* de chips staan ONDER naam en functie, niet in het staartstuk: vier
       chips naast een naam duwen die naam op elk scherm smaller dan 1100px
       op twee regels. In het staartstuk blijven alleen de login-stand en
       het menu, en die passen altijd. */
    var chips = cats.length
      ? ui.chipRow({ chips: cats, max: 4, restTitel: T('Ook nog') })
      : ui.el('span', { class: 'u-row-meta', text: T('Krijgt geen mail') });
    chips.style.marginTop = '8px';
    var einde = [];
    einde.push(ct.canLogin
      ? ui.statusDot({ toon: 'ok', label: T('Mag inloggen') })
      : ui.statusDot({ toon: 'neutraal', label: T('Geen login') }));

    if (!opts.uit) {
      var menu = ui.contextMenu({
        knop: { titel: c.Tpl('Meer acties bij {naam}', { naam: naam }) },
        items: [
          { label: T('Bewerken'), ico: 'potlood', onKies: function () { if (fn(opts.onBewerk)) opts.onBewerk(ct); } },
          {
            label: T('Verwijderen'), gevaarlijk: true,
            bevestig: { vraag: c.Tpl('{naam} uit je mensen verwijderen? Dat staat pas vast als je opslaat.', { naam: naam }), bevestigLabel: T('Ja, verwijderen') },
            onKies: function () { if (fn(opts.onVerwijder)) opts.onVerwijder(ct); }
          }
        ]
      });
      einde.push(menu.el);
    }

    return ui.el('div', { class: 'u-row', style: 'gap:16px;' }, [
      alsData(ui.avatar({ naam: naam, url: str(ct.avatarUrl) || null, maat: 36 })),
      ui.el('div', { class: 'u-row-main' }, [
        alsData(ui.el('span', { class: 'u-row-title', text: naam })),
        sub ? alsData(ui.el('span', { class: 'u-row-sub', text: sub })) : null,
        chips
      ]),
      ui.el('div', { class: 'u-row-end', style: 'gap:12px;' }, einde)
    ]);
  }

  function mensenPagina(c, cat, d) {
    var ui = c.ui;
    var T = c.T;
    if (!c.data || !fn(c.data.listContacts)) {
      d.hoofd.appendChild(ui.emptyState({ titel: T('De lijst met je mensen kon niet worden geladen; vernieuw de pagina.') }));
      d.rail.appendChild(categorieKaart(c, cat));
      return Promise.resolve();
    }
    return tolerant(c.data.listContacts()).then(function (lijst) {
      tekenMensen(c, cat, d, lijst);
    });
  }

  function tekenMensen(c, cat, d, geladen) {
    var ui = c.ui;
    var T = c.T;
    var kanSchrijven = !!(haak(c, 'contactpersoonOpslaan') && haak(c, 'contactpersoonVerwijderen'));
    var alleenLezen = c.voorvertoning || !kanSchrijven;

    /* --- de werkkopie --- */
    var origineel = arr(geladen);
    var werk = { lijst: [], verwijderd: [], gewijzigd: {}, teller: 0 };
    var bewerkId = null;   /* welke rij staat als formulier */
    var nieuwOpen = false; /* staat het formulier voor een nieuwe persoon open */

    function reset() {
      werk.lijst = kloon(origineel);
      werk.verwijderd = [];
      werk.gewijzigd = {};
      bewerkId = null;
      nieuwOpen = false;
    }
    function isVuil() { return werk.verwijderd.length > 0 || sleutelsVan(werk.gewijzigd).length > 0; }
    reset();

    var model = null; /* de opslagbalk, gezet zodra de kaarten staan */

    var lijstVak = ui.el('div');
    var toevoegKnop = null;

    function tekenLijst() {
      ui.clear(lijstVak);
      var rijen = [];
      if (nieuwOpen) {
        var fNieuw = contactFormulier(c, null, {
          onKlaar: function (w) {
            werk.teller += 1;
            w.id = 'nieuw-' + werk.teller;
            werk.lijst.push(w);
            werk.gewijzigd[w.id] = true;
            nieuwOpen = false;
            if (model) model.markeer();
            meldIn(d.regio, c.Tpl('{naam} is toegevoegd aan de lijst; sla op om het vast te leggen.', { naam: w.name }));
            tekenLijst();
          },
          onAnnuleer: function () { nieuwOpen = false; tekenLijst(); if (toevoegKnop) toevoegKnop.focus(); }
        });
        rijen.push(fNieuw);
        fNieuw.focusEerste();
      }
      werk.lijst.forEach(function (ct) {
        if (bewerkId && str(ct.id) === bewerkId) {
          var f = contactFormulier(c, ct, {
            onKlaar: function (w) {
              for (var k in w) if (Object.prototype.hasOwnProperty.call(w, k)) ct[k] = w[k];
              werk.gewijzigd[str(ct.id)] = true;
              bewerkId = null;
              if (model) model.markeer();
              meldIn(d.regio, c.Tpl('{naam} is aangepast; sla op om het vast te leggen.', { naam: w.name }));
              tekenLijst();
            },
            onAnnuleer: function () { bewerkId = null; tekenLijst(); }
          });
          rijen.push(f);
          f.focusEerste();
          return;
        }
        rijen.push(contactRij(c, ct, {
          uit: alleenLezen,
          onBewerk: function (x) { nieuwOpen = false; bewerkId = str(x.id); tekenLijst(); },
          onVerwijder: function (x) {
            werk.lijst = werk.lijst.filter(function (y) { return y !== x; });
            if (str(x.id) && !isTijdelijk(x.id)) werk.verwijderd.push(str(x.id));
            delete werk.gewijzigd[str(x.id)];
            if (model) model.markeer();
            meldIn(d.regio, c.Tpl('{naam} wordt verwijderd zodra je opslaat.', { naam: str(x.name) }));
            tekenLijst();
          }
        }));
      });
      if (!rijen.length) {
        lijstVak.appendChild(ui.emptyTile({
          icoon: 'team',
          titel: T('Nog geen contactpersonen'),
          actie: (!alleenLezen) ? { label: T('Contactpersoon toevoegen'), onClick: function () { nieuwOpen = true; tekenLijst(); } } : null
        }));
        return;
      }
      /* de formulierkaarten staan tussen de rijen; entityList wil alleen
         knopen en dat zijn het allebei */
      var lijst = ui.entityList(rijen, { leegTitel: T('Nog geen contactpersonen') });
      lijstVak.appendChild(lijst);
    }

    /* --- de hoofdcontactpersoon: jij --- */
    var jij = kaart(ui, [
      ui.sectionHead({ titel: T('Jij') }),
      ui.el('div', { class: 'u-row', style: 'padding:0;gap:16px;' }, [
        alsData(ui.avatar({ naam: str(c.klant.naam) || str(c.klant.email) || T('Jij'), maat: 36 })),
        ui.el('div', { class: 'u-row-main' }, [
          alsData(ui.el('span', { class: 'u-row-title', text: str(c.klant.naam) || str(c.klant.email) || T('Jij') })),
          ui.el('span', { class: 'u-row-sub', text: T('Hoofdcontactpersoon — logt in en ontvangt de mails die je onder Meldingen aanzet.') })
        ]),
        ui.el('div', { class: 'u-row-end' }, [
          ui.statusDot({ toon: 'ok', label: T('Mag inloggen') }),
          c.ga ? ui.el('button', {
            type: 'button', class: 'u-btn ghost klein', text: T('Meldingen'),
            onclick: function () { ga(c, { area: 'instellingen', tab: 'meldingen' }, '#/instellingen/meldingen'); }
          }) : null
        ])
      ])
    ]);
    d.hoofd.appendChild(jij);

    /* --- de lijst --- */
    var vv = voorvertoningRegel(c);
    if (vv) { vv.style.marginTop = '20px'; d.hoofd.appendChild(vv); }

    var kopActie = null;
    if (!alleenLezen) {
      toevoegKnop = ui.el('button', {
        type: 'button', class: 'u-btn klein',
        onclick: function () { bewerkId = null; nieuwOpen = true; tekenLijst(); }
      }, [ui.el('span', { text: T('Contactpersoon toevoegen') }), ui.icon('plus', 16)]);
      kopActie = toevoegKnop;
    }
    var lijstKop = sectiekop(ui, { titel: T('Jouw mensen'), telling: origineel.length, actie: kopActie });
    lijstKop.style.marginTop = '26px';
    d.hoofd.appendChild(lijstKop);
    if (!kanSchrijven && !c.voorvertoning) {
      d.hoofd.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:0 0 14px;', text: T('Toevoegen en wijzigen is hier nog niet beschikbaar.') }));
    }
    d.hoofd.appendChild(lijstVak);
    tekenLijst();

    /* --- de rail --- */
    d.rail.appendChild(kaart(ui, [
      ui.sectionHead({ titel: T('Wat je mensen krijgen') }),
      uitleg(c, {
        zin: T('Per persoon kies je welke soorten mail iemand krijgt; jouw eigen mails regel je onder Meldingen.'),
        meer: [T('Iemand zonder soorten krijgt geen mail; iedereen met een login ziet alles in dit portaal.')]
      })
    ]));
    d.rail.appendChild(categorieKaart(c, cat));

    if (alleenLezen) return;

    /* --- opslaan: eerst de verwijderingen, dan de wijzigingen, één voor
       één; bij de eerste fout stoppen — doorschrijven na een fout geeft
       een half opgeslagen lijst waarvan niemand weet welke helft */
    model = opslagModel(c, d, {
      naam: cat.label,
      isVuil: isVuil,
      herstel: function () { reset(); tekenLijst(); },
      opslaan: function () {
        var stappen = [];
        werk.verwijderd.forEach(function (id) { stappen.push({ soort: 'weg', id: id }); });
        werk.lijst.forEach(function (ct) { if (werk.gewijzigd[str(ct.id)]) stappen.push({ soort: 'bewaar', contact: ct }); });
        var i = 0;
        function volgende() {
          if (i >= stappen.length) {
            /* de lijst vers uit de datalaag: dan staan de echte id's en de
               sortering er, zonder het hele scherm opnieuw te laden */
            return tolerant(c.data.listContacts()).then(function (l) {
              if (Array.isArray(l)) origineel = l;
              else origineel = kloon(werk.lijst);
              reset();
              tekenLijst();
            });
          }
          var s = stappen[i];
          i += 1;
          var belofte;
          if (s.soort === 'weg') {
            belofte = haak(c, 'contactpersoonVerwijderen')({ id: s.id }).then(function () {
              werk.verwijderd = werk.verwijderd.filter(function (x) { return x !== s.id; });
            });
          } else {
            var inv = kloon(s.contact);
            if (isTijdelijk(inv.id)) inv.id = '';
            belofte = haak(c, 'contactpersoonOpslaan')(inv).then(function (rij) {
              var oudId = str(s.contact.id);
              delete werk.gewijzigd[oudId];
              if (isObj(rij)) {
                for (var k in rij) if (Object.prototype.hasOwnProperty.call(rij, k)) s.contact[k] = rij[k];
              }
            });
          }
          return belofte.then(volgende);
        }
        return volgende();
      }
    });
  }

  /* ---- 2d. MELDINGEN ------------------------------------------------ */

  function meldingenPagina(c, cat, d) {
    var ui = c.ui;
    var T = c.T;
    if (!c.data || !fn(c.data.mijnKlant)) {
      d.hoofd.appendChild(ui.emptyState({ titel: T('Je meldingen konden niet worden geladen; vernieuw de pagina.') }));
      d.rail.appendChild(categorieKaart(c, cat));
      return Promise.resolve();
    }
    return tolerant(c.data.mijnKlant()).then(function (klant) {
      tekenMeldingen(c, cat, d, klant);
    });
  }

  function tekenMeldingen(c, cat, d, klant) {
    var ui = c.ui;
    var T = c.T;
    var kanSchrijven = !!haak(c, 'meldingenOpslaan');
    var alleenLezen = c.voorvertoning || !kanSchrijven || !isObj(klant);
    var cats = rollen(c);

    /* de buffer: alle zes sleutels, aan tenzij uitgezet */
    var origineel = {};
    cats.forEach(function (r) { origineel[r.key] = !(isObj(klant) && isObj(klant.meldingen) && klant.meldingen[r.key] === false); });
    var buffer = kloon(origineel);
    function isVuil() {
      for (var i = 0; i < cats.length; i++) if (buffer[cats[i].key] !== origineel[cats[i].key]) return true;
      return false;
    }

    var model = null;

    var vv = voorvertoningRegel(c);
    if (vv) d.hoofd.appendChild(vv);

    var adres = str(c.klant.email) || (isObj(klant) ? str(klant.email) : '');
    /* de drie standen boven de zes soorten; de buffer volgt elke wijziging
       en de opslagbalk leest de buffer, precies als voorheen — er wordt
       niets anders opgeslagen dan de zes waarden */
    var kiezer = mailStandKiezer(c, {
      waarden: buffer,
      cats: cats,
      label: T('Welke mail wil je krijgen?'),
      alleenLezen: alleenLezen,
      onWijzig: function (w) {
        buffer = w;
        if (model) model.markeer();
      }
    });

    /* één zin boven de kiezer (waar de mails heen gaan), de gevolgen van
       uitzetten achter de "i"; de zin per stand komt uit de kiezer zelf */
    var formulier = ui.el('div', { class: 'u-card', style: 'padding:26px;' }, [
      !isObj(klant) ? ui.el('p', { class: 'u-sub', style: 'margin:0 0 16px;', text: T('Je huidige voorkeuren konden niet worden geladen; hieronder staat de standaard.') }) : null,
      uitleg(c, {
        zin: adres ? c.Tpl('Deze mails gaan naar {email}.', { email: adres }) : T('De mails gaan naar het adres waarmee je inlogt.'),
        data: !!adres,
        meer: [T('Zet je een soort uit, dan stuurt CUSTOM+ die mails niet meer; in het portaal zie je alles nog gewoon.')],
        stijl: 'margin:0 0 18px;'
      }),
      kiezer
    ]);
    d.hoofd.appendChild(formulier);

    d.rail.appendChild(kaart(ui, [
      ui.sectionHead({ titel: T('Wie krijgt wat') }),
      ui.el('p', { class: 'u-lees', style: 'margin:0;', text: T('Welke mail je collega’s krijgen, regel je per persoon onder Jouw mensen.') }),
      c.ga ? ui.el('p', { style: 'margin:14px 0 0;' }, ui.el('button', {
        type: 'button', class: 'u-link', text: T('Naar Jouw mensen'),
        onclick: function () { ga(c, { area: 'instellingen', tab: 'mensen' }, '#/instellingen/mensen'); }
      })) : null
    ]));
    d.rail.appendChild(categorieKaart(c, cat));

    if (alleenLezen) return;

    model = opslagModel(c, d, {
      naam: cat.label,
      isVuil: isVuil,
      herstel: function () {
        buffer = kloon(origineel);
        kiezer.zet(buffer);
      },
      opslaan: function () {
        return haak(c, 'meldingenOpslaan')(kloon(buffer)).then(function (rij) {
          /* de nieuwe stand van de server is de nieuwe waarheid */
          if (isObj(rij) && isObj(rij.meldingen)) {
            cats.forEach(function (r) { origineel[r.key] = rij.meldingen[r.key] !== false; });
          } else {
            origineel = kloon(buffer);
          }
          buffer = kloon(origineel);
          kiezer.zet(buffer);
        });
      }
    });
  }

  /* ---- 2e. TAAL — een handeling, geen formulier ----------------------- */

  function taalPagina(c, cat, d) {
    var ui = c.ui;
    var T = c.T;
    var kies = haak(c, 'taalKiezen');
    var knoppen = [];

    var vv = null;
    if (c.voorvertoning) {
      vv = ui.el('p', { class: 'u-sub', style: 'margin:0 0 18px;max-width:66ch;', text: T('In de voorvertoning wisselt alleen dit scherm van taal; de voorkeur van de klant blijft staan.') });
      d.hoofd.appendChild(vv);
    }

    var groep = ui.el('div', { class: 'u-card u-rows', role: 'group', 'aria-label': T('Taal') });
    talen(c).forEach(function (code) {
      var actief = code === c.lang;
      var knop = ui.el('button', {
        type: 'button', class: 'u-row',
        'aria-pressed': actief ? 'true' : 'false',
        disabled: !kies,
        onclick: function () {
          if (!kies || code === c.lang) return;
          knoppen.forEach(function (k) { zetBezig(k, true); });
          meldIn(d.regio, T('Bezig met opslaan…'));
          var uit;
          try { uit = kies(code); } catch (e) { uit = Promise.reject(e); }
          Promise.resolve(uit).then(function () {
            /* het scherm is intussen al in de nieuwe taal hertekend
               (setLang → ververs); de toast bevestigt dat de voorkeur is
               bewaard */
            toast(c, c.T('Taal opgeslagen.'));
          }, function (e) {
            knoppen.forEach(function (k) { zetBezig(k, false); });
            var t = foutTekst(c, e, 'De taal kon niet worden bewaard.');
            toast(c, t);
            meldIn(d.regio, t);
          });
        }
      }, [
        alsData(ui.el('span', { class: 'u-thumb ph', 'aria-hidden': 'true', text: TAALCODES[code] || code.toUpperCase() })),
        ui.el('span', { class: 'u-row-main' }, [
          alsData(ui.el('span', { class: 'u-row-title', text: TAALNAMEN[code] || code }))
        ]),
        ui.el('span', { class: 'u-row-end' }, [
          actief ? ui.statusDot({ toon: 'ok', label: T('Nu actief') }) : ui.el('span', { class: 'u-row-meta', text: T('Kies') })
        ])
      ]);
      knoppen.push(knop);
      groep.appendChild(knop);
    });
    d.hoofd.appendChild(groep);

    if (!kies) {
      d.hoofd.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:14px 0 0;', text: T('Taal kiezen is hier nog niet beschikbaar; gebruik de taalknoppen bovenaan.') }));
    }

    /* EERLIJK OVER DE MAILS, in de ene zin zelf: het beheer kent alleen
       Nederlandse en Engelse sjablonen (mailLangOf in beheer.html) */
    d.rail.appendChild(kaart(ui, [
      ui.sectionHead({ titel: T('Wat je keuze doet') }),
      uitleg(c, {
        zin: T('Je keuze geldt meteen voor dit portaal; je mails komen in het Nederlands of anders in het Engels.'),
        meer: [T('De keuze wordt bewaard als jouw voorkeur bij CUSTOM+.'), T('De mails van CUSTOM+ bestaan alleen in het Nederlands en het Engels; kies je een andere taal, dan komen je mails in het Engels.')]
      })
    ]));
    d.rail.appendChild(categorieKaart(c, cat));
    return null;
  }

  /* ---- 2f. TOEGANG EN GEGEVENS ---------------------------------------- */

  /* de apparaten uit de eigen logregels: per combinatie (browser · OS ·
     tijdzone) de laatste keer en het aantal. Alleen rijen van de klant
     zelf, want alleen die dragen de tag. */
  function apparaten(c, log) {
    var per = {};
    arr(log).forEach(function (r) {
      if (!isObj(r) || str(r.actor) !== 'client') return;
      var tag = apparaatVan(r.detail);
      if (!tag) return;
      if (!per[tag]) per[tag] = { tag: tag, aantal: 0, laatste: '' };
      per[tag].aantal += 1;
      var at = str(r.createdAt);
      if (at > per[tag].laatste) per[tag].laatste = at;
    });
    var uit = sleutelsVan(per).map(function (k) { return per[k]; });
    uit.sort(function (a, b) { return (a.laatste < b.laatste) ? 1 : ((a.laatste > b.laatste) ? -1 : ((a.tag < b.tag) ? -1 : 1)); });
    return uit;
  }

  function toegangPagina(c, cat, d) {
    var ui = c.ui;
    var T = c.T;
    var bundle = c.bundle;
    var project = bundle ? opt(bundle.project) : {};
    var log = bundle ? arr(bundle.accessLog) : [];
    var modus = modusVan(c);

    /* --- jouw account --- */
    var naam = str(c.klant.naam) || str(c.klant.email) || T('Jij');
    d.hoofd.appendChild(kaart(ui, [
      ui.sectionHead({ titel: T('Jouw account') }),
      ui.el('div', { style: 'display:flex;align-items:center;gap:14px;' }, [
        alsData(ui.avatar({ naam: naam, maat: 48 })),
        ui.el('span', { style: 'min-width:0;display:block;' }, [
          alsData(ui.el('span', { class: 'u-row-title', text: naam })),
          str(c.klant.bedrijf) ? alsData(ui.el('span', { class: 'u-row-sub', text: str(c.klant.bedrijf) })) : null,
          str(c.klant.email) ? alsData(ui.el('span', { class: 'u-row-sub', text: str(c.klant.email) })) : null
        ])
      ]),
      ui.el('p', { class: 'u-sub', style: 'margin:14px 0 0;', text: (modus === 'demo') ? T('Dit is een demo-account.') : T('Ingelogd als hoofdcontactpersoon van dit account.') })
    ]));

    /* --- apparaten --- */
    var app = apparaten(c, log);
    var appKinderen = [ui.sectionHead({ titel: T('Apparaten waarmee je dit portaal gebruikte') })];
    /* EERLIJK: er is geen inlogregel; dit komt uit je eigen handelingen.
       Eén zin op de kaart, de rest (wat wél wordt vastgelegd, en dat dit
       per product is) achter de "i". */
    var appMeer = [T('Het portaal legt geen inlogmoment vast; wat het wél vastlegt is een bestand bekijken of downloaden, een akkoord geven, een betaling melden.')];
    if (c.projecten.length > 1) appMeer.push(T('Dit overzicht hoort bij het product dat nu open staat; wissel van product om een ander logboek te zien.'));
    appKinderen.push(uitleg(c, {
      klasse: 'u-sub', stijl: 'margin:0 0 16px;',
      zin: productNaam(project)
        ? c.Tpl('De apparaten waarmee je zelf iets deed in {product}; een aparte inlogregel is er niet.', { product: productNaam(project) })
        : T('De apparaten waarmee je zelf iets deed in je product; een aparte inlogregel is er niet.'),
      data: !!productNaam(project),
      meer: appMeer
    }));
    if (!app.length) {
      appKinderen.push(ui.emptyTile({ icoon: 'gebruiker', titel: T('Nog geen handelingen vastgelegd') }));
    } else {
      var rijen = app.map(function (a) {
        return ui.el('div', { class: 'u-row', style: 'gap:16px;' }, [
          ui.iconTile({ icoon: 'gebruiker', toon: 'neutraal', maat: 40 }),
          ui.el('div', { class: 'u-row-main' }, [
            alsData(ui.el('span', { class: 'u-row-title', text: a.tag })),
            ui.el('span', { class: 'u-row-sub', text: (a.aantal === 1)
              ? c.Tpl('Laatst gebruikt op {datum} · 1 handeling', { datum: datumKort(c, a.laatste) })
              : c.Tpl('Laatst gebruikt op {datum} · {n} handelingen', { datum: datumKort(c, a.laatste), n: a.aantal }) })
          ])
        ]);
      });
      appKinderen.push(ui.entityList(rijen));
    }
    d.hoofd.appendChild(ui.el('div', { style: 'margin-top:20px;' }, kaart(ui, appKinderen)));

    /* --- de laatste eigen handelingen --- */
    var eigen = log.filter(function (r) { return isObj(r) && str(r.actor) === 'client'; }).slice(0, 8);
    if (eigen.length) {
      var hRijen = eigen.map(function (r) {
        var zin = regelTekst(c, { detail: r.detail, id: r.id }, r, null, null);
        var tag = apparaatVan(r.detail);
        var wanneer = [datumKort(c, r.createdAt), tijdTekst(c, r.createdAt)].filter(function (s) { return !!s; }).join(', ');
        return ui.el('div', { class: 'u-row', style: 'gap:16px;' }, [
          ui.el('div', { class: 'u-row-main' }, [
            alsData(ui.el('span', { class: 'u-row-title', text: zin.titel + (zin.tekst ? ': ' + zin.tekst : '') })),
            alsData(ui.el('span', { class: 'u-row-sub', text: wanneer + (tag ? ' · ' + tag : '') }))
          ])
        ]);
      });
      d.hoofd.appendChild(ui.el('div', { style: 'margin-top:20px;' }, kaart(ui, [
        ui.sectionHead({ titel: T('Je laatste handelingen'), actie: c.ga ? { label: T('Bekijk alle activiteit'), onClick: function () { ga(c, { area: 'activiteit' }, '#/activiteit'); } } : null }),
        ui.entityList(hRijen)
      ])));
    }

    /* --- download alles --- */
    var download = haak(c, 'downloadAlles');
    var dlKnop = ui.el('button', {
      type: 'button', class: 'u-btn', disabled: !download,
      onclick: function () {
        if (!download) return;
        zetBezig(dlKnop, true);
        meldIn(d.regio, T('Je dossier wordt samengesteld…'));
        var uit;
        try { uit = download(); } catch (e) { uit = Promise.reject(e); }
        Promise.resolve(uit).then(function () {
          zetBezig(dlKnop, false);
          toast(c, T('Je dossier wordt gedownload als JSON-bestand.'));
          meldIn(d.regio, T('Je dossier wordt gedownload als JSON-bestand.'));
        }, function (e) {
          zetBezig(dlKnop, false);
          var t = foutTekst(c, e, 'Het dossier kon niet worden samengesteld.');
          toast(c, t);
          meldIn(d.regio, t);
        });
      }
    }, [ui.el('span', { text: T('Download alles') }), ui.icon('bestand', 18)]);
    d.hoofd.appendChild(ui.el('div', { style: 'margin-top:20px;' }, kaart(ui, [
      ui.sectionHead({ titel: T('Download alles') }),
      uitleg(c, {
        stijl: 'margin:0 0 18px;',
        zin: T('Alles wat dit portaal over jou bewaart als één JSON-bestand, zonder de foto’s en PDF’s zelf.'),
        meer: [
          T('Erin: producten en fases, foto’s en documenten, facturen, samples, berichten, zendingen, je mensen en je herbestellingen; zonder interne notities van CUSTOM+.'),
          T('De bestanden zelf download je per stuk onder Bestanden.')
        ]
      }),
      dlKnop,
      !download ? ui.el('p', { class: 'u-sub', style: 'margin:12px 0 0;', text: T('Downloaden is hier nog niet beschikbaar.') }) : null
    ])));

    /* --- wat er van je wordt bewaard, en waar: één zin (waar), de rest
       achter de "i". GEEN REGIOCLAIM: config en migraties zeggen niets
       over de regio. */
    var waar = opslagZin(c);
    var waarMeer = arr(waar.meer).slice();
    waarMeer.push(T('Wat er wordt vastgelegd: wanneer je een bestand bekijkt of downloadt, en elke handeling die je in dit portaal doet — een akkoord, een samplekeuze, een gemelde betaling, een bericht, een upload; dat logboek lees je zelf onder Activiteit.'));
    waarMeer.push(T('Van je mensen bewaart CUSTOM+ alleen wat jij invult: naam, functie, e-mailadres en de gekozen soorten mail.'));
    d.hoofd.appendChild(ui.el('div', { style: 'margin-top:20px;' }, kaart(ui, [
      ui.sectionHead({ titel: T('Wat er van je wordt bewaard, en waar') }),
      uitleg(c, { zin: waar.zin, meer: waarMeer })
    ])));

    /* --- de rail --- */
    d.rail.appendChild(kaart(ui, [
      ui.sectionHead({ titel: T('Vragen over je gegevens?') }),
      ui.el('p', { class: 'u-lees', style: 'margin:0 0 14px;', text: T('Wil je iets laten aanpassen of verwijderen, stuur Steffan dan een bericht.') }),
      c.ga ? ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', text: T('Stel een vraag'),
        onclick: function () { ga(c, { area: 'berichten' }, '#/berichten'); }
      }) : null
    ]));
    d.rail.appendChild(categorieKaart(c, cat));
    return null;
  }

  /* ---- 2g. de categoriepagina ---------------------------------------- */

  function instellingCategorie(ctx) {
    var c = context(ctx);
    if (!c.ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen; deze instellingenpagina kan niet worden getekend.');
    var ui = c.ui;
    var T = c.T;
    var sleutel = tabUit(c, '');
    var cat = categorieVan(sleutel);
    var terugRoute = routeNaar(c, { area: 'instellingen' }, '#/instellingen');

    /* een onbekende categorie is geen fout van de klant maar een verkeerd
       adres; hij landt met uitleg terug op het overzicht */
    if (!cat) {
      var wortel = ui.el('div', { class: 'k-instellingen' });
      wortel.appendChild(ui.pageHeader({
        crumbs: [{ label: T('Instellingen'), route: terugRoute }, { label: T('Onbekend onderdeel') }],
        titel: T('Onbekend onderdeel')
      }));
      vertaalAttribuut(wortel, '.u-crumb', 'aria-label', T('Kruimelpad'));
      wortel.appendChild(ui.emptyState({
        titel: T('Dit onderdeel van Instellingen bestaat niet.'),
        actie: c.ga ? { label: T('Terug naar Instellingen'), onClick: function () { c.ga(terugRoute); } } : null
      }));
      return wortel;
    }

    var d = geraamte(c, cat);
    var werk = null;
    if (cat.key === 'mensen') werk = mensenPagina(c, cat, d);
    else if (cat.key === 'meldingen') werk = meldingenPagina(c, cat, d);
    else if (cat.key === 'taal') werk = taalPagina(c, cat, d);
    else werk = toegangPagina(c, cat, d);

    /* een pagina die eerst moet laden geeft een Promise terug; de montage
       in portal.html verdraagt allebei */
    if (werk && fn(werk.then)) return werk.then(function () { return d.wortel; });
    return d.wortel;
  }

  /* ============================================================
     3. EXPORT — deze lijst en het kopblok houden elkaar bij
     ============================================================ */
  return {
    VERSION: VERSION,
    activiteit: activiteit,
    activiteitBlok: activiteitBlok,
    instellingen: instellingen,
    instellingCategorie: instellingCategorie,
    CATEGORIEEN: CATEGORIEEN,
    ACT_FILTERS: ACT_FILTERS,
    soortVan: soortVan,
    MAIL_STANDEN: MAIL_STANDEN,
    BELANGRIJK: BELANGRIJK,
    mailStandVan: mailStandVan
  };
});
