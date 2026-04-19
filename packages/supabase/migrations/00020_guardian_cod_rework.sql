-- =========================================================
-- Migration 00020: Wächter-System CoD/RoK-Umbau
-- -------------------------------------------------------
-- • Neue Rarität: elite / epic / legendary (common/rare/legend entfernt)
-- • Neue Typen: infantry / cavalry / marksman / mage
-- • Level-Cap 30 → 60
-- • Talentbaum: 1 Punkt pro Level, 3 Äste pro Archetyp
-- • 5 Skills pro Archetyp, je 5 Stufen (Expertise ab Level 5 aller)
-- • Siegel-Inventar (Upgrade-Material, 4 typ-spez. + 1 universal)
-- • Edelsteine (Premium-Währung, keine Power-Items)
-- =========================================================

-- 1) Rarity-Constraint lockern + Typ-Spalte
alter table public.guardian_archetypes
  drop constraint if exists guardian_archetypes_rarity_check;
alter table public.guardian_archetypes
  add constraint guardian_archetypes_rarity_check
  check (rarity in ('elite','epic','legendary','common','rare','legend'));

alter table public.guardian_archetypes
  add column if not exists guardian_type text
  check (guardian_type in ('infantry','cavalry','marksman','mage'));

alter table public.guardian_archetypes
  add column if not exists role text
  check (role in ('dps','tank','support','balanced'));

-- 2) crew_guardians: Level-Cap 60, Talentpunkte, Expertise-Flag
alter table public.crew_guardians
  drop constraint if exists crew_guardians_level_check;
alter table public.crew_guardians
  add constraint crew_guardians_level_check
  check (level >= 1 and level <= 60);

alter table public.crew_guardians
  add column if not exists talent_points_available int not null default 0,
  add column if not exists talent_points_spent int not null default 0,
  add column if not exists active_loadout_id uuid,
  add column if not exists last_respec_at timestamptz;

-- 3) Talentbaum-Definition (pro Archetyp, 3 Äste × N Nodes)
create table if not exists public.talent_nodes (
  id text primary key,                       -- z.B. "erzmagier.fire.1"
  archetype_id text not null references public.guardian_archetypes(id) on delete cascade,
  branch text not null check (branch in ('primary','secondary','utility')),
  tier int not null check (tier between 1 and 10),
  slot int not null check (slot between 0 and 3),
  name text not null,
  description text not null,
  max_rank int not null default 5,
  effect_key text not null,                  -- "hp_pct", "atk_pct", "crit_chance", "first_strike_dmg", ...
  effect_per_rank numeric not null,          -- z.B. 0.03 für +3% pro Rang
  requires_node_id text references public.talent_nodes(id) on delete set null,
  unique (archetype_id, branch, tier, slot)
);
create index if not exists idx_talent_nodes_archetype on public.talent_nodes(archetype_id);

-- 4) Spieler-spezifische Talent-Allokation
create table if not exists public.guardian_talents (
  guardian_id uuid not null references public.crew_guardians(id) on delete cascade,
  node_id text not null references public.talent_nodes(id) on delete cascade,
  rank int not null default 0 check (rank >= 0 and rank <= 5),
  updated_at timestamptz not null default now(),
  primary key (guardian_id, node_id)
);
create index if not exists idx_guardian_talents_guardian on public.guardian_talents(guardian_id);

-- 5) Fähigkeiten: 5 Skills × 5 Stufen pro Archetyp
create table if not exists public.archetype_skills (
  id text primary key,                       -- z.B. "erzmagier.active"
  archetype_id text not null references public.guardian_archetypes(id) on delete cascade,
  skill_slot text not null check (skill_slot in ('active','passive','combat','role','expertise')),
  name text not null,
  description text not null,
  effect_key text not null,
  base_value numeric not null default 0,
  per_level_value numeric not null default 0,
  rage_cost int not null default 0,          -- nur für "active"
  unique (archetype_id, skill_slot)
);
create index if not exists idx_archetype_skills_archetype on public.archetype_skills(archetype_id);

-- 6) Spieler-Skill-Stufen (0-5 je Skill)
create table if not exists public.guardian_skill_levels (
  guardian_id uuid not null references public.crew_guardians(id) on delete cascade,
  skill_id text not null references public.archetype_skills(id) on delete cascade,
  level int not null default 0 check (level >= 0 and level <= 5),
  updated_at timestamptz not null default now(),
  primary key (guardian_id, skill_id)
);

