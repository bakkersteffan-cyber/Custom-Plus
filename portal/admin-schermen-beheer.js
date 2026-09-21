/* CUSTOM+ — de drie beheerschermen Activiteit, Instellingen en
   Instellingencategorie.
   ------------------------------------------------------------------
   WAARVOOR DIT BESTAND BESTAAT
   .claude/beheer-ui-mockup-spec.md beschrijft tien schermen. Dit bestand
   bouwt er drie van, exact zoals hoofdstuk 5.8, 5.9 en 5.10 ze tonen:

     CP_SCHERMEN.activiteit           5.8  tijdlijn met datumkolom + rail
     CP_SCHERMEN.instellingen         5.9  twee grote kaarten, zes rijen,
                                           een volle-breedtekaart, rail
     CP_SCHERMEN.instellingCategorie  5.10 één bouwer voor negen categorieën

   VIJF AFSPRAKEN DIE DE REST VERKLAREN

   1. ER WORDT HIER GEEN COMPONENT EN GEEN GRAFIEK GESCHREVEN. Alles komt
      uit CP_UI (portal/admin-ui.js) en CP_CHART (portal/admin-charts.js).
      Waar die twee geen bouwer hebben terwijl portal/admin-ui.css er wél
      een vorm voor kent — de activiteitstijdlijn .u-tlrail (CSS 8k), de
      twee grote instellingenkaarten .u-setcard-groot (CSS 8p) en de
      systeemstatus .u-statusring (CSS 8q) — zet dit bestand die klassen
      met CP_UI.el() neer. Dat is het stijlblad gebruiken, geen tweede
      componentbibliotheek beginnen. De vier plekken staan hieronder met
      naam en reden genoteerd zodat ze naar admin-ui.js kunnen verhuizen
      zodra daar een bouwer verschijnt.

   2. GEEN MODULESTAAT. Er staat hier geen enkele variabele buiten een
      functie die een tweede aanroep beïnvloedt. De tabellen bovenaan zijn
      constant en worden nooit gemuteerd; alles wat verandert leeft in de
      closure van één aanroep. Selectie en tabkeuze komen uit de route.
      De ENE uitzondering staat in instellingCategorie() en is bewust:
      welk mailsjabloon en welke taal er in de editor open staan is de
      stand van dat ene widget en mag geen navigatie kosten, want een
      navigatie zou de onopgeslagen buffer weggooien. Zelfde redenering
      als bij CP_CHART.miniCalendar, die zijn eigen kijkvenster bijhoudt.

   3. VERZIN NIETS. Elk getal op het scherm komt uit echte data of uit een
      afgeleide functie waarvan de bron in commentaar staat. Waar een veld
      leeg is, staat er een eerlijke lege stand. Waar het systeem iets nog
      niet afdwingt (rollen, bewaartermijn), staat de uitleg van CP_DATA
      erbij — RECHTEN_UITLEG en BEWAARTERMIJN_UITLEG bestaan precies
      daarvoor. Er staat nergens een versleutelingsclaim: de kaart
      "Back-up & data" toont CP_DATA.backupUitleg(), en die zegt per modus
      de waarheid.

   4. TOEGANKELIJKHEID GAAT VOOR EEN PIXEL (hoofdstuk 8). Elke grafiek komt
      uit CP_CHART en draagt daardoor zijn eigen role="img" met de echte
      waarden erin. Elke stip staat naast een woord. Elke klikbare rij is
      een <button> of een <a>. De filterbalk op Activiteit is een echte
      tablist met pijltjes (CP_UI.tabs). De proportionele balk onder een
      naam bij "Meest actief" is aria-hidden, want het aantal acties staat
      er in cijfers naast — de balk voegt beeld toe, geen informatie.

   5. NOOIT innerHTML. Alles via CP_UI.el(). Bedrijfsnamen, sjabloonteksten
      en logregels komen uit de database en gaan hier ongefilterd doorheen;
      textContent maakt injectie onmogelijk.

   HET CONTRACT VAN EEN SCHERM
     CP_SCHERMEN.<naam>(ctx) -> ÉÉN element.
   ctx draagt: route, data (de al opgehaalde lijsten), nu, ga, ververs,
   opslaan, en de vier bibliotheken ui, chart, model, data.

   DAT WOORD `data` STAAT IN DE OPDRACHT TWEE KEER, met twee betekenissen:
   de opgehaalde lijsten én de bibliotheek CP_DATA. Dit bestand raadt niet
   maar MEET: een object met een functie activityBreakdown IS de
   bibliotheek, een object daarzonder zijn de lijsten. Zo werkt dit scherm
   onder allebei de lezingen, en onder een shell die ze los meegeeft
   (ctx.lijsten naast ctx.data). Zie context() onderaan hoofdstuk 0.

   WEGSCHRIJVEN GAAT ALTIJD VIA ctx.opslaan(soort, id, velden). Dit bestand
   raakt de datalaag nooit rechtstreeks aan. Vijf soorten, en meer worden
   het er niet:
     'instelling'   id = de sleutel in admin_settings (camelCase), velden =
                    de complete nieuwe waarde van die sleutel
     'capaciteit'   id = null, velden = {ma..zo} — via CP_DATA.saveCapacity,
                    want die normaliseert zeven dagen en vangt lege velden
     'bewaartermijn' id = null, velden = het aantal dagen (getal) — via
                    CP_DATA.saveRetentionDays, die het bereik bewaakt
     'backup'       id = ALTIJD null, velden = ALTIJD {at} — via
                    CP_DATA.markBackup. Dit legt alleen het MOMENT vast. Het
                    maken en het terugzetten van een back-up zijn geen
                    opslagsoorten maar handelingen, en lopen dus via
                    ctx.acties hieronder. Er komt hier geen zesde soort bij.
     'teamlid'      id = het teamlid-id, velden = {rol} — via
                    CP_DATA.saveTeamMember
   Ontbreekt ctx.opslaan, dan meldt het scherm dat als fout en schrijft het
   niets. Stil niets doen is hier de ergste uitkomst.

   HANDELINGEN LOPEN VIA ctx.acties[<naam>](payload). Dat is iets anders dan
   ctx.opslaan: een instelling is een waarde die je bewaart, een handeling is
   een bestaande dialoog of uitvoerder in beheer.html die je aanroept. Dit
   bestand gebruikt er zes, en bouwt er geen enkele na:

     backupDownloaden()          downloadBackupJson() — de complete
                                 datastore als gedateerd JSON-bestand
     backupHerstellen()          kiesBackupBestand() — bestandskiezer, het
                                 bestaande inhoudsoverzicht en restoreBackup()
                                 MET de hersteltest per collectie
     itemTerugzetten(rij)        DS.restoreTrash() plus refresh
     boekhoudCsv(van, tot)       exporteerBoekhoudCsv(), geeft het aantal
                                 geëxporteerde regels terug
     goLiveControleren(meld)     voerGoLiveControlesUit(); meld(sleutel,
                                 stand, tekst) is de schrijver van dit scherm.
                                 Zonder meld valt hij terug op het bestaande
                                 omgevingsvenster.
     (elke andere naam)          wordt hier niet gebruikt

   ELKE HAAK WORDT GEMETEN VOORDAT HIJ WORDT AANGEBODEN. Ontbreekt hij, dan
   verschijnt de knop NIET en staat er een regel die zegt waarom. Een knop
   die niets doet is erger dan een ontbrekende knop — dat is precies wat er
   met "Back-up terugzetten" gebeurd was: hij meldde succes en zette niets
   terug. De echte weg bestond al in beheer.html en is nu aangesloten.

   LADEN
     browser : <script src="portal/admin-schermen-beheer.js"></script> NA
               admin-model.js, admin-charts.js, admin-ui.js, admin-data.js
               en admin-shell.js. Het bestand VULT globalThis.CP_SCHERMEN
               aan en overschrijft hem nooit — een ander bestand vult
               dezelfde tabel met de overige zeven schermen.
     node    : importeerbaar voor tests. Het factory-lichaam raakt bij het
               laden geen document en geen window aan.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();

  /* AANVULLEN, NOOIT OVERSCHRIJVEN. De overige zeven schermen komen uit een
     ander bestand en de laadvolgorde tussen die twee ligt niet vast. */
  if (!root.CP_SCHERMEN) root.CP_SCHERMEN = {};
  root.CP_SCHERMEN.activiteit = api.activiteit;
  root.CP_SCHERMEN.instellingen = api.instellingen;
  root.CP_SCHERMEN.instellingCategorie = api.instellingCategorie;
  /* CATEGORIEEN hoort hier net zo goed bij. Hij stond wél in de exporttabel
     onderaan en kwam daardoor in Node netjes mee, maar deze kop kopieerde
     alleen de drie schermbouwers — in de browser was CP_SCHERMEN.CATEGORIEEN
     dus undefined. Precies daar moet hij zijn: de zijbalk en de zoekbalk
     lezen hem om dezelfde negen namen en routes te gebruiken als deze twee
     schermen, en die draaien alleen in de browser. */
  root.CP_SCHERMEN.CATEGORIEEN = api.CATEGORIEEN;

  /* zelfde reden als in admin-ui.js en admin-charts.js: er is geen
     package.json met "type":"module", dus in Node is dit CJS en is dit een
     echte export. */
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

  function G() {
    try { return (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : null); }
    catch (e) { return null; }
  }

  /* een getal of de terugval; Number(null) en Number('') zijn allebei 0 en
     dat is precies de valkuil die admin-data.js in normCapaciteit al een
     keer heeft gekost, dus hier wordt leeg ook echt als leeg gelezen */
  function getalOf(v, terugval) {
    if (v === null || v === undefined || v === '') return terugval;
    var n = Number(v);
    return isFinite(n) ? n : terugval;
  }

  /* diepe kopie voor de instellingenbuffer. JSON is hier veilig: alles wat
     in admin_settings staat is JSON — tekst, getallen, waar/onwaar,
     objecten en lijsten. Klapt het toch (een datum-object uit een oude
     demo-opslag), dan geven we de waarde ongewijzigd terug: dan bufferen we
     een verwijzing in plaats van een kopie, en dat is nog altijd beter dan
     een leeg formulier. */
  function kloon(v) {
    if (v === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  function nlAantal(n, enkel, meervoud) {
    return n + ' ' + (n === 1 ? enkel : meervoud);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + String(n); }

  /* ---- datum en tijd -------------------------------------------------
     ÉÉN LEZING VOOR DE HELE APP, EN DIE STAAT IN CP_MODEL.

     Een gebeurtenis staat in de database als volledige ISO-tekst mét Z
     (2026-08-31T05:03:26.016Z); een kale dag staat er zonder tijdzone
     (2026-08-31). CP_MODEL.dateParts kent dat verschil en behandelt de twee
     bewust verschillend: de kale dag leest hij letterlijk — anders wordt
     '2026-03-12' via new Date() UTC-middernacht en schuift hij in Nederland
     een dag terug — en de tekst mét Z of offset geeft hij aan Date, zodat de
     gebruiker het uur in zijn eigen tijdzone ziet.

     HIER STOND EEN EIGEN KOPIE VAN DIE LEZING, EN DIE NEGEERDE DE Z.
     Ze las de cijfers van de UTC-tekst alsof het lokale tijd was, en dat is
     in Nederland twee uur te vroeg (in de winter één). Gevolg: dezelfde mail
     stond op klantdetail (dat rechtstreeks via CP_MODEL leest) op 07:03 en
     in Activiteit op 05:03. En omdat die twee uur eraf ook over middernacht
     heen gaan, kreeg een gebeurtenis van kort NÁ middernacht de dagnaam én
     de datum van de dag ervóór: 1 september 00:30 (2026-08-31T22:30Z) stond
     op de tijdlijn als "Maandag 31 aug, 22:30". In een activiteitentijdlijn
     is dat precies de fout die je pas ontdekt als je iets niet kunt
     terugvinden. Dit bestand ontleedt een tijdstempel daarom niet meer zelf.

     WAT CP_MODEL EXPORTEERT is dayISO() en formatDateTime(), niet dateParts
     zelf; allebei lopen ze dóór dateParts heen en dragen dus dezelfde
     lezing. datumDelen() haalt de delen daarom uit die twee terug in plaats
     van de tekst opnieuw te ontleden. Verschijnt dateParts ooit wél in de
     exporttabel van admin-model.js, dan pakt de eerste tak hem meteen en
     kan de tweede weg.

     Zonder CP_MODEL wordt hier niets gelezen en niets geraden: dan geeft
     datumDelen() null en tonen de aanroepers hun eerlijke lege stand
     ('Onbekend', 'datum onbekend', 'tijd onbekend'). Een tweede lezing
     terugzetten "voor de zekerheid" is precies hoe dit verschil van twee uur
     is ontstaan. */
  var DAGNAMEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

  /* de gedeelde lezer: het expliciet meegegeven model, anders dat van de
     pagina. Dezelfde meting als bibliotheek() overal elders doet — een
     object met mergeActivity ÍS CP_MODEL. */
  function datumModel(model) {
    return bibliotheek({ model: model }, ['model', 'CP_MODEL'], 'mergeActivity');
  }

  /* {jaar, maand, dag, uur, minuut, heeftTijd} of null. maand is 1-12, en de
     delen staan in de tijdzone van de gebruiker — net als op elk ander
     scherm van het beheer. */
  function datumDelen(waarde, model) {
    var m = datumModel(model);
    if (!m) return null;

    if (fn(m.dateParts)) {
      var p = m.dateParts(waarde);
      if (!p) return null;
      return {
        jaar: p.y, maand: p.m, dag: p.d,
        uur: p.hh, minuut: p.mm, heeftTijd: !!p.hasTime
      };
    }

    if (!fn(m.dayISO)) return null;
    /* de DAG komt uit dayISO(): 'YYYY-MM-DD' in de tijdzone van de
       gebruiker, dus voor 2026-08-31T22:30:00Z al 1 september */
    var d = str(m.dayISO(waarde)).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!d) return null;

    /* het TIJDSTIP komt uit formatDateTime(), die een kale dag bewust géén
       verzonnen 00:00 meegeeft: staat er geen uur achter de datum, dan was
       er geen uur. Het jaartal kan hier niet voor een tijd worden
       aangezien — dat staat er zonder dubbele punt. */
    var uur = 0, minuut = 0, heeftTijd = false;
    if (fn(m.formatDateTime)) {
      var t = str(m.formatDateTime(waarde)).match(/(\d{1,2}):(\d{2})$/);
      if (t) { uur = +t[1]; minuut = +t[2]; heeftTijd = true; }
    }
    return { jaar: +d[1], maand: +d[2], dag: +d[3], uur: uur, minuut: minuut, heeftTijd: heeftTijd };
  }

  function datumTekst(waarde, model) {
    var m = datumModel(model);
    return (m && fn(m.formatDate)) ? str(m.formatDate(waarde)) : '';
  }

  function dagNaam(waarde, model) {
    var p = datumDelen(waarde, model);
    if (!p) return '';
    /* Date.UTC: puur rekenen op de kalenderdag die er hierboven al uit kwam.
       Geen tweede tijdzoneomrekening bovenop de eerste — dat zou de dag rond
       een zomertijdovergang alsnog laten verschuiven. */
    var d = new Date(Date.UTC(p.jaar, p.maand - 1, p.dag));
    var i = d.getUTCDay();
    return DAGNAMEN[i] ? DAGNAMEN[i].charAt(0).toUpperCase() + DAGNAMEN[i].slice(1) : '';
  }

  /* Een tijdstempel zonder tijd krijgt hier GEEN verzonnen 00:00. Dat is
     dezelfde belofte als formatDateTime() in admin-model.js: een kale dag
     mag niet doen alsof hij weet hoe laat het was. */
  function tijdTekst(waarde, model) {
    var p = datumDelen(waarde, model);
    if (!p || !p.heeftTijd) return '';
    return pad2(p.uur) + ':' + pad2(p.minuut);
  }

  /* ---- pad lezen en zetten binnen een instellingenwaarde -------------
     'naam' of 'welkom.nl.subject'. De sleutels in admin_settings zijn
     identifiers zonder punt, dus splitsen op '.' kan niet botsen. */
  function leesPad(bron, pad) {
    var p = str(pad);
    if (!p) return bron;
    var delen = p.split('.');
    var cur = bron;
    for (var i = 0; i < delen.length; i++) {
      if (!isObj(cur) && !Array.isArray(cur)) return undefined;
      cur = cur[delen[i]];
    }
    return cur;
  }

  function zetPad(bron, pad, waarde) {
    var p = str(pad);
    if (!p) return waarde;
    var wortel = (isObj(bron) || Array.isArray(bron)) ? bron : {};
    var delen = p.split('.');
    var cur = wortel;
    for (var i = 0; i < delen.length - 1; i++) {
      if (!isObj(cur[delen[i]]) && !Array.isArray(cur[delen[i]])) cur[delen[i]] = {};
      cur = cur[delen[i]];
    }
    cur[delen[delen.length - 1]] = waarde;
    return wortel;
  }

  /* ---- de bibliotheken en de lijsten uit ctx halen -------------------
     MEETEN IN PLAATS VAN RADEN. Elke bibliotheek heeft een functie die
     alleen zij heeft; die functie is het bewijs. Zo maakt het niet uit of
     de shell ze als ctx.ui/ctx.chart/ctx.model/ctx.data doorgeeft, als
     ctx.CP_UI enzovoort, of helemaal niet — dan staan ze op globalThis. */
  function bibliotheek(ctx, namen, merker) {
    var c = opt(ctx);
    var g = G();
    var i, k;
    for (i = 0; i < namen.length; i++) {
      k = c[namen[i]];
      if (isObj(k) && fn(k[merker])) return k;
    }
    if (g) {
      for (i = 0; i < namen.length; i++) {
        k = g[namen[i]];
        if (isObj(k) && fn(k[merker])) return k;
      }
    }
    return null;
  }

  /* De lijsten zijn het object dat GEEN bibliotheek is. Een lijstenzak
     draagt clients/projects/settings; CP_DATA draagt activityBreakdown. */
  function lijstenUit(ctx) {
    var c = opt(ctx);
    var kandidaten = [c.lijsten, c.data, c.gegevens, c.bronnen];
    for (var i = 0; i < kandidaten.length; i++) {
      var k = kandidaten[i];
      if (!isObj(k)) continue;
      if (fn(k.activityBreakdown) || fn(k.pageHeader) || fn(k.mergeActivity) || fn(k.donut)) continue;
      return k;
    }
    return {};
  }

  /* de navigatiewaarschuwing van de shell. Hij staat niet in het
     ctx-contract van de opdracht, maar CP_SHELL exporteert hem los als
     delegerende functie juist zodat een scherm hem kan bereiken. */
  function guardHaak(ctx) {
    var c = opt(ctx);
    if (fn(c.registreerGuard)) return c.registreerGuard;
    if (isObj(c.shell) && fn(c.shell.registreerGuard)) return c.shell.registreerGuard;
    var g = G();
    if (g && isObj(g.CP_SHELL) && fn(g.CP_SHELL.registreerGuard)) return g.CP_SHELL.registreerGuard;
    return null;
  }

  function context(ctx) {
    var c = opt(ctx);
    var model = bibliotheek(c, ['model', 'CP_MODEL'], 'mergeActivity');
    return {
      ui: bibliotheek(c, ['ui', 'CP_UI'], 'pageHeader'),
      chart: bibliotheek(c, ['chart', 'CP_CHART'], 'donut'),
      model: model,
      db: bibliotheek(c, ['data', 'dataLib', 'db', 'CP_DATA'], 'activityBreakdown'),
      L: lijstenUit(c),
      route: isObj(c.route) ? c.route : (model && fn(model.parseRoute) ? model.parseRoute(str(c.route)) : {}),
      nu: str(c.nu) || '',
      ga: fn(c.ga),
      ververs: fn(c.ververs),
      opslaan: fn(c.opslaan),
      /* het actiecontract van de gastheer; zie het kopblok. Ontbreekt het
         helemaal, dan is dit een leeg object en meldt haak() netjes null. */
      acties: opt(c.acties),
      guard: guardHaak(c)
    };
  }

  /* ÉÉN HAAK UIT HET ACTIECONTRACT, of null.
     Dit is de enige manier waarop dit bestand een handeling aanroept. De
     regel eromheen is even kort als hard: eerst vragen of hij bestaat, dan
     pas de knop tekenen. Zo kan er geen knop ontstaan die stil niets doet. */
  function haak(c, naam) {
    var h = opt(opt(c).acties);
    return fn(h[str(naam)]);
  }

  /* Elke schermbouwer begint hiermee. Zonder CP_UI is er geen el() en dus
     geen scherm; dan geven we een kale, leesbare melding terug in plaats
     van een uitzondering die de hele shell meeneemt. */
  function noodScherm(tekst) {
    var d = (typeof document !== 'undefined') ? document.createElement('div') : null;
    if (!d) return null;
    d.textContent = str(tekst);
    return d;
  }

  /* de route als tekst; zonder CP_MODEL valt hij terug op de kale hash,
     zodat een link altijd ergens heen wijst */
  function routeNaar(model, spec, terugval) {
    if (model && fn(model.buildRoute)) return model.buildRoute(spec);
    return str(terugval);
  }

  function tabUit(model, route, terugval) {
    if (model && fn(model.tabOf)) return str(model.tabOf(route, terugval));
    var r = opt(route);
    var p = opt(r.params);
    return str(r.tab || p.tab || terugval);
  }

  /* ---- gedeelde kleine vormen ---------------------------------------
     KAART. admin-ui.css geeft .u-card bewust geen padding (er zitten ook
     rijenlijsten in, en die brengen hun eigen padding mee). Een kaart met
     lopende inhoud heeft die padding wél nodig en er is geen klasse voor.
     Vandaar dit ene inline-attribuut, met opzet klein gehouden, zodat het
     naar admin-ui.css kan zodra daar een .u-card.u-pad verschijnt. */
  function kaart(ui, kinderen, extraKlasse) {
    return ui.el('div', {
      class: 'u-card' + (extraKlasse ? ' ' + extraKlasse : ''),
      style: 'padding:22px;'
    }, kinderen);
  }

  /* VELD. Label bóven het veld (spec 5.10), .field/.flabel/.input bestaan
     alle drie al en worden binnen .u-shell op de mockupmaten gezet (52px
     hoog, radius 12). CP_UI heeft geen field()-bouwer; beheer.html wel,
     maar die is niet geëxporteerd. */
  function veldVak(ui, label, control, hint) {
    return ui.el('label', { class: 'field' }, [
      ui.el('span', { class: 'flabel', text: str(label) }),
      control,
      str(hint) ? ui.el('span', {
        class: 'u-sub',
        /* een hint direct onder zijn veld; .u-sub zet maat en kleur, alleen
           de marge ontbreekt in admin-ui.css */
        style: 'display:block;margin-top:6px;',
        text: str(hint)
      }) : null
    ]);
  }

  function formRij(ui, kinderen) {
    return ui.el('div', { class: 'formrow' }, kinderen);
  }

  /* AVATAR MET EEN ECHTE FOTO — en de reden dat dit een eigen functie is.
     CP_DATA.avatarUrl() geeft ALTIJD een Promise terug: in demomodus moet
     hij de sleutel eerst bij IndexedDB opzoeken, live moet hij een
     ondertekende URL vragen. Een schermbouwer is synchroon, dus die Promise
     kan hier niet rechtstreeks in avatar({url}) — dan komt er letterlijk
     "[object Promise]" in de src te staan en toont elke rij een gebroken
     afbeelding.
     Daarom: eerst de initialen (een volwaardige variant, geen wachtstand),
     en zodra het adres binnen is wisselt de knoop. Blijft het adres leeg of
     mislukt het ophalen, dan blijven de initialen staan — precies wat er
     hoort te gebeuren als er geen foto is. */
  function avatarMetFoto(c, opts) {
    var ui = c.ui;
    var o = opt(opts);
    var naam = str(o.naam);
    var maat = o.maat;
    var vak = ui.el('span', {
      /* alleen om de knoop te kunnen vervangen; de avatar zelf brengt zijn
         eigen vorm mee */
      style: 'display:inline-flex;flex:none;'
    }, ui.avatar({ naam: naam, maat: maat }));

    if (!c.db || !fn(c.db.avatarUrl) || !isObj(o.record)) return vak;
    var belofte;
    try { belofte = c.db.avatarUrl(o.record, o.veld || null); }
    catch (e) { return vak; }
    if (!belofte || !fn(belofte.then)) return vak;

    belofte.then(function (url) {
      if (!str(url)) return;
      ui.clear(vak);
      vak.appendChild(ui.avatar({ naam: naam, url: str(url), maat: maat }));
    }, function () { /* geen foto is geen fout: de initialen blijven staan */ });

    return vak;
  }

  /* SECTIEKOP MET EEN TELLING ERNAAST.
     CP_UI.sectionHead zet de telling als .u-count direct achter de tekst
     van de h2. In .u-tab en .u-chip staat die telling in een inline-flex met
     een gap en valt er dus vanzelf ruimte voor; een h2 is gewone tekst en
     dan plakt hij ertegenaan: "Teamleden2". admin-ui.css heeft geen regel
     voor .u-sectionhead .u-count.
     Deze wikkel zet die ene marge alsnog. Zodra
     `.u-sectionhead .u-count{ margin-left:8px; }` in admin-ui.css staat,
     kan hij weg zonder dat het beeld verandert. */
  function sectiekop(ui, opts) {
    var node = ui.sectionHead(opts);
    var tel = node.querySelector ? node.querySelector('h2 .u-count') : null;
    if (tel && tel.style) tel.style.marginLeft = '8px';
    return node;
  }

  /* een uitlegalinea onder een kop of tussen twee blokken */
  function uitlegP(ui, tekst, extraStijl) {
    if (!str(tekst)) return null;
    return ui.el('p', {
      class: 'u-lees',
      style: 'max-width:66ch;margin:0 0 16px;' + str(extraStijl),
      text: str(tekst)
    });
  }

  /* ============================================================
     1. SCHERM 5.8 — ACTIVITEIT
     ============================================================

     ALLES KOMT UIT CP_MODEL.mergeActivity. Dat is de enige samenvoeging van
     activiteit in dit project (beslissing 2.6 van het migratieplan) en dus
     ook hier de enige bron — de donut en "Meest actief" in de rail rekenen
     op dezelfde lijst door via CP_DATA.activityBreakdown en
     CP_DATA.mostActive, zodat de tijdlijn en de rail onmogelijk uit elkaar
     kunnen lopen.

     DRIE FILTERS, EN ZE ZITTEN OP VERSCHILLENDE PLEKKEN IN HET ADRES.
     De SOORT (klant, e-mail, systeem, bestanden, financieel) is de tab en
     staat in het pad: #/activiteit/mail. De SCOPE (welke klant, welk
     project, welke fabriek) staat in de query: #/activiteit?klant=<id>. Het
     ACTIETYPE binnen de soort Systeem staat óók in de query:
     #/activiteit/systeem?actie=bewerking.
     Dat verschil is niet willekeurig — het is precies wat CP_MODEL.tabOf()
     en CP_MODEL.parseRoute() al uit elkaar houden: het pad draagt WELKE
     lijst je ziet, de query draagt alles wat die lijst verkleint. De scope
     gaat als eerste de feed in, want alles wat erna komt telt op die
     verzameling. */

  /* De zes filters. De tabel van CP_MODEL is de bron; deze kopie is de
     terugval voor een test zonder CP_MODEL, precies zoals admin-data.js
     dezelfde terugval heeft. */
  var ACT_SOORTEN_TERUGVAL = [
    { key: 'alles', label: 'Alles' },
    { key: 'klant', label: 'Klant' },
    { key: 'mail', label: 'E-mail' },
    { key: 'systeem', label: 'Systeem' },
    { key: 'bestanden', label: 'Bestanden' },
    { key: 'financieel', label: 'Financieel' }
  ];

  /* Icoon en tint per soort. DE TINTEN VOLGEN DE VOLGORDE VAN DE DONUT:
     CP_CHART.donut kleurt segment i met catKleur(i), en activityBreakdown
     levert de soorten in de volgorde van ACTIVITY_KINDS zonder 'alles'.
     Klant is dus segment 0 (salie), mail 1 (perzik), systeem 2 (blauw),
     bestanden 3 (paars), financieel 4 (zand). Zou deze tabel een andere
     volgorde kiezen, dan zou de icoontegel op de tijdlijn een andere kleur
     hebben dan het segment in de legenda ernaast — en dan is de legenda
     geen legenda meer. Dit zijn CATEGORISCHE tinten, nooit status. */
  var ACT_ICOON = {
    klant: 'relaties', mail: 'mail', systeem: 'instellingen',
    bestanden: 'bestand', financieel: 'financien'
  };
  var ACT_TINT = {
    klant: 1, mail: 2, systeem: 3, bestanden: 4, financieel: 5,
    /* de vijf klantacties uit het spiegelplan lenen de tint van de soort waar
       ze inhoudelijk bij horen, zodat de rail niet zes nieuwe kleuren krijgt. */
    akkoord: 1, samplekeuze: 1, betaling: 5, klantbestand: 4, bezwaar: 2
  };

  /* ---- DE ACTIETYPEN BINNEN DE SOORT SYSTEEM -------------------------
     De mappingtabel van het migratieplan: "Logboek tab Systeem → Activiteit
     → filter Systeem — de zeven actietypen worden filterchips". Die zeven
     zijn geen nieuwe indeling: ze staan al in beheer.html, in de
     keuzelijst van het oude tabblad Systeem, en ze worden daar ook echt
     geschreven (auditLog({kind:'bewerking'}) en zo verder). De labels
     hieronder zijn letterlijk die van dat oude scherm, zodat dezelfde
     handeling op de oude en de nieuwe plek niet anders heet.

     ZES CHIPS EN NIET ZEVEN, EN DAT IS GEEN VERGISSING. Het zevende type,
     'mail', valt in de nieuwe indeling samen met een SOORT: CP_MODEL
     .mergeActivity zet een auditregel met kind 'mail' op weergavesoort
     'mail', dus hij landt onder de tab E-mail — precies wat de regel
     erboven in diezelfde mappingtabel voorschrijft ("Logboek tab Mail →
     Activiteit → filter E-mail"). Een chip "Klantmails" onder Systeem zou
     daardoor per constructie altijd leeg zijn: een knop die niets kan
     doen. Het type is dus niet weggevallen, het heeft een tab in plaats
     van een chip.

     WAT ER ONDER 'OVERIG' VALT. De soort Systeem is in de nieuwe feed
     ruimer dan het oude tabblad: naast de auditregels zitten er ook
     zendingmijlpalen en gedeelde bestanden in, en die dragen geen
     actietype omdat niemand er ooit een van heeft vastgelegd. Ze vallen
     onder Overig — de naam die precies dat belooft. Het alternatief zou
     zijn ze een type aan te meten dat de database niet kent, en dat is
     erger dan een gevulde restbak. */
  var ACT_ACTIES = [
    { key: 'publicatie', label: 'Geplande publicaties' },
    { key: 'bewerking', label: 'Bewerkingen' },
    { key: 'preview', label: 'Voorvertoningen' },
    { key: 'toegang', label: 'Toegang & veiligheid' },
    { key: 'offboarding', label: 'Offboarding' },
    { key: 'overig', label: 'Overig' }
  ];

  /* de sleutel waaronder 'geen filter' door het adres reist */
  var ACT_ACTIE_ALLES = 'alles';

  function actieBestaat(key) {
    for (var i = 0; i < ACT_ACTIES.length; i++) if (ACT_ACTIES[i].key === str(key)) return true;
    return false;
  }

  /* Een rij zonder .actie heeft er geen; een rij met een actietype dat deze
     lijst niet kent (beheer.html schrijft ook kind:'factuur') hoort net zo
     goed bij de rest. Allebei worden ze 'overig' — nooit een chip die uit
     het niets ontstaat en waarvan de naam nergens is afgesproken. */
  function actieVan(rij) {
    var a = str(rij && rij.actie);
    return actieBestaat(a) ? a : 'overig';
  }

  function actieLabel(key) {
    for (var i = 0; i < ACT_ACTIES.length; i++) if (ACT_ACTIES[i].key === str(key)) return ACT_ACTIES[i].label;
    return str(key);
  }

  function actSoorten(model) {
    var bron = (model && arr(model.ACTIVITY_KINDS).length) ? model.ACTIVITY_KINDS : ACT_SOORTEN_TERUGVAL;
    var uit = [];
    for (var i = 0; i < bron.length; i++) {
      var k = bron[i];
      if (!isObj(k) || !str(k.key)) continue;
      uit.push({ key: str(k.key), label: str(k.label) || str(k.key) });
    }
    return uit;
  }

  function soortLabel(soorten, key) {
    for (var i = 0; i < soorten.length; i++) if (soorten[i].key === key) return soorten[i].label;
    return str(key);
  }

  /* De bronnenzak voor mergeActivity. De opdracht noemt de lijsten log,
     mailLog en audit; mergeActivity noemt ze accessLog, mailLog en
     auditLog, en kent daarnaast nog zes optionele bronnen. Alles wat er
     niet is blijft leeg — mergeActivity verdraagt dat en levert dan gewoon
     minder rijen, nooit een fout.

     ÉÉN NAAM VOOR TWEE DINGEN, EN WAT DAT HIER KOSTTE.
     `contacts` zijn in deze codebase contactPERSONEN: een naam, een rol,
     een mailadres. CP_MODEL.mergeActivity noemt zijn contactMOMENTEN-bron
     óók `contacts` en geeft die naam VOORRANG boven `moments`:
       var moments = list(src.contacts).length ? list(src.contacts)
                                               : list(src.moments);
     Dit bestand gaf in die sleuf de personen door. Twee gevolgen op het
     scherm, allebei stil: de echte contactmomenten vielen uit de tijdlijn
     (de voorrangsregel keek niet meer naar `moments`), en er kwam één regel
     bij zonder omschrijving — een contactpersoon heeft geen `kind` en geen
     `note`, dus joinSub() leverde een lege detailregel en splitsDetail()
     maakte daar een lege titel van.

     Nu gaan in BEIDE sleuven de momenten, met dezelfde tolerantie die
     admin-schermen-werk.js en admin-schermen-relaties.js al hadden. De
     personen gaan hier helemaal niet meer in: een contactpersoon is geen
     gebeurtenis en hoort niet in een activiteitenfeed.

     De naambotsing zelf hoort een laag dieper opgelost te worden — hernoem
     de bron in CP_MODEL.mergeActivity naar `contactMoments` en houd
     `contacts` een tijdje als alias — want anders herhaalt dezelfde
     vergissing zich bij het volgende scherm dat een feed samenstelt. Tot
     die tijd is dit de plek waar hij geen schade meer doet. */
  function actBronnen(L) {
    var momenten = arr(L.contactMoments).length ? arr(L.contactMoments) : arr(L.moments);
    return {
      accessLog: arr(L.log).length ? L.log : arr(L.accessLog),
      mailLog: arr(L.mailLog),
      auditLog: arr(L.audit).length ? L.audit : arr(L.auditLog),
      contacts: momenten,
      moments: momenten,
      questions: arr(L.questions),
      stages: arr(L.stages),
      shipments: arr(L.shipments),
      shipmentEvents: arr(L.shipmentEvents),
      invoices: arr(L.invoices),
      projects: arr(L.projects),
      /* de fasenamen komen van de aanroeper en nooit uit deze laag; zonder
         tabel toont mergeActivity de kale sleutel, en dat is eerlijker dan
         een tweede vertaaltabel die uit de pas gaat lopen */
      stageLabel: fn(L.stageLabel)
    };
  }

  /* TITEL EN BESCHRIJVING KOMEN UIT ÉÉN VELD. mergeActivity levert per rij
     één `detail`, en de mockup toont een vette titel met een grijze regel
     eronder. De detailregels van de datalaag zijn stelselmatig
     "<wat er gebeurde>: <waar het over ging>" ("Vraag beantwoord: kan de
     dop ook mat?"). Op die eerste dubbele punt splitsen is dus geen
     verzinsel maar het lezen van de vorm die er al is. Staat er geen
     dubbele punt, of is het stuk ervoor zo lang dat het duidelijk zelf de
     hele zin is, dan blijft het één titel zonder beschrijving — nooit een
     half afgekapte kop. */
  /* De contactmomenten hebben een ANDERE vorm dan de rest, en die vorm zag
     niemand zolang ze door de bug hierboven helemaal niet in de tijdlijn
     stonden. mergeActivity bouwt hun detail als joinSub([kind, note]) — dus
     "call · Gebeld over de laatste 15%. Noor wil pas betalen als…" met een
     punt-scheiding en niet met een dubbele punt. splitsDetail vond daar
     geen ': ' vlak vooraan en maakte van de HELE notitie één vette titel
     van tweehonderd tekens; bij cm-02 sloeg hij zelfs middenin de zin toe
     ("call · Eerste call met Mats"), omdat daar toevallig verderop een
     dubbele punt stond. De mockup wil een korte vette titel met een grijze
     regel eronder, dus wordt die vorm hier eerst herkend.

     DE WOORDEN KOMEN NIET UIT DE LUCHT. Ze staan al in beheer.html, in de
     contactmomenten-tijdlijn van het klantdetail (functie 27):
       call → Call, whatsapp → WhatsApp, mail → Mail, al het overige →
       Moment.
     Dezelfde vier woorden hier, zodat het beheer één woordenlijst houdt en
     dezelfde gebeurtenis op twee schermen niet anders heet. Een sleutel die
     hier niet in staat wordt 'Moment' — nooit de kale sleutel, want 'call'
     is geen Nederlands en 'anders' zegt niets. */
  var MOMENT_LABEL = { call: 'Call', whatsapp: 'WhatsApp', mail: 'Mail' };

  function splitsDetail(detail) {
    var d = str(detail);

    /* eerst de contactmomentvorm: een korte sleutel, dan ' · ', dan de
       notitie. De sleutel staat altijd vooraan, dus verder dan een stuk of
       twintig tekens hoeft er niet gezocht te worden — anders zou een
       gewone punt-scheiding halverwege een zin ook nog als kop gelden. */
    var p = d.indexOf(' · ');
    if (p > 0 && p <= 20) {
      var sleutel = d.slice(0, p);
      var rest = d.slice(p + 3);
      if (rest && sleutel.indexOf(' ') < 0) {
        return {
          titel: Object.prototype.hasOwnProperty.call(MOMENT_LABEL, sleutel)
            ? MOMENT_LABEL[sleutel] : 'Moment',
          tekst: rest
        };
      }
    }

    var i = d.indexOf(': ');
    if (i < 1 || i > 60) return { titel: d, tekst: '' };
    return { titel: d.slice(0, i), tekst: d.slice(i + 2) };
  }

  function indexOp(lijst, sleutel) {
    var uit = {};
    arr(lijst).forEach(function (r) {
      if (isObj(r) && str(r[sleutel])) uit[str(r[sleutel])] = r;
    });
    return uit;
  }

  /* één verwijzing onder een tijdlijnrij: naam + extern-link-icoontje */
  function refKnop(ui, label, route, ga, titel) {
    var inhoud = [
      ui.el('span', { text: str(label) }),
      ui.icon('extern', 14)
    ];
    if (fn(ga) && str(route)) {
      return ui.el('button', {
        type: 'button',
        class: 'u-link',
        title: str(titel) || null,
        /* .u-link is in admin-ui.css op tekst gemaakt en niet op een rij
           met een icoon ernaast; deze drie eigenschappen zetten de knop op
           één regel met zijn icoontje en horen bij DEZE plaatsing */
        style: 'display:inline-flex;align-items:center;gap:6px;font-size:13.5px;',
        onclick: function () { ga(route); }
      }, inhoud);
    }
    if (str(route)) {
      return ui.el('a', {
        class: 'u-link', href: str(route), title: str(titel) || null,
        style: 'display:inline-flex;align-items:center;gap:6px;font-size:13.5px;'
      }, inhoud);
    }
    return ui.el('span', {
      class: 'u-sub',
      style: 'display:inline-flex;align-items:center;gap:6px;',
      text: str(label)
    });
  }

  /* ÉÉN RIJ VAN DE TIJDLIJN — spec 5.8.
     admin-ui.css hoofdstuk 8k beschrijft deze vorm compleet (.u-tlrail-*)
     maar CP_UI heeft er geen bouwer voor: CP_UI.timelineRow tekent de
     COMPACTE tijdlijn (.u-tl-row, één regel met een chip) die op klant- en
     projectdetail hoort. Dit is de grote variant met datumkolom. Zodra
     admin-ui.js een timelineRail() krijgt, verhuist deze functie daarheen
     ongewijzigd. */
  function actRij(c, rij, soorten, projecten, klanten) {
    var ui = c.ui;
    var kind = str(rij.kind) || 'systeem';
    var kindLabel = soortLabel(soorten, kind);
    var gesplitst = splitsDetail(rij.detail);
    var tijd = tijdTekst(rij.at, c.model);

    /* --- kolom 1: dagnaam met de datum eronder --- */
    var datumKol = ui.el('div', { class: 'u-tlrail-datum-kol' }, [
      ui.el('span', { class: 'u-tlrail-dag', text: dagNaam(rij.at, c.model) || 'Onbekend' }),
      ui.el('span', { class: 'u-tlrail-datum', text: datumTekst(rij.at, c.model) || 'datum onbekend' })
    ]);

    /* --- kolom 2: de doorlopende lijn met de stip erop ---
       De stip leest --volle en --inkt uit zijn tintklasse; de lijn zelf
       staat in CSS en is decoratie. De hele kolom is aria-hidden: de soort
       staat als naam op de icoontegel hiernaast. */
    var lijnKol = ui.el('div', { class: 'u-tlrail-lijn', 'aria-hidden': 'true' }, [
      ui.el('span', { class: 'u-tlrail-stip ' + tintKlasseVan(ACT_TINT[kind]) })
    ]);

    /* --- kolom 3: tijd, icoontegel, titel, beschrijving, verwijzingen --- */
    var refs = [];
    var pid = str(rij.projectId);
    var cid = str(rij.clientId);
    if (pid) {
      var p = projecten[pid];
      refs.push(refKnop(c.ui,
        str(p && (p.name || p.title || p.naam)) || pid,
        routeNaar(c.model, { area: 'projecten', id: pid }, '#/projecten/' + pid),
        c.ga, 'Open dit project'));
    }
    if (cid) {
      var kl = klanten[cid];
      refs.push(refKnop(c.ui,
        str(kl && (kl.company || kl.name || kl.naam)) || cid,
        routeNaar(c.model, { area: 'relaties', sub: 'klanten', id: cid }, '#/relaties/klanten/' + cid),
        c.ga, 'Open deze klant'));
    }

    var tekstKol = ui.el('div', { class: 'u-tlrail-tekstkol' }, [
      ui.el('span', {
        class: 'u-tlrail-tijd',
        text: tijd || 'tijd onbekend',
        title: tijd ? null : 'De bron van deze regel legde geen tijdstip vast, alleen een dag.'
      }),
      ui.el('span', { class: 'u-tlrail-title', text: gesplitst.titel || kindLabel }),
      gesplitst.tekst ? ui.el('span', { class: 'u-tlrail-text', text: gesplitst.tekst }) : null,
      refs.length ? ui.el('div', { class: 'u-tlrail-refs' }, refs) : null
    ]);

    var body = ui.el('div', { class: 'u-tlrail-body' }, [
      /* de icoontegel MET titel: dan is hij role="img" met een naam en
         draagt hij de soort ook voor wie de kleur niet ziet */
      ui.iconTile({ icoon: ACT_ICOON[kind] || 'instellingen', toon: ACT_TINT[kind], maat: 44, titel: kindLabel }),
      tekstKol
    ]);

    return ui.el('div', { class: 'u-tlrail-row', role: 'listitem' }, [datumKol, lijnKol, body]);
  }

  /* De tintklassen staan in admin-ui.css en admin-ui.js kent hun tabel,
     maar exporteert die niet. Deze vertaling is dus de enige plek waar dit
     bestand een klassenaam uitspreekt die niet uit een component komt. */
  function tintKlasseVan(nummer) {
    var n = getalOf(nummer, 0);
    if (n >= 1 && n <= 6) return 'u-tint-' + Math.round(n);
    return 'u-tint-neutraal';
  }

  /* ---- de rail van 5.8 ---------------------------------------------- */

  function actDonutKaart(c, feed) {
    var ui = c.ui;
    var verdeling = (c.db && fn(c.db.activityBreakdown))
      ? c.db.activityBreakdown(feed)
      : { segmenten: [], totaal: arr(feed).length };

    var segmenten = arr(verdeling.segmenten).map(function (s) {
      return { label: str(s.label), waarde: getalOf(s.aantal, 0) };
    });

    var inhoud = [ui.sectionHead({ titel: 'Activiteitsverdeling' })];
    if (c.chart && fn(c.chart.donut)) {
      inhoud.push(c.chart.donut({
        segmenten: segmenten,
        maat: 200,
        /* "60 / Totaal" uit de mockup: het getal is het ECHTE aantal rijen
           in de samengevoegde feed, niet een afgerond streefgetal */
        midden: { waarde: String(getalOf(verdeling.totaal, segmenten.length)), label: 'Totaal' },
        legenda: 'percentage',
        titel: 'Activiteitsverdeling'
      }));
    } else {
      /* zonder CP_CHART geen donut, maar wél de cijfers: de grafiek is de
         weergave en niet de informatie */
      inhoud.push(ui.el('p', { class: 'u-lees', text: segmenten.map(function (s) {
        return s.label + ': ' + s.waarde;
      }).join(' · ') || 'Nog geen activiteit.' }));
    }
    return kaart(ui, inhoud);
  }

  /* TWEE WOORDENLIJSTEN VOOR DEZELFDE DRIE ACTOREN — en dat is een gat in
     de gedeelde laag, geen keuze van dit scherm.
     mergeActivity vertaalt de rijen van het toegangslogboek wél voor `kind`
     (r.actor === 'client' → 'klant') maar geeft `actor` ONVERTAALD door.
     Het toegangslogboek gebruikt de woordenlijst uit
     supabase/portal/0001_portal_schema.sql — "actor text not null default
     'client', -- client | staff | system" — terwijl mergeActivity zelf
     'klant', 'beheer' en 'systeem' schrijft. CP_DATA.mostActive kent alleen
     die tweede lijst, en dus verschijnen 'client' en 'system' als twee
     extra, naamloze actoren náást 'Klanten' en 'Systeem' — dezelfde persoon
     twee keer in dezelfde top.
     Hieronder staat de terugval: één woordenlijst voordat er geteld wordt,
     op een KOPIE van de rijen zodat de feed van de tijdlijn en de donut
     onaangeroerd blijft. DE ECHTE PLEK IS mergeActivity: die hoort `actor`
     net zo te vertalen als hij `kind` al vertaalt. Zodra dat gebeurt doet
     deze tabel niets meer en kan hij weg. */
  var ACTOR_ALIAS = { client: 'klant', staff: 'beheer', system: 'systeem' };

  function eenActorTaal(feed) {
    return arr(feed).map(function (r) {
      var a = str(r.actor);
      if (!ACTOR_ALIAS[a]) return r;
      var kopie = {};
      for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) kopie[k] = r[k];
      kopie.actor = ACTOR_ALIAS[a];
      return kopie;
    });
  }

  function actMeestActiefKaart(c, feed) {
    var ui = c.ui;
    var settings = opt(opt(c.L).settings);
    var afzender = str(opt(settings.mailAfzender).naam);

    /* beheerNaam geeft de rij 'beheer' de naam van de eigenaar. Met één
       beheergebruiker IS dat wie het deed; mostActive splitst bewust niet
       per teamlid, want de logregels dragen geen teamlid-id. */
    var lijst = (c.db && fn(c.db.mostActive))
      ? c.db.mostActive(eenActorTaal(feed), afzender ? { beheerNaam: afzender } : null)
      : [];

    var inhoud = [ui.sectionHead({ titel: 'Meest actief' })];
    if (!lijst.length) {
      inhoud.push(ui.el('p', { class: 'u-lees', text: 'Nog niemand — er staat geen activiteit in de gekozen periode.' }));
      return kaart(ui, inhoud);
    }

    lijst.forEach(function (e, i) {
      var aantal = getalOf(e.aantal, 0);
      var deel = Math.max(0, Math.min(100, getalOf(e.aandeelVanMax, 0)));

      /* DE BALK IS BEELD, DE CIJFERS ZIJN DE INFORMATIE. Daarom aria-hidden
         en geen role="progressbar": "28 acties" staat er in tekst naast, en
         een schermlezer die de balk óók voorleest hoort hetzelfde twee
         keer. admin-ui.css heeft geen klasse voor een proportionele balk;
         de vier eigenschappen hieronder zijn de hele vorm. */
      var spoor = ui.el('span', {
        'aria-hidden': 'true',
        style: 'display:block;margin-top:8px;height:6px;border-radius:999px;background:var(--line-2);overflow:hidden;'
      }, ui.el('span', {
        style: 'display:block;height:100%;width:' + deel + '%;background:var(--ink);border-radius:999px;'
      }));

      inhoud.push(ui.el('div', {
        style: i === 0 ? 'margin-top:16px;' : 'margin-top:18px;'
      }, [
        ui.el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
          ui.avatar({ naam: str(e.label), maat: 36 }),
          ui.el('span', { style: 'flex:1;min-width:0;' },
            ui.el('span', { class: 'u-row-title', text: str(e.label) })),
          ui.el('span', {
            class: 'u-bedrag',
            style: 'font-size:13.5px;color:var(--ink-2);',
            text: nlAantal(aantal, 'actie', 'acties')
          })
        ]),
        spoor
      ]));
    });

    return kaart(ui, inhoud);
  }

  /* ---- DE SCOPE UIT DE ROUTE ----------------------------------------
     De zes globale filtervariabelen van het oude logboek (logTab,
     logClientFilter en hun vier broertjes) zijn routeparameters geworden —
     dat staat zo in de mappingtabel van het migratieplan. Het oude patroon
     was "zet een variabele, spring dan"; dat breekt zodra Activiteit een
     eigen adres heeft, want dan komt een bezoeker ook binnen zónder eerst
     langs de zetter te zijn geweest.

     Hier wordt die scope dus UIT HET ADRES gelezen en nergens anders
     vandaan. mergeActivity kent de drie sleutels al (clientId, projectId,
     factoryId) — dit scherm hoeft alleen te vertalen.

     WAAROM MEERDERE NAMEN PER SLEUTEL. De doorlinks komen straks van drie
     verschillende schermbestanden. Een klantdetail dat `klant=` schrijft en
     een activiteitsscherm dat alleen `clientId=` leest, levert een pagina op
     die er goed uitziet en gewoon álles toont — de stilste fout die er is.
     Daarom leest deze laag de Nederlandse naam, de Engelse naam en de
     id-variant, allemaal hoofdletterongevoelig. Schrijven doet hij er
     precies één (de Nederlandse), zodat het adres in de balk eenduidig
     blijft. */
  var SCOPE_NAMEN = {
    clientId: ['klant', 'klantid', 'client', 'clientid'],
    projectId: ['project', 'projectid'],
    factoryId: ['fabriek', 'fabriekid', 'factory', 'factoryid']
  };

  function paramUit(params, namen) {
    var p = opt(params);
    var kleine = {};
    for (var k in p) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      if (!str(p[k])) continue;
      kleine[str(k).toLowerCase()] = str(p[k]);
    }
    for (var i = 0; i < namen.length; i++) {
      if (kleine[namen[i]]) return kleine[namen[i]];
    }
    return '';
  }

  function actScope(route) {
    var p = opt(route).params;
    return {
      clientId: paramUit(p, SCOPE_NAMEN.clientId),
      projectId: paramUit(p, SCOPE_NAMEN.projectId),
      factoryId: paramUit(p, SCOPE_NAMEN.factoryId)
    };
  }

  function actScopeActief(scope) {
    return !!(scope.clientId || scope.projectId || scope.factoryId);
  }

  /* de naam achter een id, of het id zelf. Een id tonen is lelijk maar
     nooit onwaar; "onbekend" zou verbergen dat het adres wel degelijk
     filtert en dat je daarom minder ziet dan je verwacht. */
  function naamUitLijst(lijst, id, velden) {
    var rijen = arr(lijst);
    for (var i = 0; i < rijen.length; i++) {
      var r = rijen[i];
      if (!isObj(r) || str(r.id) !== str(id)) continue;
      for (var v = 0; v < velden.length; v++) {
        if (str(r[velden[v]])) return str(r[velden[v]]);
      }
      return str(id);
    }
    return str(id);
  }

  /* de drie scopechips plus de knop die ze allemaal opheft. Kleur is hier
     bewust neutraal: dit is geen status maar een filter. */
  function actScopeBalk(c, scope, alleRoute) {
    var ui = c.ui;
    var L = c.L;
    var chips = [];

    if (scope.clientId) {
      chips.push({ label: 'Klant: ' + naamUitLijst(L.clients, scope.clientId, ['company', 'name', 'naam']) });
    }
    if (scope.projectId) {
      chips.push({ label: 'Project: ' + naamUitLijst(L.projects, scope.projectId, ['name', 'title', 'naam']) });
    }
    if (scope.factoryId) {
      chips.push({ label: 'Fabriek: ' + naamUitLijst(L.factories, scope.factoryId, ['name', 'naam']) });
    }
    if (!chips.length) return null;

    var rij = ui.el('div', {
      /* een gewone regel met chips en één knop; admin-ui.css heeft hier geen
         klasse voor omdat het geen component is maar een plaatsing */
      style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 0;'
    });
    rij.appendChild(ui.el('span', { class: 'u-kicker', text: 'Gefilterd op' }));
    chips.forEach(function (ch) {
      rij.appendChild(ui.statusChip({ label: ch.label, toon: 'neutraal' }));
    });
    if (c.ga) {
      rij.appendChild(ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', text: 'Filter opheffen',
        onclick: function () { c.ga(alleRoute); }
      }));
    }
    return rij;
  }

  /* ---- het scherm ---------------------------------------------------- */

  function activiteit(ctx) {
    var c = context(ctx);
    if (!c.ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen; het scherm Activiteit kan niet worden getekend.');
    var ui = c.ui;
    var L = c.L;

    var soorten = actSoorten(c.model);

    /* DE SCOPE GAAT ERIN VÓÓR DE SOORT. mergeActivity filtert dan zelf op
       klant, project en fabriek, en alles wat hierna gebeurt — de tellingen
       op de tabs, de tijdlijn, de donut en "Meest actief" — rekent op
       dezelfde verzameling. Zou de scope er pas ná de tellingen af gaan, dan
       zou een tab "E-mail 12" naar een lijst van drie regels wijzen. */
    var scope = actScope(c.route);
    var scopeAan = actScopeActief(scope);
    var feed = (c.model && fn(c.model.mergeActivity))
      ? c.model.mergeActivity(actBronnen(L), {
        clientId: scope.clientId || null,
        projectId: scope.projectId || null,
        factoryId: scope.factoryId || null
      })
      : [];

    /* tellingen per soort, uit dezelfde feed als de tijdlijn — dus geen
       tweede telling die van de lijst kan afwijken */
    var tellingen = { alles: feed.length };
    soorten.forEach(function (s) { if (s.key !== 'alles') tellingen[s.key] = 0; });
    feed.forEach(function (r) {
      var k = str(r.kind);
      if (tellingen[k] === undefined) tellingen[k] = 0;
      tellingen[k] += 1;
    });

    /* DE KEUZE KOMT UIT DE ROUTE en niet uit een variabele. Een onbekende
       of onzinnige waarde landt op 'alles' in plaats van op een lege lijst
       zonder uitleg. */
    var gekozen = tabUit(c.model, c.route, 'alles');
    var bestaat = false;
    soorten.forEach(function (s) { if (s.key === gekozen) bestaat = true; });
    if (!bestaat) gekozen = 'alles';

    var zichtbaar = (gekozen === 'alles') ? feed : feed.filter(function (r) { return str(r.kind) === gekozen; });

    /* HET ACTIETYPE — het tweede filter, en het bestaat alleen binnen de
       soort Systeem. Het staat in de query (?actie=) en niet in het pad,
       precies zoals de scope: het pad draagt de SOORT en de query draagt
       alles wat die soort verder verkleint. Zo overleeft de keuze een F5 en
       is een gefilterde tijdlijn te delen. Een onbekende waarde landt op
       "alle actietypen" en niet op een lege lijst zonder uitleg. */
    var actieTellingen = {};
    ACT_ACTIES.forEach(function (a) { actieTellingen[a.key] = 0; });
    zichtbaar.forEach(function (r) { actieTellingen[actieVan(r)] += 1; });

    var gekozenActie = (gekozen === 'systeem')
      ? paramUit(opt(c.route).params, ['actie', 'actietype'])
      : '';
    if (!actieBestaat(gekozenActie)) gekozenActie = ACT_ACTIE_ALLES;
    /* Het aantal actietypen dat er echt is. Staat alles in één bak, dan valt
       er niets te splitsen en is een chiprij alleen maar ruis. Noemt het
       adres wél een actietype, dan komt de rij er toch — anders is er geen
       weg terug uit een lijst waar je via een link in bent beland. */
    var actieSoortenAanwezig = 0;
    ACT_ACTIES.forEach(function (a) { if (actieTellingen[a.key]) actieSoortenAanwezig += 1; });
    var actieChipsAan = (gekozen === 'systeem'
      && (actieSoortenAanwezig > 1 || gekozenActie !== ACT_ACTIE_ALLES));
    if (!actieChipsAan) gekozenActie = ACT_ACTIE_ALLES;
    if (gekozenActie !== ACT_ACTIE_ALLES) {
      zichtbaar = zichtbaar.filter(function (r) { return actieVan(r) === gekozenActie; });
    }

    /* DE SCOPE REIST MEE MET ELKE TABWISSEL. Zonder deze twee regels gooit
       een klik op "E-mail" de klantfilter weg en sta je ineens in de
       volledige tijdlijn zonder dat iets dat meldt.
       Het ACTIETYPE reist juist NIET mee naar een andere tab: buiten
       Systeem bestaat het niet, en een parameter die nergens meer op slaat
       hoort niet in het adres te blijven hangen. */
    function actRoute(tabSleutel, actieSleutel) {
      var params = {};
      if (scope.clientId) params.klant = scope.clientId;
      if (scope.projectId) params.project = scope.projectId;
      if (scope.factoryId) params.fabriek = scope.factoryId;
      if (tabSleutel === 'systeem' && actieSleutel && actieSleutel !== ACT_ACTIE_ALLES) {
        params.actie = actieSleutel;
      }
      return routeNaar(c.model, {
        area: 'activiteit',
        tab: (tabSleutel && tabSleutel !== 'alles') ? tabSleutel : null,
        params: params
      }, '#/activiteit');
    }
    var alleRoute = routeNaar(c.model, { area: 'activiteit' }, '#/activiteit');

    var wortel = ui.el('div');

    wortel.appendChild(ui.pageHeader({
      titel: 'Activiteit',
      badge: feed.length ? nlAantal(feed.length, 'gebeurtenis', 'gebeurtenissen') : null
    }));

    var scopeBalk = actScopeBalk(c, scope, alleRoute);
    if (scopeBalk) wortel.appendChild(scopeBalk);

    /* de zes onderstreepte filters. Echte tabs met pijltjes, Home en End —
       de onderstreping is een CSS-keuze op .u-tab[aria-selected], niet iets
       wat dit scherm zet.

       GEEN panelId, EN DAT IS MET REDEN. Dit zijn zes tabs boven ÉÉN paneel:
       de tijdlijn eronder is telkens dezelfde lijst, alleen anders gefilterd.
       CP_UI.tabs leidt het id van elke tabknop af uit panelId
       (panelId + '-tab'), dus zes tabs met hetzelfde paneel zouden zes keer
       hetzelfde id krijgen — zes dubbele id's in de pagina, en dan wijst
       aria-labelledby ook nergens meer eenduidig heen.
       Zonder panelId geeft tabs() elke knop een eigen uniek id en laat hij
       aria-controls weg. Het paneel krijgt daarom hieronder een eigen
       aria-label dat het ACTIEVE filter noemt; dat is de naam waar het om
       gaat, en die klopt altijd. Zodra CP_UI.tabs een losse `tabId` naast
       `panelId` kent, kan aria-controls er alsnog bij. */
    var PANEEL_ID = 'cp-activiteit-paneel';
    var tabLijst = soorten.map(function (s) {
      return { key: s.key, label: s.label, count: getalOf(tellingen[s.key], 0) };
    });
    wortel.appendChild(ui.tabs({
      tabs: tabLijst,
      actief: gekozen,
      label: 'Soort activiteit',
      onKies: function (key) {
        if (!c.ga) return;
        c.ga(actRoute(key));
      }
    }));

    /* De actietypechips onder de tabbalk. Chips en geen tabs, en dat is het
       verschil dat admin-ui.css ook maakt: een tab kiest WELKE lijst je
       ziet, een chip verkleint de lijst die je al hebt. Dit tweede filter
       leeft binnen de tab Systeem en is er dus een chiprij.
       verbergNul laat alleen de actietypen zien die er echt zijn — zes
       chips waarvan er vijf op nul staan, zijn vijf knoppen die niets
       doen. CP_UI.filterChips houdt de actieve chip altijd zichtbaar, ook
       als hij op nul komt, zodat je kunt zien waarom je lijst leeg is. */
    if (actieChipsAan) {
      /* De tellingen komen uit actieTellingen en NOOIT uit `zichtbaar`:
         die lijst is op dit punt al door de gekozen chip heen, en dan zou
         "Alle actietypen" het aantal van precies die ene chip tonen. */
      var actieChips = [{ key: ACT_ACTIE_ALLES, label: 'Alle actietypen', count: 0, altijd: true }];
      ACT_ACTIES.forEach(function (a) {
        actieChips[0].count += actieTellingen[a.key];
        actieChips.push({ key: a.key, label: a.label, count: actieTellingen[a.key] });
      });

      var chipRij = ui.filterChips({
        chips: actieChips,
        actief: gekozenActie,
        verbergNul: true,
        label: 'Actietype in het systeemlogboek',
        onKies: function (key) {
          if (!c.ga) return;
          c.ga(actRoute('systeem', key));
        }
      });
      /* .u-chips draagt zelf 18px ondermarge en het paneel eronder nog eens
         26px; samen is dat een gat waar de tabbalk niet meer bij hoort */
      chipRij.style.marginBottom = '0';
      wortel.appendChild(chipRij);
    }

    /* --- de twee kolommen --- */
    var hoofd = ui.el('div', { class: 'u-cols-main' });
    var rail = ui.el('div', { class: 'u-cols-side' });

    /* de naam van het paneel IS het actieve filter; zonder die naam heet
       een tabpaneel bij een schermlezer alleen "tabblad". De scope hoort er
       ook in: anders klinkt een gefilterde tijdlijn precies als een volledige. */
    var paneelNaam = (gekozen === 'alles')
      ? 'Tijdlijn, alle activiteit'
      : ('Tijdlijn, gefilterd op ' + soortLabel(soorten, gekozen));
    /* het actietype hoort in dezelfde naam: "gefilterd op Systeem" en
       "gefilterd op Systeem, Bewerkingen" zijn twee verschillende lijsten
       en mogen bij een schermlezer niet hetzelfde heten */
    if (gekozenActie !== ACT_ACTIE_ALLES) paneelNaam += ', ' + actieLabel(gekozenActie);
    if (scopeAan) {
      var stukken = [];
      if (scope.clientId) stukken.push('klant ' + naamUitLijst(L.clients, scope.clientId, ['company', 'name', 'naam']));
      if (scope.projectId) stukken.push('project ' + naamUitLijst(L.projects, scope.projectId, ['name', 'title', 'naam']));
      if (scope.factoryId) stukken.push('fabriek ' + naamUitLijst(L.factories, scope.factoryId, ['name', 'naam']));
      paneelNaam += ', binnen ' + stukken.join(' en ');
    }

    var paneel = ui.el('div', {
      id: PANEEL_ID,
      role: 'tabpanel',
      'aria-label': paneelNaam,
      tabindex: '0',
      style: 'margin-top:26px;'
    });

    if (!zichtbaar.length) {
      /* DRIE VERSCHILLENDE LEGE STANDEN, en ze mogen niet op elkaar lijken.
         Bij een lege scope is er echt niets; bij een lege soort binnen een
         gevulde scope is de uitweg "Alles" mét behoud van de scope; en bij
         een lege scope zonder scope is er simpelweg nog niets gebeurd. */
      var leegTitel = 'Nog geen activiteit';
      var leegUitleg = 'Zodra er iets gebeurt — een mail, een goedkeuring, een betaling — verschijnt het hier.';
      var leegActie = null;

      if (scopeAan && !feed.length) {
        leegTitel = 'Niets gevonden voor dit filter';
        leegUitleg = scope.factoryId
          /* de eerlijke regel die ook in CP_MODEL.mergeActivity staat: geen
             van de huidige bronnen draagt een fabriek-id, dus een
             fabriekfilter levert alleen rijen op die er expliciet één
             meekregen. Dat verzwijgen zou lezen als "deze fabriek deed
             niets", en dat is iets heel anders. */
          ? 'Geen van de huidige activiteitsbronnen legt een fabriek vast. Alleen regels die zelf een fabriek '
            + 'meekregen verschijnen hier; zolang dat er geen zijn, blijft deze lijst leeg — ook als er wél met '
            + 'deze fabriek gewerkt is.'
          : 'Er staat nog geen activiteit die aan deze klant of dit project hangt.';
        leegActie = c.ga ? {
          label: 'Toon alle activiteit', klasse: 'ghost',
          onClick: function () { c.ga(alleRoute); }
        } : null;
      } else if (gekozenActie !== ACT_ACTIE_ALLES) {
        /* de kleinste stap terug is het actietype loslaten, niet de hele
           tijdlijn: de soort Systeem heeft nog wél rijen */
        leegTitel = 'Niets onder dit actietype';
        leegUitleg = 'Er staan wel systeemregels van een ander actietype. Kies "Alle actietypen" om ze allemaal te zien.';
        leegActie = c.ga ? {
          label: 'Alle actietypen', klasse: 'ghost',
          onClick: function () { c.ga(actRoute('systeem', ACT_ACTIE_ALLES)); }
        } : null;
      } else if (gekozen !== 'alles') {
        leegTitel = 'Niets onder dit filter';
        leegUitleg = 'Er staat wel activiteit van andere soorten. Kies "Alles" om de volledige tijdlijn te zien.';
        leegActie = c.ga ? {
          label: 'Toon alles', klasse: 'ghost',
          /* mét behoud van de scope: wie vanaf een klant binnenkwam, wil de
             soort loslaten en niet de klant */
          onClick: function () { c.ga(actRoute('alles')); }
        } : null;
      }

      paneel.appendChild(ui.emptyState({
        titel: leegTitel,
        uitleg: leegUitleg,
        actie: leegActie
      }));
    } else {
      var projecten = indexOp(L.projects, 'id');
      var klanten = indexOp(L.clients, 'id');
      var lijstVak = ui.el('div', {
        class: 'u-tlrail',
        role: 'list',
        'aria-label': 'Tijdlijn, ' + nlAantal(zichtbaar.length, 'gebeurtenis', 'gebeurtenissen')
      });
      zichtbaar.forEach(function (r) {
        lijstVak.appendChild(actRij(c, r, soorten, projecten, klanten));
      });
      paneel.appendChild(kaart(ui, lijstVak));
    }
    hoofd.appendChild(paneel);

    /* De rail toont de verdeling van de feed en niet van de gekozen SOORT.
       "60 / Totaal" is de stand van alle soorten samen; zou hij meefilteren,
       dan zou het middengetal bij filter "E-mail" gelijk zijn aan het enige
       segment en de donut niets meer verdelen.
       De SCOPE telt wél mee: hij zit al in `feed`. Dat hoort ook — kom je
       binnen vanaf een klant, dan is "Activiteitsverdeling" de verdeling van
       díé klant, en niet die van het hele bureau met een lijst eronder die
       iets anders zegt. */
    var railBinnen = ui.el('div', { class: 'u-sticky' }, [
      actDonutKaart(c, feed),
      actMeestActiefKaart(c, feed)
    ]);
    rail.appendChild(railBinnen);

    wortel.appendChild(ui.el('div', { class: 'u-cols', style: 'margin-top:0;' }, [hoofd, rail]));
    return wortel;
  }

  /* ============================================================
     2. DE NEGEN CATEGORIEËN

     Eén tabel, en hij is de bron van drie dingen tegelijk: het overzicht
     (5.9), de categoriepagina (5.10) én het aantal instellingen op de
     kaart. Dat aantal wordt GETELD uit deze indeling en uit de echte data
     (hoeveel mailsjablonen staan er, hoeveel teamleden zijn er) — er staat
     nergens een met de hand geschreven getal.

     plek:  'groot'  de twee grote kaarten bovenaan 5.9
            'rij'    de zes categorierijen in het raster
            'breed'  de volle-breedtekaart onderaan
     ============================================================ */

  var VALUTA = ['EUR', 'USD', 'CNY'];
  var BTW_MODI = [
    { key: 'verlegd', label: 'Btw verlegd' },
    { key: '0', label: '0% (export)' },
    { key: '21', label: '21%' }
  ];
  var AI_TONEN = [
    { key: 'zakelijk', label: 'Zakelijk en neutraal' },
    { key: 'warm', label: 'Warm en persoonlijk' },
    { key: 'kort', label: 'Kort en zakelijk droog' }
  ];
  var TALEN = [{ key: 'nl', label: 'Nederlands' }, { key: 'en', label: 'Engels' }];

  /* leesbare namen voor de sleutels die in admin_settings staan. Een
     sleutel die hier niet in staat wordt gewoon zichzelf: dat is lelijker
     maar nooit onwaar. */
  var SJABLOON_LABEL = {
    welkom: 'Welkom in het portaal',
    offerte: 'Opvolging offerte',
    checkin: 'Check-in bij een stille klant',
    herinnering: 'Herinnering openstaande factuur',
    factuur: 'Factuur verstuurd'
  };
  var ONDERWERP_LABEL = {
    faseDone: 'Fase afgerond',
    faseAwaiting: 'Goedkeuring gevraagd',
    antwoord: 'Antwoord op een vraag',
    publicatie: 'Nieuwe update gepubliceerd',
    document: 'Nieuw document',
    sample: 'Nieuwe sampleronde',
    inspectie: 'Inspectierapport geplaatst',
    zending: 'Zending klaargezet',
    mijlpaal: 'Zendingmijlpaal',
    mijlpalen: 'Meerdere zendingmijlpalen',
    eta: 'Nieuwe verwachte aankomst'
  };

  /* De zes fasesleutels in hun vaste volgorde. Ze staan letterlijk zo in
     hoofdstuk 4.11 van de mockupspec en zijn de index van
     settings.faseSjabloonPct. DE NAMEN komen NIET hiervandaan: die haalt
     dit scherm uit de STAGES-tabel van beheer.html, doorgegeven als
     lijsten.stageLabel — precies de afwijking die hoofdstuk 4.11 eist
     (vorm identiek, tekst Nederlands). Zonder die tabel tonen we de kale
     sleutel en zeggen we erbij waarom. */
  var FASE_SLEUTELS = ['concept', 'dfm', 'sourcing', 'tooling', 'production', 'logistics'];

  var CATEGORIEEN = [
    {
      key: 'bedrijfsprofiel',
      label: 'Bedrijfsprofiel',
      plek: 'groot',
      icoon: 'relaties',
      tint: 1,
      uitleg: 'Naam, KvK, btw en adres, plus de afzender van elke klantmail.',
      subtitel: 'Deze gegevens landen in de dossier-export, in het afzenderblok van klantmails en op de factuur zelf. '
        + 'Wat je hier invult, ziet je klant terug.',
      velden: [
        { sleutel: 'bedrijf', pad: 'naam', label: 'Bedrijfsnaam', soort: 'tekst', plaatshouder: 'CUSTOM+' },
        { sleutel: 'bedrijf', pad: 'kvk', label: 'KvK-nummer', soort: 'tekst' },
        { sleutel: 'bedrijf', pad: 'btw', label: 'Btw-nummer', soort: 'tekst' },
        { sleutel: 'bedrijf', pad: 'adres', label: 'Adres (straat en huisnummer)', soort: 'tekst' },
        { sleutel: 'bedrijf', pad: 'postcode', label: 'Postcode', soort: 'tekst', paar: 'plaats' },
        { sleutel: 'bedrijf', pad: 'plaats', label: 'Plaats', soort: 'tekst', paar: 'plaats' },
        { sleutel: 'mailAfzender', pad: 'naam', label: 'Mailafzender (naam)', soort: 'tekst' },
        { sleutel: 'mailAfzender', pad: 'replyTo', label: 'Reply-to (e-mailadres)', soort: 'tekst', type: 'email' }
      ]
    },
    {
      key: 'facturatie',
      label: 'Facturatie',
      plek: 'groot',
      icoon: 'financien',
      tint: 2,
      uitleg: 'Betaalgegevens, valuta, btw en de conceptfactuur-automaat.',
      subtitel: 'De IBAN staat op elke factuur en voedt de betaal-QR. Valuta en btw zijn de standaard voor '
        + 'NIEUWE facturen; een factuur die al definitief is verandert hier niet meer van.',
      velden: [
        { sleutel: 'bedrijf', pad: 'iban', label: 'IBAN (op de factuur en in de betaal-QR)', soort: 'tekst', paar: 'bank', plaatshouder: 'NL00 BANK 0000 0000 00' },
        { sleutel: 'bedrijf', pad: 'bic', label: 'BIC of SWIFT (optioneel)', soort: 'tekst', paar: 'bank', plaatshouder: 'ABNANL2A' },
        { sleutel: 'factuurStandaard', pad: 'valuta', label: 'Standaardvaluta', soort: 'keuze', opties: VALUTA, paar: 'geld' },
        { sleutel: 'factuurStandaard', pad: 'btwMode', label: 'Btw-behandeling', soort: 'keuze', opties: BTW_MODI, paar: 'geld' },
        { sleutel: 'factuurDocStandaard', pad: 'betaaltermijnDagen', label: 'Betaaltermijn in dagen', soort: 'getal', min: 1, max: 365 },
        { sleutel: 'betaalvoorwaarden', pad: '', label: 'Betaalvoorwaarden (regel op het factuurdocument)', soort: 'tekst', hint: 'Leeg = geen regel.' },
        {
          sleutel: 'autoConceptFactuur', pad: '', soort: 'vink',
          label: 'Maak automatisch een conceptfactuur wanneer een betaalfase op “wacht op goedkeuring” gaat',
          hint: 'De automaat zet alleen een CONCEPT klaar. Publiceren en mailen blijft handwerk.'
        }
      ],
      /* EERLIJKHEIDSTEKST DIE MEEVERHUIST. Hij stond bij de factuurhuisstijl
         van het oude instellingenscherm en mag niet sneuvelen omdat het blok
         eromheen van plek verandert. */
      noot: [
        'Er is geen serverside PDF-generatie: het factuurdocument ontstaat in jouw browser (Print → Bewaar als PDF). '
          + 'Upload die PDF daarna bij de factuur, anders kan de klant hem niet downloaden.'
      ]
    },
    {
      key: 'nummerreeksen',
      label: 'Nummerreeksen',
      plek: 'rij',
      icoon: 'bestand',
      tint: 3,
      uitleg: 'De jaarteller van het factuurnummer en de verklaringen bij ontbrekende nummers.',
      subtitel: 'Het factuurnummer wordt pas uitgegeven bij het definitief maken. Een concept blijft nummerloos, '
        + 'zodat een fase die je terugdraait nooit een nummer uit de reeks trekt.',
      velden: [
        { sleutel: 'factuurReeks', pad: 'prefix', label: 'Voorvoegsel', soort: 'tekst', paar: 'reeks', plaatshouder: 'CP' },
        { sleutel: 'factuurReeks', pad: 'volgende', label: 'Volgend volgnummer', soort: 'getal', min: 1, paar: 'reeks' }
      ]
    },
    {
      key: 'projectstandaarden',
      label: 'Projectstandaarden',
      plek: 'rij',
      icoon: 'projecten',
      tint: 4,
      uitleg: 'AQL-norm, betaalpercentages per fase en de projectsjablonen.',
      subtitel: 'Deze waarden seeden elk NIEUW project. Een lopend project houdt de percentages waarmee het is '
        + 'aangemaakt — anders zou een wijziging hier oude facturen laten kloppen met een nieuwe verdeling.',
      velden: [
        { sleutel: 'standaardAql', pad: '', label: 'Standaard AQL-norm', soort: 'tekst', plaatshouder: 'ANSI/ASQ Z1.4 II' }
      ]
    },
    {
      key: 'email',
      label: 'E-mail & sjablonen',
      plek: 'rij',
      icoon: 'mail',
      tint: 5,
      uitleg: 'Mailsjablonen in twee talen, de automatische onderwerpregels en de snippets.',
      subtitel: 'De sjablonen zijn wat je klant leest. Tekst tussen accolades is een invulveld: {naam}, {project}, '
        + '{factuur} en {bedrag} worden bij het versturen vervangen.',
      velden: [],
      /* Het voorbeeldvenster met "stuur een test naar mijzelf" hoort bij de
         mailfunctie van het beheer en heeft in het actiecontract geen haak.
         Er staat hier dus geen knop, maar wel de mededeling waar hij zit —
         anders zoekt iemand naar iets waarvan hij weet dat het bestaat. */
      noot: [
        'Een sjabloon proefdraaien — het voorbeeld zien en een test naar jezelf sturen — gebeurt op het moment dat '
          + 'het beheer de mail klaarzet, niet vanaf deze pagina. Wat je hier zet, is wat daar wordt ingevuld.'
      ]
    },
    {
      key: 'automatiseringen',
      label: 'Automatiseringen',
      plek: 'rij',
      icoon: 'klok',
      tint: 6,
      uitleg: 'Ochtendmail, stiltedrempel, zendingsduur en je werkdruk per weekdag.',
      subtitel: 'Vier klokken die het beheer zelf laat lopen, plus de dagcapaciteit waar “Operaties deze week” op '
        + 'het Overzicht tegen afzet.',
      velden: [
        { sleutel: 'ochtendmail', pad: 'aan', soort: 'vink', label: 'Stuur mij elke ochtend een samenvatting', hint: 'Er draait geen server die dit uit zichzelf verstuurt; de mail gaat mee zodra jij het beheer opent.' },
        { sleutel: 'stilteDrempelDagen', pad: '', label: 'Stiltedrempel (dagen zonder beweging)', soort: 'getal', min: 1, max: 365, hint: 'Bepaalt wanneer “Loopt dit nog?” op het Overzicht verschijnt.' },
        { sleutel: 'zendingsduurDagen', pad: 'koerier', label: 'Doorlooptijd koerier (dagen)', soort: 'getal', min: 0, max: 365, paar: 'duur' },
        { sleutel: 'zendingsduurDagen', pad: 'luchtvracht', label: 'Doorlooptijd luchtvracht (dagen)', soort: 'getal', min: 0, max: 365, paar: 'duur' },
        { sleutel: 'zendingsduurDagen', pad: 'zeevracht', label: 'Doorlooptijd zeevracht (dagen)', soort: 'getal', min: 0, max: 365, paar: 'duur' }
      ],
      /* EERLIJKHEIDSTEKST DIE MEEVERHUIST. Er draait geen server: alles wat
         "automatisch" heet, gebeurt op het moment dat jij het beheer opent.
         Dat gold in het oude scherm voor de ochtendmail en het geldt net zo
         voor een ingeplande publicatie of mail. */
      noot: [
        'Er draait geen server die op de klok kijkt. De ochtendmail, een ingeplande publicatie en een ingeplande '
          + 'mail vertrekken bij het eerstvolgende moment dat jij dit beheer opent op of na het gekozen tijdstip — '
          + 'niet eerder.',
        'De drie doorlooptijden hierboven voeden het ETA-voorstel in het formulier Nieuwe zending; de stiltedrempel '
          + 'bepaalt wanneer “Loopt dit nog?” op het Overzicht verschijnt. Ze slaan op via dezelfde opslagknop als '
          + 'de rest van deze pagina.'
      ]
    },
    {
      key: 'integraties',
      label: 'Integraties',
      plek: 'rij',
      icoon: 'extern',
      tint: 3,
      uitleg: 'Webhook, e-factuur, de AI-assistent en de go-live-checklist.',
      subtitel: 'Alles wat het beheer met een dienst buiten deze site doet. Alle schakelaars staan standaard uit, '
        + 'en dat is de veilige kant: een knop die suggereert dat er iets verstuurd is terwijl dat niet zo is, '
        + 'is erger dan geen knop.',
      velden: [
        { sleutel: 'factuurWebhook', pad: 'aan', soort: 'vink', label: 'Resend-webhook is aangezet', hint: 'Staat dit uit, dan kán er geen bezorgstatus binnenkomen en zegt de tijdlijn dat ook.' },
        { sleutel: 'factuurOpeningsregistratie', pad: 'aan', soort: 'vink', label: 'Registreer wanneer een factuurmail geopend wordt', hint: 'Werkt met een onzichtbare afbeelding bij de lezer. Het cijfer liegt beide kanten op: beeldblokkers melden nooit een opening, scanners juist een die er niet was.' },
        { sleutel: 'factuurUbl', pad: 'aan', soort: 'vink', label: 'E-factuur (UBL) exporteren', hint: 'Er is geen Peppol-provider aangesloten: dit levert een bestand op dat je zelf verstuurt.' },
        { sleutel: 'factuurUbl', pad: 'profiel', label: 'UBL-profiel', soort: 'tekst', plaatshouder: 'peppol-bis-3' },
        { sleutel: 'factuurAi', pad: 'aan', soort: 'vink', label: 'AI-assistent bij facturen aanzetten', hint: 'Zonder sleutel op de server doet dit niets. Met sleutel passeren factuurgegevens een externe dienst.' },
        { sleutel: 'factuurAi', pad: 'toon', label: 'Schrijftoon van de assistent', soort: 'keuze', opties: AI_TONEN }
      ]
    },
    {
      key: 'team',
      label: 'Team & rechten',
      plek: 'rij',
      /* 'team' is een EIGEN icoon in CP_UI.ICONEN (meerdere hoofdjes) en
         niet 'gebruiker' — dat laatste staat voor één persoon en is dus een
         ander begrip. Deze naam bestond een tijdje niet, waardoor de
         icoontegel van 48px op 5.9 leeg bleef; controleer een nieuwe naam
         daarom altijd tegen CP_UI.iconNamen() voordat je hem hier zet. */
      icoon: 'team',
      tint: 1,
      uitleg: 'Wie er meekijkt en met welke rol.',
      subtitel: 'Vier rollen, van eigenaar tot lezer. Lees de regel onder de rollen voordat je er een toekent.',
      velden: []
    },
    {
      key: 'omgeving',
      label: 'Omgeving en data',
      plek: 'breed',
      icoon: 'instellingen',
      tint: 6,
      uitleg: 'Waar je gegevens staan, hoe lang de prullenbak bewaart en hoe je een back-up maakt.',
      subtitel: 'Eén plek voor de vraag “waar staat mijn spul en hoe krijg ik het terug”.',
      velden: [
        { sleutel: 'retentionDays', pad: '', label: 'Bewaartermijn prullenbak (dagen)', soort: 'getal', min: 1, max: 3650, schrijf: 'bewaartermijn' }
      ]
    }
  ];

  /* "8 instellingen →" — de regel onderaan elke categoriekaart in 5.9.
     CP_UI.settingsCategoryCard zet met `aantal` alleen het aantal neer; het
     pijltje uit de mockup komt via `meta`, dat het aantal overschrijft. Zo
     lezen de zes rijen precies hetzelfde als de twee grote kaarten. */
  function meta(aantal) {
    return nlAantal(aantal, 'instelling', 'instellingen') + ' →';
  }

  /* EEN KAART DIE EEN LINK IS, IS GEEN ONDERSTREEPTE KAART.
     Een categoriekaart is een <a> — dat hoort ook, want hij heeft een eigen
     adres en moet in een nieuw tabblad te openen zijn. Maar er staat nergens
     een text-decoration-regel voor: beheer.html heeft geen algemene
     a-reset, en admin-ui.css zet `text-decoration:none` alleen op
     .u-crumb a, .u-btn en .u-link — niet op .u-setcard (hoofdstuk 8p) en
     niet op .u-setcard-groot. Zonder deze regel is elke titel, elke
     omschrijving en zelfs de logo-cirkel op het Instellingenscherm
     onderstreept.
     DIT IS EEN PLEISTER OP EEN ONTBREKENDE CSS-REGEL. Zodra
     `.u-setcard, .u-setcard-groot{ text-decoration:none; }` in admin-ui.css
     staat, kan deze functie weg en verandert er niets aan het beeld. */
  function geenOnderstreping(node) {
    if (node && node.style) node.style.textDecoration = 'none';
    return node;
  }

  function categorieVan(key) {
    for (var i = 0; i < CATEGORIEEN.length; i++) if (CATEGORIEEN[i].key === str(key)) return CATEGORIEEN[i];
    return null;
  }

  function sleutelsVan(obj) {
    var uit = [];
    if (!isObj(obj)) return uit;
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) uit.push(k);
    return uit;
  }

  /* HET ECHTE AANTAL INSTELLINGEN ACHTER EEN KAART.
     Vaste velden tellen als één. Wat per categorie meebeweegt met de data
     wordt geteld uit de data zelf: zoveel mailsjablonen als er in
     settings.mailSjablonen staan, zoveel fasepercentages als
     settings.faseSjabloonPct lang is, zoveel teamleden als de lijst kent.
     Zo klopt het getal op de kaart altijd met wat er achter de kaart staat
     — ook nadat iemand er een sjabloon bij zet. */
  function telInstellingen(cat, L, db) {
    var settings = opt(opt(L).settings);
    var n = arr(cat.velden).length;

    if (cat.key === 'projectstandaarden') {
      var pct = arr(settings.faseSjabloonPct);
      n += pct.length ? pct.length : FASE_SLEUTELS.length;
      /* elk projectsjabloon is sinds deze ronde echt bewerkbaar en telt dus
         mee — zoveel sjablonen als er staan, geen minimum en geen maximum */
      n += arr(settings.projectSjablonen).length;
    }
    if (cat.key === 'email') {
      var sj = sleutelsVan(settings.mailSjablonen);
      /* per sjabloon een onderwerp en een tekst, in twee talen: dat zijn
         vier instelbare teksten per sjabloon */
      n += sj.length * TALEN.length * 2;
      n += sleutelsVan(settings.mailOnderwerpen).length;
      n += 1;                                  /* de snippetlijst zelf */
    }
    if (cat.key === 'automatiseringen') {
      var dagen = (db && arr(db.WEEKDAGEN).length) ? db.WEEKDAGEN.length : 7;
      n += dagen;
    }
    if (cat.key === 'integraties') {
      n += GO_LIVE_VINKJES.length;
    }
    if (cat.key === 'team') {
      /* één rolinstelling per teamlid; nul teamleden is nul instellingen en
         dat is de eerlijke stand, geen minimum van één */
      n += arr(opt(L).team).length;
    }
    return n;
  }

  /* De handmatige vinkjes van de go-live-checklist. Dit zijn de stappen die
     een browser NIET zelf kan controleren; ze slaan direct op, want ze zijn
     geen formulier maar een handeling — precies de eerste van de twee
     bewuste uitzonderingen uit beslissing 2.7.
     DE OPSLAGSLEUTEL IS EN BLIJFT settings.goLive. beheer.html leest daar
     dezelfde sleutels uit voor zijn eigen controles (rls en resendDomein
     wegen mee in voerGoLiveControlesUit), dus die namen veranderen niet.
     netlifyEnv is nieuw en bestaat omdat de omgevingsvariabelen aan de
     serverkant alleen via de mailfunctie zichtbaar zijn — en die draait
     niet op elke host waar dit beheer wordt geopend. */
  var GO_LIVE_VINKJES = [
    { key: 'rls', label: 'Gecontroleerd: RLS staat aan op alle tabellen',
      uitleg: 'Niet automatisch controleerbaar vanuit de browser — vink af na controle in het Supabase-dashboard onder Database → Policies.' },
    { key: 'netlifyEnv', label: 'Omgevingsvariabelen gezet op Netlify en daarna opnieuw gedeployed',
      uitleg: 'Een browser kan de serverkant niet lezen. Alleen de mailfunctie meldt of de verplichte variabelen staan; draait die hier niet, dan is dit vinkje het enige bewijs.' },
    { key: 'resendDomein', label: 'Domein geverifieerd in Resend (SPF + DKIM groen)',
      uitleg: 'De mailfunctie kan wel bereikbaar zijn terwijl het afzenderdomein nog niet geverifieerd is; dat verschil ziet deze pagina niet.' },
    { key: 'klantUitgenodigd', label: 'Eerste klantaccount aangemaakt en uitgenodigd',
      uitleg: 'Zodra de eerste klantlogin in het toegangslogboek staat, is deze stap ook echt af.' }
  ];

  /* DE TIEN STAPPEN VAN DE WIZARD "KLAAR VOOR LIVE", in de volgorde van de
     oplevering: databank, migraties, beveiliging, jouw beheeraccount, de
     server, mail, de AI-assistent, de portal-URL en de eerste klant.

     Per stap staat er:
       probe    de sleutel waaronder voerGoLiveControlesUit() in beheer.html
                zijn uitslag meldt (config · migraties · resend · portalurl ·
                klant), of een eigen controle van dit bestand ('staf' vraagt
                is_staff() aan de databank, 'netlifyEnv' vraagt de
                mailfunctie welke omgevingsvariabelen er staan, 'mistral'
                stuurt een echte testvraag naar de sitechat-functie om
                MISTRAL_API_KEY te controleren). null = de browser kan het
                niet controleren; dan telt alleen het vinkje.
       vink     de sleutel in GO_LIVE_VINKJES die deze stap handmatig
                afvinkt, of null.
       demoDb   waar: de controle heeft een databank nodig. In demomodus
                zegt de wizard dan eerlijk dat er geen databank is, in plaats
                van een controle te draaien die per definitie mislukt.
       doen     de instructie, als regels; {code:'…'} is een exacte naam en
                komt in mono op het scherm.
       plekken  waar je het doet: [{label, pad}]. pad is een pad in het
                Supabase-dashboard van dít project (supabaseLink zet de
                projectreferentie ervoor) of een volledige URL.
       controle wat de knop Controleer precies doet, of waarom hij er niet is.

     De sleutel 'rls' meldt beheer.html óók, maar die melding is niets
     anders dan het vinkje teruggelezen; de wizard negeert hem daarom en
     laat het vinkje zelf spreken — anders zou een vinkje eruitzien als een
     gecontroleerde uitslag. */

  /* DE VOLLEDIGE, ACTUELE LIJST OMGEVINGSVARIABELEN OP NETLIFY.
     Verzameld op 2026-09-21 door alle netlify/functions/*.mjs te doorzoeken
     op process.env — inclusief site-chat.mjs, die er ná de vorige versie
     van deze stap is bijgekomen.

     verplicht  zonder deze staat de site of een kernfunctie eerlijk uit
                (503) voor IEDEREEN, sessie of niet: de databank, de mail en
                de AI (productcheck én sitechat).
     optioneel  heeft een eerlijke terugval: een standaardwaarde, of een
                functie die zich netjes uitschakelt (503/'not-configured')
                in plaats van half te werken. `terugval` citeert daarvoor
                letterlijk het commentaar uit de functie die de variabele
                leest — niets ervan is verzonnen.

     Bewust NIET in deze lijst, en dus ook niet als "te zetten" getoond:
       URL, DEPLOY_PRIME_URL, DEPLOY_URL   zet Netlify zelf bij elke build;
                                            die staan niet in de UI van
                                            Environment variables om te
                                            zetten en horen hier dus niet.
       CHAT_INDEX_PATH                     alleen voor de lokale dev-server
                                            en de testsuite (site-chat.mjs:
                                            "optioneel: pad naar
                                            chat/index.json op schijf
                                            (lokaal en in de tests)"); op
                                            Netlify zelf leest de functie
                                            haar index altijd van de eigen
                                            site, dus dit zou daar niets
                                            toevoegen en kan verwarren. */
  var GO_LIVE_ENV_VARS = {
    verplicht: [
      { naam: 'SUPABASE_URL', uitleg: 'De Project URL van je Supabase-project (Project Settings → API) — dezelfde als in portal/config.js, hier als servervariabele voor de functies die met de service-role-sleutel lezen en schrijven.' },
      { naam: 'SUPABASE_SERVICE_ROLE_KEY', uitleg: 'De service-role-sleutel van datzelfde project (Project Settings → API). Dit is niet de anon-sleutel uit portal/config.js: deze sleutel gaat buiten RLS om en hoort dus nooit in een publiek bestand.' },
      { naam: 'RESEND_API_KEY', uitleg: 'Een API-sleutel uit je Resend-account, onder API Keys.' },
      { naam: 'RESEND_FROM', uitleg: 'Het afzenderadres van klant- en factuurmails, op het domein dat je bij Resend verifieert (zie de stap Afzenderdomein in Resend hieronder).' },
      { naam: 'MISTRAL_API_KEY', uitleg: 'Een API-sleutel van console.mistral.ai. Dezelfde sleutel voedt zowel de AI-productcheck als de sitechat; zie de stap AI-assistent verderop.' }
    ],
    optioneel: [
      { naam: 'NOTIFY_SHARED_SECRET', uitleg: 'Geen sleutel van een dienst — een zelf gekozen lange, willekeurige tekenreeks (bijvoorbeeld gegenereerd door een wachtwoordmanager).',
        terugval: 'Letterlijk uit notify-client.mjs: "Zonder een van de env vars is deze functie uit (503), zodat er nooit per ongeluk een halfgeconfigureerde open relay live staat." Hetzelfde geldt voor invoice-ai.mjs, invoice-validate.mjs en admin-revoke-sessions.mjs: die vier functies weigeren zonder dit geheim elke aanroep, óók met een ingelogde staf-sessie.' },
      { naam: 'PORTAL_BASE_URL', uitleg: 'De oorsprong waar de knop in klantmails naartoe wijst, bijvoorbeeld https://custom-plus.nl. Alleen nodig als de portal op een ander domein draait dan de site zelf.',
        terugval: 'Letterlijk uit notify-client.mjs: "Staat hij niet ingesteld, dan geldt de door Netlify zelf gezette URL; is er geen van beide, dan is de functie uit (503)."' },
      { naam: 'PORTAL_URL_EXTRA_ORIGINS', uitleg: 'Komma-gescheiden lijst met extra toegestane oorsprongen voor diezelfde knop, naast PORTAL_BASE_URL.',
        terugval: 'Letterlijk uit notify-client.mjs: "Nodig zodra de instelling ‘klantlinkbasis’ in het beheer naar een ander domein wijst dan de site zelf, anders worden die links geweigerd."' },
      { naam: 'RESEND_WEBHOOK_SECRET', uitleg: 'Het signing secret dat Resend toont zodra je de webhook aanmaakt (Resend-dashboard → Webhooks → Add Webhook), begint met whsec_.',
        terugval: 'Letterlijk uit resend-webhook.mjs: "Zonder deze webhook toont de factuurtijdlijn dus eerlijk ‘verstuurd — bezorgstatus onbekend’. Dat is geen gebrek dat wordt weggepoetst: het is precies wat er dan bekend is."' },
      { naam: 'CHAT_LEAD_TO', uitleg: 'Het adres waar een bezoeker naartoe mailt als hij het chatgesprek per mail wil ontvangen.',
        terugval: 'Letterlijk uit site-chat.mjs: "adres van Steffan; terugval op RESEND_FROM" — zonder deze variabele gaat die mail naar het adres in RESEND_FROM.' },
      { naam: 'CHAT_DAILY_BUDGET_EUR', uitleg: 'Het dagbudget van de sitechat in euro, als rem op de Mistral-kosten.',
        terugval: 'Letterlijk uit site-chat.mjs: "optioneel, standaard 5 (euro per dag)" — zonder deze variabele geldt gewoon €5 per dag.' },
      { naam: 'MISTRAL_MODEL', uitleg: 'Een ander Mistral-model dan de standaardketen, bijvoorbeeld bij een ander abonnement.',
        terugval: 'Letterlijk uit site-chat.mjs: "optioneel; standaardketen ministral-14b → 8b → mistral-small" — zonder deze variabele probeert de functie die drie modellen op volgorde.' },
      { naam: 'MISTRAL_SEARCH_AGENT_ID', uitleg: 'De id van de Mistral-zoekagent die bij prijsvragen actuele onlineprijzen opzoekt.',
        terugval: 'Maakt de functie er zelf eenmalig een aan via de Mistral Agents-API en hergebruikt die daarna uit het geheugen van de functie-instantie — exact zoals HOSTING-GIDS.md het beschrijft: "laat je hem leeg, dan maakt de functie er zelf een aan."' },
      { naam: 'CHAT_EUR_PER_MTOKEN', uitleg: 'De aanname voor de kostenschatting van de sitechat, in euro per miljoen tokens — geen factuur, alleen de schatting achter het dagbudget hierboven.',
        terugval: 'Letterlijk uit site-chat.mjs: "optioneel, standaard 0.5: de aanname voor de kostenschatting in euro per miljoen tokens. Dit is een schatting, geen factuur; zet hem op het tarief van het gekozen model." Zonder deze variabele rekent de functie met 0,5.' }
    ]
  };

  var GO_LIVE_STAPPEN = [
    { key: 'config', titel: 'Supabase-project en portal/config.js', probe: 'config', vink: null, demoDb: false,
      doen: [
        ['Maak een project aan op supabase.com; kies een regio in de EU.'],
        ['Kopieer onder Project Settings → API de ', { code: 'Project URL' }, ' en de sleutel ', { code: 'anon public' }, '.'],
        ['Zet ze in ', { code: 'portal/config.js' }, ' als ', { code: 'supabaseUrl' }, ' en ', { code: 'supabaseAnonKey' },
          ' en publiceer het bestand. Meer hoort daar niet in: het bestand is openbaar.']
      ],
      plekken: [{ label: 'API-instellingen van het project', pad: '/settings/api' }],
      controle: 'Kijkt of portal/config.js gevuld is en op welke host het beheer daardoor draait. Of de verbinding ook antwoordt, blijkt uit stap 2: die doet de eerste echte select.' },
    { key: 'migraties', titel: 'Migraties draaien', probe: 'migraties', vink: null, demoDb: true,
      doen: [
        ['Open de SQL editor van het project en draai de bestanden uit ', { code: 'supabase/portal/' }, ' één voor één, op nummer van laag naar hoog.'],
        ['Elke migratie is opnieuw uit te voeren; nog een keer draaien kan geen kwaad.'],
        ['De controle hieronder prikt per migratie één tabel of kolom aan die alleen díe migratie aanmaakt, en noemt de nummers die nog ontbreken.']
      ],
      plekken: [{ label: 'SQL editor', pad: '/sql/new' }],
      controle: 'Doet per migratie één lege select op een kolom die alleen die migratie aanmaakt. Een kolom die niet bestaat, is een migratie die niet gedraaid is.' },
    { key: 'rls', titel: 'RLS nalopen', probe: null, vink: 'rls', demoDb: false,
      doen: [
        ['Ga naar Authentication → Policies en controleer dat elke tabel uit de migraties ', { code: 'RLS enabled' }, ' heeft en policies draagt (', { code: 'is_staff()' }, ' voor het beheer, ', { code: 'owns_project' }, ' voor de klant).'],
        ['Vergeet de opslag niet: de buckets ', { code: 'project-docs' }, ' en ', { code: 'beheer-intern' }, ' hebben hun eigen policies.']
      ],
      plekken: [{ label: 'Policies', pad: '/auth/policies' }],
      controle: 'Dit kan het beheer niet zelf controleren: een browser met de anon-sleutel ziet alleen wat de policies hem laten zien, en kan dus niet bewijzen dat er nergens een tabel open staat.' },
    { key: 'staf', titel: 'Je beheeraccount in staff_users', probe: 'staf', vink: null, demoDb: true,
      doen: [
        ['Log één keer in op het beheer met je account. Onder Authentication → Users staat dan zijn ', { code: 'UUID' }, '.'],
        ['Draai in de SQL editor: ', { code: "insert into staff_users (user_id) values ('<uuid>');" }],
        ['Zonder deze rij weigert elke policy en elke serverfunctie je account: het is dan een gewone gebruiker.']
      ],
      plekken: [{ label: 'Gebruikers', pad: '/auth/users' }, { label: 'SQL editor', pad: '/sql/new' }],
      controle: 'Vraagt de databank is_staff() voor de ingelogde sessie. Waar betekent: dit account staat in staff_users.' },
    { key: 'netlifyEnv', titel: 'Omgevingsvariabelen op Netlify', probe: 'netlifyEnv', vink: 'netlifyEnv', demoDb: false,
      doen: [
        ['Ga in Netlify naar Site configuration → Environment variables en zet de variabelen hieronder — verplicht en optioneel staan apart, elk met de naam, waar de waarde vandaan komt, en een knop die alleen die naam kopieert (er is geen waarde om te kopiëren).'],
        ['Bij een optionele variabele staat er ook bij wat er eerlijk gebeurt als je hem overslaat: nooit een gok, alleen wat de functie zelf doet als hij ontbreekt.'],
        ['Deploy daarna opnieuw: een functie leest zijn variabelen bij het uitrollen, niet bij elke aanroep.']
      ],
      plekken: [{ label: 'Netlify', pad: 'https://app.netlify.com' }],
      controle: 'Vraagt de mailfunctie (een GET zonder gevolgen) of de verplichte variabelen staan. Die antwoordt met ja of nee per groep, nooit met een waarde. Draait de mailfunctie niet op deze host, dan is dit vanaf hier niet te controleren en telt je vinkje. De AI-assistent (MISTRAL_API_KEY) heeft zijn eigen stap verderop, want de mailfunctie weet daar niets van.' },
    { key: 'resendDomein', titel: 'Afzenderdomein in Resend', probe: null, vink: 'resendDomein', demoDb: false,
      doen: [
        ['Voeg onder Domains het afzenderdomein toe en zet de SPF- en DKIM-records bij je DNS-beheerder; wacht tot beide op ', { code: 'Verified' }, ' staan.'],
        [{ code: 'RESEND_FROM' }, ' moet een adres op precies dat domein zijn, anders weigert Resend de mail.']
      ],
      plekken: [{ label: 'Resend-domeinen', pad: 'https://resend.com/domains' }],
      controle: 'Dit kan het beheer niet zelf controleren: de mailfunctie kan bereikbaar zijn terwijl het domein nog niet geverifieerd is, en dat verschil ziet een browser niet.' },
    { key: 'mail', titel: 'Mailfunctie', probe: 'resend', vink: null, demoDb: false,
      doen: [
        ['Niets te doen als stap 5 en 6 klaar zijn: ', { code: 'netlify/functions/notify-client.mjs' }, ' rolt met de site mee uit.'],
        ['Klantmails vertrekken alleen met een ingelogde beheersessie; zonder sessie weigert de functie elke aanroep.']
      ],
      plekken: [{ label: 'Netlify', pad: 'https://app.netlify.com' }],
      controle: 'Vraagt notify-client of hij bereikbaar én geconfigureerd is. Een uitgerolde maar half geconfigureerde functie telt eerlijk niet als klaar.' },
    { key: 'mistral', titel: 'AI-assistent (Mistral) werkt echt', probe: 'mistral', vink: null, demoDb: false,
      doen: [
        ['Niets extra te doen als de stap Omgevingsvariabelen hierboven ', { code: 'MISTRAL_API_KEY' }, ' al heeft gezet: ',
          { code: 'netlify/functions/site-chat.mjs' }, ' (de sitechat) en ', { code: 'netlify/functions/product-check.mjs' }, ' (de productcheck) rollen met de site mee uit.'],
        ['De controle hieronder stuurt een echte, korte testvraag naar de sitechat-functie — dat kost een fractie van een cent bij Mistral, net als een bezoeker die de chat gebruikt.']
      ],
      plekken: [{ label: 'Mistral-console (API-sleutels)', pad: 'https://console.mistral.ai' }],
      controle: 'Stuurt een korte testvraag naar netlify/functions/site-chat.mjs (action "chat"). Komt er een echt, gestreamd antwoord terug, dan werkt de sleutel. Antwoordt de functie met fallback "briefing" en foutcode "not-configured", dan staat MISTRAL_API_KEY nog niet. Bij elke andere fout of bij een netwerkfout wordt nooit een succes gemeld.' },
    { key: 'portalurl', titel: 'Portal-URL', probe: 'portalurl', vink: null, demoDb: false,
      doen: [
        [{ code: 'portal.html' }, ' moet op dezelfde host bereikbaar zijn als dit beheer; de links in klantmails wijzen daarheen.'],
        ['Draait de portal op een andere host, zet dan ', { code: 'PORTAL_BASE_URL' }, ' op Netlify (stap 5).']
      ],
      plekken: [],
      controle: 'Doet een HEAD-verzoek naar portal.html op deze host.' },
    { key: 'klant', titel: 'Eerste echte klantaccount', probe: 'klant', vink: 'klantUitgenodigd', demoDb: false,
      doen: [
        ['Maak de eerste klant aan onder Relaties en verstuur de uitnodiging vanuit het klantdossier.'],
        ['Zodra de klant inlogt, staat dat in het toegangslogboek; dan vinkt deze stap zichzelf af. Tot die tijd telt je vinkje dat de uitnodiging de deur uit is.']
      ],
      plekken: [],
      controle: 'Leest het toegangslogboek en zoekt de eerste regel van een klant.' }
  ];

  /* de sleutels waaronder beheer.html meldt, naar de stap die ze tonen */
  var GO_LIVE_HAAK_NAAR_STAP = { config: 'config', migraties: 'migraties', resend: 'mail', portalurl: 'portalurl', klant: 'klant' };

  /* de standen die voerGoLiveControlesUit() schrijft ('', ok, warn, bad)
     vertaald naar de tonen van CP_UI.statusDot. Een lege stand betekent
     "wordt gecontroleerd" en is dus neutraal, niet goed en niet fout. */
  var GO_LIVE_TOON = { ok: 'ok', warn: 'warn', bad: 'crit' };

  var GO_LIVE_DEMO_TEKST = 'In de demo is er geen databank; deze controle werkt pas met een Supabase-project.';

  /* WAT EEN FOUTCODE MEESTAL BETEKENT. De uitslag zelf blijft letterlijk
     staan; dit is de regel eronder die zegt wat je er doorgaans aan doet.
     Alleen codes die deze oplevering echt kan tegenkomen. */
  var GO_LIVE_FOUT_UITLEG = [
    { zoek: /42883/, uitleg: 'Postgres 42883: de functie bestaat niet. Meestal is de migratie die haar aanmaakt nog niet gedraaid.' },
    { zoek: /42P01/, uitleg: 'Postgres 42P01: de tabel bestaat niet — de migratie die haar aanmaakt is niet gedraaid.' },
    { zoek: /42703/, uitleg: 'Postgres 42703: de kolom bestaat niet — een latere migratie op deze tabel is niet gedraaid.' },
    { zoek: /42501/, uitleg: 'Postgres 42501: geen rechten. RLS of een policy houdt dit account tegen, of er is geen ingelogde sessie.' },
    { zoek: /PGRST301|jwt/i, uitleg: 'De sessie is verlopen of ongeldig. Log opnieuw in en controleer daarna nog eens.' },
    { zoek: /Failed to fetch|NetworkError|Load failed/i, uitleg: 'Het verzoek kwam niet aan: een verkeerde supabaseUrl, geen verbinding, of de browser blokkeert het (CORS).' },
    { zoek: /\b404\b/, uitleg: 'Niet gevonden: de functie is niet uitgerold op deze host, of het pad klopt niet.' },
    { zoek: /\b503\b|not-configured|niet geconfigureerd/i, uitleg: 'De functie draait, maar er ontbreken omgevingsvariabelen op Netlify (stap 5).' }
  ];
  function goLiveFoutUitleg(tekst) {
    var t = str(tekst);
    for (var i = 0; i < GO_LIVE_FOUT_UITLEG.length; i++) {
      if (GO_LIVE_FOUT_UITLEG[i].zoek.test(t)) return GO_LIVE_FOUT_UITLEG[i].uitleg;
    }
    return '';
  }

  /* de projectreferentie uit de publieke config: https://<ref>.supabase.co.
     Daarmee wijzen de links in de wizard naar het dashboard van dít project
     in plaats van naar de projectenlijst. Geen referentie = de lijst. */
  function supabaseRef() {
    var g = G();
    var cfg = (g && isObj(g.CP_PORTAL_CONFIG)) ? g.CP_PORTAL_CONFIG : {};
    var m = str(cfg.supabaseUrl).match(/^https:\/\/([a-z0-9-]+)\.supabase\.(?:co|in)(?:\/|$)/i);
    return m ? m[1] : '';
  }
  function supabaseLink(pad) {
    var p = str(pad);
    if (/^https?:\/\//i.test(p)) return p;
    var ref = supabaseRef();
    return ref ? ('https://supabase.com/dashboard/project/' + ref + p) : 'https://supabase.com/dashboard';
  }

  /* DE MIGRATIELIJST IS VAN beheer.html. voerGoLiveControlesUit() prikt per
     migratie één kolom aan en meldt één uitslag; de lijst zelf leeft in
     zijn closure. Dit bestand houdt er bewust geen kopie van bij — een
     tweede lijst is een gegarandeerd verschil zodra er een migratie
     bijkomt. Wordt de lijst ooit aangeboden (ctx.acties.goLiveProbes als
     functie of lijst, ctx.lijsten.goLiveProbes, CP_DATA.goLiveProbes of
     window.CP_GO_LIVE_PROBES; elk item als ['0001','clients','id'] of als
     {mig, tabel, kolom}), dan pakt deze meting hem op en toont de wizard
     elke migratie apart. Tot die tijd komt alles wat de wizard over
     migraties zegt uit de uitslagtekst zelf. */
  function goLiveProbeLijst(c) {
    var g = G();
    var bronnen = [opt(c.acties).goLiveProbes, opt(c.L).goLiveProbes, c.db ? c.db.goLiveProbes : null, g ? g.CP_GO_LIVE_PROBES : null];
    for (var i = 0; i < bronnen.length; i++) {
      var b = bronnen[i];
      if (fn(b)) { try { b = b(); } catch (e) { b = null; } }
      if (!Array.isArray(b) || !b.length) continue;
      var uit = [];
      b.forEach(function (p) {
        var n = Array.isArray(p)
          ? { mig: str(p[0]), tabel: str(p[1]), kolom: str(p[2]) }
          : { mig: str(opt(p).mig || opt(p).migratie || opt(p).nr || opt(p).key), tabel: str(opt(p).tabel || opt(p).table), kolom: str(opt(p).kolom || opt(p).column) };
        if (n.mig) uit.push(n);
      });
      if (uit.length) return uit;
    }
    return [];
  }

  /* de viercijferige migratienummers in een uitslagtekst, op volgorde en
     zonder dubbelen — "Nog niet (volledig) gedraaid: 0006, 0008" levert
     ['0006','0008'] */
  function migratieCodes(tekst) {
    var uit = [];
    (str(tekst).match(/\b\d{4}\b/g) || []).forEach(function (code) { if (uit.indexOf(code) < 0) uit.push(code); });
    return uit;
  }

  /* de Supabase-client, ALLEEN om is_staff() te vragen. Dit bestand schrijft
     nooit rechtstreeks naar de datalaag; een RPC die één boolean teruggeeft
     is lezen, en het is precies de vraag die deze stap moet stellen. Eerst
     de bibliotheek (CP_DATA kent intern sb(), maar exporteert hem vandaag
     niet), dan de client die beheer.html op window.__cpSb zet. Geen van
     beide = geen controle, en dat zegt de stap dan ook. */
  function goLiveSupabaseClient(c) {
    var k = null;
    if (c.db && fn(c.db.sb)) { try { k = c.db.sb(); } catch (e) { k = null; } }
    if (!k) { var g = G(); k = g ? g.__cpSb : null; }
    return (k && fn(k.rpc)) ? k : null;
  }

  /* {stand, tekst}: stand is ok · bad · onbekend. Nooit 'ok' zonder dat de
     databank zelf `true` teruggaf. */
  function goLiveStafProbe(c) {
    var sb = goLiveSupabaseClient(c);
    if (!sb) {
      return Promise.resolve({ stand: 'onbekend', tekst: 'Er is in deze weergave geen Supabase-client om is_staff() te vragen. Controleer de rij zelf in het dashboard (Table editor → staff_users).' });
    }
    var uit;
    try { uit = sb.rpc('is_staff'); }
    catch (e) { return Promise.resolve({ stand: 'bad', tekst: 'is_staff() kon niet worden aangeroepen: ' + foutTekst(e) }); }
    return Promise.resolve(uit).then(function (res) {
      var r = opt(res);
      if (r.error) {
        var e = opt(r.error);
        var code = str(e.code);
        if (code === '42501') {
          return { stand: 'bad', tekst: 'is_staff() weigert de anonieme rol (42501): er is geen ingelogde sessie. Log in op het beheer en controleer opnieuw.' };
        }
        return { stand: 'bad', tekst: 'is_staff() gaf een fout' + (code ? ' (' + code + ')' : '') + ': ' + (str(e.message) || 'zonder omschrijving') + '.' };
      }
      if (r.data === true) return { stand: 'ok', tekst: 'is_staff() geeft waar: het ingelogde account staat in staff_users.' };
      return { stand: 'bad', tekst: 'is_staff() geeft onwaar: het ingelogde account staat niet in staff_users, of er is geen ingelogde sessie. Voeg de rij toe met de UUID van je beheeraccount.' };
    }, function (e) {
      return { stand: 'bad', tekst: 'is_staff() gaf een fout: ' + foutTekst(e) };
    });
  }

  /* {stand, tekst} uit de gezondheidsvraag aan notify-client. De functie
     antwoordt op GET met booleans per groep en verstuurt niets; er komt
     geen waarde en geen sleutel mee terug. 'onbekend' = vanaf deze host
     niet te controleren; dan blijft het handmatige vinkje het bewijs. */
  function goLiveNetlifyEnvProbe() {
    var g = G();
    if (!g || !fn(g.fetch)) {
      return Promise.resolve({ stand: 'onbekend', tekst: 'Deze browser kan geen verzoek doen (geen fetch), dus de omgevingsvariabelen zijn vanaf hier niet na te kijken.' });
    }
    return g.fetch('/.netlify/functions/notify-client', { method: 'GET' }).then(function (r) {
      if (r.status === 404) {
        return { stand: 'onbekend', tekst: 'De mailfunctie antwoordt hier met 404: op deze host draait netlify/functions/notify-client.mjs niet, dus de omgevingsvariabelen zijn vanuit dit beheer niet na te kijken.' };
      }
      if (!r.ok) return { stand: 'bad', tekst: 'De mailfunctie antwoordt met status ' + r.status + ' op een gezondheidsvraag.' };
      return r.json().then(function (j) {
        var o = opt(j);
        if (typeof o.configured !== 'boolean') {
          return { stand: 'onbekend', tekst: 'De mailfunctie gaf geen leesbaar antwoord; een oudere versie meldt de omgevingsvariabelen niet.' };
        }
        var sessie = (typeof o.sessionAuth === 'boolean') ? o.sessionAuth : null;
        var delen = [];
        if (o.configured) delen.push('RESEND_API_KEY, RESEND_FROM en NOTIFY_SHARED_SECRET staan, en er is een basis-URL voor de links.');
        else {
          delen.push('Minstens één van RESEND_API_KEY, RESEND_FROM en NOTIFY_SHARED_SECRET ontbreekt'
            + (o.portalBase === false ? ', en er is geen basis-URL (PORTAL_BASE_URL of de site-URL van Netlify)' : '') + '.');
        }
        if (sessie === true) delen.push('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY staan.');
        else if (sessie === false) delen.push('SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt.');
        else delen.push('Of SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY staan, meldt deze versie van de functie niet.');
        var stand = (o.configured && sessie === true) ? 'ok' : ((o.configured && sessie === null) ? 'warn' : 'bad');
        if (stand !== 'ok') delen.push('Een variabele die je net hebt gezet, telt pas na een nieuwe deploy.');
        return { stand: stand, tekst: 'Volgens de mailfunctie: ' + delen.join(' ') };
      }, function () {
        return { stand: 'onbekend', tekst: 'De mailfunctie gaf geen JSON terug; een oudere versie meldt de omgevingsvariabelen niet.' };
      });
    }, function () {
      return { stand: 'onbekend', tekst: 'De mailfunctie is niet bereikbaar vanaf deze pagina — draait de site op Netlify? Zo niet, dan is dit vanaf hier niet te controleren.' };
    });
  }

  /* {stand, tekst} uit een ECHTE testvraag aan de sitechat-functie. Net als
     de resend-stap hierboven doet dit een echt verzoek — hier is dat de
     enige manier, want site-chat.mjs heeft geen GET-gezondheidscheck zoals
     notify-client.mjs en resend-webhook.mjs. mode:'product' slaat het
     ophalen van chat/index.json over (zie retrieve() in site-chat.mjs), zo
     test dit alleen MISTRAL_API_KEY en niets van de siteindex erbij. Een
     geslaagd antwoord kost een fractie van een cent bij Mistral (zie
     HOSTING-GIDS.md); dat is hier precies wat "echt werkt" betekent, niet
     alleen "is ingevuld". Volgt exact het patroon van goLiveNetlifyEnvProbe
     hierboven: 'onbekend' bij een netwerkfout, nooit een verzonnen succes. */
  function goLiveMistralProbe() {
    var g = G();
    if (!g || !fn(g.fetch)) {
      return Promise.resolve({ stand: 'onbekend', tekst: 'Deze browser kan geen verzoek doen (geen fetch), dus MISTRAL_API_KEY is vanaf hier niet na te kijken.' });
    }
    return g.fetch('/.netlify/functions/site-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'chat', mode: 'product', lang: 'nl', messages: [{ role: 'user', content: 'Testbericht van de go-live-controle: is de AI-assistent bereikbaar?' }] })
    }).then(function (r) {
      if (r.status === 404) {
        return { stand: 'onbekend', tekst: 'De sitechat-functie antwoordt hier met 404: op deze host draait netlify/functions/site-chat.mjs niet, dus MISTRAL_API_KEY is vanuit dit beheer niet na te kijken.' };
      }
      var ct = str(r.headers.get('content-type'));
      if (r.ok && /event-stream/i.test(ct)) {
        /* een echte gestreamde reactie komt alleen tot stand ná een geslaagd
           antwoord van Mistral zelf (zie de modelketen in site-chat.mjs);
           de inhoud lezen we niet, dat zegt de vorm van het antwoord al */
        return { stand: 'ok', tekst: 'De sitechat-functie antwoordt met een echt, gestreamd antwoord van Mistral: MISTRAL_API_KEY werkt.' };
      }
      return r.json().then(function (j) {
        var o = opt(j);
        if (o.fallback === 'briefing' && o.error === 'not-configured') {
          return { stand: 'bad', tekst: 'De sitechat-functie valt terug op het briefingformulier met foutcode not-configured: MISTRAL_API_KEY staat nog niet op Netlify.' };
        }
        if (o.fallback === 'briefing') {
          return { stand: 'warn', tekst: 'De sitechat-functie viel deze keer terug op het briefingformulier (' + (str(o.error) || str(o.reason) || 'zonder foutcode') + '), niet met foutcode not-configured. MISTRAL_API_KEY lijkt dus gezet, maar dit ene antwoord bewijst nog niet dat hij werkt — probeer het nog eens.' };
        }
        return { stand: 'bad', tekst: 'De sitechat-functie antwoordt met status ' + r.status + ' op een testvraag (' + (str(o.error) || 'zonder foutcode') + ').' };
      }, function () {
        return { stand: 'onbekend', tekst: 'De sitechat-functie gaf geen leesbaar antwoord op een testvraag.' };
      });
    }, function () {
      return { stand: 'onbekend', tekst: 'De sitechat-functie is niet bereikbaar vanaf deze pagina — draait de site op Netlify? Zo niet, dan is dit vanaf hier niet te controleren.' };
    });
  }

  /* ============================================================
     3. SCHERM 5.9 — INSTELLINGEN
     ============================================================ */

  /* de logo-cirkel van 130px uit de mockup. De bron is echt: het logo dat
     de eigenaar voor de factuur-PDF heeft geüpload (settings.factuurHuisstijl
     .logoData, een data-URI). Is er geen logo, dan staan er initialen — een
     volwaardige variant, geen gebrek. */
  function logoCirkel(c, settings) {
    var ui = c.ui;
    var naam = str(opt(settings.bedrijf).naam) || 'CUSTOM+';
    var data = str(opt(settings.factuurHuisstijl).logoData);
    var binnen;
    if (data) {
      binnen = ui.el('img', { src: data, alt: 'Logo van ' + naam });
    } else {
      var initialen = (c.db && fn(c.db.initialen)) ? str(c.db.initialen(naam)) : naam.slice(0, 2).toUpperCase();
      binnen = ui.el('span', {
        role: 'img',
        'aria-label': 'Nog geen logo — de initialen van ' + naam,
        /* .u-setcard-logo zet de cirkel; de letters erin hebben geen eigen
           klasse in admin-ui.css */
        style: 'font-size:34px;font-weight:500;color:var(--ink);letter-spacing:-.02em;',
        text: initialen
      });
    }
    return ui.el('span', { class: 'u-setcard-logo' }, binnen);
  }

  /* De twee grote kaarten van 5.9. admin-ui.css hoofdstuk 8p beschrijft
     .u-setcard-groot compleet, maar CP_UI.settingsCategoryCard bouwt de
     KLEINE variant (.u-setcard). Zodra admin-ui.js een grote variant
     krijgt, vervalt deze functie. */
  function groteCategorieKaart(c, cat, aantal, kinderenLinks, wit) {
    var ui = c.ui;
    var route = routeNaar(c.model, { area: 'instellingen', tab: cat.key }, '#/instellingen/' + cat.key);

    var lijf = ui.el('span', { class: 'u-setcard-groot-body' }, [
      ui.el('span', { class: 'u-setcard-title', text: cat.label }),
      ui.el('span', { class: 'u-setcard-text', text: cat.uitleg }),
      ui.el('span', { class: 'u-setcard-meta', text: meta(aantal) })
    ]);

    /* GEEN u-ornament-host HIER. Die klasse stond er wel, maar er werd
       nooit een takje in gehangen; wat er dan overblijft is een belofte in
       de klassenaam plus het overflow:hidden dat admin-ui.css eraan hangt.
       Hoofdstuk 4.20 wijst vijf plekken aan en de plek op dit scherm is de
       rail — spec 5.9 zegt letterlijk "leafOrnament rechtsonder" bij de
       kaart Back-up & data, en die staat in backupKaart(). Twee takjes op
       één scherm zou juist het "met mate" van 4.20 breken. */
    var a = geenOnderstreping(ui.el('a', {
      class: 'u-setcard-groot' + (wit ? ' wit' : ''),
      href: route
    }, [kinderenLinks, lijf]));

    if (c.ga) {
      a.addEventListener('click', function (e) {
        /* middelklik en cmd/ctrl/shift/alt blijven van de browser: die
           openen een nieuw tabblad en veranderen deze pagina niet van
           route, dus daar hoort de navigatiewaarschuwing niet langs */
        if (e.defaultPrevented) return;
        if (typeof e.button === 'number' && e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        c.ga(route);
      });
    }
    return a;
  }

  /* ---- de rail van 5.9 ---------------------------------------------- */

  /* DE ECHTE GEZONDHEIDSCONTROLES. Wat dit bestand op het moment van
     tekenen kan MEETEN, en niets meer:
       1. in welke modus de datalaag draait          CP_DATA.modus()
       2. of er iets is om mee te praten             CP_DATA.gekoppeld()
       3. of de instellingen daadwerkelijk zijn opgehaald (het scherm heeft
          ze in handen, anders had het niets kunnen tekenen)
     De netwerkcontroles van de go-live-checklist (migraties, mailfunctie,
     portal-URL) horen daar en niet hier: die kosten een verzoek en een
     schermbouwer is synchroon. Daarom staat er ook geen "Laatste controle:
     zojuist" maar het moment van deze weergave — dat is wél waar. */
  function systeemControles(c) {
    var uit = [];
    var modus = (c.db && fn(c.db.modus)) ? str(c.db.modus()) : '';
    var koppeling = (c.db && fn(c.db.gekoppeld)) ? !!c.db.gekoppeld() : false;
    var settings = opt(c.L).settings;

    if (modus) {
      uit.push({
        label: 'Omgeving',
        waarde: modus === 'supa' ? 'Live — Supabase' : 'Demomodus (deze browser)',
        toon: 'ok', ok: true
      });
    } else {
      uit.push({ label: 'Omgeving', waarde: 'Datalaag niet geladen', toon: 'crit', ok: false });
    }

    uit.push({
      label: 'Gegevenslaag',
      waarde: koppeling ? 'Bereikbaar' : 'Niet gekoppeld',
      toon: koppeling ? 'ok' : 'crit',
      ok: koppeling
    });

    uit.push({
      label: 'Instellingen',
      waarde: isObj(settings) ? 'Geladen' : 'Niet geladen',
      toon: isObj(settings) ? 'ok' : 'warn',
      ok: isObj(settings)
    });

    return uit;
  }

  /* KENT DE GRAFIEKBIBLIOTHEEK DEZE ICOONNAAM?
     CP_CHART heeft een eigen, veel kleinere icoontabel dan CP_UI, en
     icoonGroep() valt bij een onbekende naam stil terug op niets. In een
     ring van 110px levert dat een leeg midden op — zonder foutmelding, dus
     zonder dat iemand het merkt.
     Precies dat gebeurde hier: 'vinkje' bestaat, 'waarschuwing' niet. De
     goede stand klopte dus en de stand "Aandacht nodig" was leeg — de stand
     die je zelden ziet en daarom nooit test.
     Daarom wordt de naam nu GEVRAAGD in plaats van aangenomen. CP_CHART
     exporteert zijn tabel via iconSet().namen; kent hij het icoon, dan komt
     het icoon, en anders staat er het aantal in cijfers. Een leeg midden is
     erger dan een getal. Wordt 'waarschuwing' ooit aan admin-charts.js
     toegevoegd, dan schakelt deze ring vanzelf over zonder dat hier iets
     verandert. */
  function chartKentIcoon(chart, naam) {
    if (!chart || !fn(chart.iconSet)) return false;
    var set;
    try { set = chart.iconSet(); }
    catch (e) { return false; }
    var namen = arr(opt(set).namen);
    for (var i = 0; i < namen.length; i++) {
      if (str(namen[i]) === str(naam)) return true;
    }
    return false;
  }

  function systeemStatusKaart(c) {
    var ui = c.ui;
    var controles = systeemControles(c);
    var goed = 0;
    controles.forEach(function (r) { if (r.ok) goed += 1; });
    var alles = goed === controles.length;

    var tijd = tijdTekst(c.nu, c.model);
    var ring = null;
    if (c.chart && fn(c.chart.ring)) {
      var gewenstIcoon = alles ? 'vinkje' : 'waarschuwing';
      var heeftIcoon = chartKentIcoon(c.chart, gewenstIcoon);
      ring = c.chart.ring({
        maat: 110,
        waarde: goed,
        max: controles.length,
        icoon: heeftIcoon ? gewenstIcoon : null,
        /* de terugval: het aantal controles dat in orde is. Het staat ook
           in het aria-label hieronder, dus er wordt niets nieuws beweerd */
        tekst: heeftIcoon ? null : (goed + '/' + controles.length),
        /* de BOOG blijft inkt (hoofdstuk 0: een voortgangsring is
           inkt-schaal); het VINKJE draagt de betekenis en mag dus kleur
           hebben. Zo is er precies één gekleurd element en zegt het iets. */
        toon: 'ink',
        icoonKleur: alles ? 'ok' : 'warn',
        label: 'Systeemstatus',
        beschrijving: 'Systeemstatus: ' + goed + ' van ' + controles.length + ' controles in orde.'
      });
    }

    var blok = ui.el('div', { class: 'u-statusring' }, [
      ring,
      ui.el('span', { class: 'u-statusring-titel', text: alles ? 'Alles operationeel' : 'Aandacht nodig' }),
      ui.el('span', {
        class: 'u-statusring-sub',
        text: tijd ? ('Gecontroleerd bij het openen van dit scherm, ' + tijd) : 'Gecontroleerd bij het openen van dit scherm'
      })
    ]);

    var rijen = ui.el('div', { style: 'margin-top:18px;display:flex;flex-direction:column;gap:12px;' });
    controles.forEach(function (r) {
      rijen.appendChild(ui.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:14px;'
      }, [
        ui.el('span', { class: 'u-sub', text: r.label }),
        /* stip PLUS woord, altijd — statusDot kan niet anders */
        ui.statusDot({ toon: r.toon, label: r.waarde })
      ]));
    });

    return kaart(ui, [
      ui.sectionHead({ titel: 'Systeemstatus' }),
      blok,
      rijen
    ]);
  }

  function backupKaart(c) {
    var ui = c.ui;
    var settings = opt(opt(c.L).settings);
    var laatste = str(settings.lastBackupAt);
    var standaardTermijn = (c.db && typeof c.db.BEWAARTERMIJN_DEFAULT === 'number') ? c.db.BEWAARTERMIJN_DEFAULT : 7;
    var termijn = getalOf(settings.retentionDays, standaardTermijn);
    var uitleg = (c.db && fn(c.db.backupUitleg)) ? str(c.db.backupUitleg()) : '';
    var afgedwongen = !(c.db && c.db.BEWAARTERMIJN_AFGEDWONGEN === false);

    var rijen = ui.el('div', { style: 'display:flex;flex-direction:column;gap:14px;margin-top:4px;' });

    function rij(label, waarde, toon) {
      return ui.el('div', { style: 'display:flex;align-items:baseline;justify-content:space-between;gap:14px;' }, [
        ui.el('span', { class: 'u-sub', text: label }),
        toon ? ui.statusDot({ toon: toon, label: waarde })
          : ui.el('span', { style: 'font-size:15px;font-weight:500;color:var(--ink);', text: waarde })
      ]);
    }

    rijen.appendChild(rij('Laatste back-up',
      laatste ? datumTekst(laatste, c.model) + (tijdTekst(laatste, c.model) ? ' om ' + tijdTekst(laatste, c.model) : '') : 'Nog geen back-up gemaakt',
      laatste ? 'ok' : 'warn'));
    rijen.appendChild(rij('Bewaartermijn prullenbak', nlAantal(Math.round(termijn), 'dag', 'dagen'), null));
    rijen.appendChild(rij('Opslagplaats',
      (c.db && fn(c.db.modus) && c.db.modus() === 'supa') ? 'Supabase' : 'Deze browser', null));

    var kinderen = [
      ui.sectionHead({ titel: 'Back-up & data' }),
      rijen
    ];

    /* GEEN VERSLEUTELINGSCLAIM. backupUitleg() zegt per modus precies wat er
       waar is; in demomodus staat er dat alles in deze browser staat. */
    if (uitleg) {
      kinderen.push(ui.el('p', {
        class: 'u-sub',
        style: 'margin:16px 0 0;max-width:46ch;',
        text: uitleg
      }));
    }
    if (!afgedwongen && c.db && str(c.db.BEWAARTERMIJN_UITLEG)) {
      kinderen.push(ui.el('p', {
        class: 'u-sub',
        style: 'margin:10px 0 0;max-width:46ch;',
        text: str(c.db.BEWAARTERMIJN_UITLEG)
      }));
    }

    var k = kaart(c.ui, kinderen, 'u-ornament-host');
    /* de takjes uit hoofdstuk 4.20 — 5.9 zet ze rechtsonder in de rail */
    if (c.chart && fn(c.chart.leafOrnament)) {
      k.appendChild(c.chart.leafOrnament({ hoek: 'rechtsonder', maat: 130 }));
    }
    return k;
  }

  /* ---- het scherm ---------------------------------------------------- */

  function instellingen(ctx) {
    var c = context(ctx);
    if (!c.ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen; het scherm Instellingen kan niet worden getekend.');
    var ui = c.ui;
    var L = c.L;
    var settings = opt(L.settings);

    var wortel = ui.el('div');
    wortel.appendChild(ui.pageHeader({
      kicker: 'Standaarden en vangnet',
      titel: 'Instellingen'
    }));
    wortel.appendChild(ui.el('p', {
      class: 'u-lees',
      style: 'max-width:70ch;margin:0 0 30px;',
      text: 'Negen categorieën, van je bedrijfsprofiel tot je back-up. Elke categorie heeft één opslagknop: '
        + 'je wijzigingen staan pas vast als je ze opslaat, en je krijgt een waarschuwing als je met '
        + 'onopgeslagen werk wegloopt.'
    }));

    var hoofd = ui.el('div', { class: 'u-cols-main' });
    var rail = ui.el('div', { class: 'u-cols-side' });

    /* --- de twee grote kaarten ---
       "Bedrijfsprofiel breed, Facturatie smaller" (5.9). admin-ui.css heeft
       .u-grid-2 met twee GELIJKE kolommen; een ongelijke verhouding kan
       alleen hier. Flex met een verschillende basis en groeifactor doet dat
       én wikkelt vanzelf op een smal scherm, zonder mediaquery. */
    var groteRij = ui.el('div', {
      style: 'display:flex;flex-wrap:wrap;gap:20px;align-items:stretch;margin-bottom:20px;'
    });
    CATEGORIEEN.forEach(function (cat) {
      if (cat.plek !== 'groot') return;
      var aantal = telInstellingen(cat, L, c.db);
      var links = (cat.key === 'bedrijfsprofiel')
        ? logoCirkel(c, settings)
        : ui.iconTile({ icoon: cat.icoon, toon: cat.tint, maat: 56, titel: cat.label });
      var kaartEl = groteCategorieKaart(c, cat, aantal, links, cat.key !== 'bedrijfsprofiel');
      groteRij.appendChild(ui.el('div', {
        style: (cat.key === 'bedrijfsprofiel'
          ? 'flex:1.35 1 380px;min-width:0;display:flex;'
          : 'flex:1 1 280px;min-width:0;display:flex;')
      }, kaartEl));
    });
    hoofd.appendChild(groteRij);

    /* --- de zes categorierijen --- */
    var raster = ui.el('div', { class: 'u-setgrid' });
    CATEGORIEEN.forEach(function (cat) {
      if (cat.plek !== 'rij') return;
      raster.appendChild(geenOnderstreping(ui.settingsCategoryCard({
        icoon: cat.icoon,
        toon: cat.tint,
        titel: cat.label,
        uitleg: cat.uitleg,
        meta: meta(telInstellingen(cat, L, c.db)),
        route: routeNaar(c.model, { area: 'instellingen', tab: cat.key }, '#/instellingen/' + cat.key),
        onGa: c.ga || null
      })));
    });
    hoofd.appendChild(raster);

    /* --- de volle-breedtekaart --- */
    CATEGORIEEN.forEach(function (cat) {
      if (cat.plek !== 'breed') return;
      hoofd.appendChild(ui.el('div', { style: 'margin-top:20px;' },
        geenOnderstreping(ui.settingsCategoryCard({
          icoon: cat.icoon,
          toon: cat.tint,
          titel: cat.label,
          uitleg: cat.uitleg,
          meta: meta(telInstellingen(cat, L, c.db)),
          route: routeNaar(c.model, { area: 'instellingen', tab: cat.key }, '#/instellingen/' + cat.key),
          onGa: c.ga || null
        }))));
    });

    rail.appendChild(ui.el('div', { class: 'u-sticky' }, [
      systeemStatusKaart(c),
      backupKaart(c)
    ]));

    wortel.appendChild(ui.el('div', { class: 'u-cols' }, [hoofd, rail]));
    return wortel;
  }

  /* ============================================================
     4. SCHERM 5.10 — DE CATEGORIEPAGINA

     HET OMGEKEERDE OPSLAGMODEL (beslissing 2.7). Elke wijziging gaat in een
     buffer en zet dirty; pas op "Wijzigingen opslaan" wordt er echt
     geschreven. Er zijn geen elf losse "Opgeslagen"-flitsen meer, dus je
     moet op elk moment kunnen zien dat er iets openstaat — dat is de
     zwevende opslagbalk, en die staat er alleen als er iets te melden is.

     TWEE BEWUSTE UITZONDERINGEN die WEL direct doorwerken, omdat ze geen
     formulier zijn maar een handeling:
       · de vinkjes van de go-live-checklist (Integraties)
       · alles onder Back-up en opslag (Omgeving en data): downloaden,
         terugzetten en het vastleggen dát er een back-up is gemaakt
     Dat zijn precies de twee uit beslissing 2.7 van het migratieplan. De
     rest van Omgeving en data — de prullenbak en de boekhouding-CSV — zijn
     ook handelingen en gaan om dezelfde reden buiten de buffer om; alleen
     de bewaartermijn is een waarde en staat dus wél in het formulier.

     EEN HANDELING DIE DE PAGINA OPNIEUW LAAT TEKENEN IS EEN GEVAL APART.
     Een item uit de prullenbak terugzetten eindigt in de vaste afsluiter
     van het beheer (auditregel, venster sluiten, scherm verversen). Die
     verversing gooit de buffer weg. Daarom vraagt dat ene menu-item eerst
     of er nog onopgeslagen werk staat, en weigert het dan — zie
     prullenbakSectie().
     ============================================================ */

  /* de gedeelde schrijfroutine. Nooit stil falen: elke fout wordt een
     toast, want de gebruiker denkt op dat moment dat het bewaard is. */
  function schrijf(c, soort, id, velden) {
    if (!c.opslaan) {
      return Promise.reject(new Error('Deze weergave heeft geen schrijffunctie gekregen (ctx.opslaan ontbreekt).'));
    }
    var uit;
    try { uit = c.opslaan(soort, id, velden); }
    catch (e) { return Promise.reject(e); }
    return Promise.resolve(uit);
  }

  function foutTekst(e) {
    if (!e) return 'Onbekende fout.';
    if (typeof e === 'string') return e;
    return str(e.message) || 'Onbekende fout.';
  }

  /* ---- de buffer -----------------------------------------------------
     Per instellingssleutel één gekloonde waarde. Klonen is hier geen
     voorzichtigheid maar een eis: zonder kopie zou typen in een veld de
     lijst van ctx.data ter plekke wijzigen, en dan zou "Herstel" niets meer
     te herstellen hebben. */
  function maakBuffer(settings) {
    var origineel = opt(settings);
    var buffer = {};
    var vuil = {};

    function lees(sleutel) {
      if (Object.prototype.hasOwnProperty.call(buffer, sleutel)) return buffer[sleutel];
      return origineel[sleutel];
    }
    function neem(sleutel, leegVorm) {
      if (!Object.prototype.hasOwnProperty.call(buffer, sleutel)) {
        var w = kloon(origineel[sleutel]);
        if (w === undefined || w === null) w = (leegVorm === undefined) ? null : kloon(leegVorm);
        buffer[sleutel] = w;
      }
      return buffer[sleutel];
    }
    return {
      lees: lees,
      neem: neem,
      zet: function (sleutel, waarde) { buffer[sleutel] = waarde; vuil[sleutel] = true; },
      markeer: function (sleutel) { vuil[sleutel] = true; },
      isVuil: function () { return sleutelsVan(vuil).length > 0; },
      vuileSleutels: function () { return sleutelsVan(vuil); },
      waarde: function (sleutel) { return buffer[sleutel]; },
      schoon: function () { buffer = {}; vuil = {}; }
    };
  }

  /* ---- één veld uit de tabel tekenen -------------------------------- */

  function tekenVeld(c, buf, def, opVerandering) {
    var ui = c.ui;
    var huidig = def.pad ? leesPad(buf.lees(def.sleutel), def.pad) : buf.lees(def.sleutel);

    function bewaar(nieuw) {
      if (def.pad) {
        var basis = buf.neem(def.sleutel, {});
        buf.zet(def.sleutel, zetPad(basis, def.pad, nieuw));
      } else {
        buf.zet(def.sleutel, nieuw);
      }
      if (fn(opVerandering)) opVerandering(def);
    }

    if (def.soort === 'vink') {
      var vink = ui.el('input', { type: 'checkbox', checked: huidig === true });
      vink.addEventListener('change', function () { bewaar(!!vink.checked); });
      var regel = ui.el('label', { class: 'checkline' }, [
        vink,
        ui.el('span', { text: str(def.label) })
      ]);
      if (!str(def.hint)) return regel;
      return ui.el('div', { style: 'margin-bottom:14px;' }, [
        regel,
        ui.el('span', { class: 'u-sub', style: 'display:block;margin:-8px 0 0 25px;max-width:62ch;', text: str(def.hint) })
      ]);
    }

    if (def.soort === 'keuze') {
      var sel = ui.el('select', { class: 'input' });
      arr(def.opties).forEach(function (o) {
        var key = isObj(o) ? str(o.key) : str(o);
        var label = isObj(o) ? str(o.label) : str(o);
        var optie = ui.el('option', { value: key, text: label });
        if (key === str(huidig)) optie.selected = true;
        sel.appendChild(optie);
      });
      sel.addEventListener('change', function () { bewaar(sel.value); });
      return veldVak(ui, def.label, sel, def.hint);
    }

    if (def.soort === 'langetekst') {
      var ta = ui.el('textarea', { class: 'input', rows: String(getalOf(def.regels, 6)) });
      ta.value = str(huidig);
      ta.addEventListener('input', function () { bewaar(ta.value); });
      return veldVak(ui, def.label, ta, def.hint);
    }

    if (def.soort === 'getal') {
      var num = ui.el('input', {
        class: 'input', type: 'number', inputmode: 'numeric',
        min: (def.min === undefined) ? null : String(def.min),
        max: (def.max === undefined) ? null : String(def.max),
        step: '1'
      });
      num.value = (huidig === null || huidig === undefined || huidig === '') ? '' : String(huidig);
      num.addEventListener('input', function () {
        /* leeg blijft leeg in de buffer: pas bij opslaan wordt er over een
           lege waarde beslist. Number('') is 0 en dat is precies de fout die
           admin-data.js in normCapaciteit al een keer heeft gekost. */
        bewaar(num.value === '' ? null : getalOf(num.value, null));
      });
      return veldVak(ui, def.label, num, def.hint);
    }

    var inp = ui.el('input', {
      class: 'input',
      type: str(def.type) || 'text',
      placeholder: str(def.plaatshouder) || null
    });
    inp.value = str(huidig);
    inp.addEventListener('input', function () { bewaar(inp.value); });
    return veldVak(ui, def.label, inp, def.hint);
  }

  /* velden met dezelfde `paar`-naam komen naast elkaar te staan (5.10:
     "Postcode en Plaats naast elkaar") */
  function tekenVelden(c, buf, velden, opVerandering) {
    var ui = c.ui;
    var uit = ui.el('div');
    var i = 0;
    var lijst = arr(velden);
    while (i < lijst.length) {
      var def = lijst[i];
      var paar = str(def.paar);
      if (paar && i + 1 < lijst.length && str(lijst[i + 1].paar) === paar) {
        uit.appendChild(formRij(ui, [
          tekenVeld(c, buf, def, opVerandering),
          tekenVeld(c, buf, lijst[i + 1], opVerandering)
        ]));
        i += 2;
        continue;
      }
      uit.appendChild(tekenVeld(c, buf, def, opVerandering));
      i += 1;
    }
    return uit;
  }

  /* ---- de rail van 5.10 --------------------------------------------- */

  /* "Zo wordt je organisatie weergegeven" — spec 5.10. De kaart hertekent
     zichzelf bij elke toetsaanslag, zodat je ziet wat de ontvanger ziet. */
  function organisatieVoorbeeld(c, buf, settings) {
    var ui = c.ui;
    var vak = ui.el('div');
    /* het ECHTE logo als er een is — dat is wat de ontvanger ziet. Het
       staat waar de factuur-PDF hem bewaart en is hier niet bewerkbaar,
       dus hij komt uit settings en niet uit de buffer. */
    var logo = str(opt(opt(settings).factuurHuisstijl).logoData);

    function teken() {
      ui.clear(vak);
      var bedrijf = opt(buf.lees('bedrijf'));
      var naam = str(bedrijf.naam) || 'Nog geen bedrijfsnaam';
      var regels = [];
      if (str(bedrijf.adres)) regels.push(str(bedrijf.adres));
      var pc = [str(bedrijf.postcode), str(bedrijf.plaats)].filter(function (s) { return !!s; }).join('  ');
      if (pc) regels.push(pc);
      var fiscaal = [];
      if (str(bedrijf.kvk)) fiscaal.push('KvK ' + str(bedrijf.kvk));
      if (str(bedrijf.btw)) fiscaal.push('Btw ' + str(bedrijf.btw));
      if (fiscaal.length) regels.push(fiscaal.join(' · '));

      vak.appendChild(ui.el('div', { style: 'display:flex;align-items:center;gap:14px;' }, [
        ui.avatar({ naam: naam, url: logo, maat: 48 }),
        ui.el('span', { style: 'min-width:0;' }, [
          ui.el('span', { class: 'u-row-title', text: naam }),
          ui.el('span', { class: 'u-row-sub', text: regels.length ? regels[0] : 'Nog geen adres ingevuld' })
        ])
      ]));
      for (var i = 1; i < regels.length; i++) {
        vak.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:8px 0 0;', text: regels[i] }));
      }
      if (regels.length < 2) {
        vak.appendChild(ui.el('p', {
          class: 'u-sub', style: 'margin:8px 0 0;',
          text: 'Postcode, plaats, KvK en btw verschijnen hier zodra ze ingevuld zijn.'
        }));
      }
    }
    teken();
    return { el: vak, teken: teken };
  }

  /* "Voorbeeld van uitgaande e-mail" — spec 5.10. Het onderwerp en de
     eerste regel komen uit het ECHTE welkomstsjabloon zodra dat er is; de
     afzender uit de velden die je op deze pagina invult. */
  function mailVoorbeeld(c, buf, settings) {
    var ui = c.ui;
    var vak = ui.el('div');

    function teken() {
      ui.clear(vak);
      var afz = opt(buf.lees('mailAfzender'));
      var naam = str(afz.naam) || 'Nog geen afzendernaam';
      var reply = str(afz.replyTo);
      var sjabloon = opt(leesPad(opt(settings).mailSjablonen, 'welkom.nl'));
      var onderwerp = str(sjabloon.subject) || 'Welkom bij je CUSTOM+ portaal';
      var tekst = str(sjabloon.body);

      vak.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:0;', text: 'Van: ' + naam }));
      vak.appendChild(ui.el('p', {
        class: 'u-sub', style: 'margin:4px 0 0;',
        text: reply ? ('Antwoorden gaan naar: ' + reply) : 'Antwoorden gaan naar: nog geen adres ingevuld'
      }));
      vak.appendChild(ui.el('p', {
        style: 'margin:14px 0 0;font-size:15px;font-weight:500;color:var(--ink);',
        text: onderwerp
      }));
      if (tekst) {
        vak.appendChild(ui.el('p', {
          class: 'u-lees', style: 'margin:8px 0 0;',
          text: tekst.length > 180 ? tekst.slice(0, 180) + '…' : tekst
        }));
      }
    }
    teken();
    return { el: vak, teken: teken };
  }

  /* DE LIVE MOD-97-CONTROLE ONDER DE IBAN.
     De mappingtabel zet IBAN en BIC van "Bedrijf & standaarden" naar
     Facturatie en zegt erbij: "de live mod-97-controle en de
     betaal-QR-koppeling gaan mee". Dit is die controle, en hij rekent niet
     zelf — CP_QR.ibanValid() en CP_QR.bicValid() bestaan al en zijn dezelfde
     twee functies die de betaal-QR gebruikt. Een tweede controle hier zou
     een IBAN kunnen goedkeuren die de QR daarna weigert.
     Is CP_QR niet geladen, dan wordt er NIETS beweerd over de geldigheid —
     dan staat er alleen waar het veld voor dient. */
  function betaalBlok(c, buf) {
    var ui = c.ui;
    var g = G();
    var Q = (g && isObj(g.CP_QR)) ? g.CP_QR : null;
    var kanControleren = !!(Q && fn(Q.ibanValid));

    var regel = ui.el('p', {
      class: 'u-sub',
      style: 'margin:-4px 0 18px;max-width:66ch;',
      'aria-live': 'polite'
    });

    function teken() {
      var bedrijf = opt(buf.lees('bedrijf'));
      var iban = str(bedrijf.iban).replace(/\s+/g, '');
      var bic = str(bedrijf.bic).replace(/\s+/g, '');
      var delen = [];

      if (!iban) {
        delen.push('Zonder IBAN staat er geen betaalinstructie op de factuur en verschijnt er geen betaal-QR.');
      } else if (!kanControleren) {
        delen.push('De IBAN staat op elke factuur en voedt de betaal-QR. De controlecijfercontrole is in deze '
          + 'weergave niet beschikbaar, dus controleer het nummer zelf.');
      } else if (!Q.ibanValid(iban)) {
        delen.push('Deze IBAN komt niet door de controlecijfers (mod-97). Controleer hem; zolang hij fout is '
          + 'verschijnt er geen QR.');
      } else {
        delen.push('IBAN in orde. EUR-facturen krijgen een scanbare SEPA-betaal-QR met het bedrag en het '
          + 'betalingskenmerk erin.');
      }

      if (bic && Q && fn(Q.bicValid) && !Q.bicValid(bic)) {
        delen.push('De BIC klopt niet qua vorm (8 of 11 tekens) en wordt dan uit de QR weggelaten.');
      }
      regel.textContent = delen.join(' ');
    }

    teken();
    return { el: regel, teken: teken };
  }

  function categorieRail(c, cat, buf, settings) {
    var ui = c.ui;
    var blokken = [];

    if (cat.key === 'bedrijfsprofiel') {
      var org = organisatieVoorbeeld(c, buf, settings);
      var mail = mailVoorbeeld(c, buf, settings);
      blokken.push(ui.previewCard({
        titel: 'Zo wordt je organisatie weergegeven',
        kinderen: org.el,
        ornament: 'rechtsonder'
      }));
      blokken.push(ui.previewCard({
        titel: 'Voorbeeld van uitgaande e-mail',
        kinderen: mail.el
      }));
      /* de rail hertekent mee met het formulier */
      blokken.hertekenen = function () { org.teken(); mail.teken(); };
    }

    /* De categoriekaart uit 5.10: een chip met de naam en de uitleg
       eronder. Hij staat er op elke categorie, ook op de acht die verder
       een eenvoudiger rail houden.
       DE KORTE `uitleg` EN NIET DE `subtitel`: die laatste staat al onder
       de h1, en dezelfde alinea twee keer op één scherm leest als een
       storing. */
    blokken.push(kaart(ui, [
      ui.sectionHead({ titel: 'Categorie' }),
      ui.el('div', { style: 'margin-bottom:12px;' }, ui.statusChip({ label: cat.label, toon: 'nu' })),
      ui.el('p', { class: 'u-lees', style: 'margin:0;', text: str(cat.uitleg) || str(cat.subtitel) })
    ]));

    return blokken;
  }

  /* ---- de extra blokken per categorie -------------------------------- */

  /* Projectstandaarden: de betaalpercentages per fase, met de sommatie
     ernaast. 100% is geen technische eis maar een boekhoudkundige: samen
     vormen de fases de volledige projectwaarde. */
  function faseBlok(c, buf, L, opVerandering) {
    var ui = c.ui;
    var stageLabel = fn(L.stageLabel);
    var huidig = arr(buf.lees('faseSjabloonPct'));
    var aantal = huidig.length ? huidig.length : FASE_SLEUTELS.length;

    var som = ui.el('span', { class: 'u-kicker', 'aria-live': 'polite' });
    var velden = [];
    var rij = ui.el('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;' });

    function herbereken() {
      var totaal = 0;
      velden.forEach(function (v) { totaal += getalOf(v.value, 0); });
      som.textContent = 'Totaal ' + totaal + '%' + (totaal === 100 ? '' : ' — hoort 100% te zijn');
    }

    var i;
    for (i = 0; i < aantal; i++) {
      (function (index) {
        var sleutel = FASE_SLEUTELS[index] || ('fase' + (index + 1));
        var naam = stageLabel ? str(stageLabel(sleutel)) : '';
        if (!naam) naam = sleutel;
        var inp = ui.el('input', {
          class: 'input', type: 'number', min: '0', max: '100', step: '1',
          style: 'max-width:96px;',
          'aria-label': 'Betaalpercentage ' + naam
        });
        inp.value = String(getalOf(huidig[index], 0));
        inp.addEventListener('input', function () {
          herbereken();
          var lijst = [];
          velden.forEach(function (v) { lijst.push(Math.max(0, Math.min(100, Math.round(getalOf(v.value, 0))))); });
          buf.zet('faseSjabloonPct', lijst);
          if (fn(opVerandering)) opVerandering();
        });
        velden.push(inp);
        rij.appendChild(veldVak(ui, ('0' + (index + 1)).slice(-2) + ' ' + naam, inp));
      })(i);
    }
    herbereken();

    var kinderen = [
      ui.sectionHead({ titel: 'Betaalpercentages per fase' }),
      uitlegP(ui, 'Deze verdeling seedt elk nieuw project en bepaalt het bedrag van een automatische conceptfactuur.'),
      rij,
      ui.el('div', { style: 'margin-top:6px;' }, som)
    ];

    if (!stageLabel) {
      kinderen.push(ui.el('p', {
        class: 'u-sub', style: 'margin:12px 0 0;max-width:64ch;',
        text: 'De Nederlandse fasenamen komen uit de fasetabel van het beheer. Die is hier niet meegegeven, '
          + 'daarom staan de kale sleutels erboven. De volgorde en de bedragen kloppen wel.'
      }));
    }

    return ui.el('div', null, [ui.el('div', null, kinderen), sjabloonBlok(c, buf, L, opVerandering)]);
  }

  /* PROJECTSJABLONEN — het dertiende oude instellingenblok.
     Ze stonden hier als leeslijst met de regel "bewerken doe je nog in het
     oude instellingenscherm". Dat scherm wordt in de nieuwe indeling niet
     meer getekend, dus die regel wees naar niets. Nu lopen naam, verdeling
     en AQL-norm gewoon door de buffer en de opslagbalk, net als elk ander
     veld op deze pagina — `projectSjablonen` is een sleutel in
     admin_settings en heeft dus geen eigen schrijfweg nodig.

     TWEE DELEN BLIJVEN BEWUST LEESBAAR EN NIET BEWERKBAAR: de documentslots
     en de inspectiereeks. Die verwijzen naar de documenttypen- en
     checkpointtabellen van beheer.html, en die tabellen krijgt dit
     schermbestand niet mee. Ze hier navertikken zou een tweede lijst
     opleveren die stil uit de pas loopt zodra er een documenttype bijkomt.
     Wat er staat is dus wat er staat, met de reden erbij. */
  function sjabloonBlok(c, buf, L, opVerandering) {
    var ui = c.ui;
    var stageLabel = fn(L.stageLabel);
    var teller = 0;

    function lijstNu() { return arr(buf.lees('projectSjablonen')); }

    /* elke wijziging gaat op een KOPIE in de buffer; buf.neem levert die
       kopie de eerste keer en daarna blijft het dezelfde lijst */
    function bewerkbaar() { return arr(buf.neem('projectSjablonen', [])); }

    function bewaar(lijst) {
      buf.zet('projectSjablonen', lijst);
      if (fn(opVerandering)) opVerandering();
    }

    function faseNaam(sleutel, index) {
      var naam = stageLabel ? str(stageLabel(sleutel)) : '';
      return naam || str(sleutel) || ('fase ' + (index + 1));
    }

    var vak = ui.el('div', { style: 'margin-top:30px;' });
    var kop = sectiekop(ui, { titel: 'Projectsjablonen', telling: lijstNu().length });
    vak.appendChild(kop);
    vak.appendChild(uitlegP(ui, 'Een sjabloon seedt bij een nieuw project de faseverdeling, de AQL-norm, de '
      + 'documentslots en de inspectiereeks. Een lopend project verandert niet mee.'));

    var lijstVak = ui.el('div');
    var nieuwKnop = ui.el('button', { type: 'button', class: 'u-btn ghost klein', text: 'Nieuw sjabloon' });
    vak.appendChild(lijstVak);
    vak.appendChild(ui.el('div', { style: 'margin-top:14px;' }, nieuwKnop));
    vak.appendChild(ui.el('p', {
      class: 'u-sub', style: 'margin:12px 0 0;max-width:66ch;',
      text: 'De documentslots en de inspectiereeks van een sjabloon staan hier alleen ter inzage: ze verwijzen naar '
        + 'de documenttypen- en controlepunttabellen van het beheer, en die hoort dit scherm niet na te bouwen.'
    }));

    /* welke kaart na het hertekenen de focus krijgt. -1 = niemand; dat is de
       eerste tekening en elke hertekening na een verwijdering, want daar
       gaat de focus naar de knop die de volgende actie draagt. */
    var teFocussen = -1;

    function teken() {
      ui.clear(lijstVak);
      var lijst = lijstNu();

      var telNode = kop.querySelector ? kop.querySelector('h2 .u-count') : null;
      if (telNode) telNode.textContent = String(lijst.length);

      if (!lijst.length) {
        lijstVak.appendChild(ui.emptyTile({
          icoon: 'projecten',
          titel: 'Nog geen eigen projectsjabloon',
          uitleg: 'Elk nieuw project start dan met de zes standaardfasen en de percentages hierboven.'
        }));
        teFocussen = -1;
        return;
      }

      var wens = null;
      lijst.forEach(function (rij, index) {
        if (!isObj(rij)) return;
        var kaartNode = sjabloonKaart(rij, index);
        if (index === teFocussen) wens = kaartNode.naamVeld || null;
        lijstVak.appendChild(kaartNode);
      });
      teFocussen = -1;
      if (wens && fn(wens.focus)) wens.focus();
    }

    function sjabloonKaart(rij, index) {
      var naamIn = ui.el('input', { class: 'input', type: 'text', 'aria-label': 'Naam van dit sjabloon' });
      naamIn.value = str(rij.naam || rij.label || rij.key);
      naamIn.addEventListener('input', function () {
        var lijst = bewerkbaar();
        if (!isObj(lijst[index])) return;
        lijst[index].naam = naamIn.value;
        bewaar(lijst);
      });

      var aqlIn = ui.el('input', { class: 'input', type: 'text', 'aria-label': 'AQL-norm van dit sjabloon' });
      aqlIn.value = str(rij.aql);
      aqlIn.addEventListener('input', function () {
        var lijst = bewerkbaar();
        if (!isObj(lijst[index])) return;
        lijst[index].aql = aqlIn.value;
        bewaar(lijst);
      });

      /* de verdeling als één veld met schuine strepen, precies de vorm die
         het oude scherm had. De hint hieronder is de enige plek waar de
         uitkomst staat, dus hij mag nooit stil blijven: een onleesbare
         invoer wordt gemeld en NIET bewaard. */
      var pctHint = ui.el('span', { class: 'u-kicker', 'aria-live': 'polite' });
      var pctIn = ui.el('input', {
        class: 'input', type: 'text',
        'aria-label': 'Faseverdeling in procenten, ' + FASE_SLEUTELS.length + ' getallen gescheiden door schuine strepen'
      });
      pctIn.value = arr(rij.pct).join('/');

      function toonSom(delen) {
        var som = 0;
        delen.forEach(function (n) { som += getalOf(n, 0); });
        pctHint.textContent = 'Totaal ' + som + '%' + (som === 100 ? '' : ' — hoort 100% te zijn');
      }
      toonSom(arr(rij.pct));

      pctIn.addEventListener('input', function () {
        var ruw = pctIn.value.split(/[^0-9-]+/).filter(function (x) { return x !== ''; });
        var delen = ruw.map(function (x) { return parseInt(x, 10); });
        var fout = delen.length !== FASE_SLEUTELS.length;
        delen.forEach(function (n) { if (isNaN(n) || n < 0 || n > 100) fout = true; });
        if (fout) {
          pctHint.textContent = FASE_SLEUTELS.length + ' getallen van 0 tot 100 nodig, bijvoorbeeld 25/0/35/25/0/15 '
            + '— deze invoer wordt nog niet bewaard.';
          return;
        }
        var lijst = bewerkbaar();
        if (!isObj(lijst[index])) return;
        lijst[index].pct = delen;
        toonSom(delen);
        bewaar(lijst);
      });

      var volgorde = FASE_SLEUTELS.map(function (s, i) { return faseNaam(s, i); }).join(' · ');

      /* de twee leesbare lijsten */
      var extra = [];
      var slots = arr(rij.slots).filter(isObj).map(function (sl) {
        var soort = str(sl.docType).toUpperCase() || 'DOCUMENT';
        var fase = str(sl.stageKey) ? faseNaam(str(sl.stageKey), 0) : '';
        return fase ? (soort + ' · ' + fase) : soort;
      });
      if (slots.length) {
        extra.push(ui.el('p', { class: 'u-kicker', style: 'margin:16px 0 6px;', text: 'Documentslots' }));
        extra.push(ui.chipRow({ chips: slots, max: 8, restTitel: 'Ook nog' }));
      }
      var reeks = arr(rij.reeks).map(function (k) { return str(k).toUpperCase(); })
        .filter(function (s) { return !!s; });
      if (reeks.length) {
        extra.push(ui.el('p', { class: 'u-kicker', style: 'margin:16px 0 6px;', text: 'Inspectiereeks' }));
        extra.push(ui.chipRow({ chips: reeks, max: 8, restTitel: 'Ook nog' }));
      }

      /* HET ••• MET DE GEVAARLIJKE ACTIE ONDERIN, in de kritieke kleur en
         met bevestiging. Dit is tegelijk het einde van de laatste
         window.confirm() van het beheer: CP_UI.confirmInline vervangt hem,
         binnen het menu waar de actie staat. */
      var menu = ui.contextMenu({
        knop: { titel: 'Meer acties bij sjabloon: ' + (str(rij.naam) || 'naamloos') },
        items: [{
          label: 'Verwijder sjabloon',
          ico: 'sluiten',
          gevaarlijk: true,
          bevestig: {
            vraag: 'Sjabloon “' + (str(rij.naam) || 'naamloos') + '” verwijderen? Bestaande projecten veranderen niet. '
              + 'Het verdwijnt pas echt als je hierna opslaat.',
            bevestigLabel: 'Verwijderen'
          },
          onKies: function () {
            var lijst = bewerkbaar();
            lijst.splice(index, 1);
            bewaar(lijst);
            teken();
            if (fn(nieuwKnop.focus)) nieuwKnop.focus();
          }
        }]
      });

      var kaartNode = ui.el('div', { class: 'u-card', style: 'padding:20px;margin-bottom:14px;' }, [
        ui.el('div', { style: 'display:flex;gap:14px;align-items:flex-start;justify-content:space-between;' }, [
          ui.el('div', { style: 'flex:1;min-width:0;' }, [
            formRij(ui, [
              veldVak(ui, 'Naam', naamIn),
              veldVak(ui, 'AQL-norm', aqlIn)
            ]),
            veldVak(ui, 'Faseverdeling (%)', pctIn, 'Volgorde: ' + volgorde)
          ]),
          menu.el
        ]),
        pctHint,
        ui.el('div', null, extra)
      ]);
      /* zodat teken() weet welk veld de focus krijgt na "Nieuw sjabloon" */
      kaartNode.naamVeld = naamIn;
      return kaartNode;
    }

    nieuwKnop.addEventListener('click', function () {
      var lijst = bewerkbaar();
      var basisPct = arr(buf.lees('faseSjabloonPct')).map(function (n) { return Math.round(getalOf(n, 0)); });
      if (basisPct.length !== FASE_SLEUTELS.length) {
        /* geen verzonnen verdeling: liever zes nullen en een hint die zegt
           dat het nog geen 100% is, dan een verdeling die niemand koos */
        basisPct = FASE_SLEUTELS.map(function () { return 0; });
      }
      teller += 1;
      lijst.push({
        id: 'tpl-' + new Date().getTime() + '-' + teller,
        naam: 'Nieuw sjabloon',
        pct: basisPct,
        aql: str(buf.lees('standaardAql')),
        slots: [],
        reeks: []
      });
      bewaar(lijst);
      teFocussen = lijst.length - 1;
      teken();
    });

    teken();
    return vak;
  }

  /* Automatiseringen: de dagcapaciteit waar "Operaties deze week" tegen
     afzet. LEGENDA IS WERKDRUK, NIET FABRIEKSCAPACITEIT — dat laatste
     meten we niet en we doen ook niet alsof (hoofdstuk 7 van de spec). */
  function capaciteitBlok(c, buf, opVerandering) {
    var ui = c.ui;
    var dagen = (c.db && arr(c.db.WEEKDAGEN).length) ? c.db.WEEKDAGEN : [
      { key: 'ma', label: 'Maandag' }, { key: 'di', label: 'Dinsdag' }, { key: 'wo', label: 'Woensdag' },
      { key: 'do', label: 'Donderdag' }, { key: 'vr', label: 'Vrijdag' }, { key: 'za', label: 'Zaterdag' },
      { key: 'zo', label: 'Zondag' }
    ];
    var standaard = (c.db && isObj(c.db.CAPACITEIT_DEFAULT)) ? c.db.CAPACITEIT_DEFAULT : {};
    var huidig = opt(buf.lees('capacityPerWeekday'));

    var rij = ui.el('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;' });
    dagen.forEach(function (d) {
      var inp = ui.el('input', {
        class: 'input', type: 'number', min: '0', max: '48', step: '1',
        style: 'max-width:88px;',
        'aria-label': 'Aantal acties dat op ' + str(d.label).toLowerCase() + ' past'
      });
      var w = huidig[d.key];
      inp.value = String(getalOf(w, getalOf(standaard[d.key], 0)));
      inp.addEventListener('input', function () {
        var basis = buf.neem('capacityPerWeekday', {});
        basis[d.key] = (inp.value === '') ? null : Math.max(0, Math.round(getalOf(inp.value, 0)));
        buf.zet('capacityPerWeekday', basis);
        if (fn(opVerandering)) opVerandering();
      });
      rij.appendChild(veldVak(ui, str(d.label), inp));
    });

    return ui.el('div', { style: 'margin-top:26px;' }, [
      ui.sectionHead({ titel: 'Werkdruk per weekdag' }),
      uitlegP(ui, 'Hoeveel acties er op een dag passen. Dit is JOUW werkdruk, geen fabriekscapaciteit — die meten '
        + 'we niet. "Operaties deze week" op het Overzicht zet het echte aantal geplande acties hier tegen af.'),
      rij
    ]);
  }

  /* E-mail & sjablonen: links kiezen, rechts bewerken. De keuze van
     sjabloon en taal is de stand van dit ene widget en gaat bewust NIET via
     de route: navigeren zou de onopgeslagen buffer weggooien, en dat is
     precies het risico dat het nieuwe opslagmodel wegneemt. */
  function mailBlok(c, buf, L, opVerandering) {
    var ui = c.ui;
    var settings = opt(L.settings);
    var sjabloonSleutels = sleutelsVan(settings.mailSjablonen);
    var vak = ui.el('div');

    if (!sjabloonSleutels.length) {
      vak.appendChild(ui.emptyTile({
        icoon: 'mail',
        titel: 'Nog geen mailsjablonen',
        uitleg: 'De sjablonen worden bij het eerste gebruik van het beheer aangemaakt. Open het beheer opnieuw '
          + 'als deze lijst leeg blijft.'
      }));
      return vak;
    }

    var gekozenSjabloon = sjabloonSleutels[0];
    var gekozenTaal = TALEN[0].key;

    var kiesSjabloon = ui.el('select', { class: 'input' });
    sjabloonSleutels.forEach(function (k) {
      kiesSjabloon.appendChild(ui.el('option', { value: k, text: SJABLOON_LABEL[k] || k }));
    });
    var kiesTaal = ui.el('select', { class: 'input' });
    TALEN.forEach(function (t) {
      kiesTaal.appendChild(ui.el('option', { value: t.key, text: t.label }));
    });

    var onderwerpIn = ui.el('input', { class: 'input', type: 'text' });
    var tekstIn = ui.el('textarea', { class: 'input', rows: '7' });

    function pad(veld) { return gekozenSjabloon + '.' + gekozenTaal + '.' + veld; }

    function vul() {
      var bron = buf.lees('mailSjablonen');
      onderwerpIn.value = str(leesPad(bron, pad('subject')));
      tekstIn.value = str(leesPad(bron, pad('body')));
    }
    function bewaar(veld, waarde) {
      var basis = buf.neem('mailSjablonen', {});
      buf.zet('mailSjablonen', zetPad(basis, pad(veld), waarde));
      if (fn(opVerandering)) opVerandering();
    }

    kiesSjabloon.addEventListener('change', function () { gekozenSjabloon = kiesSjabloon.value; vul(); });
    kiesTaal.addEventListener('change', function () { gekozenTaal = kiesTaal.value; vul(); });
    onderwerpIn.addEventListener('input', function () { bewaar('subject', onderwerpIn.value); });
    tekstIn.addEventListener('input', function () { bewaar('body', tekstIn.value); });
    vul();

    vak.appendChild(sectiekop(ui, { titel: 'Mailsjablonen', telling: sjabloonSleutels.length }));
    vak.appendChild(formRij(ui, [
      veldVak(ui, 'Sjabloon', kiesSjabloon),
      veldVak(ui, 'Taal', kiesTaal)
    ]));
    vak.appendChild(veldVak(ui, 'Onderwerpregel', onderwerpIn));
    vak.appendChild(veldVak(ui, 'Tekst', tekstIn,
      'Wisselen van sjabloon of taal bewaart je wijziging in de buffer; hij gaat pas weg als je hem opslaat of herstelt.'));

    /* de automatische onderwerpregels */
    var onderwerpen = sleutelsVan(settings.mailOnderwerpen);
    if (onderwerpen.length) {
      var onderwerpVak = ui.el('div', { style: 'margin-top:26px;' }, [
        sectiekop(ui, { titel: 'Automatische onderwerpregels', telling: onderwerpen.length }),
        uitlegP(ui, 'Deze regels gaan mee met de mails die het beheer zelf verstuurt bij een fase, een publicatie '
          + 'of een zending.')
      ]);
      onderwerpen.forEach(function (k) {
        var inp = ui.el('input', { class: 'input', type: 'text' });
        inp.value = str(leesPad(buf.lees('mailOnderwerpen'), k));
        inp.addEventListener('input', function () {
          var basis = buf.neem('mailOnderwerpen', {});
          buf.zet('mailOnderwerpen', zetPad(basis, k, inp.value));
          if (fn(opVerandering)) opVerandering();
        });
        onderwerpVak.appendChild(veldVak(ui, ONDERWERP_LABEL[k] || k, inp));
      });
      vak.appendChild(onderwerpVak);
    }

    /* de snippets: één per regel. Een lijst als tekstvak is hier de
       eerlijkste vorm — het zijn losse zinnen zonder eigen eigenschappen. */
    var snipVak = ui.el('div', { style: 'margin-top:26px;' }, [
      ui.sectionHead({ titel: 'Onderschrift-snippets' })
    ]);
    var snipTa = ui.el('textarea', { class: 'input', rows: '5' });
    snipTa.value = arr(buf.lees('snippets')).join('\n');
    snipTa.addEventListener('input', function () {
      var regels = snipTa.value.split('\n').map(function (r) { return r.replace(/^\s+|\s+$/g, ''); })
        .filter(function (r) { return !!r; });
      buf.zet('snippets', regels);
      if (fn(opVerandering)) opVerandering();
    });
    snipVak.appendChild(veldVak(ui, 'Eén snippet per regel', snipTa,
      'Tekst tussen accolades is een invulveld, bijvoorbeeld {fabriek} of {datum}.'));
    vak.appendChild(snipVak);

    return vak;
  }

  /* een instructieregel: gewone tekst met daarin exacte namen als <code>.
     `delen` is een lijst van strings en {code:'…'}; zo staat een
     variabelenaam er letterlijk en in mono, en blijft de zin eromheen
     gewone tekst die je kunt lezen. */
  function goLiveRegel(ui, delen) {
    var kinderen = [];
    arr(delen).forEach(function (d) {
      if (isObj(d) && str(d.code)) {
        kinderen.push(ui.el('code', { style: 'font-family:var(--mono);font-size:13px;', text: str(d.code) }));
      } else if (str(d)) {
        kinderen.push(str(d));
      }
    });
    return ui.el('li', { style: 'margin:0 0 6px;' }, kinderen);
  }

  /* een externe link: nieuw tabblad, zonder opener, en het icoon zegt het
     ook aan wie niet kijkt */
  function goLiveExterneLink(ui, label, url) {
    return ui.el('a', {
      class: 'u-link', href: str(url), target: '_blank', rel: 'noopener noreferrer',
      'aria-label': str(label) + ' (opent in een nieuw tabblad)'
    }, [ui.el('span', { text: str(label) }), fn(ui.icon) ? ui.icon('extern', 15) : null]);
  }

  /* één rij in de omgevingsvariabelenlijst van de netlifyEnv-stap: de naam
     in mono, een kopieerknop die ALLEEN die naam op het klembord zet (er is
     geen waarde om te kopiëren — die typt de eigenaar zelf in Netlify), en
     de uitleg eronder. `item.terugval`, als die er is, is het eerlijke
     antwoord op "wat gebeurt er als ik dit oversla" — letterlijk geciteerd
     uit de functie zelf (zie GO_LIVE_ENV_VARS hierboven). */
  function goLiveEnvVarRegel(ui, meld, item) {
    var kopieerKnop = ui.el('button', {
      type: 'button', class: 'u-btn ghost klein',
      text: 'Kopieer naam', 'aria-label': 'Kopieer de naam ' + item.naam + ' (geen waarde, die staat nergens om te kopiëren)'
    });
    kopieerKnop.addEventListener('click', function () {
      var g = G();
      var belofte = (g && g.navigator && g.navigator.clipboard && fn(g.navigator.clipboard.writeText))
        ? g.navigator.clipboard.writeText(item.naam)
        : Promise.reject(new Error('geen klembord beschikbaar'));
      belofte.then(function () {
        meld('Naam gekopieerd: ' + item.naam + ' (geen waarde — die vul je zelf in op Netlify).');
      }, function () {
        meld('Kopiëren naar het klembord lukte niet in deze browser; typ de naam over: ' + item.naam);
      });
    });
    var kinderen = [
      ui.el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' }, [
        ui.el('code', { style: 'font-family:var(--mono);font-size:13px;', text: item.naam }),
        kopieerKnop
      ]),
      ui.el('p', { class: 'u-sub', style: 'margin:4px 0 0;max-width:64ch;', text: item.uitleg })
    ];
    if (item.terugval) {
      kinderen.push(ui.el('p', { class: 'u-sub', style: 'margin:2px 0 0;max-width:64ch;', text: 'Ontbreekt hij: ' + item.terugval }));
    }
    return ui.el('div', { style: 'padding:10px 0;border-top:1px solid var(--line-2);' }, kinderen);
  }

  /* een groep (Verplicht of Optioneel) van GO_LIVE_ENV_VARS als kop + rijen */
  function goLiveEnvVarGroep(ui, meld, titel, lijst) {
    return ui.el('div', { style: 'margin:14px 0 4px;' }, [
      ui.el('span', { class: 'u-kicker', text: titel }),
      ui.el('div', null, arr(lijst).map(function (item) { return goLiveEnvVarRegel(ui, meld, item); }))
    ]);
  }

  /* Integraties: de wizard "Klaar voor live".
     Dezelfde data en dezelfde controles als de lijst die hier stond — de
     vinkjes in settings.goLive en voerGoLiveControlesUit() in beheer.html —
     maar één stap tegelijk open, met per stap wat je doet, waar, en één
     knop die de echte controle draait waar dat kan.

     UITZONDERING 1 — de vinkjes slaan DIRECT op, want ze zijn geen formulier
     maar een handeling: je vinkt af wat je zojuist in een ander venster
     hebt gecontroleerd.

     WAT "KLAAR" HIER BETEKENT, en dat is de hele afspraak van dit blok: een
     stap is klaar als de controle zelf 'ok' meldde, of als jij het vinkje
     hebt gezet. Niets anders. De kop van elke stap zegt welk van de twee
     het is ("In orde · gecontroleerd op …" tegenover "Handmatig
     afgevinkt"), zodat een vinkje nooit voor een gemeten uitslag kan
     doorgaan.

     Wat de haak niet meldt, meldt dit blok zelf en met dezelfde eerlijkheid:
     is_staff() aan de databank (stap 4) en de gezondheidsvraag aan de
     mailfunctie (stap 5). Allebei lezen ze alleen; zie de twee probes
     boven GO_LIVE_STAPPEN. */
  function goLiveBlok(c, L, meld) {
    var ui = c.ui;
    var settings = opt(L.settings);
    var goLive = opt(settings.goLive);
    var demo = !(c.db && fn(c.db.modus) && str(c.db.modus()) === 'supa');
    var controleren = haak(c, 'goLiveControleren');
    var probeLijst = goLiveProbeLijst(c);
    var totaal = GO_LIVE_STAPPEN.length;

    /* de stand per stap. soort: geen · bezig · ok · warn · bad · demo ·
       onbekend. `op` is het moment van de uitslag, zodat de kop kan zeggen
       wannéér er gecontroleerd is — een uitslag van gisteren is geen stand
       van nu. */
    var standen = {};
    GO_LIVE_STAPPEN.forEach(function (s) { standen[s.key] = { soort: 'geen', tekst: '', op: '' }; });
    var open = -1;
    var laatsteMigratieTekst = '';
    var delen = [];

    function nuISO() {
      try { return new Date().toISOString(); } catch (e) { return ''; }
    }
    function wanneer(iso) {
      var d = datumTekst(iso, c.model);
      var t = tijdTekst(iso, c.model);
      if (!d && !t) return '';
      return (d ? 'op ' + d : '') + (t ? (d ? ', ' : 'om ') + t : '');
    }
    function vinkStaat(stap) { return !!(stap.vink && goLive[stap.vink] === true); }
    function isKlaar(stap) { return standen[stap.key].soort === 'ok' || vinkStaat(stap); }

    /* de kop van een dichtgeklapte stap: toon + woord. De volgorde is de
       afspraak uit het kopblok: een gemeten 'ok' gaat vóór het vinkje, het
       vinkje vóór een gemeten waarschuwing (want dan heb jij bewust
       afgevinkt en zegt de kop dat de controle iets anders zag). */
    function standLabel(stap) {
      var s = standen[stap.key];
      if (s.soort === 'bezig') return { toon: 'neutraal', label: 'Wordt gecontroleerd…' };
      if (s.soort === 'ok') return { toon: 'ok', label: 'In orde · gecontroleerd ' + (wanneer(s.op) || 'zojuist') };
      if (vinkStaat(stap)) {
        var extra = (s.soort === 'warn') ? ' · controle: aandacht' : ((s.soort === 'bad') ? ' · controle: mislukt' : '');
        return { toon: 'ok', label: 'Handmatig afgevinkt' + extra };
      }
      if (s.soort === 'warn') return { toon: 'warn', label: 'Aandacht · gecontroleerd ' + (wanneer(s.op) || 'zojuist') };
      if (s.soort === 'bad') return { toon: 'crit', label: 'Mislukt · gecontroleerd ' + (wanneer(s.op) || 'zojuist') };
      if (s.soort === 'demo') return { toon: 'neutraal', label: 'Niet te controleren in de demo' };
      if (s.soort === 'onbekend') return { toon: 'neutraal', label: 'Niet te controleren vanaf hier' };
      return { toon: 'neutraal', label: stap.probe ? 'Nog niet gecontroleerd' : 'Nog niet gedaan' };
    }

    /* de titel van stap 2 volgt de probe-lijst: uit de aangeboden lijst als
       die er is, anders uit de laatste uitslag ("… (0001 t/m 0021)"), en
       zonder een van beide staat er geen bereik — een bereik verzinnen is
       precies wat de oude kop "0001 tot en met 0005" deed. */
    function migratieTitel() {
      if (probeLijst.length) return 'Migraties ' + probeLijst[0].mig + ' tot en met ' + probeLijst[probeLijst.length - 1].mig + ' draaien';
      var codes = migratieCodes(laatsteMigratieTekst);
      if (/t\/m/.test(laatsteMigratieTekst) && codes.length >= 2) return 'Migraties ' + codes[0] + ' tot en met ' + codes[codes.length - 1] + ' draaien';
      return 'Migraties draaien';
    }
    function stapTitel(stap) { return stap.key === 'migraties' ? migratieTitel() : str(stap.titel); }

    /* ---- de kop van het blok: sectiekop, uitleg, voortgang ------------ */
    var vak = ui.el('div', {
      style: 'margin-top:26px;',
      /* HET DOEL VAN DE ENIGE DEEPLINK VAN HET BEHEER. De knop achter de
         Demo-badge komt hier binnen met ?focus=golive; dan moet de focus
         hierop landen en niet bovenaan de pagina blijven staan.
         tabindex -1 maakt het blok programmatisch focusbaar zonder het in
         de tabvolgorde te zetten, en de groep draagt zijn eigen naam zodat
         een schermlezer meldt waar je terechtkomt. */
      tabindex: '-1',
      role: 'group',
      'aria-label': 'Go-live-checklist'
    }, [
      ui.sectionHead({ kicker: 'Go-live-checklist', titel: 'Klaar voor live' }),
      uitlegP(ui, 'Tien stappen naar een echte omgeving, één tegelijk. Waar een controle vanuit de browser kan, doet '
        + 'de knop Controleer een echt verzoek en zegt de uitslag wat hij zag; waar dat niet kan, staat dat erbij en '
        + 'vink je zelf af. Klaar betekent dus altijd een echte uitslag of jouw vinkje, nooit een aanname.')
    ]);

    var voortgangTekst = ui.el('span', { class: 'u-kicker', text: '' });
    var balkVulling = ui.el('span', { style: 'display:block;height:100%;width:0;background:var(--ink);border-radius:999px;' });
    /* een dunne balk: er is geen balk-primitief in CP_CHART (ring, stagePath
       en stepper zijn het niet), dus een role=progressbar met tokens. De
       vulling is inkt en niet groen: de kop per stap draagt de betekenis al. */
    var balk = ui.el('div', {
      role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(totaal), 'aria-valuenow': '0',
      'aria-label': '0 van ' + totaal + ' stappen klaar',
      style: 'height:4px;background:var(--line-2);border-radius:999px;overflow:hidden;margin-top:8px;'
    }, [balkVulling]);

    var allesKnop = ui.el('button', { type: 'button', class: 'u-btn ghost', text: 'Controleer alle stappen' });

    vak.appendChild(ui.el('div', { style: 'margin-top:4px;' }, [
      ui.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;' }, [
        voortgangTekst, allesKnop
      ]),
      balk
    ]));

    function tekenVoortgang() {
      var n = 0;
      GO_LIVE_STAPPEN.forEach(function (s) { if (isKlaar(s)) n += 1; });
      voortgangTekst.textContent = (open >= 0 ? ('Stap ' + (open + 1) + ' van ' + totaal + ' · ') : '') + n + ' van ' + totaal + ' klaar';
      balkVulling.style.width = Math.round((n / totaal) * 100) + '%';
      balk.setAttribute('aria-valuenow', String(n));
      balk.setAttribute('aria-label', n + ' van ' + totaal + ' stappen klaar');
    }

    /* ---- de accordeon ---------------------------------------------- */
    var lijst = ui.el('div', { class: 'u-card u-rows', style: 'margin-top:14px;' });
    /* meldingen van de haak onder een sleutel die geen stap is; leeg en
       verborgen tot er zo'n melding komt */
    var extraVak = ui.el('div', { style: 'margin-top:8px;' });
    extraVak.hidden = true;

    function toon(i, metFocus) {
      open = (i >= 0 && i < totaal) ? i : -1;
      delen.forEach(function (d, j) {
        var aan = (j === open);
        d.paneel.hidden = !aan;
        d.kop.setAttribute('aria-expanded', aan ? 'true' : 'false');
      });
      tekenVoortgang();
      if (metFocus && open >= 0 && fn(delen[open].kop.focus)) delen[open].kop.focus();
    }

    function tekenStand(stap) {
      var d = delen[stapIndex(stap.key)];
      if (!d) return;
      var s = standen[stap.key];
      var l = standLabel(stap);
      ui.clear(d.standVak);
      d.standVak.appendChild(ui.statusDot({ toon: l.toon, label: l.label }));
      d.titelEl.textContent = stapTitel(stap);
      d.uitslagEl.textContent = str(s.tekst) || (stap.probe ? 'Nog niet gecontroleerd.' : '');
      var uitleg = (s.soort === 'bad' || s.soort === 'warn') ? goLiveFoutUitleg(s.tekst) : '';
      d.foutEl.textContent = uitleg;
      d.foutEl.hidden = !uitleg;
      if (stap.key === 'migraties') tekenMigraties(d);
      tekenVoortgang();
    }
    function stapIndex(key) {
      for (var i = 0; i < GO_LIVE_STAPPEN.length; i++) if (GO_LIVE_STAPPEN[i].key === key) return i;
      return -1;
    }
    function zetStand(key, soort, tekst) {
      var i = stapIndex(key);
      if (i < 0) return;
      standen[key] = { soort: str(soort) || 'geen', tekst: str(tekst), op: (soort === 'bezig' || soort === 'geen') ? '' : nuISO() };
      tekenStand(GO_LIVE_STAPPEN[i]);
    }

    /* per migratie een regel, als de lijst bekend is; anders wat de uitslag
       zelf prijsgeeft (de ontbrekende nummers) en niets meer */
    function tekenMigraties(d) {
      ui.clear(d.migratieVak);
      var s = standen.migraties;
      var codes = migratieCodes(s.tekst);
      var ontbrekend = /nog niet/i.test(s.tekst) ? codes : [];
      function regel(naam, sub, toon, woord) {
        return ui.el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--line-2);' }, [
          ui.el('span', { style: 'display:flex;gap:10px;align-items:baseline;min-width:0;' }, [
            ui.el('span', { style: 'font-family:var(--mono);font-size:13px;', text: naam }),
            sub ? ui.el('span', { class: 'u-sub', text: sub }) : null
          ]),
          ui.statusDot({ toon: toon, label: woord })
        ]);
      }
      if (probeLijst.length) {
        probeLijst.forEach(function (p) {
          var toon = 'neutraal', woord = 'Nog niet gecontroleerd';
          if (s.soort === 'ok') { toon = 'ok'; woord = 'In orde'; }
          else if (s.soort === 'bad') {
            if (ontbrekend.indexOf(p.mig) >= 0) { toon = 'crit'; woord = 'Ontbreekt'; }
            else { toon = 'ok'; woord = 'In orde'; }
          }
          d.migratieVak.appendChild(regel(p.mig, p.tabel ? (p.tabel + (p.kolom ? '.' + p.kolom : '')) : '', toon, woord));
        });
        return;
      }
      if (s.soort === 'bad' && ontbrekend.length) {
        ontbrekend.forEach(function (code) { d.migratieVak.appendChild(regel(code, '', 'crit', 'Ontbreekt')); });
        d.migratieVak.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:8px 0 0;max-width:66ch;',
          text: 'De migraties die hier niet staan, antwoordden wel. Welke nummers de controle aanprikt, meldt beheer.html niet aan deze weergave; daarom staan alleen de ontbrekende hier.' }));
      }
    }

    /* de haak meldt asynchroon en soms nadat dit scherm al vervangen is;
       op een losgekoppelde knoop schrijven doet niets en is dus geen fout */
    function meldControle(sleutel, stand, tekst) {
      var k = str(sleutel);
      if (k === 'rls') return;                  /* het vinkje teruggelezen; zie GO_LIVE_STAPPEN */
      var key = GO_LIVE_HAAK_NAAR_STAP[k];
      if (!key) {
        /* een sleutel die deze wizard niet kent: tonen, niet weggooien —
           stil weggooien zou de enige uitkomst verbergen die niemand verwacht */
        extraVak.hidden = false;
        extraVak.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:6px 0 0;max-width:66ch;',
          text: 'Melding van de controle die bij geen stap hoort (' + k + '): ' + (str(tekst) || 'zonder tekst') }));
        return;
      }
      var stap = GO_LIVE_STAPPEN[stapIndex(key)];
      if (demo && stap.demoDb) return;          /* de demo-stand staat er al en is de waarheid */
      if (key === 'migraties' && str(stand)) laatsteMigratieTekst = str(tekst);
      var soort = str(stand) ? (GO_LIVE_TOON[str(stand)] ? str(stand) : 'onbekend') : 'bezig';
      zetStand(key, soort, str(tekst) || 'Geen uitkomst gemeld.');
    }

    /* ÉÉN CONTROLERONDE VOOR ALLES. De haak kent geen losse controle per
       stap — hij draait ze alle vijf en meldt per sleutel — en de twee
       eigen probes zijn goedkoop. Elke knop Controleer draait daarom
       dezelfde ronde; het verschil per stap is welk paneel je open hebt. */
    function controleerAlles() {
      GO_LIVE_STAPPEN.forEach(function (s) {
        if (!s.probe) return;
        if (demo && s.demoDb) { zetStand(s.key, 'demo', GO_LIVE_DEMO_TEKST); return; }
        zetStand(s.key, 'bezig', 'Wordt gecontroleerd…');
      });
      if (controleren) {
        try { controleren(meldControle); }
        catch (e) {
          meld('Controleren mislukt: ' + foutTekst(e));
          GO_LIVE_STAPPEN.forEach(function (s) {
            if (GO_LIVE_HAAK_NAAR_STAP[s.probe] && standen[s.key].soort === 'bezig') zetStand(s.key, 'bad', 'De controle van het beheer klapte: ' + foutTekst(e));
          });
        }
      } else {
        GO_LIVE_STAPPEN.forEach(function (s) {
          if (s.probe && GO_LIVE_HAAK_NAAR_STAP[s.probe] && standen[s.key].soort === 'bezig') {
            zetStand(s.key, 'onbekend', 'De controles van het beheer (config, migraties, mailfunctie, portal-URL en de eerste klantlogin) zijn aan deze weergave niet doorgegeven.');
          }
        });
      }
      /* in demomodus staat de demo-stand er al (staf heeft demoDb) en is
         dat de waarheid; is_staff() zonder databank vragen is zinloos */
      if (!demo) {
        goLiveStafProbe(c).then(function (r) { zetStand('staf', r.stand, r.tekst); });
      }
      goLiveNetlifyEnvProbe().then(function (r) { zetStand('netlifyEnv', r.stand, r.tekst); });
      goLiveMistralProbe().then(function (r) { zetStand('mistral', r.stand, r.tekst); });
    }
    allesKnop.addEventListener('click', controleerAlles);

    /* ---- de tien stappen --------------------------------------------- */
    GO_LIVE_STAPPEN.forEach(function (stap, i) {
      var kopId = 'golive-kop-' + stap.key;
      var paneelId = 'golive-paneel-' + stap.key;
      var standVak = ui.el('span', { style: 'margin-left:auto;flex:none;' });
      var titelEl = ui.el('span', { class: 'u-row-title', style: 'min-width:0;', text: stapTitel(stap) });
      var chevron = fn(ui.icon) ? ui.icon('chevronOmlaag', 18) : null;
      if (chevron) chevron.setAttribute('class', 'u-row-chevron');

      /* de kop is een echte knop met aria-expanded; .u-btn.stil geeft hem
         het hoverblad en de focusring van elke andere knop, de inline
         regels maken er een rij van in plaats van een pil */
      var kop = ui.el('button', {
        type: 'button', id: kopId, class: 'u-btn stil',
        'aria-expanded': 'false', 'aria-controls': paneelId,
        style: 'width:100%;justify-content:flex-start;text-align:left;white-space:normal;border-radius:0;padding:16px 18px;gap:12px;min-height:56px;'
      }, [
        ui.el('span', { class: 'u-kicker', style: 'flex:none;min-width:2.2ch;', text: pad2(i + 1) }),
        titelEl, standVak, chevron
      ]);
      kop.addEventListener('click', function () { toon(open === i ? -1 : i, false); });

      var paneel = ui.el('div', { id: paneelId, style: 'padding:2px 18px 22px 58px;' });
      paneel.hidden = true;

      /* wat je doet */
      paneel.appendChild(ui.el('span', { class: 'u-kicker', text: 'Wat je doet' }));
      paneel.appendChild(ui.el('ol', { class: 'u-lees', style: 'margin:6px 0 14px;padding-left:20px;max-width:70ch;' },
        arr(stap.doen).map(function (regel) { return goLiveRegel(ui, regel); })));

      /* waar */
      if (arr(stap.plekken).length) {
        paneel.appendChild(ui.el('span', { class: 'u-kicker', text: 'Waar' }));
        paneel.appendChild(ui.el('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;margin:6px 0 14px;' },
          stap.plekken.map(function (p) { return goLiveExterneLink(ui, p.label, supabaseLink(p.pad)); })));
      }

      /* de volledige, actuele lijst omgevingsvariabelen — alleen bij deze
         ene stap, want de lijst zelf (GO_LIVE_ENV_VARS) hoort daar en
         nergens anders thuis */
      if (stap.key === 'netlifyEnv') {
        paneel.appendChild(ui.el('span', { class: 'u-kicker', text: 'Alle omgevingsvariabelen' }));
        paneel.appendChild(goLiveEnvVarGroep(ui, meld, 'Verplicht', GO_LIVE_ENV_VARS.verplicht));
        paneel.appendChild(goLiveEnvVarGroep(ui, meld, 'Optioneel', GO_LIVE_ENV_VARS.optioneel));
      }

      /* de controle: wat hij doet, en de uitslag — de zin is de uitkomst en
         draagt aria-live, de stip in de kop is beeld */
      paneel.appendChild(ui.el('span', { class: 'u-kicker', text: stap.probe ? 'Controle' : 'Niet automatisch te controleren' }));
      paneel.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:6px 0 8px;max-width:66ch;', text: str(stap.controle) }));
      var uitslagEl = ui.el('p', { class: 'u-lees', 'aria-live': 'polite', style: 'margin:0 0 4px;max-width:66ch;', text: stap.probe ? 'Nog niet gecontroleerd.' : '' });
      var foutEl = ui.el('p', { class: 'u-sub', style: 'margin:0 0 8px;max-width:66ch;', text: '' });
      foutEl.hidden = true;
      var migratieVak = ui.el('div', { style: 'margin:6px 0 10px;' });
      paneel.appendChild(uitslagEl);
      paneel.appendChild(foutEl);
      if (stap.key === 'migraties') paneel.appendChild(migratieVak);

      /* het handmatige vinkje — slaat meteen op, precies zoals voorheen,
         onder dezelfde sleutel settings.goLive */
      var vinkEl = null;
      if (stap.vink) {
        var item = null;
        GO_LIVE_VINKJES.forEach(function (v) { if (v.key === stap.vink) item = v; });
        if (item) {
          vinkEl = ui.el('input', { type: 'checkbox', checked: goLive[item.key] === true });
          vinkEl.addEventListener('change', function () {
            var aan = !!vinkEl.checked;
            vinkEl.disabled = true;
            var volgende = kloon(goLive) || {};
            volgende[item.key] = aan;
            schrijf(c, 'instelling', 'goLive', volgende).then(function () {
              goLive = volgende;
              vinkEl.disabled = false;
              tekenStand(stap);
              meld(aan ? 'Afgevinkt en opgeslagen.' : 'Vinkje weggehaald en opgeslagen.');
            }, function (e) {
              /* terugdraaien: het scherm mag nooit een vinkje tonen dat niet
                 bewaard is */
              vinkEl.checked = !aan;
              vinkEl.disabled = false;
              meld('Opslaan mislukt: ' + foutTekst(e));
            });
          });
          paneel.appendChild(ui.el('div', { style: 'margin:10px 0 4px;' }, [
            ui.el('label', { class: 'checkline', style: 'min-height:44px;margin:0;' }, [vinkEl, ui.el('span', { text: item.label })]),
            ui.el('span', { class: 'u-sub', style: 'display:block;margin:2px 0 0 25px;max-width:64ch;', text: item.uitleg })
          ]));
        }
      }

      /* de knoppen: Controleer waar een controle bestaat, Volgende tot de
         laatste stap. Geen knop die niets doet: zonder haak én zonder
         eigen probe staat er geen Controleer. */
      var knoppen = [];
      var kanControleren = !!stap.probe && (stap.probe === 'staf' || stap.probe === 'netlifyEnv' || stap.probe === 'mistral' || !!controleren);
      if (kanControleren) {
        knoppen.push(ui.el('button', { type: 'button', class: 'u-btn', text: 'Controleer', onclick: controleerAlles }));
      } else if (stap.probe) {
        paneel.appendChild(ui.el('p', { class: 'u-sub', style: 'margin:0 0 8px;max-width:66ch;',
          text: 'De controle van deze stap loopt via het beheerscherm en is aan deze weergave niet doorgegeven.' }));
      }
      if (i < totaal - 1) {
        knoppen.push(ui.el('button', {
          type: 'button', class: 'u-btn ghost', onclick: function () { toon(i + 1, true); }
        }, [ui.el('span', { text: 'Volgende' }), fn(ui.icon) ? ui.icon('chevron', 16) : null]));
      }
      if (knoppen.length) {
        paneel.appendChild(ui.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;' }, knoppen));
      }

      lijst.appendChild(ui.el('div', null, [kop, paneel]));
      delen.push({ kop: kop, paneel: paneel, standVak: standVak, titelEl: titelEl, uitslagEl: uitslagEl, foutEl: foutEl, migratieVak: migratieVak, vink: vinkEl });
    });

    vak.appendChild(lijst);
    vak.appendChild(extraVak);

    /* eerste tekening: elke kop met zijn stand (vinkjes tellen al), en de
       eerste stap die nog niet klaar is staat open */
    GO_LIVE_STAPPEN.forEach(tekenStand);
    var eerste = 0;
    for (var e = 0; e < totaal; e++) { if (!isKlaar(GO_LIVE_STAPPEN[e])) { eerste = e; break; } }
    toon(eerste, false);

    return vak;
  }

  /* Team & rechten: de rollen uit CP_DATA.ROLLEN, met de eerlijke regel
     erbij zolang CP_DATA.RECHTEN_AFGEDWONGEN false is. Die regel is geen
     garnering: een rolkeuze die suggereert dat er iets wordt afgedwongen
     terwijl dat niet zo is, is erger dan geen rolkeuze. */
  function teamBlok(c, L, teamBuf, opVerandering) {
    var ui = c.ui;
    var leden = arr(L.team);
    var rollen = (c.db && arr(c.db.ROLLEN).length) ? c.db.ROLLEN : [];
    var afgedwongen = !!(c.db && c.db.RECHTEN_AFGEDWONGEN === true);
    var statussen = (c.db && arr(c.db.TEAM_STATUS).length) ? c.db.TEAM_STATUS : [];

    function statusLabel(key) {
      for (var i = 0; i < statussen.length; i++) if (statussen[i].key === str(key)) return statussen[i].label;
      return str(key) || 'Onbekend';
    }
    function statusToon(key) {
      if (str(key) === 'actief') return 'ok';
      if (str(key) === 'uitgenodigd') return 'warn';
      return 'neutraal';
    }

    var vak = ui.el('div');

    if (!afgedwongen && c.db && str(c.db.RECHTEN_UITLEG)) {
      /* de eerlijkheidsregel staat BOVEN de rollen en niet eronder: je moet
         hem gelezen hebben voordat je een rol toekent */
      vak.appendChild(ui.el('p', {
        class: 'u-lees',
        style: 'max-width:70ch;margin:0 0 22px;padding:16px 18px;background:var(--warn-soft,#fbeee2);'
          + 'border:1px solid var(--line);border-radius:var(--r-card,20px);',
        text: str(c.db.RECHTEN_UITLEG)
      }));
    }

    vak.appendChild(sectiekop(ui, { titel: 'Teamleden', telling: leden.length }));

    if (!leden.length) {
      vak.appendChild(ui.emptyTile({
        icoon: 'team',
        titel: 'Nog geen teamleden',
        uitleg: 'Je werkt alleen. Zodra er iemand bijkomt, verschijnt hij hier met een rol en een status.'
      }));
    } else {
      var rijen = [];
      leden.forEach(function (lid) {
        var id = str(lid.id);
        var naam = str(lid.name || lid.naam) || str(lid.email) || 'Naamloos teamlid';
        var huidigeRol = Object.prototype.hasOwnProperty.call(teamBuf.rollen, id)
          ? teamBuf.rollen[id] : str(lid.role || lid.rol);

        var sel = ui.el('select', {
          class: 'input',
          style: 'max-width:190px;',
          'aria-label': 'Rol van ' + naam
        });
        rollen.forEach(function (r) {
          var o = ui.el('option', { value: r.key, text: r.label });
          if (r.key === huidigeRol) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener('change', function () {
          teamBuf.rollen[id] = sel.value;
          teamBuf.vuil = true;
          if (fn(opVerandering)) opVerandering();
        });

        rijen.push(ui.el('div', {
          class: 'u-row',
          /* .u-row is een flexrij zonder eigen padding-instelling voor een
             formulierbesturing erin; deze twee eigenschappen houden de
             select op de rij en laten hem niet uitrekken */
          style: 'gap:16px;'
        }, [
          avatarMetFoto(c, { naam: naam, maat: 36, record: lid, veld: 'avatarUrl' }),
          ui.el('div', { class: 'u-row-main' }, [
            ui.el('span', { class: 'u-row-title', text: naam }),
            ui.el('span', { class: 'u-row-sub', text: str(lid.email) || 'Geen e-mailadres vastgelegd' })
          ]),
          ui.el('div', { class: 'u-row-end' }, [
            ui.statusDot({ toon: statusToon(lid.status), label: statusLabel(lid.status) }),
            sel
          ])
        ]));
      });
      vak.appendChild(ui.entityList(rijen, { leegTitel: 'Nog geen teamleden' }));
    }

    /* wat elke rol betekent — vier regels, letterlijk uit CP_DATA.ROLLEN */
    if (rollen.length) {
      var uitlegVak = ui.el('div', { style: 'margin-top:26px;' }, [
        ui.sectionHead({ titel: 'Wat de rollen betekenen' })
      ]);
      uitlegVak.appendChild(ui.metaGrid({
        cellen: rollen.map(function (r) {
          return { icoon: 'gebruiker', label: r.label, waarde: str(r.bedoeld), groot: true };
        })
      }));
      vak.appendChild(uitlegVak);
    }

    return vak;
  }

  /* ============================================================
     OMGEVING EN DATA — HET ENIGE VANGNET DAT ER IS

     Voor een eenmanszaak zonder serverback-up is dit geen luxeblok maar de
     hele verzekering. Er staan daarom vier dingen in, en alle vier roepen
     ze een bestaande uitvoerder in beheer.html aan:

       1. back-up downloaden      acties.backupDownloaden()
       2. back-up terugzetten     acties.backupHerstellen()  — MET de
                                  hersteltest per collectie
       3. Onlangs verwijderd      lijsten.trash + acties.itemTerugzetten()
       4. boekhouding-CSV         acties.boekhoudCsv(van, tot)

     WAT HIER STOND EN WAAROM HET WEG IS.
     Er stond één knop "Back-up terugzetten" die uitgeschakeld was met de
     mededeling dat de datalaag geen herstelweg kende. Dat was onwaar: de
     herstelweg bestond al compleet in beheer.html — bestandskiezer,
     inhoudsoverzicht per collectie, terugschrijven en daarna de hersteltest
     die de aantallen terugleest en vergelijkt. Alleen werd hij uitsluitend
     vanuit het oude instellingenscherm aangeroepen, en dat scherm wordt in
     de nieuwe indeling niet meer getekend. De knop is dus niet gerepareerd
     maar AANGESLOTEN.

     DE UITZONDERING UIT BESLISSING 2.7 GELDT ONVERKORT: alles in dit blok
     is een HANDELING en geen formulier, dus het loopt niet via de buffer en
     niet via de opslagbalk. De bewaartermijn zelf staat wél in het
     formulier hierboven, want dat is een waarde.
     ============================================================ */

  /* ---- 1 en 2: de back-up zelf -------------------------------------- */
  function backupSectie(c, L, meld) {
    var ui = c.ui;
    var settings = opt(L.settings);
    var modus = (c.db && fn(c.db.modus)) ? str(c.db.modus()) : '';
    var uitleg = (c.db && fn(c.db.backupUitleg)) ? str(c.db.backupUitleg()) : '';
    var laatste = str(settings.lastBackupAt);

    var downloaden = haak(c, 'backupDownloaden');
    var herstellen = haak(c, 'backupHerstellen');

    var laatsteRegel = ui.el('span', {
      style: 'font-size:15px;font-weight:500;color:var(--ink);',
      text: laatste
        ? (datumTekst(laatste, c.model) + (tijdTekst(laatste, c.model) ? ' om ' + tijdTekst(laatste, c.model) : ''))
        : 'Nog geen back-up gemaakt'
    });

    /* het vastleggen van het moment; ook los bruikbaar voor een back-up die
       je ergens anders hebt gemaakt (Supabase-dashboard, eigen kopie) */
    function legVast(moment, opGoed, opFout) {
      schrijf(c, 'backup', null, { at: moment }).then(function () {
        laatsteRegel.textContent = datumTekst(moment, c.model)
          + (tijdTekst(moment, c.model) ? ' om ' + tijdTekst(moment, c.model) : '');
        if (fn(opGoed)) opGoed();
      }, function (e) {
        if (fn(opFout)) opFout(e);
      });
    }

    var knoppen = ui.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' });

    /* --- DE PRIMAIRE ACTIE van deze categorie --- */
    if (downloaden) {
      var downloadKnop = ui.el('button', {
        type: 'button', class: 'u-btn klein', text: 'Download back-up (JSON)'
      });
      downloadKnop.addEventListener('click', function () {
        downloadKnop.disabled = true;
        var moment = str(c.nu) || new Date().toISOString();
        var uit;
        try { uit = downloaden(); }
        catch (e) { downloadKnop.disabled = false; meld('Back-up maken mislukt: ' + foutTekst(e)); return; }
        Promise.resolve(uit).then(function (gelukt) {
          downloadKnop.disabled = false;
          /* downloadBackupJson() meldt zijn eigen fout en geeft dan false
             terug; dan is er niets gedownload en mag hier geen datum bij */
          if (gelukt === false) return;
          /* EN METEEN VASTLEGGEN. Er is zojuist echt een back-up gemaakt,
             dus "Laatste back-up" op nu zetten is geen aanname maar een
             feit. De losse knop hiernaast blijft bestaan voor een back-up
             die buiten dit scherm om is gemaakt. */
          legVast(moment,
            function () { meld('Back-up gedownload en vastgelegd.'); },
            function (e) {
              meld('De back-up is gedownload, maar de datum kon niet worden vastgelegd: ' + foutTekst(e));
            });
        }, function (e) {
          downloadKnop.disabled = false;
          meld('Back-up maken mislukt: ' + foutTekst(e));
        });
      });
      knoppen.appendChild(downloadKnop);
    }

    if (herstellen) {
      var herstelKnop = ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', text: 'Herstel een back-up…'
      });
      herstelKnop.addEventListener('click', function () {
        /* GEEN eigen bevestiging en GEEN eigen succesmelding. De weg
           erachter opent een bestandskiezer, toont daarna zélf het
           inhoudsoverzicht per collectie met een bevestigknop, en meldt
           zelf het resultaat van de hersteltest. Hier een tweede
           bevestiging of een tweede "gelukt" neerzetten zou een tweede
           waarheid worden — en de eerste zou dan liegen op het moment dat
           iemand de bestandskiezer wegklikt. */
        try { herstellen(); }
        catch (e) { meld('Terugzetten kon niet worden gestart: ' + foutTekst(e)); }
      });
      knoppen.appendChild(herstelKnop);
    }

    var markeerKnop = ui.el('button', {
      type: 'button', class: 'u-btn ghost klein',
      text: 'Back-up elders gemaakt — leg vast'
    });
    markeerKnop.addEventListener('click', function () {
      markeerKnop.disabled = true;
      var moment = str(c.nu) || new Date().toISOString();
      legVast(moment,
        function () { markeerKnop.disabled = false; meld('Vastgelegd dat er zojuist een back-up is gemaakt.'); },
        function (e) { markeerKnop.disabled = false; meld('Vastleggen mislukt: ' + foutTekst(e)); });
    });
    knoppen.appendChild(markeerKnop);

    var vak = ui.el('div', null, [
      ui.sectionHead({ titel: 'Back-up en opslag' }),
      uitleg ? ui.el('p', { class: 'u-lees', style: 'max-width:66ch;margin:0 0 14px;', text: uitleg }) : null,
      ui.el('p', {
        class: 'u-lees', style: 'max-width:66ch;margin:0 0 14px;',
        text: 'De export is de complete datastore als gedateerd JSON-bestand. Terugzetten leest zo’n bestand in, '
          + 'laat je eerst per collectie zien wat erin zit, en controleert na het terugschrijven of elke '
          + 'collectie het verwachte aantal rijen heeft — zo weet je dat de back-up echt terugzetbaar is.'
      }),
      /* DE EERLIJKHEIDSALINEA OVER BESTANDEN. Hij stond in het oude scherm
         en moet mee: zonder deze regel denkt iemand dat de JSON zijn foto's
         bevat, en dat is precies de aanname die pas fout blijkt op het
         moment dat het ertoe doet. */
      ui.el('p', {
        class: 'u-sub', style: 'margin:0 0 18px;max-width:66ch;',
        text: 'Eerlijk over bestanden: geüploade foto’s en documenten staan in de opslag van déze browser '
          + '(IndexedDB). De JSON-back-up bevat de metadata, niet de bestanden zelf. In een andere browser toont '
          + 'het portaal daarvoor een nette melding “bestand niet beschikbaar”.'
      }),
      ui.el('div', {
        style: 'display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:18px;'
      }, [
        ui.el('span', { class: 'u-sub', text: 'Laatste back-up' }),
        laatsteRegel
      ]),
      knoppen
    ]);

    if (!downloaden || !herstellen) {
      vak.appendChild(ui.el('p', {
        class: 'u-sub', style: 'margin:16px 0 0;max-width:66ch;',
        text: (!downloaden && !herstellen)
          ? 'Downloaden en terugzetten lopen via het beheerscherm en zijn aan deze weergave niet doorgegeven. '
            + 'Wat deze pagina wél kan is vastleggen wanneer je een back-up hebt gemaakt.'
          : (!downloaden
            ? 'Downloaden loopt via het beheerscherm en is aan deze weergave niet doorgegeven.'
            : 'Terugzetten loopt via het beheerscherm en is aan deze weergave niet doorgegeven.')
      }));
    }

    vak.appendChild(ui.el('p', {
      class: 'u-sub', style: 'margin:16px 0 0;max-width:66ch;',
      text: modus === 'supa'
        ? 'Je gegevens staan in je Supabase-project. Het bestand hierboven is jouw eigen kopie; het terugzetten '
          + 'schrijft in de demo-opslag van deze browser en raakt je Supabase-project niet aan. Herstellen dáár '
          + 'gebeurt in het Supabase-dashboard.'
        : 'In demomodus staan je gegevens in de opslag van deze browser. Deze JSON is dus je enige kopie: wis je '
          + 'de browsergegevens zonder back-up, dan is het weg.'
    }));

    return vak;
  }

  /* ---- 3: Onlangs verwijderd ---------------------------------------
     Het tweede vangnet naast de ongedaan-maken-melding van vijftien
     seconden, en bewust NIET samengevoegd met de back-up: een verwijderd
     document terughalen is iets anders dan een hele datastore terugzetten.

     DE BEWAARTERMIJN KOMT UIT DE INSTELLING en niet uit een hardgecodeerde
     zeven. Zolang CP_DATA.BEWAARTERMIJN_AFGEDWONGEN false is, staat de
     regel van CP_DATA erbij die zegt dat het opruimen die instelling nog
     niet vólgt — een instelling die niets stuurt en dat niet zegt, is erger
     dan geen instelling. */
  function prullenbakSectie(c, L, meld, vuil) {
    var ui = c.ui;
    var settings = opt(L.settings);
    var rijenBron = arr(L.trash);
    var terugzetten = haak(c, 'itemTerugzetten');

    var standaard = (c.db && typeof c.db.BEWAARTERMIJN_DEFAULT === 'number') ? c.db.BEWAARTERMIJN_DEFAULT : 7;
    var termijn = Math.round(getalOf(settings.retentionDays, standaard));
    var afgedwongen = !(c.db && c.db.BEWAARTERMIJN_AFGEDWONGEN === false);

    function soortWoord(t) {
      if (str(t.kind) === 'media') return 'Foto';
      if (str(t.kind) === 'document') return 'Document';
      return str(t.kind) || 'Item';
    }
    function titelVan(t) {
      var pl = opt(t.payload);
      if (str(t.kind) === 'media') return str(opt(pl.media).caption) || 'Foto zonder onderschrift';
      if (str(t.kind) === 'document') return str(opt(pl.document).title) || 'Document zonder titel';
      return soortWoord(t);
    }

    var vak = ui.el('div', { style: 'margin-top:30px;' }, [
      sectiekop(ui, { titel: 'Onlangs verwijderd', telling: rijenBron.length })
    ]);
    vak.appendChild(uitlegP(ui, 'Verwijderde foto’s en documenten blijven ' + nlAantal(termijn, 'dag', 'dagen')
      + ' staan en zijn tot dan terug te halen. Daarna zijn ze definitief weg, inclusief het bestand zelf.'));

    if (!rijenBron.length) {
      vak.appendChild(ui.emptyTile({
        icoon: 'bestand',
        titel: 'Er staat niets in de prullenbak',
        uitleg: 'Niets verwijderd in de afgelopen ' + nlAantal(termijn, 'dag', 'dagen') + '.'
      }));
    } else {
      var rijen = [];
      rijenBron.forEach(function (t) {
        if (!isObj(t)) return;
        var stand = (c.db && fn(c.db.retentionStatus))
          ? c.db.retentionStatus(t.deletedAt, termijn, c.nu)
          : null;

        var wanneer = datumTekst(t.deletedAt, c.model);
        var sub = wanneer
          ? ('Verwijderd ' + wanneer + (tijdTekst(t.deletedAt, c.model) ? ' om ' + tijdTekst(t.deletedAt, c.model) : ''))
          : 'Verwijderd op een onbekend moment';

        /* de meta-regel zegt hoeveel tijd er nog is. Zonder
           CP_DATA.retentionStatus wordt er niets geteld en staat er ook
           niets — een verzonnen aantal dagen is hier het gevaarlijkst. */
        var metaTekst = '';
        var kanTerug = true;
        if (stand) {
          kanTerug = !!stand.terugTeHalen;
          if (stand.onbekend) metaTekst = 'verwijderdatum onbekend';
          else if (stand.terugTeHalen) metaTekst = 'nog ' + nlAantal(stand.dagenOver, 'dag', 'dagen');
          else metaTekst = 'bewaartermijn verstreken';
        }

        var reden = null;
        if (!terugzetten) reden = 'Terugzetten loopt via het beheerscherm en is hier niet doorgegeven.';
        else if (!kanTerug) reden = 'De bewaartermijn is verstreken; dit item wordt bij de eerstvolgende opruiming definitief verwijderd.';

        rijen.push(ui.entityRow({
          thumb: false,
          titel: titelVan(t),
          sub: sub,
          chips: [{ label: soortWoord(t), toon: 'neutraal' }],
          meta: metaTekst,
          menu: [{
            label: 'Zet terug',
            ico: 'terug',
            uit: !!reden,
            hint: reden ? 'kan niet' : null,
            onKies: function () {
              /* TERUGZETTEN TEKENT DEZE PAGINA OPNIEUW (de haak eindigt in
                 de vaste afsluiter: opslaan, verversen). Staat er nog
                 onopgeslagen werk in het formulier hierboven, dan zou dat
                 stil verdwijnen — precies het gat dat het nieuwe
                 opslagmodel juist dicht. Dus eerst zeggen, dan niets doen. */
              if (fn(vuil) && vuil()) {
                meld('Sla eerst je wijzigingen op of herstel ze — terugzetten tekent deze pagina opnieuw.');
                return;
              }
              var uit;
              try { uit = terugzetten(t); }
              catch (e) { meld('Terugzetten mislukt: ' + foutTekst(e)); return; }
              Promise.resolve(uit).then(function () {
                meld(soortWoord(t) + ' teruggezet.');
              }, function (e) {
                meld('Terugzetten mislukt: ' + foutTekst(e));
              });
            }
          }]
        }));
      });
      vak.appendChild(ui.entityList(rijen, { leegTitel: 'Er staat niets in de prullenbak' }));
    }

    if (!afgedwongen && c.db && str(c.db.BEWAARTERMIJN_UITLEG)) {
      vak.appendChild(ui.el('p', {
        class: 'u-sub', style: 'margin:14px 0 0;max-width:66ch;',
        text: str(c.db.BEWAARTERMIJN_UITLEG)
      }));
    }

    return vak;
  }

  /* ---- 4: boekhouding-CSV -------------------------------------------
     Contextueel gedupliceerd met Financiën, maar met ÉÉN bouwfunctie
     erachter: exporteerBoekhoudCsv() in beheer.html. Er wordt hier geen
     tweede CSV samengesteld. */
  function csvSectie(c, meld) {
    var ui = c.ui;
    var csv = haak(c, 'boekhoudCsv');
    if (!csv) return null;

    /* de periode: dit jaar tot vandaag, gelezen uit het tijdstip dat de
       gastheer meegaf. Zonder dat tijdstip blijven de velden leeg — dan
       gaan gewoon alle facturen mee, en dat zegt de regel eronder ook. */
    var nuDelen = datumDelen(c.nu, c.model);
    var vanWaarde = nuDelen ? (nuDelen.jaar + '-01-01') : '';
    var totWaarde = nuDelen ? (nuDelen.jaar + '-' + pad2(nuDelen.maand) + '-' + pad2(nuDelen.dag)) : '';

    var vanIn = ui.el('input', { class: 'input', type: 'date', style: 'max-width:180px;', 'aria-label': 'Periode van' });
    vanIn.value = vanWaarde;
    var totIn = ui.el('input', { class: 'input', type: 'date', style: 'max-width:180px;', 'aria-label': 'Periode tot en met' });
    totIn.value = totWaarde;

    var uitkomst = ui.el('span', { class: 'u-kicker', 'aria-live': 'polite' });
    var knop = ui.el('button', { type: 'button', class: 'u-btn ghost klein', text: 'Download boekhouding-CSV' });
    knop.addEventListener('click', function () {
      knop.disabled = true;
      uitkomst.textContent = '';
      var uit;
      try { uit = csv(vanIn.value, totIn.value); }
      catch (e) { knop.disabled = false; meld('Exporteren mislukt: ' + foutTekst(e)); return; }
      Promise.resolve(uit).then(function (n) {
        knop.disabled = false;
        var aantal = getalOf(n, 0);
        /* NUL IS EEN UITKOMST EN GEEN FOUT: in deze periode staan geen
           facturen. Dat hoort er te staan, want anders lijkt de knop stuk. */
        uitkomst.textContent = aantal
          ? (nlAantal(aantal, 'factuur geëxporteerd', 'facturen geëxporteerd') + '.')
          : 'Geen facturen in deze periode.';
      }, function (e) {
        knop.disabled = false;
        meld('Exporteren mislukt: ' + foutTekst(e));
      });
    });

    return ui.el('div', { style: 'margin-top:30px;' }, [
      ui.sectionHead({ titel: 'Boekhouding-CSV' }),
      uitlegP(ui, 'Klant, project, factuurnummer, bedrag, btw, status en datums — puntkomma-gescheiden, '
        + 'leesbaar voor elk boekhoudpakket. Laat je de periode leeg, dan gaan alle facturen mee. Dezelfde '
        + 'export staat ook boven de facturenlijst van een project.'),
      formRij(ui, [
        veldVak(ui, 'Van', vanIn),
        veldVak(ui, 'Tot en met', totIn)
      ]),
      ui.el('div', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;' }, [knop, uitkomst])
    ]);
  }

  /* ---- de ingang naar de go-live-checklist --------------------------
     De mappingtabel zet de checklist op TWEE plekken: onder Integraties (de
     wizard zelf, met de vinkjes en de controles) en hier, want "waar staat
     mijn spul en is het klaar voor live" is dezelfde vraag. Dit is bewust
     alleen een doorlink plus het bestaande omgevingsvenster — geen tweede
     checklist. De link draagt ?focus=golive, dezelfde parameter als de
     Demo-badge, zodat hij op de wizard landt en niet bovenaan de pagina. */
  function goLiveIngang(c) {
    var ui = c.ui;
    var route = routeNaar(c.model, { area: 'instellingen', tab: 'integraties', params: { focus: 'golive' } },
      '#/instellingen/integraties?focus=golive');
    var controleren = haak(c, 'goLiveControleren');
    if (!c.ga && !controleren) return null;

    var knoppen = ui.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' });
    if (c.ga) {
      knoppen.appendChild(ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', text: 'Open de go-live-checklist',
        onclick: function () { c.ga(route); }
      }));
    }
    if (controleren) {
      knoppen.appendChild(ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', text: 'Toon de omgevingsstatus',
        /* ZONDER meld: dan opent de haak het bestaande omgevingsvenster van
           het beheer, met de statuscontrole en de deeplink naar de
           checklist erin. Met meld zou hij hier rijen willen schrijven die
           op deze pagina niet staan. */
        onclick: function () { controleren(); }
      }));
    }

    return ui.el('div', { style: 'margin-top:30px;' }, [
      ui.sectionHead({ titel: 'Klaar voor live' }),
      uitlegP(ui, 'De ' + GO_LIVE_STAPPEN.length + ' stappen naar een echte omgeving staan als wizard onder Integraties: '
        + 'per stap wat je doet, waar, en of het beheer het zelf kan controleren of dat jij afvinkt.'),
      knoppen
    ]);
  }

  function omgevingBlok(c, L, meld, vuil) {
    var ui = c.ui;
    return ui.el('div', { style: 'margin-top:26px;' }, [
      backupSectie(c, L, meld),
      prullenbakSectie(c, L, meld, vuil),
      csvSectie(c, meld),
      goLiveIngang(c)
    ]);
  }

  /* Nummerreeksen: de extra reeksen en de verklaringen bij gaten. Allebei
     tellend en eerlijk over wat deze pagina wel en niet kan. */
  function nummerBlok(c, L) {
    var ui = c.ui;
    var settings = opt(L.settings);
    var reeksen = arr(settings.factuurReeksen);
    var verklaringen = sleutelsVan(settings.nummerVerklaringen);

    var vak = ui.el('div', { style: 'margin-top:26px;' });

    /* DE UITGEBREIDE UITLEG ACHTER EEN UITKLAP — zo staat het in fase 9 van
       het migratieplan. Het is de langste uitleg van alle negen categorieën
       en hij hoort niet boven de twee velden te hangen die je komt zetten.
       <details> is een echte uitklap: hij werkt zonder JavaScript, is met
       het toetsenbord te bedienen en meldt zijn open/dicht-stand zelf. */
    var uitklap = ui.el('details', { style: 'margin-bottom:22px;' }, [
      ui.el('summary', {
        style: 'cursor:pointer;font-size:15px;font-weight:500;color:var(--ink);',
        text: 'Hoe de nummering werkt'
      }),
      ui.el('p', {
        class: 'u-lees', style: 'margin:12px 0 0;max-width:66ch;',
        text: 'Een conceptfactuur is nummerloos. Het nummer wordt pas uitgegeven op het moment dat je de factuur '
          + 'definitief maakt, en dat gebeurt in één ondeelbare stap — zo kunnen twee tabbladen nooit hetzelfde '
          + 'nummer krijgen.'
      }),
      ui.el('p', {
        class: 'u-lees', style: 'margin:10px 0 0;max-width:66ch;',
        text: 'Daarom trekt een fase die je terugdraait ook nooit een nummer uit de reeks: er was nog geen nummer. '
          + 'Het voorvoegsel en het startnummer hierboven bepalen hoe het volgende nummer eruitziet.'
      }),
      ui.el('p', {
        class: 'u-lees', style: 'margin:10px 0 0;max-width:66ch;',
        text: 'Ontbreekt er toch een nummer in de reeks — bijvoorbeeld na een annulering — dan vraagt de '
          + 'nummeringswaakhond in Financiën om een verklaring. Die verklaring wordt op dat moment vastgelegd, '
          + 'want twee jaar later weet niemand het antwoord nog.'
      })
    ]);
    vak.appendChild(uitklap);

    vak.appendChild(sectiekop(ui, { titel: 'Extra reeksen', telling: reeksen.length }));

    if (!reeksen.length) {
      vak.appendChild(ui.emptyTile({
        icoon: 'bestand',
        titel: 'Eén reeks, en dat is genoeg',
        uitleg: 'Er is alleen de hoofdreeks hierboven. Extra reeksen ontstaan pas zodra je met meer dan één '
          + 'administratie of documentsoort werkt.'
      }));
    } else {
      var rijen = reeksen.map(function (r) {
        var o = opt(r);
        return ui.entityRow({
          thumb: false,
          titel: str(o.naam || o.label || o.key) || 'Naamloze reeks',
          sub: [str(o.prefix), o.jaar ? String(o.jaar) : ''].filter(function (s) { return !!s; }).join(' · '),
          meta: (o.volgende !== undefined && o.volgende !== null) ? ('volgende ' + o.volgende) : 'stand onbekend'
        });
      });
      vak.appendChild(ui.entityList(rijen));
    }

    /* DE EERLIJKHEIDSTEKST OVER DE NUMMERSTAND, en hij staat er ALTIJD —
       ook zonder extra reeksen, want de regel gaat over het nummeren zelf
       en niet over deze lijst. Hij stond in het oude scherm bij de
       reekskaart en is precies de zin die bij het herindelen dreigde weg te
       vallen: je kunt het voorvoegsel en het STARTnummer zetten, maar niet
       de stand van de teller. Kon dat wel, dan zou een openstaand tabblad
       een al uitgegeven nummer een tweede keer kunnen laten vallen. */
    vak.appendChild(ui.el('p', {
      class: 'u-sub', style: 'margin:12px 0 0;max-width:66ch;',
      text: 'Het laatst uitgegeven volgnummer — de stand van de teller — is nergens in dit beheer bewerkbaar. Die '
        + 'hoort bij de uitgifte zelf: hij wordt opgehoogd op het moment dat een factuur definitief wordt gemaakt. '
        + 'Wil je vooruitspringen, verhoog dan het startnummer hierboven; dat geldt meteen en laat het verleden met rust.'
    }));

    vak.appendChild(ui.el('div', { style: 'margin-top:26px;' }, [
      sectiekop(ui, { titel: 'Verklaringen bij ontbrekende nummers', telling: verklaringen.length }),
      ui.el('p', {
        class: 'u-lees', style: 'max-width:66ch;margin:0;',
        text: verklaringen.length
          ? ('Er staan ' + nlAantal(verklaringen.length, 'verklaring', 'verklaringen') + ' vast. Zolang een gat in de '
            + 'nummering geen verklaring heeft, blijft de waarschuwing in Financiën staan.')
          : 'Er zijn geen gaten in de nummering die om een verklaring vragen.'
      })
    ]));

    return vak;
  }

  /* ---- het scherm ---------------------------------------------------- */

  function instellingCategorie(ctx) {
    var c = context(ctx);
    if (!c.ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen; deze instellingenpagina kan niet worden getekend.');
    var ui = c.ui;
    var L = c.L;
    var settings = opt(L.settings);

    var sleutel = tabUit(c.model, c.route, '');
    var cat = categorieVan(sleutel);
    var terugRoute = routeNaar(c.model, { area: 'instellingen' }, '#/instellingen');

    var wortel = ui.el('div');

    /* een categorie die niet bestaat is geen fout van de gebruiker maar een
       verkeerd adres; hij landt met uitleg terug op het overzicht */
    if (!cat) {
      wortel.appendChild(ui.pageHeader({
        crumbs: [{ label: 'Instellingen', route: terugRoute }, { label: 'Onbekende categorie' }],
        titel: 'Onbekende categorie'
      }));
      wortel.appendChild(ui.emptyState({
        titel: 'Deze instellingencategorie bestaat niet',
        uitleg: sleutel
          ? ('Het adres wijst naar “' + sleutel + '”, en die categorie kent het beheer niet.')
          : 'Er staat geen categorie in het adres.',
        actie: c.ga ? { label: 'Terug naar Instellingen', onClick: function () { c.ga(terugRoute); } } : null
      }));
      return wortel;
    }

    /* --- de buffer en de opslagbalk --- */
    var buf = maakBuffer(settings);
    var teamBuf = { rollen: {}, vuil: false };
    var balk = null;

    function vuil() { return buf.isVuil() || teamBuf.vuil; }

    function meld(tekst) {
      if (fn(ui.toast)) ui.toast(str(tekst));
    }

    function markeerVuil() {
      if (balk) balk.zetDirty(vuil());
    }

    /* ALLE SCHRIJFACTIES VAN DE OPSLAGKNOP OP EEN RIJ. Per sleutel één
       opdracht, en de drie sleutels die een eigen bewaker hebben in CP_DATA
       gaan langs hun eigen soort — die controleert het bereik en normaliseert
       zeven weekdagen, en dat willen we niet in dit scherm nabouwen. */
    function opdrachten() {
      var uit = [];
      buf.vuileSleutels().forEach(function (k) {
        var waarde = buf.waarde(k);
        if (k === 'capacityPerWeekday') { uit.push(['capaciteit', null, waarde]); return; }
        if (k === 'retentionDays') { uit.push(['bewaartermijn', null, waarde]); return; }
        uit.push(['instelling', k, waarde]);
      });
      sleutelsVan(teamBuf.rollen).forEach(function (id) {
        uit.push(['teamlid', id, { rol: teamBuf.rollen[id] }]);
      });
      return uit;
    }

    function slaOp() {
      var lijst = opdrachten();
      if (!lijst.length) return;
      if (balk) balk.zetBezig(true);

      /* één voor één, en bij de eerste fout stoppen. Doorschrijven na een
         fout zou een half opgeslagen formulier opleveren waarvan niemand
         weet welke helft het is. */
      var i = 0;
      function volgende() {
        if (i >= lijst.length) {
          if (balk) { balk.zetBezig(false); balk.zetDirty(false); }
          buf.schoon();
          teamBuf.rollen = {};
          teamBuf.vuil = false;
          meld('Wijzigingen opgeslagen.');
          if (c.ververs) c.ververs();
          return;
        }
        var o = lijst[i];
        i += 1;
        schrijf(c, o[0], o[1], o[2]).then(volgende, function (e) {
          if (balk) balk.zetBezig(false);
          meld('Opslaan mislukt bij “' + str(o[1] || o[0]) + '”: ' + foutTekst(e));
        });
      }
      volgende();
    }

    function herstel() {
      buf.schoon();
      teamBuf.rollen = {};
      teamBuf.vuil = false;
      if (balk) balk.zetDirty(false);
      meld('Wijzigingen teruggedraaid.');
      /* opnieuw tekenen is hier de enige eerlijke weg: de velden staan vol
         met wat je zojuist typte en moeten terug naar de opgeslagen stand */
      if (c.ververs) c.ververs();
    }

    /* --- kop --- */
    wortel.appendChild(ui.pageHeader({
      crumbs: [{ label: 'Instellingen', route: terugRoute }, { label: cat.label }],
      titel: cat.label
    }));
    wortel.appendChild(ui.el('p', {
      class: 'u-lees',
      style: 'max-width:70ch;margin:0 0 30px;',
      text: str(cat.subtitel)
    }));

    var hoofd = ui.el('div', { class: 'u-cols-main' });
    var rail = ui.el('div', { class: 'u-cols-side' });

    var railBlokken = categorieRail(c, cat, buf, settings);

    /* blokken die met het formulier moeten meelezen. De rail van
       Bedrijfsprofiel zat hier al in; de mod-97-regel onder de IBAN komt er
       met dezelfde haak bij, zodat er niet twee wegen ontstaan om "teken
       jezelf opnieuw" te zeggen. */
    var meelezers = [];
    function naVeldwijziging() {
      markeerVuil();
      if (fn(railBlokken.hertekenen)) railBlokken.hertekenen();
      meelezers.forEach(function (f) { f(); });
    }

    /* --- het formulier --- */
    var formulier = ui.el('div', { class: 'u-card', style: 'padding:26px 26px 12px;' });
    if (arr(cat.velden).length) {
      formulier.appendChild(tekenVelden(c, buf, cat.velden, naVeldwijziging));
    }

    /* de eerlijke regel bij de twee nieuwe adresvelden van Bedrijfsprofiel:
       ze zijn er nu wél, maar de factuur en de dossier-export drukken
       vandaag alleen de straatregel af */
    if (cat.key === 'bedrijfsprofiel') {
      formulier.appendChild(ui.el('p', {
        class: 'u-sub', style: 'margin:-4px 0 18px;max-width:66ch;',
        text: 'Straat en huisnummer staan al op de factuur en in de dossier-export. Postcode en plaats zijn nieuwe '
          + 'velden en worden daar nog niet meegedrukt.'
      }));
    }
    if (cat.key === 'facturatie') {
      var betaal = betaalBlok(c, buf);
      formulier.appendChild(betaal.el);
      meelezers.push(betaal.teken);
    }
    if (cat.key === 'projectstandaarden') {
      formulier.appendChild(faseBlok(c, buf, L, naVeldwijziging));
    }
    if (cat.key === 'automatiseringen') {
      /* "Laatst verstuurd" van de ochtendmail: een feit uit de opslag, geen
         instelling. Het stond in het oude scherm onder het vinkje en hoort
         daar nog steeds — zonder die regel weet je niet of de mail ooit
         echt is vertrokken. */
      var laatstOchtend = str(opt(settings.ochtendmail).laatst);
      if (laatstOchtend) {
        formulier.appendChild(ui.el('p', {
          class: 'u-sub', style: 'margin:-4px 0 18px;max-width:66ch;',
          text: 'Ochtendmail laatst verstuurd: ' + datumTekst(laatstOchtend, c.model)
            + (tijdTekst(laatstOchtend, c.model) ? ' om ' + tijdTekst(laatstOchtend, c.model) : '') + '.'
        }));
      }
      formulier.appendChild(capaciteitBlok(c, buf, naVeldwijziging));
    }
    if (cat.key === 'email') {
      formulier.appendChild(mailBlok(c, buf, L, naVeldwijziging));
    }
    if (cat.key === 'nummerreeksen') {
      formulier.appendChild(nummerBlok(c, L));
    }
    var goLiveVak = null;
    if (cat.key === 'integraties') {
      goLiveVak = goLiveBlok(c, L, meld);
      formulier.appendChild(goLiveVak);
    }
    if (cat.key === 'team') {
      formulier.appendChild(teamBlok(c, L, teamBuf, naVeldwijziging));
    }
    if (cat.key === 'omgeving') {
      /* `vuil` gaat mee omdat één handeling in dat blok — een item uit de
         prullenbak terugzetten — de pagina opnieuw laat tekenen. Zonder die
         wetenschap zou dat onopgeslagen werk in het formulier hierboven
         stil weggooien. */
      formulier.appendChild(omgevingBlok(c, L, meld, vuil));
    }

    /* de eerlijkheidsteksten die bij een categorie horen en niet bij één
       veld: ze staan onderaan het formulier, na de velden waar ze over gaan */
    arr(cat.noot).forEach(function (regel) {
      formulier.appendChild(ui.el('p', {
        class: 'u-sub', style: 'margin:18px 0 0;max-width:66ch;', text: str(regel)
      }));
    });

    hoofd.appendChild(formulier);
    rail.appendChild(ui.el('div', { class: 'u-sticky' }, railBlokken));
    wortel.appendChild(ui.el('div', { class: 'u-cols' }, [hoofd, rail]));

    /* --- de zwevende opslagbalk (spec 4.18) --- */
    balk = ui.saveBar({
      dirty: false,
      opHerstel: herstel,
      opOpslaan: slaOp
    });
    wortel.appendChild(balk.el);

    /* --- de navigatiewaarschuwing ---
       De shell leegt zijn guardlijst vlak vóór elke tekening, dus een scherm
       meldt zich elke keer opnieuw aan. Zonder shell doet dit niets en gaat
       een navigatie gewoon door — vervelend, maar beter dan een scherm dat
       op een ontbrekende haak stukloopt. */
    if (c.guard) {
      c.guard(function () {
        planOpruiming();
        if (!vuil()) return null;
        return 'Je hebt onopgeslagen wijzigingen in ' + cat.label + '. Weglopen gooit ze weg.';
      });
    }

    /* De opslagbalk houdt op smalle schermen de onderrand van de werkkolom
       vrij en moet die ruimte teruggeven zodra dit scherm verdwijnt. Het
       ctx-contract kent daar geen haak voor, dus we doen het op twee
       manieren: de shell mág wortel.stop() aanroepen, en anders merkt het
       scherm zelf dat het losgekoppeld is zodra de guard langs is gekomen. */
    function losgekoppeld() {
      if (!wortel.parentNode) return true;
      var d = wortel.ownerDocument;
      if (d && d.body && d.body.contains) return !d.body.contains(wortel);
      return false;
    }
    function planOpruiming() {
      var g = G();
      if (!g || !fn(g.setTimeout)) return;
      g.setTimeout(function () { if (losgekoppeld() && balk) balk.stop(); }, 0);
      g.setTimeout(function () { if (losgekoppeld() && balk) balk.stop(); }, 600);
    }
    wortel.stop = function () { if (balk) balk.stop(); };

    /* ---- DE LANDING VAN DE GO-LIVE-DEEPLINK ----------------------------
       CP_MODEL.legacyViewToRoute zet ?focus=golive op de route zodra de knop
       "Go-live-checklist" achter de Demo-badge wordt ingedrukt. Dit is de
       tegenhanger daarvan: aankomen op de juiste pagina is nog niet aankomen
       bij de checklist — die staat onder het formulier van Integraties, en
       zonder deze regels begint de bezoeker bovenaan bij een pagina die
       verder over iets anders gaat.

       Twee dingen tegelijk, en ze vullen elkaar aan: in beeld brengen (voor
       wie kijkt) en de focus verzetten (voor wie met het toetsenbord of een
       schermlezer werkt). Het oude renderSettings deed alleen het eerste.

       In een setTimeout, want op dit moment hangt `wortel` nog nergens: de
       shell plaatst hem pas ná deze functie. Focussen op een losse knoop
       doet niets, en scrollen evenmin. */
    var focusWens = paramUit(opt(c.route).params, ['focus']);
    if (goLiveVak && focusWens === 'golive') {
      var g = G();
      if (g && fn(g.setTimeout)) {
        g.setTimeout(function () {
          if (!goLiveVak.parentNode) return;
          /* EERST focussen, DAARNA rollen. Andersom springt de pagina er
             hard heen: focus() rolt namelijk zelf ook, en die sprong
             overschrijft de zachte beweging die er net was ingezet.
             preventScroll wordt door een oudere browser genegeerd — dan is
             het resultaat de harde sprong, en dat is nog altijd de juiste
             plek. */
          if (fn(goLiveVak.focus)) {
            try { goLiveVak.focus({ preventScroll: true }); }
            catch (e) { goLiveVak.focus(); }
          }
          if (fn(goLiveVak.scrollIntoView)) {
            /* dezelfde afweging als het oude scherm maakte: wie beweging
               heeft uitgezet, springt er zonder animatie heen */
            var rustig = !!(g.matchMedia && g.matchMedia('(prefers-reduced-motion: reduce)').matches);
            goLiveVak.scrollIntoView({ behavior: rustig ? 'auto' : 'smooth', block: 'start' });
          }
        }, 0);
      }
    }

    return wortel;
  }

  /* ============================================================
     5. EXPORT — deze lijst en het kopblok houden elkaar bij
     ============================================================ */

  return {
    VERSION: VERSION,

    activiteit: activiteit,
    instellingen: instellingen,
    instellingCategorie: instellingCategorie,

    /* de categorie-indeling naar buiten, zodat de zijbalk, de zoekbalk en
       een test dezelfde negen namen en dezelfde routes gebruiken als deze
       twee schermen — een tweede lijst is een gegarandeerd verschil */
    CATEGORIEEN: CATEGORIEEN
  };
});
