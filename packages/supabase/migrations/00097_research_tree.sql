-- ══════════════════════════════════════════════════════════════════════════
-- FORSCHUNGSBAUM (Resourcen + Truppen + Wirtschaft)
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) research_definitions ──────────────────────────────────────────────
create table if not exists public.research_definitions (
  id              text primary key,
  name            text not null,
  emoji           text not null,
  description     text not null,
  branch          text not null check (branch in ('economy','military','infrastructure','social')),
  tier            int not null default 1 check (tier between 1 and 5),
  prereq_id       text references public.research_definitions(id),
  max_level       int not null default 5 check (max_level between 1 and 25),
  base_cost_wood  int not null default 0,
  base_cost_stone int not null default 0,
  base_cost_gold  int not null default 0,
  base_cost_mana  int not null default 0,
  base_time_minutes  int not null default 5,
  buildtime_growth   numeric not null default 1.45,
  effect_key      text,
  effect_per_level numeric not null default 0,
  required_burg_level int not null default 1,
  sort            int not null default 0
);

-- ─── 2) user_research (Solo) — Crew-Forschung später ──────────────────────
create table if not exists public.user_research (
  user_id     uuid not null references public.users(id) on delete cascade,
  research_id text not null references public.research_definitions(id) on delete cascade,
  level       int not null default 0 check (level between 0 and 25),
  primary key (user_id, research_id)
);

alter table public.user_research enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_research' and policyname='select_own') then
    create policy select_own on public.user_research for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 3) research_queue ────────────────────────────────────────────────────
create table if not exists public.research_queue (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  research_id  text not null references public.research_definitions(id) on delete cascade,
  target_level int  not null,
  ends_at      timestamptz not null,
  finished     boolean not null default false
);
create index if not exists idx_research_queue_user on public.research_queue(user_id) where not finished;

alter table public.research_queue enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='research_queue' and policyname='select_own') then
    create policy select_own on public.research_queue for select using (auth.uid() = user_id);
  end if;
end $$;

-- ─── 4) Seed-Forschungen (12 starter — 4 Branches × ~3 Tier-1) ────────────
insert into public.research_definitions
  (id, name, emoji, description, branch, tier, prereq_id, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_time_minutes, buildtime_growth, effect_key, effect_per_level,
   required_burg_level, sort)
values
  -- ECONOMY
  ('eco_holzfaeller', 'Holzfäller-Methoden', '🪵', '+5% Holz pro Stufe.', 'economy', 1, null, 10,
    100, 80, 0, 0, 30, 1.45, 'wood_production_pct', 0.05, 1, 1),
  ('eco_steinbruch',  'Steinbruch-Effizienz', '🪨', '+5% Stein pro Stufe.', 'economy', 1, null, 10,
    80, 100, 0, 0, 30, 1.45, 'stone_production_pct', 0.05, 1, 2),
  ('eco_handel',      'Handelsrouten', '🪙', '+5% Gold pro Stufe.', 'economy', 2, 'eco_holzfaeller', 10,
    150, 100, 50, 0, 60, 1.50, 'gold_production_pct', 0.05, 3, 3),
  ('eco_lager',       'Lagerausbau', '📦', '+10% Lager-Cap pro Stufe.', 'economy', 2, 'eco_steinbruch', 10,
    100, 200, 30, 0, 60, 1.50, 'storage_cap_pct', 0.10, 3, 4),

  -- MILITARY
  ('mil_infanterie',  'Infanterie-Drill',  '🛡️', '+3% Infanterie-Atk pro Stufe.', 'military', 1, null, 10,
    100, 100, 30, 0, 45, 1.50, 'infantry_atk_pct', 0.03, 2, 10),
  ('mil_reiterei',    'Reiterei-Manöver',  '🐎', '+3% Kavallerie-Atk pro Stufe.', 'military', 1, null, 10,
    100, 100, 50, 0, 50, 1.50, 'cavalry_atk_pct', 0.03, 3, 11),
  ('mil_schiesskunst','Schießkunst',       '🏹', '+3% Schützen-Atk pro Stufe.',   'military', 1, null, 10,
    80, 120, 40, 0, 50, 1.50, 'marksman_atk_pct', 0.03, 4, 12),
  ('mil_tactical',    'Taktik-Lehre',      '🎯', '+5% Truppen-HP pro Stufe.',     'military', 2, 'mil_infanterie', 10,
    150, 150, 80, 0, 90, 1.55, 'troop_hp_pct', 0.05, 5, 13),

  -- INFRASTRUCTURE
  ('inf_baumeister',  'Baumeister-Schule', '🏗️', '−3% Bauzeit pro Stufe.',       'infrastructure', 1, null, 10,
    150, 150, 50, 0, 60, 1.50, 'build_time_pct', 0.03, 2, 20),
  ('inf_logistik',    'Logistik',          '🛻', '+5% Truppen-Trainingsspeed.',  'infrastructure', 1, null, 10,
    100, 150, 50, 0, 50, 1.50, 'training_speed_pct', 0.05, 3, 21),

  -- SOCIAL
  ('soc_diplomatie',  'Diplomatie',        '🤝', '+3% Crew-Bonus pro Stufe.',    'social', 1, null, 10,
    80, 80, 100, 0, 60, 1.50, 'crew_bonus_pct', 0.03, 3, 30),
  ('soc_inspiration', 'Inspiration',       '✨', '+3% Wächter-XP pro Stufe.',    'social', 1, null, 10,
    100, 100, 60, 30, 60, 1.50, 'guardian_xp_pct', 0.03, 4, 31)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  branch = excluded.branch, tier = excluded.tier, prereq_id = excluded.prereq_id,
  max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_time_minutes = excluded.base_time_minutes, buildtime_growth = excluded.buildtime_growth,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_burg_level = excluded.required_burg_level, sort = excluded.sort;

