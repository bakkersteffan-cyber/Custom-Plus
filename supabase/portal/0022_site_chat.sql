-- ============================================================
-- CUSTOM+ sitechat — 0022: leads, onbeantwoorde vragen en de dagteller
--
-- WAAROM DIT BESTAND BESTAAT
-- De sitechat (netlify/functions/site-chat.mjs) werkt zonder database: de
-- kennisbank is een statisch bestand en de limieten leven in het geheugen
-- van de functie. Drie dingen zijn wél de moeite van het bewaren waard, en
-- die krijgen hier een tabel:
--   · site_chat_leads        bezoekers die het gesprek per mail willen: het
--                            adres plus het gesprek, zodat een gemiste mail
--                            (Resend down, verkeerde env) geen verloren lead
--                            is
--   · site_chat_unanswered   vragen waarop de site geen antwoord had (de
--                            [[onbekend]]-vlag). Dit is de lijst waarmee de
--                            eigenaar de site aanvult: elke rij is een gat
--                            in de content
--   · site_chat_counters     één rij per dag met het geschatte verbruik.
--                            Netlify draait meerdere functie-instanties
--                            naast elkaar; zonder gedeelde teller ziet elke
--                            instantie alleen zijn eigen uitgaven en kan de
--                            som ruim boven het dagbudget uitkomen
--
-- WIE ERBIJ MAG
-- De functie schrijft met de service-role-sleutel, en die staat buiten RLS.
-- Voor ingelogde gebruikers geldt: alleen staf (is_staff() uit 0001) leest
-- en beheert deze tabellen; een klant in het portaal ziet niets. Er is geen
-- enkele policy voor anon: bezoekers praten met de functie, nooit met de
-- database.
--
-- GELD
-- Bedragen zijn gehele micro-euro's (1 euro = 1.000.000), nooit een float:
-- één chatvraag kost een fractie van een cent, en centen zouden elke vraag
-- op nul afronden. Het getal is een SCHATTING op tokens, geen factuur.
--
-- HOE JE HEM DRAAIT
-- Plak dit hele bestand in de SQL-editor van het Supabase-project en druk op
-- Run, ná 0001 (is_staff). Twee keer draaien mag: alles heeft "if not
-- exists" en elke policy wordt eerst gedropt.
-- ============================================================

-- ---------- leads ----------
create table if not exists site_chat_leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null,
  naam        text,
  transcript  text not null,
  page        text,
  lang        text not null default 'nl',
  mailed      boolean not null default false,
  handled_at  timestamptz
);
create index if not exists site_chat_leads_created_idx on site_chat_leads (created_at desc);

comment on table site_chat_leads is
  'Sitechat: bezoekers die het gesprek per mail wilden. transcript is platte tekst (Bezoeker:/Assistent:). mailed = of de mail naar Steffan via Resend is gelukt; handled_at zet staf zelf.';

alter table site_chat_leads enable row level security;
drop policy if exists "staff beheert site_chat_leads" on site_chat_leads;
create policy "staff beheert site_chat_leads" on site_chat_leads
  for all using (is_staff()) with check (is_staff());

-- ---------- onbeantwoord ----------
create table if not exists site_chat_unanswered (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  vraag       text not null,
  page        text,
  lang        text not null default 'nl',
  handled_at  timestamptz
);
create index if not exists site_chat_unanswered_created_idx on site_chat_unanswered (created_at desc);

comment on table site_chat_unanswered is
  'Sitechat: vragen waarop de site geen antwoord had ([[onbekend]]). Elke rij is een gat in de content; handled_at zet staf zodra de site is aangevuld.';

alter table site_chat_unanswered enable row level security;
drop policy if exists "staff beheert site_chat_unanswered" on site_chat_unanswered;
create policy "staff beheert site_chat_unanswered" on site_chat_unanswered
  for all using (is_staff()) with check (is_staff());

-- ---------- dagteller ----------
create table if not exists site_chat_counters (
  day        date primary key,
  calls      integer not null default 0,
  tokens     bigint  not null default 0,
  eur_micro  bigint  not null default 0,
  updated_at timestamptz not null default now()
);

comment on table site_chat_counters is
  'Sitechat: geschat verbruik per dag (UTC). eur_micro in gehele micro-euro; schatting op tokens maal CHAT_EUR_PER_MTOKEN, geen factuur.';

alter table site_chat_counters enable row level security;
drop policy if exists "staff leest site_chat_counters" on site_chat_counters;
create policy "staff leest site_chat_counters" on site_chat_counters
  for select using (is_staff());

-- Optellen in één statement, zodat twee instanties die tegelijk klaar zijn
-- elkaars verbruik niet overschrijven (een upsert met de nieuwe totalen zou
-- dat wel doen).
create or replace function site_chat_add_usage(p_day date, p_tokens bigint, p_eur_micro bigint)
returns void
language sql security definer set search_path = public as $$
  insert into site_chat_counters (day, calls, tokens, eur_micro, updated_at)
  values (p_day, 1, greatest(p_tokens, 0), greatest(p_eur_micro, 0), now())
  on conflict (day) do update
    set calls      = site_chat_counters.calls + 1,
        tokens     = site_chat_counters.tokens + greatest(excluded.tokens, 0),
        eur_micro  = site_chat_counters.eur_micro + greatest(excluded.eur_micro, 0),
        updated_at = now();
$$;
revoke all on function site_chat_add_usage(date, bigint, bigint) from public;
grant execute on function site_chat_add_usage(date, bigint, bigint) to service_role;
comment on function site_chat_add_usage(date, bigint, bigint) is
  'Sitechat: telt één aanroep met geschat verbruik op bij de dagrij. Alleen de functie (service_role) roept dit aan.';
