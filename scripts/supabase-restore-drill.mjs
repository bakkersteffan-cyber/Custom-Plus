#!/usr/bin/env node
/* CUSTOM+ — hersteltest van het Supabase-schema (agent "backup-restore",
   voorstel 50: back-up en hersteltest van Supabase).
   ------------------------------------------------------------------
   Waarom dit bestaat: een backup die je nooit hebt teruggezet is alleen
   een aanname (zie scripts/BACKUP-EN-HERSTEL.md). Er is voor deze klant
   nog geen echt Supabase-project, dus een écht data-restore-oefening kan
   vandaag niet. Wat WEL nu al een harde garantie geeft: alle migraties in
   supabase/portal/ opnieuw afspelen vanaf een lege database en
   controleren dat het schema klopt. Precies dat doet dit script, volledig
   in-memory, met PGlite (WASM-Postgres, al aanwezig als devDependency —
   zie package.json, niet opnieuw installeren).

   De nabootsing van de Supabase-omgeving hieronder (auth-schema, de drie
   rollen anon/authenticated/service_role, de standaardrechten die
   Supabase zelf op nieuwe tabellen/functies zet) is woordelijk hetzelfde
   patroon als het RLS-hoofdstuk "RLS als aanvaller" in
   test/keten-portaal.test.mjs (agent "keten"): auth.uid()/auth.role()
   lezen uit current_setting('test.uid'/'test.role'), zodat dezelfde
   migraties hier op precies dezelfde manier laden. Dit script test geen
   aanvaller-scenario's (dat doet keten-portaal.test.mjs al) — het test
   alleen of het SCHEMA zelf foutloos en volledig ontstaat.

   Draaien:   node scripts/supabase-restore-drill.mjs
              npm run restore-drill
   Exit-code: 0 = alle migraties zijn foutloos herhaalbaar vanaf een lege
              database en het schema klopt, 1 = er is minstens één
              afwijking (zie het rapport voor de exacte tabelnaam).

   Als module geïmporteerd (door test/restore-drill.test.mjs): alleen de
   functie hersteltest(), zonder console-output of process.exit — zelfde
   afspraak als scripts/build-chat-index.mjs (buildIndex) voor dit
   project: de CLI-taken (printen, exit-code) staan achter de
   argv[1]-wachter onderaan.
   ------------------------------------------------------------------ */
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const HERE = dirname(fileURLToPath(import.meta.url));
const SQLMAP = join(HERE, '..', 'supabase', 'portal');

/* Het migratienummer uit de bestandsnaam (0001_x.sql -> 1), voor de
   sortering. Dynamisch: geen hardcoded lijst bestandsnamen, zodat een
   nieuwe migratie hier vanzelf meedoet. */
function migratienummer(bestand) {
  const m = /^(\d+)_/.exec(bestand);
  return m ? parseInt(m[1], 10) : NaN;
}

async function vindMigraties(map) {
  const entries = await readdir(map);
  return entries
    .filter((f) => f.endsWith('.sql') && !Number.isNaN(migratienummer(f)))
    .sort((a, b) => migratienummer(a) - migratienummer(b));
}

/* De tabelnamen die de migraties ZELF aanmaken — dit is de "vaste lijst
   kerntabellen" uit de opdracht, maar afgeleid uit de echte SQL in plaats
   van uit het hoofd verzonnen. */
