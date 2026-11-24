/* i18n-live.mjs — meet in een echte browser of elke pagina meevertaalt.
 *
 * WAAROM DIT BESTAAT
 * De taalknoppen (EN NL DE FR ES) vertalen de pagina in de browser: de tekst
 * staat Nederlands in de HTML en wordt per tekstnode opgezocht in
 * /assets/i18n/<taal>.json. Mist daar één regel, dan blijft die zin gewoon
 * Nederlands staan, zonder foutmelding. scripts/i18n-audit.mjs controleert
 * de bronnen op papier; dit script kijkt naar wat een bezoeker werkelijk ziet.
 *
 * WAT HET DOET
 * Het laadt elke route eerst in het Nederlands en daarna in elke andere taal
 * (de keuze staat in localStorage cp_lang, precies zoals bij een bezoeker die
 * terugkomt). Per taal verzamelt het alle tekst van de pagina: tekstnodes,
 * placeholder, aria-label, alt en title, de documenttitel en de
 * meta-omschrijving. Een tekst telt als "niet vertaald" wanneer hij in de
 * andere taal letterlijk hetzelfde is als in het Nederlands en uit gewone
 * woorden bestaat. Voor DE, FR en ES telt ook tekst die gelijk is aan de
 * Engelse versie (een Engelse literal uit de code die geen vertaling heeft).
 *
 * WAT BEWUST GELIJK MAG BLIJVEN
 *   - namen, merk, adressen, getallen en vaktermen: zie SAME hieronder
 *   - alles waarvoor content/vertalingen.json uitdrukkelijk dezelfde tekst
 *     opgeeft (bijvoorbeeld "Blog" of "Contact" in het Frans)
 *   - de sectorlijst (content/sectors.json, een eigen tweetalige lijst) en de
 *     downloadbare sjablonen (juridische tekst, bewust niet vertaald)
 *
 * Draaien:  node scripts/i18n-live.mjs [--base http://localhost:8790]
 *           [--routes /,/faq/] [--langs en,de,fr,es] [--toon 40]
 * Uitvoer:  scripts/.i18n-live/report.json (gitignored). Exit 1 bij gaten.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(HERE, '.i18n-live');
const ARGS = process.argv.slice(2);
function argValue(name, fallback) { const i = ARGS.indexOf(name); return i >= 0 ? ARGS[i + 1] : fallback; }
const BASE = argValue('--base', 'http://localhost:8790').replace(/\/$/, '');
const LANGS = argValue('--langs', 'en,de,fr,es').split(',').map((s) => s.trim()).filter(Boolean);
const SHOW = parseInt(argValue('--toon', '60'), 10);
const blogDir = join(ROOT, 'content', 'blog');
const ROUTES = (argValue('--routes', '') || [
  '/', '/diensten/', '/ecommerce/', '/relatiegeschenken/', '/restpartijen/', '/waarom-china/', '/faq/', '/over-ons/',
  '/begrippen/', '/hulpmiddelen/', '/contact/', '/blog/', '/privacy/', '/zoeken/', '/deze-pagina-bestaat-niet/',
  ...(existsSync(join(ROOT, 'cases', 'index.html')) ? ['/cases/'] : []),
  ...(existsSync(blogDir)
    ? JSON.parse(readFileSync(join(ROOT, 'content', 'blog-index.json'), 'utf8')).articles.map((a) => '/blog/' + a.slug + '/')
    : []),
].join(',')).split(',').map((r) => r.trim()).filter(Boolean);

/* ---------- wat gelijk mag blijven ---------- */

/* Tekst die in elke taal hetzelfde hoort te zijn (namen, merken, vaktermen)
 * staat in content/vertalingen.json onder "zelfde". Hier alleen wat het
 * script zelf moet weten: de namen van de talen op de taalknoppen. */
const SAME = new Set(['Nederlands', 'English', 'Deutsch', 'Français', 'Español']);
/* stukjes die we uit een tekst wegdenken voordat we kijken of er nog woorden overblijven */
const NEUTRAL = /CUSTOM\+|Steffan Bakker|Shenzhen|Amsterdam|[\w.+-]+@[\w-]+\.[\w.]+|https?:\/\/\S+|customplus\.nl\S*|\b(AQL|DFM|FQC|IPQC|IQC|MOQ|NNN|CE|FCC|RoHS|REACH|FOB|DDP|EXW|LCL|FCL|HS|BTW|KVK|IP|DTC|B2B|PDF|AI|EUR|USD|RMB|ISO|OEM|ODM|QC|SKU|EN|NL|DE|FR|ES)\b/g;
/* een datum die de browser zelf per taal opmaakt ("30 jul 2026") kan in twee talen gelijk uitvallen */
const DATE = /^\d{1,2}\.? \p{L}{3,4}\.? \d{4}$/u;

