-- ══════════════════════════════════════════════════════════════════════════
-- Gacha-Events: Glücksrad ("Lucky Wheel") + Artefakt-Schmiede ("Forge of Light")
-- ══════════════════════════════════════════════════════════════════════════
-- Lucky Wheel:    3-Tage-Event, 200 max Spins, Pity 10 → garantiert Rare,
--                 1 Spin = 700 Gems oder via Bundle
-- Forge of Light: 14-Tage-Event, Pity 10 → garantiert Epic+, jede 3. Legendary
--                 = featured Artefakt, 600 Gems pro Pull
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Lucky Wheel ─────────────────────────────────────────────────────
create table if not exists public.lucky_wheel_events (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  spin_cost_gems int not null default 700,
  max_spins int not null default 200,
  -- prize_pool: [{weight, type: 'gems'|'coins'|'item', amount?, catalog_id?, count?, label}]
  prize_pool jsonb not null,
  pity_threshold int not null default 10,        -- jeder Nter Spin garantiert "guaranteed_rare"
  guaranteed_pool jsonb not null default '[]'::jsonb
);

create table if not exists public.user_wheel_spins (
  user_id uuid not null references public.users(id) on delete cascade,
  event_id text not null references public.lucky_wheel_events(id) on delete cascade,
  spins_used int not null default 0,
  pity_counter int not null default 0,
  total_gems_won int not null default 0,
  primary key (user_id, event_id)
);

alter table public.lucky_wheel_events enable row level security;
alter table public.user_wheel_spins   enable row level security;

drop policy if exists "lw_evt_read" on public.lucky_wheel_events;
drop policy if exists "lw_user_rd"  on public.user_wheel_spins;

create policy "lw_evt_read" on public.lucky_wheel_events for select to authenticated using (true);
create policy "lw_user_rd"  on public.user_wheel_spins   for select to authenticated using (auth.uid() = user_id);

-- Spin RPC: zieht Prize, dekrementiert pity, gibt Reward zurück
create or replace function public.spin_lucky_wheel(p_user_id uuid, p_event_id text)
returns table(prize_type text, prize_label text, prize_amount int, catalog_id text, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evt record;
  v_state record;
  v_pool jsonb;
  v_chosen jsonb;
  v_total numeric;
  v_roll numeric;
  v_acc numeric := 0;
  v_pity int;
begin
  select * into v_evt from public.lucky_wheel_events where id = p_event_id;
  if v_evt is null then return query select null::text, null::text, null::int, null::text, 'event_not_found'::text; return; end if;
  if now() < v_evt.starts_at or now() > v_evt.ends_at then
    return query select null::text, null::text, null::int, null::text, 'event_inactive'::text; return;
  end if;

  insert into public.user_wheel_spins (user_id, event_id) values (p_user_id, p_event_id)
    on conflict do nothing;
  select * into v_state from public.user_wheel_spins where user_id = p_user_id and event_id = p_event_id;

  if v_state.spins_used >= v_evt.max_spins then
    return query select null::text, null::text, null::int, null::text, 'max_spins_reached'::text; return;
  end if;

  -- Pity-Trigger: jeder N-te Spin = guaranteed_pool
  v_pity := v_state.pity_counter + 1;
  if v_pity >= v_evt.pity_threshold and jsonb_array_length(v_evt.guaranteed_pool) > 0 then
    v_pool := v_evt.guaranteed_pool;
    v_pity := 0;
  else
    v_pool := v_evt.prize_pool;
  end if;

  -- Gewichteter Zufall
  select sum((p->>'weight')::numeric) into v_total from jsonb_array_elements(v_pool) p;
  v_roll := random() * v_total;
  for v_chosen in select value from jsonb_array_elements(v_pool) loop
    v_acc := v_acc + (v_chosen->>'weight')::numeric;
    if v_roll <= v_acc then exit; end if;
  end loop;

  -- Reward gewähren
  prize_type   := v_chosen->>'type';
  prize_label  := v_chosen->>'label';
  prize_amount := coalesce((v_chosen->>'amount')::int, (v_chosen->>'count')::int, 0);
  catalog_id   := v_chosen->>'catalog_id';

  if prize_type = 'gems' and prize_amount > 0 then
    update public.users set gem_balance = coalesce(gem_balance, 0) + prize_amount where id = p_user_id;
  elsif prize_type = 'coins' and prize_amount > 0 then
    update public.users set xp = coalesce(xp, 0) + prize_amount where id = p_user_id;
  elsif prize_type = 'item' and catalog_id is not null then
    perform public.grant_inventory_item(p_user_id, catalog_id, greatest(prize_amount, 1));
  end if;

  update public.user_wheel_spins
    set spins_used = spins_used + 1,
        pity_counter = v_pity,
        total_gems_won = total_gems_won + (case when prize_type = 'gems' then prize_amount else 0 end)
    where user_id = p_user_id and event_id = p_event_id;

  error := null;
  return next;
end $$;

grant execute on function public.spin_lucky_wheel(uuid, text) to authenticated, service_role;

-- ─── 2) Forge of Light ──────────────────────────────────────────────────
create table if not exists public.forge_events (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  pull_cost_gems int not null default 600,
  -- featured_artifacts: [{ id, name, emoji, rarity }]
  featured_artifacts jsonb not null default '[]'::jsonb,
  pity_epic int not null default 10,             -- jeder Nter Pull = Epic+
  pity_legendary int not null default 30,        -- jeder Nter Pull = Legendary
  -- artifact_pool: [{weight, id, name, emoji, rarity}]
  artifact_pool jsonb not null
);

