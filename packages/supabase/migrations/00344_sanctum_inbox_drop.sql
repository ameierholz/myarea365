-- 00344_sanctum_inbox_drop.sql
-- Sanctum-Training erzeugt Inbox-Drop mit Elixier-Items statt Direkt-EP
-- auf user_guardians. Damit: User entscheidet selbst welchen Wächter er
-- buffen will, Drop-Log in Inbox ist scannbar. Title nach WAS·WOHER·WARUM
-- Pattern aus feedback_inbox_title_pattern.md.
--
-- Konvertierung: xp_reward / 1000 = Anzahl xp_pot_l-Items. Bei 5000 EP
-- also 5× Großes Erfahrung-Elixier. Andere Drop-Quellen (Wegelager, Boss-
-- Raid, Quest) sollen analog Inbox-Drops produzieren.

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
  v_district_name text;
  v_dist double precision;
  v_last_visit timestamptz;
  v_available_at timestamptz;
  v_pot_count int;
  v_inbox_id uuid;
begin
  select s.xp_reward, s.lat, s.lng, s.valid_until, s.district_id, d.name
    into v_xp, v_lat, v_lng, v_valid, v_district, v_district_name
    from public.sanctuaries s
    left join public.city_districts d on d.id = s.district_id
    where s.id = p_sanctuary_id;
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

  -- 7-Tage-Bezirk-Cooldown
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

  -- Visit-Eintrag (für Cooldown-Tracking)
  insert into public.sanctuary_visits(sanctuary_id, user_id)
    values (p_sanctuary_id, auth.uid());

  -- 5000 EP → 5× Großes Erfahrung-Elixier (xp_pot_l = 1000 EP)
  v_pot_count := greatest(1, (v_xp / 1000)::int);

  insert into public.user_inbox (
    user_id, category, subcategory, kind,
    title, body, reward_payload
  ) values (
    auth.uid(),
    'system', NULL, 'sanctum_drop',
    '🏺 +' || v_pot_count || '× Großes Erfahrung-Elixier · Sanctum · ' || coalesce(v_district_name, 'Unbekannt'),
    'Du hast **' || v_pot_count || '× Großes Erfahrung-Elixier** vom Sanctum **' || coalesce(v_district_name, 'Unbekannt') || '** erhalten. Wende sie im Wächter-Modal an, um deinem Wächter Erfahrung zu schenken.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('item_id', 'xp_pot_l', 'count', v_pot_count)
    ))
  )
  returning id into v_inbox_id;

  return jsonb_build_object(
    'ok', true,
    'drop_kind', 'inbox',
    'inbox_id', v_inbox_id,
    'pot_count', v_pot_count,
    'district', v_district_name
  );
end $$;

GRANT EXECUTE ON FUNCTION public.train_at_sanctuary(uuid, double precision, double precision)
  TO authenticated, service_role;
