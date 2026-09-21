-- ============================================================
-- CUSTOM+ foutlogboek — 0023: clientfouten van site, portal en beheer
--
-- WAAROM DIT BESTAND BESTAAT
-- Geen tracker: dit is geen analytics en geen sessieopname. Het is een klein
-- vangnet dat onverwachte JavaScript fouten (window error / unhandledrejection)
-- uit de browser van een bezoeker of staflid vastlegt, zodat Steffan gebreken
-- ziet vóórdat iemand ze meldt — zonder ook maar iets te weten over WIE die
-- bezoeker is.
--
-- WIE ERBIJ MAG
-- De functie (netlify/functions/log-client-error.mjs) schrijft met de
-- service-role-sleutel via de RPC hieronder, en die staat buiten RLS. Voor
-- ingelogde gebruikers geldt hetzelfde als in 0022: alleen staf (is_staff()
-- uit 0001) leest deze tabel; een klant in het portaal ziet niets. Er is
-- geen enkele policy voor anon of INSERT: een bezoeker praat nooit
-- rechtstreeks met de database, alleen met de functie — en de functie zelf
-- heeft geen sessie nodig (dit gaat over anonieme sitebezoekers), precies
-- zoals site_chat_add_usage in 0022 zonder sessie werkt omdat de functie
-- SECURITY DEFINER is en de service-role-sleutel om de RLS heen gaat.
--
-- ONTDUBBELEN, GEEN RUWE INSERT
-- Eén kapotte deploy kan dezelfde fout duizend keer per uur geven. Daarom
-- gaat schrijven nooit via een kale insert, maar via log_client_error.
--
-- EERDERE VERSIE HAD EEN RACE (gevonden bij code review, nooit live geweest):
-- "select ... for update" vindt alleen een rij die al bestaat. Twee
-- gelijktijdige aanroepen voor exact dezelfde GLASHARDE NIEUWE fout zien
-- allebei nog geen rij — "for update" vergrendelt pas een rij ná de select,
-- dus dat sluit niets af — en maken dus allebei een nieuwe rij aan.
--
-- NU: een echte database-garantie via een unieke sleutel (dedupe_bucket) en
-- "insert ... on conflict (dedupe_bucket) do update" in één atomair
-- statement, hetzelfde patroon als site_chat_add_usage in 0022. dedupe_bucket
-- is de md5-hash van app + message + url + het lopende klokuur (UTC). Twee
-- gelijktijdige inserts met dezelfde hash botsen op de unieke index; de
-- database laat er één winnen als nieuwe rij en dwingt de ander in het
-- "do update"-pad. Dat kan niet meer misgaan, in tegenstelling tot
-- select-dan-insert-of-update.
--
-- AFWEGING VENSTERGROOTTE (bewust, zie ook code review-bevinding): de oude
-- opzet had een glijdend 24-uursvenster (ophogen zolang last_seen < 24 uur
-- oud). Een vaste ON CONFLICT-sleutel kán geen glijdend venster zijn — die
-- moet voor elke insert dezelfde waarde opleveren zolang de fout bij
-- "dezelfde episode" hoort, en dat kan alleen met een vast tijdvak, niet met
-- een venster dat meeschuift met de laatste waarneming. Gekozen: per
-- klokuur (UTC), niet per kalenderdag. Dat is korter dan de oorspronkelijke
-- 24 uur, maar sluit qua schaal het best aan bij het motiverende scenario
-- hierboven ("duizend keer per uur"): een kapotte deploy die continu
-- dezelfde fout gooit, wordt binnen elk uur alsnog tot één rij
-- teruggebracht, precies zoals bedoeld. Het enige verschil met vroeger: een
-- fout die toevallig een klokuurgrens overschrijdt (of die af en toe
-- terugkomt, verspreid over meerdere uren) krijgt nu per klokuur een eigen
-- rij in plaats van één doorlopend opgehoogde rij — een bewuste, kleine
-- gedragsverandering in ruil voor een garantie die niet meer race-gevoelig
-- is. first_seen/last_seen per rij blijven eerlijk: first_seen is de eerste
-- waarneming ín dat klokuur, last_seen de laatste.
--
-- GEEN PII
-- Er wordt hier bewust geen IP-adres en geen user agent opgeslagen (de
-- functie leest ze niet eens uit de request). client_id is een willekeurige
-- waarde die de browser zelf verzint en alleen in sessionStorage bewaart,
-- puur om "één bezoeker met veel fouten" te onderscheiden van "veel
-- bezoekers met één fout elk" — geen identificatie.
--
-- HOE JE HEM DRAAIT
-- Plak dit hele bestand in de SQL-editor van het Supabase-project en druk op
-- Run, ná 0001 (is_staff) en 0022 (mag vóór of ná, ze raken elkaar niet).
-- Twee keer draaien mag: alles heeft "if not exists" en de policy en de
-- functie worden eerst gedropt.
-- ============================================================

