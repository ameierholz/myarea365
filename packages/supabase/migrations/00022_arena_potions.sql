-- Arena-Tränke: Einmal-Verbrauch, 1h Haltbarkeit nach Aktivierung, Verlust bei verlorenem Kampf
-- Rarity-Tiering: common (Bronze-Pack) / rare (Silber) / epic (Gold)

-- 1) Katalog
create table if not exists public.potion_catalog (
  id text primary key,
  name text not null,
  icon text not null default '🧪',
  description text not null,
  rarity text not null check (rarity in ('common', 'rare', 'epic')),
  effect_key text not null,          -- Mappt auf BattleInput.talent_bonuses-Keys
  effect_value numeric not null,     -- z.B. 0.20 für +20%
  duration_min int not null default 60,
  sort int not null default 0
);

alter table public.potion_catalog enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='potion_catalog' and policyname='read_all') then
    create policy read_all on public.potion_catalog for select using (true);
  end if;
end $$;

-- 2) User-Inventar
create table if not exists public.user_potions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  potion_id text not null references public.potion_catalog(id),
  acquired_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_potions_user on public.user_potions(user_id) where used_at is null;
create index if not exists idx_user_potions_active on public.user_potions(user_id, expires_at) where activated_at is not null and used_at is null;

alter table public.user_potions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_potions' and policyname='read_own') then
    create policy read_own on public.user_potions for select using (auth.uid() = user_id);
  end if;
end $$;

-- 3) Seed-Katalog
insert into public.potion_catalog (id, name, icon, description, rarity, effect_key, effect_value, sort) values
  ('potion_hp_s',         'Kleiner HP-Trank',      '🧪', '+15% MaxHP für 1 Stunde',           'common', 'hp_pct',      0.15,  10),
  ('potion_atk_s',        'Kleiner Angriffstrank', '⚔️', '+10% ATK für 1 Stunde',             'common', 'atk_pct',     0.10,  20),
  ('potion_def_s',        'Kleiner Verteidigungstrank','🛡️','+10% DEF für 1 Stunde',          'common', 'def_pct',     0.10,  30),
  ('potion_speed_s',      'Kleiner Geschwindigkeitstrank','💨','+20% ATK Runde 1',            'common', 'r1_atk_pct',  0.20,  40),
  ('potion_regen_s',      'Kleiner Heiltrank',     '💚', '+3% HP-Regen pro Runde',            'common', 'regen_pct',   0.03,  50),

  ('potion_hp_m',         'HP-Trank',              '🧪', '+25% MaxHP für 1 Stunde',           'rare',   'hp_pct',      0.25,  60),
  ('potion_atk_m',        'Angriffstrank',         '⚔️', '+20% ATK für 1 Stunde',             'rare',   'atk_pct',     0.20,  70),
  ('potion_def_m',        'Verteidigungstrank',    '🛡️', '+20% DEF für 1 Stunde',             'rare',   'def_pct',     0.20,  80),
  ('potion_crit_m',       'Krit-Trank',            '💥', '+20% Krit-Chance für 1 Stunde',     'rare',   'crit_pct',    0.20,  90),
  ('potion_lifesteal_m',  'Bluttrank',             '🩸', '+20% Lifesteal für 1 Stunde',       'rare',   'heal_on_hit', 0.20, 100),
  ('potion_mana_m',       'Manatrank',             '⚡', '+500 Start-Rage',                    'rare',   'start_rage',  500,  110),

  ('potion_hp_l',         'Großer HP-Trank',       '🧪', '+40% MaxHP für 1 Stunde',           'epic',   'hp_pct',      0.40, 120),
  ('potion_atk_l',        'Großer Angriffstrank',  '⚔️', '+35% ATK für 1 Stunde',             'epic',   'atk_pct',     0.35, 130),
  ('potion_thorns_l',     'Dornentrank',           '🌵', '25% Dornen-Reflektion',              'epic',   'thorns_pct',  0.25, 140),
  ('potion_penetration_l','Durchdringungstrank',   '🎯', '30% DEF-Penetration',                'epic',   'pen_pct',     0.30, 150),
  ('potion_regen_l',      'Großer Heiltrank',      '💚', '+8% HP-Regen pro Runde',             'epic',   'regen_pct',   0.08, 160)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  rarity = excluded.rarity, effect_key = excluded.effect_key, effect_value = excluded.effect_value,
  sort = excluded.sort;

