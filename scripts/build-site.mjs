/* build-site.mjs — bouwt de statische, indexeerbare site uit custom-plus.html
 *
 * WAAROM DIT BESTAAT
 * custom-plus.html is één document van ~1,7 MB met alle twaalf pagina's erin,
 * geschreven in het Engels, dat zichzelf met JavaScript naar het Nederlands
 * vertaalt en met hashroutes (#/services) tussen pagina's wisselde. Voor een
 * bezoeker werkte dat prima. Voor Google was het één URL met twaalf <h1>'s in
 * een taal die de bezoeker nooit te zien kreeg, en dus precies één
 * zoekresultaat, hoe goed de teksten ook waren.
 *
 * Deze generator draait dat om. Per route schrijft hij een echt HTML bestand op
 * een echt pad (/diensten, /waarom-china, ...) dat alleen de markup van díe
 * pagina bevat, in het Nederlands, met een eigen title, description, canonical
 * en JSON-LD. De gedeelde CSS, JavaScript, fonts en afbeeldingen gaan naar
 * losse bestanden die over alle pagina's heen gecachet worden.
 *
 * custom-plus.html blijft de enige plek waar je bewerkt. Alles wat hier
 * uitkomt is wegwerpbaar en staat in .gitignore: Netlify draait dit bij elke
 * deploy opnieuw.
 *
 * Draaien:  node scripts/build-site.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'custom-plus.html');

/* ------------------------------------------------------------------ routes */

/* Nederlandse paden. De sleutel is het pad zoals het in de URL staat, page is
 * het id van de <div class="fl-page"> in de markup. Deze tabel moet gelijk
 * blijven aan de `pages` map in custom-plus.html — staat er hier een pad dat
 * de router niet kent, dan valt die route bij het laden terug op de homepage.
 * Uitzondering: routes met staticPage bestaan alleen hier (sectie 6c); die
 * melden zich bij de router via body[data-static-page].
 *
 * `content` noemt de contentbestanden waar de pagina uit opgebouwd wordt; de
 * sitemap leidt daar de datum van de laatste wijziging uit af (sectie 9). */
const ROUTES = [
  { path: '/',                  page: 'page-home',      seo: 'page-home',      prio: '1.0', changefreq: 'weekly',  content: ['home', 'scope-quiz'] },
  { path: '/diensten',          page: 'page-services',  seo: 'page-services',  prio: '0.9', changefreq: 'monthly', content: ['services'] },
  { path: '/ecommerce',         page: 'page-ecommerce', seo: 'page-ecommerce', prio: '0.8', changefreq: 'monthly', content: ['ecommerce', 'sectors'] },
  { path: '/relatiegeschenken', page: 'page-gifting',   seo: 'page-gifting',   prio: '0.8', changefreq: 'monthly', content: ['gifting'] },
  { path: '/waarom-china',      page: 'page-why',       seo: 'page-why',       prio: '0.8', changefreq: 'monthly', content: ['why-china'] },
  { path: '/faq',               page: 'page-faq',       seo: 'page-faq',       prio: '0.7', changefreq: 'monthly', content: ['faq'] },
  { path: '/over-ons',          page: 'page-trust',     seo: 'page-trust',     prio: '0.7', changefreq: 'monthly', content: ['trust'] },
  { path: '/begrippen',         page: 'page-glossary',  seo: 'page-glossary',  prio: '0.6', changefreq: 'monthly', content: ['glossary'] },
  { path: '/hulpmiddelen',      page: 'page-resources', seo: 'page-resources', prio: '0.6', changefreq: 'monthly', content: ['resources', 'downloads'] },
  { path: '/contact',           page: 'page-contact',   seo: 'page-contact',   prio: '0.9', changefreq: 'monthly', content: ['contact', 'scope-quiz'] },
  { path: '/blog',              page: 'page-blog',      seo: 'page-blog',      prio: '0.7', changefreq: 'weekly',  content: ['blog', 'blog-index'] },
  { path: '/privacy',           page: 'page-privacy',   seo: 'page-privacy',   prio: '0.3', changefreq: 'yearly',  content: ['privacy'], staticPage: true },
  /* /zoeken is bewust geen sitemapregel: een zoekresultatenpagina hoort niet in
   * de index, die krijgt hieronder noindex mee. */
  { path: '/zoeken',            page: 'page-search',    seo: 'page-search',    noindex: true },
  /* 404.html staat in de root: Netlify pakt dat bestand automatisch op voor
   * elk pad dat niet bestaat en geeft het met status 404 terug. */
  { path: '/404',               page: 'page-404',       seo: 'page-404',       noindex: true, staticPage: true, file: '404.html' },
];

const SITE = (process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://customplus.nl')
  .trim().replace(/\/+$/, '');

/* ------------------------------------------------------- bron uit elkaar halen */

const src = readFileSync(SOURCE, 'utf8');

function slice(open, close, from, label) {
  const a = src.indexOf(open, from || 0);
  if (a < 0) throw new Error('build-site: "' + open + '" niet gevonden (' + label + ')');
  const b = src.indexOf(close, a + open.length);
  if (b < 0) throw new Error('build-site: "' + close + '" niet gevonden (' + label + ')');
  return { inner: src.slice(a + open.length, b), start: a, end: b + close.length };
}

const styleBlock = slice('<style>', '</style>', 0, 'css');
const headInner = src.slice(src.indexOf('<head>') + 6, styleBlock.start);
const scriptBlock = slice('<script>', '</script>', styleBlock.end, 'app js');
const bodyInner = src.slice(src.indexOf('<body>') + 6, scriptBlock.start);
const afterScript = src.slice(scriptBlock.end, src.lastIndexOf('</body>'));

let css = styleBlock.inner;
const js = scriptBlock.inner;

/* ------------------------------------------------------------- schrijfhelpers */

const written = [];
function out(rel, data) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  written.push([rel, typeof data === 'string' ? Buffer.byteLength(data) : data.length]);
}
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* De i18n-engine in de browser leest node.nodeValue en krijgt dus ontsleutelde
 * tekst; de woordenboeksleutels zijn daarop gebaseerd ("Baby & child", niet
 * "Baby &amp; child"). Hier lezen we ruwe HTML, dus moeten we eerst decoderen
 * voordat we opzoeken — anders missen we elke tekst met een &-teken erin. */
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, body) ? ENTITIES[body] : all;
  });
}

/* ------------------------------------------------------------------- 1. fonts */

/* De vier fontgewichten stonden als base64 in de CSS: ~72 KB die elke pagina
 * opnieuw over de lijn trok en die de browser nooit apart kon cachen. */
let fontCount = 0;
css = css.replace(
  /@font-face\{([^}]*?)src:url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)([^}]*)\}/g,
  (_m, before, b64, after) => {
    const weight = (before.match(/font-weight:(\d+)/) || [null, 'regular'])[1];
    const name = 'hanken-grotesk-' + weight + '.woff2';
    out('assets/fonts/' + name, Buffer.from(b64, 'base64'));
    fontCount++;
    return '@font-face{' + before + 'src:url(/assets/fonts/' + name + ')' + after + '}';
  }
);
if (fontCount !== 4) throw new Error('build-site: ' + fontCount + ' fonts geextraheerd, 4 verwacht');

/* ------------------------------------------------------------ 2. afbeeldingen */

/* Eén ingebedde JPEG van 386 KB (de pulse-achtergrond) was in zijn eentje meer
 * dan de helft van het paginagewicht. */
