-- ────────────────────────────────────────────────────────────────────────────
-- 00305 — base_buildings.level CHECK lockern: 0 erlaubt (= "wird gerade gebaut")
-- ────────────────────────────────────────────────────────────────────────────
-- start_building() (Mig 00079) inserted Level=0 + status='building' für ein
-- frisches Gebäude. Der ursprüngliche CHECK `level between 1 and 30` hat das
-- abgelehnt → "violates check constraint base_buildings_level_check".
-- Lockerung auf [0, 30]: Level 0 = im Bau, finish_building() bumpt auf 1.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.base_buildings
  drop constraint if exists base_buildings_level_check;

alter table public.base_buildings
  add constraint base_buildings_level_check
  check (level between 0 and 30);
