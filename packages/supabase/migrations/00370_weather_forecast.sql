-- ════════════════════════════════════════════════════════════════════════
-- 00370_weather_forecast.sql
-- 3-Tage-Vorhersage pro City. Deterministisch aus seed (city_slug + datum).
-- Tabelle wird bei tick_city_weather automatisch nachgezogen (Mock).
-- Für reale OpenWeatherMap-Daten siehe Migration 00374.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.city_weather_forecast (
  city_slug    text not null references public.cities(slug) on delete cascade,
  day_offset   smallint not null check (day_offset between 0 and 6),
  forecast_date date not null,
  condition    text not null check (condition in ('clear','cloud','rain','snow','storm','heat','fog','night')),
  temp_high_c  int not null,
  temp_low_c   int not null,
  wind_kmh     int not null default 10,
  precip_mm    numeric not null default 0,
  provider     text not null default 'mock' check (provider in ('mock','openweathermap')),
  updated_at   timestamptz not null default now(),
  primary key (city_slug, day_offset)
);

alter table public.city_weather_forecast enable row level security;
drop policy if exists weather_forecast_read_all on public.city_weather_forecast;
create policy weather_forecast_read_all on public.city_weather_forecast for select using (true);

comment on table public.city_weather_forecast is
  '3-Tage-Vorhersage pro City. Mock-Provider deterministisch; OpenWeatherMap via Edge-Function (siehe 00374).';

-- Mock-Forecast deterministisch aus (slug, date)
create or replace function public._mock_forecast_for_day(p_city_slug text, p_day_offset int)
returns public.city_weather_forecast
language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_date date := (now() at time zone 'Europe/Berlin')::date + p_day_offset;
  v_seed text := md5(p_city_slug || to_char(v_date, 'YYYY-MM-DD') || 'fc');
  v_byte int := ('x' || substr(v_seed, 1, 2))::bit(8)::int;
  v_byte2 int := ('x' || substr(v_seed, 3, 2))::bit(8)::int;
  v_month int := extract(month from v_date)::int;
  v_winter boolean := v_month in (11, 12, 1, 2);
  v_summer boolean := v_month in (6, 7, 8);
  v_cond text;
  v_high int;
  v_low int;
  v_wind int;
  v_precip numeric := 0;
  v_result public.city_weather_forecast;
begin
  if v_byte < 102 then v_cond := 'clear';
  elsif v_byte < 166 then v_cond := 'cloud';
  elsif v_byte < 204 then v_cond := 'rain';
  elsif v_byte < 217 and v_winter then v_cond := 'snow';
  elsif v_byte < 230 then v_cond := 'storm';
  elsif v_byte < 243 and v_summer then v_cond := 'heat';
  else v_cond := 'clear';
  end if;

  if v_winter then
    v_high := -1 + (v_byte2 % 10); v_low := v_high - 4 - (v_byte2 % 4);
  elsif v_summer then
    v_high := 22 + (v_byte2 % 14); v_low := v_high - 6 - (v_byte2 % 4);
  else
    v_high := 12 + (v_byte2 % 14); v_low := v_high - 5 - (v_byte2 % 4);
  end if;

  case v_cond
    when 'storm' then v_wind := 45 + (v_byte2 % 30); v_precip := 6 + (v_byte2 % 10);
    when 'rain'  then v_wind := 14 + (v_byte2 % 12); v_precip := 2 + (v_byte2 % 7);
    when 'snow'  then v_wind := 12 + (v_byte2 % 10); v_precip := 1 + (v_byte2 % 4);
    when 'heat'  then v_wind := 6  + (v_byte2 % 8);  v_precip := 0;
    else v_wind := 9 + (v_byte2 % 10); v_precip := 0;
  end case;

  v_result.city_slug := p_city_slug;
  v_result.day_offset := p_day_offset::smallint;
  v_result.forecast_date := v_date;
  v_result.condition := v_cond;
  v_result.temp_high_c := v_high;
  v_result.temp_low_c := v_low;
  v_result.wind_kmh := v_wind;
  v_result.precip_mm := v_precip;
  v_result.provider := 'mock';
  v_result.updated_at := now();
  return v_result;
end $$;

-- City-Forecast generieren (3 Tage) + persistieren
create or replace function public.refresh_city_forecast(p_city_slug text)
returns int language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_fc public.city_weather_forecast;
  i int;
  v_count int := 0;
begin
  for i in 0..2 loop
    select * into v_fc from public._mock_forecast_for_day(p_city_slug, i);
    insert into public.city_weather_forecast (
      city_slug, day_offset, forecast_date, condition,
      temp_high_c, temp_low_c, wind_kmh, precip_mm, provider, updated_at
    ) values (
      v_fc.city_slug, v_fc.day_offset, v_fc.forecast_date, v_fc.condition,
      v_fc.temp_high_c, v_fc.temp_low_c, v_fc.wind_kmh, v_fc.precip_mm, v_fc.provider, v_fc.updated_at
    )
    on conflict (city_slug, day_offset) do update set
      forecast_date = excluded.forecast_date,
      condition     = excluded.condition,
      temp_high_c   = excluded.temp_high_c,
      temp_low_c    = excluded.temp_low_c,
      wind_kmh      = excluded.wind_kmh,
      precip_mm     = excluded.precip_mm,
      provider      = excluded.provider,
      updated_at    = excluded.updated_at;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
grant execute on function public.refresh_city_forecast(text) to authenticated, service_role;

-- Auto-Refresh-Wrapper: bei jedem Read der eigenen Stadt wird Forecast
-- aufgefrischt, falls älter als 6 h. Premium-Flag entriegelt mehr Tage
-- (siehe Migration 00372).
create or replace function public.get_user_forecast()
returns setof public.city_weather_forecast
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_city text;
  v_oldest timestamptz;
begin
  if v_user is null then return; end if;
  select home_city_slug into v_city from public.users where id = v_user;
  if v_city is null then
    select slug into v_city from public.cities where is_active = true order by slug limit 1;
  end if;
  if v_city is null then return; end if;

  select min(updated_at) into v_oldest
    from public.city_weather_forecast where city_slug = v_city;
  if v_oldest is null or v_oldest < now() - interval '6 hours' then
    perform public.refresh_city_forecast(v_city);
  end if;

  return query select * from public.city_weather_forecast
                where city_slug = v_city order by day_offset;
end $$;
grant execute on function public.get_user_forecast() to authenticated;
