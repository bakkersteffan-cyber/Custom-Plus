-- ============================================================
-- CUSTOM+ — BETALINGEN, HERINNERINGEN, CREDITNOTA'S, TERUGKERENDE
--           PROFIELEN EN DE UBL-EXPORT
-- Draai dit ná 0011_factuurmail.sql.
--
-- HER-UITVOERBAAR: elke kolom is add-column-if-not-exists, elke index is
-- if-not-exists, elke policy heeft een drop-policy ervóór, elke functie is
-- create-or-replace en elke trigger wordt eerst gedropt. Je kunt dit
-- bestand dus zo vaak draaien als je wilt.
--
-- WAT DIT BESTAND DOET
--   1. invoice_payments krijgt zijn interne bewijsbijlage en een reden bij
--      een terugboeking;
--   2. invoice_reminders krijgt de velden die de trap bruikbaar maken, plus
--      DE UNIEKE INDEX die hem idempotent maakt;
--   3. invoices krijgt vier kolommen voor de herinneringstrap en het
--      creditsaldo;
--   4. een nieuwe tabel recurring_runs — de idempotentiesleutel van de
--      terugkerende generatie, als unieke index en dus niet als code;
--   5. recurring_profiles krijgt de velden die het profiel compleet maken;
--   6. ubl_exports krijgt bestandsnaam en inhoudshash;
--   7. recalc_invoice_settlement(): de server rekent het openstaande saldo
--      en de status zélf uit, en drie triggers roepen hem aan;
--   8. vier nieuwe sleutels in admin_settings;
--   9. FIXRONDE — de transitietabel en het crediteerplafond in de database.
--
-- ------------------------------------------------------------
-- FIXRONDE — WAT ER IS DICHTGEZET
-- ------------------------------------------------------------
-- BEVINDING 7 — recalc_invoice_settlement() schreef status_code buiten de
-- transitietabel om, en elke ingelogde klant mocht hem aanroepen.
--   (a) De functie leidde een nieuwe status af uit de bedragen en schreef
--       die rechtstreeks weg. Afleiden is niet hetzelfde als mogen: zo kon
--       een factuur in een staat belanden die het statusmodel verbiedt —
--       terug uit een eindstaat, of een betaalde factuur heropenen terwijl
--       er nog geld op staat. invoice_can_transition() hieronder is de
--       tegenhanger van canTransition() uit portal/invoice-core.js;
--       een overgang die daar niet in staat, wordt geweigerd.
--   (b) Het execute-recht stond op 'authenticated' — dus op elke ingelogde
--       klant. Er zit nu een harde poort in de functie zelf. Zie de
--       toelichting bij de functie voor waarom het recht een grant op
--       authenticated MOET blijven en de poort dus in de code zit.
--
-- BEVINDING 12 — er werd geteld hoeveel er is gecrediteerd, maar niets
-- hield tegen dat er MEER wordt gecrediteerd dan er op de factuur staat.
-- De harde grens uit de spec leefde alleen in portal/invoice-credit.js, en
-- alles wat in de browser draait kan in de browser worden aangepast.
-- invoices_guard_credit_max() zet die grens nu in de database, met exact
-- dezelfde telling als waarmee recalc het creditsaldo optelt.
--
-- ------------------------------------------------------------
-- WAAROM DE SERVER HET SALDO ZELF UITREKENT
-- ------------------------------------------------------------
-- paid_cents, credited_cents, outstanding_cents en status_code staan als
-- kolom op invoices omdat elke lijst, elk overzicht en elk portaalscherm ze
-- leest. Zou de browser ze schrijven, dan zou één tabblad met een oude
-- stand het saldo kunnen terugzetten naar wat het gisteren was — precies
-- het probleem dat golf 1 bij de factuurnummers heeft opgelost.
--
-- recalc_invoice_settlement() telt daarom in de database: alle betalingen
-- (de negatieve tegenboekingen tellen vanzelf mee) plus alle DEFINITIEVE
-- creditnota's die naar deze factuur wijzen. De tolerantie komt uit
-- admin_settings, zodat er maar één plek is waar dat getal staat.
--
-- De trigger raakt bewust ALLEEN die vier kolommen aan. invoices_guard_
-- finalized uit 0009 laat ze door — ze staan niet in zijn lijst en dat is
-- geen toeval: een betaling is geen wijziging van de factuur, hij is een
-- gebeurtenis eróver.
-- ============================================================


