-- ══════════════════════════════════════════════════════════════════════════
-- BASE FOUNDATION V2: Burg-Lv25, Bauzeit-Kurve, Queue-Slots, Relocate, Loots
-- ══════════════════════════════════════════════════════════════════════════
-- 1) Burg/Hauptgebäude bis Lv 25
-- 2) Bauzeit-Kurve (exponentiell mit Cap)
-- 5) Trainings-Cap = building.level × N
-- 7) Base verlegen via Relocate-Token
-- 10) 2./3. Bauslot ab VIP 4 / VIP 7
-- 11) Neue Loots: VIP-Tickets + Wächter-XP
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) buildings_catalog: buildtime_growth + Burg ─────────────────────────
alter table public.buildings_catalog
  add column if not exists buildtime_growth numeric not null default 1.40;
-- max-Cap: bisher 24h zu wenig, nun konfigurierbar via Setting (default 24h)

-- Burg / Hauptgebäude — gates Building-Levels (du kannst andere Gebäude
-- nicht über Burg-Level ausbauen); max_level 25; lange Bauzeit-Kurve.
insert into public.buildings_catalog
  (id, name, emoji, description, category, scope, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_buildtime_minutes, buildtime_growth,
   effect_key, effect_per_level, required_base_level, sort)
values
  ('burg', 'Burg', '🏰',
   'Hauptgebäude deiner Base. Begrenzt das Maximal-Level aller anderen Gebäude. Bis Stufe 25 ausbaubar.',
   'utility', 'solo', 25,
   500, 700, 100, 50, 30, 1.55,
   'main_building_level', 1.0, 1, 0)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_buildtime_minutes = excluded.base_buildtime_minutes,
  buildtime_growth = excluded.buildtime_growth,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_base_level = excluded.required_base_level, sort = excluded.sort;

-- ─── 7) Base verlegen ──────────────────────────────────────────────────────
alter table public.bases
  add column if not exists relocate_tokens int not null default 0;

create or replace function public.relocate_base(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer as $$
declare v_user uuid := auth.uid(); v_id uuid; v_tokens int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('ok', false, 'error', 'invalid_position');
  end if;
  select id, relocate_tokens into v_id, v_tokens
    from public.bases where owner_user_id = v_user;
  if v_id is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
  if v_tokens < 1 then
    return jsonb_build_object('ok', false, 'error', 'no_relocate_token');
  end if;
  update public.bases
     set lat = p_lat, lng = p_lng,
         relocate_tokens = relocate_tokens - 1,
         updated_at = now()
   where id = v_id;
  return jsonb_build_object('ok', true, 'tokens_left', v_tokens - 1, 'lat', p_lat, 'lng', p_lng);
end $$;
revoke all on function public.relocate_base(double precision, double precision) from public;
grant execute on function public.relocate_base(double precision, double precision) to authenticated;

-- ─── 10) 2./3. Bauslot via VIP ─────────────────────────────────────────────
alter table public.vip_tier_thresholds
  add column if not exists extra_build_slots    int not null default 0,
  add column if not exists extra_research_slots int not null default 0,
  add column if not exists training_speed_pct   numeric not null default 0,
  add column if not exists research_speed_pct   numeric not null default 0;

-- VIP 4 → +1 Bauslot · VIP 7 → +2 Bauslot. Forschung analog.
update public.vip_tier_thresholds set extra_build_slots = 1, extra_research_slots = 1 where vip_level = 4;
update public.vip_tier_thresholds set extra_build_slots = 1, extra_research_slots = 1 where vip_level = 5;
update public.vip_tier_thresholds set extra_build_slots = 1, extra_research_slots = 1 where vip_level = 6;
update public.vip_tier_thresholds set extra_build_slots = 2, extra_research_slots = 2 where vip_level >= 7;
-- Trainings-/Forschungs-Speed wachsen ähnlich der Bauzeit-Boni
update public.vip_tier_thresholds set training_speed_pct = buildtime_bonus_pct,
                                       research_speed_pct = buildtime_bonus_pct;

-- ─── 11) Loots: VIP-Tickets + Wächter-XP als eigene Resourcen ──────────────
alter table public.user_resources
  add column if not exists vip_tickets   int not null default 0 check (vip_tickets >= 0),
  add column if not exists guardian_xp   int not null default 0 check (guardian_xp >= 0);

