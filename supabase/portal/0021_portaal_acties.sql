-- ============================================================
-- CUSTOM+ klantportaal — 0021: de schrijfacties van de klant
--
-- WAAROM DIT BESTAND BESTAAT
-- Het klantportaal kon tot nu toe precies één ding schrijven: een vraag
-- stellen. Alles wat in het beheer onder "wacht op klant" staat — een fase
-- op wacht-op-akkoord, een beoordeelde sampleronde, een gepubliceerde
-- factuur, een documentslot dat "verwacht" zegt, een herbestelling — werd
-- buiten het systeem om afgehandeld: per mail, per telefoon, en daarna
-- door de eigenaar zelf in het beheer overgetypt. Hoofdstuk 1 van
-- .claude/portaal-spec.md spiegelt elke wachtstand naar een klantactie;
-- hoofdstuk 3 is de bouwtekening van dit bestand.
--
-- HET PRINCIPE: ELKE KLANTACTIE LOOPT VIA EEN SERVERFUNCTIE
-- Een klant mag alleen zijn EIGEN wachtende fase goedkeuren, alleen zijn
-- EIGEN beoordeelde sample beoordelen, alleen op zijn EIGEN open factuur
-- een betaling melden. Dat is bedrijfslogica, en die hoort in één functie
-- die alle voorwaarden in vaste volgorde toetst — niet in een policy die
-- alleen eigendom kent. Elke functie hieronder is security definer met
-- een vast search_path, controleert zélf (1) wie, (2) de wachtstand,
-- (3) de invoer, en schrijft daarna (4) de rij, de auditregel
-- (admin_audit_log) en de activiteitregel (access_log). De klant krijgt
-- op die twee logtabellen geen enkel extra schrijfrecht.
--
-- Elke geweigerde voorwaarde is een `raise exception` met een korte
-- NEDERLANDSE code in snake_case ('fase_niet_in_wachtstand'). Die code
-- komt als `message` bij de browser aan; de datalaag vertaalt hem via
-- i18nT naar een zin in de taal van de klant. De volledige lijst staat
-- onderaan dit bestand, bij "DE FOUTCODES".
--
-- WELKE SCHERMEN HEM NODIG HEBBEN
--   · Overzicht "Wat we van jou nodig hebben"  → approve_stage,
--                                                decide_sample, report_payment
--   · Productdetail → Voortgang                 → approve_stage, decide_sample
--   · Betalingen                                → report_payment,
--                                                dispute_invoice,
--                                                client_payment_reports
--   · Bestanden "Wat er van jou verwacht wordt" → documents-insertpolicy +
--                                                bucket klant-upload
--   · Producten "Herbestellen"                  → request_reorder
--   · Instellingen "Jouw mensen / taal /        → client_contacts,
--     meldingen"                                  clients-voorkeurenpolicy
--   · Beheer → Financiën "betaling gemeld"      → verify_payment_report
--
-- HOE JE HEM DRAAIT
-- Plak dit HELE bestand in de SQL-editor van het Supabase-project en druk
-- op Run. Draai hem NÁ 0020_beheer_ia.sql (en dus ná 0001 t/m 0012). De
-- voorcontrole bovenaan weigert te draaien zolang 0020 ontbreekt.
-- Twee keer draaien mag: elke kolom is add-column-if-not-exists, elke
-- tabel en index is if-not-exists, elke policy wordt eerst gedropt, elke
-- functie is create-or-replace en elke trigger wordt eerst gedropt. Er
-- wordt niets weggegooid en geen bestaande kolom gewijzigd — met één
-- verruiming: de check op doc_type (0001, 0005) krijgt in blok 5 de drie
-- klanttypes erbij (drop + add onder dezelfde naam, dus ook herhaalbaar).
--
-- LET OP — ÉÉN FUNCTIE UIT 0012 WORDT HIER VERVANGEN
-- recalc_invoice_settlement() uit 0012_betalingen.sql telt ALLE rijen in
-- invoice_payments op. Sinds dit bestand kan een klant daar zelf een rij in
-- zetten (een gemelde betaling, reported_by_client = true). Zou die rij
-- meteen meetellen, dan zet een klant zijn eigen factuur op "betaald" door
-- een bedrag te typen. Blok 7 vervangt de functie daarom met exact
-- dezelfde tekst plus één voorwaarde: een onbevestigde klantmelding telt
-- niet mee. GEVOLG: draai je 0012 ooit opnieuw, draai dan daarna ook 0021
-- opnieuw, anders staat de oude telling terug.
--
-- BESTANDEN VAN DE KLANT
-- Klantuploads gaan in een EIGEN private bucket `klant-upload` (blok 9),
-- nooit in project-docs: daar mag alleen de staf schrijven en dat blijft
-- zo. Pad: {project_id}/{uuid}.{ext}, precies zoals 0001 het voor de
-- andere buckets voorschrijft. Een documents-rij met uploaded_by = 'klant'
-- wijst dus naar klant-upload; de datalaag van portaal én beheer moet bij
-- het maken van een signed URL op dat veld kijken (docUrl kiest vandaag
-- altijd project-docs).
-- ============================================================


-- ------------------------------------------------------------
-- 0. VOORCONTROLE — is alles waar dit bestand op leunt er al?
-- Liever één duidelijke fout vooraf dan een half gedraaide migratie
-- halverwege. Elke naam hieronder komt uit een eerder bestand; het
-- nummer erachter zegt welk.
-- array_append en niet `||`: `text[] || 'tekst'` leest de tekst als een
-- array-literal en klapt met "malformed array literal" vóór de raise,
-- zodat de voorcontrole zijn eigen zin nooit kon geven.
-- ------------------------------------------------------------
do $$
declare
  v_ontbreekt text[] := '{}';
begin
  if to_regclass('public.question_messages') is null then v_ontbreekt := array_append(v_ontbreekt, 'tabel question_messages (0020)'::text); end if;
  if to_regclass('public.team_members') is null then v_ontbreekt := array_append(v_ontbreekt, 'tabel team_members (0020)'::text); end if;
  if to_regclass('public.doc_slots') is null then v_ontbreekt := array_append(v_ontbreekt, 'tabel doc_slots (0005)'::text); end if;
  if to_regclass('public.admin_audit_log') is null then v_ontbreekt := array_append(v_ontbreekt, 'tabel admin_audit_log (0005)'::text); end if;
  if to_regclass('public.invoice_payments') is null then v_ontbreekt := array_append(v_ontbreekt, 'tabel invoice_payments (0008)'::text); end if;
  if to_regclass('public.invoice_audit') is null then v_ontbreekt := array_append(v_ontbreekt, 'tabel invoice_audit (0008)'::text); end if;
  if to_regprocedure('public.is_staff()') is null then v_ontbreekt := array_append(v_ontbreekt, 'functie is_staff() (0001)'::text); end if;
  if to_regprocedure('public.owns_project(uuid)') is null then v_ontbreekt := array_append(v_ontbreekt, 'functie owns_project(uuid) (0001)'::text); end if;
  if to_regprocedure('public.owns_invoice(uuid)') is null then v_ontbreekt := array_append(v_ontbreekt, 'functie owns_invoice(uuid) (0008)'::text); end if;
  if to_regprocedure('public.invoice_can_transition(text,text,bigint,boolean)') is null then v_ontbreekt := array_append(v_ontbreekt, 'functie invoice_can_transition (0012)'::text); end if;
  if to_regprocedure('public.invoice_credited_cents(uuid,uuid)') is null then v_ontbreekt := array_append(v_ontbreekt, 'functie invoice_credited_cents (0012)'::text); end if;
  if to_regprocedure('public.invoice_tolerance_cents()') is null then v_ontbreekt := array_append(v_ontbreekt, 'functie invoice_tolerance_cents (0012)'::text); end if;
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'question_messages'
       and policyname = 'client posts own question_messages'
  ) then
    v_ontbreekt := array_append(v_ontbreekt, 'policy "client posts own question_messages" (0020)'::text);
  end if;

  if array_length(v_ontbreekt, 1) is not null then
    raise exception '0021 kan nog niet draaien, dit ontbreekt: %. Draai eerst 0001 t/m 0012 en 0020.',
      array_to_string(v_ontbreekt, ', ');
  end if;
  raise notice '0021: voorcontrole in orde.';
end $$;


-- ------------------------------------------------------------
-- 1. HELPERS
-- ------------------------------------------------------------

-- Wie is de ingelogde klant? 0001 koppelt auth.uid() inline aan
-- clients.auth_user_id in elke policy; voor de klant-eigen tabellen
-- hieronder (client_contacts, reorder_requests) is één helper leesbaarder
-- en is er maar één plek die de koppeling kent. Zelfde patroon als
-- owns_project(): security definer zodat de policy niet afhangt van de
-- leesrechten op clients zelf, vast search_path, geen execute voor anon.
-- Geeft NULL terug voor staf zonder klantrij en voor anon — en NULL is in
-- een vergelijking nooit gelijk aan een client_id, dus dat is de veilige
-- kant.
create or replace function my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from clients c where c.auth_user_id = auth.uid();
$$;
revoke all on function my_client_id() from public;
revoke all on function my_client_id() from anon;
grant execute on function my_client_id() to authenticated, service_role;
comment on function my_client_id() is
  'Het clients.id van de ingelogde klant (via clients.auth_user_id = auth.uid()), of NULL. De helper achter de RLS van client_contacts en reorder_requests; tegenhanger van owns_project() uit 0001.';

-- De Nederlandse fasenaam bij een fasesleutel, ALLEEN voor logregels.
-- Dit is een kopie van de STAGES-tabel in beheer.html. Waarom hier toch
-- een tweede exemplaar: de log- en auditregels die de functies hieronder
-- schrijven zijn vrije tekst die het beheer letterlijk toont (mergeActivity
-- vertaalt niets meer), en een regel "Fase goedgekeurd: sourcing" is
-- precies de fout die de review van het beheer als bevinding aanwees.
-- Wijzigt de tabel in beheer.html, wijzig dan hier mee.
create or replace function stage_label_nl(p_key text) returns text
language sql immutable as $$
  select case p_key
    when 'concept'    then 'Concept & Industrieel Ontwerp'
    when 'dfm'        then 'Ontwerp voor Produceerbaarheid'
    when 'sourcing'   then 'Fabriekssourcing & Screening'
    when 'tooling'    then 'Tooling, Sampling & Iteratie'
    when 'production' then 'Massaproductie & Kwaliteitscontrole'
    when 'logistics'  then 'Compliance & Logistiek'
    else coalesce(p_key, '')
  end;
