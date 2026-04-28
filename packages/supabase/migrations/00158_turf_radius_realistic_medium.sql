-- ════════════════════════════════════════════════════════════════════
-- Turf-Radien: Realistisch-mittel (HQ 350m / Mega 250m / Standard 150m)
-- ════════════════════════════════════════════════════════════════════
-- War: HQ 500m / Mega 350m / Standard 200m → zu großzügig.
-- Jetzt: enger gefasst → mehr Repeater nötig für mehr Coverage.
-- ════════════════════════════════════════════════════════════════════

create or replace function public._repeater_turf_radius_for_kind(p_kind text)
returns int language sql immutable as $$
  select case p_kind
    when 'hq'       then 350
    when 'mega'     then 250
    when 'repeater' then 150
    else 150
  end;
$$;

-- Recompute alle bestehenden Repeater-Block-Claims mit neuen Radien
do $$ declare r record;
begin
  for r in select id from public.crew_repeaters where destroyed_at is null loop
    perform public.recompute_repeater_block_claims(r.id);
  end loop;
end $$;
