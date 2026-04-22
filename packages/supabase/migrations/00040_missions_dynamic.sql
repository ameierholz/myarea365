-- 00040: Dynamisches Missions-System (Admin-pflegbar).
-- Ersetzt hart kodierte DEMO_MISSIONS durch Pool + tägliche/wöchentliche Zuweisung.

-- 1) Pool-Tabelle: Templates, die Admin pflegt
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                -- z.B. "walk_3_new_streets"
  type text not null check (type in ('daily','weekly')),
  category text not null default 'general', -- 'distance','streets','territory','guardian','arena','shop','streak','crew'
  name text not null,
  description text not null,
  icon text not null default '🎯',
  target_metric text not null,              -- 'new_streets','total_km_today','territories_closed','arena_wins','shop_scans','guardian_xp_today','new_segments','streak_maintained'
  target_value int not null default 1,
  reward_xp int not null default 200,
  active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_missions_active_type on public.missions(active, type);

-- 2) Zuweisungstabelle: welche Missions welcher User wann bekommen hat + Fortschritt
create table if not exists public.user_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  assigned_for_date date not null default (now() at time zone 'Europe/Berlin')::date,
  progress numeric not null default 0,
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, mission_id, assigned_for_date)
);

create index if not exists idx_user_missions_user_date on public.user_missions(user_id, assigned_for_date desc);

-- 3) RLS
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='missions' and policyname='select_public_active') then
    create policy select_public_active on public.missions for select using (active = true);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_missions' and policyname='select_own') then
    create policy select_own on public.user_missions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_missions' and policyname='update_own') then
    create policy update_own on public.user_missions for update using (auth.uid() = user_id);
  end if;
end $$;

-- 4) RPC: Assigne 3 Dailies + 1 Weekly für heute wenn noch nicht geschehen
create or replace function public.assign_daily_missions(p_user_id uuid)
returns table(mission_id uuid, is_new boolean)
language plpgsql
security definer
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_monday date := v_today - extract(dow from v_today)::int + 1;
  v_existing_dailies int;
  v_existing_weekly int;
  v_pick record;
begin
  -- Bestehende Zuweisungen für heute zählen
  select count(*) into v_existing_dailies
  from public.user_missions um
  join public.missions m on m.id = um.mission_id
  where um.user_id = p_user_id
    and um.assigned_for_date = v_today
    and m.type = 'daily';

  -- 3 Dailies aus aktivem Pool ziehen (zufällig, nur wenn noch nicht 3 zugewiesen)
  if v_existing_dailies < 3 then
    for v_pick in
      select id from public.missions
      where active = true and type = 'daily'
        and id not in (
          select mission_id from public.user_missions
          where user_id = p_user_id and assigned_for_date = v_today
        )
      order by random()
      limit (3 - v_existing_dailies)
    loop
      insert into public.user_missions (user_id, mission_id, assigned_for_date)
      values (p_user_id, v_pick.id, v_today)
      on conflict (user_id, mission_id, assigned_for_date) do nothing;
    end loop;
  end if;

  -- 1 Weekly für diese Woche (falls noch keine für Montag der Woche zugewiesen)
  select count(*) into v_existing_weekly
  from public.user_missions um
  join public.missions m on m.id = um.mission_id
  where um.user_id = p_user_id
    and um.assigned_for_date = v_monday
    and m.type = 'weekly';

  if v_existing_weekly < 1 then
    for v_pick in
      select id from public.missions
      where active = true and type = 'weekly'
      order by random()
      limit 1
    loop
      insert into public.user_missions (user_id, mission_id, assigned_for_date)
      values (p_user_id, v_pick.id, v_monday)
      on conflict (user_id, mission_id, assigned_for_date) do nothing;
    end loop;
  end if;

  return query
    select um.mission_id, (um.created_at > now() - interval '5 seconds') as is_new
    from public.user_missions um
    join public.missions m on m.id = um.mission_id
    where um.user_id = p_user_id
      and (um.assigned_for_date = v_today or (m.type = 'weekly' and um.assigned_for_date = v_monday));
end $$;

grant execute on function public.assign_daily_missions(uuid) to authenticated, service_role;

