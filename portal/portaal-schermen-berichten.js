/* CUSTOM+ — drie werkgebieden van het klantportaal: Berichten, Bestanden
   en Betalingen (window.CP_PORTAAL_SCHERMEN.berichten / .bestanden /
   .betalingen).
   ------------------------------------------------------------------
   WAT DIT BESTAND IS
   De klant-tegenhanger van drie wachtstanden die het beheer kent
   (.claude/portaal-spec.md, hoofdstuk 1): de gespreksdraad waarin de bal
   bij de klant ligt (regel 4), het documentslot dat "verwacht" zegt en de
   NNN-vastlegging (regels 5 en 13), en de gepubliceerde factuur met haar
   betaling en bezwaar (regels 3 en 14). Vandaag kon de klant hier één ding
   schrijven: een vraag stellen. Na dit bestand kan hij antwoorden in een
   draad, een nieuwe vraag stellen met productkeuze, een bestand in een
   verwacht slot aanleveren, zijn hele dossier downloaden, een betaling
   melden en een vraag (bezwaar) over een factuur stellen.

   WAT DIT BESTAND NIET IS
   Geen componentbibliotheek, geen tekenlaag, geen datalaag. Elke vorm komt
   uit CP_UI (portal/admin-ui.js), elke afleiding uit CP_PORTAAL
   (portal/portaal-model.js), elke schrijfactie loopt via ctx.acties (het
   actiecontract, gekoppeld aan CP_PORTAAL_DATA in portal.html). Dit bestand
   schrijft nergens zelf. Waar de opdracht een vorm vraagt waar CP_UI geen
   component voor heeft, is de dichtstbijzijnde bestaande vorm gebruikt en
   staat dat bij de plek zelf genoteerd:
     · de factuurrij (.u-invoicerow, met een toelichting onder het
       statuswoord) en de documentrij die zelf de download is (.u-row als
       één <button>, het entityRow-patroon zonder menu, met een pijl-omlaag
       in de rol van het chevronnetje) bestaan in admin-ui.css alleen als
       CSS; CP_UI.entityRow kent geen tweede regel in het statusslot en
       geen icoon naar keuze in de staart, dus die twee rijen zijn hier met
       CP_UI.el samengesteld — elk in één functie (documentRij, factuurRij),
       zodat ze naar CP_UI kunnen verhuizen zonder dat er ergens een tweede
       kopie achterblijft;
     · het fotoraster gebruikt .u-grid-3 met een kaartknop per foto — er
       is geen galerijcomponent.

   DE INHOUDELIJKE BRON IS portal.html
   renderUpdates (de losse vragen en aanvragen), threadBlock (de draad en
   het vraagformulier), renderDocs (documenten, slots), renderFactoryMap
   (de NNN-koppeling), renderInvoices, buildPayBox (de SEPA-QR via CP_QR)
   en renderCosts leveren de data, de eerlijkheidsteksten en de
   disclaimers. Alleen de VORM wordt de mockup. Waar een zin hieronder
   letterlijk uit portal.html komt, is dat met opzet: de sleutel bestaat
   dan al in portal/i18n.js in vier talen.

   MEERTALIG — DE AFSPRAAK DIE HET GROOTSTE DEEL VAN DIT BESTAND VERKLAART
   Elke klantzichtbare tekst is een NEDERLANDSE BRONSTRING die door
   ctx.i18nT / ctx.i18nTpl gaat (T() en TPL() hieronder). Bronstrings zijn
   hele zinnen met {plaatshouders}, nooit aan elkaar geplakte stukjes. Data
   (een vraagtekst, een factuurlabel, een documenttitel, een bedrag) gaat
   NIET door i18nT en krijgt data-no-i18n, precies zoals portal.html dat
   doet — anders probeert de DOM-pass van translateNode() een klantzin te
   vertalen. Huisstijl: geen koppeltekens in gebruikerstekst waar het niet
   hoeft.

   VIER DINGEN DIE HET SCHERM BEWUST ANDERS ZEGT DAN JE ZOU VERWACHTEN
   (regel 7 van de opdracht: verzin niets, beloof niets wat niet klopt)
     1. "Steffan krijgt hiervan een mail" STAAT ER NIET. De opdracht ging
        ervan uit dat de bestaande vraagfunctie een mail naar Steffan
        stuurt. In de code is dat niet zo: DS.addQuestion (demo én live)
        doet uitsluitend een insert in question_threads, er staat geen
        trigger op die tabel en geen Netlify-functie in dat pad (alleen
        notify-client, van beheer náár klant). Wat er WEL waar is: de vraag
        en het antwoord landen in de Inbox van het beheer als "wacht op
        mij". Dat zegt het scherm. Wil de eigenaar de mail, dan hoort daar
        eerst een trigger of functie voor te komen — zie het rapport.
     2. De betaal-QR wordt alleen getekend als er ECHT betaalgegevens zijn.
        ctx draagt vandaag geen IBAN (BILLING leeft als afgesloten variabele
        in portal.html). Dit bestand kijkt eerst naar ctx.billing (de haak
        die portal.html kan zetten), valt daarna terug op het betaalvak dat
        de oude sectie #invoices-list voor de open bundel al heeft getekend
        (letterlijk hergebruik van dezelfde QR, gekloond), en toont anders
        alleen het kenmerk. Nooit een QR die naar niets leidt.
     3. Foto's van andere producten dan het open product krijgen hun beeld
        alleen als de bron bereikbaar is (ctx.mediaUrl, een src, een
        fileRef via CP_FILES, of de al getekende foto in #updates-list).
        Live is een signed URL nodig en die kan dit bestand niet maken; de
        kaart houdt dan zijn neutrale tegel en blijft wél een echte knop
        naar het productdetail waar de foto staat.
     4. Documenten, slots en NNN-vastleggingen zitten alleen in de bundel
        van het OPEN product (het portfolio draagt ze niet). Bestanden toont
        voor de andere producten een rij die naar hun productdetail gaat —
        geen lege sectie die doet alsof er niets is.

   DE DRIE AFSPRAKEN VAN HET SCHERMCONTRACT
     · EEN SCHERM IS PUUR. Geen module-state; alles wat een tweede aanroep
       anders maakt staat in de route: ?item= (gekozen draad of factuur),
       ?nieuw=1 (het formulier voor een nieuwe vraag), ?actie=melden of
       ?actie=bezwaar (het formulier onder een factuur), ?fotos=alle,
       ?anker= (de oude diepe links '#/documenten@id' en '#/kosten@id').
     · ELKE KNOP ROEPT EEN ACTIE UIT ctx.acties AAN. Tijdens het wachten is
       de knop uitgeschakeld (aria-busy) en meldt een aria-live-regio naast
       het formulier zijn toestand; een verworpen Promise toont de
       Nederlandse boodschap via een toast én in die regio (voerUit()).
     · ES5, nooit innerHTML, commentaar in het Nederlands.

   TWEE SCHERMEN GEVEN EEN PROMISE VAN EEN NODE TERUG (de gastheer staat
   dat toe): Berichten haalt per draad de echte berichten op
   (CP_PORTAAL_DATA.listMessages — de bundel draagt question_messages niet,
   en zonder die rijen zou een gesprek waarin de klant ná het antwoord nog
   iets zei ten onrechte "beantwoord" heten), en Betalingen haalt per open
   factuur de gemelde betalingen op (listClientPayments), want "Betaling
   gemeld, Steffan controleert" staat nergens op de factuurrij zelf.

   RONDE 3 (klantentaal, minder tekst) — WAT ER IN DEZE RONDE BIJKWAM
     · Elke kaart hoogstens één zin; wat langer is staat achter een "i"-knop
       (uitleg(): CP_UI.helpHint zodra die bestaat, anders CP_UI.iconKnop
       met aria-expanded — geen nieuw component).
     · Geen mailadres meer in een klantzin: elke fout is kort en krijgt de
       knop "Vraag stellen", die het formulier voor een nieuwe vraag opent
       met het product gekozen en de eerste woorden ingevuld (?tekst=).
     · Bedragen via CP_PORTAAL.geldKlant ('€ 3.125') en datums via
       CP_PORTAAL.datumKort ('24 apr'), beide met de oude helpers als
       terugval zolang de modelagent ze nog bouwt.
     · Statuskleur alleen voor Open en Bezwaar; Betaald en Gemeld zijn grijs.
     · DE GEZIEN-MARKERING VAN BERICHTEN (voor de badge in portal.html):
       er bestaat geen leesmarkering per bericht (cp_portal_lastseen_* in
       portal.html telt media-id's, cp_portal_notif_seen_* is het
       belletje). Dit bestand zet daarom bij het tekenen van Berichten de
       localStorage-sleutel cp_portal_berichten_gezien_<klantId> op het
       tijdstip van dat bezoek (ctx.nu; niet in de voorvertoning) en
       CP_PORTAAL_SCHERMEN.ongelezenAntwoorden(ctx[, berichten]) telt de
       berichten van Steffan die nieuwer zijn dan dat tijdstip — uit de
       meegegeven rijen, bundle.questionMessages, portfolio.questionMessages
       en, voor een draad zonder rijen, het oude answer/answeredAt. Zonder
       sleutel (eerste bezoek) telt elk antwoord als ongelezen.

   LADEN
     browser : <script src="portal/portaal-schermen-berichten.js"></script>
               ná admin-ui.js, admin-charts.js, portaal-model.js en
               portaal-data.js (zie portal.html). Het bestand VULT
               window.CP_PORTAAL_SCHERMEN AAN en overschrijft het nooit.
     node    : require-baar; het factory-lichaam raakt geen DOM aan bij het
               laden — alle document-toegang zit binnen de schermen.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (!root.CP_PORTAAL_SCHERMEN) root.CP_PORTAAL_SCHERMEN = {};
  root.CP_PORTAAL_SCHERMEN.berichten = api.berichten;
  root.CP_PORTAAL_SCHERMEN.bestanden = api.bestanden;
  root.CP_PORTAAL_SCHERMEN.betalingen = api.betalingen;
  root.CP_PORTAAL_SCHERMEN.ongelezenAntwoorden = api.ongelezenAntwoorden;
  /* zelfde reden als in admin-ui.js: geen "type":"module", dus in Node is
     dit CJS en is dit een echte export */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.1.0';

  /* ============================================================
     0. KALE HULPJES EN DE CONTEXT
     ============================================================ */

  function arr(v) { return Array.isArray(v) ? v : []; }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function opt(v) { return isObj(v) ? v : {}; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function fn(v) { return typeof v === 'function' ? v : null; }
  function trim(v) { return str(v).replace(/^\s+|\s+$/g, ''); }

  var teller = 0;
  function uid(voorvoegsel) { teller++; return 'kp' + str(voorvoegsel) + teller; }

  /* de lagen, altijd via ctx en met de globale als terugval — een scherm
     dat in een test een eigen CP_UI meekrijgt, mag niet stil de globale
     pakken */
  function UI(ctx) { return (ctx && ctx.ui) || root.CP_UI || null; }
  function CH(ctx) { return (ctx && ctx.chart) || root.CP_CHART || null; }
  function POR(ctx) { return (ctx && ctx.portaal) || root.CP_PORTAAL || null; }
  function DATA(ctx) { return (ctx && ctx.data) || root.CP_PORTAAL_DATA || null; }
  function ACTIES(ctx) { return opt(ctx && ctx.acties); }
  function DOC() { return (root && root.document) ? root.document : null; }

  /* ---- vertalen: T() voor een hele zin, TPL() voor een sjabloon ----
     De bron is Nederlands; zonder i18nT (test) blijft het Nederlands. */
  function vul(tpl, vars) {
    return str(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars && vars[k] !== null && vars[k] !== undefined) ? String(vars[k]) : m;
    });
  }
  function T(ctx, s) {
    var f = fn(ctx && ctx.i18nT);
    return f ? str(f(s)) : str(s);
  }
  function TPL(ctx, s, vars) {
    var f = fn(ctx && ctx.i18nTpl);
    return f ? str(f(s, vars)) : vul(s, vars);
  }
  /* data mag de DOM-pass van translateNode() niet aanraken */
  function noI18n(node) {
    if (node && node.setAttribute) node.setAttribute('data-no-i18n', '');
    return node;
  }
  /* alle tekstdragers van een component die DATA tonen in één keer merken */
  function noI18nBinnen(node, selector) {
    if (!node || !node.querySelectorAll) return node;
    var lijst = node.querySelectorAll(selector);
    for (var i = 0; i < lijst.length; i++) noI18n(lijst[i]);
    return node;
  }

  /* ---- datum en tijd: in de taal van de klant, via de helpers van ctx ----
     Een kale dag gaat nooit zelf door new Date() (zie portaal-model.js);
     ctx.fmtDate kent dat verschil al. */
  var ISO_DAG_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  function pad2(n) { var s = String(n); return s.length < 2 ? '0' + s : s; }

  function dagISO(ctx, v) {
    var p = POR(ctx);
    if (p && fn(p.dayISO)) return p.dayISO(v);
    if (!v) return null;
    var s = str(v);
    if (ISO_DAG_RE.test(s)) return s;
    var d = (typeof v === 'object' && fn(v.getTime)) ? v : new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  /* het moment als getal, voor sorteren; null gaat achteraan */
  function ms(v) {
    if (!v) return null;
    var s = str(v);
    var m = s.match(ISO_DAG_RE);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var t = (typeof v === 'object' && fn(v.getTime)) ? v.getTime() : new Date(s).getTime();
    return isNaN(t) ? null : t;
  }
  function datum(ctx, v) {
    if (!v) return '';
    var f = fn(ctx && ctx.fmtDate);
    return f ? str(f(v)) : str(dagISO(ctx, v) || v);
  }
  /* '24 apr' (advies 6): CP_PORTAAL.datumKortDelen geeft dag, maandnaam en
     jaar los, zodat de maandnaam hier als bronstring door T() kan; daarna
     datumKort als geheel, en pas dan de oude helper van de shell. De
     modelagent bouwt die twee parallel, vandaar de trapsgewijze terugval. */
  function datumKort(ctx, v) {
    if (!v) return '';
    var p = POR(ctx);
    if (p && fn(p.datumKortDelen)) {
      var delen = null;
      try { delen = p.datumKortDelen(v, ctx && ctx.nu); } catch (e) { delen = null; }
      if (isObj(delen) && delen.dag) {
        return String(delen.dag) + ' ' + T(ctx, str(delen.maand)) + (delen.jaar ? ' ' + String(delen.jaar) : '');
      }
    }
    if (p && fn(p.datumKort)) {
      var kort = '';
      try { kort = str(p.datumKort(v, ctx && ctx.nu)); } catch (e2) { kort = ''; }
      if (kort) return kort;
    }
    var f = fn(ctx && ctx.fmtDateShort);
    return f ? str(f(v)) : datum(ctx, v);
  }
  function tijd(ctx, v) {
    if (!v) return '';
    var f = fn(ctx && ctx.fmtDateTime);
    return f ? str(f(v)) : str(v);
  }
  /* een tijdstip in een gesprek: de korte datum met uur en minuut erachter.
     De lange vorm van ctx.fmtDateTime ('8 september 2026, 10:00') verdwijnt
     uit dit scherm (advies 6); een kale dag krijgt geen tijd, want die zou
     de UTC-middernacht van new Date() zijn. */
  function momentKort(ctx, v) {
    if (!v) return '';
    var dag = datumKort(ctx, v);
    if (!dag) return tijd(ctx, v);
    if (ISO_DAG_RE.test(str(v))) return dag;
    var d = (typeof v === 'object' && fn(v.getTime)) ? v : new Date(str(v));
    if (isNaN(d.getTime())) return dag;
    return dag + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  /* GELD IS EEN GEHEEL GETAL IN CENTEN; de opmaak is die van de klant.
     Eerst CP_PORTAAL.geldKlant ('€ 3.125', centen alleen bij een niet-heel
     bedrag — advies 5), daarna ctx.fmtMoney (Intl in zijn taal en de valuta
     van het record) zolang de modelagent geldKlant nog bouwt. */
  function geld(ctx, cents, valuta) {
    var c = Math.round(Number(cents) || 0);
    var p = POR(ctx);
    if (p && fn(p.geldKlant)) {
      var k = '';
      try { k = str(p.geldKlant(c, valuta || 'EUR')); } catch (e) { k = ''; }
      if (k) return k;
    }
    var f = fn(ctx && ctx.fmtMoney);
    if (f) return str(f(c, valuta || 'EUR'));
    var ch = CH(ctx);
    if (ch && fn(ch.bedrag)) return ch.bedrag(c, { euro: (valuta || 'EUR') === 'EUR', decimalen: true });
    return String(c);
  }
  function jaarVan(ctx, v) {
    var iso = dagISO(ctx, v);
    return iso ? iso.slice(0, 4) : '';
  }

  /* stabiel sorteren: twee renders mogen nooit van volgorde wisselen */
  function sorteer(lijst, cmp) {
    var w = arr(lijst).map(function (v, i) { return { v: v, i: i }; });
    w.sort(function (a, b) { var r = cmp(a.v, b.v); return r || (a.i - b.i); });
    return w.map(function (x) { return x.v; });
  }
  function cmpText(a, b) { var x = str(a), y = str(b); return x === y ? 0 : (x < y ? -1 : 1); }
  /* nieuwste eerst; onbekende momenten achteraan */
  function cmpNieuwsteEerst(a, b) {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
  }

  /* de eerste regel van een tekst, afgekapt — voor een lijsttitel */
  function korte(s, n) {
    var t = trim(s).split(/\r?\n/)[0];
    var max = (typeof n === 'number' && n > 0) ? n : 90;
    if (t.length <= max) return t;
    return t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  }

  /* ---- route en navigatie ----
     ctx.ga(route, opties) is CP_SHELL.ga; de portaalrouter (portal.html)
     kent {area, id, tab, params}. Een deelnavigatie houdt de scrollpositie
     en de focus en meldt in de aria-live-regio van de shell wat er
     veranderde. */
  function navigeer(ctx, route, opties) {
    var g = fn(ctx && ctx.ga);
    if (!g) return;
    g(route, opt(opties));
  }
  function deel(ctx, route, melding) {
    navigeer(ctx, route, { behoudScroll: true, behoudFocus: true, melding: str(melding) });
  }
  function param(ctx, k) {
    var r = opt(ctx && ctx.route);
    var p = opt(r.params);
    return str(p[k]);
  }
  function ververs(ctx) {
    var v = fn(ctx && ctx.ververs);
    if (v) v();
  }

  /* ---- melden ----
     Een verworpen Promise geeft een Error met een Nederlandse zin (het
     actiecontract); CP_PORTAAL_DATA.berichtVoorFout maakt van élke fout
     zo'n zin. Daarna door i18nT. */
  function foutTekst(ctx, err) {
    var d = DATA(ctx);
    var zin = '';
    if (d && fn(d.berichtVoorFout)) zin = str(d.berichtVoorFout(err));
    /* kort en zonder mailadres (advies 10): de weg naar Steffan is de knop
       "Vraag stellen" naast de fout, niet een adres in de zin */
    if (!zin) zin = str(err && err.message) || 'Dat lukte niet. Probeer het opnieuw.';
    return T(ctx, zin);
  }
  /* actie: {label, onKies} — CP_UI.toast zet er dan een knop in de pil bij */
  function toast(ctx, tekst, actie) {
    var ui = UI(ctx);
    if (ui && fn(ui.toast)) { ui.toast(tekst, isObj(actie) ? { actie: actie } : undefined); return; }
    var m = fn(ctx && ctx.meld);
    if (m) m(tekst);
  }
  function zetTekst(node, tekst) {
    if (!node) return;
    /* eerst legen: dezelfde zin twee keer achter elkaar wordt anders niet
       als wijziging gezien en dus niet uitgesproken */
    node.textContent = '';
    if (str(tekst)) node.textContent = str(tekst);
  }

  /* ---- vorm ----
     admin-ui.css kent geen binnenmargeklasse voor een kaart met vrije
     inhoud; de marge staat hier op PRECIES ÉÉN plek inline (zelfde keuze
     als in admin-schermen-werk.js), zodat hij in één regel naar CSS kan. */
  function kaart(ui, kinderen, klasse) {
    return ui.el('div', { class: 'u-card' + (str(klasse) ? ' ' + str(klasse) : ''), style: 'padding:20px 22px;' }, arr(kinderen));
  }
  function sectie(ui, kop, kinderen, klasse) {
    return ui.el('section', { class: 'u-section' + (str(klasse) ? ' ' + str(klasse) : '') }, [kop].concat(arr(kinderen)));
  }
  function stapel(ui, kinderen, gap) {
    var g = (typeof gap === 'number' && gap >= 0) ? gap : 16;
    return ui.el('div', { style: 'display:flex;flex-direction:column;gap:' + g + 'px;' }, arr(kinderen));
  }
  function ruimte(ui, px) {
    var p = (typeof px === 'number' && px > 0) ? px : 20;
    return ui.el('div', { 'aria-hidden': 'true', style: 'height:' + p + 'px;' });
  }
  function lees(ui, tekst, klasse) {
    return ui.el('p', { class: str(klasse) || 'u-lees', text: str(tekst) });
  }
  function sub(ui, tekst) {
    return ui.el('p', { class: 'u-sub', text: str(tekst) });
  }

  /* label bóven het veld (mockupspec 5.10): .field/.flabel/.input bestaan
     alle drie en staan binnen .u-shell op de mockupmaten. CP_UI heeft geen
     veldbouwer; deze staat hier één keer. */
  function veldVak(ui, label, control, hint) {
    return ui.el('label', { class: 'field' }, [
      ui.el('span', { class: 'flabel', text: str(label) }),
      control,
      str(hint) ? ui.el('span', { class: 'u-sub', style: 'display:block;margin-top:6px;', text: str(hint) }) : null
    ]);
  }
  /* de aria-live-regio naast een formulier: de knop meldt hier zijn
     toestand (bezig, gelukt, mislukt) */
  function liveRegio(ui) {
    return ui.el('p', { class: 'u-sub', role: 'status', 'aria-live': 'polite', style: 'min-height:1.4em;margin-top:8px;' });
  }

  /* DE "i"-KNOP (advies 1). Elke kaart hoogstens één zin; wat langer is
     staat hierachter. CP_UI.helpHint wint zodra hij bestaat; tot die tijd
     het bestaande knop-met-aria-expanded-patroon op CP_UI.iconKnop (het
     vraagteken is het enige uitleg-icoon dat CP_UI kent). Geen zwevende
     popover en geen nieuw component: de zin klapt onder de knop uit, het
     hidden-attribuut doet het verbergen (portaal-skin.css: [hidden]).
       zin   : de ene zichtbare zin (mag leeg zijn: dan alleen de knop)
       meer  : de langere uitleg achter de knop
       waarover: waar de knop over gaat, voor het aria-label */
  function uitleg(ctx, ui, zin, meer, waarover) {
    var kort = str(zin), lang = str(meer);
    if (!lang) return kort ? sub(ui, kort) : null;
    var label = str(waarover) ? TPL(ctx, 'Uitleg over {x}', { x: str(waarover) }) : T(ctx, 'Meer uitleg');
    var kortNode = kort ? ui.el('p', { class: 'u-sub', text: kort }) : null;
    var knop = null;
    if (fn(ui.helpHint)) {
      try { knop = ui.helpHint({ tekst: lang, label: label }); } catch (e) { knop = null; }
      if (knop) {
        return ui.el('div', { class: 'k-uitleg' }, [
          ui.el('div', { class: 'k-uitleg-kop' }, [kortNode, knop])
        ]);
      }
    }
    var id = uid('uitleg');
    var meerNode = ui.el('p', { class: 'u-sub k-uitleg-tekst', id: id, text: lang });
    meerNode.hidden = true;
    knop = ui.iconKnop('vraagteken', label, function () {
      var open = !!meerNode.hidden;
      meerNode.hidden = !open;
      knop.setAttribute('aria-expanded', open ? 'true' : 'false');
    }, 'k-uitleg-knop');
    knop.setAttribute('aria-expanded', 'false');
    knop.setAttribute('aria-controls', id);
    return ui.el('div', { class: 'k-uitleg' }, [
      ui.el('div', { class: 'k-uitleg-kop' }, [kortNode, knop]),
      meerNode
    ]);
  }

  /* DE KNOP "VRAAG STELLEN" (advies 10). Geen mailadres in een foutzin: de
     weg naar Steffan is de bestaande vraag-weg van dit bestand — het
     formulier voor een nieuwe vraag, met het product al gekozen en de
     eerste woorden ingevuld (?tekst=, gelezen door nieuweVraagPaneel). De
     route draagt die twee, want een scherm is puur. */
  function vraagRoute(projectId, tekst) {
    return { area: 'berichten', params: { nieuw: '1', product: str(projectId) || null, tekst: str(tekst) || null } };
  }
  function vraagActie(ctx, projectId, tekst) {
    return { label: T(ctx, 'Vraag stellen'), onKies: function () { navigeer(ctx, vraagRoute(projectId, tekst)); } };
  }
  function vraagKnop(ctx, ui, projectId, tekst) {
    return ui.el('button', {
      type: 'button', class: 'u-btn ghost klein', text: T(ctx, 'Vraag stellen'),
      onclick: function () { navigeer(ctx, vraagRoute(projectId, tekst)); }
    });
  }
  /* de eerste woorden van een vraag over een factuur: 'Over factuur 2026-001: ' */
  function overFactuur(ctx, inv) {
    return TPL(ctx, 'Over factuur {nummer}: ', { nummer: str(inv && inv.invoiceNumber) || str(inv && inv.label) });
  }
  function overOnderwerp(ctx, onderwerp) {
    return TPL(ctx, 'Over {onderwerp}: ', { onderwerp: str(onderwerp) });
  }

  /* de voornaam uit een volledige naam ('Steffan Bakker' → 'Steffan') */
  function voornaam(naam) { return trim(naam).split(/\s+/)[0] || ''; }

  /* DE GEZIEN-MARKERING VAN BERICHTEN (advies 16, zie kopblok): één
     tijdstip per klant in localStorage, gezet bij het tekenen van
     Berichten. Geen opslag (Node, privémodus) betekent: niets gezien. */
  var GEZIEN_SLEUTEL = 'cp_portal_berichten_gezien_';
  function opslag() {
    try { return (root && root.localStorage) ? root.localStorage : null; } catch (e) { return null; }
  }
  function gezienSleutel(ctx) {
    return GEZIEN_SLEUTEL + (str(opt(ctx && ctx.klant).id) || 'anoniem');
  }
  function berichtenGezienOp(ctx) {
    var s = opslag();
    if (!s) return 0;
    try {
      var v = s.getItem(gezienSleutel(ctx));
      return v ? (parseInt(v, 10) || 0) : 0;
    } catch (e) { return 0; }
  }
  function markeerBerichtenGezien(ctx) {
    /* de voorvertoning laat de stand van de klant intact — zelfde regel als
       readSeenIds/notifMarkSeen in portal.html */
    if (voorvertoning(ctx)) return;
    var s = opslag();
    if (!s) return;
    var nu = ms(ctx && ctx.nu);
    if (nu === null) nu = new Date().getTime();
    try { s.setItem(gezienSleutel(ctx), String(nu)); } catch (e) { /* privémodus */ }
  }
  /* de rijen van alle draden, ontdubbeld op id — de meegegeven rijen winnen */
  function alleBerichtRijen(ctx, berichten) {
    return samenvoeg(samenvoeg(portfolio(ctx).questionMessages, bundel(ctx).questionMessages), berichten);
  }
  function ongelezenAntwoorden(ctx, berichten) {
    var gezien = berichtenGezienOp(ctx);
    var rijen = alleBerichtRijen(ctx, berichten);
    var n = 0;
    alleVragen(ctx).forEach(function (q) {
      var vanDraad = rijen.filter(function (m) { return str(m.questionId) === str(q.id) && str(m.body); });
      /* een draad zonder rijen: het oude antwoord is dan de ene beurt van Steffan */
      if (!vanDraad.length && q.answer && q.answeredAt) vanDraad = [{ author: 'staff', createdAt: q.answeredAt, body: q.answer }];
      vanDraad.forEach(function (m) {
        if (m.author === 'client') return;
        var t = ms(m.createdAt);
        if (t !== null && t > gezien) n++;
      });
    });
    return n;
  }

  /* In de voorvertoning (de eigenaar kijkt mee als klant) weigert kSchrijf
     elke schrijfactie; een knop die dan klikbaar staat, belooft iets wat
     niet kan. Uitgeschakeld mét uitleg is eerlijker. De zin is die van
     portal.html zelf (kSchrijf), dus de sleutel bestaat al. */
  var VOORVERTONING_ZIN = 'In de voorvertoning kun je niets wijzigen. Sluit dit tabblad om terug te gaan naar het beheer.';
  function voorvertoning(ctx) { return !!(ctx && ctx.voorvertoning); }
  function voorvertoningNoot(ctx, ui) {
    if (!voorvertoning(ctx)) return null;
    return sub(ui, T(ctx, VOORVERTONING_ZIN));
  }
  function schrijfKnop(ctx, ui, opts) {
    var o = opt(opts);
    var uit = voorvertoning(ctx);
    return ui.el('button', {
      type: str(o.type) || 'button',
      class: 'u-btn' + (str(o.klasse) ? ' ' + str(o.klasse) : ''),
      text: str(o.label),
      disabled: uit,
      title: uit ? T(ctx, VOORVERTONING_ZIN) : null,
      onclick: fn(o.onClick) || null
    });
  }

  /* DE ENE WEG VOOR ELKE SCHRIJFACTIE.
     Knop uit en aria-busy, de regio zegt "bezig", dan de actie; bij succes
     een toast plus de regio, bij een fout de Nederlandse boodschap via
     toast én regio. De knop komt altijd terug — ook na een fout — anders
     kan de klant het niet opnieuw proberen. */
  function voerUit(ctx, knop, regio, maak, opties) {
    var o = opt(opties);
    if (!knop || knop.disabled) return Promise.resolve(null);
    knop.disabled = true;
    knop.setAttribute('aria-busy', 'true');
    zetTekst(regio, T(ctx, str(o.bezig) || 'Bezig met versturen…'));
    var p;
    try { p = maak(); } catch (e) { p = Promise.reject(e); }
    function terug() {
      knop.disabled = false;
      knop.removeAttribute('aria-busy');
    }
    return Promise.resolve(p).then(function (rij) {
      terug();
      var zin = T(ctx, str(o.klaar) || 'Verstuurd.');
      zetTekst(regio, zin);
      toast(ctx, zin);
      if (fn(o.daarna)) o.daarna(rij);
      return rij;
    }, function (err) {
      terug();
      var zin = foutTekst(ctx, err);
      zetTekst(regio, zin);
      /* o.vraag = {product, tekst}: dan krijgt de foutpil de knop "Vraag
         stellen" (advies 10) in plaats van een mailadres in de zin */
      toast(ctx, zin, isObj(o.vraag) ? vraagActie(ctx, o.vraag.product, o.vraag.tekst) : null);
      if (root.console && fn(root.console.error)) root.console.error(err);
      return null;
    });
  }

  /* ---- de gegevens van de klant, over ALLE producten ----
     portal.html geeft twee vormen mee: de bundel (het open product, met
     alles erin) en het portfolio (alle producten met hun media, samples,
     facturen, vragen en zendingen). Waar beide dezelfde rij dragen wint de
     bundel: die is het verst bijgewerkt na een klantactie. */
  function bundel(ctx) { return opt(ctx && ctx.bundle); }
  function portfolio(ctx) { return opt(ctx && ctx.portfolio); }

  function samenvoeg(eerst, wint) {
    var uit = [], idx = {};
    arr(eerst).forEach(function (r) { if (isObj(r) && r.id) { idx[r.id] = uit.length; uit.push(r); } });
    arr(wint).forEach(function (r) {
      if (!isObj(r) || !r.id) return;
      if (idx[r.id] !== undefined) uit[idx[r.id]] = r;
      else { idx[r.id] = uit.length; uit.push(r); }
    });
    return uit;
  }
  function projecten(ctx) {
    var b = bundel(ctx);
    var lijst = samenvoeg(ctx && ctx.projecten, portfolio(ctx).projects);
    if (isObj(b.project) && b.project.id) lijst = samenvoeg(lijst, [b.project]);
    return lijst;
  }
  function projectVan(ctx, id) {
    var uit = null;
    projecten(ctx).forEach(function (p) { if (str(p.id) === str(id)) uit = p; });
    return uit;
  }
  function projectNaam(ctx, id) {
    var p = projectVan(ctx, id);
    return p ? str(p.name || p.title || p.code || p.id) : '';
  }
  function alleVragen(ctx) { return samenvoeg(portfolio(ctx).questions, bundel(ctx).questions); }
  function alleFacturen(ctx) {
    return samenvoeg(portfolio(ctx).invoices, bundel(ctx).invoices).filter(function (inv) {
      /* een concept bereikt de klant nooit (conceptGate); deze poort staat
         er voor het geval een rij toch met publishStatus 'concept' binnenkomt */
      return str(inv.publishStatus) !== 'concept';
    });
  }
  function alleMedia(ctx) {
    return samenvoeg(portfolio(ctx).media, bundel(ctx).media).filter(function (m) { return !m._concept; });
  }
  function faseNaam(ctx, key) {
    var f = fn(ctx && ctx.stageLabel);
    var k = str(key);
    if (!k) return '';
    if (f) { try { return str(f(k)) || k; } catch (e) { return k; } }
    return k;
  }
  function isDemo(ctx) {
    var d = DATA(ctx);
    if (d && fn(d.modus)) return d.modus() === 'demo';
    return false;
  }
  function klantNaam(ctx) { return str(opt(ctx && ctx.klant).naam); }
  function klantBedrijf(ctx) { return str(opt(ctx && ctx.klant).bedrijf); }

  /* de betekeniskleur van de statusvertaler → de toonnamen van CP_UI.
     Advies 27: alleen Open (warn) en Bezwaar houden kleur; Betaald, Gemeld
     en een gesloten factuur zijn grijs — de modelagent zet daar 'muted', en
     deze terugval doet hetzelfde voor een oudere statusvertaler. */
  var TOON = { ok: 'klaar', warn: 'wacht', crit: 'kritiek', info: 'extern', muted: 'neutraal' };
  function toonVan(st) {
    var s = opt(st);
    if (s.betaald || s.gemeld || s.gesloten) return 'neutraal';
    return TOON[str(s.toon)] || 'neutraal';
  }

  /* een element uit de OUDE sectie van portal.html opzoeken. De dertien
     renderfuncties tekenen nog steeds (renderAllSections), verborgen
     achter het nieuwe scherm; wat daar al staat — een betaal-QR, een
     opgeloste foto-URL, een downloadknop met de hele bestaande keten
     erachter — wordt hier hergebruikt in plaats van nagebouwd. */
  function cssId(id) { return str(id).replace(/["\\]/g, '\\$&'); }
  function oudElement(selector) {
    var d = DOC();
    if (!d || !d.querySelector) return null;
    try { return d.querySelector(selector); } catch (e) { return null; }
  }

  /* het venster dat een PDF gaat tonen wordt SYNCHROON geopend, vóór de
     Promise — een popupblokkering treft alles wat pas ná een await opent.
     Komt er geen bestand, dan gaat het venster weer dicht en zegt de toast
     waarom. */
  function openNaBelofte(ctx, belofte, opties) {
    var o = opt(opties);
    var w = null;
    /* o.vraag = {product, tekst}: de foutpil krijgt de knop "Vraag stellen"
       waar de klant zelf niets kan doen (advies 10) */
    var actie = isObj(o.vraag) ? vraagActie(ctx, o.vraag.product, o.vraag.tekst) : null;
    try { w = root.open ? root.open('', '_blank', 'noopener') : null; } catch (e) { w = null; }
    return Promise.resolve(belofte).then(function (uit) {
      var u = opt(uit);
      if (u.beschikbaar && str(u.url)) {
        if (w) { try { w.location = u.url; return uit; } catch (e) { /* valt door naar hieronder */ } }
        try { root.open(u.url, '_blank', 'noopener'); } catch (e2) { /* stil */ }
        return uit;
      }
      if (w) { try { w.close(); } catch (e3) { /* stil */ } }
      toast(ctx, T(ctx, redenTekst(u.reden) || str(o.leeg) || 'Het bestand wordt nog toegevoegd.'), REDEN_MET_VRAAG[str(u.reden)] ? actie : null);
      return uit;
    }, function (err) {
      if (w) { try { w.close(); } catch (e4) { /* stil */ } }
      toast(ctx, foutTekst(ctx, err), actie);
      return null;
    });
  }
  /* de redenen van CP_PORTAAL_DATA.factuurPdf, elk als één korte zin zonder
     mailadres (advies 10); waar de klant zelf niets kan, komt de knop
     "Vraag stellen" in de pil (REDEN_MET_VRAAG) */
  var REDENEN = {
    geen_document: 'Er is nog geen factuurdocument. Zodra Steffan het toevoegt, staat het hier.',
    pdf_volgt: 'Het bestand staat er nog niet bij. Zodra Steffan het toevoegt, verschijnt de download hier.',
    bestand_niet_in_deze_browser: 'Dit bestand staat alleen in de browser van de computer waarop het is geüpload.',
    ophalen_mislukt: 'Het bestand kon nu niet worden opgehaald. Probeer het over een minuut opnieuw.'
  };
  var REDEN_MET_VRAAG = { bestand_niet_in_deze_browser: true, ophalen_mislukt: true };
  function redenTekst(code) { return REDENEN[str(code)] || ''; }

  /* ============================================================
     1. BERICHTEN — alle draden over alle producten, lijst met detail
     ============================================================ */

  /* wie sprak het laatst: CP_PORTAAL.laatsteBeurt leest de echte berichten
     en valt zonder die rijen terug op de twee oude kolommen */
  function laatsteBeurt(ctx, q, berichten) {
    var p = POR(ctx);
    if (p && fn(p.laatsteBeurt)) return p.laatsteBeurt(q, arr(berichten));
    var lijst = arr(berichten).filter(function (m) { return isObj(m) && str(m.body); });
    if (!lijst.length) {
      if (q.answer && q.answeredAt) return { author: 'staff', at: q.answeredAt, body: str(q.answer) };
      if (q.question) return { author: 'client', at: q.askedAt, body: str(q.question) };
      return null;
    }
    var l = lijst[lijst.length - 1];
    return { author: l.author === 'client' ? 'client' : 'staff', at: l.createdAt || null, body: str(l.body) };
  }

  function schermBerichten(ctx) {
    var ui = UI(ctx);
    if (!ui) throw new Error('CP_UI ontbreekt.');
    var d = DATA(ctx);
    var vragen = alleVragen(ctx);

    /* per draad de echte berichten (zie kopblok). Een mislukte ophaling
       laat de draad niet uit de lijst vallen: dan tellen de oude kolommen. */
    var laders = vragen.map(function (q) {
      if (!d || !fn(d.listMessages)) return Promise.resolve(null);
      var p;
      try { p = d.listMessages(q); } catch (e) { p = null; }
      return Promise.resolve(p).then(function (rijen) { return arr(rijen); }, function () { return null; });
    });
    /* wie Steffan is (advies 34): de contactpersoon bij CUSTOM+ uit de
       datalaag — naam en, als die er is, zijn foto. Zonder datalaag of bij
       een mislukte lezing: de naam die dit bestand al kende, met initialen. */
    var contactLader = Promise.resolve(null);
    if (d && fn(d.mijnContact)) {
      var pc;
      try { pc = d.mijnContact(bundel(ctx).project); } catch (e) { pc = null; }
      contactLader = Promise.resolve(pc).then(function (c) { return isObj(c) ? c : null; }, function () { return null; });
    }

    return Promise.all([Promise.all(laders), contactLader]).then(function (uit) {
      var draden = uit[0], contact = uit[1];
      var items = vragen.map(function (q, i) {
        var l = laatsteBeurt(ctx, q, draden[i]);
        return {
          q: q,
          berichten: draden[i],
          laatste: l,
          /* "Steffan wacht op je": het laatste bericht is van hem */
          wachtOpJou: !!(l && l.author === 'staff'),
          bijSteffan: !!(l && l.author === 'client'),
          moment: l ? ms(l.at) : ms(q.askedAt)
        };
      });
      items = sorteer(items, function (a, b) {
        var r = cmpNieuwsteEerst(a.moment, b.moment);
        if (r) return r;
        return cmpText(a.q.id, b.q.id);
      });
      return tekenBerichten(ctx, ui, items, contact);
    });
  }

  function tekenBerichten(ctx, ui, items, contact) {
    /* de klant ziet nu zijn berichten: vanaf dit moment telt alleen wat
       nieuwer is als ongelezen (advies 16, zie kopblok) */
    markeerBerichtenGezien(ctx);
    var gekozenId = param(ctx, 'item');
    var nieuw = param(ctx, 'nieuw') === '1';
    var uitRoute = null;
    items.forEach(function (it) { if (str(it.q.id) === gekozenId) uitRoute = it; });
    /* bij binnenkomst staat de eerste draad open (zelfde regel als de
       Inbox van het beheer): afleidbaar uit de route, dus geen navigatie */
    var gekozen = nieuw ? null : (uitRoute || (items.length ? items[0] : null));

    var wachtend = 0;
    items.forEach(function (it) { if (it.wachtOpJou) wachtend++; });

    var bijzin = '';
    if (wachtend === 1) bijzin = T(ctx, '1 gesprek wacht op je');
    else if (wachtend > 1) bijzin = TPL(ctx, '{n} gesprekken wachten op je', { n: wachtend });

    var kop = ui.pageHeader({
      titel: T(ctx, 'Berichten'),
      bijzin: bijzin,
      primair: {
        label: T(ctx, 'Nieuwe vraag'),
        ico: 'plus',
        onClick: function () {
          deel(ctx, { area: 'berichten', params: { nieuw: '1', item: gekozenId || null } }, T(ctx, 'Nieuwe vraag'));
        }
      }
    });

    /* ---------- de lijst ---------- */
    var rijen = items.map(function (it) {
      var q = it.q;
      var stip;
      if (it.wachtOpJou) stip = ui.statusDot({ toon: 'wacht', label: T(ctx, 'Steffan wacht op je') });
      else if (it.bijSteffan) stip = ui.statusDot({ toon: 'extern', label: T(ctx, 'Ligt bij Steffan') });
      else stip = null;
      var product = projectNaam(ctx, q.projectId);
      var wanneer = it.laatste ? momentKort(ctx, it.laatste.at) : momentKort(ctx, q.askedAt);
      var rij = ui.entityRow({
        thumb: ui.iconTile({ icoon: 'mail', toon: it.wachtOpJou ? 'wacht' : (it.bijSteffan ? 'extern' : 'neutraal'), maat: 40 }),
        titel: korte(q.question, 90),
        sub: [product, wanneer].filter(function (x) { return !!x; }).join(' · '),
        chips: stip ? [stip] : [],
        chevron: false,
        onOpen: function () {
          deel(ctx, { area: 'berichten', params: { item: q.id } }, TPL(ctx, 'Geopend: {titel}', { titel: korte(q.question, 60) }));
        }
      });
      /* de vraagtekst en de productnaam zijn data */
      noI18nBinnen(rij, '.u-row-title, .u-row-sub');
      if (gekozen && gekozen.q.id === q.id) {
        rij.classList.add('gekozen');
        rij.setAttribute('aria-current', 'true');
      }
      return rij;
    });

    var lijstNode = ui.el('div', { role: 'region', 'aria-label': T(ctx, 'Gesprekken') }, [
      ui.entityList(rijen, {
        /* lege staat in één regel (advies 9): het woord en de knop */
        leeg: ui.emptyState({
          kaal: true,
          titel: T(ctx, 'Nog geen gesprekken'),
          actie: { label: T(ctx, 'Nieuwe vraag'), onClick: function () { deel(ctx, { area: 'berichten', params: { nieuw: '1' } }, T(ctx, 'Nieuwe vraag')); } }
        })
      })
    ]);

    /* ---------- het detail ---------- */
    var detail;
    if (nieuw) detail = nieuweVraagPaneel(ctx, ui, gekozenId);
    else if (gekozen) detail = draadPaneel(ctx, ui, gekozen, contact);
    else detail = ui.el('div', { class: 'u-hero' }, ui.emptyTile({
      icoon: 'inbox',
      titel: T(ctx, 'Kies een gesprek')
    }));

    var md = ui.masterDetail({
      lijst: lijstNode,
      detail: detail,
      detailLabel: nieuw ? T(ctx, 'Nieuwe vraag') : (gekozen ? korte(gekozen.q.question, 60) : T(ctx, 'Gesprek')),
      /* alleen een ECHTE keuze uit de route schuift op een telefoon het
         paneel over de lijst; de terugval naar de eerste draad doet dat niet */
      detailOpen: !!(uitRoute || nieuw),
      onSluitDetail: function () {
        deel(ctx, { area: 'berichten', params: {} }, T(ctx, 'Terug naar de lijst'));
      }
    });

    var wortel = ui.el('div', null, [kop, md.el]);
    /* de gastheer roept node.stop() aan zodra het scherm verdwijnt; zonder
       deze doorgifte blijft de luisteraar op de mediaquery hangen */
    wortel.stop = function () { md.stop(); };
    return wortel;
  }

  /* de berichten van een draad in de vorm die CP_UI.thread verwacht. Vanuit
     de klant gezien zijn ZIJN berichten "Jij" en die van Steffan "CUSTOM+";
     thread() zet dat woord als chip naast de naam, zodat het verschil nooit
     alleen van kleur afhangt. */
  function draadBerichten(ctx, it, contact) {
    var q = it.q;
    var lijst = arr(it.berichten);
    if (!lijst.length) {
      if (q.question) lijst.push({ author: 'client', authorName: '', body: q.question, createdAt: q.askedAt });
      if (q.answer) lijst.push({ author: 'staff', authorName: '', body: q.answer, createdAt: q.answeredAt || q.askedAt });
    }
    /* Steffan bij elk bericht (advies 34): de volledige naam gaat naar
       thread() — daar komen de initialen en het aria-label van de avatar
       uit — en zijn foto als de datalaag er een heeft; draadPaneel maakt
       van de getoonde naam daarna zijn voornaam */
    var c = isObj(contact) ? contact : null;
    var steffanNaam = (c && str(c.name)) || 'Steffan Bakker';
    var steffanFoto = c ? str(c.avatarUrl) : '';
    return lijst.filter(function (m) { return isObj(m) && str(m.body); }).map(function (m) {
      var vanKlant = m.author === 'client';
      return {
        auteur: vanKlant ? (str(m.authorName) || klantNaam(ctx) || T(ctx, 'Jij')) : (str(m.authorName) || steffanNaam),
        organisatie: vanKlant ? klantBedrijf(ctx) : 'CUSTOM+',
        tekst: str(m.body),
        at: m.createdAt || null,
        avatarUrl: vanKlant ? '' : steffanFoto,
        vanKlant: vanKlant
      };
    });
  }

  function draadPaneel(ctx, ui, it, contact) {
    var q = it.q;
    var product = projectNaam(ctx, q.projectId);
    var kicker = [T(ctx, 'Gesprek'), product, q.stageKey ? faseNaam(ctx, q.stageKey) : ''].filter(function (x) { return !!x; }).join(' · ');

    var titel = ui.el('h2', { style: 'font-size:24px;font-weight:500;letter-spacing:-.012em;line-height:1.25;' }, str(korte(q.question, 140)));
    noI18n(titel);

    var stand;
    if (it.wachtOpJou) stand = ui.statusChip({ label: T(ctx, 'Steffan wacht op je'), toon: 'wacht' });
    else if (it.bijSteffan) stand = ui.statusChip({ label: T(ctx, 'Ligt bij Steffan'), toon: 'extern' });
    else stand = null;

    var kopRegel = ui.el('div', { class: 'u-hero-kop' }, [
      ui.el('div', null, [
        noI18n(ui.el('span', { class: 'u-kicker', text: kicker })),
        titel,
        ui.el('p', { class: 'u-sub', style: 'margin-top:6px;', text: TPL(ctx, 'Gesteld op {datum}', { datum: datumKort(ctx, q.askedAt) }) })
      ]),
      stand
    ]);

    var draad = ui.thread({
      berichten: draadBerichten(ctx, it, contact),
      klantLabel: T(ctx, 'Jij'),
      eigenLabel: 'CUSTOM+',
      formatteerTijd: function (at) { return momentKort(ctx, at); },
      leegTekst: T(ctx, 'Nog geen berichten')
    });
    /* namen, organisaties en de berichttekst zijn data */
    noI18nBinnen(draad, '.u-thread-naam, .u-thread-org, .u-thread-tekst');
    /* bij een bericht van Steffan staat zijn voornaam (advies 34); de avatar
       houdt de volledige naam als aria-label en als bron van de initialen */
    var berichtNodes = draad.querySelectorAll ? draad.querySelectorAll('.u-thread-item') : [];
    for (var bi = 0; bi < berichtNodes.length; bi++) {
      var bn = berichtNodes[bi];
      if (!bn.classList || !bn.classList.contains('van-ons')) continue;
      var naamNode = bn.querySelector ? bn.querySelector('.u-thread-naam') : null;
      if (naamNode && voornaam(naamNode.textContent)) naamNode.textContent = voornaam(naamNode.textContent);
    }

    /* een link naar het product waar het gesprek over gaat: de foto of de
       fase staat daar, niet hier */
    var productLink = null;
    if (q.projectId && product) {
      productLink = ui.el('button', {
        type: 'button', class: 'u-link',
        onclick: function () { navigeer(ctx, { area: 'producten', id: q.projectId, tab: 'gesprek' }); }
      }, [ui.el('span', { text: TPL(ctx, 'Bekijk {product}', { product: product }) }), ui.icon('chevron', 15)]);
      noI18n(productLink);
    }

    return ui.el('div', { class: 'u-hero' }, [
      kopRegel,
      draad,
      ruimte(ui, 20),
      antwoordFormulier(ctx, ui, q),
      productLink ? ruimte(ui, 14) : null,
      productLink
    ]);
  }

  /* het antwoordveld in een bestaande draad → ctx.acties.berichtSturen */
  function antwoordFormulier(ctx, ui, q) {
    var id = uid('antwoord');
    var ta = ui.el('textarea', {
      class: 'input', id: id, rows: '4', maxlength: '4000',
      placeholder: T(ctx, 'Schrijf je bericht aan Steffan…')
    });
    var regio = liveRegio(ui);
    var knop = schrijfKnop(ctx, ui, { label: T(ctx, 'Verstuur'), type: 'submit' });
    var form = ui.el('form', {
      onsubmit: function (e) {
        e.preventDefault();
        var tekst = trim(ta.value);
        if (!tekst) {
          zetTekst(regio, T(ctx, 'Schrijf eerst een bericht.'));
          ta.focus();
          return;
        }
        var acties = ACTIES(ctx);
        voerUit(ctx, knop, regio, function () {
          if (!fn(acties.berichtSturen)) throw new Error('Deze actie is nog niet beschikbaar.');
          return acties.berichtSturen(q, tekst);
        }, {
          bezig: 'Bezig met versturen…',
          klaar: 'Je vraag is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.',
          daarna: function () { ta.value = ''; ververs(ctx); }
        });
      }
    }, [
      veldVak(ui, T(ctx, 'Jouw bericht'), ta),
      /* de ene regel onder het invoerveld (advies 34) — de eerlijke
         verwachting, één keer, niet bij elk bericht */
      sub(ui, T(ctx, 'Meestal binnen 1 werkdag antwoord')),
      ui.el('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;' }, [knop]),
      regio,
      voorvertoningNoot(ctx, ui)
    ]);
    /* de label-voor-koppeling: veldVak wikkelt het veld al in een <label>,
       maar een expliciete for-koppeling helpt de schermlezer ook bij een
       textarea die de focus via de knop terugkrijgt */
    var lbl = form.querySelector('label.field');
    if (lbl) lbl.setAttribute('for', id);
    return form;
  }

  /* het formulier voor een nieuwe draad → ctx.acties.vraagStellen, met
     productkeuze. De productkeuze komt uit de route (?product=) of is het
     open product. */
  function nieuweVraagPaneel(ctx, ui, vorigItem) {
    var lijst = sorteer(projecten(ctx), function (a, b) {
      var aa = str(a.status) === 'archived' ? 1 : 0, bb = str(b.status) === 'archived' ? 1 : 0;
      if (aa !== bb) return aa - bb;
      return cmpText(a.name, b.name);
    });
    var voorkeur = param(ctx, 'product') || str(opt(bundel(ctx).project).id) || (lijst.length ? str(lijst[0].id) : '');

    var selectId = uid('product');
    var select = ui.el('select', { class: 'input', id: selectId });
    lijst.forEach(function (p) {
      var naam = str(p.name || p.title || p.code || p.id);
      var o = ui.el('option', {
        value: str(p.id),
        text: str(p.status) === 'archived' ? TPL(ctx, '{product} (afgerond)', { product: naam }) : naam,
        selected: str(p.id) === voorkeur ? '' : null
      });
      o.setAttribute('data-no-i18n', '');
      select.appendChild(o);
    });

    var taId = uid('vraag');
    var ta = ui.el('textarea', {
      class: 'input', id: taId, rows: '5', maxlength: '4000',
      placeholder: T(ctx, 'Bijvoorbeeld: is deze kleur al de definitieve kleur?')
    });
    /* de eerste woorden uit de route (?tekst=): zo opent "Vraag stellen"
       naast een fout dit formulier met de context al ingevuld (advies 10) */
    var voorvul = param(ctx, 'tekst');
    if (voorvul) ta.value = voorvul;
    var regio = liveRegio(ui);
    var knop = schrijfKnop(ctx, ui, { label: T(ctx, 'Verstuur'), type: 'submit' });
    var annuleer = ui.el('button', {
      type: 'button', class: 'u-btn ghost', text: T(ctx, 'Annuleer'),
      onclick: function () { deel(ctx, { area: 'berichten', params: { item: vorigItem || null } }, T(ctx, 'Terug naar de lijst')); }
    });

    var form = ui.el('form', {
      onsubmit: function (e) {
        e.preventDefault();
        var tekst = trim(ta.value);
        var project = projectVan(ctx, select.value);
        if (!project) { zetTekst(regio, T(ctx, 'Kies eerst een product.')); select.focus(); return; }
        if (!tekst) { zetTekst(regio, T(ctx, 'Schrijf eerst een bericht.')); ta.focus(); return; }
        var acties = ACTIES(ctx);
        voerUit(ctx, knop, regio, function () {
          if (!fn(acties.vraagStellen)) throw new Error('Deze actie is nog niet beschikbaar.');
          return acties.vraagStellen(project, tekst);
        }, {
          bezig: 'Bezig met versturen…',
          klaar: 'Je vraag is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.',
          daarna: function (q) {
            ta.value = '';
            /* naar de nieuwe draad; de gastheer ververst de bundel en het
               portfolio vóór het tekenen, dus de draad staat er dan */
            navigeer(ctx, { area: 'berichten', params: { item: (isObj(q) && q.id) ? q.id : null } }, { melding: T(ctx, 'Je vraag is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.') });
          }
        });
      }
    }, [
      veldVak(ui, T(ctx, 'Over welk product gaat je vraag?'), select),
      veldVak(ui, T(ctx, 'Jouw vraag'), ta),
      sub(ui, T(ctx, 'Meestal binnen 1 werkdag antwoord')),
      ui.el('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;' }, [knop, annuleer]),
      regio,
      voorvertoningNoot(ctx, ui)
    ]);
    var labels = form.querySelectorAll('label.field');
    if (labels[0]) labels[0].setAttribute('for', selectId);
    if (labels[1]) labels[1].setAttribute('for', taId);

    return ui.el('div', { class: 'u-hero' }, [
      ui.el('div', { class: 'u-hero-kop' }, [
        ui.el('div', null, [
          ui.el('span', { class: 'u-kicker', text: T(ctx, 'Nieuw gesprek') }),
          ui.el('h2', { style: 'font-size:24px;font-weight:500;letter-spacing:-.012em;', text: T(ctx, 'Stel een vraag aan Steffan') })
        ])
      ]),
      form
    ]);
  }

  /* ============================================================
     2. BESTANDEN — documenten, foto's, wat we van jou nodig hebben,
        bescherming van je ontwerp
     ============================================================ */

  /* DOC_TYPE_LABELS van portal.html is niet geëxporteerd; dit is dezelfde
     tabel (zelfde woorden = zelfde i18n-sleutels), aangevuld met de drie
     documenttypen die de KLANT levert (CP_PORTAAL.KLANT_DOC_TYPES). */
  var DOC_TYPE_LABEL = {
    nnn: 'NNN', quote: 'Offerte', invoice: 'Factuur', inspection: 'Inspectierapport',
    compliance: 'Compliance', shipping: 'Verzending', other: 'Overig',
    logo: 'Logo', artwork: 'Artwork', specificatie: 'Specificatie'
  };
  function docTypeLabel(ctx, key) {
    var k = str(key);
    var p = POR(ctx);
    arr(p && p.KLANT_DOC_TYPES).forEach(function (t) { if (t && t.key === k && t.label) DOC_TYPE_LABEL[k] = t.label; });
    return T(ctx, DOC_TYPE_LABEL[k] || k || 'Document');
  }
  /* 'Factuur 2026-0012' wordt op het renderpunt vertaald (docDisplayTitle
     in portal.html doet hetzelfde); elke andere titel is data */
  function docTitel(ctx, d) {
    var m = str(d && d.title).match(/^Factuur\s+(\S+)$/);
    if (m) return TPL(ctx, 'Factuur {nummer}', { nummer: m[1] });
    return str(d && d.title);
  }
  /* is er echt iets te downloaden? Demo: altijd (de demo-sheet legt uit
     wat er live gebeurt); live: alleen met een opslagpad. Zelfde regel als
     docDownloadable() in portal.html. */
  function downloadbaar(ctx, d) {
    if (isDemo(ctx)) return true;
    return !!(d && (str(d.storagePath) || d.heeftBestand));
  }
  /* de titel van de klanttypen uit portaal-model (zelfde zinnen) */
  var BESTAND_TITEL = {
    logo: 'We hebben je logo nodig.',
    artwork: 'We hebben je artwork nodig.',
    specificatie: 'We hebben je specificatie nodig.',
    anders: 'We hebben een bestand van je nodig.'
  };

  /* WELKE WEG OPENT DIT DOCUMENT — in deze volgorde:
       1. een haak ctx.acties.documentOpenen (bestaat vandaag niet; zodra
          portal.html hem geeft, wint hij);
       2. het factuurdocument via ctx.acties.factuurPdf (de bestaande
          beveiligde PDF, mét logregel);
       3. de downloadknop van de oude sectie #docs-list voor dit document
          (handleDownload met de hele bestaande keten: demo-sheet,
          ontbrekend bestand, signed URL, logregel);
       4. niets — dan komt er geen knop, want een knop die niets doet is
          erger dan geen knop. */
  function downloadWeg(ctx, d, facturen) {
    var acties = ACTIES(ctx);
    if (fn(acties.documentOpenen)) return function () { return acties.documentOpenen(d); };
    var factuur = null;
    arr(facturen).forEach(function (inv) { if (!factuur && inv && str(inv.documentId) === str(d.id)) factuur = inv; });
    if (factuur && fn(acties.factuurPdf)) {
      return function () { return openNaBelofte(ctx, acties.factuurPdf(factuur)); };
    }
    var oud = oudElement('#docs-list .doc-row[data-eid="' + cssId(d.id) + '"] button');
    if (oud) return function () { oud.click(); };
    return null;
  }

  function schermBestanden(ctx) {
    var ui = UI(ctx);
    if (!ui) throw new Error('CP_UI ontbreekt.');
    var b = bundel(ctx);
    var open = isObj(b.project) ? b.project : null;
    var facturen = alleFacturen(ctx);

    /* ---------- kop met Download alles ---------- */
    var bezig = false;
    var kopRegio = liveRegio(ui);
    var kop = ui.pageHeader({
      titel: T(ctx, 'Bestanden'),
      primair: {
        label: T(ctx, 'Download alles'),
        ico: 'pijlOmlaag',
        onClick: function () {
          if (bezig) return;
          var knop = kop.querySelector ? kop.querySelector('.u-pagehead-acts button') : null;
          var acties = ACTIES(ctx);
          bezig = true;
          voerUit(ctx, knop, kopRegio, function () {
            if (!fn(acties.downloadAlles)) throw new Error('Deze actie is nog niet beschikbaar.');
            return acties.downloadAlles();
          }, {
            bezig: 'Je dossier wordt samengesteld…',
            klaar: 'Je dossier is gedownload.',
            vraag: open ? { product: open.id, tekst: overOnderwerp(ctx, T(ctx, 'Download alles')) } : null
          }).then(function () { bezig = false; });
        }
      }
    });
    /* wat er in het dossier zit staat achter de "i" naast de knop (advies
       1 en 2): de knop zegt zelf al wat hij doet */
    var kopUitleg = uitleg(ctx, ui, '', T(ctx, 'Download alles geeft je een bestand met alles wat je in het portaal ziet: producten, documenten, facturen en gesprekken, zonder interne velden.'), T(ctx, 'Download alles'));
    var kopActs = kop.querySelector ? kop.querySelector('.u-pagehead-acts') : null;
    if (kopActs && kopUitleg) { kopActs.appendChild(kopUitleg); kopUitleg = null; }

    var delen = [kop, kopUitleg, kopRegio, ruimte(ui, 8)];
    delen.push(documentenSectie(ctx, ui, b, open, facturen));
    delen.push(fotosSectie(ctx, ui));
    delen.push(nodigSectie(ctx, ui, b, open));
    delen.push(beschermingSectie(ctx, ui, b, open));

    var wortel = ui.el('div', null, delen);

    /* de oude diepe link '#/documenten@id' komt binnen als ?anker=id: die
       rij in beeld brengen zodra het scherm hangt */
    var anker = param(ctx, 'anker');
    if (anker && fn(root.setTimeout)) {
      root.setTimeout(function () {
        var doel = wortel.querySelector ? wortel.querySelector('[data-eid="' + cssId(anker) + '"]') : null;
        var d = DOC();
        if (!doel || !d || !d.contains || !d.contains(doel)) return;
        if (fn(doel.scrollIntoView)) doel.scrollIntoView({ block: 'center' });
        /* een documentrij met bestand IS de knop; anders de eerste knop erin */
        var f = (doel.tagName === 'BUTTON' || doel.tagName === 'A') ? doel : doel.querySelector('button, a');
        if (f && fn(f.focus)) { try { f.focus(); } catch (e) { /* stil */ } }
      }, 0);
    }
    return wortel;
  }

  /* ---- 2a. Documenten, per product ---- */
  function documentenSectie(ctx, ui, b, open, facturen) {
    var docs = arr(b.documents).filter(isObj);
    var kop = ui.sectionHead({ titel: T(ctx, 'Documenten'), telling: docs.length });
    var blokken = [];

    if (open) {
      var perFase = {};
      var volgorde = [];
      docs.forEach(function (d) {
        var k = str(d.stageKey);
        if (!perFase[k]) { perFase[k] = []; volgorde.push(k); }
        perFase[k].push(d);
      });
      var rijen = [];
      volgorde.forEach(function (k) {
        var groep = sorteer(perFase[k], function (x, y) {
          var r = cmpText(x.docType, y.docType);
          if (r) return r;
          /* binnen een type de oudste eerst, zoals renderDocs */
          return -cmpNieuwsteEerst(ms(x.createdAt), ms(y.createdAt));
        });
        groep.forEach(function (d) { rijen.push(documentRij(ctx, ui, d, facturen)); });
      });
      var productKop = ui.el('h3', { class: 'u-kicker', style: 'margin:0 0 10px;' }, str(open.name || open.title || open.id));
      noI18n(productKop);
      blokken.push(productKop);
      blokken.push(ui.entityList(rijen, {
        /* lege staat in één regel (advies 9) */
        leeg: ui.emptyState({
          kaal: true,
          titel: T(ctx, 'Nog geen documenten')
        })
      }));
    }

    /* de andere producten: hun documenten zitten niet in deze bundel; een
       rij die naar hun productdetail gaat is eerlijker dan een lege sectie.
       Geen subregel die zegt wat de rij doet (advies 2): de rij is de knop. */
    var andere = projecten(ctx).filter(function (p) { return !open || str(p.id) !== str(open.id); });
    if (andere.length) {
      var andereRijen = andere.map(function (p) {
        var naam = str(p.name || p.title || p.code || p.id);
        var rij = ui.entityRow({
          thumb: ui.iconTile({ icoon: 'projecten', toon: 'neutraal', maat: 40 }),
          titel: naam,
          onOpen: function () { navigeer(ctx, { area: 'producten', id: p.id, tab: 'bestanden' }); }
        });
        noI18nBinnen(rij, '.u-row-title');
        return rij;
      });
      if (open) blokken.push(ruimte(ui, 18));
      blokken.push(ui.el('h3', { class: 'u-kicker', style: 'margin:0 0 10px;', text: T(ctx, open ? 'Je andere producten' : 'Je producten') }));
      blokken.push(ui.entityList(andereRijen));
    }

    if (!open && !andere.length) {
      blokken.push(ui.emptyState({ titel: T(ctx, 'Nog geen documenten') }));
    }
    return sectie(ui, kop, blokken);
  }

  /* de documentrij: .u-row uit admin-ui.css. Een rij MET bestand is zelf de
     download — dezelfde vorm als CP_UI.entityRow zonder menu: de hele rij
     is één <button>, dus Enter en spatie werken vanzelf, er is één tabstop
     per document en de hover- en focusstijl van .u-row gelden. Rechts
     staat het pijl-omlaag-icoon als belofte "dit haalt iets op", in de rol
     van het chevronnetje (.u-row-chevron). Een rij zonder bestand (PDF
     volgt, of geen weg ernaartoe) blijft een gewone rij: een knop die alleen
     een fout kan geven is erger dan geen knop. */
  function documentRij(ctx, ui, d, facturen) {
    var vanKlant = str(d.uploadedBy) === 'klant';
    var titel = docTitel(ctx, d) + (Number(d.version) > 1 ? ' (v' + Number(d.version) + ')' : '');
    var subDelen = [docTypeLabel(ctx, d.docType), faseNaam(ctx, d.stageKey), datumKort(ctx, d.createdAt)];
    if (vanKlant) subDelen.push(T(ctx, 'Aangeleverd door jou'));

    /* de subregel krijgt een id: het aria-label van de rijknop noemt alleen
       de download en de titel, aria-describedby levert type, fase en datum
       er alsnog bij aan de schermlezer */
    var subId = uid('docsub');
    var hoofd = ui.el('span', { class: 'u-row-main' }, [
      noI18n(ui.el('span', { class: 'u-row-title', text: titel })),
      noI18n(ui.el('span', { class: 'u-row-sub', id: subId, text: subDelen.filter(function (x) { return !!x; }).join(' · ') })),
      (vanKlant && str(d.clientNote)) ? noI18n(ui.el('span', { class: 'u-row-sub', text: str(d.clientNote) })) : null
    ]);
    var tegel = ui.iconTile({ icoon: 'bestand', toon: vanKlant ? 'klaar' : (str(d.docType) === 'nnn' ? 'extern' : 'neutraal'), maat: 44 });

    var staart = [];
    if (vanKlant) staart.push(ui.statusChip({ label: T(ctx, 'Van jou'), toon: 'klaar' }));
    var kan = downloadbaar(ctx, d);
    var weg = kan ? downloadWeg(ctx, d, facturen) : null;
    if (!kan) {
      /* de eerlijke staat uit renderDocs: geen rij die alleen een fout kan
         geven */
      staart.push(ui.el('span', { class: 'u-row-meta', text: T(ctx, 'PDF volgt') }));
    }

    if (weg) {
      var pijl = ui.icon('pijlOmlaag', 18);
      pijl.setAttribute('class', 'u-row-chevron');
      staart.push(pijl);
      return ui.el('button', {
        type: 'button',
        class: 'u-row',
        'data-eid': str(d.id),
        /* dezelfde zin als de oude losse knop en als portal.html, dus de
           sleutel bestaat al in vier talen */
        'aria-label': TPL(ctx, 'Download {x}', { x: titel }),
        'aria-describedby': subId,
        onclick: function () { weg(); }
      }, [tegel, hoofd, ui.el('span', { class: 'u-row-end' }, staart)]);
    }
    return ui.el('div', { class: 'u-row', 'data-eid': str(d.id) }, [
      tegel,
      hoofd,
      staart.length ? ui.el('span', { class: 'u-row-end' }, staart) : null
    ]);
  }

  /* ---- 2b. Foto's, over alle producten ----
     Het beeld komt via fotoUrl() (zie kopblok, punt 3); de kaart is altijd
     een echte knop naar het productdetail waar de foto staat. */
  function fotoUrl(ctx, m) {
    var d = DATA(ctx);
    var f = fn(ctx && ctx.mediaUrl) || (d && fn(d.mediaUrl)) || null;
    if (f) {
      var p;
      try { p = f(m); } catch (e) { p = null; }
      return Promise.resolve(p).then(function (u) { return str(u) || null; }, function () { return null; });
    }
    if (str(m.src)) return Promise.resolve(str(m.src));
    if (str(m.fileRef) && root.CP_FILES && fn(root.CP_FILES.fileUrl)) {
      return root.CP_FILES.fileUrl(m.fileRef).then(function (u) { return str(u) || null; }, function () { return null; });
    }
    var oud = oudElement('#updates-list .media-card[data-eid="' + cssId(m.id) + '"] img');
    if (oud && str(oud.getAttribute('src'))) return Promise.resolve(str(oud.getAttribute('src')));
    return Promise.resolve(null);
  }

  function fotosSectie(ctx, ui) {
    var media = sorteer(alleMedia(ctx), function (a, b) {
      var r = cmpNieuwsteEerst(ms(a.capturedAt), ms(b.capturedAt));
      if (r) return r;
      return cmpText(a.id, b.id);
    });
    var alles = param(ctx, 'fotos') === 'alle';
    var GRENS = 12;
    var toon = alles ? media : media.slice(0, GRENS);
    var kop = ui.sectionHead({ titel: T(ctx, 'Foto’s'), telling: media.length });

    if (!media.length) {
      /* lege staat in één regel (advies 9) */
      return sectie(ui, kop, [ui.el('div', { class: 'u-card' }, ui.emptyTile({
        icoon: 'bestand',
        titel: T(ctx, 'Nog geen foto’s')
      }))]);
    }

    var raster = ui.el('div', { class: 'u-grid-3', role: 'list' }, toon.map(function (m) {
      return fotoKaart(ctx, ui, m);
    }));

    var meer = null;
    if (!alles && media.length > GRENS) {
      meer = ui.el('button', {
        type: 'button', class: 'u-btn ghost klein', style: 'margin-top:14px;',
        text: TPL(ctx, 'Toon alle foto’s ({n})', { n: media.length }),
        onclick: function () { deel(ctx, { area: 'bestanden', params: { fotos: 'alle' } }, TPL(ctx, 'Alle {n} foto’s', { n: media.length })); }
      });
    }
    return sectie(ui, kop, [raster, meer]);
  }

  function fotoKaart(ctx, ui, m) {
    var product = projectNaam(ctx, m.projectId);
    var bijschrift = str(m.caption);
    var herkomst = [product, datumKort(ctx, m.capturedAt)].filter(function (x) { return !!x; }).join(' · ');
    /* het beeldslot: eerst een neutrale tegel, daarna de foto zodra de bron
       er is. Nooit een kapot plaatje. admin-ui.css heeft geen fotokaart;
       de drie inline maten staan hier op één plek. */
    var slot = ui.el('span', {
      class: 'u-thumb ph',
      'aria-hidden': 'true',
      style: 'display:block;width:100%;height:auto;aspect-ratio:4/3;border-radius:14px 14px 0 0;border:0;'
    }, ui.icon('bestand', 28));
    var knop = ui.el('button', {
      type: 'button',
      class: 'u-card',
      role: 'listitem',
      style: 'display:block;width:100%;padding:0;overflow:hidden;text-align:left;',
      'aria-label': TPL(ctx, 'Foto: {bijschrift}. {herkomst}. Opent het product.', { bijschrift: bijschrift || T(ctx, 'Projectfoto'), herkomst: herkomst }),
      onclick: function () { navigeer(ctx, { area: 'producten', id: m.projectId, tab: 'bestanden', params: { anker: m.id } }); }
    }, [
      slot,
      ui.el('span', { style: 'display:block;padding:12px 14px 14px;' }, [
        noI18n(ui.el('span', { class: 'u-row-title', style: 'display:block;font-size:15px;', text: bijschrift || T(ctx, 'Projectfoto') })),
        noI18n(ui.el('span', { class: 'u-row-sub', style: 'display:block;', text: herkomst }))
      ])
    ]);
    fotoUrl(ctx, m).then(function (u) {
      if (!u || !slot.parentNode) return;
      var img = ui.el('img', {
        src: u, alt: '', loading: 'lazy',
        style: 'display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:var(--tint-ink);'
      });
      slot.parentNode.replaceChild(img, slot);
    });
    return knop;
  }

  /* ---- 2c. Wat we van jou nodig hebben: de open klantslots ----
     Dezelfde regel als openKlantSlots() in portaal-model.js (die functie
     is niet geëxporteerd): een slot is een vraag aan de klant als het dat
     zelf zegt (expectedFrom 'klant') of als het documenttype iets is dat
     alleen de klant kán leveren; open = geen zichtbaar document eraan. */
  function klantDocType(ctx, key) {
    var p = POR(ctx);
    var k = str(key);
    var uit = null;
    arr(p && p.KLANT_DOC_TYPES).forEach(function (t) { if (t && t.key === k) uit = t; });
    if (!uit && (k === 'logo' || k === 'artwork' || k === 'specificatie')) uit = { key: k, label: DOC_TYPE_LABEL[k] };
    return uit;
  }
  function openKlantSlots(ctx, b) {
    var docIds = {}, perSlot = {};
    arr(b.documents).forEach(function (d) {
      if (!isObj(d)) return;
      if (d.id) docIds[d.id] = true;
      if (d.slotId) perSlot[d.slotId] = true;
    });
    return arr(b.docSlots).filter(function (sl) {
      if (!isObj(sl) || !sl.id) return false;
      if (str(sl.expectedFrom) === 'staf') return false;
      if (str(sl.expectedFrom) !== 'klant' && !klantDocType(ctx, sl.docType)) return false;
      if (sl.status && sl.status !== 'verwacht') return false;
      if (sl.documentId && docIds[sl.documentId]) return false;
      if (perSlot[sl.id]) return false;
      return true;
    });
  }

  function nodigSectie(ctx, ui, b, open) {
    var slots = openKlantSlots(ctx, b);
    var kop = ui.sectionHead({ titel: T(ctx, 'Wat we van jou nodig hebben'), telling: slots.length });
    if (!slots.length) {
      /* lege staat in één regel (advies 9) */
      return sectie(ui, kop, [ui.el('div', { class: 'u-card' }, ui.emptyTile({
        icoon: 'vinkje',
        titel: T(ctx, 'Op dit moment hebben we niets van je nodig.')
      }))], 'k-nodig');
    }
    return sectie(ui, kop, slots.map(function (sl) { return slotKaart(ctx, ui, sl, open); }), 'k-nodig');
  }

  function bestandsGrootte(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n <= 0) return '';
    var kb = n / 1024;
    if (kb < 1000) return String(Math.round(kb)) + ' kB';
    var mb = Math.round((kb / 1024) * 10) / 10;
    return String(mb).replace('.', ',') + ' MB';
  }

  function slotKaart(ctx, ui, sl, open) {
    var d = DATA(ctx);
    var maxBytes = (d && Number(d.UPLOAD_MAX_BYTES) > 0) ? Number(d.UPLOAD_MAX_BYTES) : 26214400;
    var maxMb = Math.round(maxBytes / 1048576);
    var type = klantDocType(ctx, sl.docType);
    var titel = T(ctx, type ? BESTAND_TITEL[type.key] : BESTAND_TITEL.anders);
    var product = open ? str(open.name || open.title || open.id) : projectNaam(ctx, sl.projectId);
    /* de subregel is data (product · fase · datum), geen uitleg (advies 1) */
    var subDelen = [product, sl.stageKey ? faseNaam(ctx, sl.stageKey) : ''];
    if (sl.createdAt) subDelen.push(TPL(ctx, 'Gevraagd op {datum}', { datum: datumKort(ctx, sl.createdAt) }));
    var projectId = open ? open.id : sl.projectId;

    var bestandId = uid('bestand');
    var bestandVeld = ui.el('input', { type: 'file', class: 'input', id: bestandId });
    var gekozen = ui.el('p', { class: 'u-sub', 'aria-live': 'polite', style: 'margin-top:6px;' });
    bestandVeld.addEventListener('change', function () {
      var f = bestandVeld.files && bestandVeld.files[0];
      if (!f) { zetTekst(gekozen, ''); return; }
      var groot = bestandsGrootte(f.size);
      zetTekst(gekozen, TPL(ctx, 'Gekozen: {naam} ({grootte})', { naam: str(f.name), grootte: groot || '' }));
      noI18n(gekozen);
      if (Number(f.size) > maxBytes) zetTekst(gekozen, T(ctx, 'Dit bestand is groter dan 25 MB. Kies een kleiner bestand.'));
    });

    var opmId = uid('opmerking');
    var opm = ui.el('textarea', {
      class: 'input', id: opmId, rows: '3', maxlength: '2000',
      placeholder: T(ctx, 'Bijvoorbeeld: dit is de definitieve versie.')
    });
    var regio = liveRegio(ui);
    var knop = schrijfKnop(ctx, ui, { label: T(ctx, 'Bestand aanleveren'), type: 'submit' });

    var form = ui.el('form', {
      onsubmit: function (e) {
        e.preventDefault();
        var f = bestandVeld.files && bestandVeld.files[0];
        if (!f) { zetTekst(regio, T(ctx, 'Kies eerst een bestand.')); bestandVeld.focus(); return; }
        var acties = ACTIES(ctx);
        voerUit(ctx, knop, regio, function () {
          if (!fn(acties.bestandAanleveren)) throw new Error('Deze actie is nog niet beschikbaar.');
          return acties.bestandAanleveren(sl, f, trim(opm.value));
        }, {
          bezig: 'Bezig met uploaden…',
          klaar: 'Je bestand is aangekomen. Steffan bekijkt het en geeft een seintje.',
          vraag: { product: projectId, tekst: overOnderwerp(ctx, titel) },
          daarna: function () { ververs(ctx); }
        });
      }
    }, [
      veldVak(ui, T(ctx, 'Bestand'), bestandVeld),
      /* welke bestanden kunnen staat achter de "i" (advies 1) */
      uitleg(ctx, ui, '', TPL(ctx, 'Elk bestandstype kan, tot {mb} MB — bijvoorbeeld PDF, JPG, PNG, AI of ZIP.', { mb: maxMb }), T(ctx, 'Bestand')),
      gekozen,
      veldVak(ui, T(ctx, 'Opmerking (niet verplicht)'), opm),
      ui.el('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, [knop]),
      regio,
      voorvertoningNoot(ctx, ui)
    ]);
    var labels = form.querySelectorAll('label.field');
    if (labels[0]) labels[0].setAttribute('for', bestandId);
    if (labels[1]) labels[1].setAttribute('for', opmId);

    /* de kop: de ene zin (de titel zegt al welk type) en de data eronder;
       'Type: Logo' herhaalde de titel en is weg (advies 2) */
    return kaart(ui, [
      ui.el('div', { style: 'display:flex;gap:14px;align-items:flex-start;margin-bottom:16px;' }, [
        ui.iconTile({ icoon: 'bestand', toon: 'wacht', maat: 44 }),
        ui.el('div', { style: 'min-width:0;flex:1;' }, [
          ui.el('h3', { style: 'font-size:17px;font-weight:500;', text: titel }),
          noI18n(ui.el('p', { class: 'u-sub', style: 'margin-top:3px;', text: subDelen.filter(function (x) { return !!x; }).join(' · ') }))
        ]),
        ui.statusChip({ label: T(ctx, 'Wacht op jou'), toon: 'wacht' })
      ]),
      form
    ]);
  }

  /* ---- 2d. Bescherming van je ontwerp: de NNN-vastleggingen ---- */
  function beschermingSectie(ctx, ui, b, open) {
    var kop = ui.sectionHead({ titel: T(ctx, 'Bescherming van je ontwerp') });
    var disc = sorteer(arr(b.disclosures).filter(isObj), function (x, y) {
      var r = cmpNieuwsteEerst(ms(x.disclosedAt), ms(y.disclosedAt));
      if (r) return r;
      return cmpText(x.id, y.id);
    });
    var fabrieken = {};
    arr(b.factories).forEach(function (f) { if (isObj(f) && f.id) fabrieken[f.id] = f; });
    var docs = {};
    arr(b.documents).forEach(function (d) { if (isObj(d) && d.id) docs[d.id] = d; });

    var allesOnderNnn = disc.length > 0 && disc.every(function (x) { return !!x.underNnn; });
    /* de vertrouwensregel uit portal.html alleen als hij voor élke
       vastlegging klopt (één zin, advies 1); de zin die beschreef wat de
       lijst toont is weg (advies 2) — de rijen zeggen het zelf */
    var intro = allesOnderNnn ? lees(ui, T(ctx, 'Je ontwerp is beschermd: fabrieken krijgen alleen bestanden onder NNN.')) : null;

    if (!disc.length) {
      /* lege staat in één regel (advies 9) */
      return sectie(ui, kop, [ui.el('div', { class: 'u-card' }, ui.emptyTile({
        icoon: 'fabriek',
        titel: T(ctx, open ? 'Er zijn nog geen bestanden met een fabriek gedeeld.' : 'Open een product om zijn NNN vastleggingen te zien.')
      }))]);
    }

    var rijen = disc.map(function (x) {
      var f = fabrieken[x.factoryId] || null;
      var doc = x.documentId ? (docs[x.documentId] || null) : null;
      var wat = doc ? docTitel(ctx, doc) : (str(x.what) || T(ctx, 'Bestanden'));
      var fabriekNaam = f ? str(f.name) : T(ctx, 'een partner');
      var rij = ui.entityRow({
        thumb: ui.iconTile({ icoon: 'fabriek', toon: x.underNnn ? 'klaar' : 'wacht', maat: 44 }),
        titel: wat,
        sub: TPL(ctx, 'Gedeeld met {fabriek} op {datum}', { fabriek: fabriekNaam, datum: datumKort(ctx, x.disclosedAt) }),
        chips: [ui.statusChip({ label: x.underNnn ? T(ctx, 'Onder NNN') : T(ctx, 'Zonder NNN'), toon: x.underNnn ? 'klaar' : 'wacht' })]
      });
      noI18nBinnen(rij, '.u-row-title, .u-row-sub');
      return rij;
    });
    return sectie(ui, kop, [intro, ui.entityList(rijen)]);
  }

  /* ============================================================
     3. BETALINGEN — het klant-werkgebied Financiën
     ============================================================ */

  /* de statusvertaler, met de onbevestigde meldingen van deze factuur erbij
     (listClientPayments): daaruit volgt het woord 'Gemeld' */
  function factuurStatus(ctx, inv, gemeld) {
    var p = POR(ctx);
    if (p && fn(p.factuurStatusVoorKlant)) return p.factuurStatusVoorKlant(inv, ctx && ctx.nu, { gemeld: arr(gemeld) });
    /* zonder rekenlaag geen raden: alles telt als open op het totaal */
    var t = Math.round(Number(inv.totalCents) > 0 ? Number(inv.totalCents) : (Number(inv.amountCents) || 0));
    return { code: str(inv.statusCode) || 'finalized', stand: 'open', label: 'Open', toon: 'warn', woord: 'Open', toelichting: '', betaald: false, open: t > 0, deels: false, gemeld: false, bezwaar: false, gesloten: false, openCents: t, totaalCents: t, betaaldCents: 0, gecrediteerdCents: 0, valuta: str(inv.currency) || 'EUR', vervaltISO: dagISO(ctx, inv.dueDate), verstreken: false };
  }

  /* HET WOORD EN DE TOELICHTING VAN DE KLANT — de enige weg waarlangs een
     factuurstand op dit scherm tekst wordt. De statusvertaler levert vier
     woorden (Open · Gemeld · Betaald · Bezwaar) en een toelichting als
     bronstring met {datum}, {betaald} en {totaal}; hier krijgen die de
     opmaak van de klant (afspraak 2 uit portaal-model.js). Het fijne label
     ('Deels betaald', 'Verlopen', …) en de interne code komen hier nooit
     doorheen. */
  function standToelichting(ctx, st) {
    if (!st || !str(st.toelichting)) return '';
    /* {betaald} is alles wat niet meer betaald hoeft te worden — betaald
       én verrekend via creditnota; het detail splitst die twee uit */
    var af = (Number(st.betaaldCents) || 0) + (Number(st.gecrediteerdCents) || 0);
    return TPL(ctx, str(st.toelichting), {
      datum: st.vervaltISO ? datumKort(ctx, st.vervaltISO) : '',
      betaald: geld(ctx, af, st.valuta),
      totaal: geld(ctx, st.totaalCents, st.valuta)
    });
  }
  /* een geannuleerde factuur heeft geen woord (zie de keuze in
     portaal-model.js) en toont op de plek van het woord zijn toelichting */
  function standWoord(ctx, st) {
    if (str(st && st.woord)) return T(ctx, str(st.woord));
    return standToelichting(ctx, st);
  }
  /* de toelichting ONDER het woord — leeg als hij al op de plek van het
     woord staat, anders zou hij twee keer verschijnen */
  function standOnderregel(ctx, st) {
    return str(st && st.woord) ? standToelichting(ctx, st) : '';
  }
  function isCreditnota(inv) { return str(inv.docKind || 'invoice') !== 'invoice'; }
  function inclBtw(inv) { return Number(inv.totalCents) > 0 && Number(inv.vatCents) > 0; }
  /* de statuscodes waarin bezwaar mogelijk is — letterlijk OPEN_VOOR_BEZWAAR
     uit portaal-data.js (niet geëxporteerd) */
  var OPEN_VOOR_BEZWAAR = ['finalized', 'sent', 'viewed', 'partially_paid', 'overdue'];

  /* geld invoeren zonder kommagetallen: de tekst wordt gelezen als heel
     deel en centen en gaat als geheel getal verder. '1.234,56', '1234.56'
     en '1234' zijn alle drie geldig; '12.345' (drie cijfers achter een
     punt) is een duizendtal. */
  function invoerNaarCents(s) {
    var t = trim(s).replace(/[\s€]/g, '');
    if (!t || t.charAt(0) === '-') return null;
    var lc = t.lastIndexOf(','), lp = t.lastIndexOf('.');
    var dec = -1;
    if (lc > -1 && lp > -1) dec = Math.max(lc, lp);
    else if (lc > -1) dec = lc;
    else if (lp > -1) { var na = t.length - lp - 1; dec = (na === 1 || na === 2) ? lp : -1; }
    var heel = dec > -1 ? t.slice(0, dec) : t;
    var frac = dec > -1 ? t.slice(dec + 1) : '';
    heel = heel.replace(/[.,]/g, '');
    if (!/^\d*$/.test(heel) || !/^\d{0,2}$/.test(frac)) return null;
    if (!heel) heel = '0';
    while (frac.length < 2) frac += '0';
    var n = parseInt(heel, 10) * 100 + parseInt(frac, 10);
    return (isFinite(n) && n > 0) ? n : null;
  }
  function centsNaarInvoer(c) {
    var a = Math.abs(Math.round(Number(c) || 0));
    var h = Math.floor(a / 100);
    var r = a - h * 100;
    return String(h) + ',' + (r < 10 ? '0' : '') + String(r);
  }
  function geldRegels(ctx, perValuta) {
    var keys = Object.keys(opt(perValuta)).sort();
    return keys.map(function (v) { return geld(ctx, perValuta[v], v); });
  }

  function schermBetalingen(ctx) {
    var ui = UI(ctx);
    if (!ui) throw new Error('CP_UI ontbreekt.');
    var d = DATA(ctx);
    var alles = alleFacturen(ctx);
    var facturen = alles.filter(function (inv) { return !isCreditnota(inv); });
    var creditnotas = alles.filter(isCreditnota);

    /* de gemelde, nog niet bevestigde betalingen per open factuur */
    var laders = facturen.map(function (inv) {
      var st = factuurStatus(ctx, inv);
      if (!st.open || !d || !fn(d.listClientPayments)) return Promise.resolve([]);
      var p;
      try { p = d.listClientPayments(inv); } catch (e) { p = null; }
      return Promise.resolve(p).then(function (rijen) {
        return arr(rijen).filter(function (r) { return isObj(r) && !r.verifiedAt; });
      }, function () { return []; });
    });

    return Promise.all(laders).then(function (meldingen) {
      var perFactuur = {};
      facturen.forEach(function (inv, i) { perFactuur[inv.id] = meldingen[i]; });
      return tekenBetalingen(ctx, ui, facturen, creditnotas, perFactuur);
    });
  }

  function tekenBetalingen(ctx, ui, facturen, creditnotas, meldingen) {
    var p = POR(ctx);
    var gekozenId = param(ctx, 'item') || param(ctx, 'anker');
    var actie = param(ctx, 'actie');

    var kop = ui.pageHeader({ titel: T(ctx, 'Betalingen') });

    /* ---------- de drie stattegels ---------- */
    var openPer = (p && fn(p.openstaandPerValuta)) ? p.openstaandPerValuta(facturen) : {};
    var openTotaal = 0, openAantal = 0;
    Object.keys(openPer).forEach(function (v) { openTotaal += openPer[v]; });
    facturen.forEach(function (inv) { if (factuurStatus(ctx, inv).open) openAantal++; });

    var jaar = jaarVan(ctx, (ctx && ctx.nu) || new Date());
    var betaaldPer = {}, betaaldAantal = 0;
    facturen.forEach(function (inv) {
      var st = factuurStatus(ctx, inv);
      if (st.betaaldCents > 0 && inv.paidAt && jaarVan(ctx, inv.paidAt) === jaar) {
        betaaldPer[st.valuta] = (betaaldPer[st.valuta] || 0) + st.betaaldCents;
        betaaldAantal++;
      }
    });

    var volgende = (p && fn(p.volgendeBetaling)) ? p.volgendeBetaling(facturen, ctx && ctx.nu) : null;

    var tegelOpen = ui.statTile({
      label: T(ctx, 'Openstaand'),
      waarde: Object.keys(openPer).length ? geldRegels(ctx, openPer).join(' · ') : geld(ctx, 0, 'EUR'),
      icoon: 'financien',
      toon: openTotaal > 0 ? 'wacht' : 'klaar',
      sub: openAantal === 0 ? T(ctx, 'Alles is betaald.') : (openAantal === 1 ? T(ctx, '1 open factuur') : TPL(ctx, '{n} open facturen', { n: openAantal }))
    });
    var tegelBetaald = ui.statTile({
      label: T(ctx, 'Betaald dit jaar'),
      waarde: Object.keys(betaaldPer).length ? geldRegels(ctx, betaaldPer).join(' · ') : geld(ctx, 0, 'EUR'),
      icoon: 'vinkje',
      toon: 'klaar',
      sub: betaaldAantal ? TPL(ctx, '{n} facturen met een betaaldatum in {jaar}', { n: betaaldAantal, jaar: jaar }) : TPL(ctx, 'Nog geen betaling met een betaaldatum in {jaar}', { jaar: jaar })
    });
    var tegelVolgende;
    if (volgende) {
      var vSub;
      /* dezelfde woorden als de toelichting bij het woord 'Open' in de lijst */
      if (volgende.vervaltISO) vSub = volgende.verstreken ? TPL(ctx, 'Vervaldatum was {datum}', { datum: datumKort(ctx, volgende.vervaltISO) }) : TPL(ctx, 'Vervalt op {datum}', { datum: datumKort(ctx, volgende.vervaltISO) });
      else vSub = T(ctx, 'Zonder vervaldatum');
      tegelVolgende = ui.statTile({
        label: T(ctx, 'Volgende betaling'),
        waarde: geld(ctx, volgende.openCents, volgende.valuta),
        icoon: 'kalender',
        toon: volgende.verstreken ? 'kritiek' : 'wacht',
        sub: vSub,
        onClick: function () { deel(ctx, { area: 'betalingen', params: { item: volgende.factuur.id } }, T(ctx, 'Volgende betaling')); }
      });
    } else {
      tegelVolgende = ui.statTile({
        label: T(ctx, 'Volgende betaling'),
        waarde: geld(ctx, 0, 'EUR'),
        icoon: 'kalender',
        toon: 'klaar',
        sub: T(ctx, 'Er staat niets open.')
      });
    }
    noI18nBinnen(tegelOpen, '.u-stat-num');
    noI18nBinnen(tegelBetaald, '.u-stat-num');
    noI18nBinnen(tegelVolgende, '.u-stat-num');
    var tegels = ui.statRow([tegelOpen, tegelBetaald, tegelVolgende]);

    /* ---------- de facturen ---------- */
    var gesorteerd = sorteer(facturen, function (a, b) {
      var sa = factuurStatus(ctx, a), sb = factuurStatus(ctx, b);
      if (sa.open !== sb.open) return sa.open ? -1 : 1;
      if (sa.open) {
        var av = sa.vervaltISO, bv = sb.vervaltISO;
        if (av !== bv) { if (!av) return 1; if (!bv) return -1; return cmpText(av, bv); }
      }
      var r = cmpNieuwsteEerst(ms(a.createdAt), ms(b.createdAt));
      if (r) return r;
      return cmpText(a.id, b.id);
    });

    var lijstKinderen = [];
    gesorteerd.forEach(function (inv) {
      var gemeld = arr(meldingen[inv.id]);
      var st = factuurStatus(ctx, inv, gemeld);
      var isGekozen = str(inv.id) === gekozenId;
      lijstKinderen.push(factuurRij(ctx, ui, inv, st, gemeld, isGekozen));
      if (isGekozen) lijstKinderen.push(factuurDetail(ctx, ui, inv, st, gemeld, actie));
    });

    /* lege staat in één regel (advies 9) */
    var lijst = ui.el('div', { class: 'u-card u-rows', role: 'region', 'aria-label': T(ctx, 'Facturen') },
      lijstKinderen.length ? lijstKinderen : [ui.emptyState({ kaal: true, titel: T(ctx, 'Nog geen facturen.') })]);
    var facturenSectie = sectie(ui, ui.sectionHead({ titel: T(ctx, 'Facturen'), telling: gesorteerd.length }), [lijst]);

    /* ---------- creditnota's, alleen als ze er zijn ---------- */
    var creditSectie = null;
    if (creditnotas.length) {
      var cRijen = sorteer(creditnotas, function (a, b) { return cmpNieuwsteEerst(ms(a.createdAt), ms(b.createdAt)) || cmpText(a.id, b.id); })
        .map(function (cn) { return creditnotaRij(ctx, ui, cn); });
      creditSectie = sectie(ui, ui.sectionHead({ titel: T(ctx, 'Creditnota’s'), telling: creditnotas.length }), [
        /* één zin, de rest achter de "i" (advies 1) */
        uitleg(ctx, ui, T(ctx, 'Een creditnota vermindert wat je nog moet betalen.'), T(ctx, 'Het bedrag is al verrekend in de stand van de bijbehorende factuur.'), T(ctx, 'Creditnota’s')),
        ruimte(ui, 10),
        ui.entityList(cRijen)
      ]);
    }

    /* .k-betalingen: de haak uit portaal-skin.css — hier, en alleen hier,
       is een kritieke stand rood in plaats van oranje */
    var wortel = ui.el('div', { class: 'k-betalingen' }, [kop, tegels, ruimte(ui, 28), facturenSectie, creditSectie]);

    if (gekozenId && fn(root.setTimeout)) {
      root.setTimeout(function () {
        var doel = wortel.querySelector ? wortel.querySelector('[data-eid="' + cssId(gekozenId) + '"]') : null;
        var d = DOC();
        if (!doel || !d || !d.contains || !d.contains(doel) || !fn(doel.scrollIntoView)) return;
        /* alleen bij een diepe link (anker) scrollen; een klik in de lijst
           houdt de pagina waar hij is */
        if (param(ctx, 'anker')) doel.scrollIntoView({ block: 'center' });
      }, 0);
    }
    return wortel;
  }

  /* de factuurrij (.u-invoicerow, admin-ui.css 8o) — zelfde opbouw als in
     het beheer: klikbare hoofdknop, bedrag en datum, statusstip met woord,
     en een ••• met de klantacties. */
  function factuurRij(ctx, ui, inv, st, gemeld, isGekozen) {
    var product = projectNaam(ctx, inv.projectId);
    var nummer = str(inv.invoiceNumber);
    var label = str(inv.label);
    var titelDelen = [];
    if (nummer) titelDelen.push(ui.el('span', { text: TPL(ctx, 'Factuur {nummer}', { nummer: nummer }) }));
    if (label) titelDelen.push(noI18n(ui.el('span', { text: (nummer ? ' · ' : '') + label })));
    if (!titelDelen.length) titelDelen.push(ui.el('span', { text: T(ctx, 'Factuur') }));
    var subDelen = [product, inv.stageKey ? faseNaam(ctx, inv.stageKey) : ''];
    if (inv.stageKey && Number(inv.paymentPct) > 0) subDelen.push(TPL(ctx, '{pct}% van de projectsom', { pct: Number(inv.paymentPct) }));

    /* het datumslot: de datum die er op dit moment toe doet. Een verstreken
       vervaldatum staat bij een kale te-late factuur al in de toelichting
       onder het woord ('Vervaldatum was …') en komt dan hier niet nog eens;
       gaat de toelichting over iets anders (deelbetaling, melding, bezwaar),
       dan draagt dit slot de datum. */
    var toelichtingIsDatum = st.open && st.verstreken && !st.deels && !st.gemeld && !st.bezwaar;
    var datumTekst = '';
    /* naast het woord 'Betaald' alleen de datum zelf — 'Betaald op' zou het
       woord herhalen (advies 8) */
    if (st.betaald && inv.paidAt) datumTekst = datumKort(ctx, inv.paidAt);
    else if (st.vervaltISO && st.open && !st.verstreken) datumTekst = TPL(ctx, 'Vervalt op {datum}', { datum: datumKort(ctx, st.vervaltISO) });
    else if (st.vervaltISO && st.open && !toelichtingIsDatum) datumTekst = TPL(ctx, 'Vervaldatum was {datum}', { datum: datumKort(ctx, st.vervaltISO) });
    else if (!toelichtingIsDatum && inv.createdAt) datumTekst = TPL(ctx, 'Aangemaakt op {datum}', { datum: datumKort(ctx, inv.createdAt) });

    /* het bedrag: bij een deels betaalde factuur het OPENSTAANDE bedrag
       (de toelichting zegt wat er al binnen is); incl. btw waar het bedrag
       btw bevat */
    var bedragTekst = geld(ctx, st.deels ? st.openCents : st.totaalCents, st.valuta) + (inclBtw(inv) ? ' ' + T(ctx, 'incl. btw') : '');

    /* de stand: één van de vier woorden van de klant, met de toelichting
       eronder — 'Gemeld' komt uit de statusvertaler zelf (de meldingen zijn
       meegegeven), dus hier wordt niets meer bijgeraden */
    var standLabel = standWoord(ctx, st);
    var standOnder = standOnderregel(ctx, st);
    var standToon = toonVan(st);

    function kies() {
      deel(ctx, { area: 'betalingen', params: { item: isGekozen ? null : inv.id } },
        isGekozen ? T(ctx, 'Factuur gesloten') : TPL(ctx, 'Geopend: {titel}', { titel: nummer || label || T(ctx, 'Factuur') }));
    }

    var klikKnop = ui.el('button', {
      type: 'button',
      class: 'u-invoicerow-main u-row-klik',
      style: 'flex:1 1 240px;',
      'aria-expanded': isGekozen ? 'true' : 'false',
      onclick: kies
    }, [
      ui.iconTile({ icoon: 'financien', toon: standToon, maat: 44 }),
      ui.el('span', { style: 'flex:1;min-width:0;' }, [
        ui.el('span', { class: 'u-invoicerow-titel' }, titelDelen),
        noI18n(ui.el('span', { class: 'u-invoicerow-sub', style: 'display:block;', text: subDelen.filter(function (x) { return !!x; }).join(' · ') }))
      ])
    ]);

    var menuItems = factuurMenu(ctx, inv, st);
    var staart = ui.el('span', { style: 'display:flex;align-items:center;gap:10px;flex:none;margin-left:auto;' }, [
      menuItems.length ? ui.contextMenu({
        knop: { titel: TPL(ctx, 'Meer acties bij factuur {nummer}', { nummer: nummer || label }) },
        items: menuItems,
        uitlijning: 'rechts'
      }).el : null
    ]);

    var rij = ui.el('div', {
      class: 'u-invoicerow' + (isGekozen ? ' gekozen' : ''),
      'data-eid': str(inv.id),
      style: 'flex-wrap:wrap;' + (isGekozen ? 'background:var(--card-2);' : '')
    }, [
      klikKnop,
      ui.el('span', { class: 'u-invoicerow-geld' }, [
        noI18n(ui.el('span', { class: 'u-invoicerow-bedrag', text: bedragTekst })),
        ui.el('span', { class: 'u-invoicerow-datum', text: datumTekst })
      ]),
      /* het woord met zijn toelichting eronder. .u-invoicerow-status is een
         flexrij (admin-ui.css 8o); de kolom staat hier inline op één plek
         zodat hij in één regel naar CSS kan (zie css-wensen-berichten.css) */
      ui.el('span', { class: 'u-invoicerow-status' }, ui.el('span', { style: 'display:flex;flex-direction:column;gap:2px;min-width:0;' }, [
        ui.statusDot({ toon: standToon, label: standLabel }),
        standOnder ? noI18n(ui.el('span', { class: 'u-sub', text: standOnder })) : null
      ])),
      staart
    ]);
    /* de rest van de rij opent ook — behalve een klik die in het staartstuk
       begon, want daar zit het ••• (zelfde regel als CP_UI.entityRow) */
    rij.addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== rij) {
        if (t === klikKnop || t === staart) return;
        t = t.parentNode;
      }
      kies();
    });
    return rij;
  }

  /* het ••• van een factuur: alleen wat in DEZE stand kan */
  function factuurMenu(ctx, inv, st) {
    var acties = ACTIES(ctx);
    var items = [];
    if (inv.documentId && fn(acties.factuurPdf)) {
      items.push({
        label: T(ctx, 'Bekijk PDF'), ico: 'bestand',
        onKies: function () { openNaBelofte(ctx, acties.factuurPdf(inv), { vraag: { product: inv.projectId, tekst: overFactuur(ctx, inv) } }); }
      });
    }
    if (st.open && !st.bezwaar && fn(acties.betalingMelden)) {
      items.push({
        label: T(ctx, 'Betaling melden'), ico: 'vinkje',
        onKies: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id, actie: 'melden' } }, T(ctx, 'Betaling melden')); }
      });
    }
    if (st.open && !st.bezwaar && OPEN_VOOR_BEZWAAR.indexOf(str(st.code)) > -1 && fn(acties.bezwaarMaken)) {
      items.push({
        label: T(ctx, 'Vraag over deze factuur'), ico: 'mail',
        onKies: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id, actie: 'bezwaar' } }, T(ctx, 'Vraag over deze factuur')); }
      });
    }
    return items;
  }

  /* het detail onder de gekozen rij: uitleg over de stand, de gemelde
     betalingen, het betaalvak en — via ?actie= — een van de twee formulieren */
  function factuurDetail(ctx, ui, inv, st, gemeld, actie) {
    var acties = ACTIES(ctx);
    var delen = [];
    var nummer = str(inv.invoiceNumber);

    /* factuurnummer = betalingskenmerk, in mono (zelfde woord als portal.html) */
    if (nummer) {
      delen.push(ui.el('p', { class: 'u-sub' }, [
        ui.el('span', { text: T(ctx, 'Factuurnummer') + ' ' }),
        noI18n(ui.el('span', { class: 'mono', text: nummer }))
      ]));
    }
    /* de betaaldatum staat al in de rij erboven (advies 8): niet nog eens */

    /* de goedkeuring waar deze factuur op rust (alleen bekend voor het open
       product; de fasen van andere producten zitten in het portfolio) */
    var fase = null;
    var project = projectVan(ctx, inv.projectId);
    arr(project && project.stages).forEach(function (s) { if (isObj(s) && s.stageKey === inv.stageKey) fase = s; });
    if (!fase && str(opt(bundel(ctx).project).id) === str(inv.projectId)) {
      arr(bundel(ctx).stages).forEach(function (s) { if (isObj(s) && s.stageKey === inv.stageKey) fase = s; });
    }
    if (fase && fase.approvedAt) {
      delen.push(sub(ui, TPL(ctx, 'Goedgekeurd op {d}', { d: datumKort(ctx, fase.approvedAt) }) + (str(fase.approvedBy) ? ' · ' + TPL(ctx, 'door {naam}', { naam: str(fase.approvedBy) }) : '')));
    }

    /* één zin uitleg onder een factuur die niets meer vraagt (renderInvoices),
       in dezelfde woorden als de toelichting in de lijst ('Vervallen',
       'Creditnota, verrekend') */
    if (st.gesloten) {
      delen.push(lees(ui, T(ctx, st.stand === 'geannuleerd' ? 'Deze factuur is vervallen. Je hoeft niets te doen.' : 'Deze factuur is verrekend met een creditnota. Je hoeft niets te doen.')));
    }
    /* wat er al is afgeboekt, met het restant erachter — alleen als er iets
       te tonen is */
    var afRegels = [];
    if (st.betaaldCents > 0 && (st.deels || st.gesloten)) afRegels.push(T(ctx, 'Reeds betaald') + ': ' + geld(ctx, st.betaaldCents, st.valuta));
    if (st.gecrediteerdCents > 0) afRegels.push(T(ctx, 'Verrekend via creditnota') + ': ' + geld(ctx, st.gecrediteerdCents, st.valuta));
    if (st.deels) afRegels.push(T(ctx, 'Openstaand bedrag') + ': ' + geld(ctx, st.openCents, st.valuta));
    if (afRegels.length) delen.push(noI18n(sub(ui, afRegels.join(' · '))));

    /* bezwaar: de bal ligt bij Steffan — één zin, de rest achter de "i" */
    if (st.bezwaar) {
      delen.push(uitleg(ctx, ui, T(ctx, 'Steffan neemt contact met je op over je vraag.'), T(ctx, 'Tot die tijd staan de herinneringen stil en hoef je niets te doen.'), T(ctx, 'Bezwaar')));
    }

    /* de gemelde betalingen: een melding is geen boeking; grijs, want een
       melding is geen stand die om iets vraagt (advies 27) */
    if (gemeld.length) {
      delen.push(stapel(ui, gemeld.map(function (m) {
        var regel = TPL(ctx, 'Betaling van {bedrag} op {datum} gemeld, Steffan controleert.', {
          bedrag: geld(ctx, m.amountCents, m.currency || st.valuta), datum: datumKort(ctx, m.paidOn)
        });
        if (str(m.clientReference)) regel += ' ' + TPL(ctx, 'Kenmerk: {kenmerk}', { kenmerk: str(m.clientReference) });
        return ui.el('div', { style: 'display:flex;align-items:center;gap:8px;' }, [
          ui.statusDot({ toon: 'neutraal', label: T(ctx, 'Gemeld') }),
          noI18n(ui.el('span', { class: 'u-sub', text: regel }))
        ]);
      }), 6));
    }

    /* het betaalvak, alleen onder een factuur die echt nog geld vraagt en
       niet betwist is */
    if (st.open && !st.bezwaar) {
      var vak = betaalVak(ctx, ui, inv, st);
      if (vak) delen.push(vak);
    }

    /* de formulieren uit de route */
    if (actie === 'melden' && st.open && !st.bezwaar) delen.push(meldFormulier(ctx, ui, inv, st));
    else if (actie === 'bezwaar' && st.open && !st.bezwaar) delen.push(bezwaarFormulier(ctx, ui, inv));

    /* de knoppen onderaan, als er geen formulier open staat */
    if (!actie || (actie !== 'melden' && actie !== 'bezwaar')) {
      var knoppen = [];
      if (st.open && !st.bezwaar && fn(acties.betalingMelden)) {
        knoppen.push(ui.el('button', {
          type: 'button', class: 'u-btn klein', text: T(ctx, 'Betaling melden'),
          onclick: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id, actie: 'melden' } }, T(ctx, 'Betaling melden')); }
        }));
      }
      if (inv.documentId && fn(acties.factuurPdf)) {
        knoppen.push(ui.el('button', {
          type: 'button', class: 'u-btn ghost klein',
          onclick: function () { openNaBelofte(ctx, acties.factuurPdf(inv), { vraag: { product: inv.projectId, tekst: overFactuur(ctx, inv) } }); }
        }, [ui.icon('bestand', 16), ui.el('span', { text: T(ctx, 'Bekijk PDF') })]));
      }
      if (st.open && !st.bezwaar && OPEN_VOOR_BEZWAAR.indexOf(str(st.code)) > -1 && fn(acties.bezwaarMaken)) {
        knoppen.push(ui.el('button', {
          type: 'button', class: 'u-btn ghost klein', text: T(ctx, 'Vraag over deze factuur'),
          onclick: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id, actie: 'bezwaar' } }, T(ctx, 'Vraag over deze factuur')); }
        }));
      }
      if (knoppen.length) delen.push(ui.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;' }, knoppen));
    }

    return ui.el('div', {
      class: 'u-hero',
      role: 'region',
      'aria-label': nummer ? TPL(ctx, 'Factuur {nummer}', { nummer: nummer }) : T(ctx, 'Factuur'),
      style: 'margin:0 16px 16px;'
    }, stapel(ui, delen, 14));
  }

  /* HET BETAALVAK — buildPayBox uit portal.html, in dezelfde eerlijkheid:
       · geen nummer, geen IBAN of geen bedrag → geen QR;
       · wel gegevens maar geen euro → IBAN en BIC voor SWIFT, zonder QR;
       · een IBAN die niet door de controle komt → geen QR (CP_QR weigert).
     De betaalgegevens komen uit ctx.billing (de haak) of, voor het open
     product, uit het al getekende vak in #invoices-list (gekloond, incl.
     de QR). Zonder beide: alleen het kenmerk. Zie kopblok, punt 2. */
  function betaalgegevens(ctx) {
    var b = (ctx && (ctx.billing || ctx.betaalgegevens || ctx.factuurgegevens)) || null;
    return isObj(b) ? b : null;
  }
  function betaalVak(ctx, ui, inv, st) {
    var ref = str(inv.invoiceNumber);
    var due = st.openCents;
    var cur = st.valuta || 'EUR';
    if (!ref || !due) return null;

    var b = betaalgegevens(ctx);
    var Q = root.CP_QR || null;
    if (b && str(b.iban)) {
      var lines = ui.el('div', { class: 'pay-lines' });
      var payLine = function (label, value, mono) {
        lines.appendChild(ui.el('div', null, [
          ui.el('span', { class: 'lbl', text: T(ctx, label) }),
          noI18n(ui.el('span', { class: mono ? 'mono' : '', text: str(value) }))
        ]));
      };
      payLine('IBAN', (Q && fn(Q.ibanPretty)) ? Q.ibanPretty(b.iban) : b.iban, true);
      if (str(b.bic)) payLine('BIC of SWIFT', b.bic, true);
      if (str(b.naam)) payLine('Op naam van', b.naam, false);
      payLine('Bedrag', geld(ctx, due, cur), true);

      var qrSvg = null;
      if (Q && fn(Q.epcSvgElement) && cur === 'EUR') {
        try {
          qrSvg = Q.epcSvgElement({
            name: str(b.naam), iban: str(b.iban), bic: str(b.bic),
            amountCents: due, currency: cur, reference: ref,
            svg: { size: 128, margin: 2, color: '#111', title: TPL(ctx, 'Betaal-QR voor factuur {n}', { n: ref }) }
          });
        } catch (e) { qrSvg = null; }
      }
      /* één zin bij het vak, de rest achter de "i" (advies 1) */
      var noot;
      if (qrSvg) noot = uitleg(ctx, ui, T(ctx, 'Scan de code met je bank-app: bedrag en kenmerk staan er al in.'), T(ctx, 'Liever handmatig? Neem dan bovenstaande gegevens over en vermeld het kenmerk.'), T(ctx, 'Betalen'));
      else if (cur === 'EUR') noot = sub(ui, T(ctx, 'Vermeld het kenmerk bij je overboeking — daarmee wordt je betaling meteen aan deze factuur gekoppeld.'));
      else noot = sub(ui, T(ctx, 'Deze factuur staat niet in euro: maak over via SWIFT met bovenstaande gegevens en vermeld het kenmerk.'));
      noot.setAttribute('class', str(noot.getAttribute('class')) + ' pay-note');
      var hoofd = ui.el('div', { class: 'pay-main' }, [
        ui.el('span', { class: 'pay-kicker', text: T(ctx, 'Betalingskenmerk') }),
        noI18n(ui.el('div', { class: 'pay-ref', text: ref })),
        lines,
        noot
      ]);
      var box = ui.el('div', { class: 'pay-box' }, [hoofd]);
      if (qrSvg) {
        box.appendChild(ui.el('div', { class: 'pay-qr' }, [qrSvg, ui.el('small', { text: T(ctx, 'Scan met je bank-app') })]));
      }
      return box;
    }

    /* het vak dat de oude sectie voor deze factuur al tekende — dezelfde
       QR, letterlijk hergebruikt */
    var oudeRij = oudElement('#invoices-list .inv-row[data-eid="' + cssId(inv.id) + '"]');
    var el = oudeRij ? oudeRij.nextElementSibling : null;
    while (el && !(el.classList && el.classList.contains('inv-row'))) {
      if (el.classList && el.classList.contains('pay-box')) return el.cloneNode(true);
      el = el.nextElementSibling;
    }

    /* zonder betaalgegevens: alleen wat zeker is */
    return ui.el('div', { class: 'pay-box' }, ui.el('div', { class: 'pay-main' }, [
      ui.el('span', { class: 'pay-kicker', text: T(ctx, 'Betalingskenmerk') }),
      noI18n(ui.el('div', { class: 'pay-ref', text: ref })),
      ui.el('p', { class: 'pay-note', text: T(ctx, 'Vermeld het kenmerk bij je overboeking — daarmee wordt je betaling meteen aan deze factuur gekoppeld.') })
    ]));
  }

  /* een invoerfout in dezelfde vorm als de fouten van de datalaag: een Error
     met code én Nederlandse zin, zodat foutTekst() → berichtVoorFout() hem
     precies zo vertaalt als een fout die van de server komt (de zin is
     letterlijk die van FOUTCODES in portaal-data.js — zonder datalaag, in
     een test, staat hij hier als terugval) */
  function invoerFout(code, zin) {
    var e = new Error(zin);
    e.code = code;
    e.nl = true;
    return e;
  }

  /* BETALING MELDEN → ctx.acties.betalingMelden(invoice, {datumISO, cents, kenmerk})
     "Ik heb betaald" in één tik: datum en bedrag staan al goed (vandaag en
     het openstaande bedrag), het kenmerk is niet verplicht en blijft leeg,
     en de knop zegt wat er gebeurt mét het bedrag erin. Het bedrag blijft
     aanpasbaar voor een deelbetaling; de knop volgt mee. Eén bevestiging.
     Dezelfde opbouw als de andere panelen (advies 12): het feit bovenaan
     (factuurnummer als kicker, het openstaande bedrag groot), dan de drie
     velden, dan de ene primaire knop — geen uitlegzin, geen veldhints. */
  function meldFormulier(ctx, ui, inv, st) {
    /* "vandaag" is de lokale dag van ctx.nu (een Z-tijdstempel uit
       portal.html); dayISO uit portaal-model leest die naar lokale tijd,
       dus rond middernacht schuift de dag niet naar UTC */
    var vandaag = dagISO(ctx, (ctx && ctx.nu) || new Date()) || '';
    var datumId = uid('datum'), bedragId = uid('bedrag'), kenmerkId = uid('kenmerk');
    var datumVeld = ui.el('input', { type: 'date', class: 'input', id: datumId, value: vandaag, max: vandaag, required: '' });
    var bedragVeld = ui.el('input', { type: 'text', class: 'input', id: bedragId, inputmode: 'decimal', autocomplete: 'off', value: centsNaarInvoer(st.openCents), required: '' });
    var kenmerkVeld = ui.el('input', { type: 'text', class: 'input', id: kenmerkId, maxlength: '140' });
    var regio = liveRegio(ui);

    /* de knop zegt wat er gebeurt: 'Ik heb € 1.234,56 betaald'. Staat er
       geen leesbaar bedrag in het veld, dan belooft de knop ook geen bedrag. */
    function knopLabel(cents) {
      if (cents === null || cents <= 0) return T(ctx, 'Betaling melden');
      return TPL(ctx, 'Ik heb {bedrag} betaald', { bedrag: geld(ctx, cents, st.valuta) });
    }
    var knop = schrijfKnop(ctx, ui, { label: knopLabel(st.openCents), type: 'submit' });
    noI18n(knop);

    /* de bovengrens: meer melden dan er openstaat is bijna altijd een
       tikfout (1234,56 → 123456). Eén procent speling, minimaal € 1, voor
       afronding en koersverschil. Wie echt meer overmaakte, krijgt naast
       de korte fout de knop "Vraag stellen" (advies 10) — geen mailadres.
       De datalaag en de server kennen deze grens niet (report_payment eist
       alleen > 0), dus dit is de enige plek. */
    var speling = Math.max(100, Math.round(st.openCents / 100));
    var nummer = str(inv.invoiceNumber);
    var vraag = vraagKnop(ctx, ui, inv.projectId, overFactuur(ctx, inv));
    vraag.hidden = true;
    bedragVeld.addEventListener('input', function () {
      zetTekst(knop, knopLabel(invoerNaarCents(bedragVeld.value)));
      vraag.hidden = true;
    });

    var annuleer = ui.el('button', {
      type: 'button', class: 'u-btn ghost', text: T(ctx, 'Annuleer'),
      onclick: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id } }, T(ctx, 'Annuleer')); }
    });

    var form = ui.el('form', {
      onsubmit: function (e) {
        e.preventDefault();
        var cents = invoerNaarCents(bedragVeld.value);
        if (cents === null) { zetTekst(regio, foutTekst(ctx, invoerFout('bedrag_ongeldig', 'Vul een bedrag in dat groter is dan nul.'))); bedragVeld.focus(); return; }
        if (cents > st.openCents + speling) {
          zetTekst(regio, TPL(ctx, 'Dit bedrag is hoger dan wat er openstaat ({open}).', { open: geld(ctx, st.openCents, st.valuta) }));
          vraag.hidden = false;
          bedragVeld.focus();
          return;
        }
        var dag = dagISO(ctx, trim(datumVeld.value));
        if (!dag) { zetTekst(regio, foutTekst(ctx, invoerFout('datum_ontbreekt', 'Vul de datum van je betaling in.'))); datumVeld.focus(); return; }
        if (vandaag && dag > vandaag) { zetTekst(regio, foutTekst(ctx, invoerFout('datum_in_toekomst', 'De betaaldatum kan niet in de toekomst liggen.'))); datumVeld.focus(); return; }
        var acties = ACTIES(ctx);
        voerUit(ctx, knop, regio, function () {
          if (!fn(acties.betalingMelden)) throw new Error('Deze actie is nog niet beschikbaar.');
          return acties.betalingMelden(inv, { datumISO: dag, cents: cents, kenmerk: trim(kenmerkVeld.value) });
        }, {
          bezig: 'Bezig met melden…',
          klaar: 'Dankjewel. Steffan controleert het en je ziet hier Betaald zodra het klopt.',
          vraag: { product: inv.projectId, tekst: overFactuur(ctx, inv) },
          daarna: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id } }, T(ctx, 'Dankjewel. Steffan controleert het en je ziet hier Betaald zodra het klopt.')); }
        });
      }
    }, [
      /* het feit bovenaan, in de vorm van de andere panelen (.u-hero-kop
         met kicker en kop): factuurnummer, openstaand bedrag groot */
      ui.el('div', { class: 'u-hero-kop', style: 'margin-bottom:16px;' }, [
        ui.el('div', null, [
          ui.el('span', { class: 'u-kicker', text: nummer ? TPL(ctx, 'Factuur {nummer}', { nummer: nummer }) : T(ctx, 'Factuur') }),
          /* font-size inline: .u-shell h2 (admin-ui.css, 0,1,1) wint van .k-feit-getal (skin 10f) */
          noI18n(ui.el('h2', { class: 'k-feit-getal', text: geld(ctx, st.openCents, st.valuta) })),
          ui.el('p', { class: 'u-sub', style: 'margin-top:4px;', text: T(ctx, 'Openstaand') })
        ])
      ]),
      ui.el('div', { class: 'formrow' }, [
        veldVak(ui, T(ctx, 'Datum van je betaling'), datumVeld),
        veldVak(ui, T(ctx, 'Bedrag'), bedragVeld)
      ]),
      veldVak(ui, T(ctx, 'Kenmerk van je overboeking (niet verplicht)'), kenmerkVeld),
      ui.el('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, [knop, annuleer]),
      ui.el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;' }, [regio, vraag]),
      voorvertoningNoot(ctx, ui)
    ]);
    var labels = form.querySelectorAll('label.field');
    if (labels[0]) labels[0].setAttribute('for', datumId);
    if (labels[1]) labels[1].setAttribute('for', bedragId);
    if (labels[2]) labels[2].setAttribute('for', kenmerkId);
    return ui.el('div', { class: 'u-card', style: 'padding:20px 22px;' }, form);
  }

  /* VRAAG OVER DEZE FACTUUR → ctx.acties.bezwaarMaken(invoice, reden) */
  function bezwaarFormulier(ctx, ui, inv) {
    var id = uid('reden');
    var ta = ui.el('textarea', {
      class: 'input', id: id, rows: '4', maxlength: '2000',
      placeholder: T(ctx, 'Bijvoorbeeld: dit bedrag zat volgens de offerte al in de toolingprijs.')
    });
    var regio = liveRegio(ui);
    var knop = schrijfKnop(ctx, ui, { label: T(ctx, 'Verstuur'), type: 'submit' });
    var annuleer = ui.el('button', {
      type: 'button', class: 'u-btn ghost', text: T(ctx, 'Annuleer'),
      onclick: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id } }, T(ctx, 'Annuleer')); }
    });
    var form = ui.el('form', {
      onsubmit: function (e) {
        e.preventDefault();
        var reden = trim(ta.value);
        if (!reden) { zetTekst(regio, T(ctx, 'Beschrijf waarom je bezwaar maakt.')); ta.focus(); return; }
        var acties = ACTIES(ctx);
        voerUit(ctx, knop, regio, function () {
          if (!fn(acties.bezwaarMaken)) throw new Error('Deze actie is nog niet beschikbaar.');
          return acties.bezwaarMaken(inv, reden);
        }, {
          bezig: 'Bezig met versturen…',
          klaar: 'Je vraag is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.',
          vraag: { product: inv.projectId, tekst: overFactuur(ctx, inv) },
          daarna: function () { deel(ctx, { area: 'betalingen', params: { item: inv.id } }, T(ctx, 'Je vraag is verstuurd. Meestal antwoordt Steffan binnen 1 werkdag.')); }
        });
      }
    }, [
      /* dezelfde opbouw als het meldpaneel (advies 12): het feit als kicker,
         de kop, één zin */
      ui.el('div', { class: 'u-hero-kop', style: 'margin-bottom:16px;' }, [
        ui.el('div', null, [
          ui.el('span', { class: 'u-kicker', text: str(inv.invoiceNumber) ? TPL(ctx, 'Factuur {nummer}', { nummer: str(inv.invoiceNumber) }) : T(ctx, 'Factuur') }),
          ui.el('h2', { style: 'font-size:24px;font-weight:500;letter-spacing:-.012em;', text: T(ctx, 'Vraag over deze factuur') }),
          ui.el('p', { class: 'u-sub', style: 'margin-top:6px;', text: T(ctx, 'Je vraag zet de herinneringen stil en legt de factuur bij Steffan.') })
        ])
      ]),
      veldVak(ui, T(ctx, 'Wat klopt er niet?'), ta),
      ui.el('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;' }, [knop, annuleer]),
      regio,
      voorvertoningNoot(ctx, ui)
    ]);
    var lbl = form.querySelector('label.field');
    if (lbl) lbl.setAttribute('for', id);
    return ui.el('div', { class: 'u-card', style: 'padding:20px 22px;' }, form);
  }

  /* een creditnota: bedrag, datum, PDF — geen betaalvak, geen melding */
  function creditnotaRij(ctx, ui, cn) {
    var acties = ACTIES(ctx);
    var nummer = str(cn.invoiceNumber);
    var totaal = Number(cn.totalCents) > 0 ? Number(cn.totalCents) : (Number(cn.amountCents) || 0);
    var titel = nummer ? TPL(ctx, 'Creditnota {nummer}', { nummer: nummer }) : T(ctx, 'Creditnota');
    var menu = [];
    if (cn.documentId && fn(acties.factuurPdf)) {
      menu.push({ label: T(ctx, 'Bekijk PDF'), ico: 'bestand', onKies: function () { openNaBelofte(ctx, acties.factuurPdf(cn), { vraag: { product: cn.projectId, tekst: overOnderwerp(ctx, titel) } }); } });
    }
    var rij = ui.entityRow({
      thumb: ui.iconTile({ icoon: 'pijlOmlaag', toon: 'klaar', maat: 44 }),
      titel: titel + (str(cn.label) ? ' · ' + str(cn.label) : ''),
      sub: [projectNaam(ctx, cn.projectId), cn.createdAt ? datumKort(ctx, cn.createdAt) : ''].filter(function (x) { return !!x; }).join(' · '),
      meta: geld(ctx, Math.round(totaal), str(cn.currency) || 'EUR'),
      menu: menu
    });
    noI18nBinnen(rij, '.u-row-title, .u-row-sub, .u-row-meta');
    return rij;
  }

  /* ============================================================
     EXPORT
     ============================================================ */
  return {
    VERSION: VERSION,
    berichten: schermBerichten,
    bestanden: schermBestanden,
    betalingen: schermBetalingen,
    /* voor de badge in portal.html (advies 16): het aantal antwoorden van
       Steffan dat de klant nog niet zag — zie kopblok, "DE GEZIEN-MARKERING" */
    ongelezenAntwoorden: ongelezenAntwoorden,
    /* voor tests: de twee rekenhulpjes die geld lezen en schrijven */
    invoerNaarCents: invoerNaarCents,
    centsNaarInvoer: centsNaarInvoer
  };
});
