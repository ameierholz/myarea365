-- 00378_tick_city_weather_respect_owm.sql
-- Mock-Tick und get_user_city_weather respektieren OWM-Cities (kein Überschreiben
-- echter Daten mit Mock).
create or replace function public.tick_city_weather()
returns int language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  c record;
  v_mock public.city_weather;
  v_count int := 0;
  v_provider text;
begin
  for c in select slug from public.cities where is_active = true loop
    select coalesce(provider, 'mock') into v_provider
      from public.city_weather_provider_config where city_slug = c.slug;
    if v_provider = 'openweathermap' then
      continue;
    end if;

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

create or replace function public.get_user_city_weather()
returns public.city_weather
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_city text;
  v_w public.city_weather;
  v_mock public.city_weather;
  v_provider text;
begin
  if v_user is null then return null; end if;
  select home_city_slug into v_city from public.users where id = v_user;
  if v_city is null then
    select slug into v_city from public.cities where is_active = true order by slug limit 1;
  end if;
  if v_city is null then return null; end if;

  select * into v_w from public.city_weather where city_slug = v_city;
  select coalesce(provider, 'mock') into v_provider
    from public.city_weather_provider_config where city_slug = v_city;

  if v_provider <> 'openweathermap' and (v_w is null or (v_w.provider = 'mock' and v_w.updated_at < now() - interval '30 minutes')) then
    select * into v_mock from public._mock_weather_for_city(v_city);
    insert into public.city_weather (
      city_slug, condition, temperature_c, wind_kmh, precipitation_mm,
      is_night, provider, updated_at
    ) values (
      v_mock.city_slug, v_mock.condition, v_mock.temperature_c, v_mock.wind_kmh,
      v_mock.precipitation_mm, v_mock.is_night, v_mock.provider, v_mock.updated_at
    )
    on conflict (city_slug) do update set
      condition = excluded.condition,
      temperature_c = excluded.temperature_c,
      wind_kmh = excluded.wind_kmh,
      precipitation_mm = excluded.precipitation_mm,
      is_night = excluded.is_night,
      provider = excluded.provider,
      updated_at = excluded.updated_at;
    return v_mock;
  end if;

  return v_w;
end $$;