-- 5) Initial-Seed: 20 Dailies + 10 Weeklies
insert into public.missions (code, type, category, name, description, icon, target_metric, target_value, reward_xp, sort_order) values
  -- DAILIES
  ('daily_3_new_streets',    'daily','streets',  '3 neue Straßen',        'Erlaufe 3 Straßen, die du noch nie betreten hast',      '🆕', 'new_streets',       3, 300, 10),
  ('daily_5_new_streets',    'daily','streets',  '5 neue Straßen',        'Fünf frische Straßen heute — Forscher-Modus',          '🧭', 'new_streets',       5, 500, 11),
  ('daily_3km',              'daily','distance', '3 km sammeln',          'Schaffe heute insgesamt 3 km Strecke',                  '📏', 'total_km_today',    3, 150, 20),
  ('daily_5km',              'daily','distance', '5 km sammeln',          'Heute 5 km machen',                                     '📐', 'total_km_today',    5, 250, 21),
  ('daily_10km',             'daily','distance', '10 km Marathon-Light',  'Zehn Kilometer an einem Tag',                           '🏃', 'total_km_today',   10, 600, 22),
  ('daily_1_territory',      'daily','territory','1 Territorium schließen','Schließe einen Ring aus Straßenzügen',                 '🔒', 'territories_closed',1, 500, 30),
  ('daily_20_segments',      'daily','streets',  '20 Abschnitte',         'Erobere 20 neue Straßenabschnitte',                     '🛤️', 'new_segments',     20, 350, 40),
  ('daily_reclaim_10',       'daily','streets',  '10 Stammstrecken',      'Laufe 10 deiner alten Abschnitte neu (Reclaim-Bonus)',  '♻️', 'reclaim_segments', 10, 200, 41),
  ('daily_1_arena',          'daily','arena',    '1 Arena-Sieg',          'Gewinne heute mindestens einen Wächter-Kampf',          '⚔️', 'arena_wins',        1, 250, 50),
  ('daily_3_arena',          'daily','arena',    '3 Arena-Siege',         'Drei Arena-Kämpfe gewonnen',                            '🏆', 'arena_wins',        3, 600, 51),
  ('daily_guardian_xp_500',  'daily','guardian', 'Wächter-XP 500',        'Dein Wächter sammelt heute 500 XP',                     '🛡️', 'guardian_xp_today',500, 300, 60),
  ('daily_1_qr_scan',        'daily','shop',     '1 QR-Code scannen',     'Scanne einen Partner-Shop für Rabatt + Siegel',         '📱', 'shop_scans',        1, 200, 70),
  ('daily_maintain_streak',  'daily','streak',   'Streak halten',         'Halte deine Tages-Streak — laufe mindestens 500 m',     '🔥', 'streak_maintained', 1, 150, 80),
  ('daily_morning_run',      'daily','distance', 'Frühaufsteher',         'Laufe vor 10 Uhr morgens mindestens 1 km',              '🌅', 'morning_km',        1, 250, 81),
  ('daily_night_run',        'daily','distance', 'Nachtschicht',          'Laufe nach 20 Uhr mindestens 1 km',                     '🌙', 'night_km',          1, 250, 82),
  ('daily_crew_run',         'daily','crew',     'Crew-Support',          'Lauf innerhalb deines Crew-Reviers (PLZ)',              '👥', 'crew_km',           1, 300, 90),
  ('daily_gem_shop',         'daily','shop',     'Tages-Deal holen',      'Kauf einen der täglichen Packs',                        '💎', 'daily_pack_bought', 1, 100, 91),
  ('daily_30min_walk',       'daily','distance', 'Langer Lauf',           'Laufe am Stück mindestens 30 Minuten',                  '⏱️', 'longest_walk_min', 30, 400, 92),
  ('daily_power_zone',       'daily','territory','Power-Zone besuchen',   'Lauf durch eine Power-Zone',                            '⚡', 'power_zone_visits', 1, 200, 93),
  ('daily_sanctuary',        'daily','guardian', 'Sanktum-Training',      'Besuche ein Sanktum für den Wächter-XP-Boost',          '🏛️', 'sanctuary_visits',  1, 250, 94),

  -- WEEKLIES
  ('weekly_kiez_sweep_10',   'weekly','streets',  'Kiez-Sweep',            '10 verschiedene Straßen in 7 Tagen erobern',           '🧹', 'weekly_new_streets',10, 1500, 10),
  ('weekly_ring_close',      'weekly','territory','Gebiet einkreisen',     'Schließe einen Straßen-Ring um einen Block',           '🔲', 'weekly_territories', 1, 2000, 20),
  ('weekly_25km',            'weekly','distance', '25 km Wochenstrecke',   '25 km in 7 Tagen',                                     '🏃‍♂️','weekly_km',         25, 1200, 30),
  ('weekly_50km',            'weekly','distance', '50 km Langstrecke',     'Halbes Hundert in einer Woche',                        '💯', 'weekly_km',         50, 2500, 31),
  ('weekly_5_arena',         'weekly','arena',    '5 Arena-Siege',         'Fünf gewonnene Wächter-Kämpfe in 7 Tagen',             '⚔️', 'weekly_arena_wins',  5, 1500, 40),
  ('weekly_crew_3_runs',     'weekly','crew',     'Crew-Aktivität',        '3 Läufe innerhalb des Crew-Reviers',                   '🤝', 'weekly_crew_runs',   3, 1200, 50),
  ('weekly_streak_7',        'weekly','streak',   '7-Tage-Streak',         'Eine ganze Woche ohne Ausfall',                        '🔥', 'weekly_streak',      7, 2000, 60),
  ('weekly_guardian_level',  'weekly','guardian', 'Wächter-Levelup',       'Bring deinen aktiven Wächter ein Level höher',         '⬆️', 'weekly_guardian_lvl',1, 1800, 70),
  ('weekly_3_qr_scans',      'weekly','shop',     '3 Shop-Besuche',        'Scanne 3 verschiedene Partner-Shops',                  '🛍️', 'weekly_shop_scans',  3, 1000, 80),
  ('weekly_3_territories',   'weekly','territory','3 Territorien',         'Schließe 3 Ringe diese Woche',                         '🏰', 'weekly_territories', 3, 3000, 21)
on conflict (code) do nothing;
