/* CUSTOM+ — terugkerende facturen.
   ------------------------------------------------------------------
   FASE 5. Pure module, geen IO. Het profiel staat LOS van de facturen die
   eruit rollen: wie het profiel aanpast, verandert nooit met terugwerkende
   kracht iets aan een al verstuurde factuur. Elke gegenereerde factuur is
   een gewoon concept dat daarna door dezelfde acht stappen gaat en dus
   zijn eigen snapshot krijgt.

   ------------------------------------------------------------------
   IDEMPOTENTIE — DE KERN VAN DEZE MODULE

   Een terugkerend profiel dat twee keer draait, mag nooit twee facturen
   voor dezelfde periode opleveren. Dat is hier op drie manieren
   dichtgetimmerd, en ze staan er alle drie omdat de eerste twee kunnen
   falen:

     1. DE PERIODESLEUTEL. Elke generatie hangt aan een sleutel als
        '2026-03', '2026-Q2' of '2026-W12'. plan() geeft alleen sleutels
        terug die nog niet in `existingKeys` staan. Dat is de logica.
     2. HET PROFIEL ONTHOUDT ZIJN LAATSTE SLEUTEL (lastPeriodKey). Dat
        vangt de tweede evaluatie in dezelfde sessie af, ook als de
        aanroeper zijn lijst niet ververst heeft.
     3. DE DATABASE. recurring_runs heeft een unieke index op
        (profile_id, period_key). Dat is de énige garantie die overleeft
        wanneer twee beheertabbladen op hetzelfde moment evalueren — code
        verliest dat gevecht altijd, een unieke index niet.

   ------------------------------------------------------------------
   TIJDZONEBEWUST — EN WAT DAT HIER ECHT BETEKENT

   Een factuurdatum is een KALENDERDAG, geen tijdstip. "De eerste van de
   maand" is in Amsterdam een andere seconde dan in Jakarta, en een
   generatie die op UTC-middernacht draait, zet in Amsterdam een factuur op
   de laatste dag van de vórige maand. Daarom:

     · elke datum in dit bestand is 'YYYY-MM-DD' en wordt met UTC-
       middernacht gerekend, zodat zomertijd er nooit een dag af haalt;
     · welke dag het IS in de tijdzone van het profiel, komt uit
       todayIn(tz) — Intl.DateTimeFormat met 'en-CA' geeft precies
       'YYYY-MM-DD' en zit in elke browser en in Node, zonder library.
   Kent de omgeving de tijdzone niet, dan valt todayIn() terug op de lokale
   datum en zegt dat erbij (`fallback: true`) in plaats van stilzwijgend
   iets anders te doen.

   ------------------------------------------------------------------
   DEZELFDE EERLIJKE AFWIJKING ALS BIJ DE HERINNERINGEN

   Er draait geen cron. plan() wordt uitgevoerd wanneer het beheer opent,
   hoogstens één keer per dag per profiel (lastEvaluatedOn), en zet de
   factuur klaar als CONCEPT — of, als de gebruiker dat expliciet heeft
   aangezet, meteen definitief. Automatisch VERSTUREN staat standaard uit.
   Hoe dit met een Netlify Scheduled Function volledig automatisch wordt,
   staat in docs/factuurmodule.md §17.

   Publieke API (globalThis.CP_RECURRING, en module.exports in Node):
     VERSION, FREQUENCIES, STATUSES
     normalizeProfile(p)
     todayIn(tz) / periodKey(iso, freq) / periodBounds(iso, freq)
     advance(iso, freq, count)
     nextRunDate(profile)
     plan(input)                  welke perioden staan er open
     draftFrom(profile, input)    het concept: head + regels
     applyIndexation(lines, pctMilli)
     pause(p) / resume(p) / markError(p, msg) / markSuccess(p, key, iso)

   LADEN
     browser : <script src="portal/invoice-recurring.js"></script> ná
               portal/invoice-core.js
     node    : import '../portal/invoice-core.js';
               import '../portal/invoice-recurring.js';
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  root.CP_RECURRING = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = '5.0.0';

  function core() {
    var c = (root && root.CP_INVOICE) ||
      (typeof globalThis !== 'undefined' ? globalThis.CP_INVOICE : null);
    if (!c) throw new Error('portal/invoice-core.js moet vóór portal/invoice-recurring.js geladen zijn.');
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
  function isIso(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function d(iso) { return new Date(String(iso).slice(0, 10) + 'T00:00:00Z'); }
  function iso(dt) { return dt.toISOString().slice(0, 10); }

  /* ============================================================
     1. FREQUENTIES
     ============================================================ */
  var FREQUENCIES = [
    { key: 'week',      label: 'Per week',      months: 0, days: 7 },
    { key: 'month',     label: 'Per maand',     months: 1, days: 0 },
    { key: 'quarter',   label: 'Per kwartaal',  months: 3, days: 0 },
    { key: 'half_year', label: 'Per half jaar', months: 6, days: 0 },
    { key: 'year',      label: 'Per jaar',      months: 12, days: 0 }
  ];
  var FREQ_KEYS = FREQUENCIES.map(function (f) { return f.key; });
  function freqDef(key) {
    for (var i = 0; i < FREQUENCIES.length; i++) if (FREQUENCIES[i].key === key) return FREQUENCIES[i];
    return FREQUENCIES[1];
  }
  var STATUSES = ['actief', 'gepauzeerd', 'beeindigd', 'fout'];

  /* ============================================================
     2. TIJDZONE
     ============================================================ */
  function todayIn(tz, now) {
    var when = now ? new Date(now) : new Date();
    if (isNaN(when.getTime())) when = new Date();
    try {
      /* 'en-CA' levert per definitie YYYY-MM-DD op. Dat is geen truc maar
         de gedocumenteerde vorm van die locale, en hij scheelt een eigen
         parser voor de onderdelen van formatToParts(). */
      var s = new Intl.DateTimeFormat('en-CA', {
        timeZone: String(tz || 'Europe/Amsterdam'),
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(when);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, timeZone: String(tz || 'Europe/Amsterdam'), fallback: false };
    } catch (e) { /* onbekende tijdzone of geen Intl */ }
    var y = when.getFullYear();
    var m = when.getMonth() + 1;
    var dd = when.getDate();
    return {
      date: y + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd,
      timeZone: '(lokale tijd)',
      fallback: true
    };
  }

  /* ============================================================
     3. PERIODEN
     ============================================================
     De sleutel is menselijk leesbaar en sorteerbaar. Hij is ook de sleutel
     in recurring_runs, dus hij moet stabiel zijn: dezelfde datum en
     frequentie geven altijd dezelfde sleutel, in elke tijdzone en in elk
     jaar. */
  function isoWeek(dt) {
    /* ISO 8601: week 1 is de week met de eerste donderdag. */
    var t = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
    var day = t.getUTCDay() || 7;              /* maandag = 1, zondag = 7 */
    t.setUTCDate(t.getUTCDate() + 4 - day);    /* naar de donderdag van deze week */
    var jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((t - jan1) / 86400000 + 1) / 7);
    return { year: t.getUTCFullYear(), week: week };
  }

  function periodKey(isoDate, frequency) {
    if (!isIso(isoDate)) return '';
    var dt = d(isoDate);
    if (isNaN(dt.getTime())) return '';
    var y = dt.getUTCFullYear();
    var m = dt.getUTCMonth() + 1;
    switch (frequency) {
      case 'week': {
        var w = isoWeek(dt);
        return w.year + '-W' + (w.week < 10 ? '0' : '') + w.week;
      }
      case 'quarter':   return y + '-Q' + Math.ceil(m / 3);
      case 'half_year': return y + '-H' + (m <= 6 ? 1 : 2);
      case 'year':      return String(y);
      default:          return y + '-' + (m < 10 ? '0' : '') + m;
    }
  }

  /* de eerste en laatste dag van de periode waarin isoDate valt. Dit wordt
     de leverings-/prestatieperiode op de factuur, want dát is waar de
     klant voor betaalt. */
  function periodBounds(isoDate, frequency) {
    if (!isIso(isoDate)) return { start: '', end: '' };
    var dt = d(isoDate);
    var y = dt.getUTCFullYear(), m = dt.getUTCMonth();
    var s, e;
    switch (frequency) {
      case 'week': {
        var day = dt.getUTCDay() || 7;
        s = new Date(dt); s.setUTCDate(s.getUTCDate() - (day - 1));
        e = new Date(s);  e.setUTCDate(e.getUTCDate() + 6);
        break;
      }
      case 'quarter': {
        var q = Math.floor(m / 3) * 3;
        s = new Date(Date.UTC(y, q, 1));
        e = new Date(Date.UTC(y, q + 3, 0));
        break;
      }
      case 'half_year': {
        var h = m < 6 ? 0 : 6;
        s = new Date(Date.UTC(y, h, 1));
        e = new Date(Date.UTC(y, h + 6, 0));
        break;
      }
      case 'year':
        s = new Date(Date.UTC(y, 0, 1));
        e = new Date(Date.UTC(y, 12, 0));
        break;
      default:
        s = new Date(Date.UTC(y, m, 1));
        e = new Date(Date.UTC(y, m + 1, 0));
    }
    return { start: iso(s), end: iso(e) };
  }

  /* Eén stap vooruit. Bij maanden wordt de dag van de maand vastgehouden
     zolang dat kan: 31 januari + 1 maand is 28 (of 29) februari en niet
     3 maart. Dat is wat elke boekhouding doet en wat een klant verwacht. */
  function advance(isoDate, frequency, count) {
    if (!isIso(isoDate)) return '';
    var n = Math.max(1, int(count || 1));
    var f = freqDef(frequency);
    var dt = d(isoDate);
    if (f.days) {
      dt.setUTCDate(dt.getUTCDate() + f.days * n);
      return iso(dt);
    }
    var day = dt.getUTCDate();
    var target = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + f.months * n, 1));
    var lastOfTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastOfTarget));
    return iso(target);
  }

  /* ============================================================
     4. HET PROFIEL
     ============================================================ */
  function normalizeProfile(p) {
    p = p || {};
    var freq = str(p.frequency, 'month');
    if (FREQ_KEYS.indexOf(freq) < 0) freq = 'month';
    var status = str(p.status, 'actief');
    if (STATUSES.indexOf(status) < 0) status = 'actief';
    return {
      id: str(p.id),
      projectId: str(p.projectId || p.project_id),
      label: str(p.label, 'Terugkerende factuur'),
      frequency: freq,
      intervalCount: Math.min(24, Math.max(1, int(p.intervalCount !== undefined ? p.intervalCount : p.interval_count) || 1)),
      startDate: isIso(p.startDate || p.start_date) ? String(p.startDate || p.start_date).slice(0, 10) : '',
      endDate: isIso(p.endDate || p.end_date) ? String(p.endDate || p.end_date).slice(0, 10) : '',
      nextRunDate: isIso(p.nextRunDate || p.next_run_date) ? String(p.nextRunDate || p.next_run_date).slice(0, 10) : '',
      lastPeriodKey: str(p.lastPeriodKey || p.last_period_key),
      lastEvaluatedOn: isIso(p.lastEvaluatedOn || p.last_evaluated_on) ? String(p.lastEvaluatedOn || p.last_evaluated_on).slice(0, 10) : '',
      timezone: str(p.timezone, 'Europe/Amsterdam'),
      paymentTermDays: Math.max(0, int(p.paymentTermDays !== undefined ? p.paymentTermDays : p.payment_term_days)),
      language: str(p.language, 'nl'),
      template: str(p.template, 'standaard'),
      currency: String(str(p.currency, 'EUR')).toUpperCase(),
      pricesIncludeVat: !!(p.pricesIncludeVat !== undefined ? p.pricesIncludeVat : p.prices_include_vat),
      linesTemplate: Array.isArray(p.linesTemplate || p.lines_template) ? (p.linesTemplate || p.lines_template) : [],
      surchargesTemplate: Array.isArray(p.surchargesTemplate || p.surcharges_template) ? (p.surchargesTemplate || p.surcharges_template) : [],
      autoFinalize: !!(p.autoFinalize !== undefined ? p.autoFinalize : p.auto_finalize),
      autoSend: !!(p.autoSend !== undefined ? p.autoSend : p.auto_send),
      /* prijsindexering: alleen na expliciete configuratie. 0 = uit. */
      indexationPctMilli: int(p.indexationPctMilli !== undefined ? p.indexationPctMilli : p.indexation_pct_milli),
      indexationAppliesFrom: isIso(p.indexationAppliesFrom || p.indexation_applies_from)
        ? String(p.indexationAppliesFrom || p.indexation_applies_from).slice(0, 10) : '',
      status: status,
      errorDetail: str(p.errorDetail || p.error_detail),
      retryCount: Math.max(0, int(p.retryCount !== undefined ? p.retryCount : p.retry_count)),
      introText: str(p.introText || p.intro_text),
      outroText: str(p.outroText || p.outro_text),
      internalNote: str(p.internalNote || p.internal_note)
    };
  }

  /* De eerstvolgende generatiedatum: de eerste periodedatum die ná de
     laatst gegenereerde periode ligt. Bewust berekend uit startDate en niet
     opgeteld bij "vandaag": zo blijft de reeks op zijn ankerdag staan, ook
     als er een keer een maand is overgeslagen.

     De eerste periode die nog niet is gedaan is de beurt — ook als die in
     het verleden ligt. Een gemiste maand overslaan zou een factuur laten
     verdampen en dat merk je pas bij de jaarrekening. Er is daarom bewust
     geen "vanaf"-argument: de laatst gedane periodesleutel is de enige
     grens die telt. */
  function nextRunDate(profile) {
    var p = normalizeProfile(profile);
    if (!p.startDate) return '';
    var cursor = p.startDate;
    var guard = 0;
    while (guard++ < 2000) {
      var key = periodKey(cursor, p.frequency);
      var gedaan = p.lastPeriodKey && key <= p.lastPeriodKey;
      if (!gedaan) return cursor;
      cursor = advance(cursor, p.frequency, p.intervalCount);
      if (p.endDate && cursor > p.endDate) return '';
    }
    return '';
  }

  /* ============================================================
     5. HET PLAN
     ============================================================
     input:
       profile       het profiel (mag ruw)
       today         'YYYY-MM-DD' — meegeven; anders todayIn(profile.timezone)
       existingKeys  de al gegenereerde periodesleutels (uit recurring_runs)
       maxPerRun     hoeveel achterstallige perioden er in één keer mogen
                     (standaard 3 — zie hieronder)
       force         het dagslot overslaan

     uitkomst: {ran, alreadyToday, generate[], skipped[], reason,
                nextRunDate, timeZone}

     WAAROM maxPerRun BESTAAT: een profiel dat een half jaar heeft
     stilgestaan zou anders bij één keer openen zes facturen tegelijk
     klaarzetten. Drie is genoeg om een gemiste maand in te halen en weinig
     genoeg om op te merken dát er iets is misgegaan. De rest volgt bij de
     volgende evaluatie, en het scherm zegt hoeveel er nog wachten. */
  function plan(input) {
    input = input || {};
    var p = normalizeProfile(input.profile);
    var tz = todayIn(p.timezone, input.now);
    var today = isIso(input.today) ? String(input.today).slice(0, 10) : tz.date;
    var max = Math.max(1, int(input.maxPerRun || 3));
    var known = {};
    (input.existingKeys || []).forEach(function (k) { known[String(k)] = true; });
    /* lastPeriodKey is een GRENS, geen losse sleutel: '2026-03' betekent
       "tot en met maart is gedaan". De sleutels zijn met opzet zo gevormd
       dat ze lexicaal sorteren (zie periodKey), dus een simpele vergelijking
       volstaat en er hoeft nergens een datum te worden teruggerekend. */
    function gedaan(key) {
      if (known[key]) return true;
      return !!(p.lastPeriodKey && key <= p.lastPeriodKey);
    }

    var out = {
      ran: false, alreadyToday: false, generate: [], skipped: [],
      reason: '', nextRunDate: '', timeZone: tz.timeZone, timeZoneFallback: tz.fallback,
      pendingAfterRun: 0, profile: p
    };

    if (p.status !== 'actief') {
      out.reason = p.status === 'gepauzeerd'
        ? 'Dit profiel staat op pauze.'
        : (p.status === 'fout'
          ? 'Dit profiel staat op fout: ' + (p.errorDetail || 'onbekende oorzaak') + '. Los het op en zet hem op opnieuw proberen.'
          : 'Dit profiel is beëindigd.');
      return out;
    }
    if (!p.startDate) { out.reason = 'Dit profiel heeft geen begindatum.'; return out; }
    if (!p.linesTemplate.length) { out.reason = 'Dit profiel heeft geen regels; er valt niets te genereren.'; return out; }
    if (!input.force && p.lastEvaluatedOn && p.lastEvaluatedOn >= today) {
      out.alreadyToday = true;
      out.reason = 'Dit profiel is vandaag al beoordeeld.';
      return out;
    }

    out.ran = true;
    var cursor = p.startDate;
    var guard = 0, pending = 0;
    while (guard++ < 2000) {
      if (p.endDate && cursor > p.endDate) break;
      if (cursor > today) { if (!out.nextRunDate) out.nextRunDate = cursor; break; }
      var key = periodKey(cursor, p.frequency);
      if (gedaan(key)) {
        out.skipped.push({ periodKey: key, date: cursor, reason: 'is al gegenereerd' });
      } else if (out.generate.length >= max) {
        pending++;
      } else {
        var bounds = periodBounds(cursor, p.frequency);
        out.generate.push({
          periodKey: key,
          invoiceDate: cursor,
          dueDate: addDaysIso(cursor, p.paymentTermDays),
          deliveryStart: bounds.start,
          deliveryEnd: bounds.end,
          indexed: shouldIndex(p, cursor)
        });
      }
      cursor = advance(cursor, p.frequency, p.intervalCount);
    }
    if (!out.nextRunDate && (!p.endDate || cursor <= p.endDate)) out.nextRunDate = cursor;
    out.pendingAfterRun = pending;
    if (!out.generate.length && !out.reason) {
      out.reason = out.nextRunDate
        ? ('Alles is bij. De volgende factuur staat gepland voor ' + out.nextRunDate + '.')
        : 'Dit profiel is aan zijn einddatum gekomen.';
    }
    return out;
  }

  function shouldIndex(p, isoDate) {
    return !!(p.indexationPctMilli && p.indexationAppliesFrom && isoDate >= p.indexationAppliesFrom);
  }
  function addDaysIso(isoDate, days) {
    if (!isIso(isoDate)) return '';
    var dt = d(isoDate);
    dt.setUTCDate(dt.getUTCDate() + int(days));
    return iso(dt);
  }

  /* ============================================================
     6. PRIJSINDEXERING
     ============================================================
     Alleen na expliciete configuratie, en alleen op de eenheidsprijs — een
     indexering die ook de korting of de btw aanraakt is geen indexering
     maar een herprijzing. Gehele centen, afgerond via de rekenkern. */
  function applyIndexation(lines, pctMilli) {
    var C = core();
    var pct = int(pctMilli);
    if (!pct) return (lines || []).slice();
    return (lines || []).map(function (L) {
      var out = {};
      Object.keys(L || {}).forEach(function (k) { out[k] = L[k]; });
      if (str(out.type, 'item') !== 'item') return out;
      var base = int(out.unitPriceCents);
      /* nieuw = oud + oud × pct / 100.000 (pctMilli is percentage × 1000) */
      out.unitPriceCents = base + C.divRound(base * pct, 100 * 1000);
      return out;
    });
  }

  /* ============================================================
     7. HET CONCEPT
     ============================================================
     draftFrom() maakt de kop en de regels van één gegenereerde factuur.
     Hij bewaart niets en kent geen klant: dat is het werk van de aanroeper.
     De periodesleutel reist mee zodat hij in dezelfde schrijfbeweging in
     recurring_runs kan landen. */
  function draftFrom(profile, occurrence) {
    var p = normalizeProfile(profile);
    var occ = occurrence || {};
    var lines = p.linesTemplate.map(function (L, i) {
      return {
        id: null,
        type: str(L.type, 'item'),
        description: str(L.description),
        detail: str(L.detail),
        quantityMicro: int(L.quantityMicro),
        unit: str(L.unit),
        unitPriceCents: int(L.unitPriceCents),
        priceIncludesVat: L.priceIncludesVat === undefined ? p.pricesIncludeVat : !!L.priceIncludesVat,
        discountType: str(L.discountType, 'none'),
        discountValue: int(L.discountValue),
        taxCode: str(L.taxCode),
        ledgerRef: str(L.ledgerRef),
        productRef: str(L.productRef),
        sort: i
      };
    });
    if (occ.indexed) lines = applyIndexation(lines, p.indexationPctMilli);

    return {
      periodKey: str(occ.periodKey),
      head: {
        docKind: 'invoice',
        administration: 'CP',
        projectId: p.projectId,
        stageKey: 'concept',
        label: p.label + (occ.periodKey ? ' — ' + occ.periodKey : ''),
        currency: p.currency,
        pricesIncludeVat: p.pricesIncludeVat,
        invoiceDate: str(occ.invoiceDate),
        paymentTermDays: p.paymentTermDays,
        dueDate: str(occ.dueDate),
        deliveryStart: str(occ.deliveryStart),
        deliveryEnd: str(occ.deliveryEnd),
        clientReference: '',
        purchaseOrder: '',
        costCenter: '',
        language: p.language,
        template: p.template,
        introText: p.introText,
        outroText: p.outroText,
        paymentInstructions: '',
        internalNote: p.internalNote,
        buyerAddress: '',
        deliveryAddress: '',
        rateToEur: null,
        tags: [],
        recurringProfileId: p.id
      },
      lines: lines,
      surcharges: p.surchargesTemplate.map(function (s) {
        return { label: str(s.label), amountCents: int(s.amountCents), taxCode: str(s.taxCode) };
      }),
      discount: { type: 'none', value: 0 },
      autoFinalize: p.autoFinalize,
      autoSend: p.autoSend,
      indexed: !!occ.indexed
    };
  }

  /* ============================================================
     8. PAUZEREN, HERVATTEN, FOUT EN RETRY
     ============================================================
     Alle vier geven een NIEUW profiel terug in plaats van het bestaande te
     wijzigen: deze module raakt nooit iets aan wat hij heeft gekregen. */
  function patched(p, fields) {
    var out = normalizeProfile(p);
    Object.keys(fields || {}).forEach(function (k) { out[k] = fields[k]; });
    return out;
  }
  function pause(p) { return patched(p, { status: 'gepauzeerd' }); }
  function resume(p) {
    return patched(p, { status: 'actief', errorDetail: '', retryCount: 0 });
  }
  function finish(p) { return patched(p, { status: 'beeindigd' }); }
  function markError(p, message) {
    var cur = normalizeProfile(p);
    return patched(p, {
      status: 'fout',
      errorDetail: str(message, 'Onbekende fout bij het genereren.'),
      retryCount: cur.retryCount + 1
    });
  }
  /* na een geslaagde generatie: de sleutel onthouden (slot 2 van de drie),
     de volgende datum vooruitzetten en de foutstand wissen */
  function markSuccess(p, periodKeyValue, todayIso) {
    var cur = normalizeProfile(p);
    var next = nextRunDate(patched(cur, { lastPeriodKey: str(periodKeyValue) }));
    return patched(p, {
      lastPeriodKey: str(periodKeyValue),
      lastEvaluatedOn: isIso(todayIso) ? String(todayIso).slice(0, 10) : cur.lastEvaluatedOn,
      nextRunDate: next,
      status: cur.status === 'fout' ? 'actief' : cur.status,
      errorDetail: '',
      retryCount: 0
    });
  }

  return {
    VERSION: VERSION,
    FREQUENCIES: FREQUENCIES,
    FREQ_KEYS: FREQ_KEYS,
    STATUSES: STATUSES,
    normalizeProfile: normalizeProfile,
    todayIn: todayIn,
    periodKey: periodKey,
    periodBounds: periodBounds,
    advance: advance,
    addDaysIso: addDaysIso,
    nextRunDate: nextRunDate,
    plan: plan,
    applyIndexation: applyIndexation,
    draftFrom: draftFrom,
    pause: pause,
    resume: resume,
    finish: finish,
    markError: markError,
    markSuccess: markSuccess
  };
});
