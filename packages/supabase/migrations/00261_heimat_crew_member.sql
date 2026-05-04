-- ════════════════════════════════════════════════════════════════════
-- HEIMAT-KARTE: CrewMemberModal Backend
-- ════════════════════════════════════════════════════════════════════

alter table public.users
  add column if not exists bandits_killed int not null default 0,
  add column if not exists members_killed int not null default 0;

create table if not exists public.base_reinforcements (
  id uuid primary key default gen_random_uuid(),
  defender_user_id uuid not null references public.users(id) on delete cascade,
  sender_user_id uuid not null references public.users(id) on delete cascade,
  troops jsonb not null,
  guardian_id uuid,
  arrives_at timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_in_battle uuid,
  created_at timestamptz not null default now()
);
create index if not exists ix_breinf_defender_active on public.base_reinforcements (defender_user_id) where consumed_at is null;
create index if not exists ix_breinf_sender on public.base_reinforcements (sender_user_id, created_at desc);
alter table public.base_reinforcements enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_reinforcements' and policyname='breinf_read_own') then
    create policy breinf_read_own on public.base_reinforcements
      for select using (auth.uid() = defender_user_id or auth.uid() = sender_user_id);
  end if;
end $$;

-- send_base_reinforcement, get_crew_member_stats — siehe production
