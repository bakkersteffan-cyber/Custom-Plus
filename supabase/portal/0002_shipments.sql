-- ============================================================
-- CUSTOM+ klantportal — 0002: zendingen (De Reis)
-- Draai dit ÉÉN keer in de Supabase SQL editor, ná 0001_portal_schema.sql.
-- Uitgangspunten:
--  * shipments: één rij per zending (koerier, zeevracht of luchtvracht),
--    met een eerlijk ETA-weekvenster in plaats van een dagbelofte.
--  * shipment_events: één rij per afgevinkte mijlpaal. De sjabloonvolgorde
--    leeft in portal/shipping.js — de database bewaart alleen de feiten.
--  * documents.shipment_id: B/L, paklijst en facturen kunnen aan een
--    zending hangen zodat het archief per jaar compleet blijft.
--  * RLS volgt exact het owns_project/is_staff patroon uit 0001.
-- ============================================================

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null check (type in ('koerier','zeevracht','luchtvracht')),
  carrier_code text not null default '',        -- sleutel in CP_SHIPPING.CARRIERS
  tracking_number text not null default '',
  container_number text not null default '',    -- ISO 6346, check gebeurt clientside
  bl_number text not null default '',
  sample_round_id uuid references sample_rounds(id),
  eta_window_start date,                        -- altijd een WEEKVENSTER, geen dag
  eta_window_end date,
  eta_note text not null default '',
  eta_updated_at timestamptz,                   -- ouder dan 7 dagen? de portal zegt het eerlijk
  delivered_at timestamptz,                     -- gezet zodra mijlpaal 'geleverd' is afgevinkt
  created_at timestamptz not null default now()
);

create table if not exists shipment_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments(id) on delete cascade,
  milestone_key text not null,                  -- bv. 'vertrek_zee', zie portal/shipping.js
  occurred_at date not null,
  location text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);

-- documenten kunnen aan een zending hangen (B/L, paklijst, factuur in het archief)
alter table documents add column if not exists shipment_id uuid references shipments(id);

-- ---------- RLS ----------
alter table shipments enable row level security;
create policy "client reads own shipments" on shipments
  for select using (owns_project(project_id) or is_staff());
create policy "staff writes shipments" on shipments
  for all using (is_staff()) with check (is_staff());

alter table shipment_events enable row level security;
-- events hangen via de zending aan een project; de klant leest uitsluitend
-- events van zendingen binnen zijn eigen projecten
create policy "client reads own shipment events" on shipment_events
  for select using (
    is_staff() or exists (
      select 1 from shipments s
      where s.id = shipment_events.shipment_id
        and owns_project(s.project_id)
    )
  );
create policy "staff writes shipment events" on shipment_events
  for all using (is_staff()) with check (is_staff());
