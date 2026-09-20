-- ============================================================
-- CUSTOM+ beheer — 0020: de velden achter de nieuwe beheer-UI
--
-- WAAROM DIT BESTAND BESTAAT
-- De eigenaar leverde tien schermafbeeldingen van de gewenste beheer-UI en
-- zei: volg deze 1:1, en "dingen die missen moet je erbij doen dus
-- ontwikkel het". Hoofdstuk 7 van .claude/beheer-ui-mockup-spec.md was tot
-- nu toe een WEGLAATLIJST: alles wat de mockup toont maar de database niet
-- kent (fabrieksdossier, avatars, projectdeadline, gespreksdraad, team en
-- rollen, werkdruk, bewaartermijn). Deze migratie draait die lijst om en
-- maakt er echte kolommen en tabellen van, zodat het beheer geen enkel
-- getal meer hoeft te verzinnen: alles wat de schermen tonen komt straks
-- uit iets dat de eigenaar zelf heeft ingevuld.
--
-- WELKE SCHERMEN HEM NODIG HEBBEN
--   · Overzicht            → "Operaties deze week" (werkdruk), deadlinekalender
--   · Inbox                → de gespreksdraad met meerdere beurten
--   · Projecten + detail   → deadline, categorie, projectleider, fabriek
--   · Relaties → Klanten   → land, tagline, logo, avatar contactpersoon
--   · Relaties → Fabrieken → status, specialisaties, twee scores, foto,
--                            land, contactpersoon, notities. Die staan
--                            bewust over TWEE tabellen verdeeld; blok A
--                            legt uit waarom dat geen keuze is maar een
--                            noodzaak.
--   · Financiën / Inbox    → aanvraag met land, bron en meegestuurde bestanden
--   · Instellingen         → Team & rechten, bewaartermijn, laatste back-up
--
-- HOE JE HEM DRAAIT
-- Plak dit HELE bestand in de SQL-editor van het Supabase-project (Database
-- → SQL Editor → New query) en druk op Run. Draai hem ná 0001 t/m 0012.
-- Twee keer draaien mag: elke create heeft "if not exists", elke policy
-- wordt eerst gedropt, en alle drie de datamigraties laten staan wat er al
-- staat.
--
-- WAT DEZE MIGRATIE WÉL WEGHAALT
-- Aan bestaande GEGEVENS gaat niets verloren, maar dit is niet langer een
-- migratie die uitsluitend toevoegt. Twee dingen verdwijnen, en allebei
-- alleen bij wie een EERDERE versie van dit bestand al had gedraaid:
--   · de acht interne fabriekskolommen (notes, de vijf contact_*-velden en
--     de twee scores) die toen op factories_partners werden gezet. Ze
--     verhuizen eerst mét inhoud naar de nieuwe tabel factory_private en
--     worden pas daarna gedropt — zie blok A, deel A4;
--   · de restrictive policy "fabrieksdossier alleen staff of eigen fabriek"
--     en de helper client_sees_factory() uit diezelfde eerdere versie. Die
--     beloofden een bescherming die Postgres niet kan geven; blok A legt
--     uit waarom, en waarom ze na de splitsing overbodig zijn.
-- Heb je dit bestand nog nooit gedraaid, dan zijn allebei die opruimacties
-- een no-op: de kolommen worden dan simpelweg nooit op factories_partners
-- gezet en de policy heeft nooit bestaan.
--
-- LET OP — DE DATALAAG MOET IN DEZELFDE BEURT MEE (portal/admin-data.js)
-- listFactories/getFactory doen vandaag select('*') op factories_partners en
-- saveFactory/createFactory schrijven daar alle velden terug. Acht van die
-- velden staan na deze migratie in factory_private. Zolang die functies niet
-- ook factory_private lezen (left join: een fabriek zonder interne rij is de
-- normale beginstand) en schrijven (upsert op factory_id), toont het
-- fabrieksdossier in LIVE modus lege interne velden en mislukt het opslaan
-- ervan met "column does not exist". De DEMOmodus merkt er niets van, want
-- die houdt één plat record per fabriek in de browser. admin-data.js valt
-- buiten deze migratie; draai hem dus niet vóór dat bestand is bijgewerkt.
--
-- VOLGORDE
-- De blokken dragen de letters A t/m J uit de bouwopdracht, maar staan in
-- de volgorde A, B, D, E, C, F, H, G, I+J. Twee redenen:
--   · de kolomblokken (B, D, E, C, F) staan per TABEL bij elkaar, zodat je
--     bij het lezen niet drie keer terug hoeft naar projects of clients;
--   · blok H (team_members) moet vóór blok G (gespreksdraad) staan, omdat
--     de datamigratie van G de naam van de eigenaar uit team_members leest
--     om het bestaande antwoord een afzender te geven.
--
-- NUMMERING
-- 0020 en niet 0013: op het moment van schrijven bouwt een tweede sessie de
-- factuurmodule uit en die heeft t/m 0012 in gebruik. Het gat is bewust,
-- zodat twee gelijktijdige bouwen elkaars nummers niet stelen.
--
-- BESTANDEN (foto's, logo's, avatars)
-- Alle *_url- en *_path-kolommen hieronder bewaren een VERWIJZING, geen
-- bytes en niet per se een http-adres:
--   · demomodus → een sleutel in IndexedDB (portal/demo-files.js), de blob
--     blijft in de browser;
--   · live modus → een pad in de PRIVATE bucket `beheer-intern` (aangemaakt
--     in 0012_betalingen.sql), waar het beheer met createSignedUrl een
--     kortlevende URL van maakt.
-- Bewust niet in `project-media` of `project-docs`: die twee zijn via
-- owns_project() leesbaar voor de klant, en een fabrieksfoto of een
-- teamavatar hoort niet bij een project van een klant.
-- ============================================================


