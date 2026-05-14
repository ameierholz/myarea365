-- 00377_forecast_5_days_default.sql
-- refresh_city_forecast generiert jetzt 5 Tage statt 3, gratis für alle.
create or replace function public.refresh_city_forecast(p_city_slug text)
returns int language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_fc public.city_weather_forecast;
  i int;
  v_count int := 0;
begin
  for i in 0..4 loop
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
