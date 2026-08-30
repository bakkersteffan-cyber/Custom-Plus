-- ============================================================
-- CUSTOM+ klantportal — 0004: koppelaars ("Hoort bij")
-- Draai dit ÉÉN keer in de Supabase SQL editor, ná 0002_shipments.sql.
-- Uitgangspunten:
--  * documents.shipment_id bestaat al sinds 0002 (B/L en paklijst aan
--    een zending); dit bestand voegt de omgekeerde koppeling toe:
--    een factuur kan naar haar factuurdocument wijzen, zodat de portal
--    bij een betaalmoment direct de bijbehorende download toont.
--  * Geen nieuwe RLS nodig: invoices en documents hebben al policies,
--    en de kolom verwijst alleen — de klant leest het document zelf
--    via de bestaande documents-policy van zijn eigen project.
-- ============================================================

alter table invoices add column if not exists document_id uuid references documents(id);
