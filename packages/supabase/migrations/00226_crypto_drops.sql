-- 00226_crypto_drops.sql
-- Crew-Krypto-Drop: User stiftet Gems aus eigenem Pool, Crew-Mitglieder
-- claimen Slots mit zufällig fairer Verteilung. Drop läuft nach 24h ab.

create table if not exists public.crew_crypto_drops (
  id              uuid primary key default gen_random_uuid(),
  crew_id         uuid not null references public.crews(id) on delete cascade,
  dropped_by      uuid not null references public.users(id),
  total_gems      int not null check (total_gems > 0),
  remaining_gems  int not null,
  slots           int not null check (slots > 0),
  claimed_count   int not null default 0,
  expires_at      timestamptz not null default now() + interval '24 hours',
  created_at      timestamptz not null default now()
);

create table if not exists public.crew_crypto_drop_claims (
  drop_id        uuid not null references public.crew_crypto_drops(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  claimed_at     timestamptz not null default now(),
  gems_received  int not null,
  primary key (drop_id, user_id)
);

create index if not exists crew_crypto_drops_crew_idx on public.crew_crypto_drops(crew_id, expires_at desc);

alter table public.crew_crypto_drops enable row level security;
alter table public.crew_crypto_drop_claims enable row level security;

drop policy if exists "crypto_drops_crew_read" on public.crew_crypto_drops;
create policy "crypto_drops_crew_read" on public.crew_crypto_drops
  for select using (exists (select 1 from public.crew_members cm where cm.crew_id = crew_crypto_drops.crew_id and cm.user_id = auth.uid()));

drop policy if exists "crypto_drop_claims_self" on public.crew_crypto_drop_claims;
create policy "crypto_drop_claims_self" on public.crew_crypto_drop_claims
  for select using (user_id = auth.uid() or exists (
    select 1 from public.crew_crypto_drops d join public.crew_members cm on cm.crew_id=d.crew_id
    where d.id = crew_crypto_drop_claims.drop_id and cm.user_id = auth.uid()));

create or replace function public.create_crypto_drop(p_crew_id uuid, p_total_gems int, p_slots int)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_have int;
  v_drop_id uuid;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  if p_total_gems <= 0 or p_slots <= 0 then raise exception 'bad_args'; end if;
  if not exists (select 1 from public.crew_members where crew_id=p_crew_id and user_id=v_uid) then
    raise exception 'not_crew_member';
  end if;
  select gems into v_have from public.user_gems where user_id=v_uid;
  if coalesce(v_have,0) < p_total_gems then raise exception 'insufficient_gems'; end if;

  update public.user_gems set gems = gems - p_total_gems, total_spent = total_spent + p_total_gems, updated_at = now()
    where user_id = v_uid;
  insert into public.gem_transactions (user_id, delta, reason, metadata)
  values (v_uid, -p_total_gems, 'crypto_drop_create', jsonb_build_object('crew_id', p_crew_id, 'slots', p_slots));

  insert into public.crew_crypto_drops (crew_id, dropped_by, total_gems, remaining_gems, slots)
  values (p_crew_id, v_uid, p_total_gems, p_total_gems, p_slots)
  returning id into v_drop_id;
  return v_drop_id;
end; $$;

create or replace function public.claim_crypto_drop(p_drop_id uuid)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_drop public.crew_crypto_drops%rowtype;
  v_remaining_slots int;
  v_share int;
  v_min int;
  v_max int;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  select * into v_drop from public.crew_crypto_drops where id=p_drop_id for update;
  if not found then raise exception 'drop_not_found'; end if;
  if v_drop.expires_at < now() then raise exception 'drop_expired'; end if;
  if not exists (select 1 from public.crew_members where crew_id=v_drop.crew_id and user_id=v_uid) then
    raise exception 'not_crew_member';
  end if;
  if exists (select 1 from public.crew_crypto_drop_claims where drop_id=p_drop_id and user_id=v_uid) then
    raise exception 'already_claimed';
  end if;
  if v_drop.claimed_count >= v_drop.slots then raise exception 'drop_empty'; end if;

  v_remaining_slots := v_drop.slots - v_drop.claimed_count;
  if v_remaining_slots = 1 then
    v_share := v_drop.remaining_gems;
  else
    -- Random fair share zwischen 0.4x und 1.6x des avg
    v_min := greatest(1, (v_drop.remaining_gems / v_remaining_slots) * 4 / 10);
    v_max := least(v_drop.remaining_gems - (v_remaining_slots - 1), (v_drop.remaining_gems / v_remaining_slots) * 16 / 10);
    if v_max < v_min then v_max := v_min; end if;
    v_share := v_min + floor(random() * (v_max - v_min + 1))::int;
  end if;

  insert into public.crew_crypto_drop_claims (drop_id, user_id, gems_received) values (p_drop_id, v_uid, v_share);
  update public.crew_crypto_drops set remaining_gems = remaining_gems - v_share, claimed_count = claimed_count + 1
    where id = p_drop_id;

  insert into public.user_gems (user_id, gems) values (v_uid, v_share)
  on conflict (user_id) do update set gems = user_gems.gems + v_share, updated_at = now();
  insert into public.gem_transactions (user_id, delta, reason, metadata)
  values (v_uid, v_share, 'crypto_drop_claim', jsonb_build_object('drop_id', p_drop_id));

  return v_share;
end; $$;

revoke all on function public.create_crypto_drop(uuid, int, int) from public;
revoke all on function public.claim_crypto_drop(uuid) from public;
grant execute on function public.create_crypto_drop(uuid, int, int) to authenticated;
grant execute on function public.claim_crypto_drop(uuid) to authenticated;