-- 4) RPC: Zufälligen Trank einer Seltenheit gutschreiben
create or replace function public.grant_random_potion(p_user_id uuid, p_rarity text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_potion record;
begin
  select id, name, icon, rarity
    into v_potion
  from public.potion_catalog
  where rarity = p_rarity
  order by random() limit 1;
  if v_potion is null then return jsonb_build_object('ok', false, 'error', 'no_potion_for_rarity'); end if;
  insert into public.user_potions (user_id, potion_id) values (p_user_id, v_potion.id);
  return jsonb_build_object('ok', true, 'potion_id', v_potion.id, 'name', v_potion.name, 'icon', v_potion.icon, 'rarity', v_potion.rarity);
end $$;

-- 5) RPC: Trank aktivieren
create or replace function public.activate_potion(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_row record;
  v_duration int;
begin
  select up.*, c.duration_min into v_row
  from public.user_potions up
  join public.potion_catalog c on c.id = up.potion_id
  where up.id = p_instance_id and up.user_id = auth.uid();
  if v_row is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_row.used_at is not null then return jsonb_build_object('ok', false, 'error', 'already_used'); end if;
  if v_row.activated_at is not null then return jsonb_build_object('ok', false, 'error', 'already_activated'); end if;

  v_duration := coalesce(v_row.duration_min, 60);
  update public.user_potions
    set activated_at = now(), expires_at = now() + (v_duration || ' minutes')::interval
    where id = p_instance_id;
  return jsonb_build_object('ok', true, 'expires_at', (now() + (v_duration || ' minutes')::interval)::text);
end $$;

-- 6) RPC: Aktive Tränke eines Users (für Kampf-Integration)
create or replace function public.get_active_potions(p_user_id uuid)
returns table (
  instance_id uuid,
  potion_id text,
  effect_key text,
  effect_value numeric,
  expires_at timestamptz
)
language sql
stable
as $$
  select up.id, up.potion_id, c.effect_key, c.effect_value, up.expires_at
  from public.user_potions up
  join public.potion_catalog c on c.id = up.potion_id
  where up.user_id = p_user_id
    and up.activated_at is not null
    and up.used_at is null
    and up.expires_at > now()
$$;

-- 7) RPC: Aktive Tränke nach verlorenem Kampf konsumieren
create or replace function public.consume_active_potions(p_user_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  update public.user_potions
    set used_at = now()
    where user_id = p_user_id
      and activated_at is not null
      and used_at is null
      and expires_at > now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- 8) daily-deal RPC erweitern: random_potion Content-Type
