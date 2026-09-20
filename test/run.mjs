/* CUSTOM+ — kale testrunner.
   ------------------------------------------------------------------
   Geen framework, geen dependency, geen buildstap: dezelfde afspraak als
   de rest van deze codebase. Node draait dit bestand, het bestand zoekt
   alle test/*.test.mjs op, importeert ze en telt wat er lukt.

   Draaien:   node test/run.mjs
              node test/run.mjs invoice           (alleen bestanden die
                                                   'invoice' in hun naam
                                                   hebben)
   Exit-code: 0 = alles groen, 1 = er faalde iets (bruikbaar in CI).

   Een testbestand exporteert één functie als default:

     export default function (t) {
       t.group('afronding');
       t.eq(core.divRound(5, 2), 3, 'half omhoog');
       t.true(x, 'omschrijving');
       t.throws(function(){ ... }, 'moet klappen');
     }

   Elke assertie draagt een omschrijving; die omschrijving is wat je bij
   een rode test leest, dus schrijf hem alsof je hem over een half jaar
   voor het eerst ziet.
   ------------------------------------------------------------------ */
import { readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ANSI-kleur alleen als de uitvoer naar een echte terminal gaat */
const TTY = process.stdout.isTTY;
const c = {
  red: (s) => (TTY ? '\u001b[31m' + s + '\u001b[0m' : s),
  green: (s) => (TTY ? '\u001b[32m' + s + '\u001b[0m' : s),
  grey: (s) => (TTY ? '\u001b[90m' + s + '\u001b[0m' : s),
  bold: (s) => (TTY ? '\u001b[1m' + s + '\u001b[0m' : s)
};

function show(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === undefined) return 'undefined';
  try { return JSON.stringify(v); } catch { return String(v); }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

class Harness {
  constructor(file) {
    this.file = file;
    this.groupName = '';
    this.passed = 0;
    this.failures = [];
  }
  group(name) { this.groupName = String(name || ''); }
  _pass() { this.passed++; }
  _fail(msg, detail) {
    this.failures.push({ group: this.groupName, msg: String(msg || '(zonder omschrijving)'), detail: detail || '' });
  }
  ok(cond, msg) { if (cond) this._pass(); else this._fail(msg, 'verwacht: waar'); return !!cond; }
  true(cond, msg) { return this.ok(cond === true || !!cond, msg); }
  false(cond, msg) { return this.ok(!cond, msg); }
  eq(actual, expected, msg) {
    if (Object.is(actual, expected)) { this._pass(); return true; }
    this._fail(msg, 'verwacht ' + show(expected) + ', kreeg ' + show(actual));
    return false;
  }
  deep(actual, expected, msg) {
    if (deepEqual(actual, expected)) { this._pass(); return true; }
    this._fail(msg, 'verwacht ' + show(expected) + ', kreeg ' + show(actual));
    return false;
  }
  throws(fn, msg) {
    try { fn(); } catch { this._pass(); return true; }
    this._fail(msg, 'verwacht: er wordt een fout gegooid');
    return false;
  }
}

async function main() {
  const filter = process.argv[2] || '';
  let entries;
  try {
    entries = await readdir(HERE);
  } catch (e) {
    console.error('Kan de testmap niet lezen: ' + e.message);
    process.exit(1);
  }
  const files = entries
    .filter((f) => f.endsWith('.test.mjs'))
    .filter((f) => !filter || f.includes(filter))
    .sort();

  if (!files.length) {
    console.error(c.red('Geen testbestanden gevonden' + (filter ? ' voor filter “' + filter + '”' : '') + '.'));
    process.exit(1);
  }

  let totalPassed = 0;
  const allFailures = [];
  const t0 = Date.now();

  for (const file of files) {
    const h = new Harness(file);
    try {
      const mod = await import(pathToFileURL(join(HERE, file)).href);
      const run = mod.default;
      if (typeof run !== 'function') throw new Error('geen default-export functie');
      await run(h);
    } catch (e) {
      h._fail('het testbestand zelf klapte', (e && e.stack) ? e.stack.split('\n').slice(0, 4).join('\n') : String(e));
    }
    totalPassed += h.passed;
    const bad = h.failures.length;
    const head = bad === 0
      ? c.green('  ok  ') + file + c.grey('  ' + h.passed + ' asserties')
      : c.red(' FAIL ') + file + c.grey('  ' + h.passed + ' ok, ' + bad + ' fout');
    console.log(head);
    for (const f of h.failures) {
      allFailures.push({ file, ...f });
      console.log('       ' + c.red('×') + ' ' + (f.group ? c.grey('[' + f.group + '] ') : '') + f.msg);
      if (f.detail) {
        for (const ln of String(f.detail).split('\n')) console.log('         ' + c.grey(ln));
      }
    }
  }

  const ms = Date.now() - t0;
  console.log('');
  if (allFailures.length === 0) {
    console.log(c.green(c.bold('Alles groen')) + ' — ' + totalPassed + ' asserties in ' + files.length + ' bestand(en), ' + ms + ' ms.');
    process.exit(0);
  }
  console.log(c.red(c.bold(allFailures.length + ' fout')) + ' van ' + (totalPassed + allFailures.length) +
    ' asserties in ' + files.length + ' bestand(en), ' + ms + ' ms.');
  process.exit(1);
}

main();
