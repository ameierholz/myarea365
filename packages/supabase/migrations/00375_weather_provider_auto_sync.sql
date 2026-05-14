-- ════════════════════════════════════════════════════════════════════════
-- 00375_weather_provider_auto_sync.sql
-- Auto-Sync: city_weather_provider_config wird aus public.cities gepflegt.
-- Bei jeder neuen / aktivierten City wird ein Provider-Eintrag mit
-- lat/lng aus cities.default_center_lat/lng angelegt. So muss nie wieder
-- manuell eingetragen werden, wenn neue Städte launchen.
-- ════════════════════════════════════════════════════════════════════════

-- Default-Provider als Setting (jetzt 'mock', später 'openweathermap' wenn
-- Edge-Function läuft). Wir lesen das im Trigger.
create table if not exists public.weather_provider_defaults (
  id              int primary key default 1,
  default_provider text not null default 'mock'
    check (default_provider in ('mock','openweathermap')),
  refresh_min     int not null default 30,
  check (id = 1)
);

insert into public.weather_provider_defaults (id, default_provider, refresh_min)
values (1, 'mock', 30)
on conflict (id) do nothing;

alter table public.weather_provider_defaults enable row level security;
drop policy if exists weather_provider_defaults_read on public.weather_provider_defaults;
create policy weather_provider_defaults_read on public.weather_provider_defaults for select using (true);

-- Trigger-Funktion: bei INSERT/UPDATE in cities → provider_config nachziehen
create or replace function public._sync_weather_provider_config()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_default text;
  v_refresh int;
begin
  -- Nur aktive Cities bekommen einen Provider-Config-Eintrag
  if new.is_active is not true then
    return new;
  end if;

  select default_provider, refresh_min
    into v_default, v_refresh
    from public.weather_provider_defaults where id = 1;

  insert into public.city_weather_provider_config (city_slug, provider, lat, lng, refresh_min)
  values (new.slug, coalesce(v_default,'mock'), new.default_center_lat, new.default_center_lng, coalesce(v_refresh, 30))
  on conflict (city_slug) do update set
    lat = excluded.lat,
    lng = excluded.lng,
    -- provider NICHT überschreiben, falls jemand manuell auf OWM gewechselt hat
    refresh_min = coalesce(public.city_weather_provider_config.refresh_min, excluded.refresh_min);
  return new;
end $$;

drop trigger if exists trg_cities_sync_weather_provider on public.cities;
create trigger trg_cities_sync_weather_provider
  after insert or update of slug, default_center_lat, default_center_lng, is_active on public.cities
  for each row execute function public._sync_weather_provider_config();

-- ─── Backfill aller bestehenden Cities ──────────────────────────────────
insert into public.city_weather_provider_config (city_slug, provider, lat, lng, refresh_min)
select c.slug,
       coalesce((select default_provider from public.weather_provider_defaults where id = 1), 'mock'),
       c.default_center_lat,
       c.default_center_lng,
       coalesce((select refresh_min from public.weather_provider_defaults where id = 1), 30)
  from public.cities c
 where c.is_active = true
on conflict (city_slug) do update set
  lat = excluded.lat,
  lng = excluded.lng;

-- ─── Convenience: einmaliger Switch auf 'openweathermap' für alle Cities ─
-- Wird vom Operator manuell aufgerufen, sobald der OWM-Edge-Function-Tick
-- erfolgreich erste Daten geliefert hat. Ändert NUR Cities, deren provider
-- noch auf 'mock' steht — bereits umgestellte bleiben unverändert.
create or replace function public.enable_owm_for_all_cities()
returns int language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_count int;
begin
  update public.weather_provider_defaults set default_provider = 'openweathermap' where id = 1;
  update public.city_weather_provider_config
     set provider = 'openweathermap'
   where provider = 'mock';
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.enable_owm_for_all_cities() from public;
grant execute on function public.enable_owm_for_all_cities() to service_role;
