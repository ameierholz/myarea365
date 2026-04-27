-- ══════════════════════════════════════════════════════════════════════════
-- VIP-SHOP — Rabatt-Angebote pro VIP-Tier
-- ══════════════════════════════════════════════════════════════════════════
-- Pro VIP-Tier verfügbare Angebote (Resourcen, Speed-Tokens, Truhen) gegen
-- Gems mit Rabatt; pro Angebot tägliches Stock-Limit (CoD-Pattern).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.vip_shop_offers (
  id              text primary key,
  name            text not null,
  description     text not null,
  emoji           text not null default '✨',
  required_vip    int  not null default 1 check (required_vip between 1 and 15),
  -- was du bekommst:
  reward_kind     text not null check (reward_kind in
    ('wood','stone','gold','mana','speed_token','silver_chest','gold_chest','vip_ticket','guardian_xp')),
  reward_amount   int  not null check (reward_amount > 0),
  -- preis in gems:
  price_gems      int  not null check (price_gems >= 0),
  original_gems   int,                       -- für Streichpreis-Anzeige
  daily_limit     int  not null default 1,   -- max. Käufe pro Tag pro User
  sort            int  not null default 0
);

create table if not exists public.vip_shop_purchases (
  user_id      uuid not null references public.users(id) on delete cascade,
  offer_id     text not null references public.vip_shop_offers(id) on delete cascade,
  purchase_date date not null,
  count        int  not null default 1,
  primary key (user_id, offer_id, purchase_date)
);

alter table public.vip_shop_offers enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='vip_shop_offers' and policyname='select_all') then
    create policy select_all on public.vip_shop_offers for select using (true);
  end if;
end $$;
grant select on public.vip_shop_offers to anon, authenticated;

alter table public.vip_shop_purchases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='vip_shop_purchases' and policyname='select_own') then
    create policy select_own on public.vip_shop_purchases for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── Seed-Angebote (alle 15 Tiers) ────────────────────────────────────────
insert into public.vip_shop_offers (id, name, description, emoji, required_vip, reward_kind, reward_amount, price_gems, original_gems, daily_limit, sort) values
  -- Tier 1+: Basis-Resourcen-Pakete
  ('vip_t1_wood',     '500 Holz',           '−40% Rabatt',  '🪵',  1, 'wood',         500,    30,   50, 5, 10),
  ('vip_t1_stone',    '500 Stein',          '−40% Rabatt',  '🪨',  1, 'stone',        500,    30,   50, 5, 11),
  ('vip_t2_gold',     '500 Gold',           '−40% Rabatt',  '🪙',  2, 'gold',         500,    40,   65, 5, 20),
  ('vip_t3_mana',     '300 Mana',           '−50% Rabatt',  '💧',  3, 'mana',         300,    35,   70, 3, 30),
  ('vip_t4_speed1',   '1× Speed-Token',     'Spart 5min',   '⚡',  4, 'speed_token',    1,    50,   75, 3, 40),
  ('vip_t5_silver',   '1× Silber-Truhe',    '−50% Rabatt',  '🥈',  5, 'silver_chest',   1,   100,  200, 2, 50),
  ('vip_t6_speed5',   '5× Speed-Tokens',    'Spart 25min',  '⚡',  6, 'speed_token',    5,   220,  350, 2, 60),
  ('vip_t7_gold5k',   '5.000 Gold',         '−60% Rabatt',  '🪙',  7, 'gold',        5000,   200,  500, 2, 70),
  ('vip_t8_gold_chest','1× Gold-Truhe',     '−60% Rabatt',  '🥇',  8, 'gold_chest',     1,   300,  750, 1, 80),
  ('vip_t9_ticket',   '5× VIP-Tickets',     '+250 VIP-Pkt', '🎟',  9, 'vip_ticket',     5,   400,  600, 1, 90),
  ('vip_t10_speed20', '20× Speed-Tokens',   'Spart 100min', '⚡', 10, 'speed_token',   20,   700, 1500, 1, 100),
  ('vip_t11_woodbig', '50.000 Holz',        '−70% Rabatt',  '🪵', 11, 'wood',       50000,   600, 2000, 1, 110),
  ('vip_t12_stonebig','50.000 Stein',       '−70% Rabatt',  '🪨', 12, 'stone',      50000,   600, 2000, 1, 120),
  ('vip_t13_goldbig', '100.000 Gold',       '−75% Rabatt',  '🪙', 13, 'gold',      100000,   900, 3500, 1, 130),
  ('vip_t14_silverbig','5× Silber-Truhen',  '−65% Rabatt',  '🥈', 14, 'silver_chest',  5,   400, 1100, 1, 140),
  ('vip_t15_goldbig', '5× Gold-Truhen',     '−70% Rabatt',  '🥇', 15, 'gold_chest',    5,  1000, 3300, 1, 150),
  ('vip_t15_titan',   '10× VIP-Tickets',    '+500 VIP-Pkt', '🎟', 15, 'vip_ticket',   10,   700, 1200, 2, 151)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, emoji = excluded.emoji,
  required_vip = excluded.required_vip, reward_kind = excluded.reward_kind,
  reward_amount = excluded.reward_amount, price_gems = excluded.price_gems,
  original_gems = excluded.original_gems, daily_limit = excluded.daily_limit, sort = excluded.sort;

