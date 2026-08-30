-- ============================================================
-- CUSTOM+ — facturatielaag ("factuur-topsysteem")
-- Draai dit ná 0001 t/m 0005 in de Supabase SQL editor.
-- Dit bestand groeit per bouwgolf: elke golf APPENDT hieronder een eigen,
-- duidelijk gecommentarieerd blok. RLS volgt het bestaande patroon uit
-- 0001_portal_schema.sql: is_staff() voor alles wat alleen Steffan raakt.
-- HER-UITVOERBAAR: elke create policy heeft een drop policy if exists
-- ervoor en alle DDL is if-not-exists-veilig, zodat je na elke nieuwe
-- golf gewoon het HELE bestand opnieuw kunt draaien.
-- ============================================================

-- ------------------------------------------------------------
-- GOLF 1 — geld sneller binnen + fundament
-- Functies 1 (EPC-betaal-QR), 3 (btw-verlegd-poortwachter), 5
-- (betalingskenmerk + match-hulp), 7 (wisselkoersanker), 9
-- (nummeringswaakhond), 11 (factuur mee met de goedkeuringsmail) en 14
-- (betaalbevestiging).
--
-- Wat hier NIET staat, en waarom:
--   · het betalingskenmerk (5) is het bestaande invoice_number uit
--     0005_admin.sql — één nummer, één betekenis, geen tweede kolom;
--   · de nummeringswaakhond (9) leest de reeks en bewaart zijn
--     verklaringen als één jsonb onder de sleutel 'nummer_verklaringen' in
--     admin_settings — een eenmanszaak heeft daar geen tabel voor nodig;
--   · IBAN en BIC (1) horen bij het bedrijfsprofiel en zitten dus in de
--     bestaande jsonb onder de sleutel 'bedrijf';
--   · functies 11 en 14 zijn puur mailflow op bestaande kolommen.
-- ------------------------------------------------------------

-- Functie 3 — btw-verlegd-poortwachter.
-- Het btw-identificatienummer van de AFNEMER. Zonder dit nummer weigert de
-- publiceerflow een factuur met btw verlegd, en het staat verplicht op de
-- factuur zelf. Bewust op de klant en niet per factuur: één klant heeft één
-- btw-nummer, en per factuur opnieuw overtypen is precies hoe fouten
-- ontstaan. Leeg is toegestaan (niet elke klant is EU-ondernemer); de
-- poortwachter beslist wanneer het verplicht is.
-- De klant leest zijn eigen rij al via "client reads own row" uit
-- 0001_portal_schema.sql — een eigen btw-nummer is geen geheim voor de
-- eigenaar ervan, en er komt dus geen nieuwe policy bij.
alter table clients add column if not exists vat_number text not null default '';

-- Functie 7 — wisselkoersanker op factuurdatum.
-- Hoeveel vreemde valuta één euro was op de factuurdatum, handmatig
-- overgenomen van de ECB-referentiekoers. numeric (geen float): een koers
-- is een administratief gegeven en mag niet drijven. NULL bij EUR-facturen
-- en bij alles wat nog geen anker heeft — de publiceerflow eist hem vóór
-- een niet-EUR-factuur naar buiten mag.
alter table invoices add column if not exists rate_to_eur numeric(18,6);
-- een koers is per definitie positief; 0 of negatief zou de EUR-omrekening
-- stilzwijgend onzin maken
do $$
begin
  alter table invoices add constraint invoices_rate_to_eur_positive
    check (rate_to_eur is null or rate_to_eur > 0);
exception
  when duplicate_object then null;   -- al aangelegd bij een eerdere run
end $$;

-- Functie 9 — nummeringswaakhond.
-- Geen DDL: de waakhond leest de bestaande invoice_number-kolom en bewaart
-- de verklaring bij een ontbrekend nummer onder deze sleutel. Alleen de
-- sleutel wordt hier alvast aangemaakt zodat een verse omgeving hem heeft;
-- de bestaande "staff only admin_settings"-policy dekt hem.
insert into admin_settings(key, value)
  values ('nummer_verklaringen', '{}'::jsonb)
  on conflict (key) do nothing;

-- Functie 1 — de EPC-betaal-QR heeft de betaalgegevens NODIG IN HET PORTAAL.
-- admin_settings is staff-only en dat blijft zo: de klant mag geen enkele
-- beheersinstelling kunnen lezen. Daarom deze smalle security-definer
-- functie, die exact drie velden teruggeeft — naam, IBAN en BIC — en verder
-- niets. Dat zijn precies de gegevens die sowieso onderaan elke factuur
-- staan die de klant al heeft; het is geen nieuwe blootstelling, alleen een
-- gecontroleerde.
--
-- search_path staat vast (aanbeveling voor elke definer-functie), het
-- execute-recht gaat NIET naar public/anon maar alleen naar ingelogde
-- gebruikers, en de functie leest niets anders dan die ene rij.
create or replace function public_billing_profile()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
           'naam', coalesce(value->>'naam', ''),
           'iban', coalesce(value->>'iban', ''),
           'bic',  coalesce(value->>'bic',  '')
         )
    from admin_settings
   where key = 'bedrijf';
$$;
revoke all on function public_billing_profile() from public;
grant execute on function public_billing_profile() to authenticated;

comment on function public_billing_profile() is
  'Golf 1 (functie 1): uitsluitend naam/IBAN/BIC uit admin_settings.bedrijf, voor het betaalvak en de SEPA-QR in het klantportaal. Geeft NOOIT andere instellingen terug.';
