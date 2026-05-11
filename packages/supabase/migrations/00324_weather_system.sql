-- 00324_weather_system.sql
-- Live-Wetter pro City-Server → Kampf-Modifier + UI-Anzeige.
-- Mock-Provider deterministisch pro City + Stunde, OpenWeatherMap-Hook
-- vorbereitet (provider='openweathermap', wenn API-Key gesetzt).

CREATE TABLE IF NOT EXISTS public.city_weather (
  city_slug         text PRIMARY KEY REFERENCES public.cities(slug) ON DELETE CASCADE,
  condition         text NOT NULL CHECK (condition IN ('clear','cloud','rain','snow','storm','heat','fog','night')),
  temperature_c     int NOT NULL DEFAULT 15,
  wind_kmh          int NOT NULL DEFAULT 10,
  precipitation_mm  numeric NOT NULL DEFAULT 0,
  is_night          boolean NOT NULL DEFAULT false,
  provider          text NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock','openweathermap')),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_weather IS
  'Aktuelles Wetter pro City-Server. Mock-Provider deterministisch; OpenWeatherMap-Hook via Cron.';

ALTER TABLE public.city_weather ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS city_weather_read_all ON public.city_weather;
CREATE POLICY city_weather_read_all ON public.city_weather FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public._mock_weather_for_city(p_city_slug text)
RETURNS public.city_weather
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
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
  if v_is_night then
    v_condition := 'night';
  elsif v_byte < 102 then
    v_condition := 'clear';
  elsif v_byte < 166 then
    v_condition := 'cloud';
  elsif v_byte < 204 then
    v_condition := 'rain';
  elsif v_byte < 217 and v_winter then
    v_condition := 'snow';
  elsif v_byte < 230 then
    v_condition := 'storm';
  elsif v_byte < 243 and v_summer then
    v_condition := 'heat';
  elsif v_hour < 9 then
    v_condition := 'fog';
  else
    v_condition := 'clear';
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

CREATE OR REPLACE FUNCTION public.tick_city_weather()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  c record;
  v_mock public.city_weather;
  v_count int := 0;
begin
  for c in select slug from public.cities where is_active = true loop
    select * into v_mock from public._mock_weather_for_city(c.slug);
    insert into public.city_weather (city_slug, condition, temperature_c, wind_kmh, precipitation_mm, is_night, provider, updated_at)
    values (v_mock.city_slug, v_mock.condition, v_mock.temperature_c, v_mock.wind_kmh, v_mock.precipitation_mm, v_mock.is_night, v_mock.provider, v_mock.updated_at)
    on conflict (city_slug) do update set
      condition = excluded.condition,
      temperature_c = excluded.temperature_c,
      wind_kmh = excluded.wind_kmh,
      precipitation_mm = excluded.precipitation_mm,
      is_night = excluded.is_night,
      provider = excluded.provider,
      updated_at = excluded.updated_at;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

REVOKE ALL ON FUNCTION public.tick_city_weather() FROM public;
GRANT EXECUTE ON FUNCTION public.tick_city_weather() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_city_weather()
RETURNS public.city_weather LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
declare
  v_user uuid := auth.uid();
  v_city text;
  v_w public.city_weather;
begin
  if v_user is null then return null; end if;
  select home_city_slug into v_city from public.users where id = v_user;
  if v_city is null then return null; end if;
  select * into v_w from public.city_weather where city_slug = v_city;
  if v_w is null then
    select * into v_w from public._mock_weather_for_city(v_city);
    insert into public.city_weather select v_w.* on conflict (city_slug) do nothing;
  end if;
  return v_w;
end $$;

GRANT EXECUTE ON FUNCTION public.get_user_city_weather() TO authenticated;

SELECT public.tick_city_weather();
