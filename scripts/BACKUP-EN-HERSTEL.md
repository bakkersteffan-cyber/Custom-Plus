# CUSTOM+ — back-up en hersteltest van Supabase

Agent "backup-restore" (voorstel 50). Korte samenvatting vooraf: **een
backup die je nooit hebt teruggezet, is alleen een aanname.** Een dump-
bestand dat netjes op schijf staat bewijst niets — pas het moment waarop
je hem écht in een leeg project terugzet en de site daar weer werkt, weet
je zeker dat de backup ook bruikbaar is. Bij een corrupt dump-bestand, een
verkeerde flag, een vergeten extensie of een ontbrekende rol kom je daar
anders pas achter op het moment dat je hem het hardst nodig hebt.

Er is voor deze klant nog geen echt Supabase-project. Daarom bestaat dit
document uit twee delen: wat **vandaag al** een harde garantie geeft
(deel 1), en wat je **zodra het project bestaat** regelmatig moet blijven
oefenen (deel 2).

## Deel 1 — wat vandaag al bewezen is: de schema-hersteltest

`node scripts/supabase-restore-drill.mjs` (of `npm run restore-drill`)
speelt alle migraties in `supabase/portal/` — op volgorde van hun nummer,
dynamisch uit de map gelezen, niet hardcoded — achter elkaar af in een
verse, lege in-memory Postgres-database (PGlite). Dat bewijst dat het
schema zelf foutloos en volledig ontstaat: geen migratie die klapt, geen
tabel die ontbreekt, RLS die overal aanstaat waar een klant- of
projectkolom staat, en de twee kernfuncties (`is_staff`, `owns_project`)
die bestaan. Dit script draait zonder live project en zonder
omgevingsvariabelen, en `test/restore-drill.test.mjs` draait het bij elke
`node test/run.mjs` opnieuw mee.

Wat dit NIET bewijst: dat een echte databackup met echte klantdata ook
teruggezet kan worden. Dat is deel 2, en dat vraagt een bestaand project.

## Deel 2 — zodra er een live project is: een échte backup en restore

### Backup maken

```
export SUPABASE_DB_URL="postgresql://postgres:<db-wachtwoord>@db.<project-ref>.supabase.co:5432/postgres"
npm run backup
```

`scripts/supabase-backup.sh` gebruikt de Supabase CLI als die
geïnstalleerd is (`supabase db dump`, resultaat: `backups/customplus-
<tijdstempel>.sql`, platte SQL), en anders `pg_dump` in het custom-formaat
(resultaat: `backups/customplus-<tijdstempel>.dump`). Is geen van beide
geïnstalleerd, dan legt het script uit hoe je ze installeert en stopt met
een foutcode — het verzint nooit een geslaagde backup. `backups/` staat
in `.gitignore`: dumps kunnen klantgegevens bevatten en horen nooit in
git.

### Terugzetten in een NIEUW LEEG project

Zet een backup **nooit terug in het levende productieproject** — dat
overschrijft bestaande klantdata. Maak eerst een los, leeg Supabase-
project aan (dashboard of `supabase projects create`) en gebruik de
DB-connection string daarvan (Project Settings → Database → Connection
string, in dezelfde vorm als `SUPABASE_DB_URL` hierboven).

**Voor een `.sql`-bestand** (Supabase CLI-dump, platte SQL — via `psql`,
onderdeel van dezelfde PostgreSQL-clienttools als `pg_dump`):

```
psql "$NIEUW_PROJECT_DB_URL" -f backups/customplus-<tijdstempel>.sql
```

**Voor een `.dump`-bestand** (pg_dump custom-formaat — via `pg_restore`,
óók onderdeel van de PostgreSQL-clienttools):

```
pg_restore --clean --if-exists --no-owner \
  -d "$NIEUW_PROJECT_DB_URL" backups/customplus-<tijdstempel>.dump
```

`--clean --if-exists` ruimt eerst op wat er in het lege project al stond
(zodat een tweede restore-poging niet struikelt over "already exists");
`--no-owner` voorkomt dat pg_restore probeert een rol aan te maken die in
het nieuwe project niet bestaat.

### Controleren dat de restore echt gelukt is

Een commando dat zonder foutmelding eindigt, is nog geen bewijs. Controleer
minstens:

1. **Schema aanwezig** — in het nieuwe project (dashboard → Table Editor,
   of `psql "$NIEUW_PROJECT_DB_URL" -c '\dt'`): staan de kerntabellen er
   (`clients`, `projects`, `project_stages`, `invoices`, …)?
2. **Data aanwezig** — een paar losse tellingen, bijvoorbeeld
   `select count(*) from clients;` en `select count(*) from projects;`,
   en vergelijk die met wat je verwacht van het moment van de backup.
3. **RLS werkt ook hier** — dit is precies wat
   `scripts/supabase-restore-drill.mjs` automatisch bewijst, maar dan
   vanaf de migraties in een in-memory database, niet tegen dit herstelde
   project. Een groene `npm test` bewijst dus NIETS over de herstelde
   data in Supabase zelf — de testsuite draait tegen de demo-opslag in de
   browser, niet tegen een live Supabase-project. Test de restore dus
   altijd apart, met bovenstaande stappen.

### Wat een SQL-dump niet bevat

- **Storage-bestanden** (foto's, pdf's in de buckets `project-media`,
  `project-docs`, `klant-upload`) staan niet in een SQL-dump. Die heeft
  een eigen back-up nodig (dashboard-export per bucket, of via de Storage
  API) — dat is bewust buiten de scope van dit voorstel gelaten.
- **Secrets** (API-sleutels, service-role-sleutel) staan nooit in de
  database en dus ook nooit in de dump — die leven in de omgevingsvariabelen
  van Netlify/Supabase zelf.

### Hoe vaak oefenen

Minstens telkens na een grote schemawijziging (een nieuwe migratie), en
daarnaast een paar keer per jaar met een verse backup van dat moment —
juist om te bewijzen dat de meest recente backup ook echt bruikbaar is,
niet alleen een backup van een half jaar geleden. Zet de uitkomst (gelukt
of niet, en wat je moest bijstellen) even in een regel bij dit bestand of
in de projectnotities, zodat de volgende oefening niet bij nul begint.
