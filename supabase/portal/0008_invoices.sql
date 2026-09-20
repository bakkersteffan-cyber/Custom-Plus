-- ============================================================
-- CUSTOM+ — FACTUURMODULE, HET VOLLEDIGE DATAMODEL
-- Draai dit als laatste in de Supabase SQL editor: ná 0001 t/m 0006 en ná
-- een eventuele 0007 uit een parallelle fase.
--
-- HER-UITVOERBAAR: alle DDL is if-not-exists-veilig, elke create policy
-- heeft een drop policy if exists ervóór en elke constraint zit in een
-- do-blok dat duplicate_object opvangt. Je kunt dit bestand dus zo vaak
-- draaien als je wilt.
--
-- RLS volgt exact het bestaande patroon uit 0001_portal_schema.sql:
--   is_staff()        → alles wat alleen de beheerder aangaat
--   owns_project(id)  → wat de klant van zijn eigen project mag zien
-- Nieuw hier is owns_invoice(id): dezelfde gedachte, één laag dieper,
-- zodat factuurregels en betalingen niet elk hun eigen subquery hoeven.
--
-- WAT DIT BESTAND WEL DOET: het schema in één keer goed neerzetten voor
-- de hele module (fase 4 en 5 vullen de logica van herinneringen, tokens,
-- terugkerende profielen en UBL). WAT HET NIET DOET: bestaande kolommen
-- weggooien of hernoemen. invoices.status ('open'|'paid'|'void') uit
-- 0001 blijft staan en blijft werken; het nieuwe twaalfstatussenmodel
-- leeft naast hem in status_code. Zo blijft elk scherm dat nog niet is
-- omgebouwd gewoon draaien.
-- ============================================================


