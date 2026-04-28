-- ════════════════════════════════════════════════════════════════════
-- Bugfix: _block_id_at mit Nearest-Fallback
-- ════════════════════════════════════════════════════════════════════
-- Wenn ein Repeater in einer Park-/Wiesen-Fläche steht (nicht von
-- klassifizierten Straßen umrandet) findet ST_Contains keinen Block →
-- recompute_repeater_block_claims setzt 0 Claims → Karte zeigt Kreis-Fallback.
-- Lösung: bei No-Hit den nächsten Block-Centroid innerhalb 200m nehmen.
-- ════════════════════════════════════════════════════════════════════

create or replace function public._block_id_at(p_lat double precision, p_lng double precision)
returns bigint language plpgsql stable as $$
declare
  v_id bigint;
begin
  -- Step 1: exakter Treffer (Punkt liegt in Block-Polygon)
  select id into v_id
    from public.city_blocks
   where ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
   limit 1;
  if v_id is not null then return v_id; end if;

  -- Step 2: Fallback — nächster Block via Centroid-Distanz innerhalb 200m
  select id into v_id
    from public.city_blocks
   where ST_DWithin(centroid::geography,
                    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                    200)
   order by ST_Distance(centroid::geography,
                        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
   limit 1;
  return v_id;
end $$;

-- Recompute für alle bestehenden lebenden Repeater (one-shot)
do $$
declare r record;
begin
  for r in select id from public.crew_repeaters where destroyed_at is null loop
    perform public.recompute_repeater_block_claims(r.id);
  end loop;
end $$;
