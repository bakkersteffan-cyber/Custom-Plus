/* CUSTOM+ — Lighthouse-drempel voor de build.
   ------------------------------------------------------------------
   Dit script hoort NIET in het Netlify build-commando (zie het
   commentaarblok bovenaan netlify.toml voor waarom niet). Het draait
   lokaal met `npm run lighthouse`, of als losse stap in GitHub Actions
   (.github/workflows/lighthouse.yml), zodat een echte regressie in
   performance/toegankelijkheid/best practices/SEO de build rood maakt
   vóórdat er gemerged wordt — zonder dat Netlify's eigen build-image
   moet garanderen dat er een Chrome beschikbaar is (dat garandeert hij
   niet).

   Wat dit script doet, in volgorde:
     1. Bouwt de site echt (build-blog → build-site → build-chat-index),
        want Lighthouse moet tegen de bestanden aan die ook live staan,
        niet tegen een oude build.
     2. Start scripts/dev-server.mjs op poort 8799 (bewust niet 8790,
        de standaardpoort die een losse dev-sessie al bezet kan houden)
        en wacht tot hij echt antwoordt.
     3. Start een headless Chrome via chrome-launcher en draait Lighthouse
        tegen minstens vijf gebouwde pagina's.
     4. Toetst elke pagina aan een drempel per categorie en print een
        tabel + de duurste audits onder de drempel.
     5. Bewaart het volledige rapport per pagina als JSON.
     6. Sluit Chrome en de dev-server netjes af (ook bij een fout) en
        geeft exit code 1 zodra één pagina onder een drempel zit.

   Drempels (score 0–1, hieronder als percentage gelezen):
     performance      ≥ 0.75  — bewust LAGER dan de rest. Een lokale
                                 headless meting op een deelbare
                                 ontwikkelmachine is gevoelig voor ruis
                                 (andere processen, thermal throttling,
                                 een koude of warme schijfcache): dezelfde
                                 pagina kan tussen twee runs een paar
                                 punten schuiven zonder dat er iets aan
                                 de site veranderd is. 0.75 vangt nog
                                 steeds een echte regressie (een pagina
                                 die opeens 0.40 scoort door een vergeten
                                 render-blokkerend script) zonder dat de
                                 build willekeurig rood wordt door ruis.
     accessibility     ≥ 0.90  — geen fysiek-netwerk-ruis: dit zijn
                                 statische DOM/ARIA-checks, dus een score
                                 onder 0.90 is vrijwel altijd een echte
                                 fout (ontbrekend label, slecht contrast).
     best-practices    ≥ 0.90  — idem: HTTPS, console-fouten, image-
                                 aspect-ratio's — deterministisch genoeg
                                 om hoog te leggen.
     seo               ≥ 0.90  — idem: meta-tags, crawlbaarheid — hangt
                                 niet af van netwerktiming.
   ------------------------------------------------------------------ */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8799; // niet 8790: dat is de standaard dev-serverpoort en kan al bezet zijn
const BASE_URL = 'http://localhost:' + PORT;
const CHROME_PATH = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REPORTS_DIR = join(ROOT, 'scripts', '.lighthouse-reports');

const THRESHOLDS = {
  performance: 0.75,
  accessibility: 0.90,
  'best-practices': 0.90,
  seo: 0.90,
};
const CATEGORY_LABELS = {
  performance: 'performance',
  accessibility: 'accessibility',
  'best-practices': 'best practices',
  seo: 'seo',
};

/* Minstens vijf gebouwde pagina's, met het bestand dat build-site.mjs
   ervoor moet neerzetten zodat we een ontbrekende pagina kunnen
   herkennen in plaats van tegen een 404 te meten. */
const PAGES = [
  { name: 'home', path: '/', file: 'index.html' },
  { name: 'diensten', path: '/diensten/', file: 'diensten/index.html' },
  { name: 'contact', path: '/contact/', file: 'contact/index.html' },
  { name: 'privacy', path: '/privacy/', file: 'privacy/index.html' },
  { name: 'blog', path: '/blog/', file: 'blog/index.html' },
  /* Deze vijf hebben, net als /diensten, een container die pas door app.js
     gevuld wordt (of opnieuw gevuld wordt na een async content-fetch) — zie
     de CLS-toelichting bij .fl-ecom-spine__grid en .fl-gift-deck__rail in
     custom-plus.html. Padnamen komen uit ROUTES in build-site.mjs. */
  { name: 'ecommerce', path: '/ecommerce/', file: 'ecommerce/index.html' },
  { name: 'relatiegeschenken', path: '/relatiegeschenken/', file: 'relatiegeschenken/index.html' },
  { name: 'faq', path: '/faq/', file: 'faq/index.html' },
  { name: 'begrippen', path: '/begrippen/', file: 'begrippen/index.html' },
  { name: 'hulpmiddelen', path: '/hulpmiddelen/', file: 'hulpmiddelen/index.html' },
  { name: 'cases', path: '/cases/', file: 'cases/index.html' },
];

