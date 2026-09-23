/* build-chat-index.mjs — bouwt chat/index.json: de kennisbank van de sitechat.
 *
 * WAAROM DIT BESTAAT
 * De sitechat (netlify/functions/site-chat.mjs) mag uitsluitend antwoorden uit
 * wat er werkelijk op de site staat. Daarvoor heeft hij een doorzoekbare
 * versie van alle sitecontent nodig: geen HTML, maar losse stukken tekst van
 * 80 tot 250 woorden met de route waar dat stuk op de site te lezen is. Die
 * stukken bouwt dit script uit dezelfde JSON-bestanden waar de site zelf uit
 * wordt opgebouwd, dus er kan nooit iets in de chat staan dat niet ook op de
 * site staat.
 *
 * WELKE BESTANDEN DE WAARHEID ZIJN
 *   content/*.json        de Engelse bron (de tekst die de eigenaar in het CMS
 *                         bewerkt)
 *   content/nl/*.json     de Nederlandse versie, door scripts/build-site.mjs
 *                         gegenereerd uit de bron plus het vertaalwoordenboek
 *                         in custom-plus.html. Bestaat de map (nog) niet, dan
 *                         wordt alleen Engels geïndexeerd en zegt het script
 *                         dat.
 *   content/blog/*.json   de blogartikelen; die hebben één taal per artikel
 *                         (veld "lang"), vandaag allemaal Nederlands.
 *
 * Deterministisch: dezelfde invoer geeft byte voor byte dezelfde uitvoer
 * (vaste volgorde, geen datum, geen netwerk). Daardoor is het bestand
 * vergelijkbaar tussen twee builds en testbaar zonder omgeving.
 *
 * Draaien:  node scripts/build-chat-index.mjs
 * In de build: ná build-site.mjs, want die maakt content/nl/.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = join(HERE, '..');

/* Grenzen in woorden. De chat stuurt de vijf beste stukken naar het model;
 * onder de 80 woorden zegt een stuk te weinig om een vraag te beantwoorden,
 * boven de 250 verdringt één stuk de andere vier uit het contextvenster. */
export const MIN_WORDS = 80;
export const MAX_WORDS = 250;

/* De routes zoals scripts/build-site.mjs ze bouwt. Een stuk mag alleen naar
 * een pad wijzen dat ook echt bestaat; de test controleert dat. */
export const ROUTE_PATHS = ['/', '/diensten', '/ecommerce', '/relatiegeschenken', '/waarom-china',
  '/faq', '/over-ons', '/begrippen', '/hulpmiddelen', '/contact', '/blog', '/zoeken', '/privacy'];

/* ------------------------------------------------------------ hulpfuncties */

