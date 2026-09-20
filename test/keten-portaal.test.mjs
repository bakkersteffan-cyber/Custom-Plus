/* CUSTOM+ — KETENCONTROLE van het klantportaal (demo-modus), agent "keten".
   Draaien: node test/run.mjs keten
   ------------------------------------------------------------------
   Dit bestand volgt elke klantactie van de portaalknop tot de beheer-Inbox:

     portaalknop → CP_PORTAAL_DATA.<actie>()          (portal/portaal-data.js)
                 → demo-opslag cp_portal_demo_v1       (de schrijven-haak van
                                                        portal.html, hier
                                                        letterlijk nagebouwd)
                 → CP_MODEL.collectInbox()             (beheer: de Inbox)
                 → CP_MODEL.mergeActivity()            (beheer: de tijdlijn)
                 → CP_PORTAAL.activiteitVoorKlant()    (portaal: de tijdlijn)

   en toetst per actie (a) de belofte, (b) de rij in de opslag, (c) de
   logregel, (d) het Inbox-item, (e) de tijdlijnregel, (f) de ontdubbeling
   van de tweeling accessLog/auditLog, en (g) de weigeringen met een
   Nederlandse zin uit berichtVoorFout.

   VIJF AFSPRAKEN DIE DIT BESTAND BEWAKEN

   1. DE KLOK IS VAST. portaal-data.js leest new Date() zelf (nuISO), dus
      de klok wordt hier vervangen door een Date-subklasse die altijd
      NU teruggeeft; aan het eind komt de echte Date terug. Zo is elke
      createdAt, approvedAt en logregel exact voorspelbaar, en is de
      tweeling in de logboeken (zelfde tijdstip) een feit en geen toeval —
      precies zoals now() in Postgres de transactietijd is.

   2. DE OPSLAG IS DE ECHTE KETEN. De schrijven-haak is een woordelijke
      kopie van saveKlantacties() uit portal.html (samenvoegen per
      collectie op id met de verse opslag, de verwijderde eigen
      contactpersonen eruit, en daarna localStorage). Wat
      het beheer leest is die opslag, dus daar wordt op getoetst — niet op
      het object in het geheugen.

   3. ELKE OPSLAG IS VERS. vers() geeft per test een nieuwe kopie van de
      seed (demo-data.js + demo-data-ia.js + demo-data-portaal.js, zoals
      portal.html ze laadt) in een eigen localStorage-nabootsing.

   4. BEVINDINGEN BREKEN DE SUITE NIET. Een gedrag dat hier als fout is
      herkend maar buiten dit bestand ligt, wordt via bevinding() gemeld
      (één regel in de uitvoer, geteld in het rapport) en telt niet als
      rode assertie: elke bouwagent moet na elke wijziging groen kunnen
      draaien. Is de fout gefixt, dan telt dezelfde regel als groen.

   5. RLS ALS AANVALLER IS OPTIONEEL. Het laatste hoofdstuk laadt de
      migraties in PGlite en probeert als klant B, als anon en met
      rechtstreekse inserts/updates wat een klant niet mag. Dat vraagt
      het pakket @electric-sql/pglite, dat NIET in het project staat.
      Zet CP_PGLITE=<pad naar …/@electric-sql/pglite/dist/index.js>;
      zonder die variabele wordt het hoofdstuk eerlijk overgeslagen en
      staat er precies dat in de uitvoer. Er wordt nooit beweerd dat RLS
      getest is als dat niet zo is.
   ------------------------------------------------------------------ */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import '../portal/admin-model.js';
import '../portal/portaal-model.js';
import '../portal/invoice-core.js';
import '../portal/portaal-data.js';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

const M = globalThis.CP_MODEL;
const P = globalThis.CP_PORTAAL;
const D = globalThis.CP_PORTAAL_DATA;

const DEMO_KEY = 'cp_portal_demo_v1';
const SESSION_KEY = 'cp_portal_session_v1';

/* de vaste klok: dinsdag 8 september 2026, 12:00 in Amsterdam */
const NU = '2026-09-08T10:00:00.000Z';
const NU_MS = Date.parse(NU);
const RealDate = globalThis.Date;

/* de fasenamen zoals beheer.html (STAGES) en stage_label_nl() in 0021 ze
   kennen — het beheer geeft deze tabel aan collectInbox en mergeActivity */
const FASE = {
  concept: 'Concept & Industrieel Ontwerp',
  dfm: 'Ontwerp voor Produceerbaarheid',
  sourcing: 'Fabriekssourcing & Screening',
  tooling: 'Tooling, Sampling & Iteratie',
  production: 'Massaproductie & Kwaliteitscontrole',
  logistics: 'Compliance & Logistiek'
};
const faseNaam = (k) => FASE[k] || k;

/* ============================================================
   HULPJES
   ============================================================ */

function maakKlok(startMs, stapMs) {
  let teller = 0;
  return class KlokDate extends RealDate {
    constructor(...a) {
      if (a.length === 0) { super(startMs + teller * stapMs); teller++; }
      else super(...a);
    }
    static now() { const v = startMs + teller * stapMs; teller++; return v; }
  };
}

function opslagMock() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m.clear(); }
  };
}

/* De demoseed zoals portal.html hem laadt: demo-data.js maakt window.CP_DEMO,
   demo-data-ia.js en demo-data-portaal.js vullen hem aan zodra ze geladen
   worden. Het zijn kale browserscripts (geen UMD), dus even een window. */
function laadSeed() {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const oud = globalThis.window;
  globalThis.window = globalThis;
  try {
    require('../portal/demo-data.js');
    require('../portal/demo-data-ia.js');
    require('../portal/demo-data-portaal.js');
  } finally {
    if (had) globalThis.window = oud; else delete globalThis.window;
  }
  return JSON.parse(JSON.stringify(globalThis.CP_DEMO));
}

/* de bestandsopslag van de demo (demo-files.js leeft op IndexedDB; hier
   een Map met dezelfde beloften) */
const FILES = new Map();
const CP_FILES_STUB = {
  putFile: (id, blob, meta) => { FILES.set(id, { blob, meta }); return Promise.resolve(true); },
  getFile: (id) => Promise.resolve(FILES.get(id) || null),
  deleteFile: (id) => { FILES.delete(id); return Promise.resolve(); },
  fileUrl: (id) => Promise.resolve(FILES.has(id) ? 'blob:demo/' + id : null),
  isQuotaError: () => false
};

/* DE SCHRIJVEN-HAAK VAN portal.html — saveKlantacties() en demoSchrijf(),
   woordelijk overgenomen (portal.html, demoService). Dit is de echte keten:
   de collecties die de datalaag schrijft worden per rij op id samengevoegd
   met de verse opslag, rijen die alleen in de opslag staan blijven staan,
   en het geheel gaat naar localStorage. */
function portalHaak(w) {
  function saveKlantacties() {
    const cols = D.DEMO_COLLECTIES;
    /* de ingelogde klant: alleen ZIJN contactpersonen mogen hieronder
       verdwijnen (portal.html leest D.sessie(), met readSession() als terugval) */
    const sessie = D.sessie();
    const eigenKlantId = (sessie && sessie.clientId !== undefined && sessie.clientId !== null) ? String(sessie.clientId) : '';
    try {
      const raw = w.ls.getItem(DEMO_KEY);
      if (raw) {
        const latest = JSON.parse(raw);
        if (latest && Array.isArray(latest.clients)) {
          cols.forEach(function (k) {
            const eigen = w.huidig[k];
            if (!Array.isArray(eigen)) return;
            const doel = Array.isArray(latest[k]) ? latest[k] : [];
            const idx = {};
            doel.forEach(function (it, i) { if (it && it.id !== undefined && it.id !== null) idx[it.id] = i; });
            eigen.forEach(function (it) {
              if (!it) return;
              if (it.id !== undefined && it.id !== null && idx[it.id] !== undefined) doel[idx[it.id]] = it;
              else doel.push(it);
            });
            latest[k] = doel;
          });
          /* VERWIJDEREN (de spiegel van hetzelfde blok in portal.html): wat de
             verse opslag voor DEZE klant aan contactpersonen kent en de eigen
             staat niet meer, is verwijderd; andere klanten blijven onaangeroerd */
          if (eigenKlantId && Array.isArray(w.huidig.clientContacts) && Array.isArray(latest.clientContacts)) {
            const nogAanwezig = {};
            w.huidig.clientContacts.forEach(function (c) {
              if (c && c.id !== undefined && c.id !== null) nogAanwezig[c.id] = true;
            });
            latest.clientContacts = latest.clientContacts.filter(function (c) {
              if (!c || c.id === undefined || c.id === null) return true;
              if (String(c.clientId) !== eigenKlantId) return true;
              return !!nogAanwezig[c.id];
            });
          }
          w.huidig = latest;
        }
      }
    } catch (e) { /* onleesbare opslag: schrijf gewoon de eigen staat */ }
    w.ls.setItem(DEMO_KEY, JSON.stringify(w.huidig));
  }
  return function demoSchrijf(nieuw) {
    if (nieuw && typeof nieuw === 'object' && !Array.isArray(nieuw) && nieuw !== w.huidig) {
      return Promise.reject(new Error('demoSchrijf kreeg een andere state dan demoStaat teruggaf.'));
    }
    w.schrijfTeller++;
    saveKlantacties();
    return Promise.resolve(true);
  };
}

/* een kale haak: de staat wordt geschreven zoals hij is (geen samenvoeging).
   Alleen voor de test die het verschil met de portal.html-haak aanwijst. */
function kaleHaak(w) {
  return function (nieuw) {
    if (nieuw !== w.huidig) return Promise.reject(new Error('andere state'));
    w.schrijfTeller++;
    w.ls.setItem(DEMO_KEY, JSON.stringify(w.huidig));
    return Promise.resolve(true);
  };
}

let SEED = null;

/* EEN VERSE WERELD: de demo is al eens geopend (de opslag bestaat en is met
   het beheer gedeeld), de klant logt in zoals sessionFromClient() in
   portal.html dat doet, en de datalaag wordt met de haken gekoppeld. */
function vers(klantId = 'cli-noor', opties = {}) {
  const w = { ls: opslagMock(), ss: opslagMock(), huidig: null, schrijfTeller: 0 };
  globalThis.localStorage = w.ls;
  globalThis.sessionStorage = w.ss;
  w.ls.setItem(DEMO_KEY, JSON.stringify(SEED));
  w.huidig = JSON.parse(w.ls.getItem(DEMO_KEY));
  if (typeof opties.voorbereiden === 'function') {
    opties.voorbereiden(w.huidig);
    w.ls.setItem(DEMO_KEY, JSON.stringify(w.huidig));
  }
  const klant = w.huidig.clients.find((c) => c.id === klantId) || null;
  const sessie = klant ? {
    mode: 'demo', clientId: klant.id, company: klant.company, contactName: klant.contactName,
    email: klant.email, portalLang: klant.portalLang || ''
  } : null;
  if (sessie) w.ss.setItem(SESSION_KEY, JSON.stringify(sessie)); else w.ss.removeItem(SESSION_KEY);
  D.init({
    mode: 'demo',
    lezen: () => w.huidig,
    schrijven: opties.kaleHaak ? kaleHaak(w) : portalHaak(w),
    sessie: sessie
  });
  return w;
}

function opslag(w) { return JSON.parse(w.ls.getItem(DEMO_KEY)); }
function rij(lijst, pred) { return (lijst || []).find(pred) || null; }
function rijen(lijst, pred) { return (lijst || []).filter(pred); }
function stage(s, projectId, key) {
  const p = rij(s.projects, (x) => x.id === projectId);
  return p ? rij(p.stages, (x) => x.stageKey === key) : null;
}

/* de Inbox van het beheer over de opslag, met de bronnamen die
   admin-schermen-werk.js (inboxItems) aan collectInbox doorgeeft — plus
   questionMessages (de draad): het model leest die sinds de ketenfix om een
   klantreactie in een beantwoorde draad te zien; inboxItems moet hem nog
   gaan meegeven (zie het rapport van de ketenfix) */
function inbox(s) {
  return M.collectInbox({
    questions: s.questions, questionMessages: s.questionMessages, briefs: s.aanvragen, drafts: [], invoices: s.invoices,
    projects: s.projects, clients: s.clients, samples: s.samples, documents: s.documents,
    clientPayments: s.invoicePayments, invoiceAudit: s.invoiceAudit, reorders: s.reorderRequests,
    settings: s.settings || {}, now: NU, stageLabel: faseNaam
  });
}
function item(items, kind, id) { return rij(items, (it) => it.kind === kind && it.id === id); }
function badge(items) { return M.inboxBadgeCount(items, NU); }

/* de tijdlijn van het beheer: mergeActivity met de bronnen van
   admin-schermen-werk.js (activiteit) */
function fasesVan(s) {
  const uit = [];
  (s.projects || []).forEach((p) => (p.stages || []).forEach((st) => uit.push({
    projectId: p.id, stageKey: st.stageKey, status: st.status, approvedAt: st.approvedAt,
    paymentPct: st.paymentPct, position: st.position, approvedBy: st.approvedBy, approvedVia: st.approvedVia
  })));
  return uit;
}
function tijdlijnBeheer(s, scope) {
  return M.mergeActivity({
    accessLog: s.accessLog, mailLog: s.mailLog || [], auditLog: s.auditLog,
    contacts: s.contactMoments || [], questions: s.questions, stages: fasesVan(s),
    shipments: s.shipments, shipmentEvents: s.shipmentEvents, invoices: s.invoices,
    projects: s.projects, stageLabel: faseNaam
  }, scope || {});
}

/* de tijdlijn van de klant: activiteitVoorKlant over de bundel van één
   product, zoals portaal-schermen-beheer.js (actBronnen) hem opbouwt */
function tijdlijnKlant(s, projectId) {
  const p = rij(s.projects, (x) => x.id === projectId);
  const van = (k) => rijen(s[k], (r) => r && r.projectId === projectId);
  const vragen = van('questions');
  const zend = van('shipments');
  const bundle = {
    project: p, stages: p.stages,
    media: van('media'), documents: van('documents'), invoices: van('invoices'), samples: van('samples'),
    questions: vragen,
    questionMessages: rijen(s.questionMessages, (m) => vragen.some((q) => q.id === m.questionId)),
    inspections: van('inspections'), accessLog: van('accessLog'), docSlots: van('docSlots'),
    disclosures: van('disclosures'), shipments: zend,
    shipmentEvents: rijen(s.shipmentEvents, (e) => zend.some((z) => z.id === e.shipmentId)),
    reorderRequests: van('reorderRequests'),
    stageLabel: faseNaam
  };
  return P.activiteitVoorKlant(bundle, { projectId });
}

