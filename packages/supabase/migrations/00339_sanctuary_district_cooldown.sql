-- 00339_sanctuary_district_cooldown.sql
-- Anti-Farming: Pro Bezirk darf ein User nur alle 7 Tage trainieren.
-- Sanctuaries rotieren täglich innerhalb des Bezirks (neue lat/lng), aber
-- sanctuary.id + district_id bleiben stabil (ON CONFLICT (district_id)
-- DO UPDATE). Cooldown gilt also pro Bezirk, nicht pro Position.
--
-- Effekt: In Berlin (12 Bezirke) max ~2 Sanctuaries/Tag (12/7 ≈ 1.7),
-- volle Rotation durch alle Bezirke dauert ~12 Tage Mindestens. Belohnt
-- echtes Reisen durch die Stadt.

CREATE OR REPLACE FUNCTION public.train_at_sanctuary(
  p_sanctuary_id uuid,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_xp int;
  v_lat double precision;
  v_lng double precision;
  v_valid timestamptz;
  v_district bigint;
  v_dist double precision;
  v_last_visit timestamptz;
  v_available_at timestamptz;
begin
  select xp_reward, lat, lng, valid_until, district_id
    into v_xp, v_lat, v_lng, v_valid, v_district
    from public.sanctuaries where id = p_sanctuary_id;
  if v_xp is null then return jsonb_build_object('error','sanctuary_not_found'); end if;

  if v_valid is not null and v_valid < now() then
    return jsonb_build_object('error','sanctuary_expired');
  end if;

  if p_user_lat is null or p_user_lng is null then
    return jsonb_build_object('error','location_required');
  end if;

  v_dist := 6371000 * 2 * asin(sqrt(
    power(sin(radians(v_lat - p_user_lat) / 2), 2) +
    cos(radians(p_user_lat)) * cos(radians(v_lat)) *
    power(sin(radians(v_lng - p_user_lng) / 2), 2)
  ));
  if v_dist > 50 then
    return jsonb_build_object('error','too_far','distance_m', round(v_dist)::int);
  end if;

  -- 7-Tage-Bezirk-Cooldown: letzten Visit dieses Users in DIESEM Bezirk holen.
  -- district_id ist NULL nur für Legacy-Sanctuaries (vor Mig 00330) — die wurden
  -- aber in 00333 gelöscht, also sollte v_district immer gesetzt sein.
  if v_district is not null then
    select max(sv.visited_at) into v_last_visit
      from public.sanctuary_visits sv
      join public.sanctuaries s2 on s2.id = sv.sanctuary_id
     where sv.user_id = auth.uid()
       and s2.district_id = v_district;

    if v_last_visit is not null and v_last_visit > now() - interval '7 days' then
      v_available_at := v_last_visit + interval '7 days';
      return jsonb_build_object(
        'error','district_cooldown',
        'available_at', v_available_at,
        'last_visit_at', v_last_visit
      );
    end if;
  end if;

  insert into public.sanctuary_visits(sanctuary_id, user_id)
    values (p_sanctuary_id, auth.uid());
  update public.user_guardians set xp = xp + v_xp
    where user_id = auth.uid() and is_active = true;
  return jsonb_build_object(
    'ok', true,
    'xp_gained', v_xp,
    'district_locked_until', now() + interval '7 days'
  );
end $$;

GRANT EXECUTE ON FUNCTION public.train_at_sanctuary(uuid, double precision, double precision)
  TO authenticated, service_role;

-- Helper: liefert pro Sanctuary den Cooldown-Status für den aktuellen User
CREATE OR REPLACE FUNCTION public.sanctuary_cooldowns_for_user()
RETURNS TABLE(sanctuary_id uuid, district_id bigint, cooldown_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH last_visits AS (
    SELECT s.district_id, MAX(sv.visited_at) AS last_visit
    FROM public.sanctuary_visits sv
    JOIN public.sanctuaries s ON s.id = sv.sanctuary_id
    WHERE sv.user_id = auth.uid()
      AND sv.visited_at > now() - interval '7 days'
    GROUP BY s.district_id
  )
  SELECT s.id, s.district_id, lv.last_visit + interval '7 days'
  FROM public.sanctuaries s
  JOIN last_visits lv ON lv.district_id = s.district_id;
$$;

GRANT EXECUTE ON FUNCTION public.sanctuary_cooldowns_for_user() TO authenticated;
