-- ══════════════════════════════════════════════════════════════════════════
-- BASE-HP-SYSTEM (Variante A: HP als Defender-Buffer, RoK-Stil)
-- ══════════════════════════════════════════════════════════════════════════
-- - Jede Base hat max_hp (default 5000) + current_hp + hp_updated_at
-- - HP-Gebäude geben +flat und +% (recompute via Trigger)
-- - HP regeneriert 100/min bis max_hp (refresh_base_hp)
-- - repair_base() füllt HP gegen Holz+Stein vollständig auf
-- - resolve_base_attack() zieht HP-Damage ab (atk - def, mind. 60% Atk-Power)
-- - HP=0 → Defender automatisch besiegt + Pillage-Loot 40%
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) HP-Spalten ──────────────────────────────────────────────────────────
alter table public.bases
  add column if not exists max_hp        int not null default 5000,
  add column if not exists current_hp    int not null default 5000,
  add column if not exists hp_updated_at timestamptz not null default now();

alter table public.crew_bases
  add column if not exists max_hp        int not null default 5000,
  add column if not exists current_hp    int not null default 5000,
  add column if not exists hp_updated_at timestamptz not null default now();

-- ─── 2) HP-Gebäude (Solo + Crew) ────────────────────────────────────────────
insert into public.buildings_catalog
  (id, name, emoji, description, category, scope, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_buildtime_minutes, effect_key, effect_per_level, required_base_level, sort)
values
  ('stadtmauer',      'Stadtmauer',      '🧱', 'Erhöht die Grund-HP deiner Base um +500 pro Stufe.',                'combat', 'solo', 15,
    200,  400,  50,   0, 15, 'base_hp_flat', 500,  1, 9),
  ('bergfried',       'Bergfried',       '🏰', 'Multiplikativer HP-Bonus: +8% pro Stufe (auf Grund-HP + Mauer).',   'combat', 'solo', 10,
    400,  600, 100,  50, 25, 'base_hp_pct',  0.08, 5, 10),
  ('crew_stadtmauer', 'Crew-Stadtmauer', '🧱', 'Erhöht die Crew-Base-HP um +1000 pro Stufe.',                       'combat', 'crew', 15,
    500, 1000, 150,   0, 30, 'base_hp_flat', 1000, 1, 30),
  ('crew_bergfried',  'Crew-Bergfried',  '🏰', 'Multiplikativer HP-Bonus für die Crew-Base: +10% pro Stufe.',       'combat', 'crew', 10,
   1000, 1500, 250, 100, 45, 'base_hp_pct',  0.10, 5, 31)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  category = excluded.category, scope = excluded.scope, max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_buildtime_minutes = excluded.base_buildtime_minutes,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_base_level = excluded.required_base_level, sort = excluded.sort;

-- ─── 3) recompute_base_max_hp(base_id, is_crew) ─────────────────────────────
create or replace function public.recompute_base_max_hp(p_base_id uuid, p_is_crew boolean default false)
returns int language plpgsql security definer as $$
declare
  v_flat   int     := 0;
  v_pct    numeric := 0;
  v_max    int;
begin
  if p_is_crew then
    select
      coalesce(sum(case when c.effect_key = 'base_hp_flat' then c.effect_per_level * b.level end), 0)::int,
      coalesce(sum(case when c.effect_key = 'base_hp_pct'  then c.effect_per_level * b.level end), 0)::numeric
      into v_flat, v_pct
      from public.crew_base_buildings b
      join public.buildings_catalog   c on c.id = b.building_id
     where b.crew_base_id = p_base_id;
    v_max := round((5000 + v_flat) * (1 + v_pct))::int;
    update public.crew_bases
       set max_hp        = v_max,
           current_hp    = least(current_hp, v_max),
           hp_updated_at = now()
     where id = p_base_id;
  else
    select
      coalesce(sum(case when c.effect_key = 'base_hp_flat' then c.effect_per_level * b.level end), 0)::int,
      coalesce(sum(case when c.effect_key = 'base_hp_pct'  then c.effect_per_level * b.level end), 0)::numeric
      into v_flat, v_pct
      from public.base_buildings   b
      join public.buildings_catalog c on c.id = b.building_id
     where b.base_id = p_base_id;
    v_max := round((5000 + v_flat) * (1 + v_pct))::int;
    update public.bases
       set max_hp        = v_max,
           current_hp    = least(current_hp, v_max),
           hp_updated_at = now()
     where id = p_base_id;
  end if;
  return v_max;
