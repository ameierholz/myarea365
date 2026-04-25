-- ══════════════════════════════════════════════════════════════════════════
-- BASE-SYSTEM PHASE 1: Solo-Base + Resourcen + Gebäude + VIP
-- ══════════════════════════════════════════════════════════════════════════
-- Konzept (CoD/RoK-inspiriert, MyArea-eigen):
--   - Jeder User hat 1 persönliche Base am Heimat-PLZ.
--   - Resourcen droppen pro gelaufenem km, geo-tagged:
--       Holz (Parks) · Stein (Wohngebiet) · Gold (Stadtkern) · Mana (Wasser)
--   - Bewegung ersetzt Wartezeit: 1 km gelaufen ≡ X Min Bauzeit-Skip-Token.
--   - 4 Grundgebäude (Phase 1): Wegekasse, Wald-Pfad, Wächter-Halle, Lauftürme
--   - VIP-Tier 1-15 für Login-Streaks + Premium-Käufe.
-- Phase 2 (Crew-Base + Truhen) → 00080
-- Phase 3 (Truppen + Crew-Wars) → 00081
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) walks erweitern für Resource-Tracking ────────────────────────────
alter table public.walks
  add column if not exists wood_dropped int not null default 0,
  add column if not exists stone_dropped int not null default 0,
  add column if not exists gold_dropped int not null default 0,
  add column if not exists mana_dropped int not null default 0,
  add column if not exists km_in_park        numeric(6,3) not null default 0,
  add column if not exists km_in_residential numeric(6,3) not null default 0,
  add column if not exists km_in_commercial  numeric(6,3) not null default 0,
  add column if not exists km_near_water     numeric(6,3) not null default 0,
  add column if not exists drop_processed boolean not null default false;

create index if not exists idx_walks_processed on public.walks(drop_processed) where not drop_processed;

