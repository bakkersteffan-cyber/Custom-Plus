-- ============================================================
-- CUSTOM+ beheer — adminlaag
-- Draai dit ná 0001 t/m 0004 in de Supabase SQL editor.
-- Dit bestand groeit per bouwgolf: elke golf APPENDT hieronder een eigen,
-- duidelijk gecommentarieerd blok. RLS volgt het bestaande patroon uit
-- 0001_portal_schema.sql: is_staff() voor alles wat alleen Steffan raakt.
-- HER-UITVOERBAAR: elke create policy heeft een drop policy if exists
-- ervoor en alle DDL is if-not-exists-veilig, zodat je na elke nieuwe
-- golf gewoon het HELE bestand opnieuw kunt draaien.
-- ============================================================

-- ------------------------------------------------------------
-- GOLF 1 — vangnet + Vandaag-cockpit
-- De cockpit (functies 1/2/3/4/10/11) is puur afgeleide data en heeft géén
-- eigen tabellen. Wel nieuw: beheerinstellingen als key/value, te beginnen
-- met de stilte-drempel van de stille-zending-detector (functie 10).
-- Sleutels zijn snake_case ('stilte_drempel_dagen'); de waarde is jsonb
-- zodat latere instellingen (sjablonen, standaarden) hetzelfde vakje
-- kunnen gebruiken zonder schemawijziging.
-- ------------------------------------------------------------
create table if not exists admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table admin_settings enable row level security;
drop policy if exists "staff only admin_settings" on admin_settings;
create policy "staff only admin_settings" on admin_settings
  for all using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------
-- GOLF 2 — invoer-versnellers
-- Functie 15 (ongedaan maken op destructieve acties): verwijderde media en
-- documenten verhuizen 7 dagen naar deze prullenbak in plaats van hard weg.
-- payload = de volledige oorspronkelijke rij (snake_case) plus de ids van
-- rijen die ernaar verwezen (sample_rounds/question_threads bij media,
-- invoices/file_disclosures bij documenten), zodat terugzetten ook alle
-- koppelingen herstelt. Het beheer wist rijen ouder dan 7 dagen zelf bij
-- het openen van Instellingen. Alleen staff: de portal leest hier nooit.
-- De overige golf 2-functies (17 t/m 20, 41, 47 t/m 49, 54, 55, 57, 58)
-- zijn client-side of hergebruiken bestaande tabellen; de nieuwe
-- instelling 'zendingsduur_dagen' (functie 20) landt als gewone rij in
-- admin_settings hierboven.
-- ------------------------------------------------------------
create table if not exists admin_trash (
  id uuid primary key default gen_random_uuid(),
  kind text not null,            -- 'media' | 'document'
  payload jsonb not null,
  deleted_at timestamptz not null default now()
);
alter table admin_trash enable row level security;
drop policy if exists "staff only admin_trash" on admin_trash;
create policy "staff only admin_trash" on admin_trash
  for all using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------
-- GOLF 3 — geld klopt vanzelf + publiceren wordt een bewuste handeling
-- Functie 42 (conceptstand): media en documenten krijgen publish_status
-- 'concept' | 'published'. Default 'published' zodat ALLE bestaande rijen
-- zichtbaar blijven — migratie-veilig. De restrictive policies hieronder
-- zorgen dat een klant concepten ook op databaseniveau nooit kan lezen;
-- staff (Steffan) ziet alles, ook in de portal-voorvertoning (functie 46).
-- Functie 38 (projectwaarde): value_cents + value_currency op projects.
-- Functie 65 (factuurnummering/btw): extra kolommen op invoices; de
-- jaarteller zelf leeft als rij 'factuur_reeks' in admin_settings.
-- Functie 62 (mail-logboek): admin_mail_log, alleen staff.
-- ------------------------------------------------------------
alter table media_assets add column if not exists publish_status text not null default 'published';
alter table documents    add column if not exists publish_status text not null default 'published';

-- restrictive = AND met de bestaande leespolicies: klanten zien alleen
-- gepubliceerd, staff ziet alles (het bestaande is_staff()-patroon uit 0001)
drop policy if exists "concept media alleen staff" on media_assets;
create policy "concept media alleen staff" on media_assets
  as restrictive for select using (publish_status <> 'concept' or is_staff());
drop policy if exists "concept documenten alleen staff" on documents;
create policy "concept documenten alleen staff" on documents
  as restrictive for select using (publish_status <> 'concept' or is_staff());

alter table projects add column if not exists value_cents bigint;
alter table projects add column if not exists value_currency text not null default 'EUR';

alter table invoices add column if not exists invoice_number text not null default '';
alter table invoices add column if not exists vat_mode text not null default 'verlegd'; -- verlegd | 0 | 21
alter table invoices add column if not exists vat_cents bigint not null default 0;
alter table invoices add column if not exists total_cents bigint not null default 0;

