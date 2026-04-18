-- Phase 1: Kosmetik + Gameplay-Items (bereits über MCP angewandt, hier nur für Versionierung)
alter table public.users
  add column if not exists equipped_trail text,
  add column if not exists aura_until timestamptz,
  add column if not exists rainbow_name_until timestamptz,
  add column if not exists victory_dance_enabled boolean default false,
  add column if not exists map_theme text,
  add column if not exists ghost_mode_charges int default 0,
  add column if not exists double_claim_charges int default 0,
  add column if not exists reclaim_tickets int default 0,
  add column if not exists explorer_compass_until timestamptz,
  add column if not exists shouts_remaining int default 0,
  add column if not exists faction_switch_at timestamptz;

alter table public.crews
  add column if not exists xp_boost_until timestamptz,
  add column if not exists xp_boost_multiplier numeric(3,1) default 1.0;

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  xp_awarded int not null default 0,
  unique(user_id, achievement_id)
);
alter table public.user_achievements enable row level security;
drop policy if exists ua_read on public.user_achievements;
drop policy if exists ua_self on public.user_achievements;
create policy ua_read on public.user_achievements for select using (true);
create policy ua_self on public.user_achievements for insert to authenticated with check (user_id = auth.uid());
