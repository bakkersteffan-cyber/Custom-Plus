/* Lokale dev-server: de gebouwde site zoals hij op Netlify draait, plus de
   Netlify Functions op hetzelfde origin, zodat AI-productcheck en
   klantmeldingen ook lokaal echt werken. Leest .env (niet gecommit).
   Productie draait dit niet — daar doet Netlify het.

   Draaien:  node scripts/dev-server.mjs                  (poort 8790)
             node scripts/dev-server.mjs --port 8791      (tweede instantie)
             node scripts/dev-server.mjs --live-cache     (zie Cache-Control)

   WAT NETLIFY DOET, DOET DEZE SERVER OOK. De regels komen uit netlify.toml
   zelf, niet uit een kopie hier: de [[redirects]] (geforceerde 404's voor
   de afgeschermde mappen, de 301's van de oude Engelse paden, de 200-rewrites
   voor subroutes) en de [[headers]] (Content-Security-Policy en de andere
   beveiligingskoppen, cache-koppen, X-Robots-Tag). Een CSP-overtreding of
   een verkeerde afscherming zie je dus lokaal in de console, in plaats van
   pas na de deploy. Onbekende paden krijgen 404.html met status 404, net als
   live. Draai de generator voordat je hier iets test, anders bekijk je een
   oude build. */

import { createServer } from 'node:http';
import { readFile, readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, normalize, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = fileURLToPath(new URL('..', import.meta.url));
var ARGS = process.argv.slice(2);
function argValue(name) {
  var i = ARGS.indexOf(name);
  return i >= 0 ? ARGS[i + 1] : null;
}
var PORT = Number(argValue('--port')) || Number(process.env.PORT) || 8790;

/* Cache-Control uit netlify.toml (tot een jaar voor assets, vijf minuten voor
   content) is precies wat je NIET wilt terwijl je aan het bouwen bent: je
   past content aan, herlaadt, en ziet de oude tekst nog vijf minuten. Daarom
   stuurt de dev-server standaard no-store, en alle andere koppen wél. Met
   --live-cache gaan ook de echte cache-koppen mee, bijvoorbeeld om te meten
   wat een tweede paginabezoek nog over de lijn haalt. */
var LIVE_CACHE = ARGS.indexOf('--live-cache') >= 0;

/* .env inlezen (alleen KEY=value regels) */
var envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(function (line) {
    var m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

/* Elke functie in netlify/functions/<naam>.mjs is bereikbaar op
   /.netlify/functions/<naam>, precies zoals Netlify dat in productie doet.

   DE LIJST WORDT GELEZEN, NIET GETYPT. Hier stond een handmatige lijst, en
   die liep achter: invoice-ai en admin-revoke-sessions ontbraken erin,
   waardoor de gezondheidscontrole in het beheer lokaal een 404 gaf op een
   functie die in productie gewoon bestaat — een verschil tussen hier en
   live dat je pas na de deploy ontdekt. Netlify zet zelf ook simpelweg elk
   bestand in deze map online, dus de map uitlezen is niet alleen korter
   maar ook wat er echt gebeurt. Bestanden die met _ of . beginnen slaan we
   over; dat zijn per afspraak hulpbestanden en geen eindpunten. */
var FUNCTIONS_DIR = join(ROOT, 'netlify', 'functions');
var FUNCTIONS = (existsSync(FUNCTIONS_DIR) ? readdirSync(FUNCTIONS_DIR) : [])
  .filter(function (f) { return extname(f) === '.mjs' && f[0] !== '_' && f[0] !== '.'; })
  .map(function (f) { return basename(f, '.mjs'); })
  .sort();

/* Een functie die al bij het inladen struikelt (ontbrekende import, typefout)
   mag de hele dev-server niet meenemen. De fout wordt hier opgevangen en
   opnieuw opgeworpen zodra iemand die ene functie aanroept, zodat je de
   echte melding ziet in plaats van een server die zwijgend wegvalt. */
var handlerPromises = {};
FUNCTIONS.forEach(function (name) {
  handlerPromises[name] = import('../netlify/functions/' + name + '.mjs')
    .catch(function (err) {
      return { default: function () { throw new Error(name + ' kon niet worden ingeladen: ' + err.message); } };
    });
});

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.yml': 'text/yaml', '.woff2': 'font/woff2', '.pdf': 'application/pdf'
};

/* ------------------------------------------------------------ netlify.toml */

/* Een lezer voor precies wat wij uit netlify.toml nodig hebben: de arrays
   [[redirects]] en [[headers]] met hun [headers.values]. Geen volledige
   TOML-parser (geen tabellen in tabellen, geen meerregelige strings): het
   bestand is eenvoudig en blijft dat, en een echte parser zou een dependency
   zijn in een project dat er bewust geen heeft. Wat hier niet begrepen wordt,
   wordt overgeslagen — nooit geraden. */
function parseTomlValue(raw) {
  var v = raw.trim();
  var m = v.match(/^"((?:[^"\\]|\\.)*)"/);
  if (m) return m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  m = v.match(/^'([^']*)'/);
  if (m) return m[1];
  v = v.replace(/\s+#.*$/, '');
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  return v;
}

