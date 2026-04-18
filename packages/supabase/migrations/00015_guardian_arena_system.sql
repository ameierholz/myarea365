-- =========================================================
-- Waechter / Arena-System
-- Jede Crew hat 1 Waechter (random bei Gruendung), Arena-faehige
-- Shops koennen Kaempfe hosten — aber nur zwischen Crews die in
-- den letzten 7 Tagen dort einen Deal eingeloest haben.
-- =========================================================

create table if not exists public.guardian_archetypes (
  id text primary key,
  name text not null,
  emoji text not null,
  rarity text not null check (rarity in ('common','rare','epic','legend')),
  base_hp int not null,
  base_atk int not null,
  base_def int not null,
  base_spd int not null,
  ability_id text not null,
  ability_name text not null,
  ability_desc text not null,
  lore text,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_guardians (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  archetype_id text not null references public.guardian_archetypes(id),
  custom_name text,
  level int not null default 1 check (level >= 1 and level <= 30),
  xp int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  current_hp_pct int not null default 100,
  wounded_until timestamptz,
  is_active boolean not null default true,
  acquired_at timestamptz not null default now(),
  source text not null default 'initial' check (source in ('initial','captured','fused','purchased')),
  unique (crew_id, archetype_id, is_active)
);

create index if not exists idx_crew_guardians_crew on public.crew_guardians(crew_id);
create index if not exists idx_crew_guardians_active on public.crew_guardians(crew_id) where is_active;

create table if not exists public.shop_arenas (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  status text not null default 'active' check (status in ('active','expired','paused')),
  plan text not null check (plan in ('daily','monthly')),
  activated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  total_battles int not null default 0,
  stripe_subscription_id text,
  unique (business_id)
);

create index if not exists idx_shop_arenas_active on public.shop_arenas(status, expires_at);

create table if not exists public.arena_battles (
  id uuid primary key default gen_random_uuid(),
  arena_id uuid not null references public.shop_arenas(id) on delete cascade,
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  challenger_crew_id uuid not null references public.crews(id) on delete cascade,
  defender_crew_id uuid not null references public.crews(id) on delete cascade,
  challenger_guardian_id uuid not null references public.crew_guardians(id) on delete cascade,
  defender_guardian_id uuid not null references public.crew_guardians(id) on delete cascade,
  winner_crew_id uuid references public.crews(id),
  seed text not null,
  rounds jsonb not null,
  xp_awarded int not null default 0,
  guardian_captured_id uuid references public.crew_guardians(id),
  challenger_trigger_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_battles_arena on public.arena_battles(arena_id, created_at desc);
create index if not exists idx_battles_challenger on public.arena_battles(challenger_crew_id);
create index if not exists idx_battles_defender on public.arena_battles(defender_crew_id);

create table if not exists public.arena_streaks (
  id uuid primary key default gen_random_uuid(),
  attacker_crew_id uuid not null references public.crews(id) on delete cascade,
  defender_crew_id uuid not null references public.crews(id) on delete cascade,
  consecutive_wins int not null default 0,
  last_battle_at timestamptz not null default now(),
  unique (attacker_crew_id, defender_crew_id)
);

create table if not exists public.guardian_trophies (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  archetype_id text not null references public.guardian_archetypes(id),
  captured_from_crew_id uuid references public.crews(id) on delete set null,
  captured_level int not null,
  captured_at timestamptz not null default now()
);

create index if not exists idx_trophies_crew on public.guardian_trophies(crew_id);

alter table public.guardian_archetypes  enable row level security;
alter table public.crew_guardians       enable row level security;
alter table public.shop_arenas          enable row level security;
alter table public.arena_battles        enable row level security;
alter table public.arena_streaks        enable row level security;
alter table public.guardian_trophies    enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='guardian_archetypes' and policyname='select_all') then
    create policy select_all on public.guardian_archetypes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='crew_guardians' and policyname='select_all') then
    create policy select_all on public.crew_guardians for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_arenas' and policyname='select_all') then
    create policy select_all on public.shop_arenas for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='arena_battles' and policyname='select_all') then
    create policy select_all on public.arena_battles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='guardian_trophies' and policyname='select_all') then
    create policy select_all on public.guardian_trophies for select using (true);
  end if;
end $$;

create or replace function public.assign_initial_guardian(p_crew_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_archetype text;
  v_guardian_id uuid;
begin
  select id into v_archetype from public.guardian_archetypes
  where rarity = case
    when random() < 0.70 then 'common'
    when random() < 0.92 then 'rare'
    when random() < 0.99 then 'epic'
    else 'legend'
  end
  order by random() limit 1;

  if v_archetype is null then
    select id into v_archetype from public.guardian_archetypes order by random() limit 1;
  end if;

  insert into public.crew_guardians (crew_id, archetype_id, is_active, source)
  values (p_crew_id, v_archetype, true, 'initial')
  on conflict do nothing
  returning id into v_guardian_id;

  return v_guardian_id;
end $$;

create or replace function public.trigger_assign_guardian() returns trigger language plpgsql as $$
begin
  perform public.assign_initial_guardian(new.id);
  return new;
end $$;

drop trigger if exists trg_crew_assign_guardian on public.crews;
create trigger trg_crew_assign_guardian after insert on public.crews
  for each row execute function public.trigger_assign_guardian();