function log(line) { console.log(line); }

/* -------------------------------------------------------------- build */

function runBuildStep(scriptRelPath) {
  log('→ node scripts/' + scriptRelPath);
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', scriptRelPath)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.error) {
    throw new Error('scripts/' + scriptRelPath + ' kon niet gestart worden: ' + result.error.message);
  }
  if (result.status !== 0) {
    throw new Error(
      'scripts/' + scriptRelPath + ' is gefaald (exit code ' + result.status +
      '). Los dat eerst op — Lighthouse mag niet tegen een oude of kapotte build meten.'
    );
  }
}

function buildSite() {
  log('\n1. Site bouwen…');
  runBuildStep('build-blog.mjs');
  runBuildStep('build-site.mjs');
  runBuildStep('build-chat-index.mjs');
  log('   Build gelukt.');
}

/* ---------------------------------------------------------- dev-server */

function startDevServer() {
  return new Promise((resolve, reject) => {
    log('\n2. Dev-server starten op poort ' + PORT + '…');
    const child = spawn(
      process.execPath,
      [join(ROOT, 'scripts', 'dev-server.mjs'), '--port', String(PORT)],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let settled = false;
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.once('exit', (code) => {
      if (!settled) {
        settled = true;
        reject(new Error(
          'dev-server sloot direct af (exit code ' + code + ') voordat hij antwoordde. Uitvoer:\n' + output
        ));
      }
    });
    child.once('error', (err) => {
      if (!settled) { settled = true; reject(new Error('dev-server kon niet gestart worden: ' + err.message)); }
    });

    /* Pollen in plaats van alleen op de stdout-tekst vertrouwen: robuuster
       als het logformaat ooit verandert. */
    const deadline = Date.now() + 20000;
    (async function poll() {
      while (!settled && Date.now() < deadline) {
        try {
          const res = await fetch(BASE_URL + '/');
          if (res.ok || res.status === 404) {
            settled = true;
            resolve(child);
            return;
          }
        } catch (e) { /* nog niet klaar, gewoon opnieuw proberen */ }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error('dev-server antwoordde niet binnen 20 seconden op ' + BASE_URL + '. Uitvoer:\n' + output));
      }
    })();
  });
}

function stopDevServer(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill('SIGTERM');
}

/* ----------------------------------------------------------- lighthouse */

async function auditPage(page, chromePort) {
  const filePath = join(ROOT, page.file);
  if (!existsSync(filePath)) {
    log('   ⚠ ' + page.name + ': ' + page.file + ' bestaat niet in de build — overgeslagen.');
    return null;
  }

  const url = BASE_URL + page.path;
  const result = await lighthouse(url, {
    port: chromePort,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });

  if (!result || !result.lhr) {
    log('   ⚠ ' + page.name + ': Lighthouse gaf geen resultaat terug — overgeslagen.');
    return null;
  }

  return result;
}

/* Top drie audits die het meest kosten binnen een categorie die onder de
   drempel zit: gewicht × (1 - score) is een simpele, categorie-brede maat
   voor "hoeveel had deze audit kunnen opleveren" — werkt voor performance-
   opportunities net zo goed als voor een gemiste alt-tekst in accessibility. */
function topCostlyAudits(category, lhr, limit = 3) {
  /* Lighthouse laat lhr.categories[key] undefined als hij die categorie voor
     deze pagina niet kon scoren (bijv. een crash in een audit-plugin). Zonder
     deze guard crasht category.auditRefs hier met een TypeError en stopt het
     hele script — de aanroeper telt zo'n pagina dan nooit als "gefaald",
     want hij komt nooit bij de samenvatting. Een lege lijst hier laat de
     aanroepende code (die de score al als null behandelt) de pagina gewoon
     als gefaald rapporteren en doorgaan naar de volgende. */
  if (!category) return [];
  const refs = category.auditRefs || [];
  const scored = refs
    .map((ref) => {
      const audit = lhr.audits[ref.id];
      if (!audit || typeof audit.score !== 'number') return null;
      const weight = ref.weight || 0;
      const cost = weight * (1 - audit.score);
      if (cost <= 0) return null;
      return { title: audit.title, score: audit.score, cost };
    })
    .filter(Boolean)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, limit);
  return scored;
}