function parseNetlifyToml(text) {
  var redirects = [];
  var headers = [];
  var target = null; /* het object waar key = value regels nu in landen */
  text.split('\n').forEach(function (raw) {
    var line = raw.trim();
    if (!line || line[0] === '#') return;
    var m = line.match(/^\[\[([A-Za-z_]+)\]\]$/);
    if (m) {
      target = {};
      if (m[1] === 'redirects') redirects.push(target);
      else if (m[1] === 'headers') headers.push(target);
      else target = null;
      return;
    }
    if (line === '[headers.values]') {
      var last = headers[headers.length - 1];
      if (last) { last.values = last.values || {}; target = last.values; }
      else target = null;
      return;
    }
    if (line[0] === '[') { target = null; return; } /* [build], [functions], ... */
    m = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (m && target) target[m[1]] = parseTomlValue(m[2]);
  });
  return { redirects: redirects, headers: headers };
}

/* Padpatronen zoals Netlify ze leest: een splat (*) matcht alles wat volgt,
   ook over mappen heen; :naam matcht één padsegment. "/diensten/*" matcht
   ook "/diensten" en "/diensten/" zelf, want zo gedraagt Netlify zich met
   zijn nette URL's. In een `for` van [[headers]] mag de * ook midden in een
   segment staan ("/assets/app.*"); dezelfde vertaling dekt dat. */
function patternToRegExp(pattern) {
  var escaped = pattern.split('*').map(function (part) {
    return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z0-9_]+/g, '[^/]+');
  });
  var source;
  if (escaped.length === 2 && escaped[1] === '' && /\/$/.test(escaped[0])) {
    source = escaped[0].replace(/\/$/, '') + '(?:/(.*))?';
  } else {
    source = escaped.join('(.*)');
  }
  return new RegExp('^' + source + '$');
}

var tomlCache = { mtimeMs: -1, rules: null };
function netlifyRules() {
  var file = join(ROOT, 'netlify.toml');
  if (!existsSync(file)) return { redirects: [], headers: [] };
  /* per aanvraag opnieuw lezen zodra het bestand wijzigt: wie aan de CSP
     sleutelt hoeft de server niet te herstarten */
  var mtimeMs = statSync(file).mtimeMs;
  if (tomlCache.rules && tomlCache.mtimeMs === mtimeMs) return tomlCache.rules;
  var parsed = parseNetlifyToml(readFileSync(file, 'utf8'));
  parsed.redirects = parsed.redirects
    .filter(function (r) { return typeof r.from === 'string' && typeof r.to === 'string'; })
    .map(function (r) {
      return { from: r.from, to: r.to, status: Number(r.status) || 301, force: r.force === true, re: patternToRegExp(r.from) };
    });
  parsed.headers = parsed.headers
    .filter(function (h) { return typeof h.for === 'string' && h.values; })
    .map(function (h) { return { for: h.for, values: h.values, re: patternToRegExp(h.for) }; });
  tomlCache = { mtimeMs: mtimeMs, rules: parsed };
  return parsed;
}

