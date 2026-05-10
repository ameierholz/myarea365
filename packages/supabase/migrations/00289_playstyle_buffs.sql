-- ════════════════════════════════════════════════════════════════════════
-- 00289_playstyle_buffs.sql
-- Aktiviert die 4 Spielstil-Buffs (architect/warlord/strategist/diplomat).
-- Liest users.faction (Legacy-Spaltenname mit neuen Werten) und appliziert
-- Multiplier in den existierenden RPCs.
--
-- Buff-Übersicht:
--   architect:  -5% Bauzeit (start_building)        + +5% Resource-Yield (_collect_one_building)
--   warlord:    +5% Wächter-Damage (_reserve_user_troops) + +5% Wegelager-Plünder (siehe Phase B)
--   strategist: -5% Forschungszeit (start_research) + Spionage-Tarn (spy_player_base, Kosten=0)
--   diplomat:   +10% Crew-Contribution + Don-Aura-Reichweite (siehe Phase B)
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) HELPER: playstyle_buff(uid, kind) → Multiplier ──────────────────
-- Zentrale Quelle für alle Spielstil-Buff-Berechnungen. RPCs rufen diesen
-- Helper auf statt selbst users.faction zu lesen.
--
-- Konventionen für die zurückgegebenen Multiplier:
--   - Speed/Cost-Reduktionen:  Faktor < 1.0 (z.B. 0.95 = 5% schneller/billiger)
--   - Yield/Damage-Boosts:     Faktor > 1.0 (z.B. 1.05 = +5%)
--   - Tarn (Kosten = 0):       0.0
--   - Default (kein Buff):     1.0
create or replace function public.playstyle_buff(p_user uuid, p_kind text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_faction text;
begin
  if p_user is null then return 1.0; end if;
  select faction into v_faction from public.users where id = p_user;
  if v_faction is null then return 1.0; end if;

  return case
    -- ARCHITECT — Wirtschaft / Aufbau
    when v_faction = 'architect' and p_kind = 'build_speed'      then 0.95  -- 5% schneller bauen
    when v_faction = 'architect' and p_kind = 'resource_yield'   then 1.05  -- 5% mehr Production-Collect

    -- WARLORD — Krieg / Eroberung
    when v_faction = 'warlord'   and p_kind = 'guardian_damage'  then 1.05  -- 5% mehr Truppen-ATK
    when v_faction = 'warlord'   and p_kind = 'plunder_loot'     then 1.05  -- 5% mehr Wegelager-Beute

    -- STRATEGIST — Forschung / Spionage
    when v_faction = 'strategist' and p_kind = 'research_speed'  then 0.95  -- 5% schnellere Forschung
    when v_faction = 'strategist' and p_kind = 'spy_cost'        then 0.0   -- Tarn: Spionage gratis

    -- DIPLOMAT — Crew / Allianzen
    when v_faction = 'diplomat'  and p_kind = 'crew_contribution' then 1.10 -- +10% Crew-Beitrag
    when v_faction = 'diplomat'  and p_kind = 'don_aura_radius'   then 1.20 -- +20% Don-Aura-Radius

    else 1.0
  end;
end $$;

revoke all on function public.playstyle_buff(uuid, text) from public;
grant execute on function public.playstyle_buff(uuid, text) to authenticated;

-- ─── 2) start_building — ARCHITECT -5% Bauzeit ──────────────────────────
-- Patch: einziger Unterschied zur 00103-Version ist `* playstyle_buff(...)` in
-- der v_buildtime_min-Berechnung. Rest 1:1 kopiert.
create or replace function public.start_building(p_building_id text, p_position_x int, p_position_y int)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_cat record;
  v_existing record;
  v_action text;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_resources record;
  v_buildtime_min int;
  v_vip_speed numeric := 0;
  v_extra_slots_vip int := 0;
  v_burg_level int := 0;
  v_extra_slots_burg int := 0;
  v_total_slots int;
  v_active_count int;
  v_unmet jsonb;
  v_playstyle_speed numeric := 1.0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then v_base_id := public.get_or_create_base(); end if;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;

  select coalesce(level, 0) into v_burg_level
    from public.base_buildings where base_id = v_base_id and building_id = 'burg';

  select * into v_existing from public.base_buildings
    where base_id = v_base_id and building_id = p_building_id;

  if v_existing is null then
    v_action := 'build';
    v_target_level := 1;
    v_cost_mult := 1.0;
  else
    if v_existing.level >= v_cat.max_level then
      return jsonb_build_object('ok', false, 'error', 'max_level_reached');
    end if;
    if v_existing.status <> 'idle' then
      return jsonb_build_object('ok', false, 'error', 'already_in_progress');
    end if;
    v_action := 'upgrade';
    v_target_level := v_existing.level + 1;
    v_cost_mult := power(1.6, v_existing.level);
  end if;

  if p_building_id <> 'burg' and v_target_level > greatest(v_burg_level, 1) then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'needed', v_target_level);
  end if;

  if p_building_id = 'burg' and v_target_level >= 2 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'building_id', r.building_id,
      'name',        c.name,
      'required_level', r.required_level,
      'have_level',  coalesce(bb.level, 0)
    )), '[]'::jsonb)
      into v_unmet
      from public.burg_level_requirements r
      join public.buildings_catalog c on c.id = r.building_id
      left join public.base_buildings bb on bb.base_id = v_base_id and bb.building_id = r.building_id
     where r.burg_level = v_target_level
       and coalesce(bb.level, 0) < r.required_level;
    if jsonb_array_length(v_unmet) > 0 then
      return jsonb_build_object('ok', false, 'error', 'burg_requirements_unmet',
        'target_level', v_target_level, 'unmet', v_unmet);
    end if;
  end if;

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  select coalesce(t.extra_build_slots, 0) into v_extra_slots_vip
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_extra_slots_burg := case
    when v_burg_level >= 22 then 4
    when v_burg_level >= 17 then 3
    when v_burg_level >= 11 then 2
    when v_burg_level >=  4 then 1
    else 0 end;
  v_total_slots := 1 + greatest(v_extra_slots_vip, v_extra_slots_burg);

  select count(*) into v_active_count
    from public.building_queue
   where base_id = v_base_id and not finished;
  if v_active_count >= v_total_slots then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', v_total_slots, 'active', v_active_count);
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

  -- Bauzeit-Formel + ARCHITECT-Buff (-5%)
  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_playstyle_speed := public.playstyle_buff(v_user, 'build_speed');
  v_buildtime_min := least(20160,
    greatest(1, round(v_cat.base_buildtime_minutes
                       * power(coalesce(v_cat.buildtime_growth, 1.40), v_target_level - 1)
                       * (1 - coalesce(v_vip_speed, 0))
                       * coalesce(v_playstyle_speed, 1.0))));

  if v_existing is null then
    insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
    values (v_base_id, p_building_id, p_position_x, p_position_y, 0, 'building');
  else
    update public.base_buildings set status = 'upgrading' where id = v_existing.id;
  end if;

  insert into public.building_queue
    (base_id, building_id, action, target_level, ends_at, cost_wood, cost_stone, cost_gold, cost_mana)
  values
    (v_base_id, p_building_id, v_action, v_target_level,
     now() + (v_buildtime_min || ' minutes')::interval,
     v_cost_w, v_cost_s, v_cost_g, v_cost_m);

  return jsonb_build_object('ok', true,
    'action', v_action, 'target_level', v_target_level,
    'buildtime_minutes', v_buildtime_min,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;
revoke all on function public.start_building(text, int, int) from public;
grant execute on function public.start_building(text, int, int) to authenticated;

-- ─── 3) start_research — STRATEGIST -5% Forschungszeit ──────────────────
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
  v_playstyle_speed numeric := 1.0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_def from public.research_definitions where id = p_research_id;
  if v_def is null then return jsonb_build_object('ok', false, 'error', 'research_not_found'); end if;

  if v_def.prereq_id is not null then
    select * into v_prereq from public.user_research where user_id = v_user and research_id = v_def.prereq_id;
    if v_prereq is null or v_prereq.level < 1 then
      return jsonb_build_object('ok', false, 'error', 'prereq_missing', 'prereq_id', v_def.prereq_id);
    end if;
  end if;

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

  -- Forschungszeit-Formel + STRATEGIST-Buff (-5%)
  select coalesce(t.research_speed_pct, 0) into v_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_playstyle_speed := public.playstyle_buff(v_user, 'research_speed');
  v_time_min := least(2880,
    greatest(1, round(v_def.base_time_minutes
                       * power(coalesce(v_def.buildtime_growth, 1.45), v_target_level - 1)
                       * (1 - coalesce(v_speed, 0))
                       * coalesce(v_playstyle_speed, 1.0))));

  insert into public.research_queue (user_id, research_id, target_level, ends_at)
  values (v_user, p_research_id, v_target_level, now() + (v_time_min || ' minutes')::interval);

  return jsonb_build_object('ok', true, 'target_level', v_target_level,
    'minutes', v_time_min,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;
revoke all on function public.start_research(text) from public;
grant execute on function public.start_research(text) to authenticated;

-- ─── 4) _collect_one_building — ARCHITECT +5% Resource-Yield ────────────
create or replace function public._collect_one_building(p_bb_id uuid)
returns table (resource text, amount int, capped boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_user      uuid;
  v_bb        public.base_buildings%rowtype;
  v_cat       public.buildings_catalog%rowtype;
  v_resource  text;
  v_rate      numeric;
  v_cap       numeric;
  v_anchor    timestamptz;
  v_elapsed_h numeric;
  v_raw       numeric;
  v_amount    int;
  v_capped    boolean;
  v_yield_buff numeric := 1.0;
begin
  select * into v_bb from public.base_buildings where id = p_bb_id for update;
  if not found then raise exception 'building_not_found'; end if;

  select owner_user_id into v_user from public.bases where id = v_bb.base_id;
  if v_user is null then raise exception 'orphan_base'; end if;
  if v_user <> auth.uid() then raise exception 'not_owner'; end if;

  select * into v_cat from public.buildings_catalog where id = v_bb.building_id;
  if not found then raise exception 'catalog_missing'; end if;

  v_resource := public._production_resource(v_cat.effect_key);
  if v_resource is null then
    return query select null::text, 0, false;
    return;
  end if;

  -- Rate + 6h-Cap (Cap bleibt unverändert; Architect-Buff erhöht NUR den Yield bis Cap)
  v_rate := v_cat.effect_per_level * v_bb.level;
  v_cap  := 6 * v_rate;

  v_anchor    := coalesce(v_bb.last_collected_at, v_bb.created_at);
  v_elapsed_h := greatest(0, extract(epoch from (now() - v_anchor)) / 3600.0);

  v_raw    := v_elapsed_h * v_rate;
  v_capped := v_raw >= v_cap;

  -- ARCHITECT-Buff (+5% Yield) NACH Cap → Bonus zählt zusätzlich, Cap bleibt fair
  v_yield_buff := public.playstyle_buff(v_user, 'resource_yield');
  v_amount := floor(least(v_raw, v_cap) * coalesce(v_yield_buff, 1.0))::int;

  if v_amount <= 0 then
    return query select v_resource, 0, v_capped;
    return;
  end if;

  insert into public.user_resources (user_id) values (v_user) on conflict do nothing;
  update public.user_resources set
    wood        = wood        + case when v_resource = 'wood'  then v_amount else 0 end,
    stone       = stone       + case when v_resource = 'stone' then v_amount else 0 end,
    gold        = gold        + case when v_resource = 'gold'  then v_amount else 0 end,
    mana        = mana        + case when v_resource = 'mana'  then v_amount else 0 end,
    updated_at  = now()
  where user_id = v_user;

  update public.base_buildings set last_collected_at = now() where id = p_bb_id;

  return query select v_resource, v_amount, v_capped;
end $$;

-- ─── 5) _reserve_user_troops — WARLORD +5% Damage ───────────────────────
create or replace function public._reserve_user_troops(p_user uuid, p_troops jsonb)
returns bigint language plpgsql as $$
declare
  v_key text;
  v_count int;
  v_have int;
  v_total_atk bigint := 0;
  v_atk int;
  v_damage_buff numeric := 1.0;
