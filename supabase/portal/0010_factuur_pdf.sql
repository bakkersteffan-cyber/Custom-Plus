-- ============================================================
-- CUSTOM+ — DE VERSIE-VASTE FACTUUR-PDF
-- Draai dit ná 0009_nummerreeksen.sql.
--
-- HER-UITVOERBAAR: elke kolom is add-column-if-not-exists, elke functie is
-- create-or-replace en elke trigger wordt eerst gedropt. Je kunt dit
-- bestand dus zo vaak draaien als je wilt.
--
-- WAT DIT BESTAND DOET
--   1. zeven kolommen op invoices: waar de PDF staat, hoe hij heet, hoe
--      groot hij is, met WELK SJABLOON en WELKE HUISSTIJL hij is gemaakt,
--      met welke generatorversie en wanneer;
--   2. één trigger die zorgt dat die PDF nooit meer verandert.
--
-- WAAROM DE HUISSTIJL MEE WORDT BEWAARD EN NIET ALLEEN HET SJABLOON
-- Het sjabloon zegt hoe het vel is ingedeeld; de huisstijl (accentkleur,
-- logo, voetregel) zegt hoe het eruitziet. Wie over twee jaar wil kunnen
-- verklaren waarom een factuur uit 2026 er anders uitziet dan een uit
-- 2028, heeft ze allebei nodig. De bytes liggen vast in de opslag, maar
-- deze twee velden maken het uitlegbaar in plaats van alleen aantoonbaar.
--
-- WAAROM DE PDF NIET IN DE DATABASE ZIT
-- Een factuur van drie pagina's is 30 tot 100 kB. Dat kán in een bytea,
-- maar dan gaat elke SELECT * op invoices die bytes meesleuren en groeit
-- elke back-up mee. De bytes horen in de bestandsopslag (bucket
-- project-docs, dezelfde als de gewone documenten); de rij houdt het pad.
--
-- WAT DIT BESTAND NIET DOET
-- Er wordt geen bucket aangemaakt en geen storage-policy gezet. Bucket
-- project-docs bestaat al sinds 0001 (zie de instructie onderaan dat
-- bestand) en de PDF's van facturen landen daar in een submap 'facturen'
-- per project. Ze vallen dus onder exact dezelfde toegangsregels als elk
-- ander projectdocument — een tweede regelset zou alleen maar een tweede
-- plek zijn waar iets fout kan gaan.
-- ============================================================


-- ------------------------------------------------------------
-- 1. DE KOLOMMEN
-- ------------------------------------------------------------
alter table invoices add column if not exists pdf_path text;
alter table invoices add column if not exists pdf_filename text;
alter table invoices add column if not exists pdf_size integer;
alter table invoices add column if not exists pdf_template text;
alter table invoices add column if not exists pdf_template_version integer;
alter table invoices add column if not exists pdf_brand jsonb;
alter table invoices add column if not exists pdf_generator_version text;
alter table invoices add column if not exists pdf_generated_at timestamptz;

comment on column invoices.pdf_path is
  'Pad in bucket project-docs naar de definitieve PDF. Schrijf één keer: zodra dit gevuld is, blokkeert invoices_guard_pdf elke wijziging.';
comment on column invoices.pdf_brand is
  'De huisstijl (accentkleur, logo, logobreedte, voetregel) waarmee deze PDF is gemaakt. Bewaard zodat een latere huisstijlwijziging uitlegbaar blijft; de PDF zelf verandert er hoe dan ook niet van.';

-- Twee facturen mogen nooit naar hetzelfde bestand wijzen: dan zou het
-- vervangen van de ene de andere veranderen. Partieel, want de meeste
-- rijen hebben (nog) geen PDF.
create unique index if not exists invoices_pdf_path_uniq
  on invoices (pdf_path) where pdf_path is not null;


-- ------------------------------------------------------------
-- 2. SCHRIJF ÉÉN KEER
-- De browser bewaakt dit al (DS.attachInvoicePdf weigert een tweede PDF),
-- maar de browser is niet de laatste verdedigingslinie. Een tweede
-- beheertab, een script of een toekomstige serverfunctie moeten op
-- dezelfde muur stuiten. Dit is dezelfde redenering als bij
-- invoices_guard_finalized in 0009: wat de klant heeft gekregen, verandert
-- niet meer.
--
-- BEWUST EEN APARTE TRIGGER, GEEN UITBREIDING VAN invoices_guard_finalized.
-- Wie 0009 opnieuw draait (het bestand is her-uitvoerbaar en dat is de
-- bedoeling) zou anders deze bescherming stilletjes weer weghalen. Twee
-- triggers met twee namen kunnen elkaar niet overschrijven.
--
-- Leegmaken mag wél: een PDF die aantoonbaar nooit in de opslag is beland
-- (mislukte upload, opgeruimde bucket) moet je kunnen opruimen zodat er
-- alsnog een gemaakt kan worden. Dat is het enige toegestane pad, en het
-- is bewust de weg die IETS WEGHAALT in plaats van iets stilletjes
-- vervangt — een halve vervanging kan zo niet ontstaan.
-- ------------------------------------------------------------
create or replace function invoices_guard_pdf() returns trigger
language plpgsql
as $$
begin
  if old.pdf_path is null then
    return new;                       -- nog geen PDF: alles mag
  end if;
  if new.pdf_path is null then
    return new;                       -- expliciet leegmaken mag
  end if;
  if new.pdf_path is distinct from old.pdf_path then
    raise exception
      'Factuur % heeft al een definitieve PDF. Die kan niet worden vervangen — de klant heeft dit bestand gekregen. Maak zo nodig een creditfactuur.',
      coalesce(nullif(old.invoice_number, ''), old.id::text);
  end if;
  if new.pdf_template     is distinct from old.pdf_template
     or new.pdf_template_version is distinct from old.pdf_template_version
     or new.pdf_brand     is distinct from old.pdf_brand
     or new.pdf_size      is distinct from old.pdf_size
     or new.pdf_generated_at is distinct from old.pdf_generated_at then
    raise exception
      'De sjabloon- en huisstijlgegevens van de bewaarde PDF van factuur % liggen vast; ze horen bij het bestand dat er al is.',
      coalesce(nullif(old.invoice_number, ''), old.id::text);
  end if;
  return new;
end $$;

drop trigger if exists invoices_guard_pdf_trg on invoices;
create trigger invoices_guard_pdf_trg
  before update on invoices
  for each row execute function invoices_guard_pdf();


-- ------------------------------------------------------------
-- 3. DE HUISSTIJL ALS INSTELLING
-- De browser bewaart hem als gewone beheerinstelling in admin_settings,
-- net als de nummerreeksen. De SLEUTEL is snake_case (zo schrijft
-- DS.saveSetting hem weg), de velden BINNEN de waarde houden exact de
-- namen die de browser gebruikt — getSettings vertaalt alleen de sleutel,
-- niet de inhoud. Wie hier 'logo_breedte_mm' zou zetten, zou een waarde
-- neerleggen die de browser niet herkent en die stil door de default wordt
-- vervangen.
--
-- Bestaat de sleutel al, dan blijft hij ongemoeid: de eigen keuze van de
-- gebruiker wint altijd van een default.
-- ------------------------------------------------------------
insert into admin_settings (key, value)
values ('factuur_huisstijl', jsonb_build_object(
  'sjabloon', 'standaard',
  'accent', '#1B6E45',
  'logoData', '',
  'logoBreedteMm', 34,
  'voetregel', ''
))
on conflict (key) do nothing;