let imgCount = 0;
css = css.replace(
  /url\(['"]?data:image\/(jpe?g|png|webp);base64,([A-Za-z0-9+/=]+)['"]?\)/g,
  (_m, kind, b64) => {
    const ext = kind === 'png' ? 'png' : kind === 'webp' ? 'webp' : 'jpg';
    const name = 'css-bg-' + (++imgCount) + '.' + ext;
    out('images/' + name, Buffer.from(b64, 'base64'));
    return 'url(/images/' + name + ')';
  }
);

/* Overgang tussen documenten. Elke route is nu een eigen bestand, dus de
 * paginawissel is een gewone navigatie; browsers die dit ondersteunen
 * animeren hem, de rest springt gewoon direct. */
css += '\n@view-transition{navigation:auto}\n' +
  '@media (prefers-reduced-motion: reduce){@view-transition{navigation:none}}\n';

/* ------------------------------------------- 3. woordenboek uit de JavaScript */

const i18nMatch = js.match(/\n(\s*)var I18N = (\{[\s\S]*?\});\n/);
if (!i18nMatch) throw new Error('build-site: "var I18N = {...}" niet gevonden in de app-JS');
const I18N = JSON.parse(i18nMatch[2]);
const NL = I18N.nl;
if (!NL) throw new Error('build-site: geen nl-woordenboek gevonden');

/* De markup wordt hieronder naar het Nederlands gebakken, dus vanaf dat moment
 * is Nederlands de brontaal. De woordenboeken voor de andere talen moeten dus
 * op de Nederlandse tekst gesleuteld worden in plaats van op de Engelse. Engels
 * wordt daarmee gewoon een doeltaal als alle andere. */
const enOfNl = new Map();
for (const [en, nl] of Object.entries(NL)) if (!enOfNl.has(nl)) enOfNl.set(nl, en);

/* Niet alle zichtbare tekst komt uit de markup: de app bouwt zelf ook labels,
 * knoppen en meldingen op uit Engelse literalen in de code, die net als vroeger
 * door i18nT() heen gaan. Voor die strings blijft Engels dus de sleutel. Het
 * Nederlandse woordenboek dat we meesturen bevat daarom precies die literalen
 * en niets meer — 142 regels in plaats van het hele boek. */
const jsWithoutDict = js.replace(i18nMatch[0], '\n');
const jsLiterals = new Set();
for (const re of [/'((?:[^'\\\n]|\\.)*)'/g, /"((?:[^"\\\n]|\\.)*)"/g]) {
  for (const m of jsWithoutDict.matchAll(re)) {
    jsLiterals.add(m[1].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
}
const NL_INLINE = {};
for (const lit of jsLiterals) if (NL[lit] != null) NL_INLINE[lit] = NL[lit];

/* Zou een Nederlandse vertaling zelf ook een Engelse sleutel zijn met een
 * ándere vertaling, dan zou de i18n-pass over de al Nederlandse markup die
 * tekst opnieuw omzetten. Dat is er nu niet, maar als het er ooit inkomt moet
 * de build dat melden en niet stilletjes de tekst verminken. */
const collisions = Object.entries(NL).filter(([, nl]) => NL[nl] != null && NL[nl] !== nl);
if (collisions.length) {
  console.warn('build-site: LET OP ' + collisions.length
    + ' vertaling(en) zijn zelf ook een Engelse sleutel: '
    + collisions.slice(0, 5).map((c) => JSON.stringify(c[1])).join(', '));
}

/* De andere talen krijgen twee sleutelruimtes in één bestand: de Nederlandse
 * markup (nl -> doeltaal) en de Engelse literalen uit de code (en -> doeltaal). */
const dicts = { en: {} };
for (const [en, nl] of Object.entries(NL)) if (nl !== en) dicts.en[nl] = en;
for (const code of ['de', 'fr', 'es']) {
  const target = I18N[code] || {};
  const d = {};
  for (const [nl, en] of enOfNl) {
    const v = target[en];
    if (typeof v === 'string' && v && v !== nl) d[nl] = v;
  }
  for (const lit of jsLiterals) {
    const v = target[lit];
    if (typeof v === 'string' && v && d[lit] == null) d[lit] = v;
  }
  dicts[code] = d;
}
for (const [code, d] of Object.entries(dicts)) out('assets/i18n/' + code + '.json', JSON.stringify(d));

/* ------------------------------------------------------- 4. content inlezen */

/* 'seo' staat hier bewust niet bij: de titels en omschrijvingen komen uit
 * content/seo-nl.json en worden verderop apart naar content/nl/seo.json
 * geschreven, zodat de <head> en de app dezelfde tekst tonen. */
const CONTENT_FILES = ['global', 'home', 'services', 'ecommerce', 'why-china', 'faq', 'trust',
  'glossary', 'resources', 'contact', 'search', 'scope-quiz', 'downloads', 'sectors',
  'gifting', 'blog', 'privacy'];
const CONTENT = {};
for (const name of CONTENT_FILES) {
  const f = join(ROOT, 'content', name + '.json');
  CONTENT[name] = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
}
const ckGet = (path) => path.split('.').reduce((cur, k) => (cur == null ? cur : cur[k]), CONTENT);

/* Nederlandse kopie van de contentbestanden. De runtime haalt deze op zolang de
 * taal Nederlands is, zodat applyContentKeys() dezelfde tekst terugschrijft als
 * hieronder in de markup gebakken wordt — anders zie je bij het laden heel even
 * de Engelse bron doorflitsen. sectors.json heeft al per taal een eigen veld en
 * blijft daarom ongemoeid. */
const translateTree = (v) => {
  if (typeof v === 'string') return NL[v] || v;
  if (Array.isArray(v)) return v.map(translateTree);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = translateTree(val);
    return o;
  }
  return v;
};
for (const name of CONTENT_FILES) {
  out('content/nl/' + name + '.json',
    JSON.stringify(name === 'sectors' ? CONTENT[name] : translateTree(CONTENT[name])));
}

/* -------------------------------------- 5. markup: inhoud invullen + vertalen */

/* data-ck invullen doen we vóór de tekstvertaling, precies zoals de browser het
 * doet: eerst de contentwaarde in het element, dan de i18n-pass eroverheen.
 * Omdat we hier meteen de Nederlandse contentwaarde pakken, vallen die twee
 * stappen voor deze elementen samen. */
let ckFilled = 0, ckSkipped = 0;
function fillContentKeys(html) {
  return html.replace(
    /(<([a-zA-Z0-9-]+)\b[^<>]*\sdata-ck="([^"]+)"[^<>]*>)([\s\S]*?)(<\/\2>)/g,
    (all, open, tag, key, inner, close) => {
      const val = ckGet(key);
      if (typeof val !== 'string' || val === '') { ckSkipped++; return all; }
      /* Elementen met eigen markup ernaast (icoon plus label) markeren met een
       * data-ck-label kind waar de tekst hoort; die laten we met rust, want de
       * browser vult daar alleen dat kind. Idem voor rich text met ** accenten
       * en voor alles wat al geneste elementen bevat. */
      if (/data-ck-label/.test(inner) || /data-ck-rich/.test(open) || /</.test(inner)) {
        ckSkipped++; return all;
      }
      ckFilled++;
      return open + escText(NL[val] || val) + close;
    }
  );
}

/* Een kleine tokenizer over de HTML. Genoeg voor dit doel: we hoeven alleen
 * tekstnodes en twee attributen te raken, niet de hele boom te herbouwen. We
 * slaan hetzelfde over als de i18n-engine in de browser doet: script, style,
 * svg en alles met data-no-i18n. */
const SKIP_TAGS = new Set(['script', 'style', 'svg']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);

function findTagEnd(html, lt) {
  let q = null;
  for (let k = lt + 1; k < html.length; k++) {
    const c = html[k];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '>') return k;
  }
  return html.length - 1;
}

function transformMarkup(html) {
  const parts = [];
  const stack = [];
  let skipDepth = 0;
  let i = 0;
  let textHits = 0, attrHits = 0, textMiss = 0;

  const translateText = (chunk) => {
    if (skipDepth > 0 || !chunk.trim()) return chunk;
    const key = decodeEntities(chunk);
    const hit = NL[key];
    if (hit == null) { textMiss++; return chunk; }
    textHits++;
    return escText(hit);
  };

  const translateAttrs = (raw) => {
    let o = raw;
    for (const attr of ['placeholder', 'aria-label']) {
      o = o.replace(new RegExp('(\\s' + attr + '=")([^"]*)(")'), (all, a, val, c) => {
        const t = NL[decodeEntities(val)];
        if (t == null) return all;
        attrHits++;
        return a + escAttr(t) + c;
      });
    }
    return o;
  };

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { parts.push(translateText(html.slice(i))); break; }
    if (lt > i) parts.push(translateText(html.slice(i, lt)));

    if (html.startsWith('<!--', lt)) {
      const e = html.indexOf('-->', lt);
      const end = e < 0 ? html.length : e + 3;
      parts.push(html.slice(lt, end));
      i = end;
      continue;
    }
    const gt = findTagEnd(html, lt);
    const raw = html.slice(lt, gt + 1);
    const m = raw.match(/^<\/?\s*([a-zA-Z0-9-]+)/);
    const tag = m ? m[1].toLowerCase() : '';
    const closing = raw[1] === '/';
    const selfClosing = raw.endsWith('/>') || VOID.has(tag);

    if (closing) {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === tag) {
          /* alles wat hierboven nog openstond is impliciet gesloten */
          for (let j = stack.length - 1; j >= k; j--) if (stack[j].skip) skipDepth--;
          stack.length = k;
          break;
        }
      }
      parts.push(raw);
    } else {
      const skipHere = SKIP_TAGS.has(tag) || /\sdata-no-i18n(?=[\s=>/])/.test(raw);
      parts.push(skipDepth === 0 && !skipHere ? translateAttrs(raw) : raw);
      if (!selfClosing) {
        stack.push({ tag: tag, skip: skipHere });
        if (skipHere) skipDepth++;
      }
    }
    i = gt + 1;
  }
  return { html: parts.join(''), textHits: textHits, attrHits: attrHits, textMiss: textMiss };
}

const bodyResult = transformMarkup(fillContentKeys(bodyInner));
const afterResult = transformMarkup(fillContentKeys(afterScript));

/* --------------------------------------------- 6. pagina's uit de body knippen */

/* De shell is alles buiten de twaalf pagina's: navigatie, footer, modals. Elke
 * gegenereerde pagina krijgt de shell plus precies één .fl-page terug. */
const pageBlocks = new Map();
let shellHead = '', shellTail = '';
{
  const html = bodyResult.html;
  const re = /<div class="fl-page" id="(page-[a-z-]+)"[^>]*>/g;
  const marks = [];
  let m;
  while ((m = re.exec(html))) marks.push({ id: m[1], start: m.index, afterOpen: m.index + m[0].length });
  if (marks.length !== 12) throw new Error('build-site: ' + marks.length + " pagina's gevonden, 12 verwacht");
  const mainEnd = html.indexOf('</main>', marks[marks.length - 1].afterOpen);
  if (mainEnd < 0) throw new Error('build-site: </main> niet gevonden');
  for (let k = 0; k < marks.length; k++) {
    const end = k + 1 < marks.length ? marks[k + 1].start : mainEnd;
    pageBlocks.set(marks[k].id, html.slice(marks[k].start, end));
  }
  shellHead = html.slice(0, marks[0].start);
  shellTail = html.slice(mainEnd);
}

/* De <div class="fl-page" ... hidden> van de actieve pagina moet zichtbaar zijn
 * in het statische antwoord: verborgen tekst weegt bij Google structureel
 * lichter, en zonder JavaScript zou de pagina anders helemaal leeg zijn. */
const unhide = (block) => block.replace(/^(<div class="fl-page" id="page-[a-z-]+")\s+hidden/, '$1');

/* ------------------------------------------- 6b. inhoud vooraf uitschrijven */