-- RLS auf Definitionen: alle dürfen lesen
alter table public.research_definitions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='research_definitions' and policyname='select_all') then
    create policy select_all on public.research_definitions for select using (true);
  end if;
end $$;
grant select on public.research_definitions to anon, authenticated;

-- ─── 5) RPC: start_research(research_id) ──────────────────────────────────
create or replace function public.start_research(p_research_id text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_def record;
  v_existing record;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_time_min int;
  v_resources record;
  v_extra_slots int := 0;
  v_active int;
  v_burg_level int;
  v_prereq record;
  v_speed numeric := 0;
  v_base_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_def from public.research_definitions where id = p_research_id;
  if v_def is null then return jsonb_build_object('ok', false, 'error', 'research_not_found'); end if;

  -- Prereq prüfen (Tier 2+ braucht Vorgänger)
  if v_def.prereq_id is not null then
    select * into v_prereq from public.user_research where user_id = v_user and research_id = v_def.prereq_id;
    if v_prereq is null or v_prereq.level < 1 then
      return jsonb_build_object('ok', false, 'error', 'prereq_missing', 'prereq_id', v_def.prereq_id);
    end if;
  end if;

  -- Burg-Level Gating
  select id into v_base_id from public.bases where owner_user_id = v_user;
  select coalesce(level, 0) into v_burg_level
    from public.base_buildings where base_id = v_base_id and building_id = 'burg';
  if v_burg_level < v_def.required_burg_level then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'required', v_def.required_burg_level);
  end if;

  insert into public.user_research (user_id, research_id, level)
  values (v_user, p_research_id, 0)
  on conflict (user_id, research_id) do nothing;
  select * into v_existing from public.user_research where user_id = v_user and research_id = p_research_id;

  if v_existing.level >= v_def.max_level then
    return jsonb_build_object('ok', false, 'error', 'max_level_reached');
  end if;
  v_target_level := v_existing.level + 1;
  v_cost_mult := power(1.55, v_existing.level);

  v_cost_w := round(v_def.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_def.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_def.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_def.base_cost_mana  * v_cost_mult);

  -- Slot-Check via VIP
  select coalesce(t.extra_research_slots, 0) into v_extra_slots
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  select count(*) into v_active from public.research_queue
   where user_id = v_user and not finished;
  if v_active >= (1 + coalesce(v_extra_slots, 0)) then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', 1 + v_extra_slots, 'active', v_active);
  end if;

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;
  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
  where user_id = v_user;

  -- Forschungszeit-Formel (analog zu Bauzeit)
  select coalesce(t.research_speed_pct, 0) into v_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_time_min := least(2880,
    greatest(1, round(v_def.base_time_minutes
                       * power(coalesce(v_def.buildtime_growth, 1.45), v_target_level - 1)
                       * (1 - coalesce(v_speed, 0)))));

  insert into public.research_queue (user_id, research_id, target_level, ends_at)
  values (v_user, p_research_id, v_target_level, now() + (v_time_min || ' minutes')::interval);

  return jsonb_build_object('ok', true, 'target_level', v_target_level,
    'minutes', v_time_min,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;
revoke all on function public.start_research(text) from public;
grant execute on function public.start_research(text) to authenticated;

-- ─── 6) RPC: finish_research() — abgelaufene Forschungen abschließen ──────
create or replace function public.finish_research()
returns int language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_count int := 0;
  q record;
begin
  if v_user is null then return 0; end if;
  for q in
    select * from public.research_queue
     where user_id = v_user and not finished and ends_at <= now()
     order by ends_at
  loop
    insert into public.user_research (user_id, research_id, level)
    values (v_user, q.research_id, q.target_level)
    on conflict (user_id, research_id) do update set level = excluded.level;
    update public.research_queue set finished = true where id = q.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.finish_research() from public;
grant execute on function public.finish_research() to authenticated;

-- ─── 7) RPC: get_research_state() — Read-only View ────────────────────────
create or replace function public.get_research_state()
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  perform public.finish_research();
  return jsonb_build_object('ok', true,
    'definitions', (select coalesce(jsonb_agg(d.*), '[]'::jsonb) from public.research_definitions d),
    'progress',    (select coalesce(jsonb_agg(p.*), '[]'::jsonb) from public.user_research p where p.user_id = v_user),
    'queue',       (select coalesce(jsonb_agg(q.*), '[]'::jsonb) from public.research_queue q where q.user_id = v_user and not q.finished));
end $$;
revoke all on function public.get_research_state() from public;
grant execute on function public.get_research_state() to authenticated;