-- ─── 2/10) start_building: neue Bauzeit-Kurve + Queue-Slot-Check ───────────
-- Bauzeit-Formel: minutes = base * pow(growth, target_level-1), capped 1440 min.
-- Queue-Slots: 1 Basis-Slot + extra_build_slots aus VIP. Burg-Build belegt einen Slot.
drop function if exists public.start_building(text, int, int);
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
  v_extra_slots int := 0;
  v_active_count int;
  v_burg_level int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then v_base_id := public.get_or_create_base(); end if;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;

  -- Burg-Gating: Ziel-Level <= Burg-Level (außer beim Burg-Build selbst).
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

  -- Burg-Cap: alle Nicht-Burg-Gebäude dürfen Burg-Level nicht überschreiten.
  if p_building_id <> 'burg' and v_target_level > greatest(v_burg_level, 1) then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'needed', v_target_level);
  end if;

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  -- Queue-Slot-Check
  select coalesce(t.extra_build_slots, 0) into v_extra_slots
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  select count(*) into v_active_count
    from public.building_queue
   where base_id = v_base_id and not finished;
  if v_active_count >= (1 + coalesce(v_extra_slots, 0)) then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', 1 + v_extra_slots, 'active', v_active_count);
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

  -- Bauzeit-Formel: base * growth^(target_level-1), capped 1440 min (24h).
  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_buildtime_min := least(1440,
    greatest(1, round(v_cat.base_buildtime_minutes
                       * power(coalesce(v_cat.buildtime_growth, 1.40), v_target_level - 1)
                       * (1 - coalesce(v_vip_speed, 0)))));

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