/* uitdrukkelijk gelijke vertalingen uit de bronnen: wie bij "Blog" voor het
 * Frans ook "Blog" invult, heeft daarover nagedacht */
/* Wat geldt als vertaald: elke tekst die als uitkomst in het woordenboek van
 * die taal staat. Dat dekt ook de gevallen waarin de vertaling toevallig
 * gelijk is aan het Nederlands of het Engels ("Blog", "Services" in het
 * Frans): wie dat zo heeft ingevuld, heeft erover nagedacht. */
const declaredSame = {};
const NL_OF_EN = {};
for (const l of LANGS) declaredSame[l] = new Set();
const vertFile = join(ROOT, 'content', 'vertalingen.json');
if (existsSync(vertFile)) {
  const all = JSON.parse(readFileSync(vertFile, 'utf8'));
  for (const t of all.zelfde || []) SAME.add(norm(t));
  for (const [nl, per] of Object.entries(all.teksten || {})) {
    for (const l of LANGS) if (per && typeof per[l] === 'string' && per[l]) declaredSame[l].add(norm(per[l]));
  }
}
{
  const src = readFileSync(join(ROOT, 'custom-plus.html'), 'utf8');
  const m = src.match(/\n\s*var I18N = (\{[\s\S]*?\});\n/);
  if (m) {
    const I18N = JSON.parse(m[1]);
    const NL = I18N.nl || {};
    for (const [en, nl] of Object.entries(NL)) {
      NL_OF_EN[norm(en)] = nl;
      for (const l of LANGS) {
        const t = l === 'en' ? en : (I18N[l] || {})[en];
        if (typeof t === 'string' && t) declaredSame[l].add(norm(t));
      }
    }
  }
}
function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
function hasWords(t) {
  if (DATE.test(t)) return false;
  const rest = t.replace(NEUTRAL, ' ');
  return /\p{L}{3,}/u.test(rest);
}

