-- 00252: Metropol-Saga — KvK-Modell (RoK/CoD-Style)
--
-- Komplettes Schema für Crew-vs-Crew auf realer OSM-Stadt-Map.
-- Crews melden sich an → Matchmaking nach Größe → eigene Stadt-Map pro Bracket.
-- Lifecycle: signup → matchmaking → auftakt → main → apex_hold → awards → finalized
-- Hauptphase: Repeater/Hauptgebäude bauen, Truppen marschieren, Kampf-Resolution.
-- Tor-Zonen aus echten Brücken/Tunneln, öffnen progressiv pro Phase.
--
-- 40 Tage Total: 7d Anmeldung + 1d Matchmaking + 7d Auftakt + 28d Hauptphase
-- + 2d Apex-Hold + 1d Friedensphase + 2d Awards.

-- ════════════════════════════════════════════════════════════════
-- CITY POOL: kuratierte Liste der Sagas-Städte (Stadt-Größe matcht Crew-Größe)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_city_pool (
  slug text primary key,
  name text not null,
  size_tier text not null check (size_tier in ('mini','mid','big','mega')),
  -- mini: 4 Crews je 5-10 Member
  -- mid:  4-6 Crews je 11-25 Member
  -- big:  6 Crews je 26-50 Member
  -- mega: 8 Crews je 50+ Member
  bbox_south numeric not null,
  bbox_west  numeric not null,
  bbox_north numeric not null,
  bbox_east  numeric not null,
  apex_lat numeric not null,
  apex_lng numeric not null,
  apex_name text not null,
  apex_emoji text default '🏛',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.saga_city_pool enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_city_pool' and policyname='saga_city_pool_public_read') then
    create policy saga_city_pool_public_read on public.saga_city_pool for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- ROUNDS: eine Anmelde-Periode (eine Saga läuft = eine Round)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'signup'
    check (status in ('signup','matchmaking','active','finalized')),
  signup_starts timestamptz not null,
  signup_ends   timestamptz not null,
  match_starts  timestamptz not null,
  auftakt_ends  timestamptz not null,
  main_ends     timestamptz not null,
  apex_window_ends timestamptz not null,
  awards_ends   timestamptz not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_saga_rounds_status on public.saga_rounds(status, signup_starts);

alter table public.saga_rounds enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_rounds' and policyname='saga_rounds_public_read') then
    create policy saga_rounds_public_read on public.saga_rounds for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- SIGNUPS: Crew meldet sich für Round an
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_signups (
  round_id uuid not null references public.saga_rounds(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  signed_up_at timestamptz not null default now(),
  signed_up_by uuid references public.users(id) on delete set null,
  member_count_at_signup int not null default 0,
  power_score_at_signup bigint not null default 0,
  bracket_id uuid,  -- gefüllt nach Matchmaking
  primary key (round_id, crew_id)
);

create index if not exists idx_saga_signups_bracket on public.saga_signups(bracket_id);

alter table public.saga_signups enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_signups' and policyname='saga_signups_public_read') then
    create policy saga_signups_public_read on public.saga_signups for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='saga_signups' and policyname='saga_signups_crew_lead_write') then
    create policy saga_signups_crew_lead_write on public.saga_signups for all
      using (true) with check (true);
    -- Detail-Authz im RPC
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- BRACKETS: ein Match = N Crews auf einer Stadt-Map
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_brackets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.saga_rounds(id) on delete cascade,
  city_slug text not null references public.saga_city_pool(slug),
  size_tier text not null,
  crew_count int not null,
  status text not null default 'auftakt' check (status in ('auftakt','main','apex_hold','finalized')),
  current_phase int not null default 0,  -- 0 = nur Spawn, 1..4 = Tore offen
  apex_holder_crew_id uuid references public.crews(id) on delete set null,
  apex_hold_started_at timestamptz,
  winner_crew_id uuid references public.crews(id) on delete set null,
  buildup_winner_crew_id uuid references public.crews(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_brackets_round on public.saga_brackets(round_id);

alter table public.saga_brackets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_brackets' and policyname='saga_brackets_public_read') then
    create policy saga_brackets_public_read on public.saga_brackets for select using (true);
  end if;
end $$;

alter table public.saga_signups
  drop constraint if exists saga_signups_bracket_fk,
  add constraint saga_signups_bracket_fk
  foreign key (bracket_id) references public.saga_brackets(id) on delete set null;

-- ════════════════════════════════════════════════════════════════
-- BRACKET CREWS: welche Crew in welchem Bracket + Spawn-Position
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_bracket_crews (
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  color_hex text not null,
  spawn_zone_id uuid,  -- gefüllt nach map generation
  auftakt_points bigint not null default 0,
  merits bigint not null default 0,
  zones_held int not null default 0,
  buildings_count int not null default 0,
  troops_killed bigint not null default 0,
  troops_lost bigint not null default 0,
  final_rank int,
  joined_at timestamptz not null default now(),
  primary key (bracket_id, crew_id)
);

create index if not exists idx_saga_bracket_crews_crew on public.saga_bracket_crews(crew_id);

alter table public.saga_bracket_crews enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_bracket_crews' and policyname='saga_bracket_crews_public_read') then
    create policy saga_bracket_crews_public_read on public.saga_bracket_crews for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- ZONES: Quartier-Polygone aus OSM, pro Bracket generiert
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_zones (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  osm_id bigint,                -- OSM relation_id
  name text not null,
  zone_kind text not null check (zone_kind in ('district','spawn','apex','gate')),
  ring int not null default 4,  -- 4=Stadtrand, 0=Apex
  centroid_lat numeric not null,
  centroid_lng numeric not null,
  polygon jsonb not null,       -- [[lat,lng], ...]
  resource_bonus_pct int not null default 0,  -- z.B. 15 = +15% Komponenten
  resource_kind text,           -- 'tech_schrott' / 'komponenten' / 'krypto' / 'bandbreite'
  owner_crew_id uuid references public.crews(id) on delete set null,
  -- Für Tor-Zonen:
  gate_kind text,               -- 'bridge' / 'tunnel'
  gate_phase int,               -- 1..4 — öffnet bei phase >= gate_phase
  gate_state text default 'closed' check (gate_state in ('closed','open','garrisoned','besieged')),
  gate_garrison_crew_id uuid references public.crews(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_zones_bracket on public.saga_zones(bracket_id, ring);
create index if not exists idx_saga_zones_owner on public.saga_zones(owner_crew_id);

alter table public.saga_zones enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_zones' and policyname='saga_zones_public_read') then
    create policy saga_zones_public_read on public.saga_zones for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- ZONE ADJACENCY: welche Zonen aneinander grenzen (für Connection-Regel)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_zone_adjacency (
  zone_a uuid not null references public.saga_zones(id) on delete cascade,
  zone_b uuid not null references public.saga_zones(id) on delete cascade,
  via_gate_zone uuid references public.saga_zones(id) on delete cascade,
  -- Wenn die Verbindung über ein Tor läuft, ist das Tor hier referenziert
  -- → Adjacency ist nur "nutzbar" wenn das Tor offen ist
  primary key (zone_a, zone_b)
);

create index if not exists idx_saga_zone_adj_b on public.saga_zone_adjacency(zone_b);

alter table public.saga_zone_adjacency enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_zone_adjacency' and policyname='saga_zone_adj_public_read') then
    create policy saga_zone_adj_public_read on public.saga_zone_adjacency for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- BUILDINGS: Repeater + Hauptgebäude pro Zone
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_buildings (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.saga_zones(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  built_by_user_id uuid references public.users(id) on delete set null,
  building_kind text not null check (building_kind in ('repeater','hauptgebaeude')),
  hp int not null,
  max_hp int not null,
  built_at timestamptz not null default now(),
  destroyed_at timestamptz
);

create index if not exists idx_saga_buildings_zone on public.saga_buildings(zone_id);
create index if not exists idx_saga_buildings_crew on public.saga_buildings(crew_id, building_kind);
create unique index if not exists uq_saga_buildings_one_per_zone_per_crew
  on public.saga_buildings(zone_id, crew_id, building_kind) where destroyed_at is null;

alter table public.saga_buildings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_buildings' and policyname='saga_buildings_public_read') then
    create policy saga_buildings_public_read on public.saga_buildings for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- GARRISONS: stationierte Truppen pro Building
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_garrisons (
  building_id uuid primary key references public.saga_buildings(id) on delete cascade,
  inf int not null default 0,
  cav int not null default 0,
  mark int not null default 0,
  werk int not null default 0,
  guardian_id uuid references public.guardians(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.saga_garrisons enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_garrisons' and policyname='saga_garrisons_public_read') then
    create policy saga_garrisons_public_read on public.saga_garrisons for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- MARCHES: laufende Truppen-Bewegungen (Realtime)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_marches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  origin_zone_id uuid not null references public.saga_zones(id) on delete cascade,
  target_zone_id uuid not null references public.saga_zones(id) on delete cascade,
  march_kind text not null check (march_kind in ('attack','reinforce','gather','rally_join','recall')),
  inf int not null default 0,
  cav int not null default 0,
  mark int not null default 0,
  werk int not null default 0,
  guardian_id uuid references public.guardians(id) on delete set null,
  started_at timestamptz not null default now(),
  arrives_at timestamptz not null,
  rally_parent_id uuid references public.saga_marches(id) on delete set null,
  status text not null default 'marching' check (status in ('marching','arrived','recalled','resolved')),
  resolved_at timestamptz
);

create index if not exists idx_saga_marches_arrives on public.saga_marches(status, arrives_at);
create index if not exists idx_saga_marches_user on public.saga_marches(user_id, status);
create index if not exists idx_saga_marches_target on public.saga_marches(target_zone_id, status);

alter table public.saga_marches enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_marches' and policyname='saga_marches_public_read') then
    create policy saga_marches_public_read on public.saga_marches for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- BATTLES: Kampf-Resolution-Logs
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_battles (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  zone_id uuid not null references public.saga_zones(id) on delete cascade,
  attacker_crew_id uuid not null references public.crews(id) on delete cascade,
  defender_crew_id uuid references public.crews(id) on delete set null,
  attacker_user_id uuid references public.users(id) on delete set null,
  attacker_inf int not null default 0,
  attacker_cav int not null default 0,
  attacker_mark int not null default 0,
  attacker_werk int not null default 0,
  defender_inf int not null default 0,
  defender_cav int not null default 0,
  defender_mark int not null default 0,
  defender_werk int not null default 0,
  attacker_losses_dead int not null default 0,
  attacker_losses_wounded int not null default 0,
  defender_losses_dead int not null default 0,
  defender_losses_wounded int not null default 0,
  outcome text not null check (outcome in ('attacker_won','defender_won','draw')),
  building_destroyed_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_battles_bracket on public.saga_battles(bracket_id, created_at desc);

alter table public.saga_battles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_battles' and policyname='saga_battles_public_read') then
    create policy saga_battles_public_read on public.saga_battles for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- LAZARETT: verwundete Truppen
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_lazarett (
  user_id uuid not null references public.users(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  inf int not null default 0,
  cav int not null default 0,
  mark int not null default 0,
  werk int not null default 0,
  primary key (user_id, bracket_id)
);

alter table public.saga_lazarett enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_lazarett' and policyname='saga_lazarett_self_read') then
    create policy saga_lazarett_self_read on public.saga_lazarett for select using (auth.uid() = user_id);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- USER MERITS pro Bracket (für Verdienst-Markt)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_user_merits (
  user_id uuid not null references public.users(id) on delete cascade,
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  merits bigint not null default 0,
  merits_spent bigint not null default 0,
  primary key (user_id, bracket_id)
);

alter table public.saga_user_merits enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_user_merits' and policyname='saga_user_merits_self_read') then
    create policy saga_user_merits_self_read on public.saga_user_merits for select using (auth.uid() = user_id);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- RALLIES: organisierte Crew-Angriffe (max 10 Member)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_rallies (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  leader_user_id uuid not null references public.users(id) on delete cascade,
  target_zone_id uuid not null references public.saga_zones(id) on delete cascade,
  joinable_until timestamptz not null,
  marches_at timestamptz not null,
  status text not null default 'gathering' check (status in ('gathering','marching','resolved','cancelled')),
  participant_count int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_rallies_status on public.saga_rallies(status, joinable_until);

alter table public.saga_rallies enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_rallies' and policyname='saga_rallies_public_read') then
    create policy saga_rallies_public_read on public.saga_rallies for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- MEGA-WEGELAGER: Behemoth-Bosse
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_mega_camps (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  zone_id uuid not null references public.saga_zones(id) on delete cascade,
  spawned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hp_total bigint not null,
  hp_remaining bigint not null,
  killed_at timestamptz,
  first_kill_crew_id uuid references public.crews(id) on delete set null,
  status text not null default 'active' check (status in ('active','killed','expired'))
);

create index if not exists idx_saga_mega_status on public.saga_mega_camps(status, expires_at);

alter table public.saga_mega_camps enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_mega_camps' and policyname='saga_mega_public_read') then
    create policy saga_mega_public_read on public.saga_mega_camps for select using (true);
  end if;
end $$;

create table if not exists public.saga_mega_damage (
  mega_camp_id uuid not null references public.saga_mega_camps(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  damage bigint not null default 0,
  primary key (mega_camp_id, user_id)
);

alter table public.saga_mega_damage enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_mega_damage' and policyname='saga_mega_dmg_self_read') then
    create policy saga_mega_dmg_self_read on public.saga_mega_damage for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- PROGRESS LOG: Audit für Skyline-Chronik (Server-Meilensteine)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_progress_log (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references public.saga_brackets(id) on delete cascade,
  crew_id uuid references public.crews(id) on delete set null,
  event_kind text not null,
  -- z.B.: phase_advance, zone_captured, building_destroyed, gate_garrisoned,
  --       mega_killed, apex_taken, apex_held_24h, saga_won
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_saga_progress_log_bracket on public.saga_progress_log(bracket_id, created_at desc);

alter table public.saga_progress_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_progress_log' and policyname='saga_progress_log_public_read') then
    create policy saga_progress_log_public_read on public.saga_progress_log for select using (true);
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
-- USER SLOTS: pro User wieviele Marsch-Slots gleichzeitig
-- ════════════════════════════════════════════════════════════════
create table if not exists public.saga_user_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  bracket_id uuid references public.saga_brackets(id) on delete set null,
  march_slots_total int not null default 3,
  march_slots_used int not null default 0,
  saga_slot_inf int not null default 0,    -- Truppen die in der Saga eingesetzt sind
  saga_slot_cav int not null default 0,
  saga_slot_mark int not null default 0,
  saga_slot_werk int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.saga_user_state enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='saga_user_state' and policyname='saga_user_state_self_read') then
    create policy saga_user_state_self_read on public.saga_user_state for select using (auth.uid() = user_id);
  end if;
end $$;

comment on table public.saga_rounds is 'Eine Round = eine Saga-Welle mit signup→matchmaking→active→finalized.';
comment on table public.saga_brackets is 'Match-Instanz: N Crews auf einer Stadt-Map.';
comment on table public.saga_zones is 'OSM-Quartiere ODER Tor-Zonen (Brücken/Tunnel) pro Bracket.';
comment on column public.saga_zones.ring is '4=Stadtrand (Spawn), 0=Apex.';
comment on column public.saga_zones.gate_phase is 'Tor öffnet automatisch bei bracket.current_phase >= gate_phase.';
comment on table public.saga_buildings is 'Repeater (1 pro Zone+Crew) und Hauptgebäude (unbegrenzt aber teuer skalierend).';