-- ─── 2) user_resources (eine Zeile pro User) ─────────────────────────────
create table if not exists public.user_resources (
  user_id     uuid primary key references public.users(id) on delete cascade,
  wood        int not null default 0 check (wood >= 0),
  stone       int not null default 0 check (stone >= 0),
  gold        int not null default 0 check (gold >= 0),
  mana        int not null default 0 check (mana >= 0),
  -- speed_token = bauzeit-skip, kommt automatisch beim Laufen (1 km = 1 token)
  speed_tokens int not null default 0 check (speed_tokens >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.user_resources enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_resources' and policyname='select_own') then
    create policy select_own on public.user_resources for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 3) buildings_catalog (statisch + erweiterbar) ───────────────────────
create table if not exists public.buildings_catalog (
  id                 text primary key,
  name               text not null,
  emoji              text not null,
  description        text not null,
  category           text not null check (category in ('production','storage','combat','cosmetic','utility')),
  scope              text not null check (scope in ('solo','crew')),
  max_level          int  not null default 10,
  base_cost_wood     int  not null default 0,
  base_cost_stone    int  not null default 0,
  base_cost_gold     int  not null default 0,
  base_cost_mana     int  not null default 0,
  base_buildtime_minutes int not null default 5,
  -- Effekt-Schlüssel für die Engine, je Stufe linear skalierbar
  effect_key         text,                -- z.B. "wood_per_km_pct", "guardian_xp_pct"
  effect_per_level   numeric not null default 0,
  required_base_level int not null default 1,
  sort               int not null default 0
);

-- 4 Phase-1-Gebäude + 4 Phase-2-Stubs (Crew-Scope, nur als Vorbereitung)
insert into public.buildings_catalog
  (id, name, emoji, description, category, scope, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_buildtime_minutes, effect_key, effect_per_level, required_base_level, sort)
values
  -- ═══ Phase-1 Solo-Base (4 Grundgebäude) ═══
  ('wegekasse',     'Wegekasse',      '🏦', 'Erhöht das Lager-Limit für alle Resourcen pro Stufe.',  'storage',    'solo', 10,
   100,  50,   0,   0,  5, 'storage_cap_pct',     0.20, 1,  1),
  ('wald_pfad',     'Wald-Pfad',      '🌲', 'Mehr Holz pro km gelaufenem Park-Weg.',                 'production', 'solo', 10,
    50, 100,   0,   0,  5, 'wood_per_km_pct',     0.10, 1,  2),
  ('waechter_halle','Wächter-Halle',  '⚔️', 'Aktive Wächter erhalten mehr XP nach jedem Lauf.',       'combat',    'solo', 10,
   150, 150,  20,  10, 10, 'guardian_xp_pct',     0.05, 2,  3),
  ('laufturm',      'Lauftürme',      '🗼', 'Erhöht die sichtbare Map-Reichweite + bessere Drops.',   'utility',   'solo', 10,
   200, 100,  30,   0, 10, 'map_range_km',        0.50, 2,  4),
  -- ═══ Phase-2 Crew-Base (Stubs, später ausgebaut) ═══
  ('crew_treffpunkt','Crew-Treffpunkt','🏛️','Crew-Bonus auf alle Resourcen pro Stufe.',              'production', 'crew', 15,
   500, 500, 100,  50, 30, 'crew_resource_pct',   0.05, 1, 10),
  ('truhenkammer',  'Truhenkammer',   '🗝️', 'Lagerung + schnelleres Öffnen von Truhen.',             'storage',    'crew', 15,
   400, 600, 100,  50, 30, 'chest_speed_pct',     0.10, 1, 11),
  ('arena_halle',   'Arena-Halle',    '🏟️', 'Crew-Mitglieder erhalten Arena-Bonus-XP.',              'combat',    'crew', 15,
   600, 400, 200, 100, 30, 'arena_xp_pct',        0.05, 2, 12),
  ('mana_quell',    'Mana-Quell',     '💧', 'Bonus auf Mana-Drop bei Lauf in Wassernähe.',           'production', 'crew', 15,
   300, 300, 100, 200, 20, 'mana_per_km_pct',     0.10, 1, 13)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  category = excluded.category, scope = excluded.scope, max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_buildtime_minutes = excluded.base_buildtime_minutes,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_base_level = excluded.required_base_level, sort = excluded.sort;

-- ─── 4) bases (1 pro User, anchor am Heimat-PLZ) ─────────────────────────
create table if not exists public.bases (
  id          uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users(id) on delete cascade,
  plz         text not null,
  level       int  not null default 1 check (level between 1 and 30),
  exp         int  not null default 0,
  layout_json jsonb not null default '{}'::jsonb,  -- 3D-Positionen + Rotation pro Building
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_bases_owner on public.bases(owner_user_id);
create index if not exists idx_bases_plz   on public.bases(plz);

alter table public.bases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='bases' and policyname='select_own') then
    create policy select_own on public.bases for select using (auth.uid() = owner_user_id);
  end if;
end $$;

-- ─── 5) base_buildings (Instanzen) ───────────────────────────────────────
create table if not exists public.base_buildings (
  id              uuid primary key default gen_random_uuid(),
  base_id         uuid not null references public.bases(id) on delete cascade,
  building_id     text not null references public.buildings_catalog(id) on delete cascade,
  position_x      int  not null default 0,
  position_y      int  not null default 0,
  level           int  not null default 1 check (level between 1 and 15),
  last_collected_at timestamptz,
  -- Production-Buildings akkumulieren Resourcen passiv (cap = stunden_seit_collect × prod_per_h)
  status          text not null default 'idle' check (status in ('idle','building','upgrading')),
  created_at      timestamptz not null default now(),
  unique (base_id, building_id)  -- 1 Instanz pro Building-Type pro Base
);
create index if not exists idx_base_buildings_base on public.base_buildings(base_id);

alter table public.base_buildings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_buildings' and policyname='select_own') then
    create policy select_own on public.base_buildings for select using (
      exists (select 1 from public.bases b where b.id = base_id and b.owner_user_id = auth.uid())
    );
  end if;
end $$;

