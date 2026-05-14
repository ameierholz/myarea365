-- ════════════════════════════════════════════════════════════════════════
-- 00371_seasonal_storm_heatwave.sql
-- Drei Strategie-Layer:
--
--   1) Saison-Modifier (Frühling/Sommer/Herbst/Winter — Europe/Berlin-Monat):
--      Globale Tweaks für Sammeln/Bauen/Heilen pro Saison.
--
--   2) Sturm-Schäden: city_weather='storm' triggert kleine Bau-Verzögerung
--      auf zufällig 1-3 aktive Bauprojekte je betroffene Stadt
--      (Service-Role-Funktion, vom Cron aufrufbar).
--
--   3) Hitzewelle-Event: city_weather='heat' + temperature_c >= 32 ⇒
--      Server-weite Buff-Phase (Inbox-Hinweis + +20 % gather_yield Sammler).
--      heat_wave_events Tabelle persistiert aktive Phase pro City.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) Saison-Helper ────────────────────────────────────────────────────
create or replace function public._current_season()
returns text language sql stable
set search_path = public, pg_temp
as $$
  select case
    when extract(month from (now() at time zone 'Europe/Berlin'))::int in (3,4,5)   then 'spring'
    when extract(month from (now() at time zone 'Europe/Berlin'))::int in (6,7,8)   then 'summer'
    when extract(month from (now() at time zone 'Europe/Berlin'))::int in (9,10,11) then 'autumn'
    else 'winter'
  end;
$$;
grant execute on function public._current_season() to authenticated, service_role;

create or replace function public._season_gather_mult()
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_s text := public._current_season();
begin
  case v_s
    when 'spring' then return 1.05;  -- Erntezeit beginnt
    when 'summer' then return 1.10;  -- Hochsaison
    when 'autumn' then return 1.05;
    when 'winter' then return 0.85;  -- karg
  end case;
end $$;
grant execute on function public._season_gather_mult() to authenticated, service_role;

create or replace function public._season_build_mult()
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_s text := public._current_season();
begin
  case v_s
    when 'spring' then return 0.97;
    when 'summer' then return 0.95;
    when 'autumn' then return 1.00;
    when 'winter' then return 1.10;  -- Frost macht alles schwer
  end case;
end $$;
grant execute on function public._season_build_mult() to authenticated, service_role;

create or replace function public._season_heal_mult()
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_s text := public._current_season();
begin
  case v_s
    when 'winter' then return 1.10;  -- Kälte verzögert
    when 'summer' then return 0.95;
    else return 1.0;
  end case;
end $$;
grant execute on function public._season_heal_mult() to authenticated, service_role;

-- ─── 2) Sturm-Schäden ────────────────────────────────────────────────────
-- Verzögert je Storm-City 1-3 aktive Bauprojekte um 30-90 Minuten.
-- Idempotent pro Stunde (uses storm_damage_log).
create table if not exists public.storm_damage_log (
  city_slug text not null references public.cities(slug) on delete cascade,
  hour_bucket timestamptz not null,
  damaged_count int not null default 0,
  primary key (city_slug, hour_bucket)
);

create or replace function public.apply_storm_damage()
returns int language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  c record;
  v_bucket timestamptz := date_trunc('hour', now());
  v_total int := 0;
  v_picked int;
  v_delay_min int;
  v_user_count int;
begin
  for c in select w.city_slug from public.city_weather w where w.condition = 'storm' loop
    -- Schon in dieser Stunde geschadet? Skip.
    if exists (
      select 1 from public.storm_damage_log
       where city_slug = c.city_slug and hour_bucket = v_bucket
    ) then
      continue;
    end if;

    select count(*) into v_user_count
      from public.bases b
      join public.users u on u.id = b.owner_user_id
      join public.building_queue q on q.base_id = b.id and not q.finished
     where u.home_city_slug = c.city_slug;
    if v_user_count = 0 then continue; end if;

    v_picked := least(3, greatest(1, v_user_count / 10));
    v_delay_min := 30 + (floor(random() * 60))::int;

    update public.building_queue q
       set ends_at = q.ends_at + (v_delay_min || ' minutes')::interval
     where q.id in (
       select q2.id from public.building_queue q2
        join public.bases b on b.id = q2.base_id
        join public.users u on u.id = b.owner_user_id
        where u.home_city_slug = c.city_slug and not q2.finished
        order by random() limit v_picked
     );

    insert into public.storm_damage_log (city_slug, hour_bucket, damaged_count)
    values (c.city_slug, v_bucket, v_picked)
    on conflict do nothing;

    v_total := v_total + v_picked;
  end loop;
  return v_total;
end $$;
revoke all on function public.apply_storm_damage() from public;
grant execute on function public.apply_storm_damage() to service_role;

-- ─── 3) Hitzewelle-Event ─────────────────────────────────────────────────
create table if not exists public.heat_wave_events (
  city_slug   text primary key references public.cities(slug) on delete cascade,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  active      boolean not null default true,
  inbox_sent  boolean not null default false
);

alter table public.heat_wave_events enable row level security;
drop policy if exists heat_wave_read_all on public.heat_wave_events;
create policy heat_wave_read_all on public.heat_wave_events for select using (true);

create or replace function public._heat_wave_active(p_city_slug text)
returns boolean language sql stable
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.heat_wave_events
     where city_slug = p_city_slug and active = true and expires_at > now()
  );
$$;
grant execute on function public._heat_wave_active(text) to authenticated, service_role;

-- Aktiviert Hitzewelle wenn Wetter='heat' + Temp >= 32.
-- Dauer 6 h, kann erneut starten wenn Wetter weiter heat bleibt.
create or replace function public.tick_heat_wave_events()
returns int language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  c record;
  v_count int := 0;
begin
  -- Aktive Events ablaufen lassen
  update public.heat_wave_events set active = false where active = true and expires_at <= now();

  -- Neue Events starten
  for c in
    select w.city_slug, w.temperature_c
      from public.city_weather w
     where w.condition = 'heat' and w.temperature_c >= 32
  loop
    if exists (select 1 from public.heat_wave_events where city_slug = c.city_slug and active = true) then
      continue;
    end if;
    insert into public.heat_wave_events (city_slug, started_at, expires_at, active, inbox_sent)
    values (c.city_slug, now(), now() + interval '6 hours', true, false)
    on conflict (city_slug) do update set
      started_at = excluded.started_at,
      expires_at = excluded.expires_at,
      active     = true,
      inbox_sent = false;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.tick_heat_wave_events() from public;
grant execute on function public.tick_heat_wave_events() to service_role;
