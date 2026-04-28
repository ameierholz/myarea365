-- ════════════════════════════════════════════════════════════════════
-- Realistic Turf-Größen — kleinere Block-Counts + engerer Fallback
-- ════════════════════════════════════════════════════════════════════
-- User-Feedback: Turf wirkt zu groß und zu weit weg vom HQ.
-- Anpassungen:
--   1. HQ: 1 + 3 Nachbarn (statt 1 + 8) → 4 Blocks total
--   2. Mega: 1 + 1 Nachbar (statt 1 + 3)
--   3. Standard: 1 (unverändert)
--   4. _block_id_at Fallback 1500m → 300m (HQ in Park = nähe Block)
-- Recompute danach für alle bestehenden Repeater.
-- ════════════════════════════════════════════════════════════════════

create or replace function public._repeater_block_count_for_kind(p_kind text)
returns int language sql immutable as $$
  select case p_kind
    when 'hq'       then 4
    when 'mega'     then 2
    when 'repeater' then 1
    else 1
  end;
$$;

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

  -- Fallback: nächster Block-Centroid innerhalb 300m
  -- (war 1500m — viel zu großzügig, hat Turf weit weg vom HQ produziert)
  select id into v_id
    from public.city_blocks
   where ST_DWithin(centroid::geography,
                    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
                    300)
   order by ST_Distance(centroid::geography,
                        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
   limit 1;
  return v_id;
end $$;

-- Recompute alle bestehenden Repeater-Claims mit neuen Werten
do $$ declare r record;
begin
  for r in select id from public.crew_repeaters where destroyed_at is null loop
    perform public.recompute_repeater_block_claims(r.id);
  end loop;
end $$;
