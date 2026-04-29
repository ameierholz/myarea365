-- ══════════════════════════════════════════════════════════════════════════
-- Strongholds: Spawn nur auf Grünflächen (parks/wälder/wiesen aus green_areas)
-- Fallback auf das alte Verhalten falls in der Region keine Grünfläche existiert.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.spawn_strongholds_for_plz(p_plz text, p_center_lat double precision, p_center_lng double precision)
returns int language plpgsql security definer as $$
declare
  v_active   int;
  v_to_spawn int;
  v_lvl      int;
  v_hp       bigint;
  v_pt       geometry;
  v_jitter_lat double precision;
  v_jitter_lng double precision;
  i int;
  v_attempts int;
begin
  select count(*) into v_active from public.strongholds
   where plz = p_plz and defeated_at is null;
  v_to_spawn := greatest(0, 15 - v_active);

  for i in 1..v_to_spawn loop
    v_lvl := 1 + floor(random() * 10)::int;
    v_hp  := public.stronghold_hp_for_level(v_lvl);
    v_pt  := null;

    -- Bis zu 8 Versuche einen zufälligen Punkt in einer Grünfläche
    -- innerhalb 4 km vom PLZ-Center zu finden.
    v_attempts := 0;
    while v_pt is null and v_attempts < 8 loop
      v_attempts := v_attempts + 1;
      with cand as (
        select geom from public.green_areas
         where st_dwithin(
           geom::geography,
           st_setsrid(st_makepoint(p_center_lng, p_center_lat), 4326)::geography,
           4000
         )
         and area_sqm > 1000  -- nur Flächen ≥ 1000 m² (kein Kleinkram)
         order by random() limit 1
      )
      select st_pointonsurface(geom) into v_pt from cand;
    end loop;

    if v_pt is not null then
      insert into public.strongholds (plz, lat, lng, level, total_hp, current_hp)
      values (p_plz, st_y(v_pt), st_x(v_pt), v_lvl, v_hp, v_hp);
    else
      -- Fallback: zufälliger Punkt im Umkreis (alte Logik) wenn keine Grünfläche da
      v_jitter_lat := (random() - 0.5) * 0.08;
      v_jitter_lng := (random() - 0.5) * 0.08;
      insert into public.strongholds (plz, lat, lng, level, total_hp, current_hp)
      values (p_plz, p_center_lat + v_jitter_lat, p_center_lng + v_jitter_lng, v_lvl, v_hp, v_hp);
    end if;
  end loop;
  return v_to_spawn;
end $$;
