/* Lokale dev-server: statische bestanden + de Netlify Function op hetzelfde origin,
   zodat de AI productcheck ook lokaal echt werkt. Leest MISTRAL_API_KEY uit .env
   (niet gecommit). Productie draait dit niet — daar doet Netlify beide. */

import { createServer } from 'node:http';
import { readFile, readFileSync, existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = fileURLToPath(new URL('..', import.meta.url));
var PORT = Number(process.env.PORT) || 8790;

/* .env inlezen (alleen KEY=value regels) */
var envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(function (line) {
    var m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

var handlerPromise = import('../netlify/functions/product-check.mjs');

var MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.yml': 'text/yaml', '.woff2': 'font/woff2'
};

createServer(function (req, res) {
  var url = new URL(req.url, 'http://localhost:' + PORT);

  /* de serverless functie */
  if (url.pathname === '/.netlify/functions/product-check') {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      handlerPromise.then(function (mod) {
        var request = new Request('http://localhost:' + PORT + url.pathname, {
          method: req.method,
          headers: req.headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined
        });
        return mod.default(request);
      }).then(function (response) {
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return response.text();
      }).then(function (text) { res.end(text); })
        .catch(function (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'dev-server: ' + err.message }));
        });
    });
    return;
  }

  /* statisch, met de Netlify redirect / -> /custom-plus.html */
  var pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/custom-plus.html';
  var file = normalize(join(ROOT, pathname));
  if (!file.startsWith(normalize(ROOT))) { res.writeHead(403); res.end(); return; }
  readFile(file, function (err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, function () {
  console.log('dev-server op http://localhost:' + PORT + ' (AI-functie ' + (process.env.MISTRAL_API_KEY ? 'ACTIEF' : 'zonder key — geeft 503') + ')');
});
