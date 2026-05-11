-- 00336_sanctuary_train_consolidated.sql
-- Fixt zwei nebeneinander existierende train_at_sanctuary-Versionen
-- (00330 hat versehentlich neue 1-Arg-Funktion erzeugt, ohne die alte
-- 3-Arg-Version mit Geofence-Check zu ersetzen). Der API-Code ruft
-- weiterhin die 3-Arg-Version auf, also war der valid_until-Check
-- aus Mig 00330 bisher wirkungslos — abgelaufene Sanctuaries konnten
-- trotzdem trainiert werden.
--
-- Konsolidiert: 1-Arg-Version löschen, 3-Arg-Version um valid_until-Check
-- erweitern. Geofence bleibt 50m.

DROP FUNCTION IF EXISTS public.train_at_sanctuary(uuid);

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
  v_dist double precision;
begin
  select xp_reward, lat, lng, valid_until
    into v_xp, v_lat, v_lng, v_valid
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

  if exists (select 1 from public.sanctuary_visits
             where sanctuary_id = p_sanctuary_id and user_id = auth.uid()
             and date_trunc('day', visited_at) = current_date) then
    return jsonb_build_object('error','already_trained_today');
  end if;

  insert into public.sanctuary_visits(sanctuary_id, user_id)
    values (p_sanctuary_id, auth.uid());
  update public.user_guardians set xp = xp + v_xp
    where user_id = auth.uid() and is_active = true;
  return jsonb_build_object('ok', true, 'xp_gained', v_xp);
end $$;

GRANT EXECUTE ON FUNCTION public.train_at_sanctuary(uuid, double precision, double precision)
  TO authenticated, service_role;