/* Vier pagina's kregen hun inhoud uitsluitend van JavaScript: de begrippenlijst,
 * de veelgestelde vragen, de hulpmiddelen en de blogindex. In de HTML stonden
 * alleen lege containers. Google voert JavaScript uit, dus onzichtbaar was het
 * niet, maar het kostte wel drie dingen tegelijk:
 *   - de vier blogartikelen hadden nul interne links naar zich toe, want de
 *     kaarten met <a href="/blog/..."> werden pas in de browser gemaakt;
 *   - die vier pagina's hadden statisch rond de driehonderd woorden, terwijl de
 *     zoekwoorden waar ze op moeten scoren (MOQ, DFM, AQL) juist in de
 *     JavaScript-inhoud zaten;
 *   - alles wachtte op een tweede netwerkronde voordat er iets stond.
 * We schrijven diezelfde inhoud daarom hier al uit, met dezelfde klassen. De
 * app bouwt hem daarna interactief opnieuw op (die containers worden met
 * replaceChildren gevuld), dus er ontstaat geen dubbele tekst. */

function fillContainer(block, id, inner) {
  /* de containers zijn allemaal leeg in de bron: <div id="x" ...></div> */
  const re = new RegExp('(<(\\w+)[^<>]*\\sid="' + id + '"[^<>]*>)</\\2>');
  if (!re.test(block)) {
    console.warn('build-site: container #' + id + ' niet gevonden of niet leeg, inhoud overgeslagen');
    return block;
  }
  return block.replace(re, (all, open, tag) => open + inner + '</' + tag + '>');
}

const nl = (v) => (typeof v === 'string' ? (NL[v] || v) : v);

/* --- begrippenlijst --- */
const TERMS = ((CONTENT.glossary || {}).terms || []).filter((t) => t && t.term);
{
  const sorted = TERMS.slice().sort((a, b) => String(a.term).localeCompare(String(b.term)));
  const rows = sorted.map((t) => '<div class="fl-glossary__row" id="term-' + escAttr(t.id) + '">'
    + '<div class="fl-glossary__term"><strong>' + escText(t.term) + '</strong>'
    + '<span class="fl-glossary__full">' + escText(nl(t.full) || '') + '</span></div>'
    + '<p class="fl-glossary__def">' + escText(nl(t.def) || '') + '</p>'
    + (t.thresholds ? '<p class="fl-glossary__thresholds">' + escText(nl(t.thresholds)) + '</p>' : '')
    + (t.contextHref ? '<a class="fl-glossary__link" href="' + escAttr(t.contextHref) + '">'
        + escText(NL['See it in context'] || 'See it in context') + '</a>' : '')
    + '</div>').join('');
  pageBlocks.set('page-glossary', fillContainer(pageBlocks.get('page-glossary'), 'glossary-list', rows));
}

/* --- veelgestelde vragen --- */
const FAQ_ITEMS = ((CONTENT.faq || {}).items || []).filter((i) => i && i.q && i.a);
{
  const rows = FAQ_ITEMS.map((it) => '<details id="' + escAttr(it.id || '') + '">'
    + '<summary>' + escText(nl(it.q)) + '<span class="fl-faq__ind">+</span></summary>'
    + '<p class="fl-faq__a">' + escText(nl(it.a)) + '</p></details>').join('');
  pageBlocks.set('page-faq', fillContainer(pageBlocks.get('page-faq'), 'faq-list', rows));
}

/* --- hulpmiddelen --- */
{
  const items = ((CONTENT.resources || {}).items || []).filter((r) => r && r.title);
  const cards = items.map((r) => '<a class="fl-resources__card" href="' + escAttr(r.href || '/contact') + '">'
    + '<h2>' + escText(nl(r.title)) + '</h2><p>' + escText(nl(r.desc) || '') + '</p>'
    + '<span class="fl-resources__cta">' + escText(NL['Open the tool'] || 'Open the tool') + '</span></a>').join('');
  pageBlocks.set('page-resources', fillContainer(pageBlocks.get('page-resources'), 'resources-list', cards));
}

/* --- blogindex --- */
/* Dit is de belangrijkste van de vier: zonder deze kaarten heeft geen enkele
 * pagina een link naar een artikel, en zijn alle vier de artikelen weespagina's. */
const blogIndexPath = join(ROOT, 'content', 'blog-index.json');
const blogIndex = existsSync(blogIndexPath)
  ? (JSON.parse(readFileSync(blogIndexPath, 'utf8')).articles || [])
  : [];
{
  const pad3 = (n) => String(n).padStart(3, '0');
  const cards = blogIndex.map((a, i) => '<a class="fl-blog-card fl-bp-darkband" href="/blog/' + escAttr(a.slug) + '">'
    + '<span class="fl-blog-card__head">'
    + '<span class="fl-blog-card__num" data-no-i18n>' + pad3(i + 1) + '</span>'
    + '<span class="fl-blog-card__read" data-no-i18n>' + escText(String(a.readMin || '')) + ' min lezen</span>'
    + '</span><span class="fl-blog-card__stack">'
    + '<span class="fl-blog-card__meta"><span>' + escText(a.category || '') + '</span></span>'
    + '<span class="fl-blog-card__title">' + escText(a.title) + '</span>'
    + '<span class="fl-blog-card__dek">' + escText(a.dek || '') + '</span>'
    + '</span></a>').join('');
  pageBlocks.set('page-blog', fillContainer(pageBlocks.get('page-blog'), 'blog-list', cards));
}

/* ------------------------------------------ 6c. pagina's zonder bronmarkup */

/* Twee routes hebben geen .fl-page in custom-plus.html: de privacyverklaring
 * en de 404-pagina. Ze krijgen hier dezelfde omlijsting (shell, klassen,
 * animaties) als de andere pagina's. De router in de app kent ze niet; hij
 * leest daarom body[data-static-page] (zie rewriteJs) en behandelt ze verder
 * als elke andere pagina: titel uit content/nl/seo.json, geen eigen gedrag.
 *
 * De privacytekst staat in content/privacy.json en is, anders dan de overige
 * contentbestanden, meteen in het Nederlands geschreven: er is geen Engelse
 * bron om te vertalen, en juridische tekst hoort niet door een woordenboek.
 * content/nl/privacy.json wordt net als de rest gegenereerd (translateTree
 * laat Nederlandse tekst ongemoeid). Bij een taalwissel blijft deze pagina
 * dus Nederlands. */

/* Het contactadres dat de site zelf overal gebruikt (footer, mailto's). */
const SITE_EMAIL = 'steffan@customplus.nl';

/* Bedrijfsgegevens komen uitsluitend uit global.company; een leeg veld of een
 * [placeholder] blijft weg, zowel op de privacypagina als in de JSON-LD.
 * Het adres mag een losse regel zijn (adres) of een object met street,
 * postalCode, city en country. */
function companyInfo() {
  const c = (CONTENT.global || {}).company || {};
  const real = (v) => typeof v === 'string' && v.trim() !== '' && !/^\[/.test(v.trim());
  const pick = (...keys) => { for (const k of keys) if (real(c[k])) return c[k].trim(); return null; };
  let address = null, addressText = null;
  if (real(c.adres)) {
    address = c.adres.trim();
    addressText = address;
  } else {
    const a = (c.adres && typeof c.adres === 'object') ? c.adres : c;
    if (real(a.street) && real(a.city)) {
      address = { '@type': 'PostalAddress', streetAddress: a.street.trim(), addressLocality: a.city.trim(),
        addressCountry: real(a.country) ? a.country.trim() : 'NL' };
      if (real(a.postalCode)) address.postalCode = a.postalCode.trim();
      addressText = a.street.trim() + ', ' + ((real(a.postalCode) ? a.postalCode.trim() + ' ' : '') + a.city.trim());
    }
  }
  return {
    name: pick('name') || 'CUSTOM+',
    email: pick('email') || SITE_EMAIL,
    kvk: pick('kvk'),
    btw: pick('btw', 'vat'),
    address,
    addressText,
  };
}

function nlDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso || '';
  const maand = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'][d.getUTCMonth()];
  return d.getUTCDate() + ' ' + maand + ' ' + d.getUTCFullYear();
}

/* Dezelfde opbouw als de begrippen- en FAQ-pagina: pagehead, een tekstblok in
 * de leestypografie van de blog (fl-blog-body), en de afsluitende oproep. */
const CLOSING_CTA = (heading, href, label, dark) =>
  '  <section class="fl-section fl-corner-seam' + (dark ? ' fl-bp-darkband" style="background:var(--black); color:var(--white);"' : '" style="background:var(--white);"') + '>\n'
  + '    <div class="fl-container fl-reveal" style="display:flex; justify-content:space-between; align-items:center; gap:24px; flex-wrap:wrap;">\n'
  + '      <h2 class="fl-h2">' + escText(heading) + '</h2>\n'
  + '      <a class="fl-btn ' + (dark ? 'fl-btn-ghostwhite' : 'fl-btn-black') + '" href="' + escAttr(href) + '" data-magnetic>' + escText(label) + '</a>\n'
  + '    </div>\n'
  + '  </section>\n';