-- ------------------------------------------------------------
-- BLOK A — FABRIEKSDOSSIER, IN TWEE TABELLEN
-- Een fabriek was drie velden (naam, regio, NNN-datum) plus de stad uit
-- 0003. De mockup (scherm 5.6) toont een compleet dossier: statusstip,
-- foto, land, specialisatiechips, twee scores van vijf stippen en een
-- contactpersoon met notities in de rechterrail.
--
-- WAAROM DAT DOSSIER OVER TWÉÉ TABELLEN GAAT — LEES DIT EERST.
-- factories_partners is sinds 0001 leesbaar voor ELKE ingelogde gebruiker:
--     create policy "authenticated read factories" ... using (auth.role() = 'authenticated')
-- Dat was verdedigbaar zolang de tabel alleen naam, regio, stad en een
-- NNN-datum droeg ("namen zijn generiek zichtbaar per disclosure-regel").
--
-- Een EERDERE versie van dit bestand zette de interne velden er gewoon bij
-- (notities, contactgegevens, de twee scores) en probeerde dat gat te
-- dichten met een RESTRICTIVE select-policy plus de helper
-- client_sees_factory(). DAT WERKT NIET, en het commentaar erboven beloofde
-- wél dat het werkte — wat erger is dan geen commentaar.
-- De reden: Postgres kent geen leesrecht per KOLOM. Een policy beperkt
-- WELKE RIJEN iemand ziet, niet welke kolommen van zo'n rij. Een klant met
-- één project bij Fabriek Chen haalt die controle dus gewoon, en leest
-- daarna via de REST API de HELE rij — inclusief de interne notitie over
-- prijsstaffels en aanbetalingstermijnen. Dat is inkoopmarge-informatie van
-- de eigenaar, leesbaar door zijn eigen klant.
--
-- De oplossing is het patroon dat admin_contacts, admin_requests en
-- admin_mail_log in 0005 al gebruiken: wat alleen van de staf is, staat in
-- een tabel die alleen de staf kan lezen. Geen slimme policy, gewoon een
-- andere tabel.
--   · factories_partners houdt wat onschadelijk is en wat het klantportaal
--     nu al toont: naam, regio, stad en NNN-datum (uit 0001/0003) plus
--     status, specialties, photo_url en country. De leesrechten uit 0001
--     blijven daar ongewijzigd — er staat niets meer in dat een klant niet
--     mag zien.
--   · factory_private houdt alles wat van de eigenaar alleen is: de
--     notities, de contactpersoon en de twee scores. RLS aan, één policy,
--     is_staff(). Het klantportaal leest die tabel nooit.
-- Er is dan geen kolom meer die per ongeluk meelift met een rij die de
-- klant mag zien, en dus ook geen policy meer nodig die dat moet bewaken.
--
-- De twee scores zijn met opzet 1 t/m 5 én mogen NULL zijn: null betekent
-- "nog niet beoordeeld" en dat is iets anders dan een 1. De UI toont bij
-- null lege stippen, geen nul.
-- ------------------------------------------------------------

-- ---- A1: de onschadelijke helft, op de bestaande tabel ----
alter table factories_partners add column if not exists status text not null default 'actief'
  check (status in ('actief','gepauzeerd','gearchiveerd'));
alter table factories_partners add column if not exists specialties jsonb not null default '[]'::jsonb
  check (jsonb_typeof(specialties) = 'array');
alter table factories_partners add column if not exists photo_url text not null default '';
alter table factories_partners add column if not exists country text not null default '';

comment on column factories_partners.status is
  'actief | gepauzeerd | gearchiveerd. Stuurt de statusstip op de fabriekskaart. Default actief, zodat elke bestaande fabriek zichtbaar blijft — migratie-veilig.';
comment on column factories_partners.specialties is
  'jsonb-array van vrije tekstlabels, bv. ["spuitgieten","glas","assemblage"]. Wordt in de UI de chiprij; de eigenaar typt ze zelf, er is bewust geen vaste lijst omdat wij niet weten wat hij inkoopt.';
comment on column factories_partners.photo_url is
  'Verwijzing naar de fabrieksfoto (300x200 op de kaart). Demomodus: sleutel in IndexedDB. Live: pad in de private bucket beheer-intern. Leeg = neutrale tegel met fabrieksicoon. Deze tabel is sinds 0001 leesbaar voor elke ingelogde gebruiker, dus het PAD is dat ook — het BESTAND niet: de bucket beheer-intern is staff-only (zie 0012).';
comment on column factories_partners.country is
  'Land van de fabriek, vrije tekst (bv. China). Staat naast de bestaande kolom city uit 0003, die de kaartpin voedt; country is puur voor de leesregel op de kaart.';

-- ---- A2: de vorige, niet werkende poging opruimen ----
-- Dit is het slot dat een leesrecht per kolom beloofde dat Postgres niet
-- kent. Het mag weg zodra er niets vertrouwelijks meer in de tabel staat —
-- en dat is precies wat A3 en A4 hieronder regelen.
-- Er zit nog een tweede reden onder. De policy riep client_sees_factory()
-- aan, en die functie heeft alleen execute-recht voor `authenticated`. Een
-- ANONIEM verzoek op factories_partners kreeg daardoor geen lege lijst meer
-- (het eerlijke antwoord: je ziet niets) maar een permission denied op een
-- functie — een gedragsverandering die niemand had gevraagd en die de
-- foutafhandeling in het portaal een heel ander soort fout in duwt.
-- "if exists" op allebei, zodat dit ook netjes draait bij wie de vorige
-- versie al had uitgevoerd én bij wie dit bestand voor het eerst draait.
-- Volgorde: eerst de policy, dan de functie — Postgres weigert een functie
-- te droppen waar nog een policy aan hangt.
drop policy if exists "fabrieksdossier alleen staff of eigen fabriek" on factories_partners;
drop function if exists client_sees_factory(uuid);

-- ---- A3: de interne helft, in een eigen tabel ----
-- Primaire sleutel is factory_id zelf: precies één interne rij per fabriek,
-- en on delete cascade zodat een verwijderde fabriek geen zwevend dossier
-- achterlaat. Een fabriek ZONDER rij hier is de normale beginstand en geen
-- fout — de datalaag hoort een left join te doen en lege velden te tonen.
create table if not exists factory_private (
  factory_id uuid primary key references factories_partners(id) on delete cascade,
  notes text not null default '',
  contact_name text not null default '',
  contact_role text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  contact_avatar_url text not null default '',
  quality_score smallint check (quality_score between 1 and 5),
  leadtime_score smallint check (leadtime_score between 1 and 5)
);

comment on table factory_private is
  'De INTERNE helft van het fabrieksdossier: notities, contactpersoon en de twee scores. Staat los van factories_partners omdat die tabel sinds 0001 leesbaar is voor elke ingelogde gebruiker en Postgres geen leesrecht per kolom kent. Alleen staff, lezen en schrijven. Het klantportaal raakt deze tabel nooit aan.';