-- ─── 5) train_troop: Cap nach Gebäude-Level (10× pro Stufe) ────────────────
-- Mappt troop_class → Building-ID und prüft level. T1=Lv1 ... T5=Lv20.
-- Ohne benötigtes Building → kann nicht trainiert werden.
drop function if exists public.train_troop(text, int, uuid);
create or replace function public.train_troop(p_troop_id text, p_count int, p_for_crew uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_t record;
  v_seconds int;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_required_building text;
  v_required_level int;
  v_have_level int := 0;
  v_max_at_once int;
  v_base_id uuid;
  v_vip_speed numeric := 0;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_count is null or p_count <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;

  select * into v_t from public.troops_catalog where id = p_troop_id;
  if v_t is null then return jsonb_build_object('ok', false, 'error', 'troop_not_found'); end if;

  -- Klasse → Trainings-Gebäude
  v_required_building := case v_t.troop_class
    when 'infantry' then 'kaserne'
    when 'cavalry'  then 'stall'
    when 'marksman' then 'schiessstand'
    when 'siege'    then 'belagerungsschuppen'
    else null end;
  if v_required_building is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_class');
  end if;
  v_required_level := coalesce(v_t.required_building_level, 1);

  -- Building-Level (Solo oder Crew)
  if p_for_crew is null then
    select id into v_base_id from public.bases where owner_user_id = v_user;
    if v_base_id is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;
    select coalesce(level, 0) into v_have_level
      from public.base_buildings where base_id = v_base_id and building_id = v_required_building;
  else
    if not exists (select 1 from public.crew_members where crew_id = p_for_crew and user_id = v_user) then
      return jsonb_build_object('ok', false, 'error', 'not_in_crew');
    end if;
    select coalesce(bb.level, 0) into v_have_level
      from public.crew_bases cb
      join public.crew_base_buildings bb on bb.crew_base_id = cb.id
     where cb.crew_id = p_for_crew and bb.building_id = v_required_building;
  end if;

  if v_have_level < v_required_level then
    return jsonb_build_object('ok', false, 'error', 'building_level_too_low',
      'required_building', v_required_building, 'required_level', v_required_level,
      'have_level', v_have_level);
  end if;

  -- Cap: Gebäude-Level × 10 (Solo) bzw. × 25 (Crew)
  v_max_at_once := v_have_level * (case when p_for_crew is null then 10 else 25 end);
  if p_count > v_max_at_once then
    return jsonb_build_object('ok', false, 'error', 'too_many_at_once',
      'max_at_once', v_max_at_once);
  end if;

  v_seconds := v_t.train_time_seconds * p_count;
  -- VIP-Bonus: training_speed_pct
  select coalesce(t.training_speed_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_seconds := greatest(1, round(v_seconds * (1 - coalesce(v_vip_speed, 0))));

  v_cost_w := v_t.cost_wood  * p_count;
  v_cost_s := v_t.cost_stone * p_count;
  v_cost_g := v_t.cost_gold  * p_count;
  v_cost_m := v_t.cost_mana  * p_count;

  if p_for_crew is not null then
    update public.crew_resources set
      wood = wood - v_cost_w, stone = stone - v_cost_s,
      gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
     where crew_id = p_for_crew
       and wood >= v_cost_w and stone >= v_cost_s
       and gold >= v_cost_g and mana >= v_cost_m;
    if not found then return jsonb_build_object('ok', false, 'error', 'not_enough_resources'); end if;
    insert into public.troop_training_queue (crew_id, troop_id, count, ends_at)
    values (p_for_crew, p_troop_id, p_count, now() + (v_seconds || ' seconds')::interval);
  else
    update public.user_resources set
      wood = wood - v_cost_w, stone = stone - v_cost_s,
      gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
     where user_id = v_user
       and wood >= v_cost_w and stone >= v_cost_s
       and gold >= v_cost_g and mana >= v_cost_m;
    if not found then return jsonb_build_object('ok', false, 'error', 'not_enough_resources'); end if;
    insert into public.troop_training_queue (user_id, troop_id, count, ends_at)
    values (v_user, p_troop_id, p_count, now() + (v_seconds || ' seconds')::interval);
  end if;

  return jsonb_build_object('ok', true, 'seconds', v_seconds, 'count', p_count);
end $$;
revoke all on function public.train_troop(text, int, uuid) from public;
grant execute on function public.train_troop(text, int, uuid) to authenticated;

-- ─── 11) open_chest erweitert: VIP-Tickets + Guardian-XP gutschreiben ──────
drop function if exists public.open_chest(uuid);
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
  v_vip_tickets int := 0;
  v_guardian_xp int := 0;
  v_relocate_token int := 0;
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

  insert into public.chest_pity (user_id) values (v_user) on conflict do nothing;
  select * into v_pity from public.chest_pity where user_id = v_user for update;

  if v_chest.kind = 'gold' then
    if v_pity.pity_leg_counter >= 29 then v_rarity := 'legend';
    elsif v_pity.pity_epic_counter >= 9 or random() < 0.10 then v_rarity := 'epic';
    elsif random() < 0.30 then v_rarity := 'rare';
    else v_rarity := 'common'; end if;
  else
    if random() < 0.05 then v_rarity := 'epic';
    elsif random() < 0.25 then v_rarity := 'rare';
    else v_rarity := 'common'; end if;
  end if;

  update public.chest_pity set
    silver_opened     = silver_opened + (case when v_chest.kind = 'silver' then 1 else 0 end),
    gold_opened       = gold_opened   + (case when v_chest.kind = 'gold'   then 1 else 0 end),
    pity_epic_counter = case when v_rarity in ('epic','legend') then 0 else pity_epic_counter + 1 end,
    pity_leg_counter  = case when v_rarity = 'legend' then 0 else pity_leg_counter + 1 end
  where user_id = v_user;

  v_xp    := case v_rarity when 'common' then 100 when 'rare' then 300 when 'epic' then 800 else 2500 end;
  v_gold  := case v_rarity when 'common' then 50  when 'rare' then 150 when 'epic' then 500 else 1500 end;
  v_mana  := case v_rarity when 'common' then 20  when 'rare' then 80  when 'epic' then 250 else 800  end;
  v_wood  := case v_rarity when 'common' then 100 when 'rare' then 300 when 'epic' then 800 else 2000 end;
  v_stone := case v_rarity when 'common' then 100 when 'rare' then 300 when 'epic' then 800 else 2000 end;
  -- Neu: VIP-Tickets + Guardian-XP
  v_vip_tickets := case v_rarity when 'common' then 0   when 'rare' then 1   when 'epic' then 3   else 10 end;
  v_guardian_xp := case v_rarity when 'common' then 50  when 'rare' then 200 when 'epic' then 600 else 2000 end;
  -- Relocate-Token nur bei legend (5%-Drop) — als Sammelbares Spezial-Item
  if v_rarity = 'legend' or (v_rarity = 'epic' and random() < 0.10) then
    v_relocate_token := 1;
  end if;

  if v_chest.owner_user_id is not null then
    insert into public.user_resources (user_id, wood, stone, gold, mana, vip_tickets, guardian_xp)
    values (v_user, v_wood, v_stone, v_gold, v_mana, v_vip_tickets, v_guardian_xp)
    on conflict (user_id) do update set
      wood        = public.user_resources.wood + excluded.wood,
      stone       = public.user_resources.stone + excluded.stone,
      gold        = public.user_resources.gold + excluded.gold,
      mana        = public.user_resources.mana + excluded.mana,
      vip_tickets = public.user_resources.vip_tickets + excluded.vip_tickets,
      guardian_xp = public.user_resources.guardian_xp + excluded.guardian_xp,
      updated_at  = now();
    if v_relocate_token > 0 then
      update public.bases set relocate_tokens = relocate_tokens + v_relocate_token
       where owner_user_id = v_user;
    end if;
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

  if v_rarity in ('epic','legend') then
    insert into public.user_guardian_xp_items (user_id, item_id, count)
    values (v_user, case when v_rarity = 'legend' then 'xp_pot_l' else 'xp_pot_m' end, 1)
    on conflict (user_id, item_id) do update set count = public.user_guardian_xp_items.count + 1;
  end if;

  v_payload := jsonb_build_object(
    'rarity', v_rarity, 'wood', v_wood, 'stone', v_stone,
    'gold', v_gold, 'mana', v_mana, 'xp', v_xp,
    'vip_tickets', v_vip_tickets, 'guardian_xp', v_guardian_xp,
    'relocate_token', v_relocate_token,
    'pity_epic', v_pity.pity_epic_counter, 'pity_leg', v_pity.pity_leg_counter
  );
  update public.treasure_chests set opened_at = now(), payload = v_payload where id = p_chest_id;
  return jsonb_build_object('ok', true, 'payload', v_payload);
end $$;
revoke all on function public.open_chest(uuid) from public;
grant execute on function public.open_chest(uuid) to authenticated;
