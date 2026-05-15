-- 00384_terrain_warehouse_rebalance.sql
-- Rebalance: Warehouse-Terrain-Gather-Bonus von +40% auf +25% reduziert.
-- Grund: +40% war im Live-Test zu stark — Spieler konnten 1 Warenhaus-Spot
-- dauerhaft farmen statt zwischen Terrains zu wechseln. +25% liegt auf einer
-- Linie mit Industrial (+25%), Commercial (+15%) und belohnt Warenhaus-Cluster
-- weiterhin als beste Beute-Zone ohne andere Terrains zu entwerten.

CREATE OR REPLACE FUNCTION public.terrain_modifiers_for_tag(p_tag text)
RETURNS TABLE(speed_mult numeric, gather_mult numeric, regen_mult numeric, class_buffs jsonb)
LANGUAGE plpgsql IMMUTABLE
AS $$
begin
  case p_tag
    when 'industrial' then
      return query select 1.00::numeric, 1.25::numeric, 1.00::numeric,
        '{"siege": {"atk": 1.05}}'::jsonb;
    when 'residential' then
      return query select 1.00::numeric, 1.10::numeric, 1.00::numeric, '{}'::jsonb;
    when 'park' then
      return query select 1.00::numeric, 1.00::numeric, 1.30::numeric,
        '{"marksman": {"crit": 1.10}}'::jsonb;
    when 'forest' then
      return query select 0.95::numeric, 1.00::numeric, 1.25::numeric,
        '{"marksman": {"crit": 1.10}}'::jsonb;
    when 'water' then
      return query select 0.60::numeric, 1.00::numeric, 1.00::numeric,
        '{"cavalry": {"passable": false}}'::jsonb;
    when 'motorway' then
      return query select 1.50::numeric, 1.00::numeric, 1.00::numeric, '{}'::jsonb;
    when 'railway' then
      return query select 1.30::numeric, 1.00::numeric, 1.00::numeric, '{}'::jsonb;
    when 'university' then
      return query select 1.00::numeric, 1.00::numeric, 1.00::numeric,
        '{"aura": {"research_speed": 1.15}}'::jsonb;
    when 'hospital' then
      return query select 1.00::numeric, 1.00::numeric, 1.50::numeric, '{}'::jsonb;
    when 'warehouse' then
      return query select 1.00::numeric, 1.25::numeric, 1.00::numeric, '{}'::jsonb;
    when 'tourism' then
      return query select 1.00::numeric, 1.10::numeric, 1.00::numeric, '{}'::jsonb;
    when 'government' then
      return query select 1.00::numeric, 1.00::numeric, 1.00::numeric,
        '{"boss_spawn": true}'::jsonb;
    when 'commercial' then
      return query select 1.00::numeric, 1.15::numeric, 1.00::numeric, '{}'::jsonb;
    else
      return query select 1.00::numeric, 1.00::numeric, 1.00::numeric, '{}'::jsonb;
  end case;
end $$;

-- Bereits laufende Märsche, die mit dem alten 1.40er Wert gestartet sind, auf 1.25 nachziehen,
-- damit der Spieler nicht den höheren Wert "behält" während die Welt rebalanced ist.
UPDATE public.gather_marches
   SET terrain_gather_mult = 1.25
 WHERE terrain_tag = 'warehouse'
   AND terrain_gather_mult > 1.25
   AND status IN ('marching','gathering');
