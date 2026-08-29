-- ============================================================
-- CUSTOM+ klantportal — schema + Row Level Security
-- Draai dit één keer in de Supabase SQL editor van het portalproject.
-- Uitgangspunten:
--  * Elke klant (auth.uid) ziet uitsluitend rijen van zijn eigen projecten.
--  * Steffan is "staff": zijn auth.uid staat in staff_users en mag alles.
--  * Buckets zijn privé; bestanden worden ALTIJD via kortlevende signed
--    URLs geserveerd (mint gebeurt client-side via supabase-js createSignedUrl,
--    wat door storage-RLS alleen lukt voor eigen projectpaden of staff).
-- ============================================================

-- ---------- helpers ----------
create table if not exists staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table staff_users enable row level security;
create policy "staff can read staff list" on staff_users
  for select using (auth.uid() = user_id);

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_users where user_id = auth.uid());
$$;
revoke all on function is_staff() from public;
grant execute on function is_staff() to authenticated;

-- ---------- kern ----------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  company text not null,
  contact_name text not null,
  email text not null,
  phone text default '',
  notes text default '',          -- CRM-notities, alleen staff leest dit
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null,
  code text not null default '',            -- bv. REQ 0829
  status text not null default 'active'     -- active | archived
    check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- de zes vaste fases; seed per project
create table if not exists project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_key text not null check (stage_key in
    ('concept','dfm','sourcing','tooling','production','logistics')),
  position int not null,
  status text not null default 'upcoming'
    check (status in ('done','current','upcoming','awaiting_approval')),
  payment_pct int not null default 0,        -- 25/35/25/15 op de betaalfases
  approved_at timestamptz,
  unique (project_id, stage_key)
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_key text not null,
  label text not null,
  amount_cents bigint not null default 0,
  currency text not null default 'EUR',
  status text not null default 'open' check (status in ('open','paid','void')),
  storage_path text default '',              -- pdf in bucket project-docs
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists factories_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text default '',
  nnn_signed_at date
);
-- geen client-koppeling: namen zijn generiek zichtbaar per disclosure-regel

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_key text not null,
  kind text not null default 'photo' check (kind in ('photo','video')),
  storage_path text not null,
  caption text default '',
  factory_id uuid references factories_partners(id),
  captured_at date not null,
  batch_ref text default '',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_key text not null,
  doc_type text not null check (doc_type in
    ('nnn','quote','invoice','inspection','compliance','shipping','other')),
  title text not null,
  storage_path text not null,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists sample_rounds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  round_label text not null,                 -- T0, T1, ...
  media_id uuid references media_assets(id),
  status text not null default 'reviewed'
    check (status in ('reviewed','approved','superseded')),
  note text default '',                      -- "wat is aangepast"
  round_date date not null
);

create table if not exists inspection_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_key text not null,
  checkpoint text not null check (checkpoint in ('iqc','ipqc','fqc')),
  aql_norm text not null default 'ANSI/ASQ Z1.4 II',
  sample_size int not null,
  defects jsonb not null default '[]',       -- [{severity, count, note, media_id}]
  context_line text default '',
  report_date date not null,
  passed boolean not null default true
);

create table if not exists question_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  media_id uuid references media_assets(id),
  stage_key text default '',
  question text not null,
  answer text default '',
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists file_disclosures (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  document_id uuid references documents(id),
  factory_id uuid not null references factories_partners(id),
  disclosed_at date not null,
  under_nnn boolean not null default true
);

create table if not exists access_log (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects(id) on delete cascade,
  actor text not null default 'client',      -- client | staff | system
  asset_kind text not null,                  -- media | document | system
  asset_id uuid,
  action text not null,                      -- view | download | share | archive
  detail text default '',
  created_at timestamptz not null default now()
);

-- ---------- RLS ----------
create or replace function owns_project(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projects pr join clients c on c.id = pr.client_id
    where pr.id = p and c.auth_user_id = auth.uid()
  );
$$;
revoke all on function owns_project(uuid) from public;
grant execute on function owns_project(uuid) to authenticated;

alter table clients enable row level security;
create policy "client reads own row" on clients
  for select using (auth_user_id = auth.uid() or is_staff());
create policy "staff writes clients" on clients
  for all using (is_staff()) with check (is_staff());
-- NB: notes staat in deze tabel; de klant-app selecteert dit veld simpelweg
-- nooit, en de klant kan alleen zijn EIGEN rij zien — nooit een andere klant.

alter table projects enable row level security;
create policy "client reads own projects" on projects
  for select using (owns_project(id) or is_staff());
create policy "staff writes projects" on projects
  for all using (is_staff()) with check (is_staff());

-- generiek patroon voor alle projectgebonden tabellen
do $$
declare t text;
begin
  foreach t in array array[
    'project_stages','invoices','media_assets','documents','sample_rounds',
    'inspection_reports','file_disclosures'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "client reads own %s" on %I for select using (owns_project(project_id) or is_staff())', t, t);
    execute format(
      'create policy "staff writes %s" on %I for all using (is_staff()) with check (is_staff())', t, t);
  end loop;
end $$;

alter table question_threads enable row level security;
create policy "client reads own threads" on question_threads
  for select using (owns_project(project_id) or is_staff());
create policy "client asks on own project" on question_threads
  for insert with check (owns_project(project_id) and answer = '' and answered_at is null);
create policy "staff writes threads" on question_threads
  for update using (is_staff()) with check (is_staff());

alter table access_log enable row level security;
create policy "client reads own log" on access_log
  for select using (owns_project(project_id) or is_staff());
create policy "client logs own actions" on access_log
  for insert with check (owns_project(project_id) or is_staff());

alter table factories_partners enable row level security;
create policy "authenticated read factories" on factories_partners
  for select using (auth.role() = 'authenticated');
create policy "staff writes factories" on factories_partners
  for all using (is_staff()) with check (is_staff());

-- ---------- storage ----------
-- Maak in het dashboard twee PRIVATE buckets: project-media en project-docs.
-- Paden: {project_id}/{uuid}.{ext} — nooit klantnamen of volgnummers.
-- Policies (Storage > Policies, per bucket, target "authenticated"):
--
--   select (download/signed url):
--     bucket_id in ('project-media','project-docs')
--     and ( is_staff() or owns_project((storage.foldername(name))[1]::uuid) )
--
--   insert/update/delete: alleen staff:
--     bucket_id in ('project-media','project-docs') and is_staff()
--
-- Signed URLs: max 900 seconden (15 min) in de portal-app.