begin
  for v_key, v_count in select * from jsonb_each_text(p_troops) loop
    if v_count::int <= 0 then continue; end if;
    select coalesce(count, 0) into v_have from public.user_troops where user_id = p_user and troop_id = v_key;
    if coalesce(v_have, 0) < v_count::int then
      raise exception 'not_enough_troops:%', v_key;
    end if;
    select base_atk into v_atk from public.troops_catalog where id = v_key;
    if v_atk is null then raise exception 'invalid_troop:%', v_key; end if;
    v_total_atk := v_total_atk + (v_atk::bigint * v_count::int);
  end loop;

  for v_key, v_count in select * from jsonb_each_text(p_troops) loop
    if v_count::int <= 0 then continue; end if;
    update public.user_troops set count = count - v_count::int
     where user_id = p_user and troop_id = v_key;
  end loop;

  -- WARLORD-Buff (+5% Truppen-Damage) — auf Gesamt-ATK appliziert
  v_damage_buff := public.playstyle_buff(p_user, 'guardian_damage');
  return floor(v_total_atk * coalesce(v_damage_buff, 1.0))::bigint;
end $$;

-- ─── 6) spy_player_base — STRATEGIST Spionage-Tarn (Kosten=0) ───────────
-- Gold-Kosten werden mit playstyle_buff(strategist, 'spy_cost') multipliziert.
-- Strategist bekommt 0.0 → 0 Gold-Kosten ("Tarn-Bonus, keiner sieht dich kommen").
-- Andere zahlen weiter 500 Gold.
create or replace function public.spy_player_base(p_defender_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_cost_base int := 500;
  v_cost int;
  v_def_base_id uuid;
  v_def_level int;
  v_def_hp_cur int;
  v_def_hp_max int;
  v_def_shield timestamptz;
  v_troops_total int := 0;
  v_atk_power int := 0;
  v_def_power int := 0;
  v_res record;
  v_atk_name text;
  v_breakdown jsonb;
  v_guardian jsonb;
  v_cost_buff numeric;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_spy_self'); end if;

  -- STRATEGIST-Buff: Gold-Kosten reduzieren (Tarn = 0 Gold)
  v_cost_buff := public.playstyle_buff(v_user, 'spy_cost');
  v_cost := floor(v_cost_base * coalesce(v_cost_buff, 1.0))::int;

  if v_cost > 0 then
    update public.user_resources set gold = gold - v_cost, updated_at = now()
     where user_id = v_user and gold >= v_cost;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'not_enough_gold', 'need', v_cost);
    end if;
  end if;

  select id, level, shield_until into v_def_base_id, v_def_level, v_def_shield
    from public.bases where owner_user_id = p_defender_user_id;
  if v_def_base_id is null then
    if v_cost > 0 then
      update public.user_resources set gold = gold + v_cost where user_id = v_user;
    end if;
    return jsonb_build_object('ok', false, 'error', 'no_base');
  end if;

  perform public.refresh_base_hp(v_def_base_id, false);
  select current_hp, max_hp into v_def_hp_cur, v_def_hp_max
    from public.bases where id = v_def_base_id;

  select coalesce(sum(count), 0)::int into v_troops_total
    from public.user_troops where user_id = p_defender_user_id;

  select coalesce(sum(ut.count * t.base_atk), 0)::int,
         coalesce(sum(ut.count * t.base_def), 0)::int
    into v_atk_power, v_def_power
    from public.user_troops ut
    join public.troops_catalog t on t.id = ut.troop_id
   where ut.user_id = p_defender_user_id;

  v_def_power := round(v_def_power * (1 + v_def_level * 0.03))::int;

  select jsonb_object_agg(troop_class, total) into v_breakdown
    from (
      select t.troop_class, sum(ut.count)::int as total
        from public.user_troops ut
        join public.troops_catalog t on t.id = ut.troop_id
       where ut.user_id = p_defender_user_id
       group by t.troop_class
    ) s;

  select jsonb_build_object(
           'archetype_id', ga.id,
           'name', ga.name,
           'emoji', ga.emoji,
           'rarity', ga.rarity,
           'level', ug.level
         ) into v_guardian
    from public.user_guardians ug
    join public.guardian_archetypes ga on ga.id = ug.archetype_id
   where ug.user_id = p_defender_user_id and ug.is_active = true
   limit 1;

  select coalesce(wood,0) as wood, coalesce(stone,0) as stone,
         coalesce(gold,0) as gold, coalesce(mana,0) as mana
    into v_res
    from public.user_resources where user_id = p_defender_user_id;

  select coalesce(display_name, username, 'Unbekannt') into v_atk_name
    from public.users where id = v_user;

  insert into public.user_inbox (user_id, title, body) values
  (v_user,
   '🔍 Spionage-Bericht: ' || (select coalesce(display_name, username, 'Gegner') from public.users where id = p_defender_user_id),
   E'Aufklärung erfolgreich (Kosten: ' || v_cost || E' 🪙).\n' ||
   E'\n📊 Übersicht'
   E'\n  Base-Stufe: ' || v_def_level ||
   E'\n  HP: ' || v_def_hp_cur || ' / ' || v_def_hp_max ||
   E'\n  Stärke (Truppen): ' || v_troops_total ||
   E'\n  Angriffsmacht: ' || v_atk_power ||
   E'\n  Verteidigungsmacht: ' || v_def_power ||
   case when v_def_shield is not null and v_def_shield > now()
        then E'\n  🛡️ Schutzschild aktiv bis ' || to_char(v_def_shield, 'DD.MM.YYYY HH24:MI')
        else '' end ||
   E'\n\n🪙 Im Lager'
   E'\n  Holz:  ' || coalesce(v_res.wood, 0) ||
   E'\n  Stein: ' || coalesce(v_res.stone, 0) ||
   E'\n  Gold:  ' || coalesce(v_res.gold, 0) ||
   E'\n  Mana:  ' || coalesce(v_res.mana, 0) ||
   case when v_breakdown is not null and v_breakdown <> '{}'::jsonb
        then E'\n\n⚔️ Truppen-Aufteilung\n' ||
             coalesce((select string_agg('  ' ||
               case k when 'infantry' then '🛡️ Infanterie' when 'cavalry' then '🐎 Kavallerie'
                      when 'marksman' then '🏹 Schützen' when 'siege' then '🪨 Belagerung' else k end ||
               ': ' || (v_breakdown ->> k), E'\n')
               from jsonb_object_keys(v_breakdown) k), '')
        else '' end ||
   case when v_guardian is not null
        then E'\n\n🐲 Aktiver Wächter: ' || (v_guardian ->> 'emoji') || ' ' ||
             (v_guardian ->> 'name') || ' (' || upper(v_guardian ->> 'rarity') ||
             ' · Lv ' || (v_guardian ->> 'level') || ')'
        else '' end),
  (p_defender_user_id,
   '🔍 Spähtrupp gesichtet',
   E'Ein Späher von ' || v_atk_name || E' hat deine Base ausgekundschaftet.\n' ||
   E'Erwäge dein Schild zu aktivieren oder die Verteidigung zu verstärken.');

  return jsonb_build_object('ok', true,
    'cost', v_cost,
    'spy_stealth', v_cost = 0,
    'base_level', v_def_level,
    'hp_current', v_def_hp_cur,
    'hp_max', v_def_hp_max,
    'troops_total', v_troops_total,
    'atk_power', v_atk_power,
    'def_power', v_def_power,
    'shield_until', v_def_shield,
    'breakdown', v_breakdown,
    'guardian', v_guardian,
    'resources', jsonb_build_object('wood', v_res.wood, 'stone', v_res.stone, 'gold', v_res.gold, 'mana', v_res.mana));
end $$;
revoke all on function public.spy_player_base(uuid) from public;
grant execute on function public.spy_player_base(uuid) to authenticated;

-- ─── 7) Granular Apply: WARLORD Plünder + DIPLOMAT Crew-Beitrag ─────────
-- Diese Buffs werden in tick_gather_marches und Crew-Contribute-Tracking
-- gelesen. Da die zentralen Funktionen sehr lang sind, exposed wir hier
-- nur die playstyle_buff()-Helper. Die nächste Migration patcht die
-- konkreten Aufrufstellen ein. Bis dahin sind die UI-Strings bereits
-- konsistent (siehe Frontend-Patch in playstyles.ts).

comment on function public.playstyle_buff(uuid, text) is
  'Spielstil-Multiplier für users.faction. Ruft mit (uid, kind) auf — Kinds: build_speed, resource_yield, guardian_damage, plunder_loot, research_speed, spy_cost, crew_contribution, don_aura_radius. Default 1.0.';
