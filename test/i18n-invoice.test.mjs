/* CUSTOM+ — bewaakt dat elke klantzichtbare bronstring uit de
   factuurrekenkern ook echt in ALLE VIER de woordenboeken staat.
   ------------------------------------------------------------------
   De huisregel is: NL is de bron, en elke nieuwe klantzichtbare string
   krijgt en/de/fr/es. Die regel is makkelijk te vergeten wanneer er over
   een half jaar een btw-behandeling bij komt. Deze test vergeet hem niet:
   hij leest portal/invoice-core.js voor de bronstrings en portal/i18n.js
   voor de vertalingen, en faalt bij het eerste gat.

   portal/i18n.js is een browserbestand (window.CP_PORTAL_I18N = {...}).
   Er wordt hier geen code geëvalueerd: we geven Node simpelweg een
   `window` die naar globalThis wijst en importeren het bestand gewoon,
   precies zoals de browser dat doet.
   ------------------------------------------------------------------ */
import '../portal/invoice-core.js';
import '../portal/invoice-finalize.js';
import '../portal/invoice-reminders.js';

const core = globalThis.CP_INVOICE;
const FINAL = globalThis.CP_INVOICE_FINAL;
const REM = globalThis.CP_REMINDERS;

/* de browserlaag nabootsen vóór het woordenboek geladen wordt */
const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, 'window');
if (!hadWindow) globalThis.window = globalThis;
await import('../portal/i18n.js');
const dicts = globalThis.CP_PORTAL_I18N;
if (!hadWindow) delete globalThis.window;

