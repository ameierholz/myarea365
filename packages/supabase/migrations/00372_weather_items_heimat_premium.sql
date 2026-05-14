-- ════════════════════════════════════════════════════════════════════════
-- 00372_weather_items_heimat_premium.sql
-- 1) Wetter-Schutz-Items (Regenmantel, Sonnenhut, Sturmtrotzer …) als
--    Boosts im inventory_item_catalog.
-- 2) Heimat-Boost — User-Score-Bonus, wenn er sich in der zugewiesenen
--    home_city aufhält (Helper-Funktion + Premium-Trick).
-- 3) Premium-Vorhersage-Flag (premium_forecast_until) — gibt Zugriff auf
--    bis zu 5 Vorhersage-Tage statt 3.
-- 4) Stadt-Wandern — temporäres travel_city_slug-Feld, das die aktive
--    Wetter-Stadt für einen User überschreibt (bis travel_expires_at).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) Wetter-Schutz-Items im Catalog ──────────────────────────────────
-- Category 'boost' mit effect = 'weather_<condition>'. value_pct = Reduktion
-- des Wetter-Maluses (z. B. 50 = Malus halbieren).
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order, active) values
  ('regenmantel',   'boost', 'Regenmantel',     'Negiert 50 % des Regen-Malus für 4 h.',          '🌧️', 'common',    '{"effect":"weather_rain","duration_h":4,"value_pct":50}'::jsonb, 700, true),
  ('schneeparka',   'boost', 'Schnee-Parka',    'Negiert 50 % des Schnee-Malus für 4 h.',         '❄️', 'common',    '{"effect":"weather_snow","duration_h":4,"value_pct":50}'::jsonb, 701, true),
  ('sturmtrotzer',  'boost', 'Sturmtrotzer',    'Negiert 50 % des Sturm-Malus für 4 h.',          '⛈️', 'rare',      '{"effect":"weather_storm","duration_h":4,"value_pct":50}'::jsonb, 702, true),
  ('sonnenhut',     'boost', 'Sonnenhut',       'Negiert den Hitze-Malus für 4 h.',                '🔥', 'common',    '{"effect":"weather_heat","duration_h":4,"value_pct":100}'::jsonb, 703, true),
  ('nebellampe',    'boost', 'Nebel-Lampe',     'Negiert Nebel-Sichtmalus für 4 h.',               '🌫️', 'rare',      '{"effect":"weather_fog","duration_h":4,"value_pct":100}'::jsonb, 704, true),
  ('nachtsichtbrille','boost','Nachtsichtbrille','Negiert Nacht-Sichtmalus + Bewegung für 4 h.',    '🌙', 'epic',      '{"effect":"weather_night","duration_h":4,"value_pct":100}'::jsonb, 705, true),
  ('wetterherz',    'boost', 'Wetter-Herz',     'Immunität gegen ALLE Wetter-Mali für 1 h.',       '💖', 'legendary', '{"effect":"weather_any","duration_h":1,"value_pct":100}'::jsonb, 706, true)
on conflict (id) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  emoji = excluded.emoji,
  rarity = excluded.rarity,
  payload = excluded.payload,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- Active-Boost-Tabelle (entkoppelt von consume — Buff läuft separat).
create table if not exists public.user_weather_boosts (
  user_id    uuid not null references public.users(id) on delete cascade,
  effect     text not null,   -- weather_rain, weather_snow, ..., weather_any
  expires_at timestamptz not null,
  value_pct  int not null default 50,
  primary key (user_id, effect)
);
alter table public.user_weather_boosts enable row level security;
drop policy if exists user_weather_boosts_read_own on public.user_weather_boosts;
create policy user_weather_boosts_read_own on public.user_weather_boosts
  for select to authenticated using (auth.uid() = user_id);

-- Effective Wetter-Mult für User (mit Buff-Reduktion). Liefert numeric mult,
-- der auf Marsch/Sammel/Bauen angewendet werden kann. Buff-System ist
-- multiplikativ-glättend: Statt der harten 0.70 (Sturm) wird die Distanz
-- zu 1.0 um value_pct/100 reduziert.
create or replace function public._effective_weather_mult(
  p_user_id uuid, p_city_slug text, p_base_mult numeric, p_condition_tag text
) returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_buff record;
  v_w public.city_weather;
  v_relevant boolean := false;
  v_reduction numeric;