function privacyBlock() {
  const P = CONTENT.privacy || {};
  const co = companyInfo();
  const mail = '<a href="mailto:' + escAttr(co.email) + '">' + escText(co.email) + '</a>';
  /* {email} in de tekst wordt het echte contactadres, als link */
  const rich = (str) => escText(str).replace(/\{email\}/g, mail);
  const list = (items) => '<ul class="fl-blog-ul">' + items.map((it) => '<li>' + it + '</li>').join('') + '</ul>';
  const head = P.pagehead || {};
  const sections = (P.sections || []).map((sec) => {
    let html = '<h2 class="fl-blog-h2" id="' + escAttr(sec.id || '') + '">' + escText(sec.title || '') + '</h2>';
    for (const para of sec.paragraphs || []) html += '<p>' + rich(para) + '</p>';
    if (sec.id === 'verantwoordelijke') {
      /* alleen wat er echt in global.company staat; het mailadres is er altijd */
      const rows = [['Naam', escText(co.name)], ['Mail', mail], ['KVK', co.kvk && escText(co.kvk)],
        ['BTW', co.btw && escText(co.btw)], ['Adres', co.addressText && escText(co.addressText)]]
        .filter((r) => r[1]);
      html += list(rows.map((r) => r[0] + ': ' + r[1]));
    }
    if (Array.isArray(sec.items) && sec.items.length) html += list(sec.items.map(rich));
    for (const para of sec.after || []) html += '<p>' + rich(para) + '</p>';
    return html;
  }).join('\n');
  const cta = P.closingCta || {};
  return '<div class="fl-page" id="page-privacy">\n'
    + '  <section class="fl-pagehead fl-container is-ready-target">\n'
    + '    <span class="fl-kicker">' + escText(head.kicker || 'Privacy') + '</span>\n'
    + '    <h1><span class="fl-clip"><span>' + escText(head.heading || 'Privacyverklaring') + '</span></span></h1>\n'
    + '  </section>\n'
    + '  <section class="fl-container" style="padding-bottom:clamp(64px,9vw,128px);">\n'
    + (P.intro ? '    <p class="fl-lead fl-reveal">' + rich(P.intro) + '</p>\n' : '')
    + (P.updated ? '    <p class="fl-note" style="margin-top:18px;">Laatst bijgewerkt: <time datetime="'
        + escAttr(P.updated) + '">' + escText(nlDate(P.updated)) + '</time></p>\n' : '')
    + '    <div class="fl-blog-body" style="margin-top:36px;">\n' + sections + '\n    </div>\n'
    + '  </section>\n'
    + CLOSING_CTA(cta.heading || 'Vragen over je gegevens?', 'mailto:' + co.email, cta.cta || 'Mail ons', false)
    + '</div>\n';
}

/* De 404-pagina: NL, noindex, drie uitwegen en een zoekveld dat naar /zoeken
 * gaat. Het zoekveld heeft een eigen inline script omdat de app alleen het
 * zoekvenster in de navigatie kent; hetzelfde pad als daar (/zoeken/<term>). */
function notFoundBlock() {
  return '<div class="fl-page" id="page-404">\n'
    + '  <section class="fl-pagehead fl-container is-ready-target">\n'
    + '    <span class="fl-kicker">Fout 404</span>\n'
    + '    <h1>\n'
    + '      <span class="fl-clip"><span>Deze pagina bestaat niet.</span></span>\n'
    + '      <span class="fl-clip"><span class="sub">De link is verhuisd of verkeerd overgetypt.</span></span>\n'
    + '    </h1>\n'
    + '  </section>\n'
    + '  <section class="fl-container" style="padding-bottom:clamp(64px,9vw,128px);">\n'
    + '    <p class="fl-lead fl-reveal">Geen zorgen, alles staat er nog. Kies waar je verder wilt:</p>\n'
    + '    <div class="fl-stagger" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:28px;">\n'
    + '      <a class="fl-btn fl-btn-black" href="/" data-magnetic>Naar de homepage</a>\n'
    + '      <a class="fl-btn fl-btn-white" href="/diensten" data-magnetic>Bekijk de diensten</a>\n'
    + '      <a class="fl-btn fl-btn-white" href="/contact" data-magnetic>Neem contact op</a>\n'
    + '    </div>\n'
    + '    <form id="notfound-search" role="search" autocomplete="off" style="margin-top:40px; max-width:520px;">\n'
    + '      <label for="notfound-q" class="fl-kicker">Of zoek op de site</label>\n'
    + '      <div style="display:flex; gap:10px; margin-top:12px;">\n'
    + '        <input type="search" id="notfound-q" placeholder="Bijvoorbeeld MOQ, samples of AQL"'
    + ' style="flex:1; min-width:0; border:1px solid var(--line); border-radius:12px; padding:14px 18px; font:inherit; font-size:16px; background:var(--gray-f9);">\n'
    + '        <button type="submit" class="fl-btn fl-btn-black">Zoeken</button>\n'
    + '      </div>\n'
    + '    </form>\n'
    + '  </section>\n'
    + CLOSING_CTA('Zocht je iets specifieks?', '/contact', 'Vraag het ons direct', true)
    + '<script>(function(){var f=document.getElementById(\'notfound-search\');if(!f)return;'
    + 'f.addEventListener(\'submit\',function(e){e.preventDefault();'
    + 'var q=(document.getElementById(\'notfound-q\').value||\'\').trim();'
    + 'location.assign(q?\'/zoeken/\'+encodeURIComponent(q):\'/zoeken\');});})();</script>\n'
    + '</div>\n';
}

pageBlocks.set('page-privacy', privacyBlock());
pageBlocks.set('page-404', notFoundBlock());

/* ------------------------------------------ 7b. ontbrekende pagina-elementen */

/* Elke gegenereerde pagina bevat alleen zijn eigen .fl-page. Dat is precies de
 * bedoeling — twaalf pagina's in één document betekende twaalf <h1>'s en twaalf
 * URL's met identieke inhoud — maar de app is geschreven met de aanname dat
 * alle twaalf blokken in de DOM staan. Op ruim tachtig plekken haalt hij bij
 * het opstarten een element van een ándere pagina op en gebruikt dat meteen,
 * zonder null-controle. Zonder vangnet klapt de eerste de beste pagina eruit op
 * document.getElementById('stage-tabs').setAttribute(...), en dan stopt de rest
 * van het opstarten ook.
 *
 * Die tachtig plekken los afvangen zou tachtig kansen op een fout zijn in een
 * bestand waar meer sessies aan werken. In plaats daarvan geven we voor een id
 * dat aantoonbaar bij een andere pagina hoort een echt maar losgekoppeld
 * element terug, van hetzelfde soort als in de bron. Daar kun je alles op doen
 * wat de app doet — attributen zetten, kinderen toevoegen, luisteraars
 * koppelen, laten observeren — het komt alleen nooit in beeld. Geen proxy dus
 * en geen speciale gevallen: gewoon een element dat nergens hangt.
 *
 * De tabel hieronder wordt uit de markup zelf afgeleid, niet met de hand
 * bijgehouden: een nieuw element op een pagina staat er automatisch in. Een id
 * dat nergens in de markup voorkomt geeft nog steeds null, zodat bestaande
 * if(el) controles blijven werken zoals ze bedoeld zijn. */

const shellIds = new Set(Array.from(
  (shellHead + shellTail + afterResult.html).matchAll(/\sid="([A-Za-z0-9_-]+)"/g), (m) => m[1]));

/* We bewaren niet alleen wélke ids bij een pagina horen, maar ook hoe ze in
 * elkaar zitten. Dat is nodig omdat de app op sommige plekken twee elementen
 * van dezelfde pagina tegelijk gebruikt in een verhouding die moet kloppen:
 * wrap.insertBefore(iframe, notReady) werkt alleen als notReady echt een kind
 * van wrap is. Een losse plaatsvervanger per id zou daar alsnog op stuklopen,
 * dus geven we het skelet van de pagina mee: alleen de elementen met een id,
 * in dezelfde nesting, zonder inhoud. */
function idSkeleton(block) {
  const roots = [];
  const stack = [];              /* alle open elementen */
  const nodeStack = [];          /* alleen de open elementen mét id */
  let i = 0;
  while (i < block.length) {
    const lt = block.indexOf('<', i);
    if (lt < 0) break;
    if (block.startsWith('<!--', lt)) {
      const e = block.indexOf('-->', lt);
      i = e < 0 ? block.length : e + 3;
      continue;
    }
    const gt = findTagEnd(block, lt);
    const raw = block.slice(lt, gt + 1);
    const m = raw.match(/^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/);
    i = gt + 1;
    if (!m) continue;
    const tag = m[1].toLowerCase();
    if (raw[1] === '/') {
      for (let k = stack.length - 1; k >= 0; k--) {
        if (stack[k].tag === tag) {
          for (let j = stack.length - 1; j >= k; j--) if (stack[j].node) nodeStack.pop();
          stack.length = k;
          break;
        }
      }
      continue;
    }
    const idMatch = raw.match(/\sid="([A-Za-z0-9_-]+)"/);
    let node = null;
    if (idMatch && !shellIds.has(idMatch[1])) {
      node = [tag, idMatch[1], []];
      (nodeStack.length ? nodeStack[nodeStack.length - 1][2] : roots).push(node);
    }
    if (!(raw.endsWith('/>') || VOID.has(tag))) {
      stack.push({ tag, node });
      if (node) nodeStack.push(node);
    }
  }
  return roots;
}

const pageSkeletons = {};
for (const [key, block] of pageBlocks) {
  if (key.startsWith('__')) continue;
  const tree = idSkeleton(block);
  if (tree.length) pageSkeletons[key] = tree;
}
const MISSING_SHIM = '(function(){\n'
  + '  /* Zie scripts/build-site.mjs, sectie 7b. Elke pagina die niet in dit\n'
  + '     document zit, krijgt een leeg skelet van zijn eigen ids in dezelfde\n'
  + '     nesting. Losgekoppeld, dus onzichtbaar, maar wel een echte boom. */\n'
  + '  var SKELETONS = ' + JSON.stringify(pageSkeletons) + ';\n'
  + '  var byId = null;\n'
  + '  function build(){\n'
  + '    byId = {};\n'
  + '    Object.keys(SKELETONS).forEach(function(page){\n'
  + '      if(document.getElementById(page)) return; /* deze pagina staat er echt */\n'
  + '      (function walk(nodes, parent){\n'
  + '        nodes.forEach(function(n){\n'
  + '          var el = document.createElement(n[0]);\n'
  + '          el.id = n[1];\n'
  + '          if(parent) parent.appendChild(el);\n'
  + '          byId[n[1]] = el;\n'
  + '          walk(n[2], el);\n'
  + '        });\n'
  + '      })(SKELETONS[page], null);\n'
  + '    });\n'
  + '  }\n'
  + '  var real = document.getElementById.bind(document);\n'
  + '  document.getElementById = function(id){\n'
  + '    var el = real(id);\n'
  + '    if(el) return el;\n'
  + '    if(!byId) build();\n'
  + '    return byId[id] || null;\n'
  + '  };\n'
  + '})();\n';

