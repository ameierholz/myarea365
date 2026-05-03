-- ══════════════════════════════════════════════════════════════════════════
-- Wachstumsfond ("Growth Fund"): 9,99€ einmalig, Gems bei Rang-Meilensteinen
-- ══════════════════════════════════════════════════════════════════════════
-- CoD-Style: Spieler kauft Pakt einmalig, schaltet 10 Gem-Belohnungen frei,
-- die er ab dem jeweiligen Rang abholen kann. Gesamtwert > Direktkauf.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.growth_fund_milestones (
  id int primary key,
  required_rank_id int not null,         -- 1..10 (Scout..Straßengott)
  gems_reward int not null check (gems_reward > 0),
  sort_order int not null default 0
);

create table if not exists public.user_growth_fund (
  user_id uuid primary key references public.users(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  claimed_milestones int[] not null default '{}'::int[]
);

alter table public.growth_fund_milestones enable row level security;
alter table public.user_growth_fund       enable row level security;

drop policy if exists "gf_ms_read"  on public.growth_fund_milestones;
drop policy if exists "gf_user_rd"  on public.user_growth_fund;
drop policy if exists "gf_user_upd" on public.user_growth_fund;

create policy "gf_ms_read"  on public.growth_fund_milestones for select to authenticated using (true);
create policy "gf_user_rd"  on public.user_growth_fund       for select to authenticated using (auth.uid() = user_id);
create policy "gf_user_upd" on public.user_growth_fund       for update to authenticated using (auth.uid() = user_id);

-- ─── Purchase ────────────────────────────────────────────────────────────
create or replace function public.purchase_growth_fund(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_growth_fund (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  return true;
end $$;

-- ─── Claim einzelner Meilenstein ─────────────────────────────────────────
-- Voraussetzung: User hat Fund gekauft + erreichte Rang ≥ required_rank_id
create or replace function public.claim_growth_fund_milestone(
  p_user_id uuid, p_milestone_id int
) returns table(claimed boolean, gems int, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchased timestamptz;
  v_claimed   int[];
  v_required  int;
  v_gems      int;
  v_user_xp   int;
  v_user_rank int;
begin
  select purchased_at, claimed_milestones into v_purchased, v_claimed
    from public.user_growth_fund where user_id = p_user_id;

  if v_purchased is null then
    return query select false, 0, 'not_purchased'; return;
  end if;

  if p_milestone_id = any(v_claimed) then
    return query select false, 0, 'already_claimed'; return;
  end if;

  select required_rank_id, gems_reward into v_required, v_gems
    from public.growth_fund_milestones where id = p_milestone_id;
  if v_required is null then
    return query select false, 0, 'milestone_not_found'; return;
  end if;

  -- User-Rang aus xp ableiten (vereinfachte Logik — RUNNER_RANKS in code/lib/game-config)
  select coalesce(xp, 0) into v_user_xp from public.users where id = p_user_id;
  v_user_rank := case
    when v_user_xp >= 250000 then 10  when v_user_xp >= 100000 then 9
    when v_user_xp >=  50000 then 8   when v_user_xp >=  25000 then 7
    when v_user_xp >=  10000 then 6   when v_user_xp >=   5000 then 5
    when v_user_xp >=   2500 then 4   when v_user_xp >=   1000 then 3
    when v_user_xp >=    300 then 2   else 1 end;

  if v_user_rank < v_required then
    return query select false, 0, 'rank_too_low'; return;
  end if;

  update public.user_growth_fund
    set claimed_milestones = array_append(claimed_milestones, p_milestone_id)
    where user_id = p_user_id;

  -- Gems gutschreiben (users.gem_balance falls existiert, sonst stub)
  update public.users set gem_balance = coalesce(gem_balance, 0) + v_gems where id = p_user_id;

  return query select true, v_gems, null::text;
end $$;

grant execute on function public.purchase_growth_fund(uuid) to authenticated, service_role;
grant execute on function public.claim_growth_fund_milestone(uuid, int) to authenticated, service_role;

-- ─── Seed: 10 Meilensteine, Gesamtwert ≈ 82.000 Gems ─────────────────────
insert into public.growth_fund_milestones (id, required_rank_id, gems_reward, sort_order) values
  (1,  1, 1000,  1),     -- Scout
  (2,  2, 2000,  2),     -- Vagabunde
  (3,  3, 3000,  3),     -- Scout des Blocks
  (4,  4, 5000,  4),     -- Stadt-Pionier
  (5,  5, 7000,  5),     -- Bezirks-Erkunder
  (6,  6, 9000,  6),     -- Kiez-Boss
  (7,  7, 11000, 7),     -- Block-König
  (8,  8, 13000, 8),     -- Großstadt-Legende
  (9,  9, 15000, 9),     -- Stadt-Mythos
  (10, 10, 16000, 10)    -- Straßengott
on conflict (id) do nothing;
