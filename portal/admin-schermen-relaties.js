/* CUSTOM+ — drie schermen van de nieuwe beheerindeling.
   ------------------------------------------------------------------
   WAT HIER IN STAAT

     CP_SCHERMEN.relaties    hoofdstuk 5.5 van de mockupspec — tab Klanten,
                             met het klantdetail in de rail en, zodra de
                             route een id draagt, het KLANTDOSSIER met zes
                             tabs (Overzicht, Projecten, Facturen,
                             Communicatie, Activiteit, Details) waarin de
                             veertien blokken uit de mappingtabel van het
                             migratieplan terugkomen, elk met hun bestaande
                             bewerkactie. Elke klantRIJ draagt bovendien zijn
                             eigen •••, waarin de uitzonderingsrij van de
                             slapende klant (Check-in-mail) is opgegaan; de
                             tab Communicatie draagt de contactpersonenlijst
                             met per rij de mailcategorieën en een ••• met
                             bewerken en verwijderen — die lijst is gebouwd
                             en wacht op zijn gegevens: iaLaadLijsten() in
                             beheer.html levert de contactpersonen vandaag
                             onder geen enkele naam mee, en tot die tijd
                             zegt de tab dat met zoveel woorden in plaats
                             van een lege lijst te tonen. Zie contactBron().
     CP_SCHERMEN.fabrieken   hoofdstuk 5.6 — tab Fabrieken, met de kaart, de
                             fabriekskaarten, het aanmaken van een nieuwe
                             fabriek en het BEWERKBARE fabrieksdossier: de
                             stadskeuze die de kaartpin in het klantportaal
                             voedt, de specialisaties, de twee scores, de
                             contactpersoon en de interne notities, met de
                             zwevende opslagbalk en de navigatiewaarschuwing.
     CP_SCHERMEN.financien   hoofdstuk 5.7 — cashflow, en als EERSTE KEUZE
                             twee standen (voorstel 9): TE DOEN (open, te
                             laat, deels betaald, concept, betwist, en elke
                             factuur waarop de klant een betaling meldde die
                             nog niet bevestigd is) en ARCHIEF (betaald,
                             gecrediteerd, geannuleerd). De vier soorttabs
                             met tellingen en de OUDERDOMSTRAP
                             (30+/15-30/8-14/0-7) bestaan nog, één klik
                             dieper achter de knop Filters. Factuurrijen met
                             een primaire actie die uit de STATUSVERTALER
                             komt (betaald markeren) plus herinneren, PDF,
                             annuleren en de editor in het •••; een gemelde
                             klantbetaling staat als voorstel ónder de rij
                             met de knop Bevestig (0021). Verder het
                             factuurritme, de eerstvolgende verwachte
                             betaling en de doorlink naar de nummerreeksen
                             (waar de nummeringswaakhond en de nummer-audit
                             wonen).

   .claude/beheer-ui-mockup-spec.md is de enige waarheid over het uiterlijk,
   .claude/beheer-migratieplan.md over het gedrag. Waar dit bestand van de
   mockup afwijkt staat dat er met zoveel woorden bij, met de reden.

   ZEVEN AFSPRAKEN DIE DE REST VERKLAREN

   1. NIETS WORDT HIER GETEKEND WAT AL BESTAAT. Elke kaart, rij, chip, stip,
      tegel en grafiek komt uit CP_UI (portal/admin-ui.js) of CP_CHART
      (portal/admin-charts.js). Dit bestand SCHIKT die uitkomsten, het maakt
      geen tweede versie ervan. De handvol plekken waar CP_UI geen functie
      heeft maar portal/admin-ui.css wél een klasse (.u-factorycard,
      .u-invoicerow, de grote klantkaart op .u-hero) worden met CP_UI.el en
      díé klassen samengesteld — nooit met een eigen maat of een eigen kleur.
      Ze staan alle drie in het opleverrapport genoteerd.

   2. GEEN GETAL ZONDER BRON. Elk cijfer op het scherm komt uit een lijst uit
      ctx.data of uit een afgeleide functie van CP_DATA of CP_MODEL, en bij
      elke afleiding staat de bron in commentaar. Ontbreekt een waarde, dan
      komt er een eerlijke lege stand — nooit een nul die op een meting lijkt.

   3. GEEN MODULE-STATE. Er staat hieronder geen enkele variabele buiten een
      functie behalve constante tabellen. Selectie, tabkeuze, filter en het
      open staan van het formulier "Nieuwe fabriek" komen alle vier UIT DE
      ROUTE. Dat is precies waarom de router bestaat: een tweede aanroep van
      hetzelfde scherm met dezelfde route levert exact hetzelfde element op.

   4. DE VIER BIBLIOTHEKEN WORDEN TOLERANT OPGEHAALD. Het schermcontract
      noemt `ctx.data` twee keer — één keer als de al opgehaalde lijsten en
      één keer als de datalaag CP_DATA. bibliotheken() en lijsten() hieronder
      houden die twee uit elkaar door te KIJKEN wat er in zit, en vallen
      anders terug op de globale. Zo werkt dit bestand met beide lezingen van
      het contract en klapt het op geen van beide.

   5. TOEGANKELIJKHEID GAAT VOOR EEN PIXEL (hoofdstuk 8 van de spec). Elke
      grafiek komt uit CP_CHART en draagt daarmee zijn eigen role="img",
      <title> en aria-label met de echte waarden. Elke statusstip komt uit
      CP_UI.statusDot en heeft dus altijd een woord naast zich. Elke klikbare
      rij is een <button>. De tabbalken zijn echte tablists uit CP_UI.tabs;
      de filterrijen zijn CP_UI.filterChips met aria-pressed, want die
      VERKLEINEN wat er al staat en wisselen niet van paneel.

   6. GELD IS ALTIJD CENTEN. Er wordt in dit bestand nergens met een
      kommagetal gerekend; optellen gebeurt in hele centen en pas bij het
      tonen gaat het door CP_CHART.bedrag(). Dezelfde afspraak als in
      portal/invoice-core.js en portal/admin-data.js.

   7. ELKE SCHRIJFACTIE IS EEN BESTAANDE HAAK UIT ctx.acties. Dit bestand
      bouwt geen enkel dialoogvenster na: het maakt de vensters die in
      beheer.html al bestaan bereikbaar op de plek waar de mockup ze zet, en
      laat ze eindigen in hun eigen vaste afsluiter (auditregel, venster
      sluiten, scherm verversen, ongedaan maken). Ontbreekt een haak, dan
      staat de knop er NIET — en zegt het scherm op die plek in woorden
      waarom. Zie hoofdstuk 2b.

   LADEN
     browser : <script src="portal/admin-schermen-relaties.js"></script> NA
               admin-model.js, admin-charts.js, admin-ui.js en admin-data.js.
               Het bestand VULT window.CP_SCHERMEN aan en overschrijft hem
               nooit — een tweede schermbestand vult dezelfde tabel.
     node    : importeerbaar voor tests; het lichaam raakt bij het laden geen
               document en geen window aan.
   ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     0. KALE HULPJES

     Letterlijk dezelfde vorm als in admin-ui.js en admin-charts.js. Bewust
     gekopieerd en niet geleend: een scherm mag niet stukvallen op de
     laadvolgorde van een bibliotheek waar het zijn eigen typecontrole uit
     zou halen.
     ============================================================ */

  function arr(v) { return Array.isArray(v) ? v : []; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function opt(v) { return isObj(v) ? v : {}; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function fn(v) { return typeof v === 'function' ? v : null; }
  function isNode(v) { return !!v && typeof v === 'object' && typeof v.nodeType === 'number'; }
  function trim(v) { return str(v).replace(/^\s+|\s+$/g, ''); }
  function getal(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function G() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    return null;
  }

  /* ---- de vier bibliotheken --------------------------------------------
     Elke bibliotheek wordt HERKEND aan een functie die alleen zij heeft, en
     valt anders terug op de globale. Dat is nodig omdat het schermcontract
     de naam `data` twee keer gebruikt: voor de opgehaalde lijsten én voor
     CP_DATA. Kijken wat er in zit is het enige wat in allebei de lezingen
     het juiste antwoord geeft. */
  function bibliotheek(kandidaat, kenmerk, globaleNaam) {
    if (isObj(kandidaat) && fn(kandidaat[kenmerk])) return kandidaat;
    var g = G();
    var uit = (g && isObj(g[globaleNaam]) && fn(g[globaleNaam][kenmerk])) ? g[globaleNaam] : null;
    return uit;
  }
  function UI(ctx) { return bibliotheek(opt(ctx).ui, 'el', 'CP_UI'); }
  function CHART(ctx) { return bibliotheek(opt(ctx).chart, 'donut', 'CP_CHART'); }
  function MODEL(ctx) { return bibliotheek(opt(ctx).model, 'parseRoute', 'CP_MODEL'); }
  function DATA(ctx) { return bibliotheek(opt(ctx).data, 'cashflow', 'CP_DATA'); }

  /* CP_INVOICE is de statustabel van de factuurmodule (twaalf standen). Die
     module bouwt op dit moment in beheer.html; hier wordt alleen GELEZEN uit
     STATUS_META, nooit geschreven. Ontbreekt hij, dan valt factuurStand()
     terug op de tabel onderaan hoofdstuk 3 van dit bestand. */
  function INVOICE() {
    var g = G();
    return (g && isObj(g.CP_INVOICE) && isObj(g.CP_INVOICE.STATUS_META)) ? g.CP_INVOICE : null;
  }

  /* ---- de opgehaalde lijsten -------------------------------------------
     ctx.data zoals het contract hem in de eerste betekenis bedoelt: een
     object met clients, projects, invoices, media … Herkend aan het feit dat
     er een ECHTE array in zit. ctx.lijsten wordt ook geaccepteerd, zodat een
     shell die de twee betekenissen uit elkaar wil halen dat kan doen zonder
     dit bestand aan te passen. */
  var LIJSTNAMEN = ['clients', 'projects', 'invoices', 'media', 'questions',
    'documents', 'factories', 'log', 'mailLog', 'audit', 'shipments',
    'samples', 'inspections', 'disclosures', 'briefs', 'team'];

  function lijkenLijsten(v) {
    if (!isObj(v)) return false;
    for (var i = 0; i < LIJSTNAMEN.length; i++) {
      if (Array.isArray(v[LIJSTNAMEN[i]])) return true;
    }
    return false;
  }
  function lijsten(ctx) {
    var c = opt(ctx);
    if (lijkenLijsten(c.lijsten)) return c.lijsten;
    if (lijkenLijsten(c.data)) return c.data;
    return {};
  }
  function L(bron, naam) { return arr(opt(bron)[naam]); }

  /* ---- kleine gedeelde bewerkingen ------------------------------------- */

  function indexOp(rijen, veld) {
    var uit = {};
    arr(rijen).forEach(function (r) {
      if (r && r[veld]) uit[r[veld]] = r;
    });
    return uit;
  }

  /* stabiel sorteren op een tekstsleutel. localeCompare is met opzet NIET
     gebruikt: die hangt van de taalinstelling van de browser af en zou
     dezelfde lijst op twee machines anders ordenen — dezelfde reden waarom
     admin-data.js in beide modi in JavaScript sorteert. */
  function opNaam(rijen, veld) {
    return arr(rijen).slice(0).sort(function (a, b) {
      var x = str(a && a[veld]).toLowerCase();
      var y = str(b && b[veld]).toLowerCase();
      if (x < y) return -1;
      if (x > y) return 1;
      return 0;
    });
  }

  function nlAantal(n, enkel, meervoud) {
    return n + ' ' + (n === 1 ? enkel : meervoud);
  }

  /* ---- geld en datum ----------------------------------------------------
     Beide lopen langs de bibliotheek zodat het hele beheer één notatie
     houdt. De terugval is er alleen voor het geval een scherm buiten de
     shell wordt getekend; hij rekent net als CP_CHART.bedrag in hele centen
     en nooit met een kommagetal. */
  function euro(chart, centen, metCenten) {
    var o = { euro: true };
    if (metCenten === true) o.decimalen = true;
    if (metCenten === false) o.decimalen = false;
    if (chart && fn(chart.bedrag)) return chart.bedrag(centen, o);
    var c = Math.round(getal(centen));
    var negatief = c < 0;
    var absoluut = Math.abs(c);
    var heel = Math.floor(absoluut / 100);
    var rest = absoluut - heel * 100;
    var tekst = String(heel);
    if (rest !== 0 || metCenten === true) tekst += ',' + (rest < 10 ? '0' : '') + String(rest);
    return '€ ' + (negatief ? '-' : '') + tekst;
  }

  function datum(model, iso) {
    if (model && fn(model.formatDate)) return model.formatDate(iso);
    return str(iso);
  }
  function datumTijd(model, iso) {
    if (model && fn(model.formatDateTime)) return model.formatDateTime(iso);
    return str(iso);
  }
  function vandaagVan(model, nu) {
    if (model && fn(model.dayISO)) {
      var d = model.dayISO(nu);
      if (d) return d;
      return model.dayISO(new Date().toISOString());
    }
    return str(nu).slice(0, 10);
  }
  function dagenTussen(model, aIso, bIso) {
    if (model && fn(model.daysBetween)) return model.daysBetween(aIso, bIso);
    return null;
  }

  /* ---- beeld ------------------------------------------------------------
     EEN BEELDBRON WORDT HIER NIET OPGEHAALD, ALLEEN DOORGEGEVEN.
     CP_DATA.avatarUrl() geeft een Promise terug (een pad in de private
     bucket moet ondertekend worden) en een scherm is per contract puur en
     synchroon. Wat al een bruikbaar adres IS — http(s), data: of blob: —
     gaat rechtstreeks door; dat is precies de tak die avatarUrl() zelf ook
     synchroon afhandelt, en het dekt alles wat de demoseed draagt (het
     ingebedde logo van Atelier Noor en de relatieve paden van de foto's).
     Een opgeslagen bucketpad levert hier een LEGE bron op, en dan toont
     CP_UI.avatar zijn initialen — de eerlijke lege stand. Dit is als
     restpost genoteerd in het opleverrapport. */
  function beeldBron(waarde) {
    var t = trim(waarde);
    if (!t) return '';
    if (/^(https?:|data:|blob:)/i.test(t)) return t;
    /* een relatief pad naar een bestand dat naast de pagina staat
       (images/…) is ook gewoon bruikbaar; alles met een schema dat we niet
       kennen niet */
    if (t.indexOf(':') < 0) return t;
    return '';
  }

  /* De eerste GEPUBLICEERDE foto van een project — de bron die hoofdstuk 7
     van de spec aanwijst voor het projectbeeld in de lijst en voor de
     productfoto in de rail. Een rij zonder publishStatus telt als
     gepubliceerd (migratieveilig, net als CP_MODEL.isConceptRow). */
  function projectFoto(model, media, projectId) {
    if (!projectId) return '';
    var rijen = arr(media);
    for (var i = 0; i < rijen.length; i++) {
      var m = rijen[i];
      if (!m || m.projectId !== projectId) continue;
      if (m.kind && m.kind !== 'photo') continue;
      var concept = (model && fn(model.isConceptRow)) ? model.isConceptRow(m) : (m.publishStatus === 'concept');
      if (concept) continue;
      var bron = beeldBron(m.src || m.url || m.path);
      if (bron) return bron;
    }
    return '';
  }

  /* ============================================================
     1. GEDEELDE OPBOUW VAN EEN PAGINA

     Geen componenten maar SCHIKKING: de klassen komen alle drie uit
     hoofdstuk 3 en 5 van portal/admin-ui.css (.u-cols voor het raster met
     rail, .u-cols-main en .u-cols-side.u-vast voor de twee kolommen). De
     werkkolom wordt automatisch 1480px breed zodra er een .u-cols in staat —
     dat is de :has()-regel in admin-ui.css hoofdstuk 5b, dus er hoeft hier
     niets voor gezet te worden.
     ============================================================ */

  function pagina(ui, kop, hoofd, rail) {
    var kinderen = [kop];
    var hoofdLijst = arr(hoofd).filter(isNode);
    var railLijst = arr(rail).filter(isNode);

    if (railLijst.length) {
      kinderen.push(ui.el('div', { class: 'u-cols' }, [
        ui.el('div', { class: 'u-cols-main' }, hoofdLijst),
        ui.el('aside', {
          class: 'u-cols-side u-vast',
          'aria-label': 'Bij deze pagina'
        }, railLijst)
      ]));
    } else {
      hoofdLijst.forEach(function (n) { kinderen.push(n); });
    }
    return ui.el('div', null, kinderen);
  }

  /* Een sectie in de rail: .u-card heeft in admin-ui.css bewust geen
     binnenruimte (hij is ook de wikkel van .u-rows, waar de rijen hun eigen
     padding dragen). Een losse rechterkaart heeft die ruimte wél nodig; de
     inline padding is dezelfde die CP_UI.stickyPanel voor zijn voetkaart
     gebruikt, zodat de twee naast elkaar niet verschillen.
     De titel is 16px/500 — "Rijtitel" uit hoofdstuk 2 van de spec, want een
     railkop is geen paginatitel en geen sectiekop van 20px. */
  function railKaart(ui, titel, kinderen, actie) {
    var kop = null;
    if (str(titel) || isNode(actie)) {
      kop = ui.el('div', {
        style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;'
      }, [
        str(titel) ? ui.el('span', {
          style: 'font-size:16px;font-weight:500;color:var(--ink);',
          text: str(titel)
        }) : null,
        isNode(actie) ? actie : null
      ]);
    }
    var lijst = [kop];
    arr(isNode(kinderen) ? [kinderen] : kinderen).forEach(function (n) {
      if (isNode(n)) lijst.push(n);
    });
    return ui.el('div', {
      class: 'u-card',
      style: 'padding:20px 22px;'
    }, lijst);
  }

  /* De hairline binnen een kaart. admin-ui.css kent er geen klasse voor —
     .u-rows zet zijn lijnen op de kinderen van een lijstkaart, en dit is
     geen lijst. Eén eigenschap, het token uit hoofdstuk 1. */
  function hairline(ui, marge) {
    return ui.el('div', {
      'aria-hidden': 'true',
      style: 'border-top:1px solid var(--line);margin:' + (str(marge) || '24px 0 20px') + ';'
    });
  }

  /* Een regel label-links-waarde-rechts, de vorm die de mockup in elke rail
     gebruikt ("Kerngegevens", "Open acties"). CP_UI.metaGrid doet hetzelfde
     in drie kolommen; in een rail van 400px past maar één kolom en dan is
     label-boven-waarde te hoog. */
  function railRegel(ui, label, waarde, stip) {
    return ui.el('div', {
      style: 'display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:7px 0;'
    }, [
      ui.el('span', { style: 'font-size:13.5px;color:var(--ink-2);', text: str(label) }),
      isNode(stip) ? stip : ui.el('span', {
        style: 'font-size:15px;font-weight:500;color:var(--ink);text-align:right;',
        text: str(waarde)
      })
    ]);
  }

  /* Het lege scherm dat overblijft als een bibliotheek niet geladen is. Geen
     uitzondering en geen lege pagina: een halve render mag nooit een wit vak
     opleveren (afspraak 3 van admin-ui.js). */
  function noodScherm(tekst) {
    var d = (typeof document !== 'undefined') ? document.createElement('div') : null;
    if (!d) return null;
    d.className = 'u-empty';
    var t = document.createElement('span');
    t.className = 'u-empty-title';
    t.textContent = str(tekst) || 'Dit scherm kan nu niet worden getekend.';
    d.appendChild(t);
    return d;
  }

  /* ============================================================
     2. TABBALK VAN HET WERKGEBIED RELATIES

     Eén tabbalk, twee schermen. De tellingen komen uit de opgehaalde
     lijsten, dus "Klanten 2 / Fabrieken 2" staat er ook echt omdat er twee
     van elk zijn.

     WAAROM ALLEEN DE ACTIEVE TAB EEN panelId KRIJGT
     CP_UI.tabs leidt het id van een tabknop af uit panelId ('<panelId>-tab')
     en zet aria-controls op datzelfde panelId. Twee tabs met hetzelfde
     panelId zouden dus twee elementen met hetzelfde id opleveren, en een
     eigen panelId per tab zou aria-controls naar een paneel laten wijzen dat
     niet in de DOM staat — deze tabs wisselen immers van ROUTE en niet van
     paneel. Alleen de actieve tab wijst daarom naar het echte paneel; de
     andere krijgt een eigen id van het component en geen aria-controls.
     ============================================================ */

  function relatieTabs(ctx, ui, model, actief, paneelId) {
    var bron = lijsten(ctx);
    var specs = [
      { key: 'klanten', label: 'Klanten', count: L(bron, 'clients').length },
      { key: 'fabrieken', label: 'Fabrieken', count: L(bron, 'factories').length }
    ];
    specs.forEach(function (t) {
      if (t.key === actief) t.panelId = paneelId;
    });
    return ui.tabs({
      tabs: specs,
      actief: actief,
      label: 'Relaties',
      onKies: function (key) {
        if (key === actief) return;
        ga(ctx, relatieRoute(model, key, null, null));
      }
    });
  }

  /* De route van dit werkgebied, altijd via CP_MODEL.buildRoute zodat de
     grammatica (#/relaties/<sub>/<id>/<tab>) op precies één plek staat.
     De tab hoort in het PAD en niet in de query: hij hoort bij de entiteit,
     net als de projecttabs. CP_MODEL.tabOf leest allebei de vormen, maar
     schrijven doen we er maar één. */
  function relatieRoute(model, sub, id, params, tab) {
    if (model && fn(model.buildRoute)) {
      return model.buildRoute({
        area: 'relaties', sub: sub, id: id || null,
        tab: (id && str(tab)) ? str(tab) : null,
        params: opt(params)
      });
    }
    return '#/relaties/' + str(sub) +
      (id ? '/' + encodeURIComponent(id) : '') +
      ((id && str(tab)) ? '/' + encodeURIComponent(str(tab)) : '');
  }

  function ga(ctx, route, opties) {
    var c = opt(ctx);
    if (fn(c.ga)) return c.ga(route, opties);
    return null;
  }

  /* Een tabwissel binnen een dossier is een DEELNAVIGATIE: de pagina blijft
     staan, de focus blijft waar hij is en de melding vertelt wat er
     veranderde. Zonder behoudFocus hoort een schermlezer bij elke tabklik
     alleen de klantnaam opnieuw en niet welke tab er nu open staat. Zelfde
     vorm als admin-schermen-werk.js voor de projecttabs gebruikt. */
  function deelGa(ctx, route, tekst) {
    return ga(ctx, route, { behoudScroll: true, behoudFocus: true, melding: str(tekst) });
  }

  function toon(ui, tekst) {
    if (ui && fn(ui.toast)) ui.toast(str(tekst));
  }

  /* ============================================================
     2b. DE ACTIEHAKEN VAN DE SHELL

     ctx.acties is het volledige actiecontract van beheer.html: de bestaande
     dialoogvensters, elk met zijn eigen vaste afsluiter (auditregel, venster
     sluiten, scherm verversen, ongedaan maken). DIT BESTAND SCHRIJFT ZELF
     GEEN VENSTER NA. Het maakt ze bereikbaar op de plek waar de mockup ze
     zet: één primaire knop per context, al het andere achter het •••, een
     rij krijgt zijn acties in het ••• van díé rij, een formulierpagina krijgt
     de zwevende opslagbalk, en een gevaarlijke actie staat onderin het menu
     in de kritieke kleur.

     EEN ONTBREKENDE HAAK LEVERT GEEN KNOP OP. Een knop die niets doet belooft
     iets wat er niet is, en dat is erger dan een knop die er niet staat.
     Valt een hele groep acties weg, dan zegt het scherm in woorden waarom —
     op precies de plek waar ze hoorde te staan.
     ============================================================ */

  function haak(ctx, naam) {
    return fn(opt(opt(ctx).acties)[str(naam)]);
  }

  /* Een menu-item dat zichzelf weglaat zodra zijn haak ontbreekt.
     `arg` is de rij waarmee de haak wordt aangeroepen; opties.tweede is de
     tweede parameter voor de haken die er twee kennen. */
  function haakItem(ctx, naam, label, ico, arg, opties) {
    var h = haak(ctx, naam);
    if (!h) return null;
    var o = opt(opties);
    var it = {
      label: str(label),
      ico: str(ico) || null,
      gevaarlijk: !!o.gevaarlijk,
      onKies: function () { h(arg, o.tweede); }
    };
    if (isObj(o.bevestig)) it.bevestig = o.bevestig;
    return it;
  }

  /* Dezelfde controle voor een primaire knop (pageHeader.primair of een
     losse knop in een kaart): een spec, of null. */
  function haakKnop(ctx, naam, label, ico, arg, titel) {
    var h = haak(ctx, naam);
    if (!h) return null;
    return {
      label: str(label),
      ico: str(ico) || null,
      titel: str(titel) || null,
      onClick: function () { h(arg); }
    };
  }

  /* Een gewone knop uit zo'n spec, voor de plekken waar geen component om
     een primaire actie vraagt (een sectiekop, een kaartvoet). */
  function knopUit(ui, spec, klasse) {
    if (!isObj(spec)) return null;
    return ui.el('button', {
      type: 'button',
      class: 'u-btn' + (str(klasse) ? ' ' + str(klasse) : ''),
      title: spec.titel || null,
      onclick: fn(spec.onClick) || null
    }, [
      ui.el('span', { text: str(spec.label) }),
      str(spec.ico) ? ui.icon(str(spec.ico), 18) : null
    ]);
  }

  /* De lege plekken uit een menu halen: null-items (ontbrekende haken) en
     scheidingen die na dat opruimen vooraan, achteraan of dubbel komen te
     staan — een streep zonder iets om te scheiden is ruis. */
  function menuLijst(items) {
    var uit = [];
    arr(items).forEach(function (it) {
      if (!isObj(it)) return;
      if (it.scheiding) {
        if (!uit.length) return;
        if (uit[uit.length - 1].scheiding) return;
      }
      uit.push(it);
    });
    while (uit.length && uit[uit.length - 1].scheiding) uit.pop();
    return uit;
  }

  /* ---- formuliervelden -------------------------------------------------
     admin-ui.css kent .input, .flabel en .checkline binnen .u-shell, maar
     geen rasterklasse voor een formulier. De maatvoering hieronder is exact
     die van nieuweFabriekFormulier() verderop in dit bestand, zodat er niet
     twee formuliervormen naast elkaar ontstaan. */

  function veldVak(ui, id, label, invoer, uitleg) {
    return ui.el('div', { style: 'min-width:0;' }, [
      ui.el('label', {
        for: id,
        style: 'display:block;font-size:13px;color:var(--ink-2);margin-bottom:6px;',
        text: str(label)
      }),
      invoer,
      str(uitleg) ? ui.el('span', {
        class: 'u-row-sub', style: 'display:block;margin-top:6px;', text: str(uitleg)
      }) : null
    ]);
  }

  function tekstInvoer(ui, id, waarde, plaatshouder) {
    return ui.el('input', {
      id: id, class: 'input', type: 'text', autocomplete: 'off',
      placeholder: str(plaatshouder) || null, value: str(waarde)
    });
  }

  function vlakInvoer(ui, id, waarde, plaatshouder) {
    var ta = ui.el('textarea', {
      id: id, class: 'input', placeholder: str(plaatshouder) || null
    });
    ta.value = str(waarde);
    return ta;
  }

  /* keuzes: [{key, label}]. Een OPGESLAGEN WAARDE DIE NIET IN DE LIJST STAAT
     wordt niet stil weggegooid maar toegevoegd en als zodanig benoemd —
     precies wat de oude fabriekenlijst met een stad buiten de preset deed.
     `restLabel` zegt WAAROM die waarde er niet in staat; zonder die uitleg
     ziet de eigenaar alleen zijn eigen waarde terug en leert hij niets. */
  function keuzeInvoer(ui, id, keuzes, waarde, label, restLabel) {
    var sel = ui.el('select', { id: id, class: 'input', 'aria-label': str(label) || null });
    arr(keuzes).forEach(function (k) {
      sel.appendChild(ui.el('option', { value: str(k.key), text: str(k.label) }));
    });
    sel.value = str(waarde);
    if (str(waarde) && sel.value !== str(waarde)) {
      sel.appendChild(ui.el('option', {
        value: str(waarde),
        text: str(waarde) + (str(restLabel) ? ' (' + str(restLabel) + ')' : ' (niet in de lijst)')
      }));
      sel.value = str(waarde);
    }
    return sel;
  }

  function veldRaster(ui, velden, minBreedte) {
    return ui.el('div', {
      style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(' +
        (minBreedte || 220) + 'px,1fr));gap:16px;'
    }, arr(velden).filter(isNode));
  }

  /* ---- drie tabellen die in beheer.html wonen en daar niet uit kunnen ----
     MAIL_PREF_CATS, PORTAL_LANGS en LIFECYCLES staan in het afgesloten
     scriptblok van beheer.html; CP_MODEL exporteert ze (nog) niet. Ze staan
     hier als KOPIE, om dezelfde reden als STAND_TERUGVAL hierboven: met
     exact dezelfde sleutels en labels, zodat er onmogelijk twee
     woordenboeken kunnen ontstaan. De SLEUTELS zijn wat er wordt opgeslagen;
     verandert daar ooit iets, dan hoort het hier mee te veranderen —
     genoteerd in het opleverrapport. */

  var MAIL_CATS = [
    { key: 'fase', label: 'Fase-updates' },
    { key: 'update', label: 'Updates, documenten & antwoorden' },
    { key: 'sample', label: 'Samples' },
    { key: 'zending', label: 'Zendingen' },
    { key: 'factuur', label: 'Facturen & herinneringen' },
    { key: 'relatie', label: 'Relatiemails (welkom, check-in, afscheid)' }
  ];

  var PORTAAL_TALEN = [
    { key: 'nl', label: 'Nederlands' },
    { key: 'en', label: 'English' },
    { key: 'de', label: 'Deutsch' },
    { key: 'fr', label: 'Français' },
    { key: 'es', label: 'Español' }
  ];

  var LIFECYCLES = [
    { key: 'lead', label: 'Lead' },
    { key: 'intake', label: 'Intake' },
    { key: 'actief', label: 'Actief' },
    { key: 'slapend', label: 'Slapend' },
    { key: 'gearchiveerd', label: 'Gearchiveerd' }
  ];

  function lifecycleLabel(key) {
    for (var i = 0; i < LIFECYCLES.length; i++) {
      if (LIFECYCLES[i].key === str(key)) return LIFECYCLES[i].label;
    }
    return str(key);
  }

  /* De stadslijst is de PRESET uit portal/config.js — dezelfde bron als de
     kaart in het klantportaal. Alleen een stad uit die tabel heeft een
     coördinaat en dus een pin; leeg betekent geen pin, precies zoals de oude
     fabriekenlijst het zei. */
  function stadKeuzes() {
    var g = G();
    var tabel = (g && isObj(g.CP_CITY_COORDS)) ? g.CP_CITY_COORDS : {};
    var uit = [{ key: '', label: 'Geen stad op de kaart' }];
    Object.keys(tabel).forEach(function (naam) { uit.push({ key: naam, label: naam }); });
    return uit;
  }

  /* ============================================================
     3. DE STATUSVERTALER VAN EEN FACTUUR

     DIT IS DE BELANGRIJKSTE FUNCTIE VAN HET SCHERM FINANCIËN, en de reden
     dat hij bestaat staat in beslissing 2.8 en in de risicolijst van het
     migratieplan: er liggen TWEE WAARHEDEN naast elkaar in dezelfde tabel.
     Oude rijen dragen status open/paid/void, nieuwe rijen van de
     factuurmodule dragen statusCode uit een model van twaalf standen. Wie
     inv.status rechtstreeks leest, ziet een definitieve factuur van de
     nieuwe module als "open" en biedt er de verkeerde actie bij aan.

     De vertaling hieronder is LETTERLIJK invStatusOf() uit beheer.html:
       statusCode wint · anders concept → draft · paid → paid ·
       void → cancelled · en al het andere is finalized.
     Die functie staat in beheer.html en dat bestand mag deze bouw niet
     aanraken; CP_MODEL exporteert hem (nog) niet. Zodra dat wel zo is, hoort
     deze kopie te verdwijnen — genoteerd in het opleverrapport.

     DE VERVALDATUM VERANDERT DE STAND NIET, MAAR WEL DE LEZING. Een factuur
     die verstuurd is en waarvan de vervaldatum verstreken is, staat in het
     twaalfstatusmodel op 'overdue' zodra iemand hem bijwerkt — maar niemand
     werkt hem bij. Dezelfde klok die CP_DATA.invoiceRhythm() gebruikt (het
     echte dueDate, anders aanmaak plus dertig dagen) bepaalt hier daarom of
     de rij als "Vervallen" leest. Dat is geen derde waarheid maar dezelfde
     berekening, op één plek.
     ============================================================ */

  /* De terugvaltabel voor het geval CP_INVOICE niet geladen is. Dezelfde
     labels als STATUS_META daar, zodat er onmogelijk twee woordenboeken
     kunnen ontstaan. */
  var STAND_TERUGVAL = {
    draft: 'Concept', scheduled: 'Ingepland', finalized: 'Definitief',
    sent: 'Verstuurd', viewed: 'Bekeken', partially_paid: 'Deels betaald',
    paid: 'Betaald', overdue: 'Vervallen', disputed: 'Betwist',
    cancelled: 'Geannuleerd', credited: 'Gecrediteerd', uncollectible: 'Oninbaar'
  };

  /* De toon per stand. Hoofdstuk 0 van de spec: kleur die BETEKENIS draagt
     blijft kleur. 'extern' (blauw) is de bal ligt bij de klant — dat is
     precies wat een verstuurde factuur is. */
  var STAND_TOON = {
    draft: 'neutraal', scheduled: 'neutraal',
    finalized: 'extern', sent: 'extern', viewed: 'extern', partially_paid: 'extern',
    paid: 'klaar',
    overdue: 'kritiek', disputed: 'kritiek', uncollectible: 'kritiek',
    cancelled: 'neutraal', credited: 'neutraal'
  };

  /* De PRIMAIRE ACTIE per stand — AFGELEID UIT DE VERTALER, nooit uit het
     statusveld. Dit was tot deze ronde alleen een LABEL: elke rij bracht je
     naar de factuureditor en verder niets, waardoor een factuur op betaald
     zetten nergens in het beheer meer kon. Voor een eenmanszaak is dat de
     handeling van de dag.

     STAND_ACTIE blijft de zin die naast de stip staat ("wat er nu met deze
     factuur moet gebeuren"). STAND_PRIMAIR zegt welke BESTAANDE haak uit
     ctx.acties daarbij hoort. De haken zijn de vensters van de factuurmodule
     zelf — openMarkPaidModal, openInvoicePublishModal, openReminderModal,
     openInvoiceDocModal — dus er ontstaat hier geen tweede weg naast. Er is
     alleen weer een ingang. */
  var STAND_ACTIE = {
    draft: 'Concept afmaken', scheduled: 'Inplanning bijwerken',
    finalized: 'Versturen vanuit de factuur', sent: 'Betaling opvolgen',
    viewed: 'Betaling opvolgen', partially_paid: 'Restbedrag opvolgen',
    paid: 'Factuur bekijken', overdue: 'Herinnering sturen',
    disputed: 'Geschil oppakken', cancelled: 'Factuur bekijken',
    credited: 'Creditnota bekijken', uncollectible: 'Afboeking bekijken'
  };

  var STAND_PRIMAIR = {
    /* een concept is nog geen factuur: publiceren geeft hem zijn nummer, zijn
       document en zijn klantmail */
    draft: { label: 'Publiceren', naam: 'factuurPubliceren', ico: 'vinkje' },
    scheduled: { label: 'Publiceren', naam: 'factuurPubliceren', ico: 'vinkje' },
    /* alles wat de deur uit is en nog geld open heeft: betaald markeren, met
       kenmerkcontrole en bevestigingsmail in het bestaande venster */
    finalized: { label: 'Betaald markeren', naam: 'factuurBetaaldMarkeren', ico: 'vinkje' },
    sent: { label: 'Betaald markeren', naam: 'factuurBetaaldMarkeren', ico: 'vinkje' },
    viewed: { label: 'Betaald markeren', naam: 'factuurBetaaldMarkeren', ico: 'vinkje' },
    partially_paid: { label: 'Restbedrag betaald', naam: 'factuurBetaaldMarkeren', ico: 'vinkje' },
    overdue: { label: 'Betaald markeren', naam: 'factuurBetaaldMarkeren', ico: 'vinkje' },
    /* betwist en oninbaar zijn geen betaling en geen concept: die horen in de
       editor, waar de hele staat van de factuur ligt */
    disputed: { label: 'Open in de editor', naam: 'factuurOpenen', ico: 'potlood' },
    uncollectible: { label: 'Open in de editor', naam: 'factuurOpenen', ico: 'potlood' },
    /* afgeronde standen: kijken mag, doen valt er niets meer */
    paid: { label: 'Factuurdocument', naam: 'factuurPdf', ico: 'bestand' },
    cancelled: { label: 'Factuurdocument', naam: 'factuurPdf', ico: 'bestand' },
    credited: { label: 'Factuurdocument', naam: 'factuurPdf', ico: 'bestand' }
  };

  function statusCodeVan(model, inv) {
    if (!inv) return 'draft';
    if (inv.statusCode) return String(inv.statusCode);
    var concept = (model && fn(model.isConceptRow)) ? model.isConceptRow(inv) : (inv.publishStatus === 'concept');
    if (concept) return 'draft';
    if (inv.status === 'paid') return 'paid';
    if (inv.status === 'void') return 'cancelled';
    return 'finalized';
  }

  function factuurStand(ctx, inv, vandaag) {
    var model = MODEL(ctx);
    var data = DATA(ctx);
    var kern = INVOICE();
    var code = statusCodeVan(model, inv);
    var meta = (kern && isObj(kern.STATUS_META[code])) ? kern.STATUS_META[code] : null;

    var bedragCents = (data && fn(data.factuurBedragCents)) ? data.factuurBedragCents(inv) : getal(inv && inv.amountCents);
    var betaaldCents = (data && fn(data.factuurBetaaldCents)) ? data.factuurBetaaldCents(inv)
      : ((inv && inv.status === 'paid') ? bedragCents : 0);
    var openCents = Math.max(0, bedragCents - betaaldCents);

    var verval = null;
    if (model && fn(model.invoiceDueISO)) verval = model.invoiceDueISO(inv);
    else if (data && fn(data.factuurVervalISO)) verval = data.factuurVervalISO(inv);

    /* alleen een factuur die de deur uit is en nog geld open heeft, kan te
       laat zijn. Een concept, een geannuleerde en een gecrediteerde niet —
       en een betaalde al helemaal niet. */
    var draaitNog = (code === 'finalized' || code === 'sent' || code === 'viewed' ||
      code === 'partially_paid' || code === 'overdue');
    var teLaat = !!(draaitNog && openCents > 0 && verval && vandaag && verval < vandaag);

    var eindCode = teLaat ? 'overdue' : code;
    var label = STAND_TERUGVAL[eindCode] || eindCode;
    if (!teLaat && meta && str(meta.label)) label = str(meta.label);
    else if (teLaat && kern && isObj(kern.STATUS_META.overdue)) label = str(kern.STATUS_META.overdue.label);

    return {
      code: code,
      eindCode: eindCode,
      label: label,
      toon: STAND_TOON[eindCode] || 'neutraal',
      actie: STAND_ACTIE[eindCode] || 'Factuur openen',
      /* editable/terminal komen uit STATUS_META en niet uit een eigen
         lijstje: welke stand nog te bewerken is, is kennis van de
         factuurmodule. Zonder die module is een concept het enige dat
         zeker bewerkbaar is. */
      bewerkbaar: meta ? !!meta.editable : (code === 'draft' || code === 'scheduled'),
      isConcept: (code === 'draft' || code === 'scheduled'),
      isBetaald: (code === 'paid'),
      isCredit: (code === 'credited'),
      teLaat: teLaat,
      bedragCents: bedragCents,
      betaaldCents: betaaldCents,
      openCents: openCents,
      vervalISO: verval
    };
  }

  function factuurRoute(model, id) {
    if (model && fn(model.buildRoute)) return model.buildRoute({ area: 'factuur', id: id || null });
    return '#/factuur' + (id ? '/' + encodeURIComponent(id) : '');
  }

  /* ============================================================
     4. KLANTGEZONDHEID

     BRON: computeClientHealth() in beheer.html. Die functie is de bestaande
     waarheid over "heeft deze klant aandacht nodig" en levert de twee
     health-filters die fase 6 van het migratieplan vraagt. Ze staat in
     beheer.html, dat deze bouw niet mag aanraken, en CP_MODEL exporteert
     haar (nog) niet — vandaar deze afleiding, met exact dezelfde drempels:

       oude vragen      een open klantvraag ouder dan 2 dagen
       facturen 30+     een openstaande factuur van 30 dagen of ouder
       laatste contact  het jongste activiteitsmoment van deze klant
       niveau           rood zodra er een oude vraag of een 30+-factuur is;
                        anders 'let' als er meer dan 30 dagen geen contact
                        was (of nog helemaal geen); anders ok.

     HET LAATSTE CONTACT KOMT UIT CP_MODEL.mergeActivity({clientId}) en niet
     uit een eigen samenvoeging. Dat is beslissing 2.6 letterlijk: één
     bouwfunctie is de enige garantie dat dezelfde gebeurtenis op vier
     schermen dezelfde tekst en hetzelfde tijdstip krijgt. Contactmomenten
     zitten daar als bron in; staan ze niet in de opgehaalde lijsten, dan
     tellen ze niet mee en zegt het scherm dat met "nog geen contact
     vastgelegd" in plaats van een datum te verzinnen.
     ============================================================ */

  function klantActiviteit(ctx, clientId, limiet) {
    var model = MODEL(ctx);
    if (!model || !fn(model.mergeActivity)) return [];
    var bron = lijsten(ctx);
    return model.mergeActivity({
      accessLog: L(bron, 'log'),
      mailLog: L(bron, 'mailLog'),
      auditLog: L(bron, 'audit'),
      contacts: L(bron, 'contactMoments'),
      moments: L(bron, 'moments'),
      questions: L(bron, 'questions'),
      invoices: L(bron, 'invoices'),
      shipments: L(bron, 'shipments'),
      projects: L(bron, 'projects')
    }, { clientId: clientId, limit: limiet || 0 });
  }

  function klantGezondheid(ctx, klant, projecten, facturen, vandaag) {
    var model = MODEL(ctx);
    var bron = lijsten(ctx);
    var pids = {};
    arr(projecten).forEach(function (p) { if (p && p.id) pids[p.id] = true; });

    var oudeVragen = 0;
    L(bron, 'questions').forEach(function (q) {
      if (!q || !pids[q.projectId] || q.answeredAt) return;
      var leeftijd = dagenTussen(model, q.askedAt, vandaag);
      if (leeftijd !== null && leeftijd > 2) oudeVragen += 1;
    });

    var facturen30 = 0;
    arr(facturen).forEach(function (f) {
      if (!f || !f.stand || f.stand.isConcept || f.stand.isBetaald) return;
      if (f.stand.openCents <= 0) return;
      var leeftijd = dagenTussen(model, f.inv.createdAt, vandaag);
      if (leeftijd !== null && leeftijd >= 30) facturen30 += 1;
    });

    var laatste = klantActiviteit(ctx, klant && klant.id, 1)[0] || null;
    var contactDagen = laatste ? dagenTussen(model, laatste.at, vandaag) : null;

    var niveau = 'ok';
    if (contactDagen === null || contactDagen > 30) niveau = 'let';
    if (oudeVragen > 0 || facturen30 > 0) niveau = 'rood';

    return {
      niveau: niveau,
      label: niveau === 'rood' ? 'Actie nodig' : (niveau === 'let' ? 'Aandacht' : 'Op koers'),
      toon: niveau === 'rood' ? 'kritiek' : (niveau === 'let' ? 'wacht' : 'klaar'),
      oudeVragen: oudeVragen,
      facturen30: facturen30,
      laatste: laatste,
      contactDagen: contactDagen
    };
  }

  /* Alles wat een klantkaart nodig heeft, één keer per klant uitgerekend.
     Elke waarde draagt hieronder haar bron in commentaar. */
  function klantDossier(ctx, klant, vandaag) {
    var model = MODEL(ctx);
    var chart = CHART(ctx);
    var data = DATA(ctx);
    var bron = lijsten(ctx);

    /* projecten: het echte veld projects.clientId */
    var projecten = L(bron, 'projects').filter(function (p) {
      return p && p.clientId === klant.id;
    });
    var actief = projecten.filter(function (p) {
      if (model && fn(model.isArchived)) return !model.isArchived(p);
      return p.status !== 'archived';
    });

    /* facturen: via het project, want een factuurrij draagt geen clientId */
    var pids = indexOp(projecten, 'id');
    var facturen = L(bron, 'invoices').filter(function (inv) {
      return inv && pids[inv.projectId];
    }).map(function (inv) {
      return { inv: inv, stand: factuurStand(ctx, inv, vandaag) };
    });

    var openCents = 0, openAantal = 0;
    facturen.forEach(function (f) {
      if (f.stand.isConcept || f.stand.isCredit) return;
      if (f.stand.openCents <= 0) return;
      openCents += f.stand.openCents;
      openAantal += 1;
    });

    /* het verloop onder de kaart: gefactureerd per maand over zes maanden,
       rechtstreeks uit CP_DATA.cashflow — dezelfde functie die het scherm
       Financiën voedt, zodat de sparkline en de grote grafiek onmogelijk
       verschillende getallen kunnen tonen */
    var reeks = [], labels = [], somGefactureerd = 0;
    if (data && fn(data.cashflow)) {
      var cf = data.cashflow(facturen.map(function (f) { return f.inv; }), 6, ctx && ctx.nu);
      arr(cf.reeks).forEach(function (punt) {
        reeks.push(punt.gefactureerdCents);
        labels.push(punt.label);
        somGefactureerd += punt.gefactureerdCents;
      });
    }

    var gezondheid = klantGezondheid(ctx, klant, projecten, facturen, vandaag);

    return {
      klant: klant,
      projecten: projecten,
      actieveProjecten: actief,
      facturen: facturen,
      openCents: openCents,
      openAantal: openAantal,
      reeks: reeks,
      reeksLabels: labels,
      reeksTotaal: somGefactureerd,
      gezondheid: gezondheid,
      /* "bijzonderheden" bepaalt welke van de twee kaartvarianten uit
         hoofdstuk 5.5 een klant krijgt. De grote kaart draagt een verloop en
         een rij actieve producten; een klant die nog nooit gefactureerd is
         en nog geen lopend product heeft, heeft daar allebei niets voor —
         dan is de compacte kaart met één statusregel niet minder maar
         eerlijker. Dat is precies waarom Fjell Outdoor in de mockup korter
         is dan Atelier Noor: die zit nog in het offertetraject. */
      heeftBijzonderheden: (somGefactureerd > 0 || facturen.length > 0)
    };
  }

  /* ============================================================
     5. SCHERM — RELATIES, TAB KLANTEN (spec 5.5)
     ============================================================ */

  var KLANT_FILTERS = [
    { key: 'alle', label: 'Alle klanten', altijd: true },
    { key: 'aandacht', label: 'Heeft aandacht nodig' },
    { key: 'stil', label: 'Geen recent contact' }
  ];

  function klantVoldoetAan(dossier, filter) {
    if (filter === 'aandacht') return dossier.gezondheid.niveau === 'rood';
    if (filter === 'stil') {
      return dossier.gezondheid.contactDagen === null || dossier.gezondheid.contactDagen > 30;
    }
    return true;
  }

  function schermRelaties(ctx) {
    var ui = UI(ctx);
    if (!ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen.');
    var model = MODEL(ctx);
    var chart = CHART(ctx);
    var bron = lijsten(ctx);
    var route = opt(opt(ctx).route);
    var params = opt(route.params);
    var vandaag = vandaagVan(model, opt(ctx).nu);

    var klanten = opNaam(L(bron, 'clients'), 'company');
    var dossiers = klanten.map(function (c) { return klantDossier(ctx, c, vandaag); });

    /* het filter staat in de query, niet in een variabele */
    var filter = str(params.filter) || 'alle';
    var geldig = false;
    KLANT_FILTERS.forEach(function (f) { if (f.key === filter) geldig = true; });
    if (!geldig) filter = 'alle';

    var zichtbaar = dossiers.filter(function (d) { return klantVoldoetAan(d, filter); });

    /* selectie komt uit de route (#/relaties/klanten/<id>); zonder id is de
       eerste zichtbare klant de rail-klant, zodat de rail nooit leeg staat
       terwijl er wel klanten zijn.

       EEN ID DAT NIET BESTAAT IS GEEN DETAIL. Een gearchiveerde of
       verwijderde klant, een verlopen bladwijzer, een tikfout in de
       adresbalk: dan de eerste klant tonen alsof hij het is, is stil de
       verkeerde klant tonen — inclusief zijn openstaande bedrag. Het scherm
       valt daarom terug op de lijst en zegt in één regel waarom. */
    var gekozenId = str(route.id);
    var gevonden = null;
    dossiers.forEach(function (d) { if (d.klant.id === gekozenId) gevonden = d; });
    var onbekendId = (gekozenId && !gevonden) ? gekozenId : '';
    var gekozen = gevonden || zichtbaar[0] || dossiers[0] || null;

    /* HET DOSSIER IS EEN EIGEN SCHERM MET ZES TABS. Zolang dit één pagina
       was, gaven alle zes de tabsleutels dezelfde weergave en was er geen
       enkele bewerkactie. Zie hoofdstuk 5b. */
    if (gevonden) return klantDossierScherm(ctx, ui, chart, model, gevonden, vandaag);

    var paneelId = 'rel-klanten-paneel';

    /* ---- de kop ---- */
    var kop = ui.pageHeader({
      titel: 'Relaties',
      /* DE MOCKUP KENT TWEE KOPPEN. Alleen Projecten zet de primaire knop
         direct naast de titel; Overzicht, Financiën, Relaties, Fabrieken en
         Instellingen lijnen hem RECHTS uit op de titelregel, met het •••
         ertegenaan. Dat is ook de standaard van pageHeader, maar hij staat
         er expliciet bij: dan kan de terugvalregel (een knopelement in
         `badge` betekent 'naast') deze drie koppen nooit omzetten. */
      actiePlaats: 'rechts',
      primair: {
        label: 'Nieuwe klant',
        ico: 'plus',
        /* ER IS GEEN createClient IN DE DATALAAG, en een knop die doet alsof
           wel is erger dan een knop die de waarheid vertelt: een klant
           ONTSTAAT in dit systeem uit een aanvraag, via de vierstapspijplijn
           in de Inbox (openBriefConvertModal). Deze knop brengt je daarheen
           en zegt dat ook in zijn toelichting. Genoteerd in het rapport. */
        titel: 'Een nieuwe klant ontstaat uit een aanvraag. Dit opent de Inbox bij Nieuw.',
        onClick: function () { ga(ctx, '#/inbox?chip=nieuw'); }
      }
    });

    /* ---- het hoofdgedeelte ---- */
    var hoofd = [];
    hoofd.push(relatieTabs(ctx, ui, model, 'klanten', paneelId));

    var paneelKinderen = [];

    if (onbekendId) {
      paneelKinderen.push(ui.emptyState({
        titel: 'Deze klant staat niet in het beheer',
        uitleg: 'Het adres wijst naar klant ' + onbekendId + '. Die bestaat hier niet (meer) — hieronder staan de klanten die er wél zijn.'
      }));
    }

    paneelKinderen.push(ui.filterChips({
      label: 'Filter op klantgezondheid',
      actief: filter,
      chips: KLANT_FILTERS.map(function (f) {
        return {
          key: f.key,
          label: f.label,
          altijd: f.altijd,
          count: dossiers.filter(function (d) { return klantVoldoetAan(d, f.key); }).length
        };
      }),
      onKies: function (key) {
        ga(ctx, relatieRoute(model, 'klanten', null, key === 'alle' ? null : { filter: key }));
      }
    }));

    var teTonen = zichtbaar;

    if (!teTonen.length) {
      paneelKinderen.push(ui.emptyState({
        titel: klanten.length ? 'Geen klant in dit filter' : 'Nog geen klanten',
        uitleg: klanten.length
          ? 'Dit filter kijkt naar openstaande vragen, openstaande facturen en het laatste contactmoment. Er voldoet nu geen enkele klant aan.'
          : 'Een klant ontstaat uit een aanvraag in de Inbox: daar zet je een aanvraag om naar een klant met een eerste project.',
        actie: klanten.length
          ? { label: 'Toon alle klanten', onClick: function () { ga(ctx, relatieRoute(model, 'klanten', null, null)); } }
          : { label: 'Naar de Inbox', onClick: function () { ga(ctx, '#/inbox?chip=nieuw'); } }
      }));
    } else {
      teTonen.forEach(function (d) {
        /* de lifecycle hoort bij de RIJ en niet alleen bij het dossier: hij
           bepaalt of "Check-in-mail sturen" in het ••• van deze klant staat
           (alleen bij een slapende klant, precies zoals de uitzonderingsrij
           in de oude lijst) en hij staat als kicker op de kaart, zodat
           zichtbaar is waaróm die actie er staat. */
        var lc = klantLifecycle(ctx, d, vandaag);
        paneelKinderen.push(d.heeftBijzonderheden
          ? klantKaart(ctx, ui, chart, model, d, vandaag, gekozen === d, lc)
          : klantKaartCompact(ctx, ui, model, d, gekozen === d, lc));
      });
    }

    hoofd.push(ui.el('div', {
      id: paneelId,
      role: 'tabpanel',
      'aria-labelledby': paneelId + '-tab',
      tabindex: '0',
      /* de kaarten staan onder elkaar met dezelfde tussenruimte als het
         raster van hoofdstuk 5.3 (.u-grid-* gebruikt 16px) */
      style: 'display:flex;flex-direction:column;gap:16px;'
    }, paneelKinderen));

    /* ---- de rail ---- */
    var rail = klantRail(ctx, ui, chart, model, gekozen, false, vandaag);

    return pagina(ui, kop, hoofd, rail);
  }

  /* ---- het ••• van een klantRIJ ---------------------------------------
     Mappingtabel: "uitzonderingsrij slapende klant → rij-contextmenu •••,
     de rij wordt daardoor net als alle andere volledig klikbaar".

     De oude lijst zette bij een slapende klant een extra knop Check-in-mail
     ín de rij; daardoor was juist díé rij niet in zijn geheel aanklikbaar.
     Hier is het één menu met dezelfde acties als het ••• van het dossier —
     bewust dezelfde volgorde en dezelfde labels, zodat dezelfde handeling
     niet op twee plekken anders heet. De check-in staat er alleen bij een
     slapende klant, want dat is de mail die een slapende klant wakker maakt;
     bij een actieve klant zou hij een handeling voorstellen die nergens op
     slaat.

     ONTBREEKT EEN HAAK, DAN VALT ALLEEN DAT ITEM WEG (haakItem geeft dan
     null terug en menuLijst ruimt de streep op die daardoor alleen komt te
     staan). Vallen ze allemaal weg, dan staat er geen ••• — een menu met nul
     items belooft acties die er niet zijn. */
  function klantRijMenu(ctx, d, lc) {
    var k = d.klant;
    return menuLijst([
      haakItem(ctx, 'bekijkAlsKlant', 'Bekijk als klant', 'extern', k),
      haakItem(ctx, 'klantBewerken', 'Klantgegevens bewerken', 'potlood', k),
      haakItem(ctx, 'nieuwProject', 'Nieuw project', 'plus', k),
      haakItem(ctx, 'contactmomentToevoegen', 'Contactmoment vastleggen', 'kalender', k),
      haakItem(ctx, 'contactpersoonToevoegen', 'Contactpersoon toevoegen', 'team', k),
      { scheiding: true },
      haakItem(ctx, 'klantUitnodigen',
        k.invitedAt ? 'Welkomstmail opnieuw sturen' : 'Uitnodigen voor het portaal', 'mail', k),
      (lc && lc.key === 'slapend')
        ? haakItem(ctx, 'checkInMail', 'Check-in-mail sturen', 'mail', k) : null,
      { scheiding: true },
      haakItem(ctx, 'exportpakket', 'Exportpakket (dossier)', 'bestand', k),
      haakItem(ctx, 'klantOffboarden', 'Klant afronden…', 'sluiten', k, { gevaarlijk: true })
    ]);
  }

  /* ---- de grote klantkaart (spec 5.5) ---------------------------------
     Een eigen compositie, gebouwd op .u-hero uit admin-ui.css (--card-2,
     radius 24, padding 32 — precies de maten die hoofdstuk 5.5 vraagt) met
     de bouwstenen van CP_UI erin. Drie kolommen: personalia, twee
     stattegels, het verloop. Onder een hairline de rij actieve producten.

     DRIE INLINE STIJLEN MET REDEN, want admin-ui.css heeft er geen klasse
     voor: het driekolomsraster van deze ene kaart, de naam op 32px (spec 5.5
     noemt die maat letterlijk en hoofdstuk 2 kent alleen 30px voor een
     paneeltitel), en de chevron rechtsboven op een stattegel. */
  function klantKaart(ctx, ui, chart, model, d, vandaag, isGekozen, lc) {
    var k = d.klant;
    var g = d.gezondheid;

    /* ---- kolom 1: wie is dit ---- */
    var naamKnop = ui.el('button', {
      type: 'button',
      /* de naam is de ingang naar deze klant; .u-link is de zwarte
         tekstlink uit hoofdstuk 0 (zwart, onderstreept bij hover) */
      class: 'u-link',
      style: 'font-size:32px;font-weight:500;letter-spacing:-.02em;line-height:1.12;color:var(--ink);text-align:left;',
      text: str(k.company) || 'Naamloze klant',
      onclick: function () { ga(ctx, relatieRoute(model, 'klanten', k.id, null)); }
    });

    var personalia = ui.el('div', { style: 'min-width:0;' }, [
      ui.el('div', { style: 'display:flex;align-items:center;gap:16px;margin-bottom:14px;' }, [
        ui.avatar({
          naam: str(k.company),
          url: beeldBron(k.logoUrl),
          maat: 72,
          /* de ronde vinkbadge rechtsboven uit de mockup. Hij verschijnt
             ALLEEN als er echt niets openstaat, en draagt een woord —
             anders zou een groene bol de enige drager van de betekenis zijn
             (hoofdstuk 8). */
          badge: g.niveau === 'ok'
            ? { label: 'Op koers: geen openstaande vragen, geen openstaande facturen, contact binnen 30 dagen' }
            : null
        })
      ]),
      naamKnop,
      str(k.tagline) ? ui.el('p', {
        class: 'u-lees',
        style: 'margin-top:8px;',
        text: str(k.tagline)
      }) : null,
      /* contactpersoon met foto. clients.contact_name is een kolom op de
         klant en geen persoonsrecord; CP_DATA.clientContactAvatar legt uit
         waarom daar geen foto bij hoort te staan zolang dat zo is, en geeft
         daarom null terug — CP_UI.avatar toont dan de initialen. */
      str(k.contactName) ? ui.el('div', {
        style: 'display:flex;align-items:center;gap:11px;margin-top:18px;'
      }, [
        ui.avatar({ naam: str(k.contactName), url: beeldBron(k.contactAvatarUrl), maat: 36 }),
        ui.el('span', { style: 'min-width:0;' }, [
          ui.el('span', { class: 'u-row-title', style: 'display:block;font-size:15px;', text: str(k.contactName) }),
          str(k.email) ? ui.el('span', { class: 'u-row-sub', style: 'display:block;', text: str(k.email) }) : null
        ])
      ]) : null,
      ui.el('div', { style: 'margin-top:18px;' }, [
        ui.el('span', { class: 'u-kicker', style: 'display:block;', text: 'Klant sinds' }),
        ui.el('span', {
          style: 'font-size:15px;font-weight:500;color:var(--ink);',
          text: datum(model, k.createdAt) || 'Niet vastgelegd'
        }),
        str(k.country) ? ui.el('span', {
          class: 'u-row-sub', style: 'display:block;', text: str(k.country)
        }) : null
      ])
    ]);

    /* ---- kolom 2: twee stattegels met chevron ---- */
    var tegels = ui.el('div', { style: 'display:flex;flex-direction:column;gap:14px;min-width:0;' }, [
      tegelMetChevron(ui, ui.summaryCard({
        label: 'Lopende projecten',
        waarde: String(d.actieveProjecten.length),
        sub: d.projecten.length === d.actieveProjecten.length
          ? 'Alle projecten van deze klant lopen'
          : nlAantal(d.projecten.length, 'project', 'projecten') + ' in totaal, inclusief archief',
        onClick: function () { ga(ctx, '#/projecten'); }
      })),
      tegelMetChevron(ui, ui.summaryCard({
        label: 'Openstaand bedrag',
        waarde: euro(chart, d.openCents),
        toon: d.openCents > 0 ? 'wacht' : 'klaar',
        sub: d.openAantal
          ? nlAantal(d.openAantal, 'factuur staat open', 'facturen staan open')
          : 'Alles betaald',
        onClick: function () { ga(ctx, '#/financien?tab=facturen'); }
      }))
    ]);

    /* ---- kolom 3: het verloop ---- */
    var verloopKinderen = [
      ui.el('span', { class: 'u-kicker', style: 'display:block;', text: 'Gefactureerd per maand' })
    ];
    if (d.reeksTotaal > 0 && chart && fn(chart.sparkline)) {
      verloopKinderen.push(ui.el('div', { style: 'margin-top:10px;' }, chart.sparkline({
        reeks: d.reeks,
        xLabels: d.reeksLabels,
        breedte: 200,
        hoogte: 58,
        toon: 'ink',
        eindpunt: true,
        centen: true,
        label: 'Gefactureerd per maand'
      })));
      verloopKinderen.push(ui.el('span', {
        class: 'u-row-sub',
        style: 'display:block;margin-top:10px;',
        /* het bijschrift noemt de PERIODE en het TOTAAL: zonder die twee is
           een sparkline een sfeerlijn zonder betekenis */
        text: (d.reeksLabels[0] || '') + ' t/m ' + (d.reeksLabels[d.reeksLabels.length - 1] || '') +
          ' · ' + euro(chart, d.reeksTotaal) + ' in totaal'
      }));
    } else {
      verloopKinderen.push(ui.el('span', {
        class: 'u-row-sub',
        style: 'display:block;margin-top:10px;',
        text: 'Nog niets gefactureerd in de laatste zes maanden.'
      }));
    }
    var verloop = ui.el('div', { style: 'min-width:0;' }, verloopKinderen);

    /* ---- de rij actieve producten ---- */
    var bron = lijsten(ctx);
    var producten = d.actieveProjecten.slice(0, 3).map(function (p) {
      return ui.productRow({
        beeld: projectFoto(model, L(bron, 'media'), p.id),
        titel: str(p.name),
        /* hoofdstuk 5.5 zet onder de productnaam de KLANT. Binnen de kaart
           van diezelfde klant is dat een herhaling, dus staat de projectcode
           erbij — dat is het veld waarmee de eigenaar een project herkent. */
        sub: [str(p.code), str(k.company)].filter(function (x) { return !!x; }).join(' · '),
        onOpen: function () { ga(ctx, '#/projecten/' + encodeURIComponent(p.id)); }
      });
    });

    var productBlok = ui.el('div', null, [
      hairline(ui),
      ui.el('span', { class: 'u-kicker', style: 'display:block;margin-bottom:6px;', text: 'Actieve producten' }),
      producten.length
        ? ui.el('div', null, producten)
        : ui.emptyTile({
          icoon: 'projecten',
          titel: 'Geen lopend product',
          uitleg: 'Alle projecten van deze klant zijn afgerond of gearchiveerd.'
        })
    ]);

    /* ---- de kopregel van de kaart: stand links, ••• rechts ----
       .u-hero-kop is de bestaande vorm voor "iets links, iets rechts" boven
       in een grote kaart (flex, space-between). Links de lifecycle, want die
       verklaart welke acties het menu draagt — een slapende klant is de
       enige die "Check-in-mail sturen" krijgt. */
    var rijMenu = klantRijMenu(ctx, d, lc);
    var kopRegel = ui.el('div', { class: 'u-hero-kop' }, [
      ui.el('span', {
        class: 'u-kicker',
        text: (lc ? lc.label : '') + ((lc && lc.handmatig) ? ' (handmatig gezet)' : '')
      }),
      rijMenu.length ? ui.contextMenu({
        knop: { titel: 'Meer acties bij ' + (str(k.company) || 'deze klant') },
        items: rijMenu,
        uitlijning: 'rechts'
      }).el : null
    ]);

    var kaart = ui.el('article', {
      class: 'u-hero',
      'aria-label': 'Klant ' + str(k.company)
    }, [
      kopRegel,
      ui.el('div', {
        /* het driekolomsraster van deze kaart: personalia breed, tegels en
           verloop even breed. Onder 900px valt hij vanzelf terug op één
           kolom via de tweede regel hieronder — die staat in de style-tekst
           omdat een mediaquery niet in een style-attribuut past en er in
           admin-ui.css geen klasse voor deze ene kaart is. Vandaar
           minmax(0,1fr) met auto-fit: bij weinig ruimte wikkelen de kolommen
           zonder mediaquery. */
        style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;align-items:start;'
      }, [personalia, tegels, verloop]),
      productBlok
    ]);

    if (isGekozen) kaart.setAttribute('aria-current', 'true');
    return kaart;
  }

  /* De chevron rechtsboven op een stattegel. CP_UI.summaryCard heeft geen
     chevronslot; de mockup zet er wel een. De tegel is al een <button> met
     een naam, dus dit is puur beeld — icon() zet er zelf aria-hidden op. De
     twee inline eigenschappen zijn de enige manier om hem rechtsboven te
     krijgen zonder een klasse in admin-ui.css te zetten (dat bestand is niet
     van deze bouw). Genoteerd in het rapport. */
  function tegelMetChevron(ui, tegel) {
    if (!isNode(tegel)) return tegel;
    tegel.style.position = 'relative';
    var chev = ui.icon('chevron', 18);
    chev.setAttribute('class', 'u-row-chevron');
    chev.setAttribute('style', 'position:absolute;top:22px;right:20px;');
    tegel.appendChild(chev);
    return tegel;
  }

  /* ---- de compacte klantkaart (spec 5.5) ------------------------------
     "Een klant zonder bijzonderheden krijgt de compacte variant met één
     statusregel." Eén regel, en die regel bestaat uit feiten: de stand, het
     aantal lopende projecten en sinds wanneer deze klant er is. */
  function klantKaartCompact(ctx, ui, model, d, isGekozen, lc) {
    var k = d.klant;
    var g = d.gezondheid;

    var feiten = [];
    feiten.push(nlAantal(d.actieveProjecten.length, 'lopend project', 'lopende projecten'));
    feiten.push(d.facturen.length
      ? nlAantal(d.facturen.length, 'factuur', 'facturen')
      : 'nog geen facturen');
    if (k.createdAt) feiten.push('klant sinds ' + datum(model, k.createdAt));

    /* de lifecycle vooraan: hij verklaart waarom deze rij wel of geen
       check-in-mail in zijn ••• heeft (zie klantRijMenu) */
    var statusRegel = [(lc ? lc.label : ''), g.label]
      .filter(function (x) { return !!x; }).concat(feiten).join(' · ');

    var rijMenu = klantRijMenu(ctx, d, lc);

    var rij = ui.entityRow({
      thumb: beeldBron(k.logoUrl) || undefined,
      titel: str(k.company) || 'Naamloze klant',
      sub: [str(k.tagline), str(k.contactName), str(k.country)]
        .filter(function (x) { return !!x; }).join(' · '),
      /* de ENE statusregel: stip plus woord plus de feiten erachter */
      volgendeActie: statusRegel,
      chips: [ui.statusDot({ toon: g.toon, label: g.label })],
      /* met een ••• wordt de rij een <div> met één klikknop eromheen in
         plaats van één grote <button> — dat is de enige geldige HTML voor
         een knop in een rij, en de hele rij blijft klikbaar. Precies wat de
         mappingtabel met "de rij wordt volledig klikbaar" bedoelt. */
      menu: rijMenu.length ? rijMenu : undefined,
      onOpen: function () { ga(ctx, relatieRoute(model, 'klanten', k.id, null)); }
    });

    var kaart = ui.entityList([rij]);
    if (isGekozen) kaart.setAttribute('aria-current', 'true');
    return kaart;
  }

  /* ============================================================
     5b. HET KLANTDOSSIER — ZES TABS (spec 5.5, fase 6 van het migratieplan)

     Tot deze ronde was dit één samenvattingspagina zonder tabs en zonder één
     enkele bewerkactie: leesbaar, niet bewerkbaar. De veertien blokken uit
     de mappingtabel staan hier terug op hun nieuwe plek, elk met de haak die
     er in beheer.html al bij hoorde:

       Overzicht      samenvattingskaarten · gezondheid · notities
       Projecten      de projecten van deze klant · nieuw project
       Facturen       dezelfde factuurrij als Financiën, dezelfde acties
       Communicatie   contactpersonen · portaaltaal · zes mailvoorkeuren ·
                      laatste klantmails
       Activiteit     contactmomenten (toevoegen en afvinken) ·
                      portaalgebruik · de samengevoegde tijdlijn
       Details        contactkaart · toegang en veiligheid

     DE TABSLEUTEL KOMT UIT DE ROUTE (#/relaties/klanten/<id>/<tab>) en niet
     uit een variabele. Een tweede tekening van dezelfde route geeft daarmee
     exact hetzelfde scherm, en een tab is deelbaar en overleeft F5.

     DRIE VELDEN SLAAN DIRECT OP, EN DAT BLIJFT ZO: de notities (het enige
     veld in de app dat op blur opslaat), de portaaltaal en de zes
     mailvoorkeuren. Dat is de bestaande afsluiter van díé drie — ze zijn een
     handeling en geen formulier, en de haken zijn er ook zo op gebouwd
     (mailvoorkeurZetten geeft zijn belofte terug zodat het scherm zijn eigen
     bevestiging kan tonen). Beslissing 2.7 kent om precies dezelfde reden
     twee uitzonderingen op het omgekeerde opslagmodel.
     ============================================================ */

  var KLANT_TABS = [
    { key: 'overzicht', label: 'Overzicht' },
    { key: 'projecten', label: 'Projecten' },
    { key: 'facturen', label: 'Facturen' },
    { key: 'communicatie', label: 'Communicatie' },
    { key: 'activiteit', label: 'Activiteit' },
    { key: 'details', label: 'Details' }
  ];

  /* Een sectie: sectiekop van 20px met rechts één stille actie, daaronder de
     inhoud. Dezelfde vorm als sectionBlock() in beheer.html, nu uit
     CP_UI.sectionHead. */
  function sectie(ui, kopSpec, inhoud) {
    var kinderen = [ui.sectionHead(kopSpec)];
    arr(isNode(inhoud) ? [inhoud] : inhoud).forEach(function (n) {
      if (isNode(n)) kinderen.push(n);
    });
    return ui.el('section', null, kinderen);
  }

  /* het zichtbare label van een klanttab, voor de melding bij een
     deelnavigatie: "projecten" is een sleutel, "Projecten" is wat er staat */
  function klantTabLabel(key) {
    for (var i = 0; i < KLANT_TABS.length; i++) {
      if (KLANT_TABS[i].key === str(key)) return KLANT_TABS[i].label;
    }
    return str(key);
  }

  /* Een kaart met binnenruimte. .u-card zet bewust geen padding (hij is ook
     de wikkel van .u-rows, waar de rijen hun eigen ruimte dragen); een kaart
     met vrije inhoud heeft die wél nodig. Dezelfde maat als railKaart. */
  function padKaart(ui, kinderen, extraKlasse) {
    return ui.el('div', {
      class: 'u-card' + (str(extraKlasse) ? ' ' + str(extraKlasse) : ''),
      style: 'padding:20px 22px;'
    }, arr(isNode(kinderen) ? [kinderen] : kinderen).filter(isNode));
  }

  /* Een regel met een kicker erboven — de "kale feiten"-vorm die het oude
     klantdossier voor gezondheid en portaalgebruik gebruikte (.hfact). */
  function feitRegel(ui, label, waarde) {
    return ui.el('div', { style: 'padding:8px 0;border-top:1px solid var(--line-2);' }, [
      ui.el('span', { class: 'u-kicker', style: 'display:block;margin-bottom:2px;', text: str(label) }),
      ui.el('span', { style: 'font-size:15px;color:var(--ink);', text: str(waarde) })
    ]);
  }

  /* BRON: clientLifecycle() plus lifecycleAuto() in beheer.html, met exact
     dezelfde regels — een handmatige keuze in settings.lifecycleOverrides
     wint; anders: geen project = lead, een niet-gearchiveerd project =
     actief, alles gearchiveerd en 90 dagen of langer stil = slapend. Intake
     en Gearchiveerd bestaan alleen als handmatige keuze. */
  function klantLifecycle(ctx, d, vandaag) {
    var model = MODEL(ctx);
    var bron = lijsten(ctx);
    var overrides = opt(opt(bron.settings).lifecycleOverrides);

    var autoKey = 'lead';
    if (d.projecten.length) {
      var lopend = false;
      d.projecten.forEach(function (p) { if (p && p.status !== 'archived') lopend = true; });
      if (lopend) {
        autoKey = 'actief';
      } else {
        var laatste = d.gezondheid.laatste ? d.gezondheid.laatste.at : null;
        d.projecten.forEach(function (p) {
          if (p && p.archivedAt && (!laatste || str(p.archivedAt) > str(laatste))) laatste = p.archivedAt;
        });
        var stil = laatste ? dagenTussen(model, laatste, vandaag) : null;
        autoKey = (stil === null || stil >= 90) ? 'slapend' : 'actief';
      }
    }

    var hand = str(overrides[d.klant.id]);
    var geldig = false;
    LIFECYCLES.forEach(function (l) { if (l.key === hand) geldig = true; });

    return {
      key: geldig ? hand : autoKey,
      autoKey: autoKey,
      handmatig: geldig,
      label: lifecycleLabel(geldig ? hand : autoKey)
    };
  }

  /* de rijen uit een lijst die bij DEZE klant horen */
  function vanKlant(rijen, clientId) {
    return arr(rijen).filter(function (r) { return r && r.clientId === clientId; });
  }
  function vanProjecten(rijen, pids) {
    return arr(rijen).filter(function (r) { return r && pids[r.projectId]; });
  }

  /* DE REGELS DIE DE KLANT ZELF SCHREEF, uit het toegangslogboek.
     Bewust NIET het jongste item uit de samengevoegde tijdlijn: daar staan
     ook mails die WIJ stuurden en fasewissels die wij deden. "Actief in het
     portaal" mag alleen op een handeling van de klant slaan — anders zegt
     het dossier dat de uitnodiging is aangekomen omdat wíj iets gedaan
     hebben. Zelfde bron en zelfde voorwaarde als computeClientHealth in
     beheer.html gebruikt (actor === 'client'). */
  function klantPortaalRegels(ctx, d) {
    var pids = indexOp(d.projecten, 'id');
    return vanProjecten(L(lijsten(ctx), 'log'), pids).filter(function (r) {
      return r && r.actor === 'client';
    });
  }
  function laatsteKlantMoment(regels) {
    var laatst = null;
    arr(regels).forEach(function (r) {
      if (r && r.createdAt && (!laatst || str(r.createdAt) > str(laatst))) laatst = r.createdAt;
    });
    return laatst;
  }

  function klantDossierScherm(ctx, ui, chart, model, d, vandaag) {
    var route = opt(opt(ctx).route);
    var k = d.klant;
    var lc = klantLifecycle(ctx, d, vandaag);

    /* CP_MODEL.tabOf is de ENIGE manier om een tab te lezen: een
       entiteitstab staat in het pad, een werkgebiedtab in de query. */
    var tab = 'overzicht';
    if (model && fn(model.tabOf)) tab = str(model.tabOf(route, 'overzicht'));
    else tab = str(route.tab) || 'overzicht';
    var geldig = false;
    KLANT_TABS.forEach(function (t) { if (t.key === tab) geldig = true; });
    if (!geldig) tab = 'overzicht';

    var paneelId = 'klantdossier-paneel';
    var kop = klantDossierKop(ctx, ui, model, d, lc);

    var tabSpecs = KLANT_TABS.map(function (t) {
      var spec = { key: t.key, label: t.label };
      /* alleen een telling waar een telling iets betekent; "Details 0" is
         geen informatie maar ruis */
      if (t.key === 'projecten') spec.count = d.projecten.length;
      if (t.key === 'facturen') spec.count = d.facturen.length;
      if (t.key === tab) spec.panelId = paneelId;
      return spec;
    });

    var hoofd = [];
    hoofd.push(ui.tabs({
      tabs: tabSpecs,
      actief: tab,
      label: 'Onderdelen van dit klantdossier',
      onKies: function (key, t) {
        if (key === tab) return;
        deelGa(ctx, relatieRoute(model, 'klanten', k.id, null, key), str(t && t.label));
      }
    }));

    hoofd.push(ui.el('div', {
      id: paneelId,
      role: 'tabpanel',
      'aria-labelledby': paneelId + '-tab',
      tabindex: '0',
      style: 'display:flex;flex-direction:column;gap:26px;'
    }, klantTabInhoud(ctx, ui, chart, model, d, vandaag, tab, lc)));

    var rail = klantRail(ctx, ui, chart, model, d, true, vandaag);
    return pagina(ui, kop, hoofd, rail);
  }

  /* ---- de kop van het dossier -----------------------------------------
     De zeven elementen die vandaag naast elkaar in de klantkop staan gaan
     naar PageHeader plus •••. In de kop blijven precies twee dingen die de
     opdracht daar noemt: de lifecycle-keuze en Bekijk als klant. De rest —
     bewerken, nieuw project, uitnodigen, contactmoment, exportpakket en het
     afronden — zit achter het •••, met de gevaarlijke actie onderin in de
     kritieke kleur.

     GEEN EXTRA BEVESTIGING OP "KLANT AFRONDEN". Die haak opent de
     vijfstappen-dialoog, en dáár kies je elke stap expliciet — dat ís de
     bevestiging. Een inline "weet je het zeker" ervoor zou een bevestiging
     zijn voor het OPENEN van een venster. */
  function klantDossierKop(ctx, ui, model, d, lc) {
    var k = d.klant;

    var lcHaak = haak(ctx, 'lifecycleZetten');
    var statusRegel;
    if (lcHaak) {
      var keuze = ui.el('select', {
        class: 'input',
        style: 'max-width:230px;',
        'aria-label': 'Lifecycle van ' + (str(k.company) || 'deze klant')
      });
      keuze.appendChild(ui.el('option', {
        value: '', text: 'Automatisch (' + lifecycleLabel(lc.autoKey) + ')'
      }));
      LIFECYCLES.forEach(function (l) {
        keuze.appendChild(ui.el('option', { value: l.key, text: l.label }));
      });
      keuze.value = lc.handmatig ? lc.key : '';
      keuze.addEventListener('change', function () {
        /* een lege waarde zet hem terug op automatisch — precies wat de lege
           keuze in de oude lijst deed. De haak schrijft en ververst zelf. */
        lcHaak(k, keuze.value);
      });
      statusRegel = ui.el('div', {
        style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;'
      }, [
        ui.statusDot({
          toon: d.gezondheid.toon,
          label: lc.label + (lc.handmatig ? ' (handmatig)' : '') + ' · ' + d.gezondheid.label
        }),
        keuze
      ]);
    } else {
      statusRegel = ui.statusDot({ toon: d.gezondheid.toon, label: lc.label + ' · ' + d.gezondheid.label });
    }

    return ui.pageHeader({
      crumbs: [
        { label: 'Relaties', route: relatieRoute(model, 'klanten', null, null) },
        { label: 'Klanten', route: relatieRoute(model, 'klanten', null, null) },
        { label: str(k.company) || 'Klant' }
      ],
      kicker: str(k.tagline) || (str(k.country) || null),
      titel: str(k.company) || 'Naamloze klant',
      status: statusRegel,
      actiePlaats: 'rechts',
      primair: haakKnop(ctx, 'bekijkAlsKlant', 'Bekijk als klant', 'extern', k,
        'Opent het klantportaal zoals deze klant het ziet'),
      menuTitel: 'Meer acties bij ' + (str(k.company) || 'deze klant'),
      menu: menuLijst([
        haakItem(ctx, 'klantBewerken', 'Klantgegevens bewerken', 'potlood', k),
        haakItem(ctx, 'nieuwProject', 'Nieuw project', 'plus', k),
        haakItem(ctx, 'contactmomentToevoegen', 'Contactmoment vastleggen', 'kalender', k),
        haakItem(ctx, 'contactpersoonToevoegen', 'Contactpersoon toevoegen', 'team', k),
        { scheiding: true },
        haakItem(ctx, 'klantUitnodigen',
          k.invitedAt ? 'Welkomstmail opnieuw sturen' : 'Uitnodigen voor het portaal', 'mail', k),
        (lc.key === 'slapend') ? haakItem(ctx, 'checkInMail', 'Check-in-mail sturen', 'mail', k) : null,
        { scheiding: true },
        haakItem(ctx, 'exportpakket', 'Exportpakket (dossier)', 'bestand', k),
        haakItem(ctx, 'klantOffboarden', 'Klant afronden…', 'sluiten', k, { gevaarlijk: true })
      ])
    });
  }

  function klantTabInhoud(ctx, ui, chart, model, d, vandaag, tab, lc) {
    if (tab === 'projecten') return klantTabProjecten(ctx, ui, model, d);
    if (tab === 'facturen') return klantTabFacturen(ctx, ui, chart, model, d);
    if (tab === 'communicatie') return klantTabCommunicatie(ctx, ui, model, d);
    if (tab === 'activiteit') return klantTabActiviteit(ctx, ui, model, d, vandaag);
    if (tab === 'details') return klantTabDetails(ctx, ui, model, d, lc);
    return klantTabOverzicht(ctx, ui, chart, model, d, vandaag);
  }

  /* ---- tab Overzicht --------------------------------------------------- */
  function klantTabOverzicht(ctx, ui, chart, model, d, vandaag) {
    var k = d.klant;
    var bron = lijsten(ctx);
    var g = d.gezondheid;
    var pids = indexOp(d.projecten, 'id');

    /* de eerstvolgende ETA van deze klant: dezelfde berekening als de oude
       klantkop-tegel — de eerste nog niet geleverde zending met een venster
       dat nog niet verstreken is, anders het meest recente dat wél verstreek */
    var volgendeEta = null, verlopenEta = null;
    vanProjecten(L(bron, 'shipments'), pids).forEach(function (s) {
      if (!s || s.deliveredAt || !s.etaWindowEnd) return;
      var eind = str(s.etaWindowEnd).slice(0, 10);
      if (eind >= vandaag) {
        if (!volgendeEta || eind < str(volgendeEta.etaWindowEnd).slice(0, 10)) volgendeEta = s;
      } else if (!verlopenEta || eind > str(verlopenEta.etaWindowEnd).slice(0, 10)) {
        verlopenEta = s;
      }
    });
    /* IN DE TEGEL ÉÉN DATUM, IN DE SUBREGEL HET HELE VENSTER. Een tegelgetal
       is 34px; twee volledige datums met een streepje ertussen lopen daar
       over drie regels en zijn dan geen getal meer maar een alinea. Het
       venster zelf gaat niet verloren — het staat eronder. */
    var etaTekst = volgendeEta
      ? datum(model, volgendeEta.etaWindowEnd)
      : (verlopenEta ? datum(model, verlopenEta.etaWindowEnd) : '—');
    var etaSub = volgendeEta
      ? ('Venster ' + datum(model, volgendeEta.etaWindowStart) + ' – ' + datum(model, volgendeEta.etaWindowEnd))
      : (verlopenEta ? 'Venster verstreken zonder levering' : 'Geen lopend zendingsvenster');

    function naarTab(key) {
      return function () {
        deelGa(ctx, relatieRoute(model, 'klanten', k.id, null, key), klantTabLabel(key));
      };
    }

    var tegels = ui.summaryRow([
      ui.summaryCard({
        label: 'Projecten',
        waarde: String(d.projecten.length),
        sub: nlAantal(d.actieveProjecten.length, 'project loopt', 'projecten lopen'),
        onClick: naarTab('projecten')
      }),
      ui.summaryCard({
        label: 'Openstaand bedrag',
        waarde: euro(chart, d.openCents),
        toon: g.facturen30 ? 'kritiek' : (d.openCents > 0 ? 'wacht' : 'klaar'),
        sub: d.openAantal
          ? nlAantal(d.openAantal, 'factuur staat open', 'facturen staan open')
          : 'Alles betaald',
        onClick: naarTab('facturen')
      }),
      ui.summaryCard({
        label: 'Laatste contact',
        waarde: (g.contactDagen === null) ? '—'
          : (g.contactDagen === 0 ? 'vandaag' : nlAantal(g.contactDagen, 'dag geleden', 'dagen geleden')),
        toon: (g.contactDagen === null || g.contactDagen > 30) ? 'wacht' : 'klaar',
        /* de subregel noemt WANNEER, niet WAT: de hele tekst van de laatste
           gebeurtenis maakt van een tegel een alinea. Die tekst staat
           voluit in de rail en op de tab Activiteit. */
        sub: g.laatste ? datumTijd(model, g.laatste.at) : 'Nog geen contact vastgelegd',
        onClick: naarTab('activiteit')
      }),
      ui.summaryCard({
        label: 'Eerstvolgende ETA',
        waarde: etaTekst,
        toon: (!volgendeEta && verlopenEta) ? 'kritiek' : 'neutraal',
        sub: etaSub,
        onClick: naarTab('projecten')
      })
    ]);

    /* --- gezondheid: kale feiten, geen verzonnen score --- */
    var gezond = sectie(ui, {
      kicker: 'Kale feiten, geen score',
      titel: 'Gezondheid'
    }, padKaart(ui, [
      ui.el('div', { style: 'margin-bottom:6px;' },
        ui.statusDot({ toon: g.toon, label: g.label })),
      feitRegel(ui, 'Open vragen ouder dan 2 dagen', String(g.oudeVragen)),
      feitRegel(ui, 'Openstaande facturen van 30 dagen of ouder', String(g.facturen30)),
      feitRegel(ui, 'Laatste contact',
        g.laatste ? datumTijd(model, g.laatste.at) : 'nog geen contact vastgelegd'),
      feitRegel(ui, 'Openstaand bedrag', euro(chart, d.openCents))
    ]));

    var blokken = [tegels, gezond];

    /* --- notities: het enige veld in de app dat op blur opslaat --- */
    var notitieHaak = haak(ctx, 'notitieOpslaan');
    if (notitieHaak) {
      var bevestiging = ui.el('span', {
        class: 'u-row-sub',
        'aria-live': 'polite',
        style: 'display:block;margin-top:8px;min-height:18px;'
      });
      var vlak = vlakInvoer(ui, 'klant-notities', str(k.notes),
        'Alles wat je over deze klant wilt onthouden — alleen zichtbaar in het beheer.');
      vlak.setAttribute('aria-label', 'Notities bij ' + (str(k.company) || 'deze klant'));
      var laatstOpgeslagen = str(k.notes);
      vlak.addEventListener('blur', function () {
        if (vlak.value === laatstOpgeslagen) return;
        laatstOpgeslagen = vlak.value;
        notitieHaak(k, vlak.value);
        bevestiging.textContent = 'Opgeslagen.';
      });
      blokken.push(sectie(ui, {
        kicker: 'Alleen zichtbaar in het beheer',
        titel: 'Notities'
      }, padKaart(ui, [
        vlak,
        bevestiging,
        ui.el('p', {
          class: 'u-row-sub',
          style: 'margin-top:2px;',
          text: 'Deze notitie slaat op zodra je het veld verlaat — dat is de bestaande afsluiter van dit ene veld en dat blijft zo.'
        })
      ])));
    }

    return blokken;
  }

  /* ---- tab Projecten --------------------------------------------------- */
  function klantTabProjecten(ctx, ui, model, d) {
    var bron = lijsten(ctx);
    var k = d.klant;

    var rijen = d.projecten.map(function (p) {
      var afgerond = (model && fn(model.isFinished)) ? model.isFinished(p) : false;
      var gearchiveerd = (model && fn(model.isArchived)) ? model.isArchived(p) : (p.status === 'archived');
      return ui.entityRow({
        thumb: projectFoto(model, L(bron, 'media'), p.id) || undefined,
        titel: str(p.name),
        sub: [str(p.code), datum(model, p.createdAt)].filter(function (x) { return !!x; }).join(' · '),
        chips: [ui.statusChip({
          label: gearchiveerd ? 'Gearchiveerd' : (afgerond ? 'Afgerond' : 'Loopt'),
          toon: gearchiveerd ? 'neutraal' : (afgerond ? 'klaar' : 'nu')
        })],
        onOpen: function () { ga(ctx, '#/projecten/' + encodeURIComponent(p.id)); }
      });
    });

    var nieuw = haakKnop(ctx, 'nieuwProject', 'Nieuw project', 'plus', k);

    return [sectie(ui, {
      titel: 'Projecten',
      telling: d.projecten.length,
      actie: nieuw ? knopUit(ui, nieuw, 'klein') : null
    }, ui.entityList(rijen, {
      leegTitel: 'Nog geen project',
      leegUitleg: 'Deze klant heeft nog geen project in het beheer.'
    }))];
  }

  /* ---- tab Facturen ----------------------------------------------------
     De tab die het migratieplan als nieuw aanwijst: de gegevens werden al
     geladen, ze werden alleen nergens getoond. Exact dezelfde rij als op
     Financiën — inclusief de primaire actie uit de statusvertaler — want een
     tweede factuurrij zou een tweede lezing van dezelfde status zijn. */
  function klantTabFacturen(ctx, ui, chart, model, d) {
    var bron = lijsten(ctx);
    var projecten = indexOp(L(bron, 'projects'), 'id');
    var klanten = indexOp(L(bron, 'clients'), 'id');

    var lijst = d.facturen.slice(0).sort(function (a, b) {
      var x = str(a.inv.createdAt), y = str(b.inv.createdAt);
      if (x > y) return -1;
      if (x < y) return 1;
      return str(a.inv.id) < str(b.inv.id) ? -1 : 1;
    });

    /* dezelfde meldingen als op Financiën (0021), één keer opgezocht */
    var meldingIndex = meldingIndexVan(ctx);
    var rijen = lijst.map(function (f) {
      return factuurRij(ctx, ui, chart, model, f, projecten, klanten, meldingIndex[f.inv.id] || []);
    });

    return [sectie(ui, {
      kicker: 'Zelfde rij en zelfde acties als op Financiën',
      titel: 'Facturen',
      telling: lijst.length,
      actie: {
        label: 'Alle facturen',
        ico: 'chevron',
        onClick: function () { ga(ctx, '#/financien?tab=facturen'); }
      }
    }, ui.entityList(rijen, {
      leegTitel: 'Nog geen facturen',
      leegUitleg: 'Een factuur ontstaat vanuit een project: automatisch bij een betaalfase op akkoord, of met de hand.'
    }))];
  }

  /* ---- de contactpersonen van een klant --------------------------------
     Mappingtabel: "Contactpersonen met mailcategorieën → tab Communicatie".

     WAAROM ER VIER NAMEN WORDEN GEPROBEERD, EN WAAROM ÉÉN ERVAN ANDERS
     TELT. In deze codebase heten twee verschillende dingen ergens
     `contacts`: DS.listContacts() levert de contactPERSONEN van een klant,
     en CP_MODEL.mergeActivity noemt zijn contactMOMENTEN-bron óók zo en
     geeft die naam voorrang. iaLaadLijsten() in beheer.html levert
     `contacts` daarom vandaag bewust LEEG af, zodat de echte momenten niet
     uit de activiteitentijdlijn geduwd worden — en dat is precies de reden
     dat deze lijst vandaag niet getekend kan worden: de personen zitten
     onder geen enkele naam in de meegeleverde verzamelingen.

     De drie eerste namen kunnen niets ánders dragen dan personen. Staat een
     van die drie als array in de lijsten, dan IS de verzameling geleverd —
     ook als hij leeg is, want dan heeft deze klant er gewoon geen. De vierde
     naam is dubbelzinnig en telt daarom alleen mee zodra er werkelijk
     personen in blijken te zitten; een lege `contacts` zegt niets, en die
     stand mag hier nooit als "deze klant heeft er geen" gelezen worden.

     EN DAAROM WORDT ER OOK GEKEKEN WAT ER IN EEN RIJ ZIT. Een contactmoment
     draagt een tijdstip en een notitie, een contactpersoon een naam of een
     e-mailadres. Komt er per ongeluk een momentenlijst onder een van deze
     namen binnen, dan staat hier geen rij met een lege naam en een ••• dat
     de verkeerde rij zou bewerken. */
  var CONTACT_LIJSTNAMEN = ['contactPersonen', 'contactpersonen', 'clientContacts'];
  var CONTACT_LIJSTNAAM_DUBBEL = 'contacts';

  function lijktContactpersoon(r) {
    if (!isObj(r)) return false;
    if (!str(r.clientId)) return false;
    /* een contactmoment: wél een tijdstip, géén e-mailadres */
    if (str(r.at) && !str(r.email)) return false;
    return !!(str(r.name) || str(r.email));
  }

  /* {rijen, gevonden}. `gevonden` zegt of de SOORT geleverd wordt, en dat is
     iets anders dan of DEZE klant er een heeft. Zonder dat verschil zou het
     scherm "nog geen contactpersonen" zeggen terwijl het ze alleen niet
     krijgt — en dat is precies de zin die hier niet mag staan. */
  function contactBron(ctx) {
    var b = lijsten(ctx);
    var rijen = [];
    var gezien = {};
    var geleverd = false;

    /* true zodra de naam als array in de lijsten staat, ongeacht de inhoud */
    function neem(naam) {
      if (!Array.isArray(b[naam])) return false;
      b[naam].forEach(function (r) {
        if (!lijktContactpersoon(r)) return;
        /* dezelfde persoon kan onder twee namen meekomen; de id is de
           sleutel, en zonder id de combinatie die openContactModal ook
           gebruikt om iemand te herkennen */
        var sleutel = str(r.id) || (str(r.clientId) + '|' + str(r.email) + '|' + str(r.name));
        if (gezien[sleutel]) return;
        gezien[sleutel] = true;
        rijen.push(r);
      });
      return true;
    }

    CONTACT_LIJSTNAMEN.forEach(function (naam) { if (neem(naam)) geleverd = true; });
    var voorDubbel = rijen.length;
    neem(CONTACT_LIJSTNAAM_DUBBEL);
    if (rijen.length > voorDubbel) geleverd = true;

    return { rijen: rijen, gevonden: geleverd };
  }

  /* de aangevinkte categorieën als LABELS, uit dezelfde tabel als de
     mailvoorkeuren verderop op deze tab. Een lege lijst is geen ontbrekende
     waarde maar een echte stand: deze persoon ontvangt niets. */
  function contactCategorieLabels(ct) {
    var uit = [];
    arr(ct && ct.cats).forEach(function (sleutel) {
      var label = str(sleutel);
      MAIL_CATS.forEach(function (mc) { if (mc.key === str(sleutel)) label = mc.label; });
      if (label) uit.push(label);
    });
    return uit;
  }

  /* Eén rij: naam en rol, e-mail en taal, de categorieën, de actief-chip en
     het ••• met bewerken en verwijderen. Allebei die acties zijn bestaande
     haken (openContactModal en verwijderContactpersoon); er wordt hier geen
     venster nagebouwd. */
  function contactRij(ctx, ui, k, ct) {
    var actief = ct.active !== false;
    var cats = contactCategorieLabels(ct);

    var categorieRegel;
    if (!actief) {
      categorieRegel = 'Inactief — ontvangt niets' +
        (cats.length ? ' (aangevinkt: ' + cats.join(' · ') + ')' : '');
    } else if (cats.length) {
      categorieRegel = 'Ontvangt: ' + cats.join(' · ');
    } else {
      categorieRegel = 'Geen enkele categorie aangevinkt — deze persoon ontvangt niets';
    }

    var menu = menuLijst([
      /* de haak kent twee parameters: de klant en de contactpersoon */
      haakItem(ctx, 'contactpersoonBewerken', 'Contactpersoon bewerken', 'potlood', k, { tweede: ct }),
      { scheiding: true },
      /* GEEN TWEEDE BEVESTIGING. Die haak vraagt zelf om bevestiging, met de
         naam en het e-mailadres erin en met de gevolgen erbij. Een inline
         "weet je het zeker" ervoor zou een bevestiging zijn voor het openen
         van een bevestiging. */
      haakItem(ctx, 'contactpersoonVerwijderen', 'Contactpersoon verwijderen…', 'sluiten', ct, { gevaarlijk: true })
    ]);

    return ui.entityRow({
      /* STRENGER DAN beeldBron(): alleen een adres dat de browser meteen kan
         laden. admin_contacts.avatar_url is de kolom die CP_DATA.saveAvatar
         vult, en die bewaart een SLEUTEL in de bucket (of in IndexedDB in
         demomodus) — geen adres. Die sleutel ondertekenen is een belofte, en
         een scherm is synchroon. Een pad zonder schema levert hier daarom
         niets op en dan toont entityRow zijn initialen: de eerlijke stand,
         precies zoals CP_DATA.clientContactAvatar het voor de klantkaart
         uitlegt. */
      thumb: (/^(https?:|data:|blob:)/i.test(trim(ct.avatarUrl)) ? trim(ct.avatarUrl) : undefined),
      titel: str(ct.name)
        ? (str(ct.name) + (str(ct.role) ? ' — ' + str(ct.role) : ''))
        : (str(ct.email) || 'Contactpersoon zonder naam'),
      sub: [str(ct.email), str(ct.lang || 'nl').toUpperCase()]
        .filter(function (x) { return !!x; }).join(' · '),
      /* DE MAILCATEGORIEËN OP DE DERDE REGEL van de rij (.u-row-next). Die
         regel draagt in elke andere lijst "wat er met deze rij moet
         gebeuren", en hier draagt hij precies dezelfde soort informatie:
         wat deze rij dóét. Hij krijgt altijd tekst mee, want leeg zou er
         "Geen open actie" van maken en dat betekent hier iets anders. */
      volgendeActie: categorieRegel,
      chips: [ui.statusChip({
        label: actief ? 'Actief' : 'Inactief',
        toon: actief ? 'klaar' : 'neutraal'
      })],
      menu: menu.length ? menu : undefined
    });
  }

  /* ---- tab Communicatie ------------------------------------------------ */
  function klantTabCommunicatie(ctx, ui, model, d) {
    var k = d.klant;
    var bron = lijsten(ctx);
    var blokken = [];

    /* --- contactpersonen met mailcategorieën --- */
    var ctToevoegen = haakKnop(ctx, 'contactpersoonToevoegen', 'Contactpersoon toevoegen', 'plus', k);
    var ctBron = contactBron(ctx);
    var mijnContacten = opNaam(ctBron.rijen.filter(function (r) {
      return str(r.clientId) === str(k.id);
    }), 'name');

    var ctInhoud;
    if (ctBron.gevonden) {
      ctInhoud = [
        ui.entityList(mijnContacten.map(function (ct) {
          return contactRij(ctx, ui, k, ct);
        }), {
          leegTitel: 'Nog geen extra contactpersonen',
          leegUitleg: 'De vaste contactpersoon op de contactkaart ontvangt alles. Voeg iemand toe om per categorie te kiezen wie wat krijgt.'
        }),
        ui.el('p', {
          class: 'u-row-sub',
          style: 'margin-top:10px;',
          /* dit is geen belofte maar de bestaande werking: elke mailtrigger
             loopt langs alle actieve ontvangers van de bijbehorende
             categorie. Zonder deze regel lijkt een categorielijst een
             voorkeur die nergens op uitkomt. */
          text: 'Elke uitgaande klantmail gaat automatisch naar iedere actieve contactpersoon die de bijbehorende categorie aan heeft staan, naast de vaste contactpersoon op de contactkaart.'
        })
      ];
    } else {
      /* EERLIJK OVER EEN ECHT GAT. De rijen zijn gebouwd en de twee haken
         bestaan; wat ontbreekt is de lijst zelf. Toevoegen werkt hierboven
         wel volledig — die haak heeft de lijst niet nodig — en de bestaande
         contactpersonen blijven gewoon hun mails ontvangen. Er staat hier
         daarom geen lege lijst die suggereert dat deze klant er geen heeft. */
      ctInhoud = padKaart(ui, ui.emptyTile({
        icoon: 'team',
        titel: 'De contactpersonen worden nog niet aan dit scherm doorgegeven',
        uitleg: 'Toevoegen werkt hierboven volledig, inclusief de mailcategorieën, en wie er al staat blijft gewoon zijn mails ontvangen. Alleen de lijst zelf zit niet in de gegevens die dit scherm binnenkrijgt: de naam waaronder de personen zouden meekomen wordt daar door de contactmomenten van de tijdlijn bezet. Zodra ze onder hun eigen naam worden meegestuurd, staat deze lijst er vanzelf — met per rij de categorieën en het menu om te bewerken of te verwijderen. Er is dus niets kwijt: dit is een leveringskwestie in het beheer, geen ontbrekend gegeven.'
      }));
    }

    blokken.push(sectie(ui, {
      kicker: 'Wie krijgt welke klantmails',
      titel: 'Contactpersonen',
      telling: ctBron.gevonden ? mijnContacten.length : undefined,
      actie: ctToevoegen ? knopUit(ui, ctToevoegen, 'klein') : null
    }, ctInhoud));

    /* --- portaaltaal --- */
    var taalHaak = haak(ctx, 'portaaltaalZetten');
    var voorkeurHaak = haak(ctx, 'mailvoorkeurZetten');
    var comKinderen = [];
    var comBevestiging = ui.el('span', {
      class: 'u-row-sub',
      'aria-live': 'polite',
      style: 'display:block;margin-top:10px;min-height:18px;'
    });

    if (taalHaak) {
      var taalKeuze = keuzeInvoer(ui, 'klant-taal', PORTAAL_TALEN, str(k.portalLang) || 'nl',
        'Portaaltaal van ' + (str(k.company) || 'deze klant'));
      taalKeuze.addEventListener('change', function () {
        taalHaak(k, taalKeuze.value);
        comBevestiging.textContent = 'Portaaltaal opgeslagen.';
      });
      comKinderen.push(veldVak(ui, 'klant-taal', 'Portaaltaal', taalKeuze,
        'Het portaal opent standaard in deze taal; klantmails uit de sjablonenbibliotheek gebruiken NL of EN.'));
    }

    /* --- de zes mailvoorkeuren ---
       Een ONTBREKENDE voorkeur betekent AAN; alleen een expliciet uitgezette
       categorie staat als false in mailPrefs. Dat is de bestaande opslag en
       die verandert hier niet. */
    if (voorkeurHaak) {
      var prefs = isObj(k.mailPrefs) ? k.mailPrefs : {};
      var lijstVak = ui.el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:6px;' });
      MAIL_CATS.forEach(function (mc) {
        var vinkje = ui.el('input', { type: 'checkbox' });
        vinkje.checked = prefs[mc.key] !== false;
        vinkje.addEventListener('change', function () {
          var aan = vinkje.checked;
          vinkje.disabled = true;
          var belofte = voorkeurHaak(k, mc.key, aan);
          function klaar() {
            vinkje.disabled = false;
            comBevestiging.textContent = mc.label + (aan ? ' staan weer aan.' : ' staan uit.');
          }
          function mislukt() {
            /* de haak toont de fout zelf; hier alleen het vakje terugzetten,
               zodat het scherm niet iets anders beweert dan de opslag */
            vinkje.checked = !aan;
            vinkje.disabled = false;
            comBevestiging.textContent = 'Niet opgeslagen — de vorige stand staat er weer.';
          }
          if (belofte && fn(belofte.then)) belofte.then(klaar, mislukt);
          else klaar();
        });
        lijstVak.appendChild(ui.el('label', {
          class: 'checkline',
          style: 'display:flex;align-items:center;gap:10px;font-size:15px;color:var(--ink-2);'
        }, [vinkje, ui.el('span', { text: mc.label })]));
      });
      comKinderen.push(ui.el('div', { style: 'margin-top:18px;' }, [
        ui.el('span', { class: 'u-kicker', style: 'display:block;margin-bottom:4px;', text: 'Mailvoorkeuren per categorie' }),
        lijstVak,
        ui.el('p', {
          class: 'u-row-sub',
          style: 'margin-top:10px;',
          text: 'Een uitgezette categorie wordt gelogd als “niet verstuurd (voorkeur uit)” — er verdwijnt nooit stil iets.'
        })
      ]));
    }

    if (comKinderen.length) {
      comKinderen.push(comBevestiging);
      blokken.push(sectie(ui, {
        kicker: 'Slaat direct op — dit is een handeling, geen formulier',
        titel: 'Taal en mailvoorkeuren'
      }, padKaart(ui, comKinderen)));
    }

    /* --- laatste klantmails ---
       DE KEUZE UIT DE MAPPINGTABEL, HIER GEMAAKT: "Volledig mail-logboek"
       zette vandaag bewust géén klantfilter. In een KLANTdossier is dat de
       verkeerde kant op: je staat hier omdat je deze klant bekijkt. De
       doorlink zet daarom wél de klantfilter, en zegt dat ook in zijn label.
       De ongefilterde weergave blijft één klik verder, in de Activiteit
       zelf. */
    var mails = vanKlant(L(bron, 'mailLog'), k.id).slice(0).sort(function (a, b) {
      return str(a.createdAt) < str(b.createdAt) ? 1 : -1;
    }).slice(0, 5);

    var mailRijen = mails.map(function (r) {
      return ui.entityRow({
        thumb: false,
        titel: str(r.subject) || '—',
        sub: [str(r.to), str(r.category)].filter(function (x) { return !!x; }).join(' · '),
        meta: datumTijd(model, r.createdAt),
        chips: [ui.statusChip({
          label: str(r.status) || 'onbekend',
          toon: r.status === 'verzonden' ? 'klaar' : (r.status === 'fout' ? 'kritiek' : 'neutraal')
        })]
      });
    });

    blokken.push(sectie(ui, {
      kicker: 'Uit het mail-logboek',
      titel: 'Laatste klantmails',
      actie: {
        label: 'Alle mails van deze klant',
        ico: 'chevron',
        onClick: function () { ga(ctx, activiteitRoute(model, 'mail', { klant: k.id })); }
      }
    }, ui.entityList(mailRijen, {
      leegTitel: 'Nog geen klantmails gelogd',
      leegUitleg: 'Zodra er een mail naar deze klant uitgaat, staat hij hier met zijn bezorgstatus.'
    })));

    return blokken;
  }

  /* de route naar Activiteit, met de klant- of projectfilter erin. De
     grammatica (#/activiteit/<soort>?klant=…) is die van
     admin-schermen-beheer.js; hij staat hier één keer zodat er geen tweede
     versie van kan ontstaan. */
  function activiteitRoute(model, soort, params) {
    if (model && fn(model.buildRoute)) {
      return model.buildRoute({
        area: 'activiteit',
        tab: (str(soort) && str(soort) !== 'alles') ? str(soort) : null,
        params: opt(params)
      });
    }
    var p = opt(params);
    var q = [];
    Object.keys(p).forEach(function (sleutel) {
      q.push(encodeURIComponent(sleutel) + '=' + encodeURIComponent(str(p[sleutel])));
    });
    return '#/activiteit' + (str(soort) && str(soort) !== 'alles' ? '/' + encodeURIComponent(str(soort)) : '') +
      (q.length ? '?' + q.join('&') : '');
  }

  /* ---- tab Activiteit -------------------------------------------------- */
  function klantTabActiviteit(ctx, ui, model, d, vandaag) {
    var k = d.klant;
    var bron = lijsten(ctx);
    var blokken = [];

    /* --- contactmomenten: toevoegen en afvinken --- */
    var momenten = vanKlant(L(bron, 'contactMoments'), k.id).slice(0).sort(function (a, b) {
      return str(a.at) < str(b.at) ? 1 : -1;
    });
    var afvinkHaak = haak(ctx, 'contactmomentAfvinken');

    var momentRijen = momenten.map(function (mnt) {
      var chips = [];
      var soort = mnt.kind === 'call' ? 'Call'
        : (mnt.kind === 'whatsapp' ? 'WhatsApp' : (mnt.kind === 'mail' ? 'Mail' : 'Moment'));
      chips.push(ui.statusChip({ label: soort, toon: 'neutraal' }));
      if (mnt.remindAt) {
        chips.push(mnt.remindDone
          ? ui.statusChip({ label: 'Opgevolgd', toon: 'klaar' })
          : ui.statusChip({
            label: 'Herinner ' + datum(model, mnt.remindAt),
            toon: str(mnt.remindAt).slice(0, 10) <= vandaag ? 'wacht' : 'neutraal'
          }));
      }
      /* AFVINKEN STAAT IN HET ••• VAN DE RIJ, en alleen als er iets af te
         vinken is: een moment zonder openstaande herinnering heeft geen
         actie, en een menu met nul items hoort er niet te staan. */
      var menu = (mnt.remindAt && !mnt.remindDone)
        ? menuLijst([haakItem(ctx, 'contactmomentAfvinken', 'Opvolging afvinken', 'vinkje', mnt)])
        : [];
      return ui.entityRow({
        thumb: false,
        titel: str(mnt.note) || soort,
        sub: datumTijd(model, mnt.at),
        chips: chips,
        menu: menu.length ? menu : undefined
      });
    });

    var momentKnop = haakKnop(ctx, 'contactmomentToevoegen', 'Contactmoment vastleggen', 'plus', k);
    blokken.push(sectie(ui, {
      kicker: afvinkHaak ? 'Handmatig vastgelegd — de opvolging vink je hier af' : 'Handmatig vastgelegd',
      titel: 'Contactmomenten',
      telling: momenten.length,
      actie: momentKnop ? knopUit(ui, momentKnop, 'klein') : null
    }, ui.entityList(momentRijen, {
      leegTitel: 'Nog geen contactmomenten',
      leegUitleg: 'Een gebeld gesprek, een appje, een afspraak — met een herinnering erbij als je erop terug wilt komen.'
    })));

    /* --- portaalgebruik: kale feiten uit het toegangslogboek --- */
    var klantRegels = klantPortaalRegels(ctx, d);
    var perProject = {};
    klantRegels.forEach(function (r) { perProject[r.projectId] = (perProject[r.projectId] || 0) + 1; });
    var topId = null;
    Object.keys(perProject).forEach(function (pid) {
      if (!topId || perProject[pid] > perProject[topId]) topId = pid;
    });
    var topProject = topId ? (indexOp(d.projecten, 'id')[topId] || null) : null;
    var downloads = klantRegels.filter(function (r) {
      return r && r.assetKind === 'document' && r.action === 'download';
    }).length;

    blokken.push(sectie(ui, {
      kicker: 'Kale feiten uit het toegangslogboek',
      titel: 'Portaalgebruik',
      actie: {
        label: 'Bekijk in de activiteit',
        ico: 'chevron',
        onClick: function () { ga(ctx, activiteitRoute(model, 'klant', { klant: k.id })); }
      }
    }, padKaart(ui, [
      feitRegel(ui, 'Laatste klantactiviteit',
        laatsteKlantMoment(klantRegels)
          ? datumTijd(model, laatsteKlantMoment(klantRegels))
          : 'nog geen klantactiviteit gelogd'),
      feitRegel(ui, 'Meest bekeken project',
        topProject ? (str(topProject.name) + ' · ' + nlAantal(perProject[topId], 'logregel', 'logregels')) : '—'),
      feitRegel(ui, 'Documenten gedownload', String(downloads)),
      feitRegel(ui, 'Logregels totaal', String(klantRegels.length))
    ])));

    /* --- de samengevoegde tijdlijn ---
       ÉÉN BRON: CP_MODEL.mergeActivity via klantActiviteit(). Dat is
       beslissing 2.6 letterlijk — dezelfde gebeurtenis moet op alle vier de
       plekken dezelfde tekst en hetzelfde tijdstip hebben. */
    var feed = klantActiviteit(ctx, k.id, 25);
    blokken.push(sectie(ui, {
      kicker: 'Mails, vragen, fasewissels, zendingen en facturen door elkaar',
      titel: 'Tijdlijn',
      actie: {
        label: 'Volledige activiteit',
        ico: 'chevron',
        onClick: function () { ga(ctx, activiteitRoute(model, 'alles', { klant: k.id })); }
      }
    }, ui.timeline(feed, {
      leegTitel: 'Nog geen activiteit',
      leegUitleg: 'Zodra er iets gebeurt — een mail, een goedkeuring, een betaling — verschijnt het hier.'
    })));

    return blokken;
  }

  /* ---- tab Details ----------------------------------------------------- */
  function klantTabDetails(ctx, ui, model, d, lc) {
    var k = d.klant;
    var blokken = [];

    /* --- de contactkaart --- */
    var cellen = [
      { icoon: 'gebruiker', label: 'Contactpersoon', waarde: str(k.contactName) || '—' },
      { icoon: 'mail', label: 'E-mail', waarde: str(k.email) || '—' },
      { icoon: 'gebruiker', label: 'Telefoon', waarde: str(k.phone) || '—' },
      { icoon: 'locatie', label: 'Land', waarde: str(k.country) || '—' },
      { icoon: 'bestand', label: 'Btw-nummer', waarde: str(k.vatNumber) || 'niet vastgelegd' },
      { icoon: 'kalender', label: 'Klant sinds', waarde: datum(model, k.createdAt) || '—' }
    ];
    var bewerken = haakKnop(ctx, 'klantBewerken', 'Contactkaart bewerken', 'potlood', k);

    blokken.push(sectie(ui, {
      kicker: 'Bedrijf, contactpersoon, e-mail en telefoon',
      titel: 'Contactkaart',
      actie: bewerken ? knopUit(ui, bewerken, 'klein') : null
    }, padKaart(ui, [
      ui.metaGrid({ cellen: cellen }),
      str(k.vatNumber) ? null : ui.el('p', {
        class: 'u-row-sub',
        style: 'margin-top:14px;',
        text: 'Zonder btw-nummer kan een factuur met btw verlegd niet gepubliceerd worden.'
      })
    ])));

    /* --- toegang en veiligheid --- */
    var toegangKnoppen = [];
    var uitnodigen = haakKnop(ctx, 'klantUitnodigen',
      k.invitedAt ? 'Welkomstmail opnieuw sturen' : 'Nodig uit voor het portaal', 'mail', k);
    var herstel = haakKnop(ctx, 'toegangHerstellen', 'Stuur toegangsherstel-mail', 'mail', k);
    var intrekken = haakKnop(ctx, 'sessiesIntrekken', 'Alle sessies intrekken', 'sluiten', k);
    if (uitnodigen) toegangKnoppen.push(knopUit(ui, uitnodigen, 'klein'));
    if (herstel) toegangKnoppen.push(knopUit(ui, herstel, 'ghost klein'));
    if (intrekken) toegangKnoppen.push(knopUit(ui, intrekken, 'ghost klein'));

    /* "Uitgenodigd" springt vanzelf op "Actief" zodra de eerste échte
       klanthandeling in het toegangslogboek staat — dezelfde regel als het
       oude blok Toegang & veiligheid. */
    var eersteKlantmoment = laatsteKlantMoment(klantPortaalRegels(ctx, d));
    var portaalStand;
    if (eersteKlantmoment) {
      portaalStand = ui.statusDot({
        toon: 'klaar',
        label: 'Actief in het portaal · laatst gezien ' + datumTijd(model, eersteKlantmoment)
      });
    } else if (k.invitedAt) {
      portaalStand = ui.statusDot({ toon: 'extern', label: 'Uitgenodigd ' + datum(model, k.invitedAt) });
    } else {
      portaalStand = ui.statusDot({ toon: 'wacht', label: 'Nog niet uitgenodigd' });
    }

    blokken.push(sectie(ui, {
      kicker: 'Uitnodigen en portaalstatus',
      titel: 'Toegang & veiligheid'
    }, padKaart(ui, [
      portaalStand,
      toegangKnoppen.length
        ? ui.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;' }, toegangKnoppen)
        : ui.el('p', {
          class: 'u-row-sub', style: 'margin-top:12px;',
          text: 'De acties voor uitnodigen, toegangsherstel en sessies intrekken zijn niet aan dit scherm doorgegeven.'
        }),
      ui.el('p', {
        class: 'u-kicker',
        style: 'display:block;margin-top:16px;',
        text: 'Geen wachtwoorden zichtbaar in het beheer'
      })
    ])));

    /* --- de beheer-zone ---
       De twee acties uit het oude blok staan in het ••• van de kop, want dat
       is het ENE menu van deze context. Deze regel zegt waar ze staan, zodat
       niemand ze op de plek van gisteren zoekt. */
    blokken.push(sectie(ui, {
      kicker: 'Afronden en archiveren',
      titel: 'Beheer-zone'
    }, padKaart(ui, ui.el('p', {
      class: 'u-lees',
      text: (lc.key === 'gearchiveerd' ? 'Deze klant staat op gearchiveerd. ' : '') +
        'Klant afronden (de vijfstappen-dialoog: projecten archiveren, portaaltoegang intrekken, exportpakket samenstellen en de afscheidsmail) en het losse exportpakket staan in het ••• naast de titel van dit dossier.'
    }))));

    return blokken;
  }

  /* ---- de rail van de tab Klanten (spec 5.5) --------------------------- */
  function klantRail(ctx, ui, chart, model, d, detailModus, vandaag) {
    if (!d) {
      return [railKaart(ui, 'Klantdetail', ui.emptyTile({
        icoon: 'relaties',
        titel: 'Nog geen klant gekozen',
        uitleg: 'Kies een klant om zijn laatste contact en openstaande acties hier te zien.'
      }))];
    }

    var g = d.gezondheid;
    var uit = [];

    /* --- Laatste contact --- */
    var contactKinderen = [];
    if (g.laatste) {
      contactKinderen.push(ui.el('span', {
        style: 'display:block;font-size:15px;font-weight:500;color:var(--ink);',
        text: datumTijd(model, g.laatste.at)
      }));
      contactKinderen.push(ui.el('p', {
        class: 'u-sub', style: 'margin-top:6px;', text: str(g.laatste.detail)
      }));
      if (g.contactDagen !== null && model && fn(model.relativeDay)) {
        contactKinderen.push(ui.el('span', {
          class: 'u-row-sub', style: 'display:block;margin-top:6px;',
          text: model.relativeDay(g.laatste.at, ctx && ctx.nu)
        }));
      }
    } else {
      contactKinderen.push(ui.emptyTile({
        icoon: 'klok',
        titel: 'Nog geen contact vastgelegd',
        uitleg: 'Zodra er een mail, een vraag of een contactmoment binnenkomt, staat het hier.'
      }));
    }
    uit.push(railKaart(ui, 'Laatste contact', contactKinderen));

    /* --- Open acties --- */
    var openVragen = 0;
    var bron = lijsten(ctx);
    var pids = indexOp(d.projecten, 'id');
    L(bron, 'questions').forEach(function (q) {
      if (q && pids[q.projectId] && !q.answeredAt) openVragen += 1;
    });

    uit.push(railKaart(ui, 'Open acties', [
      railRegel(ui, 'Openstaande vragen', String(openVragen),
        openVragen ? ui.statusDot({ toon: 'wacht', label: nlAantal(openVragen, 'vraag', 'vragen') })
          : ui.statusDot({ toon: 'klaar', label: 'Geen' })),
      railRegel(ui, 'Vragen ouder dan 2 dagen', String(g.oudeVragen),
        g.oudeVragen ? ui.statusDot({ toon: 'kritiek', label: String(g.oudeVragen) })
          : ui.statusDot({ toon: 'klaar', label: 'Geen' })),
      railRegel(ui, 'Openstaande facturen', euro(chart, d.openCents),
        d.openAantal ? ui.statusDot({ toon: d.gezondheid.facturen30 ? 'kritiek' : 'wacht', label: euro(chart, d.openCents) })
          : ui.statusDot({ toon: 'klaar', label: 'Alles betaald' })),
      railRegel(ui, 'Facturen 30 dagen of ouder', String(g.facturen30),
        g.facturen30 ? ui.statusDot({ toon: 'kritiek', label: String(g.facturen30) })
          : ui.statusDot({ toon: 'klaar', label: 'Geen' })),
      ui.el('div', { style: 'margin-top:16px;' },
        ui.el('button', {
          type: 'button',
          class: 'u-btn breed',
          /* in de lijstweergave opent deze knop de klant; staat hij al open,
             dan is de enige zinnige bestemming terug naar de lijst */
          text: detailModus ? 'Alle klanten' : 'Open klant',
          onclick: function () {
            ga(ctx, relatieRoute(model, 'klanten', detailModus ? null : d.klant.id, null));
          }
        }, detailModus ? null : ui.icon('chevron', 18)))
    ]));

    /* --- in de detailweergave: de projecten van deze klant --- */
    if (detailModus) {
      var rijen = d.projecten.map(function (p) {
        var afgerond = model && fn(model.isFinished) ? model.isFinished(p) : false;
        var gearchiveerd = model && fn(model.isArchived) ? model.isArchived(p) : (p.status === 'archived');
        return ui.entityRow({
          thumb: projectFoto(model, L(bron, 'media'), p.id) || undefined,
          titel: str(p.name),
          sub: str(p.code),
          chips: [ui.statusChip({
            label: gearchiveerd ? 'Gearchiveerd' : (afgerond ? 'Afgerond' : 'Loopt'),
            toon: gearchiveerd ? 'neutraal' : (afgerond ? 'klaar' : 'nu')
          })],
          onOpen: function () { ga(ctx, '#/projecten/' + encodeURIComponent(p.id)); }
        });
      });
      uit.push(railKaart(ui, 'Projecten', ui.entityList(rijen, {
        leegTitel: 'Nog geen project',
        leegUitleg: 'Deze klant heeft nog geen project in het beheer.'
      })));
    }

    return uit;
  }

  /* ============================================================
     6. SCHERM — RELATIES, TAB FABRIEKEN (spec 5.6)

     Dit is grotendeels nieuw werk: een fabriek was tot 0020_beheer_ia.sql
     drie velden en tweeënvijftig regels scherm. De velden die de mockup
     toont (status, land, foto, specialisaties, de twee scores, de
     contactpersoon en de notities) bestaan sinds die migratie echt, en
     CP_DATA levert ze als één plat object — de splitsing over
     factories_partners en factory_private hoeft dit scherm niet te kennen.

     DE VERRIJKING KOMT UIT CP_DATA.listFactories()
     Die functie hangt aan elke fabriek `projecten`, `actieveProjecten`,
     `laatsteSamenwerking` en `koppelingBron`, inclusief de terugval voor
     oude rijen (de fabrieks-id op foto's en op NNN-vastleggingen). Draagt
     een fabrieksrij die velden niet — omdat een aanroeper de lijst rauw uit
     de opslag haalde — dan valt dit scherm terug op het ECHTE veld
     projects.factory_id alleen, en zegt het dat ook: de rail meldt dan dat
     de koppeling uit het veld komt. Nooit stil iets anders tonen.
     ============================================================ */

  function fabrieksProjecten(f, projecten) {
    /* de verrijkte vorm van CP_DATA.verrijkFabrieken wint altijd */
    if (Array.isArray(f.projecten)) return f.projecten;
    return arr(projecten).filter(function (p) {
      return p && p.factoryId === f.id;
    }).map(function (p) {
      return { id: p.id, name: str(p.name), status: str(p.status), clientId: p.clientId || null };
    });
  }

  function fabrieksDossier(ctx, f, model) {
    var bron = lijsten(ctx);
    var projecten = fabrieksProjecten(f, L(bron, 'projects'));
    var actief = projecten.filter(function (p) { return p && p.status !== 'archived'; });
    var aantalActief = (typeof f.actieveProjecten === 'number') ? f.actieveProjecten : actief.length;

    /* laatste samenwerking: het jongste ECHTE moment dat we hebben. CP_DATA
       rekent het uit over media.capturedAt en disclosures.disclosedAt; is
       dat veld er niet, dan doen we dezelfde twee bronnen hier, met dezelfde
       regel — de jongste dag wint, en zonder een van beide is het null. */
    var laatste = f.laatsteSamenwerking || null;
    if (!laatste) {
      var dag = null;
      function jonger(iso) {
        var d = (model && fn(model.dayISO)) ? model.dayISO(iso) : str(iso).slice(0, 10);
        if (!d) return;
        if (!dag || d > dag) dag = d;
      }
      L(bron, 'media').forEach(function (m) { if (m && m.factoryId === f.id) jonger(m.capturedAt || m.createdAt); });
      L(bron, 'disclosures').forEach(function (x) { if (x && x.factoryId === f.id) jonger(x.disclosedAt); });
      laatste = dag;
    }

    return {
      fabriek: f,
      projecten: projecten,
      actieveProjecten: actief,
      aantalActief: aantalActief,
      laatsteSamenwerking: laatste,
      koppelingBron: f.koppelingBron || (projecten.length ? 'veld' : null)
    };
  }

  function fabrieksStatus(data, f) {
    var key = str(f.status) || 'actief';
    var tabel = (data && Array.isArray(data.FABRIEK_STATUS)) ? data.FABRIEK_STATUS : [];
    for (var i = 0; i < tabel.length; i++) {
      if (tabel[i].key === key) {
        return {
          key: key,
          label: str(f.statusLabel) || str(tabel[i].label),
          /* de tonen in FABRIEK_STATUS heten ok/warn/stil; CP_UI.statusDot
             kent 'stil' niet en valt daar op neutraal terug — precies goed
             voor "gearchiveerd" */
          toon: str(tabel[i].toon)
        };
      }
    }
    return { key: key, label: str(f.statusLabel) || key || 'Onbekend', toon: 'neutraal' };
  }

  function schermFabrieken(ctx) {
    var ui = UI(ctx);
    if (!ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen.');
    var model = MODEL(ctx);
    var chart = CHART(ctx);
    var data = DATA(ctx);
    var bron = lijsten(ctx);
    var route = opt(opt(ctx).route);
    var params = opt(route.params);

    var fabrieken = opNaam(L(bron, 'factories'), 'name');
    var dossiers = fabrieken.map(function (f) { return fabrieksDossier(ctx, f, model); });

    /* zelfde regel als bij de klanten: een id dat niet bestaat is geen
       detail. Een gearchiveerde fabriek stil vervangen door de eerste uit de
       lijst zou het interne dossier van de VERKEERDE fabriek tonen — en daar
       staan inkoopprijzen in. */
    var gekozenId = str(route.id);
    var gevonden = null;
    dossiers.forEach(function (d) { if (d.fabriek.id === gekozenId) gevonden = d; });
    var onbekendId = (gekozenId && !gevonden) ? gekozenId : '';
    var detailModus = !!gevonden;
    var gekozen = gevonden || dossiers[0] || null;

    /* het formulier "Nieuwe fabriek" staat open volgens de ROUTE en niet
       volgens een variabele — anders zou een tweede tekening van hetzelfde
       scherm een ander resultaat geven (afspraak 3 bovenaan) */
    var nieuwOpen = str(params.nieuw) === '1';

    var paneelId = 'rel-fabrieken-paneel';

    /* DE KOP KENT TWEE STANDEN. In de lijst is de primaire actie "Nieuwe
       fabriek"; in het dossier is dat "Naam en regio bewerken" — de
       BESTAANDE dialoog openFactoryEditModal, die zijn eigen afsluiter
       draagt met auditregel, bewaard concept en ongedaan maken. Die twee
       velden staan daarom NIET in het formulier hieronder: een tweede
       invoerweg naast een dialoog die er al is, is een tweede bron van
       waarheid. Alles wat géén eigen dialoog heeft staat wél in het
       formulier. */
    var kop = ui.pageHeader({
      titel: 'Relaties',
      bijzin: 'Fabrieken',
      /* zie schermRelaties(): rechts uitgelijnd, zoals de mockup */
      actiePlaats: 'rechts',
      crumbs: detailModus && gekozen ? [
        { label: 'Relaties', route: relatieRoute(model, 'klanten', null, null) },
        { label: 'Fabrieken', route: relatieRoute(model, 'fabrieken', null, null) },
        { label: str(gekozen.fabriek.name) }
      ] : null,
      primair: detailModus
        ? (haakKnop(ctx, 'fabriekBewerken', 'Naam en regio bewerken', 'potlood', gekozen.fabriek,
          'Opent het bestaande venster voor naam en regio') || {
          label: 'Alle fabrieken',
          ico: 'terug',
          onClick: function () { ga(ctx, relatieRoute(model, 'fabrieken', null, null)); }
        })
        : {
          label: nieuwOpen ? 'Sluit formulier' : 'Nieuwe fabriek',
          ico: nieuwOpen ? 'sluiten' : 'plus',
          onClick: function () {
            ga(ctx, relatieRoute(model, 'fabrieken', null, nieuwOpen ? null : { nieuw: '1' }));
          }
        },
      menuTitel: detailModus
        ? ('Meer acties bij ' + str(gekozen.fabriek.name))
        : 'Meer acties op deze pagina',
      menu: detailModus ? menuLijst([
        {
          label: 'Alle fabrieken', ico: 'terug',
          onKies: function () { ga(ctx, relatieRoute(model, 'fabrieken', null, null)); }
        },
        { scheiding: true },
        /* ARCHIVEREN KRIJGT GEEN INLINE BEVESTIGING. De haak archiveert en
           zet er vijftien seconden lang "Maak ongedaan" naast — dezelfde
           keuze als bij een gearchiveerd project, en bewust: een undo die je
           ziet is een beter vangnet dan een vraag die je wegklikt. De
           kritieke kleur en de plek onderin het menu dragen de waarschuwing. */
        haakItem(ctx, 'fabriekArchiveren', 'Fabriek archiveren', 'sluiten', gekozen.fabriek,
          { gevaarlijk: true })
      ]) : []
    });

    var hoofd = [];
    hoofd.push(relatieTabs(ctx, ui, model, 'fabrieken', paneelId));

    var paneelKinderen = [];

    if (onbekendId) {
      paneelKinderen.push(ui.emptyState({
        titel: 'Deze fabriek staat niet in het beheer',
        uitleg: 'Het adres wijst naar fabriek ' + onbekendId + '. Die bestaat hier niet (meer) — hieronder staan de fabrieken die er wél zijn.'
      }));
    }

    if (nieuwOpen) paneelKinderen.push(nieuweFabriekFormulier(ctx, ui, model, data));

    /* --- de kaart met pins (spec 4.17 / 5.6) ---
       De pins krijgen hun naam én hun stad mee: CP_CHART.mapCard zoekt eerst
       op naam en dan op stad in CP_CITY_COORDS (portal/config.js), en dat
       zijn al geprojecteerde x/y-waarden uit de kaart van het klantportaal.
       Een fabriek zonder bekende stad wordt niet getekend maar wél in het
       aria-label genoemd — dat doet mapCard zelf. */
    if (!detailModus) {
      if (chart && fn(chart.mapCard) && fabrieken.length) {
        /* HET TAKJE VAN HOOFDSTUK 4.20 HOORT HIER.
           4.20 wijst precies vijf plekken aan: Cashflow, Instellingen,
           Fabrieken, het projectdetail en de bedrijfsprofielpreview. De
           andere vier stonden er al; Fabrieken was de enige die ontbrak.
           De kaartkaart is de plek waar de mockup hem zet: het is het
           grootste rustige vlak van dit scherm, en een takje op een
           fabrieksrij zou juist onrustig zijn.
           u-ornament-host is geen sier maar de voorwaarde: die klasse zet
           position:relative en overflow:hidden, en zonder allebei loopt het
           takje buiten de kaart door. Dezelfde bewaker als op de andere
           vier plekken, want zonder CP_CHART is er geen takje en moet de
           kaart gewoon door. */
        var kaartVak = ui.el('div', { class: 'u-card u-ornament-host', style: 'padding:18px;' },
          chart.mapCard({
            titel: 'Waar onze fabrieken staan',
            pins: dossiers.map(function (d) {
              var st = fabrieksStatus(data, d.fabriek);
              return { naam: str(d.fabriek.name), stad: str(d.fabriek.city), toon: st.toon };
            }),
            bijschrift: 'Schematische kaart op stadsniveau, zelf getekend — dit project laadt geen kaartdienst.',
            leegtekst: 'Nog geen fabriek met een bekende stad.'
          }));
        if (fn(chart.leafOrnament)) {
          kaartVak.appendChild(chart.leafOrnament({ hoek: 'rechtsboven', maat: 130 }));
        }
        paneelKinderen.push(kaartVak);
      }
    }

    var teTonen = detailModus && gekozen ? [gekozen] : dossiers;

    if (!teTonen.length) {
      paneelKinderen.push(ui.emptyState({
        titel: 'Nog geen fabrieken',
        uitleg: 'Een fabriek houdt vast wie er voor je maakt: status, land, specialisaties, de contactpersoon en je eigen oordeel over kwaliteit en doorlooptijd.',
        actie: {
          label: 'Nieuwe fabriek',
          onClick: function () { ga(ctx, relatieRoute(model, 'fabrieken', null, { nieuw: '1' })); }
        }
      }));
    } else {
      teTonen.forEach(function (d) {
        paneelKinderen.push(fabriekKaart(ctx, ui, chart, model, data, d, gekozen === d, detailModus));
      });
    }

    /* HET DOSSIERFORMULIER — de belofte van het nieuwe-fabriekformulier
       waargemaakt. Dat formulier zegt letterlijk dat je specialisaties, de
       contactpersoon en je oordeel over kwaliteit en doorlooptijd "daarna in
       het dossier aanvult"; tot deze ronde kon dat nergens. */
    var formulier = null;
    if (detailModus && gekozen) {
      formulier = fabriekDossierFormulier(ctx, ui, model, data, gekozen);
      paneelKinderen.push(formulier.el);
    }

    hoofd.push(ui.el('div', {
      id: paneelId,
      role: 'tabpanel',
      'aria-labelledby': paneelId + '-tab',
      tabindex: '0',
      style: 'display:flex;flex-direction:column;gap:16px;'
    }, paneelKinderen));

    var rail = fabriekRail(ctx, ui, model, data, gekozen, detailModus);

    var wortel = pagina(ui, kop, hoofd, rail);
    if (formulier) {
      /* de zwevende balk hoort BIJ de pagina en niet in de kolom: hij staat
         vast rechtsonder. Hij gaat daarom als laatste kind mee, en zijn
         stop() ruimt de onderrand van de werkkolom weer op. De router roept
         node.stop() aan zodra dit scherm verdwijnt. */
      wortel.appendChild(formulier.balk);
      wortel.stop = formulier.stop;
    }
    return wortel;
  }

  /* ---- het bewerkbare fabrieksdossier (spec 5.6 + 4.18) ---------------
     WELK VELD LANGS WELKE WEG WORDT OPGESLAGEN, en waarom:

       naam, regio        NIET hier. Daar bestaat openFactoryEditModal al
                          voor, met auditregel, bewaard concept en ongedaan
                          maken. Die dialoog staat als primaire knop in de
                          kop. Een tweede invoerveld ernaast zou een tweede
                          bron van waarheid zijn.
       stad               ctx.acties.fabriekStadZetten — de haak die de pin
                          op de kaart in het klantportaal bepaalt. Zonder
                          deze actie is die pin sinds de nieuwe indeling niet
                          meer te corrigeren.
       specialisaties     ctx.acties.fabriekSpecialisatiesZetten
       de twee scores     ctx.acties.fabriekScoresZetten
       land, contact,     GEEN HAAK — die velden bestonden op het oude
       notities           scherm helemaal niet, dus er is ook geen dialoog om
                          te hergebruiken. Ze gaan langs CP_DATA.saveFactory,
                          precies zoals het formulier "Nieuwe fabriek" verderop
                          langs CP_DATA.createFactory gaat. Dat is dezelfde
                          functie waar de drie haken hierboven zelf in
                          eindigen (setFactoryScores en setFactorySpecialties
                          roepen saveFactory aan), dus er ontstaat geen tweede
                          schrijfweg — alleen een tweede ingang.

     DE VOLGORDE VAN HET OPSLAAN IS GEEN DETAIL. Eerst de ene saveFactory met
     alle veldloze velden, en die WACHTEN WE AF. Pas daarna de haken, want
     twee van de drie verversen het scherm zelf (fabriekScoresZetten en
     fabriekSpecialisatiesZetten eindigen op refresh) en zouden dit formulier
     dus midden in de opslag onder handen weghalen. Ververst er geen enkele
     haak, dan doet ctx.ververs() dat hier — ná de afgewachte schrijfactie,
     zodat er nooit een tekening kan komen die vóór de opslag leest. */

  var SCORE_KEUZES = [
    { key: '', label: 'Nog niet beoordeeld' },
    { key: '1', label: '1 van 5' },
    { key: '2', label: '2 van 5' },
    { key: '3', label: '3 van 5' },
    { key: '4', label: '4 van 5' },
    { key: '5', label: '5 van 5' }
  ];

  /* de velden zonder eigen haak, in de vorm die CP_DATA.saveFactory kent */
  var FABRIEK_VRIJE_VELDEN = ['country', 'contactName', 'contactRole', 'contactEmail', 'contactPhone', 'notes'];

  function specialismenUit(tekstwaarde) {
    var uit = [];
    str(tekstwaarde).split(',').forEach(function (deel) {
      var t = trim(deel);
      if (t) uit.push(t);
    });
    return uit;
  }
  function scoreUit(waarde) {
    var t = trim(waarde);
    if (!t) return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  function fabriekDossierFormulier(ctx, ui, model, data, d) {
    var f = d.fabriek;
    var c = opt(ctx);

    var stadHaak = haak(ctx, 'fabriekStadZetten');
    var specHaak = haak(ctx, 'fabriekSpecialisatiesZetten');
    var scoreHaak = haak(ctx, 'fabriekScoresZetten');
    var kanVrij = !!(data && fn(data.saveFactory));

    /* De beginstand: alles als GETRIMDE TEKST, zodat "veranderd?" precies één
       vergelijking is. Trimmen hoort bij de beginstand en niet alleen bij het
       lezen: een opgeslagen notitie die op een witregel eindigt zou het
       formulier anders al vuil melden op het moment dat het getekend wordt. */
    var begin = {
      city: trim(f.city),
      specialties: arr(f.specialties).join(', '),
      qualityScore: (typeof f.qualityScore === 'number') ? String(f.qualityScore) : '',
      leadtimeScore: (typeof f.leadtimeScore === 'number') ? String(f.leadtimeScore) : '',
      country: trim(f.country),
      contactName: trim(f.contactName),
      contactRole: trim(f.contactRole),
      contactEmail: trim(f.contactEmail),
      contactPhone: trim(f.contactPhone),
      notes: trim(f.notes)
    };

    var velden = {};
    var vakken = [];

    if (stadHaak) {
      velden.city = keuzeInvoer(ui, 'fab-stad', stadKeuzes(), begin.city,
        'Stad van ' + str(f.name), 'geen kaartpositie');
      vakken.push(veldVak(ui, 'fab-stad', 'Stad', velden.city,
        'Deze keuze bepaalt de pin op de kaart in het klantportaal — alleen stadsniveau, nooit een adres. Leeg betekent geen pin.'));
    }
    if (kanVrij) {
      velden.country = tekstInvoer(ui, 'fab-land', begin.country, 'Bijvoorbeeld: China');
      vakken.push(veldVak(ui, 'fab-land', 'Land', velden.country));
    }
    if (specHaak) {
      velden.specialties = tekstInvoer(ui, 'fab-spec', begin.specialties, 'Bijvoorbeeld: spuitgieten, assemblage');
      vakken.push(veldVak(ui, 'fab-spec', 'Specialisaties', velden.specialties,
        'Gescheiden door komma’s. Ze staan als chiprij op de fabriekskaart.'));
    }
    if (scoreHaak) {
      velden.qualityScore = keuzeInvoer(ui, 'fab-kwaliteit', SCORE_KEUZES, begin.qualityScore, 'Kwaliteitsscore');
      velden.leadtimeScore = keuzeInvoer(ui, 'fab-doorlooptijd', SCORE_KEUZES, begin.leadtimeScore, 'Doorlooptijdscore');
      vakken.push(veldVak(ui, 'fab-kwaliteit', 'Kwaliteit', velden.qualityScore,
        'Leeg laten mag: geen oordeel is iets anders dan een laag cijfer.'));
      vakken.push(veldVak(ui, 'fab-doorlooptijd', 'Doorlooptijd', velden.leadtimeScore));
    }
    if (kanVrij) {
      velden.contactName = tekstInvoer(ui, 'fab-ct-naam', begin.contactName);
      velden.contactRole = tekstInvoer(ui, 'fab-ct-rol', begin.contactRole, 'Bijvoorbeeld: productieplanner');
      velden.contactEmail = tekstInvoer(ui, 'fab-ct-mail', begin.contactEmail);
      velden.contactPhone = tekstInvoer(ui, 'fab-ct-tel', begin.contactPhone);
      vakken.push(veldVak(ui, 'fab-ct-naam', 'Contactpersoon', velden.contactName));
      vakken.push(veldVak(ui, 'fab-ct-rol', 'Rol', velden.contactRole));
      vakken.push(veldVak(ui, 'fab-ct-mail', 'E-mail', velden.contactEmail));
      vakken.push(veldVak(ui, 'fab-ct-tel', 'Telefoon', velden.contactPhone));
    }

    var notitieVak = null;
    if (kanVrij) {
      velden.notes = vlakInvoer(ui, 'fab-notities', begin.notes,
        'Prijsstaffels, afspraken, waar je op moet letten — nooit zichtbaar voor de klant.');
      notitieVak = veldVak(ui, 'fab-notities', 'Interne notities', velden.notes);
    }

    var foutVak = ui.el('p', {
      class: 'u-sub', role: 'alert', style: 'color:var(--crit-ink);margin-top:14px;'
    });
    foutVak.hidden = true;
    function meld(tekst) {
      foutVak.textContent = str(tekst);
      foutVak.hidden = !str(tekst);
    }

    function nu() {
      var uit = {};
      Object.keys(velden).forEach(function (naam) { uit[naam] = trim(velden[naam].value); });
      return uit;
    }
    function veranderd() {
      var v = nu();
      var lijst = [];
      Object.keys(velden).forEach(function (naam) {
        if (v[naam] !== begin[naam]) lijst.push(naam);
      });
      return lijst;
    }
    function isVuil() { return veranderd().length > 0; }

    var balk = ui.saveBar({
      dirty: false,
      tekst: 'Niet opgeslagen',
      opHerstel: function () {
        Object.keys(velden).forEach(function (naam) { velden[naam].value = begin[naam]; });
        meld('');
        balk.zetDirty(false);
      },
      opOpslaan: function () { bewaar(); }
    });

    function kijkNaVuil() { balk.zetDirty(isVuil()); }
    Object.keys(velden).forEach(function (naam) {
      velden[naam].addEventListener('input', kijkNaVuil);
      velden[naam].addEventListener('change', kijkNaVuil);
    });

    /* DE NAVIGATIEWAARSCHUWING. De shell leegt de guardlijst bij élke
       navigatie en élke verversing, dus een scherm meldt zich tijdens het
       tekenen opnieuw aan — elke keer. Zonder deze regel gooit een klik in
       de zijbalk of cmd+K het onopgeslagen werk stil weg. */
    if (fn(c.registreerGuard)) {
      c.registreerGuard(function () {
        return isVuil()
          ? 'Je hebt wijzigingen in het fabrieksdossier van ' + (str(f.name) || 'deze fabriek') +
            ' die nog niet zijn opgeslagen. Weggaan gooit ze weg.'
          : null;
      });
    }

    function bewaar() {
      var vuil = veranderd();
      if (!vuil.length) return;
      var v = nu();
      meld('');

      var patch = {};
      var patchVuil = false;
      FABRIEK_VRIJE_VELDEN.forEach(function (naam) {
        if (velden[naam] === undefined) return;
        if (v[naam] === begin[naam]) return;
        patch[naam] = v[naam];
        patchVuil = true;
      });

      var stadVuil = !!(velden.city && v.city !== begin.city);
      var specVuil = !!(velden.specialties && v.specialties !== begin.specialties);
      var scoreVuil = !!(velden.qualityScore &&
        (v.qualityScore !== begin.qualityScore || v.leadtimeScore !== begin.leadtimeScore));

      balk.zetBezig(true);

      var eerst = patchVuil ? data.saveFactory(f.id, patch) : Promise.resolve(null);

      eerst.then(function () {
        /* de stad eerst: die haak slaat direct op en ververst NIET — dat is
           zijn bestaande afsluiter, dezelfde als in de oude fabriekenlijst */
        if (stadVuil) stadHaak(f, v.city);
        var haakVerverst = false;
        if (specVuil) { specHaak(f, specialismenUit(v.specialties)); haakVerverst = true; }
        if (scoreVuil) {
          scoreHaak(f, scoreUit(v.qualityScore), scoreUit(v.leadtimeScore));
          haakVerverst = true;
        }

        Object.keys(velden).forEach(function (naam) { begin[naam] = v[naam]; });
        balk.zetBezig(false);
        balk.zetDirty(false);
        toon(ui, 'Fabrieksdossier opgeslagen.');

        /* ververst geen enkele haak, dan doet dit scherm het zelf — pas hier,
           dus ná de afgewachte schrijfactie. Alleen de stad kan dan nog
           onderweg zijn, en die staat al goed in zijn eigen keuzelijst. */
        if (!haakVerverst && !stadVuil && fn(c.ververs)) c.ververs();
      }, function (fout) {
        balk.zetBezig(false);
        meld((fout && fout.message) ? fout.message : 'Het dossier kon niet worden opgeslagen.');
      });
    }

    var kinderen = [
      ui.el('h2', {
        style: 'font-size:20px;font-weight:500;letter-spacing:-.012em;color:var(--ink);margin-bottom:6px;',
        text: 'Dossier bewerken'
      }),
      ui.el('p', {
        class: 'u-sub',
        style: 'margin-bottom:18px;',
        text: 'Naam en regio bewerk je in het venster achter de knop bovenaan; dat venster schrijft een auditregel en biedt ongedaan maken. De rest van het dossier staat hieronder.'
      })
    ];

    if (!vakken.length && !notitieVak) {
      kinderen.push(ui.emptyTile({
        icoon: 'fabriek',
        titel: 'Er is hier niets te bewerken',
        uitleg: 'Geen van de schrijfacties voor een fabriek is aan dit scherm doorgegeven, en de datalaag CP_DATA is niet beschikbaar. Er wordt daarom geen veld getoond dat toch niets opslaat.'
      }));
    } else {
      kinderen.push(veldRaster(ui, vakken, 220));
      if (notitieVak) kinderen.push(ui.el('div', { style: 'margin-top:16px;' }, notitieVak));
      kinderen.push(foutVak);
      kinderen.push(ui.el('p', {
        class: 'u-row-sub',
        style: 'margin-top:16px;',
        text: 'Wijzigingen staan pas vast als je ze opslaat met de balk rechtsonder. Loop je weg met onopgeslagen werk, dan waarschuwt het beheer je eerst.'
      }));
    }

    var kaart = ui.el('section', {
      class: 'u-card',
      style: 'padding:24px;',
      'aria-label': 'Dossier van ' + str(f.name)
    }, kinderen);

    return {
      el: kaart,
      balk: balk.el,
      stop: function () { balk.stop(); }
    };
  }

  /* ---- de fabriekskaart (spec 5.6) ------------------------------------
     Beeld 300x200, naam met statusstip, locatie met pin, drie stats,
     specialisatiechips en twee ratingrijen. De klassen (.u-factorycard en
     alles eronder) staan in admin-ui.css hoofdstuk 8m en zijn precies voor
     deze kaart geschreven; CP_UI heeft er geen functie voor, dus de kaart
     wordt hier met CP_UI.el uit díé klassen samengesteld. */
  function fabriekKaart(ctx, ui, chart, model, data, d, isGekozen, detailModus) {
    var f = d.fabriek;
    var st = fabrieksStatus(data, f);

    var foto = beeldBron(f.photoUrl);
    var beeld = foto
      ? ui.el('img', { class: 'u-factorycard-beeld', src: foto, alt: '', loading: 'lazy' })
      /* geen foto: geen leeg grijs vlak maar de icoontegel uit de
         bibliotheek, gecentreerd in hetzelfde beeldslot. Dat is de eerlijke
         lege stand van hoofdstuk 7 — er IS geen foto, dus we doen niet alsof. */
      : ui.el('div', {
        class: 'u-factorycard-beeld',
        style: 'display:flex;align-items:center;justify-content:center;',
        'aria-hidden': 'true'
      }, ui.iconTile({ icoon: 'fabriek', maat: 56 }));

    var plaats = [str(f.city), str(f.region), str(f.country)]
      .filter(function (x) { return !!x; });
    /* stad en regio zijn in de demoseed vaak dezelfde plaats; twee keer
       "Dongguan" onder elkaar helpt niemand */
    var uniek = [];
    plaats.forEach(function (p) { if (uniek.indexOf(p) < 0) uniek.push(p); });

    var stats = ui.el('div', { class: 'u-factorycard-stats' }, [
      fabriekStat(ui, String(d.aantalActief), d.aantalActief === 1 ? 'Actief project' : 'Actieve projecten'),
      fabriekStat(ui, String(arr(f.specialties).length), 'Specialisaties'),
      fabriekStat(ui,
        d.laatsteSamenwerking ? datum(model, d.laatsteSamenwerking) : '—',
        d.laatsteSamenwerking ? 'Laatste samenwerking' : 'Nog geen samenwerking')
    ]);

    var chips = ui.chipRow({
      chips: arr(f.specialties).map(function (s) { return { label: str(s), icoon: 'vinkje' }; }),
      max: 5,
      restTitel: 'Ook gespecialiseerd in'
    });

    /* de twee beoordelingsrijen. CP_UI.ratingRow toont bij een lege score
       geen nul stippen maar "Nog niet beoordeeld": nul is een oordeel, geen
       oordeel is er geen. Die stand zit met opzet in de demoseed (Toolmaker
       Wei heeft nog geen cijfers). */
    var ratings = ui.el('div', { class: 'u-factorycard-rating' }, [
      ui.ratingRow({
        label: 'Kwaliteit',
        waarde: (typeof f.qualityScore === 'number') ? f.qualityScore : null,
        max: 5,
        leegTekst: 'Nog niet beoordeeld'
      }),
      ui.ratingRow({
        label: 'Doorlooptijd',
        waarde: (typeof f.leadtimeScore === 'number') ? f.leadtimeScore : null,
        max: 5,
        leegTekst: 'Nog niet beoordeeld'
      })
    ]);

    /* de naam is de ingang naar deze fabriek. .u-factorycard-naam en .u-link
       hebben allebei specificiteit 0,1,0 en zetten allebei een font-size;
       welke wint hangt dan af van hun VOLGORDE in admin-ui.css, en dat is
       geen afhankelijkheid die een scherm hoort te hebben. De 22px uit
       hoofdstuk 5.6 staat er daarom expliciet bij. */
    var naamKnop = ui.el('button', {
      type: 'button',
      class: 'u-factorycard-naam u-link',
      style: 'font-size:22px;text-align:left;',
      text: str(f.name) || 'Naamloze fabriek',
      onclick: function () { ga(ctx, relatieRoute(model, 'fabrieken', f.id, null)); }
    });

    /* HET ••• VAN DEZE KAART. In de lijst is een fabriekskaart een rij, en
       een rij krijgt zijn acties in zijn eigen •••: het dossier openen, de
       bestaande naam-en-regiodialoog, en onderin — in de kritieke kleur —
       archiveren. In het dossier zelf staat datzelfde menu al in de
       paginakop; twee keer hetzelfde menu op één scherm is één menu te veel. */
    var kaartMenu = detailModus ? [] : menuLijst([
      {
        label: 'Open het dossier', ico: 'chevron',
        onKies: function () { ga(ctx, relatieRoute(model, 'fabrieken', f.id, null)); }
      },
      haakItem(ctx, 'fabriekBewerken', 'Naam en regio bewerken', 'potlood', f),
      { scheiding: true },
      haakItem(ctx, 'fabriekArchiveren', 'Fabriek archiveren', 'sluiten', f, { gevaarlijk: true })
    ]);
    var kaartMenuNode = null;
    if (kaartMenu.length) {
      kaartMenuNode = ui.contextMenu({
        knop: { titel: 'Meer acties bij: ' + (str(f.name) || 'deze fabriek') },
        items: kaartMenu,
        uitlijning: 'rechts'
      }).el;
      /* het ••• staat aan het EIND van de kopregel. .u-factorycard-kop is een
         flexrij zonder verdeling; deze ene eigenschap duwt hem naar rechts
         zonder de maatvoering van de kaart aan te raken. */
      kaartMenuNode.setAttribute('style', 'margin-left:auto;');
    }

    var lijf = ui.el('div', { class: 'u-factorycard-body' }, [
      ui.el('div', { class: 'u-factorycard-kop' }, [
        naamKnop,
        /* statusstip PLUS woord — CP_UI.statusDot laat een stip zonder woord
           niet eens ontstaan */
        ui.statusDot({ toon: st.toon, label: st.label }),
        kaartMenuNode
      ]),
      uniek.length ? ui.el('div', { class: 'u-factorycard-plaats' }, [
        ui.icon('locatie', 15),
        ui.el('span', { text: uniek.join(' · ') })
      ]) : null,
      stats,
      arr(f.specialties).length
        ? ui.el('div', { class: 'u-factorycard-chips' }, chips)
        : ui.el('div', { class: 'u-factorycard-chips' }, ui.el('span', {
          class: 'u-row-sub', text: 'Nog geen specialisaties vastgelegd.'
        })),
      ratings
    ]);

    var kaart = ui.el('article', {
      class: 'u-factorycard',
      'aria-label': 'Fabriek ' + str(f.name)
    }, [beeld, lijf]);
    if (isGekozen) kaart.setAttribute('aria-current', 'true');
    return kaart;
  }

  function fabriekStat(ui, waarde, label) {
    return ui.el('div', null, [
      ui.el('span', { class: 'u-factorycard-stat-waarde', text: str(waarde) }),
      ui.el('span', { class: 'u-factorycard-stat-label', text: str(label) })
    ]);
  }

  /* ---- de rail van de tab Fabrieken (spec 5.6) ------------------------- */
  function fabriekRail(ctx, ui, model, data, d, detailModus) {
    if (!d) {
      return [railKaart(ui, 'Fabrieksdossier', ui.emptyTile({
        icoon: 'fabriek',
        titel: 'Nog geen fabriek gekozen',
        uitleg: 'Kies een fabriek om haar contactpersoon, lopende projecten en notities hier te zien.'
      }))];
    }

    var f = d.fabriek;
    var bron = lijsten(ctx);
    var klanten = indexOp(L(bron, 'clients'), 'id');
    var uit = [];

    /* --- contactpersoon --- */
    var contact = [];
    if (str(f.contactName)) {
      contact.push(ui.el('div', { style: 'display:flex;align-items:center;gap:12px;' }, [
        ui.avatar({ naam: str(f.contactName), url: beeldBron(f.contactAvatarUrl), maat: 48 }),
        ui.el('div', { style: 'min-width:0;' }, [
          ui.el('span', { class: 'u-row-title', style: 'display:block;', text: str(f.contactName) }),
          str(f.contactRole) ? ui.el('span', { class: 'u-row-sub', style: 'display:block;', text: str(f.contactRole) }) : null
        ])
      ]));
      /* `groot` zet de cel op de volle breedte van het raster. In een rail
         van 400px staan drie metaGrid-kolommen zo dicht op elkaar dat een
         e-mailadres over de telefoonkolom heen loopt; deze twee waarden zijn
         allebei lang en krijgen daarom elk een eigen regel. */
      var regels = [];
      if (str(f.contactEmail)) regels.push({ icoon: 'mail', label: 'E-mail', waarde: str(f.contactEmail), groot: true });
      if (str(f.contactPhone)) regels.push({ icoon: 'gebruiker', label: 'Telefoon', waarde: str(f.contactPhone), groot: true });
      if (regels.length) {
        contact.push(ui.el('div', { style: 'margin-top:14px;' },
          ui.metaGrid({ cellen: regels })));
      }
    } else {
      contact.push(ui.emptyTile({
        icoon: 'gebruiker',
        titel: 'Nog geen contactpersoon',
        uitleg: 'Vul de contactgegevens van deze fabriek aan zodra je ze hebt.'
      }));
    }
    uit.push(railKaart(ui, 'Fabrieksdossier', contact));

    /* --- actieve projecten met statuschip --- */
    var projectRijen = d.projecten.map(function (p) {
      var klant = klanten[p.clientId];
      var gearchiveerd = p.status === 'archived';
      return ui.entityRow({
        thumb: projectFoto(model, L(bron, 'media'), p.id) || undefined,
        titel: str(p.name),
        sub: klant ? str(klant.company) : '',
        chips: [ui.statusChip({
          label: gearchiveerd ? 'Gearchiveerd' : 'Loopt',
          toon: gearchiveerd ? 'neutraal' : 'nu'
        })],
        onOpen: function () { ga(ctx, '#/projecten/' + encodeURIComponent(p.id)); }
      });
    });

    var koppelUitleg = null;
    if (d.koppelingBron === 'afgeleid') {
      /* EERLIJK ZIJN OVER DE HERKOMST. Een project dat alleen via de
         fabrieks-id op zijn foto's aan deze fabriek hangt, is een AFLEIDING
         en geen vastgelegde koppeling. Dat verschil hoort de eigenaar te
         zien, want hij kan het rechtzetten. */
      koppelUitleg = ui.el('p', {
        class: 'u-row-sub',
        style: 'margin-top:10px;',
        text: 'Deze koppeling is afgeleid uit de foto’s en de NNN-vastleggingen van het project; het projectveld zelf is nog leeg.'
      });
    }

    uit.push(railKaart(ui, 'Projecten', [
      ui.entityList(projectRijen, {
        leegTitel: 'Nog geen project',
        leegUitleg: 'Zodra je een project aan deze fabriek koppelt, staat het hier.'
      }),
      koppelUitleg
    ]));

    /* --- recente samenwerking --- */
    uit.push(railKaart(ui, 'Recente samenwerking', [
      railRegel(ui, 'Laatst samengewerkt',
        d.laatsteSamenwerking ? datum(model, d.laatsteSamenwerking) : 'Nog niet vastgelegd'),
      railRegel(ui, 'NNN getekend',
        f.nnnSignedAt ? datum(model, f.nnnSignedAt) : 'Nog niet getekend',
        f.nnnSignedAt
          ? ui.statusDot({ toon: 'klaar', label: datum(model, f.nnnSignedAt) })
          : ui.statusDot({ toon: 'wacht', label: 'Nog niet getekend' })),
      railRegel(ui, 'Actieve projecten', String(d.aantalActief))
    ]));

    /* --- interne notities --- */
    if (str(f.notes)) {
      uit.push(railKaart(ui, 'Interne notities', [
        ui.el('span', { class: 'u-kicker', style: 'display:block;margin-bottom:6px;', text: 'Niet zichtbaar voor de klant' }),
        ui.el('p', { class: 'u-lees', text: str(f.notes) })
      ]));
    }

    /* --- de knop onderaan --- */
    uit.push(ui.el('button', {
      type: 'button',
      class: 'u-btn breed',
      text: detailModus ? 'Alle fabrieken' : 'Open fabriek',
      onclick: function () {
        ga(ctx, relatieRoute(model, 'fabrieken', detailModus ? null : f.id, null));
      }
    }, detailModus ? null : ui.icon('chevron', 18)));

    return uit;
  }

  /* ---- Nieuwe fabriek --------------------------------------------------
     Aanmaken bestond niet en kan sinds 0020 wél: CP_DATA.createFactory()
     schrijft de openbare helft naar factories_partners en het interne
     dossier naar factory_private, in die volgorde, en geeft de volledige rij
     terug. Het formulier vraagt daarom precies wat de openbare helft nodig
     heeft; de scores, de notities en de contactgegevens vul je daarna in het
     dossier aan — een cijfer geven aan een fabriek die je nog niet kent is
     precies wat hoofdstuk 7 verbiedt.

     GEEN MODAL: er is in CP_UI geen dialoogprimitief, en een inline
     formulier bovenaan de lijst laat je zien waar het ding straks komt te
     staan. Het staat open volgens ?nieuw=1 in de route. */
  function nieuweFabriekFormulier(ctx, ui, model, data) {
    var naamId = 'nf-naam';
    var stadId = 'nf-stad';
    var landId = 'nf-land';
    var statusId = 'nf-status';
    var foutVak = ui.el('p', {
      class: 'u-sub',
      role: 'alert',
      style: 'color:var(--crit-ink);margin-top:12px;'
    });
    foutVak.hidden = true;

    function veld(id, label, placeholder, waarde) {
      return ui.el('div', { style: 'min-width:0;' }, [
        ui.el('label', {
          for: id,
          style: 'display:block;font-size:13px;color:var(--ink-2);margin-bottom:6px;',
          text: label
        }),
        ui.el('input', {
          id: id, class: 'input', type: 'text', autocomplete: 'off',
          placeholder: placeholder || null, value: waarde || ''
        })
      ]);
    }

    var naamVeld = veld(naamId, 'Naam van de fabriek', 'Bijvoorbeeld: Fabriek Chen');
    var stadVeld = veld(stadId, 'Stad', 'Bijvoorbeeld: Dongguan');
    var landVeld = veld(landId, 'Land', 'Bijvoorbeeld: China');

    var statusKeuze = ui.el('select', { id: statusId, class: 'input' });
    var statusTabel = (data && Array.isArray(data.FABRIEK_STATUS)) ? data.FABRIEK_STATUS : [];
    statusTabel.forEach(function (s) {
      statusKeuze.appendChild(ui.el('option', { value: str(s.key), text: str(s.label) }));
    });
    var statusVak = ui.el('div', { style: 'min-width:0;' }, [
      ui.el('label', {
        for: statusId,
        style: 'display:block;font-size:13px;color:var(--ink-2);margin-bottom:6px;',
        text: 'Status'
      }),
      statusKeuze
    ]);

    function meld(tekst) {
      foutVak.textContent = str(tekst);
      foutVak.hidden = !str(tekst);
    }

    var bewaarKnop = ui.el('button', {
      type: 'submit',
      class: 'u-btn',
      text: 'Fabriek aanmaken'
    });

    var formulier = ui.el('form', {
      class: 'u-card',
      style: 'padding:24px;',
      onsubmit: function (e) {
        if (e && fn(e.preventDefault)) e.preventDefault();
        var naam = trim(naamVeld.querySelector('#' + naamId).value);
        if (!naam) {
          meld('Een fabriek heeft in elk geval een naam nodig.');
          return;
        }
        if (!data || !fn(data.createFactory)) {
          meld('De datalaag CP_DATA is niet beschikbaar, dus er kan nu niets worden opgeslagen.');
          return;
        }
        meld('');
        bewaarKnop.disabled = true;
        data.createFactory({
          name: naam,
          city: trim(stadVeld.querySelector('#' + stadId).value),
          country: trim(landVeld.querySelector('#' + landId).value),
          status: statusKeuze.value || 'actief'
        }).then(function (rij) {
          if (fn(ui.toast)) ui.toast('Fabriek "' + naam + '" is aangemaakt.');
          /* eerst de lijsten opnieuw laten ophalen, dan naar de nieuwe
             fabriek. Andersom zou de route naar een id wijzen dat het scherm
             nog niet kent. */
          var klaar = fn(opt(ctx).ververs) ? ctx.ververs() : null;
          function verder() {
            ga(ctx, relatieRoute(model, 'fabrieken', rij && rij.id ? rij.id : null, null));
          }
          if (klaar && fn(klaar.then)) klaar.then(verder, verder);
          else verder();
        }, function (fout) {
          bewaarKnop.disabled = false;
          meld((fout && fout.message) ? fout.message : 'De fabriek kon niet worden aangemaakt.');
        });
      }
    }, [
      ui.el('h2', {
        style: 'font-size:20px;font-weight:500;letter-spacing:-.012em;color:var(--ink);margin-bottom:6px;',
        text: 'Nieuwe fabriek'
      }),
      ui.el('p', {
        class: 'u-sub',
        style: 'margin-bottom:18px;',
        text: 'Naam is verplicht. Specialisaties, de contactpersoon en je oordeel over kwaliteit en doorlooptijd vul je daarna aan in het dossier.'
      }),
      ui.el('div', {
        style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;'
      }, [naamVeld, stadVeld, landVeld, statusVak]),
      foutVak,
      ui.el('div', { style: 'display:flex;gap:10px;margin-top:20px;' }, [
        bewaarKnop,
        ui.el('button', {
          type: 'button',
          class: 'u-btn ghost',
          text: 'Annuleer',
          onclick: function () { ga(ctx, relatieRoute(model, 'fabrieken', null, null)); }
        })
      ])
    ]);

    return formulier;
  }

  /* ============================================================
     7. SCHERM — FINANCIËN (spec 5.7)
     ============================================================ */

  /* ============================================================
     7.0 DE TWEE STANDEN — TE DOEN EN ARCHIEF (voorstel 9)

     Vier tabs, zes filters en vier ouderdomschips waren samen veertien
     knoppen vóór de eerste factuurrij, en geen van die veertien beantwoordde
     de vraag waarmee de eigenaar het scherm opent: "waar moet ik iets mee?".
     De twee standen doen dat. TE DOEN is alles wat nog een handeling vraagt;
     ARCHIEF is alles wat af is. Elke factuur valt in precies één van de twee,
     dus de tellers in de segmentknop tellen samen op tot het totaal.

     WAT IN WELKE STAND STAAT is afgeleid uit de STATUSVERTALER (eindCode)
     en nooit uit inv.status:
       archief   paid, credited, cancelled — de drie die het voorstel noemt —
                 plus uncollectible: een afgeboekte factuur is afgesloten
                 werk ("Afboeking bekijken"), en hij zou anders in Te doen
                 blijven hangen als een taak die niemand meer kan doen.
       te doen   al het andere: open, te laat, deels betaald, concept en
                 betwist.
     ÉÉN UITZONDERING GAAT VOOR: een factuur waarop de klant een betaling
     meldde die nog niet bevestigd is (0021: reportedByClient zonder
     verifiedAt) staat altijd in Te doen, ook als hij intussen op betaald of
     geannuleerd staat. De melding vraagt een antwoord — bevestigen of
     afwijzen — en dat is werk, ongeacht de stand van de factuur.

     DE SEGMENTKNOP IS CP_UI.filterChips. CP_UI kent geen apart
     segmentcomponent; de chips zijn precies wat een segmentknop is — een
     groep drukknoppen (aria-pressed) waarvan er één aan staat — en ze dragen
     hun telling al in .u-count. De soorttabs blijven CP_UI.tabs, want die
     wisselen nog steeds van paneel; ze staan alleen één klik dieper.

     DE ROUTE, VOLLEDIG (alles in route.params, gelezen via CP_MODEL):
       #/financien                      Te doen, alle soorten
       #/financien?stand=archief        Archief, alle soorten
       #/financien?tab=concepten        Te doen, filters UITGEKLAPT, tab
                                        Concepten actief — de bestaande deep
                                        link blijft dus werken, hij landt
                                        alleen in de nieuwe eerste keuze
       #/financien?stand=archief&tab=facturen
                                        Archief met de tab Facturen; een
                                        stand-parameter wint van de terugval
                                        Te doen, de tab werkt bínnen de stand
       #/financien?tab=facturen&ouderdom=30plus
                                        de ouderdomstrap, alleen in Te doen
                                        en alleen bij "alle soorten" of
                                        Facturen (elders zegt hij niets)
     Een tab- of ouderdomparameter in het adres klapt de filters altijd uit:
     een filter dat werkt terwijl zijn knop verborgen is, is een lijst die
     zonder verklaring korter is. Zonder zo'n parameter komt open/dicht uit
     localStorage (cp_fin_filters_open) — dat is een voorkeur van de
     gebruiker en geen schermstaat, en het is de enige plek waar dit scherm
     buiten de route om iets onthoudt; WAT er gefilterd wordt staat nog
     steeds uitsluitend in de route (afspraak 3 bovenaan).
     ============================================================ */

  var FIN_STANDEN = [
    { key: 'tedoen', label: 'Te doen' },
    { key: 'archief', label: 'Archief' }
  ];

  var FIN_FILTERS_SLEUTEL = 'cp_fin_filters_open';

  /* 'alle' staat vooraan: zonder tab in de route toont een stand alles wat
     erin valt, en CP_UI.tabs kent geen "geen tab" — er is altijd één actief */
  var FIN_TABS = [
    { key: 'alle', label: 'Alle soorten' },
    { key: 'facturen', label: 'Facturen' },
    { key: 'concepten', label: 'Concepten' },
    { key: 'betalingen', label: 'Betalingen' },
    { key: 'creditnotas', label: 'Creditnota’s' }
  ];

  function inTab(f, tab) {
    if (tab === 'alle') return true;
    if (tab === 'concepten') return f.stand.isConcept;
    if (tab === 'betalingen') return f.stand.betaaldCents > 0;
    if (tab === 'creditnotas') return f.stand.isCredit;
    /* Facturen: alles wat de deur uit is. Een concept staat er niet tussen —
       dat is nog geen factuur — en een creditnota heeft zijn eigen tab. */
    return !f.stand.isConcept && !f.stand.isCredit;
  }

  function inArchief(f) {
    var c = f.stand.eindCode;
    return c === 'paid' || c === 'credited' || c === 'cancelled' || c === 'uncollectible';
  }

  /* de stand van één factuur; `meldingen` is de lijst onbevestigde
     klantmeldingen op deze factuur (zie meldingenVoor) en gaat vóór */
  function standVan(f, meldingen) {
    if (arr(meldingen).length) return 'tedoen';
    return inArchief(f) ? 'archief' : 'tedoen';
  }

  /* DE VOLGORDE IN TE DOEN is de volgorde van het werk: een gemelde betaling
     vraagt één klik en staat bovenaan; dan wat te laat is; dan een bezwaar
     (dat is óók rood, maar vraagt een gesprek en geen klik); dan wat open
     staat, op vervaldatum, zodat het eerstvolgende bovenaan ligt; dan de
     concepten, nieuwste eerst; en als laatste de rest (een verstuurde
     factuur zonder open bedrag die nog niet op betaald staat — die komt
     voor tot de trigger of de staf hem bijwerkt). */
  function teDoenRang(f, meldingen) {
    if (arr(meldingen).length) return 0;
    if (f.stand.teLaat) return 1;
    if (f.stand.eindCode === 'disputed') return 2;
    if (!f.stand.isConcept && !f.stand.isCredit && f.stand.openCents > 0) return 3;
    if (f.stand.isConcept) return 4;
    return 5;
  }

  function opVerval(a, b) {
    var x = str(a.stand.vervalISO) || '9999-12-31';
    var y = str(b.stand.vervalISO) || '9999-12-31';
    if (x < y) return -1;
    if (x > y) return 1;
    return str(a.inv.id) < str(b.inv.id) ? -1 : 1;
  }

  /* nieuwste bovenaan; bij gelijke datum op id, zodat de volgorde in demo-
     en live modus dezelfde is */
  function opNieuwste(a, b) {
    var x = str(a.inv.createdAt), y = str(b.inv.createdAt);
    if (x > y) return -1;
    if (x < y) return 1;
    return str(a.inv.id) < str(b.inv.id) ? -1 : 1;
  }

  function sorteerStand(rijen, stand, meldingIndex) {
    var lijst = arr(rijen).slice(0);
    if (stand === 'archief') return lijst.sort(opNieuwste);
    return lijst.sort(function (a, b) {
      var ra = teDoenRang(a, meldingIndex[a.inv.id]);
      var rb = teDoenRang(b, meldingIndex[b.inv.id]);
      if (ra !== rb) return ra - rb;
      /* binnen "te laat" en "open" telt de vervaldatum; binnen de andere
         rangen is nieuwste-eerst de enige volgorde die iets betekent */
      if (ra === 1 || ra === 3) return opVerval(a, b);
      return opNieuwste(a, b);
    });
  }

  /* ---- open/dicht van het filterpaneel -------------------------------
     Alleen hier wordt localStorage aangeraakt, en alleen in try/catch: een
     private venster of een geblokkeerde opslag mag het scherm niet breken.
     Zonder opslag staan de filters dicht — de stand die de minste knoppen
     toont. */
  function leesFiltersOpen() {
    try {
      var g = G();
      return !!(g && g.localStorage && g.localStorage.getItem(FIN_FILTERS_SLEUTEL) === '1');
    } catch (e) { return false; }
  }
  function bewaarFiltersOpen(open) {
    try {
      var g = G();
      if (g && g.localStorage) g.localStorage.setItem(FIN_FILTERS_SLEUTEL, open ? '1' : '0');
    } catch (e) { /* een voorkeur die niet bewaard kan worden is geen fout */ }
  }

  /* ============================================================
     7.0b DE GEMELDE BETALINGEN VAN DE KLANT (migratie 0021)

     BRON: ctx.lijsten.clientPayments (alias betalingsmeldingen) — de rijen
     uit invoice_payments met reportedByClient true, bevestigd én
     onbevestigd, zoals DS.listClientPaymentReports() ze levert. Een oudere
     shell zonder die lijst kan nog invoicePayments dragen; dan geldt daar
     dezelfde vlag. Alleen een melding ZONDER verifiedAt is werk: een
     bevestigde melding is een gewone betaling geworden en staat al in het
     saldo van de factuur.

     VELDNAMEN, TOLERANT: de demo en camelRow() in beheer.html schrijven
     amountCents / paidOn / clientReference; het actiecontract in beheer.html
     noemt ook cents / dateISO / paidAt / kenmerk / reference. Alle vormen
     worden hier gelezen, zodat de rij er op beide manieren hetzelfde uitziet
     en nooit "€ 0" toont omdat één veld anders heet.
     ============================================================ */

  var MELDING_LIJSTNAMEN = ['clientPayments', 'betalingsmeldingen', 'invoicePayments'];

  function isOnbevestigdeMelding(m) {
    if (!isObj(m)) return false;
    if (m.reportedByClient !== true && m.reported_by_client !== true) return false;
    return !str(m.verifiedAt || m.verified_at);
  }

  function meldingCents(m) {
    var o = opt(m);
    var v = (o.amountCents !== undefined && o.amountCents !== null) ? o.amountCents
      : ((o.cents !== undefined && o.cents !== null) ? o.cents : o.amount_cents);
    return Math.round(getal(v));
  }
  function meldingDatum(m) {
    var o = opt(m);
    return str(o.paidOn || o.dateISO || o.paidAt || o.paid_on).slice(0, 10);
  }
  function meldingKenmerk(m) {
    var o = opt(m);
    return trim(o.clientReference || o.kenmerk || o.reference || o.client_reference);
  }

  /* per factuur-id de onbevestigde meldingen, oudste eerst. De eerste lijst
     die bestaat wint, ook als ze leeg is — precies zoals CP_MODEL de
     clientPayments leest. */
  function meldingIndexVan(ctx) {
    var bron = lijsten(ctx);
    var lijst = null;
    for (var i = 0; i < MELDING_LIJSTNAMEN.length && !lijst; i++) {
      if (Array.isArray(bron[MELDING_LIJSTNAMEN[i]])) lijst = bron[MELDING_LIJSTNAMEN[i]];
    }
    if (!lijst && Array.isArray(opt(ctx).clientPayments)) lijst = ctx.clientPayments;
    var uit = {};
    arr(lijst).forEach(function (m) {
      if (!isOnbevestigdeMelding(m)) return;
      var id = str(m.invoiceId || m.invoice_id);
      if (!id) return;
      if (!uit[id]) uit[id] = [];
      uit[id].push(m);
    });
    Object.keys(uit).forEach(function (id) {
      uit[id].sort(function (a, b) {
        var x = str(a.createdAt || a.created_at), y = str(b.createdAt || b.created_at);
        if (x < y) return -1;
        if (x > y) return 1;
        return 0;
      });
    });
    return uit;
  }

  /* HELE ZINNEN PER GEVAL. Vier gevallen (met of zonder datum, met of zonder
     kenmerk), elk als één zin uitgeschreven, zodat er nooit een komma of een
     "op" overblijft die nergens bij hoort. Een melding zonder bedrag heet
     "een betaling": beter een eerlijk woord dan "€ 0". */
  function meldingZin(chart, model, m) {
    var cents = meldingCents(m);
    var bedrag = cents > 0 ? euro(chart, cents, true) : 'een betaling';
    var dag = meldingDatum(m);
    var wanneer = dag ? datum(model, dag) : '';
    var kenmerk = meldingKenmerk(m);
    if (wanneer && kenmerk) return 'Klant meldt ' + bedrag + ' op ' + wanneer + ', kenmerk ' + kenmerk + '.';
    if (wanneer) return 'Klant meldt ' + bedrag + ' op ' + wanneer + '.';
    if (kenmerk) return 'Klant meldt ' + bedrag + ', kenmerk ' + kenmerk + '.';
    return 'Klant meldt ' + bedrag + '.';
  }

  /* het verschil met wat er open staat, of niets als het klopt. Het
     openstaande bedrag komt uit de statusvertaler en telt — sinds
     invoice-payments.js dezelfde regel als 0021 volgt — de melding zelf
     niet mee, dus de vergelijking is eerlijk. */
  function verschilZin(chart, m, stand) {
    var cents = meldingCents(m);
    if (cents <= 0) return '';
    var open = getal(stand.openCents);
    if (open <= 0) return 'Op deze factuur staat niets meer open.';
    if (cents < open) return 'Dat is ' + euro(chart, open - cents, true) + ' minder dan open staat.';
    if (cents > open) return 'Dat is ' + euro(chart, cents - open, true) + ' meer dan open staat.';
    return '';
  }

  /* ============================================================
     7a. DE OUDERDOMSTRAP

     Mappingtabel: "blok Geld (vier-bakjes ouderdomstrap) → Financiën +
     Overzicht → Openstaande betalingen · 30+/15-30/8-14/0-7 wordt
     filterchips."

     HET ZIJN FILTERS EN GEEN ZESDE TAB. De soorttabs verdelen de facturen
     in soorten (verstuurd, concept, betaald, gecrediteerd) en sluiten elkaar
     uit; de trap VERKLEINT wat er al staat. Dat is exact het verschil dat
     CP_UI.filterChips (aria-pressed) en CP_UI.tabs (role=tab met een
     paneel) uit elkaar houden, dus het is ook precies het verschil in
     component. Sinds de twee standen (hoofdstuk 7.0) staat de trap in het
     filterpaneel en werkt hij in Te doen bij "alle soorten" én op de tab
     Facturen — zie ouderdomGeldt(); in het archief staat niets open.

     DE GRENZEN ZIJN LETTERLIJK DIE VAN HET OUDE BLOK GELD in beheer.html:
     30+ / 15–29 / 8–14 / 0–7 dagen. Het label van het tweede bakje zegt
     "15–30" en de bovengrens is 29, want vanaf 30 neemt het rode bakje het
     over — dat stond in het oude scherm ook zo en de tellingen blijven
     daardoor optellen tot het totaal.

     DE OUDERDOM IS DE TIJD SINDS DE FACTUURDATUM en niet sinds de
     vervaldatum. Zo rekende computeSignals() hem (age = daysSince
     inv.createdAt), en zo is de grens van 30 dagen ook dezelfde als het rode
     signaal van de gezondheidskaart en als de vervalprojectie
     "aanmaak + 30 dagen". Eén klok, drie plekken.
     ============================================================ */

  /* `kort` is de bijzin voor de lege stand. Hij noemt de ECHTE grenzen en
     niet het chiplabel: het tweede bakje heet "15–30" maar loopt tot en met
     29, en een lege stand die 30 belooft en 29 bedoelt is precies het soort
     kleine onwaarheid dat je pas merkt als je hem nodig hebt. */
  var OUDERDOM_FILTERS = [
    { key: 'alle', label: 'Alle facturen', altijd: true },
    { key: '30plus', label: '30+ dagen open', min: 30, max: null, kort: '30 dagen of langer openstaat' },
    { key: '15-30', label: '15–30 dagen open', min: 15, max: 29, kort: '15 tot 30 dagen openstaat' },
    { key: '8-14', label: '8–14 dagen open', min: 8, max: 14, kort: '8 tot en met 14 dagen openstaat' },
    { key: '0-7', label: '0–7 dagen open', min: 0, max: 7, kort: 'korter dan 8 dagen openstaat' }
  ];

  function ouderdomSpec(key) {
    var uit = null;
    OUDERDOM_FILTERS.forEach(function (o) { if (o.key === str(key)) uit = o; });
    return uit;
  }

  /* de trap kijkt alleen naar wat er nog OPENSTAAT: een betaalde factuur
     wordt niet ouder, die is klaar. Zelfde afbakening als het oude blok
     Geld, dat conceptfacturen en creditnota's ook buiten de bakjes hield. */
  function heeftOpenstaand(f) {
    return !f.stand.isConcept && !f.stand.isCredit && f.stand.openCents > 0;
  }

  function factuurLeeftijd(model, f, vandaag) {
    var n = dagenTussen(model, f.inv && f.inv.createdAt, vandaag);
    return (n === null) ? 0 : n;
  }

  function inOuderdom(model, f, key, vandaag) {
    if (str(key) === 'alle') return true;
    var spec = ouderdomSpec(key);
    if (!spec || typeof spec.min !== 'number') return true;
    if (!heeftOpenstaand(f)) return false;
    var leeftijd = factuurLeeftijd(model, f, vandaag);
    if (leeftijd < spec.min) return false;
    if (spec.max !== null && leeftijd > spec.max) return false;
    return true;
  }

  /* de trap zegt alleen iets waar open geld kan staan: in Te doen, bij
     "alle soorten" of op de tab Facturen. In het archief staat niets open en
     op Concepten, Betalingen en Creditnota's betekent hij niets. */
  function ouderdomGeldt(stand, tab) {
    return stand === 'tedoen' && (tab === 'alle' || tab === 'facturen');
  }

  /* de route van dit werkgebied op één plek, zodat de segmentknop, de
     tabbalk en de ouderdomschips niet elk hun eigen querygrammatica krijgen
     (de volledige grammatica staat in het kopblok van hoofdstuk 7.0). De
     terugvallen staan NIET in het adres: Te doen en "alle soorten" zijn de
     kale route, zodat #/financien altijd hetzelfde blijft betekenen. Een
     wissel van stand of tab LAAT DE OUDERDOM VALLEN waar hij niets betekent —
     een bakje dat meereist naar het archief zou daar een lege lijst zonder
     verklaring geven. */
  function financienRoute(model, keuze) {
    var k = opt(keuze);
    var stand = (str(k.stand) === 'archief') ? 'archief' : 'tedoen';
    var tab = str(k.tab) || 'alle';
    var params = {};
    if (stand === 'archief') params.stand = 'archief';
    if (tab !== 'alle') params.tab = tab;
    if (ouderdomGeldt(stand, tab) && str(k.ouderdom) && str(k.ouderdom) !== 'alle') {
      params.ouderdom = str(k.ouderdom);
    }
    if (model && fn(model.buildRoute)) {
      return model.buildRoute({ area: 'financien', params: params });
    }
    var delen = [];
    Object.keys(params).forEach(function (naam) {
      delen.push(encodeURIComponent(naam) + '=' + encodeURIComponent(params[naam]));
    });
    return '#/financien' + (delen.length ? '?' + delen.join('&') : '');
  }

  function schermFinancien(ctx) {
    var ui = UI(ctx);
    if (!ui) return noodScherm('De componentbibliotheek CP_UI is niet geladen.');
    var model = MODEL(ctx);
    var chart = CHART(ctx);
    var data = DATA(ctx);
    var bron = lijsten(ctx);
    var route = opt(opt(ctx).route);
    var vandaag = vandaagVan(model, opt(ctx).nu);

    var projecten = indexOp(L(bron, 'projects'), 'id');
    var klanten = indexOp(L(bron, 'clients'), 'id');

    /* elke factuur één keer door de statusvertaler; daarna leest niets meer
       inv.status rechtstreeks */
    var facturen = L(bron, 'invoices').map(function (inv) {
      return { inv: inv, stand: factuurStand(ctx, inv, vandaag) };
    });

    /* DE STAND is de eerste keuze (hoofdstuk 7.0). Alleen 'archief' is een
       geldige waarde in het adres; al het andere is Te doen. */
    var stand = (str(opt(route.params).stand).toLowerCase() === 'archief') ? 'archief' : 'tedoen';

    /* tabkeuze staat in de query. CP_MODEL.tabOf is de ENIGE manier om een
       tab te lezen: een entiteitstab staat in het pad, een werkgebiedtab in
       de query, en dat verschil hoort geen scherm zelf uit te schrijven.
       Zonder tab is de terugval "alle soorten"; een onbekende tab ook, en
       die klapt de filters niet uit — er is dan geen filter om te tonen. */
    var tab = 'alle';
    if (model && fn(model.tabOf)) tab = str(model.tabOf(route, 'alle'));
    else tab = str(opt(route.params).tab).toLowerCase() || 'alle';
    var geldig = false;
    FIN_TABS.forEach(function (t) { if (t.key === tab) geldig = true; });
    if (!geldig) tab = 'alle';
    var tabGevraagd = geldig && !!str(opt(route.params).tab);

    /* de ouderdomstrap staat naast de tab in de query, zodat een gefilterde
       lijst deelbaar is en een verversing overleeft. Waar hij niets betekent
       (zie ouderdomGeldt) wordt hij genegeerd, ook als iemand hem in het
       adres zet. */
    var ouderdom = 'alle';
    if (ouderdomGeldt(stand, tab)) {
      var gevraagd = str(opt(route.params).ouderdom);
      if (gevraagd && ouderdomSpec(gevraagd)) ouderdom = gevraagd;
    }

    /* de onbevestigde klantmeldingen per factuur (hoofdstuk 7.0b): ze
       bepalen de stand, de volgorde én het voorstel onder de rij */
    var meldingIndex = meldingIndexVan(ctx);

    /* open of dicht: een filter in het adres wint altijd van de bewaarde
       voorkeur — de routeregel in hoofdstuk 7.0 */
    var filtersOpen = tabGevraagd || ouderdom !== 'alle' || leesFiltersOpen();

    var paneelId = 'fin-paneel';

    var kop = ui.pageHeader({
      titel: 'Financiën',
      /* zie schermRelaties(): rechts uitgelijnd, zoals de mockup */
      actiePlaats: 'rechts',
      primair: {
        label: 'Nieuwe factuur',
        ico: 'plus',
        /* de factuureditor is een eigen route en bewust géén tab van dit
           werkgebied (beslissing 2.2): hij heeft een eigen onopgeslagen
           staat. Zonder id opent hij een nieuwe factuur — dat is de
           bestaande grammatica van #/factuur/<id>, geen verzonnen pad. */
        onClick: function () { ga(ctx, factuurRoute(model, null)); }
      },
      /* de boekhouding-CSV staat volgens de mappingtabel op twee plekken:
         hier en onder Instellingen → Omgeving en data. Eén bouwfunctie,
         twee ingangen — en dit is de ingang die de eigenaar dagelijks ziet.
         Zonder periode gaan alle facturen mee; dat is precies wat de haak
         doet als je hem zonder `van` en `tot` aanroept. */
      menu: menuLijst([
        /* DE DOORLINK UIT DE MAPPINGTABEL. Hij gaat via de bestaande haak
           nummerreeksenOpenen() uit ctx.acties en valt alleen terug op de
           kale route als die haak ontbreekt — zie nummerreeksenGa(). Dit is
           het enige menu-item dat óók zonder haak blijft staan, want de
           bestemming is geen dialoog maar een pagina die hoe dan ook
           bestaat. Zie nummerreeksKaart() voor de tweede ingang. */
        {
          label: 'Nummerreeksen en waakhond',
          ico: 'instellingen',
          onKies: function () { nummerreeksenGa(ctx, model); }
        },
        haakItem(ctx, 'boekhoudCsv', 'Boekhouding-CSV exporteren', 'bestand', null)
      ])
    });

    var hoofd = [];

    /* --- de cashflowkaart --- */
    hoofd.push(cashflowKaart(ctx, ui, chart, data, facturen));

    /* --- de segmentknop: Te doen · Archief, tellingen uit de echte lijst --- */
    var perStand = { tedoen: [], archief: [] };
    facturen.forEach(function (f) {
      perStand[standVan(f, meldingIndex[f.inv.id])].push(f);
    });
    var inStand = perStand[stand];

    var standChips = ui.filterChips({
      label: 'Stand',
      actief: stand,
      chips: FIN_STANDEN.map(function (s) {
        /* altijd:true — een lege stand is een mededeling ("niets te doen")
           en geen reden om de knop te verstoppen */
        return { key: s.key, label: s.label, count: perStand[s.key].length, altijd: true };
      }),
      onKies: function (key) {
        if (key === stand) return;
        /* de tab reist mee, hij werkt in beide standen; de ouderdom alleen
           waar hij geldt — financienRoute() laat hem anders vallen */
        ga(ctx, financienRoute(model, { stand: key, tab: tab, ouderdom: ouderdom }));
      }
    });
    /* .u-chips draagt zelf een ondermarge; in deze rij regelt de wikkel die */
    standChips.style.marginBottom = '0';

    /* --- het filterpaneel: de soorttabs en de ouderdomstrap, één klik dieper --- */
    var filtersId = 'fin-filters';
    var filterKinderen = [];

    var tabSpecs = FIN_TABS.map(function (t) {
      var spec = {
        key: t.key,
        label: t.label,
        /* de telling is die BINNEN de stand: het aantal rijen dat je ziet
           als je de tab kiest, en niets anders. "Concepten 0" in het
           archief is dus een eerlijke nul. */
        count: inStand.filter(function (f) { return inTab(f, t.key); }).length
      };
      if (t.key === tab) spec.panelId = paneelId;
      return spec;
    });
    filterKinderen.push(ui.tabs({
      tabs: tabSpecs,
      actief: tab,
      label: 'Soort',
      onKies: function (key) {
        if (key === tab) return;
        /* wie een filter gebruikt wil het paneel zien: zonder deze regel
           klapt het dicht zodra "alle soorten" gekozen wordt, want die tab
           staat niet in het adres en dan telt alleen de voorkeur */
        bewaarFiltersOpen(true);
        ga(ctx, financienRoute(model, { stand: stand, tab: key, ouderdom: ouderdom }));
      }
    }));

    /* --- de ouderdomstrap, alleen waar hij iets betekent --- */
    if (ouderdomGeldt(stand, tab)) {
      var basis = inStand.filter(function (f) { return inTab(f, tab); });
      filterKinderen.push(ui.filterChips({
        label: 'Ouderdom van openstaande facturen',
        actief: ouderdom,
        chips: OUDERDOM_FILTERS.map(function (o) {
          return {
            key: o.key,
            label: o.label,
            altijd: o.altijd,
            /* de telling van een bakje is het aantal facturen dat er ECHT in
               valt; "Alle facturen" telt de hele tab, inclusief de concepten
               en de deels betaalde die in geen enkel bakje zitten. Daarom
               tellen de vier bakjes samen niet op tot de eerste chip, en dat
               hoort ook niet: de trap gaat over openstaand geld. */
            count: basis.filter(function (f) { return inOuderdom(model, f, o.key, vandaag); }).length
          };
        }),
        onKies: function (key) {
          if (key === ouderdom) return;
          bewaarFiltersOpen(true);
          ga(ctx, financienRoute(model, { stand: stand, tab: tab, ouderdom: key }));
        }
      }));
      filterKinderen.push(ui.el('p', {
        class: 'u-row-sub',
        style: 'display:block;margin:10px 0 16px;',
        text: 'De trap telt de dagen sinds de factuurdatum en kijkt alleen naar facturen waar nog geld op openstaat — dezelfde vier bakjes als het oude blok Geld.'
      }));
    }

    var filtersVak = ui.el('div', { id: filtersId }, filterKinderen);
    filtersVak.hidden = !filtersOpen;

    /* DE KNOP FILTERS. Zolang het paneel dicht is noemt de knop wat er
       actief is, zodat een kortere lijst nooit zonder verklaring blijft.
       Dat kan alleen ná een klik op de knop zelf voorkomen — een filter in
       het adres klapt het paneel immers uit — maar dan is het er wel. */
    var actieveFilters = [];
    if (tab !== 'alle') actieveFilters.push(tabLabel(tab));
    if (ouderdom !== 'alle' && ouderdomSpec(ouderdom)) actieveFilters.push(ouderdomSpec(ouderdom).label);
    var knopExtra = ui.el('span', { style: 'color:var(--ink-2);font-size:13.5px;' });
    var filtersKnop = ui.el('button', {
      type: 'button',
      /* geen .klein: 44px is de ondergrens voor een aanraakscherm */
      class: 'u-btn ghost',
      'aria-controls': filtersId,
      onclick: function () {
        var open = filtersVak.hidden;
        filtersVak.hidden = !open;
        bewaarFiltersOpen(open);
        zetFiltersKnop(open);
      }
    }, [ui.icon('filter', 18), ui.el('span', { text: 'Filters' }), knopExtra]);
    function zetFiltersKnop(open) {
      filtersKnop.setAttribute('aria-expanded', open ? 'true' : 'false');
      knopExtra.textContent = (!open && actieveFilters.length) ? actieveFilters.join(' · ') : '';
      knopExtra.hidden = !knopExtra.textContent;
    }
    zetFiltersKnop(filtersOpen);

    /* de klasse bestaat nog niet in admin-ui.css (css-wensen-relaties.css
       vraagt haar aan); tot die tijd doet de inline stijl hetzelfde */
    hoofd.push(ui.el('div', {
      class: 'u-fin-standrij',
      style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px;'
    }, [standChips, filtersKnop]));
    hoofd.push(filtersVak);

    /* --- de lijst --- */
    var zichtbaar = sorteerStand(inStand.filter(function (f) {
      return inTab(f, tab) && inOuderdom(model, f, ouderdom, vandaag);
    }), stand, meldingIndex);

    var paneelKinderen = [];

    /* de eerlijkheidsregels van beslissing 2.8, per tab en alleen waar ze
       gelden — een tekst die overal staat leest niemand meer */
    if (tab === 'betalingen') {
      paneelKinderen.push(ui.el('p', {
        class: 'u-sub',
        style: 'margin-bottom:14px;',
        text: 'Deze lijst toont per factuur wat er betaald is. Deelbetalingen worden nog niet als losse regels vastgelegd, dus er staat één bedrag per factuur.'
      }));
    }

    var rijen = zichtbaar.map(function (f) {
      return factuurRij(ctx, ui, chart, model, f, projecten, klanten, meldingIndex[f.inv.id] || []);
    });

    if (!rijen.length && ouderdom !== 'alle') {
      /* EEN LEEG BAKJE IS IETS ANDERS DAN EEN LEGE TAB. "Nog geen facturen"
         zou hier onwaar zijn: ze staan er wel, ze vallen alleen buiten dit
         bakje. De uitweg staat erbij. */
      paneelKinderen.push(ui.emptyState({
        titel: 'Geen factuur in dit bakje',
        uitleg: 'Er staat op dit moment geen factuur open die ' +
          ((ouderdomSpec(ouderdom) && str(ouderdomSpec(ouderdom).kort))
            ? str(ouderdomSpec(ouderdom).kort)
            : 'in dit bakje valt') + '.',
        actie: {
          label: 'Toon alle facturen',
          onClick: function () { ga(ctx, financienRoute(model, { stand: stand, tab: tab })); }
        }
      }));
    } else {
      paneelKinderen.push(ui.entityList(rijen, {
        leegTitel: leegTitelVoor(stand, tab),
        leegUitleg: leegUitlegVoor(stand, tab)
      }));
    }

    hoofd.push(ui.el('div', {
      id: paneelId,
      role: 'tabpanel',
      'aria-labelledby': paneelId + '-tab',
      tabindex: '0'
    }, paneelKinderen));

    /* --- de rail --- */
    var rail = [
      ritmeKaart(ctx, ui, chart, data, facturen),
      volgendeBetalingKaart(ctx, ui, chart, model, facturen, projecten, klanten, vandaag),
      nummerreeksKaart(ctx, ui, model)
    ];

    return pagina(ui, kop, hoofd, rail);
  }

  /* ---- de doorlink naar de nummerreeksen ------------------------------
     Mappingtabel: "nummeringswaakhond + nummeraudit → Instellingen →
     Nummerreeksen, doorlink vanuit Financiën."

     DE WAAKHOND WORDT HIER NIET NAGEBOUWD. Hij leest de uitgegeven nummers
     per voorvoegsel en per jaar, zoekt gaten en dubbelen en bewaart de
     verklaring die je bij een gat opschrijft; de nummer-audit legt daarnaast
     elk uitgegeven, overgeslagen en vervallen nummer vast met zijn reden.
     Die twee horen bij de uitgifte zelf en staan onder Instellingen →
     Nummerreeksen. Een tweede analyse hier zou een tweede waarheid zijn over
     dezelfde reeks — precies wat de statusvertaler hierboven voor de
     factuurstatus voorkomt.

     WAT ER IN FINANCIËN ONTBRAK was dan ook niet de analyse maar de WEG
     ERHEEN, en een woord dat zegt dat hij bestaat. Beide staan hier. De twee
     getallen komen uit de opgeslagen instellingen en nergens anders vandaan:
     de lopende reeks uit settings.factuurReeks (voorvoegsel en jaar, de
     afgeleide die de waakhond zelf ook leest) en het aantal verklaringen uit
     settings.nummerVerklaringen. Staat er nog niets, dan zegt de kaart dat
     in plaats van een nul te tonen die op een meting lijkt. */
  function instellingRoute(model, categorie) {
    if (model && fn(model.buildRoute)) {
      return model.buildRoute({ area: 'instellingen', tab: str(categorie) || null });
    }
    return '#/instellingen' + (str(categorie) ? '/' + encodeURIComponent(str(categorie)) : '');
  }

  /* DE ENE WEG NAAR NUMMERREEKSEN, VOOR ALLEBEI DE INGANGEN.
     ctx.acties draagt nummerreeksenOpenen(): de bestaande haak die de shell
     zelf naar Instellingen → Nummerreeksen stuurt. Die haak is de bron, want
     hij hoort bij de shell die de route kent — dit bestand bouwt hem niet na.
     Alleen als hij ontbreekt blijft de kale route over, zodat de doorlink ook
     werkt in een schermtest zonder actiecontract. */
  function nummerreeksenGa(ctx, model) {
    var h = haak(ctx, 'nummerreeksenOpenen');
    if (h) return h();
    return ga(ctx, instellingRoute(model, 'nummerreeksen'));
  }

  function nummerreeksKaart(ctx, ui, model) {
    var settings = opt(lijsten(ctx).settings);
    var reeks = opt(settings.factuurReeks);

    /* alleen een verklaring MET tekst telt; een lege sleutel is precies het
       gat dat nog om een antwoord vraagt */
    var verklaringen = 0;
    if (isObj(settings.nummerVerklaringen)) {
      Object.keys(settings.nummerVerklaringen).forEach(function (nummer) {
        var v = settings.nummerVerklaringen[nummer];
        if (v && str(v.tekst)) verklaringen += 1;
      });
    }

    var reeksTekst = (str(reeks.prefix) && reeks.jaar)
      ? (str(reeks.prefix) + '-' + str(reeks.jaar))
      : 'nog niet ingesteld';

    return railKaart(ui, 'Nummering', [
      railRegel(ui, 'Lopende reeks', reeksTekst),
      railRegel(ui, 'Vastgelegde verklaringen',
        verklaringen ? String(verklaringen) : 'geen'),
      ui.el('p', {
        class: 'u-lees',
        style: 'margin:14px 0 0;',
        text: 'De nummeringswaakhond controleert per voorvoegsel en per jaar of de reeks aaneengesloten is, en de nummer-audit legt elk uitgegeven, overgeslagen en vervallen nummer vast met zijn reden. Allebei staan ze onder Instellingen → Nummerreeksen.'
      }),
      ui.el('div', { style: 'margin-top:14px;' },
        ui.el('button', {
          type: 'button',
          class: 'u-btn ghost breed',
          text: 'Open Nummerreeksen',
          onclick: function () { nummerreeksenGa(ctx, model); }
        }, ui.icon('chevron', 18)))
    ]);
  }

  function tabLabel(key) {
    var uit = str(key);
    FIN_TABS.forEach(function (t) { if (t.key === key) uit = t.label; });
    return uit;
  }

  /* DE LEGE STANDEN, PER STAND ÉN PER TAB. Eén tekst voor beide standen zou
     ergens onwaar zijn: "een concept verschijnt hier" klopt in Te doen en
     niet in het archief, want een concept wordt nooit gearchiveerd; en
     "nog geen betalingen" in Te doen zou verzwijgen dat de betaalde
     facturen gewoon in het archief staan. Elke zin zegt daarom ook waar het
     ontbrekende wél te vinden is. */
  function leegTitelVoor(stand, tab) {
    if (stand === 'archief') {
      if (tab === 'concepten') return 'Geen conceptfacturen in het archief';
      if (tab === 'betalingen') return 'Nog geen betaalde facturen';
      if (tab === 'creditnotas') return 'Nog geen creditnota’s';
      if (tab === 'facturen') return 'Nog geen afgeronde facturen';
      return 'Nog niets in het archief';
    }
    if (tab === 'concepten') return 'Geen conceptfacturen';
    if (tab === 'betalingen') return 'Geen deelbetalingen';
    if (tab === 'creditnotas') return 'Geen creditnota’s te doen';
    if (tab === 'facturen') return 'Geen openstaande facturen';
    return 'Niets te doen';
  }
  function leegUitlegVoor(stand, tab) {
    if (stand === 'archief') {
      if (tab === 'concepten') return 'Een concept is nog geen factuur en wordt niet gearchiveerd. Concepten staan onder Te doen.';
      if (tab === 'betalingen') return 'Zodra een factuur volledig betaald is, verschijnt hij hier met het betaalde bedrag en de datum.';
      if (tab === 'creditnotas') return 'Zodra een factuur gecrediteerd is, staat hij hier.';
      if (tab === 'facturen') return 'Zodra een verstuurde factuur betaald, gecrediteerd of geannuleerd is, staat hij hier.';
      return 'Zodra een factuur betaald, gecrediteerd of geannuleerd is, verschijnt hij hier.';
    }
    if (tab === 'concepten') return 'Een conceptfactuur ontstaat automatisch zodra je een betaalfase op akkoord zet, of met de hand vanuit een project.';
    if (tab === 'betalingen') return 'Hier staan facturen waarop al iets betaald is maar die nog niet volledig voldaan zijn. Volledig betaalde facturen staan in het archief.';
    if (tab === 'creditnotas') return 'Een gecrediteerde factuur is afgerond en staat in het archief.';
    if (tab === 'facturen') return 'Er staat op dit moment geen verstuurde factuur open. Betaalde facturen staan in het archief.';
    return 'Er staat geen factuur open en er wacht geen concept, bezwaar of gemelde betaling. Maak een factuur vanuit een project of met de knop hierboven.';
  }

  /* ---- de cashflowkaart (spec 5.7) ------------------------------------
     BRON: CP_DATA.cashflow(facturen, 6, nu). Die functie boekt het bedrag
     van een verstuurde factuur op de maand van createdAt en het betaalde
     bedrag op de maand van paidAt, allebei in centen, en telt conceptrijen
     niet mee — die zijn nog niet de deur uit.
     Staven achter de curve, precies zoals hoofdstuk 4.3 het beschrijft: de
     lichte staven zijn wat er gefactureerd is, de vloeiende lijn is wat er
     binnenkwam. Het takje rechtsboven is spec 4.20 en staat op de vijf
     kaarten die de mockup ervoor aanwijst. */
  function cashflowKaart(ctx, ui, chart, data, facturen) {
    var kinderen = [];

    if (!data || !fn(data.cashflow)) {
      return ui.el('section', { class: 'u-hero', style: 'margin-bottom:32px;' },
        ui.emptyTile({
          icoon: 'financien',
          titel: 'Cashflow is nu niet te berekenen',
          uitleg: 'De afgeleide reeks komt uit CP_DATA.cashflow; die laag is op dit moment niet geladen.'
        }));
    }

    var cf = data.cashflow(facturen.map(function (f) { return f.inv; }), 6, opt(ctx).nu);
    var labels = arr(cf.reeks).map(function (p) { return str(p.label); });
    var gefactureerd = arr(cf.reeks).map(function (p) { return getal(p.gefactureerdCents); });
    var betaald = arr(cf.reeks).map(function (p) { return getal(p.betaaldCents); });

    kinderen.push(ui.el('div', { class: 'u-hero-kop' }, [
      ui.el('div', null, [
        ui.el('span', { class: 'u-kicker', style: 'display:block;', text: 'Cashflow overzicht' }),
        ui.el('span', {
          class: 'u-enorm u-bedrag',
          style: 'display:block;margin-top:6px;',
          text: euro(chart, cf.totaalBetaaldCents)
        }),
        ui.el('span', {
          class: 'u-row-sub',
          style: 'display:block;',
          text: 'binnengekomen in ' + (labels.length ? labels[0] + ' t/m ' + labels[labels.length - 1] : 'de laatste zes maanden') +
            ' · ' + euro(chart, cf.totaalGefactureerdCents) + ' gefactureerd'
        })
      ])
    ]));

    kinderen.push(chart && fn(chart.areaChart)
      ? chart.areaChart({
        titel: 'Cashflow per maand',
        reeksen: [{ label: 'Betaald', punten: betaald, kleur: 'ink' }],
        staven: { punten: gefactureerd, kleur: 'line-2', breedte: 22 },
        xLabels: labels,
        hoogte: 220,
        centen: true,
        /* de legenda noemt allebei de reeksen; zonder die twee woorden is
           niet te zien welke van de twee de staven zijn */
        legenda: [
          { label: 'Gefactureerd', kleur: 'line-2' },
          { label: 'Betaald', kleur: 'ink' }
        ]
      })
      : ui.emptyTile({ icoon: 'financien', titel: 'Grafiek niet beschikbaar', uitleg: 'De tekenlaag CP_CHART is niet geladen.' }));

    /* twee eerlijke voetnoten, en alleen als ze iets te melden hebben */
    var voetnoten = [];
    if (cf.concepten > 0) {
      voetnoten.push(nlAantal(cf.concepten, 'conceptfactuur staat', 'conceptfacturen staan') +
        ' klaar en telt niet mee: die is nog niet verstuurd.');
    }
    if (cf.betaaldZonderDatum > 0) {
      voetnoten.push(nlAantal(cf.betaaldZonderDatum, 'betaling heeft', 'betalingen hebben') +
        ' geen betaaldatum en staat daarom in geen enkele maand.');
    }
    if (voetnoten.length) {
      kinderen.push(ui.el('p', {
        class: 'u-sub',
        style: 'margin-top:16px;',
        text: voetnoten.join(' ')
      }));
    }

    var kaart = ui.el('section', {
      class: 'u-hero u-ornament-host',
      style: 'margin-bottom:32px;',
      'aria-label': 'Cashflow overzicht'
    }, kinderen);

    if (chart && fn(chart.leafOrnament)) {
      kaart.appendChild(chart.leafOrnament({ hoek: 'rechtsboven', maat: 140 }));
    }
    return kaart;
  }

  /* ---- de acties bij één factuurrij -----------------------------------
     De primaire actie komt uit STAND_PRIMAIR en dus uit de STATUSVERTALER;
     hij wordt nooit uit inv.status afgeleid. Ontbreekt de haak, dan valt de
     rij terug op de route naar de factuureditor — dat is geen schrijfactie
     maar wel een werkende weg, en het is de bestaande grammatica.

     IN HET ••• STAAN DE VIER DIE DE OPDRACHT NOEMT: herinnering sturen, PDF,
     annuleren en openen in de editor. Betaald markeren staat er alleen bij
     als hij niet al de primaire knop IS — twee keer dezelfde actie in één
     rij is een tweede ingang zonder tweede betekenis.

     WAAROM ANNULEREN GEEN EXTRA BEVESTIGING KRIJGT: de haak brengt je naar
     de factuureditor en opent daar openInvoiceCancelModal, en díé dialoog is
     de bevestiging — hij vraagt om een reden. Een inline "weet je het zeker"
     ervoor zou een bevestiging zijn voor een NAVIGATIE, en daarna nog een
     tweede voor de echte handeling. De kritieke kleur en de plek onderin het
     menu dragen de waarschuwing. */
  function factuurActies(ctx, f, meldingen) {
    var inv = f.inv;
    var stand = f.stand;
    var spec = STAND_PRIMAIR[stand.eindCode] || null;

    var primair = null;
    var primaireHaak = '';
    if (stand.eindCode === 'disputed' && haak(ctx, 'bezwaarBehandelen')) {
      /* BEZWAAR (0021): de haak springt naar de editor én zet daar de focus
         op de reden uit invoice_audit — preciezer dan "Open in de editor",
         die in het ••• blijft bestaan. Zonder haak (een oudere shell) blijft
         de gewone primaire actie uit STAND_PRIMAIR staan. */
      primair = haakKnop(ctx, 'bezwaarBehandelen', 'Bekijk bezwaar', 'waarschuwing', inv,
        'Bezwaar van de klant bekijken en afhandelen');
      primaireHaak = 'bezwaarBehandelen';
    } else if (spec && spec.naam === 'factuurBetaaldMarkeren' && arr(meldingen).length && haak(ctx, 'betalingVerifieren')) {
      /* GEMELDE BETALING (0021): de klik die hier hoort is Bevestig, en die
         staat bij de melding onder de rij (meldingBlok). Een tweede knop
         "Betaald markeren" ernaast zou hetzelfde venster openen, alleen
         zonder de gegevens van de klant; hij verhuist naar het •••, waar hij
         blijft voor wie de melding wil negeren en zelf wil boeken. */
      primair = null;
    } else if (spec) {
      primair = haakKnop(ctx, spec.naam, spec.label, spec.ico, inv, stand.actie);
      primaireHaak = primair ? spec.naam : '';
    }

    /* een factuur die de deur uit is en nog geld open heeft, kan betaald
       gemeld worden; een concept, een creditnota en een betaalde niet */
    var openstaand = !stand.isConcept && !stand.isCredit && stand.openCents > 0;

    var menu = menuLijst([
      (openstaand && primaireHaak !== 'factuurBetaaldMarkeren')
        ? haakItem(ctx, 'factuurBetaaldMarkeren', 'Betaald markeren', 'vinkje', inv) : null,
      openstaand
        ? haakItem(ctx, 'factuurHerinnering', 'Herinnering sturen', 'mail', inv) : null,
      (primaireHaak !== 'factuurPdf')
        ? haakItem(ctx, 'factuurPdf', 'Factuurdocument (PDF)', 'bestand', inv) : null,
      (primaireHaak !== 'factuurOpenen')
        ? haakItem(ctx, 'factuurOpenen', 'Open in de factuureditor', 'potlood', inv) : null,
      { scheiding: true },
      (!stand.isBetaald && !stand.isCredit && stand.eindCode !== 'cancelled')
        ? haakItem(ctx, 'factuurAnnuleren', 'Factuur annuleren…', 'sluiten', inv, { gevaarlijk: true })
        : null
    ]);

    return { primair: primair, menu: menu };
  }

  /* ---- de factuurrij (spec 5.7) ---------------------------------------
     Zeven sloten: icoontegel, titel + sub, bedrag + datum, statusstip +
     label, de primaire knop, het ••• en de chevron. De klassen staan in
     admin-ui.css hoofdstuk 8o; .u-invoicerow is een gewone flexrij, dus de
     twee nieuwe sloten passen erin zonder een maat of een kleur te zetten.

     DE RIJ IS GEEN <button> MEER MAAR EEN <div>, om exact dezelfde reden als
     CP_UI.entityRow: een knop in een knop is ongeldige HTML en de binnenste
     wordt in de meeste browsers onbereikbaar. Het klikbare deel (tegel,
     titel, sub) is één knop met .u-row-klik — dezelfde klasse die entityRow
     daarvoor gebruikt — en de rest van de rij opent ook, behalve een klik
     die in het staartstuk begint. Daar zitten de acties. */
  /* ---- het voorstel onder de rij: de gemelde betaling (0021) -----------
     Eén regel per melding, in hele zinnen, met rechts de knop Bevestig die
     het bestaande betaalvenster opent met datum, bedrag en kenmerk van de
     klant voorgevuld (ctx.acties.betalingVerifieren). Zonder die haak staat
     er geen knop en blijft de regel staan: de melding is dan te lezen, en de
     weg naar het venster loopt via "Betaald markeren" in het •••. Het blok
     is een eigen regel in de flexrij (flex-basis:100%), zodat de zeven
     sloten erboven niet verschuiven; de hairline erboven is het token uit
     hoofdstuk 1, net als bij hairline(). */
  function meldingBlok(ctx, ui, chart, model, f, meldingen) {
    var h = haak(ctx, 'betalingVerifieren');
    var regels = arr(meldingen).map(function (m) {
      var zin = meldingZin(chart, model, m);
      var verschil = verschilZin(chart, m, f.stand);
      var knop = h ? ui.el('button', {
        type: 'button',
        class: 'u-btn klein',
        title: 'Melding controleren en bevestigen in het betaalvenster',
        onclick: function () { h(m); }
      }, [ui.el('span', { text: 'Bevestig' }), ui.icon('vinkje', 16)]) : null;
      return ui.el('div', {
        class: 'u-invoicerow-melding-regel',
        style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;'
      }, [
        ui.el('span', {
          class: 'u-invoicerow-sub',
          style: 'display:block;flex:1 1 240px;min-width:0;',
          text: verschil ? (zin + ' ' + verschil) : zin
        }),
        knop
      ]);
    });
    /* de twee klassen bestaan nog niet in admin-ui.css (css-wensen-relaties.css
       vraagt ze aan); tot die tijd doen de inline stijlen hetzelfde */
    return ui.el('div', {
      class: 'u-invoicerow-melding',
      style: 'flex-basis:100%;display:flex;flex-direction:column;gap:8px;margin-top:4px;padding-top:12px;border-top:1px solid var(--line);'
    }, regels);
  }

  /* `meldingen` is de lijst onbevestigde klantmeldingen op deze factuur uit
     meldingIndexVan(); een aanroeper zonder index (een schermtest) laat hem
     weg en dan wordt hij hier voor deze ene rij opgezocht */
  function factuurRij(ctx, ui, chart, model, f, projecten, klanten, meldingen) {
    var inv = f.inv;
    var stand = f.stand;
    var project = projecten[inv.projectId] || null;
    var klant = (project && klanten[project.clientId]) ? klanten[project.clientId] : null;
    var meldingLijst = (meldingen === undefined) ? arr(meldingIndexVan(ctx)[inv.id]) : arr(meldingen);

    var titel = [str(inv.invoiceNumber), str(inv.label) || 'Factuur']
      .filter(function (x) { return !!x; }).join(' · ');

    var sub = [klant ? str(klant.company) : '', project ? str(project.name) : '']
      .filter(function (x) { return !!x; }).join(' · ');

    /* het datumslot: bij een betaalde factuur de betaaldatum, bij de rest de
       vervaldatum. Dat is de datum die er op dat moment toe doet. */
    var datumTekst = '';
    if (stand.isBetaald && inv.paidAt) datumTekst = 'Betaald ' + datum(model, inv.paidAt);
    else if (stand.vervalISO) datumTekst = (stand.teLaat ? 'Verviel ' : 'Vervalt ') + datum(model, stand.vervalISO);
    else if (inv.createdAt) datumTekst = 'Aangemaakt ' + datum(model, inv.createdAt);

    /* het bedrag: bij een deels betaalde factuur het OPENSTAANDE bedrag met
       het totaal eronder, want dat is wat er nog moet gebeuren */
    var deels = stand.betaaldCents > 0 && stand.openCents > 0;
    var bedragTekst = euro(chart, deels ? stand.openCents : stand.bedragCents);

    var tegelToon = stand.teLaat ? 'crit'
      : (stand.isBetaald ? 'ok' : (stand.isConcept ? 'neutraal' : 'info'));

    function openen() { ga(ctx, factuurRoute(model, inv.id)); }

    var acties = factuurActies(ctx, f, meldingLijst);

    /* de chip "Betaling gemeld" in de toon 'wacht' (oranje): dit vraagt werk
       van mij en is nog niet te laat — precies de betekenis van die toon in
       CP_UI. Hij staat naast de titel en niet in het statusslot, want de
       stip daar zegt wat de FACTUUR is en de chip zegt wat de klant beweert. */
    var meldingChip = meldingLijst.length ? ui.statusChip({
      label: 'Betaling gemeld',
      toon: 'wacht',
      titel: 'De klant meldt een betaling die nog niet bevestigd is'
    }) : null;
    if (meldingChip) meldingChip.style.marginLeft = '8px';
    if (meldingChip) meldingChip.style.verticalAlign = 'middle';

    /* DE RIJ HEEFT ER TWEE SLOTEN BIJ GEKREGEN (de primaire knop en het •••)
       en past daardoor niet meer altijd op één regel: met een rail van 400px
       houdt de werkkolom op een 1280px-scherm ruim vijfhonderd pixels over
       voor zeven sloten. Zonder de twee regels hieronder knijpt het
       tekstblok zichzelf tot nul en breekt de factuurtitel letter voor
       letter af. `flex-wrap` laat de rij netjes doorlopen op een tweede
       regel, en de basis van 240px zegt hoeveel ruimte de tekst nodig heeft
       vóórdat dat gebeurt. */
    var klikKnop = ui.el('button', {
      type: 'button',
      class: 'u-invoicerow-main u-row-klik',
      style: 'flex:1 1 240px;',
      title: stand.actie,
      onclick: openen
    }, [
      ui.iconTile({ icoon: stand.isCredit ? 'pijlOmlaag' : 'bestand', toon: tegelToon, maat: 44 }),
      /* flex:1 EN min-width:0 allebei: zonder het eerste krimpt de tekst tot
         de breedte van het langste woord, zonder het tweede kan hij niet
         afbreken en duwt hij de bedragkolom van de rij af. Dat is dezelfde
         combinatie die .u-invoicerow-main in admin-ui.css op de rij zelf zet;
         hij hoort hier op het tekstdeel ván de klikknop. */
      ui.el('span', { style: 'flex:1;min-width:0;' }, [
        ui.el('span', { class: 'u-invoicerow-titel' }, [titel, meldingChip]),
        sub ? ui.el('span', { class: 'u-invoicerow-sub', style: 'display:block;', text: sub }) : null
      ])
    ]);

    /* margin-left:auto houdt de acties rechts — óók wanneer de rij op een
       tweede regel doorloopt en het staartstuk daar als eerste item begint. */
    var staart = ui.el('span', { style: 'display:flex;align-items:center;gap:10px;flex:none;margin-left:auto;' }, [
      acties.primair ? knopUit(ui, acties.primair, 'klein') : null,
      acties.menu.length
        ? ui.contextMenu({
          knop: { titel: 'Meer acties bij factuur ' + (str(inv.invoiceNumber) || str(inv.label) || '') },
          items: acties.menu,
          uitlijning: 'rechts'
        }).el
        : null,
      (!acties.primair && !acties.menu.length) ? chevron(ui) : null
    ]);

    /* het voorstel onder de rij: alleen bij een onbevestigde melding, en dan
       als laatste kind zodat hij op zijn eigen regel valt (flex-wrap) */
    var blok = meldingLijst.length ? meldingBlok(ctx, ui, chart, model, f, meldingLijst) : null;

    var rij = ui.el('div', { class: 'u-invoicerow', style: 'flex-wrap:wrap;' }, [
      klikKnop,
      ui.el('span', { class: 'u-invoicerow-geld' }, [
        ui.el('span', { class: 'u-invoicerow-bedrag', text: bedragTekst }),
        ui.el('span', {
          class: 'u-invoicerow-datum',
          text: deels
            ? ('open van ' + euro(chart, stand.bedragCents))
            : datumTekst
        })
      ]),
      ui.el('span', { class: 'u-invoicerow-status' },
        ui.statusDot({ toon: stand.toon, label: stand.label, titel: stand.actie })),
      staart,
      blok
    ]);

    /* de rest van de rij opent ook — behalve een klik die in het staartstuk
       of in het meldingblok begon, want daar zitten de knoppen. Zelfde regel
       als CP_UI.entityRow. */
    rij.addEventListener('click', function (e) {
      var doel = e && e.target;
      if (doel && klikKnop.contains && klikKnop.contains(doel)) return;
      if (doel && staart.contains && staart.contains(doel)) return;
      if (doel && blok && blok.contains && blok.contains(doel)) return;
      openen();
    });

    return rij;
  }

  function chevron(ui) {
    var s = ui.icon('chevron', 18);
    s.setAttribute('class', 'u-row-chevron');
    return s;
  }

  /* ---- Factuur ritme (spec 5.7, rail) ---------------------------------
     BRON: CP_DATA.invoiceRhythm(facturen, 6, nu) — betaald, openstaand en te
     laat over zes maanden, gerekend naar createdAt, met dezelfde vervalklok
     als de rijen hierboven. Conceptfacturen staan in geen van de drie en
     komen apart terug; de legenda zegt dat ook. */
  function ritmeKaart(ctx, ui, chart, data, facturen) {
    if (!data || !fn(data.invoiceRhythm) || !chart || !fn(chart.donut)) {
      return railKaart(ui, 'Factuur ritme', ui.emptyTile({
        icoon: 'financien',
        titel: 'Nog niet te berekenen',
        uitleg: 'Deze verdeling komt uit CP_DATA.invoiceRhythm en CP_CHART.donut.'
      }));
    }

    var r = data.invoiceRhythm(facturen.map(function (f) { return f.inv; }), 6, opt(ctx).nu);

    if (!r.totaalAantal) {
      return railKaart(ui, 'Factuur ritme', ui.emptyTile({
        icoon: 'financien',
        titel: 'Nog geen verstuurde facturen',
        uitleg: r.concepten
          ? nlAantal(r.concepten, 'conceptfactuur staat', 'conceptfacturen staan') + ' klaar, maar er is nog niets verstuurd.'
          : 'Zodra je facturen verstuurt, zie je hier hoe snel ze betaald worden.'
      }));
    }

    /* de tinten dragen hier BETEKENIS (betaald / openstaand / te laat) en
       blijven daarom kleur — hoofdstuk 0 van de spec. De legenda die
       CP_CHART.donut eronder zet noemt bij elk segment het percentage, dus
       kleur is nooit de enige drager. */
    var donut = chart.donut({
      titel: 'Factuur ritme over zes maanden',
      maat: 200,
      dikte: 22,
      segmenten: [
        { label: r.betaald.label, waarde: r.betaald.aantal, kleur: 'ok' },
        { label: r.openstaand.label, waarde: r.openstaand.aantal, kleur: 'info' },
        { label: r.teLaat.label, waarde: r.teLaat.aantal, kleur: 'crit' }
      ],
      midden: { waarde: String(r.totaalAantal), label: 'facturen' },
      legenda: 'percentage'
    });

    var kinderen = [ui.el('div', { style: 'display:flex;justify-content:center;' }, donut)];

    kinderen.push(hairline(ui, '18px 0 8px'));
    kinderen.push(railRegel(ui, 'Openstaand bedrag', euro(chart, r.openstaand.cents)));
    kinderen.push(railRegel(ui, 'Waarvan te laat', euro(chart, r.teLaat.cents),
      r.teLaat.cents > 0
        ? ui.statusDot({ toon: 'kritiek', label: euro(chart, r.teLaat.cents) })
        : ui.statusDot({ toon: 'klaar', label: 'Niets te laat' })));
    if (r.concepten) {
      kinderen.push(ui.el('p', {
        class: 'u-row-sub',
        style: 'margin-top:10px;',
        text: nlAantal(r.concepten, 'conceptfactuur telt', 'conceptfacturen tellen') +
          ' niet mee: nog niet verstuurd.'
      }));
    }

    return railKaart(ui, 'Factuur ritme', kinderen);
  }

  /* ---- Volgende verwachte betaling (spec 5.7, rail) -------------------
     De openstaande factuur met de EERSTE vervaldatum. Bedrag, vervaldatum en
     de productfoto van het bijbehorende project (hoofdstuk 7: de eerste
     gepubliceerde foto van het project is de bron voor elk productbeeld). */
  function volgendeBetalingKaart(ctx, ui, chart, model, facturen, projecten, klanten, vandaag) {
    var open = facturen.filter(function (f) {
      return !f.stand.isConcept && !f.stand.isCredit && f.stand.openCents > 0;
    });
    open.sort(function (a, b) {
      var x = str(a.stand.vervalISO) || '9999-12-31';
      var y = str(b.stand.vervalISO) || '9999-12-31';
      if (x < y) return -1;
      if (x > y) return 1;
      return str(a.inv.id) < str(b.inv.id) ? -1 : 1;
    });

    if (!open.length) {
      return railKaart(ui, 'Volgende verwachte betaling', ui.emptyTile({
        icoon: 'vinkje',
        titel: 'Er staat niets open',
        uitleg: 'Alle verstuurde facturen zijn betaald.'
      }));
    }

    var f = open[0];
    var inv = f.inv;
    var project = projecten[inv.projectId] || null;
    var klant = (project && klanten[project.clientId]) ? klanten[project.clientId] : null;
    var foto = project ? projectFoto(model, L(lijsten(ctx), 'media'), project.id) : '';

    var wanneer = '';
    if (f.stand.vervalISO) {
      wanneer = datum(model, f.stand.vervalISO);
      if (model && fn(model.relativeDay)) {
        var rel = model.relativeDay(f.stand.vervalISO, opt(ctx).nu);
        if (rel) wanneer += ' · ' + rel;
      }
    } else {
      wanneer = 'Geen vervaldatum vastgelegd';
    }

    var kinderen = [
      ui.el('span', {
        class: 'u-groot u-bedrag',
        style: 'display:block;',
        text: euro(chart, f.stand.openCents)
      }),
      ui.el('span', {
        class: 'u-row-sub',
        style: 'display:block;margin-top:2px;',
        text: wanneer
      }),
      ui.el('div', { style: 'margin-top:12px;' },
        ui.statusDot({ toon: f.stand.toon, label: f.stand.label })),
      hairline(ui, '18px 0 6px'),
      ui.productRow({
        beeld: foto,
        titel: project ? str(project.name) : (str(inv.label) || 'Factuur'),
        sub: [klant ? str(klant.company) : '', str(inv.invoiceNumber)]
          .filter(function (x) { return !!x; }).join(' · '),
        onOpen: function () { ga(ctx, factuurRoute(model, inv.id)); }
      })
    ];

    return railKaart(ui, 'Volgende verwachte betaling', kinderen);
  }

  /* ============================================================
     8. AANVULLEN, NIET OVERSCHRIJVEN

     Een tweede schermbestand vult dezelfde tabel — portal/admin-schermen-werk.js
     en portal/admin-schermen-beheer.js doen dat op dit moment ook. Zou dit
     bestand CP_SCHERMEN vervangen, dan verdwijnen hun schermen zodra de
     laadvolgorde ook maar iets verschuift.

     IN DEZE TABEL STAAN ALLEEN SCHERMEN. Geen versienummer, geen hulpje: de
     shell mag over CP_SCHERMEN heen lopen en elke waarde als bouwer
     aanroepen, en dan is één tekstwaarde ertussen genoeg om dat te laten
     klappen. Het versienummer van dit bestand staat in de module-export
     hieronder.
     ============================================================ */

  if (!root.CP_SCHERMEN) root.CP_SCHERMEN = {};
  root.CP_SCHERMEN.relaties = schermRelaties;
  root.CP_SCHERMEN.fabrieken = schermFabrieken;
  root.CP_SCHERMEN.financien = schermFinancien;

  /* zelfde reden als in admin-ui.js: er is geen "type":"module", dus in Node
     is dit CJS en is dit een echte export voor tests. */
  if (typeof module === 'object' && module && module.exports) {
    module.exports = {
      VERSION: VERSION,
      relaties: schermRelaties,
      fabrieken: schermFabrieken,
      financien: schermFinancien
    };
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