comment on column factory_private.factory_id is
  'De fabriek waar dit dossier bij hoort; tevens de primaire sleutel, dus hoogstens één rij per fabriek. on delete cascade.';
comment on column factory_private.notes is
  'Vrije INTERNE notities over deze fabriek (prijsstaffels, aanbetalingen, ervaringen). Dit veld is de reden dat deze tabel bestaat: het is nooit klantgerichte tekst.';
comment on column factory_private.contact_name is
  'Naam van de vaste contactpersoon bij deze fabriek. Leeg = het dossierblok in de rail toont de lege staat, geen verzonnen naam.';
comment on column factory_private.contact_role is
  'Functie van de contactpersoon, bv. Sales manager.';
comment on column factory_private.contact_email is
  'E-mailadres van de contactpersoon. INTERN: de klant hoort niet rechtstreeks met de fabriek te mailen, en de fabriek weet niet wie de klant is.';
comment on column factory_private.contact_phone is
  'Telefoonnummer van de contactpersoon. INTERN, zelfde reden als contact_email.';
comment on column factory_private.contact_avatar_url is
  'Verwijzing naar de foto van de contactpersoon, zelfde opslag als factories_partners.photo_url. Leeg = initialen; dat is een variant, geen gebrek.';
comment on column factory_private.quality_score is
  'Kwaliteitsoordeel van de eigenaar, 1 t/m 5. NULL = nog niet beoordeeld; de UI toont dan vijf lege stippen en NOOIT een verzonnen cijfer. INTERN: een rapportcijfer over een leverancier is niets voor de klant van die leverancier.';
comment on column factory_private.leadtime_score is
  'Doorlooptijdoordeel van de eigenaar, 1 t/m 5. NULL = nog niet beoordeeld, zelfde regel als quality_score.';

alter table factory_private enable row level security;
-- Uitsluitend staff, lezen én schrijven — hetzelfde patroon als
-- admin_contacts, admin_requests en admin_mail_log uit 0005. Eén policy
-- "for all" is genoeg, en dat is meteen de hele bewijsvoering: er bestaat
-- geen enkele policy die een klant ook maar één rij van deze tabel geeft.
drop policy if exists "staff only factory_private" on factory_private;
create policy "staff only factory_private" on factory_private
  for all using (is_staff()) with check (is_staff());

-- GRANTS. Supabase geeft nieuwe tabellen in schema public standaard al
-- rechten aan anon, authenticated en service_role, en dit bestand leunde
-- daar stil op. Als die standaard ooit is bijgesteld, wordt een tabel
-- daardoor stil ONZICHTBAAR in plaats van luidruchtig kapot: een lege lijst
-- leest als "er is niets", niet als "je mag hier niet bij". Daarom staan ze
-- er nu expliciet, in dezelfde vorm als de revoke/grant-paren die 0001 en
-- 0005 om hun functies zetten.
-- Let op wat een grant WEL en NIET doet: hij opent de deur van de tabel,
-- de policy hierboven bepaalt wie er doorheen mag. `to authenticated`
-- betekent hier dus niet dat elke ingelogde gebruiker meeleest — de enige
-- policy is is_staff(), en de staf zit ook in authenticated. anon heeft hier
-- helemaal niets te zoeken en verliest zijn standaardrechten.
revoke all on table factory_private from anon;
grant select, insert, update, delete on table factory_private to authenticated;
grant select, insert, update, delete on table factory_private to service_role;

-- ---- A4: verhuizing van wie de vorige versie al had gedraaid ----
-- Op een database die dit bestand voor het eerst ziet is dit blok een
-- no-op: de acht kolommen staan niet op factories_partners, dus er is
-- niets te verhuizen en niets te droppen.
-- Wie de vorige versie WEL had gedraaid, kan er al notities of scores in
-- hebben staan. Die gaan eerst mee naar factory_private en pas daarna gaan
-- de kolommen weg — nooit andersom.
--
-- IDEMPOTENT op twee manieren tegelijk:
--   · de tweede run vindt de kolommen niet meer en doet niets;
--   · zou hij ze door een half afgebroken eerste run tóch nog vinden, dan
--     wint bij een botsing altijd de waarde die AL in factory_private
--     staat. De verhuizing vult dus alleen lege plekken op en overschrijft
--     nooit iets wat de eigenaar er intussen zelf in heeft gezet.
-- De where-voorwaarde slaat fabrieken over waar alle acht velden leeg zijn:
-- een lege rij in factory_private zegt niets en zou de tabel alleen maar
-- vullen met ruis.
do $$
declare
  v_kandidaten text[] := array['notes','contact_name','contact_role','contact_email',
                               'contact_phone','contact_avatar_url',
                               'quality_score','leadtime_score'];
  v_oud   text[] := '{}';   -- de kolommen die er op dit moment ECHT nog staan
  v_doel  text;             -- kolomlijst voor de insert
  v_bron  text;             -- selectlijst uit factories_partners
  v_waar  text;             -- "is er überhaupt iets ingevuld"
  v_bij   text;             -- de do update-tak: bestaande waarde wint
  k       text;
