/* CUSTOM+ — gedeelde datalaag voor de nieuwe beheerschermen.
   ------------------------------------------------------------------
   WAAROM DIT BESTAND BESTAAT
   De eigenaar leverde tien schermafbeeldingen van de gewenste beheer-UI en
   zei: volg deze 1:1, en "dingen die missen moet je erbij doen dus
   ontwikkel het". Hoofdstuk 7 van .claude/beheer-ui-mockup-spec.md was tot
   dat moment een WEGLAATLIJST en is daarmee een BOUWLIJST geworden. De
   kolommen en tabellen staan sinds supabase/portal/0020_beheer_ia.sql in
   de database; dit bestand is de laag die ze in BEIDE modi leest en
   schrijft.

   WAAROM APART EN NIET IN beheer.html
   De bestaande DS-service (makeDemoService / makeSupaService) leeft in
   beheer.html, en dat bestand wordt op dit moment door een tweede bouw
   bewerkt. Deze module levert dezelfde soort interface voor alles wat
   nieuw is, zodat de nieuwe schermen kunnen draaien zonder dat beheer.html
   wordt aangeraakt. Zodra de twee bouwen samenkomen kan dit bestand blijven
   zoals het is: het praat via haken met de bestaande demo-opslag en via de
   meegegeven Supabase-client met de database.

   ==================================================================
   RESTPOST — OVER TE ZETTEN ZODRA beheer.html VRIJ IS (bewaartermijn)
   ==================================================================
   retentionDays() is sinds deze bouw de enige waarheid over hoe lang een
   verwijderd item nog terug te halen is, en retentionStatus()/canRestore()
   rekenen dat per item uit. beheer.html weet daar nog niets van: dat
   bestand wordt op dit moment door een tweede bouw bewerkt en mag hier
   niet worden aangeraakt. Daar staan de zeven dagen NOG OP VIJF PLEKKEN
   HARDGECODEERD. Alle vijf moeten ze op deze functies over zodra dat
   bestand vrij is, anders zet de eigenaar de bewaartermijn in
   Instellingen op dertig dagen en gooit de prullenbak zijn spullen tóch
   na zeven dagen weg. De vijf, bij naam:

     1. makeDemoService().listTrash() — `var limit = Date.now() - 7*86400000;`
        de purge van de demomodus (rond regel 3986). Dit is er één die
        echt gegevens weggooit; hij moet als eerste om.
     2. makeSupaService().listTrash() — `var limitIso = new Date(Date.now()
        - 7*86400000).toISOString();` diezelfde purge in live modus, als
        delete op admin_trash (rond regel 6002). Ook deze gooit echt weg.
     3. renderSettings(), de lege staat van 'Onlangs verwijderd': de tekst
        'Niets verwijderd in de afgelopen 7 dagen.' (rond regel 11408).
     4. renderSettings(), de regel onder elk prullenbakitem: 'Verwijderd
        <datum> · wordt na 7 dagen definitief' (rond regel 11424).
     5. renderSettings(), het sectiecommentaar erboven: '7 dagen vangnet'
        (rond regel 11405). Dezelfde belofte staat als toelichting ook in
        de commentaarblokken bij softDeleteMedia in allebei de services
        (rond regel 3926 en 5889) en in de kop van golf 2 (rond regel
        2699); die vertellen na de overzetting een verhaal dat niet meer
        klopt en horen in dezelfde beurt mee.

   De overzetting zelf is klein: listTrash() begint met één
   CP_DATA.retentionDays() en gebruikt die uitkomst in de vergelijking, en
   het scherm vraagt per rij CP_DATA.retentionStatus(t.deletedAt, dagen)
   voor de tekst. Tot dat gebeurd is stuurt de instelling niets, en dat is
   precies wat BEWAARTERMIJN_AFGEDWONGEN (false) en BEWAARTERMIJN_UITLEG
   hieronder zeggen — zelfde patroon als RECHTEN_AFGEDWONGEN bij de rollen.
   Wie de vijf plekken omzet, zet die vlag hier op true en haalt deze
   restpost weg. Op één plek, zodat er geen scherm achterblijft dat nog het
   oude verhaal vertelt.

   DE VIJF AFSPRAKEN DIE DE REST VAN HET BESTAND VERKLAREN

   1. EEN WAARHEID OVER DE DEMO-OPSLAG. Dit bestand raakt localStorage
      NOOIT zelf aan. init() krijgt twee haken mee, `lezen` en `schrijven`,
      die naar de bestaande demo-state van beheer.html wijzen. Zonder die
      haken kan er wel gelezen worden (uit de seed) maar niet geschreven —
      dan komt er een nette fout in plaats van een tweede, stille opslag
      die na een verversing verdwenen blijkt.

   2. PARITEIT. Elke methode bestaat in beide modi en geeft dezelfde vorm
      terug. Kan de live modus iets nog niet (tabel niet aangemaakt, kolom
      ontbreekt omdat 0020 nog niet gedraaid is), dan komt er een lege
      lijst of een lege waarde terug — precies zoals listRequests() en
      listContacts() in beheer.html dat al doen. Een scherm hoort leeg te
      zijn, niet kapot.
      DRIE REGELS DIE DAARONDER VALLEN, want ze zijn alle drie een keer
      misgegaan:
        · elke SCHRIJFmethode eindigt op een get van de VOLLEDIGE rij, in
          beide modi. Niet op de patch die je meestuurde, want dan werkt
          res.name live wel en in demo niet;
        · elke LIJST wordt in JavaScript gesorteerd, in beide modi, en nooit
          met order() aan de databasekant. Postgres sorteert op zijn
          collatie en JavaScript op codepunten, en dat zijn bij accenten en
          hoofdletters twee verschillende lijsten;
        · elke FOUTMELDING die de eigenaar kan lezen luidt in beide modi
          hetzelfde (zie schrijfRijOfWeg).

   3. NIETS VERZINNEN. Er staat in dit bestand geen enkele verzonnen score,
      geen verzonnen deadline en geen verzonnen beveiligingsbelofte. Waar
      een waarde ontbreekt komt null terug en dat betekent "nog niet
      ingevuld" — de UI toont dan een lege stand. Elke afgeleide reeks
      draagt in commentaar de BRON van elk getal, zodat later na te gaan is
      waar een cijfer vandaan komt.

   4. DE KLOK IS EEN PARAMETER. Elke afgeleide grafiekfunctie is puur en
      krijgt "nu" mee, zodat een test hem kan vastzetten. De schrijvende
      methodes gebruiken wél de echte klok — daar IS het moment de gegevens.

   5. HET FABRIEKSDOSSIER STAAT IN TWEE TABELLEN, MAAR NIET IN TWEE
      OBJECTEN. 0020_beheer_ia.sql zet de openbare helft van een fabriek
      (naam, regio, stad, NNN-datum, status, specialisaties, foto, land) op
      factories_partners — een tabel die sinds 0001 leesbaar is voor ELKE
      ingelogde gebruiker, dus ook voor een klant — en de interne helft
      (notities, de vijf contactvelden en de twee scores) in de aparte
      staf-tabel factory_private. Dat is geen stijlkeuze: Postgres kent geen
      leesrecht per KOLOM, dus een klant die één rij van factories_partners
      mag zien, leest die rij hélemaal. Zonder de splitsing zou hij de
      inkoopnotities en het rapportcijfer van zijn eigen leverancier kunnen
      opvragen via de REST API.
      Naar buiten toe merkt geen enkel scherm daar iets van: listFactories,
      getFactory, saveFactory en createFactory lezen en schrijven allebei de
      tabellen en leveren ÉÉN plat fabrieksobject op. Bij het schrijven gaat
      de openbare helft eerst en de interne daarna, en bij createFactory
      BESTAAT de fabriek pas als die eerste insert is geslaagd — anders zou
      een fabriek kunnen ontstaan met alleen een intern dossier, of andersom.
      Een fabriek ZONDER rij in factory_private is de normale beginstand en
      geen fout; de interne velden komen dan leeg terug (scores null).
      IN DEMOMODUS BESTAAT DIE SPLITSING NIET: daar houdt de browser één
      plat record per fabriek in state.factories, precies zoals demo-data-ia.js
      hem neerzet, en is er dus ook niets te verdelen of samen te voegen. Dat
      is het enige verschil tussen de twee modi, en het is er één die geen
      aanroeper kan zien: de vorm die eruit komt is identiek. De reden dat
      het mag: de demo-opslag staat in de browser van de eigenaar zelf en
      wordt door geen enkele klant gelezen — er is daar geen tabel waar hij
      per ongeluk bij kan.

   PUBLIEKE API (globalThis.CP_DATA, en module.exports in Node)
     VERSION
     init(opts) / modus() / gekoppeld()
     ROLLEN / ROL_KEYS / rolLabel / RECHTEN_AFGEDWONGEN / RECHTEN_UITLEG
     FABRIEK_STATUS / TEAM_STATUS / WEEKDAGEN / CAPACITEIT_DEFAULT
     FABRIEK_OPENBARE_VELDEN / FABRIEK_INTERNE_VELDEN
     AVATAR_SOORTEN
     -- fabrieken (blok A, twee tabellen achter één object)
     listFactories / getFactory / saveFactory / createFactory
     archiveFactory / setFactoryScores / setFactorySpecialties
     -- koppelingen en losse velden (blokken B, D, E, F)
     factoryIdOf / setProjectFactory / saveProjectFields
     saveClientProfile / saveRequestFields
     getProject / getClient / getRequest
     -- gespreksdraad (blok G)
     listMessages / addMessage / threadOf
     -- team (blok H)
     listTeam / getTeamMember / saveTeamMember / inviteTeamMember
     deactivateTeamMember
     -- werkdruk (blok I)
     capacity / saveCapacity / workload
     -- bewaartermijn en back-up (blok J)
     retentionDays / saveRetentionDays / retentionStatus / canRestore
     BEWAARTERMIJN_DEFAULT / BEWAARTERMIJN_AFGEDWONGEN / BEWAARTERMIJN_UITLEG
     lastBackupAt / markBackup / backupUitleg
     -- afgeleide reeksen (puur)
     portfolioHealth / cashflow / invoiceRhythm / activityBreakdown / mostActive
     -- bestanden (blok C)
     saveAvatar / avatarUrl / clientContactAvatar / initialen
     -- kleine hulpjes die de schermen delen
     weekMondayISO / dayISO / datumLabel / maandLabel / verdeelProcenten
     factuurBedragCents / factuurBetaaldCents / antwoordDeadlineISO
     factuurVervalISO

   LADEN
     browser : <script src="portal/admin-data.js"></script> ná
               portal/demo-data.js en portal/demo-files.js. Het bestand zet
               zichzelf op globalThis als CP_DATA; daarna roept de shell
               eenmalig CP_DATA.init(...) aan.
     node    : import '../portal/admin-data.js' (of require) — het zet
               zichzelf óók op module.exports, dus een test kan hem gewoon
               importeren. De pure functies werken daar zonder init().
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_DATA = api;
  /* Node/CommonJS: er is geen package.json met "type":"module", dus dit
     bestand is daar CJS en dit is een echte export. Draait het ooit als
     ESM, dan bestaat `module` niet en blijft alleen globalThis over. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     0. KALE HULPJES
     Bewust niet gedeeld met beheer.html: dit bestand mag nergens van
     afhangen, anders is het niet los te testen.
     ============================================================ */

  function lijstVan(v) { return Array.isArray(v) ? v : []; }
  function tekst(v) { return (v === null || v === undefined) ? '' : String(v); }
  function trim(v) { return tekst(v).replace(/^\s+|\s+$/g, ''); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isFunctie(v) { return typeof v === 'function'; }

  function kopie(o) {
    if (o === null || o === undefined) return o;
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; }
  }

  /* HET GETAL, OF NIETS — lees dit voordat je ergens Number() schrijft.
     Number(null) is 0, Number('') is 0, Number('   ') is 0 en Number(false)
     is 0. Alle vier zijn eindig en niet negatief, dus een controle van de
     vorm `var n = Number(v); if (!isFinite(n) || n < 0) …` laat ze
     ongemoeid door en levert stilletjes een NUL op waar de bedoeling
     "ontbreekt" was. Dat is precies het soort verschil dat niemand meldt:
     een dag zonder capaciteit wordt capaciteit nul, een factuur met een
     leeg totaalveld wordt een factuur van nul euro.
     Deze functie geeft het getal terug, of null wanneer er geen getal IS.
     Elke plek in dit bestand waar 0 een geldige uitkomst is, hoort hem te
     gebruiken en zelf te beslissen wat "niets" daar betekent. */
  function getalOfNull(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean') return null;
    if (typeof v !== 'number' && trim(v) === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  /* geheel getal, nooit NaN. Centen komen als geheel getal uit de database;
     glipt er ooit een kommagetal doorheen, dan ronden we hier één keer af in
     plaats van het door de hele optelling te laten lekken.
     LET OP: hier is 0 wél de bedoeling voor een ontbrekende waarde — een
     telling die er niet is, is nul. Waar dat NIET klopt (een bedrag dat kan
     ontbreken, een instelling met een eigen default) gebruik je getalOfNull
     hierboven en beslis je zelf. */
  function heelGetal(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return Math.round(n);
  }

  function pad2(n) { var s = String(n); return s.length < 2 ? '0' + s : s; }
  function pad4(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }

  function indexOp(rijen, sleutel) {
    var uit = {};
    lijstVan(rijen).forEach(function (r) {
      if (r && r[sleutel] !== undefined && r[sleutel] !== null) uit[r[sleutel]] = r;
    });
    return uit;
  }

  /* stabiel sorteren zonder op de motor te vertrouwen — Array#sort is pas
     vanaf ES2019 gegarandeerd stabiel en dit bestand draait ook ouder */
  function stabielSorteren(arr, cmp) {
    var gewikkeld = lijstVan(arr).map(function (v, i) { return { v: v, i: i }; });
    gewikkeld.sort(function (a, b) {
      var r = cmp(a.v, b.v);
      if (r) return r;
      return a.i - b.i;
    });
    return gewikkeld.map(function (w) { return w.v; });
  }

  /* Vergelijking op CODEPUNTEN. Goed voor sleutels die per definitie uit
     ASCII bestaan en waar de volgorde een rekenkundige is: ISO-tijdstempels,
     ISO-dagen, vaste sleutels als de soort van een agenda-item. NOOIT voor
     iets dat een mens leest — daarvoor is cmpNaam hieronder. */
  function cmpTekst(a, b) {
    var x = tekst(a), y = tekst(b);
    if (x < y) return -1;
    if (x > y) return 1;
    return 0;
  }

  /* Vergelijking op NAAM, in het Nederlands.
     WAAROM DIT NIET cmpTekst MAG ZIJN: op codepunten staat 'Z' vóór 'a' en
     'Ö' ver achter 'Z', dus "Zhang", "ateliers" en "Östberg" komen in een
     volgorde die geen mens verwacht. Postgres sorteert met order('name') op
     de collatie van de database en doet het wél ongeveer goed. Het gevolg
     was een lijst die in demomodus anders op het scherm stond dan in live
     modus — dezelfde fabrieken, andere volgorde.
     Daarom sorteert dit bestand ELKE mensenlijst zelf, in JavaScript, na
     het ophalen: dan is er nog maar één volgorde en die is in beide modi
     dezelfde. Zie sorteerOpNaam() en teamSorteren().
     De terugval is er voor een motor zonder Intl (localeCompare weigert dan
     de locale-parameter met een RangeError): kleine letters vergelijken is
     niet de Nederlandse volgorde, maar wel dezelfde in beide modi — en dat
     is het enige wat hier stuk kan. */
  var KAN_LOCALE = (function () {
    try { 'a'.localeCompare('b', 'nl'); return true; } catch (e) { return false; }
  })();

  function cmpNaam(a, b) {
    var x = tekst(a), y = tekst(b);
    if (x === y) return 0;
    if (KAN_LOCALE) {
      var r = x.localeCompare(y, 'nl');
      if (r < 0) return -1;
      if (r > 0) return 1;
      return 0;
    }
    return cmpTekst(x.toLowerCase(), y.toLowerCase()) || cmpTekst(x, y);
  }

  /* Sorteert een lijst records op een naamveld, stabiel en in het
     Nederlands. Gebruik dit in BEIDE modi en nooit order('name') aan de
     databasekant, want dat zijn twee verschillende volgordes. */
  function sorteerOpNaam(rijen, veld) {
    var k = veld || 'name';
    return stabielSorteren(rijen, function (a, b) {
      return cmpNaam(a && a[k], b && b[k]);
    });
  }

  function uniekId(voorvoegsel) {
    var r = Math.random().toString(36).slice(2, 9);
    return voorvoegsel + '-' + Date.now().toString(36) + r;
  }

  /* Procenten die OPTELLEN TOT 100 (grootste-restverdeling). Een donut met
     drie segmenten van 33% laat een gat zien dat niemand kan verklaren;
     deze verdeling geeft de rest aan de segmenten met de grootste
     afgeknipte staart. Zelfde principe als allocateProportional() in
     portal/invoice-core.js, maar hier op tellingen in plaats van centen. */
  function verdeelProcenten(getallen) {
    var arr = [], totaal = 0, i;
    for (i = 0; i < lijstVan(getallen).length; i++) {
      var n = heelGetal(getallen[i]);
      if (n < 0) n = 0;
      arr.push(n);
      totaal += n;
    }
    var uit = [];
    if (totaal <= 0) {
      for (i = 0; i < arr.length; i++) uit.push(0);
      return uit;
    }
    var rest = [], som = 0;
    for (i = 0; i < arr.length; i++) {
      var exact = arr[i] * 100 / totaal;
      var basis = Math.floor(exact);
      uit.push(basis);
      som += basis;
      rest.push({ i: i, r: exact - basis });
    }
    rest.sort(function (a, b) {
      if (b.r !== a.r) return b.r - a.r;
      return a.i - b.i;
    });
    var over = 100 - som;
    for (i = 0; i < over && i < rest.length; i++) uit[rest[i].i] += 1;
    return uit;
  }

  /* ============================================================
     1. DATUM EN TIJD

     Dezelfde regels als portal/admin-model.js: een kale dag mag nooit door
     new Date() heen, want '2026-03-12' wordt in sommige motoren
     UTC-middernacht en schuift dan bij het formatteren een dag terug.
     Daarom lezen we de cijfers letterlijk zodra er geen tijdzone in de
     tekst staat.
     ============================================================ */

  var MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|z|[+-]\d{2}:?\d{2})?)?$/;

  function datumDelen(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'object' && isFunctie(v.getTime)) {
      if (isNaN(v.getTime())) return null;
      return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
    }
    var s = tekst(v);
    var m = s.match(ISO_RE);
    if (m) {
      if (!m[7]) {
        var mo = +m[2], da = +m[3];
        if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
        return { y: +m[1], m: mo, d: da };
      }
      var d1 = new Date(s);
      if (isNaN(d1.getTime())) return null;
      return { y: d1.getFullYear(), m: d1.getMonth() + 1, d: d1.getDate() };
    }
    var d2 = new Date(s);
    if (isNaN(d2.getTime())) return null;
    return { y: d2.getFullYear(), m: d2.getMonth() + 1, d: d2.getDate() };
  }

  /* 'YYYY-MM-DD' of null — de vorm waarin de hele app dagen vergelijkt */
  function dayISO(v) {
    var p = datumDelen(v);
    if (!p) return null;
    return pad4(p.y) + '-' + pad2(p.m) + '-' + pad2(p.d);
  }

  /* dagnummer sinds 1970 via Date.UTC: puur rekenen, geen tijdzone */
  function dagIndex(v) {
    var p = datumDelen(v);
    if (!p) return null;
    return Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }

  function isoVanIndex(idx) {
    var d = new Date(idx * 86400000);
    return pad4(d.getUTCFullYear()) + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }

  function vandaagVan(nu) {
    return dayISO(nu || new Date()) || dayISO(new Date());
  }

  function nuISO(nu) {
    if (nu) {
      var p = datumDelen(nu);
      if (p) return tekst(nu);
    }
    return new Date().toISOString();
  }

  /* Een MOMENT in milliseconden, of null. Nodig voor de bewaartermijn: die
     rekent in beheer.html op de milliseconde (Date.now() - n*86400000) en
     niet op hele dagen, dus een dagvergelijking zou daar net iets anders
     uitkomen. Een kale dag zonder tijd wordt UTC-middernacht — dezelfde
     lezing als dagIndex() hierboven, zodat de twee nooit een dag schelen. */
  function tijdstipMs(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'object' && isFunctie(v.getTime)) {
      return isNaN(v.getTime()) ? null : v.getTime();
    }
    var s = trim(v);
    if (!s) return null;
    var m = s.match(ISO_RE);
    if (m && !m[4]) {
      var idx = dagIndex(s);
      return idx === null ? null : idx * 86400000;
    }
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  function dagenTussen(aIso, bIso) {
    var a = dagIndex(aIso), b = dagIndex(bIso);
    if (a === null || b === null) return null;
    return b - a;
  }

  /* maandag van de week waarin deze datum valt. dagIndex 0 is
     1970-01-01 en dat was een donderdag, dus weekdag = (idx + 4) % 7 met
     0 = zondag. Nooit met getDay() van een lokale Date: dan verschuift de
     week bij een gebruiker in een andere tijdzone. */
  function weekMondayISO(v) {
    var idx = dagIndex(v || new Date());
    if (idx === null) idx = dagIndex(new Date());
    var dow = (idx + 4) % 7;          /* 0 = zo, 1 = ma, … 6 = za */
    var schuif = (dow + 6) % 7;       /* ma = 0, zo = 6 */
    return isoVanIndex(idx - schuif);
  }

  function maandVan(v) {
    var iso = dayISO(v);
    return iso ? iso.slice(0, 7) : null;
  }

  function maandLabel(maand) {
    var m = tekst(maand).match(/^(\d{4})-(\d{2})$/);
    if (!m) return '';
    var i = +m[2] - 1;
    if (i < 0 || i > 11) return '';
    return MAANDEN_KORT[i] + ' ' + m[1];
  }

  function datumLabel(iso) {
    var p = datumDelen(iso);
    if (!p) return '';
    return p.d + ' ' + MAANDEN_KORT[p.m - 1] + ' ' + p.y;
  }

  /* antwoordklok (de belofte van één werkdag): ontvangst + 1 dag, weekend
     overslaand. Exact dezelfde regel als answerDeadline() in beheer.html en
     answerDeadlineISO() in admin-model.js — bestaat CP_MODEL, dan gebruiken
     we die zodat er onmogelijk twee klokken kunnen ontstaan. */
  function antwoordDeadlineISO(gevraagdOp) {
    var model = externModel();
    if (model && isFunctie(model.answerDeadlineISO)) return model.answerDeadlineISO(gevraagdOp);
    var idx = dagIndex(gevraagdOp);
    if (idx === null) return null;
    idx += 1;
    while (((idx + 4) % 7) === 0 || ((idx + 4) % 7) === 6) idx += 1;
    return isoVanIndex(idx);
  }

  /* vervaldatum van een factuur: het echte veld als het bestaat (de
     factuurmodule vult dueDate), anders de bestaande projectie aanmaak +
     30 dagen — dezelfde grens als het 30+-signaal van computeSignals(). */
  function factuurVervalISO(inv) {
    var model = externModel();
    if (model && isFunctie(model.invoiceDueISO)) return model.invoiceDueISO(inv);
    if (!inv) return null;
    if (inv.dueDate) return dayISO(inv.dueDate);
    var basis = dagIndex(inv.createdAt);
    if (basis === null) return null;
    return isoVanIndex(basis + 30);
  }

  function externModel() {
    if (typeof globalThis !== 'undefined' && globalThis.CP_MODEL) return globalThis.CP_MODEL;
    return null;
  }

  function vensterGlobaal() {
    if (typeof globalThis !== 'undefined') return globalThis;
    return null;
  }

  /* conceptstand (functie 42 van beheer.html): een ontbrekend veld telt als
     gepubliceerd, want dat is migratie-veilig voor al het bestaande */
  function isConcept(rij) {
    return !!rij && rij.publishStatus === 'concept';
  }

  /* ============================================================
     2. CONSTANTEN

     Alles wat een scherm als LABEL toont staat hier en niet in het scherm:
     twee schermen die dezelfde rol anders noemen is precies het soort
     verschil dat niemand meldt en iedereen ziet.
     ============================================================ */

  /* ---- blok H: rollen ----
     LEES DIT VOORDAT JE EEN ROL GEBRUIKT OM IETS TOE TE STAAN.
     RECHTEN_AFGEDWONGEN staat op false en dat is geen slordigheid maar de
     waarheid: RLS kent vandaag maar één begrip, is_staff(), en iedereen in
     staff_users mag daar alles. De rol staat in het scherm, hij wordt
     nergens gecontroleerd. Een rolkeuze die niets doet en dat niet zegt is
     erger dan geen rolkeuze — daarom MOET elk scherm dat rollen toont ook
     RECHTEN_UITLEG tonen.

     Dit gaat op true zodra team_members aan auth.users hangt en is_staff()
     is vervangen door een rolcontrole in de policies. Wie dat bouwt, zet
     de vlag hier om en verwijdert de zin uit RECHTEN_UITLEG — op één plek,
     zodat er geen scherm achterblijft dat nog het oude verhaal vertelt. */
  var RECHTEN_AFGEDWONGEN = false;

  var RECHTEN_UITLEG = 'De rollen hieronder zijn vandaag beschrijvend: ze staan in dit scherm, '
    + 'maar de database dwingt ze nog niet af. Iedereen met een beheeraccount kan alles. '
    + 'Zodra de rechten echt worden afgedwongen verdwijnt deze regel.';

  var ROLLEN = [
    { key: 'eigenaar', label: 'Eigenaar', bedoeld: 'Alles, inclusief facturatie, instellingen en het team zelf. Er is er één.' },
    { key: 'beheerder', label: 'Beheerder', bedoeld: 'Alles behalve het eigenaarschap overdragen.' },
    { key: 'medewerker', label: 'Medewerker', bedoeld: 'Werkt in projecten, klanten en de inbox; komt niet aan facturatie en instellingen.' },
    { key: 'lezer', label: 'Lezer', bedoeld: 'Kijkt mee en wijzigt niets.' }
  ];
  var ROL_KEYS = ROLLEN.map(function (r) { return r.key; });

  function rolLabel(key) {
    for (var i = 0; i < ROLLEN.length; i++) { if (ROLLEN[i].key === key) return ROLLEN[i].label; }
    return tekst(key);
  }

  var TEAM_STATUS = [
    { key: 'actief', label: 'Actief' },
    { key: 'uitgenodigd', label: 'Uitgenodigd' },
    { key: 'inactief', label: 'Inactief' }
  ];
  var TEAM_STATUS_KEYS = TEAM_STATUS.map(function (s) { return s.key; });

  /* ---- blok A: fabrieksstatus ---- */
  var FABRIEK_STATUS = [
    { key: 'actief', label: 'Actief', toon: 'ok' },
    { key: 'gepauzeerd', label: 'Gepauzeerd', toon: 'warn' },
    { key: 'gearchiveerd', label: 'Gearchiveerd', toon: 'stil' }
  ];
  var FABRIEK_STATUS_KEYS = FABRIEK_STATUS.map(function (s) { return s.key; });

  /* ---- blok I: weekdagen ----
     Bewust een OBJECT met Nederlandse afkortingen en geen array van zeven.
     Bij een array is het onvermijdelijk dat de een index 0 als zondag leest
     (JavaScript getDay) en de ander als maandag (de kalender loopt ma t/m
     zo), en die verwarring is stil en onvindbaar. Zelfde keuze als in
     0020_beheer_ia.sql. */
  var WEEKDAGEN = [
    { key: 'ma', label: 'Maandag', kort: 'ma' },
    { key: 'di', label: 'Dinsdag', kort: 'di' },
    { key: 'wo', label: 'Woensdag', kort: 'wo' },
    { key: 'do', label: 'Donderdag', kort: 'do' },
    { key: 'vr', label: 'Vrijdag', kort: 'vr' },
    { key: 'za', label: 'Zaterdag', kort: 'za' },
    { key: 'zo', label: 'Zondag', kort: 'zo' }
  ];
  var WEEKDAG_KEYS = WEEKDAGEN.map(function (d) { return d.key; });

  /* Exact de default uit 0020_beheer_ia.sql. Zes acties per werkdag, nul in
     het weekend: een verdedigbaar startpunt voor een eenmanszaak dat de
     eigenaar in Instellingen bijstelt. Dit is GEEN meting. */
  var CAPACITEIT_DEFAULT = { ma: 6, di: 6, wo: 6, do: 6, vr: 6, za: 0, zo: 0 };

  var BEWAARTERMIJN_DEFAULT = 7;   /* het hardgecodeerde venster van vandaag */

  /* ---- blok J: wordt de bewaartermijn ergens afgedwongen? ----
     LEES DIT VOORDAT JE HET INSTELSCHERM BOUWT. Net als bij de rollen staat
     hier een vlag op false omdat dat de waarheid is: retentionDays() is een
     échte instelling, maar het enige dat vandaag ECHT opruimt is listTrash()
     in beheer.html, en die telt nog altijd zeven dagen af. Zie de RESTPOST
     bovenaan dit bestand voor de vijf plekken die daarvoor om moeten.
     Zolang deze vlag false is, MOET een scherm dat de bewaartermijn laat
     instellen BEWAARTERMIJN_UITLEG tonen. Een instelling die niets stuurt en
     dat niet zegt, is erger dan geen instelling. */
  var BEWAARTERMIJN_AFGEDWONGEN = false;

  var BEWAARTERMIJN_UITLEG = 'Deze bewaartermijn is nog beschrijvend: de prullenbak ruimt vandaag '
    + 'onveranderlijk na zeven dagen op. Zodra het opruimen deze instelling volgt, verdwijnt deze regel.';

  /* ---- blok C: waar een afbeelding heen gaat ----
     Eén tabel voor alle vijf de soorten, zodat er nergens anders een
     pad/kolom-vertaling rondslingert die na een schemawijziging stil uit de
     pas loopt. `veld` is de camelCase-naam op het record, `kolom` de
     snake_case-kolom in Postgres, `sleutel` de kolom waarop de rij wordt
     gevonden en `viaUpsert` zegt of er nog geen rij hoeft te bestaan.

     LET OP BIJ fabriekContact: die foto hoort bij de contactpersoon van de
     fabriek en dat is een INTERN veld, dus hij staat sinds 0020 in de
     staf-tabel factory_private en niet meer op factories_partners. Daar is
     factory_id de primaire sleutel en een fabriek zonder interne rij is de
     normale beginstand — vandaar upsert op factory_id in plaats van update
     op id. In demomodus blijft alles één plat record per fabriek (zie
     afspraak 5 bovenaan), dus daar wijst `demo` gewoon naar 'factories'.

     ER IS BEWUST GEEN SOORT VOOR DE CONTACTPERSOON VAN EEN KLANT. De
     klantkaart toont die persoon wel, maar zijn naam staat in een kolom op
     de klant zelf (clients.contact_name) en clients heeft maar één
     afbeelding: logo_url, het logo van het BEDRIJF. Er is dus niets om een
     persoonsfoto in op te slaan en we verzinnen daar geen koppeling bij —
     zie clientContactAvatar() onderaan blok C. Wil je wél een echte foto
     bij een persoon van een klant, dan is dat een rij in admin_contacts
     (soort 'contact'); dat is de contactpersonenlijst en die heeft een
     eigen avatar_url. */
  var AVATAR_SOORTEN = {
    team: { tabel: 'team_members', kolom: 'avatar_url', veld: 'avatarUrl', sleutel: 'id', viaUpsert: false, demo: 'teamMembers', map: 'avatars/team', wat: 'de profielfoto van het teamlid' },
    contact: { tabel: 'admin_contacts', kolom: 'avatar_url', veld: 'avatarUrl', sleutel: 'id', viaUpsert: false, demo: 'contacts', map: 'avatars/contact', wat: 'de foto van de contactpersoon' },
    fabriek: { tabel: 'factories_partners', kolom: 'photo_url', veld: 'photoUrl', sleutel: 'id', viaUpsert: false, demo: 'factories', map: 'fabrieken/foto', wat: 'de foto van de fabriek' },
    fabriekContact: { tabel: 'factory_private', kolom: 'contact_avatar_url', veld: 'contactAvatarUrl', sleutel: 'factory_id', viaUpsert: true, demo: 'factories', map: 'fabrieken/contact', wat: 'de foto van de contactpersoon bij de fabriek' },
    klant: { tabel: 'clients', kolom: 'logo_url', veld: 'logoUrl', sleutel: 'id', viaUpsert: false, demo: 'clients', map: 'klanten/logo', wat: 'het logo van de klant' }
  };

  /* de private bucket uit 0012_betalingen.sql. Bewust niet project-media of
     project-docs: die twee zijn via owns_project() leesbaar voor de klant,
     en een fabrieksfoto of teamavatar hoort niet bij een klantproject. */
  var BUCKET = 'beheer-intern';
  var DEMO_BESTAND_MAX = 10 * 1024 * 1024;   /* zelfde grens als beheer.html */

  /* ============================================================
     3. MODUS EN OPSLAG

     ST is de enige veranderlijke toestand in dit bestand. Alles daarbuiten
     is puur of leest via ST.
     ============================================================ */

  var ST = {
    modus: 'demo',
    client: null,
    lezen: null,
    schrijven: null,
    geinitialiseerd: false
  };

  /* opts: {mode:'demo'|'supa', client, lezen, schrijven}
     · mode      'demo' (of niets) = demomodus, 'supa'/'supabase'/'live' = live.
     · client    de Supabase-client; alleen nodig in live modus.
     · lezen()   geeft de demo-state terug — hetzelfde object dat
                 makeDemoService() in beheer.html beheert.
     · schrijven(state)  bewaart die state weer. Mag een Promise geven.

     Waarom haken en geen eigen localStorage: de demo-opslag heeft een
     cross-tab-samenvoeging (de portal-tab schrijft onder dezelfde sleutel)
     en een schema-drift-aanvulling. Dat één keer goed hebben is genoeg;
     twee keer is een gegarandeerd verschil. */
  function init(opts) {
    var o = isObj(opts) ? opts : {};
    var m = trim(o.mode || o.modus).toLowerCase();
    ST.modus = (m === 'supa' || m === 'supabase' || m === 'live') ? 'supa' : 'demo';
    ST.client = o.client || null;
    ST.lezen = isFunctie(o.lezen) ? o.lezen : null;
    ST.schrijven = isFunctie(o.schrijven) ? o.schrijven : null;
    ST.geinitialiseerd = true;
    return ST.modus;
  }

  function modus() { return ST.modus; }

  /* Is er echt iets om mee te praten? De schermen kunnen hiermee een
     eerlijke lege stand tonen in plaats van een rij foutmeldingen. */
  function gekoppeld() {
    if (ST.modus === 'supa') return !!ST.client;
    return !!(ST.lezen && ST.schrijven);
  }

  function isDemo() { return ST.modus !== 'supa'; }

  function sb() { return ST.client; }

  /* ---- demo-opslag ---------------------------------------------------- */

  /* De seed voor een collectie die de bestaande demo-state nog niet kent —
     teamMembers en questionMessages bestaan pas sinds deze bouw, dus een
     demo-opslag van gisteren mist ze.

     portal/demo-data-ia.js is de uitbreiding op de seed. Die zet zichzelf
     neer als CP_DEMO_IA = {VERSION, toepassen} en PATCHT window.CP_DEMO bij
     het laden; de nieuwe collecties komen dus in CP_DEMO terecht. We kijken
     toch eerst in CP_DEMO_IA zelf, voor het geval een latere versie de
     lijsten daar rechtstreeks neerzet — dan blijft dit werken zonder
     wijziging hier. Bestaat geen van beide, dan is een lege lijst het
     eerlijke antwoord; er wordt niets verzonnen. */
  function seedLijst(sleutel) {
    var g = vensterGlobaal();
    if (!g) return [];
    var bronnen = [];
    if (g.CP_DEMO_IA) bronnen.push(g.CP_DEMO_IA);
    if (g.CP_DEMO) bronnen.push(g.CP_DEMO);
    for (var i = 0; i < bronnen.length; i++) {
      if (Array.isArray(bronnen[i][sleutel])) return kopie(bronnen[i][sleutel]);
    }
    return [];
  }

  function demoState() {
    if (ST.lezen) {
      var s = ST.lezen();
      if (isObj(s)) return s;
    }
    /* geen haak: leesbare terugval op de seed zodat een scherm iets kan
       tonen. Er wordt hier NOOIT een tweede opslag aangelegd. */
    var g = vensterGlobaal();
    var seed = g && g.CP_DEMO;
    return isObj(seed) ? seed : {};
  }

  /* de collectie uit de demo-state, met aanvulling voor schema-drift. De
     aanvulling wordt alleen in de state geschreven wanneer er ook echt een
     opslag achter zit — anders zouden we de gedeelde seed vervuilen. */
  function demoLijst(state, sleutel) {
    if (Array.isArray(state[sleutel])) return state[sleutel];
    var v = seedLijst(sleutel);
    if (ST.schrijven) state[sleutel] = v;
    return v;
  }

  function demoInstellingen(state) {
    if (!isObj(state.settings)) {
      if (!ST.schrijven) return {};
      state.settings = {};
    }
    return state.settings;
  }

  function eisSchrijven() {
    if (isDemo() && !ST.schrijven) {
      return new Error('De demo-opslag is niet gekoppeld. Roep CP_DATA.init aan met een lezen- en '
        + 'een schrijven-haak naar de bestaande demo-state; er wordt bewust geen tweede opslag aangelegd.');
    }
    if (!isDemo() && !ST.client) {
      return new Error('Er is geen verbinding met de database. De wijziging is niet opgeslagen.');
    }
    return null;
  }

  function demoBewaren(state, uitkomst) {
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    return Promise.resolve(ST.schrijven(state)).then(function () { return uitkomst; });
  }

  /* ---- Supabase-hulpjes ----------------------------------------------- */

  function naarCamel(k) {
    return tekst(k).replace(/_([a-z0-9])/g, function (m, c) { return c.toUpperCase(); });
  }
  function naarSnake(k) {
    return tekst(k).replace(/[A-Z]/g, function (ch) { return '_' + ch.toLowerCase(); });
  }
  function camelRij(r) {
    if (!isObj(r)) return r;
    var uit = {};
    Object.keys(r).forEach(function (k) { uit[naarCamel(k)] = r[k]; });
    return uit;
  }

  /* TOLERANT LEZEN: bestaat de tabel of de kolom nog niet (0020 niet
     gedraaid), dan is een lege lijst het antwoord — niet een kapot scherm.
     Exact het patroon van listRequests()/listContacts() in beheer.html. */
  function rijenTolerant(res) {
    if (!res || res.error) return [];
    return lijstVan(res.data).map(camelRij);
  }
  function leeg() { return []; }
  function nul() { return null; }

  /* SCHRIJVEN mag wél klappen: een wijziging die stil verdwijnt is erger
     dan een foutmelding. De boodschap is Nederlands en noemt de oorzaak. */
  function schrijfUit(res, wat) {
    if (res && res.error) {
      var m = res.error.message || res.error.details || 'onbekende fout';
      throw new Error(wat + ': ' + m);
    }
    return res ? res.data : null;
  }
  function schrijfRij(res, wat) {
    var d = schrijfUit(res, wat);
    return d ? camelRij(Array.isArray(d) ? d[0] : d) : null;
  }

  /* Zelfde als schrijfRij, maar met een eigen zin voor "die rij is er niet
     (meer)". Een update met .single() die nul rijen raakt is bij PostgREST
     geen lege uitkomst maar een FOUT (code PGRST116, "JSON object requested,
     multiple (or no) rows returned"). Zonder deze vertaling zegt de
     demomodus "Dit project bestaat niet (meer)." en de live modus een
     databasezin over JSON-objecten — dezelfde ongelijkheid als bij de
     teruggave, alleen dan in de foutmelding, en juist daar leest de eigenaar
     mee. Herkent hij de fout niet, dan valt hij terug op de gewone
     boodschap: liever de ruwe reden dan een verkeerde gok. */
  function schrijfRijOfWeg(res, wat, weg) {
    if (res && res.error) {
      var code = tekst(res.error.code);
      var m = tekst(res.error.message);
      if (code === 'PGRST116' || /multiple \(or no\) rows|no rows|0 rows/i.test(m)) {
        throw new Error(weg);
      }
    }
    return schrijfRij(res, wat);
  }

  /* patch met camelCase-sleutels → rij met snake_case-kolommen, en alleen
     de sleutels die in `toegestaan` staan. Wat hier niet in staat wordt ook
     niet weggeschreven; dat scheelt een stille kolomfout bij een typefout. */
  function naarRij(patch, toegestaan) {
    var uit = {};
    Object.keys(isObj(patch) ? patch : {}).forEach(function (k) {
      if (toegestaan.indexOf(k) < 0) return;
      uit[naarSnake(k)] = patch[k];
    });
    return uit;
  }

  /* ============================================================
     4. BLOK A — FABRIEKSDOSSIER

     Een fabriek was drie velden (naam, regio, NNN-datum) plus de stad uit
     0003. Hieronder staat het complete dossier uit 0020, met per veld de
     lege stand die de UI moet tonen wanneer de eigenaar hem nog niet heeft
     ingevuld. Een score van null betekent "nog niet beoordeeld" en is iets
     anders dan een 1 — de UI toont dan vijf lege stippen.

     TWEE TABELLEN, ÉÉN OBJECT — zie afspraak 5 bovenaan dit bestand voor
     het waarom. De twee lijsten hieronder zijn de enige plek waar staat
     welk veld waar woont; alles daaronder leest ze en niemand herhaalt de
     verdeling. Zet je een veld op de verkeerde lijst, dan komt het
     ofwel in een tabel die de klant kan lezen (fout, en stil) ofwel in een
     kolom die niet bestaat (fout, en luidruchtig — dat is de goede kant).
     ============================================================ */

  /* De ONSCHADELIJKE helft: factories_partners. Deze tabel is sinds 0001
     leesbaar voor elke ingelogde gebruiker, dus hier hoort alleen wat het
     klantportaal sowieso al toont. Voeg hier NOOIT iets aan toe zonder je
     af te vragen of een klant het mag lezen — het antwoord van Postgres is
     "ja", want een policy filtert rijen en geen kolommen. */
  var FABRIEK_OPENBARE_VELDEN = [
    'name', 'region', 'city', 'nnnSignedAt',
    'status', 'specialties', 'photoUrl', 'country'
  ];

  /* De INTERNE helft: factory_private, staff-only (één policy, is_staff()).
     Notities over prijsstaffels, de contactgegevens van de fabriek en de
     twee rapportcijfers. Het klantportaal raakt deze tabel nooit aan. */
  var FABRIEK_INTERNE_VELDEN = [
    'notes',
    'contactName', 'contactRole', 'contactEmail', 'contactPhone', 'contactAvatarUrl',
    'qualityScore', 'leadtimeScore'
  ];

  /* Alles bij elkaar — de vorm waarin een fabriek dit bestand verlaat en
     binnenkomt. Een aanroeper hoeft de verdeling niet te kennen. */
  var FABRIEK_VELDEN = FABRIEK_OPENBARE_VELDEN.concat(FABRIEK_INTERNE_VELDEN);

  function normSpecialismen(v) {
    var gezien = {}, uit = [];
    lijstVan(v).forEach(function (s) {
      var t = trim(s);
      if (!t) return;
      var sleutel = t.toLowerCase();
      if (gezien[sleutel]) return;
      gezien[sleutel] = true;
      uit.push(t);
    });
    return uit;
  }

  /* 1 t/m 5, of null. Leeg/undefined = nog niet beoordeeld. Een getal
     buiten het bereik wordt NIET stilletjes bijgeknipt: een 7 die als 5
     wordt opgeslagen is een verzonnen cijfer, en de database (check
     quality_score between 1 and 5) zou hem sowieso weigeren. */
  function normScore(v, naam) {
    /* leeg is een geldig antwoord ("nog niet beoordeeld"), onzin niet. Let
       op de volgorde: eerst kijken of er überhaupt iets staat (ook een
       string met alleen spaties telt als leeg), en pas daarna rekenen.
       Number('  ') is 0 en zou anders als "buiten bereik" de foutmelding
       oproepen op iets dat de eigenaar gewoon leeg liet. */
    if (v === null || v === undefined || (typeof v !== 'number' && trim(v) === '')) return null;
    var n = getalOfNull(v);
    if (n === null || Math.floor(n) !== n || n < 1 || n > 5) {
      throw new Error('De ' + naam + ' moet een heel getal van 1 tot en met 5 zijn, of leeg blijven als je nog geen oordeel hebt.');
    }
    return n;
  }

  function normFabriek(r) {
    var f = isObj(r) ? r : {};
    var status = tekst(f.status);
    if (FABRIEK_STATUS_KEYS.indexOf(status) < 0) status = 'actief';
    /* getalOfNull en niet Number(): een score die als lege tekst of als
       JSON-null uit de opslag komt is "nog niet beoordeeld", en Number()
       zou daar een 0 van maken die vervolgens buiten 1..5 valt. Het
       eindresultaat was hier toevallig hetzelfde (null), maar het patroon
       is fout en werd twee regels verderop wél schadelijk. */
    var kwal = getalOfNull(f.qualityScore);
    var door = getalOfNull(f.leadtimeScore);
    return {
      id: f.id || null,
      name: tekst(f.name),
      region: tekst(f.region),
      city: tekst(f.city),
      nnnSignedAt: f.nnnSignedAt || null,
      status: status,
      statusLabel: statusLabelVan(FABRIEK_STATUS, status),
      specialties: normSpecialismen(f.specialties),
      qualityScore: (isFinite(kwal) && kwal >= 1 && kwal <= 5) ? Math.round(kwal) : null,
      leadtimeScore: (isFinite(door) && door >= 1 && door <= 5) ? Math.round(door) : null,
      photoUrl: tekst(f.photoUrl),
      country: tekst(f.country),
      contactName: tekst(f.contactName),
      contactRole: tekst(f.contactRole),
      contactEmail: tekst(f.contactEmail),
      contactPhone: tekst(f.contactPhone),
      contactAvatarUrl: tekst(f.contactAvatarUrl),
      notes: tekst(f.notes)
    };
  }

  function statusLabelVan(tabel, key) {
    for (var i = 0; i < tabel.length; i++) { if (tabel[i].key === key) return tabel[i].label; }
    return tekst(key);
  }

  /* ---- de terugval voor oude rijen (blok B, leeskant) ----
     "Welke projecten draaien er bij deze fabriek" en "wanneer werkten we
     voor het laatst samen" waren tot 0020 uitsluitend AFLEIDINGEN uit de
     fabrieks-id op foto's (media_assets.factory_id) en op de
     NNN-vastleggingen (file_disclosures.factory_id). Sinds 0020 is er
     projects.factory_id. Deze functie gebruikt het echte veld waar het
     staat en valt terug op de afleiding waar het leeg is, zodat een
     bestaande fabriek meteen goed staat zonder dat de eigenaar honderd
     projecten opnieuw moet koppelen.

     `koppelingBron` zegt eerlijk wat er gebeurd is: 'veld' of 'afgeleid'. */
  /* De winnaar van een stemming {id: aantal}, of null bij een lege bak.
     BIJ EEN GELIJKE STAND WINT DE KLEINSTE ID, en dat is geen willekeur
     maar het enige wat in beide modi hetzelfde uitpakt: de demomodus loopt
     door de volgorde van de state, de live modus door de volgorde die
     Postgres toevallig teruggeeft bij een select zonder order. Wie de
     eerste-de-beste bij gelijke stand laat winnen, laat dezelfde fabriek
     in demo aan project X hangen en in live aan project Y. */
  function meesteStemmen(bak) {
    var beste = null, besteN = 0;
    Object.keys(isObj(bak) ? bak : {}).forEach(function (id) {
      var n = bak[id];
      if (n > besteN || (n === besteN && beste !== null && cmpTekst(id, beste) < 0)) {
        besteN = n; beste = id;
      }
    });
    return beste;
  }

  function verrijkFabrieken(fabrieken, bron) {
    var b = isObj(bron) ? bron : {};
    var projecten = lijstVan(b.projects);
    var media = lijstVan(b.media);
    var vastleggingen = lijstVan(b.disclosures);

    /* stap 1: per project de meest voorkomende fabrieks-id op de foto's en
       de vastleggingen — dat is de afleiding zoals hij vandaag werkt */
    var stemmen = {};
    function stem(projectId, factoryId) {
      if (!projectId || !factoryId) return;
      if (!stemmen[projectId]) stemmen[projectId] = {};
      stemmen[projectId][factoryId] = (stemmen[projectId][factoryId] || 0) + 1;
    }
    media.forEach(function (m) { if (m) stem(m.projectId, m.factoryId); });
    vastleggingen.forEach(function (d) { if (d) stem(d.projectId, d.factoryId); });

    var afgeleid = {};
    Object.keys(stemmen).forEach(function (pid) {
      afgeleid[pid] = meesteStemmen(stemmen[pid]);
    });

    /* stap 2: per fabriek de projecten verzamelen */
    var perFabriek = {};
    function voegToe(fid, project, herkomst) {
      if (!fid) return;
      if (!perFabriek[fid]) perFabriek[fid] = { projecten: [], herkomst: {} };
      perFabriek[fid].projecten.push(project);
      perFabriek[fid].herkomst[herkomst] = true;
    }
    projecten.forEach(function (p) {
      if (!p || !p.id) return;
      if (p.factoryId) voegToe(p.factoryId, p, 'veld');
      else if (afgeleid[p.id]) voegToe(afgeleid[p.id], p, 'afgeleid');
    });

    /* stap 3: laatste samenwerking — de jongste ECHTE datum die we hebben:
       de opnamedatum van een foto van deze fabriek of de datum waarop er
       bestanden met haar zijn gedeeld. Geen van beide? Dan null, en de UI
       toont "nog geen samenwerking vastgelegd". */
    var laatste = {};
    function later(fid, iso) {
      var d = dayISO(iso);
      if (!fid || !d) return;
      if (!laatste[fid] || d > laatste[fid]) laatste[fid] = d;
    }
    media.forEach(function (m) { if (m) later(m.factoryId, m.capturedAt || m.createdAt); });
    vastleggingen.forEach(function (d) { if (d) later(d.factoryId, d.disclosedAt); });

    return lijstVan(fabrieken).map(function (f) {
      var rij = normFabriek(f);
      var bak = perFabriek[rij.id] || { projecten: [], herkomst: {} };
      var actief = bak.projecten.filter(function (p) { return p && p.status !== 'archived'; });
      /* op naam sorteren en niet op de volgorde van de bron: in demomodus is
         dat de volgorde van de state, in live modus die van een select
         zonder order — twee verschillende lijsten met dezelfde inhoud */
      rij.projecten = sorteerOpNaam(bak.projecten.map(function (p) {
        return { id: p.id, name: tekst(p.name), status: tekst(p.status), clientId: p.clientId || null };
      }));
      rij.actieveProjecten = actief.length;
      rij.koppelingBron = bak.herkomst.veld ? 'veld' : (bak.herkomst.afgeleid ? 'afgeleid' : null);
      rij.laatsteSamenwerking = laatste[rij.id] || null;
      return rij;
    });
  }

  /* De bronnen die verrijkFabrieken() nodig heeft. In demomodus staan ze in
     de state; live halen we ze tolerant op — mislukt het, dan verliezen we
     alleen de verrijking en niet de fabriekenlijst zelf. */
  function fabrieksBron(bron) {
    if (isObj(bron)) return Promise.resolve(bron);
    if (isDemo()) {
      var s = demoState();
      return Promise.resolve({
        projects: demoLijst(s, 'projects'),
        media: demoLijst(s, 'media'),
        disclosures: demoLijst(s, 'disclosures')
      });
    }
    if (!sb()) return Promise.resolve({});
    return Promise.all([
      sb().from('projects').select('id, name, status, client_id, factory_id').then(rijenTolerant, leeg),
      /* created_at hoort er ook bij: verrijkFabrieken() valt daarop terug
         als een foto geen opnamedatum heeft, en in demomodus staat dat veld
         er wel. Zonder deze kolom werkt die terugval alleen in demomodus en
         is "laatste samenwerking" in live modus stiller dan hij hoort. */
      sb().from('media_assets').select('project_id, factory_id, captured_at, created_at').then(rijenTolerant, leeg),
      sb().from('file_disclosures').select('project_id, factory_id, disclosed_at').then(rijenTolerant, leeg)
    ]).then(function (res) {
      return { projects: res[0], media: res[1], disclosures: res[2] };
    });
  }

  /* ---- de twee helften samenvoegen ----
     Eén plat object uit een openbare rij plus (misschien) een interne rij.
     De interne rij MAG ontbreken: dat is de beginstand van elke fabriek die
     nog geen dossier heeft, en normFabriek() maakt daar lege velden en
     null-scores van. De openbare rij mag NIET ontbreken — een interne rij
     zonder fabriek zou een dossier zijn over niets. */
  function voegFabriekSamen(openbaar, intern) {
    if (!isObj(openbaar)) return null;
    var uit = {};
    Object.keys(openbaar).forEach(function (k) { uit[k] = openbaar[k]; });
    if (isObj(intern)) {
      FABRIEK_INTERNE_VELDEN.forEach(function (k) {
        if (intern[k] !== undefined) uit[k] = intern[k];
      });
    }
    return uit;
  }

  /* De interne rijen, geïndexeerd op fabrieks-id. TOLERANT: bestaat
     factory_private nog niet (0020 niet gedraaid) of mag deze gebruiker er
     niet bij, dan is het antwoord een lege index en tonen de schermen een
     leeg dossier — geen kapot scherm. Dat is precies wat de policy hoort te
     doen bij iemand die geen staff is.
     In demomodus is er niets op te halen: daar staat alles in één plat
     record (afspraak 5 bovenaan), dus deze functie wordt daar nooit
     aangeroepen. */
  function interneFabrieksrijen(id) {
    if (!sb()) return Promise.resolve({});
    var q = sb().from('factory_private').select('*');
    if (id) q = q.eq('factory_id', id);
    return q.then(rijenTolerant, leeg).then(function (rijen) {
      return indexOp(rijen, 'factoryId');
    });
  }

  function listFactories(bron) {
    if (isDemo()) {
      var s = demoState();
      var rijen = demoLijst(s, 'factories').slice();
      return fabrieksBron(bron).then(function (b) {
        return sorteerOpNaam(verrijkFabrieken(rijen, b));
      });
    }
    if (!sb()) return Promise.resolve([]);
    /* GEEN order('name') meer aan de databasekant: dat sorteert op de
       collatie van Postgres en de demomodus deed het in JavaScript, dus
       dezelfde lijst stond in de twee modi in een andere volgorde zodra er
       een accent of een hoofdletter in een naam zat. Nu sorteren allebei de
       takken hieronder in JavaScript met sorteerOpNaam(). */
    return Promise.all([
      sb().from('factories_partners').select('*').then(rijenTolerant, leeg),
      interneFabrieksrijen(null)
    ]).then(function (res) {
      var intern = res[1];
      var samen = res[0].map(function (f) { return voegFabriekSamen(f, intern[f.id]); });
      return fabrieksBron(bron).then(function (b) {
        return sorteerOpNaam(verrijkFabrieken(samen, b));
      });
    });
  }

  function getFactory(id, bron) {
    if (!id) return Promise.resolve(null);
    if (isDemo()) {
      var s = demoState();
      var f = demoLijst(s, 'factories').filter(function (x) { return x && x.id === id; })[0];
      if (!f) return Promise.resolve(null);
      return fabrieksBron(bron).then(function (b) { return verrijkFabrieken([f], b)[0]; });
    }
    if (!sb()) return Promise.resolve(null);
    return Promise.all([
      sb().from('factories_partners').select('*').eq('id', id).maybeSingle()
        .then(function (res) { return (res && !res.error && res.data) ? camelRij(res.data) : null; }, nul),
      interneFabrieksrijen(id)
    ]).then(function (res) {
      var openbaar = res[0];
      if (!openbaar) return null;
      var samen = voegFabriekSamen(openbaar, res[1][id]);
      return fabrieksBron(bron).then(function (b) { return verrijkFabrieken([samen], b)[0]; });
    });
  }

  /* velden mag elk deel van FABRIEK_VELDEN bevatten. Wat er niet in staat
     blijft ongemoeid — dit is een patch, geen vervanging. Geeft terug wat
     er ECHT is opgeslagen (de genormaliseerde rij), niet wat er is
     meegestuurd. */
  function saveFactory(id, velden) {
    if (!id) return Promise.reject(new Error('Er is geen fabriek gekozen om op te slaan.'));
    var f = eisSchrijven();
    if (f) return Promise.reject(f);

    var patch = {};
    var v = isObj(velden) ? velden : {};
    var fout = null;
    FABRIEK_VELDEN.forEach(function (k) {
      if (v[k] === undefined) return;
      if (k === 'specialties') { patch[k] = normSpecialismen(v[k]); return; }
      if (k === 'qualityScore' || k === 'leadtimeScore') {
        try { patch[k] = normScore(v[k], k === 'qualityScore' ? 'kwaliteitsscore' : 'doorlooptijdscore'); }
        catch (e) { fout = e; }
        return;
      }
      if (k === 'status') {
        var st = trim(v[k]);
        if (FABRIEK_STATUS_KEYS.indexOf(st) < 0) {
          fout = new Error('Onbekende fabrieksstatus: ' + st + '. Kies actief, gepauzeerd of gearchiveerd.');
          return;
        }
        patch[k] = st;
        return;
      }
      if (k === 'nnnSignedAt') { patch[k] = v[k] ? dayISO(v[k]) : null; return; }
      patch[k] = tekst(v[k]);
    });
    if (fout) return Promise.reject(fout);
    if (!Object.keys(patch).length) return getFactory(id);

    if (isDemo()) {
      /* DEMOMODUS KENT DE SPLITSING NIET: één plat record per fabriek in de
         browser van de eigenaar zelf, dus er valt niets te verdelen. Zie
         afspraak 5 bovenaan dit bestand voor waarom dat mag. */
      var s = demoState();
      var rij = demoLijst(s, 'factories').filter(function (x) { return x && x.id === id; })[0];
      if (!rij) return Promise.reject(new Error('Deze fabriek bestaat niet (meer).'));
      Object.keys(patch).forEach(function (k) { rij[k] = patch[k]; });
      return demoBewaren(s, null).then(function () { return getFactory(id); });
    }

    /* LIVE: twee tabellen, in deze volgorde. Eerst de openbare helft op
       factories_partners, daarna het interne dossier in factory_private.
       Wie het andersom doet, kan een intern dossier schrijven voor een
       fabriek die net door iemand anders is verwijderd — de foreign key
       vangt dat wel op, maar dan staat de gebruiker met een halve opslag en
       een foutmelding die over de verkeerde helft gaat. */
    var openbaar = naarRij(patch, FABRIEK_OPENBARE_VELDEN);
    var intern = naarRij(patch, FABRIEK_INTERNE_VELDEN);

    var eerst;
    if (Object.keys(openbaar).length) {
      eerst = sb().from('factories_partners').update(openbaar).eq('id', id).select().single()
        .then(function (res) {
          return schrijfRijOfWeg(res, 'De fabriek kon niet worden opgeslagen', 'Deze fabriek bestaat niet (meer).');
        });
    } else {
      /* alleen interne velden gewijzigd: de openbare tabel niet voor niets
         aanraken, maar wél eerst controleren dát de fabriek bestaat */
      eerst = sb().from('factories_partners').select('id').eq('id', id).maybeSingle()
        .then(function (res) {
          if (res && res.error) throw new Error('De fabriek kon niet worden opgeslagen: ' + (res.error.message || 'onbekende fout'));
          if (!res || !res.data) throw new Error('Deze fabriek bestaat niet (meer).');
          return res.data;
        });
    }

    return eerst.then(function () {
      if (!Object.keys(intern).length) return null;
      intern.factory_id = id;
      /* upsert en geen update: een fabriek zonder interne rij is de normale
         beginstand (zie blok A3 van 0020), dus de eerste notitie MAAKT de
         rij. factory_id is de primaire sleutel, dus hoogstens één rij per
         fabriek — precies wat we willen. */
      return sb().from('factory_private').upsert(intern, { onConflict: 'factory_id' }).select().single()
        .then(function (res) { return schrijfRij(res, 'Het interne fabrieksdossier kon niet worden opgeslagen'); });
    }).then(function () { return getFactory(id); });
  }

  /* Bestond vandaag NIET in de app: een fabriek kon alleen via de database
     ontstaan. IDEMPOTENT OP DE NAAM — twee keer op "Nieuwe fabriek" drukken
     met dezelfde naam levert één fabriek op en geeft de bestaande terug.
     Dat is de enige idempotentie die hier eerlijk kan: een naam is wat de
     eigenaar herkent, een id niet. */
  function createFactory(velden) {
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    var v = isObj(velden) ? velden : {};
    var naam = trim(v.name);
    if (!naam) return Promise.reject(new Error('Een fabriek heeft in elk geval een naam nodig.'));

    var basis = normFabriek(v);
    basis.name = naam;
    if (v.status === undefined) basis.status = 'actief';

    if (isDemo()) {
      /* DEMOMODUS: één plat record, dus één push. Zie afspraak 5 bovenaan. */
      var s = demoState();
      var lijst = demoLijst(s, 'factories');
      var bestaand = lijst.filter(function (x) {
        return x && trim(x.name).toLowerCase() === naam.toLowerCase();
      })[0];
      if (bestaand) return getFactory(bestaand.id);
      var nieuw = { id: uniekId('fac'), createdAt: new Date().toISOString() };
      FABRIEK_VELDEN.forEach(function (k) { nieuw[k] = basis[k]; });
      lijst.push(nieuw);
      return demoBewaren(s, null).then(function () { return getFactory(nieuw.id); });
    }

    return sb().from('factories_partners').select('id, name').then(rijenTolerant, leeg)
      .then(function (rijen) {
        var bestaand = rijen.filter(function (x) {
          return x && trim(x.name).toLowerCase() === naam.toLowerCase();
        })[0];
        if (bestaand) return getFactory(bestaand.id);

        /* LIVE: de openbare rij EERST, en de fabriek bestaat pas als die is
           geslaagd. Pas daarna het interne dossier, dat de zojuist gekregen
           id als sleutel gebruikt. Andersom kan niet: factory_private.
           factory_id verwijst naar factories_partners(id), dus er is geen
           id om een dossier aan te hangen zolang de fabriek er niet is.
           Mislukt de tweede stap, dan bestaat de fabriek dus wél en is
           alleen het dossier leeg — een stand die de eigenaar op het scherm
           ziet en zelf kan aanvullen. Dat is de goede kant om op te falen. */
        var openbaar = naarRij(basis, FABRIEK_OPENBARE_VELDEN);
        return sb().from('factories_partners').insert(openbaar).select().single()
          .then(function (res) { return schrijfRij(res, 'De fabriek kon niet worden aangemaakt'); })
          .then(function (r) {
            if (!r || !r.id) return null;
            var intern = naarRij(basis, FABRIEK_INTERNE_VELDEN);
            /* een dossier waarin niets staat is ruis: geen rij aanmaken. De
               where-voorwaarde van de datamigratie in blok A4 van 0020 doet
               hetzelfde. */
            if (!heeftInterneInhoud(intern)) return getFactory(r.id);
            intern.factory_id = r.id;
            return sb().from('factory_private').insert(intern).select().single()
              .then(function (res2) { return schrijfRij(res2, 'Het interne fabrieksdossier kon niet worden opgeslagen'); })
              .then(function () { return getFactory(r.id); });
          });
      });
  }

  /* Staat er in deze snake_case-rij iets anders dan leeg? Alleen dan is er
     een intern dossier om te bewaren. null en '' tellen allebei als leeg;
     een score van 0 kan niet voorkomen (normScore laat alleen 1 t/m 5 of
     null door), dus een simpele leegtecontrole volstaat en er sluipt hier
     geen Number()-nul binnen. */
  function heeftInterneInhoud(rij) {
    var gevuld = false;
    Object.keys(isObj(rij) ? rij : {}).forEach(function (k) {
      var w = rij[k];
      if (w === null || w === undefined) return;
      if (typeof w === 'string' && trim(w) === '') return;
      gevuld = true;
    });
    return gevuld;
  }

  /* GEEN harde verwijdering. Een fabriek draagt de geschiedenis van elke
     NNN-vastlegging en elke foto; die weggooien zou het dossier van een
     project onvolledig maken. Archiveren is idempotent: twee keer
     archiveren verandert niets. */
  function archiveFactory(id) {
    return saveFactory(id, { status: 'gearchiveerd' });
  }

  function setFactoryScores(id, kwaliteit, doorlooptijd) {
    var patch = {};
    if (kwaliteit !== undefined) patch.qualityScore = kwaliteit;
    if (doorlooptijd !== undefined) patch.leadtimeScore = doorlooptijd;
    return saveFactory(id, patch);
  }

  /* De specialisaties zijn OPENBAAR (chiprij op de kaart, ook zichtbaar in
     het klantportaal): ze gaan naar factories_partners. De twee scores zijn
     INTERN en gaan naar factory_private. Allebei lopen ze via saveFactory,
     dus geen van beide hoeft die verdeling zelf te kennen — de twee
     veldenlijsten bovenaan blok A zijn de enige plek waar hij staat. */
  function setFactorySpecialties(id, lijst) {
    return saveFactory(id, { specialties: lijstVan(lijst) });
  }

  /* ============================================================
     5. BLOKKEN B, D, E, F — losse velden op bestaande records

     Deze vier blokken zijn geen nieuwe entiteit maar nieuwe VELDEN. Ze
     staan hier omdat beheer.html niet aangeraakt mag worden en de nieuwe
     schermen ze wel moeten kunnen opslaan.
     ============================================================ */

  /* ---- blok B: welke fabriek maakt dit project ----
     Het echte veld wint; is het leeg, dan telt de meest voorkomende
     fabrieks-id op de foto's en de NNN-vastleggingen van dit project. Puur,
     zodat een lijstweergave hem per rij kan aanroepen zonder netwerk. */
  function factoryIdOf(project, media, disclosures) {
    if (!isObj(project)) return null;
    if (project.factoryId) return project.factoryId;
    var stemmen = {};
    function stem(rij) {
      if (!rij || rij.projectId !== project.id || !rij.factoryId) return;
      stemmen[rij.factoryId] = (stemmen[rij.factoryId] || 0) + 1;
    }
    lijstVan(media).forEach(function (m) { stem(m); });
    lijstVan(disclosures).forEach(function (d) { stem(d); });
    /* dezelfde stemming en dezelfde gelijkspelregel als verrijkFabrieken();
       twee keer anders tellen zou betekenen dat de lijst en het detail een
       andere fabriek bij hetzelfde project noemen */
    return meesteStemmen(stemmen);
  }

  /* ---- DE VOLLEDIGE RIJ, IN BEIDE MODI DEZELFDE ----
     LEES DIT VOORDAT JE EEN SCHRIJFMETHODE TERUG LAAT GEVEN WAT ER IS
     MEEGESTUURD. Drie methodes hieronder gaven in demomodus alleen de
     GEWIJZIGDE velden terug (kopie(patch)) en in live modus de HELE rij die
     Postgres met .select().single() teruggeeft. Een scherm dat na het
     opslaan res.name of res.status leest, werkte daardoor live en kreeg in
     demo undefined — het soort verschil dat pas opvalt als de eigenaar het
     op zijn eigen scherm ziet, want de demomodus is de modus waarin hij
     alles uitprobeert.
     De regel is nu overal dezelfde, en het is de regel die saveFactory al
     volgde: elke schrijfmethode eindigt op een GET van de volledige rij.
     Dat kost in demomodus niets (het staat al in het geheugen) en in live
     modus één extra select, en het maakt de belofte waar dat een aanroeper
     de twee modi niet uit elkaar kan houden.
     Dat geldt ook voor de kortsluiting "er valt niets te wijzigen": ook dan
     komt de volledige rij terug en niet null, want anders is de uitkomst
     van saveX(id, {}) een andere vorm dan die van saveX(id, {iets}). */
  function haalRij(demoSleutel, tabel, id) {
    if (!id) return Promise.resolve(null);
    if (isDemo()) {
      var s = demoState();
      var r = demoLijst(s, demoSleutel).filter(function (x) { return x && x.id === id; })[0];
      /* een kopie: de aanroeper mag het antwoord bewerken zonder dat hij
         daarmee ongemerkt de demo-opslag verandert. Live krijgt hij ook een
         los object, dus dit is pariteit en geen voorzichtigheid. */
      return Promise.resolve(r ? kopie(r) : null);
    }
    if (!sb()) return Promise.resolve(null);
    return sb().from(tabel).select('*').eq('id', id).maybeSingle()
      .then(function (res) { return (res && !res.error && res.data) ? camelRij(res.data) : null; }, nul);
  }

  function getProject(id) { return haalRij('projects', 'projects', id); }
  function getClient(id) { return haalRij('clients', 'clients', id); }
  function getRequest(id) { return haalRij('aanvragen', 'admin_requests', id); }

  var PROJECT_VELDEN = ['factoryId', 'deadline', 'category', 'lead'];

  /* velden: {factoryId, deadline, category, lead}. deadline is de MET DE
     HAND ingevulde belofte aan de klant en staat los van de zes afgeleide
     datumprojecties — die blijven bestaan. Leeg blijft leeg: een verzonnen
     deadline is erger dan geen deadline.
     Geeft de VOLLEDIGE projectrij terug, in beide modi — zie het blok
     hierboven. */
  function saveProjectFields(projectId, velden) {
    if (!projectId) return Promise.reject(new Error('Er is geen project gekozen om op te slaan.'));
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    var v = isObj(velden) ? velden : {};
    var patch = {};
    if (v.factoryId !== undefined) patch.factoryId = v.factoryId || null;
    if (v.deadline !== undefined) patch.deadline = v.deadline ? dayISO(v.deadline) : null;
    if (v.category !== undefined) patch.category = tekst(v.category);
    if (v.lead !== undefined) patch.lead = tekst(v.lead);
    if (!Object.keys(patch).length) return getProject(projectId);

    if (isDemo()) {
      var s = demoState();
      var p = demoLijst(s, 'projects').filter(function (x) { return x && x.id === projectId; })[0];
      if (!p) return Promise.reject(new Error('Dit project bestaat niet (meer).'));
      Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
      return demoBewaren(s, null).then(function () { return getProject(projectId); });
    }
    return sb().from('projects').update(naarRij(patch, PROJECT_VELDEN)).eq('id', projectId).select().single()
      .then(function (res) {
        return schrijfRijOfWeg(res, 'Het project kon niet worden opgeslagen', 'Dit project bestaat niet (meer).');
      })
      .then(function () { return getProject(projectId); });
  }

  function setProjectFactory(projectId, factoryId) {
    return saveProjectFields(projectId, { factoryId: factoryId || null });
  }

  /* ---- blok E: klantvelden ---- */
  var KLANT_VELDEN = ['country', 'tagline', 'logoUrl'];

  function saveClientProfile(clientId, velden) {
    if (!clientId) return Promise.reject(new Error('Er is geen klant gekozen om op te slaan.'));
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    var v = isObj(velden) ? velden : {};
    var patch = {};
    KLANT_VELDEN.forEach(function (k) { if (v[k] !== undefined) patch[k] = tekst(v[k]); });
    if (!Object.keys(patch).length) return getClient(clientId);

    if (isDemo()) {
      var s = demoState();
      var c = demoLijst(s, 'clients').filter(function (x) { return x && x.id === clientId; })[0];
      if (!c) return Promise.reject(new Error('Deze klant bestaat niet (meer).'));
      Object.keys(patch).forEach(function (k) { c[k] = patch[k]; });
      return demoBewaren(s, null).then(function () { return getClient(clientId); });
    }
    return sb().from('clients').update(naarRij(patch, KLANT_VELDEN)).eq('id', clientId).select().single()
      .then(function (res) {
        return schrijfRijOfWeg(res, 'De klant kon niet worden opgeslagen', 'Deze klant bestaat niet (meer).');
      })
      .then(function () { return getClient(clientId); });
  }

  /* ---- blok F: aanvraagvelden ----
     `files` is een lijst van {name, path, size, type}. Er gaan NOOIT bytes
     in dit veld: path wijst naar de private bucket (of naar IndexedDB in
     demomodus). */
  var AANVRAAG_VELDEN = ['country', 'source', 'files'];

  function normBestanden(v) {
    return lijstVan(v).map(function (b) {
      var o = isObj(b) ? b : {};
      return {
        name: tekst(o.name),
        path: tekst(o.path || o.fileRef),
        size: heelGetal(o.size),
        type: tekst(o.type)
      };
    }).filter(function (b) { return !!(b.name || b.path); });
  }

  function saveRequestFields(requestId, velden) {
    if (!requestId) return Promise.reject(new Error('Er is geen aanvraag gekozen om op te slaan.'));
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    var v = isObj(velden) ? velden : {};
    var patch = {};
    if (v.country !== undefined) patch.country = tekst(v.country);
    if (v.source !== undefined) patch.source = tekst(v.source);
    if (v.files !== undefined) patch.files = normBestanden(v.files);
    if (!Object.keys(patch).length) return getRequest(requestId);

    if (isDemo()) {
      var s = demoState();
      var r = demoLijst(s, 'aanvragen').filter(function (x) { return x && x.id === requestId; })[0];
      if (!r) return Promise.reject(new Error('Deze aanvraag bestaat niet (meer).'));
      Object.keys(patch).forEach(function (k) { r[k] = patch[k]; });
      return demoBewaren(s, null).then(function () { return getRequest(requestId); });
    }
    return sb().from('admin_requests').update(naarRij(patch, AANVRAAG_VELDEN)).eq('id', requestId).select().single()
      .then(function (res) {
        return schrijfRijOfWeg(res, 'De aanvraag kon niet worden opgeslagen', 'Deze aanvraag bestaat niet (meer).');
      })
      .then(function () { return getRequest(requestId); });
  }

  /* ============================================================
     6. BLOK G — GESPREKSDRAAD

     Een klantvraag was ÉÉN vraag met ÉÉN antwoord. question_messages maakt
     er een draad van. question_threads blijft ongewijzigd bestaan: er wordt
     niets weggegooid. threadOf() hieronder is de terugval die maakt dat oude
     gesprekken er óók goed uitzien.
     ============================================================ */

  var BERICHT_AUTEURS = ['staff', 'client'];

  function normBericht(r) {
    var m = isObj(r) ? r : {};
    var auteur = tekst(m.author);
    if (BERICHT_AUTEURS.indexOf(auteur) < 0) auteur = 'staff';
    return {
      id: m.id || null,
      questionId: m.questionId || null,
      author: auteur,
      authorName: tekst(m.authorName),
      body: tekst(m.body),
      createdAt: m.createdAt || null,
      /* virtueel = dit bericht staat NIET in question_messages maar is
         opgebouwd uit de oude question/answer-kolommen. De UI mag hem tonen
         als een gewoon bericht; wie hem wil bewerken moet weten dat er geen
         rij achter zit. */
      virtueel: !!m.virtueel
    };
  }

  function listMessages(questionId) {
    if (!questionId) return Promise.resolve([]);
    if (isDemo()) {
      var s = demoState();
      var rijen = demoLijst(s, 'questionMessages').filter(function (m) {
        return m && m.questionId === questionId;
      }).map(normBericht);
      return Promise.resolve(sorteerBerichten(rijen));
    }
    if (!sb()) return Promise.resolve([]);
    return sb().from('question_messages').select('*').eq('question_id', questionId)
      .order('created_at', { ascending: true })
      .then(rijenTolerant, leeg)
      .then(function (rijen) { return sorteerBerichten(rijen.map(normBericht)); });
  }

  /* Op het MOMENT sorteren en niet op de tekst van het tijdstempel. Twee
     redenen, en allebei zijn het demo/live-verschillen: de browser schrijft
     '…T09:30:00.000Z' (toISOString) en Postgres geeft '…T09:30:00+00:00'
     terug, en zodra er ooit een rij met een andere zone in zit ('+02:00')
     zet een vergelijking op codepunten hem op de verkeerde plek in het
     gesprek. Een bericht zonder tijdstempel gaat naar achteren en houdt
     verder zijn onderlinge volgorde (stabiel). */
  function sorteerBerichten(rijen) {
    return stabielSorteren(rijen, function (a, b) {
      var ta = tijdstipMs(a && a.createdAt), tb = tijdstipMs(b && b.createdAt);
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return 0;
    });
  }

  /* bericht: {author:'staff'|'client', authorName, body, createdAt}
     Een leeg bericht is geen beurt in een gesprek en wordt geweigerd —
     dezelfde regel als de datamigratie in 0020_beheer_ia.sql. */
  function addMessage(questionId, bericht) {
    if (!questionId) return Promise.reject(new Error('Er is geen vraag gekozen om op te antwoorden.'));
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    var b = isObj(bericht) ? bericht : {};
    var auteur = trim(b.author);
    if (BERICHT_AUTEURS.indexOf(auteur) < 0) {
      return Promise.reject(new Error('Een bericht is van "staff" of van "client"; een andere afzender bestaat niet.'));
    }
    var tekstBody = trim(b.body);
    if (!tekstBody) return Promise.reject(new Error('Een leeg bericht is geen beurt in een gesprek.'));
    var moment = b.createdAt || new Date().toISOString();

    if (isDemo()) {
      var s = demoState();
      var rij = {
        id: uniekId('qmsg'),
        questionId: questionId,
        author: auteur,
        authorName: tekst(b.authorName),
        body: tekstBody,
        createdAt: moment
      };
      demoLijst(s, 'questionMessages').push(rij);
      return demoBewaren(s, normBericht(rij));
    }
    return sb().from('question_messages').insert({
      question_id: questionId,
      author: auteur,
      author_name: tekst(b.authorName),
      body: tekstBody,
      created_at: moment
    }).select().single()
      .then(function (res) { return schrijfRij(res, 'Het bericht kon niet worden bewaard'); })
      .then(function (r) { return normBericht(r); });
  }

  /* DE TERUGVAL DIE OUDE DATA GOED LAAT STAAN.
     Zijn er echte berichten, dan zijn dat de draad. Zijn die er niet, dan
     bouwen we hem uit de bestaande kolommen van question_threads: de vraag
     als eerste bericht (van de klant, op asked_at) en het antwoord als
     tweede (van het beheer, op answered_at — en bij ontbreken daarvan op
     asked_at, zodat de volgorde klopt). Exact dezelfde regels als de
     datamigratie in 0020_beheer_ia.sql, zodat de weergave vóór en na het
     draaien van die migratie identiek is.

     opts: {klantNaam, beheerNaam} — namen voor boven de berichten. Ontbreken
     ze, dan blijft de naam leeg en toont de UI initialen of alleen de rol.
     PUUR: geen netwerk, geen klok. */
  function threadOf(question, berichten, opts) {
    var q = isObj(question) ? question : {};
    var o = isObj(opts) ? opts : {};
    var echt = lijstVan(berichten).filter(function (m) {
      return m && (!q.id || !m.questionId || m.questionId === q.id);
    }).map(normBericht);
    if (echt.length) return sorteerBerichten(echt);

    var uit = [];
    var vraag = trim(q.question);
    if (vraag) {
      uit.push(normBericht({
        id: q.id ? q.id + ':vraag' : null,
        questionId: q.id || null,
        author: 'client',
        authorName: tekst(o.klantNaam),
        body: vraag,
        createdAt: q.askedAt || null,
        virtueel: true
      }));
    }
    var antwoord = trim(q.answer);
    if (antwoord) {
      uit.push(normBericht({
        id: q.id ? q.id + ':antwoord' : null,
        questionId: q.id || null,
        author: 'staff',
        authorName: tekst(o.beheerNaam),
        body: antwoord,
        createdAt: q.answeredAt || q.askedAt || null,
        virtueel: true
      }));
    }
    return uit;
  }

  /* ============================================================
     7. BLOK H — TEAM EN RECHTEN
     ============================================================ */

  var TEAM_VELDEN = ['name', 'email', 'role', 'status', 'avatarUrl', 'invitedAt', 'lastSeenAt'];

  function normTeamlid(r) {
    var t = isObj(r) ? r : {};
    var rol = tekst(t.role);
    if (ROL_KEYS.indexOf(rol) < 0) rol = 'medewerker';
    var status = tekst(t.status);
    if (TEAM_STATUS_KEYS.indexOf(status) < 0) status = 'actief';
    var naam = tekst(t.name);
    var mail = tekst(t.email);
    return {
      id: t.id || null,
      name: naam,
      email: mail,
      /* de UI toont het e-mailadres wanneer er geen naam is — dat staat zo
         in het kolomcommentaar van 0020 en hoort niet in elk scherm apart */
      weergaveNaam: naam || mail || 'Naamloos teamlid',
      role: rol,
      roleLabel: rolLabel(rol),
      status: status,
      statusLabel: statusLabelVan(TEAM_STATUS, status),
      avatarUrl: tekst(t.avatarUrl),
      invitedAt: t.invitedAt || null,
      lastSeenAt: t.lastSeenAt || null,
      createdAt: t.createdAt || null,
      initialen: initialen(naam || mail)
    };
  }

  /* Rol eerst (de volgorde van ROLLEN: eigenaar, beheerder, medewerker,
     lezer), dan de naam in het Nederlands, dan het aanmaakmoment.
     Die derde regel is geen sier maar pariteit: in live modus komt de lijst
     binnen op created_at en in demomodus in de volgorde van de state, dus
     zonder een expliciete laatste sleutel zouden twee teamleden met
     dezelfde rol en dezelfde weergavenaam in de twee modi kunnen wisselen.
     En cmpNaam en niet cmpTekst, om dezelfde reden als bij de fabrieken:
     op codepunten komt "Östberg" achter "Zhang" en dat leest niemand als
     alfabetisch. */
  function teamSorteren(rijen) {
    return stabielSorteren(rijen, function (a, b) {
      var ra = ROL_KEYS.indexOf(a.role), rb = ROL_KEYS.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return cmpNaam(a.weergaveNaam, b.weergaveNaam) || cmpTekst(a.createdAt, b.createdAt);
    });
  }

  function listTeam() {
    if (isDemo()) {
      var s = demoState();
      return Promise.resolve(teamSorteren(demoLijst(s, 'teamMembers').map(normTeamlid)));
    }
    if (!sb()) return Promise.resolve([]);
    return sb().from('team_members').select('*').order('created_at')
      .then(rijenTolerant, leeg)
      .then(function (rijen) { return teamSorteren(rijen.map(normTeamlid)); });
  }

  function getTeamlid(id) {
    return listTeam().then(function (rijen) {
      for (var i = 0; i < rijen.length; i++) { if (rijen[i].id === id) return rijen[i]; }
      return null;
    });
  }

  function saveTeamMember(id, velden) {
    if (!id) return Promise.reject(new Error('Er is geen teamlid gekozen om op te slaan.'));
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    var v = isObj(velden) ? velden : {};
    var patch = {};
    if (v.name !== undefined) patch.name = tekst(v.name);
    if (v.email !== undefined) patch.email = trim(v.email);
    if (v.avatarUrl !== undefined) patch.avatarUrl = tekst(v.avatarUrl);
    if (v.invitedAt !== undefined) patch.invitedAt = v.invitedAt || null;
    if (v.lastSeenAt !== undefined) patch.lastSeenAt = v.lastSeenAt || null;
    if (v.role !== undefined) {
      var rol = trim(v.role);
      if (ROL_KEYS.indexOf(rol) < 0) {
        return Promise.reject(new Error('Onbekende rol: ' + rol + '. Kies eigenaar, beheerder, medewerker of lezer.'));
      }
      patch.role = rol;
    }
    if (v.status !== undefined) {
      var st = trim(v.status);
      if (TEAM_STATUS_KEYS.indexOf(st) < 0) {
        return Promise.reject(new Error('Onbekende status: ' + st + '. Kies actief, uitgenodigd of inactief.'));
      }
      patch.status = st;
    }
    if (!Object.keys(patch).length) return getTeamlid(id);

    return controleerLaatsteEigenaar(id, patch).then(function () {
      if (isDemo()) {
        var s = demoState();
        var rij = demoLijst(s, 'teamMembers').filter(function (x) { return x && x.id === id; })[0];
        if (!rij) throw new Error('Dit teamlid bestaat niet (meer).');
        if (patch.email) {
          var botsing = demoLijst(s, 'teamMembers').filter(function (x) {
            return x && x.id !== id && trim(x.email).toLowerCase() === patch.email.toLowerCase();
          })[0];
          if (botsing) throw new Error('Dit e-mailadres staat al bij een ander teamlid.');
        }
        Object.keys(patch).forEach(function (k) { rij[k] = patch[k]; });
        return demoBewaren(s, null).then(function () { return getTeamlid(id); });
      }
      return sb().from('team_members').update(naarRij(patch, TEAM_VELDEN)).eq('id', id).select().single()
        .then(function (res) {
          if (res && res.error && /duplicate key|unique/i.test(res.error.message || '')) {
            throw new Error('Dit e-mailadres staat al bij een ander teamlid.');
          }
          return schrijfRijOfWeg(res, 'Het teamlid kon niet worden opgeslagen', 'Dit teamlid bestaat niet (meer).');
        })
        .then(function () { return getTeamlid(id); });
    });
  }

  /* Het laatste eigenaarschap mag niet per ongeluk verdwijnen. Dit is geen
     beveiliging (de rollen worden immers niet afgedwongen) maar het
     voorkomt een stand die niemand bedoelt: een team zonder eigenaar,
     terwijl de datamigratie van 0020 er juist één aanwijst.

     'uitgenodigd' telt hier MEE als eigenaar: iemand die net is uitgenodigd
     en nog niet heeft ingelogd is wel degelijk de eigenaar. Alleen
     'inactief' telt niet. Een rolwissel of een deactivering wordt daarom
     alleen tegengehouden als er daarna niemand overblijft. */
  function controleerLaatsteEigenaar(id, patch) {
    var raaktEigenaar = (patch.role !== undefined && patch.role !== 'eigenaar')
      || (patch.status !== undefined && patch.status === 'inactief');
    if (!raaktEigenaar) return Promise.resolve(true);
    return listTeam().then(function (rijen) {
      var dit = rijen.filter(function (r) { return r.id === id; })[0];
      if (!dit || dit.role !== 'eigenaar' || dit.status === 'inactief') return true;
      var anderen = rijen.filter(function (r) {
        return r.id !== id && r.role === 'eigenaar' && r.status !== 'inactief';
      });
      if (anderen.length) return true;
      throw new Error('Dit is het laatste teamlid met de rol eigenaar. Maak eerst iemand anders eigenaar.');
    });
  }

  /* LET OP: dit VERSTUURT GEEN E-MAIL. Het legt vast dat iemand is
     uitgenodigd (status en invited_at); het echte versturen loopt via de
     bestaande mailfunctie van beheer.html. De naam van deze methode volgt
     de bouwopdracht; het commentaar vertelt wat hij werkelijk doet, want
     een knop die "Uitnodigen" heet en alleen een rij schrijft moet dat in
     het scherm ook zeggen.

     IDEMPOTENT OP HET E-MAILADRES, hoofdletterongevoelig — precies zoals de
     unieke index team_members_email_uniq. Iemand twee keer uitnodigen maakt
     geen tweede rij maar vernieuwt het uitnodigingsmoment. */
  function inviteTeamMember(velden) {
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    var v = isObj(velden) ? velden : {};
    var mail = trim(v.email);
    var naam = tekst(v.name);
    if (!mail && !naam) {
      return Promise.reject(new Error('Een teamlid heeft in elk geval een naam of een e-mailadres nodig.'));
    }
    var rol = trim(v.role) || 'medewerker';
    if (ROL_KEYS.indexOf(rol) < 0) {
      return Promise.reject(new Error('Onbekende rol: ' + rol + '. Kies eigenaar, beheerder, medewerker of lezer.'));
    }
    var moment = v.invitedAt || new Date().toISOString();
    /* zonder e-mailadres is er niets om naartoe uit te nodigen; die rij
       staat er dan wel, maar eerlijk als 'actief' zonder uitnodiging */
    var status = trim(v.status) || (mail ? 'uitgenodigd' : 'actief');
    if (TEAM_STATUS_KEYS.indexOf(status) < 0) status = mail ? 'uitgenodigd' : 'actief';

    return listTeam().then(function (rijen) {
      var bestaand = mail ? rijen.filter(function (r) {
        return trim(r.email).toLowerCase() === mail.toLowerCase();
      })[0] : null;
      if (bestaand) {
        return saveTeamMember(bestaand.id, {
          name: naam || bestaand.name,
          role: rol,
          status: status,
          invitedAt: mail ? moment : bestaand.invitedAt
        });
      }
      if (isDemo()) {
        var s = demoState();
        var nieuw = {
          id: uniekId('tm'),
          name: naam, email: mail, role: rol, status: status,
          avatarUrl: tekst(v.avatarUrl),
          invitedAt: mail ? moment : null,
          lastSeenAt: null,
          createdAt: new Date().toISOString()
        };
        demoLijst(s, 'teamMembers').push(nieuw);
        return demoBewaren(s, null).then(function () { return getTeamlid(nieuw.id); });
      }
      return sb().from('team_members').insert({
        name: naam, email: mail, role: rol, status: status,
        avatar_url: tekst(v.avatarUrl),
        invited_at: mail ? moment : null
      }).select().single()
        .then(function (res) {
          if (res && res.error && /duplicate key|unique/i.test(res.error.message || '')) {
            throw new Error('Dit e-mailadres staat al bij een ander teamlid.');
          }
          return schrijfRij(res, 'Het teamlid kon niet worden toegevoegd');
        })
        .then(function (r) { return r ? getTeamlid(r.id) : null; });
    });
  }

  /* Geen verwijdering: de rij blijft staan zodat de geschiedenis heel
     blijft. Idempotent — twee keer deactiveren verandert niets. */
  function deactivateTeamMember(id) {
    return saveTeamMember(id, { status: 'inactief' });
  }

  /* ============================================================
     8. BLOKKEN I EN J — INSTELLINGEN

     Drie sleutels in het bestaande admin_settings (0005). In demomodus
     wonen ze in state.settings met dezelfde camelCase-namen die
     beheer.html gebruikt; live worden ze snake_case, precies zoals de rest
     ('stilte_drempel_dagen', 'factuur_reeks').
     ============================================================ */

  function leesInstelling(camelSleutel, standaard) {
    if (isDemo()) {
      var s = demoInstellingen(demoState());
      var v = s[camelSleutel];
      return Promise.resolve(v === undefined ? standaard : v);
    }
    if (!sb()) return Promise.resolve(standaard);
    return sb().from('admin_settings').select('value').eq('key', naarSnake(camelSleutel)).maybeSingle()
      .then(function (res) {
        if (!res || res.error || !res.data) return standaard;
        var v = res.data.value;
        return (v === undefined || v === null) ? standaard : v;
      }, function () { return standaard; });
  }

  function schrijfInstelling(camelSleutel, waarde) {
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    if (isDemo()) {
      var state = demoState();
      var s = demoInstellingen(state);
      s[camelSleutel] = waarde;
      return demoBewaren(state, waarde);
    }
    return sb().from('admin_settings').upsert({
      key: naarSnake(camelSleutel),
      value: waarde,
      updated_at: new Date().toISOString()
    }).then(function (res) { schrijfUit(res, 'De instelling kon niet worden opgeslagen'); return waarde; });
  }

  /* ---- blok I: dagcapaciteit ----
     Zeven gehele getallen ≥ 0. Een ontbrekende of onleesbare dag valt terug
     op de default van diezelfde dag, nooit op nul: nul zou de hele week
     overbelast laten lijken.

     HIER STOND DE FOUT DIE DIT COMMENTAAR NIET WAARMAAKTE. De controle was
     `var n = Number(o[d]); if (!isFinite(n) || n < 0) n = DEFAULT;` — maar
     Number(null) is 0 en Number('') is 0, allebei eindig en niet negatief.
     Een dag die als JSON-null of als lege tekst in admin_settings stond
     (precies wat er gebeurt als een formulierveld leeg wordt opgeslagen)
     kwam er dus uit als capaciteit NUL, en dan is elke actie op die dag
     meteen overbelasting. Het commentaar beloofde het tegenovergestelde.
     getalOfNull() maakt van "er staat niets" ook echt niets, zodat de
     terugval op de default hem wél ziet. Een expliciete 0 blijft 0: die
     heeft de eigenaar zelf ingevuld en betekent "op zondag doe ik niets". */
  function normCapaciteit(v) {
    var o = isObj(v) ? v : {};
    var uit = {};
    WEEKDAG_KEYS.forEach(function (d) {
      var n = getalOfNull(o[d]);
      if (n === null || n < 0) n = CAPACITEIT_DEFAULT[d];
      uit[d] = Math.round(n);
    });
    return uit;
  }

  function capacity() {
    return leesInstelling('capacityPerWeekday', null).then(function (v) {
      return normCapaciteit(v === null ? CAPACITEIT_DEFAULT : v);
    });
  }

  function saveCapacity(waarden) {
    var norm = normCapaciteit(waarden);
    return schrijfInstelling('capacityPerWeekday', norm).then(function () { return norm; });
  }

  /* ---- blok J: bewaartermijn van de prullenbak ----
     Stond op VIJF plekken in beheer.html hardgecodeerd op zeven dagen; die
     vijf staan bij naam in de RESTPOST bovenaan dit bestand en moeten hier
     op over zodra dat bestand vrij is. De default is exact de huidige
     waarde, zodat er door deze instelling niets van gedrag verandert tot de
     eigenaar hem zelf bijstelt.

     retentionDays() geeft ALTIJD een bruikbaar geheel getal: staat de
     sleutel er niet, is hij leeg, null of onleesbaar, dan komt de default
     terug. Number() zou van null en '' allebei een 0 maken; die valt hier
     toevallig buiten het bereik 1..3650 en werd dus alsnog de default, maar
     op het geluk van een bereikcontrole hoort dit niet te leunen —
     getalOfNull() zegt gewoon dat er geen getal staat. */
  function retentionDays() {
    return leesInstelling('retentionDays', BEWAARTERMIJN_DEFAULT).then(function (v) {
      var n = getalOfNull(v);
      if (n === null || Math.floor(n) !== n || n < 1 || n > 3650) return BEWAARTERMIJN_DEFAULT;
      return n;
    });
  }

  function saveRetentionDays(dagen) {
    var n = getalOfNull(dagen);
    if (n === null || Math.floor(n) !== n || n < 1 || n > 3650) {
      return Promise.reject(new Error('De bewaartermijn is een heel aantal dagen tussen 1 en 3650.'));
    }
    return schrijfInstelling('retentionDays', n).then(function () { return n; });
  }

  /* ---- IS DIT VERWIJDERDE ITEM NOG TERUG TE HALEN? ----
     De instelling hierboven bestond wel maar werd door niets VERBRUIKT. Dit
     is de functie die dat doet, zodat de nieuwe schermen hem meteen kunnen
     gebruiken en er niet vijf keer een eigen berekening ontstaat.

     PUUR: `verwijderdOp` is de deletedAt van de prullenbakrij, `dagen` de
     bewaartermijn en `nu` de klok — die laatste is een parameter, zoals elke
     afgeleide functie in dit bestand. canRestore() hieronder is de variant
     die de instelling zelf ophaalt.

     De rekenregel is LETTERLIJK die van beheer.html, tot op de milliseconde:
     bewaren zolang deletedAt > nu - dagen*86400000. Dat is met opzet geen
     verbetering — zolang die vijf plekken nog zelf tellen, moeten de tekst
     op het scherm en het echte opruimen hetzelfde zeggen. Een item met een
     onleesbare of ontbrekende deletedAt geldt daar als "weg" en dus ook
     hier als niet terug te halen; `onbekend` zegt erbij waaróm, zodat een
     scherm dat eerlijk kan tonen in plaats van er nul dagen van te maken. */
  function retentionStatus(verwijderdOp, dagen, nu) {
    var d = getalOfNull(dagen);
    if (d === null || d < 1) d = BEWAARTERMIJN_DEFAULT;
    d = Math.round(d);

    var nuMs = tijdstipMs(nu);
    if (nuMs === null) nuMs = Date.now();
    var opMs = tijdstipMs(verwijderdOp);

    if (opMs === null) {
      return {
        dagen: d,
        verwijderdOp: null,
        verlooptOp: null,
        verlooptDag: null,
        msOver: 0,
        dagenOver: 0,
        verlopen: true,
        terugTeHalen: false,
        onbekend: true
      };
    }

    var verlooptMs = opMs + d * 86400000;
    var over = verlooptMs - nuMs;
    return {
      dagen: d,
      verwijderdOp: new Date(opMs).toISOString(),
      verlooptOp: new Date(verlooptMs).toISOString(),
      verlooptDag: dayISO(new Date(verlooptMs)),
      msOver: over > 0 ? over : 0,
      /* naar boven afgerond: zolang er nog één minuut over is, is het "nog
         1 dag" en niet "0 dagen" — 0 zou lezen als verlopen */
      dagenOver: over > 0 ? Math.ceil(over / 86400000) : 0,
      verlopen: over <= 0,
      terugTeHalen: over > 0,
      onbekend: false
    };
  }

  /* Dezelfde uitkomst, maar met de ingestelde bewaartermijn erbij gehaald.
     Voor een lijst haal je retentionDays() één keer op en gebruik je
     retentionStatus() per rij; deze variant is voor de losse vraag. */
  function canRestore(verwijderdOp, nu) {
    return retentionDays().then(function (d) {
      return retentionStatus(verwijderdOp, d, nu);
    });
  }

  /* ---- blok J: laatste back-up ----
     Leeg tot de eigenaar er echt een maakt. GEEN versleutelingsclaim: de
     kaart "Back-up & data" toont alleen wat waar is per modus. Die zin
     staat hieronder als backupUitleg(), zodat geen enkel scherm hem zelf
     hoeft te formuleren en er dus ook geen scherm iets kan beloven wat het
     systeem niet waarmaakt. */
  function lastBackupAt() {
    return leesInstelling('lastBackupAt', null).then(function (v) {
      return v ? tekst(v) : null;
    });
  }

  function markBackup(iso) {
    var moment = iso || new Date().toISOString();
    return schrijfInstelling('lastBackupAt', moment).then(function () { return moment; });
  }

  function backupUitleg() {
    if (isDemo()) {
      return 'Demomodus: alles staat in deze browser — de gegevens in localStorage, de bestanden in IndexedDB. '
        + 'Wis je de browsergegevens, dan is het weg. Er staat niets op een server.';
    }
    return 'Live modus: alle gegevens staan in je Supabase-project, de bestanden in de private opslag daarvan. '
      + 'Wat daar precies aan bewaartermijnen en back-ups geldt, bepaal je in het Supabase-dashboard.';
  }

  /* ============================================================
     9. BLOK I — WERKDRUK

     "Operaties deze week" uit de mockup toont capaciteit, bezetting en
     overbelasting. Wij hebben geen fabriekscapaciteit en verzinnen die ook
     niet. Wat we WEL eerlijk kunnen meten is werkdruk:

       capaciteit    = wat de eigenaar per weekdag invult (blok I hierboven)
       bezetting     = het ECHTE aantal acties dat op die dag valt volgens
                       de zes bestaande datumprojecties
       overbelasting = het deel van de bezetting boven de capaciteit,
                       nooit negatief

     DE ZES BRONNEN — exact dezelfde die buildWeekBoard() in beheer.html en
     nextDateFor() in admin-model.js gebruiken:
       1 etaWindowEnd    van een nog niet geleverde zending
       2 answerDeadline  van een open klantvraag (ontvangst + 1 werkdag)
       3 invoiceDue      echte dueDate, anders aanmaak + 30 dagen
       4 snoozedUntil    uit settings.itemState
       5 remindAt        van een openstaand contactmoment
       6 scheduledAt     van een ingeplande publicatie

     De met de hand ingevulde projectdeadline (blok D) telt bewust NIET mee
     in de bezetting — dat is een belofte aan de klant, geen actie op jouw
     lijst. Hij wordt per dag apart geteld als `deadlines`, zodat de
     kalender hem met een eigen markering kan tonen.

     PUUR: alles komt uit `bron` en `weekVan`. Geen klok, geen netwerk.
     ============================================================ */

  function workload(bron, weekVan) {
    var b = isObj(bron) ? bron : {};
    var maandag = weekMondayISO(weekVan || new Date());
    var startIdx = dagIndex(maandag);
    var cap = normCapaciteit(
      isObj(b.capaciteit) ? b.capaciteit
        : (isObj(b.settings) ? b.settings.capacityPerWeekday : null)
    );

    /* de zeven dagen alvast klaarzetten, zodat een lege week ook zeven
       rijen oplevert en de grafiek niet ineens smaller wordt */
    var dagen = [];
    var perIso = {};
    for (var i = 0; i < 7; i++) {
      var iso = isoVanIndex(startIdx + i);
      var dag = {
        dag: WEEKDAG_KEYS[i],
        dagLabel: WEEKDAGEN[i].label,
        iso: iso,
        datumLabel: datumLabel(iso),
        capaciteit: cap[WEEKDAG_KEYS[i]],
        bezetting: 0,
        overbelasting: 0,
        deadlines: 0,
        items: []
      };
      dagen.push(dag);
      perIso[iso] = dag;
    }

    function boek(iso, soort, label, projectId) {
      var d = dayISO(iso);
      if (!d || !perIso[d]) return;
      perIso[d].items.push({ iso: d, soort: soort, label: label, projectId: projectId || null });
      perIso[d].bezetting += 1;
    }

    /* 1. ETA-vensters van zendingen die nog onderweg zijn */
    var geleverd = {};
    lijstVan(b.events).forEach(function (ev) {
      if (ev && ev.milestoneKey === 'geleverd') geleverd[ev.shipmentId] = true;
    });
    lijstVan(b.shipments).forEach(function (s) {
      if (!s || s.deliveredAt || geleverd[s.id]) return;
      boek(s.etaWindowEnd, 'eta', 'ETA-venster sluit', s.projectId);
    });

    /* 2. antwoordklokken van open vragen */
    lijstVan(b.questions).forEach(function (q) {
      if (!q || q.answeredAt) return;
      boek(antwoordDeadlineISO(q.askedAt), 'antwoordklok', 'antwoordklok', q.projectId);
    });

    /* 3. facturen die openstaan — concepten zijn nog niet verstuurd */
    lijstVan(b.invoices).forEach(function (inv) {
      if (!inv || inv.status !== 'open' || isConcept(inv)) return;
      boek(factuurVervalISO(inv), 'factuur', 'factuur vervalt', inv.projectId);
    });

    /* 4. items die terugkomen uit uitstel */
    var states = isObj(b.itemState) ? b.itemState
      : (isObj(b.settings) && isObj(b.settings.itemState) ? b.settings.itemState : {});
    Object.keys(states).forEach(function (sleutel) {
      var st = states[sleutel];
      if (!isObj(st) || !st.snoozedUntil) return;
      boek(st.snoozedUntil, 'uitstel', 'terug uit uitstel', null);
    });

    /* 5. follow-up-herinneringen bij een klant */
    var momenten = lijstVan(b.moments).length ? b.moments : b.contactMoments;
    lijstVan(momenten).forEach(function (mnt) {
      if (!mnt || mnt.remindDone || !mnt.remindAt) return;
      boek(mnt.remindAt, 'herinnering', 'herinnering', mnt.projectId);
    });

    /* 6. ingeplande publicaties (media én documenten) */
    lijstVan(b.media).forEach(function (m) {
      if (!m || !m.scheduledAt) return;
      boek(m.scheduledAt, 'publicatie', 'geplande publicatie', m.projectId);
    });
    lijstVan(b.documents).forEach(function (d) {
      if (!d || !d.scheduledAt) return;
      boek(d.scheduledAt, 'publicatie', 'geplande publicatie', d.projectId);
    });

    /* apart: de met de hand ingevulde deadline (blok D) */
    lijstVan(b.projects).forEach(function (p) {
      if (!p || !p.deadline || p.status === 'archived') return;
      var d = dayISO(p.deadline);
      if (d && perIso[d]) perIso[d].deadlines += 1;
    });

    dagen.forEach(function (d) {
      d.overbelasting = Math.max(0, d.bezetting - d.capaciteit);
      d.items = stabielSorteren(d.items, function (a, c) { return cmpTekst(a.soort, c.soort); });
    });
    return dagen;
  }

  /* ============================================================
     10. AFGELEIDE REEKSEN VOOR DE GRAFIEKEN

     Deze horen in de datalaag en niet in het tekenwerk: een grafiek die
     zelf rekent, rekent op de volgende pagina net iets anders. Elke functie
     is PUUR en krijgt "nu" als parameter. Boven elke functie staat de BRON
     van elk getal, zodat later na te gaan is waar een cijfer vandaan komt.
     ============================================================ */

  /* ---- PORTFOLIO GEZONDHEID ----
     BRON: computeSignals() uit beheer.html (`sig`) plus de projectlijst.

     De regel uit hoofdstuk 7 van de mockupspec, letterlijk:
       geen signaal   → op koers
       één signaal    → aandacht
       urgent signaal → afwijkend

     Wat "urgent" betekent per signaalsoort, en waar die grens vandaan komt:
       vraag   rode antwoordklok  (klokInfo().state === 'rood' — de belofte
                                   van één werkdag is verstreken)
       factuur ouderdom ≥ 30 dagen (dezelfde grens als het 30+-signaal van
                                   computeCounts())
       eta     venster gepasseerd  (computeSignals zet passed = true)
       fase / sample / stille zending: geen urgentiegrens die de gegevens
               dragen, dus die blijven 'aandacht'. Er wordt hier geen nieuwe
               drempel verzonnen.

     Gearchiveerde projecten tellen niet mee: die zijn niet ongezond, die
     zijn klaar.

     DE REEKS VOOR HET VLAKDIAGRAM
     Signalen worden voor "nu" berekend en er is geen logboek van hoe ze er
     vorige maand bij stonden. Drie van de zes bronnen dragen wél een echt
     begin- én einddatum en zijn daarmee te reconstrueren: open vragen
     (askedAt/answeredAt), open facturen (createdAt/paidAt) en verlopen
     ETA-vensters (etaWindowEnd/deliveredAt). De reeks gebruikt uitsluitend
     die drie en zegt dat ook: `reeksVolledig` is false en `reeksBron`
     noemt ze. De historische band is dus een ONDERGRENS van de aandacht —
     nooit meer dan er werkelijk was.
     Zonder opts.bron is er geen historie en bevat de reeks één punt: nu. */
  function portfolioHealth(projects, sig, nu, opts) {
    var o = isObj(opts) ? opts : {};
    var vandaag = vandaagVan(nu);
    var actief = lijstVan(projects).filter(function (p) {
      return p && p.id && p.status !== 'archived';
    });

    /* stand van nu, uit de signalen */
    var perProject = {};
    actief.forEach(function (p) { perProject[p.id] = { signalen: 0, urgent: 0 }; });

    lijstVan(sig && sig.items).forEach(function (it) {
      if (!it || !it.projectId || !perProject[it.projectId]) return;
      perProject[it.projectId].signalen += 1;
      if (isUrgentSignaal(it)) perProject[it.projectId].urgent += 1;
    });

    var opKoers = 0, aandacht = 0, afwijkend = 0;
    var stand = {};
    actief.forEach(function (p) {
      var s = perProject[p.id];
      var k = s.urgent > 0 ? 'afwijkend' : (s.signalen > 0 ? 'aandacht' : 'opKoers');
      stand[p.id] = k;
      if (k === 'afwijkend') afwijkend += 1;
      else if (k === 'aandacht') aandacht += 1;
      else opKoers += 1;
    });

    var pcts = verdeelProcenten([opKoers, aandacht, afwijkend]);
    var uit = {
      totaal: actief.length,
      opKoers: { aantal: opKoers, pct: pcts[0] },
      aandacht: { aantal: aandacht, pct: pcts[1] },
      afwijkend: { aantal: afwijkend, pct: pcts[2] },
      perProject: stand,
      reeks: [],
      reeksVolledig: false,
      reeksBron: 'open vragen, open facturen en verlopen ETA-vensters — de drie signalen met een echte begin- en einddatum'
    };

    var bron = isObj(o.bron) ? o.bron : null;
    if (!bron) {
      uit.reeks = [{
        iso: vandaag,
        label: datumLabel(vandaag),
        opKoers: opKoers, aandacht: aandacht, afwijkend: afwijkend,
        historisch: false
      }];
      return uit;
    }

    var weken = heelGetal(o.weken) > 0 ? heelGetal(o.weken) : 8;
    uit.reeks = historischePortfolio(actief, bron, vandaag, weken);
    return uit;
  }

  function isUrgentSignaal(it) {
    if (!it) return false;
    if (it.type === 'vraag') return !!(it.q && it.q._klok && it.q._klok.state === 'rood');
    if (it.type === 'factuur') return heelGetal(it.age) >= 30;
    if (it.type === 'eta') return !!it.passed;
    return false;
  }

  function historischePortfolio(projecten, bron, vandaag, weken) {
    var vragen = lijstVan(bron.questions);
    var facturen = lijstVan(bron.invoices);
    var zendingen = lijstVan(bron.shipments);
    var gebeurtenissen = lijstVan(bron.events);

    var geleverdOp = {};
    gebeurtenissen.forEach(function (ev) {
      if (!ev || ev.milestoneKey !== 'geleverd') return;
      var d = dayISO(ev.occurredAt || ev.createdAt);
      if (!d) return;
      if (!geleverdOp[ev.shipmentId] || d < geleverdOp[ev.shipmentId]) geleverdOp[ev.shipmentId] = d;
    });

    var maandagNu = weekMondayISO(vandaag);
    var idxNu = dagIndex(maandagNu);
    var reeks = [];

    for (var w = weken - 1; w >= 0; w--) {
      var start = isoVanIndex(idxNu - w * 7);
      var eind = isoVanIndex(idxNu - w * 7 + 6);
      /* de laatste week loopt niet verder dan vandaag: een week die nog
         moet komen kan geen gemeten stand hebben */
      if (eind > vandaag) eind = vandaag;

      var perProject = {};
      projecten.forEach(function (p) {
        var gestart = dayISO(p.createdAt);
        if (gestart && gestart > eind) return;      /* bestond toen nog niet */
        var gearchiveerd = dayISO(p.archivedAt);
        if (gearchiveerd && gearchiveerd <= eind) return;
        perProject[p.id] = { signalen: 0, urgent: 0 };
      });

      vragen.forEach(function (q) {
        if (!q || !perProject[q.projectId]) return;
        var gevraagd = dayISO(q.askedAt);
        if (!gevraagd || gevraagd > eind) return;
        var beantwoord = dayISO(q.answeredAt);
        if (beantwoord && beantwoord <= eind) return;
        perProject[q.projectId].signalen += 1;
        var klok = antwoordDeadlineISO(q.askedAt);
        if (klok && klok < eind) perProject[q.projectId].urgent += 1;
      });

      facturen.forEach(function (inv) {
        if (!inv || !perProject[inv.projectId] || isConcept(inv)) return;
        var aangemaakt = dayISO(inv.createdAt);
        if (!aangemaakt || aangemaakt > eind) return;
        var betaald = dayISO(inv.paidAt);
        if (betaald && betaald <= eind) return;
        if (!betaald && inv.status !== 'open') return;   /* geannuleerd of anderszins geen openstaand geld */
        perProject[inv.projectId].signalen += 1;
        var oud = dagenTussen(aangemaakt, eind);
        if (oud !== null && oud >= 30) perProject[inv.projectId].urgent += 1;
      });

      zendingen.forEach(function (s) {
        if (!s || !perProject[s.projectId]) return;
        var venster = dayISO(s.etaWindowEnd);
        if (!venster || venster > eind) return;
        var af = dayISO(s.deliveredAt) || geleverdOp[s.id] || null;
        if (af && af <= eind) return;
        perProject[s.projectId].signalen += 1;
        perProject[s.projectId].urgent += 1;   /* een gepasseerd venster zonder levering is per definitie urgent */
      });

      var opKoers = 0, aandacht = 0, afwijkend = 0;
      Object.keys(perProject).forEach(function (pid) {
        var s = perProject[pid];
        if (s.urgent > 0) afwijkend += 1;
        else if (s.signalen > 0) aandacht += 1;
        else opKoers += 1;
      });

      reeks.push({
        iso: start,
        label: datumLabel(start),
        opKoers: opKoers, aandacht: aandacht, afwijkend: afwijkend,
        historisch: true
      });
    }
    return reeks;
  }

  /* ---- CASHFLOW ----
     BRON: de facturen. GEFACTUREERD wordt geboekt op de maand van
     createdAt, BETAALD op de maand van paidAt. Beide in CENTEN, altijd
     gehele getallen — er wordt in dit bestand nergens met kommagetallen
     gerekend (zie portal/invoice-core.js voor waarom).

     Conceptfacturen tellen NIET mee bij gefactureerd: die zijn nog niet de
     deur uit. Het aantal concepten komt apart terug, zodat een scherm kan
     laten zien dat er nog iets klaarstaat zonder het als omzet te tonen.

     Een betaling zonder paidAt wordt overgeslagen: zonder datum is er geen
     maand om hem in te boeken, en gokken zou de grafiek laten liegen. Dat
     aantal komt terug als `betaaldZonderDatum`. */
  function cashflow(invoices, maanden, nu) {
    var aantalMaanden = heelGetal(maanden) > 0 ? heelGetal(maanden) : 6;
    var vandaag = vandaagVan(nu);
    var p = datumDelen(vandaag);
    var reeks = [], perMaand = {}, i;

    for (i = aantalMaanden - 1; i >= 0; i--) {
      var d = new Date(Date.UTC(p.y, p.m - 1 - i, 1));
      var sleutel = pad4(d.getUTCFullYear()) + '-' + pad2(d.getUTCMonth() + 1);
      var punt = {
        maand: sleutel,
        label: maandLabel(sleutel),
        gefactureerdCents: 0,
        betaaldCents: 0,
        gefactureerdAantal: 0,
        betaaldAantal: 0
      };
      reeks.push(punt);
      perMaand[sleutel] = punt;
    }

    var concepten = 0, betaaldZonderDatum = 0;
    lijstVan(invoices).forEach(function (inv) {
      if (!inv) return;
      var bedrag = factuurBedragCents(inv);
      if (isConcept(inv)) {
        concepten += 1;
      } else {
        var mAan = maandVan(inv.createdAt);
        if (mAan && perMaand[mAan]) {
          perMaand[mAan].gefactureerdCents += bedrag;
          perMaand[mAan].gefactureerdAantal += 1;
        }
      }
      var betaald = factuurBetaaldCents(inv);
      if (betaald <= 0) return;
      var mBet = maandVan(inv.paidAt);
      if (!mBet) { betaaldZonderDatum += 1; return; }
      if (!perMaand[mBet]) return;
      perMaand[mBet].betaaldCents += betaald;
      perMaand[mBet].betaaldAantal += 1;
    });

    var totGef = 0, totBet = 0;
    reeks.forEach(function (r) { totGef += r.gefactureerdCents; totBet += r.betaaldCents; });

    return {
      reeks: reeks,
      totaalGefactureerdCents: totGef,
      totaalBetaaldCents: totBet,
      concepten: concepten,
      betaaldZonderDatum: betaaldZonderDatum
    };
  }

  /* Het bedrag van een factuur in centen. De factuurmodule vult
     totalInclCents; oudere rijen hebben alleen amountCents. Altijd een
     geheel getal, nooit een kommagetal.

     DE VOLGORDE IS EEN TERUGVAL EN GEEN VOORKEUR, en daarom telt hier wat
     "aanwezig" betekent. De controle was `!== undefined && !== null`, en
     die laat een LEGE TEKST door: een rij met totalInclCents: '' leverde
     via Number('') een factuur van € 0,00 op, terwijl het echte bedrag
     gewoon in amountCents stond. Een factuur die stil op nul valt, valt uit
     elke cashflowgrafiek weg zonder dat er iets te zien is. getalOfNull()
     zegt "hier staat geen getal" en laat de terugval zijn werk doen. */
  function factuurBedragCents(inv) {
    if (!inv) return 0;
    var n = getalOfNull(inv.totalInclCents);
    if (n === null) n = getalOfNull(inv.totalCents);
    if (n === null) n = getalOfNull(inv.amountCents);
    return n === null ? 0 : Math.round(n);
  }

  /* Wat er van een factuur betaald is. paidCents is het echte veld van de
     factuurmodule; ontbreekt dat, dan geldt status 'paid' als volledig
     betaald — dat is hoe de oude facturen in de demoseed eruitzien.
     Zelfde val als hierboven: een lege paidCents mag niet als "nul betaald"
     tellen, want dan zou een betaalde oude factuur onbetaald lijken. */
  function factuurBetaaldCents(inv) {
    if (!inv) return 0;
    var n = getalOfNull(inv.paidCents);
    if (n !== null) return Math.round(n);
    if (inv.status === 'paid') return factuurBedragCents(inv);
    return 0;
  }

  /* ---- FACTUUR RITME (de donut) ----
     BRON: dezelfde facturen, over de laatste N maanden gerekend naar
     createdAt. Drie emmers:
       betaald    status 'paid' (of volledig betaald volgens paidCents)
       te laat    openstaand en de vervaldatum is verstreken
       openstaand openstaand en nog niet vervallen
     Conceptfacturen staan in geen van de drie: ze zijn niet verstuurd. Hun
     aantal komt apart terug, zodat de legenda eerlijk kan zeggen dat er
     nog iets klaarstaat.
     De vervaldatum is het echte dueDate als dat er is, anders aanmaak + 30
     dagen — dezelfde projectie als overal elders in dit project. */
  function invoiceRhythm(invoices, maanden, nu) {
    var aantalMaanden = heelGetal(maanden) > 0 ? heelGetal(maanden) : 6;
    var vandaag = vandaagVan(nu);
    var p = datumDelen(vandaag);
    var grens = new Date(Date.UTC(p.y, p.m - 1 - (aantalMaanden - 1), 1));
    var vanaf = pad4(grens.getUTCFullYear()) + '-' + pad2(grens.getUTCMonth() + 1) + '-01';

    var emmers = {
      betaald: { key: 'betaald', label: 'Betaald', aantal: 0, cents: 0 },
      openstaand: { key: 'openstaand', label: 'Openstaand', aantal: 0, cents: 0 },
      teLaat: { key: 'teLaat', label: 'Te laat', aantal: 0, cents: 0 }
    };
    var concepten = 0;

    lijstVan(invoices).forEach(function (inv) {
      if (!inv) return;
      var aangemaakt = dayISO(inv.createdAt);
      if (!aangemaakt || aangemaakt < vanaf) return;
      if (isConcept(inv)) { concepten += 1; return; }
      var bedrag = factuurBedragCents(inv);
      var betaald = factuurBetaaldCents(inv);
      if (inv.status === 'paid' || (bedrag > 0 && betaald >= bedrag)) {
        emmers.betaald.aantal += 1;
        emmers.betaald.cents += bedrag;
        return;
      }
      if (inv.status !== 'open') return;   /* geannuleerd of een andere stand: geen ritme */
      var verval = factuurVervalISO(inv);
      var open = Math.max(0, bedrag - betaald);
      if (verval && verval < vandaag) {
        emmers.teLaat.aantal += 1;
        emmers.teLaat.cents += open;
      } else {
        emmers.openstaand.aantal += 1;
        emmers.openstaand.cents += open;
      }
    });

    var volgorde = [emmers.betaald, emmers.openstaand, emmers.teLaat];
    var pcts = verdeelProcenten(volgorde.map(function (e) { return e.aantal; }));
    volgorde.forEach(function (e, i) { e.pct = pcts[i]; });

    return {
      segmenten: volgorde,
      betaald: emmers.betaald,
      openstaand: emmers.openstaand,
      teLaat: emmers.teLaat,
      totaalAantal: volgorde.reduce(function (s, e) { return s + e.aantal; }, 0),
      totaalCents: volgorde.reduce(function (s, e) { return s + e.cents; }, 0),
      concepten: concepten
    };
  }

  /* ---- ACTIVITEITSVERDELING (de donut) ----
     BRON: de uitkomst van mergeActivity() uit portal/admin-model.js — de
     enige samenvoeging van activiteit in dit project. Elke rij draagt een
     `kind`. De labels komen uit CP_MODEL.ACTIVITY_KINDS zodat de donut en
     de filterbalk onmogelijk andere woorden kunnen gebruiken; ontbreekt
     CP_MODEL (bijvoorbeeld in een test), dan geldt de kopie hieronder.
     Een onbekend soort krijgt zijn eigen rij met de ruwe sleutel als label:
     stil weglaten zou het totaal laten kloppen terwijl er iets mist. */
  var ACTIVITEIT_SOORTEN = [
    { key: 'klant', label: 'Klant' },
    { key: 'mail', label: 'E-mail' },
    { key: 'systeem', label: 'Systeem' },
    { key: 'bestanden', label: 'Bestanden' },
    { key: 'financieel', label: 'Financieel' }
  ];

  function activiteitSoorten() {
    var model = externModel();
    var uit = [];
    var bron = (model && Array.isArray(model.ACTIVITY_KINDS)) ? model.ACTIVITY_KINDS : ACTIVITEIT_SOORTEN;
    bron.forEach(function (k) {
      if (!k || k.key === 'alles') return;   /* 'alles' is een filter, geen soort */
      uit.push({ key: k.key, label: k.label || k.key });
    });
    return uit;
  }

  function activityBreakdown(feed) {
    var soorten = activiteitSoorten();
    var tellingen = {}, volgorde = [];
    soorten.forEach(function (s) {
      tellingen[s.key] = { key: s.key, label: s.label, aantal: 0 };
      volgorde.push(tellingen[s.key]);
    });

    lijstVan(feed).forEach(function (rij) {
      if (!rij) return;
      var k = tekst(rij.kind) || 'systeem';
      if (!tellingen[k]) {
        tellingen[k] = { key: k, label: k, aantal: 0 };
        volgorde.push(tellingen[k]);
      }
      tellingen[k].aantal += 1;
    });

    var pcts = verdeelProcenten(volgorde.map(function (e) { return e.aantal; }));
    volgorde.forEach(function (e, i) { e.pct = pcts[i]; });

    return {
      segmenten: volgorde,
      totaal: volgorde.reduce(function (s, e) { return s + e.aantal; }, 0)
    };
  }

  /* ---- MEEST ACTIEF ----
     BRON: dezelfde feed. mergeActivity() kent drie actoren: 'klant',
     'beheer' en 'systeem'.

     WAT HIER BEWUST NIET GEBEURT: uitsplitsen per teamlid. De feed draagt
     geen teamlid-id — elke beheerhandeling komt binnen als 'beheer'. Zodra
     de logregels een lid dragen kan dat hier zonder de rest te raken. Tot
     die tijd mag het scherm niet suggereren dat het weet wie van het team
     iets deed. opts.beheerNaam geeft de 'beheer'-rij de naam van de
     eigenaar, want met één teamlid IS dat wie het deed. */
  var ACTOR_LABELS = { klant: 'Klanten', beheer: 'Beheer', systeem: 'Systeem' };

  function mostActive(feed, opts) {
    var o = isObj(opts) ? opts : {};
    var tellingen = {}, volgorde = [];
    function bak(key) {
      if (!tellingen[key]) {
        var label = ACTOR_LABELS[key] || key;
        if (key === 'beheer' && trim(o.beheerNaam)) label = trim(o.beheerNaam);
        tellingen[key] = { key: key, label: label, aantal: 0, initialen: initialen(label) };
        volgorde.push(tellingen[key]);
      }
      return tellingen[key];
    }
    lijstVan(feed).forEach(function (rij) {
      if (!rij) return;
      bak(tekst(rij.actor) || 'systeem').aantal += 1;
    });

    var gesorteerd = stabielSorteren(volgorde, function (a, b) { return b.aantal - a.aantal; });
    var pcts = verdeelProcenten(gesorteerd.map(function (e) { return e.aantal; }));
    var max = 0;
    gesorteerd.forEach(function (e, i) {
      e.pct = pcts[i];
      if (e.aantal > max) max = e.aantal;
    });
    /* aandeelVanMax voedt de proportionele balk onder de naam: de drukste
       actor krijgt een volle balk, de rest naar verhouding */
    gesorteerd.forEach(function (e) {
      e.aandeelVanMax = max > 0 ? Math.round(e.aantal * 100 / max) : 0;
    });
    return gesorteerd;
  }

  /* ============================================================
     11. BLOK C — BESTANDEN (foto's, logo's, avatars)

     De opslag loopt via de bestaande plumbing: in demomodus IndexedDB
     (portal/demo-files.js), in live modus de private bucket beheer-intern.
     Er gaan nooit bytes in een kolom — alleen een verwijzing.

     Zonder afbeelding tonen we initialen. Dat is geen gebrek maar een
     variant, en initialen() hieronder maakt ze op één plek zodat elk scherm
     dezelfde letters toont.
     ============================================================ */

  function initialen(naam) {
    var t = trim(naam);
    if (!t) return '';
    var delen = t.split(/\s+/).filter(function (d) { return !!d; });
    if (!delen.length) return '';
    if (delen.length === 1) {
      /* een e-mailadres of één woord: de eerste twee letters lezen prettiger
         dan één losse letter in een cirkel van 72 pixels */
      var w = delen[0].replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
      return w.slice(0, 2).toUpperCase();
    }
    return (delen[0].charAt(0) + delen[delen.length - 1].charAt(0)).toUpperCase();
  }

  function bestandsExtensie(naam) {
    var m = tekst(naam).match(/\.[A-Za-z0-9]+$/);
    return m ? m[0].toLowerCase() : '';
  }

  /* soort: 'team' | 'contact' | 'fabriek' | 'fabriekContact' | 'klant'
     Geeft terug wat er ECHT is opgeslagen: {soort, id, veld, waarde}. */
  function saveAvatar(soort, id, bestand) {
    var def = AVATAR_SOORTEN[soort];
    if (!def) {
      return Promise.reject(new Error('Onbekend soort afbeelding: ' + tekst(soort)
        + '. Kies team, contact, fabriek, fabriekContact of klant.'));
    }
    if (!id) return Promise.reject(new Error('Er is niets gekozen om ' + def.wat + ' aan te hangen.'));
    if (!bestand) return Promise.reject(new Error('Er is geen bestand gekozen.'));
    var f = eisSchrijven();
    if (f) return Promise.reject(f);

    if (isDemo()) {
      var g = vensterGlobaal();
      if (!g || !g.CP_FILES) {
        return Promise.reject(new Error('De bestandsopslag van de demomodus is niet geladen (portal/demo-files.js).'));
      }
      if (bestand.size && bestand.size > DEMO_BESTAND_MAX) {
        return Promise.reject(new Error('Dit bestand is groter dan 10 MB — de demo-opslag in de browser bewaart bestanden tot 10 MB.'));
      }
      var ref = uniekId('file');
      return g.CP_FILES.putFile(ref, bestand, {
        kind: 'avatar', name: tekst(bestand.name), type: tekst(bestand.type), size: heelGetal(bestand.size)
      }).then(function () {
        var state = demoState();
        var rij = demoLijst(state, def.demo).filter(function (x) { return x && x.id === id; })[0];
        if (!rij) throw new Error('Deze rij bestaat niet (meer), dus ' + def.wat + ' is niet gekoppeld.');
        var oud = rij[def.veld];
        rij[def.veld] = ref;
        return demoBewaren(state, null).then(function () {
          /* de oude blob pas opruimen als de verwijzing echt vervangen is —
             anders staat er een lege plek waar net nog een foto stond */
          if (oud && oud !== ref && g.CP_FILES.deleteFile) g.CP_FILES.deleteFile(oud);
          return { soort: soort, id: id, veld: def.veld, waarde: ref };
        });
      });
    }

    var pad = def.map + '/' + id + (bestandsExtensie(bestand.name) || '.bin');
    return sb().storage.from(BUCKET).upload(pad, bestand, {
      contentType: bestand.type || 'application/octet-stream', upsert: true
    }).then(function (up) {
      if (up && up.error) {
        throw new Error('De afbeelding kon niet worden bewaard: ' + up.error.message
          + ' — bestaat de private bucket “' + BUCKET + '” al? Zie 0012_betalingen.sql.');
      }
      var patch = {};
      patch[def.kolom] = pad;
      if (def.viaUpsert) {
        /* factory_private: de rij hoeft nog niet te bestaan — een fabriek
           zonder intern dossier is de normale beginstand, en dan MAAKT deze
           foto hem. De sleutel is factory_id (de primaire sleutel van die
           tabel) en niet id; een update op id zou hier stil nul rijen raken
           en de foto zou na een verversing verdwenen zijn. */
        patch[def.sleutel] = id;
        return sb().from(def.tabel).upsert(patch, { onConflict: def.sleutel }).select().single();
      }
      return sb().from(def.tabel).update(patch).eq(def.sleutel, id).select().single();
    }).then(function (res) {
      schrijfUit(res, 'De verwijzing naar de afbeelding kon niet worden opgeslagen');
      return { soort: soort, id: id, veld: def.veld, waarde: pad };
    });
  }

  /* Geeft een Promise van een url, of van null. NULL BETEKENT: TOON
     INITIALEN. Het is in beide modi een Promise, want IndexedDB en
     createSignedUrl zijn allebei asynchroon — pariteit gaat hier vóór het
     gemak van een synchrone lezer.

     `veld` is optioneel; zonder veld wordt de eerste gevulde verwijzing
     genomen in de volgorde avatarUrl, logoUrl, photoUrl, contactAvatarUrl.
     Bij een fabriek (die twee afbeeldingen kan hebben) geef je dus expliciet
     'photoUrl' of 'contactAvatarUrl' mee.

     GEEF ALTIJD `veld` MEE ZODRA HET RECORD MEER DAN ÉÉN AFBEELDING KAN
     DRAGEN. De volgorde hierboven is een gemak voor records met precies één
     plaatje; hem laten kiezen bij een klant levert het BEDRIJFSLOGO op, en
     dat is prima voor de bedrijfstegel en fout boven een persoonsnaam. Voor
     dat tweede geval is er clientContactAvatar() hieronder. */
  function avatarUrl(record, veld) {
    var r = isObj(record) ? record : {};
    var waarde = '';
    if (veld) waarde = tekst(r[veld]);
    else waarde = tekst(r.avatarUrl) || tekst(r.logoUrl) || tekst(r.photoUrl) || tekst(r.contactAvatarUrl);
    waarde = trim(waarde);
    if (!waarde) return Promise.resolve(null);

    /* een echt adres of een ingebedde afbeelding reist zoals hij is */
    if (/^(https?:|data:|blob:)/i.test(waarde)) return Promise.resolve(waarde);

    if (isDemo()) {
      var g = vensterGlobaal();
      if (!g || !g.CP_FILES) return Promise.resolve(null);
      return g.CP_FILES.fileUrl(waarde).then(function (u) { return u || null; }, nul);
    }
    if (!sb()) return Promise.resolve(null);
    return sb().storage.from(BUCKET).createSignedUrl(waarde, 900)
      .then(function (res) {
        return (res && res.data && res.data.signedUrl) ? res.data.signedUrl : null;
      }, nul);
  }

  /* ---- DE CONTACTPERSOON OP DE KLANTKAART (scherm 5.5) ----
     De mockup toont daar een contactpersoon MET FOTO. Die foto bestaat
     niet, en dit is de eerlijke afhandeling daarvan.

     WAAROM ER GEEN FOTO IS. De naam die de kaart toont komt uit
     clients.contact_name — een KOLOM OP DE KLANT ZELF, niet uit een
     persoonsrecord. De tabel clients heeft sinds 0020 precies één
     afbeelding: logo_url, en dat is het logo van het BEDRIJF. Er is dus
     niets om een persoonsfoto in te bewaren, en er is ook geen kolom die
     naar een persoon verwijst.

     WAT WE HIER NIET DOEN. Het logo teruggeven als avatar van de persoon:
     dan staat het bedrijfsmerk boven de naam van een mens alsof het zijn
     portret is. Of stilletjes een admin_contacts-rij erbij zoeken op naam:
     dat is een koppeling die in het schema niet bestaat, en bij twee
     naamgenoten (of één tikfout) hangt de foto van de verkeerde persoon op
     de kaart. Beide zijn verzonnen verbanden, en dit bestand verzint niets.

     WAT WE WEL DOEN. null teruggeven, wat in dit bestand overal betekent:
     TOON INITIALEN. Die haal je uit initialen(client.contactName) en dat is
     precies de variant die de mockup zelf al toont voor mensen zonder foto
     — een volwaardige stand, geen gebrek.
     Wil je hier ECHT een foto, dan is dat geen weergavekwestie maar een
     schemakwestie: geef de klant een echte contactpersonenlijst
     (admin_contacts heeft avatar_url en role, en saveAvatar('contact', …)
     vult hem) of zet in een latere migratie een eigen kolom op clients. Tot
     die tijd draagt het record niets en zegt deze functie dat ook.
     De uitzondering die geen uitzondering is: draagt het meegegeven record
     tóch een gevulde contactAvatarUrl (omdat een latere migratie of een
     samengevoegd record hem meebrengt), dan wint die alsnog. Zo hoeft
     niemand hier terug te komen zodra dat veld er echt is. */
  function clientContactAvatar(client) {
    var c = isObj(client) ? client : {};
    if (trim(c.contactAvatarUrl)) return avatarUrl(c, 'contactAvatarUrl');
    return Promise.resolve(null);
  }

  /* ============================================================
     12. EXPORT

     Deze lijst is de publieke API. Loopt de kop van het bestand hierop
     achter, dan bouwt een scherm de ontbrekende functie na en ontstaat er
     een tweede waarheid — dus beide bij elke wijziging bijwerken.
     ============================================================ */
  return {
    VERSION: VERSION,

    init: init,
    modus: modus,
    gekoppeld: gekoppeld,

    /* rollen — lees het commentaar bij RECHTEN_AFGEDWONGEN voordat je een
       rol gebruikt om iets toe te staan */
    ROLLEN: ROLLEN,
    ROL_KEYS: ROL_KEYS,
    rolLabel: rolLabel,
    RECHTEN_AFGEDWONGEN: RECHTEN_AFGEDWONGEN,
    RECHTEN_UITLEG: RECHTEN_UITLEG,
    TEAM_STATUS: TEAM_STATUS,
    FABRIEK_STATUS: FABRIEK_STATUS,
    WEEKDAGEN: WEEKDAGEN,
    CAPACITEIT_DEFAULT: CAPACITEIT_DEFAULT,
    BEWAARTERMIJN_DEFAULT: BEWAARTERMIJN_DEFAULT,
    /* lees het commentaar bij BEWAARTERMIJN_AFGEDWONGEN voordat je een
       scherm laat suggereren dat deze instelling iets opruimt */
    BEWAARTERMIJN_AFGEDWONGEN: BEWAARTERMIJN_AFGEDWONGEN,
    BEWAARTERMIJN_UITLEG: BEWAARTERMIJN_UITLEG,
    AVATAR_SOORTEN: AVATAR_SOORTEN,

    /* welk fabrieksveld in welke tabel woont — de enige plek waar die
       verdeling staat; de schermen hoeven hem niet te kennen */
    FABRIEK_OPENBARE_VELDEN: FABRIEK_OPENBARE_VELDEN,
    FABRIEK_INTERNE_VELDEN: FABRIEK_INTERNE_VELDEN,

    /* fabrieken (blok A) — twee tabellen achter één plat object */
    listFactories: listFactories,
    getFactory: getFactory,
    saveFactory: saveFactory,
    createFactory: createFactory,
    archiveFactory: archiveFactory,
    setFactoryScores: setFactoryScores,
    setFactorySpecialties: setFactorySpecialties,

    /* koppelingen en losse velden (blokken B, D, E, F) */
    factoryIdOf: factoryIdOf,
    setProjectFactory: setProjectFactory,
    saveProjectFields: saveProjectFields,
    saveClientProfile: saveClientProfile,
    saveRequestFields: saveRequestFields,
    /* de volledige rij ophalen — dezelfde vorm die de save-methodes
       hierboven teruggeven, in beide modi */
    getProject: getProject,
    getClient: getClient,
    getRequest: getRequest,

    /* gespreksdraad (blok G) */
    listMessages: listMessages,
    addMessage: addMessage,
    threadOf: threadOf,

    /* team (blok H) */
    listTeam: listTeam,
    getTeamMember: getTeamlid,
    saveTeamMember: saveTeamMember,
    inviteTeamMember: inviteTeamMember,
    deactivateTeamMember: deactivateTeamMember,

    /* werkdruk (blok I) */
    capacity: capacity,
    saveCapacity: saveCapacity,
    workload: workload,

    /* bewaartermijn en back-up (blok J) */
    retentionDays: retentionDays,
    saveRetentionDays: saveRetentionDays,
    /* retentionStatus is puur (klok als parameter); canRestore haalt de
       ingestelde termijn er zelf bij. Voor een lijst: één keer
       retentionDays() en dan per rij retentionStatus(). */
    retentionStatus: retentionStatus,
    canRestore: canRestore,
    lastBackupAt: lastBackupAt,
    markBackup: markBackup,
    backupUitleg: backupUitleg,

    /* afgeleide reeksen — puur, "nu" is altijd een parameter */
    portfolioHealth: portfolioHealth,
    cashflow: cashflow,
    invoiceRhythm: invoiceRhythm,
    activityBreakdown: activityBreakdown,
    mostActive: mostActive,

    /* bestanden (blok C) */
    saveAvatar: saveAvatar,
    avatarUrl: avatarUrl,
    /* de contactpersoon op de klantkaart heeft geen eigen foto in het
       schema; deze geeft daarom null (= toon initialen) en legt uit waarom */
    clientContactAvatar: clientContactAvatar,
    initialen: initialen,

    /* kleine hulpjes die de nieuwe schermen delen, zodat ze ze niet elk
       apart (en net anders) nabouwen */
    weekMondayISO: weekMondayISO,
    dayISO: dayISO,
    datumLabel: datumLabel,
    maandLabel: maandLabel,
    verdeelProcenten: verdeelProcenten,
    factuurBedragCents: factuurBedragCents,
    factuurBetaaldCents: factuurBetaaldCents,
    antwoordDeadlineISO: antwoordDeadlineISO,
    factuurVervalISO: factuurVervalISO
  };
});