-- ─── 6) building_queue (Bauaktionen mit ends_at) ─────────────────────────
create table if not exists public.building_queue (
  id              uuid primary key default gen_random_uuid(),
  base_id         uuid not null references public.bases(id) on delete cascade,
  building_id     text not null references public.buildings_catalog(id) on delete cascade,
  action          text not null check (action in ('build','upgrade')),
  target_level    int  not null check (target_level >= 1),
  started_at      timestamptz not null default now(),
  ends_at         timestamptz not null,
  finished        boolean not null default false,
  cost_wood       int  not null default 0,
  cost_stone      int  not null default 0,
  cost_gold       int  not null default 0,
  cost_mana       int  not null default 0
);
create index if not exists idx_queue_base on public.building_queue(base_id, finished);
create index if not exists idx_queue_ends on public.building_queue(ends_at) where not finished;

alter table public.building_queue enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='building_queue' and policyname='select_own') then
    create policy select_own on public.building_queue for select using (
      exists (select 1 from public.bases b where b.id = base_id and b.owner_user_id = auth.uid())
    );
  end if;
end $$;

-- ─── 7) vip_progress (Login-Streak + Käufe → VIP-Punkte → Tier 1-15) ─────
create table if not exists public.vip_progress (
  user_id            uuid primary key references public.users(id) on delete cascade,
  vip_level          int  not null default 0 check (vip_level between 0 and 15),
  vip_points         int  not null default 0 check (vip_points >= 0),
  daily_login_streak int  not null default 0 check (daily_login_streak >= 0),
  last_login_at      timestamptz,
  total_spent_eur    numeric(10,2) not null default 0,
  updated_at         timestamptz not null default now()
);

alter table public.vip_progress enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='vip_progress' and policyname='select_own') then
    create policy select_own on public.vip_progress for select using (auth.uid() = user_id);
  end if;
end $$;

-- VIP-Tier-Schwellen (kumulative VIP-Punkte für jedes Tier)
create table if not exists public.vip_tier_thresholds (
  vip_level int primary key check (vip_level between 0 and 15),
  required_points int not null,
  daily_chest_silver int not null default 0,
  daily_chest_gold   int not null default 0,
  resource_bonus_pct numeric not null default 0,
  buildtime_bonus_pct numeric not null default 0
);

insert into public.vip_tier_thresholds values
  ( 0,        0, 0, 0, 0.00, 0.00),
  ( 1,      100, 1, 0, 0.02, 0.02),
  ( 2,      300, 1, 0, 0.04, 0.04),
  ( 3,      600, 2, 0, 0.06, 0.06),
  ( 4,     1000, 2, 0, 0.08, 0.08),
  ( 5,     1600, 3, 1, 0.10, 0.10),
  ( 6,     2500, 3, 1, 0.12, 0.12),
  ( 7,     4000, 4, 1, 0.15, 0.15),
  ( 8,     6000, 4, 1, 0.18, 0.18),
  ( 9,     9000, 5, 2, 0.20, 0.20),
  (10,    13000, 5, 2, 0.25, 0.25),
  (11,    18000, 6, 2, 0.30, 0.30),
  (12,    25000, 6, 3, 0.35, 0.35),
  (13,    35000, 7, 3, 0.40, 0.40),
  (14,    50000, 8, 4, 0.45, 0.45),
  (15,    75000, 10,5, 0.50, 0.50)
on conflict (vip_level) do update set
  required_points = excluded.required_points,
  daily_chest_silver = excluded.daily_chest_silver,
  daily_chest_gold = excluded.daily_chest_gold,
  resource_bonus_pct = excluded.resource_bonus_pct,
  buildtime_bonus_pct = excluded.buildtime_bonus_pct;

-- ─── 8) RPC: get_or_create_base() — gibt eigene Base zurück oder erstellt ─
create or replace function public.get_or_create_base()
returns uuid language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_plz  text;
  v_base uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base from public.bases where owner_user_id = v_user;
  if v_base is not null then return v_base; end if;

  select heimat_plz into v_plz from public.users where id = v_user;
  if v_plz is null then v_plz := '00000'; end if;  -- Fallback

  insert into public.bases (owner_user_id, plz) values (v_user, v_plz) returning id into v_base;
  insert into public.user_resources (user_id) values (v_user) on conflict do nothing;
  insert into public.vip_progress    (user_id) values (v_user) on conflict do nothing;
  return v_base;