end $$;

revoke all on function public.recompute_base_max_hp(uuid, boolean) from public;
grant execute on function public.recompute_base_max_hp(uuid, boolean) to authenticated;

-- ─── 4) Trigger: bei Building-Änderung → recompute ──────────────────────────
create or replace function public._tg_base_buildings_hp() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_base_max_hp(OLD.base_id, false);
    return OLD;
  end if;
  perform public.recompute_base_max_hp(NEW.base_id, false);
  return NEW;
end $$;

drop trigger if exists tg_base_buildings_hp on public.base_buildings;
create trigger tg_base_buildings_hp
  after insert or update or delete on public.base_buildings
  for each row execute function public._tg_base_buildings_hp();

create or replace function public._tg_crew_base_buildings_hp() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_base_max_hp(OLD.crew_base_id, true);
    return OLD;
  end if;
  perform public.recompute_base_max_hp(NEW.crew_base_id, true);
  return NEW;
end $$;

drop trigger if exists tg_crew_base_buildings_hp on public.crew_base_buildings;
create trigger tg_crew_base_buildings_hp
  after insert or update or delete on public.crew_base_buildings
  for each row execute function public._tg_crew_base_buildings_hp();

-- Initial: alle Bestandsbasen einmal recomputen
do $$
declare r record;
begin
  for r in select id from public.bases loop
    perform public.recompute_base_max_hp(r.id, false);
  end loop;
  for r in select id from public.crew_bases loop
    perform public.recompute_base_max_hp(r.id, true);
  end loop;
end $$;

-- ─── 5) refresh_base_hp(base_id, is_crew) — Auto-Regen 100/min ──────────────
create or replace function public.refresh_base_hp(p_base_id uuid, p_is_crew boolean default false)
returns int language plpgsql security definer as $$
declare
  v_now   timestamptz := now();
  v_last  timestamptz;
  v_max   int;
  v_cur   int;
  v_secs  int;
  v_regen int;
  v_new   int;
begin
  if p_is_crew then
    select hp_updated_at, max_hp, current_hp into v_last, v_max, v_cur
      from public.crew_bases where id = p_base_id;
  else
    select hp_updated_at, max_hp, current_hp into v_last, v_max, v_cur
      from public.bases where id = p_base_id;
  end if;
  if v_last is null then return v_cur; end if;
  if v_cur >= v_max then
    if p_is_crew then
      update public.crew_bases set hp_updated_at = v_now where id = p_base_id;
    else
      update public.bases      set hp_updated_at = v_now where id = p_base_id;
    end if;
    return v_max;
  end if;
  v_secs  := greatest(0, extract(epoch from (v_now - v_last))::int);
  v_regen := (v_secs * 100) / 60;  -- 100 HP / min
  v_new   := least(v_max, v_cur + v_regen);
  if p_is_crew then
    update public.crew_bases set current_hp = v_new, hp_updated_at = v_now where id = p_base_id;
  else
    update public.bases      set current_hp = v_new, hp_updated_at = v_now where id = p_base_id;
  end if;
  return v_new;
end $$;

revoke all on function public.refresh_base_hp(uuid, boolean) from public;
grant execute on function public.refresh_base_hp(uuid, boolean) to authenticated;

