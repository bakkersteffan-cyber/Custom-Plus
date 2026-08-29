-- ============================================================
-- CUSTOM+ klantportal — 0003: fabrieksstad (Fabriek op de Kaart)
-- Draai dit ÉÉN keer in de Supabase SQL editor, ná 0002_shipments.sql.
-- Uitgangspunten:
--  * Eén optioneel veld per fabriek: de stad, gekozen uit de vaste
--    presetlijst in portal/config.js (CP_CITY_COORDS). Leeg = geen pin.
--  * Bewust alleen stadsniveau — nooit een adres. Zichtbaarheid in de
--    portal volgt de bestaande media/disclosure-koppeling per project;
--    er verandert niets aan RLS (factories_partners is al leesbaar
--    zonder client-koppeling, namen zijn generiek).
-- ============================================================

alter table factories_partners add column if not exists city text not null default '';