-- ------------------------------------------------------------
-- 1. BETALINGEN — de bewijsbijlage
-- ------------------------------------------------------------
-- 0008 gaf invoice_payments al een proof_document_id die naar `documents`
-- wijst. Die kolom blijft staan (weggooien breekt bestaande rijen) maar
-- wordt NIET gebruikt: `documents` is klantzichtbaar via het portaal, en
-- een bankafschrift of een schermafdruk van een overboeking is dat niet.
-- Het bewijs krijgt daarom een eigen pad in een INTERNE bucket.
--
-- DE BUCKET MOET JE ZELF AANMAKEN, en dat is met opzet:
--   Storage → New bucket → naam `beheer-intern`, PRIVATE.
--   Policy (target: authenticated), voor select/insert/update/delete:
--       bucket_id = 'beheer-intern' and is_staff()
-- Geen owns_project() erin — dit is de enige bucket in dit project waar de
-- klant niets te zoeken heeft. Bestaat de bucket niet, dan mislukt alleen
-- het uploaden van het bewijs; de betaling zelf wordt gewoon geboekt en het
-- scherm zegt wat er is misgegaan.
alter table invoice_payments add column if not exists proof_path text not null default '';
alter table invoice_payments add column if not exists proof_filename text not null default '';
alter table invoice_payments add column if not exists proof_size bigint not null default 0;
alter table invoice_payments add column if not exists reversal_reason text not null default '';

comment on column invoice_payments.proof_path is
  'Pad in de PRIVATE bucket beheer-intern. Bewust niet in `documents`: die tabel is klantzichtbaar en een bankafschrift hoort dat niet te zijn.';
comment on column invoice_payments.proof_document_id is
  'NIET MEER GEBRUIKT sinds 0012. Bleef staan voor bestaande rijen; nieuwe bewijzen gaan naar proof_path.';
comment on column invoice_payments.amount_cents is
  'Gehele centen. Negatief = terugboeking; die verwijst via reverses_payment_id naar de oorspronkelijke betaling. Een bestaande rij wordt NOOIT herschreven.';

-- DE KLANT VERLIEST ZIJN LEESRECHT OP DEZE TABEL, en dat is een bewuste
-- aanscherping ten opzichte van 0008.
--
-- 0008 gaf de klant select via owns_invoice(), met als redenering "dat is
-- precies wat het openstaande bedrag verklaart". Sinds 0012 dragen deze
-- rijen ook internal_note, transaction_ref en proof_path — het pad naar een
-- bankafschrift. Postgres kent geen policy per kolom, dus leesrecht op de
-- rij is leesrecht op álles wat erin staat.
--
-- Het openstaande bedrag heeft de klant niet uit deze rijen nodig: het
-- staat als paid_cents, credited_cents en outstanding_cents op de
-- factuurrij zelf, berekend door recalc_invoice_settlement() hieronder.
-- Dat is precies wat portal.html leest (invoicePaidCents /
-- invoiceOpenCents) en het is één getal in plaats van een grootboek.
drop policy if exists "client reads own invoice_payments" on invoice_payments;

comment on table invoice_payments is
  'Deelbetalingen en terugboekingen — STAFF ONLY sinds 0012. De klant ziet het resultaat via invoices.paid_cents en invoices.outstanding_cents, niet de losse regels: die dragen ook de interne notitie en het pad naar het betaalbewijs.';


-- ------------------------------------------------------------
-- 2. HERINNERINGEN — en de index die de trap idempotent maakt
-- ------------------------------------------------------------
alter table invoice_reminders add column if not exists auto boolean not null default true;
alter table invoice_reminders add column if not exists language text not null default 'nl';
alter table invoice_reminders add column if not exists interest_cents bigint not null default 0;
alter table invoice_reminders add column if not exists collection_cents bigint not null default 0;
alter table invoice_reminders add column if not exists outstanding_cents bigint not null default 0;
alter table invoice_reminders add column if not exists confirmed_extras boolean not null default false;

comment on column invoice_reminders.auto is
  'true = door de trap klaargezet bij het openen van het beheer; false = met de hand gemaakt.';
comment on column invoice_reminders.confirmed_extras is
  'Rente en incassokosten staan alleen op deze herinnering als iemand ze per keer heeft bevestigd. Nooit automatisch.';

-- DE IDEMPOTENTIE VAN DE TRAP, in de database en niet in code.
-- Per factuur bestaat elke stap van de trap hoogstens één keer. Step 99 is
-- de losse handmatige herinnering en valt er bewust buiten: die mag je zo
-- vaak sturen als nodig is.
do $$
begin
  begin
    create unique index if not exists invoice_reminders_step_uniq
      on invoice_reminders (invoice_id, step)
      where step < 99;
  exception when others then
    raise notice 'invoice_reminders_step_uniq niet aangelegd (%): er staan al dubbele stappen op een factuur.', sqlerrm;
  end;
end $$;


-- ------------------------------------------------------------
-- 3. INVOICES — de trap en het creditsaldo
-- ------------------------------------------------------------
alter table invoices add column if not exists reminder_paused boolean not null default false;
alter table invoices add column if not exists reminder_evaluated_on date;
alter table invoices add column if not exists reminder_step integer not null default -1;
alter table invoices add column if not exists credit_note_count integer not null default 0;

comment on column invoices.reminder_evaluated_on is
  'De dag waarop de herinneringstrap voor deze factuur voor het laatst is beoordeeld. Er draait geen cron: dit is het slot dat voorkomt dat vijf keer verversen vijf keer iets doet.';