-- ─── RPC: get_vip_shop_state() — Angebote + heutige Käufe ────────────────
create or replace function public.get_vip_shop_state()
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object('ok', true,
    'offers', (select coalesce(jsonb_agg(o.*), '[]'::jsonb) from public.vip_shop_offers o),
    'purchased_today', (select coalesce(jsonb_object_agg(offer_id, count), '{}'::jsonb)
                        from public.vip_shop_purchases
                        where user_id = v_user and purchase_date = v_today));
end $$;
revoke all on function public.get_vip_shop_state() from public;
grant execute on function public.get_vip_shop_state() to authenticated;

-- ─── RPC: purchase_vip_shop_offer(offer_id) ──────────────────────────────
create or replace function public.purchase_vip_shop_offer(p_offer_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_offer record;
  v_vip_level int;
  v_gems int;
  v_today_count int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_offer from public.vip_shop_offers where id = p_offer_id;
  if v_offer is null then return jsonb_build_object('ok', false, 'error', 'offer_not_found'); end if;

  -- VIP-Tier-Check
  select coalesce(vip_level, 0) into v_vip_level from public.vip_progress where user_id = v_user;
  if coalesce(v_vip_level, 0) < v_offer.required_vip then
    return jsonb_build_object('ok', false, 'error', 'vip_level_too_low',
      'required', v_offer.required_vip, 'have', coalesce(v_vip_level, 0));
  end if;

  -- Daily-Limit-Check
  select coalesce(count, 0) into v_today_count
    from public.vip_shop_purchases
   where user_id = v_user and offer_id = p_offer_id and purchase_date = v_today;
  if v_today_count >= v_offer.daily_limit then
    return jsonb_build_object('ok', false, 'error', 'daily_limit_reached',
      'limit', v_offer.daily_limit);
  end if;

  -- Gems-Check + Abzug (Gems leben in user_gems, nicht user_resources)
  insert into public.user_gems (user_id) values (v_user) on conflict do nothing;
  select coalesce(gems, 0) into v_gems from public.user_gems where user_id = v_user for update;
  if coalesce(v_gems, 0) < v_offer.price_gems then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gems',
      'have', coalesce(v_gems, 0), 'need', v_offer.price_gems);
  end if;
  update public.user_gems set gems = gems - v_offer.price_gems, total_spent = total_spent + v_offer.price_gems, updated_at = now() where user_id = v_user;

  -- Reward gutschreiben
  if v_offer.reward_kind in ('wood','stone','gold','mana','speed_token','vip_ticket','guardian_xp') then
    execute format('update public.user_resources set %I = coalesce(%I, 0) + $1, updated_at = now() where user_id = $2',
      v_offer.reward_kind, v_offer.reward_kind)
      using v_offer.reward_amount, v_user;
  elsif v_offer.reward_kind = 'silver_chest' then
    insert into public.treasure_chests (owner_user_id, kind, source, opens_at)
      select v_user, 'silver', 'vip_shop', now() + interval '24 hours'
      from generate_series(1, v_offer.reward_amount);
  elsif v_offer.reward_kind = 'gold_chest' then
    insert into public.treasure_chests (owner_user_id, kind, source, opens_at)
      select v_user, 'gold', 'vip_shop', now() + interval '24 hours'
      from generate_series(1, v_offer.reward_amount);
  end if;

  -- Purchase tracken
  insert into public.vip_shop_purchases (user_id, offer_id, purchase_date, count)
  values (v_user, p_offer_id, v_today, 1)
  on conflict (user_id, offer_id, purchase_date) do update set count = vip_shop_purchases.count + 1;

  return jsonb_build_object('ok', true,
    'offer_id', p_offer_id,
    'reward_kind', v_offer.reward_kind,
    'reward_amount', v_offer.reward_amount);
end $$;
revoke all on function public.purchase_vip_shop_offer(text) from public;
grant execute on function public.purchase_vip_shop_offer(text) to authenticated;