-- ---------- de tabel ----------
create table if not exists client_error_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  app         text not null check (app in ('site', 'portal', 'beheer')),
  message     text not null,
  stack       text,
  url         text,
  lang        text,
  client_id   text,
  count       integer not null default 1,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
-- dedupe_bucket: md5-hash van app+message+url+lopend klokuur (UTC), gezet
-- door log_client_error zelf (zie ONTDUBBELEN hierboven). "add column if
-- not exists" in plaats van in de create table erboven, zodat een eerdere
-- (partiële) run van dit bestand zonder deze kolom hem er alsnog bij krijgt.
alter table client_error_log add column if not exists dedupe_bucket text;

create index if not exists client_error_log_created_idx on client_error_log (created_at desc);
-- vervangt de oude client_error_log_dedupe_idx (app, message, url,
-- last_seen desc): die ondersteunde een select-opzoeking die niet meer
-- bestaat. De ontdubbeling verloopt nu via "insert ... on conflict" op deze
-- unieke index — een unique index, geen losse "add constraint", zodat
-- "if not exists" hem meteen re-runnable maakt zonder de
-- drop-dan-toevoegen-omweg die een table-constraint nodig zou hebben.
drop index if exists client_error_log_dedupe_idx;
create unique index if not exists client_error_log_dedupe_bucket_key
  on client_error_log (dedupe_bucket);

comment on table client_error_log is
  'Foutlogboek: clientfouten (window error / unhandledrejection) van site, portal en beheer. Geen IP, geen user agent, geen cookies. count/first_seen/last_seen komen van het ontdubbelen in log_client_error via dedupe_bucket (unieke sleutel per app+message+url+klokuur, UTC) — zie ONTDUBBELEN in de bestandskop.';

alter table client_error_log enable row level security;
drop policy if exists "staff leest client_error_log" on client_error_log;
create policy "staff leest client_error_log" on client_error_log
  for select using (is_staff());

-- ---------- schrijven: alleen via deze functie, nooit een kale insert ----------
-- SECURITY DEFINER + geen enkele INSERT/UPDATE-policy hierboven: dit is de
-- enige weg naar binnen. De functie vraagt geen sessie en geen auth.uid() —
-- de anonieme sitebezoeker heeft geen van beide, en dat is precies wie hem
-- aanroept (via de functie, met de service-role-sleutel).
drop function if exists log_client_error(text, text, text, text, text, text);
create function log_client_error(
  p_app        text,
  p_message    text,
  p_stack      text default null,
  p_url        text default null,
  p_lang       text default null,
  p_client_id  text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_bucket text;
begin
  if p_app not in ('site', 'portal', 'beheer') then
    raise exception 'log_client_error: ongeldige app %', p_app;
  end if;
  if p_message is null or btrim(p_message) = '' then
    raise exception 'log_client_error: message is verplicht';
  end if;

  -- dedupe_bucket: md5-hash van app + message + url + het lopende klokuur
  -- (UTC, met "at time zone" vastgezet zodat dit niet afhangt van de
  -- tijdzone-instelling van de databaseverbinding). md5 in plaats van de
  -- ruwe tekst zelf: message/stack kunnen lang zijn, en een unieke index op
  -- een lange tekstkolom kan tegen de btree-rijgrootte-limiet aanlopen; de
  -- hash is altijd 32 tekens.
  v_bucket := md5(
    p_app || '|' || p_message || '|' || coalesce(p_url, '') || '|' ||
    to_char(date_trunc('hour', now() at time zone 'utc'), 'YYYY-MM-DD"T"HH24')
  );

  -- Eén atomair statement in plaats van select-dan-insert-of-update: dat
  -- sluit de race waarbij twee gelijktijdige aanroepen voor exact dezelfde
  -- GLASHARDE NIEUWE fout allebei nog geen rij zien en allebei een nieuwe
  -- aanmaken (zie ONTDUBBELEN in de bestandskop). Zelfde upsert-patroon als
  -- site_chat_add_usage in 0022.
  insert into client_error_log (app, message, stack, url, lang, client_id, dedupe_bucket)
    values (p_app, p_message, p_stack, p_url, p_lang, p_client_id, v_bucket)
  on conflict (dedupe_bucket) do update
    set count      = client_error_log.count + 1,
        last_seen  = now(),
        stack      = coalesce(excluded.stack, client_error_log.stack),
        lang       = coalesce(excluded.lang, client_error_log.lang),
        client_id  = coalesce(excluded.client_id, client_error_log.client_id);
end;
$$;
revoke all on function log_client_error(text, text, text, text, text, text) from public;
grant execute on function log_client_error(text, text, text, text, text, text) to service_role;
comment on function log_client_error(text, text, text, text, text, text) is
  'Foutlogboek: legt één clientfout vast of hoogt een gelijke fout op via "insert ... on conflict (dedupe_bucket)" (app+message+url+klokuur UTC) — race-vrij, in tegenstelling tot de oudere select-for-update-aanpak. Alleen de functie (service_role) roept dit aan, zonder sessie — zie 0022 voor hetzelfde upsert-patroon bij site_chat_add_usage.';
