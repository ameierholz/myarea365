-- 00050: Mission-Rewards rebalance.
--
-- Problem: Missions zahlen aktuell ~100 % der Basis-Lauf-Belohnung als Bonus
-- obendrauf (z. B. "5 km sammeln" = +250 🪙 zusätzlich zu den 250 🪙 für die
-- 5 km selbst). Das verdoppelt die Tages-Einnahmen und schiebt Power-User
-- durch die Ranks deutlich schneller als beabsichtigt.
--
-- Fix: Dailies auf ~50 %, Weeklies auf ~40 % der bisherigen Beträge herunter.
-- Missionen bleiben ein spürbarer Boost (+30–50 % Tages-Einnahme), sind aber
-- kein zweites Einkommens-System mehr.

update public.missions set reward_xp = case code
  -- DAILIES (vorher → nachher)
  when 'daily_3_new_streets'   then 150  -- 300
  when 'daily_5_new_streets'   then 250  -- 500
  when 'daily_3km'             then 80   -- 150
  when 'daily_5km'             then 125  -- 250
  when 'daily_10km'            then 300  -- 600
  when 'daily_1_territory'     then 250  -- 500
  when 'daily_20_segments'     then 175  -- 350
  when 'daily_reclaim_10'      then 100  -- 200
  when 'daily_1_arena'         then 125  -- 250
  when 'daily_3_arena'         then 300  -- 600
  when 'daily_guardian_xp_500' then 150  -- 300
  when 'daily_1_qr_scan'       then 100  -- 200
  when 'daily_maintain_streak' then 75   -- 150
  when 'daily_morning_run'     then 125  -- 250
  when 'daily_night_run'       then 125  -- 250
  when 'daily_crew_run'        then 150  -- 300
  when 'daily_gem_shop'        then 50   -- 100
  when 'daily_30min_walk'      then 200  -- 400
  when 'daily_power_zone'      then 100  -- 200
  when 'daily_sanctuary'       then 125  -- 250
  -- WEEKLIES
  when 'weekly_kiez_sweep_10'  then 600  -- 1500
  when 'weekly_ring_close'     then 800  -- 2000
  when 'weekly_25km'           then 500  -- 1200
  when 'weekly_50km'           then 1000 -- 2500
  when 'weekly_5_arena'        then 600  -- 1500
  when 'weekly_crew_3_runs'    then 500  -- 1200
  when 'weekly_streak_7'       then 800  -- 2000
  when 'weekly_guardian_level' then 700  -- 1800
  when 'weekly_3_qr_scans'     then 400  -- 1000
  when 'weekly_3_territories'  then 1200 -- 3000
  else reward_xp
end
where code in (
  'daily_3_new_streets','daily_5_new_streets','daily_3km','daily_5km','daily_10km',
  'daily_1_territory','daily_20_segments','daily_reclaim_10','daily_1_arena','daily_3_arena',
  'daily_guardian_xp_500','daily_1_qr_scan','daily_maintain_streak','daily_morning_run',
  'daily_night_run','daily_crew_run','daily_gem_shop','daily_30min_walk','daily_power_zone',
  'daily_sanctuary',
  'weekly_kiez_sweep_10','weekly_ring_close','weekly_25km','weekly_50km','weekly_5_arena',
  'weekly_crew_3_runs','weekly_streak_7','weekly_guardian_level','weekly_3_qr_scans',
  'weekly_3_territories'
);

-- Default-Wert für künftige Missions-Inserts ebenfalls anpassen.
alter table public.missions alter column reward_xp set default 150;