export function wordCount(text) {
  const t = String(text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

function readJson(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

/* Plain tekst uit een CMS-veld: markdown-vet (**x**) en dubbele spaties eruit,
 * placeholders zoals {n} blijven staan (die zeggen zelf wat ze zijn). */
function clean(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/\*\*/g, '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/* Meerdere velden achter elkaar tot één alinea, lege velden overgeslagen. */
function para(...parts) {
  return parts.map(clean).filter(Boolean).join(' ');
}

/* Zinnen splitsen voor stukken die te lang zijn. Geen taalkundige precisie
 * nodig: een punt, vraagteken of uitroepteken gevolgd door witruimte en een
 * hoofdletter of cijfer is goed genoeg om nooit midden in een zin te knippen. */
function sentences(text) {
  return String(text).split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9"'(])/).map((s) => s.trim()).filter(Boolean);
}

/* ------------------------------------------------------------- verzamelaars
 *
 * Elke verzamelaar zet één contentbestand om in een lijst secties
 * { titel, url, tekst } in leesvolgorde. De titel is wat het model straks
 * noemt als "Lees meer: …", dus die is een leesbare naam, geen sleutel. */

const L = (lang, nl, en) => (lang === 'nl' ? nl : en);

function collectHome(d, lang) {
  const out = [];
  const h = d.hero || {};
  out.push({ titel: L(lang, 'Home: wat CUSTOM+ doet', 'Home: what CUSTOM+ does'), url: '/',
    tekst: para(h.headline, h.subhead, d.pulseLabel, d.metaDescription) });
  const w = d.who || {};
  const rows = (arr) => (Array.isArray(arr) ? arr.map((r) => para(r.title + ':', r.desc)).join(' ') : '');
  out.push({ titel: L(lang, 'Home: voor wie wij bouwen', 'Home: who we build for'), url: '/',
    tekst: para(w.kicker, w.heading, w.lead, w.col1Heading + ':', rows(w.col1Rows), w.col2Heading + ':', rows(w.col2Rows)) });
  const y = d.why || {};
  out.push({ titel: L(lang, 'Home: waarom China', 'Home: why China'), url: '/',
    tekst: para(y.kicker, y.heading, y.lead) });
  const c = d.collab || {};
  const cta = d.cta || {};
  const cb = d.callBooking || {};
  out.push({ titel: L(lang, 'Home: open netwerk en gesprek plannen', 'Home: open network and booking a call'), url: '/',
    tekst: para(c.label, c.heading, c.body, c.cta, cta.headingMain, cta.headingSub, cb.kicker, cb.heading, cb.body) });
  return out;
}

function collectGlobal(d, lang) {
  const out = [];
  const st = d.scopeTeaser || {};
  const f = d.footer || {};
  const cb = d.callBooking || {};
  out.push({ titel: L(lang, 'Site: scopecheck, field notes en gesprek plannen', 'Site: scope check, field notes and booking a call'), url: '/',
    tekst: para(st.body, st.cta, f.newsletterKicker, f.newsletterHeading, f.newsletterLead, f.brandTagline, cb.subtitle, cb.notReadyBody) });
  return out;
}

function collectServices(d, lang) {
  const out = [];
  const ph = d.pagehead || {};
  out.push({ titel: L(lang, 'Diensten: zes disciplines', 'Services: six disciplines'), url: '/diensten',
    tekst: para(ph.kicker, ph.headingMain, ph.headingSub, d.intro && d.intro.lead) });
  const sl = d.samplingLoop || {};
  out.push({ titel: L(lang, 'Diensten: de samplelus', 'Services: the sampling loop'), url: '/diensten',
    tekst: para(sl.kicker, sl.heading, sl.lead) });
  const tl = d.timeline || {};
  const pl = d.planner || {};
  out.push({ titel: L(lang, 'Diensten: doorlooptijd en planner', 'Services: timeline and planner'), url: '/diensten#fl-planner',
    tekst: para(tl.kicker, tl.heading, tl.lead, pl.kicker, pl.heading, pl.lead) });
  (Array.isArray(d.steps) ? d.steps : []).forEach((s, i) => {
    const caps = Array.isArray(s.caps) ? s.caps.join('. ') + '.' : '';
    out.push({
      titel: L(lang, 'Diensten stap ' + (i + 1) + ': ', 'Services step ' + (i + 1) + ': ') + clean(s.title),
      url: '/diensten#stap-' + (i + 1),
      tekst: para(s.title + (s.dur ? ' (' + L(lang, 'doorlooptijd ', 'duration ') + s.dur + ').' : '.'), s.short, s.desc, caps)
    });
  });
  const pg = d.paygate || {};
  const gates = (Array.isArray(d.paygates) ? d.paygates : []).map((g) => para(g.pct, g.label + ':', g.title, g.body)).join(' ');
  out.push({ titel: L(lang, 'Diensten: betaalmomenten', 'Services: payment gates'), url: '/diensten#fl-paygate',
    tekst: para(pg.kicker, pg.heading, pg.lead, gates) });
  return out;
}

function collectEcommerce(d, lang) {
  /* De pagina is herbouwd als reis in zes hoofdstukken (ecommerce.journey.*);
   * de oude sleutels pagehead/twoWays/pipeline/trust/cta bestaan niet meer.
   * De termen DFM, NNN, AQL en de certificaten staan letterlijk in de markup
   * (geen contentsleutel) en worden hier op dezelfde plek ingevoegd. */
  const out = [];
  const j = d.journey || {};
  const c1 = j.c1 || {}, hero = j.hero || {}, ro = j.routes || {}, c2 = j.c2 || {}, band = j.band || {}, c4 = j.c4 || {}, cost = j.cost || {}, c5 = j.c5 || {};
  const mi = j.miles || {}, sl = j.slot || {}, st = d.statement || {};
  const zin = (...p) => p.map(clean).filter(Boolean).join('');
  const lijst = (...p) => p.map(clean).filter(Boolean).join(', ');
  out.push({ titel: L(lang, 'Ecommerce: eigen product voor je webshop, twee routes', 'Ecommerce: your own product for your web store, two routes'), url: '/ecommerce',
    tekst: para(c1.kicker, c1.h1 && c1.h1 + '.', c1.sub, hero.lead, hero.note, ro.h2, ro.intro,
      c2.wlName && c2.wlName + ' (' + clean(ro.wlTime) + '): ' + lijst(ro.wlMold, ro.wlUnique, ro.wlChoose, ro.wlStep) + '.',
      c2.devName && c2.devName + ' (' + clean(ro.devTime) + '): ' + lijst(ro.devMold, ro.devUnique, ro.devChoose, ro.devStep) + '.',
      c2.honest) });
  out.push({ titel: L(lang, 'Ecommerce: productcheck, sectorcheck, fasen, mijlpalen en steekproef', 'Ecommerce: product check, sector check, stages, milestones and sample check'), url: '/ecommerce#ec-c3',
    tekst: para(st.aiTitle && st.aiTitle + ':', st.aiIntro, st.aiNote, c2.aiNote1, c2.aiNote2Rest && 'MOQ ' + c2.aiNote2Rest, c2.scopeLink,
      band.h2, band.lead, c4.milesLabel && c4.milesLabel + ': ' + lijst(mi.m1, mi.m2, mi.m3, mi.m4) + '.', band.milesNote,
      band.sampleH3, zin(c5.body1, ' AQL ', c5.body2), c5.iqc && 'IQC: ' + c5.iqc + '.', c5.ipqc && 'IPQC: ' + c5.ipqc + '.', c5.fqc && 'FQC: ' + c5.fqc + '.', c5.reportNote) });
  out.push({ titel: L(lang, 'Ecommerce: eerlijk over kosten, de mal en het slot', 'Ecommerce: honest about cost, the mold and the closing'), url: '/ecommerce#ec-c5',
    tekst: para(cost.kicker && cost.kicker + '.', c4.h2 && c4.h2 + '.', zin(c4.bodyDev1, ' ', c4.termGolden, ' ', c4.bodyDev2, ' ', c4.termTooling, ' ', c4.bodyDev3), c4.bodyWl,
      c4.doubleLabel, c4.doubleNote1, [cost.t1, sl.fact3, cost.t3].map(clean).filter(Boolean).join('. ') + '.',
      sl.h2 && sl.h2 + '.', sl.body, [sl.fact1, sl.fact2, sl.fact4].map(clean).filter(Boolean).join('. ') + '.') });
  return out;
}

function collectSectors(d, lang) {
  const out = [];
  out.push({ titel: L(lang, 'Ecommerce: produceren wij in jouw sector', 'Ecommerce: do we produce in your sector'), url: '/ecommerce',
    tekst: para(d.heading, d.intro, d.noMatchBody, d.matchHeading, d.matchBody) });
  /* 340 sectornamen: in groepen, zodat "werken jullie in de fietsbranche"
   * één stuk met die naam vindt in plaats van één reusachtig stuk */
  const names = (Array.isArray(d.sectors) ? d.sectors : []).map((s) => clean(s && s[lang])).filter(Boolean);
  const per = 45;
  for (let i = 0; i < names.length; i += per) {
    const groep = names.slice(i, i + per);
    out.push({ titel: L(lang, 'Sectoren waarin wij produceren (deel ', 'Sectors we produce in (part ') + (Math.floor(i / per) + 1) + ')', url: '/ecommerce',
      tekst: L(lang, 'Sectoren waarin CUSTOM+ producten ontwikkelt en produceert: ', 'Sectors in which CUSTOM+ develops and produces products: ') + groep.join(', ') + '.' });
  }
  return out;
}

function collectGifting(d, lang) {
  const out = [];
  const ph = d.pagehead || {};
  out.push({ titel: L(lang, 'Relatiegeschenken: één doos, ontworpen voor honderden', 'Corporate gifting: one box, designed once'), url: '/relatiegeschenken',
    tekst: para(ph.kicker, ph.headingMain, ph.headingSub, ph.lead, ph.foldCaption) });
  const sc = d.scale || {};
  const tiers = (Array.isArray(sc.tiers) ? sc.tiers : []).map((t) => para(
    t.title + ':', (sc.unlockedLabel || '') + ' ' + (Array.isArray(t.unlocked) ? t.unlocked.join('; ') : '') + '.',
    (Array.isArray(t.locked) && t.locked.length) ? (sc.lockedLabel || '') + ' ' + t.locked.join('; ') + '.' : (sc.lockedEmpty || '')
  )).join(' ');
  out.push({ titel: L(lang, 'Relatiegeschenken: wat je aantal ontgrendelt (minimale oplage)', 'Corporate gifting: what your quantity unlocks (minimums)'), url: '/relatiegeschenken',
    tekst: para(sc.kicker, sc.heading, sc.intro, tiers) });
  const f = d.fears || {};
  const cards = (Array.isArray(f.cards) ? f.cards : []).map((c) => para(c.fear + ':', c.mechanism)).join(' ');
  out.push({ titel: L(lang, 'Relatiegeschenken: de drie angsten en het mechanisme', 'Corporate gifting: three fears and the mechanism'), url: '/relatiegeschenken',
    tekst: para(f.kicker, f.heading, f.intro, cards) });
  out.push({ titel: L(lang, 'Relatiegeschenken: betaalmomenten en inspectie', 'Corporate gifting: milestones and inspection'), url: '/relatiegeschenken',
    tekst: para(f.milestonesHeading + ':', Array.isArray(f.milestones) ? f.milestones.join(', ') + '.' : '', f.milestonesNote,
      f.modesHeading + ':', Array.isArray(f.modes) ? f.modes.join('; ') + '.' : '') });
  const s = d.sample || {};
  out.push({ titel: L(lang, 'Relatiegeschenken: eerst een sample', 'Corporate gifting: sample first'), url: '/relatiegeschenken',
    tekst: para(s.kicker, s.heading, s.body, s.honestNote, Array.isArray(s.steps) ? s.steps.join('. ') + '.' : '', s.replyNote) });
  const h = d.honest || {};
  out.push({ titel: L(lang, 'Relatiegeschenken: waarom hier geen testimonials staan', 'Corporate gifting: why there are no testimonials'), url: '/relatiegeschenken',
    tekst: para(h.kicker, h.heading, h.body, h.signature, h.cta) });
  const o = d.occasions || {};
  const occ = (Array.isArray(o.cards) ? o.cards : []).map((c) => para(c.title + ' (' + (c.date || '') + '):', c.idea, c.detail)).join(' ');
  out.push({ titel: L(lang, 'Relatiegeschenken: gelegenheden', 'Corporate gifting: occasions'), url: '/relatiegeschenken',
    tekst: para(o.kicker, o.heading, o.intro, occ, o.otherCard && o.otherCard.detail) });
  return out;
}

function collectWhy(d, lang) {
  const out = [];
  const ph = d.pagehead || {};
  out.push({ titel: L(lang, 'Waarom China: de capaciteit is echt, het risico ook', 'Why China: the capability is real, so is the risk'), url: '/waarom-china',
    tekst: para(ph.kicker, ph.headingMain, ph.headingSub, ph.lead) });
  const rc = d.riskControl || {};
  out.push({ titel: L(lang, 'Waarom China: elk risico heeft een maatregel', 'Why China: every failure mode has a control'), url: '/waarom-china',
    tekst: para(rc.kicker, rc.heading, rc.note) });
  /* De kolomkoppen staan alleen in de markup van custom-plus.html; ze zijn
   * hier overgenomen zodat een rij leesbaar blijft als losse tekst. */
  const cols = L(lang, ['CUSTOM+', 'zelf rechtstreeks', 'een handelsbedrijf', 'een sourcing agent'],
    ['CUSTOM+', 'going direct', 'a trading company', 'a sourcing agent']);
  const cmp = d.compare || {};
  const rows = (Array.isArray(cmp.rows) ? cmp.rows : []).map((r) => {
    if (!Array.isArray(r) || !r.length) return '';
    return clean(r[0]) + ': ' + r.slice(1).map((v, i) => cols[i] + ': ' + clean(v)).join('; ') + '.';
  }).join(' ');
  out.push({ titel: L(lang, 'Waarom China: de eerlijke vergelijking', 'Why China: the honest comparison'), url: '/waarom-china',
    tekst: para(cmp.kicker, cmp.heading, cmp.note, rows) });
  return out;
}

function collectFaq(d, lang) {
  const out = [];
  (Array.isArray(d.items) ? d.items : []).forEach((it) => {
    if (!it || !it.q) return;
    out.push({ titel: 'FAQ: ' + clean(it.q), url: '/faq' + (it.id ? '#' + it.id : ''), tekst: para(it.q, it.a) });
  });
  const rf = d.redflag || {};
  const qs = (Array.isArray(rf.questions) ? rf.questions : []).map((q) => para(q.question, rf.explanations && rf.explanations[q.key])).join(' ');
  out.push({ titel: L(lang, 'FAQ: een offerte van elders stresstesten', 'FAQ: stress test a quote from elsewhere'), url: '/faq',
    tekst: para(rf.kicker, rf.heading, rf.lead, qs) });
  return out;
}

function collectTrust(d, lang) {
  const out = [];
  const ph = d.pagehead || {};
  const f = d.founder || {};
  out.push({ titel: L(lang, 'Over ons: wie dit werk doet (Steffan Bakker)', 'About us: who does this work (Steffan Bakker)'), url: '/over-ons',
    tekst: para(ph.kicker, ph.headingMain, ph.headingSub, f.kicker, f.name + '.', Array.isArray(f.bio) ? f.bio.join(' ') : '') });
  const lg = d.logos || {};
  const names = (Array.isArray(lg.items) ? lg.items : []).map((l) => clean(l.name)).filter(Boolean);
  out.push({ titel: L(lang, 'Over ons: eerder mee gewerkt', 'About us: previously worked with'), url: '/over-ons',
    tekst: para(lg.heading + ':', names.join(', ') + '.', d.closingCta && d.closingCta.heading) });
  return out;
}

function collectGlossary(d, lang) {
  const out = [];
  const ph = d.pagehead || {};
  out.push({ titel: L(lang, 'Begrippen: de afkortingen uitgelegd', 'Glossary: the acronyms explained'), url: '/begrippen',
    tekst: para(ph.kicker, ph.heading, ph.lead) });
  (Array.isArray(d.terms) ? d.terms : []).forEach((t) => {
    if (!t || !t.term) return;
    out.push({ titel: L(lang, 'Begrip: ', 'Glossary: ') + clean(t.term) + (t.full ? ' (' + clean(t.full) + ')' : ''),
      url: '/begrippen#term-' + t.id,
      tekst: para(t.term + (t.full ? ' (' + t.full + ').' : '.'), t.def, t.thresholds ? L(lang, 'Drempels: ', 'Thresholds: ') + t.thresholds + '.' : '') });
  });
  return out;
}

function collectResources(d, lang) {
  const out = [];
  const ph = d.pagehead || {};
  const items = (Array.isArray(d.items) ? d.items : []).map((r) => para(r.title + ':', r.desc)).join(' ');
  out.push({ titel: L(lang, 'Hulpmiddelen: alle tools op één pagina', 'Resources: every tool, one page'), url: '/hulpmiddelen',
    tekst: para(ph.kicker, ph.heading, ph.lead, items, d.closingCta && d.closingCta.heading) });
  return out;
}

function collectDownloads(d, lang) {
  const out = [];
  const names = {
    nnnTemplate: L(lang, 'Sjabloon: NNN overeenkomst', 'Template: NNN agreement'),
    aqlChecklist: L(lang, 'Checklist: AQL inspectie voor verzending', 'Checklist: AQL pre shipment inspection'),
    dfmChecklist: L(lang, 'Checklist: DFM ontwerpbeoordeling', 'Checklist: DFM design review')
  };
  Object.keys(names).forEach((k) => {
    if (typeof d[k] !== 'string' || !d[k].trim()) return;
    /* checkbox-hokjes en tekstlijnen zijn opmaak, geen inhoud */
    const tekst = d[k].replace(/\[ \]/g, '').replace(/^\s*>\s*/gm, '').replace(/-{3,}/g, ' ');
    out.push({ titel: names[k], url: '/hulpmiddelen', tekst: clean(tekst) });
  });
  return out;
}

function collectContact(d, lang) {
  const out = [];
  const ph = d.pagehead || {};
  const doors = d.doors || {};
  const rows = (Array.isArray(doors.rows) ? doors.rows : []).map((r) => para(r.title + ':', r.subtitle)).join(' ');
  const how = d.how || {};
  const q = d.questions || {};
  out.push({ titel: L(lang, 'Contact: een project starten', 'Contact: start a project'), url: '/contact',
    tekst: para(ph.kicker, ph.headingMain, ph.headingSub, d.promise && d.promise.lead, d.recipient && d.recipient.role,
      doors.label, rows, q.message && q.message.help, how.line1, how.line2, how.line3) });
  return out;
}

function collectBlogArticle(a) {
  const out = [];
  const slug = String(a.slug || '');
  const url = '/blog/' + slug;
  const prefix = 'Blog: ' + clean(a.title);
  out.push({ titel: prefix, url, tekst: para(a.title + '.', a.dek) });
  /* Per kop één sectie; alinea's, citaten, lijsten en cijfers eronder horen
   * bij die kop. Zo blijft de titel van een stuk zeggen waar het over gaat. */
  let cur = { titel: prefix, url, tekst: '' };
  (Array.isArray(a.body) ? a.body : []).forEach((b) => {
    if (!b || typeof b !== 'object') return;
    if (b.type === 'h2') {
      if (cur.tekst.trim()) out.push(cur);
      cur = { titel: prefix + ' — ' + clean(b.text), url, tekst: clean(b.text) + '.' };
      return;
    }
    let t = '';
    if (b.type === 'ul' && Array.isArray(b.items)) t = b.items.map(clean).join(' ');
    else if (b.type === 'stat') t = para(b.value, b.label, b.source ? '(' + b.source + ')' : '');
    else t = clean(b.text);
    if (t) cur.tekst = (cur.tekst ? cur.tekst + ' ' : '') + t;
  });
  if (cur.tekst.trim()) out.push(cur);
  return out;
}

function collectCase(c) {
  const out = [];
  const url = '/cases/' + c.slug;
  const titel = 'Case: ' + c.titel;
  const kop = [c.uitkomst, c.intro || c.omschrijving, c.introKop, c.klant && 'Klant: ' + c.klant, c.categorie && 'Categorie: ' + c.categorie].filter(Boolean).join(' ');
  if (kop) out.push({ titel, url, tekst: clean(kop) });
  const feiten = (c.feiten || []).filter((f) => f && f.label && f.waarde).map((f) => f.label + ': ' + f.waarde).join('. ');
  if (feiten) out.push({ titel: titel + ' – feiten', url, tekst: clean(feiten) });
  const vraag = c.vraag || {};
  const vraagTekst = [vraag.citaat].concat(vraag.randvoorwaarden || []).filter(Boolean).join(' ');
  if (vraagTekst) out.push({ titel: titel + ' – de vraag', url, tekst: clean(vraagTekst) });
  const aanpak = c.aanpak || {};
  const aanpakTekst = [aanpak.kop].concat(aanpak.alineas || []).filter(Boolean).join(' ');
  if (aanpakTekst) out.push({ titel: titel + ' – onze aanpak', url, tekst: clean(aanpakTekst) });
  (c.fasen || []).forEach((f) => {
    const t = [f.fase, f.duur, f.tekst, f.opleverde && 'Opgeleverd: ' + f.opleverde].filter(Boolean).join(' ');
    if (t) out.push({ titel: titel + ' – ' + (f.titel || f.fase || 'fase'), url, tekst: clean(t) });
  });
  (c.problemen || []).forEach((p) => {
    const t = [p.misging, p.oorzaak, p.deden, p.effect].filter(Boolean).join(' ');
    if (t) out.push({ titel: titel + ' – ' + (p.tag || 'wat misging'), url, tekst: clean(t) });
  });
  const r = c.resultaat || {};
  const rt = [r.regel, r.andersDoen && 'Wat we nu anders zouden doen: ' + r.andersDoen].filter(Boolean).join(' ');
  if (rt) out.push({ titel: titel + ' – resultaat', url, tekst: clean(rt) });
  return out;
}

/* Sleutel = bestandsnaam zonder .json, waarde = verzamelaar. seo, search en
 * scope-quiz staan er bewust niet in: dat zijn metadata en vraaglabels, geen
 * inhoud waar een bezoeker iets aan heeft. */
const COLLECTORS = {
  home: collectHome, global: collectGlobal, services: collectServices, ecommerce: collectEcommerce,
  sectors: collectSectors, gifting: collectGifting, 'why-china': collectWhy, faq: collectFaq,
  trust: collectTrust, glossary: collectGlossary, resources: collectResources, downloads: collectDownloads,
  contact: collectContact
};

/* ------------------------------------------------------------------ chunker */

/* Secties samenvoegen tot ze minstens MIN_WORDS hebben, en splitsen zodra ze
 * boven MAX_WORDS komen. Samenvoegen gebeurt alleen binnen één bron, in
 * leesvolgorde; het samengevoegde stuk houdt de titel en url van zijn eerste
 * sectie, want dat is waar de lezer begint. */
export function chunkSections(sections) {
  const rows = [];
  let buf = null;
  const flush = () => { if (buf && buf.tekst.trim()) rows.push(buf); buf = null; };

  for (const sec of sections) {
    const tekst = clean(sec.tekst);
    if (!tekst) continue;
    const n = wordCount(tekst);
    if (n > MAX_WORDS) {
      flush();
      /* lange sectie: per zin opstapelen tot ongeveer het midden van de
       * bandbreedte, zodat de laatste rest ook nog een volwaardig stuk is */
      const target = Math.round(MIN_WORDS * 1.8);
      let piece = '';
      let part = 1;
      for (const s of sentences(tekst)) {
        if (piece && wordCount(piece) + wordCount(s) > MAX_WORDS) {
          rows.push({ titel: sec.titel + (part > 1 ? ' (' + part + ')' : ''), url: sec.url, tekst: piece.trim() });
          part++; piece = '';
        }
        piece += (piece ? ' ' : '') + s;
        if (wordCount(piece) >= target) {
          rows.push({ titel: sec.titel + (part > 1 ? ' (' + part + ')' : ''), url: sec.url, tekst: piece.trim() });
          part++; piece = '';
        }
      }
      if (piece.trim()) {
        /* een te korte staart hoort bij het vorige stuk van dezelfde sectie */
        const last = rows[rows.length - 1];
        if (wordCount(piece) < MIN_WORDS && last && last.url === sec.url && wordCount(last.tekst) + wordCount(piece) <= MAX_WORDS) {
          last.tekst += ' ' + piece.trim();
        } else {
          rows.push({ titel: sec.titel + (part > 1 ? ' (' + part + ')' : ''), url: sec.url, tekst: piece.trim() });
        }
      }
      continue;
    }
    if (buf && wordCount(buf.tekst) < MIN_WORDS && wordCount(buf.tekst) + n <= MAX_WORDS) {
      buf.tekst += '\n' + tekst;
      continue;
    }
    flush();
    buf = { titel: sec.titel, url: sec.url, tekst };
  }
  flush();

  /* Een laatste stuk dat te kort bleef, gaat bij zijn voorganger als dat past. */
  for (let i = rows.length - 1; i > 0; i--) {
    if (wordCount(rows[i].tekst) < MIN_WORDS && wordCount(rows[i - 1].tekst) + wordCount(rows[i].tekst) <= MAX_WORDS) {
      rows[i - 1].tekst += '\n' + rows[i].tekst;
      rows.splice(i, 1);
    }
  }
  return rows;
}

/* --------------------------------------------------------------------- build */

export function buildIndex(root = DEFAULT_ROOT) {
  const rows = [];
  const perBron = {};
  const warnings = [];
  const add = (bron, taal, chunks) => {
    chunks.forEach((c, i) => {
      rows.push({
        id: bron.replace(/^content\//, '').replace(/\.json$/, '') + ':' + taal + ':' + (i + 1),
        url: c.url, titel: c.titel, taal, tekst: c.tekst, bron
      });
    });
    perBron[bron] = chunks.length;
  };

  const langs = [['en', 'content'], ['nl', 'content/nl']];
  if (!existsSync(join(root, 'content', 'nl'))) {
    warnings.push('content/nl ontbreekt (draai eerst scripts/build-site.mjs): alleen Engels geïndexeerd');
  }
  for (const [taal, dir] of langs) {
    for (const name of Object.keys(COLLECTORS)) {
      const file = join(root, dir, name + '.json');
      const data = readJson(file);
      if (!data) { if (taal === 'en') warnings.push(file + ' ontbreekt of is geen geldige JSON'); continue; }
      add(dir + '/' + name + '.json', taal, chunkSections(COLLECTORS[name](data, taal)));
    }
  }

  /* cases: één stuk per hoofdstuk zodat "hebben jullie ooit een … gemaakt?"
     bij de juiste case uitkomt; een voorbeeldcase is geen echte referentie en
     wordt overgeslagen */
  const casesDir = join(root, 'content', 'cases');
  const caseFiles = existsSync(casesDir) ? readdirSync(casesDir).filter((f) => f.endsWith('.json')).sort() : [];
  for (const f of caseFiles) {
    const c = readJson(join(casesDir, f));
    if (!c || typeof c !== 'object' || !c.slug || !c.titel) { warnings.push('content/cases/' + f + ' overgeslagen (geen slug/titel)'); continue; }
    if (!c.gepubliceerd || c.voorbeeld) continue;
    add('content/cases/' + f, 'nl', chunkSections(collectCase(c)));
  }

  const blogDir = join(root, 'content', 'blog');
  const blogFiles = existsSync(blogDir) ? readdirSync(blogDir).filter((f) => f.endsWith('.json')).sort() : [];
  for (const f of blogFiles) {
    const a = readJson(join(blogDir, f));
    if (!a || typeof a !== 'object' || !a.slug || !a.title) { warnings.push('content/blog/' + f + ' overgeslagen (geen slug/titel)'); continue; }
    const taal = a.lang === 'en' ? 'en' : 'nl';
    add('content/blog/' + f, taal, chunkSections(collectBlogArticle(a)));
  }

  return { rows, perBron, warnings };
}

/* Als script gedraaid: schrijven en rapporteren. Als module geïmporteerd
 * (door de test): alleen de functies. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { rows, perBron, warnings } = buildIndex();
  const outFile = join(DEFAULT_ROOT, 'chat', 'index.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ versie: 1, stukken: rows }));
  const kort = rows.filter((r) => wordCount(r.tekst) < MIN_WORDS).length;
  const lang = rows.filter((r) => wordCount(r.tekst) > MAX_WORDS).length;
  console.log('build-chat-index: ' + rows.length + ' stukken uit ' + Object.keys(perBron).length + ' bronnen -> chat/index.json ('
    + (Buffer.byteLength(JSON.stringify(rows)) / 1024).toFixed(1) + ' KB)');
  for (const b of Object.keys(perBron)) console.log('  ' + b.padEnd(42) + String(perBron[b]).padStart(3));
  if (kort || lang) console.log('build-chat-index: ' + kort + ' stuk(ken) korter dan ' + MIN_WORDS + ' woorden, ' + lang + ' langer dan ' + MAX_WORDS);
  for (const w of warnings) console.warn('build-chat-index: LET OP ' + w);
}
