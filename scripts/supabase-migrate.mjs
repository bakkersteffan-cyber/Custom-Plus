/* CUSTOM+ — Supabase migratierunner (voorstel 46)
   Draait alle SQL-bestanden in supabase/portal/ automatisch in volgorde,
   in plaats van ze één voor één in de Supabase SQL-editor te plakken.

   Draaien:  npm run migrate
   (of rechtstreeks: node scripts/supabase-migrate.mjs)

   Vereist SUPABASE_DB_URL — zie de duidelijke uitleg die dit script zelf
   afdrukt als die ontbreekt, of supabase/portal/MIGRATIES.md.

   Idempotent: een tabel _migraties_toegepast onthoudt welke bestanden al
   gedraaid zijn, dus een tweede run (met of zonder nieuwe migraties erbij)
   slaat het al-gedane werk gewoon over.

   OPZET VAN DIT BESTAND — waarom de logica hieronder in twee lagen staat:
   het eerste deel (listMigrationFiles / ensureTrackingTable /
   getAppliedMigrations / applyMigration / runMigrations) praat uitsluitend
   tegen een object met een .query(tekst, params?) methode — precies het
   contract dat zowel pg.Client als @electric-sql/pglite bieden. Dat laat
   een apart droogloop-script (buiten dit project, in de scratchpad) deze
   functies hergebruiken met een PGlite-database in plaats van een echte
   Postgres-verbinding, om de volgorde en de idempotentie te bewijzen
   zonder dat er een live Supabase-project nodig is. Dit productiebestand
   importeert PGlite zelf nooit — alleen het tweede deel (main, onderaan)
   praat met de échte `pg`-driver en met process.env/.env. */

import { Client } from 'pg';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MIGRATIONS_DIR = join(ROOT, 'supabase', 'portal');
export const TRACKING_TABLE = '_migraties_toegepast';

/* ---------- databaselaag-onafhankelijke migratielogica ---------- */

/** Leest supabase/portal/, sorteert op het nummer vooraan de bestandsnaam.
 *  Namen worden nergens hardcoded: welke bestanden er staan (en dus ook
 *  bestanden die een andere agent tegelijk toevoegt, zoals 0023) wordt
 *  hier op het moment van draaien van de schijf gelezen. */
export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  if (!existsSync(dir)) {
    throw new Error(`Migratiemap bestaat niet: ${dir}`);
  }
  const bestanden = readdirSync(dir).filter((naam) => naam.toLowerCase().endsWith('.sql'));
  const items = bestanden.map((bestand) => {
    const match = bestand.match(/^(\d+)_/);
    if (!match) {
      throw new Error(
        `Migratiebestand "${bestand}" begint niet met een nummer (patroon "NNNN_naam.sql"). ` +
          `De volgorde kan daardoor niet betrouwbaar bepaald worden. Hernoem het bestand of ` +
          `haal het uit ${dir}.`
      );
    }
    return { bestand, nummer: Number(match[1]), pad: join(dir, bestand) };
  });
  items.sort((a, b) => a.nummer - b.nummer || a.bestand.localeCompare(b.bestand));
  return items;
}

/** Maakt de trackingtabel aan als hij nog niet bestaat. `create table if
 *  not exists` is zelf al idempotent, dus dit mag bij elke run opnieuw. */
export async function ensureTrackingTable(client) {
  await client.query(`
    create table if not exists ${TRACKING_TABLE} (
      bestand text primary key,
      toegepast_op timestamptz not null default now()
    );
  `);
}

export async function getAppliedMigrations(client) {
  const res = await client.query(`select bestand from ${TRACKING_TABLE} order by bestand;`);
  return new Set(res.rows.map((r) => r.bestand));
}

/** Draait één migratiebestand in zijn eigen transactie: begin, inhoud,
 *  invoegen in de trackingtabel, commit. Bij een fout: rollback, en de
 *  fout opnieuw gooien met het bestand erbij zodat de aanroeper precies
 *  weet waar het misging — er wordt hier nooit doorgegaan naar de
 *  volgende migratie. */
export async function applyMigration(client, migratie) {
  const sql = readFileSync(migratie.pad, 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query(`insert into ${TRACKING_TABLE} (bestand) values ($1);`, [migratie.bestand]);
    await client.query('commit');
  } catch (fout) {
    try {
      await client.query('rollback');
    } catch (rollbackFout) {
      // De rollback zelf mislukken is zeldzaam (bv. verbinding al weg).
      // De oorspronkelijke fout blijft leidend; de rollback-fout gaat mee
      // als extra context in plaats van de echte oorzaak te verbergen.
      fout.rollbackFout = rollbackFout;
    }
    throw Object.assign(new Error(`Migratie ${migratie.bestand} is mislukt: ${fout.message}`), {
      bestand: migratie.bestand,
      oorzaak: fout,
    });
  }
}

/** Orchestreert een volledige run: trackingtabel klaarzetten, kijken wat
 *  al gedaan is, en de rest in volgorde draaien. Stopt meteen (gooit de
 *  fout door) zodra één migratie mislukt. `log` is optioneel zodat de
 *  droogloop dit stil kan laten verlopen of naar zijn eigen buffer kan
 *  laten loggen. */
export async function runMigrations(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  await ensureTrackingTable(client);
  const toegepast = await getAppliedMigrations(client);
  const alleMigraties = listMigrationFiles(dir);

  const nieuw = [];
  const overgeslagen = [];

  for (const migratie of alleMigraties) {
    if (toegepast.has(migratie.bestand)) {
      overgeslagen.push(migratie.bestand);
      log(`overgeslagen (al toegepast): ${migratie.bestand}`);
      continue;
    }
    log(`draait: ${migratie.bestand}`);
    await applyMigration(client, migratie);
    nieuw.push(migratie.bestand);
    log(`gelukt: ${migratie.bestand}`);
  }

  return { nieuw, overgeslagen, totaal: alleMigraties.length };
}

