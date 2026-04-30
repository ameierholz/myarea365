-- ─── 00203: Player-Base-Späher (async march statt instant intel) ─────
-- Phasen analog gather_marches: marching → scouting → returning → completed.
-- Speed 60 km/h (unverwundbar). Inbox-Bericht erst bei Rückkehr.

create table if not exists public.player_base_scouts (
  id                uuid primary key default gen_random_uuid(),
  attacker_user_id  uuid not null references public.users(id) on delete cascade,
  defender_user_id  uuid not null references public.users(id) on delete cascade,
  status            text not null default 'marching'
                    check (status in ('marching','scouting','returning','completed','aborted')),
  started_at        timestamptz not null default now(),
  arrives_at        timestamptz not null,
  scout_done_at     timestamptz not null,
  returns_at        timestamptz not null,
  from_lat          double precision,
  from_lng          double precision,
  target_lat        double precision,
  target_lng        double precision,
  distance_m        double precision,
  intel_payload     jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_pb_scouts_user_active on public.player_base_scouts(attacker_user_id) where status in ('marching','scouting','returning');
create index if not exists idx_pb_scouts_due on public.player_base_scouts(returns_at) where status in ('marching','scouting','returning');

alter table public.player_base_scouts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='player_base_scouts' and policyname='pbs_read_own') then
    create policy pbs_read_own on public.player_base_scouts for select using (attacker_user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='player_base_scouts') then
    alter publication supabase_realtime add table public.player_base_scouts;
  end if;
end $$;

-- RPC: start_player_base_scout, tick_player_base_scouts, get_active_player_base_scouts
-- (Definitionen identisch zur aufgespielten Migration; siehe Datenbank.)
