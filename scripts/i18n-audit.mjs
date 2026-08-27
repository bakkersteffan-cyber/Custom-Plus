#!/usr/bin/env node
/*
  scripts/i18n-audit.mjs — CUSTOM+ vertaal-audit (Node >= 18, geen dependencies).

  Vindt elke Engelse string die de site's i18n-walker (translateNode() in
  custom-plus.html) op enig moment als tekstnode of placeholder/aria-label
  attribuut te zien krijgt, en checkt of er voor nl/de/fr/es een vertaling in
  `var I18N = {...}` staat. Bron van elke kandidaat:
    - statische tekst in <body> (script/style/svg en data-no-i18n subtrees
      overgeslagen, exact zoals translateNode() dat doet)
    - placeholder/aria-label attributen in <body>
    - content/*.json stringwaarden die via data-ck in de pagina belanden
      (content/blog/*.json en content/blog-index.json bewust overgeslagen:
      artikelen zijn native-taal content, altijd data-no-i18n)
    - letterlijke argumenten van i18nT('...') aanroepen in de JS
    - letterlijke 3e argumenten van make(tag, cls, '...') aanroepen in de JS

  Sluit bewust uit (geen vertaalgat, geen bug):
    - `_`-genoemde sleutels in content-json (interne CMS-notities)
    - content/sectors.json (heeft een eigen en/nl bilingueel systeem, geen
      onderdeel van de I18N-dictionary — zie sectorLabel() in custom-plus.html)
    - content-paden die eindigen op `.name` (bedrijfs-/personennamen — die
      hoeven niet vertaald, i18nT()'s fallback op de brontekst is daar al
      precies goed)
    - kale acroniemen (AQL, DFM, FQC, IPQC, IQC, MOQ, NNN) als losse string
    - downloads.json#nnnTemplate/dfmChecklist/aqlChecklist (lange juridische/
      technische documenten — bewuste beslissing, geen automatische vertaling)

  Exit code 0 = geen gaten. Exit code 1 = gaten gevonden (bruikbaar in CI).
  Met --json schrijft dit script het volledige rapport ook als JSON naar
  stdout (na de leesbare samenvatting op stderr), voor verdere verwerking.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
var LANGS = ['nl', 'de', 'fr', 'es'];
var WANT_JSON = process.argv.includes('--json');

var VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
var SKIP_TAGS = new Set(['script', 'style', 'svg']);
var BARE_ACRONYM = /^(AQL|DFM|FQC|IPQC|IQC|MOQ|NNN)$/;

function readFile(p) { return fs.readFileSync(p, 'utf8'); }

/* ---------- 1. HTML/JS ophalen, script-blokken apart houden ---------- */
var html = readFile(path.join(ROOT, 'custom-plus.html'));
var scriptRe = /<script([^>]*)>([\s\S]*?)<\/script>/g;
var scriptSpans = [...html.matchAll(scriptRe)].map((mm) => ({
  start: mm.index,
  end: mm.index + mm[0].length,
  attrs: mm[1] || '',
  body: mm[2],
}));
var jsAll = scriptSpans
  .filter((s) => s.attrs.indexOf('src=') < 0 && s.attrs.indexOf('application/') < 0)
  .map((s) => s.body)
  .join('\n');

var htmlNoJs = html;
for (var i = scriptSpans.length - 1; i >= 0; i--) {
  var s = scriptSpans[i];
  htmlNoJs = htmlNoJs.slice(0, s.start) + htmlNoJs.slice(s.end);
}
/* HTML-commentaar rendert nooit als tekst — nooit een vertaalkandidaat */
htmlNoJs = htmlNoJs.replace(/<!--[\s\S]*?-->/g, '');

/* ---------- 2. minimalistische HTML-tagwalker (geen dependency) ---------- */
/* Loopt alleen door <body>; bootst translateNode()'s regels exact na:
   sla script/style/svg en elk element met data-no-i18n over, verzamel
   platte tekst tussen tags en placeholder/aria-label attributen. */