export default function (t) {
  t.group('woordenboeken');
  t.true(!!dicts, 'portal/i18n.js levert een woordenboek op');

  const talen = ['en', 'de', 'fr', 'es'];
  for (const taal of talen) {
    t.true(!!(dicts && dicts[taal]), 'woordenboek ' + taal + ' bestaat');
  }

  t.group('wettelijke btw-vermeldingen');
  const bronnen = [];
  for (const key of core.TREATMENT_KEYS) {
    const note = core.TAX_TREATMENTS[key].legalNoteNl;
    if (note) bronnen.push(note);
  }
  t.eq(bronnen.length, 4, 'vier van de vijf btw-behandelingen dragen een wettelijke vermelding');
  t.eq(core.TAX_TREATMENTS.standard.legalNoteNl, '', 'een gewoon belaste regel heeft geen extra vermelding nodig');

  for (const zin of bronnen) {
    for (const taal of talen) {
      const d = dicts && dicts[taal];
      const v = d ? d[zin] : undefined;
      t.true(typeof v === 'string' && v.trim().length > 0,
        'vertaling ' + taal + ' ontbreekt voor: “' + zin + '”');
      t.true(v !== zin, 'vertaling ' + taal + ' voor “' + zin + '” is geen kopie van het Nederlands');
    }
  }

  t.group('geen dubbele bronstrings');
  const gezien = new Set();
  for (const zin of bronnen) {
    t.false(gezien.has(zin), 'de vermelding “' + zin + '” komt maar één keer voor');
    gezien.add(zin);
  }

  /* ------------------------------------------------------------------
     FASE 2 — het factuurvel zelf.
     De regeltabel, het totalenblok en de kopgegevens staan op het vel dat
     de klant krijgt en gaan dus door invT()/i18nT(). Ze staan als
     bronstrings in portal/invoice-finalize.js zodat deze test één lijst
     heeft om af te lopen in plaats van beheer.html te moeten uitkammen.
     ------------------------------------------------------------------ */
  t.group('klantzichtbare strings van het factuurvel');
  t.true(Array.isArray(FINAL.CLIENT_STRINGS) && FINAL.CLIENT_STRINGS.length > 0,
    'portal/invoice-finalize.js levert de lijst klantzichtbare bronstrings');

  const dubbel = new Set();
  for (const zin of FINAL.CLIENT_STRINGS) {
    t.false(dubbel.has(zin), 'bronstring “' + zin + '” staat maar één keer in de lijst');
    dubbel.add(zin);
    for (const taal of talen) {
      const d = dicts && dicts[taal];
      const v = d ? d[zin] : undefined;
      t.true(typeof v === 'string' && v.trim().length > 0,
        'vertaling ' + taal + ' ontbreekt voor: “' + zin + '”');
    }
  }

  /* Sjabloonsleutels moeten hun plaatshouder houden, anders vult
     invTpl()/i18nTpl() straks niets in en staat er een kale zin op de
     factuur van een Franse klant. */
  t.group('plaatshouders blijven staan');
  for (const zin of FINAL.CLIENT_STRINGS) {
    const holes = zin.match(/\{[a-z]+\}/g);
    if (!holes) continue;
    for (const taal of talen) {
      const v = (dicts[taal] || {})[zin] || '';
      for (const h of holes) {
        t.true(v.indexOf(h) > -1,
          'vertaling ' + taal + ' van “' + zin + '” houdt plaatshouder ' + h);
      }
    }
  }

  t.group('eenheden');
  for (const u of FINAL.UNITS) {
    t.true(FINAL.CLIENT_STRINGS.indexOf(u.label) > -1,
      'eenheid “' + u.label + '” staat in de lijst klantzichtbare strings');
    t.eq(FINAL.unitLabel(u.key), u.label, 'unitLabel geeft het NL-bronlabel voor ' + u.key);
  }
  t.eq(FINAL.unitLabel('rol'), 'rol', 'een vrije eenheid komt letterlijk terug — die typt de gebruiker zelf');

  /* ------------------------------------------------------------------
     FASE 5 — de herinneringsteksten.
     Deze gaan als e-mail naar de klant en dus door dezelfde vier
     woordenboeken. Ze staan als bronstring in portal/invoice-reminders.js,
     zodat deze test één lijst heeft om af te lopen. De plaatshouders zijn
     hier extra belangrijk: valt er één weg in de vertaling, dan krijgt een
     Franse klant een aanmaning zonder factuurnummer.
     ------------------------------------------------------------------ */
  t.group('klantzichtbare strings van de herinneringen');
  t.true(!!REM, 'portal/invoice-reminders.js is geladen');
  t.true(Array.isArray(REM.CLIENT_STRINGS) && REM.CLIENT_STRINGS.length >= 10,
    'de module levert zijn lijst klantzichtbare bronstrings');

  const remDubbel = new Set();
  for (const zin of REM.CLIENT_STRINGS) {
    t.false(remDubbel.has(zin), 'bronstring “' + zin.slice(0, 40) + '…” staat maar één keer in de lijst');
    remDubbel.add(zin);
    for (const taal of talen) {
      const v = (dicts[taal] || {})[zin];
      t.true(typeof v === 'string' && v.trim().length > 0,
        'vertaling ' + taal + ' ontbreekt voor: “' + zin.slice(0, 50) + '…”');
      t.true(v !== zin, 'vertaling ' + taal + ' van “' + zin.slice(0, 40) + '…” is geen kopie van het Nederlands');
    }
  }

  t.group('plaatshouders in de herinneringen');
  for (const zin of REM.CLIENT_STRINGS) {
    const holes = zin.match(/\{[a-z]+\}/g);
    if (!holes) continue;
    for (const taal of talen) {
      const v = (dicts[taal] || {})[zin] || '';
      for (const h of holes) {
        t.true(v.indexOf(h) > -1,
          'vertaling ' + taal + ' van “' + zin.slice(0, 40) + '…” houdt plaatshouder ' + h);
      }
    }
  }

  /* elke standaardstap moet ook echt een onderwerp en een tekst hebben:
     een lege herinnering is erger dan geen herinnering */
  t.group('elke stap heeft een tekst');
  for (const step of REM.STEPS.concat([{ step: REM.MANUAL_STEP }])) {
    const def = REM.DEFAULT_TEXTS[step.step];
    t.true(!!def, 'stap ' + step.step + ' heeft een standaardtekst');
    t.true(def.subject.length > 0, 'stap ' + step.step + ' heeft een onderwerp');
    t.true(def.body.length > 0, 'stap ' + step.step + ' heeft een bericht');
    t.true(REM.CLIENT_STRINGS.indexOf(def.subject) > -1,
      'het onderwerp van stap ' + step.step + ' staat in de lijst klantzichtbare strings');
    t.true(REM.CLIENT_STRINGS.indexOf(def.body) > -1,
      'het bericht van stap ' + step.step + ' staat er ook in');
  }
}
