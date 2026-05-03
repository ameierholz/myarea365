-- ══════════════════════════════════════════════════════════════════════════
-- Runner-Inventar: Generisches Item-System für Speedups, Boosts, Truhen,
-- Schlüssel, Elixier, Tokens (CoD-Style Inventar)
-- ══════════════════════════════════════════════════════════════════════════
-- Bestehende Tabellen bleiben unangetastet:
--   user_items              → Wächter-Equipment (8-Slot)
--   user_potions            → Combat-Tränke
--   user_guardian_xp_items  → Wächter-XP-Bücher
--   user_materials          → Forge-Materialien (scrap/crystal/essence/relikt)
--
-- NEU hier:
--   inventory_item_catalog   → Definitionen aller stackable Inventar-Items
--   user_inventory_items     → Bestände pro User (count)
--   grant_inventory_item()   → RPC zum Vergeben (Quest-Rewards, Daily Deals etc.)
--   consume_inventory_item() → RPC zum Verbrauchen (Speedup nutzen, Truhe öffnen)
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Catalog ───────────────────────────────────────────────────────────
create table if not exists public.inventory_item_catalog (
  id text primary key,
  category text not null check (category in (
    'speedup', 'boost', 'chest', 'key', 'elixir', 'token', 'misc'
  )),
  name text not null,
  description text,
  emoji text,
  image_url text,
  rarity text not null default 'common'
    check (rarity in ('common', 'rare', 'epic', 'legendary')),
  -- Type-spezifische Daten als JSONB:
  --   speedup: { type: 'build'|'research'|'training'|'healing'|'march'|'universal', minutes: 60 }
  --   boost:   { effect: 'shield'|'gather'|'gold'|'wood'|'stone'|'mana'|'xp', duration_h: 8, value_pct: 50 }
  --   chest:   { tier: 'silver'|'gold'|'legendary' }
  --   key:     { opens: 'silver'|'gold' }
  --   elixir:  { amount: 20000 }
  --   token:   { effect: 'relocate'|'rename'|'vip_points', vip_points?: 50 }
  payload jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_inv_catalog_category on public.inventory_item_catalog(category) where active;
create index if not exists idx_inv_catalog_sort     on public.inventory_item_catalog(sort_order);

-- ─── 2) User-Bestand (stackable) ──────────────────────────────────────────
create table if not exists public.user_inventory_items (
  user_id     uuid not null references public.users(id) on delete cascade,
  catalog_id  text not null references public.inventory_item_catalog(id)
                on update cascade on delete cascade,
  count       int not null default 0 check (count >= 0),
  acquired_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create index if not exists idx_user_inv_user on public.user_inventory_items(user_id);

-- ─── 3) RLS ───────────────────────────────────────────────────────────────
alter table public.inventory_item_catalog enable row level security;
alter table public.user_inventory_items   enable row level security;

drop policy if exists "inv_catalog_read_all"     on public.inventory_item_catalog;
drop policy if exists "inv_user_read_own"        on public.user_inventory_items;

create policy "inv_catalog_read_all" on public.inventory_item_catalog
  for select to authenticated using (active);

create policy "inv_user_read_own" on public.user_inventory_items
  for select to authenticated using (auth.uid() = user_id);