$$;
revoke all on function stage_label_nl(text) from public;
revoke all on function stage_label_nl(text) from anon;
grant execute on function stage_label_nl(text) to authenticated, service_role;
comment on function stage_label_nl(text) is
  'Fasesleutel → Nederlandse fasenaam, kopie van STAGES in beheer.html. Uitsluitend voor de logregels van 0021; schermen gebruiken hun eigen tabel.';

-- Een bedrag zoals de klant het leest, ALLEEN voor logregels: "€ 1.875,00",
-- "$ 123,45", en voor een munt zonder symbool de code ("CHF 12,50").
-- Woordelijk dezelfde vorm als CP_MODEL.formatCents (admin-model.js) en
-- geldTekst() in portaal-data.js, zodat demo en live dezelfde regel in het
-- logboek zetten en beheer én klanttijdlijn ze niet als twee verschillende
-- teksten tonen ("187500 centen EUR" was de oude vorm). Bewust geen to_char
-- met 'G': het duizendscheidingsteken hangt dan van lc_numeric af.
create or replace function portaal_geld_nl(p_cents bigint, p_currency text) returns text
language plpgsql immutable as $$
declare
  v_code text := upper(coalesce(nullif(btrim(p_currency), ''), 'EUR'));
  v_sym  text;
  v_abs  bigint := abs(coalesce(p_cents, 0));
  v_heel text := (v_abs / 100)::text;
begin
  if v_code !~ '^[A-Z]{3}$' then v_code := 'EUR'; end if;
  v_sym := case v_code
    when 'EUR' then '€' when 'USD' then '$' when 'CNY' then '¥'
    when 'JPY' then '¥' when 'GBP' then '£' else v_code end;
  -- duizendtallen met een punt: 1875 → 1.875
  v_heel := regexp_replace(v_heel, '(\d)(?=(\d{3})+$)', '\1.', 'g');
  return case when coalesce(p_cents, 0) < 0 then '-' else '' end
      || v_sym || ' ' || v_heel || ',' || lpad((v_abs % 100)::text, 2, '0');
end $$;
revoke all on function portaal_geld_nl(bigint, text) from public;
revoke all on function portaal_geld_nl(bigint, text) from anon;
grant execute on function portaal_geld_nl(bigint, text) to authenticated, service_role;
comment on function portaal_geld_nl(bigint, text) is
  'Centen + munt → "€ 1.875,00" (symbool voor EUR/USD/CNY/JPY/GBP, anders de code), woordelijk CP_MODEL.formatCents. Uitsluitend voor de logregels van 0021.';

-- "3 sep 2026": dezelfde korte datumvorm als dagNL() in portaal-data.js en
-- formatDate in admin-model.js, met Nederlandse maandafkortingen — geen
-- to_char(…, 'DD-MM-YYYY'), zodat de logregel niet als enige "03-09-2026"
-- zegt.
create or replace function portaal_datum_nl(p_dag date) returns text
language sql immutable as $$
  select case when p_dag is null then '' else
    extract(day from p_dag)::int::text || ' '
    || (array['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'])[extract(month from p_dag)::int]
    || ' ' || extract(year from p_dag)::int::text
  end;
$$;
revoke all on function portaal_datum_nl(date) from public;
revoke all on function portaal_datum_nl(date) from anon;
grant execute on function portaal_datum_nl(date) to authenticated, service_role;
comment on function portaal_datum_nl(date) is
  'Datum → "3 sep 2026" met Nederlandse maandafkorting (jan feb mrt apr mei jun jul aug sep okt nov dec), woordelijk dagNL() in portaal-data.js. Uitsluitend voor de logregels van 0021.';

-- Generieke updated_at-bumper voor de twee nieuwe tabellen. Bewust een
-- trigger en geen afspraak "de client stuurt updated_at mee": een klant
-- die updated_at meestuurt kan er elke datum in zetten, een trigger niet.
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
comment on function touch_updated_at() is
  'before update-trigger: zet updated_at op now(). Gebruikt door reorder_requests en client_contacts.';

-- Het project-id uit een opslagpad ({project_id}/{uuid}.{ext}), of NULL
-- als het pad daar niet mee begint. 0001 cast (storage.foldername(name))[1]
-- rechtstreeks naar uuid; dat gooit bij een willekeurig pad een casting-
-- fout in plaats van een nette weigering. Deze helper toetst eerst de vorm.
create or replace function klant_upload_project_id(p_name text) returns uuid
language plpgsql immutable as $$
declare
  v_eerste text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if v_eerste !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_eerste::uuid;
end $$;
revoke all on function klant_upload_project_id(text) from public;
revoke all on function klant_upload_project_id(text) from anon;
grant execute on function klant_upload_project_id(text) to authenticated, service_role;
comment on function klant_upload_project_id(text) is
  'Eerste padsegment van een opslagpad als uuid, of NULL als het geen uuid is. Voor de storage-policies van bucket klant-upload (blok 9) en de documents-insertpolicy (blok 5).';

-- Wie mag herbestellen? Dezelfde regel als projectIsCompleted() in
-- portal.html: het project is gearchiveerd, óf er zijn fasen en ze zijn
-- allemaal afgerond. Eén functie, twee aanroepers (de insertpolicy op
-- reorder_requests en request_reorder()), zodat de regel nooit uit de pas
-- kan lopen.
create or replace function project_herbestelbaar(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projects pr
     where pr.id = p
       and (
         pr.status = 'archived'
         or (
           exists (select 1 from project_stages s where s.project_id = pr.id)
           and not exists (select 1 from project_stages s where s.project_id = pr.id and s.status <> 'done')
         )
       )
  );
$$;
revoke all on function project_herbestelbaar(uuid) from public;
revoke all on function project_herbestelbaar(uuid) from anon;
grant execute on function project_herbestelbaar(uuid) to authenticated, service_role;
comment on function project_herbestelbaar(uuid) is
  'Waar als het project gearchiveerd is of alle fasen op done staan — de wachtstand waarin herbestellen kan. Spiegel van projectIsCompleted() in portal.html.';

