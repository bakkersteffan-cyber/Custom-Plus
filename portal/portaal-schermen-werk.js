/* CUSTOM+ — de drie werkschermen van het klantportaal.
   ------------------------------------------------------------------
   WAT DIT BESTAND IS
   Overzicht, Producten en het Productdetail met tabs (hoofdstuk 4 van
   .claude/portaal-spec.md), getekend in het beeld van het beheer
   (.claude/beheer-ui-mockup-spec.md). Het vult window.CP_PORTAAL_SCHERMEN
   AAN en overschrijft nooit; de andere vier werkgebieden (Berichten,
   Bestanden, Betalingen, Activiteit, Instellingen) komen uit hun eigen
   bestanden en vullen dezelfde tafel.

   WAT DIT BESTAND NIET IS
   Geen componentbibliotheek, geen tekenlaag en geen datalaag. Elke vorm
   komt uit CP_UI (portal/admin-ui.js), elke grafiek uit CP_CHART
   (portal/admin-charts.js), elke afleiding uit CP_PORTAAL
   (portal/portaal-model.js) en elke schrijfactie uit ctx.acties — het
   actiecontract dat portal.html aan CP_PORTAAL_DATA hangt. Er wordt hier
   nooit zelf geschreven, nooit een tweede statusvertaler gebouwd en nooit
   een getal verzonnen.

   DE INHOUDELIJKE BRON IS HET OUDE PORTAAL. renderCockpit, renderPath,
   renderSamples, renderQuality(Chart), renderShipments met De Reis,
   renderDocs, renderCosts, renderFactoryMap en renderProducten in
   portal.html tonen al jaren precies de goede data met precies de goede
   eerlijkheidsteksten. Die teksten en die afleidingen zijn hier
   overgenomen; alleen de vorm is de mockup. Waar een zin uit het oude
   portaal komt, staat hij hier woordelijk — dat is ook de reden dat de
   i18n-woordenboeken hem al kennen.

   HET BELANGRIJKSTE BLOK VAN HET HELE PORTAAL
   "Wat we van jou nodig hebben" op Overzicht: per item ÉÉN primaire knop
   die de actie uit het contract aanroept. Dit zijn de knoppen die er nooit
   waren — akkoord geven, een sample beoordelen, een bestand aanleveren,
   opnieuw bestellen. Een akkoord opent EERST een bevestiging die zegt wát
   er wordt goedgekeurd (fase, betaalmoment, bedrag als dat er is) en
   vraagt de naam; een sample opent de beoordeling (goed, of aanpassing met
   opmerking en aanwijzingen op de foto); een factuur gaat naar Betalingen;
   een bericht gaat naar Berichten. Elke knop is tijdens het wachten
   uitgeschakeld en meldt zijn stand in een aria-live-regio; een verworpen
   Promise wordt een toast met de Nederlandse boodschap van de datalaag,
   door i18nT.

   VIJF DINGEN WAAR DE GEDEELDE LAAG NIET IN VOORZIET, EN WAT HIER DAN STAAT
   (allemaal "het dichtstbijzijnde", gemeld in het rapport van deze ronde)

     1. DE ROUTEBOOG VAN DE REIS (shipArc in portal.html) woont in het
        afgesloten scriptblok van portal.html en is van hieruit niet aan te
        roepen. De opdracht zegt: hergebruik die tekening, bouw hem niet na.
        Dat gebeurt letterlijk: de oude sectie #shipments-list staat
        verborgen in dezelfde DOM en heeft de boog voor dit project al
        getekend; reisBoog() kloont die SVG (aria-hidden, puur decoratie)
        en zet het afgelegde deel op zijn eindstand. Biedt portal.html ooit
        ctx.shipArc aan, dan wint die vanzelf.
     2. BEELD-URL's. ctx heeft geen mediaUrl; de datalaag ook niet. Demo:
        media.src of CP_FILES.fileUrl(fileRef). Live: de oude sectie
        #updates-list heeft de ondertekende URL al opgehaald en die wordt
        hergebruikt (data-eid). Buiten de open bundel (de productenplank in
        live) blijft de eerlijke lege tegel staan. Biedt portal.html ooit
        ctx.mediaUrl aan, dan wint die.
     3. DOWNLOADS. De beveiligde downloadstroom (handleDownload: signed URL,
        logregel, demo-uitleg) zit ook in portal.html. De documentrij hier
        klikt de bestaande downloadknop van dezelfde rij in #docs-list aan;
        is die er niet, dan staat er "PDF volgt". Een factuurdocument loopt
        via ctx.acties.factuurPdf, dat is het contract.
     4. HET FASEPAD. Sinds ronde 3 is CP_CHART.stagePath (zes iconen met
        golflijn) vervangen door de fasebalk van dit bestand (faseBalk:
        zes stippen, één label, één zin klantentaal uit CP_PORTAAL.
        faseUitleg). De akkoordknop staat in de banner en in de rail; de
        details per fase onder Details.
     5. HET KWALITEITSPANEEL. renderQualityChart tekent een eigen SVG
        (staaf per ronde met blokjes). CP_CHART heeft daar geen tegenhanger
        voor; de mockupvorm die het dichtst komt is barChart: per ronde een
        gestapelde staaf klein/groot/kritiek met de norm als gestreepte
        lijn erover. Dezelfde data, dezelfde aria-zinnen.

   RONDE 3 (structuur en tekst, agent werk3a)
     · Productpagina: kop → begroeting met stand (.k-begroeting) → held met
       de productfoto en de status (.k-held) → banner "Wacht op jou" met de
       eerste actie (.k-nodig-banner) → tabs. Rail: hoogstens twee kaarten
       (alle open acties; Kerngegevens ingeklapt, .k-inklap).
     · Overzicht: begroeting, de banner als eerste sectie met de overige
       acties eronder.
     · Nieuw van CP_PORTAAL, elk met terugval: faseKort, faseUitleg,
       geldKlant, datumKort/datumKortDelen, verwachteLevering, begroeting.
     · Eén datumvorm (datumKort), geld zonder centen als het geheel is,
       elke kaart hoogstens één zin uitleg (rest achter helpKnop), lege
       staten in één regel.

   RONDE 3, DEEL 2 (agent werk3c)
     · De zwevende vraagknop .k-vraag-zwevend rechtsonder op elke tab van
       de productpagina (advies 15, hoofdstuk 10b): opent het vraagvak van
       tab Gesprek met de context al ingevuld — een open paneel wint, dan
       de fase (Voortgang), de factuur uit de route (Betalingen), anders
       het product. In de DOM van het scherm, dus weg bij navigeren.
     · Eén opbouw voor de vijf actiepanelen (advies 12): feitKop, velden,
       één primaire knop; uitleg achter helpKnop. Geen mailadres meer in
       een foutzin: de knop "Vraag stellen" in de pil (advies 10).

   AFSPRAKEN
     · Elk scherm is puur: selectie en tab komen uit de route, alles wat
       async is (herbestellingen, contactpersoon, draden) wordt vooraf
       opgehaald en het scherm geeft dan een Promise van zijn element terug —
       de montage in portal.html staat dat uitdrukkelijk toe.
     · Elke klantzichtbare tekst is een NEDERLANDSE bronstring door
       ctx.i18nT / ctx.i18nTpl. Data (namen, notities, bedragen, datums)
       krijgt data-no-i18n, precies zoals portal.html dat doet.
     · Geld is een geheel getal in centen; opmaak via ctx.fmtMoney.
     · ES5, nooit innerHTML, commentaar in het Nederlands.

   LADEN
     <script src="portal/portaal-schermen-werk.js"></script> ná admin-ui.js,
     admin-charts.js, portaal-model.js en portaal-data.js. Het bestand raakt
     bij het laden niets aan behalve window.CP_PORTAAL_SCHERMEN.
   ------------------------------------------------------------------ */