comment on column invoices.reminder_step is
  'De hoogste stap die al is klaargezet of verstuurd. -1 = nog geen enkele.';
comment on column invoices.reminder_paused is
  'Handmatig op pauze. Automatisch stoppen bij volledig betaald gebeurt via de status en niet via deze vlag.';

create index if not exists invoices_reminder_open_idx on invoices (due_date)
  where reminder_paused = false
    and status_code in ('finalized','sent','viewed','partially_paid','overdue');


-- ------------------------------------------------------------
-- 4. TERUGKERENDE GENERATIE — de echte idempotentiesleutel
-- ------------------------------------------------------------
-- recurring_profiles.last_period_key uit 0008 blijft bestaan, maar hij is
-- niet genoeg: twee beheertabbladen die op hetzelfde moment evalueren lezen
-- allebei dezelfde last_period_key en maken allebei een factuur. Een rij
-- met een unieke index verliest dat gevecht nooit.
--
-- De volgorde is dus: EERST de run-rij invoegen, DAN de factuur maken. Gaat
-- het invoegen mis met een unieke-sleutelfout, dan heeft iemand anders die
-- periode al gedaan en stop je — zonder factuur.
create table if not exists recurring_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references recurring_profiles(id) on delete cascade,
  period_key text not null,
  invoice_id uuid references invoices(id) on delete set null,
  status text not null default 'gegenereerd'
    check (status in ('gereserveerd','gegenereerd','mislukt','overgeslagen')),
  error_detail text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists recurring_runs_period_uniq
  on recurring_runs (profile_id, period_key);
create index if not exists recurring_runs_profile_idx on recurring_runs (profile_id, created_at);
alter table recurring_runs enable row level security;
drop policy if exists "staff only recurring_runs" on recurring_runs;
create policy "staff only recurring_runs" on recurring_runs
  for all using (is_staff()) with check (is_staff());

comment on table recurring_runs is
  'Eén rij per gegenereerde periode. De unieke index (profile_id, period_key) IS de garantie dat dezelfde periode nooit twee facturen oplevert — code verliest van twee gelijktijdige evaluaties, een unieke index niet.';

alter table recurring_profiles add column if not exists last_evaluated_on date;
alter table recurring_profiles add column if not exists intro_text text not null default '';
alter table recurring_profiles add column if not exists outro_text text not null default '';
alter table recurring_profiles add column if not exists internal_note text not null default '';

comment on column recurring_profiles.last_evaluated_on is
  'Zelfde dagslot als invoices.reminder_evaluated_on: hoogstens één evaluatie per dag per profiel.';
comment on column recurring_profiles.indexation_pct_milli is
  'Prijsindexering in percentage × 1000. 0 = uit. Wordt alleen toegepast vanaf indexation_applies_from en alleen na expliciete configuratie.';


-- ------------------------------------------------------------
-- 5. UBL-EXPORTS
-- ------------------------------------------------------------
alter table ubl_exports add column if not exists filename text not null default '';
alter table ubl_exports add column if not exists content_hash text not null default '';
alter table ubl_exports add column if not exists ir jsonb;

comment on column ubl_exports.xml is
  'De gegenereerde XML zelf. Bewust in de kolom en niet in een bucket: een UBL-document is enkele kilobytes en moet jaren later exact terug te vinden zijn, ook als er ooit een bucket wordt opgeruimd.';
comment on column ubl_exports.ir is
  'De interne, provider-onafhankelijke representatie waaruit de XML is gemaakt. Bewaard zodat een tweede formaat (Factur-X, XRechnung) later uit dezelfde bron kan worden gemaakt zonder de snapshot opnieuw te vertalen.';
comment on column ubl_exports.provider is
  'Leeg zolang er geen Peppol Access Point is aangesloten. Zie portal/invoice-ubl.js voor waar zo''n provider aanhaakt.';


-- ------------------------------------------------------------
-- 6. HET SALDO, DOOR DE SERVER GEREKEND
-- ------------------------------------------------------------
-- De tolerantie staat in admin_settings zodat de browser en de database
-- hetzelfde getal gebruiken. Ontbreekt de sleutel, dan is de tolerantie 0 —
-- een tolerantie is een bewuste instelling en nooit een stilzwijgende gunst.
create or replace function invoice_tolerance_cents() returns bigint
language sql stable set search_path = public as $$
  select coalesce(
    (select nullif(value->>'tolerantieCents','')::bigint
       from admin_settings where key = 'factuur_betalingen'),
    0);
$$;