begin
  if p_user_id is null or p_city_slug is null or p_base_mult is null then return coalesce(p_base_mult, 1.0); end if;
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return p_base_mult; end if;

  -- Generischer "weather_any"-Buff
  select * into v_buff from public.user_weather_boosts
   where user_id = p_user_id and effect = 'weather_any' and expires_at > now();
  if found then
    v_reduction := least(100, greatest(0, v_buff.value_pct)) / 100.0;
    return p_base_mult + (1.0 - p_base_mult) * v_reduction;
  end if;

  -- Spezifischer Buff für die aktuelle Condition
  if p_condition_tag is null then return p_base_mult; end if;
  select * into v_buff from public.user_weather_boosts
   where user_id = p_user_id and effect = 'weather_' || v_w.condition and expires_at > now();
  if found then
    v_reduction := least(100, greatest(0, v_buff.value_pct)) / 100.0;
    return p_base_mult + (1.0 - p_base_mult) * v_reduction;
  end if;
  return p_base_mult;
end $$;
grant execute on function public._effective_weather_mult(uuid, text, numeric, text) to authenticated, service_role;

-- Activate-Wrapper für Consume-Pfad
create or replace function public.activate_weather_boost(p_item_code text)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_def record;
  v_eff text;
  v_dur int;
  v_pct int;
  v_have int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into v_def from public.inventory_item_catalog where id = p_item_code;
  if v_def is null or v_def.category <> 'boost' then
    return jsonb_build_object('ok', false, 'error', 'item_not_found');
  end if;

  v_eff := v_def.payload->>'effect';
  v_dur := coalesce((v_def.payload->>'duration_h')::int, 4);
  v_pct := coalesce((v_def.payload->>'value_pct')::int, 50);
  if v_eff is null or v_eff not like 'weather_%' then
    return jsonb_build_object('ok', false, 'error', 'wrong_item_kind');
  end if;

  select count into v_have from public.user_inventory_items where user_id = v_user and catalog_id = p_item_code;
  if coalesce(v_have, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_stock');
  end if;

  update public.user_inventory_items set count = count - 1
   where user_id = v_user and catalog_id = p_item_code;

  insert into public.user_weather_boosts (user_id, effect, expires_at, value_pct)
  values (v_user, v_eff, now() + (v_dur || ' hours')::interval, v_pct)
  on conflict (user_id, effect) do update set
    expires_at = greatest(user_weather_boosts.expires_at, excluded.expires_at),
    value_pct  = greatest(user_weather_boosts.value_pct, excluded.value_pct);

  return jsonb_build_object('ok', true, 'effect', v_eff, 'value_pct', v_pct, 'duration_h', v_dur);
end $$;
grant execute on function public.activate_weather_boost(text) to authenticated;

-- ─── 2) Heimat-Boost ─────────────────────────────────────────────────────
-- +5 % auf Wirtschaft, wenn der User in seiner home_city aktiv ist.
-- (Wir haben momentan kein Travel-System — sobald travel_city_slug aktiv,
-- gilt das nicht für die ursprüngliche Heimat.)
create or replace function public._heimat_boost_mult(p_user_id uuid, p_city_slug text)
returns numeric language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_home text;
  v_travel text;
begin
  if p_user_id is null or p_city_slug is null then return 1.0; end if;
  -- Travel überschreibt home → kein Heimat-Boost wenn unterwegs
  begin
    execute 'select home_city_slug, travel_city_slug from public.users where id = $1'
       into v_home, v_travel using p_user_id;
  exception when undefined_column then
    select home_city_slug into v_home from public.users where id = p_user_id;
    v_travel := null;
  end;
  if v_travel is not null then return 1.0; end if;
  if v_home = p_city_slug then return 1.05; end if;
  return 1.0;
