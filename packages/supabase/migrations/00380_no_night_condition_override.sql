-- 00380_no_night_condition_override.sql
-- OWM-Recorder UND Mock-Generator setzen condition NICHT mehr auf 'night' wenn
-- is_night=true. Das Tageszeit-Badge zeigt schon "Nacht" — doppelt im Wetter-Badge
-- wirkt redundant. is_night-Flag bleibt für Analytics erhalten.
create or replace function public.record_owm_payload(
  p_city_slug text,
  p_payload jsonb
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cond text;
  v_temp int;
  v_wind_kmh int;
  v_wind_dir int;
  v_humid int;
  v_cloud int;
  v_precip numeric := 0;
  v_sunrise timestamptz;
  v_sunset timestamptz;
  v_is_night boolean := false;
  v_owm_code int;
begin
  if p_city_slug is null or p_payload is null then
    return jsonb_build_object('ok', false, 'error', 'missing_input');
  end if;
  v_owm_code := (p_payload#>>'{weather,0,id}')::int;
  v_cond := public._owm_code_to_condition(v_owm_code);
  v_temp := round(((p_payload#>>'{main,temp}')::numeric))::int;
  v_wind_kmh := round(((p_payload#>>'{wind,speed}')::numeric) * 3.6)::int;
  v_wind_dir := (p_payload#>>'{wind,deg}')::int;
  v_humid := (p_payload#>>'{main,humidity}')::int;
  v_cloud := (p_payload#>>'{clouds,all}')::int;
  v_precip := coalesce((p_payload#>>'{rain,1h}')::numeric, (p_payload#>>'{snow,1h}')::numeric, 0);
  v_sunrise := to_timestamp((p_payload#>>'{sys,sunrise}')::bigint);
  v_sunset  := to_timestamp((p_payload#>>'{sys,sunset}')::bigint);
  if v_sunrise is not null and v_sunset is not null then
    v_is_night := now() < v_sunrise or now() > v_sunset;
  end if;
  -- Kein coerce zu 'night' — Tageszeit kommt aus _current_tod().

  insert into public.city_weather (
    city_slug, condition, temperature_c, wind_kmh, wind_dir_deg, precipitation_mm,
    is_night, provider, updated_at, humidity_pct, cloud_pct, sunrise_at, sunset_at, raw_payload
  ) values (
    p_city_slug, v_cond, v_temp, v_wind_kmh, v_wind_dir, v_precip,
    v_is_night, 'openweathermap', now(), v_humid, v_cloud, v_sunrise, v_sunset, p_payload
  )
  on conflict (city_slug) do update set
    condition = excluded.condition,
    temperature_c = excluded.temperature_c,
    wind_kmh = excluded.wind_kmh,
    wind_dir_deg = excluded.wind_dir_deg,
    precipitation_mm = excluded.precipitation_mm,
    is_night = excluded.is_night,
    provider = excluded.provider,
    updated_at = excluded.updated_at,
    humidity_pct = excluded.humidity_pct,
    cloud_pct = excluded.cloud_pct,
    sunrise_at = excluded.sunrise_at,
    sunset_at = excluded.sunset_at,
    raw_payload = excluded.raw_payload;

  update public.city_weather_provider_config
     set last_real_at = now(), provider = 'openweathermap'
   where city_slug = p_city_slug;

  return jsonb_build_object('ok', true, 'condition', v_cond, 'temp', v_temp);
end $$;

create or replace function public._mock_weather_for_city(p_city_slug text)
returns public.city_weather
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_seed text := md5(p_city_slug || to_char(now(), 'YYYY-MM-DD HH24'));
  v_byte int := ('x' || substr(v_seed, 1, 2))::bit(8)::int;
  v_byte2 int := ('x' || substr(v_seed, 3, 2))::bit(8)::int;
  v_month int := extract(month from now())::int;
  v_hour int := extract(hour from now())::int;
  v_is_night boolean := v_hour < 6 or v_hour >= 21;
  v_winter boolean := v_month in (11, 12, 1, 2);
  v_summer boolean := v_month in (6, 7, 8);
  v_condition text;
  v_temp int;
  v_wind int;
  v_precip numeric;
  v_result public.city_weather;
begin
  if v_byte < 102 then v_condition := 'clear';
  elsif v_byte < 166 then v_condition := 'cloud';
  elsif v_byte < 204 then v_condition := 'rain';
  elsif v_byte < 217 and v_winter then v_condition := 'snow';
  elsif v_byte < 230 then v_condition := 'storm';
  elsif v_byte < 243 and v_summer then v_condition := 'heat';
  elsif v_hour < 9 then v_condition := 'fog';
  else v_condition := 'clear';
  end if;

  if v_winter then
    v_temp := -3 + (v_byte2 % 12);
  elsif v_summer then
    v_temp := 18 + (v_byte2 % 16);
  else
    v_temp := 8 + (v_byte2 % 18);
  end if;

  case v_condition
    when 'storm' then v_wind := 50 + (v_byte2 % 30); v_precip := 8 + (v_byte2 % 12);
    when 'rain' then v_wind := 15 + (v_byte2 % 15); v_precip := 2 + (v_byte2 % 8);
    when 'snow' then v_wind := 10 + (v_byte2 % 15); v_precip := 1 + (v_byte2 % 4);
    when 'heat' then v_wind := 5  + (v_byte2 % 10); v_precip := 0;
    else v_wind := 8 + (v_byte2 % 12); v_precip := 0;
  end case;

  v_result.city_slug := p_city_slug;
  v_result.condition := v_condition;
  v_result.temperature_c := v_temp;
  v_result.wind_kmh := v_wind;
  v_result.precipitation_mm := v_precip;
  v_result.is_night := v_is_night;
  v_result.provider := 'mock';
  v_result.updated_at := now();
  return v_result;
end $$;

-- Repariere bestehende 'night'-Conditions
update public.city_weather set condition = 'clear' where condition = 'night';
