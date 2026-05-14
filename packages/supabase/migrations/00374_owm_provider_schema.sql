-- ════════════════════════════════════════════════════════════════════════
-- 00374_owm_provider_schema.sql
-- OpenWeatherMap-Provider-Schema-Erweiterung. Real-Weather-Quelle wird über
-- eine Edge-Function gefüllt (außerhalb dieser Migration), aber das DB-Schema
-- + die Switch-Logik werden hier vorbereitet, damit nichts mehr daran liegt.
--
-- 1) Spalten für rohe API-Daten (humidity, cloud_pct, sunrise, sunset, raw)
-- 2) provider_priority Tabelle: pro City kann definiert sein, ob real oder mock
-- 3) record_owm_payload() — Service-Role-RPC, die die Edge-Function aufruft
--    und einen Roh-Payload normalisiert in city_weather einträgt.
-- ════════════════════════════════════════════════════════════════════════

alter table public.city_weather
  add column if not exists humidity_pct int,
  add column if not exists cloud_pct    int,
  add column if not exists sunrise_at   timestamptz,
  add column if not exists sunset_at    timestamptz,
  add column if not exists raw_payload  jsonb;

alter table public.city_weather_forecast
  add column if not exists humidity_pct int,
  add column if not exists cloud_pct    int,
  add column if not exists raw_payload  jsonb;

create table if not exists public.city_weather_provider_config (
  city_slug    text primary key references public.cities(slug) on delete cascade,
  provider     text not null default 'mock' check (provider in ('mock','openweathermap')),
  lat          double precision,
  lng          double precision,
  refresh_min  int not null default 30,
  last_real_at timestamptz,
  notes        text
);

alter table public.city_weather_provider_config enable row level security;
drop policy if exists provider_config_read_all on public.city_weather_provider_config;
create policy provider_config_read_all on public.city_weather_provider_config for select using (true);

-- OWM-Code → unseren condition-Tag mapping (siehe https://openweathermap.org/weather-conditions)
create or replace function public._owm_code_to_condition(p_code int)
returns text language plpgsql immutable
set search_path = public, pg_temp
as $$
begin
  if p_code is null then return 'cloud'; end if;
  if p_code between 200 and 299 then return 'storm';   -- Thunderstorm
  elsif p_code between 300 and 399 then return 'rain'; -- Drizzle
  elsif p_code between 500 and 599 then return 'rain';
  elsif p_code between 600 and 699 then return 'snow';
  elsif p_code between 700 and 799 then return 'fog';  -- Atmosphere (mist, haze)
  elsif p_code = 800 then return 'clear';
  elsif p_code between 801 and 899 then return 'cloud';
  end if;
  return 'cloud';
end $$;
grant execute on function public._owm_code_to_condition(int) to authenticated, service_role;

-- Service-Role-RPC: trägt einen normalisierten OWM-Payload ein.
-- Wird typischerweise von einer Edge-Function aufgerufen (oder cron-Job),
-- die die echte HTTP-Anfrage macht. Hier reine DB-Persistenz.
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
  -- OWM wind speed kommt in m/s, wir wollen km/h
  v_wind_kmh := round(((p_payload#>>'{wind,speed}')::numeric) * 3.6)::int;
  v_wind_dir := (p_payload#>>'{wind,deg}')::int;
  v_humid := (p_payload#>>'{main,humidity}')::int;
  v_cloud := (p_payload#>>'{clouds,all}')::int;
  -- Niederschlag: rain.1h oder snow.1h falls vorhanden
  v_precip := coalesce((p_payload#>>'{rain,1h}')::numeric, (p_payload#>>'{snow,1h}')::numeric, 0);
  v_sunrise := to_timestamp((p_payload#>>'{sys,sunrise}')::bigint);
  v_sunset  := to_timestamp((p_payload#>>'{sys,sunset}')::bigint);
  if v_sunrise is not null and v_sunset is not null then
    v_is_night := now() < v_sunrise or now() > v_sunset;
  end if;
  if v_is_night and v_cond in ('clear', 'cloud') then
    v_cond := 'night';
  end if;

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
revoke all on function public.record_owm_payload(text, jsonb) from public;
grant execute on function public.record_owm_payload(text, jsonb) to service_role;

-- Forecast-Payload-Aufnahme (OWM /forecast/daily, 5 Tage)
create or replace function public.record_owm_forecast(
  p_city_slug text,
  p_payload jsonb
) returns int language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_list jsonb := p_payload->'list';
  v_count int := 0;
  v_item jsonb;
  v_day_offset int := 0;
  v_cond text;
  v_high int;
  v_low int;
begin
  if v_list is null or jsonb_typeof(v_list) <> 'array' then
    return 0;
  end if;
  for v_item in select * from jsonb_array_elements(v_list) loop
    exit when v_day_offset > 4;
    v_cond := public._owm_code_to_condition((v_item#>>'{weather,0,id}')::int);
    v_high := round(((v_item#>>'{temp,max}')::numeric))::int;
    v_low  := round(((v_item#>>'{temp,min}')::numeric))::int;
    insert into public.city_weather_forecast (
      city_slug, day_offset, forecast_date, condition,
      temp_high_c, temp_low_c, wind_kmh, precip_mm, provider, updated_at,
      humidity_pct, cloud_pct, raw_payload
    ) values (
      p_city_slug, v_day_offset, ((now() at time zone 'Europe/Berlin')::date + v_day_offset), v_cond,
      v_high, v_low,
      round(((v_item->>'speed')::numeric) * 3.6)::int,
      coalesce((v_item->>'rain')::numeric, (v_item->>'snow')::numeric, 0),
      'openweathermap', now(),
      (v_item->>'humidity')::int,
      (v_item->>'clouds')::int,
      v_item
    )
    on conflict (city_slug, day_offset) do update set
      forecast_date = excluded.forecast_date,
      condition = excluded.condition,
      temp_high_c = excluded.temp_high_c,
      temp_low_c  = excluded.temp_low_c,
      wind_kmh    = excluded.wind_kmh,
      precip_mm   = excluded.precip_mm,
      provider    = excluded.provider,
      updated_at  = excluded.updated_at,
      humidity_pct= excluded.humidity_pct,
      cloud_pct   = excluded.cloud_pct,
      raw_payload = excluded.raw_payload;
    v_day_offset := v_day_offset + 1;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.record_owm_forecast(text, jsonb) from public;
grant execute on function public.record_owm_forecast(text, jsonb) to service_role;