/* ---------------------------------------------------------- 7. JS omschrijven */

function rewriteJs(source) {
  let s = source;
  const swap = (label, from, to, expect) => {
    const want = expect === undefined ? 1 : expect;
    const n = s.split(from).length - 1;
    if (n !== want) throw new Error('build-site: JS-patroon "' + label + '" ' + n + 'x gevonden, ' + want + ' verwacht');
    s = s.replace(from, to);
  };
  const swapSoft = (label, from, to) => {
    const n = s.split(from).length - 1;
    if (n !== 1) { console.warn('build-site: LET OP JS-patroon "' + label + '" ' + n + 'x gevonden, overgeslagen'); return; }
    s = s.replace(from, to);
  };

  /* Het woordenboek zat als literal in de app en woog 675 KB op elke pagina.
     Het staat nu als los bestand naast de site en wordt pas opgehaald als
     iemand echt van taal wisselt. */
  /* Het volledige woordenboek woog 675 KB op elke pagina. Nederlands houdt
     alleen de literalen uit de code over; de andere talen worden pas als los
     bestand opgehaald zodra iemand echt wisselt. */
  s = s.replace(i18nMatch[0], '\n' + i18nMatch[1] + 'var I18N = { nl: '
    + JSON.stringify(NL_INLINE) + ' };\n');

  /* Engels mag niet meer kortsluiten: de markup is nu Nederlands, dus ook naar
     het Engels toe is er een woordenboek nodig. */
  swap('i18nT geen kortsluiting',
    "    if(!str || currentLang === 'en') return str;",
    "    if(!str) return str;");

  /* Bij het laden staat de gekozen taal in localStorage, maar het woordenboek
     stond alleen in een los bestand dat setLang() ophaalde — en setLang() draait
     pas als iemand op een knop klikt. Wie in het Duits terugkwam, kreeg dus de
     onvertaalde bron te zien. Hier wachten we het woordenboek af vóórdat de
     eerste vertaalslag over de pagina gaat. */
  swap('woordenboek bij herladen',
    "    if(savedLang && LANGS.some(function(l){ return l.code === savedLang; })){ currentLang = savedLang; }\n  }catch(e){}",
    "    if(savedLang && LANGS.some(function(l){ return l.code === savedLang; })){ currentLang = savedLang; }\n"
    + "  }catch(e){}\n"
    + "  if(currentLang !== 'nl' && !I18N[currentLang]){\n"
    + "    I18N[currentLang] = await fetch('/assets/i18n/' + currentLang + '.json')\n"
    + "      .then(function(r){ return r.ok ? r.json() : {}; }).catch(function(){ return {}; });\n"
    + "  }");

  swap('setLang loader',
    "  function setLang(code){\n    if(!LANGS.some(function(l){ return l.code === code; })) return;\n    currentLang = code;",
    "  function setLang(code){\n"
    + "    if(!LANGS.some(function(l){ return l.code === code; })) return;\n"
    + "    if(code !== 'nl' && !I18N[code]){\n"
    + "      /* woordenboeken staan als los bestand naast de pagina en worden pas\n"
    + "         opgehaald als iemand daadwerkelijk van taal wisselt */\n"
    + "      fetch('/assets/i18n/' + code + '.json').then(function(r){ return r.ok ? r.json() : {}; })\n"
    + "        .then(function(d){ I18N[code] = d || {}; setLang(code); })\n"
    + "        .catch(function(){ I18N[code] = {}; setLang(code); });\n"
    + "      return;\n"
    + "    }\n"
    + "    currentLang = code;");

  /* cache:'no-store' is hier weg: elke pagina haalde zestien JSON-bestanden
     op die de browser nooit mocht bewaren, ook niet van de vorige pagina.
     Netlify stuurt voor /content/* nu max-age=300 met must-revalidate, dus
     een CMS-wijziging is binnen vijf minuten overal zichtbaar en tussentijds
     komt alles uit de cache. */
  swap('content pad',
    "    return fetch('content/' + name + '.json', { cache:'no-store', signal: controller ? controller.signal : undefined })",
    "    /* Nederlands is de brontaal van de site geworden: de markup wordt zo\n"
    + "       gegenereerd en de woordenboeken voor de andere talen zijn op de\n"
    + "       Nederlandse tekst gesleuteld. De content moet daar dus bij passen,\n"
    + "       ook als de bezoeker Duits kijkt — anders staat er Engels in de\n"
    + "       elementen en vindt de vertaalslag daar niets voor terug. */\n"
    + "    return fetch('/content/nl/' + name + '.json', { signal: controller ? controller.signal : undefined })");

  swap('blog geen no-store',
    "    return fetch(path, { cache:'no-store', signal: controller ? controller.signal : undefined })",
    "    return fetch(path, { signal: controller ? controller.signal : undefined })");

  /* sectors.json weegt 40 KB en wordt alleen door de sectorzoeker op
     /ecommerce gelezen (CONTENT.sectors); op de andere pagina's ging hij
     voor niets over de lijn. */
  swap('sectors alleen op ecommerce',
    "  function fetchContentFile(name){\n",
    "  function fetchContentFile(name){\n"
    + "    /* sectors.json leest alleen de sectorzoeker op /ecommerce; elders zou\n"
    + "       hij (40 KB) voor niets opgehaald worden — zie scripts/build-site.mjs */\n"
    + "    if(name === 'sectors' && document.body.getAttribute('data-route') !== '/ecommerce') return Promise.resolve({});\n");

  /* De privacypagina en de 404-pagina bestaan alleen in de generator (sectie
     6c). De router zou ze als onbekend pad naar page-home terugbrengen en
     daarmee de echte pagina verbergen; body[data-static-page] zegt welke
     pagina het document zelf is. */
  swap('router kent statische pagina',
    "    return { page: pages[h] || 'page-home', param:null, anchor:anchor };",
    "    return { page: pages[h] || document.body.getAttribute('data-static-page') || 'page-home', param:null, anchor:anchor };");

  /* De statische Organization-node (orgLd hieronder) bevat de bedrijfsgegevens
     uit global.company; de app schreef daar bij het opstarten een kalere
     versie overheen, zodat Google (die JavaScript uitvoert) die gegevens
     nooit zag. Zacht, want deze regel wordt in de bron ook door anderen
     bewerkt: niet gevonden is een waarschuwing, geen mislukte build. */
  swapSoft('organization node blijft statisch',
    "  if(ldOrgEl) ldOrgEl.textContent = JSON.stringify(buildOrgLd());",
    "  /* de statische Organization-node uit build-site.mjs is vollediger\n"
    + "     (bedrijfsgegevens uit global.company) en blijft staan */");

  /* De statische titels eindigen op " | CUSTOM+"; applyPageMeta plakt het merk
     er zelf achter en gebruikte daar een ander scheidingsteken. Twee vormen van
     dezelfde titel geeft een tab die verspringt zodra de app draait. */
  swap('titelsuffix',
    "  var TITLE_SUFFIX = ' — CUSTOM+';",
    "  var TITLE_SUFFIX = ' | CUSTOM+';");

  swap('home unhide weg',
    "  var pageHomeEl = document.getElementById('page-home');\n  if(pageHomeEl) pageHomeEl.hidden = false;",
    "  /* Niet meer nodig: elke route is een eigen bestand waarin de eigen pagina\n"
    + "     al zichtbaar in de HTML staat, ook zonder JavaScript. */");

  return s;
}

/* De Lighthouse-run van 2026-09-21 wees 86 KB (JS) en 25 KB (CSS) potentiële
 * winst aan onder "unminified-javascript"/"unminified-css" — de build minifte
 * tot dan toe niets. esbuild.transformSync doet hier alleen minify:true
 * (whitespace/comments weg, identifiers verkort): bewust GEEN target/
 * transpileren, de syntax moet exact ES5 blijven zoals de rest van de site.
 * Faalt esbuild (bijvoorbeeld een syntaxfout die het niet kan parsen), dan
 * stopt de build met een duidelijke foutmelding — nooit stilletjes de rauwe,
 * ongeminifiede versie serveren alsof minificatie gelukt is. */