/* Een Nederlandse hele zin, geen code, geen Engels. */
function nlZin(zin, code) {
  if (typeof zin !== 'string' || zin.length < 12) return false;
  if (zin === code || /^[a-z_]+$/.test(zin)) return false;
  if (zin.indexOf(' ') < 0 || !/[.!?]$/.test(zin)) return false;
  if (/\b(the|not|invalid|error|failed|found|cannot|please|is required)\b/i.test(zin)) return false;
  return true;
}

/* één weigering = drie asserties: verworpen, juiste code, Nederlandse zin */
async function weigert(t, belofte, code, wat) {
  let err = null;
  try { await belofte; } catch (e) { err = e; }
  t.true(!!err, wat + ' — wordt geweigerd');
  t.eq(err && err.code, code, wat + ' — met code ' + code);
  const zin = D.berichtVoorFout(err);
  t.true(nlZin(zin, code), wat + ' — berichtVoorFout geeft een Nederlandse zin en geen code of Engels: ' + JSON.stringify(zin));
  return err;
}

/* de logregels die een actie hoort achter te laten: één in accessLog (met
   actie en asset) en één in auditLog (kind klant), zelfde tekst, zelfde
   tijdstip — de spiegel van portaal_log() in 0021 */
function logregels(t, s, verwacht, wat) {
  const acc = rijen(s.accessLog, (r) => r.detail === verwacht.detail);
  const aud = rijen(s.auditLog, (r) => r.detail === verwacht.detail);
  t.eq(acc.length, 1, wat + ' — precies één regel in accessLog met de tekst ' + JSON.stringify(verwacht.detail));
  t.eq(aud.length, 1, wat + ' — precies één regel in auditLog (kind klant) met dezelfde tekst');
  const a = acc[0] || {};
  const b = aud[0] || {};
  t.eq(a.action, verwacht.action, wat + ' — accessLog.action is ' + verwacht.action);
  t.eq(a.assetKind, verwacht.assetKind, wat + ' — accessLog.assetKind is ' + verwacht.assetKind);
  t.eq(a.actor, 'client', wat + ' — de actor is de klant');
  t.eq(a.projectId, verwacht.projectId, wat + ' — de regel hangt aan het juiste project');
  t.eq(a.createdAt, NU, wat + ' — de regel draagt het tijdstip van de vaste klok');
  t.eq(b.kind, 'klant', wat + ' — het staflogboek noemt de soort klant');
  t.eq(b.clientId, verwacht.clientId, wat + ' — het staflogboek noemt de klant');
  t.eq(b.createdAt, a.createdAt, wat + ' — de tweeling deelt één tijdstip (zoals now() in één transactie)');
  return a;
}

/* het item in de beheer-Inbox voor een klantactie: juiste soort, bak
   wachtopmij, doorKlant, en de sleutel met het eigen voorvoegsel */
function inboxItem(t, items, kind, id, prefix, wat) {
  const it = item(items, kind, id);
  t.true(!!it, wat + ' — staat als ' + kind + '-item in de Inbox');
  t.eq(it && it.chip, 'wachtopmij', wat + ' — in de bak Wacht op mij');
  t.eq(it && it.owner, 'mij', wat + ' — de eigenaar is mij');
  t.eq(it && it.doorKlant, true, wat + ' — met de vlag doorKlant');
  t.eq(it && M.itemKey(it.kind, it.id), prefix + id, wat + ' — sleutel ' + prefix + '…');
  return it;
}

/* één regel per actie in de beheer-tijdlijn, van de juiste soort. De actor
   van een accessLog-regel reist ONVERTAALD mee ('client', de waarde van
   0001) en het beheerscherm vertaalt hem (ACTOR_ALIAS in
   admin-schermen-beheer.js, dat zelf zegt dat mergeActivity dat eigenlijk
   hoort te doen); een auditregel zegt al 'klant'. Beide zijn de klant. */
function tijdlijnregel(t, rows, detail, kind, wat) {
  const hits = rijen(rows, (r) => r.detail === detail);
  t.eq(hits.length, 1, wat + ' — precies één regel in de tijdlijn (tweeling ontdubbeld): ' + JSON.stringify(detail));
  t.eq(hits[0] && hits[0].kind, kind, wat + ' — soort ' + kind);
  t.true(!!hits[0] && (hits[0].actor === 'klant' || hits[0].actor === 'client'), wat + ' — de actor is de klant (klant of de onvertaalde client uit access_log)');
  return hits[0] || null;
}

/* alle sleutels van een JSON-boom, voor de zeef op interne velden */
function alleSleutels(v, acc) {
  acc = acc || new Set();
  if (Array.isArray(v)) v.forEach((x) => alleSleutels(x, acc));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { acc.add(k); alleSleutels(v[k], acc); });
  return acc;
}

const BEVINDINGEN = [];
/* zie afspraak 4 in het kopblok */
function bevinding(t, cond, msg) {
  if (cond) { t.true(true, msg); return true; }
  BEVINDINGEN.push(msg);
  console.log('       ! bevinding (telt niet als fout): ' + msg);
  return false;
}

/* ============================================================
   DE TESTS
   ============================================================ */
export default async function (t) {
  const hadLS = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
  const hadSS = Object.prototype.hasOwnProperty.call(globalThis, 'sessionStorage');
  const hadFiles = Object.prototype.hasOwnProperty.call(globalThis, 'CP_FILES');
  const oudFiles = globalThis.CP_FILES;
  globalThis.Date = maakKlok(NU_MS, 0);
  globalThis.CP_FILES = CP_FILES_STUB;
  try {
    SEED = laadSeed();
    await keten(t);
    await tikkendeKlok(t);
    await rlsAlsAanvaller(t);
  } finally {
    globalThis.Date = RealDate;
    if (hadFiles) globalThis.CP_FILES = oudFiles; else delete globalThis.CP_FILES;
    if (!hadLS) delete globalThis.localStorage;
    if (!hadSS) delete globalThis.sessionStorage;
    ['CP_DEMO', 'CP_DEMO_IA', 'CP_DEMO_PORTAAL'].forEach((k) => { delete globalThis[k]; });
    D.init({ mode: 'demo' });
    if (BEVINDINGEN.length) console.log('       ! ' + BEVINDINGEN.length + ' bevinding(en) gemeld door keten-portaal (zie de regels hierboven)');
  }
}

