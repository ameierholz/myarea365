-- ════════════════════════════════════════════════════════════════════
-- CREW TURF — Phase 1: Differenzierte Radien + Chain via Coverage-Overlap
-- + Crew-Farbe für Territorial-Markierung
-- ════════════════════════════════════════════════════════════════════
-- Änderungen:
--   1. Pro Repeater-Typ eigener Turf-Radius (HQ 500m, Mega 350m, Standard 200m)
--   2. Chain-Rule wird visuell: Coverage-Kreis muss bestehenden überlappen
--      (Distanz ≤ R_neu + R_bestehend), statt fester 400m
--   3. crews.territory_color wird auf Map verwendet (war nur DB-Column)
--   4. RPC set_crew_territory_color für Settings-UI
--   5. get_crew_repeaters_in_bbox liefert jetzt auch territory_color
--   6. get_crew_turf_polygons unioniert pro Crew mit Per-Kind-Buffern + color
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Per-Kind Turf-Radius ──────────────────────────────────────────
create or replace function public._repeater_turf_radius_for_kind(p_kind text)
returns int language sql immutable as $$
  select case p_kind
    when 'hq'       then 500
    when 'mega'     then 350
    when 'repeater' then 200
    else 200
  end;
$$;

-- Backwards-compat: alte Funktion gibt jetzt den Standard-Radius zurück
create or replace function public._repeater_turf_radius_m() returns int language sql immutable as $$
  select 200;
$$;

-- ─── 2) place_crew_repeater: Chain via Coverage-Overlap ───────────────
create or replace function public.place_crew_repeater(
  p_lat double precision,
  p_lng double precision,
  p_kind text default 'repeater',
  p_label text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_existing_count int;
  v_in_chain boolean;
  v_stats record;
  v_repeater_id uuid;
  v_res record;
  v_new_radius int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  if p_kind not in ('hq','repeater','mega') then return jsonb_build_object('ok', false, 'error', 'bad_kind'); end if;

  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;
  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;

  select * into v_stats from public._repeater_kind_stats(p_kind);
  v_new_radius := public._repeater_turf_radius_for_kind(p_kind);

  select count(*) into v_existing_count
    from public.crew_repeaters
   where crew_id = v_crew and destroyed_at is null;

  if v_existing_count = 0 and p_kind <> 'hq' then
    return jsonb_build_object('ok', false, 'error', 'first_must_be_hq');
  end if;
  if p_kind = 'hq' and v_existing_count > 0 then
    return jsonb_build_object('ok', false, 'error', 'hq_already_exists');
  end if;

  -- NEUE Chain-Rule: Coverage-Kreis muss bestehenden Coverage-Kreis berühren/überlappen.
  -- Distanz zwischen Mittelpunkten ≤ Summe der beiden Radien.
  if p_kind <> 'hq' then
    select exists (
      select 1 from public.crew_repeaters
       where crew_id = v_crew
         and destroyed_at is null
         and public._haversine_m(lat, lng, p_lat, p_lng)
             <= v_new_radius + public._repeater_turf_radius_for_kind(kind)
    ) into v_in_chain;
    if not v_in_chain then
      return jsonb_build_object('ok', false, 'error', 'out_of_chain',
        'hint', 'Coverage muss bestehenden Repeater berühren');
    end if;
  end if;

  -- Mindestabstand zu fremden Repeatern (50 m)
  if exists (
    select 1 from public.crew_repeaters
     where crew_id <> v_crew
       and destroyed_at is null
       and public._haversine_m(lat, lng, p_lat, p_lng) <= 50
  ) then
    return jsonb_build_object('ok', false, 'error', 'too_close_to_enemy');
  end if;

  select coalesce(gold,0) gold, coalesce(wood,0) wood, coalesce(stone,0) stone
    into v_res
    from public.user_resources
   where user_id = v_user;

  if v_res is null then return jsonb_build_object('ok', false, 'error', 'no_resources_row'); end if;
  if v_res.gold < v_stats.cost_gold or v_res.wood < v_stats.cost_wood or v_res.stone < v_stats.cost_stone then
    return jsonb_build_object('ok', false, 'error', 'insufficient_resources',
      'need', jsonb_build_object('gold', v_stats.cost_gold, 'wood', v_stats.cost_wood, 'stone', v_stats.cost_stone));
  end if;

  update public.user_resources
     set gold = gold - v_stats.cost_gold,
         wood = wood - v_stats.cost_wood,
         stone = stone - v_stats.cost_stone
   where user_id = v_user;

  insert into public.crew_repeaters (
    crew_id, founder_user_id, kind, label, lat, lng, hp, max_hp, shield_until
  ) values (
    v_crew, v_user, p_kind, coalesce(p_label, initcap(p_kind)), p_lat, p_lng,
    v_stats.max_hp, v_stats.max_hp,
    now() + (v_stats.build_shield_s || ' seconds')::interval
  )
  returning id into v_repeater_id;

  return jsonb_build_object('ok', true, 'repeater_id', v_repeater_id, 'kind', p_kind, 'hp', v_stats.max_hp,
    'turf_radius_m', v_new_radius);
end $$;

grant execute on function public.place_crew_repeater(double precision, double precision, text, text) to authenticated;

-- ─── 3) get_crew_repeaters_in_bbox: jetzt mit territory_color + turf_radius_m ──
drop function if exists public.get_crew_repeaters_in_bbox(double precision, double precision, double precision, double precision);
create or replace function public.get_crew_repeaters_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(
  id uuid, crew_id uuid, crew_name text, crew_tag text,
  kind text, tier int, label text, lat double precision, lng double precision,
  hp int, max_hp int, shield_until timestamptz, is_own boolean,
  territory_color text, turf_radius_m int
) language sql security definer as $$
  select r.id, r.crew_id, c.name as crew_name,
         upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)) as crew_tag,
         r.kind, r.tier, r.label, r.lat, r.lng, r.hp, r.max_hp, r.shield_until,
         r.crew_id in (select crew_id from public.crew_members where user_id = auth.uid()) as is_own,
         coalesce(c.territory_color, case
           when r.crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
                then '#22D1C3'
           else '#FF2D78'
         end) as territory_color,
         public._repeater_turf_radius_for_kind(r.kind) as turf_radius_m
    from public.crew_repeaters r
    join public.crews c on c.id = r.crew_id
   where r.destroyed_at is null
     and r.lat between p_min_lat and p_max_lat
     and r.lng between p_min_lng and p_max_lng;