-- 7) Siegel-Inventar (User-Level, typ-spezifisch)
create table if not exists public.user_siegel (
  user_id uuid primary key references public.users(id) on delete cascade,
  siegel_infantry int not null default 0,
  siegel_cavalry int not null default 0,
  siegel_marksman int not null default 0,
  siegel_mage int not null default 0,
  siegel_universal int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_siegel enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_siegel' and policyname='select_own') then
    create policy select_own on public.user_siegel for select using (auth.uid() = user_id);
  end if;
end $$;

-- 8) Edelsteine (Premium-Währung) + Arena-Pass
create table if not exists public.user_gems (
  user_id uuid primary key references public.users(id) on delete cascade,
  gems int not null default 0,
  arena_pass_expires_at timestamptz,
  total_purchased int not null default 0,
  total_spent int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_gems enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_gems' and policyname='select_own') then
    create policy select_own on public.user_gems for select using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.gem_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta int not null,                         -- positiv = Zugang, negativ = Ausgabe
  reason text not null,                       -- "purchase", "daily_login", "shop_item", "arena_pass", ...
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_gem_tx_user on public.gem_transactions(user_id, created_at desc);

-- 9) Shop-Katalog (nur Cosmetics / Convenience / Arena-Pass — NIEMALS Power)
create table if not exists public.gem_shop_items (
  id text primary key,
  category text not null check (category in ('cosmetic','booster','convenience','arena_pass','crew_emblem')),
  name text not null,
  description text not null,
  icon text not null default '✨',
  price_gems int not null,
  duration_hours int,                         -- null = permanent; z.B. 24 für XP-Boost 24h
  payload jsonb not null default '{}',        -- z.B. {"skin_id":"paladin_gold","xp_multiplier":2}
  active boolean not null default true,
  sort int not null default 0
);

alter table public.gem_shop_items enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='gem_shop_items' and policyname='select_all') then
    create policy select_all on public.gem_shop_items for select using (active);
  end if;
end $$;

create table if not exists public.user_shop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  shop_item_id text not null references public.gem_shop_items(id),
  price_paid_gems int not null,
  expires_at timestamptz,                     -- null = permanent
  created_at timestamptz not null default now()
);

alter table public.user_shop_purchases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_shop_purchases' and policyname='select_own') then
    create policy select_own on public.user_shop_purchases for select using (auth.uid() = user_id);
  end if;
end $$;

-- 10) Aktive Boosts (berechnet aus Käufen + aktivierten Items)
create or replace view public.active_boosts as
  select p.user_id,
         sum(case when i.payload->>'xp_multiplier' is not null and (p.expires_at is null or p.expires_at > now())
                  then (i.payload->>'xp_multiplier')::numeric else 1 end) as xp_multiplier_sum,
         bool_or(i.category = 'arena_pass' and (p.expires_at is null or p.expires_at > now())) as arena_pass_active
  from public.user_shop_purchases p
  join public.gem_shop_items i on i.id = p.shop_item_id
  group by p.user_id;
grant select on public.active_boosts to authenticated;

-- 11) RPC: Talentpunkt ausgeben
create or replace function public.spend_talent_point(p_guardian_id uuid, p_node_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid;
  v_available int;
  v_current_rank int;
  v_max_rank int;
  v_archetype text;
  v_node_arche text;
  v_requires text;
  v_req_rank int;
begin
  select g.user_id, g.talent_points_available, g.archetype_id
    into v_user, v_available, v_archetype
  from public.crew_guardians g where g.id = p_guardian_id;

  if v_user is null then return jsonb_build_object('ok',false,'error','guardian_not_found'); end if;
  if v_user <> auth.uid() then return jsonb_build_object('ok',false,'error','not_yours'); end if;
  if v_available < 1 then return jsonb_build_object('ok',false,'error','no_points'); end if;

  select archetype_id, max_rank, requires_node_id into v_node_arche, v_max_rank, v_requires
  from public.talent_nodes where id = p_node_id;

  if v_node_arche is null then return jsonb_build_object('ok',false,'error','node_not_found'); end if;
  if v_node_arche <> v_archetype then return jsonb_build_object('ok',false,'error','wrong_archetype'); end if;

  -- Prereq: benötigter Node muss mindestens Rank 1 haben
  if v_requires is not null then
    select rank into v_req_rank from public.guardian_talents
      where guardian_id = p_guardian_id and node_id = v_requires;
    if coalesce(v_req_rank, 0) < 1 then
      return jsonb_build_object('ok',false,'error','prereq_missing','requires', v_requires);
    end if;
  end if;

  select rank into v_current_rank from public.guardian_talents
    where guardian_id = p_guardian_id and node_id = p_node_id;
  v_current_rank := coalesce(v_current_rank, 0);
  if v_current_rank >= v_max_rank then
    return jsonb_build_object('ok',false,'error','max_rank');
  end if;

  insert into public.guardian_talents (guardian_id, node_id, rank)
    values (p_guardian_id, p_node_id, 1)
    on conflict (guardian_id, node_id) do update set rank = public.guardian_talents.rank + 1, updated_at = now();

  update public.crew_guardians
    set talent_points_available = talent_points_available - 1,
        talent_points_spent = talent_points_spent + 1
    where id = p_guardian_id;

  return jsonb_build_object('ok',true,'new_rank', v_current_rank + 1);
end $$;

-- 12) RPC: Talentbaum resetten (kostet Universal-Siegel oder 7-Tage-Cooldown frei)
create or replace function public.respec_talents(p_guardian_id uuid, p_force boolean default false)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid;
  v_spent int;
  v_last_respec timestamptz;
  v_free boolean;
  v_siegel int;
  v_cost int;