async function keten(t) {
  /* ============================================================
     0. DE SEED EN DE KOPPELING
     ============================================================ */
  t.group('seed en koppeling');
  t.true(!!(M && P && D), 'CP_MODEL, CP_PORTAAL en CP_PORTAAL_DATA zijn geladen');
  t.eq(stage(SEED, 'prj-diffuser', 'production').status, 'awaiting_approval', 'de seed zet de productiefase van het diffuservat op wacht op akkoord (demo-data-portaal.js blok A)');
  t.eq(rij(SEED.samples, (x) => x.id === 'smp-p1').status, 'reviewed', 'sampleronde P1 wacht op de klant');
  t.eq(rij(SEED.docSlots, (x) => x.id === 'slot-04').status, 'verwacht', 'slot-04 is leeg en verwacht');
  t.eq(rij(SEED.reorderRequests, (x) => x.id === 'ro-01').status, 'offerte', 'de lopende herbestelling ro-01 staat al op offerte (dus een nieuwe aanvraag mag)');
  t.eq(rij(SEED.invoices, (x) => x.id === 'inv-05').statusCode, 'disputed', 'inv-05 is al betwist');
  {
    const w = vers();
    t.eq(D.modus(), 'demo', 'de datalaag staat in demomodus');
    t.true(D.gekoppeld(), 'lezen én schrijven zijn gekoppeld');
    t.eq(D.sessie().clientId, 'cli-noor', 'de sessie is Noor (cli-noor)');
    t.eq(JSON.parse(w.ss.getItem(SESSION_KEY)).clientId, 'cli-noor', 'de sessie staat in sessionStorage zoals portal.html hem schrijft');
    const items = inbox(opslag(w));
    t.true(!!item(items, 'fase', 'prj-diffuser:production'), 'vóór elke actie: de fase staat als goedkeuring in de Inbox');
    t.true(!!item(items, 'sample', 'smp-p1'), 'vóór elke actie: sample P1 wacht op de klant in de Inbox');
    t.eq(item(items, 'sample', 'smp-p1').chip, 'wachtopklant', 'en die ligt bij de klant, niet bij mij');
  }

  /* ============================================================
     1. AKKOORD GEVEN — approve_stage
     ============================================================ */
  t.group('akkoordGeven');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    const r = await D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'production' }, '  Noor van Dijk ');
    t.deep(D.controleerVorm('akkoordGeven', r), [], 'de belofte levert de beloofde vorm (VORMEN.akkoordGeven)');
    t.eq(r.status, 'done', 'de fase staat op done');
    t.eq(r.approvedVia, 'portaal', 'via het portaal');
    t.eq(r.approvedBy, 'Noor van Dijk', 'door de klant, naam bijgeknipt');
    t.eq(r.approvedAt, NU, 'approvedAt is het moment van de klok');
    t.eq(w.schrijfTeller, 1, 'de schrijven-haak is precies één keer geroepen');
    const s = opslag(w);
    const st = stage(s, 'prj-diffuser', 'production');
    t.eq(st.status, 'done', 'opslag: de fase is done');
    t.eq(st.approvedVia, 'portaal', 'opslag: approvedVia portaal');
    t.eq(st.approvedBy, 'Noor van Dijk', 'opslag: approvedBy');
    t.eq(stage(s, 'prj-diffuser', 'logistics').status, 'upcoming', 'de volgende fase wordt NIET automatisch actief: dat blijft beheerwerk');
    const detail = 'Fase goedgekeurd door Noor van Dijk: ' + FASE.production;
    logregels(t, s, { detail, action: 'approve', assetKind: 'stage', projectId: 'prj-diffuser', clientId: 'cli-noor' }, 'akkoord');
    const na = inbox(s);
    t.true(!!item(voor, 'fase', 'prj-diffuser:production'), 'Inbox vóór: de fase wachtte als goedkeuring');
    t.eq(item(na, 'fase', 'prj-diffuser:production'), null, 'Inbox na: het goedkeuringsitem is weg — de klant heeft geleverd');
    t.eq(badge(na), badge(voor), 'de badge Wacht op mij verandert niet: een akkoord is geen nieuw werk voor mij');
    const rows = tijdlijnBeheer(s, { projectId: 'prj-diffuser' });
    const regel = tijdlijnregel(t, rows, detail, 'akkoord', 'akkoord in de beheer-tijdlijn');
    t.eq(regel && regel.at, NU, 'de regel staat op het tijdstip van de klok');
    const kl = tijdlijnKlant(s, 'prj-diffuser');
    const klHits = rijen(kl, (x) => x.detail === detail);
    t.eq(klHits.length, 1, 'klanttijdlijn: het akkoord staat er één keer als tekst van approve_stage');
    t.eq(klHits[0] && klHits[0].kind, 'akkoord', 'klanttijdlijn: soort akkoord');
    /* geen tweede, naamloze regel uit de fasen zelf: activiteitVoorKlant
       geeft approvedBy/approvedVia door en mergeActivity ontdubbelt de
       tweeling (zelfde tekst, zelfde tijdstip) */
    const naamloos = rijen(kl, (x) => x.detail === 'Fase goedgekeurd: ' + FASE.production);
    t.eq(naamloos.length, 0,
      'klanttijdlijn: geen naamloze tweede regel "Fase goedgekeurd: …" naast de logregel — het akkoord staat er niet dubbel in');
    t.true(kl.every((x) => !x.actie), 'klanttijdlijn: geen enkele regel draagt een intern actietype (auditLog reist niet mee)');
  }

  /* ============================================================
     2. SAMPLE BEOORDELEN — decide_sample
     ============================================================ */
  t.group('sampleBeoordelen: aanpassing');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    const r = await D.sampleBeoordelen('smp-p1', 'aanpassing', ' De blinddruk staat te laag op het deksel. ', [{ x: 0.5, y: 0.62, tekst: 'hier' }]);
    t.deep(D.controleerVorm('sampleBeoordelen', r), [], 'de beloofde vorm (VORMEN.sampleBeoordelen)');
    t.eq(r.clientDecision, 'aanpassing', 'de klantbeslissing is aanpassing');
    t.eq(r.status, 'reviewed', 'de stafstatus blijft reviewed: de staf maakt een nieuwe ronde');
    t.eq(r.clientNote, 'De blinddruk staat te laag op het deksel.', 'de opmerking is bijgeknipt bewaard');
    t.eq(r.clientMarks.length, 1, 'de aanwijzing op de foto reist mee');
    t.eq(r.clientDecidedAt, NU, 'clientDecidedAt is het moment van de klok');
    const s = opslag(w);
    const sm = rij(s.samples, (x) => x.id === 'smp-p1');
    t.eq(sm.clientDecision, 'aanpassing', 'opslag: clientDecision');
    t.eq(sm.clientMarks.length, 1, 'opslag: clientMarks');
    const detail = 'Sample P1: aanpassing gevraagd door klant — De blinddruk staat te laag op het deksel. (1 aanwijzing(en) op de foto)';
    logregels(t, s, { detail, action: 'decide', assetKind: 'sample', projectId: 'prj-diffuser', clientId: 'cli-noor' }, 'samplekeuze');
    const na = inbox(s);
    t.eq(item(na, 'sample', 'smp-p1'), null, 'Inbox: het item "wacht op keuze van de klant" is weg (één ronde, één item)');
    const it = inboxItem(t, na, 'samplebeslissing', 'smp-p1', 'dec:', 'samplebeslissing');
    t.true(it && it.sub.indexOf('1 aanwijzing op de foto') > -1, 'het item telt de aanwijzing in woorden');
    t.eq(badge(na), badge(voor) + 1, 'de badge Wacht op mij telt één item meer: de bal ligt bij mij');
    tijdlijnregel(t, tijdlijnBeheer(s, { projectId: 'prj-diffuser' }), detail, 'samplekeuze', 'samplekeuze in de beheer-tijdlijn');
    const kl = rijen(tijdlijnKlant(s, 'prj-diffuser'), (x) => x.detail === detail);
    t.eq(kl.length, 1, 'klanttijdlijn: de samplekeuze staat er één keer');
    t.eq(kl[0] && kl[0].kind, 'samplekeuze', 'klanttijdlijn: soort samplekeuze');
    await weigert(t, D.sampleBeoordelen('smp-p1', 'goedgekeurd', '', []), 'sample_al_beoordeeld', 'een tweede beslissing op dezelfde ronde');
  }
  t.group('sampleBeoordelen: goedgekeurd');
  {
    const w = vers();
    const r = await D.sampleBeoordelen({ id: 'smp-p1' }, 'goedgekeurd', 'Dit is hem.', null);
    t.eq(r.status, 'approved', 'goedgekeurd zet de ronde op approved');
    t.eq(r.clientDecision, 'goedgekeurd', 'met de klantbeslissing erbij');
    const s = opslag(w);
    t.eq(rij(s.samples, (x) => x.id === 'smp-t2').status, 'superseded', 'de eerdere goedgekeurde ronde T2 is superseded: één goedgekeurde ronde per project');
    t.eq(rij(s.samples, (x) => x.id === 'smp-g-t1').status, 'approved', 'de goedgekeurde ronde van een ÁNDER project blijft staan');
    logregels(t, s, { detail: 'Sample P1 goedgekeurd door klant — Dit is hem.', action: 'decide', assetKind: 'sample', projectId: 'prj-diffuser', clientId: 'cli-noor' }, 'goedkeuring');
    const na = inbox(s);
    t.eq(item(na, 'sample', 'smp-p1'), null, 'Inbox: geen sample-item meer');
    t.eq(item(na, 'samplebeslissing', 'smp-p1'), null, 'Inbox: goedgekeurd is bewust GEEN samplebeslissing-item — er staat niets meer te doen');
    await weigert(t, D.sampleBeoordelen('smp-p1', 'aanpassing', 'toch niet', []), 'sample_niet_in_wachtstand', 'beslissen op een al goedgekeurde ronde');
  }

  /* ============================================================
     3. BETALING MELDEN — report_payment
     ============================================================ */
  t.group('betalingMelden');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    const r = await D.betalingMelden('inv-04', { cents: 100000, datumISO: '2026-09-07', kenmerk: ' deelbetaling ' });
    t.deep(D.controleerVorm('betalingMelden', r), [], 'de beloofde vorm (VORMEN.betalingMelden)');
    t.eq(r.gemeldeBetaling.reportedByClient, true, 'de melding is van de klant');
    t.eq(r.gemeldeBetaling.verifiedAt, null, 'en nog niet bevestigd');
    t.eq(r.gemeldeBetaling.amountCents, 100000, 'het bedrag in hele centen');
    t.eq(r.gemeldeBetaling.paidOn, '2026-09-07', 'de betaaldag');
    t.eq(r.gemeldeBetaling.clientReference, 'deelbetaling', 'het kenmerk, bijgeknipt');
    t.eq(r.status, 'open', 'de factuur zelf blijft open: een melding is geen boeking');
    t.eq(r.statusCode, 'finalized', 'en de statuscode verandert niet');
    t.false(Object.prototype.hasOwnProperty.call(r, 'internalNote'), 'de interne notitie reist niet mee naar de klant');
    const s = opslag(w);
    const pay = rij(s.invoicePayments, (x) => x.id === r.gemeldeBetaling.id);
    t.true(!!pay, 'opslag: de rij staat in invoicePayments');
    t.eq(pay && pay.reportedByClient, true, 'opslag: reportedByClient true');
    t.eq(pay && pay.verifiedAt, null, 'opslag: verifiedAt null');
    t.eq(pay && pay.method, 'overboeking', 'opslag: methode overboeking, zoals de RPC');
    t.eq(pay && pay.createdBy, 'klant:noor@ateliernoor.nl', 'opslag: createdBy in de vorm klant:<mail>');
    const inv = rij(s.invoices, (x) => x.id === 'inv-04');
    t.eq(inv.status, 'open', 'opslag: de factuur is niet herrekend');
    t.true(!!rij(s.invoiceAudit, (a) => a.invoiceId === 'inv-04' && a.event === 'betaling_gemeld' && a.detail.indexOf('€ 1.000,00') > -1), 'opslag: het factuurlogboek kent de melding (betaling_gemeld)');
    const detail = 'Betaling gemeld op factuur 15% — pre-shipment QC: € 1.000,00 op 7 sep 2026, kenmerk deelbetaling';
    logregels(t, s, { detail, action: 'report_payment', assetKind: 'invoice', projectId: 'prj-diffuser', clientId: 'cli-noor' }, 'betaling');
    const na = inbox(s);
    const it = inboxItem(t, na, 'betaling', pay.id, 'pay:', 'betaling gemeld');
    t.eq(it && it.title, 'Betaling gemeld: € 1.000,00 op factuur 15% — pre-shipment QC', 'de titel noemt bedrag en factuur');
    t.false(it && it.urgent, 'een melding van vandaag is nog niet urgent');
    t.true(!!item(na, 'betaling', 'pay-p01'), 'de eerder gemelde betaling uit de seed staat er nog naast');
    t.eq(badge(na), badge(voor) + 1, 'de badge Wacht op mij telt één item meer');
    tijdlijnregel(t, tijdlijnBeheer(s, { projectId: 'prj-diffuser' }), detail, 'betaling', 'betaling in de beheer-tijdlijn');
    const kl = rijen(tijdlijnKlant(s, 'prj-diffuser'), (x) => x.detail === detail);
    t.eq(kl.length, 1, 'klanttijdlijn: de melding staat er één keer');
    t.eq(kl[0] && kl[0].kind, 'betaling', 'klanttijdlijn: soort betaling');
    await weigert(t, D.betalingMelden('inv-04', { cents: 100000, datumISO: '2026-09-07' }), 'betaling_al_gemeld', 'dezelfde melding nog een keer (dubbelklik)');
    await weigert(t, D.betalingMelden('inv-04', { cents: 187500, datumISO: '2026-09-03' }), 'betaling_al_gemeld', 'de melding die de seed al kent (pay-p01)');
    const lijst = await D.listClientPayments('inv-04');
    t.eq(lijst.length, 2, 'listClientPayments geeft de seedmelding én de nieuwe, in de smalle projectie');
    t.true(lijst.every((x) => !('transactionRef' in x) && !('internalNote' in x)), 'zonder interne velden');
  }

  /* ============================================================
     4. BEZWAAR MAKEN — dispute_invoice
     ============================================================ */
  t.group('bezwaarMaken');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    const r = await D.bezwaarMaken({ id: 'inv-04' }, ' Het bedrag klopt niet met de offerte van 6 april. ');
    t.deep(D.controleerVorm('bezwaarMaken', r), [], 'de beloofde vorm (VORMEN.bezwaarMaken)');
    t.eq(r.statusCode, 'disputed', 'de statuscode is disputed');
    t.eq(r.reminderPaused, true, 'de herinneringen staan op pauze');
    t.eq(r.status, 'open', 'de factuur blijft open: bezwaar is geen kwijtschelding');
    const s = opslag(w);
    const inv = rij(s.invoices, (x) => x.id === 'inv-04');
    t.eq(inv.statusCode, 'disputed', 'opslag: statusCode disputed');
    t.eq(inv.reminderPaused, true, 'opslag: reminderPaused');
    t.eq(inv.updatedAt, NU, 'opslag: updatedAt is de klok');
    const audit = rij(s.invoiceAudit, (a) => a.invoiceId === 'inv-04' && a.event === 'bezwaar_klant');
    t.true(!!audit, 'opslag: het factuurlogboek kent het bezwaar (bezwaar_klant)');
    t.eq(audit && audit.fromStatus, 'finalized', 'met de stand ervoor');
    t.eq(audit && audit.toStatus, 'disputed', 'en de stand erna');
    t.eq(audit && audit.detail, 'Het bedrag klopt niet met de offerte van 6 april.', 'en de reden');
    const detail = 'Bezwaar op factuur 15% — pre-shipment QC: Het bedrag klopt niet met de offerte van 6 april.';
    logregels(t, s, { detail, action: 'dispute', assetKind: 'invoice', projectId: 'prj-diffuser', clientId: 'cli-noor' }, 'bezwaar');
    const na = inbox(s);
    const it = inboxItem(t, na, 'bezwaar', 'inv-04', 'disp:', 'bezwaar');
    t.true(it && it.urgent, 'een bezwaar is altijd urgent');
    t.true(it && it.sub.indexOf('Het bedrag klopt niet') === 0, 'de reden komt uit het factuurlogboek op het item');
    t.true(!!item(na, 'bezwaar', 'inv-05'), 'het bezwaar uit de seed (inv-05) staat er nog naast');
    t.eq(badge(na), badge(voor) + 1, 'de badge Wacht op mij telt één item meer');
    tijdlijnregel(t, tijdlijnBeheer(s, { projectId: 'prj-diffuser' }), detail, 'bezwaar', 'bezwaar in de beheer-tijdlijn');
    const kl = rijen(tijdlijnKlant(s, 'prj-diffuser'), (x) => x.detail === detail);
    t.eq(kl.length, 1, 'klanttijdlijn: het bezwaar staat er één keer');
    t.eq(kl[0] && kl[0].kind, 'bezwaar', 'klanttijdlijn: soort bezwaar');
    await weigert(t, D.bezwaarMaken('inv-04', 'nog een keer'), 'factuur_al_betwist', 'twee keer bezwaar op dezelfde factuur');
    /* betaling melden op een betwiste factuur mag wél (disputed is open voor een melding) */
    const r2 = await D.betalingMelden('inv-04', { cents: 50000, datumISO: '2026-09-08' });
    t.eq(r2.gemeldeBetaling.amountCents, 50000, 'op een betwiste factuur kan de klant nog wél een betaling melden (disputed is open voor een melding, zoals in 0021)');
  }

  /* ============================================================
     5. BERICHT STUREN — question_messages
     ============================================================ */
  t.group('berichtSturen');
  {
    const w = vers();
    const s0 = opslag(w);
    const voor = inbox(s0);
    const r = await D.berichtSturen('q-06', ' Adres: Randstad 22, Almere. Contact ter plaatse: Sanne. Venster 8 tot 16 uur. ');
    t.deep(D.controleerVorm('berichtSturen', r), [], 'de beloofde vorm (VORMEN.berichtSturen)');
    t.eq(r.author, 'client', 'de auteur is de klant — nooit staff');
    t.eq(r.authorName, 'Noor van Dijk', 'met de eigen contactnaam, zoals de policy toestaat');
    t.eq(r.questionId, 'q-06', 'in de eigen draad');
    t.eq(r.createdAt, NU, 'createdAt is de klok');
    t.false(r.virtueel, 'een echt bericht, geen virtueel');
    const s = opslag(w);
    t.true(!!rij(s.questionMessages, (m) => m.id === r.id && m.body === r.body), 'opslag: het bericht staat in questionMessages');
    t.eq(s.accessLog.length, s0.accessLog.length, 'geen logregel: live is er geen trigger op question_messages, de demo dus ook niet (pariteit)');
    t.eq(s.auditLog.length, s0.auditLog.length, 'ook geen auditregel');
    const draad = await D.listMessages('q-06');
    t.eq(draad[draad.length - 1].id, r.id, 'listMessages toont het bericht als laatste in de draad');
    t.eq(draad[0].author, 'client', 'en de oorspronkelijke vraag vooraan');
    const na = inbox(s);
    t.eq(badge(na), badge(voor) + 1, 'de badge telt één item meer: collectInbox leest de draad en ziet dat de bal weer bij mij ligt');
    const q = item(na, 'vraag', 'q-06');
    t.true(!!q && q.chip === 'wachtopmij',
      'een antwoord van de klant in een al beantwoorde draad (q-06) heropent het Inbox-item: collectInbox leest questionMessages en zet het op wacht op mij (demo-data-portaal.js blok G)');
    t.true(!!q && q.sub.indexOf('Reactie van de klant') === 0, 'met de ondertitel "Reactie van de klant"');
    t.eq(q && q.doorKlant, true, 'en de vlag doorKlant');
    t.eq(q && q.at, r.createdAt, 'het item is zo oud als de reactie');
  }

  /* ============================================================
     6. VRAAG STELLEN — question_threads
     ============================================================ */
  t.group('vraagStellen');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    const r = await D.vraagStellen('prj-diffuser', ' Kunnen we de dop ook in mat zwart krijgen? ', { id: 'med-07', stageKey: 'production' });
    t.deep(D.controleerVorm('vraagStellen', r), [], 'de beloofde vorm (VORMEN.vraagStellen)');
    t.eq(r.projectId, 'prj-diffuser', 'op het eigen project');
    t.eq(r.question, 'Kunnen we de dop ook in mat zwart krijgen?', 'de vraag, bijgeknipt');
    t.eq(r.answer, '', 'nog zonder antwoord');
    t.eq(r.askedAt, NU, 'askedAt is de klok');
    t.eq(r.mediaId, 'med-07', 'gekoppeld aan de foto');
    const s = opslag(w);
    t.true(!!rij(s.questions, (q) => q.id === r.id), 'opslag: de vraag staat in questions');
    const na = inbox(s);
    const it = item(na, 'vraag', r.id);
    t.true(!!it, 'Inbox: de vraag is een item');
    t.eq(it && it.chip, 'wachtopmij', 'in de bak Wacht op mij');
    t.eq(it && M.itemKey(it.kind, it.id), 'q:' + r.id, 'sleutel q:…');
    t.eq(badge(na), badge(voor) + 1, 'de badge telt één item meer');
    const rows = tijdlijnBeheer(s, { projectId: 'prj-diffuser' });
    t.eq(rijen(rows, (x) => x.detail === 'Vraag gesteld: Kunnen we de dop ook in mat zwart krijgen?').length, 1, 'beheer-tijdlijn: "Vraag gesteld" één keer');
    const kl = rijen(tijdlijnKlant(s, 'prj-diffuser'), (x) => x.detail === 'Vraag gesteld: Kunnen we de dop ook in mat zwart krijgen?');
    t.eq(kl.length, 1, 'klanttijdlijn: de vraag staat er één keer');
    t.eq(kl[0] && kl[0].kind, 'klant', 'klanttijdlijn: soort klant');
  }

  /* ============================================================
     7. BESTAND AANLEVEREN — documents + bucket klant-upload
     ============================================================ */
  t.group('bestandAanleveren');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    const bestand = { name: 'afleveradres-almere.pdf', type: 'application/pdf', size: 52000 };
    const r = await D.bestandAanleveren({ id: 'slot-04' }, bestand, ' Adres en venstertijden voor batch A. ');
    t.deep(D.controleerVorm('bestandAanleveren', r), [], 'de beloofde vorm (VORMEN.bestandAanleveren)');
    t.eq(r.uploadedBy, 'klant', 'uploadedBy klant');
    t.eq(r.slotId, 'slot-04', 'in het gevraagde slot');
    t.eq(r.docType, 'specificatie', 'met het doc_type van het slot');
    t.eq(r.stageKey, 'logistics', 'en de fase van het slot');
    t.eq(r.title, 'afleveradres-almere.pdf', 'de bestandsnaam als titel');
    t.eq(r.clientNote, 'Adres en venstertijden voor batch A.', 'de opmerking, bijgeknipt');
    t.true(r.heeftBestand, 'er hangt een bestand aan');
    t.false(Object.prototype.hasOwnProperty.call(r, 'fileRef'), 'de opslagverwijzing reist niet mee');
    t.eq(r.version, 1, 'eerste aanlevering van dit type: versie 1');
    const s = opslag(w);
    const doc = rij(s.documents, (d) => d.id === r.id);
    t.true(!!doc, 'opslag: de documentrij bestaat');
    t.eq(doc && doc.uploadedBy, 'klant', 'opslag: uploadedBy klant');
    t.eq(doc && doc.slotId, 'slot-04', 'opslag: slotId');
    t.true(!!(doc && doc.fileRef && FILES.has(doc.fileRef)), 'opslag: de fileRef wijst naar een bestand in de bestandsopslag');
    const slot = rij(s.docSlots, (x) => x.id === 'slot-04');
    t.eq(slot.status, 'gevuld', 'opslag: het slot is gevuld (de spiegel van documents_fill_slot)');
    t.eq(slot.documentId, r.id, 'opslag: het slot wijst naar het document');
    const detail = 'Bestand aangeleverd door klant: afleveradres-almere.pdf — Adres en venstertijden voor batch A.';
    logregels(t, s, { detail, action: 'upload', assetKind: 'document', projectId: 'prj-diffuser', clientId: 'cli-noor' }, 'klantbestand');
    const na = inbox(s);
    const it = inboxItem(t, na, 'klantbestand', r.id, 'upl:', 'bestand van de klant');
    t.eq(it && it.title, 'afleveradres-almere.pdf', 'de titel is de bestandsnaam');
    t.true(it && it.sub.indexOf(FASE.logistics) > -1, 'de ondertitel noemt de fase in het Nederlands');
    t.true(!!item(na, 'klantbestand', 'doc-10'), 'het klantbestand uit de seed (doc-10, 5 dagen oud) staat er nog naast');
    t.eq(badge(na), badge(voor) + 1, 'de badge telt één item meer');
    tijdlijnregel(t, tijdlijnBeheer(s, { projectId: 'prj-diffuser' }), detail, 'klantbestand', 'klantbestand in de beheer-tijdlijn');
    const kl = rijen(tijdlijnKlant(s, 'prj-diffuser'), (x) => x.detail === detail);
    t.eq(kl.length, 1, 'klanttijdlijn: de aanlevering staat er één keer');
    t.eq(kl[0] && kl[0].kind, 'klantbestand', 'klanttijdlijn: soort klantbestand');
    await weigert(t, D.bestandAanleveren('slot-04', bestand, ''), 'slot_al_gevuld', 'nog een bestand in hetzelfde slot');
    t.eq(opslag(w).documents.length, s.documents.length, 'de geweigerde tweede aanlevering laat geen documentrij achter');
  }

  /* ============================================================
     8. HERBESTELLEN — request_reorder
     ============================================================ */
  t.group('herbestellen');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    const r = await D.herbestellen('prj-geurflacon', { qty: 2000, gewenstOpISO: '2026-12-01', zelfdeSpec: true });
    t.deep(D.controleerVorm('herbestellen', r), [], 'de beloofde vorm (VORMEN.herbestellen)');
    t.eq(r.status, 'aanvraag', 'landt op stap 1: aanvraag');
    t.eq(r.clientId, 'cli-noor', 'van de ingelogde klant');
    t.eq(r.qty, 2000, 'het aantal');
    t.eq(r.wantedBy, '2026-12-01', 'de gewenste dag');
    t.eq(r.sameSpec, true, 'zelfde specificatie');
    t.eq(r.createdAt, NU, 'createdAt is de klok');
    const s = opslag(w);
    const ro = rij(s.reorderRequests, (x) => x.id === r.id);
    t.true(!!ro, 'opslag: de rij staat in reorderRequests');
    t.eq(ro && ro.status, 'aanvraag', 'opslag: status aanvraag');
    const detail = 'Herbestelling aangevraagd: 2000 stuks, gewenst op 1 dec 2026, zelfde specificatie';
    logregels(t, s, { detail, action: 'reorder', assetKind: 'reorder', projectId: 'prj-geurflacon', clientId: 'cli-noor' }, 'herbestelling');
    const na = inbox(s);
    const it = inboxItem(t, na, 'herbestelling', r.id, 'ro:', 'herbestelling');
    t.eq(it && it.pipeline && it.pipeline.stage, 'aanvraag', 'de pijplijn op het item staat op aanvraag');
    t.true(it && it.title.indexOf('2.000 stuks') > -1, 'de titel noemt het aantal met duizendtal');
    t.true(!!item(na, 'herbestelling', 'ro-01'), 'de lopende herbestelling uit de seed (op offerte) staat er nog naast');
    t.eq(badge(na), badge(voor) + 1, 'de badge telt één item meer');
    tijdlijnregel(t, tijdlijnBeheer(s, { projectId: 'prj-geurflacon' }), detail, 'klant', 'herbestelling in de beheer-tijdlijn (soort klant, zoals KLANTACTIES zegt)');
    const kl = rijen(tijdlijnKlant(s, 'prj-geurflacon'), (x) => x.detail === detail);
    t.eq(kl.length, 1, 'klanttijdlijn: de herbestelling staat er één keer');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 500, zelfdeSpec: true }), 'herbestelling_loopt_al', 'een tweede aanvraag terwijl de eerste nog op stap 1 staat');
    const mijn = await D.listReorders('prj-geurflacon');
    t.eq(mijn.length, 2, 'listReorders: de seedaanvraag en de nieuwe');
  }

  /* ============================================================
     9. CONTACTPERSONEN — client_contacts
     ============================================================ */
  t.group('contactpersoonOpslaan');
  {
    const w = vers();
    const s0 = opslag(w);
    const voor = inbox(s0);
    const r = await D.contactpersoonOpslaan({ name: ' Pieter Bakker ', email: 'Pieter@AtelierNoor.nl', role: 'Financiën', mailCategories: ['factuur', 'factuur'], canLogin: false });
    t.deep(D.controleerVorm('contactpersoonOpslaan', r), [], 'de beloofde vorm (VORMEN.contactpersoonOpslaan)');
    t.eq(r.clientId, 'cli-noor', 'van de ingelogde klant');
    t.eq(r.email, 'pieter@ateliernoor.nl', 'het e-mailadres in kleine letters (de unieke index van 0021 is lower(email))');
    t.deep(r.mailCategories, ['factuur'], 'categorieën ontdubbeld');
    t.eq(r.initialen, 'PB', 'de initialen voor de avatar');
    const s = opslag(w);
    const cc = rij(s.clientContacts, (x) => x.id === r.id);
    t.true(!!cc, 'opslag: de rij staat in clientContacts');
    t.eq(cc && cc.name, 'Pieter Bakker', 'opslag: naam bijgeknipt');
    const detail = 'Contactpersoon toegevoegd door klant: Pieter Bakker <pieter@ateliernoor.nl>';
    const aud = rijen(s.auditLog, (a) => a.detail === detail);
    t.eq(aud.length, 1, 'precies één auditregel (de spiegel van client_contacts_log)');
    t.eq(aud[0] && aud[0].kind, 'klant', 'van de soort klant');
    t.eq(aud[0] && aud[0].projectId, null, 'zonder project: een contactpersoon hangt aan de klant');
    t.eq(aud[0] && aud[0].clientId, 'cli-noor', 'met de klant erbij');
    t.eq(s.accessLog.length, s0.accessLog.length, 'geen accessLog-regel: access_log eist een project (pariteit met 0021)');
    const na = inbox(s);
    t.eq(badge(na), badge(voor), 'een contactpersoon is geen Inbox-werk: de badge verandert niet');
    t.eq(na.length, voor.length, 'en er komt geen item bij');
    const rows = tijdlijnBeheer(s, { clientId: 'cli-noor' });
    const regel = tijdlijnregel(t, rows, detail, 'klant', 'contactpersoon in de beheer-tijdlijn (klantscope)');
    t.eq(regel && regel.clientId, 'cli-noor', 'de regel hangt aan de klant');
    /* wijzigen: dezelfde functie met id */
    const r2 = await D.contactpersoonOpslaan({ id: 'cc-01', name: 'Sanne Vermeulen-de Vries', email: 'sanne@ateliernoor.nl', role: 'Operations', mailCategories: ['fase'], canLogin: true });
    t.eq(r2.id, 'cc-01', 'wijzigen geeft dezelfde rij terug');
    t.eq(r2.name, 'Sanne Vermeulen-de Vries', 'met de nieuwe naam');
    t.eq(rij(opslag(w).clientContacts, (x) => x.id === 'cc-01').name, 'Sanne Vermeulen-de Vries', 'opslag: de naam is gewijzigd');
    t.eq(rijen(opslag(w).auditLog, (a) => a.detail === 'Contactpersoon gewijzigd door klant: Sanne Vermeulen-de Vries <sanne@ateliernoor.nl>').length, 1, 'één auditregel "gewijzigd"');
    const lijst = await D.listContacts();
    t.deep(lijst.map((x) => x.id), ['cc-02', r.id, 'cc-01'], 'listContacts: alleen de eigen mensen, op naam gesorteerd (Iris, Pieter, Sanne)');
  }
  t.group('contactpersoonVerwijderen');
  {
    /* met de kale haak: de datalaag zelf doet het goed */
    const w = vers('cli-noor', { kaleHaak: true });
    const r = await D.contactpersoonVerwijderen('cc-02');
    t.deep(D.controleerVorm('contactpersoonVerwijderen', r), [], 'de beloofde vorm (VORMEN.contactpersoonVerwijderen)');
    t.eq(r.verwijderd, true, 'de teruggegeven rij draagt verwijderd: true');
    t.eq(r.name, 'Iris Molenaar', 'en is de verwijderde persoon');
    const s = opslag(w);
    t.eq(rij(s.clientContacts, (x) => x.id === 'cc-02'), null, 'datalaag: de rij is uit de staat');
    t.eq(rijen(s.auditLog, (a) => a.detail === 'Contactpersoon verwijderd door klant: Iris Molenaar <iris@ateliernoor.nl>').length, 1, 'één auditregel "verwijderd"');
    t.eq((await D.listContacts()).length, 1, 'listContacts telt er nog één');
    /* met de haak van portal.html: de verwijdering overleeft het samenvoegen */
    const w2 = vers();
    await D.contactpersoonVerwijderen('cc-02');
    const s2 = opslag(w2);
    t.eq(rij(s2.clientContacts, (x) => x.id === 'cc-02'), null,
      'contactpersoonVerwijderen via de portal.html-haak: saveKlantacties() haalt de verwijderde eigen contactpersoon (cc-02) ook uit de verse opslag — hij komt niet terug in localStorage');
    t.true((await D.listContacts()).every((x) => x.id !== 'cc-02'),
      'contactpersoonVerwijderen via portal.html-haak: na de opslagronde toont listContacts de verwijderde persoon niet meer');
    t.eq(rijen(s2.clientContacts, (x) => x.clientId === 'cli-fjell').length, 2,
      'de contactpersonen van de andere klant (Fjell) blijven onaangeroerd');
  }

  /* ============================================================
     10. TAAL EN MELDINGEN — clients.portal_lang / mail_prefs
     ============================================================ */
  t.group('taalKiezen');
  {
    const w = vers();
    const s0 = opslag(w);
    const r = await D.taalKiezen(' EN ');
    t.deep(D.controleerVorm('taalKiezen', r), [], 'de beloofde vorm (VORMEN.taalKiezen)');
    t.eq(r.portalLang, 'en', 'de taal is en (klein geschreven, bijgeknipt)');
    t.false(Object.prototype.hasOwnProperty.call(r, 'notes'), 'de notitie van het beheer óver de klant reist niet mee');
    t.eq(rij(opslag(w).clients, (c) => c.id === 'cli-noor').portalLang, 'en', 'opslag: clients.portalLang');
    t.eq(rij(opslag(w).clients, (c) => c.id === 'cli-fjell').portalLang, 'en', 'de andere klant staat er los van (was al en)');
    t.eq(D.sessie().portalLang, 'en', 'de sessie draait mee');
    t.eq(opslag(w).accessLog.length, s0.accessLog.length, 'geen logregel: de trigger van 0021 logt een voorkeur niet, de demo dus ook niet');
    t.eq(rij(opslag(w).clients, (c) => c.id === 'cli-noor').company, 'Atelier Noor', 'alleen de voorkeur wijzigt, de rest van de klantrij niet');
  }
  t.group('meldingenOpslaan');
  {
    const w = vers();
    const r = await D.meldingenOpslaan({ fase: true, factuur: false, zending: false, sample: true });
    t.deep(D.controleerVorm('meldingenOpslaan', r), [], 'de beloofde vorm (VORMEN.meldingenOpslaan)');
    t.deep(r.mailPrefs, { factuur: false, zending: false }, 'opgeslagen wordt alleen wat UIT staat (de vorm van 0005)');
    t.eq(r.meldingen.fase, true, 'de afgeleide kaart: fase aan');
    t.eq(r.meldingen.factuur, false, 'factuur uit');
    t.eq(r.meldingen.relatie, true, 'een niet genoemde categorie staat aan');
    t.deep(rij(opslag(w).clients, (c) => c.id === 'cli-noor').mailPrefs, { factuur: false, zending: false }, 'opslag: clients.mailPrefs');
    const k = await D.mijnKlant();
    t.deep(k.mailPrefs, { factuur: false, zending: false }, 'mijnKlant leest dezelfde voorkeur terug');
  }

  /* ============================================================
     11. DOWNLOAD ALLES — de dossier-export
     ============================================================ */
  t.group('downloadAlles');
  {
    const w = vers('cli-noor', {
      voorbereiden: (s) => {
        /* een interne notitie en een geplande factuur die de klant niet
           mag zien, om de zeef te toetsen */
        rij(s.invoices, (x) => x.id === 'inv-04').internalNote = 'GEHEIM: korting van 10% besproken';
        rij(s.clients, (c) => c.id === 'cli-noor').notes = 'GEHEIM: betaalt traag';
        s.invoices.push({ id: 'inv-gepland', projectId: 'prj-diffuser', stageKey: 'logistics', label: 'Gepland', amountCents: 100, currency: 'EUR', status: 'open', publishStatus: 'published', statusCode: 'scheduled', docKind: 'invoice', createdAt: '2026-09-07' });
      }
    });
    const r = await D.downloadAlles();
    t.deep(D.controleerVorm('downloadAlles', r), [], 'de beloofde vorm (VORMEN.downloadAlles)');
    t.eq(r.bestandsnaam, 'customplus-dossier-atelier-noor-2026-09-08.json', 'de bestandsnaam draagt de klant en de dag');
    t.eq(r.mime, 'application/json', 'als JSON');
    t.eq(r.aantalProjecten, 2, 'de twee producten van Noor');
    const uit = JSON.parse(r.json);
    t.deep(uit.projecten.map((p) => p.project.id).sort(), ['prj-diffuser', 'prj-geurflacon'], 'alleen de eigen producten, niets van Fjell');
    const sleutels = alleSleutels(uit);
    D.INTERNE_VELDEN.forEach((k) => t.false(sleutels.has(k), 'nergens in de export staat het interne veld ' + k));
    t.false(r.json.indexOf('GEHEIM') > -1, 'geen enkele interne tekst lekt mee');
    t.true(uit.herbestellingen.some((x) => x.id === 'ro-01'), 'de eigen herbestelling zit erin');
    t.true(uit.contactpersonen.some((x) => x.id === 'cc-01'), 'de eigen contactpersonen zitten erin');
    t.false(uit.contactpersonen.some((x) => x.id === 'cc-03'), 'de contactpersonen van Fjell niet');
    const diff = uit.projecten.find((p) => p.project.id === 'prj-diffuser');
    t.true(diff.documents.every((d) => d.publishStatus !== 'concept'), 'conceptdocumenten bestaan voor de klant niet');
    t.true(diff.invoices.every((i) => i.publishStatus !== 'concept'), 'conceptfacturen ook niet');
    t.false(diff.invoices.some((i) => i.statusCode === 'scheduled'),
      'een geplande factuur (statusCode scheduled, publishStatus published) zit niet in de export: dezelfde zeef als owns_invoice in 0008, betalingMelden, bezwaarMaken en activiteitVoorKlant');
    t.eq(diff.stages.length, 6, 'de zes fasen van het product in de export');
    t.true(diff.stages.every((st) => Object.prototype.hasOwnProperty.call(st, 'approvedVia')), 'elke fase draagt approvedVia (de vorm van normStage)');
  }

  /* ============================================================
     12. FACTUUR-PDF — het gekoppelde factuurdocument
     ============================================================ */
  t.group('factuurPdf');
  {
    const w = vers('cli-noor', {
      voorbereiden: (s) => { rij(s.documents, (d) => d.id === 'doc-03').fileRef = 'file-doc-03'; }
    });
    FILES.set('file-doc-03', { blob: {}, meta: { name: 'factuur.pdf' } });
    const s0 = opslag(w);
    const zonder = await D.factuurPdf('inv-04');
    t.deep(D.controleerVorm('factuurPdf', zonder), [], 'de beloofde vorm (VORMEN.factuurPdf)');
    t.eq(zonder.beschikbaar, false, 'een factuur zonder document: niet beschikbaar');
    t.eq(zonder.reden, 'geen_document', 'met de reden geen_document');
    t.eq(zonder.url, null, 'en geen link die alleen een fout kan geven');
    const volgt = await D.factuurPdf('inv-02');
    t.eq(volgt.beschikbaar, false, 'een document zonder bestand: niet beschikbaar');
    t.eq(volgt.reden, 'pdf_volgt', 'met de reden pdf_volgt');
    t.eq(opslag(w).accessLog.length, s0.accessLog.length, 'een mislukte ophaling schrijft geen downloadregel');
    const r = await D.factuurPdf({ id: 'inv-01', projectId: 'prj-diffuser', documentId: 'doc-03' });
    t.eq(r.beschikbaar, true, 'het factuurdocument met bestand is beschikbaar');
    t.eq(r.url, 'blob:demo/file-doc-03', 'met de link uit de bestandsopslag');
    t.eq(r.document.id, 'doc-03', 'en het documentrecord');
    t.false(Object.prototype.hasOwnProperty.call(r.document, 'fileRef'), 'zonder opslagverwijzing');
    t.eq(r.logRegel && r.logRegel.action, 'download', 'de downloadregel is geschreven');
    const s = opslag(w);
    const log = rij(s.accessLog, (x) => x.id === r.logRegel.id);
    t.true(!!log, 'opslag: de downloadregel staat in accessLog');
    t.eq(log && log.assetId, 'doc-03', 'op het document');
    t.eq(log && log.detail, 'Factuur 25% — ontwerpaftekening', 'met de titel als tekst');
    const kl = rijen(tijdlijnKlant(s, 'prj-diffuser'), (x) => x.id === r.logRegel.id);
    t.eq(kl.length, 1, 'klanttijdlijn: de download staat er');
    t.eq(kl[0] && kl[0].kind, 'bestanden', 'als soort bestanden');
  }

  /* ============================================================
     13. DE HELE KETEN IN ÉÉN OPSLAG — alles na elkaar, één Inbox
     ============================================================ */
  t.group('alle acties na elkaar in één opslag');
  {
    const w = vers();
    const voor = inbox(opslag(w));
    await D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'production' }, 'Noor van Dijk');
    await D.sampleBeoordelen('smp-p1', 'aanpassing', 'Deksel te laag.', []);
    const pay = await D.betalingMelden('inv-04', { cents: 187500, datumISO: '2026-09-08', kenmerk: 'REQ 0402' });
    await D.bezwaarMaken('inv-04', 'Eerst overleg.');
    await D.berichtSturen('q-06', 'Adres volgt per bestand.');
    const vraag = await D.vraagStellen('prj-diffuser', 'Wanneer is de douane klaar?');
    const doc = await D.bestandAanleveren('slot-04', { name: 'adres.pdf', type: 'application/pdf', size: 1000 }, '');
    const ro = await D.herbestellen('prj-geurflacon', { qty: 1500, zelfdeSpec: false, wijziging: 'Nieuw etiket.' });
    await D.contactpersoonOpslaan({ name: 'Pieter Bakker', email: 'pieter@ateliernoor.nl' });
    await D.taalKiezen('de');
    await D.meldingenOpslaan({ relatie: false });
    t.eq(w.schrijfTeller, 11, 'elf schrijfacties, elf keer de haak');
    const s = opslag(w);
    const na = inbox(s);
    t.eq(item(na, 'fase', 'prj-diffuser:production'), null, 'de goedkeuring is weg');
    t.eq(item(na, 'sample', 'smp-p1'), null, 'het sample-wacht-op-klant-item is weg');
    ['samplebeslissing:smp-p1', 'betaling:' + pay.gemeldeBetaling.id, 'bezwaar:inv-04', 'vraag:' + vraag.id, 'klantbestand:' + doc.id, 'herbestelling:' + ro.id]
      .forEach((sleutel) => {
        const [kind, id] = sleutel.split(/:(.+)/);
        const it = item(na, kind, id);
        t.true(!!it && it.chip === 'wachtopmij', 'na de reeks staat ' + kind + ' ' + id + ' in Wacht op mij');
      });
    t.true(!!item(na, 'vraag', 'q-06') && item(na, 'vraag', 'q-06').chip === 'wachtopmij', 'na de reeks staat ook de heropende draad q-06 (reactie van de klant) in Wacht op mij');
    t.eq(badge(na), badge(voor) + 7, 'de badge telt zeven items meer: samplebeslissing, betaling, bezwaar, reactie in q-06, vraag, klantbestand, herbestelling');
    /* elke klantactie precies één keer in de beheer-tijdlijn */
    const rows = tijdlijnBeheer(s, { clientId: 'cli-noor' });
    const klantregels = rijen(rows, (x) => x.at === NU);
    const perTekst = {};
    klantregels.forEach((x) => { perTekst[x.detail] = (perTekst[x.detail] || 0) + 1; });
    t.true(Object.keys(perTekst).every((k) => perTekst[k] === 1), 'geen enkele klantactie van vandaag staat twee keer in de beheer-tijdlijn');
    t.eq(rijen(klantregels, (x) => x.kind === 'akkoord').length, 1, 'één akkoord');
    t.eq(rijen(klantregels, (x) => x.kind === 'samplekeuze').length, 1, 'één samplekeuze');
    t.eq(rijen(klantregels, (x) => x.kind === 'betaling').length, 1, 'één betaling');
    t.eq(rijen(klantregels, (x) => x.kind === 'bezwaar').length, 1, 'één bezwaar');
    t.eq(rijen(klantregels, (x) => x.kind === 'klantbestand').length, 1, 'één klantbestand');
    t.eq(rijen(klantregels, (x) => x.kind === 'klant' && /^Herbestelling aangevraagd/.test(x.detail)).length, 1, 'één herbestelling (soort klant)');
    t.eq(rijen(klantregels, (x) => x.kind === 'klant' && /^Contactpersoon toegevoegd/.test(x.detail)).length, 1, 'één contactpersoon (soort klant)');
    t.eq(rijen(klantregels, (x) => x.kind === 'klant' && /^Vraag gesteld/.test(x.detail)).length, 1, 'één vraag');
    /* de klanttijdlijn: dezelfde acties, alleen klantsoorten, geen interne regels */
    s.accessLog.push({ id: 'log-intern', projectId: 'prj-diffuser', actor: 'staff', assetKind: 'system', action: 'note', detail: 'INTERN: marge 40%', internal: true, createdAt: NU });
    const kl = tijdlijnKlant(s, 'prj-diffuser');
    t.true(kl.every((x) => !x.actie), 'klanttijdlijn: geen regel met intern actietype');
    t.false(kl.some((x) => x.detail.indexOf('INTERN') > -1), 'klanttijdlijn: een regel met internal: true wordt eruit gezeefd');
    t.false(kl.some((x) => x.kind === 'mail'), 'klanttijdlijn: geen mailregels');
    ['akkoord', 'samplekeuze', 'betaling', 'bezwaar', 'klantbestand'].forEach((kind) => {
      t.eq(rijen(kl, (x) => x.kind === kind && x.at === NU).length, 1, 'klanttijdlijn: precies één ' + kind + ' van vandaag');
    });
    t.true(rijen(kl, (x) => x.kind === 'klant' && /^Vraag gesteld: Wanneer/.test(x.detail)).length === 1, 'klanttijdlijn: de vraag van vandaag');
    const beheerAlles = tijdlijnBeheer(s, {});
    t.true(beheerAlles.length > kl.length, 'de beheer-tijdlijn ziet meer dan de klant (interne en andere klanten)');
  }

  /* ============================================================
     14. WEIGERINGEN — elke actie minstens één, altijd met NL zin
     ============================================================ */
  t.group('weigeringen: wie');
  {
    vers(null);
    await weigert(t, D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'production' }, 'Noor'), 'niet_ingelogd', 'akkoord zonder sessie');
    await weigert(t, D.downloadAlles(), 'niet_ingelogd', 'downloadAlles zonder sessie');
    await weigert(t, D.factuurPdf('inv-01'), 'niet_ingelogd', 'factuurPdf zonder sessie');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 1 }), 'niet_ingelogd', 'herbestellen zonder sessie');
    await weigert(t, D.taalKiezen('nl'), 'niet_ingelogd', 'taalKiezen zonder sessie');
    /* Fjell logt in en probeert het werk van Noor */
    vers('cli-fjell');
    await weigert(t, D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'production' }, 'Mats Berger'), 'fase_niet_gevonden', 'fase van een andere klant goedkeuren');
    await weigert(t, D.sampleBeoordelen('smp-p1', 'goedgekeurd', '', []), 'sample_niet_gevonden', 'sample van een andere klant beoordelen');
    await weigert(t, D.betalingMelden('inv-04', { cents: 100, datumISO: '2026-09-01' }), 'factuur_niet_gevonden', 'betaling melden op de factuur van een ander');
    await weigert(t, D.bezwaarMaken('inv-04', 'niet mijn factuur'), 'factuur_niet_gevonden', 'bezwaar op de factuur van een ander');
    await weigert(t, D.berichtSturen('q-06', 'hallo'), 'vraag_niet_gevonden', 'bericht in de draad van een ander');
    await weigert(t, D.vraagStellen('prj-diffuser', 'mag ik meekijken?'), 'project_niet_gevonden', 'vraag op het product van een ander');
    await weigert(t, D.bestandAanleveren('slot-04', { name: 'x.pdf', size: 10, type: 'application/pdf' }, ''), 'slot_niet_gevonden', 'bestand in het slot van een ander');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 10 }), 'project_niet_gevonden', 'herbestellen op het product van een ander');
    await weigert(t, D.contactpersoonOpslaan({ id: 'cc-01', name: 'Kaper' }), 'contact_niet_gevonden', 'de contactpersoon van een ander wijzigen');
    await weigert(t, D.contactpersoonVerwijderen('cc-01'), 'contact_niet_gevonden', 'de contactpersoon van een ander verwijderen');
    await weigert(t, D.factuurPdf('inv-01'), 'factuur_niet_gevonden', 'de factuur-pdf van een ander');
    await weigert(t, D.listClientPayments('inv-04'), 'factuur_niet_gevonden', 'de gemelde betalingen van een ander lezen');
    t.deep(await D.listMessages('q-06'), [], 'de draad van een ander is leeg, niet zichtbaar');
    t.deep(await D.listReorders('prj-geurflacon'), [], 'de herbestellingen van een ander zijn leeg');
    t.deep((await D.listContacts()).map((x) => x.id), ['cc-04', 'cc-03'], 'Fjell ziet alleen de eigen mensen (Erik, Ingrid)');
  }
  t.group('weigeringen: wachtstand');
  {
    vers();
    await weigert(t, D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'concept' }, 'Noor'), 'fase_niet_in_wachtstand', 'akkoord op een fase die al done is');
    await weigert(t, D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'logistics' }, 'Noor'), 'fase_niet_in_wachtstand', 'akkoord op een fase die nog upcoming is');
    await weigert(t, D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'bestaat-niet' }, 'Noor'), 'fase_niet_gevonden', 'akkoord op een fase die niet bestaat');
    await weigert(t, D.sampleBeoordelen('smp-t2', 'aanpassing', 'toch dof', []), 'sample_niet_in_wachtstand', 'beoordelen van een al goedgekeurde ronde');
    await weigert(t, D.sampleBeoordelen('smp-t0', 'goedgekeurd', '', []), 'sample_niet_in_wachtstand', 'beoordelen van een verdrongen ronde');
    await weigert(t, D.betalingMelden('inv-01', { cents: 100, datumISO: '2026-09-01' }), 'factuur_niet_open', 'betaling melden op een betaalde factuur');
    await weigert(t, D.bezwaarMaken('inv-01', 'te duur'), 'factuur_al_betaald', 'bezwaar op een betaalde factuur');
    await weigert(t, D.bezwaarMaken('inv-05', 'nog een keer'), 'factuur_al_betwist', 'bezwaar op een al betwiste factuur');
    await weigert(t, D.bestandAanleveren('slot-03', { name: 'x.pdf', size: 10, type: 'application/pdf' }, ''), 'slot_al_gevuld', 'bestand in een al gevuld slot');
    /* slot-01 (compliance) is leeg en verwacht, maar de seed zegt expectedFrom
       'staf': dat levert CUSTOM+ zelf, dus de klant mag er niets in zetten
       (doc_slots.expected_from in 0021, en dezelfde controle in de demo) */
    await weigert(t, D.bestandAanleveren('slot-01', { name: 'eigen-certificaat.pdf', size: 10, type: 'application/pdf' }, ''), 'slot_niet_van_klant', 'bestand in een slot dat de staf levert (expectedFrom staf)');
    t.eq(rij(opslag({ ls: globalThis.localStorage }).docSlots, (x) => x.id === 'slot-01').status, 'verwacht', 'slot-01 blijft leeg en verwacht');
    await weigert(t, D.herbestellen('prj-diffuser', { qty: 10 }), 'project_niet_afgerond', 'herbestellen op een lopend product');
    t.false(D.projectHerbestelbaar(rij(SEED.projects, (p) => p.id === 'prj-diffuser')), 'projectHerbestelbaar: het diffuservat is niet afgerond');
    t.true(D.projectHerbestelbaar(rij(SEED.projects, (p) => p.id === 'prj-geurflacon')), 'projectHerbestelbaar: de geurflacon wel (gearchiveerd)');
  }
  t.group('weigeringen: invoer');
  {
    vers();
    await weigert(t, D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'production' }, '   '), 'naam_ontbreekt', 'akkoord zonder naam');
    await weigert(t, D.sampleBeoordelen('smp-p1', 'misschien', '', []), 'beslissing_ongeldig', 'een beslissing die niet goedgekeurd of aanpassing is');
    await weigert(t, D.sampleBeoordelen('smp-p1', 'aanpassing', '   ', []), 'opmerking_ontbreekt', 'aanpassing zonder opmerking en zonder aanwijzing');
    await weigert(t, D.sampleBeoordelen('smp-p1', 'aanpassing', 'x', new Array(51).fill({ x: 0, y: 0 })), 'markeringen_ongeldig', 'meer dan vijftig aanwijzingen');
    await weigert(t, D.sampleBeoordelen('smp-p1', 'aanpassing', 'x', [1, 2]), 'markeringen_ongeldig', 'aanwijzingen die geen objecten zijn');
    await weigert(t, D.betalingMelden('inv-04', { cents: 0, datumISO: '2026-09-01' }), 'bedrag_ongeldig', 'bedrag nul');
    await weigert(t, D.betalingMelden('inv-04', { cents: -5, datumISO: '2026-09-01' }), 'bedrag_ongeldig', 'bedrag negatief');
    await weigert(t, D.betalingMelden('inv-04', { cents: 1875.5, datumISO: '2026-09-01' }), 'bedrag_ongeldig', 'bedrag niet een heel getal centen');
    await weigert(t, D.betalingMelden('inv-04', { cents: '187500', datumISO: '2026-09-15' }), 'datum_in_toekomst', 'betaaldatum in de toekomst');
    await weigert(t, D.betalingMelden('inv-04', { cents: 100 }), 'datum_ontbreekt', 'betaaldatum ontbreekt');
    await weigert(t, D.betalingMelden('inv-04', { cents: 100, datumISO: '2026-13-40' }), 'datum_ongeldig', 'betaaldatum onleesbaar');
    await weigert(t, D.betalingMelden('inv-04', { cents: 100, datumISO: '1999-12-31' }), 'datum_ongeldig', 'betaaldatum absurd oud');
    const morgen = D.dayISO(new Date(NU_MS + 86400000));
    const gisteren = D.dayISO(new Date(NU_MS - 86400000));
    const r = await D.betalingMelden('inv-04', { cents: 100, datumISO: morgen });
    t.eq(r.gemeldeBetaling.paidOn, morgen, 'één dag speling voor tijdzones, net als de server (current_date + 1)');
    await weigert(t, D.bezwaarMaken('inv-04', '   '), 'reden_ontbreekt', 'bezwaar zonder reden');
    await weigert(t, D.berichtSturen('q-06', '   '), 'bericht_leeg', 'leeg bericht');
    await weigert(t, D.berichtSturen('q-06', 'a'.repeat(4001)), 'bericht_te_lang', 'bericht van 4001 tekens');
    const rand = await D.berichtSturen('q-06', 'b'.repeat(4000));
    t.eq(rand.body.length, 4000, 'precies 4000 tekens mag');
    await weigert(t, D.vraagStellen('prj-diffuser', ''), 'bericht_leeg', 'lege vraag');
    await weigert(t, D.vraagStellen('prj-diffuser', 'c'.repeat(4001)), 'bericht_te_lang', 'vraag van 4001 tekens');
    await weigert(t, D.bestandAanleveren('slot-04', null, ''), 'bestand_ontbreekt', 'geen bestand gekozen');
    await weigert(t, D.bestandAanleveren('slot-04', { name: 'leeg.pdf', size: 0, type: 'application/pdf' }, ''), 'bestand_leeg', 'leeg bestand');
    await weigert(t, D.bestandAanleveren('slot-04', { name: 'groot.zip', size: D.UPLOAD_MAX_BYTES + 1, type: 'application/zip' }, ''), 'bestand_te_groot', 'bestand groter dan 25 MB');
    t.eq(D.UPLOAD_MAX_BYTES, 26214400, 'de grens is de 25 MB van de bucket in 0021');
    t.eq(rij(opslag({ ls: globalThis.localStorage }).docSlots, (x) => x.id === 'slot-04').status, 'verwacht', 'na de geweigerde uploads is slot-04 nog steeds leeg');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 0 }), 'aantal_ongeldig', 'aantal nul');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 2.5 }), 'aantal_ongeldig', 'aantal niet heel');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 10000001 }), 'aantal_ongeldig', 'meer dan tien miljoen stuks');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 10, gewenstOpISO: gisteren }), 'datum_in_verleden', 'gewenste datum in het verleden');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 10, gewenstOpISO: '2029-12-31' }), 'datum_te_ver', 'gewenste datum meer dan drie jaar vooruit');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 10, gewenstOpISO: 'binnenkort' }), 'invoer_ongeldig', 'gewenste datum onleesbaar');
    await weigert(t, D.herbestellen('prj-geurflacon', { qty: 10, zelfdeSpec: false, wijziging: '  ' }), 'wijziging_ontbreekt', 'met wijziging maar zonder beschrijving');
    await weigert(t, D.contactpersoonOpslaan({ name: '', email: 'x@y.nl' }), 'naam_ontbreekt', 'contactpersoon zonder naam');
    await weigert(t, D.contactpersoonOpslaan({ name: 'Kees', email: 'kees-zonder-apenstaart' }), 'email_ongeldig', 'contactpersoon met ongeldig mailadres');
    await weigert(t, D.contactpersoonOpslaan({ name: 'Kees', email: 'kees@x' }), 'email_ongeldig', 'mailadres zonder punt na de apenstaart (de regex van 0021)');
    await weigert(t, D.contactpersoonOpslaan({ name: 'Sanne 2', email: 'SANNE@ateliernoor.nl' }), 'contact_email_dubbel', 'hetzelfde mailadres nog een keer, hoofdletterongevoelig');
    await weigert(t, D.contactpersoonOpslaan({ name: 'Kees', mailCategories: ['spam'] }), 'categorie_onbekend', 'een mailcategorie die notifyClient niet kent');
    await weigert(t, D.contactpersoonVerwijderen(''), 'contact_niet_gevonden', 'verwijderen zonder id');
    await weigert(t, D.taalKiezen('xx'), 'taal_onbekend', 'een taal die het portaal niet kent');
    await weigert(t, D.taalKiezen(''), 'taal_onbekend', 'lege taal');
    t.deep(D.TALEN, ['nl', 'en', 'de', 'fr', 'es'], 'de vijf talen zijn exact die van clients_guard_prefs() in 0021');
    await weigert(t, D.meldingenOpslaan({ fase: true, nieuwsbrief: false }), 'categorie_onbekend', 'meldingsvoorkeur voor een onbekende categorie');
    await weigert(t, D.meldingenOpslaan(['fase']), 'voorkeuren_ongeldig', 'voorkeuren als lijst in plaats van map');
  }
  t.group('weigeringen: opslag en fouten');
  {
    D.init({ mode: 'demo', lezen: () => JSON.parse(JSON.stringify(SEED)), sessie: { clientId: 'cli-noor', contactName: 'Noor', company: 'Atelier Noor', email: 'noor@ateliernoor.nl' } });
    t.false(D.gekoppeld(), 'zonder schrijven-haak is de opslag niet gekoppeld');
    await weigert(t, D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'production' }, 'Noor'), 'opslag_niet_gekoppeld', 'schrijven zonder opslag');
    await weigert(t, D.taalKiezen('nl'), 'opslag_niet_gekoppeld', 'taal kiezen zonder opslag');
    /* berichtVoorFout op alles wat er van een server of het netwerk kan komen */
    t.eq(D.berichtVoorFout(null), D.FOUTCODES.onbekende_fout, 'null → de algemene zin');
    t.eq(D.berichtVoorFout('fase_niet_in_wachtstand'), D.FOUTCODES.fase_niet_in_wachtstand, 'een kale code als tekst → de zin');
    t.eq(D.berichtVoorFout(new Error('TypeError: x is undefined')), D.FOUTCODES.onbekende_fout, 'een technische fout → de algemene zin, nooit de Engelse tekst');
    t.eq(D.vertaalDbFout({ message: 'fase_niet_in_wachtstand', details: 'status: done' }).code, 'fase_niet_in_wachtstand', 'de raise exception van 0021 komt als code terug');
    t.eq(D.vertaalDbFout({ code: '42501', message: 'new row violates row-level security policy' }).code, 'geen_toegang', 'een RLS-weigering → geen_toegang');
    t.eq(D.vertaalDbFout({ code: '42501', message: 'row-level security' }, 'x', { bijPolicy: 'slot_al_gevuld' }).code, 'slot_al_gevuld', 'met de context van de actie → de passende code');
    t.eq(D.vertaalDbFout({ code: '23505', message: 'duplicate key' }, 'x', { bijDubbel: 'contact_email_dubbel' }).code, 'contact_email_dubbel', 'de unieke index van client_contacts → contact_email_dubbel');
    t.eq(D.vertaalDbFout({ code: 'PGRST301', message: 'JWT expired' }).code, 'niet_ingelogd', 'een verlopen JWT → niet_ingelogd');
    t.eq(D.vertaalDbFout({ message: 'Failed to fetch' }).code, 'geen_verbinding', 'geen netwerk → geen_verbinding');
    Object.keys(D.FOUTCODES).forEach((code) => {
      t.true(nlZin(D.FOUTCODES[code], code), 'FOUTCODES.' + code + ' is een Nederlandse hele zin');
    });
    /* elke code uit de lijst "DE FOUTCODES" onderaan 0021 heeft een zin */
    const sql = readFileSync(join(HERE, '..', 'supabase', 'portal', '0021_portaal_acties.sql'), 'utf8');
    const codes = new Set();
    (sql.match(/raise exception '([a-z_]+)'/g) || []).forEach((m) => codes.add(m.replace(/raise exception '|'/g, '')));
    codes.forEach((code) => {
      t.true(!!D.FOUTCODES[code], 'de foutcode ' + code + ' uit 0021 heeft een Nederlandse zin in FOUTCODES');
    });
  }
}