end $$;

revoke all on function public.get_or_create_base() from public;
grant execute on function public.get_or_create_base() to authenticated;

-- ─── 9) RPC: record_walk_resources() — verarbeitet einen Lauf, dropt Resourcen ─
-- Erwartet: walk_id eines Laufs, dessen km_in_park/_residential/_commercial/_near_water gesetzt sind
-- (Klassifizierung passiert clientseitig via OSM-Lookup oder serverseitig nach Übermittlung).
-- Drop-Raten (pro km im jeweiligen Tag): 100/100/80/60 (Holz/Stein/Gold/Mana).
create or replace function public.record_walk_resources(p_walk_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_walk record;
  v_user uuid := auth.uid();
  v_wood int; v_stone int; v_gold int; v_mana int; v_tokens int;
  v_vip_bonus numeric := 0;
  v_total_km numeric;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_walk from public.walks where id = p_walk_id and user_id = v_user;
  if v_walk is null then return jsonb_build_object('ok', false, 'error', 'walk_not_found'); end if;
  if v_walk.drop_processed then return jsonb_build_object('ok', false, 'error', 'already_processed'); end if;

  -- VIP-Bonus mitnehmen
  select coalesce(t.resource_bonus_pct, 0) into v_vip_bonus
    from public.vip_progress p
    left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;

  v_wood  := round(v_walk.km_in_park        * 100 * (1 + v_vip_bonus));
  v_stone := round(v_walk.km_in_residential * 100 * (1 + v_vip_bonus));
  v_gold  := round(v_walk.km_in_commercial  *  80 * (1 + v_vip_bonus));
  v_mana  := round(v_walk.km_near_water     *  60 * (1 + v_vip_bonus));

  v_total_km := coalesce(v_walk.distance_m, 0) / 1000.0;
  v_tokens := floor(v_total_km)::int;  -- 1 km = 1 speed-token

  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, v_wood, v_stone, v_gold, v_mana, v_tokens)
  on conflict (user_id) do update set
    wood         = public.user_resources.wood + excluded.wood,
    stone        = public.user_resources.stone + excluded.stone,
    gold         = public.user_resources.gold + excluded.gold,
    mana         = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at   = now();

  update public.walks set
    wood_dropped = v_wood, stone_dropped = v_stone,
    gold_dropped = v_gold, mana_dropped = v_mana,
    drop_processed = true
  where id = p_walk_id;

  return jsonb_build_object('ok', true,
    'wood', v_wood, 'stone', v_stone, 'gold', v_gold, 'mana', v_mana, 'tokens', v_tokens);
end $$;

revoke all on function public.record_walk_resources(uuid) from public;
grant execute on function public.record_walk_resources(uuid) to authenticated;

