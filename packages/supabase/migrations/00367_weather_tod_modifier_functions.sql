-- ════════════════════════════════════════════════════════════════════════
-- 00367_weather_tod_modifier_functions.sql
-- Umfassendes Modifier-System für Wetter + Tageszeit (Bewegung, Wirtschaft,
-- Sicht, Heilung). Synchron zur UI-Matrix in time-weather-banner.tsx und
-- den Kampf-Modifiern aus 00366. Alle Helper liefern numeric (Multiplikator),
-- Default 1.0 ⇒ kein Effekt. Damit kompatibel zu bestehendem Code.
--
-- Konvention:
--   *_mult > 1.0 = schneller / mehr / besser
--   *_mult < 1.0 = langsamer / weniger / schlechter
--
-- Tageszeit (Europe/Berlin): 6-10 Morgen, 10-17 Tag, 17-21 Abend, sonst Nacht
-- ════════════════════════════════════════════════════════════════════════

-- city_weather um Wind-Richtung erweitern (für richtungsabhängiges
-- Marsch-Tempo). 0° = Norden, 90° = Osten. NULL = unbekannt (= neutral).
alter table public.city_weather
  add column if not exists wind_dir_deg int;

-- Aktuelle Tageszeit (Helper, vermeidet 4× Wiederholung im File)
create or replace function public._current_tod()
returns text language sql stable
set search_path = public, pg_temp
as $$
  select case
    when extract(hour from (now() at time zone 'Europe/Berlin'))::int >=  6
     and extract(hour from (now() at time zone 'Europe/Berlin'))::int < 10 then 'morning'
    when extract(hour from (now() at time zone 'Europe/Berlin'))::int >= 10
     and extract(hour from (now() at time zone 'Europe/Berlin'))::int < 17 then 'day'
    when extract(hour from (now() at time zone 'Europe/Berlin'))::int >= 17
     and extract(hour from (now() at time zone 'Europe/Berlin'))::int < 21 then 'evening'
    else 'night'
  end;
$$;
grant execute on function public._current_tod() to authenticated, service_role;