create or replace function public.purchase_daily_deal(p_pack_id text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user uuid := auth.uid();
  v_pack record;
  v_today date := (now() at time zone 'UTC')::date;
  v_gems_before int;
  v_entry jsonb;
  v_gem_reward int := 0;
  v_xp_hours int := 0;
  v_arena_days int := 0;
  v_is_eur boolean;
  v_seals_granted int := 0;
  v_potions_granted int := 0;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select * into v_pack from public.daily_deal_packs where id = p_pack_id and active;
  if v_pack is null then return jsonb_build_object('ok', false, 'error', 'pack_unavailable'); end if;

  v_is_eur := (v_pack.price_cents is not null and v_pack.price_cents > 0);

  if exists (
    select 1 from public.user_daily_purchases
    where user_id = v_user and pack_id = p_pack_id and purchased_utc_date = v_today
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_purchased_today');
  end if;

  if not v_is_eur then
    select coalesce(gems, 0) into v_gems_before from public.user_gems where user_id = v_user;
    v_gems_before := coalesce(v_gems_before, 0);
    if v_gems_before < v_pack.price_gems then
      return jsonb_build_object('ok', false, 'error', 'not_enough_gems', 'have', v_gems_before, 'need', v_pack.price_gems);
    end if;
    update public.user_gems
      set gems = gems - v_pack.price_gems,
          total_spent = total_spent + v_pack.price_gems,
          updated_at = now()
      where user_id = v_user;
    insert into public.gem_transactions(user_id, delta, reason, metadata)
      values (v_user, -v_pack.price_gems, 'daily_deal', jsonb_build_object('pack_id', p_pack_id));
  end if;

  insert into public.user_siegel (user_id) values (v_user) on conflict (user_id) do nothing;
  insert into public.user_gems (user_id, gems) values (v_user, 0) on conflict (user_id) do nothing;

  for v_entry in select * from jsonb_array_elements(v_pack.contents) loop
    declare
      v_type text := v_entry->>'type';
      v_amount int := coalesce((v_entry->>'amount')::int, 0);
      v_min int := coalesce((v_entry->>'min')::int, 1);
      v_max int := coalesce((v_entry->>'max')::int, v_min);
      v_roll int;
      v_pick int;
      v_rarity text;
    begin
      case v_type
        when 'gems' then
          update public.user_gems
            set gems = gems + v_amount, total_purchased = total_purchased + v_amount, updated_at = now()
            where user_id = v_user;
          insert into public.gem_transactions(user_id, delta, reason, metadata)
            values (v_user, v_amount, 'daily_deal_bonus_gems', jsonb_build_object('pack_id', p_pack_id));
          v_gem_reward := v_gem_reward + v_amount;
        when 'xp_boost_hours' then
          insert into public.user_shop_purchases(user_id, shop_item_id, price_paid_gems, expires_at)
            select v_user, 'xp_boost_daily', 0, now() + (v_amount || ' hours')::interval
            where exists (select 1 from public.gem_shop_items where id = 'xp_boost_1h')
               or not exists (select 1 from public.gem_shop_items where id = 'xp_boost_daily');
          v_xp_hours := v_xp_hours + v_amount;
        when 'random_seals' then
          v_roll := floor(random() * (v_max - v_min + 1))::int + v_min;
          for i in 1..v_roll loop
            v_pick := floor(random() * 5)::int;
            if v_pick = 0 then
              update public.user_siegel set siegel_infantry = siegel_infantry + 1, updated_at = now() where user_id = v_user;
            elsif v_pick = 1 then
              update public.user_siegel set siegel_cavalry = siegel_cavalry + 1, updated_at = now() where user_id = v_user;
            elsif v_pick = 2 then
              update public.user_siegel set siegel_marksman = siegel_marksman + 1, updated_at = now() where user_id = v_user;
            elsif v_pick = 3 then
              update public.user_siegel set siegel_mage = siegel_mage + 1, updated_at = now() where user_id = v_user;
            else
              update public.user_siegel set siegel_universal = siegel_universal + 1, updated_at = now() where user_id = v_user;
            end if;
          end loop;
          v_seals_granted := v_seals_granted + v_roll;
        when 'random_potion' then
          v_rarity := coalesce(v_entry->>'rarity', 'common');
          perform public.grant_random_potion(v_user, v_rarity);
          v_potions_granted := v_potions_granted + 1;
        when 'arena_pass_days' then
          update public.user_gems
            set arena_pass_expires_at = greatest(coalesce(arena_pass_expires_at, now()), now()) + (v_amount || ' days')::interval,
                updated_at = now()
            where user_id = v_user;
          v_arena_days := v_arena_days + v_amount;
        when 'respec_token', 'skin_token', 'pin_theme_token' then
          insert into public.user_shop_purchases(user_id, shop_item_id, price_paid_gems, expires_at)
            values (v_user, 'token_' || v_type, 0, null);
        else
          null;
      end case;
    end;
  end loop;

  insert into public.user_daily_purchases(user_id, pack_id, purchased_utc_date, price_gems_paid, contents)
    values (v_user, p_pack_id, v_today, case when v_is_eur then 0 else v_pack.price_gems end, v_pack.contents);

  return jsonb_build_object(
    'ok', true, 'pack_id', p_pack_id,
    'paid_eur_cents', case when v_is_eur then v_pack.price_cents else null end,
    'gems_spent', case when v_is_eur then 0 else v_pack.price_gems end,
    'gems_gained', v_gem_reward,
    'xp_boost_hours', v_xp_hours,
    'arena_pass_days', v_arena_days,
    'seals_granted', v_seals_granted,
    'potions_granted', v_potions_granted,
    'contents', v_pack.contents
  );
end $$;

-- 9) Daily-Deal-Inhalte erweitern: jeder Pack bekommt 1 Trank
update public.daily_deal_packs set contents = contents || '[{"type":"random_potion","rarity":"common","label":"1× Zufälliger Trank (Gewöhnlich)"}]'::jsonb
where id = 'daily_bronze' and not (contents::text like '%random_potion%');

update public.daily_deal_packs set contents = contents || '[{"type":"random_potion","rarity":"rare","label":"1× Zufälliger Trank (Selten)"}]'::jsonb
where id = 'daily_silver' and not (contents::text like '%random_potion%');

update public.daily_deal_packs set contents = contents || '[{"type":"random_potion","rarity":"epic","label":"1× Zufälliger Trank (Episch)"}]'::jsonb
where id = 'daily_gold' and not (contents::text like '%random_potion%');

-- Super-Bundle: je 1 von jeder Rarity
update public.daily_deal_packs set contents = contents || '[
  {"type":"random_potion","rarity":"common","label":"1× Zufälliger Trank (Gewöhnlich)"},
  {"type":"random_potion","rarity":"rare","label":"1× Zufälliger Trank (Selten)"},
  {"type":"random_potion","rarity":"epic","label":"1× Zufälliger Trank (Episch)"}
]'::jsonb
where id = 'daily_super' and not (contents::text like '%random_potion%');

