-- ══════════════════════════════════════════════════════════════════════════
-- BASE-SYSTEM PHASE 2: Crew-Base + Truhen + Area-Bosse
-- ══════════════════════════════════════════════════════════════════════════
-- - Crew-Base: 1 pro Crew, anchor an PLZ-Cluster (≥3 Mitglieder mit gleichem PLZ-Bezirk)
-- - Truhen: Silber + Gold, 24h Öffnungszeit, droppen Wächter/Items/Resourcen
-- - Area-Bosse: spawn an Map-Punkten, Crew-Mitglieder können kollaborativ angreifen
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) crew_bases (1 pro Crew) ──────────────────────────────────────────
create table if not exists public.crew_bases (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null unique references public.crews(id) on delete cascade,
  plz_cluster text not null,            -- z.B. "10" für Berlin-Mitte (PLZ 10xxx)
  level       int  not null default 1 check (level between 1 and 30),
  exp         int  not null default 0,
  layout_json jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_crew_bases_crew on public.crew_bases(crew_id);

alter table public.crew_bases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_bases' and policyname='select_member') then
    create policy select_member on public.crew_bases for select using (
      exists (select 1 from public.crew_members cm where cm.crew_id = crew_id and cm.user_id = auth.uid())
    );
  end if;
end $$;

-- ─── 2) crew_base_buildings (Mirror von base_buildings für Crews) ────────
create table if not exists public.crew_base_buildings (
  id              uuid primary key default gen_random_uuid(),
  crew_base_id    uuid not null references public.crew_bases(id) on delete cascade,
  building_id     text not null references public.buildings_catalog(id) on delete cascade,
  position_x      int  not null default 0,
  position_y      int  not null default 0,
  level           int  not null default 1 check (level between 1 and 15),
  last_collected_at timestamptz,
  status          text not null default 'idle' check (status in ('idle','building','upgrading')),
  contributed_by  uuid references public.users(id),  -- wer hat es initiiert
  created_at      timestamptz not null default now(),
  unique (crew_base_id, building_id)
);
create index if not exists idx_crew_buildings_base on public.crew_base_buildings(crew_base_id);

-- ─── 3) crew_resources — gemeinsamer Pool ────────────────────────────────
create table if not exists public.crew_resources (
  crew_id     uuid primary key references public.crews(id) on delete cascade,
  wood        int not null default 0 check (wood >= 0),
  stone       int not null default 0 check (stone >= 0),
  gold        int not null default 0 check (gold >= 0),
  mana        int not null default 0 check (mana >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.crew_resources enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_resources' and policyname='select_member') then
    create policy select_member on public.crew_resources for select using (
      exists (select 1 from public.crew_members cm where cm.crew_id = crew_id and cm.user_id = auth.uid())
    );
  end if;
end $$;

-- ─── 4) crew_building_queue ──────────────────────────────────────────────
create table if not exists public.crew_building_queue (
  id              uuid primary key default gen_random_uuid(),
  crew_base_id    uuid not null references public.crew_bases(id) on delete cascade,
  building_id     text not null references public.buildings_catalog(id) on delete cascade,
  action          text not null check (action in ('build','upgrade')),
  target_level    int  not null,
  started_at      timestamptz not null default now(),
  ends_at         timestamptz not null,
  finished        boolean not null default false,
  initiated_by    uuid references public.users(id),
  cost_wood       int  not null default 0,
  cost_stone      int  not null default 0,
  cost_gold       int  not null default 0,
  cost_mana       int  not null default 0
);

-- ─── 5) treasure_chests — Silber/Gold Truhen ─────────────────────────────
create table if not exists public.treasure_chests (
  id          uuid primary key default gen_random_uuid(),
  -- entweder owner_user_id (Solo-Truhe) oder crew_id (Crew-Truhe), nicht beide
  owner_user_id uuid references public.users(id) on delete cascade,
  crew_id       uuid references public.crews(id) on delete cascade,
  kind        text not null check (kind in ('silver','gold','event')),
  source      text not null check (source in ('walk','vip','event','chest_drop','arena','quest','purchased')),
  -- Öffnungs-Mechanik: chests müssen X Stunden lagern bevor sie geöffnet werden können
  obtained_at timestamptz not null default now(),
  opens_at    timestamptz not null,           -- Silber 4h / Gold 24h
  opened_at   timestamptz,
  -- Inhalts-Pull beim Öffnen, gespeichert in payload
  payload     jsonb,
  check ((owner_user_id is not null) <> (crew_id is not null))
);
create index if not exists idx_chests_user on public.treasure_chests(owner_user_id) where owner_user_id is not null;
create index if not exists idx_chests_crew on public.treasure_chests(crew_id) where crew_id is not null;
create index if not exists idx_chests_open on public.treasure_chests(opens_at) where opened_at is null;

alter table public.treasure_chests enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='treasure_chests' and policyname='select_own') then
    create policy select_own on public.treasure_chests for select using (
      auth.uid() = owner_user_id or
      exists (select 1 from public.crew_members cm where cm.crew_id = crew_id and cm.user_id = auth.uid())
    );
  end if;