create table if not exists admin_mail_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid,
  recipient text not null default '',
  subject text not null default '',
  category text not null default '',
  project_name text not null default '',
  body_line text not null default '',
  mode text not null default '',        -- demo | live
  status text not null default '',      -- demo | verzonden | fout | uit
  message_id text not null default '',  -- Resend message-id (bewijs)
  note text not null default '',
  created_at timestamptz not null default now()
);
alter table admin_mail_log enable row level security;
drop policy if exists "staff only admin_mail_log" on admin_mail_log;
create policy "staff only admin_mail_log" on admin_mail_log
  for all using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------
-- GOLF 4 — dagritme volwassen + de klant in één oogopslag
-- Functie 27 (contactmomenten-tijdlijn + follow-up-herinnering): de enige
-- nieuwe tabel van deze golf. Handmatige momenten (call/WhatsApp) met een
-- optionele herinnerdatum die in Vandaag verschijnt tot afgevinkt; de
-- automatische tijdlijngebeurtenissen komen live uit bestaande tabellen en
-- worden bewust NIET dubbel opgeslagen.
-- Functies 5/6/12 (snooze, bal-ligt-bij, pins), 23 (lifecycle-overrides) en
-- 7 (ochtendmail aan/uit + laatst-verstuurd) leven als rijen in het
-- bestaande admin_settings (sleutels 'item_state', 'lifecycle_overrides',
-- 'ochtendmail') — geen kolommen op vijf tabellen voor een eenmanszaak.
-- Alleen staff: de portal leest hier nooit.
-- ------------------------------------------------------------
create table if not exists admin_contact_moments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  kind text not null default 'call',      -- call | whatsapp | mail | anders
  note text not null default '',
  at date not null default current_date,  -- datum van het contact
  remind_at date,                         -- optionele follow-up-herinnering
  remind_done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table admin_contact_moments enable row level security;
drop policy if exists "staff only admin_contact_moments" on admin_contact_moments;
create policy "staff only admin_contact_moments" on admin_contact_moments
  for all using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------
-- GOLF 5 — instroom, communicatie en het grote publiceren
-- Functie 30 (portaaltaal per klant): portal_lang op clients; het portaal
-- leest hem als standaardtaal, klantmails kiezen er NL of EN mee.
-- Functie 29 (mailvoorkeuren per klant): mail_prefs als jsonb; een lege
-- map betekent 'alles aan', alleen expliciet uitgezette categorieën staan
-- erin als {"categorie": false} — migratie-veilig voor bestaande rijen.
-- Functie 28 (portaaluitnodiging): invited_at legt vast wanneer de
-- welkomstmail is verstuurd; 'Actief' wordt daarna afgeleid uit de eerste
-- klantregel in het bestaande access_log (geen extra kolom).
-- Functie 21 (site-briefs): admin_requests is de inbox voor aanvragen
-- vanaf de CUSTOM+-site. LET OP: de site-formulier-functie (Netlify) is
-- hier nog NIET op aangesloten — die schrijft straks met de service-role
-- key rechtstreeks in deze tabel; tot die tijd vult alleen het beheer hem.
-- Functie 26 (contactpersonen): admin_contacts, met cats als jsonb-array
-- van mailcategorieën ('fase','update','sample','zending','factuur',
-- 'relatie'). Beide tabellen alleen staff: de portal leest ze nooit.
-- Functie 43 (update-composer): update_id + update_note op media_assets;
-- de portal groepeert foto's met dezelfde update_id en toont de tekst
-- erboven. De klant mag dit lezen (het is klantgerichte inhoud), dus geen
-- extra policy nodig — de bestaande media-leespolicies dekken het en de
-- concept-restrictie uit golf 3 houdt ongepubliceerde updates verborgen.
-- Functie 45 (geplande publicatie): scheduled_at op media_assets en
-- documents. Het beheer flipt vervallen momenten bij het eerstvolgende
-- bezoek (eerlijk in de UI vermeld). SERVERVARIANT (optioneel, later):
-- een Supabase Scheduled Edge Function of pg_cron-job die elke 5 minuten
--   update media_assets set publish_status='published', published_at=now()
--     where publish_status='concept' and scheduled_at <= now();
--   (idem voor documents) draait en daarna per project één bundelmail via
--   Resend verstuurt; tot die bestaat is de flip-bij-bezoek de waarheid.
-- Functies 66/67 (mailsjablonen, onderwerpregels) en 22 (herbestel-
-- pijplijnstadia) leven als rijen in admin_settings (sleutels
-- 'mail_sjablonen', 'mail_onderwerpen', 'reorder_pipeline') — geen DDL.
-- ------------------------------------------------------------
alter table clients add column if not exists portal_lang text not null default 'nl';
alter table clients add column if not exists mail_prefs jsonb not null default '{}'::jsonb;
alter table clients add column if not exists invited_at timestamptz;

