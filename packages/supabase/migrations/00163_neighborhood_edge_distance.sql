-- ════════════════════════════════════════════════════════════════════
-- _neighborhood_id_at: Edge-Distanz statt Centroid-Distanz
-- ════════════════════════════════════════════════════════════════════
-- HQ auf Hauptstraße (= Polygon-Grenze) → ST_Contains false. Fallback per
-- Centroid-Distanz pickt evtl. das falsche Polygon (kleines mit nahem
-- Centroid statt großes mit nahem Rand). Jetzt: ST_Distance auf der
-- Polygon-Geometrie selbst → findet das Polygon dessen RAND am nächsten ist.
-- ════════════════════════════════════════════════════════════════════

create or replace function public._neighborhood_id_at(p_lat double precision, p_lng double precision)
returns bigint language plpgsql stable as $$
declare
  v_id bigint;
  v_pt geography := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
begin
  -- Step 1: Punkt liegt direkt im Polygon
  select id into v_id
    from public.neighborhood_blocks
   where ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
   limit 1;
  if v_id is not null then return v_id; end if;

  -- Step 2: Fallback — Polygon dessen Kante am nächsten ist (statt Centroid).
  -- 200m Toleranz reicht für "HQ steht auf der Straße die Grenze ist".
  select id into v_id
    from public.neighborhood_blocks
   where ST_DWithin(geom::geography, v_pt, 200)
   order by ST_Distance(geom::geography, v_pt)
   limit 1;
  return v_id;
end $$;