-- ─── 10) RPC: start_building() — neues Gebäude bauen oder upgraden ───────
create or replace function public.start_building(
  p_building_id text,
  p_position_x  int default 0,
  p_position_y  int default 0
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_base record;
  v_cat record;
  v_existing record;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_resources record;
  v_buildtime_min int;
  v_vip_speed numeric := 0;
  v_action text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  v_base_id := public.get_or_create_base();
  select * into v_base from public.bases where id = v_base_id;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;
  if v_cat.scope <> 'solo' then return jsonb_build_object('ok', false, 'error', 'wrong_scope'); end if;
  if v_base.level < v_cat.required_base_level then
    return jsonb_build_object('ok', false, 'error', 'base_level_too_low', 'need', v_cat.required_base_level);
  end if;

  -- Existiert bereits? → Upgrade. Sonst → Build.
  select * into v_existing from public.base_buildings where base_id = v_base_id and building_id = p_building_id;

  if v_existing is null then
    v_action := 'build';
    v_target_level := 1;
    v_cost_mult := 1.0;
  else
    if v_existing.level >= v_cat.max_level then
      return jsonb_build_object('ok', false, 'error', 'max_level_reached');
    end if;
    if v_existing.status <> 'idle' then
      return jsonb_build_object('ok', false, 'error', 'already_in_progress');
    end if;
    v_action := 'upgrade';
    v_target_level := v_existing.level + 1;
    v_cost_mult := power(1.6, v_existing.level);  -- exponentielle Upgrade-Kosten
  end if;

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;

  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
  where user_id = v_user;

  -- Bauzeit (mit VIP-Bonus)
  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_buildtime_min := greatest(1, round(v_cat.base_buildtime_minutes * v_target_level * (1 - v_vip_speed)));

  if v_existing is null then
    insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
    values (v_base_id, p_building_id, p_position_x, p_position_y, 0, 'building');
  else
    update public.base_buildings set status = 'upgrading' where id = v_existing.id;
  end if;

  insert into public.building_queue
    (base_id, building_id, action, target_level, ends_at, cost_wood, cost_stone, cost_gold, cost_mana)
  values
    (v_base_id, p_building_id, v_action, v_target_level,
     now() + (v_buildtime_min || ' minutes')::interval,
     v_cost_w, v_cost_s, v_cost_g, v_cost_m);

  return jsonb_build_object('ok', true,
    'action', v_action, 'target_level', v_target_level,
    'buildtime_minutes', v_buildtime_min,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;

revoke all on function public.start_building(text, int, int) from public;
grant execute on function public.start_building(text, int, int) to authenticated;

-- ─── 11) RPC: finish_building() — abgelaufene Builds in den Idle-State setzen ─
-- Wird von der App aufgerufen wenn der User die Base öffnet (oder per Cron).
create or replace function public.finish_building()
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_count int := 0;
  q record;
begin
  if v_user is null then return 0; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then return 0; end if;

  for q in
    select * from public.building_queue
     where base_id = v_base_id and not finished and ends_at <= now()
     order by ends_at
  loop
    update public.base_buildings set
      level = q.target_level, status = 'idle', last_collected_at = coalesce(last_collected_at, now())
    where base_id = v_base_id and building_id = q.building_id;

    update public.building_queue set finished = true where id = q.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

revoke all on function public.finish_building() from public;
grant execute on function public.finish_building() to authenticated;

-- ─── 12) RPC: speed_up_building() — speed-tokens gegen Bauzeit eintauschen ─
-- 1 Token = 5 Minuten Skip
create or replace function public.speed_up_building(p_queue_id uuid, p_tokens int)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_q record;
  v_have int;
  v_skip_minutes int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_tokens < 1 then return jsonb_build_object('ok', false, 'error', 'bad_tokens'); end if;

  select q.*, b.owner_user_id
    into v_q
    from public.building_queue q
    join public.bases b on b.id = q.base_id
   where q.id = p_queue_id;
  if v_q is null then return jsonb_build_object('ok', false, 'error', 'queue_not_found'); end if;
  if v_q.owner_user_id <> v_user then return jsonb_build_object('ok', false, 'error', 'not_yours'); end if;
  if v_q.finished then return jsonb_build_object('ok', false, 'error', 'already_finished'); end if;

  select speed_tokens into v_have from public.user_resources where user_id = v_user for update;
  if v_have < p_tokens then return jsonb_build_object('ok', false, 'error', 'not_enough_tokens'); end if;

  v_skip_minutes := p_tokens * 5;
  update public.user_resources set speed_tokens = speed_tokens - p_tokens, updated_at = now()
   where user_id = v_user;
  update public.building_queue set ends_at = ends_at - (v_skip_minutes || ' minutes')::interval
   where id = p_queue_id;

  return jsonb_build_object('ok', true, 'minutes_skipped', v_skip_minutes);
end $$;

revoke all on function public.speed_up_building(uuid, int) from public;
grant execute on function public.speed_up_building(uuid, int) to authenticated;