begin
  foreach k in array v_kandidaten loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name   = 'factories_partners'
         and column_name  = k
    ) then
      v_oud := v_oud || k;
    end if;
  end loop;

  if array_length(v_oud, 1) is null then
    raise notice 'factory_private: niets te verhuizen — de interne kolommen staan niet (meer) op factories_partners.';
    return;
  end if;

  -- Alles wordt met format() gebouwd en niet met losse aanhalingstekens aan
  -- elkaar geplakt: %I citeert een kolomnaam, %L een waarde. Dat scheelt het
  -- tellen van geneste quotes, en dat tellen is precies waar zulke blokken
  -- stukgaan.
  select
    string_agg(format('%I', kol), ', ' order by nr),
    string_agg(format('f.%I', kol), ', ' order by nr),
    string_agg(
      case when kol in ('quality_score','leadtime_score')
           then format('f.%I is not null', kol)
           else format('coalesce(btrim(f.%1$I), %2$L) <> %2$L', kol, '')
      end, ' or ' order by nr),
    string_agg(
      case when kol in ('quality_score','leadtime_score')
           then format('%1$I = coalesce(factory_private.%1$I, excluded.%1$I)', kol)
           else format('%1$I = case when coalesce(btrim(factory_private.%1$I), %2$L) <> %2$L'
                       || ' then factory_private.%1$I else excluded.%1$I end', kol, '')
      end, ', ' order by nr)
    into v_doel, v_bron, v_waar, v_bij
    from unnest(v_oud) with ordinality as t(kol, nr);

  execute format(
    'insert into factory_private (factory_id, %s)
     select f.id, %s
       from factories_partners f
      where (%s)
     on conflict (factory_id) do update set %s',
    v_doel, v_bron, v_waar, v_bij);

  raise notice 'factory_private: % interne kolom(men) verhuisd vanaf factories_partners.', array_length(v_oud, 1);

  -- Pas nu weg. "if exists" zodat dit ook een tweede keer kan draaien, en
  -- bewust ZONDER cascade: hangt er tegen de verwachting in toch nog iets
  -- aan zo'n kolom (een view, een index), dan hoort deze migratie luid te
  -- stoppen en niet stilletjes dat andere object mee te slopen.
  foreach k in array v_oud loop
    execute format('alter table factories_partners drop column if exists %I', k);
  end loop;
end $$;


-- ------------------------------------------------------------
-- BLOK B — FABRIEK AAN PROJECT
-- Vandaag wordt "welke fabriek maakt dit project" AFGELEID: het beheer
-- kijkt naar media_assets.factory_id van de foto's van het project en naar
-- file_disclosures.factory_id van de NNN-vastleggingen. Dat werkt alleen
-- zodra er een foto of een vastlegging is, en het werkt niet in de fase
-- sourcing waarin je juist wilt vastleggen wie het gaat maken.
-- projects.factory_id maakt er een echt veld van. De afleiding blijft in
-- de code staan als TERUGVAL voor oude rijen: is factory_id leeg, dan telt
-- de meest voorkomende factory_id op de foto's en de vastleggingen van het
-- project. Die afleiding mag dus NIET weg — bestaande projecten hebben het
-- nieuwe veld nog niet.
-- on delete set null: een fabriek verwijderen mag NOOIT een project
-- meenemen.
--
-- ELKE PLEK DIE OVER DEZE RELATIE GAAT MOET NU DRIE BRONNEN KENNEN
-- Er zijn na dit blok drie manieren waarop een fabriek aan een project
-- hangt: projects.factory_id (het echte veld), media_assets.factory_id en
-- file_disclosures.factory_id (de afleiding). Wie er één vergeet, laat een
-- fabriek onzichtbaar worden precies in de fase waarvoor het nieuwe veld
-- bedoeld is. De stand per plek, nagelopen bij het schrijven van deze
-- migratie:
--   · portal/admin-data.js — verrijkFabrieken() en factoryIdOf() nemen het
--     veld mee en vallen terug op de afleiding. In orde.
--   · deze migratie / SQL — er leunt na blok A geen enkele policy of helper
--     meer op deze relatie. client_sees_factory() was de enige die dat deed
--     en die is weg, omdat factories_partners niets vertrouwelijks meer
--     bevat om achter te houden. Hier valt dus niets te repareren, en dat
--     is de bedoeling: hoe minder plekken deze relatie kennen, hoe minder
--     er uit de pas kan gaan lopen.
--   · portal.html — renderFactoryMap() bouwt zijn lijst "welke fabrieken
--     horen bij mij" NOG STEEDS uit alleen BUNDLE.media en
--     BUNDLE.disclosures. Een fabriek die uitsluitend via het nieuwe
--     projects.factory_id gekoppeld is, krijgt daardoor geen kaartpin bij
--     de klant. Dat bestand valt buiten deze migratie en moet in dezelfde
--     beurt de factory_id van de eigen projecten aan die lijst toevoegen,
--     NAAST de twee bestaande bronnen.
-- ------------------------------------------------------------
alter table projects add column if not exists factory_id uuid
  references factories_partners(id) on delete set null;

comment on column projects.factory_id is
  'De fabriek die dit project maakt. NULL = nog niet gekozen; het beheer valt dan terug op de oude afleiding via media_assets.factory_id. on delete set null, zodat een verwijderde fabriek het project laat staan.';

create index if not exists projects_factory_idx on projects (factory_id);


-- ------------------------------------------------------------
-- BLOK D — PROJECTVELDEN
-- De mockup toont bij een project een echte deadline, een categorie en een
-- projectleider met avatar. Geen van drieën bestond.
--
-- WAAROM EEN ECHTE DEADLINE NAAST DE ZES BESTAANDE DATUMS: het beheer
-- projecteert vandaag een "eerstvolgende datum" uit etaWindowEnd,
-- answerDeadline, invoiceDue, remindAt en scheduledAt. Dat is eerlijk maar
-- het is niet wat de eigenaar aan de klant beloofde. deadline is die
-- belofte, met de hand ingevuld, en staat LOS van de zes projecties: de
-- kalender toont ze allebei, met een eigen markering.
-- ------------------------------------------------------------
alter table projects add column if not exists deadline date;
alter table projects add column if not exists category text not null default '';
alter table projects add column if not exists lead text not null default '';

comment on column projects.deadline is
  'De met de hand ingevulde einddatum die aan de klant is beloofd. NULL = geen deadline, en dat blijft leeg: een verzonnen deadline is erger dan geen deadline. Staat los van de zes afgeleide datumprojecties, die blijven bestaan.';
comment on column projects.category is
  'Vrije categorie van het project, bv. Interieur of Outdoor. Bewust geen vaste lijst: de eigenaar bepaalt zelf zijn indeling. Leeg = geen categoriechip op de kaart.';
comment on column projects.lead is
  'Naam van de projectleider, zoals getoond naast de projecttitel. Het beheer laat de eigenaar kiezen uit team_members en schrijft de NAAM weg; de avatar wordt opgezocht door de naam te matchen. Hernoemt iemand zichzelf, dan valt de avatar terug op initialen — geen fout, wel de reden dat een latere migratie hier een harde koppeling (lead_member_id) van kan maken.';