const rawCssBytes = Buffer.byteLength(css);
const rawJsRaw = MISSING_SHIM + rewriteJs(js);
const rawJsBytes = Buffer.byteLength(rawJsRaw);
let minifiedCss, minifiedJs;
try {
  minifiedCss = transformSync(css, { loader: 'css', minify: true }).code;
} catch (err) {
  console.error('build-site: FOUT — esbuild kon de CSS niet minifyen, build gestopt.');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
try {
  minifiedJs = transformSync(rawJsRaw, { loader: 'js', minify: true }).code;
} catch (err) {
  console.error('build-site: FOUT — esbuild kon de JavaScript niet minifyen, build gestopt.');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
}
css = minifiedCss;
const appJs = minifiedJs;

/* Een hash in de bestandsnaam laat de browser deze twee een jaar bewaren en
   toch meteen de nieuwe versie pakken zodra er iets verandert. De hash gaat
   over de GEMINIFIEDE inhoud, zodat de bestandsnaam echt overeenkomt met wat
   er straks geserveerd wordt. Oude gehashte bestanden gooien we eerst weg,
   anders groeit de map bij elke build. */
const hash8 = (str) => createHash('sha256').update(str).digest('hex').slice(0, 8);
const CSS_NAME = 'app.' + hash8(css) + '.css';
const JS_NAME = 'app.' + hash8(appJs) + '.js';
const assetsDir = join(ROOT, 'assets');
if (existsSync(assetsDir)) {
  for (const f of readdirSync(assetsDir)) {
    if (/^app\.[0-9a-f]{8}\.(css|js)$/.test(f) && f !== CSS_NAME && f !== JS_NAME) {
      rmSync(join(assetsDir, f));
    }
  }
}
out('assets/' + JS_NAME, appJs);
out('assets/' + CSS_NAME, css);

/* ------------------------------------------------------------ 8. de pagina's */

const seoNlFile = join(ROOT, 'content', 'seo-nl.json');
const SEO_NL = existsSync(seoNlFile) ? JSON.parse(readFileSync(seoNlFile, 'utf8')) : {};
const OG_IMAGE = SITE + '/images/og-share.jpg';
const FAVICON = (headInner.match(/<link rel="icon"[^>]*>/) || [''])[0];

/* Oude gedeelde links en bladwijzers wijzen nog naar hashroutes (#/services).
 * De server ziet het deel na de # nooit, dus dat moet de pagina zelf opvangen.
 * Dit staat bewust boven de stylesheet, zodat het omleiden gebeurt voordat de
 * verkeerde pagina in beeld komt. */
const LEGACY_HASH_SCRIPT = '<script>(function(){var m={"/services":"/diensten","/why-china":"/waarom-china",'
  + '"/gifting":"/relatiegeschenken","/trust":"/over-ons","/glossary":"/begrippen",'
  + '"/resources":"/hulpmiddelen","/search":"/zoeken","/scope":"/","/ecommerce":"/ecommerce",'
  + '"/faq":"/faq","/contact":"/contact","/blog":"/blog","/":"/"};'
  + 'var h=location.hash;if(h.indexOf("#/")!==0)return;var b=h.slice(1),a="",i=b.indexOf("#");'
  + 'if(i>=0){a=b.slice(i);b=b.slice(0,i);}var best=null;'
  + 'for(var k in m){if(b===k||(k!=="/"&&b.indexOf(k+"/")===0)){if(!best||k.length>best.length)best=k;}}'
  + 'if(!best)return;var t=m[best]+b.slice(best.length)+(best==="/scope"?"#scope":a);'
  + 'if(t!==location.pathname)location.replace(t);})();</script>\n';

/* De app werkt de titel en omschrijving bij zodra de route binnen het document
 * verandert, en leest daarvoor content/nl/seo.json. Dat bestand vullen we uit
 * dezelfde bron als de statische <head>, anders zou de app de zorgvuldig
 * geschreven titel bij het opstarten weer overschrijven met een andere. */
{
  const runtimeSeo = {};
  for (const [key, v] of Object.entries(SEO_NL)) {
    runtimeSeo[key] = {
      titleBase: String(v.title || '').replace(/\s*\|\s*CUSTOM\+$/, ''),
      description: v.description || '',
    };
  }
  out('content/nl/seo.json', JSON.stringify(runtimeSeo));
}

/* Kritieke boven-de-vouw-CSS, met de hand overgenomen uit de bestaande
 * css-string (niets verzonnen, alleen een subset van al bestaande regels):
 * basistypografie/kleuren zodat er geen onopgemaakte witte flits optreedt
 * terwijl de preload hieronder nog laadt, de vaste navigatiebalk (.fl-nav)
 * en de .fl-pulse hero-band met zijn achtergrondfoto — dat laatste maakt de
 * LCP-achtergrond meteen ontdekbaar in de eerste HTML (lcp-discovery-insight).
 * Blijft bewust klein: dit is geen kopie van de hele CSS, dus mag een paar
 * overbodige spaties bevatten (leesbaarheid weegt hier zwaarder dan de
 * laatste bytes). */
const CRITICAL_CSS = `
:root{ --black:#000; --white:#fff; --green:#1B6E45; --gray-a7:#a7a7a7; --ease-fl: cubic-bezier(.83,0,.17,1); }
html{ -webkit-text-size-adjust:100%; }
body{ margin:0; background:var(--white); }
.fl{ font-family:'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif; background:var(--white); color:var(--black); font-size:16px; line-height:1.5; -webkit-font-smoothing:antialiased; overflow-x:clip; min-height:100vh; }
.fl-container{ max-width:1600px; margin-inline:auto; padding-inline:clamp(20px,4vw,64px); }
.fl-nav{ position:sticky; top:0; z-index:100; background:var(--white); transition:transform .5s var(--ease-fl), box-shadow .3s; margin-top:-8px; border-radius:8px 8px 0 0; }
.fl-nav.is-hidden{ transform:translateY(-100%); }
.fl-nav.is-stuck{ box-shadow:0 1px 0 rgba(0,0,0,.07); }
.fl-nav .fl-container{ display:flex; align-items:center; justify-content:space-between; height:76px; gap:24px; }
.fl-wordmark{ font-weight:600; font-size:19px; letter-spacing:.02em; display:flex; align-items:baseline; }
.fl-wordmark em{ font-style:normal; color:var(--green); }
.fl-pulse{ background:linear-gradient(rgba(0,0,0,.58),rgba(0,0,0,.7)), url('/images/pulse-band.jpg') center 30%/cover no-repeat, var(--black); color:var(--white); position:relative; overflow:hidden; height:clamp(320px,60vh,640px); }
.fl-pulse__label{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; letter-spacing:.44px; text-transform:uppercase; color:var(--gray-a7); text-align:center; padding-inline:20px; pointer-events:none; }
`.trim() + '\n' + `
/* Blueprint-modus (dark-mode-insight): de knop die data-mode="blueprint" op
 * <html> zet zit in het grote appbundle-script, dat nu defer laadt en dus pas
 * ná deze kritieke CSS uitvoert. Zonder deze override zag een terugkerende
 * blueprint-gebruiker (localStorage cp_blueprint=1) eerst kort het lichte
 * thema voordat de deferred JS het attribuut zet: een zichtbare flits. Deze
 * waarden zijn letterlijk overgenomen uit custom-plus.html (:root[data-mode="blueprint"],
 * rond regel 58-66) — alleen het subset dat CRITICAL_CSS hierboven ook echt
 * gebruikt (--black/--white/--green/--gray-a7). Dit lost alleen de flits op;
 * de onderliggende "met de hand gekopieerde CSS" opzet van CRITICAL_CSS zelf
 * blijft ongewijzigd, dat is een apart punt. */
:root[data-mode="blueprint"]{ --bp-surface:#0a1420; --bp-ink:#8fd8ea; --black:var(--bp-ink); --white:var(--bp-surface); --gray-a7:#6f9aa8; --green:#22d3ee; color-scheme:dark; }
`.trim();

const missingSeo = [];
/* headFor() bouwt de <head> voor elke pagina, inclusief de performancefix
 * (kritieke CSS inline, niet-blokkerende CSS via preload+onload, defer op
 * het script). Blogartikelen gebruiken 'm ook: die hebben geen entry in
 * SEO_NL (elk artikel heeft een eigen titel/omschrijving uit content/blog/*.json,
 * niet uit de statische SEO-lijst), dus route.seo ontbreekt daar bewust en
 * geeft route.title/route.description direct mee in plaats van een lookup.
 * Ze zetten ook route.ogType ('article' i.p.v. 'website') en route.image (het
 * eigen artikelbeeld i.p.v. de vaste og-share.jpg met bekende afmetingen —
 * daarom laten we og:image:width/height weg zodra route.image gezet is). */
function headFor(route, extraLd) {
  let title;
  let desc;
  if (route.seo) {
    const seo = SEO_NL[route.seo] || {};
    if (!seo.title || !seo.description) missingSeo.push(route.path);
    title = seo.title || 'CUSTOM+';
    desc = seo.description || '';
  } else {
    title = route.title || 'CUSTOM+';
    desc = route.description || '';
  }
  const url = SITE + route.path;
  const robots = route.noindex ? 'noindex, follow' : 'index, follow';
  const ogType = route.ogType || 'website';
  const image = route.image || OG_IMAGE;
  return '<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<meta name="robots" content="' + robots + '">\n'
    + '<title>' + escAttr(title) + '</title>\n'
    + '<meta name="description" content="' + escAttr(desc) + '">\n'
    + '<link rel="canonical" href="' + escAttr(url) + '" id="fl-canonical">\n'
    + '<meta name="theme-color" content="#000000">\n'
    + '<meta property="og:type" content="' + ogType + '">\n'
    + '<meta property="og:site_name" content="CUSTOM+">\n'
    + '<meta property="og:locale" content="nl_NL">\n'
    + '<meta property="og:title" content="' + escAttr(title) + '" id="og-title">\n'
    + '<meta property="og:description" content="' + escAttr(desc) + '" id="og-description">\n'
    + '<meta property="og:url" content="' + escAttr(url) + '" id="og-url">\n'
    + '<meta property="og:image" content="' + escAttr(image) + '" id="og-image">\n'
    + (route.image ? '' : '<meta property="og:image:width" content="1731">\n<meta property="og:image:height" content="909">\n')
    + '<meta name="twitter:card" content="summary_large_image">\n'
    + '<meta name="twitter:title" content="' + escAttr(title) + '" id="twitter-title">\n'
    + '<meta name="twitter:description" content="' + escAttr(desc) + '" id="twitter-description">\n'
    + '<meta name="twitter:image" content="' + escAttr(image) + '" id="twitter-image">\n'
    + FAVICON + '\n'
    + '<link rel="alternate" type="application/rss+xml" title="CUSTOM+ Field notes" href="/feed.xml">\n'
    + LEGACY_HASH_SCRIPT
    + '<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/hanken-grotesk-400.woff2" crossorigin>\n'
    + '<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/hanken-grotesk-600.woff2" crossorigin>\n'
    + '<style>' + CRITICAL_CSS + '</style>\n'
    /* render-blocking-insight (2810ms geschatte winst): beide stylesheets waren
     * gewone blocking <link rel="stylesheet">-tags in <head>. Het preload+onload
     * patroon laadt ze non-blocking en schakelt pas naar rel=stylesheet zodra ze
     * binnen zijn; <noscript> is de terugval voor bezoekers/crawlers zonder JS. */
    + '<link rel="preload" as="style" href="/assets/' + CSS_NAME + '" onload="this.onload=null;this.rel=\'stylesheet\'">\n'
    + '<noscript><link rel="stylesheet" href="/assets/' + CSS_NAME + '"></noscript>\n'
    + '<link rel="preload" as="style" href="/chat/chat.css" onload="this.onload=null;this.rel=\'stylesheet\'">\n'
    + '<noscript><link rel="stylesheet" href="/chat/chat.css"></noscript>\n'
    + extraLd;
}

/* JSON-LD: één Organization node die op elke pagina identiek is, plus per
 * pagina een broodkruimel. Beide staan statisch in de HTML zodat ook crawlers
 * die geen JavaScript draaien ze zien. Velden die nog niet ingevuld zijn laten
 * we weg in plaats van te verzinnen. */
const realValue = (v) => typeof v === 'string' && v.trim() !== '' && !/^\[/.test(v.trim());

/* De oprichter als Person: op de organisatie als founder, op elk blogartikel
 * als auteur. Naam uit trust.json (de pagina Over ons), link naar die pagina. */
function founderLd() {
  const founder = (CONTENT.trust || {}).founder || {};
  if (!realValue(founder.name)) return null;
  const person = { '@type': 'Person', name: founder.name.trim(), url: SITE + '/over-ons' };
  if (realValue(founder.linkedin)) person.sameAs = [founder.linkedin.trim()];
  return person;
}

function orgLd() {
  const co = companyInfo();
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': SITE + '/#organization',
    name: co.name,
    url: SITE + '/',
    email: co.email,
    description: (SEO_NL['page-home'] || {}).description || '',
    areaServed: 'NL',
  };
  /* Geen logo: er is geen logobestand. Het woordmerk is gewone tekst met CSS,
   * de favicon is een plusteken en og-share.jpg is een deelafbeelding met
   * productfoto's — dat als logo opgeven zou niet kloppen. */
  const founder = founderLd();
  if (founder) org.founder = founder;
  /* KVK, btw en adres uitsluitend uit global.company, en alleen als ze gevuld
   * zijn; de app schreef deze node vroeger bij het opstarten leeg (zie de
   * zachte swap in rewriteJs). */
  if (co.kvk) org.identifier = [{ '@type': 'PropertyValue', name: 'KVK', value: co.kvk }];
  if (co.btw) org.vatID = co.btw;
  if (co.address) org.address = co.address;
  return org;
}

function breadcrumbLd(route) {
  if (route.path === '/') return null;
  const seo = SEO_NL[route.seo] || {};
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: seo.crumb || seo.title || route.path, item: SITE + route.path },
    ],
  };
}