create table if not exists public.user_forge_pulls (
  user_id uuid not null references public.users(id) on delete cascade,
  event_id text not null references public.forge_events(id) on delete cascade,
  pulls_used int not null default 0,
  pity_epic_counter int not null default 0,
  pity_legendary_counter int not null default 0,
  featured_pulls int not null default 0,         -- Anzahl gepullter Featureds
  primary key (user_id, event_id)
);

create table if not exists public.user_forge_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id text not null references public.forge_events(id) on delete cascade,
  artifact_id text not null,
  artifact_name text not null,
  rarity text not null,
  is_featured boolean not null default false,
  pulled_at timestamptz not null default now()
);

create index if not exists idx_forge_hist_user on public.user_forge_history(user_id, event_id);

alter table public.forge_events       enable row level security;
alter table public.user_forge_pulls   enable row level security;
alter table public.user_forge_history enable row level security;

drop policy if exists "fe_evt_read" on public.forge_events;
drop policy if exists "fe_user_rd"  on public.user_forge_pulls;
drop policy if exists "fh_user_rd"  on public.user_forge_history;

create policy "fe_evt_read" on public.forge_events       for select to authenticated using (true);
create policy "fe_user_rd"  on public.user_forge_pulls   for select to authenticated using (auth.uid() = user_id);
create policy "fh_user_rd"  on public.user_forge_history for select to authenticated using (auth.uid() = user_id);

-- Pull RPC: zieht Artefakt mit Pity-System
create or replace function public.pull_forge_artifact(p_user_id uuid, p_event_id text)
returns table(artifact_id text, artifact_name text, emoji text, rarity text, is_featured boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evt record;
  v_state record;
  v_pool jsonb;
  v_chosen jsonb;
  v_filtered jsonb;
  v_total numeric;
  v_roll numeric;
  v_acc numeric := 0;
  v_pity_e int;
  v_pity_l int;
  v_force_rarity text := null;
  v_use_featured boolean := false;
begin
  select * into v_evt from public.forge_events where id = p_event_id;
  if v_evt is null then return query select null::text, null::text, null::text, null::text, null::boolean, 'event_not_found'::text; return; end if;
  if now() < v_evt.starts_at or now() > v_evt.ends_at then
    return query select null::text, null::text, null::text, null::text, null::boolean, 'event_inactive'::text; return;
  end if;

  insert into public.user_forge_pulls (user_id, event_id) values (p_user_id, p_event_id) on conflict do nothing;
  select * into v_state from public.user_forge_pulls where user_id = p_user_id and event_id = p_event_id;

  v_pity_e := v_state.pity_epic_counter + 1;
  v_pity_l := v_state.pity_legendary_counter + 1;

  -- Pity Legendary triggert höchste Prio
  if v_pity_l >= v_evt.pity_legendary then
    v_force_rarity := 'legendary';
    v_pity_l := 0;
    -- jeder 3. Legendary = featured (CoD-Style)
    if (v_state.featured_pulls + 1) * 3 <= ((v_state.pulls_used + 1) / v_evt.pity_legendary) + 1 then
      v_use_featured := true;
    end if;
  elsif v_pity_e >= v_evt.pity_epic then
    v_force_rarity := 'epic';
    v_pity_e := 0;
  end if;

  -- Pool filtern
  if v_use_featured and jsonb_array_length(v_evt.featured_artifacts) > 0 then
    v_pool := v_evt.featured_artifacts;
  elsif v_force_rarity is not null then
    select coalesce(jsonb_agg(p), '[]'::jsonb) into v_filtered
      from jsonb_array_elements(v_evt.artifact_pool) p where p->>'rarity' = v_force_rarity;
    if jsonb_array_length(v_filtered) = 0 then v_pool := v_evt.artifact_pool;
    else v_pool := v_filtered; end if;
  else
    v_pool := v_evt.artifact_pool;
  end if;

  -- Gewichteter Zufall
  select sum(coalesce((p->>'weight')::numeric, 1)) into v_total from jsonb_array_elements(v_pool) p;
  v_roll := random() * v_total;
  for v_chosen in select value from jsonb_array_elements(v_pool) loop
    v_acc := v_acc + coalesce((v_chosen->>'weight')::numeric, 1);
    if v_roll <= v_acc then exit; end if;
  end loop;

  -- Pity-Counter resetten wenn passende Rarity natürlich gezogen
  if (v_chosen->>'rarity') = 'legendary' then v_pity_l := 0; end if;
  if (v_chosen->>'rarity') in ('legendary', 'epic') then v_pity_e := 0; end if;

  artifact_id   := v_chosen->>'id';
  artifact_name := v_chosen->>'name';
  emoji         := v_chosen->>'emoji';
  rarity        := v_chosen->>'rarity';
  is_featured   := v_use_featured;
  error         := null;

  insert into public.user_forge_history (user_id, event_id, artifact_id, artifact_name, rarity, is_featured)
    values (p_user_id, p_event_id, artifact_id, artifact_name, rarity, is_featured);

  update public.user_forge_pulls
    set pulls_used = pulls_used + 1,
        pity_epic_counter = v_pity_e,
        pity_legendary_counter = v_pity_l,
        featured_pulls = featured_pulls + (case when is_featured then 1 else 0 end)
    where user_id = p_user_id and event_id = p_event_id;

  return next;
end $$;

grant execute on function public.pull_forge_artifact(uuid, text) to authenticated, service_role;

-- ─── 3) Seed: 1 Lucky Wheel + 1 Forge Event (neutral, international) ───
insert into public.lucky_wheel_events (id, name, starts_at, ends_at, spin_cost_gems, max_spins, prize_pool, guaranteed_pool, pity_threshold) values
  ('lucky_wheel_2026_01', 'Glücksrad: Daily Spin',
   now(), now() + interval '3 days',
   700, 200,
   '[
     {"weight": 30, "type": "gems",  "amount": 100,  "label": "100 💎"},
     {"weight": 25, "type": "coins", "amount": 500,  "label": "500 🪙"},
     {"weight": 15, "type": "item",  "catalog_id": "speedup_uni_15m", "count": 1, "label": "15 Min Speedup"},
     {"weight": 10, "type": "item",  "catalog_id": "speedup_uni_60m", "count": 1, "label": "1 Std Speedup"},
     {"weight":  8, "type": "gems",  "amount": 500,  "label": "500 💎"},
     {"weight":  5, "type": "item",  "catalog_id": "chest_silver",    "count": 1, "label": "Silber-Truhe"},
     {"weight":  4, "type": "item",  "catalog_id": "boost_xp_8h",     "count": 1, "label": "XP-Boost 8h"},
     {"weight":  2, "type": "item",  "catalog_id": "chest_gold",      "count": 1, "label": "Gold-Truhe"},
     {"weight":  1, "type": "gems",  "amount": 2000, "label": "2.000 💎"}
   ]'::jsonb,
   '[
     {"weight": 50, "type": "item", "catalog_id": "chest_gold",      "count": 1, "label": "Gold-Truhe"},
     {"weight": 30, "type": "item", "catalog_id": "boost_xp_24h",    "count": 1, "label": "XP-Boost 24h"},
     {"weight": 15, "type": "item", "catalog_id": "chest_legendary", "count": 1, "label": "Legendäre Truhe"},
     {"weight":  5, "type": "gems", "amount": 5000, "label": "5.000 💎"}
   ]'::jsonb,
   10)
