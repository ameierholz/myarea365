-- ══════════════════════════════════════════════════════════════════════════
-- Wächter-XP-Items (CoD/RoK-Style)
-- ══════════════════════════════════════════════════════════════════════════
-- Stapelbare Verbrauchs-Items die gezielt XP an einen Wächter geben.
-- Drei Stufen: small=100 XP / medium=500 XP / large=1000 XP.
-- Werden über bestehenden Loot-Drop bei Deal-Redemption (rare+) gezogen.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Katalog ───────────────────────────────────────────────────────────
create table if not exists public.guardian_xp_items (
  id          text primary key,
  name        text not null,
  emoji       text not null,
  description text not null,
  rarity      text not null check (rarity in ('common','rare','epic')),
  xp_amount   int  not null check (xp_amount > 0),
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.guardian_xp_items (id, name, emoji, description, rarity, xp_amount, sort) values
  ('xp_pot_s', 'Kleines Erfahrungs-Elixier',  '⚗️', '+100 XP für einen Wächter',   'common', 100,  10),
  ('xp_pot_m', 'Erfahrungs-Elixier',          '🧪', '+500 XP für einen Wächter',   'rare',   500,  20),
  ('xp_pot_l', 'Großes Erfahrungs-Elixier',   '🏺', '+1000 XP für einen Wächter',  'epic',  1000,  30)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  rarity = excluded.rarity, xp_amount = excluded.xp_amount, sort = excluded.sort;

-- ─── 2) Spieler-Inventar (stapelbar) ──────────────────────────────────────
create table if not exists public.user_guardian_xp_items (
  user_id     uuid not null references public.users(id) on delete cascade,
  item_id     text not null references public.guardian_xp_items(id) on delete cascade,
  count       int  not null default 0 check (count >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists idx_user_xp_items_user on public.user_guardian_xp_items(user_id);

alter table public.guardian_xp_items       enable row level security;
alter table public.user_guardian_xp_items  enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='guardian_xp_items' and policyname='select_all') then
    create policy select_all on public.guardian_xp_items for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_guardian_xp_items' and policyname='select_own') then
    create policy select_own on public.user_guardian_xp_items for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 3) Apply-RPC: gibt XP an einen Wächter, dekrementiert Inventar ──────
create or replace function public.apply_guardian_xp_item(
  p_item_id      text,
  p_guardian_id  uuid,
  p_count        int default 1
) returns jsonb language plpgsql security definer as $$
declare
  v_user        uuid := auth.uid();
  v_have        int;
  v_xp_each     int;
  v_xp_total    int;
  v_owner       uuid;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if p_count is null or p_count < 1 then return jsonb_build_object('ok', false, 'error', 'bad_count'); end if;

  select user_id into v_owner from public.user_guardians where id = p_guardian_id;
  if v_owner is null then return jsonb_build_object('ok', false, 'error', 'guardian_not_found'); end if;
  if v_owner <> v_user then return jsonb_build_object('ok', false, 'error', 'not_yours'); end if;

  select xp_amount into v_xp_each from public.guardian_xp_items where id = p_item_id;
  if v_xp_each is null then return jsonb_build_object('ok', false, 'error', 'item_not_found'); end if;

  select count into v_have from public.user_guardian_xp_items where user_id = v_user and item_id = p_item_id;
  if coalesce(v_have, 0) < p_count then
    return jsonb_build_object('ok', false, 'error', 'not_enough', 'have', coalesce(v_have, 0));
  end if;

  v_xp_total := v_xp_each * p_count;

  update public.user_guardian_xp_items
     set count = count - p_count, updated_at = now()
   where user_id = v_user and item_id = p_item_id;

  update public.user_guardians set xp = xp + v_xp_total where id = p_guardian_id;

  return jsonb_build_object('ok', true, 'xp_added', v_xp_total, 'item_id', p_item_id, 'guardian_id', p_guardian_id);
end $$;

revoke all on function public.apply_guardian_xp_item(text, uuid, int) from public;
grant execute on function public.apply_guardian_xp_item(text, uuid, int) to authenticated;

-- ─── 4) Loot-Integration: Wächter-XP-Items als zusätzlicher Drop ─────────
-- Bei rare+ Drop: 35% Chance dass STATT eines Equip-Items ein XP-Elixier kommt.
-- Verteilung: rare→pot_s (100xp), epic→pot_m (500xp), legend→pot_l (1000xp).
create or replace function public.award_redemption_loot(p_redemption_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid; v_business uuid;
  v_roll float; v_rarity text; v_xp int; v_drop_id uuid;
  v_item_id text; v_user_item_id uuid;
  v_xp_item_id text;
begin
  select user_id, business_id into v_user, v_business from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then return null; end if;
  if exists (select 1 from public.guardian_drops where redemption_id = p_redemption_id) then
    return (select to_jsonb(d) from public.guardian_drops d where redemption_id = p_redemption_id limit 1);
  end if;

  v_roll := random();
  if v_roll < 0.60 then v_rarity := 'none';   v_xp := 0;
  elsif v_roll < 0.85 then v_rarity := 'common'; v_xp := 100;
  elsif v_roll < 0.95 then v_rarity := 'rare';   v_xp := 300;
  elsif v_roll < 0.99 then v_rarity := 'epic';   v_xp := 800;
  else                  v_rarity := 'legend'; v_xp := 2500; end if;

  -- 35% Chance auf XP-Elixier (rare+), sonst klassisches Equip-Item-Roll
  if v_rarity in ('rare','epic','legend') and random() < 0.35 then
    v_xp_item_id := case v_rarity
      when 'rare'   then 'xp_pot_s'
      when 'epic'   then 'xp_pot_m'
      else               'xp_pot_l'   -- legend
    end;
    insert into public.user_guardian_xp_items (user_id, item_id, count)
    values (v_user, v_xp_item_id, 1)
    on conflict (user_id, item_id) do update set count = public.user_guardian_xp_items.count + 1, updated_at = now();
    v_xp := 0;
  -- 40% Chance auf Equip-Item (legacy-Pfad)
  elsif v_rarity in ('rare','epic','legend') and random() < 0.40 then
    select id into v_item_id from public.item_catalog where rarity = v_rarity order by random() limit 1;
    if v_item_id is not null then
      insert into public.user_items (user_id, item_id, source) values (v_user, v_item_id, 'drop')
      returning id into v_user_item_id;
      v_xp := 0;
    end if;
  end if;

  insert into public.guardian_drops (user_id, redemption_id, business_id, rarity, xp_awarded)
  values (v_user, p_redemption_id, v_business, v_rarity, v_xp)
  returning id into v_drop_id;

  update public.deal_redemptions set loot_rarity = v_rarity, loot_xp = v_xp where id = p_redemption_id;
  if v_xp > 0 then
    update public.user_guardians set xp = xp + v_xp where user_id = v_user and is_active;
  end if;

  return jsonb_build_object(
    'id', v_drop_id, 'rarity', v_rarity, 'xp_awarded', v_xp,
    'item_id', v_item_id, 'user_item_id', v_user_item_id,
    'xp_item_id', v_xp_item_id
  );
end $$;