-- ------------------------------------------------------------
-- HET CREDITSALDO — ÉÉN TELLING, TWEE GEBRUIKERS (fixronde, bevinding 12)
-- ------------------------------------------------------------
-- recalc_invoice_settlement() telt hiermee op hoeveel er van een factuur is
-- gecrediteerd, en invoices_guard_credit_max() toetst hier het plafond mee.
-- Dat MOET dezelfde telling zijn: een plafond dat anders telt dan het saldo
-- laat of te veel door, of blokkeert iets wat het saldo niet eens meetelt.
--
-- Meetellen doet een creditnota met een snapshot (dus definitief) die niet
-- geannuleerd is. Een concept telt niet: dat kan nog veranderen of
-- verdwijnen, en dan zou het openstaande bedrag dalen door iets wat de
-- klant nooit heeft gekregen. Dezelfde regel als COUNTING_CREDIT_STATUSES
-- in portal/invoice-credit.js.
--
-- p_except laat één creditnota buiten de telling. Het plafond gebruikt dat
-- om "alle ANDERE credits" op te tellen en er de rij bij op te tellen die
-- op dat moment wordt geschreven — die staat immers nog niet (of nog niet
-- in zijn nieuwe vorm) in de tabel.
--
-- Geen security definer: de functie draait binnen aanroepers die dat zelf
-- al zijn, en houdt zo de zichtbaarheid van de aanroeper. Het execute-recht
-- gaat daarom ook niet naar de browserrollen.
create or replace function invoice_credited_cents(
  p_invoice uuid,
  p_except uuid default null
) returns bigint
language sql stable set search_path = public as $$
  select coalesce(sum(abs(coalesce(c.total_incl_cents, c.total_cents, 0))), 0)::bigint
    from invoices c
   where c.credit_of_invoice_id = p_invoice
     and c.snapshot is not null
     and c.status_code <> 'cancelled'
     and (p_except is null or c.id <> p_except);
$$;
revoke all on function invoice_credited_cents(uuid, uuid) from public;
revoke all on function invoice_credited_cents(uuid, uuid) from anon;
revoke all on function invoice_credited_cents(uuid, uuid) from authenticated;
grant execute on function invoice_credited_cents(uuid, uuid) to service_role;


-- ------------------------------------------------------------
-- DE TRANSITIETABEL, OOK IN DE DATABASE (fixronde, bevinding 7a)
-- ------------------------------------------------------------
-- Dit is letterlijk TRANSITIONS uit portal/invoice-core.js. Wat er niet in
-- staat, mag niet: er is geen weg terug naar 'draft' vanaf 'finalized' of
-- later, en 'cancelled' en 'credited' zijn eindpunten.
--
-- Een LEGE array betekent "deze staat is een eindpunt"; null betekent "deze
-- status ken ik niet" — dat onderscheid is het verschil tussen een bewuste
-- eindstaat en een tikfout, en beide moeten weigeren.
create or replace function invoice_allowed_transitions(p_from text)
returns text[]
language sql immutable set search_path = public as $$
  select case p_from
    when 'draft'          then array['scheduled','finalized','cancelled']
    when 'scheduled'      then array['draft','finalized','cancelled']
    when 'finalized'      then array['sent','viewed','partially_paid','paid','overdue','disputed','cancelled','credited','uncollectible']
    when 'sent'           then array['viewed','partially_paid','paid','overdue','disputed','cancelled','credited','uncollectible']
    when 'viewed'         then array['partially_paid','paid','overdue','disputed','cancelled','credited','uncollectible']
    when 'partially_paid' then array['paid','overdue','disputed','credited','uncollectible','sent']
    when 'paid'           then array['partially_paid','disputed','credited','overdue','sent']
    when 'overdue'        then array['partially_paid','paid','disputed','cancelled','credited','uncollectible']
    when 'disputed'       then array['sent','viewed','partially_paid','paid','overdue','cancelled','credited','uncollectible']
    when 'cancelled'      then array[]::text[]
    when 'credited'       then array[]::text[]
    when 'uncollectible'  then array['partially_paid','paid','credited']
    else null::text[]
  end;
$$;
revoke all on function invoice_allowed_transitions(text) from public;
revoke all on function invoice_allowed_transitions(text) from anon;
grant execute on function invoice_allowed_transitions(text) to authenticated, service_role;