on conflict (id) do nothing;

insert into public.forge_events (id, name, starts_at, ends_at, pull_cost_gems, featured_artifacts, pity_epic, pity_legendary, artifact_pool) values
  ('forge_2026_01', 'Schmiede des Lichts: Erste Saison',
   now(), now() + interval '14 days',
   600,
   '[
     {"id": "artifact_breath_of_dawn", "name": "Atem der Dämmerung", "emoji": "🌿", "rarity": "legendary"},
     {"id": "artifact_kingslayer",     "name": "Königsmörder",        "emoji": "🗡", "rarity": "legendary"}
   ]'::jsonb,
   10, 30,
   '[
     {"weight": 50, "id": "artifact_compass",        "name": "Wanderer-Kompass",     "emoji": "🧭", "rarity": "common"},
     {"weight": 40, "id": "artifact_clock",          "name": "Schritt-Chronometer",   "emoji": "⌚", "rarity": "common"},
     {"weight": 25, "id": "artifact_pass",           "name": "Stadt-Pass",            "emoji": "🎫", "rarity": "rare"},
     {"weight": 20, "id": "artifact_relic_food",     "name": "Heiliger Proviant",     "emoji": "🌭", "rarity": "rare"},
     {"weight": 15, "id": "artifact_brake",          "name": "Schnell-Brake",         "emoji": "🚲", "rarity": "rare"},
     {"weight":  8, "id": "artifact_phoenix_eye",    "name": "Phönix-Auge",           "emoji": "🦅", "rarity": "epic"},
     {"weight":  6, "id": "artifact_shadow_orb",     "name": "Schatten-Orb",          "emoji": "🔮", "rarity": "epic"},
     {"weight":  4, "id": "artifact_breath_of_dawn", "name": "Atem der Dämmerung",    "emoji": "🌿", "rarity": "legendary"},
     {"weight":  3, "id": "artifact_kingslayer",     "name": "Königsmörder",           "emoji": "🗡", "rarity": "legendary"},
     {"weight":  2, "id": "artifact_infernal_flame", "name": "Infernale Flamme",      "emoji": "🔥", "rarity": "legendary"}
   ]'::jsonb)
on conflict (id) do nothing;