function walkStaticHtml(source) {
  var texts = [];
  var attrsFound = [];
  var tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  var tagMatches = [...source.matchAll(tagRe)];
  var pos = 0;
  var skipStack = []; // per open element: true als dit element of een voorouder overgeslagen wordt
  var tagStack = [];
  var inBody = false;

  function parseAttrs(raw) {
    var out = {};
    var attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s>]+))?/g;
    [...raw.matchAll(attrRe)].forEach((am) => {
      var name = am[1].toLowerCase();
      var val = am[3] !== undefined ? am[3] : am[4] !== undefined ? am[4] : (am[2] || '');
      out[name] = val;
    });
    return out;
  }
  function currentlySkipped() {
    for (var k = 0; k < skipStack.length; k++) if (skipStack[k]) return true;
    return false;
  }
  function decodeEntities(str) {
    return str
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  }

  tagMatches.forEach((tm) => {
    var chunkEnd = tm.index;
    if (chunkEnd > pos) {
      var raw = source.slice(pos, chunkEnd);
      if (inBody && !currentlySkipped() && raw.trim()) {
        texts.push(decodeEntities(raw).trim());
      }
    }
    var closing = tm[1] === '/';
    var tag = tm[2].toLowerCase();
    var attrsRaw = tm[3] || '';
    var selfClose = tm[4] === '/';
    pos = tm.index + tm[0].length;

    if (tag === 'body' && !closing) inBody = true;

    if (!closing) {
      var attrs = parseAttrs(attrsRaw);
      var willSkip = SKIP_TAGS.has(tag) || Object.prototype.hasOwnProperty.call(attrs, 'data-no-i18n');
      if (inBody && !currentlySkipped() && !willSkip) {
        ['placeholder', 'aria-label'].forEach((a) => {
          if (attrs[a] && attrs[a].trim()) attrsFound.push({ attr: a, value: decodeEntities(attrs[a]), tag });
        });
      }
      if (!VOID_TAGS.has(tag) && !selfClose) {
        tagStack.push(tag);
        skipStack.push(willSkip);
      }
    } else {
      // sluit tot en met de matchende open-tag (best effort, well-formed html verwacht)
      var idx = tagStack.lastIndexOf(tag);
      if (idx >= 0) {
        tagStack.length = idx;
        skipStack.length = idx;
      }
    }
  });
  return { texts, attrsFound };
}

var walked = walkStaticHtml(htmlNoJs);

/* ---------- 3. content/*.json kandidaten ---------- */
var TECH_KEYS = new Set([
  'href', 'slug', 'src', 'icon', 'photo', 'ogImage', 'url', 'lang', 'ctaPath', 'key', 'id',
  'date', 'updated', 'seriesPart', 'seriesTotal', 'relatedService', 'relatedTerms',
  'num', 'generated', 'words', 'readMin', 'type', 'pct', 'width', 'category', 'logo',
  'contextHref', 'scopeCheckLink', 'breakdownLink', 'readMoreLink', 'placeholder',
  'toggle', 'loadingLabel',
]);
var EXCLUDE_FILES = new Set(['blog-index.json', 'sectors.json']);
var EXCLUDE_EXACT_PATHS = new Set(['nnnTemplate', 'dfmChecklist', 'aqlChecklist']);

var URLISH = /^(#|https?:\/\/|mailto:|images\/|\/)/i;
var HEXCOLOR = /^#[0-9a-fA-F]{3,8}$/;
var PURE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var PURE_NUM = /^-?\d+(\.\d+)?%?$/;
var ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isTechnicalValue(v) {
  if (typeof v !== 'string') return true;
  var s = v.trim();
  if (!s) return true;
  if (URLISH.test(s)) return true;
  if (HEXCOLOR.test(s)) return true;
  if (PURE_NUM.test(s)) return true;
  if (ISO_DATE.test(s)) return true;
  if (BARE_ACRONYM.test(s)) return true;
  if (PURE_SLUG.test(s) && s.indexOf(' ') < 0 && s.length <= 40) return true;
  return false;
}

var contentCandidates = []; // { text, file, path }
var flaggedTemplates = [];  // { text, file, path } — bewust buiten scope

function walkJson(node, file, pathStr) {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    Object.keys(node).forEach((k) => {
      if (k.charAt(0) === '_') return;
      walkJson(node[k], file, pathStr ? pathStr + '.' + k : k);
    });
  } else if (Array.isArray(node)) {
    node.forEach((it, idx) => walkJson(it, file, pathStr + '[' + idx + ']'));
  } else if (typeof node === 'string') {
    if (EXCLUDE_EXACT_PATHS.has(pathStr)) {
      flaggedTemplates.push({ text: node, file, path: pathStr });
      return;
    }
    if (pathStr.endsWith('.name')) return;
    if (!isTechnicalValue(node)) contentCandidates.push({ text: node, file, path: pathStr });
  }
}

var contentDir = path.join(ROOT, 'content');
var contentFiles = fs.readdirSync(contentDir).filter((f) => f.endsWith('.json') && !EXCLUDE_FILES.has(f));
contentFiles.forEach((f) => {
  var data = JSON.parse(readFile(path.join(contentDir, f)));
  walkJson(data, f, '');
});

