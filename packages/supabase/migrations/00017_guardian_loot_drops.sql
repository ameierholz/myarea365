-- Loot-System: jede verifizierte Deal-Einloesung rollt einen XP-Drop
-- auf den aktiven Waechter des Runners.
-- Quoten: 60% nichts, 25% common (+100 XP), 10% rare (+300 XP),
--         4% epic (+800 XP), 1% legend (+2500 XP).

create table if not exists public.guardian_drops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  redemption_id uuid references public.deal_redemptions(id) on delete set null,
  business_id uuid references public.local_businesses(id) on delete set null,
  rarity text not null check (rarity in ('none','common','rare','epic','legend')),
  xp_awarded int not null default 0,
  claimed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_guardian_drops_user on public.guardian_drops(user_id, created_at desc);
create index if not exists idx_guardian_drops_unclaimed on public.guardian_drops(user_id) where not claimed;

alter table public.guardian_drops enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'guardian_drops' and policyname = 'select_own') then
    create policy select_own on public.guardian_drops for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'guardian_drops' and policyname = 'update_own') then
    create policy update_own on public.guardian_drops for update using (auth.uid() = user_id);
  end if;
end $$;

alter table public.deal_redemptions
  add column if not exists loot_rarity text check (loot_rarity in ('none','common','rare','epic','legend')),
  add column if not exists loot_xp int default 0;

-- Atomare RPC: Loot rollen nach Verify. Idempotent (keine Doppel-Drops pro Redemption).
create or replace function public.award_redemption_loot(p_redemption_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid;
  v_business uuid;
  v_roll float;
  v_rarity text;
  v_xp int;
  v_drop_id uuid;
begin
  select user_id, business_id into v_user, v_business
  from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then return null; end if;

  if exists (select 1 from public.guardian_drops where redemption_id = p_redemption_id) then
    return (select to_jsonb(d) from public.guardian_drops d where redemption_id = p_redemption_id limit 1);
  end if;

  v_roll := random();
  if v_roll < 0.60 then
    v_rarity := 'none'; v_xp := 0;
  elsif v_roll < 0.85 then
    v_rarity := 'common'; v_xp := 100;
  elsif v_roll < 0.95 then
    v_rarity := 'rare'; v_xp := 300;
  elsif v_roll < 0.99 then
    v_rarity := 'epic'; v_xp := 800;
  else
    v_rarity := 'legend'; v_xp := 2500;
  end if;

  insert into public.guardian_drops (user_id, redemption_id, business_id, rarity, xp_awarded)
  values (v_user, p_redemption_id, v_business, v_rarity, v_xp)
  returning id into v_drop_id;

  update public.deal_redemptions set loot_rarity = v_rarity, loot_xp = v_xp where id = p_redemption_id;

  if v_xp > 0 then
    update public.user_guardians set xp = xp + v_xp where user_id = v_user and is_active;
  end if;

  return jsonb_build_object('id', v_drop_id, 'rarity', v_rarity, 'xp_awarded', v_xp);
end $$;
