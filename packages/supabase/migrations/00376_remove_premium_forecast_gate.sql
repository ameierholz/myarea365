-- 00376_remove_premium_forecast_gate.sql
-- Premium-Forecast wird kostenlos für alle. Wetterdaten sind im Internet frei
-- verfügbar — keine Paywall darauf.
update public.inventory_item_catalog set active = false where id = 'premium_forecast_7d';

create or replace function public.has_premium_forecast()
returns boolean language sql stable
set search_path = public, pg_temp
as $$ select true; $$;
grant execute on function public.has_premium_forecast() to authenticated;

update public.quests
   set rewards = '[{"kind":"gems","amount":150},{"kind":"item","code":"wetterherz","amount":1}]'
 where code = 'weekly_boost_use_5';