-- ------------------------------------------------------------
-- BLOK E — KLANTVELDEN
-- Scherm 5.5 toont per klant een logo in een ronde tegel, een tagline
-- onder de bedrijfsnaam ("Hervulbare diffusers & interieuritems") en het
-- land. Alleen bedrijfsnaam, contactpersoon, e-mail en telefoon bestonden.
-- ------------------------------------------------------------
alter table clients add column if not exists country text not null default '';
alter table clients add column if not exists tagline text not null default '';
alter table clients add column if not exists logo_url text not null default '';

comment on column clients.country is
  'Land van de klant, vrije tekst. Voedt de landregel op de klantkaart en straks de btw-logica van de factuurmodule; die leest vandaag nog vat_number uit 0006 en verandert hier niet door.';
comment on column clients.tagline is
  'Eén korte regel die zegt wat de klant maakt, bv. "Hervulbare diffusers & interieuritems". Staat onder de bedrijfsnaam op de klantkaart. Leeg = de regel verdwijnt, de kaart blijft uitgelijnd.';
comment on column clients.logo_url is
  'Verwijzing naar het klantlogo (ronde tegel op de klantkaart). Demomodus: sleutel in IndexedDB. Live: pad in de private bucket beheer-intern. Leeg = initialen van de bedrijfsnaam.';


-- ------------------------------------------------------------
-- BLOK C — AVATAR BIJ EEN CONTACTPERSOON
-- admin_contacts (0005, golf 5) is de contactpersonenlijst per klant. Hij
-- had al `role`; de regel hieronder is daarom een bewuste no-op die alleen
-- bestaat zodat dit blok compleet leesbaar is zonder 0005 erbij te pakken.
-- Nieuw is alleen avatar_url.
-- ------------------------------------------------------------
alter table admin_contacts add column if not exists role text not null default '';
alter table admin_contacts add column if not exists avatar_url text not null default '';

comment on column admin_contacts.role is
  'Functie van de contactpersoon, bv. Inkoop of Oprichter. Bestond al sinds 0005 (golf 5); hier alleen herhaald zodat dit blok op zichzelf te lezen is.';
comment on column admin_contacts.avatar_url is
  'Verwijzing naar de foto van de contactpersoon. Demomodus: sleutel in IndexedDB. Live: pad in de private bucket beheer-intern. Leeg = initialen op zwart, precies zoals de mockup het toont voor mensen zonder foto.';


-- ------------------------------------------------------------
-- BLOK F — AANVRAAGVELDEN
-- admin_requests (0005, golf 5) is de inbox voor aanvragen vanaf de
-- CUSTOM+-site. De mockup toont bij een aanvraag ook het land, waar hij
-- vandaan kwam en welke bestanden er meekwamen.
--
-- LET OP voor wie de site-koppeling later maakt: de Netlify-functie die
-- straks met de service-role key in deze tabel schrijft, moet de bestanden
-- in de private bucket beheer-intern zetten en hier alleen de paden
-- opslaan. Nooit de bytes in de kolom.
-- ------------------------------------------------------------
alter table admin_requests add column if not exists country text not null default '';
alter table admin_requests add column if not exists source text not null default '';
alter table admin_requests add column if not exists files jsonb not null default '[]'::jsonb
  check (jsonb_typeof(files) = 'array');

comment on column admin_requests.country is
  'Land van de aanvrager, vrije tekst. Leeg als het formulier er niet naar vroeg.';
comment on column admin_requests.source is
  'Waar de aanvraag vandaan kwam, vrije tekst: site-formulier, LinkedIn, doorverwijzing, beurs. Leeg = onbekend, en dat tonen we ook als onbekend in plaats van iets aan te nemen.';
comment on column admin_requests.files is
  'jsonb-array van meegestuurde bestanden: [{"name":"schets.pdf","path":"aanvragen/<id>/schets.pdf","size":12345,"type":"application/pdf"}]. path verwijst naar de private bucket beheer-intern (of naar IndexedDB in demomodus). Leeg = geen bijlagen.';


-- ------------------------------------------------------------
-- BLOK H — TEAM EN RECHTEN
-- Vandaag is er precies één beheergebruiker (staff_users uit 0001) en geen
-- rollen; hoofdstuk 7 van de mockupspec noemde de categorie "Team &
-- rechten" daarom nog een eerlijke lege regel. Deze tabel maakt er echte
-- gegevens van: wie hoort bij het team, welke rol heeft hij, is hij nog
-- actief, wanneer is hij uitgenodigd en wanneer was hij voor het laatst
-- gezien.
--
-- WAT DEZE TABEL WÉL EN NIET IS.
-- Wél: de ledenlijst die de schermen tonen (avatar, naam, rol, status).
-- Niet: een rechtenmotor. Rol 'lezer' geeft vandaag GEEN afgedwongen
-- beperking op databaseniveau — RLS kent maar één begrip, is_staff(), en
-- iedereen in staff_users mag daar alles. Wie de rollen ook echt wil laten
-- afdwingen, koppelt team_members aan auth.users en vervangt is_staff()
-- door een rolcontrole; dat is bewust géén onderdeel van deze migratie,
-- want half afgedwongen rechten zijn erger dan zichtbaar niet-afgedwongen
-- rechten. De UI moet dat dus ook eerlijk zeggen.
-- ------------------------------------------------------------
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  role text not null default 'medewerker'
    check (role in ('eigenaar','beheerder','medewerker','lezer')),
  status text not null default 'actief'
    check (status in ('actief','uitgenodigd','inactief')),
  avatar_url text not null default '',
  invited_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

-- Uniek per e-mailadres, hoofdletterongevoelig, lege adressen uitgezonderd:
-- een teamlid zonder e-mail (nog niet uitgenodigd) mag bestaan, twee keer
-- hetzelfde adres nooit.
create unique index if not exists team_members_email_uniq
  on team_members (lower(email)) where email <> '';

comment on table team_members is
  'De ledenlijst achter Instellingen → Team & rechten. Toont wie er is en welke rol hij heeft; de rollen worden op databaseniveau nog NIET afgedwongen (RLS kent alleen is_staff()). Zie het commentaarblok bij deze tabel in 0020_beheer_ia.sql.';
comment on column team_members.name is
  'Volledige naam zoals getoond bij de avatar. Leeg = de UI toont het e-mailadres.';
comment on column team_members.email is
  'E-mailadres, uniek en hoofdletterongevoelig via team_members_email_uniq. Mag leeg zijn zolang iemand nog niet is uitgenodigd.';
