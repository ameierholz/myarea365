-- ══════════════════════════════════════════════════════════════════════════
-- Phase 2 — Eigentums-Bonus (Repeater-Tagesdividende)
--
-- Konzept: Aktive Crew-Mitglieder, die in den letzten 24 h gelaufen sind,
-- bekommen einmal täglich eine Dividende pro lebendigem Crew-Repeater
-- (HQ=200 Wegemünzen, mega=100, repeater=50). Wer nicht läuft, bekommt nichts
-- → sanfter Druck, regelmäßig zu laufen, OHNE die Crew zu bestrafen.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.repeater_dividend_claims (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  crew_id      uuid not null,
  claim_date   date not null default current_date,
  total_coins  integer not null default 0,
  repeater_count integer not null default 0,
  hq_count     integer not null default 0,
  mega_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, claim_date)
);

create index if not exists idx_dividend_claims_user_date on public.repeater_dividend_claims(user_id, claim_date);

alter table public.repeater_dividend_claims enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='repeater_dividend_claims' and policyname='read_own') then
    create policy read_own on public.repeater_dividend_claims for select using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.get_my_dividend_status()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew_id uuid;
  v_already_claimed boolean;
  v_active boolean;
  v_last_walk timestamptz;
  v_hq int := 0; v_mega int := 0; v_rep int := 0;
  v_coins int := 0;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  select current_crew_id into v_crew_id from public.users where id = v_user;
  if v_crew_id is null then
    return jsonb_build_object('ok', true, 'eligible', false, 'reason', 'no_crew');
  end if;

  select exists(
    select 1 from public.repeater_dividend_claims
     where user_id = v_user and claim_date = current_date
  ) into v_already_claimed;

  select max(created_at) into v_last_walk from public.walks where user_id = v_user;
  v_active := v_last_walk is not null and v_last_walk > now() - interval '24 hours';

  select
    count(*) filter (where kind = 'hq'),
    count(*) filter (where kind = 'mega'),
    count(*) filter (where kind = 'repeater')
    into v_hq, v_mega, v_rep
    from public.crew_repeaters
   where crew_id = v_crew_id
     and destroyed_at is null
     and hp > 0;

  v_coins := v_hq * 200 + v_mega * 100 + v_rep * 50;

  return jsonb_build_object(
    'ok', true,
    'eligible', not v_already_claimed and v_active,
    'already_claimed', v_already_claimed,
    'active_in_24h', v_active,
    'last_walk_at', v_last_walk,
    'crew_id', v_crew_id,
    'hq_count', v_hq,
    'mega_count', v_mega,
    'repeater_count', v_rep,
    'total_coins', v_coins
  );
end $$;

revoke all on function public.get_my_dividend_status() from public;
grant execute on function public.get_my_dividend_status() to authenticated;

create or replace function public.claim_my_dividend()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_status jsonb := public.get_my_dividend_status();
  v_crew_id uuid;
  v_coins int;
  v_hq int; v_mega int; v_rep int;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;
  if not (v_status->>'eligible')::boolean then
    return jsonb_build_object('ok', false, 'error', coalesce(v_status->>'reason', 'not_eligible'), 'status', v_status);
  end if;

  v_crew_id := (v_status->>'crew_id')::uuid;
  v_coins   := (v_status->>'total_coins')::int;
  v_hq      := (v_status->>'hq_count')::int;
  v_mega    := (v_status->>'mega_count')::int;
  v_rep     := (v_status->>'repeater_count')::int;

  insert into public.repeater_dividend_claims
    (user_id, crew_id, claim_date, total_coins, repeater_count, hq_count, mega_count)
  values
    (v_user, v_crew_id, current_date, v_coins, v_rep, v_hq, v_mega)
  on conflict (user_id, claim_date) do nothing;

  update public.users
     set wegemuenzen = coalesce(wegemuenzen, 0) + v_coins,
         xp = coalesce(xp, 0) + v_coins
   where id = v_user;

  return jsonb_build_object(
    'ok', true,
    'claimed_coins', v_coins,
    'hq_count', v_hq,
    'mega_count', v_mega,
    'repeater_count', v_rep
  );
end $$;

revoke all on function public.claim_my_dividend() from public;
grant execute on function public.claim_my_dividend() to authenticated;