-- DE LOGSCHRIJVER. Elke klantactie laat twee sporen na:
--   · access_log   — de klantzichtbare tijdlijn (0001; de klant leest zijn
--                    eigen regels, dat is de "Activiteit" van het portaal);
--   · admin_audit_log — het staf-logboek (0005), met kind = 'klant' als
--                    eigen actietype, zodat het beheer de klantacties als
--                    aparte soort kan filteren (spec §2, "Activiteit").
-- Uitsluitend aanroepbaar vanuit de definer-functies en -triggers in dit
-- bestand: geen execute voor de browserrollen. Zo kan een klant nooit
-- rechtstreeks een logregel schrijven die zich als actie voordoet.
create or replace function portaal_log(
  p_project    uuid,
  p_actor      text,
  p_action     text,
  p_asset_kind text,
  p_asset_id   uuid,
  p_detail     text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_detail text := left(coalesce(p_detail, ''), 2000);
begin
  select client_id into v_client from projects where id = p_project;
  insert into access_log (project_id, actor, asset_kind, asset_id, action, detail)
  values (p_project, coalesce(p_actor, 'client'), p_asset_kind, p_asset_id, p_action, v_detail);
  insert into admin_audit_log (kind, client_id, project_id, detail)
  values ('klant', v_client, p_project, v_detail);
end $$;
revoke all on function portaal_log(uuid, text, text, text, uuid, text) from public;
revoke all on function portaal_log(uuid, text, text, text, uuid, text) from anon;
revoke all on function portaal_log(uuid, text, text, text, uuid, text) from authenticated;
grant execute on function portaal_log(uuid, text, text, text, uuid, text) to service_role;
comment on function portaal_log(uuid, text, text, text, uuid, text) is
  'Schrijft één klantactie als activiteitregel (access_log) én auditregel (admin_audit_log, kind klant). Alleen intern aanroepbaar; de klant heeft er geen execute op.';


-- ------------------------------------------------------------
-- 2. KOLOMMEN — nooit een bestaande gewijzigd, alleen toegevoegd
-- ------------------------------------------------------------

-- ---- project_stages: wie gaf akkoord, en langs welke weg ----
-- approved_at bestaat sinds 0001 en wordt door het beheer gezet zodra een
-- fase op done gaat. Wat ontbrak: door WIE en VIA welk kanaal. Bestaande
-- rijen houden approved_by '' en approved_via NULL — dat is eerlijk
-- "onbekend, van vóór 0021", en geen verzonnen naam.
alter table project_stages add column if not exists approved_by text not null default '';
alter table project_stages add column if not exists approved_via text
  check (approved_via is null or approved_via in ('portaal','beheer'));

comment on column project_stages.approved_by is
  'Naam die de klant intypte bij het geven van akkoord (approve_stage), of de naam die het beheer vastlegt. Leeg = onbekend (fase van vóór 0021 of zonder naam afgerond).';
comment on column project_stages.approved_via is
  'portaal = de klant klikte zelf akkoord via approve_stage(); beheer = de eigenaar zette de fase op done in het beheer. NULL = van vóór 0021. Het projectdetail in het beheer toont wie en wanneer.';

-- ---- sample_rounds: de klantbeoordeling ----
-- status ('reviewed' | 'approved' | 'superseded') blijft het stafveld.
-- De klantbeslissing staat ernaast, zodat het beheer altijd kan zien wat
-- de klant zei, óók als de staf daarna een nieuwe ronde maakt.
alter table sample_rounds add column if not exists client_decision text
  check (client_decision is null or client_decision in ('goedgekeurd','aanpassing'));
alter table sample_rounds add column if not exists client_note text not null default '';
alter table sample_rounds add column if not exists client_decided_at timestamptz;
alter table sample_rounds add column if not exists client_marks jsonb not null default '[]'::jsonb
  check (jsonb_typeof(client_marks) = 'array');

comment on column sample_rounds.client_decision is
  'goedgekeurd | aanpassing — de beslissing van de klant via decide_sample(). NULL = nog geen beslissing. Wordt maar één keer gezet: een tweede beslissing op dezelfde ronde wordt geweigerd (sample_al_beoordeeld).';
comment on column sample_rounds.client_note is
  'Opmerking van de klant bij zijn beslissing. Bij "aanpassing" is een opmerking of minstens één markering verplicht: een aanpassing zonder uitleg kan de staf niets mee.';
comment on column sample_rounds.client_decided_at is
  'Tijdstip van de klantbeslissing, door de server gezet (now()). Vergelijkbaar met approved_at op een fase.';
comment on column sample_rounds.client_marks is
  'jsonb-array van aanwijzingen op de samplefoto, bv. [{"x":0.42,"y":0.61,"note":"logo te klein"}] met x en y als breukdeel (0–1) van de foto. De server eist alleen dat het een array van objecten is (max. 50); de vorm van de objecten is aan de datalaag.';

-- ---- invoice_payments: de gemelde betaling ----
-- Een klant meldt een betaling (report_payment); dat wordt een rij in de
-- bestaande betalingentabel, gemarkeerd als klantmelding en NOG NIET
-- bevestigd. Pas als de staf verified_at zet (verify_payment_report) telt
-- de rij mee in het saldo — zie blok 7 voor waarom dat onmisbaar is.
alter table invoice_payments add column if not exists reported_by_client boolean not null default false;
alter table invoice_payments add column if not exists client_reference text not null default '';
alter table invoice_payments add column if not exists verified_at timestamptz;

create index if not exists invoice_payments_unverified_idx
  on invoice_payments (invoice_id)
  where reported_by_client and verified_at is null;

comment on column invoice_payments.reported_by_client is
  'true = deze rij is een MELDING van de klant (report_payment), geen boeking door de staf. Telt pas mee in paid_cents/outstanding_cents zodra verified_at gevuld is.';
comment on column invoice_payments.client_reference is
  'Het betalingskenmerk zoals de klant het opgaf. Bij bevestigen kopieert verify_payment_report() het naar transaction_ref als de staf niets anders invult.';
comment on column invoice_payments.verified_at is
  'Moment waarop de staf de gemelde betaling bevestigde. NULL bij een klantmelding = nog controleren (Inbox-item "betaling gemeld"). Bij een gewone stafboeking (reported_by_client = false) blijft hij NULL en betekent hij niets.';

-- ---- documents: herkomst, opmerking en het slot ----
-- uploaded_by zegt uit welke bucket het bestand komt (staf → project-docs,
-- klant → klant-upload) en wie het aanleverde. slot_id staat niet in de
-- bouwtekening van hoofdstuk 3, maar zonder is de insertpolicy hieronder
-- niet te schrijven: doc_slots wijst naar documents (document_id), niet
-- andersom, en bij een insert bestaat de documentrij nog niet — het slot
-- kan er dus nog niet naar wijzen. De klant zegt daarom zelf IN WELK slot
-- hij aanlevert; de policy toetst dat dat slot van zijn project is, leeg
-- en "verwacht", en de trigger vult het slot daarna aan de andere kant.
alter table documents add column if not exists uploaded_by text not null default 'staf'
  check (uploaded_by in ('staf','klant'));
alter table documents add column if not exists client_note text not null default '';
alter table documents add column if not exists slot_id uuid references doc_slots(id) on delete set null;

create index if not exists documents_slot_idx on documents (slot_id) where slot_id is not null;

comment on column documents.uploaded_by is
  'staf | klant. Default staf, dus elk bestaand document blijft een stafdocument. klant = aangeleverd via het portaal; het bestand staat dan in bucket klant-upload en niet in project-docs — de datalaag moet daarop kiezen bij createSignedUrl.';
comment on column documents.client_note is
  'Opmerking van de klant bij het aangeleverde bestand ("dit is de definitieve versie van het logo"). Leeg bij stafdocumenten.';
comment on column documents.slot_id is
  'Het documentslot (doc_slots) waarin dit bestand is aangeleverd. Verplicht bij uploaded_by = klant (de policy eist het); NULL bij stafdocumenten. on delete set null: een verwijderd slot laat het document staan.';

-- ---- doc_slots: van wie het bestand wordt verwacht ----
-- Een slot 'verwacht' was tot nu toe altijd iets wat de STAF levert (het
-- beheer maakt hem aan en vult hem via het documentmodal; het portaal zegt
-- "verschijnt hier zodra Steffan het deelt"). Sinds blok 5 kan een klant in
-- een slot uploaden, en dan moet het slot zelf zeggen van wie het bestand
-- komt — anders vult een klant een slot dat CUSTOM+ zou leveren (een
-- inspectierapport, een offerte). Bestaande rijen krijgen 'staf': dat is
-- wat ze altijd waren. De insertpolicy in blok 5 eist 'klant'; het portaal
-- (portaal-model.js, slotVanKlant) leest hetzelfde veld.
alter table doc_slots add column if not exists expected_from text not null default 'staf'
  check (expected_from in ('klant','staf'));
comment on column doc_slots.expected_from is
  'klant | staf: van wie het bestand in dit slot wordt verwacht. Alleen bij klant mag de klant zelf uploaden (policy "client uploads into own doc slot"); de datalaag geeft anders slot_niet_van_klant. Default staf: elk bestaand slot blijft iets wat de staf levert.';


-- ------------------------------------------------------------
-- 3. NIEUWE TABELLEN
-- ------------------------------------------------------------

-- ---- reorder_requests: de herbestelling als echte rij ----
-- Tot nu toe was een herbestelling een klantvraag met het voorvoegsel
-- "HERBESTELLING:" in de tekst, en leefde de pijplijnstand als losse
-- instelling (settings.reorderPipeline[vraag-id]). Dat voorvoegsel was een
-- noodgreep; dit is de tabel. De vier statussen zijn LETTERLIJK de sleutels
-- van REORDER_STAGES in beheer.html en admin-model.js — het zijn opgeslagen
-- waarden, hernoemen breekt elke bestaande stand.
create table if not exists reorder_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  qty integer not null check (qty > 0),
  wanted_by date,
  same_spec boolean not null default true,
  change_note text not null default '',
  status text not null default 'aanvraag'
    check (status in ('aanvraag','offerte','akkoord','project')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reorder_requests_project_idx on reorder_requests (project_id, created_at);
create index if not exists reorder_requests_client_idx  on reorder_requests (client_id, created_at);

comment on table reorder_requests is
  'Herbestellingen vanuit het klantportaal (request_reorder). Vervangt het HERBESTELLING:-voorvoegsel op een klantvraag. status is de vierstapspijplijn uit het beheer; de staf schuift hem door, de klant leest hem.';
comment on column reorder_requests.id is 'Sleutel van de aanvraag; het beheer kan hem als sleutel in settings.reorderPipeline gebruiken voor quoteDocId/projectId, precies zoals nu met een vraag-id.';
comment on column reorder_requests.created_at is 'Moment van aanvragen, door de server gezet.';
comment on column reorder_requests.project_id is 'Het afgeronde product waar de herbestelling van is (niet het nieuwe batchproject dat stap 4 aanmaakt).';
comment on column reorder_requests.client_id is 'De klant die aanvroeg; altijd de eigenaar van project_id. Apart opgeslagen zodat "mijn herbestellingen" één where-clausule is.';
comment on column reorder_requests.qty is 'Gewenst aantal stuks, geheel getal groter dan nul.';
comment on column reorder_requests.wanted_by is 'Gewenste leverdatum. NULL = geen voorkeur. Nooit in het verleden en hoogstens drie jaar vooruit (request_reorder toetst dat).';
comment on column reorder_requests.same_spec is 'true = exact dezelfde specificatie als het afgeronde product; false = met wijziging, dan is change_note verplicht.';
comment on column reorder_requests.change_note is 'Wat er anders moet, in de woorden van de klant. Verplicht bij same_spec = false, anders leeg.';
comment on column reorder_requests.status is 'aanvraag | offerte | akkoord | project — de vier pijplijnstappen (REORDER_STAGES in beheer.html). Alleen de staf zet hem; de klant heeft geen update-policy.';
comment on column reorder_requests.updated_at is 'Bijgewerkt door de trigger reorder_requests_touch_trg bij elke wijziging.';

drop trigger if exists reorder_requests_touch_trg on reorder_requests;
create trigger reorder_requests_touch_trg
  before update on reorder_requests
  for each row execute function touch_updated_at();

-- Eén onaangeraakte aanvraag per project tegelijk. Zolang een vorige
-- aanvraag nog op stap 1 ('aanvraag') staat heeft de staf hem nog niet
-- eens gezien; een tweede is dan een dubbelklik of een misverstand, en de
-- klant hoort dat als foutcode terug. Zodra de staf hem naar 'offerte'
-- heeft geschoven mag er wél een nieuwe bij — een pijplijn kent geen
-- afwijs-stap, en een klant blokkeren omdat een oude offerte nooit is
-- afgerond zou een val zijn.
-- Alleen voor de klant: beheer (is_staff) en achtergrondprocessen
-- (auth.uid() is null) mogen wat ze willen, dat is hun eigen verantwoording.
-- security definer omdat de klant via RLS alleen zijn eigen rijen ziet en
-- dit een volledige telling vraagt (die is hier per definitie alleen over
-- zijn eigen project, maar de policy hoeft dat niet uit te rekenen).
create or replace function reorder_requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_staff() then return new; end if;
  if exists (
    select 1 from reorder_requests r
     where r.project_id = new.project_id
       and r.status = 'aanvraag'
       and r.id <> new.id
  ) then
    raise exception 'herbestelling_loopt_al';
  end if;
  return new;
end $$;
comment on function reorder_requests_guard() is
  'before insert op reorder_requests: weigert voor een klant een tweede aanvraag zolang er op hetzelfde project nog een op stap aanvraag staat (herbestelling_loopt_al). Staf en service_role ongemoeid.';
drop trigger if exists reorder_requests_guard_trg on reorder_requests;
create trigger reorder_requests_guard_trg
  before insert on reorder_requests
  for each row execute function reorder_requests_guard();

-- De logregel bij een klantaanvraag. Als TRIGGER en niet alleen in
-- request_reorder(), zodat de insertpolicy hieronder en de RPC exact
-- hetzelfde spoor achterlaten: wie via welke weg ook aanvraagt, het
-- staat in beide logboeken. De datum in de demovorm (portaal_datum_nl),
-- woordelijk zoals herbestellen() in portaal-data.js hem schrijft.
create or replace function reorder_requests_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_staff() then return new; end if;
  perform portaal_log(
    new.project_id, 'client', 'reorder', 'reorder', new.id,
    'Herbestelling aangevraagd: ' || new.qty || ' stuks'
      || case when new.wanted_by is not null then ', gewenst op ' || portaal_datum_nl(new.wanted_by) else '' end
      || case when new.same_spec then ', zelfde specificatie' else ', met wijziging: ' || left(new.change_note, 300) end
  );
  return new;
end $$;
comment on function reorder_requests_log() is
  'after insert op reorder_requests: schrijft voor een klantaanvraag de activiteit- en auditregel via portaal_log(). Vuurt bij de RPC én bij een rechtstreekse insert, zodat beide wegen hetzelfde spoor laten.';
drop trigger if exists reorder_requests_log_trg on reorder_requests;
create trigger reorder_requests_log_trg
  after insert on reorder_requests
  for each row execute function reorder_requests_log();

alter table reorder_requests enable row level security;

-- LEZEN: de eigen klant en de staf.
drop policy if exists "client reads own reorder_requests" on reorder_requests;
create policy "client reads own reorder_requests" on reorder_requests
  for select using (client_id = my_client_id() or is_staff());

-- AANMAKEN door de klant. De bedoelde weg is request_reorder() — die
-- geeft nette foutcodes en de bijgewerkte rij terug. Deze policy bestaat
-- ernaast, met exact dezelfde eisen, zodat een rechtstreekse insert nooit
-- méér kan dan de RPC:
--   · client_id is de aanroeper zelf en het project is van hem;
--   · het project is herbestelbaar (project_herbestelbaar, dezelfde regel);
--   · status is stap 1 — een klant begint nooit op 'offerte';
--   · qty > 0, wanted_by niet in het verleden en niet meer dan drie jaar
--     vooruit, en bij "met wijziging" een gevulde change_note;
--   · created_at rond nu (zelfde reden en hetzelfde venster als de
--     berichtenpolicy in 0020: de volgorde is niet te herschrijven).
-- Er is bewust GEEN update- of delete-policy voor de klant: de pijplijn
-- is van de staf, en een verstuurde aanvraag hoort niet achteraf te
-- veranderen. Zonder policy kan het niet — de veilige kant.
drop policy if exists "client creates own reorder_requests" on reorder_requests;
create policy "client creates own reorder_requests" on reorder_requests
  for insert with check (
    client_id = my_client_id()
    and owns_project(project_id)
    and project_herbestelbaar(project_id)
    and status = 'aanvraag'
    and qty > 0
    and (wanted_by is null or (wanted_by >= current_date and wanted_by <= current_date + 1095))
    and (same_spec or btrim(change_note) <> '')
    and created_at > now() - interval '5 minutes'
    and created_at <= now()
  );

-- STAF: alles, het bestaande patroon.
drop policy if exists "staff writes reorder_requests" on reorder_requests;
create policy "staff writes reorder_requests" on reorder_requests
  for all using (is_staff()) with check (is_staff());

-- Grants expliciet, om dezelfde reden als in 0020: leunen op de
-- projectstandaard maakt van een aangepaste standaard een STILLE lege
-- lijst. De grant opent de tabel; de policies bepalen wie welke rij mag.
revoke all on table reorder_requests from anon;
grant select, insert, update, delete on table reorder_requests to authenticated;
grant select, insert, update, delete on table reorder_requests to service_role;


-- ---- client_contacts: de mensen van de klant, door de klant beheerd ----
--
-- WAAROM TWEE CONTACTPERSONENTABELLEN EN NIET ÉÉN MET EEN VLAG.
-- admin_contacts (0005, golf 5) is de lijst die de STAF bijhoudt: wie bij
-- de klant welke mail krijgt, met de interne velden die daarbij horen, en
-- met een policy die alleen is_staff() kent. Zou de klant in die tabel
-- mogen schrijven, dan zijn er twee problemen die geen policy oplost:
--   1. Postgres kent geen leesrecht per kolom. Een klant die zijn eigen rij
--      mag lezen, leest de HELE rij — ook wat de staf er ooit intern bij
--      zet. Dat is precies de les van factory_private in 0020.
--   2. Een vlag "door klant" op een gedeelde rij vervuilt: wie de rij
--      daarna bewerkt, staf of klant, moet de vlag goed zetten, en niets
--      dwingt dat af. Bij twee tabellen is de herkomst een feit van de
--      tabel zelf: alles in client_contacts is per definitie van de klant.
-- Daarom: admin_contacts blijft staf-eigen en ongewijzigd; client_contacts
-- is de klant-eigen lijst, met volledige RLS voor de eigen klant. Het
-- beheer leest client_contacts (staf ziet alles) en toont die rijen met de
-- markering "door klant". De mailfan-out van notifyClient kan beide lijsten
-- naast elkaar leggen; dat is werk voor de beheerkant (spec §2).
create table if not exists client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  email text not null default ''
    check (email = '' or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role text not null default '',
  mail_categories jsonb not null default '[]'::jsonb
    check (jsonb_typeof(mail_categories) = 'array'),
  can_login boolean not null default false,
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Hetzelfde adres hoogstens één keer per klant, hoofdletterongevoelig;
-- lege adressen doen niet mee (een naam zonder mail mag bestaan).
create unique index if not exists client_contacts_email_uniq
  on client_contacts (client_id, lower(email)) where email <> '';
create index if not exists client_contacts_client_idx on client_contacts (client_id);

comment on table client_contacts is
  'Contactpersonen die de KLANT zelf beheert in Instellingen → Jouw mensen. Bewust apart van admin_contacts (staf-eigen, 0005): Postgres kent geen leesrecht per kolom, en de herkomst "door klant" is zo een feit van de tabel en geen vlag die iemand goed moet zetten.';
comment on column client_contacts.id is 'Sleutel van de contactpersoon.';
comment on column client_contacts.created_at is 'Moment van toevoegen, door de server gezet.';
comment on column client_contacts.client_id is 'De klant waar deze persoon bij hoort. Altijd my_client_id() bij een klantinsert; on delete cascade.';
comment on column client_contacts.name is 'Volledige naam, niet leeg.';
comment on column client_contacts.email is 'E-mailadres; leeg toegestaan, anders een geldige vorm. Uniek per klant via client_contacts_email_uniq.';
comment on column client_contacts.role is 'Functie in de woorden van de klant, bv. Inkoop. Vrije tekst.';
comment on column client_contacts.mail_categories is
  'jsonb-array van mailcategorieën die deze persoon wil ontvangen. De categorieën die notifyClient vandaag kent: fase, update, sample, zending, factuur, relatie (zie admin_contacts.cats in 0005). Bewust geen vaste lijst in de check: komt er een categorie bij, dan hoeft deze tabel niet mee.';
comment on column client_contacts.can_login is
  'WENS van de klant dat deze persoon mag inloggen. Dit maakt GEEN account aan en geeft GEEN toegang: inloggen loopt via Supabase Auth en de uitnodiging door de staf (clients.invited_at). Het portaal moet dat ook zo zeggen — geen belofte die het systeem niet waarmaakt.';
comment on column client_contacts.avatar_url is 'Verwijzing naar een foto, zelfde opslag als de andere avatars (demomodus: IndexedDB-sleutel; live: pad in een bucket). Leeg = initialen.';
comment on column client_contacts.updated_at is 'Bijgewerkt door de trigger client_contacts_touch_trg.';

drop trigger if exists client_contacts_touch_trg on client_contacts;
create trigger client_contacts_touch_trg
  before update on client_contacts
  for each row execute function touch_updated_at();

-- Auditregel bij elke wijziging door de klant (spec §1 regel 7:
-- "activiteitregel"). Alleen admin_audit_log: een contactpersoon hangt aan
-- de klant, niet aan een project, en access_log eist een project_id.
-- security definer omdat de klant geen schrijfrecht heeft op het logboek.
create or replace function client_contacts_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row client_contacts%rowtype;
  v_wat text;
begin
  if auth.uid() is null or is_staff() then return coalesce(new, old); end if;
  v_row := coalesce(new, old);
  v_wat := case tg_op
    when 'INSERT' then 'Contactpersoon toegevoegd door klant: '
    when 'UPDATE' then 'Contactpersoon gewijzigd door klant: '
    else               'Contactpersoon verwijderd door klant: '
  end;
  insert into admin_audit_log (kind, client_id, project_id, detail)
  values ('klant', v_row.client_id, null,
          v_wat || v_row.name || case when v_row.email <> '' then ' <' || v_row.email || '>' else '' end);
  return coalesce(new, old);
end $$;
comment on function client_contacts_log() is
  'after insert/update/delete op client_contacts: één auditregel (admin_audit_log, kind klant) per wijziging door de klant, zodat het beheer "door klant" kan tonen. Staf en service_role laten geen regel achter.';
drop trigger if exists client_contacts_log_trg on client_contacts;
create trigger client_contacts_log_trg
  after insert or update or delete on client_contacts
  for each row execute function client_contacts_log();

alter table client_contacts enable row level security;

-- Eigen klant: lezen, invoeren, bijwerken, verwijderen — telkens langs
-- my_client_id(). De with check op update voorkomt dat een klant een rij
-- naar een andere klant "verhuist"; de using op update en delete dat hij
-- een rij van een ander aanraakt.
drop policy if exists "client reads own client_contacts" on client_contacts;
create policy "client reads own client_contacts" on client_contacts
  for select using (client_id = my_client_id() or is_staff());
drop policy if exists "client inserts own client_contacts" on client_contacts;
create policy "client inserts own client_contacts" on client_contacts
  for insert with check (client_id = my_client_id());
drop policy if exists "client updates own client_contacts" on client_contacts;
create policy "client updates own client_contacts" on client_contacts
  for update using (client_id = my_client_id()) with check (client_id = my_client_id());
drop policy if exists "client deletes own client_contacts" on client_contacts;
create policy "client deletes own client_contacts" on client_contacts
  for delete using (client_id = my_client_id());
drop policy if exists "staff writes client_contacts" on client_contacts;
create policy "staff writes client_contacts" on client_contacts
  for all using (is_staff()) with check (is_staff());

revoke all on table client_contacts from anon;
grant select, insert, update, delete on table client_contacts to authenticated;
grant select, insert, update, delete on table client_contacts to service_role;


-- ------------------------------------------------------------
-- 4. CLIENTS — de klant kiest zijn taal en zijn mailvoorkeuren
-- portal_lang en mail_prefs staan sinds 0005 op clients, maar de klant had
-- op zijn eigen rij alleen LEESrecht ("client reads own row", 0001). De
-- acties taalKiezen() en meldingenOpslaan() uit het actiecontract hebben
-- dus een update-policy nodig — en die mag NIET de hele rij vrijgeven:
-- company, email, vat_number en de interne notes zijn niet van de klant om
-- te wijzigen. Postgres kent geen policy per kolom; de trigger eronder is
-- het slot: voor een klant mag alleen portal_lang en mail_prefs verschillen
-- tussen old en new. De vergelijking gaat via to_jsonb minus die twee
-- sleutels, zodat een kolom die later bijkomt vanzelf ook op slot zit.
-- ------------------------------------------------------------
drop policy if exists "client updates own prefs" on clients;
create policy "client updates own prefs" on clients
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create or replace function clients_guard_prefs() returns trigger
language plpgsql as $$
begin
  -- staf en achtergrondprocessen: geen beperking, dat regelt hun eigen policy
  if auth.uid() is null or is_staff() then return new; end if;
  if (to_jsonb(new) - 'portal_lang' - 'mail_prefs')
     is distinct from (to_jsonb(old) - 'portal_lang' - 'mail_prefs') then
    raise exception 'alleen_voorkeuren_wijzigbaar';
  end if;
  -- de vier vertalingen in portal/i18n.js plus de Nederlandse bron
  if new.portal_lang not in ('nl','en','de','fr','es') then
    raise exception 'taal_onbekend' using detail = 'taal: ' || coalesce(new.portal_lang, '');
  end if;
  -- mail_prefs is een map {"categorie": false} (0005); een array of een
  -- losse waarde zou notifyClient stil laten struikelen
  if jsonb_typeof(new.mail_prefs) <> 'object' then
    raise exception 'voorkeuren_ongeldig';
  end if;
  return new;
end $$;
drop trigger if exists clients_guard_prefs_trg on clients;
create trigger clients_guard_prefs_trg
  before update on clients
  for each row execute function clients_guard_prefs();

comment on function clients_guard_prefs() is
  'before update op clients: een ingelogde KLANT mag uitsluitend portal_lang en mail_prefs wijzigen (foutcode alleen_voorkeuren_wijzigbaar). Staf en service_role ongemoeid.';


-- ------------------------------------------------------------
-- 5. DOCUMENTS — een bestand aanleveren in een verwacht slot
-- De klant krijgt precies één ding: een NIEUWE rij aanmaken die
--   · van hem is (owns_project),
--   · uploaded_by = 'klant' draagt (nooit een stafdocument nabootsen),
--   · in een slot van ZIJN project valt dat leeg is, op 'verwacht' staat
--     en van de KLANT wordt verwacht (expected_from = 'klant', blok 2 —
--     een slot dat de staf levert is geen vraag aan de klant), met het
--     doc_type en de stage_key van dat slot,
--   · naar een pad in zijn eigen projectmap wijst ({project_id}/…, de
--     bucket klant-upload eist hetzelfde pad bij de upload),
--   · niet aan een zending hangt, geen concept of planning is, en een
--     created_at rond nu heeft (zelfde venster als 0020).
-- Wat een klant NIET kan: een bestaande rij wijzigen of verwijderen — er
-- is voor hem geen update- of delete-policy, dus een stafdocument
-- overschrijven is uitgesloten. Een document buiten een slot plaatsen kan
-- ook niet: slot_id is verplicht en moet aan alle slotvoorwaarden voldoen.
-- De bucket verhindert daarnaast dat een bestand in de opslag wordt
-- overschreven: klant-upload kent voor de klant geen update-policy.
-- ------------------------------------------------------------
-- Het documenttype van wat een klant aanlevert: zijn logo, zijn artwork,
-- zijn specificatie (KLANT_DOC_TYPES in portaal-model.js). De checks uit
-- 0001 (documents) en 0005 (doc_slots) kenden alleen de staftypes; zonder
-- verruiming kan geen klantslot met zo'n type bestaan en is de demoseed
-- (demo-data-portaal.js: artwork, specificatie) live ongeldig. Beide checks
-- zijn inline en dus automatisch benoemd (<tabel>_doc_type_check); hier
-- vervangen door dezelfde lijst plus de drie klanttypes. Herhaalbaar:
-- drop if exists + add onder dezelfde naam.
alter table documents drop constraint if exists documents_doc_type_check;
alter table documents add constraint documents_doc_type_check check (doc_type in
  ('nnn','quote','invoice','inspection','compliance','shipping','other','logo','artwork','specificatie'));
alter table doc_slots drop constraint if exists doc_slots_doc_type_check;
alter table doc_slots add constraint doc_slots_doc_type_check check (doc_type in
  ('nnn','quote','invoice','inspection','compliance','shipping','other','logo','artwork','specificatie'));

drop policy if exists "client uploads into own doc slot" on documents;
create policy "client uploads into own doc slot" on documents
  for insert with check (
    uploaded_by = 'klant'
    and owns_project(project_id)
    and slot_id is not null
    and exists (
      select 1 from doc_slots sl
       where sl.id = documents.slot_id
         and sl.project_id = documents.project_id
         and sl.status = 'verwacht'
         and sl.document_id is null
         and sl.expected_from = 'klant'
         and sl.doc_type = documents.doc_type
         and sl.stage_key = documents.stage_key
    )
    and klant_upload_project_id(storage_path) = project_id
    and btrim(title) <> ''
    and version >= 1
    and shipment_id is null
    and publish_status = 'published'
    and scheduled_at is null
    and published_at is null
    and file_stale = false
    and created_at > now() - interval '5 minutes'
    and created_at <= now()
  );

-- Het slot aan de andere kant vullen, en de logregels schrijven. De klant
-- heeft geen update-recht op doc_slots (0005: staf schrijft), dus dit is
-- security definer. Vindt de update GEEN rij — het slot is intussen door
-- iemand anders gevuld — dan is dat een fout en gaat de hele insert terug:
-- een document dat in geen enkel slot terechtkwam mag niet bestaan.
-- Vuurt alleen voor klantuploads in een slot; het beheer vult zijn eigen
-- slots al zelf (fillSlot in beheer.html) en blijft daar ongemoeid.
create or replace function documents_fill_slot() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if new.uploaded_by <> 'klant' or new.slot_id is null then return new; end if;
  update doc_slots
     set status = 'gevuld', document_id = new.id
   where id = new.slot_id
     and status = 'verwacht'
     and document_id is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'slot_al_gevuld';
  end if;
  perform portaal_log(
    new.project_id,
    case when is_staff() then 'staff' else 'client' end,
    'upload', 'document', new.id,
    'Bestand aangeleverd door klant: ' || new.title
      || case when new.client_note <> '' then ' — ' || left(new.client_note, 300) else '' end
  );
  return new;
end $$;
drop trigger if exists documents_fill_slot_trg on documents;
create trigger documents_fill_slot_trg
  after insert on documents
  for each row execute function documents_fill_slot();

comment on function documents_fill_slot() is
  'after insert op documents: bij uploaded_by = klant het opgegeven doc_slot op gevuld zetten (of weigeren met slot_al_gevuld) en de activiteit- en auditregel schrijven.';


-- ------------------------------------------------------------
-- 6. QUESTION_MESSAGES — niets nieuws, wel gecontroleerd
-- De klant-insertpolicy "client posts own question_messages" uit 0020
-- (eigen draad, author = 'client', eigen naam of leeg, created_at rond nu)
-- is precies wat berichtSturen() nodig heeft. De voorcontrole in blok 0
-- weigert deze migratie zolang die policy ontbreekt; hier wordt hij
-- bewust NIET opnieuw aangemaakt — één eigenaar per policy, en dat is 0020.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- 7. HET SALDO — een onbevestigde klantmelding telt niet mee
-- Dit is de enige plek in dit bestand die iets uit een eerder bestand
-- VERVANGT. De tekst hieronder is letterlijk recalc_invoice_settlement()
-- uit 0012_betalingen.sql (fixronde), met precies één toevoeging in de
-- optelling van de betalingen:
--     and not (reported_by_client and verified_at is null)
-- Zonder die regel zou report_payment() — dat een rij in invoice_payments
-- zet en daarmee de trigger invoice_payments_recalc_trg laat vuren — het
-- saldo van de factuur meteen verlagen en de status op 'paid' zetten op
-- gezag van de klant alleen. Een MELDING is geen BOEKING; pas als de staf
-- verified_at zet (verify_payment_report, blok 8) vuurt dezelfde trigger
-- opnieuw en telt de rij mee. Al het andere in de functie — de poort, de
-- creditnota's, de tolerantie, de transitietabel — is ongewijzigd.
-- Draai je 0012 ooit opnieuw, draai dan daarna ook dit bestand opnieuw.
-- ------------------------------------------------------------
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
  -- WIE MAG HERREKENEN — zie 0012, fixronde bevinding 7b: de triggers
  -- (pg_trigger_depth() > 0), een achtergrondaanroep zonder ingelogde
  -- gebruiker, of een ingelogde beheerder. Een ingelogde klant valt
  -- buiten alle drie.
  if pg_trigger_depth() = 0 and auth.uid() is not null and not is_staff() then
    raise exception 'Alleen beheer mag het saldo van een factuur herberekenen.';
  end if;

  -- total_incl_cents is de kolom van fase 1 en staat op 0 bij een factuur
  -- uit golf 1; die draagt zijn bedrag nog in total_cents.
  select case when coalesce(total_incl_cents, 0) <> 0
              then total_incl_cents
              else coalesce(total_cents, 0) end,
         status_code, due_date, coalesce(invoice_number, '')
    into v_total, v_status, v_due, v_number
    from invoices where id = p_invoice;
  if not found then return; end if;

  -- betalingen: de negatieve tegenboekingen tellen vanzelf mee.
  -- 0021: een klantmelding die de staf nog niet heeft bevestigd NIET —
  -- dat is het enige verschil met 0012.
  select coalesce(sum(amount_cents), 0) into v_paid
    from invoice_payments
   where invoice_id = p_invoice
     and not (reported_by_client and verified_at is null);

  -- creditnota's: alleen de DEFINITIEVE tellen (invoice_credited_cents, 0012)
  v_credited := invoice_credited_cents(p_invoice);

  v_tol := invoice_tolerance_cents();
  v_out := v_total - v_paid - v_credited;

  -- de statusafleiding is exact dezelfde als in portal/invoice-payments.js
  v_new := v_status;
  if v_status not in ('draft','scheduled','cancelled','credited') then
    if v_credited >= v_total and v_total > 0 and v_paid = 0 then
      v_new := 'credited';
    elsif v_out <= greatest(v_tol, 0) then
      v_new := 'paid';
    elsif v_paid > 0 then
      v_new := 'partially_paid';
    elsif v_status in ('paid','partially_paid') then
      -- er is teruggeboekt: dezelfde weg terug als in invoice-payments.js
      v_new := case when v_due is not null and v_due < current_date
                    then 'overdue' else 'sent' end;
    elsif v_due is not null and v_due < current_date
          and v_status in ('finalized','sent','viewed') then
      v_new := 'overdue';
    end if;
  end if;

  -- DE TRANSITIETABEL HEEFT HET LAATSTE WOORD (0012, bevinding 7a).
  -- Weigert de tabel, dan blijft de status staan en worden alleen de
  -- bedragen bijgewerkt; de notice legt vast wat er is geweigerd.
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
         -- de oude vlag uit golf 1 blijft meelopen; 'void' wordt hier
         -- bewust nooit gezet (annuleren is een aparte handeling met reden)
         status = case
                    when v_new = 'paid' then 'paid'
                    when status = 'paid' and v_new <> 'paid' then 'open'
                    else status
                  end,
         updated_at = now()
   where id = p_invoice;
end $$;

-- Zelfde rechten als in 0012: authenticated HOUDT execute (het beheer logt
-- daar in), de poort in de functie houdt de klant tegen; anon expliciet
-- ingetrokken omdat 'revoke from public' de rolgebonden grant van Supabase
-- niet raakt.
revoke all on function recalc_invoice_settlement(uuid) from public;
revoke all on function recalc_invoice_settlement(uuid) from anon;
grant execute on function recalc_invoice_settlement(uuid) to authenticated, service_role;

comment on function recalc_invoice_settlement(uuid) is
  'Telt betalingen en definitieve creditnota''s op en zet paid_cents, credited_cents, outstanding_cents en status_code (0012). Sinds 0021: een door de klant gemelde betaling (reported_by_client) telt pas mee zodra verified_at gevuld is. Draai 0021 opnieuw na een herdraai van 0012.';


-- ------------------------------------------------------------
-- 8. DE SERVERFUNCTIES — het actiecontract van het portaal
-- Elke functie: security definer, set search_path = public, en in deze
-- vaste volgorde:
--   (1) WIE   — een ingelogde klant die de rij bezit. "Niet gevonden" en
--               "niet van jou" geven bewust DEZELFDE code, zodat een
--               geraden id niets verraadt over het bestaan van een rij.
--   (2) STAND — de rij staat in de wachtstand waar deze actie bij hoort.
--   (3) INVOER — geldig, begrensd, niet absurd.
--   (4) SCHRIJVEN — de rij, en via portaal_log() de activiteit- en
--               auditregel. Alles in één transactie: een geweigerde
--               logregel laat ook de actie terugdraaien.
-- De rij wordt met `for update` vergrendeld zodra hij gelezen is, zodat
-- twee klikken tegelijk nooit twee keer dezelfde actie uitvoeren.
-- Teruggegeven wordt de BIJGEWERKTE RIJ als jsonb (snake_case; de
-- datalaag vertaalt naar camelCase), zonder interne velden.
-- Execute uitsluitend voor authenticated (en service_role); anon krijgt
-- permission denied, en dat is de bedoeling.
-- ------------------------------------------------------------

-- ---- 8.1 approve_stage: akkoord op een fase ----
-- Spiegel van "fase op wacht op akkoord" in het beheer. Na akkoord staat
-- de fase op done met approved_at/approved_by/approved_via — exact wat
-- DS.setStageStatus(...,'done') in het beheer ook zet, plus wie en hoe.
-- De volgende fase wordt NIET automatisch actief en de conceptfactuur
-- wordt NIET automatisch gepubliceerd: dat zijn beslissingen van de staf,
-- precies zoals wanneer de eigenaar zelf een fase op done zet.
create or replace function approve_stage(p_stage_id uuid, p_name text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_stage project_stages%rowtype;
  v_name  text;
begin
  -- (1) wie
  if auth.uid() is null then raise exception 'niet_ingelogd'; end if;
  select * into v_stage from project_stages where id = p_stage_id for update;
  if not found or not owns_project(v_stage.project_id) then
    raise exception 'fase_niet_gevonden';
  end if;
  -- (2) wachtstand
  if v_stage.status <> 'awaiting_approval' then
    raise exception 'fase_niet_in_wachtstand' using detail = 'status: ' || v_stage.status;
  end if;
  -- (3) invoer
  v_name := left(btrim(coalesce(p_name, '')), 120);
  if v_name = '' then raise exception 'naam_ontbreekt'; end if;
  -- (4) schrijven
  update project_stages
     set status = 'done',
         approved_at = now(),
         approved_by = v_name,
         approved_via = 'portaal'
   where id = v_stage.id
   returning * into v_stage;
  perform portaal_log(
    v_stage.project_id, 'client', 'approve', 'stage', v_stage.id,
    'Fase goedgekeurd door ' || v_name || ': ' || stage_label_nl(v_stage.stage_key)
  );
  return to_jsonb(v_stage);
end $$;
revoke all on function approve_stage(uuid, text) from public;
revoke all on function approve_stage(uuid, text) from anon;
grant execute on function approve_stage(uuid, text) to authenticated, service_role;
comment on function approve_stage(uuid, text) is
  'Klant geeft akkoord op een fase die op awaiting_approval staat: status → done, approved_at/approved_by/approved_via gezet, activiteit- en auditregel geschreven. Codes: niet_ingelogd, fase_niet_gevonden, fase_niet_in_wachtstand, naam_ontbreekt.';


-- ---- 8.2 decide_sample: de sampleronde beoordelen ----
-- Spiegel van "sampleronde op beoordeeld, wacht op klant". Bij
-- 'goedgekeurd' gaat de ronde op approved en worden eerdere goedgekeurde
-- rondes van hetzelfde project superseded — dezelfde regel als
-- DS.updateSample in beheer.html (één goedgekeurde ronde per project). Bij
-- 'aanpassing' blijft status 'reviewed' staan en wordt alleen de
-- klantbeslissing vastgelegd; de staf maakt daarna een nieuwe ronde met
-- deze feedback als startpunt. Een tweede beslissing op dezelfde ronde
-- wordt geweigerd: een beslissing is een beslissing.
create or replace function decide_sample(p_round_id uuid, p_decision text, p_note text, p_marks jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_round sample_rounds%rowtype;
  v_note  text;
  v_marks jsonb;
begin
  -- (1) wie
  if auth.uid() is null then raise exception 'niet_ingelogd'; end if;
  select * into v_round from sample_rounds where id = p_round_id for update;
  if not found or not owns_project(v_round.project_id) then
    raise exception 'sample_niet_gevonden';
  end if;
  -- (2) wachtstand: beoordeeld door de staf, nog geen klantbeslissing
  if v_round.status <> 'reviewed' then
    raise exception 'sample_niet_in_wachtstand' using detail = 'status: ' || v_round.status;
  end if;
  if v_round.client_decision is not null then
    raise exception 'sample_al_beoordeeld';
  end if;
  -- (3) invoer
  if p_decision is null or p_decision not in ('goedgekeurd','aanpassing') then
    raise exception 'beslissing_ongeldig';
  end if;
  v_note  := left(btrim(coalesce(p_note, '')), 2000);
  v_marks := coalesce(p_marks, '[]'::jsonb);
  if jsonb_typeof(v_marks) <> 'array' or jsonb_array_length(v_marks) > 50 then
    raise exception 'markeringen_ongeldig';
  end if;
  if exists (select 1 from jsonb_array_elements(v_marks) e where jsonb_typeof(e) <> 'object') then
    raise exception 'markeringen_ongeldig';
  end if;
  if p_decision = 'aanpassing' and v_note = '' and jsonb_array_length(v_marks) = 0 then
    raise exception 'opmerking_ontbreekt';
  end if;
  -- (4) schrijven
  if p_decision = 'goedgekeurd' then
    update sample_rounds
       set status = 'superseded'
     where project_id = v_round.project_id
       and status = 'approved'
       and id <> v_round.id;
    update sample_rounds
       set status = 'approved',
           client_decision = 'goedgekeurd',
           client_note = v_note,
           client_decided_at = now(),
           client_marks = v_marks
     where id = v_round.id
     returning * into v_round;
    perform portaal_log(
      v_round.project_id, 'client', 'decide', 'sample', v_round.id,
      'Sample ' || v_round.round_label || ' goedgekeurd door klant'
        || case when v_note <> '' then ' — ' || left(v_note, 300) else '' end
    );
  else
    update sample_rounds
       set client_decision = 'aanpassing',
           client_note = v_note,
           client_decided_at = now(),
           client_marks = v_marks
     where id = v_round.id
     returning * into v_round;
    perform portaal_log(
      v_round.project_id, 'client', 'decide', 'sample', v_round.id,
      'Sample ' || v_round.round_label || ': aanpassing gevraagd door klant'
        || case when v_note <> '' then ' — ' || left(v_note, 300) else '' end
        || case when jsonb_array_length(v_marks) > 0
                then ' (' || jsonb_array_length(v_marks) || ' aanwijzing(en) op de foto)' else '' end
    );
  end if;
  return to_jsonb(v_round);
end $$;
revoke all on function decide_sample(uuid, text, text, jsonb) from public;
revoke all on function decide_sample(uuid, text, text, jsonb) from anon;
grant execute on function decide_sample(uuid, text, text, jsonb) to authenticated, service_role;
comment on function decide_sample(uuid, text, text, jsonb) is
  'Klant beoordeelt een sampleronde die op reviewed staat en nog geen klantbeslissing heeft. goedgekeurd → status approved (eerdere goedkeuringen superseded); aanpassing → alleen de klantvelden, status blijft reviewed. Codes: niet_ingelogd, sample_niet_gevonden, sample_niet_in_wachtstand, sample_al_beoordeeld, beslissing_ongeldig, markeringen_ongeldig, opmerking_ontbreekt.';


-- ---- 8.3 report_payment: een betaling melden ----
-- Spiegel van "factuur gepubliceerd, herinneringen". Het resultaat is een
-- rij in invoice_payments met reported_by_client = true en verified_at
-- NULL: een VOORSTEL, geen boeking. De factuur zelf verandert niet — het
-- saldo telt de melding pas mee na bevestiging (blok 7). Het beheer ziet
-- de melding als Inbox-item "betaling gemeld — controleren" en bevestigt
-- met verify_payment_report() hieronder.
-- Alleen safe velden van de betaling gaan terug naar de klant; de tabel
-- zelf is sinds 0012 staff-only en dat blijft zo.
create or replace function payment_report_json(p invoice_payments) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'id', p.id,
    'invoice_id', p.invoice_id,
    'paid_on', p.paid_on,
    'amount_cents', p.amount_cents,
    'currency', p.currency,
    'client_reference', p.client_reference,
    'reported_by_client', p.reported_by_client,
    'verified_at', p.verified_at,
    'created_at', p.created_at
  );
$$;
revoke all on function payment_report_json(invoice_payments) from public;
revoke all on function payment_report_json(invoice_payments) from anon;
revoke all on function payment_report_json(invoice_payments) from authenticated;
grant execute on function payment_report_json(invoice_payments) to service_role;
comment on function payment_report_json(invoice_payments) is
  'De klantzichtbare projectie van een invoice_payments-rij: nooit internal_note, transaction_ref, proof_* of reversal_reason. Intern gebruikt door report_payment() en client_payment_reports().';

create or replace function report_payment(p_invoice_id uuid, p_cents bigint, p_date date, p_reference text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_inv    invoices%rowtype;
  v_client clients%rowtype;
  v_pay    invoice_payments%rowtype;
  v_ref    text;
begin
  -- (1) wie: owns_invoice() eist bovendien dat de factuur gepubliceerd en
  -- niet meer draft/scheduled is (0008)
  if auth.uid() is null then raise exception 'niet_ingelogd'; end if;
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found or not owns_invoice(p_invoice_id) then
    raise exception 'factuur_niet_gevonden';
  end if;
  select * into v_client from clients where auth_user_id = auth.uid();
  -- (2) wachtstand: een echte factuur (geen creditnota) die nog open staat
  if v_inv.doc_kind <> 'invoice' then raise exception 'geen_factuur'; end if;
  if v_inv.status = 'paid'
     or v_inv.status_code not in ('finalized','sent','viewed','partially_paid','overdue','disputed') then
    raise exception 'factuur_niet_open' using detail = 'status: ' || v_inv.status_code;
  end if;
  -- (3) invoer: hele centen boven nul, een datum die niet in de toekomst
  -- ligt (één dag speling voor tijdzones) en niet absurd oud is
  if p_cents is null or p_cents <= 0 then raise exception 'bedrag_ongeldig'; end if;
  if p_date is null then raise exception 'datum_ontbreekt'; end if;
  if p_date > current_date + 1 then raise exception 'datum_in_toekomst'; end if;
  if p_date < date '2000-01-01' then raise exception 'datum_ongeldig'; end if;
  v_ref := left(btrim(coalesce(p_reference, '')), 140);
  -- dubbelklik: precies dezelfde onbevestigde melding staat er al
  if exists (
    select 1 from invoice_payments x
     where x.invoice_id = v_inv.id
       and x.reported_by_client and x.verified_at is null
       and x.amount_cents = p_cents and x.paid_on = p_date
  ) then
    raise exception 'betaling_al_gemeld';
  end if;
  -- (4) schrijven: de trigger invoice_payments_recalc_trg vuurt, maar
  -- recalc (blok 7) telt deze onbevestigde rij niet mee. De twee logregels
  -- staan in de demovorm (portaal_geld_nl/portaal_datum_nl), woordelijk
  -- zoals betalingMelden() in portaal-data.js ze schrijft.
  insert into invoice_payments
    (invoice_id, paid_on, amount_cents, currency, method, transaction_ref,
     reported_by_client, client_reference, created_by)
  values
    (v_inv.id, p_date, p_cents, v_inv.currency, 'overboeking', '',
     true, v_ref, 'klant:' || coalesce(v_client.email, ''))
  returning * into v_pay;
  insert into invoice_audit (invoice_id, event, from_status, to_status, detail, actor)
  values (v_inv.id, 'betaling_gemeld', v_inv.status_code, v_inv.status_code,
          'Klant meldt betaling van ' || portaal_geld_nl(p_cents, v_inv.currency)
            || ' op ' || portaal_datum_nl(p_date)
            || case when v_ref <> '' then ', kenmerk ' || v_ref else '' end,
          coalesce(v_client.email, ''));
  perform portaal_log(
    v_inv.project_id, 'client', 'report_payment', 'invoice', v_inv.id,
    'Betaling gemeld op factuur ' || coalesce(nullif(v_inv.invoice_number, ''), v_inv.label)
      || ': ' || portaal_geld_nl(p_cents, v_inv.currency) || ' op ' || portaal_datum_nl(p_date)
      || case when v_ref <> '' then ', kenmerk ' || v_ref else '' end
  );
  select * into v_inv from invoices where id = v_inv.id;
  return (to_jsonb(v_inv) - 'internal_note')
         || jsonb_build_object('gemelde_betaling', payment_report_json(v_pay));
end $$;
revoke all on function report_payment(uuid, bigint, date, text) from public;
revoke all on function report_payment(uuid, bigint, date, text) from anon;
grant execute on function report_payment(uuid, bigint, date, text) to authenticated, service_role;
comment on function report_payment(uuid, bigint, date, text) is
  'Klant meldt een betaling op een open, gepubliceerde factuur: rij in invoice_payments met reported_by_client = true, nog niet bevestigd en dus nog niet in het saldo. Geeft de factuurrij (zonder internal_note) plus gemelde_betaling terug. Codes: niet_ingelogd, factuur_niet_gevonden, geen_factuur, factuur_niet_open, bedrag_ongeldig, datum_ontbreekt, datum_in_toekomst, datum_ongeldig, betaling_al_gemeld.';

-- De klant kan invoice_payments niet lezen (0012) maar moet wél zien wat
-- hij zelf meldde: "gemeld op …, wordt gecontroleerd" of "bevestigd". Deze
-- leesfunctie geeft uitsluitend de klantmeldingen op de eigen factuur, in
-- de smalle projectie van payment_report_json().
create or replace function client_payment_reports(p_invoice_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'niet_ingelogd'; end if;
  if not owns_invoice(p_invoice_id) then raise exception 'factuur_niet_gevonden'; end if;
  return coalesce((
    select jsonb_agg(payment_report_json(p) order by p.created_at)
      from invoice_payments p
     where p.invoice_id = p_invoice_id
       and p.reported_by_client
  ), '[]'::jsonb);
end $$;
revoke all on function client_payment_reports(uuid) from public;
revoke all on function client_payment_reports(uuid) from anon;
grant execute on function client_payment_reports(uuid) to authenticated, service_role;
comment on function client_payment_reports(uuid) is
  'De door de klant gemelde betalingen op zijn eigen factuur (bevestigd én onbevestigd), zonder interne velden. Codes: niet_ingelogd, factuur_niet_gevonden.';

-- DE TEGENHANGER VOOR HET BEHEER: een melding bevestigen. Bevestigen is
-- verified_at zetten op DEZELFDE rij (met eventueel een gecorrigeerd
-- bedrag, het bankkenmerk en de methode) — NIET een tweede betaling boeken
-- naast de melding, want dan telt het bedrag twee keer zodra ook de
-- melding ooit bevestigd wordt. Klopt de melding niet (er is niets
-- binnengekomen), dan verwijdert de staf de rij; daar heeft hij delete
-- voor. Alleen staf: de poort zit in de functie, want authenticated moet
-- execute houden (het beheer logt daar in — zelfde redenering als
-- recalc_invoice_settlement in 0012).
create or replace function verify_payment_report(
  p_payment_id uuid,
  p_cents bigint default null,
  p_reference text default null,
  p_method text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pay invoice_payments%rowtype;
begin
  if not is_staff() then raise exception 'alleen_beheer'; end if;
  select * into v_pay from invoice_payments where id = p_payment_id for update;
  if not found or not v_pay.reported_by_client then raise exception 'melding_niet_gevonden'; end if;
  if v_pay.verified_at is not null then raise exception 'melding_al_bevestigd'; end if;
  if p_cents is not null and p_cents <= 0 then raise exception 'bedrag_ongeldig'; end if;
  update invoice_payments
     set verified_at = now(),
         amount_cents = coalesce(p_cents, amount_cents),
         transaction_ref = coalesce(nullif(btrim(p_reference), ''), client_reference),
         method = coalesce(nullif(btrim(p_method), ''), method)
   where id = v_pay.id
   returning * into v_pay;
  -- de trigger invoice_payments_recalc_trg heeft de factuur nu herrekend
  insert into invoice_audit (invoice_id, event, detail, actor)
  values (v_pay.invoice_id, 'betaling_bevestigd',
          'Gemelde betaling bevestigd: ' || v_pay.amount_cents || ' centen ' || v_pay.currency
            || ' op ' || to_char(v_pay.paid_on, 'DD-MM-YYYY'),
          coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', 'beheer'));
  return to_jsonb(v_pay);
end $$;
revoke all on function verify_payment_report(uuid, bigint, text, text) from public;
revoke all on function verify_payment_report(uuid, bigint, text, text) from anon;
grant execute on function verify_payment_report(uuid, bigint, text, text) to authenticated, service_role;
comment on function verify_payment_report(uuid, bigint, text, text) is
  'BEHEER: bevestigt een klantmelding (verified_at = now(), optioneel bedrag/kenmerk/methode gecorrigeerd) op dezelfde rij; de bestaande trigger herrekent daarna het saldo. Nooit een tweede rij boeken naast een melding. Codes: alleen_beheer, melding_niet_gevonden, melding_al_bevestigd, bedrag_ongeldig.';


-- ---- 8.4 dispute_invoice: bezwaar maken ----
-- Spiegel van "vraag over deze factuur → bezwaar". status_code gaat naar
-- disputed langs de transitietabel (0012) en de herinneringstrap gaat op
-- pauze — precies wat spec §1 regel 3 vraagt. De REDEN staat op drie
-- plekken, elk met een eigen lezer: invoice_audit (het factuurlogboek van
-- de staf), admin_audit_log (de beheer-Inbox "Bezwaar op factuur") en
-- access_log (de klant leest zijn eigen bezwaar terug in zijn tijdlijn;
-- de andere twee kan hij niet lezen). Bewust geen nieuwe kolom op
-- invoices: hoofdstuk 3 voegt daar niets aan toe.
create or replace function dispute_invoice(p_invoice_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_inv    invoices%rowtype;
  v_client clients%rowtype;
  v_reason text;
  v_from   text;
begin
  -- (1) wie
  if auth.uid() is null then raise exception 'niet_ingelogd'; end if;
  select * into v_inv from invoices where id = p_invoice_id for update;
  if not found or not owns_invoice(p_invoice_id) then
    raise exception 'factuur_niet_gevonden';
  end if;
  select * into v_client from clients where auth_user_id = auth.uid();
  -- (2) wachtstand: een factuur, nog niet betwist, niet betaald of gesloten
  if v_inv.doc_kind <> 'invoice' then raise exception 'geen_factuur'; end if;
  if v_inv.status_code = 'disputed' then raise exception 'factuur_al_betwist'; end if;
  if v_inv.status = 'paid' or v_inv.status_code = 'paid' then raise exception 'factuur_al_betaald'; end if;
  if v_inv.status_code not in ('finalized','sent','viewed','partially_paid','overdue') then
    raise exception 'factuur_niet_open' using detail = 'status: ' || v_inv.status_code;
  end if;
  -- (3) invoer
  v_reason := left(btrim(coalesce(p_reason, '')), 2000);
  if v_reason = '' then raise exception 'reden_ontbreekt'; end if;
  -- de transitietabel uit 0012 heeft het laatste woord, ook hier
  if not invoice_can_transition(v_inv.status_code, 'disputed', v_inv.paid_cents,
                                coalesce(v_inv.invoice_number, '') <> '') then
    raise exception 'overgang_niet_toegestaan' using detail = 'van: ' || v_inv.status_code;
  end if;
  -- (4) schrijven
  v_from := v_inv.status_code;
  update invoices
     set status_code = 'disputed',
         reminder_paused = true,
         updated_at = now()
   where id = v_inv.id
   returning * into v_inv;
  insert into invoice_audit (invoice_id, event, from_status, to_status, detail, actor)
  values (v_inv.id, 'bezwaar_klant', v_from, 'disputed', v_reason, coalesce(v_client.email, ''));
  perform portaal_log(
    v_inv.project_id, 'client', 'dispute', 'invoice', v_inv.id,
    'Bezwaar op factuur ' || coalesce(nullif(v_inv.invoice_number, ''), v_inv.label) || ': ' || v_reason
  );
  return to_jsonb(v_inv) - 'internal_note';
end $$;
revoke all on function dispute_invoice(uuid, text) from public;
revoke all on function dispute_invoice(uuid, text) from anon;
grant execute on function dispute_invoice(uuid, text) to authenticated, service_role;
comment on function dispute_invoice(uuid, text) is
  'Klant maakt bezwaar op een open, niet betaalde factuur: status_code → disputed (langs invoice_can_transition), herinneringen gepauzeerd, reden in invoice_audit + beide logboeken. Geeft de factuurrij zonder internal_note terug. Codes: niet_ingelogd, factuur_niet_gevonden, geen_factuur, factuur_al_betwist, factuur_al_betaald, factuur_niet_open, reden_ontbreekt, overgang_niet_toegestaan.';


-- ---- 8.5 request_reorder: herbestellen ----
-- Spiegel van de vierstapspijplijn. De rij landt op stap 1 ('aanvraag');
-- de guard-trigger weigert een tweede onaangeraakte aanvraag op hetzelfde
-- project en de log-trigger schrijft de logregels — beide vuren ook bij
-- deze insert, dus de RPC hoeft ze niet te herhalen.
create or replace function request_reorder(
  p_project_id uuid,
  p_qty integer,
  p_wanted_by date,
  p_same_spec boolean,
  p_note text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_client uuid;
  v_row    reorder_requests%rowtype;
  v_same   boolean;
  v_note   text;
begin
  -- (1) wie
  if auth.uid() is null then raise exception 'niet_ingelogd'; end if;
  v_client := my_client_id();
  if v_client is null or not owns_project(p_project_id) then
    raise exception 'project_niet_gevonden';
  end if;
  -- (2) wachtstand: het product is afgerond of gearchiveerd
  if not project_herbestelbaar(p_project_id) then
    raise exception 'project_niet_afgerond';
  end if;
  -- (3) invoer
  if p_qty is null or p_qty <= 0 then raise exception 'aantal_ongeldig'; end if;
  if p_qty > 10000000 then raise exception 'aantal_ongeldig' using detail = 'meer dan tien miljoen stuks'; end if;
  if p_wanted_by is not null and p_wanted_by < current_date then raise exception 'datum_in_verleden'; end if;
  if p_wanted_by is not null and p_wanted_by > current_date + 1095 then raise exception 'datum_te_ver'; end if;
  v_same := coalesce(p_same_spec, true);
  v_note := left(btrim(coalesce(p_note, '')), 2000);
  if not v_same and v_note = '' then raise exception 'wijziging_ontbreekt'; end if;
  -- (4) schrijven; de triggers doen de dubbelcheck en de logregels
  insert into reorder_requests (project_id, client_id, qty, wanted_by, same_spec, change_note, status)
  values (p_project_id, v_client, p_qty, p_wanted_by, v_same, v_note, 'aanvraag')
  returning * into v_row;
  return to_jsonb(v_row);
end $$;
revoke all on function request_reorder(uuid, integer, date, boolean, text) from public;
revoke all on function request_reorder(uuid, integer, date, boolean, text) from anon;
grant execute on function request_reorder(uuid, integer, date, boolean, text) to authenticated, service_role;
comment on function request_reorder(uuid, integer, date, boolean, text) is
  'Klant vraagt een herbestelling aan op een afgerond of gearchiveerd eigen project: rij in reorder_requests op stap aanvraag. Codes: niet_ingelogd, project_niet_gevonden, project_niet_afgerond, aantal_ongeldig, datum_in_verleden, datum_te_ver, wijziging_ontbreekt, herbestelling_loopt_al (uit de guard-trigger).';


-- ------------------------------------------------------------
-- 9. STORAGE — bucket klant-upload
-- 0001 en 0012 laten de buckets in het dashboard aanmaken en zetten de
-- policytekst in commentaar. Hier probeert de migratie het ZELF, in drie
-- bewaakte blokken: lukt een blok niet (geen storage-schema, geen recht
-- op storage.objects), dan zegt een notice precies wat je in het dashboard
-- moet doen, en de rest van de migratie gaat gewoon door. Zo is dit
-- bestand ook op een omgeving zonder Supabase-storage twee keer draaibaar.
--
-- Regels van de bucket, gespiegeld aan project-docs (0001) maar dan
-- omgedraaid: hier mag de KLANT schrijven en de staf alleen lezen/opruimen.
--   insert  → staf, of de klant in de map van zijn eigen project
--             ({project_id}/…; klant_upload_project_id haalt dat id uit
--             het pad, owns_project toetst het)
--   select  → staf, of de eigen klant (signed URLs, 900 s zoals overal)
--   update  → alleen staf: een klant kan zijn eigen upload dus nooit
--             overschrijven — een nieuwe versie is een nieuw bestand
--   delete  → alleen staf
-- Privé, nooit public. Het beheer leest deze bucket met dezelfde
-- createSignedUrl-plumbing als project-docs; alleen de bucketnaam is
-- anders, en uploaded_by = 'klant' op de documents-rij zegt welke.
-- ------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('klant-upload', 'klant-upload', false)
  on conflict (id) do nothing;
  raise notice '0021: bucket klant-upload staat (privé).';
exception when others then
  raise notice '0021: bucket klant-upload NIET automatisch aangemaakt (%). Maak hem in het dashboard: Storage → New bucket → naam klant-upload, PRIVATE.', sqlerrm;
end $$;

do $$
begin
  drop policy if exists "klant-upload insert eigen project" on storage.objects;
  create policy "klant-upload insert eigen project" on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'klant-upload'
      and (is_staff() or owns_project(klant_upload_project_id(name)))
    );

  drop policy if exists "klant-upload lezen staf of eigen klant" on storage.objects;
  create policy "klant-upload lezen staf of eigen klant" on storage.objects
    for select to authenticated
    using (
      bucket_id = 'klant-upload'
      and (is_staff() or owns_project(klant_upload_project_id(name)))
    );

  drop policy if exists "klant-upload wijzigen alleen staf" on storage.objects;
  create policy "klant-upload wijzigen alleen staf" on storage.objects
    for update to authenticated
    using (bucket_id = 'klant-upload' and is_staff())
    with check (bucket_id = 'klant-upload' and is_staff());

  drop policy if exists "klant-upload verwijderen alleen staf" on storage.objects;
  create policy "klant-upload verwijderen alleen staf" on storage.objects
    for delete to authenticated
    using (bucket_id = 'klant-upload' and is_staff());

  raise notice '0021: de vier storage-policies van klant-upload staan.';
exception when others then
  raise notice '0021: storage-policies NIET automatisch gezet (%). Zet ze in het dashboard (Storage → Policies → klant-upload, target authenticated): insert: bucket_id = ''klant-upload'' and (is_staff() or owns_project(klant_upload_project_id(name))); select: idem; update en delete: bucket_id = ''klant-upload'' and is_staff().', sqlerrm;
end $$;

-- Een bovengrens per bestand als vangnet tegen een klant die per ongeluk
-- gigabytes in de opslag van de eigenaar zet: 25 MB. Dat is een grens en
-- geen meting; in het dashboard bij te stellen. Alleen gezet als de kolom
-- bestaat en er nog geen grens staat — een eigen instelling wint altijd.
do $$
begin
  update storage.buckets
     set file_size_limit = 26214400
   where id = 'klant-upload' and file_size_limit is null;
exception when others then
  raise notice '0021: bestandsgrens van klant-upload niet gezet (%). Stel hem desgewenst in het dashboard in.', sqlerrm;
end $$;


-- ------------------------------------------------------------
-- 10. WAT DEZE MIGRATIE BEWUST NIET DOET
--   · Geen demo-equivalenten: die maakt de datalaag (CP_PORTAAL_DATA) in
--     de browser, met dezelfde foutcodes.
--   · Geen automatische vervolgstappen na een klantactie: de volgende fase
--     activeren, de conceptfactuur publiceren, een nieuwe sampleronde
--     aanmaken, de herbestelling doorschuiven — dat blijven beslissingen
--     van de staf, in het beheer. Het portaal legt vast, het beheer
--     handelt af.
--   · Geen mail. De bestaande notify-client-functie stuurt de mails; de
--     beheerkant (spec §2, fase 7) hangt de nieuwe Inbox-typen eraan.
--   · Geen kolom voor de bezwaarreden op invoices en geen invoice_id op
--     question_threads: de reden leeft in de drie logboeken (blok 8.4).
--   · Geen online betalen: "betaling melden" is de eerlijke tussenstap tot
--     er een provider hangt (spec §6).
--   · Geen wijziging aan de klant-insertpolicy op question_messages (0020)
--     of question_threads (0001): die kloppen en blijven van hun eigenaar.
--
-- DE FOUTCODES (raise exception → message; de browser vertaalt via i18nT)
--   algemeen        niet_ingelogd, alleen_beheer
--   approve_stage   fase_niet_gevonden, fase_niet_in_wachtstand, naam_ontbreekt
--   decide_sample   sample_niet_gevonden, sample_niet_in_wachtstand,
--                   sample_al_beoordeeld, beslissing_ongeldig,
--                   markeringen_ongeldig, opmerking_ontbreekt
--   report_payment  factuur_niet_gevonden, geen_factuur, factuur_niet_open,
--                   bedrag_ongeldig, datum_ontbreekt, datum_in_toekomst,
--                   datum_ongeldig, betaling_al_gemeld
--   dispute_invoice factuur_niet_gevonden, geen_factuur, factuur_al_betwist,
--                   factuur_al_betaald, factuur_niet_open, reden_ontbreekt,
--                   overgang_niet_toegestaan
--   request_reorder project_niet_gevonden, project_niet_afgerond,
--                   aantal_ongeldig, datum_in_verleden, datum_te_ver,
--                   wijziging_ontbreekt, herbestelling_loopt_al
--   documents       slot_al_gevuld (trigger; een geweigerde policy geeft
--                   de gewone RLS-fout van PostgREST). De datalaag leest
--                   het slot eerst en geeft bij expected_from <> 'klant'
--                   zelf slot_niet_van_klant (geen raise hier)
--   clients         alleen_voorkeuren_wijzigbaar, taal_onbekend,
--                   voorkeuren_ongeldig
--   verify_payment_report  melding_niet_gevonden, melding_al_bevestigd,
--                   bedrag_ongeldig
-- ------------------------------------------------------------