/* ============================================================
   15. DE KLOK TIKT — wat gebeurt er als twee klokaflezingen in één
   actie niet dezelfde milliseconde geven (in een browser een kans per
   actie; in Postgres onmogelijk, want now() is de transactietijd)
   ============================================================ */
async function tikkendeKlok(t) {
  t.group('klok tikt: de tweeling bij een akkoord');
  const Oud = globalThis.Date;
  globalThis.Date = maakKlok(NU_MS, 1);
  try {
    const w = vers();
    const r = await D.akkoordGeven({ projectId: 'prj-diffuser', stageKey: 'production' }, 'Noor van Dijk');
    const s = opslag(w);
    /* op de tekst van DEZE fase: de seed draagt al een approve-regel van Noor
       (log-p03, de toolingfase), en die is niet het akkoord van vandaag */
    const log = rij(s.accessLog, (x) => x.action === 'approve' && x.detail === 'Fase goedgekeurd door Noor van Dijk: ' + FASE.production);
    t.true(!!log, 'de logregel is er');
    t.eq(rijen(s.auditLog, (x) => x.detail === log.detail && x.createdAt === log.createdAt).length, 1, 'accessLog en auditLog delen wél één tijdstip (één moment in demoLog)');
    const rows = rijen(tijdlijnBeheer(s, { projectId: 'prj-diffuser' }), (x) => x.detail === log.detail);
    t.eq(r.approvedAt, log.createdAt,
      'akkoordGeven leest de klok één keer: approvedAt op de fase en createdAt van de logregel zijn hetzelfde tijdstip, ook als de klok per aflezing 1 ms tikt');
    t.eq(rows.length, 1,
      'en dus staat het akkoord één keer in de beheer-tijdlijn (mergeActivity ontdubbelt de tweeling op exact hetzelfde tijdstip, zoals now() live één transactietijd is)');

    /* en elke andere actie die een eigen stempel én een logregel schrijft */
    t.group('klok tikt: elke actie stempelt rij en logregel op één moment');
    const w2 = vers();
    const sm = await D.sampleBeoordelen('smp-p1', 'goedgekeurd', 'Prima zo.', []);
    let s2 = opslag(w2);
    let lg = rij(s2.accessLog, (x) => x.action === 'decide' && x.assetId === 'smp-p1');
    t.eq(sm.clientDecidedAt, lg && lg.createdAt, 'sampleBeoordelen: clientDecidedAt = createdAt van de logregel');
    const bt = await D.betalingMelden('inv-04', { cents: 100, datumISO: '2026-09-01' });
    s2 = opslag(w2);
    /* de laatste: de seed draagt al een gemelde betaling op inv-04 (log-p04) */
    lg = rijen(s2.accessLog, (x) => x.action === 'report_payment' && x.assetId === 'inv-04').pop() || null;
    t.eq(bt.gemeldeBetaling.createdAt, lg && lg.createdAt, 'betalingMelden: createdAt van de melding = createdAt van de logregel');
    t.true(!!rij(s2.invoiceAudit, (a) => a.event === 'betaling_gemeld' && a.invoiceId === 'inv-04' && a.createdAt === (lg && lg.createdAt)), 'betalingMelden: ook de factuurlogregel draagt dat ene moment');
    const bz = await D.bezwaarMaken('inv-04', 'Te hoog.');
    s2 = opslag(w2);
    lg = rij(s2.accessLog, (x) => x.action === 'dispute' && x.assetId === 'inv-04');
    t.eq(bz.updatedAt, lg && lg.createdAt, 'bezwaarMaken: updatedAt van de factuur = createdAt van de logregel');
    const up = await D.bestandAanleveren('slot-04', { name: 'x.pdf', size: 10, type: 'application/pdf' }, '');
    s2 = opslag(w2);
    lg = rij(s2.accessLog, (x) => x.action === 'upload' && x.assetId === up.id);
    t.eq(up.createdAt, lg && lg.createdAt, 'bestandAanleveren: createdAt van het document = createdAt van de logregel');
    const ro = await D.herbestellen('prj-geurflacon', { qty: 5 });
    s2 = opslag(w2);
    lg = rij(s2.accessLog, (x) => x.action === 'reorder' && x.assetId === ro.id);
    t.eq(ro.createdAt, lg && lg.createdAt, 'herbestellen: createdAt van de aanvraag = createdAt van de logregel');
  } finally {
    globalThis.Date = Oud;
  }
}