comment on column team_members.role is
  'eigenaar | beheerder | medewerker | lezer. Vandaag puur informatief: de rol staat in de UI maar RLS dwingt hem niet af.';
comment on column team_members.status is
  'actief | uitgenodigd | inactief. uitgenodigd hoort bij een gevulde invited_at; inactief houdt de rij (en dus de geschiedenis) heel zonder hem in de lijst te tellen.';
comment on column team_members.avatar_url is
  'Verwijzing naar de profielfoto. Demomodus: sleutel in IndexedDB. Live: pad in de private bucket beheer-intern. Leeg = initialen op zwart.';
comment on column team_members.invited_at is
  'Moment waarop de uitnodiging is verstuurd. NULL = nooit uitgenodigd; de UI toont dan een streepje en niet "onbekend".';
comment on column team_members.last_seen_at is
  'Laatst geziene moment, door het beheer bijgewerkt. NULL = nog nooit gezien. Wordt NIET automatisch gevuld zolang team_members niet aan auth.users hangt — de UI moet dus geen aanwezigheid suggereren die we niet meten.';

alter table team_members enable row level security;
-- Uitsluitend staff, lezen én schrijven: de portal raakt deze tabel nooit
-- aan en een klant heeft niets te maken met de personeelslijst. Eén policy
-- "for all" is hier voldoende en volgt het patroon van admin_contacts,
-- admin_requests en admin_mail_log uit 0005.
drop policy if exists "staff only team_members" on team_members;
create policy "staff only team_members" on team_members
  for all using (is_staff()) with check (is_staff());

-- Grants expliciet, om dezelfde reden als bij factory_private: leunen op de
-- standaardrechten van het project maakt van een aangepaste standaard een
-- STILLE lege lijst in plaats van een zichtbare fout. De policy hierboven
-- doet het eigenlijke werk; deze regels openen alleen de tabel.
revoke all on table team_members from anon;
grant select, insert, update, delete on table team_members to authenticated;
grant select, insert, update, delete on table team_members to service_role;

-- Seed: de bestaande beheergebruiker(s) uit staff_users, met het adres uit
-- auth.users. De oudste staff-rij wordt 'eigenaar', eventuele latere rijen
-- 'beheerder' — nooit twee eigenaren, en nooit een verzonnen naam: die
-- komt uit de metadata van het account en valt anders terug op het deel
-- vóór de @ van het e-mailadres.
-- Idempotent: een adres dat al in team_members staat wordt overgeslagen,
-- dus een teamlid dat de eigenaar later bewerkt of van rol verandert blijft
-- bij een tweede run ongemoeid.
-- Heeft een staff-rij geen e-mailadres in auth.users, dan slaan we hem
-- over: liever een leeg teamscherm dan een halve rij die niemand kan
-- thuisbrengen.
--
-- De rangschikking gebeurt in een eigen CTE en NIET in de insert-select
-- eronder. Dat is geen stijl maar noodzaak: een window-functie wordt pas ná
-- de where-clausule berekend, dus als de eigenaar al in team_members stond
-- zou de eerstvolgende staff-rij rang 1 krijgen en er een TWEEDE eigenaar
-- bij komen. Nu telt de rang over alle staff-rijen, en de extra check
-- "is er al een eigenaar" sluit het definitief af.
with staf as (
  select
    u.email as email,
    coalesce(
      nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'name'), ''),
      split_part(u.email, '@', 1)
    ) as naam,
    u.last_sign_in_at as gezien,
    row_number() over (order by s.created_at, s.user_id) as rang
  from staff_users s
  join auth.users u on u.id = s.user_id
  where coalesce(btrim(u.email), '') <> ''
)
insert into team_members (name, email, role, status, last_seen_at)
select
  staf.naam,
  staf.email,
  case
    when staf.rang = 1
     and not exists (select 1 from team_members tm2 where tm2.role = 'eigenaar')
    then 'eigenaar'
    else 'beheerder'
  end,
  'actief',
  staf.gezien
from staf
where not exists (
  select 1 from team_members tm where lower(tm.email) = lower(staf.email)
);