create table if not exists admin_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  company text not null default '',
  lang text not null default 'nl',
  product text not null default '',
  status text not null default 'nieuw',   -- nieuw | omgezet
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table admin_requests enable row level security;
drop policy if exists "staff only admin_requests" on admin_requests;
create policy "staff only admin_requests" on admin_requests
  for all using (is_staff()) with check (is_staff());

create table if not exists admin_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null default '',
  role text not null default '',
  email text not null default '',
  lang text not null default 'nl',
  cats jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table admin_contacts enable row level security;
drop policy if exists "staff only admin_contacts" on admin_contacts;
create policy "staff only admin_contacts" on admin_contacts
  for all using (is_staff()) with check (is_staff());

alter table media_assets add column if not exists update_id text not null default '';
alter table media_assets add column if not exists update_note text not null default '';
alter table media_assets add column if not exists scheduled_at timestamptz;
alter table documents    add column if not exists scheduled_at timestamptz;

-- ------------------------------------------------------------
-- GOLF 6 — dossiers, veiligheid en de brug naar live
-- Functie 52 (documentslots met status 'verwacht'): doc_slots. De KLANT
-- leest deze tabel wél (zijn drive toont "wordt verwacht in fase X" als
-- eerlijke lege staat), dus lezen volgt het owns_project-patroon uit 0001;
-- schrijven blijft staff-only.
-- Functie 63 (systeem-auditlog): admin_audit_log, alleen staff — het
-- klant-toegangslogboek (access_log) blijft exclusief voor wat de klant
-- zelf deed.
-- Geen DDL nodig voor de rest van deze golf:
--  * 32 (toegangsherstel/sessies intrekken) loopt via Supabase Auth
--    (resetPasswordForEmail) + de Netlify-functie
--    netlify/functions/admin-revoke-sessions.mjs (env vars SUPABASE_URL,
--    SUPABASE_SERVICE_ROLE_KEY, NOTIFY_SHARED_SECRET) — de service-role
--    key komt nooit in de browser;
--  * 33 (nieuw-apparaat-signalering) lift mee op access_log.detail
--    (de portal schrijft ' — apparaat: Browser · OS · Tijdzone' achter
--    klant-logregels; regels van vóór deze golf hebben die info niet en
--    worden eerlijk overgeslagen);
--  * 35/60 (offboarding/dossier-export) zijn samenstellingen van
--    bestaande rijen; 37 (onboarding-checklist) is puur afgeleide data;
--  * 40 (projectsjablonen) leeft als sleutels 'project_sjablonen' en
--    'project_defaults' in admin_settings;
--  * 51 (kopieer naar ander project) hergebruikt media_assets/documents;
--  * 53 (typeherkenning) is client-side; 56 (foto aan defectrij) schrijft
--    media_id in de bestaande jsonb-kolom inspection_reports.defects;
--  * 68 (boekhouding-CSV) is client-side; 70 (go-live-checklist) leeft
--    als sleutel 'go_live' in admin_settings.
-- ------------------------------------------------------------
create table if not exists doc_slots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  doc_type text not null check (doc_type in
    ('nnn','quote','invoice','inspection','compliance','shipping','other')),
  stage_key text not null default 'concept',
  status text not null default 'verwacht' check (status in ('verwacht','gevuld')),
  document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table doc_slots enable row level security;
drop policy if exists "client reads own doc_slots" on doc_slots;
create policy "client reads own doc_slots" on doc_slots
  for select using (owns_project(project_id) or is_staff());
drop policy if exists "staff writes doc_slots" on doc_slots;
create policy "staff writes doc_slots" on doc_slots
  for all using (is_staff()) with check (is_staff());

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'overig',   -- mail | publicatie | preview | toegang | offboarding | overig
  client_id uuid references clients(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
alter table admin_audit_log enable row level security;
drop policy if exists "staff only admin_audit_log" on admin_audit_log;
create policy "staff only admin_audit_log" on admin_audit_log
  for all using (is_staff()) with check (is_staff());

-- ------------------------------------------------------------
-- FIXRONDE (reviewbevinding R1-2) — meldingstijd van laat gepubliceerde
-- concepten. Het beheer zet published_at op het moment van publiceren
-- (publiceerknop, composer of geplande publicatie); de portal gebruikt
-- published_at || created_at als meldingstijd, zodat een concept dat
-- dagen na de upload wordt gepubliceerd niet met zijn upload-datum
-- diep in het meldingenpaneel wegzakt. Bestaande rijen houden null en
-- vallen dus terug op created_at — migratie-veilig.
-- ------------------------------------------------------------
alter table media_assets add column if not exists published_at timestamptz;
alter table documents    add column if not exists published_at timestamptz;