/* ============================================================
   16. RLS ALS AANVALLER — alleen met PGlite (zie afspraak 5)
   ============================================================ */
async function rlsAlsAanvaller(t) {
  t.group('RLS als aanvaller (PGlite)');
  const pad = process.env.CP_PGLITE || '';
  if (!pad) {
    console.log('       - RLS via PGlite OVERGESLAGEN: geen CP_PGLITE gezet (pad naar @electric-sql/pglite/dist/index.js). Er is dus NIET bewezen dat de policies weigeren.');
    return;
  }
  let mod = null;
  try { mod = await import(pad); } catch (e) {
    console.log('       - RLS via PGlite OVERGESLAGEN: ' + pad + ' laadt niet (' + (e && e.message) + ').');
    return;
  }
  const PGlite = mod.PGlite;
  const db = new PGlite();
  const q = (sql, params) => db.query(sql, params || []);
  const sqlExec = (sql) => db.exec(sql);
  /* een mislukking als waarde, zodat de test er een assertie van kan maken */
  async function faalt(sql, params) {
    try { await q(sql, params); return null; } catch (e) { return String(e && e.message || e); }
  }
  const SQLMAP = join(HERE, '..', 'supabase', 'portal');
  const MIGRATIES = ['0001_portal_schema.sql', '0002_shipments.sql', '0003_factory_city.sql', '0004_links.sql', '0005_admin.sql',
    '0006_facturen.sql', '0008_invoices.sql', '0009_nummerreeksen.sql', '0010_factuur_pdf.sql', '0011_factuurmail.sql',
    '0012_betalingen.sql', '0020_beheer_ia.sql', '0021_portaal_acties.sql'];

  /* de omgeving van Supabase nabootsen: het auth-schema, de drie rollen en
     de standaardrechten die Supabase op nieuwe tabellen en functies zet
     (daar leunen de oudere migraties zonder eigen grants op) */
  await sqlExec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text not null default '', raw_user_meta_data jsonb not null default '{}'::jsonb, last_sign_in_at timestamptz, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role', true), ''), 'anon') $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  let geladen = 0;
  for (const f of MIGRATIES) {
    const sql = readFileSync(join(SQLMAP, f), 'utf8');
    /* vlak vóór 0020: de voorcontrole van 0021 hoort dan nog te weigeren
       mét zijn eigen zin ("0021 kan nog niet draaien, dit ontbreekt: …") */
    if (f === '0020_beheer_ia.sql') {
      const sql21 = readFileSync(join(SQLMAP, '0021_portaal_acties.sql'), 'utf8');
      const van = sql21.indexOf('do $$');
      const tot = sql21.indexOf('end $$;', van) + 'end $$;'.length;
      const fout = (van > -1 && tot > van) ? await (async () => { try { await sqlExec(sql21.slice(van, tot)); return ''; } catch (e) { return String(e && e.message || e); } })() : 'voorcontrole niet gevonden';
      t.true(fout !== '', 'de voorcontrole van 0021 weigert zolang 0020 ontbreekt');
      t.true(/0021 kan nog niet draaien/.test(fout),
        'de voorcontrole van 0021 (blok 0) geeft zijn eigen foutzin (array_append in plaats van `||`, dat de tekst als array-literal las en met "malformed array literal" klapte) — gezien: ' + fout.slice(0, 80));
    }
    try { await sqlExec(sql); geladen++; }
    catch (e) { t.true(false, 'migratie ' + f + ' laadt in PGlite: ' + String(e && e.message).slice(0, 300)); }
  }
  t.eq(geladen, MIGRATIES.length, 'alle ' + MIGRATIES.length + ' migraties laden in PGlite');
  if (geladen !== MIGRATIES.length) return;

  /* de wereld: staf S, klant A (Noor) met een project in elke wachtstand,
     klant B (Fjell) met een eigen project, en één fabriek met interne rij */
  const S = '00000000-0000-4000-8000-00000000000a';
  const A = '00000000-0000-4000-8000-0000000000aa';
  const B = '00000000-0000-4000-8000-0000000000bb';
  await sqlExec(`
    insert into auth.users (id, email) values ('${S}', 'steffan@customplus.nl'), ('${A}', 'noor@ateliernoor.nl'), ('${B}', 'mats@fjelloutdoor.no');
    insert into staff_users (user_id) values ('${S}');
  `);
  const cA = (await q("insert into clients (auth_user_id, company, contact_name, email, notes) values ($1, 'Atelier Noor', 'Noor van Dijk', 'noor@ateliernoor.nl', 'GEHEIM') returning id", [A])).rows[0].id;
  const cB = (await q("insert into clients (auth_user_id, company, contact_name, email) values ($1, 'Fjell Outdoor', 'Mats Berger', 'mats@fjelloutdoor.no') returning id", [B])).rows[0].id;
  const pA = (await q("insert into projects (client_id, name, status) values ($1, 'Diffuservat', 'active') returning id", [cA])).rows[0].id;
  const pAklaar = (await q("insert into projects (client_id, name, status) values ($1, 'Geurflacon', 'archived') returning id", [cA])).rows[0].id;
  const pB = (await q("insert into projects (client_id, name, status) values ($1, 'Kookset', 'active') returning id", [cB])).rows[0].id;
  const pAklaar2 = (await q("insert into projects (client_id, name, status) values ($1, 'Kaars', 'archived') returning id", [cA])).rows[0].id;
  const stA = (await q("insert into project_stages (project_id, stage_key, position, status) values ($1, 'production', 5, 'awaiting_approval') returning id", [pA])).rows[0].id;
  const stAdone = (await q("insert into project_stages (project_id, stage_key, position, status) values ($1, 'concept', 1, 'done') returning id", [pA])).rows[0].id;
  /* een fase die nog komt, anders is het project na het akkoord "afgerond"
     en dus herbestelbaar */
  await q("insert into project_stages (project_id, stage_key, position, status) values ($1, 'logistics', 6, 'upcoming')", [pA]);
  const stB = (await q("insert into project_stages (project_id, stage_key, position, status) values ($1, 'concept', 1, 'awaiting_approval') returning id", [pB])).rows[0].id;
  const smA = (await q("insert into sample_rounds (project_id, round_label, status, round_date) values ($1, 'P1', 'reviewed', '2026-09-04') returning id", [pA])).rows[0].id;
  const invA = (await q("insert into invoices (project_id, stage_key, label, amount_cents, status, publish_status, status_code, doc_kind, total_incl_cents, invoice_number) values ($1, 'logistics', '15% — pre-shipment QC', 187500, 'open', 'published', 'sent', 'invoice', 187500, '2026-004') returning id", [pA])).rows[0].id;
  await q("insert into invoices (project_id, stage_key, label, amount_cents, status, publish_status, status_code, doc_kind, total_incl_cents, invoice_number) values ($1, 'concept', '25%', 100, 'open', 'published', 'sent', 'invoice', 100, '2026-005')", [pB]);
  /* expected_from 'klant' (0021): slots die de klant vult. De standaard is
     'staf', en zo'n slot mag een klant juist NIET vullen — slotStaf, verderop */
  const slotA = (await q("insert into doc_slots (project_id, doc_type, stage_key, status, expected_from) values ($1, 'other', 'logistics', 'verwacht', 'klant') returning id", [pA])).rows[0].id;
  const slotB = (await q("insert into doc_slots (project_id, doc_type, stage_key, status, expected_from) values ($1, 'other', 'concept', 'verwacht', 'klant') returning id", [pB])).rows[0].id;
  const slotStaf = (await q("insert into doc_slots (project_id, doc_type, stage_key, status) values ($1, 'compliance', 'logistics', 'verwacht') returning id, expected_from", [pA])).rows[0];
  t.eq(slotStaf.expected_from, 'staf', '0021: een slot zonder expected_from is er een dat de staf levert (standaard staf)');
  const qA = (await q("insert into question_threads (project_id, question, answer, answered_at) values ($1, 'Kan het naar Almere?', 'Ja.', now()) returning id", [pA])).rows[0].id;
  const fab = (await q("insert into factories_partners (name) values ('Fabriek Chen') returning id")).rows[0].id;
  await q("insert into factory_private (factory_id, notes) values ($1, 'GEHEIM: marge 40%')", [fab]);

  /* als wie draaien we: klant A, klant B, anon (geen login) of staf */
  async function als(wie) {
    await sqlExec('reset role');
    if (wie === 'anon') {
      await q("select set_config('test.uid', '', false), set_config('test.role', 'anon', false)");
      await sqlExec('set role anon');
      return;
    }
    const uid = wie === 'A' ? A : (wie === 'B' ? B : S);
    await q("select set_config('test.uid', $1, false), set_config('test.role', 'authenticated', false)", [uid]);
    await sqlExec('set role authenticated');
  }
  const bevat = (msg, code) => !!msg && msg.indexOf(code) > -1;

  /* ---- de vijf RPC's: B op A's rijen, anon, en A zelf ---- */
  await als('B');
  t.true(bevat(await faalt('select approve_stage($1, $2)', [stA, 'Mats']), 'fase_niet_gevonden'), 'RLS: klant B kan de fase van klant A niet goedkeuren (fase_niet_gevonden, verraadt niets)');
  t.true(bevat(await faalt('select decide_sample($1, $2, $3, $4)', [smA, 'goedgekeurd', '', '[]']), 'sample_niet_gevonden'), 'RLS: klant B kan het sample van A niet beoordelen');
  t.true(bevat(await faalt('select report_payment($1, $2, $3, $4)', [invA, 100, '2026-09-01', '']), 'factuur_niet_gevonden'), 'RLS: klant B kan geen betaling melden op de factuur van A');
  t.true(bevat(await faalt('select dispute_invoice($1, $2)', [invA, 'niet van mij']), 'factuur_niet_gevonden'), 'RLS: klant B kan geen bezwaar maken op de factuur van A');
  t.true(bevat(await faalt('select request_reorder($1, $2, $3, $4, $5)', [pAklaar, 10, null, true, '']), 'project_niet_gevonden'), 'RLS: klant B kan niet herbestellen op het product van A');
  t.true(bevat(await faalt('select client_payment_reports($1)', [invA]), 'factuur_niet_gevonden'), 'RLS: klant B kan de gemelde betalingen van A niet lezen');
  t.true(bevat(await faalt('select verify_payment_report($1)', [stA]), 'alleen_beheer'), 'RLS: een klant kan geen betaling bevestigen (alleen_beheer)');

  await als('anon');
  const anonFout = await faalt('select approve_stage($1, $2)', [stA, 'Anon']);
  t.true(bevat(anonFout, 'permission denied') || bevat(anonFout, 'niet_ingelogd'), 'RLS: zonder login is approve_stage niet eens uitvoerbaar (execute ingetrokken voor anon) — ' + String(anonFout).slice(0, 60));
  t.eq((await q('select count(*)::int as n from projects')).rows[0].n, 0, 'RLS: anon ziet geen enkel project');

  await als('A');
  t.true(bevat(await faalt('select approve_stage($1, $2)', [stAdone, 'Noor']), 'fase_niet_in_wachtstand'), 'RLS: klant A op een eigen fase die al done is → fase_niet_in_wachtstand');
  t.true(bevat(await faalt('select approve_stage($1, $2)', [stA, '  ']), 'naam_ontbreekt'), 'RLS: zonder naam → naam_ontbreekt');
  const akk = (await q('select approve_stage($1, $2) as r', [stA, 'Noor van Dijk'])).rows[0].r;
  t.eq(akk.status, 'done', 'RLS: klant A keurt de eigen wachtende fase goed');
  t.eq(akk.approved_via, 'portaal', 'RLS: approved_via portaal');
  t.true(bevat(await faalt('select approve_stage($1, $2)', [stA, 'Noor']), 'fase_niet_in_wachtstand'), 'RLS: een tweede keer → fase_niet_in_wachtstand');
  const dec = (await q('select decide_sample($1, $2, $3, $4) as r', [smA, 'aanpassing', 'Deksel te laag.', '[{"x":0.5,"y":0.6}]'])).rows[0].r;
  t.eq(dec.client_decision, 'aanpassing', 'RLS: klant A beoordeelt het eigen sample');
  t.true(bevat(await faalt('select decide_sample($1, $2, $3, $4)', [smA, 'goedgekeurd', '', '[]']), 'sample_al_beoordeeld'), 'RLS: een tweede beslissing → sample_al_beoordeeld');
  t.true(bevat(await faalt('select report_payment($1, $2, $3, $4)', [invA, 0, '2026-09-01', '']), 'bedrag_ongeldig'), 'RLS: bedrag nul → bedrag_ongeldig');
  t.true(bevat(await faalt('select report_payment($1, $2, $3, $4)', [invA, 100, '2099-01-01', '']), 'datum_in_toekomst'), 'RLS: datum in de toekomst → datum_in_toekomst');
  const pay = (await q('select report_payment($1, $2, $3, $4) as r', [invA, 100000, '2026-09-07', 'deelbetaling'])).rows[0].r;
  t.eq(pay.gemelde_betaling.reported_by_client, true, 'RLS: klant A meldt een betaling op de eigen factuur');
  t.eq(pay.gemelde_betaling.verified_at, null, 'RLS: nog niet bevestigd');
  t.false(Object.prototype.hasOwnProperty.call(pay, 'internal_note'), 'RLS: internal_note zit niet in het antwoord');
  t.true(bevat(await faalt('select report_payment($1, $2, $3, $4)', [invA, 100000, '2026-09-07', '']), 'betaling_al_gemeld'), 'RLS: dezelfde melding nog eens → betaling_al_gemeld');
  t.true(bevat(await faalt('select dispute_invoice($1, $2)', [invA, '  ']), 'reden_ontbreekt'), 'RLS: bezwaar zonder reden → reden_ontbreekt');
  const disp = (await q('select dispute_invoice($1, $2) as r', [invA, 'Eerst overleg.'])).rows[0].r;
  t.eq(disp.status_code, 'disputed', 'RLS: klant A maakt bezwaar op de eigen factuur');
  t.true(bevat(await faalt('select dispute_invoice($1, $2)', [invA, 'nog eens']), 'factuur_al_betwist'), 'RLS: nog eens → factuur_al_betwist');
  t.true(bevat(await faalt('select request_reorder($1, $2, $3, $4, $5)', [pA, 10, null, true, '']), 'project_niet_afgerond'), 'RLS: herbestellen op een lopend product → project_niet_afgerond');
  t.true(bevat(await faalt('select request_reorder($1, $2, $3, $4, $5)', [pAklaar, 10, null, false, '']), 'wijziging_ontbreekt'), 'RLS: met wijziging zonder tekst → wijziging_ontbreekt');
  const ro = (await q('select request_reorder($1, $2, $3, $4, $5) as r', [pAklaar, 2000, '2026-12-01', true, ''])).rows[0].r;
  t.eq(ro.status, 'aanvraag', 'RLS: klant A herbestelt op het afgeronde product');
  t.true(bevat(await faalt('select request_reorder($1, $2, $3, $4, $5)', [pAklaar, 10, null, true, '']), 'herbestelling_loopt_al'), 'RLS: een tweede aanvraag → herbestelling_loopt_al (guard-trigger)');

  /* ---- rechtstreeks op de tabellen: wat een klant NIET mag ---- */
  await als('A');
  const upd = await q("update project_stages set status = 'done' where id = $1", [stB]);
  t.eq(upd.affectedRows || 0, 0, 'RLS: een rechtstreekse update op project_stages door een klant raakt nul rijen (geen update-policy)');
  const updEigen = await q("update project_stages set status = 'current' where project_id = $1", [pA]);
  t.eq(updEigen.affectedRows || 0, 0, 'RLS: ook op de EIGEN fasen raakt een klant nul rijen');
  t.true(bevat(await faalt("insert into project_stages (project_id, stage_key, position, status) values ($1, 'dfm', 2, 'done')", [pA]), 'row-level security'), 'RLS: een rechtstreekse insert in project_stages wordt geweigerd');
  t.true(bevat(await faalt("insert into invoice_payments (invoice_id, paid_on, amount_cents, currency, reported_by_client, verified_at) values ($1, '2026-09-01', 187500, 'EUR', true, now())", [invA]), 'row-level security'), 'RLS: een klant kan geen (bevestigde!) betaling rechtstreeks inboeken');
  const updInv = await q("update invoices set status_code = 'paid', paid_cents = 187500 where id = $1", [invA]);
  t.eq(updInv.affectedRows || 0, 0, 'RLS: een klant kan de eigen factuur niet op betaald zetten');
  t.eq((await q('select count(*)::int as n from invoice_payments')).rows[0].n, 0, 'RLS: invoice_payments is voor de klant onleesbaar (0012: staff-only), ook de eigen melding');
  t.true(bevat(await faalt("insert into admin_audit_log (kind, detail) values ('klant', 'Fase goedgekeurd door Noor: nep')"), 'row-level security'), 'RLS: een klant kan geen auditregel schrijven die zich als klantactie voordoet');
  t.eq((await q('select count(*)::int as n from admin_audit_log')).rows[0].n, 0, 'RLS: het staflogboek is voor de klant onleesbaar');
  t.true(bevat(await faalt("select portaal_log($1, 'client', 'approve', 'stage', null, 'nep')", [pA]), 'permission denied'), 'RLS: portaal_log() is voor de klant niet uitvoerbaar');
  t.true(bevat(await faalt("insert into question_messages (question_id, author, body) values ($1, 'staff', 'Ik ben Steffan')", [qA]), 'row-level security'), 'RLS: een klant kan geen bericht als staff plaatsen');
  t.true(bevat(await faalt("insert into question_messages (question_id, author, author_name, body) values ($1, 'client', 'Steffan Bakker', 'hoi')", [qA]), 'row-level security'), 'RLS: en niet onder een andere naam');
  t.true(bevat(await faalt("insert into question_messages (question_id, author, body, created_at) values ($1, 'client', 'oud', now() - interval '1 day')", [qA]), 'row-level security'), 'RLS: en niet met een verzonnen tijdstempel');
  await q("insert into question_messages (question_id, author, author_name, body) values ($1, 'client', 'Noor van Dijk', 'Adres volgt.')", [qA]);
  t.eq((await q('select count(*)::int as n from question_messages where question_id = $1', [qA])).rows[0].n, 1, 'RLS: het eigen bericht in de eigen draad mag');
  t.true(bevat(await faalt("insert into client_contacts (client_id, name, email) values ($1, 'Kaper', 'kaper@x.nl')", [cB]), 'row-level security'), 'RLS: een klant kan geen contactpersoon bij een andere klant zetten');
  await q("insert into client_contacts (client_id, name, email) values ($1, 'Pieter Bakker', 'pieter@ateliernoor.nl')", [cA]);
  t.true(bevat(await faalt("insert into client_contacts (client_id, name, email) values ($1, 'Pieter 2', 'PIETER@ateliernoor.nl')", [cA]), 'client_contacts_email_uniq'), 'RLS: hetzelfde mailadres nog eens → de unieke index');
  const updCl = await q("update clients set company = 'Kaper BV' where id = $1", [cB]);
  t.eq(updCl.affectedRows || 0, 0, 'RLS: de klantrij van een ander is niet te wijzigen');
  t.true(bevat(await faalt("update clients set company = 'Nieuw' where id = $1", [cA]), 'alleen_voorkeuren_wijzigbaar'), 'RLS: op de eigen rij mag alleen de voorkeur wijzigen (alleen_voorkeuren_wijzigbaar)');
  t.true(bevat(await faalt("update clients set portal_lang = 'xx' where id = $1", [cA]), 'taal_onbekend'), 'RLS: een onbekende taal → taal_onbekend');
  await q("update clients set portal_lang = 'en', mail_prefs = '{\"factuur\": false}' where id = $1", [cA]);
  t.eq((await q('select portal_lang from clients where id = $1', [cA])).rows[0].portal_lang, 'en', 'RLS: de eigen voorkeur wijzigen mag');
  t.true(bevat(await faalt("insert into reorder_requests (project_id, client_id, qty, status) values ($1, $2, 5, 'aanvraag')", [pA, cA]), 'row-level security'), 'RLS: een rechtstreekse herbestelling op een lopend product wordt door de policy geweigerd');
  /* op een afgerond product ZONDER lopende aanvraag, anders vuurt de
     guard-trigger (before insert) eerder dan de policy */
  t.true(bevat(await faalt("insert into reorder_requests (project_id, client_id, qty, status) values ($1, $2, 5, 'offerte')", [pAklaar2, cA]), 'row-level security'), 'RLS: en een klant kan nooit op stap offerte beginnen');
  t.true(bevat(await faalt("insert into documents (project_id, stage_key, doc_type, title, storage_path, uploaded_by, slot_id) values ($1, 'concept', 'other', 'kaap.pdf', $3, 'klant', $2)", [pB, slotB, pB + '/x.pdf']), 'row-level security'), 'RLS: een bestand in het slot van een ander wordt geweigerd');
  t.true(bevat(await faalt("insert into documents (project_id, stage_key, doc_type, title, storage_path, uploaded_by) values ($1, 'logistics', 'other', 'los.pdf', $2, 'staf')", [pA, pA + '/y.pdf']), 'row-level security'), 'RLS: een klant kan zich niet als staf voordoen en geen document buiten een slot zetten');
  t.true(bevat(await faalt("insert into documents (project_id, stage_key, doc_type, title, storage_path, uploaded_by, slot_id) values ($1, 'logistics', 'other', 'elders.pdf', $3, 'klant', $2)", [pA, slotA, pB + '/elders.pdf']), 'row-level security'), 'RLS: een pad in de map van een ander project wordt geweigerd (klant_upload_project_id)');
  t.true(bevat(await faalt("insert into documents (project_id, stage_key, doc_type, title, storage_path, uploaded_by, slot_id) values ($1, 'logistics', 'compliance', 'eigen-certificaat.pdf', $3, 'klant', $2)", [pA, slotStaf.id, pA + '/cert.pdf']), 'row-level security'), 'RLS: een eigen slot dat de STAF levert (expected_from staf, de standaard) kan de klant niet vullen');
  const docA = (await q("insert into documents (project_id, stage_key, doc_type, title, storage_path, uploaded_by, slot_id, client_note) values ($1, 'logistics', 'other', 'adres.pdf', $3, 'klant', $2, 'Venster 8-16') returning id", [pA, slotA, pA + '/adres.pdf'])).rows[0].id;
  t.eq((await q('select status, document_id from doc_slots where id = $1', [slotA])).rows[0].status, 'gevuld', 'RLS: het eigen slot vullen mag; de trigger zet het slot op gevuld');
  t.true(bevat(await faalt("insert into documents (project_id, stage_key, doc_type, title, storage_path, uploaded_by, slot_id) values ($1, 'logistics', 'other', 'twee.pdf', $3, 'klant', $2)", [pA, slotA, pA + '/twee.pdf']), 'row-level security'), 'RLS: een tweede bestand in het gevulde slot wordt geweigerd');
  const updDoc = await q("update documents set title = 'gewijzigd' where id = $1", [docA]);
  t.eq(updDoc.affectedRows || 0, 0, 'RLS: een klant kan zijn eigen upload niet meer wijzigen');
  t.eq((await q('select count(*)::int as n from factory_private')).rows[0].n, 0, 'RLS: factory_private is voor een klant leeg (staff only)');
  t.eq((await q('select count(*)::int as n from factories_partners')).rows[0].n, 1, 'RLS: de fabriek zelf is wél zichtbaar (namen zijn generiek)');
  t.eq((await q("select count(*)::int as n from access_log where project_id = $1", [pA])).rows[0].n, 5, 'RLS: klant A leest de eigen vijf klantregels in access_log (akkoord, sample, betaling, bezwaar, upload) — de herbestelling hangt aan het andere project');
  t.eq((await q('select count(*)::int as n from access_log where project_id = $1', [pB])).rows[0].n, 0, 'RLS: en niets van klant B');
  t.eq((await q('select count(*)::int as n from clients')).rows[0].n, 1, 'RLS: klant A ziet alleen de eigen klantrij');
  t.eq((await q("select count(*)::int as n from clients where notes = 'GEHEIM'")).rows[0].n, 1, 'RLS-grens: Postgres kent geen leesrecht per kolom, dus notes is leesbaar zodra de rij dat is — de datalaag selecteert de kolom daarom nooit (KLANT_KOLOMMEN)');

  await als('B');
  t.eq((await q('select count(*)::int as n from client_contacts')).rows[0].n, 0, 'RLS: klant B ziet de contactpersonen van A niet');
  t.eq((await q('select count(*)::int as n from reorder_requests')).rows[0].n, 0, 'RLS: klant B ziet de herbestellingen van A niet');
  t.eq((await q('select count(*)::int as n from doc_slots')).rows[0].n, 1, 'RLS: klant B ziet alleen het eigen slot');
  const delCc = await q('delete from client_contacts where client_id = $1', [cA]);
  t.eq(delCc.affectedRows || 0, 0, 'RLS: klant B kan de contactpersonen van A niet verwijderen');

  await als('S');
  t.eq((await q('select count(*)::int as n from admin_audit_log where kind = $1', ['klant'])).rows[0].n, 7, 'staf: zeven klantregels in het staflogboek (akkoord, sample, betaling, bezwaar, herbestelling, contactpersoon, upload)');
  t.eq((await q('select count(*)::int as n from invoice_payments where reported_by_client and verified_at is null')).rows[0].n, 1, 'staf: één onbevestigde klantmelding');
  t.eq((await q('select paid_cents, status_code from invoices where id = $1', [invA])).rows[0].paid_cents, 0, 'staf: de melding telt NIET mee in het saldo (blok 7 van 0021)');
  const ver = (await q('select verify_payment_report($1) as r', [pay.gemelde_betaling.id])).rows[0].r;
  t.true(!!ver.verified_at, 'staf: verify_payment_report bevestigt de melding');
  t.eq((await q('select paid_cents from invoices where id = $1', [invA])).rows[0].paid_cents, 100000, 'staf: na bevestiging telt het bedrag wél mee');

  /* A/B: live schrijft woordelijk de demotekst (portaal_geld_nl en
     portaal_datum_nl tegen geldTekst/dagNL van portaal-data.js) */
  t.eq((await q("select detail from access_log where action = 'report_payment' and project_id = $1", [pA])).rows[0].detail,
    'Betaling gemeld op factuur 2026-004: € 1.000,00 op 7 sep 2026, kenmerk deelbetaling', 'staf: de logregel van report_payment is woordelijk die van de demo (geldTekst/dagNL), geen "centen" en geen DD-MM-YYYY');
  t.eq((await q("select detail from invoice_audit where event = 'betaling_gemeld' and invoice_id = $1", [invA])).rows[0].detail,
    'Klant meldt betaling van € 1.000,00 op 7 sep 2026, kenmerk deelbetaling', 'staf: ook het factuurlogboek zegt het in de demovorm');
  t.eq((await q("select detail from access_log where action = 'reorder' and project_id = $1", [pAklaar])).rows[0].detail,
    'Herbestelling aangevraagd: 2000 stuks, gewenst op 1 dec 2026, zelfde specificatie', 'staf: de logregel van een herbestelling is woordelijk die van de demo (zelfde zin als in groep 8)');
  /* de twee tekst-helpers van 0021 tegen de vorm van CP_MODEL.formatCents
     (niet geëxporteerd; admin-model.test.mjs pint dezelfde teksten op de
     Inbox-titels: "€ 1.875,00", "$ 123,45") */
  t.eq((await q("select portaal_geld_nl(187500, 'EUR') as t")).rows[0].t, '€ 1.875,00', 'portaal_geld_nl: € 1.875,00, woordelijk CP_MODEL.formatCents');
  t.eq((await q("select portaal_geld_nl(12345, 'USD') as t")).rows[0].t, '$ 123,45', 'portaal_geld_nl: het dollarteken zoals formatCents');
  t.eq((await q("select portaal_geld_nl(250, 'CHF') as t")).rows[0].t, 'CHF 2,50', 'portaal_geld_nl: een munt zonder symbool krijgt de code');
  t.eq((await q("select portaal_geld_nl(-100, 'EUR') as t")).rows[0].t, '-€ 1,00', 'portaal_geld_nl: negatief met het minteken ervoor');
  t.eq((await q("select portaal_geld_nl(123456789, 'EUR') as t")).rows[0].t, '€ 1.234.567,89', 'portaal_geld_nl: meerdere duizendtalpunten');
  t.eq((await q("select portaal_geld_nl(5, null) as t")).rows[0].t, '€ 0,05', 'portaal_geld_nl: zonder munt is het euro, met voorloopnul in de centen');
  t.eq((await q("select portaal_datum_nl(date '2026-09-03') as t")).rows[0].t, '3 sep 2026', 'portaal_datum_nl: 3 sep 2026, zoals dagNL in portaal-data.js');
  t.eq((await q("select portaal_datum_nl(date '2026-03-12') as t")).rows[0].t, '12 mrt 2026', 'portaal_datum_nl: Nederlandse maandafkorting mrt');
  /* D: de klanttypes uit KLANT_DOC_TYPES zijn sinds 0021 geldige slottypes */
  t.eq((await q("insert into doc_slots (project_id, doc_type, stage_key, status, expected_from) values ($1, 'artwork', 'sourcing', 'verwacht', 'klant') returning doc_type", [pA])).rows[0].doc_type, 'artwork', 'staf: doc_type artwork (de demoseed) is sinds 0021 een geldig slottype — de check uit 0005 is verruimd');
  t.true(bevat(await faalt("insert into doc_slots (project_id, doc_type, stage_key, status) values ($1, 'onzin', 'sourcing', 'verwacht')", [pA]), 'doc_slots_doc_type_check'), 'staf: een onbekend type wordt nog steeds door dezelfde check geweigerd');
  await sqlExec('reset role');
  await db.close();
}
