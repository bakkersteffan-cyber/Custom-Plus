-- ============================================================
-- CUSTOM+ — FACTUUR PER E-MAIL, BEVEILIGDE KLANTPAGINA EN TRACKING
-- Draai dit na 0010_factuur_pdf.sql.
--
-- HER-UITVOERBAAR: elke kolom is add-column-if-not-exists, elke index is
-- if-not-exists, elke policy heeft een drop-policy ervoor en elke functie
-- is create-or-replace. Je kunt dit bestand dus zo vaak draaien als je
-- wilt.
--
-- WAT DIT BESTAND DOET
--   1. invoice_email_events krijgt de velden die tracking bruikbaar maken:
--      een provider-gebeurtenis-id (met unieke index, want daarop is de
--      webhook idempotent), het onderwerp, de cc/bcc-telling en het
--      moment waarvoor een verzending was ingepland;
--   2. invoice_tokens krijgt een label en een 'laatste user agent', zodat
--      het beheer kan zien welke link wanneer is gebruikt zonder dat
--      daarvoor het token zelf nodig is;
--   3. een nieuwe tabel invoice_mail_queue voor ingeplande verzendingen;
--   4. twee kolommen op invoices: pay_url (de optionele betaallink) en
--      last_sent_at;
--   5. twee SECURITY DEFINER-functies die de Netlify Function gebruikt om
--      een token te verzilveren zonder ooit de tokentabel te hoeven lezen
--      vanuit de browser.
--
-- ------------------------------------------------------------
-- DE VEILIGHEIDSKEUZE, EXPLICIET
-- ------------------------------------------------------------
-- De klantpagina (factuur.html) draait ZONDER login. Er zijn twee manieren
-- om dat veilig te doen:
--
--   a) een RLS-policy die 'anon' toegang geeft zodra hij het token in een
--      request-header meestuurt;
--   b) een Netlify Function met de service role die het token verzilvert
--      en alleen een uitgeklede, gecontroleerde payload teruggeeft.
--
-- Dit project kiest (b). Reden: bij (a) moet de anon-rol leesrecht krijgen
-- op invoices en invoice_lines, met een policy die 'alleen als je het
-- juiste token meestuurt' zegt. Eén fout in die policy — een vergeten
-- USING op een tweede tabel, een view zonder security_invoker — en de
-- hele factuurtabel staat open voor iedereen op internet. Bij (b) heeft
-- de anon-rol nul rechten op de factuurtabellen; wat de klant ziet is
-- precies wat de function heeft opgeschreven, en die lijst staat op één
-- plek in portal/invoice-mail.js (clientView). De function draait met de
-- service role, en die sleutel staat alleen in de Netlify-omgeving.
--
-- De twee functies hieronder bestaan zodat die Netlify Function het
-- opzoeken en aftekenen van een token in ÉÉN databaseronde doet, in plaats
-- van lezen-dan-schrijven met een gaatje ertussen.
-- ============================================================


-- ------------------------------------------------------------
-- 1. GEBEURTENISSEN — de velden die tracking bruikbaar maken
-- ------------------------------------------------------------
alter table invoice_email_events add column if not exists provider_event_id text not null default '';
alter table invoice_email_events add column if not exists subject text not null default '';
alter table invoice_email_events add column if not exists cc_count integer not null default 0;
alter table invoice_email_events add column if not exists bcc_count integer not null default 0;
alter table invoice_email_events add column if not exists scheduled_for timestamptz;

comment on column invoice_email_events.provider_event_id is
  'De svix-id van het Resend-webhookbericht. Uniek zolang hij niet leeg is: dezelfde gebeurtenis die drie keer wordt afgeleverd landt precies een keer.';

-- DE IDEMPOTENTIE. Partieel, want alles wat wij zelf schrijven (queued,
-- sent, portal_viewed, pdf_downloaded) heeft geen provider-id en mag
-- gewoon vaker voorkomen.
create unique index if not exists invoice_email_events_provider_uniq
  on invoice_email_events (provider_event_id)
  where provider_event_id <> '';

-- de webhook zoekt de factuur op via het bericht-id dat wij bij het
-- verzenden hebben weggeschreven
create index if not exists invoice_email_events_message_idx
  on invoice_email_events (mail_message_id)
  where mail_message_id <> '';