-- ─── 4) RPCs ──────────────────────────────────────────────────────────────
create or replace function public.grant_inventory_item(
  p_user_id uuid,
  p_catalog_id text,
  p_count int default 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_count <= 0 then return; end if;
  insert into public.user_inventory_items (user_id, catalog_id, count, acquired_at)
  values (p_user_id, p_catalog_id, p_count, now())
  on conflict (user_id, catalog_id)
  do update set
    count       = user_inventory_items.count + excluded.count,
    acquired_at = now();
end $$;

create or replace function public.consume_inventory_item(
  p_user_id uuid,
  p_catalog_id text,
  p_count int default 1
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_have int;
begin
  select count into v_have from public.user_inventory_items
    where user_id = p_user_id and catalog_id = p_catalog_id
    for update;
  if v_have is null or v_have < p_count then return false; end if;
  update public.user_inventory_items
    set count = count - p_count
    where user_id = p_user_id and catalog_id = p_catalog_id;
  return true;
end $$;

grant execute on function public.grant_inventory_item(uuid, text, int)   to authenticated, service_role;
grant execute on function public.consume_inventory_item(uuid, text, int) to authenticated, service_role;

-- ─── 5) Seed Catalog ──────────────────────────────────────────────────────

-- Speedups (Build) — 1m / 5m / 15m / 30m / 1h / 3h / 8h / 15h / 24h
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('speedup_build_1m',  'speedup', 'Bau-Speedup (1 Min)',  'Verkürzt einen aktiven Bau um 1 Minute.',   '⚡', 'common',    '{"type":"build","minutes":1}',    100),
  ('speedup_build_5m',  'speedup', 'Bau-Speedup (5 Min)',  'Verkürzt einen aktiven Bau um 5 Minuten.',  '⚡', 'common',    '{"type":"build","minutes":5}',    101),
  ('speedup_build_15m', 'speedup', 'Bau-Speedup (15 Min)', 'Verkürzt einen aktiven Bau um 15 Minuten.', '⚡', 'common',    '{"type":"build","minutes":15}',   102),
  ('speedup_build_30m', 'speedup', 'Bau-Speedup (30 Min)', 'Verkürzt einen aktiven Bau um 30 Minuten.', '⚡', 'common',    '{"type":"build","minutes":30}',   103),
  ('speedup_build_60m', 'speedup', 'Bau-Speedup (1 Std)',  'Verkürzt einen aktiven Bau um 1 Stunde.',   '⚡', 'rare',      '{"type":"build","minutes":60}',   104),
  ('speedup_build_3h',  'speedup', 'Bau-Speedup (3 Std)',  'Verkürzt einen aktiven Bau um 3 Stunden.',  '⚡', 'rare',      '{"type":"build","minutes":180}',  105),
  ('speedup_build_8h',  'speedup', 'Bau-Speedup (8 Std)',  'Verkürzt einen aktiven Bau um 8 Stunden.',  '⚡', 'epic',      '{"type":"build","minutes":480}',  106),
  ('speedup_build_15h', 'speedup', 'Bau-Speedup (15 Std)', 'Verkürzt einen aktiven Bau um 15 Stunden.', '⚡', 'epic',      '{"type":"build","minutes":900}',  107),
  ('speedup_build_24h', 'speedup', 'Bau-Speedup (24 Std)', 'Verkürzt einen aktiven Bau um 24 Stunden.', '⚡', 'legendary', '{"type":"build","minutes":1440}', 108)
on conflict (id) do nothing;

-- Speedups (Universal — wirkt auf alle Aktivitäten)
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('speedup_uni_1m',  'speedup', 'Universal-Speedup (1 Min)',  'Verkürzt jede Aktivität um 1 Minute.',  '🌀', 'rare', '{"type":"universal","minutes":1}',   200),
  ('speedup_uni_5m',  'speedup', 'Universal-Speedup (5 Min)',  'Verkürzt jede Aktivität um 5 Minuten.', '🌀', 'rare', '{"type":"universal","minutes":5}',   201),
  ('speedup_uni_15m', 'speedup', 'Universal-Speedup (15 Min)', 'Verkürzt jede Aktivität um 15 Minuten.','🌀', 'epic', '{"type":"universal","minutes":15}',  202),
  ('speedup_uni_60m', 'speedup', 'Universal-Speedup (1 Std)',  'Verkürzt jede Aktivität um 1 Stunde.',  '🌀', 'epic', '{"type":"universal","minutes":60}',  203)
on conflict (id) do nothing;

-- Speedups (Truppen-Training)
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('speedup_train_5m',  'speedup', 'Truppen-Speedup (5 Min)', 'Verkürzt Truppen-Training um 5 Min.', '⚔', 'common', '{"type":"training","minutes":5}',  300),
  ('speedup_train_60m', 'speedup', 'Truppen-Speedup (1 Std)', 'Verkürzt Truppen-Training um 1 Std.', '⚔', 'rare',   '{"type":"training","minutes":60}', 301)
on conflict (id) do nothing;

-- Speedups (Heilung)
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('speedup_heal_5m',  'speedup', 'Heil-Speedup (5 Min)', 'Verkürzt Heilung um 5 Min.', '❤', 'common', '{"type":"healing","minutes":5}',  400),
  ('speedup_heal_60m', 'speedup', 'Heil-Speedup (1 Std)', 'Verkürzt Heilung um 1 Std.', '❤', 'rare',   '{"type":"healing","minutes":60}', 401)
on conflict (id) do nothing;

-- Boosts: Stadtschild
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('boost_shield_8h',  'boost', 'Stadtschild (8 Std)',  'Schützt deine Basis 8 Stunden vor Angriffen.',  '🛡', 'rare',     '{"effect":"shield","duration_h":8}',  500),
  ('boost_shield_24h', 'boost', 'Stadtschild (24 Std)', 'Schützt deine Basis 24 Stunden vor Angriffen.', '🛡', 'epic',     '{"effect":"shield","duration_h":24}', 501),
  ('boost_shield_2k',  'boost', 'Stadtschild (Punkte)', 'Aktiviere mit 2.000 Punkten Pfand.',            '🛡', 'epic',     '{"effect":"shield","points":2000}',   502),
  ('boost_shield_10k', 'boost', 'Großes Stadtschild',   'Aktiviere mit 10.000 Punkten Pfand.',           '🛡', 'legendary','{"effect":"shield","points":10000}',  503)
on conflict (id) do nothing;

-- Boosts: Sammeln + Resourcen-Produktion
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('boost_gather_8h',  'boost', 'Sammel-Boost (8 Std)',  '+25% Sammelgeschwindigkeit für 8 Stunden.',  '🪓', 'rare', '{"effect":"gather","duration_h":8,"value_pct":25}',  510),
  ('boost_gather_24h', 'boost', 'Sammel-Boost (24 Std)', '+25% Sammelgeschwindigkeit für 24 Stunden.', '🪓', 'epic', '{"effect":"gather","duration_h":24,"value_pct":25}', 511),
  ('boost_gold_8h',    'boost', 'Gold-Boost (8 Std)',    '+50% Gold-Produktion für 8 Stunden.',        '🪙', 'rare', '{"effect":"gold","duration_h":8,"value_pct":50}',    520),
  ('boost_gold_24h',   'boost', 'Gold-Boost (24 Std)',   '+50% Gold-Produktion für 24 Stunden.',       '🪙', 'epic', '{"effect":"gold","duration_h":24,"value_pct":50}',   521),
  ('boost_wood_8h',    'boost', 'Holz-Boost (8 Std)',    '+50% Holz-Produktion für 8 Stunden.',        '🪵', 'rare', '{"effect":"wood","duration_h":8,"value_pct":50}',    530),
  ('boost_wood_24h',   'boost', 'Holz-Boost (24 Std)',   '+50% Holz-Produktion für 24 Stunden.',       '🪵', 'epic', '{"effect":"wood","duration_h":24,"value_pct":50}',   531),
  ('boost_stone_8h',   'boost', 'Stein-Boost (8 Std)',   '+50% Stein-Produktion für 8 Stunden.',       '🪨', 'rare', '{"effect":"stone","duration_h":8,"value_pct":50}',   540),
  ('boost_stone_24h',  'boost', 'Stein-Boost (24 Std)',  '+50% Stein-Produktion für 24 Stunden.',      '🪨', 'epic', '{"effect":"stone","duration_h":24,"value_pct":50}',  541),
  ('boost_mana_8h',    'boost', 'Mana-Boost (8 Std)',    '+50% Mana-Produktion für 8 Stunden.',        '💧', 'rare', '{"effect":"mana","duration_h":8,"value_pct":50}',    550),
  ('boost_mana_24h',   'boost', 'Mana-Boost (24 Std)',   '+50% Mana-Produktion für 24 Stunden.',       '💧', 'epic', '{"effect":"mana","duration_h":24,"value_pct":50}',   551),
  ('boost_xp_8h',      'boost', 'XP-Boost (8 Std)',      '+50% Wächter-XP für 8 Stunden.',             '⭐', 'epic', '{"effect":"xp","duration_h":8,"value_pct":50}',      560),
  ('boost_xp_24h',     'boost', 'XP-Boost (24 Std)',     '+50% Wächter-XP für 24 Stunden.',            '⭐', 'epic', '{"effect":"xp","duration_h":24,"value_pct":50}',     561)
on conflict (id) do nothing;

-- Truhen
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('chest_silver',    'chest', 'Silberne Truhe',    'Eine silberne Truhe mit Beute.',           '🥈', 'rare',      '{"tier":"silver"}',    700),
  ('chest_gold',      'chest', 'Goldene Truhe',     'Eine goldene Truhe mit wertvoller Beute.', '🏆', 'epic',      '{"tier":"gold"}',      701),
  ('chest_legendary', 'chest', 'Legendäre Truhe',   'Garantiert legendäre Items.',              '💎', 'legendary', '{"tier":"legendary"}', 702),
  ('chest_event',     'chest', 'Event-Truhe',       'Saisonale Sondertruhe.',                   '🎁', 'epic',      '{"tier":"event"}',     703)
on conflict (id) do nothing;

-- Schlüssel
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('key_silver', 'key', 'Silberner Schlüssel', 'Öffnet silberne Truhen.', '🗝', 'rare', '{"opens":"silver"}', 800),
  ('key_gold',   'key', 'Goldener Schlüssel',  'Öffnet goldene Truhen.',  '🗝', 'epic', '{"opens":"gold"}',   801)
on conflict (id) do nothing;

-- Elixier (für Saison-Boost)
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('elixir_5k',  'elixir', '5.000 Elixier',  'Gewährt 5.000 Elixier zu Saison-Beginn.',  '🧪', 'rare', '{"amount":5000}',  900),
  ('elixir_20k', 'elixir', '20.000 Elixier', 'Gewährt 20.000 Elixier zu Saison-Beginn.', '🧪', 'epic', '{"amount":20000}', 901)
on conflict (id) do nothing;

-- Tokens
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order) values
  ('token_relocate', 'token', 'Umsiedlungs-Token', 'Verschiebt deine Basis auf der Karte.', '🗺',  'rare', '{"effect":"relocate"}',         1000),
  ('token_rename',   'token', 'Namens-Token',      'Ändere deinen Runner-Namen.',           '✏',  'rare', '{"effect":"rename"}',           1001),
  ('token_fastvip',  'token', 'Premium-Ticket',    '50 Premium-Punkte sofort.',             '⭐', 'rare', '{"effect":"vip_points","vip_points":50}', 1002)
on conflict (id) do nothing;
