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
-- gaat schrijven nooit via een kale insert, maar via log_client_error: bij
-- dezelfde fout (app + message + url) binnen de laatste 24 uur wordt de
-- bestaande rij opgehoogd (count, last_seen) in plaats van dat er een nieuwe
-- rij bijkomt. Na 24 uur stilte begint een gelijke fout weer als nieuwe rij
-- (first_seen/last_seen blijven dan eerlijk bij de nieuwe episode horen).
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
create index if not exists client_error_log_created_idx on client_error_log (created_at desc);
-- ondersteunt de ontdubbel-opzoeking in log_client_error hieronder
create index if not exists client_error_log_dedupe_idx on client_error_log (app, message, url, last_seen desc);

comment on table client_error_log is
  'Foutlogboek: clientfouten (window error / unhandledrejection) van site, portal en beheer. Geen IP, geen user agent, geen cookies. count/first_seen/last_seen komen van het ontdubbelen in log_client_error (24 uur venster op app+message+url).';

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
  v_id uuid;
begin
  if p_app not in ('site', 'portal', 'beheer') then
    raise exception 'log_client_error: ongeldige app %', p_app;
  end if;
  if p_message is null or btrim(p_message) = '' then
    raise exception 'log_client_error: message is verplicht';
  end if;

  -- dezelfde fout (app + message + url) met de laatste waarneming binnen 24
  -- uur: ophogen. "for update" zet een rijslot zodat twee functie-instanties
  -- die exact tegelijk dezelfde fout binnenkrijgen elkaar niet voorbij lopen
  -- en toch allebei een nieuwe rij zouden aanmaken.
  select id into v_id
    from client_error_log
    where app = p_app
      and message = p_message
      and coalesce(url, '') = coalesce(p_url, '')
      and last_seen > now() - interval '24 hours'
    order by last_seen desc
    limit 1
    for update;

  if v_id is not null then
    update client_error_log
      set count      = count + 1,
          last_seen  = now(),
          stack      = coalesce(p_stack, stack),
          lang       = coalesce(p_lang, lang),
          client_id  = coalesce(p_client_id, client_id)
      where id = v_id;
  else
    insert into client_error_log (app, message, stack, url, lang, client_id)
      values (p_app, p_message, p_stack, p_url, p_lang, p_client_id);
  end if;
end;
$$;
revoke all on function log_client_error(text, text, text, text, text, text) from public;
grant execute on function log_client_error(text, text, text, text, text, text) to service_role;
comment on function log_client_error(text, text, text, text, text, text) is
  'Foutlogboek: legt één clientfout vast of hoogt een gelijke fout (app+message+url, laatste 24 uur) op. Alleen de functie (service_role) roept dit aan, zonder sessie — zie 0022 voor hetzelfde patroon bij site_chat_add_usage.';