/* De FAQ staat in content/faq.json en werd tot nu toe alleen door JavaScript
 * opgebouwd. Als FAQPage in de statische HTML kan Google er rich results van
 * maken, en staat de tekst er ook zonder JavaScript. */
function faqLd() {
  const items = ((CONTENT.faq || {}).items || []).filter((it) => it && it.q && it.a);
  if (!items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: NL[it.q] || it.q,
      acceptedAnswer: { '@type': 'Answer', text: NL[it.a] || it.a },
    })),
  };
}

/* Zoekmachine kan met deze twee méér dan een blauwe link tonen: een zoekvak
 * onder het merkresultaat, en een begrippenlijst die als set herkend wordt. */
function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE + '/#website',
    url: SITE + '/',
    name: 'CUSTOM+',
    inLanguage: 'nl-NL',
    publisher: { '@id': SITE + '/#organization' },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: SITE + '/zoeken/{search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
}

function glossaryLd() {
  if (!TERMS.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': SITE + '/begrippen#termset',
    name: 'Begrippen bij produceren in China',
    url: SITE + '/begrippen',
    inLanguage: 'nl-NL',
    hasDefinedTerm: TERMS.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': SITE + '/begrippen#term-' + t.id,
      name: t.term,
      alternateName: nl(t.full) || undefined,
      description: nl(t.def) || undefined,
      inDefinedTermSet: SITE + '/begrippen#termset',
    })),
  };
}

function blogLd() {
  if (!blogIndex.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': SITE + '/blog#blog',
    url: SITE + '/blog',
    name: 'CUSTOM+ Field notes',
    inLanguage: 'nl-NL',
    publisher: { '@id': SITE + '/#organization' },
    blogPost: blogIndex.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.dek || undefined,
      datePublished: a.date || undefined,
      url: SITE + '/blog/' + a.slug,
      author: founderLd() || undefined,
    })),
  };
}

/* De drie commerciële pagina's beschrijven elk een dienst, niet zomaar een
 * tekstpagina. Zonder dit is er geen enkel machineleesbaar signaal over wát
 * er verkocht wordt en aan wie. */
const SERVICE_LD = {
  'page-services': { name: 'Productontwikkeling en productie in China', type: 'Productontwikkeling' },
  'page-ecommerce': { name: 'Productontwikkeling voor ecommerce merken', type: 'Productontwikkeling' },
  'page-gifting': { name: 'Relatiegeschenken op maat laten produceren', type: 'Relatiegeschenken' },
};
function serviceLd(route) {
  const spec = SERVICE_LD[route.page];
  if (!spec) return null;
  const seo = SEO_NL[route.seo] || {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': SITE + route.path + '#service',
    name: spec.name,
    serviceType: spec.type,
    description: seo.description || '',
    provider: { '@id': SITE + '/#organization' },
    areaServed: { '@type': 'Country', name: 'Nederland' },
    url: SITE + route.path,
    inLanguage: 'nl-NL',
  };
}

const ldScript = (obj, id) => (obj
  ? '<script type="application/ld+json"' + (id ? ' id="' + id + '"' : '') + '>'
    + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>\n'
  : '');

for (const route of ROUTES) {
  const block = pageBlocks.get(route.page);
  if (!block) throw new Error('build-site: markup voor ' + route.page + ' ontbreekt');
  let ld = ldScript(orgLd(), 'ld-organization') + ldScript(breadcrumbLd(route));
  if (route.path === '/') ld += ldScript(websiteLd());
  if (route.page === 'page-faq') ld += ldScript(faqLd());
  if (route.page === 'page-glossary') ld += ldScript(glossaryLd());
  if (route.page === 'page-blog') ld += ldScript(blogLd());
  ld += ldScript(serviceLd(route));

  const html = '<!DOCTYPE html>\n<html lang="nl">\n<head>\n'
    + headFor(route, ld)
    + '</head>\n<body data-route="' + escAttr(route.path) + '"'
    + (route.staticPage ? ' data-static-page="' + escAttr(route.page) + '"' : '') + '>\n'
    + shellHead + unhide(block) + shellTail + afterResult.html
    + '\n<script src="/assets/' + JS_NAME + '" defer></script>\n</body>\n</html>\n';

  out(route.file || (route.path === '/' ? 'index.html' : route.path.slice(1) + '/index.html'), html);
}

/* ------------------------------------------------- 8b. blogartikelpagina's */

/* Elk artikel krijgt een eigen bestand op /blog/<slug>. De <head> met titel,
 * omschrijving, canonical en BlogPosting is volledig statisch, en de tekst van
 * het artikel staat er ook al in: de JavaScript bouwt dezelfde inhoud daarna
 * interactief opnieuw op (inhoudsopgave, ankerknoppen, leesvinkjes), maar wie
 * geen JavaScript draait of alleen de HTML leest, ziet het hele artikel. */

const blogDir = join(ROOT, 'content', 'blog');
const blogFiles = existsSync(blogDir)
  ? readdirSync(blogDir).filter((f) => f.endsWith('.json')).sort()
  : [];
const articles = blogFiles
  .map((f) => JSON.parse(readFileSync(join(blogDir, f), 'utf8')))
  .filter((a) => a && a.slug && a.title)
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

function slugifyHeading(text, used) {
  let id = String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'sectie';
  const base = id;
  let n = 2;
  while (used[id]) { id = base + '-' + n; n++; }
  used[id] = true;
  return id;
}

/* Zelfde blokken en klassenamen als blogMakeBlock() in de app, zodat de pagina
 * er ook zonder JavaScript uitziet zoals hij hoort. */