begin
  select user_id, talent_points_spent, last_respec_at
    into v_user, v_spent, v_last_respec
  from public.crew_guardians where id = p_guardian_id;

  if v_user is null then return jsonb_build_object('ok',false,'error','guardian_not_found'); end if;
  if v_user <> auth.uid() then return jsonb_build_object('ok',false,'error','not_yours'); end if;

  v_free := (v_last_respec is null or v_last_respec < now() - interval '7 days');
  v_cost := case when v_free then 0 else greatest(1, v_spent / 10) end;

  if not v_free then
    if not p_force then
      return jsonb_build_object('ok',false,'error','requires_confirm','cost_universal', v_cost);
    end if;
    select siegel_universal into v_siegel from public.user_siegel where user_id = v_user;
    if coalesce(v_siegel, 0) < v_cost then
      return jsonb_build_object('ok',false,'error','not_enough_siegel','needed', v_cost);
    end if;
    update public.user_siegel
      set siegel_universal = siegel_universal - v_cost, updated_at = now()
      where user_id = v_user;
  end if;

  delete from public.guardian_talents where guardian_id = p_guardian_id;
  update public.crew_guardians
    set talent_points_available = talent_points_available + talent_points_spent,
        talent_points_spent = 0,
        last_respec_at = now()
    where id = p_guardian_id;

  return jsonb_build_object('ok',true,'free', v_free,'cost_universal', v_cost);
end $$;

-- 13) RPC: Skill-Stufe kaufen (kostet typ-spezifische Siegel)
create or replace function public.upgrade_skill(p_guardian_id uuid, p_skill_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid;
  v_type text;
  v_slot text;
  v_current int;
  v_cost int;
  v_have int;
  v_all_maxed int;
begin
  select cg.user_id, a.guardian_type
    into v_user, v_type
  from public.crew_guardians cg
  join public.guardian_archetypes a on a.id = cg.archetype_id
  where cg.id = p_guardian_id;

  if v_user is null then return jsonb_build_object('ok',false,'error','guardian_not_found'); end if;
  if v_user <> auth.uid() then return jsonb_build_object('ok',false,'error','not_yours'); end if;

  select skill_slot into v_slot from public.archetype_skills where id = p_skill_id;
  if v_slot is null then return jsonb_build_object('ok',false,'error','skill_not_found'); end if;

  select level into v_current from public.guardian_skill_levels
    where guardian_id = p_guardian_id and skill_id = p_skill_id;
  v_current := coalesce(v_current, 0);
  if v_current >= 5 then return jsonb_build_object('ok',false,'error','max_level'); end if;

  -- Expertise ist erst freischaltbar, wenn die anderen 4 Skills alle auf Level 5 sind
  if v_slot = 'expertise' then
    select count(*) into v_all_maxed
    from public.guardian_skill_levels gsl
    join public.archetype_skills s on s.id = gsl.skill_id
    where gsl.guardian_id = p_guardian_id
      and s.skill_slot <> 'expertise'
      and gsl.level = 5;
    if v_all_maxed < 4 then
      return jsonb_build_object('ok',false,'error','expertise_locked');
    end if;
  end if;

  -- Kosten: Stufe 1=5, 2=10, 3=20, 4=40, 5=80 (Expertise kostet doppelt)
  v_cost := case v_current
    when 0 then 5  when 1 then 10  when 2 then 20  when 3 then 40  when 4 then 80
    else 999999 end;
  if v_slot = 'expertise' then v_cost := v_cost * 2; end if;

  -- Siegel abziehen
  execute format(
    'select siegel_%s from public.user_siegel where user_id = $1',
    case v_type when 'infantry' then 'infantry' when 'cavalry' then 'cavalry'
                 when 'marksman' then 'marksman' when 'mage' then 'mage'
                 else 'universal' end
  ) into v_have using v_user;
  v_have := coalesce(v_have, 0);
  if v_have < v_cost then
    return jsonb_build_object('ok',false,'error','not_enough_siegel','needed', v_cost, 'type', v_type);
  end if;
  execute format(
    'update public.user_siegel set siegel_%1$s = siegel_%1$s - $1, updated_at = now() where user_id = $2',
    case v_type when 'infantry' then 'infantry' when 'cavalry' then 'cavalry'
                 when 'marksman' then 'marksman' when 'mage' then 'mage'
                 else 'universal' end
  ) using v_cost, v_user;

  insert into public.guardian_skill_levels (guardian_id, skill_id, level)
    values (p_guardian_id, p_skill_id, 1)
    on conflict (guardian_id, skill_id) do update set level = public.guardian_skill_levels.level + 1, updated_at = now();

  return jsonb_build_object('ok',true,'new_level', v_current + 1,'cost', v_cost,'siegel_type', v_type);
end $$;

-- 14) RPC: XP/Level-Up verarbeiten, Talentpunkte gutschreiben
-- XP-Kurve: level N benötigt round(100 * N^1.6) XP für das nächste Level
create or replace function public.apply_guardian_xp(p_guardian_id uuid, p_xp int)
returns jsonb language plpgsql security definer as $$
declare
  v_cur_level int;
  v_cur_xp bigint;
  v_need int;
  v_levels_gained int := 0;
