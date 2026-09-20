/* CUSTOM+ — klant-rekenlaag van het portaal (window.CP_PORTAAL).
   ------------------------------------------------------------------
   DIT BESTAND WEET NIETS VAN HET SCHERM. Geen document, geen window,
   geen localStorage, geen i18nT en geen Date.now() als stilzwijgende
   standaard: elke functie die "nu" nodig heeft krijgt hem als parameter,
   zodat een test de klok kan vastzetten. De enige twee dingen die het
   leest, als ze er zijn, zijn CP_MODEL (portal/admin-model.js) en
   CP_STATUS (portal/status.js) — en ontbreken die, dan werkt alles nog
   met een eigen terugval die woordelijk hetzelfde zegt.

   WAAROM DIT DE TEGENHANGER VAN CP_MODEL IS EN GEEN KOPIE
   CP_MODEL beantwoordt de vraag van het beheer: "wat speelt er en wie is
   aan zet?" (collectInbox, nextDateFor, mergeActivity). Dit bestand
   beantwoordt precies dezelfde vraag vanaf de andere kant van de tafel:
   "wat heeft Steffan van MIJ nodig, welke datums gaan MIJ aan, en welk
   deel van de tijdlijn mag IK zien?" Elke wachtstand die het beheer kent
   (fase op akkoord, sampleronde beoordeeld, factuur gepubliceerd, draad
   met de bal bij de klant, documentslot verwacht, afgerond product) heeft
   hier zijn spiegelbeeld, en de KNOPPEN erbij: elk item draagt de naam
   van de actie uit het actiecontract (akkoordGeven, sampleBeoordelen,
   betalingMelden, berichtSturen, bestandAanleveren, herbestellen).

   DE VOLGENDE STAP VAN nextStep() BLIJFT DE WAARHEID
   portal.html kent al een cockpit met een vaste prioriteit — sample →
   factuur → vraag → foto's → niets — en zinnen uit CP_STATUS.templates.
   Die prioriteit en die zinnen worden hier niet herschreven maar
   hergebruikt: watWeNodigHebben() sorteert in dezelfde volgorde en spreekt
   met dezelfde sjablonen waar die bestaan (sampleAwait, stageAwaiting,
   invoiceOne). Wat hier bijkomt is de lijst in plaats van het ene item,
   en per item de knop.

   MEERTALIGHEID — DE ENE AFSPRAAK DIE ALLES VERKLAART
   Het portaal is viertalig en dit bestand kent geen i18nT. Daarom levert
   elke functie NEDERLANDSE BRONSTRINGEN (= i18n-sleutels) en losse
   plaatshouderwaarden, en vertaalt het SCHERM:

       i18nTpl(item.titel, item.vars)

   Vier regels voor wie een item tekent:
     1. item.titel, item.sub en item.actieLabel zijn sjablonen met
        {plaatshouders}; item.vars bevat de waarden. Alles in vars is
        kale tekst of een getal dat zonder opmaak op het scherm mag.
     2. DATUMS EN BEDRAGEN ZITTEN NOOIT IN vars. Die staan als feit op
        het item (datumISO, vervaltISO, cents, valuta) en het scherm
        formatteert ze in de taal van de klant vóór het invullen. Een
        sjabloon met {datum} verwacht dus dat het scherm vars aanvult:
            i18nTpl(item.sub, CP_PORTAAL.metVars(item.vars, { datum: fmtDate(item.datumISO) }))
        Zo kan een vergeten opmaak nooit '2026-09-26' of '18750' tonen.
     3. item.detail is DATA (een notitie van Steffan, een factuurlabel,
        de vraagtekst) en gaat NIET door i18nT — het scherm zet er
        data-no-i18n op, precies zoals portal.html dat vandaag doet.
     4. vars.fase is de fasenaam zoals opties.stageLabel hem gaf, en
        vars.faseSleutel de kale sleutel ('tooling'). Het portaal vertaalt
        fasenamen zelf (i18nT(stageName(sleutel))); een scherm dat dat wil,
        overschrijft vars.fase via metVars(). Zonder stageLabel staat de
        kale sleutel in vars.fase — zichtbaar onaf, nooit een verzonnen
        vertaling (dezelfde afspraak als stageLabeler() in CP_MODEL).

   DRIE AFSPRAKEN DIE DE REST VAN HET BESTAND VERKLAREN
     · NIETS CRASHT OP ONTBREKENDE DATA. Elke lijst mag ontbreken, elk
       veld mag leeg zijn. Een lege bundel levert een lege lijst op.
     · SORTEREN IS STABIEL. Elke sortering eindigt op een tekstsleutel,
       zodat twee renders nooit van volgorde wisselen.
     · GELD IS EEN GEHEEL GETAL IN CENTEN. Nergens een kommagetal.

   Publieke API (globalThis.CP_PORTAAL, en module.exports in Node). Deze
   lijst volgt de exporttabel onderaan exact:
     VERSION
     VERS_DAGEN                  de "recent"-grens van het portaal (7 dagen)
     SOORTEN_NODIG               de zes soorten van de Inbox, met label
     ACTIES                      de namen uit het actiecontract
     ROLLEN_CONTACT              de zes mailcategorieën (sleutels = beheer)
     KLANT_DOC_TYPES             documentslots die de KLANT vult
     REORDER_STAGES              de vier pijplijnstappen (spiegel van CP_MODEL)
     FASE_SLEUTELS               de zes fasesleutels in volgorde (ronde 3)
     watWeNodigHebben(bundle, nu, opties)
     aantalNodig(bundle, nu, opties)
     belangrijkeDatums(bundle, nu, opties)
     voortgang(project, stages)
     activiteitVoorKlant(bronnen, scope)
     factuurStatusVoorKlant(invoice, nu, opties)   opties.gemeld = onbevestigde meldingen
     openstaandCents(invoices, valuta) / openstaandPerValuta(invoices)
     volgendeBetaling(invoices, nu)
     reorderStand(request)
     faseKort(stageKey, langeNaam) / faseUitleg(stageKey)   ronde 3
     geldKlant(cents, currency)                             ronde 3
     datumKort(iso, nu) / datumKortDelen(iso, nu)           ronde 3
     verwachteLevering(bundle, projectId)                   ronde 3
     begroeting(bundle, nu, opties)                         ronde 3
     vul(tpl, vars) / metVars(vars, extra)
     dayISO / daysBetween

   LADEN
     browser : <script src="portal/portaal-model.js"></script> ná
               portal/admin-model.js en portal/status.js — het bestand
               zet zichzelf op globalThis als CP_PORTAAL.
     node    : import '../portal/portaal-model.js' (of require) — het zet
               zichzelf óók op module.exports, dus een test kan het
               gewoon importeren.
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_PORTAAL = api;
  /* Node/CommonJS: geen package.json met "type":"module", dus dit bestand
     is daar CJS en dit is een echte export. Als ESM bestaat `module` niet
     en blijft alleen globalThis over — zelfde recept als admin-model.js. */
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '1.0.0';

  /* "Recent" in het portaal is zeven dagen. Dat getal is niet nieuw: nextStep()
     in portal.html telt foto's als "nieuw" zolang ze jonger zijn dan zeven
     dagen. Dezelfde grens geldt hier voor twee dingen: een item zonder
     vervaldatum wordt na zeven dagen urgent, en een reactie van Steffan
     in een gesprek is zeven dagen lang een uitnodiging om te antwoorden. */
  var VERS_DAGEN = 7;

  /* ============================================================
     0. KALE HULPJES
     Bewust eigen exemplaren, niet gedeeld met portal.html: dit bestand mag
     nergens van afhangen, anders is het niet los te testen.
     ============================================================ */

  function list(v) { return Array.isArray(v) ? v : []; }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isFn(v) { return typeof v === 'function'; }

  /* geheel aantal centen of 0 — een kommagetal wordt afgerond, nooit
     doorgerekend, en een onleesbare waarde telt als niets */
  function cents(v) {
    if (v === null || v === undefined || v === '') return 0;
    var n = Number(v);
    return isFinite(n) ? Math.round(n) : 0;
  }

  function MODEL() { return (root && isObj(root.CP_MODEL)) ? root.CP_MODEL : null; }
  function STATUS() { return (root && isObj(root.CP_STATUS)) ? root.CP_STATUS : null; }

  function pad2(n) { var s = String(n); return s.length < 2 ? '0' + s : s; }
  function pad4(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }

  /* stabiel sorteren zonder op de motor te vertrouwen (zie CP_MODEL) */
  function stableSort(arr, cmp) {
    var wrapped = list(arr).map(function (v, i) { return { v: v, i: i }; });
    wrapped.sort(function (a, b) {
      var r = cmp(a.v, b.v);
      if (r) return r;
      return a.i - b.i;
    });
    return wrapped.map(function (w) { return w.v; });
  }

  /* geen localeCompare: die kan per motor een andere volgorde geven, en
     een lijst moet in Node hetzelfde staan als in de browser */
  function cmpText(a, b) {
    var x = str(a), y = str(b);
    if (x === y) return 0;
    return x < y ? -1 : 1;
  }

  /* ============================================================
     1. DATUM EN TIJD — dezelfde lezing als CP_MODEL.dateParts

     Een kale dag ('2026-09-26') wordt LETTERLIJK gelezen en gaat nooit
     door new Date(): in sommige motoren wordt dat UTC-middernacht en
     schuift de dag in Nederland een dag terug. Alleen een tijdstempel met
     Z of een verschuiving gaat via Date naar lokale tijd. Dit staat hier
     als eigen exemplaar zodat het bestand zonder CP_MODEL testbaar blijft;
     de regels zijn woordelijk dezelfde.
     ============================================================ */

  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|z|[+-]\d{2}:?\d{2})?)?$/;

  function dateParts(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'object' && isFn(v.getTime)) {
      if (isNaN(v.getTime())) return null;
      return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate(), hh: v.getHours(), mm: v.getMinutes(), hasTime: true };
    }
    var s = str(v);
    var m = s.match(ISO_RE);
    if (m) {
      if (!m[7]) {
        var mo = +m[2], da = +m[3];
        if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
        return { y: +m[1], m: mo, d: da, hh: m[4] ? +m[4] : 0, mm: m[5] ? +m[5] : 0, hasTime: !!m[4] };
      }
      var dz = new Date(s);
      if (isNaN(dz.getTime())) return null;
      return { y: dz.getFullYear(), m: dz.getMonth() + 1, d: dz.getDate(), hh: dz.getHours(), mm: dz.getMinutes(), hasTime: true };
    }
    var d2 = new Date(s);
    if (isNaN(d2.getTime())) return null;
    return { y: d2.getFullYear(), m: d2.getMonth() + 1, d: d2.getDate(), hh: d2.getHours(), mm: d2.getMinutes(), hasTime: true };
  }

  /* 'YYYY-MM-DD' of null — de vorm waarin de hele app dagen vergelijkt.
     ISO-dagen sorteren alfabetisch gelijk aan chronologisch, dus een
     tekstvergelijking op deze vorm is exact. */
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

  /* "nu" is altijd een parameter; deze terugval bestaat alleen zodat een
     aanroeper hem mág weglaten, nooit zodat een test hem niet kan zetten */
  function todayOf(nu) {
    return dayISO(nu) || dayISO(new Date());
  }

  /* geheel aantal kalenderdagen van a naar b (b later = positief) */
  function daysBetween(aIso, bIso) {
    var a = dayIndex(aIso), b = dayIndex(bIso);
    if (a === null || b === null) return null;
    return b - a;
  }

  /* het MOMENT van een tijdstempel als getal, voor het ordenen van
     berichten in een gesprek. Een waarde zonder tijd telt als middernacht;
     iets onleesbaars levert null en gaat achteraan. */
  function momentOf(v) {
    var p = dateParts(v);
    if (!p) return null;
    return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
  }

  /* ============================================================
     2. SJABLONEN — Nederlands is de bron én de i18n-sleutel

     Alle klantzichtbare zinnen van dit bestand staan in deze ene tabel,
     zodat het opleverrapport ze kan opsommen en portal/i18n.js ze in vier
     talen kan krijgen. De drie cockpitzinnen komen uit CP_STATUS als die
     geladen is; de terugval hieronder is woordelijk dezelfde tekst, zodat
     de sleutel niet verschuift wanneer status.js ontbreekt (Node-test).
     ============================================================ */

  function statusTpl(naam, terugval) {
    var st = STATUS();
    var t = st && isObj(st.templates) ? st.templates[naam] : null;
    return t ? String(t) : terugval;
  }

  var T = {
    /* titels per soort */
    akkoordTitel:      function () { return statusTpl('stageAwaiting', '{fase} wacht op jouw goedkeuring.'); },
    sampleTitel:       function () { return statusTpl('sampleAwait', 'Sample {x} wacht op jouw akkoord.'); },
    factuurTitel:      function () { return statusTpl('invoiceOne', 'Er staat een factuur voor je open.'); },
    vraagTitel:        'Steffan heeft gereageerd op je vraag.',
    bestandTitel: {
      logo:            'We hebben je logo nodig.',
      artwork:         'We hebben je artwork nodig.',
      specificatie:    'We hebben je specificatie nodig.',
      anders:          'We hebben een bestand van je nodig.'
    },
    herbestelTitel:    'Je kunt {product} opnieuw bestellen.',

    /* subregels */
    akkoordSubPct:     'Aan deze fase is een betaalmoment van {pct}% gekoppeld.',
    akkoordSubGeen:    'Aan deze fase is geen betaalmoment gekoppeld.',
    factuurSubVervalt: 'Vervalt op {datum}.',
    factuurSubVerlopen:'De vervaldatum van {datum} is verstreken.',
    factuurSubDeels:   'Een deel is al betaald; het restant staat nog open.',
    bestandSub:        'Verwacht in de fase {fase}.',
    herbestelSub:      'Met dezelfde specificatie, of met een wijziging.',

    /* knoppen */
    akkoordKnop:       'Akkoord geven',
    sampleKnop:        'Beoordeel sample {x}',
    factuurKnop:       'Betaling melden',
    factuurKnop2:      'Bekijk de factuur',
    vraagKnop:         'Reageer in het gesprek',
    bestandKnop:       'Bestand aanleveren',
    herbestelKnop:     'Vraag een nieuwe batch aan',

    /* belangrijke datums */
    datumEta:          'Verwachte levering van {product}',
    datumSampleBeslis: 'Beslissing over sample {x} van {product}',
    datumSampleKlaar:  'Sample {x} van {product} ligt klaar voor jouw keuze',
    datumFactuur:      'Vervaldatum van factuur {x}',
    datumDeadline:     'Beloofde einddatum van {product}',
    datumBericht:      'Geplande update over {product}',

    /* factuurstanden — het FIJNE woord (label), zelfde woordenlijst als
       factuur.html en portal.html. Nog gelezen door portaal-schermen-werk.js;
       nieuwe schermen lezen woord + toelichting hieronder. */
    standBetaald:      'Betaald',
    standDeels:        'Deels betaald',
    standVerlopen:     'Verlopen',
    standOpen:         'Open',
    standGeannuleerd:  'Geannuleerd',
    standGecrediteerd: 'Gecrediteerd',
    standBezwaar:      'Bezwaar in behandeling',
    standConcept:      'Concept',

    /* DE VIER WOORDEN VAN DE KLANT (woord) — de factuurmodule kent twaalf
       statussen, de klant leest er vier: elk woord beantwoordt "moet ik
       iets doen?" (Open: ja; Gemeld en Bezwaar: nee, Steffan is aan zet;
       Betaald: nee, afgehandeld). Alles wat fijner is, staat in de
       toelichting ernaast — nooit in een vijfde woord. */
    woordOpen:         'Open',
    woordGemeld:       'Gemeld',
    woordBetaald:      'Betaald',
    woordBezwaar:      'Bezwaar',
    /* de toelichtingen; {datum}, {betaald} en {totaal} vult het scherm in
       de taal van de klant (afspraak 2 uit het kopblok) */
    toelichtingGemeld:     'Steffan controleert je betaling',
    toelichtingTeLaat:     'Vervaldatum was {datum}',
    toelichtingDeels:      '{betaald} van {totaal} ontvangen',
    toelichtingCreditnota: 'Creditnota, verrekend',
    toelichtingVervallen:  'Vervallen',

    /* RONDE 3 — de korte klantnamen van de zes fases (advies: de held en
       de fasebalk hebben geen ruimte voor "Massaproductie &
       Kwaliteitscontrole"). De sleutels zijn opgeslagen waarden. */
    faseKort: {
      concept:    'Ontwerp',
      dfm:        'Ontwerp voor productie',
      sourcing:   'Fabriek kiezen',
      tooling:    'Tooling & samples',
      production: 'Productie & controle',
      logistics:  'Compliance & verzending'
    },

    /* RONDE 3 — één zin klantentaal per fase. DE DUUR IS NIET VERZONNEN:
       elke bandbreedte is letterlijk wat CUSTOM+ zelf op de dienstenpagina
       publiceert (content/services.json → steps[n].dur, Nederlands in
       content/nl/services.json, gerenderd op custom-plus.html regel 2440
       via #stage-dur, gevuld op regel 4191, en op diensten/index.html). Verandert de site, dan
       hoort deze tabel mee te veranderen; test/portaal-model.test.mjs
       vergelijkt de zinnen met dat bestand. Per fase de bron:
         concept    content/services.json:37  "1–2 weeks"  → 1 tot 2 weken
         dfm        content/services.json:50  "2–4 weeks"  → 2 tot 4 weken
         sourcing   content/services.json:63  "2–3 weeks"  → 2 tot 3 weken
         tooling    content/services.json:76  "4–10 weeks" → 4 tot 10 weken
         production content/services.json:89  "4–8 weeks"  → 4 tot 8 weken
         logistics  content/services.json:102 "3–6 weeks"  → 3 tot 6 weken
       Een fase die daar ooit zonder duur komt te staan, krijgt hier een
       zin zonder duur — nooit een geschatte. */
    faseUitleg: {
      concept:    'Je idee wordt uitgewerkt tot een ontwerp dat echt te maken is; dit duurt meestal 1 tot 2 weken.',
      dfm:        'Het ontwerp wordt doorgerekend voor de fabriek, zodat het zonder verrassingen te produceren is; dit duurt meestal 2 tot 4 weken.',
      sourcing:   'We kiezen en controleren de fabriek die bij je product past en leggen de afspraken vast; dit duurt meestal 2 tot 3 weken.',
      tooling:    'De mal wordt gemaakt en de eerste samples komen; dit duurt meestal 4 tot 10 weken.',
      production: 'De fabriek maakt je oplage en we controleren de kwaliteit tijdens de run; dit duurt meestal 4 tot 8 weken.',
      logistics:  'Je product wordt getest voor de regels van je markt en verscheept tot aan je deur; dit duurt meestal 3 tot 6 weken.'
    },

    /* RONDE 3 — de korte maandnamen van datumKort, dezelfde twaalf als
       MONTHS_SHORT in CP_MODEL; elk woord is een eigen bronstring zodat
       het scherm 'apr' door T() kan halen */
    maanden: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  };

  /* dezelfde vuller als CP_STATUS.fill — voor tests en voor een scherm dat
     bewust het kale Nederlands wil (bijvoorbeeld in een mail aan Steffan) */
  function vul(tpl, vars) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (vars && vars[k] !== null && vars[k] !== undefined) ? String(vars[k]) : m;
    });
  }

  /* vars aanvullen zonder Object.assign (ES5): een NIEUW object, de bron
     blijft ongemoeid zodat twee renders elkaar niet besmetten */
  function metVars(vars, extra) {
    var out = {};
    var k;
    if (isObj(vars)) for (k in vars) if (Object.prototype.hasOwnProperty.call(vars, k)) out[k] = vars[k];
    if (isObj(extra)) for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    return out;
  }

  /* ============================================================
     3. DE BUNDEL — één vorm, drie ingangen

     portal.html levert vandaag twee vormen: de projectbundel van
     loadBundle() ({project, stages, media, documents, invoices, samples,
     questions, inspections, accessLog, factories, docSlots, disclosures,
     shipments, shipmentEvents}) en het portfolio van loadPortfolio()
     ({projects[] met stages erin, media, samples, invoices, questions,
     shipments}). De nieuwe datalaag mag daar een lijst van bundels
     bovenop leggen. bronnen() vouwt die allemaal tot één platte vorm
     waarin elke rij zijn projectId draagt — zodat de Inbox over ALLE
     producten van de klant tegelijk kan rekenen.

     AANNAMES OVER DE VORM (camelCase, zoals camelRow() ze maakt):
       project        {id, name, status 'active'|'archived', deadline, stages[]}
       stage          {stageKey, position, status 'done'|'current'|
                       'awaiting_approval'|'upcoming', paymentPct, approvedAt}
       sample         {id, projectId, roundLabel, status 'reviewed'|'approved'|
                       'superseded', note, roundDate, clientDecision (0021)}
       invoice        {id, projectId, label, invoiceNumber, amountCents,
                       totalCents, vatCents, paidCents, creditedCents,
                       currency, status, statusCode, publishStatus, dueDate,
                       createdAt, paidAt, publishedAt}
       question       {id, projectId, question, answer, askedAt, answeredAt}
       questionMessage{id, questionId, author 'client'|'staff', body, createdAt}
       document       {id, projectId, stageKey, docType, createdAt, slotId (0021)}
       docSlot        {id, projectId, docType, stageKey, status, documentId,
                       createdAt, expectedFrom 'klant'|'staf' (0021)}
       shipment       {id, projectId, etaWindowStart, etaWindowEnd, deliveredAt}
       shipmentEvent  {id, shipmentId, milestoneKey, occurredAt}
       reorderRequest {id, projectId, qty, wantedBy, sameSpec, changeNote,
                       status (pijplijnstap), createdAt} (0021)
       accessLog      {id, projectId, actor, assetKind, action, detail, createdAt}
     ============================================================ */

  var COLLECTIES = ['media', 'documents', 'invoices', 'samples', 'questions',
    'questionMessages', 'inspections', 'accessLog', 'docSlots', 'disclosures',
    'shipments', 'shipmentEvents', 'reorderRequests'];

  function leegBron() {
    var b = { projects: [], stages: [] };
    COLLECTIES.forEach(function (k) { b[k] = []; });
    return b;
  }

  function voegProject(b, p, losseStages) {
    if (!isObj(p) || !p.id) return;
    var al = false;
    b.projects.forEach(function (x) { if (x.id === p.id) al = true; });
    if (!al) b.projects.push(p);
    /* fases krijgen hun projectId mee: in de projectbundel dragen ze die
       niet, in het portfolio zitten ze genest onder het project */
    var rows = list(losseStages).length ? list(losseStages) : list(p.stages);
    rows.forEach(function (s) {
      if (!isObj(s)) return;
      b.stages.push({
        projectId: s.projectId || p.id, stageKey: s.stageKey, position: s.position,
        status: s.status, paymentPct: s.paymentPct, approvedAt: s.approvedAt,
        approvedBy: s.approvedBy, awaitingSince: s.awaitingSince,
        /* approvedVia is het stempel waarmee CP_MODEL.doorKlant een akkoord
           als klantactie herkent; zonder dit veld werd elk portaalakkoord de
           oude soort 'klant' en stond hij dubbel naast de logboekregel */
        approvedVia: s.approvedVia || null, raw: s
      });
    });
  }

  function voegBundel(b, bundle) {
    if (!isObj(bundle)) return;
    if (isObj(bundle.project)) voegProject(b, bundle.project, bundle.stages);
    list(bundle.projects).forEach(function (p) { voegProject(b, p, null); });
    COLLECTIES.forEach(function (k) {
      list(bundle[k]).forEach(function (r) { if (r) b[k].push(r); });
    });
  }

  function bronnen(bundle) {
    var b = leegBron();
    if (Array.isArray(bundle)) bundle.forEach(function (x) { voegBundel(b, x); });
    else if (isObj(bundle)) {
      voegBundel(b, bundle);
      list(bundle.bundles).forEach(function (x) { voegBundel(b, x); });
    }
    return b;
  }

  function projectById(b, id) {
    var out = null;
    b.projects.forEach(function (p) { if (p.id === id) out = p; });
    return out;
  }

  function projectNaam(p) {
    if (!isObj(p)) return '';
    return str(p.name || p.title || p.code || p.id);
  }

  function isArchived(p) { return !!(isObj(p) && p.status === 'archived'); }

  /* fasenaam van de aanroeper, nooit uit dit bestand (zie kopblok) */
  function stageLabeler(opties) {
    var fn = (isObj(opties) && isFn(opties.stageLabel)) ? opties.stageLabel : null;
    return function (key) {
      var k = str(key);
      if (!k || !fn) return k;
      var uit = '';
      try { uit = str(fn(k)); } catch (e) { uit = ''; }
      return uit || k;
    };
  }

  /* ============================================================
     4. FASES EN VOORTGANG — één berekening, dezelfde als buildStageRing()

     buildStageRing() in portal.html tekent één segment per fase en zet in
     het midden "n/t": n = de positie van de huidige fase, of t als alles
     af is. De huidige fase is de eerste die niet 'done' en niet 'upcoming'
     is (dus 'current' of 'awaiting_approval'), anders de eerste
     'upcoming', anders niets — dat is currentStageOf() daar, woordelijk.
     ============================================================ */

  function sorteerFases(stages) {
    return stableSort(list(stages).filter(isObj), function (a, b) {
      return (Number(a.position) || 0) - (Number(b.position) || 0);
    });
  }

  function huidigeFase(stages) {
    var st = sorteerFases(stages);
    var i;
    for (i = 0; i < st.length; i++) {
      if (st[i].status !== 'done' && st[i].status !== 'upcoming') return st[i];
    }
    for (i = 0; i < st.length; i++) {
      if (st[i].status === 'upcoming') return st[i];
    }
    return null;
  }

  /* {pct, huidigeFase, faseIndex, totaal, afgerond, klaar}
     pct is het aandeel AFGERONDE fases — geen tijdsschatting, geen gewicht
     per fase, want dat meten we niet. Zonder fases is alles nul en klaar
     is false: een project zonder fases is niet af, er is niets om uit af
     te leiden (zelfde regel als CP_MODEL.isFinished). */
  function voortgang(project, stages) {
    var rows = list(stages).length ? list(stages) : list(isObj(project) ? project.stages : null);
    var st = sorteerFases(rows);
    var totaal = st.length;
    var afgerond = 0;
    st.forEach(function (s) { if (s.status === 'done') afgerond++; });
    var cur = huidigeFase(st);
    return {
      pct: totaal ? Math.round(afgerond * 100 / totaal) : 0,
      huidigeFase: cur,
      faseIndex: cur ? (Number(cur.position) || 0) : totaal,
      totaal: totaal,
      afgerond: afgerond,
      klaar: totaal > 0 && afgerond === totaal
    };
  }

  /* het product is klaar: minstens één fase en alle fases 'done'. Een
     gearchiveerd project telt óók mee als het product er echt is
     (geurflacon: gearchiveerd én zes keer done), maar een gearchiveerd
     project dat nooit is afgemaakt niet — een product dat nooit is
     geproduceerd kun je niet opnieuw bestellen. Bewust strenger dan
     projectIsCompleted() in portal.html, dat elk archief goedrekent. */
  function productAfgerond(p, stagesVanProject) {
    var v = voortgang(p, stagesVanProject);
    return v.klaar;
  }

  /* ============================================================
     5. FACTUREN — de statusvertaler, en NOOIT het veld rechtstreeks

     Er liggen twee waarheden over elkaar. Golf 1 kende drie standen in de
     kolom status ('open' | 'paid' | 'void'); de factuurmodule kent er
     twaalf in status_code ('draft' … 'uncollectible'). Het beheer schrijft
     ze allebei en oude rijen hebben alleen de eerste. Wie hier op
     inv.status vergelijkt, noemt een geannuleerde factuur "open" en vraagt
     de klant om geld dat hij niet meer hoeft over te maken.

     Twee stappen, dezelfde als invoiceStatusCode() + clientStatus() in
     portal.html / invoice-mail.js, hier zonder window-afhankelijkheid:
       1. de rij → ÉÉN code uit de twaalf, met de eerlijke terugval;
       2. die code + de bedragen → de stand die de klant leest.
     ============================================================ */

  var STATUS_CODES = ['draft', 'scheduled', 'finalized', 'sent', 'viewed',
    'partially_paid', 'paid', 'overdue', 'disputed', 'cancelled', 'credited',
    'uncollectible'];

  function kentCode(code) { return STATUS_CODES.indexOf(code) >= 0; }

  function statusCodeVan(inv) {
    if (!isObj(inv)) return 'draft';
    var code = str(inv.statusCode);
    /* een onbekende code is geen reden om te raden: dan telt de golf-1-
       vlag hieronder, want die is er altijd */
    if (code && kentCode(code)) return code;
    if (inv.publishStatus === 'concept') return 'draft';
    if (inv.status === 'paid') return 'paid';
    if (inv.status === 'void') return 'cancelled';
    return 'finalized';
  }

  /* het TE BETALEN bedrag: totalCents (incl. btw, gezet door het beheer)
     als dat er is, anders amountCents. Er wordt hier nooit btw gerekend. */
  function totaalCentsVan(inv) {
    var t = cents(inv.totalCents);
    return t > 0 ? t : cents(inv.amountCents);
  }

  /* Staat paidCents op de rij, dan telt het — óók als het 0 is: na een
     teruggeboekte betaling staat paidCents expliciet op 0 en zou "0 is
     geen gegevens" de oude betaald-vlag laten winnen. Zonder het veld
     (rijen van vóór fase 5) zegt de code het: paid = alles betaald. */
  function betaaldCentsVan(inv, code) {
    if (inv.paidCents !== undefined && inv.paidCents !== null) return cents(inv.paidCents);
    return code === 'paid' ? totaalCentsVan(inv) : 0;
  }

  function gecrediteerdCentsVan(inv) {
    var n = cents(inv.creditedCents);
    return n > 0 ? n : 0;
  }

  /* Een gemelde, nog niet bevestigde betaling maakt de factuur 'Gemeld'.
     Die melding staat niet op de factuurrij zelf (invoice_payments is een
     eigen tabel), dus hij komt op twee manieren binnen:
       · opties.gemeld — de lijst onbevestigde meldingen die het scherm via
         listClientPayments ophaalde (een getal of true telt ook);
       · inv.gemeldeBetaling — het veld dat betalingMelden() op de
         teruggegeven rij zet, zolang verifiedAt leeg is.
     Een bevestigde melding (verifiedAt gevuld) is een boeking geworden en
     zit dan al in paidCents; die telt hier niet meer als "gemeld". */
  function gemeldeBetalingVan(inv, opties) {
    var o = isObj(opties) ? opties : {};
    var g = o.gemeld;
    if (Array.isArray(g)) {
      return g.some(function (m) { return !isObj(m) || !m.verifiedAt; });
    }
    if (typeof g === 'number') return g > 0;
    if (g === true) return true;
    var m = inv.gemeldeBetaling;
    return isObj(m) && !m.verifiedAt;
  }

  /* {code, stand, label, toon, woord, toelichting, betaald, open, deels,
      gemeld, bezwaar, gesloten, openCents, totaalCents, betaaldCents,
      gecrediteerdCents, valuta, vervaltISO, verstreken}

     TWEE WOORDENLIJSTEN OVER ELKAAR
     stand + label zijn het fijne woord uit de factuurmodule ('betaald' |
     'deels_betaald' | 'verlopen' | 'open' | 'geannuleerd' | 'gecrediteerd'
     | 'concept', label = het Nederlandse woord = i18n-sleutel). Ze blijven
     bestaan omdat portaal-schermen-werk.js ze leest.
     woord + toelichting zijn wat de klant LEEST: precies één van 'Open',
     'Gemeld', 'Betaald', 'Bezwaar', met wat fijner is in de toelichting:
       · te laat        → 'Open'    + 'Vervaldatum was {datum}'   (warn)
       · deels betaald  → 'Open'    + '{betaald} van {totaal} ontvangen'
                          (een deelbetaling die óók te laat is, houdt de
                          bedragtoelichting: het scherm toont de datum al
                          in zijn datumslot, en verstreken blijft true)
       · gemeld         → 'Gemeld'  + 'Steffan controleert je betaling'
                          (wint van 'Bezwaar': de melding is de laatste
                          handeling van de klant en het is Steffans beurt)
       · betwist        → 'Bezwaar' (de klant hoeft niets te doen)
       · betaald        → 'Betaald'
       · gecrediteerd   → 'Betaald' + 'Creditnota, verrekend' — het geld
                          hoeft niet meer betaald te worden, dat is wat het
                          woord voor de klant betekent; de toelichting zegt
                          dat het via een creditnota ging (ok-toon)
       · geannuleerd    → GEEN woord (leeg) + 'Vervallen' (muted). Dit is
                          de ene bewuste uitzondering op "precies één van
                          vier": 'Betaald' zou een betaling beweren die
                          nooit is gedaan, 'Open' zou om geld vragen dat
                          niet meer hoeft. Een geannuleerde factuur is in de
                          factuurmodule bovendien niet klantzichtbaar
                          (STATUS_META.cancelled.clientVisible = false); hij
                          staat alleen nog in de historie, en daar toont
                          het scherm de toelichting als het woord.
       · concept        → geen woord, geen toelichting: bereikt de klant
                          nooit (conceptGate), maar een lege rij mag niets
                          beweren.
     toon is de betekeniskleur uit de mockupspec: warn (oranje), info
     (blauw), muted (grijs). Sinds ronde 3 (advies 27) houden alleen de
     standen waar de klant nog iets mee moet kleur: 'Open' is warn en
     'Bezwaar' is info; 'Betaald' en 'Gemeld' zijn muted, net als
     geannuleerd en concept — een afgehandelde factuur hoeft niet te
     schreeuwen, en een lijst met zes groene stippen maakt de ene oranje
     onzichtbaar. 'ok' en 'crit' komen niet meer voor: te laat is 'Open'
     met een warn-toon en de datum ernaast. De schermen vertalen muted
     naar de toon 'neutraal' van CP_UI (grijze stip). Kleur is nooit de
     enige drager — het woord staat er altijd naast.

     Een geannuleerde of gecrediteerde factuur is gesloten: open = false,
     hij telt niet mee in het openstaande bedrag en vraagt nergens om geld.
     Een betwiste factuur (bezwaar = true) blijft open — het geld is niet
     kwijtgescholden — maar de klant hoeft er nu niets aan te doen: de bal
     ligt bij Steffan en de herinneringen staan stil. */
  function factuurStatusVoorKlant(invoice, nu, opties) {
    var inv = isObj(invoice) ? invoice : {};
    /* geen rij is geen factuur: 'draft' en dus nergens open — via het lege
       object zou de terugval hem 'finalized' noemen en met nul centen
       "betaald" zeggen over iets wat niet bestaat */
    var code = isObj(invoice) ? statusCodeVan(invoice) : 'draft';
    var totaal = totaalCentsVan(inv);
    var betaald = betaaldCentsVan(inv, code);
    var gecrediteerd = gecrediteerdCentsVan(inv);
    var openC = totaal - betaald - gecrediteerd;
    if (openC < 0) openC = 0;
    var vervalt = dayISO(inv.dueDate);
    var vandaag = todayOf(nu);
    var verstreken = !!(vervalt && vervalt < vandaag);

    var stand;
    if (code === 'cancelled') stand = 'geannuleerd';
    else if (code === 'credited') stand = 'gecrediteerd';
    else if (code === 'paid') stand = 'betaald';
    else if (code === 'draft' || code === 'scheduled') stand = 'concept';
    else if (openC <= 0) stand = 'betaald';
    else if (code === 'partially_paid') stand = 'deels_betaald';
    else if (verstreken) stand = 'verlopen';
    else stand = 'open';

    var gesloten = stand === 'geannuleerd' || stand === 'gecrediteerd';
    var isBetaald = stand === 'betaald';
    var isOpen = !gesloten && !isBetaald && stand !== 'concept' && openC > 0;
    /* 'deels betaald' is alleen waar als er ECHT iets is afgeboekt én er
       nog iets openstaat — ook een rij waarvan de statuscode nog niet is
       bijgewerkt heeft dan zichtbaar al een afboeking */
    var deels = isOpen && (betaald + gecrediteerd) > 0;
    var bezwaar = code === 'disputed';
    /* alleen een OPEN factuur kan gemeld zijn: op een betaalde of gesloten
       factuur is een melding al verwerkt of zinloos */
    var gemeld = isOpen && gemeldeBetalingVan(inv, opties);

    /* het fijne woord (label) voor de schermen die het nog lezen */
    var label;
    if (stand === 'concept') label = T.standConcept;
    else if (isBetaald) label = T.standBetaald;
    else if (gesloten) label = stand === 'geannuleerd' ? T.standGeannuleerd : T.standGecrediteerd;
    else if (bezwaar) label = T.standBezwaar;
    else if (deels) label = T.standDeels;
    else if (stand === 'verlopen') label = T.standVerlopen;
    else label = T.standOpen;

    /* het woord van de klant, de toelichting en de ene toon voor beide
       (de volgorde is de rangorde uit het kopblok hierboven) */
    var woord = '', toelichting = '', toon;
    if (stand === 'concept') { toon = 'muted'; }
    else if (isBetaald) { woord = T.woordBetaald; toon = 'muted'; }
    else if (stand === 'gecrediteerd') { woord = T.woordBetaald; toelichting = T.toelichtingCreditnota; toon = 'muted'; }
    else if (stand === 'geannuleerd') { toelichting = T.toelichtingVervallen; toon = 'muted'; }
    else if (gemeld) { woord = T.woordGemeld; toelichting = T.toelichtingGemeld; toon = 'muted'; }
    else if (bezwaar) { woord = T.woordBezwaar; toon = 'info'; }
    else if (deels) { woord = T.woordOpen; toelichting = T.toelichtingDeels; toon = 'warn'; }
    else if (verstreken) { woord = T.woordOpen; toelichting = T.toelichtingTeLaat; toon = 'warn'; }
    else { woord = T.woordOpen; toon = 'warn'; }

    return {
      code: code,
      stand: stand,
      label: label,
      toon: toon,
      woord: woord,
      toelichting: toelichting,
      betaald: isBetaald,
      open: isOpen,
      deels: deels,
      gemeld: gemeld,
      bezwaar: bezwaar,
      gesloten: gesloten,
      openCents: isOpen ? openC : 0,
      totaalCents: totaal,
      betaaldCents: betaald,
      gecrediteerdCents: gecrediteerd,
      valuta: str(inv.currency) || 'EUR',
      vervaltISO: vervalt,
      verstreken: isOpen && verstreken
    };
  }

  /* Som van de open facturen in ÉÉN valuta (standaard EUR). Facturen
     kunnen EUR, USD of CNY dragen en centen van twee valuta's bij elkaar
     optellen is een getal dat niets betekent; wie alles wil, gebruikt
     openstaandPerValuta(). Een factuur zonder valuta telt als EUR, precies
     zoals fmtMoney() in portal.html hem toont. */
  function openstaandCents(invoices, valuta) {
    var v = str(valuta) || 'EUR';
    var som = 0;
    list(invoices).forEach(function (inv) {
      var st = factuurStatusVoorKlant(inv);
      if (!st.open) return;
      if (st.valuta !== v) return;
      som += st.openCents;
    });
    return som;
  }

  function openstaandPerValuta(invoices) {
    var out = {};
    list(invoices).forEach(function (inv) {
      var st = factuurStatusVoorKlant(inv);
      if (!st.open) return;
      out[st.valuta] = (out[st.valuta] || 0) + st.openCents;
    });
    return out;
  }

  /* {factuur, status, vervaltISO, openCents, valuta, verstreken} of null.
     De eerstvolgende open factuur op vervaldatum; wie geen vervaldatum
     heeft komt ná wie er wel een heeft, op aanmaakdatum. Er wordt geen
     vervaldatum geprojecteerd (aanmaak + 30 is een stafprojectie, geen
     belofte aan de klant). Een betwiste factuur doet niet mee: daar wacht
     de klant op Steffan, niet andersom. */
  function volgendeBetaling(invoices, nu) {
    var kand = [];
    list(invoices).forEach(function (inv) {
      if (!isObj(inv)) return;
      var st = factuurStatusVoorKlant(inv, nu);
      if (!st.open || st.bezwaar) return;
      kand.push({ factuur: inv, status: st });
    });
    if (!kand.length) return null;
    kand = stableSort(kand, function (a, b) {
      var av = a.status.vervaltISO, bv = b.status.vervaltISO;
      if (av !== bv) {
        if (!av) return 1;
        if (!bv) return -1;
        return cmpText(av, bv);
      }
      var r = cmpText(dayISO(a.factuur.createdAt) || '', dayISO(b.factuur.createdAt) || '');
      if (r) return r;
      return cmpText(a.factuur.id, b.factuur.id);
    });
    var eerste = kand[0];
    return {
      factuur: eerste.factuur,
      status: eerste.status,
      vervaltISO: eerste.status.vervaltISO,
      openCents: eerste.status.openCents,
      valuta: eerste.status.valuta,
      verstreken: eerste.status.verstreken
    };
  }

  /* ============================================================
     6. SAMPLES — welke ronde wacht op de klant

     Alleen de nieuwste ronde per project telt, precies zoals nextStep()
     en computeSignals(): een oudere ronde is verdrongen en vraagt niets.
     Een ronde waar de klant al over besliste (clientDecision, migratie
     0021) vraagt óók niets meer — de bal ligt dan bij Steffan.
     ============================================================ */

  function wachtendeSamples(b) {
    var out = [];
    b.samples.forEach(function (s) {
      if (!isObj(s) || s.status !== 'reviewed') return;
      if (s.clientDecision) return;
      var nieuwer = false;
      b.samples.forEach(function (o) {
        if (!isObj(o) || o.id === s.id || o.projectId !== s.projectId) return;
        var a = dayIndex(o.roundDate), c = dayIndex(s.roundDate);
        if (a !== null && c !== null && a > c) nieuwer = true;
      });
      if (!nieuwer) out.push(s);
    });
    return out;
  }

  /* ============================================================
     7. GESPREKKEN — wie sprak het laatst

     question_messages (0020) maakt van een vraag een draad. Een draad
     zonder rijen valt terug op de twee oude kolommen: de vraag is beurt
     één (klant), het antwoord beurt twee (Steffan) — dezelfde terugval als
     threadOf() in portal/admin-data.js. Het nieuwste bericht bepaalt bij
     wie de bal ligt.
     ============================================================ */

  function laatsteBeurt(q, messages) {
    var rijen = [];
    list(messages).forEach(function (m) {
      if (isObj(m) && m.questionId === q.id && m.body) rijen.push(m);
    });
    if (!rijen.length) {
      if (q.question) rijen.push({ author: 'client', createdAt: q.askedAt, body: q.question, virtueel: true });
      if (q.answer && q.answeredAt) rijen.push({ author: 'staff', createdAt: q.answeredAt || q.askedAt, body: q.answer, virtueel: true });
    }
    if (!rijen.length) return null;
    rijen = stableSort(rijen, function (a, c) {
      var x = momentOf(a.createdAt), y = momentOf(c.createdAt);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return x - y;
    });
    var l = rijen[rijen.length - 1];
    return { author: l.author === 'client' ? 'client' : 'staff', at: l.createdAt || null, body: str(l.body) };
  }

  /* ============================================================
     8. DOCUMENTSLOTS — wat de KLANT moet aanleveren

     Een slot 'verwacht' bestaat vandaag alleen voor wat STEFFAN levert
     (offerte, compliance, inspectierapport): de portaaltekst zegt letterlijk
     "verschijnt hier zodra Steffan het deelt". Dat is geen vraag aan de
     klant. Een slot is pas een vraag aan de klant als het slot dat zelf
     zegt (expectedFrom 'klant', migratie 0021) of als het documenttype
     iets is dat alleen de klant kán leveren: zijn logo, zijn artwork, zijn
     specificatie. Liever een slot te weinig dan een klant die zijn eigen
     inspectierapport moet uploaden.
     ============================================================ */

  var KLANT_DOC_TYPES = [
    { key: 'logo',         label: 'Logo' },
    { key: 'artwork',      label: 'Artwork' },
    { key: 'specificatie', label: 'Specificatie' }
  ];

  function klantDocType(key) {
    var k = str(key);
    for (var i = 0; i < KLANT_DOC_TYPES.length; i++) {
      if (KLANT_DOC_TYPES[i].key === k) return KLANT_DOC_TYPES[i];
    }
    return null;
  }

  function slotVanKlant(sl) {
    if (str(sl.expectedFrom) === 'klant') return true;
    if (str(sl.expectedFrom) === 'staf') return false;
    return !!klantDocType(sl.docType);
  }

  /* open = geen zichtbaar document eraan. Een slot telt als gevuld zodra
     het een documentId heeft dat in de bundel voorkomt, óf zodra een
     document in de bundel naar het slot wijst (slotId, 0021). */
  function openKlantSlots(b) {
    var docIds = {}, perSlot = {};
    b.documents.forEach(function (d) {
      if (!isObj(d)) return;
      if (d.id) docIds[d.id] = true;
      if (d.slotId) perSlot[d.slotId] = true;
    });
    var out = [];
    b.docSlots.forEach(function (sl) {
      if (!isObj(sl) || !sl.id) return;
      if (!slotVanKlant(sl)) return;
      if (sl.status && sl.status !== 'verwacht') return;
      if (sl.documentId && docIds[sl.documentId]) return;
      if (perSlot[sl.id]) return;
      out.push(sl);
    });
    return out;
  }

  /* ============================================================
     9. HERBESTELLEN — de vierstapspijplijn, gespiegeld

     De vier stappen zijn opgeslagen waarden (settings.reorderPipeline in
     het beheer, reorder_requests.status in 0021); de volgorde is een regel.
     CP_MODEL.REORDER_STAGES is de bron zodra die geladen is; de kopie
     hieronder is letterlijk gelijk en dient alleen de losse test.
     ============================================================ */

  var REORDER_TERUGVAL = [
    { key: 'aanvraag', label: 'Aanvraag' },
    { key: 'offerte',  label: 'Offerte' },
    { key: 'akkoord',  label: 'Akkoord' },
    { key: 'project',  label: 'Project' }
  ];

  function reorderStages() {
    var m = MODEL();
    return (m && list(m.REORDER_STAGES).length) ? m.REORDER_STAGES : REORDER_TERUGVAL;
  }

  /* {stap, index, totaal, label, sleutel, stappen, klaar}
     Een lege of onbekende stand is stap 1: een aanvraag die nog nooit is
     aangeraakt ís een aanvraag. stappen draagt per stap 'done' | 'current'
     | 'pending', zodat het scherm de rij kan tekenen zonder de volgorde
     opnieuw af te leiden. */
  function reorderStand(request) {
    var stages = reorderStages();
    var st = isObj(request) ? str(request.status || request.stage) : '';
    var idx = -1;
    for (var i = 0; i < stages.length; i++) if (stages[i].key === st) idx = i;
    if (idx < 0) idx = 0;
    var stappen = stages.map(function (rs, i) {
      return { key: rs.key, label: rs.label, state: (i < idx) ? 'done' : ((i === idx) ? 'current' : 'pending') };
    });
    return {
      stap: idx + 1,
      index: idx,
      totaal: stages.length,
      label: stages[idx].label,
      sleutel: stages[idx].key,
      stappen: stappen,
      klaar: idx === stages.length - 1
    };
  }

  /* een herbestelling "loopt" zolang hij niet op de laatste stap staat
     (dan is er een batchproject en staat dat zelf in de lijst). De oude
     vorm — een vraag met het voorvoegsel HERBESTELLING: — loopt zolang hij
     onbeantwoord is; de pijplijnstand daarvan leeft in de stafinstellingen
     en bereikt de klant niet, dus meer valt er niet eerlijk over te zeggen. */
  function herbestellingLoopt(b, projectId) {
    var loopt = false;
    b.reorderRequests.forEach(function (r) {
      if (!isObj(r) || r.projectId !== projectId) return;
      if (!reorderStand(r).klaar) loopt = true;
    });
    b.questions.forEach(function (q) {
      if (!isObj(q) || q.projectId !== projectId) return;
      if (str(q.question).indexOf('HERBESTELLING:') === 0 && !q.answeredAt) loopt = true;
    });
    return loopt;
  }

  /* ============================================================
     10. DE INBOX VAN DE KLANT — watWeNodigHebben()

     De ENIGE plek waar deze lijst wordt gebouwd; Overzicht en de badge
     lezen hem allebei. Zes soorten, in de prioriteit van nextStep():
       sample → akkoord → factuur → vraag → bestand → herbestel
     Binnen een soort de oudste eerst. Urgent = de vervaldatum is
     verstreken, of — voor een item zonder vervaldatum — het ligt er
     langer dan VERS_DAGEN. Een vraag en een herbestelling zijn nooit
     urgent: dat zijn uitnodigingen, geen verplichtingen.
     ============================================================ */

  var SOORTEN_NODIG = [
    { key: 'sample',    label: 'Sample beoordelen',   actie: 'sampleBeoordelen' },
    { key: 'akkoord',   label: 'Akkoord geven',       actie: 'akkoordGeven' },
    { key: 'factuur',   label: 'Factuur betalen',     actie: 'betalingMelden' },
    { key: 'vraag',     label: 'Bericht van Steffan', actie: 'berichtSturen' },
    { key: 'bestand',   label: 'Bestand aanleveren',  actie: 'bestandAanleveren' },
    { key: 'herbestel', label: 'Opnieuw bestellen',   actie: 'herbestellen' }
  ];

  var PRIORITEIT = {};
  SOORTEN_NODIG.forEach(function (s, i) { PRIORITEIT[s.key] = i; });

  /* de namen uit het actiecontract — één lijst, zodat een scherm of een
     test kan controleren dat ctx.acties compleet is */
  var ACTIES = ['akkoordGeven', 'sampleBeoordelen', 'betalingMelden', 'bezwaarMaken',
    'berichtSturen', 'vraagStellen', 'bestandAanleveren', 'herbestellen',
    'contactpersoonOpslaan', 'contactpersoonVerwijderen', 'taalKiezen',
    'meldingenOpslaan', 'downloadAlles', 'factuurPdf'];

  var MAX_NODIG = 5;

  function urgentie(vervalISO, atISO, vandaag) {
    if (vervalISO) return vervalISO < vandaag;
    var d = daysBetween(atISO, vandaag);
    return d !== null && d > VERS_DAGEN;
  }

  /* Sinds wanneer een fase op akkoord wacht. De fase zelf draagt geen
     tijdstempel voor die wissel (approvedAt is dan juist leeg); het beheer
     schrijft bij elke statuswissel een regel in het toegangslogboek —
     'Fasestatus gewijzigd: <fasenaam> → Wacht op akkoord' — en leest die
     terug in computeSignals(). De klant mag zijn eigen toegangslogboek
     lezen, dus dezelfde regel is hier de bron. Zonder fasenaam matchen we
     op voor- en achtervoegsel en nemen de nieuwste; met stageLabel exact.
     Een veld awaitingSince (mocht 0021 het toevoegen) wint. */
  var FASE_PREFIX = 'Fasestatus gewijzigd: ';
  var FASE_SUFFIX = ' → Wacht op akkoord';

  function akkoordSinds(b, s, faseNaam) {
    if (s.awaitingSince) return s.awaitingSince;
    var exact = FASE_PREFIX + faseNaam(s.stageKey) + FASE_SUFFIX;
    var since = null;
    b.accessLog.forEach(function (r) {
      if (!isObj(r) || r.projectId !== s.projectId) return;
      var det = str(r.detail);
      var past = det === exact ||
        (det.indexOf(FASE_PREFIX) === 0 && det.slice(-FASE_SUFFIX.length) === FASE_SUFFIX);
      if (!past) return;
      if (!since || str(r.createdAt) > str(since)) since = r.createdAt;
    });
    return since;
  }

  function laatsteAkkoord(stagesVanProject) {
    var max = null;
    list(stagesVanProject).forEach(function (s) {
      var d = dayISO(s.approvedAt);
      if (d && (!max || d > max)) max = d;
    });
    return max;
  }

  function verzamel(bundle, nu, opties) {
    var b = bronnen(bundle);
    var vandaag = todayOf(nu);
    var faseNaam = stageLabeler(opties);
    var items = [];

    function push(it) {
      it.sleutel = it.kind + ':' + str(it.id);
      it.vars = it.vars || {};
      it.detail = it.detail || '';
      it.sub = it.sub || '';
      it.datumISO = it.datumISO || null;
      it.at = it.at || null;
      it.projectId = it.projectId || null;
      items.push(it);
    }

    function stagesVan(pid) {
      return b.stages.filter(function (s) { return s.projectId === pid; });
    }

    /* ---------- 1. samplerondes die op een keuze wachten ---------- */
    wachtendeSamples(b).forEach(function (s) {
      var p = projectById(b, s.projectId);
      if (isArchived(p)) return;
      push({
        kind: 'sample', id: s.id,
        titel: T.sampleTitel(),
        sub: '',
        detail: str(s.note),
        vars: { x: str(s.roundLabel), product: projectNaam(p) },
        actie: 'sampleBeoordelen', actieLabel: T.sampleKnop,
        urgent: urgentie(dayISO(s.decisionDue), s.roundDate, vandaag),
        datumISO: dayISO(s.decisionDue),
        at: s.roundDate || null,
        projectId: s.projectId || null, raw: s
      });
    });

    /* ---------- 2. fases die op akkoord wachten ---------- */
    b.stages.forEach(function (s) {
      if (str(s.status) !== 'awaiting_approval') return;
      var p = projectById(b, s.projectId);
      if (isArchived(p)) return;
      var pct = Number(s.paymentPct) || 0;
      var sinds = akkoordSinds(b, s, faseNaam);
      push({
        kind: 'akkoord', id: str(s.projectId) + ':' + str(s.stageKey),
        titel: T.akkoordTitel(),
        sub: pct > 0 ? T.akkoordSubPct : T.akkoordSubGeen,
        vars: { fase: faseNaam(s.stageKey), faseSleutel: str(s.stageKey), pct: pct, product: projectNaam(p) },
        actie: 'akkoordGeven', actieLabel: T.akkoordKnop,
        urgent: urgentie(null, sinds, vandaag),
        at: sinds,
        projectId: s.projectId || null, raw: s.raw || s
      });
    });

    /* ---------- 3. open facturen ---------- */
    b.invoices.forEach(function (inv) {
      if (!isObj(inv) || !inv.id) return;
      var st = factuurStatusVoorKlant(inv, nu);
      if (!st.open) return;
      /* bezwaar gemeld: de bal ligt bij Steffan, de herinneringen staan
         stil — dus geen vraag aan de klant */
      if (st.bezwaar) return;
      var p = projectById(b, inv.projectId);
      var sub = '';
      if (st.vervaltISO) sub = st.verstreken ? T.factuurSubVerlopen : T.factuurSubVervalt;
      else if (st.deels) sub = T.factuurSubDeels;
      push({
        kind: 'factuur', id: inv.id,
        titel: T.factuurTitel(),
        sub: sub,
        detail: [str(inv.invoiceNumber), str(inv.label)].filter(function (x) { return !!x; }).join(' · '),
        vars: { product: projectNaam(p) },
        actie: 'betalingMelden', actieLabel: T.factuurKnop,
        secundair: { actie: 'factuurPdf', actieLabel: T.factuurKnop2 },
        urgent: st.verstreken,
        datumISO: st.vervaltISO,
        vervaltISO: st.vervaltISO,
        cents: st.openCents,
        valuta: st.valuta,
        factuurStatus: st,
        at: inv.publishedAt || inv.createdAt || null,
        projectId: inv.projectId || null, raw: inv
      });
    });

    /* ---------- 4. gesprekken waarin Steffan het laatst sprak ----------
       Zeven dagen lang is dat een uitnodiging om te reageren; daarna is
       het gewoon een afgerond gesprek in Berichten. Zonder die grens zou
       elke beantwoorde vraag van januari hier voor altijd "wachten". */
    b.questions.forEach(function (q) {
      if (!isObj(q) || !q.id) return;
      if (str(q.question).indexOf('HERBESTELLING:') === 0) return;
      var l = laatsteBeurt(q, b.questionMessages);
      if (!l || l.author !== 'staff') return;
      var oud = daysBetween(l.at, vandaag);
      if (oud === null || oud > VERS_DAGEN) return;
      var p = projectById(b, q.projectId);
      push({
        kind: 'vraag', id: q.id,
        titel: T.vraagTitel,
        sub: '',
        detail: str(q.question),
        vars: { product: projectNaam(p) },
        actie: 'berichtSturen', actieLabel: T.vraagKnop,
        urgent: false,
        at: l.at,
        projectId: q.projectId || null, raw: q
      });
    });

    /* ---------- 5. bestanden die van de klant worden verwacht ---------- */
    openKlantSlots(b).forEach(function (sl) {
      var p = projectById(b, sl.projectId);
      if (isArchived(p)) return;
      var dt = klantDocType(sl.docType);
      var verval = dayISO(sl.dueDate || sl.expectedBy);
      push({
        kind: 'bestand', id: sl.id,
        titel: dt ? T.bestandTitel[dt.key] : T.bestandTitel.anders,
        sub: sl.stageKey ? T.bestandSub : '',
        vars: { fase: faseNaam(sl.stageKey), faseSleutel: str(sl.stageKey), type: dt ? dt.label : str(sl.docType), typeSleutel: str(sl.docType), product: projectNaam(p) },
        actie: 'bestandAanleveren', actieLabel: T.bestandKnop,
        urgent: urgentie(verval, sl.createdAt, vandaag),
        datumISO: verval,
        at: sl.createdAt || null,
        projectId: sl.projectId || null, raw: sl
      });
    });

    /* ---------- 6. afgeronde producten zonder lopende herbestelling ---------- */
    b.projects.forEach(function (p) {
      var st = stagesVan(p.id);
      if (!productAfgerond(p, st)) return;
      if (herbestellingLoopt(b, p.id)) return;
      push({
        kind: 'herbestel', id: p.id,
        titel: T.herbestelTitel,
        sub: T.herbestelSub,
        vars: { product: projectNaam(p) },
        actie: 'herbestellen', actieLabel: T.herbestelKnop,
        urgent: false,
        at: laatsteAkkoord(st),
        projectId: p.id, raw: p
      });
    });

    /* Vaste volgorde: soort, dan urgent, dan het oudste item — wat het
       langst ligt is wat het langst wacht. Sleutel sluit de rij zodat de
       sortering stabiel is. */
    return stableSort(items, function (a, c) {
      var pa = PRIORITEIT[a.kind], pc = PRIORITEIT[c.kind];
      if (pa !== pc) return pa - pc;
      if (a.urgent !== c.urgent) return a.urgent ? -1 : 1;
      var ai = str(a.at), ci = str(c.at);
      if (ai !== ci) {
        if (!ai) return 1;
        if (!ci) return -1;
        return ai < ci ? -1 : 1;
      }
      return cmpText(a.sleutel, c.sleutel);
    });
  }

  /* maximaal vijf; een herbestelling staat altijd achteraan en valt als
     eerste af zodra er echt werk ligt */
  function watWeNodigHebben(bundle, nu, opties) {
    return verzamel(bundle, nu, opties).slice(0, MAX_NODIG);
  }

  /* de badge telt ALLES wat op de klant wacht — ook wat door de grens van
     vijf net niet op het Overzicht past — behalve de herbestelsuggestie,
     want die is geen werk */
  function aantalNodig(bundle, nu, opties) {
    var n = 0;
    verzamel(bundle, nu, opties).forEach(function (it) { if (it.kind !== 'herbestel') n++; });
    return n;
  }

  /* ============================================================
     11. BELANGRIJKE DATUMS — alleen wat de KLANT aangaat

     Vijf bronnen: het ETA-venster van een zending die nog onderweg is, de
     beslisdatum (of anders de beoordelingsdatum) van een sampleronde die
     op de klant wacht, de vervaldatum van een open factuur, de beloofde
     einddatum van het project, en een geplande update. GEEN antwoordklok,
     geen terugkeer uit uitstel, geen herinnering — dat is stafdata en die
     bereikt de bundel van de klant ook niet.

     Er wordt geen datum geprojecteerd: een factuur zonder vervaldatum
     staat niet op de kalender (aanmaak + 30 is een stafprojectie), een
     project zonder deadline heeft er geen. Een verzonnen datum is erger
     dan geen datum.

     Levert [{iso, soort, label, vars, projectId, urgent, verstreken,
     sleutel, vanISO, totISO}], op datum gesorteerd. Het scherm formatteert
     iso/vanISO/totISO zelf; de labels bevatten bewust geen datum.
     ============================================================ */

  function belangrijkeDatums(bundle, nu, opties) {
    var b = bronnen(bundle);
    var vandaag = todayOf(nu);
    var out = [];

    function add(spec) {
      var iso = dayISO(spec.iso);
      if (!iso) return;
      out.push({
        iso: iso,
        soort: spec.soort,
        label: spec.label,
        vars: spec.vars || {},
        projectId: spec.projectId || null,
        urgent: !!spec.urgent,
        verstreken: iso < vandaag,
        sleutel: spec.soort + ':' + str(spec.id),
        vanISO: dayISO(spec.van) || null,
        totISO: dayISO(spec.tot) || null,
        raw: spec.raw || null
      });
    }

    /* 1. ETA-vensters van zendingen die nog onderweg zijn */
    var geleverd = {};
    b.shipmentEvents.forEach(function (ev) {
      if (isObj(ev) && ev.milestoneKey === 'geleverd') geleverd[ev.shipmentId] = true;
    });
    b.shipments.forEach(function (s) {
      if (!isObj(s) || !s.id) return;
      if (s.deliveredAt || geleverd[s.id]) return;
      var einde = s.etaWindowEnd || s.etaWindowStart;
      if (!einde) return;
      var p = projectById(b, s.projectId);
      add({
        soort: 'eta', id: s.id, iso: einde, van: s.etaWindowStart, tot: s.etaWindowEnd,
        label: T.datumEta, vars: { product: projectNaam(p) },
        projectId: s.projectId, urgent: !!(dayISO(einde) && dayISO(einde) < vandaag), raw: s
      });
    });

    /* 2. samplerondes die op de klant wachten */
    wachtendeSamples(b).forEach(function (s) {
      var p = projectById(b, s.projectId);
      if (isArchived(p)) return;
      var beslis = dayISO(s.decisionDue);
      add({
        soort: 'sample', id: s.id, iso: beslis || s.roundDate,
        label: beslis ? T.datumSampleBeslis : T.datumSampleKlaar,
        vars: { x: str(s.roundLabel), product: projectNaam(p) },
        projectId: s.projectId, urgent: !!(beslis && beslis < vandaag), raw: s
      });
    });

    /* 3. vervaldatums van open facturen — alleen een echte */
    b.invoices.forEach(function (inv) {
      if (!isObj(inv) || !inv.id) return;
      var st = factuurStatusVoorKlant(inv, nu);
      if (!st.open || !st.vervaltISO) return;
      var p = projectById(b, inv.projectId);
      add({
        soort: 'factuur', id: inv.id, iso: st.vervaltISO,
        label: T.datumFactuur,
        vars: { x: str(inv.invoiceNumber || inv.label), product: projectNaam(p) },
        projectId: inv.projectId, urgent: st.verstreken && !st.bezwaar, raw: inv
      });
    });

    /* 4. de beloofde einddatum van het project (veld deadline, 0020) */
    b.projects.forEach(function (p) {
      if (!p.deadline) return;
      var d = dayISO(p.deadline);
      var klaar = productAfgerond(p, b.stages.filter(function (s) { return s.projectId === p.id; }));
      add({
        soort: 'deadline', id: p.id, iso: d,
        label: T.datumDeadline, vars: { product: projectNaam(p) },
        projectId: p.id, urgent: !!(d && d < vandaag && !klaar && !isArchived(p)), raw: p
      });
    });

    /* 5. geplande updates. Een ingeplande foto of document draagt
       scheduledAt; voor een echte klant houdt conceptGate() die rijen
       buiten de bundel, in de stafvoorvertoning komen ze wél mee. Er
       wordt dus niets verzonnen: staat er zo'n rij, dan is hij echt. */
    ['media', 'documents'].forEach(function (k) {
      b[k].forEach(function (r) {
        if (!isObj(r) || !r.id || !r.scheduledAt) return;
        var d = dayISO(r.scheduledAt);
        if (!d || d < vandaag) return;
        var p = projectById(b, r.projectId);
        add({
          soort: 'bericht', id: r.id, iso: d,
          label: T.datumBericht, vars: { product: projectNaam(p) },
          projectId: r.projectId, urgent: false, raw: r
        });
      });
    });

    return stableSort(out, function (a, c) {
      var r = cmpText(a.iso, c.iso);
      if (r) return r;
      r = cmpText(a.soort, c.soort);
      if (r) return r;
      return cmpText(a.sleutel, c.sleutel);
    });
  }

  /* ============================================================
     12. ACTIVITEIT — het klantzichtbare deel van mergeActivity()

     DIT IS EEN BEVEILIGINGSGRENS IN PRESENTATIE. CP_MODEL.mergeActivity
     voegt negen bronnen samen; drie daarvan zijn stafdata en die gaan hier
     al bij de INGANG weg, niet pas bij de uitgang:
       · mailLog    — het mail-logboek van het beheer (adressen, bezorgstatus)
       · auditLog   — het systeem-auditlogboek over stafhandelingen
       · contacts / moments — handmatig vastgelegde belletjes en bezoeken
       · drafts     — concepten en geplande publicaties
     Wat WEL doorgaat en waarom:
       · accessLog  — het toegangslogboek is per RLS al leesbaar voor de
                      eigen klant en het portaal toont het vandaag al
                      integraal (renderLog); ook de NNN-regels en de
                      eerlijke 'Voorvertoning door beheerder' horen daarbij
       · questions  — de klant stelde ze zelf; het antwoord is aan hem gericht
       · stages     — zijn eigen akkoorden (approvedAt)
       · shipments + shipmentEvents — De Reis staat al in het portaal
       · invoices   — gepubliceerde facturen en hun betaling; concepten
                      vallen af (conceptGate doet dat ook)
     Bij de UITGANG vallen dan nog af: soort 'mail', elke rij met een
     actietype (`actie` — dat draagt alleen het auditlogboek), en alles wat
     een intern-vlag draagt. Liever te weinig dan te veel.

     Scope is dezelfde als bij mergeActivity (projectId, kinds, from, to,
     limit); een gevraagde soort buiten de klantsoorten levert niets op.
     ============================================================ */

  /* De vijf klantacties van migratie 0021 (akkoord, samplekeuze, betaling,
     klantbestand, bezwaar) zijn wat de klant ZELF deed; die horen juist in
     zijn eigen tijdlijn. Zonder deze regel viel een gemelde betaling of een
     gegeven akkoord stil weg uit Activiteit. */
  var KLANT_SOORTEN = {
    klant: true, bestanden: true, financieel: true, systeem: true,
    akkoord: true, samplekeuze: true, betaling: true, klantbestand: true, bezwaar: true
  };

  function nietIntern(r) {
    if (!isObj(r)) return false;
    if (r.internal || r.intern || r.staffOnly || r.internOnly) return false;
    if (r.visibility === 'intern' || r.visibility === 'internal' || r.visibility === 'staff') return false;
    return true;
  }

  function activiteitVoorKlant(bronnenIn, scope) {
    var m = MODEL();
    if (!m || !isFn(m.mergeActivity)) return [];
    var b = bronnen(bronnenIn);
    var src = isObj(bronnenIn) ? bronnenIn : {};
    var sc = isObj(scope) ? scope : {};

    var veilig = {
      projects: b.projects,
      accessLog: b.accessLog.filter(nietIntern),
      questions: b.questions.filter(nietIntern),
      /* approvedBy en approvedVia reizen MEE: van een fase met approvedVia
         'portaal' maakt mergeActivity dezelfde regel als approve_stage() in
         het logboek schreef ("Fase goedgekeurd door <naam>: <fase>", op
         approvedAt) en ontdubbelt die tweeling. Zonder die twee velden werd
         het een naamloze tweede regel "Fase goedgekeurd: …" naast de
         logregel — het akkoord stond dubbel in de klanttijdlijn. */
      stages: b.stages.filter(function (s) { return !!s.approvedAt; }).map(function (s) {
        return {
          projectId: s.projectId, stageKey: s.stageKey, approvedAt: s.approvedAt, status: s.status,
          approvedBy: s.approvedBy, approvedVia: s.approvedVia
        };
      }),
      shipments: b.shipments.filter(nietIntern),
      shipmentEvents: b.shipmentEvents.filter(nietIntern),
      invoices: b.invoices.filter(function (inv) {
        return nietIntern(inv) && inv.publishStatus !== 'concept' && statusCodeVan(inv) !== 'draft' && statusCodeVan(inv) !== 'scheduled';
      }),
      stageLabel: isFn(src.stageLabel) ? src.stageLabel : undefined
    };

    /* gevraagde soorten snijden met de klantsoorten; vraagt het scherm
       uitsluitend om 'mail', dan is het antwoord leeg en niet 'alles' */
    var kinds = [];
    var gevraagd = 0;
    list(sc.kinds).forEach(function (k) {
      if (!k || k === 'alles') return;
      gevraagd++;
      if (KLANT_SOORTEN[k]) kinds.push(k);
    });
    if (gevraagd && !kinds.length) return [];

    var rows = m.mergeActivity(veilig, {
      projectId: sc.projectId || null,
      clientId: sc.clientId || null,
      kinds: kinds,
      from: sc.from || null,
      to: sc.to || null
    });

    var uit = [];
    list(rows).forEach(function (r) {
      if (!isObj(r)) return;
      if (!KLANT_SOORTEN[r.kind]) return;
      if (r.actie) return;
      uit.push(r);
    });
    var limit = (typeof sc.limit === 'number' && sc.limit > 0) ? sc.limit : 0;
    return limit ? uit.slice(0, limit) : uit;
  }

  /* ============================================================
     13. CONTACTROLLEN — de mailcategorieën uit het beheer

     Exact de zes sleutels van MAIL_PREF_CATS in beheer.html (en MAIL_CATS
     in admin-schermen-relaties.js). De SLEUTELS zijn opgeslagen waarden
     (mail_categories op client_contacts, mailPrefs op de klant); verandert
     daar ooit iets, dan hoort het hier mee te veranderen. De labels zijn
     de Nederlandse bron voor i18n.
     ============================================================ */

  var ROLLEN_CONTACT = [
    { key: 'fase',    label: 'Fase-updates' },
    { key: 'update',  label: 'Updates, documenten & antwoorden' },
    { key: 'sample',  label: 'Samples' },
    { key: 'zending', label: 'Zendingen' },
    { key: 'factuur', label: 'Facturen & herinneringen' },
    { key: 'relatie', label: 'Relatiemails (welkom, check-in, afscheid)' }
  ];

  /* ============================================================
     14. RONDE 3 — DE HELD: KORTE FASENAAM, UITLEG, KLANTOPMAAK,
         VERWACHTE LEVERING EN DE OPENINGSZIN

     Het portaal opent sinds ronde 3 met één zin ("Hoi Noor, je
     diffuservat zit in de fase Productie & controle. Eén ding wacht op
     jou."), een dunne fasebalk met zes stippen en één datum ("Verwacht
     bij jou: 18 okt"). Alles wat die drie nodig hebben staat hier, met
     dezelfde afspraken als de rest van het bestand: Nederlands als
     bronstring (het scherm haalt het door T()/Tpl()), "nu" als
     parameter, en niets wat de data niet zegt.
     ============================================================ */

  /* de zes fasesleutels in hun vaste volgorde (STAGE_ORDER in portal.html,
     STAGES in beheer.html, FASE_NAAM in demo-data-portaal.js) — het zijn
     opgeslagen waarden, dus dezelfde lijst als daar */
  var FASE_SLEUTELS = ['concept', 'dfm', 'sourcing', 'tooling', 'production', 'logistics'];

  /* sleutels zijn kleine letters zonder spaties; een rij die er anders
     uitziet is dezelfde fase, geen andere */
  function faseSleutel(v) { return str(v).replace(/^\s+|\s+$/g, '').toLowerCase(); }

  /* De korte klantnaam van een fase (NL bronstring). Een sleutel die hier
     niet bekend is, krijgt de lange naam van de aanroeper: langeNaam mag
     een tekst zijn of een stageLabel-functie (dezelfde haak als
     opties.stageLabel elders). Ontbreekt ook die, dan de kale sleutel —
     zichtbaar onaf, nooit een verzonnen naam. */
  function faseKort(stageKey, langeNaam) {
    var k = faseSleutel(stageKey);
    if (!k) return '';
    if (Object.prototype.hasOwnProperty.call(T.faseKort, k)) return T.faseKort[k];
    if (isFn(langeNaam)) {
      var uit = '';
      try { uit = str(langeNaam(str(stageKey))); } catch (e) { uit = ''; }
      return uit || str(stageKey);
    }
    return str(langeNaam) || str(stageKey);
  }

  /* één zin klantentaal (NL bronstring) of '' voor een onbekende fase; de
     duur erin komt uit de site van CUSTOM+ zelf, zie T.faseUitleg */
  function faseUitleg(stageKey) {
    var k = faseSleutel(stageKey);
    return Object.prototype.hasOwnProperty.call(T.faseUitleg, k) ? T.faseUitleg[k] : '';
  }

  /* Een bedrag zoals de klant het in de held leest: '€ 3.125' als het heel
     is, anders '€ 3.125,50'. Dezelfde tekens en dezelfde symboolregels als
     formatCents in admin-model.js (EUR/USD/CNY/JPY/GBP met teken, elke
     andere munt met haar ISO-code, een onleesbare code telt als EUR, een
     minteken vóór het valutateken). Die functie is daar NIET geëxporteerd,
     dus de regels staan hier als eigen exemplaar; mocht CP_MODEL hem ooit
     wél exporteren, dan wint die, zodat er nooit twee schrijfwijzen
     ontstaan. Alleen de ',00' valt weg: die zegt de klant niets en maakt
     een kaart vol bedragen onrustig. Zonder Intl, om dezelfde reden als
     daar: Node en browser moeten hetzelfde zeggen. */
  var VALUTA_TEKENS = { EUR: '€', USD: '$', CNY: '¥', JPY: '¥', GBP: '£' };

  function formatCentsTerugval(n, currency) {
    var code = str(currency || 'EUR').toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) code = 'EUR';
    var sym = VALUTA_TEKENS[code] || code;
    var neg = n < 0;
    if (neg) n = -n;
    var whole = Math.floor(n / 100), rest = n - whole * 100;
    var txt = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + pad2(rest);
    return (neg ? '-' : '') + sym + ' ' + txt;
  }

  function geldKlant(centsIn, currency) {
    /* eerst zelf naar gehele centen (cents() rondt af, formatCents knipt
       een tekst met parseInt), zodat beide wegen hetzelfde getal zien */
    var n = cents(centsIn);
    var m = MODEL();
    var vol = (m && isFn(m.formatCents)) ? str(m.formatCents(n, currency)) : formatCentsTerugval(n, currency);
    return vol.replace(/,00$/, '');
  }

  /* De delen van een korte datum: {dag, maand, jaar}. maand is de NL
     bronstring ('apr') die het scherm door T() haalt; jaar is het getal
     als het NIET het jaar van `nu` is, anders null — '24 apr' zegt genoeg
     in het lopende jaar, '24 apr 2025' is nodig zodra het een ander jaar
     is. Een tijdstempel met Z wordt eerst naar de LOKALE dag gelezen, via
     CP_MODEL.dateParts als die er is en anders het eigen exemplaar met
     dezelfde regels, zodat 23:30Z nooit een dag te vroeg op het scherm
     staat. Een kale dag blijft letterlijk. Onleesbaar → null. */
  function datumKortDelen(iso, nu) {
    var m = MODEL();
    var p = (m && isFn(m.dateParts)) ? m.dateParts(iso) : dateParts(iso);
    if (!p || !(p.m >= 1 && p.m <= 12)) return null;
    var jaarNu = +todayOf(nu).slice(0, 4);
    return { dag: p.d, maand: T.maanden[p.m - 1], jaar: p.y === jaarNu ? null : p.y };
  }

  /* '24 apr' of '24 apr 2025'; lege of ongeldige invoer → '' */
  function datumKort(iso, nu) {
    var d = datumKortDelen(iso, nu);
    if (!d) return '';
    return d.dag + ' ' + d.maand + (d.jaar === null ? '' : ' ' + d.jaar);
  }

  /* {datumISO, bron:'zending'|'planning', vanISO, totISO, projectId, id,
      sampleRoundId} of null — de datum achter 'Verwacht bij jou: {datum}'.

     Twee ECHTE bronnen, in deze rangorde:
       1. 'zending'  — het ETA-venster van een zending die nog niet is
                       geleverd: etaWindowEnd, anders etaWindowStart
                       (0002_shipments.sql), en voor een datalaag die het
                       anders noemt ook eta / etaISO / expectedAt. Een
                       productzending gaat vóór een samplezending
                       (sampleRoundId): de held gaat over het product; de
                       aanroeper ziet aan sampleRoundId wanneer het toch
                       een sample is. Daarbinnen wint de vroegste datum.
       2. 'planning' — projects.deadline (0020): de met de hand beloofde
                       einddatum. Alleen van een project dat niet is
                       gearchiveerd en niet af is; een leeg veld blijft
                       leeg, precies zoals de migratie het zegt.
     Er wordt NIETS afgeleid uit fases of doorlooptijden: "productie
     loopt, dus over zes weken" is een gok, en een gok staat niet in de
     held. Geen bron → null, en het scherm zegt 'Nog geen leverdatum'.
     projectId (optioneel) beperkt het antwoord tot één product van de
     plank. */
  function verwachteLevering(bundle, projectId) {
    var b = bronnen(bundle);
    var pid = str(projectId);
    var geleverd = {};
    b.shipmentEvents.forEach(function (ev) {
      if (isObj(ev) && ev.milestoneKey === 'geleverd') geleverd[ev.shipmentId] = true;
    });
    var beste = null, besteRang = 9;
    b.shipments.forEach(function (s) {
      if (!isObj(s) || !s.id) return;
      if (pid && str(s.projectId) !== pid) return;
      if (s.deliveredAt || geleverd[s.id]) return;
      var velden = [s.etaWindowEnd, s.etaWindowStart, s.eta, s.etaISO, s.expectedAt];
      var einde = null;
      for (var i = 0; i < velden.length && !einde; i++) einde = dayISO(velden[i]);
      if (!einde) return;
      var rang = s.sampleRoundId ? 1 : 0;
      if (beste && (rang > besteRang || (rang === besteRang && beste.datumISO <= einde))) return;
      besteRang = rang;
      beste = {
        datumISO: einde, bron: 'zending',
        vanISO: dayISO(s.etaWindowStart) || null, totISO: dayISO(s.etaWindowEnd) || null,
        projectId: s.projectId || null, id: s.id, sampleRoundId: s.sampleRoundId || null
      };
    });
    if (beste) return beste;
    b.projects.forEach(function (p) {
      if (pid && str(p.id) !== pid) return;
      if (isArchived(p)) return;
      var d = dayISO(p.deadline);
      if (!d) return;
      if (productAfgerond(p, b.stages.filter(function (s) { return s.projectId === p.id; }))) return;
      if (beste && beste.datumISO <= d) return;
      beste = { datumISO: d, bron: 'planning', vanISO: null, totISO: null, projectId: p.id, id: p.id, sampleRoundId: null };
    });
    return beste;
  }

  /* De voornaam van de ingelogde klant. De bundel draagt hem als
     klant.voornaam / klant.naam (de vorm van ctx.klant in portal.html),
     client.contactName / client.name, of contactName. Zonder naam blijft
     hij leeg en zegt het scherm gewoon 'Hoi' — een verzonnen naam is
     erger dan geen naam. */
  function voornaamVan(bundle) {
    var src = isObj(bundle) ? bundle : {};
    var k = isObj(src.klant) ? src.klant : {};
    var c = isObj(src.client) ? src.client : {};
    var naam = str(k.voornaam) || str(k.naam) || str(c.contactName) || str(c.name) || str(src.contactName);
    naam = naam.replace(/^\s+|\s+$/g, '');
    return naam ? naam.split(/\s+/)[0] : '';
  }

  /* De bouwstenen van de openingszin; de zin zelf bouwt het scherm met
     Tpl ('Hoi {naam}, je {product} zit in de fase {fase}. Eén ding wacht
     op jou.'):
       {naam, product, faseKort, nodig, faseSleutel, faseIndex, faseTotaal,
        klaar, projectId, aantalProducten}
     product is het open project (bundle.project), anders het eerste
     lopende project van de plank, anders het eerste project. faseKort is
     de korte naam van de huidige fase (huidigeFase, dezelfde als de ring),
     leeg zonder fases; klaar zegt dat alle fases af zijn, zodat het scherm
     dan een andere zin kiest. nodig telt via aantalNodig — dus alles wat
     op de klant wacht, zonder de herbestelsuggestie. */
  function begroeting(bundle, nu, opties) {
    var b = bronnen(bundle);
    var src = isObj(bundle) ? bundle : {};
    var p = isObj(src.project) ? (projectById(b, src.project.id) || src.project) : null;
    if (!p) b.projects.forEach(function (x) { if (!p && !isArchived(x)) p = x; });
    if (!p && b.projects.length) p = b.projects[0];
    var st = p ? b.stages.filter(function (s) { return s.projectId === p.id; }) : [];
    var v = voortgang(p, st);
    var cur = v.huidigeFase;
    return {
      naam: voornaamVan(bundle),
      product: projectNaam(p),
      faseKort: cur ? faseKort(cur.stageKey, stageLabeler(opties)) : '',
      nodig: aantalNodig(bundle, nu, opties),
      faseSleutel: cur ? str(cur.stageKey) : '',
      faseIndex: v.faseIndex,
      faseTotaal: v.totaal,
      klaar: v.klaar,
      projectId: p ? (p.id || null) : null,
      aantalProducten: b.projects.length
    };
  }

  /* ============================================================
     15. EXPORT — deze tabel is de hele API (zie kopblok)
     ============================================================ */
  return {
    VERSION: VERSION,
    VERS_DAGEN: VERS_DAGEN,

    SOORTEN_NODIG: SOORTEN_NODIG,
    ACTIES: ACTIES,
    ROLLEN_CONTACT: ROLLEN_CONTACT,
    KLANT_DOC_TYPES: KLANT_DOC_TYPES,
    REORDER_STAGES: REORDER_TERUGVAL,

    watWeNodigHebben: watWeNodigHebben,
    aantalNodig: aantalNodig,
    belangrijkeDatums: belangrijkeDatums,
    voortgang: voortgang,
    activiteitVoorKlant: activiteitVoorKlant,

    factuurStatusVoorKlant: factuurStatusVoorKlant,
    openstaandCents: openstaandCents,
    openstaandPerValuta: openstaandPerValuta,
    volgendeBetaling: volgendeBetaling,

    reorderStand: reorderStand,

    /* ronde 3 */
    FASE_SLEUTELS: FASE_SLEUTELS,
    faseKort: faseKort,
    faseUitleg: faseUitleg,
    geldKlant: geldKlant,
    datumKort: datumKort,
    datumKortDelen: datumKortDelen,
    verwachteLevering: verwachteLevering,
    begroeting: begroeting,

    vul: vul,
    metVars: metVars,
    dayISO: dayISO,
    daysBetween: daysBetween
  };
});
