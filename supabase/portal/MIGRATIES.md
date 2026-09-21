# Supabase-migraties automatisch draaien

Dit is voorstel 46: één commando dat alle SQL-bestanden in deze map
(`supabase/portal/`) in de juiste volgorde draait, in plaats van ze stuk
voor stuk in de Supabase SQL-editor te plakken. De runner staat in
`scripts/supabase-migrate.mjs`.

## Wat jij (de eigenaar) zelf moet doen — één keer

Het aanmaken van het Supabase-project zelf is accountaanmaak en blijft
altijd bij jou. Zodra het project bestaat:

1. Open het [Supabase-dashboard](https://supabase.com/dashboard) van het project.
2. Ga naar **Project Settings → Database → Connection string**.
3. Kies de variant **URI** en zet **"Use connection pooling" UIT** — je
   wilt de directe verbinding op poort 5432, niet de pgbouncer-pooler.
   (De pooler deelt verbindingen tussen sessies; de migraties draaien elk
   in hun eigen transactie en horen bij dezelfde sessie te blijven, dat
   geeft de directe verbinding het meest voorspelbaar.)
4. Vul het databasewachtwoord in dat je bij het aanmaken van het project
   hebt gekozen. Kwijt? "Reset database password" staat op datzelfde
   scherm.
5. Zet de volledige string klaar als `SUPABASE_DB_URL`, bijvoorbeeld in een
   `.env`-bestand in de projectroot (wordt niet gecommit, staat al in
   `.gitignore`):

   ```
   SUPABASE_DB_URL=postgresql://postgres:[wachtwoord]@db.[project-ref].supabase.co:5432/postgres
   ```

   (Kan ook als gewone omgevingsvariabele in je shell, dan is er geen
   `.env`-bestand nodig.)

## Het commando

```
npm run migrate
```

(gelijk aan `node scripts/supabase-migrate.mjs`, dat npm-script stond al in
`package.json`.)

Ontbreekt `SUPABASE_DB_URL`, dan drukt het script bovenstaande uitleg zelf
af en stopt het met een foutcode — er wordt nooit gedaan alsof er iets is
gemigreerd als dat niet zo is.

## Wat het script doet

- Leest alle `.sql`-bestanden in deze map en sorteert ze op het nummer
  vooraan de bestandsnaam (`0001_...`, `0002_...`, …). Niets is
  hardcoded: een nieuw genummerd bestand dat hier ooit bijkomt wordt
  vanzelf meegenomen, in de juiste plek in de volgorde.
- Houdt bij welke migraties al gedraaid zijn in een tabel
  `_migraties_toegepast` (bestandsnaam + tijdstip). Dat maakt het
  **idempotent**: een migratie die al is toegepast wordt bij een volgende
  run overgeslagen, dus `npm run migrate` opnieuw draaien — bijvoorbeeld
  omdat er een nieuwe migratie is bijgekomen — is altijd veilig.
- Draait elk bestand in zijn eigen transactie: begin, de inhoud van het
  bestand, de bijbehorende rij in `_migraties_toegepast`, commit. Gaat er
  iets mis, dan rollbackt precies dát bestand, stopt het script met
  foutcode 1, en print het de bestandsnaam en de exacte Postgres-
  foutmelding (inclusief code/detail/hint als Postgres die meegeeft).
  Er wordt dan NIET doorgegaan naar de volgende migratie — een mislukte
  migratie kan een latere migratie in een onvoorspelbare staat achterlaten
  (kolommen die wel/niet bestaan), dus verder gaan zou het probleem alleen
  maar verstoppen.
- Print na afloop een tabel: welke migraties nieuw gedraaid zijn, welke
  al waren toegepast en dus overgeslagen werden.

### De SSL-instelling

De directe Supabase-verbinding eist TLS, maar de connectiestring uit het
dashboard bevat zelf geen `sslmode`-parameter en Node's ingebouwde
CA-bundel dekt niet op elke machine de certificaatketen van Supabase. Het
script zet daarom expliciet `ssl: { rejectUnauthorized: false }` — het
verkeer is versleuteld, alleen wordt de certificaatketen niet streng
geverifieerd. Voor een lokaal onderhoudsscript dat je tegen je eigen
database draait is dat een bewuste, gedocumenteerde afweging (zie het
commentaar in `scripts/supabase-migrate.mjs` zelf). Wil je volledige
certificaatverificatie: download het CA-certificaat onder
**Database → SSL Configuration** in het dashboard, zet
`NODE_EXTRA_CA_CERTS` op het pad naar dat bestand, en verander die regel
in het script in `rejectUnauthorized: true`.

## Vervolgstappen ná een geslaagde run

Deze twee stonden al in de opdracht van dit voorstel genoemd, en zijn geen
verzonnen extra stappen — het zijn dingen die al elders in dit project
staan toegelicht:

1. **RLS handmatig nalopen.** Vergelijk Supabase-dashboard
   → **Authentication → Policies** met de RLS-commentaarblokken die al in
   elke `supabase/portal/*.sql`-migratie staan (zoek op "RLS volgt het
   bestaande patroon"). Het uitgangspunt staat toegelicht in
   `0001_portal_schema.sql` (regel 167 e.v., de `---------- RLS ----------`
   sectie).
2. **`staff_users`-rij aanmaken.** Zonder die rij is er geen "staff" en
   werkt niets dat `is_staff()` vereist (beheer, facturen, teambeheer…).
   Maak in Supabase **Authentication** een gebruiker voor jezelf aan en
   zet zijn `auth.uid` in `staff_users` — het hele mechanisme (waarom, hoe
   `is_staff()` het gebruikt) staat toegelicht in `0001_portal_schema.sql`
   regel 1–26.

Voor de rest van de migratie-inhoud zelf (wat elke migratie doet en
waarom) blijft het kopregel-commentaar in elk `.sql`-bestand de bron —
die uitleg wordt hier niet herhaald of herschreven.

## Hoe dit getest is, zonder een live project

Er is (nog) geen echt Supabase-project om dit tegenaan te draaien. In
plaats daarvan is er een droogloop gebouwd met `@electric-sql/pglite` (een
in-memory Postgres, ook al in dit project geïnstalleerd) die de
migratielogica uit `scripts/supabase-migrate.mjs` hergebruikt — niet
gekopieerd — tegen de echte bestanden in deze map, en bewijst dat: de
volgorde klopt, een tweede run alles overslaat (idempotentie), en een
kapotte migratie halverwege netjes rollbackt en stopt zonder door te gaan.
Dat testscript leeft buiten dit project (in de scratchpad van de sessie
die dit gebouwd heeft) en is dus geen onderdeel van deze repository.
