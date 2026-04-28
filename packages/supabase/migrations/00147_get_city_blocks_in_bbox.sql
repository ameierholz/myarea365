-- ════════════════════════════════════════════════════════════════════
-- get_city_blocks_in_bbox — alle Blocks im Sichtbereich für Placement-UI
-- ════════════════════════════════════════════════════════════════════
-- Gegenstück zu get_crew_blocks_in_bbox (das nur kontrollierte zeigt).
-- Diese hier liefert ALLE Blocks unabhängig von Crew-Kontrolle —
-- wird beim Placement-Mode gebraucht um Straßen-Grenzen zu zeichnen.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.get_city_blocks_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(
  block_id bigint,
  area_m2 double precision,
  street_class text,
  geojson jsonb
) language sql stable as $$
  select
    cb.id as block_id,
    cb.area_m2,
    cb.street_class,
    ST_AsGeoJSON(cb.geom)::jsonb as geojson
  from public.city_blocks cb
  where cb.geom && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
  limit 2000;
$$;
grant execute on function public.get_city_blocks_in_bbox(double precision, double precision, double precision, double precision) to authenticated;
