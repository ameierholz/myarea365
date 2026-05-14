-- ════════════════════════════════════════════════════════════════════════
-- 00369_guardian_weather_specialty.sql
-- Wächter-Wetter-Talents + Eis-Wände-Buff + Sumpfboden-Slow.
-- Drei orthogonale Mechaniken:
--
--   1) Wächter können ein "weather_specialty" Tag bekommen
--      (rain_master / snow_king / storm_lord / sun_chaser / fog_walker / night_owl).
--      Bei passendem Wetter +15 % zum Wächter-eigenen Multi (zusätzlich
--      zur Klassen-Wetter-Matrix aus 00366).
--
--   2) Eis-Wände: bei Wetter='snow' bekommt der eigene Profilbild-Bau
--      einen +10 % Verteidigungs-Bonus (statisch additiver Boni-Eintrag im
--      Defense-Report).
--
--   3) Sumpfboden: bei Wetter='rain' werden Märsche, die ins eigene
--      Stadt-Server kommen, um zusätzliche 8 % verlangsamt (auf Empfangsseite
--      angewendet). UI-Hinweis im Banner.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) Wächter-Spezialtalent-Spalte (best-effort, nur wenn Tabelle da) ──
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_guardians') then
    if not exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'user_guardians' and column_name = 'weather_specialty'
    ) then
      execute 'alter table public.user_guardians add column weather_specialty text';
      execute 'comment on column public.user_guardians.weather_specialty is ''Optional. Einer von rain_master, snow_king, storm_lord, sun_chaser, fog_walker, night_owl. Bei passendem Wetter +15 % auf Wächter-Stats.''';
    end if;
  end if;
end $$;

-- Specialty → Wetter-Bedingung-Mapping
create or replace function public._guardian_specialty_mult(p_user_id uuid, p_guardian_id uuid, p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_specialty text;
  v_cond text;
begin
  if p_guardian_id is null or p_city_slug is null then return 1.0; end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_guardians') then
    return 1.0;
  end if;
  -- dynamisches SQL, falls Spalte fehlt
  begin
    execute format('select weather_specialty from public.user_guardians where id = %L and user_id = %L', p_guardian_id, p_user_id)
      into v_specialty;
  exception when undefined_column then
    return 1.0;
  end;
  if v_specialty is null then return 1.0; end if;
  select condition into v_cond from public.city_weather where city_slug = p_city_slug;
  if v_cond is null then return 1.0; end if;
  if (v_specialty = 'rain_master'  and v_cond = 'rain')  then return 1.15; end if;
  if (v_specialty = 'snow_king'    and v_cond = 'snow')  then return 1.15; end if;
  if (v_specialty = 'storm_lord'   and v_cond = 'storm') then return 1.15; end if;
  if (v_specialty = 'sun_chaser'   and v_cond = 'clear') then return 1.15; end if;
  if (v_specialty = 'fog_walker'   and v_cond = 'fog')   then return 1.15; end if;
  if (v_specialty = 'night_owl'    and v_cond = 'night') then return 1.15; end if;
  return 1.0;
end $$;
grant execute on function public._guardian_specialty_mult(uuid, uuid, text) to authenticated, service_role;

-- Specialty-Katalog (Lookup-View für UI)
create table if not exists public.guardian_weather_specialties (
  code        text primary key,
  label       text not null,
  emoji       text not null,
  weather     text not null,  -- city_weather.condition
  description text not null
);

insert into public.guardian_weather_specialties (code, label, emoji, weather, description) values
  ('rain_master', 'Regenmeister',   '🌧️', 'rain',  'Im Regen +15 % auf Angriff und Verteidigung.'),
  ('snow_king',   'Schneekönig',    '❄️', 'snow',  'Bei Schnee +15 % auf Angriff und Verteidigung.'),
  ('storm_lord',  'Sturmherr',      '⛈️', 'storm', 'Im Sturm +15 % auf Angriff und Verteidigung.'),
  ('sun_chaser',  'Sonnenjäger',    '☀️', 'clear', 'Bei klarem Wetter +15 %.'),
  ('fog_walker',  'Nebelwanderer',  '🌫️', 'fog',   'Im Nebel +15 %.'),
  ('night_owl',   'Nachteule',      '🌙', 'night', 'Bei Nacht +15 %.')
on conflict (code) do update set
  label = excluded.label, emoji = excluded.emoji,
  weather = excluded.weather, description = excluded.description;

grant select on public.guardian_weather_specialties to anon, authenticated;

-- ─── 2) Eis-Wände: Defense-Bonus bei Schnee ──────────────────────────────
create or replace function public._weather_base_def_bonus_pct(p_city_slug text)
returns int language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_city_slug is null then return 0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 0; end if;
  case v_w.condition
    when 'snow'  then return 10;  -- Eis-Wände
    when 'fog'   then return 5;   -- Hinterhalt-Vorteil
    when 'rain'  then return 5;   -- rutschfeste Defensive
    else return 0;
  end case;
end $$;
grant execute on function public._weather_base_def_bonus_pct(text) to authenticated, service_role;

-- ─── 3) Sumpfboden: Marsch-Empfangs-Slow bei Regen ───────────────────────
-- Wird zusätzlich zum Wetter-Movement-Mult auf ankommende Angriffsmärsche
-- angewendet (Anwendung erfolgt in attack-Resolver, hier nur Helper).
create or replace function public._weather_incoming_march_mult(p_dest_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_dest_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_dest_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'rain'  then return 0.92;  -- Sumpfboden
    when 'snow'  then return 0.90;  -- Glatteis
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_incoming_march_mult(text) to authenticated, service_role;

comment on function public._weather_incoming_march_mult(text) is
  'Marsch-Slow für Angriffsmärsche, die in eine Stadt KOMMEN. Sumpfboden (Regen), Glatteis (Schnee).';