/* Alle [[headers]] die op het pad passen, in volgorde; bij dezelfde kop wint
   de laatste. Cache-Control: zie LIVE_CACHE bovenaan. */
function headersFor(pathname) {
  var out = {};
  netlifyRules().headers.forEach(function (rule) {
    if (!rule.re.test(pathname)) return;
    Object.keys(rule.values).forEach(function (k) { out[k] = String(rule.values[k]); });
  });
  if (!LIVE_CACHE) out['Cache-Control'] = 'no-store';
  return out;
}

function firstRedirect(pathname, forced) {
  var rules = netlifyRules().redirects;
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (r.force !== forced) continue;
    var m = pathname.match(r.re);
    if (!m) continue;
    var splat = m[1] || '';
    return { rule: r, to: r.to.replace(':splat', splat) };
  }
  return null;
}

/* ------------------------------------------------------------- bestanden */

function insideRoot(file) {
  return normalize(file).startsWith(normalize(ROOT));
}

function isFile(file) {
  try { return statSync(file).isFile(); } catch (e) { return false; }
}

/* Netlify's nette URL's: /diensten komt uit diensten/index.html, /over-ons
   ook uit over-ons.html als dat zou bestaan, en /diensten/ net zo goed. */
function resolveStatic(pathname) {
  var base = normalize(join(ROOT, pathname));
  if (!insideRoot(base)) return null;
  var candidates = pathname === '/'
    ? [join(ROOT, 'index.html')]
    : [base, join(base, 'index.html'), base + '.html'];
  for (var i = 0; i < candidates.length; i++) if (isFile(candidates[i])) return candidates[i];
  return null;
}

function send(res, status, pathname, file, extraHeaders) {
  var headers = headersFor(pathname);
  Object.keys(extraHeaders || {}).forEach(function (k) { headers[k] = extraHeaders[k]; });
  if (!file) {
    headers['Content-Type'] = 'text/plain; charset=utf-8';
    res.writeHead(status, headers);
    res.end(status === 404 ? '404 — niet gevonden (draai de generator voor een echte 404.html)' : String(status));
    return;
  }
  readFile(file, function (err, data) {
    if (err) {
      headers['Content-Type'] = 'text/plain; charset=utf-8';
      res.writeHead(500, headers);
      res.end('dev-server: ' + err.message);
      return;
    }
    headers['Content-Type'] = MIME[extname(file)] || 'application/octet-stream';
    res.writeHead(status, headers);
    res.end(data);
  });
}

function sendNotFound(res, pathname) {
  var page = join(ROOT, '404.html');
  send(res, 404, pathname, isFile(page) ? page : null);
}

/* Het doel van een rewrite of geforceerde 404 is altijd een bestand in de
   repo (/diensten/index.html, /404.html); bestaat dat niet, dan is de
   generator niet gedraaid en zeggen we dat, in plaats van stil een 404. */
function sendRuleTarget(res, pathname, status, to) {
  var file = resolveStatic(to);
  if (file) { send(res, status, pathname, file); return; }
  send(res, status === 200 ? 404 : status, pathname, null);
}

/* ---------------------------------------------------------------- server */