-- ─── 6) repair_base(p_for_crew?) — füllt HP komplett gegen Holz+Stein ───────
create or replace function public.repair_base(p_for_crew uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user    uuid := auth.uid();
  v_base_id uuid;
  v_max     int;
  v_cur     int;
  v_missing int;
  v_cost_w  int;
  v_cost_s  int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  if p_for_crew is null then
    select id into v_base_id from public.bases where owner_user_id = v_user;
    if v_base_id is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
    perform public.refresh_base_hp(v_base_id, false);
    select current_hp, max_hp into v_cur, v_max from public.bases where id = v_base_id;
    v_missing := v_max - v_cur;
    if v_missing <= 0 then return jsonb_build_object('ok', true, 'already_full', true); end if;
    v_cost_w := greatest(1, v_missing / 2);
    v_cost_s := greatest(1, v_missing / 2);
    update public.user_resources set
       wood = wood - v_cost_w, stone = stone - v_cost_s, updated_at = now()
     where user_id = v_user and wood >= v_cost_w and stone >= v_cost_s;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
                                'need_wood', v_cost_w, 'need_stone', v_cost_s);
    end if;
    update public.bases set current_hp = max_hp, hp_updated_at = now() where id = v_base_id;
    return jsonb_build_object('ok', true, 'restored', v_missing,
                              'cost_wood', v_cost_w, 'cost_stone', v_cost_s,
                              'current_hp', v_max, 'max_hp', v_max);
  else
    if not exists (select 1 from public.crew_members where crew_id = p_for_crew and user_id = v_user) then
      return jsonb_build_object('ok', false, 'error', 'not_in_crew');
    end if;
    select id into v_base_id from public.crew_bases where crew_id = p_for_crew;
    if v_base_id is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
    perform public.refresh_base_hp(v_base_id, true);
    select current_hp, max_hp into v_cur, v_max from public.crew_bases where id = v_base_id;
    v_missing := v_max - v_cur;
    if v_missing <= 0 then return jsonb_build_object('ok', true, 'already_full', true); end if;
    v_cost_w := greatest(1, v_missing);    -- Crew-Repair etwas teurer
    v_cost_s := greatest(1, v_missing);
    update public.crew_resources set
       wood = wood - v_cost_w, stone = stone - v_cost_s, updated_at = now()
     where crew_id = p_for_crew and wood >= v_cost_w and stone >= v_cost_s;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
                                'need_wood', v_cost_w, 'need_stone', v_cost_s);
    end if;
    update public.crew_bases set current_hp = max_hp, hp_updated_at = now() where id = v_base_id;
    return jsonb_build_object('ok', true, 'restored', v_missing,
                              'cost_wood', v_cost_w, 'cost_stone', v_cost_s,
                              'current_hp', v_max, 'max_hp', v_max);
  end if;
end $$;

revoke all on function public.repair_base(uuid) from public;
grant execute on function public.repair_base(uuid) to authenticated;