function renderBlocks(art) {
  const used = {};
  const parts = [];
  for (const b of art.body || []) {
    if (!b || !b.type) continue;
    if (b.type === 'p') parts.push('<p>' + escText(b.text || '') + '</p>');
    else if (b.type === 'h2') {
      parts.push('<h2 class="fl-blog-h2" id="' + escAttr(slugifyHeading(b.text || '', used)) + '">'
        + escText(b.text || '') + '</h2>');
    } else if (b.type === 'h3') parts.push('<h3 class="fl-blog-h3">' + escText(b.text || '') + '</h3>');
    else if (b.type === 'ul') {
      parts.push('<ul class="fl-blog-ul">'
        + (b.items || []).map((it) => '<li>' + escText(it) + '</li>').join('') + '</ul>');
    } else if (b.type === 'quote') {
      parts.push('<blockquote class="fl-blog-quote">' + escText(b.text || '') + '</blockquote>');
    } else if (b.type === 'stat') {
      /* stats zonder bron worden niet getoond, dat is de afspraak in de app */
      if (!b.source || !String(b.source).trim()) continue;
      parts.push('<div class="fl-blog-stat">'
        + '<span class="fl-blog-stat__value">' + escText(b.value || '') + '</span>'
        + '<span class="fl-blog-stat__label">' + escText(b.label || '') + '</span>'
        + '<span class="fl-blog-stat__source">' + escText(b.source) + '</span></div>');
    } else if (b.type === 'img' && b.src) {
      const width = (b.width === 'wide' || b.width === 'full') ? b.width : 'text';
      parts.push('<figure class="fl-blog-fig fl-blog-fig--' + width + '">'
        + '<img src="' + escAttr(b.src) + '" alt="' + escAttr(b.caption || '') + '" loading="lazy">'
        + '<figcaption>' + escText(b.caption || '')
        + (b.credit ? '<span class="credit">' + escText(b.credit) + '</span>' : '')
        + '</figcaption></figure>');
    }
  }
  return parts.join('\n');
}

/* nlDate() staat in sectie 6c, de privacypagina gebruikt hem ook. */

const blogBlock = pageBlocks.get('page-blog');
for (const art of articles) {
  const url = SITE + '/blog/' + art.slug;
  const image = art.ogImage || art.photo || null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: art.title,
    description: art.dek || '',
    datePublished: art.date || undefined,
    dateModified: art.updated || art.date || undefined,
    inLanguage: 'nl-NL',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    /* de artikelen zijn door één persoon geschreven; een Organization als
       auteur zegt Google niets over wie er achter de tekst zit */
    author: founderLd() || { '@type': 'Organization', name: 'CUSTOM+', '@id': SITE + '/#organization' },
    publisher: { '@id': SITE + '/#organization' },
  };
  if (image) ld.image = image.startsWith('http') ? image : SITE + '/' + image.replace(/^\/+/, '');

  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog' },
      { '@type': 'ListItem', position: 3, name: art.title, item: url },
    ],
  };

  /* headFor() bouwt de rest van de <head> (meta/OG/canonical/preload+onload
   * CSS/kritieke CSS) precies zoals de gewone pagina's hierboven; alleen
   * title/description/og:type/og:image wijken af van het SEO_NL-lookuppad,
   * dus die geven we hier direct mee (zie de route.seo-check in headFor()). */
  const title = art.title + ' | CUSTOM+';
  const desc = (art.dek || '').slice(0, 158);
  const blogRoute = {
    path: '/blog/' + art.slug,
    title,
    description: desc,
    ogType: 'article',
    image: ld.image || OG_IMAGE,
  };
  const head = headFor(blogRoute, ldScript(orgLd(), 'ld-organization') + ldScript(ld) + ldScript(crumbs));

  /* de indexweergave verbergen en het artikel in de artikelweergave zetten:
     precies de toestand die blogActivate(slug) straks zelf ook maakt */
  const staticArticle = '<article class="fl-blog-art"><div class="fl-container">'
    + '<p class="fl-kicker">' + escText(nlDate(art.date)) + '</p>'
    + '<h1>' + escText(art.title) + '</h1>'
    + (art.dek ? '<p class="fl-lead">' + escText(art.dek) + '</p>' : '')
    + '<div class="fl-blog-body">' + renderBlocks(art) + '</div>'
    + '</div></article>';

  /* De blogindex zit ook in dit bestand maar staat verborgen: op een
   * artikelpagina kom je er nooit, want terug naar de index is een gewone
   * navigatie naar /blog. Zijn <h1> zou hier dus een tweede kop op de pagina
   * zijn, naast die van het artikel zelf. Die degraderen we tot een div. */
  let indexPart = blogBlock.slice(0, blogBlock.indexOf('<div id="blog-article-view"'));
  const restPart = blogBlock.slice(blogBlock.indexOf('<div id="blog-article-view"'));
  indexPart = indexPart
    .replace('<div id="blog-index-view">', '<div id="blog-index-view" hidden>')
    .replace(/<h1(\s[^>]*)?>/g, '<div class="fl-blog-idx-heading"$1>')
    .replace(/<\/h1>/g, '</div>');
  const pageHtml = (indexPart + restPart)
    .replace('<div id="blog-article-view" hidden></div>',
      '<div id="blog-article-view">' + staticArticle + '</div>');

  out('blog/' + art.slug + '/index.html',
    '<!DOCTYPE html>\n<html lang="nl">\n<head>\n' + head + '</head>\n'
    + '<body data-route="/blog/' + escAttr(art.slug) + '">\n'
    + shellHead + unhide(pageHtml) + shellTail + afterResult.html
    + '\n<script src="/assets/' + JS_NAME + '" defer></script>\n</body>\n</html>\n');
}

/* -------------------------------------------------------------- 9. sitemap */

const today = new Date().toISOString().slice(0, 10);
const blogArticles = articles;

/* lastmod moet de laatste inhoudelijke wijziging zijn, niet de builddatum:
 * Netlify bouwt bij elke deploy alles opnieuw, en een sitemap waarin alle
 * pagina's altijd "vandaag" gewijzigd zijn, zegt Google niets meer.
 *
 * Per bestand kijken we naar de laatste commit (git log) en naar de mtime.
 * Op Netlify is de mtime de kloontijd van de build en dus waardeloos: daar
 * telt alleen git. Lokaal kan een bestand nieuwer zijn dan zijn laatste
 * commit (nog niet gecommit werk); dan wint de mtime. Kent git het bestand
 * niet (nieuw, of geen repo), dan blijft de mtime over. */
function gitDate(rel) {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cs', '--', rel],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
  } catch {
    return null;
  }
}
function fileDate(rel) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) return null;
  const mtime = statSync(file).mtime.toISOString().slice(0, 10);
  const committed = gitDate(rel);
  if (process.env.NETLIFY) return committed || mtime;
  return committed && committed > mtime ? committed : mtime;
}
const newestDate = (dates) => dates.filter(Boolean).sort().pop() || today;

/* Elke pagina bestaat uit de bron (custom-plus.html), de gedeelde delen (de
 * shell uit global.json, de titels uit seo-nl.json) en zijn eigen
 * contentbestanden; de jongste daarvan is de lastmod. De blogindex verandert
 * ook als er een artikel bijkomt of wordt bijgewerkt. */
const SHARED_DATES = [fileDate('custom-plus.html'), fileDate('content/seo-nl.json'), fileDate('content/global.json')];
function routeLastmod(route) {
  const own = (route.content || []).map((name) => fileDate('content/' + name + '.json'));
  if (route.page === 'page-blog') own.push(...blogArticles.map((a) => a.updated || a.date || null));
  return newestDate(SHARED_DATES.concat(own));
}

const urls = ROUTES.filter((r) => !r.noindex).map((r) =>
  '  <url><loc>' + escText(SITE + r.path) + '</loc><lastmod>' + routeLastmod(r)
  + '</lastmod><changefreq>' + r.changefreq + '</changefreq><priority>' + r.prio + '</priority></url>');
for (const a of blogArticles) {
  /* een artikel wijzigt alleen als de auteur dat zegt (updated) of bij
     publicatie; de datum van de omliggende pagina doet er hier niet toe */
  urls.push('  <url><loc>' + escText(SITE + '/blog/' + a.slug) + '</loc><lastmod>'
    + escText(a.updated || a.date || today) + '</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>');
}
out('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<!-- Automatisch gegenereerd door scripts/build-site.mjs. Niet met de hand aanpassen. -->\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');

/* Het CMS, het klantportaal, de beheerconsole en de factuurmodule staan op
 * hetzelfde domein maar horen niet in Google. De zoekpagina evenmin: een
 * zoekresultatenpagina is geen bestemming. */
out('robots.txt', 'User-agent: *\n'
  + 'Allow: /\n'
  + 'Disallow: /admin/\n'
  + 'Disallow: /portal/\n'
  + 'Disallow: /portal.html\n'
  + 'Disallow: /beheer.html\n'
  + 'Disallow: /factuur.html\n'
  + 'Disallow: /custom-plus.html\n'
  + 'Disallow: /zoeken\n\n'
  + 'Sitemap: ' + SITE + '/sitemap.xml\n');

/* ---------------------------------------------------------------- rapportage */

const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const pages = written.filter((w) => w[0].endsWith('.html'));
console.log('build-site: ' + pages.length + " pagina's, " + fontCount + ' fonts, ' + imgCount + ' css-afbeelding(en)');
console.log('build-site: data-ck ingevuld ' + ckFilled + ', overgeslagen ' + ckSkipped);
console.log('build-site: tekstnodes vertaald ' + (bodyResult.textHits + afterResult.textHits)
  + ', niet gevonden ' + (bodyResult.textMiss + afterResult.textMiss)
  + ', attributen ' + (bodyResult.attrHits + afterResult.attrHits));
console.log('build-site: app.css ' + kb(rawCssBytes) + ' ruw -> ' + kb(Buffer.byteLength(css)) + ' geminifieerd, '
  + 'app.js ' + kb(rawJsBytes) + ' ruw -> ' + kb(Buffer.byteLength(appJs)) + ' geminifieerd');
if (missingSeo.length) console.warn('build-site: LET OP geen seo-nl.json titel/description voor: ' + missingSeo.join(', '));
for (const w of pages) console.log('  ' + w[0].padEnd(30) + kb(w[1]));
