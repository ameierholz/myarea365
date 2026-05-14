-- 00366_weather_tod_combat_mults.sql
-- Erweiterte Wetter-Combat-Modifier (jede Klasse hat pro Bedingung einen
-- logischen Wert) + NEUE Tageszeit-Modifier. Synchron zu UI-Matrix in
-- time-weather-banner.tsx → WEATHER_META und TIME_META.

create or replace function public._weather_atk_mult(p_city_slug text, p_troop_class text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_w public.city_weather;
begin
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'clear' then
      if p_troop_class = 'marksman' then return 1.05; end if;
    when 'rain' then
      if p_troop_class = 'marksman' then return 0.80; end if;
      if p_troop_class = 'gatherer' then return 0.95; end if;
    when 'snow' then
      if p_troop_class = 'architect' then return 1.10; end if;
      if p_troop_class = 'cavalry'   then return 0.85; end if;
    when 'storm' then
      if p_troop_class = 'marksman'  then return 0.70; end if;
      if p_troop_class = 'siege'     then return 1.15; end if;
      if p_troop_class = 'architect' then return 0.90; end if;
      if p_troop_class = 'cavalry'   then return 0.90; end if;
    when 'heat' then
      if p_troop_class = 'gatherer' then return 1.10; end if;
      if p_troop_class = 'siege'    then return 0.90; end if;
    when 'fog' then
      if p_troop_class = 'marksman' then return 0.85; end if;
      if p_troop_class = 'cavalry'  then return 0.90; end if;
    when 'night' then
      if p_troop_class = 'cavalry'  then return 1.15; end if;
      if p_troop_class = 'marksman' then return 0.85; end if;
    else null;
  end case;
  return 1.0;
end $$;

create or replace function public._weather_def_mult(p_city_slug text, p_troop_class text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_w public.city_weather;
begin
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'rain' then
      if p_troop_class = 'infantry' then return 1.10; end if;
    when 'snow' then
      if p_troop_class = 'infantry' then return 1.05; end if;
    when 'heat' then
      if p_troop_class = 'infantry' then return 0.90; end if;
    when 'fog' then
      if p_troop_class = 'infantry' then return 1.10; end if;
    when 'night' then
      if p_troop_class = 'infantry' then return 1.05; end if;
    else null;
  end case;
  return 1.0;
end $$;

-- NEUE Tageszeit-Modifier (Europe/Berlin-Stunden).
-- 6-10=Morgen, 10-17=Tag, 17-21=Abend, sonst Nacht.
create or replace function public._tod_atk_mult(p_troop_class text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_hour int := extract(hour from (now() at time zone 'Europe/Berlin'))::int;
  v_tod text := case
    when v_hour >= 6 and v_hour < 10 then 'morning'
    when v_hour >= 10 and v_hour < 17 then 'day'
    when v_hour >= 17 and v_hour < 21 then 'evening'
    else 'night'
  end;
begin
  case v_tod
    when 'morning' then
      if p_troop_class = 'cavalry'  then return 1.10; end if;
      if p_troop_class = 'gatherer' then return 1.10; end if;
      if p_troop_class = 'siege'    then return 0.95; end if;
    when 'day' then
      if p_troop_class = 'marksman'  then return 1.10; end if;
      if p_troop_class = 'architect' then return 1.10; end if;
      if p_troop_class = 'infantry'  then return 1.05; end if;
    when 'evening' then
      if p_troop_class = 'infantry' then return 1.05; end if;
      if p_troop_class = 'gatherer' then return 1.05; end if;
      if p_troop_class = 'marksman' then return 0.95; end if;
    when 'night' then
      if p_troop_class = 'cavalry'   then return 1.15; end if;
      if p_troop_class = 'infantry'  then return 1.05; end if;
      if p_troop_class = 'marksman'  then return 0.85; end if;
      if p_troop_class = 'architect' then return 0.95; end if;
    else null;
  end case;
  return 1.0;
end $$;

create or replace function public._tod_def_mult(p_troop_class text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_hour int := extract(hour from (now() at time zone 'Europe/Berlin'))::int;
  v_tod text := case
    when v_hour >= 6 and v_hour < 10 then 'morning'
    when v_hour >= 10 and v_hour < 17 then 'day'
    when v_hour >= 17 and v_hour < 21 then 'evening'
    else 'night'
  end;
begin
  case v_tod
    when 'evening' then
      if p_troop_class = 'infantry' then return 1.05; end if;
    when 'night' then
      if p_troop_class = 'infantry' then return 1.05; end if;
    else null;
  end case;
  return 1.0;
end $$;

-- resolve_player_base_attack: ATK + DEF multiplizieren jetzt zusätzlich
-- mit _tod_atk_mult / _tod_def_mult. Schlacht-Report enthält neue Zeile
-- "🕒 Tageszeit: …". Volltext siehe Migration in Supabase.
