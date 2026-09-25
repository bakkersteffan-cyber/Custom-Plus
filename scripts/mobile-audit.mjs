/* mobile-audit.mjs — meet de hele gebouwde site door op telefoonbreedtes.
 *
 * WAAROM DIT BESTAAT
 * De eigenaar eist dat elke pagina op elke telefoon klopt en past. Met de
 * hand scrollen door achttien pagina's op vier breedtes is niet vol te
 * houden en niet herhaalbaar. Dit script stuurt een echte headless Chrome
 * aan (via chrome-launcher, dezelfde als de Lighthouse-poort) en meet per
 * pagina en breedte precies de dingen die op een telefoon misgaan:
 *   - horizontale overloop van het document
 *   - elementen die buiten het scherm steken
 *   - woorden die midden in het woord over twee regels breken
 *   - tekst die uit zijn vak loopt (nowrap of clipping)
 *   - broers die over elkaar heen liggen (botsende lay-out)
 *   - raakvlakken kleiner dan 44px
 *   - leesbare tekst kleiner dan 12px
 * en maakt per pagina een schermafbeelding van de hele pagina (375px) om
 * met eigen ogen na te kijken.
 *
 * Geen extra afhankelijkheden: Node heeft sinds v22 een ingebouwde WebSocket,
 * dus het DevTools-protocol wordt hier rechtstreeks gesproken.
 *
 * Draaien:  node scripts/mobile-audit.mjs [--base http://localhost:8790]
 *           [--widths 320,375,390,430] [--routes /,/diensten/] [--no-shots]
 * Uitvoer:  scripts/.mobile-audit/<route>-375.jpg en report.json (gitignored)
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '.mobile-audit');
const ARGS = process.argv.slice(2);
function argValue(name, fallback) { const i = ARGS.indexOf(name); return i >= 0 ? ARGS[i + 1] : fallback; }
const BASE = argValue('--base', 'http://localhost:8790').replace(/\/$/, '');
const WIDTHS = argValue('--widths', '320,375,390,430').split(',').map((w) => parseInt(w, 10)).filter(Boolean);
const SHOTS = ARGS.indexOf('--no-shots') < 0;
/* --shot-width: op welke breedte de schermafbeeldingen gemaakt worden (ook bruikbaar voor desktopcontrole, bv. 1280) */
const SHOT_WIDTH = parseInt(argValue('--shot-width', '375'), 10);
const ROUTES = (argValue('--routes', '') || [
  '/', '/diensten/', '/ecommerce/', '/relatiegeschenken/', '/waarom-china/', '/faq/', '/over-ons/',
  '/begrippen/', '/hulpmiddelen/', '/contact/', '/blog/', '/privacy/', '/zoeken/', '/deze-pagina-bestaat-niet/',
  '/cases/', '/cases/beelen-keychains/',
  '/blog/wat-een-sample-echt-kost/', '/blog/moq-is-een-gesprek/', '/blog/de-containerrekensom/', '/blog/aql-zonder-jargon/',
].join(',')).split(',').map((r) => r.trim()).filter(Boolean);

/* ---------- een minimale DevTools-client op de ingebouwde WebSocket ---------- */
class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.listeners = new Map(); }
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
        } else if (msg.method && this.listeners.has(msg.method)) {
          for (const fn of this.listeners.get(msg.method)) fn(msg.params);
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
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  once(method) { return new Promise((resolve) => { const fn = (p) => { const arr = this.listeners.get(method); arr.splice(arr.indexOf(fn), 1); resolve(p); }; this.on(method, fn); }); }
  close() { try { this.ws.close(); } catch (e) { /* al dicht */ } }
}