end $$;
grant execute on function public._heimat_boost_mult(uuid, text) to authenticated, service_role;

-- ─── 3) Premium-Vorhersage ───────────────────────────────────────────────
alter table public.users
  add column if not exists premium_forecast_until timestamptz;

create or replace function public.has_premium_forecast()
returns boolean language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(premium_forecast_until > now(), false)
    from public.users where id = auth.uid();
$$;
grant execute on function public.has_premium_forecast() to authenticated;

-- Premium-Vorhersage als Shop-Item registrieren (7 Tage Laufzeit, gem-cost
-- bewusst nicht hier — IAP-Channel-Split, siehe Memory project_iap_channel_split).
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order, active) values
  ('premium_forecast_7d', 'token', 'Premium-Vorhersage 7 Tage', 'Schaltet die 5-Tage-Wettervorhersage für 7 Tage frei.', '🔮', 'epic',
   '{"effect":"premium_forecast","days":7}'::jsonb, 800, true)
on conflict (id) do update set
  category = excluded.category, name = excluded.name, description = excluded.description,
  emoji = excluded.emoji, rarity = excluded.rarity, payload = excluded.payload,
  sort_order = excluded.sort_order, active = excluded.active;

create or replace function public.activate_premium_forecast()
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_have int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select count into v_have from public.user_inventory_items where user_id = v_user and catalog_id = 'premium_forecast_7d';
  if coalesce(v_have, 0) < 1 then return jsonb_build_object('ok', false, 'error', 'no_stock'); end if;
  update public.user_inventory_items set count = count - 1
   where user_id = v_user and catalog_id = 'premium_forecast_7d';
  update public.users
     set premium_forecast_until = greatest(coalesce(premium_forecast_until, now()), now()) + interval '7 days'
   where id = v_user;
  return jsonb_build_object('ok', true, 'until', (select premium_forecast_until from public.users where id = v_user));
end $$;
grant execute on function public.activate_premium_forecast() to authenticated;

-- ─── 4) Stadt-Wandern ────────────────────────────────────────────────────
-- Temporärer Reise-Modus: travel_city_slug gilt für Wetter-Lookups,
-- bis travel_expires_at abgelaufen. home_city_slug bleibt unverändert.
alter table public.users
  add column if not exists travel_city_slug text references public.cities(slug),
  add column if not exists travel_expires_at timestamptz;

-- Aktiv-Stadt für einen User berechnen (Travel > Home > Fallback).
create or replace function public.user_active_city(p_user_id uuid)
returns text language plpgsql stable
set search_path = public, pg_temp
as $$
declare
  v_home text;
  v_travel text;
  v_travel_exp timestamptz;
  v_fallback text;
begin
  if p_user_id is null then return null; end if;
  select home_city_slug, travel_city_slug, travel_expires_at
    into v_home, v_travel, v_travel_exp from public.users where id = p_user_id;
  if v_travel is not null and v_travel_exp is not null and v_travel_exp > now() then
    return v_travel;
  end if;
  if v_home is not null then return v_home; end if;
  select slug into v_fallback from public.cities where is_active = true order by slug limit 1;
  return v_fallback;
end $$;
grant execute on function public.user_active_city(uuid) to authenticated, service_role;

-- Reise-RPC (24 h, kostenlos in dieser Phase)
create or replace function public.start_city_travel(p_target_slug text, p_hours int default 24)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_ok boolean;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select exists(select 1 from public.cities where slug = p_target_slug and is_active = true) into v_ok;
  if not v_ok then return jsonb_build_object('ok', false, 'error', 'city_not_found'); end if;
  if p_hours < 1 or p_hours > 168 then return jsonb_build_object('ok', false, 'error', 'hours_out_of_range'); end if;
  update public.users
     set travel_city_slug = p_target_slug,
         travel_expires_at = now() + (p_hours || ' hours')::interval
   where id = v_user;
  return jsonb_build_object('ok', true, 'city_slug', p_target_slug, 'expires_at', now() + (p_hours || ' hours')::interval);
end $$;
grant execute on function public.start_city_travel(text, int) to authenticated;
