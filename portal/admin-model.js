/* CUSTOM+ — reken- en regellaag van de nieuwe beheerindeling.
   ------------------------------------------------------------------
   DIT BESTAND WEET NIETS VAN HET SCHERM. Er staat geen document in, geen
   window, geen localStorage en geen enkele Date.now() als stilzwijgende
   standaard. Alles wat "nu" nodig heeft krijgt een nowIso mee, zodat een
   test de klok kan vastzetten en morgen dezelfde uitkomst krijgt als
   vandaag. Dat is de hele reden dat deze laag los van beheer.html staat:
   de indeling van het beheer verandert (negen tabbladen worden vijf
   werkgebieden), maar de vraag "wat speelt er en wie is aan zet" mag niet
   per scherm een ander antwoord geven.

   WAAROM DIT BESTAAND WERK IS EN GEEN NIEUWE WAARHEID
   De rekenkern zit al in beheer.html: computeSignals(), computeCounts(),
   nextActionFor(), computeClientHealth(), buildWeekBoard() en updateBadge().
   Die functies blijven staan. Wat hier gebeurt is het formaliseren van de
   regels die daar vandaag ad hoc in buildVandaag() worden toegepast —
   eigenaarschap, snooze, pin, najagen — plus de nieuwe navigatie. Er is
   geen enkel nieuw databaseveld voor nodig: elke sleutel die hier wordt
   gelezen bestaat al.

   DRIE AFSPRAKEN DIE DE REST VAN HET BESTAND VERKLAREN

   1. NIETS CRASHT OP ONTBREKENDE DATA. Elke lijst mag undefined zijn, elk
      item mag velden missen. Een lege bron levert een lege lijst op, nooit
      een uitzondering. Het beheer haalt tien verzamelingen tegelijk op en
      één trage of lege bron mag geen leeg scherm veroorzaken.

   2. SORTEREN IS ALTIJD STABIEL. Elke sortering eindigt op de
      oorspronkelijke index als laatste vergelijking, zodat twee items met
      gelijke sleutels nooit van plaats wisselen tussen twee renders.
      Array.prototype.sort is pas vanaf ES2019 gegarandeerd stabiel en dit
      bestand draait ook in oudere motoren.

   3. DAGEN ZIJN KALENDERDAGEN. daysSince() in beheer.html telt blokken van
      24 uur; daysBetween() hier telt kalenderdagen. Een vraag van gisteren
      om 23:00 is voor een lezer "1 dag geleden", niet "0". Dat is een
      bewust verschil van hooguit één dag en het staat hier expliciet
      omdat isChasing() (bal langer dan 3 dagen bij de fabriek) daarop
      leunt.

   Publieke API (globalThis.CP_MODEL, en module.exports in Node). Deze lijst
   volgt de exporttabel onderaan het bestand exact; loopt hij daarop achter,
   dan bouwt een scherm de ontbrekende functie na en ontstaat er een tweede
   waarheid:
     VERSION
     AREAS
     parseRoute / buildRoute / routeEquals / tabOf
     legacyViewToRoute / routeToLegacyView / LEGACY_VIEW_NAMES
     OWNERS / itemKey / ownerOf / doorKlant
     isSnoozed / snoozedUntil / isPinned / isChasing
     INBOX_CHIPS / collectInbox / filterInbox / inboxBadgeCount
     REORDER_STAGES / reorderPipelineOf
     answerDeadlineISO / invoiceDueISO / isConceptRow
     PROJECT_CHIPS / filterProjects / sortProjects / nextDateFor
     isArchived / isFinished
     ACTIVITY_KINDS / mergeActivity
     daysBetween / relativeDay / formatDate / formatDateTime / dayISO / dateParts

   LADEN
     browser : <script src="portal/admin-model.js"></script> vóór het
               hoofdscript van beheer.html — het bestand zet zichzelf op
               globalThis als CP_MODEL.
     node    : import '../portal/admin-model.js' (of require) — het zet
               zichzelf óók op module.exports, dus
               test/admin-model.test.mjs kan het gewoon importeren.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_MODEL = api;
  /* Node/CommonJS: er is geen package.json met "type":"module", dus dit
     bestand is daar CJS en dit is een echte export. Draait het ooit als
     ESM, dan bestaat `module` niet en blijft alleen globalThis over. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     0. KALE HULPJES
     Bewust hier en niet gedeeld met beheer.html: dit bestand mag
     nergens van afhangen, anders is het niet los te testen.
     ============================================================ */

  function list(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* map van id naar rij, zonder ooit op een lege lijst te klappen */
  function indexBy(rows, key) {
    var out = {};
    list(rows).forEach(function (r) {
      if (r && r[key] !== undefined && r[key] !== null) out[r[key]] = r;
    });
    return out;
  }

  function pad2(n) { var s = String(n); return s.length < 2 ? '0' + s : s; }
  function pad4(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }

  /* GELD IS GEHELE CENTEN (huisregel 6); dit is de enige plek in deze laag
     die er een tekst van maakt, en die bestaat alleen omdat de Inbox-titel
     van een gemelde betaling het bedrag noemt. Bewust zonder Intl: Node
     zonder volledige ICU en een oude browser geven daar verschillende
     uitkomsten, en een titel moet in de test hetzelfde luiden als op het
     scherm. Zelfde schrijfwijze en dezelfde tekens als invoice-payments.js:
     '€ 1.875,00', en voor een munt zonder bekend teken de ISO-code
     ('SEK 12,50'). Altijd twee decimalen: de drie munten die het beheer
     kent (EUR, USD, CNY) hebben er alle drie twee. */
  var CURRENCY_SYMBOLS = { EUR: '€', USD: '$', CNY: '¥', JPY: '¥', GBP: '£' };
  /* duizendtallen met een punt ('3.000'), voor een geheel getal. Eén plek,
     zodat het aantal van een herbestelling en het hele deel van een bedrag
     dezelfde schrijfwijze hebben — zonder Intl, om dezelfde reden als
     formatCents hieronder. */
  function groepDuizend(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function formatCents(cents, currency) {
    var n = (typeof cents === 'number') ? cents : parseInt(str(cents), 10);
    if (typeof n !== 'number' || isNaN(n) || !isFinite(n)) n = 0;
    n = Math.round(n);
    var code = str(currency || 'EUR').toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) code = 'EUR';
    var sym = CURRENCY_SYMBOLS[code] || code;
    var neg = n < 0;
    if (neg) n = -n;
    var whole = Math.floor(n / 100), rest = n - whole * 100;
    var txt = groepDuizend(whole) + ',' + pad2(rest);
    return (neg ? '-' : '') + sym + ' ' + txt;
  }

  /* ============================================================
     1. DATUM EN TIJD — zonder library, zo min mogelijk tijdzone

     De hele codebase schrijft datums als 'YYYY-MM-DD' (dagen) of als een
     volledige ISO-tijdstempel met Z (gebeurtenissen). Een kale dag mag
     NOOIT door new Date() heen: '2026-03-12' wordt in sommige motoren
     UTC-middernacht en schuift dan in Nederland een dag terug bij het
     formatteren. Daarom leest dateParts() de cijfers letterlijk zodra er
     geen tijdzone in de tekst staat, en gebruikt het alleen Date wanneer
     er wél een Z of een offset staat — precies zoals fmtDateTime() in
     beheer.html dat vandaag doet, dus zonder gedragsverschil.
     ============================================================ */

  var MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|z|[+-]\d{2}:?\d{2})?)?$/;

  /* {y, m, d, hh, mm, hasTime} of null. m is 1-12.

     De regex laat elke twee cijfers als maand en als dag door, dus '2026-13-45'
     komt er als vorm doorheen. Zonder grens schrijft formatDate() dan
     MONTHS_SHORT[12] op het scherm en dat is letterlijk het woord "undefined".
     Een onleesbare datum hoort null te geven — dat is de bestaande afspraak
     en de aanroepers vertalen null al naar een lege tekst. */
  function dateParts(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'object' && typeof v.getTime === 'function') {
      if (isNaN(v.getTime())) return null;
      return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate(), hh: v.getHours(), mm: v.getMinutes(), hasTime: true };
    }
    var s = str(v);
    var m = s.match(ISO_RE);
    if (m) {
      if (!m[7]) {
        /* geen tijdzone in de tekst: de cijfers zijn de waarheid, maar wel
           binnen de kalender. 31 in een maand van 30 dagen laten we staan:
           dat is een bestaande dag in de verkeerde maand, geen onzin, en
           dayIndex() rekent hem via Date.UTC netjes door. */
        var mo = +m[2], da = +m[3];
        if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
        return { y: +m[1], m: mo, d: da, hh: m[4] ? +m[4] : 0, mm: m[5] ? +m[5] : 0, hasTime: !!m[4] };
      }
      var dz = new Date(s);
      if (isNaN(dz.getTime())) return null;
      return { y: dz.getFullYear(), m: dz.getMonth() + 1, d: dz.getDate(), hh: dz.getHours(), mm: dz.getMinutes(), hasTime: true };
    }
    /* laatste redmiddel: iets wat Date wél begrijpt (bv. een datum uit een
       import). Onbekend blijft null, geen gok. */
    var d2 = new Date(s);
    if (isNaN(d2.getTime())) return null;
    return { y: d2.getFullYear(), m: d2.getMonth() + 1, d: d2.getDate(), hh: d2.getHours(), mm: d2.getMinutes(), hasTime: true };
  }

  /* 'YYYY-MM-DD' of null — de vorm waarin de hele app dagen vergelijkt */
  function dayISO(v) {
    var p = dateParts(v);
    if (!p) return null;
    return pad4(p.y) + '-' + pad2(p.m) + '-' + pad2(p.d);
  }

  /* dagnummer sinds 1970 via Date.UTC: puur rekenen, geen tijdzone */
  function dayIndex(v) {
    var p = dateParts(v);
    if (!p) return null;
    return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }

  /* "nu" is altijd een parameter; deze fallback bestaat alleen zodat een
     aanroeper hem mág weglaten, nooit zodat een test hem niet kan zetten */
  function nowISO(nowIso) { return nowIso || new Date().toISOString(); }
  function todayOf(nowIso) { return dayISO(nowISO(nowIso)) || dayISO(new Date()); }

  /* geheel aantal kalenderdagen van a naar b (b later = positief) */
  function daysBetween(aIso, bIso) {
    var a = dayIndex(aIso), b = dayIndex(bIso);
    if (a === null || b === null) return null;
    return b - a;
  }

  /* Bewust exact deze vier vormen en geen vijfde: de woordenlijst van de
     opdracht is 'vandaag', 'gisteren', 'over N dagen' en 'N dagen geleden'.
     'morgen' ontbreekt daar met opzet — een scherm dat het wél wil, kan
     zelf op daysBetween()===1 controleren. */
  function relativeDay(iso, nowIso) {
    var n = daysBetween(todayOf(nowIso), iso);
    if (n === null) return '';
    if (n === 0) return 'vandaag';
    if (n === -1) return 'gisteren';
    if (n > 0) return 'over ' + n + (n === 1 ? ' dag' : ' dagen');
    return (-n) + ' dagen geleden';
  }

  function formatDate(iso) {
    var p = dateParts(iso);
    if (!p) return '';
    return p.d + ' ' + MONTHS_SHORT[p.m - 1] + ' ' + p.y;
  }

  /* een kale dag krijgt geen verzonnen 00:00 achter zich: dat zou een
     precisie suggereren die de bron niet heeft */
  function formatDateTime(iso) {
    var p = dateParts(iso);
    if (!p) return '';
    var d = p.d + ' ' + MONTHS_SHORT[p.m - 1] + ' ' + p.y;
    if (!p.hasTime) return d;
    return d + ' ' + pad2(p.hh) + ':' + pad2(p.mm);
  }

  /* ============================================================
     2. BESTEMMINGEN EN ROUTES

     Hash-routing, geen bibliotheek, geen pushState: het beheer wordt zowel
     als los bestand (file://) als via Netlify geopend en alleen een hash
     overleeft dat allebei.

     GRAMMATICA — de vorm van een pad hangt af van het werkgebied, want een
     tweede segment is niet overal hetzelfde:
       #/projecten/<id>/<tab>              werkgebied met entiteiten
       #/factuur/<id>                      idem (eigen route, géén tab van
                                           Financiën: de factuureditor heeft
                                           onopgeslagen staat)
       #/relaties/<klanten|fabrieken>/<id>/<tab>
       #/instellingen/<categorie>          werkgebied zonder entiteiten:
                                           het tweede segment IS de tab
     Vandaar het extra veld `sub` in het routeobject. Zonder dat veld past
     '#/relaties/klanten/cl-2/facturen' simpelweg niet in {area,id,tab} en
     kan buildRoute(parseRoute(h)) nooit weer h opleveren.

     TWEE TEKSTVELDEN, EEN BETEKENIS PER VELD
       raw        ALTIJD de canonieke vorm: raw === buildRoute(route). Elke
                  functie hier zet hem zo, dus twee routes met dezelfde
                  betekenis hebben ook dezelfde raw. Wie een route wil tonen,
                  loggen of vergelijken gebruikt dit veld.
       ingevoerd  de ruwe tekst zoals de gebruiker of de adresbalk hem
                  aanleverde, ongewijzigd. Alleen parseRoute vult hem; een
                  route die uit een oude viewnaam is gebouwd heeft geen
                  ingetypte tekst en houdt hier null.
     Eerder betekende `raw` per functie iets anders (parseRoute gaf de invoer
     terug, finishRoute de opgeschoonde vorm), zodat een scherm soms '#/INBOX'
     en soms '#/inbox' te zien kreeg. Een scherm dat de letterlijk getypte
     hash wil tonen — bijvoorbeeld in "Onbekend werkgebied" — leest dus
     `ingevoerd` en niet `raw`.

     TABBLADEN: TWEE VORMEN NAAST ELKAAR
       #/projecten/pr-1/financien   tab van een ENTITEIT  -> route.tab
       #/financien?tab=concepten    tab van een WERKGEBIED -> route.params.tab
     Dat verschil is echt (een werkgebied zonder entiteiten zet zijn keuze in
     de query, zodat het pad vrij blijft) maar geen enkel scherm hoort het te
     hoeven weten. Daarvoor is tabOf(route, terugval): dat is de ENIGE manier
     waarop een consument een tab hoort te lezen.
     ============================================================ */

  var AREAS = [
    { key: 'overzicht',    label: 'Overzicht',    path: '#/overzicht',    primary: true },
    { key: 'inbox',        label: 'Inbox',        path: '#/inbox',        primary: true },
    { key: 'projecten',    label: 'Projecten',    path: '#/projecten',    primary: true },
    { key: 'relaties',     label: 'Relaties',     path: '#/relaties',     primary: true },
    { key: 'financien',    label: 'Financiën',    path: '#/financien',    primary: true },
    { key: 'activiteit',   label: 'Activiteit',   path: '#/activiteit',   primary: false },
    { key: 'instellingen', label: 'Instellingen', path: '#/instellingen', primary: false }
  ];

  /* 'factuur' staat bewust NIET in AREAS: hij hoort niet in de zijbalk,
     maar is wel een geldige route (beslissing 2.2 — de factuureditor
     blijft een eigen scherm). */
  var EXTRA_ROUTE_AREAS = { factuur: true };
  /* werkgebieden waar het tweede segment een id is in plaats van een tab */
  var AREAS_WITH_ID = { projecten: true, factuur: true };
  var RELATIE_SUBS = { klanten: true, fabrieken: true };

  function isRouteArea(key) {
    if (EXTRA_ROUTE_AREAS[key]) return true;
    for (var i = 0; i < AREAS.length; i++) { if (AREAS[i].key === key) return true; }
    return false;
  }

  function decodeSeg(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }
  function encodeSeg(s) { return encodeURIComponent(str(s)); }

  function parseQuery(query) {
    var out = {};
    var q = str(query);
    if (!q) return out;
    var parts = q.split('&');
    for (var i = 0; i < parts.length; i++) {
      var raw = parts[i];
      if (!raw) continue;
      var eq = raw.indexOf('=');
      var k = eq > -1 ? raw.slice(0, eq) : raw;
      var v = eq > -1 ? raw.slice(eq + 1) : '';
      k = decodeSeg(k.replace(/\+/g, ' '));
      if (!k) continue;
      /* onbekende parameters blijven gewoon staan — de router mag niet
         bepalen welke parameters een scherm zinvol vindt */
      out[k] = decodeSeg(v.replace(/\+/g, ' '));
    }
    return out;
  }

  /* alfabetisch, zodat dezelfde route altijd exact dezelfde tekst geeft */
  function buildQuery(params) {
    if (!isObj(params)) return '';
    var keys = [];
    for (var k in params) {
      if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
      if (params[k] === null || params[k] === undefined) continue;
      keys.push(k);
    }
    keys.sort();
    var out = [];
    for (var i = 0; i < keys.length; i++) {
      var v = str(params[keys[i]]);
      /* een lege waarde wordt een kale sleutel: dat is de vorm die
         parseRoute óók weer als lege string teruggeeft */
      out.push(v === '' ? encodeSeg(keys[i]) : encodeSeg(keys[i]) + '=' + encodeSeg(v));
    }
    return out.join('&');
  }

  function blankRoute(ingevoerd) {
    /* raw blijft hier bewust leeg: parseRoute() zet hem als laatste, zodat
       hij gegarandeerd de canonieke vorm van de UITEINDELIJKE route is en
       niet van de route zoals hij halverwege het lezen was */
    return { area: 'overzicht', sub: null, id: null, tab: null, params: {}, raw: '', ingevoerd: str(ingevoerd) };
  }

  /* het echte lezen; parseRoute() eromheen zet alleen nog raw */
  function readRoute(hash) {
    var raw = str(hash);
    var route = blankRoute(raw);
    var s = raw;
    var h = s.indexOf('#');
    if (h > -1) s = s.slice(h + 1);
    var query = '';
    var qi = s.indexOf('?');
    if (qi > -1) { query = s.slice(qi + 1); s = s.slice(0, qi); }

    var segs = [];
    var rawSegs = s.split('/');
    for (var i = 0; i < rawSegs.length; i++) { if (rawSegs[i]) segs.push(rawSegs[i]); }

    var area = segs.length ? decodeSeg(segs[0]).toLowerCase() : '';
    /* onbekende of lege hash: naar Overzicht, en de rest van het pad gaat
       mee de prullenbak in — parameters van een route die niet bestaat
       zijn geen state van het scherm waar je landt */
    if (!isRouteArea(area)) return route;

    route.area = area;
    route.params = parseQuery(query);

    if (area === 'relaties') {
      var sub = segs[1] ? decodeSeg(segs[1]).toLowerCase() : null;
      if (sub && RELATIE_SUBS[sub]) {
        route.sub = sub;
        if (segs[2]) route.id = decodeSeg(segs[2]);
        if (segs[3]) route.tab = decodeSeg(segs[3]).toLowerCase();
      } else if (sub) {
        /* '#/relaties/onzin' is geen fout maar een landing: Klanten is de
           standaardverzameling van dit werkgebied */
        route.sub = 'klanten';
      }
      return route;
    }
    if (AREAS_WITH_ID[area]) {
      if (segs[1]) route.id = decodeSeg(segs[1]);
      if (segs[2]) route.tab = decodeSeg(segs[2]).toLowerCase();
      return route;
    }
    if (segs[1]) route.tab = decodeSeg(segs[1]).toLowerCase();
    return route;
  }

  function parseRoute(hash) {
    var route = readRoute(hash);
    route.raw = buildRoute(route);
    return route;
  }

  function buildRoute(route) {
    if (typeof route === 'string') return buildRoute(parseRoute(route));
    var r = isObj(route) ? route : {};
    var area = str(r.area).toLowerCase();
    if (!isRouteArea(area)) area = 'overzicht';
    var out = '#/' + area;
    if (area === 'relaties') {
      var sub = str(r.sub).toLowerCase();
      if (RELATIE_SUBS[sub]) {
        out += '/' + encodeSeg(sub);
        if (r.id) {
          out += '/' + encodeSeg(r.id);
          if (r.tab) out += '/' + encodeSeg(r.tab);
        }
      }
    } else if (AREAS_WITH_ID[area]) {
      if (r.id) {
        out += '/' + encodeSeg(r.id);
        if (r.tab) out += '/' + encodeSeg(r.tab);
      }
    } else if (r.tab) {
      out += '/' + encodeSeg(r.tab);
    }
    var q = buildQuery(r.params);
    if (q) out += '?' + q;
    return out;
  }

  function routeEquals(a, b) { return buildRoute(a) === buildRoute(b); }

  /* DE ENIGE MANIER OM EEN TAB TE LEZEN.
     Een entiteitstab staat in het pad (route.tab), een werkgebiedtab in de
     query (route.params.tab). Wie dat verschil zelf uitschrijft, leest de
     ene helft van de routes stil verkeerd — '#/financien?tab=concepten'
     opent dan Facturen zonder enige melding. Beide vormen worden hier in
     kleine letters teruggegeven, zodat een scherm zijn tabsleutels op één
     manier mag vergelijken; de adresbalk houdt de schrijfwijze van de
     gebruiker. Staat er geen tab, dan komt `terugval` terug (of null). */
  function tabOf(route, terugval) {
    var r = (typeof route === 'string') ? parseRoute(route) : (isObj(route) ? route : {});
    var params = isObj(r.params) ? r.params : {};
    var t = str(r.tab).toLowerCase() || str(params.tab).toLowerCase();
    if (t) return t;
    return terugval === undefined ? null : terugval;
  }

  /* ---------- compatibiliteitslaag oud ↔ nieuw ----------
     De storage-listener in beheer.html (cross-tab-verversing vanuit
     portal.html) noemt de viewnamen 'questions', 'log', 'vandaag' en
     'aanvragen' hard in de code en breekt STIL zonder deze mapping. Elke
     nieuwe route moet dus een oude naam kunnen teruggeven. */

  var LEGACY_VIEW_NAMES = [
    'vandaag', 'aanvragen', 'wachtrij', 'questions',
    'clients', 'client', 'factories',
    'projects', 'project', 'log', 'settings', 'factuur'
  ];

  function finishRoute(r) {
    var out = {
      area: r.area || 'overzicht',
      sub: r.sub || null,
      id: r.id || null,
      tab: r.tab || null,
      params: isObj(r.params) ? r.params : {}
    };
    out.raw = buildRoute(out);
    /* deze route komt uit een oude viewnaam en niet uit de adresbalk: er is
       dus geen ingetypte tekst om te bewaren, en null zeggen is eerlijker
       dan de canonieke vorm nog een keer opschrijven */
    out.ingevoerd = null;
    return out;
  }

  function legacyViewToRoute(view) {
    var v = isObj(view) ? view : { name: str(view) };
    var name = str(v.name);
    if (name === 'vandaag') return finishRoute({ area: 'overzicht' });
    if (name === 'aanvragen') return finishRoute({ area: 'inbox', params: { chip: 'nieuw' } });
    if (name === 'wachtrij') return finishRoute({ area: 'inbox', params: { chip: 'concepten' } });
    if (name === 'questions') return finishRoute({ area: 'inbox', params: { chip: 'wachtopmij' } });
    if (name === 'clients') return finishRoute({ area: 'relaties', sub: 'klanten' });
    if (name === 'client') return finishRoute({ area: 'relaties', sub: 'klanten', id: v.clientId || null });
    if (name === 'factories') return finishRoute({ area: 'relaties', sub: 'fabrieken' });
    if (name === 'projects') return finishRoute({ area: 'projecten' });
    if (name === 'project') return finishRoute({ area: 'projecten', id: v.projectId || null });
    if (name === 'log') return finishRoute({ area: 'activiteit' });
    /* DE ENIGE DEEPLINK DIE HET BEHEER KENT, EN HIJ LANDDE VERKEERD.

       In de oude indeling was Instellingen één lange pagina en betekende
       go({name:'settings'}) "open die pagina". Precies één plek in
       beheer.html roept dat aan: de knop "Go-live-checklist" in
       openModeStatusModal — het venster achter de Demo-badge. Die knop zette
       daar één regel eerder settingsFocusGoLive = true, en het oude
       renderSettings() rolde daarop naar de checklist toe. Dat is de hele
       reden dat de knop bestaat; er is geen tweede aanroeper (de oude
       zijbalkknop met data-nav="settings" wordt in de nieuwe indeling
       vervangen door een knop die rechtstreeks ga({area:'instellingen'})
       doet en dus niet langs deze vertaling komt).

       In de nieuwe indeling is Instellingen opgesplitst in negen routes en
       staat de checklist onder Integraties. Zonder de tab hieronder landde
       die knop op de CATEGORIEËNPAGINA: een raster van negen kaarten waar de
       checklist nergens met naam op staat. Het migratieplan noemt dit
       expliciet een risico ("de enige deeplink die het beheer kent — die
       ingang moet blijven"), en een deeplink die je in de buurt afzet is
       precies zo bruikbaar als geen deeplink.

       settingsFocusGoLive zelf is onbereikbaar: hij is een var binnen het
       afgesloten scriptblok van beheer.html. Daarom reist de focuswens mee
       als routeparameter — meteen ook beter, want zo overleeft hij een F5 en
       is de checklist deelbaar. instellingCategorie() leest ?focus=golive en
       zet de focus op het checklistblok. */
    if (name === 'settings') {
      return finishRoute({ area: 'instellingen', tab: 'integraties', params: { focus: 'golive' } });
    }
    if (name === 'factuur') {
      /* een nieuwe factuur heeft nog geen id maar wel een project: dat komt
         als parameter mee, zodat de route deelbaar en verversbaar blijft */
      if (v.invoiceId) return finishRoute({ area: 'factuur', id: v.invoiceId });
      return finishRoute({ area: 'factuur', id: 'nieuw', params: v.projectId ? { project: v.projectId } : {} });
    }
    return finishRoute({ area: 'overzicht' });
  }

  /* Welke oude view hoort bij welke Inbox-chip. 'questions' is de
     terugvaloptie omdat dat één van de vier namen is waarop de
     storage-listener ververst: kiest iemand een chip die geen oud scherm
     heeft, dan blijft cross-tab-verversing tenminste werken. */
  var CHIP_TO_LEGACY = {
    nieuw: 'aanvragen',
    concepten: 'wachtrij',
    gepland: 'wachtrij',
    wachtopmij: 'questions',
    wachtopklant: 'questions',
    goedkeuringen: 'questions',
    uitgesteld: 'questions',
    afgehandeld: 'questions',
    alles: 'questions'
  };

  function routeToLegacyView(route) {
    var r = (typeof route === 'string') ? parseRoute(route) : (isObj(route) ? route : {});
    var area = str(r.area).toLowerCase();
    var params = isObj(r.params) ? r.params : {};
    if (area === 'inbox') {
      return { name: CHIP_TO_LEGACY[str(params.chip)] || 'questions' };
    }
    if (area === 'relaties') {
      if (str(r.sub) === 'fabrieken') {
        /* er bestaat vandaag géén oud fabriekdetailscherm; de lijst is het
           dichtstbijzijnde eerlijke antwoord */
        return { name: 'factories' };
      }
      if (r.id) return { name: 'client', clientId: r.id };
      return { name: 'clients' };
    }
    if (area === 'projecten') {
      /* clientId kent de route niet — go({name:'project'}) geeft hem
         vandaag altijd mee, maar render() gebruikt alleen projectId, dus
         null is veilig en de aanroeper mag hem aanvullen */
      if (r.id) return { name: 'project', projectId: r.id, clientId: null };
      return { name: 'projects' };
    }
    if (area === 'factuur') {
      if (r.id && r.id !== 'nieuw') return { name: 'factuur', invoiceId: r.id, projectId: params.project || null };
      return { name: 'factuur', invoiceId: null, projectId: params.project || null };
    }
    if (area === 'activiteit') return { name: 'log' };
    if (area === 'instellingen') return { name: 'settings' };
    /* Financiën heeft geen oud scherm: de factuuracties stonden verspreid
       over projectdetail en Vandaag. Vandaag is de enige oude view die
       openstaand geld überhaupt toont. */
    if (area === 'financien') return { name: 'vandaag' };
    return { name: 'vandaag' };
  }

  /* ============================================================
     3. WIE IS AAN ZET

     itemState leeft in settings.itemState en wordt geschreven door
     saveItemState() in beheer.html. Vorm van één item, alle velden
     optioneel en afwezig zodra ze leeg zijn (saveItemState verwijdert
     lege waarden in plaats van ze op null te zetten):
       { owner:'klant'|'fabriek', ownerSince:'YYYY-MM-DD',
         snoozedUntil:'YYYY-MM-DD', snoozeReason:'…',
         pinned:true, pinnedAt:'YYYY-MM-DD' }
     Let op: owner 'mij' wordt NOOIT opgeslagen — de selectie 'Bal: mij'
     wist het veld. Afwezig betekent dus mij, en dat is regel 3 hieronder.
     ============================================================ */

  var OWNERS = { MIJ: 'mij', KLANT: 'klant', FABRIEK: 'fabriek' };

  /* De eerste vijf voorvoegsels staan letterlijk zo in computeSignals():
     'q:', 'stage:', 'inv:', 'ship:' en 'smp:'. Ze zijn hier NIET verzonnen
     en mogen niet veranderen, anders raakt elke bestaande snooze en pin
     zijn item kwijt.
     De laatste drie ('brief', 'concept', 'herinnering') hebben vandaag nog
     géén itemState — die itemtypen kennen nog geen pin of snooze. De
     voorvoegsels hieronder zijn dus nieuw en volgen bewust de idvorm van
     de rijen zelf (req-01, doc-…/med-…, cm-…), zodat ze naast de bestaande
     sleutels leesbaar blijven. */
  var KEY_PREFIX = {
    vraag: 'q:',
    fase: 'stage:',
    factuur: 'inv:',
    zending: 'ship:',
    sample: 'smp:',
    brief: 'req:',
    concept: 'cpt:',
    herinnering: 'rem:',
    /* DE VIER KLANTACTIES UIT MIGRATIE 0021 — bewust EIGEN voorvoegsels, ook
       waar de rij al een sleutel had. 'samplebeslissing' gaat over dezelfde
       ronde als 'sample' (smp:) en 'bezwaar' over dezelfde factuur als het
       30+-signaal (inv:), maar het zijn NIEUWE stukken werk: de klant heeft
       net gehandeld. Zou het nieuwe item de sleutel van het oude erven, dan
       erft het ook de itemState van het oude — een sample dat de eigenaar
       vorige week naar de klant had geduwd (owner 'klant') zou als
       samplebeslissing onder Wacht op klant landen en buiten de badge
       vallen, terwijl de klant zojuist gekozen heeft. Een eigen sleutel
       begint schoon bij mij. De vorm volgt de rij-id's (pay-…, doc-…). */
    betaling: 'pay:',
    klantbestand: 'upl:',
    samplebeslissing: 'dec:',
    bezwaar: 'disp:',
    /* DE VIJFDE: een herbestelling uit reorder_requests (0021). Bewust niet
       'q:' — vóór 0021 was een herbestelling een klantvraag met het
       voorvoegsel HERBESTELLING: en die rij bestaat naast de nieuwe tabel
       nog even; twee items op één sleutel zouden elkaars uitstel en pin
       delen. De vorm volgt de rij-id (ro-01). */
    herbestelling: 'ro:'
  };

  /* Voor 'fase' is id de samengestelde sleutel '<projectId>:<stageKey>',
     want zo schrijft computeSignals() hem: 'stage:'+p.id+':'+s.stageKey.
     collectInbox() vult item.id daarom óók samengesteld. */
  function itemKey(kind, id) {
    var pre = KEY_PREFIX[str(kind)];
    if (!pre) return str(id);
    return pre + str(id);
  }

  function keyOf(item) {
    if (!item) return '';
    if (item.key) return str(item.key);
    return itemKey(item.kind, item.id);
  }

  function stateOf(item, itemState) {
    if (!isObj(itemState)) return null;
    var st = itemState[keyOf(item)];
    return isObj(st) ? st : null;
  }

  /* status van de onderliggende rij, waar hij ook zit: het item uit
     collectInbox draagt hem plat, een ruw signaalitem uit computeSignals
     draagt hem in .stage / .sm / .raw */
  function rawStatus(item) {
    if (!item) return '';
    if (item.status) return str(item.status);
    if (item.stage && item.stage.status) return str(item.stage.status);
    if (item.sm && item.sm.status) return str(item.sm.status);
    if (item.raw && item.raw.status) return str(item.raw.status);
    return '';
  }

  /* Drie bronnen, in deze voorrang (beslissing 2.4):
     1. expliciet gezet in itemState
     2. structureel — een fase op akkoord en een samplebeslissing liggen
        per definitie bij de klant, ook zonder dat iemand dat instelde
     3. de rest ligt bij mij */
  function ownerOf(item, itemState) {
    var st = stateOf(item, itemState);
    if (st && st.owner) {
      var o = str(st.owner);
      if (o === OWNERS.KLANT || o === OWNERS.FABRIEK || o === OWNERS.MIJ) return o;
    }
    var kind = item ? str(item.kind) : '';
    if (kind === 'fase' && rawStatus(item) === 'awaiting_approval') return OWNERS.KLANT;
    if (kind === 'sample' && rawStatus(item) === 'reviewed') return OWNERS.KLANT;
    return OWNERS.MIJ;
  }

  /* DEED DE KLANT HET? — één vraag, vier rijsoorten, één antwoord.
     Migratie 0021 markeert per tabel anders wie iets deed, en het beheer
     hoort op elke plek hetzelfde te concluderen (spec §2: "fase toont wie
     akkoord gaf", "document toont herkomst klant", "contactpersonen die de
     klant zelf wijzigde, met markering door klant"). De regels, in de
     volgorde waarin ze gelden:
       stempel         bron / herkomst / source — zet een datalaag die er
                       een op de rij (bv. 'klant' op een client_contacts-rij),
                       dan wint die in beide richtingen: 'klant' is ja, elke
                       andere waarde is nee.
       fase            approvedVia 'portaal' (approve_stage). 'beheer' is een
                       akkoord dat de eigenaar zelf vastlegde en null is van
                       vóór 0021 — allebei NIET door de klant.
       sampleronde     clientDecision 'goedgekeurd' of 'aanpassing'
                       (decide_sample); de status zelf blijft van de staf.
       document        uploadedBy 'klant' — de insertpolicy eist die waarde;
                       'staf' of ontbrekend is een stafdocument.
       betaling        reportedByClient true (report_payment). Geen van de
                       vier uit de opdracht, maar dezelfde vraag.
       contactpersoon  0021 zet GEEN vlag: de herkomst is de tabel zelf
                       (client_contacts naast admin_contacts). Zonder stempel
                       is zo'n rij te herkennen aan velden die admin_contacts
                       (0005) niet heeft — mailCategories en canLogin — en
                       aan het ontbreken van de stafvelden cats en active.
       herbestelling   ook zonder vlag: reorder_requests is een tabel die
                       alleen request_reorder() (de klant) vult, en de rij is
                       te herkennen aan het veld sameSpec — een boolean die
                       geen andere rij in het beheer draagt — naast qty of
                       wantedBy. De oude herbestelling-als-vraag
                       (HERBESTELLING: in question) heeft die velden niet en
                       blijft dus wat hij was.
     Een BETWISTE FACTUUR staat hier bewust NIET bij: de factuureditor kent
     "Als betwist markeren" met de hand, dus statusCode 'disputed' bewijst
     niet dat de klant het deed. Dat bewijs zit in het factuurlogboek (event
     'bezwaar_klant'), en collectInbox() zet het daarom op het item zelf.
     Alles wat niet herkend wordt is NIET door de klant: liever een
     ontbrekende markering dan een verzonnen "door klant". */
  function doorKlant(rij) {
    if (!isObj(rij)) return false;
    var stempel = str(rij.bron || rij.herkomst || rij.source).toLowerCase();
    if (stempel) return stempel === 'klant';
    if (str(rij.approvedVia) === 'portaal') return true;
    var beslissing = str(rij.clientDecision);
    if (beslissing === 'goedgekeurd' || beslissing === 'aanpassing') return true;
    if (str(rij.uploadedBy) === 'klant') return true;
    if (rij.reportedByClient === true) return true;
    if (Array.isArray(rij.mailCategories) || typeof rij.canLogin === 'boolean') {
      if (!Array.isArray(rij.cats) && typeof rij.active !== 'boolean') return true;
    }
    if (typeof rij.sameSpec === 'boolean' && (rij.qty !== undefined || rij.wantedBy !== undefined)) return true;
    return false;
  }

  /* de opgeslagen terugkeerdatum, ongeacht of hij al gepasseerd is */
  function snoozedUntil(item, itemState) {
    var st = stateOf(item, itemState);
    return (st && st.snoozedUntil) ? str(st.snoozedUntil) : null;
  }

  /* Vergelijking op tekst, precies zoals buildVandaag het doet
     (st.snoozedUntil > today): ISO-dagen sorteren alfabetisch gelijk aan
     chronologisch, dus dit is exact en niet bij benadering. */
  function isSnoozed(item, itemState, nowIso) {
    var until = snoozedUntil(item, itemState);
    if (!until) return false;
    return str(until).slice(0, 10) > todayOf(nowIso);
  }

  function isPinned(item, itemState) {
    var st = stateOf(item, itemState);
    return !!(st && st.pinned);
  }

  /* Najagen: de bal ligt langer dan drie dagen bij de fabriek. Geen eigen
     chip meer (beslissing 2.4) maar een urgentiemarkering. */
  function isChasing(item, itemState, nowIso) {
    var st = stateOf(item, itemState);
    if (!st || str(st.owner) !== OWNERS.FABRIEK) return false;
    if (!st.ownerSince) return false;
    var d = daysBetween(st.ownerSince, todayOf(nowIso));
    return d !== null && d > 3;
  }

  /* ============================================================
     4. INBOX
     ============================================================ */

  var INBOX_CHIPS = [
    { key: 'alles',         label: 'Alles' },
    { key: 'nieuw',         label: 'Nieuw' },
    { key: 'wachtopmij',    label: 'Wacht op mij' },
    { key: 'wachtopklant',  label: 'Wacht op klant' },
    { key: 'goedkeuringen', label: 'Goedkeuringen' },
    { key: 'concepten',     label: 'Concepten' },
    { key: 'gepland',       label: 'Gepland' },
    { key: 'uitgesteld',    label: 'Uitgesteld' },
    { key: 'afgehandeld',   label: 'Afgehandeld' }
  ];

  /* DE CHIP VOLGT DE BAL, NIET ALLEEN DE SOORT.

     Tot deze regel bestond, zette collectInbox de chip uitsluitend op
     SOORT: een site-brief werd 'nieuw', een concept en een conceptfactuur
     werden 'concepten', en alleen de klantvraag keek naar de eigenaar.
     Wie de bal bij een aanvraag of een concept naar de klant verlegde, zag
     daardoor wél de badge zakken en wél de statuspil op de rij omslaan,
     maar het item bleef in dezelfde bak staan. De chip "Wacht op klant"
     bevatte dan nooit een aanvraag of een concept, terwijl zijn naam dat
     wel belooft — en dat is precies de soort belofte die dit beheer niet
     mag doen.

     De regel is nu één regel voor alle itemtypen: ligt de bal bij de klant
     of bij de fabriek, dan is de bak 'wachtopklant'; ligt hij bij mij, dan
     houdt het item zijn soortbak ('nieuw', 'concepten') of valt het onder
     'wachtopmij'.

     DRIE BAKKEN DOEN BEWUST NIET MEE, en dat is geen uitzondering maar
     dezelfde gedachte:
       · 'afgehandeld' — daar is de bal nergens meer; het werk is klaar.
       · 'gepland'     — daar wacht een klok, niet een mens (beslissing
                         2.3, dezelfde reden dat de badge hem overslaat).
       · 'goedkeuringen' — dat ís "wacht op klant", maar met een eigen
                         naam en een eigen bak. Het migratieplan wijst de
                         fases op akkoord in hoofdstuk 5 expliciet aan
                         Goedkeuringen toe; ze naar Wacht op klant duwen
                         zou die bak leegmaken.

     De badge blijft rechtstreeks op it.owner tellen (zie inboxBadgeCount).
     Dat is bewust: chip en badge lezen zo dezelfde bron in plaats van dat
     de ene de andere naleest. Wat ze samen garanderen staat in de test
     "de bakken en de badge vertellen hetzelfde verhaal". */
  var CHIP_VAST = { afgehandeld: true, gepland: true, goedkeuringen: true };

  function chipVoorBal(chip, owner) {
    var c = str(chip);
    if (CHIP_VAST[c]) return c;
    if (owner !== OWNERS.MIJ) return 'wachtopklant';
    if (c === 'wachtopklant') return 'wachtopmij';
    return c;
  }

  /* conceptstand: een ontbrekend veld telt als gepubliceerd —
     migratie-veilig, identiek aan isConcept() in beheer.html */
  function isConceptRow(row) { return !!row && row.publishStatus === 'concept'; }

  /* herbestelaanvragen uit "Mijn Producten" beginnen met een vast
     voorvoegsel en horen onder Nieuw, niet tussen de klantvragen */
  function isReorder(q) { return str(q && q.question).indexOf('HERBESTELLING:') === 0; }

  /* ---------- DE VIERSTAPSPIJPLIJN VAN EEN HERBESTELLING ----------
     Mappingtabel: "Herbestellingen met vierstapspijplijn → Inbox 'Nieuw',
     pijplijn in het detailpaneel; settings.reorderPipeline is direct
     herbruikbaar als Inbox-status".

     WAT ER OPGESLAGEN STAAT. Per vraag-id één object in
     settings.reorderPipeline — hetzelfde patroon als itemState, en identiek
     in demo- en Supabase-modus:
       stage       'aanvraag' | 'offerte' | 'akkoord' | 'project'
       quoteDocId  het offerteconcept dat stap 2 heeft aangemaakt
       projectId   het batchproject dat stap 4 heeft aangemaakt — NIET het
                   project waar de herbestelling bij hoort; dat staat op het
                   item zelf.
     Tot deze functie bestond werd die stand door geen enkel nieuw scherm
     gelezen: de herbestelling landde wel in de bak Nieuw, maar zonder stand
     en dus zonder de stap-afhankelijke primaire actie.

     WAAROM DE VIER STAPPEN HIER WÉL STAAN EN DE FASENAMEN NIET.
     Bij een projectfase is de sleutel Engels ('dfm', 'sourcing') en de naam
     Nederlands; die vertaling hoort bij de aanroeper en staat daarom in
     stageLabeler() hierboven. Hier is de sleutel zélf het Nederlandse woord
     en is de naam niets anders dan diezelfde sleutel met een hoofdletter.
     Er valt dus niets te vertalen. Wat hier staat is de VOLGORDE, en die is
     een regel en geen naam. De sleutels zijn bovendien opgeslagen waarden:
     hernoemen zou elke bestaande pijplijnstand ongeldig maken. */
  var REORDER_STAGES = [
    { key: 'aanvraag', label: 'Aanvraag' },
    { key: 'offerte',  label: 'Offerte' },
    { key: 'akkoord',  label: 'Akkoord' },
    { key: 'project',  label: 'Project' }
  ];

  function reorderStageIndex(key) {
    var k = str(key);
    for (var i = 0; i < REORDER_STAGES.length; i++) {
      if (REORDER_STAGES[i].key === k) return i;
    }
    return -1;
  }

  /* {stage, label, index, step, total, steps, next, quoteDocId, projectId}
     of null als er geen vraag-id is.

     EEN LEGE OF ONBEKENDE STAND IS STAP 1. Een herbestelling die nog nooit
     is aangeraakt ís een aanvraag; er wordt hier dus geen stand verzonnen
     maar de beginstand benoemd. Dat is ook precies wat de bestaande
     pijplijnrij doet (stage = st.stage || 'aanvraag'), zodat het oude en het
     nieuwe scherm dezelfde stap aanwijzen.

     `steps` draagt per stap 'done' | 'current' | 'pending' — dezelfde drie
     standen als de klassen van de bestaande chiprij, zodat een scherm die
     rij kan tekenen zonder de volgorde opnieuw af te leiden. `next` is de
     volgende stap of null op de laatste; daaruit kiest het scherm zijn
     stap-afhankelijke primaire actie. */
  function reorderPipelineOf(questionId, settings) {
    var qid = str(questionId);
    if (!qid) return null;
    var blob = (isObj(settings) && isObj(settings.reorderPipeline)) ? settings.reorderPipeline : {};
    var st = isObj(blob[qid]) ? blob[qid] : {};
    var idx = reorderStageIndex(st.stage);
    if (idx < 0) idx = 0;
    var steps = REORDER_STAGES.map(function (rs, i) {
      return {
        key: rs.key,
        label: rs.label,
        state: (i < idx) ? 'done' : ((i === idx) ? 'current' : 'pending')
      };
    });
    var volgende = REORDER_STAGES[idx + 1] || null;
    return {
      stage: REORDER_STAGES[idx].key,
      label: REORDER_STAGES[idx].label,
      index: idx,
      step: idx + 1,
      total: REORDER_STAGES.length,
      steps: steps,
      next: volgende ? { key: volgende.key, label: volgende.label } : null,
      quoteDocId: str(st.quoteDocId) || null,
      projectId: str(st.projectId) || null
    };
  }

  function joinSub(parts) {
    var out = [];
    for (var i = 0; i < parts.length; i++) { if (parts[i]) out.push(str(parts[i])); }
    return out.join(' · ');
  }

  /* FASENAMEN KOMEN VAN DE AANROEPER EN NOOIT UIT DIT BESTAND.
     De fasesleutels zijn Engels — 'dfm', 'sourcing', 'logistics' — en
     beheer.html heeft daar al een Nederlandse tabel voor: STAGES met
     stageLabel(). Die tabel blijft de enige waarheid. Een tweede tabel hier
     zou binnen een maand uit de pas lopen met de eerste, en dan staat in
     dezelfde tijdlijn 'logistics' naast 'Compliance & Logistiek' — precies
     wat beslissing 2.6 (één waarheid per gebeurtenis) verbiedt.
     De bron van collectInbox() en mergeActivity() mag daarom een
     stageLabel(sleutel) meegeven, net zoals timelineRow o.kindLabel
     accepteert. Ontbreekt hij, dan komt de kale sleutel terug: zichtbaar
     onaf, maar nooit een verzonnen vertaling. */
  function stageLabeler(src) {
    var fn = (src && typeof src.stageLabel === 'function') ? src.stageLabel : null;
    return function (key) {
      var k = str(key);
      if (!k || !fn) return k;
      var uit = '';
      /* de tabel van de aanroeper mag struikelen over een sleutel die zij
         niet kent; deze laag gaat daar niet in mee */
      try { uit = str(fn(k)); } catch (e) { uit = ''; }
      return uit || k;
    };
  }

  /* antwoordklok: ontvangst + 1 dag, weekend overslaand. Zelfde belofte
     als answerDeadline() in beheer.html, maar puur op kalenderdagen zodat
     hij zonder Date.now() te testen is. */
  function answerDeadlineISO(askedAt) {
    var p = dateParts(askedAt);
    if (!p) return null;
    var d = new Date(Date.UTC(p.y, p.m - 1, p.d));
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
    return pad4(d.getUTCFullYear()) + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  /* vervaldatum van een factuur. Een echt veld als het bestaat (de
     factuurmodule voegt dueDate toe), anders de bestaande projectie
     aanmaak + 30 dagen — dezelfde grens als het 30+-signaal. */
  function invoiceDueISO(inv) {
    if (!inv) return null;
    if (inv.dueDate) return dayISO(inv.dueDate);
    if (inv.invoiceDueISO) return dayISO(inv.invoiceDueISO);
    var base = dayIndex(inv.createdAt);
    if (base === null) return null;
    var d = new Date((base + 30) * 86400000);
    return pad4(d.getUTCFullYear()) + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  /* stabiel sorteren zonder op de motor te vertrouwen */
  function stableSort(arr, cmp) {
    var wrapped = list(arr).map(function (v, i) { return { v: v, i: i }; });
    wrapped.sort(function (a, b) {
      var r = cmp(a.v, b.v);
      if (r) return r;
      return a.i - b.i;
    });
    return wrapped.map(function (w) { return w.v; });
  }

  function cmpText(a, b) {
    var x = str(a).toLowerCase(), y = str(b).toLowerCase();
    if (x === y) return 0;
    /* geen localeCompare: die kan per motor en per taalinstelling een
       andere volgorde geven, en een lijst moet in Node hetzelfde staan
       als in de browser */
    return x < y ? -1 : 1;
  }

  /* bron = de al opgehaalde lijsten. Alles mag ontbreken:
       questions  DS.listQuestions()
       briefs     DS.listRequests()          site-briefs, status 'omgezet' = klaar
       drafts     DS.listConcepts()          [{kind:'media'|'document', row:{…}}]
       invoices   DS.listAllInvoices()
       projects   DS.listAllProjectsWithStages()
       clients    DS.listClients()
       samples    DS.listAllSamples()
       stages     los meegegeven fases; ontbreekt hij, dan komen ze uit
                  projects[].stages (zo levert de datalaag ze vandaag)
       settings   DS.getSettings()           (itemState én reorderPipeline
                  leven hierin; die laatste levert de pijplijnstand van een
                  herbestelling — zie reorderPipelineOf())
       now        vaste klok voor de test
       stageLabel function(stageKey) -> Nederlandse fasenaam. Optioneel;
                  beheer.html geeft zijn bestaande stageLabel() door.
                  Ontbreekt hij, dan staat de kale Engelse sleutel op het
                  scherm — zie stageLabeler() hierboven.
     SINDS MIGRATIE 0021 ook, en alle drie mogen ontbreken (iaLaadLijsten
     levert ze pas sinds deze ronde; een oudere aanroeper krijgt dan geen
     klantacties in plaats van een lege Inbox):
       clientPayments  invoice_payments-rijen in camelCase. Staat er geen
                       clientPayments, dan invoicePayments — de naam waaronder
                       de demo (demo-data-portaal.js) en beheer.html die lijst
                       al kennen. Een expliciet meegegeven clientPayments wint,
                       ook als hij leeg is.
       documents       DS.listAllDocuments() — voor het bestand van de klant
       invoiceAudit    invoice_audit-rijen; alleen voor de reden van een
                       bezwaar, want 0021 zet die niet op de factuur zelf
       reorders        reorder_requests-rijen in camelCase (de vijfde
                       klantactie). Staat er geen reorders, dan
                       reorderRequests — de naam waaronder beheer.html en de
                       demo die lijst ook kennen. Een expliciet meegegeven
                       reorders wint, ook als hij leeg is.
       questionMessages question_messages-rijen (0020) in camelCase: de
                       gespreksdraad. Zonder deze lijst beslissen alleen
                       question/answeredAt; mét de lijst heropent een
                       reactie van de klant ná het antwoord de vraag (chip
                       wachtopmij, ondertitel "Reactie van de klant",
                       doorKlant true) — zie het vragenblok hieronder.

     ELK ITEM DRAAGT `doorKlant` (boolean, altijd aanwezig): deed de klant
     het? Voor bijna elke soort is dat doorKlant(raw) op de rij zelf; alleen
     een bezwaar kan dat niet uit zijn rij bewijzen (zie doorKlant()) en
     leest het uit het factuurlogboek. Een scherm dat "door klant" toont,
     leest dit veld en leidt het niet zelf nog eens af.

     WAT ER BEWUST NIET IN ZIT
     · verstuurde facturen (status 'open'): die horen in Financiën, niet in
       de werkvoorraad — de Inbox zou anders elke maand vollopen met geld
       waar geen handeling bij hoort.
     · zendingsignalen (ETA en stil): die horen op Overzicht en bij
       Projecten "Vertraagd"; ze hebben een eigen scherm met eigen acties.
     · follow-up-herinneringen: beslissing 2.3 somt op wat de badge telt en
       herinneringen staan daar niet bij. Ze horen op Overzicht → Nu doen.
     itemKey() kent 'zending' en 'herinnering' wél, want nextDateFor() en
     de Overzicht-bouwer gebruiken dezelfde sleutels. */
  function collectInbox(bron) {
    var src = isObj(bron) ? bron : {};
    var now = nowISO(src.now);
    var settings = isObj(src.settings) ? src.settings : {};
    var states = isObj(settings.itemState) ? settings.itemState : {};
    var faseNaam = stageLabeler(src);

    var projects = list(src.projects);
    var pmap = indexBy(projects, 'id');
    var items = [];

    function projectOf(projectId) { return projectId ? pmap[projectId] || null : null; }
    function clientIdOf(projectId) {
      var p = projectOf(projectId);
      return p ? (p.clientId || null) : null;
    }
    function archived(projectId) {
      var p = projectOf(projectId);
      return !!(p && p.status === 'archived');
    }

    function push(spec) {
      var probe = { kind: spec.kind, id: spec.id, status: spec.status, raw: spec.raw };
      var owner = ownerOf(probe, states);
      var until = snoozedUntil(probe, states);
      var stillSnoozed = !!(until && str(until).slice(0, 10) > todayOf(now));
      items.push({
        id: spec.id,
        kind: spec.kind,
        /* de aanroeper levert de SOORTbak; chipVoorBal legt de bal er
           overheen, zodat elk itemtype dezelfde regel volgt */
        chip: chipVoorBal(spec.chip, owner),
        title: spec.title || '',
        sub: spec.sub || '',
        clientId: spec.clientId || null,
        projectId: spec.projectId || null,
        at: spec.at || null,
        owner: owner,
        /* Alleen een snooze die NOG loopt telt als snooze. Een gepasseerde
           terugkeerdatum betekent dat het item terug is; die datum blijft
           als returnedAt bewaard zodat het scherm "terug uit uitstel"
           bovenaan kan zetten, precies zoals het _terug-bakje van
           buildVandaag. Zo hoeft filterInbox geen klok te kennen. */
        snoozedUntil: stillSnoozed ? until : null,
        returnedAt: (until && !stillSnoozed) ? until : null,
        pinned: isPinned(probe, states),
        urgent: !!spec.urgent || isChasing(probe, states, now),
        sourceId: spec.sourceId || spec.id,
        /* de vierstapspijplijn van een herbestelling, of null. Het veld
           staat op ELK item en niet alleen op een herbestelling: een scherm
           dat `it.pipeline` uitleest hoort niet eerst de soort te hoeven
           weten, en een veld dat er soms is en soms niet nodigt uit tot
           precies dat. Zie reorderPipelineOf(). */
        pipeline: spec.pipeline || null,
        /* "door klant" — zie de kop van deze functie. Een aanroeper die het
           bewijs ergens anders vandaan heeft (het bezwaar) geeft `true` mee;
           anders beslist de rij zelf. Nooit `undefined`: het is een vlag. */
        doorKlant: spec.doorKlant === true || doorKlant(spec.raw),
        raw: spec.raw || null
      });
    }

    /* ---------- site-briefs ---------- */
    list(src.briefs).forEach(function (r) {
      if (!r || !r.id) return;
      var done = str(r.status) === 'omgezet';
      push({
        kind: 'brief', id: r.id, sourceId: r.id,
        chip: done ? 'afgehandeld' : 'nieuw',
        title: r.product || 'Aanvraag zonder omschrijving',
        sub: joinSub([r.name, r.email, r.company, str(r.lang || 'nl').toUpperCase()]),
        clientId: r.clientId || null, projectId: r.projectId || null,
        at: r.createdAt || null, raw: r
      });
    });

    /* ---------- klantvragen en herbestelaanvragen ----------
       DE DRAAD HEEFT HET LAATSTE WOORD (0020). question/answer en
       answeredAt zijn de oude kolommen: één vraag, één antwoord. Sinds
       question_messages kan de klant in een beantwoorde draad doorpraten,
       en dan ligt de bal weer bij mij terwijl answeredAt "klaar" zegt. Per
       draad daarom het jongste klant- en stafbericht: is het klantbericht
       jonger dan het antwoord én dan het laatste stafbericht, dan is de
       vraag heropend. Een bericht dat de datamigratie van 0020 uit de
       oude kolommen maakte (de vraag zelf, op askedAt) is nooit jonger dan
       het antwoord en heropent dus niets. Zonder bron questionMessages
       verandert er niets: dan beslissen de kolommen, zoals altijd. */
    var laatsteKlant = {}, laatsteStaf = {};
    list(src.questionMessages).forEach(function (m) {
      if (!m || !m.questionId) return;
      var at = str(m.createdAt);
      if (!at) return;
      var bak = (str(m.author) === 'client') ? laatsteKlant : laatsteStaf;
      if (!bak[m.questionId] || cmpText(at, bak[m.questionId]) > 0) bak[m.questionId] = at;
    });
    /* het tijdstip van de reactie van de klant ná het antwoord, of null */
    function klantReactieOp(q) {
      var k = laatsteKlant[q.id];
      if (!k || !q.answeredAt) return null;
      if (cmpText(k, str(q.answeredAt)) <= 0) return null;
      var s = laatsteStaf[q.id];
      if (s && cmpText(k, s) <= 0) return null;
      return k;
    }

    list(src.questions).forEach(function (q) {
      if (!q || !q.id) return;
      var reorder = isReorder(q);
      var reactie = klantReactieOp(q);
      var answered = !!q.answeredAt && !reactie;
      /* alleen de soortbak; de bal komt er in push() overheen via
         chipVoorBal, precies zoals bij elk ander itemtype. Hier stond
         diezelfde eigenaarskeuze eerder nog een tweede keer los. Een
         heropende draad is gewoon weer een open vraag aan mij. */
      var chip;
      if (answered) chip = 'afgehandeld';
      else if (reorder && !reactie) chip = 'nieuw';
      else chip = 'wachtopmij';
      /* de antwoordtermijn loopt vanaf het moment dat de bal bij mij
         kwam: de vraag, of de reactie van de klant */
      var deadline = answered ? null : answerDeadlineISO(reactie || q.askedAt);
      /* de opgeslagen pijplijnstand reist mee op het item; het scherm hoeft
         settings.reorderPipeline dus niet zelf te openen */
      var pijplijn = reorder ? reorderPipelineOf(q.id, settings) : null;
      push({
        kind: 'vraag', id: q.id, sourceId: q.id, chip: chip,
        title: reorder ? str(q.question).replace(/^HERBESTELLING:\s*/, '') : str(q.question),
        /* DE STAND STAAT ÓÓK IN WOORDEN OP DE REGEL, en dat is geen tweede
           waarheid maar dezelfde: hij komt uit hetzelfde pijplijnobject, één
           regel hierboven. Een rij die alleen de titel toont laat anders
           niet zien waar een herbestelling in de vier stappen staat, en dat
           is juist het verschil tussen twee herbestellingen. */
        sub: joinSub([
          reactie ? 'Reactie van de klant' : null,
          pijplijn ? ('Herbestelling · stap ' + pijplijn.step + ' van ' + pijplijn.total + ': ' + pijplijn.label) : null,
          q.stageKey ? faseNaam(q.stageKey) : null,
          deadline ? 'antwoord voor ' + formatDate(deadline) : null
        ]),
        clientId: clientIdOf(q.projectId), projectId: q.projectId || null,
        /* een heropende draad is zo oud als de reactie, niet als de vraag */
        at: reactie || q.askedAt || null,
        /* rode klok = de antwoorddeadline is verstreken */
        urgent: !!(deadline && deadline < todayOf(now)),
        pipeline: pijplijn,
        /* de reactie is het bewijs dat de klant het laatst handelde */
        doorKlant: !!reactie,
        raw: q
      });
    });

    /* ---------- fases die op akkoord van de klant wachten ---------- */
    var stageRows = list(src.stages).slice();
    if (!stageRows.length) {
      projects.forEach(function (p) {
        if (!p) return;
        list(p.stages).forEach(function (s) {
          if (!s) return;
          stageRows.push({
            projectId: p.id, stageKey: s.stageKey, status: s.status,
            paymentPct: s.paymentPct, approvedAt: s.approvedAt, position: s.position
          });
        });
      });
    }
    stageRows.forEach(function (s) {
      if (!s || str(s.status) !== 'awaiting_approval') return;
      if (archived(s.projectId)) return;
      var id = str(s.projectId) + ':' + str(s.stageKey);
      push({
        kind: 'fase', id: id, sourceId: s.stageKey, chip: 'goedkeuringen',
        status: 'awaiting_approval',
        title: faseNaam(s.stageKey),
        sub: 'Wacht op akkoord',
        clientId: clientIdOf(s.projectId), projectId: s.projectId || null,
        at: s.approvedAt || null, raw: s
      });
    });

    /* ---------- conceptfacturen ----------
       Verstuurde facturen komen hier bewust niet: zie de kop van deze
       functie. Gearchiveerde projecten vallen af, zoals buildVandaag ook
       doet — een concept op een afgesloten project is ruis. */
    var conceptInvoices = [];
    list(src.invoices).forEach(function (inv) {
      if (!inv || !inv.id) return;
      if (!isConceptRow(inv)) return;
      if (archived(inv.projectId)) return;
      conceptInvoices.push(inv);
    });
    conceptInvoices.forEach(function (inv) {
      push({
        kind: 'factuur', id: inv.id, sourceId: inv.id, chip: 'concepten',
        title: (inv.invoiceNumber ? inv.invoiceNumber + ' · ' : '') + str(inv.label),
        sub: 'Conceptfactuur',
        clientId: clientIdOf(inv.projectId), projectId: inv.projectId || null,
        at: inv.createdAt || null, raw: inv
      });
    });

    /* ---------- concepten en geplande publicaties ----------
       ONTDUBBELING CONCEPTFACTUUR ↔ FACTUURDOCUMENT — DIT IS DE ENIGE
       PLEK IN DE NIEUWE INDELING WAAR DIT GEBEURT.
       Een conceptfactuur genereert een documentrij die óók de conceptstand
       heeft. Zonder deze filter telt hetzelfde stuk werk twee keer: één
       keer als factuur en één keer als document. updateBadge() doet dit
       vandaag identiek (invDocIds uit inv.documentId), en
       buildProjectsList() en renderWachtrij() herhalen dezelfde vier regels
       nog twee keer los. Die twee kopieën horen te verdwijnen zodra hun
       scherm hierop overstapt; wie hier iets verandert, verandert het
       overal. */
    var invDocIds = {};
    conceptInvoices.forEach(function (inv) { if (inv.documentId) invDocIds[inv.documentId] = true; });

    list(src.drafts).forEach(function (it) {
      if (!it || !it.row || !it.row.id) return;
      if (it.kind === 'document' && invDocIds[it.row.id]) return; /* de ontdubbeling */
      var row = it.row;
      push({
        kind: 'concept', id: row.id, sourceId: row.id,
        chip: row.scheduledAt ? 'gepland' : 'concepten',
        title: str(row.title || row.label || row.caption || row.name || (it.kind === 'media' ? 'Foto' : 'Document')),
        sub: joinSub([it.kind === 'media' ? 'Foto' : 'Document',
          row.scheduledAt ? 'gepland ' + formatDateTime(row.scheduledAt) : null]),
        clientId: clientIdOf(row.projectId), projectId: row.projectId || null,
        at: row.createdAt || row.capturedAt || null, raw: row
      });
    });

    /* ---------- samplerondes die op een keuze van de klant wachten ----------
       Alleen de NIEUWSTE ronde per project telt, precies zoals
       computeSignals(): een oudere ronde is verdrongen en vraagt niets. */
    var latestSample = {};
    list(src.samples).forEach(function (sm) {
      if (!sm || !sm.projectId) return;
      var cur = latestSample[sm.projectId];
      if (!cur || str(sm.roundDate) > str(cur.roundDate)) latestSample[sm.projectId] = sm;
    });
    Object.keys(latestSample).forEach(function (pid) {
      var sm = latestSample[pid];
      if (str(sm.status) !== 'reviewed') return;
      if (archived(sm.projectId)) return;
      /* ONTDUBBELING MET 'samplebeslissing' (0021). decide_sample laat bij
         'aanpassing' de status op 'reviewed' staan en zet alleen
         clientDecision; zonder deze regel bleef de ronde hier "wachten op
         een keuze van de klant" terwijl de klant net gekozen heeft. Eén
         ronde, één item: de beslissing staat verderop. */
      if (sm.clientDecision) return;
      push({
        kind: 'sample', id: sm.id, sourceId: sm.id, chip: 'wachtopklant',
        status: 'reviewed',
        title: 'Sample ' + str(sm.roundLabel),
        sub: joinSub([sm.note, 'wacht op keuze van de klant']),
        clientId: clientIdOf(sm.projectId), projectId: sm.projectId || null,
        at: sm.roundDate || null, raw: sm
      });
    });

    /* ============================================================
       DE VIJF KLANTACTIES UIT MIGRATIE 0021
       Hoofdstuk 2 van .claude/portaal-spec.md: wat de klant in het portaal
       doet, ziet het beheer als Inbox-item. Alle vijf liggen bij MIJ (chip
       'wachtopmij', dus de badge telt ze mee): het is de tegenhanger van
       'goedkeuringen' en 'wachtopklant' — daar wacht ik op de klant, hier
       heeft de klant geleverd en wacht hij op mij. De velden heten zoals
       demo-data-portaal.js ze schrijft (camelCase van 0021).
       ============================================================ */
    var invById = indexBy(src.invoices, 'id');
    /* dezelfde keuze als 0021 zelf: coalesce(nullif(invoice_number,''), label) */
    function factuurNaam(inv) {
      if (!inv) return '';
      return str(inv.invoiceNumber) || str(inv.label) || str(inv.id);
    }

    /* ---------- 'betaling': betaling gemeld, nog niet bevestigd ----------
       report_payment() schrijft een invoice_payments-rij met reportedByClient
       true en verifiedAt null: een VOORSTEL, geen boeking — het saldo telt
       hem pas mee na verify_payment_report(). Zolang verifiedAt leeg is,
       wacht die rij op mijn controle. Urgent na drie dagen, dezelfde grens
       als najagen (isChasing): wie zegt betaald te hebben hoort binnen een
       paar dagen "klopt" te horen.
       Een gewone stafboeking (reportedByClient false) is nooit een item, ook
       niet zonder verifiedAt: dat veld betekent daar niets (0021).
       Geen archieffilter, anders dan bij een conceptfactuur: geld op een
       afgesloten project is nog steeds geld, en de controle is echt werk.
       Ontbreekt de factuur in de lijst, dan blijft het item staan — met het
       factuur-id als naam en zonder project; de melding wacht evengoed. */
    var betalingen = Array.isArray(src.clientPayments) ? src.clientPayments : list(src.invoicePayments);
    betalingen.forEach(function (p) {
      if (!p || !p.id) return;
      if (p.reportedByClient !== true) return;
      if (p.verifiedAt) return;
      var inv = invById[p.invoiceId] || null;
      var gemeld = p.createdAt || p.paidOn || null;
      var oud = daysBetween(gemeld, todayOf(now));
      push({
        kind: 'betaling', id: p.id, sourceId: p.id, chip: 'wachtopmij',
        title: 'Betaling gemeld: ' + formatCents(p.amountCents, p.currency || (inv && inv.currency)) +
          ' op factuur ' + (factuurNaam(inv) || str(p.invoiceId)),
        sub: joinSub([
          p.clientReference ? 'kenmerk ' + str(p.clientReference) : 'zonder kenmerk',
          p.paidOn ? 'overgemaakt ' + formatDate(p.paidOn) : null,
          'controleren en bevestigen'
        ]),
        clientId: inv ? clientIdOf(inv.projectId) : null,
        projectId: inv ? (inv.projectId || null) : null,
        at: gemeld,
        urgent: oud !== null && oud > 3,
        raw: p
      });
    });

    /* ---------- 'klantbestand': bestand van de klant, in een slot ----------
       De insertpolicy in 0021 laat een klant alleen een rij met uploadedBy
       'klant' aanmaken; de trigger vult het slot. ER IS GEEN reviewedAt-VELD:
       niets in de database legt vast dat ik het bestand heb bekeken. Het
       item valt daarom na zeven dagen vanzelf af — dezelfde versheidsgrens
       als een gesprek in het portaal — en niet op een handeling. Wie het
       eerder kwijt wil, parkeert het (snooze). Een document zonder createdAt
       kan geen "jonger dan zeven dagen" bewijzen en valt af: liever een gat
       dat opvalt dan een item dat nooit meer verdwijnt.
       Geen archieffilter: de demo levert het artwork voor een herbestelling
       juist op het afgeronde project, en een bestand dat een klant vandaag
       aanlevert is werk, ook daar. */
    list(src.documents).forEach(function (d) {
      if (!d || !d.id) return;
      if (str(d.uploadedBy) !== 'klant') return;
      var oud = daysBetween(d.createdAt, todayOf(now));
      if (oud === null || oud >= 7) return;
      push({
        kind: 'klantbestand', id: d.id, sourceId: d.id, chip: 'wachtopmij',
        title: str(d.title) || str(d.fileName) || 'Bestand zonder titel',
        sub: joinSub([
          'aangeleverd door de klant',
          d.clientNote ? str(d.clientNote) : null,
          d.stageKey ? faseNaam(d.stageKey) : null
        ]),
        clientId: clientIdOf(d.projectId), projectId: d.projectId || null,
        at: d.createdAt || null, raw: d
      });
    });

    /* ---------- 'samplebeslissing': de klant vroeg een aanpassing ----------
       decide_sample('aanpassing') laat de status op 'reviewed' staan en zet
       clientDecision, clientNote, clientDecidedAt en clientMarks. De bal ligt
       dan bij mij: een nieuwe ronde maken met deze opmerking als startpunt.
       Het sampleblok hierboven slaat zo'n ronde over (één ronde, één item),
       en net als daar telt alleen de NIEUWSTE ronde per project — is er al
       een nieuwere ronde, dan is de aanpassing verwerkt en vraagt zij niets
       meer. 'goedgekeurd' is bewust GEEN item: decide_sample zet de ronde
       dan zelf op approved, en dat was precies wat er te doen stond. */
    Object.keys(latestSample).forEach(function (pid) {
      var sm = latestSample[pid];
      if (str(sm.clientDecision) !== 'aanpassing') return;
      if (archived(sm.projectId)) return;
      var marks = list(sm.clientMarks).length;
      push({
        kind: 'samplebeslissing', id: sm.id, sourceId: sm.id, chip: 'wachtopmij',
        status: sm.status,
        title: 'Sample ' + str(sm.roundLabel) + ': aanpassing gevraagd',
        sub: joinSub([
          sm.clientNote ? str(sm.clientNote) : null,
          marks ? (marks + (marks === 1 ? ' aanwijzing' : ' aanwijzingen') + ' op de foto') : null,
          'nieuwe ronde maken'
        ]),
        clientId: clientIdOf(sm.projectId), projectId: sm.projectId || null,
        at: sm.clientDecidedAt || sm.roundDate || null, raw: sm
      });
    });

    /* ---------- 'bezwaar': de klant betwist een factuur ----------
       dispute_invoice() zet statusCode op 'disputed', pauzeert de
       herinneringen en schrijft de REDEN op drie plekken — maar niet op de
       factuur zelf (hoofdstuk 3 voegt daar niets aan toe). De reden komt
       daarom uit invoiceAudit (event 'bezwaar_klant', de nieuwste) als die
       lijst is meegegeven; anders zegt de regel eerlijk waar hij staat.
       Altijd urgent: een betwiste factuur staat stil tot ik iets doe.
       Verstuurde facturen horen in Financiën (zie de kop van deze functie);
       dit is de ene uitzondering, want hier is wél een handeling. Geen
       archieffilter, om dezelfde reden als bij 'betaling'. */
    var bezwaarReden = {};
    list(src.invoiceAudit).forEach(function (a) {
      if (!a || str(a.event) !== 'bezwaar_klant' || !a.invoiceId) return;
      var cur = bezwaarReden[a.invoiceId];
      if (!cur || str(a.createdAt) > str(cur.createdAt)) bezwaarReden[a.invoiceId] = a;
    });
    list(src.invoices).forEach(function (inv) {
      if (!inv || !inv.id) return;
      if (str(inv.statusCode) !== 'disputed') return;
      var reden = bezwaarReden[inv.id] || null;
      push({
        kind: 'bezwaar', id: inv.id, sourceId: inv.id, chip: 'wachtopmij',
        status: 'disputed',
        title: 'Bezwaar op factuur ' + factuurNaam(inv),
        sub: joinSub([
          reden ? str(reden.detail) : 'reden in het factuurlogboek',
          (typeof inv.outstandingCents === 'number') ? 'open ' + formatCents(inv.outstandingCents, inv.currency) : null
        ]),
        clientId: clientIdOf(inv.projectId), projectId: inv.projectId || null,
        at: (reden && reden.createdAt) || inv.updatedAt || inv.createdAt || null,
        urgent: true, raw: inv,
        /* het bewijs dat de KLANT betwistte zit niet op de factuur (de
           editor kent "Als betwist markeren" met de hand) maar in het
           factuurlogboek; zonder die regel blijft de vlag eerlijk uit */
        doorKlant: !!reden
      });
    });

    /* ---------- 'herbestelling': een aanvraag uit reorder_requests ----------
       De vijfde klantactie. Vóór 0021 was dit een klantvraag met het
       voorvoegsel HERBESTELLING: (hierboven, soort 'vraag', bak Nieuw); 0021
       maakt er een eigen tabel van met een statuskolom die de vier stappen
       van REORDER_STAGES draagt. De KOLOM is de waarheid over de stap —
       herbestellingStapZetten in beheer.html schrijft hem én de oude stand
       in settings.reorderPipeline — en alleen als de kolom leeg of onbekend
       is, valt de stap terug op die opgeslagen stand en daarna op de
       beginstand 'aanvraag'. quoteDocId en projectId komen wél uit
       settings.reorderPipeline: 0021 zet die niet op de rij.
       Een rij op 'project' is klaar: het project bestaat en heeft zijn eigen
       kaart. Geen archieffilter, en dat is hier de kern: een herbestelling
       landt per definitie op een AFGEROND product, en de demo zet hem precies
       daar. Wie hier op status 'archived' filtert, maakt de soort leeg.
       De bal ligt bij mij (chip 'wachtopmij', dus de badge telt hem mee): de
       klant heeft geleverd. Urgent zodra de gewenste datum verstreken is
       terwijl er nog geen project is — dat is een gemeten feit, geen
       verzonnen drempel. */
    var herbestellingen = Array.isArray(src.reorders) ? src.reorders : list(src.reorderRequests);
    herbestellingen.forEach(function (r) {
      if (!r || !r.id) return;
      if (str(r.status) === 'project') return;
      var opgeslagen = (isObj(settings.reorderPipeline) && isObj(settings.reorderPipeline[r.id]))
        ? settings.reorderPipeline[r.id] : {};
      var stand = {};
      stand[r.id] = {
        stage: reorderStageIndex(r.status) >= 0 ? str(r.status) : opgeslagen.stage,
        quoteDocId: opgeslagen.quoteDocId,
        projectId: opgeslagen.projectId
      };
      var pijplijn = reorderPipelineOf(r.id, { reorderPipeline: stand });
      var product = projectOf(r.projectId);
      var aantal = (typeof r.qty === 'number' && isFinite(r.qty)) ? groepDuizend(Math.round(r.qty)) + ' stuks' : 'aantal onbekend';
      var gewenst = r.wantedBy ? dayISO(r.wantedBy) : '';
      push({
        kind: 'herbestelling', id: r.id, sourceId: r.id, chip: 'wachtopmij',
        status: pijplijn.stage,
        title: 'Herbestelling' + (product && product.name ? ' ' + str(product.name) : '') + ': ' + aantal,
        sub: joinSub([
          gewenst ? 'gewenst op ' + formatDate(gewenst) : null,
          'stap ' + pijplijn.step + ' van ' + pijplijn.total + ': ' + pijplijn.label,
          r.sameSpec === true ? 'zelfde specificatie' : (r.sameSpec === false ? 'met wijziging' : null)
        ]),
        clientId: r.clientId || clientIdOf(r.projectId), projectId: r.projectId || null,
        at: r.createdAt || null,
        urgent: !!(gewenst && gewenst < todayOf(now)),
        pipeline: pijplijn,
        /* de tabel zelf is het bewijs (zie doorKlant); de vlag staat hier
           expliciet zodat een rij zonder sameSpec niet stil terugvalt op nee */
        doorKlant: true,
        raw: r
      });
    });

    /* Vaste volgorde: gepind bovenaan, dan urgent, dan het oudste item —
       wat het langst ligt is wat het langst wacht. De oorspronkelijke
       index sluit de rij zodat de sortering stabiel is. */
    return stableSort(items, function (a, b) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      var ai = str(a.at), bi = str(b.at);
      if (ai !== bi) {
        if (!ai) return 1;
        if (!bi) return -1;
        return ai < bi ? -1 : 1;
      }
      return cmpText(a.id, b.id);
    });
  }

  function matchesExtra(it, extra) {
    if (!isObj(extra)) return true;
    if (extra.clientId && it.clientId !== extra.clientId) return false;
    if (extra.projectId && it.projectId !== extra.projectId) return false;
    if (extra.kind && it.kind !== extra.kind) return false;
    if (extra.q) {
      var needle = str(extra.q).toLowerCase();
      var hay = (str(it.title) + ' ' + str(it.sub)).toLowerCase();
      if (hay.indexOf(needle) === -1) return false;
    }
    return true;
  }

  /* Uitgesteld valt uit ELKE andere chip (beslissing 2.4): een bewust
     geparkeerd item hoort niet in de werkvoorraad te blijven staan, want
     dan was parkeren zinloos. Afgehandeld idem. */
  function filterInbox(items, chip, extra) {
    var c = str(chip) || 'alles';
    var out = [];
    list(items).forEach(function (it) {
      if (!it) return;
      var done = it.chip === 'afgehandeld';
      var parked = !!it.snoozedUntil;
      if (c === 'afgehandeld') { if (!done) return; }
      else if (c === 'uitgesteld') { if (done || !parked) return; }
      else if (c === 'alles') { if (done || parked) return; }
      else if (done || parked || it.chip !== c) return;
      if (!matchesExtra(it, extra)) return;
      out.push(it);
    });
    return out;
  }

  /* BESLISSING 2.3 — WAT DE INBOX-BADGE TELT.
     Uitsluitend wat op mij wacht en niet geparkeerd is: open klantvragen,
     herbestelvragen, site-briefs die nog niet omgezet zijn, concepten en
     conceptfacturen. Alles met een snooze in de toekomst valt af, en alles
     met eigenaar klant of fabriek valt af.
     Fases op akkoord en wachtende samples tellen dus NIET mee — die staan
     wel in de Inbox onder Goedkeuringen en Wacht op klant, maar er is voor
     mij niets te doen. Ze vallen vanzelf af omdat ownerOf() ze structureel
     bij de klant legt; er is hier geen aparte uitzondering voor nodig.
     Geplande publicaties tellen óók niet: daar wacht een klok, niet ik. Dat
     is de enige plek waar deze badge afwijkt van de oude wBadge, die
     ingeplande concepten wél meetelde en daardoor nooit op nul kwam.
     De drie oude badges (qBadge, aBadge, wBadge) negeerden snooze en
     eigenaar volledig; dat is precies waarom een bewust geparkeerd item de
     badge bleef opblazen.

     HOE DIT GETAL ZICH TOT DE CHIPTELLINGEN VERHOUDT. Sinds chipVoorBal()
     de bal in de chip verwerkt, staat geen enkel item met eigenaar klant of
     fabriek nog onder 'nieuw', 'wachtopmij' of 'concepten', en staat er
     onder 'wachtopklant' niets meer dat op mij wacht. Dit getal is daarmee
     de som van die drie bakken, plus een goedkeuring die je expliciet naar
     jezelf hebt getrokken. Beide kanten lezen it.owner rechtstreeks, zodat
     ze niet uit elkaar kunnen lopen doordat de een de ander naleest.

     DE VIJF KLANTACTIES UIT 0021 (betaling, klantbestand, samplebeslissing,
     bezwaar, herbestelling) tellen WÉL mee: daar heeft de klant geleverd en
     wacht hij op mij. Ook daarvoor staat hier geen aparte regel —
     collectInbox zet ze in de bak 'wachtopmij' en ownerOf legt ze bij mij,
     dus ze vallen vanzelf binnen dezelfde telling. */
  function inboxBadgeCount(items, nowIso) {
    var today = todayOf(nowIso);
    var n = 0;
    list(items).forEach(function (it) {
      if (!it) return;
      if (it.chip === 'afgehandeld' || it.chip === 'gepland') return;
      if (it.owner !== OWNERS.MIJ) return;
      if (it.snoozedUntil && str(it.snoozedUntil).slice(0, 10) > today) return;
      n++;
    });
    return n;
  }

  /* ============================================================
     5. PROJECTEN
     ============================================================ */

  /* vereistSig — DE CHIP MOET WEG ALS ER NIETS GEMETEN IS.
     'Vertraagd' kan alleen bestaan als de aanroeper ctx.sig meegeeft (de
     uitkomst van computeSignals() uit beheer.html), want zendingen zitten
     bewust niet in de Inbox en dit bestand berekent ze niet zelf. Zonder sig
     is het eerlijke antwoord "niet gemeten", en dat is iets anders dan nul.
     Een chip met telling 0 zegt "er is niets vertraagd" — de enige stand die
     een scherm dan NIET mag tonen. Een scherm dat deze chips opbouwt laat
     een chip met vereistSig dus weg zolang het zelf geen sig heeft. */
  var PROJECT_CHIPS = [
    { key: 'alle',         label: 'Alle' },
    { key: 'actief',       label: 'Actief' },
    { key: 'wachtopmij',   label: 'Wacht op mij' },
    { key: 'wachtopklant', label: 'Wacht op klant' },
    { key: 'vertraagd',    label: 'Vertraagd', vereistSig: true },
    { key: 'afgerond',     label: 'Afgerond' },
    { key: 'gearchiveerd', label: 'Gearchiveerd' }
  ];

  function isArchived(p) { return !!p && p.status === 'archived'; }

  /* "Afgerond" is een AFLEIDING, geen veld: project.status kent alleen
     'active' en 'archived'. Een project waarvan elke fase op 'done' staat
     is klaar, ook al is het nog niet gearchiveerd. Zonder fases is er
     niets om uit af te leiden en is het project dus niet afgerond. */
  function isFinished(p) {
    if (!p || isArchived(p)) return false;
    var stages = list(p.stages);
    if (!stages.length) return false;
    for (var i = 0; i < stages.length; i++) {
      if (!stages[i] || stages[i].status !== 'done') return false;
    }
    return true;
  }

  /* ctx voor filteren en sorteren; alles optioneel:
       items     de uitkomst van collectInbox() — bepaalt wie aan zet is
       sig       de uitkomst van computeSignals() uit beheer.html — de
                 ENIGE bron voor vertraagde zendingen, want zendingen zitten
                 bewust niet in de Inbox
       actions   { projectId: nextActionFor(...) } voor de actiesortering
       clients   klantrijen (of clientById) voor sorteren op klant
       now       vaste klok
     nextDateFor() leest uit dezelfde ctx nog shipments, questions,
     invoices, moments, drafts, events en itemState. */
  function ctxItems(ctx) { return list(ctx && ctx.items); }

  function ownerInProject(ctx, projectId, owners) {
    var found = false;
    ctxItems(ctx).forEach(function (it) {
      if (found || !it || it.projectId !== projectId) return;
      if (it.chip === 'afgehandeld') return;
      if (it.snoozedUntil) return;
      if (owners.indexOf(it.owner) > -1) found = true;
    });
    return found;
  }

  /* ZONDER ctx.sig IS DIT ANTWOORD "NIET GEMETEN", GEEN "NEE".
     De terugval hieronder kijkt naar een urgent zendingitem in ctx.items, en
     collectInbox() maakt de soort 'zending' bewust nooit aan (zie de kop van
     die functie). De terugval doet dus alleen iets voor een aanroeper die
     zelf zendingitems in ctx.items zet; voor iedereen anders is de uitkomst
     onvermijdelijk leeg. Daarom draagt de chip vereistSig:true — het scherm
     hoort hem dan weg te laten in plaats van een telling van nul te tonen. */
  function isDelayed(ctx, projectId) {
    var sig = ctx && ctx.sig;
    var hit = false;
    if (sig) {
      list(sig.eta).forEach(function (it) { if (it && it.projectId === projectId) hit = true; });
      list(sig.stil).forEach(function (it) { if (it && it.projectId === projectId) hit = true; });
    }
    if (hit) return true;
    ctxItems(ctx).forEach(function (it) {
      if (it && it.projectId === projectId && it.kind === 'zending' && it.urgent) hit = true;
    });
    return hit;
  }

  function filterProjects(projects, chip, ctx) {
    var c = str(chip) || 'alle';
    var out = [];
    list(projects).forEach(function (p) {
      if (!p) return;
      if (c === 'alle') { out.push(p); return; }
      if (c === 'gearchiveerd') { if (isArchived(p)) out.push(p); return; }
      if (isArchived(p)) return; /* gearchiveerd hoort in geen enkele andere chip */
      if (c === 'afgerond') { if (isFinished(p)) out.push(p); return; }
      if (c === 'actief') { if (!isFinished(p)) out.push(p); return; }
      if (c === 'wachtopmij') { if (ownerInProject(ctx, p.id, [OWNERS.MIJ])) out.push(p); return; }
      if (c === 'wachtopklant') { if (ownerInProject(ctx, p.id, [OWNERS.KLANT, OWNERS.FABRIEK])) out.push(p); return; }
      if (c === 'vertraagd') { if (isDelayed(ctx, p.id)) out.push(p); return; }
      /* onbekende chip: liever alles tonen dan stilletjes een lege lijst */
      out.push(p);
    });
    return out;
  }

  function clientNameFor(p, ctx) {
    if (!p) return '';
    var byId = (ctx && isObj(ctx.clientById)) ? ctx.clientById : indexBy(ctx && ctx.clients, 'id');
    var c = byId[p.clientId];
    return c ? str(c.company || c.contactName || '') : '';
  }

  /* Modus 'actie' is de huidige sortering van buildProjectsList(): eerst
     projecten met een openstaande actie, dan projecten zonder, dan het
     archief; binnen die groepen op de rangorde van nextActionFor() en
     tenslotte nieuwste eerst. */
  function sortProjects(projects, mode, ctx) {
    var m = str(mode) || 'actie';
    var actions = (ctx && isObj(ctx.actions)) ? ctx.actions : {};
    var rows = list(projects);

    if (m === 'naam') {
      return stableSort(rows, function (a, b) { return cmpText(a && a.name, b && b.name); });
    }
    if (m === 'klant') {
      return stableSort(rows, function (a, b) {
        var r = cmpText(clientNameFor(a, ctx), clientNameFor(b, ctx));
        if (r) return r;
        return cmpText(a && a.name, b && b.name);
      });
    }
    if (m === 'nieuwste') {
      return stableSort(rows, function (a, b) { return cmpText(b && b.createdAt, a && a.createdAt); });
    }
    if (m === 'datum') {
      return stableSort(rows, function (a, b) {
        var da = nextDateFor(a, ctx), db = nextDateFor(b, ctx);
        if (!da && !db) return 0;
        if (!da) return 1;   /* geen datum zakt naar onderen */
        if (!db) return -1;
        return cmpText(da.iso, db.iso);
      });
    }
    /* 'actie' en alles wat we niet kennen */
    return stableSort(rows, function (a, b) {
      var aa = isArchived(a) ? 2 : (actions[a && a.id] ? 0 : 1);
      var bb = isArchived(b) ? 2 : (actions[b && b.id] ? 0 : 1);
      if (aa !== bb) return aa - bb;
      var ra = actions[a && a.id], rb = actions[b && b.id];
      if (ra && rb && ra.rank !== rb.rank) return ra.rank - rb.rank;
      return cmpText(b && b.createdAt, a && a.createdAt);
    });
  }

  /* ---------- eerstvolgende datum ----------
     BEWUST GEEN DEADLINE. Er bestaat geen deadlineveld op een project
     (beslissing 2.5) en een verzonnen deadline is erger dan geen deadline.
     Dit zijn de zes datums die buildWeekBoard() vandaag al projecteert:
       1 etaWindowEnd    van een nog niet geleverde zending
       2 answerDeadline  van een open klantvraag (ontvangst + 1 werkdag)
       3 invoiceDueISO   echte dueDate, anders aanmaak + 30 dagen
       4 snoozedUntil    uit settings.itemState
       5 remindAt        van een openstaand contactmoment
       6 scheduledAt     van een ingeplande publicatie
     Bestaat er geen enkele, dan is het antwoord null.

     Keuze bij uitsluitend verstreken datums: dan komt de MEEST RECENT
     verstreken datum terug met passed=true. Een project met een ETA die
     gisteren afliep mag niet "geen datum" tonen — dat is precies het
     moment waarop je hem moet zien. */
  function nextDateFor(project, ctx) {
    if (!project || !project.id) return null;
    var c = isObj(ctx) ? ctx : {};
    var pid = project.id;
    var today = todayOf(c.now);
    var states = isObj(c.itemState) ? c.itemState
      : (isObj(c.settings) && isObj(c.settings.itemState) ? c.settings.itemState : {});
    var cands = [];

    function add(iso, kind, label) {
      var d = dayISO(iso);
      if (!d) return;
      cands.push({ iso: d, kind: kind, label: label });
    }

    /* 1. ETA-vensters van zendingen die nog onderweg zijn */
    var deliveredEvent = {};
    list(c.events).forEach(function (ev) {
      if (ev && ev.milestoneKey === 'geleverd') deliveredEvent[ev.shipmentId] = true;
    });
    list(c.shipments).forEach(function (s) {
      if (!s || s.projectId !== pid) return;
      if (s.deliveredAt || deliveredEvent[s.id]) return;
      add(s.etaWindowEnd, 'eta', 'ETA-venster sluit');
    });

    /* 2. antwoordklokken van open vragen */
    list(c.questions).forEach(function (q) {
      if (!q || q.projectId !== pid || q.answeredAt) return;
      add(answerDeadlineISO(q.askedAt), 'antwoordklok', 'antwoordklok');
    });

    /* 3. facturen die openstaan (concepten zijn nog niet verstuurd) */
    list(c.invoices).forEach(function (inv) {
      if (!inv || inv.projectId !== pid) return;
      if (inv.status !== 'open' || isConceptRow(inv)) return;
      add(invoiceDueISO(inv), 'factuur', 'factuur wordt 30 dagen oud');
    });

    /* 4. terugkeerdatums van geparkeerde items van dit project. De sleutels
       van itemState dragen geen projectId behalve bij fases, dus we lopen
       de meegegeven items af — die kennen hun project wél. */
    ctxItems(c).forEach(function (it) {
      if (!it || it.projectId !== pid) return;
      add(it.snoozedUntil || snoozedUntil(it, states), 'uitstel', 'terug uit uitstel');
    });

    /* 5. follow-up-herinneringen van de klant van dit project */
    var clientId = project.clientId || null;
    list(c.moments).forEach(function (mnt) {
      if (!mnt || mnt.remindDone || !mnt.remindAt) return;
      if (clientId) { if (mnt.clientId !== clientId) return; }
      else if (mnt.projectId !== pid) return;
      add(mnt.remindAt, 'herinnering', 'herinnering');
    });

    /* 6. ingeplande publicaties */
    list(c.drafts).forEach(function (it) {
      var row = (it && it.row) ? it.row : it;
      if (!row || row.projectId !== pid || !row.scheduledAt) return;
      add(row.scheduledAt, 'publicatie', 'geplande publicatie');
    });

    if (!cands.length) return null;
    cands = stableSort(cands, function (a, b) { return cmpText(a.iso, b.iso); });
    for (var i = 0; i < cands.length; i++) {
      if (cands[i].iso >= today) {
        return { iso: cands[i].iso, kind: cands[i].kind, label: cands[i].label, passed: false };
      }
    }
    var last = cands[cands.length - 1];
    return { iso: last.iso, kind: last.kind, label: last.label, passed: true };
  }

  /* ============================================================
     6. ACTIVITEIT

     mergeActivity() IS DE ENIGE BRON VOOR ALLE VIER DE
     ACTIVITEITSWEERGAVEN: het werkgebied Activiteit, de tab Activiteit op
     klantdetail, de tab Tijdlijn op projectdetail en de tab Activiteit op
     fabriekdetail. Er bestaan vandaag twee tijdlijnvormen naast elkaar met
     verschillende kolommen en verschillende bronnen; zodra dezelfde
     gebeurtenis op vier plekken staat is één bouwfunctie de enige garantie
     op één waarheid (beslissing 2.6). Een nieuwe weergave bouwt dus een
     scope, nooit een eigen samenvoeging.
     ============================================================ */

  var ACTIVITY_KINDS = [
    { key: 'alles',      label: 'Alles' },
    { key: 'klant',      label: 'Klant' },
    { key: 'mail',       label: 'E-mail' },
    { key: 'systeem',    label: 'Systeem' },
    { key: 'bestanden',  label: 'Bestanden' },
    { key: 'financieel', label: 'Financieel' },
    /* de klantacties uit migratie 0021, elk een eigen soort (spec §2: "de
       nieuwe klantacties als eigen soort"). ACHTERAAN en niet ertussen:
       admin-schermen-beheer.js kleurt de donut op de positie in deze tabel
       (ACT_TINT), en een soort ertussen schuiven zou de legenda verkleuren.
       Herbestelling en contactpersoon blijven 'klant' — zie KLANTACTIES. */
    { key: 'akkoord',      label: 'Akkoord' },
    { key: 'samplekeuze',  label: 'Samplekeuze' },
    { key: 'betaling',     label: 'Betaling gemeld' },
    { key: 'klantbestand', label: 'Bestand van klant' },
    { key: 'bezwaar',      label: 'Bezwaar' }
  ];

  /* cls is een eigen klassenaam en kaapt bewust geen bestaande chipklasse:
     .act-klant .act-mail .act-systeem .act-bestanden .act-financieel
     krijgen hun kleur in hoofdstuk 2 van portal/admin-ui.css, naast de
     chiptonen en gebouwd op dezelfde tokens. Zou hier 'crit' of 'awaiting'
     staan, dan zou een kleurwijziging in de chips ineens de tijdlijn
     hertekenen. Deze belofte was een tijdlang niet ingelost — de vijf regels
     bestonden nergens — en is met de fase-1-fixronde alsnog gebouwd. */
  function clsFor(kind) { return 'act-' + kind; }

  /* DE KLANTACTIES IN DE LOGBOEKEN — hoe een regel herkend wordt.
     portaal_log() in 0021 schrijft elke klantactie twee keer: in access_log
     (actor 'client', mét action en assetKind) en in admin_audit_log (kind
     'klant', alléén de tekst). De actie is de betrouwbare sleutel; de tekst
     is de tweede weg, voor het auditlogboek dat geen actie draagt. De
     patronen hieronder zijn LETTERLIJK de teksten uit 0021 (approve_stage,
     decide_sample, report_payment, dispute_invoice, documents_fill_slot,
     reorder_requests_log, client_contacts_log); demo-data-portaal.js
     schrijft woordelijk dezelfde. Wijzigt 0021 een tekst, dan valt die regel
     terug op de soort 'klant' — nooit op een verkeerde soort.
     Herbestelling en contactpersoon blijven 'klant': spec §2 noemt vijf
     eigen soorten en dit zijn de andere twee. Ze staan hier zodat ook zij
     als klantactie ontdubbeld worden (zie add() in mergeActivity) en de
     actor 'klant' krijgen in plaats van 'beheer'.
     De vijf nieuwe klassen (act-akkoord, act-samplekeuze, act-betaling,
     act-klantbestand, act-bezwaar) horen net als de bestaande vijf in
     hoofdstuk 2 van portal/admin-ui.css te staan; dat bestand is van een
     andere bouw en die regels zijn er nog niet. */
  var KLANTACTIES = [
    { kind: 'akkoord',      action: 'approve',        tekst: /^Fase goedgekeurd door / },
    { kind: 'samplekeuze',  action: 'decide',         tekst: /^Sample .*(goedgekeurd door klant|aanpassing gevraagd door klant)/ },
    { kind: 'betaling',     action: 'report_payment', tekst: /^Betaling gemeld op factuur / },
    { kind: 'bezwaar',      action: 'dispute',        tekst: /^Bezwaar op factuur / },
    { kind: 'klantbestand', action: 'upload',         tekst: /^Bestand aangeleverd door klant: / },
    { kind: 'klant',        action: 'reorder',        tekst: /^Herbestelling aangevraagd: / },
    { kind: 'klant',        action: null,             tekst: /^Contactpersoon (toegevoegd|gewijzigd|verwijderd) door klant: / }
  ];

  /* de soort van een klantactie, of null als de regel er geen is. Met een
     actie beslist uitsluitend de actie (een toegangsregel 'download' met
     een toevallig gelijke tekst is geen klantactie); zonder actie beslist
     de tekst — en de aanroeper zorgt dat alleen auditregels met kind
     'klant' hier langskomen. */
  function klantactieVan(action, detail) {
    var a = str(action), d = str(detail), i;
    if (a) {
      for (i = 0; i < KLANTACTIES.length; i++) {
        if (KLANTACTIES[i].action && KLANTACTIES[i].action === a) return KLANTACTIES[i].kind;
      }
      return null;
    }
    for (i = 0; i < KLANTACTIES.length; i++) {
      if (KLANTACTIES[i].tekst.test(d)) return KLANTACTIES[i].kind;
    }
    return null;
  }

  function mergeActivity(bronnen, scope) {
    var src = isObj(bronnen) ? bronnen : {};
    var sc = isObj(scope) ? scope : {};
    /* net als bij collectInbox: de fasenamen komen uit de tabel van de
       aanroeper (bronnen.stageLabel), want het auditlogboek dat hier
       binnenkomt draagt ze al vertaald — 'Fasestatus gewijzigd: Compliance
       & Logistiek'. Zonder die tabel zou dezelfde tijdlijn Nederlandse en
       Engelse fasenamen door elkaar tonen. */
    var faseNaam = stageLabeler(src);
    var pmap = indexBy(src.projects, 'id');
    var rows = [];
    var seen = {};

    function add(row) {
      if (!row || !row.at) return;
      var projectId = row.projectId || null;
      var clientId = row.clientId || null;
      if (!clientId && projectId && pmap[projectId]) clientId = pmap[projectId].clientId || null;
      var entry = {
        at: str(row.at),
        kind: row.kind,
        cls: clsFor(row.kind),
        actor: row.actor || 'systeem',
        detail: str(row.detail),
        projectId: projectId,
        clientId: clientId,
        id: row.id || null
      };
      if (row.factoryId) entry.factoryId = row.factoryId;
      /* het actietype uit het systeem-auditlogboek; alleen aanwezig op
         rijen die er echt een dragen, zodat een scherm het verschil kan
         zien tussen "type overig" en "geen type vastgelegd" */
      if (row.actie) entry.actie = str(row.actie);
      /* ONTDUBBELING op een stabiele sleutel. Eerst het echte id — komt
         dezelfde rij uit twee lijsten binnen, dan verschijnt hij één keer.
         Daarnaast een inhoudssleutel voor rijen zonder id.
         Bewust GEEN vage tijdvenster-matching tussen het mail-logboek en
         het auditlogboek: een echte auditregel wegpoetsen is erger dan
         twee verwante regels naast elkaar tonen. */
      var key = entry.id ? ('id:' + entry.id)
        : ('c:' + entry.kind + '|' + entry.at + '|' + entry.detail + '|' + str(entry.clientId) + '|' + str(entry.projectId));
      /* ONTDUBBELING VAN EEN KLANTACTIE (0021). portaal_log() schrijft
         dezelfde handeling in één transactie in twee tabellen: zelfde tekst,
         zelfde tijdstip (now() is in Postgres de transactietijd), zelfde
         project. Dat is geen vaag tijdvenster maar een exacte tweeling, en
         één gebeurtenis hoort één keer in de tijdlijn (beslissing 2.6). De
         eerste van de twee wint — access_log komt eerst binnen en draagt de
         actie en het asset; de auditregel voegt daar niets aan toe. Zonder
         project (een contactpersoon hangt aan de klant) telt de klant mee
         in de sleutel, anders zouden twee klanten die op hetzelfde moment
         dezelfde naam toevoegen elkaar wegdrukken. Een tweeling op een
         ANDER tijdstip blijft staan: dat is geen tweeling meer. */
      var tweeling = row.klantactie
        ? ('ka:' + entry.at + '|' + entry.detail + '|' + (projectId ? ('p=' + projectId) : ('c=' + str(clientId))))
        : null;
      if (seen[key] || (tweeling && seen[tweeling])) return;
      seen[key] = true;
      if (tweeling) seen[tweeling] = true;
      rows.push(entry);
    }

    /* klant-toegangslogboek: wie heeft wat bekeken, gedownload of gedeeld */
    list(src.accessLog).forEach(function (r) {
      if (!r) return;
      var isFile = (r.assetKind === 'document' || r.assetKind === 'media');
      /* eerst de klantacties uit 0021 (op de actie, zie KLANTACTIES): een
         upload door de klant is geen "bestand bekeken" en een akkoord geen
         kale klantregel. Alles wat geen klantactie is volgt de oude regel. */
      var ka = klantactieVan(r.action, null);
      add({
        at: r.createdAt, id: r.id,
        kind: ka || (isFile ? 'bestanden' : (r.actor === 'client' ? 'klant' : 'systeem')),
        klantactie: !!ka,
        actor: r.actor || 'systeem',
        detail: r.detail || joinSub([r.action, r.assetKind]),
        projectId: r.projectId || null
      });
    });

    /* mail-logboek: elke klantmail met bezorgstatus als bewijs */
    list(src.mailLog).forEach(function (r) {
      if (!r) return;
      add({
        at: r.createdAt, id: r.id, kind: 'mail', actor: 'beheer',
        detail: joinSub([r.subject || '—', r.to ? '→ ' + r.to : null, r.status || null, r.note || null]),
        clientId: r.clientId || null, projectId: r.projectId || null
      });
    });

    /* systeem-auditlogboek: alles wat het beheer automatisch of namens
       Steffan deed. Het veld `kind` daar is een ACTIETYPE (mail,
       publicatie, bewerking, preview, toegang, offboarding, overig) en
       niet onze weergavesoort; alleen 'mail' valt samen.

       DAT ACTIETYPE REIST NU MEE ALS `actie`. Tot dan verdween het hier:
       zeven verschillende soorten systeemhandelingen kwamen als één
       ononderscheidbare hoop 'systeem' aan de andere kant naar buiten, en
       het werkgebied Activiteit kon de filterchips die het migratieplan
       vraagt dus niet bouwen. Het veld is bewust alleen gevuld waar het
       ECHT bestaat — alleen het auditlogboek schrijft een actietype. Een
       zendingmijlpaal of een gedeeld bestand krijgt er geen: die zouden
       dan een type dragen dat niemand heeft vastgelegd. */
    list(src.auditLog).forEach(function (r) {
      if (!r) return;
      var soort = str(r.kind);
      /* kind 'klant' is het actietype dat portaal_log() en de twee
         klanttriggers in 0021 schrijven; de tekst zegt wélke klantactie, en
         een tekst die geen enkel patroon kent blijft eerlijk 'klant' */
      var ka = (soort === 'klant') ? (klantactieVan(null, r.detail) || 'klant') : null;
      add({
        at: r.createdAt, id: r.id,
        kind: ka || (soort === 'mail' ? 'mail' : 'systeem'),
        klantactie: !!ka,
        /* dezelfde terugval als de datalaag zelf hanteert bij het
           wegschrijven (addAudit: kind || 'overig') */
        actie: soort || 'overig',
        actor: ka ? 'klant' : 'beheer', detail: r.detail || '',
        clientId: r.clientId || null, projectId: r.projectId || null
      });
    });

    /* contactmomenten (call, WhatsApp, bezoek): handmatig vastgelegd.
       De opdracht noemt deze bron `contacts`; de datalaag heet
       listContactMoments(), dus `moments` werkt als alias. */
    var moments = list(src.contacts).length ? list(src.contacts) : list(src.moments);
    moments.forEach(function (mnt) {
      if (!mnt) return;
      add({
        at: mnt.at || mnt.createdAt, id: mnt.id, kind: 'klant', actor: 'beheer',
        detail: joinSub([mnt.kind, mnt.note]),
        clientId: mnt.clientId || null, projectId: mnt.projectId || null
      });
    });

    /* vragen leveren twee gebeurtenissen: gesteld door de klant, en
       beantwoord door mij */
    list(src.questions).forEach(function (q) {
      if (!q) return;
      add({
        at: q.askedAt, id: q.id ? q.id + ':asked' : null, kind: 'klant', actor: 'klant',
        detail: 'Vraag gesteld: ' + str(q.question), projectId: q.projectId || null
      });
      if (q.answeredAt) {
        add({
          at: q.answeredAt, id: q.id ? q.id + ':answered' : null, kind: 'klant', actor: 'beheer',
          detail: 'Vraag beantwoord: ' + str(q.question), projectId: q.projectId || null
        });
      }
    });

    /* fasewissels: alleen het akkoord is een echt vastgelegd moment
       (approvedAt). Voor de overige statuswissels bestaat geen tijdstempel
       op de fase zelf — die staan al als tekstregel in het toegangslogboek,
       en dat is precies de regel waar computeSignals() de ouderdom van een
       fase op akkoord uit haalt. */
    list(src.stages).forEach(function (s) {
      if (!s || !s.approvedAt) return;
      /* sinds 0021 draagt de fase wie akkoord gaf (approvedBy) en langs
         welke weg (approvedVia). Via het portaal is het een 'akkoord'; de
         tekst is dan woordelijk die van approve_stage(), zodat de tweeling
         in de logboeken (zelfde tijdstip, één transactie) in add() wegvalt.
         Een naam die de eigenaar in het beheer vastlegde staat er ook bij,
         maar dat blijft de oude soort 'klant': niet in het portaal gedaan.
         Zonder naam staat er wat er altijd stond. */
      var viaPortaal = doorKlant(s);
      var naam = str(s.approvedBy);
      add({
        at: s.approvedAt,
        id: s.projectId ? s.projectId + ':' + s.stageKey + ':approved' : null,
        kind: viaPortaal ? 'akkoord' : 'klant', klantactie: viaPortaal, actor: 'klant',
        detail: naam
          ? ('Fase goedgekeurd door ' + naam + ': ' + faseNaam(s.stageKey))
          : ('Fase goedgekeurd: ' + faseNaam(s.stageKey)),
        projectId: s.projectId || null
      });
    });

    /* zendingmijlpalen: de gebeurtenissen hangen aan de zending, niet aan
       het project, dus we vertalen shipmentId naar projectId. Ze mogen
       zowel los (shipmentEvents) als genest (shipment.events) binnenkomen;
       de ontdubbeling op id vangt de overlap af. */
    var shipById = indexBy(src.shipments, 'id');
    var shipEvents = list(src.shipmentEvents).slice();
    list(src.shipments).forEach(function (s) {
      if (s) list(s.events).forEach(function (ev) { shipEvents.push(ev); });
    });
    shipEvents.forEach(function (ev) {
      if (!ev) return;
      var s = shipById[ev.shipmentId];
      add({
        at: ev.occurredAt || ev.createdAt, id: ev.id, kind: 'systeem', actor: 'systeem',
        detail: joinSub(['Mijlpaal: ' + str(ev.milestoneKey), ev.location, ev.note]),
        projectId: s ? s.projectId : null
      });
    });

    /* facturen: aangemaakt en betaald zijn de twee momenten die er in een
       tijdlijn toe doen */
    list(src.invoices).forEach(function (inv) {
      if (!inv) return;
      add({
        at: inv.createdAt, id: inv.id ? inv.id + ':created' : null,
        kind: 'financieel', actor: 'beheer',
        detail: 'Factuur aangemaakt: ' + joinSub([inv.invoiceNumber, inv.label]),
        projectId: inv.projectId || null
      });
      if (inv.paidAt) {
        add({
          at: inv.paidAt, id: inv.id ? inv.id + ':paid' : null,
          kind: 'financieel', actor: 'klant',
          detail: 'Factuur betaald: ' + joinSub([inv.invoiceNumber, inv.label]),
          projectId: inv.projectId || null
        });
      }
    });

    /* ---------- scope ---------- */
    var kinds = [];
    list(sc.kinds).forEach(function (k) { if (k && k !== 'alles') kinds.push(k); });
    var from = dayISO(sc.from);
    var to = dayISO(sc.to);
    var filtered = [];
    rows.forEach(function (r) {
      if (sc.clientId && r.clientId !== sc.clientId) return;
      if (sc.projectId && r.projectId !== sc.projectId) return;
      /* geen enkele huidige bron draagt een factoryId; een fabriekscope
         levert daarom alleen rijen op die er expliciet één meekregen —
         eerlijker dan raden op een tekstfragment in `detail` */
      if (sc.factoryId && r.factoryId !== sc.factoryId) return;
      if (kinds.length && kinds.indexOf(r.kind) === -1) return;
      var day = dayISO(r.at);
      if (from && (!day || day < from)) return;
      if (to && (!day || day > to)) return;
      filtered.push(r);
    });

    /* aflopend op tijd: het nieuwste bovenaan */
    filtered = stableSort(filtered, function (a, b) { return cmpText(b.at, a.at); });
    var limit = (typeof sc.limit === 'number' && sc.limit > 0) ? sc.limit : 0;
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /* ============================================================
     7. EXPORT
     ============================================================ */

  /* DEZE TABEL IS DE HELE API. Staat een functie er niet in, dan bestaat hij
     voor een scherm niet en bouwt dat scherm hem vroeg of laat na — zo is de
     kopie van invoiceDueISO() in dev/admin-ui.html ontstaan, die de tak
     `inv.invoiceDueISO` al mist. Wie hier iets toevoegt, werkt ook het
     kopblok bovenaan dit bestand bij. */
  return {
    VERSION: VERSION,

    AREAS: AREAS,
    parseRoute: parseRoute,
    buildRoute: buildRoute,
    routeEquals: routeEquals,
    tabOf: tabOf,
    legacyViewToRoute: legacyViewToRoute,
    routeToLegacyView: routeToLegacyView,
    LEGACY_VIEW_NAMES: LEGACY_VIEW_NAMES,

    OWNERS: OWNERS,
    itemKey: itemKey,
    ownerOf: ownerOf,
    /* "deed de klant het?" voor een fase, sampleronde, document of
       contactpersoon (0021) — één antwoord voor projectdetail, klantdetail
       en de tijdlijn, zodat "door klant" nergens net anders wordt afgeleid */
    doorKlant: doorKlant,
    isSnoozed: isSnoozed,
    snoozedUntil: snoozedUntil,
    isPinned: isPinned,
    isChasing: isChasing,

    INBOX_CHIPS: INBOX_CHIPS,
    collectInbox: collectInbox,
    filterInbox: filterInbox,
    inboxBadgeCount: inboxBadgeCount,
    /* de vierstapspijplijn van een herbestelling. collectInbox() zet hem al
       op het item (it.pipeline); deze twee staan erbij zodat een scherm de
       vier stappen kan tekenen en een losse vraag kan navragen zonder de
       volgorde over te typen */
    REORDER_STAGES: REORDER_STAGES,
    reorderPipelineOf: reorderPipelineOf,
    /* de twee klokken achter de Inbox: elk scherm dat een vervaldatum of een
       antwoordtermijn toont rekende ze tot nu toe zelf uit */
    answerDeadlineISO: answerDeadlineISO,
    invoiceDueISO: invoiceDueISO,
    isConceptRow: isConceptRow,

    PROJECT_CHIPS: PROJECT_CHIPS,
    filterProjects: filterProjects,
    sortProjects: sortProjects,
    nextDateFor: nextDateFor,
    /* 'Afgerond' is een afleiding uit de fases en geen veld: zonder deze
       twee schrijft elk scherm die regel opnieuw, en dan net iets anders */
    isArchived: isArchived,
    isFinished: isFinished,

    ACTIVITY_KINDS: ACTIVITY_KINDS,
    mergeActivity: mergeActivity,

    daysBetween: daysBetween,
    relativeDay: relativeDay,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    dayISO: dayISO,

    /* dateParts is de ENIGE plek in het project waar een tijdstempel wordt
       ontleed en waar de tijdzone wordt beslist: een waarde met een Z of een
       verschuiving gaat via new Date() naar lokale tijd, een kale dag wordt
       letterlijk gelezen zodat hij niet een dag verschuift.

       Hij stond hier eerst NIET in, en dat heeft echt geld gekost: een scherm
       dat toch een tijdstip moest tonen schreef zijn eigen ontleding en negeerde
       de Z. Gevolg: dezelfde mail stond op het klantdossier op 07:03 en in
       Activiteit op 05:03, en een gebeurtenis van na tienen 's avonds kwam onder
       de verkeerde dagkop te staan. Wie hier een tweede lezing naast zet, krijgt
       die fout terug — dus gebruik deze. */
    dateParts: dateParts
  };
});
