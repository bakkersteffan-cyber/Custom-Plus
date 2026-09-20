/* CUSTOM+ — nummerreeksen voor facturen en creditnota's.
   ------------------------------------------------------------------
   DIT BESTAND KENT DE VORM VAN EEN FACTUURNUMMER, EN VERDER NIETS.
   Het geeft zelf geen nummers uit: uitgeven is een ondeelbare lees-,
   ophoog- en schrijfbeweging op gedeelde opslag, en die beweging hoort in
   de datalaag (demo: localStorage in één synchrone stap; live: de
   rijvergrendelde SQL-functie claim_series_number uit
   supabase/portal/0009_nummerreeksen.sql). Hier staat de PURE kant:
   welk nummer is aan de beurt, hoe ziet het eruit, en wat wordt de nieuwe
   stand van de reeks. Precies dat deel is te testen zonder browser en
   zonder database — zie test/invoice-series.test.mjs, inclusief een
   gesimuleerde gelijktijdigheid.

   WAAROM PUUR EN NIET "GEWOON EEN TELLER"
   Golf 1 had één jaarteller met één voorvoegsel. De spec vraagt reeksen:
   per administratie, met prefix én suffix, met of zonder jaar, met of
   zonder maand, met een instelbaar startnummer en met een eigen reeks voor
   creditnota's. Zodra dat configureerbaar wordt, is "het volgende nummer"
   geen optelling meer maar een functie van (reeks, datum, al gebruikte
   nummers). Die functie staat hier, één keer.

   HET NUMMER VALT PAS BIJ DEFINITIEF MAKEN.
   Een concept heeft geen nummer en toont "nummer volgt". Dat is geen
   cosmetische keuze: elk concept dat een nummer trekt en daarna sneuvelt,
   laat een gat in de reeks achter dat je twee jaar later niet meer kunt
   uitleggen. issue() wordt dus uitsluitend aangeroepen vanuit stap 4 van
   definitief maken.

   EEN REEKS IS EEN PLAT OBJECT, EXACT DE KOLOMMEN VAN number_series:
     id, kind ('invoice'|'credit_note'), administration, label,
     prefix, suffix, useYear, useMonth, separator, padLength,
     startValue, currentValue, currentYear, currentMonth,
     resetPeriod ('never'|'year'|'month'), active
   currentValue is het LAATST UITGEGEVEN volgnummer (0 = er is nog niets
   uitgegeven), niet "de volgende". Zo is een verse reeks eenduidig en
   hoeft niemand te raden of startValue al verbruikt is.

   Publieke API (globalThis.CP_SERIES, en module.exports in Node):
     VERSION, KINDS, RESET_PERIODS
     defaultSeries()                de startset: facturen + creditnota's
     normalise(series)              rommel eruit, defaults erin
     periodOf(dateIso)              {year, month} zonder tijdzone-verrassing
     formatNumber(series, seq, iso) "CP-2026-00001"
     nextSeq(series, iso)           welk volgnummer is aan de beurt
     preview(series, iso)           {text, seq, resets} — kijkje, wijzigt niets
     issue(series, opts)            {series, text, seq, skipped[]} — pure claim
     seriesFor(list, kind)          de actieve reeks van een soort
     fromLegacy(reeks) / toLegacy(series)   brug naar de golf-1-jaarteller
     migrate(list, legacy)          bestaande instellingen naar reeksenlijst

   LADEN
     browser : script-tag portal/invoice-series.js, na portal/invoice-core.js
     node    : import '../portal/invoice-series.js'
   ------------------------------------------------------------------ */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.CP_SERIES = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var KINDS = ['invoice', 'credit_note'];
  var RESET_PERIODS = ['never', 'year', 'month'];
  var MAX_SEQ = 999999999;      /* een volgnummer boven een miljard is invoerfout, geen reeks */
  var MAX_SKIP = 100000;        /* vangnet tegen een oneindige lus bij kapotte invoer */

  function str(v, fallback) {
    if (v === null || v === undefined) return fallback || '';
    return String(v);
  }
  function intOr(v, fallback) {
    var n = Math.round(Number(v));
    return isFinite(n) ? n : fallback;
  }
  function clamp(n, lo, hi) {
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }
  function pad(n, len) {
    var s = String(Math.abs(Math.round(n)));
    while (s.length < len) s = '0' + s;
    return s;
  }

  /* ============================================================
     1. DE REEKS ZELF
     ============================================================ */

  /* De startset. Bewust twee reeksen: de spec vraagt om een eigen
     doorlopende reeks voor creditnota's of een configureerbaar gedeelde —
     dit is de "eigen reeks"-variant, en wie hem wil delen zet de tweede
     reeks op inactief en kiest bij de creditnota de factuurreeks. */
  function defaultSeries() {
    var year = new Date().getFullYear();
    return [
      {
        id: 'srs-factuur', kind: 'invoice', administration: 'CP', label: 'Facturen',
        prefix: 'CP', suffix: '', useYear: true, useMonth: false, separator: '-',
        padLength: 4, startValue: 1, currentValue: 0, currentYear: year, currentMonth: null,
        resetPeriod: 'year', active: true
      },
      {
        id: 'srs-credit', kind: 'credit_note', administration: 'CP', label: 'Creditnota’s',
        prefix: 'CPC', suffix: '', useYear: true, useMonth: false, separator: '-',
        padLength: 4, startValue: 1, currentValue: 0, currentYear: year, currentMonth: null,
        resetPeriod: 'year', active: true
      }
    ];
  }

  function normalise(s) {
    s = s || {};
    var kind = KINDS.indexOf(str(s.kind, 'invoice')) > -1 ? String(s.kind) : 'invoice';
    var reset = RESET_PERIODS.indexOf(str(s.resetPeriod, 'year')) > -1 ? String(s.resetPeriod) : 'year';
    var useMonth = !!s.useMonth;
    /* een maandreset zonder maand in het nummer geeft twaalf keer per jaar
       hetzelfde nummer — dat is geen instelling maar een botsing */
    if (reset === 'month' && !useMonth) useMonth = true;
    var start = clamp(intOr(s.startValue, 1), 0, MAX_SEQ);
    var current = clamp(intOr(s.currentValue, 0), 0, MAX_SEQ);
    var year = (s.currentYear === null || s.currentYear === undefined || s.currentYear === '')
      ? null : clamp(intOr(s.currentYear, 0), 0, 9999);
    var month = (s.currentMonth === null || s.currentMonth === undefined || s.currentMonth === '')
      ? null : clamp(intOr(s.currentMonth, 1), 1, 12);
    return {
      id: str(s.id, 'srs-' + kind),
      kind: kind,
      administration: str(s.administration, 'CP') || 'CP',
      label: str(s.label, kind === 'credit_note' ? 'Creditnota’s' : 'Facturen'),
      /* het voorvoegsel mag leeg zijn — "2026-00001" uit de spec is precies
         een reeks zonder voorvoegsel */
      prefix: str(s.prefix, '').trim(),
      suffix: str(s.suffix, '').trim(),
      useYear: s.useYear === undefined ? true : !!s.useYear,
      useMonth: useMonth,
      separator: s.separator === undefined || s.separator === null ? '-' : String(s.separator).slice(0, 3),
      padLength: clamp(intOr(s.padLength, 4), 1, 12),
      startValue: start,
      currentValue: current,
      currentYear: year,
      currentMonth: month,
      resetPeriod: reset,
      active: s.active !== false
    };
  }

  /* ============================================================
     2. PERIODE
     ============================================================
     Een factuurnummer hoort bij een KALENDERdatum, niet bij een tijdstip.
     We lezen daarom altijd uit een ISO-datum (jjjj-mm-dd) en nooit uit een
     Date-object dat in een andere tijdzone ineens een dag verschuift. Komt
     er toch een Date of niets binnen, dan valt hij terug op vandaag in de
     lokale tijd — dat is de datum die de gebruiker op zijn scherm ziet. */
  function periodOf(dateIso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(dateIso, ''));
    if (m) return { year: Number(m[1]), month: Number(m[2]) };
    var d = (dateIso instanceof Date && !isNaN(dateIso.getTime())) ? dateIso : new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  /* ============================================================
     3. HET NUMMER OPMAKEN
     ============================================================
     Onderdelen in vaste volgorde: voorvoegsel, jaar, maand, volgnummer,
     achtervoegsel. Lege onderdelen vallen weg zonder dubbele scheidings-
     tekens achter te laten, zodat een reeks zonder voorvoegsel netjes
     "2026-00001" oplevert en niet "-2026-00001". */
  function formatNumber(series, seq, dateIso) {
    var s = normalise(series);
    var p = periodOf(dateIso);
    var parts = [];
    if (s.prefix) parts.push(s.prefix);
    if (s.useYear) parts.push(String(p.year));
    if (s.useMonth) parts.push(pad(p.month, 2));
    parts.push(pad(seq, s.padLength));
    if (s.suffix) parts.push(s.suffix);
    return parts.join(s.separator);
  }

  /* ============================================================
     4. WELK VOLGNUMMER IS AAN DE BEURT
     ============================================================
     Drie gevallen, en het derde is het enige dat verrast:
       · de reeks heeft nog niets uitgegeven, dan startValue;
       · de periode is gewisseld en de reeks reset daarop, dan startValue;
       · anders laatst uitgegeven + 1, maar nooit onder startValue (een
         startnummer dat later wordt verhoogd moet meteen gelden, anders
         doet het instellen ervan niets).
     resets zegt of dit een periodewissel is; de UI toont dat, en de audit
     legt het vast. */
  function nextSeq(series, dateIso) {
    var s = normalise(series);
    var p = periodOf(dateIso);
    var resets = false;
    if (s.resetPeriod === 'year') {
      resets = s.currentYear !== null && s.currentYear !== p.year;
    } else if (s.resetPeriod === 'month') {
      resets = (s.currentYear !== null && s.currentYear !== p.year) ||
               (s.currentMonth !== null && s.currentMonth !== p.month);
    }
    var seq;
    if (resets || s.currentValue === 0) seq = s.startValue;
    else seq = Math.max(s.currentValue + 1, s.startValue);
    if (seq > MAX_SEQ) seq = MAX_SEQ;
    return { seq: seq, resets: resets, year: p.year, month: p.month };
  }

  /* een kijkje: wat zou deze reeks nu geven? Wijzigt niets. */
  function preview(series, dateIso) {
    var n = nextSeq(series, dateIso);
    return {
      text: formatNumber(series, n.seq, dateIso),
      seq: n.seq,
      year: n.year,
      month: n.month,
      resets: n.resets
    };
  }

  /* ============================================================
     5. UITGEVEN — DE PURE HELFT
     ============================================================
     issue() krijgt de reeks zoals hij NU in de opslag staat, plus de
     nummers die al in gebruik zijn, en geeft terug: het uitgegeven nummer
     en de NIEUWE stand van de reeks. De aanroeper schrijft die stand terug
     binnen dezelfde ondeelbare stap waarin hij hem las — dat is de
     concurrency-garantie, en die kan dit bestand niet geven omdat het niet
     weet waar de opslag woont.

     Een nummer dat al op een factuur staat (handmatig getypt, of uit een
     import) wordt overgeslagen; elke overgeslagen waarde komt in skipped
     zodat de nummer-audit kan vastleggen waarom er een gat zit.

     opts:
       date       ISO-datum van de factuur (bepaalt jaar/maand en reset)
       used       object of Set met de al gebruikte nummerteksten
       maxSkip    vangnet, standaard 100000
  */
  function isUsed(used, text) {
    if (!used) return false;
    if (typeof used.has === 'function') return used.has(text);
    return Object.prototype.hasOwnProperty.call(used, text) && !!used[text];
  }

  function issue(series, opts) {
    opts = opts || {};
    var s = normalise(series);
    var dateIso = opts.date || null;
    var n = nextSeq(s, dateIso);
    var seq = n.seq;
    var text = formatNumber(s, seq, dateIso);
    var skipped = [];
    var guard = 0;
    var limit = intOr(opts.maxSkip, MAX_SKIP);
    while (isUsed(opts.used, text) && guard < limit) {
      skipped.push(text);
      seq += 1;
      guard += 1;
      text = formatNumber(s, seq, dateIso);
    }
    if (isUsed(opts.used, text)) {
      /* liever eerlijk stoppen dan een duplicaat uitgeven */
      return {
        ok: false,
        reason: 'Er kon geen vrij nummer worden gevonden in reeks “' + s.label + '”.',
        series: s, text: '', seq: 0, skipped: skipped, resets: n.resets,
        year: n.year, month: n.month
      };
    }
    var next = normalise(s);
    next.currentValue = seq;
    next.currentYear = n.year;
    next.currentMonth = n.month;
    return {
      ok: true,
      reason: '',
      series: next,
      text: text,
      seq: seq,
      skipped: skipped,
      resets: n.resets,
      year: n.year,
      month: n.month
    };
  }

  /* ============================================================
     6. DE LIJST
     ============================================================ */
  function normaliseList(list) {
    var out = [];
    (list || []).forEach(function (s) { out.push(normalise(s)); });
    return out;
  }

  /* De actieve reeks van een soort. Staat er geen actieve, dan valt een
     creditnota bewust terug op de FACTUURREEKS — een gedeelde reeks is een
     geldige keuze, een creditnota zonder nummer niet. */
  function seriesFor(list, kind, administration) {
    var want = KINDS.indexOf(str(kind, 'invoice')) > -1 ? String(kind) : 'invoice';
    var adm = str(administration, '') || null;
    var all = normaliseList(list);
    var i;
    for (i = 0; i < all.length; i++) {
      if (all[i].kind === want && all[i].active && (!adm || all[i].administration === adm)) return all[i];
    }
    if (want === 'credit_note') {
      for (i = 0; i < all.length; i++) {
        if (all[i].kind === 'invoice' && all[i].active && (!adm || all[i].administration === adm)) return all[i];
      }
    }
    return null;
  }

  /* ============================================================
     7. BRUG NAAR DE GOLF-1-JAARTELLER
     ============================================================
     De bestaande instelling is { prefix, jaar, volgende } — één reeks,
     jaargebonden, vier cijfers. Die blijft bestaan zodat de
     nummeringswaakhond en het kijkje in het oude factuurvenster blijven
     werken; hij is voortaan een AFGELEIDE van de factuurreeks, nooit een
     tweede waarheid. */
  function fromLegacy(reeks) {
    var r = reeks || {};
    var year = intOr(r.jaar, new Date().getFullYear());
    var volgende = Math.max(intOr(r.volgende, 1), 1);
    var base = defaultSeries()[0];
    base.prefix = str(r.prefix, 'CP') || 'CP';
    base.currentYear = year;
    base.currentValue = volgende - 1;   /* 'volgende' is de eerstvolgende, currentValue de laatst uitgegeven */
    return normalise(base);
  }

  /* Alleen een reeks die op de oude vorm lijkt kan terug naar de oude
     vorm. Een reeks met maandnummer of achtervoegsel past niet in
     { prefix, jaar, volgende } en dan is niets terugschrijven eerlijker
     dan een half getal wegschrijven. */
  function legacyCompatible(series) {
    var s = normalise(series);
    return s.useYear && !s.useMonth && !s.suffix && s.separator === '-' &&
      s.padLength === 4 && s.resetPeriod === 'year';
  }
  function toLegacy(series) {
    var s = normalise(series);
    if (!legacyCompatible(s)) return null;
    var p = periodOf(null);
    var year = s.currentYear === null ? p.year : s.currentYear;
    return { prefix: s.prefix || 'CP', jaar: year, volgende: Math.max(s.currentValue + 1, s.startValue) };
  }

  /* Bestaande instellingen naar reeksen. Is er nog geen reeksenlijst, dan
     wordt de factuurreeks uit de jaarteller gehaald zodat de teller niet
     terugspringt en er nooit een al uitgegeven nummer opnieuw valt. */
  function migrate(list, legacy) {
    var have = normaliseList(list);
    if (have.length) return have;
    var seeded = defaultSeries();
    if (legacy && (legacy.prefix !== undefined || legacy.volgende !== undefined)) {
      var fromOld = fromLegacy(legacy);
      fromOld.id = seeded[0].id;
      fromOld.label = seeded[0].label;
      seeded[0] = fromOld;
      /* de creditreeks erft het voorvoegsel met een C erachter zodat hij
         nooit met de factuurreeks botst */
      seeded[1].prefix = (fromOld.prefix || 'CP') + 'C';
    }
    return seeded;
  }

  return {
    VERSION: VERSION,
    KINDS: KINDS,
    RESET_PERIODS: RESET_PERIODS,
    MAX_SEQ: MAX_SEQ,

    defaultSeries: defaultSeries,
    normalise: normalise,
    normaliseList: normaliseList,
    periodOf: periodOf,
    formatNumber: formatNumber,
    nextSeq: nextSeq,
    preview: preview,
    issue: issue,
    seriesFor: seriesFor,

    fromLegacy: fromLegacy,
    toLegacy: toLegacy,
    legacyCompatible: legacyCompatible,
    migrate: migrate
  };
});