function tabellenInSQL(sql) {
  const re = /create table(?:\s+if not exists)?\s+"?([a-z_][a-z0-9_]*)"?\s*\(/gi;
  const gevonden = new Set();
  let m;
  while ((m = re.exec(sql)) !== null) gevonden.add(m[1].toLowerCase());
  return gevonden;
}

/* Een kolom die een rij aan precies één klant of één project bindt
   (client_id / project_id, of een samengestelde naam die daarop eindigt).
   Dit is de dynamische maatstaf voor "een klant- of projectkolom" uit de
   opdracht — geen handmatige tabellenlijst. */
function isKlantOfProjectKolom(kolom) {
  return /(^|_)(client|project)_id$/i.test(kolom);
}

function rapportTekst(r) {
  const regels = [];
  regels.push('=== CUSTOM+ — hersteltest Supabase-schema (restore-drill) ===');
  regels.push('Migraties gevonden in supabase/portal/: ' + r.migraties.gevonden);
  regels.push('Migraties zonder fout uitgevoerd: ' + r.migraties.gelukt + '/' + r.migraties.gevonden);
  regels.push('Kerntabellen gevonden in de migraties: ' + r.tabellen.kern);
  regels.push('Kerntabellen aanwezig na migratie: ' + r.tabellen.aanwezig + '/' + r.tabellen.kern);
  regels.push('Tabellen met een klant- of projectkolom: ' + r.rls.totaal);
  regels.push('Daarvan met RLS aan: ' + r.rls.aan + '/' + r.rls.totaal);
  regels.push('Functie is_staff(): ' + (r.functies.is_staff ? 'aanwezig' : 'ONTBREEKT'));
  regels.push('Functie owns_project(uuid): ' + (r.functies.owns_project ? 'aanwezig' : 'ONTBREEKT'));
  regels.push('');
  if (r.afwijkingen.length === 0) {
    regels.push('Geen afwijkingen. Alle ' + r.migraties.gevonden + ' migraties zijn foutloos herhaalbaar vanaf een lege database.');
  } else {
    regels.push(r.afwijkingen.length + ' afwijking(en):');
    for (const a of r.afwijkingen) regels.push('  - ' + a);
  }
  return regels.join('\n');
}

export async function hersteltest() {
  const afwijkingen = [];
  const migratiebestanden = await vindMigraties(SQLMAP);
  const kernTabellen = new Set();

  const db = new PGlite();
  const q = (sql, params) => db.query(sql, params || []);
  const draaiSQL = (sql) => db.exec(sql);

  /* Supabase nabootsen: auth-schema, de drie rollen, de standaardrechten
     die Supabase op nieuwe tabellen/functies zet (waar de oudere
     migraties zonder eigen grants op leunen). 1-op-1 hetzelfde blok als
     test/keten-portaal.test.mjs, RLS-hoofdstuk. */
  await draaiSQL(`
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

  let migratiesGelukt = 0;
  for (const bestand of migratiebestanden) {
    const sql = await readFile(join(SQLMAP, bestand), 'utf8');
    for (const t of tabellenInSQL(sql)) kernTabellen.add(t);
    try {
      await draaiSQL(sql);
      migratiesGelukt++;
    } catch (e) {
      afwijkingen.push('migratie ' + bestand + ' faalt: ' + String((e && e.message) || e).split('\n')[0].slice(0, 300));
    }
  }

  /* Welke kerntabellen bestaan er ECHT, na alle migraties? Live
     opgevraagd bij Postgres zelf, geen aanname uit de SQL-tekst. */
  const live = await q("select tablename from pg_tables where schemaname = 'public'");
  const liveTabellen = new Set(live.rows.map((r) => r.tablename));
  const ontbrekendeTabellen = [...kernTabellen].filter((t) => !liveTabellen.has(t)).sort();
  for (const t of ontbrekendeTabellen) afwijkingen.push('kerntabel "' + t + '" ontbreekt na migratie');

  /* Welke tabellen hebben een klant- of projectkolom, en staat RLS daar
     op aan? Ook dit live opgevraagd (information_schema + pg_class). */
  const kolommen = await q(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
  `);
  const tabellenMetKlantOfProject = new Set(
    kolommen.rows.filter((r) => isKlantOfProjectKolom(r.column_name)).map((r) => r.table_name)
  );
  let rlsAan = 0;
  const zonderRls = [];
  for (const t of [...tabellenMetKlantOfProject].sort()) {
    const r = await q(
      "select relrowsecurity from pg_class where relname = $1 and relnamespace = 'public'::regnamespace",
      [t]
    );
    const aan = !!(r.rows[0] && r.rows[0].relrowsecurity);
    if (aan) rlsAan++;
    else {
      zonderRls.push(t);
      afwijkingen.push('RLS staat NIET aan op "' + t + '" (heeft een klant- of projectkolom)');
    }
  }

  /* De twee kernfuncties waar heel de RLS-laag op leunt. */
  const functies = await q(`
    select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('is_staff', 'owns_project')
  `);
  const heeftIsStaff = functies.rows.some((r) => r.proname === 'is_staff');
  const heeftOwnsProject = functies.rows.some((r) => r.proname === 'owns_project');
  if (!heeftIsStaff) afwijkingen.push('functie is_staff() bestaat niet');
  if (!heeftOwnsProject) afwijkingen.push('functie owns_project(uuid) bestaat niet');

  if (typeof db.close === 'function') {
    try { await db.close(); } catch { /* het sluiten van de in-memory database is geen onderdeel van de garantie */ }
  }

  const resultaat = {
    migraties: { gevonden: migratiebestanden.length, gelukt: migratiesGelukt, bestanden: migratiebestanden },
    tabellen: {
      kern: kernTabellen.size,
      aanwezig: kernTabellen.size - ontbrekendeTabellen.length,
      ontbrekend: ontbrekendeTabellen,
      lijst: [...kernTabellen].sort()
    },
    rls: { totaal: tabellenMetKlantOfProject.size, aan: rlsAan, zonder: zonderRls, lijst: [...tabellenMetKlantOfProject].sort() },
    functies: { is_staff: heeftIsStaff, owns_project: heeftOwnsProject },
    afwijkingen,
    ok: afwijkingen.length === 0
  };
  resultaat.rapport = rapportTekst(resultaat);
  return resultaat;
}

/* Als script gedraaid: rapport printen en de bijbehorende exit-code
   geven. Als module geïmporteerd (door de test): alleen hersteltest(),
   geen console-output of process.exit. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  hersteltest().then((r) => {
    console.log(r.rapport);
    process.exit(r.ok ? 0 : 1);
  }).catch((e) => {
    console.error('De hersteltest kon niet draaien: ' + String((e && e.stack) || e));
    process.exit(1);
  });
}
