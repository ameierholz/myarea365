-- 00255: Saga KvK Full — alle fehlenden Mechaniken aus RoK/CoD KvK
--
-- Was hier dazukommt:
--   - Holy Sites (passive Crew-Buffs solang gehalten)
--   - Resource-Tiles (gather marches)
--   - Action Points (Daily-Cap)
--   - Buff-Items (zeit-begrenzte Boosts)
--   - User-Inventory pro Bracket (migration items, buffs, speedups)
--   - Diplomatie / NAP zwischen Crews
--   - User-vs-User Combat Tracking
--   - Reinforcement-System
--   - Battle-Reports mit user-facing notifications
--   - Open-Field-Battle-Erweiterung
--   - Erweiterung saga_zones (is_holy_site, is_gather_tile, gather_yield)
--   - Erweiterung saga_marches (intercept_eligible, scheduled_battle_id)
--   - Erweiterung saga_battles (battle_kind: zone|user|rally|gather|behemoth)
--
-- Wächter-Skills + Augur-Trigger + RPCs kommen in 00256+.

-- ════════════════════════════════════════════════════════════════
-- ZONES erweitert
-- ════════════════════════════════════════════════════════════════
alter table public.saga_zones
  add column if not exists is_holy_site boolean not null default false,
  add column if not exists holy_buff_kind text,        -- 'troop_atk', 'troop_def', 'march_speed', 'gather_rate'
  add column if not exists holy_buff_pct int default 0,
  add column if not exists is_gather_tile boolean not null default false,
  add column if not exists gather_yield_per_hour bigint default 0,
  add column if not exists gather_kind text,           -- 'tech_schrott', 'komponenten', 'krypto', 'bandbreite'
  add column if not exists gather_capacity bigint default 0,  -- max RSS bevor erschöpft
  add column if not exists gather_remaining bigint default 0;

create index if not exists idx_saga_zones_holy on public.saga_zones(bracket_id, is_holy_site) where is_holy_site = true;
create index if not exists idx_saga_zones_gather on public.saga_zones(bracket_id, is_gather_tile) where is_gather_tile = true;

-- ════════════════════════════════════════════════════════════════
-- MARCHES erweitert (neue march_kinds)
-- ════════════════════════════════════════════════════════════════
alter table public.saga_marches
  drop constraint if exists saga_marches_march_kind_check;

alter table public.saga_marches
  add constraint saga_marches_march_kind_check
  check (march_kind in ('attack','reinforce','gather','rally_join','recall','attack_user','rally_main','behemoth_attack','migrate'));

-- target_user_id für PvP-Marsches
alter table public.saga_marches
  add column if not exists target_user_id uuid references public.users(id) on delete set null;

-- gather: how much rss collected during gather
alter table public.saga_marches
  add column if not exists gather_collected bigint default 0;

create index if not exists idx_saga_marches_target_user on public.saga_marches(target_user_id, status);

-- ════════════════════════════════════════════════════════════════
-- BATTLES erweitert
-- ════════════════════════════════════════════════════════════════
alter table public.saga_battles
  add column if not exists battle_kind text default 'zone' check (battle_kind in ('zone','user','rally','gather_intercept','behemoth','holy_capture')),
  add column if not exists rally_id uuid references public.saga_rallies(id) on delete set null,
  add column if not exists defender_user_id uuid references public.users(id) on delete set null,
  add column if not exists viewed_by_attacker boolean not null default false,
  add column if not exists viewed_by_defender boolean not null default false;

create index if not exists idx_saga_battles_unviewed on public.saga_battles(attacker_user_id, viewed_by_attacker) where viewed_by_attacker = false;