-- De tegenhanger van canTransition() uit portal/invoice-core.js, inclusief
-- de drie werkelijkheden die naast de tabel gelden:
--   · de weg terug na een TERUGBOEKING (paid → sent/overdue,
--     partially_paid → sent) mag alleen wanneer er aantoonbaar NIETS meer
--     betaald is. p_paid_cents moet daarvoor expliciet 0 zijn; null of een
--     ander getal betekent weigeren. Zo kan een aanroeper die de betaalstand
--     niet kent nooit per ongeluk een betaalde factuur heropenen — en let
--     op: een NEGATIEF saldo (meer teruggeboekt dan betaald) is dus óók
--     geen nul en heropent dus niets.
--   · annuleren mag nooit als er geld op de factuur staat; crediteren is dan
--     de enige juiste weg.
--   · definitief maken mag alleen met een toegekend nummer.
create or replace function invoice_can_transition(
  p_from text,
  p_to text,
  p_paid_cents bigint default null,
  p_has_number boolean default null
) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  v_allowed text[];
begin
  -- eerst de statussen zelf, dan pas de gelijkheid: een onbekende status is
  -- ook onbekend wanneer hij toevallig aan beide kanten staat. Zelfde
  -- volgorde als canTransition() in de rekenkern.
  if p_from is null or p_to is null then return false; end if;
  v_allowed := invoice_allowed_transitions(p_from);
  if v_allowed is null then return false; end if;                    -- onbekende huidige status
  if invoice_allowed_transitions(p_to) is null then return false; end if;  -- onbekende doelstatus
  if p_from = p_to then return true; end if;
  if not (p_to = any (v_allowed)) then return false; end if;

  if (p_from || '>' || p_to) in ('paid>overdue', 'paid>sent', 'partially_paid>sent')
     and coalesce(p_paid_cents, -1) <> 0 then
    return false;
  end if;

  if p_to = 'cancelled' and coalesce(p_paid_cents, 0) <> 0 then return false; end if;
  if p_to = 'finalized' and p_has_number is false then return false; end if;

  return true;
end $$;
revoke all on function invoice_can_transition(text, text, bigint, boolean) from public;
revoke all on function invoice_can_transition(text, text, bigint, boolean) from anon;
grant execute on function invoice_can_transition(text, text, bigint, boolean) to authenticated, service_role;

comment on function invoice_can_transition(text, text, bigint, boolean) is
  'De databasetegenhanger van canTransition() uit portal/invoice-core.js. Dezelfde tabel, dezelfde drie uitzonderingen. Wat hier false teruggeeft, mag nergens worden weggeschreven.';


