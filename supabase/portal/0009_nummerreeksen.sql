-- ============================================================
-- CUSTOM+ — NUMMERREEKSEN AANZETTEN + DE VERGRENDELING NA DEFINITIEF MAKEN
-- Draai dit ná 0008_invoices.sql.
--
-- HER-UITVOERBAAR: elke create is if-not-exists of create-or-replace, elke
-- policy heeft een drop-policy ervóór, elke trigger wordt eerst gedropt.
-- Je kunt dit bestand dus zo vaak draaien als je wilt.
--
-- WAT DIT BESTAND DOET
--   1. de standaardreeksen zetten (facturen + creditnota's)
--   2. claim_series_number(): de atomaire uitgifte, nu PER REEKS
--   3. elke uitgifte, overslaan en annulering vastleggen in number_audit
--   4. de vergrendeling van stap 8 uit de spec ook in de database:
--      een factuur mét snapshot is definitief en kan niet meer financieel
--      wijzigen of verwijderd worden — ook niet door een script, een
--      tweede beheertab of een toekomstige koppeling.
--
-- FIXRONDE (bevinding 6) — ÉÉN UITGIFTE, ÉÉN SLOT, ÉÉN AUDITSPOOR
--   claim_invoice_number() uit 0005_admin.sql wordt nog steeds NIET
--   verwijderd — het snelle factuurvenster van golf 1 en de
--   conceptfactuur-automaat roepen hem nog aan. Maar hij geeft sinds deze
--   fixronde ZELF geen nummers meer uit: stap 3b hieronder vervangt zijn
--   inhoud door een doorgeefluik naar claim_series_number().
--
--   Waarom dat moest: de oude functie zette 'for update' op de
--   admin_settings-rij 'factuur_reeks', de nieuwe op de number_series-rij.
--   Twee verschillende sloten op ÉÉN nummerruimte serialiseren alleen tegen
--   zichzelf en nooit tegen elkaar — twee gelijktijdige acties konden dus
--   hetzelfde nummer krijgen, precies de bug die golf 1 al eens heeft
--   opgelost. Bovendien schreef de oude uitgifte geen number_audit-regel,
--   zodat een gat in de reeks langs die weg onverklaard bleef.
--
--   Na deze fixronde bestaat er nog één slot (de reeksrij) en één
--   auditspoor (number_audit). Bestaande aanroepers merken niets: het
--   doorgeefluik geeft exact dezelfde vier sleutels terug als vroeger
--   ({text, prefix, jaar, volgende}).
--
--   HET LAATSTE VANGNET blijft staan en is nagelopen:
--     · invoices_admin_number_uniq (0008) — uniek op
--       (administration, invoice_number) waar invoice_number <> ''.
--       invoices.administration is 'not null default CP', dus er zijn geen
--       null-waarden die een unieke index stil laten passeren.
--     · invoices_invoice_number_uniq (0005) — uniek op invoice_number,
--       administratie-overstijgend, als tweede net.
--   Er kan daardoor hoogstens een GAT vallen, nooit een duplicaat.
-- ============================================================


-- ------------------------------------------------------------
-- 1. STANDAARDREEKSEN
-- Twee reeksen, precies zoals portal/invoice-series.js ze kent. De
-- creditreeks krijgt een eigen voorvoegsel zodat een creditnota nooit een
-- factuurnummer kan krijgen. Wie liever één gedeelde reeks wil, zet de
-- creditreeks op active = false: claim_series_number valt dan bewust terug
-- op de factuurreeks.
--
-- current_value neemt de stand van de golf-1-jaarteller over, zodat de
-- reeks niet terugspringt en een al uitgegeven nummer nooit opnieuw valt.
-- ------------------------------------------------------------
insert into number_series
  (administration, kind, label, prefix, suffix, use_year, use_month, separator,
   pad_length, start_value, current_value, current_year, reset_period, active)
select
  'CP', 'invoice', 'Facturen',
  coalesce(nullif((select value->>'prefix' from admin_settings where key = 'factuur_reeks'), ''), 'CP'),
  '', true, false, '-', 4, 1,
  greatest(coalesce((select (value->>'volgende')::int from admin_settings where key = 'factuur_reeks'), 1) - 1, 0),
  coalesce((select (value->>'jaar')::int from admin_settings where key = 'factuur_reeks'),
           extract(year from now())::int),
  'year', true
where not exists (select 1 from number_series where administration = 'CP' and kind = 'invoice');

insert into number_series
  (administration, kind, label, prefix, suffix, use_year, use_month, separator,
   pad_length, start_value, current_value, current_year, reset_period, active)
select
  'CP', 'credit_note', 'Creditnota''s',
  coalesce(nullif((select value->>'prefix' from admin_settings where key = 'factuur_reeks'), ''), 'CP') || 'C',
  '', true, false, '-', 4, 1, 0, extract(year from now())::int, 'year', true
where not exists (select 1 from number_series where administration = 'CP' and kind = 'credit_note');


-- ------------------------------------------------------------
-- 1b. FACTUUR- EN AFLEVERADRES
-- De spec noemt ze bij "Factuur aanmaken — velden"; 0008 had ze nog niet.
-- Ze horen op de FACTUUR en niet op de klantrij: een adres kan tussen twee
-- facturen wijzigen, en een verstuurde factuur moet het adres blijven
-- dragen dat er toen op stond. De klantkaart in dit systeem heeft geen
-- adresveld; de editor vult daarom voor uit de vórige factuur van dezelfde
-- klant, zodat je het één keer typt.
-- ------------------------------------------------------------
alter table invoices add column if not exists billing_address text not null default '';
alter table invoices add column if not exists delivery_address text not null default '';


-- ------------------------------------------------------------
-- 2. HET NUMMER OPMAKEN
-- Exact dezelfde regel als formatNumber() in portal/invoice-series.js:
-- voorvoegsel, jaar, maand, volgnummer, achtervoegsel, samengevoegd met
-- het scheidingsteken; lege onderdelen vallen weg zonder een dubbel
-- scheidingsteken achter te laten.
--
-- LET OP lpad(): dat KAPT AF wanneer de tekst al langer is dan de
-- gevraagde lengte ('12345' met lengte 4 wordt '1234'). Een volgnummer dat
-- door zijn opvulling heen groeit zou daarmee stil een bestaand nummer
-- worden. Vandaar de expliciete lengtecheck.
-- ------------------------------------------------------------
create or replace function series_number_text(
  p_prefix text, p_suffix text, p_use_year boolean, p_use_month boolean,
  p_separator text, p_pad_length integer, p_seq integer,
  p_year integer, p_month integer
) returns text
language plpgsql immutable
as $$
declare
  v_parts text[] := '{}';
  v_seq_text text := p_seq::text;
begin
  if coalesce(p_prefix, '') <> '' then v_parts := v_parts || p_prefix; end if;
  if coalesce(p_use_year, true) then v_parts := v_parts || p_year::text; end if;
  if coalesce(p_use_month, false) then
    v_parts := v_parts || lpad(p_month::text, 2, '0');
  end if;
  if length(v_seq_text) < coalesce(p_pad_length, 4) then
    v_seq_text := lpad(v_seq_text, p_pad_length, '0');
  end if;
  v_parts := v_parts || v_seq_text;
  if coalesce(p_suffix, '') <> '' then v_parts := v_parts || p_suffix; end if;
  return array_to_string(v_parts, coalesce(p_separator, '-'));
end $$;


-- ------------------------------------------------------------
-- 3. DE ATOMAIRE UITGIFTE, PER REEKS
-- Hetzelfde principe als claim_invoice_number() uit golf 1, maar nu op de
-- reeksrij in plaats van op één instellingenrij: 'for update' vergrendelt
-- de rij, een tweede claim staat netjes in de rij te wachten en krijgt dus
-- nooit hetzelfde nummer.
--
-- security definer omdat number_series staff-only is; de is_staff()-check
-- hieronder houdt dat hard en het execute-recht gaat bewust niet naar
-- public of anon.
--
-- Elk overgeslagen nummer (handmatig getypt of geïmporteerd) landt als
-- 'skipped' in number_audit, het uitgegeven nummer als 'issued'. Zo is elk
-- gat in de reeks achteraf te verklaren — dat is precies wat de spec met
-- "auditinformatie over geannuleerde/gecorrigeerde nummers" bedoelt.
-- ------------------------------------------------------------
create or replace function claim_series_number(
  p_administration text default 'CP',
  p_kind text default 'invoice',
  p_date date default current_date,
  p_invoice_id uuid default null,
  p_actor text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    number_series%rowtype;
  v_year   int := extract(year from coalesce(p_date, current_date))::int;
  v_month  int := extract(month from coalesce(p_date, current_date))::int;
  v_seq    int;
  v_text   text;
  v_resets boolean := false;
  v_guard  int := 0;
  v_skipped text[] := '{}';
begin
  if not is_staff() then
    raise exception 'Alleen beheer mag een factuurnummer uitgeven.';
  end if;
  if p_kind not in ('invoice', 'credit_note') then
    raise exception 'Onbekende soort nummerreeks: %', p_kind;
  end if;

  -- de rijvergrendeling is het hele punt: een tweede claim wacht hier
  select * into v_row from number_series
   where administration = p_administration and kind = p_kind and active
   order by created_at
   limit 1
   for update;

  -- geen eigen creditreeks? Dan bewust de factuurreeks delen; een
  -- creditnota zonder nummer is geen optie.
  if not found and p_kind = 'credit_note' then
    select * into v_row from number_series
     where administration = p_administration and kind = 'invoice' and active
     order by created_at
     limit 1
     for update;
  end if;

  if not found then
    raise exception 'Er is geen actieve nummerreeks voor administratie % en soort %.',
      p_administration, p_kind;
  end if;

  -- periodewissel
  if v_row.reset_period = 'year' then
    v_resets := v_row.current_year is not null and v_row.current_year <> v_year;
  elsif v_row.reset_period = 'month' then
    v_resets := (v_row.current_year is not null and v_row.current_year <> v_year)
             or (v_row.current_month is not null and v_row.current_month <> v_month);
  end if;

  if v_resets or v_row.current_value = 0 then
    v_seq := v_row.start_value;
  else
    v_seq := greatest(v_row.current_value + 1, v_row.start_value);
  end if;

  v_text := series_number_text(v_row.prefix, v_row.suffix, v_row.use_year, v_row.use_month,
                               v_row.separator, v_row.pad_length, v_seq, v_year, v_month);

  -- al gebruikte nummers overslaan (handmatig getypt, of uit een import)
  while exists (
    select 1 from invoices
     where invoice_number = v_text
       and coalesce(administration, 'CP') = p_administration
  ) loop
    v_skipped := v_skipped || v_text;
    v_seq := v_seq + 1;
    v_guard := v_guard + 1;
    if v_guard > 100000 then
      raise exception 'Er kon geen vrij nummer worden gevonden in reeks %.', v_row.label;
    end if;
    v_text := series_number_text(v_row.prefix, v_row.suffix, v_row.use_year, v_row.use_month,
                                 v_row.separator, v_row.pad_length, v_seq, v_year, v_month);
  end loop;

  update number_series
     set current_value = v_seq,
         current_year  = v_year,
         current_month = v_month,
         updated_at    = now()
   where id = v_row.id;

  -- DE SPIEGEL admin_settings.factuur_reeks BIJHOUDEN (fixronde, bevinding 6)
  -- Sinds stap 3b is dit de enige uitgifte; claim_invoice_number() schrijft
  -- de oude tellersleutel niet meer zelf. Die sleutel blijft wel bestaan als
  -- AFGELEIDE: het snelle factuurvenster en de nummeringswaakhond lezen hem
  -- nog voor hun voorbeeldnummer. Zou hij hier niet meebewegen, dan liet het
  -- beheer een voorbeeldnummer zien dat allang is uitgegeven.
  --
  -- Alleen bijwerken wanneer de reeks nog in de oude vorm PAST (voorvoegsel,
  -- jaar, vier cijfers, streepje, geen maand, geen achtervoegsel). Past hij
  -- niet, dan blijft de sleutel liever staan dan dat er een half getal in
  -- komt: de reeks zelf is en blijft de bron.
  --
  -- De slotvolgorde is altijd dezelfde — eerst de reeksrij, dan deze rij —
  -- dus er kan geen tweetal transacties ontstaan dat elkaar vasthoudt.
  if v_row.kind = 'invoice'
     and p_administration = 'CP'
     and coalesce(v_row.use_year, true)
     and not coalesce(v_row.use_month, false)
     and coalesce(v_row.suffix, '') = ''
     and coalesce(v_row.separator, '-') = '-'
     and coalesce(v_row.pad_length, 4) = 4 then
    insert into admin_settings (key, value)
    values ('factuur_reeks',
            jsonb_build_object('prefix', coalesce(nullif(v_row.prefix, ''), 'CP'),
                               'jaar', v_year,
                               'volgende', v_seq + 1))
    on conflict (key) do update
      set value = excluded.value,
          updated_at = now();
  end if;

  -- elk overgeslagen nummer verklaren, en daarna de uitgifte zelf
  if array_length(v_skipped, 1) is not null then
    insert into number_audit (series_id, administration, invoice_id, number_text, event, reason, actor)
    select v_row.id, p_administration, null, s, 'skipped',
           'Nummer stond al op een andere factuur en is overgeslagen.',
           coalesce(nullif(p_actor, ''), 'systeem')
      from unnest(v_skipped) as s;
  end if;

  insert into number_audit (series_id, administration, invoice_id, number_text, event, reason, actor)
  values (v_row.id, p_administration, p_invoice_id, v_text, 'issued',
          case when v_resets then 'Uitgegeven bij definitief maken; reeks begon opnieuw door periodewissel.'
               else 'Uitgegeven bij definitief maken.' end,
          coalesce(nullif(p_actor, ''), 'systeem'));

  return jsonb_build_object(
    'text', v_text,
    'seq', v_seq,
    'year', v_year,
    'month', v_month,
    'resets', v_resets,
    'seriesId', v_row.id,
    'seriesLabel', v_row.label,
    'kind', v_row.kind,
    'administration', p_administration,
    'skipped', to_jsonb(v_skipped)
  );
end $$;
revoke all on function claim_series_number(text, text, date, uuid, text) from public;
revoke all on function claim_series_number(text, text, date, uuid, text) from anon;
grant execute on function claim_series_number(text, text, date, uuid, text) to authenticated;
revoke all on function series_number_text(text, text, boolean, boolean, text, integer, integer, integer, integer) from public;
revoke all on function series_number_text(text, text, boolean, boolean, text, integer, integer, integer, integer) from anon;
grant execute on function series_number_text(text, text, boolean, boolean, text, integer, integer, integer, integer) to authenticated;


-- ------------------------------------------------------------
-- 3b. DE OUDE UITGIFTE WORDT EEN DOORGEEFLUIK — FIXRONDE, BEVINDING 6
--
-- claim_invoice_number() komt uit 0005_admin.sql en vergrendelde daar de
-- admin_settings-rij 'factuur_reeks'. claim_series_number() hierboven
-- vergrendelt de number_series-rij. Twee sloten op dezelfde nummerruimte
-- houden elkaar niet tegen: twee gelijktijdige acties konden allebei
-- hetzelfde nummer krijgen. Dat de skip-lus en de unieke index dat meestal
-- opvingen, maakt het niet minder een gat — de index laat de tweede
-- schrijfactie hard klappen op het moment dat de factuur al definitief
-- gemaakt wordt.
--
-- De veiligste weg is deze: de oude functie BLIJFT bestaan met precies
-- dezelfde naam, dezelfde (lege) parameterlijst en dezelfde vier sleutels
-- in het antwoord, maar geeft zelf geen nummers meer uit. Hij roept de
-- nieuwe uitgifte aan. Daarmee bestaat er nog één slot, één teller en één
-- auditspoor, en hoeft er geen enkele aanroeper te worden omgebouwd.
--
-- Let op de volgorde: dit blok hoort ná 0005_admin.sql te draaien. Wie 0005
-- later opnieuw draait, zet de oude inhoud terug en moet dus ook 0009
-- opnieuw draaien — dat mag, dit hele bestand is heruitvoerbaar.
--
-- 'volgende' betekent hier hetzelfde als vroeger: het NET UITGEGEVEN
-- volgnummer. De browser telt er zelf één bij op voor zijn voorbeeld.
-- ------------------------------------------------------------
create or replace function claim_invoice_number()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim  jsonb;
  v_prefix text;
begin
  if not is_staff() then
    raise exception 'Alleen beheer mag een factuurnummer uitgeven.';
  end if;

  -- de actor legt vast langs WELKE ingang het nummer is uitgegeven; zo is
  -- een gat in de reeks ook achteraf nog terug te leiden naar het scherm
  -- dat het veroorzaakte
  v_claim := claim_series_number(
    p_administration => 'CP',
    p_kind           => 'invoice',
    p_date           => current_date,
    p_invoice_id     => null,
    p_actor          => 'systeem (oude uitgifte)');

  select prefix into v_prefix
    from number_series
   where id = (v_claim->>'seriesId')::uuid;

  return jsonb_build_object(
    'text',     v_claim->>'text',
    'prefix',   coalesce(nullif(v_prefix, ''), 'CP'),
    'jaar',     (v_claim->>'year')::int,
    'volgende', (v_claim->>'seq')::int
  );
end $$;
revoke all on function claim_invoice_number() from public;
revoke all on function claim_invoice_number() from anon;
grant execute on function claim_invoice_number() to authenticated;

comment on function claim_invoice_number() is
  'DOORGEEFLUIK sinds 0009: geeft zelf geen nummers meer uit, maar roept claim_series_number() aan. Eén slot, één teller, één auditspoor. Antwoord blijft {text, prefix, jaar, volgende}.';


-- ------------------------------------------------------------
-- 4. EEN GEANNULEERD OF WEESGEWORDEN NUMMER VASTLEGGEN
-- Struikelt het definitief maken ná stap 4, dan is er een nummer
-- uitgegeven dat aan geen enkele factuur hangt. Dat gat mag bestaan; een
-- ONVERKLAARD gat niet. De browser meldt zo'n wees hiermee terug.
-- ------------------------------------------------------------
create or replace function log_number_event(
  p_administration text,
  p_number_text text,
  p_event text,
  p_reason text default '',
  p_invoice_id uuid default null,
  p_actor text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Alleen beheer mag nummer-audit schrijven.';
  end if;
  if p_event not in ('issued', 'cancelled', 'corrected', 'skipped') then
    raise exception 'Onbekende nummergebeurtenis: %', p_event;
  end if;
  insert into number_audit (administration, invoice_id, number_text, event, reason, actor)
  values (coalesce(nullif(p_administration, ''), 'CP'), p_invoice_id, p_number_text,
          p_event, coalesce(p_reason, ''), coalesce(nullif(p_actor, ''), 'systeem'));
end $$;
revoke all on function log_number_event(text, text, text, text, uuid, text) from public;
grant execute on function log_number_event(text, text, text, text, uuid, text) to authenticated;


-- ------------------------------------------------------------
-- 5. DE VERGRENDELING — STAP 8 VAN DE SPEC, OOK IN DE DATABASE
--
-- WAAROM DE SNAPSHOT DE GRENS IS, EN NIET DE STATUS
-- De backfill in 0008 zette elke al gepubliceerde factuur uit golf 1 op
-- status_code 'finalized'. Die facturen zijn nooit door de acht stappen
-- gegaan en hebben geen snapshot; ze worden nog met de oude bewerk-flow
-- gecorrigeerd. Zou de trigger op de STATUS afgaan, dan brak deze migratie
-- de bestaande werkwijze voor alle historische facturen — zonder dat er
-- een correctiepad voor bestaat.
--
-- invoices.snapshot is daarom de grens: dat is het eenduidige bewijs dat
-- een factuur door stap 5 is gegaan. Vanaf dat moment liggen de
-- financiële en klantzichtbare velden vast en is crediteren de enige weg.
-- Wat WEL mag bewegen op een definitieve factuur:
--   · status_code en de oude status-kolom (de toegestane overgangen)
--   · betaalde/gecrediteerde/openstaande bedragen (betalingen boeken)
--   · tags en internal_note (uitsluitend intern, niet klantzichtbaar)
--   · de tijdstempels, publish_status/published_at en document_id
-- ------------------------------------------------------------
create or replace function invoices_guard_finalized() returns trigger
language plpgsql
as $$
declare
  v_locked text[] := '{}';
begin
  if old.snapshot is null then
    return new;                       -- nog niet definitief: gewoon bewerkbaar
  end if;

  if new.snapshot is distinct from old.snapshot then
    v_locked := v_locked || 'snapshot';
  end if;
  if new.invoice_number     is distinct from old.invoice_number     then v_locked := v_locked || 'invoice_number'; end if;
  if new.project_id         is distinct from old.project_id         then v_locked := v_locked || 'project_id'; end if;
  if new.administration     is distinct from old.administration     then v_locked := v_locked || 'administration'; end if;
  if new.series_id          is distinct from old.series_id          then v_locked := v_locked || 'series_id'; end if;
  if new.doc_kind           is distinct from old.doc_kind           then v_locked := v_locked || 'doc_kind'; end if;
  if new.label              is distinct from old.label              then v_locked := v_locked || 'label'; end if;
  if new.stage_key          is distinct from old.stage_key          then v_locked := v_locked || 'stage_key'; end if;
  if new.currency           is distinct from old.currency           then v_locked := v_locked || 'currency'; end if;
  if new.amount_cents       is distinct from old.amount_cents       then v_locked := v_locked || 'amount_cents'; end if;
  if new.vat_cents          is distinct from old.vat_cents          then v_locked := v_locked || 'vat_cents'; end if;
  if new.total_cents        is distinct from old.total_cents        then v_locked := v_locked || 'total_cents'; end if;
  if new.vat_mode           is distinct from old.vat_mode           then v_locked := v_locked || 'vat_mode'; end if;
  if new.rate_to_eur        is distinct from old.rate_to_eur        then v_locked := v_locked || 'rate_to_eur'; end if;
  if new.invoice_date       is distinct from old.invoice_date       then v_locked := v_locked || 'invoice_date'; end if;
  if new.due_date           is distinct from old.due_date           then v_locked := v_locked || 'due_date'; end if;
  if new.delivery_start     is distinct from old.delivery_start     then v_locked := v_locked || 'delivery_start'; end if;
  if new.delivery_end       is distinct from old.delivery_end       then v_locked := v_locked || 'delivery_end'; end if;
  if new.payment_term_days  is distinct from old.payment_term_days  then v_locked := v_locked || 'payment_term_days'; end if;
  if new.prices_include_vat is distinct from old.prices_include_vat then v_locked := v_locked || 'prices_include_vat'; end if;
  if new.invoice_discount_type  is distinct from old.invoice_discount_type  then v_locked := v_locked || 'invoice_discount_type'; end if;
  if new.invoice_discount_value is distinct from old.invoice_discount_value then v_locked := v_locked || 'invoice_discount_value'; end if;
  if new.subtotal_cents         is distinct from old.subtotal_cents         then v_locked := v_locked || 'subtotal_cents'; end if;
  if new.line_discount_cents    is distinct from old.line_discount_cents    then v_locked := v_locked || 'line_discount_cents'; end if;
  if new.invoice_discount_cents is distinct from old.invoice_discount_cents then v_locked := v_locked || 'invoice_discount_cents'; end if;
  if new.surcharge_cents        is distinct from old.surcharge_cents        then v_locked := v_locked || 'surcharge_cents'; end if;
  if new.total_excl_cents       is distinct from old.total_excl_cents       then v_locked := v_locked || 'total_excl_cents'; end if;
  if new.total_vat_cents        is distinct from old.total_vat_cents        then v_locked := v_locked || 'total_vat_cents'; end if;
  if new.total_incl_cents       is distinct from old.total_incl_cents       then v_locked := v_locked || 'total_incl_cents'; end if;
  if new.billing_address    is distinct from old.billing_address    then v_locked := v_locked || 'billing_address'; end if;
  if new.delivery_address   is distinct from old.delivery_address   then v_locked := v_locked || 'delivery_address'; end if;
  if new.client_reference   is distinct from old.client_reference   then v_locked := v_locked || 'client_reference'; end if;
  if new.purchase_order     is distinct from old.purchase_order     then v_locked := v_locked || 'purchase_order'; end if;
  if new.cost_center        is distinct from old.cost_center        then v_locked := v_locked || 'cost_center'; end if;
  if new.intro_text         is distinct from old.intro_text         then v_locked := v_locked || 'intro_text'; end if;
  if new.outro_text         is distinct from old.outro_text         then v_locked := v_locked || 'outro_text'; end if;
  if new.payment_instructions is distinct from old.payment_instructions then v_locked := v_locked || 'payment_instructions'; end if;
  if new.language           is distinct from old.language           then v_locked := v_locked || 'language'; end if;
  if new.template           is distinct from old.template           then v_locked := v_locked || 'template'; end if;

  if array_length(v_locked, 1) is not null then
    raise exception
      'Deze factuur is definitief; % kan niet meer wijzigen. Corrigeer met een creditfactuur.',
      array_to_string(v_locked, ', ');
  end if;
  return new;
end $$;

drop trigger if exists invoices_guard_finalized_trg on invoices;
create trigger invoices_guard_finalized_trg
  before update on invoices
  for each row execute function invoices_guard_finalized();


-- Verwijderen. Een definitieve factuur verdwijnt nooit: hij wordt
-- geannuleerd (met reden, binnen de toegestane overgangen) of
-- gecrediteerd. Een concept mag wel weg — dat heeft nooit bestaan.
create or replace function invoices_block_delete() returns trigger
language plpgsql
as $$
begin
  if old.snapshot is not null
     or old.status_code in ('finalized','sent','viewed','partially_paid','paid',
                            'overdue','disputed','cancelled','credited','uncollectible') then
    raise exception
      'Een definitieve factuur (%) kan niet worden verwijderd. Annuleer hem met een reden, of maak een creditfactuur.',
      coalesce(nullif(old.invoice_number, ''), old.id::text);
  end if;
  return old;
end $$;

drop trigger if exists invoices_block_delete_trg on invoices;
create trigger invoices_block_delete_trg
  before delete on invoices
  for each row execute function invoices_block_delete();


-- De regels van een definitieve factuur staan in de snapshot. De rijen in
-- invoice_lines zijn daarna nog slechts de werkkopie en mogen niet meer
-- bewegen — anders wijkt de werkkopie af van wat de klant heeft gekregen.
create or replace function invoice_lines_guard_finalized() returns trigger
language plpgsql
as $$
declare
  v_inv uuid;
  v_snapshot jsonb;
  v_number text;
begin
  v_inv := coalesce(new.invoice_id, old.invoice_id);
  select snapshot, invoice_number into v_snapshot, v_number from invoices where id = v_inv;
  if v_snapshot is not null then
    raise exception
      'Factuur % is definitief; de regels liggen vast in de snapshot. Corrigeer met een creditfactuur.',
      coalesce(nullif(v_number, ''), v_inv::text);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists invoice_lines_guard_finalized_trg on invoice_lines;
create trigger invoice_lines_guard_finalized_trg
  before insert or update or delete on invoice_lines
  for each row execute function invoice_lines_guard_finalized();


-- ------------------------------------------------------------
-- 6. INSTELLINGSSLEUTEL VOOR DE REEKSEN IN DEMOMODUS-VORM
-- De browser leest de reeksen live uit number_series. De sleutel hieronder
-- bestaat zodat een verse omgeving hem heeft en de back-upexport hem
-- meeneemt; hij is een SPIEGEL, nooit de bron. Wie hem leeg laat, verliest
-- niets: number_series is leidend zodra de tabel bestaat.
-- ------------------------------------------------------------
insert into admin_settings(key, value) values
  ('factuur_reeksen', '[]'::jsonb),
  ('factuur_doc_standaard',
   '{"betaaltermijn_dagen": 14, "taal": "nl", "sjabloon": "standaard", "prijzen_incl_btw": false, "btw_code": "VERLEGD"}'::jsonb)
on conflict (key) do nothing;