end $$;

-- ─── 6) chest_pity_progress (Pity-Garantie alle 10 Truhen) ───────────────
-- Jede 10. Gold-Truhe garantiert epic+, jede 30. legendary
create table if not exists public.chest_pity (
  user_id           uuid primary key references public.users(id) on delete cascade,
  silver_opened     int not null default 0,
  gold_opened       int not null default 0,
  pity_epic_counter int not null default 0,   -- reset bei epic+ drop
  pity_leg_counter  int not null default 0    -- reset bei legendary drop
);

-- ─── 7) area_bosses (Map-Spawns, Crew-Angriff) ───────────────────────────
create table if not exists public.area_bosses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text not null,
  lat         numeric(10,7) not null,
  lng         numeric(10,7) not null,
  max_hp      bigint not null,
  current_hp  bigint not null,
  status      text not null default 'active' check (status in ('active','defeated','expired')),
  spawned_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  reward_loot_rarity text not null default 'epic' check (reward_loot_rarity in ('rare','epic','legend')),
  reward_pool_gold int not null default 0,
  reward_pool_mana int not null default 0
);
create index if not exists idx_bosses_active on public.area_bosses(status, expires_at) where status = 'active';

alter table public.area_bosses enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='area_bosses' and policyname='select_all') then
    create policy select_all on public.area_bosses for select using (true);
  end if;
end $$;