/* ---------- productie-CLI: echte Postgres-verbinding via pg ---------- */

function leesEnvBestand() {
  const envPad = join(ROOT, '.env');
  if (!existsSync(envPad)) return;
  readFileSync(envPad, 'utf8')
    .split('\n')
    .forEach((regel) => {
      const m = regel.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!m) return;
      let waarde = m[2].trim();
      if (
        (waarde.startsWith('"') && waarde.endsWith('"')) ||
        (waarde.startsWith("'") && waarde.endsWith("'"))
      ) {
        waarde = waarde.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = waarde;
    });
}

function drukUitlegGeenConnectiestringAf() {
  console.error(
    `
Geen SUPABASE_DB_URL gevonden — er is niets gemigreerd.

Zo kom je aan de connectiestring:
  1. Open het Supabase-dashboard van het project (https://supabase.com/dashboard).
  2. Ga naar Project Settings -> Database -> Connection string.
  3. Kies de variant "URI" en zet "Use connection pooling" UIT — je wilt de
     directe verbinding (poort 5432), niet de pgbouncer-pooler.
  4. Vul het databasewachtwoord in dat je bij het aanmaken van het project
     hebt gekozen (Supabase toont het maar één keer; staat een reset klaar
     via "Reset database password" op datzelfde scherm als je het kwijt bent).
  5. Zet de volledige string klaar als omgevingsvariabele, bijvoorbeeld in
     een .env-bestand in de projectroot (wordt niet gecommit, staat al in
     .gitignore):

       SUPABASE_DB_URL=postgresql://postgres:[wachtwoord]@db.[project-ref].supabase.co:5432/postgres

  Daarna: npm run migrate

Volledige uitleg: supabase/portal/MIGRATIES.md
`.trim()
  );
}

async function main() {
  leesEnvBestand();
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    drukUitlegGeenConnectiestringAf();
    process.exitCode = 1;
    return;
  }

  /* SSL-instelling — bewuste keuze, geen slordigheid:
     Supabase eist TLS op de directe verbinding (poort 5432), maar de
     connectiestring die het dashboard toont bevat zelf geen sslmode-
     parameter, en Node's ingebouwde CA-bundel bevat niet op elke machine
     en Node-versie de certificaatketen waarmee Supabase's certificaat
     sluitend valideert. `ssl: { rejectUnauthorized: false }` is de
     instelling die Supabase's eigen voorbeelden voor node-postgres
     gebruiken in die situatie: het verkeer blijft versleuteld (TLS staat
     aan), alleen de certificaatketen wordt niet streng geverifieerd —
     een bewuste afweging voor een lokaal onderhoudsscript dat de eigenaar
     zelf tegen zijn eigen database draait, niet voor een publiek endpoint.
     Wil je wel volledige certificaatverificatie: download het CA-
     certificaat onder Database -> SSL Configuration in het dashboard, zet
     de omgevingsvariabele NODE_EXTRA_CA_CERTS op het pad naar dat bestand,
     en verander de regel hieronder in `rejectUnauthorized: true`. */
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    try {
      await client.connect();
    } catch (fout) {
      console.error(`Kon geen verbinding maken met de database: ${fout.message}`);
      process.exitCode = 1;
      return;
    }

    const resultaat = await runMigrations(client, {
      log: (regel) => console.log(regel),
    });

    console.log('');
    console.table(
      [
        ...resultaat.nieuw.map((bestand) => ({ bestand, status: 'nieuw gedraaid' })),
        ...resultaat.overgeslagen.map((bestand) => ({ bestand, status: 'al toegepast (overgeslagen)' })),
      ].sort((a, b) => a.bestand.localeCompare(b.bestand))
    );
    console.log(
      `\n${resultaat.nieuw.length} nieuw gedraaid, ${resultaat.overgeslagen.length} overgeslagen, ${resultaat.totaal} migraties totaal.\n`
    );

    console.log('Vervolgstappen (volledige toelichting: supabase/portal/MIGRATIES.md):');
    console.log('  1. RLS handmatig nalopen: vergelijk Supabase-dashboard -> Authentication -> Policies');
    console.log('     met de RLS-commentaarblokken in elke supabase/portal/*.sql-migratie, te beginnen');
    console.log('     bij supabase/portal/0001_portal_schema.sql (regel 167 e.v.).');
    console.log('  2. staff_users-rij aanmaken: maak in Supabase Authentication een gebruiker voor jezelf');
    console.log('     aan en zet zijn auth.uid in staff_users — toegelicht in');
    console.log('     supabase/portal/0001_portal_schema.sql (regel 1-26, functie is_staff()).');
  } catch (fout) {
    console.error('');
    console.error('MIGRATIE MISLUKT — gestopt, niet doorgegaan naar de volgende migratie.');
    console.error(`Bestand: ${fout.bestand || '(onbekend — fout trad op vóór of na het draaien van een bestand)'}`);
    console.error(`Postgres-foutmelding: ${fout.oorzaak ? fout.oorzaak.message : fout.message}`);
    if (fout.oorzaak && fout.oorzaak.code) console.error(`Code: ${fout.oorzaak.code}`);
    if (fout.oorzaak && fout.oorzaak.detail) console.error(`Detail: ${fout.oorzaak.detail}`);
    if (fout.oorzaak && fout.oorzaak.hint) console.error(`Hint: ${fout.oorzaak.hint}`);
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch {
      // Verbinding was mogelijk al dicht (bv. na een connect-fout) — geen probleem.
    }
  }
}

const isEntryModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryModule) {
  main();
}