create or replace function recalc_invoice_settlement(p_invoice uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total    bigint;
  v_paid     bigint;
  v_credited bigint;
  v_out      bigint;
  v_tol      bigint;
  v_status   text;
  v_new      text;
  v_due      date;
  v_number   text;
begin
  -- WIE MAG HERREKENEN — fixronde, bevinding 7b
  -- Deze functie schrijft status_code en drie bedragkolommen. Tot deze
  -- fixronde stond het execute-recht op 'authenticated', en dat is elke
  -- ingelogde KLANT: die kon dus de status en het saldo van een factuur
  -- laten herschrijven.
  --
  -- Het recht kan niet smaller worden gemaakt dan 'authenticated', want
  -- Postgres kent hier geen rol 'staf': het beheer logt in als een gewone
  -- authenticated gebruiker en is uitsluitend aan is_staff() te herkennen.
  -- Daarom staat de poort in de functie zelf — precies het patroon van
  -- claim_series_number() in 0009. Drie aanroepers komen er langs:
  --   · de triggers onderaan dit bestand (pg_trigger_depth() > 0). Die
  --     horen bij een schrijfactie die de RLS al heeft toegelaten, en de
  --     factuur die ze doorgeven is de factuur die net veranderde.
  --   · een achtergrondaanroep zonder ingelogde gebruiker, dus service_role
  --     (auth.uid() is null). anon komt hier niet: die heeft geen execute.
  --   · een ingelogde beheerder (is_staff()) — het beheer forceert de
  --     herberekening bijvoorbeeld nadat de tolerantie is gewijzigd.
  -- Een ingelogde klant valt buiten alle drie.
  if pg_trigger_depth() = 0 and auth.uid() is not null and not is_staff() then
    raise exception 'Alleen beheer mag het saldo van een factuur herberekenen.';
  end if;

  -- total_incl_cents is de kolom van fase 1 en staat op 0 bij een factuur
  -- uit golf 1; die draagt zijn bedrag nog in total_cents. coalesce helpt
  -- daar niet (0 is niet null), dus dit staat er expliciet.
  select case when coalesce(total_incl_cents, 0) <> 0
              then total_incl_cents
              else coalesce(total_cents, 0) end,
         status_code, due_date, coalesce(invoice_number, '')
    into v_total, v_status, v_due, v_number
    from invoices where id = p_invoice;
  if not found then return; end if;

  -- betalingen: de negatieve tegenboekingen tellen vanzelf mee
  select coalesce(sum(amount_cents), 0) into v_paid
    from invoice_payments where invoice_id = p_invoice;

  -- creditnota's: alleen de DEFINITIEVE tellen. Een concept kan nog
  -- veranderen of verdwijnen; zou het meetellen, dan zou het openstaande
  -- bedrag dalen door iets wat de klant nooit heeft gekregen. De telling
  -- staat sinds de fixronde in invoice_credited_cents(), zodat het
  -- crediteerplafond met exact dezelfde optelling werkt.
  v_credited := invoice_credited_cents(p_invoice);

  v_tol := invoice_tolerance_cents();
  v_out := v_total - v_paid - v_credited;

  -- de statusafleiding is exact dezelfde als in portal/invoice-payments.js.
  -- Twee implementaties van dezelfde regel is één te veel, maar de browser
  -- kan niet de enige zijn die hem kent: een script of een tweede tabblad
  -- moet tot hetzelfde antwoord komen.
  v_new := v_status;
  if v_status not in ('draft','scheduled','cancelled','credited') then
    if v_credited >= v_total and v_total > 0 and v_paid = 0 then
      v_new := 'credited';
    elsif v_out <= greatest(v_tol, 0) then
      v_new := 'paid';
    elsif v_paid > 0 then
      v_new := 'partially_paid';
    elsif v_status in ('paid','partially_paid') then
      -- ER IS TERUGGEBOEKT: er staat weer geld open terwijl de factuur nog
      -- 'betaald' zegt. Dezelfde weg terug als in portal/invoice-payments.js,
      -- en om dezelfde reden: 'Betaald' met een openstaand bedrag is een
      -- leugen die je pas bij de jaarafsluiting ontdekt.
      v_new := case when v_due is not null and v_due < current_date
                    then 'overdue' else 'sent' end;
    elsif v_due is not null and v_due < current_date
          and v_status in ('finalized','sent','viewed') then
      v_new := 'overdue';
    end if;
  end if;

  -- DE TRANSITIETABEL HEEFT HET LAATSTE WOORD — fixronde, bevinding 7a
  -- Hierboven is een status AFGELEID uit de bedragen. Afgeleid is niet
  -- hetzelfde als toegestaan: zonder deze toets kon deze functie een factuur
  -- in een staat zetten die het statusmodel verbiedt. Het duidelijkste geval
  -- is de heropening na een terugboeking: die tak wordt ook bereikt wanneer
  -- v_paid NEGATIEF is (er is meer teruggeboekt dan er ooit is betaald), en
  -- canTransition() staat 'Betaald' → 'Verstuurd' alleen toe bij een
  -- aantoonbare nul. v_paid gaat daarom expliciet mee.
  --
  -- Weigert de tabel, dan blijft de status staan en worden ALLEEN de
  -- bedragen bijgewerkt. Bewust geen exception: deze functie hangt aan
  -- triggers, en een uitzondering hier zou een op zichzelf geldige boeking
  -- laten mislukken. De bedragen zijn daarna zichtbaar in tegenspraak met de
  -- status, en dat is precies het signaal dat iemand er met de hand naar
  -- moet kijken. De notice legt in het serverlogboek vast wat er is
  -- geweigerd.
  if v_new is distinct from v_status
     and not invoice_can_transition(v_status, v_new, v_paid, v_number <> '') then
    raise notice 'Factuur %: overgang % → % is geweigerd door de transitietabel (betaald: % centen, openstaand: % centen). De status blijft staan; alleen de bedragen zijn bijgewerkt.',
      coalesce(nullif(v_number, ''), p_invoice::text), v_status, v_new, v_paid, v_out;
    v_new := v_status;
  end if;

  update invoices
     set paid_cents = v_paid,
         credited_cents = v_credited,
         outstanding_cents = v_out,
         credit_note_count = (select count(*) from invoices c
                               where c.credit_of_invoice_id = p_invoice),
         status_code = v_new,
         -- de oude vlag uit golf 1 blijft meelopen zodat het portaal, de
         -- CSV-export en de betaalpadberekening ongewijzigd doorwerken.
         -- 'void' hoort bij annuleren en wordt hier bewust nooit gezet: dat
         -- is een aparte handeling met een reden erbij.
         status = case
                    when v_new = 'paid' then 'paid'
                    -- na een terugboeking gaat ook de oude vlag terug open,
                    -- anders blijft het klantportaal 'betaald' tonen
                    when status = 'paid' and v_new <> 'paid' then 'open'
                    else status
                  end,
         updated_at = now()
   where id = p_invoice;
end $$;

-- De revoke gaat ook expliciet naar anon. 'revoke from public' is niet
-- genoeg: Supabase deelt via ALTER DEFAULT PRIVILEGES een eigen grant uit
-- aan anon en authenticated zodra er een functie in schema public bijkomt,
-- en zo'n rolgebonden grant blijft staan als je alleen public intrekt.
-- authenticated HOUDT het recht, want daar logt het beheer in; een klant
-- komt vervolgens niet langs de is_staff()-poort in de functie zelf.
revoke all on function recalc_invoice_settlement(uuid) from public;
revoke all on function recalc_invoice_settlement(uuid) from anon;
grant execute on function recalc_invoice_settlement(uuid) to authenticated, service_role;
revoke all on function invoice_tolerance_cents() from public;
revoke all on function invoice_tolerance_cents() from anon;
grant execute on function invoice_tolerance_cents() to authenticated, service_role;

-- elke beweging in de betalingen herrekent de factuur
create or replace function invoice_payments_recalc() returns trigger
language plpgsql as $$
begin
  perform recalc_invoice_settlement(coalesce(new.invoice_id, old.invoice_id));
  return coalesce(new, old);
end $$;

drop trigger if exists invoice_payments_recalc_trg on invoice_payments;
create trigger invoice_payments_recalc_trg
  after insert or update or delete on invoice_payments
  for each row execute function invoice_payments_recalc();

-- een creditnota die definitief wordt, herrekent de factuur waar hij bij
-- hoort. Alleen wanneer er iets verandert dat ertoe doet — anders zou elke
-- statuswijziging op de creditnota een schrijfbeweging op de factuur geven.
create or replace function invoice_credit_recalc() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.credit_of_invoice_id is not null then
      perform recalc_invoice_settlement(old.credit_of_invoice_id);
    end if;
    return old;
  end if;
  if new.credit_of_invoice_id is not null and (
       tg_op = 'INSERT'
       or new.snapshot is distinct from old.snapshot
       or new.status_code is distinct from old.status_code
       or new.total_incl_cents is distinct from old.total_incl_cents
     ) then
    perform recalc_invoice_settlement(new.credit_of_invoice_id);
  end if;
  if tg_op = 'UPDATE' and old.credit_of_invoice_id is not null
     and old.credit_of_invoice_id is distinct from new.credit_of_invoice_id then
    perform recalc_invoice_settlement(old.credit_of_invoice_id);
  end if;
  return new;
end $$;

drop trigger if exists invoice_credit_recalc_trg on invoices;
create trigger invoice_credit_recalc_trg
  after insert or update or delete on invoices
  for each row execute function invoice_credit_recalc();

-- een creditnota verwijst nooit naar een factuur die zelf een creditnota is
create or replace function invoices_guard_credit_link() returns trigger
language plpgsql as $$
declare
  v_kind text;
  v_snapshot jsonb;
begin
  if new.credit_of_invoice_id is null then return new; end if;
  if new.doc_kind <> 'credit_note' then
    raise exception 'Alleen een creditnota mag naar een originele factuur verwijzen (doc_kind is nu %).', new.doc_kind;
  end if;
  select doc_kind, snapshot into v_kind, v_snapshot
    from invoices where id = new.credit_of_invoice_id;
  if v_kind = 'credit_note' then
    raise exception 'Een creditnota kan niet worden gecrediteerd. Maak een nieuwe factuur.';
  end if;
  if v_snapshot is null then
    raise exception 'Crediteren kan alleen op een definitieve factuur: die heeft een nummer en een vastgelegde snapshot.';
  end if;
  return new;
end $$;

drop trigger if exists invoices_guard_credit_link_trg on invoices;
create trigger invoices_guard_credit_link_trg
  before insert or update of credit_of_invoice_id, doc_kind on invoices
  for each row execute function invoices_guard_credit_link();


-- ------------------------------------------------------------
-- HET CREDITEERPLAFOND — fixronde, bevinding 12
-- ------------------------------------------------------------
-- De spec vraagt "voorkomen dat meer wordt gecrediteerd dan crediteerbaar".
-- Die grens leefde uitsluitend in portal/invoice-credit.js (creditable() →
-- remainingCents), en alles wat in de browser draait kan in de browser
-- worden aangepast. invoices_guard_credit_link() keek alleen naar doc_kind
-- en naar de aanwezigheid van een snapshot, niet naar het BEDRAG.
--
-- De grens ligt op het bedrag van de originele factuur. Wat er al aan
-- definitieve creditnota's op staat plus wat deze rij toevoegt, mag daar
-- niet bovenuit komen; precies gelijk mag wél, dat is volledig crediteren.
--
-- De telling komt uit invoice_credited_cents(), dezelfde functie waarmee
-- recalc_invoice_settlement() het creditsaldo optelt. Zou het plafond
-- anders tellen dan het saldo, dan zou het of te veel doorlaten of iets
-- blokkeren dat niet eens meetelt.
--
-- Alleen een creditnota die MEETELT legt beslag op de ruimte: een concept
-- (nog geen snapshot) en een geannuleerde niet. Een creditnota annuleren
-- geeft de ruimte dus netjes terug.
--
-- security definer omdat de telling compleet moet zijn: het plafond mag
-- niet afhangen van welke rijen de schrijvende rol toevallig mag zien. De
-- functie leest alleen en schrijft niets.
--
-- De naam eindigt bewust op _max en niet op _cap: Postgres vuurt triggers in
-- alfabetische volgorde, en zo komt invoices_guard_credit_link_trg eerst.
-- Wie een creditnota aan een creditnota hangt, leest dan die duidelijke
-- melding en niet een verwarrende rekensom over een plafond.
create or replace function invoices_guard_credit_max() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_parent   bigint;
  v_others   bigint;
  v_this     bigint;
  v_number   text;
begin
  if new.credit_of_invoice_id is null then return new; end if;
  -- nog geen snapshot of geannuleerd: telt niet mee, dus legt geen beslag
  if new.snapshot is null or new.status_code = 'cancelled' then return new; end if;

  select case when coalesce(total_incl_cents, 0) <> 0
              then total_incl_cents
              else coalesce(total_cents, 0) end,
         coalesce(invoice_number, '')
    into v_parent, v_number
    from invoices where id = new.credit_of_invoice_id;
  if not found then return new; end if;          -- guard_credit_link meldt dat al

  v_parent := greatest(coalesce(v_parent, 0), 0);
  v_others := invoice_credited_cents(new.credit_of_invoice_id, new.id);
  v_this   := abs(coalesce(new.total_incl_cents, new.total_cents, 0));

  -- EEN BESTAANDE OVERSCHRIJDING WORDT NIET MET TERUGWERKENDE KRACHT
  -- GEBLOKKEERD. Telde deze rij al mee voor hetzelfde of een hoger bedrag,
  -- dan verandert deze update niets aan de ruimte en mag hij door. Anders
  -- zou een factuur die vóór deze grens te ver is gecrediteerd helemaal
  -- vastlopen: zelfs recalc_invoice_settlement() zet status_code op deze rij,
  -- en dan zou geen enkele betaling of correctie er meer op geboekt kunnen
  -- worden — terwijl dat juist de weg naar herstel is. Geweigerd wordt dus
  -- alleen wat de overschrijding VEROORZAAKT of VERGROOT.
  if tg_op = 'UPDATE'
     and old.credit_of_invoice_id is not distinct from new.credit_of_invoice_id
     and old.snapshot is not null
     and old.status_code <> 'cancelled'
     and abs(coalesce(old.total_incl_cents, old.total_cents, 0)) >= v_this then
    return new;
  end if;

  if v_others + v_this > v_parent then
    raise exception
      'Er kan niet meer worden gecrediteerd dan er op factuur % staat. Factuurbedrag % centen, al gecrediteerd % centen, deze creditnota % centen — dat is % centen te veel.',
      coalesce(nullif(v_number, ''), new.credit_of_invoice_id::text),
      v_parent, v_others, v_this, (v_others + v_this - v_parent);
  end if;

  return new;
end $$;

drop trigger if exists invoices_guard_credit_max_trg on invoices;
create trigger invoices_guard_credit_max_trg
  before insert or update of credit_of_invoice_id, doc_kind, snapshot,
                             status_code, total_incl_cents, total_cents
  on invoices
  for each row execute function invoices_guard_credit_max();

comment on function invoices_guard_credit_max() is
  'Het crediteerplafond uit de spec, in de database. Telt met invoice_credited_cents() — dezelfde optelling als recalc_invoice_settlement() — en weigert elke definitieve creditnota die het factuurbedrag zou overschrijden.';


-- ------------------------------------------------------------
-- 7. INSTELLINGEN
-- ------------------------------------------------------------
-- Geen eigen tabel: dit zijn vier rijen die nooit groeien, en het bestaande
-- admin_settings doet precies wat er nodig is. Zie ook de motivatie in
-- 0008_invoices.sql.
insert into admin_settings(key, value) values
  ('factuur_betalingen', '{"tolerantieCents": 0, "standaardMethode": "overboeking"}'::jsonb),
  ('factuur_herinneringen', '{"aan": false}'::jsonb),
  ('factuur_terugkerend', '{"aan": true, "maxPerRun": 3}'::jsonb),
  ('factuur_ubl', '{"aan": false}'::jsonb)
on conflict (key) do nothing;

comment on function recalc_invoice_settlement(uuid) is
  'Telt betalingen en definitieve creditnota''s op en zet paid_cents, credited_cents, outstanding_cents en status_code. Dezelfde regels als portal/invoice-payments.js, maar dan op een plek die een tweede browsertabblad niet kan overrulen. Sinds de fixronde: alleen beheer, service_role en de eigen triggers mogen hem aanroepen, en elke statuswijziging moet langs invoice_can_transition().';


-- ------------------------------------------------------------
-- 8. EENMALIG BIJWERKEN
-- ------------------------------------------------------------
-- Facturen die al bestonden krijgen hun saldo één keer opnieuw berekend.
-- Idempotent: nog eens draaien komt op precies dezelfde getallen uit.
--
-- Dit blok draait als de EIGENAAR van de database (geen ingelogde gebruiker),
-- dus het komt langs de poort in recalc_invoice_settlement(). Draai je deze
-- migratie met rolimitatie aan in de SQL-editor, dan ziet de poort een
-- ingelogde niet-beheerder en weigert hij — vandaar de vangst met een
-- leesbare uitleg in plaats van een halve migratie.
do $$
declare r record;
begin
  for r in select id from invoices where snapshot is not null loop
    perform recalc_invoice_settlement(r.id);
  end loop;
exception when others then
  raise notice 'De eenmalige herberekening is overgeslagen (%). Draai deze migratie als eigenaar, zonder rolimitatie; daarna is alleen dit laatste blok nog nodig.', sqlerrm;
end $$;