(function (root) {
  'use strict';

  if (!root.CP_PORTAAL_SCHERMEN) root.CP_PORTAAL_SCHERMEN = {};
  var S = root.CP_PORTAAL_SCHERMEN;

  /* ============================================================
     0. KALE HULPJES
     ============================================================ */

  var lijst = function (v) { return Array.isArray(v) ? v : []; };
  var isObj = function (v) { return !!v && typeof v === 'object' && !Array.isArray(v); };
  var opt = function (v) { return isObj(v) ? v : {}; };
  var tekst = function (v) { return (v === null || v === undefined) ? '' : String(v); };
  var trim = function (v) { return tekst(v).replace(/^\s+|\s+$/g, ''); };
  var fn = function (v) { return typeof v === 'function' ? v : null; };
  var isNode = function (v) { return !!v && typeof v === 'object' && typeof v.nodeType === 'number'; };
  var getal = function (v, terugval) {
    var n = Number(v);
    return isFinite(n) ? n : (typeof terugval === 'number' ? terugval : 0);
  };
  /* geheel aantal centen: een kommagetal wordt afgerond, nooit doorgerekend */
  var centen = function (v) {
    var n = Number(v);
    return isFinite(n) ? Math.round(n) : 0;
  };

  /* een uniek id voor aria-koppelingen (aria-describedby). Eigen
     voorvoegsel 'kw': portaal-schermen-berichten.js telt in hetzelfde
     document met 'kp', en twee gelijke id's zouden de schermlezer naar de
     verkeerde subregel sturen. */
  var idTeller = 0;
  var uid = function (voorvoegsel) { idTeller++; return 'kw' + tekst(voorvoegsel) + idTeller; };

  var indexOp = function (rijen, sleutel) {
    var uit = {};
    lijst(rijen).forEach(function (r) { if (r && r[sleutel]) uit[r[sleutel]] = r; });
    return uit;
  };

  /* " · " tussen de delen die er zijn — dezelfde samenvoeging als originLine()
     in portal.html */
  var samen = function (delen) {
    var uit = [];
    lijst(delen).forEach(function (d) { if (tekst(d)) uit.push(tekst(d)); });
    return uit.join(' · ');
  };

  /* afkorten op een spatie; de volledige tekst blijft altijd één klik ver weg */
  var afkorten = function (waarde, max) {
    var t = tekst(waarde);
    var n = (typeof max === 'number' && max > 8) ? max : 90;
    if (t.length <= n) return t;
    var kort = t.slice(0, n);
    var spatie = kort.lastIndexOf(' ');
    if (spatie > n * 0.6) kort = kort.slice(0, spatie);
    return kort.replace(/[\s.,;:·-]+$/, '') + '…';
  };

  /* een kopie met één veld erbij — nooit het object zelf, want de rijen in
     de bundel zijn in demomodus dezelfde objecten als de opslagstaat */
  var metVeld = function (rij, naam, waarde) {
    var uit = {}, k;
    if (isObj(rij)) for (k in rij) if (Object.prototype.hasOwnProperty.call(rij, k)) uit[k] = rij[k];
    if (uit[naam] === undefined || uit[naam] === null || uit[naam] === '') uit[naam] = waarde;
    return uit;
  };

  /* een id in een attribuutselector: aanhalingstekens en backslashes
     ontsnappen, meer hoeft niet binnen "..." */
  var selEsc = function (id) { return tekst(id).replace(/["\\]/g, '\\$&'); };

  var vul = function (tpl, vars) {
    return tekst(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars && vars[k] !== null && vars[k] !== undefined) ? String(vars[k]) : m;
    });
  };

  /* ============================================================
     1. DE CONTEXT — ctx is de enige bron
     ============================================================ */

  var UI = function (ctx) { return (ctx && ctx.ui) || root.CP_UI || null; };
  var CH = function (ctx) { return (ctx && ctx.chart) || root.CP_CHART || null; };
  var PM = function (ctx) { return (ctx && ctx.portaal) || root.CP_PORTAAL || null; };
  var DL = function (ctx) { return (ctx && ctx.data) || root.CP_PORTAAL_DATA || null; };

  /* T() en TPL(): elke klantzichtbare tekst gaat hierlangs. Zonder i18nT
     (een test zonder portal.html) blijft het Nederlands staan. */
  var T = function (ctx, s) {
    var f = fn(ctx && ctx.i18nT);
    return f ? tekst(f(s)) : tekst(s);
  };
  var TPL = function (ctx, s, vars) {
    var f = fn(ctx && ctx.i18nTpl);
    return f ? tekst(f(s, vars)) : vul(s, vars);
  };

  var nuVan = function (ctx) { return tekst(ctx && ctx.nu) || new Date().toISOString(); };
  var vandaagVan = function (ctx) { return dagVan(ctx, nuVan(ctx)); };

  var dagVan = function (ctx, waarde) {
    var p = PM(ctx);
    if (p && fn(p.dayISO)) return tekst(p.dayISO(waarde));
    var m = tekst(waarde).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  };

  var routeVan = function (ctx) {
    var r = ctx && ctx.route;
    if (isObj(r)) return r;
    var m = ctx && ctx.model;
    if (m && fn(m.parseRoute)) return m.parseRoute(tekst(r));
    return { area: '', sub: null, id: null, tab: null, params: {} };
  };
  var paramVan = function (ctx, naam) { return tekst(opt(routeVan(ctx).params)[naam]); };
  var tabVan = function (ctx, terugval) {
    var m = ctx && ctx.model;
    var r = routeVan(ctx);
    if (m && fn(m.tabOf)) return tekst(m.tabOf(r, terugval));
    return tekst(r.tab) || tekst(opt(r.params).tab) || tekst(terugval);
  };

  var bundelVan = function (ctx) { return opt(ctx && ctx.bundle); };
  var portfolioVan = function (ctx) { return opt(ctx && ctx.portfolio); };
  var klantVan = function (ctx) { return opt(ctx && ctx.klant); };
  var actie = function (ctx, naam) { return fn(opt(ctx && ctx.acties)[naam]); };

  var navigeer = function (ctx, route, opties) {
    var g = fn(ctx && ctx.ga);
    if (g) g(route, opt(opties));
  };
  /* een tab of een dagkeuze: de pagina blijft staan, de melding zegt wat
     er veranderde — anders hoort een schermlezer alleen de paginanaam */
  var deelNavigatie = function (ctx, route, melding) {
    navigeer(ctx, route, { behoudScroll: true, behoudFocus: true, melding: tekst(melding) });
  };

  /* ============================================================
     2. FASENAMEN, STANDEN, DATUMS EN GELD
     ============================================================ */

  /* de volledige fasenaam komt van de gastheer (ctx.stageLabel =
     i18nT(stageName(key))); zonder die haak de kale sleutel — zichtbaar
     onaf, nooit een verzonnen vertaling */
  var faseNaamVan = function (ctx) {
    var bron = fn(ctx && ctx.stageLabel);
    return function (sleutel) {
      var k = tekst(sleutel);
      if (!k || !bron) return k;
      var uit = '';
      try { uit = tekst(bron(k)); } catch (e) { uit = ''; }
      return uit || k;
    };
  };

  /* de korte fasenamen in klantentaal: CP_PORTAAL.faseKort (ronde 3, een
     NL bronstring per fase — 'Ontwerp', 'Fabriek kiezen', …) door T().
     Zonder die haak de oude korte namen van het portaal (STAGE_SHORT in
     portal.html, al in vier talen vertaald), en voor een onbekende sleutel
     de volledige naam. */
  var FASE_KORT = {
    concept: 'Concept', dfm: 'DFM', sourcing: 'Sourcing',
    tooling: 'Tooling', production: 'Productie', logistics: 'Logistiek'
  };
  var faseKortVan = function (ctx) {
    var vol = faseNaamVan(ctx);
    var p = PM(ctx);
    var kort = (p && fn(p.faseKort)) ? p.faseKort : null;
    return function (sleutel) {
      var k = tekst(sleutel);
      if (!k) return '';
      if (kort) {
        var uit = '';
        try { uit = tekst(kort(k)); } catch (e) { uit = ''; }
        if (uit) return T(ctx, uit);
      }
      return Object.prototype.hasOwnProperty.call(FASE_KORT, k) ? T(ctx, FASE_KORT[k]) : vol(k);
    };
  };
  /* één zin klantentaal per fase (CP_PORTAAL.faseUitleg); zonder die haak
     niets — een doorlooptijd verzinnen we hier nooit */
  var faseUitlegVan = function (ctx) {
    var p = PM(ctx);
    var f = (p && fn(p.faseUitleg)) ? p.faseUitleg : null;
    return function (sleutel) {
      if (!f || !tekst(sleutel)) return '';
      var uit = '';
      try { uit = tekst(f(tekst(sleutel))); } catch (e) { uit = ''; }
      return uit ? T(ctx, uit) : '';
    };
  };

  /* de vier fasestanden, in de woorden van het oude portaal (renderPath:
     afgerond / nu bezig / volgt nog) plus het akkoord */
  var FASE_STAND = {
    done: { woord: 'Afgerond', toon: 'klaar' },
    current: { woord: 'Nu bezig', toon: 'nu' },
    awaiting_approval: { woord: 'Wacht op jouw akkoord', toon: 'wacht' },
    upcoming: { woord: 'Volgt nog', toon: 'neutraal' }
  };
  var faseStand = function (ctx, status) {
    var s = FASE_STAND[tekst(status)] || { woord: 'Onbekend', toon: 'neutraal' };
    return { woord: T(ctx, s.woord), toon: s.toon };
  };

  /* ÉÉN DATUMVORM (ronde 3, advies 6): '24 apr' in het lopende jaar,
     '24 apr 2025' daarbuiten. CP_PORTAAL.datumKortDelen geeft de delen
     terug zodat de maandnaam ('apr') als NL bronstring door T() kan;
     zonder die haak CP_PORTAAL.datumKort, dan de korte opmaak van de
     gastheer, dan de kale dag. De lange vorm ("24 april 2026") bestaat in
     dit bestand niet meer: datumTekst is dezelfde korte datum. */
  var datumKort = function (ctx, waarde) {
    if (!tekst(waarde)) return '';
    var p = PM(ctx);
    if (p && fn(p.datumKortDelen)) {
      var d = null;
      try { d = p.datumKortDelen(waarde, nuVan(ctx)); } catch (e) { d = null; }
      if (isObj(d) && d.dag && tekst(d.maand)) {
        return tekst(d.dag) + ' ' + T(ctx, tekst(d.maand)) + (d.jaar ? ' ' + tekst(d.jaar) : '');
      }
      if (d === null || d === '') return '';
    }
    if (p && fn(p.datumKort)) {
      var k = '';
      try { k = tekst(p.datumKort(waarde, nuVan(ctx))); } catch (e2) { k = ''; }
      if (k) return k;
    }
    var f = fn(ctx && ctx.fmtDateShort);
    return f ? tekst(f(waarde)) : dagVan(ctx, waarde);
  };
  var datumTekst = datumKort;
  var tijdTekst = function (ctx, waarde) {
    var f = fn(ctx && ctx.fmtDateTime);
    return f ? tekst(f(waarde)) : tekst(waarde);
  };
  /* GELD ZONDER CENTEN ALS HET GEHEEL IS (advies 5): CP_PORTAAL.geldKlant
     ('€ 3.125', en '€ 3.125,50' alleen bij een niet-heel bedrag); zonder
     die haak de opmaak van de gastheer */
  var bedragTekst = function (ctx, cents, valuta) {
    var p = PM(ctx);
    var v = tekst(valuta) || 'EUR';
    if (p && fn(p.geldKlant)) {
      var uit = '';
      try { uit = tekst(p.geldKlant(centen(cents), v)); } catch (e) { uit = ''; }
      if (uit) return uit;
    }
    var f = fn(ctx && ctx.fmtMoney);
    if (f) return tekst(f(centen(cents), v));
    return tekst(centen(cents) / 100) + ' ' + v;
  };
  /* de datumkicker uit de mockup ("VR 16 MEI"), in de taal van de klant:
     de korte datum zonder jaar, in kapitalen */
  var datumKicker = function (ctx, iso) {
    var d = dagVan(ctx, iso);
    if (!d) return '';
    var delen = datumKort(ctx, d).split(' ');
    var kern = delen.length >= 2 ? (delen[0] + ' ' + delen[1]) : d;
    return kern.toUpperCase();
  };

  /* fases gesorteerd op positie; de vorm die CP_PORTAAL.voortgang ook leest */
  var fasesVan = function (project, losseStages) {
    var rows = lijst(losseStages).length ? lijst(losseStages) : lijst(opt(project).stages);
    return rows.filter(isObj).slice().sort(function (a, b) {
      return (getal(a.position, 0) - getal(b.position, 0));
    });
  };
  /* de huidige fase: de eerste die niet af en niet gepland is, anders de
     eerste geplande — currentStageOf() in portal.html, woordelijk */
  var huidigeFase = function (stages) {
    var st = lijst(stages);
    var i;
    for (i = 0; i < st.length; i++) if (st[i].status !== 'done' && st[i].status !== 'upcoming') return st[i];
    for (i = 0; i < st.length; i++) if (st[i].status === 'upcoming') return st[i];
    return null;
  };
  var faseIndex = function (stages, fase) {
    var st = lijst(stages);
    for (var i = 0; i < st.length; i++) if (st[i] === fase) return i;
    return -1;
  };

  /* ============================================================
     3. DE BRONNEN — één platte vorm voor CP_PORTAAL

     De bundel is één project; het portfolio zijn alle producten van de
     klant (met hun fases genest) plus media, samples, facturen, vragen en
     zendingen. De collecties die alleen de bundel draagt (documenten,
     slots, logboek, inspecties, disclosures, zendingsgebeurtenissen) komen
     uitsluitend van het OPEN project. Nooit bundel én portfolio allebei
     doorgeven: dezelfde rij zou dan twee keer meetellen.
     ============================================================ */

  var klantBron = function (ctx, extra) {
    var b = bundelVan(ctx), pf = portfolioVan(ctx);
    var uit = {};
    if (lijst(pf.projects).length) {
      uit.projects = lijst(pf.projects);
      uit.media = lijst(pf.media);
      uit.samples = lijst(pf.samples);
      uit.invoices = lijst(pf.invoices);
      uit.questions = lijst(pf.questions);
      uit.shipments = lijst(pf.shipments);
    } else if (isObj(b.project)) {
      uit.project = b.project;
      uit.stages = lijst(b.stages);
      uit.media = lijst(b.media);
      uit.samples = lijst(b.samples);
      uit.invoices = lijst(b.invoices);
      uit.questions = lijst(b.questions);
      uit.shipments = lijst(b.shipments);
    }
    uit.documents = lijst(b.documents);
    uit.docSlots = lijst(b.docSlots);
    uit.accessLog = lijst(b.accessLog);
    uit.questionMessages = lijst(b.questionMessages);
    uit.shipmentEvents = lijst(b.shipmentEvents);
    uit.inspections = lijst(b.inspections);
    uit.disclosures = lijst(b.disclosures);
    uit.reorderRequests = lijst(opt(extra).reorderRequests);
    return uit;
  };

  /* alle projecten van de klant, in dezelfde volgorde als het oude
     "Mijn Producten": nieuwste eerst */
  var projectenVan = function (ctx) {
    var pf = portfolioVan(ctx), b = bundelVan(ctx);
    var uit = lijst(pf.projects).length ? lijst(pf.projects).slice()
      : (lijst(ctx && ctx.projecten).length ? lijst(ctx.projecten).slice()
        : (isObj(b.project) ? [b.project] : []));
    return uit.filter(isObj).sort(function (a, c) {
      var x = tekst(c.createdAt), y = tekst(a.createdAt);
      if (x === y) return tekst(a.id) < tekst(c.id) ? -1 : 1;
      return x < y ? -1 : 1;
    });
  };

  /* de rijen van één project uit een platte bron */
  var perProject = function (bron, projectId, sleutel) {
    return lijst(opt(bron)[sleutel]).filter(function (r) { return r && r.projectId === projectId; });
  };
  var miniBundel = function (bron, project) {
    var pid = tekst(opt(project).id);
    var uit = { project: project, stages: fasesVan(project) };
    ['media', 'samples', 'invoices', 'questions', 'shipments', 'documents', 'docSlots',
      'accessLog', 'questionMessages', 'shipmentEvents', 'inspections', 'disclosures', 'reorderRequests']
      .forEach(function (k) { uit[k] = perProject(bron, pid, k); });
    return uit;
  };

  /* de opties die elke CP_PORTAAL-aanroep meekrijgt: de vertaalde fasenaam */
  var portaalOpties = function (ctx) { return { stageLabel: faseNaamVan(ctx) }; };

  /* de factuur die bij een betaalmoment hoort — invoiceForStage() in
     portal.html: een geannuleerde of gecrediteerde factuur telt niet mee */
  var factuurVoorFase = function (ctx, invoices, stageKey) {
    var p = PM(ctx);
    var uit = null;
    lijst(invoices).forEach(function (inv) {
      if (uit || !inv || inv.stageKey !== stageKey) return;
      var st = (p && fn(p.factuurStatusVoorKlant)) ? p.factuurStatusVoorKlant(inv, nuVan(ctx)) : { gesloten: false };
      if (st.gesloten) return;
      uit = inv;
    });
    return uit;
  };

  /* ============================================================
     4. BEELDEN EN DE BRUGGEN NAAR portal.html (zie kopblok, 1 t/m 3)
     ============================================================ */

  var beeldUrl = function (ctx, media) {
    if (!isObj(media)) return Promise.resolve('');
    var eigen = fn(ctx && ctx.mediaUrl);
    if (eigen) {
      try {
        return Promise.resolve(eigen(media)).then(function (u) { return tekst(u); }, function () { return ''; });
      } catch (e) { /* door naar de terugval */ }
    }
    if (media.fileRef && root.CP_FILES && fn(root.CP_FILES.fileUrl)) {
      return root.CP_FILES.fileUrl(media.fileRef).then(function (u) { return tekst(u); }, function () { return ''; });
    }
    if (tekst(media.src)) return Promise.resolve(tekst(media.src));
    /* de oude sectie heeft de ondertekende URL al: hergebruiken */
    var doc = (typeof document !== 'undefined') ? document : null;
    var oud = doc ? doc.querySelector('#updates-list [data-eid="' + selEsc(media.id) + '"] img') : null;
    if (oud && oud.getAttribute('src')) return Promise.resolve(oud.getAttribute('src'));
    return Promise.resolve('');
  };

  /* een <img> die pas verschijnt zodra er een adres is; tot die tijd staat
     het lege slot (aria-hidden) — een volwaardige stand, geen gebrek */
  var beeldVak = function (ctx, ui, media, klasse, alt) {
    var slot = ui.el('span', { class: tekst(klasse), 'aria-hidden': 'true' });
    var img = ui.el('img', { class: tekst(klasse), alt: tekst(alt), loading: 'lazy' });
    img.hidden = true;
    var wrap = ui.el('span', { style: 'display:contents;' }, [slot, img]);
    beeldUrl(ctx, media).then(function (u) {
      if (!u) return;
      img.src = u;
      img.hidden = false;
      slot.hidden = true;
    });
    return wrap;
  };

  /* de nieuwste foto die de klant ziet — concepten (voorvertoning) doen niet
     mee, precies zoals de cockpit dat afspreekt (R1-3) */
  var nieuwsteFoto = function (media, projectId) {
    var uit = null;
    lijst(media).forEach(function (m) {
      if (!m || m._concept) return;
      if (projectId && m.projectId !== projectId) return;
      if (!uit || tekst(m.capturedAt) > tekst(uit.capturedAt)) uit = m;
    });
    return uit;
  };

  /* brug 1: de routeboog van De Reis */
  var reisBoog = function (ctx, shipment) {
    var eigen = fn(ctx && ctx.shipArc);
    if (eigen) {
      try { var n = eigen(shipment); if (isNode(n)) return n; } catch (e) { /* door naar de kloon */ }
    }
    var doc = (typeof document !== 'undefined') ? document : null;
    var oud = doc ? doc.querySelector('#shipments-list [data-eid="' + selEsc(opt(shipment).id) + '"] svg.ship-arc') : null;
    if (!oud) return null;
    var kloon = oud.cloneNode(true);
    /* de intekenanimatie hangt aan .ship-card.is-visible van de oude
       sectie; buiten die kaart staat het afgelegde deel meteen op zijn eind */
    var reis = kloon.querySelector('.arc-travel');
    if (reis) reis.setAttribute('stroke-dashoffset', '0');
    kloon.setAttribute('aria-hidden', 'true');
    return kloon;
  };

  /* brug 3: de bestaande downloadknop van dezelfde documentrij */
  var oudeDownloadKnop = function (docId) {
    var doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return null;
    return doc.querySelector('#docs-list [data-eid="' + selEsc(docId) + '"] button');
  };

  /* ============================================================
     5. VORMHULPJES — dezelfde als in de beheerschermen
     ============================================================ */

  /* admin-ui.css kent geen binnenmargeklasse voor een kaart met vrije
     inhoud; de marge staat hier op precies één plek inline */
  var kaart = function (ui, kinderen, extraKlasse) {
    return ui.el('div', {
      class: 'u-card' + (tekst(extraKlasse) ? ' ' + tekst(extraKlasse) : ''),
      style: 'padding:20px 22px;'
    }, lijst(kinderen));
  };
  var sectie = function (ui, kop, kinderen, klasse) {
    return ui.el('div', { class: 'u-section' + (tekst(klasse) ? ' ' + tekst(klasse) : '') }, [kop].concat(lijst(kinderen)));
  };
  var stapel = function (ui, kinderen, gap) {
    var g = (typeof gap === 'number' && gap >= 0) ? gap : 16;
    return ui.el('div', { style: 'display:flex;flex-direction:column;gap:' + g + 'px;' }, lijst(kinderen));
  };
  var ruimte = function (ui, px) {
    var p = (typeof px === 'number' && px > 0) ? px : 20;
    return ui.el('div', { 'aria-hidden': 'true', style: 'height:' + p + 'px;' });
  };
  /* een regel data: nooit door de vertaalpas */
  var dataRegel = function (ui, klasse, inhoud, extraAttrs) {
    var attrs = { class: tekst(klasse) || null, 'data-no-i18n': '' };
    var k;
    for (k in opt(extraAttrs)) if (Object.prototype.hasOwnProperty.call(extraAttrs, k)) attrs[k] = extraAttrs[k];
    if (typeof inhoud === 'string') attrs.text = inhoud;
    return ui.el('p', attrs, typeof inhoud === 'string' ? null : inhoud);
  };

  /* VELD: label bóven het veld (spec 5.10); .field/.flabel/.input bestaan
     in admin-ui.css en portaal-skin.css */
  var veldVak = function (ui, label, control, hint) {
    return ui.el('label', { class: 'field' }, [
      ui.el('span', { class: 'flabel', text: tekst(label) }),
      control,
      tekst(hint) ? ui.el('span', { class: 'u-sub', style: 'display:block;margin-top:6px;', text: tekst(hint) }) : null
    ]);
  };

  /* DE LIVE-REGIO VAN EEN PANEEL: elke knop meldt hier "bezig", "gelukt"
     of de fout, zodat een schermlezer hoort wat de knop doet */
  var statusRegio = function (ui) {
    return ui.el('p', { class: 'u-sub', role: 'status', 'aria-live': 'polite', style: 'margin:10px 0 0;min-height:1.2em;' });
  };
  var knopBezig = function (knop, aan, regio, zin) {
    if (knop) {
      knop.disabled = !!aan;
      knop.setAttribute('aria-busy', aan ? 'true' : 'false');
    }
    if (regio) regio.textContent = aan ? tekst(zin) : '';
  };
  /* de fout als één korte zin: CP_PORTAAL_DATA.berichtVoorFout maakt van
     élke fout de Nederlandse zin van de datalaag; zonder die haak de zin
     van de fout zelf. Geen mailadres (advies 10): de weg naar Steffan is
     de knop "Vraag stellen" naast de fout (foutMelden), niet een adres in
     de zin. */
  var foutZin = function (ctx, err) {
    var d = DL(ctx);
    var zin = '';
    if (d && fn(d.berichtVoorFout)) { try { zin = tekst(d.berichtVoorFout(err)); } catch (e) { zin = ''; } }
    if (!zin) zin = tekst(err && err.message);
    return T(ctx, zin || 'Dat lukte niet. Probeer het opnieuw.');
  };
  /* actie: {label, onKies} — CP_UI.toast zet er dan een knop in de pil bij;
     geeft de pil terug (CP_UI.toast levert de knoop met .sluit()) */
  var toast = function (ctx, zin, actie, opties) {
    var ui = UI(ctx);
    var o = opt(opties);
    if (isObj(actie)) o.actie = actie;
    if (ui && fn(ui.toast)) return ui.toast(zin, o);
    if (fn(ctx && ctx.meld)) ctx.meld(zin);
    return null;
  };
  /* DE KNOP "VRAAG STELLEN" IN EEN FOUTPIL (advies 10): dezelfde weg als
     portaal-schermen-berichten.js — het formulier voor een nieuwe vraag
     onder Berichten, met het product al gekozen en de eerste woorden
     ingevuld (?nieuw=1&product=&tekst=, gelezen door nieuweVraagPaneel) */
  var vraagRoute = function (projectId, voorvul) {
    return { area: 'berichten', params: { nieuw: '1', product: tekst(projectId) || null, tekst: tekst(voorvul) || null } };
  };
  var vraagActie = function (ctx, projectId, voorvul) {
    return { label: T(ctx, 'Vraag stellen'), onKies: function () { navigeer(ctx, vraagRoute(projectId, voorvul)); } };
  };
  /* de eerste woorden van een vraag over een factuur: 'Over factuur 2026-001: '
     — dezelfde zin als overFactuur in portaal-schermen-berichten.js */
  var overFactuur = function (ctx, inv) {
    return TPL(ctx, 'Over factuur {nummer}: ', { nummer: tekst(inv && inv.invoiceNumber) || tekst(inv && inv.label) });
  };
  /* de fout in de live-regio én als pil; vraag = {product, tekst} zet de
     knop "Vraag stellen" in de pil */
  var foutMelden = function (ctx, regio, err, vraag) {
    var zin = foutZin(ctx, err);
    if (regio) regio.textContent = zin;
    toast(ctx, zin, isObj(vraag) ? vraagActie(ctx, vraag.product, vraag.tekst) : null);
    return zin;
  };
  /* na een geslaagde schrijfactie: melden en de route opnieuw tekenen met
     verse gegevens (ctx.ververs haalt bundel en productenplank opnieuw op) */
  var naSucces = function (ctx, zin) {
    toast(ctx, zin);
    if (fn(ctx && ctx.meld)) ctx.meld(zin);
    var v = fn(ctx && ctx.ververs);
    if (v) v();
  };
  /* de bestandsgrootte in klantentaal — dezelfde regel als bestandsGrootte
     in portaal-schermen-berichten.js (die exporteert hem niet) */
  var bestandsGrootte = function (bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n <= 0) return '';
    var kb = n / 1024;
    if (kb < 1000) return String(Math.round(kb)) + ' kB';
    var mb = Math.round((kb / 1024) * 10) / 10;
    return String(mb).replace('.', ',') + ' MB';
  };
  /* de cursor achter de voorgevulde woorden, zodat de klant meteen verder
     typt ('Over factuur 2026-001: |') */
  var cursorAanEind = function (veld) {
    if (!veld) return;
    try {
      var n = tekst(veld.value).length;
      if (fn(veld.setSelectionRange)) veld.setSelectionRange(n, n);
    } catch (e) { /* stil: een verborgen veld weigert dit soms */ }
  };

  /* HET FEIT BOVENAAN ELK PANEEL (advies 12): dezelfde opbouw als het
     meldpaneel in portaal-schermen-berichten.js — .u-hero-kop met een
     kicker, één grote regel (h2.k-feit-getal: de fase, de sampleronde, het
     slot, het product) en hoogstens één subregel; rechts optioneel een
     beeld of de "i"-knop. o.data zegt dat de grote regel data is (al
     vertaald of een naam) en niet nog eens door de vertaalpas moet. */
  var feitKop = function (ctx, ui, o) {
    o = opt(o);
    /* alleen de maat blijft inline: admin-ui.css zet .u-shell h2 op 20px
       (0,1,1) en dat wint van .k-feit-getal (0,1,0) in de skin; de rest
       (gewicht, spatiëring, regelhoogte, marge) komt uit de skin (10f) */
    var h2 = ui.el('h2', { class: 'k-feit-getal', text: tekst(o.feit) });
    if (o.data) h2.setAttribute('data-no-i18n', '');
    var sub = null;
    if (isNode(o.sub)) sub = o.sub;
    else if (tekst(o.sub)) {
      sub = ui.el('p', { class: 'u-sub', style: 'margin-top:4px;', text: tekst(o.sub) });
      if (o.subData) sub.setAttribute('data-no-i18n', '');
    }
    return ui.el('div', { class: 'u-hero-kop k-feit' }, [
      ui.el('div', null, [
        ui.el('span', { class: 'u-kicker', text: tekst(o.kicker) }),
        h2,
        sub
      ]),
      isNode(o.rechts) ? o.rechts : null
    ]);
  };

  /* ============================================================
     5b. DE UITGESTELDE ACTIE (advies 14) — "Ja, ik geef akkoord" legt
     het akkoord NIET meteen vast: tien seconden lang staat er een pil
     'Akkoord gegeven. Over {s} seconden definitief.' met de knop
     Ongedaan maken; pas daarna gaat de actie naar de datalaag. Dezelfde
     helper draagt de samplebeslissing.

     DE ENE HARDE REGEL: een gegeven akkoord raakt nooit kwijt. Verlaat de
     klant het scherm vóór de tien seconden om zijn, dan wordt het DIRECT
     vastgelegd. Vier wegen naar buiten, vier vangnetten:
       · een navigatie via de shell → ctx.registreerGuard: de shell vraagt
         elke guard vóór het tekenen, de onze legt vast en zegt "geen
         bezwaar" (null), dus er komt geen waarschuwing;
       · de terugknop, een getypt adres, het tabblad dicht → hashchange /
         popstate / pagehide / beforeunload op het venster;
       · het paneel gaat dicht (de knop erboven, of een verversing die het
         scherm opnieuw tekent) → paneelVak.sluit legt vast wat in hem
         hangt, en de tikker ziet elke seconde of het anker nog in het
         document staat (isConnected);
       · en anders gewoon de tikker na {seconden}.
     Alle vier lopen door dezelfde vastleggen(): die doet het hoogstens
     één keer. HANGEND is de lijst van wat nog niet definitief is.
     ============================================================ */
  var HANGEND = [];
  var isLos = function (n) { return isNode(n) && typeof n.isConnected === 'boolean' && !n.isConnected; };
  var binnen = function (n, houder) {
    var x = n;
    while (x) { if (x === houder) return true; x = x.parentNode; }
    return false;
  };
  var vastleggenHangendIn = function (houder) {
    HANGEND.slice().forEach(function (h) { if (!houder || binnen(h.anker, houder)) h.vastleggen(); });
  };
  var vastleggenAlles = function () { vastleggenHangendIn(null); };
  var vensterLuistert = false;
  var vensterLuisteraars = function () {
    if (vensterLuistert || !fn(root.addEventListener)) return;
    vensterLuistert = true;
    ['pagehide', 'beforeunload', 'hashchange', 'popstate'].forEach(function (soort) {
      try { root.addEventListener(soort, vastleggenAlles); } catch (e) { /* stil */ }
    });
  };

  /* uitgesteldeActie(ctx, {seconden, doe, melding, meldingEnkel,
       ongedaanMelding, klaarMelding, anker, bijKlaar, bijOngedaan, bijFout})
     melding is een NL bronstring met {s}; meldingEnkel de vorm voor één
     seconde. Geeft {vastleggen, ongedaan, loopt, zin, belofte} terug. */
  var uitgesteldeActie = function (ctx, o) {
    o = opt(o);
    var ui = UI(ctx);
    var rest = Math.max(1, Math.round(getal(o.seconden, 10)));
    var stand = 'loopt';
    var tikker = null, pil = null, guard = null;
    var uit = { anker: o.anker || null, belofte: null };

    var zin = function () {
      var tpl = (rest === 1 && tekst(o.meldingEnkel)) ? o.meldingEnkel : o.melding;
      return TPL(ctx, tpl, { s: rest });
    };
    var pilTekst = function () {
      if (!pil || !fn(pil.querySelector)) return;
      var span = pil.querySelector('span');
      if (span) span.textContent = zin();
    };
    var opruimen = function () {
      if (tikker !== null) { clearInterval(tikker); tikker = null; }
      var i = HANGEND.indexOf(uit);
      if (i >= 0) HANGEND.splice(i, 1);
      if (guard && fn(ctx && ctx.verwijderGuard)) { try { ctx.verwijderGuard(guard); } catch (e) { /* stil */ } }
      guard = null;
      if (pil) {
        if (fn(pil.sluit)) { try { pil.sluit(); } catch (e2) { /* stil */ } }
        else if (pil.parentNode) pil.parentNode.removeChild(pil);
      }
      pil = null;
    };
    var vastleggen = function () {
      if (stand !== 'loopt') return uit.belofte || Promise.resolve(null);
      stand = 'klaar';
      opruimen();
      var p;
      try { p = Promise.resolve(fn(o.doe) ? o.doe() : null); } catch (e) { p = Promise.reject(e); }
      uit.belofte = p.then(function (r) {
        if (fn(o.bijKlaar)) o.bijKlaar(r);
        if (tekst(o.klaarMelding)) naSucces(ctx, T(ctx, o.klaarMelding));
        return r;
      }, function (err) {
        if (fn(o.bijFout)) o.bijFout(err);
        else foutMelden(ctx, null, err, o.vraag);
        return null;
      });
      return uit.belofte;
    };
    var ongedaan = function () {
      if (stand !== 'loopt') return;
      stand = 'ongedaan';
      opruimen();
      if (tekst(o.ongedaanMelding)) toast(ctx, T(ctx, o.ongedaanMelding));
      if (fn(o.bijOngedaan)) o.bijOngedaan();
    };
    uit.vastleggen = vastleggen;
    uit.ongedaan = ongedaan;
    uit.loopt = function () { return stand === 'loopt'; };
    uit.zin = zin;

    HANGEND.push(uit);
    vensterLuisteraars();
    if (fn(ctx && ctx.registreerGuard)) {
      guard = function () { vastleggen(); return null; };
      try { ctx.registreerGuard(guard); } catch (e3) { guard = null; }
    }
    pil = toast(ctx, zin(), { label: T(ctx, 'Ongedaan maken'), onKies: ongedaan }, { duur: 0 });
    /* de pil telt elke seconde af; de live-regio van het paneel zegt de zin
       één keer. Een pil die als live-regio elke seconde opnieuw voorleest,
       praat door alles heen. */
    if (isNode(pil) && fn(pil.setAttribute)) pil.setAttribute('aria-live', 'off');
    tikker = setInterval(function () {
      if (stand !== 'loopt') return;
      if (isLos(uit.anker)) { vastleggen(); return; }
      rest--;
      if (rest <= 0) { vastleggen(); return; }
      pilTekst();
    }, 1000);
    return uit;
  };

  /* een knopgroep: primair links, ghost ernaast */
  var knoppenRij = function (ui, kinderen) {
    return ui.el('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px;' }, lijst(kinderen));
  };

  /* een inklapbaar paneel onder een rij of een kaart. open(bouwer) bouwt de
     inhoud pas bij de eerste klik en zet de focus erin; sluit() maakt het
     leeg en geeft de focus terug aan de knop. */
  var paneelVak = function (ui) {
    var vak = ui.el('div', { class: 'k-paneel' });
    vak.hidden = true;
    var terug = null;
    vak.openMet = function (node, vanaf) {
      terug = vanaf || null;
      while (vak.firstChild) vak.removeChild(vak.firstChild);
      vak.appendChild(node);
      vak.hidden = false;
      /* de focus landt op de eerste ZICHTBARE invoer of knop — niet op een
         veld in een verborgen regel en niet op de "i"-knop naast de kop:
         die is uitleg, geen begin van het werk (advies 12) */
      var eerste = null;
      Array.prototype.forEach.call(vak.querySelectorAll('input, textarea, select, button'), function (k) {
        if (eerste || isVerborgen(k) || (k.classList && k.classList.contains('k-help'))) return;
        eerste = k;
      });
      if (eerste && fn(eerste.focus)) { try { eerste.focus(); } catch (e) { /* stil */ } }
    };
    vak.sluit = function () {
      /* een paneel dat dichtgaat neemt geen hangend akkoord mee (advies 14) */
      vastleggenHangendIn(vak);
      while (vak.firstChild) vak.removeChild(vak.firstChild);
      vak.hidden = true;
      if (terug && fn(terug.focus)) { try { terug.focus(); } catch (e) { /* stil */ } }
    };
    vak.isOpen = function () { return !vak.hidden; };
    return vak;
  };

  /* het lijf van een actiepaneel: --card-2, radius 24, ruim — de
     detailpaneelvorm van de mockup (.u-hero) */
  var paneelKaart = function (ui, kinderen) {
    return ui.el('div', { class: 'u-hero', style: 'padding:24px;' }, lijst(kinderen));
  };

  /* ============================================================
     6. DE ACTIEPANELEN — de knoppen die er nooit waren

     ÉÉN OPBOUW VOOR ELK PANEEL (ronde 3, advies 12): bovenaan het feit
     (feitKop: kicker + één grote regel — de fase, de sampleronde met
     foto, het slot, het product), dan precies de velden die nodig zijn,
     dan één primaire knop met een werkwoord dat zegt wat er gebeurt, een
     annuleerknop en een live-regio. Geen tussenkoppen, geen uitlegzinnen;
     wat echt uitleg nodig heeft staat achter helpKnop. De knop is tijdens
     het wachten uitgeschakeld; een verworpen Promise wordt de Nederlandse
     boodschap van de datalaag, in de live-regio én als pil met de knop
     "Vraag stellen" (foutMelden). Bij succes zegt de melding in
     klantentaal wat er nu gebeurt (advies 40) en tekent ctx.ververs de
     route opnieuw. Akkoord en samplebeslissing lopen via
     uitgesteldeActie: tien seconden Ongedaan maken (advies 14).
     ============================================================ */

  /* de knop Ongedaan maken ín het paneel — dezelfde als in de pil, zodat
     een toetsenbordgebruiker hem heeft waar zijn focus al is */
  var ongedaanKnop = function (ctx, ui) {
    var k = ui.el('button', { type: 'button', class: 'u-btn ghost k-ongedaan', text: T(ctx, 'Ongedaan maken') });
    k.hidden = true;
    return k;
  };

  /* --- 6a. akkoord geven op een fase --- */
  var paneelAkkoord = function (ctx, o) {
    var ui = UI(ctx);
    var p = PM(ctx);
    var stage = opt(o.stage), project = opt(o.project);
    var faseNaam = faseNaamVan(ctx);
    var fase = faseNaam(stage.stageKey);
    var pct = getal(stage.paymentPct, 0);
    var inv = factuurVoorFase(ctx, o.invoices, stage.stageKey);
    var st = (inv && p && fn(p.factuurStatusVoorKlant)) ? p.factuurStatusVoorKlant(inv, nuVan(ctx)) : null;
    var vraag = { product: tekst(project.id) || tekst(stage.projectId), tekst: TPL(ctx, 'Over {fase}: ', { fase: fase }) };

    /* het feit: de fase groot, met eronder de ene korte verklaringszin;
       het betaalmoment is een feit dat de klant vóór zijn akkoord moet
       zien, dus dat staat er als één regel bij — geen uitleg, een bedrag */
    var betaalRegel = null;
    if (pct > 0 && st && st.totaalCents > 0) {
      betaalRegel = ui.el('p', { class: 'u-sub', style: 'margin-top:4px;', 'data-no-i18n': '', text: TPL(ctx, 'Aan deze fase is een betaalmoment van {pct}% gekoppeld: factuur {label} van {bedrag}.', {
        pct: pct, label: tekst(inv.invoiceNumber || inv.label), bedrag: bedragTekst(ctx, st.totaalCents, st.valuta)
      }) + (st.betaald ? ' ' + T(ctx, 'Deze factuur is al betaald.') : '') });
    } else if (pct > 0) {
      betaalRegel = ui.el('p', { class: 'u-sub', style: 'margin-top:4px;', text: TPL(ctx, 'Hierbij hoort een betaalmoment van {pct}% van de projectsom.', { pct: pct }) });
    }
    /* de uitleg — wat het akkoord betekent en wat erbij wordt vastgelegd —
       staat achter de "i" rechts van de kop (advies 12), zodat het paneel
       zelf alleen het feit, het betaalmoment en de knop toont */
    var uitleg = TPL(ctx, 'Hiermee bevestig je dat {fase} is afgerond.', { fase: fase }) + ' '
      + T(ctx, 'Je naam en het tijdstip worden bij dit akkoord vastgelegd.');
    var kop = feitKop(ctx, ui, {
      kicker: T(ctx, 'Akkoord geven'),
      feit: fase, data: true,
      sub: betaalRegel,
      rechts: helpKnop(ctx, ui, uitleg, null)
    });

    /* de klant is ingelogd, dus zijn naam is bekend: ctx.klant.naam is de
       contactnaam van de sessie. Dan hoeft hij niets te typen — één regel
       "Je tekent als …" met een Wijzig-knop; pas daarna verschijnt het
       veld, voorgevuld. Zonder bekende naam (voorvertoning, demo zonder
       contact) blijft het veld zichtbaar en verplicht. De datalaag krijgt
       in beide gevallen dezelfde naam mee, dus de vastlegging (approvedBy)
       verandert niet. */
    var bekendeNaam = trim(klantVan(ctx).naam);
    var naamIn = ui.el('input', { class: 'input', type: 'text', autocomplete: 'name', value: bekendeNaam, required: 'required' });
    var naamVeld = veldVak(ui, T(ctx, 'Je naam'), naamIn);
    var tekenRegel = null;
    if (bekendeNaam) {
      naamVeld.hidden = true;
      var wijzig = ui.el('button', {
        type: 'button', class: 'u-btn ghost klein',
        text: T(ctx, 'Wijzig'),
        'aria-label': T(ctx, 'Wijzig de naam waarmee je tekent')
      });
      wijzig.addEventListener('click', function () {
        tekenRegel.hidden = true;
        naamVeld.hidden = false;
        try { naamIn.focus(); if (fn(naamIn.select)) naamIn.select(); } catch (e) { /* stil */ }
      });
      /* de Wijzig-knop staat vóór het verborgen veld, zodat de focus bij
         het openen van het paneel (paneelVak.openMet: eerste invoer of
         knop) op iets zichtbaars landt */
      /* de rij zelf tekent de skin (10c); de ruimte naar het veld eronder
         staat nergens in de skin en blijft daarom hier */
      tekenRegel = ui.el('div', { class: 'k-tekent', style: 'margin-bottom:10px;' }, [
        ui.el('span', { class: 'u-lees', 'data-no-i18n': '', text: TPL(ctx, 'Je tekent als {naam}.', { naam: bekendeNaam }) }),
        wijzig
      ]);
    }
    var regio = statusRegio(ui);
    var ja = ui.el('button', { type: 'button', class: 'u-btn', text: T(ctx, 'Ja, ik geef akkoord') });
    var nee = ui.el('button', { type: 'button', class: 'u-btn ghost', text: T(ctx, 'Annuleer'), onclick: function () { if (fn(o.onSluit)) o.onSluit(); } });
    var ongedaan = ongedaanKnop(ctx, ui);
    var wortel = null;

    /* terug naar de stand van vóór de klik: knoppen zoals ze waren */
    var herstel = function () {
      knopBezig(ja, false, regio, '');
      nee.hidden = false;
      ongedaan.hidden = true;
      ongedaan.onclick = null;
    };

    ja.addEventListener('click', function () {
      var naam = trim(naamIn.value);
      if (!naam) {
        regio.textContent = T(ctx, 'Vul je naam in om akkoord te geven.');
        naamIn.focus();
        return;
      }
      var doe = actie(ctx, 'akkoordGeven');
      if (!doe) { regio.textContent = T(ctx, 'Deze actie is nog niet beschikbaar.'); return; }
      var stageMet = metVeld(stage, 'projectId', project.id);
      knopBezig(ja, true, regio, '');
      nee.hidden = true;
      ongedaan.hidden = false;
      var klaarZin = 'Je akkoord is vastgelegd. Steffan gaat door met de volgende stap.';
      var hangend = uitgesteldeActie(ctx, {
        seconden: 10,
        anker: wortel,
        melding: 'Akkoord gegeven. Over {s} seconden definitief.',
        meldingEnkel: 'Akkoord gegeven. Over 1 seconde definitief.',
        ongedaanMelding: 'Akkoord ongedaan gemaakt.',
        klaarMelding: klaarZin,
        vraag: vraag,
        doe: function () { return doe(stageMet, naam); },
        bijKlaar: function () { regio.textContent = T(ctx, klaarZin); },
        bijFout: function (err) { herstel(); foutMelden(ctx, regio, err, vraag); },
        bijOngedaan: function () {
          herstel();
          regio.textContent = T(ctx, 'Akkoord ongedaan gemaakt.');
          try { ja.focus(); } catch (e) { /* stil */ }
        }
      });
      /* de live-regio zegt de zin één keer; de pil telt af */
      regio.textContent = hangend.zin();
      ongedaan.onclick = function () { hangend.ongedaan(); };
      try { ongedaan.focus(); } catch (e) { /* stil */ }
    });

    wortel = paneelKaart(ui, [
      kop,
      tekenRegel,
      naamVeld,
      knoppenRij(ui, [ja, nee, ongedaan]),
      regio
    ]);
    /* de zwevende vraagknop (advies 15) leest hier de context van een open
       paneel: een vraag vanaf dit paneel gaat over deze fase */
    wortel.setAttribute(VRAAG_CONTEXT, vraag.tekst);
    return wortel;
  };

  /* --- 6b. een sampleronde beoordelen ---
     Het feit: 'Sample T1' groot met de foto ernaast. Dan twee grote
     keuzetegels (advies 13): Goedkeuren · Aanpassing nodig — één groep
     role="radiogroup" met twee role="radio" en aria-checked; pijltjes
     wisselen, Enter en spatie kiezen (een <button> doet dat zelf). Kies
     je Aanpassing nodig, dan verschijnen het veld "Wat moet er anders?"
     en de foto met aanwijzingen; bij Goedkeuren alleen de verzendknop
     'Sample T1 goedkeuren'. De beslissing loopt via uitgesteldeActie:
     tien seconden Ongedaan maken (advies 14). */
  var TOETS_VORIG = { ArrowLeft: true, ArrowUp: true, Left: true, Up: true };
  var TOETS_VOLGEND = { ArrowRight: true, ArrowDown: true, Right: true, Down: true };

  var paneelSample = function (ctx, o) {
    var ui = UI(ctx);
    var smp = opt(o.sample);
    var media = o.media || null;
    var label = tekst(smp.roundLabel);
    var marks = [];
    var beslissing = '';
    var vraag = { product: tekst(smp.projectId), tekst: TPL(ctx, 'Over sample {x}: ', { x: label }) };
    var regio = statusRegio(ui);

    /* de foto met aanwijzingen: een klik zet een genummerde markering; de
       tekst erbij staat in de lijst eronder. x en y zijn breukdelen van de
       foto (0–1), zoals de datalaag en de seed ze opslaan. */
    var figuur = null, marksLijst = null;
    var tekenMarks = function () {
      var oude = figuur.querySelectorAll('.k-mark');
      Array.prototype.forEach.call(oude, function (n) { n.parentNode.removeChild(n); });
      while (marksLijst.firstChild) marksLijst.removeChild(marksLijst.firstChild);
      marks.forEach(function (m, i) {
        var stip = ui.el('span', {
          class: 'k-mark', 'aria-hidden': 'true',
          /* alleen de plek is data; de vorm van de stip tekent de skin (10h) */
          style: 'left:' + (m.x * 100) + '%;top:' + (m.y * 100) + '%;transform:translate(-50%,-50%);',
          text: String(i + 1)
        });
        figuur.appendChild(stip);
        var inp = ui.el('input', { class: 'input', type: 'text', value: tekst(m.tekst), 'aria-label': TPL(ctx, 'Tekst bij aanwijzing {n}', { n: i + 1 }) });
        inp.addEventListener('input', function () { m.tekst = inp.value; });
        var weg = ui.el('button', { type: 'button', class: 'u-btn ghost klein', text: T(ctx, 'Verwijder'), 'aria-label': TPL(ctx, 'Verwijder aanwijzing {n}', { n: i + 1 }), onclick: function () {
          marks.splice(i, 1);
          tekenMarks();
        } });
        marksLijst.appendChild(ui.el('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:8px;' }, [
          ui.el('span', { class: 'u-kicker', style: 'flex:none;', text: String(i + 1) }),
          inp, weg
        ]));
      });
    };

    /* DE VOORBEELDSTIP (advies 37): één stip met het label 'Klik op de plek
       die anders moet' ligt op de foto tot de eerste klik, of tot de focus
       in het opmerkingsveld landt. Decoratie (aria-hidden): de knop over
       de foto draagt de aanwijzing al in zijn naam. De skin (10h) zet hem
       midden op de foto, laat hem pulseren en respecteert
       prefers-reduced-motion. */
    var voorbeeld = null;
    var voorbeeldWeg = function () {
      if (voorbeeld && voorbeeld.parentNode) voorbeeld.parentNode.removeChild(voorbeeld);
      voorbeeld = null;
    };

    var feitBeeld = null, fotoBlok = null;
    if (media) {
      feitBeeld = ui.el('img', { class: 'k-feit-beeld', alt: '' });
      var img = ui.el('img', { alt: TPL(ctx, 'Sample {x}', { x: label }), style: 'display:block;width:100%;height:auto;border-radius:14px;' });
      beeldUrl(ctx, media).then(function (u) { if (u) { img.src = u; feitBeeld.src = u; } });
      figuur = ui.el('div', { class: 'k-aanwijsfoto' }, img);
      var klikvlak = ui.el('button', {
        type: 'button', class: 'k-fotoklik',
        'aria-label': T(ctx, 'Zet een aanwijzing op de foto')
      });
      klikvlak.addEventListener('click', function (e) {
        voorbeeldWeg();
        if (marks.length >= 50) { regio.textContent = T(ctx, 'Zet er hoogstens vijftig aanwijzingen op.'); return; }
        var r = figuur.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        if (e.clientX === 0 && e.clientY === 0) { x = 0.5; y = 0.5; } /* toetsenbord: midden */
        x = Math.max(0, Math.min(1, x)); y = Math.max(0, Math.min(1, y));
        marks.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, tekst: '' });
        tekenMarks();
        var inputs = marksLijst.querySelectorAll('input');
        if (inputs.length) inputs[inputs.length - 1].focus();
      });
      figuur.appendChild(klikvlak);
      voorbeeld = ui.el('span', { class: 'k-voorbeeldstip', 'aria-hidden': 'true' }, [
        ui.el('span', { class: 'k-voorbeeldstip-punt' }),
        ui.el('span', { class: 'k-voorbeeldstip-label', text: T(ctx, 'Klik op de plek die anders moet') })
      ]);
      figuur.appendChild(voorbeeld);
      marksLijst = ui.el('div');
      fotoBlok = ui.el('div', { class: 'k-aanwijzingen' }, [figuur, marksLijst]);
    }

    var noteIn = ui.el('textarea', { class: 'input', rows: '4' });
    noteIn.addEventListener('focus', voorbeeldWeg);
    var noteVak = veldVak(ui, T(ctx, 'Wat moet er anders?'), noteIn);
    /* alles wat alleen bij Aanpassing nodig hoort, in één blok dat pas
       verschijnt na die keuze */
    var aanpassingBlok = ui.el('div', { class: 'k-aanpassing' }, [noteVak, fotoBlok]);
    aanpassingBlok.hidden = true;

    var stuur = ui.el('button', { type: 'button', class: 'u-btn', text: TPL(ctx, 'Sample {x} goedkeuren', { x: label }) });
    var nee = ui.el('button', { type: 'button', class: 'u-btn ghost', text: T(ctx, 'Annuleer'), onclick: function () { if (fn(o.onSluit)) o.onSluit(); } });
    var ongedaan = ongedaanKnop(ctx, ui);
    var knoppen = knoppenRij(ui, [stuur, nee, ongedaan]);
    /* de verzendknop komt pas na een keuze; Annuleer staat er altijd */
    stuur.hidden = true;

    /* de keuzetegels: één radiogroep, roving tabindex — de gekozen tegel
       (of de eerste) is de tabstop, de pijltjes lopen de groep rond */
    var tegels = [];
    var kies = function (waarde) {
      beslissing = waarde;
      tegels.forEach(function (b) {
        var gekozen = b.getAttribute('data-waarde') === waarde;
        b.setAttribute('aria-checked', gekozen ? 'true' : 'false');
        b.setAttribute('tabindex', gekozen ? '0' : '-1');
        b.classList.toggle('is-gekozen', gekozen);
      });
      aanpassingBlok.hidden = waarde !== 'aanpassing';
      stuur.hidden = false;
      stuur.textContent = waarde === 'goedgekeurd' ? TPL(ctx, 'Sample {x} goedkeuren', { x: label }) : T(ctx, 'Aanpassing doorgeven');
      regio.textContent = '';
    };
    var maakTegel = function (waarde, icoon, woord) {
      var b = ui.el('button', {
        type: 'button', class: 'k-keuzetegel', role: 'radio', 'aria-checked': 'false', tabindex: '-1', 'data-waarde': waarde
      }, [
        ui.icon(icoon, 22),
        ui.el('span', { class: 'k-keuzetegel-woord', text: woord })
      ]);
      b.addEventListener('click', function () { kies(waarde); });
      b.addEventListener('keydown', function (e) {
        var k = tekst(e && e.key);
        var richting = TOETS_VORIG[k] ? -1 : (TOETS_VOLGEND[k] ? 1 : 0);
        if (!richting) return;
        if (fn(e.preventDefault)) e.preventDefault();
        var i = tegels.indexOf(b);
        var volgende = tegels[(i + richting + tegels.length) % tegels.length];
        kies(volgende.getAttribute('data-waarde'));
        try { volgende.focus(); } catch (e2) { /* stil */ }
      });
      tegels.push(b);
      return b;
    };
    var tegelGoed = maakTegel('goedgekeurd', 'vinkje', T(ctx, 'Goedkeuren'));
    var tegelAan = maakTegel('aanpassing', 'potlood', T(ctx, 'Aanpassing nodig'));
    tegelGoed.setAttribute('tabindex', '0');
    var keuze = ui.el('div', {
      class: 'k-keuzetegels', role: 'radiogroup', 'aria-label': T(ctx, 'Je beslissing')
    }, [tegelGoed, tegelAan]);

    var wortel = null;
    var herstel = function () {
      knopBezig(stuur, false, regio, '');
      nee.hidden = false;
      ongedaan.hidden = true;
      ongedaan.onclick = null;
      tegels.forEach(function (b) { b.disabled = false; });
    };

    stuur.addEventListener('click', function () {
      var note = trim(noteIn.value);
      if (!beslissing) { regio.textContent = T(ctx, 'Kies goedkeuren of aanpassing nodig.'); try { tegelGoed.focus(); } catch (e) { /* stil */ } return; }
      if (beslissing === 'aanpassing' && !note && !marks.length) {
        regio.textContent = T(ctx, 'Beschrijf wat er aangepast moet worden, of zet een aanwijzing op de foto.');
        noteIn.focus();
        return;
      }
      var doe = actie(ctx, 'sampleBeoordelen');
      if (!doe) { regio.textContent = T(ctx, 'Deze actie is nog niet beschikbaar.'); return; }
      var gekozen = beslissing;
      var schone = marks.map(function (m) { return { x: m.x, y: m.y, tekst: trim(m.tekst) }; });
      knopBezig(stuur, true, regio, '');
      nee.hidden = true;
      ongedaan.hidden = false;
      tegels.forEach(function (b) { b.disabled = true; });
      var klaarZin = 'Je beoordeling is verstuurd. Steffan neemt hem mee in de volgende ronde.';
      var hangend = uitgesteldeActie(ctx, {
        seconden: 10,
        anker: wortel,
        melding: 'Beoordeling gegeven. Over {s} seconden definitief.',
        meldingEnkel: 'Beoordeling gegeven. Over 1 seconde definitief.',
        ongedaanMelding: 'Beoordeling ongedaan gemaakt.',
        klaarMelding: klaarZin,
        vraag: vraag,
        doe: function () { return doe(smp, gekozen, note, schone); },
        bijKlaar: function () { regio.textContent = T(ctx, klaarZin); },
        bijFout: function (err) { herstel(); foutMelden(ctx, regio, err, vraag); },
        bijOngedaan: function () {
          herstel();
          regio.textContent = T(ctx, 'Beoordeling ongedaan gemaakt.');
          try { stuur.focus(); } catch (e) { /* stil */ }
        }
      });
      regio.textContent = hangend.zin();
      ongedaan.onclick = function () { hangend.ongedaan(); };
      try { ongedaan.focus(); } catch (e3) { /* stil */ }
    });

    wortel = paneelKaart(ui, [
      feitKop(ctx, ui, {
        kicker: T(ctx, 'Sample beoordelen'),
        feit: TPL(ctx, 'Sample {x}', { x: label }), data: true,
        sub: tekst(smp.note) ? dataRegel(ui, 'u-sub', tekst(smp.note), { style: 'margin-top:4px;' }) : null,
        rechts: feitBeeld
      }),
      keuze,
      aanpassingBlok,
      knoppen,
      regio
    ]);
    wortel.setAttribute(VRAAG_CONTEXT, vraag.tekst);
    return wortel;
  };

  /* --- 6c. een bestand aanleveren in een verwacht slot --- */
  var DOC_TYPE_LABELS = {
    nnn: 'NNN', quote: 'Offerte', invoice: 'Factuur', inspection: 'Inspectierapport',
    compliance: 'Compliance', shipping: 'Verzending', other: 'Overig',
    logo: 'Logo', artwork: 'Artwork', specificatie: 'Specificatie'
  };
  var docTypeLabel = function (ctx, key) {
    var k = tekst(key);
    return Object.prototype.hasOwnProperty.call(DOC_TYPE_LABELS, k) ? T(ctx, DOC_TYPE_LABELS[k]) : k;
  };

  /* het gevraagde formaat van een slot, als het slot dat veld draagt (de
     demo en 0005 kennen het nog niet; een later veld accept / formaat /
     extensies wint dan vanzelf). Uit: {lijst: ['.ai', '.pdf'], accept:
     '.ai,.pdf'} of null. Een mime-type ('image/png') blijft zoals het is. */
  var slotFormaat = function (slot) {
    var ruw = slot.accept || slot.formaat || slot.format || slot.extensies || slot.extensions || slot.gevraagdFormaat || null;
    var delen = Array.isArray(ruw) ? ruw : tekst(ruw).split(/[,\s;]+/);
    var uit = [];
    delen.forEach(function (d) {
      var s = trim(d);
      if (!s) return;
      if (s.indexOf('/') < 0 && s.charAt(0) !== '.') s = '.' + s;
      if (uit.indexOf(s) < 0) uit.push(s);
    });
    return uit.length ? { lijst: uit, accept: uit.join(',') } : null;
  };

  /* --- 6c. een bestand aanleveren in een verwacht slot ---
     Het feit: het slot (type groot, fase eronder). Dan het sleepvak
     (advies 38): een drop-zone rond het bestandsveld met het gevraagde
     formaat en de maximale grootte in één regel; na de keuze staan naam
     en grootte eronder. Validatie zoals de datalaag hem doet (leeg, te
     groot), met dezelfde zinnen. */
  var paneelBestand = function (ctx, o) {
    var ui = UI(ctx);
    var slot = opt(o.slot);
    var d = DL(ctx);
    var faseNaam = faseNaamVan(ctx);
    var type = docTypeLabel(ctx, slot.docType);
    var maxBytes = (d && typeof d.UPLOAD_MAX_BYTES === 'number' && d.UPLOAD_MAX_BYTES > 0) ? d.UPLOAD_MAX_BYTES : 26214400;
    var formaat = slotFormaat(slot);
    var vraag = { product: tekst(slot.projectId), tekst: '' };
    var regio = statusRegio(ui);

    var hintId = uid('sleep');
    var fileIn = ui.el('input', { class: 'input k-sleepvak-invoer', type: 'file', accept: formaat ? formaat.accept : null, 'aria-describedby': hintId });
    var noteIn = ui.el('textarea', { class: 'input', rows: '3', placeholder: T(ctx, 'Bijvoorbeeld welke versie dit is of waar Steffan op moet letten.') });
    var gekozen = null;
    var gekozenRegel = ui.el('p', { class: 'k-sleepvak-bestand u-lees', 'data-no-i18n': '' });
    gekozenRegel.hidden = true;

    /* de zin van de datalaag voor een te groot bestand, zodat het scherm
       en de laag hetzelfde zeggen; zonder die laag de zin zoals hij daar
       staat */
    var teGrootZin = function () {
      var zin = '';
      if (d && fn(d.berichtVoorFout)) { try { zin = tekst(d.berichtVoorFout('bestand_te_groot')); } catch (e) { zin = ''; } }
      return T(ctx, zin || 'Dit bestand is groter dan 25 MB. Kies een kleiner bestand.');
    };
    var zetGekozen = function (bestand) {
      gekozen = bestand || null;
      regio.textContent = '';
      if (!gekozen) { gekozenRegel.hidden = true; gekozenRegel.textContent = ''; return; }
      gekozenRegel.textContent = samen([tekst(gekozen.name), bestandsGrootte(gekozen.size)]);
      gekozenRegel.hidden = false;
      if (getal(gekozen.size, 0) > maxBytes) regio.textContent = teGrootZin();
    };
    fileIn.addEventListener('change', function () { zetGekozen(fileIn.files && fileIn.files[0]); });

    var sleepvak = ui.el('div', { class: 'k-sleepvak' }, [
      ui.el('label', { class: 'field' }, [
        ui.el('span', { class: 'flabel k-sleepvak-label', id: hintId, text: formaat
          ? TPL(ctx, '{type} als {formaat}', { type: type, formaat: formaat.lijst.join(' ' + T(ctx, 'of') + ' ') })
          : T(ctx, 'Kies een bestand of sleep het hierheen') }),
        fileIn
      ]),
      ui.el('p', { class: 'u-sub k-sleepvak-max', text: TPL(ctx, 'Maximaal {mb} MB per bestand.', { mb: Math.round(maxBytes / 1048576) }) }),
      gekozenRegel
    ]);
    /* de drop-zone: dragenter/dragover moeten preventDefault doen, anders
       opent de browser het bestand zelf; is-over is de haak voor de skin */
    var over = function (e) { if (e && fn(e.preventDefault)) e.preventDefault(); sleepvak.classList.add('is-over'); };
    var weg = function () { sleepvak.classList.remove('is-over'); };
    sleepvak.addEventListener('dragenter', over);
    sleepvak.addEventListener('dragover', over);
    sleepvak.addEventListener('dragleave', weg);
    sleepvak.addEventListener('drop', function (e) {
      if (e && fn(e.preventDefault)) e.preventDefault();
      weg();
      var dt = e && e.dataTransfer;
      var f = (dt && dt.files && dt.files[0]) ? dt.files[0] : null;
      if (!f) return;
      /* het bestand ook in het veld zetten waar dat kan, zodat het veld en
         de regel eronder hetzelfde zeggen */
      try { fileIn.files = dt.files; } catch (e2) { /* dan alleen in gekozen */ }
      zetGekozen(f);
    });

    var stuur = ui.el('button', { type: 'button', class: 'u-btn', text: T(ctx, 'Bestand versturen') });
    var nee = ui.el('button', { type: 'button', class: 'u-btn ghost', text: T(ctx, 'Annuleer'), onclick: function () { if (fn(o.onSluit)) o.onSluit(); } });

    stuur.addEventListener('click', function () {
      var bestand = gekozen || ((fileIn.files && fileIn.files[0]) ? fileIn.files[0] : null);
      if (!bestand) { regio.textContent = T(ctx, 'Kies eerst een bestand.'); fileIn.focus(); return; }
      if (getal(bestand.size, 0) > maxBytes) { regio.textContent = teGrootZin(); fileIn.focus(); return; }
      var doe = actie(ctx, 'bestandAanleveren');
      if (!doe) { regio.textContent = T(ctx, 'Deze actie is nog niet beschikbaar.'); return; }
      knopBezig(stuur, true, regio, T(ctx, 'Je bestand wordt geüpload…'));
      nee.disabled = true;
      doe(slot, bestand, trim(noteIn.value)).then(function () {
        var zin = T(ctx, 'Je bestand is aangekomen. Steffan bekijkt het en geeft een seintje.');
        regio.textContent = zin;
        naSucces(ctx, zin);
      }, function (err) {
        knopBezig(stuur, false, regio, '');
        nee.disabled = false;
        foutMelden(ctx, regio, err, vraag);
      });
    });

    return paneelKaart(ui, [
      feitKop(ctx, ui, {
        kicker: T(ctx, 'Bestand aanleveren'),
        feit: type, data: true,
        sub: slot.stageKey ? TPL(ctx, 'Verwacht in de fase {fase}.', { fase: faseNaam(slot.stageKey) }) : ''
      }),
      sleepvak,
      ruimte(ui, 14),
      veldVak(ui, T(ctx, 'Opmerking (optioneel)'), noteIn),
      knoppenRij(ui, [stuur, nee]),
      regio
    ]);
  };

  /* --- 6d. opnieuw bestellen --- */
  var paneelHerbestel = function (ctx, o) {
    var ui = UI(ctx);
    var project = opt(o.project);

    var qtyIn = ui.el('input', { class: 'input', type: 'number', min: '1', step: '1', inputmode: 'numeric', placeholder: T(ctx, 'bv. 5000'), required: 'required' });
    var datumIn = ui.el('input', { class: 'input', type: 'date', min: vandaagVan(ctx) });
    var naamGroep = 'k-reorder-' + tekst(project.id).replace(/[^a-zA-Z0-9_-]/g, '');
    var zelfde = ui.el('input', { type: 'radio', name: naamGroep, value: 'zelfde', checked: true });
    var anders = ui.el('input', { type: 'radio', name: naamGroep, value: 'anders' });
    var noteIn = ui.el('textarea', { class: 'input', rows: '4' });
    var noteVak = veldVak(ui, T(ctx, 'Wat moet er anders?'), noteIn);
    noteVak.hidden = true;
    var zetNote = function () { noteVak.hidden = !anders.checked; };
    zelfde.addEventListener('change', zetNote);
    anders.addEventListener('change', zetNote);

    var regio = statusRegio(ui);
    var vraag = { product: tekst(project.id), tekst: '' };
    var stuur = ui.el('button', { type: 'button', class: 'u-btn', text: T(ctx, 'Verstuur aanvraag') });
    var nee = ui.el('button', { type: 'button', class: 'u-btn ghost', text: T(ctx, 'Annuleer'), onclick: function () { if (fn(o.onSluit)) o.onSluit(); } });

    stuur.addEventListener('click', function () {
      var n = parseInt(qtyIn.value, 10);
      if (!(n > 0)) { regio.textContent = T(ctx, 'Vul een aantal in van minstens 1 stuk.'); qtyIn.focus(); return; }
      if (anders.checked && !trim(noteIn.value)) { regio.textContent = T(ctx, 'Beschrijf wat er anders moet dan bij de vorige bestelling.'); noteIn.focus(); return; }
      var doe = actie(ctx, 'herbestellen');
      if (!doe) { regio.textContent = T(ctx, 'Deze actie is nog niet beschikbaar.'); return; }
      knopBezig(stuur, true, regio, T(ctx, 'Je aanvraag wordt verstuurd…'));
      nee.disabled = true;
      doe(project, {
        qty: n,
        gewenstOpISO: trim(datumIn.value) || null,
        zelfdeSpec: !anders.checked,
        wijziging: anders.checked ? trim(noteIn.value) : ''
      }).then(function () {
        var zin = T(ctx, 'Je aanvraag is binnen. Steffan bevestigt met een offerte.');
        regio.textContent = zin;
        naSucces(ctx, zin);
      }, function (err) {
        knopBezig(stuur, false, regio, '');
        nee.disabled = false;
        foutMelden(ctx, regio, err, vraag);
      });
    });

    /* het feit: het product groot; de uitleg over het dossier en de
       offerte staat achter de "i" naast de kop (advies 12) */
    return paneelKaart(ui, [
      feitKop(ctx, ui, {
        kicker: T(ctx, 'Opnieuw bestellen'),
        feit: tekst(project.name), data: true,
        rechts: helpKnop(ctx, ui, T(ctx, 'Het volledige dossier — golden sample, laatste rapporten en fabriek — gaat automatisch mee als referentie. Steffan bevestigt met een offerte, want prijzen kunnen per batch verschillen.'), null)
      }),
      veldVak(ui, T(ctx, 'Aantal stuks'), qtyIn),
      veldVak(ui, T(ctx, 'Gewenste leverdatum (optioneel)'), datumIn),
      ui.el('fieldset', { style: 'border:0;padding:0;margin:0 0 10px;' }, [
        ui.el('legend', { class: 'flabel', text: T(ctx, 'Specificatie') }),
        ui.el('label', { class: 'checkline' }, [zelfde, ui.el('span', { text: T(ctx, 'Zelfde specificatie als de vorige batch') })]),
        ui.el('label', { class: 'checkline' }, [anders, ui.el('span', { text: T(ctx, 'Met een wijziging') })])
      ]),
      noteVak,
      knoppenRij(ui, [stuur, nee]),
      regio
    ]);
  };

  /* --- 6e. een bericht: antwoord in een draad, of een nieuwe vraag --- */
  /* o.klaar: de bevestiging in klantentaal (advies 40); o.voorvul: de
     eerste woorden al in het veld ('Over factuur 2026-001: '); o.vraag:
     {product, tekst} voor de knop "Vraag stellen" in de foutpil;
     o.annuleer: een functie → er komt een Annuleer-knop naast de verzendknop;
     o.groot: de primaire knopmaat (in een actiepaneel); o.veldKlasse: een
     extra klasse op het veld, zodat een ander deel van het scherm het
     terugvindt; o.daarna(zin): wat er na het versturen gebeurt in plaats
     van de gewone verversing */
  var berichtVak = function (ctx, o) {
    var ui = UI(ctx);
    var veld = ui.el('textarea', {
      class: 'input' + (tekst(o.veldKlasse) ? ' ' + tekst(o.veldKlasse) : ''),
      rows: o.rijen || '3', 'aria-label': tekst(o.label) || T(ctx, 'Je bericht'), placeholder: tekst(o.placeholder) || ''
    });
    /* veld.voorvul onthoudt wat het scherm zelf invulde: de zwevende
       vraagknop mag dát vervangen, maar nooit wat de klant al typte */
    if (tekst(o.voorvul)) { veld.value = tekst(o.voorvul); veld.voorvul = tekst(o.voorvul); }
    var regio = statusRegio(ui);
    var stuur = ui.el('button', { type: 'button', class: o.groot ? 'u-btn' : 'u-btn klein', text: tekst(o.knop) || T(ctx, 'Verstuur') });
    var nee = fn(o.annuleer) ? ui.el('button', { type: 'button', class: 'u-btn ghost klein', text: T(ctx, 'Annuleer'), onclick: function () { o.annuleer(); } }) : null;
    stuur.addEventListener('click', function () {
      var body = trim(veld.value);
      if (!body) { regio.textContent = T(ctx, 'Schrijf eerst een bericht.'); veld.focus(); return; }
      if (body.length > 4000) { regio.textContent = T(ctx, 'Je bericht is te lang. Houd het onder de 4000 tekens.'); veld.focus(); return; }
      var doe = fn(o.doe);
      if (!doe) { regio.textContent = T(ctx, 'Deze actie is nog niet beschikbaar.'); return; }
      knopBezig(stuur, true, regio, T(ctx, 'Je bericht wordt verstuurd…'));
      if (nee) nee.disabled = true;
      doe(body).then(function () {
        var zin = T(ctx, tekst(o.klaar) || 'Je bericht is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.');
        regio.textContent = zin;
        if (fn(o.daarna)) { toast(ctx, zin); o.daarna(zin); }
        else naSucces(ctx, zin);
      }, function (err) {
        knopBezig(stuur, false, regio, '');
        if (nee) nee.disabled = false;
        foutMelden(ctx, regio, err, o.vraag);
      });
    });
    var wrap = ui.el('div', null, [
      tekst(o.label) ? veldVak(ui, tekst(o.label), veld) : veld,
      ui.el('div', { style: 'margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;' }, [stuur, nee]),
      regio
    ]);
    wrap.veld = veld;
    return wrap;
  };

  /* ============================================================
     7. GEDEELDE AFLEIDINGEN VOOR DE DRIE SCHERMEN
     ============================================================ */

  /* de Inbox van de klant: CP_PORTAAL.watWeNodigHebben over de platte bron.
     Elk item draagt zijn actie uit het contract; itemTitel() en itemSub()
     vertalen de sjablonen en vullen de plaatshouders — datums en bedragen
     gaan er hier in, nooit in het model (regel 2 van portaal-model.js). */
  var nodigItems = function (ctx, bron) {
    var p = PM(ctx);
    if (!p || !fn(p.watWeNodigHebben)) return [];
    try { return lijst(p.watWeNodigHebben(bron, nuVan(ctx), portaalOpties(ctx))); } catch (e) { return []; }
  };
  var itemVars = function (ctx, it) {
    var p = PM(ctx);
    var extra = {};
    if (it.datumISO) extra.datum = datumTekst(ctx, it.datumISO);
    if (typeof it.cents === 'number') extra.bedrag = bedragTekst(ctx, it.cents, it.valuta);
    return (p && fn(p.metVars)) ? p.metVars(it.vars, extra) : (function () {
      var uit = {}, k;
      for (k in opt(it.vars)) if (Object.prototype.hasOwnProperty.call(it.vars, k)) uit[k] = it.vars[k];
      for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) uit[k] = extra[k];
      return uit;
    })();
  };
  var itemTitel = function (ctx, it) { return TPL(ctx, it.titel, itemVars(ctx, it)); };
  var itemSub = function (ctx, it) { return it.sub ? TPL(ctx, it.sub, itemVars(ctx, it)) : ''; };
  var itemKnop = function (ctx, it) { return TPL(ctx, it.actieLabel, itemVars(ctx, it)); };

  var SOORT_ICOON = { sample: 'camera', akkoord: 'vinkje', factuur: 'financien', vraag: 'inbox', bestand: 'bestand', herbestel: 'projecten' };
  var soortLabel = function (ctx, kind) {
    var p = PM(ctx);
    var uit = '';
    lijst(p && p.SOORTEN_NODIG).forEach(function (s) { if (s && s.key === kind) uit = tekst(s.label); });
    return uit ? T(ctx, uit) : '';
  };

  /* de "volgende stap" van een product: het eerste item dat op de klant
     wacht (niet de herbestelsuggestie), anders de eerlijke zin van
     nextStep() — 'Niets nodig van jou — {fase} loopt.' of 'Alle fases zijn
     afgerond — je project is klaar.' (portal/status.js) */
  var volgendeStap = function (ctx, bron, project) {
    var p = PM(ctx);
    var items = nodigItems(ctx, miniBundel(bron, project));
    var eerste = null;
    items.forEach(function (it) { if (!eerste && it && it.kind !== 'herbestel') eerste = it; });
    if (eerste) return { tekst: itemTitel(ctx, eerste), item: eerste };
    var v = (p && fn(p.voortgang)) ? p.voortgang(project) : { klaar: false, huidigeFase: null };
    var ST = (root.CP_STATUS && root.CP_STATUS.templates) || {};
    if (v.klaar) return { tekst: T(ctx, ST.allDone || 'Alle fases zijn afgerond — je project is klaar.'), item: null };
    var cur = v.huidigeFase;
    return {
      tekst: TPL(ctx, ST.nothingNeeded || 'Niets nodig van jou — {fase} loopt.', { fase: cur ? faseNaamVan(ctx)(cur.stageKey) : '' }),
      item: null
    };
  };

  /* de stand van een product in woorden: afgerond, gearchiveerd, of de
     huidige fase met zijn stand */
  var productStand = function (ctx, project) {
    var p = PM(ctx);
    var v = (p && fn(p.voortgang)) ? p.voortgang(project) : { klaar: false, huidigeFase: huidigeFase(fasesVan(project)) };
    if (v.klaar) return { woord: T(ctx, 'Afgerond'), toon: 'klaar', fase: null };
    if (tekst(project.status) === 'archived') return { woord: T(ctx, 'Gearchiveerd'), toon: 'neutraal', fase: null };
    var cur = v.huidigeFase;
    if (!cur) return { woord: T(ctx, 'Nog geen fases'), toon: 'neutraal', fase: null };
    var st = faseStand(ctx, cur.status);
    return { woord: st.woord, toon: st.toon, fase: cur };
  };

  /* de belangrijke datums, met de toon per soort (kleur is nooit de enige
     drager: het label zegt wat het is) */
  var DATUM_TOON = { eta: 'extern', sample: 'wacht', factuur: 'wacht', deadline: 'wacht', bericht: 'extern' };
  var belangrijkeDatums = function (ctx, bron) {
    var p = PM(ctx);
    if (!p || !fn(p.belangrijkeDatums)) return [];
    var rijen;
    try { rijen = lijst(p.belangrijkeDatums(bron, nuVan(ctx), portaalOpties(ctx))); } catch (e) { return []; }
    return rijen.map(function (r) {
      var toon = r.urgent ? 'kritiek' : (DATUM_TOON[r.soort] || 'neutraal');
      var vars = opt(r.vars), extra = {};
      if (r.vanISO && r.totISO) { extra.van = datumKort(ctx, r.vanISO); extra.tot = datumKort(ctx, r.totISO); }
      var titel = TPL(ctx, r.label, (p && fn(p.metVars)) ? p.metVars(vars, extra) : vars);
      var sub = '';
      if (r.soort === 'eta' && r.vanISO && r.totISO) sub = TPL(ctx, 'Tussen {a} en {b}', { a: datumKort(ctx, r.vanISO), b: datumKort(ctx, r.totISO) });
      return {
        iso: r.iso, soort: r.soort, projectId: r.projectId, titel: titel, sub: sub,
        toon: toon, toonWoord: r.urgent ? T(ctx, 'Datum verstreken') : (r.verstreken ? T(ctx, 'Voorbij') : T(ctx, 'Staat gepland')),
        urgent: !!r.urgent
      };
    });
  };

  /* de gedateerde rij (datumkicker boven de titel) — CP_UI.entityRow kent
     geen kickerslot, dus dezelfde samenstelling als de beheerrail */
  var datumRij = function (ctx, ui, r) {
    var inhoud = [
      ui.el('span', { class: 'u-row-main' }, [
        ui.el('span', { class: 'u-datekicker', 'data-no-i18n': '', text: datumKicker(ctx, r.iso) }),
        ui.el('span', { class: 'u-row-title', 'data-no-i18n': '', text: tekst(r.titel) }),
        tekst(r.sub) ? ui.el('span', { class: 'u-row-sub', 'data-no-i18n': '', text: tekst(r.sub) }) : null
      ]),
      ui.el('span', { class: 'u-row-end' }, ui.statusDot({ toon: tekst(r.toon), label: tekst(r.toonWoord) }))
    ];
    if (fn(r.onOpen)) return ui.el('button', { type: 'button', class: 'u-row', onclick: r.onOpen }, inhoud);
    return ui.el('div', { class: 'u-row' }, inhoud);
  };

  /* het contactpersoonblok: avatar, naam, rol, de eerlijke regel over de
     reactietijd (die staat al in het oude portaal) */
  var contactBlok = function (ctx, ui, contact) {
    var c = isObj(contact) ? contact : null;
    var naam = c ? tekst(c.name) : 'Steffan Bakker';
    var rol = c ? tekst(c.roleLabel) : T(ctx, 'Oprichter CUSTOM+ — leest en beantwoordt elk bericht zelf');
    return ui.el('div', { style: 'display:flex;gap:14px;align-items:center;' }, [
      ui.avatar({ naam: naam, url: c ? tekst(c.avatarUrl) : '', maat: 48 }),
      ui.el('div', { style: 'min-width:0;' }, [
        ui.el('div', { class: 'u-row-title', 'data-no-i18n': '', text: naam }),
        rol ? ui.el('div', { class: 'u-sub', 'data-no-i18n': c ? '' : null, text: rol }) : null,
        ui.el('div', { class: 'u-sub', text: T(ctx, 'Reageert meestal binnen 1 werkdag') })
      ])
    ]);
  };

  /* de datalaag ophalen zonder ooit een scherm te laten klappen: een
     mislukte of ontbrekende leesfunctie levert de lege stand */
  var haal = function (ctx, naam, args, leeg) {
    var d = DL(ctx);
    var f = d ? fn(d[naam]) : null;
    if (!f) return Promise.resolve(leeg);
    var uit;
    try { uit = f.apply(d, lijst(args)); } catch (e) { return Promise.resolve(leeg); }
    return Promise.resolve(uit).then(function (v) { return (v === undefined || v === null) ? leeg : v; }, function () { return leeg; });
  };

  /* zonder CP_UI is er geen enkele vorm; dan nog één geldig element */
  var noodElement = function (naam) {
    var div = document.createElement('div');
    var kop = document.createElement('h1');
    kop.textContent = tekst(naam);
    var p = document.createElement('p');
    p.textContent = 'De componentbibliotheek (portal/admin-ui.js) is niet geladen, dus dit scherm kan niet worden getekend.';
    div.appendChild(kop);
    div.appendChild(p);
    return div;
  };

  /* ============================================================
     7b. RONDE 3 — DE BOUWSTENEN VAN DE NIEUWE STRUCTUUR

     De begroeting met stand (31), de banner "Wacht op jou" bovenaan (11,
     36), de fasebalk met zes stippen (22), de held met de productfoto (21,
     33), de hulpknop voor uitleg die langer is dan één zin (1) en het
     geheugen van de ingeklapte kerngegevens (23). Alles wat hier nieuw van
     CP_PORTAAL komt, heeft een terugval: de modelagent bouwt parallel.
     Nooit wordt hier iets geschat — geen leverdatum uit een fase, geen
     doorlooptijd zonder bron.
     ============================================================ */

  /* het geheugen van een inklapkaart: localStorage, en stil zonder
     (privémodus, een test) — dan begint de kaart gewoon ingeklapt */
  var GEHEUGEN_KERN = 'cp_kern_open';
  var geheugenLees = function (sleutel) {
    try {
      var s = root.localStorage;
      return (s && fn(s.getItem)) ? tekst(s.getItem(sleutel)) : '';
    } catch (e) { return ''; }
  };
  var geheugenZet = function (sleutel, waarde) {
    try {
      var s = root.localStorage;
      if (s && fn(s.setItem)) s.setItem(sleutel, tekst(waarde));
    } catch (e) { /* dan onthoudt de browser het niet; de kaart werkt toch */ }
  };

  /* UITLEG ACHTER EEN "i" (advies 1): elke kaart hoogstens één zin; wat
     langer is staat hier. CP_UI.helpHint zodra dat bestaat; anders een
     icoonknop met aria-expanded die één regel eronder open- en dichtklapt —
     hetzelfde schakelpatroon als paneelVak, geen nieuw component. Het
     argument kort is de ene zichtbare zin (een node) naast de knop. */
  var helpKnop = function (ctx, ui, uitleg, kort) {
    var zin = trim(uitleg);
    if (!zin) return kort || null;
    var hint = null;
    if (fn(ui.helpHint)) {
      try { hint = ui.helpHint({ tekst: zin, label: T(ctx, 'Uitleg') }); } catch (e) { hint = null; }
      if (!isNode(hint)) hint = null;
    }
    var regel = null;
    if (!hint) {
      var id = uid('help');
      regel = ui.el('p', { class: 'u-sub k-help-tekst', id: id, text: zin });
      regel.hidden = true;
      hint = ui.el('button', {
        type: 'button', class: 'u-iconbtn k-help', 'aria-label': T(ctx, 'Uitleg'), title: zin,
        'aria-expanded': 'false', 'aria-controls': id
      }, ui.icon('vraagteken', 20));
      hint.addEventListener('click', function () {
        var open = regel.hidden;
        regel.hidden = !open;
        hint.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    return ui.el('div', { class: 'k-help-vak' }, [
      ui.el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;' }, [kort || null, hint]),
      regel
    ]);
  };

  /* 'Verwacht bij jou: {datum}' (advies 33) — alleen uit een echte datum:
     CP_PORTAAL.verwachteLevering leest een zending-ETA of een expliciete
     planningsdatum. Is er geen datum, dan klein en stil 'Nog geen
     leverdatum' (de skin zet --ink-2 en schuin, 10c). Een afgerond product
     toont de echte leverdatum van de laatste zending, of niets — nooit
     'nog geen'. */
  var verwachtRegel = function (ctx, ui, b, klaar) {
    var p = PM(ctx);
    if (klaar) {
      var geleverd = lijst(b.shipments).filter(function (s) { return s && s.deliveredAt; }).sort(function (a, c) {
        return tekst(c.deliveredAt) < tekst(a.deliveredAt) ? -1 : 1;
      });
      if (!geleverd.length) return null;
      return ui.el('span', { class: 'k-verwacht u-sub', 'data-no-i18n': '', text: TPL(ctx, 'Geleverd {d}', { d: datumKort(ctx, geleverd[0].deliveredAt) }) });
    }
    var vl = null;
    if (p && fn(p.verwachteLevering)) {
      try { vl = p.verwachteLevering(b); } catch (e) { vl = null; }
    }
    var iso = isObj(vl) ? tekst(vl.datumISO) : '';
    if (iso) {
      return ui.el('span', { class: 'k-verwacht u-sub', 'data-no-i18n': '', text: TPL(ctx, 'Verwacht bij jou: {datum}', { datum: datumKort(ctx, iso) }) });
    }
    return ui.el('span', { class: 'k-verwacht k-verwacht-leeg u-sub', text: T(ctx, 'Nog geen leverdatum') });
  };

  /* DE BEGROETING MET STAND (advies 31). De delen komen van
     CP_PORTAAL.begroeting(bundle, nu) → {naam, product, faseKort, nodig};
     elk deel heeft een terugval (naam uit ctx.klant, product uit het
     project, fase via faseKort, nodig uit de telling van het scherm). De
     zin zelf bouwt dit bestand met Tpl, zodat elke variant één hele
     bronstring is. */
  var begroetingDelen = function (ctx, b, nodig) {
    var p = PM(ctx);
    var d = null;
    if (p && fn(p.begroeting) && isObj(b) && isObj(b.project)) {
      try { d = p.begroeting(b, nuVan(ctx)); } catch (e) { d = null; }
    }
    d = opt(d);
    var klant = klantVan(ctx);
    var project = opt(opt(b).project);
    var stages = fasesVan(project, opt(b).stages);
    var v = (p && fn(p.voortgang) && isObj(b) && isObj(b.project)) ? p.voortgang(project, stages) : { klaar: false };
    var cur = v.klaar ? null : huidigeFase(stages);
    return {
      naam: tekst(d.naam) || tekst(klant.voornaam) || tekst(klant.naam),
      product: tekst(d.product) || tekst(project.name),
      fase: tekst(d.faseKort) ? T(ctx, tekst(d.faseKort)) : (cur ? faseKortVan(ctx)(cur.stageKey) : ''),
      nodig: (typeof d.nodig === 'number') ? d.nodig : getal(nodig, 0)
    };
  };
  /* zonder naam geen begroeting: "Hoi," tegen niemand is erger dan geen
     regel. Met product én fase de volle zin uit het contract; anders (meer
     producten, of een afgerond product zonder lopende fase) 'Hoi {naam}.'
     plus de telling. */
  var begroetingRegel = function (ctx, ui, delen) {
    var d = opt(delen);
    if (!tekst(d.naam)) return null;
    var n = getal(d.nodig, 0);
    var zin;
    if (tekst(d.product) && tekst(d.fase)) {
      var vars = { naam: d.naam, product: d.product, fase: d.fase, n: n };
      if (n === 1) zin = TPL(ctx, 'Hoi {naam}, je {product} zit in de fase {fase}. Eén ding wacht op jou.', vars);
      else if (n > 1) zin = TPL(ctx, 'Hoi {naam}, je {product} zit in de fase {fase}. {n} dingen wachten op jou.', vars);
      else zin = TPL(ctx, 'Hoi {naam}, je {product} zit in de fase {fase}. Niets wacht op jou.', vars);
    } else {
      zin = TPL(ctx, 'Hoi {naam}.', { naam: d.naam }) + ' '
        + (n === 1 ? T(ctx, 'Eén ding wacht op jou.') : (n > 1 ? TPL(ctx, '{n} dingen wachten op jou.', { n: n }) : T(ctx, 'Niets wacht op jou.')));
    }
    return ui.el('p', { class: 'k-begroeting u-lees', 'data-no-i18n': '', text: zin });
  };

  /* DE BANNER "WACHT OP JOU" (advies 11, 36): de eerste open actie met
     haar ene knop en het paneel dat eronder openklapt — hetzelfde paneel
     als in de rail en op de kaarten (openItemActie). Bij meer acties 'en
     nog {n}' als knop die naar de rest springt (o.meerDoel levert het
     element: op Overzicht de lijst eronder, op de productpagina de rail).
     Zonder open actie één regel, geen kaart. Een afgerond product zet hier
     de herbestelknop als primaire knop. */
  var nodigBanner = function (ctx, ui, items, bron, projectOp, o) {
    o = opt(o);
    var alle = lijst(items).filter(isObj);
    var eerste = null;
    alle.forEach(function (it) { if (!eerste && it.kind !== 'herbestel') eerste = it; });
    if (!eerste && alle.length) eerste = alle[0];
    if (!eerste) {
      return ui.el('p', { class: 'k-nodig-leeg u-lees', text: T(ctx, 'Niets te doen. Steffan meldt zich als hij je nodig heeft.') });
    }
    var rest = alle.length - 1;
    var project = eerste.projectId ? (projectOp[eerste.projectId] || null) : null;
    var vak = paneelVak(ui); /* de skin (10c) zet het paneel in de banner op 14px 0 0 */
    var knop = ui.el('button', { type: 'button', class: 'u-btn', text: itemKnop(ctx, eerste) });
    /* alleen een knop die een paneel opent draagt aria-expanded; een
       factuur of vraag navigeert weg */
    if (eerste.kind !== 'factuur' && eerste.kind !== 'vraag') knop.setAttribute('aria-expanded', 'false');
    knop.addEventListener('click', function () { openItemActie(ctx, eerste, project, bron, vak, knop); });

    var meer = null;
    if (rest > 0) {
      meer = ui.el('button', {
        type: 'button', class: 'u-link k-nodig-meer',
        'aria-label': T(ctx, 'Toon alles wat op jou wacht'),
        text: TPL(ctx, 'en nog {n}', { n: rest })
      });
      meer.addEventListener('click', function () {
        var doel = fn(o.meerDoel) ? o.meerDoel() : null;
        if (!isNode(doel)) return;
        if (fn(doel.scrollIntoView)) doel.scrollIntoView({ block: 'start' });
        var f = doel.querySelector ? doel.querySelector('button, a, [tabindex]') : null;
        if (f && fn(f.focus)) { try { f.focus(); } catch (e) { /* stil */ } }
      });
    }
    var stip = eerste.kind === 'herbestel'
      ? ui.statusDot({ toon: 'klaar', label: T(ctx, 'Afgerond') })
      : ui.statusDot({
        toon: eerste.urgent ? 'kritiek' : 'wacht',
        label: eerste.urgent
          ? (eerste.datumISO ? T(ctx, 'Vervaldatum verstreken') : T(ctx, 'Wacht al langer dan een week'))
          : T(ctx, 'Wacht op jou')
      });
    var context = o.toonProduct ? (project ? tekst(project.name) : tekst(opt(eerste.vars).product)) : '';
    var meta = [];
    if (typeof eerste.cents === 'number' && eerste.cents > 0) meta.push(bedragTekst(ctx, eerste.cents, eerste.valuta));
    if (eerste.datumISO) meta.push(datumKort(ctx, eerste.datumISO));

    return ui.el('section', {
      class: 'u-card k-nodig k-nodig-banner', 'aria-label': T(ctx, 'Wacht op jou')
    }, [
      ui.el('div', { class: 'k-nodig-banner-kop' }, [stip, meer]),
      ui.el('span', { class: 'u-row-title', 'data-no-i18n': '', text: itemTitel(ctx, eerste) }),
      samen([context, meta.join(' · ')]) ? ui.el('span', { class: 'u-row-sub', 'data-no-i18n': '', text: samen([context, meta.join(' · ')]) }) : null,
      ui.el('div', { style: 'margin-top:14px;' }, knop),
      vak
    ]);
  };

  /* DE FASEBALK (advies 22): zes stippen met één label eronder,
     'Fase {n} van {t}: {fase}', en daaronder één zin klantentaal. De stand
     van elke stip staat in data-stand (klaar · nu · komt) én in een
     sr-only-tekst: kleur is nooit de enige drager. De skin (10b) tekent de
     stippen op data-stand; het scherm zet geen maat. */
  var faseBalk = function (ctx, ui, project, stages, v) {
    var faseNaam = faseNaamVan(ctx), faseKort = faseKortVan(ctx), faseUitleg = faseUitlegVan(ctx);
    var cur = v.klaar ? null : huidigeFase(stages);
    var curIdx = cur ? faseIndex(stages, cur) : -1;
    var stippen = stages.map(function (s, i) {
      var stand = (v.klaar || s.status === 'done') ? 'klaar' : (i === curIdx ? 'nu' : 'komt');
      var woord = v.klaar ? T(ctx, 'Afgerond') : faseStand(ctx, s.status).woord;
      return ui.el('li', { class: 'k-fasebalk-stip', 'data-stand': stand, title: faseNaam(s.stageKey) }, [
        ui.el('span', { class: 'sr-only', 'data-no-i18n': '', text: faseNaam(s.stageKey) + ': ' + woord })
      ]);
    });
    var label = '';
    if (v.klaar) label = TPL(ctx, 'Alle {t} fases zijn afgerond.', { t: stages.length });
    else if (cur) label = TPL(ctx, 'Fase {n} van {t}: {fase}', { n: getal(cur.position, curIdx + 1), t: stages.length, fase: faseKort(cur.stageKey) });
    var uitleg = cur ? faseUitleg(cur.stageKey) : '';
    return ui.el('div', { class: 'k-fasebalk-vak' }, [
      ui.el('ol', {
        class: 'k-fasebalk', 'aria-label': TPL(ctx, 'Fasepad van {product}', { product: tekst(project.name) })
      }, stippen),
      label ? ui.el('p', { class: 'k-fasebalk-label u-row-title', 'data-no-i18n': '', text: label }) : null,
      uitleg ? ui.el('p', { class: 'k-fasebalk-uitleg u-sub', text: uitleg }) : null
    ]);
  };

  /* DE HELD (advies 21, 33): de nieuwste productfoto als brede kaart
     bovenaan de productpagina, met linksonder de status: de korte fasenaam,
     'Fase {n} van {t}' en de verwachte datum. Geen foto → geen held en
     geen plaatshouder; dan staat alleen de kop. */
  var heldBlok = function (ctx, ui, project, b, stages, v, stand) {
    var foto = nieuwsteFoto(lijst(b.media), tekst(project.id));
    if (!foto) return null;
    var faseKort = faseKortVan(ctx);
    var klaar = !!v.klaar || tekst(project.status) === 'archived';
    var cur = klaar ? null : huidigeFase(stages);
    var beeld = beeldVak(ctx, ui, foto, 'k-held-foto', TPL(ctx, 'Foto van {product}', { product: tekst(project.name) }));
    /* het lege slot krijgt de plaatshouderklassen; de maat van slot en
       foto tekent de skin (10a) */
    var slot = beeld.querySelector('span.k-held-foto');
    if (slot) slot.className = 'u-thumb ph k-held-foto';
    var fase = klaar ? stand.woord : (cur ? faseKort(cur.stageKey) : stand.woord);
    var tel = '';
    if (klaar) tel = TPL(ctx, 'Alle {t} fases zijn afgerond.', { t: stages.length });
    else if (cur) tel = TPL(ctx, 'Fase {n} van {t}', { n: getal(cur.position, faseIndex(stages, cur) + 1), t: stages.length });
    return ui.el('div', { class: 'u-card k-held', 'data-no-i18n': '' }, [
      beeld,
      ui.el('div', { class: 'k-held-status' }, [
        ui.el('span', { class: 'k-held-fase u-row-title', text: fase }),
        tel ? ui.el('span', { class: 'k-held-tel u-sub', text: tel }) : null,
        verwachtRegel(ctx, ui, b, klaar)
      ])
    ]);
  };

  /* ============================================================
     8. SCHERM — OVERZICHT

     Begroeting met stand · de banner "Wacht op jou" met de eerste actie en
     de rest van de lijst eronder (max. vijf, met de knoppen) ·
     voortgangsring per product · belangrijke datums · de laatste update.
     Rail: je contactpersoon (met een vraagveld) en de volgende verwachte
     betaling.
     ============================================================ */

  var mediaVanSample = function (bron, smp) {
    var uit = null;
    lijst(opt(bron).media).forEach(function (m) {
      if (!uit && m && m.id === opt(smp).mediaId && !m._concept) uit = m;
    });
    return uit;
  };

  /* welk paneel (of welke route) een item opent — één plek voor alle drie
     de schermen, zodat een akkoord vanaf Overzicht en vanaf het fasepad
     hetzelfde paneel is */
  var openItemActie = function (ctx, it, project, bron, vak, knop) {
    var kind = tekst(it.kind);
    /* Betalingen kiest een factuur op ?item= (of ?anker=); naar ?factuur=
       heeft dat scherm nooit gekeken */
    if (kind === 'factuur') { navigeer(ctx, { area: 'betalingen', params: { item: tekst(it.id) } }); return; }
    if (kind === 'vraag') { navigeer(ctx, { area: 'berichten', params: { item: tekst(it.id) } }); return; }
    if (!vak) return;
    var zetOpen = function (aan) { if (knop) knop.setAttribute('aria-expanded', aan ? 'true' : 'false'); };
    if (vak.isOpen()) { vak.sluit(); zetOpen(false); return; }
    var sluit = function () { vak.sluit(); zetOpen(false); };
    var node = null;
    if (kind === 'akkoord') {
      node = paneelAkkoord(ctx, { stage: it.raw, project: project || {}, invoices: perProject(bron, it.projectId, 'invoices'), onSluit: sluit });
    } else if (kind === 'sample') {
      node = paneelSample(ctx, { sample: it.raw, media: mediaVanSample(bron, it.raw), onSluit: sluit });
    } else if (kind === 'bestand') {
      node = paneelBestand(ctx, { slot: it.raw, onSluit: sluit });
    } else if (kind === 'herbestel') {
      node = paneelHerbestel(ctx, { project: project || it.raw, onSluit: sluit });
    }
    if (!node) return;
    vak.openMet(node, knop);
    zetOpen(true);
  };

  /* de rij van "Wat we van jou nodig hebben": tegel, soort · product,
     titel, reden, meta — en RECHTS de ene primaire knop. Het paneel klapt
     eronder open (het inline-slot van CP_UI.taskCard). */
  var nodigKaart = function (ctx, ui, it, bron, projectOp) {
    var project = it.projectId ? (projectOp[it.projectId] || null) : null;
    var vak = paneelVak(ui);
    var knopHouder = { el: null };
    var meta = [];
    if (tekst(it.detail)) meta.push(ui.el('span', { 'data-no-i18n': '', text: afkorten(it.detail, 110) }));
    if (typeof it.cents === 'number' && it.cents > 0) meta.push(ui.el('span', { class: 'u-bedrag', 'data-no-i18n': '', text: bedragTekst(ctx, it.cents, it.valuta) }));
    if (it.datumISO) meta.push(ui.el('span', { 'data-no-i18n': '', text: datumTekst(ctx, it.datumISO) }));

    var kaartEl = ui.taskCard({
      beeld: ui.iconTile({ icoon: SOORT_ICOON[it.kind] || 'inbox', toon: it.urgent ? 'kritiek' : 'wacht', maat: 40 }),
      chip: it.urgent ? { label: it.datumISO ? T(ctx, 'Vervaldatum verstreken') : T(ctx, 'Wacht al langer dan een week'), toon: 'kritiek' } : null,
      titel: itemTitel(ctx, it),
      context: samen([soortLabel(ctx, it.kind), project ? tekst(project.name) : tekst(opt(it.vars).product)]),
      why: itemSub(ctx, it),
      meta: meta,
      urgent: it.urgent ? 'warn' : '',
      primair: {
        label: itemKnop(ctx, it),
        onClick: function () { openItemActie(ctx, it, project, bron, vak, knopHouder.el); }
      },
      inline: vak
    });
    knopHouder.el = kaartEl.querySelector('.u-task-acts button');
    if (knopHouder.el && (it.kind === 'akkoord' || it.kind === 'sample' || it.kind === 'bestand' || it.kind === 'herbestel')) {
      knopHouder.el.setAttribute('aria-expanded', 'false');
    }
    /* de contextregel draagt een productnaam en de titel een fasenaam:
       allebei al vertaald of data — de vertaalpas hoeft er niet meer aan */
    var ctxEl = kaartEl.querySelector('.u-task-ctx');
    if (ctxEl) ctxEl.setAttribute('data-no-i18n', '');
    return kaartEl;
  };

  /* de voortgangsring van één product (spec 4.1, variant 56px) */
  var productRing = function (ctx, chart, project) {
    var p = PM(ctx);
    if (!chart || !fn(chart.ring) || !p || !fn(p.voortgang)) return null;
    var v = p.voortgang(project);
    if (!v.totaal) return null;
    var naam = tekst(project.name);
    return chart.ring({
      waarde: v.afgerond, max: v.totaal, maat: 56, percentage: true,
      toon: 'ink', spoor: 'ink-4',
      label: TPL(ctx, 'Voortgang van {product}', { product: naam }),
      beschrijving: TPL(ctx, 'Voortgang van {product}: {n} van {t} fases afgerond, {p} procent', { product: naam, n: v.afgerond, t: v.totaal, p: v.pct })
    });
  };

  /* de kaart "Belangrijke datums": kalender plus de gedateerde lijst
     eronder (standaard de eerstvolgende drie, na een klik in de kalender
     die ene dag — de keuze staat in de route als ?dag=) */
  var datumsBlok = function (ctx, ui, chart, bron, area, extraParams) {
    var vandaag = vandaagVan(ctx);
    var agenda = belangrijkeDatums(ctx, bron);
    var gekozenDag = paramVan(ctx, 'dag');
    var basis = opt(extraParams);
    var metDag = function (dag) {
      var params = {}, k;
      for (k in basis) if (Object.prototype.hasOwnProperty.call(basis, k)) params[k] = basis[k];
      if (dag) params.dag = dag;
      return params;
    };

    var kalender = (chart && fn(chart.miniCalendar)) ? chart.miniCalendar({
      vandaag: vandaag,
      gekozen: gekozenDag || null,
      gebeurtenissen: agenda.map(function (r) { return { iso: r.iso, toon: r.toon }; }),
      onKies: function (iso) {
        deelNavigatie(ctx, { area: area, params: metDag(iso) }, TPL(ctx, 'Datums op {datum}', { datum: datumTekst(ctx, iso) }));
      }
    }) : null;

    var getoond = [];
    if (gekozenDag) {
      agenda.forEach(function (r) { if (r.iso === gekozenDag) getoond.push(r); });
    } else {
      agenda.forEach(function (r) { if (getoond.length < 3 && r.iso >= vandaag) getoond.push(r); });
      if (!getoond.length) getoond = agenda.slice(Math.max(0, agenda.length - 3));
    }
    var rijen = getoond.map(function (r) {
      return datumRij(ctx, ui, {
        iso: r.iso, titel: r.titel, sub: r.sub, toon: r.toon, toonWoord: r.toonWoord,
        onOpen: r.projectId ? function () { navigeer(ctx, { area: 'producten', id: r.projectId, tab: 'voortgang' }); } : null
      });
    });

    return kaart(ui, [
      ui.sectionHead({
        titel: gekozenDag ? datumTekst(ctx, gekozenDag) : T(ctx, 'Belangrijke datums'),
        actie: gekozenDag ? {
          label: T(ctx, 'Toon weer de eerstvolgende'), ico: 'terug',
          onClick: function () { deelNavigatie(ctx, { area: area, params: metDag(null) }, T(ctx, 'Belangrijke datums')); }
        } : null
      }),
      kalender,
      ui.el('p', { class: 'u-sub', style: 'margin:12px 0 0;', text: agenda.length
        ? T(ctx, 'Een stip markeert een dag met een verwachte levering, een samplekeuze, een vervaldatum of een beloofde einddatum.')
        : T(ctx, 'Er staan nog geen datums voor je gepland.') }),
      rijen.length ? ui.el('div', { class: 'u-rows', style: 'margin-top:14px;' }, rijen) : (gekozenDag ? ui.emptyTile({
        icoon: 'kalender', titel: T(ctx, 'Op deze dag staat niets')
      }) : null)
    ]);
  };

  /* de kaart "Laatste update": de nieuwste foto die de klant ziet, met
     onderschrift en herkomst — dezelfde bron als de cockpitkaart */
  var laatsteUpdateBlok = function (ctx, ui, bron, projectOp) {
    var m = nieuwsteFoto(lijst(bron.media), null);
    if (!m) {
      return kaart(ui, [
        ui.sectionHead({ titel: T(ctx, 'Laatste update') }),
        ui.emptyTile({ icoon: 'camera', titel: T(ctx, 'Nog geen updates.'), uitleg: T(ctx, 'Zodra er iets te zien is, staat het hier.') })
      ]);
    }
    var project = projectOp[m.projectId] || null;
    /* onder een foto alleen de datum (advies 3): de fase en de fabriek
       staan op de productpagina onder Details */
    var rij = ui.entityRow({
      thumb: beeldVak(ctx, ui, m, 'u-thumb', ''),
      titel: tekst(m.caption) || T(ctx, 'Foto zonder omschrijving'),
      sub: samen([project ? tekst(project.name) : '', datumKort(ctx, m.capturedAt)]),
      meta: '',
      onOpen: project ? function () { navigeer(ctx, { area: 'producten', id: project.id, tab: 'bestanden' }); } : null
    });
    rij.setAttribute('data-no-i18n', '');
    return sectie(ui, ui.sectionHead({ titel: T(ctx, 'Laatste update') }), [
      ui.el('div', { class: 'u-card u-rows' }, rij)
    ]);
  };

  S.overzicht = function (ctx) {
    var ui = UI(ctx);
    if (!ui) return noodElement('Overzicht');
    var b = bundelVan(ctx);
    return Promise.all([
      haal(ctx, 'listReorders', [], []),
      haal(ctx, 'mijnContact', [isObj(b.project) ? b.project : null], null)
    ]).then(function (res) {
      return tekenOverzicht(ctx, ui, lijst(res[0]), res[1]);
    });
  };

  var tekenOverzicht = function (ctx, ui, reorders, contact) {
    var chart = CH(ctx);
    var p = PM(ctx);
    var b = bundelVan(ctx);
    var bron = klantBron(ctx, { reorderRequests: reorders });
    var projecten = projectenVan(ctx);
    var projectOp = indexOp(projecten, 'id');
    var items = nodigItems(ctx, bron);
    var werk = items.filter(function (it) { return it && it.kind !== 'herbestel'; });

    /* ---------- kop en begroeting (advies 31) ----------
       Eén product: de volle zin uit het contract met product en fase; meer
       producten: 'Hoi {naam}.' plus de telling. De h1 is de paginanaam —
       twee begroetingen boven elkaar ("Goedemorgen" én "Hoi") is er één te
       veel. Zonder bekende naam blijft de telling als chip in de kop. */
    var klant = klantVan(ctx);
    var enkel = projecten.length === 1 && isObj(b.project);
    var groet = enkel
      ? begroetingRegel(ctx, ui, begroetingDelen(ctx, b, werk.length))
      : begroetingRegel(ctx, ui, { naam: tekst(klant.voornaam) || tekst(klant.naam), product: '', fase: '', nodig: werk.length });
    var vraagVeldHouder = { el: null };
    var kop = ui.pageHeader({
      titel: T(ctx, 'Overzicht'),
      badge: (!groet && werk.length) ? ui.statusChip({
        label: werk.length === 1 ? T(ctx, '1 ding wacht op jou') : TPL(ctx, '{n} dingen wachten op jou', { n: werk.length }),
        toon: 'wacht'
      }) : null,
      actiePlaats: 'rechts',
      primair: isObj(b.project) ? {
        label: T(ctx, 'Stel een vraag'),
        onClick: function () {
          var v = vraagVeldHouder.el;
          if (v && fn(v.focus)) { v.focus(); if (fn(v.scrollIntoView)) v.scrollIntoView({ block: 'center' }); }
        }
      } : null
    });
    if (fn(ctx.zetKop)) ctx.zetKop(kop);

    /* ---------- Wacht op jou (advies 11) ----------
       De banner met de eerste actie als eerste sectie; de andere acties
       als de bekende kaarten eronder, waar 'en nog {n}' naartoe springt.
       Niets open: één regel, geen kaart. */
    var bannerItem = null;
    items.forEach(function (it) { if (!bannerItem && it && it.kind !== 'herbestel') bannerItem = it; });
    if (!bannerItem && items.length) bannerItem = items[0];
    var rest = items.filter(function (it) { return it && it !== bannerItem; });
    var restLijst = rest.length ? ui.entityList(rest.map(function (it) { return nodigKaart(ctx, ui, it, bron, projectOp); })) : null;
    if (restLijst) restLijst.setAttribute('tabindex', '-1');
    var banner = nodigBanner(ctx, ui, items, bron, projectOp, {
      toonProduct: projecten.length > 1,
      meerDoel: function () { return restLijst; }
    });
    var nodig = sectie(ui, null, [banner, restLijst ? ruimte(ui, 16) : null, restLijst], 'k-nodig');

    /* ---------- voortgang per product ---------- */
    var rijen = projecten.map(function (project) {
      var stand = productStand(ctx, project);
      var stap = volgendeStap(ctx, bron, project);
      var ring = productRing(ctx, chart, project);
      var rij = ui.entityRow({
        thumb: ring ? ui.el('span', { class: 'u-thumb', style: 'background:transparent;border:0;display:inline-flex;align-items:center;justify-content:center;' }, ring) : null,
        titel: tekst(project.name),
        sub: samen([stand.fase ? faseNaamVan(ctx)(stand.fase.stageKey) : stand.woord, tekst(project.code)]),
        volgendeActie: stap.tekst,
        chips: [ui.statusDot({ toon: stand.toon, label: stand.woord })],
        onOpen: function () { navigeer(ctx, { area: 'producten', id: project.id, tab: 'voortgang' }); }
      });
      rij.setAttribute('data-no-i18n', '');
      return rij;
    });
    var voortgangBlok = sectie(ui, ui.sectionHead({
      titel: T(ctx, 'Je producten'),
      actie: { label: T(ctx, 'Naar mijn producten'), ico: 'chevron', onClick: function () { navigeer(ctx, { area: 'producten' }); } }
    }), [
      ui.entityList(rijen, {
        leegTitel: T(ctx, 'Nog geen producten'),
        leegUitleg: T(ctx, 'Vertel Steffan kort wat je wilt maken — hij denkt mee vanaf de eerste schets.')
      })
    ]);

    /* ---------- belangrijke datums en laatste update ---------- */
    var datums = sectie(ui, null, [datumsBlok(ctx, ui, chart, bron, 'overzicht', {})]);
    var update = laatsteUpdateBlok(ctx, ui, bron, projectOp);

    /* ---------- rail: contactpersoon + vraagveld ---------- */
    var vraag = null;
    if (isObj(b.project) && actie(ctx, 'vraagStellen')) {
      var doeVraag = actie(ctx, 'vraagStellen');
      vraag = berichtVak(ctx, {
        label: T(ctx, 'Stel een vraag'),
        placeholder: TPL(ctx, 'Over {product}…', { product: tekst(b.project.name) }),
        knop: T(ctx, 'Verstuur'),
        klaar: 'Je vraag is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.',
        vraag: { product: tekst(b.project.id), tekst: TPL(ctx, 'Over {product}: ', { product: tekst(b.project.name) }) },
        doe: function (body) { return doeVraag(b.project, body); }
      });
      vraagVeldHouder.el = vraag.veld;
    }
    var contactKaart = kaart(ui, [
      ui.sectionHead({ titel: T(ctx, 'Je contactpersoon') }),
      contactBlok(ctx, ui, contact),
      vraag ? ruimte(ui, 14) : null,
      vraag
    ]);

    /* ---------- rail: volgende verwachte betaling ---------- */
    var vb = (p && fn(p.volgendeBetaling)) ? p.volgendeBetaling(lijst(bron.invoices), nuVan(ctx)) : null;
    var betaalKaart;
    if (vb) {
      var vbProject = projectOp[vb.factuur.projectId] || null;
      betaalKaart = kaart(ui, [
        ui.sectionHead({ titel: T(ctx, 'Volgende verwachte betaling') }),
        ui.el('div', { class: 'u-groot u-bedrag', 'data-no-i18n': '', text: bedragTekst(ctx, vb.openCents, vb.valuta) }),
        ui.el('p', { class: 'u-sub', style: 'margin:6px 0 0;', text: vb.vervaltISO
          ? (vb.verstreken ? TPL(ctx, 'De vervaldatum van {datum} is verstreken.', { datum: datumTekst(ctx, vb.vervaltISO) })
            : TPL(ctx, 'Vervalt op {datum}.', { datum: datumTekst(ctx, vb.vervaltISO) }))
          : T(ctx, 'Zonder vervaldatum.') }),
        dataRegel(ui, 'u-sub', samen([tekst(vb.factuur.invoiceNumber || vb.factuur.label), vbProject ? tekst(vbProject.name) : '']), { style: 'margin:4px 0 0;' }),
        ui.el('div', { style: 'margin-top:14px;' }, ui.el('button', {
          type: 'button', class: 'u-btn klein', text: T(ctx, 'Naar Betalingen'),
          /* ?item= is de parameter waarop Betalingen de factuur kiest */
          onclick: function () { navigeer(ctx, { area: 'betalingen', params: { item: tekst(vb.factuur.id) } }); }
        }))
      ], 'k-betalingen');
    } else {
      /* lege staat in één regel (advies 9) */
      betaalKaart = kaart(ui, [
        ui.sectionHead({ titel: T(ctx, 'Volgende verwachte betaling') }),
        ui.emptyTile({ icoon: 'financien', titel: T(ctx, 'Er staat geen factuur voor je open.') })
      ]);
    }

    var hoofd = ui.el('div', { class: 'u-cols-main' }, [kop, groet, nodig, voortgangBlok, datums, update]);
    var rail = ui.el('div', { class: 'u-cols-side' }, [stapel(ui, [contactKaart, betaalKaart], 20)]);
    return ui.el('div', { class: 'u-cols' }, [hoofd, rail]);
  };

  /* ============================================================
     9. SCHERM — PRODUCTEN

     Eén projectkaart per product (beeld, naam, fase, stepper met korte
     labels, volgende stap) — ruimer dan in het beheer, want een klant
     heeft er weinig (portaal-skin.css hoofdstuk 4). Een afgerond product
     krijgt de knop "Opnieuw bestellen"; loopt er al een herbestelling, dan
     staat de pijplijnstand op die plek. Actieve producten bovenaan, de
     Archiefplank eronder, en als laatste de uitnodiging voor een volgend
     product — precies de indeling van het oude "Mijn Producten".
     ============================================================ */

  /* de pijplijnstand van een lopende herbestelling (CP_PORTAAL.reorderStand
     spiegelt de vier stappen van het beheer) */
  /* de inhoud zonder kaart eromheen, zodat de rail hem in zijn ene
     actiekaart kan zetten (advies 24: hoogstens twee kaarten) */
  var pijplijnInhoud = function (ctx, ui, chart, request) {
    var p = PM(ctx);
    var st = (p && fn(p.reorderStand)) ? p.reorderStand(request) : null;
    if (!st) return null;
    var stepper = (chart && fn(chart.stepper)) ? chart.stepper({
      huidigIndex: st.index,
      stappen: st.stappen.map(function (s) {
        return {
          sleutel: tekst(s.key), label: T(ctx, tekst(s.label)),
          status: s.state === 'done' ? 'gereed' : (s.state === 'current' ? 'huidig' : 'toekomst')
        };
      })
    }) : null;
    var details = [];
    if (getal(request.qty, 0) > 0) details.push(TPL(ctx, '{n} stuks', { n: getal(request.qty, 0) }));
    if (request.wantedBy) details.push(TPL(ctx, 'gewenst op {datum}', { datum: datumKort(ctx, request.wantedBy) }));
    details.push(request.sameSpec ? T(ctx, 'zelfde specificatie') : T(ctx, 'met een wijziging'));
    if (request.createdAt) details.push(TPL(ctx, 'aangevraagd op {datum}', { datum: datumKort(ctx, request.createdAt) }));
    return [
      ui.sectionHead({
        kicker: T(ctx, 'Herbestelling loopt'),
        titel: TPL(ctx, 'Stap {n} van {t}: {stap}', { n: st.stap, t: st.totaal, stap: T(ctx, tekst(st.label)) })
      }),
      stepper,
      ui.el('p', { class: 'u-sub', style: 'margin:12px 0 0;', 'data-no-i18n': '', text: details.join(' · ') }),
      (!request.sameSpec && tekst(request.changeNote)) ? dataRegel(ui, 'u-lees', tekst(request.changeNote), { style: 'margin:8px 0 0;' }) : null
    ];
  };
  var pijplijnBlok = function (ctx, ui, chart, request) {
    var inhoud = pijplijnInhoud(ctx, ui, chart, request);
    return inhoud ? kaart(ui, inhoud) : null;
  };

  /* welke herbestelling van dit product nog loopt (niet op de laatste stap) */
  var lopendeHerbestelling = function (ctx, reorders, projectId) {
    var p = PM(ctx);
    var uit = null;
    lijst(reorders).forEach(function (r) {
      if (uit || !r || r.projectId !== projectId) return;
      var st = (p && fn(p.reorderStand)) ? p.reorderStand(r) : { klaar: false };
      if (!st.klaar) uit = r;
    });
    return uit;
  };

  var productKaart = function (ctx, ui, chart, project, bron, reorders) {
    var p = PM(ctx);
    var faseNaam = faseNaamVan(ctx);
    var faseKort = faseKortVan(ctx);
    var stages = fasesVan(project);
    var v = (p && fn(p.voortgang)) ? p.voortgang(project) : { klaar: false, totaal: stages.length, afgerond: 0 };
    var cur = huidigeFase(stages);
    var actiefIdx = cur ? faseIndex(stages, cur) : -1;
    var stand = productStand(ctx, project);
    var klaar = !!v.klaar || tekst(project.status) === 'archived';
    var pid = tekst(project.id);

    var foto = nieuwsteFoto(lijst(bron.media), pid);
    var beeld = foto
      ? beeldVak(ctx, ui, foto, 'u-projectcard-beeld', '')
      : ui.el('span', { class: 'u-projectcard-beeld', 'aria-hidden': 'true' });

    var stepper = (chart && fn(chart.stepper) && stages.length) ? chart.stepper({
      huidigIndex: actiefIdx,
      stappen: stages.map(function (s) {
        return {
          sleutel: tekst(s.stageKey),
          label: faseNaam(s.stageKey),
          kort: faseKort(s.stageKey),
          status: s.status === 'done' ? 'gereed'
            : (s.status === 'current' || s.status === 'awaiting_approval') ? 'huidig' : 'toekomst'
        };
      })
    }) : null;

    var volgende;
    if (klaar) {
      volgende = T(ctx, 'Het volledige dossier en de zendinggeschiedenis blijven permanent toegankelijk.');
    } else {
      volgende = volgendeStap(ctx, bron, project).tekst;
    }

    /* de zendingsregel van een afgerond product — uit het oude productCard */
    var zendingen = perProject(bron, pid, 'shipments');
    var geleverd = zendingen.filter(function (s) { return !!s.deliveredAt; }).sort(function (a, c) {
      return tekst(c.deliveredAt) < tekst(a.deliveredAt) ? -1 : 1;
    });
    var zendRegel = (klaar && zendingen.length)
      ? (zendingen.length === 1 ? T(ctx, '1 zending') : TPL(ctx, '{n} zendingen', { n: zendingen.length }))
        + (geleverd[0] ? TPL(ctx, ' · laatst geleverd {d}', { d: datumKort(ctx, geleverd[0].deliveredAt) }) : '')
      : '';

    var ring = productRing(ctx, chart, project);
    var kickerDelen = [tekst(project.code)];
    if (klaar) kickerDelen.push(T(ctx, 'AFGEROND'));
    else if (cur && stages.length) kickerDelen.push(TPL(ctx, 'FASE {n} VAN {t}', { n: getal(cur.position, actiefIdx + 1), t: stages.length }));

    var knop = ui.el('button', {
      type: 'button', class: 'u-projectcard', style: 'text-align:left;width:100%;',
      'aria-label': TPL(ctx, 'Open het dossier van {x}', { x: tekst(project.name) }),
      onclick: function () { navigeer(ctx, { area: 'producten', id: project.id, tab: 'voortgang' }); }
    }, [
      beeld,
      ui.el('span', { class: 'u-projectcard-body' }, [
        ui.el('span', { class: 'u-projectcard-kop' }, [
          ui.el('span', { style: 'display:flex;flex-direction:column;align-items:flex-start;gap:5px;min-width:0;' }, [
            ui.el('span', { class: 'u-kicker', text: samen(kickerDelen) }),
            ui.el('span', { class: 'u-projectcard-titel', text: tekst(project.name) }),
            ui.el('span', { class: 'u-projectcard-sub', text: stand.fase ? faseNaam(stand.fase.stageKey) : stand.woord }),
            ui.statusDot({ toon: stand.toon, label: stand.woord })
          ])
        ]),
        stepper ? ui.el('span', { class: 'u-projectcard-stepper' }, stepper) : null,
        ui.el('span', { class: 'u-projectcard-next', text: '→ ' + volgende }),
        zendRegel ? ui.el('span', { class: 'u-sub', style: 'display:block;margin-top:8px;', text: zendRegel }) : null
      ]),
      ring ? ui.el('span', { class: 'u-projectcard-ring' }, ring) : null
    ]);
    knop.setAttribute('data-no-i18n', '');

    /* onder de kaart: de herbestelknop of de pijplijnstand */
    var onder = null;
    if (klaar) {
      var lopend = lopendeHerbestelling(ctx, reorders, pid);
      if (lopend) {
        onder = pijplijnBlok(ctx, ui, chart, lopend);
      } else if (actie(ctx, 'herbestellen') && v.klaar) {
        var vak = paneelVak(ui);
        var hb = ui.el('button', { type: 'button', class: 'u-btn', 'aria-expanded': 'false', text: T(ctx, 'Opnieuw bestellen') });
        hb.addEventListener('click', function () {
          if (vak.isOpen()) { vak.sluit(); hb.setAttribute('aria-expanded', 'false'); return; }
          vak.openMet(paneelHerbestel(ctx, { project: project, onSluit: function () { vak.sluit(); hb.setAttribute('aria-expanded', 'false'); } }), hb);
          hb.setAttribute('aria-expanded', 'true');
        });
        vak.style.padding = '12px 0 0';
        onder = ui.el('div', { style: 'margin-top:12px;' }, [hb, vak]);
      }
    }
    return ui.el('div', null, [knop, onder]);
  };

  /* de vaste laatste kaart: een volgend product begint bij een gesprek */
  var nieuwProductKaart = function (ctx, ui) {
    return kaart(ui, [
      ui.el('span', { class: 'u-kicker', text: T(ctx, 'Volgend product?') }),
      ui.el('h2', { style: 'margin:6px 0 8px;', text: T(ctx, 'Een nieuw product beginnen?') }),
      ui.el('p', { class: 'u-lees', text: T(ctx, 'Vertel Steffan kort wat je wilt maken — hij denkt mee vanaf de eerste schets.') }),
      ui.el('div', { style: 'margin-top:14px;' }, ui.el('a', {
        class: 'u-btn ghost', href: 'custom-plus.html#/contact', target: '_blank', rel: 'noopener noreferrer',
        text: T(ctx, 'Start het gesprek')
      }))
    ]);
  };

  S.producten = function (ctx) {
    var ui = UI(ctx);
    if (!ui) return noodElement('Producten');
    return haal(ctx, 'listReorders', [], []).then(function (reorders) {
      return tekenProducten(ctx, ui, lijst(reorders));
    });
  };

  var tekenProducten = function (ctx, ui, reorders) {
    var chart = CH(ctx);
    var p = PM(ctx);
    var bron = klantBron(ctx, { reorderRequests: reorders });
    var projecten = projectenVan(ctx);
    var actief = [], klaar = [];
    projecten.forEach(function (pr) {
      var v = (p && fn(p.voortgang)) ? p.voortgang(pr) : { klaar: false };
      if (v.klaar || tekst(pr.status) === 'archived') klaar.push(pr); else actief.push(pr);
    });

    var kop = ui.pageHeader({
      titel: T(ctx, 'Producten'),
      badge: projecten.length ? ui.statusChip({
        label: projecten.length === 1 ? T(ctx, '1 product') : TPL(ctx, '{n} producten', { n: projecten.length }),
        toon: 'neutraal'
      }) : null
    });
    if (fn(ctx.zetKop)) ctx.zetKop(kop);

    var actieveLijst = ui.el('div', { class: 'k-productlijst' }, actief.map(function (pr) {
      return productKaart(ctx, ui, chart, pr, bron, reorders);
    }));
    var blokken = [kop];
    if (!projecten.length) {
      blokken.push(ui.emptyState({
        titel: T(ctx, 'Nog geen producten'),
        uitleg: T(ctx, 'Vertel Steffan kort wat je wilt maken — hij denkt mee vanaf de eerste schets.')
      }));
    } else if (actief.length) {
      blokken.push(actieveLijst);
    } else {
      /* lege staat in één regel (advies 9) */
      blokken.push(ui.emptyState({
        titel: T(ctx, 'Er loopt nu geen product'),
        uitleg: T(ctx, 'Je afgeronde producten staan hieronder op de Archiefplank.')
      }));
    }
    if (klaar.length) {
      blokken.push(ruimte(ui, 28));
      blokken.push(ui.el('p', { class: 'u-kicker', style: 'margin-bottom:14px;', text: T(ctx, 'Archiefplank') }));
      blokken.push(ui.el('div', { class: 'k-productlijst' }, klaar.map(function (pr) {
        return productKaart(ctx, ui, chart, pr, bron, reorders);
      })));
    }
    blokken.push(ruimte(ui, 28));
    blokken.push(nieuwProductKaart(ctx, ui));

    var hoofd = ui.el('div', { class: 'u-cols-main' }, blokken);
    var rail = ui.el('div', { class: 'u-cols-side' }, [datumsBlok(ctx, ui, chart, bron, 'producten', {})]);
    return ui.el('div', { class: 'u-cols' }, [hoofd, rail]);
  };

  /* ============================================================
     10. SCHERM — PRODUCTDETAIL

     Kruimelpad · kicker (projectcode) · h1 · statusstip + fase · zes tabs
     (Voortgang, Bestanden & foto's, Betalingen, Gesprek, Details, Tijdlijn).
     Rail: de volgende stap met zijn knop, kerngegevens, de productfoto en
     het takje uit spec 4.20.
     ============================================================ */

  var PRODUCT_TABS = [
    { key: 'voortgang', label: 'Voortgang' },
    { key: 'bestanden', label: 'Bestanden & foto’s' },
    { key: 'betalingen', label: 'Betalingen' },
    { key: 'gesprek', label: 'Gesprek' },
    { key: 'details', label: 'Details' },
    /* als laatste, bewust: de tijdlijn is naslag, geen werk. Het losse
       scherm Activiteit verdwijnt uit de zijbalk; wat er rond een product
       gebeurde staat voortaan hier, per product. */
    { key: 'tijdlijn', label: 'Tijdlijn' }
  ];
  var tabLabel = function (ctx, key) {
    for (var i = 0; i < PRODUCT_TABS.length; i++) if (PRODUCT_TABS[i].key === key) return T(ctx, PRODUCT_TABS[i].label);
    return T(ctx, 'Voortgang');
  };

  var nietGevonden = function (ctx, ui) {
    var kop = ui.pageHeader({
      crumbs: [
        { label: T(ctx, 'Producten'), onKies: function () { navigeer(ctx, { area: 'producten' }); } },
        { label: T(ctx, 'Onbekend product') }
      ],
      titel: T(ctx, 'Dit product kon niet worden gevonden.')
    });
    if (fn(ctx.zetKop)) ctx.zetKop(kop);
    return ui.el('div', null, [
      kop,
      ui.emptyState({
        titel: T(ctx, 'Dit product kon niet worden gevonden.'),
        uitleg: T(ctx, 'Het hoort niet bij jouw account, of het bestaat niet meer.'),
        actie: { label: T(ctx, 'Naar mijn producten'), onClick: function () { navigeer(ctx, { area: 'producten' }); } }
      })
    ]);
  };

  S.product = function (ctx) {
    var ui = UI(ctx);
    if (!ui) return noodElement('Product');
    var route = routeVan(ctx);
    var b = bundelVan(ctx);
    var project = (isObj(b.project) && tekst(b.project.id) === tekst(route.id)) ? b.project : null;
    if (!project) return nietGevonden(ctx, ui);

    var tab = tabVan(ctx, 'voortgang');
    var bekend = false;
    PRODUCT_TABS.forEach(function (t) { if (t.key === tab) bekend = true; });
    if (!bekend) tab = 'voortgang';

    /* wat deze tab nog moet ophalen — alleen dat, en nooit blokkerend op
       een fout: een lege lijst is de eerlijke stand */
    var laad = [haal(ctx, 'listReorders', [project], [])];
    if (tab === 'gesprek') {
      var vragen = lijst(b.questions).filter(function (q) { return q && q.projectId === project.id; });
      laad.push(Promise.all(vragen.map(function (q) {
        return haal(ctx, 'listMessages', [q], []).then(function (rijen) { return { vraag: q, berichten: lijst(rijen) }; });
      })));
    } else {
      laad.push(Promise.resolve([]));
    }
    laad.push(tab === 'details' ? haal(ctx, 'mijnContact', [project], null) : Promise.resolve(null));
    laad.push(tab === 'betalingen' ? betalingsmeldingen(ctx, b) : Promise.resolve({}));

    return Promise.all(laad).then(function (res) {
      return tekenProduct(ctx, ui, project, tab, { reorders: lijst(res[0]), draden: lijst(res[1]), contact: res[2], meldingen: opt(res[3]) });
    });
  };

  var tekenProduct = function (ctx, ui, project, tab, geladen) {
    var chart = CH(ctx);
    var p = PM(ctx);
    var b = bundelVan(ctx);
    var stand = productStand(ctx, project);
    var naam = tekst(project.name);
    var stages = fasesVan(project, b.stages);
    var v = (p && fn(p.voortgang)) ? p.voortgang(project, stages)
      : { klaar: false, totaal: stages.length, afgerond: 0, huidigeFase: huidigeFase(stages) };

    /* de open acties van dít product, één keer geteld voor de begroeting,
       de banner en de rail */
    var bron = klantBron(ctx, { reorderRequests: lijst(geladen.reorders) });
    var mini = miniBundel(bron, project);
    if (!mini.stages.length) mini.stages = stages;
    var items = nodigItems(ctx, mini);
    var werk = items.filter(function (it) { return it && it.kind !== 'herbestel'; });
    var projectOp = indexOp(projectenVan(ctx), 'id');

    if (fn(ctx.zetKruimels)) {
      ctx.zetKruimels([{ label: T(ctx, 'Producten'), route: { area: 'producten' } }, { label: naam }]);
    }
    /* de kop draagt alleen het standwoord; de fasenaam staat in de
       begroeting, de held en de fasebalk — niet nog eens hier (advies 7) */
    var kop = ui.pageHeader({
      crumbs: [
        { label: T(ctx, 'Producten'), onKies: function () { navigeer(ctx, { area: 'producten' }); } },
        { label: naam }
      ],
      kicker: tekst(project.code),
      titel: naam,
      status: { toon: stand.toon, label: stand.woord }
    });
    if (kop.titelEl) kop.titelEl.setAttribute('data-no-i18n', '');
    if (fn(ctx.zetKop)) ctx.zetKop(kop);

    var groet = begroetingRegel(ctx, ui, begroetingDelen(ctx, b, werk.length));
    var held = heldBlok(ctx, ui, project, b, stages, v, stand);
    var railHouder = { el: null };
    var banner = nodigBanner(ctx, ui, items, bron, projectOp, {
      meerDoel: function () { return railHouder.el; }
    });

    var tabBalk = ui.tabs({
      tabs: PRODUCT_TABS.map(function (t) { return { key: t.key, label: T(ctx, t.label), panelId: 'k-producttab' }; }),
      actief: tab,
      label: T(ctx, 'Onderdelen van dit product'),
      onKies: function (key, t) {
        deelNavigatie(ctx, { area: 'producten', id: project.id, tab: key }, tekst(t && t.label));
      }
    });

    var inhoud;
    if (tab === 'bestanden') inhoud = tabBestanden(ctx, ui, chart, project, b);
    else if (tab === 'betalingen') inhoud = tabBetalingen(ctx, ui, project, b, geladen.meldingen);
    else if (tab === 'gesprek') inhoud = tabGesprek(ctx, ui, project, b, geladen.draden);
    else if (tab === 'details') inhoud = tabDetails(ctx, ui, project, b, geladen.contact);
    else if (tab === 'tijdlijn') inhoud = tabTijdlijn(ctx, ui, project);
    else inhoud = tabVoortgang(ctx, ui, chart, project, b, { heeftHeld: !!held });

    var paneel = ui.el('div', {
      id: 'k-producttab', role: 'region', tabindex: '-1',
      'aria-labelledby': 'k-producttab-tab',
      style: 'margin-top:24px;'
    }, inhoud);

    var rail = productRail(ctx, ui, chart, project, b, geladen.reorders, bron, items);
    railHouder.el = rail.querySelector('.k-rail-nodig');
    /* volgorde (advies 11, 21, 31): kop, begroeting, held, banner, tabs —
       op een telefoon is de banner zo het eerste werk dat je ziet */
    var hoofd = ui.el('div', { class: 'u-cols-main' }, [kop, groet, held, banner, tabBalk, paneel]);
    var wortel = ui.el('div', { class: 'u-cols' }, [hoofd, rail]);
    /* de zwevende vraagknop (advies 15) hoort bij het scherm en niet bij
       de shell: hij verdwijnt vanzelf bij navigeren */
    var zwevend = vraagZwevend(ctx, ui, wortel, project, b, tab);
    if (zwevend) wortel.appendChild(zwevend);
    return wortel;
  };

  /* ============================================================
     10b. DE ZWEVENDE VRAAGKNOP (advies 15)

     Op elke tab van de productpagina staat rechtsonder één vaste knop
     'Vraag' die het vraagvak van tab Gesprek opent met de eerste woorden
     al ingevuld. Welke woorden, dat beslist het scherm op het moment van
     de klik, in deze volgorde:
       1. een open actiepaneel dat zijn context draagt (data-vraag-context:
          het akkoordpaneel 'Over {fase}: ', het samplepaneel 'Over sample
          {x}: ');
       2. tab Voortgang → 'Over {fase}: ' met de lopende fase;
       3. tab Betalingen met een factuur in de route (?item=) → 'Over
          factuur {nummer}: ';
       4. anders 'Over {product}: '.
     Staat het vraagvak al op het scherm (tab Gesprek), dan krijgt het de
     woorden en de focus meteen; anders gaat de route naar tab Gesprek met
     ?tekst=, waar tabGesprek ze inleest. Zonder de actie vraagStellen in
     het contract komt er geen knop: een knop die niets kan is erger dan
     geen knop. Alleen position:fixed en de plek staan hier inline; de vorm
     tekent de skin (css-wensen-werk3c.css).
     ============================================================ */
  var VRAAG_CONTEXT = 'data-vraag-context';
  var isVerborgen = function (n) {
    var x = n;
    while (x && x.nodeType === 1) {
      if (x.hidden) return true;
      x = x.parentNode;
    }
    return false;
  };
  var vraagContextVan = function (ctx, wortel, project, b, tab) {
    var uit = '';
    var open = (wortel && fn(wortel.querySelectorAll)) ? wortel.querySelectorAll('[' + VRAAG_CONTEXT + ']') : [];
    Array.prototype.forEach.call(open, function (n) {
      if (!uit && !isVerborgen(n)) uit = tekst(n.getAttribute(VRAAG_CONTEXT));
    });
    if (uit) return uit;
    if (tab === 'voortgang') {
      var p = PM(ctx);
      var stages = fasesVan(project, b.stages);
      var v = (p && fn(p.voortgang)) ? p.voortgang(project, stages) : { klaar: false };
      var cur = v.klaar ? null : huidigeFase(stages);
      if (cur) return TPL(ctx, 'Over {fase}: ', { fase: faseNaamVan(ctx)(cur.stageKey) });
    }
    if (tab === 'betalingen') {
      var id = paramVan(ctx, 'item');
      var inv = null;
      if (id) {
        lijst(b.invoices).forEach(function (r) {
          if (!inv && isObj(r) && tekst(r.id) === id && tekst(r.projectId) === tekst(project.id)) inv = r;
        });
      }
      if (inv) return overFactuur(ctx, inv);
    }
    return TPL(ctx, 'Over {product}: ', { product: tekst(project.name) });
  };
  var vraagZwevend = function (ctx, ui, wortel, project, b, tab) {
    if (!actie(ctx, 'vraagStellen')) return null;
    var knop = ui.el('button', {
      type: 'button', class: 'u-btn k-vraag-zwevend',
      'aria-label': TPL(ctx, 'Stel een vraag over {product}', { product: tekst(project.name) }),
      text: T(ctx, 'Vraag')
    });
    knop.addEventListener('click', function () {
      var woorden = vraagContextVan(ctx, wortel, project, b, tab);
      var veld = fn(wortel.querySelector) ? wortel.querySelector('textarea.k-vraagvak') : null;
      if (veld) {
        /* wat de klant zelf al typte blijft staan; alleen een leeg veld of
           een eerdere voorinvulling krijgt de nieuwe woorden */
        if (!trim(veld.value) || veld.value === veld.voorvul) { veld.value = woorden; veld.voorvul = woorden; }
        if (fn(veld.scrollIntoView)) veld.scrollIntoView({ block: 'center' });
        try { veld.focus(); } catch (e) { /* stil */ }
        cursorAanEind(veld);
        return;
      }
      navigeer(ctx, { area: 'producten', id: tekst(project.id), tab: 'gesprek', params: { tekst: woorden } }, {
        behoudFocus: true,
        melding: TPL(ctx, 'Stel een vraag over {product}', { product: tekst(project.name) })
      });
    });
    return knop;
  };

  /* --- tab Voortgang: fasebalk, samplerondes, kwaliteit, zendingen, kaart ---
     Het fasepad met zes iconen (CP_CHART.stagePath) is de fasebalk
     geworden (advies 22); de details per fase — percentage, bedrag,
     akkoorddatum — staan onder Details. De akkoordknop staat in de banner
     en in de rail, niet nog een derde keer in het pad. */
  var tabVoortgang = function (ctx, ui, chart, project, b, o) {
    var p = PM(ctx);
    o = opt(o);
    var stages = fasesVan(project, b.stages);
    var v = (p && fn(p.voortgang)) ? p.voortgang(project, stages) : { klaar: false };
    var cur = huidigeFase(stages);
    var klaar = !!v.klaar || tekst(project.status) === 'archived';

    /* ---------- de fasebalk; zonder held staat de verwachte datum eronder (advies 33) ---------- */
    var padKaart = kaart(ui, [
      ui.sectionHead({ titel: T(ctx, 'Waar je project staat') }),
      stages.length ? faseBalk(ctx, ui, project, stages, v) : ui.emptyTile({ icoon: 'projecten', titel: T(ctx, 'Nog geen fases') }),
      o.heeftHeld ? null : ui.el('div', { style: 'margin-top:10px;' }, verwachtRegel(ctx, ui, b, klaar))
    ]);

    return ui.el('div', null, [
      padKaart,
      ruimte(ui, 24),
      samplesBlok(ctx, ui, project, b, stages, cur),
      ruimte(ui, 24),
      kwaliteitBlok(ctx, ui, chart, project, b, stages, cur),
      ruimte(ui, 24),
      zendingenBlok(ctx, ui, project, b),
      ruimte(ui, 24),
      fabriekskaartBlok(ctx, ui, chart, project, b)
    ]);
  };

  /* ---------- samplerondes ---------- */
  var sampleStand = function (ctx, smp, b) {
    var onderweg = lijst(b.shipments).some(function (sp) { return sp && sp.sampleRoundId === smp.id && !sp.deliveredAt; });
    if (smp.status === 'approved') return { woord: T(ctx, 'Goedgekeurd'), toon: 'klaar', onderweg: onderweg };
    if (smp.status === 'superseded') return { woord: T(ctx, 'Vervangen door een nieuwere ronde'), toon: 'neutraal', onderweg: onderweg };
    if (smp.status === 'reviewed' && !smp.clientDecision) return { woord: T(ctx, 'Wacht op jouw beoordeling'), toon: 'wacht', onderweg: onderweg };
    if (smp.clientDecision === 'aanpassing') return { woord: T(ctx, 'Aanpassing gevraagd'), toon: 'extern', onderweg: onderweg };
    return { woord: T(ctx, 'In beoordeling bij Steffan'), toon: 'extern', onderweg: onderweg };
  };

  /* de eerdere klantbeslissing onder een ronde */
  var beslissingRegel = function (ctx, ui, smp) {
    if (!smp.clientDecision) return null;
    var woord = smp.clientDecision === 'goedgekeurd' ? T(ctx, 'goedgekeurd') : T(ctx, 'aanpassing gevraagd');
    var delen = [TPL(ctx, 'Jij: {beslissing} op {datum}', { beslissing: woord, datum: smp.clientDecidedAt ? datumTekst(ctx, smp.clientDecidedAt) : '' })];
    var n = lijst(smp.clientMarks).length;
    if (n) delen.push(n === 1 ? T(ctx, '1 aanwijzing op de foto') : TPL(ctx, '{n} aanwijzingen op de foto', { n: n }));
    return ui.el('div', { style: 'padding:0 24px 16px;' }, [
      ui.el('p', { class: 'u-sub', 'data-no-i18n': '', text: delen.join(' · ') }),
      tekst(smp.clientNote) ? dataRegel(ui, 'u-lees', tekst(smp.clientNote), { style: 'margin-top:4px;' }) : null
    ]);
  };

  var samplesBlok = function (ctx, ui, project, b, stages, cur) {
    var faseNaam = faseNaamVan(ctx);
    var samples = lijst(b.samples).filter(isObj);
    var kop = ui.sectionHead({ titel: T(ctx, 'Samplerondes'), telling: samples.length || undefined });
    if (!samples.length) {
      var tooling = null;
      stages.forEach(function (s) { if (s.stageKey === 'tooling') tooling = s; });
      var totaal = stages.length;
      var zin;
      if (tooling && cur && getal(cur.position) < getal(tooling.position)) {
        zin = TPL(ctx, 'Je eerste sample verschijnt na de T0 ronde. Die staat gepland in fase {p} van {t} — jullie zitten nu in fase {c}, {fase}.',
          { p: tooling.position, t: totaal, c: cur.position, fase: faseNaam(cur.stageKey) });
      } else if (tooling && cur && getal(cur.position) === getal(tooling.position)) {
        zin = TPL(ctx, 'Jullie zitten nu in fase {p}, {fase} — het eerste sample uit de T0 ronde verschijnt hier zodra het er is.',
          { p: tooling.position, fase: faseNaam('tooling') });
      } else {
        zin = T(ctx, 'Zodra er een sampleronde is, staat die hier — met foto, notities en wat er per ronde is aangepast.');
      }
      return sectie(ui, kop, [ui.emptyTile({ icoon: 'camera', titel: T(ctx, 'Nog geen samples'), uitleg: zin })]);
    }

    /* goedgekeurd bovenaan, daarna nieuwste eerst — renderSamples() */
    var rijen = samples.slice().sort(function (a, c) {
      if (a.status === 'approved' && c.status !== 'approved') return -1;
      if (c.status === 'approved' && a.status !== 'approved') return 1;
      var x = tekst(a.roundDate), y = tekst(c.roundDate);
      if (x === y) return 0;
      return x > y ? -1 : 1;
    });

    var kaarten = rijen.map(function (smp) {
      var media = mediaVanSample(b, smp);
      var st = sampleStand(ctx, smp, b);
      var chips = [ui.statusDot({ toon: st.toon, label: st.woord })];
      if (st.onderweg) chips.push(ui.statusChip({ label: T(ctx, 'Onderweg naar jou'), toon: 'extern' }));
      var wacht = smp.status === 'reviewed' && !smp.clientDecision;
      var vak = paneelVak(ui);
      var knopHouder = { el: null };
      var open = function () {
        if (vak.isOpen()) { vak.sluit(); if (knopHouder.el) knopHouder.el.setAttribute('aria-expanded', 'false'); return; }
        vak.openMet(paneelSample(ctx, { sample: smp, media: media, onSluit: function () {
          vak.sluit(); if (knopHouder.el) knopHouder.el.setAttribute('aria-expanded', 'false');
        } }), knopHouder.el);
        if (knopHouder.el) knopHouder.el.setAttribute('aria-expanded', 'true');
      };
      var rij = ui.taskCard({
        beeld: media ? beeldVak(ctx, ui, media, 'u-thumb', TPL(ctx, 'Sample {x}', { x: tekst(smp.roundLabel) })) : ui.iconTile({ icoon: 'camera', toon: 'neutraal', maat: 40 }),
        titel: TPL(ctx, 'Sample {x}', { x: tekst(smp.roundLabel) }),
        context: samen([datumKort(ctx, smp.roundDate), smp.approvedAt ? TPL(ctx, 'Goedgekeurd {d}', { d: datumKort(ctx, smp.approvedAt) }) : '']),
        why: tekst(smp.note),
        meta: chips,
        urgent: wacht ? 'warn' : '',
        primair: (wacht && actie(ctx, 'sampleBeoordelen')) ? { label: TPL(ctx, 'Beoordeel sample {x}', { x: tekst(smp.roundLabel) }), onClick: open } : null,
        inline: ui.el('div', null, [beslissingRegel(ctx, ui, smp), vak])
      });
      knopHouder.el = rij.querySelector('.u-task-acts button');
      if (knopHouder.el) knopHouder.el.setAttribute('aria-expanded', 'false');
      var why = rij.querySelector('.u-task-why');
      if (why) why.setAttribute('data-no-i18n', '');
      var ctxEl = rij.querySelector('.u-task-ctx');
      if (ctxEl) ctxEl.setAttribute('data-no-i18n', '');
      return rij;
    });
    return sectie(ui, kop, [ui.entityList(kaarten)]);
  };

  /* ---------- kwaliteit ---------- */
  var CHECKPOINT_LABELS = { iqc: 'IQC — inkomend materiaal', ipqc: 'IPQC — tijdens de run', fqc: 'FQC — voor verzending' };
  var SEVERITY_LABELS = { critical: 'Kritiek', major: 'Groot', minor: 'Klein' };

  /* acceptatiegetal uit de Z1.4-tabel in portal/config.js; bij een omvang
     tussen twee brackets de dichtstbijzijnde — aqlAcceptFor() in portal.html */
  var aqlAccept = function (sampleSize) {
    var tabel = lijst(root.CP_AQL_ACCEPT);
    if (!tabel.length || !sampleSize) return null;
    var best = tabel[0];
    for (var i = 1; i < tabel.length; i++) {
      if (Math.abs(tabel[i].size - sampleSize) < Math.abs(best.size - sampleSize)) best = tabel[i];
    }
    return best.accept;
  };
  var aqlUitleg = function (ctx) {
    var def = '';
    lijst(root.CP_GLOSSARY).forEach(function (g) { if (!def && g && g.id === 'aql') def = tekst(g.def); });
    return T(ctx, def || 'De statistische norm die bepaalt hoeveel afwijkingen een steekproef mag bevatten voordat de hele batch wordt afgekeurd. Elke inspectie in je portaal wordt tegen deze norm gemeten.');
  };

  var kwaliteitBlok = function (ctx, ui, chart, project, b, stages, cur) {
    var faseNaam = faseNaamVan(ctx);
    var rondes = lijst(b.inspections).filter(isObj);
    var kop = ui.sectionHead({ titel: T(ctx, 'Kwaliteitscontrole'), telling: rondes.length || undefined });
    if (!rondes.length) {
      var prod = null;
      stages.forEach(function (s) { if (s.stageKey === 'production') prod = s; });
      var zin;
      if (prod && cur && getal(cur.position) < getal(prod.position)) {
        zin = TPL(ctx, 'Elke inspectie wordt gemeten tegen de AQL norm uit je offerte. De eerste controle staat gepland in fase {p} van {t} — jullie zitten nu in fase {c}, {fase}.',
          { p: prod.position, t: stages.length, c: cur.position, fase: faseNaam(cur.stageKey) });
      } else if (prod && cur && getal(cur.position) === getal(prod.position)) {
        zin = T(ctx, 'De productie loopt. Het eerste inspectierapport verschijnt hier zodra de controle tegen de AQL norm is uitgevoerd.');
      } else {
        zin = T(ctx, 'Zodra er een inspectie is uitgevoerd, staat het rapport hier — gemeten tegen de AQL norm uit je offerte.');
      }
      return sectie(ui, kop, [ui.emptyTile({ icoon: 'vinkje', titel: T(ctx, 'Nog geen inspectie'), uitleg: zin })]);
    }

    var oplopend = rondes.slice().sort(function (a, c) { return tekst(a.reportDate) < tekst(c.reportDate) ? -1 : 1; });
    var telling = function (r, ernst) {
      var n = 0;
      lijst(r.defects).forEach(function (d) { if (d && d.severity === ernst) n += getal(d.count, 0); });
      return n;
    };
    var normen = [], normOntbreekt = false;
    var groepen = oplopend.map(function (r) {
      var acc = aqlAccept(getal(r.sampleSize, 0));
      if (acc === null) normOntbreekt = true; else normen.push(acc);
      return {
        label: tekst(r.checkpoint).toUpperCase() + ' ' + datumKort(ctx, r.reportDate),
        delen: [
          { label: T(ctx, 'Klein'), waarde: telling(r, 'minor'), kleur: 'ink-4' },
          { label: T(ctx, 'Groot'), waarde: telling(r, 'major'), kleur: 'ink' },
          { label: T(ctx, 'Kritiek'), waarde: telling(r, 'critical'), kleur: 'crit' }
        ]
      };
    });
    var ariaDelen = oplopend.map(function (r) {
      var totaal = telling(r, 'minor') + telling(r, 'major') + telling(r, 'critical');
      var s = TPL(ctx, totaal === 1 ? '{cp} op {d}: 1 afwijking op {n} stuks' : '{cp} op {d}: {x} afwijkingen op {n} stuks',
        { cp: tekst(r.checkpoint).toUpperCase(), d: datumKort(ctx, r.reportDate), x: totaal, n: getal(r.sampleSize, 0) });
      var acc = aqlAccept(getal(r.sampleSize, 0));
      if (acc !== null) s += TPL(ctx, ', de norm staat er {a} toe', { a: acc });
      return s;
    });
    var grafiek = (chart && fn(chart.barChart)) ? chart.barChart({
      titel: T(ctx, 'Kwaliteit in beeld'),
      groepen: groepen,
      eenheid: '',
      hoogte: 200,
      legenda: true,
      overlay: normOntbreekt ? null : { punten: normen, gestreept: true, kleur: 'ink-3', label: T(ctx, 'wat de norm toestaat') },
      beschrijving: TPL(ctx, 'Kwaliteit in beeld — per inspectieronde de steekproef, de gevonden afwijkingen en de norm. {delen}.', { delen: ariaDelen.join(' · ') })
    }) : null;
    /* één zin zichtbaar (de legenda); de uitleg van de AQL norm achter de
       hulpknop (advies 1) */
    var grafiekKaart = kaart(ui, [
      ui.sectionHead({ kicker: T(ctx, 'Kwaliteit in beeld'), titel: T(ctx, 'Afwijkingen per inspectieronde') }),
      grafiek,
      ui.el('div', { style: 'margin-top:12px;' }, helpKnop(ctx, ui, aqlUitleg(ctx),
        ui.el('span', { class: 'u-sub', text: T(ctx, 'Staaf = de afwijkingen van één ronde, gestapeld naar ernst · gestreepte lijn = wat de norm toestaat') })))
    ]);

    var aflopend = rondes.slice().sort(function (a, c) { return tekst(a.reportDate) > tekst(c.reportDate) ? -1 : 1; });
    var kaarten = aflopend.map(function (r) {
      var cp = Object.prototype.hasOwnProperty.call(CHECKPOINT_LABELS, tekst(r.checkpoint)) ? T(ctx, CHECKPOINT_LABELS[r.checkpoint]) : tekst(r.checkpoint).toUpperCase();
      var defects = lijst(r.defects).filter(isObj);
      var defectRijen = defects.map(function (d) {
        var rij = ui.entityRow({
          thumb: false,
          titel: Object.prototype.hasOwnProperty.call(SEVERITY_LABELS, tekst(d.severity)) ? T(ctx, SEVERITY_LABELS[d.severity]) : tekst(d.severity),
          sub: tekst(d.note),
          meta: TPL(ctx, '{n} stuks', { n: getal(d.count, 0) })
        });
        rij.setAttribute('data-no-i18n', '');
        return rij;
      });
      return kaart(ui, [
        ui.sectionHead({ kicker: cp, titel: samen([tekst(r.aqlNorm), TPL(ctx, 'steekproef {n}', { n: getal(r.sampleSize, 0) }), datumKort(ctx, r.reportDate)]) }),
        ui.el('div', { style: 'margin-bottom:12px;' }, ui.statusDot({
          toon: r.passed ? 'klaar' : 'kritiek',
          label: r.passed ? T(ctx, 'Binnen norm') : T(ctx, 'Buiten norm — Steffan neemt contact op')
        })),
        defectRijen.length ? ui.el('div', { class: 'u-card u-rows' }, defectRijen) : ui.el('p', { class: 'u-lees', text: T(ctx, 'Geen afwijkingen gevonden.') }),
        tekst(r.contextLine) ? dataRegel(ui, 'u-sub', tekst(r.contextLine), { style: 'margin-top:10px;' }) : null
      ]);
    });
    return sectie(ui, kop, [grafiekKaart, ruimte(ui, 16), stapel(ui, kaarten, 16)]);
  };

  /* ---------- zendingen: De Reis ---------- */
  var zendingKaart = function (ctx, ui, s, b) {
    var SHIP = root.CP_SHIPPING;
    var tpl = (SHIP && fn(SHIP.milestonesFor)) ? lijst(SHIP.milestonesFor(s.type)) : [];
    var events = lijst(b.shipmentEvents).filter(function (ev) { return ev && ev.shipmentId === s.id; });
    var opSleutel = {};
    events.forEach(function (ev) { opSleutel[ev.milestoneKey] = ev; });
    var carrier = (SHIP && SHIP.CARRIERS && s.carrierCode) ? (SHIP.CARRIERS[s.carrierCode] || null) : null;
    var typeWoord = (SHIP && fn(SHIP.typeLabel)) ? T(ctx, SHIP.typeLabel(s.type)) : tekst(s.type);
    var titel = carrier ? TPL(ctx, '{t} via {c}', { t: typeWoord, c: carrier.name }) : typeWoord;

    var chips = [];
    var smp = null;
    lijst(b.samples).forEach(function (x) { if (x && x.id === s.sampleRoundId) smp = x; });
    if (smp) chips.push(ui.statusChip({ label: TPL(ctx, 'Sample {x}', { x: tekst(smp.roundLabel) }), toon: 'neutraal' }));
    if (tekst(s.blNumber)) chips.push(ui.statusChip({ label: 'B/L ' + tekst(s.blNumber), toon: 'neutraal' }));
    chips.push(s.deliveredAt
      ? ui.statusDot({ toon: 'klaar', label: TPL(ctx, 'Geleverd {d}', { d: datumKort(ctx, s.deliveredAt) }) })
      : ui.statusDot({ toon: 'extern', label: T(ctx, 'Onderweg') }));

    var boog = reisBoog(ctx, s);

    var mijlpalen = tpl.map(function (ms) {
      var ev = opSleutel[ms.key];
      var sub = ev ? samen([datumKort(ctx, ev.occurredAt), tekst(ev.location)]) : '';
      return ui.el('div', { class: 'u-row', style: 'padding:12px 0;' }, [
        ui.el('span', { class: 'u-row-main' }, [
          ui.el('span', { class: 'u-row-title', style: ev ? null : 'color:var(--ink-2);font-weight:400;', text: T(ctx, ms.label) }),
          sub ? ui.el('span', { class: 'u-row-sub', 'data-no-i18n': '', text: sub }) : null,
          (ev && tekst(ev.note)) ? ui.el('span', { class: 'u-row-sub', 'data-no-i18n': '', text: tekst(ev.note) }) : null
        ]),
        ui.el('span', { class: 'u-row-end' }, ui.statusDot({ toon: ev ? 'klaar' : 'neutraal', label: ev ? T(ctx, 'Bereikt') : T(ctx, 'Nog niet') }))
      ]);
    });

    /* ETA: altijd een weekvenster; ouder dan 7 dagen zegt de kaart dat */
    var eta = null;
    if (!s.deliveredAt && (s.etaWindowStart || s.etaWindowEnd)) {
      var venster = (s.etaWindowStart && s.etaWindowEnd)
        ? TPL(ctx, 'Tussen {a} en {b}', { a: datumKort(ctx, s.etaWindowStart), b: datumKort(ctx, s.etaWindowEnd) })
        : TPL(ctx, 'Rond {d}', { d: datumKort(ctx, s.etaWindowStart || s.etaWindowEnd) });
      var regels = [ui.el('span', { class: 'u-kicker', text: T(ctx, 'Verwachte levering') }),
        ui.el('p', { class: 'u-lees', 'data-no-i18n': '', text: venster + (tekst(s.etaNote) ? ' — ' + tekst(s.etaNote) : '') })];
      if (s.etaUpdatedAt) {
        var oud = (new Date(nuVan(ctx)).getTime() - new Date(s.etaUpdatedAt).getTime()) / 86400000;
        /* één zin: de datum, en als die oud is de eerlijke waarschuwing in
           diezelfde zin (advies 1) */
        regels.push(ui.el('p', { class: 'u-sub', text: oud > 7
          ? TPL(ctx, 'Laatst bijgewerkt op {d}; Steffan werkt dit bij zodra er nieuws van de vervoerder is.', { d: datumKort(ctx, s.etaUpdatedAt) })
          : TPL(ctx, 'Laatst bijgewerkt op {d}.', { d: datumKort(ctx, s.etaUpdatedAt) }) }));
      }
      eta = ui.el('div', { style: 'margin-top:16px;' }, regels);
    }

    /* de knop zegt al wat hij doet; de uitlegzin ernaast is weg (advies 2) */
    var nr = tekst(s.containerNumber || s.trackingNumber);
    var volg = null;
    if (nr && SHIP && SHIP.CARRIERS) {
      var track = (carrier && fn(carrier.trackUrl)) ? carrier : SHIP.CARRIERS.anders;
      if (track && fn(track.trackUrl)) {
        volg = ui.el('div', { style: 'margin-top:16px;' }, ui.el('a', {
          class: 'u-btn ghost klein', href: track.trackUrl(nr), target: '_blank', rel: 'noopener noreferrer', 'data-no-i18n': '',
          text: carrier ? TPL(ctx, 'Volg {nr} bij {c}', { nr: nr, c: carrier.name }) : TPL(ctx, 'Volg {nr}', { nr: nr })
        }));
      }
    }

    var docs = lijst(b.documents).filter(function (d) { return d && d.shipmentId === s.id; });
    var docBlok = docs.length ? ui.el('div', { style: 'margin-top:16px;' }, [
      ui.el('span', { class: 'u-kicker', text: T(ctx, 'Documenten bij deze zending') }),
      ui.el('div', { class: 'u-card u-rows', style: 'margin-top:8px;' }, docs.map(function (d) { return documentRij(ctx, ui, d, b); }))
    ]) : null;

    return kaart(ui, [
      ui.el('div', { class: 'u-sectionhead' }, [
        ui.el('h2', { text: titel }),
        ui.el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;' }, chips)
      ]),
      boog,
      boog ? null : ui.el('p', { class: 'u-sub', text: T(ctx, 'De routeboog verschijnt zodra de reis is getekend.') }),
      ui.el('div', { class: 'u-rows', style: 'margin-top:8px;' }, mijlpalen),
      eta, volg, docBlok
    ]);
  };

  var zendingenBlok = function (ctx, ui, project, b) {
    var alle = lijst(b.shipments).filter(isObj);
    var kop = ui.sectionHead({ titel: T(ctx, 'Zendingen — De Reis'), telling: alle.length || undefined });
    /* lege staten in één regel (advies 9) */
    if (!alle.length) {
      return sectie(ui, kop, [ui.emptyTile({
        icoon: 'locatie',
        titel: T(ctx, 'Zodra er een zending is, begint hier de reis')
      })]);
    }
    var actief = alle.filter(function (s) { return !s.deliveredAt; }).sort(function (a, c) { return tekst(c.createdAt) < tekst(a.createdAt) ? -1 : 1; });
    var blokken = actief.map(function (s) { return zendingKaart(ctx, ui, s, b); });
    if (!actief.length) {
      blokken.push(ui.el('p', { class: 'u-lees', text: T(ctx, 'Er is nu niets onderweg.') }));
    }
    var geleverd = alle.filter(function (s) { return !!s.deliveredAt; });
    var perJaar = {};
    geleverd.forEach(function (s) {
      var y = tekst(s.deliveredAt).slice(0, 4);
      (perJaar[y] = perJaar[y] || []).push(s);
    });
    Object.keys(perJaar).sort().reverse().forEach(function (y) {
      blokken.push(ui.el('p', { class: 'u-kicker', style: 'margin-top:8px;', 'data-no-i18n': '', text: TPL(ctx, 'Archief · {y}', { y: y }) }));
      perJaar[y].sort(function (a, c) { return tekst(c.deliveredAt) < tekst(a.deliveredAt) ? -1 : 1; })
        .forEach(function (s) { blokken.push(zendingKaart(ctx, ui, s, b)); });
    });
    return sectie(ui, kop, [stapel(ui, blokken, 16)]);
  };

  /* ---------- de fabriekskaart: alleen de fabrieken van dit project ---------- */
  var gekoppeldeFabrieken = function (project, b) {
    var linked = {};
    if (tekst(opt(project).factoryId)) linked[project.factoryId] = true;
    lijst(b.media).forEach(function (m) { if (m && m.factoryId) linked[m.factoryId] = true; });
    lijst(b.disclosures).forEach(function (d) { if (d && d.factoryId) linked[d.factoryId] = true; });
    return lijst(b.factories).filter(function (f) { return f && linked[f.id]; });
  };
  var fabriekskaartBlok = function (ctx, ui, chart, project, b) {
    var coords = opt(root.CP_CITY_COORDS);
    var pins = gekoppeldeFabrieken(project, b).filter(function (f) { return tekst(f.city) && coords[f.city]; });
    if (!pins.length || !chart || !fn(chart.mapCard)) return null;
    var namen = pins.map(function (f) { return TPL(ctx, '{f} in {c}', { f: tekst(f.name), c: tekst(f.city) }); });
    var kaartNode = chart.mapCard({
      titel: T(ctx, 'Waar jouw product gemaakt wordt'),
      pins: pins.map(function (f) { return { naam: tekst(f.name), stad: tekst(f.city) }; }),
      bijschrift: T(ctx, 'Vereenvoudigde kaart, alleen stadsniveau — nooit een adres.'),
      beschrijving: TPL(ctx, 'Vereenvoudigde kaart van China, alleen stadsniveau: {lijst}.', { lijst: namen.join(', ') })
    });
    kaartNode.setAttribute('data-no-i18n', '');
    return sectie(ui, ui.sectionHead({ titel: T(ctx, 'Waar jouw product gemaakt wordt') }), [kaart(ui, [kaartNode])]);
  };

  /* ============================================================
     11. DE DOCUMENTRIJ — gedeeld door Bestanden en De Reis

     Een rij MET bestand is zelf de download: één <button class="u-row">,
     de vorm van CP_UI.entityRow zonder menu. Dezelfde rij als documentRij
     in portaal-schermen-berichten.js (de bron — die exporteert hem niet
     via CP_PORTAAL_SCHERMEN, vandaar deze kopie), maar hier in
     PRODUCTSCOPE: de factuur achter een factuurdocument komt uit de bundel
     van dít product.
     ============================================================ */

  var isDemo = function (ctx) {
    var d = DL(ctx);
    return !!(d && fn(d.modus) && d.modus() === 'demo');
  };

  /* 'Factuur 2026-0012' wordt op het renderpunt vertaald (docDisplayTitle
     in portal.html doet hetzelfde); elke andere titel is data */
  var docTitel = function (ctx, d) {
    var m = tekst(opt(d).title).match(/^Factuur\s+(\S+)$/);
    if (m) return TPL(ctx, 'Factuur {nummer}', { nummer: m[1] });
    return tekst(opt(d).title);
  };

  /* is er echt iets te downloaden? Demo: altijd (de demo-sheet legt uit
     wat er live gebeurt); live: alleen met een opslagpad — dezelfde regel
     als docDownloadable() in portal.html */
  var downloadbaar = function (ctx, d) {
    if (isDemo(ctx)) return true;
    return !!(d && (tekst(d.storagePath) || d.heeftBestand));
  };

  /* de redenen van CP_PORTAAL_DATA.factuurPdf, elk als één korte zin zonder
     mailadres (advies 10) — woordelijk dezelfde zinnen als REDENEN in
     portaal-schermen-berichten.js, zodat één reden overal hetzelfde klinkt.
     Waar de klant zelf niets kan, komt de knop "Vraag stellen" in de pil
     (REDEN_MET_VRAAG). */
  var PDF_REDENEN = {
    geen_document: 'Er is nog geen factuurdocument. Zodra Steffan het toevoegt, staat het hier.',
    pdf_volgt: 'Het bestand staat er nog niet bij. Zodra Steffan het toevoegt, verschijnt de download hier.',
    bestand_niet_in_deze_browser: 'Dit bestand staat alleen in de browser van de computer waarop het is geüpload.',
    ophalen_mislukt: 'Het bestand kon nu niet worden opgehaald. Probeer het over een minuut opnieuw.'
  };
  var REDEN_MET_VRAAG = { bestand_niet_in_deze_browser: true, ophalen_mislukt: true };

  /* het venster dat een PDF gaat tonen wordt SYNCHROON geopend, vóór de
     Promise — een popupblokkering treft alles wat pas ná een await opent.
     Komt er geen bestand, dan gaat het venster weer dicht en zegt de toast
     waarom. opties.vraag = {product, tekst}: de foutpil krijgt dan de knop
     "Vraag stellen" (advies 10) in plaats van een mailadres in de zin. */
  var openNaBelofte = function (ctx, belofte, opties) {
    var o = opt(opties);
    var vraag = isObj(o.vraag) ? vraagActie(ctx, o.vraag.product, o.vraag.tekst) : null;
    var w = null;
    try { w = fn(root.open) ? root.open('', '_blank', 'noopener') : null; } catch (e) { w = null; }
    return Promise.resolve(belofte).then(function (uit) {
      var u = opt(uit);
      if (u.beschikbaar && tekst(u.url)) {
        if (w) { try { w.location = u.url; return uit; } catch (e1) { /* door naar hieronder */ } }
        try { root.open(u.url, '_blank', 'noopener'); } catch (e2) { /* stil */ }
        return uit;
      }
      if (w) { try { w.close(); } catch (e3) { /* stil */ } }
      var reden = tekst(u.reden);
      toast(ctx, T(ctx, PDF_REDENEN[reden] || 'Het bestand wordt nog toegevoegd.'), REDEN_MET_VRAAG[reden] ? vraag : null);
      return uit;
    }, function (err) {
      if (w) { try { w.close(); } catch (e4) { /* stil */ } }
      toast(ctx, foutZin(ctx, err), vraag);
      return null;
    });
  };

  /* WELKE WEG OPENT DIT DOCUMENT — in deze volgorde:
       1. de haak ctx.acties.documentOpenen (bestaat vandaag niet; zodra
          portal.html hem geeft, wint hij);
       2. het factuurdocument via ctx.acties.factuurPdf (de bestaande
          beveiligde PDF, mét logregel);
       3. de downloadknop van de oude sectie voor deze rij (brug 3 uit het
          kopblok: handleDownload met de hele bestaande keten);
       4. niets — dan komt er geen knop, want een knop die niets doet is
          erger dan geen knop. */
  var documentWeg = function (ctx, d, b) {
    var open = actie(ctx, 'documentOpenen');
    if (open) return function () { return open(d); };
    var factuur = null;
    lijst(opt(b).invoices).forEach(function (inv) {
      if (!factuur && inv && inv.documentId && tekst(inv.documentId) === tekst(d.id)) factuur = inv;
    });
    var pdf = actie(ctx, 'factuurPdf');
    if (factuur && pdf) {
      return function () {
        return openNaBelofte(ctx, pdf(factuur), { vraag: { product: tekst(factuur.projectId) || tekst(opt(opt(b).project).id), tekst: overFactuur(ctx, factuur) } });
      };
    }
    var oud = oudeDownloadKnop(d.id);
    if (oud) return function () { oud.click(); };
    return null;
  };

  /* de documentrij: een rij MET bestand is zelf de download — dezelfde
     vorm als CP_UI.entityRow zonder menu: de hele rij is één <button>, dus
     Enter en spatie werken vanzelf, er is één tabstop per document en de
     hover- en focusstijl van .u-row gelden. Rechts staat het pijl-omlaag-
     icoon als belofte "dit haalt iets op", in de rol van het chevronnetje
     (.u-row-chevron). Een rij zonder bestand (PDF volgt, of geen weg
     ernaartoe) blijft een gewone rij: een knop die alleen een fout kan
     geven is erger dan geen knop. Bron: documentRij in
     portaal-schermen-berichten.js, regel voor regel dezelfde rij. */
  var documentRij = function (ctx, ui, d, b) {
    var faseNaam = faseNaamVan(ctx);
    var vanKlant = tekst(d.uploadedBy) === 'klant';
    var versie = getal(d.version, 1);
    var titel = docTitel(ctx, d) + (versie > 1 ? ' (v' + versie + ')' : '');
    var subDelen = [docTypeLabel(ctx, d.docType), faseNaam(d.stageKey), datumTekst(ctx, d.createdAt)];
    if (vanKlant) subDelen.push(T(ctx, 'Aangeleverd door jou'));

    /* de subregel krijgt een id: het aria-label van de rijknop noemt alleen
       de download en de titel, aria-describedby levert type, fase en datum
       er alsnog bij aan de schermlezer */
    var subId = uid('docsub');
    var hoofd = ui.el('span', { class: 'u-row-main' }, [
      ui.el('span', { class: 'u-row-title', 'data-no-i18n': '', text: titel }),
      ui.el('span', { class: 'u-row-sub', id: subId, 'data-no-i18n': '', text: samen(subDelen) }),
      (vanKlant && tekst(d.clientNote)) ? ui.el('span', { class: 'u-row-sub', 'data-no-i18n': '', text: tekst(d.clientNote) }) : null
    ]);
    var tegel = ui.iconTile({ icoon: 'bestand', toon: vanKlant ? 'klaar' : (tekst(d.docType) === 'nnn' ? 'extern' : 'neutraal'), maat: 44 });

    var staart = [];
    if (vanKlant) staart.push(ui.statusChip({ label: T(ctx, 'Van jou'), toon: 'klaar' }));
    var kan = downloadbaar(ctx, d);
    var weg = kan ? documentWeg(ctx, d, b) : null;
    if (!kan) {
      /* de eerlijke staat uit renderDocs: geen rij die alleen een fout kan
         geven */
      staart.push(ui.el('span', { class: 'u-row-meta', text: T(ctx, 'PDF volgt') }));
    }

    if (weg) {
      var pijl = ui.icon('pijlOmlaag', 18);
      pijl.setAttribute('class', 'u-row-chevron');
      /* CP_UI.icon zet dit al; hier nog eens, zodat de bedoeling in deze
         rij leesbaar is: de pijl is beeld, het aria-label zegt wat de rij doet */
      pijl.setAttribute('aria-hidden', 'true');
      staart.push(pijl);
      return ui.el('button', {
        type: 'button',
        class: 'u-row',
        'data-eid': tekst(d.id),
        /* dezelfde zin als de oude losse knop en als portal.html, dus de
           sleutel bestaat al in vier talen */
        'aria-label': TPL(ctx, 'Download {x}', { x: titel }),
        'aria-describedby': subId,
        onclick: function () { weg(); }
      }, [tegel, hoofd, ui.el('span', { class: 'u-row-end' }, staart)]);
    }
    return ui.el('div', { class: 'u-row', 'data-eid': tekst(d.id) }, [
      tegel,
      hoofd,
      staart.length ? ui.el('span', { class: 'u-row-end' }, staart) : null
    ]);
  };

  /* ============================================================
     12. TAB — BESTANDEN & FOTO'S

     Alles uit de bundel van het OPEN product: de foto's (nieuwste eerst),
     de documenten per fase, de open klantslots met hun uploadpaneel
     (dezelfde kaart als op Overzicht, dus aanleveren is overal hetzelfde)
     en de NNN-vastleggingen. Het werkgebied Bestanden toont hetzelfde over
     alle producten; hier staat alleen dit product.
     ============================================================ */

  var FOTO_GRENS = 12;

  var fotosVan = function (b, projectId) {
    return lijst(b.media).filter(function (m) {
      return isObj(m) && !m._concept && (!projectId || m.projectId === projectId);
    }).slice().sort(function (a, c) {
      var x = tekst(a.capturedAt), y = tekst(c.capturedAt);
      if (x !== y) return x > y ? -1 : 1;
      return tekst(a.id) < tekst(c.id) ? -1 : 1;
    });
  };

  /* DE FOTOTEGEL (advies 3, 26): een vierkant, en het bijschrift — alleen
     de korte datum en de tekst, geen fase (die is de groepskop) en geen
     fabriek (die staat onder Details) — pas bij openen: de tegel is een
     knop met aria-label = bijschrift die haar bijschriftregel open- en
     dichtklapt (aria-expanded); de skin toont diezelfde regel ook bij hover
     en focus. Het beeld komt via beeldVak (brug 2): tot het adres er is
     staat de lege tegel. De vierkante maat tekent de skin (10e). */
  var fotoTegel = function (ctx, ui, m) {
    var bijschrift = tekst(m.caption) || T(ctx, 'Foto zonder omschrijving');
    var beeld = beeldVak(ctx, ui, m, 'k-fotobeeld', '');
    var slot = beeld.querySelector('span.k-fotobeeld');
    if (slot) slot.className = 'u-thumb ph k-fotobeeld';
    var id = uid('foto');
    var regel = ui.el('span', {
      class: 'k-fototegel-bijschrift u-row-sub', id: id, 'data-no-i18n': '',
      text: samen([datumKort(ctx, m.capturedAt), bijschrift])
    });
    var knop = ui.el('button', {
      type: 'button', class: 'k-fototegel u-card',
      'aria-label': bijschrift, 'aria-expanded': 'false', 'aria-controls': id
    }, [beeld, regel]);
    knop.addEventListener('click', function () {
      var open = knop.getAttribute('aria-expanded') === 'true';
      knop.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (knop.classList && fn(knop.classList.toggle)) knop.classList.toggle('is-open', !open);
    });
    /* het lijstitem om de knop heen: role=listitem óp de knop zou haar
       knoprol wegnemen; data-eid staat hier voor de oude diepe link ?anker= */
    return ui.el('div', { role: 'listitem', 'data-eid': tekst(m.id), 'data-no-i18n': '' }, knop);
  };

  /* de foto's per fase: de fase is de groepskop (advies 3), de groepen in
     volgorde van hun nieuwste foto; een foto zonder fase onder 'Overig' */
  var fotosBlok = function (ctx, ui, project, b) {
    var faseKort = faseKortVan(ctx);
    var fotos = fotosVan(b, tekst(project.id));
    var alles = paramVan(ctx, 'fotos') === 'alle';
    var toon = alles ? fotos : fotos.slice(0, FOTO_GRENS);
    var kop = ui.sectionHead({ titel: T(ctx, 'Foto’s'), telling: fotos.length || undefined });
    if (!fotos.length) {
      return sectie(ui, kop, [ui.emptyTile({ icoon: 'camera', titel: T(ctx, 'Nog geen foto’s') })]);
    }
    var groepen = [], opSleutel = {};
    toon.forEach(function (m) {
      var k = tekst(m.stageKey) || '_';
      if (!opSleutel[k]) {
        opSleutel[k] = { sleutel: k, naam: k === '_' ? T(ctx, 'Overig') : faseKort(k), fotos: [] };
        groepen.push(opSleutel[k]);
      }
      opSleutel[k].fotos.push(m);
    });
    var blokken = groepen.map(function (g) {
      return ui.el('div', { class: 'k-fotogroep' }, [
        ui.el('p', { class: 'u-kicker', 'data-no-i18n': '', text: g.naam }),
        ui.el('div', { class: 'k-fotoraster', role: 'list' }, g.fotos.map(function (m) { return fotoTegel(ctx, ui, m); }))
      ]);
    });
    var meer = null;
    if (!alles && fotos.length > FOTO_GRENS) {
      meer = ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', style: 'margin-top:14px;',
        text: TPL(ctx, 'Toon alle foto’s ({n})', { n: fotos.length }),
        onclick: function () {
          deelNavigatie(ctx, { area: 'producten', id: project.id, tab: 'bestanden', params: { fotos: 'alle' } },
            TPL(ctx, 'Alle {n} foto’s', { n: fotos.length }));
        }
      });
    }
    return sectie(ui, kop, [stapel(ui, blokken, 20), meer]);
  };

  var documentenBlok = function (ctx, ui, project, b) {
    var docs = lijst(b.documents).filter(isObj);
    var kop = ui.sectionHead({ titel: T(ctx, 'Documenten'), telling: docs.length || undefined });
    if (!docs.length) {
      /* lege staat in één regel (advies 9) */
      return sectie(ui, kop, [ui.emptyTile({ icoon: 'bestand', titel: T(ctx, 'Nog geen documenten') })]);
    }
    /* per fase in padvolgorde, binnen een fase per type en dan de oudste
       eerst — de volgorde van renderDocs; een document zonder bekende fase
       komt achteraan */
    var positie = {};
    fasesVan(project, b.stages).forEach(function (s, i) { positie[tekst(s.stageKey)] = i; });
    var rang = function (d) {
      var k = tekst(d.stageKey);
      return Object.prototype.hasOwnProperty.call(positie, k) ? positie[k] : 999;
    };
    var rijen = docs.slice().sort(function (a, c) {
      var ra = rang(a), rc = rang(c);
      if (ra !== rc) return ra - rc;
      var ta = tekst(a.docType), tc = tekst(c.docType);
      if (ta !== tc) return ta < tc ? -1 : 1;
      var x = tekst(a.createdAt), y = tekst(c.createdAt);
      if (x !== y) return x < y ? -1 : 1;
      return tekst(a.id) < tekst(c.id) ? -1 : 1;
    }).map(function (d) { return documentRij(ctx, ui, d, b); });
    return sectie(ui, kop, [ui.entityList(rijen)]);
  };

  /* de open klantslots van dit product: dezelfde kaart met hetzelfde
     uploadpaneel als op Overzicht (nodigKaart → paneelBestand) */
  var nodigBestandenBlok = function (ctx, ui, project, b) {
    var bron = klantBron(ctx, {});
    var projectOp = indexOp(projectenVan(ctx), 'id');
    var mini = miniBundel(bron, project);
    if (!mini.stages.length) mini.stages = fasesVan(project, b.stages);
    var items = nodigItems(ctx, mini).filter(function (it) { return it && it.kind === 'bestand'; });
    var kop = ui.sectionHead({ titel: T(ctx, 'Wat we van jou nodig hebben'), telling: items.length || undefined });
    if (!items.length) {
      /* de contractzin, één regel en geen kaart (advies 9) */
      return sectie(ui, kop, [ui.el('p', { class: 'k-nodig-leeg u-lees', text: T(ctx, 'Niets te doen. Steffan meldt zich als hij je nodig heeft.') })], 'k-nodig');
    }
    return sectie(ui, kop, [ui.entityList(items.map(function (it) { return nodigKaart(ctx, ui, it, bron, projectOp); }))], 'k-nodig');
  };

  /* de NNN-vastleggingen van dit product (spec hoofdstuk 1, regel 13) */
  var beschermingBlok = function (ctx, ui, project, b) {
    var kop = ui.sectionHead({ titel: T(ctx, 'Bescherming van je ontwerp') });
    var disc = lijst(b.disclosures).filter(isObj).slice().sort(function (a, c) {
      var x = tekst(a.disclosedAt), y = tekst(c.disclosedAt);
      if (x !== y) return x > y ? -1 : 1;
      return tekst(a.id) < tekst(c.id) ? -1 : 1;
    });
    var fabrieken = indexOp(lijst(b.factories), 'id');
    var docs = indexOp(lijst(b.documents), 'id');
    var allesOnderNnn = disc.length > 0 && disc.every(function (x) { return !!x.underNnn; });
    /* de vertrouwensregel uit portal.html alleen als hij voor élke
       vastlegging klopt; anders de neutrale zin */
    var intro = ui.el('p', { class: 'u-lees', text: T(ctx, allesOnderNnn
      ? 'Je ontwerp is beschermd: fabrieken krijgen alleen bestanden onder NNN.'
      : 'Hieronder staat welk bestand met welke fabriek is gedeeld, en of dat onder NNN gebeurde.') });
    if (!disc.length) {
      /* lege staat in één regel (advies 9) */
      return sectie(ui, kop, [intro, ui.emptyTile({
        icoon: 'fabriek',
        titel: T(ctx, 'Er zijn nog geen bestanden met een fabriek gedeeld.')
      })]);
    }
    var rijen = disc.map(function (x) {
      var f = x.factoryId ? (fabrieken[x.factoryId] || null) : null;
      var doc = x.documentId ? (docs[x.documentId] || null) : null;
      var wat = doc ? docTitel(ctx, doc) : (tekst(x.what) || T(ctx, 'Bestanden'));
      var rij = ui.entityRow({
        thumb: ui.iconTile({ icoon: 'fabriek', toon: x.underNnn ? 'klaar' : 'wacht', maat: 44 }),
        titel: wat,
        sub: TPL(ctx, 'Gedeeld met {fabriek} op {datum}', { fabriek: f ? tekst(f.name) : T(ctx, 'een partner'), datum: datumTekst(ctx, x.disclosedAt) }),
        chips: [ui.statusChip({ label: x.underNnn ? T(ctx, 'Onder NNN') : T(ctx, 'Zonder NNN'), toon: x.underNnn ? 'klaar' : 'wacht' })]
      });
      rij.setAttribute('data-no-i18n', '');
      return rij;
    });
    return sectie(ui, kop, [intro, ui.entityList(rijen)]);
  };

  var tabBestanden = function (ctx, ui, chart, project, b) {
    var wortel = ui.el('div', null, [
      fotosBlok(ctx, ui, project, b),
      ruimte(ui, 24),
      documentenBlok(ctx, ui, project, b),
      ruimte(ui, 24),
      nodigBestandenBlok(ctx, ui, project, b),
      ruimte(ui, 24),
      beschermingBlok(ctx, ui, project, b)
    ]);
    /* de oude diepe links '#/updates@id' en '#/documenten@id' komen binnen
       als ?anker=id (kParseRoute): die kaart of rij in beeld brengen zodra
       het scherm hangt — vandaar de timeout van nul, de montage komt eerst */
    var anker = paramVan(ctx, 'anker');
    if (anker && fn(root.setTimeout)) {
      root.setTimeout(function () {
        var doel = wortel.querySelector('[data-eid="' + selEsc(anker) + '"]');
        var doc = (typeof document !== 'undefined') ? document : null;
        if (!doel || !doc || !fn(doc.contains) || !doc.contains(doel)) return;
        if (fn(doel.scrollIntoView)) doel.scrollIntoView({ block: 'center' });
        /* een documentrij met bestand is zelf de knop (hoofdstuk 11); een
           kaart of rij zonder eigen focus heeft er hooguit één in zich */
        var f = (tekst(doel.tagName).toLowerCase() === 'button') ? doel : doel.querySelector('button, a');
        if (f && fn(f.focus)) { try { f.focus(); } catch (e) { /* stil */ } }
      }, 0);
    }
    return wortel;
  };

  /* ============================================================
     13. TAB — BETALINGEN

     De drie tegels van het oude Kosten (betaald / open / nog te verwachten,
     per valuta en nooit stil omgerekend), de betaalmomenten per fase met
     hun stand, en de facturen van dit product. Betalen, een betaling melden
     en bezwaar wonen onder Betalingen — hier staat de weg ernaartoe, want
     het betaalvak met de QR en de twee formulieren hoeven niet twee keer te
     bestaan.
     ============================================================ */

  /* de betekeniskleur van de statusvertaler → de toonnamen van CP_UI */
  var TOON_VAN_STATUS = { ok: 'klaar', warn: 'wacht', crit: 'kritiek', info: 'extern', muted: 'neutraal' };

  /* de statusvertaler, met de onbevestigde meldingen van deze factuur erbij
     als het scherm die heeft opgehaald (betalingsmeldingen): daaruit volgt
     het woord 'Gemeld'. Zonder lijst (null: niet opgehaald, of de lezing
     mislukte) krijgt de vertaler géén opties en valt hij terug op
     inv.gemeldeBetaling — een lege lijst zou die terugval juist uitzetten. */
  var factuurStand = function (ctx, inv, gemeld) {
    var p = PM(ctx);
    if (p && fn(p.factuurStatusVoorKlant)) {
      return Array.isArray(gemeld)
        ? p.factuurStatusVoorKlant(inv, nuVan(ctx), { gemeld: gemeld })
        : p.factuurStatusVoorKlant(inv, nuVan(ctx));
    }
    /* zonder rekenlaag geen raden: alles telt als open op het totaal */
    var t = centen(getal(inv.totalCents, 0) > 0 ? inv.totalCents : inv.amountCents);
    return {
      code: tekst(inv.statusCode) || 'finalized', stand: 'open', label: 'Open', toon: 'warn',
      woord: 'Open', toelichting: '',
      betaald: false, open: t > 0, deels: false, gemeld: false, bezwaar: false, gesloten: false,
      openCents: t, totaalCents: t, betaaldCents: 0, gecrediteerdCents: 0,
      valuta: tekst(inv.currency) || 'EUR', vervaltISO: dagVan(ctx, inv.dueDate), verstreken: false
    };
  };
  var isCreditnota = function (inv) { return tekst(inv.docKind || 'invoice') !== 'invoice'; };
  var standToon = function (st) { return TOON_VAN_STATUS[tekst(st && st.toon)] || 'neutraal'; };

  /* HET WOORD EN DE TOELICHTING VAN DE KLANT — de enige weg waarlangs een
     factuurstand in dit bestand tekst wordt. De statusvertaler levert vier
     woorden (Open · Gemeld · Betaald · Bezwaar) en een toelichting als
     bronstring met {datum}, {betaald} en {totaal}; hier krijgen die de
     opmaak van de klant. Het fijne label ('Deels betaald', 'Verlopen', …)
     en de interne code komen hier nooit doorheen. Bron van deze drie:
     standToelichting/standWoord/standOnderregel in
     portaal-schermen-berichten.js — dezelfde regels, dezelfde invulling. */
  var standToelichting = function (ctx, st) {
    if (!st || !tekst(st.toelichting)) return '';
    /* {betaald} is alles wat niet meer betaald hoeft te worden — betaald
       én verrekend via creditnota */
    var af = centen(st.betaaldCents) + centen(st.gecrediteerdCents);
    return TPL(ctx, tekst(st.toelichting), {
      datum: st.vervaltISO ? datumTekst(ctx, st.vervaltISO) : '',
      betaald: bedragTekst(ctx, af, st.valuta),
      totaal: bedragTekst(ctx, st.totaalCents, st.valuta)
    });
  };
  /* een geannuleerde factuur heeft geen woord (zie de keuze in
     portaal-model.js) en toont op de plek van het woord zijn toelichting */
  var standWoord = function (ctx, st) {
    if (tekst(st && st.woord)) return T(ctx, tekst(st.woord));
    return standToelichting(ctx, st);
  };
  /* de toelichting ONDER het woord — leeg als hij al op de plek van het
     woord staat, anders zou hij twee keer verschijnen */
  var standOnderregel = function (ctx, st) {
    return tekst(st && st.woord) ? standToelichting(ctx, st) : '';
  };

  /* de gemelde, nog niet bevestigde betalingen per open factuur van dit
     product (listClientPayments), per factuur-id — dezelfde lader als
     schermBetalingen in portaal-schermen-berichten.js: de bundel draagt
     invoice_payments niet en "Gemeld" staat nergens op de factuurrij zelf.
     Geen leesfunctie of een mislukte lezing geeft null, zodat factuurStand
     de terugval op inv.gemeldeBetaling houdt. */
  var betalingsmeldingen = function (ctx, b) {
    var facturen = lijst(opt(b).invoices).filter(function (inv) {
      return isObj(inv) && tekst(inv.publishStatus) !== 'concept' && !isCreditnota(inv) && factuurStand(ctx, inv).open;
    });
    return Promise.all(facturen.map(function (inv) {
      return haal(ctx, 'listClientPayments', [inv], null).then(function (rijen) {
        return Array.isArray(rijen) ? rijen.filter(function (r) { return isObj(r) && !r.verifiedAt; }) : null;
      });
    })).then(function (per) {
      var uit = {};
      facturen.forEach(function (inv, i) { uit[tekst(inv.id)] = per[i]; });
      return uit;
    });
  };

  var tabBetalingen = function (ctx, ui, project, b, meldingen) {
    var faseNaam = faseNaamVan(ctx);
    /* per factuur-id de onbevestigde meldingen (betalingsmeldingen), of
       niets als deze tab ze niet heeft opgehaald */
    meldingen = opt(meldingen);
    /* een concept bereikt de klant nooit (conceptGate); deze poort staat er
       voor het geval een rij toch met publishStatus 'concept' binnenkomt */
    var alle = lijst(b.invoices).filter(function (inv) { return isObj(inv) && tekst(inv.publishStatus) !== 'concept'; });
    var facturen = alle.filter(function (inv) { return !isCreditnota(inv); });
    var creditnotas = alle.filter(isCreditnota);
    var stages = fasesVan(project, b.stages);
    var payStages = stages.filter(function (s) { return getal(s.paymentPct, 0) > 0; });
    var pctVanFase = function (stageKey) {
      var uit = 0;
      stages.forEach(function (s) { if (s.stageKey === stageKey) uit = getal(s.paymentPct, 0); });
      return uit;
    };

    /* ---------- de drie tegels ----------
       Eerlijk over valuta: sommen ALLEEN binnen één valuta — nooit euro's
       en dollars bij elkaar optellen of stil omrekenen. Bij meerdere valuta
       toont elke tegel één regel per valuta (renderCosts, functie 65). */
    var valutas = [];
    facturen.forEach(function (inv) { var c = tekst(inv.currency) || 'EUR'; if (valutas.indexOf(c) < 0) valutas.push(c); });
    var hoofdValuta = valutas[0] || 'EUR';
    var eenValuta = valutas.length <= 1;
    var betaaldPer = {}, openPer = {}, openTotaal = 0;
    facturen.forEach(function (inv) {
      var st = factuurStand(ctx, inv);
      var c = st.valuta || 'EUR';
      /* betaald is wat er echt is overgemaakt — ook op een factuur die
         daarna is geannuleerd of gecrediteerd; open is uitsluitend wat de
         statusvertaler open noemt (renderCosts, fase 5) */
      if (st.betaaldCents > 0) betaaldPer[c] = (betaaldPer[c] || 0) + st.betaaldCents;
      if (st.open) { openPer[c] = (openPer[c] || 0) + st.openCents; openTotaal += st.openCents; }
    });
    var geldRegels = function (per) {
      var keys = Object.keys(per).sort();
      if (!keys.length) return bedragTekst(ctx, 0, hoofdValuta);
      return keys.map(function (c) { return bedragTekst(ctx, per[c], c); }).join(' · ');
    };

    /* de projectsom alleen afleiden als alle facturen dezelfde valuta hebben
       én elke gekoppelde factuur op dezelfde som uitkomt (binnen afronding);
       een geannuleerde of gecrediteerde factuur telt niet als "gefactureerd"
       — factuurVoorFase levert die al niet op */
    var afgeleid = [], restStages = [];
    payStages.forEach(function (s) {
      var inv = factuurVoorFase(ctx, facturen, s.stageKey);
      if (!inv) { restStages.push(s); return; }
      var st = factuurStand(ctx, inv);
      if (eenValuta && st.totaalCents > 0) afgeleid.push(st.totaalCents * 100 / getal(s.paymentPct, 1));
    });
    var consistent = afgeleid.length > 0
      && (Math.max.apply(null, afgeleid) - Math.min.apply(null, afgeleid)) <= Math.max.apply(null, afgeleid) * 0.005;
    var restPct = 0;
    restStages.forEach(function (s) { restPct += getal(s.paymentPct, 0); });

    /* een subregel alleen waar het getal er zonder niet te lezen is: geen
       betaalmomenten, of een percentage in plaats van een bedrag */
    var verwacht;
    if (!payStages.length) {
      verwacht = { waarde: '—', sub: T(ctx, 'Er zijn nog geen betaalmomenten vastgelegd.') };
    } else if (!restStages.length) {
      verwacht = { waarde: eenValuta ? bedragTekst(ctx, 0, hoofdValuta) : '—', sub: '' };
    } else if (consistent) {
      verwacht = { waarde: bedragTekst(ctx, Math.round(afgeleid[0] * restPct / 100), hoofdValuta), sub: '' };
    } else {
      verwacht = { waarde: restPct + '%', sub: T(ctx, 'Het bedrag staat op de factuur zodra die er is.') };
    }

    /* ---------- de tegel met één getal (advies 25) ----------
       Eén grote tegel .k-groot-getal met wat open staat, en daarin twee
       kleine .k-klein-getal: betaald en nog te verwachten. De maten tekent
       de skin (10f). */
    var kleinGetal = function (label, waarde, sub) {
      return ui.el('div', { class: 'k-klein-getal' }, [
        ui.el('span', { class: 'u-kicker', text: label }),
        ui.el('span', { class: 'u-bedrag', 'data-no-i18n': '', text: waarde }),
        sub ? ui.el('span', { class: 'u-sub', text: sub }) : null
      ]);
    };
    var tegelRij = ui.el('div', {
      class: 'u-card k-groot-getal ' + (openTotaal > 0 ? 'wacht' : 'klaar')
    }, [
      ui.el('span', { class: 'u-kicker', text: T(ctx, 'Open') }),
      ui.el('span', { class: 'u-groot u-bedrag', 'data-no-i18n': '', text: geldRegels(openPer) }),
      ui.el('div', { class: 'k-klein-getallen' }, [
        kleinGetal(T(ctx, 'Betaald'), geldRegels(betaaldPer), ''),
        kleinGetal(T(ctx, 'Nog te verwachten'), verwacht.waarde, verwacht.sub)
      ])
    ]);

    /* ---------- betaalmomenten per fase ----------
       De gesegmenteerde balk van het oude Kosten heeft geen tegenhanger in
       CP_CHART; de dichtstbijzijnde mockupvorm is het metadataraster, per
       betaalmoment stip plús woord (kleur is nooit de enige drager). */
    var momentenKaart = null;
    if (payStages.length) {
      momentenKaart = kaart(ui, [
        ui.sectionHead({ titel: T(ctx, 'Betaalmomenten per fase') }),
        ui.el('div', { class: 'u-meta' }, payStages.map(function (s) {
          var inv = factuurVoorFase(ctx, facturen, s.stageKey);
          var st = inv ? factuurStand(ctx, inv, meldingen[tekst(inv.id)]) : null;
          /* het woord van de klant (Open · Gemeld · Betaald · Bezwaar) met
             zijn toelichting in de regels eronder; zonder factuur, of met
             een factuur zonder woord, 'volgt nog' */
          var heeftWoord = !!(st && tekst(st.woord));
          var woord = heeftWoord ? standWoord(ctx, st) : T(ctx, 'volgt nog');
          var toon = heeftWoord ? standToon(st) : 'neutraal';
          /* percentage, bedrag en de toelichting van het woord; de
             akkoorddatum staat onder Details en niet nog eens hier */
          var regels = [TPL(ctx, '{pct}% van de projectsom', { pct: getal(s.paymentPct, 0) })];
          if (st && st.totaalCents > 0) regels.push(bedragTekst(ctx, st.totaalCents, st.valuta));
          var onder = st ? standOnderregel(ctx, st) : '';
          if (onder) regels.push(onder);
          return ui.el('div', { class: 'u-meta-cel' }, [
            ui.el('span', { class: 'u-meta-label' }, ui.el('span', { 'data-no-i18n': '', text: faseNaam(s.stageKey) })),
            ui.el('span', { class: 'u-meta-waarde' }, ui.statusDot({ toon: toon, label: woord })),
            /* de details onder de stip, niet erachter: na een regelafbreking
               zou een los scheidingsteken vooraan komen te staan */
            ui.el('span', { class: 'u-sub', style: 'display:block;margin-top:4px;', 'data-no-i18n': '', text: regels.join(' · ') })
          ]);
        }))
      ]);
    }

    /* ---------- de facturen van dit product ----------
       Open eerst (op vervaldatum), daarna nieuwste eerst — de volgorde van
       Betalingen. Een klik landt op die factuur onder Betalingen, waar het
       betaalvak, "Betaling melden" en "Vraag over deze factuur" staan. */
    var gesorteerd = facturen.slice().sort(function (a, c) {
      var sa = factuurStand(ctx, a), sc = factuurStand(ctx, c);
      if (sa.open !== sc.open) return sa.open ? -1 : 1;
      if (sa.open && sa.vervaltISO !== sc.vervaltISO) {
        if (!sa.vervaltISO) return 1;
        if (!sc.vervaltISO) return -1;
        return sa.vervaltISO < sc.vervaltISO ? -1 : 1;
      }
      var x = tekst(a.createdAt), y = tekst(c.createdAt);
      if (x !== y) return x > y ? -1 : 1;
      return tekst(a.id) < tekst(c.id) ? -1 : 1;
    });
    var factuurRijen = gesorteerd.map(function (inv) {
      var st = factuurStand(ctx, inv, meldingen[tekst(inv.id)]);
      var nummer = tekst(inv.invoiceNumber), label = tekst(inv.label);
      var titel = nummer
        ? TPL(ctx, 'Factuur {nummer}', { nummer: nummer }) + (label ? ' · ' + label : '')
        : (label || T(ctx, 'Factuur'));
      /* het datumslot: de datum die er op dit moment toe doet. Een
         verstreken vervaldatum staat bij een kale te-late factuur al in de
         toelichting onder het woord ('Vervaldatum was …') en komt dan hier
         niet nog eens; gaat de toelichting over iets anders (deelbetaling,
         melding, bezwaar), dan draagt dit slot de datum — dezelfde regel
         als factuurRij in portaal-schermen-berichten.js */
      var toelichtingIsDatum = st.open && st.verstreken && !st.deels && !st.gemeld && !st.bezwaar;
      var wanneer = '';
      /* bij Betaald staat het woord al in de standkolom: hier alleen de
         datum, niet "Betaald · Betaald op …" (advies 8) */
      if (st.betaald && inv.paidAt) wanneer = datumKort(ctx, inv.paidAt);
      else if (st.vervaltISO && st.open && !st.verstreken) wanneer = TPL(ctx, 'Vervalt op {datum}', { datum: datumKort(ctx, st.vervaltISO) });
      else if (st.vervaltISO && st.open && !toelichtingIsDatum) wanneer = TPL(ctx, 'Vervaldatum was {datum}', { datum: datumKort(ctx, st.vervaltISO) });
      else if (!toelichtingIsDatum && inv.createdAt) wanneer = TPL(ctx, 'Aangemaakt op {datum}', { datum: datumKort(ctx, inv.createdAt) });
      var pct = pctVanFase(inv.stageKey);
      /* bij een deels betaalde factuur het OPENSTAANDE bedrag — de
         toelichting onder het woord zegt wat er al binnen is, dus de
         subregel herhaalt het totaal niet; incl. btw waar het bedrag btw
         bevat */
      var bedrag = bedragTekst(ctx, st.deels ? st.openCents : st.totaalCents, st.valuta)
        + ((getal(inv.totalCents, 0) > 0 && getal(inv.vatCents, 0) > 0) ? ' ' + T(ctx, 'incl. btw') : '');
      var toon = standToon(st);
      /* de stand: één van de vier woorden van de klant met de toelichting
         eronder — dezelfde kolom als de factuurrij onder Betalingen; het
         fijne label van de factuurmodule komt hier niet meer doorheen */
      var standOnder = standOnderregel(ctx, st);
      var standKolom = ui.el('span', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0;' }, [
        ui.statusDot({ toon: toon, label: standWoord(ctx, st) }),
        standOnder ? ui.el('span', { class: 'u-sub', 'data-no-i18n': '', text: standOnder }) : null
      ]);
      var rij = ui.entityRow({
        thumb: ui.iconTile({ icoon: 'financien', toon: toon, maat: 44 }),
        titel: titel,
        sub: samen([
          inv.stageKey ? faseNaam(inv.stageKey) : '',
          pct > 0 ? TPL(ctx, '{pct}% van de projectsom', { pct: pct }) : '',
          wanneer
        ]),
        meta: bedrag,
        chips: [standKolom],
        onOpen: function () { navigeer(ctx, { area: 'betalingen', params: { item: tekst(inv.id) } }); }
      });
      rij.setAttribute('data-eid', tekst(inv.id));
      rij.setAttribute('data-no-i18n', '');
      return rij;
    });
    var facturenSectie = sectie(ui, ui.sectionHead({
      titel: T(ctx, 'Facturen'), telling: facturen.length || undefined,
      actie: { label: T(ctx, 'Naar Betalingen'), ico: 'chevron', onClick: function () { navigeer(ctx, { area: 'betalingen' }); } }
    }), [
      /* lege staat in één regel (advies 9); de instructiezin onder de
         lijst is weg — de rij zegt zelf wat hij doet (advies 2) */
      factuurRijen.length ? ui.entityList(factuurRijen) : ui.emptyTile({ icoon: 'financien', titel: T(ctx, 'Nog geen facturen.') })
    ]);

    /* ---------- creditnota's, alleen als ze er zijn ---------- */
    var creditSectie = null;
    if (creditnotas.length) {
      var pdf = actie(ctx, 'factuurPdf');
      creditSectie = sectie(ui, ui.sectionHead({ titel: T(ctx, 'Creditnota’s'), telling: creditnotas.length }), [
        ui.el('div', { style: 'margin:0 0 10px;' }, helpKnop(ctx, ui, T(ctx, 'Het bedrag is al verrekend in de stand van de bijbehorende factuur.'),
          ui.el('span', { class: 'u-sub', text: T(ctx, 'Een creditnota vermindert wat je nog moet betalen.') }))),
        ui.entityList(creditnotas.map(function (cn) {
          var nummer = tekst(cn.invoiceNumber);
          var totaal = getal(cn.totalCents, 0) > 0 ? cn.totalCents : cn.amountCents;
          var menu = [];
          if (cn.documentId && pdf) {
            var onderwerp = nummer ? TPL(ctx, 'Creditnota {nummer}', { nummer: nummer }) : T(ctx, 'Creditnota');
            menu.push({ label: T(ctx, 'Bekijk PDF'), ico: 'bestand', onKies: function () {
              openNaBelofte(ctx, pdf(cn), { vraag: { product: tekst(cn.projectId) || tekst(project.id), tekst: TPL(ctx, 'Over {onderwerp}: ', { onderwerp: onderwerp }) } });
            } });
          }
          var rij = ui.entityRow({
            thumb: ui.iconTile({ icoon: 'pijlOmlaag', toon: 'klaar', maat: 44 }),
            titel: (nummer ? TPL(ctx, 'Creditnota {nummer}', { nummer: nummer }) : T(ctx, 'Creditnota')) + (tekst(cn.label) ? ' · ' + tekst(cn.label) : ''),
            sub: samen([cn.stageKey ? faseNaam(cn.stageKey) : '', cn.createdAt ? datumKort(ctx, cn.createdAt) : '']),
            meta: bedragTekst(ctx, totaal, tekst(cn.currency) || 'EUR'),
            menu: menu
          });
          rij.setAttribute('data-no-i18n', '');
          return rij;
        }))
      ]);
    }

    /* .k-betalingen: de haak uit portaal-skin.css — hier, en alleen hier,
       is een kritieke stand rood in plaats van oranje */
    return ui.el('div', { class: 'k-betalingen' }, [
      tegelRij,
      momentenKaart ? ruimte(ui, 24) : null,
      momentenKaart,
      ruimte(ui, 24),
      facturenSectie,
      creditSectie ? ruimte(ui, 24) : null,
      creditSectie
    ]);
  };

  /* ============================================================
     14. TAB — GESPREK

     De draden over dit product. De gekozen draad (uit ?item=, anders de
     nieuwste) staat open met de echte berichten (CP_PORTAAL_DATA.
     listMessages, vooraf opgehaald in S.product) en een antwoordveld
     (berichtSturen); de andere draden staan als rijen eronder. Bovenaan
     een nieuwe vraag over dít product (vraagStellen). Het werkgebied
     Berichten toont hetzelfde over alle producten.
     ============================================================ */

  /* wie sprak het laatst — CP_PORTAAL exporteert laatsteBeurt niet, dus
     dezelfde regel hier: de echte berichten winnen, anders de twee oude
     kolommen (vraag / antwoord) */
  var laatsteBeurt = function (q, berichten) {
    var rijen = lijst(berichten).filter(function (m) { return isObj(m) && tekst(m.body); });
    if (!rijen.length) {
      if (q.answer && q.answeredAt) return { author: 'staff', at: q.answeredAt, body: tekst(q.answer) };
      if (q.question) return { author: 'client', at: q.askedAt, body: tekst(q.question) };
      return null;
    }
    var l = rijen[rijen.length - 1];
    return { author: l.author === 'client' ? 'client' : 'staff', at: l.createdAt || null, body: tekst(l.body) };
  };

  /* de berichten van een draad in de vorm die CP_UI.thread verwacht. Vanuit
     de klant gezien zijn ZIJN berichten "Jij" en die van Steffan "CUSTOM+";
     thread() zet dat woord als chip naast de naam, zodat het verschil nooit
     alleen van kleur afhangt. */
  var draadBerichten = function (ctx, q, berichten) {
    var rijen = lijst(berichten).slice();
    if (!rijen.length) {
      if (q.question) rijen.push({ author: 'client', authorName: '', body: q.question, createdAt: q.askedAt });
      if (q.answer) rijen.push({ author: 'staff', authorName: '', body: q.answer, createdAt: q.answeredAt || q.askedAt });
    }
    return rijen.filter(function (m) { return isObj(m) && tekst(m.body); }).map(function (m) {
      var vanKlant = m.author === 'client';
      return {
        auteur: tekst(m.authorName) || (vanKlant ? (tekst(klantVan(ctx).naam) || T(ctx, 'Jij')) : 'Steffan Bakker'),
        organisatie: vanKlant ? tekst(klantVan(ctx).bedrijf) : 'CUSTOM+',
        tekst: tekst(m.body),
        at: m.createdAt || null,
        vanKlant: vanKlant
      };
    });
  };

  var draadKaart = function (ctx, ui, project, b, it) {
    var q = it.q;
    var faseNaam = faseNaamVan(ctx);
    var stand = it.wachtOpJou ? ui.statusChip({ label: T(ctx, 'Steffan wacht op je'), toon: 'wacht' })
      : (it.bijSteffan ? ui.statusChip({ label: T(ctx, 'Ligt bij Steffan'), toon: 'extern' }) : null);
    /* een vraag bij een foto (het oude "Stel je vraag bij een foto"): de
       foto blijft de context van het gesprek */
    var media = null;
    if (q.mediaId) lijst(b.media).forEach(function (m) { if (!media && m && m.id === q.mediaId && !m._concept) media = m; });

    var draad = ui.thread({
      berichten: draadBerichten(ctx, q, it.berichten),
      klantLabel: T(ctx, 'Jij'),
      eigenLabel: 'CUSTOM+',
      formatteerTijd: function (at) { return tijdTekst(ctx, at); },
      leegTekst: T(ctx, 'Nog geen berichten'),
      leegUitleg: T(ctx, 'Schrijf hieronder je eerste bericht in dit gesprek.')
    });
    /* namen, organisaties en de berichttekst zijn data */
    Array.prototype.forEach.call(draad.querySelectorAll('.u-thread-naam, .u-thread-org, .u-thread-tekst'), function (n) {
      n.setAttribute('data-no-i18n', '');
    });

    var antwoord = null;
    var stuur = actie(ctx, 'berichtSturen');
    if (stuur) {
      antwoord = berichtVak(ctx, {
        label: T(ctx, 'Jouw bericht'),
        placeholder: T(ctx, 'Schrijf je bericht aan Steffan…'),
        rijen: '4',
        knop: T(ctx, 'Verstuur'),
        doe: function (body) { return stuur(q, body); }
      });
    }

    return ui.el('div', { class: 'u-hero', role: 'region', 'aria-label': afkorten(q.question, 60) }, [
      ui.el('div', { class: 'u-hero-kop' }, [
        ui.el('div', null, [
          ui.el('span', { class: 'u-kicker', 'data-no-i18n': '', text: samen([T(ctx, 'Gesprek'), q.stageKey ? faseNaam(q.stageKey) : '']) }),
          ui.el('h2', { 'data-no-i18n': '', style: 'font-size:24px;font-weight:500;letter-spacing:-.012em;line-height:1.25;', text: afkorten(q.question, 140) }),
          ui.el('p', { class: 'u-sub', style: 'margin-top:6px;', text: TPL(ctx, 'Gesteld op {datum}', { datum: tijdTekst(ctx, q.askedAt) }) }),
          media ? dataRegel(ui, 'u-sub', TPL(ctx, 'Bij de foto: {bijschrift}', { bijschrift: tekst(media.caption) || datumKort(ctx, media.capturedAt) }), { style: 'margin-top:4px;' }) : null
        ]),
        stand
      ]),
      draad,
      antwoord ? ruimte(ui, 20) : null,
      antwoord,
      /* geen uitlegzin onder het veld (advies 2): de knop zegt wat hij doet
         en de melding na het versturen zegt wanneer Steffan antwoordt */
      ui.el('div', { style: 'margin-top:14px;' }, ui.el('button', {
        type: 'button', class: 'u-link',
        onclick: function () { navigeer(ctx, { area: 'berichten', params: { item: tekst(q.id) } }); }
      }, [ui.el('span', { text: T(ctx, 'Open in Berichten') }), ui.icon('chevron', 15)]))
    ]);
  };

  var tabGesprek = function (ctx, ui, project, b, draden) {
    var perVraag = {};
    lijst(draden).forEach(function (d) { if (d && d.vraag && d.vraag.id) perVraag[d.vraag.id] = lijst(d.berichten); });
    var vragen = lijst(b.questions).filter(function (q) { return isObj(q) && q.projectId === project.id; });
    var items = vragen.map(function (q) {
      var l = laatsteBeurt(q, perVraag[q.id]);
      return {
        q: q, berichten: perVraag[q.id] || [], laatste: l,
        /* "Steffan wacht op je": het laatste bericht is van hem */
        wachtOpJou: !!(l && l.author === 'staff'),
        bijSteffan: !!(l && l.author === 'client'),
        moment: tekst(l ? l.at : q.askedAt)
      };
    }).sort(function (a, c) {
      if (a.moment !== c.moment) return a.moment > c.moment ? -1 : 1;
      return tekst(a.q.id) < tekst(c.q.id) ? -1 : 1;
    });
    var gekozenId = paramVan(ctx, 'item');
    var gekozen = null;
    items.forEach(function (it) { if (tekst(it.q.id) === gekozenId) gekozen = it; });
    if (!gekozen && items.length) gekozen = items[0];

    /* ---------- een nieuwe vraag over dit product ----------
       Dezelfde opbouw als de andere actiepanelen (advies 12): het feit
       (kicker 'Vraag stellen', het product groot), één veld, één knop. De
       eerste woorden komen uit de route (?tekst=): zo landt de zwevende
       vraagknop (advies 15) hier met de context al ingevuld. Na het
       versturen gaat de route zonder die woorden verder — anders zou een
       verversing ze opnieuw in het lege veld zetten; de gastheer laadt de
       bundel bij die navigatie toch opnieuw (kNaSchrijf in portal.html). */
    var vraagKaart = null, vraagVeld = null;
    var vraag = actie(ctx, 'vraagStellen');
    var voorvul = paramVan(ctx, 'tekst');
    if (vraag) {
      var vak = berichtVak(ctx, {
        label: T(ctx, 'Jouw vraag'),
        placeholder: T(ctx, 'Bijvoorbeeld: is deze kleur al de definitieve kleur?'),
        rijen: '4',
        veldKlasse: 'k-vraagvak',
        groot: true,
        voorvul: voorvul,
        knop: T(ctx, 'Verstuur'),
        klaar: 'Je vraag is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.',
        vraag: { product: tekst(project.id), tekst: TPL(ctx, 'Over {product}: ', { product: tekst(project.name) }) },
        doe: function (body) { return vraag(project, body); },
        daarna: function (zin) { navigeer(ctx, { area: 'producten', id: tekst(project.id), tab: 'gesprek' }, { melding: zin }); }
      });
      vraagVeld = vak.veld;
      vraagKaart = paneelKaart(ui, [
        feitKop(ctx, ui, { kicker: T(ctx, 'Vraag stellen'), feit: tekst(project.name), data: true }),
        vak
      ]);
    }

    var wachtend = 0;
    items.forEach(function (it) { if (it.wachtOpJou) wachtend++; });
    var kop = ui.sectionHead({
      titel: T(ctx, 'Gesprekken'), telling: items.length || undefined,
      actie: { label: T(ctx, 'Alle berichten'), ico: 'chevron', onClick: function () { navigeer(ctx, { area: 'berichten' }); } }
    });
    var delen = [];
    if (wachtend) {
      delen.push(ui.el('div', { style: 'margin-bottom:12px;' }, ui.statusChip({
        label: wachtend === 1 ? T(ctx, '1 gesprek wacht op je') : TPL(ctx, '{n} gesprekken wachten op je', { n: wachtend }),
        toon: 'wacht'
      })));
    }
    if (!items.length) {
      /* lege staat in één regel (advies 9) */
      delen.push(ui.emptyTile({ icoon: 'inbox', titel: T(ctx, 'Nog geen gesprekken') }));
    } else {
      delen.push(draadKaart(ctx, ui, project, b, gekozen));
      var andere = items.filter(function (it) { return it !== gekozen; });
      if (andere.length) {
        delen.push(ruimte(ui, 16));
        delen.push(ui.el('p', { class: 'u-kicker', style: 'margin-bottom:10px;', text: T(ctx, 'Andere gesprekken') }));
        delen.push(ui.entityList(andere.map(function (it) {
          var q = it.q;
          var stip = it.wachtOpJou ? ui.statusDot({ toon: 'wacht', label: T(ctx, 'Steffan wacht op je') })
            : (it.bijSteffan ? ui.statusDot({ toon: 'extern', label: T(ctx, 'Ligt bij Steffan') }) : null);
          var rij = ui.entityRow({
            thumb: ui.iconTile({ icoon: 'mail', toon: it.wachtOpJou ? 'wacht' : (it.bijSteffan ? 'extern' : 'neutraal'), maat: 40 }),
            titel: afkorten(q.question, 90),
            sub: it.laatste ? tijdTekst(ctx, it.laatste.at) : tijdTekst(ctx, q.askedAt),
            chips: stip ? [stip] : [],
            onOpen: function () {
              deelNavigatie(ctx, { area: 'producten', id: project.id, tab: 'gesprek', params: { item: tekst(q.id) } },
                TPL(ctx, 'Geopend: {titel}', { titel: afkorten(q.question, 60) }));
            }
          });
          rij.setAttribute('data-no-i18n', '');
          return rij;
        })));
      }
    }
    var wortel = ui.el('div', null, [
      vraagKaart,
      vraagKaart ? ruimte(ui, 24) : null,
      sectie(ui, kop, delen)
    ]);
    /* de voorinvulling uit de route: het veld in beeld en de cursor achter
       de woorden zodra het scherm hangt — timeout nul, de montage komt
       eerst (zelfde patroon als ?anker= onder Bestanden) */
    if (voorvul && vraagVeld && fn(root.setTimeout)) {
      root.setTimeout(function () {
        var doc = (typeof document !== 'undefined') ? document : null;
        if (!doc || !fn(doc.contains) || !doc.contains(vraagVeld)) return;
        if (fn(vraagVeld.scrollIntoView)) vraagVeld.scrollIntoView({ block: 'center' });
        try { vraagVeld.focus(); } catch (e) { /* stil */ }
        cursorAanEind(vraagVeld);
      }, 0);
    }
    return wortel;
  };

  /* ============================================================
     15. TAB — DETAILS

     Kerngegevens (alleen velden die het portaal echt draagt — een
     projectrij heeft hier geen categorie, projectleider of deadline, dus
     die staan er ook niet), de fases met wie wanneer akkoord gaf (spec
     hoofdstuk 2: "fase toont wie akkoord gaf en wanneer"), je
     contactpersoon, en voor een afgerond product het dossier dat blijft.
     ============================================================ */

  var tabDetails = function (ctx, ui, project, b, contact) {
    var p = PM(ctx);
    var faseNaam = faseNaamVan(ctx);
    var stages = fasesVan(project, b.stages);
    var v = (p && fn(p.voortgang)) ? p.voortgang(project, stages)
      : { klaar: false, totaal: stages.length, afgerond: 0, huidigeFase: huidigeFase(stages) };
    var stand = productStand(ctx, project);
    var fabrieken = gekoppeldeFabrieken(project, b);
    var fotos = fotosVan(b, tekst(project.id));

    /* ---------- kerngegevens ---------- */
    var cellen = [
      { icoon: 'projecten', label: T(ctx, 'Projectcode'), waarde: tekst(project.code), leegTekst: T(ctx, 'Niet ingevuld') },
      { icoon: 'vinkje', label: T(ctx, 'Stand'), waarde: stand.woord, toon: stand.toon },
      { icoon: 'kalender', label: T(ctx, 'Gestart op'), waarde: datumTekst(ctx, project.createdAt), leegTekst: T(ctx, 'Niet ingevuld') },
      { icoon: 'fabriek', label: T(ctx, 'Fabriek'), waarde: fabrieken.map(function (f) {
        return tekst(f.name) + (tekst(f.city) ? ', ' + tekst(f.city) : '');
      }).join(' · '), leegTekst: T(ctx, 'Nog niet bekend') },
      { icoon: 'klok', label: T(ctx, 'Huidige fase'), waarde: v.klaar ? T(ctx, 'Alle fases zijn afgerond') : (v.huidigeFase ? faseNaam(v.huidigeFase.stageKey) : ''), leegTekst: T(ctx, 'Nog geen fases') },
      { icoon: 'activiteit', label: T(ctx, 'Voortgang'), waarde: v.totaal ? TPL(ctx, '{n} van {t} fases afgerond', { n: v.afgerond, t: v.totaal }) : '', leegTekst: T(ctx, 'Nog geen fases') },
      { icoon: 'camera', label: T(ctx, 'Foto’s'), waarde: String(fotos.length) },
      { icoon: 'bestand', label: T(ctx, 'Documenten'), waarde: String(lijst(b.documents).filter(isObj).length) },
      { icoon: 'gebruiker', label: T(ctx, 'Je contactpersoon'), waarde: isObj(contact) ? tekst(contact.name) : 'Steffan Bakker' }
    ];
    if (project.archivedAt) cellen.splice(3, 0, { icoon: 'kalender', label: T(ctx, 'Afgerond op'), waarde: datumTekst(ctx, project.archivedAt) });
    var raster = ui.metaGrid({ cellen: cellen });
    /* de waarden zijn data of al vertaald; de labels mogen wél door de DOM-pass */
    Array.prototype.forEach.call(raster.querySelectorAll('.u-meta-waarde'), function (n) { n.setAttribute('data-no-i18n', ''); });

    /* ---------- fases en akkoorden ----------
       De details per fase uit het oude fasepad wonen hier (advies 22):
       percentage, bedrag en stand van het betaalmoment in de meta, de
       akkoorddatum in de subregel. Namen niet herhalen (advies 7): alleen
       de datum ('Goedgekeurd 24 apr'); de naam in de tooltip, of één keer
       in een regel boven de lijst als alle akkoorden dezelfde naam dragen. */
    var namen = [];
    stages.forEach(function (s) {
      var n = trim(s.approvedAt ? s.approvedBy : '');
      if (n && namen.indexOf(n) < 0) namen.push(n);
    });
    var eenNaam = namen.length === 1 ? namen[0] : '';
    var akkoordRegel = eenNaam
      ? ui.el('p', { class: 'u-sub', 'data-no-i18n': '', style: 'margin:0 0 10px;', text: TPL(ctx, 'Akkoorden door {naam}', { naam: eenNaam }) })
      : null;
    var faseRijen = stages.map(function (s, i) {
      var st = faseStand(ctx, s.status);
      var pct = getal(s.paymentPct, 0);
      var sub = s.approvedAt ? TPL(ctx, 'Goedgekeurd {d}', { d: datumKort(ctx, s.approvedAt) }) : '';
      var meta = [];
      if (pct > 0) {
        meta.push(TPL(ctx, '{pct}% van de projectsom', { pct: pct }));
        var inv = factuurVoorFase(ctx, b.invoices, s.stageKey);
        var fst = inv ? factuurStand(ctx, inv) : null;
        if (fst && fst.totaalCents > 0) meta.push(bedragTekst(ctx, fst.totaalCents, fst.valuta));
        meta.push(fst ? (fst.betaald ? T(ctx, 'betaald') : (fst.open ? T(ctx, 'open') : T(ctx, 'volgt nog'))) : T(ctx, 'volgt nog'));
      }
      /* geen subregel voor een wachtende fase: de stip met het woord
         "Wacht op jouw akkoord" staat er al naast */
      var rij = ui.entityRow({
        /* het volgnummer als tegel: de fase heeft geen beeld, wel een plek in het pad */
        thumb: ui.el('span', { class: 'u-thumb ph', 'aria-hidden': 'true', text: String(getal(s.position, i + 1)) }),
        titel: faseNaam(s.stageKey),
        sub: sub,
        meta: meta.join(' · '),
        chips: [ui.statusDot({ toon: st.toon, label: st.woord })]
      });
      rij.setAttribute('data-no-i18n', '');
      if (s.approvedAt && tekst(s.approvedBy) && !eenNaam) {
        rij.setAttribute('title', TPL(ctx, 'Goedgekeurd op {d} door {naam}', { d: datumKort(ctx, s.approvedAt), naam: tekst(s.approvedBy) }));
      }
      return rij;
    });

    /* ---------- je contactpersoon ---------- */
    var contactKaart = kaart(ui, [
      ui.sectionHead({ titel: T(ctx, 'Je contactpersoon') }),
      contactBlok(ctx, ui, contact),
      ui.el('div', { style: 'margin-top:14px;' }, ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', text: T(ctx, 'Stel een vraag'),
        onclick: function () { deelNavigatie(ctx, { area: 'producten', id: project.id, tab: 'gesprek' }, T(ctx, 'Gesprek')); }
      }))
    ]);

    /* het dossier van een afgerond product heeft geen eigen kaart meer:
       Download alles is één knop in de uitgeklapte Kerngegevens van de rail
       (advies 18, downloadKnop hieronder) */
    return ui.el('div', null, [
      kaart(ui, [ui.sectionHead({ titel: T(ctx, 'Kerngegevens') }), raster]),
      ruimte(ui, 24),
      sectie(ui, ui.sectionHead({ titel: T(ctx, 'Fases en akkoorden'), telling: stages.length || undefined }), [
        akkoordRegel,
        stages.length ? ui.entityList(faseRijen) : ui.emptyTile({ icoon: 'projecten', titel: T(ctx, 'Nog geen fases') })
      ]),
      ruimte(ui, 24),
      contactKaart
    ]);
  };

  /* DOWNLOAD ALLES (advies 18): één knop, alleen bij een afgerond product.
     Het contract is downloadAlles; de knop is tijdens het wachten uit en
     meldt zijn stand in de live-regio. De langere uitleg staat achter de
     hulpknop (advies 1). Geen actie in het contract → geen knop (null). */
  var downloadKnop = function (ctx, ui) {
    var dl = actie(ctx, 'downloadAlles');
    if (!dl) return null;
    var regio = statusRegio(ui);
    var knop = ui.el('button', { type: 'button', class: 'u-btn ghost klein', text: T(ctx, 'Download alles') });
    knop.addEventListener('click', function () {
      knopBezig(knop, true, regio, T(ctx, 'Je dossier wordt samengesteld…'));
      Promise.resolve().then(function () { return dl(); }).then(function () {
        knopBezig(knop, false, regio, '');
        regio.textContent = T(ctx, 'Je dossier is gedownload.');
        toast(ctx, T(ctx, 'Je dossier is gedownload.'));
      }, function (err) {
        knopBezig(knop, false, regio, '');
        regio.textContent = foutZin(ctx, err);
        toast(ctx, foutZin(ctx, err));
      });
    });
    return ui.el('div', { class: 'k-dossier' }, [
      helpKnop(ctx, ui, T(ctx, 'Download alles geeft je een bestand met alles wat je in het portaal ziet: producten, documenten, facturen en gesprekken, zonder interne velden.'), knop),
      regio
    ]);
  };

  /* --- tab Tijdlijn: alles wat er rond dit product gebeurde ---
     De tijdlijn zelf is de bouwsteen CP_PORTAAL_SCHERMEN.activiteitBlok
     uit portaal-schermen-beheer.js: dezelfde rijen als het scherm
     Activiteit, beperkt tot dit project, nieuwste bovenaan. Dit bestand
     tekent hem niet na — één bron voor de tijdlijn, anders lopen de twee
     uit elkaar. De tafel wordt pas bij het tekenen bekeken (niet bij het
     laden), dus de laadvolgorde van de schermbestanden doet er niet toe;
     ontbreekt de bouwsteen, dan staat er de eerlijke lege stand en nooit
     een kapot scherm. */
  var tabTijdlijn = function (ctx, ui, project) {
    var vak = ui.el('div', { style: 'margin-top:14px;' });
    var leeg = function () {
      return ui.emptyTile({ icoon: 'activiteit', titel: T(ctx, 'De tijdlijn is nog niet beschikbaar.') });
    };
    var zet = function (node) {
      while (vak.firstChild) vak.removeChild(vak.firstChild);
      vak.appendChild(isNode(node) ? node : leeg());
    };
    var tafel = opt(root.CP_PORTAAL_SCHERMEN);
    var blok = fn(tafel.activiteitBlok);
    var uit = null;
    if (blok) {
      /* de bouwsteen is van een ander bestand: een fout dáárin mag dit
         scherm niet meenemen */
      try { uit = blok(ctx, { project: project, compact: true, max: 30 }); } catch (e) { uit = null; }
    }
    if (uit && !isNode(uit) && fn(uit.then)) {
      /* de signatuur belooft een element; komt er toch een Promise, dan
         vult het vak zich zodra die er is — tot die tijd de lege stand */
      vak.appendChild(leeg());
      uit.then(zet, function () { zet(null); });
    } else {
      zet(uit);
    }
    return kaart(ui, [
      ui.sectionHead({ titel: T(ctx, 'Tijdlijn') }),
      ui.el('p', { class: 'u-sub', style: 'margin:0;', 'data-no-i18n': '', text: TPL(ctx, 'Alles wat er rond {product} gebeurde, nieuwste bovenaan.', { product: tekst(project.name) }) }),
      vak
    ]);
  };

  /* ============================================================
     16. DE RAIL VAN HET PRODUCTDETAIL (spec 5.4, ronde 3 advies 24)

     Hoogstens twee kaarten. (1) "Wacht op jou": álle open acties van dit
     product, elk met haar ene knop en het paneel dat eronder openklapt —
     hetzelfde paneel als in de banner en op Overzicht (openItemActie); bij
     een afgerond product is dat de herbestelknop, of de stand van de
     lopende herbestelling. Niets open → geen kaart (de banner zegt het
     al). (2) Kerngegevens ingeklapt tot één regel (advies 23), uitgeklapt
     de vijf regels en, bij een afgerond product, de knop Download alles
     (advies 18). De productfoto is naar de held verhuisd (advies 21).
     ============================================================ */

  var productRail = function (ctx, ui, chart, project, b, reorders, bron, items) {
    var p = PM(ctx);
    bron = isObj(bron) ? bron : klantBron(ctx, { reorderRequests: lijst(reorders) });
    var stages = fasesVan(project, b.stages);
    var v = (p && fn(p.voortgang)) ? p.voortgang(project, stages)
      : { klaar: false, totaal: stages.length, afgerond: 0, huidigeFase: huidigeFase(stages) };
    var stand = productStand(ctx, project);
    var klaar = !!v.klaar || tekst(project.status) === 'archived';
    if (!Array.isArray(items)) {
      var mini = miniBundel(bron, project);
      if (!mini.stages.length) mini.stages = stages;
      items = nodigItems(ctx, mini);
    }
    var open = [], herbestel = null;
    lijst(items).forEach(function (it) {
      if (!it) return;
      if (it.kind === 'herbestel') { if (!herbestel) herbestel = it; return; }
      open.push(it);
    });
    var lopend = lopendeHerbestelling(ctx, reorders, tekst(project.id));
    var pijp = lopend ? pijplijnInhoud(ctx, ui, chart, lopend) : null;

    /* één item: stip, titel, bedrag/datum, de knop en het paneel eronder */
    var itemBlok = function (it, klasse, stip) {
      var vak = paneelVak(ui);
      vak.style.padding = '14px 0 0';
      var knop = ui.el('button', { type: 'button', class: klasse, text: itemKnop(ctx, it) });
      /* alleen een knop die een paneel opent draagt aria-expanded; een
         factuur of vraag navigeert weg */
      if (it.kind !== 'factuur' && it.kind !== 'vraag') knop.setAttribute('aria-expanded', 'false');
      knop.addEventListener('click', function () { openItemActie(ctx, it, project, bron, vak, knop); });
      var meta = [];
      if (typeof it.cents === 'number' && it.cents > 0) meta.push(bedragTekst(ctx, it.cents, it.valuta));
      if (it.datumISO) meta.push(datumKort(ctx, it.datumISO));
      return ui.el('div', { class: 'k-rail-item' }, [
        stip ? ui.el('div', { style: 'margin-bottom:8px;' }, stip) : null,
        ui.el('span', { class: 'u-row-title', style: 'font-size:17px;display:block;', 'data-no-i18n': '', text: itemTitel(ctx, it) }),
        meta.length ? ui.el('span', { class: 'u-datekicker', style: 'display:block;margin-top:8px;', 'data-no-i18n': '', text: meta.join(' · ').toUpperCase() }) : null,
        ui.el('div', { style: 'margin-top:12px;' }, knop),
        vak
      ]);
    };
    var stipVan = function (it) {
      return ui.statusDot({
        toon: it.urgent ? 'kritiek' : 'wacht',
        label: it.urgent
          ? (it.datumISO ? T(ctx, 'Vervaldatum verstreken') : T(ctx, 'Wacht al langer dan een week'))
          : T(ctx, 'Wacht op jou')
      });
    };

    var blokken = open.map(function (it, i) { return itemBlok(it, i === 0 ? 'u-btn breed' : 'u-btn ghost breed', open.length > 1 ? stipVan(it) : null); });
    /* de herbestelknop: primair als er niets anders wacht (advies 36),
       anders als ghost erachter — nooit verborgen achter iets anders */
    if (herbestel) blokken.push(itemBlok(herbestel, open.length ? 'u-btn ghost breed' : 'u-btn breed', null));
    var actieKaart = null;
    if (blokken.length || pijp) {
      var kopTitel = open.length ? T(ctx, 'Wacht op jou') : (herbestel ? T(ctx, 'Opnieuw bestellen') : T(ctx, 'Herbestelling loopt'));
      var kopStip = open.length ? stipVan(open[0]) : ui.statusDot({ toon: 'klaar', label: T(ctx, 'Afgerond') });
      var inhoud = [ui.el('div', { style: 'margin-bottom:10px;' }, kopStip)];
      if (blokken.length) {
        inhoud.push(ui.el('h2', { class: 'u-paneeltitel', style: 'font-size:18px;margin:0 0 12px;', text: kopTitel }));
        inhoud.push(stapel(ui, blokken, 18));
      }
      if (pijp) {
        if (blokken.length) inhoud.push(ruimte(ui, 18));
        inhoud = inhoud.concat(pijp);
      }
      actieKaart = kaart(ui, inhoud, 'k-rail-nodig');
      actieKaart.setAttribute('tabindex', '-1');
      /* het takje: §4.20 zet er één op het projectdetail; aria-hidden en weg
         onder 900px regelen CP_CHART.leafOrnament en admin-ui.css */
      if (chart && fn(chart.leafOrnament)) {
        actieKaart.classList.add('u-ornament-host');
        actieKaart.appendChild(chart.leafOrnament({ hoek: 'rechtsboven', maat: 120 }));
      }
    }

    /* ---------- kerngegevens, ingeklapt (advies 23) ----------
       <details>/<summary>: de summary is de ene regel 'CP-001 · gestart
       2 apr'; open of dicht wordt onthouden in localStorage (cp_kern_open).
       Uitgeklapt label links, waarde rechts (§5.4), en de knop Download
       alles bij een afgerond product (advies 18). */
    var faseWaarde = '';
    if (v.klaar) faseWaarde = TPL(ctx, 'Alle {t} fases zijn afgerond.', { t: stages.length });
    else if (v.huidigeFase) faseWaarde = TPL(ctx, 'Fase {n} van {t}', { n: getal(v.huidigeFase.position, faseIndex(stages, v.huidigeFase) + 1), t: stages.length });
    var kern = [
      { label: T(ctx, 'Projectcode'), waarde: tekst(project.code) },
      { label: T(ctx, 'Stand'), waarde: stand.woord },
      { label: T(ctx, 'Fase'), waarde: faseWaarde },
      { label: T(ctx, 'Gestart op'), waarde: datumKort(ctx, project.createdAt) },
      { label: T(ctx, 'Fabriek'), waarde: gekoppeldeFabrieken(project, b).map(function (f) { return tekst(f.name); }).join(', ') }
    ];
    var regelKort = samen([tekst(project.code), project.createdAt ? TPL(ctx, 'gestart {d}', { d: datumKort(ctx, project.createdAt) }) : '']);
    var samenvatting = ui.el('summary', { class: 'k-inklap-kop' }, [
      ui.el('span', { class: 'u-kicker', text: T(ctx, 'Kerngegevens') }),
      regelKort ? ui.el('span', { class: 'k-inklap-regel u-row-title', 'data-no-i18n': '', text: regelKort }) : null
    ]);
    var kernKaart = ui.el('details', { class: 'u-card k-inklap' }, [
      samenvatting,
      ui.el('div', { class: 'k-inklap-inhoud' }, kern.map(function (r) {
        return ui.el('div', null, [
          ui.el('span', { class: 'u-meta-label' }, ui.el('span', { text: r.label })),
          ui.el('span', { class: 'u-meta-waarde', 'data-no-i18n': '', text: tekst(r.waarde) || T(ctx, 'Nog niet bekend') })
        ]);
      })),
      klaar ? downloadKnop(ctx, ui) : null
    ]);
    if (geheugenLees(GEHEUGEN_KERN) === '1') {
      kernKaart.setAttribute('open', '');
      kernKaart.open = true;
    }
    kernKaart.addEventListener('toggle', function () { geheugenZet(GEHEUGEN_KERN, kernKaart.open ? '1' : '0'); });

    return ui.el('div', { class: 'u-cols-side' }, [
      ui.el('div', { class: 'u-sticky' }, [actieKaart, kernKaart])
    ]);
  };

  /* ============================================================
     17. EXPORT — deze lijst en het kopblok houden elkaar bij

     S.overzicht, S.producten en S.product staan hierboven al op de tafel
     (hoofdstuk 8, 9 en 10: elk haalt eerst zijn data en tekent dan). Wat
     hier nog bij komt is wat een test of een zoekbalk wil aanroepen — de
     tabsleutels en de twee rekenhulpjes — in dezelfde vorm als het
     slotblok van de andere twee schermbestanden.
     ============================================================ */
  S.PRODUCT_TABS = PRODUCT_TABS;
  S.tabLabel = tabLabel;
  S.aqlAccept = aqlAccept;
  /* voor de rooktest: de uitgestelde actie (advies 14) los van een paneel */
  S.uitgesteldeActie = uitgesteldeActie;

  /* zelfde reden als in admin-ui.js: geen "type":"module", dus in Node is
     dit CJS en is dit een echte export. Het factory-lichaam raakt bij het
     laden geen document aan — alle DOM-toegang zit binnen de schermen. */
  if (typeof module === 'object' && module && module.exports) {
    module.exports = {
      overzicht: S.overzicht,
      producten: S.producten,
      product: S.product,
      PRODUCT_TABS: PRODUCT_TABS,
      tabLabel: tabLabel,
      aqlAccept: aqlAccept,
      uitgesteldeActie: uitgesteldeActie
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