function pct(score) {
  return score === null || score === undefined ? '  n.v.t.' : String(Math.round(score * 100)).padStart(6) + '%';
}

/* -------------------------------------------------------------- rapport */

function saveReport(pageName, result) {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = join(REPORTS_DIR, pageName + '-' + date + '.json');
  const json = typeof result.report === 'string' ? result.report : JSON.stringify(result.lhr, null, 2);
  writeFileSync(file, json, 'utf8');
  return file;
}

async function main() {
  buildSite();

  let devServer = null;
  let chrome = null;
  const failures = []; // { page, category, score, threshold }
  const skipped = [];
  const tested = [];

  try {
    devServer = await startDevServer();
    log('   Dev-server antwoordt op ' + BASE_URL);

    log('\n3. Chrome starten (headless, no-sandbox)…');
    chrome = await chromeLauncher.launch({
      chromePath: CHROME_PATH,
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    log('   Chrome draait op debugport ' + chrome.port);

    log('\n4. Lighthouse per pagina…\n');
    for (const page of PAGES) {
      const result = await auditPage(page, chrome.port);
      if (!result) { skipped.push(page.name); continue; }

      const lhr = result.lhr;
      const scores = {};
      for (const key of Object.keys(THRESHOLDS)) {
        const cat = lhr.categories[key];
        scores[key] = cat ? cat.score : null;
      }

      const reportFile = saveReport(page.name, result);

      log('── ' + page.name + '  (' + page.path + ')');
      log('   ' + Object.keys(THRESHOLDS).map((k) => CATEGORY_LABELS[k].padEnd(16)).join(''));
      log('   ' + Object.keys(THRESHOLDS).map((k) => pct(scores[k]).padEnd(16)).join(''));

      const failedHere = [];
      for (const key of Object.keys(THRESHOLDS)) {
        const score = scores[key];
        const threshold = THRESHOLDS[key];
        if (score === null || score < threshold) {
          failedHere.push(key);
          failures.push({ page: page.name, category: CATEGORY_LABELS[key], score, threshold });
        }
      }

      if (failedHere.length) {
        for (const key of failedHere) {
          const cat = lhr.categories[key];
          if (!cat) {
            /* Lighthouse kon deze categorie helemaal niet scoren (lhr.categories[key]
               ontbreekt) — dat is iets anders dan "wel gescoord, maar onder de
               drempel", dus dat verdient een eigen, eerlijke melding in plaats
               van "geen audit met een tekort te vinden". */
            log('   ✗ ' + CATEGORY_LABELS[key] + ': gefaald — kon categorie "' + key + '" niet scoren (ontbreekt in het Lighthouse-rapport).');
            continue;
          }
          const top = topCostlyAudits(cat, lhr);
          log('   ✗ ' + CATEGORY_LABELS[key] + ' onder de drempel (' +
            pct(scores[key]).trim() + ' < ' + Math.round(THRESHOLDS[key] * 100) + '%). Duurste audits:');
          if (top.length === 0) {
            log('     (geen enkele audit met een tekort te vinden — mogelijk ontbrekende data)');
          } else {
            top.forEach((a, i) => {
              log('     ' + (i + 1) + '. ' + a.title + ' (score ' + pct(a.score).trim() + ')');
            });
          }
        }
      } else {
        log('   ✓ alle categorieën boven de drempel');
      }
      log('   rapport: ' + reportFile.replace(ROOT, '.') + '\n');

      tested.push(page.name);
    }
  } finally {
    log('5. Opruimen…');
    if (chrome) {
      try { await chrome.kill(); } catch (e) { log('   (Chrome afsluiten gaf een fout: ' + e.message + ')'); }
    }
    stopDevServer(devServer);
  }

  log('── Samenvatting ──────────────────────────────────────────');
  log('Getest: ' + (tested.length ? tested.join(', ') : '(geen)'));
  if (skipped.length) log('Overgeslagen (ontbrekende build-bestanden): ' + skipped.join(', '));

  if (failures.length === 0) {
    if (tested.length === 0) {
      log('Geen enkele pagina kon getest worden — dat telt niet als geslaagd.');
      process.exitCode = 1;
      return;
    }
    log('Alle geteste pagina\'s zitten boven hun drempel. Geslaagd.');
    process.exitCode = 0;
    return;
  }

  log('Gefaald: ' + failures.length + ' categorie(ën) onder de drempel:');
  for (const f of failures) {
    log('  - ' + f.page + ' / ' + f.category + ': ' + pct(f.score).trim() +
      ' (drempel ' + Math.round(f.threshold * 100) + '%)');
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nLighthouse-check gestopt met een fout: ' + err.message);
  process.exitCode = 1;
});