-- ------------------------------------------------------------
-- 2. TOKENS — label en laatste gebruik
-- Het token zelf staat hier nog steeds NERGENS: alleen de SHA-256-hash
-- uit 0008. Deze twee kolommen maken alleen het beheerscherm leesbaar.
-- ------------------------------------------------------------
alter table invoice_tokens add column if not exists label text not null default '';
alter table invoice_tokens add column if not exists last_user_agent text not null default '';

comment on column invoice_tokens.label is
  'Vrije aanduiding voor het beheer ("mail 12 maart"). Nooit klantzichtbaar en nooit onderdeel van de link.';


-- ------------------------------------------------------------
-- 3. DE INPLANWACHTRIJ
-- Een ingeplande verzending is een RIJ, geen kolom op de factuur: je kunt
-- dezelfde factuur twee keer inplannen (eerst een aankondiging, later een
-- herinnering) en je wilt van allebei weten wat ermee gebeurd is.
--
-- EERLIJKE AFWIJKING, ook hier vastgelegd: er draait geen cron. Deze rij
-- vertrekt bij het eerstvolgende moment dat het beheer open staat op of na
-- send_at. De kolom sent_at vertelt achteraf wanneer dat werkelijk was, en
-- dat kan later zijn dan send_at.
-- ------------------------------------------------------------
create table if not exists invoice_mail_queue (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  send_at timestamptz not null,
  status text not null default 'gepland'
    check (status in ('gepland', 'verzonden', 'mislukt', 'geannuleerd')),
  template_key text not null default '',
  language text not null default 'nl',
  subject text not null default '',
  body text not null default '',
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  bcc_addresses text[] not null default '{}',
  attach_pdf boolean not null default true,
  token_id uuid references invoice_tokens(id) on delete set null,
  sent_at timestamptz,
  error text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists invoice_mail_queue_due_idx
  on invoice_mail_queue (send_at) where status = 'gepland';
create index if not exists invoice_mail_queue_invoice_idx
  on invoice_mail_queue (invoice_id, send_at);

alter table invoice_mail_queue enable row level security;
drop policy if exists "staff only invoice_mail_queue" on invoice_mail_queue;
create policy "staff only invoice_mail_queue" on invoice_mail_queue
  for all using (is_staff()) with check (is_staff());


-- ------------------------------------------------------------
-- 4. TWEE KOLOMMEN OP INVOICES
-- pay_url is BEWUST GEEN onderdeel van de snapshot. Een snapshot bevriest
-- wat de factuur juridisch is; een betaallink is een kanaal dat kan
-- verlopen, wisselen of pas na het versturen bestaat. Hij staat daarom
-- naast de snapshot en mag ook na definitief maken nog wijzigen — de
-- trigger invoices_guard_finalized uit 0009 raakt hem niet aan, en dat is
-- hier een bewuste keuze en geen omissie.
-- ------------------------------------------------------------
alter table invoices add column if not exists pay_url text not null default '';
alter table invoices add column if not exists last_sent_at timestamptz;

comment on column invoices.pay_url is
  'Optionele online betaallink. Staat bewust buiten de snapshot: een betaalkanaal is geen juridisch feit over de factuur.';


-- ------------------------------------------------------------
-- 5. HET TOKEN VERZILVEREN — in een ronde
--
-- redeem_invoice_token(hash, ua) doet lezen, geldigheid toetsen en
-- aftekenen in EEN statement, zodat er tussen 'is hij geldig' en 'markeer
-- hem als gebruikt' geen gaatje zit. Hij geeft alleen het invoice_id en
-- een reden terug — nooit de tokenrij zelf.
--
-- SECURITY DEFINER met vast search_path, execute-recht ingetrokken van
-- PUBLIC: precies het patroon van owns_invoice() in 0008. De functie is
-- alleen aanroepbaar door service_role; de anon-rol kan er niet bij, ook
-- niet als iemand de naam raadt.
-- ------------------------------------------------------------
create or replace function redeem_invoice_token(p_hash text, p_user_agent text default '')
returns table (invoice_id uuid, token_id uuid, ok boolean, reason text)
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select t.* into r from invoice_tokens t where t.token_hash = p_hash;
  if not found then
    return query select null::uuid, null::uuid, false, 'onbekend';
    return;
  end if;
  if r.revoked_at is not null then
    return query select r.invoice_id, r.id, false, 'ingetrokken';
    return;
  end if;
  if r.expires_at is not null and r.expires_at <= now() then
    return query select r.invoice_id, r.id, false, 'verlopen';
    return;
  end if;

  update invoice_tokens
     set use_count = use_count + 1,
         first_used_at = coalesce(first_used_at, now()),
         last_used_at = now(),
         last_user_agent = left(coalesce(p_user_agent, ''), 300)
   where id = r.id;

  return query select r.invoice_id, r.id, true, 'geldig';
end $$;

revoke all on function redeem_invoice_token(text, text) from public;
revoke all on function redeem_invoice_token(text, text) from anon;
revoke all on function redeem_invoice_token(text, text) from authenticated;
grant execute on function redeem_invoice_token(text, text) to service_role;


-- ------------------------------------------------------------
-- 6. DE BEZORGGEBEURTENIS WEGSCHRIJVEN — idempotent
--
-- record_mail_event() zoekt de factuur op via het bericht-id dat wij bij
-- het verzenden zelf hebben weggeschreven, en voegt de gebeurtenis toe
-- tenzij dezelfde provider-gebeurtenis er al staat. Dat 'tenzij' is de
-- unieke index uit blok 1; hier staat alleen het on-conflict eromheen.
--
-- Geeft terug: 'nieuw' (weggeschreven), 'dubbel' (al bekend) of
-- 'onbekende-mail' (geen factuur met dit bericht-id — bijvoorbeeld een
-- gewone projectmail; die hoort hier niet thuis en wordt genegeerd).
-- ------------------------------------------------------------
create or replace function record_mail_event(
  p_provider_event_id text,
  p_message_id text,
  p_event text,
  p_recipient text default '',
  p_detail text default '',
  p_subject text default '',
  p_occurred_at timestamptz default now()
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_invoice uuid;
  v_rows int;
begin
  if coalesce(p_provider_event_id, '') = '' then
    raise exception 'record_mail_event vraagt een provider_event_id; zonder die sleutel is de webhook niet idempotent.';
  end if;

  select e.invoice_id into v_invoice
    from invoice_email_events e
   where e.mail_message_id = p_message_id
     and e.mail_message_id <> ''
   order by e.occurred_at asc
   limit 1;

  if v_invoice is null then
    return 'onbekende-mail';
  end if;

  insert into invoice_email_events
    (invoice_id, event, recipient, mail_message_id, provider_event_id, detail, subject, occurred_at)
  values
    (v_invoice, p_event, left(coalesce(p_recipient, ''), 200), p_message_id,
     p_provider_event_id, left(coalesce(p_detail, ''), 300), left(coalesce(p_subject, ''), 200),
     coalesce(p_occurred_at, now()))
  on conflict (provider_event_id) where provider_event_id <> '' do nothing;

  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'nieuw' else 'dubbel' end;
end $$;

revoke all on function record_mail_event(text, text, text, text, text, text, timestamptz) from public;
revoke all on function record_mail_event(text, text, text, text, text, text, timestamptz) from anon;
revoke all on function record_mail_event(text, text, text, text, text, text, timestamptz) from authenticated;
grant execute on function record_mail_event(text, text, text, text, text, text, timestamptz) to service_role;


-- ------------------------------------------------------------
-- 7. INSTELLINGEN
-- factuur_openingsregistratie bestaat al sinds 0008 en staat standaard
-- UIT. Hier komt alleen de webhook-schakelaar bij: hij zegt niets meer
-- dan of de eigenaar de webhook in Resend heeft aangezet, zodat de UI het
-- verschil kan tonen tussen "nog geen bezorgbericht binnen" en
-- "bezorgstatus wordt hier niet bijgehouden".
-- ------------------------------------------------------------
insert into admin_settings(key, value) values
  ('factuur_webhook', '{"aan": false}'::jsonb)
on conflict (key) do nothing;

comment on table invoice_mail_queue is
  'Ingeplande factuurmails. Er draait geen cron: een rij vertrekt bij het eerstvolgende moment dat het beheer open staat op of na send_at.';