-- ─── BEWEGUNG ────────────────────────────────────────────────────────────
-- Globaler Marsch-Tempo-Modifier (richtungsunabhängig). Sturm verlangsamt
-- alle, Regen nur leicht, Nacht +5 % (kühl), Hitze -10 %.
create or replace function public._weather_movement_mult(p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_w public.city_weather;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'rain'  then return 0.92;
    when 'snow'  then return 0.80;
    when 'storm' then return 0.70;
    when 'heat'  then return 0.90;
    when 'fog'   then return 0.88;
    when 'night' then return 1.05;
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_movement_mult(text) to authenticated, service_role;

-- Wind-Modifier: zusätzlicher Bonus/Malus je nach Marsch-Richtung relativ
-- zur Windrichtung. Volle Rückenwind: +Mult, voller Gegenwind: -Mult.
-- Skala mit Geschwindigkeit (kmh). Glatte Cosinus-Kurve.
create or replace function public._wind_direction_mult(
  p_city_slug text,
  p_origin_lat double precision, p_origin_lng double precision,
  p_dest_lat   double precision, p_dest_lng   double precision
) returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_w public.city_weather;
  v_march_dir_rad numeric;
  v_wind_dir_rad numeric;
  v_delta_rad numeric;
  v_cos numeric;
  v_factor numeric;
  v_dlat numeric;
  v_dlng numeric;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null or v_w.wind_dir_deg is null or v_w.wind_kmh < 8 then
    return 1.0;
  end if;

  v_dlat := p_dest_lat - p_origin_lat;
  v_dlng := p_dest_lng - p_origin_lng;
  if v_dlat = 0 and v_dlng = 0 then return 1.0; end if;
  -- atan2(Δlng, Δlat): 0 = Norden, π/2 = Osten — passt zu deg-Kompass
  v_march_dir_rad := atan2(v_dlng, v_dlat);
  v_wind_dir_rad  := radians(v_w.wind_dir_deg::numeric);
  -- Wind weht VON Richtung X, der Vorwärts-Effekt ist andersrum (π Versatz):
  v_delta_rad := v_march_dir_rad - (v_wind_dir_rad + pi());
  v_cos := cos(v_delta_rad);
  -- ±8 % bei 50 km/h, linear skaliert (cap 80 km/h).
  v_factor := 0.0016 * least(v_w.wind_kmh, 80);
  return 1.0 + v_factor * v_cos;
end $$;
grant execute on function public._wind_direction_mult(text, double precision, double precision, double precision, double precision) to authenticated, service_role;

-- Scout-Reichweite: Klar +20 %, Nebel -40 %, Sturm -30 %, Nacht -25 %.
create or replace function public._weather_scout_range_mult(p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'clear' then return 1.20;
    when 'fog'   then return 0.60;
    when 'storm' then return 0.70;
    when 'rain'  then return 0.85;
    when 'snow'  then return 0.80;
    when 'night' then return 0.75;
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_scout_range_mult(text) to authenticated, service_role;

-- Sicht-Modifier (Marsch-Reveal-Radius). Wie Scout, aber milder.
create or replace function public._weather_visibility_mult(p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'clear' then return 1.10;
    when 'fog'   then return 0.50;
    when 'storm' then return 0.75;
    when 'rain'  then return 0.90;
    when 'night' then return 0.80;
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_visibility_mult(text) to authenticated, service_role;

-- ─── WIRTSCHAFT ──────────────────────────────────────────────────────────
-- Sammel-Yield (RSS aus Plünder-Nodes / Gather-Marsch)
create or replace function public._weather_gather_mult(p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'clear' then return 1.05;
    when 'rain'  then return 0.90;
    when 'storm' then return 0.75;
    when 'snow'  then return 0.85;
    when 'heat'  then return 1.10;  -- Sommerernte
    when 'fog'   then return 0.95;
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_gather_mult(text) to authenticated, service_role;

-- Bauzeit-Modifier (kleiner = schneller). Klar = optimaler Arbeitstag.
create or replace function public._weather_build_mult(p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'clear' then return 0.95;
    when 'rain'  then return 1.10;
    when 'storm' then return 1.30;
    when 'snow'  then return 1.20;
    when 'heat'  then return 1.08;
    when 'fog'   then return 1.05;
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_build_mult(text) to authenticated, service_role;

-- Forschungs-Tempo
create or replace function public._weather_research_mult(p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'rain'  then return 0.93;  -- konzentriert im Trockenen
    when 'storm' then return 0.85;
    when 'fog'   then return 0.92;
    when 'clear' then return 1.02;
    when 'snow'  then return 0.95;
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_research_mult(text) to authenticated, service_role;

-- Lazarett-Heilung (Heil-Zeit-Modifier). Klar+Tag = schnell, Sturm = langsam.
create or replace function public._weather_heal_mult(p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_w public.city_weather;
begin
  if p_city_slug is null then return 1.0; end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'clear' then return 0.93;
    when 'rain'  then return 1.08;
    when 'storm' then return 1.20;
    when 'snow'  then return 1.10;
    when 'heat'  then return 1.05;
    else return 1.0;
  end case;
end $$;
grant execute on function public._weather_heal_mult(text) to authenticated, service_role;

-- ─── TAGESZEIT-MODIFIER (Wirtschaft) ─────────────────────────────────────
create or replace function public._tod_build_mult()
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_tod text := public._current_tod();
begin
  case v_tod
    when 'morning' then return 0.97;  -- Konstrukteure früh produktiv
    when 'day'     then return 0.95;
    when 'evening' then return 1.00;
    when 'night'   then return 1.05;
  end case;
end $$;
grant execute on function public._tod_build_mult() to authenticated, service_role;

create or replace function public._tod_research_mult()
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_tod text := public._current_tod();
begin
  case v_tod
    when 'morning' then return 0.98;
    when 'day'     then return 0.95;  -- Akademie aktiv
    when 'evening' then return 1.00;
    when 'night'   then return 1.03;  -- Lesen müder
  end case;
end $$;
grant execute on function public._tod_research_mult() to authenticated, service_role;

create or replace function public._tod_heal_mult()
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_tod text := public._current_tod();
begin
  case v_tod
    when 'morning' then return 0.97;
    when 'day'     then return 0.95;  -- Tageslicht, beste Versorgung
    when 'evening' then return 1.00;
    when 'night'   then return 1.05;
  end case;
end $$;
grant execute on function public._tod_heal_mult() to authenticated, service_role;

create or replace function public._tod_gather_mult()
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_tod text := public._current_tod();
begin
  case v_tod
    when 'morning' then return 1.05;  -- Frühaufsteher-Bonus
    when 'day'     then return 1.00;
    when 'evening' then return 1.00;
    when 'night'   then return 0.95;
  end case;
end $$;
grant execute on function public._tod_gather_mult() to authenticated, service_role;

-- ─── COMBINED HELPERS (Wetter × Tageszeit) ───────────────────────────────
-- Praktische All-in-One-Helper, die UI/RPC einfach aufrufen können.
create or replace function public.combined_build_mult(p_city_slug text)
returns numeric language sql stable
set search_path = public, pg_temp
as $$ select public._weather_build_mult(p_city_slug) * public._tod_build_mult(); $$;

create or replace function public.combined_research_mult(p_city_slug text)
returns numeric language sql stable
set search_path = public, pg_temp
as $$ select public._weather_research_mult(p_city_slug) * public._tod_research_mult(); $$;

create or replace function public.combined_heal_mult(p_city_slug text)
returns numeric language sql stable
set search_path = public, pg_temp
as $$ select public._weather_heal_mult(p_city_slug) * public._tod_heal_mult(); $$;

create or replace function public.combined_gather_mult(p_city_slug text)
returns numeric language sql stable
set search_path = public, pg_temp
as $$ select public._weather_gather_mult(p_city_slug) * public._tod_gather_mult(); $$;

grant execute on function public.combined_build_mult(text)    to authenticated, service_role;
grant execute on function public.combined_research_mult(text) to authenticated, service_role;
grant execute on function public.combined_heal_mult(text)     to authenticated, service_role;
grant execute on function public.combined_gather_mult(text)   to authenticated, service_role;

-- Einer-für-alles JSON-Bundle für UI (1 Roundtrip)
create or replace function public.get_weather_effects_bundle()
returns jsonb language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_city text;
  v_w public.city_weather;
  v_tod text := public._current_tod();
begin
  if v_user is null then return null; end if;
  select home_city_slug into v_city from public.users where id = v_user;
  if v_city is null then
    select slug into v_city from public.cities where is_active = true order by slug limit 1;
  end if;
  select * into v_w from public.city_weather where city_slug = v_city;

  return jsonb_build_object(
    'city_slug', v_city,
    'tod', v_tod,
    'weather', case when v_w is null then null else jsonb_build_object(
      'condition', v_w.condition,
      'temperature_c', v_w.temperature_c,
      'wind_kmh', v_w.wind_kmh,
      'wind_dir_deg', v_w.wind_dir_deg,
      'precipitation_mm', v_w.precipitation_mm,
      'is_night', v_w.is_night,
      'provider', v_w.provider,
      'updated_at', v_w.updated_at
    ) end,
    'mults', jsonb_build_object(
      'movement',   public._weather_movement_mult(v_city),
      'scout',      public._weather_scout_range_mult(v_city),
      'visibility', public._weather_visibility_mult(v_city),
      'gather',     public.combined_gather_mult(v_city),
      'build',      public.combined_build_mult(v_city),
      'research',   public.combined_research_mult(v_city),
      'heal',       public.combined_heal_mult(v_city)
    )
  );
end $$;
grant execute on function public.get_weather_effects_bundle() to authenticated;
