-- ════════════════════════════════════════════════════════════════════
-- Block-Claim Radius-basiert — alle Straßen-Blocks im Umkreis
-- ════════════════════════════════════════════════════════════════════
-- Schluss mit "1 Home + N Nachbarn" — claimt jetzt schlicht ALLE
-- city_blocks deren Centroid in radius_m Luftlinie vom Repeater liegt.
-- Plus: ignoriert street_class=NULL Blocks (Parks/Wiesen) → sauberer Turf.
-- Per Kind:
--   HQ        = 500 m
--   Mega      = 350 m
--   Standard  = 200 m
-- ════════════════════════════════════════════════════════════════════

create or replace function public.recompute_repeater_block_claims(p_repeater_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_repeater record;
  v_radius int;
  v_inserted int := 0;
begin
  delete from public.repeater_block_claims where repeater_id = p_repeater_id;

  select id, kind, hp, lat, lng, destroyed_at
    into v_repeater
    from public.crew_repeaters where id = p_repeater_id;
  if v_repeater is null or v_repeater.destroyed_at is not null then
    return jsonb_build_object('ok', true, 'inserted', 0, 'reason', 'destroyed_or_missing');
  end if;

  v_radius := public._repeater_turf_radius_for_kind(v_repeater.kind);

  insert into public.repeater_block_claims (repeater_id, block_id, influence)
    select p_repeater_id, cb.id, v_repeater.hp
      from public.city_blocks cb
     where ST_DWithin(
             cb.centroid::geography,
             ST_SetSRID(ST_MakePoint(v_repeater.lng, v_repeater.lat), 4326)::geography,
             v_radius
           )
       and cb.street_class is not null
       and cb.street_class <> ''
    on conflict do nothing;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('ok', true, 'inserted', v_inserted, 'radius_m', v_radius);
end $$;
grant execute on function public.recompute_repeater_block_claims(uuid) to authenticated;

-- Recompute alle bestehenden Repeater
do $$ declare r record;
begin
  for r in select id from public.crew_repeaters where destroyed_at is null loop
    perform public.recompute_repeater_block_claims(r.id);
  end loop;
end $$;