-- ════════════════════════════════════════════════════════════════
-- HOLY SITE STATE: welche Crew hält wann welche Site
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_holy_holders (
  zone_id uuid primary key references public.saga_zones(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  held_since timestamptz,
  total_hold_seconds bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.saga_holy_holders enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_holy_holders' and policyname='saga_holy_pub_read') then
    create policy saga_holy_pub_read on public.saga_holy_holders for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- USER ACTION POINTS (Daily-Cap)
-- ════════════════════════════════════════════════════════════════
alter table public.saga_user_state
  add column if not exists action_points int not null default 100,
  add column if not exists action_points_max int not null default 100,
  add column if not exists ap_last_reset_at timestamptz default now(),
  add column if not exists pvp_attacks_today int not null default 0,
  add column if not exists pvp_attacks_max int not null default 10;

-- ════════════════════════════════════════════════════════════════
-- USER INVENTORY pro Bracket (Migration-Items + Buffs + Speedups)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_user_inventory (
  user_id uuid not null references public.users(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  item_kind text not null check (item_kind in (
    'tele_random','tele_targeted','tele_advanced',
    'speedup_5min','speedup_30min','speedup_1h','speedup_3h','speedup_8h','speedup_24h',
    'buff_atk_30min','buff_def_30min','buff_marchspeed_30min','buff_gather_30min',
    'heal_token','shield_24h','shield_8h'
  )),
  qty int not null default 0,
  primary key (user_id, bracket_id, item_kind)
);

alter table public.saga_user_inventory enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_user_inventory' and policyname='saga_inv_self_read') then
    create policy saga_inv_self_read on public.saga_user_inventory for select using (auth.uid() = user_id);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- ACTIVE BUFFS (zeit-begrenzte Boosts)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_active_buffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  buff_kind text not null,        -- 'atk_30min', 'def_30min', etc.
  multiplier numeric not null,    -- 1.5 = +50%
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_buffs_user on public.saga_active_buffs(user_id, expires_at);

alter table public.saga_active_buffs enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_active_buffs' and policyname='saga_buffs_self_read') then
    create policy saga_buffs_self_read on public.saga_active_buffs for select using (auth.uid() = user_id);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- USER SHIELDS (Schutz vor Angriffen)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_user_shields (
  user_id uuid not null references public.users(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  expires_at timestamptz not null,
  primary key (user_id, bracket_id)
);

alter table public.saga_user_shields enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_user_shields' and policyname='saga_shields_pub_read') then
    create policy saga_shields_pub_read on public.saga_user_shields for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- DIPLOMATIE: NAP (Non-Aggression-Pact) zwischen 2 Crews
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_diplomacy (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_a uuid not null references public.crews(id) on delete cascade,
  crew_b uuid not null references public.crews(id) on delete cascade,
  pact_kind text not null check (pact_kind in ('nap','alliance','enemy')),
  status text not null default 'proposed' check (status in ('proposed','active','expired','broken')),
  expires_at timestamptz,
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz,
  proposed_by uuid references public.users(id) on delete set null,
  accepted_by uuid references public.users(id) on delete set null,
  unique (bracket_id, crew_a, crew_b)
);

create index if not exists idx_saga_dip_active on public.saga_diplomacy(bracket_id, status) where status = 'active';

alter table public.saga_diplomacy enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_diplomacy' and policyname='saga_dip_pub_read') then
    create policy saga_dip_pub_read on public.saga_diplomacy for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- USER-RESOURCES pro Bracket (Saga-spezifische RSS, getrennt vom Hauptkonto)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_user_resources (
  user_id uuid not null references public.users(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  tech_schrott bigint not null default 0,
  komponenten bigint not null default 0,
  krypto bigint not null default 0,
  bandbreite bigint not null default 0,
  primary key (user_id, bracket_id)
);

alter table public.saga_user_resources enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_user_resources' and policyname='saga_res_self_read') then
    create policy saga_res_self_read on public.saga_user_resources for select using (auth.uid() = user_id);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- AUGUR MILESTONES: serverweite Meilensteine + Reward-Status
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_augur_milestones (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  milestone_kind text not null,
  -- 'first_phase_2','first_phase_3','first_phase_4',
  -- 'first_holy_capture','first_apex_touch','first_behemoth_kill',
  -- 'first_hauptgebaeude','first_rally_won','apex_held_24h','apex_held_48h'
  reward_gems int default 0,
  reward_keys int default 0,
  reward_speedups int default 0,
  achieved_at timestamptz not null default now(),
  rewards_distributed boolean not null default false,
  unique (bracket_id, milestone_kind)
);

alter table public.saga_augur_milestones enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_augur_milestones' and policyname='saga_augur_pub_read') then
    create policy saga_augur_pub_read on public.saga_augur_milestones for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- USER-LOCATIONS: wo befindet sich der Truppen-Stack eines Users
-- (= aktuelle Position auf der Saga-Map; default = Spawn-Zone)
-- Wird benötigt für Solo-PvP (User vs User direkt)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_user_positions (
  user_id uuid not null references public.users(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  current_zone_id uuid references public.saga_zones(id) on delete set null,
  -- Mobile Truppen die NICHT in Garrison sind (d.h. im Feld)
  field_inf int not null default 0,
  field_cav int not null default 0,
  field_mark int not null default 0,
  field_werk int not null default 0,
  field_guardian_id uuid references public.user_guardians(id) on delete set null,
  -- Vor Angriffen geschützt durch Shield in saga_user_shields
  primary key (user_id, bracket_id)
);

create index if not exists idx_saga_pos_zone on public.saga_user_positions(current_zone_id);

alter table public.saga_user_positions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_user_positions' and policyname='saga_pos_pub_read') then
    create policy saga_pos_pub_read on public.saga_user_positions for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- VIEW: pending attacks (für Reinforcement-Notifications)
-- ════════════════════════════════════════════════════════════════
create or replace view public.saga_pending_attacks as
select
  m.id as march_id,
  m.bracket_id,
  m.target_zone_id,
  m.crew_id as attacker_crew_id,
  m.user_id as attacker_user_id,
  m.target_user_id,
  m.march_kind,
  m.arrives_at,
  z.owner_crew_id as defender_crew_id,
  z.name as target_zone_name
from public.saga_marches m
join public.saga_zones z on z.id = m.target_zone_id
where m.status = 'marching'
  and m.march_kind in ('attack','attack_user','rally_main','behemoth_attack');

grant select on public.saga_pending_attacks to anon, authenticated, service_role;

-- ════════════════════════════════════════════════════════════════
-- TRIGGER: Augur-Stone — bei Erst-Ereignissen automatisch loggen
-- ════════════════════════════════════════════════════════════════
create or replace function public._saga_check_augur_milestone(p_bracket_id uuid, p_kind text, p_crew_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_existing uuid;
  v_gems int := 0;
  v_keys int := 0;
  v_speedups int := 0;
begin
  select id into v_existing from public.saga_augur_milestones
   where bracket_id = p_bracket_id and milestone_kind = p_kind;
  if v_existing is not null then return; end if;

  -- Reward-Mapping je Meilenstein
  case p_kind
    when 'first_phase_2'         then v_gems := 50;  v_keys := 1;
    when 'first_phase_3'         then v_gems := 100; v_keys := 2;
    when 'first_phase_4'         then v_gems := 200; v_keys := 3;
    when 'first_holy_capture'    then v_gems := 75;  v_speedups := 1;
    when 'first_apex_touch'      then v_gems := 500; v_keys := 5;
    when 'first_behemoth_kill'   then v_gems := 100; v_keys := 2; v_speedups := 1;
    when 'first_hauptgebaeude'   then v_gems := 50;
    when 'first_rally_won'       then v_gems := 100;
    when 'apex_held_24h'         then v_gems := 1000; v_keys := 10;
    when 'apex_held_48h'         then v_gems := 2000; v_keys := 20; v_speedups := 5;
    else null;
  end case;

  insert into public.saga_augur_milestones (bracket_id, crew_id, milestone_kind, reward_gems, reward_keys, reward_speedups)
  values (p_bracket_id, p_crew_id, p_kind, v_gems, v_keys, v_speedups);

  insert into public.saga_progress_log (bracket_id, crew_id, event_kind, payload)
  values (p_bracket_id, p_crew_id, 'augur_' || p_kind,
    jsonb_build_object('gems', v_gems, 'keys', v_keys, 'speedups', v_speedups));
end $$;

comment on view public.saga_pending_attacks is 'Live-View aller laufenden Angriffe — User können hier sehen ob jemand auf sie zumarschiert.';
comment on table public.saga_holy_holders is 'Welche Crew hält welche Holy Site, mit total_hold_seconds für Statistik.';
comment on table public.saga_diplomacy is 'NAP/Alliance/Enemy zwischen Crews im selben Bracket.';
comment on table public.saga_user_positions is 'Aktuelle Position eines Users auf der Saga-Map + dort stationierte Field-Truppen (für Solo-PvP).';
