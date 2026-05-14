-- ════════════════════════════════════════════════════════════════════════
-- 00373_weather_daily_quests.sql
-- Wetter-bewusste Quests + Auto-Bump-Hook.
--
-- Neue Metriken:
--   marches_in_rain, marches_in_snow, marches_in_storm, marches_in_clear,
--   marches_in_fog, marches_in_night
--   gather_in_heat, weather_boost_used
--   forecast_checked (Daily)
--
-- Wrapper-Funktion bump_quest_with_weather():
--   nimmt User + Base-Metric (z. B. 'marches_started') und bumpt zusätzlich
--   die Wetter-spezifische Variante (marches_in_<condition>). So müssen die
--   Endpoints nicht mehr einzeln Wetter abfragen.
-- ════════════════════════════════════════════════════════════════════════

-- Wrapper für wetter-bewusste Quest-Bumps. Berechnet die aktive condition
-- aus user_active_city() und bumpt zusätzlich die *_in_<cond>-Metrik.
create or replace function public.bump_quest_with_weather(
  p_user_id uuid,
  p_base_metric text,         -- z. B. 'marches_started' oder 'gather_completed'
  p_weather_prefix text,      -- z. B. 'marches_in' (vor _<condition>)
  p_amount numeric default 1
) returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_city text;
  v_cond text;
begin
  if p_user_id is null then return; end if;
  perform public.bump_quest_progress(p_user_id, p_base_metric, p_amount);
  v_city := public.user_active_city(p_user_id);
  if v_city is null then return; end if;
  select condition into v_cond from public.city_weather where city_slug = v_city;
  if v_cond is null then return; end if;
  perform public.bump_quest_progress(p_user_id, p_weather_prefix || '_' || v_cond, p_amount);
end $$;
grant execute on function public.bump_quest_with_weather(uuid, text, text, numeric) to authenticated, service_role;

-- ─── Quest-Seeds ─────────────────────────────────────────────────────────
-- Daily-Wetter-Quests (rotieren weil daily; alle aktiv).
insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, goto_route, rewards) values
  ('daily_rain_marsch',     'daily',    1,  90, 'Regenmarsch',          'Starte heute 1 Marsch bei Regen',           '🌧️', 'marches_in_rain',   1, '/karte', '[{"kind":"gems","amount":25},{"kind":"item","code":"regenmantel","amount":1}]'),
  ('daily_snow_marsch',     'daily',    1,  91, 'Schneemarsch',         'Starte heute 1 Marsch bei Schnee',          '❄️', 'marches_in_snow',   1, '/karte', '[{"kind":"gems","amount":25},{"kind":"item","code":"schneeparka","amount":1}]'),
  ('daily_storm_survive',   'daily',    1,  92, 'Sturm überstehen',     'Starte heute 1 Marsch bei Sturm',            '⛈️', 'marches_in_storm',  1, '/karte', '[{"kind":"gems","amount":40},{"kind":"item","code":"sturmtrotzer","amount":1}]'),
  ('daily_clear_2_marsch',  'daily',    1,  93, 'Sonnen-Tour',          'Starte heute 2 Märsche bei klarem Wetter',  '☀️', 'marches_in_clear',  2, '/karte', '[{"kind":"gems","amount":20},{"kind":"item","code":"sonnenhut","amount":1}]'),
  ('daily_fog_marsch',      'daily',    1,  94, 'Nebelschleier',         'Starte heute 1 Marsch bei Nebel',           '🌫️', 'marches_in_fog',    1, '/karte', '[{"kind":"gems","amount":30},{"kind":"item","code":"nebellampe","amount":1}]'),
  ('daily_night_marsch',    'daily',    1,  95, 'Nachtschicht',         'Starte heute 1 Marsch zwischen 21-6 Uhr',   '🌙', 'marches_in_night',  1, '/karte', '[{"kind":"gems","amount":25},{"kind":"item","code":"nachtsichtbrille","amount":1}]'),
  ('daily_check_forecast',  'daily',    1,  96, 'Vorhersage prüfen',    'Öffne die Wetter-Vorhersage 1 Mal',         '🔮', 'forecast_checked',  1, '/karte', '[{"kind":"gems","amount":10},{"kind":"xp","amount":50}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route, updated_at = now();

-- Weekly-Wetter-Quests
insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, goto_route, rewards) values
  ('weekly_5_weather_marches', 'weekly', 1, 50, 'Wetterfest',          'Starte diese Woche 5 Märsche bei schlechtem Wetter (Regen/Schnee/Sturm)', '🌦️', 'marches_in_rain', 5, '/karte', '[{"kind":"gems","amount":100},{"kind":"item","code":"wetterherz","amount":1}]'),
  ('weekly_clear_combat',      'weekly', 1, 51, 'Sonnen-Krieger',      'Gewinne 3 Arena-Kämpfe bei klarem Wetter',                                '☀️',  'arena_wins',      3, '/karte', '[{"kind":"gems","amount":80},{"kind":"item","code":"sonnenhut","amount":2}]'),
  ('weekly_heat_gather',       'weekly', 1, 52, 'Hitze-Ernter',        'Schließe 10 Gather-Märsche bei Hitze ab (Sommer-Sonderaktion)',           '🔥',  'gather_in_heat', 10, '/karte', '[{"kind":"gems","amount":120},{"kind":"wood","amount":15000},{"kind":"stone","amount":15000}]'),
  ('weekly_boost_use_5',       'weekly', 1, 53, 'Schutz-Experte',      'Aktiviere 5 Wetter-Schutz-Items',                                          '🛡️', 'weather_boost_used', 5, '/karte', '[{"kind":"gems","amount":90},{"kind":"item","code":"premium_forecast_7d","amount":1}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route, updated_at = now();

-- Seasonal-Wetter-Quest
insert into public.quests (code, kind, chapter, sort_order, name, description, icon, target_metric, target_value, goto_route, rewards) values
  ('seasonal_all_weather', 'seasonal', 1, 50, 'Allwetter-Veteran',     'Sammle Märsche in mindestens 5 verschiedenen Wetter-Bedingungen (Saison)', '🌈', 'marches_in_rain', 1, '/karte', '[{"kind":"gems","amount":500},{"kind":"item","code":"wetterherz","amount":3}]')
on conflict (code) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  target_metric = excluded.target_metric, target_value = excluded.target_value,
  rewards = excluded.rewards, goto_route = excluded.goto_route, updated_at = now();