-- ─── 8) area_boss_attacks ────────────────────────────────────────────────
create table if not exists public.area_boss_attacks (
  id          uuid primary key default gen_random_uuid(),
  boss_id     uuid not null references public.area_bosses(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  crew_id     uuid references public.crews(id),
  damage      int  not null default 0,
  attacked_at timestamptz not null default now()
);
create index if not exists idx_attacks_boss on public.area_boss_attacks(boss_id, damage desc);
create index if not exists idx_attacks_user on public.area_boss_attacks(user_id);

-- ─── 9) RPC: get_or_create_crew_base() ───────────────────────────────────
create or replace function public.get_or_create_crew_base(p_crew_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_is_member boolean;
  v_base uuid;
  v_plz_cluster text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select exists(select 1 from public.crew_members where crew_id = p_crew_id and user_id = v_user) into v_is_member;
  if not v_is_member then return null; end if;

  select id into v_base from public.crew_bases where crew_id = p_crew_id;
  if v_base is not null then return v_base; end if;

  -- PLZ-Cluster: 2-stelliges Prefix der häufigsten heimat_plz aller Crew-Member
  select substr(u.heimat_plz, 1, 2) into v_plz_cluster
    from public.crew_members cm
    join public.users u on u.id = cm.user_id
   where cm.crew_id = p_crew_id and u.heimat_plz is not null
   group by substr(u.heimat_plz, 1, 2)
   order by count(*) desc
   limit 1;
  if v_plz_cluster is null then v_plz_cluster := '00'; end if;

  insert into public.crew_bases (crew_id, plz_cluster) values (p_crew_id, v_plz_cluster) returning id into v_base;
  insert into public.crew_resources (crew_id) values (p_crew_id) on conflict do nothing;
  return v_base;
end $$;

revoke all on function public.get_or_create_crew_base(uuid) from public;
grant execute on function public.get_or_create_crew_base(uuid) to authenticated;

-- ─── 10) RPC: open_chest() — öffnet Truhe wenn opens_at erreicht ─────────
-- Drop-Pool je Kind (kann später ausgebaut werden)
create or replace function public.open_chest(p_chest_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_chest record;
  v_payload jsonb;
  v_pity record;
  v_rarity text;
  v_xp int;
  v_gold int := 0; v_mana int := 0; v_wood int := 0; v_stone int := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_chest from public.treasure_chests where id = p_chest_id for update;
  if v_chest is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_chest.opened_at is not null then return jsonb_build_object('ok', false, 'error', 'already_opened'); end if;
  if v_chest.opens_at > now() then
    return jsonb_build_object('ok', false, 'error', 'not_ready', 'opens_at', v_chest.opens_at);
  end if;
  if v_chest.owner_user_id is not null and v_chest.owner_user_id <> v_user then
    return jsonb_build_object('ok', false, 'error', 'not_yours');
  end if;
  if v_chest.crew_id is not null and not exists (
    select 1 from public.crew_members where crew_id = v_chest.crew_id and user_id = v_user
  ) then return jsonb_build_object('ok', false, 'error', 'not_crew_member'); end if;

  -- Pity-Counter laden
  insert into public.chest_pity (user_id) values (v_user) on conflict do nothing;
  select * into v_pity from public.chest_pity where user_id = v_user for update;

  -- Rarität bestimmen (mit Pity-Garantie)
  if v_chest.kind = 'gold' then
    if v_pity.pity_leg_counter >= 29 then v_rarity := 'legend';
    elsif v_pity.pity_epic_counter >= 9 or random() < 0.10 then v_rarity := 'epic';
    elsif random() < 0.30 then v_rarity := 'rare';
    else v_rarity := 'common'; end if;
  else  -- silver / event
    if random() < 0.05 then v_rarity := 'epic';
    elsif random() < 0.25 then v_rarity := 'rare';
    else v_rarity := 'common'; end if;
  end if;

  -- Pity-Counter updaten
  update public.chest_pity set
    silver_opened     = silver_opened + (case when v_chest.kind = 'silver' then 1 else 0 end),
    gold_opened       = gold_opened   + (case when v_chest.kind = 'gold'   then 1 else 0 end),
    pity_epic_counter = case when v_rarity in ('epic','legend') then 0 else pity_epic_counter + 1 end,
    pity_leg_counter  = case when v_rarity = 'legend' then 0 else pity_leg_counter + 1 end
  where user_id = v_user;

  -- Inhalt: Resourcen + ggf. XP-Item
  v_xp    := case v_rarity when 'common' then 100 when 'rare' then 300 when 'epic' then 800 else 2500 end;
  v_gold  := case v_rarity when 'common' then 50  when 'rare' then 150 when 'epic' then 500 else 1500 end;
  v_mana  := case v_rarity when 'common' then 20  when 'rare' then 80  when 'epic' then 250 else 800  end;
  v_wood  := case v_rarity when 'common' then 100 when 'rare' then 300 when 'epic' then 800 else 2000 end;
  v_stone := case v_rarity when 'common' then 100 when 'rare' then 300 when 'epic' then 800 else 2000 end;

  -- Resourcen gutschreiben (Solo: User · Crew: Crew-Pool)
  if v_chest.owner_user_id is not null then
    insert into public.user_resources (user_id, wood, stone, gold, mana)
    values (v_user, v_wood, v_stone, v_gold, v_mana)
    on conflict (user_id) do update set
      wood = public.user_resources.wood + excluded.wood,
      stone = public.user_resources.stone + excluded.stone,
      gold = public.user_resources.gold + excluded.gold,
      mana = public.user_resources.mana + excluded.mana,
      updated_at = now();
  else
    insert into public.crew_resources (crew_id, wood, stone, gold, mana)
    values (v_chest.crew_id, v_wood, v_stone, v_gold, v_mana)
    on conflict (crew_id) do update set
      wood = public.crew_resources.wood + excluded.wood,
      stone = public.crew_resources.stone + excluded.stone,
      gold = public.crew_resources.gold + excluded.gold,
      mana = public.crew_resources.mana + excluded.mana,
      updated_at = now();
  end if;

  -- Optional: Wächter-XP-Item-Drop (epic+ → 500 XP, legend → 1000 XP)
  if v_rarity in ('epic','legend') then
    insert into public.user_guardian_xp_items (user_id, item_id, count)
    values (v_user, case when v_rarity = 'legend' then 'xp_pot_l' else 'xp_pot_m' end, 1)
    on conflict (user_id, item_id) do update set count = public.user_guardian_xp_items.count + 1;
  end if;

  v_payload := jsonb_build_object(
    'rarity', v_rarity, 'wood', v_wood, 'stone', v_stone,
    'gold', v_gold, 'mana', v_mana, 'xp', v_xp,
    'pity_epic', v_pity.pity_epic_counter, 'pity_leg', v_pity.pity_leg_counter
  );

  update public.treasure_chests set opened_at = now(), payload = v_payload where id = p_chest_id;
  return jsonb_build_object('ok', true, 'payload', v_payload);
end $$;

revoke all on function public.open_chest(uuid) from public;
grant execute on function public.open_chest(uuid) to authenticated;

-- ─── 11) RPC: attack_area_boss() — Crew-Schaden auf Boss ─────────────────
create or replace function public.attack_area_boss(p_boss_id uuid, p_damage int)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_boss record;
  v_crew uuid;
  v_actual_dmg int;
  v_remaining bigint;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_damage < 1 or p_damage > 100000 then return jsonb_build_object('ok', false, 'error', 'bad_damage'); end if;

  select * into v_boss from public.area_bosses where id = p_boss_id for update;
  if v_boss is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_boss.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'boss_not_active'); end if;
  if v_boss.expires_at < now() then
    update public.area_bosses set status = 'expired' where id = p_boss_id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  v_actual_dmg := least(p_damage, v_boss.current_hp)::int;
  select crew_id into v_crew from public.crew_members where user_id = v_user limit 1;

  insert into public.area_boss_attacks (boss_id, user_id, crew_id, damage)
  values (p_boss_id, v_user, v_crew, v_actual_dmg);

  v_remaining := v_boss.current_hp - v_actual_dmg;
  if v_remaining <= 0 then
    update public.area_bosses set current_hp = 0, status = 'defeated' where id = p_boss_id;
  else
    update public.area_bosses set current_hp = v_remaining where id = p_boss_id;
  end if;

  return jsonb_build_object('ok', true, 'damage', v_actual_dmg, 'remaining_hp', v_remaining);
end $$;

revoke all on function public.attack_area_boss(uuid, int) from public;
grant execute on function public.attack_area_boss(uuid, int) to authenticated;
