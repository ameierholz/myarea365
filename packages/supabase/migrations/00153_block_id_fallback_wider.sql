-- ════════════════════════════════════════════════════════════════════
-- Bugfix: _block_id_at Fallback von 200m auf 1500m erhöhen
-- ════════════════════════════════════════════════════════════════════
-- Bei Test-Setups mit kleinen ETL-BBoxes liegt der nächste Block oft
-- weiter weg als 200m. 1500m ist großzügiger Realismus-Cap (Crew-Member
-- "kontrolliert" den nächsten Straßenzug innerhalb von ~1.5km).
-- ════════════════════════════════════════════════════════════════════

create or replace function public._block_id_at(p_lat double precision, p_lng double precision)
returns bigint language plpgsql stable as $$
declare
  v_id bigint;
begin
  select id into v_id
    from public.city_blocks
   where ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
   limit 1;
  if v_id is not null then return v_id; end if;

  select id into v_id
    from public.city_blocks
   where ST_DWithin(centroid::geography,
                    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                    1500)
   order by ST_Distance(centroid::geography,
                        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
   limit 1;
  return v_id;
end $$;

do $$ declare r record;
begin
  for r in select id from public.crew_repeaters where destroyed_at is null loop
    perform public.recompute_repeater_block_claims(r.id);
  end loop;
end $$;