/* ---------- het meetscript dat in de pagina draait ---------- */
const MEASURE = `(async function(){
  var W = document.documentElement.clientWidth;
  var out = { w: W, docH: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth - W,
    outside: [], broken: [], clipped: [], overlaps: [], smallTargets: [], tinyText: [] };
  try { await document.fonts.ready; } catch (e) {}
  var st = document.createElement('style'); st.id = 'audit-style';
  st.appendChild(document.createTextNode('*{transition:none!important;animation:none!important}'));
  document.head.appendChild(st);
  var reveals = document.querySelectorAll('.fl-reveal, .fl-stagger');
  for (var r = 0; r < reveals.length; r++) reveals[r].classList.add('is-visible');
  var rails = document.querySelectorAll('.fl-gift-deck__rail');
  for (var d = 0; d < rails.length; d++) rails[d].classList.add('is-dealt');
  var targets = document.querySelectorAll('.is-ready-target');
  for (var q = 0; q < targets.length; q++) targets[q].classList.add('is-ready');
  await new Promise(function (res) { setTimeout(res, 250); });
  out.docH = document.documentElement.scrollHeight;
  out.overflowX = document.documentElement.scrollWidth - W;

  function label(e) { return (e.tagName || '').toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''); }
  function visible(e) { if (!e.getClientRects().length) return false; var cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.opacity !== '0' && cs.display !== 'none'; }
  function ownText(e) { var t = ''; for (var i = 0; i < e.childNodes.length; i++) { if (e.childNodes[i].nodeType === 3) t += e.childNodes[i].nodeValue; } return t.trim(); }
  function inClip(e) { var p = e.parentNode; while (p && p !== document.body && !(p.tagName === 'MAIN' || (p.classList && p.classList.contains('fl')))) { var ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true; p = p.parentNode; } return false; }
  function inProse(e) { var p = e.parentNode; while (p && p !== document.body) { var tag = (p.tagName || '').toLowerCase(); if (tag === 'p' || tag === 'li' || tag === 'dd' || tag === 'td') return true; p = p.parentNode; } return false; }

  var main = document.querySelector('main') || document.body;
  var all = main.querySelectorAll('*');
  var i, e, cs, rect;
  for (i = 0; i < all.length; i++) {
    e = all[i];
    if (!visible(e)) continue;
    cs = getComputedStyle(e);
    if (cs.position === 'fixed') continue;
    rect = e.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    /* buiten het scherm */
    /* binnen een eigen scroller of geclipte band (kaartenrail, logoband) hoort
       inhoud buiten beeld: alleen de pagina zelf mag niet zijwaarts scrollen */
    if ((rect.right > W + 1 || rect.left < -1) && cs.position !== 'absolute' && !inClip(e)) {
      if (out.outside.length < 15) out.outside.push({ el: label(e), left: Math.round(rect.left), right: Math.round(rect.right), w: Math.round(rect.width) });
    }
    /* tekst die uit zijn vak loopt */
    if (e.clientWidth > 2 && e.scrollWidth > e.clientWidth + 2 && ownText(e).length > 0 && (cs.overflowX === 'hidden' || cs.whiteSpace === 'nowrap')) {
      if (out.clipped.length < 15) out.clipped.push({ el: label(e), text: ownText(e).slice(0, 40), scroll: e.scrollWidth, client: e.clientWidth });
    }
    /* te kleine letters */
    if (ownText(e).length > 2 && parseFloat(cs.fontSize) < 11.5 && cs.position !== 'absolute') {
      if (out.tinyText.length < 15) out.tinyText.push({ el: label(e), size: cs.fontSize, text: ownText(e).slice(0, 30) });
    }
  }
  /* afgebroken woorden in koppen, knoppen, labels, navigatie */
  var heads = main.querySelectorAll('h1, h2, h3, h4, a, button, label, .fl-kicker, summary, th, dt, strong');
  for (i = 0; i < heads.length; i++) {
    e = heads[i]; if (!visible(e)) continue;
    if (getComputedStyle(e).position === 'fixed') continue;
    var walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null, false), node;
    while ((node = walker.nextNode())) {
      var txt = node.nodeValue; var ms = Array.from(txt.matchAll(/[^\\s\\u00AD-]+/g));
      for (var m = 0; m < ms.length; m++) {
        if (ms[m][0].length < 4) continue;
        var rg = document.createRange(); rg.setStart(node, ms[m].index); rg.setEnd(node, ms[m].index + ms[m][0].length);
        var rects = rg.getClientRects(); if (rects.length < 2) continue;
        var tops = {}; for (var k = 0; k < rects.length; k++) { if (rects[k].width > 1) tops[Math.round(rects[k].top)] = 1; }
        if (Object.keys(tops).length > 1 && out.broken.length < 15) out.broken.push({ el: label(e), word: ms[m][0] });
      }
    }
  }
  /* broers die over elkaar liggen (beide met tekst, beide in de flow) */
  var parents = main.querySelectorAll('*');
  for (i = 0; i < parents.length && out.overlaps.length < 15; i++) {
    var kids = []; var ch = parents[i].children;
    for (var c = 0; c < ch.length; c++) {
      var k2 = ch[c]; if (!visible(k2)) continue; var pcs = getComputedStyle(k2);
      if (pcs.position === 'absolute' || pcs.position === 'fixed' || pcs.position === 'sticky') continue;
      if (!(k2.textContent || '').trim()) continue;
      var rr = k2.getBoundingClientRect(); if (rr.width < 4 || rr.height < 4) continue;
      kids.push({ e: k2, r: rr });
    }
    for (var a = 0; a < kids.length; a++) for (var b = a + 1; b < kids.length; b++) {
      var A = kids[a].r, B = kids[b].r;
      var ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ox > 6 && oy > 6) {
        var da = getComputedStyle(kids[a].e).display, db = getComputedStyle(kids[b].e).display;
        if (da.indexOf('inline') === 0 && db.indexOf('inline') === 0) continue;
        /* de afgeronde naden: een sectie schuift bewust een seam (max 32px) over de vorige */
        var seam = /fl-corner-seam|fl-cta|fl-pulse|fl-why/.test(kids[a].e.className + ' ' + kids[b].e.className);
        if (seam && oy <= 40) continue;
        out.overlaps.push({ a: label(kids[a].e), b: label(kids[b].e), ox: Math.round(ox), oy: Math.round(oy) });
        if (out.overlaps.length >= 15) break;
      }
    }
  }
  /* raakvlakken */
  var taps = main.querySelectorAll('a[href], button, input, select, textarea, [role=button], [role=radio], [role=tab], summary');
  for (i = 0; i < taps.length; i++) {
    e = taps[i]; if (!visible(e)) continue; if (inProse(e)) continue;
    cs = getComputedStyle(e); if (cs.position === 'fixed') continue;
    rect = e.getBoundingClientRect(); if (rect.width === 0) continue;
    /* een invoerveld in een hoge box: de box is het raakvlak */
    if ((e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') && e.parentNode && e.parentNode.getBoundingClientRect().height >= 44) continue;
    /* een absoluut ::before van 44px is een bewust vergroot raakvlak (zie custom-plus.html) */
    var pb = getComputedStyle(e, '::before'); var hitH = rect.height;
    var hitW = rect.width;
    if (pb.position === 'absolute' && pb.content !== 'none') { hitH = Math.max(hitH, parseFloat(pb.height) || 0); hitW = Math.max(hitW, parseFloat(pb.width) || 0); }
    if (hitH < 40 || hitW < 40) { if (out.smallTargets.length < 20) out.smallTargets.push({ el: label(e), w: Math.round(rect.width), h: Math.round(rect.height), text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) }); }
  }
  return JSON.stringify(out);
})()`;