-- ------------------------------------------------------------
-- BLOK G — GESPREKSDRAAD
-- Een klantvraag was tot nu toe ÉÉN vraag met ÉÉN antwoord: de kolommen
-- question, answer, asked_at en answered_at op question_threads. De mockup
-- (scherm 5.2, component 4.12) toont een echte draad met meerdere beurten,
-- elk met een afzender en een tijdstip.
--
-- question_threads blijft ongewijzigd bestaan — daar wordt niets uit
-- weggegooid en geen kolom van aangeraakt. De draad komt ernaast te staan,
-- en de datamigratie onderaan dit blok zet de bestaande vraag en het
-- bestaande antwoord om in de eerste twee berichten, MET HUN ECHTE
-- TIJDSTEMPELS. Zo mist de nieuwe weergave geen enkel gesprek.
-- ------------------------------------------------------------
create table if not exists question_messages (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references question_threads(id) on delete cascade,
  author text not null check (author in ('client','staff')),
  author_name text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

comment on table question_messages is
  'De berichten binnen één klantvraag: de gespreksdraad uit de Inbox. Hangt met on delete cascade aan question_threads — een verwijderde vraag laat geen zwevende berichten achter.';
comment on column question_messages.question_id is
  'De vraag (question_threads) waar dit bericht bij hoort. on delete cascade.';
comment on column question_messages.author is
  'client | staff. DIT veld bepaalt hoe het bericht wordt weergegeven (links/rechts, welke avatar) — nooit author_name, want dat is vrije tekst.';
comment on column question_messages.author_name is
  'Naam zoals getoond boven het bericht. Puur cosmetisch: de RLS-policy hieronder staat een klant alleen zijn eigen naam of bedrijfsnaam toe, en de weergave leunt sowieso op author.';
comment on column question_messages.body is
  'De tekst van het bericht. Platte tekst; het beheer rendert nooit ruwe HTML.';
comment on column question_messages.created_at is
  'Tijdstip van het bericht. De datamigratie hieronder zet hier de ECHTE asked_at/answered_at van de oude rij in, niet now().';

create index if not exists question_messages_thread_idx
  on question_messages (question_id, created_at);

-- Wie hoort bij deze vraag? Zelfde security-definer-patroon als
-- owns_project() uit 0001, één niveau dieper: van een bericht naar zijn
-- vraag, naar het project, naar de klant.
create or replace function owns_question(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from question_threads qt
      join projects pr on pr.id = qt.project_id
      join clients  c  on c.id  = pr.client_id
     where qt.id = q and c.auth_user_id = auth.uid()
  );
$$;
revoke all on function owns_question(uuid) from public;
grant execute on function owns_question(uuid) to authenticated;

comment on function owns_question(uuid) is
  'Waar zodra de aanroeper de klant is van het project waar deze vraag bij hoort. Security definer, zodat de policy niet afhangt van de leesrechten op question_threads zelf.';

alter table question_messages enable row level security;

-- LEZEN: de klant leest de berichten van zijn eigen vragen (hij moet het
-- antwoord immers kunnen zien), staff leest alles.
drop policy if exists "client reads own question_messages" on question_messages;
create policy "client reads own question_messages" on question_messages
  for select using (owns_question(question_id) or is_staff());

-- SCHRIJVEN DOOR DE KLANT: één insert-policy die vier dingen tegelijk
-- afdwingt, want elk ervan alleen is te weinig. De eerste drie gaan over
-- WIE er iets zegt, de vierde over WANNEER.
--   1. owns_question(question_id) — nooit in de draad van een ander. Zonder
--      dit zou een klant met een geraden id in andermans gesprek kunnen
--      typen.
--   2. author = 'client' — een klant kan NOOIT een bericht plaatsen dat
--      zich als staff voordoet. Dit is de belangrijkste regel van dit hele
--      bestand: zonder deze check kan iemand zichzelf een antwoord van
--      CUSTOM+ geven en dat later als toezegging tonen.
--   3. author_name mag leeg zijn of moet zijn eigen contactpersoon- of
--      bedrijfsnaam zijn. Anders kan hij weliswaar geen author='staff'
--      zetten, maar wél "Steffan Bakker" boven zijn eigen bericht.
--   4. created_at moet ROND NU liggen. Zonder deze regel regelde de policy
--      wel WIE er iets zegt maar niet WANNEER, en PostgREST laat de client
--      die kolom gewoon meesturen. Een klant kon dus een bericht met een
--      zelfgekozen tijdstempel plaatsen en daarmee de VOLGORDE van het
--      gesprek herschrijven: een bezwaar dateren op een moment vóór jouw
--      antwoord, zodat het achteraf lijkt alsof je het gelezen had en toch
--      doorging. De draad wordt op created_at gesorteerd, dus dat is geen
--      cosmetisch verschil maar een ander verhaal.
--      WAAROM HET VENSTER NIET NUL KAN ZIJN: de veiligste aanroep is de
--      kolom helemaal weglaten — dan vult de default now() van de SERVER
--      hem. Stuurt de client hem wél mee, dan komt de waarde van de klok
--      van zijn eigen apparaat, en die loopt zelden precies gelijk met de
--      databaseserver; een paar seconden verschil is doodnormaal en een
--      exacte gelijkheidseis zou dus gewone berichten weigeren. Vijf
--      minuten achteruit vangt dat ruim op en is te kort om een gesprek
--      mee te herordenen.
--      Vooruit is er GEEN speling: een tijdstempel in de toekomst heeft
--      geen enkel eerlijk gebruik, en zou een bericht permanent onderaan
--      de draad parkeren. Loopt de klok van een klant vóór, dan wordt zijn
--      insert geweigerd; de oplossing is dan de kolom weglaten, niet het
--      venster oprekken.
-- Er is bewust GEEN update- of delete-policy voor de klant: een verstuurd
-- bericht in een gesprek hoort niet achteraf te veranderen. Zonder policy
-- kan het niet, dat is de veilige kant.
drop policy if exists "client posts own question_messages" on question_messages;
create policy "client posts own question_messages" on question_messages
  for insert with check (
    owns_question(question_id)
    and author = 'client'
    and (
      author_name = ''
      or exists (
        select 1 from clients c
         where c.auth_user_id = auth.uid()
           and author_name in (c.contact_name, c.company)
      )
    )
    and created_at > now() - interval '5 minutes'
    and created_at <= now()
  );

-- STAFF: alles, volgens het bestaande patroon uit 0001/0005.
drop policy if exists "staff writes question_messages" on question_messages;
create policy "staff writes question_messages" on question_messages
  for all using (is_staff()) with check (is_staff());

-- Grants expliciet, zelfde reden als bij factory_private en team_members.
-- Dit is de enige nieuwe tabel waar de KLANT echt bij moet: hij leest zijn
-- eigen draad en plaatst er berichten in. update en delete staan er ook bij,
-- want de staf heeft ze nodig — de klant komt er niet aan, want voor hem
-- bestaat er geen enkele update- of delete-policy. Ook hier geldt: de grant
-- opent de deur van de tabel, de policies hierboven bepalen wie er doorheen
-- mag en naar welke rijen.
revoke all on table question_messages from anon;
grant select, insert, update, delete on table question_messages to authenticated;
grant select, insert, update, delete on table question_messages to service_role;

-- ---- datamigratie: bestaande vraag + antwoord worden de eerste berichten
-- Idempotent doordat de hele insert wordt overgeslagen voor elke vraag die
-- al minstens één bericht heeft. Beide regels (vraag én antwoord) worden in
-- ÉÉN statement ingevoegd en zien dus dezelfde momentopname van de tabel:
-- de tweede regel wordt niet geblokkeerd door de eerste. Twee keer draaien
-- levert daarom nooit dubbele berichten op, en een draad waar later echt in
-- is doorgepraat wordt met rust gelaten.
-- Lege vragen of lege antwoorden worden overgeslagen — een leeg bericht is
-- geen beurt in een gesprek.
-- De tijdstempels komen uit de bestaande rij; alleen als answered_at
-- ontbreekt terwijl er wél een antwoord staat (dat komt voor bij rijen van
-- vóór 0005) valt het antwoord terug op asked_at, zodat de volgorde klopt.
-- Die oude tijdstempels liggen ver buiten het venster van vijf minuten uit
-- de insert-policy hierboven, en dat is geen probleem: policies gelden voor
-- de aanroepende rol, en dit bestand draai je in de SQL-editor als eigenaar
-- van de tabellen. Op een eigenaar is RLS niet van toepassing (er staat
-- nergens "force row level security"). De policy bewaakt de REST API, niet
-- deze migratie.
with te_migreren as (
  select
    qt.id                                                       as question_id,
    'client'::text                                              as author,
    coalesce(nullif(btrim(c.contact_name), ''), '')             as author_name,
    qt.question                                                 as body,
    qt.asked_at                                                 as created_at,
    1                                                           as volgorde
  from question_threads qt
  left join projects pr on pr.id = qt.project_id
  left join clients  c  on c.id  = pr.client_id
  where coalesce(btrim(qt.question), '') <> ''
  union all
  select
    qt.id,
    'staff'::text,
    coalesce((
      select tm.name from team_members tm
       where tm.role = 'eigenaar' and tm.name <> ''
       order by tm.created_at limit 1
    ), ''),
    qt.answer,
    coalesce(qt.answered_at, qt.asked_at),
    2
  from question_threads qt
  where coalesce(btrim(qt.answer), '') <> ''
)
insert into question_messages (question_id, author, author_name, body, created_at)
select t.question_id, t.author, t.author_name, t.body, t.created_at
  from te_migreren t
 where not exists (
   select 1 from question_messages m where m.question_id = t.question_id
 )
 order by t.question_id, t.volgorde;


-- ------------------------------------------------------------
-- BLOK I+J — INSTELLINGEN (werkdruk, bewaartermijn, back-up)
-- Geen nieuwe tabel: dit zijn drie rijen in het bestaande admin_settings
-- uit 0005. De sleutels staan in snake_case, precies zoals de rest
-- ('stilte_drempel_dagen', 'factuur_reeks'); de datalaag van beheer.html
-- vertaalt ze automatisch heen en weer naar camelCase, dus in JavaScript
-- heten ze settings.capacityPerWeekday, settings.retentionDays en
-- settings.lastBackupAt.
--
-- Alle drie met "on conflict do nothing": een tweede run overschrijft nooit
-- wat de eigenaar zelf heeft ingesteld.
--
-- I — WERKDRUK ("Operaties deze week", scherm 5.1).
-- De mockup toont capaciteit, bezetting en overbelasting. Wij hebben geen
-- fabriekscapaciteit en gaan die ook niet verzinnen. Wat we WEL eerlijk
-- kunnen meten is werkdruk:
--   capaciteit    = wat jij hier per weekdag invult (hoeveel acties je op
--                   zo'n dag aankunt);
--   bezetting     = het ECHTE aantal acties dat op die dag valt volgens de
--                   bestaande zes datumprojecties;
--   overbelasting = het deel van de bezetting boven de capaciteit.
-- De legenda in de UI moet dit dan ook "werkdruk" noemen, niet
-- "bezettingsgraad".
--
-- De waarde is met opzet een OBJECT met Nederlandse dagafkortingen en geen
-- array van zeven: bij een array is het onvermijdelijk dat de een index 0
-- als zondag leest (JavaScript getDay) en de ander als maandag (de
-- kalender loopt ma t/m zo), en die verwarring is stil en onvindbaar.
-- Default: zes acties per werkdag, nul in het weekend — een verdedigbaar
-- startpunt voor een eenmanszaak, dat de eigenaar in Instellingen bijstelt.
-- ------------------------------------------------------------
insert into admin_settings (key, value)
values ('capacity_per_weekday',
        '{"ma":6,"di":6,"wo":6,"do":6,"vr":6,"za":0,"zo":0}'::jsonb)
on conflict (key) do nothing;

-- J — BEWAARTERMIJN VAN DE PRULLENBAK.
-- admin_trash (0005, golf 2) wordt vandaag opgeruimd met een venster van
-- zeven dagen dat op vier plekken in beheer.html hardgecodeerd staat. Dit
-- wordt de instelling; de default is exact de huidige waarde, zodat er
-- door het draaien van deze migratie niets van gedrag verandert.
insert into admin_settings (key, value)
values ('retention_days', to_jsonb(7))
on conflict (key) do nothing;

-- J — LAATSTE BACK-UP.
-- 'null' is hier een JSON-null (geen SQL NULL, de kolom is not null): de
-- sleutel bestaat alvast zodat het scherm hem kan tonen, en de waarde is
-- eerlijk leeg tot de eigenaar echt een back-up maakt. Het beheer schrijft
-- er dan een ISO-tijdstempel in.
-- WAT WE HIER NIET DOEN: een versleutelingsclaim. De kaart "Back-up & data"
-- toont alleen wat waar is per modus — demomodus = alles staat in deze
-- browser (localStorage + IndexedDB), live modus = alles staat in Supabase.
-- Een verzonnen beveiligingsbelofte is erger dan een lege kaart.
insert into admin_settings (key, value)
values ('last_backup_at', 'null'::jsonb)
on conflict (key) do nothing;


-- ------------------------------------------------------------
-- WAT DEZE MIGRATIE BEWUST NIET DOET
--   · Geen bestaande gegevens weggegooid en niets hernoemd.
--     question_threads.question en .answer blijven staan en blijven gevuld;
--     de gespreksdraad staat ernaast. Wie ooit de oude kolommen wil
--     opruimen, doet dat pas als elk scherm question_messages leest — en
--     dan in een eigen migratie, niet hier.
--     De ENIGE uitzondering staat in blok A4 en is geen uitzondering op die
--     regel maar een verhuizing: had een eerdere versie van dit bestand de
--     acht interne fabriekskolommen al op factories_partners gezet, dan gaat
--     hun inhoud eerst naar factory_private en pas daarna gaan de kolommen
--     weg. Op een database die dit bestand voor het eerst ziet gebeurt er
--     helemaal niets.
--   · Geen rollenmotor. team_members toont rollen, RLS dwingt ze niet af.
--   · Geen fabriekscapaciteit, geen bezettingsgraad, geen score die wij
--     invullen: elk getal in de nieuwe schermen komt uit iets dat de
--     eigenaar zelf heeft ingevoerd of uit een bestaande rij.
--   · Geen storage-buckets aangemaakt — dat gaat in het Supabase-dashboard.
--     De private bucket `beheer-intern` (uit 0012) is de plek voor alle
--     foto's, logo's en avatars uit deze migratie; bestaat hij niet, dan
--     mislukt alleen het uploaden en blijven de initialen staan.
-- ------------------------------------------------------------