-- 10) Gem-Shop: Zufällige Tränke kaufbar (Kategorie booster)
insert into public.gem_shop_items (id, category, name, description, icon, price_gems, duration_hours, payload, sort) values
  ('potion_random_common', 'booster', 'Trank-Paket (Gewöhnlich)', 'Zufälliger Trank aus dem Pool der gewöhnlichen Tränke. 1 Stunde Haltbarkeit nach Aktivierung.', '🧪',  50, null, '{"effect":"random_potion","rarity":"common"}', 200),
  ('potion_random_rare',   'booster', 'Trank-Paket (Selten)',     'Zufälliger Trank aus dem Pool der seltenen Tränke. 1 Stunde Haltbarkeit nach Aktivierung.',   '⚗️', 200, null, '{"effect":"random_potion","rarity":"rare"}',   210),
  ('potion_random_epic',   'booster', 'Trank-Paket (Episch)',     'Zufälliger Trank aus dem Pool der epischen Tränke. 1 Stunde Haltbarkeit nach Aktivierung.',   '🔮', 500, null, '{"effect":"random_potion","rarity":"epic"}',   220)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  price_gems = excluded.price_gems, payload = excluded.payload, sort = excluded.sort, active = true;

-- 11) RPC: Wald-/Straßen-Loot-Roll — Trank mit gewichteter Chance
-- Drop-Raten: 30% common, 10% rare, 3% epic (sonst nichts)
create or replace function public.roll_loot_potion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_roll float := random();
  v_rarity text;
begin
  if v_roll < 0.03 then v_rarity := 'epic';
  elsif v_roll < 0.13 then v_rarity := 'rare';
  elsif v_roll < 0.43 then v_rarity := 'common';
  else return jsonb_build_object('ok', true, 'potion', null);
  end if;
  return public.grant_random_potion(p_user_id, v_rarity) || jsonb_build_object('rarity', v_rarity);
end $$;

grant execute on function public.grant_random_potion(uuid, text) to authenticated;
grant execute on function public.activate_potion(uuid) to authenticated;
grant execute on function public.get_active_potions(uuid) to authenticated;
grant execute on function public.consume_active_potions(uuid) to authenticated;
grant execute on function public.roll_loot_potion(uuid) to authenticated;