/* ---------- hoofdlus ---------- */
async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars'] });
  const report = { base: BASE, widths: WIDTHS, pages: [] };
  let cdp = null;
  try {
    const res = await fetch('http://127.0.0.1:' + chrome.port + '/json/new?about:blank', { method: 'PUT' });
    const target = await res.json();
    cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    for (const route of ROUTES) {
      const page = { route, results: {} };
      for (const width of WIDTHS) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 2, mobile: true });
        const loaded = cdp.once('Page.loadEventFired');
        await cdp.send('Page.navigate', { url: BASE + route });
        await Promise.race([loaded, new Promise((r) => setTimeout(r, 15000))]);
        await new Promise((r) => setTimeout(r, 900));
        const ev = await cdp.send('Runtime.evaluate', { expression: MEASURE, awaitPromise: true, returnByValue: true });
        const data = JSON.parse(ev.result.value);
        page.results[width] = data;
        if (SHOTS && width === SHOT_WIDTH) {
          /* lazy afbeeldingen eerst laden, anders staan er lege vlakken op de schermafbeelding */
          await cdp.send('Runtime.evaluate', { expression: "(async()=>{var imgs=[].slice.call(document.querySelectorAll('img[loading=lazy]'));imgs.forEach(function(i){i.loading='eager'});await Promise.race([Promise.all(imgs.map(function(i){return i.decode().catch(function(){})})),new Promise(function(r){setTimeout(r,5000)})]);return imgs.length})()", awaitPromise: true }, 20000);
          /* in stukken van anderhalf scherm: één lange afbeelding is niet meer te lezen */
          const CH = 1300; const total = Math.min(data.docH, 16000); const base = (route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\//g, '-'));
          page.shots = [];
          for (let y = 0, n = 1; y < total; y += CH, n++) {
            const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 72, captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(CH, total - y), scale: width > 600 ? 0.6 : 0.8 } }, 60000);
            const name = base + '-' + width + '-' + String(n).padStart(2, '0') + '.jpg';
            writeFileSync(join(OUT, name), Buffer.from(shot.data, 'base64'));
            page.shots.push(join('scripts', '.mobile-audit', name));
          }
        }
      }
      report.pages.push(page);
      const flat = WIDTHS.map((w) => { const d = page.results[w]; return w + ': ' + (d.overflowX > 0 ? 'OVERLOOP ' + d.overflowX + 'px ' : '') + 'buiten ' + d.outside.length + ', gebroken ' + d.broken.length + ', clip ' + d.clipped.length + ', overlap ' + d.overlaps.length + ', klein ' + d.smallTargets.length + ', tiny ' + d.tinyText.length; });
      process.stdout.write(route + '\n   ' + flat.join('\n   ') + '\n');
    }
  } finally {
    if (cdp) cdp.close();
    await chrome.kill();
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  process.stdout.write('rapport: scripts/.mobile-audit/report.json\n');
}

main().catch((e) => { console.error('mobile-audit: ' + (e && e.stack || e)); process.exit(1); });
