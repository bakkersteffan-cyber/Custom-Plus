/* CUSTOM+ — herinneringen en aanmaningen.
   ------------------------------------------------------------------
   FASE 5. Pure module, geen IO — dezelfde afspraak als invoice-core,
   invoice-series, invoice-finalize, invoice-mail en invoice-payments.
   Deze module beslist WELKE herinnering wanneer klaar hoort te staan en
   HOE hij eruitziet; hij verstuurt niets en bewaart niets.

   ------------------------------------------------------------------
   DE EERLIJKE AFWIJKING — ER DRAAIT GEEN CRON

   De spec beschrijft een trap die vanzelf loopt. Deze stack is een
   statische site met serverloze functies die alleen bestaan terwijl er
   iemand op klikt: er is geen achtergrondproces en geen planner. Wat er
   dus werkelijk gebeurt:

     · de trap wordt geëvalueerd bij het OPENEN VAN HET BEHEER;
     · hoogstens één keer per dag per factuur (reminderEvaluatedOn), zodat
       vijf keer verversen niet vijf keer iets doet;
     · een stap die aan de beurt is wordt als CONCEPT klaargezet, met
       onderwerp en tekst al ingevuld;
     · VERZENDEN BLIJFT EEN BEWUSTE HANDELING. Nooit automatisch.

   Waarom die laatste regel er echt staat: een aanmaning die per ongeluk
   naar een klant gaat die gisteren heeft betaald, kost meer dan hij ooit
   oplevert. Zolang er niemand kijkt, kijkt er niemand.

   HOE DIT VOLLEDIG AUTOMATISCH WORDT (voor wie het later aanzet)
   Netlify Scheduled Functions kunnen een .mjs elke nacht draaien. Nodig:
     1. netlify/functions/invoice-reminder-cron.mjs met
        `export const config = { schedule: '0 6 * * *' }`;
     2. die functie leest met de service-role-sleutel alle openstaande
        facturen, roept evaluate() hieronder aan met exact dezelfde
        argumenten als het beheer, en schrijft de conceptrijen weg;
     3. voor automatisch verzenden: per stap een vinkje 'automatisch
        versturen' in de instellingen, en dan notify-client.mjs aanroepen
        zoals invSendMail() dat in beheer.html doet.
   Er hoeft aan DEZE module niets te veranderen: evaluate() is expres puur
   en tijdloos — je geeft hem 'vandaag' mee, hij verzint hem niet.
   ------------------------------------------------------------------

   RENTE EN INCASSOKOSTEN
   Optioneel, standaard uit, en nooit automatisch op een herinnering. De
   berekening staat hier omdat hij in gehele centen hoort en niet in een
   spreadsheet, maar het bedrag verschijnt pas op een aanmaning nadat de
   gebruiker het per keer heeft bevestigd. Zie interestCents() en
   collectionCostCents().

   Publieke API (globalThis.CP_REMINDERS, en module.exports in Node):
     VERSION, STEPS, TONES, BLOCKED_STATUSES, CLIENT_STRINGS
     defaultConfig() / normalizeConfig(cfg)
     plannedDate(dueDate, waitDays)
     eligible(invoice, settleRes)      {ok, reason}
     evaluate(input)                   welke stap staat er vandaag klaar
     renderStep(stepCfg, vars, t)      onderwerp + tekst in de klanttaal
     preview(config, sample, t)        alle stappen, vóór inschakelen
     interestCents(input)
     collectionCostCents(principal, opts)
     WIK_BRACKETS

   LADEN
     browser : <script src="portal/invoice-reminders.js"></script> ná
               portal/invoice-core.js
     node    : import '../portal/invoice-core.js';
               import '../portal/invoice-reminders.js';
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_REMINDERS = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '5.0.0';

  function core() {
    var c = (root && root.CP_INVOICE) ||
      (typeof globalThis !== 'undefined' ? globalThis.CP_INVOICE : null);
    if (!c) throw new Error('portal/invoice-core.js moet vóór portal/invoice-reminders.js geladen zijn.');
    return c;
  }
  function int(v) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return n < 0 ? -Math.round(-n) : Math.round(n);
  }
  function str(v, dflt) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? (dflt === undefined ? '' : dflt) : s;
  }

  /* kale datumrekenkunde op 'YYYY-MM-DD'. Bewust via UTC-middernacht: een
     vervaldatum is een kalenderdag en geen tijdstip, en zomertijd hoort er
     dus geen dag af of bij te halen. */
  function addDays(iso, days) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ''))) return '';
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(d.getTime())) return '';
    d.setUTCDate(d.getUTCDate() + Math.round(Number(days) || 0));
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(fromIso, toIso) {
    var a = new Date(String(fromIso).slice(0, 10) + 'T00:00:00Z');
    var b = new Date(String(toIso).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  /* ============================================================
     1. DE VIER STAPPEN UIT DE SPEC
     ============================================================
     step is ook de waarde van invoice_reminders.step in 0008_invoices.sql;
     99 is de losse handmatige herinnering en zit bewust niet in de trap.
     waitDays telt vanaf de VERVALDATUM — negatief dus vóór de vervaldag. */
  var STEPS = [
    { step: 0, key: 'vooraf',   label: 'Vriendelijke herinnering vóór de vervaldatum', waitDays: -3, tone: 'vriendelijk' },
    { step: 1, key: 'eerste',   label: 'Eerste herinnering na de vervaldatum',         waitDays: 3,  tone: 'vriendelijk' },
    { step: 2, key: 'tweede',   label: 'Tweede herinnering',                           waitDays: 10, tone: 'neutraal' },
    { step: 3, key: 'laatste',  label: 'Laatste aanmaning',                            waitDays: 21, tone: 'stevig' }
  ];
  var MANUAL_STEP = 99;
  var TONES = [
    { key: 'vriendelijk', label: 'Vriendelijk' },
    { key: 'neutraal', label: 'Neutraal' },
    { key: 'stevig', label: 'Stevig' }
  ];

  /* ============================================================
     2. DE STANDAARDTEKSTEN — NL-bron, vier vertalingen
     ============================================================
     Deze teksten gaan naar de KLANT en dus door i18nT/i18nTpl. Ze staan
     hier als bronstring zodat test/i18n-invoice.test.mjs één lijst heeft
     om af te lopen, precies zoals CLIENT_STRINGS in invoice-finalize.js.

     Past de gebruiker een tekst aan in de instellingen, dan wordt zijn
     eigen tekst gebruikt zoals hij hem typte — dan is er geen vertaling,
     en het scherm zegt dat er ook bij. Automatisch vertalen van iets wat
     iemand net zelf heeft geschreven zou een belofte zijn die deze stack
     niet kan waarmaken. */
  var DEFAULT_TEXTS = {
    0: {
      subject: 'Herinnering: factuur {nummer} vervalt {vervaldatum}',
      body: 'Beste {naam},\n\nEen vriendelijke herinnering: factuur {nummer} van {bedrag} vervalt op {vervaldatum}.\n\nIs de betaling al onderweg, dan kun je dit bericht als niet verzonden beschouwen.\n\nMet vriendelijke groet,\n{afzender}'
    },
    1: {
      subject: 'Factuur {nummer} staat nog open',
      body: 'Beste {naam},\n\nFactuur {nummer} van {bedrag} is op {vervaldatum} vervallen en staat nog open. Waarschijnlijk is het je ontgaan.\n\nHet openstaande bedrag is {openstaand}. Klopt er iets niet, laat het dan weten — dan lossen we het samen op.\n\nMet vriendelijke groet,\n{afzender}'
    },
    2: {
      subject: 'Tweede herinnering: factuur {nummer}',
      body: 'Beste {naam},\n\nFactuur {nummer} van {bedrag} staat sinds {vervaldatum} open. Het openstaande bedrag is {openstaand}.\n\nWe hebben nog geen betaling ontvangen en ook geen bericht. Wil je de betaling deze week in orde maken, of laten weten waar het aan ligt?\n\nMet vriendelijke groet,\n{afzender}'
    },
    3: {
      subject: 'Laatste aanmaning: factuur {nummer}',
      body: 'Beste {naam},\n\nOndanks eerdere herinneringen staat factuur {nummer} nog open. Het openstaande bedrag is {openstaand}, vervallen op {vervaldatum}.\n\nDit is de laatste aanmaning. Zonder betaling of bericht binnen veertien dagen dragen we de vordering over.\n\nMet vriendelijke groet,\n{afzender}'
    },
    99: {
      subject: 'Over factuur {nummer}',
      body: 'Beste {naam},\n\nFactuur {nummer} van {bedrag} staat nog open; het openstaande bedrag is {openstaand}.\n\nMet vriendelijke groet,\n{afzender}'
    }
  };

  /* Alles wat hierboven naar de klant gaat, als platte lijst voor de
     woordenboektest. De {plaatshouders} moeten in elke vertaling blijven
     staan; die test bewaakt dat ook. */
  var CLIENT_STRINGS = (function () {
    var out = [];
    Object.keys(DEFAULT_TEXTS).forEach(function (k) {
      out.push(DEFAULT_TEXTS[k].subject);
      out.push(DEFAULT_TEXTS[k].body);
    });
    out.push('Rente over de te late betaling');
    out.push('Buitengerechtelijke incassokosten');
    return out;
  })();

  /* ============================================================
     3. DE INSTELLINGEN
     ============================================================ */
  function defaultConfig() {
    return {
      aan: false,
      stappen: STEPS.map(function (s) {
        return {
          step: s.step,
          aan: true,
          wachtdagen: s.waitDays,
          toon: s.tone,
          onderwerp: '',          /* leeg = de vertaalde standaardtekst */
          tekst: ''
        };
      }),
      /* rente en incassokosten: allebei standaard uit, en allebei alleen
         als VOORSTEL. Zie de kop van dit bestand. */
      rente: { aan: false, jaarPctMilli: 8000, vanafStap: 2 },   /* 8,000% */
      incasso: { aan: false, methode: 'wik', vastBedragCents: 4000, vanafStap: 3 }
    };
  }

  function normalizeConfig(cfg) {
    var d = defaultConfig();
    cfg = (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) ? cfg : {};
    var byStep = {};
    (Array.isArray(cfg.stappen) ? cfg.stappen : []).forEach(function (s) {
      if (s && s.step !== undefined) byStep[int(s.step)] = s;
    });
    var out = {
      aan: !!cfg.aan,
      stappen: d.stappen.map(function (def) {
        var s = byStep[def.step] || {};
        var wacht = (s.wachtdagen === undefined || s.wachtdagen === null) ? def.wachtdagen : int(s.wachtdagen);
        /* stap 0 hoort vóór de vervaldatum te liggen en de rest erna. Een
           omgedraaide waarde is bijna altijd een typefout en zou de trap
           stil in de verkeerde volgorde zetten. */
        if (def.step === 0 && wacht > 0) wacht = -wacht;
        if (def.step > 0 && wacht < 0) wacht = -wacht;
        var toon = str(s.toon, def.toon);
        var known = false;
        for (var i = 0; i < TONES.length; i++) if (TONES[i].key === toon) known = true;
        return {
          step: def.step,
          aan: s.aan === undefined ? def.aan : !!s.aan,
          wachtdagen: wacht,
          toon: known ? toon : def.toon,
          onderwerp: str(s.onderwerp),
          tekst: str(s.tekst)
        };
      }),
      rente: {
        aan: !!(cfg.rente && cfg.rente.aan),
        jaarPctMilli: Math.max(0, int((cfg.rente && cfg.rente.jaarPctMilli) !== undefined ? cfg.rente.jaarPctMilli : d.rente.jaarPctMilli)),
        vanafStap: Math.min(3, Math.max(0, int((cfg.rente && cfg.rente.vanafStap) !== undefined ? cfg.rente.vanafStap : d.rente.vanafStap)))
      },
      incasso: {
        aan: !!(cfg.incasso && cfg.incasso.aan),
        methode: (cfg.incasso && cfg.incasso.methode === 'vast') ? 'vast' : 'wik',
        vastBedragCents: Math.max(0, int((cfg.incasso && cfg.incasso.vastBedragCents) !== undefined ? cfg.incasso.vastBedragCents : d.incasso.vastBedragCents)),
        vanafStap: Math.min(3, Math.max(0, int((cfg.incasso && cfg.incasso.vanafStap) !== undefined ? cfg.incasso.vanafStap : d.incasso.vanafStap)))
      }
    };
    /* de stappen moeten oplopen: een tweede herinnering vóór de eerste is
       geen trap maar een stapel. */
    for (var i = 1; i < out.stappen.length; i++) {
      if (out.stappen[i].wachtdagen <= out.stappen[i - 1].wachtdagen) {
        out.stappen[i].wachtdagen = out.stappen[i - 1].wachtdagen + 1;
      }
    }
    return out;
  }

  function stepConfig(config, step) {
    var c = normalizeConfig(config);
    for (var i = 0; i < c.stappen.length; i++) if (c.stappen[i].step === int(step)) return c.stappen[i];
    return null;
  }
  function stepMeta(step) {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].step === int(step)) return STEPS[i];
    return { step: MANUAL_STEP, key: 'handmatig', label: 'Losse herinnering', waitDays: 0, tone: 'neutraal' };
  }

  function plannedDate(dueDate, waitDays) {
    return addDays(dueDate, waitDays);
  }

  /* een percentage in pctMilli als Nederlandse tekst, met quotient en rest
     in plaats van een deling door 1000 met een kommagetal: 8000 wordt "8",
     5500 wordt "5,5". Alleen voor de meldingen in dit bestand. */
  function pctNl(milli) {
    var n = int(milli);
    var neg = n < 0;
    if (neg) n = -n;
    var whole = Math.floor(n / 1000);
    var rest = String(1000 + (n % 1000)).slice(1).replace(/0+$/, '');
    return (neg ? '-' : '') + whole + (rest ? ',' + rest : '');
  }

  /* ============================================================
     4. MAG DEZE FACTUUR EEN HERINNERING KRIJGEN?
     ============================================================
     De spec noemt vier statussen waarbij er nooit iets uit mag gaan.
     Daar komen er in de praktijk drie bij die net zo hard zijn: een
     concept bestaat voor de klant niet, en een betaalde factuur heeft
     niets meer te vragen. */
  var BLOCKED_STATUSES = ['disputed', 'credited', 'uncollectible', 'cancelled'];
  var NOT_YET_STATUSES = ['draft', 'scheduled'];

  function eligible(invoice, settleRes) {
    invoice = invoice || {};
    var status = String(invoice.statusCode || invoice.status_code || 'draft');
    if (NOT_YET_STATUSES.indexOf(status) > -1) {
      return { ok: false, code: 'concept', reason: 'Deze factuur is nog een concept; er valt niets aan te herinneren.' };
    }
    if (BLOCKED_STATUSES.indexOf(status) > -1) {
      return {
        ok: false, code: 'status_geblokkeerd',
        reason: 'Bij status “' + (core().STATUS_META[status] ? core().STATUS_META[status].label : status) +
          '” gaat er geen herinnering uit. Dat is een harde regel, geen instelling.'
      };
    }
    if (status === 'paid') {
      return { ok: false, code: 'betaald', reason: 'Deze factuur is betaald. De trap stopt automatisch.' };
    }
    var s = settleRes || {};
    if (s.code === 'paid' || s.code === 'overpaid') {
      return { ok: false, code: 'betaald', reason: 'Er staat niets meer open. De trap stopt automatisch.' };
    }
    if (invoice.reminderPaused || invoice.reminder_paused) {
      return { ok: false, code: 'gepauzeerd', reason: 'De herinneringen voor deze factuur staan handmatig op pauze.' };
    }
    if (!(invoice.dueDate || invoice.due_date)) {
      return { ok: false, code: 'geen_vervaldatum', reason: 'Zonder vervaldatum is er geen moment om vanaf te tellen.' };
    }
    return { ok: true, code: '', reason: '' };
  }

  /* ============================================================
     5. DE EVALUATIE — idempotent, hoogstens één keer per dag
     ============================================================
     input:
       invoice     {statusCode, dueDate, reminderPaused, reminderEvaluatedOn}
       config      de instellingen (mag ruw)
       existing    de al bestaande invoice_reminders-rijen
       settle      de uitkomst van CP_PAYMENTS.settle()
       today       'YYYY-MM-DD' — MEEGEVEN, nooit zelf verzinnen
       force       de dagslot-controle overslaan (handmatig 'nu evalueren')

     uitkomst:
       {ran, alreadyToday, eligible, reason, due[], skipped[], nextStep}
       due bevat HOOGSTENS ÉÉN stap. Twee aanmaningen op één dag is geen
       trap maar een lawine, en een stap die te laat wordt opgemerkt hoort
       niet meteen zijn opvolger mee te slepen.

     IDEMPOTENTIE, twee sloten:
       · een stap die al een rij heeft (welke status dan ook) komt nooit
         terug — ook niet als hij is overgeslagen of mislukt;
       · per factuur wordt er hoogstens één keer per dag geëvalueerd
         (reminderEvaluatedOn). Vijf keer verversen doet vier keer niets.
     In Supabase komt daar de unieke index invoice_reminders_step_uniq
     overheen, want twee tabbladen tegelijk wint van elke JavaScript. */
  function evaluate(input) {
    input = input || {};
    var inv = input.invoice || {};
    var today = String(input.today || '').slice(0, 10);
    var cfg = normalizeConfig(input.config);
    var existing = input.existing || [];
    var out = {
      ran: false, alreadyToday: false, eligible: false, reason: '',
      due: [], skipped: [], nextStep: null, config: cfg
    };

    if (!today) { out.reason = 'Er is geen datum meegegeven om mee te rekenen.'; return out; }
    if (!cfg.aan) { out.reason = 'De herinneringstrap staat uit.'; return out; }

    var lastEval = String(inv.reminderEvaluatedOn || inv.reminder_evaluated_on || '').slice(0, 10);
    if (!input.force && lastEval && lastEval >= today) {
      out.alreadyToday = true;
      out.reason = 'Deze factuur is vandaag al beoordeeld.';
      return out;
    }

    var elig = eligible(inv, input.settle);
    out.eligible = elig.ok;
    if (!elig.ok) { out.ran = true; out.reason = elig.reason; return out; }

    var due = String(inv.dueDate || inv.due_date || '').slice(0, 10);
    var done = {};
    for (var i = 0; i < existing.length; i++) {
      var r = existing[i] || {};
      var st = int(r.step);
      if (st !== MANUAL_STEP) done[st] = String(r.status || 'gepland');
    }

    out.ran = true;
    for (var j = 0; j < cfg.stappen.length; j++) {
      var s = cfg.stappen[j];
      var meta = stepMeta(s.step);
      var when = plannedDate(due, s.wachtdagen);
      if (!s.aan) { out.skipped.push({ step: s.step, label: meta.label, reason: 'staat uit' }); continue; }
      if (done[s.step] !== undefined) {
        out.skipped.push({ step: s.step, label: meta.label, reason: 'staat al klaar of is al verstuurd (' + done[s.step] + ')' });
        continue;
      }
      if (when > today) {
        if (!out.nextStep) out.nextStep = { step: s.step, label: meta.label, plannedFor: when, daysAway: daysBetween(today, when) };
        out.skipped.push({ step: s.step, label: meta.label, reason: 'staat gepland voor ' + when });
        continue;
      }
      if (out.due.length) {
        out.skipped.push({ step: s.step, label: meta.label, reason: 'wacht tot de vorige stap is verstuurd' });
        continue;
      }
      out.due.push({
        step: s.step, label: meta.label, plannedFor: when,
        waitDays: s.wachtdagen, tone: s.toon,
        daysOverdue: daysBetween(due, today)
      });
    }
    if (!out.due.length && !out.reason) {
      out.reason = out.nextStep
        ? ('De volgende stap staat gepland voor ' + out.nextStep.plannedFor + '.')
        : 'Alle stappen van de trap zijn geweest.';
    }
    return out;
  }

  /* ============================================================
     6. DE TEKST
     ============================================================
     t is de vertaalfunctie van de aanroeper (invT in het beheer, i18nT in
     het portaal). Ontbreekt hij, dan blijft het Nederlands staan — nooit
     een lege string en nooit een rauwe sleutel. */
  function fill(tpl, vars) {
    return String(tpl || '').replace(/\{([a-z]+)\}/g, function (m, k) {
      return (vars && vars[k] !== undefined && vars[k] !== null) ? String(vars[k]) : m;
    });
  }
  function renderStep(stepCfg, vars, t) {
    stepCfg = stepCfg || {};
    var step = int(stepCfg.step);
    var def = DEFAULT_TEXTS[step] || DEFAULT_TEXTS[MANUAL_STEP];
    var tr = (typeof t === 'function') ? t : function (s) { return s; };
    /* eigen tekst wint, en wordt NIET vertaald: hij is al geschreven in de
       taal die de gebruiker koos. Het scherm zegt dat erbij. */
    var eigenOnderwerp = str(stepCfg.onderwerp);
    var eigenTekst = str(stepCfg.tekst);
    return {
      step: step,
      custom: !!(eigenOnderwerp || eigenTekst),
      subject: fill(eigenOnderwerp || tr(def.subject), vars),
      body: fill(eigenTekst || tr(def.body), vars),
      tone: str(stepCfg.toon, stepMeta(step).tone)
    };
  }

  /* Alle stappen naast elkaar, zodat je vóór het inschakelen kunt zien wat
     een klant precies zou krijgen. De spec vraagt hier letterlijk om. */
  function preview(config, sample, t) {
    var cfg = normalizeConfig(config);
    var vars = sample || {};
    return cfg.stappen.map(function (s) {
      var meta = stepMeta(s.step);
      var r = renderStep(s, vars, t);
      r.label = meta.label;
      r.aan = s.aan;
      r.waitDays = s.wachtdagen;
      r.plannedFor = vars.vervaldatumIso ? plannedDate(vars.vervaldatumIso, s.wachtdagen) : '';
      return r;
    });
  }

  /* ============================================================
     7. RENTE — gehele centen, geen kommagetal
     ============================================================
     rente = hoofdsom × jaarpercentage × dagen / (100 × 365)
     Alle vier de factoren zijn gehele getallen; de enkele deling loopt via
     divRound uit de rekenkern. Er wordt met 365 dagen gerekend (de
     wettelijke handelsrente rekent per dag over een kalenderjaar); een
     schrikkeljaar geeft dus hoogstens een cent verschil en dat is een
     bewuste, uitlegbare keuze in plaats van een verborgen jaarcorrectie. */
  function interestCents(input) {
    input = input || {};
    var C = core();
    var principal = int(input.principalCents);
    var pctMilli = Math.max(0, int(input.annualPctMilli));
    var days = int(input.days);
    if (principal <= 0 || pctMilli <= 0 || days <= 0) {
      return { cents: 0, days: days > 0 ? days : 0, annualPctMilli: pctMilli, principalCents: principal };
    }
    /* teller = hoofdsom × pctMilli × dagen; noemer = 100 × 1000 × 365 */
    var numer = principal * pctMilli * days;
    var denom = 100 * 1000 * 365;
    return {
      cents: C.divRound(numer, denom),
      days: days,
      annualPctMilli: pctMilli,
      principalCents: principal
    };
  }

  /* ============================================================
     8. INCASSOKOSTEN
     ============================================================
     Twee methoden, allebei optioneel:

     'wik'  de staffel uit het Besluit vergoeding voor buitengerechtelijke
            incassokosten. Vijf schijven, een minimum van € 40 en een
            maximum van € 6.775. Dit is de Nederlandse standaard en dus de
            enige staffel die hier staat — een tweede land erbij zou een
            tabel per rechtsgebied vragen en dat kost een eenmanszaak meer
            dan het oplevert.
     'vast' één bedrag dat de gebruiker zelf invult, voor wie iets anders
            met zijn klant heeft afgesproken.

     Alles in gehele centen; elk percentage loopt via divRound. */
  var WIK_BRACKETS = [
    { upToCents: 250000,   pctMilli: 15000 },   /* 15%  over de eerste € 2.500 */
    { upToCents: 250000,   pctMilli: 10000 },   /* 10%  over de volgende € 2.500 */
    { upToCents: 500000,   pctMilli: 5000 },    /*  5%  over de volgende € 5.000 */
    { upToCents: 19000000, pctMilli: 1000 },    /*  1%  over de volgende € 190.000 */
    { upToCents: null,     pctMilli: 500 }      /*  0,5% over de rest */
  ];
  var WIK_MIN_CENTS = 4000;
  var WIK_MAX_CENTS = 677500;

  function collectionCostCents(principalCents, opts) {
    opts = opts || {};
    var C = core();
    var principal = int(principalCents);
    if (principal <= 0) return { cents: 0, method: opts.methode === 'vast' ? 'vast' : 'wik', detail: 'Er staat niets open.' };
    if (opts.methode === 'vast') {
      var vast = Math.max(0, int(opts.vastBedragCents));
      return { cents: vast, method: 'vast', detail: 'Vast bedrag uit de instellingen.' };
    }
    var rest = principal, total = 0, i;
    for (i = 0; i < WIK_BRACKETS.length; i++) {
      if (rest <= 0) break;
      var b = WIK_BRACKETS[i];
      var slice = (b.upToCents === null) ? rest : Math.min(rest, b.upToCents);
      total += C.divRound(slice * b.pctMilli, 100 * 1000);
      rest -= slice;
    }
    var capped = false, floored = false;
    if (total < WIK_MIN_CENTS) { total = WIK_MIN_CENTS; floored = true; }
    if (total > WIK_MAX_CENTS) { total = WIK_MAX_CENTS; capped = true; }
    return {
      cents: total, method: 'wik',
      floored: floored, capped: capped,
      detail: 'Staffel uit het Besluit vergoeding voor buitengerechtelijke incassokosten' +
        (floored ? ', met het wettelijke minimum van € 40,00' : '') +
        (capped ? ', met het wettelijke maximum van € 6.775,00' : '') + '.'
    };
  }

  /* Wat er op een aanmaning bíj zou komen als de gebruiker het bevestigt.
     Deze functie voegt niets toe en zet niets aan: hij rekent alleen voor.
     De aanroeper toont het en vraagt om bevestiging — dat is de eis uit de
     spec, letterlijk: "nooit automatisch zonder bevestiging". */
  function extrasFor(input) {
    input = input || {};
    var cfg = normalizeConfig(input.config);
    var step = int(input.step);
    var outstanding = int(input.outstandingCents);
    var out = { renteCents: 0, incassoCents: 0, totalCents: 0, items: [], bevestigingNodig: false };
    if (outstanding <= 0) return out;

    if (cfg.rente.aan && step >= cfg.rente.vanafStap) {
      var r = interestCents({
        principalCents: outstanding,
        annualPctMilli: cfg.rente.jaarPctMilli,
        days: int(input.daysOverdue)
      });
      if (r.cents > 0) {
        out.renteCents = r.cents;
        out.items.push({
          key: 'rente', labelNl: 'Rente over de te late betaling', cents: r.cents,
          detail: pctNl(cfg.rente.jaarPctMilli) + '% per jaar over ' + r.days + ' dagen'
        });
      }
    }
    if (cfg.incasso.aan && step >= cfg.incasso.vanafStap) {
      var c = collectionCostCents(outstanding, cfg.incasso);
      if (c.cents > 0) {
        out.incassoCents = c.cents;
        out.items.push({ key: 'incasso', labelNl: 'Buitengerechtelijke incassokosten', cents: c.cents, detail: c.detail });
      }
    }
    out.totalCents = out.renteCents + out.incassoCents;
    out.bevestigingNodig = out.totalCents > 0;
    return out;
  }

  return {
    VERSION: VERSION,
    STEPS: STEPS,
    MANUAL_STEP: MANUAL_STEP,
    TONES: TONES,
    BLOCKED_STATUSES: BLOCKED_STATUSES,
    DEFAULT_TEXTS: DEFAULT_TEXTS,
    CLIENT_STRINGS: CLIENT_STRINGS,
    defaultConfig: defaultConfig,
    normalizeConfig: normalizeConfig,
    stepConfig: stepConfig,
    stepMeta: stepMeta,
    plannedDate: plannedDate,
    addDays: addDays,
    daysBetween: daysBetween,
    eligible: eligible,
    evaluate: evaluate,
    renderStep: renderStep,
    /* fill() staat in de publieke API omdat een tekst twee keer langs de
       invulwaarden kan komen: één keer bij het klaarzetten (waar niet elke
       waarde bekend is) en één keer bij het openen van het verzendscherm
       (waar de klant en het project er wél zijn). Een plaatshouder die
       blijft staan is een {naam} in de mailbox van de klant. */
    fill: fill,
    preview: preview,
    interestCents: interestCents,
    collectionCostCents: collectionCostCents,
    extrasFor: extrasFor,
    WIK_BRACKETS: WIK_BRACKETS,
    WIK_MIN_CENTS: WIK_MIN_CENTS,
    WIK_MAX_CENTS: WIK_MAX_CENTS
  };
});