-- ─── 7) resolve_base_attack: erweitert mit HP-Buffer + Pillage ──────────────
create or replace function public.resolve_base_attack(p_attack_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  a record;
  v_atk_power      int := 0;
  v_def_power      int := 0;
  v_def_wall_bonus numeric := 0;
  v_def_base       record;
  v_loot_w int := 0; v_loot_s int := 0; v_loot_g int := 0; v_loot_m int := 0;
  v_outcome text;
  v_pillage boolean := false;
  v_loot_pct numeric := 0;
  v_dmg_to_hp int := 0;
  v_hp_before int := 0;
  v_hp_after  int := 0;
  k text; v_cnt int;
  v_t record;
begin
  select * into a from public.base_attacks where id = p_attack_id for update;
  if a is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.resolved_at is not null then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if a.ends_at > now() then return jsonb_build_object('ok', false, 'error', 'too_early', 'ends_at', a.ends_at); end if;

  for k, v_cnt in select * from jsonb_each_text(a.troops_committed) loop
    select * into v_t from public.troops_catalog where id = k;
    if v_t is null then continue; end if;
    v_atk_power := v_atk_power + v_t.base_atk * v_cnt::int;
  end loop;

  select coalesce(sum(c.count * t.base_def), 0)::int into v_def_power
    from public.crew_troops c join public.troops_catalog t on t.id = c.troop_id
   where c.crew_id = a.defender_crew_id;

  select * into v_def_base from public.crew_bases where crew_id = a.defender_crew_id;
  if v_def_base is not null then
    v_def_wall_bonus := v_def_base.level * 0.05;
    v_def_power      := round(v_def_power * (1 + v_def_wall_bonus));
    perform public.refresh_base_hp(v_def_base.id, true);
    select current_hp into v_hp_before from public.crew_bases where id = v_def_base.id;
  end if;

  -- HP-Schaden = max(60% Atk-Power, Atk - Def), aber min 200 wenn Angriff stattfand
  v_dmg_to_hp := greatest(round(v_atk_power * 0.6)::int, v_atk_power - v_def_power);
  if v_atk_power > 0 then v_dmg_to_hp := greatest(200, v_dmg_to_hp); end if;

  if v_def_base is not null then
    v_hp_after := greatest(0, v_hp_before - v_dmg_to_hp);
    update public.crew_bases set current_hp = v_hp_after, hp_updated_at = now() where id = v_def_base.id;
  end if;

  if v_def_base is not null and v_hp_after = 0 then
    v_outcome  := 'attacker_pillaged';
    v_pillage  := true;
    v_loot_pct := 0.40;
  elsif v_atk_power > v_def_power * 1.10 then
    v_outcome  := 'attacker_won';
    v_loot_pct := 0.20;
  elsif v_def_power > v_atk_power * 1.10 then
    v_outcome  := 'defender_won';
    v_loot_pct := 0;
  else
    v_outcome  := 'draw';
    v_loot_pct := 0;
  end if;

  if v_loot_pct > 0 then
    select round(wood*v_loot_pct)::int, round(stone*v_loot_pct)::int,
           round(gold*v_loot_pct)::int, round(mana*v_loot_pct)::int
      into v_loot_w, v_loot_s, v_loot_g, v_loot_m
      from public.crew_resources where crew_id = a.defender_crew_id;
    update public.crew_resources set
      wood = wood - v_loot_w, stone = stone - v_loot_s,
      gold = gold - v_loot_g, mana = mana - v_loot_m, updated_at = now()
     where crew_id = a.defender_crew_id;
    insert into public.crew_resources (crew_id, wood, stone, gold, mana)
    values (a.attacker_crew_id, v_loot_w, v_loot_s, v_loot_g, v_loot_m)
    on conflict (crew_id) do update set
      wood = public.crew_resources.wood + excluded.wood,
      stone = public.crew_resources.stone + excluded.stone,
      gold = public.crew_resources.gold + excluded.gold,
      mana = public.crew_resources.mana + excluded.mana,
      updated_at = now();
  end if;

  update public.base_attacks set
    resolved_at = now(),
    outcome     = v_outcome,
    loot        = jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m,
                                     'pillage', v_pillage,
                                     'hp_damage', v_dmg_to_hp,
                                     'hp_before', v_hp_before, 'hp_after', v_hp_after),
    losses_attacker = jsonb_build_object('total_atk', v_atk_power,
                                         'pct_lost', case when v_outcome = 'defender_won' then 70
                                                          when v_outcome = 'attacker_pillaged' then 25 else 30 end),
    losses_defender = jsonb_build_object('total_def', v_def_power,
                                         'pct_lost', case when v_pillage then 50
                                                          when v_outcome = 'attacker_won' then 30 else 10 end)
   where id = p_attack_id;

  return jsonb_build_object('ok', true, 'outcome', v_outcome,
    'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg_to_hp, 'hp_before', v_hp_before, 'hp_after', v_hp_after,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m));
end $$;

revoke all on function public.resolve_base_attack(uuid) from public;
grant execute on function public.resolve_base_attack(uuid) to authenticated;