createServer(function (req, res) {
  var url = new URL(req.url, 'http://localhost:' + PORT);

  /* serverless functies */
  /* ruim genoeg voor elke bestandsnaam die hierboven is ingelezen; een naam
     die de map wél kent maar deze regel niet, zou anders alsnog een 404
     geven — precies het verschil met productie dat we net hebben gedicht */
  var fnMatch = url.pathname.match(/^\/\.netlify\/functions\/([A-Za-z0-9_-]+)$/);
  if (fnMatch && handlerPromises[fnMatch[1]]) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      handlerPromises[fnMatch[1]].then(function (mod) {
        var request = new Request('http://localhost:' + PORT + url.pathname, {
          method: req.method,
          headers: req.headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined
        });
        return mod.default(request);
      }).then(function (response) {
        res.writeHead(response.status, Object.fromEntries(response.headers));
        /* BEVINDING 14: altijd de body als stream doorpijpen, ook als hij niet
           op event-stream lijkt. Één pad in plaats van twee is eenvoudiger, en
           `response.body` is voor een gewone JSON-Response net zo goed een
           ReadableStream (met één chunk) — de reader-lus hieronder werkt dus
           voor beide. Alleen als er geen `body` is (bv. een 204/HEAD-achtig
           antwoord) valt hij terug op meteen sluiten, zonder .text() te lezen. */
        if (!response.body) { res.end(); return; }
        var reader = response.body.getReader();
        function pump() {
          return reader.read().then(function (step) {
            if (step.done) { res.end(); return; }
            /* direct schrijven zodra de chunk binnenkomt — dit is precies wat
               echte Netlify-infrastructuur doet voor een streamende functie
               zoals site-chat.mjs, in tegenstelling tot het oude .text()-pad
               dat eerst het hele antwoord bufferde */
            res.write(Buffer.from(step.value));
            return pump();
          });
        }
        return pump();
      }).catch(function (err) {
        if (res.headersSent) { res.end(); return; }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'dev-server: ' + err.message }));
      });
    });
    return;
  }

  var pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (e) { pathname = url.pathname; }
  pathname = pathname.replace(/\/+$/, '') || '/';

  /* .env en .git bestaan op Netlify niet (gitignored / niet gedeployed), maar
     hier wel; die mogen nooit over http naar buiten */
  if (/^\/(\.env|\.git)(\/|$)/.test(pathname)) { sendNotFound(res, pathname); return; }

  /* 1. geforceerde regels winnen van bestaande bestanden (force = true) */
  var hit = firstRedirect(pathname, true);
  if (!hit) {
    /* 2. een bestand dat bestaat, wint van niet-geforceerde regels */
    var file = resolveStatic(pathname);
    if (file) { send(res, 200, pathname, file); return; }
    /* 3. dan pas de gewone regels, in volgorde */
    hit = firstRedirect(pathname, false);
  }
  if (hit) {
    var status = hit.rule.status;
    if (status >= 300 && status < 400) {
      var target = hit.to + url.search;
      var redirectHeaders = headersFor(pathname);
      redirectHeaders.Location = target;
      redirectHeaders['Content-Type'] = 'text/plain; charset=utf-8';
      res.writeHead(status, redirectHeaders);
      res.end(status + ' → ' + target);
      return;
    }
    sendRuleTarget(res, pathname, status, hit.to);
    return;
  }

  /* 4. niets past: 404.html met status 404, zoals Netlify */
  sendNotFound(res, pathname);
}).listen(PORT, function () {
  var notifyReady = process.env.RESEND_API_KEY && process.env.RESEND_FROM && process.env.NOTIFY_SHARED_SECRET;
  var rules = netlifyRules();
  console.log('dev-server op http://localhost:' + PORT +
    ' (AI-functie ' + (process.env.MISTRAL_API_KEY ? 'ACTIEF' : 'zonder key — geeft 503') +
    ', klantmeldingen ' + (notifyReady ? 'ACTIEF' : 'nog niet geconfigureerd — geeft 503') + ')');
  /* zichtbaar maken wat er bediend wordt: een 404 op een gezondheidscontrole
     is zo terug te voeren op een ontbrekend bestand in plaats van op een
     lijst die achterloopt */
  console.log('  serverfuncties (' + FUNCTIONS.length + '): ' + FUNCTIONS.join(', '));
  console.log('  netlify.toml: ' + rules.redirects.length + ' redirect-regels, ' + rules.headers.length +
    ' header-regels' + (LIVE_CACHE ? ' (echte Cache-Control)' : ' (Cache-Control: no-store; --live-cache voor de echte)'));
  if (!isFile(join(ROOT, '404.html'))) console.log('  LET OP: 404.html ontbreekt — draai node scripts/build-site.mjs');
});
