/* CUSTOM+ — de KLANT-DATALAAG van het portaal (window.CP_PORTAAL_DATA).
   ------------------------------------------------------------------
   WAAROM DIT BESTAND BESTAAT
   Het klantportaal kon tot nu toe precies één ding schrijven: een vraag
   stellen. Alles wat het beheer onder "wacht op klant" zet — een fase op
   wacht op akkoord, een beoordeelde sampleronde, een gepubliceerde
   factuur, een documentslot dat "verwacht" zegt, een afgerond product dat
   opnieuw besteld kan worden — werd buiten het systeem om afgehandeld.
   Migratie supabase/portal/0021_portaal_acties.sql geeft de klant daar
   vijf serverfuncties, twee tabellen en een bucket voor. Dit bestand is
   de laag die dat actiecontract in BEIDE modi levert: demo (de gedeelde
   browseropslag onder cp_portal_demo_v1) en live (Supabase).

   HET ACTIECONTRACT — deze namen liggen vast
     akkoordGeven(stage, naam)                         RPC approve_stage
     sampleBeoordelen(ronde, beslissing, opmerking, markeringen)
                                                       RPC decide_sample
     betalingMelden(invoice, {datumISO, cents, kenmerk})  RPC report_payment
     bezwaarMaken(invoice, reden)                      RPC dispute_invoice
     berichtSturen(question, tekst)                    insert question_messages
     vraagStellen(project, tekst[, media])             insert question_threads
     bestandAanleveren(slot, bestand, opmerking)       bucket klant-upload +
                                                       insert documents
     herbestellen(project, {qty, gewenstOpISO, zelfdeSpec, wijziging})
                                                       RPC request_reorder
     contactpersoonOpslaan(contact)                    tabel client_contacts
     contactpersoonVerwijderen(contact)                tabel client_contacts
     taalKiezen(lang)                                  update clients.portal_lang
     meldingenOpslaan(voorkeuren)                      update clients.mail_prefs
     downloadAlles()                                   dossier-export, zonder
                                                       interne velden
     factuurPdf(invoice)                               het gekoppelde
                                                       factuurdocument (PDF)
   Elke schrijfactie geeft een Promise die oplost met de BIJGEWERKTE RIJ
   en verwerpt met een Error waarvan .message een Nederlandse zin is die
   door i18nT kan, en .code de korte foutcode uit 0021.

   DE LEESFUNCTIES DIE DE BUNDEL NOG NIET LEVERT
     listMessages(question)        de draad van één vraag (echte berichten,
                                   aangevuld met de oude vraag/antwoord-
                                   kolommen als die er nog niet in staan)
     listContacts()                de eigen mensen (client_contacts)
     listReorders([project])       de eigen herbestellingen
     listClientPayments(invoice)   de door de klant gemelde betalingen
     mijnContact([project])        de contactpersoon bij CUSTOM+
     mijnKlant()                   de eigen klantrij (zonder interne velden)

   DE VIER AFSPRAKEN DIE DE REST VAN HET BESTAND VERKLAREN

   1. LIVE LOOPT ELKE SCHRIJFACTIE VIA DE SERVER. Nooit een directe
      insert of update op project_stages, sample_rounds, invoices of
      invoice_payments: dat zijn de vijf RPC's uit 0021 (sb.rpc). Alleen
      client_contacts, question_messages, question_threads, het
      documentslot (documents + bucket klant-upload) en de twee
      voorkeurskolommen op clients mogen rechtstreeks, precies zoals de
      policies dat toestaan. Wat de server weigert, komt terug als
      foutcode ('fase_niet_in_wachtstand'); FOUTCODES hieronder is de ene
      tabel die daar een Nederlandse zin van maakt.

   2. DEMO DOET DEZELFDE CONTROLES, IN DEZELFDE VOLGORDE. Elke RPC toetst
      (1) wie, (2) de wachtstand, (3) de invoer, en schrijft dan (4) de
      rij, de activiteitregel (accessLog) en de auditregel (auditLog,
      kind 'klant'). De demo-tak van elke actie hieronder is letterlijk
      die vier stappen in JavaScript. Eigendom is in de demo triviaal
      (één ingelogde klant), maar de WACHTSTAND-controles weigeren exact
      wat live weigert — anders werkt een knop in de demo die live wordt
      geweigerd, en dat is precies wat een demo niet mag doen.
      Wat de live-tak al VÓÓR de RPC toetst (invoer die geen server nodig
      heeft: bedrag en datum, aanwijzingen, aantal, berichtlengte) toetst
      de demo-tak óók als eerste, vóór wie en wachtstand — anders geeft
      een fout id met foute invoer in de twee modi een andere code. En
      elke actie leest de klok precies ÉÉN keer: rij én logregel dragen
      hetzelfde tijdstip, zoals now() live de transactietijd is.

   3. PARITEIT. Elke actie eindigt in beide modi op dezelfde normalisator
      (normStage, normSample, normInvoice, …), zodat de vorm die eruit
      komt identiek is. VORMEN onderaan noemt per actie de sleutels die
      gegarandeerd aanwezig zijn; de rookproef controleert ze.

   4. EEN WAARHEID OVER DE DEMO-OPSLAG. Dit bestand raakt localStorage
      NOOIT zelf aan. init() krijgt twee haken, `lezen` en `schrijven`,
      die naar de bestaande demo-state van portal.html wijzen — hetzelfde
      patroon als CP_DATA.init in portal/admin-data.js. LET OP VOOR WIE DE
      HAAK SCHRIJFT: de save() van portal.html vandaag voegt bij het
      wegschrijven alleen `questions` en `accessLog` samen met de verse
      opslag. Deze laag muteert méér collecties (zie DEMO_COLLECTIES);
      de schrijven-haak moet die állemaal bewaren, anders is een akkoord
      na een verversing weer weg.

   WAT DEZE LAAG NIET DOET
     · geen vervolgstappen na een klantactie (volgende fase activeren,
       conceptfactuur publiceren, nieuwe sampleronde, herbestelling
       doorschuiven): dat blijft beheerwerk, ook in de demo;
     · geen mail: notify-client blijft het kanaal, aan de beheerkant;
     · geen online betalen: "betaling melden" is de eerlijke tussenstap.

   LADEN
     browser : <script src="portal/portaal-data.js"></script> ná
               portal/demo-data.js, portal/demo-files.js en (voor de
               transitietabel van facturen) portal/invoice-core.js. Het
               bestand zet zichzelf op window als CP_PORTAAL_DATA; daarna
               roept portal.html eenmalig CP_PORTAAL_DATA.init(...) aan.
     node    : require('../portal/portaal-data.js') — het zet zichzelf
               óók op module.exports, dus een test kan het importeren.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_PORTAAL_DATA = api;
  /* Node/CommonJS: geen package.json met "type":"module", dus dit bestand
     is daar CJS en dit is een echte export. Als ESM bestaat `module` niet
     en blijft alleen globalThis over — zelfde recept als admin-data.js. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.0.0';

  /* ============================================================
     0. KALE HULPJES
     Bewust eigen exemplaren: dit bestand mag nergens van afhangen,
     anders is het niet los te testen.
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

  /* het id van "een rij of een id": de schermen geven meestal het object
     uit de bundel door, een diepe link soms alleen de sleutel */
  function idVan(x) {
    if (isObj(x)) return tekst(x.id);
    return tekst(x);
  }

  /* GEHEEL GETAL, OF NULL. Geld is in dit project altijd een geheel
     getal in centen; een kommagetal wordt hier niet afgerond maar
     geweigerd, want 12,5 cent bestaat niet en 12,50 euro als "1250"
     doorgeven is de taak van het scherm. Ook voor aantallen. */
  function heelGetalOfNull(v) {
    if (v === null || v === undefined || typeof v === 'boolean') return null;
    if (typeof v !== 'number' && trim(v) === '') return null;
    var n = Number(v);
    if (!isFinite(n)) return null;
    if (Math.floor(n) !== n) return null;
    return n;
  }

  function pad2(n) { var s = String(n); return s.length < 2 ? '0' + s : s; }

  /* Een kale dag 'YYYY-MM-DD' wordt LETTERLIJK gelezen — nooit door
     new Date(), want die maakt er in sommige motoren UTC-middernacht van
     en schuift dan bij het formatteren een dag terug. Zelfde regel als
     admin-model.js en portaal-model.js. */
  var ISO_DAG_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function isKaleDag(v) {
    var m = tekst(v).match(ISO_DAG_RE);
    if (!m) return false;
    var mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return false;
    /* 31 april bestaat niet: terugrekenen via Date.UTC en vergelijken */
    var d = new Date(Date.UTC(+m[1], mo - 1, da));
    return d.getUTCMonth() === mo - 1 && d.getUTCDate() === da;
  }

  function dayISO(v) {
    if (v === null || v === undefined || v === '') return null;
    var s = tekst(v);
    if (isKaleDag(s)) return s;
    if (ISO_DAG_RE.test(s.slice(0, 10)) && isKaleDag(s.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}[T ]/.test(s)) {
      /* een tijdstempel met zone: het echte moment lezen */
      var d1 = new Date(s);
      if (isNaN(d1.getTime())) return null;
      return d1.getFullYear() + '-' + pad2(d1.getMonth() + 1) + '-' + pad2(d1.getDate());
    }
    var d2 = (typeof v === 'object' && isFunctie(v.getTime)) ? v : new Date(s);
    if (isNaN(d2.getTime())) return null;
    return d2.getFullYear() + '-' + pad2(d2.getMonth() + 1) + '-' + pad2(d2.getDate());
  }

  function vandaagISO() { return dayISO(new Date()); }

  /* dagnummer sinds 1970 via Date.UTC: puur rekenen, geen tijdzone */
  function dagIndex(iso) {
    var m = tekst(iso).match(ISO_DAG_RE);
    if (!m) return null;
    return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000);
  }
  function isoVanIndex(idx) {
    var d = new Date(idx * 86400000);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function plusDagen(iso, n) {
    var idx = dagIndex(iso);
    return idx === null ? null : isoVanIndex(idx + n);
  }

  /* Een bedrag zoals de klant het leest ("€ 1.875,00"), nooit als centen.
     De logboekregel gaat naar het beheer én naar de tijdlijn van de klant,
     dus hij leent de ene formatter van het beheer (CP_MODEL.formatCents);
     zonder die laag een eerlijke terugval in dezelfde vorm. Live schrijft
     portaal_geld_nl() in 0021 woordelijk dezelfde tekst, zodat demo en
     live dezelfde regel in het logboek zetten. */
  function geldTekst(cents, currency) {
    var m = root.CP_MODEL;
    if (m && typeof m.formatCents === 'function') return m.formatCents(cents, currency);
    var n = Math.round(Number(cents) || 0), neg = n < 0;
    if (neg) n = -n;
    var heel = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var rest = String(n % 100);
    if (rest.length < 2) rest = '0' + rest;
    var code = tekst(currency || 'EUR').toUpperCase();
    return (neg ? '-' : '') + (code === 'EUR' ? '€' : code) + ' ' + heel + ',' + rest;
  }

  /* "3 sep 2026": dezelfde korte datumvorm als de tijdlijn en de
     factuurrijen, zodat een logboekregel niet als enige "03-09-2026" zegt.
     Live schrijft portaal_datum_nl() in 0021 woordelijk hetzelfde. */
  var MAAND_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  function dagNL(iso) {
    var m = tekst(iso).match(ISO_DAG_RE);
    if (!m) return tekst(iso);
    var maand = MAAND_KORT[parseInt(m[2], 10) - 1] || m[2];
    return String(parseInt(m[3], 10)) + ' ' + maand + ' ' + m[1];
  }

  function nuISO() { return new Date().toISOString(); }

  function uniekId(voorvoegsel) {
    var r = Math.random().toString(36).slice(2, 9);
    return voorvoegsel + '-' + Date.now().toString(36) + r;
  }

  /* Een v4-uuid voor het opslagpad van een klantupload
     ({project_id}/{uuid}.{ext}, de vorm die 0001 voorschrijft). Het
     project-id is het deel dat de policy toetst; de bestandsnaam hoeft
     alleen uniek te zijn. crypto.randomUUID waar het kan; de terugval
     via getRandomValues is even willekeurig, en Math.random alleen als
     laatste redmiddel op een motor zonder crypto. */
  function uuidV4() {
    var c = root && root.crypto;
    if (c && isFunctie(c.randomUUID)) return c.randomUUID();
    var b = [], i;
    if (c && isFunctie(c.getRandomValues)) {
      var arr = new Uint8Array(16);
      c.getRandomValues(arr);
      for (i = 0; i < 16; i++) b.push(arr[i]);
    } else {
      for (i = 0; i < 16; i++) b.push(Math.floor(Math.random() * 256));
    }
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var hex = '';
    for (i = 0; i < 16; i++) {
      hex += (b[i] < 16 ? '0' : '') + b[i].toString(16);
      if (i === 3 || i === 5 || i === 7 || i === 9) hex += '-';
    }
    return hex;
  }

  function naarCamel(k) {
    return tekst(k).replace(/_([a-z0-9])/g, function (m, c) { return c.toUpperCase(); });
  }
  function camelRij(r) {
    if (!isObj(r)) return r;
    var uit = {};
    Object.keys(r).forEach(function (k) { uit[naarCamel(k)] = r[k]; });
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

  /* Op het MOMENT sorteren en niet op de tekst van het tijdstempel: de
     browser schrijft '…T09:30:00.000Z' en Postgres geeft '…T09:30:00+00:00'
     terug — dezelfde les als sorteerBerichten() in admin-data.js. */
  function tijdstipMs(v) {
    if (v === null || v === undefined || v === '') return null;
    var s = trim(v);
    if (isKaleDag(s)) return dagIndex(s) * 86400000;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  function cmpMoment(a, b) {
    var ta = tijdstipMs(a), tb = tijdstipMs(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return 0;
  }
  function opMoment(rijen, veld) {
    return stabielSorteren(rijen, function (a, b) { return cmpMoment(a && a[veld], b && b[veld]); });
  }

  var KAN_LOCALE = (function () {
    try { 'a'.localeCompare('b', 'nl'); return true; } catch (e) { return false; }
  })();
  function cmpNaam(a, b) {
    var x = tekst(a), y = tekst(b);
    if (x === y) return 0;
    if (KAN_LOCALE) {
      var r = x.localeCompare(y, 'nl');
      return r < 0 ? -1 : (r > 0 ? 1 : 0);
    }
    var lx = x.toLowerCase(), ly = y.toLowerCase();
    if (lx < ly) return -1;
    if (lx > ly) return 1;
    return x < y ? -1 : 1;
  }

  function initialen(naam) {
    var delen = trim(naam).split(/\s+/).filter(function (w) { return !!w; });
    if (!delen.length) return '';
    if (delen.length === 1) return delen[0].slice(0, 2).toUpperCase();
    return (delen[0].charAt(0) + delen[delen.length - 1].charAt(0)).toUpperCase();
  }

  /* ============================================================
     1. CONSTANTEN
     ============================================================ */

  /* De Nederlandse fasenaam bij een fasesleutel, ALLEEN voor logregels —
     een kopie van stage_label_nl() in 0021 (en van STAGES in beheer.html),
     zodat de demo dezelfde regel in het logboek zet als de server.
     Schermen gebruiken hun eigen tabel en i18nT; dit is data voor het
     logboek, geen schermtekst. */
  var FASE_LABELS = {
    concept: 'Concept & Industrieel Ontwerp',
    dfm: 'Ontwerp voor Produceerbaarheid',
    sourcing: 'Fabriekssourcing & Screening',
    tooling: 'Tooling, Sampling & Iteratie',
    production: 'Massaproductie & Kwaliteitscontrole',
    logistics: 'Compliance & Logistiek'
  };
  function faseLabel(key) { return FASE_LABELS[key] || tekst(key); }

  /* de vier vertalingen in portal/i18n.js plus de Nederlandse bron —
     exact de lijst uit clients_guard_prefs() in 0021 */
  var TALEN = ['nl', 'en', 'de', 'fr', 'es'];

  /* De zes mailcategorieën van notifyClient (admin_contacts.cats in 0005).
     CP_PORTAAL.ROLLEN_CONTACT is de bron zodra portaal-model.js geladen is;
     deze lijst is de terugval voor een test zonder dat bestand en draagt
     bewust dezelfde sleutels. */
  var MAILCATEGORIEEN_TERUGVAL = ['fase', 'update', 'sample', 'zending', 'factuur', 'relatie'];
  function mailCategorieen() {
    var pm = root && root.CP_PORTAAL;
    if (pm && Array.isArray(pm.ROLLEN_CONTACT) && pm.ROLLEN_CONTACT.length) {
      return pm.ROLLEN_CONTACT.map(function (r) { return tekst(r && r.key); });
    }
    return MAILCATEGORIEEN_TERUGVAL.slice();
  }

  /* de vier rollen van team_members (0020); label alleen voor "jouw
     contactpersoon bij CUSTOM+". CP_DATA.rolLabel wint als admin-data.js
     toevallig geladen is, zodat er nooit twee benamingen bestaan. */
  var ROL_LABELS = { eigenaar: 'Eigenaar', beheerder: 'Beheerder', medewerker: 'Medewerker', lezer: 'Lezer' };
  function rolLabel(key) {
    var d = root && root.CP_DATA;
    if (d && isFunctie(d.rolLabel)) return d.rolLabel(key);
    return ROL_LABELS[key] || tekst(key);
  }

  /* de statuscodes waarin een factuur "open" is voor een betalingsmelding
     (report_payment) en voor een bezwaar (dispute_invoice) — letterlijk
     uit 0021 */
  var OPEN_VOOR_MELDING = ['finalized', 'sent', 'viewed', 'partially_paid', 'overdue', 'disputed'];
  var OPEN_VOOR_BEZWAAR = ['finalized', 'sent', 'viewed', 'partially_paid', 'overdue'];

  var BUCKET_KLANT = 'klant-upload';       /* blok 9 van 0021 */
  var BUCKET_STAF = 'project-docs';        /* 0001: stafdocumenten */
  /* de bovengrens van de bucket uit 0021 (25 MB). Bewust in BEIDE modi
     dezelfde grens: een demo die strenger is dan live is ook een verschil,
     en een demo die soepeler is laat een upload slagen die live wordt
     geweigerd. Loopt de browseropslag eerder vol, dan zegt demo-files.js
     dat zelf eerlijk. */
  var UPLOAD_MAX_BYTES = 26214400;
  var MAX_MARKERINGEN = 50;
  var MAX_BERICHT = 4000;

  var REORDER_STAP_EERSTE = 'aanvraag';

  /* De collecties in de demo-state die deze laag SCHRIJFT. Wie de
     schrijven-haak bouwt, bewaart minstens deze — zie afspraak 4 in het
     kopblok. */
  var DEMO_COLLECTIES = ['projects', 'samples', 'invoices', 'invoicePayments', 'invoiceAudit',
    'documents', 'docSlots', 'questions', 'questionMessages', 'reorderRequests',
    'clientContacts', 'clients', 'accessLog', 'auditLog'];

  /* Velden die NOOIT naar de klant reizen, in welke actie of export ook.
     internal_note staat sinds 0008 op invoices en is letterlijk "NOOIT
     zichtbaar voor de klant"; notes op clients is de notitie van het
     beheer óver de klant; snapshot is de bevroren factuurinhoud met
     interne regels; de rest zijn interne bijlagen en bestandsverwijzingen. */
  var INTERNE_VELDEN = ['internalNote', 'notes', 'snapshot', 'snapshotAt', 'aiUsed', 'aiModel',
    'transactionRef', 'proofRef', 'proofPath', 'proofName', 'proofSize', 'reversalReason',
    'storagePath', 'fileRef', 'invitedAt', 'authUserId'];

  /* ============================================================
     2. FOUTCODES — de ene tabel van code naar Nederlandse zin
     Elke sleutel is een code uit 0021 (raise exception) of een code die
     deze laag zelf uitdeelt vóór er iets naar de server gaat. Elke waarde
     is een hele zin die door i18nT kan; de i18n-ronde vertaalt ze in vier
     talen. Geen aan elkaar geplakte stukjes.
     ============================================================ */
  var FOUTCODES = {
    /* algemeen */
    niet_ingelogd: 'Je bent niet (meer) ingelogd. Log opnieuw in en probeer het nog eens.',
    alleen_beheer: 'Deze handeling is alleen voor het beheer.',
    geen_toegang: 'Je hebt geen toegang tot dit onderdeel.',
    geen_verbinding: 'Er is geen verbinding met de server. Controleer je internetverbinding en probeer het opnieuw.',
    opslag_niet_gekoppeld: 'De opslag van de demo is niet gekoppeld, dus er kan niets worden bewaard.',
    invoer_ongeldig: 'De ingevulde gegevens zijn niet geldig. Controleer ze en probeer het opnieuw.',
    /* geen mailadres in een foutzin (advies 10): het scherm zet er zelf de
       knop "Vraag stellen" naast, die de context al meeneemt */
    onbekende_fout: 'Dat lukte niet. Probeer het opnieuw.',
    /* approve_stage */
    fase_niet_gevonden: 'Deze fase is niet gevonden.',
    fase_niet_in_wachtstand: 'Deze fase wacht niet op jouw akkoord.',
    naam_ontbreekt: 'Vul je naam in om akkoord te geven.',
    /* decide_sample */
    sample_niet_gevonden: 'Deze sampleronde is niet gevonden.',
    sample_niet_in_wachtstand: 'Deze sampleronde wacht niet op jouw beoordeling.',
    sample_al_beoordeeld: 'Je hebt deze sampleronde al beoordeeld.',
    beslissing_ongeldig: 'Kies goedkeuren of aanpassing nodig.',
    markeringen_ongeldig: 'De aanwijzingen op de foto zijn niet geldig. Zet er hoogstens vijftig.',
    opmerking_ontbreekt: 'Beschrijf wat er aangepast moet worden, of zet een aanwijzing op de foto.',
    /* report_payment */
    factuur_niet_gevonden: 'Deze factuur is niet gevonden.',
    geen_factuur: 'Dit is een creditnota en geen factuur; daar kun je geen betaling op melden.',
    factuur_niet_open: 'Deze factuur staat niet meer open.',
    bedrag_ongeldig: 'Vul een bedrag in dat groter is dan nul.',
    datum_ontbreekt: 'Vul de datum van je betaling in.',
    datum_in_toekomst: 'De betaaldatum kan niet in de toekomst liggen.',
    datum_ongeldig: 'De betaaldatum is niet geldig.',
    betaling_al_gemeld: 'Deze betaling is al gemeld en wordt gecontroleerd.',
    /* dispute_invoice */
    factuur_al_betwist: 'Je hebt op deze factuur al bezwaar gemaakt.',
    factuur_al_betaald: 'Deze factuur is al betaald; bezwaar maken kan niet meer.',
    reden_ontbreekt: 'Beschrijf waarom je bezwaar maakt.',
    overgang_niet_toegestaan: 'Bezwaar maken is in de huidige stand van deze factuur niet mogelijk.',
    /* request_reorder */
    project_niet_gevonden: 'Dit product is niet gevonden.',
    project_niet_afgerond: 'Herbestellen kan pas als dit product is afgerond.',
    aantal_ongeldig: 'Vul een aantal in dat groter is dan nul.',
    datum_in_verleden: 'De gewenste leverdatum kan niet in het verleden liggen.',
    datum_te_ver: 'De gewenste leverdatum ligt te ver vooruit. Kies een datum binnen drie jaar.',
    wijziging_ontbreekt: 'Beschrijf wat er anders moet dan bij de vorige bestelling.',
    herbestelling_loopt_al: 'Er loopt al een herbestelling voor dit product. Steffan neemt contact met je op.',
    /* documents en de bucket */
    slot_niet_gevonden: 'Er wordt op dit moment geen bestand van je verwacht.',
    slot_niet_van_klant: 'Dit bestand levert Steffan aan, niet jij.',
    slot_al_gevuld: 'Dit bestand is al aangeleverd.',
    bestand_ontbreekt: 'Kies eerst een bestand.',
    bestand_leeg: 'Dit bestand is leeg.',
    bestand_te_groot: 'Dit bestand is groter dan 25 MB. Kies een kleiner bestand.',
    upload_mislukt: 'Het bestand kon niet worden geüpload. Probeer het opnieuw.',
    bestandsopslag_ontbreekt: 'De bestandsopslag van de demo is niet geladen.',
    document_niet_gevonden: 'Dit document is niet gevonden.',
    /* clients (voorkeuren) */
    alleen_voorkeuren_wijzigbaar: 'Je kunt alleen je taal en je meldingen wijzigen.',
    taal_onbekend: 'Deze taal is niet beschikbaar.',
    voorkeuren_ongeldig: 'De meldingsvoorkeuren zijn niet geldig.',
    categorie_onbekend: 'Deze mailcategorie bestaat niet.',
    /* question_messages en question_threads */
    vraag_niet_gevonden: 'Dit gesprek is niet gevonden.',
    bericht_leeg: 'Schrijf eerst een bericht.',
    bericht_te_lang: 'Je bericht is te lang. Houd het onder de 4000 tekens.',
    /* client_contacts */
    contact_niet_gevonden: 'Deze contactpersoon is niet gevonden.',
    email_ongeldig: 'Dit e-mailadres is niet geldig.',
    contact_email_dubbel: 'Er is al een contactpersoon met dit e-mailadres.',
    /* verify_payment_report — beheerkant, hier alleen zodat de tabel
       compleet is voor de i18n-ronde */
    melding_niet_gevonden: 'Deze gemelde betaling is niet gevonden.',
    melding_al_bevestigd: 'Deze gemelde betaling is al bevestigd.'
  };

  /* Een Error met een Nederlandse zin als message en de code erbij. De
     zin IS de i18n-sleutel: het scherm doet i18nT(err.message) of
     berichtVoorFout(err). detail is techniek voor de console, nooit voor
     het scherm. */
  function fout(code, detail) {
    var zin = FOUTCODES[code] || FOUTCODES.onbekende_fout;
    var e = new Error(zin);
    e.code = FOUTCODES[code] ? code : 'onbekende_fout';
    e.detail = tekst(detail);
    e.nl = true;
    return e;
  }

  /* Van een willekeurige fout (deze laag, Supabase, het netwerk) de
     Nederlandse zin. Een bekende code wint; een zin die deze laag zelf
     schreef (err.nl) blijft staan; al het andere wordt de algemene zin,
     met de oorspronkelijke boodschap op err.detail voor wie wil weten wat
     er echt gebeurde. */
  function berichtVoorFout(err) {
    if (!err) return FOUTCODES.onbekende_fout;
    if (typeof err === 'string') return FOUTCODES[err] || err;
    if (err.code && FOUTCODES[err.code]) return FOUTCODES[err.code];
    var m = tekst(err.message);
    if (FOUTCODES[m]) return FOUTCODES[m];
    if (err.nl && m) return m;
    return FOUTCODES.onbekende_fout;
  }

  /* De fout van PostgREST/Supabase → een Error van deze laag.
       · raise exception 'fase_niet_in_wachtstand' komt binnen als
         message = de code (en details = 'status: …');
       · PGRST301 / een verlopen JWT = niet ingelogd;
       · 42501 = de policy weigert (voor de klant: geen toegang);
       · 23505 = unieke index (bij client_contacts: het e-mailadres);
       · 23514 = een check-constraint (invoer ongeldig);
       · 'Failed to fetch' = geen verbinding.
     `wat` is een korte context voor err.detail. */
  function vertaalDbFout(error, wat, opties) {
    var o = isObj(opties) ? opties : {};
    var msg = tekst(error && error.message);
    var code = tekst(error && error.code);
    var details = tekst(error && error.details);
    var kern = msg.replace(/^[^a-z_]*/, '').split(/\s/)[0];
    if (FOUTCODES[msg]) return fout(msg, details || wat);
    if (FOUTCODES[kern]) return fout(kern, details || wat);
    if (code === 'PGRST301' || /jwt expired|not authenticated|invalid claim/i.test(msg)) return fout('niet_ingelogd', msg);
    /* .single() op nul rijen: de rij is er niet, of niet van deze klant —
       PostgREST maakt daar geen lege uitkomst maar een fout van */
    if (code === 'PGRST116' || /multiple \(or no\) rows|no rows|0 rows/i.test(msg)) return fout(o.bijWeg || 'geen_toegang', msg);
    if (code === '42501' || /row-level security|permission denied/i.test(msg)) return fout(o.bijPolicy || 'geen_toegang', msg);
    if (code === '23505') return fout(o.bijDubbel || 'invoer_ongeldig', msg);
    if (code === '23514' || code === '22P02' || code === '23502') return fout(o.bijCheck || 'invoer_ongeldig', msg);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return fout('geen_verbinding', msg);
    return fout('onbekende_fout', (wat ? wat + ': ' : '') + (msg || details || code));
  }

  /* het antwoord van sb.rpc / sb.from(...).select().single() → data, of
     een verworpen Promise met een vertaalde fout */
  function uitkomst(res, wat, opties) {
    if (!res) return Promise.reject(fout('onbekende_fout', wat));
    if (res.error) return Promise.reject(vertaalDbFout(res.error, wat, opties));
    return Promise.resolve(res.data);
  }

  /* ============================================================
     3. MODUS, SESSIE EN OPSLAG
     ST is de enige veranderlijke toestand in dit bestand.
     ============================================================ */

  var ST = {
    modus: 'demo',
    client: null,
    lezen: null,
    schrijven: null,
    sessie: null,          /* {clientId, contactName, company, email, portalLang} */
    klantIdLive: null,     /* cache van my_client_id() in live modus */
    geinitialiseerd: false
  };

  /* opts: {mode:'demo'|'supa'|'supabase'|'live', client, lezen, schrijven,
            sessie}
     · mode       'demo' (of niets) = demomodus; 'supa'/'supabase'/'live' = live.
     · client     de Supabase-client (sb); alleen nodig in live modus.
     · lezen()    geeft de demo-state terug — hetzelfde object dat
                  demoService() in portal.html beheert.
     · schrijven(state)  bewaart die state weer; mag een Promise geven.
                  Bewaar minstens DEMO_COLLECTIES (afspraak 4).
     · sessie     het SESSION-object van portal.html: {clientId,
                  contactName, company, email, portalLang}. In de demo is
                  dit de enige manier om te weten wélke klant is ingelogd
                  (de seed heeft er twee); live is het een versnelling
                  boven my_client_id() en de naam boven een bericht. */
  function init(opts) {
    var o = isObj(opts) ? opts : {};
    var m = trim(o.mode || o.modus).toLowerCase();
    ST.modus = (m === 'supa' || m === 'supabase' || m === 'live') ? 'supa' : 'demo';
    ST.client = o.client || null;
    ST.lezen = isFunctie(o.lezen) ? o.lezen : null;
    ST.schrijven = isFunctie(o.schrijven) ? o.schrijven : null;
    ST.klantIdLive = null;
    setSessie(o.sessie || o.session || null);
    ST.geinitialiseerd = true;
    return ST.modus;
  }

  function setSessie(s) {
    ST.sessie = isObj(s) ? {
      clientId: tekst(s.clientId),
      contactName: tekst(s.contactName),
      company: tekst(s.company),
      email: tekst(s.email),
      portalLang: tekst(s.portalLang)
    } : null;
    ST.klantIdLive = null;
  }
  function sessie() { return ST.sessie ? kopie(ST.sessie) : null; }
  function modus() { return ST.modus; }
  function isDemo() { return ST.modus !== 'supa'; }
  function sb() { return ST.client; }

  /* Is er echt iets om mee te praten? De schermen tonen hiermee een
     eerlijke lege stand in plaats van een rij foutmeldingen. */
  function gekoppeld() {
    if (ST.modus === 'supa') return !!ST.client;
    return !!(ST.lezen && ST.schrijven);
  }

  /* ---- demo-opslag ---------------------------------------------------- */

  function seedLijst(sleutel) {
    var g = root;
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
    var seed = root && root.CP_DEMO;
    return isObj(seed) ? seed : {};
  }

  /* de collectie uit de demo-state, met aanvulling voor schema-drift:
     reorderRequests en clientContacts bestaan pas sinds deze bouw, dus een
     demo-opslag van gisteren mist ze. De aanvulling wordt alleen in de
     state geschreven wanneer er ook echt een opslag achter zit. */
  function demoLijst(state, sleutel) {
    if (Array.isArray(state[sleutel])) return state[sleutel];
    var v = seedLijst(sleutel);
    if (ST.schrijven) state[sleutel] = v;
    return v;
  }

  function demoInstellingen(state) {
    return isObj(state.settings) ? state.settings : {};
  }

  function eisSchrijven() {
    if (isDemo() && !ST.schrijven) return fout('opslag_niet_gekoppeld');
    if (!isDemo() && !ST.client) return fout('geen_verbinding', 'geen Supabase-client in init()');
    return null;
  }

  function demoBewaren(state, uitkomstWaarde) {
    var f = eisSchrijven();
    if (f) return Promise.reject(f);
    return Promise.resolve(ST.schrijven(state)).then(function () { return uitkomstWaarde; });
  }

  /* WIE — stap (1) van elke RPC, in de demo. Zonder sessie is er geen
     ingelogde klant, en dat is dezelfde weigering als auth.uid() is null. */
  function demoKlantId() {
    var id = ST.sessie ? tekst(ST.sessie.clientId) : '';
    if (!id) throw fout('niet_ingelogd', 'geen sessie in init()');
    return id;
  }

  function demoKlant(state) {
    var id = demoKlantId();
    var rij = lijstVan(state.clients).filter(function (c) { return c && c.id === id; })[0];
    if (!rij) throw fout('niet_ingelogd', 'klant ' + id + ' staat niet in de demo-state');
    return rij;
  }

  function demoProject(state, projectId) {
    return lijstVan(state.projects).filter(function (p) { return p && p.id === projectId; })[0] || null;
  }

  /* eigendom: het project is van de ingelogde klant. "Niet gevonden" en
     "niet van jou" geven bewust DEZELFDE code, net als owns_project() in
     de RPC's: een geraden id verraadt niets. */
  function demoEigenProject(state, projectId, codeBijWeg) {
    var klantId = demoKlantId();
    var p = demoProject(state, projectId);
    if (!p || p.clientId !== klantId) throw fout(codeBijWeg);
    return p;
  }

  /* DE LOGSCHRIJVER — spiegel van portaal_log() in 0021: één regel in het
     klantzichtbare toegangslogboek (accessLog) én één in het staflogboek
     (auditLog, kind 'klant'), zodat het beheer de klantacties als eigen
     soort kan filteren. Detail wordt op 2000 tekens geknipt, zoals daar.
     `moment` is het tijdstip waarop de aanroeper zijn eigen rij stempelde
     (approvedAt, clientDecidedAt, createdAt, …): ÉÉN klokaflezing per
     actie, zodat rij en logregel exact hetzelfde tijdstip dragen — live
     is now() de transactietijd, dus daar kan het niet anders. Las deze
     functie de klok opnieuw, dan vielen rij en logregel in een browser af
     en toe in verschillende milliseconden en ontdubbelde mergeActivity de
     tweeling niet meer. Zonder moment (een actie zonder eigen stempel)
     leest hij de klok zelf, één keer. */
  function demoLog(state, projectId, actor, action, assetKind, assetId, detail, moment) {
    var p = demoProject(state, projectId);
    var d = tekst(detail).slice(0, 2000);
    moment = tekst(moment) || nuISO();
    var rij = {
      id: uniekId('log'), projectId: projectId, actor: actor || 'client',
      assetKind: assetKind, assetId: assetId || null, action: action,
      detail: d, createdAt: moment
    };
    demoLijst(state, 'accessLog').push(rij);
    demoLijst(state, 'auditLog').push({
      id: uniekId('aud'), kind: 'klant',
      clientId: p ? (p.clientId || null) : null, projectId: projectId,
      detail: d, createdAt: moment
    });
    return rij;
  }

  /* ---- live-hulpjes ---------------------------------------------------- */

  function eisLive() {
    if (!ST.client) return Promise.reject(fout('geen_verbinding', 'geen Supabase-client in init()'));
    return Promise.resolve(ST.client);
  }

  /* het clients.id van de ingelogde klant, live: uit de sessie als die er
     is, anders één keer via my_client_id() (0021) en daarna gecachet */
  function liveKlantId() {
    if (ST.sessie && ST.sessie.clientId) return Promise.resolve(ST.sessie.clientId);
    if (ST.klantIdLive) return Promise.resolve(ST.klantIdLive);
    return eisLive().then(function (c) {
      return c.rpc('my_client_id').then(function (res) {
        return uitkomst(res, 'my_client_id');
      });
    }).then(function (id) {
      if (!id) throw fout('niet_ingelogd', 'my_client_id() gaf niets terug');
      ST.klantIdLive = tekst(id);
      return ST.klantIdLive;
    });
  }

  /* de kolommen van de eigen klantrij die de klant mag zien — bewust geen
     select('*'): daar zit `notes` bij, de notitie van het beheer óver de
     klant, en Postgres kent geen leesrecht per kolom */
  var KLANT_KOLOMMEN = 'id, company, contact_name, email, phone, portal_lang, mail_prefs, created_at, country, tagline, logo_url';
  var KLANT_KOLOMMEN_OUD = 'id, company, contact_name, email, phone, portal_lang, mail_prefs, created_at';

  /* ============================================================
     4. NORMALISATOREN — één vorm per entiteit, in beide modi
     Elke schrijfactie en elke leesfunctie eindigt hier. Interne velden
     gaan er altijd uit; ontbrekende velden krijgen hun eerlijke lege
     stand (null of ''), nooit een verzonnen waarde.
     ============================================================ */

  function zonderIntern(r) {
    var uit = {};
    Object.keys(isObj(r) ? r : {}).forEach(function (k) {
      if (INTERNE_VELDEN.indexOf(k) >= 0) return;
      uit[k] = r[k];
    });
    return uit;
  }

  function normStage(r, projectId) {
    var s = camelRij(isObj(r) ? r : {});
    var uit = zonderIntern(s);
    uit.id = s.id || null;
    uit.projectId = s.projectId || projectId || null;
    uit.stageKey = tekst(s.stageKey);
    uit.position = heelGetalOfNull(s.position);
    uit.status = tekst(s.status);
    uit.paymentPct = heelGetalOfNull(s.paymentPct) || 0;
    uit.approvedAt = s.approvedAt || null;
    uit.approvedBy = tekst(s.approvedBy);
    uit.approvedVia = s.approvedVia || null;
    return uit;
  }

  function normSample(r) {
    var s = camelRij(isObj(r) ? r : {});
    var uit = zonderIntern(s);
    uit.id = s.id || null;
    uit.projectId = s.projectId || null;
    uit.roundLabel = tekst(s.roundLabel);
    uit.mediaId = s.mediaId || null;
    uit.status = tekst(s.status);
    uit.note = tekst(s.note);
    uit.roundDate = s.roundDate || null;
    uit.clientDecision = s.clientDecision || null;
    uit.clientNote = tekst(s.clientNote);
    uit.clientDecidedAt = s.clientDecidedAt || null;
    uit.clientMarks = Array.isArray(s.clientMarks) ? kopie(s.clientMarks) : [];
    return uit;
  }

  function normInvoice(r) {
    var s = camelRij(isObj(r) ? r : {});
    var uit = zonderIntern(s);
    uit.id = s.id || null;
    uit.projectId = s.projectId || null;
    uit.stageKey = tekst(s.stageKey);
    uit.label = tekst(s.label);
    uit.invoiceNumber = tekst(s.invoiceNumber);
    uit.currency = tekst(s.currency) || 'EUR';
    uit.status = tekst(s.status) || 'open';
    uit.statusCode = statusCodeVan(s);
    uit.docKind = tekst(s.docKind) || 'invoice';
    uit.publishStatus = tekst(s.publishStatus) || 'published';
    uit.amountCents = heelGetalOfNull(s.amountCents) || 0;
    /* totalCents/vatCents: de golf-3-velden die het portaal leest voor het
       te betalen bedrag en 'incl. btw'; ontbreken ze (rij van vóór golf 3),
       dan blijven ze null en telt amountCents — zelfde terugval als
       invoiceDueCents() in portal.html */
    uit.totalCents = heelGetalOfNull(s.totalCents);
    uit.vatCents = heelGetalOfNull(s.vatCents);
    uit.paidCents = (s.paidCents === undefined || s.paidCents === null) ? null : (heelGetalOfNull(s.paidCents) || 0);
    uit.creditedCents = heelGetalOfNull(s.creditedCents) || 0;
    uit.outstandingCents = heelGetalOfNull(s.outstandingCents);
    uit.dueDate = s.dueDate || null;
    uit.documentId = s.documentId || null;
    uit.reminderPaused = !!s.reminderPaused;
    uit.createdAt = s.createdAt || null;
    uit.paidAt = s.paidAt || null;
    uit.publishedAt = s.publishedAt || null;
    uit.updatedAt = s.updatedAt || null;
    return uit;
  }

  /* de klantzichtbare projectie van een betaling — exact de velden van
     payment_report_json() in 0021, nooit internal_note, transaction_ref
     of het betaalbewijs */
  function normBetaling(r) {
    var p = camelRij(isObj(r) ? r : {});
    return {
      id: p.id || null,
      invoiceId: p.invoiceId || null,
      paidOn: dayISO(p.paidOn),
      amountCents: heelGetalOfNull(p.amountCents) || 0,
      currency: tekst(p.currency) || 'EUR',
      clientReference: tekst(p.clientReference),
      reportedByClient: p.reportedByClient === undefined ? true : !!p.reportedByClient,
      verifiedAt: p.verifiedAt || null,
      createdAt: p.createdAt || null
    };
  }

  function normBericht(r, opties) {
    var m = camelRij(isObj(r) ? r : {});
    var o = isObj(opties) ? opties : {};
    var auteur = tekst(m.author);
    if (auteur !== 'client' && auteur !== 'staff') auteur = 'staff';
    return {
      id: m.id || null,
      questionId: m.questionId || null,
      author: auteur,
      authorName: tekst(m.authorName),
      body: tekst(m.body),
      createdAt: m.createdAt || null,
      /* virtueel = opgebouwd uit de oude question/answer-kolommen; er zit
         geen rij in question_messages achter (zie listMessages) */
      virtueel: !!o.virtueel
    };
  }

  function normVraag(r) {
    var q = camelRij(isObj(r) ? r : {});
    var uit = zonderIntern(q);
    uit.id = q.id || null;
    uit.projectId = q.projectId || null;
    uit.mediaId = q.mediaId || null;
    uit.stageKey = tekst(q.stageKey);
    uit.question = tekst(q.question);
    uit.answer = tekst(q.answer);
    uit.askedAt = q.askedAt || null;
    uit.answeredAt = q.answeredAt || null;
    return uit;
  }

  function normDocument(r) {
    var d = camelRij(isObj(r) ? r : {});
    var uit = zonderIntern(d);
    uit.id = d.id || null;
    uit.projectId = d.projectId || null;
    uit.stageKey = tekst(d.stageKey);
    uit.docType = tekst(d.docType);
    uit.title = tekst(d.title);
    uit.version = heelGetalOfNull(d.version) || 1;
    uit.shipmentId = d.shipmentId || null;
    uit.publishStatus = tekst(d.publishStatus) || 'published';
    uit.uploadedBy = tekst(d.uploadedBy) || 'staf';
    uit.clientNote = tekst(d.clientNote);
    uit.slotId = d.slotId || null;
    uit.fileName = d.fileName || null;
    uit.fileSize = heelGetalOfNull(d.fileSize);
    uit.mimeType = d.mimeType || null;
    /* heeft dit document een echt bestand? Live: een opslagpad; demo: een
       verwijzing naar IndexedDB. De verwijzing zelf reist niet mee. */
    uit.heeftBestand = !!(d.storagePath || d.fileRef);
    uit.createdAt = d.createdAt || null;
    return uit;
  }

  function normSlot(r) {
    var s = camelRij(isObj(r) ? r : {});
    return {
      id: s.id || null,
      projectId: s.projectId || null,
      docType: tekst(s.docType),
      stageKey: tekst(s.stageKey),
      status: tekst(s.status) || 'verwacht',
      documentId: s.documentId || null,
      expectedFrom: s.expectedFrom || null,
      createdAt: s.createdAt || null
    };
  }

  function normReorder(r) {
    var x = camelRij(isObj(r) ? r : {});
    return {
      id: x.id || null,
      projectId: x.projectId || null,
      clientId: x.clientId || null,
      qty: heelGetalOfNull(x.qty) || 0,
      wantedBy: dayISO(x.wantedBy),
      sameSpec: x.sameSpec === undefined ? true : !!x.sameSpec,
      changeNote: tekst(x.changeNote),
      status: tekst(x.status) || REORDER_STAP_EERSTE,
      createdAt: x.createdAt || null,
      updatedAt: x.updatedAt || null
    };
  }

  function normContact(r) {
    var c = camelRij(isObj(r) ? r : {});
    var naam = tekst(c.name);
    return {
      id: c.id || null,
      clientId: c.clientId || null,
      name: naam,
      email: tekst(c.email),
      role: tekst(c.role),
      mailCategories: normCategorieen(c.mailCategories),
      canLogin: !!c.canLogin,
      avatarUrl: tekst(c.avatarUrl),
      initialen: initialen(naam || c.email),
      createdAt: c.createdAt || null,
      updatedAt: c.updatedAt || null
    };
  }

  function normCategorieen(v) {
    var gezien = {}, uit = [];
    lijstVan(v).forEach(function (k) {
      var t = trim(k);
      if (!t || gezien[t]) return;
      gezien[t] = true;
      uit.push(t);
    });
    return uit;
  }

  /* de eigen klantrij zoals de schermen hem mogen zien; `meldingen` is
     de afgeleide kaart van alle zes categorieën → aan/uit, zodat
     Instellingen niet zelf hoeft te weten dat mail_prefs alleen de
     uitgezette categorieën bevat (0005) */
  function normKlant(r) {
    var c = camelRij(isObj(r) ? r : {});
    var prefs = isObj(c.mailPrefs) ? c.mailPrefs : {};
    var meldingen = {};
    mailCategorieen().forEach(function (k) { meldingen[k] = prefs[k] !== false; });
    return {
      id: c.id || null,
      company: tekst(c.company),
      contactName: tekst(c.contactName),
      email: tekst(c.email),
      phone: tekst(c.phone),
      country: tekst(c.country),
      tagline: tekst(c.tagline),
      logoUrl: tekst(c.logoUrl),
      portalLang: TALEN.indexOf(tekst(c.portalLang)) >= 0 ? tekst(c.portalLang) : 'nl',
      mailPrefs: kopie(prefs),
      meldingen: meldingen,
      createdAt: c.createdAt || null
    };
  }

  /* De statuscode van een factuur, met de eerlijke terugval voor rijen
     van vóór de factuurmodule — exact dezelfde regel als invoiceStatusCode()
     in portal.html en de backfill in 0008: concept → draft, paid → paid,
     void → cancelled, anders finalized. */
  function statusCodeVan(inv) {
    if (!isObj(inv)) return 'draft';
    var code = tekst(inv.statusCode);
    if (code) return code;
    if (tekst(inv.publishStatus) === 'concept') return 'draft';
    if (inv.status === 'paid') return 'paid';
    if (inv.status === 'void') return 'cancelled';
    return 'finalized';
  }

  /* wat er van een factuur betaald is — paidCents als het veld er is
     (ook 0), anders de golf-1-vlag; zelfde regel als portal.html */
  function betaaldCentsVan(inv) {
    if (inv.paidCents !== undefined && inv.paidCents !== null) return heelGetalOfNull(inv.paidCents) || 0;
    if (statusCodeVan(inv) === 'paid') return heelGetalOfNull(inv.totalCents) || heelGetalOfNull(inv.amountCents) || 0;
    return 0;
  }

  /* ============================================================
     5. AKKOORD GEVEN — approve_stage
     ============================================================ */

  /* stage: het fase-object uit de bundel ({id, projectId, stageKey, …}).
     Live telt alleen id; in de demo hebben fasen geen eigen id (ze zitten
     genest in project.stages), dus daar zoeken we op projectId + stageKey,
     en op id waar dat er wél is. */
  function akkoordGeven(stage, naam) {
    var s = isObj(stage) ? stage : { id: tekst(stage) };
    var v_naam = trim(naam).slice(0, 120);

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          /* (1) wie */
          var klantId = demoKlantId();
          var gevonden = demoZoekFase(state, s);
          if (!gevonden || gevonden.project.clientId !== klantId) throw fout('fase_niet_gevonden');
          var rij = gevonden.stage;
          /* (2) wachtstand */
          if (rij.status !== 'awaiting_approval') throw fout('fase_niet_in_wachtstand', 'status: ' + rij.status);
          /* (3) invoer */
          if (!v_naam) throw fout('naam_ontbreekt');
          /* (4) schrijven — één klokaflezing voor rij én logregel */
          var moment = nuISO();
          rij.status = 'done';
          rij.approvedAt = moment;
          rij.approvedBy = v_naam;
          rij.approvedVia = 'portaal';
          demoLog(state, gevonden.project.id, 'client', 'approve', 'stage', rij.id || null,
            'Fase goedgekeurd door ' + v_naam + ': ' + faseLabel(rij.stageKey), moment);
          resolve(demoBewaren(state, normStage(rij, gevonden.project.id)));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      return c.rpc('approve_stage', { p_stage_id: s.id, p_name: v_naam })
        .then(function (res) { return uitkomst(res, 'approve_stage'); });
    }).then(function (rij) { return normStage(rij, s.projectId); });
  }

  function demoZoekFase(state, s) {
    var projecten = lijstVan(state.projects);
    var i, j, p, st;
    for (i = 0; i < projecten.length; i++) {
      p = projecten[i];
      if (!p) continue;
      if (s.projectId && p.id !== s.projectId) continue;
      var stages = lijstVan(p.stages);
      for (j = 0; j < stages.length; j++) {
        st = stages[j];
        if (!st) continue;
        if (s.id && st.id && st.id === s.id) return { project: p, stage: st };
        if (!st.id && s.stageKey && st.stageKey === s.stageKey && (s.projectId ? p.id === s.projectId : false)) {
          return { project: p, stage: st };
        }
      }
    }
    return null;
  }

  /* ============================================================
     6. SAMPLE BEOORDELEN — decide_sample
     ============================================================ */

  function normMarkeringen(markeringen) {
    if (markeringen === null || markeringen === undefined) return [];
    if (!Array.isArray(markeringen)) throw fout('markeringen_ongeldig', 'geen array');
    if (markeringen.length > MAX_MARKERINGEN) throw fout('markeringen_ongeldig', 'meer dan ' + MAX_MARKERINGEN);
    for (var i = 0; i < markeringen.length; i++) {
      if (!isObj(markeringen[i])) throw fout('markeringen_ongeldig', 'element ' + i + ' is geen object');
    }
    return kopie(markeringen);
  }

  function sampleBeoordelen(ronde, beslissing, opmerking, markeringen) {
    var id = idVan(ronde);
    var v_beslissing = trim(beslissing);
    var v_note = trim(opmerking).slice(0, 2000);
    /* de aanwijzingen worden in BEIDE modi vóór alles getoetst (live: vóór
       de RPC vertrekt), zodat een fout id met foute aanwijzingen in demo
       en live dezelfde code geeft */
    var v_marks;
    try { v_marks = normMarkeringen(markeringen); } catch (e) { return Promise.reject(e); }

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          /* (1) wie */
          var klantId = demoKlantId();
          var rij = lijstVan(state.samples).filter(function (x) { return x && x.id === id; })[0];
          var p = rij ? demoProject(state, rij.projectId) : null;
          if (!rij || !p || p.clientId !== klantId) throw fout('sample_niet_gevonden');
          /* (2) wachtstand: beoordeeld door de staf, nog geen klantbeslissing */
          if (rij.status !== 'reviewed') throw fout('sample_niet_in_wachtstand', 'status: ' + rij.status);
          if (rij.clientDecision) throw fout('sample_al_beoordeeld');
          /* (3) invoer */
          if (v_beslissing !== 'goedgekeurd' && v_beslissing !== 'aanpassing') throw fout('beslissing_ongeldig');
          if (v_beslissing === 'aanpassing' && !v_note && !v_marks.length) throw fout('opmerking_ontbreekt');
          /* (4) schrijven */
          var moment = nuISO();
          if (v_beslissing === 'goedgekeurd') {
            /* één goedgekeurde ronde per project — dezelfde regel als
               DS.updateSample in beheer.html en als de RPC */
            lijstVan(state.samples).forEach(function (o) {
              if (o && o.projectId === rij.projectId && o.id !== rij.id && o.status === 'approved') o.status = 'superseded';
            });
            rij.status = 'approved';
            rij.clientDecision = 'goedgekeurd';
            rij.clientNote = v_note;
            rij.clientDecidedAt = moment;
            rij.clientMarks = v_marks;
            demoLog(state, rij.projectId, 'client', 'decide', 'sample', rij.id,
              'Sample ' + tekst(rij.roundLabel) + ' goedgekeurd door klant' + (v_note ? ' — ' + v_note.slice(0, 300) : ''), moment);
          } else {
            rij.clientDecision = 'aanpassing';
            rij.clientNote = v_note;
            rij.clientDecidedAt = moment;
            rij.clientMarks = v_marks;
            demoLog(state, rij.projectId, 'client', 'decide', 'sample', rij.id,
              'Sample ' + tekst(rij.roundLabel) + ': aanpassing gevraagd door klant'
                + (v_note ? ' — ' + v_note.slice(0, 300) : '')
                + (v_marks.length ? ' (' + v_marks.length + ' aanwijzing(en) op de foto)' : ''), moment);
          }
          resolve(demoBewaren(state, normSample(rij)));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      return c.rpc('decide_sample', { p_round_id: id, p_decision: v_beslissing, p_note: v_note, p_marks: v_marks })
        .then(function (res) { return uitkomst(res, 'decide_sample'); });
    }).then(normSample);
  }

  /* ============================================================
     7. BETALING MELDEN — report_payment
     ============================================================ */

  /* geeft {cents, datum, kenmerk} of gooit de foutcode — stap (3) van de
     RPC, in dezelfde volgorde: bedrag, datum ontbreekt, in de toekomst,
     absurd oud */
  function normMelding(m) {
    var o = isObj(m) ? m : {};
    var cents = heelGetalOfNull(o.cents);
    if (cents === null || cents <= 0) throw fout('bedrag_ongeldig');
    var datum = dayISO(o.datumISO || o.datum);
    if (!o.datumISO && !o.datum) throw fout('datum_ontbreekt');
    if (!datum || !isKaleDag(tekst(o.datumISO || o.datum).slice(0, 10))) throw fout('datum_ongeldig');
    /* één dag speling voor tijdzones, net als de server */
    if (datum > plusDagen(vandaagISO(), 1)) throw fout('datum_in_toekomst');
    if (datum < '2000-01-01') throw fout('datum_ongeldig');
    return { cents: cents, datum: datum, kenmerk: trim(o.kenmerk).slice(0, 140) };
  }

  function betalingMelden(invoice, melding) {
    var id = idVan(invoice);
    /* invoer vóór eigendom en wachtstand, in beide modi (live: vóór de RPC
       vertrekt) — zie de kop van dit bestand, "in dezelfde volgorde" */
    var m;
    try { m = normMelding(melding); } catch (e) { return Promise.reject(e); }

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          /* (1) wie — owns_invoice eist bovendien: gepubliceerd en niet
             draft/scheduled */
          var klantId = demoKlantId();
          var klant = demoKlant(state);
          var inv = lijstVan(state.invoices).filter(function (x) { return x && x.id === id; })[0];
          var p = inv ? demoProject(state, inv.projectId) : null;
          var code = inv ? statusCodeVan(inv) : '';
          if (!inv || !p || p.clientId !== klantId || tekst(inv.publishStatus) === 'concept'
              || code === 'draft' || code === 'scheduled') {
            throw fout('factuur_niet_gevonden');
          }
          /* (2) wachtstand */
          if ((inv.docKind || 'invoice') !== 'invoice') throw fout('geen_factuur');
          if (inv.status === 'paid' || OPEN_VOOR_MELDING.indexOf(code) < 0) throw fout('factuur_niet_open', 'status: ' + code);
          /* (3) invoer: bedrag en datum zijn al getoetst (zie boven); hier
             alleen nog de dubbelklik */
          var betalingen = demoLijst(state, 'invoicePayments');
          var dubbel = betalingen.some(function (x) {
            return x && x.invoiceId === inv.id && x.reportedByClient && !x.verifiedAt
              && (heelGetalOfNull(x.amountCents) || 0) === m.cents && dayISO(x.paidOn) === m.datum;
          });
          if (dubbel) throw fout('betaling_al_gemeld');
          /* (4) schrijven: een MELDING, geen boeking — de rij telt pas mee
             als de staf hem bevestigt (verifiedAt). De factuur zelf wordt
             daarom bewust niet herrekend; zie blok 7 van 0021. */
          var moment = nuISO();
          var pay = {
            id: uniekId('pay'), invoiceId: inv.id, paidOn: m.datum, amountCents: m.cents,
            currency: inv.currency || 'EUR', method: 'overboeking', transactionRef: '',
            reportedByClient: true, clientReference: m.kenmerk, verifiedAt: null,
            createdBy: 'klant:' + tekst(klant.email), createdAt: moment
          };
          betalingen.push(pay);
          demoLijst(state, 'invoiceAudit').push({
            id: uniekId('iau'), invoiceId: inv.id, event: 'betaling_gemeld',
            fromStatus: code, toStatus: code,
            detail: 'Klant meldt betaling van ' + geldTekst(m.cents, pay.currency) + ' op ' + dagNL(m.datum)
              + (m.kenmerk ? ', kenmerk ' + m.kenmerk : ''),
            changes: null, aiUsed: false, aiModel: '', actor: tekst(klant.email), createdAt: moment
          });
          demoLog(state, inv.projectId, 'client', 'report_payment', 'invoice', inv.id,
            'Betaling gemeld op factuur ' + (tekst(inv.invoiceNumber) || tekst(inv.label))
              + ': ' + geldTekst(m.cents, pay.currency) + ' op ' + dagNL(m.datum)
              + (m.kenmerk ? ', kenmerk ' + m.kenmerk : ''), moment);
          var uit = normInvoice(inv);
          uit.gemeldeBetaling = normBetaling(pay);
          resolve(demoBewaren(state, uit));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      return c.rpc('report_payment', { p_invoice_id: id, p_cents: m.cents, p_date: m.datum, p_reference: m.kenmerk })
        .then(function (res) { return uitkomst(res, 'report_payment'); });
    }).then(function (rij) {
      var r = isObj(rij) ? rij : {};
      var uit = normInvoice(r);
      uit.gemeldeBetaling = normBetaling(r.gemelde_betaling || r.gemeldeBetaling || {});
      return uit;
    });
  }

  /* ============================================================
     8. BEZWAAR MAKEN — dispute_invoice
     ============================================================ */

  function bezwaarMaken(invoice, reden) {
    var id = idVan(invoice);
    var v_reden = trim(reden).slice(0, 2000);

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          /* (1) wie */
          var klantId = demoKlantId();
          var klant = demoKlant(state);
          var inv = lijstVan(state.invoices).filter(function (x) { return x && x.id === id; })[0];
          var p = inv ? demoProject(state, inv.projectId) : null;
          var code = inv ? statusCodeVan(inv) : '';
          if (!inv || !p || p.clientId !== klantId || tekst(inv.publishStatus) === 'concept'
              || code === 'draft' || code === 'scheduled') {
            throw fout('factuur_niet_gevonden');
          }
          /* (2) wachtstand */
          if ((inv.docKind || 'invoice') !== 'invoice') throw fout('geen_factuur');
          if (code === 'disputed') throw fout('factuur_al_betwist');
          if (inv.status === 'paid' || code === 'paid') throw fout('factuur_al_betaald');
          if (OPEN_VOOR_BEZWAAR.indexOf(code) < 0) throw fout('factuur_niet_open', 'status: ' + code);
          /* (3) invoer */
          if (!v_reden) throw fout('reden_ontbreekt');
          /* de transitietabel van de factuurmodule heeft het laatste woord,
             ook hier — dezelfde tabel als invoice_can_transition() in 0012 */
          var core = root && root.CP_INVOICE;
          if (core && isFunctie(core.canTransition)) {
            var chk = core.canTransition(code, 'disputed', { paidCents: betaaldCentsVan(inv), hasNumber: !!tekst(inv.invoiceNumber) });
            if (!chk || !chk.ok) throw fout('overgang_niet_toegestaan', 'van: ' + code);
          }
          /* (4) schrijven */
          var moment = nuISO();
          inv.statusCode = 'disputed';
          inv.reminderPaused = true;
          inv.updatedAt = moment;
          demoLijst(state, 'invoiceAudit').push({
            id: uniekId('iau'), invoiceId: inv.id, event: 'bezwaar_klant',
            fromStatus: code, toStatus: 'disputed', detail: v_reden,
            changes: null, aiUsed: false, aiModel: '', actor: tekst(klant.email), createdAt: moment
          });
          demoLog(state, inv.projectId, 'client', 'dispute', 'invoice', inv.id,
            'Bezwaar op factuur ' + (tekst(inv.invoiceNumber) || tekst(inv.label)) + ': ' + v_reden, moment);
          resolve(demoBewaren(state, normInvoice(inv)));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      return c.rpc('dispute_invoice', { p_invoice_id: id, p_reason: v_reden })
        .then(function (res) { return uitkomst(res, 'dispute_invoice'); });
    }).then(normInvoice);
  }

  /* ============================================================
     9. BERICHT STUREN — antwoord in een bestaande draad
     Geen RPC: de klant-insertpolicy "client posts own question_messages"
     (0020) is precies genoeg: eigen draad, author 'client', eigen naam of
     leeg, created_at rond nu. Live schrijft hier bewust GEEN logregel
     (er is geen trigger voor); de demo dus ook niet — pariteit.
     ============================================================ */

  function berichtSturen(question, tekstBody) {
    var id = idVan(question);
    var body = trim(tekstBody);
    /* (3) invoer eerst, in beide modi — er is geen wachtstand: een klant
       mag altijd iets toevoegen aan zijn eigen gesprek */
    if (!body) return Promise.reject(fout('bericht_leeg'));
    if (body.length > MAX_BERICHT) return Promise.reject(fout('bericht_te_lang'));

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          /* (1) wie */
          var klantId = demoKlantId();
          var q = lijstVan(state.questions).filter(function (x) { return x && x.id === id; })[0];
          var p = q ? demoProject(state, q.projectId) : null;
          if (!q || !p || p.clientId !== klantId) throw fout('vraag_niet_gevonden');
          /* (4) schrijven */
          var rij = {
            id: uniekId('qmsg'), questionId: q.id, author: 'client',
            authorName: ST.sessie ? tekst(ST.sessie.contactName) : '',
            body: body, createdAt: nuISO()
          };
          demoLijst(state, 'questionMessages').push(rij);
          resolve(demoBewaren(state, normBericht(rij)));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      /* eerst kijken of de draad bestaat en van ons is — zo krijgt de
         klant 'vraag_niet_gevonden' en niet een kale RLS-fout */
      return c.from('question_threads').select('id, project_id').eq('id', id).maybeSingle()
        .then(function (res) { return uitkomst(res, 'question_threads'); })
        .then(function (q) {
          if (!q) throw fout('vraag_niet_gevonden');
          return c.from('question_messages').insert({
            question_id: id,
            author: 'client',
            /* de policy staat alleen de eigen contactnaam of bedrijfsnaam
               toe, of leeg; een afwijkende naam zou de insert laten
               weigeren, dus liever leeg dan fout */
            author_name: ST.sessie ? tekst(ST.sessie.contactName) : '',
            body: body,
            created_at: nuISO()
          }).select().single();
        })
        .then(function (res) { return uitkomst(res, 'question_messages', { bijPolicy: 'vraag_niet_gevonden' }); });
    }).then(function (rij) { return normBericht(rij); });
  }

  /* ============================================================
     10. VRAAG STELLEN — nieuwe draad
     Bestaat al in portal.html (DS.addQuestion); hier in het contract
     zodat ctx.acties compleet uit één laag komt. Derde argument `media`
     is optioneel (de vraag bij een foto), precies zoals daar.
     ============================================================ */

  function vraagStellen(project, tekstBody, media) {
    var projectId = idVan(project);
    var body = trim(tekstBody);
    var m = isObj(media) ? media : null;
    /* invoer eerst, in beide modi */
    if (!body) return Promise.reject(fout('bericht_leeg'));
    if (body.length > MAX_BERICHT) return Promise.reject(fout('bericht_te_lang'));

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var p = demoEigenProject(state, projectId, 'project_niet_gevonden');
          var q = {
            id: uniekId('q'), projectId: p.id,
            mediaId: m ? (m.id || null) : null,
            stageKey: m ? tekst(m.stageKey) : '',
            question: body, answer: '', askedAt: nuISO(), answeredAt: null
          };
          demoLijst(state, 'questions').push(q);
          resolve(demoBewaren(state, normVraag(q)));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      return c.from('question_threads').insert({
        project_id: projectId,
        media_id: m ? (m.id || null) : null,
        stage_key: m ? tekst(m.stageKey) : '',
        question: body
      }).select().single()
        .then(function (res) { return uitkomst(res, 'question_threads', { bijPolicy: 'project_niet_gevonden' }); });
    }).then(normVraag);
  }

  /* ============================================================
     11. BESTAND AANLEVEREN — in een verwacht documentslot
     Live: het bestand gaat naar bucket klant-upload onder
     {project_id}/{uuid}.{ext} (storage-policy: eigen project), daarna
     een documents-rij met uploaded_by 'klant' en slot_id (insertpolicy:
     eigen project, slot leeg en verwacht, expected_from 'klant', zelfde
     doc_type/stage_key). De trigger documents_fill_slot vult het slot en
     schrijft de logregels. Demo: dezelfde controles, blob in IndexedDB
     via demo-files.js. Een slot dat de STAF levert (expected_from 'staf',
     de standaard van 0021) weigert in beide modi met slot_niet_van_klant
     vóór er iets wordt geüpload.
     ============================================================ */

  function bestandsExtensie(naam) {
    var m = tekst(naam).match(/\.[A-Za-z0-9]+$/);
    return m ? m[0].toLowerCase() : '';
  }

  /* stap (3): het bestand zelf */
  function controleerBestand(bestand) {
    if (!bestand) throw fout('bestand_ontbreekt');
    var size = heelGetalOfNull(bestand.size);
    if (size === 0) throw fout('bestand_leeg');
    if (size !== null && size > UPLOAD_MAX_BYTES) throw fout('bestand_te_groot', size + ' bytes');
    return {
      naam: tekst(bestand.name) || 'bestand',
      type: tekst(bestand.type) || 'application/octet-stream',
      size: size || 0
    };
  }

  function bestandAanleveren(slot, bestand, opmerking) {
    var s = isObj(slot) ? slot : { id: tekst(slot) };
    var v_note = trim(opmerking).slice(0, 2000);

    if (isDemo()) {
      var state, sl, p, info, ref, files;
      return new Promise(function (resolve, reject) {
        try {
          state = demoState();
          /* (1) wie */
          var klantId = demoKlantId();
          sl = lijstVan(state.docSlots).filter(function (x) { return x && x.id === s.id; })[0];
          p = sl ? demoProject(state, sl.projectId) : null;
          if (!sl || !p || p.clientId !== klantId) throw fout('slot_niet_gevonden');
          /* van wie wordt het bestand verwacht? Een slot dat de staf levert
             is geen vraag aan de klant (doc_slots.expected_from; de
             insertpolicy van 0021 eist 'klant') */
          if (tekst(sl.expectedFrom) !== 'klant') throw fout('slot_niet_van_klant');
          /* (2) wachtstand: leeg en verwacht */
          if (sl.status !== 'verwacht' || sl.documentId) throw fout('slot_al_gevuld');
          /* (3) invoer */
          info = controleerBestand(bestand);
          files = root && root.CP_FILES;
          if (!files || !isFunctie(files.putFile)) throw fout('bestandsopslag_ontbreekt');
          var f = eisSchrijven();
          if (f) throw f;
          resolve(null);
        } catch (e) { reject(e); }
      }).then(function () {
        /* het bestand gaat EERST naar IndexedDB; mislukt dat (bv. de
           opslag is vol), dan ontstaat er geen record — zelfde volgorde
           als addDocument in beheer.html */
        ref = uniekId('file');
        return files.putFile(ref, bestand, { kind: 'document', name: info.naam, type: info.type, size: info.size })
          .then(null, function (e) {
            var err = fout('upload_mislukt', e && e.message);
            /* de zin van demo-files.js over een volle opslag is al
               Nederlands en preciezer; die mag door */
            if (e && files.isQuotaError && files.isQuotaError(e)) { err = new Error(e.message); err.code = 'upload_mislukt'; err.nl = true; }
            throw err;
          });
      }).then(function () {
        /* (4) schrijven: document, slot, logregels — en nog één keer de
           wachtstand, want de upload duurde even en het beheer kan het
           slot intussen zelf hebben gevuld (documents_fill_slot doet dat
           live ook: nul rijen geraakt = slot_al_gevuld) */
        if (sl.status !== 'verwacht' || sl.documentId) {
          if (files.deleteFile) files.deleteFile(ref);
          throw fout('slot_al_gevuld');
        }
        var moment = nuISO();
        var d = {
          id: uniekId('doc'), projectId: p.id, stageKey: tekst(sl.stageKey), docType: tekst(sl.docType),
          /* altijd versie 1, net als live: een slot is leeg bij een upload
             (anders slot_al_gevuld), dus dit is per slot de eerste en enige
             aanlevering — een hoger nummer zou een tweede versie beloven
             die het slot niet kent */
          title: info.naam, version: 1,
          shipmentId: null, fileRef: ref, fileName: info.naam, fileSize: info.size, mimeType: info.type,
          publishStatus: 'published', publishedAt: null, scheduledAt: null, fileStale: false,
          uploadedBy: 'klant', clientNote: v_note, slotId: sl.id, storagePath: '',
          createdAt: moment
        };
        demoLijst(state, 'documents').push(d);
        sl.status = 'gevuld';
        sl.documentId = d.id;
        demoLog(state, p.id, 'client', 'upload', 'document', d.id,
          'Bestand aangeleverd door klant: ' + d.title + (v_note ? ' — ' + v_note.slice(0, 300) : ''), moment);
        return demoBewaren(state, normDocument(d));
      });
    }

    var c, slotRij, bestandInfo, pad;
    return eisLive().then(function (cl) {
      c = cl;
      /* (1)+(2): het slot vers lezen — de klant mag zijn eigen doc_slots
         lezen (0005), dus 'niet gevonden' dekt ook 'niet van jou' */
      return c.from('doc_slots').select('*').eq('id', s.id).maybeSingle()
        .then(function (res) { return uitkomst(res, 'doc_slots'); });
    }).then(function (rij) {
      if (!rij) throw fout('slot_niet_gevonden');
      slotRij = camelRij(rij);
      /* dezelfde volgorde als de demo: eerst van wie, dan de wachtstand */
      if (tekst(slotRij.expectedFrom) !== 'klant') throw fout('slot_niet_van_klant');
      if (slotRij.status !== 'verwacht' || slotRij.documentId) throw fout('slot_al_gevuld');
      /* (3) */
      bestandInfo = controleerBestand(bestand);
      pad = slotRij.projectId + '/' + uuidV4() + (bestandsExtensie(bestandInfo.naam) || '.bin');
      return c.storage.from(BUCKET_KLANT).upload(pad, bestand, { contentType: bestandInfo.type, upsert: false });
    }).then(function (up) {
      if (up && up.error) throw vertaalDbFout(up.error, 'upload naar ' + BUCKET_KLANT, { bijPolicy: 'slot_niet_gevonden' });
      /* (4) de documentrij; de trigger vult het slot en logt. Een klant
         mag zijn eigen upload niet verwijderen (bucket: alleen staf), dus
         mislukt de insert, dan blijft er één wees in de bucket staan die
         de staf opruimt — dat staat in het rapport bij deze bouw. */
      return c.from('documents').insert({
        project_id: slotRij.projectId,
        stage_key: slotRij.stageKey,
        doc_type: slotRij.docType,
        title: bestandInfo.naam,
        storage_path: pad,
        version: 1,
        shipment_id: null,
        publish_status: 'published',
        scheduled_at: null,
        published_at: null,
        file_stale: false,
        uploaded_by: 'klant',
        client_note: v_note,
        slot_id: slotRij.id
      }).select().single().then(function (res) {
        return uitkomst(res, 'documents', { bijPolicy: 'slot_al_gevuld' });
      });
    }).then(function (rij) {
      var d = normDocument(rij);
      /* de bestandsmetadata staan live niet op de rij; wat we zeker weten
         reist mee zodat het scherm in beide modi hetzelfde toont */
      d.fileName = d.fileName || bestandInfo.naam;
      d.fileSize = d.fileSize === null ? bestandInfo.size : d.fileSize;
      d.mimeType = d.mimeType || bestandInfo.type;
      d.heeftBestand = true;
      return d;
    });
  }

  /* ============================================================
     12. HERBESTELLEN — request_reorder
     ============================================================ */

  /* stap (3) van de RPC, in dezelfde volgorde */
  function normHerbestelling(o) {
    var x = isObj(o) ? o : {};
    var qty = heelGetalOfNull(x.qty);
    if (qty === null || qty <= 0) throw fout('aantal_ongeldig');
    if (qty > 10000000) throw fout('aantal_ongeldig', 'meer dan tien miljoen stuks');
    var gewenst = null;
    var ruw = x.gewenstOpISO || x.gewenstOp || x.wantedBy || null;
    if (ruw !== null && ruw !== undefined && trim(ruw) !== '') {
      gewenst = dayISO(ruw);
      if (!gewenst) throw fout('invoer_ongeldig', 'gewenste datum onleesbaar');
      var vandaag = vandaagISO();
      if (gewenst < vandaag) throw fout('datum_in_verleden');
      if (gewenst > plusDagen(vandaag, 1095)) throw fout('datum_te_ver');
    }
    var zelfde = (x.zelfdeSpec === undefined || x.zelfdeSpec === null) ? true : !!x.zelfdeSpec;
    var note = trim(x.wijziging === undefined ? x.changeNote : x.wijziging).slice(0, 2000);
    if (!zelfde && !note) throw fout('wijziging_ontbreekt');
    return { qty: qty, gewenst: gewenst, zelfde: zelfde, note: note };
  }

  /* dezelfde regel als project_herbestelbaar() in 0021 en
     projectIsCompleted() in portal.html */
  function projectHerbestelbaar(p) {
    if (!isObj(p)) return false;
    if (p.status === 'archived') return true;
    var st = lijstVan(p.stages);
    return st.length > 0 && st.every(function (s) { return s && s.status === 'done'; });
  }

  function herbestellen(project, opties) {
    var projectId = idVan(project);
    /* invoer vóór eigendom en wachtstand, in beide modi (live: vóór de RPC
       vertrekt) */
    var h;
    try { h = normHerbestelling(opties); } catch (e) { return Promise.reject(e); }

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          /* (1) wie */
          var klantId = demoKlantId();
          var p = demoEigenProject(state, projectId, 'project_niet_gevonden');
          /* (2) wachtstand */
          if (!projectHerbestelbaar(p)) throw fout('project_niet_afgerond');
          /* (3) invoer: al getoetst, zie boven */
          /* (4) schrijven; de guard-trigger van 0021 weigert een tweede
             onaangeraakte aanvraag op hetzelfde project */
          var lijst = demoLijst(state, 'reorderRequests');
          var loopt = lijst.some(function (r) { return r && r.projectId === p.id && r.status === REORDER_STAP_EERSTE; });
          if (loopt) throw fout('herbestelling_loopt_al');
          var moment = nuISO();
          var rij = {
            id: uniekId('reo'), projectId: p.id, clientId: klantId,
            qty: h.qty, wantedBy: h.gewenst, sameSpec: h.zelfde, changeNote: h.note,
            status: REORDER_STAP_EERSTE, createdAt: moment, updatedAt: moment
          };
          lijst.push(rij);
          demoLog(state, p.id, 'client', 'reorder', 'reorder', rij.id,
            'Herbestelling aangevraagd: ' + h.qty + ' stuks'
              + (h.gewenst ? ', gewenst op ' + dagNL(h.gewenst) : '')
              + (h.zelfde ? ', zelfde specificatie' : ', met wijziging: ' + h.note.slice(0, 300)), moment);
          resolve(demoBewaren(state, normReorder(rij)));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      return c.rpc('request_reorder', {
        p_project_id: projectId, p_qty: h.qty, p_wanted_by: h.gewenst,
        p_same_spec: h.zelfde, p_note: h.note
      }).then(function (res) { return uitkomst(res, 'request_reorder'); });
    }).then(normReorder);
  }

  /* ============================================================
     13. EIGEN MENSEN — client_contacts
     Rechtstreeks op de tabel; de RLS van 0021 beperkt alles tot de eigen
     klant. Wat de database als check of unieke index weigert, toetsen we
     hier vooraf in beide modi, zodat de klant een zin krijgt en niet een
     constraintnaam.
     ============================================================ */

  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  function normContactInvoer(contact) {
    var c = isObj(contact) ? contact : {};
    var naam = trim(c.name || c.naam);
    if (!naam) throw fout('naam_ontbreekt');
    var email = trim(c.email).toLowerCase();
    if (email && !EMAIL_RE.test(email)) throw fout('email_ongeldig');
    var toegestaan = mailCategorieen();
    var cats = normCategorieen(c.mailCategories || c.cats);
    for (var i = 0; i < cats.length; i++) {
      if (toegestaan.indexOf(cats[i]) < 0) throw fout('categorie_onbekend', cats[i]);
    }
    return {
      id: c.id ? tekst(c.id) : '',
      name: naam, email: email, role: trim(c.role).slice(0, 120),
      mailCategories: cats, canLogin: !!c.canLogin, avatarUrl: trim(c.avatarUrl)
    };
  }

  function contactpersoonOpslaan(contact) {
    var inv;
    try { inv = normContactInvoer(contact); } catch (e) { return Promise.reject(e); }

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klantId = demoKlantId();
          var lijst = demoLijst(state, 'clientContacts');
          var bestaand = inv.id ? lijst.filter(function (x) { return x && x.id === inv.id; })[0] : null;
          if (inv.id && (!bestaand || bestaand.clientId !== klantId)) throw fout('contact_niet_gevonden');
          /* hetzelfde adres hoogstens één keer per klant (unieke index) */
          if (inv.email && lijst.some(function (x) {
            return x && x.clientId === klantId && x !== bestaand && tekst(x.email).toLowerCase() === inv.email;
          })) throw fout('contact_email_dubbel');
          var moment = nuISO();
          var rij;
          if (bestaand) {
            rij = bestaand;
            rij.name = inv.name; rij.email = inv.email; rij.role = inv.role;
            rij.mailCategories = inv.mailCategories; rij.canLogin = inv.canLogin;
            rij.avatarUrl = inv.avatarUrl; rij.updatedAt = moment;
          } else {
            rij = {
              id: uniekId('cc'), clientId: klantId, name: inv.name, email: inv.email, role: inv.role,
              mailCategories: inv.mailCategories, canLogin: inv.canLogin, avatarUrl: inv.avatarUrl,
              createdAt: moment, updatedAt: moment
            };
            lijst.push(rij);
          }
          /* de auditregel van client_contacts_log(): alleen het staflogboek,
             want een contactpersoon hangt aan de klant en niet aan een
             project (accessLog eist een project) */
          demoLijst(state, 'auditLog').push({
            id: uniekId('aud'), kind: 'klant', clientId: klantId, projectId: null,
            detail: (bestaand ? 'Contactpersoon gewijzigd door klant: ' : 'Contactpersoon toegevoegd door klant: ')
              + rij.name + (rij.email ? ' <' + rij.email + '>' : ''),
            createdAt: moment
          });
          resolve(demoBewaren(state, normContact(rij)));
        } catch (e) { reject(e); }
      });
    }

    var c;
    return eisLive().then(function (cl) { c = cl; return liveKlantId(); }).then(function (klantId) {
      var rij = {
        name: inv.name, email: inv.email, role: inv.role,
        mail_categories: inv.mailCategories, can_login: inv.canLogin, avatar_url: inv.avatarUrl
      };
      var q;
      if (inv.id) {
        q = c.from('client_contacts').update(rij).eq('id', inv.id).eq('client_id', klantId).select().single();
      } else {
        rij.client_id = klantId;
        q = c.from('client_contacts').insert(rij).select().single();
      }
      return q.then(function (res) {
        return uitkomst(res, 'client_contacts', { bijDubbel: 'contact_email_dubbel', bijPolicy: 'contact_niet_gevonden', bijWeg: 'contact_niet_gevonden' });
      });
    }).then(normContact);
  }

  /* geeft de verwijderde rij terug, met verwijderd: true — zo heeft ook
     deze actie "de bijgewerkte rij" als uitkomst en kan een scherm hem
     nog even tonen in een ongedaan-maken-toast */
  function contactpersoonVerwijderen(contact) {
    var id = idVan(contact);
    if (!id) return Promise.reject(fout('contact_niet_gevonden'));

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klantId = demoKlantId();
          var lijst = demoLijst(state, 'clientContacts');
          var rij = lijst.filter(function (x) { return x && x.id === id; })[0];
          if (!rij || rij.clientId !== klantId) throw fout('contact_niet_gevonden');
          state.clientContacts = lijst.filter(function (x) { return x !== rij; });
          demoLijst(state, 'auditLog').push({
            id: uniekId('aud'), kind: 'klant', clientId: klantId, projectId: null,
            detail: 'Contactpersoon verwijderd door klant: ' + tekst(rij.name) + (rij.email ? ' <' + rij.email + '>' : ''),
            createdAt: nuISO()
          });
          var uit = normContact(rij);
          uit.verwijderd = true;
          resolve(demoBewaren(state, uit));
        } catch (e) { reject(e); }
      });
    }

    return eisLive().then(function (c) {
      return c.from('client_contacts').delete().eq('id', id).select();
    }).then(function (res) {
      return uitkomst(res, 'client_contacts', { bijPolicy: 'contact_niet_gevonden' });
    }).then(function (rijen) {
      var rij = lijstVan(rijen)[0];
      if (!rij) throw fout('contact_niet_gevonden');
      var uit = normContact(rij);
      uit.verwijderd = true;
      return uit;
    });
  }

  /* ============================================================
     14. TAAL EN MELDINGEN — de twee voorkeurskolommen op clients
     Live: de update-policy "client updates own prefs" + de trigger
     clients_guard_prefs() uit 0021, die elke andere kolom op slot houdt
     (alleen_voorkeuren_wijzigbaar). Deze laag stuurt dan ook nooit iets
     anders mee dan portal_lang of mail_prefs.
     ============================================================ */

  function taalKiezen(lang) {
    var l = trim(lang).toLowerCase();
    if (TALEN.indexOf(l) < 0) return Promise.reject(fout('taal_onbekend', 'taal: ' + l));

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klant = demoKlant(state);
          klant.portalLang = l;
          if (ST.sessie) ST.sessie.portalLang = l;
          resolve(demoBewaren(state, normKlant(klant)));
        } catch (e) { reject(e); }
      });
    }

    var c;
    return eisLive().then(function (cl) { c = cl; return liveKlantId(); }).then(function (klantId) {
      return c.from('clients').update({ portal_lang: l }).eq('id', klantId).select(KLANT_KOLOMMEN).single()
        .then(function (res) {
          /* zonder gedraaide 0020 ontbreken country/tagline/logo_url —
             dan nog een keer met de oude kolommen, de voorkeur zelf is
             al opgeslagen */
          if (res && res.error && /column|does not exist/i.test(tekst(res.error.message))) {
            return c.from('clients').select(KLANT_KOLOMMEN_OUD).eq('id', klantId).single();
          }
          return res;
        })
        .then(function (res) { return uitkomst(res, 'clients', { bijPolicy: 'alleen_voorkeuren_wijzigbaar', bijWeg: 'niet_ingelogd' }); });
    }).then(function (rij) {
      if (ST.sessie) ST.sessie.portalLang = l;
      return normKlant(rij);
    });
  }

  /* voorkeuren: {fase: true, factuur: false, …} — elke sleutel een
     mailcategorie. Opgeslagen wordt de vorm van 0005: alleen de UITGEZETTE
     categorieën als {"categorie": false}; wat ontbreekt staat aan. */
  function normVoorkeuren(voorkeuren) {
    if (!isObj(voorkeuren)) throw fout('voorkeuren_ongeldig', 'geen object');
    var toegestaan = mailCategorieen();
    var uit = {};
    Object.keys(voorkeuren).forEach(function (k) {
      if (toegestaan.indexOf(k) < 0) throw fout('categorie_onbekend', k);
      if (voorkeuren[k] === false) uit[k] = false;
    });
    return uit;
  }

  function meldingenOpslaan(voorkeuren) {
    var prefs;
    try { prefs = normVoorkeuren(voorkeuren); } catch (e) { return Promise.reject(e); }

    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klant = demoKlant(state);
          klant.mailPrefs = prefs;
          resolve(demoBewaren(state, normKlant(klant)));
        } catch (e) { reject(e); }
      });
    }

    var c;
    return eisLive().then(function (cl) { c = cl; return liveKlantId(); }).then(function (klantId) {
      return c.from('clients').update({ mail_prefs: prefs }).eq('id', klantId).select(KLANT_KOLOMMEN).single()
        .then(function (res) {
          if (res && res.error && /column|does not exist/i.test(tekst(res.error.message))) {
            return c.from('clients').select(KLANT_KOLOMMEN_OUD).eq('id', klantId).single();
          }
          return res;
        })
        .then(function (res) { return uitkomst(res, 'clients', { bijPolicy: 'alleen_voorkeuren_wijzigbaar', bijWeg: 'niet_ingelogd' }); });
    }).then(normKlant);
  }

  /* ============================================================
     15. LEESFUNCTIES
     ============================================================ */

  function mijnKlant() {
    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try { resolve(normKlant(demoKlant(demoState()))); } catch (e) { reject(e); }
      });
    }
    var c;
    return eisLive().then(function (cl) { c = cl; return liveKlantId(); }).then(function (klantId) {
      return c.from('clients').select(KLANT_KOLOMMEN).eq('id', klantId).maybeSingle()
        .then(function (res) {
          if (res && res.error && /column|does not exist/i.test(tekst(res.error.message))) {
            return c.from('clients').select(KLANT_KOLOMMEN_OUD).eq('id', klantId).maybeSingle();
          }
          return res;
        })
        .then(function (res) { return uitkomst(res, 'clients', { bijWeg: 'niet_ingelogd' }); });
    }).then(function (rij) {
      if (!rij) throw fout('niet_ingelogd', 'geen klantrij');
      return normKlant(rij);
    });
  }

  /* De draad van één vraag. `question` mag het vraag-object zijn of een
     id. Zijn er echte berichten maar staat de oorspronkelijke vraag (of
     het oorspronkelijke antwoord) daar niet in — een draad van vóór 0020,
     of een nieuwe vraag waar de klant al op doorging vóór er een
     stafbericht was — dan worden die als VIRTUELE berichten vooraan
     gezet, met hun echte tijdstempels. Zo verdwijnt de vraag nooit uit
     zijn eigen gesprek. Zonder echte berichten is dat precies threadOf()
     uit admin-data.js. */
  function listMessages(question) {
    var q = isObj(question) ? question : null;
    var id = idVan(question);
    if (!id) return Promise.resolve([]);

    var echte;
    if (isDemo()) {
      var state = demoState();
      var eigenQ = lijstVan(state.questions).filter(function (x) { return x && x.id === id; })[0] || null;
      /* eigendom, zoals de RLS van 0020 dat live doet: de draad van een
         andere klant is leeg, niet zichtbaar */
      var eigenP = eigenQ ? demoProject(state, eigenQ.projectId) : null;
      var klantId = ST.sessie ? tekst(ST.sessie.clientId) : '';
      if (!eigenQ || !eigenP || !klantId || eigenP.clientId !== klantId) return Promise.resolve([]);
      if (!q) q = eigenQ;
      echte = Promise.resolve(lijstVan(state.questionMessages).filter(function (m) { return m && m.questionId === id; }));
    } else {
      if (!sb()) return Promise.resolve([]);
      echte = sb().from('question_messages').select('*').eq('question_id', id)
        .then(function (res) { return (res && !res.error) ? lijstVan(res.data) : []; }, function () { return []; });
    }
    return echte.then(function (rijen) {
      var uit = rijen.map(function (m) { return normBericht(m); });
      if (q) {
        var vraag = trim(q.question), antwoord = trim(q.answer);
        var heeftVraag = uit.some(function (m) { return m.author === 'client' && trim(m.body) === vraag; });
        var heeftAntwoord = uit.some(function (m) { return m.author === 'staff' && trim(m.body) === antwoord; });
        if (antwoord && !heeftAntwoord) {
          uit.unshift(normBericht({ id: q.id + ':antwoord', questionId: q.id, author: 'staff', authorName: '', body: antwoord, createdAt: q.answeredAt || q.askedAt || null }, { virtueel: true }));
        }
        if (vraag && !heeftVraag) {
          uit.unshift(normBericht({ id: q.id + ':vraag', questionId: q.id, author: 'client', authorName: ST.sessie ? tekst(ST.sessie.contactName) : '', body: vraag, createdAt: q.askedAt || null }, { virtueel: true }));
        }
      }
      return opMoment(uit, 'createdAt');
    });
  }

  function listContacts() {
    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klantId = demoKlantId();
          var rijen = demoLijst(state, 'clientContacts').filter(function (x) { return x && x.clientId === klantId; }).map(normContact);
          resolve(sorteerContacten(rijen));
        } catch (e) { reject(e); }
      });
    }
    if (!sb()) return Promise.resolve([]);
    return sb().from('client_contacts').select('*')
      .then(function (res) { return (res && !res.error) ? lijstVan(res.data) : []; }, function () { return []; })
      .then(function (rijen) { return sorteerContacten(rijen.map(normContact)); });
  }

  /* op naam in het Nederlands, in beide modi in JavaScript — nooit
     order('name') aan de databasekant (twee collaties, twee lijsten) */
  function sorteerContacten(rijen) {
    return stabielSorteren(rijen, function (a, b) {
      return cmpNaam(a.name, b.name) || cmpMoment(a.createdAt, b.createdAt);
    });
  }

  function listReorders(project) {
    var projectId = project ? idVan(project) : '';
    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klantId = demoKlantId();
          var rijen = demoLijst(state, 'reorderRequests').filter(function (r) {
            return r && r.clientId === klantId && (!projectId || r.projectId === projectId);
          }).map(normReorder);
          resolve(opMoment(rijen, 'createdAt'));
        } catch (e) { reject(e); }
      });
    }
    if (!sb()) return Promise.resolve([]);
    var q = sb().from('reorder_requests').select('*');
    if (projectId) q = q.eq('project_id', projectId);
    return q.then(function (res) { return (res && !res.error) ? lijstVan(res.data) : []; }, function () { return []; })
      .then(function (rijen) { return opMoment(rijen.map(normReorder), 'createdAt'); });
  }

  /* de door de klant gemelde betalingen op zijn eigen factuur, bevestigd
     én onbevestigd, in de smalle projectie — live via
     client_payment_reports() (de tabel zelf is staff-only sinds 0012) */
  function listClientPayments(invoice) {
    var id = idVan(invoice);
    if (!id) return Promise.resolve([]);
    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klantId = demoKlantId();
          var inv = lijstVan(state.invoices).filter(function (x) { return x && x.id === id; })[0];
          var p = inv ? demoProject(state, inv.projectId) : null;
          if (!inv || !p || p.clientId !== klantId) throw fout('factuur_niet_gevonden');
          var rijen = demoLijst(state, 'invoicePayments').filter(function (x) {
            return x && x.invoiceId === id && x.reportedByClient;
          }).map(normBetaling);
          resolve(opMoment(rijen, 'createdAt'));
        } catch (e) { reject(e); }
      });
    }
    return eisLive().then(function (c) {
      return c.rpc('client_payment_reports', { p_invoice_id: id })
        .then(function (res) { return uitkomst(res, 'client_payment_reports'); });
    }).then(function (data) {
      return opMoment(lijstVan(data).map(normBetaling), 'createdAt');
    });
  }

  /* JOUW CONTACTPERSOON BIJ CUSTOM+ (spec §1 regel 8) — naam, rol en
     avatar; geen e-mail of telefoon zonder dat de eigenaar dat wil.
       demo : het teamlid uit teamMembers wiens naam gelijk is aan
              project.lead, anders de eigenaar, anders het eerste actieve
              lid. E-mail alleen als settings.klantContactToonEmail waar is.
       live : team_members is staff-only (0020) en admin_settings ook —
              de klant kan er niet bij. Wat er wél is: projects.lead, de
              naam van de projectleider op zijn eigen projectrij. Die wordt
              dan de contactpersoon, zonder rol, avatar of e-mail. Een
              contactpersoon met foto vereist live een kleine
              security-definer leesfunctie; die staat niet in 0021 en dit
              bestand doet niet alsof hij er wel is.
     `bron` zegt eerlijk waar de gegevens vandaan komen: 'team',
     'project' of null (niets bekend → het scherm toont de lege stand). */
  function mijnContact(project) {
    var p = isObj(project) ? project : null;
    var lead = p ? trim(p.lead) : '';

    function uitTeam(leden, toonEmail) {
      var actief = lijstVan(leden).filter(function (t) { return t && (tekst(t.status) || 'actief') === 'actief'; });
      var hit = null;
      if (lead) hit = actief.filter(function (t) { return trim(t.name) === lead; })[0] || null;
      if (!hit) hit = actief.filter(function (t) { return t.role === 'eigenaar'; })[0] || null;
      if (!hit) hit = actief[0] || null;
      if (!hit) return null;
      return {
        id: hit.id || null,
        name: tekst(hit.name),
        role: tekst(hit.role),
        roleLabel: rolLabel(tekst(hit.role)),
        avatarUrl: tekst(hit.avatarUrl),
        initialen: initialen(hit.name),
        email: toonEmail ? tekst(hit.email) : null,
        bron: 'team'
      };
    }
    function uitProject() {
      if (!lead) return null;
      return { id: null, name: lead, role: '', roleLabel: '', avatarUrl: '', initialen: initialen(lead), email: null, bron: 'project' };
    }

    if (isDemo()) {
      var state = demoState();
      var inst = demoInstellingen(state);
      return Promise.resolve(uitTeam(demoLijst(state, 'teamMembers'), inst.klantContactToonEmail === true) || uitProject());
    }
    if (!sb()) return Promise.resolve(uitProject());
    return sb().from('team_members').select('id, name, role, status, avatar_url')
      .then(function (res) { return (res && !res.error) ? lijstVan(res.data).map(camelRij) : []; }, function () { return []; })
      .then(function (leden) { return uitTeam(leden, false) || uitProject(); });
  }

  /* ============================================================
     16. FACTUUR-PDF — het bestaande factuurdocument
     Het portaal kent geen eigen PDF-generatie: de PDF van een factuur is
     het documentrecord dat het beheer eraan koppelt (invoice.documentId)
     en dat pas een bestand heeft zodra het is geüpload. Tot die tijd
     zegt het portaal "PDF volgt", en dat zegt deze functie dus ook —
     met beschikbaar: false, nooit een link die alleen een fout kan geven.
     Een geslaagde ophaling schrijft de downloadregel in het
     toegangslogboek, precies zoals handleDownload() in portal.html.
     ============================================================ */

  function factuurPdf(invoice) {
    var inv = isObj(invoice) ? invoice : null;
    var id = idVan(invoice);

    function nietBeschikbaar(doc, reden) {
      return { beschikbaar: false, url: null, bestandsnaam: null, reden: reden, document: doc ? normDocument(doc) : null, logRegel: null };
    }

    if (isDemo()) {
      var state = demoState();
      var klantId;
      try { klantId = demoKlantId(); } catch (e) { return Promise.reject(e); }
      if (!inv) inv = lijstVan(state.invoices).filter(function (x) { return x && x.id === id; })[0] || null;
      var p = inv ? demoProject(state, inv.projectId) : null;
      if (!inv || !p || p.clientId !== klantId) return Promise.reject(fout('factuur_niet_gevonden'));
      var doc = inv.documentId ? lijstVan(state.documents).filter(function (d) { return d && d.id === inv.documentId; })[0] : null;
      if (!doc) return Promise.resolve(nietBeschikbaar(null, 'geen_document'));
      var files = root && root.CP_FILES;
      if (!doc.fileRef || !files || !isFunctie(files.fileUrl)) return Promise.resolve(nietBeschikbaar(doc, 'pdf_volgt'));
      return files.fileUrl(doc.fileRef).then(function (url) {
        if (!url) return nietBeschikbaar(doc, 'bestand_niet_in_deze_browser');
        var rij = demoLog(state, inv.projectId, 'client', 'download', 'document', doc.id, tekst(doc.title));
        return demoBewaren(state, {
          beschikbaar: true, url: url, bestandsnaam: doc.fileName || doc.title || 'factuur.pdf',
          reden: null, document: normDocument(doc), logRegel: kopie(rij)
        });
      });
    }

    var c, docRij;
    return eisLive().then(function (cl) {
      c = cl;
      if (inv && inv.documentId === null) return null;
      if (inv && inv.documentId) return { document_id: inv.documentId, project_id: inv.projectId };
      return c.from('invoices').select('id, project_id, document_id').eq('id', id).maybeSingle()
        .then(function (res) { return uitkomst(res, 'invoices'); });
    }).then(function (rij) {
      if (rij === null && !inv) throw fout('factuur_niet_gevonden');
      if (!rij || !rij.document_id) return null;
      return c.from('documents').select('*').eq('id', rij.document_id).maybeSingle()
        .then(function (res) { return uitkomst(res, 'documents'); });
    }).then(function (d) {
      if (!d) return nietBeschikbaar(null, 'geen_document');
      docRij = camelRij(d);
      if (!docRij.storagePath) return nietBeschikbaar(docRij, 'pdf_volgt');
      var bucket = docRij.uploadedBy === 'klant' ? BUCKET_KLANT : BUCKET_STAF;
      return c.storage.from(bucket).createSignedUrl(docRij.storagePath, 900).then(function (res) {
        if (!res || res.error || !res.data || !res.data.signedUrl) return nietBeschikbaar(docRij, 'ophalen_mislukt');
        var url = res.data.signedUrl;
        var projectId = docRij.projectId || (inv && inv.projectId) || null;
        /* loggen mag een download nooit blokkeren */
        return c.from('access_log').insert({
          project_id: projectId, actor: 'client', asset_kind: 'document',
          asset_id: docRij.id, action: 'download', detail: tekst(docRij.title)
        }).select().single().then(function (r2) {
          return (r2 && !r2.error && r2.data) ? camelRij(r2.data) : null;
        }, function () { return null; }).then(function (logRij) {
          return {
            beschikbaar: true, url: url,
            bestandsnaam: (docRij.title ? docRij.title + (bestandsExtensie(docRij.title) ? '' : '.pdf') : 'factuur.pdf'),
            reden: null, document: normDocument(docRij), logRegel: logRij
          };
        });
      });
    });
  }

  /* ============================================================
     17. DOWNLOAD ALLES — de dossier-export zonder interne velden
     Geeft GEEN bestand maar een exportobject plus de JSON ervan; het
     scherm maakt de Blob en de downloadlink (deze laag heeft geen DOM).
     Er reist niets mee dat de klant niet ook in het portaal ziet: geen
     interne notities, geen bevroren factuurinhoud, geen opslagpaden,
     geen betaalbewijzen. Live komt alles door de RLS van de klant zelf;
     de zeef INTERNE_VELDEN gaat er in beide modi overheen.
     ============================================================ */

  function zeef(rijen) {
    return lijstVan(rijen).map(function (r) { return zonderIntern(camelRij(r)); });
  }

  function exportVorm(klant, projecten, contacten, herbestellingen) {
    var moment = nuISO();
    var slug = trim(klant.company).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'klant';
    var uit = {
      gegenereerdOp: moment,
      bron: 'CUSTOM+ klantportaal',
      versie: VERSION,
      klant: klant,
      projecten: projecten,
      contactpersonen: contacten,
      herbestellingen: herbestellingen
    };
    return {
      bestandsnaam: 'customplus-dossier-' + slug + '-' + dayISO(moment) + '.json',
      mime: 'application/json',
      gegenereerdOp: moment,
      aantalProjecten: projecten.length,
      export: uit,
      json: JSON.stringify(uit, null, 2)
    };
  }

  function downloadAlles() {
    if (isDemo()) {
      return new Promise(function (resolve, reject) {
        try {
          var state = demoState();
          var klant = demoKlant(state);
          var klantId = klant.id;
          var projecten = lijstVan(state.projects).filter(function (p) { return p && p.clientId === klantId; });
          var ids = {};
          projecten.forEach(function (p) { ids[p.id] = true; });
          function vanProject(sleutel) {
            return zeef(lijstVan(state[sleutel]).filter(function (r) { return r && ids[r.projectId]; }));
          }
          var vragen = vanProject('questions');
          var vraagIds = {};
          vragen.forEach(function (q) { vraagIds[q.id] = true; });
          var berichten = zeef(lijstVan(state.questionMessages).filter(function (m) { return m && vraagIds[m.questionId]; }));
          var zendingen = vanProject('shipments');
          var zendIds = {};
          zendingen.forEach(function (s) { zendIds[s.id] = true; });
          var events = zeef(lijstVan(state.shipmentEvents).filter(function (e) { return e && zendIds[e.shipmentId]; }));
          var alles = {
            media: vanProject('media'), documents: vanProject('documents'), invoices: vanProject('invoices').map(function (i) { return i; }),
            samples: vanProject('samples'), inspections: vanProject('inspections'), questions: vragen,
            questionMessages: berichten, accessLog: vanProject('accessLog'), disclosures: vanProject('disclosures'),
            docSlots: vanProject('docSlots'), shipments: zendingen, shipmentEvents: events
          };
          var per = projecten.map(function (p) {
            var pr = zonderIntern(kopie(p));
            var stages = lijstVan(p.stages).map(function (s) { return normStage(s, p.id); });
            delete pr.stages;
            var blok = { project: pr, stages: stages };
            Object.keys(alles).forEach(function (k) {
              var eigen = alles[k].filter(function (r) {
                if (k === 'questionMessages') return vragen.some(function (q) { return q.id === r.questionId && q.projectId === p.id; });
                if (k === 'shipmentEvents') return zendingen.some(function (s) { return s.id === r.shipmentId && s.projectId === p.id; });
                return r.projectId === p.id;
              });
              blok[k] = eigen;
            });
            /* conceptmedia en -documenten bestaan voor de klant niet */
            blok.media = blok.media.filter(function (m) { return m.publishStatus !== 'concept'; });
            blok.documents = blok.documents.filter(function (d) { return d.publishStatus !== 'concept'; });
            /* een factuur bestaat voor de klant pas als owns_invoice (0008)
               hem ziet: gepubliceerd én niet draft of scheduled — dezelfde
               zeef als betalingMelden, bezwaarMaken en activiteitVoorKlant */
            blok.invoices = blok.invoices.filter(function (i) {
              var code = statusCodeVan(i);
              return i.publishStatus !== 'concept' && code !== 'draft' && code !== 'scheduled';
            }).map(normInvoice);
            blok.samples = blok.samples.map(normSample);
            blok.documents = blok.documents.map(normDocument);
            blok.docSlots = blok.docSlots.map(normSlot);
            return blok;
          });
          var contacten = demoLijst(state, 'clientContacts').filter(function (x) { return x && x.clientId === klantId; }).map(normContact);
          var herbestellingen = demoLijst(state, 'reorderRequests').filter(function (x) { return x && x.clientId === klantId; }).map(normReorder);
          resolve(exportVorm(normKlant(klant), per, sorteerContacten(contacten), opMoment(herbestellingen, 'createdAt')));
        } catch (e) { reject(e); }
      });
    }

    var c, klant;
    return eisLive().then(function (cl) { c = cl; return mijnKlant(); }).then(function (k) {
      klant = k;
      return c.from('projects').select('*').eq('client_id', k.id).then(function (res) { return uitkomst(res, 'projects'); });
    }).then(function (projRijen) {
      var projecten = lijstVan(projRijen).map(camelRij);
      var ids = projecten.map(function (p) { return p.id; });
      if (!ids.length) return exportVorm(klant, [], [], []);
      function tol(q) { return q.then(function (res) { return (res && !res.error) ? lijstVan(res.data) : []; }, function () { return []; }); }
      function per(tabel) { return tol(c.from(tabel).select('*').in('project_id', ids)); }
      return Promise.all([
        per('project_stages'), per('media_assets'), per('documents'), per('invoices'), per('sample_rounds'),
        per('inspection_reports'), per('question_threads'), per('access_log'), per('file_disclosures'),
        per('doc_slots'), per('shipments'), tol(c.from('reorder_requests').select('*')),
        tol(c.from('client_contacts').select('*'))
      ]).then(function (r) {
        var vragen = zeef(r[6]);
        var vraagIds = vragen.map(function (q) { return q.id; });
        var zendingen = zeef(r[10]);
        var zendIds = zendingen.map(function (s) { return s.id; });
        return Promise.all([
          vraagIds.length ? tol(c.from('question_messages').select('*').in('question_id', vraagIds)) : Promise.resolve([]),
          zendIds.length ? tol(c.from('shipment_events').select('*').in('shipment_id', zendIds)) : Promise.resolve([])
        ]).then(function (r2) {
          var berichten = zeef(r2[0]), events = zeef(r2[1]);
          var blokken = projecten.map(function (p) {
            var pr = zonderIntern(p);
            function eigen(rijen) { return zeef(rijen).filter(function (x) { return x.projectId === p.id; }); }
            var eigenVragen = vragen.filter(function (q) { return q.projectId === p.id; });
            var eigenZend = zendingen.filter(function (s) { return s.projectId === p.id; });
            return {
              project: pr,
              stages: eigen(r[0]).map(function (s) { return normStage(s, p.id); }),
              media: eigen(r[1]),
              documents: eigen(r[2]).map(normDocument),
              invoices: eigen(r[3]).map(normInvoice),
              samples: eigen(r[4]).map(normSample),
              inspections: eigen(r[5]),
              questions: eigenVragen,
              questionMessages: berichten.filter(function (m) { return eigenVragen.some(function (q) { return q.id === m.questionId; }); }),
              accessLog: eigen(r[7]),
              disclosures: eigen(r[8]),
              docSlots: eigen(r[9]).map(normSlot),
              shipments: eigenZend,
              shipmentEvents: events.filter(function (e) { return eigenZend.some(function (s) { return s.id === e.shipmentId; }); })
            };
          });
          var contacten = sorteerContacten(lijstVan(r[12]).map(normContact));
          var herbestellingen = opMoment(lijstVan(r[11]).map(normReorder), 'createdAt');
          return exportVorm(klant, blokken, contacten, herbestellingen);
        });
      });
    });
  }

  /* ============================================================
     18. PARITEIT — de sleutels die elke actie in BEIDE modi garandeert
     De rookproef in de scratchpad controleert per actie dat de uitkomst
     minstens deze sleutels draagt; de live-tak eindigt op dezelfde
     normalisator, dus daar geldt hetzelfde.
     ============================================================ */

  var VORMEN = {
    akkoordGeven: ['id', 'projectId', 'stageKey', 'position', 'status', 'paymentPct', 'approvedAt', 'approvedBy', 'approvedVia'],
    sampleBeoordelen: ['id', 'projectId', 'roundLabel', 'mediaId', 'status', 'note', 'roundDate', 'clientDecision', 'clientNote', 'clientDecidedAt', 'clientMarks'],
    betalingMelden: ['id', 'projectId', 'stageKey', 'label', 'invoiceNumber', 'currency', 'status', 'statusCode', 'docKind', 'publishStatus', 'amountCents', 'totalCents', 'vatCents', 'paidCents', 'creditedCents', 'outstandingCents', 'dueDate', 'documentId', 'reminderPaused', 'createdAt', 'paidAt', 'publishedAt', 'updatedAt', 'gemeldeBetaling'],
    bezwaarMaken: ['id', 'projectId', 'stageKey', 'label', 'invoiceNumber', 'currency', 'status', 'statusCode', 'docKind', 'publishStatus', 'amountCents', 'totalCents', 'vatCents', 'paidCents', 'creditedCents', 'outstandingCents', 'dueDate', 'documentId', 'reminderPaused', 'createdAt', 'paidAt', 'publishedAt', 'updatedAt'],
    berichtSturen: ['id', 'questionId', 'author', 'authorName', 'body', 'createdAt', 'virtueel'],
    vraagStellen: ['id', 'projectId', 'mediaId', 'stageKey', 'question', 'answer', 'askedAt', 'answeredAt'],
    bestandAanleveren: ['id', 'projectId', 'stageKey', 'docType', 'title', 'version', 'shipmentId', 'publishStatus', 'uploadedBy', 'clientNote', 'slotId', 'fileName', 'fileSize', 'mimeType', 'heeftBestand', 'createdAt'],
    herbestellen: ['id', 'projectId', 'clientId', 'qty', 'wantedBy', 'sameSpec', 'changeNote', 'status', 'createdAt', 'updatedAt'],
    contactpersoonOpslaan: ['id', 'clientId', 'name', 'email', 'role', 'mailCategories', 'canLogin', 'avatarUrl', 'initialen', 'createdAt', 'updatedAt'],
    contactpersoonVerwijderen: ['id', 'clientId', 'name', 'email', 'role', 'mailCategories', 'canLogin', 'avatarUrl', 'initialen', 'createdAt', 'updatedAt', 'verwijderd'],
    taalKiezen: ['id', 'company', 'contactName', 'email', 'phone', 'portalLang', 'mailPrefs', 'meldingen', 'createdAt'],
    meldingenOpslaan: ['id', 'company', 'contactName', 'email', 'phone', 'portalLang', 'mailPrefs', 'meldingen', 'createdAt'],
    downloadAlles: ['bestandsnaam', 'mime', 'gegenereerdOp', 'aantalProjecten', 'export', 'json'],
    factuurPdf: ['beschikbaar', 'url', 'bestandsnaam', 'reden', 'document', 'logRegel'],
    listMessages: ['id', 'questionId', 'author', 'authorName', 'body', 'createdAt', 'virtueel'],
    listContacts: ['id', 'clientId', 'name', 'email', 'role', 'mailCategories', 'canLogin', 'avatarUrl', 'initialen', 'createdAt', 'updatedAt'],
    listReorders: ['id', 'projectId', 'clientId', 'qty', 'wantedBy', 'sameSpec', 'changeNote', 'status', 'createdAt', 'updatedAt'],
    listClientPayments: ['id', 'invoiceId', 'paidOn', 'amountCents', 'currency', 'clientReference', 'reportedByClient', 'verifiedAt', 'createdAt'],
    mijnContact: ['id', 'name', 'role', 'roleLabel', 'avatarUrl', 'initialen', 'email', 'bron'],
    mijnKlant: ['id', 'company', 'contactName', 'email', 'phone', 'portalLang', 'mailPrefs', 'meldingen', 'createdAt']
  };

  /* heeft `rij` alle sleutels die VORMEN[actie] belooft? Geeft de lijst
     ontbrekende sleutels terug (leeg = in orde). */
  function controleerVorm(actie, rij) {
    var verwacht = VORMEN[actie] || [];
    var mist = [];
    verwacht.forEach(function (k) {
      if (!isObj(rij) || !Object.prototype.hasOwnProperty.call(rij, k)) mist.push(k);
    });
    return mist;
  }

  /* ============================================================
     19. EXPORT — deze tabel is de hele API (zie kopblok)
     ============================================================ */
  return {
    VERSION: VERSION,
    init: init,
    modus: modus,
    gekoppeld: gekoppeld,
    setSessie: setSessie,
    sessie: sessie,

    /* het actiecontract */
    akkoordGeven: akkoordGeven,
    sampleBeoordelen: sampleBeoordelen,
    betalingMelden: betalingMelden,
    bezwaarMaken: bezwaarMaken,
    berichtSturen: berichtSturen,
    vraagStellen: vraagStellen,
    bestandAanleveren: bestandAanleveren,
    herbestellen: herbestellen,
    contactpersoonOpslaan: contactpersoonOpslaan,
    contactpersoonVerwijderen: contactpersoonVerwijderen,
    taalKiezen: taalKiezen,
    meldingenOpslaan: meldingenOpslaan,
    downloadAlles: downloadAlles,
    factuurPdf: factuurPdf,

    /* leesfuncties */
    listMessages: listMessages,
    listContacts: listContacts,
    listReorders: listReorders,
    listClientPayments: listClientPayments,
    mijnContact: mijnContact,
    mijnKlant: mijnKlant,

    /* fouten */
    FOUTCODES: FOUTCODES,
    fout: fout,
    berichtVoorFout: berichtVoorFout,
    vertaalDbFout: vertaalDbFout,

    /* constanten en hulpjes die de schermen delen */
    TALEN: TALEN,
    DEMO_COLLECTIES: DEMO_COLLECTIES,
    INTERNE_VELDEN: INTERNE_VELDEN,
    UPLOAD_MAX_BYTES: UPLOAD_MAX_BYTES,
    MAX_MARKERINGEN: MAX_MARKERINGEN,
    BUCKET_KLANT: BUCKET_KLANT,
    VORMEN: VORMEN,
    controleerVorm: controleerVorm,
    statusCodeVan: statusCodeVan,
    projectHerbestelbaar: projectHerbestelbaar,
    mailCategorieen: mailCategorieen,
    dayISO: dayISO,
    initialen: initialen
  };
});