/* ---------- een minimale DevTools-client (zelfde als mobile-audit.mjs) ---------- */
class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (e) => reject(new Error('websocket: ' + (e.message || 'fout'))));
      this.ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
        }
      });
    });
  }
  send(method, params = {}, timeoutMs = 30000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.pending.delete(id); reject(new Error(method + ': geen antwoord binnen ' + timeoutMs + 'ms')); }, timeoutMs);
      this.pending.set(id, { resolve: (r) => { clearTimeout(t); resolve(r); }, reject: (e) => { clearTimeout(t); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch (e) { /* al dicht */ } }
}

/* ---------- wat in de pagina draait ---------- */
const COLLECT = `(async function(){
  var want = __LANG__;
  /* wacht tot de app de taal gezet heeft en de vertaalslag tot rust is */
  var t0 = Date.now();
  while (document.documentElement.getAttribute('lang') !== want && Date.now() - t0 < 6000) { await new Promise(function(r){ setTimeout(r, 100); }); }
  await new Promise(function(r){ setTimeout(r, 1600); });
  /* alles tevoorschijn halen wat pas na een handeling wordt opgebouwd */
  var steps = __STEPS__;
  function pause(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function shown(e){ return !!(e && e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden'; }
  function safe(e){ return !(e.closest && e.closest('.fl-langswitch')) && !(e.tagName === 'A' && e.getAttribute('href') && e.getAttribute('href').charAt(0) !== '#'); }
  for (var si = 0; si < steps.length; si++) {
    var st = steps[si];
    try {
      if (st[0] === 'klik') {
        var els = document.querySelectorAll(st[1]);
        for (var ki = 0; ki < els.length && ki < (st[2] || 12); ki++) { if (safe(els[ki])) { els[ki].click(); await pause(140); } }
      } else if (st[0] === 'typ') {
        var inp = document.querySelector(st[1]);
        if (inp) {
          inp.focus(); inp.value = st[2];
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
          await pause(450);
        }
      } else if (st[0] === 'hash') {
        location.hash = st[1]; await pause(600);
      } else if (st[0] === 'doorloop') {
        /* een stappenvenster: steeds de eerste zichtbare keuze aanklikken */
        for (var di = 0; di < (st[3] || 8); di++) {
          var box = document.querySelector(st[1]); if (!box) break;
          var opts = box.querySelectorAll('button, [role="radio"], [role="option"]'), hit = null;
          for (var oi = 0; oi < opts.length; oi++) { if (shown(opts[oi]) && !opts[oi].disabled && !(st[2] && opts[oi].matches(st[2]))) { hit = opts[oi]; break; } }
          if (!hit) break;
          hit.click(); await pause(450);
        }
      } else if (st[0] === 'wacht') { await pause(st[1]); }
    } catch (e) {}
  }
  if (steps.length) await pause(700);
  var out = [], seen = {};
  function where(e){ var p = [], n = e, i = 0; while (n && n.nodeType === 1 && i < 3) { p.unshift((n.tagName||'').toLowerCase() + (n.id ? '#' + n.id : '') + (typeof n.className === 'string' && n.className.trim() ? '.' + n.className.trim().split(/\\s+/)[0] : '')); n = n.parentNode; i++; } return p.join(' > '); }
  function push(kind, text, el){
    var t = String(text || '').replace(/\\s+/g, ' ').trim(); if (!t) return;
    var k = kind + '|' + t; if (seen[k]) return; seen[k] = 1;
    var no = !!(el && el.closest && el.closest('[data-no-i18n]'));
    /* de sitechat (chat/chat.js) heeft een eigen vijftalige tabel */
    var sect = !!(el && el.closest && el.closest('.cpc-panel, .cpc-launch, [class^="cpc-"]'));
    /* valt een zin uiteen rond een link of een vet woord, dan helpt de hele zin bij het vertalen van één stuk */
    var ctx = '';
    if (kind === 'tekst' && el && el.childNodes.length > 1) { ctx = String(el.textContent || '').replace(/\\s+/g, ' ').trim(); if (ctx === t) ctx = ''; else ctx = ctx.slice(0, 1500); }
    out.push({ k: kind, t: t, no: no, own: sect, w: el ? where(el) : '', c: ctx });
  }
  var skip = { SCRIPT:1, STYLE:1, NOSCRIPT:1, TEMPLATE:1 };
  (function walk(n){
    for (var c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { push('tekst', c.nodeValue, n); }
      else if (c.nodeType === 1) {
        if (skip[c.tagName]) continue;
        if (c.tagName === 'svg' || c.tagName === 'SVG') { var tt = c.querySelector && c.querySelector('title'); if (tt) push('tekst', tt.textContent, c); continue; }
        var attrs = ['placeholder', 'aria-label', 'alt', 'title'];
        for (var a = 0; a < attrs.length; a++) { if (c.hasAttribute(attrs[a])) push(attrs[a], c.getAttribute(attrs[a]), c); }
        if (c.shadowRoot) walk(c.shadowRoot);
        walk(c);
      }
    }
  })(document.body);
  push('titel', document.title, null);
  var md = document.querySelector('meta[name="description"]'); if (md) push('omschrijving', md.getAttribute('content'), null);
  return JSON.stringify({ lang: document.documentElement.getAttribute('lang'), items: out });
})()`;

/* Per route: handelingen die tekst tevoorschijn halen die pas na een klik of
 * na typen wordt opgebouwd. Het zijn gegevens, geen code: 'klik' (selector,
 * hoogstens n keer), 'typ' (selector, tekst), 'hash', 'doorloop' (een
 * stappenvenster: steeds de eerste zichtbare keuze) en 'wacht'. Links naar
 * een andere pagina en de taalknoppen worden nooit aangeklikt. De schil
 * (scopecheck, zoekvenster, chat) is op elke pagina dezelfde en wordt daarom
 * alleen op de homepage doorlopen. */
const STEPS = {
  '/': [
    ['klik', '.fl-service-row', 6], ['klik', '#stagepopup-close, .fl-stagepopup__close', 1],
    ['klik', '#home-cal-open', 1], ['klik', '#cal-modal-close, .fl-calmodal__close', 1],
    ['hash', '#scope'], ['doorloop', '#scope-modal', '#scope-modal-close, #scope-restart, #scope-ics', 9],
    ['klik', '#scope-modal-close', 1],
    ['klik', '#search-trigger', 1], ['typ', '#search-input', 'MOQ'], ['typ', '#search-input', 'qqqqzz'],
    ['klik', '#search-modal-close', 1],
    ['klik', '.cpc-fab', 1], ['wacht', 500],
  ],
  '/diensten/': [
    ['klik', '.fl-stage-tab', 6], ['klik', '.fl-timeline__bar', 6], ['klik', '.fl-paygate__gate', 4],
    ['typ', '#planner-date', '2027-03-01'],
  ],
  '/ecommerce/': [
    ['klik', '.fl-ec-route', 2], ['klik', '#ec-sample-btn', 4], ['typ', '#ec-double-in', '4,50'],
    ['typ', '#sector-search-input', 'speel'], ['klik', '#sector-search-results [role="option"], #sector-search-results button, #sector-search-results li', 1],
    ['klik', '#sector-modal-close', 1],
    ['typ', '#sector-search-input', 'qqqqzz'],
  ],
  '/relatiegeschenken/': [
    ['klik', '#page-gifting .fl-chip', 5], ['klik', '.fl-gift-fear', 3],
    ['klik', '.fl-gift-card__open', 2], ['klik', '.fl-chips button, #gift-occ-size button', 3], ['klik', '#gift-occ-add', 1],
    ['klik', '#gift-occ-emailnow', 1],
    ['klik', '.fl-giftmodal__close', 5], ['klik', '#gift-sample-cta', 1], ['klik', '#gift-sample-send', 1],
    ['klik', '.fl-giftmodal__close', 5],
  ],
  '/waarom-china/': [['klik', '#page-why .fl-chip', 5], ['klik', '.fl-riskmap__expand', 3]],
  '/faq/': [['klik', '#page-faq button', 12], ['klik', '#page-faq summary', 12]],
  '/contact/': [
    ['klik', '#page-contact .fl-chip, #page-contact [role="radio"]', 10], ['klik', '#cf-how-toggle', 1],
    ['typ', '#cf-email', 'geen-mail'], ['klik', '#cf-send', 1],
  ],
  '/zoeken/': [['typ', '#search-page-input', 'MOQ'], ['wacht', 400], ['typ', '#search-page-input', 'qqqqzz']],
  '/hulpmiddelen/': [['klik', '#resources-list button, #resources-list a[href^="#"]', 8]],
  '/restpartijen/': [['typ', '#rest-email', 'geen-mail'], ['klik', '#rest-send', 1]],
};

/* Het script klikt op knoppen, dus ook op "verstuur". Er mag daarbij nooit
 * iets de deur uit: geen formulier naar Netlify, geen vraag naar de chat of de
 * AI productcheck (dat kost echte aanroepen), ook niet als iemand dit tegen
 * de live site draait. Alles wat geen gewone GET is, wordt in de pagina zelf
 * tegengehouden; de site toont dan zijn "versturen lukt niet"-toestand, en
 * die tekst hoort ook vertaald te zijn. */
const NO_SEND = ';(function(){var f=window.fetch;window.fetch=function(u,o){var m=String((o&&o.method)||(u&&u.method)||"GET").toUpperCase();'
  + 'if(m!=="GET")return Promise.reject(new Error("i18n-live: verzenden geblokkeerd"));return f.apply(this,arguments)};'
  + 'var x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m){if(String(m).toUpperCase()!=="GET")throw new Error("i18n-live: verzenden geblokkeerd");return x.apply(this,arguments)};'
  + 'if(navigator.sendBeacon)navigator.sendBeacon=function(){return false};})();';

async function collect(cdp, route, lang) {
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.setItem("cp_lang",' + JSON.stringify(lang) + ');sessionStorage.setItem("cp_intro","1")}catch(e){}' + NO_SEND,
  }).then((r) => { collect.lastScript = r.identifier; });
  await cdp.send('Page.navigate', { url: BASE + route });
  await new Promise((r) => setTimeout(r, 900));
  const expr = COLLECT.replace('__LANG__', JSON.stringify(lang)).replace('__STEPS__', JSON.stringify(STEPS[route] || []));
  const res = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, 90000);
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: collect.lastScript });
  if (!res.result || typeof res.result.value !== 'string') throw new Error('geen meting voor ' + route + ' (' + lang + ')');
  return JSON.parse(res.result.value);
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars'] });
  const report = { base: BASE, langs: LANGS, pages: [] };
  const uniek = new Map(); /* tekst -> { talen:Set, routes:Set, soort, waar, reden } */
  let cdp = null, totaal = 0;
  try {
    const res = await fetch('http://127.0.0.1:' + chrome.port + '/json/new?about:blank', { method: 'PUT' });
    const target = await res.json();
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    for (const route of ROUTES) {
      const nl = await collect(cdp, route, 'nl');
      const nlSet = new Set(nl.items.map((i) => i.k + '|' + i.t));
      const nlZin = new Map(nl.items.filter((i) => i.c).map((i) => [i.k + '|' + i.t, i.c]));
      const page = { route, nlCount: nl.items.length, langs: {} };
      let en = null;
      const order = LANGS.slice().sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : 0));
      for (const lang of order) {
        const got = await collect(cdp, route, lang);
        if (lang === 'en') en = got;
        const enSet = en && lang !== 'en' ? new Set(en.items.map((i) => i.k + '|' + i.t)) : new Set();
        const gaps = [];
        /* wat gelijk bleef aan het Nederlands en is toegestaan: voor wie de regels hierboven wil nalopen */
        const gelijk = [];
        for (const it of got.items) {
          if (nlSet.has(it.k + '|' + it.t) && /\p{L}{3,}/u.test(it.t)) gelijk.push(it.t);
          /* de titel is "<tekst> | CUSTOM+": het woordenboek kent alleen het deel ervoor */
          const kern = it.k === 'titel' ? it.t.replace(/ \| CUSTOM\+$/, '') : it.t;
          if (!hasWords(kern) || SAME.has(kern) || declaredSame[lang].has(kern)) continue;
          const key = it.k + '|' + it.t;
          let reden = '';
          if (nlSet.has(key)) reden = 'nog Nederlands';
          else if (enSet.has(key) && !it.own) reden = 'nog Engels';
          if (!reden) continue;
          gaps.push({ soort: it.k, tekst: it.t, waar: it.w, vast: it.no, reden });
          /* sleutel = de Nederlandse tekst waaronder de vertaling in content/vertalingen.json hoort */
          const sleutel = reden === 'nog Engels' ? (NL_OF_EN[kern] || null) : kern;
          const u = uniek.get(it.t) || { talen: new Set(), routes: new Set(), soort: it.k, waar: it.w, reden, vast: it.no, zin: nlZin.get(key) || '', sleutel };
          u.talen.add(lang); u.routes.add(route); uniek.set(it.t, u);
        }
        page.langs[lang] = { taalGezet: got.lang, aantal: got.items.length, gaten: gaps, gelijk };
        totaal += gaps.length;
      }
      report.pages.push(page);
      console.log(route.padEnd(36) + order.map((l) => l + ' ' + String(page.langs[l].gaten.length).padStart(3)).join('   '));
    }
  } finally {
    if (cdp) cdp.close();
    await chrome.kill();
  }
  report.uniek = [...uniek.entries()].map(([tekst, u]) => ({ tekst, sleutel: u.sleutel, talen: [...u.talen], routes: [...u.routes], soort: u.soort, waar: u.waar, reden: u.reden, vast: u.vast, zin: u.zin }));
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  console.log('\n' + report.uniek.length + ' unieke teksten vertalen niet mee (' + totaal + ' keer geteld over routes en talen).');
  report.uniek.slice(0, SHOW).forEach((u) => {
    console.log('  [' + u.talen.join(',') + '] ' + (u.vast ? '(vast) ' : '') + u.soort + ': ' + JSON.stringify(u.tekst.slice(0, 110)) + '  @ ' + u.routes.slice(0, 3).join(' ') + (u.routes.length > 3 ? ' +' + (u.routes.length - 3) : ''));
  });
  if (report.uniek.length > SHOW) console.log('  … en nog ' + (report.uniek.length - SHOW) + ' (zie scripts/.i18n-live/report.json)');
  console.log('rapport: scripts/.i18n-live/report.json');
  process.exit(totaal ? 1 : 0);
}

main().catch((e) => { console.error('i18n-live: ' + (e && e.message ? e.message : e)); process.exit(2); });