begin
  select level, xp into v_cur_level, v_cur_xp
  from public.crew_guardians where id = p_guardian_id for update;
  if v_cur_level is null then return jsonb_build_object('ok',false,'error','not_found'); end if;

  v_cur_xp := v_cur_xp + p_xp;
  while v_cur_level < 60 loop
    v_need := round(100 * power(v_cur_level, 1.6));
    exit when v_cur_xp < v_need;
    v_cur_xp := v_cur_xp - v_need;
    v_cur_level := v_cur_level + 1;
    v_levels_gained := v_levels_gained + 1;
  end loop;

  update public.crew_guardians
    set level = v_cur_level,
        xp = v_cur_xp,
        talent_points_available = talent_points_available + v_levels_gained
  where id = p_guardian_id;

  return jsonb_build_object('ok',true,'level', v_cur_level,'xp', v_cur_xp,'levels_gained', v_levels_gained);
end $$;

-- 15) Migration bestehender Spieler: retro Talentpunkte (1 pro Level-1)
update public.crew_guardians
  set talent_points_available = greatest(0, level - 1)
where talent_points_available = 0 and talent_points_spent = 0;

-- 16) Loot-Drop: Siegel-Quelle aus Arena-Siegen
create table if not exists public.siegel_drops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  source text not null check (source in ('arena_win','areboss_loot','walking_milestone','daily_mission','qr_scan')),
  siegel_type text not null check (siegel_type in ('infantry','cavalry','marksman','mage','universal')),
  amount int not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_siegel_drops_user on public.siegel_drops(user_id, created_at desc);
alter table public.siegel_drops enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='siegel_drops' and policyname='select_own') then
    create policy select_own on public.siegel_drops for select using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.grant_siegel(p_user_id uuid, p_type text, p_amount int, p_source text, p_metadata jsonb default '{}')
returns jsonb language plpgsql security definer as $$
begin
  insert into public.user_siegel(user_id) values (p_user_id) on conflict do nothing;
  execute format(
    'update public.user_siegel set siegel_%1$s = siegel_%1$s + $1, updated_at = now() where user_id = $2',
    p_type
  ) using p_amount, p_user_id;
  insert into public.siegel_drops(user_id, source, siegel_type, amount, metadata)
    values (p_user_id, p_source, p_type, p_amount, p_metadata);
  return jsonb_build_object('ok', true);
end $$;

-- 17) Assign-Initial aktualisieren: nur noch elite/epic/legendary, Quoten 70/22/8
create or replace function public.assign_initial_guardian(p_crew_id uuid)
returns uuid language plpgsql security definer as $$
declare
  v_archetype text;
  v_guardian_id uuid;
  v_rarity text;
  v_roll float;
begin
  v_roll := random();
  v_rarity := case
    when v_roll < 0.70 then 'elite'
    when v_roll < 0.92 then 'epic'
    else 'legendary'
  end;

  select id into v_archetype from public.guardian_archetypes
    where rarity = v_rarity order by random() limit 1;

  if v_archetype is null then
    select id into v_archetype from public.guardian_archetypes order by random() limit 1;
  end if;

  insert into public.crew_guardians (crew_id, archetype_id, is_active, source, talent_points_available)
  values (p_crew_id, v_archetype, true, 'initial', 0)
  on conflict do nothing
  returning id into v_guardian_id;

  return v_guardian_id;
end $$;