-- ------------------------------------------------------------
-- 1. BTW-CODES
-- De rekenkern (portal/invoice-core.js) kent dezelfde standaardreeks als
-- fallback; deze tabel is de bewerkbare bron. rate_milli is het
-- percentage × 1000 — 21% is 21000 en 5,5% is 5500 — zodat een tarief
-- nooit een kommagetal hoeft te zijn. treatment bepaalt of er btw wordt
-- gerekend en welke wettelijke vermelding op de factuur hoort; die
-- vermelding staat in de code, niet hier, omdat hij vertaald moet worden
-- naar de taal van de klant.
-- ------------------------------------------------------------
create table if not exists tax_codes (
  code text primary key,
  label text not null default '',
  rate_milli integer not null default 0,
  treatment text not null default 'standard'
    check (treatment in ('standard','zero','exempt','reverse','intracom')),
  legal_note text not null default '',        -- vrije aanvulling; leeg = de standaardtekst uit de rekenkern
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
alter table tax_codes enable row level security;
-- lezen mag elke ingelogde gebruiker: het portaal toont het btw-tarief bij
-- een factuurregel, en een btw-percentage is geen geheim. Schrijven is
-- uitsluitend beheer.
drop policy if exists "authenticated read tax_codes" on tax_codes;
create policy "authenticated read tax_codes" on tax_codes
  for select using (auth.role() = 'authenticated');
drop policy if exists "staff writes tax_codes" on tax_codes;
create policy "staff writes tax_codes" on tax_codes
  for all using (is_staff()) with check (is_staff());

insert into tax_codes (code, label, rate_milli, treatment, sort) values
  ('NL21',    'Btw 21%',            21000, 'standard', 10),
  ('NL9',     'Btw 9%',              9000, 'standard', 20),
  ('NL0',     'Btw 0% (export)',        0, 'zero',     30),
  ('VRIJ',    'Vrijgesteld',            0, 'exempt',   40),
  ('VERLEGD', 'Btw verlegd',            0, 'reverse',  50),
  ('ICP',     'Intracommunautair',      0, 'intracom', 60)
on conflict (code) do nothing;


-- ------------------------------------------------------------
-- 2. NUMMERREEKSEN
-- Per administratie een eigen reeks, met prefix/suffix, jaar- en
-- eventueel maandpatroon en een instelbaar startnummer. current_value is
-- het LAATST UITGEGEVEN nummer; de volgende claim is current_value + 1,
-- of start_value bij een periodewissel wanneer reset_period dat zegt.
--
-- LET OP — dit vervangt claim_invoice_number() uit 0005_admin.sql NIET.
-- Die functie is de werkende atomaire uitgifte van golf 1 en blijft de
-- enige plek die nummers uitgeeft tot de fase die de reeksen aanzet hem
-- hierop overzet. Deze tabel is voorlopig het datamodel eronder.
-- ------------------------------------------------------------
create table if not exists number_series (
  id uuid primary key default gen_random_uuid(),
  administration text not null default 'CP',
  kind text not null default 'invoice' check (kind in ('invoice','credit_note')),
  label text not null default '',
  prefix text not null default '',
  suffix text not null default '',
  use_year boolean not null default true,
  use_month boolean not null default false,
  separator text not null default '-',
  pad_length integer not null default 4 check (pad_length between 1 and 12),
  start_value integer not null default 1 check (start_value >= 0),
  current_value integer not null default 0 check (current_value >= 0),
  current_year integer,
  current_month integer check (current_month is null or current_month between 1 and 12),
  reset_period text not null default 'year' check (reset_period in ('never','year','month')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- één actieve reeks per administratie per soort: twee reeksen die tegelijk
-- nummers uitgeven voor dezelfde administratie is precies het scenario dat
-- dubbele factuurnummers oplevert.
create unique index if not exists number_series_active_uniq
  on number_series (administration, kind) where active;
alter table number_series enable row level security;
drop policy if exists "staff only number_series" on number_series;
create policy "staff only number_series" on number_series
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 3. NUMMER-AUDIT
-- Elk uitgegeven, geannuleerd of gecorrigeerd nummer met reden en actor.
-- Een factuurnummer mag nooit spoorloos verdwijnen: een gat in de reeks
-- moet je kunnen uitleggen aan de Belastingdienst, en dat uitleggen
-- gebeurt hier.
-- ------------------------------------------------------------
create table if not exists number_audit (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references number_series(id) on delete set null,
  administration text not null default 'CP',
  invoice_id uuid references invoices(id) on delete set null,
  number_text text not null,
  event text not null default 'issued' check (event in ('issued','cancelled','corrected','skipped')),
  reason text not null default '',
  actor text not null default '',              -- e-mailadres of 'systeem'
  created_at timestamptz not null default now()
);
create index if not exists number_audit_number_idx on number_audit (administration, number_text);
create index if not exists number_audit_invoice_idx on number_audit (invoice_id);
alter table number_audit enable row level security;
drop policy if exists "staff only number_audit" on number_audit;
create policy "staff only number_audit" on number_audit
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 4. INVOICES — UITBREIDING
-- Alle kopvelden uit de spec. Bewust allemaal met een default, zodat
-- bestaande rijen zonder migratiestap geldig blijven.
-- ------------------------------------------------------------

-- administratie en reeks
alter table invoices add column if not exists administration text not null default 'CP';
alter table invoices add column if not exists series_id uuid references number_series(id) on delete set null;
alter table invoices add column if not exists doc_kind text not null default 'invoice';
alter table invoices add column if not exists credit_of_invoice_id uuid references invoices(id) on delete set null;
alter table invoices add column if not exists recurring_profile_id uuid;

-- het twaalfstatussenmodel, naast de oude status-kolom uit 0001
alter table invoices add column if not exists status_code text not null default 'draft';

-- referenties van de klant
alter table invoices add column if not exists client_reference text not null default '';
alter table invoices add column if not exists purchase_order text not null default '';
alter table invoices add column if not exists cost_center text not null default '';

-- datums en termijnen
alter table invoices add column if not exists invoice_date date;
alter table invoices add column if not exists delivery_start date;   -- prestatiedatum, of begin van de periode
alter table invoices add column if not exists delivery_end date;     -- leeg bij één datum
alter table invoices add column if not exists payment_term_days integer not null default 14;
alter table invoices add column if not exists due_date date;

-- presentatie
alter table invoices add column if not exists language text not null default 'nl';
alter table invoices add column if not exists template text not null default 'standaard';

-- teksten
alter table invoices add column if not exists internal_note text not null default '';       -- NOOIT zichtbaar voor de klant
alter table invoices add column if not exists intro_text text not null default '';
alter table invoices add column if not exists outro_text text not null default '';
alter table invoices add column if not exists payment_instructions text not null default '';

-- tags en indeling
alter table invoices add column if not exists tags text[] not null default '{}';

-- rekenstand
alter table invoices add column if not exists prices_include_vat boolean not null default false;
alter table invoices add column if not exists invoice_discount_type text not null default 'none';
alter table invoices add column if not exists invoice_discount_value bigint not null default 0;  -- pctMilli bij percent, centen bij amount

-- bewaarde totalen — alles in centen (bigint), nooit numeric/float.
-- amount_cents / vat_cents / total_cents uit 0001+0005 blijven staan en
-- houden dezelfde betekenis; deze kolommen maken de specificatie compleet.
alter table invoices add column if not exists subtotal_cents bigint not null default 0;
alter table invoices add column if not exists line_discount_cents bigint not null default 0;
alter table invoices add column if not exists invoice_discount_cents bigint not null default 0;
alter table invoices add column if not exists surcharge_cents bigint not null default 0;
alter table invoices add column if not exists total_excl_cents bigint not null default 0;
alter table invoices add column if not exists total_vat_cents bigint not null default 0;
alter table invoices add column if not exists total_incl_cents bigint not null default 0;
alter table invoices add column if not exists paid_cents bigint not null default 0;
alter table invoices add column if not exists credited_cents bigint not null default 0;
alter table invoices add column if not exists outstanding_cents bigint not null default 0;

-- ONVERANDERLIJKE SNAPSHOT (spec, stap 5 van definitief maken).
-- Bij het definitief maken gaat de volledige factuur — klant-, bedrijfs-,
-- adres-, regel- en belastinggegevens plus alle berekende bedragen — als
-- jsonb hierin. Vanaf dat moment is DIT de factuur; de losse kolommen en
-- invoice_lines zijn nog slechts de bewerkbare voorstelling. Een latere
-- huisstijl- of adreswijziging raakt een verstuurde factuur dus nooit.
alter table invoices add column if not exists snapshot jsonb;
alter table invoices add column if not exists snapshot_at timestamptz;

-- momenten
alter table invoices add column if not exists finalized_at timestamptz;
alter table invoices add column if not exists sent_at timestamptz;
alter table invoices add column if not exists first_viewed_at timestamptz;
alter table invoices add column if not exists last_viewed_at timestamptz;
alter table invoices add column if not exists cancelled_at timestamptz;
alter table invoices add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table invoices add constraint invoices_status_code_check
    check (status_code in ('draft','scheduled','finalized','sent','viewed',
                           'partially_paid','paid','overdue','disputed',
                           'cancelled','credited','uncollectible'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table invoices add constraint invoices_doc_kind_check
    check (doc_kind in ('invoice','credit_note'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table invoices add constraint invoices_discount_type_check
    check (invoice_discount_type in ('none','percent','amount'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table invoices add constraint invoices_payment_term_check
    check (payment_term_days >= 0 and payment_term_days <= 3650);
exception when duplicate_object then null;
end $$;

-- vervaldatum mag nooit vóór de factuurdatum liggen
do $$
begin
  alter table invoices add constraint invoices_due_after_invoice_date
    check (due_date is null or invoice_date is null or due_date >= invoice_date);
exception when duplicate_object then null;
end $$;

-- een periode loopt niet achteruit
do $$
begin
  alter table invoices add constraint invoices_delivery_period_check
    check (delivery_end is null or delivery_start is null or delivery_end >= delivery_start);
exception when duplicate_object then null;
end $$;

-- een creditfactuur verwijst niet naar zichzelf
do $$
begin
  alter table invoices add constraint invoices_credit_not_self
    check (credit_of_invoice_id is null or credit_of_invoice_id <> id);
exception when duplicate_object then null;
end $$;

-- UNIEK NUMMER PER ADMINISTRATIE (spec: "unieke databaseconstraint per
-- administratie"). De globale unique index uit 0005_admin.sql blijft als
-- extra vangnet staan; deze is de constraint die de spec vraagt en die
-- meegroeit zodra er ooit een tweede administratie bij komt.
do $$
begin
  begin
    create unique index if not exists invoices_admin_number_uniq
      on invoices (administration, invoice_number)
      where invoice_number <> '';
  exception when others then
    raise notice 'invoices_admin_number_uniq niet aangelegd (%): er staan dubbele nummers in de tabel.', sqlerrm;
  end;
end $$;

-- backfill van het statusmodel. Idempotent: een factuur die al gepubliceerd
-- is, staat nooit legitiem op 'draft' (de transitietabel in de rekenkern
-- verbiedt de weg terug), dus een tweede run raakt niets meer aan.
update invoices
   set status_code = case
         when publish_status = 'concept' then 'draft'
         when status = 'paid' then 'paid'
         when status = 'void' then 'cancelled'
         else 'finalized'
       end
 where status_code = 'draft' and publish_status <> 'concept';

-- vervaldatum invullen waar hij ontbreekt maar wel af te leiden is
update invoices
   set due_date = coalesce(invoice_date, created_at::date) + payment_term_days
 where due_date is null and (invoice_date is not null or created_at is not null);

create index if not exists invoices_project_status_idx on invoices (project_id, status_code);
create index if not exists invoices_due_open_idx on invoices (due_date)
  where status_code in ('finalized','sent','viewed','partially_paid','overdue');
create index if not exists invoices_credit_of_idx on invoices (credit_of_invoice_id)
  where credit_of_invoice_id is not null;
create index if not exists invoices_recurring_idx on invoices (recurring_profile_id)
  where recurring_profile_id is not null;


-- ------------------------------------------------------------
-- 5. OWNS_INVOICE — de leeshulp voor alles wat aan een factuur hangt
-- Zelfde gedachte als owns_project(): security definer, vast search_path,
-- geen execute-recht voor anon. Een CONCEPTfactuur telt bewust niet als
-- "van de klant" — die bestaat voor hem nog niet, precies zoals de
-- restrictive policy uit 0005_admin.sql het al regelt.
-- ------------------------------------------------------------
create or replace function owns_invoice(inv uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invoices i
     where i.id = inv
       and i.publish_status <> 'concept'
       and i.status_code not in ('draft','scheduled')
       and owns_project(i.project_id)
  );
$$;
revoke all on function owns_invoice(uuid) from public;
grant execute on function owns_invoice(uuid) to authenticated;


-- ------------------------------------------------------------
-- 6. FACTUURREGELS
-- Alle regelvelden uit de spec. Bedragen zijn bigint centen; het aantal is
-- quantity_micro (aantal × 1.000.000) zodat 2,5 uur een geheel getal is en
-- er nergens een kommagetal in de berekening kruipt. Het kortingsveld
-- draagt pct_milli bij 'percent' en centen bij 'amount' — één kolom, de
-- soort staat ernaast.
--
-- De berekende bedragen worden BEWAARD en niet alleen berekend: een
-- definitieve factuur moet je over vijf jaar nog exact kunnen tonen, ook
-- als de rekenkern intussen een tarief anders afrondt. De snapshot op de
-- factuur is de harde waarheid; deze kolommen zijn de werkkopie.
-- ------------------------------------------------------------
create table if not exists invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  sort integer not null default 0,
  line_type text not null default 'item' check (line_type in ('item','text','heading')),
  description text not null default '',
  detail text not null default '',
  quantity_micro bigint not null default 1000000,
  unit text not null default '',                       -- uur | stuk | dag | abonnement | vrij
  unit_price_cents bigint not null default 0,
  price_includes_vat boolean not null default false,
  discount_type text not null default 'none' check (discount_type in ('none','percent','amount')),
  discount_value bigint not null default 0,            -- pct_milli of centen, zie discount_type
  tax_code text references tax_codes(code) on delete restrict,
  rate_milli integer not null default 0,               -- vastgelegd tarief op het moment van rekenen
  treatment text not null default 'standard',
  ledger_ref text not null default '',                 -- grootboekrekening
  product_ref text not null default '',                -- artikel-/productcode
  -- berekende bedragen, allemaal exclusief btw tenzij de naam anders zegt
  gross_excl_cents bigint not null default 0,
  discount_excl_cents bigint not null default 0,
  net_excl_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  incl_cents bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists invoice_lines_invoice_idx on invoice_lines (invoice_id, sort);
alter table invoice_lines enable row level security;
drop policy if exists "client reads own invoice_lines" on invoice_lines;
create policy "client reads own invoice_lines" on invoice_lines
  for select using (owns_invoice(invoice_id) or is_staff());
drop policy if exists "staff writes invoice_lines" on invoice_lines;
create policy "staff writes invoice_lines" on invoice_lines
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 7. BETALINGEN
-- Meerdere deelbetalingen per factuur. Corrigeren en terugboeken gebeurt
-- met een NIEUWE regel met een negatief bedrag en een verwijzing naar de
-- oorspronkelijke betaling — nooit door een bestaande rij te herschrijven,
-- want dan verdwijnt het audittrail dat de spec vraagt.
-- ------------------------------------------------------------
create table if not exists invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  paid_on date not null default current_date,
  amount_cents bigint not null,                        -- negatief = terugboeking
  currency text not null default 'EUR',
  rate_to_eur numeric(18,6) check (rate_to_eur is null or rate_to_eur > 0),
  method text not null default 'overboeking',          -- overboeking | ideal | contant | verrekening | overig
  transaction_ref text not null default '',
  internal_note text not null default '',
  proof_document_id uuid references documents(id) on delete set null,
  reverses_payment_id uuid references invoice_payments(id) on delete set null,
  provider text not null default '',                   -- abstracte payment-provider, leeg bij handmatig
  provider_event_id text not null default '',          -- idempotentiesleutel voor toekomstige webhooks
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_idx on invoice_payments (invoice_id, paid_on);
-- webhook-idempotentie: dezelfde providergebeurtenis kan nooit twee keer
-- als betaling landen, ook niet als de provider hem drie keer aflevert
create unique index if not exists invoice_payments_provider_event_uniq
  on invoice_payments (provider, provider_event_id)
  where provider <> '' and provider_event_id <> '';
alter table invoice_payments enable row level security;
-- de klant mag zien wat er op ZIJN factuur is afgeboekt: dat is precies wat
-- het openstaande bedrag in het portaal verklaart. internal_note selecteert
-- de portal nooit, net zoals bij clients.notes.
drop policy if exists "client reads own invoice_payments" on invoice_payments;
create policy "client reads own invoice_payments" on invoice_payments
  for select using (owns_invoice(invoice_id) or is_staff());
drop policy if exists "staff writes invoice_payments" on invoice_payments;
create policy "staff writes invoice_payments" on invoice_payments
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 8. HERINNERINGEN
-- step: 0 = vriendelijke herinnering vóór de vervaldatum, 1/2 = eerste en
-- tweede na de vervaldatum, 3 = laatste aanmaning, 99 = losse handmatige
-- herinnering. wait_days is het aantal dagen ten opzichte van de
-- vervaldatum (negatief bij step 0).
-- ------------------------------------------------------------
create table if not exists invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  step integer not null default 1,
  wait_days integer not null default 0,
  planned_for date,
  status text not null default 'gepland'
    check (status in ('gepland','gepauzeerd','verzonden','overgeslagen','fout')),
  subject text not null default '',
  body text not null default '',
  tone text not null default 'vriendelijk' check (tone in ('vriendelijk','neutraal','stevig')),
  sent_at timestamptz,
  mail_message_id text not null default '',
  error_detail text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists invoice_reminders_invoice_idx on invoice_reminders (invoice_id, step);
create index if not exists invoice_reminders_planned_idx on invoice_reminders (planned_for)
  where status = 'gepland';
alter table invoice_reminders enable row level security;
drop policy if exists "staff only invoice_reminders" on invoice_reminders;
create policy "staff only invoice_reminders" on invoice_reminders
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 9. KLANTLINK-TOKENS
-- "Moeilijk te raden, intrekbare tokens; geen gevoelige info in
-- voorspelbare URL's." Daarom staat hier NOOIT het token zelf maar
-- uitsluitend de SHA-256-hash ervan: lekt deze tabel, dan lekken de
-- links niet. Intrekken is revoked_at zetten; de rij blijft staan omdat
-- het gebruik ervan bewijsbaar moet blijven.
-- ------------------------------------------------------------
create table if not exists invoice_tokens (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  token_hash text not null,
  purpose text not null default 'view' check (purpose in ('view','pay','download')),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text not null default '',
  use_count integer not null default 0,
  first_used_at timestamptz,
  last_used_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists invoice_tokens_hash_uniq on invoice_tokens (token_hash);
create index if not exists invoice_tokens_invoice_idx on invoice_tokens (invoice_id);
alter table invoice_tokens enable row level security;
-- bewust GEEN leesrecht voor de klant: een token controleer je server-side
-- (Netlify Function met de service role), nooit vanuit de browser.
drop policy if exists "staff only invoice_tokens" on invoice_tokens;
create policy "staff only invoice_tokens" on invoice_tokens
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 10. E-MAIL- EN WEERGAVEGEBEURTENISSEN
-- Verzendpoging, bezorgstatus, bounce, opening, eerste/laatste weergave
-- van de klantpagina, downloads en fouten — één tabel, één tijdlijn.
-- 'opened' wordt alleen weggeschreven als openingsregistratie expliciet
-- is aangezet; zonder die instelling komt die gebeurtenis er nooit in.
-- ------------------------------------------------------------
create table if not exists invoice_email_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  event text not null
    check (event in ('queued','sent','delivered','bounced','complained','opened',
                     'clicked','portal_viewed','pdf_downloaded','failed')),
  recipient text not null default '',
  template_key text not null default '',
  mail_message_id text not null default '',
  detail text not null default '',
  occurred_at timestamptz not null default now()
);
create index if not exists invoice_email_events_invoice_idx on invoice_email_events (invoice_id, occurred_at);
alter table invoice_email_events enable row level security;
drop policy if exists "staff only invoice_email_events" on invoice_email_events;
create policy "staff only invoice_email_events" on invoice_email_events
  for all using (is_staff()) with check (is_staff());
-- de klant mag zijn eigen weergave-gebeurtenis vastleggen (portal_viewed /
-- pdf_downloaded), net zoals hij dat in access_log al mag. Lezen doet hij
-- ze niet: het logboek is een beheerinstrument.
drop policy if exists "client logs own invoice views" on invoice_email_events;
create policy "client logs own invoice views" on invoice_email_events
  for insert with check (
    owns_invoice(invoice_id) and event in ('portal_viewed','pdf_downloaded')
  );


-- ------------------------------------------------------------
-- 11. TERUGKERENDE PROFIELEN
-- Het profiel staat LOS van de facturen die eruit rollen: wie het profiel
-- aanpast, verandert nooit met terugwerkende kracht een al verstuurde
-- factuur. lines_template is de regelset als jsonb in exact de vorm die de
-- rekenkern eet. last_period_key maakt de generatie idempotent — twee keer
-- draaien voor '2026-03' levert nooit twee facturen op.
-- ------------------------------------------------------------
create table if not exists recurring_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null default '',
  frequency text not null default 'month'
    check (frequency in ('week','month','quarter','half_year','year')),
  interval_count integer not null default 1 check (interval_count between 1 and 24),
  start_date date not null default current_date,
  end_date date,
  next_run_date date,
  last_period_key text not null default '',       -- bv. '2026-03'; idempotentiesleutel
  timezone text not null default 'Europe/Amsterdam',
  payment_term_days integer not null default 14,
  language text not null default 'nl',
  template text not null default 'standaard',
  currency text not null default 'EUR',
  prices_include_vat boolean not null default false,
  lines_template jsonb not null default '[]'::jsonb,
  surcharges_template jsonb not null default '[]'::jsonb,
  auto_finalize boolean not null default false,
  auto_send boolean not null default false,
  indexation_pct_milli integer not null default 0,   -- prijsindexering; 0 = uit, alleen na expliciete configuratie
  indexation_applies_from date,
  status text not null default 'actief' check (status in ('actief','gepauzeerd','beeindigd','fout')),
  error_detail text not null default '',
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurring_profiles_next_idx on recurring_profiles (next_run_date)
  where status = 'actief';
create index if not exists recurring_profiles_project_idx on recurring_profiles (project_id);
alter table recurring_profiles enable row level security;
drop policy if exists "staff only recurring_profiles" on recurring_profiles;
create policy "staff only recurring_profiles" on recurring_profiles
  for all using (is_staff()) with check (is_staff());

-- de verwijzing vanaf de gegenereerde factuur, nu de tabel bestaat
do $$
begin
  alter table invoices add constraint invoices_recurring_profile_fk
    foreign key (recurring_profile_id) references recurring_profiles(id) on delete set null;
exception when duplicate_object then null;
end $$;


-- ------------------------------------------------------------
-- 12. UBL-EXPORTS
-- Provider-onafhankelijk: de interne representatie is de snapshot, dit is
-- de verzonden XML plus zijn status. document_kind onderscheidt factuur en
-- creditnota, want dat zijn in UBL twee verschillende documenttypen.
-- Achter een feature flag tot er echt een Peppol-provider hangt.
-- ------------------------------------------------------------
create table if not exists ubl_exports (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  document_kind text not null default 'invoice' check (document_kind in ('invoice','credit_note')),
  profile text not null default 'peppol-bis-3',
  xml text not null default '',
  status text not null default 'concept'
    check (status in ('concept','gevalideerd','verzonden','afgewezen','fout')),
  validation_errors jsonb not null default '[]'::jsonb,
  provider text not null default '',
  provider_ref text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ubl_exports_invoice_idx on ubl_exports (invoice_id, created_at);
alter table ubl_exports enable row level security;
drop policy if exists "staff only ubl_exports" on ubl_exports;
create policy "staff only ubl_exports" on ubl_exports
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 13. FACTUUR-AUDIT
-- Elke gebeurtenis op een factuur, met een before/after als er iets
-- wijzigde. Dit is de tabel waar stap 7 van "definitief maken" in landt en
-- waar elke AI-actie zijn spoor achterlaat (de spec: loggen DAT AI is
-- gebruikt, niet de volledige prompt).
-- ------------------------------------------------------------
create table if not exists invoice_audit (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete set null,
  event text not null default 'gewijzigd',
  from_status text not null default '',
  to_status text not null default '',
  detail text not null default '',
  changes jsonb,
  actor text not null default '',
  ai_used boolean not null default false,
  ai_model text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists invoice_audit_invoice_idx on invoice_audit (invoice_id, created_at);
alter table invoice_audit enable row level security;
drop policy if exists "staff only invoice_audit" on invoice_audit;
create policy "staff only invoice_audit" on invoice_audit
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 14. INSTELLINGEN
-- Geen eigen tabel: de factuurmodule leunt op admin_settings uit
-- 0005_admin.sql, dat al staff-only is. Deze sleutels worden hier
-- aangemaakt zodat een verse omgeving ze heeft.
--   factuur_tolerantie_centen  betaalverschil dat als betaald geldt (0 = uit)
--   factuur_rente_incasso      rente/incassokosten; standaard volledig uit,
--                              nooit automatisch toegevoegd (spec)
--   factuur_ai                 AI-functies per administratie aan/uit
--   factuur_ubl                feature flag voor de e-facturatie-export
--   factuur_openingsregistratie e-mailopeningen wel/niet loggen
-- ------------------------------------------------------------
insert into admin_settings(key, value) values
  ('factuur_tolerantie_centen', '{"centen": 0}'::jsonb),
  ('factuur_rente_incasso', '{"aan": false, "rente_pct_milli": 0, "incasso_centen": 0}'::jsonb),
  ('factuur_ai', '{"aan": false}'::jsonb),
  ('factuur_ubl', '{"aan": false}'::jsonb),
  ('factuur_openingsregistratie', '{"aan": false}'::jsonb)
on conflict (key) do nothing;