$$;
grant execute on function public.get_crew_repeaters_in_bbox(double precision, double precision, double precision, double precision) to authenticated;

-- ─── 4) get_crew_turf_polygons: Per-Kind-Radius + territory_color ────
drop function if exists public.get_crew_turf_polygons(double precision, double precision, double precision, double precision);
create or replace function public.get_crew_turf_polygons(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns table(crew_id uuid, crew_name text, crew_tag text, is_own boolean,
                territory_color text, geojson jsonb)
language plpgsql security definer as $$
begin
  return query
    with rep as (
      select r.crew_id, r.lat, r.lng,
             ST_Buffer(
               ST_Transform(ST_SetSRID(ST_MakePoint(r.lng, r.lat), 4326), 3857),
               public._repeater_turf_radius_for_kind(r.kind)
             ) as buf
        from public.crew_repeaters r
       where r.destroyed_at is null
         and r.lat between p_min_lat - 0.01 and p_max_lat + 0.01
         and r.lng between p_min_lng - 0.02 and p_max_lng + 0.02
    ),
    agg as (
      select crew_id, ST_Transform(ST_Union(buf), 4326) as poly
        from rep
       group by crew_id
    )
    select a.crew_id,
           c.name,
           upper(left(regexp_replace(coalesce(c.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 4)) as crew_tag,
           a.crew_id in (select crew_id from public.crew_members where user_id = auth.uid()) as is_own,
           coalesce(c.territory_color, case
             when a.crew_id in (select crew_id from public.crew_members where user_id = auth.uid())
                  then '#22D1C3'
             else '#FF2D78'
           end) as territory_color,
           ST_AsGeoJSON(a.poly)::jsonb
      from agg a
      join public.crews c on c.id = a.crew_id;
end $$;
grant execute on function public.get_crew_turf_polygons(double precision, double precision, double precision, double precision) to authenticated;

-- ─── 5) RPC: set_crew_territory_color ───────────────────────────────
-- Nur Crew-Leader/Officer dürfen die Crew-Farbe ändern
create or replace function public.set_crew_territory_color(p_color text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid;
  v_role text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  -- Hex-Color-Validation: #RRGGBB
  if p_color !~ '^#[0-9a-fA-F]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_color', 'hint', 'Format: #RRGGBB');
  end if;

  select crew_id, role into v_crew, v_role
    from public.crew_members
   where user_id = v_user limit 1;

  if v_crew is null then return jsonb_build_object('ok', false, 'error', 'no_crew'); end if;
  if v_role not in ('leader', 'officer') then
    return jsonb_build_object('ok', false, 'error', 'forbidden', 'hint', 'Nur Leader oder Officer');
  end if;

  update public.crews set territory_color = p_color where id = v_crew;
  return jsonb_build_object('ok', true, 'color', p_color);
end $$;
grant execute on function public.set_crew_territory_color(text) to authenticated;

-- ─── 6) Konstanten via get_crew_constants verfügbar machen ──────────
-- (existierende Funktion gibt schon turf_radius_m / chain_radius_m zurück —
-- erweitern auf Per-Kind-Radien)
create or replace function public.get_crew_constants() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'turf_radius_m', public._repeater_turf_radius_m(),
    'turf_radius_hq', public._repeater_turf_radius_for_kind('hq'),
    'turf_radius_mega', public._repeater_turf_radius_for_kind('mega'),
    'turf_radius_repeater', public._repeater_turf_radius_for_kind('repeater'),
    'chain_rule', 'coverage_overlap',
    'min_enemy_distance_m', 50
  );
$$;
grant execute on function public.get_crew_constants() to authenticated;