/* ---------- 4. i18nT()/make() letterlijke aanroepen in de JS ---------- */
function unescapeJsLiteral(str) {
  return str.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
}
var i18ntRe = /i18nT\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g;
var i18ntCalls = [...jsAll.matchAll(i18ntRe)].map((mm) => unescapeJsLiteral(mm[2]));

var makeRe = /make\(\s*(?:'[^']*'|"[^"]*"|null)\s*,\s*(?:'[^']*'|"[^"]*"|null)\s*,\s*(['"])((?:\\.|(?!\1).)*)\1/g;
var makeCalls = [...jsAll.matchAll(makeRe)]
  .map((mm) => unescapeJsLiteral(mm[2]))
  .filter((lit) => lit.trim());

/* ---------- 5. I18N dictionary uit de HTML halen ---------- */
var i18nMatch = html.match(/var I18N = (\{[\s\S]*?\});\n/);
if (!i18nMatch) {
  console.error('FOUT: `var I18N = {...};` niet gevonden in custom-plus.html');
  process.exit(2);
}
var I18N = JSON.parse(i18nMatch[1]);

/* ---------- 6. kandidatenset opbouwen + cross-referencen ---------- */
function looksTranslatable(str) {
  var t = str.trim();
  if (t.length < 2) return false;
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(t)) return false;
  if (BARE_ACRONYM.test(t)) return false;
  return true;
}

var candidates = new Map(); // text -> Set(sources)
function add(text, source) {
  if (!text || !text.trim() || !looksTranslatable(text)) return;
  if (!candidates.has(text)) candidates.set(text, new Set());
  candidates.get(text).add(source);
}
walked.texts.forEach((t) => add(t, 'html-text'));
walked.attrsFound.forEach((a) => add(a.value, 'html-attr:' + a.attr + '@' + a.tag));
contentCandidates.forEach((c) => add(c.text, 'content-json:' + c.file + '#' + c.path));
i18ntCalls.forEach((str) => add(str, 'i18nT-call'));
makeCalls.forEach((str) => add(str, 'make-literal'));

var missing = {};
LANGS.forEach((lang) => { missing[lang] = []; });
candidates.forEach((sources, text) => {
  LANGS.forEach((lang) => {
    if (!Object.prototype.hasOwnProperty.call(I18N[lang], text)) missing[lang].push(text);
  });
});

var missingSets = {};
LANGS.forEach((lang) => { missingSets[lang] = new Set(missing[lang]); });
var all4 = [...missingSets.nl].filter((t) => missingSets.de.has(t) && missingSets.fr.has(t) && missingSets.es.has(t));
var anyMissing = new Set();
LANGS.forEach((lang) => missing[lang].forEach((t) => anyMissing.add(t)));
var all4Set = new Set(all4);
var partial = [...anyMissing].filter((t) => !all4Set.has(t));

/* ---------- 7. rapport ---------- */
console.error('CUSTOM+ i18n-audit — ' + candidates.size + ' unieke kandidaatstrings gevonden.\n');
LANGS.forEach((lang) => {
  console.error('  ' + lang + ': ' + missing[lang].length + ' ontbrekend');
});
console.error('\n  ontbreekt in ALLE 4 talen: ' + all4.length);
console.error('  ontbreekt inconsistent (in sommige, niet alle talen): ' + partial.length);
if (flaggedTemplates.length) {
  console.error('\n  bewust buiten scope (juridische/technische templates): ' + flaggedTemplates.length);
}

if (all4.length) {
  console.error('\n=== ontbreekt in alle 4 talen ===');
  all4.sort().forEach((t) => console.error('  - ' + JSON.stringify(t.length > 90 ? t.slice(0, 90) + '…' : t)));
}
if (partial.length) {
  console.error('\n=== inconsistent tussen talen ===');
  partial.sort().forEach((t) => {
    var have = LANGS.filter((l) => !missingSets[l].has(t));
    var miss = LANGS.filter((l) => missingSets[l].has(t));
    console.error('  - ' + JSON.stringify(t) + '  (heeft: ' + have.join(',') + ' | mist: ' + miss.join(',') + ')');
  });
}

var clean = all4.length === 0 && partial.length === 0;
console.error('\n' + (clean ? 'Geen vertaalgaten gevonden.' : 'Er zijn vertaalgaten — zie hierboven.'));

if (WANT_JSON) {
  var out = {
    totalCandidates: candidates.size,
    missingPerLang: missing,
    missingInAll4: all4.sort(),
    partial: partial.sort().map((t) => ({
      text: t,
      have: LANGS.filter((l) => !missingSets[l].has(t)),
      missing: LANGS.filter((l) => missingSets[l].has(t)),
    })),
    flaggedTemplates: flaggedTemplates,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
}

process.exit(clean ? 0 : 1);
